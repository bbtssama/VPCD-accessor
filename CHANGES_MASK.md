# T36 P1 敏感信息脱敏 · 改动摘要（CHANGES_MASK）

> 任务：t36（netdisk-frontend-opt 团队 feature-engineer；依据 UX_REPORT §4 P1，mimo 最高优先）
> 改动文件：`static/app.js`（共享函数 + 4 个预览渲染入口）、`server/templates/view.html`（独立预览页切换按钮）
> 原则：默认脱敏、可一键切换明文；仅打码疑似真实密钥，避免误伤普通文本；零功能破坏；HTML id 不变（仅新增 viewMaskBtn）。

## 一、共享函数 maskSensitive(text)（app.js，view.html 经 app.js 复用）
打码规则（默认保留前4后4，中间 ****；仅打码疑似真实密钥——含数字或足够长）：
1. **PEM 私钥整块**：`-----BEGIN [A-Z ]*PRIVATE KEY-----...-----END [A-Z ]*PRIVATE KEY-----`（`[\s\S]*?` 跨换行）→ 整体替换为占位模板；
2. **键值形式**：`(api_key|secret|passwd|password|token|access_token|auth_token)s*[:=]s*值` —— 键名可出现在标识符中段（`my_api_key`/`authToken`），值可带单双引号（打码保留引号），只打码值部分；值 <8 字符或"无数字且 <16"不处理（防误伤 `token: Disabled` 这类配置项）；
3. **sk-**（OpenAI，16+）、**AKIA**（AWS，16 位）、**ghp_**（GitHub PAT，20+）、**xox[baprs]-**（Slack，10+）：前缀保留，值部分无条件打码（前缀即密钥类型标识，无误伤风险）。
- 快速路径：文本无 `\w` 或不含敏感关键词（sk-/akia/ghp_/xox/private key/api/secret/password/token 等，大小写不敏感预检）时直接返回，大文本零开销。

## 二、渲染入口接入（默认脱敏，弹窗/独立页可切换）
| 入口 | 位置 | 接入方式 |
|---|---|---|
| showText（含 markdown/code 分支） | app.js | `previewMask` 为真时对正文 `maskSensitive(text)` 后再 renderMarkdown/高亮/分片渲染；按钮「显示明文/隐藏敏感信息」切换后 paint() 重渲染 |
| showCsv | app.js | 逐单元格 `maskSensitive(cell)` 后 esc() 输出（保持表格结构）；同样带切换按钮 |
| renderTextPreview（独立预览页文本分支） | app.js | `previewMask` 为真时打码 |
| renderCsvPreview（独立预览页 CSV 分支） | app.js | 逐单元格打码 |
- 独立预览页 view.html：顶栏新增 `viewMaskBtn`（「显示明文」），点击翻转 `previewMask` 并重渲染；复用同一 maskSensitive。
- 预览 note 行追加状态提示："· 敏感信息已打码 / · 显示明文"。

## 三、验证
- node --check / py_compile / CSS 括号平衡（349/349）全通过；
- **maskSensitive 单测 21/21 PASS**：sk-/AKIA/ghp_/xoxb- 前缀打码（前缀保留+值 4+4）、PEM 整块（RSA/OPENSSH 变体）、键值（= 与 : 、引号值、`my_api_key`/`authToken` 标识符中段）、误伤防护（`token: Disabled`、`password: iloveyou`、`secret=abc`、`tokenizer=abc`、普通中英文文本、URL 中的 api/list 均不动）；
- 调试修正记录：① 预检探针大小写不敏感（AKIA/PRIVATE KEY 曾漏检）；② PEM 正则由 `\s\S*?` 改为 `[\s\S]*?`（原式无法跨换行）；③ 键值正则由 `\b` 改为 `(^|[^A-Za-z0-9])` 前缀（支持 `my_api_key`）并支持引号值。
