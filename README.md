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

> 源码入口：`server/server.py:2`（模块 docstring 声明了整体设计意图）

## 2. 技术栈与依赖

| 依赖 | 用途 | 必需性 |
|---|---|---|
| Python 3.9+ 标准库（`http.server`/`ssl`/`cgi`/`zipfile`/`ctypes` 等） | 全部 Web 服务与核心逻辑 | **必需（唯一硬依赖）** |
| `cryptography`（第三方 pip 包） | 生成自签名证书（RSA-2048）、打包 PKCS#12（`server/server.py:44-52`，缺失直接报错退出） | **必需** |
| `ffprobe.exe`（`C:\Users\user\ffmpeg\bin\ffprobe.exe`，`server.py:72`） | 视频元数据提取（tag/时长/分辨率/码率） | 可选（缺失静默降级 `details=null`） |
| `ffmpeg.exe`（与 ffprobe 同目录，`server.py:74`） | 视频缩略图、MSE 转码/remux、内嵌字幕提取、缩略图条、单帧预览 | 可选（缺失时对应接口 404/500） |
| 无（纯 Python `zipfile`） | 打包下载输出 `.zip`（支持目录递归/多选/三种压缩级别，`server.py:3313`） | 内置，零外部依赖 |
| 无（纯 Python `zipfile`） | zip 包在线解压列表/单条目下载（`server.py:3212/3243`） | 内置，零外部依赖 |
| `faster_whisper`（pip 可选安装） | 视频语音识别生成字幕（`/api/asr`） | 可选（未安装接口返回 501） |
| Bootstrap / highlight.js / 文件类型图标 SVG | 前端离线静态资源（`static/` 目录） | 必需（随项目分发，白名单提供） |
| `cjk-normalize.js` | 简繁/日式新字体字符级归一化映射表（`static/cjk-normalize.js`，约 28KB，纯前端无运行时依赖） | 必需（随项目分发，已在静态白名单） |

`cjk-normalize.js` 数据来源：**opencc-data v1.4.1**（Apache-2.0，<https://github.com/nk2028/opencc-data>，原始词典 OpenCC <https://github.com/BYVoid/OpenCC>），使用 `TSCharacters.txt` / `STCharacters.txt` / `JPShinjitaiCharacters.txt` 三个文件生成（`cjk-normalize.js:5-9`）；导出全局函数 `normalizeCJK(str)` 逐字归一为简体规范字。

无任何 Web 框架；MCP 协议层也是零依赖手写实现（`server/mcp_stdio.py`）。

## 3. 目录结构

```
远程电脑文件访问服务/
├── .mcp.json                  # Claude 插件 MCP 配置：python server/server.py（MCP 模式入口）
├── 启动网盘.bat                # Windows 启动脚本：探测 Python → 杀残留实例 → 端口占用检查 → --serve auto 启动，崩溃 30s 自动重启
├── server/
│   ├── server.py               # 主服务（约 3880 行）：单端口（HTTPS/HTTP 首字节嗅探）+ MCP/CLI 双模式，全部核心逻辑
│   ├── mcp_stdio.py            # 零依赖 MCP stdio 框架（240 行）：JSON-RPC 2.0 行协议
│   ├── templates/
│   │   └── index.html          # 前端模板（299 行）：页面骨架 + 全部 CSS + 侧边栏结构；每次请求实时读盘支持热更新
│   └── __pycache__/            # Python 字节码缓存（可删除）
└── static/
    ├── app.js                  # 前端主逻辑（约 3680 行）：列表/网格、侧边栏筛选/排序/搜索、推荐标签、模糊匹配、播放器、预览、分享等
    ├── cjk-normalize.js        # 简繁/日式新字体归一化映射表（opencc-data 1.4.1，28KB，全局 normalizeCJK）
    ├── bootstrap.min.css / bootstrap.bundle.min.js   # 离线 Bootstrap 5
    ├── highlight.min.css / highlight.min.js          # 离线代码高亮
    ├── icons/                  # 15 个文件类型 SVG 图标（archive/audio/code/doc/exe/file/folder/image/iso/lnk/locked/pdf/sheet/text/video.svg）
    └── thumbs/                 # 视频缩略图缓存（md5(realpath|size|mtime).jpg，运行时自动生成，已在 .gitignore）
```

运行期数据目录：`~/.transfer-mcp/`（用户主目录下，非项目目录）——证书、shares.json、transcache 都在这里，详见第 8 节。

## 4. 启动方式

### 4.1 启动网盘.bat（网页模式）

1. **Python 探测**（`启动网盘.bat:6-11`）：按顺序检查 `D:\ANACONDA\python.exe` → `TRAE SOLO CN` 内置 python → `C:\Python312\python.exe` → `C:\Python311\python.exe` → 兜底用系统 `python`（可能是 WindowsApps 占位符 stub，无法运行）。
2. **自动清理残留实例**（`启动网盘.bat:13-15`）：用 PowerShell `Get-NetTCPConnection` 查 8443 监听进程，若命令行含 `server.py` 视为本服务的旧实例，`Stop-Process` 强杀；随后等待 2s。
3. **端口占用检查**（`启动网盘.bat:18-25`）：若 8443 仍被其它程序监听，打印 `netstat -ano | findstr :8443` 与 `taskkill /F /PID [pid]` 提示并退出，不再静默循环。
4. **启动命令**（`启动网盘.bat:29`）：`server.py --serve auto --port 8443 --token transfer`，即 CLI 模式：根目录 `auto`（全部固定磁盘）、端口 8443（**该端口同时服务 HTTPS 与 HTTP 明文，首字节嗅探自动识别**）、固定 token `transfer`（重启后链接不变）。
5. **崩溃自动重启**（`启动网盘.bat:27-34`）：服务的每次退出（含崩溃）都会在 30 秒后自动重启，形成一个 `:loop` 循环；关闭窗口即彻底停止。

### 4.2 CLI 直接启动

`python server/server.py --serve [根目录|auto] --port <端口> --token <token>`（参数解析见 `server.py:3901-3913`）。启动后打印 HTTPS 访问 URL（IPv6 + 127.0.0.1）、HTTP 免证书 URL（**与 HTTPS 同一端口**）、根目录与打包格式，Ctrl+C 停止。`--serve` 缺省值 `auto` = 整机所有固定磁盘；也可传单个根目录（如 `D:\资料`）。

### 4.3 MCP 模式（AI 客户端）

`.mcp.json` 定义 `transfer-mcp`：`command: python`，`args: [${CLAUDE_PLUGIN_ROOT}/server/server.py]`，并设置 `PYTHONUNBUFFERED=1`、`PYTHONIOENCODING=utf-8`。**不带 `--serve` 参数运行即进入 MCP 模式**（`server.py:3877-3878`），通过 stdin/stdout 行式 JSON-RPC 与 Claude 宿主通信，暴露 4 个工具：

| 工具 | 参数 | 作用 |
|---|---|---|
| `drive_start` | `root`（默认 "auto"）、`port`（默认 8443） | 启动服务，返回 URL/打包格式（`server.py:3784`） |
| `drive_pin` | `paths`（绝对路径数组） | 把文件/目录置顶到网页显著位置（`server.py:3807`） |
| `drive_status` | 无 | 查询运行状态/根目录/URL（`server.py:3847`） |
| `drive_stop` | 无 | 停止服务并清理防火墙规则（`server.py:3867`） |

## 5. 服务端架构与模块（server.py）

### 5.1 核心类

- **`_DriveServer(ThreadingHTTPServer)`**（`server.py:1349`）：`AF_INET6` 地址族 + 关闭 `IPV6_V6ONLY`（`server_bind`，`server.py:1394-1401`）实现**双栈监听**——`[::]` 同时接受 IPv4-mapped 连接，手机/本机 IPv4 均可达；`daemon_threads=True`；`allow_reuse_address = False`（`server.py:1355`，Windows 下禁止同端口多实例并存，端口被占时 bind 直接抛错退出）。持有 `roots`（允许根目录列表）、`token`、`pinned`（置顶列表）、`ssl_context`。**重写 `get_request` 做首字节嗅探**（`server.py:1364-1392`）：accept 后 `recv(1, MSG_PEEK)` 窥探首字节，`0x16`（TLS ClientHello）则 `wrap_socket` 走 HTTPS（握手设 5s 超时防半截 ClientHello 阻塞），否则按明文 HTTP 处理——单端口 8443 同时服务 HTTPS 与 HTTP。
- **`_DriveHandler(BaseHTTPRequestHandler)`**（`server.py:118`）：`protocol_version = "HTTP/1.1"`（便于 `<video>` 复用连接做 Range 分片）。核心方法：
  - `_send_json` / `_send_error_page`（`server.py:124/177`）：统一 JSON 响应与友好 HTML 错误页（403）
  - `_send_static`（`server.py:142`）：静态资源服务，**白名单 + basename 双重校验**（详见第 10 节）
  - `_send_file_range`（`server.py:197`）：统一 Range 断点续传下载，支持 `bytes=a-b` / `bytes=a-` / `bytes=-suffix`，非法越界返回 416；无会话状态，token 在 URL 里所以**换 IP 可续传**
  - `_resolve`（`server.py:285`）：路径越界校验——绝对化 + realpath + `commonpath` 前缀匹配 roots，越界返回 None
  - `_resolve_share_path`（`server.py:304`）：分享根内校验（多文件分享走白名单精确匹配、虚拟分享双向命中）
  - `_handle_share`（`server.py:613`）：`/s/<share_token>/...` 分享路由（见第 6.2 节）
  - `_handle_trans_api`（`server.py:375`）：视频转码/字幕/预览子路由统一处理（主站与分享页共用，resolve_fn 抽象越界校验）
  - `do_GET`（`server.py:994`）、`do_POST`（`server.py:1294`）：路由表，见第 6 节

### 5.2 关键独立函数/模块

- **磁盘枚举** `_fixed_drives`（`server.py:1493`）：`GetLogicalDrives` + `GetDriveTypeW==DRIVE_FIXED` 枚举固定磁盘。
- **目录列表** `_list_dir`（`server.py:1508`）：scandir，目录在前按名排序；系统噪声文件（DumpStack.log/hiberfil.sys/pagefile.sys/swapfile.sys，`_SYSTEM_NOISE` `server.py:1572-1573`）标记 `locked=True` 前端灰显不可下载；权限错误返回 None。
- **视频元数据** `_video_details`（`server.py:1722`）：ffprobe `-show_format -show_streams` 提取 tag/时长/码率/分辨率/声道等，进程内缓存 key=(realpath,size,mtime)（`server.py:1606`），任何失败静默返回 None；`_parse_comment_meta`（`server.py:1609`）把 comment 标签解析为结构化键值（上传/观看/点赞/标签/作者/类型），`_video_meta`（`server.py:1674`）构建前端详情面板数据。
- **meta=1 批量元数据**（见第 5.4 节）：`_meta_kind`（`server.py:1858`）扩展名→ 分类/mime；`_video_meta_cached`（`server.py:1880`）仅从进程内缓存读视频内容元数据（零 IO）；`_probe_video_meta`（`server.py:1916`）后台并发探测；`_augment_entries_meta`（`server.py:1941`）给每个 entry 附加 meta 字段。
- **缩略图** `_thumb_path`（`server.py:2084`）：ffmpeg 抽帧第 3 秒（失败回退 0 秒），`scale=360:-2`，缓存 `static/thumbs/<md5(realpath|size|mtime)>.jpg`。
- **打包**：`_stream_archive`（`server.py:3313`）统一核心（纯 zipfile）：普通打包（`_build_archive_items` `server.py:3279` 组装 arcname）与虚拟分享打包共用同一核心；支持 `mode=store|fast|normal` 三种压缩级别（`_ARCHIVE_MODES` `server.py:3272`）、scandir 递归展开目录（含空目录，visited+depth 防循环）、失败文件跳过清单（响应头 `X-Archive-Skipped`，URL 编码 JSON）、同时最多 2 个打包任务（`_ARCHIVE_SEM` `server.py:3268`）、临时盘空间预检。
- **解压**：`_unpack_list`（`server.py:3212`）/`_unpack_download`（`server.py:3243`）仅支持 zip（zipfile 流式），其它格式返回 unsupported。
- **防火墙**：`_add_firewall_rule`（`server.py:3644`）netsh 添加入站规则 `TransferMCP-<port>`，失败返回含修复命令的提示；`_remove_firewall_rule`（`server.py:3668`）停止时删除。
- **URL 生成**：`_public_ipv6`（`server.py:3617`）找非链路本地非 ULA 的 IPv6；`_urls`（`server.py:3631`）HTTPS 链接、`_urls_http`（`server.py:3637`）HTTP 免证书链接（**与 HTTPS 同一端口**）。
- **证书**：`_ensure_cert`（`server.py:3562`）不存在/损坏/过期/SAN 无 IP 时生成自签名证书（CN/SAN=`transfer.local`，RSA-2048，有效期 7 天，SHA256，SAN 含本机全部 IP，`_cert_san` `server.py:3519`）；`_cert_p12_bytes`（`server.py:3600`）打包 PKCS#12（密码 `1234`，`server.py:3597`，小米等 Android 装 CA 必需）。
- **MCP 工具**：`drive_start/drive_pin/drive_status/drive_stop`（`server.py:3784-3866`），`_under`（`server.py:3871`）做根目录包含校验。

### 5.3 MSE 转码链路（`server.py:2362-2747`）

- **会话模型**：`_trans_sessions` 全局字典，key=`(realpath, q, start_sec, persist)`；每个会话 = 一个常驻 ffmpeg 进程（`_trans_encode_thread`，`server.py:2397`）从 `start_sec` 起**连续**输出 fragmented MP4 到内存缓冲，前端按 offset 顺序拉取拼接（保证 moof 序列号连续）。
- **四档画质** `_TRANS_KEYS`/`_TRANS_QUALITIES`（`server.py:85-86`）：`original`（`-c copy` 快速 remux 不重编码，`_trans_remux_args` `server.py:2389`）/ `high`(1920) / `medium`(1280) / `low`(854)，转码参数为 `libx264 High 5.1 ultrafast/zerolatency + aac 128k + crf27 + keyint 60`（`_trans_args` `server.py:2362`）。
- **会话生命周期**：`_trans_ensure_session`（`server.py:2477`）创建/复用；`persist=False`（MSE 播放与分享页）不落盘完整缓存；`_trans_consume`（`server.py:2572`）按 offset 取数据带 5s 等待上限；`_trans_sweep_loop`（`server.py:2604`）后台线程每 5s 按 `last_client` 空闲超时 30s 回收会话并杀进程。
- **编码器能力探测**：`_ffmpeg_capabilities`（`server.py:2167`）惰性执行 `ffmpeg -encoders` 检查 libx264/aac，防止精简版 ffmpeg 静默失败。
- **MSE codec 契约**：`/api/vinfo` 的 `mseMime`（`_vinfo_mime` `server.py:2335`）——转码档固定 `avc1.640033`（High 5.1）+ 有条件 `mp4a.40.2`；原画档按源编码换算 `avc1.PPCCLL`（`_avc1_from_profile` `server.py:2274`）/ `hvc1`（`_hvc1_from_profile` `server.py:2291`）。
- **原画缓存下载**（`server.py:2748-2913`）：`cache=1` 时按 Range 边播边写"稀疏文件 + 区间集合"（`original.cache` + `original.cache.json`），per-digest 锁串行化合并（`_stream_cached` `server.py:2810`）。
- **缓存容量治理**：`_cache_sweep_loop`（`server.py:2672`）每 600s 执行 `_cache_sweep_once`（`server.py:2627`），transcache 超 2GB 按 mtime 从旧到新删，跳过活动会话的 cfile 与 `.tmp` 文件。

### 5.4 meta=1 批量元数据（侧边栏数据源）

`api/list?meta=1` 为每个 entry 附加 meta 字段（`_augment_entries_meta`，`server.py:1941`）：

- **目录** → `{"kind": "dir"}`
- **文件** → `{"kind": 分类, "mime": 类型}`，分类集合固定 video/audio/image/text/code/archive/exe/lnk/other（`_meta_kind`，`server.py:1858`），按扩展名判定，文本/代码无需读内容
- **视频** → 额外附加 `duration`（秒）/`width`/`height`，以及内容性字段 `title/author/type/tags/notes`——全部取自 `_video_details_cache` 进程内缓存（`_video_meta_cached`，`server.py:1880`），**零 IO、绝不运行 ffprobe**
- **未命中缓存的视频** → 进探测队列由 `_probe_video_meta`（`server.py:1916`）后台并发探测：8 个 worker、单次总预算 3s（`_VIDEO_PROBE_WORKERS`/`_VIDEO_PROBE_BUDGET_SEC`，`server.py:1807-1808`）、多请求互斥锁，**到点立即返回，任何情况下不阻塞列表响应**；预算外未完成任务由 executor 后台线程继续，成功即写缓存，下次 meta=1 直接命中

### 5.5 字幕 / 识别 / 预览

- `_subtitle_vtt`（`server.py:2979`）：同目录旁挂字幕（`.srt/.vtt/.ass/.ssa`，`server.py:2917`）优先，其次 ffmpeg 提取内嵌字幕流转 WebVTT；`_srt_to_vtt`（`server.py:2938`）/ `_ass_to_vtt`（`server.py:2950`）格式转换。
- `_asr_transcribe`（`server.py:3038`）：faster_whisper `small` 模型（CPU int8）单例复用 + per-path 锁 + 结果缓存 `<digest>.asr.<lang>.vtt`；语言 ja/en/zh。
- `_vthumbstrip_gen`（`server.py:3120`）：整段横向缩略图条（≤20 帧 tile）缓存 `<digest>.strip.jpg`；`_vframe_gen`（`server.py:3159`）：任意秒单帧预览缓存 `<digest>.f<秒>.jpg`。

### 5.6 后台线程（全部 daemon）

| 线程 | 启动处 | 周期 | 职责 |
|---|---|---|---|
| HTTPS/HTTP 服务 `serve_forever` | `_start` `server.py:3679` | 常驻 | 8443（单端口，首字节嗅探自动识别 TLS/明文） |
| `_trans_sweep_loop` | `_start` `server.py:3679` | 5s | 回收空闲转码会话 |
| `_cache_sweep_loop` | `_start` `server.py:3679` | 600s | 转码缓存磁盘治理 |

## 6. 完整路由 / API 清单

### 6.1 主站路由（前缀 `/transfer/`，token 可变）

**token 前缀保护机制**（`do_GET` `server.py:994-997`）：除 `/s/` 分享路由外，所有主站请求必须满足 `path == "/<token>"` 或以 `"/<token>/"` 开头，否则返回 403 `{"error":"无效 token"}`。**访问 `/transfer`（无尾部斜杠）会 301 重定向到 `/transfer/`**（`server.py:998-1003`）——否则页面内相对路径 `static/...` 会被浏览器解析成 `/static/...`（丢失 token 前缀）导致 403。`do_POST` 同理要求 `/<token>/` 前缀（`server.py:1283-1286`）。

| 方法 | 路径 | 参数 | 返回 / 说明 |
|---|---|---|---|
| GET | `/` | - | 主页面 index.html |
| GET | `/static/<name>` | - | 离线静态资源（白名单，见第 10 节） |
| GET | `/api/info` | - | `{roots, pinned, archive_format}`（固定 `zip`） |
| GET | `/api/list` | `path`、`meta=1` | 目录列表 `{path, parent, entries[]}`；`meta=1` 给每个 entry 附加 `meta`（kind/mime、视频 duration/width/height + title/author/type/tags/notes，见第 5.4 节）；无权限 403 + parent 供"返回上级" |
| GET | `/api/pin` | `path`、`add=1\|0` | 置顶/取消置顶，返回最新 pinned 列表 |
| GET | `/api/stat` | `path` | 文件/目录详情（含 preview 类型、视频 details、locked） |
| GET | `/api/vmeta` | `path` | 视频结构化元数据（`{ok, meta}`，非视频 meta=null 不报错） |
| GET | `/api/lnk` | `path` | PowerShell COM 解析 .lnk 目标（`{ok,target,is_dir,exists,...}`） |
| GET | `/api/thumb` | `path` | 视频缩略图 jpg（ffmpeg 抽帧，缓存 thumbs/，max-age=86400） |
| GET | `/api/pdf` | `path` | PDF 内联预览（ctype 强制 application/pdf，Range 流） |
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
| GET | `/api/certp12` | - | 下载含私钥 PKCS#12（drive-mcp.p12，密码 1234，Android 用） |
| GET | `/api/read` | `path`、`limit`(16KB~4MB) | 文本预览（BOM→utf-8→gbk→latin-1 逐级解码，kind=text/markdown/csv） |
| GET | `/api/unpack` | `path` | 压缩包条目列表（仅 zip，其它格式 `unsupported`） |
| GET | `/api/unpackdl` | `archive`、`entry` | 下载压缩包内单个条目 |
| GET | `/dl` | `path` | 通用下载（Range 断点续传，attachment） |
| GET | `/dlzip` | `paths`(竖线分隔)、`mode=store\|fast\|normal` | 多文件/目录打包下载 zip（`X-Archive-Format: zip`、失败跳过清单 `X-Archive-Skipped` 头） |
| POST | `/api/upload` | `path` + multipart/form-data | 上传文件到当前目录（cgi.FieldStorage，中文文件名 latin-1→utf-8 修正） |

### 6.2 分享路由（前缀 `/s/<share_token>/`，与主 token 完全隔离）

入口 `_handle_share`（`server.py:613`）：分享 token 不经主 token 校验、不暴露主 token；分享页复用同一份 index.html + app.js（app.js 靠 `location.pathname` 以 `/s/` 开头识别分享模式，`app.js:864`）；所有子请求统一走 `_resolve_share_path` 越界校验。

| 子路径 | 说明 |
|---|---|
| `""`（空） | 分享页 = 主站模板；不存在 404 纯文本；**过期返回 200 过期提示页**（`server.py:973`，不在此删除以便稳定重复访问） |
| `api/info` | 分享信息（root/name/is_dir/expires_at/multi/virtual/files 白名单清单） |
| `api/list` | 目录列表，**支持 `meta=1`**；虚拟分享按虚拟相对路径导航（`server.py:689-729`）；多文件分享只展示 files 白名单一层；**单文件分享返回单个条目**（防 scandir 抛错，`server.py:760-792`） |
| `api/stat` / `api/vmeta` / `api/lnk` / `api/thumb` / `api/pdf` / `api/read` / `api/unpack` / `api/unpackdl` | 与主站同语义（分享根内校验） |
| `api/stream` / `api/trans` / `api/transstatus` / `api/transdl` / `api/subtitle` / `api/asr` / `api/vthumbstrip` / `api/vframes` / `api/vinfo` | 复用 `_handle_trans_api`，但 **persist=False 不落盘转码缓存**（`server.py:864-872`） |
| `api/sharesub` | 二次分享：`parent` 链继承父分享过期时间（父过期则子视为过期，`_share_expired` `server.py:350`） |
| `dl` / `dlzip` | 分享内下载/打包（虚拟分享把 (虚拟相对路径, 真实路径) 直接交给统一打包核心 `_stream_archive`，`server.py:931-953`；支持 `mode=store|fast|normal`） |
| `static/*` | 复用主站静态白名单 |
| `api/pin` / `api/upload` / `api/cert` / `api/certp12` / `api/share` | **分享模式禁用，返回 403**（`server.py:965-967`） |

过期分享其余 API 返回 410 `{"error":"链接已过期"}`（`server.py:646`）；创建新分享时顺带清理过期 token（`server.py:1148-1189`）。

### 6.3 MCP 协议层（mcp_stdio.py）

- JSON-RPC 2.0 行协议（stdin 读请求 / stdout 写响应，**日志走 stderr**，`mcp_stdio.py:92-101`）；UTF-8 强制（`reconfigure`，`mcp_stdio.py:182-186`，解决 Windows GBK 管道问题）。
- 支持方法：`initialize`（协议版本协商，支持 2025-06-18/2025-03-26/2024-11-05，`mcp_stdio.py:22-23`）、`notifications/initialized`、`ping`、`tools/list`、`tools/call`；不支持批量请求；响应 `isError=true` 时把错误作为文本内容返回给模型（`ToolError`，`mcp_stdio.py:33-39/151-152`）。

## 7. 前端功能清单（index.html + app.js）

入口 `init()`（`app.js:2228`）：分享模式隐藏主站 UI（磁盘/置顶/打包/上传，`hideMainUi` `app.js:2219`）只读浏览分享根；主站模式加载磁盘/置顶并**从 localStorage 恢复上次目录与视图**。

| 功能 | 说明 | 位置 |
|---|---|---|
| 磁盘标签页 | 顶部横向滚动胶囊按钮，点击切换磁盘根 | `renderDriveTabs` `app.js:2295` |
| 面包屑 + 后退/前进 | 分段导航；栈式前进后退（`_pushNav` `app.js:2409`，按钮 `app.js:2420-2421`） | `renderBreadcrumb` `app.js:2341` |
| 列表/网格视图 | 网格视图视频显示 ffmpeg 缩略图封面（失败回退图标）；视图偏好持久化 | `listItem` `app.js:3118` / `gridItem` `app.js:3154` |
| 置顶（星标） | 列表/网格行内 ☆ 切换；置顶卡片区提供下载/分享/取消；打包（下拉选 store=最快/fast=快/normal=标准）与"全部分享"按钮；打包走 fetch+Blob 流式下载，带进度条/取消/失败清单弹窗 | `renderPinned` `app.js:2314` |
| 上传 | 多文件顺序上传 + 进度条；分享模式无此按钮 | `app.js:3353-3385` |
| 下载 | 非预览类型直接跳 `/dl`；统一 `dlUrl()`（`app.js:908`） | `bindRowAction` `app.js:3209` |
| 视频播放器 | 画质选择（原画/高清/标清/低清）、**MSE 免证书模式**、缓存下载开关、字幕（track/overlay）、ASR 识别（语言切换）、进度条悬停预览（缩略图条 + 单帧 80ms 防抖）、视频详情面板（标题/作者/类型/统计/标签/技术徽章）、原画→高清自动降级 | `showVideo` `app.js:1164` |
| 文本/Markdown 预览 | 内置 Markdown 渲染器（转义后套格式防 XSS，`renderMarkdown` `app.js:1953`）；代码高亮（≤200KB 用 hljs，超大分片渲染）；大文本分片渲染 + 取消；400KB 截断提示 | `showText` `app.js:2045` |
| CSV 预览 | 简易引号感知解析器；前 300KB / 2000 行上限 | `showCsv` `app.js:3365` |
| PDF 预览 | iframe 内联 + 新窗口兜底链接 | `showPdf` `app.js:3523` |
| 压缩包解压预览 | 条目列表（≤5000 条），点击条目直接下载 | `showUnpack` `app.js:2145` |
| .lnk 快捷方式 | 显示目标、进入目标目录/下载原文件（越界时"返回上级"靠 navStack 回退链兜底，`app.js:3085-3093`） | `showLnk` `app.js:3548` |
| 分享链接 | 单文件/目录（`showShareDialog` `app.js:3601`）、全部置顶（`showShareManyDialog` `app.js:3665`）、分享页内二次分享（`showSubShareDialog` `app.js:3726`）；有效期 1/24/72/168 小时；复制/打开链接 | |
| 状态恢复 | localStorage `drive.cur/drive.root/drive.view/drive.modal`；弹窗加入浏览器历史（手机返回键关弹窗不退出）；分享模式不读写主站键 | `saveDriveState` `app.js:3414` |
| 错误处理 | 无权限目录显示"返回上级"按钮；token 校验失败 403 JSON 提示；虚拟分享根为空串时靠 navStack/activeRoot 兜底 | `showAlert` `app.js:930` |

### 7.1 侧边栏（视图与筛选）

右侧滑出面板（HTML：`index.html:234-292`，CSS `index.html:128-151`），打开/关闭 `openSidebar`/`closeSidebar`（`app.js:2990-3001`），关闭不改变筛选状态。列表加载统一带 `meta=1`（`loadList` `app.js:3074-3080`），侧边栏所有操作**基于 `currentEntries` 前端过滤重渲染，不重新请求**。

| 区块 | 说明 | 位置 |
|---|---|---|
| 搜索 | 输入即过滤，**150ms 防抖**（`app.js:3011-3016`）；先 `normalizeCJK` 简繁归一化再小写（`normSearch` `app.js:2449`） | `index.html:243-251` |
| 深度查找开关 | 关闭：仅匹配文件名；开启：文件名 + 元数据内容白名单字段（`META_CONTENT_KEYS` `app.js:2456-2457`，仅 title/author/type/tags/notes/extra 等真实内容，**排除** kind/mime/duration/upload/views/likes/tech 等技术统计字段）；`entrySearchText` `app.js:2474` | `index.html:246-249`、`app.js:3025-3029` |
| 推荐标签 | CJK bigram 分词 + tags 完整标签 + 内联 856 词停用词表（`STOPWORDS` `app.js:4-861`）+ 扩展名/版本号/日期噪声过滤（`isTagNoiseWord` `app.js:2498`）；按**出现文件数**计分（每文件最多计 1，`extractKeywords` `app.js:2511`）；异步分批（20 个/批）增量统计、随进度动态渐出 Top10（`startTagScan` `app.js:2556`、`tagScanStep` `app.js:2570`）；**per-path 缓存**（`_tagCache` `app.js:2550`），目录切换自动失效重扫（`loadList` `app.js:3113`），↻ 按钮手动强刷（`app.js:3020-3023`）；点击标签 → 追加搜索框 + **自动开启深度查找**（标签可能只存在于元数据，`tagApplyTag` `app.js:2636-2654`） | `index.html:252-259` |
| 视图切换 | 列表/网格 radio 式按钮组，localStorage 持久化 | `index.html:261-266`、`app.js:2975-2985` |
| 类型筛选（多选） | 视频/文本/编程/软件包/压缩包/快捷方式/目录 + 自输入后缀（逗号分隔，如 `md,txt,json`）；类型判定基于 meta.kind（`entryKindMatch` `app.js:2428`），硬筛选含后缀 OR 逻辑（`applyHardFilters` `app.js:2792`） | `index.html:267-279`、`app.js:3029-3033` |
| 排序 | 修改时间/名称（本地化 zh-Hans-CN）/大小，**双向切换**：再次点击当前排序项即反转方向（原生 select 重复选择不触发 change，用 **mousedown+click 协作**手动反转，`app.js:3038-3057`）；默认方向 mtime 新→旧 / name 升序 / size 大→小（`DEFAULT_SORT_DIR` `app.js:2833`）；目录永远排前（`entryCompare` `app.js:2854`）；option 文本随方向动态更新（`updateSortLabel` `app.js:2840`） | `index.html:280-287` |
| 重置 | 一键清空筛选/搜索/恢复默认排序 | `app.js:3059-3069` |

### 7.2 搜索关键词语法（parseQuery）

查询统一由 `parseQuery`（`app.js:2810-2817`）解析为 `[{and:[...]},...]` 组结构，精确与模糊两阶段共用：

- **AND（且）**：空格 与 `&`——组内所有词必须全部命中
- **OR（或）**：`,` `，` `|` `/`——任一组命中即匹配
- 支持组合查询，如 `日常 里番|合集` = （"日常" 且 "里番"）或 （"日常" 且 "合集"）
- 空词自动过滤；连续/混合分隔符取并集效果

精确阶段（`filterEntries` `app.js:2821`）对归一化后的可搜索文本做子串匹配；模糊阶段（`fuzzyMatchTexts` `app.js:2781`）对同一组结构做概率判定。

### 7.3 模糊匹配（概率模型 + 两阶段渲染）

**概率匹配模型**（`app.js:2655-2788`，纯函数可单测）：

| 分量 | 算法 | 覆盖场景 |
|---|---|---|
| 精确子串 | `target.includes(kw)` | 得分恒为 1.0 |
| `s_lcs` | LCS(kw,target)/len(kw)（DP 滚动数组） | 隔开（子序列）、缺字（target 是 kw 子序列） |
| `s_edit` | 1 − 滑窗 Damerau-Levenshtein/len(kw)（窗口宽 len+2，滑动取全串最小） | 错字、相邻转位 |
| `s_multi` | 字符多集覆盖率（kw 各字符在 target 中可被消耗的次数/len） | 乱序上限约束（预筛 0.6、硬约束 0.8） |
| `s_perm` | 0.6·s_multi + 0.4·max(s_lcs, s_edit) | 乱序加权 |

判定 `final = max(s_lcs, s_edit, s_perm) ≥ 0.8` 且多集覆盖率 ≥ 0.8（`fuzzyMatchKw` `app.js:2763`），阶段短路：预筛 → 字符硬约束 → LCS 达标 → 滑窗编辑达标 → 乱序加权。

**两阶段渲染**（`renderEntries` `app.js:2872`）：

1. **阶段一（同步）**：硬筛选（类型/后缀）+ 精确子串过滤 → 排序 → 全量渲染，输入后立即出结果；
2. **阶段二（异步渐进）**：未命中文件进模糊队列，每批 30 个（`FUZZY_BATCH` `app.js:2903`）分片处理（批间 setTimeout(0) 让出主线程），命中即以 `entryCompare` 二分查找插入正确排序位置（`insertIntoSortedDom` `app.js:2932`）；顶部 `fuzzyHint` 显示进度"正在模糊匹配… x/y"（`index.html:213`）；新输入/重渲染递增令牌使旧任务**可打断**（`app.js:2942-2974`）。

**页面细节**：`index.html:7` 有 `<link rel="icon" href="data:,">` 消除 favicon 请求（避免 403 干扰）；品牌色覆盖 Bootstrap primary 为 `#2563eb`（`index.html:12-15`）；手机端触控目标 ≥44px（`index.html:123-127`）；侧边栏宽度 `min(320px, 86vw)`（`index.html:132`）。

## 8. 数据与状态

| 数据 | 位置 | 格式 / 说明 |
|---|---|---|
| 自签名证书 | `~/.transfer-mcp/server.crt` + `server.key` | PEM，RSA-2048，7 天有效期，CN/SAN=`transfer.local`、SAN 含本机全部 IP；缺失/损坏/过期/SAN 无 IP 时自动重建（`server.py:57-61, 3516, 3562`） |
| 分享记录 | `~/.transfer-mcp/shares.json` | `{token: {root, is_dir, expires_at, created_at, name, [files, virtual, nodes, parent]}}`；写临时文件再 rename 防损坏（`_save_shares` `server.py:3196`）；**模块加载即恢复**（跨进程重启链接仍有效，`server.py:3184`） |
| 转码/原画缓存 | `~/.transfer-mcp/transcache/<sha256(realpath)>/` | 转码档 `<digest>.<q>.mp4`、原画稀疏缓存 `original.cache`(+`.json`)、缩略图条 `strip.jpg`、单帧 `f<秒>.jpg`、ASR `<digest>.asr.<lang>.vtt`；总容量上限 2GB 按 mtime 清理（`server.py:77-81`） |
| 视频缩略图 | `static/thumbs/<md5(realpath\|size\|mtime)>.jpg` | ffmpeg 抽帧，文件变化自动失效，已在 .gitignore 排除（`server.py:2084-2121`） |
| 视频元数据缓存 | 进程内存 `_video_details_cache` | key=(realpath,size,mtime)，ffprobe 失败也缓存 None；meta=1 的深度查找/推荐标签均只读此缓存（`server.py:1606`） |
| 置顶列表 pinned | 仅内存（`_DriveServer.pinned` / `_state["pinned"]`） | **重启即丢失**；由 MCP `drive_pin` 或网页星标维护 |
| 推荐标签缓存 | 前端内存 `_tagCache`（Map: path → scores） | per-path 缓存避免重复扫描；目录切换自动失效重扫（`app.js:2548, 3111`） |
| 前端状态 | 浏览器 localStorage | `drive.*` 键，见第 7 节 |

## 9. 配置与常量

| 常量 | 值 | 位置 |
|---|---|---|
| `VERSION` | "3.0.0" | `server.py:57` |
| `DEFAULT_PORT` | 8443（HTTPS 与 HTTP 明文同端口，首字节嗅探自动识别） | `server.py:58` |
| `CERT_DIR` / 证书/私钥 | `~/.transfer-mcp/` / server.crt / server.key | `server.py:59-61` |
| `FFPROBE` / `FFMPEG` | `C:\Users\user\ffmpeg\bin\ffprobe.exe` / 同目录 ffmpeg.exe | `server.py:72-74` |
| `TRANSCACHE_DIR` | `~/.transfer-mcp/transcache` | `server.py:77` |
| `TRANS_IDLE_TIMEOUT` | 30s（转码会话空闲回收） | `server.py:78` |
| `TRANS_WAIT_SEC` | 5s（trans 拉取等待上限） | `server.py:79` |
| `TRANS_CHUNK` | 512KB（前端单次期望分片） | `server.py:80` |
| `TRANSCACHE_MAX_BYTES` | 2GB（缓存清理阈值） | `server.py:81` |
| `_CACHE_SWEEP_INTERVAL` | 600s（缓存治理周期） | `server.py:82` |
| 画质目标宽度 | high=1920 / medium=1280 / low=854 | `server.py:84` |
| `_VIDEO_PROBE_WORKERS` / `_VIDEO_PROBE_BUDGET_SEC` | 8 / 3.0（meta=1 视频探测并发上限与总预算） | `server.py:1807-1808` |
| 分享有效期选项 | 1 / 24 / 72 / 168 小时 | `server.py:97` |
| 证书有效期 | 7 天（前后 5 分钟缓冲） | `server.py:3575-3576` |
| `CERT_P12_PASSWORD` | "1234" | `server.py:3597` |
| 静态资源白名单 | bootstrap.min.css / bootstrap.bundle.min.js / app.js / highlight.min.js / highlight.min.css / **cjk-normalize.js** + icons/*.svg | `server.py:66-69` |
| 文本预览默认/上限 | 默认 1MB，钳制 16KB~4MB | `server.py:2001, 2041-2054` |
| 转码输出 | H.264 High 5.1 (avc1.640033) + aac 128k，crf 27，keyint 60，fMP4 | `server.py:2362-2386` |
| 防火墙规则名 | `TransferMCP-<port>` | `server.py:3645` |
| MCP 首选协议 | 2025-06-18 | `mcp_stdio.py:22` |
| 搜索防抖 | 150ms | `app.js:3015` |
| `FUZZY_SCORE_MIN` / `FUZZY_MULTI_MIN` / `FUZZY_PRESCREEN` | 0.8 / 0.8 / 0.6（模糊判定阈值/字符硬约束/预筛） | `app.js:2661-2663` |
| `FUZZY_TARGET_MAX` | 200（超长文本截断，限制 O(n·m) 计算量） | `app.js:2664` |
| `FUZZY_PERM_WMIX` | 0.6（乱序加权中 s_multi 的权重） | `app.js:2665` |
| `FUZZY_BATCH` | 30（模糊分片每批文件数） | `app.js:2903` |
| `TAG_BATCH` / `TAG_TOP_N` / `TAG_MIN_LEN` / `TAG_MAX_LEN` | 20 / 10 / 2 / 20（推荐标签分批数/TopN/词长下限/上限） | `app.js:2482-2485` |
| `META_CONTENT_KEYS` | title/author/type/tags/notes/extra/track/album/artist/genre/comment/description/captions/lyrics（深度查找白名单） | `app.js:2456-2457` |
| 停用词表 | 内联 856 词（来源 goto456/stopwords cn_stopwords.txt + 基础英文停用词 + 常见扩展名） | `app.js:4-861` |

## 10. 已知限制与注意事项

- **token 前缀保护**：所有主站 API 必须带 `/transfer/` 前缀（`server.py:994-997`），否则 403；`/transfer` 无斜杠会 301 到 `/transfer/`（`server.py:998-1003`）。分享路由 `/s/` 独立于主 token，二者互不暴露。
- **路径越界校验**：`_resolve`（`server.py:285`）用 `realpath + commonpath` 保证请求路径必在 roots 内（防符号链接逃逸）；分享用 `_resolve_share_path`（`server.py:304`），多文件分享是**白名单精确匹配**而非前缀匹配——父目录路径访问未分享文件会被拒绝。
- **静态资源白名单**：`_send_static`（`server.py:142`）只允许顶层 6 个指定文件（含 cjk-normalize.js）与 `icons/*.svg`，basename + 无斜杠双重校验，杜绝路径穿越。
- **`cgi` 模块弃用警告**：`server.py:20` 导入 `cgi`（Python 3.13 起弃用，3.15 移除），上传用 `cgi.FieldStorage` 解析 multipart（`server.py:1300`）；未来需替换为手写 multipart 解析。
- **HTTP 明文（同上端口 8443）**：仅用于手机打不开自签名证书页面时的局域网兜底，明文传输，仅限可信网络（启动提示已注明）；服务端靠首字节嗅探区分 TLS/明文，`http://` 与 `https://` 均可访问同一端口。
- **只读为主 + 上传**：服务不能删除/修改服务器端已有文件，只能上传到当前目录；分享模式连上传也禁用。
- **权限受限目录**：无权限目录返回 403 且前端提示"返回上级"；浏览受系统保护目录需以管理员身份运行。
- **firewall 规则**：添加入站规则需要管理员权限，失败时启动输出会给出手工执行命令（`server.py:3644-3668`）。
- **pinned 不持久化**：置顶列表只存内存，服务进程重启即清空。
- **转码依赖**：MSE 转码/字幕提取/缩略图条/单帧都需要完整版 ffmpeg（含 libx264/aac，`_ffmpeg_capabilities` 会明确报缺哪些编码器）；ffprobe 缺失时视频元数据静默降级。
- **转码缓存占用**：MSE 播放默认只在内存缓冲（不落盘），但主站 start=0 的持久会话与"缓存下载"会写 transcache（上限 2GB 自动清理）；分享页播放**永不落盘**，避免占用分享者磁盘。
- **favicon**：`index.html:7` 用 `<link rel="icon" href="data:,">` 消除 favicon 请求，避免其落进 token 前缀外产生 403 噪音。
- **Windows 编码**：MCP stdio 强制 UTF-8（`mcp_stdio.py:182-186`）；前端上传中文文件名做 latin-1→utf-8 修正（`server.py:1325-1329`）。
- **大文件预览**：`/api/read` 默认只读前 1MB（前端再截断 400KB 渲染、CSV 300KB/2000 行、压缩包列表 5000 条），完整内容需下载。
- **深度查找 / 推荐标签依赖视频元数据探测**：元数据源于 ffprobe 的 tag/comment（`_parse_comment_meta` `server.py:1609`），只有视频文件且已被探测进缓存才有内容字段；meta=1 探测受 3s 预算限制，**超大目录首次浏览时部分视频可能暂无元数据**（深度查找/标签推荐会漏），重新打开目录（缓存已填充）即可补全。
- **模糊匹配的边界**：仅对硬筛选后的未命中文件做概率匹配，超长文本截断到 200 字符（`FUZZY_TARGET_MAX`）；错字/转位容忍约 1-2 字（滑窗宽 len+2）；**3 字以上完全乱序不匹配**（乱序加权 0.6/0.4 + 0.8 阈值的设计边界）；预筛阈值 0.6 意味着字符多集覆盖率不足的直接跳过。
- **关键词语法注意**：`/` 与 `，,|` 都是 **OR 分隔符**——搜索串含 `/` 时会被拆成多组"或"查询（如 `a/b` 视为 `a OR b`）；点击推荐标签时若标签本身含 `/`、`,` 等字符也会按语法解释（预期行为，不做转义，`app.js:2635` 注释）。
- **虚拟分享路径含 `/`**：虚拟分享的目录导航用 `/` 分隔虚拟路径，其文件名本身不含 `/`，但搜索框直接输入虚拟路径片段时需注意 `/` 会被当作 OR 分隔符。
- **单实例约束**：`_DriveServer.allow_reuse_address = False`（`server.py:1355`）+ 启动脚本的残留实例清理/端口检查（`启动网盘.bat:13-25`），杜绝"新旧实例共同监听一个端口、请求随机分发"的问题。