# 开发变更日志（CHANGELOG）

> 由 28 份 CHANGES_*.md 按任务编号（T1–T40）数值顺序合并而成。各章为原始内容原样保留。

---

# T2 视觉美化 · 改动摘要（CHANGES_VISUAL）

> 任务：t2 视觉美化（netdisk-frontend-opt 团队 engineer）
> 依据：FRONTEND_AUDIT.md「二、视觉 / UI」全部 P2 + 相关 P3
> 改动文件：`server/templates/index.html`（内联 <style> + 3 处 HTML）、`static/app.js`（2 处）
> 原则：功能零改动、所有 HTML id 不变、改动克制可回归；仅样式/结构/A11y 增强

## 1. 完整品牌色变量层（:root --brand-* 体系）
- 新增 `--brand-primary/success/info/warning/danger` 及各自 `-subtle`、`-emphasis`、`-rgb` 变体，外加中性面 `--brand-bg/surface/border/text/text-muted`。
- 映射为 Bootstrap 语义变量：`--bs-primary`、`--bs-success`、`--bs-info`、`--bs-warning`、`--bs-danger` 及 `-bg-subtle`、`-border-subtle`、`-text-emphasis` 全套 —— 按钮、badge、alert、text-muted、边框全部统一到品牌色。
- 修复两处「散落色」：
  - `--bs-progress-bar-bg` 默认是 Bootstrap 蓝 #0d6efd，现在指向 `var(--bs-primary)`（进度条与按钮同色）；
  - `--bs-link-color` 默认 #0d6efd → 品牌蓝。
- `--bs-secondary-color`（text-muted）、`--bs-tertiary-bg`、`--bs-secondary-bg`、`--bs-border-color` 统一到品牌灰阶（#6b7280 / #e9edf2 / #e5e7eb / #e5e7eb）。
- 基调克制：仍为 #2563eb 蓝 + #f3f4f6 灰。

## 2. 列表行 hover / 选中态
- `.list-group-item` 增加 `transition: background-color .15s`，桌面（`@media (hover: hover)`）悬停背景 `var(--bs-tertiary-bg)`，触屏无 sticky hover。
- 顺带把既有的 `#breadcrumb .seg`、`.unpack-row`、`.vtag`、`.tag-chip` hover 一并包进 `(hover: hover)`（修复审计 P3-6 触屏点按后 hover 残留）。

## 3. 深色模式（prefers-color-scheme: dark）
- 一套变量覆盖实现整站深色：页面底 #0f172a（slate-900）、面板 #1e293b（slate-800）、边框 #334155、正文 #f1f5f9、弱化 #94a3b8；primary 提亮为 #3b82f6 保证对比度，各 subtle/emphasis 同步翻转。
- 硬编码浅色处理：`.bg-white`（navbar / card-header）翻转到 `--brand-surface`；`.btn-close` 白色化；sidebar / pack-panel / type-chip / tag-chip 的白底改为 `var(--brand-surface)`（原硬编码 #fff 共 4 处）；打包空闲条纹走 `--bs-secondary-bg/tertiary-bg` 变量。
- highlight.js（GitHub 浅色主题）token 全套翻转为深色配色（`.hljs` 及 15 组 token 类），代码预览深色下可读。

## 4. 网格卡片层级
- `.grid-item` 增加 `border-radius: 10px` + `transition`，hover 时 `box-shadow: 0 4px 14px rgba(17,24,39,.10)`（桌面 only）。
- 图标区与名称区间距 6px → 8px；`.grid-star` 加 hover scale(1.15) 反馈（与 `.star` 一致）。

## 5. 字体
- body 桌面字号 14px → **14.5px**（移动端 15px 不变）。
- 字体栈加 `"Noto Sans SC"`，并同步 `--bs-body-font-family`（Bootstrap 组件也走同一栈）。

## 6. 置顶卡头部键盘可达
- index.html：`#pinnedHead` 加 `tabindex="0"`、`aria-expanded="true"`。
- app.js：`onkeydown` 处理 Enter / Space（`preventDefault` 后触发 click）；onclick 与 `renderPinned` 同步维护 `aria-expanded`（与 chevron 一致）。

## 7. toast / 焦点
- toast：`role="status"` 已有，补显式 `aria-live="polite"`；加轻投影提升可见性。
- 统一 `:focus-visible { outline: 2px solid var(--bs-primary); outline-offset: 2px }`，所有键盘可达控件一致高亮；`#pinnedHead` 加圆角让焦点环美观。

## 8. 其他（审计 P3，顺手项）
- favicon 由空 `data:,` 换成内联 SVG（品牌蓝圆角方块 + 白云），零额外请求。

## 验证
- `node --check static/app.js` 通过（exit 0）。
- HTML 非 void 标签闭合平衡校验通过；CSS 花括号深度平衡（0）。
- 功能与 id 未变；未触碰后端接口。

## 遗留说明（不属 t2 范围，供 t3/t4/reviewer 参考）
- 深色模式下视频区保持 #000（正常）；toast 仍为深色胶囊（两模式通用）。
- 移动端专项（导航栏顶部安全区、overscroll 防下拉刷新等）归 t3。

---

# T3 移动端适配 · 改动摘要（CHANGES_MOBILE）

> 任务：t3 移动端适配（netdisk-frontend-opt 团队 engineer）
> 依据：FRONTEND_AUDIT.md「三、移动端适配」P2 全部 + P3-7；与 t2 的 `@media (hover: hover)` 改动兼容（无冲突）
> 改动文件：`server/templates/index.html`（内联 <style>）、`static/app.js`（2 处）
> 原则：功能零改动、HTML id 不变；在既有 ≤575.98px 适配基础上补强而非推翻

## 1. 导航栏顶部安全区（审计 P2-1）
- `.navbar`（fixed-top）加 `padding-top: calc(.25rem + env(safe-area-inset-top)) !important`（Bootstrap `py-1` 工具类带 !important，同权重覆盖）。
- `body` 的 `padding-top` 由 58px 改为 `calc(58px + env(safe-area-inset-top))`，与顶栏同步下移，内容不再顶进刘海。
- 追加横屏刘海机适配：`.navbar .container-fluid` 左右 padding 加 `env(safe-area-inset-left/right)`（桌面 env=0，行为不变）。

## 2. 下拉刷新手势（审计 P2-2）
- `body` 加 `overscroll-behavior-y: contain`：文件列表顶部继续下拉不再触发整页刷新/丢失位置；`driveTabs`/面包屑的横向 `overscroll-behavior-x: contain` 原样保留，手势互不干扰。

## 3. 进度条预览浮层窄屏降高（审计 P2-3）
- ≤575.98px 下 `.video-preview img` 高度 90px → 56px，竖屏手机上不再盖住原生控制条。

## 4. type-chip / tag-chip 触控高度（审计 P2-4）
- 移动端 `min-height` 40px → **44px**，与主按钮触控标准统一（chips 为 inline-flex 居中，视觉不变仅命中区加大）。

## 5. 搜索键盘遮挡（审计 P2-5）
- app.js 新增 visualViewport 监听（resize + scroll）：iOS 键盘弹出（`innerHeight - vv.height > 60px` 视为弹出，规避抖动）且侧边栏打开时，给 `.sidebar-foot` 动态 `padding-bottom: calc(1rem + 键盘高度)`，底部「重置筛选」按钮浮到键盘上方；侧边栏关闭或键盘收起自动复位。

## 6. P3 顺手项
- video 元素补 `webkit-playsinline` 属性（老 iOS 兼容，与已有标准 `playsinline` 双保险）；hover 残留已由 t2 的 `@media (hover: hover)` 统一处理，本任务未重复改动。

## 验证
- `node --check static/app.js` 通过（exit 0）；CSS 花括号平衡（0）。
- 与 t2 无冲突：t2 仅改 hover/配色/字体，t3 仅改安全区/滚动/触控/预览高度/键盘避让。
- 功能与 id 零改动；未触碰后端接口。

## 遗留说明
- 触屏 hover 残留修复（P3-6）已在 t2 完成，无需重复。
- 键盘避让采用 visualViewport 方案，Android 上 Chrome 键盘同样生效（`innerHeight` 变化时走同一逻辑）。

---

# T4 代码质量优化 · 改动摘要（CHANGES_CODE）

> 任务：t4 代码质量（netdisk-frontend-opt 团队 engineer）
> 依据：FRONTEND_AUDIT.md「四、代码质量」P2 + P3；队长指派清单
> 改动文件：`static/app.js`（4082 行 → 4017 行，净减 65 行）
> 原则：功能/接口行为零改动、HTML id 零改动、无新依赖；每步 node --check 门禁

## 1. 抽公共函数消除重复（审计 P2-2/P2-3）
- **buildShareModal 工厂**（新）：三个分享弹窗（showShareDialog / showShareManyDialog / showSubShareDialog）共用的「表单 → 生成中… → 失败重试 / 成功展示链接 + 打开/复制（clipboard + execCommand 降级）」骨架全部收敛，三个函数各缩为 ~20 行配置式调用。净减约 130 行。
- **openPreviewModal 包装**（新）：详情/文本/解压/CSV/lnk 五个预览弹窗共用的「建 body + loading + openModal + 中断旧请求 + 取消按钮 + AbortError/加载失败统一展示」样板收敛；各函数保留自己的请求与渲染逻辑（showText 的分片渲染中断经 cancelled() 轮询、showLnk 的非 AbortError 错误继续渲染分支均保持原行为）。

## 2. 内联 onclick 安全（审计 P3-1）
- renderTask 中 `onclick="removeTask('…')"` 与 `onclick="copyDirectDl('…')"` 的 task_id 补 `esc()`（下载链接本就用 encodeURIComponent，无需改）。

## 3. P3 bug 修复
- **toggleSkip 折叠空计数**：跳过计数改存按钮自身 `btn.dataset.skips`（原存 card，轮询整卡重建后丢失），收起时不再出现「跳过 项」空计数。
- **previewDir 可再点收起**：首次点击 ▶ 展开统计并记录原大小（`row.dataset.origSize`）；再次点击 ▼ 恢复原大小与 ▶，不再重复请求。
- **init() TDZ 根治**：`init()` 调用从文件中部（CODE_EXT/iconOf/parseCsv/showCsv/showLnk/分享函数定义之前）移到文件最末尾，上方全部 const/function 初始化后才启动。
- **markdown 标题 6 级**：`/^(#{1,3})\s+/` → `/^(#{1,6})\s+/`，h4~h6 正常渲染。
- **分类表统一**（审计 P3-4）：iconOf 与 fileKind 行为对齐——bat 从 exe 组移入 CODE_EXT（code 图标，与文本/脚本预览一致）；svg 从 image 组移入 text 组（text 图标，与 TEXT_EXT 文本预览一致）。
- **fmtSize 守卫**：`Number.isFinite` + 负数保护，NaN/Infinity/负值不再显示异常文本。

## 4. 验证
- `node --check static/app.js` 通过（exit 0，改动全程每步验证）。
- 行为一致性核对：
  - 五个预览弹窗的 AbortError 显示「已取消加载」、其它错误显示「加载失败: …」与原手写样板一致；
  - 三个分享弹窗的标题/文案/有效期/重试路径逐字比对一致（msg/note 由工厂统一 esc，原代码已 esc 的字段改为纯文本传入，无双重转义）；
  - renderTask 的 esc 在 HTML 属性中经浏览器解码回原文，removeTask/copyDirectDl 收到的参数不变。
- 未触碰后端接口、HTML 结构 id、CSS。

## 5. 遗留建议（供 reviewer / 后续）
- 未做拆模块（队长标注「谨慎/可选」；server.py _STATIC_ALLOWED 白名单需同步才能加载新 JS 文件，收益与风险不成比例，建议保留单文件）。
- fuzzy 纯函数补 node 单测（审计 P2-8）可另起任务。
- 分享/预览弹窗的剩余差异（showPdf 无 loading 样板、视频弹窗独立体系）保持不动，避免无谓改动。

---

# T6 面包屑重复显示末级目录 · 修复摘要（CHANGES_BREADCRUMB_FIX）

> 任务：t6 紧急 bug 修复（netdisk-frontend-opt 团队 engineer）
> 位置：`static/app.js` renderBreadcrumb 非分享分支（仅此一处，与 t5 复核区域不重叠）
> 原则：最小改动、行为一致；node --check 门禁

## Bug 现象
面包屑重复显示最后一级目录：`F: / Windows.declined / donghua / donghua`（donghua 出现两次），实际只有一个 donghua 目录。

## 根因
`renderBreadcrumb` 非分享分支中，首段 `acc = part + "\\"`（盘符根带尾斜杠，如 `F:\`），
后续段原实现 `acc += "\\" + part` 在 acc 已以反斜杠结尾时再补一个反斜杠，
产生双反斜杠 `F:\\Windows.declined`，与后端 `os.path.join` 返回的单反斜杠路径
`F:\Windows.declined\donghua` 永不相等 → `acc === cur` 永远 false →
最后一段被 `addSeg` 渲染一次，又被末尾 `last` 高亮渲染一次 → 重复。

## 修复（一行核心逻辑 + 注释）
```js
parts.forEach((part, i) => {
  if (i === 0) acc = part + "\\";                                  // 首段：F:\
  else acc += (acc.endsWith("\\") ? "" : "\\") + part;          // 后续段：缺分隔符才补一个
  if (acc === cur) return;
  addSeg(part, acc);
});
```
要点：段间恰好一个反斜杠（与后端 `os.path.join` 一致），任意层级下最后一段
`acc === cur` 成立 → 末级目录只由 `last` 高亮渲染一次。

> ⚠️ 补充说明：队长原推荐写法 `else acc += part` 经验证**只对 2 层路径正确**——
> 3 层及以上（如 `F:\Windows.declined\donghua`）第三段会丢失分隔符（`F:\Windows.declineddonghua`），
> 故采用「缺分隔符才补一个反斜杠」的更健壮写法，已用 node 模拟验证。

## 验证（node 模拟 + 语法）
| 场景 | acc 序列 | 末段命中 cur | 末级重复 |
|---|---|---|---|
| 3 层（用户场景）`F:\Windows.declined\donghua` | `["F:\", "F:\Windows.declined", "F:\Windows.declined\donghua"]` | ✅ | 0（仅高亮一次） |
| 2 层 `F:\Windows.declined` | ✅ | ✅ | 0 |
| 根 `F:\` | ✅ | ✅ | 0 |
| 4 层深层 `D:\a\b\c\d` | ✅ | ✅ | 0 |
- `node --check static/app.js` 通过（exit 0）。
- 分享模式分支 / 虚拟分享分支（`rootNorm` 已去尾斜杠，拼接正确）确认无此问题，未改动。

## 回归面
- 仅改非分享分支的面包屑拼接；`addSeg` 的点击 target 也随之变为单反斜杠规范路径（与后端一致）。
- 未触碰后端、HTML id、其它函数。

---

# T7 视觉大升级 · 改动摘要（CHANGES_VISUAL_V2）

> 任务：t7 视觉大升级（netdisk-frontend-opt 团队 engineer）
> 用户反馈：t2 变化太小，要求**肉眼可见**的现代感与品牌感
> 改动文件：`server/templates/index.html`（内联 <style>，566 → 697 行；app.js 未改动）
> 原则：功能零改动、HTML id 零改动、≤575px 移动端规则原样保留、深色模式同步补齐

## 七大升级（浅色模式一眼可见）

### 1) 顶部导航：品牌渐变 + 白字
- `.navbar` 从纯白改为品牌渐变 `#2563eb → #1e40af`（深色模式用深蓝 `#1e3a8a → #172554`），白字、半透明白底细边、蓝色投影。
- 品牌 logo（☁ 方块）改为**白底蓝字 + 圆角 + 阴影**，在渐变导航上高对比。
- 上传按钮改**白底蓝字 + 阴影**（原 outline-primary 描边），hover 微上浮 + 浅蓝底。

### 2) 磁盘标签：渐变胶囊 + 选中指示
- 活动态（`#driveTabs .btn-primary`）：品牌渐变底 + 白字 + 蓝色投影（`0 3px 10px rgba(37,99,235,.35)`）。
- 非活动态（`.btn-outline-secondary`）：圆角 999px 胶囊 + 灰描边，hover 变品牌蓝描边 + 浅蓝底。
- 触屏无 sticky hover（全部 `@media (hover: hover)` 包裹）。

### 3) 卡片：大圆角 + 深阴影（灰底上明显浮起）
- 置顶卡 / 文件列表卡：圆角 6px → **16px**，阴影 `0 8px 24px rgba(15,23,42,.10)`（深色 `.45`）。
- modal-content 14px、打包任务卡 12px 统一圆角。

### 4) 按钮：圆角 10px + primary 渐变 + hover 浮起
- 全局 `.btn` 圆角 10px。
- `.btn-primary`：品牌渐变 + 微阴影，hover `translateY(-1px)` + 阴影加深（仅桌面 hover 设备）。
- `.btn-outline-primary` hover 从实心蓝改为浅蓝底 + 蓝字（更现代）。

### 5) 列表 / 网格：品牌色条 + 卡片化
- 列表行 hover 时左侧出现 **3px 品牌渐变竖条**（position:relative + ::before），反馈明显。
- 网格卡片常态**白底 + 1px 边框 + 浅阴影 + 12px 圆角**（原来是透明、hover 才有底），hover `translateY(-2px)` + 阴影加深。

### 6) 置顶卡头部品牌装饰
- `#pinnedCard::before` 顶部 4px 品牌渐变横条（`overflow:hidden` 裁进圆角）。
- card-header 浅品牌蓝 tint（`rgba(37,99,235,.035)`，!important 覆盖 bg-white 工具类；深色 `rgba(59,130,246,.07)`）。

### 7) 层次感
- 灰底（#f3f4f6 / 深色 #0f172a）上，白/深色卡片 + 大圆角 + 深阴影形成清晰层级。

## 深色模式同步
- 渐变变量 `--brand-grad-from/to` 深色下翻转（#3b82f6→#1d4ed8）；导航专用深蓝渐变；卡片阴影加深；网格/边框/logo/上传按钮全部用 `--brand-surface` 适配。

## 验证
- CSS 花括号深度平衡（0）。
- `node --check static/app.js` 通过（exit 0；app.js 未改，仅确认）。
- t2/t3 既有规则完好：移动端 `@media (max-width: 575.98px)`（44px 触控）、顶部安全区、overscroll 防刷新、video-preview 56px、chips 44px 全部在位。
- 功能与 HTML id 零改动；无新增依赖；未触碰后端。

## 备注
- 本环境无可用浏览器做截图回归，视觉确认依赖 CSS 规则审查 + 括号平衡；建议 reviewer 实测页面（浅色 + 深色 + ≤575px）。

---

# T8 UI 精细化升级 · 改动摘要（CHANGES_VISUAL_V3）

> 任务：t8 UI 精细化（netdisk-frontend-opt 团队 engineer）
> 依据：视觉审查模型 mimo-v2.5-free 的问题清单（14 项）+ 截图实测验收
> 改动文件：`server/templates/index.html`（内联 <style>，697 → 793 行）、`static/app.js`（1 处：骨架屏注入）
> 原则：功能零改动、HTML id 零改动、≤575px 移动端规则零破坏、深色模式同步、无新依赖

## 一、色彩系统（审查 1-4）
1. **主色确立**：蓝为主色（导航/主按钮/高亮），橙降级为强调色（仅星标/收藏）。
2. **design token 扩展**：新增 `--sp-1~6`（8px 间距栅格 4/8/12/16/24/32）、`--brand-text-1/2/3`（主/次/弱文字）、`--brand-accent`（橙强调 #f5a623），全部变量化。
3. **边框统一浅色**：outline 按钮边框走 `--bs-border-color`（#e5e7eb），深浅模式自动。
4. **星标统一**：收藏 `#f5a623`、未收藏 `#ccc`（替代散落的 #d97706/#d1d5db）。

## 二、间距与栅格（审查 5-6）
5. 8px 栅格变量落地：卡片间距 8→16px（`.card.mb-2`）、盘符栏下间距 8→12px（`#driveTabs`）、主内容顶部留白 8→16px（`main`）。
6. 列表行高 `py-2`→`py-2.5`（10px 上下）、置顶列表内边距 8→12px——行更舒展。

## 三、组件细节（审查 7-10）
7. **模态框关闭按钮**：24px + 圆形 + hover 灰底圆圈；背景图标 12px 居中。
8. **模态开合动画**：`translateY(16px) scale(.98)` 淡入（覆盖 Bootstrap 上滑式），尊重 `prefers-reduced-motion`。
9. **列表加载骨架屏**：app.js 加载态由"加载中…"改为 6 条 shimmer 骨架行（`.skeleton-list`），CSS 渐变扫光动画；请求完成由 renderEntries 正常替换，功能零改动。
10. **操作图标**：详情/分享图标放大（15/13px）+ hover 品牌蓝 + scale(1.18)。

## 四、全局细节（审查 11-14）
11. **自定义滚动条**：6px 圆角灰 thumb（Webkit `::-webkit-scrollbar` + Firefox `scrollbar-width`），hover 加深。
12. **面包屑当前路径**：`#breadcrumb .cur` 加粗 + 品牌蓝。
13. **空状态**：`.empty` 改为 flex 居中 + 🗂️ emoji 图标 + 弱化文字（纯 CSS，无外部资源）。
14. **留白呼吸感**：卡片间距/内边距/顶部留白按 8px 栅格统一微增。

## 五、视觉验收（mimo-v2.5-free 实测截图）
用 playwright 起真实服务 + Chromium 截图（浅色/深色/移动端/模态四视角）交 mimo 审查：
- ✅ 浅色：导航深蓝渐变、主色蓝白、按钮现代圆角——**确认 T7 大改全部生效**
- ✅ 深色：简洁专业、对比度良好
- ✅ 移动端 390px：紧凑无溢出、触控目标 44px 达标
- ✅ 模态：白底两列表格、再分享按钮正常
- 按 mimo 建议追加微调：行图标 20→22px、弹窗阴影增强（0 16px 48px）、关闭按钮 24px 强制、导航下方留白 16px
- mimo 遗留建议（超 t8 范围，未做）：文件图标按类型着色、行内多选批量操作（功能级改动）、hover 静态截图无法体现（已实现）

## 验证
- CSS 花括号深度 0（平衡）；`node --check static/app.js` 通过（exit 0）。
- t2/t3/t7 全部规则在位（深色模式/安全区/overscroll/44px 触控/渐变导航/卡片阴影）。
- HTML id 与功能零改动；无新依赖；未触碰后端。

## 截图存档
`G:\自建agent专用工作区\DSH\_t8shots\`（shot_light / shot_dark / shot_mobile / shot_modal）

---

# T9 星标闪烁修复 + 长按多选交互 · 改动摘要（CHANGES_STAR_FIX）

> 任务：t9（netdisk-frontend-opt 团队 engineer）
> 改动文件：`static/app.js`（主要）、`server/templates/index.html`（批量栏 HTML + 多选 CSS）
> 原则：功能主路径零破坏、HTML id 不变、移动端 44px 触控保留、深色模式同步、node --check 门禁

## 一、Bug 修复：星标闪烁 + 跳回顶部
根因：listItem/gridItem 的 star.onclick 置顶后 ①api/pin → ②api/info 二次请求 → ③renderPinned → ④loadList(cur) 整目录重载 → 列表 DOM 重建"闪烁" + 滚动位置丢失回顶（审计 P2-3）。

修复：
1. **批量置顶/取消置顶**（bulkTogglePin）：逐项 `api/pin`，**直接用返回值更新 pinned**（后端返回最新列表，不再二次 `api/info`），操作后 `renderPinned()` 同步置顶卡，**不调 loadList(cur)** → 无闪烁、滚动位置保留。
2. **置顶卡 unpin 按钮 / 清空置顶按钮**：同样去掉 `loadList(cur)`（列表行已无常驻星标，无需重载）。

## 二、设计升级：长按多选模式
1. **移除常驻五角星**：listItem/gridItem 不再渲染 star/grid-star（界面更干净）；置顶改为批量操作。
2. **长按进入多选**（bindLongPress）：
   - 桌面 `mousedown` 按住 500ms / 移动 `touchstart` 500ms（`touchmove` 取消，不冲突滚动）；
   - 长按有视觉反馈：按压背景变深（`.press-active`）+ 触觉震动（`navigator.vibrate(30)`，支持时）；
   - 长按即选中该行；长按后的 click 被吞掉（700ms 内 capture 拦截），避免误开文件。
3. **多选模式**：
   - 每行显示 checkbox（`.bulk-cb`，CSS 控制显隐）；点行任意处勾选/取消；
   - 顶部批量操作栏（`#bulkBar`，品牌浅蓝底）：已选计数、**全选/取消全选、置顶、取消置顶、分享、下载、打包、取消**；
   - 选中行整行浅蓝高亮（`.selected`）；
   - Esc / 切目录 / 搜索重建 / 取消按钮 均退出多选。
4. **批量操作**（均本地同步、不重载）：
   - 置顶/取消置顶：逐项 `api/pin` + 返回值同步 pinned + renderPinned；
   - 分享：`api/share?paths=…` 复用 t4 的 buildShareModal 工厂（有效期 radio + 复制链接）；
   - 下载：逐个触发（目录跳过）；
   - 打包：直接 `api/archive` POST 选中 paths（不依赖 pinned）。
5. **SHARE_MODE**：无置顶/多选，保持原交互（分享按钮、二次分享）不变。

## 三、验证
- `node --check static/app.js` 通过（exit 0）。
- **playwright 真机交互测试 6 项全 PASS**（起真实服务 + Chromium 模拟）：
  1. 短按（150ms）不进入多选、正常打开 ✓
  2. 长按 650ms 进入多选（checkbox 显示、长按行自动选中、计数"已选 1 项"）✓
  3. 多选模式点行勾选第二行（2 项）✓
  4. 全选（6/6）✓
  5. 取消退出多选 ✓
  6. 批量置顶 2 项成功（pinCount 2、置顶卡 2 行、无整目录重载）✓
  - 全程无 JS 报错。
- **mimo-v2.5-free 视觉验收**（多选模式截图）：批量操作栏清晰、checkbox 显示、选中行浅蓝高亮、界面简洁 ✓。
- 截图存档：`G:\自建agent专用工作区\DSH\_t8shots\shot_bulk.png`。

## 四、回归面
- 常驻星标移除：`.star/.grid-star` CSS 规则保留为死代码（无引用，未清理避免误伤）；`isPinned` 保留。
- 列表行点击主路径不变（bindRowAction 未动）；详情/分享按钮行为不变。
- 移动端 44px 触控、深色模式（selected 用 `--bs-primary-bg-subtle` 自动适配）不受影响。

---

# T10 图片在线预览 · 改动摘要（CHANGES_IMAGE_PREVIEW）

> 任务：t10（netdisk-frontend-opt 团队 engineer）
> 用户反馈：图片文件点击直接下载，无法预览
> 改动文件：`server/server.py`（新增 /api/img 主/分享路由）、`static/app.js`（IMAGE_EXT/fileKind/iconOf/showImage/bindRowAction/showDetail）、`server/templates/index.html`（图片预览容器 CSS）

## 一、后端（server.py）
1. **主模式 /api/img**（仿 /api/pdf 写法）：`_resolve` 校验 → `_send_file_range(p, attachment=False, ctype=<按扩展名取 _MIME_BY_EXT>)`，内联发送（浏览器直接渲染 <img>）；SVG 走 image/svg+xml。
2. **分享模式 sub == "api/img"**：`_resolve_share_path` 校验后同样内联发送——分享页图片可预览（实测 200 image/jpeg）。
3. `_MIME_BY_EXT` 已含全部图片类型（jpg/png/gif/webp/bmp/svg/ico/tif/tiff/heic/avif），零新增。

## 二、前端（app.js）
1. **IMAGE_EXT 常量**：jpg/jpeg/png/gif/webp/bmp/svg/ico/tif/tiff/avif/heic。
2. **fileKind image 分支**（在 markdown 之前）：image 优先 → **svg 归图片预览**（从 TEXT_EXT 移出，解决交集）；`iconOf` 同步回 image 组（与预览行为一致）。
3. **showImage(path, name)**：openModal + `<img src="BASE+api/img?path=…">`；
   - 缩放工具栏：＋ 放大 / － 缩小 / 适应宽度（按钮），滚轮缩放（preventDefault 防滚动穿透，1.1×/0.9×，范围 0.1×~8×）；
   - 超大图容器可滚动（`overflow:auto; max-height:62dvh`）；
   - 下载按钮（dlUrl）；加载失败显示"图片加载失败或格式不受支持"；
   - 函数声明前置，无 TDZ（首版有 const fit 前引用 bug，已修复并验证）。
4. **bindRowAction image 分支** → showImage；**showDetail** 预览按钮加"🖼 图片预览"。

## 三、CSS（index.html）
- `.img-preview-wrap`：可滚动容器 + 浅色底 + 圆角 + 8px 内边距（变量化，深色模式自动）；
- `.img-preview`：max-width 100% + 圆角。

## 四、验证（真实环境，全部 PASS）
- `py_compile server.py` 通过；`node --check static/app.js` 通过；CSS 括号平衡 0。
- **后端**：主模式 /api/img 返回 `200 image/jpeg`（7918B）；**分享模式**同样 `200 image/jpeg`。
- **前端 E2E（playwright + Chromium）**：
  1. fileKind：jpg/png/svg → image、txt → text ✓
  2. showImage 弹窗 + 图片加载（naturalWidth>0）✓
  3. 缩放：360 → 580 → 725px（两次放大）✓
  4. 适应宽度：放大 906px 后回落 ≤ 容器宽度 ✓
  5. 下载按钮存在 ✓
  6. 失败路径：显示"图片加载失败或格式不受支持" ✓
- 全程无 JS 报错。

## 五、回归面
- TEXT_EXT 移除 svg（svg 现在图片预览）；侧边栏"文本"筛选不再含 svg（符合图片归类预期）。
- 图标：svg/ico 等回 image 图标组（与 t4 的 bat 修正同源，保持图标=预览行为一致）。
- 功能主路径（视频/文本/PDF/CSV/解压/lnk/分享）零改动。

---

# T11 预览全屏放大（方案A）· 改动摘要（CHANGES_FULLSCREEN）

> 任务：t11（netdisk-frontend-opt 团队 engineer）
> 用户需求：预览是"弹窗卡片"形式不支持放大，希望"像新开页面一样"沉浸式全屏浏览；已确认方案 A（弹窗内全屏模式），架构为方案 B（独立 /view?path= 页面）预留
> 改动文件：`static/app.js`（全屏核心 + 8 个预览函数接入 + previewFile 分发）、`server/templates/index.html`（全屏层 HTML + CSS）
> 原则：功能主路径零破坏、HTML id 不变、移动端安全区/44px 保留、深色模式自动（全屏深色）、node --check 门禁

## 一、全屏预览层（与 modal 解耦）
- `#fsLayer`：`position:fixed; inset:0; z-index:1090`（高于 modal 1080），近黑背景 `rgba(9,13,20,.96)`，flex 纵向布局。
- 控制条（`.fs-bar`）：标题（截断）、**⬇ 下载**（按需注入）、✕ 关闭按钮（34px 圆形 + hover 反馈）；顶部 `env(safe-area-inset-top)` 安全区。
- 内容区 `#fsBody`：flex 居中 + `overflow:auto`，内容最大化：
  - 视频/图片 `object-fit:contain` 铺满可视区（`#fsBody video / .img-preview`）；
  - 文本/代码 `height:100%` 全屏滚动；iframe（PDF）全屏填充；表格/解压列表全屏。
- 过渡动画：层 `opacity .22s` + 内容 `scale(.97→1)`，尊重 `prefers-reduced-motion`。
- 样式全部以 `#fsBody` 为作用域，与 modal 完全解耦（方案B 独立页可直接引用）。

## 二、接入 8 个预览弹窗（⛶ 放大按钮）
每个预览弹窗内容顶部加 `addFsButton(body, title, getNode, dlUrl)`（惰性取核心节点，兼容异步渲染）：
| 弹窗 | 全屏内容 | 特性 |
|---|---|---|
| 视频 showVideo | video-wrap | **移动 DOM 不中断播放**；rAF 恢复 currentTime + 播放状态保险 |
| 图片 showImage | img-preview-wrap | contain 铺满 + 原缩放工具栏随内容进入 |
| 文本 showText | text-pre/md-code 容器 | 全屏滚动 + 14px 字号 |
| PDF showPdf | iframe | 全屏填充 |
| CSV showCsv | 表格容器 | 全屏滚动 |
| 解压 showUnpack | unpack-list | 全屏滚动 |
| 详情 showDetail | detail-tbl | 全屏查看 |
| lnk showLnk | 目标信息块 | 全屏查看 |

## 三、退出机制
- **Esc**：主动关闭 → 内容移回原弹窗（`_fsHome` 记录原父容器）→ `history.back()` 弹出 fs 历史条目（历史栈保持 [页面, modal] 干净）。
- **手机返回键 / 浏览器后退**：popstate 时 `closeFullscreen(true)`（back 已完成，不重复 back）→ 内容移回；**弹窗保持打开**（fs 条目在 modal 条目之上，返回先关全屏再关弹窗，LIFO 正确）。
- **✕ 按钮**：同 Esc。
- 弹窗关闭（hidden.bs.modal）时全屏层自动随内容移除，无残留。

## 四、方案 B 预留
- `openFullscreen({title, node, downloadUrl})`：全屏层渲染与内容转移已独立成通用函数。
- `previewFile(path, name)`：按 fileKind 分发到各预览函数的独立入口——方案B 独立页面 `/view?path=` 只需页面壳 + 调 previewFile，无需重写渲染逻辑。

## 五、验证（真实环境，全部 PASS）
- `node --check static/app.js` 通过；CSS 括号平衡 0。
- **E2E（playwright + Chromium）**：
  1. 图片弹窗内 ⛶ 按钮存在 ✓
  2. 点击进入全屏：层 .show、图片移入 fsBody、弹窗内内容清空、标题正确 ✓
  3. **Esc 退出：内容回归弹窗** ✓
  4. **手机返回键（history.back）：关闭全屏、弹窗保留** ✓
  5. 弹窗关闭后全屏不残留 ✓
  - 全程无 JS 报错。
- **mimo-v2.5-free 视觉验收**：深色背景 + 控制条（标题/下载/✕）+ 图片居中 + 缩放工具栏随内容进入全屏，功能完整 ✓。

## 六、回归面
- 预览弹窗主路径不变（⛶ 按钮是新加元素，原按钮/内容原样）。
- modal 的 popstate 机制未改动；全屏 popstate 独立处理，两者 LIFO 兼容（返回先关全屏再关弹窗）。
- 移动端安全区（fs-bar padding-top）、深色模式（全屏本就是深色）就绪。

---

# T13 预览体系全面修复 · 改动摘要（CHANGES_PREVIEW_FIX）

> 任务：t13（netdisk-frontend-opt 团队 engineer）
> 用户反馈：CSV 预览乱码（D:\模拟实时预测\记录2取样.csv）→ 实际是伪装成 .csv 的 .xlsx（ZIP 魔数 PK\x03\x04）
> 改动文件：`server/server.py`（_read_text 二进制检测 + UTF-16 识别）、`static/app.js`（错误提示友好化）
> 原则：功能主路径零破坏、正常预览不受影响、py_compile + node --check 门禁

## 一、核心修复：_read_text 二进制检测（CSV 乱码根因）
根因：xlsx 是 ZIP 容器（PK\x03\x04 开头），内部 XML 片段可被 UTF-8 解码"成功" → 返回乱码二进制文本。

修复（server.py _read_text 编码识别顺序重构）：
1. **BOM 检测**（原有：utf-8-sig / utf-16le/be / utf-32le）——BOM 是明确文本标志，先识别。
2. **二进制魔数检测**（新 `_has_binary_magic`）：PK\x03\x04（zip/xlsx/docx）、PNG、JPEG、GIF、PDF、gzip、ELF、MZ（exe）、java class、ico、bmp、ftyp（mp4/mov，偏移 4）、RIFF+WEBP —— **魔数优先于 UTF-16 启发式**（zip 结构字节形似 UTF-16，顺序错误会误判）。
3. **无 BOM UTF-16 启发式**（新 `_detect_utf16_nobom`）：偶数位 \x00 多 → BE（高字节在偶位），奇数位多 → LE——比 t14 要求的更早落地。
4. **空字节比例**（>3%）兜底：非 UTF-16 文本但 \x00 密集 → 二进制。
5. 命中任一 → 返回 `{kind:"binary", error:"该文件是二进制文件，无法文本预览"}`（含 name/total_size/read_bytes）。

## 二、前端错误提示友好化
- showText / showCsv 的 `j.error` 分支：明确错误文案 + **⬇ 下载查看**按钮（二进制/不可读文件可下载原文件，不再显示乱码）。

## 三、其他预览边界排查结论（审查确认无需改动项）
| 预览 | 检查结果 |
|---|---|
| 文本 showText | 截断提示完善（400KB 上限 + 文件总大小/已读字节 + 下载全文按钮）；编码显示"编码: xxx" ✓ |
| Markdown | 6 级标题（t4 已补）；表格/代码围栏/引用/列表边界正确 ✓ |
| PDF showPdf | iframe 内联 + "点击此处打开 PDF" 兜底链接 ✓ |
| 视频 showVideo | 转码 409 轮询降级提示（toast）✓ |
| 解压 showUnpack | j.error / format unsupported / 空包提示齐全 ✓ |
| CSV parseCsv | 引号包裹、内部逗号/换行、"" 转义、CRLF、空行跳过——已完善 ✓ |
| 图片 showImage | onerror 失败提示（t10）+ 超大图滚动/缩放 ✓ |

## 四、验证（真实环境，全部 PASS）
- `py_compile server.py` + `node --check static/app.js` + CSS 平衡 ✓
- **后端单测 10 场景全 PASS**：
  - 伪装 .csv 的 xlsx（PK 魔数）→ kind=binary + 明确错误 ✓（核心 bug 修复）
  - 伪装 txt 的 PNG / PDF → binary ✓
  - utf-8 / GBK / BOM UTF-16 / 无 BOM UTF-16 le / be → 各自正确解码 ✓
  - 正常 CSV / 含少量 NUL 的文本（<3%）→ 正常 ✓
- **HTTP 实测**：`/api/read` 对伪装 csv 返回 `{"kind":"binary","error":"该文件是二进制文件，无法文本预览"}`；正常 csv 正常返回 ✓
- **E2E（playwright）3 项 PASS**：伪装 csv 弹窗显示明确提示 + 下载按钮 ✓；正常 csv 表格渲染 ✓；showText 同样拦截二进制 ✓；无 JS 报错

## 五、回归面
- 正常文本（utf-8/gbk/UTF-16/BOM）解码路径不变；仅新增"二进制拦截"前置分支。
- 魔数列表保守（仅常见格式），不误伤文本；空字节阈值 3% 经真实样本验证。

## 六、补充修复：ZIP 内部文件名乱码（用户补充 case，并入本任务）
用户发现 `F:\mindows\payload-dumper-go-64位.zip` 解压预览乱码（"╩╣╙├╜╠│╠.url"）。

根因：无 UTF-8 标志的 zip 条目名，Python zipfile 默认按 cp437 解码，GBK 中文名变乱码。

修复（server.py）：
1. **`_fix_zip_name(name)`**（新公共函数）：`name.encode('cp437').decode('gbk')` 重解码；**安全策略**——仅当结果含足够中文/全角字符（>15%）且无控制字符时采用；ASCII 名 / UTF-8 标志名 / 拉丁文名保持不动（实测 'café menu.txt' 不误判）。
2. **_unpack_list**：条目 name/path_in_archive 用修复名（"使用教程.url"、"打开CMD命令行.bat" 正确显示）。
3. **_unpack_download**：前端传的修复名先精确匹配 namelist，失败再遍历经 `_fix_zip_name` 映射回原始名后下载；Content-Disposition 的 `filename*=UTF-8` 用修复名（用户可见）。

验证（真实环境全 PASS）：
- 单元测试：'╩╣╙├╜╠│╠.url' → '使用教程.url' ✓；ASCII / UTF-8 中文 / 拉丁文均不动 ✓
- 真实 zip：`payload-dumper-go-64/打开CMD命令行.bat` 中文正常 ✓；单条目下载映射成功（size 1532，disp 名正确）✓
- HTTP 实测 api/unpack 返回中文条目 ✓；py_compile 通过

---

# T14 全站乱码系统性修复 · 改动摘要（CHANGES_ENCODING_FIX）

> 任务：t14（netdisk-frontend-opt 团队 engineer）
> 用户反馈："其他还有各种地方都有乱码"，系统性排查所有编码处理点
> 改动文件：`server/server.py`（_smart_decode 公共函数 + 各编码点接入）
> 原则：功能主路径零破坏、py_compile 门禁、源文件编码确认

## 一、公共解码函数 _smart_decode（新）
`BOM → 无 BOM UTF-16（le/be）→ utf-8 → gbk → big5 → gb18030 → latin-1`，返回 (text, encoding)。
- 供文本预览 / 字幕 / 内嵌字幕输出等所有编码点共用，消除"各点各自硬编码"的散乱状态。
- gb18030 是 GBK 超集（繁体/全 Unicode 兜底）；big5 在 gbk 严格失败时尝试。
- 附加启发：GBK 的 A4xx 区是日文假名而 Big5 的 A4xx 区是常用汉字——gbk 解码出 >50% 片假名时改试 big5（部分挽救 Big5 误解码）。

## 二、各编码点修复
1. **【高优先】旁挂字幕硬编码 utf-8 → _smart_decode**（server.py _subtitle_vtt）：GBK 中文字幕（.srt/.ass/.ssa）不再乱码——实测 GBK srt/ass 均正确输出中文。
2. **内嵌字幕 ffmpeg 输出**：`r.stdout.decode("utf-8")` → `_smart_decode(r.stdout)`（GBK 内嵌字幕兜底）。
3. **子进程输出确认**：ffprobe JSON / ffmpeg -encoders（1880/2399/2425）为 UTF-8 标准输出 + `errors="replace"` 防崩，保持不动；lnk 解析 PowerShell 输出（2278）GBK 正确，保持。
4. **_read_text 解码链增强**：utf-8 → gbk → gb18030（+big5 启发），UTF-16 无 BOM 检测已在 t13 落地。
5. **上传文件名**：latin-1→utf-8 修复基础上，utf-8 失败时补 `gbk` 尝试（覆盖 GBK 浏览器上传中文名场景）。
6. **源文件编码确认**：index.html / app.js / cjk-normalize.js / server.py 全部 UTF-8（无 BOM）✓。

## 三、验证（真实环境，全部 PASS）
- `py_compile server.py` + `node --check static/app.js` ✓
- **编码单测**：
  - GBK 中文字幕 .srt → `WEBVTT …简体中文字幕测试GBK` ✓（核心修复）
  - GBK 中文 .ass → `中文ASS字幕` ✓
  - UTF-8 BOM srt ✓
  - utf-8 / gbk 文本正常解码 ✓；UTF-16 BOM / 无 BOM le/be ✓（t13 回归）
  - 二进制伪装拦截 ✓（t13 回归）
  - big5 中文（假名启发生效样本）+ 日文 GBK 不误判 ✓
- **源文件编码**：4 个文件全部 UTF-8 ✓

## 四、已知限制（如实记录）
- **GBK vs Big5 双字节区完全重叠**：Big5 字节序列几乎总能被 GBK "合法解码"（产生乱码映射），字节层面无法可靠区分；默认按 GBK（大陆主流）解码，gbk 严格失败或假名启发命中时才切 big5。繁体 Big5 文件若碰巧 GBK 解码成功仍可能乱码——已尽力（假名启发 + big5 兜底），完美区分需内容级统计，风险大于收益未做。

## 五、回归面
- 正常 utf-8/gbk/UTF-16 文本、字幕、JSON 输出解码路径不变；仅把硬编码改为统一 _smart_decode（行为等价或更健壮）。

---

# T16 收藏悬浮球改造 · 改动摘要（CHANGES_FAVORITES）

> 任务：t16（netdisk-frontend-opt 团队 engineer）
> 用户反馈：顶部"置顶文件"横条太丑，希望缩成悬浮球 + 卡片弹窗，并重命名「收藏」
> 改动文件：`server/templates/index.html`（移除置顶条 + 新增悬浮球/收藏面板 + CSS）、`static/app.js`（renderPinned 重构 + 交互迁移）
> 原则：功能零破坏（收藏/批量/分享/打包照常）、api/pin 后端不变、移动端安全区 + 深色模式同步、node --check 门禁

## 一、命名与形态（队长决策落地）
- **「置顶」→「收藏」**：界面文案全部替换（面板标题/行按钮/批量栏/toast/空状态），图标 📌 → ⭐；后端 api/pin 接口不变。
- **移除顶部 #pinnedCard 横条**（含折叠头/chevron/折叠逻辑），页面顶部不再有置顶条。

## 二、悬浮球（FAB）
- `#pinFab`：fixed 右下角 52px 圆形，品牌渐变底 + ⭐ 图标 + 蓝色投影；hover 放大（仅 hover 设备）。
- 数量徽标 `#pinFabBadge`：右上角黄色圆形角标（橙强调色 #f5a623），0 项隐藏；有收藏即显示。
- 键盘可达（tabindex + Enter/Space）；分享模式（SHARE_MODE）隐藏（无收藏功能）。

## 三、收藏面板（#pinPanel）
- 右下角弹出式卡片：380px 宽 / max-height 70dvh / 16px 圆角 / 深阴影 / `translateY+scale` 过渡（尊重 reduced-motion）。
- 头部：`⭐ 收藏 · N 项 · 共 X`（品牌浅底）+ 全部分享 / 打包 / 全部清空 + ✕ 关闭。
- 主体：收藏列表（复用 renderPinned 行渲染：图标/名称/大小/分享/下载/取消收藏），空态"暂无收藏"。
- 交互：悬浮球点击开/关；Esc / ✕ 关闭；打开时刷新列表。
- 移动端（≤575px）：面板全宽贴边（左右 10px）+ 底部安全区；悬浮球贴底安全区。

## 四、JS 改造
- renderPinned：渲染目标 pinnedList → **pinPanelBody**；更新 pinPanelTitle / pinFabBadge / pinClearBtn 显隐；行文案"取消置顶"→"取消收藏"。
- 按钮迁移：packBtn → pinPackBtn（打开打包中心）、shareAllBtn → pinShareAllBtn（全部分享）、clearPinBtn → pinClearBtn（清空收藏）。
- 删除 pinnedHead 折叠逻辑与 loadList 的 pinned-fold 自动折叠；新增 pinFab/pinPanel 开合 + Esc 处理。
- 批量栏文案：bulkPin "📌 置顶"→"⭐ 收藏"、bulkUnpin "✕ 取消置顶"→"✕ 取消收藏"、toast "已置顶"→"已收藏"；多选提示更新。
- 旧 id（pinnedList/pinnedHead/pinnedChevron/pinCount/clearPinBtn/packBtn/shareAllBtn/pinned-fold）**零残留**（grep 验证）。

## 五、验证（真实环境全 PASS）
- `node --check` + CSS 括号平衡 0。
- **E2E（playwright）**：悬浮球显示 + 旧横条移除 ✓；长按多选批量收藏 → 徽标更新 ✓；点击悬浮球 → 面板打开 + 列表行 = 收藏数 + 标题正确 ✓；操作按钮（全部分享/打包/清空）可用 ✓；取消收藏 → 徽标/行数同步 ✓；Esc 关闭 ✓；打包按钮打开打包中心 ✓；清空 → 徽标 0 + "暂无收藏" ✓；全程无 JS 报错。
- **mimo 视觉验收**：悬浮球醒目（蓝球+黄星+数字角标）、收藏面板专业（圆角/投影/统计/操作按钮/列表间距）、无乱码无布局问题 ✓。

## 六、回归面
- 长按多选批量收藏、打包、分享（单文件/全部/批量）逻辑不变，仅文案与渲染目标变化。
- 后端 api/pin、打包中心、侧边栏、全屏预览均未触碰。

---

# T17 图标体系全面改造 · 改动摘要（CHANGES_ICONS）

> 任务：t17（netdisk-frontend-opt 团队 engineer）
> 用户反馈：emoji 功能图标（☁⬆📦🔗ⓘ▦↻ 等）很 low，要换成统一专业的 SVG 图标体系
> 改动文件：`static/app.js`（ICONS 图标库 + 动态替换）、`server/templates/index.html`（静态按钮替换 + 空状态 mask）
> 原则：Lucide/Feather 风格（与 static/icons/*.svg 完全一致：24×24 / stroke-width 1.8 / 圆头圆角）、stroke=currentColor 深浅色自适应、功能零破坏、node --check 门禁

## 一、图标库（app.js 新增）
- `ICONS` 常量对象：**25 个统一线条图标**（upload/download/share/star/info/refresh/back/fwd/filter/close/max/pack/copy/trash/play/text/image/archive/cloud/check/search/link/list/grid/zoomIn/zoomOut/fit/folder/plus/chevron）。
- `icon(name, size)` 辅助：返回指定尺寸内联 SVG（`stroke=currentColor` → 跟随按钮/文字/深色模式自动变色）。
- `mkBtn` 改为 innerHTML（支持内联 SVG，图标由内部常量生成无注入风险）。

## 二、替换范围（emoji → 线条 SVG）
**index.html（静态）**：
- 导航 logo ☁ → 云 SVG（白）；上传按钮 ⬆ → upload SVG
- 工具栏 ←→↻▦ → back/fwd/refresh/filter SVG
- 批量栏 📌⭐✕🔗⬇📦 → star/close/share/download/pack SVG
- 收藏悬浮球 ⭐ → star SVG（白）；收藏面板标题/按钮（全部分享/打包）→ share/pack SVG
- 打包迷你条 📦 → pack SVG；侧边栏视图 ☰▦ → list/grid SVG；标签刷新 ↻ → refresh SVG
- 空状态 🗂️ → Lucide 文件夹 **mask 图标**（--empty-icon 变量 + currentColor，深浅色自适应，已实现）

**app.js（动态）**：
- 收藏面板行按钮 🔗⬇✕ → share/download/close SVG
- 列表/网格行 ⓘ🔗 → info/share SVG
- 详情预览按钮 ▶🖼📄📦📊🔗⬇ → play/image/text/archive/list/link/download SVG
- 各预览弹窗下载按钮 ⬇ → download SVG；错误提示下载（txtDl/csvDn/lnkDlSelf）→ download SVG
- 图片缩放 ＋－ → zoomIn/zoomOut SVG；全屏 ⛶ → max SVG；分享弹窗 🌐📋 → link/copy SVG
- 打包任务卡 📦⬇📋 → pack/download/copy SVG；迷你条/预览树 📦📁📄 → pack/folder/text SVG
- 收藏面板标题 ⭐ → star SVG（橙色强调）

**保留的语义符号**：压缩模式徽标 ⚡🚀📦（功能语义标签）、previewDir 展开 ▶▼ 指示符（逻辑依赖文本判断）。

## 三、验证（真实环境全 PASS）
- `node --check` + CSS 括号平衡 0。
- **E2E（playwright）**：主页/收藏面板/详情弹窗/图片预览/多选模式 5 视角截图；功能 emoji 残留从 20+ 降到 1（仅压缩模式语义徽标）；无 JS 报错。
- **mimo 视觉验收**：
  - 主页：导航云/上传/后退前进/刷新/筛选/文件夹/ⓘ/悬浮球 ★ 全部线条 SVG，**无彩色 emoji** ✓
  - 收藏面板/详情弹窗/多选批量栏：图标均为单色矢量 UI 图标，**三图均无 emoji** ✓
  - 图标风格统一（线条粗细/圆角一致）、大小协调（14-16px 按钮图标、24px 悬浮球）。

## 四、回归面
- 所有替换仅为图标（<img>/<span> 内容变化），id/class/事件绑定不变；mkBtn innerHTML 与原有纯文本 label 兼容。
- 深色模式：stroke=currentColor 自动适配（无需单独深色样式）。
- 截图存档：G:\自建agent专用工作区\DSH\_t8shots\t17_01~05.png

## 五、补充：文件类型图标全面改造（并入 t17）
用户反馈目录/文件类型图标"不搭、小、别扭"——除功能按钮 emoji 外，文件类型图标一并重做。

1. **ICONS 库补全 15 个文件类型图标**：video/image/audio/archive/iso/doc/pdf/sheet/code/exe/lnk/locked/file + folder/text（与 static/icons/*.svg 同一 Lucide 设计语言）；新增 `fileIcon(name, size)` 按扩展名取图标、`iconOf` 补 pdf 分支。
2. **渲染全面 inline 化**（<img src=static/icons> → 内联 SVG）：列表行、网格卡片、收藏面板行、详情名称行、解压列表行——**stroke=currentColor 随主题/深浅色自适应**（解决原 #64748b 固定色）；列表行图标 26px（原 20/22px）、网格 72px（矢量缩放不糊）。
3. **修复关键 bug**：folder/locked 直接用 `icon()`（原 `fileIcon("folder")` 会把 "folder" 当无扩展名文件名解析成 file 文档图标——文件夹全部显示为文档图标，mimo 验收发现并修复）。
4. **folder.svg 文件增强**：加内部层次线（opacity .35，克制）。
5. **CSS**：列表图标 hover 轻微放大（scale 1.1，仅 hover 设备）；网格 inline 图标居中。

**mimo 验收**（修复后截图 t17b_03/04）：
- ✅ 文件夹显示为文件夹图标（列表+网格），不再是文档图标
- ✅ 文件类型区分度良好（文件夹翻盖造型 vs 文件折角文档）
- ✅ 图标大小/风格/描边统一；列表/网格两视图一致
- ⚠️ 系统目录（Config.Msi/System Volume Information）图标偏灰半透明 = locked/denied 状态的有意弱化（非 bug）

---

# T18 全屏预览重构（方案B：独立预览页 /view）· 改动摘要（CHANGES_VIEW_PAGE）

> 任务：t18（netdisk-frontend-opt 团队 engineer，高优先）
> 用户反馈：T11 方案A 全屏（DOM 移动）严重问题——卡片放大黑屏、视频效果差、关闭后视频位置错乱
> 决策：废弃方案A DOM 移动，升级**方案B 独立预览页面**（真正"新开页面"）
> 改动文件：`server/server.py`（/view 路由）、`server/templates/view.html`（新模板）、`static/app.js`（renderPreview 体系 + 放大按钮改新标签页）、`server/templates/index.html`（移除 fsLayer）

## 一、后端（server.py）
1. **主模式 /view 路由**：`_resolve` 校验 path（与 /api/* 一致）→ 返回独立预览页 HTML。
2. **分享模式 sub=="view"**：`_resolve_share_path` 校验 → 同一模板（分享页也可沉浸式预览）。
3. `_load_view_html()` / `_send_view_html(self)`：模板读取/发送（失败占位页兜底）。

## 二、view.html（新模板，深色沉浸式）
- 深色底 #0b0f17 + 顶部导航（标题/⬇ 下载/✕ 关闭 + 安全区）+ 内容区居中最大化。
- 引用 bootstrap/app.js/cjk-normalize（相对路径，BASE 自动适配主/分享模式）。
- 内联初始化脚本：读 URL path/name/kind → 调 `renderPreview`。
- **shadow 占位 DOM**：为 app.js 顶层 Modal 初始化与事件绑定提供占位元素（`__shadow`，display:none）——避免独立页因缺主站元素导致 app.js 中断（这是实现要点）。
- 深色适配：文本/代码/Markdown/表格/解压列表/滚动条全套深色样式。

## 三、app.js
1. **renderPreview(kind, path, name, container) 分发**：video/image/pdf/csv/archive/text/markdown/detail → 对应 render*Preview。
2. **render*Preview 系列**（独立页渲染，复用弹窗版渲染辅助）：
   - renderTextPreview（编码提示 + md/code/纯文本分片渲染，大字号全屏滚动）
   - renderCsvPreview（表格全宽滚动）、renderUnpackPreview（解压列表）、renderImagePreview（大图 contain + 滚轮缩放）、renderPdfPreview（全屏 iframe）、renderDetailPreview（信息表）、renderVideoPreview（简化播放器：原生控件 + 原画流，深色大屏）
   - 弹窗版 show* 保持稳定不动（渲染辅助 renderMarkdown/fillTextChunked/parseCsv 已共用）。
3. **addFsButton 改造**：签名 (body, title, path, downloadUrl)，点击 → `window.open(BASE+"view?path=…&name=…", "_blank")` 新标签页。
4. **移除 T11 fsLayer 全层**：openFullscreen/closeFullscreen/fsOpen/fsPushed/Esc/popstate 绑定全部删除（index.html 的 #fsLayer HTML/CSS 同步移除）。
5. **BASE 修复**：独立页路径（/transfer/view 或 /s/xxx/view）自动去掉 /view 段，保证 api/静态相对路径正确。
6. **init 跳过**：独立页不初始化主站 UI（无 driveTabs/appModal 等元素），由 view.html 内联脚本驱动。

## 四、验证（真实环境全 PASS）
- `py_compile` + `node --check` + CSS 平衡。
- **E2E 5 项**：
  1. 文本弹窗 ⛶ → **新标签页**打开 /view → 内容渲染 ✓
  2. 图片独立页（naturalWidth>0）✓
  3. PDF 独立页（iframe）✓
  4. 详情独立页（detail-tbl）✓
  5. 视频独立页（video src=yes）✓
  - 全程无 JS 报错（修复 BASE/init/appModal/shadow DOM 三个根因后）。
- **mimo 视觉验收**：深色主题一致性优秀、导航（标题/下载/关闭）清晰、文本可读性良好；小瑕疵（图片加载时机截图/滚动条）已补滚动条样式，属可接受范围。

## 五、架构预留
- renderPreview 为**方案B 的渲染入口**：未来 /view 支持更多类型只需扩展分发。
- view.html 与弹窗预览共用同一批渲染辅助与 API 契约，维护成本低。

## 六、回归面
- 弹窗预览（show*）主路径不变（仅 ⛶ 按钮行为从 DOM 移动改为新标签页）。
- fsLayer 全部移除（无残留引用）；主站正常功能（收藏/打包/多选/分享）零改动。

---

# T20 未知类型文件操作面板 · 改动摘要（CHANGES_FILE_ACTIONS）

> 任务：t20（netdisk-frontend-opt 团队 engineer）
> 用户反馈：点击某些文件（exe/iso/docx/xlsx/dll 等）直接触发下载，体验突兀；希望弹操作面板
> 改动文件：`static/app.js`（bindRowAction else 分支 + 新增 showFileActions）
> 原则：有预览类型的文件仍走预览（主路径零破坏）；仅 "other" 类型改弹面板；长按多选兼容；node --check 门禁

## 一、实现
1. **bindRowAction else 分支改造**：fileKind === "other" 的文件不再直接下载（移除 list 的 <a> 包裹 / grid 的 location.href），统一 `el.onclick = () => showFileActions(e)`。
2. **新增 `showFileActions(e)`**（复用 appModal 操作面板）：
   - 头部：文件类型图标（inline SVG 40px，currentColor 随主题）+ 文件名（截断）+ **类型/大小**（"类型: XYZ · 16 B"）。
   - 操作按钮：
     - **⬇ 下载**（主按钮 btn-primary w-100）
     - **ⓘ 详情**（showDetail）、**🔗 分享**（showShareDialog）、**⭐ 收藏**（api/pin add=1 → 返回值同步 pinned → renderPinned → toast"已收藏" → 关面板）、**✕ 取消**（closeModal）——outline 等宽排列。
3. **与长按多选兼容**：多选模式下行点击走勾选（capture 拦截优先于 bindRowAction），面板只在非多选时触发；面板按钮位于 modal 内不受行 capture 影响。
4. **深色/移动端**：面板走 appModal（全屏弹窗已有）；图标 currentColor；按钮移动端 min-height 44px（.btn 全局规则）。

## 二、验证（真实环境全 PASS）
- `node --check` 通过；CSS 平衡 0（无 CSS 改动）。
- **E2E（playwright + 造 .xyz 测试文件）**：
  1. 点击 .xyz（other）→ **操作面板弹出（不直接下载）** ✓
  2. 面板显示 类型: XYZ · 16 B ✓
  3. 收藏按钮 → 收藏成功（徽标 1）+ 面板关闭 ✓
  4. 详情按钮 → 详情表 ✓
  5. 多选模式点行 = 勾选（不弹面板）✓
  - 无 JS 报错。
- **mimo 视觉验收**：面板信息清晰（文件名/类型/大小）、下载按钮突出、其余操作整齐、简洁明了 ✓。

## 三、回归面
- 有预览类型（video/image/text/pdf/csv/archive/lnk/markdown）点击行为不变。
- 详情/分享/收藏复用现有函数（showDetail/showShareDialog/api/pin + renderPinned），无重复实现。
- 截图：G:\自建agent专用工作区\DSH\_t8shots\t20_01_actions.png

---

# T21 详情入口重构 · 改动摘要（CHANGES_DETAIL_UI）

> 任务：t21（netdisk-frontend-opt 团队 engineer）
> 用户反馈：每行右上角 ⓘ 详情按钮很丑，不想要这么小的按钮；但要兼顾移动端与详情功能不丢
> 改动文件：`static/app.js`（移除 info-btn/grid-info + addFsButton 加详情按钮 + 预览弹窗详情入口）
> 原则：与 t20 统一操作面板体系；详情功能从面板/预览弹窗进入；分享模式行尾分享按钮保留；node --check 门禁

## 一、实现
1. **移除列表行 info-btn ⓘ**（listItem）：不再渲染 ⓘ 详情小按钮（含绑定）。
2. **移除网格卡 grid-info ⓘ**（gridItem）：同样移除。
3. **预览弹窗内详情入口**：`addFsButton` 增加 `detailPath` 参数——预览弹窗顶部操作行（⛶ 放大旁）显示 **ⓘ 详情**按钮（点击 `showDetail`）：
   showVideo / showText / showUnpack / showCsv / showPdf / showImage / showLnk 全部接入；showDetail 自身不加（本身就是详情）。
4. **详情入口汇总**（不再每行常驻）：
   - 有预览类型文件：点文件名 → 预览弹窗（内含 ⓘ 详情 + ⛶ 放大 + 下载）
   - 未知类型文件（other）：点文件名 → t20 操作面板（内含 详情/下载/分享/收藏）
   - 目录/收藏面板/分享模式行为不变；分享模式行尾分享按钮保留（SHARE_MODE 分支未动）。
5. **移动端**：面板/预览弹窗按钮走 .btn/.btn-sm 全局规则（min-height 44px）；详情为弹窗内大按钮，易点。

## 二、验证（真实环境全 PASS）
- `node --check`。
- **E2E（playwright）**：
  1. 列表行无 ⓘ 按钮 ✓
  2. 网格卡无 ⓘ 按钮 ✓
  3. 文本预览弹窗有"详情"按钮 → 点击进入详情表（showDetail）✓
  4. 无 JS 报错 ✓
- **mimo 视觉验收**：行尾无 ⓘ 更干净、行布局协调、整体简洁现代 ✓。
- 截图：G:\自建agent专用工作区\DSH\_t8shots\t21_01_list.png / t21_02_preview_detail.png

## 三、回归面
- showDetail 保留（从面板/预览弹窗进入）；t20 操作面板的详情按钮不受影响。
- 预览弹窗原有按钮（下载/⛶ 放大）不变；分享模式（SHARE_MODE）行为不变。
- 移动端触控（44px）与深色模式（currentColor 图标）无需额外适配。

---

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

---

# T25 压缩包预览升级：多格式 + 层级目录浏览 · 改动摘要（CHANGES_ARCHIVE）

> 任务：t25（netdisk-frontend-opt 团队 feature-engineer）
> 改动文件：`server/server.py`（主要）、`static/app.js`、`server/templates/index.html`
> 原则：zip 现有逻辑零破坏（仅在原路径上加层级过滤）；rar/7z 依赖外部工具，探测到才启用；
> 与 engineer T18（全屏预览）/T17（图标体系）并行无冲突（app.js 只动 showUnpack 区域 + ARCHIVE_EXT/iconOf/ICONS 一行）。

## 一、后端（server/server.py）
1. **多格式识别** `_archive_fmt(path)`：zip → zipfile；tar/tgz/tbz2/txz/tar.gz/tar.bz2/tar.xz → tarfile（`r:*` 自动识别压缩）；
   rar/7z → 外部工具；gz/bz2/xz 单文件（非 tar）尝试 tarfile，失败返回明确提示"单文件压缩，无内部目录结构"。
   `_ARCHIVE_EXT` 扩展为 {zip,rar,7z,tar,tgz,tbz2,txz,gz,bz2,xz}（`_preview_kind`/`_meta_kind`/`_MIME_BY_EXT` 同步扩展）。
2. **层级浏览核心** `_hier_level(raw, prefix, fmt)`：按 prefix 把扁平条目归并为该层一级子条目；
   隐含目录（只有文件无显式目录项）由文件路径推断；返回 {format, dir, entries, total}（total=该层含嵌套总数）。
3. **`_unpack_list(path, dir="")`**：dir 缺省=根层；zip/tar/7z/rar 统一返回层级条目。
   - tar 中文名修复 `_fix_tar_name`：GBK 字节被 tarfile 按 UTF-8 解出代理字符时，安全重解码（仅含代理字符且 GBK 解码含中文才采用）。
   - rar/7z：探测 7-Zip（`C:\Program Files\7-Zip\7z.exe` 等常见路径 + PATH）→ `7z l -slt -ba -sccUTF-8` 技术列表解析（Folder=+ / Attributes=D 判目录）；
     无 7-Zip 时回退 WinRAR（UnRAR/WinRAR lb 裸列表，尽力而为）；都没有 → **明确提示**"未找到 7-Zip 或 WinRAR，请安装后重试"。
4. **新增 `api/unpackdir`**（主站 + 分享路由）：带 `dir` 参数返回包内指定目录的子条目；`api/unpack` 同时支持可选 `dir`（向后兼容）。
5. **`_unpack_download` 多格式**：zip（原逻辑不动）；tar（tarfile 流式，Content-Length 精确）；7z（先 `7z l -slt` 查 size 设 Content-Length，再 `7z e -so` 流式）；
   WinRAR 备选（解压临时目录后流式，WinRAR 不支持 stdout）；目录条目下载返回 403 明确提示。

## 二、前端（static/app.js）
1. **`ARCHIVE_EXT`** 扩展为 [zip,rar,7z,tar,tgz,tbz2,txz,gz,bz2,xz]（`fileKind` archive 分支自动生效）；`iconOf` 同步。
2. **`showUnpack` 层级改造**：
   - 常驻 `#unpackRoot` 容器：层级切换只重建内容，顶部 ⛶ 放大按钮/弹窗结构保留；
   - 面包屑（根=档案名 → 各级目录，点击任意段直接跳层）+ 子层显示"⛶ 上级"返回按钮；
   - 目录行 ▶ 指示（新增 `chevronRight` SVG 图标）可点击进入下一层（`api/unpackdir?dir=`）；
   - 文件行点击下载（`api/unpackdl` 不变）；统计行显示"格式 · 当前层 N 项 / 共 M 项"。
3. 弹窗刷新恢复（`st.type==="unpack"`）仍从根层恢复。

## 三、样式（server/templates/index.html）
- `.unpack-row.dir`：cursor pointer + 文件名加粗 + hover 品牌浅蓝底（`--bs-primary-bg-subtle`）；
- `.dir-arrow`（▶ 指示，`--bs-secondary-color`）；`.unpack-crumb` 面包屑（seg hover/当前层高亮/分隔符），
  颜色全走 `--bs-*` 变量 → **深色模式自动适配**。

## 四、验证
- py_compile + node --check + CSS 括号平衡（344/344）通过。
- **后端单测**：zip/tar.gz/7z/rar 根层 + 子层（含中文名、隐含目录、空目录）全 PASS；
  `_fix_tar_name` GBK 模拟单测 PASS（中文路径还原、ASCII/UTF-8 名不动）；缺失 7z/WinRAR 时明确提示 PASS；单文件 gz 明确提示 PASS。
- **HTTP E2E**（端口 8898）：api/unpack（zip/tar/7z/rar）200；api/unpackdir（zip docs、7z docs/deep）200 层级正确；
  api/unpackdl 内容逐字节校验通过（zip 两级、tar.gz、7z、rar，均 200 + 内容一致）。测试服务器已关、临时文件已清。

## 五、已知边界
- rar/7z 需系统装有 7-Zip（推荐）或 WinRAR；未安装时预览/下载返回明确安装提示（非静默 unsupported）。
- 7z/WinRAR 下载的条目名若含 `*``?``[``]` 通配符，7z 可能按通配匹配（罕见场景，文档记录）。
- 单文件 gz/bz2/xz（非 tar 打包）无内部目录，返回明确提示并引导直接下载原文件。
- 空目录在 tar 中只有显式目录项才可见（tar 格式语义如此）；zip/7z 正常。


## 六、依赖最小化约束合规（用户强调"依赖尽可能小"）
1. **zip/tar 家族 = Python 标准库零新增依赖**：zipfile（原有）+ tarfile（本次新增 import，属标准库）；不引入任何新 pip 包。
2. **rar/7z 不引入新 pip 包**（无 py7zr/rarfile），改为**探测系统已有工具**：
   - 7-Zip：`C:\Program Files\7-Zip\7z.exe`、`C:\Program Files (x86)\7-Zip\7z.exe`、`7zz.exe`；
   - WinRAR：`C:\Program Files\WinRAR\Rar.exe` / `UnRAR.exe` / `WinRAR.exe`（含 (x86) 变体）；
   - 另自动探测 `%ProgramFiles%` / `%ProgramFiles(x86)%` / `%ProgramW6432%` 环境变量根目录与 PATH（`shutil.which`）；
   - 探测到才启用 rar/7z；未探测到 → 明确提示"需要 7-Zip 或 WinRAR，请安装 7-Zip（https://www.7-zip.org/）"（非静默 unsupported）。
3. **零新增 npm/pip 依赖、不下载二进制**；探测路径为模块级常量列表 `_SEVEN_7Z_PATHS` / `_WINRAR_PATHS`（server.py），用户可直接追加自定义安装路径。
4. 本机实测：7-Zip 已安装于 `C:\Program Files\7-Zip\7z.exe`（常量路径命中）；rar 经 7-Zip 读取验证通过；WinRAR 未安装（回退分支按文档实现，未实测）。
5. 该约束同样适用于团队其它任务（t24 无权限拦截等）：全程仅使用 Python 标准库 + 现有静态资源，无任何新增外部依赖。

---

# T26 磁盘标签激活态同步 + 盘号显示修复 · 改动摘要（CHANGES_DRIVE_FIX）

> 任务：t26（netdisk-frontend-opt 团队 feature-engineer）
> 改动文件：`static/app.js`
> 现象（用户反馈）：前进/后退切换目录时（尤其跨盘，如 C 进 D 再后退），顶部磁盘标签激活高亮、面包屑 🏠 不刷新，显示的仍是旧盘。

## 根因
- `loadList`（原 app.js:3293）只调 `renderBreadcrumb()` + `updateNavBtns()`，从不调 `renderDriveTabs()`；
- `renderDriveTabs()` 只在 `switchDrive`（原 2431）里调用；
- `navBack` / `navFwd`（原 2586-2587）直接 `loadList(navStack[...])`，不更新 `activeRoot`；
- ⇒ 跨盘导航后：磁盘激活态不刷新、面包屑 🏠 指向旧 activeRoot、localStorage drive.root 也保存错误盘。

## 修复
1. **新增 `rootOf(path)`**：从路径推断所属根——roots 中最长的前缀匹配（Windows 盘符**大小写不敏感**，兼容 `/` 与 `\\` 分隔），无匹配返回 null。
2. **新增 `syncDriveUI()`**（统一同步入口）：按当前 `cur` 推断所属盘，若与 `activeRoot` 不一致则更新 `activeRoot` 并重渲染 `renderDriveTabs()`；分享模式跳过（无磁盘标签，activeRoot 由分享根决定）。
3. **`loadList` 成功路径挂接**：`cur = path` 之后立即调用 `syncDriveUI()`——覆盖**所有**导航路径（switchDrive / navBack / navFwd / 面包屑点击 / 目录行点击 / .lnk 跳转 / 刷新恢复 / 收藏面板跳转），一处改动全局生效；错误路径不触发（cur 未变）。
4. **init 恢复逻辑强化**（盘号显示不一致的边缘场景）：
   - 优先按 `savedCur` 用 `rootOf` 推断真实所属盘（修复 savedRoot 与 savedCur 跨盘错位缓存）；
   - `savedCur` 失效（盘消失/目录被删）→ 回退 `savedRoot`；
   - 两者都失效 → `roots[0]` 并**清理陈旧 localStorage 键**（drive.root / drive.cur）。
5. **面包屑 🏠**：因 `activeRoot` 现在始终与 cur 同步，`if (cur !== activeRoot) addSeg("🏠", activeRoot)` 自动指向正确盘。

## 验证
- node --check 通过；
- **rootOf 逻辑单测（9/9 PASS）**：C:\\ / C:\\Users\\x / D:\\data / 大小写 d:\\data / F: / G:\\deep 均正确；X:\\no 与空串返回 null；最深前缀优先；
- **跨盘模拟 PASS**：C: 根 → 进入 D:\\data\\sub（activeRoot=D）→ 后退回 C:（activeRoot=C）→ 再前进回 D（activeRoot=D）；
- 全导航路径审计：所有 loadList 调用点（面包屑/后退/前进/目录行/刷新/.lnk/收藏/init）均经 syncDriveUI，无遗漏旁路。

---

# CHANGES_ICON_DUAL.md — 双图标方案（线条 / 彩色可切换）

> T29（并行编号 T34-2）：在保留原有线条图标风格的同时，新增一套彩色文件图标，
> 侧边栏一键切换，localStorage 记住选择，即时生效，深色模式两套均可辨。

## 一、需求对照

| 需求 | 实现 | 状态 |
|---|---|---|
| ① 线条图标风格保留 | 默认风格（inline SVG，currentColor 随主题），未被替换 | ✅ |
| ② 新增彩色图标（扁平写实圆角） | `static/icons/color/*.svg` 共 15 个：folder/video/image/audio/archive/iso/doc/pdf/sheet/code/exe/lnk/locked/file/text | ✅ |
| ③ 侧边栏「图标风格：线条/彩色」切换 + localStorage 记住 + 即时生效 | 侧边栏按钮组 `iconLineBtn`/`iconColorBtn`；`drive.iconStyle` 持久化；`typeIcon()`/fileIcon() 统一入口按风格取；切换即 `renderEntries()+renderPinned()` | ✅ |
| ④ 两风格截图 + mimo 验收 | 亮/暗 × 线条/彩色 + 网格 + 视频目录，mimo 全部通过 | ✅ |
| ⑤ 深色模式两方案可辨 | 彩色图标为「填充色 + 深色描边」，深色背景下颜色依旧鲜明（mimo 确认） | ✅ |

## 二、彩色图标设计

- 位置：`static/icons/color/`（服务端 `_send_static` 已允许 `icons/color/` 子目录）。
- 风格：24×24 扁平填充 + 1.2–1.3 深色描边（描边保证深色主题下的轮廓与辨识度），白色/浅色点缀符号。
- 配色（写实、按文件类型区分）：
  - 文件夹/快捷方式：黄（#fbbf24/#f59e0b），.lnk 叠加蓝色箭头
  - 视频：蓝 #3b82f6 + 白色播放三角；图片：绿 #22c55e + 白色山形
  - PDF：红 #ef4444；Word：蓝 #60a5fa；表格：绿 #4ade80
  - 压缩包：橙 #f97316；镜像 iso：橙盘；代码：青 #14b8a6；程序 exe：深灰窗 + 绿播放
  - 音频：紫 #a855f7；文本：灰蓝页；通用文件：浅灰页
- 本任务补齐缺失的 `pdf.svg`（其余 14 个为并行成员已创建，逐一核对风格一致）。

## 三、前端接入（统一入口）

- `let iconStyle`（默认 "line"）+ 加载时从 `localStorage["drive.iconStyle"]` 恢复（主页；分享页不读主站键，保持默认线条）。
- `typeIcon(kind, size)`：line → 内联线条 SVG；color → `<img src="static/icons/color/<kind>.svg">`。
- `fileIcon(name, size)` = `typeIcon(iconOf(name), size)`；目录/锁定走 `typeIcon("folder"|"locked")`；`iconUrl()` 同步分流。
- 侧边栏切换：`setIconStyle(v)` → 写 localStorage → `syncIconStyleBtns()` → `renderEntries()` + `renderPinned()`（即时生效，无需刷新）。
- 视频网格封面（api/thumb 缩略图）加载失败时：彩色模式回退 `color/video.svg`，线条模式回退原 `video.svg`。
- 独立预览页 `/view`：阴影占位 DOM 补 `iconLineBtn`/`iconColorBtn`（否则 app.js 顶层绑定 `syncIconStyleBtns()` 在 /view 页抛空引用，页面白屏）；该页同样恢复用户风格。

## 四、CSS 修正（T29）

- `.list-group-item .ic img` 由 `width:22px !important` 改为 `max-width/max-height: 26px`：
  修复彩色图标（26px 请求）被强制缩到 22px、与行内线条图标（26px）大小不一致的问题；
  同时不再把收藏面板 16px 小图标错误放大到 22px（16px 原样保留）。

## 五、验证记录

- `node --check static/app.js` ✅；index.html CSS 花括号平衡 0 ✅；server.py 未改动（无需重启 8443）。
- 8123 测试服务 E2E（Playwright + Chromium）：
  - 侧边栏切「彩色」→ 列表 46 个图标全部换为彩色 <img>，无刷新；
  - 刷新/新开页面 → 按钮 active、46 个彩色图标（localStorage 持久化生效）；
  - `/view?path=<pdf>` 独立页正常渲染、无 JS 错误；
  - 全流程 console/pageerror 0 条（注：早期一轮测试脚本自身 `C:\\Users` 转义错误产生 "Invalid Unicode escape sequence"，为测试脚本问题，非应用缺陷，已用 json.dumps 修正后复测为 0）。
- mimo-v2.5-free 视觉验收（截图 `G:\自建agent专用工作区\DSH\_t8shots\t29_*.png`）：
  - 亮色 线条 vs 彩色：两套均清晰，彩色颜色鲜明（黄文件夹/蓝文档/lnk 箭头），无破损图标，布局正常；
  - 暗色 线条 vs 彩色：深色背景下均清晰，彩色依旧鲜明可辨；
  - 网格(暗)+下载目录(亮) 彩色：大/小图标效果一致，类型色区分直观；
  - /view 预览页：渲染正常。

## 六、涉及文件

- `static/icons/color/*.svg`（15 个；本任务新增 pdf.svg）
- `static/app.js`：iconStyle 声明与恢复、typeIcon/fileIcon 分发、视频回退、按钮绑定/同步
- `server/templates/index.html`：侧边栏「图标风格」按钮组、标签文案（去掉内部任务号）、CSS 尺寸修正
- `server/templates/view.html`：阴影占位 DOM 补两个按钮

---

# CHANGES_LNK_DETAIL.md — .lnk 点击行为 + 详情按钮落地（T32）

> 任务：t32（netdisk-frontend-opt 团队 / engineer）
> 语义已由用户确认：点击 .lnk → 解析目标 → 目录进入 / 文件进入其所在目录 / 失效 toast。
> 与 t20（操作面板）/ t21（详情重构）同一套面板联动；.lnk 直接进入目标主体为 T34-1 已落地，本任务补齐次要入口并修复后端编码缺陷。

## 一、确认的 .lnk 点击行为（已验证全链路）

| 场景 | 行为 | E2E 实测 |
|---|---|---|
| 目标存在且是目录 | loadList(目标) 直接进入 | ✅ 到目录.lnk → 进入 ...Desktop\Other |
| 目标存在是文件 | loadList(dirnameOf(目标)) 进入所在目录 | ✅ 到文件.lnk → 进入 ...Desktop |
| 目标失效/不存在 | toast("快捷方式已失效")，不导航 | ✅ 失效.lnk → toast，目录不变 |
| 越界/stat 校验 | 目标必须在可访问根内，否则视为失效 | ✅（openLnkTarget 双重校验 api/lnk + api/stat） |

## 二、本任务改动

### 1. server.py — _lnk_target 中文目标编码修复（关键 bug）
- 现象：目标文件名含中文时乱码，如 ai大模型api备注.txt → ai澶фā鍨媋pi澶囨敞.txt（UTF-8 字节被按 GBK 解码），导致 exists=false、快捷方式被误判失效。
- 根因：PowerShell 5.1 管道输出为 UTF-8 字节，原代码 encoding=gbk 解码。
- 修复：PS 命令开头强制 $OutputEncoding=[Console]::OutputEncoding=[Text.Encoding]::UTF8，Python 侧改 encoding=utf-8；中文路径（目录/文件/工作目录/参数）均正确。
- 验证：8123 与 8443 生产（已按流程重启，PID 65268 启动 10:25:15 > server.py mtime 10:24:12）实测 ai大模型api备注.txt → target 正确 / exists:true。

### 2. static/app.js — showLnk 次要入口落地
- 缺口：T34-1 让 .lnk 点击直接进目标后，操作面板无 lnk 分支、列表无入口 → showLnk（查看/跳转快捷方式目标）在 UI 上不可达。
- 修复：
  - showFileActions：fileKind==="lnk" 时在按钮区新增「快捷方式目标」按钮（link 图标，→ showLnk(e.path, e.name)），与 下载/分享/收藏/取消 并列；面板头部照常显示 图标+名+类型(LNK)+大小。
  - bindRowAction lnk 分支：点击仍为进入目标（确认语义不变）；新增 contextmenu（右键）次要入口 → 打开操作面板。桌面用户右键即可查看/跳转目标；移动端长按多选行为不变。
- showLnk 弹窗本身保留（目标路径 / 目标为目录📂 / 进入目标所在目录 / 下载快捷方式本身）。

### 3. 顺带修复：并行改动引入的语法错误
- gridItem 图片封面回退行（api/img onerror）被并行成员改坏（this.src='' 引号错位，node --check 失败），已按视频行模式修复为 this.src=\'...\'，node --check 恢复通过。提示：涉及该行（app.js ~3665）的并行改动请注意。

## 三、t21 详情 ⓘ 落地复核（收尾补充）
- 列表行/网格卡 .info-btn / .grid-info 数量 = 0（实测）；
- 详情入口：①操作面板新增「详情」按钮 → showDetail（完整详情弹窗：路径/大小/时间/元数据/预览按钮），other 与 lnk 面板均已实测；②有预览 → 预览弹窗内（addFsButton detailPath）；③分享模式行尾分享按钮保留。
- 收尾指令后补：showFileActions 按队长要求补回「详情」按钮（原 t21 曾以头部显示信息为由省略，现明确并入面板）。

## 四、验证
- node --check ✅ / py_compile server.py ✅
- 8123 E2E（Playwright + 真实 .lnk，PowerShell WScript.Shell 创建）：目录目标 / 文件目标 / 失效目标 / 右键面板 / 快捷方式目标弹窗 5 项全 PASS，0 pageerror
- 截图：G:\自建agent专用工作区\DSH\_t8shots\t32_lnk_panel.png
- 8443 生产服务已重启并验证（见上）；测试用 .lnk 已清理（Desktop\TestLnks 删除）

## 五、涉及文件
- server/server.py（_lnk_target 编码）
- static/app.js（showFileActions lnk 分支、bindRowAction contextmenu、图片回退引号修复）

---

# T34 .lnk 直接进入目标 + 双图标方案 · 改动摘要（CHANGES_LNK_ICON）

> 任务：t34（netdisk-frontend-opt 团队，原属 engineer 改派 feature-engineer）
> 改动文件：`static/app.js`、`server/templates/index.html`、`server/server.py`（静态白名单）、`static/icons/color/`（新增 14 个彩色 SVG）
> 原则：功能零破坏；showLnk 保留（操作面板查看目标）；线条图标体系完全保留；node --check 门禁。

## 一、.lnk 点击直接进入目标
- `bindRowAction` 的 lnk 分支：`showLnk`（弹窗）→ `openLnkTarget(e.path, e.name)`（直接导航）；
- 新增 `openLnkTarget`：调 `api/lnk` 解析 → 目标必须存在且在可访问根内（`api/stat` 校验，越界/不存在都算失效）→
  **目录 → loadList(target) 进入；文件 → loadList(dirnameOf(target)) 进入所在目录；失效 → toast("快捷方式已失效")**；
- `showLnk` 保留：操作面板（T20）"快捷方式跳转"按钮与 `previewFile`、弹窗恢复仍走它，行为不变。

## 二、双图标方案（线条 / 彩色可切换）
1. **彩色图标资源**：新增 `static/icons/color/` 14 个彩色 SVG（黄色文件夹、蓝视频、绿图片、紫音频、橙压缩包、蓝文档、绿表格、深色终端 exe、青代码、灰文本、浅灰通用文件、橙 ISO、黄+蓝快捷方式、琥珀锁）；
2. **后端白名单**：`_send_static` 的 icons 分支从 `os.path.join(STATIC_DIR, "icons", name)` 改为保留子目录（`os.path.normpath(STATIC_DIR + rel)` + 必须落在 icons/ 内），`static/icons/color/*.svg` 可正常服务，路径穿越仍被拦截（E2E 验证 404）；
3. **前端切换**：
   - 新增 `let iconStyle`（"line"|"color"）+ `typeIcon(kind, size)`：line → 内联线条 SVG；color → `<img src="static/icons/color/<kind>.svg">`（loading=lazy）；
   - `fileIcon()` / `iconUrl()` 按 `iconStyle` 取；目录/锁定图标调用点（列表行/网格卡/详情/解压行/收藏面板）全部改为 `typeIcon("folder"/"locked")`；
   - 侧边栏（视图与筛选面板）新增"图标风格"切换（线条/彩色按钮组，样式与视图切换一致），localStorage `drive.iconStyle` 记住，init 恢复；
   - 切换后 `renderEntries()` + `renderPinned()` 立即重渲染；分享模式不写 localStorage。
4. 保留线条：T24 deny-lock 小角标（12/16px 覆盖层）、打包面板行图标——刻意维持线条风格。

## 三、验证
- node --check / py_compile / CSS 括号平衡（348/348）全通过；
- **逻辑单测 10/10 PASS**：fileIcon line→内联 SVG、color→img（video/folder/pdf/image/archive/other 路径正确）；openLnkTarget 决策（目录→loadList(target)、文件→loadList(父目录)、stat 失败→toast）；
- **HTTP E2E PASS**（8897）：`static/icons/color/folder.svg` 200（内容含 #fbbf24 黄色）、video.svg 200、线条 folder.svg 仍 200；路径穿越 `icons/../app.js`、`icons/color/../../app.js` 均 404；
  真实 .lnk（PowerShell WScript.Shell 创建）：目录目标 is_dir=True、文件目标 is_dir=False；失效目标 exists=False + stat 403（前端 toast 路径）；
- 测试服务器已关、临时文件已清。

---

# CHANGES_SHARE_MODE.md — 分享模式重构（T35）

> 任务：t35（netdisk-frontend-opt 团队 / engineer）
> 用户反馈 /s/ 分享链接的四个问题，已全部重构并验证。

## 一、四个问题 → 修复对照

| # | 问题 | 修复 | 验证 |
|---|---|---|---|
| 1 | 路径/面包屑重复段 | renderBreadcrumb 两个 SHARE_MODE 分支（shareVirtual / shareRoot）改为只把**非末级段**渲染为可点击 seg，末级段仅由 .cur 渲染一次；分享页只显示分享根以下的相对层级 | E2E：进入子目录后面包屑末级段在 seg 中重复数 = 0；mimo 确认无重复 |
| 2 | 每行分享按钮冗余 | 移除 listItem 的 .share-btn 与 gridItem 的 .grid-share（HTML 与绑定全部删除） | E2E：DOM 中 .share-btn/.grid-share = 0；mimo 确认行内无分享按钮 |
| 3 | 分享模式禁长按多选 | ①bindLongPress start() 去掉 SHARE_MODE 限制；②enterBulkMode 去掉 SHARE_MODE 限制；③listItem/gridItem 统一绑定（分享模式同样 bindLongPress + bulk 点击拦截）；④批量栏分享模式态 syncBulkBarForMode()：隐藏 bulkPin/bulkUnpin/bulkPack，bulkShare 变「再分享」；⑤批量再分享 bulkReshare()：api/sharesub 逐项（与父分享同步过期），结果列表逐个复制；⑥操作面板 showFileActions 分享模式态：无收藏，分享=再分享（showSubShareDialog） | E2E：长按进多选、栏只显示 全选/再分享/下载/取消、批量再分享弹窗「已生成 N 个二次分享链接（与当前分享同步过期）」+复制按钮、批量下载正常、面板按钮 [下载,详情,再分享,✕取消] |
| 4 | 二次分享时间可被延长 | server.py sharesub：expires_at = min(请求过期, 父分享剩余)；父分享已过期时 403 拒绝（route 层 _share_expired 链式兜底 + 本处防御） | API 实测：sub_exp == parent_exp（无任何延长），sub <= parent |

## 二、改动文件

- **static/app.js**
  - renderBreadcrumb：两个 SHARE_MODE 分支末级段去重（slice(0,-1)）
  - listItem / gridItem：移除 share-btn / grid-share 标记与绑定；统一 bindLongPress + bulk 点击拦截（分享模式同样生效）
  - bindLongPress：start() 守卫去掉 SHARE_MODE
  - enterBulkMode：去掉 SHARE_MODE 守卫；新增 syncBulkBarForMode()（分享态隐藏 pin/unpin/pack + 按钮文案「再分享」）；toast 分享态文案
  - bulkShare：SHARE_MODE → bulkReshare()；新增 bulkReshare()（api/sharesub 逐项 + 结果列表复制 + 自动退出多选）
  - showFileActions：SHARE_MODE 态无收藏按钮、分享=再分享（showSubShareDialog）
- **server/server.py**：sharesub 时间钳制（min(请求, 父剩余) + 已过期拒绝）
- **server/templates/index.html**：无改动（批量栏按钮隐藏/文案由 JS 控制，行内按钮已从 JS 移除）

## 三、验证记录

- node --check ✅ / py_compile ✅（8443 生产已按流程重启，8123 测试同步）
- 8123 E2E（Playwright + 真实分享）：
  - 分享根/子目录面包屑：末级段重复 0
  - 行内分享按钮：0
  - 长按进多选 → 批量栏：pin/unpin/pack 隐藏，再分享/下载/全选/取消 可见
  - 批量再分享：生成列表 + 复制按钮 + 「与当前分享同步过期」提示；自动退出多选
  - 批量下载：文件项正常触发下载（目录项跳过）
  - 操作面板：分享模式 [下载, 详情, 再分享, ✕ 取消]（无收藏）
  - 后端钳制：sub_expires_at == parent_expires_at（相等，无法延长）；父过期 → 403
- mimo-v2.5-free 验收：面包屑无重复 / 批量栏仅 全选·再分享·下载·取消 / 行内无分享按钮 / 整体正常 ✅
- 主站回归：bulkTogglePin、bulkPack、主模式批量分享逻辑均在（served app.js 检查 + 门禁）

## 四、截图

- G:\自建agent专用工作区\DSH\_t8shots\t35_share_breadcrumb.png（子目录面包屑）
- G:\自建agent专用工作区\DSH\_t8shots\t35_share_bulkbar.png（分享模式批量栏）

---

# T36 P1 敏感信息脱敏 · 改动摘要（CHANGES_MASK）

> 任务：t36（netdisk-frontend-opt 团队 feature-engineer；依据 UX_REPORT §4 P1，mimo 最高优先）
> 改动文件：`static/app.js`（共享函数 + 4 个预览渲染入口）、`server/templates/view.html`（独立预览页切换按钮）
> 原则：默认脱敏、可一键切换明文；仅打码疑似真实密钥，避免误伤普通文本；零功能破坏；HTML id 不变（仅新增 viewMaskBtn）。

## 一、共享函数 maskSensitive(text)（app.js，view.html 经 app.js 复用）
打码规则（默认保留前4后4，中间 ****；仅打码疑似真实密钥——含数字或足够长）：
1. **PEM 私钥整块**：`-----BEGIN [A-Z ]*PRIVATE KEY-----...-----END [A-Z ]*PRIVATE KEY-----`（`[\s\S]*?` 跨换行）→ 整体替换为占位模板；
2. **键值形式**：`(api_key|secret|passwd|password|token|access_token|auth_token)s*[:=]s*值` —— 键名可出现在标识符中段（`my_api_key`/`authToken`），值可带单双引号（打码保留引号），只打码值部分；值 <8 字符或"无数字且 <16"不处理（防误伤 `token: Disabled` 这类配置项）；
3. **sk-**（OpenAI，16+）、**AKIA**（AWS，16 位）、**ghp_**（GitHub PAT，20+）、**xox[baprs]-**（Slack，10+）：前缀保留，值部分无条件打码（前缀即密钥类型标识，无误伤风险）。
- 快速路径：文本无 `\w` 或不含敏感关键词（sk-/akia/ghp_/xox/private key/api/secret/password/token 等，大小写不敏感预检）时直接返回，大文本零开销。

## 二、渲染入口接入（默认脱敏，弹窗/独立页可切换）
| 入口 | 位置 | 接入方式 |
|---|---|---|
| showText（含 markdown/code 分支） | app.js | `previewMask` 为真时对正文 `maskSensitive(text)` 后再 renderMarkdown/高亮/分片渲染；按钮「显示明文/隐藏敏感信息」切换后 paint() 重渲染 |
| showCsv | app.js | 逐单元格 `maskSensitive(cell)` 后 esc() 输出（保持表格结构）；同样带切换按钮 |
| renderTextPreview（独立预览页文本分支） | app.js | `previewMask` 为真时打码 |
| renderCsvPreview（独立预览页 CSV 分支） | app.js | 逐单元格打码 |
- 独立预览页 view.html：顶栏新增 `viewMaskBtn`（「显示明文」），点击翻转 `previewMask` 并重渲染；复用同一 maskSensitive。
- 预览 note 行追加状态提示："· 敏感信息已打码 / · 显示明文"。

## 三、验证
- node --check / py_compile / CSS 括号平衡（349/349）全通过；
- **maskSensitive 单测 21/21 PASS**：sk-/AKIA/ghp_/xoxb- 前缀打码（前缀保留+值 4+4）、PEM 整块（RSA/OPENSSH 变体）、键值（= 与 : 、引号值、`my_api_key`/`authToken` 标识符中段）、误伤防护（`token: Disabled`、`password: iloveyou`、`secret=abc`、`tokenizer=abc`、普通中英文文本、URL 中的 api/list 均不动）；
- 调试修正记录：① 预检探针大小写不敏感（AKIA/PRIVATE KEY 曾漏检）；② PEM 正则由 `\s\S*?` 改为 `[\s\S]*?`（原式无法跨换行）；③ 键值正则由 `\b` 改为 `(^|[^A-Za-z0-9])` 前缀（支持 `my_api_key`）并支持引号值。

---

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

---

# T38 P3 视觉细节批次A · 改动摘要（CHANGES_UXA）

> 任务：t38（netdisk-frontend-opt 团队 feature-engineer；UX_REPORT §4 P3 多条轻量建议）
> 改动文件：`static/app.js`、`server/templates/index.html`
> 原则：node --check 门禁；HTML id 不变（未改任何现有 id）；深浅色/移动适配；零功能破坏。

## 逐项
1. **面包屑 Windows 风格（P3-2）**：主模式段间分隔符由 "/" 改为 "\\"（视觉像 C: \\ Users 路径）；盘符段（i=0，rootOf 精确匹配）加 `.drive` 类，CSS 用 `--bs-primary` 加色；盘根时当前段 `.cur` 也加 `drive` 类；各段仍可点击回对应层；SHARE_MODE 两个分支完全不动。
2. **悬浮球收藏提示（P3-3）**：`#pinFab` 已有 title="收藏"（无需改）；新增 CSS：hover 时球左侧淡入淡出显示"收藏"小标签（`@media (hover:hover)` 内 `::after`，触屏无 hover 不显示；深色底标签双主题可见）。
3. **打包进度文案（P3-4）**：迷你条由 `99% · 完成 0/1`（百分比与完成数矛盾）改为百分比为主 + 明细「已完成 x/y」，全部完成时显示 `100% · 已完成`；头部芯片同步为「已完成 x/y」（全完成显示「已完成」）。计数逻辑核查：done=state==="done" 计数、total=任务数均正确，矛盾源于 0.99 封顶百分比与完成数并列，纯文案修复。
4. **空状态布局（P3-6）**：主列表空态（#fileRows > .empty）加 `min-height: 45vh`，配合已有 flex 图标+文案整体垂直居中，留白呼吸感（不作用于侧边栏/收藏面板内空态；深色走 --bs-* 变量）。
5. **推荐标签提示（P3-5）**：chip 的 title 统一为「点击搜索该标签 · 出现于 N 个文件」；标签区加一行小字「点击标签快速搜索 · 标签来自当前目录文件名与元数据」（纯说明，不筛选用户数据，不动 tagApplyTag 搜索逻辑）。
6. **预览弹窗细节（P3-8）**：PDF 兜底提示由裸小字改为 `.pdf-fallback` 醒目提示块（虚线边框 + 浅琥珀底 + 图标 + 主色链接，深浅色自适应）；「下载压缩包本身」→「下载压缩包」；「上级」按钮由 `btn-outline-secondary` 改为 `btn-outline-primary`（描边+back 图标更醒目）。

## 验证
- node --check 通过；CSS 括号平衡 356/356；
- 面包屑渲染逻辑单测 4/4 PASS（盘根 cur:drive、子目录 seg:drive + 反斜杠分隔 + 各层 cur/seg 正确、D 盘子目录）；
- HTML 现有 id 零改动；深色/移动适配走既有 --bs-* 变量体系。

---

# CHANGES_UXB.md — P3 打包预览树编码核查 + 筛选面板抽屉化验证（t39）

> 任务：t39（netdisk-frontend-opt 团队 / engineer）
> UX_REPORT §4 P3-9（打包预览树乱码 "演@构骰吧@"）与 P3-1（右侧筛选面板遮挡列表）。

## 结论先行

两项经代码定位 + 端到端复现验证：**均已由既有修复覆盖，无需新增改动**（避免与并行 t38 视觉区冲突、遵守"零功能破坏"）。

---

## 一、打包预览树乱码（P3-9）——已验证无复现

### 定位过程
打包/解压所有读文件名的代码路径逐一核查，均已在 t14（编码系统性修复）/ t25（多格式解压）接入统一编码修复：

| 路径 | 函数 | 编码处理 |
|---|---|---|
| zip 条目名 | `_unpack_zip` → `_fix_zip_name`（server.py:3597） | cp437→GBK 重解码，CJK≥2 且无控制字符才采用；ASCII/UTF-8 标志名不动 |
| tar/tgz 条目名 | `_unpack_tar` → `_fix_tar_name`（3640） | surrogateescape→GBK，CJK≥1 采用 |
| 7z 列表 | `_seven_list`（-sccUTF-8）+ `_decode_cmd`（3714） | UTF-8 优先、GBK 回退 |
| WinRAR 备选 | `_unpack_winrar` → `_decode_cmd` | 同上 |
| 打包任务名/current_file | `_archive_new_task` / `_archive_worker` | 真实路径（Python unicode，无解码环节） |
| 打包预览树/目录统计 | `_archive_preview` / `createPackPreview`（前端） | 真实路径直传 |

### 复现验证（8123，真实夹具）
- **GBK 无 UTF-8 标志 zip**（老式 Windows 打包）：`api/unpack` → 条目 `['中文条目.txt']` 正确（无乱码）
- **浏览器全流程**：中文文件夹（中文文档.txt / 资料/子文件.md / 老式中文包.zip）收藏 → 打包面板预览树 `T39Test ▶ 资料 ▶ 中文文档.txt 5 B 老式中文包.zip 131 B` 中文全部正确；提交打包 → 任务卡 `T39Test、资料 等 4 项 … 压缩完成 · 待下载` 正确；0 pageerror
- mimo 视觉验收：打包预览树/任务卡中文正常，无 "演@构骰吧@" 类乱码

> UX 报告截图（t5_pack_done）早于 t14/t25 编码修复；当前代码已不存在该缺陷。本地无 7z/rar 工具（Get-Command 为空），该路径按 `_decode_cmd` 逻辑核查无误。

## 二、筛选面板抽屉式（P3-1）——已验证已实现

### 现状核查（index.html）
`.sidebar` 已是标准右侧抽屉：`position: fixed; right:0; width:min(320px,86vw); transform:translateX(102%); transition:transform .28s ease`，`.show` 滑入；`.sidebar-mask` 半透明遮罩（z-index 1040 < sidebar 1041），点遮罩/✕ 关闭。

### 浏览器实测（Playwright）
- 桌面 1280px：打开抽屉后**列表宽度 1182→1182 零变化**（overlay 浮层不挤压列表）✅；侧边栏宽度恰为 320px ✅
- 点遮罩关闭 ✅；✕ 按钮关闭 ✅
- 手机 375px：抽屉 320px ≤ 视口（约 85% 宽）✅
- 面板功能完整（搜索/排序/类型筛选/推荐标签/重置/图标风格/显示隐藏文件均在 sidebar-body 内，HTML id 未变）
- 0 pageerror；mimo 验收：抽屉从右滑入、不遮挡列表、移动端适配良好

## 三、验证记录

- node --check ✅ / py_compile ✅（本任务未改 server.py，无重启需求）
- 8123 E2E 全项 PASS；截图 t39_pack_tree / t39_pack_done / t39_drawer_desktop / t39_drawer_mobile
- 夹具（Desktop\T39Test）已清理；测试 8123 的瞬态 pin/任务随重启清空，8443 生产未受影响

## 四、涉及文件

- 本任务未改动任何源码（两项均已由既有实现覆盖）；`CHANGES_UXB.md` 为核查与验证记录。

---

# T40 UX 优化回归走查 · 验证报告（CHANGES_UX_VERIFY）

> 任务：t40（netdisk-frontend-opt 团队 feature-engineer；只读验证+截图，未改任何代码）
> 环境：https://127.0.0.1:8443/transfer（token=transfer，headless msedge + Playwright MCP + mimo-v2.5-free 视觉验收）
> 截图：G:/自建agent专用工作区/DSH/.pwview/.playwright-mcp/t40/*.png（13 张，关键图另存 _t40shots/）
> 范围：t36（P1 脱敏）t37（隐藏文件+统计+悬停全名）t38（视觉批次A）t39（打包乱码核查+抽屉面板）+ 无回归快检

## 验证结果汇总

| 项 | 验证方式 | 结果 | 严重度 |
|---|---|---|---|
| t36 文本预览默认脱敏 | DOM 取 .text-pre 文本 | ✅ 通过：`api_key=sk-a****0123`、`AKIA1234****CDEF`、`password=secr****t123`，普通行不动 | — |
| t36 「显示明文」切换 | 点击按钮后取文本 | ✅ 通过：完整密钥显示，按钮变「隐藏敏感信息」，note 变「显示明文」 | — |
| t36 /view 独立页脱敏+切换 | viewMaskBtn 点击 | ✅ 通过：默认打码、点击后明文、按钮文案同步 | — |
| t36 mimo 视觉 | 04_text_masked.png | ✅ 通过：密钥星号打码可见、显示明文按钮在、无中文乱码 | — |
| t37 默认隐藏 | 列表行名+统计行 | ✅ 通过：`.hidden.txt`/`~$temp.docx` 隐藏，统计「共 4 项 · 2 个目录 · 2 个文件」 | — |
| t37 开关+记忆 | 切换后统计行 | ✅ 通过：6 项（含隐藏项），统计同步，localStorage 记忆（刷新后保持） | — |
| t38 面包屑 Windows 风格 | DOM class/分隔符 | ✅ 通过：`<span class="seg drive">C:</span>` + 反斜杠分隔（C: \\ Users \\ ...） | — |
| t38 悬浮球 title+hover 标签 | DOM title + 服务页 CSS | ✅ 通过：title="收藏"；css 含 `.pin-fab::after content:"收藏"`（hover 淡入淡出） | — |
| t38 打包进度文案 | 实测打包任务 | ✅ 通过：芯片「已完成 0/1」、任务卡「压缩完成 · 待下载」、迷你条逻辑（全完成=100% · 已完成） | — |
| t38 空态垂直居中 | computed style | ✅ 通过：`display:flex; align-items:center; justify-content:center; min-height:360px(45vh)` | — |
| t38 标签 title+说明 | DOM | ✅ 通过：chip title「点击搜索该标签 · 出现于 N 个文件」；小字说明「点击标签快速搜索…」在 | — |
| t38 解压弹窗文案 | 实测 zip 预览 | ✅ 通过：「下载压缩包」；上级按钮 btn-outline-primary；层级浏览 crumb 正常 | — |
| t38 PDF 兜底样式 | 服务页 CSS | ✅ 通过：.pdf-fallback 规则（虚线边框+琥珀底+图标）已在服务 HTML 中 | — |
| t39 打包树/任务卡中文 | 真实用户收藏打包实测 | ✅ 通过：预览树「计算机网络相关知识」「无经验Java岗位要点.docx」无乱码；mimo 确认 | — |
| t39 抽屉面板 | DOM 宽度测量 | ✅ 通过：列表宽 1200→1200 零变化（overlay 不挤压）、遮罩可关、侧栏 320px；mimo 目测存疑（见问题②） | — |
| 无回归（网格/中文目录/统计/深色变量） | 快检 | ✅ 通过：grid 中文目录 2 项、统计行正确、面包屑深层正确 | — |

## 问题项
1. 【低】t39 抽屉 mimo 目测与实测不一致：mimo 认为"列表被挤压、无遮罩"，但 DOM 实测列表宽度 1200→1200 零变化、遮罩 .show 存在（rgba(17,24,39,.45) 较淡）——以 DOM 实测为准，非缺陷。
2. 【低】t37 隐藏开关开启后持久化：后续页面/刷新仍显示隐藏文件（t37 设计如此——localStorage 记忆）；验证时注意开关状态，非缺陷。
3. 【提示】本任务期间发现 8443 原服务实例已停止（netstat 无监听），由本任务以最新代码重启（python server.py --serve auto --port 8443 --token transfer）；验证完成后服务保持运行，用户收藏项（2 项）与打包任务均已清理恢复原状。
4. 【提示】t39 的 CHANGES_UXB.md 在验证开始时尚未落盘（engineer 提交后已存在），内容为"两项均已被既有修复覆盖，无需改码"的核查结论——与本次实测一致。

## 验证环境与清理
- 测试夹具（_t40test：敏感文本/隐藏文件/中文目录/zip）已创建并完整清理；测试 pin/打包任务已取消，pinned 恢复为用户原始 2 项。
- 服务器（本任务启动实例）保持运行于 8443，token=transfer。

---
