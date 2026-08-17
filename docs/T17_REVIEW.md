# t12 后端优化方案评审（任务 t17：打包 / 解压 / 系统集成角度）

- 评审人：auditor-server-archive（t6 打包/解压/系统集成原始审计者，T6_AUDIT.md）
- 评审对象：T12_PLAN.md（t12 后端优化方案，依据 t9 核验清单）
- 评审范围：H-1 根校验、H-4 rar/7z、M2/M5/M6/M10/M15/M19/M20/M21/M22 打包/看门狗/防火墙/进程相关；H-5/H-6/M1/M11/M13/M16 顺带表态
- 行号以 server\server.py（5325 行）实测为准

---

## 〇、总评

t12 方案整体**专业、克制、分层合理**（P0 快速修复 → P1 结构性 → P2 重构），与我 t6 审计的代码事实完全对齐，且多数方案给出"快速版+完整版"双轨，实施风险可控。**结论：批准实施，但需按本评审的 6 处修正/补充调整**（H-4 校验范围、H-4 白名单双条件与显示名→原始 Path 映射、M2 遗漏 `_archive_dl` 调用点、M5 需下载硬超时兜底、M20 信号量轮询、M15 规则名带 PID）。

---

## 一、逐项评审

### H-1. POST /api/archive 打包路径无根校验（双保险）【同意，需补充】

**判定：同意**（双保险方向正确，是本次方案中收益/成本比最高的一项）。

**① 并发/竞态下是否闭合（评审问题①）——结论：闭合**，论证如下：

- **引用一致性**：`_start` L5019-5020 构造 `_DriveServer(..., roots, ...)` → `_DriveServer.__init__` L1566-1571 `self.roots = roots`（同一对象）；L5030-5031 `_state.update(server=server, roots=roots, ...)` 也是同一对象。**同一进程内 `self.server.roots` 与 `_state["roots"]` 是同一 list 引用**，路由层与函数层校验看到同一份根集，无双源分歧。
- **roots 生命周期**：只在 `_start`（整体赋值）与 `_stop`（置 `[]`）时变更，无中间态、无逐元素修改；并发窗口内要么是完整根集要么是空列表，**不存在"半套根"**。stop 后函数层 `_state["roots"]=[]` 只会把一切路径判越界（更严格），不构成绕过。
- **TOCTOU**：路由层 resolve 通过 → 任务创建 → worker 扫描之间，roots 若被 stop 清空，worker 持 task 继续扫描（不重新校验）——但此时服务已停、任务本就应终止，且越界方向是"更严"，无安全影响。
- **兜底路径覆盖**：`/dlzip` L1450 与 `/api/archive/preview` L1427 已有 `_resolve`；`drive_pin` L5141 已有 `_under`；share 模式打包（`/s/.../dlzip` L1030）走 `_stream_archive` 且 items 已由 `_resolve_share_path` 校验，**不经 `_archive_new_task`**，不受影响。H-1 补上 POST /api/archive 后，打包三入口全部闭合。

**需补充 2 点**：
1. **函数层显式传 roots**：`_archive_new_task(paths, mode, roots=None)` 缺省取 `_state["roots"]` 依赖"HTTP 模式与 MCP 模式同引用"这一当前事实。**建议路由层显式传 `self.server.roots`**，函数层缺省才取 `_state`，避免未来 `_start` 改为复制列表时静默失效（防引用分裂假设）。
2. **校验位置**：在 L4547-4552 realpath 之后、exists 之前对 `ap` 做 `any(_under(r, ap) for r in roots)`；`_under` 内 `os.path.realpath(root)` 每次调用重复系统调用，可循环外预计算 root realpath（微优化，非必须）。

### H-4. rar/7z 条目下载 CLI 注入【部分同意——快速版需修正范围，白名单版需补双条件】

**快速版（P0 字符拒绝）：部分同意，必须修正一处设计缺陷**

- **缺陷**：t12 把校验放在 `_unpack_download`（L4143）**分发前统一执行** → `-`/`*`/`?`/`..` 校验会**误伤 zip/tar 分支的合法条目**——zip 条目名可合法含 `*?`（Linux 侧打包的 zip，如 `a*b.txt`），zip 走 namelist 精确匹配（L4011-4017）本来安全。**修正：字符校验只应用于 `fmt in ("7z","rar")` 分支**（在 `_dl_7z`/`_dl_winrar` 入口或 `_unpack_download` 内按 fmt 分支后校验）。
- **补充**：`-` 校验建议 `entry.strip().startswith("-")`（`-` 单字符、`--x` 同属开关语义）；`..` 检测 `".." in entry.replace("\\","/").split("/")` 正确（首段 `..` 已被 `_hier_level` 剥掉，中段需防）。
- 误拒 `-` 开头合法条目（Windows 允许 `-foo.txt`）属安全优先取舍，可接受，白名单版可解。

**白名单版（P1）：需补充 3 点才可实施**

1. **精确匹配 ≠ 安全**：仅"entry 与某 Path 精确相等"不够——若归档真含 `-p1` 条目，精确匹配通过后传给 7z 仍是开关（7z 全命令行解析，与位置无关）。**必须双条件：精确匹配 AND 不以 `-`/`@` 开头**，两者都过才放行。
2. **显示名→原始 Path 映射**：`_seven_entry` L3863 归一化用 `lstrip("./")`，会把 `.gitignore` 显示为 `gitignore`（我 t6 L1 已报：点文件无法下载）——白名单若用同一归一化 key，匹配到的仍是剥点后的名，传给 7z 匹配不到真实条目。**必须建立"归一化显示名 → 原始 Path"映射**（参照 `_dl_zip` L4011-4017 的 `_fix_zip_name` 映射模式），CLI 传**原始 Path**。这一改同时修掉 t6 L1（点文件/反斜杠条目下载失败）。
3. **与 `_seven_entry_size` 统一 key**：L3983 现在用 `p == entry or p.replace("\\","/") == entry` 与原始 Path 比——白名单版落地后 size 查询与下载匹配用同一映射 key，避免"列表能看、下载 404、大小查不到"三态分裂。

**实现可行性/性能（评审问题②）**：`_seven_list`（L3877-3903，`l -slt -ba -sccUTF-8`，300s 超时）已存在可直接复用；每次下载触发一次全量子进程列表 = O(包条目数) 解析。**下载是低频操作，可接受**；配合 M10 进程内缓存（键 = archive realpath+size+mtime）后，重复浏览/下载命中缓存，性能问题消失。**结论：实现可行、性能可接受（带缓存）**。

### H-5. p12 私钥分发【同意】/ H-6. cgi 护栏【同意】

- H-5：P0（HTTPS-only `isinstance(self.connection, ssl.SSLSocket)` 判定 + 随机密码打印）**同意**——`self.connection` 在 `get_request` L1591 wrap 后确为 SSLSocket，判定可靠；MCP 模式 `drive_start` 返回 dict（L5041-5051）与 CLI 输出（L5289-5294）都要带密码。P1 一次性领取（内存标志即可，p12 本就内存生成无磁盘产物）与 icacls（best-effort，用户目录默认 ACL 已限当前用户，属纵深）均同意。
- H-6：P0 护栏**同意**（3.13 裸崩溃 → 可操作提示）；P2 multipart 重写随 M12，不在本评审主线。

### M1. _shares 锁【同意】/ M13. ADS 冒号【同意】
- M1 快照后释放锁写盘正确（分享创建/清理/持久化 L1274-1276/L1315-1317/L3648-3657 全包锁）。M13 `split(":",1)[0]` + 尾随点/空格清洗正确（Windows 文件名冒号仅 ADS 语义）。

### M2. /api/archive/cancel 在 task 锁下改全局表【同意，但遗漏一个调用点——需补充】

t12 只覆盖 cancel 路由（L1503-1508）。**遗漏：`_archive_dl` 的取消分支** L4793-4796：

```python
except _ArchiveAborted:
    with task["lock"]:
        _archive_delete_task(task)   # ← 与 cancel 路由同款问题：pop 全局表未持 _ARCHIVE_TASKS_LOCK
```

`_archive_delete_task` L4514 的 `_ARCHIVE_TASKS.pop` 与 `_archive_poll_cleanup` L4697 持全局锁迭代 `_ARCHIVE_TASKS.values()` 并发 → 同样的 RuntimeError。**修正：M2 覆盖全部 `_archive_delete_task` 调用点**（L1508 cancel 路由、L4796 `_archive_dl` 取消分支；L4703/4705/4713 poll 已持全局锁无需改）。锁序"全局表锁 → 任务锁"与 poll 一致，无环（t5 已确认）。

### M5. 惰性清理杀下载中任务【同意 + 需补充硬超时兜底】

- 豁免 downloading 的 TTL/逐出 + `dl_started_at` 起算：**同意**，实现简单（`_archive_dl` L4754 置 downloading 时记录时间戳）。
- **需补充**：豁免后 downloading 任务失去清理出口——**半断连场景**（客户端 TCP 挂着不 RST，`wfile.write` 无超时阻塞）→ 任务永久残留 + zip 永久占用。**必须加"下载硬超时"**（如 2h 或可配置）：poll 时 `now - dl_started_at > DL_HARD_TIMEOUT` 才取消删除。这与 M16 连接超时体系互为补充，但 M16 是 P2——**下载硬超时建议随 M5 一起在 P1 落地**（3 行）。

### M6. stop 清任务表【同意，选方案 a】

- 方案 a（`_stop` 清表：逐任务 `cancel_evt.set()` + `_archive_delete_task`，持 `_ARCHIVE_TASKS_LOCK`）**优于**方案 b（`_start` 排除活跃任务）——b 的"保留仍在下载的"依赖对 sweep 做白名单，但 `_archive_sweep_tmp` L4526 按 `tk_*.zip` 全局删，区分活跃与否反而复杂且易错；且 stop 场景下下载本就应终止。**推荐 a**。
- 锁序：`_stop` 清表与 `_archive_dl`（持 task["lock"] 流式 + 取消分支 pop）并发——全局表锁 → 任务锁顺序一致即可；`_archive_dl` 取消分支对已 pop 的任务 `pop` 返回 None 无害。
- 顺序：server_close 之后清表（确保无新请求）。CLI Ctrl+C 路径（L5310-5311 `_stop()`）自动覆盖 ✓；看门狗 os._exit 路径不经过（进程退出，表自然消失，tk_*.zip 由下次启动 sweep 兜底）✓。

### M10. 7z 列表复用【部分同意——反对方案 b 优先】

- **反对 b（放弃 size 预查走 close-delimited）作为主选**：`_dl_7z` close-delimited 分支（L4080-4087）无 Content-Length + `Connection: close` → 下载器进度条未知、断点续传失效、部分代理缓冲到 EOF 才交付。**保留 Content-Length 对浏览器/下载器兼容性价值高**，不应为省一次列表牺牲。
- **推荐 a+c 组合**：a) 复用 H-4 白名单版已取的列表（size 随取，零额外子进程）；c) 进程内缓存 `(archive realpath, size, mtime) → raw entries`，**带容量上限**（LRU 最近 8 个包，防大包列表占内存）。
- **补充轻量替代**：`_seven_entry_size`（L3969-4003）若独立使用，可给 7z 加条目参数 `[tool,"l","-slt","-ba","-sccUTF-8",archive,entry]` 让 7z 只列匹配条目（输出量大幅缩减）——但 entry 含通配符会多匹配，需配合 H-4 白名单（entry 已精确）才安全。作为 a 不可用时的降级。

### M11. stderr drain【完全同意】
与我的 t6 M1 完全一致；drain 线程 + join 是正确做法，P0 合适。

### M15. 防火墙残留【同意，推荐 c+a 组合】

- **方案 c（规则名带 PID：`TransferMCP-<port>-<pid>`）值得升级为必选**：规则名唯一化后，多实例/崩溃重启各自精确清理，不互相干扰，也避免"delete 同名删光用户手工规则"的误伤面。**推荐 c+a 组合**：`_start` 添加前先 `delete rule name=TransferMCP-<port>`（迁移清理旧版无 PID 规则一次）+ 按 PID 规则精确 add/delete。
- **方案 b（os._exit 前清理）可行但要防阻塞自杀**：netsh 调用最长 15s 超时（L4974/L4995），自杀路径应短超时（3s）或异步线程，避免"想自杀却被 netsh 卡 15 秒"。更稳的兜底：**启动脚本重启路径先 `netsh delete rule name=TransferMCP-<port>*`**（bat 里一行，随"启动网盘.bat"改造），即使进程被强杀也能收敛。
- netsh 非管理员 best-effort 语义已存在（L4977-4985），delete 失败静默 ✓。

### M19. 文件级 reparse【同意 + 补充 OneDrive 取舍说明】

- 4 行改动（文件分支补 `st_file_attributes & 0x400` 检查，仿目录分支 L4271-4279）**同意**。
- **补充 1（重要，需在方案中明示）**：该检查只作用于 `_scan_plan` 递归子项（L4284-4296 的 expand 内）；**顶层显式选择项**（L4303-4328 isfile 分支）是用户主动挑选并经 `_resolve`/H-1 校验的路径，**不应跳过**（用户显式选择根内链接 = 用户意图）。t12 的 4 行改动天然只动 expand 内分支 ✓，但要写明"顶层不检查"防未来误改。
- **补充 2（OneDrive/云盘占位符影响）**：占位符文件（IO_REPARSE_TAG_CLOUD）也是 reparse 点，`stat(follow_symlinks=False).st_file_attributes & 0x400` 命中 → **云盘文件全部不可打包**（此前能打包，open 触发 hydration）。t12 说"属预期行为"——**接受，但需在 README/CHANGES 明示此行为变化**；可选增强（不进本次）：reparse 命中时若 `realpath(e.path)` 仍在打包根内则跟随（占位符正常），在根外才跳过——代价是复杂度上升，建议按用户群需求后置。

### M20. 取消模型【部分同意——信号量等待需改轮询】

- `_scan_plan(items, cancel_evt=None)` 每 500 条检查：**同意**（默认 None 不改变 /dlzip 同步路径 ✓）。
- **信号量等待，t12 自认"仍阻塞可接受"——我认为不可接受**：queued 任务取消后工人线程仍阻塞在 `_ARCHIVE_SEM.acquire()`（L4608），**取消事件已置但线程不退，直到拿到额度**（可能数分钟，取决于其它两个打包任务时长）。**修正：`acquire(timeout=0.5)` 轮询 + 每轮查 cancel_evt**（3 行改动）→ 取消秒级收敛，且不改变信号量语义（同额度、同并发上限）。
- **补充：取消后的清理归属**。cancel 路由对活任务只 `cancel_evt.set()`（L1504-1505）不删表——任务以 aborted 残留等 poll/TTL 清。M20 应补充：**worker 收敛到 aborted 后自行 pop 任务**（持全局表锁），或 cancel 路由轮询等待状态变更后删除。避免"取消后任务仍占表位"。

### M21. 看门狗双判定【部分同意——TCP 判定收益低，忙态豁免才是关键】

- **TCP 可达判定收益低**：本服务 `allow_reuse_address=False`（L1564）端口独占——存在"端口被其它进程占用"时 `_start` 直接就失败了，不存在"端口被占但服务在跑"的混淆场景。TCP connect 成功只证明 backlog 有 socket，**证明不了处理线程活着**（而后者恰是僵死判定的目标）。`_http_probe_ok` 的 HTTP 探测（L5250-5260）已走完整请求处理链，本身就是最贴切的存活判定。
- **误杀概率比 t12 估计的低**：探活目标 `/api/info` 纯内存（`_urls`/`getaddrinfo`，不读盘）；zlib 压缩释放 GIL，打包期间 HTTP 线程仍可调度。磁盘饱和场景下探活不读大文件，大概率仍响应。**t12 设想的"磁盘 IO 饱和误杀"实际触发面较窄**。
- **值得做的两项**：a) **忙态豁免**——`_ARCHIVE_TASKS` 存在 compressing 或 `_trans_sessions` 非空时，失败阈值从 3 放宽到 5（或暂停计数），成本 5 行，覆盖大任务场景余量；b) **自杀前 best-effort 清理**——同意方向，但**不要调用完整 `_stop()`**（`server.shutdown()` 在僵死时可能阻塞，自杀延迟），只做防火墙删除 + 任务表清理（各带 try/except 短超时）。

### M22. Range 锚定【同意，a 方案】

- 正则锚定 + 显式拒绝多段（416 + `Content-Range: bytes */total`，复用 `_range_unsatisfiable` L3958-3963）：**同意**，成本最低、符合 RFC 7233，"416 优于静默截断"。
- **注意**：`_send_file_range`（L298）与 `_stream_cached`（L3273）两处同款正则都要改（t12 已覆盖 ✓）；**后缀范围语义必须保留**（`bytes=-500`，第一组 `\d*` 空匹配由现有逻辑处理）——锚定后回归重点。
- c（If-Range 用 mtime 弱校验）：可选，优先级低（主流客户端单段 + 断点续传自校验）。

---

## 二、五问评估汇总

| 评审问题 | 结论 |
|---|---|
| ① H-1 双保险并发/竞态闭合性 | **闭合**。路由层/函数层同引用（L5019-5020 vs L5030-5031）、roots 生命周期无中间态、stop 只会更严、share 路径不经 `_archive_new_task` 不受影响；补充"显式传 roots 防引用分裂假设" |
| ② H-4 白名单可行性/性能 | **可行**。`_seven_list` 现成可复用；精确匹配必须叠加"非 `-`/`@` 开头"双条件 + 显示名→原始 Path 映射（顺修点文件下载缺陷）；每次下载一次全量列表可接受，配 M10 缓存后无性能问题 |
| ③ task 队列治理（M5/M6/M10） | **方向正确**：M5 豁免+`dl_started_at` 同意但必须补下载硬超时兜底（防半断连永久残留）；M6 选方案 a（stop 清表）；M10 反对 b 优先（保 Content-Length），推荐 a+c（复用列表+带容量缓存） |
| ④ 看门狗双判定 / M22 Range | 看门狗：TCP 判定收益低（端口独占已消除混淆），**忙态豁免才是关键**，自杀前清理勿用完整 `_stop` 防阻塞；M22：a 方案同意，注意两处正则+后缀范围回归 |
| ⑤ Windows 特有坑 | netsh 同名规则累积（→ PID 命名+启动前清旧名+启动脚本兜底）；reparse 含云占位符（→ 行为变化需明示，顶层显式选择不跳过）；路径大小写（ntpath.commonpath normcase 正确、zip 条目大小写敏感但 Windows 无同名不同大小写文件、7z 匹配大小写不敏感→白名单后传原始 Path 规避歧义） |

---

## 三、最终推荐

**批准实施**，按以下调整：

1. **P0 阶段**（安全与并发）：
   - H-1 双保险照做；**补充**：路由层显式传 `self.server.roots`、函数层 realpath 后校验。
   - H-4 快速版照做；**修正**：字符校验只限 7z/rar 分支（勿挡 zip/tar 合法 `*?` 条目）；`-` 用 `strip().startswith("-")`。
   - M2 照做；**补充**：覆盖 `_archive_dl` L4796 取消分支（第二个无全局锁的 `_archive_delete_task` 调用点）。
   - M11 stderr drain、M13 ADS、H-6 护栏、H-5 快速版、M1 _shares 锁：照做。
2. **P1 阶段**（打包与系统）：
   - H-4 白名单版：按本评审补双条件 + 显示名→原始 Path 映射 + 与 `_seven_entry_size` 统一 key。
   - M5：豁免 + `dl_started_at` + **下载硬超时**（随 P1，勿等 P2 的 M16）。
   - M6：选方案 a（`_stop` 清表）。
   - M15：**c+a 组合**（PID 命名 + 启动前清旧名 + 启动脚本兜底清理）；自杀路径清理用短超时。
   - M19：4 行照做；**明示**"顶层显式选择项不跳过"与"OneDrive 占位符不可打包"的行为变化。
   - M21：**去掉 TCP 判定**（或降为日志级参考），改做忙态豁免（阈值 3→5）+ 自杀前轻量清理（不调 `_stop`）。
3. **P2 阶段**：
   - M20：`_scan_plan` 取消检查照做；**信号量改 `acquire(timeout=0.5)` 轮询 + cancel 检查**；补充 worker 收敛后自删。
   - M10：a+c（复用 H-4 列表 + 带容量 LRU 缓存），**不做 b**（保 Content-Length）。
   - M22：a 方案照做（两处正则 + 后缀范围回归）；c 可选低优。
   - M16：同意方向（`handle_one_request` 开头 15s 覆盖 keep-alive 空闲期，传输阶段已恢复无超时，自洽）。

**唯一反对项**：M10 方案 b（close-delimited 优先）——牺牲 Content-Length 换省一次列表，性价比差，不推荐。

**回归重点**（对齐 t12 验收节）：H-1 需验"受限根下根外 403/skipped + /dlzip 与分享打包零回归"；H-4 需验"zip/tar 含 `*?`/`-` 开头条目仍可下载"（修正后的范围判断）；M5 需验">30min 慢速下载不被杀 + 半断连任务 2h 后被清"；M15 需验"kill -9 后 netsh show rule 无残留 + 多实例 PID 规则互不干扰"；M19 需验"顶层链接仍可打包、递归子项链接进 skipped、OneDrive 占位符提示清晰"。
