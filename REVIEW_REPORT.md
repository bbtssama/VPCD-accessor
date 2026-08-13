# T5 审查复核报告（REVIEW_REPORT）

> 审查人：reviewer（netdisk-frontend-opt 团队）
> 复核范围：T2 视觉美化、T3 移动端适配、T4 代码质量优化的全部改动
> 复核对象：`server/templates/index.html`（566 行）、`static/app.js`（4021 行）、
> 基线：`FRONTEND_AUDIT.md`（审计报告），对照：`CHANGES_VISUAL.md` / `CHANGES_MOBILE.md` / `CHANGES_CODE.md`
> 复核方式：全量逐行阅读 + 技术验证（语法 / 标签闭合 / CSS 括号 / id 交叉引用 / 在线服务实测）

---

## 一、总体结论

**✅ 通过。三个实施任务（T2/T3/T4）的改动质量良好，与改动摘要一致，未发现功能回归。**

- 视觉（T2）：品牌色变量层、hover、深色模式、网格卡片、字体、键盘可达、toast/焦点、favicon 全部按摘要落地；
- 移动端（T3）：顶部安全区、overscroll 防下拉刷新、44px 触控统一、预览浮层降高、visualViewport 键盘避让、webkit-playsinline 全部生效；
- 代码质量（T4）：`buildShareModal` 工厂 + `openPreviewModal` 包装收敛重复样板，五个 P3 bug 修复到位，行为与摘要描述一致。
- 技术验证全绿：`node --check` 通过、HTML 非 void 标签开闭平衡、CSS 花括号平衡、app.js 引用的 56 个 id 全部可解析（51 个静态 id 均在 index.html 中，5 个为 JS 动态创建）。
- 在线服务实测：`http://127.0.0.1:8443/transfer` 返回 200，页面与 `static/app.js` 均与磁盘文件一致（CRLF 归一化后逐字节相等），**已部署的正是改动后的代码**（含本报告 4.1 的修复）。

**复核中发现 1 个深色模式布局回归（已直接修复）**，另有若干遗留项（审计 P1/P2 中不在 T2/T3/T4 范围内的项，见第五节）。

---

## 二、分项核验

### 2.1 视觉改动（T2）—— 符合预期

| 摘要声称 | 核验结果 |
|---|---|
| `:root` 完整 `--brand-*` 变量层 + `--bs-*` 语义映射 | ✅ 存在；`--bs-primary/success/info/warning/danger` 及 `-bg-subtle/-border-subtle/-text-emphasis` 全套映射；`--bs-progress-bar-bg`、`--bs-link-color` 两处默认蓝 #0d6efd 已归位品牌蓝 |
| 列表行 hover + transition，触屏无 sticky | ✅ `.list-group-item` 有 `transition` + `@media (hover: hover)` 包裹的 hover；全文件 8 处 `@media (hover: hover)` 包裹了 `.seg/.unpack-row/.vtag/.tag-chip/.grid-item/.star/.grid-star` 等所有 hover 规则 |
| prefers-color-scheme: dark 整层翻转 | ✅ 变量层完整；`bg-white`（navbar/card-header）、`btn-close`、hljs 15 组 token 均深色适配 |
| `.grid-item` 圆角 + hover shadow | ✅ `border-radius: 10px` + `box-shadow`（hover:hover 内） |
| 桌面 14.5px + Noto Sans SC | ✅ body 14.5px、字体栈与 `--bs-body-font-family` 同步 |
| `#pinnedHead` tabindex + Enter/Space + aria-expanded | ✅ index.html 有 `tabindex="0" role="button"`；app.js 有 `onkeydown`（Enter/Space → click）与 `renderPinned`/onclick 双向同步 aria-expanded |
| toast aria-live + :focus-visible 统一高亮 | ✅ `role="status" aria-live="polite"` 在 HTML 中；全局 `:focus-visible { outline: 2px solid var(--bs-primary) }` |
| favicon 内联 SVG | ✅ data URI 云盘图标，零额外请求 |

### 2.2 移动端改动（T3）—— 全部生效

| 摘要声称 | 核验结果 |
|---|---|
| navbar 顶部安全区 + body padding 联动 | ✅ `.navbar { padding-top: calc(.25rem + env(safe-area-inset-top)) !important }`；`body { padding-top: calc(58px + env(safe-area-inset-top)) }`；横屏左右安全区 `.navbar .container-fluid` 已加。桌面 env()=0 时与原有 58px/px-2 完全一致（无回归） |
| body `overscroll-behavior-y: contain` | ✅ 存在；`#driveTabs/#breadcrumb` 的横向 `overscroll-behavior-x: contain` 原样保留 |
| ≤575px `.video-preview img` 90→56px | ✅ `@media (max-width: 575.98px)` 内 `height: 56px` |
| type-chip/tag-chip 40→44px | ✅ `min-height: 44px`（面板内密集按钮 36px 的合理豁免保留） |
| visualViewport 键盘避让 | ✅ `if (window.visualViewport)` 保护；`innerHeight - vv.height > 60` 判定防抖动；侧边栏关闭即复位（清空 inline paddingBottom 回落样式表值）；监听 resize + scroll |
| video `webkit-playsinline` | ✅ `v.setAttribute("webkit-playsinline", "")`（与标准 `playsinline` 双保险） |

### 2.3 代码质量（T4）—— 行为一致

| 摘要声称 | 核验结果 |
|---|---|
| `buildShareModal` 工厂收敛三个分享弹窗 | ✅ 工厂实现完整（表单→生成中→失败重试/成功展示链接+打开/复制，clipboard + execCommand 降级）；`showShareDialog/showShareManyDialog/showSubShareDialog` 均 ~20 行配置式调用；`esc()` 统一处理 msg/note（`j.msg/j.note` 纯文本传入，无双重转义）；成功路径 `location.origin + j.url`、`window.open(fullUrl)`、`user-select:all` 均保留 |
| `openPreviewModal` 包装五个预览弹窗 | ✅ 统一 loading + 取消按钮 + 旧请求中断 + AbortError「已取消加载」/其它错误「加载失败: …」；`showLnk` 的**非 AbortError 继续渲染自定义错误 UI**（含"下载快捷方式本身"按钮）分支保留；`showText` 分片渲染 `cancelled()` 轮询中断保留；`showDetail/showUnpack/showCsv` 各自请求/渲染逻辑未动 |
| renderTask 内联 onclick 补 `esc(task_id)` | ✅ 两处（removeTask/copyDirectDl）已转义。注：服务端 `task_id = uuid.uuid4().hex[:12]`（server.py:3791，纯 hex），esc() 对真实数据是 no-op，行为零变化；该补丁属纵深防御 |
| toggleSkip 计数存按钮自身 | ✅ 展开成功回调写 `btn.dataset.skips`，收起时从按钮取值，不再出现「跳过 项」空计数 |
| previewDir 可再点收起 | ✅ 首次展开记录 `row.dataset.origSize`，收起时恢复原大小与 ▶；`btn.disabled` 防重复请求；轮询不重建预览树（`createPackPreview` 仅在 openPanel/toggleMini/clearPin 时调用），展开状态不被 1s 轮询冲掉 |
| init() 移到文件末尾 | ✅ `init();` 是文件最后一行；`CODE_EXT/iconOf/parseCsv/showCsv/showLnk/分享函数` 均在其前定义，TDZ 根治 |
| markdown 标题 6 级 | ✅ `/^(#{1,6})\s+/`（app.js:2031），h4~h6 走 `<hN class='md-h'>`；转义纪律不变 |
| 分类表统一（bat/svg） | ✅ `bat` 已在 CODE_EXT（code 图标）且 TEXT_EXT 含 bat（文本预览）；`svg` 在 TEXT_EXT 且 iconOf 返回 "text" —— 图标与预览行为一致 |
| fmtSize 守卫 | ✅ `Number.isFinite` + 负数保护，NaN/Infinity/负值返回空串 |

---

## 三、技术验证清单

| 验证项 | 结果 |
|---|---|
| `node --check static/app.js` | ✅ exit 0 |
| HTML 非 void 标签开闭平衡（div/span/li/button…） | ✅ 全平衡 |
| CSS 花括号深度（style 块内） | ✅ 0/0（平衡） |
| app.js `$("id")` 引用 vs index.html id（118 处、56 个唯一 id） | ✅ 51 个静态 id 全部存在；5 个（shareGen/shareOpen/shareCopy/shareUrl/lnkDlSelf）为 JS 动态创建，正确 |
| 服务在线实测（127.0.0.1:8443/transfer） | ✅ HTTP 200；页面/app.js 与磁盘一致（CRLF 归一化后逐字节相等）；**服务端已加载改动后的代码**（含本次 4.1 修复） |

---

## 四、发现的问题

### 4.1 【已修复】深色模式下 hover 与内嵌面不可见（T2 引入的回归）

- **位置**：index.html `@media (prefers-color-scheme: dark)` 内 `--bs-tertiary-bg: #1e293b`
- **问题**：深色模式下 `--brand-surface`（面板底）也是 `#1e293b`，且 `--bs-body-bg: var(--brand-surface)`。而列表行 hover（`.list-group-item:hover`）、面包屑 hover、`.grid-item:hover`、`.md-code/.text-pre/.md-table th` 内嵌面全部取 `var(--bs-tertiary-bg)` → **深色下 hover 背景与行背景同色，悬停反馈完全消失**；代码块/表格头背景与面板底同色，视觉分层消失。浅色模式无此问题（#e9edf2 vs #fff）。
- **修复**：深色 `--bs-tertiary-bg` 改为 `#334155`（明显浅于面板底 #1e293b，且与 `--bs-secondary-bg: #293548` 保持可区分——`pk-idle-track` 条纹动画依赖 secondary/tertiary 两色差异）。
- **验证**：CSS 括号平衡重验通过；在线页面已包含该修复（服务实测确认）。

### 4.2 文档小偏差（不处理，仅记录）

- CHANGES_CODE.md 声称 app.js 4017 行，实际 4021 行（4082 → 4021，净减 61）。差 4 行属计数口径（尾行/CRLF）差异，非功能问题。

---

## 五、回归风险点与遗留建议

### 回归风险（已评估，均在可控范围）

1. **深色模式整层变量翻转**是本次最大的样式面改动：已核对 `bg-white`（navbar/card-header）、`btn-close`、hljs、`.sidebar/.pack-panel/.type-chip/.tag-chip` 白底硬编码的 4 处翻转，未见遗漏；`--bs-body-bg` 经 `--brand-surface` 间接翻转，卡片/弹窗/列表底色一致。
2. **`esc()` 内联 onclick**：对当前服务端数据（uuid hex）为 no-op，行为不变；若未来 task_id 改为含引号格式，`esc()` 在 HTML 属性上下文不足以保护 JS 字符串——建议届时改用 `data-*` 属性 + `addEventListener`（审计 P3-1 的原建议），现风险为零。
3. **openPreviewModal 的 abort 监听**在加载完成后关闭弹窗时会把已渲染内容替换为「已取消加载」（modal 关闭动画期间不可见，无功能影响）；不影响刷新恢复（modalState 已清空）。纯观感，可选优化。
4. **导航栏安全区**：桌面 env()=0 时 body padding 仍为 58px、navbar padding 仍为 .25rem，与原布局一致；iPhone 刘海屏下内容与顶栏同步下移，验证通过。

### 遗留建议（审计 P1/P2 中不在 T2/T3/T4 范围内，建议后续任务处理）

1. **P1-1 loadList 无 try/catch**（app.js:3096）：服务重启窗口内请求失败会永久卡在「加载中…」。建议加错误分支 + 重试按钮。
2. **P1-2 目录切换请求竞态**：快速切换目录时旧响应可能覆盖新目录。建议 loadList 加单调递增请求序号/AbortController。
3. **P2-1 视频弹窗 Blob URL 泄漏**：`subVtt.url/asrVtt.url/strip.url`（app.js:1575/1638/1897）关闭弹窗后未 revoke（仅 lastMsUrl 与 strip 出错时 revoke）。建议在 stopMedia/关闭流程统一 revoke。
4. **P2-2 打包轮询 1s 常开 + 任务卡每秒整卡重建**（app.js:3335/3433）：无任务时应停止或降频；任务卡按状态 diff 单卡更新。
5. **P2-3 置顶星标 = 2 次全量请求 + 整目录重载**（app.js:3200 附近）：可改为本地更新 pinned + 局部重渲染。
6. **P2-4 标签扫描在侧边栏关闭时也执行**（app.js:3159 `_tagCache.delete(cur); startTagScan()`）：建议只在首次打开侧边栏时扫描。
7. **P2-5 大目录同步全量 DOM**：renderEntries 建议先上 DocumentFragment。
8. **P2-6 静态资源无版本缓存**（server.py:189）：静态 URL 加 `?v=` + max-age。
9. **P3 触屏 hover 残留**已由 T2 的 `@media (hover:hover)` 统一修复（非遗留）。

---

## 六、结论

- 三个任务全部按摘要落地，行为与功能零改动（id/接口/CSS 结构核对无异常）。
- 复核发现 1 处深色模式回归（hover/内嵌面不可见）——**已直接修复并验证**。
- 遗留 8 项审计 P1/P2 项均为「功能增强/性能优化」类，无新增回归风险，建议按审计报告优先级另行排期。
- **T5 审查复核：通过。**

---

*复核时间：2026-08-12；复核者：reviewer（netdisk-frontend-opt 团队）*
