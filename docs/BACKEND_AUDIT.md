# 后端扫描审计报告（任务 t1）

- 扫描对象：`server\server.py`（共 5325 行）、`server\mcp_stdio.py`（共 240 行）
- 扫描方式：read 分页全文通读（server.py 分 5 段：1-1103 / 1104-2214 / 2215-3498 / 3499-4746 / 4747-5325），行号均按实际文件核对
- 定位：`C:\Users\user\Desktop\Other\远程电脑文件访问服务`

---

## 文件概况

| 文件 | 行数 | 职责 |
|---|---|---|
| server\server.py | 5325 | 网盘服务全部后端：HTTP 服务器、路由、文件浏览/上传/下载、视频转码、打包、分享、证书、MCP 工具、CLI |
| server\mcp_stdio.py | 240 | 零依赖 MCP stdio 桥（JSON-RPC 2.0，tools-only） |
| server\templates\index.html | — | 主站前端模板（每次请求读盘支持热更新） |
| server\templates\view.html | — | 独立预览页模板（T18） |
| static\app.js | — | 前端逻辑（本审计不覆盖，见 FRONTEND_AUDIT.md） |

server.py 的顶层模块 docstring 自称 "drive-mcp v3"，`VERSION="3.0.0"`（L62）。

---

## ① 类/函数清单

### 类（5 个，含 mcp_stdio）

| 行号 | 类 | 基类 | 职责 |
|---|---|---|---|
| 133 | `_DriveHandler` | `BaseHTTPRequestHandler` | HTTP 请求处理器：do_GET/do_POST 路由分发、全部响应助手、分享子路由、视频转码子路由。`protocol_version="HTTP/1.1"`（L135，支持 Range 复用连接） |
| 1558 | `_DriveServer` | `ThreadingHTTPServer` | 线程化服务器。`address_family=AF_INET6`（双栈）、`daemon_threads=True`、`allow_reuse_address=False`（防双实例抢端口）；`get_request` 首字节嗅探实现单端口 TLS/明文双协议；`server_bind` 关 IPV6_V6ONLY |
| 4189 | `_ArchiveAborted` | `Exception` | 打包任务取消信号，工人线程收敛到 aborted 状态 |
| 33 | `ToolError`（mcp_stdio） | `Exception` | MCP 工具干净失败（isError=true 返回给模型，非协议级错误） |
| 41 | `Tool`（mcp_stdio） | — | 工具描述对象：name/description/input_schema/handler/annotations，`spec()` 输出 MCP 规范 |
| 67 | `MCPServer`（mcp_stdio） | — | MCP stdio 服务器：`tool()` 装饰器注册、initialize/tools.list/tools.call/ping 处理、`run()` 主循环 |

### _DriveHandler 方法

| 行号 | 方法 | 职责 |
|---|---|---|
| 139 | `_send_json(obj, code)` | JSON 响应（no-store） |
| 148 | `_send_view_html()` | 独立预览页模板 |
| 157 | `_send_html()` | 主站 index.html 模板 |
| 166 | `_send_static(route)` | 静态资源：白名单+basename 校验防穿越；弱 ETag（mtime+size）+ Last-Modified 回 304 |
| 237 | `_send_error_page(title, detail)` | 下载/打包失败友好 HTML 错误页（403） |
| 257 | `_send_file_range(path, name, attachment, err, ctype)` | 统一 Range 断点续传下载（200/206/416，后缀范围支持）；/dl 与 /api/stream 共用 |
| 341 | `_query()` | 解析 query string → dict |
| 345 | `_resolve(raw)` | 主站路径越界校验：realpath + commonpath 必须落在 server.roots 内 |
| 361 | `_tok()` | 返回 "/" + server.token |
| 364 | `_resolve_share_path(share, raw)` | 分享路径越界校验：根=分享 root（非 server.roots）；多文件分享白名单精确匹配；虚拟分享支持虚拟相对路径 |
| 410 | `_share_expired(share)` | 分享过期判定，沿 parent 链追溯（二次分享父过期则子过期） |
| 435 | `_handle_trans_api(route, q, resolve_fn, persist)` | 视频子路由统一入口：/api/trans、transstatus、transdl、stream、subtitle、asr、vthumbstrip、vframes、vinfo；resolve_fn 抽象主站/分享两种越界校验 |
| 669 | `_send_cached_stream(path, ctype, cache)` | api/stream?cache=1 分支 → `_stream_cached` |
| 673 | `_handle_share()` | /s/<share_token>/ 全部分享路由（页面+API 复用主站逻辑，统一走 _resolve_share_path） |
| 1072 | `_send_share_expired_page()` | 分享过期提示页（200 HTML，非 404） |
| 1093 | `do_GET()` | GET 路由总分发（分享先行，其次 token 校验） |
| 1463 | `do_POST()` | POST 路由：/api/archive、/api/archive/cancel、/api/upload |
| 1549 | `handle_one_request()` | 透传父类（TLS 已在 get_request 包装） |
| 1554 | `log_message(fmt, *args)` | 日志写 stderr |

### _DriveServer 方法

| 行号 | 方法 | 职责 |
|---|---|---|
| 1566 | `__init__(addr, handler, roots, token, ssl_context)` | 挂 roots/token/pinned/ssl_context 到实例 |
| 1573 | `get_request()` | 首字节嗅探：0x16（TLS ClientHello）→ wrap_socket；否则按明文 HTTP 处理（单端口双协议核心） |
| 1603 | `server_bind()` | 关 IPV6_V6ONLY 双栈监听 |

### 模块级函数（server.py，按出现顺序）

| 行号 | 函数 | 职责 |
|---|---|---|
| 112 | `_load_index_html()` | 读主模板，失败返回占位页 |
| 121 | `_load_view_html()` | 读预览模板，失败返回占位页 |
| 1616 | `_parent_of(path, roots)` | 上级路径；根内返回该根（"返回上级"用） |
| 1629 | `_is_ancestor(a, b)` | realpath 祖先判定（含相等） |
| 1637 | `_build_virtual_nodes(files)` | 多文件分享构建"虚拟相对路径→真实路径"映射（含去重/重名后缀/递归展开，深度≤64） |
| 1702 | `_fixed_drives()` | ctypes GetLogicalDrives 枚举固定磁盘，失败回退 ["C:\\"] |
| 1717 | `_dir_denied(path)` | 目录不可读轻量检测（Windows scandir 首条试探 vs POSIX os.access） |
| 1739 | `_is_hidden_entry(name, st)` | 隐藏判定：点/波浪号前缀；HIDDEN 属性；SYSTEM 属性永不隐藏 |
| 1753 | `_list_dir(path, show_hidden)` | 列目录：目录在前按名排序；locked（系统噪声文件）/denied 标记；权限错误返回 None |
| 1814 | `_preview_kind(path)` | 预览类型：video>pdf>markdown>csv>text>archive>lnk |
| 1836 | `_stat_file(path)` | 文件/目录详情（含 preview 类型与视频 details） |
| 1861 | `_parse_comment_meta(comment)` | 视频 comment 标签解析为结构化元数据（key_map 中英日键归一、tags/notes/extra 拆分） |
| 1956 | `_norm_field(norm, val)` | rating/episodes 数值归一化 |
| 1979 | `_video_meta(out, path)` | 构建结构化展示 meta（title/author/type/tech 徽章等） |
| 2035 | `_video_details(path)` | ffprobe 提取视频元数据（10s 超时；任何失败返回 None；结果入进程缓存） |
| 2195 | `_video_meta_cached(path)` | meta=1 专用：只读缓存，绝不触发 ffprobe |
| 2237 | `_probe_video_meta(paths)` | 并发探测未命中缓存视频（8 worker、3s 预算、互斥跳过、后台写缓存） |
| 2262 | `_augment_entries_meta(entries, real_map)` | api/list?meta=1 附加 kind/mime/视频尺寸字段 |
| 2295 | `_detect_bom(raw)` | BOM 识别（utf-32/8/16le/16be） |
| 2324 | `_has_binary_magic(raw)` | 魔数判定（zip/png/pdf/elf/exe/ftyp/RIFF 等） |
| 2340 | `_looks_binary(raw)` | 魔数 + 空字节比例>3% 双保险 |
| 2346 | `_detect_utf16_nobom(raw)` | 无 BOM UTF-16 启发式（CRLF 线索+奇偶统计，兼容混合编码） |
| 2376 | `_smart_decode(raw, fallback_errors)` | 通用解码：BOM→UTF-16→utf-8→gbk→big5→gb18030→latin-1（含假名率判 big5） |
| 2410 | `_read_text(path, limit)` | 文本预览：编码识别 + 二进制拦截 + truncation |
| 2469 | `_parse_read_limit(q, default)` | limit 参数解析（钳制 16KB~4MB） |
| 2485 | `_lnk_target(path)` | PowerShell COM 解析 .lnk 目标（UTF-8 输出强制、单引号转义、20s 超时） |
| 2535 | `_thumb_path(path)` | 视频缩略图：md5(realpath\|size\|mtime).jpg 缓存于 static/thumbs；ffmpeg 抽帧（-ss 3 回退 0） |
| 2588 | `_trans_digest(path)` | sha256(realpath) 缓存目录名 |
| 2596 | `_trans_dir(path)` | transcache/<digest>/ 目录（不存在则建） |
| 2606 | `_trans_cache_file(path, q)` | 转码档完整缓存文件路径 |
| 2618 | `_ffmpeg_capabilities()` | 惰性探测 libx264/aac 编码器（5s 超时，结果缓存） |
| 2652 | `_video_src_info(path)` | ffprobe 读源视频宽高/时长/旋转/编码（15s 超时） |
| 2725 | `_avc1_from_profile(profile, level)` | h264 profile/level → avc1.PPCCLL 串 |
| 2742 | `_hvc1_from_profile(profile, level)` | h265 → hvc1.* 串（best-effort） |
| 2764 | `_audio_codec_part(codec)` | 音频 codec → MSE codec 串（aac→mp4a.40.2，mp3→mp4a.6B） |
| 2774 | `_original_video_codec(info)` | 原画档 codec 构造 |
| 2786 | `_vinfo_mime(info, quality)` | 按契约构造 mseMime（转码档固定 avc1.640033） |
| 2803 | `_trans_resolution(src_w, q)` | 目标宽度（低于目标用源宽） |
| 2813 | `_trans_args(src_path, q, start_sec, resolution)` | fMP4 转码命令（libx264 High/ultrafast/zerolatency/crf27，frag_keyframe+empty_moov） |
| 2840 | `_trans_remux_args(src_path, start_sec)` | 原画免证书：-c copy 快速转封装 fMP4 |
| 2848 | `_trans_encode_thread(sess, src_path, q, resolution)` | 常驻转码线程：ffmpeg 输出→内存缓冲（未消费>16MB 节流）+ 可选落盘缓存文件 |
| 2912 | `_session_gc(session)` | 标记会话过期并 terminate/kill 残存进程 |
| 2928 | `_trans_ensure_session(path, q, start_sec, persist)` | 获取/创建转码会话；persist=False（分享/MSE）不落盘；已消费缓冲的会话重建 |
| 2982 | `_trans_ensure_remux(path, start_sec)` | 原画 remux 会话（不落盘，源即完整文件） |
| 3023 | `_trans_consume(sess, offset, need)` | 按 offset 顺序消费缓冲（修正乱序、等待产出、刷新 last_client），返回 (data, finished, new_offset) |
| 3055 | `_trans_sweep_loop(_interval=5)` | 后台线程：按 last_client 空闲>30s 回收转码会话 |
| 3078 | `_cache_sweep_once()` | 转码缓存磁盘治理：总量>2GB 按 mtime 删最旧（跳过活动会话 cfile 与 *.tmp） |
| 3123 | `_cache_sweep_loop(interval=600)` | 后台线程：周期缓存清理（启动先跑一次） |
| 3133 | `_trans_available(path)` | 可用画质列表（缓存文件存在即可用；original 恒可用） |
| 3147 | `_trans_ready(path, q)` | 转码档就绪判定（persist 会话 done 才算，防半成品误报） |
| 3168 | `_trans_progress_estimate(path, q, sess)` | 进度估算（cfile 大小/源大小近似） |
| 3208 | `_original_cache_lock(path)` | per-digest 原画缓存写锁（进程内） |
| 3219 | `_original_cache_path(path)` | 原画缓存文件路径（transcache/<digest>/original.cache） |
| 3224 | `_original_cache_state(path)` | 读缓存区间集合（json，损坏重置） |
| 3235 | `_original_cache_save(path, ranges)` | 写区间集合（tmp+rename） |
| 3247 | `_original_cache_merge(ranges, start, end)` | 闭区间合并 |
| 3261 | `_stream_cached(handler, path, name, ctype, cache)` | 带原画缓存代理的 Range 流（cache=1 写缓存） |
| 3306 | `_resolve_segment(target, remaining, ranges)` | 按缓存区间切分读段（缓存读/源读） |
| 3318 | `_stream_cached_locked(handler, path, cp, fsize, start, chunk, ctype)` | 锁内"读区间→源/缓存→写缓存→merge→save" |
| 3372 | `_subtitle_path(path)` | 旁挂字幕查找（srt/vtt/ass/ssa） |
| 3382 | `_webvtt_cue(text)` | 去 HTML 标签 + 转义 |
| 3389 | `_srt_to_vtt(src)` | SRT→WebVTT |
| 3401 | `_ass_to_vtt(src)` | 极简 ASS→WebVTT（[Events] Dialogue 行） |
| 3421 | `_ass_tc(tc)` | ASS 时间码→WebVTT |
| 3430 | `_subtitle_vtt(path)` | 字幕获取：旁挂优先，其次 ffmpeg 内嵌提取 |
| 3459 | `_asr_available()` | 检测 faster_whisper 是否安装 |
| 3468 | `_asr_vtt_cached(path, lang)` | ASR 结果缓存路径 |
| 3479 | `_asr_path_lock(path)` | per-path 转写锁 |
| 3490 | `_asr_transcribe(path, lang)` | faster_whisper 转写→WebVTT（模型单例 + 结果落盘缓存） |
| 3538 | `_asr_segment_vtt(seg)` | segment→cue 文本 |
| 3546 | `_fmt_srt_time(t)` | 秒→HH:MM:SS.mmm |
| 3559 | `_vthumbstrip_path(path)` | 缩略图条缓存路径 |
| 3564 | `_vthumbstrip_meta(path)` | tile 数与源时长（未知时 n=10, dur=0） |
| 3572 | `_vthumbstrip_gen(path)` | ffmpeg 生成横向缩略图条（最多约 20 帧） |
| 3606 | `_vframe_path(path, t)` | 单帧预览缓存路径 |
| 3611 | `_vframe_gen(path, t)` | ffmpeg seek 抽单帧 |
| 3636 | `_load_shares()` | 从 shares.json 加载分享表（模块加载时执行，L3661） |
| 3648 | `_save_shares()` | 写回 shares.json（tmp+rename） |
| 3664 | `_fix_zip_name(name)` | ZIP GBK 中文名修复（cp437→gbk，安全策略校验） |
| 3686 | `_archive_fmt(path)` | 压缩格式识别 zip/tar/7z/rar/unsupported |
| 3707 | `_fix_tar_name(name)` | tar GBK 名修复（代理字符→gbk 重解码） |
| 3750 | `_find_tool(paths, names)` | 外部工具探测：常量列表→%ProgramFiles%→PATH |
| 3773 | `_find_7z()` | 找 7z.exe/7zz.exe |
| 3777 | `_find_winrar()` | 找 WinRAR/UnRAR/Rar.exe |
| 3781 | `_decode_cmd(data)` | 命令输出解码（utf-8→gbk 回退） |
| 3791 | `_hier_level(raw, prefix, fmt)` | 扁平条目按 prefix 归并成层级（隐含目录推断） |
| 3826 | `_unpack_zip(path, dir)` | zip 条目列表 |
| 3840 | `_unpack_tar(path, dir)` | tar 条目列表（tarfile r:* 自动识别压缩） |
| 3861 | `_seven_entry(fields)` | 7z l -slt 记录解析 |
| 3877 | `_seven_list(tool, path)` | 7z 技术列表（-sccUTF-8，300s 超时） |
| 3906 | `_unpack_winrar(tool, path, dir, fmt)` | WinRAR lb 裸列表备选 |
| 3926 | `_unpack_seven(path, dir, fmt)` | rar/7z 预览入口（7-Zip 优先，WinRAR 备选） |
| 3942 | `_unpack_list(path, dir)` | 压缩包列表总入口 |
| 3958 | `_range_unsatisfiable(handler, fsize)` | 416 + Content-Range: bytes */total |
| 3969 | `_seven_entry_size(tool, archive, entry)` | 7z 单条目大小/目录标记（下载 Content-Length 用） |
| 4006 | `_dl_zip(handler, archive, entry, disp)` | zip 条目流式下载 |
| 4033 | `_dl_tar(...)` | tar 条目流式下载 |
| 4060 | `_dl_7z(...)` | 7z e -so 流式下载（size 未知时 close-delimited） |
| 4109 | `_dl_winrar(...)` | WinRAR 备选下载（解压到临时目录后发送） |
| 4143 | `_unpack_download(handler, archive, entry)` | 压缩包内单条目下载总入口 |
| 4194 | `_build_archive_items(paths)` | 选中路径→(arcname, realpath) 列表（realpath 去重） |
| 4228 | `_scan_plan(items)` | 递归扫描打包清单（visited+depth 防循环、junction 目录跳过、skipped 记录） |
| 4332 | `_write_entry_chunked(zf, task, arcname, rpath)` | 任务模式分块写 zip（进度/取消/与 zf.write 字节一致） |
| 4363 | `_write_zip_entries(zf, plan, dirs, task, skipped)` | 写 zip：目录条目+文件条目；task=None 同步模式逐文件预检 |
| 4410 | `_stream_archive(handler, items, mode)` | 统一同步打包核心（信号量 2、临时空间预检、跳过清单头） |
| 4499 | `_archive_tmp_path(task_id)` | 后台任务 zip 固定临时路径（tk_<id>.zip） |
| 4504 | `_archive_rm_tmp(task_id)` | 删任务临时 zip |
| 4512 | `_archive_delete_task(task)` | 从任务表删除+清理临时文件 |
| 4518 | `_archive_sweep_tmp()` | 启动清扫历史 tk_*.zip 残留 |
| 4535 | `_archive_new_task(paths, mode)` | 创建后台打包任务（去重保序、排队上限 6、启动工人线程） |
| 4599 | `_archive_worker(task)` | 打包工人：queued→scanning→compressing→ready；取消→aborted；异常→failed；必释放信号量 |
| 4665 | `_archive_task_light(task, full)` | 轻量任务快照（full 带完整 skipped） |
| 4688 | `_archive_poll_cleanup()` | 惰性清理：TTL>30min 删除/取消 + 超 16 条逐出最旧终态 |
| 4716 | `_archive_preview(path)` | 打包预览统计（child_count/child_bytes） |
| 4744 | `_archive_dl(handler, task)` | 任务 zip 流式投递（downloading→done；断连回滚 ready；取消即删） |
| 4808 | `_cert_san()` | 证书 SAN：DNS 名 + 本机全部 IP（含公网 IPv6） |
| 4831 | `_cert_needs_rebuild()` | 证书缺失/过期/SAN 无 IP 需重建 |
| 4851 | `_ensure_cert()` | RSA 2048 自签证书生成（7 天有效期） |
| 4889 | `_cert_p12_bytes()` | 私钥+证书打包 PKCS#12（Android 安装用） |
| 4906 | `_public_ipv6()` | 枚举公网 IPv6 |
| 4920 | `_private_ipv4()` | 枚举私网 IPv4（UDP 假连接取默认路由网卡） |
| 4951 | `_urls(port, token)` | https 访问 URL 列表 |
| 4958 | `_urls_http(port, token)` | http 免证书 URL 列表 |
| 4966 | `_add_firewall_rule(port)` | netsh 添加入站防火墙规则（TransferMCP-<port>） |
| 4990 | `_remove_firewall_rule(port)` | 删除防火墙规则 |
| 5001 | `_start(root, port, token)` | 服务启动：启动清扫→根目录解析→证书→TLS 上下文→server→三个后台线程→防火墙规则 |
| 5054 | `_stop()` | 停止服务 + 清理防火墙规则 |
| 5088/5108 | `drive_start(root, port)` | MCP 工具：启动服务 |
| 5112/5131 | `drive_pin(paths)` | MCP 工具：置顶（校验根内/存在性/去重） |
| 5165/5171 | `drive_status()` | MCP 工具：查询状态 |
| 5185/5191 | `drive_stop()` | MCP 工具：停止 |
| 5195 | `_under(root, path)` | commonpath 根内判定（drive_pin 用） |
| 5205 | `_system_proxy_hint(port)` | 检测 Windows 系统代理，提示 502 风险 |
| 5228 | `_cli_bind_retry(root, port, token, attempts=3)` | bind 失败（10048/被占用）3 秒间隔重试 3 次 |
| 5250 | `_http_probe_ok(port, token)` | 本地自探测 /api/info（任一 HTTP 响应即健康） |
| 5263 | `_start_watchdog(port, token)` | 看门狗线程：连续 3 次探测失败 os._exit(2) 交启动脚本重启 |
| 5283 | `_cli_serve(root, port, token)` | CLI 模式主流程（打印 URL、自检、看门狗、Ctrl+C 停止） |
| 5314 | `__main__` | argparse：--serve [根目录] / --port / --token；否则 server.run()（MCP 模式） |

### mcp_stdio.py 函数/常量

| 行号 | 名称 | 职责 |
|---|---|---|
| 22-23 | `PREFERRED_PROTOCOL` / `SUPPORTED_PROTOCOLS` | MCP 协议版本协商（2025-06-18 主推） |
| 26-30 | `PARSE_ERROR` 等 | JSON-RPC 错误码 |
| 93 | `MCPServer._log(msg)` | 诊断写 stderr（stdout 留给 JSON-RPC 帧） |
| 99 | `MCPServer._write(payload)` | stdout 写单行 JSON |
| 103 | `MCPServer._result(req_id, result)` | 成功响应 |
| 106 | `MCPServer._error(...)` | 错误响应 |
| 114 | `_handle_initialize` | initialize 协商协议版本 |
| 129 | `_handle_tools_list` | tools/list |
| 132 | `_handle_tools_call` | tools/call：ToolError→isError；TypeError→参数提示；兜底异常→isError+日志 |
| 177 | `run()` | 主循环：UTF-8 重配置 stdio→逐行 JSON-RPC 分发（支持 notifications、拒绝 batch） |
| 232 | `_as_content(value)` | 返回值规范化 MCP content blocks（str/None/json） |

---

## ② HTTP 路由表

### 主站 GET（全部要求路径以 `/<token>` 为前缀，L1099-1102 校验；token 无斜杠根路径 301 重定向到加斜杠，L1105）

| 路由 | 行号 | 功能 |
|---|---|---|
| `/` | 1115 | 返回主站 index.html |
| `/view` | 1117 | 独立预览页（校验 path 越界） |
| `/static/*` | 1124 | 静态资源（白名单，L166） |
| `/api/info` | 1127 | 服务信息：roots/pinned/archive_format/urls/urls_http |
| `/api/list` | 1136 | 列目录（show_hidden、meta=1 附加元数据） |
| `/api/pin` | 1158 | 置顶管理（add/remove/clear=1 清空） |
| `/api/stat` | 1179 | 文件/目录详情 |
| `/api/vmeta` | 1186 | 视频结构化元数据 |
| `/api/lnk` | 1194 | .lnk 快捷方式目标解析 |
| `/api/thumb` | 1201 | 视频缩略图（ffmpeg 抽帧，缓存 static/thumbs） |
| `/api/pdf` | 1227 | PDF 内联预览（强制 application/pdf） |
| `/api/img` | 1234 | 图片内联预览（按扩展名 MIME） |
| `/api/share` | 1244 | 创建分享（单文件/目录或 ?paths= 多文件虚拟分享；hours∈{1,24,72,168}） |
| `/api/stream` | 1334 | 视频流（Range；cache=1 边播边写原画缓存） |
| `/api/trans` | 1334 | MSE 转码分片拉取（q=original/high/medium/low，offset/need/start） |
| `/api/transstatus` | 1334 | 转码状态/进度 |
| `/api/transdl` | 1334 | 转码档下载（未就绪 409+进度） |
| `/api/subtitle` | 1334 | 字幕 WebVTT（旁挂/内嵌） |
| `/api/asr` | 1334 | faster_whisper 语音识别（lang=ja/en/zh；未安装 501） |
| `/api/vthumbstrip` | 1334 | 视频缩略图条（X-Strip-N/Duration 头） |
| `/api/vframes` | 1334 | 单帧预览（t 参数） |
| `/api/vinfo` | 1334 | 视频源信息 + MSE mime 契约 |
| `/api/cert` | 1338 | 下载自签证书 .crt（Android 信任用） |
| `/api/certp12` | 1355 | 下载 PKCS#12（含私钥，密码 1234） |
| `/api/read` | 1371 | 文本/Markdown 在线查看（limit 钳制 16KB~4MB） |
| `/api/unpack` | 1378 | 压缩包条目列表（dir 指定包内目录） |
| `/api/unpackdir` | 1385 | 压缩包内子目录条目 |
| `/api/unpackdl` | 1392 | 下载压缩包内单个条目 |
| `/api/archives` | 1400 | 打包中心任务列表（惰性清理触发） |
| `/api/archive` | 1407 | 单任务详情（含完整 skipped） |
| `/api/archive/dl` | 1414 | 任务 zip 原生下载（ready/done 才放行） |
| `/api/archive/preview` | 1421 | 打包预览统计 |
| `/dl` | 1437 | 文件下载（Range 断点续传，attachment） |
| `/dlzip` | 1444 | 打包下载（paths 用 \| 分隔；mode=store/fast/normal） |

### 主站 POST（同样 token 前缀；分享路径 /s/ 直接 403）

| 路由 | 行号 | 功能 |
|---|---|---|
| `/api/archive` | 1474 | 创建后台打包任务（JSON body {paths:[], mode}；队列满 429） |
| `/api/archive/cancel` | 1497 | 取消/删除任务（活任务置取消事件；终态立即删除） |
| `/api/upload` | 1511 | 上传（multipart/form-data；GBK/UTF-8 文件名修复；只写不删改） |

### 分享路由 GET `/s/<share_token>/<sub>`（L673 _handle_share；不校验主 token，token 独立）

| sub | 行号 | 功能 |
|---|---|---|
| ``（空） | 708 | 返回主站 index.html（app.js 识别分享模式） |
| `view` | 712 | 独立预览页 |
| `api/info` | 721 | 分享信息（含多文件/虚拟分享的 files 清单） |
| `api/list` | 757 | 列目录（虚拟分享按虚拟路径导航；多文件分享单层白名单；单文件分享返回单条目） |
| `api/stat` | 883 | 详情 |
| `api/vmeta` | 890 | 视频元数据 |
| `api/lnk` | 898 | lnk 解析 |
| `api/thumb` | 905 | 视频缩略图 |
| `api/pdf` | 931 | PDF 内联 |
| `api/img` | 938 | 图片内联 |
| `api/stream` `api/trans` `api/transstatus` `api/transdl` `api/subtitle` `api/asr` `api/vthumbstrip` `api/vframes` `api/vinfo` | 948 | 视频子路由（persist=False，分享不落转码缓存） |
| `api/read` | 957 | 文本查看 |
| `api/unpack` / `api/unpackdir` | 964/971 | 压缩包浏览 |
| `api/unpackdl` | 978 | 压缩包条目下载 |
| `api/sharesub` | 986 | 二次分享（继承父过期，min 钳制，父过期拒绝） |
| `dl` | 1023 | 分享文件下载 |
| `dlzip` | 1030 | 分享内打包（虚拟分享直接交统一打包核心） |
| `static/*` | 1062 | 静态资源复用 |
| `api/pin` `api/upload` `api/cert` `api/certp12` `api/share` | 1067 | 分享模式禁用 → 403 |

分享不存在 → 404（L690）；分享过期 → 页面 200 过期页 / API 410（L700-707）。

---

## ③ 全局状态 / 线程 / 缓存 / 锁

### 全局状态

| 行号 | 名称 | 类型 | 说明 |
|---|---|---|---|
| 92-93 | `_trans_sessions` / `_trans_sessions_lock` | dict / Lock | MSE 转码会话表，key=(realpath, q, start_sec[, persist]) |
| 95 | `_state` | dict | {server, roots, port, token, pinned} 服务全局状态 |
| 101 | `_shares` | dict | 分享表 token → {root, is_dir, expires_at, created_at, name, files?, virtual?, nodes?, parent?}；持久化 shares.json |
| 1858 | `_video_details_cache` | dict | 视频元数据进程缓存 key=(realpath, size, mtime) |
| 2614-2615 | `_ffmpeg_caps` / `_ffmpeg_caps_lock` | dict / Lock | ffmpeg 编码器能力惰性缓存 |
| 3204-3205 | `_original_cache_locks` / guard | dict / Lock | per-digest 原画缓存写锁池 |
| 3473-3476 | `_asr_model` / `_asr_model_lock` / `_asr_path_locks` / guard | 模型单例 / Lock / dict / Lock | ASR 模型单例 + per-path 转写锁池 |
| 4167 | `_ARCHIVE_SEM` | Semaphore(2) | 打包并发信号量（同步 dlzip 与后台任务共享） |
| 4181-4182 | `_ARCHIVE_TASKS` / `_ARCHIVE_TASKS_LOCK` | dict / RLock | 打包任务表（全局无后台守护，惰性清理） |

### 线程

| 行号 | 线程 | 触发 | 说明 |
|---|---|---|---|
| 5023 | `server.serve_forever` | 每次 _start | HTTP 服务主循环（daemon） |
| 5026 | `_trans_sweep_loop` | 每次 _start | 转码会话空闲回收（5s 周期，30s 空闲超时） |
| 5028 | `_cache_sweep_loop` | 每次 _start | 转码缓存磁盘清理（600s 周期，2GB 上限） |
| 2976/3017 | `_trans_encode_thread` | 每转码会话 | 常驻 ffmpeg 转码（daemon） |
| 4595 | `_archive_worker` | 每后台打包任务 | 打包工人（daemon，排队受信号量） |
| 5279 | `_start_watchdog` 内循环 | CLI 模式 | 假死看门狗（10s 探测，连续 3 次失败 os._exit(2)） |
| 2247 | `ThreadPoolExecutor(8)` | _probe_video_meta | 视频探测并发池（3s 预算，shutdown(wait=False) 后台续写缓存） |
| — | `ThreadingHTTPServer` | 每请求 | daemon_threads=True，每连接一线程 |

### 缓存（进程内 + 磁盘）

| 行号 | 缓存 | 位置/键 | 清理 |
|---|---|---|---|
| 1858 | 视频元数据缓存 | 进程内存 key=(realpath,size,mtime) | 无（随进程） |
| 2535 | 视频缩略图 | static/thumbs/<md5>.jpg | 无 |
| 2588/2596 | 转码缓存目录 | ~/.transfer-mcp/transcache/<sha256(realpath)>/ | _cache_sweep_loop（>2GB 按 mtime 删） |
| 2606 | 转码档完整文件 | <digest>.<q>.mp4 | 同上 |
| 3219 | 原画缓存 | <digest>/original.cache + .json（稀疏文件+区间集合） | 同上（.json 也在清扫范围） |
| 3468 | ASR 结果 | <digest>.asr.<lang>.vtt | 同上 |
| 3559/3606 | 缩略图条/单帧 | <digest>.strip.jpg / .f<秒>.jpg | 同上 |
| 100/101 | 分享表持久化 | ~/.transfer-mcp/shares.json（tmp+rename） | 创建分享时顺带清过期 |
| 197 | 静态资源 ETag | 弱 ETag（mtime+size） | 无（no-cache 每次回源校验） |

### 锁

| 行号 | 锁 | 保护对象 |
|---|---|---|
| 93 | `_trans_sessions_lock` | 转码会话表读写 |
| 2119 | `_VIDEO_PROBE_LOCK` | meta=1 批量视频探测互斥（acquire(blocking=False) 跳过） |
| 2615 | `_ffmpeg_caps_lock` | ffmpeg 能力探测双检 |
| 3205 | `_original_cache_locks_guard` | per-digest 锁池本身 |
| 3208 | per-digest `_original_cache_lock` | 同一文件"读区间→写缓存→merge→save"串行化 |
| 3474 | `_asr_model_lock` | 模型单例初始化双检 |
| 3476 | `_asr_path_locks_guard` | per-path 锁池本身 |
| 3479 | per-path `_asr_path_lock` | 同一文件并发转写去重 |
| 4167 | `_ARCHIVE_SEM`（信号量=2） | 打包并发上限 |
| 4182 | `_ARCHIVE_TASKS_LOCK`（RLock） | 打包任务表 |
| 2969 | session["lock"] | 单会话缓冲读写 |
| 4592 | task["lock"]（RLock） | 单任务状态/进度 |
| — | 注意：`_shares` 与 `_state` 无显式锁（分享创建/清理在请求线程内完成；多线程并发写分享时无互斥，是潜在审计点） | |

---

## ④ 常量配置

| 行号 | 常量 | 值 | 说明 |
|---|---|---|---|
| 62 | `VERSION` | "3.0.0" | 版本号 |
| 63 | `DEFAULT_PORT` | 8443 | 默认端口 |
| 64-66 | `CERT_DIR`/`CERT_FILE`/`KEY_FILE` | ~/.transfer-mcp/server.crt|.key | 证书路径 |
| 69-74 | `BASE_DIR`/`STATIC_DIR`/`_STATIC_ALLOWED` | server/static 白名单 | 离线静态资源（bootstrap/app.js/highlight/cjk-normalize） |
| 77-79 | `FFPROBE`/`FFMPEG` | C:\Users\user\ffmpeg\bin\ffprobe.exe（硬编码用户路径）| 媒体工具；缺失时静默降级/404 |
| 82 | `TRANSCACHE_DIR` | ~/.transfer-mcp/transcache | 转码缓存根 |
| 83 | `TRANS_IDLE_TIMEOUT` | 30s | 转码会话空闲超时 |
| 84 | `TRANS_WAIT_SEC` | 5s | api/trans 等待新数据上限 |
| 85 | `TRANS_CHUNK` | 512KB | 前端单次分片期望字节 |
| 86 | `TRANSCACHE_MAX_BYTES` | 2GB | 缓存总量上限 |
| 87 | `_CACHE_SWEEP_INTERVAL` | 600s | 缓存清理周期 |
| 89-90 | `_TRANS_QUALITIES`/`_TRANS_KEYS` | {high:1920, medium:1280, low:854} + original | 四档画质 |
| 100 | `SHARES_FILE` | ~/.transfer-mcp/shares.json | 分享持久化 |
| 102 | `_SHARE_ALLOWED_HOURS` | (1, 24, 72, 168) | 分享有效期选项（最长 7 天） |
| 1796-1811 | `_VIDEO_EXT`/`_TEXT_EXT`/`_MD_EXT`/`_PDF_EXT`/`_LNK_EXT`/`_ARCHIVE_EXT`/`_SYSTEM_NOISE` | 扩展名集合 + 系统噪声文件 | 预览分类/锁定标记 |
| 2120-2121 | `_VIDEO_PROBE_WORKERS`=8 / `_VIDEO_PROBE_BUDGET_SEC`=3.0 | 并发与预算 | meta=1 探测 |
| 2124-2170 | `_AUDIO_EXT`/`_IMAGE_EXT`/`_CODE_EXT`/`_PLAIN_TEXT_EXT`/`_ARCHIVE_KIND_EXT`/`_EXE_EXT`/`_MIME_BY_EXT` | 分类/MIME 映射 | 侧边栏 meta |
| 2309 | `_BINARY_MAGICS` | 11 组魔数 | 二进制拦截 |
| 2717-2722 | `_AVC1_PROFILE_HEX`/`_AVC1_CONSTRAINT_HEX` | profile→hex | MSE codec 换算 |
| 3368 | `_SUB_EXT` | (.srt,.vtt,.ass,.ssa) | 旁挂字幕 |
| 3736-3747 | `_SEVEN_7Z_PATHS`/`_WINRAR_PATHS` | Program Files 常见路径（用户可扩展） | 外部工具探测 |
| 4167 | `_ARCHIVE_SEM` | Semaphore(2) | 打包并发 |
| 4171 | `_ARCHIVE_MODES` | store/fast/normal | 压缩级别 |
| 4183-4186 | `_ARCHIVE_QUEUE_MAX`=6 / `_ARCHIVE_TASK_CAP`=16 / `_ARCHIVE_CHUNK`=1MB / `_ARCHIVE_TASK_TTL`=30min | 打包中心参数 | 队列/容量/分块/TTL |
| 4805 | `_CERT_CN` | "transfer.local" | 证书 CN |
| 4886 | `CERT_P12_PASSWORD` | "1234" | .p12 安装密码（一次性） |
| — | mcp_stdio.py L22-30 | PREFERRED_PROTOCOL="2025-06-18"、SUPPORTED_PROTOCOLS、JSON-RPC 错误码 | MCP 协议常量 |

---

## ⑤ 设计意图摘要

**定位**：单文件实现"手机网盘式文件浏览器"（drive-mcp v3），把整台 Windows 电脑变成手机可访问的网盘。双入口：MCP 工具模式（默认，供 LLM 调用 drive_start/drive_pin/drive_status/drive_stop）与 CLI 模式（--serve，打印访问 URL 常驻）。后端零第三方依赖（仅 cryptography 用于自签证书），全部使用标准库。

**核心设计选择**：

1. **安全模型 = URL token + 路径越界校验**：随机 token（secrets.token_urlsafe(9)）作为路径前缀（L1099），全部路由要求 token；所有文件访问经 `_resolve`（realpath+commonpath 双重校验，L345）或 `_resolve_share_path`（L364）限定在允许根内，杜绝路径穿越。分享与主 token 完全隔离（/s/<share_token>/ 不校验主 token，L1096），最长 7 天（_SHARE_ALLOWED_HOURS），支持单文件/目录/多文件虚拟分享/二次分享（继承父过期、min 钳制防恶意延长，L986-1022），过期页/410 双通道展示（不删除以便稳定访问，L700）。

2. **单端口双协议 + 双栈**：`get_request` 首字节嗅探（TLS ClientHello 首字节恒 0x16，L1573-1601）实现 HTTPS/HTTP 同一端口共存；IPv6 双栈监听（关 IPV6_V6ONLY，L1603），URL 列表优先公网 IPv6 直连（免 NAT/内网穿透），fallback 私网 IPv4 与回环。自签证书自动生成（SAN 含本机全部 IP，解决按 IP 访问的证书主机名不匹配，L4808），提供 .crt/.p12 两种下载（小米等 Android 需含私钥的 p12，L4884），自动添加/删除防火墙入站规则。

3. **媒体能力矩阵（视频为核心）**：ffprobe 元数据提取（Windows 属性式标签→结构化 comment 解析→meta 面板）；MSE 转码体系（fMP4 常驻 ffmpeg 会话、三档画质+原画 remux 免证书、缓冲消费式分片拉取、会话空闲 30s 回收）；原画"边播边缓存"（稀疏文件+区间集合合并，per-digest 锁，L3199-3364）；字幕（旁挂+内嵌，GBK 兼容）；ASR（faster_whisper 可选装、模型单例、结果落盘缓存）；缩略图/缩略图条/单帧（全部磁盘缓存）。关键契约与前端 app.js 自洽（mseMime、X-Trans-* 头等，L2711-2716）。

4. **打包中心（任务化）**：同步 /dlzip 与后台任务共享打包核心（_scan_plan + _write_zip_entries），zip 字节与 zf.write 一致（md5 同）；状态机 queued→scanning→compressing→ready→downloading→done，可取消（_ArchiveAborted 收敛）、进度上报、断点式下载、TTL 惰性清理（无守护线程）、信号量 2 并发、临时空间预检、启动清扫 tk_*.zip 残留（L4518）。

5. **压缩包浏览零依赖**：zip/tar 用标准库；rar/7z 完全依赖系统已有 7-Zip/WinRAR（探测路径用户可扩展，L3730-3747），未探测到返回明确引导提示而非静默失败；含 GBK 中文名修复（zip/tar 双向，L3664/L3707）。

6. **编码健壮性（中文 Windows 生态）**：BOM/无 BOM UTF-16/utf-8/gbk/big5/gb18030/latin-1 智能解码链（L2376）、假名率判 big5、二进制魔数拦截"伪装文本"、上传文件名 GBK/UTF-8 修复（L1531-1538）、PowerShell 输出强制 UTF-8（lnk 解析，L2494）。

7. **可靠性/生命周期管理**：bind 重试 3 次（端口释放竞态，L5228）、本地 HTTP 自检（防"端口占着服务没起来"）、看门狗（连续 3 次探测失败 os._exit(2) 交启动脚本重启，L5263）、转码会话空闲回收 + 缓存磁盘治理（2GB 上限）、模块加载即恢复分享表（跨进程重启链接不失效，L3661）、静态资源弱 ETag+no-cache 防激进缓存拿旧版 app.js（L174-177）。

8. **前端配合约定**：模板每次请求读盘（热更新，L106-108）；分享模式与主站共用同一份 index.html + app.js（靠 location.pathname 识别）；只读浏览+上传（不能删除/修改服务器端已有文件）；无权限目录标记 denied 并提示"返回上级"，页面不卡死；隐藏文件默认过滤（T37，show_hidden 开关）；置顶（pinned）在 MCP drive_pin 与网页 API 双通道维护。

**潜在审计注意点**（供后续任务参考，非本任务结论）：
- `_shares`/`_state` 无显式锁（多线程并发创建分享/写 pinned 可能竞态）；
- FFPROBE 路径硬编码 `C:\Users\user\ffmpeg\bin\`（L77），换机器需改代码；
- cert 有效期仅 7 天、p12 密码固定 "1234"（L4886），属方便性取舍；
- `cgi.FieldStorage` 上传（L1522）为大文件/多文件并发上传的已知性能/内存点；
- 分享 token 仅 9 字节 urlsafe（72 位熵），容量/安全性依设计取舍。
