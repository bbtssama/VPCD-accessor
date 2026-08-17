# 后端深度审计报告（任务 t4：路由/安全/路径校验/分享/静态/错误处理）

- 对象：`server\server.py`（5325 行），定位 `C:\Users\user\Desktop\Other\远程电脑文件访问服务`
- 方法：read 逐段精读 do_GET/do_POST 全路由、_resolve/_resolve_share_path/_send_static/_send_file_range/_handle_share/_share_expired/_send_json/_send_error_page、上传链、打包链、分享持久化与全局状态；关键结论均已回读源码核实，非臆测
- 行号均按实际文件核对

---

## 严重度分布

| 严重度 | 编号 | 摘要 |
|---|---|---|
| 高 | H1 | POST /api/archive 打包路径完全绕过 _resolve 根边界 → 任意路径打包下载 |
| 高 | H2 | `import cgi` 在 Python 3.13+ 已移除，整个服务将无法启动 |
| 中 | M1 | 上传可覆盖同名既有文件 + 无大小/配额限制（磁盘耗尽 DoS） |
| 中 | M2 | 上传文件名未过滤 Windows ADS 冒号 → 隐蔽写入备用数据流 |
| 中 | M3 | `_shares` 全局字典无锁：并发创建/清理/持久化竞态，可丢分享或抛未捕获异常 |
| 中 | M4 | /api/archive/cancel 在 task 锁下改全局任务表，与持锁迭代方竞态 |
| 中 | M5 | 安全响应头缺失（X-Content-Type-Options/Referrer-Policy/X-Frame-Options/CSP）+ token 在 URL → Referer 泄露/点击劫持无纵深防御 |
| 中 | M6 | Range 解析不符 RFC 7233：多段 Range 静默只回第一段、正则未锚定、无 If-Range |
| 低 | L1 | `_resolve("")` 解析为进程 CWD，缺省 path 参数可意外访问/分享 CWD |
| 低 | L2 | realpath 在 try 外 + NUL 字节/不可访问路径 → 未捕获异常刷 traceback；parse_qs 无字段数上限 |
| 低 | L3 | `_send_error_page` 一律 403（"不存在"与"无权限"混淆） |
| 低 | L4 | 并发同名上传无互斥 → 交错截断写损坏文件 |
| 低 | L5 | 未实现 do_HEAD → 501，探测型客户端失败 |
| 低 | L6 | `_share_expired` 父链循环最多查 10 层（理论） |
| 低 | L7 | 静态 icons 目录放行任意 .svg（无 CSP 下的脚本 SVG 直链面） |

---

## 高严重度

### H1. POST /api/archive 打包路径未做根边界校验 → 任意路径打包下载（越权读取）

- **文件/行号**：`server\server.py` L1474-1495（路由入口）、L4535-4562（`_archive_new_task`）、L4599-4665（`_archive_worker`）、L4228-4301（`_scan_plan`）
- **问题描述**：do_POST `/api/archive` 的 `paths` 直接取自 JSON 请求体（L1486），全程未调用 `self._resolve` 做根内校验；`_archive_new_task` 只做 `os.path.realpath(p.strip())`（L4548）+ `os.path.exists`（L4558）；工人线程 `_archive_worker` → `_scan_plan` 同样零校验，收到什么打包什么。任务就绪后经 GET `/api/archive/dl`（L1414-1420）即可下载完整 zip。
- **佐证**：
  ```python
  # L1486-1491（do_POST）
  paths = body.get("paths") if isinstance(body, dict) else None
  if not isinstance(paths, list):
      self._send_json({"error": "paths 必须是字符串数组"}, 400)
  ...
  task, err = _archive_new_task(paths, mode)   # ← 无 _resolve
  # L4548 / L4558（_archive_new_task）
  ap = os.path.realpath(p.strip())             # ← 仅 realpath，无 commonpath 根内校验
  if os.path.exists(p): existing.append(p)
  ```
  **对照**：GET `/dlzip`（L1450）与 `/api/archive/preview`（L1427）都先 `self._resolve(x)` 再打包——说明这是疏漏而非设计。
- **影响**：持有主 token 的客户端可打包并下载**任意**服务账号可读路径：指定受限 root 启动时（`drive_start(root=...)`/`--serve [根目录]`）为完整任意文件读取（AppData、其它盘符、UNC 共享 `\\host\share` 等）；默认全盘 root 配置下危害降级但仍能触及根集合之外（如 UNC）。直接击穿文档声明的安全模型"全部文件访问经 _resolve 限定在允许根内"。
- **建议**：`_archive_new_task` 对每个 path 复用 `_resolve`/roots 校验，与 /dlzip 保持一致；或把校验前移到 do_POST。

### H2. `import cgi` 在 Python 3.13+ 已移除 → 服务整体无法启动

- **文件/行号**：L21（`import cgi`）、L1522-1525（`cgi.FieldStorage` 使用）
- **问题描述**：`cgi` 自 3.11 弃用、3.13 移除（PEP 594）。`import cgi` 是模块级裸导入（无 try/except），运行环境升到 3.13 后 ModuleNotFoundError 直接炸在模块加载，MCP 模式与 CLI 模式全部不可用；上传功能也依赖 `cgi.FieldStorage`。
- **佐证**：`L21: import cgi`；`L1522-1525: form = cgi.FieldStorage(fp=self.rfile, ...)`
- **影响**：兼容性高危——取决于用户 Python 版本；一旦升级即整服务不可启动。需替换为自实现 multipart 解析（或 email 解析器/第三方库）。
- **严重度**：高（运行环境 3.13+ 时）——至少应在启动时给出明确错误提示。

---

## 中严重度

### M1. 上传可覆盖同名既有文件 + 无大小/配额限制
- **行号**：L1539-1546
- **问题**：`name = os.path.basename(fname)`；`open(dest, "wb")` 直接截断覆盖目标目录内同名文件；全程无 Content-Length 上限、无磁盘配额检查。
- **佐证**：`L1540-1543: dest = os.path.join(target, name); with open(dest, "wb") as fh: shutil.copyfileobj(field.file, fh)`
- **影响**：与设计意图"只写不删改"冲突——可覆盖共享目录内任意同名文件（如替换可执行文件待机主执行）；token 持有者可无限写入直至磁盘满（DoS）。**中**。

### M2. 上传文件名未过滤 Windows ADS 冒号 → 备用数据流写入
- **行号**：L1539
- **问题**：Windows 上 `os.path.basename("evil.txt:stream")` 不把 `:` 当路径分隔符，name 保留冒号；`open(dest,"wb")` 实际写入 `evil.txt` 的 `:stream` 备用数据流（ADS），不产生可见文件。
- **佐证**：`L1539: name = os.path.basename(fname) or "file"`（无 `:` 清洗）
- **影响**：可隐蔽写入/覆盖任意文件的 ADS（如 `Zone.Identifier`），可用于数据隐藏/误导取证；需 token + 目录可写。属路径/编码边界漏洞。**中**。

### M3. `_shares` 全局字典无锁 → 并发创建/清理/持久化竞态
- **行号**：L100-101（定义）、L1274-1276 / L1315-1317（创建时清过期）、L1004 / L1277 / L1318（写入）、L3648-3657（`_save_shares`）
- **问题**：分享创建、过期清理、持久化都在请求线程内直接操作全局 `_shares`，无任何锁（t1 已标注此疑点，本次确认实锤）：
  - 并发两个创建请求同时 `json.dump(_shares, ...)` 到同一 `.tmp` 文件 → 互踩，`os.replace` 最后写者胜 → 一个分享只在内存、重启即丢；
  - dump 期间另一线程增删字典 → `RuntimeError: dictionary changed size during iteration`，而 `_save_shares` 只 `except OSError`（L3656）→ 未捕获异常打到请求线程。
- **佐证**：`L3653-3655: with open(tmp,...) as fh: json.dump(_shares, fh, ...); os.replace(tmp, SHARES_FILE)`；`L3656: except OSError: pass`
- **影响**：分享丢失/重复、偶发请求 500 断连；低流量 LAN 工具概率低但属明确竞态。**中**。

### M4. /api/archive/cancel 在 task 锁下改全局任务表 → 与持锁迭代方竞态
- **行号**：L1503-1508（cancel）、L4512-4515（`_archive_delete_task`）、L1403-1404（/api/archives 持锁迭代）、L4695-4713（`_archive_poll_cleanup` 持锁迭代）
- **问题**：cancel 分支 `with task["lock"]: ... _archive_delete_task(task)` 未取 `_ARCHIVE_TASKS_LOCK`，而 `_archive_delete_task` 直接 `_ARCHIVE_TASKS.pop(...)`；另一线程同时在 `_ARCHIVE_TASKS.values()` 下迭代（/api/archives、poll_cleanup 均持锁遍历）→ 并发 pop 触发 RuntimeError。
- **佐证**：`L1503-1508: with task["lock"]: ... _archive_delete_task(task)`；`L4514: _ARCHIVE_TASKS.pop(task["task_id"], None)`（注释自认"调用方需保证表格访问线程安全"，但 cancel 未保证）
- **影响**：请求线程崩溃（500/断连），窗口小、非数据损坏。**中**。

### M5. 安全响应头缺失 + token 在 URL → Referer 泄露 / 点击劫持无纵深
- **行号**：L139-146（_send_json）、L157-164（_send_html）、L284-339（_send_file_range）、L1099-1102（token 前缀校验）
- **问题**：所有响应均未设置 `X-Content-Type-Options: nosniff`、`Referrer-Policy`、`Content-Security-Policy`、`X-Frame-Options`。安全模型把 token 直接放 URL 路径（`/<token>/...`），任何页面内跳转外域/外部资源请求都会把含完整 token 的 Referer 发给第三方；无 Referrer-Policy 兜底。网盘页可被第三方 iframe 嵌入做点击劫持（诱导已持有 token 的机主触发分享/下载）。当前模板/静态资源全离线，实际泄露面小，但属纵深防御缺失。
- **影响**：token 泄露/点击劫持风险无缓解措施。**中**。

### M6. Range 解析不符 RFC 7233：多段 Range 静默只回第一段、正则未锚定、无 If-Range
- **行号**：L298-319（`_send_file_range`）
- **问题**：
  - `re.match(r"bytes=(\d*)-(\d*)", ...)` 未锚定到串尾：`bytes=0-1,4-6` 只回 0-1 单段 206（规范应 multipart/byteranges）；`bytes=0-1xyz` 静默忽略尾缀；
  - 无 `If-Range` 支持（配合 ETag 的条件续传缺失）。
- **佐证**：`L298: m = re.match(r"bytes=(\d*)-(\d*)", rng.strip(), re.IGNORECASE)`
- **影响**：播放器/下载器兼容性小问题（主流客户端多为单段 Range，实际影响低）；非安全漏洞。**中**（正确性）。

---

## 低严重度

### L1. `_resolve("")` 解析为进程 CWD
- **行号**：L345-359（`_resolve`）；触发点 L1300-1301（/api/share）、L1164（/api/pin）、L1181（/api/stat）等 `q.get("path") or ""`
- **问题**：`os.path.abspath("")` = 进程当前工作目录。若服务 CWD 恰在某个 root 内，`/api/share?path=`（空 path）会直接分享 CWD；/api/pin 空 path 会置顶 CWD。
- **佐证**：`L348: p = os.path.abspath(os.path.normpath(raw))`
- **影响**：边界外的意外暴露面（依赖启动 CWD）。**低**。

### L2. realpath 在 try 外 + NUL 字节路径 → 未捕获异常刷 traceback；parse_qs 无上限
- **行号**：L347-351（`_resolve`）、L341-343（`_query`）
- **问题**：abspath/normpath 包在 try 内（L348-350），`os.path.realpath(p)` 在 try 外（L351）；含 `%00`（parse_qs 解码后）或不可访问的路径可在 realpath/open 抛 ValueError/OSError 且不被 `_resolve` 接住 → BaseHTTPRequestHandler.handle_error 打印 traceback、连接无响应。`parse_qs` 未设 `max_num_fields`，超长 query 可造成解析放大。
- **影响**：日志污染 + 单请求失败（需 token）；低量级 DoS。**低**。

### L3. `_send_error_page` 一律 403，状态码语义错位
- **行号**：L237-255
- **问题**："PDF 不存在或越界"（L934）、"文件不存在或越界"（L1026）等不存在场景也返回 403，与"无权限"混同；隐藏存在性是双刃剑，对客户端分支不友好。
- **佐证**：`L250: self.send_response(403)`（无条件）
- **影响**：语义/调试不便。**低**。

### L4. 并发同名上传无互斥 → 交错写
- **行号**：L1540-1543
- **问题**：两个并发请求上传同 filename → 两次 `open(dest,"wb")` 交错截断写 → 文件损坏；无 per-file 锁。
- **影响**：低概率数据损坏。**低**。

### L5. 未实现 do_HEAD → 501
- **行号**：类定义 L133-135（仅 protocol_version）；无 do_HEAD
- **问题**：BaseHTTPRequestHandler 默认 HEAD → 501；`curl -I`、部分下载器/探测工具无法获取 /dl、/api/pdf 等资源头。
- **影响**：兼容性。**低**。

### L6. `_share_expired` 父链循环最多查 10 层
- **行号**：L418-428
- **问题**：`while parent and seen < 10` 只追溯 10 层父链；>10 层的深链不再上溯。构造深链需多次合法 sharesub（每次继承父过期时间），无法借此延长任何单分享寿命。
- **影响**：理论边界，无实际利用。**低**（信息性）。

### L7. 静态 icons 目录放行任意 .svg（无 CSP）
- **行号**：L183-187（`_send_static` icons 分支）
- **问题**：icons/ 及其 color/ 子目录内任意 `*.svg` 均以 `image/svg+xml` 提供；若本地可写恶意 SVG，直链导航可能执行脚本。需同源 token + 本地写入前置，实际攻击面极小。
- **影响**：纵深防御项。**低**。

---

## 防线有效确认（正面结论）

- **主 token 校验**：do_GET L1099-1102 / do_POST L1468-1471 严格前缀匹配（区分大小写、未解码），token 为 `secrets.token_urlsafe(9)`（72bit），分享路由先行且完全隔离（L1096-1098 / L1464-1467）。✓
- **路径越界防护**：`_resolve`（L345-359）与 `_resolve_share_path`（L364-408）realpath+commonpath 双重校验，对 `..`、符号链接/junction、%2F/%5C 编码分隔符穿越均有效；多文件分享白名单精确匹配（L397-401）阻断父目录前缀绕过；虚拟分享 nodes 精确 key 匹配。✓
- **`_send_static`**（L179-190）：白名单 + basename + normpath 三重复核，`icons/../../x.svg` 等变形均被拒。✓
- **`_send_file_range`**（L298-319）：越界/非法/后缀/空文件边界计算正确（416+Content-Range）；Content-Disposition 文件名经 `urllib.parse.quote`（L293）防头注入。✓
- **错误页 XSS**：`_send_error_page` 对 title/detail 做 `html.escape`（L248）。✓
- **分享过期双通道**：页面 200 过期提示页（L703-704、L1072-1089）/ API 410（L706）设计合理；过期分享惰性清理避免读放大（L1274-1276）。✓
- **打包防环**：`_scan_plan` junction 目录跳过（L4272-4279）+ visited/depth≤64 防循环（L4245-4258）。✓
- **分享模式禁用面**：pin/upload/cert/certp12/share 在分享下 403（L1067-1069、L1464-1467）。✓

---

## 修复优先级建议

1. **H1**：`_archive_new_task` 逐 path 过根校验（与 /dlzip 对齐）——最高优先，直接击穿安全模型。
2. **H2**：替换 `cgi` 上传解析或加版本护栏（3.13+ 明确报错）。
3. **M3/M4**：给 `_shares` 加全局锁（或 RLock），`_save_shares` 序列化快照并在锁内 dump；cancel 分支补 `_ARCHIVE_TASKS_LOCK`。
4. **M1/M2**：上传加大小上限 + 同名覆盖策略（拒绝/改名）+ 文件名清洗 `:` 与尾随点/空格。
5. **M5**：全局响应头补 `X-Content-Type-Options: nosniff`、`Referrer-Policy: no-referrer`、`X-Frame-Options: DENY`。
6. **M6/L 系列**：随迭代修复。
