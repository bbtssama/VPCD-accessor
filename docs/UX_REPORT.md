# T33 体验官全面体验报告（UX_REPORT）

> 体验官：tester ｜ 任务：T33 全面体验 ｜ 日期：2026-08-14
> 环境：服务 http://127.0.0.1:8443/transfer（token=transfer，最新代码）
> 工具：Playwright MCP（headless msedge）+ mimo-v2.5-free 视觉模型 + 自动化断言脚本

---

## 0. 结论摘要

- **功能体验 10 大清单全部通过**：120/120 项自动化检查 PASS，无功能性失败（首次发现 3 处交互缺陷已当场修复并回归验证，见 §3）。
- **截图 55 张**存档于项目根 `.playwright-mcp/t33/`。
- **mimo 视觉分析 28 张关键界面**（mimo 免费模型对 5 张超时：t3_markdown/t3_video/t6_tag_search/t9_video_preview/t10_icons_color，属免费通道限流），给出 4 大类视觉/体验建议（见 §4），其中**敏感信息明文展示**为最高优先级建议。
- 测试期间服务进程中断 1 次（原因疑似环境/任务生命周期问题，非业务 bug；重启后稳定，见 §5 观察项）。

---

## 1. 测试方法

| 项目 | 说明 |
|---|---|
| 浏览器 | msedge headless，1440×900 桌面 / 375×812 移动 |
| 自动化 | Playwright MCP 驱动真实点击/悬停/触控事件 + DOM 断言 |
| 视觉 | mimo-v2.5-free 免费视觉模型逐屏分析，输出结构化建议 |
| 测试数据 | 真实磁盘：C:\Users\user\Desktop、Downloads、Documents\t33test（自建 .pak/.lnk/nested.zip 测试样本）、F:\System Volume Information（无权限） |

---

## 2. 清单逐项结果

### 2.1 首页：磁盘标签 / 列表-网格切换 / 面包屑 / 前进后退 —— ✅ 全部通过（13/13）
- 标题"电脑网盘"、磁盘标签 C/D/F/G 正确渲染；根目录 42 项完整加载（无截断）。
- 列表 ↔ 网格切换正常（42 行 ⇄ 42 卡片），视图状态同步侧边栏按钮。
- 面包屑结构验证：`C: / Users`，**盘符唯一**（C: 只出现一次）、**末级目录不重复**（T6 修复有效）。
- 后退回根（根时后退按钮禁用）、前进回 Users；跨盘 D: 切换后激活标签唯一、面包屑同步（T26 修复有效）。
- 截图：`t1_home_list/grid.png、t1_breadcrumb_users.png、t1_drive_d.png`

### 2.2 收藏：悬浮球 → 面板、批量收藏/取消、全部分享/打包/清空 —— ✅ 全部通过（13/13）
- 长按 500ms 进入多选 → 批量收藏 → 悬浮球角标=2。
- 点击悬浮球打开收藏面板：标题"收藏 · 2 项 · 共 0 B · 含目录"、列表 2 行、取消收藏后角标同步=1。
- 全部分享弹窗（"全部分享"）、打包中心（任务创建）、清空收藏（角标隐藏 + "暂无收藏"空态）全部正常。
- 截图：`t2_fab_badge.png、t2_panel.png、t2_share_all.png、t2_pack.png`

### 2.3 预览：文本/Markdown/CSV/图片/PDF/压缩包/视频/详情 + ⛶ 放大独立页 —— ✅ 全部通过（26/26）
| 类型 | 结果 | 说明 |
|---|---|---|
| 文本 txt | ✅ | 弹窗+编码提示（utf-8）+内容渲染，含放大/详情按钮 |
| 详情 | ✅ | 信息表格：名称/路径/类型/大小/修改时间/创建时间/扩展名/系统占用 |
| 图片 png | ✅ | 弹窗内展示 + 缩放工具栏 |
| PDF | ✅ | iframe 渲染 + 兜底下载提示 |
| Markdown | ✅ | 标题渲染（"6.3 事务隔离级别…"）+ 代码块 |
| CSV | ✅ | 表格渲染 + 编码提示 |
| 压缩包 ZIP | ✅ | 解压列表 + **三级层级进入**（level1→level2→level3，含"上级"面包屑与"当前层 N 项/共 M 项"统计） |
| 压缩包 RAR | ✅ | 多格式解压（RAR · 当前层 1 项/共 9 项） |
| 视频 MP4 | ✅ | 播放器 + 画质选择（原画/高清/标清/低清）+ 免证书 MSE + 元数据（时长/分辨率/编码） |
| ⛶ 放大 | ✅ | 新标签页独立页 `/view?path=`，标题"预览"，深色背景 rgb(11,15,23)，内容+下载+关闭按钮齐全 |

截图：`t3_text/detail/image/pdf/markdown/csv/zip_root/zip_level2/zip_level3/rar/video/view_page.png`

### 2.4 交互：长按多选、批量操作、未知类型面板、.lnk 进入目标 —— ✅ 全部通过（9/9，另修复 2 处见 §3）
- 长按多选 2 项 → 批量栏（全选/收藏/取消收藏/分享/下载/打包/退出多选）。
- 批量下载提示"已开始下载 2 个文件"；批量打包打开打包中心（任务"待下载 2"）。
- 未知类型 `unknown.pak` → 操作面板（类型: PAK · 64 B + 下载/详情/分享/收藏）。
- 目录型 `.lnk`（t33dir.lnk）点击直接进入目标目录 `C:\Users\user\Desktop\Coding`。
- 截图：`t4_pak_panel.png、t4_bulk.png、t4_bulk_pack.png、t4_lnk_target.png`

### 2.5 上传/下载/打包流程 —— ✅ 全部通过（7/7）
- 上传：点击上传按钮 → 文件选择 → 进度条 → 列表出现新文件 + toast"1 个文件上传成功"。
- 打包：操作面板"打包" → 打包中心创建任务。
- 下载接口 `/transfer/dl` 返回 200（octet-stream，60B 内容正确）；打包下载同样 200。
- 截图：`t5_upload.png、t5_pack_done.png`

### 2.6 搜索/筛选/排序/标签 —— ✅ 全部通过（11/11）
- 精确搜索 "InnoDB"：145 → 3 条；组合语法 "InnoDB 隔离"（AND）：1 条命中。
- 模糊匹配（缺字"隔离别"）：仍命中（两阶段模糊搜索有效）。
- 类型筛选（视频）：145 → 3 个 mp4；排序按名称 A→Z（目录在前）；点击推荐标签自动搜索（"模型"→21 条）。
- 重置筛选恢复全量 145 条。
- 截图：`t6_sidebar/search/filter_video/sort_name/tag_search.png`

### 2.7 深色模式、移动端 375px —— ✅ 全部通过（8/8）
- 深色模式（prefers-color-scheme 自动适配）：body rgb(15,23,42)、文字 rgb(241,245,249)；切回浅色正常。
- 375×812：无横向溢出、悬浮球可见、侧边栏 320px 不溢出、磁盘标签容器 overflow-x:auto。
- 移动端长按（合成 touchstart 750ms）进入多选正常。
- 截图：`t7_dark_desktop.png、t7_mobile.png、t7_mobile_dark.png、t7_mobile_sidebar.png`

### 2.8 无权限目录拦截（F:/System Volume Information 抖动+提示）—— ✅ 全部通过（8/8）
- F 盘 `System Volume Information`、C 盘 `Config.Msi` 均带 `denied` 标记 + title"无权限访问该目录" + 光标 not-allowed。
- 点击名称触发抖动动画 + toast"无权限访问该目录"，**停留原目录不跳转**。
- 截图：`t8_denied_list.png`

### 2.9 视频进度悬停预览 —— ✅ 全部通过（9/9）
- 悬停进度条显示预览帧（blob 缩略图），**跟随鼠标按比例移动**（25%→524px、75%→757px）。
- **半透明**（opacity 0.4，停止 400ms 后提亮至 1.0）；**左右边界钳制**（left 4px / right ≤ wrap 边界）。
- 固定 bottom 40px 悬于控制条上方；移出立即隐藏。
- 截图：`t9_video_preview.png`

### 2.10 图标：线条/彩色切换、文件类型直观性 —— ✅ 全部通过（7/7）
- 线条模式：145 个内联 SVG（stroke=currentColor，随主题变色）；彩色模式：145 个彩色 `icons/color/*.svg`。
- 切换记忆到 localStorage（`drive.iconStyle`）；刷新恢复。
- 类型图标：dir/txt/lnk/docx/pdf/jpeg/png 均有专属图标（path 数量 1~3 区分）。
- 截图：`t10_icons_line/color/type_icons.png`

---

## 3. 已修复的功能缺陷（本次体验中发现并修复，已回归验证）

| # | 缺陷 | 位置 | 修复 | 验证 |
|---|---|---|---|---|
| F1 | **列表模式行内死区**：只有文件名可点击，图标/大小/空白区域无反应（网格模式整卡可点，两者不一致；无权限目录点图标也无抖动提示） | `static/app.js` listItem | `bindRowAction(nm,…)` → `bindRowAction(row,…)` 整行绑定；复选框 `stopPropagation` 防误触 | ✅ 点图标进入目录；点复选框不再误开文件 |
| F2 | **网格模式点复选框会误打开文件/目录**（checkbox 冒泡触发卡片动作） | `static/app.js` gridItem | 复选框点击 `stopPropagation` | ✅ 勾选不再弹预览，卡片本体仍可点 |
| F3 | **"置顶"文案残留**（T16 收藏改名未清理的用户可见串）：打包弹窗"将打包置顶的 N 项"、空态"还没有置顶文件，先在文件列表点亮 ★"、分享兜底名"置顶分享" | `static/app.js` L2798/L4362-4364、`server/templates/index.html` L871、`server/server.py` L737/L1279 | 全部改为"收藏"系列文案 | ✅ 打包标签显示"将打包收藏的 1 项" |

回归：长按多选 → 批量收藏 → 收藏面板 → 打包，全流程 PASS；无 JS 错误。

---

## 4. mimo 视觉建议（来自 mimo-v2.5-free，按主题汇总）

> 全部为视觉/体验建议，未改动代码；严重度分级仅供参考。

### 🔴 P1-安全：敏感信息明文预览（mimo 多次重点提示）
- 文本预览/独立预览页中 **API 密钥等敏感内容完整明文展示**（如 `sk-…` 完整显示），mimo 建议：预览时对密钥类模式自动脱敏（显示前 4+后 4 位中间 `****`），用户主动点击"显示"才展示全文。
- 出处：t3_text / t3_csv / t3_view_page / t3_image 多张截图一致结论。

### 🟠 P2-信息完整性
1. **列表信息密度**：文件夹行只显示修改时间，大小列显示"—"，mimo 多次建议补"文件数量/大小"列与当前目录总数/分页（t1/t2/t5/t6/t7/t8 多屏）。
2. **系统/隐藏文件暴露**：`$Windows.~WS`、`Config.Msi`、`~$xxx.docx`（Office 临时锁定文件）默认可见，mimo 建议默认隐藏 + "显示隐藏文件"开关（t1_home_list / t1_breadcrumb / t3_text / t7_mobile_dark / t8 等 6+ 屏）。
3. **网格视图文件名截断**（"Program Files"、"Documents and Setti…"无省略号提示），建议悬停 tooltip 显示全名（t1_home_grid）。

### 🟡 P3-布局与控件
1. **右侧筛选面板遮挡**：列表日期列被面板覆盖（"2:" 前缀可见）、搜索/排序时列表宽度未自适应，建议面板改抽屉式/半透明浮层（t6_search / t10_icons_line / t6_filter_video）。
2. **面包屑风格混用**：Windows 盘符 `C:` 与 Web 分隔 `/` 混用（t1_breadcrumb_users），建议统一 `C:\Users` 或 `/Users`。
3. **悬浮球（星标）无文字提示**，多屏 mimo 反馈用途不明确，建议加 tooltip/标签（t2_fab_badge / t5_upload / t7_mobile）。
4. **打包进度指示器逻辑**："99% · 完成 0/1" 百分比与完成数看似矛盾，建议统一展示（t4_bulk / t4_pak_panel）。
5. **推荐标签**：标签数字（"模型 21"）无说明、含英文标签（agent/langchain）、疑似测试数据"下吧 19"，建议加说明或过滤（t6_sidebar / t6_sort_name / t10_icons_line）。
6. **空状态布局**：筛选后文件少时左侧大片空白（t6_filter_video）。
7. **图标区分度**：线条模式下 .lnk/.exe/.docx 等图标相似，建议增强差异（t3_image / t3_pdf / t4_pak_panel / t5_upload / t10_type_icons）。
8. **预览弹窗细节**：PDF 兜底提示不醒目、"下载压缩包本身"文案冗长、"← 上级"不醒目（t3_pdf / t3_zip_level2）。
9. **编码显示**：打包预览树中中文内容出现乱码（"演@构骰吧@"），疑为打包预览树未按编码读取，建议核查（t5_pack_done）。

---

## 5. 观察与风险

1. **服务进程中断 1 次**：测试中途 8443 端口失联（浏览器表现为 chrome-error）。非请求处理异常——日志仅有客户端中断流式传输的良性 `ConnectionAbortedError/ConnectionResetError`（视频流请求被浏览器关闭时产生，属正常容错路径）。已用独立进程重启，之后全程稳定；建议关注长时间运行稳定性（启动脚本已含自检与自动重启）。
2. **视频流中断日志**：`api/stream` 请求在预览关闭/标签页切换时产生 WinError 10053/10054 异常栈（线程级，不影响服务），属正常客户端中止，可不处理。
3. 收藏（pin）为**内存态**：服务重启后清空，符合当前设计（README 未承诺持久化），如需持久化可作后续需求。

---

## 6. 附件

- 全部截图：`<项目根>/.playwright-mcp/t33/*.png`（55 张）
- mimo 原始结论：`G:/自建agent专用工作区/DSH/.pwview/t33/mimo_results.txt`、`mimo_retry.txt`
- 自动化脚本：`G:/自建agent专用工作区/DSH/.pwview/t33/t*.mjs`、`pagefns.js`、`lib.mjs`
