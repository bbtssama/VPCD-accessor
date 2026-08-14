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
