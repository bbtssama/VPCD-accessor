# 远程电脑文件访问服务（drive-mcp v3）

## 1. 项目简介

一个基于 Python 标准库 `http.server` 的"手机网盘"式**远程电脑文件浏览/传输服务**：把整台电脑（默认所有固定磁盘）变成一个手机浏览器可访问的 HTTPS 网盘，支持浏览、上传、下载、打包、在线视频播放（MSE 免证书转码）、文本/Markdown/CSV/PDF 预览、压缩包在线解压、分享链接等；同时通过自带的行式 JSON-RPC（MCP stdio）协议暴露 `drive_start/pin/status/stop` 四个工具，供 Claude 等 AI 客户端直接调用。

> 源码入口：`server/server.py:1`（模块 docstring 声明了整体设计意图）

## 2. 技术栈与依赖

| 依赖 | 用途 | 必需性 |
|---|---|---|
| Python 3.9+ 标准库（`http.server`/`ssl`/`cgi`/`zipfile`/`ctypes` 等） | 全部 Web 服务与核心逻辑 | **必需（唯一硬依赖）** |
| `cryptography`（第三方 pip 包） | 生成自签名证书（RSA-2048）、打包 PKCS#12（`server/server.py:42-50`，缺失直接报错退出） | **必需** |
| `ffprobe.exe`（`C:\Users\user\ffmpeg\bin\ffprobe.exe`，`server.py:70`） | 视频元数据提取（tag/时长/分辨率/码率） | 可选（缺失静默降级 `details=null`） |
| `ffmpeg.exe`（与 ffprobe 同目录，`server.py:72`） | 视频缩略图、MSE 转码/remux、内嵌字幕提取、缩略图条、单帧预览 | 可选（缺失时对应接口 404/500） |
| WinRAR（`Rar.exe`/`WinRAR.exe`，`server.py:1462-1477`） | 打包下载输出 `.rar` | 可选（缺失自动降级 `.zip`） |
| UnRAR.exe（`server.py:1480-1492`） | rar 包在线解压列表/单条目下载 | 可选（缺失时 rar 解压返回错误） |
| `faster_whisper`（pip 可选安装） | 视频语音识别生成字幕（`/api/asr`） | 可选（未安装接口返回 501） |
| Bootstrap / highlight.js / 文件类型图标 SVG | 前端离线静态资源（`static/` 目录） | 必需（随项目分发，白名单提供） |

无任何 Web 框架；MCP 协议层也是零依赖手写实现（`server/mcp_stdio.py`）。

## 3. 目录结构

```
远程电脑文件访问服务/
├── .mcp.json                  # Claude 插件 MCP 配置：python server/server.py（MCP 模式入口）
├── 启动网盘.bat                # Windows 启动脚本：探测 Python → 以 --serve auto 模式启动，崩溃 30s 自动重启
├── server/
│   ├── server.py               # 主服务（3622 行）：HTTP 双端口 + MCP/CLI 双模式，全部核心逻辑
│   ├── mcp_stdio.py            # 零依赖 MCP stdio 框架（240 行）：JSON-RPC 2.0 行协议
│   ├── templates/
│   │   └── index.html          # 前端模板（213 行）：页面骨架 + 全部 CSS；每次请求实时读盘支持热更新
│   └── __pycache__/            # Python 字节码缓存（可删除）
└── static/
    ├── app.js                  # 前端主逻辑（2168 行）：列表/网格、播放器、预览、分享等
    ├── bootstrap.min.css / bootstrap.bundle.min.js   # 离线 Bootstrap 5
    ├── highlight.min.css / highlight.min.js          # 离线代码高亮
    ├── icons/                  # 14 个文件类型 SVG 图标（archive/audio/code/doc/exe/file/folder/image/iso/lnk/locked/pdf/sheet/text/video.svg）
    └── thumbs/                 # 视频缩略图缓存（md5(realpath|size|mtime).jpg，运行时自动生成）
```

运行期数据目录：`~/.transfer-mcp/`（用户主目录下，非项目目录）——证书、shares.json、transcache 都在这里，详见第 8 节。

## 4. 启动方式

### 4.1 启动网盘.bat（网页模式）

1. **Python 探测**（`启动网盘.bat:5-11`）：按顺序检查 `D:\ANACONDA\python.exe` → `C:\Users\user\AppData\Roaming\TRAE SOLO CN\...\python.exe` → `C:\Python312\python.exe` → `C:\Python311\python.exe` → 兜底用系统 `python`（可能是 WindowsApps 占位符 stub，无法运行）。
2. **启动命令**（`启动网盘.bat:15`）：`server.py --serve auto --port 8443 --token transfer`，即 CLI 模式：根目录 `auto`（全部固定磁盘）、HTTPS 端口 8443、固定 token `transfer`（重启后链接不变）。
3. **崩溃自动重启**（`启动网盘.bat:13-20`）：服务的每次退出（含崩溃）都会在 30 秒后自动重启，形成一个 `:loop` 循环；关闭窗口即彻底停止。

### 4.2 CLI 直接启动

`python server/server.py --serve [根目录|auto] --port <端口> --token <token>`（参数解析见 `server.py:3611-3622`）。启动后打印 HTTPS 访问 URL（IPv6 + 127.0.0.1）、HTTP 免证书 URL（端口+1）、根目录与打包格式，Ctrl+C 停止。`--serve` 缺省值 `auto` = 整机所有固定磁盘；也可传单个根目录（如 `D:\资料`）。

### 4.3 MCP 模式（AI 客户端）

`.mcp.json` 定义 `transfer-mcp`：`command: python`，`args: [${CLAUDE_PLUGIN_ROOT}/server/server.py]`，并设置 `PYTHONUNBUFFERED=1`、`PYTHONIOENCODING=utf-8`。**不带 `--serve` 参数运行即进入 MCP 模式**（`server.py:3619-3622`），通过 stdin/stdout 行式 JSON-RPC 与 Claude 宿主通信，暴露 4 个工具：

| 工具 | 参数 | 作用 |
|---|---|---|
| `drive_start` | `root`（默认 "auto"）、`port`（默认 8443） | 启动服务，返回 URL/打包格式（`server.py:3475`） |
| `drive_pin` | `paths`（绝对路径数组） | 把文件/目录置顶到网页显著位置（`server.py:3499`） |
| `drive_status` | 无 | 查询运行状态/根目录/URL（`server.py:3552`） |
| `drive_stop` | 无 | 停止服务并清理防火墙规则（`server.py:3571`） |

## 5. 服务端架构与模块（server.py）

### 5.1 核心类

- **`_DriveServer(ThreadingHTTPServer)`**（`server.py:1306`）：`AF_INET6` 地址族 + 关闭 `IPV6_V6ONLY`（`server_bind`，`server.py:1316-1323`）实现**双栈监听**——`[::]` 同时接受 IPv4-mapped 连接，手机/本机 IPv4 均可达；`daemon_threads=True`。持有 `roots`（允许根目录列表）、`token`、`pinned`（置顶列表）。
- **`_DriveHandler(BaseHTTPRequestHandler)`**（`server.py:116`）：`protocol_version = "HTTP/1.1"`（便于 `<video>` 复用连接做 Range 分片）。核心方法：
  - `_send_json` / `_send_html` / `_send_error_page`（`server.py:122/131/175`）：统一响应封装；错误页为友好 HTML（403）
  - `_send_static`（`server.py:140`）：静态资源服务，**白名单 + basename 双重校验**（详见第 10 节）
  - `_send_file_range`（`server.py:195`）：统一 Range 断点续传下载，支持 `bytes=a-b` / `bytes=a-` / `bytes=-suffix`，非法越界返回 416；无会话状态，token 在 URL 里所以**换 IP 可续传**
  - `_resolve`（`server.py:283`）：路径越界校验——绝对化 + realpath + `commonpath` 前缀匹配 roots，越界返回 None
  - `_resolve_share_path`（`server.py:302`）：分享根内校验（多文件分享走白名单精确匹配、虚拟分享双向命中）
  - `_handle_share`（`server.py:611`）：`/s/<share_token>/...` 分享路由（见第 6.2 节）
  - `_handle_trans_api`（`server.py:373`）：视频转码/字幕/预览子路由统一处理（主站与分享页共用，resolve_fn 抽象越界校验）
  - `do_GET`（`server.py:967`）、`do_POST`（`server.py:1256`）：路由表，见第 6 节

### 5.2 关键独立函数/模块

- **磁盘枚举** `_fixed_drives`（`server.py:1415`）：`GetLogicalDrives` + `GetDriveTypeW==DRIVE_FIXED` 枚举固定磁盘。
- **目录列表** `_list_dir`（`server.py:1430`）：scandir，目录在前按名排序；系统噪声文件（DumpStack.log/hiberfil.sys/pagefile.sys/swapfile.sys，`_SYSTEM_NOISE` `server.py:1510`）标记 `locked=True` 前端灰显不可下载；权限错误返回 None。
- **视频元数据** `_video_details`（`server.py:1674`）：ffprobe `-show_format -show_streams` 提取 tag/时长/码率/分辨率/声道等，进程内缓存 key=(realpath,size,mtime)（`server.py:1558`），任何失败静默返回 None；`_parse_comment_meta`（`server.py:1561`）把 comment 标签解析为结构化键值（上传/观看/点赞/标签/作者/类型），`_video_meta`（`server.py:1626`）构建前端详情面板数据。
- **缩略图** `_thumb_path`（`server.py:1863`）：ffmpeg 抽帧第 3 秒（失败回退 0 秒），`scale=360:-2`，缓存 `static/thumbs/<md5(realpath|size|mtime)>.jpg`。
- **打包**：`_find_winrar`（`server.py:1462`）/ `_find_unrar`（`server.py:1480`）多路径探测（支持 `WINRAR_PATH`/`UNRAR_PATH` 环境变量）；`_stream_archive`（`server.py:3105`）WinRAR 出 `.rar` 否则 zipfile 出 `.zip`；`_stream_archive_virtual`（`server.py:3162`）虚拟分享打包（同名复用文件写 `.lnk` 文本条目）。
- **解压**：`_unpack_list`（`server.py:2991`）zip 用 zipfile、rar 用 `UnRAR lb -p-`（GBK 输出）；`_unpack_download`（`server.py:3056`）zip 流式、rar 由 `UnRAR p` 输出。
- **防火墙**：`_add_firewall_rule`（`server.py:3330`）netsh 添加入站规则 `TransferMCP-<port>`，失败返回含修复命令的提示；`_remove_firewall_rule`（`server.py:3354`）停止时删除。
- **URL 生成**：`_public_ipv6`（`server.py:3302`）找非链路本地非 ULA 的 IPv6；`_urls`（`server.py:3316`）HTTPS 链接、`_urls_http`（`server.py:3322`）HTTP 免证书链接（**端口 = HTTPS 端口 + 1**）。
- **证书**：`_ensure_cert`（`server.py:3247`）不存在时生成 let's-encrypt 风格自签名证书（CN/SAN=`drive.local`，RSA-2048，有效期 7 天，SHA256）；`_cert_p12_bytes`（`server.py:3285`）打包 PKCS#12（密码 `1234`，`server.py:3282`，小米等 Android 装 CA 必需）。
- **MCP 工具**：`drive_start/drive_pin/drive_status/drive_stop`（`server.py:3475-3578`），`_under`（`server.py:3581`）做根目录包含校验。

### 5.3 MSE 转码链路（`server.py:1903-2524`）

- **会话模型**：`_trans_sessions` 全局字典，key=`(realpath, q, start_sec, persist)`；每个会话 = 一个常驻 ffmpeg 进程（`_trans_encode_thread`，`server.py:2176`）从 `start_sec` 起**连续**输出 fragmented MP4 到内存缓冲，前端按 offset 顺序拉取拼接（保证 moof 序列号连续）。
- **四档画质** `_TRANS_KEYS`/`_TRANS_QUALITIES`（`server.py:82-83`）：`original`（`-c copy` 快速 remux 不重编码，`_trans_remux_args` `server.py:2168`）/ `high`(1920) / `medium`(1280) / `low`(854)，转码参数为 `libx264 ultrafast/zerolatency + aac + crf27 + keyint 60`（`_trans_args` `server.py:2141`）。
- **会话生命周期**：`_trans_ensure_session`（`server.py:2256`）创建/复用；`persist=False`（MSE 播放与分享页）不落盘完整缓存；`_trans_consume`（`server.py:2351`）按 offset 取数据带 5s 等待上限；`_trans_sweep_loop`（`server.py:2383`）后台线程每 5s 按 `last_client` 空闲超时 30s 回收会话并杀进程。
- **编码器能力探测**：`_ffmpeg_capabilities`（`server.py:1946`）惰性执行 `ffmpeg -encoders` 检查 libx264/aac，防止精简版 ffmpeg 静默失败。
- **MSE codec 契约**：`/api/vinfo` 的 `mseMime`（`_vinfo_mime` `server.py:2114`）——转码档固定 `avc1.640033`（High 5.1）+ 有条件 `mp4a.40.2`；原画档按源编码换算 `avc1.PPCCLL`（`_avc1_from_profile` `server.py:2053`）/ `hvc1`（`_hvc1_from_profile` `server.py:2070`）。
- **原画缓存下载**（`server.py:2527-2692`）：`cache=1` 时按 Range 边播边写"稀疏文件 + 区间集合"（`original.cache` + `original.cache.json`），per-digest 锁串行化合并（`_stream_cached` `server.py:2589`）。
- **缓存容量治理**：`_cache_sweep_loop`（`server.py:2451`）每 600s 执行 `_cache_sweep_once`（`server.py:2406`），transcache 超 2GB 按 mtime 从旧到新删，跳过活动会话的 cfile 与 `.tmp` 文件。

### 5.4 字幕 / 识别 / 预览

- `_subtitle_vtt`（`server.py:2758`）：同目录旁挂字幕（`.srt/.vtt/.ass/.ssa`，`server.py:2696`）优先，其次 ffmpeg 提取内嵌字幕流转 WebVTT；`_srt_to_vtt`（`server.py:2717`）/ `_ass_to_vtt`（`server.py:2729`）格式转换。
- `_asr_transcribe`（`server.py:2817`）：faster_whisper `small` 模型（CPU int8）单例复用 + per-path 锁 + 结果缓存 `<digest>.asr.<lang>.vtt`；语言 ja/en/zh。
- `_vthumbstrip_gen`（`server.py:2899`）：整段横向缩略图条（≤20 帧 tile）缓存 `<digest>.strip.jpg`；`_vframe_gen`（`server.py:2938`）：任意秒单帧预览缓存 `<digest>.f<秒>.jpg`。

### 5.5 后台线程（全部 daemon）

| 线程 | 启动处 | 周期 | 职责 |
|---|---|---|---|
| HTTPS 服务 `serve_forever` | `_start` `server.py:3386` | 常驻 | 8443 |
| HTTP 服务 `serve_forever` | `_start` `server.py:3393` | 常驻 | 8444（被占则降级跳过，不影响 HTTPS） |
| `_trans_sweep_loop` | `_start` `server.py:3398` | 5s | 回收空闲转码会话 |
| `_cache_sweep_loop` | `_start` `server.py:3400` | 600s | 转码缓存磁盘治理 |

## 6. 完整路由 / API 清单

### 6.1 主站路由（前缀 `/transfer/`，token 可变）

**token 前缀保护机制**（`do_GET` `server.py:967-984`）：除 `/s/` 分享路由外，所有主站请求必须满足 `path == "/<token>"` 或以 `"/<token>/"` 开头，否则返回 403 `{"error":"无效 token"}`。**访问 `/transfer`（无尾部斜杠）会 301 重定向到 `/transfer/`**（`server.py:977-984`）——否则页面内相对路径 `static/...` 会被浏览器解析成 `/static/...`（丢失 token 前缀）导致 403。`do_POST` 同理要求 `/<token>/` 前缀（`server.py:1261-1264`）。

| 方法 | 路径 | 参数 | 返回 / 说明 |
|---|---|---|---|
| GET | `/` | - | 主页面 index.html |
| GET | `/static/<name>` | - | 离线静态资源（白名单，见第 10 节） |
| GET | `/api/info` | - | `{roots, pinned, archive_format}`（rar/zip） |
| GET | `/api/list` | `path` | 目录列表 `{path, parent, entries[]}`；无权限 403 + parent 供"返回上级" |
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
| GET | `/api/unpack` | `path` | 压缩包条目列表（zip/rar） |
| GET | `/api/unpackdl` | `archive`、`entry` | 下载压缩包内单个条目 |
| GET | `/dl` | `path` | 通用下载（Range 断点续传，attachment） |
| GET | `/dlzip` | `paths`(竖线分隔) | 多文件打包下载（rar 或 zip，`X-Archive-Format` 头） |
| POST | `/api/upload` | `path` + multipart/form-data | 上传文件到当前目录（cgi.FieldStorage，中文文件名 latin-1→utf-8 修正） |

### 6.2 分享路由（前缀 `/s/<share_token>/`，与主 token 完全隔离）

入口 `_handle_share`（`server.py:611`）：分享 token 不经主 token 校验、不暴露主 token；分享页复用同一份 index.html + app.js（app.js 靠 `location.pathname` 以 `/s/` 开头识别分享模式，`app.js:4`）；所有子请求统一走 `_resolve_share_path` 越界校验。

| 子路径 | 说明 |
|---|---|
| `""`（空） | 分享页 = 主站模板；不存在 404 纯文本；**过期返回 200 过期提示页**（`server.py:946`，不在此删除以便稳定重复访问） |
| `api/info` | 分享信息（root/name/is_dir/expires_at/multi/virtual/files 白名单清单） |
| `api/list` | 目录列表；虚拟分享按虚拟相对路径导航；多文件分享只展示 files 白名单一层；**单文件分享返回单个条目**（防 scandir 抛错，`server.py:756-775`） |
| `api/stat` / `api/vmeta` / `api/lnk` / `api/thumb` / `api/pdf` / `api/read` / `api/unpack` / `api/unpackdl` | 与主站同语义（分享根内校验） |
| `api/stream` / `api/trans` / `api/transstatus` / `api/transdl` / `api/subtitle` / `api/asr` / `api/vthumbstrip` / `api/vframes` / `api/vinfo` | 复用 `_handle_trans_api`，但 **persist=False 不落盘转码缓存**（`server.py:845-853`） |
| `api/sharesub` | 二次分享：`parent` 链继承父分享过期时间（父过期则子视为过期，`_share_expired` `server.py:348`） |
| `dl` / `dlzip` | 分享内下载/打包（虚拟分享走 `_stream_archive_virtual`） |
| `static/*` | 复用主站静态白名单 |
| `api/pin` / `api/upload` / `api/cert` / `api/certp12` / `api/share` | **分享模式禁用，返回 403**（`server.py:940-943`） |

过期分享其余 API 返回 410 `{"error":"链接已过期"}`（`server.py:644`）；创建新分享时顺带清理过期 token（`server.py:1119-1121`）。

### 6.3 MCP 协议层（mcp_stdio.py）

- JSON-RPC 2.0 行协议（stdin 读请求 / stdout 写响应，**日志走 stderr**，`mcp_stdio.py:92-101`）；UTF-8 强制（`reconfigure`，`mcp_stdio.py:182-186`，解决 Windows GBK 管道问题）。
- 支持方法：`initialize`（协议版本协商，支持 2025-06-18/2025-03-26/2024-11-05，`mcp_stdio.py:22-23`）、`notifications/initialized`、`ping`、`tools/list`、`tools/call`；不支持批量请求；响应 `isError=true` 时把错误作为文本内容返回给模型（`ToolError`，`mcp_stdio.py:33-39/151-152`）。

## 7. 前端功能清单（index.html + app.js）

入口 `init()`（`app.js:1361`）：分享模式隐藏主站 UI（磁盘/置顶/打包/上传，`hideMainUi` `app.js:1352`）只读浏览分享根；主站模式加载磁盘/置顶并**从 localStorage 恢复上次目录与视图**。

| 功能 | 说明 | 位置 |
|---|---|---|
| 磁盘标签页 | 顶部横向滚动胶囊按钮，点击切换磁盘根 | `renderDriveTabs` `app.js:1429` |
| 面包屑 + 后退/前进 | 分段导航；栈式前进后退（`_pushNav` `app.js:1545`） | `renderBreadcrumb` `app.js:1475` |
| 列表/网格视图 | 网格视图视频显示 ffmpeg 缩略图封面（失败回退图标）；视图偏好持久化 | `app.js:1559-1601` |
| 置顶（星标） | 列表/网格行内 ☆ 切换；置顶卡片区提供下载/分享/取消；"打包 .rar 下载"与"全部分享"按钮 | `renderPinned` `app.js:1448` |
| 上传 | 多文件顺序上传 + 进度条；分享模式无此按钮 | `app.js:1745-1770` |
| 下载 | 非预览类型直接跳 `/dl`；统一 `dlUrl()`（`app.js:40`） | `bindRowAction` `app.js:1695` |
| 视频播放器 | 画质选择（原画/高清/标清/低清）、**MSE 免证书模式**、缓存下载开关、字幕（track/overlay）、ASR 识别（语言切换）、进度条悬停预览（缩略图条 + 单帧 80ms 防抖）、视频详情面板（标题/作者/类型/统计/标签/技术徽章）、原画→高清自动降级 | `showVideo` `app.js:296` |
| 文本/Markdown 预览 | 内置 Markdown 渲染器（转义后套格式防 XSS，`renderMarkdown` `app.js:1086`）；代码高亮（≤200KB 用 hljs，超大分片渲染）；大文本分片渲染 + 取消；400KB 截断提示 | `showText` `app.js:1177` |
| CSV 预览 | 简易引号感知解析器；前 300KB / 2000 行上限 | `showCsv` `app.js:1851` |
| PDF 预览 | iframe 内联 + 新窗口兜底链接 | `showPdf` `app.js:1916` |
| 压缩包解压预览 | 条目列表（≤5000 条），点击条目直接下载 | `showUnpack` `app.js:1278` |
| .lnk 快捷方式 | 显示目标、进入目标目录/下载原文件 | `showLnk` `app.js:1941` |
| 分享链接 | 单文件/目录（`showShareDialog` `app.js:1994`）、全部置顶（`showShareManyDialog` `app.js:2058`）、分享页内二次分享（`showSubShareDialog` `app.js:2119`）；有效期 1/24/72/168 小时；复制/打开链接 |
| 状态恢复 | localStorage `drive.cur/drive.root/drive.view/drive.modal`；弹窗加入浏览器历史（手机返回键关弹窗不退出）；分享模式不读写主站键 | `saveDriveState` `app.js:1807` |
| 错误处理 | 无权限目录显示"返回上级"按钮；token 校验失败 403 JSON 提示 | `showAlert` `app.js:62` |

**页面细节**：`index.html:7` 有 `<link rel="icon" href="data:,">` 消除 favicon 请求（避免 403 干扰）；品牌色覆盖 Bootstrap primary 为 `#2563eb`（`index.html:12-15`）；手机端触控目标 ≥44px（`index.html:123-127`）。

## 8. 数据与状态

| 数据 | 位置 | 格式 / 说明 |
|---|---|---|
| 自签名证书 | `~/.transfer-mcp/server.crt` + `server.key` | PEM，RSA-2048，7 天有效期，缺失时自动生成（`server.py:57-59, 3247`） |
| 分享记录 | `~/.transfer-mcp/shares.json` | `{token: {root, is_dir, expires_at, created_at, name, [files, virtual, nodes, parent]}}`；写临时文件再 rename 防损坏（`_save_shares` `server.py:2975`）；**模块加载即恢复**（跨进程重启链接仍有效，`server.py:2988`） |
| 转码/原画缓存 | `~/.transfer-mcp/transcache/<sha256(realpath)>/` | 转码档 `<digest>.<q>.mp4`、原画稀疏缓存 `original.cache`(+`.json`)、缩略图条 `strip.jpg`、单帧 `f<秒>.jpg`、ASR `<digest>.asr.<lang>.vtt`；总容量上限 2GB 按 mtime 清理（`server.py:75-80`） |
| 视频缩略图 | `static/thumbs/<md5(realpath\|size\|mtime)>.jpg` | ffmpeg 抽帧，文件变化自动失效（`server.py:1863-1888`） |
| 置顶列表 pinned | 仅内存（`_DriveServer.pinned` / `_state["pinned"]`） | **重启即丢失**；由 MCP `drive_pin` 或网页星标维护 |
| 前端状态 | 浏览器 localStorage | `drive.*` 键，见第 7 节 |
| 视频元数据缓存 | 进程内存 `_video_details_cache` | key=(realpath,size,mtime)，ffprobe 失败也缓存 None（`server.py:1558`） |

## 9. 配置与常量

| 常量 | 值 | 位置 |
|---|---|---|
| `VERSION` | "3.0.0" | `server.py:55` |
| `DEFAULT_PORT` | 8443（HTTP 免证书端口 = port+1 = 8444） | `server.py:56` |
| `CERT_DIR` / 证书/私钥 | `~/.transfer-mcp/` / server.crt / server.key | `server.py:57-59` |
| `FFPROBE` / `FFMPEG` | `C:\Users\user\ffmpeg\bin\ffprobe.exe` / 同目录 ffmpeg.exe | `server.py:70-72` |
| `TRANSCACHE_DIR` | `~/.transfer-mcp/transcache` | `server.py:75` |
| `TRANS_IDLE_TIMEOUT` | 30s（转码会话空闲回收） | `server.py:76` |
| `TRANS_WAIT_SEC` | 5s（trans 拉取等待上限） | `server.py:77` |
| `TRANS_CHUNK` | 512KB（前端单次期望分片） | `server.py:78` |
| `TRANSCACHE_MAX_BYTES` | 2GB（缓存清理阈值） | `server.py:79` |
| `_CACHE_SWEEP_INTERVAL` | 600s（缓存治理周期） | `server.py:80` |
| 画质目标宽度 | high=1920 / medium=1280 / low=854 | `server.py:82` |
| 分享有效期选项 | 1 / 24 / 72 / 168 小时 | `server.py:95` |
| 证书有效期 | 7 天（前后 5 分钟缓冲） | `server.py:3261` |
| `CERT_P12_PASSWORD` | "1234" | `server.py:3282` |
| 静态资源白名单 | bootstrap.min.css / bootstrap.bundle.min.js / app.js / highlight.min.js / highlight.min.css + icons/*.svg | `server.py:64-67` |
| 文本预览默认/上限 | 默认 1MB，钳制 16KB~4MB | `server.py:1806-1819` |
| 转码输出 | H.264 High 5.1 (avc1.640033) + aac 128k，crf 27，keyint 60，fMP4 | `server.py:2141-2165` |
| 防火墙规则名 | `TransferMCP-<port>` | `server.py:3331` |
| MCP 首选协议 | 2025-06-18 | `mcp_stdio.py:22` |

## 10. 已知限制与注意事项

- **token 前缀保护**：所有主站 API 必须带 `/transfer/` 前缀（`server.py:973-975`），否则 403；`/transfer` 无斜杠会 301 到 `/transfer/`（`server.py:977-984`）。分享路由 `/s/` 独立于主 token，二者互不暴露。
- **路径越界校验**：`_resolve`（`server.py:283`）用 `realpath + commonpath` 保证请求路径必在 roots 内（防符号链接逃逸）；分享用 `_resolve_share_path`（`server.py:302`），多文件分享是**白名单精确匹配**而非前缀匹配——父目录路径访问未分享文件会被拒绝。
- **静态资源白名单**：`_send_static`（`server.py:140`）只允许顶层 5 个指定文件与 `icons/*.svg`，basename + 无斜杠双重校验，杜绝路径穿越。
- **`cgi` 模块弃用警告**：`server.py:20` 导入 `cgi`（Python 3.13 起弃用，3.15 移除），上传用 `cgi.FieldStorage` 解析 multipart（`server.py:1278`）；未来需替换为手写 multipart 解析。
- **HTTP 明文端口（8444）**：仅用于手机打不开自签名证书页面时的局域网兜底，明文传输，仅限可信网络（启动提示已注明）。
- **只读为主 + 上传**：服务不能删除/修改服务器端已有文件，只能上传到当前目录；分享模式连上传也禁用。
- **权限受限目录**：无权限目录返回 403 且前端提示"返回上级"；浏览受系统保护目录需以管理员身份运行。
- **firewall 规则**：添加入站规则需要管理员权限，失败时启动输出会给出手工执行命令（`server.py:3330-3351`）。
- **pinned 不持久化**：置顶列表只存内存，服务进程重启即清空。
- **转码依赖**：MSE 转码/字幕提取/缩略图条/单帧都需要完整版 ffmpeg（含 libx264/aac，`_ffmpeg_capabilities` 会明确报缺哪些编码器）；ffprobe 缺失时视频元数据静默降级。
- **转码缓存占用**：MSE 播放默认只在内存缓冲（不落盘），但主站 start=0 的持久会话与"缓存下载"会写 transcache（上限 2GB 自动清理）；分享页播放**永不落盘**，避免占用分享者磁盘。
- **favicon**：`index.html:7` 用 `<link rel="icon" href="data:,">` 消除 favicon 请求，避免其落进 token 前缀外产生 403 噪音。
- **Windows 编码**：Rar.exe/UnRAR.exe 输出按 cp936 解码（`server.py:3128/3023`）；MCP stdio 强制 UTF-8（`mcp_stdio.py:182-186`）；前端上传中文文件名做 latin-1→utf-8 修正（`server.py:1288-1291`）。
- **大文件预览**：`/api/read` 默认只读前 1MB（前端再截断 400KB 渲染、CSV 300KB/2000 行、压缩包列表 5000 条），完整内容需下载。