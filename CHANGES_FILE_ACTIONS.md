# T20 未知类型文件操作面板 · 改动摘要（CHANGES_FILE_ACTIONS）

> 任务：t20（netdisk-frontend-opt 团队 engineer）
> 用户反馈：点击某些文件（exe/iso/docx/xlsx/dll 等）直接触发下载，体验突兀；希望弹操作面板
> 改动文件：`static/app.js`（bindRowAction else 分支 + 新增 showFileActions）
> 原则：有预览类型的文件仍走预览（主路径零破坏）；仅 "other" 类型改弹面板；长按多选兼容；node --check 门禁

## 一、实现
1. **bindRowAction else 分支改造**：fileKind === "other" 的文件不再直接下载（移除 list 的 <a> 包裹 / grid 的 location.href），统一 `el.onclick = () => showFileActions(e)`。
2. **新增 `showFileActions(e)`**（复用 appModal 操作面板）：
   - 头部：文件类型图标（inline SVG 40px，currentColor 随主题）+ 文件名（截断）+ **类型/大小**（"类型: XYZ · 16 B"）。
   - 操作按钮：
     - **⬇ 下载**（主按钮 btn-primary w-100）
     - **ⓘ 详情**（showDetail）、**🔗 分享**（showShareDialog）、**⭐ 收藏**（api/pin add=1 → 返回值同步 pinned → renderPinned → toast"已收藏" → 关面板）、**✕ 取消**（closeModal）——outline 等宽排列。
3. **与长按多选兼容**：多选模式下行点击走勾选（capture 拦截优先于 bindRowAction），面板只在非多选时触发；面板按钮位于 modal 内不受行 capture 影响。
4. **深色/移动端**：面板走 appModal（全屏弹窗已有）；图标 currentColor；按钮移动端 min-height 44px（.btn 全局规则）。

## 二、验证（真实环境全 PASS）
- `node --check` 通过；CSS 平衡 0（无 CSS 改动）。
- **E2E（playwright + 造 .xyz 测试文件）**：
  1. 点击 .xyz（other）→ **操作面板弹出（不直接下载）** ✓
  2. 面板显示 类型: XYZ · 16 B ✓
  3. 收藏按钮 → 收藏成功（徽标 1）+ 面板关闭 ✓
  4. 详情按钮 → 详情表 ✓
  5. 多选模式点行 = 勾选（不弹面板）✓
  - 无 JS 报错。
- **mimo 视觉验收**：面板信息清晰（文件名/类型/大小）、下载按钮突出、其余操作整齐、简洁明了 ✓。

## 三、回归面
- 有预览类型（video/image/text/pdf/csv/archive/lnk/markdown）点击行为不变。
- 详情/分享/收藏复用现有函数（showDetail/showShareDialog/api/pin + renderPinned），无重复实现。
- 截图：G:\自建agent专用工作区\DSH\_t8shots\t20_01_actions.png
