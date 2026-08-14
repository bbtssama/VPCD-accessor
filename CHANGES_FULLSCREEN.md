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
