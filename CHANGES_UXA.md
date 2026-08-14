# T38 P3 视觉细节批次A · 改动摘要（CHANGES_UXA）

> 任务：t38（netdisk-frontend-opt 团队 feature-engineer；UX_REPORT §4 P3 多条轻量建议）
> 改动文件：`static/app.js`、`server/templates/index.html`
> 原则：node --check 门禁；HTML id 不变（未改任何现有 id）；深浅色/移动适配；零功能破坏。

## 逐项
1. **面包屑 Windows 风格（P3-2）**：主模式段间分隔符由 "/" 改为 "\\"（视觉像 C: \\ Users 路径）；盘符段（i=0，rootOf 精确匹配）加 `.drive` 类，CSS 用 `--bs-primary` 加色；盘根时当前段 `.cur` 也加 `drive` 类；各段仍可点击回对应层；SHARE_MODE 两个分支完全不动。
2. **悬浮球收藏提示（P3-3）**：`#pinFab` 已有 title="收藏"（无需改）；新增 CSS：hover 时球左侧淡入淡出显示"收藏"小标签（`@media (hover:hover)` 内 `::after`，触屏无 hover 不显示；深色底标签双主题可见）。
3. **打包进度文案（P3-4）**：迷你条由 `99% · 完成 0/1`（百分比与完成数矛盾）改为百分比为主 + 明细「已完成 x/y」，全部完成时显示 `100% · 已完成`；头部芯片同步为「已完成 x/y」（全完成显示「已完成」）。计数逻辑核查：done=state==="done" 计数、total=任务数均正确，矛盾源于 0.99 封顶百分比与完成数并列，纯文案修复。
4. **空状态布局（P3-6）**：主列表空态（#fileRows > .empty）加 `min-height: 45vh`，配合已有 flex 图标+文案整体垂直居中，留白呼吸感（不作用于侧边栏/收藏面板内空态；深色走 --bs-* 变量）。
5. **推荐标签提示（P3-5）**：chip 的 title 统一为「点击搜索该标签 · 出现于 N 个文件」；标签区加一行小字「点击标签快速搜索 · 标签来自当前目录文件名与元数据」（纯说明，不筛选用户数据，不动 tagApplyTag 搜索逻辑）。
6. **预览弹窗细节（P3-8）**：PDF 兜底提示由裸小字改为 `.pdf-fallback` 醒目提示块（虚线边框 + 浅琥珀底 + 图标 + 主色链接，深浅色自适应）；「下载压缩包本身」→「下载压缩包」；「上级」按钮由 `btn-outline-secondary` 改为 `btn-outline-primary`（描边+back 图标更醒目）。

## 验证
- node --check 通过；CSS 括号平衡 356/356；
- 面包屑渲染逻辑单测 4/4 PASS（盘根 cur:drive、子目录 seg:drive + 反斜杠分隔 + 各层 cur/seg 正确、D 盘子目录）；
- HTML 现有 id 零改动；深色/移动适配走既有 --bs-* 变量体系。
