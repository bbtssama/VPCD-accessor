#!/usr/bin/env python3
"""drive-mcp v3 — 手机网盘式文件浏览器（MCP + CLI 双模式）。

特性：
  * 浅色现代网盘 UI：磁盘标签页、面包屑、上传、下载、置顶、打包。
  * 默认浏览整机所有固定磁盘（也可指定单个根目录）。
  * 只读浏览 + 可向当前目录上传文件（不能删除/修改服务器端已有文件）。
  * 打包下载：检测到 WinRAR 用 .rar，否则自动降级 .zip。
  * 权限错误优雅处理：无权限目录提示"返回上级"，页面不卡死。

工具（MCP 模式）：
  drive_start(root, port)   启动服务；root 缺省=整机所有磁盘
  drive_pin(paths)          把文件/目录置顶到网页显著位置
  drive_status() / drive_stop()
"""

from __future__ import annotations

import argparse
import cgi
import ctypes
import datetime
import hashlib
import html
import json
import os
import re
import secrets
import shutil
import socket
import ssl
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
import zipfile
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
    "app.js", "highlight.min.js", "highlight.min.css",
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


def _load_index_html() -> str:
    """读取前端模板；失败时返回占位页，避免服务因模板缺失而崩溃。"""
    try:
        with open(_TPL_PATH, "r", encoding="utf-8") as fh:
            return fh.read()
    except OSError:
        return "<!doctype html><html><body style='font-family:sans-serif;padding:40px'>模板缺失: %s</body></html>" % _TPL_PATH


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
          * 图标目录：static/icons/<name>.svg（name 由白名单+扩展名校验）
        """
        rel = route[len("/static/"):].lstrip("/")
        name = os.path.basename(rel)
        if name in _STATIC_ALLOWED and "/" not in rel:
            spath = os.path.join(STATIC_DIR, name)
        elif rel.startswith("icons/") and name.endswith(".svg") and "/" not in name:
            spath = os.path.join(STATIC_DIR, "icons", name)
        else:
            self._send_json({"error": "404"}, 404)
            return
        if not os.path.isfile(spath):
            self._send_json({"error": "404"}, 404)
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
        # 静态资源只短缓存：前端迭代频繁，避免手机 24h 内拿不到新版 app.js
        self.send_header("Cache-Control", "max-age=60")
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
                    info["root_name"] = share.get("name") or "置顶分享"
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
                    entries.append({
                        "name": rest,
                        "path": key,
                        "is_dir": node["is_dir"],
                        "size": None if node["is_dir"] else st.st_size,
                        "mtime": int(st.st_mtime),
                        "locked": False,
                    })
                entries.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
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
                    entries.append({
                        "name": os.path.basename(f) or f,
                        "path": f,
                        "is_dir": is_dir,
                        "size": None if is_dir else st.st_size,
                        "mtime": int(st.st_mtime),
                        "locked": False,
                    })
                entries.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
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
            data = _list_dir(p)
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
            self._send_json(_unpack_list(p))
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
            _shares[new_tok] = {
                "root": p,
                "is_dir": os.path.isdir(p),
                # 继承父分享的 expires_at（共享同一个过期时间）
                "expires_at": share["expires_at"],
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
            # 虚拟分享下把 (虚拟相对路径, 真实路径) 交给 _stream_archive_virtual 输出 .lnk 复用。
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
                _stream_archive_virtual(self, virtual_items)
                return
            paths = [self._resolve_share_path(share, x) for x in raw.split("|") if x]
            paths = [p for p in paths if p and os.path.exists(p)]
            if not paths:
                self._send_json({"error": "没有可打包的文件"}, 400)
                return
            _stream_archive(self, paths)
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
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        route = self.path[len(tok):].split("?")[0].rstrip("/") or "/"
        q = self._query()

        if route == "/":
            self._send_html()
        elif route.startswith("/static/"):
            # 离线内置 Bootstrap 静态资源（白名单文件名，杜绝路径穿越）
            self._send_static(route)
        elif route == "/api/info":
            self._send_json({
                "roots": list(self.server.roots),
                "pinned": list(self.server.pinned),
                "archive_format": "rar" if _find_winrar() else "zip",
            })
        elif route == "/api/list":
            p = self._resolve(q.get("path") or self.server.roots[0])
            if p is None:
                self._send_json({"error": "路径越界或不存在"}, 403)
                return
            data = _list_dir(p)
            if data is None:
                self._send_json({"error": "没有权限访问该目录",
                                 "parent": _parent_of(p, self.server.roots)}, 403)
                return
            entries, err = data
            if err:
                self._send_json({"error": err}, 500)
                return
            self._send_json({
                "path": p,
                "parent": _parent_of(p, self.server.roots),
                "entries": entries,
            })
        elif route == "/api/pin":
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
                    "name": "置顶分享(%d 个)" % len(files),
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
            # 压缩包条目列表（zip/rar）
            p = self._resolve(q.get("path") or "")
            if p is None or not os.path.isfile(p):
                self._send_json({"error": "路径越界或不存在"}, 403)
                return
            self._send_json(_unpack_list(p))
        elif route == "/api/unpackdl":
            # 下载压缩包内的单个条目（zip 流式 / rar 由 UnRAR 输出）
            arch = self._resolve(q.get("archive") or "")
            entry = q.get("entry") or ""
            if arch is None or not os.path.isfile(arch):
                self._send_error_page("压缩包不存在或越界", str(arch))
                return
            _unpack_download(self, arch, entry)
        elif route == "/dl":
            # 下载（支持 Range 断点续传；token 在 URL 里，中途换 IP 也能继续）
            p = self._resolve(q.get("path") or "")
            if p is None or not os.path.isfile(p):
                self._send_error_page("文件不存在或越界", str(p))
                return
            self._send_file_range(p)
        elif route == "/dlzip":
            raw = q.get("paths") or ""
            paths = [self._resolve(x) for x in raw.split("|") if x]
            paths = [p for p in paths if p and os.path.exists(p)]
            if not paths:
                self._send_json({"error": "没有可打包的文件"}, 400)
                return
            _stream_archive(self, paths)
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
            # 修复浏览器中文文件名可能出现的编码错乱
            try:
                fname = fname.encode("latin-1").decode("utf-8")
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

    def log_message(self, fmt, *args):  # noqa: A003
        sys.stderr.write("[drive] %s\n" % (fmt % args))


class _DriveServer(ThreadingHTTPServer):
    address_family = socket.AF_INET6
    daemon_threads = True
    # Windows 默认 SO_REUSEADDR 允许两个进程绑定同一端口，导致旧实例没退出时
    # 新实例"静默启动成功"、请求随机分发到新旧两个进程。关闭复用让端口被占时
    # bind 直接抛 OSError，新实例明确失败退出，避免多实例并存。
    allow_reuse_address = False

    def __init__(self, addr, handler, roots, token):
        self.roots = roots
        self.token = token
        self.pinned = []
        super().__init__(addr, handler)

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


def _list_dir(path):
    """列出目录内容（目录在前，按名排序）。权限错误返回 None。

    系统锁定的根级噪声文件（DumpStack.log、hiberfil.sys 等）保留在列表中，
    但标记 locked=True，前端以灰色显示并提示"无法下载"。
    """
    noise = _SYSTEM_NOISE
    out = []
    try:
        with os.scandir(path) as it:
            for e in it:
                try:
                    is_dir = e.is_dir(follow_symlinks=False)
                    st = e.stat(follow_symlinks=False)
                    out.append({
                        "name": e.name,
                        "path": os.path.join(path, e.name),
                        "is_dir": is_dir,
                        "size": None if is_dir else st.st_size,
                        "mtime": int(st.st_mtime),
                        "locked": not is_dir and e.name.lower() in noise,
                    })
                except OSError:
                    continue
    except PermissionError:
        return None
    except OSError as exc:
        return (None, str(exc))
    out.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
    return out, None


def _find_winrar():
    cands = [
        r"C:\Users\user\Desktop\other\WinRAR\Rar.exe",
        r"C:\Users\user\Desktop\other\WinRAR\WinRAR.exe",
        r"C:\Program Files\WinRAR\WinRAR.exe",
        r"C:\Program Files\WinRAR\Rar.exe",
        r"C:\Program Files (x86)\WinRAR\WinRAR.exe",
        r"C:\Program Files (x86)\WinRAR\Rar.exe",
    ]
    env = os.environ.get("WINRAR_PATH")
    if env and os.path.exists(env):
        return env
    for c in cands:
        if os.path.exists(c):
            return c
    return shutil.which("WinRAR.exe") or shutil.which("Rar.exe")


def _find_unrar():
    cands = [
        r"C:\Users\user\Desktop\other\WinRAR\UnRAR.exe",
        r"C:\Program Files\WinRAR\UnRAR.exe",
        r"C:\Program Files (x86)\WinRAR\UnRAR.exe",
    ]
    env = os.environ.get("UNRAR_PATH")
    if env and os.path.exists(env):
        return env
    for c in cands:
        if os.path.exists(c):
            return c
    return shutil.which("UnRAR.exe") or shutil.which("UnRAR")


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
_ARCHIVE_EXT = {"zip", "rar"}
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


def _read_text(path, limit=1024 * 1024):
    """读取文本文件前 limit 字节；BOM 优先识别，否则 utf-8 → gbk → latin-1 逐级解码。"""
    ext = os.path.splitext(path)[1].lstrip(".").lower()
    kind = "markdown" if ext in _MD_EXT else ("csv" if ext == "csv" else "text")
    with open(path, "rb") as fh:
        head = fh.read(4)
        rest = fh.read(limit + 1 - len(head)) if limit + 1 > len(head) else b""
        raw = head + rest
    truncated = len(raw) > limit
    if truncated:
        raw = raw[:limit]
    enc_name, bom_len = _detect_bom(raw)
    if enc_name:
        # BOM 编码：UTF-16 可能被 limit 截成奇数个字节，用 replace 兜底避免抛错
        content = raw[bom_len:].decode(enc_name, errors="replace")
        encoding = enc_name
    else:
        content, encoding = None, None
        for enc in ("utf-8", "gbk"):
            try:
                content = raw.decode(enc)
                encoding = enc
                break
            except UnicodeDecodeError:
                continue
        if content is None:  # 兜底：latin-1 永不失败，配合 replace 保证可显示
            content = raw.decode("latin-1", errors="replace")
            encoding = "latin-1"
    return {
        "name": os.path.basename(path) or path,
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
        "$sh=New-Object -ComObject WScript.Shell; "
        "$s=$sh.CreateShortcut('%s'); "
        "Write-Output $s.TargetPath; "
        "Write-Output $s.WorkingDirectory; "
        "Write-Output $s.Arguments" % esc
    )
    try:
        r = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps],
            capture_output=True, text=True, encoding="gbk",
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
        with open(sp, "r", encoding="utf-8", errors="replace") as fh:
            content = fh.read()
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
            return r.stdout.decode("utf-8", "replace"), "embedded"
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


def _unpack_list(path):
    """压缩包条目列表（功能 4）。zip 用 zipfile；rar 用 UnRAR.exe lb（GBK 输出）。"""
    ext = os.path.splitext(path)[1].lstrip(".").lower()
    if ext == "zip":
        try:
            with zipfile.ZipFile(path) as zf:
                entries = [
                    {
                        "name": info.filename,
                        "path_in_archive": info.filename,
                        "size": info.file_size,
                        "is_dir": info.filename.endswith("/"),
                    }
                    for info in zf.infolist()
                ]
            return {"format": "zip", "entries": entries}
        except (zipfile.BadZipFile, OSError) as exc:
            return {"format": "zip", "entries": [], "error": str(exc)}
    if ext == "rar":
        unrar = _find_unrar()
        if not unrar:
            return {"format": "rar", "entries": [], "error": "未找到 UnRAR.exe"}
        try:
            # 注意：不能加 -idq，实测它会抑制 lb 的条目输出
            r = subprocess.run(
                [unrar, "lb", "-p-", path],
                capture_output=True, timeout=600,
            )
            if r.returncode != 0:
                return {"format": "rar", "entries": [],
                        "error": (r.stdout + r.stderr).decode("cp936", "replace") or
                                 "UnRAR 返回码 %d" % r.returncode}
            lines = [ln.strip() for ln in r.stdout.decode("cp936", "replace").splitlines()
                     if ln.strip()]
            entries = []
            for line in lines:
                is_dir = line.endswith(("\\", "/"))
                name = line.rstrip("\\/")
                entries.append({"name": name, "path_in_archive": name,
                                "size": 0, "is_dir": is_dir})
            # UnRAR lb 列出的目录行往往不带尾部斜杠，
            # 补充判断：是其它条目路径前缀的项也视为目录
            names = [e["name"] for e in entries]
            for e in entries:
                if e["is_dir"]:
                    continue
                if any(n != e["name"] and (n.startswith(e["name"] + "\\") or
                                           n.startswith(e["name"] + "/")) for n in names):
                    e["is_dir"] = True
            return {"format": "rar", "entries": entries}
        except Exception as exc:  # noqa: BLE001
            return {"format": "rar", "entries": [], "error": str(exc)}
    return {"format": "unsupported", "entries": []}


def _range_unsatisfiable(handler, fsize):
    handler.send_response(416)
    handler.send_header("Content-Range", "bytes */%d" % fsize)
    handler.send_header("Content-Length", "0")
    handler.end_headers()


# 视频 Range 流式输出已统一进 _send_file_range（见类内方法），此处不再单独实现


def _unpack_download(handler, archive, entry):
    """下载压缩包内的单个条目（功能 4）。zip 流式；rar 由 UnRAR p 输出。"""
    ext = os.path.splitext(archive)[1].lstrip(".").lower()
    disp = "attachment; filename*=UTF-8''" + urllib.parse.quote(os.path.basename(entry) or "file")
    if ext == "zip":
        try:
            with zipfile.ZipFile(archive) as zf:
                if entry not in zf.namelist():
                    handler._send_json({"error": "压缩包内没有该条目"}, 403)
                    return
                info = zf.getinfo(entry)
                handler.send_response(200)
                handler.send_header("Content-Type", "application/octet-stream")
                handler.send_header("Content-Length", str(info.file_size))
                handler.send_header("Content-Disposition", disp)
                handler.end_headers()
                with zf.open(entry) as src:
                    shutil.copyfileobj(src, handler.wfile)
        except Exception as exc:  # noqa: BLE001
            handler._send_error_page("解压失败", str(exc))
    elif ext == "rar":
        unrar = _find_unrar()
        if not unrar:
            handler._send_error_page("解压失败", "未找到 UnRAR.exe")
            return
        try:
            # entry 仅作为参数传给 UnRAR，不参与任何路径拼接，天然受压缩包内容限制
            r = subprocess.run(
                [unrar, "p", "-p-", "-idq", "-inul", archive, entry],
                capture_output=True, timeout=600,
            )
            if r.returncode != 0:
                msg = (r.stdout + r.stderr).decode("cp936", "replace") or \
                      "UnRAR 返回码 %d" % r.returncode
                handler._send_error_page("解压失败", msg)
                return
            data = r.stdout
            handler.send_response(200)
            handler.send_header("Content-Type", "application/octet-stream")
            handler.send_header("Content-Length", str(len(data)))
            handler.send_header("Content-Disposition", disp)
            handler.end_headers()
            handler.wfile.write(data)
        except Exception as exc:  # noqa: BLE001
            handler._send_error_page("解压失败", str(exc))
    else:
        handler._send_error_page("解压失败", "不支持的压缩包格式")


def _stream_archive(handler, paths):
    files = [p for p in dict.fromkeys(paths) if os.path.isfile(p)]
    if not files:
        handler._send_json({"error": "选中的都是目录或不存在"}, 400)
        return
    try:
        base = os.path.commonpath([os.path.dirname(f) for f in files])
    except ValueError:
        base = os.path.splitdrive(files[0])[0] + os.sep
    rels = [os.path.relpath(f, base) for f in files]
    winrar = _find_winrar()
    suffix = ".rar" if winrar else ".zip"
    fmt_name = "rar" if winrar else "zip"
    fd, tmp = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    try:
        os.unlink(tmp)  # 让 Rar/zipfile 创建全新文件
    except OSError:
        pass
    try:
        if winrar:
            # Rar.exe 在中文系统上输出 GBK，必须按 cp936 解码
            r = subprocess.run(
                [winrar, "a", "-ep1", "-r", "-idq", "-y", tmp, *rels],
                cwd=base, capture_output=True, text=True,
                encoding="cp936", errors="replace", timeout=600,
            )
            if r.returncode != 0 or not os.path.exists(tmp):
                raise RuntimeError((r.stdout or "") + (r.stderr or ""))
        else:
            with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zf:
                for f, rel in zip(files, rels):
                    zf.write(f, rel)
        name = "打包下载_%d.%s" % (int(datetime.datetime.now().timestamp()), fmt_name)
        handler.send_response(200)
        handler.send_header("Content-Type", "application/octet-stream")
        handler.send_header("Content-Length", str(os.path.getsize(tmp)))
        handler.send_header(
            "Content-Disposition",
            "attachment; filename*=UTF-8''" + urllib.parse.quote(name),
        )
        handler.send_header("X-Archive-Format", fmt_name)
        handler.end_headers()
        with open(tmp, "rb") as fh:
            shutil.copyfileobj(fh, handler.wfile)
    except Exception as exc:  # noqa: BLE001
        try:
            handler._send_error_page("打包失败", str(exc))
        except Exception:  # noqa: BLE001
            pass
    finally:
        try:
            os.unlink(tmp)
        except OSError:
            pass


def _stream_archive_virtual(handler, virtual_items):
    """把 (虚拟相对路径, 真实绝对路径) 映射打包为 zip，虚拟结构 → 物理结构。

    对每个源：
      * 文件 → 加入待打包清单（虚拟相对路径 + 真实路径）。
      * 目录 → 递归加入其下所有文件，虚拟相对路径 = 父虚拟路径 + "/" + 子名。
    去重：同一"虚拟相对路径"只保留首个；若同一真实文件被多个不同虚拟路径引用
    （复用），保留第一个为真实文件，其余写同名 .lnk 文本条目（内容为真实绝对路径），
    实现"同一文件只物理存一份，多方引用"。.lnk 仅 zipfile 可方便临时写入，故统一
    退化为 zip 格式。
    """
    plan = {}  # 虚拟相对路径 -> {"real": 真实路径, "lnk": bool}
    order = []
    seen_real = {}
    lnk_names = set()  # 已占用的 .lnk 文件名，避免 x.lnk → x.lnk.lnk 或重名

    def gather(vpath, rpath):
        vpath = vpath.rstrip("/")
        if os.path.isfile(rpath):
            if vpath in plan:
                return
            if rpath in seen_real:
                base = vpath + ".lnk"
                cand = base
                n = 2
                while cand in lnk_names or cand in plan:
                    cand = base[:-4] + " (%d).lnk" % n
                    n += 1
                plan[vpath] = {"real": rpath, "lnk": cand}
                lnk_names.add(cand)
            else:
                plan[vpath] = {"real": rpath, "lnk": False}
                seen_real[rpath] = vpath
            order.append(vpath)
            return
        try:
            with os.scandir(rpath) as it:
                for e in it:
                    gather((vpath + "/" + e.name) if vpath else e.name, e.path)
        except OSError:
            pass

    for vpath, rpath in virtual_items:
        gather(vpath, rpath)
    if not order:
        handler._send_json({"error": "选中的都是空目录或不存在"}, 400)
        return
    fd, tmp = tempfile.mkstemp(suffix=".zip")
    os.close(fd)
    try:
        os.unlink(tmp)
    except OSError:
        pass
    try:
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zf:
            for vpath in order:
                item = plan[vpath]
                if item["lnk"]:
                    zf.writestr(item["lnk"], item["real"])
                else:
                    zf.write(item["real"], vpath)
        name = "打包下载_%d.zip" % int(datetime.datetime.now().timestamp())
        handler.send_response(200)
        handler.send_header("Content-Type", "application/octet-stream")
        handler.send_header("Content-Length", str(os.path.getsize(tmp)))
        handler.send_header(
            "Content-Disposition",
            "attachment; filename*=UTF-8''" + urllib.parse.quote(name),
        )
        handler.send_header("X-Archive-Format", "zip")
        handler.end_headers()
        with open(tmp, "rb") as fh:
            shutil.copyfileobj(fh, handler.wfile)
    except Exception as exc:  # noqa: BLE001
        try:
            handler._send_error_page("打包失败", str(exc))
        except Exception:  # noqa: BLE001
            pass
    finally:
        try:
            os.unlink(tmp)
        except OSError:
            pass


def _ensure_cert() -> None:
    if os.path.exists(CERT_FILE) and os.path.exists(KEY_FILE):
        return
    os.makedirs(CERT_DIR, exist_ok=True)
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "drive.local")])
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
            x509.SubjectAlternativeName([x509.DNSName("drive.local")]),
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
        name=b"drive.local",
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


def _urls(port, token):
    urls = ["https://[%s]:%d/%s/" % (ip, port, token) for ip in _public_ipv6()]
    urls.append("https://127.0.0.1:%d/%s/" % (port, token))
    return urls


def _urls_http(port, token):
    """HTTP 免证书双监听端口（port+1）的访问 URL 列表。"""
    hp = port + 1
    urls = ["http://[%s]:%d/%s/" % (ip, hp, token) for ip in _public_ipv6()]
    urls.append("http://127.0.0.1:%d/%s/" % (hp, token))
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
        server = _DriveServer(("::", port), handler, roots, token)
    except OSError as exc:
        raise ToolError("启动失败（端口被占用或无权限）: %s" % exc) from exc
    server.socket = ctx.wrap_socket(server.socket, server_side=True)
    threading.Thread(target=server.serve_forever, daemon=True).start()

    # 纯 HTTP 双监听（port+1，免证书）：手机打不开自签名证书页面时可直接用 http://
    http_server = None
    http_port = port + 1
    try:
        http_server = _DriveServer(("::", http_port), handler, roots, token)
        threading.Thread(target=http_server.serve_forever, daemon=True).start()
    except OSError:
        http_server = None  # http 端口被占则降级，不影响 https 主服务

    # 转码会话空闲自动终止（60s 无请求回收进程，避免常驻 ffmpeg 堆积）
    threading.Thread(target=_trans_sweep_loop, daemon=True).start()
    # 转码缓存磁盘治理（超 2GB 按 mtime 清理最旧文件）
    threading.Thread(target=_cache_sweep_loop, daemon=True).start()

    _state.update(server=server, http_server=http_server, roots=roots, port=port,
                  http_port=http_port if http_server else None,
                  token=token, pinned=server.pinned)
    fw = _add_firewall_rule(port)
    fw_http = _add_firewall_rule(http_port) if http_server else None
    urls_http = _urls_http(port, token) if http_server else []
    hint = (
        "手机浏览器打开第一个 IPv6 URL 即可浏览/下载/上传；证书提示选择\"继续访问\"。"
        "手机若打不开 https 证书页面，请用 http:// 地址（免证书，仅限本机/局域网使用）。"
        "无权限目录会提示\"返回上级\"。用完后调用 drive_stop 关闭。"
        "若想浏览受系统保护目录，可将服务以管理员身份运行。"
    )
    if not fw.get("ok"):
        hint += " 注意：防火墙规则未添加（" + fw.get("error", "") + "），" + fw.get("fix", "")
    if fw_http is not None and not fw_http.get("ok"):
        hint += " 注意：HTTP 端口防火墙规则未添加（" + fw_http.get("error", "") + "），" + fw_http.get("fix", "")
    return {
        "running": True,
        "roots": roots,
        "port": port,
        "token": token,
        "archive_format": "rar" if _find_winrar() else "zip",
        "urls": _urls(port, token),
        "urls_http": urls_http,
        "http_port": http_port if http_server else None,
        "firewall_rule": fw,
        "hint": hint,
    }


def _stop():
    if _state["server"] is None:
        return {"stopped": True, "note": "当前没有运行中的服务"}
    port = _state["port"]
    _state["server"].shutdown()
    _state["server"].server_close()
    http_server = _state.get("http_server")
    if http_server is not None:
        try:
            http_server.shutdown()
            http_server.server_close()
        except Exception:  # noqa: BLE001
            pass
    _state.update(server=None, http_server=None, roots=[], port=None, http_port=None,
                  token=None, pinned=[])
    _remove_firewall_rule(port)
    _remove_firewall_rule(port + 1)
    return {"stopped": True, "port": port}


# ----------------------------------------------------------------------- MCP

INSTRUCTIONS = """\
drive-mcp 把电脑变成手机可访问的网盘（IPv6 直连 + HTTPS 加密）。

用法：
  * drive_start(root, port)：启动服务。root 缺省或传 "auto" 时浏览整机所有固定磁盘；
    也可传单个根目录（如 D:\\资料）。
  * drive_pin(paths)：把指定文件/目录置顶到网页显著位置，页面提供「下载」和
    「打包 .rar 下载」（无 WinRAR 自动用 .zip）按钮。
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
    "显示「下载」按钮，并提供「打包下载」按钮（.rar，无 WinRAR 时自动用 .zip）。",
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
        "archive_format": "rar" if _find_winrar() else "zip",
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
        "archive_format": "rar" if _find_winrar() else "zip",
        "urls": _urls(_state["port"], _state["token"]),
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


def _cli_serve(root, port, token=None):
    try:
        info = _start(root, port, token)
    except ToolError as exc:
        sys.stderr.write("启动失败: %s\n" % exc)
        sys.exit(1)
    for u in info["urls"]:
        print(u)
    for u in info.get("urls_http") or []:
        print(u + "  (HTTP 免证书明文，仅限可信局域网使用；手机打不开 https 证书页时用这个)")
    print("根目录: %s" % ", ".join(info["roots"]))
    print("打包格式: %s" % info["archive_format"])
    print("按 Ctrl+C 停止服务")
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
