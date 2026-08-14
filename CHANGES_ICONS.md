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
