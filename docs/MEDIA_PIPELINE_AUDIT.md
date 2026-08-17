# 后端审计：媒体管线（任务 t5）

- 审计对象：`server\server.py`（5325 行）媒体管线全链路
- 范围：MSE 转码会话（2848/2928/3023/3055）、ffmpeg 参数（2813/2840）、原画缓存（3208-3364）、缓存清扫（3078）、视频元数据（1861-2292）、缩略图（2535）、字幕（3382-3456）、ASR（3459-3536）、帧预览（3559-3633）
- 方法：逐段通读 + 跨函数竞态推演（锁序、进程生命周期、缓存键、异常路径）
- 结论：**无死锁**（锁序无环：`_trans_sessions_lock` → session["lock"]、per-digest 锁、`_ffmpeg_caps_lock` 互不嵌套；全部按序获取）。但有 **1 个高严重度性能/内存缺陷、1 个高严重度缓存一致性缺陷、若干中低度问题**，详见下。

---

## 🔴 高严重度

### H1. persist 转码会话的内存缓冲永不消费 → 内存膨胀 + 转码被节流到 ~1.28MB/s
- 位置：`_trans_encode_thread` L2885-2896；`_trans_ensure_session` L2965-2972；transdl 路由 L508-532
- 问题：`_trans_encode_thread` 无条件把 ffmpeg 输出追加进 `session["buf"]`，而**唯一消费缓冲的路径是 `/api/trans`（MSE，persist=False）**。persist=True（transdl/transstatus 触发的完整落盘转码）从不消费 buf，只读 cfile。于是：
  - **内存**：buf 只增不减，整个转码输出全部驻留 RAM（2GB 电影 → 2GB RAM/会话），到 30s 空闲回收才释放；
  - **速度**：`pend > 16MB` 后每次 64KB 追加 sleep 0.05s → ffmpeg 管道背压 → 输出速率被钉死在 ~64KB/0.05s ≈ **1.28MB/s**。1GB 输出最少 13 分钟（与 CPU 无关）。节流本意是"慢消费者防无界内存"，对 persist 会话（buf 永远没人读）变成了永久限速器。
- 影响/严重度：多并发转码 → 内存峰值叠加有 OOM 风险；单文件转码时间被人为拉长数倍。**高**
- 佐证：
```python
with session["lock"]:
    pend = len(session["buf"])
    session["buf"].extend(chunk)          # L2887 无条件入缓冲
    session["last"] = time.time()
if session["cfile"]:
    with open(session["cfile"], "ab") as fh: fh.write(chunk)
if pend > 16 * 1024 * 1024:
    time.sleep(0.05)                       # L2895-2896 永久节流
```
```python
# transdl（L512）只 ensure_session + 读 cfile；_trans_consume 只在 /api/trans（persist=False）被调用
sess = _trans_ensure_session(p, quality, 0, True)
```

### H2. 转码/原画/ASR 磁盘缓存键只含 sha256(realpath)，不含 size/mtime → 源文件被替换后长期服务陈旧内容
- 位置：`_trans_digest` L2588-2593、`_trans_cache_file` L2606-2608、`_original_cache_path` L3219-3222、`_asr_vtt_cached` L3468-3470
- 问题：三条缓存全部以 `sha256(realpath)` 为唯一键。对比同文件内其它缓存：`_thumb_path` 键含 `realpath|size|mtime`（L2549-2550）、`_video_details` 键含 `(size, mtime)`（L2045）——唯独转码/原画/ASR 没有失效机制。**同一路径替换视频文件（常见：重下/更新/换源）后**：
  - 原画缓存：`original.cache` 稀疏文件里保留的是**旧文件的字节**，`.json` 区间集合按旧文件记录；新文件更小 → 播放器按新 fsize 发 Range → 命中旧区间 → **播到旧文件内容**；新文件更大 → 头部旧、尾部新，拼接错乱。
  - 转码档 `<digest>.<q>.mp4`：`_trans_available` 报可用 → transdl/原生播放直接放旧转码。
  - ASR `<digest>.asr.<lang>.vtt`：返回旧视频的识别字幕。
- 影响/严重度：静默内容错乱，用户无从察觉；原画缓存场景下等于播放损坏文件。**高**
- 佐证：
```python
def _trans_digest(path):
    try:
        return hashlib.sha256(os.path.realpath(path).encode("utf-8")).hexdigest()  # 仅 realpath
    except OSError:
        return hashlib.sha256(path.encode("utf-8")).hexdigest()
```
```python
# 对照：_thumb_path L2549
key = "%s|%d|%d" % (os.path.realpath(path), st.st_size, int(st.st_mtime))
```

---

## 🟠 中严重度

### M1. 原画缓存区间合并与写盘失败解耦 + 清扫可删除 original.cache → 区间集合谎报"已缓存"→ 播放器收零字节/短读
- 位置：`_stream_cached_locked` L3334-3364；`_cache_sweep_once` L3087-3092（busy 集只含会话 cfile，不含 original.cache）
- 问题链：
  1. 大文件 cache=1 流式下载中，`_cache_sweep_once`（2GB 预算）可删除 `original.cache`——它不在 busy 保护内，且 `_stream_cached_locked` 每段写完即关闭文件句柄（L3347 `with open(cp,"r+b")`），段间无句柄 → Windows 上 unlink 成功。
  2. 写入段 `open(cp,"r+b")` 抛 FileNotFoundError → `except OSError: pass`（L3350-3351）**吞掉**，但 L3352-3353 仍然 `_original_cache_merge` → `.json` 记录该区间"已缓存"。
  3. 后续请求读到该区间 → 走缓存分支 `open(cp,"rb")` → 文件不存在 → 外层 `except OSError` → 短读（Content-Length 已发）→ 播放中断；若文件被其它请求重建（`isfile` 检查后 truncate 全零）→ **读出一整段零字节**，静默黑屏/花屏。
- 影响/严重度：缓存压力 + 并发流同时发生时，视频区间级损坏，且不自愈（坏区间在 .json 里永久标记已缓存）。**中**
- 佐证：
```python
data = src.read(seg_length)
if data:
    try:
        with open(cp, "r+b") as cf: cf.seek(seg_start); cf.write(data)
    except OSError:
        pass                                          # L3350-3351 写失败仍继续
    ranges = _original_cache_merge(ranges, seg_start, seg_start + len(data) - 1)  # L3352
```

### M2. per-digest 原画缓存锁横跨整段网络 I/O → 同视频并发流串行化，慢客户端阻塞全部其它请求
- 位置：`_stream_cached` L3301-3303 → `_stream_cached_locked` L3334-3364
- 问题：`with _original_cache_lock(path): _stream_cached_locked(...)` 把"读源→写缓存→merge→save→**wfile.write 全量数据**"整体锁住。客户端请求 Range 0-（整文件）时，锁被持有到整个文件传完。同一视频的第二个播放器/下载请求（即使全部命中缓存）必须排队；慢速移动网络下可达分钟级。
- 影响/严重度：并发可用性下降，同视频多端观看互相阻塞。**中**
- 佐证：
```python
cp = _original_cache_path(path)
with _original_cache_lock(path):
    _stream_cached_locked(handler, path, cp, fsize, start, chunk, ctype)   # L3302-3303
```

### M3. 转码/remux 会话无并发上限 → 任意数量 ffmpeg 进程可被并行拉起（每进程全核）
- 位置：`_trans_ensure_session` L2976-2978、`_trans_ensure_remux` L3017-3019
- 问题：打包有 `_ARCHIVE_SEM`（Semaphore(2)），转码没有任何信号量/配额。一个（或一群）客户端并发请求 N 个不同视频的 `/api/trans`，即拉起 N 个满负荷 ffmpeg（libx264 ultrafast 全核）并各占 ~54MB 缓冲上限。无认证环境（token 泄露/分享页）下可直接 CPU 耗尽。
- 影响/严重度：资源耗尽型 DoS / 本机卡死。**中**
- 佐证：
```python
t = threading.Thread(target=_trans_encode_thread, args=(sess, real, q, res), daemon=True)
t.start()   # 无任何全局并发计数
```

### M4. 空闲回收 30s vs 播放器暂停/缓冲暂停 → 暂停超过 30s 后续播拿不到连续流
- 位置：`_trans_sweep_loop` L3067；`_trans_consume` L3045；`_trans_ensure_session` L2943-2952
- 问题：`last_client` 只在**实际取到数据**时刷新（L3045 `if n:`）。播放器暂停或 MediaSource 缓冲满而停止拉取 → 30s 后会话被回收（ffmpeg 被杀）。用户恢复播放时 `/api/trans` 带旧 offset 请求 → 旧会话已不在表 → 新建会话（consume=0、moof 从 0 重新编号）→ `_trans_consume` 把 offset 修正回 0 → 前端拿到一段与已 append 的 moof 序列不连续的流 → MSE append 报错/花屏，需整页重开。
- 影响/严重度：播放中断是确定性可复现（暂停 >30s），前端无重建逻辑时直接坏。**中**
- 佐证：
```python
if now - sess.get("last_client", sess["last"]) > TRANS_IDLE_TIMEOUT:   # L3067
    expired.append((key, sess))
```

### M5. transstatus 轮询不刷新 last_client → 纯状态轮询的转码会话 30s 后被回收、进度清零重转
- 位置：`/api/transstatus` L478-494；`_trans_ready` L3160-3165；`_trans_progress_estimate` L3168-3196
- 问题：L510-511 注释声称"轮询每次都会刷新会话 last_client，避免被空闲回收器中途杀掉"——但只有 transdl（经 `_trans_ensure_session` L512）刷新；transstatus 路径只读 session、不 touch last_client。若前端等待转码时只用 transstatus 轮询（不请求 transdl），会话 30s 后被 sweep → 转码中断 → 下次 transdl 重新截断从头转。
- 影响/严重度：进度反复归零 + 重复 CPU 消耗。**中低**
- 佐证：
```python
resp = {"available": _trans_available(p), "ready": _trans_ready(p, quality)}   # 均不刷新 last_client
```

### M6. `_probe_video_meta` 的 8-worker 上限是"每执行器"，非全局 → 连续 meta=1 请求叠加 ffprobe 进程
- 位置：`_probe_video_meta` L2244-2259
- 问题：`ex.shutdown(wait=False)` 立即返回、后台线程继续跑（ffprobe 最长 10s），随后 `_VIDEO_PROBE_LOCK` 释放。3s 预算意味着上一个执行器还活着时下一个 meta=1 请求就能再建一个 8-worker 执行器。目录翻页/多次刷新 → ffprobe 进程 8→16→24 叠加，无全局上限。
- 影响/严重度：列表页快速导航时子进程风暴，CPU/句柄压力。**中低**
- 佐证：
```python
finally:
    ex.shutdown(wait=False)          # 线程继续执行
finally:
    _VIDEO_PROBE_LOCK.release()      # 立即允许下一个执行器
```

### M7. 稀疏文件按 logical size 计入 2GB 缓存预算 → 单个大视频即打爆预算，清扫每轮删光其它缓存
- 位置：`_stream_cached_locked` L3325-3330（truncate(fsize)）；`_cache_sweep_once` L3104-3105
- 问题：`original.cache` 创建即 `truncate(fsize)`（逻辑尺寸=全片大小，实际占盘为已写区间）。清扫按 `st.st_size` 计 total：一个 4GB 视频只要 cache=1 播过一次 → total 恒超 2GB → 每 600s 清扫删掉所有可删缓存（转码档、ASR、帧、其它原画缓存），但 total 仍超（单文件不可删）→ 永久"超限"状态，缓存形同虚设且反复删改。只写了一点的 10GB 视频同样。
- 影响/严重度：缓存治理失效 + 无谓 IO。**中低**
- 佐证：
```python
if not os.path.isfile(cp):
    with open(cp, "wb") as cf:
        cf.truncate(fsize)            # 逻辑尺寸=全片
...
total += st.st_size                   # 清扫按逻辑尺寸计
```

---

## 🟡 低严重度 / 边缘

### L1. cfile 截断 vs 旧会话线程追加的 TOCTOU 竞态 → 缓存文件头混入旧数据
- 位置：`_trans_encode_thread` L2889-2894（append 无锁、且 buf.extend 与 append 之间不复查 `active`）；`_trans_ensure_session` L2958-2964（创建时截断）；`_trans_sweep_loop` L3069-3072
- 问题：sweep 先弹表再 `_session_gc`（active=False + terminate）；旧线程可能已在 `with session["lock"]` 里 extend 完、正要 append cfile 时才被置 inactive——append 不检查 active 也不持任何与截断互斥的锁。此时新请求若恰好创建新会话并 `open(cfile,"wb")` 截断，旧线程的 64KB 旧数据落在新流头部 → fMP4 损坏（moof 序列错乱）。窗口毫秒级，需 sweep 与重建同时发生，概率低。
- 影响/严重度：偶发缓存文件损坏；下次会话截断自愈。**低**

### L2. `_thumb_path` 非原子写 + static/thumbs 无清理
- 位置：L2558-2572
- 问题：直接写最终路径（无 tmp+rename，对比 `_vthumbstrip_gen` L3584/`_vframe_gen` L3618 都有 tmp+os.replace）。并发两请求 → 两个 ffmpeg 同时写同一 out（-y 互相截断）→ 撕裂 jpg；一次失败残留的 0 字节/半截文件会被后续请求当缓存命中（`isfile(out)` 即返回）→ 缩略图永久损坏直到源文件变化。且 thumbs 在 STATIC_DIR（项目 static 目录）而非 TRANSCACHE_DIR，`_cache_sweep_once` 不覆盖 → 磁盘无限增长。
- 影响/严重度：偶发坏图 + 缓慢磁盘膨胀。**低**

### L3. `_video_details_cache` / `_original_cache_locks` / `_asr_path_locks` 三个字典无界增长
- 位置：L1858、L3204-3216、L3475-3487
- 问题：进程存活期内只增不减。`_video_details_cache` 连 ffprobe 失败（None）也缓存，meta=1 扫过大目录即灌入海量条目。
- 影响/严重度：长跑服务内存缓慢增长（条目小，万级 ≈ 数十 MB）。**低**

### L4. ASR 转写在请求线程内执行（分钟级）+ per-path 锁阻塞同路径其它请求
- 位置：`_asr_transcribe` L3505-3535
- 问题：长视频转写可占用请求线程数分钟（small 模型 CPU int8）；第二个同路径请求阻塞等待锁而非快速返回"进行中"。并发多路 ASR → ThreadingHTTPServer 线程耗尽。
- 影响/严重度：并发下请求堆积。**低**

### L5. `_trans_ready` 依赖"会话仍在表且 done" → 完整转码档在会话被回收后仍需全量重转
- 位置：`_trans_ready` L3147-3165；transdl L512-530
- 问题：转码完成、会话被 30s 回收后，磁盘上的完整 cfile 明明可下载，但 `_trans_ready` 因 sess=None 返回 False → transdl 重新截断+全量重转。设计上为防半成品，但"完整文件校验"本可避免重复劳动（例如记录 done 标记文件）。
- 影响/严重度：重复 CPU/时间消耗。**低**

### L6. `/api/trans` 参数校验缺口
- 位置：L446-453
- 问题：`start_sec` 可为负（ffmpeg -ss 负值报错，会话 error）；`offset` 无上限钳制（仅 need 有 8MB 上限），超大 offset 会让请求干等 5s 超时。
- 影响/严重度：脏输入导致无谓等待/错误。**低**

### L7. `_subtitle_vtt` 内嵌提取无缓存、无并发去重
- 位置：L3442-3456
- 问题：无旁挂字幕的视频每次请求都跑一次 ffmpeg（60s 超时），重复请求（播放器重试/多端打开）重复提取，无进程上限。
- 影响/严重度：重复子进程开销。**低**

### L8. `_stream_cached` 的 `cache`/`name` 参数为死参数
- 位置：L3261-3303、L3318
- 问题：`cache` 与 `name` 在函数体内从未被引用（是否写缓存由路由层 `cache==1` 决定）。未来调用方易误以为 cache=0 不写缓存而踩坑。
- 影响/严重度：代码气味。**低**

---

## ✅ 未发现问题的方面（简要）

- **锁序/死锁**：`_trans_sessions_lock`、session["lock"]、per-digest 锁、`_ffmpeg_caps_lock`、`_ASR 锁池`之间无嵌套环；sweep 弹表在表锁内、`_session_gc` 在表锁外，顺序一致。
- **MSE codec 契约**：avc1.640033 ↔ `-profile:v high -level:v 5.1 -x264opts cabac=1:8x8dct=1` 一致；`default_base_moof`/`empty_moov`/`frag_keyframe` 组合正确；原画按源 codec 换算 hvc1/avc1 有兜底。
- **缓冲裁剪**：`_trans_consume` 修正乱序 offset、`del buf[:start+n]` 正确，MSE 路径无内存泄漏。
- **Range 解析**：`_send_file_range` 与 `_stream_cached` 的 suffix/闭合/越界处理符合 RFC 7233。
- **进程回收**：sweep 杀进程 → 管道 EOF → 线程收敛（`proc.wait(5)` 兜底 kill），无僵尸；`daemon_threads=True`。
- **字幕转换**：SRT/ASS→VTT 时间轴与转义正确；GBK 经 `_smart_decode` 兜底。
