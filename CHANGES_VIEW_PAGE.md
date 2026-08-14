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
