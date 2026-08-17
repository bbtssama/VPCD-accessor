# t15 评审：后端优化方案 t12（安全/API 设计/错误处理角度）

- 评审人：auditor-server-api（安全/API 主审）
- 评审对象：`T12_PLAN.md`（357 行，P0×8 / P1×16 / P2×6）+ t9 核验确认清单（6 高 22 中）+ 本人 t4 原审计
- 方法：对 t12 关键断言回 server.py 源码逐点复核（roots 来源、`_under` 语义、`_seven_entry_size`/`_dl_7z`/`_dl_winrar`/`_unpack_winrar`/`_seven_list` 实际行为、`_start`/`drive_start`/`drive_pin` 接线），以下行号均为实测。
- 判定：同意 / 部分同意 / 反对 / 需补充

---

## 〇、总体评价

t12 方案整体**扎实、分层合理、与既有代码模式对齐**（H-1 函数层复用 drive_pin 的 `_under`+skipped 模式、M1 快照写盘、M2 锁序全局→任务等），安全修复路径正确，予以认可。但作为安全主审复核出 **3 个真实方案缺口**（H-4 快速版漏空 entry、H-4 白名单漏 WinRAR-only 分支、H-6 raise 与"兼容 3.13"目标自相矛盾）+ M14 注入点遗漏 2 处，以及若干"更优做法"（M12 用 `"xb"` 原子拒绝覆盖、M7 对 MSE 实时会话豁免限流等），详见下文。

---

## 一、高严重度 6 项逐条评审

### H-1. POST /api/archive 打包根校验（双保险）→ 【同意】

- **理由**：双保险设计正确且已核实自洽：
  1. **roots 一致性成立**：`_start` L5030 `_state.update(server=server, roots=roots, ...)` 与 `_DriveServer(..., roots, ...)` L5020 是**同一份 roots 列表**；`drive_start`（L5108-5109）→ `_start`，CLI 同路。故函数层缺省 `_state["roots"]` ≡ 路由层 `self.server.roots`，双保险不会互相打架。
  2. **`_under` 语义等价 `_resolve`**：L5195-5199 `_under` 内部对 root 与 path **均 realpath** + commonpath，与 `_resolve`（L345-359）完全同构；且 `drive_pin`（L5141-5143）已用同一模式 + "超出允许的根目录" skipped 文案，函数层方案是成熟模式复用。
  3. **闭合性验证**（专项，见第二节）：打包入口仅 GET /dlzip（已 `_resolve` L1450）、分享 dlzip（已 `_resolve_share_path` L1037-1060）、POST /api/archive（本修复）、`_archive_worker`（消费 task 内已校验 paths）；MCP 侧无打包工具。**双保险落地后无第四条外传路径**，任意文件外传闭合。
- **需补充 2 点**：
  1. 路由层 403 文案与 GET /dlzip 对齐（`"包含无效路径: %s"`，T12 已如此写）✓；建议函数层 skipped reason 与 `drive_pin` 完全同文（"超出允许的根目录"）便于前端统一展示。
  2. 函数层校验对象应为 realpath 后的 `ap`（T12 已用 `ap`）✓；**不要**对 `skipped` 中的越界项做 `exists` 预检（越界项 exists 可能为真，先判根、再判存在，顺序要与 drive_pin 一致：L5141 先根后存在）。
- **情境**：受限 root 部署下是唯一完整任意文件读取通道，四情境都应修；成本 10 行、零性能影响。

### H-2. persist 转码缓冲（cfile 分支）→ 【同意】（媒体侧主审细评，安全侧无异议）

- 安全/API 角度仅补一点：`cfile is None` 判定与 `persist` 的映射（T12 自述 L2956 成立），实现时**必须保证 MSE persist=False 路径逐字节不变**——该路径是播放核心契约，建议 H-2 与 M18 同批回归（播放/暂停/续播/多画质）。

### H-3. 缓存键失效比对（src.info）→ 【同意】（数据正确性）

- 安全角度：静默陈旧（原画缓存播旧内容、ASR 旧字幕）属"服务错误内容"，在公网/多用户情境下有信息误导风险；src.info 方案（不改键、比对失效）比改键成本低、无迁移问题，正确。
- 补充：`src.info` 写失败按"视为已变更"保守重建（T12 已提）✓；并发两写者用 tmp+os.replace 原子替换 ✓。

### H-4. rar/7z 条目 CLI 注入（字符校验 + 白名单）→ 【部分同意】—— 复核出 2 个真实缺口

- **快速版（字符校验）**：方向正确、覆盖全分支（校验在 `_unpack_download` L4143 分发前，7z 与 WinRAR 分支都过）✓。**但漏空 entry**：
  - 实证：`entry = q.get("entry") or ""`（L1395）可为空串；字符校验四项（`-`/`@`/`*`/`?`/`..`分段）对空串**全不命中** → 放行；`_seven_entry_size(tool, archive, "")`（L3969-4003）对空串无匹配返回 `(None, None)` → `_dl_7z` L4062 拿 `is_dir=None`（falsy，不触发 L4063 的 403）→ 走 close-delimited（L4080）→ `7z e -so archive ""` 中空 entry 被 7z 视为"无过滤"→ **整个压缩包全部内容流式解出**。这是"下载单条目"契约的实质破坏（全包外泄+带宽放大），快速版必须补 `if not entry: 403`。
  - 白名单版天然闭合（空串不在 Path 列表中 → 拒绝）——但这正是"白名单必须上、字符校验只是止血"的又一佐证。
- **白名单版漏 WinRAR-only 分支**：
  - 实证：`_unpack_download` L4152-4158 在无 7-Zip 时走 `_dl_winrar`（WinRAR/UnRAR）；T12 白名单方案指定用 `_seven_list(tool, archive)`（L3877，7z `l -slt -ba` 格式专用）——**对 WinRAR 分支不可用**（WinRAR 无 -slt；其 `lb` 裸列表格式见 `_unpack_winrar` L3906-3923，输出已归一化 `\\`→`/` + lstrip("./")）。
  - 结论：**无 7-Zip 仅装 WinRAR 的机器上，白名单校验缺失**，只剩字符快速版。需补充：WinRAR 分支用 `_unpack_winrar` 的 lb 列表做精确匹配（或与 7z 分支共用"先列全表再精确匹配"抽象，M10 顺带合并）。
- **补充 2 点**：① 归一化比较建议 `path.replace("\\","/").lstrip("./")`（T12 已提）外，Windows 下可再 `casefold()` 比较（7z 输出的 Path 大小写可能与 URL 输入不同，精确匹配会误拒——前端传列表原名时不触发，仅手工 URL 触发，安全侧宁可误拒，属可选）；② `_dl_winrar` 的 `-o+` 覆盖 + `os.listdir(tmp)` 取首文件逻辑在白名单精确匹配后不会多解出文件，契约恢复 ✓。
- **情境**：仅本机自用 zip 居多时风险低；公网暴露 + 自动化扫描会撞 `-`/`*` 参数，快速版即够；多用户共享 + 存在 rar/7z 互传时白名单（含 WinRAR 分支）必须。

### H-5. p12 仅 HTTPS + 随机密码 → 【同意】

- **理由**：`isinstance(self.connection, ssl.SSLSocket)` 判定可行——`_DriveServer.get_request`（L1591）wrap 后返回的 sock 即 `self.connection`（TLS 连接）；单端口双协议下明文连接是普通 socket，判定准确。私钥 NoEncryption 落盘（L4874-4881）+ 固定密码 1234（L4886）+ 明文 HTTP 同端口（L1573-1601）确实是"私钥+密码同信道泄露"，HTTPS-only + 随机密码为最小有效修复。
- **需补充 3 点**：
  1. 更稳的 TLS 判定可用 `hasattr(self.connection, "version")` 或 `self.connection.getpeercert()` 兜底（isinstance 在 3.12+ 仍成立，双保险无害）；
  2. **前端联动**：HTTP 明文模式（urls_http 免证书）下 app.js 不应渲染 p12/crt 下载入口（否则 403 体验）；需检查 index.html 是否按 `location.protocol` 分支；
  3. **"一次性领取"建议提前**：p12 含私钥，任何持 token 者经 HTTPS 均可下载——P1 完整版的 `_cert_p12_issued` 一次性标志成本极低（内存标志 + 重启重置），建议并入 P0 快速版；随机密码 `token_urlsafe(8)` 每次启动重生成，只影响 p12 导入（一次性），已装证书不受影响 ✓，但 README 必须同步（T12 已提）。
- **情境**：纯内网（无嗅探者）时属"低成本纵深"；公网暴露时是**必做**（扫描器抓 /api/certp12 是标准动作）；多用户共享时一次性领取尤为重要。

### H-6. cgi 护栏 → 【部分同意】—— raise 与"兼容 3.13"目标自相矛盾

- **理由**：护栏方向对（3.13 下给可操作提示而非裸崩溃），**但 `except ModuleNotFoundError: ... raise` 之后服务依旧整体不可用**——t12 自述"兼容目标 Python 3.10/3.11/3.12/3.13"未达成；且 3.13 下 cgi 仅影响**上传一个功能**（MCP 工具、浏览、下载、分享、转码全部正常），为上传让整个服务自杀不合理。
- **更优做法（推荐替代护栏）**：降级而非 raise——
  ```python
  try:
      import cgi
  except ModuleNotFoundError:
      cgi = None  # 3.13+：上传功能降级，其余功能照常
  ```
  do_POST 上传分支（L1511 前）加 `if cgi is None: self._send_json({"error": "当前 Python 已移除 cgi，上传不可用（请用 3.10-3.12 或装 legacy-cgi）"}, 501)`。这样 3.13 下服务可用、上传明确 501、提示可操作——护栏与兼容目标同时成立；P2 multipart 重写后彻底移除。
- **情境**：取决于部署 Python 版本；3.13 用户从"全挂"变"仅上传不可用"，体验差异显著。

---

## 二、专项校验

### ① H-1 双保险是否真能闭合任意文件外传？→ 【能，闭合】

全部文件打包外传入口枚举（已回源码核实）：
| 入口 | 路径 | 现校验 | 修复后 |
|---|---|---|---|
| GET /dlzip | L1444-1459 | `self._resolve`（L1450）✓ | 不变 |
| 分享 dlzip | L1030-1060 | `_resolve_share_path`（L1037/L1051）✓ | 不变 |
| POST /api/archive | L1474-1495 | 无（H-1 修复点） | 路由层 `_resolve` + 函数层 `_under` |
| `_archive_worker` | L4599-4665 | 消费 task["paths"]（创建时校验） | 随创建校验闭合 |
| MCP 工具 | — | 无打包工具（仅 drive_start/pin/status/stop） | — |

结论：双保险落地后无第四条外传路径，**闭合**。唯一残余面是"roots 中途变更"（运行中 `_state`/`server.roots` 不更新，stop/start 才变，无窗口）与 TOCTOU（realpath 校验后文件被换——本地攻击者前提，不在威胁模型）。函数层 skipped（部分跳过）与路由层整体 403 语义并存是**有意防御纵深**（skipped 分支只在绕过路由层时触发），设计自洽 ✓。

### ② H-4 白名单是否遗漏边界？→ 【遗漏 2 处，见 H-4 评审】

1. **空 entry → 全包解压**（快速版不拦；白名单版闭合）：`_seven_entry_size` 对 "" 返回 `(None, None)` → close-delimited → `7z e -so archive ""` 解全部。**实测链路完整，非臆测**。
2. **WinRAR-only 分支无白名单**：`_seven_list`（-slt）不适用于 WinRAR；`_dl_winrar`（L4109）只有快速版字符校验兜底。
3. 附加确认：`_dl_7z` 的 entry 是**独立 argv 元素**（L4068，list 形式非 shell 拼接）——无 shell 元字符注入面，H-4 的注入本质是 7z/WinRAR 自身的开关/通配/@listfile 语义，字符校验 + 白名单对症 ✓。

---

## 三、中严重度重点评审（安全/API/错误处理相关）

| 条目 | 判定 | 评审要点 |
|---|---|---|
| **M1** _shares 锁 | 同意 | 锁内快照 + 释放锁后写盘正确；补充：读侧（`_shares.get`、`_share_expired` parent 链）不加锁可接受——并发删除致父链缺失按"已过期"处理，**安全方向**；在方案注释中写明该语义。 |
| **M2** cancel 锁 | 同意 | 锁序"全局表→任务锁"与 `_archive_poll_cleanup`（L4695）/`_archive_dl` 一致；2 行改动，无环。 |
| **M3/M4** 原画锁粒度/谎报自愈 | 同意 | M4 的"写成功才 merge + 区间摘除回源"是数据正确性关键；busy 集登记必须与 per-digest 锁同步做（T12 已提）。 |
| **M5** downloading 豁免 | 同意 | TTL 从 downloading 起点起算合理；豁免后表超 16 条可容忍（继续逐出其它终态）✓。 |
| **M6** stop 清任务表 | 同意 | `_stop` 持 `_ARCHIVE_TASKS_LOCK` 清表 + `_archive_sweep_tmp` 排除活跃任务，二选一即可；建议两处都做（stop 清表为主）。 |
| **M7** 转码并发上限 | **部分同意** | 信号量方向对（ffmpeg 进程数有界）。**但建议 MSE 实时会话（persist=False）豁免限流**：MSE 播放是交互式契约，信号量满时 `api/trans` 若返回 409/空数据 → 播放直接失败/花屏（前端未设计排队播放态）；只对 transdl 持久化会话限流即可挡住主要 CPU 风险，且零播放回归。 |
| **M8** probe 单例池 | 同意 | 全局 ≤8 收敛正确；`_VIDEO_PROBE_LOCK` 语义保留与否均可（池上限已兜底）。 |
| **M9** 稀疏计费 | 同意 | 按区间集合实际字节计费正确；损坏 json 回退保守值 ✓。 |
| **M10** 7z 列表复用 | 同意 | close-delimited 省二次全量列表最优（接受下载器兼容性权衡）；浏览列表进程内缓存按 (realpath,size,mtime) 键 ✓。 |
| **M11** stderr drain | 同意 | **已核实仅 `_dl_7z`（L4089-4100 手动双管道）有死锁**；`_dl_winrar`（L4113）、`_seven_list`（L3880）、`_seven_entry_size`（L3972）、`_unpack_winrar`（L3909）均 `capture_output=True`（communicate 双读）无死锁——方案定位精确，只改 `_dl_7z`。 |
| **M12** 上传限流/覆盖策略 | 同意+补充 | ① **建议用 `open(dest, "xb")` 独占创建实现拒绝覆盖**——原子，同时消除"check-then-write 竞态"（并发同名上传两请求都过 exists 检查→双写交错，即 t4 L4）；② 默认拒绝覆盖与"只写不删改"对齐 ✓，前端需提示"文件已存在"；③ `UPLOAD_MAX_BYTES` 默认 1GB + Content-Length 预检合理。 |
| **M13** ADS 清洗 | 同意+补充 | `split(":",1)[0].strip().rstrip(". ")` + 空回退 "file" 正确；**Windows 保留名（CON/PRN/AUX/NUL/COM1-9/LPT1-9）建议从"可选"升为必做**（否则 `CON` 写设备/报错，行为不可控）。 |
| **M14** 安全响应头 | **部分同意** | nosniff/Referrer-Policy 无争议。**但注入点漏 2 处**：`_send_static`（L166-235，app.js 等由它提供）与 `_send_share_expired_page`（L1072-1089，HTML）。CSP 的 `script-src 'unsafe-inline'` 削弱 CSP 价值——**建议优先把 index.html 内联脚本外移或核实无内联脚本后去掉 `'unsafe-inline'`**；`X-Frame-Options: DENY` 需确认前端不以 iframe 嵌 view.html（T18 独立页，低风险，实测确认）。 |
| **M15** 防火墙残留 | 同意 | 启动前删同名 + `os._exit(2)` 前 best-effort 清理；规则名带 PID 可选（多实例互删场景）。 |
| **M16** 连接超时 | 同意+补充 | 头部读取 15s 建议放宽到 **30s**（公网代理隧道/慢链路场景更稳）；作用域必须精确：读头后、body 前恢复 `settimeout(None)`（T12 已提）；keep-alive 空闲回收属预期。 |
| **M17/M18** 保活 | 同意 | 轮询即活跃信号正确；M17 与 M18 合并实现 ✓。 |
| **M19** 文件 reparse | 同意 | 文件级 reparse 跟随（OneDrive 占位符）→ 根外内容入包，隐私相关；与目录分支同判 `0x400` 正确；云盘占位文件不可打包属预期（skipped 展示）。 |
| **M20** 取消模型 | 同意 | `_scan_plan(items, cancel_evt=None)` 默认 None 不改变同步路径 ✓。 |
| **M21** 看门狗 | 同意 | TCP 可达 + HTTP 超时双判定 + 忙任务暂停计数，保守语义保持；`os._exit(2)` 前 best-effort `_stop()` 清理 ✓。 |
| **M22** Range 锚定 | 同意 | 锚定 `$` + 显式拒绝多段（416 + `bytes */total`）是成本最低的正确做法；`_stream_cached`（L3273）同改 ✓；If-Range 可选。 |

---

## 四、四情境适用性与风险差异

| 情境 | 适用性评估 | 风险差异要点 |
|---|---|---|
| **纯家庭内网**（默认） | 全部 P0 均适用且无副作用 | H-1 仍应修（成本 10 行，防"误配 root=单目录"自锁）；H-4/H-5 属低成本纵深；H-6 按 Python 版本决定；M14 的 CSP 在此情境收益最低（无跨域）可后置；**风险差异最小**。 |
| **暴露公网被扫描** | H-1/H-5/M14/M16 优先级**显著上调** | 公网下 H-1=灾难（任意文件读取直接外传）；H-5 必做（扫描器抓 /api/certp12 是标准路径）；M16 slowloris/半开连接线程耗尽是公网常规攻击（当前 `daemon_threads` 无上限）；M14 的 Referrer-Policy 防 token 外泄；**token 72bit 熵在公网足够，前提是不泄露**。 |
| **多用户共享** | M1/M2/M12/M13/M14 优先级上调 | 并发概率上升（M1 分享丢失、M2 cancel 竞态更容易触发）；M12 覆盖策略（用户间互相覆盖文件）；M13 ADS；M14 的 token 泄露面（用户访问外链带 Referer）；H-1 若配受限 root 则多用户互相不可越界；**M7 在此情境需注意播放排队**（多人并发看视频）。 |
| **低性能旧设备** | H-2/M7/M8/M9/M16 优先级上调 | H-2（内存 O(文件)+1.28MB/s 节流在旧设备更致命）；M7（ffmpeg 并发上限=CPU 保护，**但 MSE 豁免**防播放失败）；M8（ffprobe ≤8）；M9（稀疏计费防缓存反复删写）；M16（线程堆积在低端机更易触发）；安全类 H-1/H-4/H-5 成本与性能无关，照常修。 |

---

## 五、新回归风险清单（安全模型/Windows 特性）

1. **H-1**：路由层整体 403 可能暴露"哪些路径是根外"（403 vs 400 文案可区分）——对 token 持有者无额外信息量，可接受。
2. **H-5**：HTTP 明文模式前端若仍渲染证书按钮 → 403 体验；随机密码未同步 README → 用户卡安装（T12 已提，此处加重提醒）。
3. **H-6 降级版**：3.13 下上传 501（功能缺失但服务可用）——预期行为，需在启动输出说明。
4. **M14 CSP**：`script-src`/`style-src` 与实际前端不符会打断首页/预览/播放——必须全流程实测后再上线 CSP 行（nosniff/Referrer-Policy 可先上）；`X-Frame-Options: DENY` 若前端 iframe 嵌 view.html 会误伤（实测确认）。
5. **M7**：MSE 实时播放被限流 → 播放失败/花屏（本评审建议豁免后消除）。
6. **M16**：15s（建议 30s）头部超时对慢速公网代理可能过紧；传输阶段必须已恢复无超时（T12 已提）。
7. **M12**：拒绝覆盖改变既有 UX（前端需提示）；`"xb"` 需处理 Python 3.10 兼容（3.10 支持 "x" 模式 ✓）。
8. **M13**：清洗 `: ` 后正常 NTFS 文件名不受影响（NTFS 禁 `:`）→ 无回归。
9. **H-2/H-3**：MSE persist=False 逐字节回归（H-2）；src.info 并发写原子性（H-3）。
10. **Windows 特性坑汇总**：ADS 冒号（M13）、尾随点/空格（M13 已处理）、保留名（建议必做）、reparse/junction（H-1 的 realpath 已解、M19 补文件级）、大小写不敏感（H-4 可选 casefold）、`icacls` 需管理员（H-5 P1 best-effort 已提）。

---

## 六、最终推荐优先级（安全/API 角度）

**立即（P0，一次提交）**：H-1 双保险 → H-4 快速版 + **补空 entry 拒绝** → H-6 **降级护栏（替代 raise）** → M13（含保留名必做）→ M1 → M2 → M11 → M14 的 nosniff/Referrer-Policy 部分（CSP 后置实测）。

**短中期（P1）**：H-3 缓存失效 → H-5 完整版（**一次性领取提前到 P0-P1**）→ H-4 白名单版（**补 WinRAR-only 分支**）→ M12（随 H-6 重写，`"xb"` 原子拒绝）→ M7（**MSE 豁免**）→ M8/M9/M17/M18 → M5/M6/M15/M19/M21 → M14 的 CSP 行（实测后）。

**后期（P2）**：H-6 multipart 流式重写（彻底移除 cgi）→ M10 → M16（30s）→ M20 → M22。

**一句话结论**：t12 方案批准实施，按上述优先级推进；落地前必须补齐 H-4 空 entry/WinRAR 白名单、H-6 降级、M14 注入点三处缺口，M7 做 MSE 豁免，M12 用 `"xb"` 原子覆盖策略。
