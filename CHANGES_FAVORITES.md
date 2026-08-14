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
