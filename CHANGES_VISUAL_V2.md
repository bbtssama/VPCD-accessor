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
