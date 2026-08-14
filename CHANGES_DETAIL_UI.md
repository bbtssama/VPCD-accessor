# T21 详情入口重构 · 改动摘要（CHANGES_DETAIL_UI）

> 任务：t21（netdisk-frontend-opt 团队 engineer）
> 用户反馈：每行右上角 ⓘ 详情按钮很丑，不想要这么小的按钮；但要兼顾移动端与详情功能不丢
> 改动文件：`static/app.js`（移除 info-btn/grid-info + addFsButton 加详情按钮 + 预览弹窗详情入口）
> 原则：与 t20 统一操作面板体系；详情功能从面板/预览弹窗进入；分享模式行尾分享按钮保留；node --check 门禁

## 一、实现
1. **移除列表行 info-btn ⓘ**（listItem）：不再渲染 ⓘ 详情小按钮（含绑定）。
2. **移除网格卡 grid-info ⓘ**（gridItem）：同样移除。
3. **预览弹窗内详情入口**：`addFsButton` 增加 `detailPath` 参数——预览弹窗顶部操作行（⛶ 放大旁）显示 **ⓘ 详情**按钮（点击 `showDetail`）：
   showVideo / showText / showUnpack / showCsv / showPdf / showImage / showLnk 全部接入；showDetail 自身不加（本身就是详情）。
4. **详情入口汇总**（不再每行常驻）：
   - 有预览类型文件：点文件名 → 预览弹窗（内含 ⓘ 详情 + ⛶ 放大 + 下载）
   - 未知类型文件（other）：点文件名 → t20 操作面板（内含 详情/下载/分享/收藏）
   - 目录/收藏面板/分享模式行为不变；分享模式行尾分享按钮保留（SHARE_MODE 分支未动）。
5. **移动端**：面板/预览弹窗按钮走 .btn/.btn-sm 全局规则（min-height 44px）；详情为弹窗内大按钮，易点。

## 二、验证（真实环境全 PASS）
- `node --check`。
- **E2E（playwright）**：
  1. 列表行无 ⓘ 按钮 ✓
  2. 网格卡无 ⓘ 按钮 ✓
  3. 文本预览弹窗有"详情"按钮 → 点击进入详情表（showDetail）✓
  4. 无 JS 报错 ✓
- **mimo 视觉验收**：行尾无 ⓘ 更干净、行布局协调、整体简洁现代 ✓。
- 截图：G:\自建agent专用工作区\DSH\_t8shots\t21_01_list.png / t21_02_preview_detail.png

## 三、回归面
- showDetail 保留（从面板/预览弹窗进入）；t20 操作面板的详情按钮不受影响。
- 预览弹窗原有按钮（下载/⛶ 放大）不变；分享模式（SHARE_MODE）行为不变。
- 移动端触控（44px）与深色模式（currentColor 图标）无需额外适配。
