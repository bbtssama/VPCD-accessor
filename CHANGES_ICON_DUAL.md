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
