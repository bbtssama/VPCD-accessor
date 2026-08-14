# CHANGES_SHARE_MODE.md — 分享模式重构（T35）

> 任务：t35（netdisk-frontend-opt 团队 / engineer）
> 用户反馈 /s/ 分享链接的四个问题，已全部重构并验证。

## 一、四个问题 → 修复对照

| # | 问题 | 修复 | 验证 |
|---|---|---|---|
| 1 | 路径/面包屑重复段 | renderBreadcrumb 两个 SHARE_MODE 分支（shareVirtual / shareRoot）改为只把**非末级段**渲染为可点击 seg，末级段仅由 .cur 渲染一次；分享页只显示分享根以下的相对层级 | E2E：进入子目录后面包屑末级段在 seg 中重复数 = 0；mimo 确认无重复 |
| 2 | 每行分享按钮冗余 | 移除 listItem 的 .share-btn 与 gridItem 的 .grid-share（HTML 与绑定全部删除） | E2E：DOM 中 .share-btn/.grid-share = 0；mimo 确认行内无分享按钮 |
| 3 | 分享模式禁长按多选 | ①bindLongPress start() 去掉 SHARE_MODE 限制；②enterBulkMode 去掉 SHARE_MODE 限制；③listItem/gridItem 统一绑定（分享模式同样 bindLongPress + bulk 点击拦截）；④批量栏分享模式态 syncBulkBarForMode()：隐藏 bulkPin/bulkUnpin/bulkPack，bulkShare 变「再分享」；⑤批量再分享 bulkReshare()：api/sharesub 逐项（与父分享同步过期），结果列表逐个复制；⑥操作面板 showFileActions 分享模式态：无收藏，分享=再分享（showSubShareDialog） | E2E：长按进多选、栏只显示 全选/再分享/下载/取消、批量再分享弹窗「已生成 N 个二次分享链接（与当前分享同步过期）」+复制按钮、批量下载正常、面板按钮 [下载,详情,再分享,✕取消] |
| 4 | 二次分享时间可被延长 | server.py sharesub：expires_at = min(请求过期, 父分享剩余)；父分享已过期时 403 拒绝（route 层 _share_expired 链式兜底 + 本处防御） | API 实测：sub_exp == parent_exp（无任何延长），sub <= parent |

## 二、改动文件

- **static/app.js**
  - renderBreadcrumb：两个 SHARE_MODE 分支末级段去重（slice(0,-1)）
  - listItem / gridItem：移除 share-btn / grid-share 标记与绑定；统一 bindLongPress + bulk 点击拦截（分享模式同样生效）
  - bindLongPress：start() 守卫去掉 SHARE_MODE
  - enterBulkMode：去掉 SHARE_MODE 守卫；新增 syncBulkBarForMode()（分享态隐藏 pin/unpin/pack + 按钮文案「再分享」）；toast 分享态文案
  - bulkShare：SHARE_MODE → bulkReshare()；新增 bulkReshare()（api/sharesub 逐项 + 结果列表复制 + 自动退出多选）
  - showFileActions：SHARE_MODE 态无收藏按钮、分享=再分享（showSubShareDialog）
- **server/server.py**：sharesub 时间钳制（min(请求, 父剩余) + 已过期拒绝）
- **server/templates/index.html**：无改动（批量栏按钮隐藏/文案由 JS 控制，行内按钮已从 JS 移除）

## 三、验证记录

- node --check ✅ / py_compile ✅（8443 生产已按流程重启，8123 测试同步）
- 8123 E2E（Playwright + 真实分享）：
  - 分享根/子目录面包屑：末级段重复 0
  - 行内分享按钮：0
  - 长按进多选 → 批量栏：pin/unpin/pack 隐藏，再分享/下载/全选/取消 可见
  - 批量再分享：生成列表 + 复制按钮 + 「与当前分享同步过期」提示；自动退出多选
  - 批量下载：文件项正常触发下载（目录项跳过）
  - 操作面板：分享模式 [下载, 详情, 再分享, ✕ 取消]（无收藏）
  - 后端钳制：sub_expires_at == parent_expires_at（相等，无法延长）；父过期 → 403
- mimo-v2.5-free 验收：面包屑无重复 / 批量栏仅 全选·再分享·下载·取消 / 行内无分享按钮 / 整体正常 ✅
- 主站回归：bulkTogglePin、bulkPack、主模式批量分享逻辑均在（served app.js 检查 + 门禁）

## 四、截图

- G:\自建agent专用工作区\DSH\_t8shots\t35_share_breadcrumb.png（子目录面包屑）
- G:\自建agent专用工作区\DSH\_t8shots\t35_share_bulkbar.png（分享模式批量栏）
