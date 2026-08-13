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
