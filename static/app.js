// 由 server.py 拆分而来：电脑网盘主前端逻辑
"use strict";
// ===== 推荐标签：中文停用词表（来源 https://github.com/goto456/stopwords/blob/master/cn_stopwords.txt）+ 基础英文停用词 =====
const STOPWORDS = new Set([
  '！',
  '$',
  '，',
  '、',
  '。',
  '：',
  '；',
  '?',
  '？',
  '_',
  '“',
  '”',
  '《',
  '》',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '阿',
  '啊',
  '哎',
  '哎呀',
  '哎哟',
  '唉',
  '嗳',
  '俺',
  '俺们',
  '按',
  '按照',
  '巴',
  '巴巴',
  '把',
  '罢了',
  '吧',
  '吧哒',
  '般的',
  '被',
  '呗',
  '本',
  '本地',
  '本人',
  '本身',
  '本着',
  '比',
  '比方',
  '比及',
  '比如',
  '彼',
  '彼此',
  '彼时',
  '鄙人',
  '边',
  '便于',
  '别',
  '别处',
  '别的',
  '别管',
  '别人',
  '别是',
  '别说',
  '并',
  '并非',
  '并且',
  '不',
  '不比',
  '不成',
  '不单',
  '不但',
  '不得',
  '不独',
  '不妨',
  '不管',
  '不光',
  '不过',
  '不仅',
  '不尽',
  '不尽然',
  '不拘',
  '不料',
  '不论',
  '不怕',
  '不然',
  '不如',
  '不若',
  '不是',
  '不特',
  '不外乎',
  '不惟',
  '不问',
  '不只',
  '不至于',
  '才',
  '才能',
  '曾',
  '朝',
  '朝着',
  '趁',
  '趁着',
  '诚然',
  '诚如',
  '乘',
  '冲',
  '出来',
  '出于',
  '除',
  '除此之外',
  '除非',
  '除开',
  '除了',
  '除外',
  '处在',
  '此',
  '此处',
  '此次',
  '此地',
  '此间',
  '此时',
  '此外',
  '从',
  '从此',
  '从而',
  '啐',
  '打',
  '打从',
  '大',
  '大家',
  '待',
  '但',
  '但凡',
  '但是',
  '当',
  '当地',
  '当然',
  '当着',
  '到',
  '得',
  '得了',
  '地',
  '的',
  '的话',
  '的确',
  '等',
  '等到',
  '等等',
  '第',
  '叮咚',
  '咚',
  '都',
  '对',
  '对比',
  '对待',
  '对方',
  '对于',
  '多',
  '多么',
  '多少',
  '呃',
  '儿',
  '而',
  '而后',
  '而况',
  '而且',
  '而是',
  '而外',
  '而言',
  '而已',
  '尔',
  '尔尔',
  '尔后',
  '二来',
  '凡',
  '凡是',
  '反而',
  '反过来',
  '反过来说',
  '反之',
  '非但',
  '非独',
  '非特',
  '非徒',
  '分别',
  '否则',
  '嘎',
  '嘎登',
  '该',
  '赶',
  '个',
  '个别',
  '各',
  '各个',
  '各位',
  '各种',
  '各自',
  '给',
  '根据',
  '跟',
  '固然',
  '故',
  '故此',
  '故而',
  '关于',
  '管',
  '光是',
  '归',
  '归齐',
  '果然',
  '果真',
  '过',
  '哈',
  '哈哈',
  '咳',
  '还',
  '还是',
  '还要',
  '还有',
  '好',
  '呵',
  '呵呵',
  '嗬',
  '何',
  '何处',
  '何况',
  '何时',
  '何以',
  '和',
  '嘿',
  '嘿嘿',
  '很',
  '哼',
  '哼唷',
  '后',
  '后者',
  '乎',
  '呼哧',
  '哗',
  '换句话说',
  '换言之',
  '或',
  '或是',
  '或曰',
  '或则',
  '或者',
  '基于',
  '及',
  '及其',
  '及至',
  '极了',
  '即',
  '即便',
  '即或',
  '即令',
  '即如',
  '即若',
  '即使',
  '几',
  '几时',
  '己',
  '既',
  '既然',
  '既是',
  '既往',
  '继而',
  '继后',
  '继之',
  '加以',
  '加之',
  '假如',
  '假若',
  '假使',
  '兼之',
  '简言之',
  '鉴于',
  '将',
  '叫',
  '较',
  '较之',
  '接着',
  '结果',
  '截至',
  '介于',
  '借',
  '今',
  '尽',
  '尽管',
  '尽管如此',
  '紧接着',
  '进而',
  '经',
  '经过',
  '竟而',
  '就',
  '就是',
  '就是了',
  '就是说',
  '就算',
  '就要',
  '具体地说',
  '具体说来',
  '据',
  '据此',
  '距',
  '开始',
  '开外',
  '看',
  '靠',
  '可',
  '可见',
  '可是',
  '可以',
  '况且',
  '啦',
  '来',
  '来说',
  '来着',
  '来自',
  '赖以',
  '啷当',
  '了',
  '类如',
  '哩',
  '离',
  '例如',
  '连',
  '连同',
  '两者',
  '咧',
  '临',
  '另',
  '另外',
  '另悉',
  '另一方面',
  '喽',
  '论',
  '吗',
  '嘛',
  '漫说',
  '慢说',
  '冒',
  '么',
  '没奈何',
  '每',
  '每当',
  '们',
  '莫不然',
  '莫如',
  '莫若',
  '某',
  '某个',
  '某某',
  '某些',
  '拿',
  '哪',
  '哪边',
  '哪儿',
  '哪个',
  '哪里',
  '哪年',
  '哪怕',
  '哪天',
  '哪些',
  '哪样',
  '那',
  '那般',
  '那边',
  '那儿',
  '那个',
  '那会儿',
  '那里',
  '那么',
  '那么些',
  '那么样',
  '那时',
  '那些',
  '那样',
  '乃',
  '乃至',
  '乃至于',
  '难道说',
  '呢',
  '内',
  '能',
  '能否',
  '嗯',
  '你',
  '你们',
  '您',
  '宁',
  '宁可',
  '宁肯',
  '宁愿',
  '喏',
  '哦',
  '呕',
  '啪达',
  '旁人',
  '呸',
  '譬如',
  '譬喻',
  '凭',
  '凭借',
  '其',
  '其次',
  '其二',
  '其他',
  '其它',
  '其一',
  '其余',
  '其中',
  '岂但',
  '起',
  '起见',
  '恰恰相反',
  '前此',
  '前后',
  '前者',
  '且',
  '且不说',
  '且说',
  '去',
  '全部',
  '全体',
  '却',
  '然而',
  '然后',
  '然则',
  '让',
  '人',
  '人家',
  '人们',
  '任',
  '任何',
  '任凭',
  '仍',
  '仍旧',
  '如',
  '如此',
  '如果',
  '如何',
  '如其',
  '如若',
  '如上',
  '如上所述',
  '如是',
  '如同',
  '如下',
  '若',
  '若非',
  '若夫',
  '若果',
  '若是',
  '啥',
  '上',
  '上下',
  '尚且',
  '设或',
  '设若',
  '设使',
  '谁',
  '谁料',
  '谁人',
  '谁知',
  '什么',
  '什么样',
  '甚而',
  '甚或',
  '甚么',
  '甚且',
  '甚至',
  '甚至于',
  '省得',
  '时候',
  '使',
  '使得',
  '始而',
  '似的',
  '是',
  '是的',
  '是以',
  '首先',
  '受到',
  '孰料',
  '孰知',
  '庶乎',
  '庶几',
  '顺',
  '顺着',
  '说来',
  '虽',
  '虽然',
  '虽说',
  '虽则',
  '随',
  '随后',
  '随时',
  '随着',
  '所',
  '所幸',
  '所以',
  '所有',
  '所在',
  '他',
  '他们',
  '他人',
  '它',
  '它们',
  '她',
  '她们',
  '倘',
  '倘或',
  '倘然',
  '倘若',
  '倘使',
  '傥然',
  '腾',
  '替',
  '替代',
  '通过',
  '同',
  '同时',
  '哇',
  '万一',
  '往',
  '望',
  '唯有',
  '惟其',
  '为',
  '为此',
  '为何',
  '为了',
  '为什么',
  '为着',
  '为止',
  '喂',
  '嗡',
  '嗡嗡',
  '喔唷',
  '我',
  '我们',
  '乌乎',
  '呜',
  '呜呼',
  '无',
  '无论',
  '无宁',
  '毋宁',
  '兮',
  '嘻',
  '下',
  '吓',
  '先不先',
  '相对而言',
  '向',
  '向使',
  '向着',
  '像',
  '小',
  '些',
  '嘘',
  '许多',
  '呀',
  '焉',
  '沿',
  '沿着',
  '要',
  '要不',
  '要不然',
  '要不是',
  '要么',
  '要是',
  '也',
  '也罢',
  '也好',
  '一',
  '一般',
  '一旦',
  '一方面',
  '一何',
  '一来',
  '一切',
  '一些',
  '一样',
  '一则',
  '一转眼',
  '依',
  '依据',
  '依照',
  '咦',
  '已',
  '已矣',
  '以',
  '以便',
  '以故',
  '以及',
  '以来',
  '以免',
  '以期',
  '以上',
  '以为',
  '以至',
  '以至于',
  '以致',
  '矣',
  '矣乎',
  '矣哉',
  '亦',
  '抑或',
  '因',
  '因此',
  '因而',
  '因了',
  '因为',
  '因着',
  '哟',
  '用',
  '用来',
  '由',
  '由此',
  '由此可见',
  '由是',
  '由于',
  '犹且',
  '犹自',
  '有',
  '有的',
  '有关',
  '有及',
  '有时',
  '有些',
  '又',
  '又及',
  '于',
  '于是',
  '于是乎',
  '欤',
  '余外',
  '与',
  '与此同时',
  '与否',
  '与其',
  '与其说',
  '越是',
  '云尔',
  '云云',
  '咋',
  '哉',
  '再',
  '再其次',
  '再说',
  '再有',
  '再则',
  '再者',
  '再者说',
  '在',
  '在下',
  '在于',
  '咱',
  '咱们',
  '则',
  '则甚',
  '贼死',
  '怎',
  '怎么',
  '怎么办',
  '怎么样',
  '怎奈',
  '怎样',
  '眨眼',
  '照',
  '照着',
  '者',
  '这',
  '这般',
  '这边',
  '这次',
  '这儿',
  '这个',
  '这会儿',
  '这就是说',
  '这里',
  '这么',
  '这么点儿',
  '这么些',
  '这么样',
  '这时',
  '这些',
  '这样',
  '这一来',
  '着',
  '着呢',
  '针对',
  '正巧',
  '正如',
  '正是',
  '正值',
  '之',
  '之类',
  '之所以',
  '之一',
  '吱',
  '直到',
  '只',
  '只当',
  '只怕',
  '只是',
  '只限',
  '只消',
  '只要',
  '只有',
  '至',
  '至今',
  '至若',
  '至于',
  '致',
  '诸',
  '诸如',
  '诸位',
  '逐步',
  '自',
  '自从',
  '自打',
  '自个儿',
  '自各儿',
  '自后',
  '自己',
  '自家',
  '自身',
  '综上所述',
  '总的来看',
  '总的来说',
  '总的说来',
  '总而言之',
  '总之',
  '纵',
  '纵令',
  '纵然',
  '纵使',
  '最',
  '遵循',
  '遵照',
  '作为',
  'a',
  'an',
  'the',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'for',
  'with',
  'from',
  'by',
  'is',
  'are',
  'am',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'this',
  'that',
  'these',
  'those',
  'it',
  'its',
  'at',
  'as',
  'but',
  'not',
  'so',
  'if',
  'then',
  'than',
  'too',
  'very',
  'you',
  'your',
  'we',
  'our',
  'they',
  'their',
  'he',
  'she',
  'him',
  'her',
  'them',
  'his',
  'out',
  'up',
  'down',
  'off',
  'over',
  'under',
  'again',
  'further',
  'once',
  'here',
  'there',
  'all',
  'any',
  'both',
  'each',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'nor',
  'only',
  'own',
  'same',
  's',
  't',
  'can',
  'will',
  'just',
  'don',
  'should',
  'now',
  'video',
  'mp4',
  'mkv',
  'avi',
  'mp3',
  'zip',
  'rar',
  'txt',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'pdf',
  'part',
  'hd',
  '4k',
  '1080p',
  'chc',
  'bilibili',
  'www',
  'com',
  'https',
  'http',
]);

const BASE = location.pathname.endsWith("/") ? location.pathname : location.pathname + "/";
const SHARE_MODE = /^\/s\//.test(location.pathname);
let roots = [];
let activeRoot = null;
let cur = null;
let pinned = [];
let shareRoot = null;
let shareName = "";
let shareExpires = null;
let shareVirtual = false;
// 侧边栏筛选/排序/搜索状态（不重新请求，基于 currentEntries 过滤重渲染）
let currentEntries = [];   // 当前目录完整 entries（含 meta.kind），筛选/排序/搜索的数据源
let sortBy = "mtime";      // mtime | name | size（当前排序字段）
let sortDir = -1;          // 相对默认方向的偏移：与默认方向同向为 1，反向为 -1
let searchQuery = "";      // 搜索关键词（匹配文件名）
let customExts = "";       // 自输入后缀（逗号分隔，如 md,txt,json）
let searchMetaMode = false; // false=仅按文件名搜索；true=文件名+元数据内容搜索
let sidebarOpen = false;   // 侧边栏开合状态

const $ = (id) => document.getElementById(id);

function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2500); }
function fmtSize(n) {
  if (n === null || n === undefined) return "";
  n = Number(n);
  if (!Number.isFinite(n) || n < 0) return "";   // 防 NaN/Infinity/负值等异常数据
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
const IMAGE_EXT = ["jpg","jpeg","png","gif","webp","bmp","svg","ico","tif","tiff","avif","heic"];
const MD_EXT = ["md","markdown"];
const TEXT_EXT = ["txt","log","json","js","ts","jsx","tsx","py","java","c","cpp","h","hpp","cs","go","rs","php","rb","sh","bat","ps1","html","htm","css","scss","xml","yaml","yml","toml","ini","conf","cfg","csv","sql","env","gitignore"];  // svg 已移出：归图片预览
const ARCHIVE_EXT = ["zip"];
function extOf(name) {
  const i = String(name).lastIndexOf(".");
  return i < 0 ? "" : String(name).slice(i + 1).toLowerCase();
}
function fileKind(name) {
  const e = extOf(name);
  if (VIDEO_EXT.indexOf(e) >= 0) return "video";
  if (IMAGE_EXT.indexOf(e) >= 0) return "image";   // 图片优先（svg 原在 TEXT_EXT，现归图片预览）
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
/**
 * 通用「可取消异步预览弹窗」骨架：详情/文本/解压/CSV/lnk 五个预览弹窗共用。
 * 统一处理：建 body + loading 节点 + openModal + 中断上一个预览请求 + 取消按钮，
 * 以及 AbortError / 加载失败的统一错误展示（与原各函数手写样板行为一致）。
 * @param {string} title 弹窗标题（通常是文件名）
 * @param {object} state openModal 的 modalState（刷新恢复用）
 * @param {string} [loadingText] loading 附加提示（可选）
 * @param {(ctx: { body: HTMLElement, ac: AbortController, cancelled: () => boolean }) => Promise<void>} loader
 *   请求用 api(url, { signal: ac.signal })；AbortError / 其它异常由本函数统一展示；
 *   分片渲染中断可轮询 cancelled()。
 */
function openPreviewModal(title, state, loadingText, loader) {
  const body = document.createElement("div");
  const ld = loadingNodeCancel(loadingText || "");
  body.appendChild(ld.node);
  openModal(title, body, state);
  const ac = new AbortController();
  if (_activePreviewAbort) _activePreviewAbort.abort();
  _activePreviewAbort = ac;
  let cancelled = false;
  ac.signal.addEventListener("abort", () => {
    cancelled = true;
    // 渲染阶段（loading 节点已移除）取消：清掉半截内容，显示"已取消"
    if (!body.contains(ld.node)) body.innerHTML = '<p class="muted small">已取消加载</p>';
  });
  ld.btn.onclick = () => ac.abort();
  (async () => {
    try {
      await loader({ body, ac, cancelled: () => cancelled });
    } catch (e) {
      if (e && e.name === "AbortError") {
        body.innerHTML = '<p class="muted small">已取消加载</p>';
      } else {
        body.innerHTML = '<p class="muted">加载失败: ' + esc(e && e.message) + "</p>";
      }
    }
  })();
  return { body, ac };
}
// ==================== T11 全屏预览层（方案A：弹窗内 ⛶ 放大；为方案B /view 独立页铺路） ====================
// 全屏层与 modal 完全解耦：固定定位 + 深色底 + 控制条；内容节点移入移出不重建（视频进度/文本滚动保留）。
let fsOpen = false;     // 全屏层是否打开
let fsPushed = false;   // 是否已 push 浏览器历史（手机返回键/浏览器后退退出全屏）

// 打开全屏：把核心内容节点移入全屏层，push 一条历史（返回键优先关全屏再关弹窗）
function openFullscreen({ title, node, downloadUrl }) {
  if (fsOpen || !node) return;
  fsOpen = true;
  node._fsHome = node.parentNode;        // 记录原父容器，退出时移回
  $("fsTitle").textContent = title;
  const dlSlot = $("fsBarDl");
  dlSlot.innerHTML = "";
  if (downloadUrl) {
    const d = document.createElement("a");
    d.className = "btn btn-sm btn-outline-light fs-dl";
    d.href = downloadUrl;
    d.textContent = "⬇ 下载";
    dlSlot.appendChild(d);
  }
  $("fsBody").appendChild(node);         // 移动 DOM：视频播放/文本滚动不中断
  // 视频保险：移动后恢复进度与播放状态（个别浏览器移动节点会闪断）
  const v = node.querySelector ? node.querySelector("video") : null;
  if (v) {
    const wasPlaying = !v.paused;
    const t = v.currentTime;
    requestAnimationFrame(() => {
      v.currentTime = t;
      if (wasPlaying && v.paused) v.play().catch(() => { /* 自动播放被拒时忽略 */ });
    });
  }
  fsLayer.classList.add("show");
  if (!fsPushed) { try { history.pushState({ fs: 1 }, ""); fsPushed = true; } catch (e) { /* 忽略 */ } }
}

// 关闭全屏：内容移回原弹窗；fromPop=true 表示返回键已 back 完成（不再重复 back）
function closeFullscreen(fromPop) {
  if (!fsOpen) return;
  fsOpen = false;
  fsLayer.classList.remove("show");
  const node = $("fsBody").firstElementChild;
  if (node) {
    if (node._fsHome && document.body.contains(node._fsHome)) node._fsHome.appendChild(node);
    else node.remove();
  }
  $("fsBody").innerHTML = "";
  $("fsBarDl").innerHTML = "";
  if (fsPushed) {
    fsPushed = false;
    if (!fromPop) { try { history.back(); } catch (e) { /* 忽略 */ } }
  }
}

// 预览弹窗内容顶部加"⛶ 放大"按钮（getNode 惰性取核心节点，适配异步渲染的弹窗）
function addFsButton(body, title, getNode, downloadUrl) {
  const row = document.createElement("div");
  row.className = "d-flex justify-content-end mb-2";
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn btn-sm btn-outline-secondary";
  b.textContent = "⛶ 放大";
  b.title = "全屏放大预览（Esc 退出）";
  b.onclick = () => {
    const node = getNode();
    if (node) openFullscreen({ title, node, downloadUrl });
  };
  row.appendChild(b);
  body.insertBefore(row, body.firstChild);
  return row;
}

// Esc 退出全屏（优先级高于弹窗/多选/侧边栏）；手机返回键经 popstate 退出
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && fsOpen) closeFullscreen(false);
});
window.addEventListener("popstate", () => {
  if (fsOpen) closeFullscreen(true);   // 返回键已完成 back，只关层不重复 back
});
$("fsClose").onclick = () => closeFullscreen(false);

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
  openPreviewModal(name, { type: "detail", path, name }, null, async ({ body, ac }) => {
  const j = await api("api/stat?path=" + encodeURIComponent(path), { signal: ac.signal });
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
  else if (fk === "image") btns.appendChild(mkBtn("🖼 图片预览", () => showImage(j.path, j.name)));
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
  addFsButton(body, name, () => body.querySelector(".detail-tbl"), dlUrl(path));   // ⛶ 全屏放大详情
  });
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
  addFsButton(body, name, () => wrap, dlUrl(path));   // ⛶ 全屏放大（视频进度保留）
  const v = document.createElement("video");
  v.controls = true;
  v.playsinline = true;
  v.setAttribute("webkit-playsinline", ""); // 老 iOS 兼容：同 playsinline，禁止全屏自动拉起
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
    const hm = line.match(/^(#{1,6})\s+(.*)$/);   // 标题（h1~h6 全支持）
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
  openPreviewModal(name, { type: "text", path, name }, "文件较大，可能需要一点时间", async ({ body, ac, cancelled }) => {
  const j = await api("api/read?path=" + encodeURIComponent(path), { signal: ac.signal });
  if (cancelled()) return;
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
      fillTextChunked(codeEl, text, 32768, () => cancelled());
    }
  } else {
    // 纯文本：分片渲染，块间让出主线程，用户随时可点 ×/取消
    const pre = document.createElement("pre");
    pre.className = "text-pre";
    holder.appendChild(pre);
    fillTextChunked(pre, text, 32768, () => cancelled());
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
  addFsButton(body, name, () => body.querySelector(".text-pre, .md-code") && body.querySelector(".text-pre, .md-code").parentElement, dlUrl(path));   // ⛶ 全屏放大文本
  });
}

// ---------------- 功能 4：压缩包在线解压 ----------------
async function showUnpack(path, name) {
  openPreviewModal(name, { type: "unpack", path, name }, null, async ({ body, ac }) => {
  const j = await api("api/unpack?path=" + encodeURIComponent(path), { signal: ac.signal });
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
  addFsButton(body, name, () => body.querySelector(".unpack-list"), dlUrl(path));   // ⛶ 全屏放大解压列表
  });
}

async function api(ep, opt) {
  const r = await fetch(BASE + ep, opt);
  return r.json();
}

function hideMainUi() {
  if ($("packGroup")) $("packGroup").classList.add("d-none");
  if ($("uploadBtn")) $("uploadBtn").classList.add("d-none");
  if ($("driveTabs")) $("driveTabs").classList.add("d-none");
  if ($("pinnedCard")) $("pinnedCard").classList.add("d-none");
  if ($("packPanel")) $("packPanel").classList.add("d-none");
  if ($("packMiniBar")) $("packMiniBar").classList.add("d-none");
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
    syncViewBtns();
    let start = shareVirtual ? "" : shareRoot;
    try { start = new URLSearchParams(location.search).get("path") || start; } catch (e) { /* 忽略 */ }
    await loadList(start);
    return;
  }
  const info = await api("api/info");
  roots = info.roots || [];
  pinned = info.pinned || [];
  infoUrls = Array.isArray(info.urls) ? info.urls : [];
  infoUrlsHttp = Array.isArray(info.urls_http) ? info.urls_http : [];
  renderDriveTabs();
  renderPinned();
  // ---- 恢复视图模式与上次目录（功能 2：刷新不丢状态） ----
  view = loadLS("drive.view") === "grid" ? "grid" : "list";
  syncViewBtns();
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
  // 置顶非空时才显示「全部清空」（任何提前 return 之前先同步显隐）
  $("clearPinBtn").classList.toggle("d-none", !pinned.length);
  // 折叠头文案：N 项 + 非目录项大小总和（有目录时补"含目录"）
  const n = pinned.length;
  let total = 0, hasDir = false;
  pinned.forEach(p => { if (p.is_dir) hasDir = true; else total += (p.size || 0); });
  const sizeTxt = n ? fmtSize(total) + (hasDir ? " · 含目录" : "") : "—";
  $("pinnedHeadTitle").textContent = "📌 置顶文件 · " + n + " 项 · 共 " + sizeTxt;
  const pinnedFolded = $("pinnedList").classList.contains("pinned-fold");
  $("pinnedChevron").textContent = pinnedFolded ? "▶" : "▼";
  $("pinnedHead").setAttribute("aria-expanded", String(!pinnedFolded));
  $("pinCount").textContent = n + " 个";
  if (!pinned.length) { box.innerHTML = '<div class="empty" style="padding:14px 0">暂无置顶文件</div>'; return; }
  box.innerHTML = "";
  pinned.forEach(p => {
    const row = document.createElement("div");
    row.className = "prow d-flex align-items-center gap-2 py-2";
    row.innerHTML =
      '<span class="flex-shrink-0"><img src="' + (p.is_dir ? BASE + "static/icons/folder.svg" : iconUrl(p.name)) + '" width="18" height="18" alt="" style="vertical-align:-3px"></span>' +
      '<span class="pname flex-grow-1 text-truncate">' + esc(p.name) + "</span>" +
      '<span class="psize text-muted small flex-shrink-0 d-none d-sm-block">' + fmtSize(p.size) + "</span>" +
      '<button class="btn btn-outline-secondary btn-sm flex-shrink-0" data-a="share" title="分享">🔗<span class="d-none d-sm-inline"> 分享</span></button>' +
      '<button class="btn btn-outline-secondary btn-sm flex-shrink-0" data-a="dl" title="下载">⬇<span class="d-none d-sm-inline"> 下载</span></button>' +
      '<button class="btn btn-outline-secondary btn-sm flex-shrink-0" data-a="unpin" title="取消置顶">✕<span class="d-none d-sm-inline"> 取消</span></button>';
    row.querySelector('[data-a="share"]').onclick = () => showShareDialog(p.path, p.name);
    row.querySelector('[data-a="dl"]').onclick = () => { location.href = dlUrl(p.path); };
    row.querySelector('[data-a="unpin"]').onclick = async () => {
      await api("api/pin?add=0&path=" + encodeURIComponent(p.path));
      pinned = pinned.filter(x => x.path !== p.path);
      renderPinned();   // 列表行无星标，无需 loadList(cur) 整目录重载（t9 修闪烁/回顶）
    };
    box.appendChild(row);
  });
}

// 置顶折叠头：点击展开/收起（chevron + aria-expanded 同步）
$("pinnedHead").onclick = () => {
  const box = $("pinnedList");
  const fold = box.classList.toggle("pinned-fold");
  $("pinnedChevron").textContent = fold ? "▶" : "▼";
  $("pinnedHead").setAttribute("aria-expanded", String(!fold));
};
// 键盘可达：role="button" 语义要求 Enter / Space 等效点击（tabindex 见 index.html）
$("pinnedHead").onkeydown = (ev) => {
  if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); $("pinnedHead").click(); }
};

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
    // acc 拼接与后端 os.path.join 一致（单反斜杠分隔）：
    // i=0 首段带尾斜杠（F:\）；后续段仅在缺分隔符时补一个反斜杠，
    // 保证任意层级（2 层 / 3 层 / 深层）下最后一段 acc === cur 都成立，
    // 从而末级目录只由 last 高亮渲染一次（修复重复显示 + 深层路径断连）
    if (i === 0) acc = part + "\\";
    else acc += (acc.endsWith("\\") ? "" : "\\") + part;
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

// ---------------- 侧边栏：视图切换 / 类型筛选 / 排序 / 搜索 ----------------
// 类型判定：基于 api/list?meta=1 返回的 meta.kind（video/text/code/exe/archive/lnk/dir）
function entryKindMatch(e, key) {
  const k = e.meta && e.meta.kind;
  switch (key) {
    case "video": return k === "video";
    case "text": return k === "text";
    case "code": return k === "code";
    case "exe": return k === "exe";
    case "archive": return k === "archive";
    case "lnk": return k === "lnk";
    case "dir": return !!e.is_dir;
    default: return false;
  }
}
// 自输入后缀解析：兼容带点/不带点、大小写、逗号分隔
function parseCustomExts() {
  return customExts.split(",").map(s => s.trim().replace(/^\.+/, "").toLowerCase()).filter(Boolean);
}
// 搜索文本统一归一化：先 normalizeCJK 做简/繁/日式新字体归一，再转小写（英文大小写不敏感）。
// normalizeCJK 对非汉字原样保留，可直接用于整串归一化；库未加载时退化为仅小写（搜索仍可用）。
function normSearch(s) {
  s = String(s == null ? "" : s);
  if (typeof normalizeCJK === "function") s = normalizeCJK(s);
  return s.toLowerCase();
}
// 元数据内容搜索白名单：只匹配"具体内容"字段，排除 kind/mime/duration/resolution/upload/views/likes/tech
// 等技术标识或数值统计字段（这些字段名/值很容易在每个文件里重复出现，匹配没有意义）。
const META_CONTENT_KEYS = ["title","author","type","tags","notes","extra",
                           "track","album","artist","genre","comment","description","captions","lyrics"];
function collectMetaValue(v, out) {
  if (typeof v === "string") out.push(v);
  else if (typeof v === "number" || typeof v === "boolean") out.push(String(v));
  else if (Array.isArray(v)) v.forEach(x => collectMetaValue(x, out));
  else if (v && typeof v === "object") Object.keys(v).forEach(k => collectMetaValue(v[k], out));
}
// 只收集白名单键的内容文本（字符串/数组逐项/对象取属性值），tags 里的实际标签值、notes/extra 均在此列
function metaContentTexts(m) {
  const out = [];
  if (m && typeof m === "object") META_CONTENT_KEYS.forEach(k => collectMetaValue(m[k], out));
  return out;
}
// 收集 entry 可搜索文本：
//  - 文件名模式（默认）：只匹配 e.name
//  - 元数据模式：e.name + meta 白名单内容字段（title/author/type/tags/notes/extra 等，
//    不含 kind/mime/upload/views/likes 这类技术/统计字段，也不含 tech/duration/resolution）
function entrySearchText(e) {
  const parts = [e.name];
  if (searchMetaMode) parts.push(...metaContentTexts(e.meta));
  return parts.map(normSearch);
}
// ============================================================================
// 推荐标签：文件名+元数据关键词自动提取（异步增量统计，Top10 渐出）
// ============================================================================
const TAG_BATCH = 20;      // 每批处理文件数（分批让出主线程，避免卡列表渲染）
const TAG_TOP_N = 10;      // 推荐标签个数
const TAG_MIN_LEN = 2;     // 词条长度下限
const TAG_MAX_LEN = 20;    // 词条长度上限
// 常见文件扩展名不做标签（文件名结构性后缀，避免 mp4/mkv 之类霸榜）
const TAG_EXT_NONWORDS = ["mp4","webm","ogv","ogg","m4v","mov","mkv","avi","ts","flv","wmv","m2ts","mkv3","md","markdown","txt","log","json","js","ts","jsx","tsx","py","java","c","cpp","h","hpp","cs","go","rs","php","rb","sh","bat","ps1","html","htm","css","scss","xml","yaml","yml","toml","ini","conf","cfg","csv","sql","svg","env","gitignore","zip","rar","7z","gz","xz","tar","pdf","lnk","exe","msi","iso","img","torrent","nfo","srt","ass","lrc","wav","flac","aac","ape","woff","woff2","ttf","otf","ico","bmp","webm","doc","docx","xls","xlsx","ppt","pptx"];
// 文本分片：CJK 连续段作为一个整体 chunk（如"北京冬奥"）；非 CJK（英文/数字）按连续字母数字切词（空格/标点自然分隔）
function splitChunks(s) {
  const out = [];
  const re = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+|[A-Za-z0-9]+/g;
  let m;
  while ((m = re.exec(s)) !== null) out.push(m[0]);
  return out;
}
function isCJKChunk(c) { return /^[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+$/.test(c); }
// 噪声词过滤：纯数字 / 版本号(1.2.3, v1) / 日期(2022-05-01) / 常见扩展名
function isTagNoiseWord(w) {
  if (/^\d+$/.test(w)) return true;
  if (/^\d+(\.\d+)+$/.test(w)) return true;
  if (/^v\d+$/i.test(w)) return true;
  if (/^\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日号]?$/.test(w)) return true;
  if (TAG_EXT_NONWORDS.indexOf(w) >= 0) return true;
  return false;
}
// 【可复用接口（供标签推荐/后续模糊匹配共用）】文本→关键词条：
//  - texts: 归一化文本数组（文件名/标题/作者/备注等）
//  - tags: 元数据完整标签数组（整体作为独立词条、不做 n-gram）
//  - 返回 Map<词, 1>：词条权重统一为 1（文件内去重，同词只记 1 次），
//    外层按"出现该词的文件数"计分——每个文件对某标签最多贡献 1
function extractKeywords(texts, tags) {
  const map = new Map();
  const add = (w) => {
    if (w.length < TAG_MIN_LEN || w.length > TAG_MAX_LEN) return;
    if (STOPWORDS.has(w)) return;
    if (isTagNoiseWord(w)) return;
    if (!map.has(w)) map.set(w, 1); // 文件内去重：同词在该文件只保留 1 次
  };
  (texts || []).forEach(t => {
    splitChunks(String(t)).forEach(chunk => {
      if (isCJKChunk(chunk)) { // CJK 段 bigram 分词（如"北京冬奥"→ 北京/京冬/冬奥），长度<2 无产物
        const seen = new Set();
        for (let i = 0; i + 2 <= chunk.length; i++) {
          const g = chunk.slice(i, i + 2);
          if (seen.has(g)) continue;
          seen.add(g);
          add(g);
        }
      } else {
        add(chunk); // 英文/数字整词保留（长度≥2）
      }
    });
  });
  (tags || []).forEach(t => { if (t) add(String(t)); }); // tags 完整标签整体作为词条，不加权
  return map;
}
// 收集单个 entry 的标签文本源：文件名+标题+作者+备注（tags 单独走完整词条）
function entryTagTexts(e) {
  const m = e.meta || {};
  const texts = [e.name, m.title, m.author];
  if (Array.isArray(m.notes)) texts.push(...m.notes);
  else if (typeof m.notes === "string" && m.notes) texts.push(m.notes);
  const tags = Array.isArray(m.tags) ? m.tags : (m.tags ? [m.tags] : []);
  return { texts: texts.filter(Boolean), tags };
}
// 异步增量统计：每批 TAG_BATCH 个文件，批间 setTimeout(0) 让出主线程；每批后重渲染 Top10（渐出）
let _tagScanToken = 0;     // 扫描令牌：重新扫描/目录切换时递增，使旧扫描的后续批次失效
let _tagScanState = null;  // 进行中的扫描 { token, path, st, idx }
let _tagScanTimer = null;
const _tagCache = new Map(); // path -> { scores: Map<词, 出现文件数>, done, total, complete }
function tagScanReset() {
  _tagScanToken++;
  if (_tagScanTimer) { clearTimeout(_tagScanTimer); _tagScanTimer = null; }
  _tagScanState = null;
}
function startTagScan() {
  // 虚拟分享/空目录：currentEntries 为空时静默不扫描，显示空态
  if (!currentEntries.length) { tagScanReset(); tagRenderEmpty(); return; }
  const path = cur;
  let st = _tagCache.get(path);
  if (!st) {
    st = { scores: new Map(), done: 0, total: currentEntries.length, complete: false, path };
    _tagCache.set(path, st);
  }
  if (st.complete) { tagScanReset(); tagRenderTop(st); return; } // 已有统计结果，无需重复全量扫描
  tagScanReset();
  _tagScanState = { token: _tagScanToken, path, st, idx: st.done };
  tagScanStep(_tagScanToken);
}
function tagScanStep(token) {
  const s = _tagScanState;
  if (!s || s.token !== token) return; // 已被新扫描取代
  const st = s.st;
  if (!currentEntries.length || st.path !== cur) { tagScanReset(); tagRenderEmpty(); return; }
  const end = Math.min(s.idx + TAG_BATCH, st.total);
  for (let i = s.idx; i < end; i++) {
    const e = currentEntries[i];
    if (!e) continue;
    const { texts, tags } = entryTagTexts(e);
    extractKeywords(texts.map(normSearch), tags.map(normSearch)).forEach((wgt, w) => {
      st.scores.set(w, (st.scores.get(w) || 0) + wgt); // score=出现该词的文件数（文件级去重已由 extractKeywords 保证，每文件最多贡献 1）
    });
  }
  st.done = end;
  s.idx = end;
  if (end >= st.total) {
    st.complete = true;
    _tagScanState = null;
    tagRenderDone(st);
    tagRenderTop(st); // 扫描完成：显示 Top10
    return;
  }
  tagRenderProgress(st); // 渐出：每批处理完更新一次 Top10 与进度
  tagRenderTop(st);
  _tagScanTimer = setTimeout(() => tagScanStep(token), 0); // 让出主线程
}
// Top10：score 降序，同分按词排序（稳定）
function tagTopWords(st) {
  const arr = [];
  st.scores.forEach((score, word) => arr.push({ word, score }));
  arr.sort((a, b) => b.score === a.score ? (a.word < b.word ? -1 : a.word > b.word ? 1 : 0) : b.score - a.score);
  return arr.slice(0, TAG_TOP_N);
}
function tagRenderTop(st) {
  const box = $("tagSuggest");
  if (!box) return;
  const top = tagTopWords(st);
  if (!top.length) { box.innerHTML = '<span class="text-muted small">暂无推荐标签</span>'; return; }
  box.innerHTML = "";
  top.forEach(t => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tag-chip";
    b.title = "点击加入搜索 · 出现于 " + t.score + " 个文件";
    b.innerHTML = esc(t.word) + '<span class="score">' + t.score + "</span>";
    b.onclick = ev => tagApplyTag(ev, t.word);
    box.appendChild(b);
  });
}
function tagRenderProgress(st) {
  const hint = $("tagHint");
  if (hint) hint.textContent = "分析中… 已处理 " + st.done + "/" + st.total + " 个文件";
}
function tagRenderDone(st) {
  const hint = $("tagHint");
  if (hint) hint.textContent = st.total > 0 ? "扫描完成，共 " + st.total + " 个文件" : "";
}
function tagRenderEmpty() {
  const box = $("tagSuggest");
  if (box) box.innerHTML = '<span class="text-muted small">暂无推荐标签</span>';
  const hint = $("tagHint");
  if (hint) hint.textContent = "";
}
// 点击标签：追加到搜索框（空格连接）并触发现有过滤；pulse 视觉反馈。
// 注意：标签含 / & ， 等字符时原样填入，会按查询语法解释为 OR/AND 分隔（预期行为，不做转义；空格仍作 AND）。
function tagApplyTag(ev, word) {
  const input = $("searchInput");
  const curVal = input.value.trim();
  input.value = curVal ? curVal + " " + word : word;
  searchQuery = input.value;
  // 推荐标签来自元数据内容统计，点击标签时应自动开启"深度查找"（文件名+元数据搜索），
  // 否则标签若只出现在元数据里、文件名不含时，精确子串阶段会查不到结果。
  if (!$("searchMetaToggle").checked) {
    $("searchMetaToggle").checked = true;
    searchMetaMode = true;
    $("searchInput").placeholder = searchMetaMode ? "按文件名或元数据搜索…" : "按文件名搜索…";
  }
  renderEntries();
  if (ev && ev.currentTarget) {
    const el = ev.currentTarget;
    el.classList.add("pulse");
    setTimeout(() => el.classList.remove("pulse"), 260);
  }
  input.focus();
}
// ============================================================================
// 模糊匹配核心（纯函数，无 DOM 依赖，可 node 单测）。
// 归一化（简繁/大小写）由调用方在源文本上完成，本区段只处理归一后的字符合串。
// 方向性：LCS(kw, target) 中 kw 缺字时 target 是 kw 的子序列，LCS 天然覆盖"缺字"。
// ============================================================================
const FUZZY_SCORE_MIN = 0.8;   // 概率 ≥ 0.8 判定为匹配
const FUZZY_MULTI_MIN = 0.8;   // 硬性字符约束：多集覆盖率下限（防全错字）
const FUZZY_PRESCREEN = 0.6;   // 预筛阈值：多集覆盖率 < 0.6 直接判不匹配（字符都不齐必不中）
const FUZZY_TARGET_MAX = 200;  // 超长文本截断长度（meta 大段 notes 等），限制 O(n·m) 计算量
const FUZZY_PERM_WMIX = 0.6;   // s_perm 中 s_multi 的权重（1-权重 给 max(s_lcs, s_edit)）：
                               // 调研原案为 0.5/0.5 且顺序约束取 min(s_lcs, s_edit)，但该组合下
                               // ①"猫狗vs狗猫"得 0.75 < 0.8，与验收断言冲突；
                               // ②乱序+后缀（如"约里.mp4"vs"里约"）时滑窗 DL 被窗口额外字符
                               //   惩罚到 0，min 取到 0 使乱序加权失效，文件名后缀场景漏匹配。
                               // 0.6/0.4 + max：2 字完全乱序恰好 0.8 过线，3 字以上完全乱序不过线
// 字符多集覆盖率：kw 各字符在 target 中可被消耗的次数 / len(kw)（乱序上限约束；0.8 硬约束由判定方强制）
function multisetCoverage(kw, target) {
  const n = kw.length;
  if (!n) return 1;
  if (!target) return 0;
  const counts = new Map();
  for (const ch of target) counts.set(ch, (counts.get(ch) || 0) + 1);
  let hit = 0;
  for (const ch of kw) {
    const c = counts.get(ch) || 0;
    if (c > 0) { hit++; counts.set(ch, c - 1); }
  }
  return hit / n;
}
// 最长公共子序列长度（DP 滚动数组，O(n·m)）：隔开（子序列）+ 缺字（target 是 kw 子序列）统一覆盖
function lcsLength(a, b) {
  const n = a.length, m = b.length;
  if (!n || !m) return 0;
  let prev = new Uint32Array(m + 1);
  let cur = new Uint32Array(m + 1);
  for (let i = 1; i <= n; i++) {
    const ai = a[i - 1];
    for (let j = 1; j <= m; j++) {
      if (ai === b[j - 1]) cur[j] = prev[j - 1] + 1;
      else cur[j] = prev[j] > cur[j - 1] ? prev[j] : cur[j - 1];
    }
    const t = prev; prev = cur; cur = t;
    cur[0] = 0;
  }
  return prev[m];
}
// Damerau-Levenshtein 距离（含相邻转位；滚动两行版，O(n·m)）
function damerauLevenshtein(a, b) {
  const n = a.length, m = b.length;
  if (!n) return m;
  if (!m) return n;
  let prev2 = new Uint32Array(m + 1);
  let prev1 = new Uint32Array(m + 1);
  let cur = new Uint32Array(m + 1);
  for (let j = 0; j <= m; j++) prev1[j] = j;
  for (let i = 1; i <= n; i++) {
    cur[0] = i;
    const ai = a[i - 1];
    for (let j = 1; j <= m; j++) {
      const cost = ai === b[j - 1] ? 0 : 1;
      let v = Math.min(cur[j - 1] + 1, prev1[j] + 1, prev1[j - 1] + cost);
      if (i > 1 && j > 1 && ai === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1); // 相邻转位
      }
      cur[j] = v;
    }
    prev2 = prev1; prev1 = cur; cur = new Uint32Array(m + 1);
  }
  return prev1[m];
}
// 滑窗编辑相似度：窗口宽 = len(kw)+2（容差 2，覆盖插入/错字/相邻转位），在 target 上取全串最小 DL
function fuzzyEditScore(kw, target) {
  const n = kw.length;
  if (!n) return 1;
  const m = target.length;
  if (!m) return 0;
  const win = Math.min(n + 2, m);
  let best = n;
  for (let i = 0; i + win <= m; i++) {
    const d = damerauLevenshtein(kw, target.slice(i, i + win));
    if (d < best) {
      best = d;
      if (best === 0) break;
    }
  }
  return 1 - best / n;
}
// 单关键词模糊打分（0..1，供测试/展示；正式判定用 fuzzyMatchKw）：
//   s_lcs   = LCS(kw,target)/len(kw)                    —— 隔开+缺字
//   s_edit  = 1 - 滑窗DL(kw,target)/len(kw)             —— 错字+相邻转位
//   s_multi = 多集覆盖率                                  —— 乱序上限约束
//   s_perm  = WMIX·s_multi + (1-WMIX)·max(s_lcs,s_edit) —— 乱序加权（需部分顺序约束；
//             max 取 LCS/滑窗编辑的互补证据，避免后缀/插入使只 s_edit 崩坏拖累乱序加权）
//   final   = max(s_lcs, s_edit, s_perm)；精确子串恒为 1.0
function fuzzyScore(kw, target) {
  if (!kw) return 1;
  if (!target) return 0;
  if (target.includes(kw)) return 1; // 精确子串 = 100%
  const n = kw.length;
  const t = target.length > FUZZY_TARGET_MAX ? target.slice(0, FUZZY_TARGET_MAX) : target;
  const sMulti = multisetCoverage(kw, t);
  if (sMulti < FUZZY_PRESCREEN) return 0; // 预筛：字符都不齐必不中
  const sLcs = lcsLength(kw, t) / n;
  const sEdit = fuzzyEditScore(kw, t);
  const sPerm = FUZZY_PERM_WMIX * sMulti + (1 - FUZZY_PERM_WMIX) * Math.max(sLcs, sEdit);
  return Math.max(sLcs, sEdit, sPerm);
}
// 判定：final ≥ 0.8 且 多集覆盖率 ≥ 0.8（硬性字符约束，防全错字）。
// 阶段短路：预筛(<0.6) → 字符硬约束(<0.8) → LCS 达标 → 滑窗编辑达标 → 乱序加权达标。
function fuzzyMatchKw(kw, target) {
  if (!kw) return true;
  if (!target) return false;
  if (target.includes(kw)) return true;
  const n = kw.length;
  const t = target.length > FUZZY_TARGET_MAX ? target.slice(0, FUZZY_TARGET_MAX) : target;
  const sMulti = multisetCoverage(kw, t);
  if (sMulti < FUZZY_PRESCREEN) return false; // 预筛短路
  if (sMulti < FUZZY_MULTI_MIN) return false; // 硬性字符约束
  const sLcs = lcsLength(kw, t) / n;
  if (sLcs >= FUZZY_SCORE_MIN) return true;   // 隔开/缺字已达标
  const sEdit = fuzzyEditScore(kw, t);
  if (sEdit >= FUZZY_SCORE_MIN) return true;  // 错字/转位已达标
  const sPerm = FUZZY_PERM_WMIX * sMulti + (1 - FUZZY_PERM_WMIX) * Math.max(sLcs, sEdit);
  return sPerm >= FUZZY_SCORE_MIN;            // 乱序加权
}
// 多组 OR 判定：任一组内所有 kw 均至少命中一个文本部件（对应 entrySearchText 的搜索模式）。
// groups 由 parseQuery 统一解析（[{and:[词,...]},...]），精确/模糊两阶段共用同一语义。
function fuzzyMatchTexts(groups, texts) {
  return groups.some(g => g.and.every(kw => {
    for (let i = 0; i < texts.length; i++) {
      if (fuzzyMatchKw(kw, texts[i])) return true;
    }
    return false;
  }));
}
// ===== 模糊匹配核心结束 =====
// 硬筛选（不含搜索词）：类型多选(OR) + 自输入后缀(OR)。
// 两阶段搜索共用：精确阶段与模糊阶段基于同一候选集，保证两者结果一致且不重复。
function applyHardFilters(entries) {
  const types = [];
  document.querySelectorAll("#typeFilters input[type=checkbox]:checked").forEach(cb => {
    types.push(cb.getAttribute("data-type"));
  });
  const exts = parseCustomExts();
  let out = entries;
  if (types.length || exts.length) {
    out = out.filter(e =>
      types.some(t => entryKindMatch(e, t)) || exts.some(x => extOf(e.name) === x));
  }
  return out;
}
// 查询解析：输入为已归一化（normSearch）的查询串，输出 [{and:[词1,词2,...]}, ...]。
//  - OR 分隔符：, ， | /（切分成多组，任一组命中即匹配）
//  - AND 分隔符：空格 与 &（组内所有词须全部命中）
//  - 连续/混合分隔符取并集效果（如 "a,,b" 视为 a OR b）；空词自动过滤
//  - 注意：/ 在文件名中常见，但按用户要求在此统一视为 OR 分隔符
function parseQuery(q) {
  const groups = [];
  String(q || "").split(/[，,|/]/).forEach(seg => {
    const and = seg.split(/[\s&]+/).filter(Boolean);
    if (and.length) groups.push({ and });
  });
  return groups;
}
// 过滤管道：硬筛选 + 搜索词精确子串（多组 OR，组内 AND，匹配文件名+meta 元信息）。
// 第一阶段（同步）只做精确子串；概率模糊匹配由 startFuzzyPass 异步补充。
// groups: parseQuery 结果，由 renderEntries 统一解析后传入（精确/模糊两阶段共用同一解析）。
function filterEntries(entries, groups) {
  let out = applyHardFilters(entries);
  if (groups && groups.length) {
    out = out.filter(e => {
      const haystack = entrySearchText(e).join("\n");
      return groups.some(g => g.and.every(t => haystack.indexOf(t) >= 0));
    });
  }
  return out;
}
// 排序：三种排序均支持升/降双向。DEFAULT_SORT_DIR 为各字段默认符号（mtime -1 新→旧/name 1 升序/size -1 大→小），
// sortDir 是乘在"升序比较器"上的符号系数（默认取 DEFAULT_SORT_DIR，反转时取反），"再次点击同一排序项"即翻转方向。
const DEFAULT_SORT_DIR = { mtime: -1, name: 1, size: -1 };
// 下拉 option 文本（索引 0=sortDir<0 降序，1=sortDir>0 升序），updateSortLabel 按当前实际方向动态更新
const SORT_LABELS = {
  mtime: ["修改时间（新 → 旧）", "修改时间（旧 → 新）"],
  name: ["名称（Z → A）", "名称（A → Z）"],
  size: ["大小（大 → 小）", "大小（小 → 大）"],
};
function updateSortLabel() {
  const sel = $("sortSelect");
  for (const o of sel.options) {
    const labels = SORT_LABELS[o.value];
    if (!labels) continue;
    if (o.value === sortBy) {
      o.text = labels[sortDir > 0 ? 1 : 0]; // 当前项显示实际方向
    } else {
      o.text = labels[DEFAULT_SORT_DIR[o.value] > 0 ? 1 : 0]; // 非当前项显示其默认方向
    }
  }
}
// 条目比较器（目录永远排前，不随方向翻转）：sortEntries（全量）与模糊插入二分（单点）共用，
// 保证渐进插入的模糊命中条目与同步渲染结果按同一规则排序。
function entryCompare(a, b) {
  const dir = sortDir || 1;
  if (sortBy === "name") {
    return ((b.is_dir ? 1 : 0) - (a.is_dir ? 1 : 0)) ||
                        dir * String(a.name).localeCompare(String(b.name), "zh-Hans-CN");
  } else if (sortBy === "size") {
    return ((b.is_dir ? 1 : 0) - (a.is_dir ? 1 : 0)) || dir * ((a.size || 0) - (b.size || 0));
  }
  return ((b.is_dir ? 1 : 0) - (a.is_dir ? 1 : 0)) || dir * ((a.mtime || 0) - (b.mtime || 0));
}
// 排序（原地）：各字段先按"升序"计算再乘 sortDir（mtime: -1 新→旧；name: ±1；size: -1 大→小）。
function sortEntries(list) {
  list.sort(entryCompare);
}
// 统一渲染入口：从 currentEntries 过滤 → 排序 → 渲染（不再重新请求）。
// 两阶段搜索：
//   阶段一（同步立即）：精确子串过滤（filterEntries）→ 排序 → 全量渲染，用户输入后马上看到结果；
//   阶段二（异步渐进）：未命中文件进入模糊队列，分片做概率匹配，命中后按同一排序插入正确位置。
function renderEntries() {
  if (bulkMode) exitBulkMode();   // 搜索/筛选重建列表时退出多选
  const rows = $("fileRows");
  rows.classList.toggle("grid", view === "grid");
  const groups = parseQuery(normSearch(searchQuery)); // 查询语法统一解析一次，精确/模糊两阶段共用
  if (!currentEntries.length) {
    rows.innerHTML = '<div class="empty">空目录</div>';
    _shownEntries = [];
    startFuzzyPass(groups);
    return;
  }
  const list = filterEntries(currentEntries, groups); // 阶段一：精确子串 + 硬筛选
  sortEntries(list);
  if (!list.length) rows.innerHTML = '<div class="empty">无匹配项</div>';
  else {
    rows.innerHTML = "";
    list.forEach(e => rows.appendChild(view === "grid" ? gridItem(e) : listItem(e)));
  }
  _shownEntries = list.slice(); // 与 DOM children 顺序一一对应
  startFuzzyPass(groups);       // 阶段二：未命中文件的概率模糊匹配（异步）
}
// ============================================================================
// 两阶段搜索第二阶段：异步概率模糊匹配 + 排序插入
// ============================================================================
let _fuzzyToken = 0;      // 令牌：新输入/重渲染/目录切换递增，使旧模糊任务失效（可打断）
let _fuzzyTimer = null;   // 分片定时器
let _shownEntries = [];   // 当前已渲染 entry（与 DOM 顺序一致，已按 entryCompare 排序）
let _fuzzyQueue = [];     // 待模糊检查的 entry（已过硬筛选、未精确命中）
let _fuzzyDone = 0;       // 已处理数（进度提示）
let _fuzzyTotal = 0;      // 总数（进度提示）
const FUZZY_BATCH = 30;   // 每批处理文件数（批间 setTimeout(0) 让出主线程）
function fuzzyShowHint() {
  const el = $("fuzzyHint");
  if (el) {
    el.classList.remove("d-none");
    el.textContent = "正在模糊匹配… " + _fuzzyDone + "/" + _fuzzyTotal;
  }
}
function fuzzyHideHint() {
  const el = $("fuzzyHint");
  if (el) { el.classList.add("d-none"); el.textContent = ""; }
}
// 单个 entry 的模糊判定：按当前搜索模式取可搜索文本（entrySearchText），多组 OR、组内 AND
function fuzzyMatchEntry(e, groups) {
  let texts = e._fuzzyTexts;
  if (!texts) { texts = e._fuzzyTexts = entrySearchText(e); }
  return fuzzyMatchTexts(groups, texts);
}
// 二分查找插入点：_shownEntries 已排序，找到第一个 entryCompare(e, it) < 0 的位置
function sortedInsertIndex(e) {
  let lo = 0, hi = _shownEntries.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (entryCompare(e, _shownEntries[mid]) < 0) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}
// 将模糊命中的 entry 插入 DOM 正确排序位置（先移除空态占位，再二分插入）
function insertIntoSortedDom(e) {
  const rows = $("fileRows");
  const emptyEl = rows.querySelector(".empty");
  if (emptyEl) emptyEl.remove(); // 同步阶段无结果时先显示空态，模糊命中后替换
  const idx = sortedInsertIndex(e);
  _shownEntries.splice(idx, 0, e);
  const node = view === "grid" ? gridItem(e) : listItem(e);
  rows.insertBefore(node, rows.children[idx] || null);
}
// 启动模糊补充：只处理"通过硬筛选但未精确命中"的文件；无搜索词/无可查文件时直接返回
function startFuzzyPass(groups) {
  _fuzzyToken++; // 使上一轮未完成的模糊任务失效
  if (_fuzzyTimer) { clearTimeout(_fuzzyTimer); _fuzzyTimer = null; }
  fuzzyHideHint();
  if (!groups || !groups.length) return; // 无搜索词：全部精确命中，无需模糊
  const shown = new Set(_shownEntries.map(x => x.path));
  const queue = applyHardFilters(currentEntries).filter(x => !shown.has(x.path));
  if (!queue.length) return;
  queue.forEach(x => { x._fuzzyTexts = entrySearchText(x); }); // 预计算，避免每批重复归一化
  _fuzzyQueue = queue;
  _fuzzyTotal = queue.length;
  _fuzzyDone = 0;
  const myToken = _fuzzyToken;
  fuzzyShowHint();
  _fuzzyTimer = setTimeout(() => fuzzyStep(myToken, groups), 0);
}
// 模糊分片：每批 FUZZY_BATCH 个文件，命中即插入 DOM；令牌失效（新输入）立即停止
function fuzzyStep(token, groups) {
  if (token !== _fuzzyToken) return; // 已被新输入/重渲染打断
  const end = Math.min(_fuzzyDone + FUZZY_BATCH, _fuzzyQueue.length);
  for (let i = _fuzzyDone; i < end; i++) {
    const e = _fuzzyQueue[i];
    if (fuzzyMatchEntry(e, groups)) insertIntoSortedDom(e);
  }
  _fuzzyDone = end;
  if (end < _fuzzyQueue.length) {
    fuzzyShowHint();
    _fuzzyTimer = setTimeout(() => fuzzyStep(token, groups), 0); // 让出主线程
  } else {
    _fuzzyTimer = null;
    fuzzyHideHint();
  }
}
function setView(v) {
  if (view === v) return;
  view = v;
  if (!SHARE_MODE) { try { localStorage.setItem("drive.view", view); } catch (e) { /* 忽略 */ } }
  syncViewBtns();
  renderEntries();
}
function syncViewBtns() {
  $("viewListBtn").classList.toggle("active", view === "list");
  $("viewGridBtn").classList.toggle("active", view === "grid");
}
function syncTypeChips() {
  document.querySelectorAll("#typeFilters input[type=checkbox]").forEach(cb => {
    const chip = cb.closest(".type-chip");
    if (chip) chip.classList.toggle("active", cb.checked);
  });
}
function openSidebar() {
  sidebarOpen = true;
  $("sidebar").classList.add("show");
  $("sidebarMask").classList.add("show");
  startTagScan(); // 打开侧边栏时触发推荐标签扫描（有缓存则直接渲染）
}
function closeSidebar() {
  sidebarOpen = false;
  $("sidebar").classList.remove("show");
  $("sidebarMask").classList.remove("show");
}
function toggleSidebar() { sidebarOpen ? closeSidebar() : openSidebar(); }
// 侧边栏打开/关闭（关闭不改变筛选状态，重开保留）
$("viewBtn").onclick = toggleSidebar;
$("sidebarClose").onclick = closeSidebar;
$("sidebarMask").onclick = closeSidebar;
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && bulkMode) exitBulkMode();
  else if (e.key === "Escape" && sidebarOpen) closeSidebar();
});
// 移动端键盘避让：iOS 弹出键盘时 visualViewport 高度缩小，抬升侧边栏底部按钮（重置筛选）免被遮挡
if (window.visualViewport) {
  const vv = window.visualViewport;
  const adjustSidebarFoot = () => {
    const foot = document.querySelector(".sidebar-foot");
    if (!foot) return;
    const kbH = Math.max(0, window.innerHeight - vv.height); // 键盘遮挡高度
    // 遮挡超过 60px 才认为键盘弹出（规避 resize 抖动）；关闭侧边栏即复位
    foot.style.paddingBottom = (sidebarOpen && kbH > 60) ? "calc(1rem + " + kbH + "px)" : "";
  };
  vv.addEventListener("resize", adjustSidebarFoot);
  vv.addEventListener("scroll", adjustSidebarFoot);
}
// 视图切换（radio 式按钮组）
$("viewListBtn").onclick = () => setView("list");
$("viewGridBtn").onclick = () => setView("grid");
// 搜索：input 实时过滤（防抖 150ms，避免大目录输入卡顿）
let _searchDebounce = null;
$("searchInput").addEventListener("input", () => {
  searchQuery = $("searchInput").value;
  clearTimeout(_searchDebounce);
  _searchDebounce = setTimeout(renderEntries, 150);
});
// 推荐标签手动刷新：清当前目录缓存并重新扫描
$("tagRefresh").onclick = () => {
  _tagCache.delete(cur);
  startTagScan();
};
// 搜索范围切换：文件名 / 文件名+元数据内容
$("searchMetaToggle").addEventListener("change", () => {
  searchMetaMode = $("searchMetaToggle").checked;
  $("searchInput").placeholder = searchMetaMode ? "按文件名或元数据搜索…" : "按文件名搜索…";
  renderEntries();
});
// 类型多选（change 事件代理）
$("typeFilters").addEventListener("change", ev => {
  if (ev.target.matches("input[type=checkbox]")) { syncTypeChips(); renderEntries(); }
});
// 自输入后缀
$("extInput").addEventListener("input", () => { customExts = $("extInput").value; renderEntries(); });
// 排序：原生 select 在"再次点击当前项"时值不变、不触发 change，因此：
//  - mousedown 标记"打开下拉"的那次点击（随后的 click 不处理，避免与选择动作混淆）
//  - 打开下拉后再点（click 且 mousedown 标志已消费）→ 若点的还是当前项则手动反转方向
//  - change 负责正常切换（选新字段 → 重置为该字段默认方向）
let _sortDown = false;
$("sortSelect").addEventListener("mousedown", () => { _sortDown = true; });
$("sortSelect").addEventListener("click", () => {
  if (_sortDown) { _sortDown = false; return; } // 打开下拉的那次点击
  const v = $("sortSelect").value;
  if (v === sortBy) { // 点击了下拉里当前已选中项：值不变，change 不触发 → 手动反转
    sortDir = -sortDir;
    updateSortLabel();
    renderEntries();
  }
  // 值变化的情况交给 change 处理，避免重复
});
$("sortSelect").addEventListener("change", () => {
  const v = $("sortSelect").value;
  if (v === sortBy) return; // 正常流程不会出现（值不变不触发 change），防御
  sortBy = v;
  sortDir = DEFAULT_SORT_DIR[v];
  updateSortLabel();
  renderEntries();
});
// 一键重置筛选/排序/搜索
$("resetFilterBtn").onclick = () => {
  document.querySelectorAll("#typeFilters input[type=checkbox]").forEach(cb => { cb.checked = false; });
  syncTypeChips();
  $("extInput").value = ""; customExts = "";
  $("searchInput").value = ""; searchQuery = "";
  $("searchMetaToggle").checked = false; searchMetaMode = false;
  $("searchInput").placeholder = "按文件名搜索…";
  $("sortSelect").value = "mtime"; sortBy = "mtime"; sortDir = DEFAULT_SORT_DIR.mtime;
  updateSortLabel();
  renderEntries();
};
syncViewBtns();
syncTypeChips();
updateSortLabel();

async function loadList(path, opts) {
  hideAlert();
  if (bulkMode) exitBulkMode();   // 列表即将重建，退出多选
  const rows = $("fileRows");
  rows.classList.toggle("grid", view === "grid");
  // 加载骨架屏（纯视觉：6 条 shimmer 行，请求完成由 renderEntries 替换）
  rows.innerHTML = '<div class="skeleton-list">' +
    '<div class="skeleton-row"><span class="sk-ic"></span><span class="sk-line w40"></span><span class="sk-line w12" style="margin-left:auto"></span></div>'.repeat(6) +
    '</div>';
  // meta=1：附带每个 entry 的 meta.kind，供侧边栏类型筛选/排序/搜索使用
  const data = await api("api/list?path=" + encodeURIComponent(path) + "&meta=1");
  if (data.error) {
    currentEntries = [];
    tagScanReset(); tagRenderEmpty();
    rows.innerHTML = "";
    showAlert(data.error, [
      { label: "↩ 返回上级", fn: () => {
          // 回退链：后端合法 parent → 导航栈栈顶（打开 .lnk 前的页面，含虚拟分享根 ""）→ 当前根
          // 越界错误响应不含 parent，且虚拟分享根 activeRoot 为空串，必须靠 cur/navStack 兜底
          const parent = data.parent;
          if (parent) loadList(parent);
          else if (navStack[navIdx] !== undefined) loadList(navStack[navIdx], { push: false });
          else if (activeRoot !== null) loadList(activeRoot);
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
  currentEntries = data.entries;
  renderEntries();
  // 目录已切换/内容可能变化：使该目录标签缓存失效并重新扫描（侧边栏打开时可见渐出效果）
  _tagCache.delete(cur);
  startTagScan();
  if (!SHARE_MODE) {
    // 默设置顶列表为折叠态（切列表即收起，头部可点开）
    $("pinnedList").classList.add("pinned-fold");
    $("pinnedChevron").textContent = "▶";
  }
}

// 列表模式条目（点击行为与 grid 一致）
function listItem(e) {
  const row = document.createElement("li");
  const locked = !!e.locked;
  row.className = "list-group-item d-flex align-items-center gap-2 py-2" + (locked ? " text-muted opacity-75" : "");
  const ic = e.is_dir ? BASE + "static/icons/folder.svg" : (locked ? BASE + "static/icons/locked.svg" : iconUrl(e.name));
  row.dataset.path = e.path;              // 多选批量操作取路径
  row.dataset.dir = e.is_dir ? "1" : "";  // 批量下载跳过目录
  // 常驻五角星已移除（t9）：置顶改由「长按多选 → 批量置顶」完成
  row.innerHTML =
    '<span class="bulk-cb"><input type="checkbox" class="form-check-input" aria-label="选择"></span>' +
    '<span class="ic flex-shrink-0 text-center" style="width:26px"><img src="' + ic + '" width="20" height="20" alt="" style="vertical-align:-4px"></span>' +
    '<span class="nm text-truncate flex-grow-1' + (e.is_dir ? " fw-medium" : "") + '"></span>' +
    '<span class="mt d-none d-md-block text-muted small flex-shrink-0 text-end" style="width:130px">' + fmtTime(e.mtime) + "</span>" +
    '<span class="sz text-muted small flex-shrink-0 text-end" style="min-width:70px">' + (e.is_dir ? "—" : fmtSize(e.size)) + "</span>" +
    '<span class="info-btn text-muted flex-shrink-0 px-1 user-select-none" title="详情">ⓘ</span>' +
    (SHARE_MODE
      ? '<span class="share-btn btn-link text-primary flex-shrink-0 px-1 user-select-none" title="二次分享" style="font-size:12px">🔗 分享</span>'
      : "");
  const nm = row.querySelector(".nm");
  nm.textContent = e.name;
  bindRowAction(nm, e, locked);
  row.querySelector(".info-btn").onclick = () => showDetail(e.path, e.name);
  if (SHARE_MODE) {
    const sb = row.querySelector(".share-btn");
    if (sb) sb.onclick = () => showShareDialog(e.path, e.name, { sub: true });
  } else {
    // 长按进入多选；多选模式行级拦截（capture 阶段先于 nm 的打开逻辑）
    bindLongPress(row, e, locked);
    row.addEventListener("click", (ev) => {
      if (bulkMode) { ev.preventDefault(); ev.stopPropagation(); toggleBulkSelect(row, e.path); }
    }, true);
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
  card.dataset.path = e.path;              // 多选批量操作取路径
  card.dataset.dir = e.is_dir ? "1" : "";  // 批量下载跳过目录
  // 常驻 grid-star 已移除（t9）：置顶改由「长按多选 → 批量置顶」完成
  card.innerHTML =
    '<div class="grid-top">' +
    '  <span class="bulk-cb"><input type="checkbox" class="form-check-input" aria-label="选择"></span>' +
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
  if (SHARE_MODE) {
    const sb = card.querySelector(".grid-share");
    if (sb) sb.onclick = (ev) => { ev.stopPropagation(); showShareDialog(e.path, e.name, { sub: true }); };
  } else {
    // 长按进入多选；多选模式行级拦截（capture 阶段先于卡片打开逻辑）
    bindLongPress(card, e, locked);
    card.addEventListener("click", (ev) => {
      if (bulkMode) { ev.preventDefault(); ev.stopPropagation(); toggleBulkSelect(card, e.path); }
    }, true);
  }
  return card;
}

// 预览分发入口（T11 架构预留：方案B 独立页面 /view?path= 复用同一渲染逻辑，只需加页面壳）。
// bindRowAction 已内联相同分发；此处独立成函数便于后续独立路由直接调用。
function previewFile(path, name) {
  const kind = fileKind(name);
  if (kind === "video") showVideo(path, name);
  else if (kind === "image") showImage(path, name);
  else if (kind === "markdown" || kind === "text") showText(path, name);
  else if (kind === "pdf") showPdf(path, name);
  else if (kind === "csv") showCsv(path, name);
  else if (kind === "archive") showUnpack(path, name);
  else if (kind === "lnk") showLnk(path, name);
  else location.href = dlUrl(path);   // 其它类型直接下载
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
  } else if (kind === "image") {
    el.onclick = () => showImage(e.path, e.name);
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

// ==================== T9 长按多选模式（批量置顶/分享/下载/打包） ====================
let bulkMode = false;             // 多选模式是否激活（分享模式永不激活）
const bulkSelected = new Set();   // 选中的 entry path 集合

// 长按 ~500ms 进入多选（桌面 mousedown / 移动 touchstart；滚动 touchmove 取消）
// 长按即选中该行，并有按压背景反馈 + 震动提示；长按后的 click 被吞掉避免误开文件
function bindLongPress(el, e, locked) {
  let timer = null;
  const cancel = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    el.classList.remove("press-active");
  };
  const start = () => {
    if (locked || bulkMode || SHARE_MODE) return;
    cancel();
    el.classList.add("press-active");
    timer = setTimeout(() => {
      timer = null;
      el.classList.remove("press-active");
      enterBulkMode();
      toggleBulkSelect(el, e.path);
      if (navigator.vibrate) navigator.vibrate(30);   // 触觉反馈
      // 吞掉长按松手后触发的 click，避免立即再 toggle 一次
      const swallow = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
      el.addEventListener("click", swallow, true);
      setTimeout(() => el.removeEventListener("click", swallow, true), 700);
    }, 500);
  };
  el.addEventListener("mousedown", start);
  el.addEventListener("touchstart", start, { passive: true });
  el.addEventListener("mouseup", cancel);
  el.addEventListener("mouseleave", cancel);
  el.addEventListener("touchend", cancel);
  el.addEventListener("touchmove", cancel);
  el.addEventListener("touchcancel", cancel);
}

function enterBulkMode() {
  if (SHARE_MODE || bulkMode) return;
  bulkMode = true;
  document.querySelectorAll("#fileRows > .list-group-item, #fileRows > .grid-item").forEach(el => {
    el.classList.add("bulk-mode");
  });
  const bar = $("bulkBar");
  if (bar) bar.classList.remove("d-none");
  updateBulkBar();
  toast("已进入多选模式（点按行勾选）");
}

function exitBulkMode() {
  if (!bulkMode) return;
  bulkMode = false;
  bulkSelected.clear();
  document.querySelectorAll("#fileRows > .list-group-item, #fileRows > .grid-item").forEach(el => {
    el.classList.remove("bulk-mode", "selected", "press-active");
    const cb = el.querySelector(".bulk-cb input");
    if (cb) cb.checked = false;
  });
  const bar = $("bulkBar");
  if (bar) bar.classList.add("d-none");
}

function toggleBulkSelect(el, path) {
  const cb = el.querySelector(".bulk-cb input");
  if (bulkSelected.has(path)) {
    bulkSelected.delete(path);
    el.classList.remove("selected");
    if (cb) cb.checked = false;
  } else {
    bulkSelected.add(path);
    el.classList.add("selected");
    if (cb) cb.checked = true;
  }
  updateBulkBar();
}

function bulkRowEls() {
  return [...document.querySelectorAll("#fileRows > .list-group-item, #fileRows > .grid-item")];
}

function updateBulkBar() {
  const n = bulkSelected.size;
  const cnt = $("bulkCount");
  if (cnt) cnt.textContent = "已选 " + n + " 项";
  const sa = $("bulkSelectAll");
  if (sa) {
    const rows = bulkRowEls();
    sa.textContent = rows.length && rows.every(el => bulkSelected.has(el.dataset.path)) ? "取消全选" : "全选";
  }
}

// 全选 / 取消全选
$("bulkSelectAll").onclick = () => {
  const rows = bulkRowEls();
  const allSelected = rows.length && rows.every(el => bulkSelected.has(el.dataset.path));
  rows.forEach(el => {
    if (allSelected) {
      bulkSelected.delete(el.dataset.path);
      el.classList.remove("selected");
      const cb = el.querySelector(".bulk-cb input");
      if (cb) cb.checked = false;
    } else {
      bulkSelected.add(el.dataset.path);
      el.classList.add("selected");
      const cb = el.querySelector(".bulk-cb input");
      if (cb) cb.checked = true;
    }
  });
  updateBulkBar();
};

// 批量置顶 / 取消置顶：逐项调 api/pin，直接用返回值同步 pinned，不重载列表
async function bulkTogglePin(doPin) {
  const paths = [...bulkSelected];
  if (!paths.length) { toast("请先选择文件"); return; }
  let ok = 0;
  for (const p of paths) {
    try {
      const j = await api("api/pin?add=" + (doPin ? 1 : 0) + "&path=" + encodeURIComponent(p));
      if (j && Array.isArray(j.pinned)) pinned = j.pinned;   // 后端返回最新 pinned，不再二次 api/info
      ok++;
    } catch (e) { /* 单项失败继续 */ }
  }
  renderPinned();
  toast(ok + " 项已" + (doPin ? "置顶" : "取消置顶"));
  exitBulkMode();
}
$("bulkPin").onclick = () => bulkTogglePin(true);
$("bulkUnpin").onclick = () => bulkTogglePin(false);

// 批量分享：api/share?paths=...（复用 t4 抽的 buildShareModal 工厂）
$("bulkShare").onclick = () => {
  const paths = [...bulkSelected];
  if (!paths.length) { toast("请先选择文件"); return; }
  buildShareModal({
    title: "批量分享",
    headHtml: '<div class="mb-2 text-truncate">将分享选中的 ' + paths.length + ' 个文件</div>',
    formHtml: '<div class="mb-3">' +
      '  <div class="form-check"><input class="form-check-input" type="radio" name="bulkShareHours" id="bs1" value="1"><label class="form-check-label" for="bs1">1 小时</label></div>' +
      '  <div class="form-check"><input class="form-check-input" type="radio" name="bulkShareHours" id="bs24" value="24" checked><label class="form-check-label" for="bs24">1 天</label></div>' +
      '  <div class="form-check"><input class="form-check-input" type="radio" name="bulkShareHours" id="bs72" value="72"><label class="form-check-label" for="bs72">3 天</label></div>' +
      '  <div class="form-check"><input class="form-check-input" type="radio" name="bulkShareHours" id="bs168" value="168"><label class="form-check-label" for="bs168">7 天</label></div>' +
      "</div>",
    genLabel: "生成链接",
    gen: async () => {
      const checked = document.querySelector('input[name="bulkShareHours"]:checked');
      const hours = checked ? checked.value : "24";
      const j = await api("api/share?paths=" + encodeURIComponent(paths.join("|")) + "&hours=" + hours);
      return { ...j, msg: "分享链接已生成（" + paths.length + " 个文件）", note: "有效期至 " + fmtTime(j.expires_at) };
    },
  });
};

// 批量下载：逐个触发下载（目录项跳过）
$("bulkDownload").onclick = () => {
  const rows = bulkRowEls().filter(el => bulkSelected.has(el.dataset.path) && el.dataset.dir !== "1");
  if (!rows.length) { toast("请先选择文件（目录无法直接下载）"); return; }
  rows.forEach(el => { location.href = dlUrl(el.dataset.path); });
  toast("已开始下载 " + rows.length + " 个文件");
};

// 批量打包：直接提交选中项（复用 archive API，不依赖 pinned）
$("bulkPack").onclick = async () => {
  const paths = [...bulkSelected];
  if (!paths.length) { toast("请先选择文件"); return; }
  try {
    const r = await fetch(BASE + "api/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths, mode: packMode }),
    });
    const j = await r.json();
    if (r.status === 429) { toast("打包任务过多，请稍后再试"); return; }
    if (!r.ok) { toast((j && j.error) || "提交打包失败（HTTP " + r.status + "）"); return; }
    openPanel();
    pollArchives();
    toast("已提交打包任务");
    exitBulkMode();
  } catch (e) { toast("提交失败: " + (e && e.message || e)); }
};

$("bulkCancel").onclick = exitBulkMode;

$("refreshBtn").onclick = () => { if (cur !== null) loadList(cur); };

// ---------------- 打包中心（后台任务：排队 / 分块进度 / 原生下载 / 预览） ----------------
let packMode = "normal";     // store | fast | normal（面板内单选）
let archTasks = {};          // task_id -> 轻量任务快照（轮询重建/更新）
const archFinalStates = ["ready", "done", "failed", "aborted"];
let archPollTimer = null;    // 轮询定时器（页面隐藏时暂停）
let infoUrls = [];           // /api/info 返回的直连地址（https），旧后端无该字段时为空
let infoUrlsHttp = [];       // 同上（http 免证书，局域网/本机适用）
// 阈值理由：Cloudflare → origin 100s 超时，家庭上行普遍 ≤2MB/s，约 200MB 起才会撞 100s
// 上限；更大的包经域名下载必 524，小于该值一般来得及发完（200MB 定阈值避免频繁打扰）
const DIRECT_DL_THRESHOLD = 200 * 1024 * 1024;

function openPanel() {
  $("packPanel").classList.remove("d-none");
  $("packPanel").classList.remove("mini");
  $("packMiniBar").classList.add("d-none");
  createPackPreview();
  pollArchives();            // 打开时立即刷一次
  const nt = $("packNewTask");
  if (nt && nt.scrollIntoView) nt.scrollIntoView({ block: "nearest" });  // 聚焦提交区
}

function closePanel() {
  $("packPanel").classList.add("d-none");
  $("packPanel").classList.remove("mini");
  updateTotal();             // 面板关闭后迷你条接管提示
}

// 迷你条与面板互斥：点了迷你条就展开面板；面板点头部折叠成露头
function toggleMini() {
  const p = $("packPanel");
  if (p.classList.contains("d-none")) { openPanel(); return; }
  p.classList.toggle("mini");
  if (!p.classList.contains("mini")) createPackPreview();
}

function pollArchives() {
  fetch(BASE + "api/archives")
    .then(r => r.json())
    .then(j => {
      if (!j || !Array.isArray(j.tasks)) return;
      const seen = {};
      j.tasks.forEach(t => {
        seen[t.task_id] = true;
        if (archTasks[t.task_id]) archTasks[t.task_id] = Object.assign({}, archTasks[t.task_id], t);
        else archTasks[t.task_id] = Object.assign({}, t);
      });
      // 服务端已逐出的任务同步移除（防止本地幽灵条目）
      Object.keys(archTasks).forEach(k => { if (!seen[k]) delete archTasks[k]; });
      renderArchPanel();
    })
    .catch(() => { /* 轮询失败静默（网络抖动不打扰） */ });
}

function startArchPolling() {
  stopArchPolling();
  archPollTimer = setInterval(pollArchives, 1000);
}
function stopArchPolling() {
  if (archPollTimer) { clearInterval(archPollTimer); archPollTimer = null; }
}

function renderArchPanel() {
  const box = $("packTasks");
  if (!box) return;
  const ids = Object.keys(archTasks).sort((a, b) => archTasks[b].created_at - archTasks[a].created_at);
  box.innerHTML = ids.length
    ? ids.map(id => renderTask(archTasks[id])).join("")
    : '<div class="pack-empty">暂无打包任务</div>';
  updateTotal();
}

// 直连下载地址选取：优先局域网可达（私网 IPv4 / ULA IPv6），其次任意非回环地址；
// 127.0.0.1 在手机/另一台设备上无法使用，故排除回环与链路本地
function pickDirectBase() {
  const hostOf = u => { try { return new URL(u).hostname.replace(/^\[|\]$/g, ""); }
                        catch (e) { return ""; } };
  const isLanIpv4 = h => {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
    if (!m) return false;
    const p = m.slice(1).map(Number);
    if (!p.every(n => n >= 0 && n <= 255)) return false;
    return p[0] === 10 || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
           (p[0] === 192 && p[1] === 168);
  };
  const isUsable = h => h && h !== "127.0.0.1" && h !== "::1" && h !== "localhost" &&
                         !/^fe80/i.test(h);
  const lists = [infoUrlsHttp, infoUrls];
  for (const list of lists) {
    for (const u of list) {
      const h = hostOf(u).toLowerCase();
      if (isLanIpv4(h) || h.startsWith("fd") || h.startsWith("fc")) return u;
    }
  }
  for (const list of lists) {
    for (const u of list) {
      const h = hostOf(u);
      if (isUsable(h)) return u;
    }
  }
  return null;
}

function copyDirectDl(id) {
  const base = pickDirectBase();
  if (!base) { toast("未获取到直连地址（需新版服务端）"); return; }
  const url = base + "api/archive/dl?id=" + encodeURIComponent(id);
  const doCopy = navigator.clipboard && window.isSecureContext
    ? navigator.clipboard.writeText(url)
    : new Promise((res, rej) => {
        // 自签名证书下页面非 secure context，clipboard API 不可用，退化为 execCommand
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand("copy"); } catch (e) { /* 忽略 */ }
        ta.remove();
        ok ? res() : rej(new Error("copy failed"));
      });
  doCopy.then(() => toast("已复制直连下载链接"), () => toast("复制失败，请手动复制链接"));
  return doCopy;
}

// 任务状态 → 进度/文案（含压缩中当前文件与下载进度）
// 说明：打包中 pct 以字节比为准（cap 99），字节未动（0）时兜底用文件数比 min(99, 100*file_done/file_total)
function taskStateUI(t) {
  const s = t.state;
  if (s === "queued") return { pct: 0, label: "排队中…", striped: true, idle: true, detail: "" };
  if (s === "scanning") return { pct: 0, label: "扫描中…", striped: true, idle: true, detail: "" };
  if (s === "compressing") {
    let pct = t.total_bytes > 0 ? Math.min(99, Math.round(t.done_bytes / t.total_bytes * 100)) : 0;
    if (pct === 0 && t.file_total > 0) pct = Math.min(99, Math.round(100 * (t.file_done || 0) / t.file_total));
    return { pct, label: "打包中 " + pct + "%", striped: true,
             detail: t.current_file ? "当前文件: " + esc(t.current_file) : "" };
  }
  if (s === "ready") return { pct: 100, label: "压缩完成 · 待下载", striped: false,
                              detail: "zip 大小 " + fmtSize(t.dl_total_bytes) };
  if (s === "downloading") {
    const pct = t.dl_total_bytes > 0 ? Math.round(t.bytes_sent / t.dl_total_bytes * 100) : 0;
    return { pct, label: "下载中 " + pct + "%", striped: true, detail: "" };
  }
  if (s === "done") return { pct: 100, label: "✓ 已完成", striped: false, detail: "" };
  if (s === "failed") return { pct: 0, label: "打包失败", striped: false, detail: esc(t.error || "") };
  if (s === "aborted") return { pct: 0, label: "已取消", striped: false, detail: "" };
  return { pct: 0, label: esc(s), striped: false, detail: "" };
}

// 任务卡（每次轮询整卡重建，简单可靠）
function renderTask(t) {
  const modeLabel = { store: "⚡不压缩", fast: "🚀快", normal: "📦标准" }[t.mode] || "📦标准";
  const st = taskStateUI(t);
  const names = t.names || [];
  const nameTxt = names.slice(0, 2).map(esc).join("、") +
                  (names.length > 2 ? " 等 " + names.length + " 项" : "");
  let card = '<div class="pk-task card card-body py-2 mb-2" data-id="' + esc(t.task_id) + '">';
  card += '<div class="d-flex align-items-center gap-2 mb-1">' +
          '<span class="flex-shrink-0">📦</span>' +
          '<span class="pk-nm flex-grow-1 text-truncate" title="' + nameTxt + '">' + (nameTxt || "(空)") + "</span>" +
          '<span class="badge text-bg-secondary flex-shrink-0">' + modeLabel + "</span>" +
          '<span class="small flex-shrink-0">' + st.label + "</span>" +
          '<button class="btn btn-outline-secondary btn-sm py-0 px-1 flex-shrink-0" title="删除任务" ' +
              'onclick="removeTask(\'' + esc(t.task_id) + '\')">✕</button>' +
          "</div>";
  card += '<div class="progress' + (st.idle ? " pk-idle-track" : "") + '" style="height:6px" role="progressbar" aria-valuenow="' + st.pct + '" aria-valuemin="0" aria-valuemax="100">' +
          '<div class="progress-bar' + (st.striped ? " progress-bar-striped progress-bar-animated" : "") +
          '" style="width:' + st.pct + '%"></div></div>';
  if (t.state === "ready" || t.state === "done") {
    card += '<div class="d-flex justify-content-between align-items-center mt-1">' +
            '<span class="small text-muted">' + st.detail + "</span>" +
            '<a class="btn btn-sm btn-primary" href="' + BASE + "api/archive/dl?id=" + encodeURIComponent(t.task_id) + '">⬇ 下载</a>' +
            "</div>";
    if (t.dl_total_bytes >= DIRECT_DL_THRESHOLD && pickDirectBase()) {
      card += '<div class="border-top pt-1 mt-1">' +
              '<div class="small text-warning">⚠️ 经域名下载大包可能触发网关超时，建议直连</div>' +
              '<div class="d-flex justify-content-end">' +
              '<button class="btn btn-sm btn-outline-primary py-0" onclick="copyDirectDl(\'' + esc(t.task_id) + '\')">📋 复制直连下载链接</button>' +
              "</div></div>";
    }
  } else if (st.detail) {
    card += '<div class="small text-muted text-truncate mt-1">' + st.detail + "</div>";
  }
  if (t.skipped_count > 0) {
    card += '<div class="mt-1"><button class="btn btn-sm btn-outline-warning py-0" ' +
            'onclick="toggleSkip(this)">⚠ 跳过 ' + t.skipped_count + " 项 ▾</button></div>";
  }
  return card + "</div>";
}

// 展开/收起跳过清单（拉单任务详情拿完整列表）
function toggleSkip(btn) {
  const card = btn.closest(".pk-task");
  const wrap = card.querySelector(".pk-skiplist");
  if (wrap) { wrap.remove(); btn.textContent = "⚠ 跳过 " + btn.dataset.skips + " 项 ▾"; return; }
  const id = card.dataset.id;
  fetch(BASE + "api/archive?id=" + encodeURIComponent(id))
    .then(r => r.json())
    .then(j => {
      if (!j || !j.task || !j.task.skipped) return;
      const div = document.createElement("div");
      div.className = "pk-skiplist small text-muted mt-1";
      div.innerHTML = j.task.skipped.map(k =>
        "<div>· " + esc(k.path) + "（" + esc(k.reason) + "）</div>").join("");
      btn.parentElement.appendChild(div);
      btn.textContent = "⚠ 跳过 " + j.task.skipped.length + " 项 ▴";
      btn.dataset.skips = j.task.skipped.length;   // 计数存按钮自身（轮询重建后仍可正确收起）
    })
    .catch(() => { /* 静默 */ });
}

function removeTask(id) {
  const t = archTasks[id];
  if (!t) return;
  if (archFinalStates.indexOf(t.state) >= 0) {
    delete archTasks[id];      // 终态：本地立即移除，服务端删除后轮询同步
  } else {
    t.state = "aborted";       // 活任务：本地先置取消态，服务端收敛后同步
  }
  renderArchPanel();
  fetch(BASE + "api/archive/cancel?id=" + encodeURIComponent(id), { method: "POST" })
    .catch(() => { /* 静默 */ });
}

// 顶部总进度（按任务加权，一次性产出全部头部/迷你条状态）
// 规则：done=1、ready/downloading=0.99、compressing=0.99*字节比（cap）、failed/aborted=0.99、
// queued/scanning=0，故 totalPct=100 当且仅当全部任务 done；无任务时整块隐藏
function updateTotal() {
  const tasks = Object.values(archTasks);
  const total = tasks.length;
  const done = tasks.filter(t => t.state === "done").length;
  const active = { scan: tasks.filter(t => t.state === "scanning" || t.state === "queued").length,
                   pack: tasks.filter(t => t.state === "compressing").length,
                   dl: tasks.filter(t => t.state === "downloading").length,
                   wait: tasks.filter(t => t.state === "ready").length };
  let sum = 0;
  for (const t of tasks) {
    const s = t.state;
    if (s === "done") sum += 1;
    else if (s === "compressing" && t.total_bytes > 0) sum += 0.99 * Math.min(1, t.done_bytes / t.total_bytes);
    else if (s === "queued" || s === "scanning") sum += 0;
    else if (s === "ready" || s === "downloading") sum += 0.99;
    else if (s === "failed" || s === "aborted") sum += 0.99;
  }
  const totalPct = total ? Math.floor(100 * sum / total) : 0;
  // 头部芯片（任务完成数）
  const chip = $("packDone"), sum2 = $("packSummary");
  if (chip) {
    if (!total) chip.classList.add("d-none");
    else {
      chip.classList.remove("d-none");
      let txt = "任务完成 " + done + "/" + total;
      const bad = tasks.filter(t => t.state === "failed").length;
      const canc = tasks.filter(t => t.state === "aborted").length;
      if (bad) txt += " · 失败 " + bad;
      if (canc) txt += " · 取消 " + canc;
      chip.textContent = txt;
    }
  }
  if (sum2) {
    const parts = [];
    if (active.pack) parts.push("打包中 " + active.pack);
    if (active.dl) parts.push("下载中 " + active.dl);
    if (active.wait) parts.push("待下载 " + active.wait);
    if (active.scan) parts.push("扫描/排队 " + active.scan);
    sum2.textContent = parts.join(" · ");
    sum2.classList.toggle("d-none", !parts.length);
  }
  const bar = $("packTotalBar");
  if (bar) { bar.style.width = totalPct + "%"; bar.parentElement.classList.toggle("d-none", total === 0); }
  // 迷你条：仅 活动任务存在 且 面板关闭 才显示（修掉原先 n>0 即弹的老 bug）
  const mini = $("packMiniBar");
  const hasActive = tasks.some(t => ["queued", "scanning", "compressing", "ready", "downloading"].indexOf(t.state) >= 0);
  if (mini) {
    const panel = $("packPanel");
    const show = hasActive && panel && panel.classList.contains("d-none");
    mini.classList.toggle("d-none", !show);
    if (show) mini.textContent = "📦 " + totalPct + "% · 完成 " + done + "/" + total;
  }
}

// 提交区预览树：置顶顶层项（名称+大小，目录带 ▶ 可展开统计，不递归）
function createPackPreview() {
  const box = $("packPreviewTree");
  if (!box) return;
  $("packNewLabel").textContent = pinned.length
    ? "将打包置顶的 " + pinned.length + " 项"
    : "还没有置顶文件，先在文件列表点亮 ★";
  if (!pinned.length) { box.innerHTML = ""; return; }
  box.innerHTML = pinned.map(p => {
    return '<div class="pk-prow d-flex align-items-center gap-2"' +
           (p.is_dir ? ' data-dir="' + esc(p.path) + '"' : "") + ">" +
           '<span class="flex-shrink-0 small">' + (p.is_dir ? "📁" : "📄") + "</span>" +
           '<span class="pk-nm flex-grow-1 text-truncate">' + esc(p.name) + "</span>" +
           '<span class="pk-size text-muted small flex-shrink-0">' + fmtSize(p.size) + "</span>" +
           (p.is_dir
             ? '<button class="btn btn-sm py-0 px-1 flex-shrink-0 pk-dir-btn" onclick="previewDir(this)">▶</button>'
             : "") +
           "</div>";
  }).join("");
}

// 目录统计预览：点击 ▶ 拉 child_count/child_bytes 行内展示；再点 ▼ 收起恢复
function previewDir(btn) {
  const row = btn.closest(".pk-prow");
  const path = row.dataset.dir;
  if (!path) return;
  const sizeEl = row.querySelector(".pk-size");
  if (!sizeEl) return;
  if (btn.textContent === "▼") {                    // 已展开：点击收起
    btn.textContent = "▶";
    if (row.dataset.origSize !== undefined) sizeEl.textContent = row.dataset.origSize;
    return;
  }
  btn.disabled = true;
  fetch(BASE + "api/archive/preview?paths=" + encodeURIComponent(path))
    .then(r => r.json())
    .then(j => {
      btn.disabled = false;
      if (!j || !j.items || !j.items.length) return;
      const it = j.items[0];
      if (row.dataset.origSize === undefined) row.dataset.origSize = sizeEl.textContent;  // 记住原大小便于收起
      sizeEl.textContent = it.child_count === -1
        ? "▶ 统计失败（无权限）"
        : "▶ " + it.child_count + " 个子项 · 共 " + fmtSize(it.child_bytes);
      btn.textContent = "▼";
    })
    .catch(() => { btn.disabled = false; });
}

// 提交打包任务
async function submitPack() {
  if (!pinned.length) { toast("还没有置顶文件"); return; }
  try {
    const r = await fetch(BASE + "api/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths: pinned.map(p => p.path), mode: packMode }),
    });
    const j = await r.json();
    if (r.status === 429) { toast("打包任务过多，请稍后再试"); return; }
    if (!r.ok) { toast((j && j.error) || "提交打包失败（HTTP " + r.status + "）"); return; }
    openPanel();
    pollArchives();          // 立即拉一次让新任务马上可见
    toast("已提交打包任务");
  } catch (e) { toast("提交失败: " + (e && e.message || e)); }
}

// 打开打包中心（不论有无置顶均可打开：可看历史任务/提交区引导；后台任务不阻塞浏览）
$("packBtn").onclick = () => { openPanel(); };

$("packSubmitBtn").onclick = submitPack;

// 压缩级别单选（面板内 btn-group，active 类切换）
document.querySelectorAll("#packModeGroup [data-amode]").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll("#packModeGroup [data-amode]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    packMode = btn.getAttribute("data-amode");
  };
});

$("packPanelClose").onclick = (ev) => {
  ev.stopPropagation();      // 阻止冒泡到头部（否则点了关闭又触发展开）
  closePanel();
};
$("packPanelHead").onclick = toggleMini;
$("packMiniBar").onclick = toggleMini;

// 非分享模式才启用打包中心：ESC 关面板 + 页面隐藏暂停轮询/回前台立即刷新
if (!SHARE_MODE) {
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && !$("packPanel").classList.contains("d-none")) closePanel();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopArchPolling();
    else { pollArchives(); startArchPolling(); }
  });
  startArchPolling();        // 立即起轮询：有活任务时迷你条会弹出，不强制开面板
  pollArchives();            // 立刻刷一次（不必等第一个 1s 周期）
}

$("shareAllBtn").onclick = () => {
  if (!pinned.length) { toast("还没有置顶文件"); return; }
  showShareManyDialog();
};

// 一键清空置顶：后端 clear=1 原地清 list，前端同步 pinned 并刷新列表/预览树
$("clearPinBtn").onclick = async () => {
  if (!pinned.length) return;
  const j = await api("api/pin?clear=1");
  pinned = (j || {}).pinned || [];
  renderPinned();   // 列表行无星标，无需 loadList(cur)（t9）
  if (!$("packPanel").classList.contains("d-none")) createPackPreview();
  toast("已清空全部置顶");
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

// ---------------- 功能 7：编程文件扩展名（语法高亮 + 图标映射共用） ----------------
const CODE_EXT = ["json","js","ts","jsx","tsx","py","java","c","cpp","h","hpp","cs","go","rs","php","rb","sh","bat","ps1","html","htm","css","scss","xml","yaml","yml","toml","ini","sql"];

// ---------------- 功能 8：文件类型专用图标（iconOf / iconUrl） ----------------
// 图标与 fileKind 预览行为保持一致（审计 P3-4：bat/svg 曾与预览分类不符）
function iconOf(name) {
  const e = extOf(name);
  if (e === "iso") return "iso";
  if (e === "lnk") return "lnk";
  if (VIDEO_EXT.indexOf(e) >= 0) return "video";
  if (IMAGE_EXT.indexOf(e) >= 0) return "image";   // 与 fileKind 一致：svg/ico 等图片预览
  if (["mp3","flac","wav","m4a","ogg","aac"].indexOf(e) >= 0) return "audio";
  if (["zip","rar","7z","tar","gz"].indexOf(e) >= 0) return "archive";
  if (["doc","docx"].indexOf(e) >= 0) return "doc";
  if (["xls","xlsx","csv"].indexOf(e) >= 0) return "sheet";
  if (["exe","msi"].indexOf(e) >= 0) return "exe";
  if (CODE_EXT.indexOf(e) >= 0) return "code";                 // 含 bat：脚本按文本预览，用 code 图标
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
  openPreviewModal(name, { type: "csv", path, name }, "文件较大，可能需要一点时间", async ({ body, ac }) => {
  const j = await api("api/read?path=" + encodeURIComponent(path), { signal: ac.signal });
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
  addFsButton(body, name, () => body.querySelector(".table") && body.querySelector(".table").parentElement, dlUrl(path));   // ⛶ 全屏放大表格
  });
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
  addFsButton(body, name, () => iframe, dlUrl(path));   // ⛶ 全屏放大 PDF
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

// 图片在线预览：内联 <img> + 缩放（按钮 +/−/适应宽度 + 滚轮）+ 下载；加载失败提示
function showImage(path, name) {
  const body = document.createElement("div");
  openModal(name, body, { type: "image", path, name });
  let scale = 1;
  const wrap = document.createElement("div");
  wrap.className = "img-preview-wrap";
  addFsButton(body, name, () => wrap, dlUrl(path));   // ⛶ 全屏放大（大图 contain + 缩放）
  const img = document.createElement("img");
  img.className = "img-preview";
  img.alt = name;
  // 缩放函数先声明再引用（避免 TDZ）
  const zoom = (f) => {
    scale = Math.min(8, Math.max(0.1, scale * f));
    img.style.maxWidth = "none";
    img.style.width = Math.round(wrap.clientWidth * scale) + "px";
    img.style.height = "auto";
  };
  const fit = () => {
    scale = 1;
    img.style.maxWidth = "100%";
    img.style.width = "auto";
    img.style.height = "auto";
  };
  // 缩放工具栏
  const bar = document.createElement("div");
  bar.className = "d-flex align-items-center gap-2 mb-2";
  bar.appendChild(mkBtn("＋ 放大", () => zoom(1.25)));
  bar.appendChild(mkBtn("－ 缩小", () => zoom(0.8)));
  bar.appendChild(mkBtn("适应宽度", () => fit()));
  body.appendChild(bar);
  img.onload = () => fit();
  img.onerror = () => {
    wrap.innerHTML = '<p class="muted">图片加载失败或格式不受支持</p>';
  };
  // 滚轮缩放（preventDefault 避免滚动穿透弹窗）
  wrap.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    zoom(ev.deltaY < 0 ? 1.1 : 0.9);
  }, { passive: false });
  wrap.appendChild(img);
  body.appendChild(wrap);
  const btns = document.createElement("div");
  btns.className = "d-flex flex-wrap gap-2 mt-3";
  btns.appendChild(mkBtn("⬇ 下载", () => { location.href = dlUrl(path); }));
  body.appendChild(btns);
  img.src = BASE + "api/img?path=" + encodeURIComponent(path);
}

// ---------------- 功能 5：.lnk 快捷方式跳转（跳到目标位置而非直接打开） ----------------
async function showLnk(path, name) {
  openPreviewModal(name, { type: "lnk", path, name }, null, async ({ body, ac }) => {
  let j;
  try {
    j = await api("api/lnk?path=" + encodeURIComponent(path), { signal: ac.signal });
  } catch (e) {
    if (e && e.name === "AbortError") throw e;   // 取消：交包装层统一显示
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
  addFsButton(body, name, () => body.querySelector(".p-2.bg-body-secondary") && body.querySelector(".p-2.bg-body-secondary").parentElement, dlUrl(path));   // ⛶ 全屏放大目标信息
  });
}

// ---------------- 功能 9：分享 ----------------
/**
 * 分享弹窗公共工厂：单文件分享 / 全部分享 / 二次分享 三个弹窗共用
 * 「表单 → 生成中… → 失败重试 / 成功展示链接 + 打开/复制」骨架（审计 P2：三处重复代码）。
 * @param {object} opts
 *   title     弹窗标题
 *   headHtml  表单上方说明区 HTML（文件名 / 数量提示等，需已转义）
 *   formHtml  表单区 HTML（有效期 radio 组等；可为空）
 *   genLabel  「生成链接」按钮文案
 *   gen       异步生成函数：返回 { ok, url, name?, expires_at?, msg?, note? }；
 *             失败返回 { error } 或抛异常（msg/note 为纯文本，工厂统一转义）
 */
function buildShareModal({ title, headHtml, formHtml, genLabel, gen }) {
  const body = document.createElement("div");
  openModal(title, body, null); // 分享弹窗不参与刷新恢复
  body.innerHTML =
    (headHtml || "") +
    (formHtml || "") +
    '<button class="btn btn-primary w-100" id="shareGen">' + genLabel + "</button>";
  const genBtn = $("shareGen");
  const failHtml = (msg) => {
    body.innerHTML = '<div class="alert alert-danger py-2 mb-2">' + esc(msg) + "</div>" +
      '<button class="btn btn-primary w-100" id="shareGen">重试</button>';
    $("shareGen").onclick = () => buildShareModal({ title, headHtml, formHtml, genLabel, gen });
  };
  genBtn.onclick = async () => {
    genBtn.disabled = true;
    genBtn.textContent = "生成中…";
    try {
      const j = await gen();
      if (!j || j.error || !j.ok) { failHtml((j && j.error) || "生成失败"); return; }
      const fullUrl = location.origin + j.url;
      body.innerHTML =
        '<div class="alert alert-success py-2 mb-2">' + esc(j.msg || "分享链接已生成") + "</div>" +
        '<div class="p-2 bg-body-secondary rounded mb-3" id="shareUrl" style="word-break:break-all;font-size:13px;user-select:all">' + esc(fullUrl) + "</div>" +
        '<div class="d-flex flex-wrap gap-2">' +
        '  <button class="btn btn-primary flex-fill" id="shareOpen">🌐 打开分享页</button>' +
        '  <button class="btn btn-outline-primary flex-fill" id="shareCopy">📋 复制链接</button>' +
        "</div>" +
        '<div class="small text-muted mt-2">' + esc(j.note || "") + "</div>";
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
  return { body };
}
// 主模式：创建新分享（选 1/24/72/168 小时有效期）。
// 分享模式（sub 模式）：二次分享，与当前分享共享同一个过期时间（不选新有效期）。
function showShareDialog(path, name, opts) {
  if (opts && opts.sub) return showSubShareDialog(path, name);
  buildShareModal({
    title: "创建分享链接",
    headHtml: '<div class="mb-2 text-truncate" title="' + esc(name) + '">' + esc(name) + "</div>",
    formHtml: '<div class="mb-3">' +
      '  <div class="form-check"><input class="form-check-input" type="radio" name="shareHours" id="sh1" value="1"><label class="form-check-label" for="sh1">1 小时</label></div>' +
      '  <div class="form-check"><input class="form-check-input" type="radio" name="shareHours" id="sh24" value="24" checked><label class="form-check-label" for="sh24">1 天</label></div>' +
      '  <div class="form-check"><input class="form-check-input" type="radio" name="shareHours" id="sh72" value="72"><label class="form-check-label" for="sh72">3 天</label></div>' +
      '  <div class="form-check"><input class="form-check-input" type="radio" name="shareHours" id="sh168" value="168"><label class="form-check-label" for="sh168">7 天</label></div>' +
      "</div>",
    genLabel: "生成链接",
    gen: async () => {
      const checked = document.querySelector('input[name="shareHours"]:checked');
      const hours = checked ? checked.value : "24";
      const j = await api("api/share?path=" + encodeURIComponent(path) + "&hours=" + hours);
      return { ...j, msg: "分享链接已生成（" + (j.name || name) + "）", note: "有效期至 " + fmtTime(j.expires_at) };
    },
  });
}

// ---------------- 功能 9：全部分享（一次把全部置顶文件生成分享链接） ----------------
// 有效期选择 UI 与单文件分享一致（radio 1/24/72/168，默认 24），
// 后端契约：api/share?paths=<p1>|<p2>|<p3>&hours=<h>（paths 每项 encodeURIComponent，整体再 encode 一次）
function showShareManyDialog() {
  buildShareModal({
    title: "全部分享",
    headHtml: '<div class="mb-2 text-truncate">共 ' + pinned.length + ' 个置顶文件将生成分享链接</div>',
    formHtml: '<div class="mb-3">' +
      '  <div class="form-check"><input class="form-check-input" type="radio" name="shareManyHours" id="sm1" value="1"><label class="form-check-label" for="sm1">1 小时</label></div>' +
      '  <div class="form-check"><input class="form-check-input" type="radio" name="shareManyHours" id="sm24" value="24" checked><label class="form-check-label" for="sm24">1 天</label></div>' +
      '  <div class="form-check"><input class="form-check-input" type="radio" name="shareManyHours" id="sm72" value="72"><label class="form-check-label" for="sm72">3 天</label></div>' +
      '  <div class="form-check"><input class="form-check-input" type="radio" name="shareManyHours" id="sm168" value="168"><label class="form-check-label" for="sm168">7 天</label></div>' +
      "</div>",
    genLabel: "生成链接",
    gen: async () => {
      const checked = document.querySelector('input[name="shareManyHours"]:checked');
      const hours = checked ? checked.value : "24";
      const pathsParam = pinned.map(p => p.path).join("|");
      const j = await api("api/share?paths=" + encodeURIComponent(pathsParam) + "&hours=" + hours);
      return { ...j, msg: "分享链接已生成（" + pinned.length + " 个文件）", note: "有效期至 " + fmtTime(j.expires_at) };
    },
  });
}

// 二次分享（分享模式）：直接调 api/sharesub，不弹有效期选择，与父分享同步过期
function showSubShareDialog(path, name) {
  buildShareModal({
    title: "二次分享",
    headHtml: '<div class="mb-2 text-truncate" title="' + esc(name) + '">' + esc(name) + "</div>" +
              '<div class="small text-muted mb-3">二次分享 · 与当前分享同步过期</div>',
    genLabel: "生成链接",
    gen: async () => {
      const j = await api("api/sharesub?path=" + encodeURIComponent(path));
      return { ...j, msg: "二次分享链接已生成（" + (j.name || name) + "）", note: "与当前分享同步过期（" + fmtTime(j.expires_at) + "）" };
    },
  });
}

// 启动入口：放在文件最末尾，确保上方所有 const/function 均已初始化（根治 TDZ）
init();
