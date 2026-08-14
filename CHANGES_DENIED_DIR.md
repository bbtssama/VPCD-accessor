# T24 无权限目录点击拦截 + 抖动动效 · 改动摘要（CHANGES_DENIED_DIR）

> 任务：t24（netdisk-frontend-opt 团队 feature-engineer）
> 改动文件：`server/server.py`、`static/app.js`、`server/templates/index.html`
> 原则：与 engineer 的 T17/T18 并行改动互不冲突（均用 edit 精准替换各自区域）；server.py 全权本任务；
> 前端仅动列表渲染 + bindRowAction + 长按入口，不重写文件。验证门禁：py_compile + node --check + CSS 括号平衡。

## 一、后端（server/server.py）
1. **新增 `_dir_denied(path)` 轻量检测**（`_list_dir` 上方）：
   - **Windows**：`os.access` 走 CRT `_waccess`，只查存在性不查 ACL —— 实测对被 `icacls /deny` 的目录仍返回 True，无法检出"无权限"。
     因此改用 `os.scandir(path)` 只读第一条试探（FindFirstFile 需要 FILE_LIST_DIRECTORY 权限，与用户点击进入目录时的真实行为一致），
     仅一次句柄打开 + 首条读取，远轻于完整 listdir；PermissionError 即判定 denied。
   - **非 Windows**：回退 `os.access(path, os.R_OK | os.X_OK)`（POSIX 权限位判定正确）。
2. **`_list_dir` 条目构建**：`denied = is_dir and _dir_denied(e.path)`，所有条目（含文件）统一带 `denied` 键（文件恒 False）。
   权限拒绝的目录仍展示在列表中（用户能"看见它存在"），但点击被前端拦截。
3. **分享模式同步**：多文件分享列表、虚拟分享列表的条目同样补 `denied` 键（同一 `_dir_denied` 判定）。

## 二、前端（static/app.js）
1. **列表行 / 网格卡片**：`listItem` / `gridItem` 读取 `e.denied`，为 denied 目录追加 `.denied` 类 + `title="无权限访问该目录"`。
2. **点击拦截**（`bindRowAction` 目录分支）：`e.denied` → 不进入目录，`preventDefault + stopPropagation`，
   触发 `shakeEl(el)` 抖动 + `toast("无权限访问该目录")`；光标置 `not-allowed`。
3. **动效 `shakeEl`**：对行/卡片施加 `deny-shake` 动画类（~300ms），`void offsetWidth` 强制重排保证连续点击可重启动画；
   list 模式向上找 `.list-group-item` 整行，grid 模式 el 即卡片。
4. **长按多选排除**：`bindLongPress` 起始条件加 `e.denied`，denied 目录不进入长按多选（对无权限目录做批量操作无意义）。

## 三、样式（server/templates/index.html）
1. `.denied` 不可访问视觉：图标 `grayscale(1) opacity(.55)` 灰化、名称/文字用 `--bs-secondary-color` 弱化、
   网格卡片虚线边框（`border-style: dashed`）、行/卡片 `cursor: not-allowed`。颜色全走 `--bs-*` 变量 → **深色模式自动适配**。
2. **`@keyframes denyShake`**（0.3s 左右抖动，幅度递减）+ `.deny-shake` 应用类。
3. `@media (prefers-reduced-motion: reduce)` 下禁用动画（系统"减少动态效果"偏好）。

## 四、验证
- py_compile（D:\ANACONDA\python.exe）：通过；node --check app.js：通过；index.html CSS 括号平衡 330/330。
- **单测（monkeypatch os.access）**：bad_dir → denied=True；ok_dir / 文件 → denied=False。PASS。
- **真实 ACL 测试**：`icacls /deny <user>:(R,W,D,X)` 创建拒绝目录后 `_list_dir` 实测
  blocked_dir → denied=True、open_dir → False、文件 → False。PASS（并实测确认 `os.access` 在该场景返回 True、listdir 抛 PermissionError，
  佐证了 Windows 下必须用 scandir 探测的结论）。
- **HTTP E2E**：`_start(tmp, 8899, token)` 启动实测 `GET /api/list` 返回 200，JSON 中
  locked_here → denied=true、open_here → false、note.txt → false。PASS。测试服务器已关、临时文件已清。

## 五、已知边界
- 服务以管理员身份运行时，Windows ACL 拒绝可能被 SeBackupPrivilege 等机制绕过，scandir 探测会返回可访问（此时判定 False 属真实行为）；
  该场景下进入目录仍有后端 403 兜底提示。
- 目录内首条读取的探测成本 = 每个子目录一次 FindFirstFile，本地盘可忽略；网络盘/超大目录（如 System32 数千子目录）约增加数十毫秒，属可接受范围。

## 六、收尾增强（engineer，T19 并行核对后补齐）
1. **denied 灰化适配 inline SVG 图标**：列表/网格图标已由 T17 改为 inline SVG（`.ic svg` / `.grid-cover.ic-inline`），
   原选择器只匹配 `img`（灰化失效）——已补 `filter: grayscale(1) opacity(.55)` 覆盖 svg。
2. **denied 目录小锁标记**：目录图标右上角加 `.deny-lock`（白底圆徽 + 锁图标 + 细边框，list 12px / grid 16px），
   无权限提示更直观（mimo 视觉验收反馈"灰化差异不够明显"后的补强）。
3. **修复并行改动破坏的 T7 CSS 结构**：`--brand-btn-radius` 被误移出 `:root` 导致 CSS 括号不平衡（334/335）——已归位，平衡 0。
4. **验证**：E2E 实测 C:\ 根 4 个 denied 目录（Config.Msi / System Volume Information / Documents and Settings 等）——
   点击 denied → cur 不变（不进入）+ toast"无权限访问该目录"；computed style 确认 svg 灰化 / 文字弱化 / not-allowed；锁标记渲染正常；无 JS 报错。
   截图：`G:\自建agent专用工作区\DSH\_t8shots\t19_01~04`。
