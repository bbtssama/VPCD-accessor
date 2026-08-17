# t12 后端优化方案评审：媒体管线角度（任务 t16）

- 评审人：auditor-server-media（t5 媒体管线原审计员，对相关代码第一手精读）
- 评审对象：T12_PLAN.md 中媒体相关条目：H-2（转码缓冲）、H-3（缓存失效）、M3（原画锁粒度）、M4（缓存谎报自愈）、M7（转码并发上限）、M8（probe 全局池）、M9（稀疏文件计费）、M17（暂停保活）、M18（transstatus 刷新）
- 评审视角：性能/资源/ffmpeg 集成/会话生命周期
- 判定汇总：**同意 5（H-2、H-3、M4、M8、M18）+ 部分同意 3（M3、M7、M17）+ 需补充 1（M9）**；另提 5 项媒体领域遗漏（其中 1 项建议补入 P1）。

---

## 一、总体评价

t12 媒体相关方案与 t5 审计发现一一对应、方向正确，无一条与代码事实冲突。H-2/H-3 两处高风险方案**判据与实现位置均核验无误**（见下）。主要问题集中在**实现语义的边界**：M7 未区分"播放排队"与"下载排队"两种完全不同的前端契约；M17 依赖前端在暂停时仍发请求（未验证）；M9 回退语义自相矛盾。另有一个**实质遗漏**：`_trans_ready` 在会话被回收后把完整转码档判为不可用→全量重转（t5 L5），t12 仅在附注中轻描淡写，建议补入 P1。

---

## 二、逐项评审

### H-2. persist 转码会话缓冲 →【同意】（建议直接上 P1 版）

- **判据核验**：`cfile 非 None ⟺ persist=True 且 start_sec==0`（L2956 `if persist and start_sec == 0: cfile = ...`；`_trans_ensure_remux` L3007 恒 None）。唯一消费 buf 的 `_trans_consume` 只在 `/api/trans` 分支被调用（L467），而该分支恒走 `persist=False`（L458）→ **persist 会话的 buf 确实无人消费，H-2 判据成立**。
- **MSE 路径逐字节不变性**：`if session["cfile"] is None:` 分支与原代码完全同构（buf.extend + `pend>16MB` 节流 + last 刷新），persist=False 会话与 remux 会话（cfile 均 None）行为逐字节不变 ✅。
- **彻底性**：对当前全部调用点彻底（transdl=persist+start0 → cfile 非 None → 零缓冲；MSE/remux → cfile None → 原逻辑）。
- **边界漏网**：`persist=True + start_sec != 0` 的会话 cfile=None → 按快速版判据会入 buf，而它没有消费方（transdl 恒 start=0，/api/trans 恒 persist=False）——当前无调用点产生这种会话，但**快速版判据是"cfile 有无"，P1 版判据是"有无消费方"**，语义后者正确。
- **建议**：
  1. **直接实现 P1 版**：会话构造参数 `mem_buf`（`_trans_ensure_session` 设 `mem_buf = not persist`，`_trans_ensure_remux` 恒 True），encode 线程按 `mem_buf` 分支——比"cfile is None"少一层间接，未来加字段不踩坑。成本几乎相同。
  2. 补充回归：transdl 1GB 视频内存峰值 <200MB + 速率 >1.28MB/s（t12 验收已列 ✅）；/api/trans 三档 + 原画 remux 逐字节回归。
  3. 顺带（低优先）：persist 会话现在每 64KB `open(cfile,"ab")` 一次——无节流后磁盘写放大明显，建议 encode 线程常驻句柄、finally 关闭。

### H-3. 缓存失效（src.info）→【同意】（补 3 点）

- **覆盖性核验（三条主缓存）**：
  - original.cache：`_stream_cached_locked` 开头比对+重置 ✓——且该函数整体在 per-digest 锁内（L3302-3303），**比对→truncate→清 ranges→save 与并发写盘天然串行**。
  - ASR vtt：`_asr_transcribe` 读缓存前比对 ✓。
  - 转码档：`_trans_available`/`_trans_ready` 比对判不可用 → transdl 重建时 `_trans_ensure_session` 截断（L2960-2964）✓——重置动作已由现有截断承担，方案只需判 False，改动最小，设计正确。
- **TOCTOU 评估**：核心写路径（original.cache 的写+merge+save、ASR 的删+重转）均已被现有锁（per-digest 锁 / per-path 锁）串行化，**只要比对发生在锁内，无实质 TOCTOU**。残留窗口（比对通过→源替换→读到新字节写缓存→stamp 仍旧）无害：缓存内容恰好是新文件的字节，下次比对即重置。
- **需补充 3 点**：
  1. **第四条缓存遗漏**：`_vthumbstrip_gen`（strip.jpg，L3559-3561）与 `_vframe_gen`（f<秒>.jpg，L3606-3608）同样以 digest 为键、同样会陈旧。建议统一抽 `_cache_valid(path, stamp_path)` helper，在 vthumbstrip/vframe 缓存命中检查处一并比对（vframe 尤其重要——seek 预览图会永久显示旧画面）。
  2. **ASR 比对必须在 per-path 锁内**（`with _asr_path_lock(path):` 之后、二次查缓存的位置），方案文字未明确锁内/锁外——锁外删旧 vtt 会与并发请求交错。
  3. **`_trans_available` 的比对放锁外做 stat**（只读源文件 stat，无锁内 IO 问题），但注意 transstatus 每请求多一次 stat，开销可忽略。
- **实施成本修正**：方案标"中"，实际改动 4 处 + 1 helper + vthumbstrip/vframe 2 处，约 30 行，无分支复杂度，建议维持 P1 首做（或提前 P0，静默数据错误值得）。

### M3. 原画锁粒度 →【部分同意】

- 方向正确（锁内准备 + 锁外写网络），且方案②"正在服务的 digest 登记进 busy 集"正确补上了清扫竞态——**注意登记时机必须是拿 per-digest 锁之前（请求进入时）、注销在锁外发送完成后**，否则锁外写网络窗口仍暴露给清扫。
- **反对点/风险**：锁外写网络期间数据一致性依赖"缓存区间一经 merge 不再变化"——现状成立（merge 只增不减）。但需确认**锁内"读源→写缓存"段仍是原子段**（方案拆分后每段 ≤1MB 锁内完成）✅ 方案已隐含。
- **补充**：客户端断连（wfile.write 抛 OSError）时要走既有外层 except 停止发送并正常 save（勿把断连当缓存错误）；M4 的"摘除区间"也要在同一锁内。
- 判定：方向同意，落地细节按上述 3 点。

### M4. 缓存谎报自愈 →【同意】（补 1 点）

- a) 写成功才 merge——直接修复 t5 M1 根因 ✅；b) busy 集含 original.cache（与 M3 合并实现）✅；c) 读缓存失败摘除区间回源——修复方向正确，且方案明确"在 per-digest 锁内做"✅。
- **补充**：c 的"读缓存失败"判定应包含**短读**——`cf.read(seg_length)` 返回长度 < seg_length（文件被截断重建后读零区）时同样摘除回源，否则零字节区间会永久命中（t5 M1 场景）。判定条件：`open 异常 or len(data) < seg_length`。
- 顺带：文件不存在时现有 `isfile` 检查会自动重建 truncate（L3325-3330），与摘除逻辑衔接自然。

### M7. 转码并发上限 →【部分同意】（核心缺口：播放/下载语义混同）

- 并发上限方向正确（打包有 `_ARCHIVE_SEM`，转码裸奔是 t5 M3）。
- **核心问题**：方案建议"不可得时返回转码忙错误"，但**两条路径的前端契约完全不同**：
  - `/api/trans`（MSE 播放）：返回 409/429 会让播放器**直接失败**——播放场景应**阻塞排队**（`_trans_encode_thread` 入口 `_TRANS_SEM.acquire()`，天然排队，起播延迟可接受），不应在 `_trans_ensure_*` 里非阻塞拒绝；
  - transdl（下载）：409+进度已有完整前端机制（L521-530），非阻塞检查返回 409 正确。
- **建议**：信号量只在 encode 线程入口 acquire/finally release（方案已写"持锁在转码线程生命周期内"✅），`_trans_ensure_*` **不做**非阻塞检查——播放排队、下载 409 由 transdl 自身的 done 检查自然区分。若担心播放请求线程积压，可给 acquire 加超时（如 30s）后返回错误。
- **配额建议**：N 默认 `max(1, os.cpu_count() // 2)` 或配置项；**remux 会话（-c copy，IO 密集不烧 CPU）建议独立配额或不计入**，否则两个 remux 会挤掉转码名额。
- **信号量与会话生命周期**：sweep 回收 → 线程 finally release ✅；`_session_gc` 杀进程不涉及信号量 ✅。

### M8. probe 全局池 →【同意】（保留互斥锁）

- 全局单例池收敛 ffprobe ≤8，方向正确、改动小。
- **不同意"去掉 _VIDEO_PROBE_LOCK"**：该锁的职责不是并发限制而是**"单次批量 3s 预算互斥"**——去掉后连续 meta=1 请求各自提交各自等 3s 预算，池队列被多批任务填满，列表 meta 全空且互相拖累。**保留锁（互斥预算等待）+ 全局池（worker 收敛）**，两者职责正交，都留。
- 生命周期：单例池进程存活期常驻，仅进程退出时 shutdown ✅。
- 补充：池满时（8 个慢 ffprobe 占满）新提交自然排队，`f.result(timeout=预算)` 对排队任务静默超时——列表不阻塞语义保持 ✅。

### M9. 稀疏文件计费 →【需补充】（回退语义矛盾）

- 实际占用 = `sum(b-a+1 for [a,b] in ranges)` 方向正确，能修复 t5 M7（大视频打爆 2GB 预算）。
- **矛盾点**：方案文字"无区间/无 json 按 0；**仍无结果再回退 st_size（保守）**"——"无 json"到底是按 0 还是回退 st_size？两句话打架。建议明确三分支：
  - `.json` 存在且可解析 → 区间和；
  - `.json` 缺失 → **0**（`truncate(fsize)` 后 NTFS 未分配簇，实际占用≈0；新缓存文件无区间）；
  - `.json` 损坏 → **st_size（保守）**（避免漏计，且损坏本身意味着状态不可信）。
- **清扫配对**：`_cache_sweep_once` 遍历时对每个 `original.cache` 需读同名 `.json`；删除顺序按 mtime、扣减按实际占用——注意 total 扣减要与计费口径一致（删除某 .cache 时 total -= 其实际占用，而非 st_size）。
- 补充：Python Windows `os.stat` 无 st_blocks 可用，区间和是唯一低成本的合理近似 ✅；也可用 ctypes `GetCompressedFileSize` 拿真实占用（成本高，不推荐）。

### M17. 暂停保活 →【部分同意】（依赖前端行为，需配套）

- "超时返回也刷新 last_client + 所有会话 API touch"方向正确、零成本。
- **关键前提未验证**：播放器**暂停时是否还在发请求**？若前端暂停即停发（MediaSource 缓冲满/用户暂停 → 拉取循环暂停），后端"有请求即活跃"的保活完全失效——30s 后照旧回收。这取决于 app.js 的拉取循环实现（t2/t7 前端扫描可确认）。
- **建议双管齐下**：
  1. 后端：M17a+M18 合并实现（所有媒体 API 请求 touch last_client）；
  2. 前端：暂停/缓冲时保持低频保活（每 15-20s 一次 transstatus 或空 offset 的 trans）——若前端暂停会停发，这是**必要条件**；
  3. **兜底**：前端检测 `X-Trans-Offset` 回退（新会话 offset 归 0）时重置 SourceBuffer 重新起播（seek 到原位置）——即使会话被回收也不花屏，这是最根本的健壮性修复，比保活更可靠。
- t12 方案只做了后端侧，属"部分解决"。

### M18. transstatus 刷新 →【同意】

- 与 t5 M5 完全一致，1-2 行、零风险；与 M17 合并实现 ✅。
- 细节：touch 放路由层（拿到 sess 后 `sess["last_client"] = time.time()`）即可，无需改 `_trans_ready`/`_trans_progress_estimate` 内部（避免给纯函数加副作用）。
- 注意 `/api/trans` 的超时返回（L3050-3051）也 touch——M17a 已覆盖，一并做。

---

## 三、四个指定评估问题的直接回答

**① H-2"cfile is None 才入 buf"是否彻底解决内存膨胀且不破坏 MSE 逐字节语义？**
- 对当前全部调用点：**彻底**（persist 会话零缓冲 O(64KB)；MSE/remux 分支与原代码逐字节同构）。
- 但判据本身有语义缺口（persist=True+start≠0 的会话 cfile=None 却无消费方），**建议直接实现 P1 版 `mem_buf = not persist`**（remux 恒 True），彻底性才不依赖"当前无此调用点"的巧合。
- MSE 逐字节语义：**不破坏**——`cfile is None` 分支与原代码完全相同。

**② H-3 src.info 是否覆盖全部三条缓存、有无 TOCTOU？**
- 三条主缓存：**覆盖**（original.cache 在锁内比对+重置；ASR 比对+删 vtt；转码档比对判不可用+由现有截断重建）。
- **未覆盖第四条**：vthumbstrip/vframe 两条帧缓存同样陈旧，需补。
- TOCTOU：核心写路径已被 per-digest/per-path 锁串行化，**只要比对在锁内即无实质 TOCTOU**；残留窗口无害。ASR 比对必须明确放锁内（方案未写明）。

**③ 各方案优劣**
- M7：上限方向对，但"返回忙错误"混同了播放（应阻塞排队）与下载（应 409）两种契约——**部分同意**；N 建议 cpu_count 相关，remux 独立配额。
- M8：全局池对，但**不要去掉 _VIDEO_PROBE_LOCK**（它管"单次预算互斥"，与 worker 收敛正交）——**同意但保留锁**。
- M9：实际占用计费方向对，**回退语义需澄清**（缺失→0、损坏→st_size）——**需补充**。
- M17：后端 touch 对但**依赖前端暂停仍发请求**，需前端保活 + offset 回退重建兜底——**部分同意**。
- M18：完全同意，1-2 行，与 M17 合并。

**④ 媒体领域更优做法/遗漏**
1. **【建议补入 P1】`_trans_ready` 会话回收后重转浪费（t5 L5）**：完整转码档在会话被 30s 回收后判不可用→transdl 截断全量重转。更优：encode 线程 `done` 时在 cfile 旁写 `.done` 标记（tmp+rename），`_trans_ready` 检查标记文件而非"会话在表且 done"——回收后立即可下载，半成品永不误报。t12 只在附注提及，应升为正式条目。
2. **【建议补入 P2】`_trans_consume` 的 bytearray 头部删除是 O(剩余) memmove**（L3044 `del sess["buf"][:start+n]`）：高频 512KB 分片消费 + 16MB 级缓冲时每片 memmove 整个 buf → CPU 浪费。更优：消费侧维护 `consume` 索引 + 定期 compact（或 `collections.deque` 分块）。
3. **【建议补入 P1】`_thumb_path` 非原子写 + static/thumbs 无清理（t5 L2）**：t12 媒体条目未覆盖。至少加 tmp+os.replace；thumbs 目录建议纳入容量治理（或迁入 TRANSCACHE_DIR）。
4. **【低优先】ASR 请求线程内分钟级转写 + per-path 锁阻塞（t5 L4）**：t12 未提；可加"进行中即返回 202/排队"语义，避免线程耗尽。
5. **【低优先】`_video_details_cache` 无界增长（t5 L3）**：meta=1 大目录灌 None 条目；加容量上限或 LRU 即可。
6. **【已覆盖确认】** original.cache busy 保护（M3②）、Range 锚定（M22）、连接超时（M16）均已覆盖 t5 相关发现，无需重复。

---

## 四、最终推荐

1. **H-2 直接按 P1 版（mem_buf）实施**，P0 快速版可跳过（判据有语义缺口，两版成本差极小）；回归重点：transdl 内存/速率 + /api/trans 逐字节。
2. **H-3 维持 P1 首做**（建议提前 P0——静默数据错误），补 vthumbstrip/vframe 比对 + ASR 锁内比对 + 抽 `_cache_valid` helper。
3. **M4 与 M3 合并实施**（同一文件、同一锁体系）；M4 补"短读也摘除区间"。
4. **M7 改为"encode 线程内 acquire 排队，不在 ensure 里非阻塞拒绝"**；播放天然排队、下载沿用 409；N 默认 cpu_count//2；remux 独立配额。
5. **M8 实施但保留 _VIDEO_PROBE_LOCK**。
6. **M9 澄清三分支回退语义**后实施。
7. **M17 必须配前端保活 + offset 回退重建**，否则只解决"轮询中"场景；M18 随 M17 一并落地。
8. **新增媒体条目**：`_trans_ready` 改 `.done` 标记文件（P1，回收后免重转）——对用户体验提升显著且实现 <15 行。
9. 阶段 2（媒体管线）验收清单在 t12 基础上补：vthumbstrip/vframe 替换源后失效、暂停 60s 续播（配前端保活）、.done 标记场景（转码完 → 等回收 → 直接下载不重转）。

评审完毕。可进入 t19 综合评审。
