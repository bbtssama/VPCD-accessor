// 由 server.py 拆分而来：电脑网盘主前端逻辑
"use strict";
const BASE = location.pathname.endsWith("/") ? location.pathname : location.pathname + "/";
const SHARE_MODE = /^\/s\//.test(location.pathname);
let roots = [];
let activeRoot = null;
let cur = null;
let pinned = [];
let FMT = "zip";
let shareRoot = null;
let shareName = "";
let shareExpires = null;
let shareVirtual = false;

const $ = (id) => document.getElementById(id);

function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2500); }
function fmtSize(n) {
  if (n === null || n === undefined) return "";
  if (n < 1024) return n + " B";
  if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
  if (n < 1073741824) return (n / 1048576).toFixed(1) + " MB";
  return (n / 1073741824).toFixed(2) + " GB";
}
function fmtTime(t) {
  if (!t) return "";
  const d = new Date(t * 1000);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" +
         String(d.getDate()).padStart(2, "0") + " " + String(d.getHours()).padStart(2, "0") + ":" +
         String(d.getMinutes()).padStart(2, "0");
}
// 估算字符串按 UTF-8 编码后的字节数（TextEncoder 不可用时退化为字符数）
function strBytes(s) {
  try { return new TextEncoder().encode(String(s == null ? "" : s)).length; }
  catch (e) { return String(s == null ? "" : s).length; }
}
function esc(s) { return s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function isPinned(p) { return pinned.some(x => x.path === p); }
function dlUrl(p) { return BASE + "dl?path=" + encodeURIComponent(p); }

// 按扩展名分类文件类型（与后端 preview 保持一致）
const VIDEO_EXT = ["mp4","webm","ogv","ogg","m4v","mov","mkv","avi","ts","flv"];
const MD_EXT = ["md","markdown"];
const TEXT_EXT = ["txt","log","json","js","ts","jsx","tsx","py","java","c","cpp","h","hpp","cs","go","rs","php","rb","sh","bat","ps1","html","htm","css","scss","xml","yaml","yml","toml","ini","conf","cfg","csv","sql","svg","env","gitignore"];
const ARCHIVE_EXT = ["zip","rar"];
function extOf(name) {
  const i = String(name).lastIndexOf(".");
  return i < 0 ? "" : String(name).slice(i + 1).toLowerCase();
}
function fileKind(name) {
  const e = extOf(name);
  if (VIDEO_EXT.indexOf(e) >= 0) return "video";
  if (MD_EXT.indexOf(e) >= 0) return "markdown";
  if (e === "csv") return "csv";
  if (e === "pdf") return "pdf";
  if (e === "lnk") return "lnk";
  if (TEXT_EXT.indexOf(e) >= 0) return "text";
  if (ARCHIVE_EXT.indexOf(e) >= 0) return "archive";
  return "other";
}
function showAlert(msg, actions) {
  const a = $("alert");
  a.innerHTML = '<span class="msg flex-grow-1">' + esc(msg) + "</span>";
  (actions || []).forEach(act => {
    const b = document.createElement("button");
    b.className = "btn btn-outline-danger btn-sm";
    b.textContent = act.label;
    b.onclick = act.fn;
    a.appendChild(b);
  });
  a.classList.remove("d-none");
  a.classList.add("d-flex");
}
function hideAlert() { const a = $("alert"); a.classList.add("d-none"); a.classList.remove("d-flex"); }

// ---------------- 通用弹窗（详情/视频/文本/解压共用，Bootstrap Modal） ----------------
const appModal = new bootstrap.Modal($("appModal"));
// 当前打开的弹窗状态（刷新后恢复用）；null 表示没有打开的弹窗
let modalState = null;
// 弹窗是否已 push 进浏览器历史（供手机返回键只关弹窗不退出页面）
let modalHistoryPushed = false;
// 当前异步预览弹窗的 AbortController（可取消加载；hidden.bs.modal 兜底中断）
let _activePreviewAbort = null;
function openModal(title, bodyNode, state) {
  $("appModalTitle").textContent = title;
  const b = $("appModalBody");
  // 打开新弹窗前先彻底停止旧弹窗里的音视频（防止后台继续播放/下载）
  b.querySelectorAll("video,audio").forEach(stopMedia);
  b.innerHTML = "";
  if (bodyNode) b.appendChild(bodyNode);
  modalState = state || null;
  saveDriveState();
  appModal.show();
  // 把弹窗加入浏览器历史：手机按返回键只会 pop 到这里（触发 popstate 关弹窗），不会退出页面
  try {
    if (!modalHistoryPushed) { history.pushState({ dlm: 1 }, ""); modalHistoryPushed = true; }
  } catch (e) { /* 极旧浏览器不支持 history API：静默降级为返回键直接退页面 */ }
}
function closeModal() { appModal.hide(); }
// 彻底停止媒体元素：暂停并清空 src + load()，终止网络加载
function stopMedia(el) {
  try { el.pause(); el.removeAttribute("src"); el.load(); } catch (e) { /* 忽略 */ }
}
// 弹窗真正关闭（含点遮罩/右上角 ×/手机返回键）时：中断预览请求 + 清媒体 + 清恢复状态 + 弹出历史条目
$("appModal").addEventListener("hidden.bs.modal", () => {
  if (_activePreviewAbort) { _activePreviewAbort.abort(); _activePreviewAbort = null; }
  $("appModalBody").querySelectorAll("video,audio").forEach(stopMedia);
  modalState = null;
  try { localStorage.removeItem("drive.modal"); } catch (e) { /* localStorage 禁用时忽略 */ }
  // 用户点 ❌ 关闭时把之前 push 的 history 条目退掉，保持历史栈一致；
  // 此时会再触发一次 popstate，但弹窗已关（isOpen=false），popstate handler 不做任何事。
  if (modalHistoryPushed) { modalHistoryPushed = false; try { history.back(); } catch (e) { /* 忽略 */ } }
});
// 手机返回键：浏览器已 pop 到 pushState 之前的条目（e.state 为 null），弹窗还开着 → 关闭它
let firstPop = true; // iOS Safari 等页面加载时会触发一次 popstate，需防抖
window.addEventListener("popstate", (e) => {
  if (firstPop) { firstPop = false; return; }
  const isOpen = $("appModal").classList.contains("show");
  if (isOpen && !(e.state && e.state.dlm)) {
    modalHistoryPushed = false;
    appModal.hide();
  }
});
function mkBtn(label, fn) {
  const b = document.createElement("button");
  b.className = "btn btn-primary";
  b.textContent = label;
  b.onclick = fn;
  return b;
}
function loadingNode() {
  const d = document.createElement("div");
  d.className = "text-center text-secondary py-4";
  d.textContent = "加载中…";
  return d;
}
// 可取消的加载态：转圈 + "加载中…" + 可选提示文字 + "取消"按钮
// 返回 { node, btn }；btn.onclick 由调用方绑定（一般触发 ac.abort()）
function loadingNodeCancel(extraText) {
  const d = document.createElement("div");
  d.className = "ld-box text-center text-secondary py-4";
  const row = document.createElement("div");
  row.className = "d-flex align-items-center";
  row.innerHTML = '<div class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></div><span>加载中…</span>';
  d.appendChild(row);
  if (extraText) {
    const t = document.createElement("div");
    t.className = "text-muted small";
    t.textContent = extraText;
    d.appendChild(t);
  }
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-outline-secondary btn-sm";
  btn.textContent = "取消";
  d.appendChild(btn);
  return { node: d, btn };
}
// 文本分片渲染：把大文本按 chunkLen 逐块 append 到目标元素，块间 setTimeout(0) 让出主线程，
// 期间显示"渲染中…(x%)"；stopFlag() 返回 true（用户取消/弹窗关闭）时立即停止并移除提示。
function fillTextChunked(target, text, chunkLen, stopFlag) {
  chunkLen = chunkLen || 32768;
  let i = 0;
  const s = String(text);
  const total = s.length;
  const tip = document.createElement("div");
  tip.id = "renderTip";
  tip.className = "render-tip";
  const parent = target.parentNode;
  if (parent) parent.insertBefore(tip, target);
  const done = () => { tip.remove(); };
  const step = () => {
    if (stopFlag()) { done(); return; }
    const end = Math.min(i + chunkLen, total);
    target.appendChild(document.createTextNode(s.slice(i, end)));
    i = end;
    if (i < total) {
      tip.textContent = "渲染中…(" + Math.round(i / total * 100) + "%)";
      setTimeout(step, 0);
    } else {
      done();
    }
  };
  step();
}

// ---------------- 功能 1：文件/目录详情 ----------------
async function showDetail(path, name) {
  const body = document.createElement("div");
  const ld = loadingNodeCancel();
  body.appendChild(ld.node);
  openModal(name, body, { type: "detail", path, name });
  const ac = new AbortController();
  if (_activePreviewAbort) _activePreviewAbort.abort();
  _activePreviewAbort = ac;
  ld.btn.onclick = () => ac.abort();
  let j;
  try {
    j = await api("api/stat?path=" + encodeURIComponent(path), { signal: ac.signal });
  } catch (e) {
    body.innerHTML = "";
    body.innerHTML = (e && e.name === "AbortError")
      ? '<p class="muted small">已取消加载</p>'
      : '<p class="muted">加载失败: ' + esc(e && e.message) + "</p>";
    return;
  }
  if (j.error) { body.innerHTML = '<p class="muted">' + esc(j.error) + "</p>"; return; }
  body.innerHTML = "";
  const rows = [
    ["名称", j.name, { icon: j.is_dir ? BASE + "static/icons/folder.svg" : iconUrl(j.name) }],
    ["路径", j.path],
    ["类型", j.is_dir ? "目录" : "文件"],
    ["大小", j.is_dir ? "—" : fmtSize(j.size)],
    ["修改时间", fmtTime(j.mtime)],
    ["创建时间", fmtTime(j.ctime)],
    ["扩展名", j.extension || "—"],
    ["系统占用", j.locked ? "是" : "否"],
  ];
  const tbl = document.createElement("table");
  tbl.className = "detail-tbl";
  rows.forEach(r => {
    const tr = document.createElement("tr");
    let val = "<td class='v'>";
    if (r[2] && r[2].icon) {
      val += "<img src='" + r[2].icon + "' width='16' height='16' alt='' style='vertical-align:-3px' class='me-1'>";
    }
    tr.innerHTML = "<td class='k'>" + esc(r[0]) + "</td>" + val + esc(r[1]) + "</td>";
    tbl.appendChild(tr);
  });
  body.appendChild(tbl);
  // ---- 详细信息区块（视频等媒体文件的 Windows 属性式元数据；无 details 则不显示） ----
  if (j.details) {
    const d = j.details;
    const secTitle = document.createElement("div");
    secTitle.textContent = "详细信息";
    secTitle.className = "detail-sec";
    body.appendChild(secTitle);
    const pairs = [
      ["标题", d.title],
      ["作者", d.artist],
      ["专辑", d.album],
      ["类型", d.genre],
      ["日期", d.date],
      ["备注/评论", d.comment],
      ["时长", d.duration_text],
      ["分辨率", d.resolution],
      ["视频编码", d.video_codec],
      ["音频编码", d.audio_codec],
      ["采样率", d.sample_rate],
      ["声道", d.channels],
      ["容器码率", d.container_bitrate],
      ["创建时间", d.created_time],
      ["生成工具", d.encoder],
    ];
    const t2 = document.createElement("table");
    t2.className = "detail-tbl";
    pairs.forEach(p => {
      if (p[1] === undefined || p[1] === null || p[1] === "") return;
      let val = String(p[1]);
      let tip = "";
      if (p[0] === "备注/评论" && val.length > 200) {  // comment 可能很长：截断显示 + title 悬停完整内容
        val = val.slice(0, 200) + "…";
        tip = " title='" + esc(String(p[1])) + "'";
      }
      const tr = document.createElement("tr");
      tr.innerHTML = "<td class='k'>" + esc(p[0]) + "</td><td class='v'" + tip + ">" + esc(val) + "</td>";
      t2.appendChild(tr);
    });
    if (t2.children.length) body.appendChild(t2);
  }
  const btns = document.createElement("div");
  btns.className = "d-flex flex-wrap gap-2 mt-3";
  // 预览按钮与文件列表分流保持一致（pdf/csv/lnk 也支持在线预览）
  const fk = fileKind(j.name);
  if (fk === "video") btns.appendChild(mkBtn("▶ 在线预览", () => showVideo(j.path, j.name)));
  else if (fk === "markdown" || fk === "text") btns.appendChild(mkBtn("📄 在线查看", () => showText(j.path, j.name)));
  else if (fk === "archive") btns.appendChild(mkBtn("📦 解压预览", () => showUnpack(j.path, j.name)));
  else if (fk === "pdf") btns.appendChild(mkBtn("📄 PDF 预览", () => showPdf(j.path, j.name)));
  else if (fk === "csv") btns.appendChild(mkBtn("📊 表格预览", () => showCsv(j.path, j.name)));
  else if (fk === "lnk") btns.appendChild(mkBtn("🔗 快捷方式跳转", () => showLnk(j.path, j.name)));
  const shareBtn = document.createElement("button");
  shareBtn.className = "btn btn-outline-primary";
  shareBtn.textContent = SHARE_MODE ? "🔗 二次分享" : "🔗 再分享";
  shareBtn.onclick = () => showShareDialog(j.path, j.name, SHARE_MODE ? { sub: true } : undefined);
  btns.appendChild(shareBtn);
  if (!j.locked && !j.is_dir) btns.appendChild(mkBtn("⬇ 下载", () => { location.href = dlUrl(j.path); }));
  if (btns.children.length) body.appendChild(btns);
}

// ---------------- 功能 2：视频在线播放 ----------------
// 高级播放器：画质选择 + 免证书(MSE)模式 + 缓存下载 + 字幕 + 拖动预览。
// 原生模式：video.src 直连流（原画 api/stream 或转码档 api/transdl）。
// MSE 模式：MediaSource + SourceBuffer 从 api/trans 按 offset 顺序拉 fMP4 分片追加，
//           浏览器对 MSE 喂入数据的格式嗅探不受"媒体子资源证书限制"，免装证书即可播放。
function showVideo(path, name) {
  const body = document.createElement("div");
  // ---- 控制条：画质 / 免证书 / 缓存下载 / 字幕 ----
  const ctrl = document.createElement("div");
  ctrl.className = "d-flex flex-wrap align-items-center gap-2 mb-2 small";
  const qSel = document.createElement("select");
  qSel.className = "form-select form-select-sm flex-shrink-0";
  [["original", "原画"], ["high", "高清"], ["medium", "标清"], ["low", "低清"]].forEach(item => {
    const o = document.createElement("option");
    o.value = item[0]; o.textContent = item[1];
    qSel.appendChild(o);
  });
  qSel.value = "original";
  const wrapSel = document.createElement("span");
  wrapSel.className = "d-flex align-items-center gap-1 flex-shrink-0";
  wrapSel.appendChild(document.createTextNode("画质"));
  wrapSel.appendChild(qSel);
  const mseChk = mkCheck("免证书(MSE)", false);
  const cacheChk = mkCheck("缓存下载", false);
  const subChk = mkCheck("字幕", false);
  const asrChk = mkCheck("识别", false);
  ctrl.appendChild(wrapSel);
  ctrl.appendChild(mseChk.el);
  ctrl.appendChild(cacheChk.el);
  ctrl.appendChild(subChk.el);
  ctrl.appendChild(asrChk.el);
  body.appendChild(ctrl);
  // ---- 视频容器（无 .video-play 覆盖按钮，播放/暂停交给原生 controls） ----
  const wrap = document.createElement("div");
  wrap.className = "video-wrap";
  const v = document.createElement("video");
  v.controls = true;
  v.playsinline = true;
  v.preload = "metadata";
  v.crossOrigin = "anonymous";
  wrap.appendChild(v);
  body.appendChild(wrap);
  // ---- 进度条预览（缩略图条 + 单帧） ----
  const prev = document.createElement("div");
  prev.className = "video-preview";
  prev.style.display = "none";
  const prevImg = document.createElement("img");
  prevImg.alt = "";
  prev.appendChild(prevImg);
  body.appendChild(prev);
  // ---- 字幕 <track>（原生 MSE 时不支持 track，改用自定义 overlay） ----
  const subOverlay = document.createElement("div");
  subOverlay.className = "video-sub";
  body.appendChild(subOverlay);
  // ---- 播放失败提示 ----
  const errTip = document.createElement("p");
  errTip.className = "video-err";
  body.appendChild(errTip);
  // ---- 转码等待提示（原生模式转码档 409 轮询期间显示） ----
  const transTip = document.createElement("div");
  transTip.className = "video-tip";
  transTip.style.display = "none";
  body.appendChild(transTip);
  // ---- 视频详情面板（来源：视频文件 tag；识别到才展示，没有则低调回退） ----
  const metaBox = document.createElement("div");
  metaBox.className = "video-meta mt-3";
  body.appendChild(metaBox);
  function renderMeta(m) {
    metaBox.innerHTML = "";
    const title = (m && m.title) || name.replace(/\.[^.]+$/, "");
    const h = document.createElement("h5");
    h.className = "fw-bold mb-1 vtitle";
    h.textContent = title;
    if (title.length > 40) h.title = title;
    metaBox.appendChild(h);
    if (!m) {
      const p = document.createElement("p");
      p.className = "small text-muted mb-0";
      p.textContent = "该视频未包含详情信息";
      metaBox.appendChild(p);
      return;
    }
    // 作者 + 类型 + 统计行（有才渲染）
    const row = document.createElement("div");
    row.className = "d-flex align-items-center flex-wrap gap-2";
    if (m.author) {
      const av = document.createElement("span");
      av.className = "vavatar d-inline-flex align-items-center justify-content-center rounded-circle bg-primary text-white";
      av.textContent = m.author.charAt(0) || "U";
      row.appendChild(av);
      const nm = document.createElement("span");
      nm.className = "fw-semibold small vname";
      nm.textContent = m.author;
      nm.title = m.author;
      row.appendChild(nm);
    }
    if (m.type) {
      const b = document.createElement("span");
      b.className = "badge ms-1 " + (m.type === "裏番" ? "text-bg-warning" : "text-bg-secondary");
      b.textContent = m.type;
      row.appendChild(b);
    }
    const stats = [];
    if (m.views) stats.push("👁 " + m.views);
    if (m.likes) stats.push("👍 " + m.likes);
    if (m.upload) stats.push("📅 " + m.upload);
    if (m.duration) stats.push("⏱ " + m.duration);
    if (m.resolution) stats.push("🖥 " + m.resolution);
    if (stats.length) {
      const sp = document.createElement("span");
      sp.className = "text-muted small ms-auto";
      sp.textContent = stats.join(" · ");
      row.appendChild(sp);
    }
    if (row.children.length) metaBox.appendChild(row);
    // 标签行（B 站风格胶囊徽章）
    if (m.tags && m.tags.length) {
      const tr = document.createElement("div");
      tr.className = "d-flex flex-wrap align-items-center gap-1 mt-2";
      const lbl = document.createElement("span");
      lbl.className = "text-muted small";
      lbl.textContent = "标签：";
      tr.appendChild(lbl);
      m.tags.forEach(t => {
        const b = document.createElement("span");
        b.className = "badge rounded-pill text-bg-light border vtag";
        b.textContent = t;
        tr.appendChild(b);
      });
      metaBox.appendChild(tr);
    }
    // 备注/简介卡片（notes 为主，extra 用户级未知键并入一行；超 3 行折叠）
    const lines = [];
    (m.notes || []).forEach(n => lines.push(n));
    (m.extra || []).forEach(e => lines.push(e.k + " " + e.v));
    if (lines.length) {
      const card = document.createElement("div");
      card.className = "card border-0 bg-body-tertiary rounded mt-2";
      const cb = document.createElement("div");
      cb.className = "card-body py-2 small vnotes";
      lines.forEach(n => {
        const d = document.createElement("div");
        d.textContent = n;
        cb.appendChild(d);
      });
      card.appendChild(cb);
      if (lines.length > 3 || lines.join("\n").length > 120) {
        cb.classList.add("vnotes-fold");
        const tg = document.createElement("button");
        tg.type = "button";
        tg.className = "btn btn-link btn-sm p-0 text-primary vtoggle";
        tg.textContent = "▾ 展开";
        let open = false;
        tg.onclick = () => {
          open = !open;
          cb.classList.toggle("vnotes-fold", !open);
          tg.textContent = open ? "▴ 收起" : "▾ 展开";
        };
        card.appendChild(tg);
      }
      metaBox.appendChild(card);
    }
    // 技术信息小徽章行（编码器/码率/声道等文件固有信息，低调展示；可整体省略）
    if (m.tech && m.tech.length) {
      const tr = document.createElement("div");
      tr.className = "d-flex flex-wrap align-items-center gap-1 mt-2";
      m.tech.forEach(t => {
        const b = document.createElement("span");
        b.className = "badge text-bg-light border vtech";
        b.textContent = t.k + " " + t.v;
        b.title = t.k + " " + t.v;
        tr.appendChild(b);
      });
      metaBox.appendChild(tr);
    }
  }
  fetch(BASE + "api/vmeta?path=" + encodeURIComponent(path))
    .then(r => r.json())
    .then(j => renderMeta(j && j.ok ? (j.meta || null) : null))
    .catch(() => renderMeta(null));
  // ---- 底部按钮 ----
  const btns = document.createElement("div");
  btns.className = "d-flex flex-wrap gap-2 mt-3";
  btns.appendChild(mkBtn("用其他播放器打开", () => {
    window.open(BASE + "api/stream?path=" + encodeURIComponent(path));
  }));
  btns.appendChild(mkBtn("⬇ 下载当前画质", () => {
    const q = qSel.value;
    const url = q === "original"
      ? BASE + "api/stream?path=" + encodeURIComponent(path)
      : BASE + "api/transdl?path=" + encodeURIComponent(path) + "&q=" + q;
    location.href = url;
  }));
  body.appendChild(btns);
  // ---- 安装证书链接（非分享模式） ----
  if (!SHARE_MODE) {
    const certLink = document.createElement("div");
    certLink.className = "mt-2 small";
    const ca = document.createElement("a");
    ca.href = BASE + "api/certp12";
    ca.textContent = "📥 安装证书（小米等 Android 用，下载后输入密码 1234）";
    ca.className = "text-primary";
    certLink.appendChild(ca);
    const ca2 = document.createElement("div");
    const ca2a = document.createElement("a");
    ca2a.href = BASE + "api/cert";
    ca2a.textContent = "备用：旧版 .crt 证书";
    ca2a.className = "text-secondary";
    ca2.appendChild(ca2a);
    certLink.appendChild(ca2);
    body.appendChild(certLink);
  }
  openModal(name, body, { path, name, type: "video" });
  // ---- 状态 ----
  let mse = null;          // { ms, sb, fetching, offset, buf, start, wantAppend, gen }
  let subVtt = null;       // { url, src }
  let asrVtt = null;
  let asrLang = "ja";
  let subMode = "none";    // none | track | overlay
  let strip = null;        // { url, n, dur } 缩略图条（X-Strip-N / X-Strip-Duration 校准）
  let previewDur = null;   // 源时长（vinfo 提前拿；loadedmetadata 补更）
  let lastFrameT = -1;     // 单帧预览防抖时间戳（80ms 内复用当前帧）
  let mimeCache = {};      // key=path|q → MSE mime（动态 codec，修复高清/标清/低清播不了）
  let transPoll = null;    // { gen, timer, q } 原生转码档 409 轮询状态
  let mseBuildSeq = 0;     // buildMse 请求序号：并发时只保留最后一次
  let pendingAsrLoad = false;
  let lastMsUrl = null;    // 当前 MSE 的 blob URL，切换/关闭时 revoke
  let mseFallbackDone = false;  // 原画→高清降级已执行标记（仅一级，避免递归）

  // ---- 语言切换（识别用） ----
  const langSel = document.createElement("select");
  langSel.className = "form-select form-select-sm flex-shrink-0 d-none";
  [["ja", "日文"], ["en", "英文"], ["zh", "中文"]].forEach(it => {
    const o = document.createElement("option");
    o.value = it[0]; o.textContent = it[1];
    langSel.appendChild(o);
  });
  asrChk.el.parentNode.insertBefore(langSel, asrChk.el.nextSibling);
  langSel.onchange = () => { asrLang = langSel.value; if (asrChk.input.checked) loadAsr(); };
  asrChk.input.onchange = () => {
    if (asrChk.input.checked) { langSel.classList.remove("d-none"); loadAsr(); }
    else { langSel.classList.add("d-none"); clearSubOverlay(); }
  };

  function mkCheck(label, def) {
    const el = document.createElement("label");
    el.className = "form-check form-check-inline flex-shrink-0 mb-0 small";
    const inp = document.createElement("input");
    inp.type = "checkbox";
    inp.className = "form-check-input";
    inp.checked = def;
    const sp = document.createElement("span");
    sp.className = "form-check-label";
    sp.textContent = label;
    el.appendChild(inp); el.appendChild(sp);
    return { el, input: inp };
  }

  function stopStream() {
    stopTransPoll();
    if (mse) {
      mse.gen++;
      try { mse.ms.endOfStream(); } catch (e) { /* 忽略 */ }
      try { mse.ms.removeAttribute("src"); } catch (e) { /* 忽略 */ }
      try { if (mse.sb) mse.ms.removeSourceBuffer(mse.sb); } catch (e) { /* 忽略 */ }
      mse.ms = null; mse.sb = null;
      mse = null;
    }
    if (lastMsUrl) { try { URL.revokeObjectURL(lastMsUrl); } catch (e) { /* 忽略 */ } lastMsUrl = null; }
    try { v.removeAttribute("src"); } catch (e) { /* 忽略 */ }
    try { v.load(); } catch (e) { /* 忽略 */ }
  }

  function showErr(msg) { errTip.style.display = "block"; errTip.textContent = msg; }

  function playNative() {
    stopTransPoll();
    subMode = "none";
    clearSubOverlay();
    if (subChk.input.checked && subVtt) { subMode = "track"; }
    if (subVtt) v.setAttribute("crossorigin", "anonymous");
    else v.removeAttribute("crossorigin");
    const q = qSel.value;
    if (q === "original") {
      // 原画：直连源流（缓存下载开关仅在此档生效）
      const url = BASE + "api/stream?path=" + encodeURIComponent(path) +
            (cacheChk.input.checked ? "&cache=1" : "");
      v.src = url;
      if (subMode === "track" && subVtt) attachTrack(subVtt.url);
      v.play().catch(() => { /* 用户手势后静默 */ });
      return;
    }
    // 转码档：transdl 未转码完会返回 409。先查 transstatus，就绪则直接播；
    // 未就绪则打一次 transdl 触发后端开始转码（会 409 + 进度），随后每 2s 轮询（上限 120s）。
    const poll = { gen: 1, q };
    transPoll = poll;
    fetch(BASE + "api/transstatus?path=" + encodeURIComponent(path) + "&q=" + q)
      .then(r => r.json().catch(() => null))
      .then(j => {
        if (transPoll !== poll || !v.isConnected) return;
        if (j && j.ready) startTransPlay(q);
        else {
          showTransTip(j && typeof j.progress === "number" ? j.progress : null);
          kickTranscode(poll);
        }
      })
      .catch(() => {
        // transstatus 不可用（后端旧版）：直接打 transdl 触发转码（容错路径）
        if (transPoll === poll && v.isConnected) kickTranscode(poll);
      });
  }
  // 打一次 transdl 触发后端开始持久化转码：未就绪返回 409+progress，就绪（200）则直接播
  function kickTranscode(poll) {
    if (transPoll !== poll || !v.isConnected) return;
    fetch(BASE + "api/transdl?path=" + encodeURIComponent(path) + "&q=" + poll.q)
      .then(r => {
        if (transPoll !== poll || !v.isConnected) return;
        if (r.ok) { startTransPlay(poll.q); return; }
        return r.json().catch(() => null).then(j => {
          if (transPoll !== poll) return;
          scheduleTransPoll(poll, j && typeof j.progress === "number" ? j.progress : null);
        });
      })
      .catch(() => { if (transPoll === poll) scheduleTransPoll(poll, null); });
  }
  // 转码就绪后真正播放
  function startTransPlay(q) {
    stopTransPoll();
    v.src = BASE + "api/transdl?path=" + encodeURIComponent(path) + "&q=" + q;
    if (subMode === "track" && subVtt) attachTrack(subVtt.url);
    v.play().catch(() => { /* 用户手势后静默 */ });
  }
  // 每 2s 轮询一次转码状态，直到 ready 或超时（120s）；关闭/切画质后自动停止
  function scheduleTransPoll(poll, progress) {
    if (transPoll !== poll) return;
    showTransTip(progress);
    const startedAt = Date.now();
    const tick = () => {
      if (transPoll !== poll || !v.isConnected) { stopTransPoll(); return; }
      if (Date.now() - startedAt > 120000) {
        stopTransPoll();
        showErr("转码超时，请稍后重试");
        return;
      }
      fetch(BASE + "api/transstatus?path=" + encodeURIComponent(path) + "&q=" + poll.q)
        .then(r => r.json().catch(() => null))
        .then(j => {
          if (transPoll !== poll || !v.isConnected) { stopTransPoll(); return; }
          if (j && j.ready) { startTransPlay(poll.q); return; }
          showTransTip(j && typeof j.progress === "number" ? j.progress : null);
          if (transPoll === poll) transPoll.timer = setTimeout(tick, 2000);
        })
        .catch(() => { if (transPoll === poll) transPoll.timer = setTimeout(tick, 2000); });
    };
    transPoll.timer = setTimeout(tick, 2000);
  }
  function stopTransPoll() {
    if (transPoll) { transPoll.gen++; if (transPoll.timer) clearTimeout(transPoll.timer); transPoll = null; }
    transTip.style.display = "none";
  }
  function showTransTip(progress) {
    transTip.style.display = "block";
    transTip.textContent = (typeof progress === "number" && progress > 0)
      ? "转码中…（已产出 " + fmtSize(progress) + "）"
      : "转码中…";
  }

  function attachTrack(url) {
    removeTrack();
    const tr = document.createElement("track");
    tr.kind = "subtitles";
    tr.label = "字幕";
    tr.srclang = "zh";
    tr.default = true;
    tr.src = url;
    v.appendChild(tr);
  }
  function removeTrack() {
    v.querySelectorAll("track").forEach(t => t.remove());
  }
  function clearSubOverlay() { subOverlay.textContent = ""; subOverlay.style.display = "none"; v.ontimeupdate = null; }

  function loadSubtitle() {
    fetch(BASE + "api/subtitle?path=" + encodeURIComponent(path))
      .then(r => {
        if (!r.ok) { toast("没有可用字幕"); return null; }
        return r.text();
      })
      .then(txt => {
        if (!txt) return;
        const url = URL.createObjectURL(new Blob([txt], { type: "text/vtt" }));
        subVtt = { url, src: txt };
        if (subChk.input.checked) {
          if (mse) { subMode = "overlay"; setupSubOverlay(); }
          else { subMode = "track"; removeTrack(); attachTrack(url); }
        }
      })
      .catch(() => { toast("字幕加载失败"); });
  }

  function setupSubOverlay() {
    clearSubOverlay();
    subOverlay.style.display = "block";
    const cues = parseVtt(subVtt.src);
    v.ontimeupdate = () => {
      const t = v.currentTime || 0;
      let text = "";
      for (const c of cues) {
        if (t >= c.start && t <= c.end) { text = c.text; break; }
      }
      subOverlay.textContent = text;
    };
  }

  function parseVtt(src) {
    const cues = [];
    const lines = String(src || "").split(/\r?\n/);
    let l = 0;
    while (l < lines.length) {
      const m = lines[l].match(/([\d:.]+)\s*-->\s*([\d:.]+)/);
      if (m) {
        const start = timeOf(m[1]), end = timeOf(m[2]);
        const txt = [];
        l++;
        while (l < lines.length && lines[l] && !/(-->)|\d+:\d+/.test(lines[l])) {
          if (!/^WEBVTT/.test(lines[l])) txt.push(lines[l]);
          l++;
        }
        cues.push({ start, end, text: txt.join("\n").trim() });
        continue;
      }
      l++;
    }
    return cues;
  }
  function timeOf(s) {
    const p = s.trim().split(":");
    let sec = 0;
    for (const x of p) sec = sec * 60 + parseFloat(x);
    return sec;
  }

  function loadAsr() {
    pendingAsrLoad = true;
    fetch(BASE + "api/asr?path=" + encodeURIComponent(path) + "&lang=" + asrLang)
      .then(async r => {
        if (r.status === 501) { pendingAsrLoad = false; toast("未内置识别引擎（faster_whisper），请安装后使用"); return; }
        if (!r.ok) { pendingAsrLoad = false; toast("识别失败或进行中"); return; }
        return r.text();
      })
      .then(txt => {
        if (!txt) { pendingAsrLoad = false; return; }
        pendingAsrLoad = false;
        asrVtt = { url: URL.createObjectURL(new Blob([txt], { type: "text/vtt" })), src: txt };
        if (asrChk.input.checked) {
          if (mse) { subMode = "overlay"; setupSubOverlay(); }
          else { subMode = "track"; removeTrack(); attachTrack(asrVtt.url); }
        }
      })
      .catch(() => { pendingAsrLoad = false; toast("识别请求失败"); });
  }

  // ---- MSE 免证书模式 ----
  // 动态获取 MSE MIME：q=original 按源实际 codec，q=high/medium/low 固定 avc1.640033（High profile）；
  // vinfo 探测失败兜底同 High profile，避免硬编码 Baseline 导致高清/标清/低清播不了。
  async function getMime(q) {
    const key = path + "|" + q;
    if (mimeCache[key]) return mimeCache[key];
    const fallback = 'video/mp4; codecs="avc1.640033, mp4a.40.2"';
    try {
      const r = await fetch(BASE + "api/vinfo?path=" + encodeURIComponent(path) + "&q=" + q);
      if (r.ok) {
        const j = await r.json();
        if (j && typeof j.mseMime === "string" && j.mseMime) {
          mimeCache[key] = j.mseMime;
          return j.mseMime;
        }
      }
    } catch (e) { /* vinfo 探测失败：用兜底 mime */ }
    mimeCache[key] = fallback;
    return fallback;
  }
  async function startMse() {
    stopTransPoll();
    if (mse) { stopStream(); }
    if (!window.MediaSource || !window.MediaSource.isTypeSupported) {
      showErr("该浏览器不支持 MediaSource，无法启用免证书模式");
      return;
    }
    const q = qSel.value;                 // await 期间画质可能变化，用当时的 q
    const mime = await getMime(q);
    if (qSel.value !== q || !mseChk.input.checked || !v.isConnected) return;  // 状态已变则放弃
    if (!MediaSource.isTypeSupported(mime)) {
      // 原画档 MIME 不被支持（典型：HEVC/hvc1、或音频非 aac 导致奇异 MIME）时，
      // 自动降级到高清重播；仅 original→high 一级，high 仍不支持才报错。
      if (q === "original" && !mseFallbackDone) {
        mseFallbackDone = true;
        toast("原画需转码播放，已切换高清");
        qSel.value = "high";
        startMse().catch(e => showErr("MSE 启动失败: " + (e && e.message)));
        return;
      }
      showErr("浏览器不支持该格式的 fMP4 MSE 播放（" + mime + "）");
      return;
    }
    mseFallbackDone = false;
    const ms = new MediaSource();
    mse = { ms, sb: null, fetching: false, offset: 0, buf: new Uint8Array(0), start: 0, wantAppend: false, gen: (mse ? mse.gen : 0) + 1 };
    if (lastMsUrl) { try { URL.revokeObjectURL(lastMsUrl); } catch (e) { /* 忽略 */ } }
    lastMsUrl = URL.createObjectURL(ms);
    v.src = lastMsUrl;
    const myGen = mse.gen;
    ms.addEventListener("sourceopen", () => {
      if (!mse || mse.gen !== myGen) return;
      try {
        const sb = ms.addSourceBuffer(mime);
        mse.sb = sb;
        sb.mode = "segments";
        sb.addEventListener("updateend", () => {
          if (mse && mse.gen === myGen && mse.wantAppend) {
            mse.wantAppend = false;
            pump();
          }
        });
        pump();
      } catch (e) {
        showErr("MSE 初始化失败: " + e.message);
      }
    });
    // 字幕：MSE 模式用自定义 overlay
    if (subChk.input.checked && subVtt) { subMode = "overlay"; setupSubOverlay(); }
  }

  function seekMse(t) {
    if (!mse) return;
    mse.start = t;
    mse.offset = 0;
    mse.buf = new Uint8Array(0);
    mse.wantAppend = false;
    if (mse.sb) {
      try { mse.sb.abort(); } catch (e) { /* 忽略 */ }
      try {
        v.currentTime = 0;
        try { mse.ms.endOfStream(); } catch (e2) { /* 忽略 */ }
        mse.ms.removeSourceBuffer(mse.sb);
      } catch (e) { /* 忽略 */ }
    }
    buildMse(t).catch(() => { /* 异步内部已兜底 */ });
  }

  async function buildMse(t) {
    if (!mse) return;
    const mySeq = ++mseBuildSeq;          // 连续 seek/切画质只保留最后一次
    const q = qSel.value;
    const mime = await getMime(q);
    if (!mse || qSel.value !== q || mySeq !== mseBuildSeq || !v.isConnected) return;  // 状态已变则放弃
    if (!MediaSource.isTypeSupported(mime)) {
      // 与 startMse 一致：原画档不支持时降级高清重播（仅一级，避免递归）
      if (q === "original" && !mseFallbackDone) {
        mseFallbackDone = true;
        toast("原画需转码播放，已切换高清");
        qSel.value = "high";
        buildMse(v.currentTime || 0).catch(() => { /* 异步内部已兜底 */ });
        return;
      }
      showErr("浏览器不支持该格式的 fMP4 MSE 播放（" + mime + "）");
      return;
    }
    mseFallbackDone = false;
    mse.gen++;
    try { mse.ms.removeAttribute("src"); } catch (e) { /* 忽略 */ }
    destroySb();
    try { mse.ms.endOfStream(); } catch (e) { /* 忽略 */ }
    mse.start = t;
    mse.offset = 0;
    mse.buf = new Uint8Array(0);
    mse.wantAppend = false;
    const ms = new MediaSource();
    mse.ms = ms;
    if (lastMsUrl) { try { URL.revokeObjectURL(lastMsUrl); } catch (e) { /* 忽略 */ } }
    lastMsUrl = URL.createObjectURL(ms);
    v.src = lastMsUrl;
    const myGen = mse.gen;
    ms.addEventListener("sourceopen", () => {
      if (!mse || mse.gen !== myGen) return;
      try {
        const sb = ms.addSourceBuffer(mime);
        mse.sb = sb;
        sb.mode = "segments";
        sb.addEventListener("updateend", () => {
          if (mse && mse.gen === myGen && mse.wantAppend) { mse.wantAppend = false; pump(); }
        });
        pump();
      } catch (e) { /* 忽略 */ }
    });
    if (subChk.input.checked && subVtt) { subMode = "overlay"; setupSubOverlay(); }
  }
  function destroySb() {
    if (mse && mse.sb) {
      try { mse.ms.removeSourceBuffer(mse.sb); } catch (e) { /* 忽略 */ }
    }
    mse.sb = null;
  }

  function pump() {
    if (!mse || !mse.sb || mse.fetching) return;
    if (mse.sb.updating) { mse.wantAppend = true; return; }
    mse.fetching = true;
    const myGen = mse.gen;
    const q = qSel.value;
    const url = BASE + "api/trans?path=" + encodeURIComponent(path) +
                "&q=" + q + "&offset=" + mse.offset + "&need=524288&start=" + mse.start;
    fetch(url)
      .then(async res => {
        const done = res.headers.get("X-Trans-Finished") === "1";
        const newOff = parseInt(res.headers.get("X-Trans-Offset") || "0", 10);
        const blob = await res.blob();
        if (!mse || mse.gen !== myGen) return;    // 旧代响应当丢弃（seek/切画质/关闭后）
        mse.fetching = false;
        if (!mse || !mse.sb) return;
        if (blob.size > 0) {
          const arr = new Uint8Array(await blob.arrayBuffer());
          if (!mse || mse.gen !== myGen) return;
          mse.offset = newOff;
          if (mse.sb.updating) { mse.buf = arr; mse.wantAppend = true; return; }
          try {
            mse.sb.appendBuffer(arr);
            if (done) { try { mse.ms.endOfStream(); } catch (e) { /* 忽略 */ } }
          } catch (e) {
            if (e.name === "QuotaExceededError") { trimAndAppend(arr); return; }
            // 原画档 append 失败：多为 vinfo 探测失败的兜底 MIME（avc1.640033）与实际流
            // （如 baseline avc1.42E01F）不匹配 → 降级高清重播；转码档 640033 必然匹配
            if (q === "original" && !mseFallbackDone && mse.gen === myGen) {
              mseFallbackDone = true;
              toast("原画流与浏览器不兼容，已切换高清播放");
              qSel.value = "high";
              buildMse(v.currentTime || 0).catch(() => { /* 异步内部已兜底 */ });
              return;
            }
            showErr("MSE 数据追加失败: " + (e && e.message));
          }
        } else {
          if (!mse || mse.gen !== myGen) return;
          if (done) { try { mse.ms.endOfStream(); } catch (e) { /* 忽略 */ } return; }
          setTimeout(() => { if (mse) pump(); }, 200);
        }
      })
      .catch(() => { if (mse) { mse.fetching = false; setTimeout(() => pump(), 500); } });
  }

  function trimAndAppend(arr) {
    if (!mse || !mse.sb) return;
    try {
      const toRemove = mse.sb.buffered.length ? mse.sb.buffered.start(0) : 0;
      if (mse.sb.buffered.length && mse.sb.buffered.start(0) > 0) {
        mse.sb.remove(0, Math.max(0, v.currentTime - 30));
      }
    } catch (e) { /* 忽略 */ }
    try { mse.sb.appendBuffer(arr); } catch (e2) { /* 忽略 */ }
  }

  // ---- 画质 / 免证书 / 缓存下载切换 ----
  qSel.onchange = () => { if (mse) { buildMse(v.currentTime || 0).catch(() => {}); } else playNative(); };
  mseChk.input.onchange = () => {
    if (mseChk.input.checked) {
      // MSE（免证书）模式与缓存下载互斥：缓存只对原画原生流生效
      if (cacheChk.input.checked) { cacheChk.input.checked = false; cacheChk.el.classList.add("text-muted"); }
      startMse().catch(e => showErr("MSE 启动失败: " + (e && e.message)));
    } else { stopStream(); playNative(); }
  };
  cacheChk.input.onchange = () => {
    if (mse) { cacheChk.input.checked = false; toast("缓存下载仅在免证书关闭的原画播放时生效"); return; }
    if (qSel.value !== "original") { cacheChk.input.checked = false; toast("缓存下载仅对原画档生效"); return; }
    playNative();
  };
  subChk.input.onchange = () => {
    if (subChk.input.checked) {
      if (subVtt) { if (mse) { subMode = "overlay"; setupSubOverlay(); } else { subMode = "track"; attachTrack(subVtt.url); } }
      else loadSubtitle();
    } else { clearSubOverlay(); removeTrack(); subMode = "none"; }
  };
  // MSE 模式：拖动进度条到某点 → 从该点重新拉取（seek 重建连续流）
  v.addEventListener("seeked", () => {
    if (mse && mse.sb) {
      const t = v.currentTime || 0;
      if (Math.abs(t - mse.start) > 2) seekMse(t);
    }
  });

  // ---- 进度条预览（桌面 + 移动端 + 视频未加载也能预览） ----
  // 提前拿源时长：vinfo 成功则 previewDur 可用（不依赖 loadedmetadata）
  function loadVinfo() {
    fetch(BASE + "api/vinfo?path=" + encodeURIComponent(path) + "&q=" + qSel.value)
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (!j) return;
        const d = parseFloat(j.duration);
        if (Number.isFinite(d) && d > 0) previewDur = d;
      })
      .catch(() => { /* vinfo 失败：预览等 loadedmetadata 后仍可用 */ });
  }
  // 缩略图条：记录 url/n/dur（X-Strip-N / X-Strip-Duration），失败则 strip=null 回退单帧
  function loadStrip() {
    fetch(BASE + "api/vthumbstrip?path=" + encodeURIComponent(path))
      .then(r => {
        if (!r.ok) throw new Error("no");
        const n = parseInt(r.headers.get("X-Strip-N") || "0", 10);
        const dur = parseFloat(r.headers.get("X-Strip-Duration") || "0");
        return r.blob().then(b => ({ b, n, dur }));
      })
      .then(({ b, n, dur }) => {
        if (!(n > 0) || !(dur > 0)) { strip = null; return; }
        strip = { url: URL.createObjectURL(b), n, dur };
      })
      .catch(() => { strip = null; /* 缩略图条不可用：回退单帧 */ });
  }
  // 条加载失败/异常时禁用条并切单帧；单帧也失败则隐藏预览（避免破图）
  prevImg.onerror = () => {
    const s = String(prevImg.src || "");
    if (strip) {
      try { URL.revokeObjectURL(strip.url); } catch (e) { /* 忽略 */ }
      strip = null;
    }
    if (s.indexOf("vframes") >= 0 || s.indexOf("blob:") >= 0) {
      prev.style.display = "none";
    }
  };
  // 单帧预览：api/vframes，80ms 防抖（帧图后端已缓存，重复请求廉价）
  function showSingleFrame(t) {
    const img = prevImg;
    img.style.objectFit = "contain";
    img.style.width = "160px";
    const now = Date.now();
    if (now - lastFrameT < 80) return;   // 未到间隔：复用当前 src
    lastFrameT = now;
    img.src = BASE + "api/vframes?path=" + encodeURIComponent(path) + "&t=" + Math.round(t);
  }
  // 缩略图条：按 header 的 dur/n 量化到块（后端每块 160px 宽），单块窗口 + 像素偏移精确定位；
  // t 超出条覆盖范围（t>dur 等）时回退单帧
  function showStripFrame(t) {
    if (!strip || strip.n < 1 || !(strip.dur > 0) || !Number.isFinite(t) || t < 0 || t > strip.dur + 0.5) {
      showSingleFrame(Number.isFinite(t) ? t : 0);
      return;
    }
    const img = prevImg;
    const idx = Math.max(0, Math.min(strip.n - 1, Math.floor((t / strip.dur) * strip.n)));
    img.style.objectFit = "none";
    img.style.width = "160px";                        // 单块窗口
    img.style.objectPosition = (-idx * 160) + "px 0"; // 像素级对齐到第 idx 块
    img.src = strip.url;
  }
  // 统一入口：clientX → rel → 秒 → 显示预览
  function onPreviewMove(clientX) {
    const rect = wrap.getBoundingClientRect();
    if (!rect.width) return;
    const rel = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const dur = previewDur
      || (Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 0)
      || (strip ? strip.dur : 0);
    const t = rel * dur;
    if (strip) showStripFrame(t); else showSingleFrame(Number.isFinite(t) ? t : 0);
    prev.style.display = "block";
  }
  function hidePreview() { prev.style.display = "none"; }
  // 绑定在 wrap（video-wrap，含原生控制条区域）上：Pointer Events 同时兼容鼠标与触摸拖动
  if (window.PointerEvent) {
    wrap.addEventListener("pointermove", (e) => { if (e.clientX != null) onPreviewMove(e.clientX); });
    wrap.addEventListener("pointerdown", hidePreview);
    wrap.addEventListener("pointerleave", hidePreview);
  } else {
    wrap.addEventListener("mousemove", (e) => { onPreviewMove(e.clientX); });
    wrap.addEventListener("mouseleave", hidePreview);
    wrap.addEventListener("touchmove", (e) => {
      if (e.touches && e.touches[0]) onPreviewMove(e.touches[0].clientX);
    }, { passive: true });
    wrap.addEventListener("touchstart", hidePreview);
    wrap.addEventListener("touchend", hidePreview);
    wrap.addEventListener("touchcancel", hidePreview);
  }
  // loadedmetadata：video 时长有效且更大时补更 previewDur（预览不依赖此事件）
  v.addEventListener("loadedmetadata", () => {
    const dur = v.duration || 0;
    if (Number.isFinite(dur) && dur > 0 && (!previewDur || dur > previewDur)) previewDur = dur;
  });

  // ---- 加载启动 ----
  loadStrip();
  loadVinfo();
  if (mseChk.input.checked) startMse().catch(e => showErr("MSE 启动失败: " + (e && e.message)));
  else playNative();
  if (subChk.input.checked) loadSubtitle();
}

// ---------------- 功能 3：文本查看 + 内置 Markdown 渲染 ----------------
// 安全策略：先整体 HTML 转义，再对转义后的文本套用格式标记，避免 XSS。
function renderMarkdown(src) {
  const lines = String(src || "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let codeBuf = [], inCode = false, inUl = false, inOl = false, tableRows = [];
  function inline(s) {
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, txt, url) => {
      // 仅允许安全协议/锚点/相对路径，防止 javascript: 等注入
      if (/^(https?:|mailto:|#|\/)/.test(url)) {
        return '<a href="' + url + '" target="_blank" rel="noopener">' + txt + "</a>";
      }
      return txt;
    });
    return s;
  }
  function flushCode() {
    if (inCode) {
      out.push('<pre class="md-code"><code>' + codeBuf.join("\n") + "</code></pre>");
      codeBuf = []; inCode = false;
    }
  }
  function flushList() {
    if (inUl) { out.push("</ul>"); inUl = false; }
    if (inOl) { out.push("</ol>"); inOl = false; }
  }
  function flushTable() {
    if (!tableRows.length) return;
    let h = "<table class='md-table'><thead><tr>";
    tableRows[0].forEach(c => { h += "<th>" + c + "</th>"; });
    h += "</tr></thead><tbody>";
    tableRows.slice(1).forEach(r => {
      h += "<tr>";
      r.forEach(c => { h += "<td>" + c + "</td>"; });
      h += "</tr>";
    });
    h += "</tbody></table>";
    out.push(h);
    tableRows = [];
  }
  for (const line of lines) {
    if (/^```/.test(line)) {           // 代码围栏切换
      flushList(); flushTable();
      if (inCode) flushCode(); else { inCode = true; codeBuf = []; }
      continue;
    }
    if (inCode) { codeBuf.push(esc(line)); continue; }
    flushCode();
    if (/^\s*$/.test(line)) { flushList(); flushTable(); out.push(""); continue; }
    if (/^\s*(?:---+|\*\*\*+)\s*$/.test(line)) { flushList(); flushTable(); out.push('<hr class="md-hr">'); continue; }
    const hm = line.match(/^(#{1,3})\s+(.*)$/);   // 标题
    if (hm) {
      flushList(); flushTable();
      const lv = hm[1].length;
      out.push("<h" + lv + " class='md-h'>" + inline(esc(hm[2])) + "</h" + lv + ">");
      continue;
    }
    const qm = line.match(/^>\s?(.*)$/);          // 引用
    if (qm) {
      flushList(); flushTable();
      out.push('<blockquote class="md-quote">' + inline(esc(qm[1])) + "</blockquote>");
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {           // 表格
      flushList();
      const cells = line.trim().replace(/^\||\|$/g, "").split("|").map(c => inline(esc(c.trim())));
      if (tableRows.length && cells.every(c => /^:?-{1,}:?$/.test(c))) continue; // 分隔行
      tableRows.push(cells);
      continue;
    }
    flushTable();
    const um = line.match(/^\s*[-*+]\s+(.*)$/);   // 无序列表
    if (um) {
      if (!inUl) { flushList(); out.push("<ul class='md-ul'>"); inUl = true; }
      out.push("<li>" + inline(esc(um[1])) + "</li>");
      continue;
    }
    const om = line.match(/^\s*\d+[.)]\s+(.*)$/); // 有序列表
    if (om) {
      if (!inOl) { flushList(); out.push("<ol class='md-ol'>"); inOl = true; }
      out.push("<li>" + inline(esc(om[1])) + "</li>");
      continue;
    }
    flushList();
    out.push("<p class='md-p'>" + inline(esc(line)) + "</p>");
  }
  flushCode(); flushList(); flushTable();
  return out.join("\n");
}

async function showText(path, name) {
  const body = document.createElement("div");
  body._phase = "load";
  const ld = loadingNodeCancel("文件较大，可能需要一点时间");
  body.appendChild(ld.node);
  openModal(name, body, { type: "text", path, name });
  const ac = new AbortController();
  if (_activePreviewAbort) _activePreviewAbort.abort();
  _activePreviewAbort = ac;
  let cancelled = false;
  ac.signal.addEventListener("abort", () => {
    cancelled = true;
    if (body._phase === "render") body.innerHTML = '<p class="muted small">已取消加载</p>';
  });
  ld.btn.onclick = () => ac.abort();
  let j;
  try {
    j = await api("api/read?path=" + encodeURIComponent(path), { signal: ac.signal });
  } catch (e) {
    body.innerHTML = "";
    if (e && e.name === "AbortError") {
      body.innerHTML = '<p class="muted small">已取消加载</p>';
    } else {
      body.innerHTML = '<p class="muted">加载失败: ' + esc(e && e.message) + "</p>";
    }
    return;
  }
  if (cancelled) return;
  if (j.error) { body.innerHTML = '<p class="muted">' + esc(j.error) + "</p>"; return; }
  body._phase = "render";
  body.innerHTML = "";
  const note = document.createElement("div");
  note.className = "mdl-note";
  let noteTxt = "编码: " + j.encoding;
  if (j.truncated) {
    const shown = (j.read_bytes != null && j.read_bytes > 0) ? j.read_bytes : strBytes(j.content);
    noteTxt += j.total_size != null
      ? "，文件共 " + fmtSize(j.total_size) + "，仅预览前 " + fmtSize(shown)
      : "，超过 1MB 的部分已截断";
  }
  note.textContent = noteTxt;
  body.appendChild(note);
  // 预览上限：超大内容只渲染前 400KB，避免一次性插入巨文本长时间布局卡死主线程
  const MAX_PREVIEW = 400000;
  let text = j.content;
  let bigNote = null;
  if (text.length > MAX_PREVIEW) {
    text = text.slice(0, MAX_PREVIEW);
    bigNote = document.createElement("div");
    bigNote.className = "bigfile-note";
    const span = document.createElement("span");
    span.textContent = "内容较多，仅显示前 400KB，完整内容请下载查看";
    bigNote.appendChild(span);
    const dl = document.createElement("button");
    dl.type = "button";
    dl.className = "btn btn-outline-primary btn-sm";
    dl.textContent = "⬇ 下载全文";
    dl.onclick = () => { location.href = dlUrl(path); };
    bigNote.appendChild(dl);
  }
  const holder = document.createElement("div");
  if (j.kind === "markdown") {
    holder.innerHTML = renderMarkdown(text);
  } else if (CODE_EXT.indexOf(extOf(name)) >= 0) {
    // 编程文件：≤200KB 直接填并高亮；超大代码文件分片渲染并跳过高亮（hljs 对超大代码块会卡死）
    const pre = document.createElement("pre");
    pre.className = "text-pre code-hl";
    const codeEl = document.createElement("code");
    codeEl.className = "hljs";
    pre.appendChild(codeEl);
    holder.appendChild(pre);
    if (text.length <= 200000) {
      codeEl.textContent = text;
      if (typeof hljs !== "undefined") {
        try { hljs.highlightElement(codeEl); } catch (e) { /* 高亮失败不影响阅读 */ }
      }
    } else {
      fillTextChunked(codeEl, text, 32768, () => cancelled);
    }
  } else {
    // 纯文本：分片渲染，块间让出主线程，用户随时可点 ×/取消
    const pre = document.createElement("pre");
    pre.className = "text-pre";
    holder.appendChild(pre);
    fillTextChunked(pre, text, 32768, () => cancelled);
  }
  body.appendChild(holder);
  if (bigNote) body.appendChild(bigNote);
  // 语法高亮（仅 markdown 内嵌代码块；highlight.js 可能因网络问题未加载，用 typeof 保护降级）
  if (j.kind === "markdown" && typeof hljs !== "undefined") {
    try {
      holder.querySelectorAll(".md-code code").forEach(el => hljs.highlightElement(el));
    } catch (e) { /* 高亮失败不影响阅读 */ }
  }
  const btns = document.createElement("div");
  btns.className = "d-flex flex-wrap gap-2 mt-3";
  btns.appendChild(mkBtn("⬇ 下载", () => { location.href = dlUrl(path); }));
  body.appendChild(btns);
}

// ---------------- 功能 4：压缩包在线解压 ----------------
async function showUnpack(path, name) {
  const body = document.createElement("div");
  const ld = loadingNodeCancel();
  body.appendChild(ld.node);
  openModal(name, body, { type: "unpack", path, name });
  const ac = new AbortController();
  if (_activePreviewAbort) _activePreviewAbort.abort();
  _activePreviewAbort = ac;
  ld.btn.onclick = () => ac.abort();
  let j;
  try {
    j = await api("api/unpack?path=" + encodeURIComponent(path), { signal: ac.signal });
  } catch (e) {
    body.innerHTML = "";
    body.innerHTML = (e && e.name === "AbortError")
      ? '<p class="muted small">已取消加载</p>'
      : '<p class="muted">加载失败: ' + esc(e && e.message) + "</p>";
    return;
  }
  body.innerHTML = "";
  if (j.error) { body.innerHTML = '<p class="muted">' + esc(j.error) + "</p>"; return; }
  if (j.format === "unsupported") {
    body.innerHTML = '<p class="muted">该格式暂不支持在线解压</p>';
    return;
  }
  const entries = Array.isArray(j.entries) ? j.entries : [];
  const MAX_ENTRIES = 5000;
  const shown = entries.slice(0, MAX_ENTRIES);
  const note = document.createElement("div");
  note.className = "mdl-note";
  note.textContent = "格式: " + j.format.toUpperCase() + "，共 " + entries.length + " 个条目" +
    (entries.length > MAX_ENTRIES ? "（条目较多，仅显示前 " + MAX_ENTRIES + " 条）" : "");
  body.appendChild(note);
  if (!entries.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "压缩包为空";
    body.appendChild(p);
  } else {
    const list = document.createElement("div");
    list.className = "unpack-list";
    shown.forEach(en => {
      const row = document.createElement("div");
      row.className = "unpack-row" + (en.is_dir ? " dir" : "");
      row.innerHTML = '<span class="ic"><img src="' + (en.is_dir ? BASE + "static/icons/folder.svg" : iconUrl(en.name)) + '" width="18" height="18" alt="" style="vertical-align:-3px"></span>' +
                      '<span class="uname"></span>' +
                      '<span class="usz">' + (en.is_dir ? "" : fmtSize(en.size)) + "</span>";
      row.querySelector(".uname").textContent = en.name;
      if (!en.is_dir) {
        row.onclick = () => {
          location.href = BASE + "api/unpackdl?archive=" + encodeURIComponent(path) +
                          "&entry=" + encodeURIComponent(en.path_in_archive);
        };
      }
      list.appendChild(row);
    });
    body.appendChild(list);
  }
  const btns = document.createElement("div");
  btns.className = "d-flex flex-wrap gap-2 mt-3";
  btns.appendChild(mkBtn("⬇ 下载压缩包本身", () => { location.href = dlUrl(path); }));
  body.appendChild(btns);
}

async function api(ep, opt) {
  const r = await fetch(BASE + ep, opt);
  return r.json();
}

function setPackBtn() {
  $("packBtn").innerHTML = '<span class="d-none d-sm-inline">📦 打包 .' + FMT + ' 下载</span>' +
                           '<span class="d-inline d-sm-none">📦 打包</span>';
}

function hideMainUi() {
  if ($("packBtn")) $("packBtn").classList.add("d-none");
  if ($("uploadBtn")) $("uploadBtn").classList.add("d-none");
  if ($("driveTabs")) $("driveTabs").classList.add("d-none");
  if ($("pinnedCard")) $("pinnedCard").classList.add("d-none");
  const p = document.querySelector("main .progress");
  if (p) p.classList.add("d-none");
}

async function init() {
  if (SHARE_MODE) {
    // ---- 分享模式：只读浏览分享根，不加载磁盘/置顶/打包/上传 ----
    hideMainUi();
    let info = null;
    try { info = await api("api/info"); } catch (e) { /* 忽略 */ }
    if (!info || info.error) {
      $("fileRows").innerHTML = '<div class="empty">' + esc((info && info.error) || "分享加载失败") + "</div>";
      return;
    }
    shareRoot = info.root;
    shareName = info.name || "";
    shareExpires = info.expires_at || null;
    shareVirtual = !!(info.virtual);
    // 虚拟分享：shareRoot 用空串根，虚拟路径作为"当前目录"；否则保留原绝对路径逻辑
    activeRoot = shareVirtual ? "" : shareRoot;
    // 分享模式禁用 localStorage 恢复（不写也不读 drive.* 键），避免污染主页状态
    view = "list";
    $("viewBtn").textContent = "▦";
    $("viewBtn").title = "切换为网格视图";
    let start = shareVirtual ? "" : shareRoot;
    try { start = new URLSearchParams(location.search).get("path") || start; } catch (e) { /* 忽略 */ }
    await loadList(start);
    return;
  }
  const info = await api("api/info");
  roots = info.roots || [];
  pinned = info.pinned || [];
  FMT = info.archive_format || "zip";
  setPackBtn();
  renderDriveTabs();
  renderPinned();
  // ---- 恢复视图模式与上次目录（功能 2：刷新不丢状态） ----
  view = loadLS("drive.view") === "grid" ? "grid" : "list";
  $("viewBtn").textContent = view === "list" ? "▦" : "☰";
  $("viewBtn").title = view === "list" ? "切换为网格视图" : "切换为列表视图";
  const savedRoot = loadLS("drive.root");
  const savedCur = loadLS("drive.cur");
  if (roots.length) {
    if (savedCur && roots.indexOf(savedRoot) >= 0) {
      await switchDrive(savedRoot);
      await loadList(savedCur);
    } else {
      await switchDrive(roots[0]);
    }
  } else {
    $("fileRows").innerHTML = '<div class="empty">没有可访问的磁盘</div>';
  }
  // ---- 恢复上次打开的弹窗（若 localStorage 里有记录） ----
  const m = loadLS("drive.modal");
  if (m) {
    let st = null;
    try { st = JSON.parse(m); } catch (e) { /* 损坏则忽略 */ }
    if (st && st.type && st.path) {
      if (st.type === "video") showVideo(st.path, st.name || "");
      else if (st.type === "text") showText(st.path, st.name || "");
      else if (st.type === "detail") showDetail(st.path, st.name || "");
      else if (st.type === "unpack") showUnpack(st.path, st.name || "");
      else if (st.type === "pdf") showPdf(st.path, st.name || "");
      else if (st.type === "csv") showCsv(st.path, st.name || "");
      else if (st.type === "lnk") showLnk(st.path, st.name || "");
      else { try { localStorage.removeItem("drive.modal"); } catch (e2) { /* 忽略 */ } }
    } else {
      try { localStorage.removeItem("drive.modal"); } catch (e2) { /* 忽略 */ }
    }
  }
}

function renderDriveTabs() {
  const box = $("driveTabs");
  box.innerHTML = "";
  roots.forEach(r => {
    const t = document.createElement("button");
    t.type = "button";
    t.className = "btn btn-sm flex-shrink-0" + (r === activeRoot ? " btn-primary" : " btn-outline-secondary");
    t.textContent = r.replace(/\\$/, "");
    t.onclick = () => switchDrive(r);
    box.appendChild(t);
  });
}

async function switchDrive(root) {
  activeRoot = root;
  renderDriveTabs();
  await loadList(root);
}

function renderPinned() {
  const box = $("pinnedList");
  $("pinCount").textContent = pinned.length + " 个";
  if (!pinned.length) { box.innerHTML = '<div class="empty" style="padding:14px 0">暂无置顶文件</div>'; return; }
  box.innerHTML = "";
  pinned.forEach(p => {
    const row = document.createElement("div");
    row.className = "prow d-flex align-items-center gap-2 py-2";
    row.innerHTML =
      '<span class="flex-shrink-0"><img src="' + (p.is_dir ? BASE + "static/icons/folder.svg" : iconUrl(p.name)) + '" width="18" height="18" alt="" style="vertical-align:-3px"></span>' +
      '<span class="pname flex-grow-1 text-truncate">' + esc(p.name) + "</span>" +
      '<span class="psize text-muted small flex-shrink-0 d-none d-sm-block">' + fmtSize(p.size) + "</span>" +
      '<button class="btn btn-outline-secondary btn-sm flex-shrink-0" data-a="share">分享</button>' +
      '<button class="btn btn-outline-secondary btn-sm flex-shrink-0" data-a="dl">下载</button>' +
      '<button class="btn btn-outline-secondary btn-sm flex-shrink-0" data-a="unpin">取消</button>';
    row.querySelector('[data-a="share"]').onclick = () => showShareDialog(p.path, p.name);
    row.querySelector('[data-a="dl"]').onclick = () => { location.href = dlUrl(p.path); };
    row.querySelector('[data-a="unpin"]').onclick = async () => {
      await api("api/pin?add=0&path=" + encodeURIComponent(p.path));
      pinned = pinned.filter(x => x.path !== p.path);
      renderPinned();
      loadList(cur);
    };
    box.appendChild(row);
  });
}

function renderBreadcrumb() {
  const bc = $("breadcrumb");
  bc.innerHTML = "";
  if (SHARE_MODE && shareVirtual) {
    // 虚拟分享：按 "/" 分隔虚拟路径渲染层级，根显示 info.root_name（不用绝对路径）
    const rel = cur ? String(cur).split("/").filter(Boolean) : [];
    let acc = "";
    rel.forEach(seg => {
      acc = acc ? acc + "/" + seg : seg;
      const s = document.createElement("span");
      s.className = "seg";
      s.textContent = seg;
      s.onclick = () => loadList(acc);
      bc.appendChild(s);
      bc.appendChild(Object.assign(document.createElement("span"), { className: "sep", textContent: "/" }));
    });
    const last = document.createElement("span");
    last.className = "cur";
    last.textContent = rel.length ? rel[rel.length - 1] : (shareName || "置顶分享");
    bc.appendChild(last);
    return;
  }
  if (SHARE_MODE && shareRoot) {
    // 分享模式：只显示从 shareRoot 起的相对层级，不显示"🏠"上级（不能回到分享根之上）
    const rootNorm = String(shareRoot).replace(/[\\\/]+$/, "");
    const curNorm = String(cur).replace(/[\\\/]+$/, "");
    const rel = curNorm === rootNorm ? [] : curNorm.slice(rootNorm.length).replace(/^[\\\/]+/, "").split(/[\\\/]/).filter(Boolean);
    let acc = rootNorm;
    rel.forEach(seg => {
      acc += "\\" + seg;
      const s = document.createElement("span");
      s.className = "seg";
      s.textContent = seg;
      s.onclick = () => loadList(acc);
      bc.appendChild(s);
      bc.appendChild(Object.assign(document.createElement("span"), { className: "sep", textContent: "/" }));
    });
    const last = document.createElement("span");
    last.className = "cur";
    last.textContent = rel.length ? rel[rel.length - 1] : (shareName || rootNorm);
    bc.appendChild(last);
    return;
  }
  const parts = cur.split(/[\\\/]/).filter(Boolean);
  let acc = "";
  const addSeg = (label, target) => {
    const s = document.createElement("span");
    s.className = "seg";
    s.textContent = label;
    s.onclick = () => loadList(target);
    bc.appendChild(s);
    bc.appendChild(Object.assign(document.createElement("span"), { className: "sep", textContent: "/" }));
  };
  if (cur !== activeRoot) addSeg("🏠", activeRoot);
  parts.forEach((part, i) => {
    if (i === 0) acc = part + "\\";
    else acc += "\\" + part;
    if (acc === cur) return;
    addSeg(part, acc);
  });
  const last = document.createElement("span");
  last.className = "cur";
  last.textContent = parts[parts.length - 1] || cur;
  bc.appendChild(last);
}

// ---------------- 功能 10：回退/前进导航栈 ----------------
let navStack = [];
let navIdx = -1;
// 入栈（后退/前进调用时 push=false，避免重复记录）
function _pushNav(path, opts) {
  if (opts && opts.push === false) return;
  if (navStack[navIdx] === path) return; // 同路径连续访问不重复入栈（刷新列表等场景）
  navStack = navStack.slice(0, navIdx + 1);
  navStack.push(path);
  navIdx = navStack.length - 1;
}
function updateNavBtns() {
  $("navBack").disabled = navIdx <= 0;
  $("navFwd").disabled = navIdx >= navStack.length - 1;
}
$("navBack").onclick = () => { if (navIdx > 0) loadList(navStack[--navIdx], { push: false }); };
$("navFwd").onclick = () => { if (navIdx < navStack.length - 1) loadList(navStack[++navIdx], { push: false }); };

// ---------------- 视图模式（list / grid），存 localStorage ----------------
let view = "list";
$("viewBtn").onclick = () => {
  view = view === "list" ? "grid" : "list";
  $("viewBtn").textContent = view === "list" ? "▦" : "☰";
  $("viewBtn").title = view === "list" ? "切换为网格视图" : "切换为列表视图";
  if (!SHARE_MODE) { try { localStorage.setItem("drive.view", view); } catch (e) { /* 忽略 */ } }
  if (cur) loadList(cur);
};

async function loadList(path, opts) {
  hideAlert();
  const rows = $("fileRows");
  rows.classList.toggle("grid", view === "grid");
  rows.innerHTML = '<div class="empty">加载中…</div>';
  const data = await api("api/list?path=" + encodeURIComponent(path));
  if (data.error) {
    rows.innerHTML = "";
    showAlert(data.error, [
      { label: "↩ 返回上级", fn: () => {
          const parent = data.parent;
          if (parent) loadList(parent); else if (activeRoot) loadList(activeRoot);
        } },
      { label: "↻ 重试", fn: () => loadList(path) },
    ]);
    return;
  }
  cur = path;
  _pushNav(path, opts);
  // 保存当前目录/磁盘，供刷新后恢复（分享模式不写主站键，避免污染主页状态）
  if (SHARE_MODE) {
    try { localStorage.removeItem("drive.cur"); localStorage.removeItem("drive.root"); } catch (e) { /* 忽略 */ }
  } else {
    try { localStorage.setItem("drive.cur", cur); localStorage.setItem("drive.root", activeRoot || ""); } catch (e) { /* 忽略 */ }
  }
  renderBreadcrumb();
  updateNavBtns();
  if (!data.entries.length) { rows.innerHTML = '<div class="empty">空目录</div>'; return; }
  rows.innerHTML = "";
  data.entries.forEach(e => {
    rows.appendChild(view === "grid" ? gridItem(e) : listItem(e));
  });
}

// 列表模式条目（点击行为与 grid 一致）
function listItem(e) {
  const row = document.createElement("li");
  const locked = !!e.locked;
  row.className = "list-group-item d-flex align-items-center gap-2 py-2" + (locked ? " text-muted opacity-75" : "");
  const pinnedNow = isPinned(e.path);
  const ic = e.is_dir ? BASE + "static/icons/folder.svg" : (locked ? BASE + "static/icons/locked.svg" : iconUrl(e.name));
  row.innerHTML =
    '<span class="ic flex-shrink-0 text-center" style="width:26px"><img src="' + ic + '" width="20" height="20" alt="" style="vertical-align:-4px"></span>' +
    '<span class="nm text-truncate flex-grow-1' + (e.is_dir ? " fw-medium" : "") + '"></span>' +
    '<span class="mt d-none d-md-block text-muted small flex-shrink-0 text-end" style="width:130px">' + fmtTime(e.mtime) + "</span>" +
    '<span class="sz text-muted small flex-shrink-0 text-end" style="min-width:70px">' + (e.is_dir ? "—" : fmtSize(e.size)) + "</span>" +
    '<span class="info-btn text-muted flex-shrink-0 px-1 user-select-none" title="详情">ⓘ</span>' +
    (SHARE_MODE
      ? '<span class="share-btn btn-link text-primary flex-shrink-0 px-1 user-select-none" title="二次分享" style="font-size:12px">🔗 分享</span>'
      : '<span class="star flex-shrink-0 px-1 user-select-none text-center' + (pinnedNow ? " on" : "") + '" style="width:24px">' + (pinnedNow ? "★" : "☆") + "</span>");
  const nm = row.querySelector(".nm");
  nm.textContent = e.name;
  bindRowAction(nm, e, locked);
  row.querySelector(".info-btn").onclick = () => showDetail(e.path, e.name);
  if (SHARE_MODE) {
    const sb = row.querySelector(".share-btn");
    if (sb) sb.onclick = () => showShareDialog(e.path, e.name, { sub: true });
  } else {
    row.querySelector(".star").onclick = async () => {
      if (locked) { toast("被系统占用的文件无法置顶"); return; }
      const add = pinnedNow ? 0 : 1;
      await api("api/pin?add=" + add + "&path=" + encodeURIComponent(e.path));
      pinned = (await api("api/info")).pinned || [];
      renderPinned();
      loadList(cur);
    };
  }
  return row;
}

// 网格模式条目：大图标 + 名称 + 大小；点击行为与 list 完全一致
function gridItem(e) {
  const locked = !!e.locked;
  const card = document.createElement("li");
  card.className = "grid-item" + (locked ? " text-muted opacity-75" : "");
  let cover;
  if (e.is_dir) {
    cover = '<img loading="lazy" src="' + BASE + "static/icons/folder.svg" + '" class="grid-cover" alt="">';
  } else if (locked) {
    cover = '<img loading="lazy" src="' + BASE + "static/icons/locked.svg" + '" class="grid-cover" alt="">';
  } else if (fileKind(e.name) === "video") {
    // 视频封面：后端缩略图，加载失败回退视频图标
    cover = '<img loading="lazy" src="' + BASE + "api/thumb?path=" + encodeURIComponent(e.path) +
            '" onerror="this.onerror=null;this.src=\'' + BASE + "static/icons/video.svg" + '\'" class="grid-cover" alt="">';
  } else {
    cover = '<img loading="lazy" src="' + iconUrl(e.name) + '" class="grid-cover" alt="">';
  }
  const pinnedNow = isPinned(e.path);
  card.innerHTML =
    '<div class="grid-top">' +
    '  <span class="grid-star' + (pinnedNow ? " on" : "") + '" title="' + (pinnedNow ? "置顶" : "置顶") + '">' + (pinnedNow ? "★" : "☆") + "</span>" +
    '  <span class="grid-info btn-link text-muted" title="详情">ⓘ</span>' +
    "</div>" +
    '<div class="grid-cover-wrap">' + cover + "</div>" +
    '<div class="grid-name"></div>' +
    '<div class="grid-size">' + (e.is_dir ? "" : fmtSize(e.size)) + "</div>" +
    (SHARE_MODE ? '<div class="grid-share btn-link text-primary" title="二次分享" style="font-size:11px">🔗 分享</div>' : "");
  card.querySelector(".grid-name").textContent = e.name;
  bindRowAction(card, e, locked);
  // 详情按钮：stopPropagation 避免触发卡片本身的点击行为
  const infoBtn = card.querySelector(".grid-info");
  infoBtn.onclick = (ev) => { ev.stopPropagation(); showDetail(e.path, e.name); };
  // 置顶星标（主模式）：点击切换置顶；分享模式不显示
  if (!SHARE_MODE) {
    const star = card.querySelector(".grid-star");
    star.onclick = async (ev) => {
      ev.stopPropagation();
      if (locked) { toast("被系统占用的文件无法置顶"); return; }
      const add = isPinned(e.path) ? 0 : 1;
      await api("api/pin?add=" + add + "&path=" + encodeURIComponent(e.path));
      pinned = (await api("api/info")).pinned || [];
      renderPinned();
      loadList(cur);
    };
  } else {
    const s = card.querySelector(".grid-star");
    if (s) s.style.display = "none";
  }
  if (SHARE_MODE) {
    const sb = card.querySelector(".grid-share");
    if (sb) sb.onclick = (ev) => { ev.stopPropagation(); showShareDialog(e.path, e.name, { sub: true }); };
  }
  return card;
}

// 文件/目录点击分流（list 行内名称与 grid 卡片共用）：目录进入、锁定提示、视频/文本/压缩包/PDF/CSV/lnk 弹窗、其它下载
function bindRowAction(el, e, locked) {
  if (e.is_dir) {
    el.onclick = () => { loadList(e.path); };
    return;
  }
  if (locked) {
    el.onclick = () => toast("该文件被系统占用，无法下载");
    el.style.cursor = "not-allowed";
    return;
  }
  const kind = fileKind(e.name);
  if (kind === "video") {
    el.onclick = () => showVideo(e.path, e.name);
  } else if (kind === "markdown" || kind === "text") {
    el.onclick = () => showText(e.path, e.name);
  } else if (kind === "archive") {
    el.onclick = () => showUnpack(e.path, e.name);
  } else if (kind === "pdf") {
    el.onclick = () => showPdf(e.path, e.name);
  } else if (kind === "csv") {
    el.onclick = () => showCsv(e.path, e.name);
  } else if (kind === "lnk") {
    el.onclick = () => showLnk(e.path, e.name);
  } else {
    // 其它类型：直接下载（list 模式用链接，grid 模式用 location 跳转）
    if (el.tagName === "SPAN" || el.className.indexOf("nm") >= 0) {
      const a = document.createElement("a");
      a.href = dlUrl(e.path);
      a.textContent = e.name;
      a.className = "d-block text-truncate text-decoration-none text-reset";
      el.textContent = "";
      el.appendChild(a);
    } else {
      el.onclick = () => { location.href = dlUrl(e.path); };
    }
  }
}

$("refreshBtn").onclick = () => { if (cur) loadList(cur); };

$("packBtn").onclick = () => {
  if (!pinned.length) { toast("还没有置顶文件"); return; }
  location.href = BASE + "dlzip?paths=" + encodeURIComponent(pinned.map(p => p.path).join("|"));
};

$("shareAllBtn").onclick = () => {
  if (!pinned.length) { toast("还没有置顶文件"); return; }
  showShareManyDialog();
};

$("uploadBtn").onclick = () => $("fileInput").click();
$("fileInput").onchange = async (ev) => {
  const files = Array.from(ev.target.files || []);
  if (!files.length || !cur) return;
  const wrap = document.querySelector(".progress");
  wrap.classList.remove("d-none");
  $("upBar").style.width = "0%";
  let done = 0, ok = 0, errs = [];
  for (const f of files) {
    const fd = new FormData();
    fd.append("file", f);
    try {
      const r = await fetch(BASE + "api/upload?path=" + encodeURIComponent(cur), { method: "POST", body: fd });
      const j = await r.json();
      if (j.saved && j.saved.length) ok++;
      if (j.errors && j.errors.length) errs = errs.concat(j.errors);
    } catch (e) { errs.push(f.name + ": " + e.message); }
    done++;
    $("upBar").style.width = Math.round(done / files.length * 100) + "%";
  }
  wrap.classList.add("d-none");
  ev.target.value = "";
  toast(ok + " 个文件上传成功" + (errs.length ? "，" + errs.length + " 个失败" : ""));
  if (errs.length) showAlert("上传失败: " + errs.map(e => e.name || e).join("; "), [{ label: "知道了", fn: hideAlert }]);
  loadList(cur);
};

init();

// ---------------- 功能 7：编程文件扩展名（语法高亮 + 图标映射共用） ----------------
const CODE_EXT = ["json","js","ts","jsx","tsx","py","java","c","cpp","h","hpp","cs","go","rs","php","rb","sh","bat","ps1","html","htm","css","scss","xml","yaml","yml","toml","ini","sql"];

// ---------------- 功能 8：文件类型专用图标（iconOf / iconUrl） ----------------
function iconOf(name) {
  const e = extOf(name);
  if (e === "iso") return "iso";
  if (e === "lnk") return "lnk";
  if (VIDEO_EXT.indexOf(e) >= 0) return "video";
  if (["jpg","jpeg","png","gif","webp","bmp","svg"].indexOf(e) >= 0) return "image";
  if (["mp3","flac","wav","m4a","ogg","aac"].indexOf(e) >= 0) return "audio";
  if (["zip","rar","7z","tar","gz"].indexOf(e) >= 0) return "archive";
  if (["doc","docx"].indexOf(e) >= 0) return "doc";
  if (["xls","xlsx","csv"].indexOf(e) >= 0) return "sheet";
  if (["exe","msi","bat"].indexOf(e) >= 0) return "exe";
  if (CODE_EXT.indexOf(e) >= 0) return "code";
  if (["txt","md","markdown","log"].indexOf(e) >= 0) return "text";
  return "file";
}
// 图标 URL（目录/锁定由调用方特判，这里只负责普通文件）
function iconUrl(e) { return BASE + "static/icons/" + iconOf(e) + ".svg"; }
// Windows 路径取父目录（兼容 / 与 \）
function dirnameOf(p) {
  const s = String(p).split(/[\\\/]/);
  s.pop();
  return s.join("\\");
}

// ---------------- 功能 2：localStorage 状态保存/恢复 ----------------
function loadLS(k) {
  try { return localStorage.getItem(k); } catch (e) { return null; }
}
// 保存当前目录/磁盘/视图/弹窗（任何一步失败都静默，兼容禁用 localStorage 的浏览器）
function saveDriveState() {
  try {
    if (SHARE_MODE) return; // 分享模式不写主站状态键，避免污染主页
    if (cur) localStorage.setItem("drive.cur", cur);
    if (activeRoot) localStorage.setItem("drive.root", activeRoot);
    localStorage.setItem("drive.view", view);
    if (modalState) localStorage.setItem("drive.modal", JSON.stringify(modalState));
    else localStorage.removeItem("drive.modal");
  } catch (e) { /* 忽略 */ }
}

// ---------------- 功能 4：CSV 在线预览（表格） ----------------
// 简易 CSV 解析：支持引号包裹字段（含内部逗号/换行/转义引号 ""）
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", inQ = false;
  const s = String(text == null ? "" : text);
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; }
        else inQ = false;
      } else cell += c;
    } else if (c === '"') {
      inQ = true;
    } else if (c === ",") {
      row.push(cell); cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      if (!(row.length === 1 && row[0] === "")) rows.push(row); // 跳过完全空行
      row = []; cell = "";
    } else {
      cell += c;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
  }
  return rows;
}

async function showCsv(path, name) {
  const body = document.createElement("div");
  const ld = loadingNodeCancel("文件较大，可能需要一点时间");
  body.appendChild(ld.node);
  openModal(name, body, { type: "csv", path, name });
  const ac = new AbortController();
  if (_activePreviewAbort) _activePreviewAbort.abort();
  _activePreviewAbort = ac;
  ld.btn.onclick = () => ac.abort();
  let j;
  try {
    j = await api("api/read?path=" + encodeURIComponent(path), { signal: ac.signal });
  } catch (e) {
    body.innerHTML = "";
    body.innerHTML = (e && e.name === "AbortError")
      ? '<p class="muted small">已取消加载</p>'
      : '<p class="muted">加载失败: ' + esc(e && e.message) + "</p>";
    return;
  }
  if (j.error) { body.innerHTML = '<p class="muted">' + esc(j.error) + "</p>"; return; }
  body.innerHTML = "";
  const note = document.createElement("div");
  note.className = "mdl-note";
  let noteTxt = "编码: " + j.encoding;
  if (j.truncated) {
    const shown = (j.read_bytes != null && j.read_bytes > 0) ? j.read_bytes : strBytes(j.content);
    noteTxt += j.total_size != null
      ? "，文件共 " + fmtSize(j.total_size) + "，仅预览前 " + fmtSize(shown)
      : "，超过 1MB 的部分已截断";
  }
  note.textContent = noteTxt;
  body.appendChild(note);
  // 大 CSV：只解析前 300KB、最多渲染前 2000 行，避免一次性解析 + 构建巨表阻塞主线程
  let text = j.content;
  if (text.length > 300000) text = text.slice(0, 300000);
  const rows = parseCsv(text);
  const MAX_ROWS = 2000;
  const shown = rows.slice(0, MAX_ROWS);
  if (rows.length > MAX_ROWS) {
    const p = document.createElement("div");
    p.className = "mdl-note";
    p.textContent = "条目较多，仅显示前 " + (MAX_ROWS - 1) + " 行数据，完整内容请下载";
    body.appendChild(p);
  }
  const wrap = document.createElement("div");
  wrap.style.cssText = "overflow:auto;max-height:60vh";
  let html = '<table class="table table-sm table-bordered table-striped mb-0">';
  shown.forEach((r, idx) => {
    const isHead = idx === 0;
    html += isHead ? "<thead><tr>" : "<tr>";
    r.forEach(c => {
      html += (isHead ? "<th>" : "<td>") + esc(c) + (isHead ? "</th>" : "</td>");
    });
    html += isHead ? "</tr></thead>" : "</tr>";
  });
  html += "</table>";
  wrap.innerHTML = html;
  body.appendChild(wrap);
  const btns = document.createElement("div");
  btns.className = "d-flex flex-wrap gap-2 mt-3";
  btns.appendChild(mkBtn("⬇ 下载", () => { location.href = dlUrl(path); }));
  body.appendChild(btns);
}

// ---------------- 功能 4：PDF 在线预览 ----------------
function showPdf(path, name) {
  const body = document.createElement("div");
  openModal(name, body, { type: "pdf", path, name });
  const url = BASE + "api/pdf?path=" + encodeURIComponent(path);
  const iframe = document.createElement("iframe");
  iframe.src = url;
  iframe.style.cssText = "width:100%;height:60vh;border:0;border-radius:8px;background:#fff";
  body.appendChild(iframe);
  // 兜底：浏览器不支持内联 PDF 时，用户可点链接新窗口打开
  const fb = document.createElement("div");
  fb.className = "mt-2 text-center small";
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = "若上方无法显示，点击此处打开 PDF";
  fb.appendChild(a);
  body.appendChild(fb);
  const btns = document.createElement("div");
  btns.className = "d-flex flex-wrap gap-2 mt-3";
  btns.appendChild(mkBtn("⬇ 下载", () => { location.href = dlUrl(path); }));
  body.appendChild(btns);
}

// ---------------- 功能 5：.lnk 快捷方式跳转（跳到目标位置而非直接打开） ----------------
async function showLnk(path, name) {
  const body = document.createElement("div");
  const ld = loadingNodeCancel();
  body.appendChild(ld.node);
  openModal(name, body, { type: "lnk", path, name });
  const ac = new AbortController();
  if (_activePreviewAbort) _activePreviewAbort.abort();
  _activePreviewAbort = ac;
  ld.btn.onclick = () => ac.abort();
  let j;
  try {
    j = await api("api/lnk?path=" + encodeURIComponent(path), { signal: ac.signal });
  } catch (e) {
    body.innerHTML = "";
    if (e && e.name === "AbortError") {
      body.innerHTML = '<p class="muted small">已取消加载</p>';
      return;
    }
    j = { ok: false, error: "请求失败：" + e.message };
  }
  body.innerHTML = "";
  if (!j || !j.ok) {
    body.innerHTML = '<p class="muted">快捷方式解析失败：' + esc((j && j.error) || "未知错误") + "</p>" +
      '<div class="d-flex flex-wrap gap-2 mt-3"><button class="btn btn-primary" id="lnkDlSelf">⬇ 下载快捷方式本身</button></div>';
    $("lnkDlSelf").onclick = () => { location.href = dlUrl(path); };
    return;
  }
  const isDir = !!j.is_dir;
  const exists = !!j.exists;
  const target = j.target || "";
  const info = document.createElement("div");
  info.innerHTML =
    '<div class="small text-muted mb-1">快捷方式目标</div>' +
    '<div class="p-2 bg-body-secondary rounded" style="word-break:break-all;font-size:13px">' + esc(target) + "</div>" +
    '<div class="small text-muted mt-1">' + (isDir ? "目标为目录" : (exists ? "目标为文件" : "目标不存在或已移动")) + "</div>";
  body.appendChild(info);
  const btns = document.createElement("div");
  btns.className = "d-flex flex-wrap gap-2 mt-3";
  btns.appendChild(mkBtn("📂 进入目标所在目录", () => {
    const t = isDir ? target : dirnameOf(target);
    loadList(t);
    closeModal();
  }));
  if (!isDir && exists) {
    btns.appendChild(mkBtn("⬇ 下载原文件", () => { location.href = dlUrl(target); }));
  }
  btns.appendChild(mkBtn("⬇ 下载快捷方式本身", () => { location.href = dlUrl(path); }));
  body.appendChild(btns);
}

// ---------------- 功能 9：再分享 ----------------
// 主模式：创建新分享（选 1/24/72/168 小时有效期）。
// 分享模式（sub 模式）：二次分享，与当前分享共享同一个过期时间（不选新有效期）。
function showShareDialog(path, name, opts) {
  const sub = !!(opts && opts.sub);
  const body = document.createElement("div");
  if (sub) return showSubShareDialog(path, name);
  openModal("创建分享链接", body, null); // 分享弹窗不参与刷新恢复
  body.innerHTML =
    '<div class="mb-2 text-truncate" title="' + esc(name) + '">' + esc(name) + "</div>" +
    '<div class="mb-3">' +
    '  <div class="form-check"><input class="form-check-input" type="radio" name="shareHours" id="sh1" value="1"><label class="form-check-label" for="sh1">1 小时</label></div>' +
    '  <div class="form-check"><input class="form-check-input" type="radio" name="shareHours" id="sh24" value="24" checked><label class="form-check-label" for="sh24">1 天</label></div>' +
    '  <div class="form-check"><input class="form-check-input" type="radio" name="shareHours" id="sh72" value="72"><label class="form-check-label" for="sh72">3 天</label></div>' +
    '  <div class="form-check"><input class="form-check-input" type="radio" name="shareHours" id="sh168" value="168"><label class="form-check-label" for="sh168">7 天</label></div>' +
    "</div>" +
    '<button class="btn btn-primary w-100" id="shareGen">生成链接</button>';
  const genBtn = $("shareGen");
  genBtn.onclick = async () => {
    const checked = document.querySelector('input[name="shareHours"]:checked');
    const hours = checked ? checked.value : "24";
    genBtn.disabled = true;
    genBtn.textContent = "生成中…";
    const failHtml = (msg) => {
      body.innerHTML = '<div class="alert alert-danger py-2 mb-2">' + esc(msg) + "</div>" +
        '<button class="btn btn-primary w-100" id="shareGen">重试</button>';
      $("shareGen").onclick = () => showShareDialog(path, name);
    };
    try {
      const j = await api("api/share?path=" + encodeURIComponent(path) + "&hours=" + hours);
      if (j.error || !j.ok) { failHtml(j.error || "生成失败"); return; }
      const fullUrl = location.origin + j.url;
      body.innerHTML =
        '<div class="alert alert-success py-2 mb-2">分享链接已生成（' + esc(j.name || name) + "）</div>" +
        '<div class="p-2 bg-body-secondary rounded mb-3" id="shareUrl" style="word-break:break-all;font-size:13px;user-select:all">' + esc(fullUrl) + "</div>" +
        '<div class="d-flex flex-wrap gap-2">' +
        '  <button class="btn btn-primary flex-fill" id="shareOpen">🌐 打开分享页</button>' +
        '  <button class="btn btn-outline-primary flex-fill" id="shareCopy">📋 复制链接</button>' +
        "</div>" +
        '<div class="small text-muted mt-2">有效期至 ' + fmtTime(j.expires_at) + "</div>";
      $("shareOpen").onclick = () => { window.open(fullUrl); };
      $("shareCopy").onclick = () => {
        const txt = $("shareUrl").textContent;
        const ok = () => toast("链接已复制");
        const fallback = () => {
          // 降级方案：选中文本 + execCommand("copy")
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents($("shareUrl"));
          sel.removeAllRanges();
          sel.addRange(range);
          try { document.execCommand("copy"); ok(); }
          catch (e) { toast("复制失败，请长按手动复制"); }
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt).then(ok).catch(fallback);
        } else fallback();
      };
    } catch (e) {
      failHtml("请求失败：" + e.message);
    }
  };
}

// ---------------- 功能 9：全部分享（一次把全部置顶文件生成分享链接） ----------------
// 有效期选择 UI 与单文件分享一致（radio 1/24/72/168，默认 24），
// 后端契约：api/share?paths=<p1>|<p2>|<p3>&hours=<h>（paths 每项 encodeURIComponent，整体再 encode 一次）
function showShareManyDialog() {
  const body = document.createElement("div");
  openModal("全部分享", body, null); // 分享弹窗不参与刷新恢复
  body.innerHTML =
    '<div class="mb-2 text-truncate">共 ' + pinned.length + ' 个置顶文件将生成分享链接</div>' +
    '<div class="mb-3">' +
    '  <div class="form-check"><input class="form-check-input" type="radio" name="shareManyHours" id="sm1" value="1"><label class="form-check-label" for="sm1">1 小时</label></div>' +
    '  <div class="form-check"><input class="form-check-input" type="radio" name="shareManyHours" id="sm24" value="24" checked><label class="form-check-label" for="sm24">1 天</label></div>' +
    '  <div class="form-check"><input class="form-check-input" type="radio" name="shareManyHours" id="sm72" value="72"><label class="form-check-label" for="sm72">3 天</label></div>' +
    '  <div class="form-check"><input class="form-check-input" type="radio" name="shareManyHours" id="sm168" value="168"><label class="form-check-label" for="sm168">7 天</label></div>' +
    "</div>" +
    '<button class="btn btn-primary w-100" id="shareManyGen">生成链接</button>';
  const genBtn = $("shareManyGen");
  genBtn.onclick = async () => {
    const checked = document.querySelector('input[name="shareManyHours"]:checked');
    const hours = checked ? checked.value : "24";
    genBtn.disabled = true;
    genBtn.textContent = "生成中…";
    const failHtml = (msg) => {
      body.innerHTML = '<div class="alert alert-danger py-2 mb-2">' + esc(msg) + "</div>" +
        '<button class="btn btn-primary w-100" id="shareManyGen">重试</button>';
      $("shareManyGen").onclick = () => showShareManyDialog();
    };
    try {
      const pathsParam = pinned.map(p => p.path).join("|");
      const j = await api("api/share?paths=" + encodeURIComponent(pathsParam) + "&hours=" + hours);
      if (j.error || !j.ok) { failHtml(j.error || "生成失败"); return; }
      const fullUrl = location.origin + j.url;
      body.innerHTML =
        '<div class="alert alert-success py-2 mb-2">分享链接已生成（' + pinned.length + ' 个文件）</div>' +
        '<div class="p-2 bg-body-secondary rounded mb-3" id="shareManyUrl" style="word-break:break-all;font-size:13px;user-select:all">' + esc(fullUrl) + "</div>" +
        '<div class="d-flex flex-wrap gap-2">' +
        '  <button class="btn btn-primary flex-fill" id="shareManyOpen">🌐 打开分享页</button>' +
        '  <button class="btn btn-outline-primary flex-fill" id="shareManyCopy">📋 复制链接</button>' +
        "</div>" +
        '<div class="small text-muted mt-2">有效期至 ' + fmtTime(j.expires_at) + "</div>";
      $("shareManyOpen").onclick = () => { window.open(fullUrl); };
      $("shareManyCopy").onclick = () => {
        const txt = $("shareManyUrl").textContent;
        const ok = () => toast("链接已复制");
        const fallback = () => {
          // 降级方案：选中文本 + execCommand("copy")
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents($("shareManyUrl"));
          sel.removeAllRanges();
          sel.addRange(range);
          try { document.execCommand("copy"); ok(); }
          catch (e) { toast("复制失败，请长按手动复制"); }
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt).then(ok).catch(fallback);
        } else fallback();
      };
    } catch (e) {
      failHtml("请求失败：" + e.message);
    }
  };
}

// 二次分享（分享模式）：直接调 api/sharesub，不弹有效期选择，与父分享同步过期
async function showSubShareDialog(path, name) {
  const body = document.createElement("div");
  openModal("二次分享", body, null); // 分享弹窗不参与刷新恢复
  body.innerHTML =
    '<div class="mb-2 text-truncate" title="' + esc(name) + '">' + esc(name) + "</div>" +
    '<div class="small text-muted mb-3">二次分享 · 与当前分享同步过期</div>' +
    '<button class="btn btn-primary w-100" id="subGen">生成链接</button>';
  const genBtn = $("subGen");
  genBtn.onclick = async () => {
    genBtn.disabled = true;
    genBtn.textContent = "生成中…";
    const failHtml = (msg) => {
      body.innerHTML = '<div class="alert alert-danger py-2 mb-2">' + esc(msg) + "</div>" +
        '<button class="btn btn-primary w-100" id="subGen">重试</button>';
      $("subGen").onclick = () => showSubShareDialog(path, name);
    };
    try {
      const j = await api("api/sharesub?path=" + encodeURIComponent(path));
      if (j.error || !j.ok) { failHtml(j.error || "生成失败"); return; }
      const fullUrl = location.origin + j.url;
      body.innerHTML =
        '<div class="alert alert-success py-2 mb-2">二次分享链接已生成（' + esc(j.name || name) + "）</div>" +
        '<div class="p-2 bg-body-secondary rounded mb-3" id="shareUrl" style="word-break:break-all;font-size:13px;user-select:all">' + esc(fullUrl) + "</div>" +
        '<div class="d-flex flex-wrap gap-2">' +
        '  <button class="btn btn-primary flex-fill" id="shareOpen">🌐 打开分享页</button>' +
        '  <button class="btn btn-outline-primary flex-fill" id="shareCopy">📋 复制链接</button>' +
        "</div>" +
        '<div class="small text-muted mt-2">与当前分享同步过期（' + fmtTime(j.expires_at) + "）</div>";
      $("shareOpen").onclick = () => { window.open(fullUrl); };
      $("shareCopy").onclick = () => {
        const txt = $("shareUrl").textContent;
        const ok = () => toast("链接已复制");
        const fallback = () => {
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents($("shareUrl"));
          sel.removeAllRanges();
          sel.addRange(range);
          try { document.execCommand("copy"); ok(); }
          catch (e) { toast("复制失败，请长按手动复制"); }
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt).then(ok).catch(fallback);
        } else fallback();
      };
    } catch (e) {
      failHtml("请求失败：" + e.message);
    }
  };
}
