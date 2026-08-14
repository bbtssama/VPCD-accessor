# T9 星标闪烁修复 + 长按多选交互 · 改动摘要（CHANGES_STAR_FIX）

> 任务：t9（netdisk-frontend-opt 团队 engineer）
> 改动文件：`static/app.js`（主要）、`server/templates/index.html`（批量栏 HTML + 多选 CSS）
> 原则：功能主路径零破坏、HTML id 不变、移动端 44px 触控保留、深色模式同步、node --check 门禁

## 一、Bug 修复：星标闪烁 + 跳回顶部
根因：listItem/gridItem 的 star.onclick 置顶后 ①api/pin → ②api/info 二次请求 → ③renderPinned → ④loadList(cur) 整目录重载 → 列表 DOM 重建"闪烁" + 滚动位置丢失回顶（审计 P2-3）。

修复：
1. **批量置顶/取消置顶**（bulkTogglePin）：逐项 `api/pin`，**直接用返回值更新 pinned**（后端返回最新列表，不再二次 `api/info`），操作后 `renderPinned()` 同步置顶卡，**不调 loadList(cur)** → 无闪烁、滚动位置保留。
2. **置顶卡 unpin 按钮 / 清空置顶按钮**：同样去掉 `loadList(cur)`（列表行已无常驻星标，无需重载）。

## 二、设计升级：长按多选模式
1. **移除常驻五角星**：listItem/gridItem 不再渲染 star/grid-star（界面更干净）；置顶改为批量操作。
2. **长按进入多选**（bindLongPress）：
   - 桌面 `mousedown` 按住 500ms / 移动 `touchstart` 500ms（`touchmove` 取消，不冲突滚动）；
   - 长按有视觉反馈：按压背景变深（`.press-active`）+ 触觉震动（`navigator.vibrate(30)`，支持时）；
   - 长按即选中该行；长按后的 click 被吞掉（700ms 内 capture 拦截），避免误开文件。
3. **多选模式**：
   - 每行显示 checkbox（`.bulk-cb`，CSS 控制显隐）；点行任意处勾选/取消；
   - 顶部批量操作栏（`#bulkBar`，品牌浅蓝底）：已选计数、**全选/取消全选、置顶、取消置顶、分享、下载、打包、取消**；
   - 选中行整行浅蓝高亮（`.selected`）；
   - Esc / 切目录 / 搜索重建 / 取消按钮 均退出多选。
4. **批量操作**（均本地同步、不重载）：
   - 置顶/取消置顶：逐项 `api/pin` + 返回值同步 pinned + renderPinned；
   - 分享：`api/share?paths=…` 复用 t4 的 buildShareModal 工厂（有效期 radio + 复制链接）；
   - 下载：逐个触发（目录跳过）；
   - 打包：直接 `api/archive` POST 选中 paths（不依赖 pinned）。
5. **SHARE_MODE**：无置顶/多选，保持原交互（分享按钮、二次分享）不变。

## 三、验证
- `node --check static/app.js` 通过（exit 0）。
- **playwright 真机交互测试 6 项全 PASS**（起真实服务 + Chromium 模拟）：
  1. 短按（150ms）不进入多选、正常打开 ✓
  2. 长按 650ms 进入多选（checkbox 显示、长按行自动选中、计数"已选 1 项"）✓
  3. 多选模式点行勾选第二行（2 项）✓
  4. 全选（6/6）✓
  5. 取消退出多选 ✓
  6. 批量置顶 2 项成功（pinCount 2、置顶卡 2 行、无整目录重载）✓
  - 全程无 JS 报错。
- **mimo-v2.5-free 视觉验收**（多选模式截图）：批量操作栏清晰、checkbox 显示、选中行浅蓝高亮、界面简洁 ✓。
- 截图存档：`G:\自建agent专用工作区\DSH\_t8shots\shot_bulk.png`。

## 四、回归面
- 常驻星标移除：`.star/.grid-star` CSS 规则保留为死代码（无引用，未清理避免误伤）；`isPinned` 保留。
- 列表行点击主路径不变（bindRowAction 未动）；详情/分享按钮行为不变。
- 移动端 44px 触控、深色模式（selected 用 `--bs-primary-bg-subtle` 自动适配）不受影响。
