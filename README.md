# 远程电脑文件访问服务（drive-mcp v3）

## 1. 项目简介

一个基于 Python 标准库 `http.server` 的"手机网盘"式**远程电脑文件浏览/传输服务**：把整台电脑（默认所有固定磁盘）变成一个手机浏览器可访问的 HTTPS 网盘，支持浏览、上传、下载、打包、在线视频播放（MSE 免证书转码）、文本/Markdown/CSV/PDF 预览、压缩包在线解压、分享链接等；同时通过自带的行式 JSON-RPC（MCP stdio）协议暴露 `drive_start/pin/status/stop` 四个工具，供 Claude 等 AI 客户端直接调用。

核心特性：

- **单端口双协议**：8443 端口按首字节嗅探自动识别 TLS（`0x16` → SSL 包装）与明文 HTTP，`https://` 与 `http://` 同端口可访问，免双监听。
- **右侧滑出侧边栏**：视图切换（列表/网格）、类型多选筛选（视频/文本/编程/软件包/压缩包/快捷方式/目录/自定义后缀）、三种排序双向切换、搜索统一入口。
- **深度查找**：可选同时匹配文件名与视频元数据内容（title/author/type/tags/notes 等白名单字段）。
- **推荐标签**：侧边栏自动对当前目录做 CJK bigram 分词 + tags 完整标签 + 停用词过滤，按出现文件数计分，异步分批增量统计、动态渐出 Top10；点击标签自动开启深度查找并填入搜索框。
- **概率模糊匹配**：精确子串之外，支持隔开/缺字（LCS）、错字/相邻转位（滑窗 Damerau-Levenshtein）、乱序（字符多集覆盖率约束）三种容错，阈值 0.8；两阶段渲染（先同步精确子串，再异步分片模糊补充、二分插入正确排序位置，可打断）。
- **关键词语法**：空格与 `&` = AND（且），`,` `，` `|` `/` = OR（或），支持组合查询，精确与模糊两阶段统一解析。
- **简繁归一化**：搜索前经 `cjk-normalize.js` 做简体/繁体/日式新字体逐字归一化，简繁混输都能命中。
- **MSE 免证书视频播放**：浏览器对 MSE 喂入数据的格式嗅探不受"媒体子资源证书限制"，不装证书也能播；四档画质（原画/高清/标清/低清）、字幕、ASR 识别、进度条悬停帧预览。
- **meta=1 批量元数据**：`api/list?meta=1` 一次返回全目录的分类 kind/mime、（视频）时长/宽高等，供前端零额外请求做筛选/排序/搜索；ffprobe 探测有 3s 预算后台进行，绝不阻塞列表。

> 源码入口：`server/server.py`（模块 docstring 声明了整体设计意图）

## 2. 技术栈与依赖

| 依赖 | 用途 | 必需性 |
|---|---|---|
| Python 3.9+ 标准库（`http.server`/`ssl`/`cgi`/`zipfile`/`ctypes` 等） | 全部 Web 服务与核心逻辑 | **必需（唯一硬依赖）** |
| `cryptography`（第三方 pip 包） | 生成自签名证书（RSA-2048）、打包 PKCS#12（`_ensure_cert` / `_cert_p12_bytes`，缺失直接报错退出） | **必需** |
| `ffprobe.exe`（常量 `FFPROBE`：`C:\Users\user\ffmpeg\bin\ffprobe.exe`） | 视频元数据提取（tag/时长/分辨率/码率） | 可选（缺失静默降级 `details=null`） |
| `ffmpeg.exe`（常量 `FFMPEG`，与 ffprobe 同目录 `C:\Users\user\ffmpeg\bin\ffmpeg.exe`） | 视频缩略图、MSE 转码/remux、内嵌字幕提取、缩略图条、单帧预览 | 可选（缺失时对应接口 404/500） |
| 无（纯 Python `zipfile`） | 打包下载输出 `.zip`：同步 `/dlzip`（`_stream_archive`）+ 打包中心后台任务（`_archive_new_task`，分块写入 `_write_entry_chunked`） | 内置，零外部依赖 |
| 无（纯 Python `zipfile`/`tarfile` 标准库） | 压缩包在线解压（T25）：zip/rar/7z/tar/tgz/tar.gz/tar.bz2 列表 + 层级目录浏览（`api/unpack`/`api/unpackdir`）+ 单条目下载（`api/unpackdl`） | zip/tar 族内置零外部依赖；rar/7z 需系统已装 7-Zip 或 WinRAR（探测到才启用，未探测到返回明确提示，不新增任何 pip/npm 依赖） |
| `faster_whisper`（pip 可选安装） | 视频语音识别生成字幕（`/api/asr`） | 可选（未安装接口返回 501） |
| Bootstrap / highlight.js / 文件类型图标 SVG | 前端离线静态资源（`static/` 目录） | 必需（随项目分发，白名单提供） |
| `cjk-normalize.js` | 简繁/日式新字体字符级归一化映射表（`static/cjk-normalize.js`，约 28KB，纯前端无运行时依赖） | 必需（随项目分发，已在静态白名单） |

`cjk-normalize.js` 数据来源：**opencc-data v1.4.1**（Apache-2.0，<https://github.com/nk2028/opencc-data>，原始词典 OpenCC <https://github.com/BYVoid/OpenCC>），使用 `TSCharacters.txt` / `STCharacters.txt` / `JPShinjitaiCharacters.txt` 三个文件生成（见该文件头部注释）；导出全局函数 `normalizeCJK(str)` 逐字归一为简体规范字。

无任何 Web 框架；MCP 协议层也是零依赖手写实现（`server/mcp_stdio.py`）。

## 3. 目录结构

```
远程电脑文件访问服务/
├── .mcp.json                  # Claude 插件 MCP 配置：python server/server.py（MCP 模式入口）
├── 启动网盘.bat                # Windows 启动脚本：探测 Python → 杀残留实例 → 端口占用检查 → --serve auto 启动，崩溃 30s 自动重启
├── server/
│   ├── server.py               # 主服务（约 5325 行）：单端口（HTTPS/HTTP 首字节嗅探）+ MCP/CLI 双模式，全部核心逻辑
│   ├── mcp_stdio.py            # 零依赖 MCP stdio 框架（240 行）：JSON-RPC 2.0 行协议
│   ├── templates/
│   │   ├── index.html          # 主站模板（约 1130 行）：页面骨架 + 内联 CSS 变量层 + 打包中心面板；每次请求实时读盘支持热更新
│   │   └── view.html           # 独立预览页（约 132 行）：/view 沉浸式新页面（#__shadow 占位 DOM 模式）
│   └── __pycache__/            # Python 字节码缓存（可删除）
└── static/
    ├── app.js                  # 前端主逻辑（约 5377 行）：列表/网格、侧边栏筛选/排序/搜索、推荐标签、模糊匹配、播放器、预览、分享、打包中心、收藏等
    ├── cjk-normalize.js        # 简繁/日式新字体归一化映射表（opencc-data 1.4.1，28KB，全局 normalizeCJK）
    ├── bootstrap.min.css / bootstrap.bundle.min.js   # 离线 Bootstrap 5
    ├── highlight.min.css / highlight.min.js          # 离线代码高亮
    ├── icons/                  # 文件类型 SVG 图标：line 线条 15 个 + color 子目录彩色 15 个（共 30 个）
    │   └── color/              # 彩色 SVG 图标（T34，与 line 同套设计语言）
    └── thumbs/                 # 视频缩略图缓存（md5(realpath|size|mtime).jpg，运行时自动生成，已在 .gitignore）
```

运行期数据目录：`~/.transfer-mcp/`（用户主目录下，非项目目录）——证书、shares.json、transcache 都在这里，详见第 8 节。

## 4. 启动方式

### 4.1 启动网盘.bat（网页模式）

1. **Python 探测**：按顺序检查 `D:\ANACONDA\python.exe` → `TRAE SOLO CN` 内置 python → `C:\Python312\python.exe` → `C:\Python311\python.exe` → 兜底用系统 `python`（可能是 WindowsApps 占位符 stub，无法运行）。
2. **自动清理残留实例（幂等）**：按端口列出监听 PID，命令行含 `server.py` 者判定为本服务旧实例，`taskkill /F /T /PID` **连进程树**强杀；再清一遍"命令行含 `--port 8443` 但尚未在监听"的启动中/崩溃循环实例（防止其与新实例抢端口）。与脚本/本项目无关的进程一律不碰。**端口冲突时脚本自动清理并等待释放，可随时重复双击，不会出现"两次启动互相打架"。**
3. **等待端口真正释放**：轮询"能否 bind 到 8443"，最多约 8 秒——不再盲目 sleep，新实例必然在旧句柄释放后才启动。
4. **端口被外来程序占用检查**：8443 若仍被其它程序监听（非本服务），打印 `netstat -ano | findstr :8443` 与 `taskkill /F /T /PID [pid]` 提示并退出（不误杀外来程序；若旧窗口以管理员身份启动，需同样以管理员身份运行本脚本才能清理）。
5. **启动命令**：`server.py --serve auto --port 8443 --token transfer`，即 CLI 模式：根目录 `auto`（全部固定磁盘）、端口 8443（**该端口同时服务 HTTPS 与 HTTP 明文，首字节嗅探自动识别**）、固定 token `transfer`（重启后链接不变）。bind 失败（端口未及释放/被占）时 **server.py 自动重试 3 次（间隔 3 秒）**，并打印"端口仍被占用…（第 N/3 次）"。
6. **启动后自检 + 假死看门狗**：启动成功后 server.py 立即本地探测 `http://127.0.0.1:8443/transfer/api/info`，打印 **"本机自检: OK / FAIL"**；此后每 10 秒自探一次，连续 3 次无响应判定为"僵尸监听"（端口还开着但请求无人处理，如线程卡死），进程自动以退出码 2 退出，脚本 5 秒后快速重启；普通崩溃 30 秒后自动重启。关闭窗口即彻底停止本窗口的进程。

### 4.2 CLI 直接启动

`python server/server.py --serve [根目录|auto] --port <端口> --token <token>`（参数解析在 `__main__` CLI 入口；`--serve` 缺省值 `auto` = 整机所有固定磁盘）。启动后打印 HTTPS/HTTP 访问 URL、根目录与打包格式；bind 失败自动重试 3 次（3s/次，打印"端口仍被占用…"）；启动成功立即打印"本机自检: OK/FAIL"，此后每 10s 自探防"僵尸监听"（见 §4.1 第 6 点），Ctrl+C 停止。

### 4.3 MCP 模式（AI 客户端）

`.mcp.json` 定义 `transfer-mcp`：`command: python`，`args: [${CLAUDE_PLUGIN_ROOT}/server/server.py]`，并设置 `PYTHONUNBUFFERED=1`、`PYTHONIOENCODING=utf-8`。**不带 `--serve` 参数运行即进入 MCP 模式**（`__main__` CLI 分支装配 `mcp_stdio.MCPServer`），通过 stdin/stdout 行式 JSON-RPC 与 Claude 宿主通信，暴露 4 个工具：

| 工具 | 参数 | 作用 |
|---|---|---|
| `drive_start` | `root`（默认 "auto"）、`port`（默认 8443） | 启动服务，返回 URL/打包格式 |
| `drive_pin` | `paths`（绝对路径数组） | 把文件/目录收藏到网页显著位置 |
| `drive_status` | 无 | 查询运行状态/根目录/URL |
| `drive_stop` | 无 | 停止服务并清理防火墙规则 |

## 5. 服务端架构与模块（server.py）

### 5.1 核心类

- **`_DriveServer(ThreadingHTTPServer)`**：`AF_INET6` 地址族 + 关闭 `IPV6_V6ONLY`（重写 `server_bind`）实现**双栈监听**——`[::]` 同时接受 IPv4-mapped 连接，手机/本机 IPv4 均可达；`daemon_threads=True`；`allow_reuse_address = False`（Windows 下禁止同端口多实例并存，端口被占时 bind 直接抛错退出）。持有 `roots`（允许根目录列表）、`token`、`pinned`（收藏列表）、`ssl_context`。**重写 `get_request` 做首字节嗅探**：accept 后 `recv(1, MSG_PEEK)` 窥探首字节，`0x16`（TLS ClientHello）则 `wrap_socket` 走 HTTPS（握手设 5s 超时防半截 ClientHello 阻塞），否则按明文 HTTP 处理——单端口 8443 同时服务 HTTPS 与 HTTP。
- **`_DriveHandler(BaseHTTPRequestHandler)`**：`protocol_version = "HTTP/1.1"`（便于 `<video>` 复用连接做 Range 分片）。核心方法：
  - `_send_json` / `_send_error_page`：统一 JSON 响应与友好 HTML 错误页（403）
  - `_send_static`：静态资源服务，**白名单 + basename 双重校验**（详见第 10 节）
  - `_send_file_range`：统一 Range 断点续传下载，支持 `bytes=a-b` / `bytes=a-` / `bytes=-suffix`，非法越界返回 416；无会话状态，token 在 URL 里所以**换 IP 可续传**
  - `_resolve`：路径越界校验——绝对化 + realpath + `commonpath` 前缀匹配 roots，越界返回 None
  - `_resolve_share_path`：分享根内校验（多文件分享走白名单精确匹配、虚拟分享双向命中）
  - `_handle_share`：`/s/<share_token>/...` 分享路由（见第 6.2 节）
  - `_handle_trans_api`：视频转码/字幕/预览子路由统一处理（主站与分享页共用，resolve_fn 抽象越界校验）
  - `do_GET`、`do_POST`：路由表，见第 6 节

### 5.2 关键独立函数/模块

- **磁盘枚举** `_fixed_drives`：`GetLogicalDrives` + `GetDriveTypeW==DRIVE_FIXED` 枚举固定磁盘。
- **目录列表** `_list_dir`：scandir，目录在前按名排序；系统噪声文件（DumpStack.log/hiberfil.sys/pagefile.sys/swapfile.sys，`_SYSTEM_NOISE`）标记 `locked=True` 前端灰显不可下载；权限错误返回 None。隐藏文件默认过滤，`show_hidden=1` 时不过滤（T37）。
- **视频元数据** `_video_details`：ffprobe `-show_format -show_streams` 提取 tag/时长/码率/分辨率/声道等，进程内缓存 key=(realpath,size,mtime)，任何失败静默返回 None；`_parse_comment_meta` 把 comment 标签解析为结构化键值（上传/观看/点赞/标签/作者/类型），`_video_meta` 构建前端详情面板数据。
- **meta=1 批量元数据**（见第 5.4 节）：`_meta_kind` 扩展名→ 分类/mime；`_video_meta_cached` 仅从进程内缓存读视频内容元数据（零 IO）；`_probe_video_meta` 后台并发探测；`_augment_entries_meta` 给每个 entry 附加 meta 字段。
- **缩略图** `_thumb_path`：ffmpeg 抽帧第 3 秒（失败回退 0 秒），`scale=360:-2`，缓存 `static/thumbs/<md5(realpath|size|mtime)>.jpg`。
- **打包**：核心已拆分为三函数——`_scan_plan`（纯扫描展开清单 `(plan, dirs, total_size, skipped)`，visited_dirs+depth 防循环、junction 目录跳过）、`_write_zip_entries`（目录条目 + 文件条目写入；task=None 走 `zf.write` 直传保持旧行为，task 给定走 `_write_entry_chunked` 分块写、推进度、支持取消）、`_stream_archive`（薄封装：信号量非阻塞 429 + 临时盘空间预检 + 调 scan/write + 流式响应 `X-Archive-Skipped` 跳过清单头）。`_build_archive_items` 组装 arcname；`_ARCHIVE_MODES` 三种压缩级别（store/fast/normal）；`_ARCHIVE_SEM` 同时最多 2 个压缩任务（同步/后台共享额度）。后台任务体系见第 7.4 节。
- **解压**：`_unpack_list` / `_unpack_download`：zip（zipfile）/ tar、tgz、tar.gz、tar.bz2（tarfile）流式 + 层级浏览；rar/7z 需探测到系统 7-Zip 或 WinRAR 才启用，否则返回 unsupported。
- **防火墙**：`_add_firewall_rule` netsh 添加入站规则 `TransferMCP-<port>`，失败返回含修复命令的提示；`_remove_firewall_rule` 停止时删除。
- **URL 生成**：`_public_ipv6` 找非链路本地非 ULA 的 IPv6；`_urls` HTTPS 链接、`_urls_http` HTTP 免证书链接（**与 HTTPS 同一端口**）。
- **证书**：`_ensure_cert` 不存在/损坏/过期/SAN 无 IP 时生成自签名证书（CN/SAN=`transfer.local`，RSA-2048，有效期 7 天，SHA256，SAN 含本机全部 IP，`_cert_san`）；`_cert_p12_bytes` 打包 PKCS#12（密码 `CERT_P12_PASSWORD` 随机生成并在启动输出打印，仅 HTTPS 提供，小米等 Android 装 CA 必需）。
- **MCP 工具**：`drive_start/drive_pin/drive_status/drive_stop`（`_under` 做根目录包含校验）。

### 5.3 MSE 转码链路

- **会话模型**：`_trans_sessions` 全局字典，key=`(realpath, q, start_sec, persist)`；每个会话 = 一个常驻 ffmpeg 进程（`_trans_encode_thread`）从 `start_sec` 起**连续**输出 fragmented MP4 到内存缓冲，前端按 offset 顺序拉取拼接（保证 moof 序列号连续）。
- **四档画质** `_TRANS_KEYS`/`_TRANS_QUALITIES`：`original`（`-c copy` 快速 remux 不重编码，`_trans_remux_args`）/ `high`(1920) / `medium`(1280) / `low`(854)，转码参数为 `libx264 High 5.1 ultrafast/zerolatency + aac 128k + crf27 + keyint 60`（`_trans_args`）。
- **会话生命周期**：`_trans_ensure_session` 创建/复用；`persist=False`（MSE 播放与分享页）不落盘完整缓存；`_trans_consume` 按 offset 取数据带 5s 等待上限；`_trans_sweep_loop` 后台线程每 5s 按 `last_client` 空闲超时 30s 回收会话并杀进程。
- **编码器能力探测**：`_ffmpeg_capabilities` 惰性执行 `ffmpeg -encoders` 检查 libx264/aac，防止精简版 ffmpeg 静默失败。
- **MSE codec 契约**：`/api/vinfo` 的 `mseMime`（`_vinfo_mime`）——转码档固定 `avc1.640033`（High 5.1）+ 有条件 `mp4a.40.2`；原画档按源编码换算 `avc1.PPCCLL`（`_avc1_from_profile`）/ `hvc1`（`_hvc1_from_profile`）。
- **原画缓存下载**：`cache=1` 时按 Range 边播边写"稀疏文件 + 区间集合"（`original.cache` + `original.cache.json`），per-digest 锁串行化合并（`_stream_cached`）。
- **缓存容量治理**：`_cache_sweep_loop` 每 600s 执行 `_cache_sweep_once`，transcache 超 2GB 按 mtime 从旧到新删，跳过活动会话的 cfile 与 `.tmp` 文件。

### 5.4 meta=1 批量元数据（侧边栏数据源）

`api/list?meta=1` 为每个 entry 附加 meta 字段（`_augment_entries_meta`）：

- **目录** → `{"kind": "dir"}`
- **文件** → `{"kind": 分类, "mime": 类型}`，分类集合固定 video/audio/image/text/code/archive/exe/lnk/other（`_meta_kind`），按扩展名判定，文本/代码无需读内容
- **视频** → 额外附加 `duration`（秒）/`width`/`height`，以及内容性字段 `title/author/type/tags/notes`——全部取自 `_video_details_cache` 进程内缓存（`_video_meta_cached`），**零 IO、绝不运行 ffprobe**
- **未命中缓存的视频** → 进探测队列由 `_probe_video_meta` 后台并发探测：8 个 worker、单次总预算 3s（`_VIDEO_PROBE_WORKERS`/`_VIDEO_PROBE_BUDGET_SEC`）、多请求互斥锁，**到点立即返回，任何情况下不阻塞列表响应**；预算外未完成任务由 executor 后台线程继续，成功即写缓存，下次 meta=1 直接命中

### 5.5 字幕 / 识别 / 预览

- `_subtitle_vtt`：同目录旁挂字幕（`.srt/.vtt/.ass/.ssa`）优先，其次 ffmpeg 提取内嵌字幕流转 WebVTT；`_srt_to_vtt` / `_ass_to_vtt` 格式转换。
- `_asr_transcribe`：faster_whisper `small` 模型（CPU int8）单例复用 + per-path 锁 + 结果缓存 `<digest>.asr.<lang>.vtt`；语言 ja/en/zh。
- `_vthumbstrip_gen`：整段横向缩略图条（≤20 帧 tile）缓存 `<digest>.strip.jpg`；`_vframe_gen`：任意秒单帧预览缓存 `<digest>.f<秒>.jpg`。

### 5.6 后台线程（全部 daemon）

| 线程 | 启动处 | 周期 | 职责 |
|---|---|---|---|
| HTTPS/HTTP 服务 `serve_forever` | `_start` | 常驻 | 8443（单端口，首字节嗅探自动识别 TLS/明文） |
| `_trans_sweep_loop` | `_start` | 5s | 回收空闲转码会话 |
| `_cache_sweep_loop` | `_start` | 600s | 转码缓存磁盘治理 |
| 打包工人（每任务一个，daemon） | `_archive_new_task` → `_archive_worker` | 任务级 | 排队→扫描→压缩→ready，finally 释放信号量 |

## 6. 完整路由 / API 清单

### 6.1 主站路由（前缀 `/transfer/`，token 可变）

**token 前缀保护机制**（`do_GET`）：除 `/s/` 分享路由外，所有主站请求必须满足 `path == "/<token>"` 或以 `"/<token>/"` 开头，否则返回 403 `{"error":"无效 token"}`。**访问 `/transfer`（无尾部斜杠）会 301 重定向到 `/transfer/`**——否则页面内相对路径 `static/...` 会被浏览器解析成 `/static/...`（丢失 token 前缀）导致 403。`do_POST` 同理要求 `/<token>/` 前缀。

| 方法 | 路径 | 参数 | 返回 / 说明 |
|---|---|---|---|
| GET | `/` | - | 主页面 index.html |
| GET | `/view` | `path` | 独立预览页（T18 方案B：沉浸式新页面，`view.html` 模板 + `#__shadow` 占位 DOM） |
| GET | `/static/<name>` | - | 离线静态资源（白名单，见第 10 节） |
| GET | `/api/info` | - | `{roots, pinned, archive_format, urls, urls_http}`：`urls`/`urls_http` 为本机全部可访问地址数组（http 免证书版用于局域网/本机直连，元素形如 `http://<ip>:<port>/<token>/`；不含回环 127.0.0.1 的地址也可供直连下载选址，见第 7.4 节；`_urls` / `_urls_http`） |
| GET | `/api/list` | `path`、`meta=1`、`show_hidden=1` | 目录列表 `{path, parent, entries[]}`；`meta=1` 给每个 entry 附加 `meta`（kind/mime、视频 duration/width/height + title/author/type/tags/notes，见第 5.4 节）；隐藏文件默认过滤，`show_hidden=1` 展示全部（T37）；无权限 403 + parent 供"返回上级" |
| GET | `/api/pin` | `path`、`add=1\|0`、`clear=1` | 收藏/取消收藏/一键清空（`clear=1` 免 path 原地清 list），返回最新 pinned 列表 |
| GET | `/api/stat` | `path` | 文件/目录详情（含 preview 类型、视频 details、locked） |
| GET | `/api/vmeta` | `path` | 视频结构化元数据（`{ok, meta}`，非视频 meta=null 不报错） |
| GET | `/api/lnk` | `path` | PowerShell COM 解析 .lnk 目标（`{ok,target,is_dir,exists,...}`） |
| GET | `/api/thumb` | `path` | 视频缩略图 jpg（ffmpeg 抽帧，缓存 thumbs/，max-age=86400） |
| GET | `/api/pdf` | `path` | PDF 内联预览（ctype 强制 application/pdf，Range 流） |
| GET | `/api/img` | `path` | 图片内联预览（ctype 按扩展名取 MIME，浏览器内联渲染 `<img>`，Range 流） |
| GET | `/api/share` | `path`+`hours` 或 `paths`(竖线分隔)+`hours` | 创建分享（有效期须 ∈ {1,24,72,168} 小时，最长 7 天）；多文件 → 虚拟分享 |
| GET | `/api/stream` | `path`、`cache=1` | 视频 Range 流；cache=1 边播边写原画缓存 |
| GET | `/api/trans` | `path`、`q`、`offset`、`need`、`start` | MSE 转码分片（fMP4 字节流 + `X-Trans-Finished`/`X-Trans-Offset` 头） |
| GET | `/api/transstatus` | `path`、`q` | `{available, ready, progress?, total?}` |
| GET | `/api/transdl` | `path`、`q` | 转码档完整下载；未转完 409 + 进度（前端轮询） |
| GET | `/api/subtitle` | `path` | 字幕 WebVTT（旁挂/内嵌） |
| GET | `/api/asr` | `path`、`lang`(ja/en/zh) | faster_whisper 语音识别字幕；未装引擎 501 |
| GET | `/api/vthumbstrip` | `path` | 横向缩略图条 jpg（`X-Strip-N`/`X-Strip-Duration` 头） |
| GET | `/api/vframes` | `path`、`t` | t 秒单帧预览 jpg |
| GET | `/api/vinfo` | `path`、`q` | `{duration,width,height,rotation,mseMime,originalMime}`（MSE codec 契约） |
| GET | `/api/cert` | - | 下载自签名证书 drive-mcp.crt（application/x-x509-ca-cert） |
| GET | `/api/certp12` | - | 下载含私钥 PKCS#12（drive-mcp.p12，**仅 HTTPS 提供**，HTTP 明文 403；密码随机生成并打印在启动输出，Android 用） |
| GET | `/api/read` | `path`、`limit`(16KB~4MB) | 文本预览（BOM→utf-8→gbk→latin-1 逐级解码，kind=text/markdown/csv） |
| GET | `/api/unpack` | `path`、`dir` | 压缩包条目列表（`dir` 指定包内目录前缀，缺省根层）；支持 zip/tar/tgz/tar.gz/tar.bz2 与 rar/7z（后者需系统已装 7-Zip 或 WinRAR，未探测到返回 unsupported） |
| GET | `/api/unpackdir` | `path`、`dir` | 压缩包内指定目录的子条目（层级浏览入口；与 `api/unpack` 同源 `_unpack_list`） |
| GET | `/api/unpackdl` | `archive`、`entry` | 下载压缩包内单个条目 |
| GET | `/dl` | `path` | 通用下载（Range 断点续传，attachment） |
| GET | `/dlzip` | `paths`(竖线分隔)、`mode=store\|fast\|normal` | 多文件/目录**同步**打包下载 zip（`X-Archive-Format: zip`、失败跳过清单 `X-Archive-Skipped` 头；`_stream_archive`） |
| GET | `/api/archives` | - | 打包中心任务列表（轻量快照 `{tasks:[...]}`；惰性执行 TTL 清理与上限逐出，`_archive_poll_cleanup`） |
| GET | `/api/archive` | `id` | 单任务详情（含完整 `skipped` 跳过清单）；不存在 404 |
| GET | `/api/archive/dl` | `id` | 原生下载已就绪的 zip：仅 `ready/done` 放行，其它 409 `{"error":"压缩尚未完成"}`；流完成置 `done`，断连回滚 `ready` 可再下载（`_archive_dl`） |
| GET | `/api/archive/preview` | `paths`(竖线分隔) | 打包预览统计：文件行 `{name,is_dir,size}`、目录行 `{name,is_dir,size:null,child_count,child_bytes}`（权限失败 `child_count=-1`）；全部走 `_resolve` 越界校验 |
| POST | `/api/archive` | body JSON `{paths:[...], mode}` | 创建后台打包任务：`mode` 非法回退 normal；排队上限（`_ARCHIVE_QUEUE_MAX`）达到 → 429 `{queue_full:true,"error":"打包任务过多，请稍后再试"}`；成功返回 `{task_id}` |
| POST | `/api/archive/cancel` | `id` | 取消/删除任务：活任务（queued/scanning/compressing/downloading）置取消事件收敛 `aborted`；终态立即删任务+临时文件；不存在 404 |
| POST | `/api/upload` | `path` + multipart/form-data | 上传文件到当前目录（cgi.FieldStorage，中文文件名 latin-1→utf-8 修正） |

### 6.2 分享路由（前缀 `/s/<share_token>/`，与主 token 完全隔离）

入口 `_handle_share`：分享 token 不经主 token 校验、不暴露主 token；分享页复用同一份 index.html + app.js（app.js 靠 `location.pathname` 以 `/s/` 开头识别分享模式）；所有子请求统一走 `_resolve_share_path` 越界校验。

| 子路径 | 说明 |
|---|---|
| `""`（空） | 分享页 = 主站模板；不存在 404 纯文本；**过期返回 200 过期提示页**（不在此删除以便稳定重复访问） |
| `api/info` | 分享信息（root/name/is_dir/expires_at/multi/virtual/files 白名单清单） |
| `api/list` | 目录列表，**支持 `meta=1`**；虚拟分享按虚拟相对路径导航；多文件分享只展示 files 白名单一层；**单文件分享返回单个条目**（防 scandir 抛错） |
| `api/stat` / `api/vmeta` / `api/lnk` / `api/thumb` / `api/pdf` / `api/read` / `api/unpack` / `api/unpackdir` / `api/unpackdl` | 与主站同语义（分享根内校验） |
| `api/stream` / `api/trans` / `api/transstatus` / `api/transdl` / `api/subtitle` / `api/asr` / `api/vthumbstrip` / `api/vframes` / `api/vinfo` | 复用 `_handle_trans_api`，但 **persist=False 不落盘转码缓存** |
| `api/sharesub` | 二次分享：`parent` 链继承父分享过期时间（父过期则子视为过期，`_share_expired`） |
| `dl` / `dlzip` | 分享内下载/打包（虚拟分享把 (虚拟相对路径, 真实路径) 直接交给统一打包核心 `_stream_archive`；支持 `mode=store|fast|normal`） |
| `static/*` | 复用主站静态白名单 |
| `api/pin` / `api/upload` / `api/cert` / `api/certp12` / `api/share` | **分享模式禁用，返回 403** |

过期分享其余 API 返回 410 `{"error":"链接已过期"}`；创建新分享时顺带清理过期 token。

### 6.3 MCP 协议层（mcp_stdio.py）

- JSON-RPC 2.0 行协议（stdin 读请求 / stdout 写响应，**日志走 stderr**）；UTF-8 强制（`reconfigure`，解决 Windows GBK 管道问题）。
- 支持方法：`initialize`（协议版本协商，支持 2025-06-18/2025-03-26/2024-11-05）、`notifications/initialized`、`ping`、`tools/list`、`tools/call`；不支持批量请求；响应 `isError=true` 时把错误作为文本内容返回给模型（`ToolError`）。

## 7. 前端功能清单（index.html + app.js）

入口 `init()`：分享模式隐藏主站 UI（磁盘/收藏/打包/上传，`hideMainUi`）只读浏览分享根；主站模式加载磁盘/收藏并**从 localStorage 恢复上次目录与视图**，并在非分享模式注册打包中心轮询（页面隐藏自动暂停）。

| 功能 | 说明 | 位置 |
|---|---|---|
| 磁盘标签页 | 顶部横向滚动胶囊按钮，点击切换磁盘根 | `renderDriveTabs` |
| 面包屑 + 后退/前进 | 分段导航；栈式前进后退（`_pushNav`，按钮状态联动） | `renderBreadcrumb` |
| 列表/网格视图 | 网格视图视频显示 ffmpeg 缩略图封面（失败回退图标）；视图偏好持久化 | `listItem` / `gridItem` |
| 收藏（原置顶） | T16 起「置顶」改名为「收藏」，常驻星标/置顶折叠条均已移除（t9/t16）：收藏入口 = 文件详情/操作面板「收藏」按钮 + **长按多选批量收藏**（`enterBulkMode` + `api/pin?add=1`）；右下角悬浮球 `#pinFab`（数量徽标，键盘可达）+ 收藏面板 `#pinPanel`（`renderPinned` / `openPinPanel`）：面板行内 分享/下载/取消收藏，底部「全部分享」（`showShareManyDialog`）、「📦 打包」（`pinPackBtn` → 打开打包中心）、「全部清空」（`pinClearBtn` → `api/pin?clear=1`），Esc 关闭；**仅存内存，重启即失** | `renderPinned`、`openPinPanel`/`togglePinPanel` |
| 打包中心面板 | 右下角悬浮面板（HTML `#packPanel`，CSS `.pack-panel`）：任务列表每 1s 轮询重建（`pollArchives`，`document.hidden` 暂停、回前台立即刷新）；任务卡含状态机文案/阶段性进度条（排队/扫描为轨道条纹动画，压缩中显示「当前文件」与文件比兜底，就绪显示 zip 大小）/跳过清单展开（`renderTask`）、✕ 删除（活任务先本地置取消态再 POST，`removeTask`）、ready/done 显示「⬇ 下载」**原生下载**（`location.href = /api/archive/dl?id=`，无 Blob）；提交区：压缩级别单选 + 收藏项预览树（目录 ▶ 拉 `child_count/child_bytes` 行内统计，不递归，`createPackPreview`；无收藏时引导「还没有收藏文件，先长按选择文件后收藏」）+「＋ 提交打包」（`submitPack`）；面板头：任务完成 `x/y` 芯片（失败/取消计数）+ 活动摘要（打包中/下载中/待下载/扫描排队，窄屏隐藏）+ 总进度条（任务加权：done=1、其余非终态 ≤0.99，**100% ⟺ 全部完成**，`updateTotal`）；迷你条仅「有活动任务且面板关闭」时显示；迷你条/面板互斥（头部点击折叠露头） | 见第 7.4 节 |
| 上传 | 多文件顺序上传 + 进度条；分享模式无此按钮 | `uploadBtn`/`fileInput` |
| 下载 | 非预览类型直接跳 `/dl`；统一 `dlUrl()` | `bindRowAction` |
| 视频播放器 | 画质选择（原画/高清/标清/低清）、**MSE 免证书模式**、缓存下载开关、字幕（track/overlay）、ASR 识别（语言切换）、进度条悬停预览（缩略图条 + 单帧 80ms 防抖）、视频详情面板（标题/作者/类型/统计/标签/技术徽章）、原画→高清自动降级 | `showVideo` |
| 文本/Markdown 预览 | 内置 Markdown 渲染器（转义后套格式防 XSS，`renderMarkdown`）；代码高亮（≤200KB 用 hljs，超大分片渲染）；大文本分片渲染 + 取消；400KB 截断提示 | `showText` |
| CSV 预览 | 简易引号感知解析器；前 300KB / 2000 行上限 | `showCsv` |
| PDF 预览 | iframe 内联 + 新窗口兜底链接 | `showPdf` |
| 压缩包解压预览 | 条目列表（≤5000 条，含层级目录浏览），点击条目直接下载 | `showUnpack` |
| .lnk 快捷方式 | 显示目标、进入目标目录/下载原文件（越界时"返回上级"靠 navStack 回退链兜底） | `showLnk` |
| 分享链接 | 单文件/目录（`showShareDialog`）、全部收藏（`showShareManyDialog`）、分享页内二次分享（`showSubShareDialog`）；有效期 1/24/72/168 小时；复制/打开链接 | |
| 状态恢复 | localStorage `drive.cur/drive.root/drive.view/drive.modal`；弹窗加入浏览器历史（手机返回键关弹窗不退出）；分享模式不读写主站键 | `saveDriveState` |
| 错误处理 | 无权限目录显示"返回上级"按钮；token 校验失败 403 JSON 提示；虚拟分享根为空串时靠 navStack/activeRoot 兜底 | `showAlert` |

### 7.1 侧边栏（视图与筛选）

右侧滑出面板（HTML `#sidebar`，CSS `.sidebar`），打开/关闭 `openSidebar`/`closeSidebar`，关闭不改变筛选状态。列表加载统一带 `meta=1`（`loadList`），侧边栏所有操作**基于 `currentEntries` 前端过滤重渲染，不重新请求**。

| 区块 | 说明 | 位置 |
|---|---|---|
| 搜索 | 输入即过滤，**150ms 防抖**；先 `normalizeCJK` 简繁归一化再小写（`normSearch`） | `#sidebar` 搜索框 |
| 深度查找开关 | 关闭：仅匹配文件名；开启：文件名 + 元数据内容白名单字段（`META_CONTENT_KEYS`，仅 title/author/type/tags/notes/extra 等真实内容，**排除** kind/mime/duration/upload/views/likes/tech 等技术统计字段）；`entrySearchText` | `#sidebar` 开关 + `loadList` |
| 推荐标签 | CJK bigram 分词 + tags 完整标签 + 内联 856 词停用词表（`STOPWORDS`）+ 扩展名/版本号/日期噪声过滤（`isTagNoiseWord`）；按**出现文件数**计分（每文件最多计 1，`extractKeywords`）；异步分批（20 个/批）增量统计、随进度动态渐出 Top10（`startTagScan`、`tagScanStep`）；**per-path 缓存**（`_tagCache`），目录切换自动失效重扫（`loadList`），↻ 按钮手动强刷；点击标签 → 追加搜索框 + **自动开启深度查找**（标签可能只存在于元数据，`tagApplyTag`） | `#sidebar` 标签区 |
| 视图切换 | 列表/网格 radio 式按钮组，localStorage 持久化 | `#sidebar` 视图按钮组 |
| 类型筛选（多选） | 视频/文本/编程/软件包/压缩包/快捷方式/目录 + 自输入后缀（逗号分隔，如 `md,txt,json`）；类型判定基于 meta.kind（`entryKindMatch`），硬筛选含后缀 OR 逻辑（`applyHardFilters`） | `#sidebar` 类型区 |
| 排序 | 修改时间/名称（本地化 zh-Hans-CN）/大小，**双向切换**：再次点击当前排序项即反转方向（原生 select 重复选择不触发 change，用 **mousedown+click 协作**手动反转）；默认方向 mtime 新→旧 / name 升序 / size 大→小（`DEFAULT_SORT_DIR`）；目录永远排前（`entryCompare`）；option 文本随方向动态更新（`updateSortLabel`） | `#sidebar` 排序区 |
| 重置 | 一键清空筛选/搜索/恢复默认排序 | `#sidebar` 重置按钮 |

### 7.2 搜索关键词语法（parseQuery）

查询统一由 `parseQuery` 解析为 `[{and:[...]},...]` 组结构，精确与模糊两阶段共用：

- **AND（且）**：空格 与 `&`——组内所有词必须全部命中
- **OR（或）**：`,` `，` `|` `/`——任一组命中即匹配
- 支持组合查询，如 `日常 里番|合集` = （"日常" 且 "里番"）或 （"日常" 且 "合集"）
- 空词自动过滤；连续/混合分隔符取并集效果

精确阶段（`filterEntries`）对归一化后的可搜索文本做子串匹配；模糊阶段（`fuzzyMatchTexts`）对同一组结构做概率判定。

### 7.3 模糊匹配（概率模型 + 两阶段渲染）

**概率匹配模型**（纯函数可单测）：

| 分量 | 算法 | 覆盖场景 |
|---|---|---|
| 精确子串 | `target.includes(kw)` | 得分恒为 1.0 |
| `s_lcs` | LCS(kw,target)/len(kw)（DP 滚动数组） | 隔开（子序列）、缺字（target 是 kw 子序列） |
| `s_edit` | 1 − 滑窗 Damerau-Levenshtein/len(kw)（窗口宽 len+2，滑动取全串最小） | 错字、相邻转位 |
| `s_multi` | 字符多集覆盖率（kw 各字符在 target 中可被消耗的次数/len） | 乱序上限约束（预筛 0.6、硬约束 0.8） |
| `s_perm` | 0.6·s_multi + 0.4·max(s_lcs, s_edit) | 乱序加权 |

判定 `final = max(s_lcs, s_edit, s_perm) ≥ 0.8` 且多集覆盖率 ≥ 0.8（`fuzzyMatchKw`），阶段短路：预筛 → 字符硬约束 → LCS 达标 → 滑窗编辑达标 → 乱序加权。

**两阶段渲染**（`renderEntries`）：

1. **阶段一（同步）**：硬筛选（类型/后缀）+ 精确子串过滤 → 排序 → 全量渲染，输入后立即出结果；
2. **阶段二（异步渐进）**：未命中文件进模糊队列，每批 30 个（`FUZZY_BATCH`）分片处理（批间 setTimeout(0) 让出主线程），命中即以 `entryCompare` 二分查找插入正确排序位置（`insertIntoSortedDom`）；顶部 `fuzzyHint` 显示进度"正在模糊匹配… x/y"；新输入/重渲染递增令牌使旧任务**可打断**。

**页面细节**：`index.html` 头部用 `<link rel="icon" href="data:,">` 消除 favicon 请求（避免 403 干扰）；品牌色覆盖 Bootstrap primary 为内联 CSS 变量层 `--brand-*`（主色 `#2563eb`）；手机端触控目标 ≥44px；侧边栏宽度 `min(320px, 86vw)`。

### 7.4 打包中心（后台任务）

网页打包从"同步请求等 zip 落盘"改为**后台任务**：`POST /api/archive` 创建任务后立刻返回，工人线程（daemon，`_archive_worker`）在后台排队/扫描/压缩，前端轮询进度、完成后原生下载。**打包期间所有按钮不 disabled，不遮罩不锁滚动，观众可继续浏览**。

- **任务状态机**：`queued→scanning→compressing→ready→downloading→done`；任意非终态可 `cancel→aborted`（置 `cancel_evt`，`_write_entry_chunked` 每块前检查并抛 `_ArchiveAborted` 收敛）；压缩异常→`failed`（error 文案进任务卡）；下载中断（前端断连）→ 回滚 `ready` 可再下载。任务表 `_ARCHIVE_TASKS`（全局 dict + RLock），字段含 `total_bytes/done_bytes/current_file/file_done/file_total/skipped/dl_total_bytes/bytes_sent/cancel_evt/lock`。
- **并发排队**：`_ARCHIVE_QUEUE_MAX=6`（queued+scanning+compressing 计数，超限 429 `queue_full`）；信号量 `_ARCHIVE_SEM`（2，与同步 `/dlzip` 共享）即排队，worker `finally` 必 release；`_ARCHIVE_TASK_CAP=16` 任务表上限 + 30min TTL 惰性逐出（`_archive_poll_cleanup`，在 `/api/archives` 与创建时执行，无后台守线程）。
- **临时文件**：任务 zip 统一 `tempfile.gettempdir()/tk_<task_id>.zip`（可预测名字）；worker 压缩期先 mkstemp+unlink 让 ZipFile 自建、完成后 `rename` 到固定名；`_start` 启动清扫 `_archive_sweep_tmp` glob 精确匹配删除崩溃残留。
- **分块进度**：`_write_entry_chunked` 按 1MB 块（`_ARCHIVE_CHUNK`）写 zip，推进度/当前文件/取消检查；`force_zip64` 决策与 `zf.write` 一致（>2GB 文件才启用），**实测同一目录同步 `/dlzip`（zf.write）与任务（分块写）产出 zip md5 完全一致**。
- **原生下载**：`GET /api/archive/dl?id=`（`_archive_dl`）Content-Length + `Content-Disposition: attachment; filename*=UTF-8''打包下载_<ts>.zip`，前端 `location.href` 直链（无 Blob 不占内存）；每 4MB 更新 `bytes_sent` 供下载进度。
- **大包直连**：`dl_total_bytes ≥ 200MB`（`DIRECT_DL_THRESHOLD`）的任务卡在「⬇ 下载」旁提示「⚠️ 经域名下载大包可能触发网关超时，建议直连」并给出「📋 复制直连下载链接」（`copyDirectDl`）——把任务 id 拼到直连地址 `<scheme>://<ip>:<port>/<token>/api/archive/dl?id=<task_id>` 上。直连地址来自 `/api/info` 的 `urls`/`urls_http`，前端选址规则（`pickDirectBase`）：**优先局域网可达**（私网 IPv4 10/8、172.16/12、192.168/16，或 ULA IPv6 fd/fc 开头），其次任意**非回环非链路本地**地址（公网 IPv6），排除 127.0.0.1/::1（手机/另一台设备上不可用）；旧后端无 `urls` 字段或列表为空时自动隐藏该区块（判空容错）。复制走 `navigator.clipboard`，自签名证书（非 secure context）下自动退化为 `execCommand('copy')`。
- **收藏悬浮球/面板**：原「置顶折叠条」已移除（t16），改为右下角悬浮球 `#pinFab`（数量徽标）+ 收藏面板 `#pinPanel`；面板由 `togglePinPanel` 开合、Esc 关闭，与目录切换无关（不自动收起）。
- **收藏一键清空**：收藏面板内「全部清空」（仅收藏非空时显示）→ `GET /api/pin?clear=1`（免 path，`do_GET` 的 `/api/pin` 分支先于 resolve 原地清 list），前端同步 `pinned` 并刷新列表与打包预览树（`pinClearBtn`）。
- **预览统计**：`/api/archive/preview` 对目录返回 `child_count/child_bytes`（首层文件大小和），权限失败 `child_count=-1`；面板内"▶"点击拉取行内展示，不递归。
- **总进度与面板头**（`updateTotal`）：总进度按**任务加权**而非字节求和——`done=1`，`ready/downloading/failed/aborted` 各 `0.99`，`compressing` 为 `0.99×字节比`（cap），`queued/scanning` 为 `0`，故 **总进度 100% ⟺ 全部任务完成**，其余时刻最多 99%；面板头为「任务完成 `x/y`」（失败/取消追加计数）+ 活动摘要（打包中 N / 下载中 N / 待下载 N / 扫描排队 N）+ 总进度条，无任务时整块隐藏。
- **迷你条**（`packMiniBar`）：仅当**存在活动任务**（queued/scanning/compressing/ready/downloading）**且面板关闭**时显示，文案「📦 N% · 完成 x/y」；打开面板即隐藏，关闭面板由 1s 轮询自动恢复接管。
- **任务卡进度**（`taskStateUI`）：打包中 `pct=min(99, 字节比)`，字节比 0 时兜底 `min(99, 100×file_done/file_total)`（file_total>0 才行），card 显示「当前文件」；就绪态副文案「zip 大小 X」；排队/扫描为不确定态轨道条纹动画（CSS `.pk-idle-track`）。

## 8. 数据与状态

| 数据 | 位置 | 格式 / 说明 |
|---|---|---|
| 自签名证书 | `~/.transfer-mcp/server.crt` + `server.key` | PEM，RSA-2048，7 天有效期，CN/SAN=`transfer.local`、SAN 含本机全部 IP；缺失/损坏/过期/SAN 无 IP 时自动重建（`_ensure_cert`/`_cert_san`） |
| 分享记录 | `~/.transfer-mcp/shares.json` | `{token: {root, is_dir, expires_at, created_at, name, [files, virtual, nodes, parent]}}`；写临时文件再 rename 防损坏（`_save_shares`）；**模块加载即恢复**（跨进程重启链接仍有效） |
| 转码/原画缓存 | `~/.transfer-mcp/transcache/<sha256(realpath)>/` | 转码档 `<digest>.<q>.mp4`、原画稀疏缓存 `original.cache`(+`.json`)、缩略图条 `strip.jpg`、单帧 `f<秒>.jpg`、ASR `<digest>.asr.<lang>.vtt`；总容量上限 2GB 按 mtime 清理（`TRANSCACHE_DIR`/`TRANSCACHE_MAX_BYTES`） |
| 视频缩略图 | `static/thumbs/<md5(realpath\|size\|mtime)>.jpg` | ffmpeg 抽帧，文件变化自动失效，已在 .gitignore 排除（`_thumb_path`） |
| 视频元数据缓存 | 进程内存 `_video_details_cache` | key=(realpath,size,mtime)，ffprobe 失败也缓存 None；meta=1 的深度查找/推荐标签均只读此缓存 |
| 收藏列表 pinned | 仅内存（`_DriveServer.pinned` / `_state["pinned"]`） | **重启即丢失**；由 MCP `drive_pin` 或网页「收藏」维护（T16 起前端文案统一为收藏） |
| 打包任务表 | 进程内存 `_ARCHIVE_TASKS` | task_id 为键，含状态机字段；30min TTL + 上限 16 惰性逐出；临时 zip 在系统临时目录 `tk_<task_id>.zip`（**重启即清**，启动清扫） |
| 推荐标签缓存 | 前端内存 `_tagCache`（Map: path → scores） | per-path 缓存避免重复扫描；目录切换自动失效重扫 |
| 前端状态 | 浏览器 localStorage | `drive.*` 键，见第 7 节 |

## 9. 配置与常量

| 常量 | 值 | 位置 |
|---|---|---|
| `VERSION` | "3.0.0" | `server.py` 常量区 |
| `DEFAULT_PORT` | 8443（HTTPS 与 HTTP 明文同端口，首字节嗅探自动识别） | `server.py` 常量区 |
| `CERT_DIR` / 证书/私钥 | `~/.transfer-mcp/` / server.crt / server.key | `server.py` 常量区 |
| `FFPROBE` / `FFMPEG` | `C:\Users\user\ffmpeg\bin\ffprobe.exe` / 同目录 ffmpeg.exe | `server.py` 常量区 |
| `TRANSCACHE_DIR` | `~/.transfer-mcp/transcache` | `server.py` 常量区 |
| `TRANS_IDLE_TIMEOUT` | 30s（转码会话空闲回收） | `server.py` 常量区 |
| `TRANS_WAIT_SEC` | 5s（trans 拉取等待上限） | `server.py` 常量区 |
| `TRANS_CHUNK` | 512KB（前端单次期望分片） | `server.py` 常量区 |
| `TRANSCACHE_MAX_BYTES` | 2GB（缓存清理阈值） | `server.py` 常量区 |
| `_CACHE_SWEEP_INTERVAL` | 600s（缓存治理周期） | `server.py` 常量区 |
| 画质目标宽度 | high=1920 / medium=1280 / low=854 | `_TRANS_QUALITIES` |
| `_VIDEO_PROBE_WORKERS` / `_VIDEO_PROBE_BUDGET_SEC` | 8 / 3.0（meta=1 视频探测并发上限与总预算） | `server.py` 常量区 |
| 分享有效期选项 | 1 / 24 / 72 / 168 小时 | 分享创建分支 |
| 证书有效期 | 7 天（前后 5 分钟缓冲） | `_ensure_cert` |
| `CERT_P12_PASSWORD` | 启动时 `secrets.token_urlsafe(8)` 随机生成（打印在启动输出） | `server.py` 常量区 |
| 静态资源白名单 | bootstrap.min.css / bootstrap.bundle.min.js / app.js / highlight.min.js / highlight.min.css / **cjk-normalize.js** + icons/*.svg | `server.py` 的 `_STATIC_ALLOWED` |
| 文本预览默认/上限 | 默认 1MB，钳制 16KB~4MB | `_read_text`/`_parse_read_limit` |
| 转码输出 | H.264 High 5.1 (avc1.640033) + aac 128k，crf 27，keyint 60，fMP4 | `_trans_args` |
| 防火墙规则名 | `TransferMCP-<port>` | `_add_firewall_rule` |
| `_ARCHIVE_QUEUE_MAX` / `_ARCHIVE_TASK_CAP` / `_ARCHIVE_CHUNK` / `_ARCHIVE_TASK_TTL` | 6 / 16 / 1MB / 30min（打包中心排队上限、任务表上限、分块写块大小、任务 TTL） | `server.py` 打包常量区 |
| MCP 首选协议 | 2025-06-18 | `mcp_stdio.py` |
| 搜索防抖 | 150ms | `app.js` 搜索输入处理 |
| `FUZZY_SCORE_MIN` / `FUZZY_MULTI_MIN` / `FUZZY_PRESCREEN` | 0.8 / 0.8 / 0.6（模糊判定阈值/字符硬约束/预筛） | `app.js` 模糊模块常量 |
| `FUZZY_TARGET_MAX` | 200（超长文本截断，限制 O(n·m) 计算量） | `app.js` 模糊模块常量 |
| `FUZZY_PERM_WMIX` | 0.6（乱序加权中 s_multi 的权重） | `app.js` 模糊模块常量 |
| `FUZZY_BATCH` | 30（模糊分片每批文件数） | `app.js` 模糊模块常量 |
| `TAG_BATCH` / `TAG_TOP_N` / `TAG_MIN_LEN` / `TAG_MAX_LEN` | 20 / 10 / 2 / 20（推荐标签分批数/TopN/词长下限/上限） | `app.js` 推荐标签常量 |
| `META_CONTENT_KEYS` | title/author/type/tags/notes/extra/track/album/artist/genre/comment/description/captions/lyrics（深度查找白名单） | `app.js` 搜索模块常量 |
| 停用词表 | 内联 856 词 `STOPWORDS`（来源 goto456/stopwords cn_stopwords.txt + 基础英文停用词 + 常见扩展名） | `app.js` 头部 |

## 10. 已知限制与注意事项

- **token 前缀保护**：所有主站 API 必须带 `/transfer/` 前缀（`do_GET`），否则 403；`/transfer` 无斜杠会 301 到 `/transfer/`。分享路由 `/s/` 独立于主 token，二者互不暴露。
- **路径越界校验**：`_resolve` 用 `realpath + commonpath` 保证请求路径必在 roots 内（防符号链接逃逸）；分享用 `_resolve_share_path`，多文件分享是**白名单精确匹配**而非前缀匹配——父目录路径访问未分享文件会被拒绝。
- **静态资源白名单**：`_send_static` 只允许顶层 6 个指定文件（含 cjk-normalize.js）与 `icons/*.svg`，basename + 无斜杠双重校验，杜绝路径穿越。
- **`cgi` 模块弃用警告**：`server.py` 导入 `cgi`（Python 3.13 起弃用，3.15 移除改为报错），上传用 `cgi.FieldStorage` 解析 multipart；后续需替换为手写 multipart 解析。
- **HTTP 明文（同上端口 8443）**：仅用于手机打不开自签名证书页面时的局域网兜底，明文传输，仅限可信网络（启动提示已注明）；服务端靠首字节嗅探区分 TLS/明文，`http://` 与 `https://` 均可访问同一端口。
- **只读为主 + 上传**：服务不能删除/修改服务器端已有文件，只能上传到当前目录；分享模式连上传也禁用。
- **权限受限目录**：无权限目录返回 403 且前端提示"返回上级"；浏览受系统保护目录需以管理员身份运行。
- **firewall 规则**：添加入站规则需要管理员权限，失败时启动输出会给出手工执行命令（`_add_firewall_rule`/`_remove_firewall_rule`）。
- **pinned 不持久化**：收藏列表只存内存，服务进程重启即清空。
- **转码依赖**：MSE 转码/字幕提取/缩略图条/单帧都需要完整版 ffmpeg（含 libx264/aac，`_ffmpeg_capabilities` 会明确报缺哪些编码器）；ffprobe 缺失时视频元数据静默降级。
- **转码缓存占用**：MSE 播放默认只在内存缓冲（不落盘），但主站 start=0 的持久会话与"缓存下载"会写 transcache（上限 2GB 自动清理）；分享页播放**永不落盘**，避免占用分享者磁盘。
- **favicon**：`index.html` 用 `<link rel="icon" href="data:,">` 消除 favicon 请求，避免其落进 token 前缀外产生 403 噪音。
- **Windows 编码**：MCP stdio 强制 UTF-8（`mcp_stdio.py`）；前端上传中文文件名做 latin-1→utf-8 修正。
- **大文件预览**：`/api/read` 默认只读前 1MB（前端再截断 400KB 渲染、CSV 300KB/2000 行、压缩包列表 5000 条），完整内容需下载。
- **深度查找 / 推荐标签依赖视频元数据探测**：元数据源于 ffprobe 的 tag/comment（`_parse_comment_meta`），只有视频文件且已被探测进缓存才有内容字段；meta=1 探测受 3s 预算限制，**超大目录首次浏览时部分视频可能暂无元数据**（深度查找/标签推荐会漏），重新打开目录（缓存已填充）即可补全。
- **模糊匹配的边界**：仅对硬筛选后的未命中文件做概率匹配，超长文本截断到 200 字符（`FUZZY_TARGET_MAX`）；错字/转位容忍约 1-2 字（滑窗宽 len+2）；**3 字以上完全乱序不匹配**（乱序加权 0.6/0.4 + 0.8 阈值的设计边界）；预筛阈值 0.6 意味着字符多集覆盖率不足的直接跳过。
- **关键词语法注意**：`/` 与 `，,|` 都是 **OR 分隔符**——搜索串含 `/` 时会被拆成多组"或"查询（如 `a/b` 视为 `a OR b`）；点击推荐标签时若标签本身含 `/`、`,` 等字符也会按语法解释（预期行为，不做转义）。
- **虚拟分享路径含 `/`**：虚拟分享的目录导航用 `/` 分隔虚拟路径，其文件名本身不含 `/`，但搜索框直接输入虚拟路径片段时需注意 `/` 会被当作 OR 分隔符。
- **单实例约束**：`_DriveServer.allow_reuse_address = False` + 启动脚本的"按端口强杀残留 → 等待端口释放 → 再启动"流程，杜绝"新旧实例共同监听一个端口、请求随机分发"的问题；脚本对**外来程序占用**只提示不误杀。CLI 模式下另有"bind 失败自动重试 3 次"与"僵尸监听看门狗（自探失败自动退出重跑）"兜底。
- **本地/局域网访问被代理拦 502**：症状——浏览器访问 `http://localhost:8443`（或 127.0.0.1）返回 **502 Bad Gateway**，但命令行 `Invoke-WebRequest`/curl 直连完全正常、netstat 显示服务正常监听。根因——本机装有 mihomo/Clash 类代理软件且系统代理/浏览器代理开启时，浏览器把 localhost 与 127.0.0.1 请求也交给本地代理 127.0.0.1:7890，代理对"非代理网络目标（本机/局域网）"直接回 502（实测 localhost 与 127.0.0.1 都会被拦，**不是服务端问题**）。解决（任选其一）：
  - 在代理软件的**绕行/直连规则**中加入 `localhost`、`127.0.0.1` 与局域网段（如 `192.168.*`、`10.*`，mihomo 可在配置中对该目标走 DIRECT）；
  - Edge 等浏览器"系统代理"关闭，或浏览器代理插件将本机地址加入 bypass 列表；
  - 直接关闭系统代理（`设置 → 网络和 Internet → 代理`）；
  - 服务端 CLI 启动时若检测到系统代理开启，会自动在 stderr 打印同类提示（`_system_proxy_hint`）。
- **Cloudflare 代理下载大包 524**：症状——打包完成后在浏览器点「下载」走 `transfer.wangxin2003.site` 域名，大 zip 下载中途出现 **524 error** 页面；命令行/局域网直连却正常。根因——域名走了 Cloudflare 代理，CF 与源站之间的连接 **100 秒超时**（524 即"连接源站超时"），大包流式发送在 100s 内发不完必然触发。解决：
  - 用**直连地址**下载：打包中心对 `dl_total_bytes ≥ 200MB` 的任务自动显示「⚠️ 经域名下载大包可能触发网关超时，建议直连」+「📋 复制直连下载链接」按钮（地址取 `/api/info` 的 `urls`/`urls_http`，优先局域网 IPv4，见第 7.4 节），把链接粘到浏览器即可绕过 CF 直连源站；
  - 或在 Cloudflare 面板把该域名的代理模式（橙色云）改为 **DNS-only（灰色云）**，流量不再经过 CF，也就没有 100s 限制；
  - 若直连地址对手机不可达（如公网 IPv6 不通），请用同一局域网（Wi-Fi）设备测试，或靠端口转发/内网穿透直连源站。
- **缓存控制头策略**（防夸克等激进缓存浏览器长期展示旧版页面/旧 app.js）：
  - 动态内容一律 `Cache-Control: no-store`，绝不缓存：主/分享页 HTML（`_send_html`）、全部 JSON API（`_send_json`）、错误页、视频流/字幕/转码分片，以及 `/dl`、`/dlzip`、`/api/unpackdl`、`/api/archive/dl` 等下载响应与 301/416，均不可缓存（附件下载禁用缓存同时不影响 Range 断点续传）。
  - 静态资源不可"长缓存"：`_send_static` 对 app.js / bootstrap.* / highlight.* / cjk-normalize.js / icons/*.svg 返回 `Cache-Control: no-cache` + 弱 `ETag`（mtime+size 派生，`W/"…"`）+ `Last-Modified`，并支持 `If-None-Match`/`If-Modified-Since` 命中回 304 空体——浏览器可存储但每次回源校验：文件未变时仅 304 极小开销，改版后（mtime/size 变化）必然拿到新内容，杜绝启发式缓存长期命中旧版资源。**注意：静态资源 URL 无版本号，若未来改用 `max-age` 长缓存，需先给引用加版本参数或内容寻址文件名**。
  - 视频缩略图（/api/thumb、分享页 /s/.../api/thumb、vthumbstrip、vframes）沿用 `max-age=86400`：文件名本身是视频内容 md5 寻址，天然不可变，允许长缓存。
  - 缓存失效兜底：用户端首次更新后如遇残留旧资源，在浏览器清一次站点缓存即可，此后改版无需再清。