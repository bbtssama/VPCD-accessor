#!/usr/bin/env python3
"""drive-mcp v3 — 手机网盘式文件浏览器（MCP + CLI 双模式）。

特性：
  * 浅色现代网盘 UI：磁盘标签页、面包屑、上传、下载、置顶、打包。
  * 默认浏览整机所有固定磁盘（也可指定单个根目录）。
  * 只读浏览 + 可向当前目录上传文件（不能删除/修改服务器端已有文件）。
  * 打包下载：纯 zipfile 输出 .zip（支持目录递归/多选/三种压缩级别）。
  * 权限错误优雅处理：无权限目录提示"返回上级"，页面不卡死。

工具（MCP 模式）：
  drive_start(root, port)   启动服务；root 缺省=整机所有磁盘
  drive_pin(paths)          把文件/目录置顶到网页显著位置
  drive_status() / drive_stop()
"""

from __future__ import annotations

import argparse
import calendar
import cgi
import ctypes
import datetime
import email.utils
import hashlib
import html
import ipaddress
import json
import os
import re
import secrets
import shutil
import socket
import ssl
import subprocess
import sys
import tarfile
import tempfile
import threading
import time
import urllib.parse
import urllib.request
import uuid
import zipfile
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

try:
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives.serialization import pkcs12
    from cryptography.x509.oid import NameOID
except ImportError:  # pragma: no cover
    sys.stderr.write("缺少 cryptography 库，请先执行: python -m pip install cryptography\n")
    raise

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mcp_stdio import MCPServer, ToolError  # noqa: E402

VERSION = "3.0.0"
DEFAULT_PORT = 8443
CERT_DIR = os.path.join(os.path.expanduser("~"), ".transfer-mcp")
CERT_FILE = os.path.join(CERT_DIR, "server.crt")
KEY_FILE = os.path.join(CERT_DIR, "server.key")

# 离线内置 Bootstrap 静态资源目录（transfer-mcp/static）
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(os.path.dirname(BASE_DIR), "static")
_STATIC_ALLOWED = (
    "bootstrap.min.css", "bootstrap.bundle.min.js",
    "app.js", "highlight.min.js", "highlight.min.css", "cjk-normalize.js",
)

# ffprobe 用于提取视频元数据（Windows 属性式标签）；缺失/失败时静默降级为 details=null
FFPROBE = r"C:\Users\user\ffmpeg\bin\ffprobe.exe"
# ffmpeg 用于生成视频缩略图（/api/thumb），与 ffprobe 同目录；缺失时该接口返回 404
FFMPEG = os.path.join(os.path.dirname(FFPROBE), "ffmpeg.exe")

# 视频转码缓存目录（~/.transfer-mcp/transcache/<sha256(realpath)>/）
TRANSCACHE_DIR = os.path.join(os.path.expanduser("~"), ".transfer-mcp", "transcache")
TRANS_IDLE_TIMEOUT = 30          # MSE 转码会话空闲超时（秒），超时自动终止并释放进程
TRANS_WAIT_SEC = 5               # api/trans 等待转码产出新数据的最大秒数
TRANS_CHUNK = 512 * 1024         # 前端单次拉取的分片期望字节数
TRANSCACHE_MAX_BYTES = 2 * 1024 * 1024 * 1024   # transcache 总容量上限（超限按 mtime 清理最旧文件）
_CACHE_SWEEP_INTERVAL = 600      # 转码缓存磁盘清理周期（秒）
# 四档画质：高清/标清/低清的目标宽度（源分辨率低于目标时按源分辨率）
_TRANS_QUALITIES = {"high": 1920, "medium": 1280, "low": 854}
_TRANS_KEYS = ("original", "high", "medium", "low")
# MSE 转码会话：key=(realpath, q) -> {...}；原画缓存属副产品，无需全局状态
_trans_sessions = {}
_trans_sessions_lock = threading.Lock()

_state: dict = {"server": None, "roots": [], "port": None, "token": None, "pinned": []}

# ------------------------------------------------------------------ 分享（/s/<share_token>/）
# 分享与主 token 完全隔离：每个分享只暴露其 root 目录/文件，过期即失效（最长 7 天）。
# 持久化到 CERT_DIR/shares.json（写临时文件再 rename，防止写坏）。
SHARES_FILE = os.path.join(CERT_DIR, "shares.json")
_shares: dict = {}  # token -> {"root": abs, "is_dir": bool, "expires_at": float, "created_at": float, "name": str}
_SHARE_ALLOWED_HOURS = (1, 24, 72, 168)

# ---------------------------------------------------------------------- 前端

# 前端已拆分为独立文件（templates/index.html + static/app.js），便于维护与并行开发；
# 每次请求读取以支持模板热更新（文件小，开销可忽略）。
_TPL_PATH = os.path.join(BASE_DIR, "templates", "index.html")
_VIEW_TPL_PATH = os.path.join(BASE_DIR, "templates", "view.html")  # T18：独立预览页模板


def _load_index_html() -> str:
    """读取前端模板；失败时返回占位页，避免服务因模板缺失而崩溃。"""
    try:
        with open(_TPL_PATH, "r", encoding="utf-8") as fh:
            return fh.read()
    except OSError:
        return "<!doctype html><html><body style='font-family:sans-serif;padding:40px'>模板缺失: %s</body></html>" % _TPL_PATH


def _load_view_html() -> str:
    """读取独立预览页模板（T18 方案B：/view 沉浸式新页面）。"""
    try:
        with open(_VIEW_TPL_PATH, "r", encoding="utf-8") as fh:
            return fh.read()
    except OSError:
        return "<!doctype html><html><body>预览页模板缺失</body></html>"


# ------------------------------------------------------------------- 服务器


class _DriveHandler(BaseHTTPRequestHandler):
    # HTTP/1.1 便于 <video> 复用连接做 Range 分片请求
    protocol_version = "HTTP/1.1"

    # ------------------------------------------------------------ helpers

    def _send_json(self, obj, code=200):
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_view_html(self):
        data = _load_view_html().encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_html(self):
        data = _load_index_html().encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_static(self, route):
        """提供离线静态资源（Bootstrap / app.js / highlight.js / 图标 SVG）。

        白名单 + basename 双重校验，杜绝路径穿越：
          * 顶层文件：bootstrap.min.css / bootstrap.bundle.min.js / app.js / highlight.min.js
          * 图标目录：static/icons/<name>.svg 与 static/icons/color/<name>.svg
            （T34 彩色图标子目录；normpath 后必须仍落在 icons/ 内）

        缓存策略（防夸克式激进缓存拿到旧版 app.js）：
        静态资源 URL 无版本号，故禁绝长缓存—— Cache-Control: no-cache 允许浏览器存储，
        但每次使用前必须回源校验；ETag（弱校验，mtime+size）+ Last-Modified 命中时回 304
        空体，正常网络下几乎没有下载开销，文件一旦改版（mtime/size 变化）立即拿到新内容。
        """
        rel = route[len("/static/"):].lstrip("/")
        name = os.path.basename(rel)
        if name in _STATIC_ALLOWED and "/" not in rel:
            spath = os.path.join(STATIC_DIR, name)
        elif rel.startswith("icons/") and name.endswith(".svg") and "/" not in name:
            spath = os.path.normpath(os.path.join(STATIC_DIR, rel))   # 保留 icons/color/ 子目录
            if not spath.startswith(STATIC_DIR + os.sep + "icons" + os.sep):
                self._send_json({"error": "404"}, 404)
                return
        else:
            self._send_json({"error": "404"}, 404)
            return
        try:
            st = os.stat(spath)
        except OSError:
            self._send_json({"error": "404"}, 404)
            return
        # 弱 ETag：文件 mtime+size 足以区分改版，无需读盘算强校验
        etag = 'W/"%x-%x"' % (st.st_mtime_ns, st.st_size)
        last_mod = self.date_time_string(st.st_mtime)
        # If-None-Match 优先（浏览器同时携带两个条件头时按 ETag 判定）
        inm = self.headers.get("If-None-Match")
        ims = self.headers.get("If-Modified-Since")
        fresh = False
        if inm:
            fresh = inm.strip() in (etag, "*")
        elif ims:
            try:
                t = email.utils.parsedate(ims)
                fresh = t is not None and int(st.st_mtime) <= calendar.timegm(t)
            except (TypeError, ValueError, OverflowError):
                fresh = False
        if fresh:
            self.send_response(304)
            self.send_header("Cache-Control", "no-cache")
            self.send_header("ETag", etag)
            self.send_header("Last-Modified", last_mod)
            self.end_headers()
            return
        if name.endswith(".css"):
            ctype = "text/css; charset=utf-8"
        elif name.endswith(".svg"):
            ctype = "image/svg+xml; charset=utf-8"
        else:
            ctype = "application/javascript; charset=utf-8"
        with open(spath, "rb") as fh:
            data = fh.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        # no-cache：可存储但每次回源校验，杜绝启发式缓存（无新鲜度信息时
        # 浏览器按 Last-Modified 自算新鲜度）长期展示旧版资源
        self.send_header("Cache-Control", "no-cache")
        self.send_header("ETag", etag)
        self.send_header("Last-Modified", last_mod)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_error_page(self, title, detail):
        """下载/打包失败时返回友好 HTML 页，避免手机看到裸 JSON 错误。"""
        page = (
            "<!doctype html><html lang=zh-CN><head><meta charset=utf-8>"
            "<meta name=viewport content='width=device-width,initial-scale=1'>"
            "<title>%s</title></head><body style='font-family:sans-serif;"
            "background:#f3f4f6;margin:0;padding:48px 16px;text-align:center'>"
            "<h2 style='color:#1f2937'>%s</h2>"
            "<p style='color:#6b7280'>%s</p>"
            "<p><a href='javascript:history.back()' style='color:#2563eb'>← 返回</a></p>"
            "</body></html>"
        ) % (html.escape(title), html.escape(title), html.escape(detail))
        data = page.encode("utf-8")
        self.send_response(403)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_file_range(self, path, name=None, attachment=True, err="无法下载该文件", ctype=None):
        """统一文件 Range 下载（/dl 与 /api/stream 共用，功能 1）。

        支持 HTTP Range 断点续传：
          * 无 Range      → 200 + Accept-Ranges: bytes + 完整 Content-Length
          * bytes=a-b     → 206 + Content-Range: bytes a-b/total，Content-Length=b-a+1
          * bytes=a-      → 206 + 从 a 到文件尾
          * bytes=-suffix → 206 + 最后 suffix 字节
          * 非法/越界     → 416 + Content-Range: bytes */total
        断点续传更换 IP：服务本身无会话状态（token 就带在 URL 里），
        任意来源 IP 只要持有 token，就能从任意 Range 继续下载，天然支持换 IP 续传。
        ctype 可覆盖（如 /api/pdf 强制 application/pdf 供浏览器内联渲染）。
        """
        try:
            fsize = os.path.getsize(path)
        except OSError as exc:
            self._send_error_page(err, str(exc))
            return
        ext = os.path.splitext(path)[1].lstrip(".").lower()
        ctype = ctype or _VIDEO_EXT.get(ext, "application/octet-stream")
        try:
            fh = open(path, "rb")
        except OSError as exc:
            self._send_error_page(err, str(exc))
            return
        with fh:
            rng = self.headers.get("Range")
            if not rng:
                self.send_response(200)
                self.send_header("Content-Type", ctype)
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Content-Length", str(fsize))
                self.send_header("Cache-Control", "no-store")
                if attachment:
                    self.send_header(
                        "Content-Disposition",
                        "attachment; filename*=UTF-8''" + urllib.parse.quote(name or os.path.basename(path)),
                    )
                self.end_headers()
                shutil.copyfileobj(fh, self.wfile)
                return
            m = re.match(r"bytes=(\d*)-(\d*)", rng.strip(), re.IGNORECASE)
            if not m:
                _range_unsatisfiable(self, fsize)
                return
            s_str, e_str = m.groups()
            start = int(s_str) if s_str else None
            end = int(e_str) if e_str else None
            if start is None:
                # 后缀范围 bytes=-N：取末尾 N 字节
                if end is None or end <= 0:
                    _range_unsatisfiable(self, fsize)
                    return
                length = min(end, fsize)
                start = fsize - length
                end = fsize - 1
            else:
                if end is None or end >= fsize:
                    end = fsize - 1
                if start > end or start >= fsize:
                    _range_unsatisfiable(self, fsize)
                    return
            chunk = end - start + 1
            self.send_response(206)
            self.send_header("Content-Type", ctype)
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, fsize))
            self.send_header("Content-Length", str(chunk))
            self.send_header("Cache-Control", "no-store")
            if attachment:
                self.send_header(
                    "Content-Disposition",
                    "attachment; filename*=UTF-8''" + urllib.parse.quote(name or os.path.basename(path)),
                )
            self.end_headers()
            fh.seek(start)
            remaining = chunk
            while remaining:
                buf = fh.read(min(65536, remaining))
                if not buf:
                    break
                self.wfile.write(buf)
                remaining -= len(buf)

    def _query(self):
        q = urllib.parse.urlparse(self.path).query
        return {k: v[0] for k, v in urllib.parse.parse_qs(q).items()}

    def _resolve(self, raw):
        """把调用方给的路径解析为允许根目录内的绝对路径，越界返回 None。"""
        try:
            p = os.path.abspath(os.path.normpath(raw))
        except Exception:  # noqa: BLE001
            return None
        rp = os.path.realpath(p)
        for root in self.server.roots:
            rr = os.path.realpath(root)
            try:
                if os.path.commonpath([rr, rp]) == rr:
                    return rp
            except ValueError:
                continue
        return None

    def _tok(self):
        return "/" + self.server.token

    def _resolve_share_path(self, share, raw):
        """把分享子请求的路径解析为分享 root 内的绝对路径，越界返回 None。

        与 _resolve 的区别：根不是 server.roots 而是该分享的 root，
        commonpath 校验保证任何请求都逃不出分享目录。
        多文件分享（share 含 "files"）：改用白名单精确匹配——raw 的 realpath
        必须恰好等于 files 中某一项才放行，不做 commonpath 前缀匹配，
        防止通过父目录路径访问未分享的文件/目录。
        虚拟分享（share 含 "virtual" 与 "nodes"）：raw 可能是虚拟相对路径
        （不以盘符/绝对路径开头），也可能是 nodes 里的真实绝对路径，两者都命中。
        """
        if share.get("virtual"):
            nodes = share.get("nodes") or {}
            if raw and not re.match(r"^[A-Za-z]:[\\/]", raw) and not raw.startswith(("\\", "/")):
                node = nodes.get(raw)
                if node is None:
                    return None
                return node["real"]
            files = share.get("files")
            if files:
                try:
                    rp = os.path.realpath(os.path.abspath(os.path.normpath(raw)))
                except Exception:  # noqa: BLE001
                    return None
                if rp in files:
                    return rp
                return None
            return None
        try:
            p = os.path.abspath(os.path.normpath(raw))
        except Exception:  # noqa: BLE001
            return None
        rp = os.path.realpath(p)
        files = share.get("files")
        if files:
            if rp in files:
                return rp
            return None
        root = os.path.realpath(share["root"])
        try:
            if os.path.commonpath([root, rp]) == root:
                return rp
        except ValueError:
            return None
        return None

    def _share_expired(self, share):
        """判断分享是否过期：自身过期，或父分享（parent 链）已过期。

        二次分享（sharesub）会记录 parent token；若父分享已过期，
        即使子分享自身 expires_at 相同也应视为过期（父过期则子也过期）。
        """
        if time.time() > share["expires_at"]:
            return True
        parent = share.get("parent")
        seen = 0
        while parent and seen < 10:
            pshare = _shares.get(parent)
            if pshare is None:
                return True
            if time.time() > pshare["expires_at"]:
                return True
            parent = pshare.get("parent")
            seen += 1
        return False

    # ------------------------------------------------ 高级视频路由（主站与分享共用）
    # resolve_fn 抽象"越界校验"：主站传 self._resolve，分享传
    # lambda raw: self._resolve_share_path(share, raw or "")。
    # 由于 do_GET 里先解析了 route，这里统一处理视频转码/字幕/预览子路由。

    def _handle_trans_api(self, route, q, resolve_fn, persist=True):
        if route == "/api/trans":
            raw = q.get("path") or ""
            p = resolve_fn(raw)
            if p is None or not os.path.isfile(p):
                self._send_json({"error": "路径越界或不存在"}, 403)
                return
            quality = q.get("q") or "original"
            if quality not in _TRANS_KEYS:
                self._send_json({"error": "画质参数非法"}, 400)
                return
            try:
                offset = int(q.get("offset") or "0")
                need = int(q.get("need") or str(TRANS_CHUNK))
                start_sec = float(q.get("start") or "0")
            except ValueError:
                self._send_json({"error": "offset/need/start 参数非法"}, 400)
                return
            need = max(1, min(need, 8 * 1024 * 1024))
            if quality == "original":
                sess = _trans_ensure_remux(p, start_sec)
            else:
                # 播放始终不落盘（persist=False），仅内存缓冲供 MSE 流式
                sess = _trans_ensure_session(p, quality, start_sec, False)
            if sess is None:
                _m = _ffmpeg_capabilities()
                if not _m["ok"]:
                    self._send_json({"error": "ffmpeg 缺少 %s 编码器，请安装完整版（gyan.dev build）"
                                     % "/".join(_m["missing"])}, 500)
                else:
                    self._send_json({"error": "转码不可用（ffmpeg 缺失）"}, 500)
                return
            data, finished, new_offset = _trans_consume(sess, offset, need)
            self.send_response(200)
            self.send_header("Content-Type", "video/mp4")
            self.send_header("X-Trans-Finished", "1" if finished else "0")
            self.send_header("X-Trans-Offset", str(new_offset))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            if data:
                self.wfile.write(data)
            return
        if route == "/api/transstatus":
            raw = q.get("path") or ""
            p = resolve_fn(raw)
            if p is None or not os.path.isfile(p):
                self._send_json({"error": "路径越界或不存在"}, 403)
                return
            quality = q.get("q") or "original"
            resp = {
                "available": _trans_available(p),
                "ready": _trans_ready(p, quality),
            }
            if quality != "original":
                produced, total = _trans_progress_estimate(p, quality)
                resp["progress"] = produced
                resp["total"] = total
            self._send_json(resp)
            return
        if route == "/api/transdl":
            raw = q.get("path") or ""
            p = resolve_fn(raw)
            if p is None or not os.path.isfile(p):
                self._send_error_page("无法下载", "文件不存在或越界")
                return
            quality = q.get("q") or "original"
            if quality not in _TRANS_KEYS:
                self._send_json({"error": "画质参数非法"}, 400)
                return
            if quality == "original":
                self._send_file_range(p, attachment=False, err="无法播放该视频")
                return
            cfile = _trans_cache_file(p, quality)
            # 显式下载：确保持久化转码会话存在（0 起播、完整落盘）；
            # 会话完成（ffmpeg 全部输出已写盘）才发送完整文件，否则 409 + 进度。
            # 轮询每次都会刷新会话 last_client，避免被空闲回收器中途杀掉。
            sess = _trans_ensure_session(p, quality, 0, True)
            if sess is None:
                _m = _ffmpeg_capabilities()
                if not _m["ok"]:
                    self._send_json({"error": "ffmpeg 缺少 %s 编码器，请安装完整版（gyan.dev build）"
                                     % "/".join(_m["missing"])}, 500)
                else:
                    self._send_json({"error": "转码不可用（ffmpeg 缺失）"}, 500)
                return
            if not (sess.get("done") and os.path.isfile(cfile)):
                if sess.get("error"):
                    self._send_json({"error": "转码失败", "transcoding": False}, 500)
                    return
                produced, total = _trans_progress_estimate(p, quality, sess)
                self._send_json({
                    "error": "转码中，请稍后重试", "transcoding": True,
                    "progress": produced, "total": total,
                }, 409)
                return
            self._send_file_range(cfile, name=os.path.basename(p) + "." + quality + ".mp4",
                                  attachment=False, err="无法播放该视频")
            return
        if route == "/api/stream":
            raw = q.get("path") or ""
            p = resolve_fn(raw)
            if p is None or not os.path.isfile(p):
                self._send_error_page("无法播放该视频", str(p))
                return
            ext = os.path.splitext(p)[1].lstrip(".").lower()
            ctype = _VIDEO_EXT.get(ext, "application/octet-stream")
            cache = q.get("cache") == "1"
            if cache:
                self._send_cached_stream(p, ctype, bool(cache))
            else:
                self._send_file_range(p, attachment=False, ctype=ctype, err="无法播放该视频")
            return
        if route == "/api/subtitle":
            raw = q.get("path") or ""
            p = resolve_fn(raw)
            if p is None or not os.path.isfile(p):
                self._send_json({"error": "路径越界或不存在"}, 403)
                return
            vtt = _subtitle_vtt(p)
            if vtt is None:
                self._send_json({"error": "没有找到字幕"}, 404)
                return
            data, _src = vtt
            body = data.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/vtt; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if route == "/api/asr":
            raw = q.get("path") or ""
            p = resolve_fn(raw)
            if p is None or not os.path.isfile(p):
                self._send_json({"error": "路径越界或不存在"}, 403)
                return
            lang = q.get("lang") or "ja"
            if lang not in ("ja", "en", "zh"):
                self._send_json({"error": "语言参数非法"}, 400)
                return
            if not _asr_available():
                self._send_json({"error": "未内置识别引擎（faster_whisper），请安装后使用"}, 501)
                return
            vtt = _asr_transcribe(p, lang)
            if vtt is None:
                self._send_json({"error": "识别失败"}, 500)
                return
            body = vtt.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/vtt; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if route == "/api/vthumbstrip":
            raw = q.get("path") or ""
            p = resolve_fn(raw)
            if p is None or not os.path.isfile(p):
                self._send_json({"error": "路径越界或不存在"}, 403)
                return
            strip = _vthumbstrip_gen(p)
            if strip is None:
                self._send_json({"error": "缩略图条生成失败"}, 404)
                return
            strip_path, strip_n, strip_dur = strip
            try:
                with open(strip_path, "rb") as fh:
                    data = fh.read()
            except OSError:
                self._send_json({"error": "缩略图条读取失败"}, 404)
                return
            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("X-Strip-N", str(strip_n))
            self.send_header("X-Strip-Duration", "%g" % (strip_dur or 0))
            self.send_header("Cache-Control", "max-age=86400")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if route == "/api/vframes":
            raw = q.get("path") or ""
            p = resolve_fn(raw)
            if p is None or not os.path.isfile(p):
                self._send_json({"error": "路径越界或不存在"}, 403)
                return
            try:
                t = float(q.get("t") or "0")
            except ValueError:
                t = 0.0
            frame = _vframe_gen(p, t)
            if frame is None:
                self._send_json({"error": "单帧预览生成失败"}, 404)
                return
            try:
                with open(frame, "rb") as fh:
                    data = fh.read()
            except OSError:
                self._send_json({"error": "单帧预览读取失败"}, 404)
                return
            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Cache-Control", "max-age=86400")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if route == "/api/vinfo":
            raw = q.get("path") or ""
            p = resolve_fn(raw)
            if p is None or not os.path.isfile(p):
                self._send_json({"error": "路径越界或不存在"}, 403)
                return
            quality = q.get("q") or "original"
            if quality not in _TRANS_KEYS:
                self._send_json({"error": "画质参数非法"}, 400)
                return
            info = _video_src_info(p)
            mse = _vinfo_mime(info, quality)
            orig = _vinfo_mime(info, "original")
            self._send_json({
                "duration": (info or {}).get("duration"),
                "width": (info or {}).get("width"),
                "height": (info or {}).get("height"),
                "rotation": (info or {}).get("rotation", 0),
                "mseMime": mse,
                "originalMime": orig,
            })
            return
        self._send_json({"error": "404"}, 404)

    def _send_cached_stream(self, path, ctype, cache):
        """api/stream 的 cache=1 分支：Range 流 + 边播边写原画缓存。"""
        _stream_cached(self, path, None, ctype, cache)

    def _handle_share(self):
        """分享路由 /s/<share_token>/<sub>。

        分享页复用主站前端模板（templates/index.html + static/app.js）：
          * sub=="" → 返回与主站完全相同的 index.html（app.js 靠 location.pathname
            以 /s/ 开头识别为"分享模式"）
          * 其余 API / dl / static 全部复用主站对应逻辑，但统一用
            _resolve_share_path 做分享根内越界校验。

        分享模式不暴露主站能力：pin（置顶）、upload（上传）、cert/certp12（证书）、
        主站式的 api/share（新建独立分享，改用 api/sharesub 做二次分享）。
        过期分享懒删除：页面（sub 为空）→ 200 过期提示页；API → 410 JSON。
        """
        rest = self.path[len("/s/"):].split("?")[0].rstrip("/")
        parts = rest.split("/", 1)
        tok, sub = parts[0], (parts[1] if len(parts) > 1 else "")
        share = _shares.get(tok)
        if share is None:
            body = "分享不存在"
            data = body.encode("utf-8")
            self.send_response(404)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if self._share_expired(share):
            # 过期分享不在此删除（否则刷新会变成 404"分享不存在"），
            # 统一在创建新分享时清理，保证过期页可稳定重复访问。
            if sub == "":
                self._send_share_expired_page()
            else:
                self._send_json({"error": "链接已过期"}, 410)
            return
        if sub == "":
            # 分享页 = 主站模板（同一份 index.html + app.js）
            self._send_html()
            return
        if sub == "view":
            # T18 方案B：分享模式独立预览页（_resolve_share_path 校验）
            p = self._resolve_share_path(share, q.get("path") or "")
            if p is None or not os.path.exists(p):
                self._send_json({"error": "路径越界或不存在"}, 403)
                return
            self._send_view_html()
            return
        q = self._query()
        if sub == "api/info":
            info = {
                "ok": True,
                "root": share["root"],
                "name": share["name"],
                "is_dir": share["is_dir"],
                "expires_at": share["expires_at"],
                "architecture": "share",
                "share_mode": True,
            }
            files = share.get("files")
            if files:
                # 多文件分享：额外给出 files 白名单清单（每项由 os.path/stat 计算）
                info["multi"] = True
                if share.get("virtual"):
                    info["virtual"] = True
                    info["root_name"] = share.get("name") or "收藏分享"   # T36：置顶→收藏 文案统一
                    info["files"] = [os.path.realpath(f) for f in files]
                else:
                    items = []
                    for f in files:
                        try:
                            is_dir = os.path.isdir(f)
                            st = os.stat(f)
                        except OSError:
                            continue
                        items.append({
                            "name": os.path.basename(f) or f,
                            "path": f,
                            "is_dir": is_dir,
                            "size": None if is_dir else st.st_size,
                            "mtime": int(st.st_mtime),
                        })
                    info["files"] = items
            self._send_json(info)
            return
        if sub == "api/list":
            if share.get("virtual"):
                # 虚拟分享：按虚拟相对路径做目录导航（可进入目录）。
                nodes = share.get("nodes") or {}
                vpath = q.get("path") or ""
                vpath = vpath.rstrip("/")
                if vpath and vpath not in nodes:
                    self._send_json({"error": "越界"}, 404)
                    return
                prefix = vpath + "/" if vpath else ""
                entries = []
                for key, node in nodes.items():
                    if not key.startswith(prefix):
                        continue
                    rest = key[len(prefix):]
                    if not rest or "/" in rest:
                        continue
                    real = node["real"]
                    try:
                        st = os.stat(real)
                    except OSError:
                        continue
                    if q.get("show_hidden") != "1" and _is_hidden_entry(os.path.basename(real) or real, st):
                        continue   # T37：虚拟分享隐藏过滤（按真实文件名/属性）
                    entries.append({
                        "name": rest,
                        "path": key,
                        "is_dir": node["is_dir"],
                        "size": None if node["is_dir"] else st.st_size,
                        "mtime": int(st.st_mtime),
                        "locked": False,
                        "denied": node["is_dir"] and _dir_denied(real),
                    })
                entries.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
                if q.get("meta") == "1":
                    # 虚拟分享：entry["path"] 是虚拟 key，探测视频需映射回真实路径
                    _augment_entries_meta(
                        entries, {e["path"]: nodes[e["path"]]["real"] for e in entries})
                parent = None
                if vpath:
                    idx = vpath.rfind("/")
                    parent = vpath[:idx] if idx >= 0 else ""
                self._send_json({"path": vpath, "parent": parent, "entries": entries})
                return
            files = share.get("files")
            if files:
                # 多文件分享：只展示一层 files 白名单，不递归浏览。
                # 忽略 path 参数，始终返回完整 files 列表；但若显式传入 path
                # 且不在 files 白名单内 → 403（目录点击进入会触发，属预期行为）。
                raw = q.get("path") or ""
                if raw:
                    if self._resolve_share_path(share, raw) is None:
                        self._send_json({"error": "越界"}, 403)
                        return
                entries = []
                for f in files:
                    try:
                        is_dir = os.path.isdir(f)
                        st = os.stat(f)
                    except OSError:
                        continue
                    if q.get("show_hidden") != "1" and _is_hidden_entry(os.path.basename(f) or f, st):
                        continue   # T37：多文件分享隐藏过滤
                    entries.append({
                        "name": os.path.basename(f) or f,
                        "path": f,
                        "is_dir": is_dir,
                        "size": None if is_dir else st.st_size,
                        "mtime": int(st.st_mtime),
                        "locked": False,
                        "denied": is_dir and _dir_denied(f),
                    })
                entries.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
                if q.get("meta") == "1":
                    _augment_entries_meta(entries)
                self._send_json({"path": "", "parent": None, "entries": entries})
                return
            p = self._resolve_share_path(share, q.get("path") or share["root"])
            if p is None:
                self._send_json({"error": "越界"}, 403)
                return
            # 单文件分享：分享根是文件，不能 scandir（会抛 WinError 267 目录名称无效），
            # 直接返回该文件作为单个条目，前端据此渲染单个文件卡片（可下载/预览）。
            if not os.path.isdir(p):
                try:
                    st = os.stat(p)
                except OSError as exc:
                    self._send_json({"error": str(exc)}, 500)
                    return
                if q.get("meta") == "1":
                    _augment_entries_meta([{
                        "name": share["name"],
                        "path": p,
                        "is_dir": False,
                        "size": st.st_size,
                        "mtime": int(st.st_mtime),
                        "locked": False,
                    }])
                self._send_json({
                    "path": p, "parent": None,
                    "entries": [{
                        "name": share["name"],
                        "path": p,
                        "is_dir": False,
                        "size": st.st_size,
                        "mtime": int(st.st_mtime),
                        "locked": False,
                    }],
                })
                return
            data = _list_dir(p, q.get("show_hidden") == "1")   # T37：分享模式同逻辑
            if data is None:
                self._send_json({"error": "没有权限访问该目录", "parent": None}, 403)
                return
            entries, err = data
            if err:
                self._send_json({"error": err}, 500)
                return
            # 已达分享根时 parent 置 None，防止泄露分享目录之外的上级
            parent = None
            if os.path.realpath(p) != os.path.realpath(share["root"]):
                parent = os.path.dirname(p)
            if q.get("meta") == "1":
                _augment_entries_meta(entries)
            self._send_json({"path": p, "parent": parent, "entries": entries})
            return
        if sub == "api/stat":
            p = self._resolve_share_path(share, q.get("path") or "")
            if p is None or not os.path.exists(p):
                self._send_json({"error": "路径越界或不存在"}, 403)
                return
            self._send_json(_stat_file(p))
            return
        if sub == "api/vmeta":
            p = self._resolve_share_path(share, q.get("path") or "")
            if p is None or not os.path.exists(p):
                self._send_json({"error": "路径越界或不存在"}, 403)
                return
            d = _video_details(p)
            self._send_json({"ok": True, "meta": (d or {}).get("meta") if d else None})
            return
        if sub == "api/lnk":
            p = self._resolve_share_path(share, q.get("path") or "")
            if p is None or not os.path.isfile(p):
                self._send_json({"error": "路径越界或不存在"}, 403)
                return
            self._send_json(_lnk_target(p))
            return
        if sub == "api/thumb":
            p = self._resolve_share_path(share, q.get("path") or "")
            if p is None or not os.path.isfile(p):
                self._send_json({"error": "路径越界或不存在"}, 403)
                return
            ext = os.path.splitext(p)[1].lstrip(".").lower()
            if ext not in _VIDEO_EXT:
                self._send_json({"error": "不是视频文件"}, 404)
                return
            thumb = _thumb_path(p)
            if thumb is None:
                self._send_json({"error": "缩略图生成失败"}, 404)
                return
            try:
                with open(thumb, "rb") as fh:
                    data = fh.read()
            except OSError:
                self._send_json({"error": "缩略图读取失败"}, 404)
                return
            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Cache-Control", "max-age=86400")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if sub == "api/pdf":
            p = self._resolve_share_path(share, q.get("path") or "")
            if p is None or not os.path.isfile(p):
                self._send_error_page("PDF 不存在或越界", str(p))
                return
            self._send_file_range(p, attachment=False, ctype="application/pdf", err="PDF 不可用")
            return
        if sub == "api/img":
            p = self._resolve_share_path(share, q.get("path") or "")
            if p is None or not os.path.isfile(p):
                self._send_error_page("图片不存在或越界", str(p))
                return
            ext = os.path.splitext(p)[1].lstrip(".").lower()
            self._send_file_range(p, attachment=False,
                                  ctype=_MIME_BY_EXT.get(ext, "application/octet-stream"),
                                  err="图片不可用")
            return
        if sub in ("api/stream", "api/trans", "api/transstatus", "api/transdl",
                   "api/subtitle", "api/asr", "api/vthumbstrip", "api/vframes",
                   "api/vinfo"):
            # 分享页不落盘转码缓存（persist=False），避免分享流量占用分享者磁盘
            # 注意：route 需带前导 "/"（如 "/api/stream"），与 _handle_trans_api 内部一致
            self._handle_trans_api("/" + sub, q,
                                   lambda raw: self._resolve_share_path(share, raw or ""),
                                   persist=False)
            return
        if sub == "api/read":
            p = self._resolve_share_path(share, q.get("path") or "")
            if p is None or not os.path.isfile(p):
                self._send_json({"error": "路径越界或不存在"}, 403)
                return
            self._send_json(_read_text(p, _parse_read_limit(q)))
            return
        if sub == "api/unpack":
            p = self._resolve_share_path(share, q.get("path") or "")
            if p is None or not os.path.isfile(p):
                self._send_json({"error": "路径越界或不存在"}, 403)
                return
            self._send_json(_unpack_list(p, q.get("dir") or ""))
            return
        if sub == "api/unpackdir":
            p = self._resolve_share_path(share, q.get("path") or "")
            if p is None or not os.path.isfile(p):
                self._send_json({"error": "路径越界或不存在"}, 403)
                return
            self._send_json(_unpack_list(p, q.get("dir") or ""))
            return
        if sub == "api/unpackdl":
            arch = self._resolve_share_path(share, q.get("archive") or "")
            entry = q.get("entry") or ""
            if arch is None or not os.path.isfile(arch):
                self._send_error_page("压缩包不存在或越界", str(arch))
                return
            _unpack_download(self, arch, entry)
            return
        if sub == "api/sharesub":
            # 二次分享：与父分享共享同一个过期时间（不能选新的有效期），
            # 记录 parent 字段，父过期则子也视为过期。
            raw = q.get("path") or ""
            p = self._resolve_share_path(share, raw)
            if p is None or not os.path.exists(p):
                self._send_json({"error": "路径越界或不存在"}, 403)
                return
            new_tok = secrets.token_urlsafe(9)
            now = time.time()
            # T35 时间钳制：子分享过期 = min(请求过期, 父分享剩余)，防恶意延长。
            # sharesub 不接收独立有效期 → 请求值即继承父分享过期时间；显式钳制并
            # 拒绝已过期父分享（route 层 _share_expired 已兜底，此处再防御一层）。
            requested = share["expires_at"]
            expires_at = min(requested, share["expires_at"])
            if expires_at <= now:
                self._send_json({"error": "父分享已过期，无法二次分享"}, 403)
                return
            _shares[new_tok] = {
                "root": p,
                "is_dir": os.path.isdir(p),
                # T35：继承父分享的 expires_at（钳制后），父过期则子也视为过期
                "expires_at": expires_at,
                "created_at": now,
                "name": os.path.basename(p) or p,
                "parent": tok,
            }
            _save_shares()
            self._send_json({
                "ok": True,
                "share_token": new_tok,
                "expires_at": _shares[new_tok]["expires_at"],
                "url": "/s/%s/" % new_tok,
                "is_dir": _shares[new_tok]["is_dir"],
                "name": _shares[new_tok]["name"],
            })
            return
        if sub == "dl":
            p = self._resolve_share_path(share, q.get("path") or "")
            if p is None or not os.path.isfile(p):
                self._send_error_page("分享文件不可用", "文件不存在或越界")
                return
            self._send_file_range(p, attachment=True, err="分享文件不可用")
            return
        if sub == "dlzip":
            # 分享内打包：入参 paths 用 _resolve_share_path 解析（虚拟路径或真实路径都命中）。
            # 虚拟分享下把 (虚拟相对路径, 真实路径) 直接交给统一打包核心；普通分享
            # 先组装 arcname（相对公共父目录）再调用同一核心。mode 控制压缩级别。
            mode = q.get("mode") or "normal"
            if mode not in _ARCHIVE_MODES:
                mode = "normal"
            raw = q.get("paths") or ""
            if share.get("virtual"):
                virtual_items = []
                for x in raw.split("|"):
                    if not x:
                        continue
                    real = self._resolve_share_path(share, x)
                    if real and os.path.exists(real):
                        virtual_items.append((x.rstrip("/"), real))
                if not virtual_items:
                    self._send_json({"error": "没有可打包的文件"}, 400)
                    return
                _stream_archive(self, virtual_items, mode)
                return
            paths = [self._resolve_share_path(share, x) for x in raw.split("|") if x]
            paths = [p for p in paths if p and os.path.exists(p)]
            if not paths:
                self._send_json({"error": "没有可打包的文件"}, 400)
                return
            items = _build_archive_items(paths)
            if not items:
                self._send_json({"error": "没有可打包的文件"}, 400)
                return
            _stream_archive(self, items, mode)
            return
        if sub.startswith("static/"):
            # 分享页需要的离线静态资源（bootstrap/app.js/图标等），复用主站白名单
            self._send_static("/" + sub)
            return
        # 分享模式禁用的主站能力：pin / upload / cert / certp12 / share（独立分享）
        if sub in ("api/pin", "api/upload", "api/cert", "api/certp12", "api/share"):
            self._send_json({"error": "分享模式不支持该操作"}, 403)
            return
        self._send_json({"error": "404"}, 404)

    def _send_share_expired_page(self):
        """分享过期提示页（200 HTML，明确告知"链接已过期"，不是 404）。"""
        page = (
            "<!doctype html><html lang=zh-CN><head><meta charset=utf-8>"
            "<meta name=viewport content='width=device-width,initial-scale=1'>"
            "<title>链接已过期</title><style>body{font-family:sans-serif;"
            "background:#f3f4f6;margin:0;padding:48px 16px;text-align:center;"
            "color:#1f2937}h2{font-size:22px}p{color:#6b7280}</style></head>"
            "<body><h2>🔗 链接已过期</h2>"
            "<p>该分享已超过有效期，请联系分享者重新创建</p></body></html>"
        )
        data = page.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    # ---------------------------------------------------------------- routes

    def do_GET(self):  # noqa: N802
        # 分享路由独立于主 token：/s/<share_token>/... 不走主 token 校验，
        # 且不暴露主 token（share token 与主 token 完全无关）。
        if self.path.startswith("/s/"):
            self._handle_share()
            return
        tok = self._tok()
        if not (self.path == tok or self.path.startswith(tok + "/")):
            self._send_json({"error": "无效 token"}, 403)
            return
        # 无斜杠的 token 根路径（如 /transfer）重定向到 /transfer/，
        # 否则页面内相对路径 static/... 会被浏览器解析成 /static/...（丢失 token 前缀）导致 403
        if self.path == tok:
            self.send_response(301)
            self.send_header("Location", tok + "/")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        route = self.path[len(tok):].split("?")[0].rstrip("/") or "/"
        q = self._query()

        if route == "/":
            self._send_html()
        elif route == "/view":
            # T18 方案B：独立预览页（校验 path 与 /api/* 一致，防止越界）
            p = self._resolve(q.get("path") or "")
            if p is None or not os.path.exists(p):
                self._send_json({"error": "路径越界或不存在"}, 403)
                return
            self._send_view_html()
        elif route.startswith("/static/"):
            # 离线内置 Bootstrap 静态资源（白名单文件名，杜绝路径穿越）
            self._send_static(route)
        elif route == "/api/info":
            port = self.server.server_address[1]
            self._send_json({
                "roots": list(self.server.roots),
                "pinned": list(self.server.pinned),
                "archive_format": "zip",
                "urls": _urls(port, self.server.token),
                "urls_http": _urls_http(port, self.server.token),
            })
        elif route == "/api/list":
            p = self._resolve(q.get("path") or self.server.roots[0])
            if p is None:
                self._send_json({"error": "路径越界或不存在"}, 403)
                return
            data = _list_dir(p, q.get("show_hidden") == "1")   # T37
            if data is None:
                self._send_json({"error": "没有权限访问该目录",
                                 "parent": _parent_of(p, self.server.roots)}, 403)
                return
            entries, err = data
            if err:
                self._send_json({"error": err}, 500)
                return
            if q.get("meta") == "1":
                # 侧边栏元数据：kind/mime（+视频 duration/width/height），探测有预算不阻塞
                _augment_entries_meta(entries)
            self._send_json({
                "path": p,
                "parent": _parent_of(p, self.server.roots),
                "entries": entries,
            })
        elif route == "/api/pin":
            # 一键清空全部置顶（无需 path，先于 resolve 处理）
            if q.get("clear") == "1":
                self.server.pinned[:] = []
                self._send_json({"pinned": list(self.server.pinned)})
                return
            p = self._resolve(q.get("path") or "")
            if p is None:
                self._send_json({"error": "路径越界或不存在"}, 403)
                return
            add = q.get("add", "1") == "1"
            if add:
                is_dir = os.path.isdir(p)
                item = {"path": p, "name": os.path.basename(p) or p,
                        "is_dir": is_dir,
                        "size": None if is_dir else os.path.getsize(p)}
                if not any(x["path"] == p for x in self.server.pinned):
                    self.server.pinned.append(item)
            else:
                self.server.pinned[:] = [x for x in self.server.pinned if x["path"] != p]
            self._send_json({"pinned": list(self.server.pinned)})
        elif route == "/api/stat":
            # 文件/目录详情（含 preview 类型，供前端分流弹窗）
            p = self._resolve(q.get("path") or "")
            if p is None or not os.path.exists(p):
                self._send_json({"error": "路径越界或不存在"}, 403)
                return
            self._send_json(_stat_file(p))
        elif route == "/api/vmeta":
            # 视频详情元数据（结构化 tag 展示；非视频/解析失败返回 meta=null，不报错）
            p = self._resolve(q.get("path") or "")
            if p is None or not os.path.exists(p):
                self._send_json({"error": "路径越界或不存在"}, 403)
                return
            d = _video_details(p)
            self._send_json({"ok": True, "meta": (d or {}).get("meta") if d else None})
        elif route == "/api/lnk":
            # 解析 Windows .lnk 快捷方式目标（PowerShell COM）
            p = self._resolve(q.get("path") or "")
            if p is None or not os.path.isfile(p):
                self._send_json({"error": "路径越界或不存在"}, 403)
                return
            self._send_json(_lnk_target(p))
        elif route == "/api/thumb":
            # 视频缩略图（ffmpeg 抽帧，缓存于 static/thumbs）
            p = self._resolve(q.get("path") or "")
            if p is None or not os.path.isfile(p):
                self._send_json({"error": "路径越界或不存在"}, 403)
                return
            ext = os.path.splitext(p)[1].lstrip(".").lower()
            if ext not in _VIDEO_EXT:
                self._send_json({"error": "不是视频文件"}, 404)
                return
            thumb = _thumb_path(p)
            if thumb is None:
                self._send_json({"error": "缩略图生成失败"}, 404)
                return
            try:
                with open(thumb, "rb") as fh:
                    data = fh.read()
            except OSError:
                self._send_json({"error": "缩略图读取失败"}, 404)
                return
            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Cache-Control", "max-age=86400")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        elif route == "/api/pdf":
            # PDF 内联预览：ctype 强制 application/pdf，浏览器据此在标签页内联渲染 PDF
            p = self._resolve(q.get("path") or "")
            if p is None or not os.path.isfile(p):
                self._send_error_page("PDF 不存在或越界", str(p))
                return
            self._send_file_range(p, attachment=False, ctype="application/pdf", err="PDF 不可用")
        elif route == "/api/img":
            # 图片内联预览：ctype 按扩展名取 MIME（_MIME_BY_EXT），浏览器内联渲染 <img>
            p = self._resolve(q.get("path") or "")
            if p is None or not os.path.isfile(p):
                self._send_error_page("图片不存在或越界", str(p))
                return
            ext = os.path.splitext(p)[1].lstrip(".").lower()
            self._send_file_range(p, attachment=False,
                                  ctype=_MIME_BY_EXT.get(ext, "application/octet-stream"),
                                  err="图片不可用")
        elif route == "/api/share":
            # 创建分享：只暴露该目录/文件本身，链接与主 token 无关，最长 7 天
            # 多文件分享：?paths=<p1>|<p2>|...（用 | 分隔，与 dlzip 一致）；
            # paths 与 path 互斥，paths 提供且非空时优先走多文件分享。
            raw_paths = q.get("paths") or ""
            if raw_paths:
                files = []
                for x in raw_paths.split("|"):
                    if not x:
                        continue
                    p = self._resolve(x)
                    if p is None or not os.path.exists(p):
                        self._send_json({"error": "包含无效路径: %s" % x}, 403)
                        return
                    files.append(p)
                # 去重（保留首次出现顺序），避免同一路径重复占位
                files = list(dict.fromkeys(files))
                if not files:
                    self._send_json({"error": "包含无效路径: %s" % raw_paths}, 403)
                    return
                try:
                    hours = int(q.get("hours") or "0")
                except ValueError:
                    hours = 0
                if hours not in _SHARE_ALLOWED_HOURS:
                    self._send_json({"error": "有效期参数非法，允许 1/24/72/168 小时"}, 400)
                    return
                tok = secrets.token_urlsafe(9)
                now = time.time()
                # 顺带清理已过期的分享，防止过期 token 无限累积
                expired = [k for k, v in _shares.items() if now > v["expires_at"]]
                for k in expired:
                    _shares.pop(k, None)
                _shares[tok] = {
                    "root": "",
                    "files": files,
                    "is_dir": False,
                    "expires_at": now + hours * 3600,
                    "created_at": now,
                    "name": "收藏分享(%d 个)" % len(files),   # T36：置顶→收藏 文案统一
                    "multi": True,
                    "virtual": True,
                    "nodes": _build_virtual_nodes(files),
                }
                _save_shares()
                self._send_json({
                    "ok": True,
                    "share_token": tok,
                    "expires_at": _shares[tok]["expires_at"],
                    "url": "/s/%s/" % tok,
                    "is_dir": _shares[tok]["is_dir"],
                    "name": _shares[tok]["name"],
                    "multi": True,
                    "virtual": True,
                })
                return
            raw = q.get("path") or ""
            p = self._resolve(raw)
            if p is None or not os.path.exists(p):
                self._send_json({"error": "路径越界或不存在"}, 403)
                return
            try:
                hours = int(q.get("hours") or "0")
            except ValueError:
                hours = 0
            if hours not in _SHARE_ALLOWED_HOURS:
                self._send_json({"error": "有效期参数非法，允许 1/24/72/168 小时"}, 400)
                return
            tok = secrets.token_urlsafe(9)
            now = time.time()
            # 顺带清理已过期的分享，防止过期 token 无限累积
            expired = [k for k, v in _shares.items() if now > v["expires_at"]]
            for k in expired:
                _shares.pop(k, None)
            _shares[tok] = {
                "root": p,
                "is_dir": os.path.isdir(p),
                "expires_at": now + hours * 3600,
                "created_at": now,
                "name": os.path.basename(p) or p,
            }
            _save_shares()
            self._send_json({
                "ok": True,
                "share_token": tok,
                "expires_at": _shares[tok]["expires_at"],
                "url": "/s/%s/" % tok,
                "is_dir": _shares[tok]["is_dir"],
                "name": _shares[tok]["name"],
            })
        elif route in ("/api/stream", "/api/trans", "/api/transstatus", "/api/transdl",
                       "/api/subtitle", "/api/asr", "/api/vthumbstrip", "/api/vframes",
                       "/api/vinfo"):
            self._handle_trans_api(route, q, self._resolve)
        elif route == "/api/cert":
            # 供手机一次性下载并信任自签名证书（解决浏览器对媒体子资源的证书限制）
            if not os.path.isfile(CERT_FILE):
                self._send_error_page("证书不存在", str(CERT_FILE))
                return
            try:
                with open(CERT_FILE, "rb") as fh:
                    data = fh.read()
                self.send_response(200)
                self.send_header("Content-Type", "application/x-x509-ca-cert")
                self.send_header("Content-Disposition", 'attachment; filename="drive-mcp.crt"')
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(data)
            except OSError as exc:
                self._send_error_page("证书读取失败", str(exc))
        elif route == "/api/certp12":
            # 小米等 Android 安装 CA 证书要求含私钥的 .p12，现场打包私钥+证书
            if not os.path.isfile(CERT_FILE) or not os.path.isfile(KEY_FILE):
                self._send_error_page("证书不存在", str(CERT_FILE))
                return
            try:
                data = _cert_p12_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "application/x-pkcs12")
                self.send_header("Content-Disposition", 'attachment; filename="drive-mcp.p12"')
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(data)
            except OSError as exc:
                self._send_error_page("证书打包失败", str(exc))
        elif route == "/api/read":
            # 文本/Markdown 在线查看（BOM 优先 → utf-8 → gbk → latin-1；支持 limit 参数）
            p = self._resolve(q.get("path") or "")
            if p is None or not os.path.isfile(p):
                self._send_json({"error": "路径越界或不存在"}, 403)
                return
            self._send_json(_read_text(p, _parse_read_limit(q)))
        elif route == "/api/unpack":
            # 压缩包条目列表（层级：dir 指定包内目录前缀，缺省根层）
            p = self._resolve(q.get("path") or "")
            if p is None or not os.path.isfile(p):
                self._send_json({"error": "路径越界或不存在"}, 403)
                return
            self._send_json(_unpack_list(p, q.get("dir") or ""))
        elif route == "/api/unpackdir":
            # 压缩包内指定目录的子条目（层级浏览入口）
            p = self._resolve(q.get("path") or "")
            if p is None or not os.path.isfile(p):
                self._send_json({"error": "路径越界或不存在"}, 403)
                return
            self._send_json(_unpack_list(p, q.get("dir") or ""))
        elif route == "/api/unpackdl":
            # 下载压缩包内的单个条目（zip/tar/rar/7z）
            arch = self._resolve(q.get("archive") or "")
            entry = q.get("entry") or ""
            if arch is None or not os.path.isfile(arch):
                self._send_error_page("压缩包不存在或越界", str(arch))
                return
            _unpack_download(self, arch, entry)
        elif route == "/api/archives":
            # 打包中心：任务列表（轻量快照；惰性清理 TTL 过期任务与超上限逐出）
            _archive_poll_cleanup()
            with _ARCHIVE_TASKS_LOCK:
                tasks = [_archive_task_light(t) for t in _ARCHIVE_TASKS.values()]
            tasks.sort(key=lambda t: t["created_at"])
            self._send_json({"tasks": tasks})
        elif route == "/api/archive":
            # 打包中心：单任务详情（含完整 skipped 清单，供前端展开跳过列表）
            task = _ARCHIVE_TASKS.get(q.get("id") or "")
            if task is None:
                self._send_json({"error": "任务不存在"}, 404)
                return
            self._send_json({"task": _archive_task_light(task, full=True)})
        elif route == "/api/archive/dl":
            # 打包中心：原生下载已就绪的 zip（签 ready/done 才放行）
            task = _ARCHIVE_TASKS.get(q.get("id") or "")
            if task is None:
                self._send_json({"error": "任务不存在"}, 404)
                return
            _archive_dl(self, task)
        elif route == "/api/archive/preview":
            # 打包中心：预览面板目录统计（子项数/首层文件大小和，不递归）
            items = []
            for x in (q.get("paths") or "").split("|"):
                if not x:
                    continue
                p = self._resolve(x)
                if p is None:
                    self._send_json({"error": "包含无效路径: %s" % x}, 403)
                    return
                info = _archive_preview(p)
                if info is None:
                    self._send_json({"error": "包含无效路径: %s" % x}, 403)
                    return
                items.append(info)
            self._send_json({"items": items})
        elif route == "/dl":
            # 下载（支持 Range 断点续传；token 在 URL 里，中途换 IP 也能继续）
            p = self._resolve(q.get("path") or "")
            if p is None or not os.path.isfile(p):
                self._send_error_page("文件不存在或越界", str(p))
                return
            self._send_file_range(p)
        elif route == "/dlzip":
            # 打包下载：paths 用 | 分隔（文件/目录都允许）；mode=store|fast|normal 压缩级别
            mode = q.get("mode") or "normal"
            if mode not in _ARCHIVE_MODES:
                mode = "normal"
            raw = q.get("paths") or ""
            paths = [self._resolve(x) for x in raw.split("|") if x]
            paths = [p for p in paths if p and os.path.exists(p)]
            if not paths:
                self._send_json({"error": "没有可打包的文件"}, 400)
                return
            items = _build_archive_items(paths)
            if not items:
                self._send_json({"error": "没有可打包的文件"}, 400)
                return
            _stream_archive(self, items, mode)
        else:
            self._send_json({"error": "404"}, 404)

    def do_POST(self):  # noqa: N802
        if self.path.startswith("/s/"):
            # 分享模式禁用上传（分享只读浏览，不允许写入）
            self._send_json({"error": "分享模式不支持该操作"}, 403)
            return
        tok = self._tok()
        if not self.path.startswith(tok + "/"):
            self._send_json({"error": "无效 token"}, 403)
            return
        route = self.path[len(tok):].split("?")[0].rstrip("/") or "/"
        q = self._query()
        if route == "/api/archive":
            # 打包中心：创建后台打包任务（body JSON: {paths:[...], mode}）
            try:
                length = int(self.headers.get("Content-Length") or "0")
            except ValueError:
                length = 0
            body = {}
            if length > 0:
                try:
                    body = json.loads(self.rfile.read(length).decode("utf-8"))
                except (ValueError, UnicodeDecodeError):
                    body = {}
            paths = body.get("paths") if isinstance(body, dict) else None
            if not isinstance(paths, list):
                self._send_json({"error": "paths 必须是字符串数组"}, 400)
                return
            mode = body.get("mode") or "normal"
            task, err = _archive_new_task(paths, mode)
            if err is not None:
                self._send_json(err, 429 if err.get("queue_full") else 400)
                return
            self._send_json({"task_id": task["task_id"]})
            return
        if route == "/api/archive/cancel":
            # 打包中心：取消/删除任务——活任务置取消事件（工人收敛 aborted），终态立即删除
            task = _ARCHIVE_TASKS.get(q.get("id") or "")
            if task is None:
                self._send_json({"error": "任务不存在"}, 404)
                return
            with task["lock"]:
                if task["state"] in ("queued", "scanning", "compressing", "downloading"):
                    task["cancel_evt"].set()
                else:
                    # ready/done/failed/aborted：终态直接删任务 + 临时文件
                    _archive_delete_task(task)
            self._send_json({"ok": True})
            return
        if route != "/api/upload":
            self._send_json({"error": "404"}, 404)
            return
        target = self._resolve(q.get("path") or "")
        if target is None or not os.path.isdir(target):
            self._send_json({"error": "目标目录无效或越界"}, 403)
            return
        ctype = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in ctype:
            self._send_json({"error": "需要 multipart/form-data"}, 400)
            return
        form = cgi.FieldStorage(
            fp=self.rfile, headers=self.headers,
            environ={"REQUEST_METHOD": "POST", "CONTENT_TYPE": ctype},
        )
        saved, errors = [], []
        for field in form.list or []:
            fname = getattr(field, "filename", None)
            if not fname:
                continue
            # 修复浏览器中文文件名可能出现的编码错乱：UTF-8 浏览器 → utf-8；GBK 浏览器 → gbk
            try:
                fname = fname.encode("latin-1").decode("utf-8")
            except (UnicodeEncodeError, UnicodeDecodeError):
                try:
                    fname = fname.encode("latin-1").decode("gbk")
                except (UnicodeEncodeError, UnicodeDecodeError):
                    pass
            name = os.path.basename(fname) or "file"
            dest = os.path.join(target, name)
            try:
                with open(dest, "wb") as fh:
                    shutil.copyfileobj(field.file, fh)
                saved.append(name)
            except OSError as exc:
                errors.append({"name": name, "error": str(exc)})
        self._send_json({"saved": saved, "errors": errors, "dir": target})

    def handle_one_request(self):  # noqa: D401
        # 单端口模式下 TLS 连接已在 get_request 层完成包装，这里只收到
        # 解密后的明文数据，直接交给父类处理即可。
        super().handle_one_request()

    def log_message(self, fmt, *args):  # noqa: A003
        sys.stderr.write("[drive] %s\n" % (fmt % args))


class _DriveServer(ThreadingHTTPServer):
    address_family = socket.AF_INET6
    daemon_threads = True
    # Windows 默认 SO_REUSEADDR 允许两个进程绑定同一端口，导致旧实例没退出时
    # 新实例"静默启动成功"、请求随机分发到新旧两个进程。关闭复用让端口被占时
    # bind 直接抛 OSError，新实例明确失败退出，避免多实例并存。
    allow_reuse_address = False

    def __init__(self, addr, handler, roots, token, ssl_context=None):
        self.roots = roots
        self.token = token
        self.pinned = []
        self.ssl_context = ssl_context
        super().__init__(addr, handler)

    def get_request(self):
        """首字节嗅探实现单端口双协议：TLS ClientHello 首字节恒为 0x16，
        HTTP 明文请求首字节是 ASCII 方法字母（G/P/H/O 等），据此决定是否
        用 SSLContext 包装该连接。0x16 不属于可打印 ASCII，不会误判明文。
        """
        sock, addr = super().get_request()
        if self.ssl_context is not None:
            try:
                sock.settimeout(1.0)
                try:
                    peek = sock.recv(1, socket.MSG_PEEK)
                finally:
                    sock.settimeout(None)
            except OSError:
                peek = b""  # peek 异常/无数据按明文处理
            if peek == b"\x16":
                try:
                    sock.settimeout(5.0)  # 防止半截 ClientHello 无限阻塞握手
                    sock = self.ssl_context.wrap_socket(sock, server_side=True)
                    sock.settimeout(None)
                except Exception as exc:  # noqa: BLE001
                    try:
                        sock.close()
                    except OSError:
                        pass
                    # SSLError 属 OSError：_handle_request_noblock 会捕获并
                    # 干净跳过该请求，不会影响服务器主循环
                    raise OSError("TLS 握手失败，关闭连接: %s" % exc) from exc
        return sock, addr

    def server_bind(self):
        # 双栈：关闭 IPV6_V6ONLY，使 [::] 监听同时接受 IPv4-mapped 连接
        # （127.0.0.1 与局域网 IPv4 都能访问，手机/本机免证书 http 端口依赖此行为）
        try:
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        except (AttributeError, OSError):
            pass
        super().server_bind()


# ------------------------------------------------------------------ 工具函数


def _parent_of(path, roots):
    """返回路径的上级；若已是某个根目录则返回该根（用于错误时的"返回上级"）。"""
    parent = os.path.dirname(path)
    for root in roots:
        rr = os.path.realpath(root)
        try:
            if os.path.commonpath([rr, os.path.realpath(parent)]) == rr:
                return parent
        except ValueError:
            continue
    return None


def _is_ancestor(a, b):
    """判断真实路径 a 是否为真实路径 b 的祖先（含相等）。a 与 b 均已 realpath 归一。"""
    try:
        return os.path.commonpath([a, b]) == a
    except ValueError:
        return False


def _build_virtual_nodes(files):
    """把多文件分享的真实路径列表构建为"虚拟相对路径 → 真实路径"映射。

    虚拟相对路径用 "/" 作为层级分隔符，key 从根起（"" 表示根）。
    规则：
      1. 归一 realpath 后做包含关系去重（后代更精确，顶替祖先；祖先被覆盖则丢弃）。
      2. 同名真实路径仅保留一个，后续加 " (2)"、" (3)" 后缀唯一。
      3. 目录条目递归展开其下所有子项，映射为虚拟相对路径。
    返回 dict：{虚拟相对路径: {"real": 真实绝对路径, "is_dir": bool}}。
    """
    real = []
    for p in files:
        try:
            rp = os.path.realpath(p)
        except Exception:  # noqa: BLE001
            continue
        if rp not in real:
            real.append(rp)
    keep = []
    for rp in real:
        if not any((rq != rp) and _is_ancestor(rq, rp) for rq in real):
            keep.append(rp)
    keep.sort()
    names = {}
    for rp in keep:
        base = os.path.basename(rp.rstrip("\\/")) or rp
        cand = base
        n = 2
        while cand in names:
            cand = "%s (%d)" % (base, n)
            n += 1
        names[cand] = rp
    nodes = {}
    for virt, rp in names.items():
        nodes[virt] = {"real": rp, "is_dir": os.path.isdir(rp)}
    visited = set()
    def expand(vpath, rpath, depth):
        if depth > 64:
            return False
        real = os.path.realpath(rpath)
        if real in visited:
            return False
        visited.add(real)
        try:
            with os.scandir(rpath) as it:
                for e in it:
                    try:
                        is_dir = e.is_dir(follow_symlinks=False)
                    except OSError:
                        is_dir = False
                    child = (vpath + "/" + e.name) if vpath else e.name
                    cr = e.path
                    if child not in nodes:
                        nodes[child] = {"real": cr, "is_dir": is_dir}
                    if is_dir:
                        expand(child, cr, depth + 1)
            return True
        except OSError:
            return False
    for vpath in list(nodes):
        if nodes[vpath]["is_dir"]:
            expand(vpath, nodes[vpath]["real"], 0)
    return nodes


def _fixed_drives():
    """列出所有固定磁盘（如 C:\\、D:\\）。"""
    drives = []
    try:
        bitmask = ctypes.windll.kernel32.GetLogicalDrives()
        for i in range(26):
            if bitmask & (1 << i):
                d = "%c:\\" % (65 + i)
                if ctypes.windll.kernel32.GetDriveTypeW(d) == 3:  # DRIVE_FIXED
                    drives.append(d)
    except Exception:  # noqa: BLE001
        pass
    return drives or ["C:\\"]


def _dir_denied(path):
    """轻量检测目录是否不可读/不可进入（供列表条目标记 denied=True）。

    Windows 上 os.access 走 CRT _waccess，只查存在性不查 ACL（实测对被
    icacls 拒绝的目录仍返回 True），因此用 scandir 只读第一条试探——
    FindFirstFile 需要 FILE_LIST_DIRECTORY 权限，与用户点击进入目录时的
    真实行为完全一致；仅一次句柄打开 + 首条读取，远轻于完整 listdir。
    非 Windows 回退 os.access(R_OK|X_OK)（POSIX 下权限位判定正确）。
    """
    if os.name == "nt":
        try:
            with os.scandir(path) as it:
                try:
                    next(it)
                except StopIteration:
                    pass
            return False
        except OSError:
            return True
    return not os.access(path, os.R_OK | os.X_OK)


def _is_hidden_entry(name, st):
    """判断条目是否应视为隐藏文件（show_hidden=0 时过滤）：
    - 名称以 "." 开头（点文件）或以 "~" 开头（临时文件 / Office 锁定文件 ~$xxx）
    - Windows HIDDEN 属性(0x2)；但带 SYSTEM 属性(0x4) 的条目不隐藏——
      F: System Volume Information 等系统目录（Hidden+System）必须继续显示（denied 演示依赖）
    """
    if name.startswith(".") or name.startswith("~"):
        return True
    attrs = getattr(st, "st_file_attributes", 0)
    if attrs & 0x4:          # SYSTEM：永不因属性隐藏
        return False
    return bool(attrs & 0x2)  # HIDDEN


def _list_dir(path, show_hidden=False):
    """列出目录内容（目录在前，按名排序）。权限错误返回 None。

    系统锁定的根级噪声文件（DumpStack.log、hiberfil.sys 等）保留在列表中，
    但标记 locked=True，前端以灰色显示并提示"无法下载"。
    目录若 _dir_denied 检测不可读/不可进入，标记 denied=True，
    前端拦截点击并提示"无权限访问该目录"（条目仍展示，便于用户知晓其存在）。
    show_hidden=True 时不过滤隐藏条目（T37：默认隐藏，前端开关驱动）。
    """
    noise = _SYSTEM_NOISE
    out = []
    try:
        with os.scandir(path) as it:
            for e in it:
                try:
                    is_dir = e.is_dir(follow_symlinks=False)
                    st = e.stat(follow_symlinks=False)
                    if not show_hidden and _is_hidden_entry(e.name, st):
                        continue   # T37：隐藏文件过滤
                    denied = is_dir and _dir_denied(e.path)
                    out.append({
                        "name": e.name,
                        "path": os.path.join(path, e.name),
                        "is_dir": is_dir,
                        "size": None if is_dir else st.st_size,
                        "mtime": int(st.st_mtime),
                        "locked": not is_dir and e.name.lower() in noise,
                        "denied": denied,
                    })
                except OSError:
                    continue
    except PermissionError:
        return None
    except OSError as exc:
        return (None, str(exc))
    out.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
    return out, None





# 扩展名 → 预览类型映射（与前端 fileKind 保持一致）
_VIDEO_EXT = {
    "mp4": "video/mp4", "webm": "video/webm", "ogv": "video/ogg", "ogg": "video/ogg",
    "m4v": "video/mp4", "mov": "video/quicktime", "mkv": "video/x-matroska",
    "avi": "video/x-msvideo", "ts": "video/mp2t", "flv": "video/x-flv",
}
_TEXT_EXT = {
    "txt", "log", "json", "js", "ts", "jsx", "tsx", "py", "java", "c", "cpp", "h", "hpp",
    "cs", "go", "rs", "php", "rb", "sh", "bat", "ps1", "html", "htm", "css", "scss", "xml",
    "yaml", "yml", "toml", "ini", "conf", "cfg", "sql", "svg", "env", "gitignore",
}
_MD_EXT = {"md", "markdown"}
_PDF_EXT = {"pdf"}
_LNK_EXT = {"lnk"}
_ARCHIVE_EXT = {"zip", "rar", "7z", "tar", "tgz", "tbz2", "txz", "gz", "bz2", "xz"}
_SYSTEM_NOISE = {"dumpstack.log", "dumpstack.log.tmp", "hiberfil.sys",
                 "pagefile.sys", "swapfile.sys"}


def _preview_kind(path):
    """返回文件的预览类型（优先级 video > pdf > markdown > csv > text > archive > lnk）。"""
    if os.path.isdir(path):
        return None
    ext = os.path.splitext(path)[1].lstrip(".").lower()
    if ext in _VIDEO_EXT:
        return "video"
    if ext in _PDF_EXT:
        return "pdf"
    if ext in _MD_EXT:
        return "markdown"
    if ext == "csv":
        return "csv"
    if ext in _TEXT_EXT:
        return "text"
    if ext in _ARCHIVE_EXT:
        return "archive"
    if ext in _LNK_EXT:
        return "lnk"
    return None


def _stat_file(path):
    """文件/目录详情（功能 1）。"""
    is_dir = os.path.isdir(path)
    st = os.stat(path)
    name = os.path.basename(path) or path
    ext = "" if is_dir else os.path.splitext(name)[1].lstrip(".").lower()
    return {
        "name": name,
        "path": path,
        "is_dir": is_dir,
        "size": None if is_dir else st.st_size,
        "mtime": int(st.st_mtime),
        "ctime": int(st.st_ctime),
        "extension": ext,
        "locked": not is_dir and name.lower() in _SYSTEM_NOISE,
        "preview": _preview_kind(path),
        "details": None if (is_dir or ext not in _VIDEO_EXT) else _video_details(path),
    }


# 进程内缓存：key=(realpath, size, mtime) → _video_details 结果（含 None，ffprobe 失败也缓存）。
# _video_details 会被 /api/list、/api/stat 频繁调用，命中直接返回同一只读 dict。
_video_details_cache = {}


def _parse_comment_meta(comment):
    """把 comment 标签（形如 "上传:1年前 | 观看:665.5萬次 | 标签:自慰、口交"）解析为结构化元数据。

    规则：
      * 先按换行与 | 拆段（个别 | 在值里时，靠"段内含冒号且键是短词"的启发式容忍）；
      * 段匹配 ^([^:：]{1,12})[:：](.+)$ 视为 键:值，键去空白；
      * 键归一化（全角/半角、中英混合，见 key_map）；未识别的键进 extra；
      * 匹配不到冒号的段：非空则整行进 notes。

    返回 dict：{upload,views,likes,author,type,title:str|None,
                tags:[str], notes:[str], extra:[{k,v}]}
    """
    key_map = {
        "上传": "upload", "发布时间": "upload", "发布于": "upload", "时间": "upload",
        "观看": "views", "播放": "views", "播放量": "views", "观看次数": "views",
        "点赞": "likes", "赞": "likes", "好评": "likes", "喜欢": "likes",
        "标签": "tags", "关键字": "tags", "关键词": "tags", "tags": "tags", "key": "tags",
        "作者": "author", "出品": "author", "出品方": "author",
        "UP主": "author", "Up主": "author", "アーティスト": "author",
        "类型": "type", "分类": "type", "类别": "type", "ジャンル": "type",
        "备注": "notes", "评论": "notes", "简介": "notes", "描述": "notes",
        "介绍": "notes", "說明": "notes", "说明": "notes",
        "标题": "title", "影片名": "title",
    }
    res = {"upload": None, "views": None, "likes": None, "author": None,
           "type": None, "title": None, "tags": [], "notes": [], "extra": []}
    if not comment:
        return res
    for seg in re.split(r"\s*[\n|]\s*", str(comment)):
        seg = seg.strip()
        if not seg:
            continue
        m = re.match(r"^([^:：]{1,12})[:：](.+)$", seg)
        if not m:
            res["notes"].append(seg)  # 无法识别为 键:值 的整行 → 备注
            continue
        key = m.group(1).strip()
        val = m.group(2).strip()
        if not val:
            continue
        norm = key_map.get(key.lower()) or key_map.get(key)
        if norm == "tags":  # 标签拆分：、，,;；/・空白，过滤空串与过长（防整句话当标签）
            for t in re.split(r"[、，,;；/・\s]", val):
                t = t.strip()
                if t and len(t) <= 30 and t not in res["tags"]:
                    res["tags"].append(t)
        elif norm == "notes":
            res["notes"].append(val)
        elif norm == "title":
            if res["title"] is None:
                res["title"] = val
        elif norm and res[norm] is None:
            res[norm] = val
        else:
            res["extra"].append({"k": key, "v": val})
    return res


_TECH_LABELS = {
    "encoder": "编码器", "date": "日期", "album": "专辑", "created_time": "创建时间",
    "container_bitrate": "容器码率", "video_codec": "视频编码", "video_bitrate": "视频码率",
    "audio_codec": "音频编码", "sample_rate": "采样率", "channels": "声道",
}


def _video_meta(out, path):
    """从 _video_details 的 out 构建结构化展示 meta（视频详情面板数据源）。

    * title：tag title 优先，其次 comment 的"标题/影片名"键，最后文件名（去扩展名）；
    * author：tag artist 优先，其次 comment；
    * type：tag genre 优先，其次 comment；
    * upload/views/likes/tags/notes/extra：来自 comment 解析（extra 仅放用户写进 comment 的未知键值对）；
    * tech：文件固有技术信息小徽章（encoder/date/album/码率/编码/声道等），与用户级 extra 区分，
            无 comment 视频也只会落到 tech，前端可整体省略也不出错；
    * duration/resolution：复用 out 已有字段。
    只回填识别到的字段，未识别保持 None/空列表，前端据此"识别到才展示"。
    """
    cm = _parse_comment_meta(out.get("comment")) if out.get("comment") else None
    meta = {"title": None, "author": None, "type": None, "upload": None,
            "views": None, "likes": None, "tags": [], "notes": [], "extra": [],
            "tech": [], "duration": None, "resolution": None}
    if out.get("title"):
        meta["title"] = str(out["title"])
    elif cm and cm.get("title"):
        meta["title"] = cm["title"]
    else:
        base = os.path.basename(path) or path
        meta["title"] = os.path.splitext(base)[0]
    if out.get("artist"):
        meta["author"] = str(out["artist"])
    elif cm and cm.get("author"):
        meta["author"] = cm["author"]
    if out.get("genre"):
        meta["type"] = str(out["genre"])
    elif cm and cm.get("type"):
        meta["type"] = cm["type"]
    if cm:
        meta["upload"] = cm["upload"]
        meta["views"] = cm["views"]
        meta["likes"] = cm["likes"]
        meta["tags"] = cm["tags"]
        meta["notes"] = cm["notes"]
        meta["extra"] = cm["extra"]
    for k, label in _TECH_LABELS.items():
        if out.get(k):
            meta["tech"].append({"k": label, "v": str(out[k])})
    if out.get("duration_text"):
        meta["duration"] = str(out["duration_text"])
    if out.get("resolution"):
        meta["resolution"] = str(out["resolution"])
    return meta


def _video_details(path):
    """用 ffprobe 提取视频元数据（Windows 属性式标签，功能 2）。

    任何失败（ffprobe 缺失/超时/解析错误）都静默返回 None，
    绝不抛异常，保证 /api/stat 的其它字段不受影响。
    返回 dict 额外带 meta 字段（结构化详情，供前端视频详情面板展示）。
    进程内缓存 key=(realpath,size,mtime)，命中直接复用（调用方只读使用）。
    """
    try:
        st = os.stat(path)
        ck = (os.path.realpath(path), st.st_size, int(st.st_mtime))
    except OSError:
        ck = None
    if ck is not None and ck in _video_details_cache:
        return _video_details_cache[ck]
    try:
        r = subprocess.run(
            [FFPROBE, "-v", "quiet", "-print_format", "json",
             "-show_format", "-show_streams", path],
            capture_output=True, text=True, encoding="utf-8",
            errors="replace", timeout=10,
        )
        if r.returncode != 0:
            if ck is not None:
                _video_details_cache[ck] = None
            return None
        data = json.loads(r.stdout)
    except Exception:  # noqa: BLE001
        if ck is not None:
            _video_details_cache[ck] = None
        return None
    fmt = data.get("format") or {}
    tags = fmt.get("tags") or {}
    out = {}
    # format.tags：键存在且有值（非空、非 "N/A"）才写入
    for k in ("title", "artist", "album", "comment", "date", "genre", "encoder"):
        v = tags.get(k)
        if v and str(v).strip() and str(v).strip() != "N/A":
            out[k] = str(v)
    if tags.get("creation_time"):
        out["created_time"] = str(tags["creation_time"])
    try:  # duration → duration_sec + duration_text("MM:SS")
        dur = float(fmt.get("duration"))
        out["duration_sec"] = round(dur, 1)
        m, s = divmod(int(dur), 60)
        out["duration_text"] = "%02d:%02d" % (m, s)
    except (TypeError, ValueError):
        pass
    br = fmt.get("bit_rate")
    if br and str(br) not in ("N/A", "0"):
        out["container_bitrate"] = str(br)
    vstream = astream = None
    for s in data.get("streams") or []:
        if s.get("codec_type") == "video" and vstream is None:
            vstream = s
        elif s.get("codec_type") == "audio" and astream is None:
            astream = s
    if vstream:
        if vstream.get("codec_name"):
            out["video_codec"] = str(vstream["codec_name"])
        w, h = vstream.get("width"), vstream.get("height")
        if w and h:
            out["resolution"] = "%dx%d" % (w, h)
        vbr = vstream.get("bit_rate")
        if vbr and str(vbr) not in ("N/A", "0"):
            out["video_bitrate"] = str(vbr)
    if astream:
        if astream.get("codec_name"):
            out["audio_codec"] = str(astream["codec_name"])
        if astream.get("sample_rate"):
            out["sample_rate"] = str(astream["sample_rate"])
        if astream.get("channels"):
            out["channels"] = astream["channels"]
    out["meta"] = _video_meta(out, path)
    if ck is not None:
        _video_details_cache[ck] = out
    return out


# ------------------------------------------------------------------ meta=1（侧边栏元数据）
# api/list?meta=1 为每个 entry 附加便于搜索/筛选的 meta 字段：分类 kind + mime，
# 视频额外附 duration/width/height。重点约束：大目录（几千文件）绝不卡死——
# 视频的 ffprobe 探测有并发上限与总预算，且多请求互斥；无 meta 参数时零附加开销。

_VIDEO_PROBE_LOCK = threading.Lock()      # meta=1 批量视频探测互斥（避免并发探测风暴）
_VIDEO_PROBE_WORKERS = 8                  # 并发 ffprobe 进程上限
_VIDEO_PROBE_BUDGET_SEC = 3.0             # 单次 meta=1 的视频探测总预算，到点立即返回

# 分类集合固定为：video/audio/image/text/code/archive/exe/lnk/other（+dir 目录）
_AUDIO_EXT = {"mp3", "wav", "flac", "aac", "m4a", "wma", "ape", "opus",
              "mid", "midi", "aiff", "aif", "au"}
_IMAGE_EXT = {"jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "ico",
              "tif", "tiff", "heic", "heif", "avif", "jfif"}
_CODE_EXT = {"js", "ts", "jsx", "tsx", "py", "java", "c", "cpp", "h", "hpp",
             "cs", "go", "rs", "php", "rb", "sh", "ps1", "html", "htm", "css",
             "scss", "xml", "yaml", "yml", "toml", "sql", "json"}
_PLAIN_TEXT_EXT = {"txt", "log", "md", "markdown", "csv", "ini", "conf", "cfg",
                   "env", "srt", "sub", "vtt", "nfo", "rtf", "pdf"}
_ARCHIVE_KIND_EXT = {"zip", "rar", "7z", "tar", "tgz", "tbz2", "txz",
                     "gz", "bz2", "xz", "zst", "cab", "jar", "iso"}
_EXE_EXT = {"exe", "msi", "apk", "com", "scr", "bat", "cmd"}
_MIME_BY_EXT = {
    # image
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif",
    "webp": "image/webp", "bmp": "image/bmp", "svg": "image/svg+xml", "ico": "image/x-icon",
    "tif": "image/tiff", "tiff": "image/tiff", "heic": "image/heic", "avif": "image/avif",
    # audio
    "mp3": "audio/mpeg", "wav": "audio/wav", "flac": "audio/flac", "aac": "audio/aac",
    "m4a": "audio/mp4", "wma": "audio/x-ms-wma", "opus": "audio/opus",
    "mid": "audio/midi", "midi": "audio/midi",
    # text / 文档
    "txt": "text/plain", "log": "text/plain", "md": "text/markdown", "markdown": "text/markdown",
    "csv": "text/csv", "rtf": "application/rtf", "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "ppt": "application/vnd.ms-powerpoint",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    # code
    "json": "application/json", "xml": "application/xml", "html": "text/html", "htm": "text/html",
    "css": "text/css", "js": "application/javascript", "ts": "application/typescript",
    "py": "text/x-python", "java": "text/x-java-source", "sh": "application/x-sh",
    "sql": "application/sql", "yaml": "application/yaml", "yml": "application/yaml",
    # archive
    "zip": "application/zip", "rar": "application/vnd.rar", "7z": "application/x-7z-compressed",
    "tar": "application/x-tar", "gz": "application/gzip", "tgz": "application/gzip",
    "tbz2": "application/x-bzip2", "txz": "application/x-xz",
    "bz2": "application/x-bzip2", "xz": "application/x-xz",
    "zst": "application/zstd", "cab": "application/vnd.ms-cab-compressed",
    "jar": "application/java-archive", "iso": "application/x-iso9660-image",
    # exe / lnk
    "exe": "application/x-msdownload", "msi": "application/x-msi",
    "apk": "application/vnd.android.package-archive",
    "lnk": "application/x-ms-shortcut",
}


def _meta_kind(ext):
    """扩展名 → (分类, mime)。分类集合固定为 video/audio/image/text/code/archive/exe/lnk/other。
    按优先级逐一匹配，避免交集扩展名（如 ogg 归 video、svg 归 image）重复归类。"""
    if ext in _VIDEO_EXT:
        return "video", _VIDEO_EXT[ext]
    if ext in _AUDIO_EXT:
        return "audio", _MIME_BY_EXT.get(ext)
    if ext in _IMAGE_EXT:
        return "image", _MIME_BY_EXT.get(ext)
    if ext in _ARCHIVE_KIND_EXT:
        return "archive", _MIME_BY_EXT.get(ext)
    if ext in _LNK_EXT:
        return "lnk", _MIME_BY_EXT.get(ext)
    if ext in _EXE_EXT:
        return "exe", _MIME_BY_EXT.get(ext)
    if ext in _CODE_EXT:
        return "code", _MIME_BY_EXT.get(ext)
    if ext in _PLAIN_TEXT_EXT:
        return "text", _MIME_BY_EXT.get(ext)
    return "other", None


def _video_meta_cached(path):
    """meta=1 专用：仅从 _video_details_cache 读视频元数据，未命中返回 None。
    绝不运行 ffprobe，保证列表读取零阻塞；探测由 _probe_video_meta 后台负责。
    除 duration/width/height 外，附带内容性字段 title/author/type/tags/notes，
    全部取自缓存值 d["meta"]（与 _video_meta 输出一致，已从 tag/comment 解析），
    零 IO；未探测过则缓存为 None，这些字段自然缺失，不触发任何探测。"""
    try:
        st = os.stat(path)
        ck = (os.path.realpath(path), st.st_size, int(st.st_mtime))
    except OSError:
        return None
    d = _video_details_cache.get(ck)
    if not d:
        return None
    out = {}
    if d.get("duration_sec"):
        out["duration"] = d["duration_sec"]
    res = d.get("resolution")
    if res:
        try:
            w, h = str(res).split("x", 1)
            out["width"], out["height"] = int(w), int(h)
        except (ValueError, AttributeError):
            pass
    m = d.get("meta") or {}
    for k in ("title", "author", "type"):
        v = m.get(k)
        if v:
            out[k] = v
    for k in ("tags", "notes"):
        v = m.get(k)
        if v:
            out[k] = list(v)
    return out or None


def _probe_video_meta(paths):
    """meta=1 专用：并发探测未命中缓存的视频（ffprobe），预算内等待、到点立即返回。
    失败静默跳过（_video_details 内部已兜底）；预算后未完成任务由 executor 后台线程
    继续执行、成功后写入进程内缓存，后续 meta=1 请求直接命中。多请求并发时互斥跳过，
    绝不重复探测、绝不阻塞列表。"""
    if not paths:
        return
    if not _VIDEO_PROBE_LOCK.acquire(blocking=False):
        return  # 已有探测在进行：本次只返回缓存结果，列表不阻塞
    try:
        ex = ThreadPoolExecutor(max_workers=_VIDEO_PROBE_WORKERS)
        try:
            futs = [ex.submit(_video_details, p) for p in paths]
            deadline = time.monotonic() + _VIDEO_PROBE_BUDGET_SEC
            for f in futs:
                try:
                    f.result(timeout=max(0.0, deadline - time.monotonic()))
                except Exception:  # noqa: BLE001  超时/ffprobe 失败一律静默
                    pass
        finally:
            ex.shutdown(wait=False)  # 未完成任务由后台线程继续 → 写缓存
    finally:
        _VIDEO_PROBE_LOCK.release()


def _augment_entries_meta(entries, real_map=None):
    """api/list?meta=1：给每个 entry 附加 meta 字段（供前端侧边栏搜索/筛选/排序）。

    * 目录：{"kind": "dir"}
    * 文件：{"kind": 分类, "mime": 类型}，kind ∈ {video/audio/image/text/code/archive/exe/lnk/other}
    * 视频额外附 duration（秒）/width/height：优先读进程内缓存（零 IO），
      未命中进探测队列由 _probe_video_meta 并发探测（预算内快速失败，绝不阻塞列表）。
    文本/代码文件无需读内容，仅按扩展名给出类型标识。
    real_map：虚拟分享用（entry["path"] → 真实路径），缺省直接用 entry["path"]。
    """
    videos = []
    for e in entries:
        if e["is_dir"]:
            e["meta"] = {"kind": "dir"}
            continue
        real = (real_map or {}).get(e["path"], e["path"])
        ext = os.path.splitext(e["name"])[1].lstrip(".").lower()
        kind, mime = _meta_kind(ext)
        meta = {"kind": kind}
        if mime:
            meta["mime"] = mime
        if kind == "video":
            v = _video_meta_cached(real)
            if v:
                meta.update(v)
            else:
                videos.append(real)
        e["meta"] = meta
    if videos:
        _probe_video_meta(videos)
    return entries


def _detect_bom(raw):
    """识别 BOM 编码；返回 (编码名, BOM 字节数)，无 BOM 返回 (None, 0)。"""
    if raw[:4] == b"\x00\x00\xfe\xff":
        return "utf-32le", 4
    if raw[:3] == b"\xef\xbb\xbf":
        return "utf-8-sig", 3
    if raw[:2] == b"\xff\xfe":
        return "utf-16le", 2
    if raw[:2] == b"\xfe\xff":
        return "utf-16be", 2
    return None, 0


# 常见二进制/压缩/文档魔数（用于拦截"伪装成文本"的二进制文件）
_BINARY_MAGICS = (
    (b"PK\x03\x04", "zip"),          # zip / xlsx / docx / jar
    (b"\x89PNG\r\n\x1a\n", "png"),
    (b"\xff\xd8\xff", "jpeg"),
    (b"GIF8", "gif"),
    (b"%PDF", "pdf"),
    (b"\x1f\x8b", "gzip"),
    (b"\x7fELF", "elf"),
    (b"MZ", "exe"),                    # PE（exe/dll）
    (b"\xca\xfe\xba\xbe", "java"),
    (b"\x00\x00\x01\x00", "ico"),
    (b"BM", "bmp"),
)


def _has_binary_magic(raw):
    """常见二进制/压缩/文档魔数判定（优先级最高：zip 等结构字节可能形似 UTF-16）。"""
    if not raw:
        return False
    for magic, _ in _BINARY_MAGICS:
        if raw.startswith(magic):
            return True
    # mp4/mov/3gp：偏移 4 处为 "ftyp"
    if len(raw) >= 8 and raw[4:8] == b"ftyp":
        return True
    # webp：RIFF....WEBP
    if len(raw) >= 12 and raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return True
    return False


def _looks_binary(raw):
    """二进制判定：魔数 + 空字节比例（>3%）双保险。
    注意：调用方需先排除 BOM / UTF-16 文本，否则 UTF-16 的空字节会误判。"""
    return bool(raw) and (_has_binary_magic(raw) or raw.count(b"\x00") / len(raw) > 0.03)


def _detect_utf16_nobom(raw):
    """无 BOM UTF-16 启发式。

    返回 (编码名, 字节起点)；起点用于跳过 ASCII 前缀（混合编码文件）。
    偶数位 \x00 多 → BE，奇数位 \x00 多 → LE。
    兼容"ASCII 前缀 + UTF-16 主体"的混合文件（如 START 头部后接 UTF-16LE）：
    先找 UTF-16 CRLF 线索（LE: \r\x00\n\x00 / BE: \x00\r\x00\n）确定端序与起点；
    无线索则整体统计，起点 0。
    """
    n = min(len(raw), 512)
    if n < 8:
        return None
    # 1) CRLF 线索优先（混合编码文件：ASCII 前缀 + UTF-16 主体）
    for i in range(n - 3):
        if raw[i] == 0x0D and raw[i + 1] == 0x00 and raw[i + 2] == 0x0A and raw[i + 3] == 0x00:
            return "utf-16le", i
            return "utf-16le", i - (i % 2)
            return "utf-16be", i
            return "utf-16be", i - (i % 2)
    # 2) 无 CRLF 线索：整体奇偶统计（起点 0）
    evens = sum(1 for i in range(0, n, 2) if raw[i] == 0)
    odds = sum(1 for i in range(1, n, 2) if raw[i] == 0)
    half = n / 2
    if evens > half * 0.6:
        return "utf-16be", 0
    if odds > half * 0.6:
        return "utf-16le", 0
    return None


def _smart_decode(raw, fallback_errors="replace"):
    """通用字节解码：BOM → 无 BOM UTF-16 → utf-8 → gbk → gb18030 → latin-1。
    返回 (text, encoding)。供文本预览 / 字幕 / 子进程输出等所有编码点共用（t14）。"""
    if not raw:
        return "", "utf-8"
    enc_name, bom_len = _detect_bom(raw)
    u16_start = 0
    if not enc_name:
        u16 = _detect_utf16_nobom(raw)
        if u16:
            enc_name, u16_start = u16
    if enc_name:
        # 跳过 BOM 或 ASCII 前缀（混合编码）后再解码
        start = bom_len if bom_len else u16_start
        return raw[start:].decode(enc_name, errors=fallback_errors), enc_name
    # gbk 优先（大陆主流）；gbk 严格失败时试 big5（繁体）；gb18030 兜底（GBK 超集，全 Unicode）
    for enc in ("utf-8", "gbk", "big5", "gb18030"):
        try:
            text = raw.decode(enc)
        except UnicodeDecodeError:
            continue
        # GBK 的 A4xx 区是日文假名，而 Big5 的 A4xx 区是常用汉字：
        # gbk 解码出大量假名（>50%）→ 很可能是 Big5 中文被误解码，改试 big5
        if enc == "gbk" and len(text) >= 2:
            kana = sum(1 for ch in text if "\u30a0" <= ch <= "\u30ff")
            if kana / len(text) > 0.5:
                try:
                    return raw.decode("big5"), "big5"
                except UnicodeDecodeError:
                    pass
        return text, enc
    return raw.decode("latin-1", errors=fallback_errors), "latin-1"


def _read_text(path, limit=1024 * 1024):
    """读取文本文件前 limit 字节；BOM / 无 BOM UTF-16 优先，否则 utf-8 → gbk → latin-1 逐级解码。
    伪装成 .txt/.csv/.md 的二进制文件（xlsx/zip/图片等）返回明确错误而非乱码。"""
    ext = os.path.splitext(path)[1].lstrip(".").lower()
    kind = "markdown" if ext in _MD_EXT else ("csv" if ext == "csv" else "text")
    with open(path, "rb") as fh:
        head = fh.read(4)
        rest = fh.read(limit + 1 - len(head)) if limit + 1 > len(head) else b""
        raw = head + rest
    truncated = len(raw) > limit
    if truncated:
        raw = raw[:limit]
    name = os.path.basename(path) or path
    # 编码识别顺序：BOM → 二进制魔数 → 无 BOM UTF-16 → 空字节比例 → utf-8/gbk/latin-1
    enc_name, bom_len = _detect_bom(raw)
    if not enc_name:
        if _has_binary_magic(raw):
            # 魔数优先：zip/xlsx/图片等，即使结构字节形似 UTF-16 也是二进制
            return {
                "name": name,
                "kind": "binary",
                "error": "该文件是二进制文件，无法文本预览",
                "total_size": os.path.getsize(path),
                "read_bytes": len(raw),
            }
        u16 = _detect_utf16_nobom(raw)
        if u16:
            enc_name, u16_start = u16
            bom_len = 0
        elif raw and raw.count(b"\x00") / len(raw) > 0.03:
            # 非 UTF-16 文本但空字节比例高 → 二进制（如部分压缩/加密数据）
            return {
                "name": name,
                "kind": "binary",
                "error": "该文件是二进制文件，无法文本预览",
                "total_size": os.path.getsize(path),
                "read_bytes": len(raw),
            }
    if enc_name:
        # BOM/UTF-16 编码：可能被 limit 截成奇数个字节，用 replace 兜底避免抛错；
        # u16_start 用于跳过 ASCII 前缀（混合编码文件：ASCII 头 + UTF-16 主体）
        start = bom_len if bom_len else u16_start
        content = raw[start:].decode(enc_name, errors="replace")
        encoding = enc_name
    else:
        # 无 BOM / 非 UTF-16：utf-8 → gbk → gb18030 → latin-1（gb18030 兼容繁体）
        content, encoding = _smart_decode(raw)
    return {
        "name": name,
        "kind": kind,
        "encoding": encoding,
        "content": content,
        "truncated": truncated,
        "truncated_bytes": max(0, os.path.getsize(path) - limit) if truncated else 0,
        "total_size": os.path.getsize(path),
        "read_bytes": len(raw),
    }


def _parse_read_limit(q, default=1024 * 1024):
    """解析 /api/read 的 limit 参数（非法/缺失用默认值，越界钳制到 16KB~4MB）。"""
    raw = q.get("limit")
    if raw is None:
        return default
    try:
        n = int(raw)
    except (TypeError, ValueError):
        return default
    if n < 16 * 1024:
        n = 16 * 1024
    elif n > 4 * 1024 * 1024:
        n = 4 * 1024 * 1024
    return n


def _lnk_target(path):
    """解析 Windows .lnk 快捷方式目标（PowerShell COM）。

    用 WScript.Shell 读取 TargetPath / WorkingDirectory / Arguments 三行输出。
    路径含单引号时需转义（单引号翻倍），避免破坏 PowerShell 字符串。
    失败（目标为空 / 超时 / 非零退出）返回 ok=False。
    """
    esc = path.replace("'", "''")
    ps = (
        # T32：强制 PowerShell 输出 UTF-8，避免中文目标路径被按 OEM/GBK 解码成乱码
        # （实测 Windows PowerShell 5.1 管道输出为 UTF-8 字节，原 gbk 解码导致
        #  "ai大模型api备注.txt" → "ai澶фā鍨媋pi澶囨敞.txt"，目标被误判失效）
        "$OutputEncoding=[Console]::OutputEncoding=[Text.Encoding]::UTF8; "
        "$sh=New-Object -ComObject WScript.Shell; "
        "$s=$sh.CreateShortcut('%s'); "
        "Write-Output $s.TargetPath; "
        "Write-Output $s.WorkingDirectory; "
        "Write-Output $s.Arguments" % esc
    )
    # powershell 可能不在 PATH（服务经 Start-Process/批处理启动时环境受限）：
    # 先用绝对路径（Windows PowerShell 5.1 固定位置），再退回 PATH 查找。
    ps_exe = r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
    if not os.path.isfile(ps_exe):
        ps_exe = "powershell"   # 兜底：靠 PATH（部分系统可用）
    try:
        r = subprocess.run(
            [ps_exe, "-NoProfile", "-Command", ps],
            capture_output=True, text=True, encoding="utf-8",
            errors="replace", timeout=20,
        )
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": "解析失败: %s" % exc}
    if r.returncode != 0:
        return {"ok": False, "error": "解析失败: %s" % ((r.stderr or "").strip() or "PowerShell 错误")}
    lines = [ln.strip() for ln in (r.stdout or "").splitlines() if ln.strip()]
    target = lines[0] if lines else ""
    workdir = lines[1] if len(lines) > 1 else ""
    args = lines[2] if len(lines) > 2 else ""
    if not target:
        return {"ok": False, "error": "解析失败: 目标为空"}
    return {
        "ok": True,
        "target": target,
        "is_dir": os.path.isdir(target),
        "exists": os.path.exists(target),
        "workdir": workdir,
        "args": args,
    }


def _thumb_path(path):
    """视频缩略图：缓存命中直接返回，否则用 ffmpeg 抽帧生成。

    缓存目录 STATIC_DIR/thumbs，缓存文件名 md5(realpath|size|mtime).jpg，
    文件内容变化（大小/时间）时自动失效。先 -ss 3 抽帧，失败回退 -ss 0；
    仍失败或 ffmpeg 缺失返回 None。多线程并发写同一缓存用 try/except 容忍。
    """
    if not os.path.isfile(path):
        return None
    ext = os.path.splitext(path)[1].lstrip(".").lower()
    if ext not in _VIDEO_EXT:
        return None
    try:
        st = os.stat(path)
        key = "%s|%d|%d" % (os.path.realpath(path), st.st_size, int(st.st_mtime))
        digest = hashlib.md5(key.encode("utf-8")).hexdigest()
    except OSError:
        return None
    cache_dir = os.path.join(STATIC_DIR, "thumbs")
    try:
        os.makedirs(cache_dir, exist_ok=True)
    except OSError:
        return None
    out = os.path.join(cache_dir, digest + ".jpg")
    if os.path.isfile(out):
        return out
    if not os.path.isfile(FFMPEG):
        return None
    for ss in ("3", "0"):
        cmd = [FFMPEG, "-y", "-ss", ss, "-i", path,
               "-frames:v", "1", "-vf", "scale=360:-2", "-q:v", "6", out]
        try:
            r = subprocess.run(cmd, capture_output=True, timeout=60)
            if r.returncode == 0 and os.path.isfile(out):
                return out
        except Exception:  # noqa: BLE001
            continue
    return None


# ------------------------------------------------------------------ MSE 转码 / 缓存下载 / 字幕 / 缩略图条
# 设计要点（与前端 app.js 自洽）：
#   1. 原画(original)档：不重编码，直接复用 api/stream 的 Range 流并同步写完整缓存文件
#      （边播边缓存，播完即得完整文件，可直接当下载用）。
#   2. 高清/标清/低清：由常驻 ffmpeg 转码，输出 fragmented MP4(fMP4) 到内存缓冲，
#      同时把全部输出累加落盘为 <digest>.<q>.mp4 缓存文件（供下载/分享）。
#      api/trans 按 offset 从缓冲取新增字节返回，前端用 MediaSource(SourceBuffer) 追加，
#      从而绕开"媒体子资源证书限制"（MSE 喂入的数据格式嗅探不受该限制）。
#      MSE 免证书模式下原画档也走此通道：ffmpeg -c copy 快速转封装为 fMP4，不重编码。
#   3. 所有分片来自同一次 ffmpeg 的连续输出（常驻进程），保证 moof 序列号连续可拼接。
#   4. 会话空闲 60s 自动终止，释放进程。


def _trans_digest(path):
    """缓存目录名：sha256(realpath(path))。"""
    try:
        return hashlib.sha256(os.path.realpath(path).encode("utf-8")).hexdigest()
    except OSError:
        return hashlib.sha256(path.encode("utf-8")).hexdigest()


def _trans_dir(path):
    """转码缓存目录 ~/.transfer-mcp/transcache/<digest>/，不存在则创建。"""
    d = os.path.join(TRANSCACHE_DIR, _trans_digest(path))
    try:
        os.makedirs(d, exist_ok=True)
    except OSError:
        pass
    return d


def _trans_cache_file(path, q):
    """转码档完整缓存文件路径：<digest>.<q>.mp4。"""
    return os.path.join(_trans_dir(path), "%s.%s.mp4" % (_trans_digest(path), q))


# ------------------------------------------------------------- ffmpeg 编码器能力探测
# 惰性探测（首次转码请求时执行一次并缓存）：确认 FFMPEG 带 libx264/aac 编码器，
# 避免"精简版 ffmpeg"（无 aac/libopus）转码静默失败，给出明确报错而非含糊的启动失败。
_ffmpeg_caps = None
_ffmpeg_caps_lock = threading.Lock()


def _ffmpeg_capabilities():
    """探测 ffmpeg 是否具备 libx264/aac 编码器；结果缓存，超时 5s。

    返回 {"ok": bool, "missing": [...]}。任何失败（超时/非零退出/异常）都视为
    编码器缺失（宁可明确报错，也不让转码进程悄悄失败）。探测很快（-encoders
    只输出一次列表），且只在第一次需要转码时才执行，不阻塞服务启动。
    """
    global _ffmpeg_caps
    if _ffmpeg_caps is not None:
        return _ffmpeg_caps
    with _ffmpeg_caps_lock:
        if _ffmpeg_caps is not None:
            return _ffmpeg_caps
        missing = []
        try:
            r = subprocess.run(
                [FFMPEG, "-hide_banner", "-encoders"],
                capture_output=True, text=True, encoding="utf-8",
                errors="replace", timeout=5,
            )
            if r.returncode != 0:
                missing.append("libx264/aac")
            else:
                out = r.stdout or ""
                if not re.search(r"(?m)^\s*V[^\n]*\blibx264\b", out):
                    missing.append("libx264")
                if not re.search(r"(?m)^\s*A[^\n]*\baac\b", out):
                    missing.append("aac")
        except Exception:  # noqa: BLE001
            missing.append("libx264/aac")
        _ffmpeg_caps = {"ok": not missing, "missing": missing}
        return _ffmpeg_caps


def _video_src_info(path):
    """用 ffprobe 读源视频的宽高/时长/旋转及编码信息；失败返回 None。

    返回 dict：width/height/rotation/duration（原有字段，向后兼容）+
    video_codec/video_profile/video_level/audio_codec（vinfo 用）。
    """
    try:
        r = subprocess.run(
            [FFPROBE, "-v", "quiet", "-print_format", "json",
             "-show_streams", "-show_format", path],
            capture_output=True, text=True, encoding="utf-8",
            errors="replace", timeout=15,
        )
        if r.returncode != 0:
            return None
        data = json.loads(r.stdout)
    except Exception:  # noqa: BLE001
        return None
    vstream = astream = None
    for s in data.get("streams") or []:
        if s.get("codec_type") == "video" and vstream is None:
            vstream = s
        elif s.get("codec_type") == "audio" and astream is None:
            astream = s
    vw = vh = None
    rot = 0
    vcodec = vprofile = None
    vlevel = None
    if vstream is not None:
        vw = int(vstream["width"]) if vstream.get("width") else None
        vh = int(vstream["height"]) if vstream.get("height") else None
        t = vstream.get("tags") or {}
        try:
            rot = int(float(t.get("rotate") or 0)) % 360
        except (TypeError, ValueError):
            rot = 0
        vcodec = vstream.get("codec_name")
        vprofile = vstream.get("profile")
        try:
            vlevel = int(vstream.get("level"))
        except (TypeError, ValueError):
            vlevel = None
    # 旋转 90/270 时宽高互换
    if vw and vh and rot in (90, 270):
        vw, vh = vh, vw
    acodec = astream.get("codec_name") if astream is not None else None
    dur = None
    try:
        fmt = data.get("format") or {}
        dur = float(fmt.get("duration"))
    except (TypeError, ValueError):
        dur = None
    return {
        "width": vw, "height": vh, "rotation": rot, "duration": dur,
        "video_codec": vcodec, "video_profile": vprofile, "video_level": vlevel,
        "audio_codec": acodec,
    }


# ----------------------------------------------------- MSE codec 探测（/api/vinfo）
# 契约（前端 app.js 依赖，务必保持一致）：
#   * 转码档(high/medium/low) 视频固定 avc1.640033（High profile/level 5.1）；
#     音频按源决定：源有音频 → mp4a.40.2（转码输出恒为 aac），源无音频 → 仅视频 codec。
#   * 原画档(original) 按源编码换算：h264 → avc1.PPCCLL；h265 → hvc1.*；其它 → 兜底 avc1.640033。
#   * 原画音频：aac→mp4a.40.2；mp3→mp4a.6B；其它→""（前端只声明视频 codec）。
_AVC1_PROFILE_HEX = {
    "Baseline": 0x42, "Main": 0x4D, "High": 0x64,
    "High10": 0x6E, "High422": 0x7A, "High444": 0x90,
}
# x264 输出常见 constraint_set_flags：Baseline 带 0xE0（约束基线），Main 带 0x40，High 0x00
_AVC1_CONSTRAINT_HEX = {"Baseline": 0xE0, "Main": 0x40}


def _avc1_from_profile(profile_name, level_idc):
    """把 ffprobe 的 h264 profile 名 + level 换算成 avc1.PPCCLL 字符串；失败返回 None。"""
    try:
        prof = (profile_name or "").replace("Constrained", "").replace(" ", "").strip()
        pid = _AVC1_PROFILE_HEX.get(prof, 0x64)
        try:
            lvl = int(level_idc)
        except (TypeError, ValueError):
            lvl = 0
        if not (0 < lvl < 256):
            lvl = 40
        cons = _AVC1_CONSTRAINT_HEX.get(prof, 0x00)
        return "avc1.%02X%02X%02X" % (pid, cons, lvl)
    except Exception:  # noqa: BLE001
        return None


def _hvc1_from_profile(profile_name, level_idc):
    """把 ffprobe 的 h265 profile 名 + level 换算成 hvc1 串（best-effort）；失败返回 None。

    结构 hvc1.<profile_space>.<profile_idc>.<compat>.<tier><level>.<constraint>；
    ffprobe 不暴露 profile_space/compatibility/constraint，取值按主档常规默认构造，
    失败时由调用方回退为裸 "hvc1"。
    """
    try:
        prof = (profile_name or "Main").replace(" ", "")
        pid = {"Main": 1, "Main10": 2, "MainStill": 3, "Rext": 4}.get(prof, 1)
        try:
            lvl = int(level_idc)
        except (TypeError, ValueError):
            lvl = 0
        if not (0 < lvl < 512):
            return None
        compat = 0x60 if pid in (1, 2) else 0x00
        return "hvc1.0.%d.%02X.L%d.%02X" % (pid, compat, lvl, 0x00)
    except Exception:  # noqa: BLE001
        return None


def _audio_codec_part(codec_name):
    """源音频 codec → MSE codec 串；aac→mp4a.40.2，mp3→mp4a.6B，其它→""。"""
    c = (codec_name or "").lower()
    if c == "aac":
        return "mp4a.40.2"
    if c == "mp3":
        return "mp4a.6B"
    return ""


def _original_video_codec(info):
    """q=original 时按源编码构造视频 codec 串；无法构造返回 None（调用方兜底）。"""
    if not info:
        return None
    codec = (info.get("video_codec") or "").lower()
    if codec == "h264":
        return _avc1_from_profile(info.get("video_profile"), info.get("video_level")) or "avc1.640033"
    if codec in ("hevc", "h265"):
        return _hvc1_from_profile(info.get("video_profile"), info.get("video_level")) or "hvc1"
    return None


def _vinfo_mime(info, quality):
    """按契约构造 mseMime 字符串；info 为 _video_src_info 结果（可能为 None）。"""
    if quality != "original":
        # 转码档输出音频恒为 aac（-c:a aac），源有音频流才有输出；
        # 源无音频（如 -an 视频）时 mime 只声明视频 codec，避免 MSE 初始化与实际流不匹配
        if info and info.get("audio_codec"):
            return 'video/mp4; codecs="avc1.640033, mp4a.40.2"'
        return 'video/mp4; codecs="avc1.640033"'
    vcodec = _original_video_codec(info)
    if not vcodec:  # 探测失败/无法构造 → 兜底
        return 'video/mp4; codecs="avc1.640033, mp4a.40.2"'
    acodec = _audio_codec_part(info.get("audio_codec")) if info else ""
    if acodec:
        return 'video/mp4; codecs="%s, %s"' % (vcodec, acodec)
    return 'video/mp4; codecs="%s"' % vcodec


def _trans_resolution(src_w, q):
    """由源宽与目标档位计算输出宽（低于/等于目标则用源宽），返回宽或 None。"""
    if src_w is None:
        return None
    target = _TRANS_QUALITIES.get(q)
    if target is None:
        return None
    return min(src_w, target)


def _trans_args(src_path, q, start_sec, resolution):
    """构造一条 fMP4 转码命令（从 start_sec 起连续转码到文件尾）。

    关键：所有分片来自同一次 ffmpeg 的连续输出（moof 序列号从 0 连续递增），
    前端才能用 MediaSource SourceBuffer 无缝 append。故不做分段 -t 重启。
    只取首个视频流+首个音频流（跳过字幕流，避免默认编码字幕失败）；
    重编码视频为 h264 libx264 High profile（avc1.640033，现代手机全支持）+
    yuv420p，音频 aac；直播式实时压制参数（ultrafast/zerolatency）保证
    立即起播且 CPU 占用低，固定关键帧间隔利于流式与拖动，crf 27 压低码率。
    输出容器为 fragmented mp4（empty_moov 使 moov 前置，前端可立即 append）。
    """
    cmd = [FFMPEG, "-y", "-ss", "%s" % start_sec, "-i", src_path,
            "-map", "0:v:0", "-map", "0:a:0?",
            "-c:v", "libx264", "-profile:v", "high", "-level:v", "5.1",
            "-preset", "ultrafast", "-tune", "zerolatency",
            "-x264opts", "cabac=1:8x8dct=1",
            "-crf", "27", "-g", "60", "-keyint_min", "60", "-sc_threshold", "0",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "frag_keyframe+empty_moov+default_base_moof",
            "-f", "mp4", "-"]
    if resolution:
        cmd.insert(cmd.index("-profile:v"), "-vf")
        cmd.insert(cmd.index("-profile:v"), "scale=%d:-2" % resolution)
    return cmd


def _trans_remux_args(src_path, start_sec):
    """原画免证书：-c copy 快速转封装为 fMP4（不重编码），供 MSE 原画档。"""
    return [FFMPEG, "-y", "-ss", "%s" % start_sec, "-i", src_path,
            "-map", "0:v:0", "-map", "0:a:0?", "-c", "copy",
            "-movflags", "frag_keyframe+empty_moov+default_base_moof",
            "-f", "mp4", "-"]


def _trans_encode_thread(sess, src_path, q, resolution):
    """常驻转码线程：单个 ffmpeg 从 start 秒连续输出 fMP4 到缓冲与缓存文件。

    缓冲只保留未消费字节（前端按 offset 顺序拉取，_trans_consume 边取边裁剪）。
    为防 ffmpeg 无界输出撑爆内存，未消费缓冲超过阈值时 sleep 节流（读慢 = ffmpeg
    管道背压自然减速）；转码自然结束后即得完整 <digest>.<q>.mp4（供下载/分享）。
    """
    session = sess
    session["running"] = True
    if session["cfile"]:
        # 会话创建时已截断；此处兜底，防止文件在两次会话间被外部重建
        try:
            with open(session["cfile"], "wb"):
                pass
        except OSError:
            pass
    try:
        start = session["start"]
        if resolution is None:
            cmd = _trans_remux_args(src_path, start)
        else:
            cmd = _trans_args(src_path, q, start, resolution)
        try:
            proc = subprocess.Popen(
                cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                bufsize=0,
            )
        except Exception:  # noqa: BLE001
            session["error"] = "ffmpeg 启动失败"
            session["running"] = False
            return
        session["proc"] = proc
        out = proc.stdout
        while session["active"]:
            chunk = out.read(65536)
            if not chunk:
                break
            with session["lock"]:
                pend = len(session["buf"])
                session["buf"].extend(chunk)
                session["last"] = time.time()
            if session["cfile"]:
                try:
                    with open(session["cfile"], "ab") as fh:
                        fh.write(chunk)
                except OSError:
                    pass
            if pend > 16 * 1024 * 1024:
                time.sleep(0.05)
        try:
            proc.wait(timeout=5)
        except Exception:  # noqa: BLE001
            try:
                proc.kill()
            except Exception:  # noqa: BLE001
                pass
        session["proc"] = None
        session["done"] = True
    except Exception as exc:  # noqa: BLE001
        session["error"] = str(exc)
    finally:
        session["running"] = False


def _session_gc(session):
    """标记会话不活跃并回收其残存进程（供空闲超时清理）。"""
    with session["lock"]:
        session["active"] = False
        session["expired"] = True
    proc = session["proc"]
    if proc is not None:
        try:
            proc.terminate()
        except Exception:  # noqa: BLE001
            try:
                proc.kill()
            except Exception:  # noqa: BLE001
                pass


def _trans_ensure_session(path, q, start_sec, persist=True):
    """获取（或创建）转码会话；key 含 start 秒（每次 seek 是独立连续流）。

    persist=False（MSE 播放/分享页）时不落盘完整缓存文件（只留内存缓冲供 MSE 播放），
    避免分享流量用分享者磁盘生成转码缓存被占满。
    """
    real = os.path.realpath(path)
    if not os.path.isfile(FFMPEG):
        return None
    if not _ffmpeg_capabilities()["ok"]:
        return None
    with _trans_sessions_lock:
        key = (real, q, start_sec, persist)
        sess = _trans_sessions.get(key)
        if sess is not None:
            if (not persist) and sess.get("consume", 0) > 0:
                # MSE 播放会话的缓冲已被上一轮播放消费过（如 30s 内重新打开
                # 同一视频/画质）：旧会话作废并回收进程，保证新播放器从
                # offset=0 拿到全新连续流，否则会拿到空数据黑屏。
                _trans_sessions.pop(key, None)
                _session_gc(sess)
            else:
                sess["last"] = time.time()
                sess["last_client"] = time.time()
                return sess
        d = _trans_dir(path)
        # 仅主站 start==0 且 persist 的会话落盘完整缓存文件；其余只服务 MSE 流
        cfile = None
        if persist and start_sec == 0:
            cfile = os.path.join(d, "%s.%s.mp4" % (_trans_digest(path), q))
            # 新会话从 start 秒重新转码输出：同步截断可能残留的半成品/旧缓存
            # （上次会话被空闲回收中断留下的不完整文件，追加会导致损坏）
            try:
                with open(cfile, "wb"):
                    pass
            except OSError:
                pass
        sess = {
            "key": key, "q": q, "cfile": cfile, "start": start_sec,
            "buf": bytearray(), "consume": 0,
            "done": False, "expired": False, "active": True,
            "lock": threading.Lock(), "error": None,
            "proc": None, "running": False, "last": time.time(),
            "last_client": time.time(),
        }
        _trans_sessions[key] = sess
    info = _video_src_info(path)
    res = _trans_resolution(info["width"] if info else None, q)
    t = threading.Thread(target=_trans_encode_thread,
                         args=(sess, real, q, res), daemon=True)
    t.start()
    return sess


def _trans_ensure_remux(path, start_sec):
    """原画免证书 MSE 会话：ffmpeg -c copy 快速转封装为 fMP4（不重编码）。

    与转码会话共用 _trans_sessions（key=(realpath, 'original', start)），
    _trans_encode_thread 在 resolution=None 时走 _trans_remux_args。
    start==0 时缓存文件持续累加（源本身完整，故 cfile 仍为 None 不落中间文件）。
    """
    if not os.path.isfile(FFMPEG):
        return None
    if not _ffmpeg_capabilities()["ok"]:
        return None
    real = os.path.realpath(path)
    with _trans_sessions_lock:
        key = (real, "original", start_sec)
        sess = _trans_sessions.get(key)
        if sess is not None:
            if sess.get("consume", 0) > 0:
                # 与转码会话同理：原画 remux 缓冲被上一轮播放消费过则重建，
                # 保证重播/重复打开时从 offset=0 拿到全新连续流。
                _trans_sessions.pop(key, None)
                _session_gc(sess)
            else:
                sess["last"] = time.time()
                sess["last_client"] = time.time()
                return sess
        cfile = None  # 原画 remux 不落完整 mp4（源本身就是完整文件）
        sess = {
            "key": key, "q": "original", "cfile": cfile, "start": start_sec,
            "buf": bytearray(), "consume": 0,
            "done": False, "expired": False, "active": True,
            "lock": threading.Lock(), "error": None,
            "proc": None, "running": False, "last": time.time(),
            "last_client": time.time(),
        }
        _trans_sessions[key] = sess
    t = threading.Thread(target=_trans_encode_thread,
                         args=(sess, real, "original", None), daemon=True)
    t.start()
    return sess


def _trans_consume(sess, offset, need):
    """从会话缓冲取 offset 起最多 need 字节；返回 (data, finished, new_offset)。

    缓冲只保留 [consume, consume+len(buf)) 未消费字节；offset 应等于 consume（顺序拉取）。
    若 offset 落后于 consume（前端重复/乱序请求），修正到 consume 并从那里取；
    若 offset 超前于已产出则等待。返回 (data, finished, 消费后的新 offset)。
    每次成功取到数据会刷新 sess["last_client"]，供 sweep 判断客户端是否仍活跃。
    """
    deadline = time.time() + TRANS_WAIT_SEC
    while True:
        with sess["lock"]:
            if offset < sess["consume"]:
                offset = sess["consume"]
            end = sess["consume"] + len(sess["buf"])
            avail = end - offset
            if avail > 0:
                start = offset - sess["consume"]
                data = bytes(sess["buf"][start:start + need])
                n = len(data)
                if n:
                    sess["consume"] = offset + n
                    del sess["buf"][:start + n]
                    sess["last_client"] = time.time()
                return data, (bool(sess.get("done")) and avail <= n), offset + n
            if sess.get("done") or sess.get("error"):
                sess["last_client"] = time.time()
                return b"", True, offset
            if time.time() >= deadline:
                return b"", False, offset
        time.sleep(0.15)


def _trans_sweep_loop(_interval=5):
    """后台清理线程：回收空闲转码会话。

    用 last_client（客户端最近一次拉取时间）判断，而非 last（ffmpeg 产出时间），
    避免"被 seek 弃用但 ffmpeg 还在产出的会话"长时间占用进程。超时后终止进程并移除。
    """
    while True:
        try:
            now = time.time()
            expired = []
            with _trans_sessions_lock:
                for key, sess in list(_trans_sessions.items()):
                    if now - sess.get("last_client", sess["last"]) > TRANS_IDLE_TIMEOUT:
                        expired.append((key, sess))
                for key, sess in expired:
                    _trans_sessions.pop(key, None)
            for key, sess in expired:
                _session_gc(sess)
        except Exception:  # noqa: BLE001
            pass
        time.sleep(_interval)


def _cache_sweep_once():
    """执行一次转码缓存磁盘治理：总量超限时按 mtime 从旧到新删除缓存文件。

    覆盖 .mp4 缓存、original.cache(+.json)、strip.jpg、f*.jpg 帧缓存、asr vtt 等
    所有 transcache 下文件；跳过当前活动转码会话正在使用的 cfile 与 *.tmp 在写文件。
    """
    try:
        if not os.path.isdir(TRANSCACHE_DIR):
            return
        busy = set()
        with _trans_sessions_lock:
            for sess in _trans_sessions.values():
                cf = sess.get("cfile")
                if cf:
                    busy.add(os.path.realpath(cf))
        files = []
        total = 0
        for dirpath, _dirnames, filenames in os.walk(TRANSCACHE_DIR):
            for fn in filenames:
                if fn.endswith(".tmp") or fn.endswith(".tmp.jpg"):
                    continue
                fp = os.path.join(dirpath, fn)
                try:
                    st = os.stat(fp)
                except OSError:
                    continue
                files.append((st.st_mtime, st.st_size, fp))
                total += st.st_size
        if total <= TRANSCACHE_MAX_BYTES:
            return
        files.sort()  # 最旧在前
        for _mtime, size, fp in files:
            if total <= TRANSCACHE_MAX_BYTES:
                break
            if os.path.realpath(fp) in busy:
                continue
            try:
                os.unlink(fp)
                total -= size
            except OSError:
                pass
    except Exception:  # noqa: BLE001
        pass


def _cache_sweep_loop(interval=_CACHE_SWEEP_INTERVAL):
    """后台线程：每 interval 秒跑一次转码缓存磁盘清理（启动时先跑一次）。"""
    while True:
        try:
            _cache_sweep_once()
        except Exception:  # noqa: BLE001
            pass
        time.sleep(interval)


def _trans_available(path):
    """返回该视频可用画质列表（转码档缓存文件已存在即为可用）。"""
    avail = []
    if not os.path.isfile(path):
        return avail
    for q in _TRANS_KEYS:
        if q == "original":
            avail.append(q)
            continue
        if os.path.isfile(_trans_cache_file(path, q)):
            avail.append(q)
    return avail


def _trans_ready(path, q):
    """某转码档是否已可下载/播放（供 transdl/transstatus 判断）。

    与 transdl 分支语义严格一致：persist 会话（start=0）转码完成（done）才算就绪。
    不能只看缓存文件存在——_trans_ensure_session 创建持久会话时即生成空 cfile，
    若据此误报 ready，前端会直接打 transdl 拿到 409 导致原生模式播放失败。
    会话被空闲回收后（可能残留完整文件）同样视为未就绪：下次 transdl 会
    重新截断转码，避免把中断残留的半成品发给客户端。
    """
    if q == "original":
        return True
    if not os.path.isfile(_trans_cache_file(path, q)):
        return False
    with _trans_sessions_lock:
        key = (os.path.realpath(path), q, 0, True)
        sess = _trans_sessions.get(key)
    if sess is None:
        return False
    return bool(sess.get("done"))


def _trans_progress_estimate(path, q, sess=None):
    """估算转码进度：(已产出字节数, 预估总字节数)；无法估算时 total=None。

    persist 会话的已产出字节数 = cfile 当前大小（ffmpeg 全部输出都落盘）。
    总字节用源文件大小作近似（仅供前端展示百分比），并保证不小于已产出。
    """
    produced = 0
    if sess is not None:
        cf = sess.get("cfile")
        if cf:
            try:
                produced = os.path.getsize(cf) if os.path.isfile(cf) else 0
            except OSError:
                produced = 0
    else:
        cfile = _trans_cache_file(path, q)
        if os.path.isfile(cfile):
            try:
                produced = os.path.getsize(cfile)
            except OSError:
                produced = 0
    total = None
    try:
        src_size = os.path.getsize(path)
    except OSError:
        src_size = 0
    if src_size > 0:
        total = max(src_size, produced)
    return produced, total


# -------------------------------------------------------------- 原画缓存下载（边播边缓存）
# 缓存文件 = 完整目标大小的稀疏文件 + 已下载字节区间集合。
# 收到 Range 请求时：若目标字节已缓存则从缓存读；否则从源读并写入缓存、合并区间。
# 前端拖动到某点即发起该点 Range，后端自然优先填充那里。
# 并发写同一文件时用 per-digest 锁串行化"读区间→写缓存→merge→save"，避免丢失更新。
_original_cache_locks: dict = {}
_original_cache_locks_guard = threading.Lock()


def _original_cache_lock(path):
    """返回该文件对应的（进程内）锁，进行并发安全串行化。"""
    d = _trans_digest(path)
    with _original_cache_locks_guard:
        lk = _original_cache_locks.get(d)
        if lk is None:
            lk = threading.Lock()
            _original_cache_locks[d] = lk
        return lk


def _original_cache_path(path):
    """原画缓存文件路径：~/.transfer-mcp/transcache/<digest>/original.cache。"""
    return os.path.join(_trans_dir(path), "original.cache")


def _original_cache_state(path):
    """读取原画缓存区间集合（json，损坏则重置）。"""
    cp = _original_cache_path(path)
    try:
        with open(cp + ".json", "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return list(data.get("ranges", [])) if isinstance(data, dict) else []
    except (OSError, ValueError):
        return []


def _original_cache_save(path, ranges):
    """把原画缓存区间集合写回磁盘（写临时文件再 rename）。"""
    cp = _original_cache_path(path)
    tmp = cp + ".json.tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump({"ranges": ranges}, fh)
        os.replace(tmp, cp + ".json")
    except OSError:
        pass


def _original_cache_merge(ranges, start, end):
    """把 [start,end] 区间合并进已下载区间集合（区间为闭区间 [a,b]）。"""
    merged = []
    for a, b in ranges:
        if a <= end + 1 and b + 1 >= start:
            start = min(start, a)
            end = max(end, b)
        else:
            merged.append([a, b])
    merged.append([start, end])
    merged.sort()
    return merged


def _stream_cached(handler, path, name, ctype, cache):
    """带原画缓存代理的 Range 流（cache=1 时写缓存）。"""
    try:
        fsize = os.path.getsize(path)
    except OSError as exc:
        handler._send_error_page("无法播放该视频", str(exc))
        return
    rng = handler.headers.get("Range")
    if not rng:
        handler._send_file_range(path, name=name, attachment=False, ctype=ctype,
                                 err="无法播放该视频")
        return
    m = re.match(r"bytes=(\d*)-(\d*)", rng.strip(), re.IGNORECASE)
    if not m:
        _range_unsatisfiable(handler, fsize)
        return
    s_str, e_str = m.groups()
    start = int(s_str) if s_str else None
    end = int(e_str) if e_str else None
    if start is None:
        if end is None or end <= 0:
            _range_unsatisfiable(handler, fsize)
            return
        length = min(end, fsize)
        start = fsize - length
        end = fsize - 1
    else:
        if end is None or end >= fsize:
            end = fsize - 1
        if start > end or start >= fsize:
            _range_unsatisfiable(handler, fsize)
            return
    chunk = end - start + 1
    handler.send_response(206)
    handler.send_header("Content-Type", ctype)
    handler.send_header("Accept-Ranges", "bytes")
    handler.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, fsize))
    handler.send_header("Content-Length", str(chunk))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    cp = _original_cache_path(path)
    with _original_cache_lock(path):
        _stream_cached_locked(handler, path, cp, fsize, start, chunk, ctype)


def _resolve_segment(target, remaining, ranges):
    """按缓存区间切分：返回 (seg_start, seg_length, cached)。
    若 at 落在已缓存区间，从缓存读；否则从源读（并整段写缓存）。
    """
    for a, b in ranges:
        if a <= target <= b:
            seg_start = target
            seg_length = min(b - target + 1, remaining)
            return seg_start, seg_length, True
    return target, remaining, False


def _stream_cached_locked(handler, path, cp, fsize, start, chunk, ctype):
    """在 per-digest 锁内执行"读区间→决定源/缓存→写缓存→merge→save"。

    头信息已由调用方发出（206/Content-Range/Content-Length），此处只流字节。
    """
    ranges = _original_cache_state(path)
    # 确保原画缓存文件存在（完整大小的稀疏文件），否则 open(r+b) 首次写入会失败
    try:
        if not os.path.isfile(cp):
            with open(cp, "wb") as cf:
                cf.truncate(fsize)
    except OSError:
        pass
    target = start
    remaining = chunk
    try:
        with open(path, "rb") as src:
            while remaining:
                seg_start, seg_length, cached = _resolve_segment(
                    target, remaining, ranges)
                if cached:
                    with open(cp, "rb") as cf:
                        cf.seek(seg_start)
                        data = cf.read(seg_length)
                else:
                    src.seek(seg_start)
                    data = src.read(seg_length)
                    if data:
                        try:
                            with open(cp, "r+b") as cf:
                                cf.seek(seg_start)
                                cf.write(data)
                        except OSError:
                            pass
                        ranges = _original_cache_merge(ranges, seg_start,
                                                       seg_start + len(data) - 1)
                if not data:
                    break
                handler.wfile.write(data)
                remaining -= len(data)
                target += len(data)
    except OSError:
        try:
            handler.wfile.flush()
        except Exception:  # noqa: BLE001
            pass
    _original_cache_save(path, ranges)


# ------------------------------------------------------------------ 字幕 / 识别 / 缩略图条
_SUB_EXT = (".srt", ".vtt", ".ass", ".ssa")
_SUB_HTML_TAG = re.compile(r"<[^>]+>")


def _subtitle_path(path):
    """同目录旁挂字幕：<basename>.srt/.vtt/.ass → 返回找到的路径，否则 None。"""
    base = os.path.splitext(path)[0]
    for ext in _SUB_EXT:
        cand = base + ext
        if os.path.isfile(cand):
            return cand
    return None


def _webvtt_cue(text):
    """把一行字幕文本转成 WebVTT cue 内容（去 HTML 标签 + 转义）。"""
    text = _SUB_HTML_TAG.sub("", text).strip()
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return text


def _srt_to_vtt(src):
    """把 SRT 内容转成 WebVTT（时间轴格式相同，仅加头部/去序号）。"""
    lines = []
    for ln in src.replace("\r\n", "\n").split("\n"):
        if re.match(r"^\s*\d+\s*$", ln):
            continue
        if re.match(r"^\s*\d{1,2}:\d{2}:\d{2}([,.]\d{1,3})?\s*-->\s*\d{1,2}:\d{2}:\d{2}([,.]\d{1,3})?\s*$", ln):
            ln = ln.replace(",", ".")
        lines.append(ln)
    return "WEBVTT\n\n" + "\n".join(lines)


def _ass_to_vtt(src):
    """极简 ASS → WebVTT 转换（尽力而为：解析 [Events] 的 Dialogue 行）。"""
    out = ["WEBVTT\n"]
    for ln in src.replace("\r\n", "\n").split("\n"):
        if not ln.startswith("Dialogue:"):
            continue
        parts = ln.split(",", 9)
        if len(parts) < 10:
            continue
        start, end, text = parts[1], parts[2], parts[9]
        start = _ass_tc(start)
        end = _ass_tc(end)
        text = text.replace("\\N", "\n").replace("\\n", "\n")
        text = re.sub(r"\{\\[^}]*\}", "", text)
        out.append("%s --> %s" % (start, end))
        out.append(_webvtt_cue(text))
        out.append("")
    return "\n".join(out)


def _ass_tc(tc):
    """ASS 时间码 H:MM:SS.cs → WebVTT HH:MM:SS.mmm。"""
    m = re.match(r"(\d+):(\d{2}):(\d{2})[.](\d{2})", tc)
    if not m:
        return tc
    h, mm, ss, cs = m.groups()
    return "%02d:%02d:%02d.%03d" % (int(h), int(mm), int(ss), int(float(cs) * 10))


def _subtitle_vtt(path):
    """返回 (vtt 内容, 来源) 或 None。优先旁挂，其次内嵌（ffmpeg 提取 webvtt）。"""
    sp = _subtitle_path(path)
    if sp:
        ext = os.path.splitext(sp)[1].lower()
        with open(sp, "rb") as fh:
            content, _ = _smart_decode(fh.read())   # GBK 中文字幕不再乱码（原硬编码 utf-8）
        if ext == ".srt":
            return _srt_to_vtt(content), "sidecar"
        if ext == ".ass" or ext == ".ssa":
            return _ass_to_vtt(content), "sidecar"
        return content if content.startswith("WEBVTT") else _srt_to_vtt(content), "sidecar"
    # 内嵌字幕：ffmpeg 提取首个字幕流为 webvtt
    if not os.path.isfile(FFMPEG):
        return None
    try:
        r = subprocess.run(
            [FFMPEG, "-v", "quiet", "-y", "-i", path,
             "-map", "0:s:0", "-c:s", "webvtt", "-f", "webvtt", "-"],
            capture_output=True, timeout=60,
        )
        if r.returncode == 0 and r.stdout:
            content, _ = _smart_decode(r.stdout)   # GBK 内嵌字幕兜底
            return content, "embedded"
    except Exception:  # noqa: BLE001
        pass
    return None


def _asr_available():
    """检测 Python 是否安装了 faster_whisper（未安装则不启用识别）。"""
    try:
        import faster_whisper  # noqa: F401
        return True
    except ImportError:
        return False


def _asr_vtt_cached(path, lang):
    """识别结果缓存：<digest>.asr.<lang>.vtt，命中直接返回。"""
    return os.path.join(_trans_dir(path), "%s.asr.%s.vtt" % (_trans_digest(path), lang))


_asr_model = None
_asr_model_lock = threading.Lock()
_asr_path_locks = {}
_asr_path_locks_guard = threading.Lock()


def _asr_path_lock(path):
    """per-path 转写锁：避免同一文件被并发重复转写（结果落盘缓存，重复请求本就快）。"""
    d = _trans_digest(path)
    with _asr_path_locks_guard:
        lk = _asr_path_locks.get(d)
        if lk is None:
            lk = threading.Lock()
            _asr_path_locks[d] = lk
        return lk


def _asr_transcribe(path, lang):
    """用 faster_whisper 转写并返回 WebVTT；计算量大，模型单例复用 + 结果缓存。

    模型首次加载后全局复用（避免多请求各加载一份模型）；同一文件用 per-path 锁
    去重并发转写。结果缓存到 <digest>.asr.<lang>.vtt。
    """
    cache = _asr_vtt_cached(path, lang)
    if os.path.isfile(cache):
        try:
            with open(cache, "r", encoding="utf-8") as fh:
                return fh.read()
        except OSError:
            pass
    if not _asr_available():
        return None
    with _asr_path_lock(path):
        # 拿锁后再查一次缓存（可能被并发请求先写好了）
        if os.path.isfile(cache):
            try:
                with open(cache, "r", encoding="utf-8") as fh:
                    return fh.read()
            except OSError:
                pass
        try:
            from faster_whisper import WhisperModel  # noqa: N817
            global _asr_model
            if _asr_model is None:
                with _asr_model_lock:
                    if _asr_model is None:
                        _asr_model = WhisperModel("small", device="cpu", compute_type="int8")
            model = _asr_model
            segments, _info = model.transcribe(path, language=lang, vad_filter=True)
            cues = []
            for seg in segments:
                cues.append(_asr_segment_vtt(seg))
            out = "WEBVTT\n\n" + "\n\n".join(cues)
            if not out:
                return "WEBVTT\n\n"
            try:
                with open(cache, "w", encoding="utf-8") as fh:
                    fh.write(out)
            except OSError:
                pass
            return out
        except Exception:  # noqa: BLE001
            return None


def _asr_segment_vtt(seg):
    """把 faster_whisper 的 segment 转成 WebVTT cue 文本。"""
    start = _fmt_srt_time(seg.start)
    end = _fmt_srt_time(seg.end)
    text = _webvtt_cue(seg.text or "")
    return "%s --> %s\n%s" % (start, end, text)


def _fmt_srt_time(t):
    """秒 → HH:MM:SS.mmm（WebVTT 时间轴）。"""
    t = max(0, float(t))
    h = int(t // 3600)
    m = int(t % 3600 // 60)
    s = int(t % 60)
    ms = int(round((t - int(t)) * 1000))
    if ms >= 1000:
        ms = 0
        s += 1
    return "%02d:%02d:%02d.%03d" % (h, m, s, ms)


def _vthumbstrip_path(path):
    """缩略图条缓存路径：<digest>.strip.jpg。"""
    return os.path.join(_trans_dir(path), "%s.strip.jpg" % _trans_digest(path))


def _vthumbstrip_meta(path):
    """缩略图条元数据：(实际 tile 数, 源时长秒数)；时长未知时 n=10、dur=0。"""
    info = _video_src_info(path)
    dur = info["duration"] if info and info["duration"] else 0
    n = max(2, min(20, int(dur / 30) + 2)) if (dur and dur > 0) else 10
    return n, dur


def _vthumbstrip_gen(path):
    """用 ffmpeg 生成整段横向缩略图条（最多约 20 帧拼成一张 jpg）。

    返回 (out_path, tile_n, duration_sec)；失败返回 None。
    tile_n 与源时长供 X-Strip-N / X-Strip-Duration 响应头使用。
    """
    if not os.path.isfile(FFMPEG):
        return None
    out = _vthumbstrip_path(path)
    n, dur = _vthumbstrip_meta(path)
    if os.path.isfile(out):
        return out, n, dur
    tmp = out + ".tmp.jpg"
    try:
        if dur and dur > 0:
            cmd = [FFMPEG, "-y", "-i", path,
                   "-vf", "fps=%d/%d,scale=160:-2,tile=%dx1,pad=0:0:0:0:black" % (n, int(dur), n), tmp]
        else:
            cmd = [FFMPEG, "-y", "-i", path,
                   "-vf", "fps=1/10,scale=160:-2,tile=10x1", tmp]
        r = subprocess.run(cmd, capture_output=True, timeout=120)
        if r.returncode == 0 and os.path.isfile(tmp):
            os.replace(tmp, out)
            return out, n, dur
    except Exception:  # noqa: BLE001
        pass
    try:
        if os.path.isfile(tmp):
            os.unlink(tmp)
    except OSError:
        pass
    return None


def _vframe_path(path, t):
    """单帧预览缓存路径：<digest>.f<秒>.jpg。"""
    return os.path.join(_trans_dir(path), "%s.f%d.jpg" % (_trans_digest(path), int(t)))


def _vframe_gen(path, t):
    """ffmpeg seek 到 t 秒抽单帧，缓存到 <digest>.f<秒>.jpg。"""
    if not os.path.isfile(FFMPEG):
        return None
    out = _vframe_path(path, t)
    if os.path.isfile(out):
        return out
    tmp = out + ".tmp.jpg"
    try:
        cmd = [FFMPEG, "-y", "-ss", "%s" % t, "-i", path,
               "-frames:v", "1", "-vf", "scale=320:-2", "-q:v", "6", tmp]
        r = subprocess.run(cmd, capture_output=True, timeout=60)
        if r.returncode == 0 and os.path.isfile(tmp):
            os.replace(tmp, out)
            return out
    except Exception:  # noqa: BLE001
        pass
    try:
        if os.path.isfile(tmp):
            os.unlink(tmp)
    except OSError:
        pass
    return None


def _load_shares() -> None:
    """从磁盘加载分享表；文件缺失/损坏时静默重置为空。"""
    global _shares
    try:
        with open(SHARES_FILE, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        if isinstance(data, dict):
            _shares = data
    except (OSError, ValueError):
        _shares = {}


def _save_shares() -> None:
    """把分享表写回磁盘（写临时文件再 rename，防止中途写坏导致数据丢失）。"""
    try:
        os.makedirs(CERT_DIR, exist_ok=True)
        tmp = SHARES_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(_shares, fh, ensure_ascii=False)
        os.replace(tmp, SHARES_FILE)
    except OSError:
        pass


# 模块加载时恢复上次的分享记录（含跨进程重启的分享链接）
_load_shares()


def _fix_zip_name(name):
    """修复 ZIP 条目名的编码：无 UTF-8 标志的 GBK 中文名被 zipfile 按 cp437 解码成乱码。

    安全策略：仅当 cp437→gbk 重解码成功、结果含 >=2 个中文/全角字符且无控制字符时采用；
    ASCII 名 / UTF-8 标志名 / 拉丁文名保持不动（cp437→gbk 会失败或不含中文）。"""
    if not name:
        return name
    try:
        fixed = name.encode("cp437").decode("gbk")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return name
    if fixed == name or not fixed:
        return name
    if any(ord(c) < 32 for c in fixed):          # 控制字符 → 解码结果不健康，放弃
        return name
    cjk = sum(1 for c in fixed
              if "\u4e00" <= c <= "\u9fff" or "\u3000" <= c <= "\u303f" or "\uff00" <= c <= "\uffef")
    if cjk >= 2:                              # 含 >=2 个中文/全角字符即采用（路径前缀不拉低判定）
        return fixed
    return name


def _archive_fmt(path):
    """识别压缩包格式：zip / tar / 7z / rar / unsupported（支持 tar.gz 等复合扩展名）。

    gz/bz2/xz 可能是 tar 压缩（tar.gz 改名而来）也可能是单文件压缩，
    统一归 "tar" 交给 tarfile 尝试，失败时给出明确提示。
    """
    low = os.path.basename(path).lower()
    if low.endswith((".tar.gz", ".tar.bz2", ".tar.xz", ".tar.zst")):
        return "tar"
    ext = os.path.splitext(low)[1].lstrip(".")
    if ext == "zip":
        return "zip"
    if ext in ("tar", "tgz", "tbz2", "txz", "gz", "bz2", "xz"):
        return "tar"
    if ext == "7z":
        return "7z"
    if ext == "rar":
        return "rar"
    return "unsupported"


def _fix_tar_name(name):
    """修复 tar 条目名的编码：GBK 中文名（Windows 打包工具常见）被 tarfile
    按 UTF-8 解码成含代理字符的乱码。

    安全策略：仅当名中含代理字符（说明 UTF-8 解码失败过）且 GBK 重解码后
    含 >=1 个中文/全角字符且无控制字符时采用；合法 UTF-8 名保持不动。
    """
    if not name:
        return name
    if not any(0xDC80 <= ord(c) <= 0xDCFF for c in name):
        return name
    try:
        raw = name.encode("utf-8", "surrogateescape")
        fixed = raw.decode("gbk")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return name
    if any(ord(c) < 32 for c in fixed):
        return name
    cjk = sum(1 for c in fixed
              if "\u4e00" <= c <= "\u9fff" or "\u3000" <= c <= "\u303f" or "\uff00" <= c <= "\uffef")
    return fixed if cjk >= 1 else name


# ============ rar/7z 外部工具探测（依赖最小化约束） ============
# 原则：绝不新增 pip/npm 依赖、不下载二进制——rar/7z 支持完全依赖"系统已有的
# 7-Zip 或 WinRAR"，探测到才启用，未探测到则返回明确提示（引导安装 7-Zip）。
# 下方两个常量列表是"用户可编辑的探测路径"，可在此追加自定义安装位置
# （例如 D:\Tools\7-Zip\7z.exe）；此外还会自动探测 %ProgramFiles% 系列
# 环境变量根目录与 PATH。
_SEVEN_7Z_PATHS = [
    r"C:\Program Files\7-Zip\7z.exe",
    r"C:\Program Files (x86)\7-Zip\7z.exe",
    r"C:\Program Files\7-Zip\7zz.exe",
]
_WINRAR_PATHS = [
    r"C:\Program Files\WinRAR\WinRAR.exe",
    r"C:\Program Files\WinRAR\UnRAR.exe",
    r"C:\Program Files\WinRAR\Rar.exe",
    r"C:\Program Files (x86)\WinRAR\WinRAR.exe",
    r"C:\Program Files (x86)\WinRAR\UnRAR.exe",
]


def _find_tool(paths, names):
    """探测外部工具：先查常量列表（用户可扩展），再查 %ProgramFiles% 系列
    环境变量根目录，最后用 shutil.which 走 PATH。"""
    roots = set()
    for var in ("ProgramFiles", "ProgramFiles(x86)", "ProgramW6432"):
        v = os.environ.get(var)
        if v:
            roots.add(v)
    for p in paths:
        if os.path.isfile(p):
            return p
    for root in roots:
        for n in names:
            cand = os.path.join(root, n)
            if os.path.isfile(cand):
                return cand
    for n in names:
        hit = shutil.which(n)
        if hit:
            return hit
    return None


def _find_7z():
    return _find_tool(_SEVEN_7Z_PATHS, ("7z.exe", "7zz.exe"))


def _find_winrar():
    return _find_tool(_WINRAR_PATHS, ("WinRAR.exe", "UnRAR.exe", "Rar.exe"))


def _decode_cmd(data):
    """命令输出解码：优先 UTF-8（7z -sccUTF-8），失败回退 GBK（WinRAR 中文系统 ANSI）。"""
    for enc in ("utf-8", "gbk"):
        try:
            return data.decode(enc)
        except (UnicodeDecodeError, UnicodeEncodeError):
            continue
    return data.decode("utf-8", "replace")


def _hier_level(raw, prefix, fmt):
    """把扁平条目列表按 prefix 归并为该层的一级子条目（层级浏览核心）。

    prefix 为包内目录路径（正斜杠、无首尾斜杠），"" 表示根层。
    隐含目录（只有文件、无显式目录项）由文件路径推断；
    返回 {format, dir, entries, total}，total = 该层（含嵌套）条目总数。
    """
    prefix = (prefix or "").replace("\\", "/").strip("/")
    p = prefix + "/" if prefix else ""
    direct = {}
    total = 0
    for e in raw:
        nm = (e.get("path_in_archive") or "").replace("\\", "/").lstrip("./")
        if p and not nm.startswith(p):
            continue
        rest = nm[len(p):]
        if not rest:
            continue
        total += 1
        seg, _, tail = rest.partition("/")
        seg = seg.rstrip("/")
        if not seg:
            continue
        if tail:
            if seg not in direct:            # 更深层条目 → 隐含目录
                direct[seg] = {"name": seg, "path_in_archive": p + seg,
                               "size": None, "is_dir": True}
        elif seg not in direct:              # 一层内条目（显式目录或文件）
            direct[seg] = {"name": seg, "path_in_archive": p + seg,
                           "size": None if e.get("is_dir") else e.get("size"),
                           "is_dir": e.get("is_dir", False)}
    entries = sorted(direct.values(), key=lambda x: (not x["is_dir"], x["name"].lower()))
    return {"format": fmt, "dir": prefix, "entries": entries, "total": total}


def _unpack_zip(path, dir=""):
    try:
        with zipfile.ZipFile(path) as zf:
            raw = []
            for info in zf.infolist():
                nm = _fix_zip_name(info.filename)          # GBK 中文名修复
                raw.append({"name": nm, "path_in_archive": nm,
                            "size": info.file_size,
                            "is_dir": info.filename.endswith("/")})
            return _hier_level(raw, dir, "zip")
    except (zipfile.BadZipFile, OSError) as exc:
        return {"format": "zip", "entries": [], "error": str(exc)}


def _unpack_tar(path, dir=""):
    try:
        with tarfile.open(path, "r:*") as tf:              # 自动识别 gz/bz2/xz
            raw = []
            for m in tf.getmembers():
                nm = _fix_tar_name(m.name).replace("\\", "/").lstrip("./")
                is_dir = m.isdir() or nm.endswith("/")
                raw.append({"name": nm, "path_in_archive": nm,
                            "size": None if is_dir else m.size,
                            "is_dir": is_dir})
            return _hier_level(raw, dir, "tar")
    except (tarfile.TarError, EOFError, OSError) as exc:
        ext = os.path.splitext(path)[1].lstrip(".").lower()
        if ext in ("gz", "bz2", "xz"):
            msg = ("该文件是单文件压缩（非 tar 归档，内部无目录结构），"
                   "无法浏览，请直接下载原文件")
        else:
            msg = "无法读取该 tar 压缩包: %s" % exc
        return {"format": "tar", "entries": [], "error": msg}


def _seven_entry(fields):
    """把 7z l -slt 的一条记录解析为条目（7z 的 rar 列表同样适用）。"""
    p = (fields.get("Path") or "").replace("\\", "/").lstrip("./")
    if not p:
        return None
    is_dir = fields.get("Folder") == "+" or p.endswith("/") or \
             fields.get("Attributes", "").startswith("D")
    size = None
    try:
        size = int(fields.get("Size") or 0)
    except (TypeError, ValueError):
        size = None
    return {"name": p, "path_in_archive": p,
            "size": None if is_dir else size, "is_dir": is_dir}


def _seven_list(tool, path):
    """7z l -slt -ba 技术列表：返回 (raw_entries, error)。"""
    try:
        r = subprocess.run([tool, "l", "-slt", "-ba", "-sccUTF-8", path],
                           capture_output=True, timeout=300)
    except Exception as exc:  # noqa: BLE001
        return None, "7-Zip 执行失败: %s" % exc
    if r.returncode != 0:
        msg = (_decode_cmd(r.stderr) or r.stderr.decode("utf-8", "replace")).strip()
        return None, "7-Zip 无法读取该压缩包: %s" % (msg or "未知错误")
    raw = []
    cur = {}
    for line in _decode_cmd(r.stdout).splitlines():
        line = line.rstrip("\r")
        if not line.strip():
            en = _seven_entry(cur)
            if en:
                raw.append(en)
            cur = {}
            continue
        if " = " in line:
            k, v = line.split(" = ", 1)
            cur[k.strip()] = v.strip()
    en = _seven_entry(cur)
    if en:
        raw.append(en)
    return raw, None


def _unpack_winrar(tool, path, dir="", fmt="rar"):
    """WinRAR 备选路径（无 7-Zip 时）：UnRAR/WinRAR lb 裸列表，尽力而为。"""
    try:
        r = subprocess.run([tool, "lb", "-p-", path],
                           capture_output=True, timeout=300)
    except Exception as exc:  # noqa: BLE001
        return {"format": fmt, "entries": [], "error": "WinRAR 执行失败: %s" % exc}
    if r.returncode != 0:
        return {"format": fmt, "entries": [], "error": "WinRAR 无法读取该压缩包"}
    raw = []
    for ln in _decode_cmd(r.stdout).splitlines():
        ln = ln.strip().replace("\\", "/").lstrip("./")
        if not ln:
            continue
        is_dir = ln.endswith("/")
        raw.append({"name": ln, "path_in_archive": ln,
                    "size": None if is_dir else 0, "is_dir": is_dir})
    return _hier_level(raw, dir, fmt)


def _unpack_seven(path, dir="", fmt="7z"):
    """rar/7z 预览：优先 7-Zip（同时支持两种格式），其次 WinRAR；都没有时给明确提示。"""
    tool = _find_7z()
    if tool:
        raw, err = _seven_list(tool, path)
        if err:
            return {"format": fmt, "entries": [], "error": err}
        return _hier_level(raw, dir, fmt)
    tool = _find_winrar()
    if tool:
        return _unpack_winrar(tool, path, dir, fmt)
    return {"format": fmt, "entries": [],
            "error": ("无法预览 %s 压缩包：未找到 7-Zip 或 WinRAR。"
                      "请安装 7-Zip（https://www.7-zip.org/）后重试。") % fmt.upper()}


def _unpack_list(path, dir=""):
    """压缩包条目列表（层级浏览）：dir 为包内目录前缀，返回该层直接子条目。

    支持 zip（zipfile）/ tar、tgz、tar.gz、tar.bz2 等（tarfile）/
    rar、7z（探测系统 7-Zip 或 WinRAR，未找到返回明确提示）。
    """
    fmt = _archive_fmt(path)
    if fmt == "zip":
        return _unpack_zip(path, dir)
    if fmt == "tar":
        return _unpack_tar(path, dir)
    if fmt in ("7z", "rar"):
        return _unpack_seven(path, dir, fmt)
    return {"format": "unsupported", "entries": []}


def _range_unsatisfiable(handler, fsize):
    handler.send_response(416)
    handler.send_header("Content-Range", "bytes */%d" % fsize)
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", "0")
    handler.end_headers()


# 视频 Range 流式输出已统一进 _send_file_range（见类内方法），此处不再单独实现


def _seven_entry_size(tool, archive, entry):
    """7z l -slt 查单条目大小与目录标记（供下载时设置 Content-Length）。"""
    try:
        r = subprocess.run([tool, "l", "-slt", "-ba", "-sccUTF-8", archive],
                           capture_output=True, timeout=300)
    except Exception:  # noqa: BLE001
        return None, None
    if r.returncode != 0:
        return None, None
    cur = {}
    for line in _decode_cmd(r.stdout).splitlines():
        line = line.rstrip("\r")
        if not line.strip():
            p = cur.get("Path", "")
            if p and (p == entry or p.replace("\\", "/") == entry):
                is_dir = cur.get("Folder") == "+" or p.endswith("/") or \
                         cur.get("Attributes", "").startswith("D")
                try:
                    return int(cur.get("Size") or 0), is_dir
                except ValueError:
                    return None, is_dir
            cur = {}
            continue
        if " = " in line:
            k, v = line.split(" = ", 1)
            cur[k.strip()] = v.strip()
    p = cur.get("Path", "")
    if p and (p == entry or p.replace("\\", "/") == entry):
        is_dir = cur.get("Folder") == "+" or p.endswith("/") or \
                 cur.get("Attributes", "").startswith("D")
        try:
            return int(cur.get("Size") or 0), is_dir
        except ValueError:
            return None, is_dir
    return None, None


def _dl_zip(handler, archive, entry, disp):
    """zip 条目下载（zipfile 流式，保持原有逻辑）。"""
    try:
        with zipfile.ZipFile(archive) as zf:
            # 前端传的 entry 是修复后的名：先精确匹配，再经 _fix_zip_name 映射回原始名
            real = entry if entry in zf.namelist() else None
            if real is None:
                for orig in zf.namelist():
                    if _fix_zip_name(orig) == entry:
                        real = orig
                        break
            if real is None:
                handler._send_json({"error": "压缩包内没有该条目"}, 403)
                return
            info = zf.getinfo(real)
            handler.send_response(200)
            handler.send_header("Content-Type", "application/octet-stream")
            handler.send_header("Content-Length", str(info.file_size))
            handler.send_header("Content-Disposition", disp)   # disp 用修复后的名（用户可见）
            handler.send_header("Cache-Control", "no-store")
            handler.end_headers()
            with zf.open(real) as src:
                shutil.copyfileobj(src, handler.wfile)
    except Exception as exc:  # noqa: BLE001
        handler._send_error_page("解压失败", str(exc))


def _dl_tar(handler, archive, entry, disp):
    """tar/tgz/tar.gz/tar.bz2 条目下载（tarfile 流式）。"""
    try:
        with tarfile.open(archive, "r:*") as tf:
            member = None
            want = entry.replace("\\", "/").lstrip("./")
            for m in tf.getmembers():
                nm = _fix_tar_name(m.name).replace("\\", "/").lstrip("./")
                if nm == want:
                    member = m
                    break
            if member is None or member.isdir():
                handler._send_json({"error": "压缩包内没有该条目"}, 403)
                return
            handler.send_response(200)
            handler.send_header("Content-Type", "application/octet-stream")
            handler.send_header("Content-Length", str(member.size))
            handler.send_header("Content-Disposition", disp)
            handler.send_header("Cache-Control", "no-store")
            handler.end_headers()
            src = tf.extractfile(member)
            if src:
                shutil.copyfileobj(src, handler.wfile)
    except Exception as exc:  # noqa: BLE001
        handler._send_error_page("解压失败", str(exc))


def _dl_7z(handler, archive, entry, disp, tool):
    """7-Zip 条目下载：先查 size 设置 Content-Length，再 7z e -so 流式输出。"""
    size, is_dir = _seven_entry_size(tool, archive, entry)
    if is_dir:
        handler._send_json({"error": "目录不能直接下载，请进入后选择文件"}, 403)
        return
    try:
        proc = subprocess.Popen(
            [tool, "e", "-so", "-y", "-sccUTF-8", archive, entry],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except Exception as exc:  # noqa: BLE001
        handler._send_error_page("解压失败", str(exc))
        return
    if size is not None:
        handler.send_response(200)
        handler.send_header("Content-Type", "application/octet-stream")
        handler.send_header("Content-Length", str(size))
        handler.send_header("Content-Disposition", disp)
        handler.send_header("Cache-Control", "no-store")
        handler.end_headers()
    else:
        # 大小未知：close-delimited 传输（需显式 Connection: close 结束响应）
        handler.send_response(200)
        handler.send_header("Content-Type", "application/octet-stream")
        handler.send_header("Content-Disposition", disp)
        handler.send_header("Cache-Control", "no-store")
        handler.send_header("Connection", "close")
        handler.end_headers()
    try:
        while True:
            chunk = proc.stdout.read(1 << 20)
            if not chunk:
                break
            handler.wfile.write(chunk)
    finally:
        try:
            proc.stdout.close()
        except Exception:  # noqa: BLE001
            pass
        try:
            proc.stderr.read()
        except Exception:  # noqa: BLE001
            pass
        try:
            proc.wait(timeout=10)
        except Exception:  # noqa: BLE001
            proc.kill()


def _dl_winrar(handler, archive, entry, disp, tool):
    """WinRAR 备选下载：WinRAR/UnRAR 不支持输出到 stdout，解压到临时目录后流式发送。"""
    tmp = tempfile.mkdtemp(prefix="tk_unpack_")
    try:
        r = subprocess.run([tool, "e", "-p-", "-y", "-o+", archive, entry, tmp],
                           capture_output=True, timeout=300)
        if r.returncode != 0:
            handler._send_error_page(
                "解压失败", "WinRAR 解压条目失败: %s" % _decode_cmd(r.stderr).strip())
            return
        extracted = None
        for f in os.listdir(tmp):
            fp = os.path.join(tmp, f)
            if os.path.isfile(fp):
                extracted = fp
                break
        if extracted is None:
            handler._send_json({"error": "压缩包内没有该条目"}, 403)
            return
        fsize = os.path.getsize(extracted)
        handler.send_response(200)
        handler.send_header("Content-Type", "application/octet-stream")
        handler.send_header("Content-Length", str(fsize))
        handler.send_header("Content-Disposition", disp)
        handler.send_header("Cache-Control", "no-store")
        handler.end_headers()
        with open(extracted, "rb") as fh:
            shutil.copyfileobj(fh, handler.wfile)
    except Exception as exc:  # noqa: BLE001
        handler._send_error_page("解压失败", str(exc))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def _unpack_download(handler, archive, entry):
    """下载压缩包内的单个条目：zip/tar 标准库流式；rar/7z 走 7-Zip/WinRAR。"""
    fmt = _archive_fmt(archive)
    disp = "attachment; filename*=UTF-8''" + urllib.parse.quote(os.path.basename(entry) or "file")
    if fmt == "zip":
        _dl_zip(handler, archive, entry, disp)
    elif fmt == "tar":
        _dl_tar(handler, archive, entry, disp)
    elif fmt in ("7z", "rar"):
        tool = _find_7z()
        if tool:
            _dl_7z(handler, archive, entry, disp, tool)
            return
        tool = _find_winrar()
        if tool:
            _dl_winrar(handler, archive, entry, disp, tool)
            return
        handler._send_error_page("解压失败",
                                 "未找到 7-Zip 或 WinRAR，无法解压该压缩包")
    else:
        handler._send_error_page("解压失败", "不支持的压缩包格式")


# 打包并发限制：同时最多 2 个打包任务（打包是长任务，超出则阻塞等待，可接受）
_ARCHIVE_SEM = threading.Semaphore(2)

# 压缩级别映射：mode -> (zipfile 压缩方式, compresslevel)
# store=不压缩（最快，纯拷贝）；fast=zlib 级别 1（快）；normal=默认级别
_ARCHIVE_MODES = {
    "store": (zipfile.ZIP_STORED, None),
    "fast": (zipfile.ZIP_DEFLATED, 1),
    "normal": (zipfile.ZIP_DEFLATED, None),
}

# ---- 打包中心：后台任务表与常量 ----
# 任务状态机：queued→scanning→compressing→ready→downloading→done；
# 任意非终态可 cancel→aborted；压缩异常→failed；下载中断→回滚 ready（可再下载）。
# 任务 dict 字段见 _archive_new_task；临时 zip 统一命名 tk_<task_id>.zip（可预测，供启动清扫）。
_ARCHIVE_TASKS = {}            # task_id -> dict，全局任务表
_ARCHIVE_TASKS_LOCK = threading.RLock()
_ARCHIVE_QUEUE_MAX = 6         # queued+scanning+compressing 总数上限（超出 429）
_ARCHIVE_TASK_CAP = 16         # 任务表总条数上限（逐出最旧终态）
_ARCHIVE_CHUNK = 1 << 20       # 分块写 zip 的读块大小
_ARCHIVE_TASK_TTL = 30 * 60    # 终态/排队任务 inert 过期时长（秒），惰性清理


class _ArchiveAborted(Exception):
    """打包任务被取消时抛出，工人线程收敛到 aborted 状态。"""
    pass


def _build_archive_items(paths):
    """ 普通打包：把选中路径组装为 (arcname, realpath) 列表。

    arcname 为 zip 内相对路径（统一正斜杠分隔），顶层即选中项本身的名字：
    选中 C:\a\dir1 → "dir1/..."；选中 C:\a\f.txt → "f.txt"；
    多个选中项并列在 zip 根下。用 realpath 去重同一文件。
    """
    if not paths:
        return []
    try:
        base = os.path.commonpath([os.path.dirname(p) for p in paths])
    except ValueError:
        base = os.path.splitdrive(paths[0])[0] + os.sep
    items = []
    seen = set()
    for p in paths:
        try:
            rp = os.path.realpath(p)
        except Exception:  # noqa: BLE001
            continue
        if rp in seen:
            continue
        seen.add(rp)
        try:
            rel = os.path.relpath(rp, base)
        except ValueError:
            rel = os.path.basename(rp.rstrip("\\/")) or rp
        if not rel or rel == ".":
            # 选中项就是 base 本身（如盘符根）时 relpath 得 "."，会产出脏条目 ./，退回用名字
            rel = os.path.basename(rp.rstrip("\\/")) or rp
        items.append((rel.replace("\\", "/"), rp))
    return items


def _scan_plan(items):
    """扫描选中路径，展开为打包清单（纯扫描，不做磁盘预检/写包）。

    返回 (plan, dirs, total_size, skipped)：
      plan: [(arcname, realpath)] 待打包文件清单
      dirs: [(arcname, realpath)] 目录清单（空目录也要写目录条目）
      total_size: 文件总大小估算（临时盘空间预检用）
      skipped: [{path, reason}] 无法读取的项（读不了的文件/目录）
    """
    plan = []            # 待打包文件清单 [(arcname, realpath)]
    dirs = []            # 目录清单 [(arcname, realpath)]（空目录也要写目录条目）
    visited_dirs = set()  # 已展开目录的 realpath（防 junction/符号链接循环）
    seen_files = set()    # 已登记文件的 realpath（同一真实文件只入包一次）
    seen_dirs = set()     # 已登记目录条目的 arcname（重叠选择时不写重复目录条目）
    total_size = 0        # 文件总大小估算（临时空间预检用）
    skipped = []          # 跳过清单：[{path, reason}]

    def expand(arcname, rpath, depth):
        # 递归展开目录：目录与文件都登记，visited+depth 双重防循环
        # 返回 True 表示目录成功扫描（含空目录）；False 表示目录无法读取
        nonlocal total_size
        if depth > 64:
            return True
        try:
            real = os.path.realpath(rpath)
        except Exception:  # noqa: BLE001
            skipped.append({"path": rpath, "reason": "无法解析路径"})
            return False
        if real in visited_dirs:
            return True
        visited_dirs.add(real)
        try:
            with os.scandir(rpath) as it:
                for e in it:
                    try:
                        is_dir = e.is_dir(follow_symlinks=False)
                    except OSError:
                        is_dir = False
                    child = (arcname + "/" + e.name) if arcname else e.name
                    if is_dir:
                        # 目录：先判重解析点（junction/符号链接目录），命中则不递归。
                        # junction 的 is_dir(follow_symlinks=False)=True 而 realpath 会解析
                        # 到目标，若目标在包外会把无关内容打进 zip（隐私/体积风险）
                        try:
                            is_reparse = bool(
                                e.stat(follow_symlinks=False).st_file_attributes & 0x400
                            )
                        except OSError:
                            is_reparse = False
                        if is_reparse:
                            skipped.append({"path": e.path, "reason": "链接目录未包含"})
                            continue
                        if child not in seen_dirs:
                            seen_dirs.add(child)
                            dirs.append((child, e.path))
                        expand(child, e.path, depth + 1)
                    else:
                        try:
                            freal = os.path.realpath(e.path)
                        except Exception:  # noqa: BLE001
                            freal = e.path
                        if freal in seen_files:
                            continue  # 同一真实文件不重复入包
                        seen_files.add(freal)
                        plan.append((child, e.path))
                        try:
                            total_size += e.stat(follow_symlinks=False).st_size
                        except OSError:
                            pass
            return True
        except OSError as exc:
            # scandir 失败：跳过该目录并记录，不再静默
            skipped.append({"path": rpath, "reason": "目录无法读取: %s" % exc})
            return False

    for arcname, rpath in items:
        arcname = arcname.replace("\\", "/").strip("/")
        if not arcname:
            arcname = os.path.basename(rpath.rstrip("\\/")) or "item"
        if os.path.isdir(rpath):
            # 顶层目录：先展开，扫描成功（含空目录）才登记目录条目；
            # 无法读取的顶层目录只进 skipped，避免"看似成功"的空 zip 包
            scanned = expand(arcname, rpath, 0)
            if scanned and arcname not in seen_dirs:
                seen_dirs.add(arcname)
                dirs.append((arcname, rpath))
        elif os.path.isfile(rpath):
            try:
                freal = os.path.realpath(rpath)
            except Exception:  # noqa: BLE001
                freal = rpath
            if freal in seen_files:
                continue
            seen_files.add(freal)
            plan.append((arcname, rpath))
            try:
                total_size += os.path.getsize(rpath)
            except OSError:
                pass
        else:
            skipped.append({"path": rpath, "reason": "路径不存在或无法访问"})
    return plan, dirs, total_size, skipped


def _write_entry_chunked(zf, task, arcname, rpath):
    """分块写单个文件进 zip（任务模式）：数据/进度/取消一并在内。

    与 zf.write 对标条条对齐：date_time=文件 mtime、external_attr 高 16 位
    置模式位、compress_type/compresslevel 沿用外层 ZipFile，确保产出 zip
    与同步打包字节一致（实测同目录 md5 相同）。
    每块前检查取消事件，命中抛 _ArchiveAborted。
    """
    st = os.stat(rpath)
    zi = zipfile.ZipInfo(arcname.replace("\\", "/"))
    zi.date_time = time.localtime(st.st_mtime)[:6]
    zi.external_attr = (st.st_mode & 0xFFFF) << 16
    zi.compress_type = zf.compression  # zlib 级别由 ZipFile 实例统一（ZipInfo 无此属性）
    task["current_file"] = arcname
    task["file_total"] = st.st_size
    task["file_done"] = 0
    # 与 zf.write 的 zip64 决策保持一致（>2GB 才启用 zip64，小文件不写 zip64 扩展），
    # 确保同一目录两种写法产出的 zip 字节一致（实测 md5 相同）
    force_zip64 = st.st_size > zipfile.ZIP64_LIMIT
    with open(rpath, "rb") as src, zf.open(zi, "w", force_zip64=force_zip64) as dst:
        while True:
            if task["cancel_evt"].is_set():
                raise _ArchiveAborted()
            chunk = src.read(_ARCHIVE_CHUNK)
            if not chunk:
                break
            dst.write(chunk)
            task["done_bytes"] += len(chunk)
            task["file_done"] += len(chunk)


def _write_zip_entries(zf, plan, dirs, task=None, skipped=None):
    """把打包清单写入 zip（目录条目 + 文件条目）。

    task=None：同步打包（/dlzip 直传），逐文件预检后 zf.write 直传路径，
    与历史实现完全一致（行为零变化）；
    task 给定：后台任务打包，分块写入并推进度/支持取消，跳过清单累计到 skipped。
    """
    if skipped is None:
        skipped = []
    # 先写目录条目（external_attr 置 DOS 目录位，保证空目录也进包）
    for arcname, rpath in dirs:
        try:
            st = os.stat(rpath)
            zinfo = zipfile.ZipInfo(arcname.rstrip("/") + "/")
            zinfo.date_time = time.localtime(st.st_mtime)[:6]
            zinfo.external_attr = 0x10  # DOS 目录属性位
            zf.writestr(zinfo, b"")
        except Exception:  # noqa: BLE001
            pass  # 目录条目写失败不致命，文件条目继续
    if task is None:
        # 逐个文件预检：能打开且可读才入包，失败跳过（不终止打包）
        ok_files = []
        for arcname, rpath in plan:
            try:
                with open(rpath, "rb") as fh:
                    fh.read(1)
            except (PermissionError, OSError) as exc:
                skipped.append({"path": rpath, "reason": "文件无法读取: %s" % exc})
                continue
            ok_files.append((arcname, rpath))
        # 再写文件（预检通过后若仍失败，跳过并记录）
        for arcname, rpath in ok_files:
            try:
                zf.write(rpath, arcname)
            except Exception as exc:  # noqa: BLE001
                skipped.append({"path": rpath, "reason": "写入失败: %s" % exc})
    else:
        # 任务模式：逐文件分块写，取消事件穿透到 _ArchiveAborted
        for arcname, rpath in plan:
            try:
                _write_entry_chunked(zf, task, arcname, rpath)
            except _ArchiveAborted:
                raise
            except Exception as exc:  # noqa: BLE001
                skipped.append({"path": rpath, "reason": "写入失败: %s" % exc})


def _stream_archive(handler, items, mode="normal"):
    """统一打包核心：把 (arcname, realpath) 映射打包为 zip 并流式下载。

    items: [(arcname, realpath)]，arcname 为 zip 内相对路径（正斜杠分隔）；
    目录项会递归展开（含空目录，目录条目也入包），文件项直接写入。
    mode: "store"（不压缩）/ "fast"（低压缩）/ "normal"（默认压缩）。
    行为：
      * 信号量限制同时最多 2 个打包任务，超出直接 429 拒绝。
      * 打包前递归估算总大小，临时盘剩余空间不足 → 400。
      * 读不了的文件/目录跳过并记入响应头 X-Archive-Skipped（URL 编码 JSON）。
      * 文件全部跳过且没有任何目录条目 → 400 JSON。
      * 前端断开后捕获写入异常，finally 清理临时文件。
    已拆分为 _scan_plan（扫描）+ _write_zip_entries（写包）两个可复用函数，
    本函数仅为薄封装（行为与历史实现一致，打包中心后台任务复用同一核心）。
    """
    compression, level = _ARCHIVE_MODES.get(mode, _ARCHIVE_MODES["normal"])
    if not _ARCHIVE_SEM.acquire(blocking=False):
        # 并发限制：同时最多 2 个打包任务，超出直接拒绝（不让线程无界堆积在排队上）
        handler._send_json({"error": "已有打包任务进行中，请稍后重试"}, 429)
        return
    try:
        plan, dirs, total_size, skipped = _scan_plan(items)

        # 临时盘剩余空间预检：估算总大小超过剩余空间直接拒绝
        try:
            tmp_drive = os.path.splitdrive(tempfile.gettempdir())[0] + os.sep
            if total_size > shutil.disk_usage(tmp_drive).free:
                handler._send_json({
                    "error": "临时空间不足，本次打包需要约 %d MB 可用空间"
                             % (total_size // (1024 * 1024)),
                }, 400)
                return
        except OSError:
            pass  # disk_usage 失败不阻塞打包

        # 一个文件都没打成且没有任何目录条目 → 400
        if not plan and not dirs:
            handler._send_json({"error": "所有选中项均无法读取"}, 400)
            return

        fd, tmp = tempfile.mkstemp(suffix=".zip")
        os.close(fd)
        try:
            os.unlink(tmp)  # 让 zipfile 创建全新文件
        except OSError:
            pass
        try:
            if level is None:
                zf = zipfile.ZipFile(tmp, "w", compression)
            else:
                zf = zipfile.ZipFile(tmp, "w", compression, compresslevel=level)
            with zf:
                _write_zip_entries(zf, plan, dirs, task=None, skipped=skipped)
            name = "打包下载_%d.zip" % int(datetime.datetime.now().timestamp())
            handler.send_response(200)
            handler.send_header("Content-Type", "application/octet-stream")
            handler.send_header("Content-Length", str(os.path.getsize(tmp)))
            handler.send_header(
                "Content-Disposition",
                "attachment; filename*=UTF-8''" + urllib.parse.quote(name),
            )
            handler.send_header("Cache-Control", "no-store")
            handler.send_header("X-Archive-Format", "zip")
            if skipped:
                # 跳过清单 URL 编码 JSON 放响应头，供前端解析展示；
                # 钳制编码后 ≤8KB（最多 50 条）并附总数头，避免代理/浏览器因响应头超长丢弃响应
                payload = urllib.parse.quote(
                    json.dumps(skipped[:50], ensure_ascii=False))
                if len(payload) > 8000:
                    payload = payload[:8000]
                handler.send_header("X-Archive-Skipped", payload)
                handler.send_header("X-Archive-Skipped-Count", str(len(skipped)))
            handler.end_headers()
            with open(tmp, "rb") as fh:
                shutil.copyfileobj(fh, handler.wfile)
        except Exception as exc:  # noqa: BLE001
            try:
                handler._send_error_page("打包失败", str(exc))
            except Exception:  # noqa: BLE001
                pass  # 前端已断开时不再尝试发错误页
        finally:
            try:
                os.unlink(tmp)
            except OSError:
                pass
    finally:
        _ARCHIVE_SEM.release()


def _archive_tmp_path(task_id):
    """后台任务 zip 的固定临时路径（可预测，供启动清扫与断点下载）。"""
    return os.path.join(tempfile.gettempdir(), "tk_%s.zip" % task_id)


def _archive_rm_tmp(task_id):
    """删除任务对应的临时 zip 文件（文件不存在时静默。"""
    try:
        os.unlink(_archive_tmp_path(task_id))
    except OSError:
        pass


def _archive_delete_task(task):
    """从任务表删除并清理其临时 zip 文件（调用方需保证表格访问线程安全）。"""
    _ARCHIVE_TASKS.pop(task["task_id"], None)
    _archive_rm_tmp(task["task_id"])


def _archive_sweep_tmp():
    """启动清扫：删除临时目录下历史遗留的 tk_*.zip（上次运行崩溃残留）。

    命名可预测（tk_<task_id>.zip），glob 精确匹配，绝不误删其它程序的临时文件。
    """
    tdir = tempfile.gettempdir()
    try:
        for name in os.listdir(tdir):
            if name.startswith("tk_") and name.endswith(".zip"):
                try:
                    os.unlink(os.path.join(tdir, name))
                except OSError:
                    pass
    except OSError:
        pass


def _archive_new_task(paths, mode):
    """创建后台打包任务并启动工人线程；返回 (task, None) 或 (None, err)。

    paths: 源路径列表（dict 去重保序）；mode: store|fast|normal（非法回退 normal）。
    排队上限：queued+scanning+compressing ≥ _ARCHIVE_QUEUE_MAX 时拒绝（429 由路由处理）。
    """
    _archive_poll_cleanup()
    # 校验：去重保序 + 存在性过滤（不存在的路径记入 skipped，不终止整体）
    abs_paths = []
    for p in paths or []:
        if not isinstance(p, str) or not p.strip():
            continue
        try:
            ap = os.path.realpath(p.strip())
        except Exception:  # noqa: BLE001
            ap = p.strip()
        if ap not in abs_paths:
            abs_paths.append(ap)
    if not abs_paths:
        return (None, {"error": "没有可打包的文件"})
    not_exist = []
    existing = []
    for p in abs_paths:
        if os.path.exists(p):
            existing.append(p)
        else:
            not_exist.append({"path": p, "reason": "路径不存在或无法访问"})
    if not existing:
        return (None, {"error": "没有可打包的文件"})
    with _ARCHIVE_TASKS_LOCK:
        active = sum(1 for t in _ARCHIVE_TASKS.values()
                     if t["state"] in ("queued", "scanning", "compressing"))
        if active >= _ARCHIVE_QUEUE_MAX:
            return (None, {"error": "打包任务过多，请稍后再试", "queue_full": True})
        task_id = uuid.uuid4().hex[:12]
        names = []
        for p in existing:
            base = os.path.basename(p.rstrip("\\/"))
            names.append(base or p)
        task = {
            "task_id": task_id,
            "paths": existing,
            "names": names,
            "mode": mode if mode in _ARCHIVE_MODES else "normal",
            "state": "queued",
            "created_at": time.time(),
            "total_bytes": 0,
            "done_bytes": 0,
            "current_file": "",
            "file_total": 0,
            "file_done": 0,
            "skipped": not_exist,
            "error": None,
            "temp": None,
            "dl_total_bytes": 0,
            "bytes_sent": 0,
            "cancel_evt": threading.Event(),
            "lock": threading.RLock(),
        }
        _ARCHIVE_TASKS[task_id] = task
        threading.Thread(target=_archive_worker, args=(task,), daemon=True).start()
    return (task, None)


def _archive_worker(task):
    """后台打包工人：排队→扫描→压缩→就绪；退出时必 release 信号量。

    状态机：queued→scanning→compressing→ready；取消→aborted；异常→failed。
    扫描阶段发现的跳过项并入创建的 skipped 清单；压缩前的临时盘空间预检也在此。
    """
    tmp = None
    try:
        # 信号量即排队（同时最多 2 个压缩进行中，与 /dlzip 同步打包共享额度）
        _ARCHIVE_SEM.acquire()
        task["state"] = "scanning"
        items = _build_archive_items(task["paths"])
        plan, dirs, total, skipped = _scan_plan(items)
        task["total_bytes"] = total
        # 创建时的不存在路径跳过项保留在前，扫描发现的跳过项追加在后
        task["skipped"] = list(task["skipped"]) + skipped
        # 一个文件都没打成且没有任何目录条目 → 视为失败
        if not plan and not dirs:
            raise RuntimeError("所有选中项均无法读取")
        if task["cancel_evt"].is_set():
            raise _ArchiveAborted()
        # 临时盘剩余空间预检（与同步打包同一文案）
        try:
            tmp_drive = os.path.splitdrive(tempfile.gettempdir())[0] + os.sep
            if total > shutil.disk_usage(tmp_drive).free:
                raise RuntimeError(
                    "临时空间不足，本次打包需要约 %d MB 可用空间" % (total // (1024 * 1024)))
        except OSError:
            pass  # disk_usage 失败不阻塞打包
        task["state"] = "compressing"
        # 先 mkstemp 占名再 unlink，让 ZipFile 自建全新文件；
        # 压缩完成后 rename 到固定 tk_<task_id>.zip（可预测名字，供下载与清扫）
        fd, tmp = tempfile.mkstemp(suffix=".zip")
        os.close(fd)
        try:
            os.unlink(tmp)
        except OSError:
            pass
        compression, level = _ARCHIVE_MODES.get(task["mode"], _ARCHIVE_MODES["normal"])
        if level is None:
            zf = zipfile.ZipFile(tmp, "w", compression)
        else:
            zf = zipfile.ZipFile(tmp, "w", compression, compresslevel=level)
        with zf:
            _write_zip_entries(zf, plan, dirs, task=task, skipped=task["skipped"])
        task["state"] = "ready"
        task["dl_total_bytes"] = os.path.getsize(tmp)
        tk_path = _archive_tmp_path(task["task_id"])
        os.rename(tmp, tk_path)
        tmp = None  # 已挪位，finally 不再清理
        task["temp"] = tk_path
    except _ArchiveAborted:
        task["state"] = "aborted"
        task["error"] = None
    except Exception as exc:  # noqa: BLE001
        task["state"] = "failed"
        task["error"] = str(exc)
    finally:
        if tmp is not None:
            try:
                os.unlink(tmp)
            except OSError:
                pass
        _ARCHIVE_SEM.release()


def _archive_task_light(task, full=False):
    """轻量任务快照（轮询用，不含重字段；full 时带完整 skipped 清单）。"""
    snap = {
        "task_id": task["task_id"],
        "state": task["state"],
        "mode": task["mode"],
        "names": list(task["names"]),
        "total_bytes": task["total_bytes"],
        "done_bytes": task["done_bytes"],
        "current_file": task["current_file"],
        "file_total": task["file_total"],
        "file_done": task["file_done"],
        "skipped_count": len(task["skipped"]),
        "error": task["error"],
        "dl_total_bytes": task["dl_total_bytes"],
        "bytes_sent": task["bytes_sent"],
        "created_at": task["created_at"],
    }
    if full:
        snap["skipped"] = list(task["skipped"])
    return snap


def _archive_poll_cleanup():
    """惰性清理任务表：TTL 过期任务删除/取消 + 超上限逐出最旧终态。

    TTL：任何状态的 created_at 超 30 分钟（终态直接删除，active 置取消事件）；
    上限 _ARCHIVE_TASK_CAP：超限逐出最旧终态（活任务不強杀）。
    在 /api/archives 与创建任务时调用，无后台守护线程。
    """
    with _ARCHIVE_TASKS_LOCK:
        now = time.time()
        stale = [t for t in _ARCHIVE_TASKS.values()
                 if now - t["created_at"] > _ARCHIVE_TASK_TTL]
        for t in stale:
            if t["state"] in ("queued", "scanning", "compressing", "downloading"):
                # 活任务：置取消事件（工人/下载循环会收敛并自清），任务随后移除
                t["cancel_evt"].set()
                _archive_delete_task(t)
            else:
                _archive_delete_task(t)
        # 超上限：逐出最旧终态（ready/done/failed/aborted/downloading 都算终态可逐出）
        while len(_ARCHIVE_TASKS) > _ARCHIVE_TASK_CAP:
            finals = [t for t in _ARCHIVE_TASKS.values()
                      if t["state"] in ("ready", "done", "failed", "aborted", "downloading")]
            if not finals:
                break
            oldest = min(finals, key=lambda t: t["created_at"])
            _archive_delete_task(oldest)


def _archive_preview(path):
    """打包预览单路径：文件 → {name,is_dir:false,size}；目录 → 行 + 子项统计。

    目录统计 child_count（子项数）与 child_bytes（首层文件大小和）；
    目录权限失败时 child_count=-1 由前端提示。
    """
    if os.path.isfile(path):
        return {"name": os.path.basename(path) or path, "is_dir": False,
                "size": os.path.getsize(path)}
    if os.path.isdir(path):
        item = {"name": os.path.basename(path) or path, "is_dir": True,
                "size": None, "child_count": 0, "child_bytes": 0}
        try:
            with os.scandir(path) as it:
                for e in it:
                    item["child_count"] += 1
                    try:
                        if e.is_dir(follow_symlinks=False):
                            continue
                        item["child_bytes"] += e.stat(follow_symlinks=False).st_size
                    except OSError:
                        pass
        except OSError:
            item["child_count"] = -1  # 权限失败：前端按"统计失败"提示
        return item
    return None


def _archive_dl(handler, task):
    """流式投递打包好的 zip（原生下载，无 Blob）：ready/done → 流完成 → done。

    下载中断（断连）→ 回滚 ready 可再下载；用户取消（cancel_evt）→ 任务直接删除。
    状态登记 downloading 期间其他请求不会重复投递。
    """
    with task["lock"]:
        if task["state"] not in ("ready", "done"):
            handler._send_json({"error": "压缩尚未完成"}, 409)
            return
        task["state"] = "downloading"
        task["bytes_sent"] = 0
        fsize = task["dl_total_bytes"]
        if fsize <= 0:
            try:
                fsize = os.path.getsize(_archive_tmp_path(task["task_id"]))
            except OSError:
                handler._send_json({"error": "压缩包不存在"}, 404)
                return
    name = "打包下载_%d.zip" % int(datetime.datetime.now().timestamp())
    try:
        handler.send_response(200)
        handler.send_header("Content-Type", "application/octet-stream")
        handler.send_header("Content-Length", str(fsize))
        handler.send_header(
            "Content-Disposition",
            "attachment; filename*=UTF-8''" + urllib.parse.quote(name),
        )
        handler.send_header("Cache-Control", "no-store")
        handler.send_header("X-Archive-Format", "zip")
        handler.end_headers()
        sent = 0
        last_report = 0
        with open(_archive_tmp_path(task["task_id"]), "rb") as fh:
            while True:
                if task["cancel_evt"].is_set():
                    raise _ArchiveAborted()
                chunk = fh.read(_ARCHIVE_CHUNK)
                if not chunk:
                    break
                handler.wfile.write(chunk)
                sent += len(chunk)
                # 每 4MB 更新一次 bytes_sent（供前端下载进度）
                if sent - last_report >= 4 * _ARCHIVE_CHUNK:
                    task["bytes_sent"] = sent
                    last_report = sent
        with task["lock"]:
            task["bytes_sent"] = sent
            task["state"] = "done"
    except _ArchiveAborted:
        # 用户主动取消下载：任务直接删除（响应已开始，连接由浏览器关闭承继）
        with task["lock"]:
            _archive_delete_task(task)
    except Exception:  # noqa: BLE001
        # 前端断连等写流异常：回滚 ready 可再下载，bytes_sent 清零；
        # 此时 wfile 已断，无法再写任何响应
        with task["lock"]:
            task["state"] = "ready"
            task["bytes_sent"] = 0


_CERT_CN = "transfer.local"


def _cert_san():
    """证书 SAN：DNS 名 + 本机全部可访问 IP（回环/局域网/虚拟网卡/公网 IPv6）。

    浏览器按 IP 访问 https 时只会做 SAN 中的 IP 匹配，若 SAN 缺 IP 会报
    "主机名不匹配"（不可绕过）。因此证书必须把本机所有 IP 都写进 SAN。
    """
    san = [x509.DNSName(_CERT_CN)]
    ips = ["127.0.0.1", "::1"]
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if ip not in ips:
                ips.append(ip)
    except OSError:
        pass
    for ip in _public_ipv6():
        if ip not in ips:
            ips.append(ip)
    for ip in ips:
        san.append(x509.IPAddress(ipaddress.ip_address(ip)))
    return san


def _cert_needs_rebuild() -> bool:
    """证书缺失/损坏/已过期/SAN 不含 IP 时都需要重新生成。

    旧证书 SAN 只有 DNS 名没有 IP，按 IP 访问会主机名不匹配而无法使用；
    检测到这类证书应自动重建，否则旧证书会一直卡住 https。
    """
    try:
        with open(CERT_FILE, "rb") as fh:
            cert = x509.load_pem_x509_certificate(fh.read())
    except Exception:  # noqa: BLE001
        return True
    if cert.not_valid_after_utc <= datetime.datetime.now(datetime.timezone.utc):
        return True
    try:
        san = cert.extensions.get_extension_for_class(x509.SubjectAlternativeName).value
    except x509.ExtensionNotFound:
        return True
    return not any(isinstance(item, x509.IPAddress) for item in san)


def _ensure_cert() -> None:
    if os.path.exists(CERT_FILE) and os.path.exists(KEY_FILE) and not _cert_needs_rebuild():
        return
    os.makedirs(CERT_DIR, exist_ok=True)
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, _CERT_CN)])
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(minutes=5))
        .not_valid_after(now + datetime.timedelta(days=7))
        .add_extension(
            x509.SubjectAlternativeName(_cert_san()),
            critical=False,
        )
        .sign(key, hashes.SHA256())
    )
    with open(CERT_FILE, "wb") as fh:
        fh.write(cert.public_bytes(serialization.Encoding.PEM))
    with open(KEY_FILE, "wb") as fh:
        fh.write(
            key.private_bytes(
                serialization.Encoding.PEM,
                serialization.PrivateFormat.PKCS8,
                serialization.NoEncryption(),
            )
        )


# 小米/华为等 Android 安装 CA 证书要求 .p12（PKCS#12，必须含私钥），.crt 只含证书会被拒。
# 此密码用于手机端安装 .p12 时输入，仅在一次性安装自签名证书时使用。
CERT_P12_PASSWORD = "1234"


def _cert_p12_bytes() -> bytes:
    """把私钥+证书打包为 PKCS#12 字节流（供 Android 安装 CA 证书）"""
    with open(KEY_FILE, "rb") as fh:
        key = serialization.load_pem_private_key(fh.read(), password=None)
    with open(CERT_FILE, "rb") as fh:
        cert = x509.load_pem_x509_certificate(fh.read())
    return pkcs12.serialize_key_and_certificates(
        name=_CERT_CN.encode(),
        key=key,
        cert=cert,
        cas=None,
        encryption_algorithm=serialization.BestAvailableEncryption(
            CERT_P12_PASSWORD.encode()
        ),
    )


def _public_ipv6():
    out = []
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET6):
            ip = info[4][0]
            if ip.startswith("fe80") or ip == "::1":
                continue
            if not ip.startswith(("fd", "fc")):
                out.append(ip)
    except OSError:
        pass
    return out


def _private_ipv4():
    """本机私网 IPv4（局域网内可直达，手机/另一台电脑可用）。"""
    out, seen = [], set()

    def _add(ip):
        if ip in seen:
            return
        seen.add(ip)
        try:
            a = ipaddress.ip_address(ip)
        except ValueError:
            return
        if a.is_loopback or a.is_link_local or not a.is_private:
            return
        out.append(ip)

    try:
        # UDP 假连接不实际发包，仅让系统选出默认路由网卡的地址
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            _add(s.getsockname()[0])
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            _add(info[4][0])
    except OSError:
        pass
    return out


def _urls(port, token):
    urls = ["https://[%s]:%d/%s/" % (ip, port, token) for ip in _public_ipv6()]
    urls += ["https://%s:%d/%s/" % (ip, port, token) for ip in _private_ipv4()]
    urls.append("https://127.0.0.1:%d/%s/" % (port, token))
    return urls


def _urls_http(port, token):
    """HTTP 明文访问 URL（与 HTTPS 同一端口，首字节嗅探自动识别协议）。"""
    urls = ["http://[%s]:%d/%s/" % (ip, port, token) for ip in _public_ipv6()]
    urls += ["http://%s:%d/%s/" % (ip, port, token) for ip in _private_ipv4()]
    urls.append("http://127.0.0.1:%d/%s/" % (port, token))
    return urls


def _add_firewall_rule(port):
    name = "TransferMCP-%d" % port
    cmd = [
        "netsh", "advfirewall", "firewall", "add", "rule",
        "name=" + name, "dir=in", "action=allow", "protocol=TCP",
        "localport=%d" % port,
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        if r.returncode == 0:
            return {"ok": True, "rule": name}
        return {
            "ok": False,
            "error": (r.stdout + r.stderr).strip(),
            "fix": (
                "需要管理员权限，请以管理员身份运行 PowerShell 执行：\n"
                'netsh advfirewall firewall add rule name="%s" '
                "dir=in action=allow protocol=TCP localport=%d" % (name, port)
            ),
        }
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}


def _remove_firewall_rule(port):
    name = "TransferMCP-%d" % port
    try:
        subprocess.run(
            ["netsh", "advfirewall", "firewall", "delete", "rule", "name=" + name],
            capture_output=True, text=True, timeout=15,
        )
    except Exception:  # noqa: BLE001
        pass


def _start(root, port, token=None):
    # 启动清扫：删除临时目录下历史遗留的后台打包 zip（tk_*.zip 崩溃残留）
    _archive_sweep_tmp()
    if root and root.strip().lower() not in ("auto", "all"):
        roots = [os.path.abspath(os.path.expanduser(root))]
        for r in roots:
            if not os.path.isdir(r):
                raise ToolError("根目录不存在: %s" % r)
    else:
        roots = _fixed_drives()
    if _state["server"] is not None:
        raise ToolError("已有服务在运行，请先 drive_stop 再启动")

    _ensure_cert()
    token = token or secrets.token_urlsafe(9)
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(CERT_FILE, KEY_FILE)
    try:
        handler = partial(_DriveHandler)
        server = _DriveServer(("::", port), handler, roots, token, ssl_context=ctx)
    except OSError as exc:
        raise ToolError("启动失败（端口被占用或无权限）: %s" % exc) from exc
    threading.Thread(target=server.serve_forever, daemon=True).start()

    # 转码会话空闲自动终止（60s 无请求回收进程，避免常驻 ffmpeg 堆积）
    threading.Thread(target=_trans_sweep_loop, daemon=True).start()
    # 转码缓存磁盘治理（超 2GB 按 mtime 清理最旧文件）
    threading.Thread(target=_cache_sweep_loop, daemon=True).start()

    _state.update(server=server, roots=roots, port=port,
                  token=token, pinned=server.pinned)
    fw = _add_firewall_rule(port)
    hint = (
        "手机浏览器打开第一个 IPv6 URL 即可浏览/下载/上传；证书提示选择\"继续访问\"。"
        "手机若打不开 https 证书页面，请用 http:// 地址（免证书，仅限本机/局域网使用）。"
        "无权限目录会提示\"返回上级\"。用完后调用 drive_stop 关闭。"
        "若想浏览受系统保护目录，可将服务以管理员身份运行。"
    )
    if not fw.get("ok"):
        hint += " 注意：防火墙规则未添加（" + fw.get("error", "") + "），" + fw.get("fix", "")
    return {
        "running": True,
        "roots": roots,
        "port": port,
        "token": token,
        "archive_format": "zip",
        "urls": _urls(port, token),
        "urls_http": _urls_http(port, token),
        "firewall_rule": fw,
        "hint": hint,
    }


def _stop():
    if _state["server"] is None:
        return {"stopped": True, "note": "当前没有运行中的服务"}
    port = _state["port"]
    _state["server"].shutdown()
    _state["server"].server_close()
    _state.update(server=None, roots=[], port=None, token=None, pinned=[])
    _remove_firewall_rule(port)
    return {"stopped": True, "port": port}


# ----------------------------------------------------------------------- MCP

INSTRUCTIONS = """\
drive-mcp 把电脑变成手机可访问的网盘（IPv6 直连 + HTTPS 加密）。

用法：
  * drive_start(root, port)：启动服务。root 缺省或传 "auto" 时浏览整机所有固定磁盘；
    也可传单个根目录（如 D:\\资料）。
  * drive_pin(paths)：把指定文件/目录置顶到网页显著位置，页面提供「下载」和
    「打包 .zip 下载」按钮。
  * 网页支持：浏览/下载、向当前目录上传文件、置顶。
  * drive_status() / drive_stop()。
  * 无权限的目录会在页面上提示"返回上级"，不会卡死。
"""

server = MCPServer("drive-mcp", VERSION, INSTRUCTIONS)

PATH_PROP = {
    "type": "string",
    "description": "本地文件/文件夹的绝对路径，例如 C:\\Users\\name\\Desktop\\a.txt",
}


@server.tool(
    "drive_start",
    "启动网盘式文件浏览服务。root 缺省或 \"auto\" 时，手机可浏览整机所有固定磁盘；"
    "也可指定单个根目录。返回访问 URL 与打包格式。用完后调用 drive_stop 关闭。",
    {
        "type": "object",
        "properties": {
            "root": {
                "type": "string",
                "description": "根目录绝对路径；省略或 \"auto\" = 整机所有磁盘",
            },
            "port": {
                "type": "integer", "default": 8443, "minimum": 1024, "maximum": 65535,
                "description": "监听端口，默认 8443",
            },
        },
        "additionalProperties": False,
    },
    {"readOnlyHint": False, "destructiveHint": False, "openWorldHint": True},
)
def drive_start(root: str = "auto", port: int = DEFAULT_PORT) -> dict:
    return _start(root, port)


@server.tool(
    "drive_pin",
    "把指定文件/文件夹置顶到网页的显著位置（可重复调用追加）。网页上会为每个置顶项"
    "显示「下载」按钮，并提供「打包下载」按钮（.zip）。",
    {
        "type": "object",
        "properties": {
            "paths": {
                "type": "array",
                "items": PATH_PROP,
                "minItems": 1,
                "description": "要置顶的文件/文件夹绝对路径列表",
            },
        },
        "required": ["paths"],
        "additionalProperties": False,
    },
    {"readOnlyHint": False, "destructiveHint": False, "openWorldHint": True},
)
def drive_pin(paths) -> dict:
    if _state["server"] is None:
        raise ToolError("服务未运行，请先调用 drive_start")
    added, skipped = [], []
    for raw in paths:
        try:
            p = os.path.realpath(os.path.abspath(os.path.expanduser(raw)))
        except Exception:  # noqa: BLE001
            skipped.append({"path": raw, "reason": "路径无效"})
            continue
        if not any(_under(root, p) for root in _state["roots"]):
            skipped.append({"path": raw, "reason": "超出允许的根目录"})
            continue
        if not os.path.exists(p):
            skipped.append({"path": raw, "reason": "不存在"})
            continue
        is_dir = os.path.isdir(p)
        item = {
            "path": p,
            "name": os.path.basename(p) or p,
            "is_dir": is_dir,
            "size": None if is_dir else os.path.getsize(p),
        }
        if not any(x["path"] == p for x in _state["pinned"]):
            _state["pinned"].append(item)
        added.append(p)
    return {
        "added": added,
        "skipped": skipped,
        "pinned": list(_state["pinned"]),
        "archive_format": "zip",
    }


@server.tool(
    "drive_status",
    "查询网盘服务的运行状态：是否在运行、允许的根目录、端口与访问 URL。",
    {"type": "object", "properties": {}, "additionalProperties": False},
    {"readOnlyHint": True, "openWorldHint": True},
)
def drive_status() -> dict:
    if _state["server"] is None:
        return {"running": False}
    return {
        "running": True,
        "roots": list(_state["roots"]),
        "port": _state["port"],
        "pinned": list(_state["pinned"]),
        "archive_format": "zip",
        "urls": _urls(_state["port"], _state["token"]),
        "urls_http": _urls_http(_state["port"], _state["token"]),
    }


@server.tool(
    "drive_stop",
    "停止网盘服务并清理防火墙入站规则。传输完成后务必调用。",
    {"type": "object", "properties": {}, "additionalProperties": False},
    {"readOnlyHint": False, "destructiveHint": True, "openWorldHint": True},
)
def drive_stop() -> dict:
    return _stop()


def _under(root, path):
    try:
        return os.path.commonpath([os.path.realpath(root), os.path.realpath(path)]) == os.path.realpath(root)
    except ValueError:
        return False


# --------------------------------------------------------------------- CLI


def _system_proxy_hint(port):
    """检测 Windows 系统代理是否开启，开启时提示浏览器访问本机地址可能被代理拦 502。"""
    if os.name != "nt":
        return None
    try:
        import winreg
        with winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Internet Settings",
        ) as k:
            if not winreg.QueryValueEx(k, "ProxyEnable")[0]:
                return None
            server = winreg.QueryValueEx(k, "ProxyServer")[0]
    except OSError:
        return None
    return (
        "检测到系统代理已开启（%s）。浏览器访问 http://localhost:%d（或 127.0.0.1）"
        "可能被代理软件拦截返回 502 Bad Gateway，而命令行直连正常。\n"
        "解决：在浏览器代理排除列表中加入 localhost;127.0.0.1;局域网段（如 192.168.*），"
        "或在代理软件规则中将本机/局域网地址改为直连，或关闭系统代理/浏览器代理插件。"
    ) % (server, port)


def _cli_bind_retry(root, port, token=None, attempts=3):
    """启动时 bind 失败（端口未及释放/被其他进程占用）按 3 秒间隔重试 N 次，
    避免与"刚杀掉的旧实例"在端口释放上赛跑；不相关的错误立即抛出。"""
    for i in range(1, attempts + 1):
        try:
            return _start(root, port, token)
        except ToolError as exc:
            msg = "%s" % exc
            if "10048" not in msg and "被占用" not in msg:
                raise
            if i < attempts:
                sys.stderr.write(
                    "端口仍被占用，3 秒后重试（第 %d/%d 次）...\n" % (i, attempts))
                time.sleep(3)
            else:
                sys.stderr.write("启动失败: %s\n" % exc)
                sys.stderr.write(
                    "提示: 可用 netstat -ano | findstr :%d 查看占用进程，"
                    "必要时以管理员身份运行启动脚本后重试。\n" % port)
                raise


def _http_probe_ok(port, token):
    """本地 HTTP 自探测：对 /<token>/api/info 发一次请求，只要服务给出任一
    HTTP 响应（含 4xx/5xx）都视为"进程在正常处理请求"；连响应都没有才判定
    假死。返回 True = 服务正常响应。"""
    try:
        with urllib.request.urlopen(
            "http://127.0.0.1:%d/%s/api/info" % (port, token), timeout=3,
        ) as resp:
            return resp.status < 500
    except Exception:  # noqa: BLE001 - 探测失败视为不健康
        return False


def _start_watchdog(port, token):
    """僵尸监听看门狗：端口还开着但请求无人处理（服务假死）时，进程自动退出，
    交由启动脚本快速重启——避免"窗口看起来在跑、实际访问不了"的隐蔽失败。"""
    def _loop():
        fails = 0
        while True:
            time.sleep(10)
            if _http_probe_ok(port, token):
                fails = 0
            else:
                fails += 1
            if fails >= 3:
                sys.stderr.write(
                    "[watchdog] 本地自探测连续无响应，判定服务僵死（端口仍监听但"
                    "请求不被处理），自动退出，交由启动脚本重启。\n")
                os._exit(2)
    threading.Thread(target=_loop, daemon=True,
                     name="drive-watchdog").start()


def _cli_serve(root, port, token=None):
    try:
        info = _cli_bind_retry(root, port, token)
    except ToolError as exc:
        sys.stderr.write("启动失败: %s\n" % exc)
        sys.exit(1)
    for u in info["urls"]:
        print(u, flush=True)
    for u in info.get("urls_http") or []:
        print(u + "  (HTTP 免证书明文，与 HTTPS 同端口；手机打不开 https 证书页时把 https:// 改成 http://)", flush=True)
    print("根目录: %s" % ", ".join(info["roots"]), flush=True)
    print("打包格式: %s" % info["archive_format"], flush=True)
    hint = _system_proxy_hint(port)
    if hint:
        sys.stderr.write(hint + "\n")
    # 本机自检：确认实际能处理请求，而不是"端口占着但服务没起来"
    if _http_probe_ok(port, info["token"]):
        print("本机自检: OK（http://127.0.0.1:%d/%s/ 本地探测返回正常响应）"
              % (port, info["token"]), flush=True)
    else:
        print("本机自检: FAIL（端口已监听但本地请求无响应，自动退出，脚本将快速重启）", flush=True)
        os._exit(2)
    _start_watchdog(port, info["token"])
    print("按 Ctrl+C 停止服务", flush=True)
    try:
        while True:
            threading.Event().wait(3600)
    except KeyboardInterrupt:
        _stop()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="drive-mcp: 手机网盘式文件浏览")
    parser.add_argument("--serve", metavar="根目录", nargs="?", const="auto",
                        help="CLI 模式：直接启动服务（缺省=整机所有磁盘）")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--token", type=str, default=None,
                        help="固定访问令牌（默认每次启动随机；指定后重启链接不变）")
    args = parser.parse_args()
    if args.serve:
        _cli_serve(args.serve, args.port, args.token)
    else:
        server.run()
