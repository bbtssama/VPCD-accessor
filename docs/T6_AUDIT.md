# 后端审计报告（任务 t6：打包 / 解压 / 系统集成）

- 对象：`server\server.py`（5325 行），行号按实际文件核对
- 覆盖：打包（_build_archive_items 4194 / _scan_plan 4228 / _write_entry_chunked 4332 / _write_zip_entries 4363 / _stream_archive 4410）、后台任务（_archive_new_task 4535 / _archive_worker 4599 / _archive_delete_task 4512 / _archive_sweep_tmp 4518 / _archive_poll_cleanup 4688 / _archive_dl 4744）、解压（_unpack_list 3942 / _unpack_download 4143 / _fix_zip_name 3664 / 外部工具 _find_7z 3773 等）、MCP 工具（drive_start 5108 / drive_pin 5131 / drive_status 5171 / drive_stop 5191）、防火墙（_add_firewall_rule 4966 / _remove_firewall_rule 4990）、证书（_cert_san 4808 / _cert_needs_rebuild 4831 / _ensure_cert 4851 / _cert_p12_bytes 4889）、URL（_public_ipv6 4906 / _private_ipv4 4920）、CLI/看门狗（_cli_serve 5283 / _start_watchdog 5263 / _cli_bind_retry 5228）、_fixed_drives 1702 / _list_dir 1753

---

## 〇、路径穿越专项结论（重点排查项）

**打包侧 arcname 无穿越**：`_build_archive_items` 的 arcname 由 `os.path.relpath(rp, base)` 生成（L4218），base 是所有路径 dirname 的 commonpath（L4204）；跨盘时 `relpath` 抛 ValueError 走 basename 回退（L4219-4223），不存在 `..` 逃逸。`_scan_plan` 递归展开也用父 arcname 拼接（L4266），无 `..`。**结论：zip 条目名无法穿越。**

**解压侧 zip/tar 只读不落盘**：`_dl_zip`（L4006-4030）用 `zf.namelist()` 精确匹配 + `zf.open` 从包内读取，`_dl_tar`（L4033-4057）用 `getmembers()` 匹配 + `extractfile`，均不写磁盘、不拼接文件系统路径。**结论：zip/tar 条目下载无写入穿越。**

**穿越风险实际集中在两处**：① rar/7z 把用户可控 entry 直接拼进外部 CLI（见 H2，开关/掩码注入）；② 打包扫描跟随文件级 reparse 点（见 M3，根外数据入包）。详见下。

---

## 一、高危

### H1. POST /api/archive 打包路径未做根目录校验 → 受限根部署下任意文件读取/外传
- **位置**：`server.py` L1486-1491（do_POST /api/archive）→ `_archive_new_task` L4543-4563
- **问题**：GET /dlzip 的每条路径都经 `self._resolve(x)` 根内校验（L1450），但 POST /api/archive 的 JSON body `paths` **完全绕过 `_resolve`**，`_archive_new_task` 只做 `realpath`（L4547-4552）与 `os.path.exists`（L4557-4561）校验，全程无 `_under(roots)` / commonpath 根内判定。打包完成后 zip 经 `/api/archive/dl`（L1414-1420）下载。
- **影响**：当 `drive_start(root=<单个根目录>)` 受限部署时，任何持 token 的客户端可打包**根外任意路径**（如 `C:\Users\<user>\AppData\...`、其它用户目录），就绪后整体下载 → 配置边界的任意文件读取/外传。root="auto"（默认整机）时所有固定盘皆在根内，问题被掩盖，但单根部署即被击穿。与 `drive_pin`（L5141 有 `_under` 校验）形成明显不一致。
- **严重度**：高（授权绕过 + 任意文件外传）
- **佐证**：
```python
# L1486-1491 do_POST /api/archive
paths = body.get("paths") if isinstance(body, dict) else None
if not isinstance(paths, list):
    self._send_json({"error": "paths 必须是字符串数组"}, 400); return
mode = body.get("mode") or "normal"
task, err = _archive_new_task(paths, mode)   # ← 无 _resolve/根校验
# L1450 GET /dlzip 对照
paths = [self._resolve(x) for x in raw.split("|") if x]   # ← 有根校验
# L4547-4562 _archive_new_task 内部仅 realpath + exists
ap = os.path.realpath(p.strip())
...
if os.path.exists(p): existing.append(p)
```
- **修复方向**：`_archive_new_task` 内对每个路径做 `_under(roots)` 校验（无 roots 时按 `_fixed_drives()`），越界记入 skipped 或整体拒绝。

### H2. rar/7z 条目下载把用户可控 entry 直接拼进外部 CLI（开关/掩码/列表文件注入）
- **位置**：`/api/unpackdl` L1392-1399 → `_unpack_download` L4143-4163 → `_dl_7z` L4067-4068 / `_dl_winrar` L4113
- **问题**：`entry = q.get("entry")` 不做任何过滤（L1395），zip/tar 走包内 namelist/getmembers 匹配（安全），但 7z/WinRAR 分支把 entry **原样作为命令行参数**：
  - 7z 把 `-` 前缀参数当开关解析：`-x`（排除）、`-p…`（设密码）、`-t…`（强改格式）、`-i` 等，恶意压缩包可含字面名为 `-psecret` / `-x!*.exe` 的条目，下载时 7z 行为被篡改；
  - 7z 条目参数是**通配符掩码**：条目名含 `*`/`?` 会匹配多个归档条目 → `-so` 拼接输出 + `Content-Length`（来自 `_seven_entry_size` 单条）失真 → 下载内容错乱/多文件内容拼接泄露；
  - WinRAR `e` 支持 `@listfile`：`@` 开头参数读磁盘列表文件 → 提取非预期条目集。
- **影响**：浏览恶意压缩包（含分享链接场景）并点击特定条目 → 下载到错乱/拼接数据、7z 开关注入改变行为、请求挂起（配合 W1）。无直接 RCE（7z/WinRAR 开关不执行代码），但数据完整性与内容边界被破坏。
- **严重度**：中-高（CLI 注入面，需持 token 或受害者浏览恶意包触发）
- **佐证**：
```python
# L4067-4068 _dl_7z
proc = subprocess.Popen(
    [tool, "e", "-so", "-y", "-sccUTF-8", archive, entry],   # ← entry 原样入参
    stdout=subprocess.PIPE, stderr=subprocess.PIPE)
# L4113 _dl_winrar
r = subprocess.run([tool, "e", "-p-", "-y", "-o+", archive, entry, tmp],
                   capture_output=True, timeout=300)          # ← 同上
```
- **修复方向**：下载前用 `_seven_list`/namelist 结果做**精确 Path 白名单匹配**（拒绝 `-`/`*`/`?`/`@` 开头、拒绝通配符），匹配不到即 403，绝不把原始字符串传给 CLI。

### H3. 私钥可经网络下载（/api/certp12）+ 固定弱密码 + 明文落盘
- **位置**：`/api/certp12` L1355-1370；`CERT_P12_PASSWORD="1234"` L4886；`_cert_p12_bytes` L4889-4903；KEY_FILE 落盘 L4874-4881
- **问题**：`/api/certp12` 把**含私钥**的 PKCS#12（密码硬编码 "1234"，源码/README 可见）经网络提供给任何持 token 者；服务同端口支持 HTTP 明文（`get_request` 首字节嗅探 L1573-1601），token 就在 URL 里，局域网可嗅探 → 私钥 + 密码同时泄露。另 `_ensure_cert` 以 `NoEncryption` 明文写私钥文件（L4876-4880）。
- **影响**：拿到 p12 = 拿到服务器私钥 → 局域网 MITM 解密/伪造该 7 天证书覆盖的流量。自签 7 天证书使影响窗口有限，但密钥分发面与"密码写死在代码里"是明确的敏感点。
- **严重度**：中-高（设计取舍但密钥暴露面大）
- **佐证**：
```python
# L4886 / L4895-4902
CERT_P12_PASSWORD = "1234"
return pkcs12.serialize_key_and_certificates(
    name=_CERT_CN.encode(), key=key, cert=cert, cas=None,
    encryption_algorithm=serialization.BestAvailableEncryption(
        CERT_P12_PASSWORD.encode()))
# L4874-4881
fh.write(key.private_bytes(serialization.Encoding.PEM,
    serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
```
- **修复方向**：至少要求 HTTPS 才提供 p12（明文连接拒绝）、一次性密码随机化并打印到控制台、限制 p12 下载次数；私钥文件设置 ACL。

---

## 二、中危

### M1. `_dl_7z` stderr 管道死锁 → 畸形压缩包可挂死请求线程
- **位置**：`_dl_7z` L4067-4106
- **问题**：`Popen(..., stdout=PIPE, stderr=PIPE)` 后，主循环只 `proc.stdout.read(1<<20)` 读到 EOF（L4089-4093），stderr **只在 finally 里才读**（L4100）。Windows 命名管道默认缓冲仅约 4KB；损坏包/多坏条目会让 7z 向 stderr 连续输出 "Data Error" 类警告 → stderr 缓冲填满 → 7z 写阻塞 → stdout 停止产出 → `read` 无限阻塞。`proc.wait(timeout=10)`（L4104）在 finally 中，永远执行不到。请求线程（daemon）永久挂起。
- **影响**：任何持 token 者（或经分享让受害者点击）对损坏/恶意 rar/7z 条目发起下载即造成线程挂起；配合 ThreadingHTTPServer 无上限线程，可累积成 DoS。
- **严重度**：中
- **佐证**：
```python
# L4088-4093 只读 stdout
while True:
    chunk = proc.stdout.read(1 << 20)   # ← stderr 填满后此处永久阻塞
    if not chunk: break
    handler.wfile.write(chunk)
# L4099-4106 finally 才读 stderr / wait
proc.stderr.read()
proc.wait(timeout=10)
```
- **修复方向**：stderr 用独立 drain 线程；或 stdout/stderr 合并；或对 `read` 加总超时。

### M2. 防火墙规则残留（崩溃/看门狗路径不清理 + 同名规则累积）
- **位置**：`_add_firewall_rule` L4966-4987；`_remove_firewall_rule` L4990-4998；`_stop` L5061；看门狗 `os._exit(2)` L5278；CLI 自检失败 `os._exit(2)` L5304
- **问题**：规则只在 `_stop()` 删除。看门狗自杀（L5278）、CLI 自检失败退出（L5304）、进程被强杀、崩溃重启等路径全部跳过 `_stop` → 入站规则 `TransferMCP-<port>` **永久残留**（netsh 规则跨重启持久）。且 netsh `add rule` 同名不报错，每次崩溃重启会**累积多条同名规则**，直到某次正常 `_stop` 的 `delete rule name=` 才一次性清掉。
- **影响**：服务死后端口仍对局域网开放入站（若日后被恶意进程占用则直接可达，防火墙形同虚设）；残留规则无限累积。属"安全状态不随进程生命周期收敛"。
- **严重度**：中
- **佐证**：
```python
# L5054-5062 _stop 唯一清理点
port = _state["port"]
_state["server"].shutdown(); _state["server"].server_close()
...
_remove_firewall_rule(port)
# L5274-5278 看门狗自杀路径无任何清理
if fails >= 3:
    sys.stderr.write(...)
    os._exit(2)
```
- **修复方向**：启动时先 `netsh delete rule name=TransferMCP-<port>` 清理同名残留再添加；`os._exit` 前尝试 `_remove_firewall_rule`；用 `at` 唯一命名（带 PID）并按 PID 清理。

### M3. 打包扫描跟随文件级 reparse 点 → 根外内容被打进 zip
- **位置**：`_scan_plan` L4262-4296
- **问题**：目录 junction 有 `is_reparse`（0x400）检查并跳过（L4271-4279），但**文件级 reparse/symlink 无检查**：文件分支只做 `realpath` 去重（L4286-4291），plan 记录链接路径（L4292），写包时 `open(rpath)` 跟随链接读取**目标内容**。根内指向根外的文件链接（`mklink` 创建；OneDrive/云盘占位符文件即 reparse 点）会把根外内容打入 zip。
- **影响**：受限根部署下，根内存在文件链接/占位符时，隐私数据经 zip 外泄。Windows 普通用户创建文件链接需权限，但云盘占位符是真实常见场景。
- **严重度**：中（隐私泄露面，触发概率低）
- **佐证**：
```python
# L4271-4279 目录 reparse 被跳过
is_reparse = bool(e.stat(follow_symlinks=False).st_file_attributes & 0x400)
if is_reparse:
    skipped.append({"path": e.path, "reason": "链接目录未包含"}); continue
# L4284-4296 文件分支无 reparse 检查，链接被跟随
freal = os.path.realpath(e.path)
if freal in seen_files: continue
seen_files.add(freal)
plan.append((child, e.path))   # ← 写包时 open() 跟随链接
```
- **修复方向**：文件分支同样检查 `st_file_attributes & 0x400`，命中则记 skipped。

### M4. 惰性清理会在下载中途杀任务/删包
- **位置**：`_archive_poll_cleanup` L4688-4713；`_archive_dl` L4779-4796
- **问题**：TTL 30min 按 `created_at` 起算（L4697-4698），对 downloading 状态任务直接 `cancel_evt.set()` + `_archive_delete_task`（L4700-4703）→ 下载循环检到取消抛 `_ArchiveAborted` 并删任务删包（L4779-4796）。超 16 条逐出时把 `downloading` 当"终态"逐出（L4709），同样在传输中删 zip。
- **影响**：合法慢速大包下载（创建后 >30min，或任务表 >16 条）被静默中断；删除 open 中的 zip 在 Windows 上失败则留下孤儿临时文件（下次启动才清）。
- **严重度**：中（功能缺陷）
- **佐证**：
```python
# L4697-4705
stale = [t for t in _ARCHIVE_TASKS.values()
         if now - t["created_at"] > _ARCHIVE_TASK_TTL]
for t in stale:
    if t["state"] in ("queued","scanning","compressing","downloading"):
        t["cancel_evt"].set()
        _archive_delete_task(t)
```
- **修复方向**：downloading 任务豁免 TTL/逐出；TTL 从"开始下载"起算；删除前确认非 downloading。

### M5. stop→start 后 ready 任务失效（任务表不清 + 启动清扫删包）
- **位置**：`_stop` L5054-5062（不清 `_ARCHIVE_TASKS`）；`_start` L5003 调 `_archive_sweep_tmp` L4518-4532
- **问题**：`_stop` 不清任务表；同一进程再次 `_start` 时 `_archive_sweep_tmp` 删除临时目录全部 `tk_*.zip`（L4526）。旧任务仍以 ready 留在表中，但 zip 已删 → `/api/archive/dl` 打开失败走回滚（L4797-4802）→ 状态 ready 死循环，或 404。
- **影响**：MCP 典型用法 drive_stop → drive_start 后，之前就绪的任务全部不可下载且列表显示 ready。
- **严重度**：中
- **佐证**：
```python
# L4525-4531 启动清扫删除全部 tk_*.zip
if name.startswith("tk_") and name.endswith(".zip"):
    os.unlink(os.path.join(tdir, name))
# L5054-5062 _stop 未触碰 _ARCHIVE_TASKS
```
- **修复方向**：`_stop` 清空任务表（并删对应包）；或 `_start` 清扫前先按任务表排除活跃任务。

### M6. `_scan_plan` 取消不即时（排队阻塞/扫描阶段无取消检查）
- **位置**：`_archive_worker` L4608（`_ARCHIVE_SEM.acquire()` 阻塞无取消检查）、L4610-4611（扫描）、L4618（扫描后才查取消）
- **问题**：queued 任务取消后，工人线程仍阻塞在信号量上（直到拿到额度）；扫描超大目录（百万文件）时取消要到扫描完成后 L4618 才生效，取消延迟 = 扫描时长。
- **影响**：取消体验差；结合 M4 的 TTL 取消，长时间扫描任务在超时前无法收敛。
- **严重度**：中（低-中）
- **佐证**：
```python
# L4608-4618
_ARCHIVE_SEM.acquire()          # ← 无 cancel 检查
task["state"] = "scanning"
items = _build_archive_items(task["paths"])
plan, dirs, total, skipped = _scan_plan(items)   # ← 无取消检查
...
if task["cancel_evt"].is_set():
    raise _ArchiveAborted()      # ← 扫描完成后才查
```
- **修复方向**：`_scan_plan` 支持 cancel 回调/事件，扫描循环内周期检查；信号量等待改为带事件等待。

### M7. 看门狗/自检可能误杀健康服务（磁盘饱和/超大打包时）
- **位置**：`_http_probe_ok` L5250-5260（3s 超时）；`_start_watchdog` L5263-5280（连续 3 次失败 → `os._exit(2)`）
- **问题**：同一进程正做超大同步 /dlzip（扫描+压缩）或磁盘 IO 饱和时，探测请求可能连续超时（3×10s），看门狗判定"僵死"直接 `os._exit(2)` → 服务在正常工作时被自杀，启动脚本重启 → 进行中的打包/转码全部中断。
- **影响**：可靠性缺陷，大任务场景下误杀。
- **严重度**：中
- **佐证**：`_http_probe_ok` L5255-5259 `urlopen(..., timeout=3)`；`_start_watchdog` L5274-5278 `if fails >= 3: os._exit(2)`

### M8. slowloris / 半开连接线程泄漏（无请求行超时）
- **位置**：`_DriveServer.get_request` L1573-1601；`ThreadingHTTPServer` + `daemon_threads=True` L1560
- **问题**：首字节嗅探的 peek 有 1s 超时（L1581-1585），但 peek 超时/无数据按明文处理交给 HTTP 层后，请求行读取无任何超时（L1585 已 `settimeout(None)`）→ 只连不发数据的客户端让处理线程无限阻塞；TLS 半握手由 5s 超时兜底（L1590），明文 slowloris 无兜底。
- **影响**：LAN 上任意设备可发起大量半开连接，耗尽线程（daemon 无上限）→ 服务 DoS。
- **严重度**：中
- **佐证**：
```python
# L1580-1587
sock.settimeout(1.0)
peek = sock.recv(1, socket.MSG_PEEK)   # 超时→b""→按明文处理
finally: sock.settimeout(None)         # ← 明文请求行读取无超时
```
- **修复方向**：明文分支设置请求头读取超时（如 15s），或对整体连接设 idle 超时。

### M9. 解压浏览的 7z 列表/大小查询每次全量跑子进程（性能）
- **位置**：`_seven_list` L3877-3903（300s 超时，`capture_output` 全量缓冲）；`_seven_entry_size` L3969-4003（每次下载重跑整包 `l -slt`）
- **问题**：单条目下载前全量列出整包并解析；巨型包（百万条目）输出被 `subprocess.run` 完整缓冲进内存 → 内存峰值大 + 每次下载 O(包条目数)；大包浏览响应慢。
- **影响**：性能/内存；恶意超多条目包可放大内存占用。
- **严重度**：中（低-中）
- **佐证**：`_seven_entry_size` L3972-3973 `subprocess.run([tool,"l","-slt","-ba",...,archive], capture_output=True, timeout=300)`
- **修复方向**：下载前用已缓存列表查大小；对列表输出做行数/字节上限截断。

---

## 三、低危

### L1. `_hier_level` 的 `lstrip("./")` 破坏点文件名 → 点文件无法下载
- **位置**：L3803（zip）、L3845（tar）、L3863（7z 条目）
- **问题**：`nm.replace(...).lstrip("./")` 会把 `.gitignore` 剥成 `gitignore`（`lstrip` 剥任意前导 `.`/`/`），列表展示错名；`_dl_zip` 用展示名精确匹配包内原名（L4011-4017）→ 匹配失败 403，**以点开头的文件（.env、.gitignore）在压缩包内无法下载**。
- **严重度**：低（功能缺陷）
- **佐证**：`_dl_zip` L4013-4017 `for orig in zf.namelist(): if _fix_zip_name(orig) == entry: ...`（`.gitignore` 修复后仍为 `.gitignore` ≠ 展示名 `gitignore`）
- **修复方向**：改用 `removeprefix`/正则只剥 `./` 前缀，不剥点文件名。

### L2. `_dl_winrar` 解压后取"第一个文件"发送
- **位置**：`_dl_winrar` L4111-4136
- **问题**：`e` 按掩码匹配到多个条目时，`os.listdir(tmp)` 取第一个文件（L4119-1127）发送，内容不确定；超大单条目先全量落临时盘再发送，无大小上限。
- **严重度**：低

### L3. `_dl_tar` 符号链接条目：Content-Length 已发但无内容
- **位置**：`_dl_tar` L4053-4055
- **问题**：tar 内 symlink 条目 `extractfile` 返回 None → 响应头（含 Content-Length=member.size）已发出但无 body → 客户端收到截断文件（HTTP/1.1 keep-alive 下按长度缺失判定）。
- **严重度**：低
- **佐证**：L4049 `handler.send_header("Content-Length", str(member.size))`；L4053-4055 `src = tf.extractfile(member); if src: copyfileobj(...)`

### L4. `_archive_sweep_tmp` 误删多实例任务包
- **位置**：L4518-4532
- **问题**：按 `tk_*.zip` 前缀清扫系统临时目录；同机同时跑两个实例（不同端口）时，后启动实例删除先启动实例的未下载任务包。
- **严重度**：低

### L5. 反复 start/stop 线程累积（sweep 循环不回收）
- **位置**：`_start` L5026-5028 每次新起 `_trans_sweep_loop`/`_cache_sweep_loop`；`_stop` L5054-5062 不回收转码会话/打包线程/任务表
- **问题**：每次 drive_start 新增 2 个常驻 daemon 线程且永不退出；旧转码会话跨 stop 存活到 30s 空闲回收。反复启停 → 线程缓慢累积。
- **严重度**：低（低-中）

### L6. 证书：IP 变化不触发重建
- **位置**：`_cert_needs_rebuild` L4831-4848
- **问题**：只检查 SAN"有无 IP"，不检查当前 IP 集合是否已被覆盖；DHCP 换 IP 后新 IP 不在 SAN → 浏览器主机名不匹配，需等 7 天过期或手动删证书。`_cert_san`（L4808-4828）把虚拟网卡/隧道/临时 IPv6 地址也写入 SAN 与 URL 列表，可能给出不可达地址。
- **严重度**：低

### L7. X-Archive-Skipped 响应头截断损坏
- **位置**：`_stream_archive` L4476-4480
- **问题**：`payload[:8000]` 可能截断在转义/JSON 中间 → 前端 `decodeURIComponent`/`JSON.parse` 失败，整个跳过清单丢失。
- **严重度**：低

### L8. 同步 /dlzip 全量落临时盘再发送（大文件性能 + TOCTOU）
- **位置**：`_stream_archive` L4450-4484
- **问题**：先 `mkstemp` 写完整 zip 再读回发送：2x 磁盘 IO，客户端要等整个压缩完成才收到首字节；临时盘空间预检（L4434-4443）与写入之间存在 TOCTOU（检查后空间被占 → 写失败走错误页）。
- **严重度**：低（低-中，大包场景明显）

### L9. 上传（同 POST 路径旁注）：无大小上限 + FieldStorage 同步处理
- **位置**：do_POST /api/upload L1511-1547
- **问题**：无文件大小/总大小限制（磁盘填满 DoS）；`cgi.FieldStorage` 全量解析后才写盘；同名文件直接覆盖（设计如此）。不在本任务主线，旁注。
- **严重度**：低

### L10. 其它杂项
- `drive_pin` `os.path.getsize(p)`（L5152）文件被删时抛 OSError 未捕获（MCP 层转 isError，体验问题）；pinned 无上限累积。
- POST /api/archive body 无长度/条目数上限（L1483 `self.rfile.read(length)` 任意长度读入内存；paths 数组无数量限制）。
- token 熵 72 位（`secrets.token_urlsafe(9)` L5015）+ `--token` 允许弱口令（L5319-5320）+ HTTP 明文同端口可被嗅探（设计取舍）。
- `_start` 的 `_state["server"]` 检查（L5011）与创建非原子，并发 drive_start 第二个 bind 失败（allow_reuse_address=False 兜底，L1564）。
- `_archive_dl` 对 done 状态允许重复下载（L4751），每次走 downloading→done，无次数限制（带宽消耗）。

---

## 四、结论

| 级别 | 数量 | 关键项 |
|---|---|---|
| 高 | 3 | H1 打包根校验绕过（任意文件外传）、H2 rar/7z CLI 注入、H3 私钥网络分发+固定弱密码 |
| 中 | 9 | M1 7z stderr 死锁、M2 防火墙残留、M3 文件 reparse 跟随、M4 下载中被清理、M5 stop→start 任务失效、M6 取消不即时、M7 看门狗误杀、M8 slowloris 线程泄漏、M9 7z 全量列表性能 |
| 低 | 10 | 点文件不可下载、WinRAR 首文件、tar symlink 截断、多实例清扫互删、线程累积、证书 IP 过时、响应头截断、dlzip 双写、上传无上限、杂项 |

**优先修复**：H1（在 `_archive_new_task` 补根校验，一行级改动，收益最大）→ H2（entry 白名单匹配）→ M1（stderr drain）→ M2（启动前清同名规则 + 退出路径清理）。
