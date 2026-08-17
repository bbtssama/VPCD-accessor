# 后端审计交叉核验报告（任务 t9）

- 核验对象：T4_AUDIT.md（路由/安全）、T5_AUDIT.md（媒体管线）、T6_AUDIT.md（打包/解压/系统集成）
- 核验方法：作为扫描员（t1 已通读 server\server.py 全部 5325 行 + mcp_stdio.py 240 行），对三份清单全部高/中危发现回读源码逐条核实（行号、引文、逻辑链），低危代表性抽验；关键争议点（H1 全链、cgi 导入、转码缓冲、缓存键）额外重读确认
- 结论总览：**三份清单质量高，全部 高/中 发现经核实为【确认】，0 误报；行号/引文准确；严重度整体合理**（个别条目附 nuance 修正，不影响确认）

---

## 一、重点核验项（船长指定）

### 1. H1 重叠项：POST /api/archive paths 无 _resolve 根校验（t4 H1 + t6 H1）→【确认】

回读证据（本轮重读）：
- L1486-1491（do_POST /api/archive）：`paths = body.get("paths")...` → 直接 `_archive_new_task(paths, mode)`，**全程无 `self._resolve`**；
- L4544-4562（`_archive_new_task`）：仅 `os.path.realpath(p.strip())`（L4548）+ `os.path.exists`（L4558），**无 commonpath/_under 根内校验**；
- 对照 L1450（GET /dlzip）：`paths = [self._resolve(x) for x in raw.split("|") if x]` —— 有根校验，**同功能两条入口不一致，属疏漏而非设计**；
- 另对照 L5141（drive_pin）：有 `_under(root, p)` 校验。
- 影响链完整：任务就绪后 GET `/api/archive/dl`（L1414-1420 → `_archive_dl` L4744）下载完整 zip。

判定：【确认】。行号准确、引文准确、严重度"高"合理（`drive_start(root=<单根>)` 受限部署 = 任意文件读取/外传；默认全盘 root 下危害降级但仍触及根外 UNC 等）。**t4/t6 两处报告一致，去重为一条。**

### 2. t4 H2：import cgi 3.13 移除 →【确认】（附运行版本 nuance）

- L21 `import cgi` 为模块级**裸导入**（无 try/except）——本轮重读确认；L1522-1525 使用 `cgi.FieldStorage`。
- 事实核验：cgi 属 PEP 594 移除清单，**Python 3.13 已移除**（证据：[legacy-cgi PyPI「removed in Python 3.13」](https://pypi.org/project/legacy-cgi/#1)、[Python 3.13 文档](https://docs.python.org/zh-cn/3.13/library/cgi.html)）。
- 3.13+ 下模块加载即 ModuleNotFoundError → MCP/CLI 双模式全不可用；项目 `__pycache__` 存在 cpython-313 pyc（仅证明编译过，与运行崩溃兼容）。
- nuance：3.10/3.11/3.12 下不崩（3.11+ 仅 DeprecationWarning），严重度依赖部署 Python 版本；审计已自注"运行环境 3.13+ 时"，标注合理。

判定：【确认】。行号/引文准确；高合理（升级即全挂、无降级路径）。

### 3. t5 H1：persist 转码会话缓冲永不消费 →【确认】

- L2885-2896（本轮重读）：`session["buf"].extend(chunk)` **无条件入缓冲**；`if pend > 16*1024*1024: time.sleep(0.05)`（L2895-2896）→ 64KB/0.05s ≈ **1.28MB/s 节流**。
- 唯一消费路径 `/api/trans` 只服务 persist=False 会话（L467 `_trans_consume`）；transdl（L512，本轮重读）只 `_trans_ensure_session(..., True)` + 读 cfile，**persist=True 会话的 buf 无人消费** → 全量转码输出驻留 RAM 直到 30s 空闲回收。
- 影响：多并发转码内存峰值叠加 OOM 风险；单文件转码被人为限速数倍。属实。

判定：【确认】。行号/引文准确；严重度"高"合理（性能/内存）。

### 4. t5 H2：缓存键仅 sha256(realpath) 无 size/mtime →【确认】（附转码档 nuance）

- L2588-2593（本轮重读）：`_trans_digest` 仅 `sha256(realpath)`；`_trans_cache_file`（L2606）、`_original_cache_path`（L3219）、`_asr_vtt_cached`（L3468）均以该 digest 为唯一键——三条磁盘缓存**无失效机制**。
- 对照同文件内：`_thumb_path` 键含 `realpath|size|mtime`（L2549，本轮重读）、`_video_details` 键含 (size, mtime)（L2045）——**唯独转码/原画/ASR 三条缺失**，对照确凿。
- nuance（需向队长注明的修正）：转码档 `<digest>.<q>.mp4` 在 persist 会话重建时**总会 `open(cfile,"wb")` 截断重转**（L2958-2964），因此旧转码档不会真正被播放——实际表现为 `_trans_available` 误报"可用"（L3141 仅查文件存在）+ 触发不必要重转；**真正静默服务陈旧内容的是 original.cache（稀疏文件按旧 size/区间）与 ASR vtt**。该 nuance 不影响缺陷确认，但建议修复时以 original.cache/ASR 为首要。

判定：【确认】。行号/引文准确；严重度"高"合理（原画缓存场景静默播旧内容 + 键设计缺陷）。

---

## 二、T4_AUDIT.md 逐条核验

| 编号 | 严重度 | 核验 | 行号核对 | 结论 |
|---|---|---|---|---|
| H1 打包无根校验 | 高 | 见上重点核验 1 | L1474-1495 / L4535-4562 / L1450 准确 | **【确认】** |
| H2 import cgi | 高 | 见上重点核验 2 | L21 / L1522-1525 准确 | **【确认】**（nuance：3.13+ 才崩） |
| M1 上传覆盖同名+无大小限制 | 中 | L1539-1546（本轮重读）：`basename` + `open(dest,"wb")` 截断覆盖、无 Content-Length 上限/配额检查；与设计"只写不删改"冲突 | 准确 | **【确认】** |
| M2 上传文件名 ADS 冒号 | 中 | L1539：无 `:` 清洗；Windows 上 `open("dir\evil.txt:stream","wb")` 写备用数据流，不产生可见文件 | 准确 | **【确认】**（需 token+可写目录，构造请求可触发） |
| M3 _shares 无锁 | 中 | L100-101/L1274-1276/L1315-1317/L1004/L1277/L1318/L3648-3657 全程无锁（t1 通读确认）；`json.dump` 与并发修改 → RuntimeError，而 `_save_shares` 仅 `except OSError`（L3656）不接 RuntimeError | 准确 | **【确认】** |
| M4 cancel 在 task 锁下改全局表 | 中 | L1503-1508（本轮重读）：`with task["lock"]: _archive_delete_task(task)` 未取 `_ARCHIVE_TASKS_LOCK`；L4514 pop；与 L1403-1404/L4695-4713 持锁迭代 values 并发 → RuntimeError | 准确 | **【确认】** |
| M5 安全响应头缺失+token 在 URL | 中 | `_send_json`(139)/`_send_html`(157)/`_send_file_range`(284) 均无 nosniff/Referrer-Policy/CSP/X-Frame-Options；token 在 URL（L1099）无 Referrer-Policy 兜底 | 准确 | **【确认】**（纵深防御缺失，离线资源下实际面小） |
| M6 Range 解析不符 RFC 7233 | 中 | L298 `re.match(r"bytes=(\d*)-(\d*)",...)` 未锚定：多段只回第一段、尾缀静默忽略；无 If-Range | 准确 | **【确认】**（正确性；主流单段客户端影响低，与 t5"Range 越界处理正确"的正面结论不矛盾） |
| L1 _resolve("")→CWD | 低 | L348 `abspath("")`=CWD；L1300/L1164 等 `q.get("path") or ""` 触发 | 准确 | 【确认】 |
| L2 realpath 在 try 外 | 低 | L347-351：abspath 在 try 内、realpath 在 try 外 | 准确 | 【确认】 |
| L3 错误页一律 403 | 低 | L250 `send_response(403)` 无条件 | 准确 | 【确认】 |
| L4 并发同名上传 | 低 | L1540-1543 无 per-file 锁 | 准确 | 【确认】 |
| L5 无 do_HEAD | 低 | 类内无 do_HEAD（t1 通读） | 准确 | 【确认】 |
| L6 父链 10 层 | 低 | L418-428 `seen < 10` | 准确 | 【确认】（信息性） |
| L7 icons 任意 .svg | 低 | L183-187 仅校验 .svg 后缀+normpath 落在 icons/，无文件名白名单 | 准确 | 【确认】 |

## 三、T5_AUDIT.md 逐条核验

| 编号 | 严重度 | 核验 | 行号核对 | 结论 |
|---|---|---|---|---|
| H1 缓冲永不消费 | 高 | 见上重点核验 3 | L2885-2896 / L508-532 / L2965-2972 准确 | **【确认】** |
| H2 缓存键仅 realpath | 高 | 见上重点核验 4 | L2588-2593 / L2606 / L3219 / L3468 / 对照 L2549 准确 | **【确认】**（nuance：转码档会截断自愈，陈旧主体现 original.cache/ASR） |
| M1 原画缓存写失败吞掉+merge 谎报+清扫可删 | 中 | L3350-3351 `except OSError: pass` 后 L3352-3353 仍 merge；busy 集（L3087-3092）只含 cfile 不含 original.cache；段间无句柄 → Windows unlink 成功；后续读缓存分支失败 → 短读/零字节 | 准确 | **【确认】** |
| M2 per-digest 锁横跨网络 I/O | 中 | L3301-3303 `with lock: _stream_cached_locked(...)` 内含 wfile.write 循环（L3356）；同视频并发流串行化（不同视频不互斥） | 准确 | **【确认】** |
| M3 转码会话无并发上限 | 中 | L2976-2978 / L3017-3019 每会话起线程、无信号量（对照打包有 `_ARCHIVE_SEM`） | 准确 | **【确认】** |
| M4 30s 回收 vs 播放暂停 | 中 | L3045 last_client 仅取到数据时刷新；L3067 按 last_client 30s 回收；暂停超 30s 会话被杀 → 恢复播放 offset/moof 不连续 → MSE 花屏 | 准确 | **【确认】** |
| M5 transstatus 不刷新 last_client | 中低 | L478-494 只读 session 不 touch last_client；L510-512 注释称"轮询刷新"仅 transdl 路径（L512 ensure_session）成立 | 准确 | **【确认】** |
| M6 _probe_video_meta 每执行器 8 worker | 中低 | L2244-2259：acquire(blocking=False)→新执行器→shutdown(wait=False)→release；上一执行器后台线程仍在跑（ffprobe ≤10s）→ 叠加 | 准确 | **【确认】** |
| M7 稀疏文件逻辑 size 计入预算 | 中低 | L3325-3330 truncate(fsize)；L3104-3105 total += st.st_size；大视频恒超 2GB → 删光其它缓存 | 准确 | **【确认】** |
| L1 cfile TOCTOU | 低 | L2889-2894 append 无锁/不复查 active；L2958-2964 截断 | 准确 | 【确认】 |
| L2 thumb 非原子+无清理 | 低 | L2558-2572 直写最终路径；thumbs 在 STATIC_DIR 非 TRANSCACHE_DIR，清扫不覆盖 | 准确 | 【确认】 |
| L3 三字典无界 | 低 | L1858/L3204/L3475 | 准确 | 【确认】 |
| L4 ASR 请求线程内执行 | 低 | L3505-3535 分钟级转写在请求线程 | 准确 | 【确认】 |
| L5 _trans_ready 会话回收后重转 | 低 | L3147-3165 sess=None → False | 准确 | 【确认】 |
| L6 trans 参数校验缺口 | 低 | L446-453 start 可负、offset 无上限 | 准确 | 【确认】 |
| L7 内嵌字幕无缓存 | 低 | L3442-3456 每次 ffmpeg 提取 | 准确 | 【确认】 |
| L8 cache/name 死参数 | 低 | L3261-3303 函数体内未引用 | 准确 | 【确认】 |

## 四、T6_AUDIT.md 逐条核验

| 编号 | 严重度 | 核验 | 行号核对 | 结论 |
|---|---|---|---|---|
| H1 打包无根校验 | 高 | 与 t4 H1 同一缺陷，见重点核验 1 | L1486-1491 / L4543-4563 / L1450 准确 | **【确认】**（与 t4 重叠，去重） |
| H2 rar/7z CLI 注入 | 中-高 | L1395 `entry = q.get("entry")` 无过滤；L4067-4068（本轮重读）`[tool,"e","-so","-y","-sccUTF-8",archive,entry]` entry 原样入参；L4113 WinRAR 同。7z 行为核验：`-` 前缀被当开关（-p/-x/-t/-i）、条目参数支持通配符掩码（多条目匹配 → -so 拼接 + Content-Length 失真）、WinRAR `@listfile`。无直接 RCE | 准确 | **【确认】**（中-高合理） |
| H3 私钥网络下载+固定弱密码 | 中-高 | L1355-1370 /api/certp12 持 token 可下载含私钥 p12；L4886 密码 "1234" 硬编码；L4874-4881 NoEncryption 明文落盘；HTTP 明文同端口（L1573-1601）+token 在 URL → 嗅探即私钥+密码全泄露。自签 7 天使损害窗口有限但暴露面真实 | 准确 | **【确认】**（中-高合理，设计取舍） |
| M1 _dl_7z stderr 死锁 | 中 | L4067-4106（本轮重读）：stdout/stderr 双 PIPE；主循环只读 stdout（L4089-4093）；stderr 仅 finally 读（L4100）、wait(10) 在 finally（L4104）；Windows 管道缓冲约 4KB，7z 大量 stderr → 写阻塞 → read 永久阻塞 → 请求线程挂起 | 准确 | **【确认】**（触发需损坏/多坏条目包） |
| M2 防火墙规则残留 | 中 | L4966-4998（本轮重读）；唯一删除点 `_stop` L5061；看门狗 os._exit(2) L5278、CLI 自检失败 L5304 均不清理；netsh 同名规则可重复累积（delete name= 一次性清） | 准确 | **【确认】** |
| M3 打包扫描跟随文件级 reparse | 中 | L4271-4279（本轮重读）目录 reparse 被跳过；L4284-4296 文件分支无 reparse 检查，plan 记录链接路径，写包 open() 跟随读目标内容（OneDrive 占位符真实场景） | 准确 | **【确认】** |
| M4 惰性清理杀下载中任务 | 中 | L4697-4705（本轮重读）downloading 也在 stale 列表 → cancel+删任务；L4707-4713 超上限逐出 downloading；_archive_dl L4779-4796 检到 cancel 删任务删包 | 准确 | **【确认】** |
| M5 stop→start 任务失效 | 中 | `_stop` L5054-5062（本轮重读）不清 `_ARCHIVE_TASKS`；`_start` L5003 调 `_archive_sweep_tmp`（L4518-4532 删全部 tk_*.zip）；旧任务 ready 残留 → dl 打开失败回滚 ready 死循环 | 准确 | **【确认】** |
| M6 _scan_plan 取消不即时 | 中低 | L4608-4618（本轮重读）：信号量 acquire 阻塞无取消检查；扫描后 L4618 才查 cancel | 准确 | **【确认】** |
| M7 看门狗误杀 | 中 | L5250-5260（本轮重读）timeout=3；L5263-5280 连续 3 次失败 os._exit(2)；磁盘 IO 饱和/大打包时探测连续超时 → 误杀整进程（触发条件苛刻：3×10s 连续超时） | 准确 | **【确认】**（可靠性，触发面窄） |
| M8 slowloris 线程泄漏 | 中 | L1580-1587（本轮重读）peek 1s 超时后 `settimeout(None)`，明文请求行读取无超时；daemon_threads=True 无上限 | 准确 | **【确认】** |
| M9 7z 列表全量子进程 | 中低 | L3877-3903（本轮重读）capture_output 全量缓冲；L3969-4003 每次下载重跑整包 l -slt | 准确 | **【确认】** |
| L1 lstrip("./") 破坏点文件名 | 低 | L3803/L3845/L3863：`lstrip("./")` 剥任意前导 . → ".gitignore"→"gitignore"，`_dl_zip` 精确匹配失败 403 | 准确 | 【确认】（功能缺陷） |
| L2 WinRAR 取第一个文件 | 低 | L4119-4127 | 准确 | 【确认】 |
| L3 tar symlink 有头无 body | 低 | L4053-4055 extractfile→None | 准确 | 【确认】 |
| L4 多实例清扫互删 | 低 | L4518-4532 | 准确 | 【确认】 |
| L5 启停线程累积 | 低 | L5026-5028 每次 start 新起 2 线程不回收 | 准确 | 【确认】 |
| L6 证书 IP 不重建 | 低 | L4831-4848 只查"有无 IP" | 准确 | 【确认】 |
| L7 X-Archive-Skipped 截断 | 低 | L4476-4480 payload[:8000] 可截断转义/JSON | 准确 | 【确认】 |
| L8 dlzip 全量落盘再发 | 低 | L4450-4484 | 准确 | 【确认】 |
| L9 上传无上限（旁注） | 低 | L1511-1547 同 t4 M1 | 准确 | 【确认】 |
| L10 杂项 | 低 | drive_pin getsize 未捕获(L5152)、POST body 无长度上限(L1483)、token 72bit+--token 弱口令(L5015/L5319)、_state 检查非原子(L5011)、done 可重复下载(L4751) | 准确 | 【确认】 |

---

## 五、后端核验结论

1. **三份审计全部高/中危发现经回读核实均为【确认】，0 误报、0 存疑**；低危抽验（t4 L1/L2/L3/L4/L5/L6/L7、t5 L1-L8、t6 L1-L10）亦全部成立。行号/引文与源码完全一致，无一处失实。
2. **重叠项**：t4 H1 与 t6 H1 为同一缺陷（POST /api/archive 无根校验），已去重合并为一条。
3. **需要向队长/后续修复任务注明的 nuance（不影响确认，仅精确化表述）**：
   - t5 H2：转码档 `<digest>.<q>.mp4` 因 persist 会话重建时截断（L2958-2964）会自愈，不会播放旧内容，实际表现是 available 误报 + 不必要重转；**静默陈旧真正发生在 original.cache 与 ASR vtt**。
   - t4 H2：cgi 崩溃仅在 Python 3.13+ 出现（3.10-3.12 仅弃用告警），但项目 pycache 有 3.13 痕迹，升级即全挂，高危成立。
   - t6 M7 看门狗误杀与 t6 M1 stderr 死锁均为"触发条件较苛刻"的场景性缺陷，严重度维持但修复优先级可后置。
4. 三份审计的正面结论（t4 防线有效确认、t5 无死锁/契约正确、t6 路径穿越专项结论）经回看亦与代码一致，未发现被遗漏的高危面。

## 六、按严重度排序的确认清单（去重合并后）

### 高（6 项）
| # | 编号（源） | 缺陷 | 关键行号 |
|---|---|---|---|
| H-1 | t4/t6 H1 | POST /api/archive 打包路径无根校验 → 受限根部署任意文件读取/外传（与 /dlzip L1450、drive_pin L5141 不一致） | 1486-1491 / 4548-4562 |
| H-2 | t5 H1 | persist 转码会话缓冲永不消费 → 内存膨胀 + 1.28MB/s 永久节流 | 2885-2896 / 512 |
| H-3 | t5 H2 | 转码/原画/ASR 缓存键仅 sha256(realpath) 无 size/mtime → 源替换后服务陈旧内容（original.cache/ASR 为实害；转码档 available 误报） | 2588-2593 / 3219 / 3468 |
| H-4 | t6 H2 | rar/7z 条目下载把用户可控 entry 原样拼进外部 CLI（开关/通配符/@listfile 注入） | 4067-4068 / 4113 |
| H-5 | t6 H3 | /api/certp12 网络分发含私钥 p12 + 固定密码 "1234" + NoEncryption 落盘 + HTTP 明文可嗅探 | 1355-1370 / 4886 / 4874-4881 |
| H-6 | t4 H2 | `import cgi` 裸导入，Python 3.13 已移除 → 3.13+ 服务整体无法启动 | 21 / 1522-1525 |

### 中（22 项，按主题归组）
**并发/一致性（6）**：t4 M3 `_shares` 无锁（100/3648）· t4 M4 cancel 在 task 锁下改全局表（1503/4514）· t5 M2 原画缓存锁横跨网络 IO（3301-3303）· t5 M1 原画缓存写失败吞掉+清扫可删 → 谎报缓存（3334-3364/3087-3092）· t6 M4 惰性清理杀下载中任务（4697-4713）· t6 M5 stop→start 后 ready 任务失效（5054/5003/4518）
**资源/性能（5）**：t5 M3 转码会话无并发上限（2976）· t5 M6 probe 每执行器 8 worker 叠加（2244-2259）· t5 M7 稀疏文件逻辑 size 计入预算 → 缓存治理失效（3325/3104）· t6 M9 7z 全量子进程（3877/3969）· t6 M1 7z stderr 死锁挂线程（4067-4106）
**上传/文件（2）**：t4 M1 覆盖同名+无大小限制（1539-1546）· t4 M2 文件名 ADS 冒号（1539）
**安全纵深（3）**：t4 M5 安全响应头缺失+token 在 URL（139/157/284）· t6 M2 防火墙规则残留（4966/5061/5278）· t6 M8 slowloris 线程泄漏（1580-1587）
**媒体行为（3）**：t5 M4 暂停>30s 会话被回收 → 续播花屏（3045/3067）· t5 M5 transstatus 不刷新 last_client（478-494）· t6 M3 打包跟随文件级 reparse → 根外内容入包（4284-4296）
**可靠性（3）**：t6 M6 取消不即时（4608-4618）· t6 M7 看门狗误杀（5250-5280）· t4 M6 Range 多段/锚定/If-Range（298）

### 低（抽验全过，代表性）
t4 L1 _resolve("")→CWD · t5 L1 cfile TOCTOU · t5 L2 thumb 非原子+无清理 · t6 L1 lstrip 破坏点文件名（.gitignore 无法下载）· t6 L5 启停线程累积 · 其余低危条目亦全部成立（详见上文分表）。

**优先修复建议**（供 t10+ 参考）：H-1（一行级根校验，收益最大）→ H-4（entry 白名单匹配）→ H-6（替换 cgi / 版本护栏）→ H-2/H-3（转码缓冲仅 persist 时跳过、缓存键加 size/mtime）→ M3/M4（加锁）→ 其余按中清单推进。
