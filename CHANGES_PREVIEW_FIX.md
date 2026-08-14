# T13 预览体系全面修复 · 改动摘要（CHANGES_PREVIEW_FIX）

> 任务：t13（netdisk-frontend-opt 团队 engineer）
> 用户反馈：CSV 预览乱码（D:\模拟实时预测\记录2取样.csv）→ 实际是伪装成 .csv 的 .xlsx（ZIP 魔数 PK\x03\x04）
> 改动文件：`server/server.py`（_read_text 二进制检测 + UTF-16 识别）、`static/app.js`（错误提示友好化）
> 原则：功能主路径零破坏、正常预览不受影响、py_compile + node --check 门禁

## 一、核心修复：_read_text 二进制检测（CSV 乱码根因）
根因：xlsx 是 ZIP 容器（PK\x03\x04 开头），内部 XML 片段可被 UTF-8 解码"成功" → 返回乱码二进制文本。

修复（server.py _read_text 编码识别顺序重构）：
1. **BOM 检测**（原有：utf-8-sig / utf-16le/be / utf-32le）——BOM 是明确文本标志，先识别。
2. **二进制魔数检测**（新 `_has_binary_magic`）：PK\x03\x04（zip/xlsx/docx）、PNG、JPEG、GIF、PDF、gzip、ELF、MZ（exe）、java class、ico、bmp、ftyp（mp4/mov，偏移 4）、RIFF+WEBP —— **魔数优先于 UTF-16 启发式**（zip 结构字节形似 UTF-16，顺序错误会误判）。
3. **无 BOM UTF-16 启发式**（新 `_detect_utf16_nobom`）：偶数位 \x00 多 → BE（高字节在偶位），奇数位多 → LE——比 t14 要求的更早落地。
4. **空字节比例**（>3%）兜底：非 UTF-16 文本但 \x00 密集 → 二进制。
5. 命中任一 → 返回 `{kind:"binary", error:"该文件是二进制文件，无法文本预览"}`（含 name/total_size/read_bytes）。

## 二、前端错误提示友好化
- showText / showCsv 的 `j.error` 分支：明确错误文案 + **⬇ 下载查看**按钮（二进制/不可读文件可下载原文件，不再显示乱码）。

## 三、其他预览边界排查结论（审查确认无需改动项）
| 预览 | 检查结果 |
|---|---|
| 文本 showText | 截断提示完善（400KB 上限 + 文件总大小/已读字节 + 下载全文按钮）；编码显示"编码: xxx" ✓ |
| Markdown | 6 级标题（t4 已补）；表格/代码围栏/引用/列表边界正确 ✓ |
| PDF showPdf | iframe 内联 + "点击此处打开 PDF" 兜底链接 ✓ |
| 视频 showVideo | 转码 409 轮询降级提示（toast）✓ |
| 解压 showUnpack | j.error / format unsupported / 空包提示齐全 ✓ |
| CSV parseCsv | 引号包裹、内部逗号/换行、"" 转义、CRLF、空行跳过——已完善 ✓ |
| 图片 showImage | onerror 失败提示（t10）+ 超大图滚动/缩放 ✓ |

## 四、验证（真实环境，全部 PASS）
- `py_compile server.py` + `node --check static/app.js` + CSS 平衡 ✓
- **后端单测 10 场景全 PASS**：
  - 伪装 .csv 的 xlsx（PK 魔数）→ kind=binary + 明确错误 ✓（核心 bug 修复）
  - 伪装 txt 的 PNG / PDF → binary ✓
  - utf-8 / GBK / BOM UTF-16 / 无 BOM UTF-16 le / be → 各自正确解码 ✓
  - 正常 CSV / 含少量 NUL 的文本（<3%）→ 正常 ✓
- **HTTP 实测**：`/api/read` 对伪装 csv 返回 `{"kind":"binary","error":"该文件是二进制文件，无法文本预览"}`；正常 csv 正常返回 ✓
- **E2E（playwright）3 项 PASS**：伪装 csv 弹窗显示明确提示 + 下载按钮 ✓；正常 csv 表格渲染 ✓；showText 同样拦截二进制 ✓；无 JS 报错

## 五、回归面
- 正常文本（utf-8/gbk/UTF-16/BOM）解码路径不变；仅新增"二进制拦截"前置分支。
- 魔数列表保守（仅常见格式），不误伤文本；空字节阈值 3% 经真实样本验证。

## 六、补充修复：ZIP 内部文件名乱码（用户补充 case，并入本任务）
用户发现 `F:\mindows\payload-dumper-go-64位.zip` 解压预览乱码（"╩╣╙├╜╠│╠.url"）。

根因：无 UTF-8 标志的 zip 条目名，Python zipfile 默认按 cp437 解码，GBK 中文名变乱码。

修复（server.py）：
1. **`_fix_zip_name(name)`**（新公共函数）：`name.encode('cp437').decode('gbk')` 重解码；**安全策略**——仅当结果含足够中文/全角字符（>15%）且无控制字符时采用；ASCII 名 / UTF-8 标志名 / 拉丁文名保持不动（实测 'café menu.txt' 不误判）。
2. **_unpack_list**：条目 name/path_in_archive 用修复名（"使用教程.url"、"打开CMD命令行.bat" 正确显示）。
3. **_unpack_download**：前端传的修复名先精确匹配 namelist，失败再遍历经 `_fix_zip_name` 映射回原始名后下载；Content-Disposition 的 `filename*=UTF-8` 用修复名（用户可见）。

验证（真实环境全 PASS）：
- 单元测试：'╩╣╙├╜╠│╠.url' → '使用教程.url' ✓；ASCII / UTF-8 中文 / 拉丁文均不动 ✓
- 真实 zip：`payload-dumper-go-64/打开CMD命令行.bat` 中文正常 ✓；单条目下载映射成功（size 1532，disp 名正确）✓
- HTTP 实测 api/unpack 返回中文条目 ✓；py_compile 通过
