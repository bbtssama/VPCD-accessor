# CHANGES_HIDDEN.md — 隐藏文件开关 + 列表统计行 + 网格悬停全名（T37）

> 任务：t37（netdisk-frontend-opt 团队 / engineer）
> UX_REPORT §4 P2：系统/隐藏文件默认可见 + 网格文件名截断无提示。

## 一、需求对照

| 需求 | 实现 | 验证 |
|---|---|---|
| 列表接口 show_hidden=1（默认 0）过滤隐藏 | server.py _list_dir 新增 show_hidden 参数 + _is_hidden_entry 判定 | ✅ |
| 过滤 "." 开头 / "~" 开头（含 Office ~$ 前缀）/ Windows HIDDEN(0x2) | 名称前缀 + st_file_attributes 位判断（getattr 容错，非 Windows 平台为 0） | ✅ |
| **不**过滤 SYSTEM(0x4)——F: System Volume Information 必须继续显示 | _is_hidden_entry 中 attrs & 0x4 → 永不因属性隐藏（Hidden+System 目录仍显示，denied 演示不受影响） | ✅ attrsys.txt / attrsh.txt 始终可见 |
| 分享模式同逻辑 | share 路由三处：绝对目录 _list_dir 传参、虚拟分享按真实文件名/属性过滤、多文件分享过滤（单文件显式分享不过滤） | ✅ 分享页默认隐藏 / 开关注入可见 |
| 前端开关 + localStorage drive.showHidden + 切换重请求 | 侧边栏「显示隐藏文件」form-switch（showHiddenToggle）；loadList 追加 show_hidden=1；主站持久化，分享模式会话内有效不持久化 | ✅ 切换即时重载、刷新记住 |
| 列表统计行「共 N 项 · X 个目录 · Y 个文件」 | #listStats 行，loadList 成功渲染、失败/空隐藏 | ✅ 共 4 项 · 1 个目录 · 3 个文件（默认）→ 共 9 项 · 2 个目录 · 7 个文件（开启） |
| 网格文件名 ellipsis + title 全名 | gridItem .grid-name 设 title（列表行 .nm 一并补上） | ✅ 9/9 有 title，悬停显示全名 |

## 二、改动文件

- **server/server.py**
  - 新增 `_is_hidden_entry(name, st)`：点文件 / ~ 前缀 / HIDDEN(0x2)；SYSTEM(0x4) 豁免（SVI 演示依赖）
  - `_list_dir(path, show_hidden=False)`：循环内过滤
  - 主路由 /api/list、分享路由（绝对目录 / 虚拟分享 / 多文件分享）三处接入 show_hidden 查询参数
- **static/app.js**
  - `let showHidden`（主站从 localStorage 恢复，分享模式默认 false）
  - loadList：请求追加 `&show_hidden=1`；新增 `renderListStats()`（统计行），错误时隐藏
  - 侧边栏开关绑定（change → 更新状态 + 持久化 + loadList(cur)）；/view 页守卫
  - listItem .nm / gridItem .grid-name 补 title（悬停全名）
- **server/templates/index.html**
  - 侧边栏新增「显示隐藏文件」form-switch（showHiddenToggle，新 id）
  - 列表上方新增 #listStats 统计行（新 id）+ .list-stats CSS

## 三、验证记录

- node --check ✅ / py_compile ✅ / CSS 括号平衡 0 ✅
- 8123 E2E（Playwright，真实 Windows 属性夹具）：
  - 默认：.hiddenfile.txt / ~temp.txt / ~$lock.docx / attrhidden.txt(HIDDEN) / .hidden-dir 全隐藏；attrsys.txt(SYSTEM) / attrsh.txt(HIDDEN+SYSTEM) 始终可见；统计行 共 4 项 · 1 个目录 · 3 个文件
  - 开启：9 项全显示，统计行 共 9 项 · 2 个目录 · 7 个文件；saved=1；刷新后仍显示（持久化）
  - 网格：9/9 卡片 title 完整
  - 分享模式：默认过滤 + 开关会话内注入可见（与主站同逻辑）
  - 0 pageerror
- 截图：t37_hidden_on_stats.png / t37_hidden_off_stats.png / t37_share_hidden_on.png

## 四、备注

- 测试夹具（Desktop\T37Test）已清理；8443 生产已按流程重启（server.py 改动）。
- HTML 仅新增 id（showHiddenToggle / listStats），既有 id 零改动。
- 与 feature-engineer 并行区域无重叠（本任务在列表/渲染/工具栏；其 t36 预览函数区、t38 视觉区）。
