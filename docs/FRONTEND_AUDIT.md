# 前端体检报告（FRONTEND_AUDIT）

> 审计范围：server/templates/index.html（412 行，含内联 CSS）、static/app.js（4082 行）、static/cjk-normalize.js、static/icons/*.svg、Bootstrap 5.3.3 / highlight.js 11.9.0 离线资源、server.py 路由契约（对照前端 API 调用）。
> 审计方式：全量逐行阅读 + 语法校验（node --check 通过）+ 前后端 API 契约核对。
> 结论先行：整体代码质量**良好**——逃逸纪律严谨（XSS 面小）、移动端适配意识强（safe-area/dvh/44px 触控已铺开）、大目录渲染有分片/两阶段思路。问题集中在**健壮性（网络错误处理）**、**轮询与全量重渲染的性能**、**代码组织（单文件 4082 行）**三块。无 P0（崩溃级/安全级）问题。

---

## 一、潜在 Bug（P1 / P2 / P3）

### 🔴 P1-1：loadList 无 try/catch，网络失败时界面永久卡在“加载中…”
- **位置**：static/app.js:3088-3092（async function loadList → const data = await api("api/list?path=…&meta=1")）
- **问题**：api()（app.js:2209）只做 fetch + r.json()，不做错误归一。本服务自带“假死看门狗 + 30s 自动重启”（README §4），服务重启窗口内所有请求失败：loadList 直接 reject——fileRows 停留在“加载中…”，控制台出现 unhandled rejection；init() 里的 await switchDrive/loadList 也会中断初始化。对比同一文件里 showDetail/showText/showUnpack/showCsv/showLnk 都做了 try/catch，唯独 loadList 漏了。
- **建议**：给 loadList 包 try/catch：失败时 fileRows 显示错误 + “↻ 重试”按钮（复用 showAlert 模式，与 data.error 分支合并为同一错误 UI）。

### 🔴 P1-2：目录/磁盘快速切换存在请求竞态，旧响应可能覆盖新目录
- **位置**：app.js:3088 loadList（无请求序号 / AbortController）
- **问题**：switchDrive → loadList、面包屑点击、后退/前进可并发发起多个 api/list。meta=1 在大目录上响应慢，若先点 A 再点 B，A 的响应后到时会覆盖 B：cur = path（A）被写回、渲染 A 的内容但面包屑/导航栈对应 B，用户看到“目录对不上”。模糊匹配有 _fuzzyToken 防竞态，列表加载却没有。
- **建议**：loadList 加单调递增请求序号（或 AbortController 中止旧请求），响应回来时序号不是最新则丢弃；cur 赋值与渲染放到同一判定之后。

### 🟡 P2-1：视频弹窗泄漏 Blob URL（内存）
- **位置**：app.js:1548（subVtt）、:1611（asrVtt）、:1870（strip.url）
- **问题**：三个 URL.createObjectURL 只有 lastMsUrl（1426/1666/1737）和 strip 出错时（1878）被 revoke。每次打开一个带字幕/识别/进度条预览的视频，关闭弹窗后 Blob URL 及底层数据不释放；长时间使用（尤其手机 Safari）内存持续增长。
- **建议**：在 hidden.bs.modal 的 stopMedia 流程里统一 revoke subVtt.url / asrVtt.url / strip.url（showVideo 闭包内暴露清理函数，或把这些 URL 挂到 modal 状态上）。

### 🟡 P2-2：打包中心 1s 轮询常开 + 任务卡每秒整卡重建
- **位置**：app.js:3319-3321（startArchPolling → setInterval(pollArchives, 1000)）、:3415（renderTask）、:3301（renderArchPanel 整卡 innerHTML 重建）
- **问题**：非分享模式打开页面即开始**永久每秒**轮询 /api/archives，即使没有任何任务、面板从未打开（visibilitychange 只在页面隐藏时暂停）。每秒重建全部任务卡 DOM：展开的跳过清单被冲掉、滚动位置/焦点丢失、轮询与重建互相放大开销。
- **建议**：仅当（面板打开 或 存在活动任务）时轮询，无任务时降到 5s 或停止；任务卡按 task_id → 状态字段 diff，仅变化时重建单卡。

### 🟡 P2-3：置顶星标/清空操作 = 2 次全量请求 + 整目录重载
- **位置**：app.js:3195-3201（listItem star）、:3238-3246（gridItem star）、:3537（clearPin）
- **问题**：点一次星标 = api/pin + api/info（两次往返）再 loadList(cur)（第三次，重拉 meta=1 全量列表）。大目录下（数千文件 + meta JSON）每次置顶操作都白等一遍全目录刷新。
- **建议**：置顶/取消置顶后本地更新 pinned 数组 → renderPinned() + 仅重渲染受影响的列表行（切换 star class），不再整目录重载；api/info 改为直接用 /api/pin 的返回值（README 注明其返回最新 pinned 列表）。

### 🟡 P2-4：推荐标签扫描在侧边栏关闭时也执行
- **位置**：app.js:3130-3132（loadList 内 _tagCache.delete(cur); startTagScan();）
- **问题**：每次切目录都启动全目录 CJK bigram 扫描（每批 20 文件、批间 setTimeout(0)），即使侧边栏从未打开。万级文件目录首次浏览时主线程被长时间分批抢占，列表滚动卡顿；openSidebar 本来就会再调 startTagScan。
- **建议**：loadList 只失效缓存不扫描，真正扫描放 openSidebar（首次打开时）；或加“侧边栏未打开过则不扫描”的门槛。

### 🟡 P2-5：大目录同步全量 DOM 构建
- **位置**：app.js:2886-2905（renderEntries：list.forEach(e => rows.appendChild(...))）
- **问题**：5000+ 条目时一次性创建数万 DOM 节点，无 DocumentFragment 合并也无虚拟滚动，首渲染/每次搜索（150ms 防抖后）都同步卡顿。
- **建议**：短期先改 DocumentFragment 批量插入；中期对列表视图做“可见窗口虚拟化”（每屏固定行数 + padding 占位），网格视图可接受全量（条目数通常少）。

### 🟡 P2-6：静态资源每次刷新全量重拉（约 610KB）
- **位置**：server.py:189（_send_static 的 Cache-Control: no-cache）
- **问题**：no-cache 允许存储但每次都要带条件请求重验证；服务端未发 ETag/Last-Modified 时等价于每次全量下载 bootstrap(227KB)+highlight(119KB)+app.js(156KB)+cjk(28.5KB)。局域网内可接受，但经公网/手机流量访问时明显。
- **建议**：静态 URL 加版本参数（app.js?v=3），命中后 max-age=86400；或服务端补 ETag 支持 304。版本号随 VERSION 常量走。

### 🟢 P3（低优先，顺手修）
1. **内联 onclick 未转义/依赖全局**：app.js:3415+ 的 onclick="removeTask(''…'')"、copyDirectDl(''…'')、toggleSkip(this) 中 task_id 未 esc()（服务端生成的 uuid，风险低但应转义）；且内联 handler 依赖全局函数，与“IIFE/模块化”改造冲突——统一改 addEventListener + data- 属性。
2. **toggleSkip 折叠显示空计数**：app.js:3456-3462 收起时用 card.dataset.skips（仅展开拉取后才有），未展开过就收起显示“跳过 项”。建议收起时也从按钮文本/数据属性取值，或直接重新拉取。
3. **previewDir 不可再点收起**：app.js:3485 btn.textContent = was === "▶" ? "▼" : was，第二次点击仍是“▼”并重复请求。
4. **分类不一致**：iconOf("bat")→exe 图标、fileKind("bat")→文本预览；iconOf("svg")→image 图标、fileKind("svg")→文本预览（TEXT_EXT 含 svg）。图标与预览行为对不上，统一分类表。
5. **init() 调用位置在大量 const 声明之前**：app.js:3686 调用 init()，而 CODE_EXT（3689）、iconOf/iconUrl（3696/3705）、parseCsv/showCsv（3734/3766）等在其后。当前靠 init 内首个 await 让出事件循环才不触发 TDZ，属“侥幸正确”；任何把同步代码插到 init() 之前的重构都会炸。建议：常量/工具函数全部提到文件顶部，init() 调用移到最后一行。
6. **markdown 标题只支持到 ###**：app.js:2074 /^(#{1,3})\s+/，h4~h6 会按段落渲染——补到 6 级成本极低。
7. **driveTabs/面包屑滚动条隐藏无提示**：index.html:28-30 scrollbar-width:none——手机上不可见“可滑动”；可加首尾渐变遮罩或提示。
8. **.playwright-mcp/ 目录留在项目根**：两个 .log/.yml 是无关会话产物，建议加入 .gitignore。

---

## 二、视觉 / UI

### 🟡 P2（值得做）
1. **配色体系只覆盖了 primary**：index.html:12-14 仅覆写 --bs-primary。建议把品牌色做成完整 CSS 变量层（--brand-* + Bootstrap 语义映射），统一 btn-outline-secondary、badge、text-muted、progress 等散落颜色；当前蓝 #2563eb + 灰 #f3f4f6 的组合本身干净，克制升级即可。
2. **列表行无 hover/选中态**：.list-group-item 没有 :hover 背景（网格有），桌面端光标反馈弱；加 transition + hover bg（var(--bs-tertiary-bg)）。
3. **深色模式**：prefers-color-scheme: dark 一套变量即可，本应用颜色全部走 Bootstrap 变量，改造面小、收益大（夜间浏览网盘是高频场景）。
4. **置顶卡头部交互提示弱**：#pinnedHead（index.html:261）role="button" 但无键盘事件（Enter/Space），title 提示在触屏不生效；加 tabindex=0 + keydown，或改 <button>。
5. **toast 无 aria-live 与关闭按钮**：index.html:45-48 .app-toast——加 role="status" aria-live="polite"；长文案 toast（2.5s）可加点击关闭。
6. **focus 可见性**：Bootstrap 默认 focus ring 在浅色下偏弱；给 btn/chip/seg 统一 :focus-visible 高亮色（用 --bs-primary）。
7. **网格卡片层级**：.grid-item（index.html:106-119）hover 只有背景色，可加 box-shadow 提升 + 圆角，图标区与名称区间距再拉开一点。
8. **字体**：桌面 14px 偏小（移动端已 15px），建议桌面 14.5~15px 统一；字体栈（index.html:17）加 "Noto Sans SC" 作为可选中文字体。

### 🟢 P3
9. **favicon 为 data:, 空图标**（index.html:7，为规避 403 的设计，合理）——可放一个 16px 云盘 logo 内联 SVG，仍不会产生额外请求。
10. **emoji 图标跨平台渲染不一致**（☁⬆📦🔗★）：Windows/Android/iOS 观感各异；如追求一致性可换 15 个已有 SVG 风格的内联图标，非必须。
11. **.star hover 无反馈**：可加 scale(1.15) 过渡。

---

## 三、移动端适配（≤575.98px）

### ✅ 已做得好的（审计确认）
- viewport-fit=cover + 安全区：打包面板 max(12px, env(safe-area-inset-bottom))（index.html:186-187）、侧边栏底部（:168）、全屏 modal（:232）均已处理。
- 触控目标：主按钮 min-height:44px（:134-145）、行内星标/详情/分享 40×44（:144）、面包屑分段 40px；打包面板内密集按钮适度 36px 是合理取舍。
- dvh 降级（60vh/78vh/85vh + dvh）、touch-action: manipulation（:20）、-webkit-text-size-adjust（:25）齐全。
- 窄屏布局：置顶卡头部两行堆叠（:150-151）、打包中心 bottom-sheet 化（:219-232）、网格 88px 自适应列（320px 3 列）、工具栏图标化（HTML :279-282）都处理过。
- 打包面板矮屏压缩（max-height:640px → 28vh）、#packSummary 窄屏隐藏（:214）。

### 🟡 P2（补强）
1. **导航栏未适配顶部安全区**：navbar fixed-top（index.html:239）+ body padding-top:58px（:19）在 iPhone 横屏/刘海屏下内容会顶到刘海。建议 navbar 加 padding-top: env(safe-area-inset-top)，body 的 padding-top 同步用 calc(58px + env(safe-area-inset-top))。
2. **下拉刷新手势**：body 未设 overscroll-behavior-y，iOS 在文件列表顶部继续下拉会触发整页刷新、丢失当前目录/滚动位置。建议 body { overscroll-behavior-y: contain; }（保留 driveTabs/面包屑的横向 contain 不变）。
3. **进度条预览浮层在窄屏**：.video-preview img 固定 90px 高（index.html:98），竖屏手机上会盖住原生控制条；建议 ≤575px 时降为 56px 或仅在拖动时显示。
4. **type-chip/tag-chip 触控高度 40px < 44px**（index.html:145）——统一 44px 或明确 40px 是“次级控件”豁免并保持一致。
5. **搜索键盘遮挡**：侧边栏底部按钮（重置）在 iOS 键盘弹出时可能被遮挡——sidebar-body 已有滚动，建议确认 visualViewport 场景或给 sidebar-foot 加键盘避让。

### 🟢 P3
6. **hover 残留**：.grid-item:hover、.tag-chip:hover 等在触屏点按后 sticky；用 @media (hover: hover) 包裹桌面 hover 样式。
7. **video 全屏体验**：<video controls playsinline> 未用 webkit-playsinline 兼容老 iOS；可加。

---

## 四、代码质量

### 🟡 P2
1. **单文件 4082 行**：功能边界其实清晰（列表/搜索/播放器/预览/打包/分享），建议至少拆成 3~4 个模块（如 fuzzy.js / player.js / previews.js / pack.js + 主入口），用 <script type="module"> 或经典多文件 + 命名空间。**小步进行，保持行为不变**（对应 T4 目标）。
2. **三个分享弹窗大段复制**：showShareDialog（:3895）/ showShareManyDialog（:3993）/ showSubShareDialog（:4061）的“生成中…/失败重试/复制链接（含 execCommand 降级）”逻辑重复三份——抽 buildShareModal({title, genUrl, extra}) 公共工厂。
3. **五个预览弹窗的 loading+abort 样板重复**：showDetail/showText/showUnpack/showCsv/showLnk 都以 loadingNodeCancel + AbortController + _activePreviewAbort + 错误分支开头——抽 openPreviewModal(title, state, loader) 包装，能删掉约 80 行重复。
4. **全局作用域**：所有 const/function 挂 window；配合内联 onclick 形成隐式全局依赖。建议整文件包 IIFE/模块 + 事件绑定集中化（与 P3-1 一并解决）。
5. **“功能 N”注释编号重复**：功能 2（视频 / localStorage）、功能 4（解压 / CSV / PDF）、功能 9（分享）各出现两次——重排为连续编号或改按模块名注释。
6. **CSS 内联在 HTML 里已达 400+ 行**：index.html <style> 与 app.js 动态 class 分处两处（T2/T3 的配合难点）。建议把 <style> 原样迁到 static/app.css（内容零改动、回归风险最低），后续维护/版本缓存都更容易。
7. **常量集中**：44px/575.98px/400KB/300KB/2000 行/5000 条/120s/2s/80ms/160px 等魔数已多数带注释，建议提为文件顶部常量表（部分已是：FUZZY_BATCH/TAG_BATCH 等）。
8. **无 lint/格式化/单测**：fuzzy 匹配核心是纯函数（fuzzyScore/fuzzyMatchKw 等），README 也说“可 node 单测”但仓库没有测试文件——补一个 tests/fuzzy.test.mjs 把验收断言（猫狗/狗猫、约里.mp4 vs 里约 等）固化下来，防止后续重构回归。

### 🟢 P3
9. **init 首屏加载两个目录**：app.js:2277-2280 switchDrive(savedRoot) 后再 loadList(savedCur)——可合并为直接 loadList(savedCur)（前提已校验 roots 归属）。
10. **highlight.min.js 118KB 全语言包**：项目内代码预览多为常见语言，可用 common 子集减到约 30KB。
11. **strBytes 的 try/catch 退化路径**（app.js:886）——TextEncoder 现代浏览器必在，可简化。
12. **fmtSize 无负数/NaN 保护**——极端数据下显示异常，加 Number.isFinite 守卫。

---

## 五、性能

| 问题 | 位置 | 建议 | 级别 |
|---|---|---|---|
| 打包轮询 1s 常开 | app.js:3321 | 有活动任务或面板打开才轮询 | P2 |
| 大目录同步全量 DOM | app.js:2897-2900 | DocumentFragment + 虚拟滚动 | P2 |
| 置顶/清空触发整目录重载 | app.js:3200/3245/3537 | 本地增量更新 | P2 |
| 任务卡每秒整卡重建 | app.js:3415 | 状态 diff 单卡更新 | P2 |
| 静态资源无版本缓存 | server.py:189 | ?v= + max-age / ETag | P2 |
| 上传串行逐个 | app.js:3590-3606 | 2~3 并发（后端无分块则保持） | P2 |
| 搜索逐条目重复 CJK 归一化 | app.js:2665/2957 | entry 级缓存归一化文本 | P3 |
| _tagCache 无上限 | app.js:2548 | 按目录 LRU/上限 | P3 |
| grid 视频封面逐项 /api/thumb | app.js:3268 | 已 lazy ✓；IntersectionObserver 更精细 | P3 |

**一个亮点**：大文本分片渲染（fillTextChunked，app.js:1027-1050）、模糊匹配分片（FUZZY_BATCH=30 + 令牌打断）、标签扫描分批（TAG_BATCH=20）——“让出主线程 + 可打断”的模式已经系统性地用对了地方，值得保留并在 T4 中沿用。

---

## 六、可访问性（汇总）

- ✅ 颜色对比：text-muted(#6c757d) 在 #fff 上约 4.6:1 达标；品牌蓝 #2563eb 于白底约 5.2:1。
- ❌ .app-toast 无 aria-live（状态变更读屏不播报）——P2。
- ❌ 侧边栏打开无焦点移入/焦点陷阱，键盘用户可 Tab 进屏外控件（transform 移出的 sidebar 仍可聚焦）——P2。
- ❌ #pinnedHead 非键盘可达（见 UI-P2-4）。
- ❌ 无 prefers-reduced-motion（pulse 动画/侧滑过渡对前庭敏感用户）——P3。
- ✅ 弹窗标题/关闭按钮有 aria 属性；图标按钮普遍有 title（建议补 aria-label 双保险）。

---

## 七、安全

- ✅ **XSS 逃逸纪律整体优秀**：文件名全部 textContent 注入或 esc() 后再进 innerHTML；markdown 渲染“先整体转义再套格式”（app.js:2030-2050）、链接协议白名单（https?/mailto/#/相对路径）；分享/详情/预览错误信息均 esc()。
- ⚠️ 唯一注意点：renderTask 内联 onclick 的 task_id 未转义（见 P3-1），建议补 esc()。
- ℹ️ 无 CSP（内联 style/script 较多），局域网自签场景可接受；若未来暴露公网建议评估。
- ✅ rel="noopener" 已用；localStorage 读写全部 try/catch（禁用场景降级）。

---

## 八、修复优先级建议

1. **先修 P1**（工作量 < 1 小时）：loadList 容错 + 请求竞态——直接决定服务重启/慢网场景下可用性。
2. **再修 P2 中“零回归风险”项**：Blob URL 泄漏、轮询收敛、置顶本地增量、tag 扫描懒启动、esc(task_id)、DocumentFragment。
3. **视觉/移动端 P2 中选做**：导航栏安全区、overscroll 防下拉刷新、列表 hover、深色模式（变量化后成本低）。
4. **T4 代码质量**：按“抽公共函数 → 拆模块 → 补单测”顺序小步推进，每步保持行为一致；node --check 作为每次改动的门禁。

---

*审计时间：2026-08-12；审计者：auditor（netdisk-frontend-opt 团队）*
