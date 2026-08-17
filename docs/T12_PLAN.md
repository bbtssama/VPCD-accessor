# 后端优化建议与实施方案（任务 t12）

- 依据：t9 交叉核验确认清单（6 高 + 22 中，全部【确认】）+ t4/t5/t6 原审计
- 对象：`server\server.py`（5325 行）；兼容目标 Python 3.10 / 3.11 / 3.12 / 3.13
- 分层：**快速修复（P0）→ 结构性改进（P1）→ 架构重构（P2）**
- 每条格式：①问题指向 ②优化方案（函数/模块级，含版本兼容）③预期收益 ④实施成本/风险 ⑤优先级

---

## 一、分层总览

| 层 | 优先级 | 条目 |
|---|---|---|
| 快速修复 | P0 | H-1 打包根校验、H-4 CLI 注入（字符校验版）、H-6 cgi 版本护栏、H-5 p12 收紧（快速版）、M1 _shares 锁、M2 cancel 锁、M11 stderr drain、M13 ADS 冒号清洗 |
| 结构性改进 | P1 | H-2 转码缓冲模型、H-3 缓存失效机制、H-5 p12 完整版、M3 原画锁粒度、M4 缓存谎报自愈、M5 下载豁免清理、M6 stop 清任务表、M7 转码并发上限、M8 probe 全局池、M9 稀疏文件计费、M14 安全响应头、M15 防火墙残留、M17 暂停保活、M18 transstatus 刷新、M19 文件 reparse、M21 看门狗判定 |
| 架构重构 | P2 | H-6 multipart 流式重写、M12 上传限流/配额（随 H-6）、M10 7z 列表复用、M16 连接超时体系、M20 取消模型、M22 Range 锚定/多段 |

---

## 二、高严重度（6 项）

### H-1. POST /api/archive 打包路径无根校验 → 任意文件读取/外传 【P0】

- **①问题指向**：do_POST `/api/archive`（L1486-1491）body `paths` 未过 `self._resolve`；`_archive_new_task`（L4544-4562）仅 `realpath`+`exists`。对照 `/dlzip`（L1450）与 `drive_pin`（L5141 `_under`）均有根校验——同功能入口不一致。
- **②方案**（双保险，推荐都做）：
  1. 路由层（首选，与 /dlzip 语义对齐）：L1486 后对每个 `paths` 元素 `p` 调 `self._resolve(p)`，任一为 None → `self._send_json({"error": "包含无效路径: %s" % p}, 403)` 整体拒绝；通过者进 `_archive_new_task`。这样"越界即 403"与 GET 侧一致，无部分打包歧义。
  2. 函数层防御（防未来新调用点绕过）：`_archive_new_task(paths, mode, roots=None)` 增加可选 `roots` 参数（缺省取 `_state["roots"]`，MCP 路径 `drive_pin` 已有 `_under` 可复用 L5195），循环内对 `ap` 做 `any(_under(r, ap) for r in roots)`，越界记入 `skipped`（reason="超出允许的根目录"）并跳过（不整体失败，任务内其它合法路径继续）。
- **③收益**：受限根部署下任意文件读取/外传被消除；与 /dlzip、drive_pin 三入口策略统一。
- **④成本/风险**：低。改动 2 处共约 10 行。风险：若前端曾依赖打包根外路径（正常不应有）会 403——预期行为；`roots` 缺省需保证 MCP 模式（`_state["roots"]`）与 HTTP 模式（`self.server.roots`）一致。
- **⑤优先级**：P0（安全模型击穿项，一行级收益最大）。

### H-2. persist 转码会话缓冲永不消费 → 内存膨胀 + 1.28MB/s 节流 【P0 快速 / P1 完整】

- **①问题指向**：`_trans_encode_thread`（L2885-2896）无条件 `session["buf"].extend(chunk)` + `pend>16MB` 时 sleep 0.05；唯一消费路径 `/api/trans` 只服务 persist=False 会话；transdl（L512）创建的 persist=True 会话 buf 无人读 → 全量输出驻留 RAM 且被永久节流。
- **②方案**：
  - 快速（P0）：**有落盘文件（cfile）的会话不写 buf**。L2885-2896 改为：
    ```python
    if session["cfile"] is None:            # 仅内存缓冲会话（MSE persist=False / 原画 remux）
        with session["lock"]:
            pend = len(session["buf"])
            session["buf"].extend(chunk)
            session["last"] = time.time()
        if pend > 16 * 1024 * 1024:
            time.sleep(0.05)
    else:                                    # persist 落盘会话：只写 cfile，零缓冲零节流
        session["last"] = time.time()
    ```
    说明：`cfile` 非 None ⟺ persist=True 且 start==0（L2956），即 transdl 场景；MSE 会话 cfile=None 路径行为不变。注意 `last` 仍要刷新（sweep 依据 `last_client`/`last` 兜底）。
  - 完整（P1）：把"是否入内存缓冲"提升为会话构造参数 `mem_buf`（在 `_trans_ensure_session` L2965-2972 初始化时按 persist 决定），`_trans_encode_thread` 依据 `session["mem_buf"]` 分支，语义更清晰、避免未来加字段时再猜。
- **③收益**：persist 转码内存从 O(文件大小) 降至 O(64KB)；速度从 ~1.28MB/s 恢复为 ffmpeg 原生输出（提速数倍～十余倍）；多并发 OOM 风险消除。
- **④成本/风险**：低-中。风险点：必须保证 persist=False（MSE）路径逐字节不变（回归重点）；`_trans_consume` 对 persist 会话永不被调用，其 wait/节流逻辑不受影响。
- **⑤优先级**：P0 快速部分（改动小、收益大）。

### H-3. 转码/原画/ASR 缓存键仅 sha256(realpath) → 源替换后静默陈旧 【P1】

- **①问题指向**：`_trans_digest`（L2588-2593）仅 realpath；`original.cache`（L3219）、ASR vtt（L3468）、转码档（L2606）均以该 digest 为唯一键。源文件替换（重下/更新）后：original.cache 稀疏文件按旧 size/区间服务旧字节、ASR 返回旧字幕；转码档表现为 available 误报+不必要重转（persist 重建会截断自愈）。对照 `_thumb_path`（L2549，键含 size|mtime）。
- **②方案**（推荐失效比对，而非改键）：
  1. 新增 helper：`def _src_stamp(path) -> tuple|None:` 返回 `(os.path.realpath(path), os.path.getsize(path), int(os.path.getmtime(path)))`；`def _src_changed(path, saved: tuple) -> bool:` 比对。
  2. 每缓存目录（`_trans_dir`）写入 `src.info`（json：stamp），原子写（tmp+`os.replace`）：
     - `_stream_cached_locked`（L3318-3364）开头：读 `src.info` 比对，不匹配 → 重置 `original.cache`（truncate 为新 fsize）+ 清空区间集合 `.json`（写新 stamp）；
     - `_asr_transcribe`（L3490-3535）读缓存前比对，不匹配 → 删旧 vtt 重转；
     - `_trans_available`/`_trans_ready`（L3133-3165）比对，不匹配 → 视为不可用（触发重建）。
  3. `_cache_sweep_once` 保留旧 src.info 清理（文件级删除天然覆盖）。
- **③收益**：源替换后所有派生缓存立即失效重建，杜绝静默内容错乱（原画缓存=播旧内容、ASR=旧字幕）。
- **④成本/风险**：中。改动点 4 处 + 1 个 helper；并发读写 `src.info` 需原子写与容忍（写失败按"视为已变更"处理，保守重建）。风险：旧缓存目录遗留（无 src.info 视为失效，首次访问重建即可，无需迁移）。
- **⑤优先级**：P1（静默数据错误，建议 P1 首做；若团队风险偏好高可提前 P0）。

### H-4. rar/7z 条目下载 CLI 注入（开关/通配符/@listfile）【P0】

- **①问题指向**：`/api/unpackdl`（L1392-1399）`entry = q.get("entry")` 无过滤；`_dl_7z`（L4067-4068）与 `_dl_winrar`（L4113）把 entry **原样**拼进外部 CLI：`-` 前缀被当开关（-p/-x/-t/-i）、`*?` 通配符匹配多条目（-so 拼接 + Content-Length 失真）、WinRAR `@listfile`。
- **②方案**：
  - 快速（P0，字符级拒绝，5 行）：在 `_unpack_download`（L4143）分发前统一校验：
    ```python
    if (entry.startswith(("-", "@")) or "*" in entry or "?" in entry
            or ".." in entry.replace("\\", "/").split("/")):
        handler._send_json({"error": "压缩包内没有该条目"}, 403); return
    ```
  - 完整（P1，白名单匹配）：对 7z/rar 分支，先用 `_seven_list(tool, archive)` 取全部 `Path`（归一化 `\\`→`/`、剥 `./`），要求 entry 与某一 Path **精确相等**才放行（与 zip/tar 的 namelist/getmembers 精确匹配语义一致）；顺带复用该列表供 `_seven_entry_size`（见 M10）。
- **③收益**：CLI 注入面关闭；通配符内容错乱消除；与 zip/tar 分支行为对齐。
- **④成本/风险**：低（快速版零子进程开销）。风险：快速版可能误拒合法但怪异的条目名（如以 `-` 开头的中文包名——实际极罕见，且白名单版可解）；白名单版首次调用会触发一次全量列表（性能见 M10）。
- **⑤优先级**：P0（快速版立即上；白名单版随 P1）。

### H-5. p12 私钥网络分发 + 固定弱密码 + 明文落盘 【P0 快速 / P1 完整】

- **①问题指向**：`/api/certp12`（L1355-1370）任意持 token 者可下载含私钥 p12；密码硬编码 `"1234"`（L4886）；私钥 `NoEncryption` 落盘（L4874-4881）；服务同端口支持 HTTP 明文（L1573-1601），token 在 URL → 局域网嗅探即私钥+密码全泄露。
- **②方案**：
  - 快速（P0）：
    1. **p12 仅 HTTPS 提供**：`/api/certp12` 路由开头判定当前连接是否 TLS（`isinstance(self.connection, ssl.SSLSocket)`，需 import ssl——已 import L34），非 TLS → 403 JSON"请使用 https:// 地址下载证书"；
    2. **随机密码**：模块级 `CERT_P12_PASSWORD = secrets.token_urlsafe(8)`（L4886 替换），并在 `_start` 返回值与 CLI 启动输出（L5041-5051、L5289-5294）打印 p12 密码与安装说明（手机需手动输入）。
  - 完整（P1）：
    3. 私钥文件 ACL：`_ensure_cert` 生成后调用 `icacls <keyfile> /inheritance:r /grant:r %USERNAME%:R`（best-effort，失败不阻塞）；
    4. p12 一次性领取：下载成功一次后删除 p12 生成缓存/标记已领取（`_cert_p12_bytes` 为内存生成，无磁盘产物——可加 `_cert_p12_issued` 标志，再次请求需重新确认）。
- **③收益**：私钥泄露面大幅收窄（明文 HTTP 拿不到私钥、密码不再公开可猜）；密钥文件仅当前用户可读。
- **④成本/风险**：低-中。风险：手机安装流程需输入随机密码（README 需同步更新，否则用户卡在安装步骤）；icacls 在非管理员/非 NTFS 下失败需静默降级。
- **⑤优先级**：P0（HTTPS-only + 随机密码两项改动小、立即见效）。

### H-6. `import cgi` 在 Python 3.13 已移除 【P0 护栏 / P1 替换】

- **①问题指向**：L21 `import cgi` 裸导入（无 try）；L1522-1525 用 `cgi.FieldStorage` 解析上传。PEP 594 在 3.13 移除 cgi → 3.13+ 模块加载即 ModuleNotFoundError，MCP/CLI 全挂。
- **②方案**：
  - 快速护栏（P0）：L49-57 的 cryptography try-import 同款风格：
    ```python
    try:
        import cgi
    except ModuleNotFoundError:
        sys.stderr.write(
            "当前 Python %d.%d 已移除标准库 cgi（PEP 594）。"
            "请使用 Python 3.10-3.12，或 pip install legacy-cgi 后重试。\n"
            % sys.version_info[:2])
        raise
    ```
    保证 3.13 下给出**可操作**提示而非裸崩溃（legacy-cgi 提供同 API 的 `cgi.FieldStorage`，一行依赖即可兼容）。
  - 完整替换（P1/P2，见 M12 与 P2 层）：自实现流式 multipart 解析（基于 `email.parser` 或手写 boundary 切块），彻底移除 cgi 依赖，同时实现大小上限/ADS 清洗/覆盖策略。兼容性：`email` 模块在 3.10-3.13 全部可用；手写解析需严格按 RFC 2046（`--boundary` 行、`--boundary--` 结束、CRLF）。
- **③收益**：3.13+ 不再全挂（护栏给出出路）；完整替换后上传内存优化 + 限流（见 M12）。
- **④成本/风险**：护栏=低/零风险；完整替换=中（multipart 解析需充分回归，见验收节）。
- **⑤优先级**：P0（护栏，2 分钟级）；P1-P2（替换，随 M12）。

---

## 三、中严重度（22 项）

### 并发 / 一致性（6 项）

**M1. `_shares` 全局字典无锁 →【P0】**
- ①：L100-101 定义，创建/清过期/持久化（L1274-1276、L1315-1317、L1004/L1277/L1318、L3648-3657）均无锁；并发 `json.dump` 互踩 + 字典并发修改 RuntimeError（`_save_shares` 只 except OSError）。
- ②：新增 `_shares_lock = threading.Lock()`（L101 旁）；`_save_shares` 锁内取快照 `snap = dict(_shares)` 后**释放锁**再写盘（缩短持锁）；创建/清理/`api/sharesub` 的读写包锁。模块加载 `_load_shares`（L3661）在单线程期，无需锁。
- ③：消除分享丢失/偶发 500。
- ④：低；约 15 行。风险：锁序（_shares_lock 与其它锁不嵌套，无死锁风险）。
- ⑤：P0。

**M2. /api/archive/cancel 在 task 锁下改全局表 →【P0】**
- ①：L1503-1508 `with task["lock"]: _archive_delete_task(task)` 未取 `_ARCHIVE_TASKS_LOCK`；L4514 pop 与 L1403-1404/L4695-4713 持锁迭代并发 → RuntimeError。
- ②：cancel 分支先 `with _ARCHIVE_TASKS_LOCK:` 再 `with task["lock"]:`（锁序：全局表锁→任务锁，与 `_archive_poll_cleanup`/`_archive_dl` 一致，无环）。
- ③：消除 pop-vs-迭代崩溃。
- ④：低；2 行缩进调整。风险：锁序一致性需全表核对（已在 t5 确认无环）。
- ⑤：P0。

**M3. 原画缓存 per-digest 锁横跨网络 I/O →【P1】**
- ①：L3301-3303 `with _original_cache_lock(path): _stream_cached_locked(...)` 内含 `wfile.write` 全量循环（L3356）→ 同视频并发流串行化、慢客户端阻塞其它请求。
- ②：拆分为"锁内准备数据/更新缓存状态 + 锁外写网络"：`_stream_cached_locked` 每段在锁内（读源或读缓存 + 写缓存 + merge）产出 ≤1MB 内存块，锁外 `handler.wfile.write(block)`；或改为两段式：锁内完成区间查询与预读（sock 数据块），锁外发送。另将"正在服务的 digest"登记进 `_cache_sweep_once` 的 busy 集（防锁外写期间被清扫删除）。
- ③：同视频多端并发流畅；慢客户端不再卡死其它请求。
- ④：中；重构 1 个函数。风险：缓存一致性与清扫竞态（busy 登记必须同步做）。
- ⑤：P1。

**M4. 原画缓存"写失败仍 merge 谎报 + 清扫可删 original.cache" →【P1】**
- ①：L3350-3351 `except OSError: pass` 后 L3352-3353 仍 `_original_cache_merge` → 区间谎报已缓存；L3087-3092 busy 集只含 cfile 不含 original.cache → 清扫可删正在服务的缓存 → 后续短读/零字节。
- ②：a) 写成功才 merge（`if data: try写; if 写成功: merge else: 不 merge`）；b) `_cache_sweep_once` 的 busy 集加入全部 `original.cache`（遍历 `_original_cache_locks` 键构造路径，或对 .cache/.json 加"最近访问"保护）；c) 自愈：读缓存分支 `open(cp,"rb")` 失败时从 `ranges` 摘除该区间并回源读（`_resolve_segment` 加失败回退）。
- ③：区间级静默损坏消除且可自愈。
- ④：中；3 处小改。风险：区间摘除需在 per-digest 锁内做。
- ⑤：P1。

**M5. 惰性清理杀下载中任务 →【P1】**
- ①：`_archive_poll_cleanup`（L4697-4713）对 `downloading` 状态也执行 TTL 取消+删除、超上限逐出 → 慢速大包下载被静默中断，open 中的 zip 删除失败留孤儿。
- ②：`downloading` 豁免 TTL 与逐出（`stale` 与 `finals` 过滤排除 downloading）；TTL 对 downloading 从"开始下载"（`_archive_dl` 置 downloading 时刻）起算；删除前确认非 downloading。
- ③：合法慢速下载不被中断。
- ④：低；条件过滤。风险：任务表可能因豁免而短暂超 16 条——可容忍（逐出跳过 downloading 后继续逐出其它终态）。
- ⑤：P1。

**M6. stop→start 后 ready 任务失效 →【P1】**
- ①：`_stop`（L5054-5062）不清 `_ARCHIVE_TASKS`；`_start`（L5003）调 `_archive_sweep_tmp`（L4518-4532）删全部 `tk_*.zip` → 旧任务 ready 残留但包已删，`/api/archive/dl` 回滚 ready 死循环。
- ②：`_stop` 在 `_remove_firewall_rule` 前清任务表：对每个任务 `cancel_evt.set()` + `_archive_delete_task(task)`（持 `_ARCHIVE_TASKS_LOCK`）；或 `_start` 清扫前按任务表排除活跃任务（保留仍在下载的）。
- ③：生命周期语义正确，stop→start 后任务列表干净。
- ④：低。风险：stop 时正在下载的任务——cancel 后下载循环收敛（已有 _ArchiveAborted 路径）。
- ⑤：P1。

### 资源 / 性能（5 项）

**M7. 转码会话无并发上限 →【P1】**
- ①：`_trans_ensure_session`/`_trans_ensure_remux`（L2976-2978、L3017-3019）每会话起线程、无信号量（对照打包有 `_ARCHIVE_SEM`）。
- ②：新增 `_TRANS_SEM = threading.Semaphore(N)`（N 默认 2~4，可配置）；在 `_trans_encode_thread` 入口 `acquire`、`finally` `release`（持锁在转码线程生命周期内，避免在会话表锁内 acquire）；`_trans_ensure_*` 在 `_ffmpeg_capabilities` 后检查 `_TRANS_SEM` 是否可获取——不可得时返回"转码忙"错误（前端已有 transstatus/409 进度机制可展示排队）。
- ③：ffmpeg 进程数有界，CPU 耗尽 DoS 关闭。
- ④：中。风险：并发转码变排队，需前端展示排队态（api/trans 返回 409/429 类响应）。
- ⑤：P1。

**M8. `_probe_video_meta` 每执行器 8 worker 叠加 →【P1】**
- ①：L2244-2259 `ThreadPoolExecutor(8)` + `shutdown(wait=False)` + 立即释放锁 → 连续 meta=1 请求叠加 ffprobe 进程。
- ②：改为**模块级单例执行器**：`_VIDEO_PROBE_POOL = ThreadPoolExecutor(max_workers=_VIDEO_PROBE_WORKERS)`（模块加载或首用时 lazy 创建），`_probe_video_meta` 只提交任务；8 worker 全局收敛，多余提交自然排队；`_VIDEO_PROBE_LOCK` 保留用于"单次批量预算"语义（或去掉，靠池上限即可）。
- ③：ffprobe 进程全局 ≤8，列表翻页风暴消除。
- ④：低-中。风险：单例池生命周期（进程存活期常驻，可接受）；shutdown 语义调整需回归。
- ⑤：P1。

**M9. 稀疏文件按逻辑 size 计入缓存预算 →【P1】**
- ①：`original.cache` `truncate(fsize)`（L3325-3330）→ `st.st_size`=全片；`_cache_sweep_once`（L3104-3105）按 st_size 计 total → 大视频恒超 2GB → 删光其它缓存。
- ②：计费改用**实际占用**：解析对应 `.json` 区间集合，`实际字节 = sum(b - a + 1 for [a,b] in ranges)`；无区间/无 json 按 0；仍无结果再回退 st_size（保守）。`total` 计算处（L3104-3105）对 `.cache` 文件特殊处理。
- ③：缓存治理恢复正常，大视频不再打爆预算、不再反复删改。
- ④：低。风险：区间集合解析需容错（损坏 json 按 0/保守处理）。
- ⑤：P1。

**M10. 7z 列表/大小查询每次全量子进程 →【P2】**
- ①：`_seven_list`（L3877-3903）每次全量 `capture_output`；`_seven_entry_size`（L3969-4003）每次下载重跑整包 `l -slt`。
- ②：a) `_seven_entry_size` 复用 H-4 白名单匹配时已取的列表（传入/缓存）；b) 或直接放弃 size 预查，走 close-delimited 传输（L4080-4087 已有分支，HTTP/1.1 + Connection: close 即可）——**下载路径完全省去第二次全量列表**；c) 列表浏览结果按 (archive realpath, size, mtime) 做进程内缓存（TTL 或惰性失效）。
- ③：下载不再 O(包条目数)；浏览重复请求命中缓存。
- ④：低-中。风险：close-delimited 分支对代理/断点续传支持弱（下载器兼容性）——若接受可先做 b，否则做 a/c。
- ⑤：P2。

**M11. `_dl_7z` stderr 管道死锁 →【P0】**
- ①：L4067-4106 stdout/stderr 双 PIPE，主循环只读 stdout（L4089-4093），stderr 仅 finally 读（L4100）→ 7z 大量 stderr（损坏包）填满管道缓冲（Windows 约 4KB）→ 写阻塞 → read 永久阻塞 → 请求线程挂起。
- ②：启动**独立 drain 线程**读 stderr（`threading.Thread(target=lambda: proc.stderr.read(), daemon=True).start()`），主循环结束后 `join`；或对 `proc.stdout.read` 循环加总超时（如 300s 上限）。推荐 drain 线程（行为最干净）。
- ③：畸形包下载不再挂死线程（ThreadingHTTPServer 线程耗尽 DoS 关闭）。
- ④：低；3 行。风险：drain 线程 daemon 即可，无泄漏。
- ⑤：P0（线程挂起=可用性 DoS）。

### 上传 / 文件（2 项）

**M12. 上传覆盖同名 + 无大小限制 →【P1-P2，随 H-6 multipart 重写】**
- ①：L1539-1546 `open(dest,"wb")` 截断覆盖 + 无 Content-Length/配额检查 → 覆盖共享目录同名文件、磁盘填满 DoS。
- ②（与 H-6 替换同批实施）：multipart 流式解析器内：a) 单文件/单请求大小上限（配置项，如 `UPLOAD_MAX_BYTES`，默认建议 1GB 可调）；b) 同名冲突策略：默认**拒绝覆盖**（`if os.path.exists(dest): 记 errors 返回 409/冲突提示`）或自动加后缀 `(1)`；c) 总请求体上限（`Content-Length` 预检）。
- ③：磁盘耗尽 DoS 关闭；与"只写不删改"设计意图对齐。
- ④：中（随解析器重写）。风险：拒绝覆盖可能改变现有 UX（前端需提示"文件已存在"）。
- ⑤：P1（策略）/ P2（解析器随 H-6）。

**M13. 上传文件名 ADS 冒号 →【P0】**
- ①：L1539 `os.path.basename(fname)` 保留 `:` → `open(dest,"wb")` 写备用数据流（无可见文件）。
- ②：L1539 后清洗：`name = name.split(":", 1)[0].strip().rstrip(". ")`（Windows 文件名禁尾随点/空格）；可选再拒绝 Windows 保留名（CON/PRN/AUX/NUL/COM1-9/LPT1-9，含 `name.` 变形）；name 为空回退 `"file"`。
- ③：ADS 隐蔽写入/覆盖关闭。
- ④：极低；3 行。风险：无（正常文件名不含冒号）。
- ⑤：P0。

### 安全纵深（3 项）

**M14. 安全响应头缺失 + token 在 URL →【P1】**
- ①：`_send_json`(L139)/`_send_html`(L157)/`_send_view_html`(L148)/`_send_file_range`(L284)/`_send_error_page`(L237) 均无 nosniff/Referrer-Policy/CSP/X-Frame-Options；token 在 URL 无 Referrer-Policy 兜底。
- ②：抽 `_send_common_headers()` helper（Content-Type 之外统一注入）：
  - 全部响应：`X-Content-Type-Options: nosniff`、`Referrer-Policy: no-referrer`；
  - HTML 页面：追加 `X-Frame-Options: DENY` + `Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'`（按 index.html/app.js 实际资源定制，需实测不误伤内联脚本/样式/缩略图 data:）。
  - 注入点：`_send_json`/`_send_html`/`_send_view_html`/`_send_error_page`/`_send_file_range` 收尾统一调用。
- ③：token 不进 Referer；点击劫持/嗅探型攻击无纵深面关闭。
- ④：低-中。风险：CSP 若与前端资源不符会打断页面功能——必须实测首页/预览/分享页/视频播放全流程后再上线 CSP 行。
- ⑤：P1。

**M15. 防火墙规则残留 →【P1】**
- ①：`_add_firewall_rule`（L4966）唯一删除点是 `_stop`（L5061）；看门狗 `os._exit(2)`（L5278）、CLI 自检失败退出（L5304）、崩溃/强杀均不清理；netsh 同名规则可累积。
- ②：a) `_start` 添加前先 `netsh advfirewall firewall delete rule name=TransferMCP-<port>`（best-effort，防同名累积）；b) `os._exit(2)` 前（L5274-5278、L5304 前）尝试 `_remove_firewall_rule(port)`（try/except 包裹，不阻塞自杀）；c) 可选：规则名带 PID（`TransferMCP-<port>-<pid>`），按 PID 精确清理，避免多实例互删。
- ③：安全状态随进程生命周期收敛，规则不残留/不累积。
- ④：低。风险：netsh 调用需管理员权限（已有 best-effort 语义）。
- ⑤：P1。

**M16. slowloris / 半开连接线程泄漏 →【P2】**
- ①：`get_request`（L1580-1587）peek 1s 超时后 `settimeout(None)`；明文请求行读取无超时；`daemon_threads=True` 无上限 → 半开连接耗尽线程。
- ②：a) 明文分支设置请求头读取超时：peek 后非 TLS 连接 `sock.settimeout(15)`（覆盖 `handle_one_request` 的请求行/头部读取，body 传输前再 `settimeout(None)`——需覆盖 `handle_one_request` 或子类 `send_response` 时机，简单做法：`_DriveHandler.handle_one_request` 开头 `self.connection.settimeout(15)`，读完后 `settimeout(None)` 再处理 body）；b) 或 `_DriveServer` 维护连接计数 + 上限拒绝。
- ③：半开连接有界，slowloris DoS 关闭。
- ④：中。风险：超时作用域必须精确（不能误伤大文件 Range 传输——传输阶段已 settimeout(None)）。
- ⑤：P2。

### 媒体行为（3 项）

**M17. 播放暂停 >30s 会话被回收 → 续播花屏 【P1】**
- ①：`_trans_consume`（L3045）`last_client` 仅取到数据时刷新；暂停/缓冲满停止拉取 → 30s 后 sweep（L3067）回收 → 恢复播放 offset/moof 不连续。
- ②：a) `_trans_consume` 超时返回（L3050-3051 `return b"", False, offset`）时也刷新 `last_client`（轮询即活跃信号）；b) 与 M18 合并：任何针对该会话的 API 请求（trans/transstatus）都 touch last_client。
- ③：暂停 >30s 续播不再断流/花屏。
- ④：低。风险：空闲超时从"真空闲"变为"无请求"——可接受（会话本就有 30s 上限，过度保留风险小；如需更严格可加"最后产出时间"双条件）。
- ⑤：P1。

**M18. transstatus 轮询不刷新 last_client →【P1】**
- ①：`/api/transstatus`（L478-494）只读 session，不 touch last_client（L510-512 注释声称"轮询刷新"仅 transdl 路径成立）。
- ②：transstatus 路由取到目标会话后统一 `sess["last_client"] = time.time()`（在 `_trans_ready`/`_trans_progress_estimate` 内或路由层 touch）。
- ③：纯状态轮询的转码会话不再被误回收、进度不归零。
- ④：极低；1-2 行。风险：无。
- ⑤：P1。

**M19. 打包扫描跟随文件级 reparse 点 →【P1】**
- ①：`_scan_plan`（L4284-4296）文件分支无 reparse 检查（目录分支 L4271-4279 有），链接文件被 open() 跟随 → 根外内容入包（OneDrive 占位符场景）。
- ②：文件分支补与目录分支相同的检查：`e.stat(follow_symlinks=False).st_file_attributes & 0x400` 命中 → `skipped.append({"path": e.path, "reason": "链接文件未包含"})` + continue。
- ③：根外隐私内容不入包。
- ④：低；4 行。风险：占位符文件（云盘）将不可打包——属预期行为（与目录 junction 策略一致），前端 skipped 清单会展示原因。
- ⑤：P1。

### 可靠性（3 项）

**M20. 打包取消不即时 →【P2】**
- ①：`_archive_worker`（L4608-4618）信号量 acquire 无取消检查、`_scan_plan` 扫描全程无取消检查 → 取消延迟=扫描时长。
- ②：a) `_scan_plan(items, cancel_evt=None)` 增加可选 Event，expand 循环内每处理 N 个条目（如 500）检查一次，命中抛 `_ArchiveAborted`；b) 工人信号量等待改为：先查 `cancel_evt`，再 `_ARCHIVE_SEM.acquire()`（仍阻塞——可接受，或换 `threading.Event` 半信号量实现）。
- ③：取消响应即时（扫描百万文件也秒级收敛）。
- ④：中。风险：`_scan_plan` 被 `/dlzip` 同步路径复用——新增参数默认 None 不改变同步行为。
- ⑤：P2。

**M21. 看门狗误杀健康服务 →【P1】**
- ①：`_http_probe_ok`（L5250-5260）timeout=3；`_start_watchdog`（L5263-5280）连续 3 次失败 `os._exit(2)` → 磁盘 IO 饱和/大打包时误杀整进程。
- ②：a) 探测改双判定：先 `socket.create_connection((host, port), timeout=2)` 验证 TCP 可达 + 进程存活（`_state["server"] is not None` 且线程活着），再 HTTP 探测；TCP 通但 HTTP 超时才累计失败（真僵死判定）；b) 全局"忙任务计数"（打包/转码进行中）时暂停看门狗计数或放宽阈值；c) `os._exit(2)` 前 best-effort `_stop()` 清理防火墙/任务表。
- ③：大任务场景不再被误杀；真僵死仍能自愈重启。
- ④：中。风险：判定逻辑复杂化——保持"连续失败才自杀"的保守语义。
- ⑤：P1。

**M22. Range 解析不符 RFC 7233 →【P2】**
- ①：`_send_file_range`/`_stream_cached`（L298、L3273）`re.match(r"bytes=(\d*)-(\d*)")` 未锚定：多段 Range 静默只回第一段、`bytes=0-1xyz` 静默忽略尾缀、无 If-Range。
- ②：a) 正则锚定：`re.match(r"bytes=(\d*)-(\d*)$", ...)` + 显式拒绝含 `,` 的多段（返回 416 + `Content-Range: bytes */total`，比静默截断更符合规范且实现成本最低）；b) 完整 multipart/byteranges 实现（成本高，收益低——主流客户端单段，不推荐）；c) 可选补 If-Range（用文件 mtime 作弱校验）。
- ③：行为可预测、符合 RFC；不再静默返回错误内容。
- ④：低（拒绝多段）到中（multipart 完整实现）。
- ⑤：P2。

---

## 四、实施顺序（可执行阶段）

| 阶段 | 内容 | 预估工作量 | 交付物/验证 |
|---|---|---|---|
| **阶段 1：安全与并发正确性（P0）** | H-1 根校验、H-4 字符校验、H-6 护栏、H-5 快速版、M1 _shares 锁、M2 cancel 锁、M11 stderr drain、M13 ADS 清洗 | 0.5-1 天 | 全部 P0 项落地；安全回归清单过一遍 |
| **阶段 2：媒体管线（P1）** | H-2 缓冲模型、H-3 缓存失效（src.info）、M3 锁粒度、M4 谎报自愈、M7 转码并发、M8 probe 池、M9 稀疏计费、M17 保活、M18 transstatus 刷新 | 1.5-2 天 | 转码/播放/缓存替换场景回归 |
| **阶段 3：打包与系统（P1）** | M5 下载豁免、M6 stop 清任务、M15 防火墙、M19 reparse、M21 看门狗、M14 安全头（CSP 单独实测）、H-4 白名单版、H-5 完整版 | 1-1.5 天 | 打包/分享/启动/停止回归 |
| **阶段 4：架构重构（P2，分批）** | H-6 multipart 重写 + M12 限流/覆盖策略、M10 7z 列表复用、M16 连接超时、M20 取消模型、M22 Range 锚定 | 2-3 天，可分 2-3 个批次 | 上传压力/慢速连接/超大型包场景测试 |

**依赖关系**：阶段 1 无依赖，先行；M12 依赖 H-6 重写；M10 依赖/可与 H-4 白名单版合并；M14 的 CSP 需前端配合实测（可先只加 nosniff/Referrer-Policy，CSP 后置）；M17/M18 合并实现。

---

## 五、验收要点与回归测试建议

### 验收要点（按阶段）

**阶段 1**
- H-1：`drive_start(root=<单目录>)` 后 POST `/api/archive` 传根外路径 → 403（路由层）/ skipped（函数层）；根内路径正常打包下载；`/dlzip` 回归无变化。
- H-4：请求 `entry="-p1"` / `"*.exe"` / `"@list"` / `"a/../b"` → 403；正常 7z/rar 条目下载 OK（zip/tar 不受影响）。
- H-6：Python 3.13 下启动打印明确提示（legacy-cgi 或降级）；3.10-3.12 上传回归。
- H-5：HTTP 明文请求 `/api/certp12` → 403；HTTPS 正常下载；启动输出含随机 p12 密码。
- M1：并发 50 线程创建分享 + 同时 /api/archives 轮询 → 无异常、无丢失、shares.json 完整。
- M2：并发 cancel 与 /api/archives 轮询 100 轮 → 无 RuntimeError。
- M11：构造损坏 rar（多坏条目）下载 → 请求线程正常返回错误页（不挂起）；`threading.active_count()` 不增长。
- M13：上传 `evil.txt:stream` → 落盘为 `evil.txt`（无 ADS）；`dir /r` 验证无备用数据流。

**阶段 2**
- H-2：transdl 1GB 视频：内存峰值 <200MB、转码速率 >1.28MB/s；`/api/trans` MSE 播放（persist=False）回归逐字节行为不变。
- H-3：同路径替换源文件（改 size/mtime）→ original.cache/ASR vtt 立即失效重建；transstatus available 不再误报。
- M3：两个客户端并发拉同一视频 cache=1 大 Range → 均正常完成，无串行等待（对比修复前计时）。
- M4：删除 original.cache 后请求该区间 → 自动回源（无短读/黑屏），.json 区间自愈。
- M7：并发请求 10 个不同视频 /api/trans → ffmpeg 进程数 ≤ 配置上限（Task Manager 验证）。
- M8：连续快速翻 5 个大目录（meta=1）→ ffprobe 进程 ≤8。
- M9：缓存一个 4GB 视频（cache=1 播一段）后 total 不再恒超 2GB，其它缓存不被清空。
- M17/M18：播放暂停 60s 后恢复 → 连续流不断；仅 transstatus 轮询的转码任务 60s 后不被回收。

**阶段 3**
- M5：>30min 慢速下载大包 + 轮询 /api/archives → 下载不中断。
- M6：drive_stop → drive_start 后 /api/archives 为空（旧任务不残留）。
- M15：kill -9 服务进程后重启 → `netsh advfirewall firewall show rule name=TransferMCP-<port>` 无残留/无累积。
- M19：根内放一个指向根外的 mklink 文件 → 打包时进 skipped（"链接文件未包含"），zip 内无链接内容。
- M21：模拟磁盘 IO 饱和（大打包中）→ 看门狗不自杀；真僵死（停 serve_forever）→ 仍 3 次探测后退出。
- M14：首页/预览页/分享页/视频播放/上传全流程无 CSP 报错（DevTools console 检查）。

**阶段 4**
- H-6/M12：3.13 下上传大文件（>500MB）→ 内存平稳（流式）、超限被拒；同名上传 → 按策略拒绝/改名。
- M16：500 个半开连接（不发请求行）→ 线程数有界（15s 后回收）；正常大文件下载不受影响。
- M20：打包 100 万文件目录 → 取消 2 秒内收敛（aborted）。
- M22：`Range: bytes=0-1,4-6` → 416（非静默首段）；`bytes=0-100` 正常 206。

### 回归测试建议

1. **手工冒烟清单**（每阶段必跑）：启动（CLI + MCP 双模式）→ 浏览/隐藏文件/denied 目录 → 上传（中文名/GBK 名）→ 下载（含 Range 断点续传）→ 分享（单/多/虚拟/二次/过期）→ 打包（同步 dlzip + 后台任务 + 取消）→ 解压浏览（zip/tar/rar/7z + 条目下载）→ 视频（stream/trans 三档/transdl/字幕/ASR/缩略图/帧/条）→ 文本预览（GBK/UTF-16/二进制拦截）→ lnk → 证书（crt/p12 安装）→ 防火墙 → 看门狗。
2. **并发脚本**（Python 脚本即可）：用 `ThreadPoolExecutor` 并发打分享创建/打包取消/上传同名/原画缓存流，验证无异常、无数据损坏；`threading.active_count()` 在畸形请求后不增长。
3. **自动化基线**（若引入 pytest）：为 `_resolve/_resolve_share_path/_build_virtual_nodes/_archive_fmt/_fix_zip_name/_fix_tar_name/_smart_decode/_parse_comment_meta/_range 解析/_original_cache_merge/_trans_digest 失效比对` 等纯函数补单元测试（约 20-30 个用例，零依赖纯逻辑），防止 H-1/H-3/H-4/M13/M22 等回归。
4. **版本矩阵**：3.10/3.11/3.12/3.13 各跑一次"启动 + 上传 + 下载"冒烟（阶段 1 与阶段 4 后必做）。

---

## 六、附注（t9 之外顺带发现，供参考不属确认清单）

- L4842 `cert.not_valid_after_utc` 依赖 `cryptography >= 42.0`（旧版仅 timezone-naive 的 `not_valid_after`）——若部署环境 cryptography 较旧，`_cert_needs_rebuild` 会 AttributeError；建议 `getattr(cert, "not_valid_after_utc", None) or cert.not_valid_after` 兼容。
- `_state` 读写无锁（并发 drive_start/stop 的 MCP 调用）——drive_start 已有 `_state["server"]` 检查 + bind 兜底，风险低，可随 M1 一并加锁（低成本）。
- 转码档陈旧（H-3 nuance）：转码档 `available` 误报问题建议随 H-3 的 src.info 一并解决（比对不匹配即不可用），无需单独条目。
