# T40 UX 优化回归走查 · 验证报告（CHANGES_UX_VERIFY）

> 任务：t40（netdisk-frontend-opt 团队 feature-engineer；只读验证+截图，未改任何代码）
> 环境：https://127.0.0.1:8443/transfer（token=transfer，headless msedge + Playwright MCP + mimo-v2.5-free 视觉验收）
> 截图：G:/自建agent专用工作区/DSH/.pwview/.playwright-mcp/t40/*.png（13 张，关键图另存 _t40shots/）
> 范围：t36（P1 脱敏）t37（隐藏文件+统计+悬停全名）t38（视觉批次A）t39（打包乱码核查+抽屉面板）+ 无回归快检

## 验证结果汇总

| 项 | 验证方式 | 结果 | 严重度 |
|---|---|---|---|
| t36 文本预览默认脱敏 | DOM 取 .text-pre 文本 | ✅ 通过：`api_key=sk-a****0123`、`AKIA1234****CDEF`、`password=secr****t123`，普通行不动 | — |
| t36 「显示明文」切换 | 点击按钮后取文本 | ✅ 通过：完整密钥显示，按钮变「隐藏敏感信息」，note 变「显示明文」 | — |
| t36 /view 独立页脱敏+切换 | viewMaskBtn 点击 | ✅ 通过：默认打码、点击后明文、按钮文案同步 | — |
| t36 mimo 视觉 | 04_text_masked.png | ✅ 通过：密钥星号打码可见、显示明文按钮在、无中文乱码 | — |
| t37 默认隐藏 | 列表行名+统计行 | ✅ 通过：`.hidden.txt`/`~$temp.docx` 隐藏，统计「共 4 项 · 2 个目录 · 2 个文件」 | — |
| t37 开关+记忆 | 切换后统计行 | ✅ 通过：6 项（含隐藏项），统计同步，localStorage 记忆（刷新后保持） | — |
| t38 面包屑 Windows 风格 | DOM class/分隔符 | ✅ 通过：`<span class="seg drive">C:</span>` + 反斜杠分隔（C: \\ Users \\ ...） | — |
| t38 悬浮球 title+hover 标签 | DOM title + 服务页 CSS | ✅ 通过：title="收藏"；css 含 `.pin-fab::after content:"收藏"`（hover 淡入淡出） | — |
| t38 打包进度文案 | 实测打包任务 | ✅ 通过：芯片「已完成 0/1」、任务卡「压缩完成 · 待下载」、迷你条逻辑（全完成=100% · 已完成） | — |
| t38 空态垂直居中 | computed style | ✅ 通过：`display:flex; align-items:center; justify-content:center; min-height:360px(45vh)` | — |
| t38 标签 title+说明 | DOM | ✅ 通过：chip title「点击搜索该标签 · 出现于 N 个文件」；小字说明「点击标签快速搜索…」在 | — |
| t38 解压弹窗文案 | 实测 zip 预览 | ✅ 通过：「下载压缩包」；上级按钮 btn-outline-primary；层级浏览 crumb 正常 | — |
| t38 PDF 兜底样式 | 服务页 CSS | ✅ 通过：.pdf-fallback 规则（虚线边框+琥珀底+图标）已在服务 HTML 中 | — |
| t39 打包树/任务卡中文 | 真实用户收藏打包实测 | ✅ 通过：预览树「计算机网络相关知识」「无经验Java岗位要点.docx」无乱码；mimo 确认 | — |
| t39 抽屉面板 | DOM 宽度测量 | ✅ 通过：列表宽 1200→1200 零变化（overlay 不挤压）、遮罩可关、侧栏 320px；mimo 目测存疑（见问题②） | — |
| 无回归（网格/中文目录/统计/深色变量） | 快检 | ✅ 通过：grid 中文目录 2 项、统计行正确、面包屑深层正确 | — |

## 问题项
1. 【低】t39 抽屉 mimo 目测与实测不一致：mimo 认为"列表被挤压、无遮罩"，但 DOM 实测列表宽度 1200→1200 零变化、遮罩 .show 存在（rgba(17,24,39,.45) 较淡）——以 DOM 实测为准，非缺陷。
2. 【低】t37 隐藏开关开启后持久化：后续页面/刷新仍显示隐藏文件（t37 设计如此——localStorage 记忆）；验证时注意开关状态，非缺陷。
3. 【提示】本任务期间发现 8443 原服务实例已停止（netstat 无监听），由本任务以最新代码重启（python server.py --serve auto --port 8443 --token transfer）；验证完成后服务保持运行，用户收藏项（2 项）与打包任务均已清理恢复原状。
4. 【提示】t39 的 CHANGES_UXB.md 在验证开始时尚未落盘（engineer 提交后已存在），内容为"两项均已被既有修复覆盖，无需改码"的核查结论——与本次实测一致。

## 验证环境与清理
- 测试夹具（_t40test：敏感文本/隐藏文件/中文目录/zip）已创建并完整清理；测试 pin/打包任务已取消，pinned 恢复为用户原始 2 项。
- 服务器（本任务启动实例）保持运行于 8443，token=transfer。
