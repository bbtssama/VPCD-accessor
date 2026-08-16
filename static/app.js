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

// BASE：token 根路径（如 /transfer/）。独立预览页（/view）去掉末尾的 /view 段，保证 api/静态相对路径正确。
{
  let _p = location.pathname;
  const _mv = _p.match(/^(.*?)\/view\/?$/);
  if (_mv) _p = _mv[1];
  var BASE = _p.endsWith("/") ? _p : _p + "/";
}
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
// T37：显示隐藏文件（主站持久化 drive.showHidden；分享模式默认关闭、会话内可临时开启不持久化）
let showHidden = (!SHARE_MODE && loadLS("drive.showHidden") === "1");
let sortBy = "mtime";      // mtime | name | size（当前排序字段）
let sortDir = -1;          // 相对默认方向的偏移：与默认方向同向为 1，反向为 -1
let searchQuery = "";      // 搜索关键词（匹配文件名）
let customExts = "";       // 自输入后缀（逗号分隔，如 md,txt,json）
let searchMetaMode = false; // false=仅按文件名搜索；true=文件名+元数据内容搜索
let sidebarOpen = false;   // 侧边栏开合状态

const $ = (id) => document.getElementById(id);

// ==================== T17 统一 SVG 图标库（Lucide/Feather 风格，与 static/icons/*.svg 一致） ====================
// 24x24 / stroke-width 1.8 / 圆头圆角；stroke=currentColor 自动适配按钮/文字/深色模式。
// icon(name, size) 返回指定尺寸的内联 SVG。
const ICON_SVG = (body) =>
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--bs-secondary-color)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + body + "</svg>";   // 柔和灰（与空目录图标一致），深浅模式自动跟随
const ICONS = {
  upload: ICON_SVG('<path d="M12 16V4"/><path d="M8 8l4-4 4 4"/><path d="M4 20h16"/>'),
  download: ICON_SVG('<path d="M12 4v12"/><path d="M8 12l4 4 4-4"/><path d="M4 20h16"/>'),
  share: ICON_SVG('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>'),
  star: ICON_SVG('<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>'),
  info: ICON_SVG('<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="8" r="1.2" fill="currentColor" stroke="none"/>'),
  refresh: ICON_SVG('<path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>'),
  back: ICON_SVG('<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>'),
  fwd: ICON_SVG('<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>'),
  filter: ICON_SVG('<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>'),
  close: ICON_SVG('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
  max: ICON_SVG('<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>'),
  pack: ICON_SVG('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>'),
  copy: ICON_SVG('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  trash: ICON_SVG('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
  play: ICON_SVG('<polygon points="5 3 19 12 5 21 5 3"/>'),
  text: ICON_SVG('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'),
  image: ICON_SVG('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'),
  archive: ICON_SVG('<path d="M21 8v13H3V8"/><rect x="1" y="3" width="22" height="5" rx="1"/><line x1="10" y1="12" x2="14" y2="12"/>'),
  cloud: ICON_SVG('<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>'),
  check: ICON_SVG('<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
  search: ICON_SVG('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),
  link: ICON_SVG('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
  list: ICON_SVG('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'),
  grid: ICON_SVG('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'),
  zoomIn: ICON_SVG('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>'),
  zoomOut: ICON_SVG('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>'),
  fit: ICON_SVG('<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>'),
  folder: ICON_SVG('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  plus: ICON_SVG('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
  chevronDown: ICON_SVG('<polyline points="6 9 12 15 18 9"/>'),
  chevronUp: ICON_SVG('<polyline points="18 15 12 9 6 15"/>'),
  chevronRight: ICON_SVG('<polyline points="9 6 15 12 9 18"/>'),   // T25：压缩包目录行 ▶ 指示
  home: ICON_SVG('<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h5v-6h4v6h5V10"/>'),   // 面包屑返回上级
  // ---- 文件类型图标（与 static/icons/*.svg 同一设计语言；inline 渲染使 currentColor 随主题） ----
  video: ICON_SVG('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10 9.5v5l4-2.5z" fill="currentColor" stroke="none"/>'),
  image: ICON_SVG('<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M4 17.5l5-5 3.5 3.5 3-3 4.5 4.5"/>'),
  audio: ICON_SVG('<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>'),
  archive: ICON_SVG('<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9h18M9 9v2M12 9v3M15 9v2"/>'),
  iso: ICON_SVG('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>'),
  doc: ICON_SVG('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9.5 13.5h5M9.5 16.5h5"/>'),
  pdf: ICON_SVG('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 16.5h6"/>'),
  sheet: ICON_SVG('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M10 4v16M15.5 4v16"/>'),
  code: ICON_SVG('<path d="M8.5 7 4 12l4.5 5M15.5 7 20 12l-4.5 5"/>'),
  exe: ICON_SVG('<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9h18M7 12.5l-1.5 1.5L7 15.5M11 15.5h4"/>'),
  lnk: ICON_SVG('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M17.5 11.5v4h-4M17.5 15.5 12 10"/>'),
  locked: ICON_SVG('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  file: ICON_SVG('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'),
};
// ==================== T34-2 双图标方案（线条 / 彩色可切换） ====================
// 图标风格："line"（默认，内联 SVG 线条）| "color"（static/icons/color/ 彩色 SVG）
// 主页从 localStorage 恢复上次选择；分享页不读主站键（保持默认线条，避免污染）
let iconStyle = (!SHARE_MODE && loadLS("drive.iconStyle") === "color") ? "color" : "line";
// 按当前风格取类型图标 HTML：line → 内联线条 SVG；color → <img> 彩色 SVG
function typeIcon(kind, size) {
  const s = size || 24;
  if (iconStyle === "color") {
    return '<img src="' + BASE + "static/icons/color/" + kind + '.svg" width="' + s +
           '" height="' + s + '" alt="" style="vertical-align:-3px" loading="lazy">';
  }
  return icon(kind, s);
}
// 文件类型图标：按扩展名取类型图标（line 内联 currentColor / color 彩色 img）
function fileIcon(name, size) {
  return typeIcon(iconOf(name), size || 24);
}
// 取指定尺寸的内联 SVG（垂直居中对齐）
function icon(name, size) {
  const s = size || 16;
  return (ICONS[name] || "").replace('<svg ', '<svg width="' + s + '" height="' + s + '" style="vertical-align:-3px" ');
}

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
// C4（t13 批次1）：esc 加 null 守卫——null/undefined 按空串处理，不再抛 TypeError
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

// ==================== T36 敏感信息脱敏（P1：预览页密钥类内容自动打码） ====================
// 共享函数 maskSensitive(text)：对疑似真实密钥打码（保留前4后4，中间 ****）。
// 规则：PRIVATE KEY 整块 / 键值式(api_key|secret|password|token=值) / sk- / AKIA / ghp_ / xox。
// 仅打码"疑似真实密钥"（含数字或足够长度），避免误伤普通文本。
let previewMask = true;   // 预览默认脱敏；弹窗/独立页切换按钮可临时改为明文

function _maskVal(v, force) {
  if (force) {
    // sk-/AKIA/ghp_/xox 等前缀明确是密钥：无条件打码
    return v.length <= 8 ? "****" : v.slice(0, 4) + "****" + v.slice(-4);
  }
  // 键值形式：仅打码疑似真实密钥（含数字，或足够长 ≥16 无数字）
  if (v.length < 8) return v;
  const likelyKey = /\d/.test(v) || v.length >= 16;
  if (!likelyKey) return v;
  return v.length <= 8 ? "****" : v.slice(0, 4) + "****" + v.slice(-4);
}

let _maskRules = null;
function _maskRulesInit() {
  if (_maskRules) return _maskRules;
  _maskRules = [
    // 1) PEM 私钥整块 → 占位模板（[\s\S]*? 可跨换行）
    { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
      fn: () => "-----BEGIN PRIVATE KEY-----\n****（已脱敏）\n-----END PRIVATE KEY-----" },
    // 2) 键值形式：key = value（只打码值部分；键名可出现在标识符中段如 my_api_key；
    //    值可带单双引号，打码时保留引号）
    { re: /(^|[^A-Za-z0-9])(api[_-]?key|secret|passwd|password|token|access[_-]?token|auth[_-]?token)(\s*[:=]\s*)(["']?)([A-Za-z0-9._~+\/=-]{8,})(["']?)/gi,
      fn: (m, pre, key, sep, q1, val, q2) => pre + key + sep + q1 + _maskVal(val, false) + q2 },
    // 3) OpenAI sk-
    { re: /\bsk-([A-Za-z0-9_-]{16,})/g, fn: (m, v) => "sk-" + _maskVal(v, true) },
    // 4) AWS AKIA
    { re: /\bAKIA([0-9A-Z]{16})/g, fn: (m, v) => "AKIA" + _maskVal(v, true) },
    // 5) GitHub PAT ghp_
    { re: /\bghp_([A-Za-z0-9]{20,})/g, fn: (m, v) => "ghp_" + _maskVal(v, true) },
    // 6) Slack xoxb/xoxa/xoxp/xoxr/xoxs
    { re: /\bxox[baprs]-([A-Za-z0-9-]{10,})/g, fn: (m, v) => "xox" + m[3] + "-" + _maskVal(v, true) },
  ];
  return _maskRules;
}

// 快速预检：文本不含任何可疑前缀/关键词时直接返回（避免大文本无谓正则开销）
function _maybeSensitive(text) {
  const probes = ["sk-", "akia", "ghp_", "xox", "private key", "api", "secret",
                  "passwd", "password", "token", "access", "auth"];
  const low = text.toLowerCase();
  for (let i = 0; i < probes.length; i++) {
    if (low.indexOf(probes[i]) >= 0) return true;
  }
  return false;
}

function maskSensitive(text) {
  if (!text || typeof text !== "string") return text;
  if (!/\w/.test(text)) return text;                    // 纯符号/空白：跳过
  if (!_maybeSensitive(text)) return text;               // 快速路径
  let out = text;
  const rules = _maskRulesInit();
  for (let i = 0; i < rules.length; i++) {
    out = out.replace(rules[i].re, rules[i].fn);
  }
  return out;
}
function isPinned(p) { return pinned.some(x => x.path === p); }
function dlUrl(p) { return BASE + "dl?path=" + encodeURIComponent(p); }

// 按扩展名分类文件类型（与后端 preview 保持一致）
const VIDEO_EXT = ["mp4","webm","ogv","ogg","m4v","mov","mkv","avi","ts","flv"];
const IMAGE_EXT = ["jpg","jpeg","png","gif","webp","bmp","svg","ico","tif","tiff","avif","heic"];
const MD_EXT = ["md","markdown"];
const TEXT_EXT = ["txt","log","json","js","ts","jsx","tsx","py","java","c","cpp","h","hpp","cs","go","rs","php","rb","sh","bat","ps1","html","htm","css","scss","xml","yaml","yml","toml","ini","conf","cfg","csv","sql","env","gitignore"];  // svg 已移出：归图片预览
const ARCHIVE_EXT = ["zip", "rar", "7z", "tar", "tgz", "tbz2", "txz", "gz", "bz2", "xz"];   // T25：多格式解压预览
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
// B6（t13 批次1）：当前预览闭包的统一清理函数（revoke 全部 Blob URL / removeTrack）。
// openModal 替换内容与 hidden.bs.modal 关闭弹窗时各执行一次；无预览注册时为 no-op。
let _activePreviewCleanup = null;
function _runPreviewCleanup() {
  if (_activePreviewCleanup) {
    try { _activePreviewCleanup(); } catch (e) { /* 忽略 */ }
    _activePreviewCleanup = null;
  }
}
function openModal(title, bodyNode, state) {
  $("appModalTitle").textContent = title;
  const b = $("appModalBody");
  // 打开新弹窗前先彻底停止旧弹窗里的音视频（防止后台继续播放/下载）
  b.querySelectorAll("video,audio").forEach(stopMedia);
  _runPreviewCleanup();   // B6：旧预览的 Blob URL 统一 revoke（先 stopMedia 清 src，再 revoke）
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
  _runPreviewCleanup();   // B6：弹窗关闭统一 revoke Blob URL（含 <track> removeTrack）
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
  b.innerHTML = label;   // 支持 T17 内联 SVG 图标（icon() 输出为内部常量，无注入风险）
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
// ==================== T18 全屏预览重构（方案B：独立预览页 /view） ====================
// 废弃 T11 方案A 的 DOM 移动全屏层（视频黑屏/位置错乱）："⛶ 放大"改为新标签页打开独立预览页。
// 独立页 view.html 复用同一套渲染辅助（renderMarkdown/fillTextChunked/parseCsv/api 契约）。

// 预览弹窗内容顶部操作行（T21：⛶ 放大 + ⓘ 详情；详情不再每行常驻，从预览弹窗进入）
// detailPath 传入时额外显示"详情"按钮（showDetail）
function addFsButton(body, title, path, downloadUrl, detailPath) {
  const row = document.createElement("div");
  row.className = "d-flex justify-content-end mb-2";
  if (detailPath) {
    const d = document.createElement("button");
    d.type = "button";
    d.className = "btn btn-sm btn-outline-secondary me-1";
    d.innerHTML = icon("info", 14) + " 详情";
    d.onclick = () => showDetail(detailPath, title);
    row.appendChild(d);
  }
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn btn-sm btn-outline-secondary";
  b.innerHTML = icon("max", 14) + " 放大";
  b.title = "新标签页打开独立预览";
  b.onclick = () => {
    window.open(BASE + "view?path=" + encodeURIComponent(path) + "&name=" + encodeURIComponent(title || ""), "_blank");
  };
  row.appendChild(b);
  body.insertBefore(row, body.firstChild);
  return row;
}

// ==================== T18 独立预览页渲染（/view 页面复用；弹窗版 show* 保持稳定不动） ====================
function renderPreview(kind, path, name, container) {
  if (kind === "video") return renderVideoPreview(path, name, container);
  if (kind === "image") return renderImagePreview(path, name, container);
  if (kind === "pdf") return renderPdfPreview(path, name, container);
  if (kind === "csv") return renderCsvPreview(path, name, container);
  if (kind === "archive") return renderUnpackPreview(path, name, container);
  if (kind === "text" || kind === "markdown") return renderTextPreview(path, name, container);
  if (kind === "detail") return renderDetailPreview(path, name, container);
  container.innerHTML = '<p class="muted">暂不支持预览该类型</p>';
  return null;
}

// 文本/代码（独立页：大字号 + 全屏滚动；与 showText 共用 renderMarkdown/fillTextChunked）
async function renderTextPreview(path, name, container) {
  container.innerHTML = '<div class="text-center text-secondary py-4">加载中…</div>';
  let j;
  try { j = await api("api/read?path=" + encodeURIComponent(path)); }
  catch (e) { container.innerHTML = '<p class="muted">加载失败: ' + esc(e && e.message) + "</p>"; return; }
  if (j.error) { container.innerHTML = '<p class="muted">' + esc(j.error) + "</p>"; return; }
  container.innerHTML = "";
  const note = document.createElement("div");
  note.className = "mdl-note";
  note.textContent = "编码: " + j.encoding + (j.truncated ? " · 仅预览前 " + fmtSize(j.read_bytes || strBytes(j.content)) : "") +
    (previewMask ? " · 敏感信息已打码" : " · 显示明文");
  container.appendChild(note);
  let text = j.content;
  if (text.length > 400000) text = text.slice(0, 400000);
  if (previewMask) text = maskSensitive(text);   // T36 敏感信息脱敏
  const holder = document.createElement("div");
  holder.className = "view-text";
  if (j.kind === "markdown") {
    holder.innerHTML = renderMarkdown(text);
    if (typeof hljs !== "undefined") { try { holder.querySelectorAll(".md-code code").forEach(el => hljs.highlightElement(el)); } catch (e) { /* 忽略 */ } }
  } else if (CODE_EXT.indexOf(extOf(name)) >= 0) {
    const pre = document.createElement("pre");
    pre.className = "text-pre code-hl";
    const codeEl = document.createElement("code");
    codeEl.className = "hljs";
    pre.appendChild(codeEl);
    holder.appendChild(pre);
    if (text.length <= 200000) {
      codeEl.textContent = text;
      if (typeof hljs !== "undefined") { try { hljs.highlightElement(codeEl); } catch (e) { /* 忽略 */ } }
    } else {
      fillTextChunked(codeEl, text, 32768, () => false);
    }
  } else {
    const pre = document.createElement("pre");
    pre.className = "text-pre";
    holder.appendChild(pre);
    fillTextChunked(pre, text, 32768, () => false);
  }
  container.appendChild(holder);
}

// CSV（独立页：表格全宽滚动）
async function renderCsvPreview(path, name, container) {
  container.innerHTML = '<div class="text-center text-secondary py-4">加载中…</div>';
  let j;
  try { j = await api("api/read?path=" + encodeURIComponent(path)); }
  catch (e) { container.innerHTML = '<p class="muted">加载失败: ' + esc(e && e.message) + "</p>"; return; }
  if (j.error) { container.innerHTML = '<p class="muted">' + esc(j.error) + "</p>"; return; }
  container.innerHTML = "";
  let text = j.content;
  if (text.length > 300000) text = text.slice(0, 300000);
  const rows = parseCsv(text).slice(0, 2000);
  let html = '<div style="width:100%;overflow:auto"><table class="table table-sm table-bordered table-striped mb-0">';
  rows.forEach((r, idx) => {
    const isHead = idx === 0;
    html += isHead ? "<thead><tr>" : "<tr>";
    r.forEach(c => {
      const cell = previewMask ? maskSensitive(c) : c;   // T36 逐单元格脱敏，保持表格结构
      html += (isHead ? "<th>" : "<td>") + esc(cell) + (isHead ? "</th>" : "</td>");
    });
    html += isHead ? "</tr></thead>" : "</tr>";
  });
  html += "</table></div>";
  container.innerHTML = html;
}

// 解压列表（独立页）
async function renderUnpackPreview(path, name, container) {
  container.innerHTML = '<div class="text-center text-secondary py-4">加载中…</div>';
  let j;
  try { j = await api("api/unpack?path=" + encodeURIComponent(path)); }
  catch (e) { container.innerHTML = '<p class="muted">加载失败: ' + esc(e && e.message) + "</p>"; return; }
  if (j.error) { container.innerHTML = '<p class="muted">' + esc(j.error) + "</p>"; return; }
  if (j.format === "unsupported") { container.innerHTML = '<p class="muted">该格式暂不支持在线解压</p>'; return; }
  container.innerHTML = "";
  const entries = Array.isArray(j.entries) ? j.entries : [];
  if (!entries.length) { container.innerHTML = '<p class="muted">压缩包为空</p>'; return; }
  const list = document.createElement("div");
  list.className = "unpack-list";
  entries.forEach(en => {
    const row = document.createElement("div");
    row.className = "unpack-row" + (en.is_dir ? " dir" : "");
    row.innerHTML = '<span class="ic">' + (en.is_dir ? typeIcon("folder", 16) : fileIcon(en.name, 18)) + "</span>" +
      '<span class="uname"></span>' +
      '<span class="usz">' + (en.is_dir ? "" : fmtSize(en.size)) + "</span>";
    row.querySelector(".uname").textContent = en.name;
    if (!en.is_dir) {
      row.onclick = () => { location.href = BASE + "api/unpackdl?archive=" + encodeURIComponent(path) + "&entry=" + encodeURIComponent(en.path_in_archive); };
    }
    list.appendChild(row);
  });
  container.appendChild(list);
}

// 图片（独立页：大图 contain + 滚轮缩放）
function renderImagePreview(path, name, container) {
  container.innerHTML = "";
  const img = document.createElement("img");
  img.className = "view-img";
  img.alt = name;
  let scale = 1;
  container.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    scale = Math.min(8, Math.max(0.1, scale * (ev.deltaY < 0 ? 1.1 : 0.9)));
    img.style.transform = "scale(" + scale + ")";
  }, { passive: false });
  img.onerror = () => { container.innerHTML = '<p class="muted">图片加载失败或格式不受支持</p>'; };
  container.appendChild(img);
  img.src = BASE + "api/img?path=" + encodeURIComponent(path);
}

// PDF（独立页：全屏 iframe）
function renderPdfPreview(path, name, container) {
  container.innerHTML = "";
  const iframe = document.createElement("iframe");
  iframe.src = BASE + "api/pdf?path=" + encodeURIComponent(path);
  iframe.style.cssText = "width:100%;height:100%;border:0;border-radius:8px;background:#fff";
  container.appendChild(iframe);
}

// 详情（独立页：信息表）
async function renderDetailPreview(path, name, container) {
  container.innerHTML = '<div class="text-center text-secondary py-4">加载中…</div>';
  let j;
  try { j = await api("api/stat?path=" + encodeURIComponent(path)); }
  catch (e) { container.innerHTML = '<p class="muted">加载失败: ' + esc(e && e.message) + "</p>"; return; }
  if (j.error) { container.innerHTML = '<p class="muted">' + esc(j.error) + "</p>"; return; }
  container.innerHTML = "";
  const rows = [
    ["名称", j.name, { icon: j.is_dir ? typeIcon("folder", 16) : fileIcon(j.name, 16) }],
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
    if (r[2] && r[2].icon) val += "<span class='me-1' style='vertical-align:-2px'>" + r[2].icon + "</span>";
    tr.innerHTML = "<td class='k'>" + esc(r[0]) + "</td>" + val + esc(r[1]) + "</td>";
    tbl.appendChild(tr);
  });
  container.appendChild(tbl);
}

// 视频（独立页：简化播放器——原生控件 + 原画流，深色大屏沉浸）
function renderVideoPreview(path, name, container) {
  container.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "view-video";
  const v = document.createElement("video");
  v.controls = true;
  v.playsinline = true;
  v.setAttribute("webkit-playsinline", "");
  v.preload = "metadata";
  v.crossOrigin = "anonymous";
  wrap.appendChild(v);
  container.appendChild(wrap);
  v.src = BASE + "api/stream?path=" + encodeURIComponent(path);
  v.onerror = () => { container.innerHTML = '<p class="muted">视频加载失败或不可播放</p>'; };
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
  openPreviewModal(name, { type: "detail", path, name }, null, async ({ body, ac }) => {
  const j = await api("api/stat?path=" + encodeURIComponent(path), { signal: ac.signal });
  if (j.error) { body.innerHTML = '<p class="muted">' + esc(j.error) + "</p>"; return; }
  body.innerHTML = "";
  const rows = [
    ["名称", j.name, { icon: j.is_dir ? typeIcon("folder", 16) : fileIcon(j.name, 16) }],
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
      val += "<span class='me-1' style='vertical-align:-2px'>" + r[2].icon + "</span>";
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
    // ---- 结构化解析字段（来源 api/stat 的 details.meta；识别到才展示，原则同 renderMeta）----
    const mo = d.meta || {};
    const metaRows = [];
    const addMeta = (label, v) => {
      if (v === undefined || v === null || v === "") return;
      metaRows.push([label, v]);
    };
    addMeta("评分", mo.rating);
    addMeta("话数", mo.episodes);
    addMeta("放送", mo.broadcast);
    addMeta("制 作", mo.studio);
    addMeta("观 看", mo.views);
    addMeta("点赞率", mo.likes);
    addMeta("收 藏", mo.favorites);
    addMeta("上 传", mo.upload);
    if (mo.cast) addMeta("声优", mo.cast);
    if (mo.director) addMeta("监督", mo.director);
    if (mo.original) addMeta("原作", mo.original);
    if (mo.region) addMeta("地区", mo.region);
    if (mo.year) addMeta("年份", mo.year);
    if (mo.quality) addMeta("画质", mo.quality);
    if (mo.subtitle) addMeta("字幕", mo.subtitle);
    if (Array.isArray(mo.tags) && mo.tags.length) addMeta("标签", mo.tags.join("、"));
    if (Array.isArray(mo.notes) && mo.notes.length) addMeta("备注", mo.notes.join("\n"));
    if (Array.isArray(mo.extra) && mo.extra.length) addMeta("其他", mo.extra.map(e => e.k + " " + e.v).join("\n"));
    const pairs = [
      ["标题", d.title],
      ["作者", d.artist],
      ["专辑", d.album],
      ["类型", d.genre],
      ["日期", d.date],
      ["时长", d.duration_text],
      ["分辨率", d.resolution],
    ];
    // 去重：原始表已出现的标签（标题/作者/专辑/类型/日期）不再在解析段重复（P4c）
    const rawLabels = new Set();
    pairs.forEach(p => { if (p[1] !== undefined && p[1] !== null && p[1] !== "") rawLabels.add(p[0]); });
    // 共通去重：解析「制片/制作」与原始「作者」同名 → 二选一，只保留作者（避免 MADHOUSE 两处）
    const dedupedMeta = metaRows.filter(([label]) => {
      if (label === "标题") return !rawLabels.has("标题");
      if (label === "作者") return !rawLabels.has("作者");
      if (label === "类型") return !rawLabels.has("类型");
      if (label === "制 作" && d.artist && mo.studio && String(d.artist).trim() === String(mo.studio).trim()) return false;
      return true;
    });

    // 技术参数（编码器/码率/采样率等）不走平铺表，折叠为「⚙ 技术信息」（根因1/P3）
    const techRows = [
      ["视频编码", d.video_codec], ["音频编码", d.audio_codec], ["采样率", d.sample_rate],
      ["声道", d.channels], ["容器码率", d.container_bitrate], ["创建时间", d.created_time],
      ["生成工具", d.encoder],
    ];

    const _addRow = (tbl, label, valRaw, longAllowed) => {
      if (valRaw === undefined || valRaw === null || valRaw === "") return;
      let val = String(valRaw);
      let tip = "";
      if (longAllowed && val.length > 120) {   // 长文本省略 + title 悬停完整
        val = val.slice(0, 120) + "…";
        tip = " title='" + esc(String(valRaw)) + "'";
      }
      const tr = document.createElement("tr");
      tr.innerHTML = "<td class='k'>" + esc(label) + "</td><td class='v'" + tip + ">" + esc(val) + "</td>";
      tbl.appendChild(tr);
    };

    const t2 = document.createElement("table");
    t2.className = "detail-tbl";
    pairs.forEach(p => _addRow(t2, p[0], p[1], p[0] === "备注/评论" || p[0] === "备注"));
    // 解析字段：分隔标题 + 逐项行（已去重）
    if (dedupedMeta.length) {
      const sep = document.createElement("tr");
      sep.className = "detail-sec-row";
      sep.innerHTML = "<td class='k' colspan='2'>── 解析字段 ──</td>";
      t2.appendChild(sep);
      dedupedMeta.forEach(([label, val]) => _addRow(t2, label, val, label === "备注" || label === "其他"));
    }
    if (t2.children.length) body.appendChild(t2);

    // 原始 comment 备注：解析字段已逐项展示时，原始串折叠为「备注原文」（根因2，避免两边同时平铺重复）
    if (d.comment !== undefined && d.comment !== null && d.comment !== "") {
      const rawComment = String(d.comment);
      if (dedupedMeta.length) {
        const det = document.createElement("details");
        det.className = "vtech-details detail-note-collapse mt-2";
        const sum = document.createElement("summary");
        sum.className = "vtech-summary";
        sum.textContent = "📄 备注原文";
        sum.title = "comment 原始串（解析字段已逐项展示在上方）；展开可查看原文";
        det.appendChild(sum);
        const pre = document.createElement("div");
        pre.className = "detail-note-raw";
        pre.textContent = rawComment;
        det.appendChild(pre);
        body.appendChild(det);
      } else {
        const tbl = document.createElement("table");
        tbl.className = "detail-tbl mt-2";
        _addRow(tbl, "备注/评论", rawComment, true);
        if (tbl.children.length) body.appendChild(tbl);
      }
    }

    // 技术信息折叠块（根因1/P3）：与面板一致用 <details>
    if (techRows.some(r => r[1] !== undefined && r[1] !== null && r[1] !== "")) {
      const det = document.createElement("details");
      det.className = "vtech-details mt-2";
      const sum = document.createElement("summary");
      sum.className = "vtech-summary";
      sum.textContent = "⚙ 技术信息";
      sum.title = "编码器 / 码率 / 采样率 / 声道等文件固有参数，点击展开";
      det.appendChild(sum);
      const tbl = document.createElement("table");
      tbl.className = "detail-tbl mt-1";
      techRows.forEach(r => _addRow(tbl, r[0], r[1], false));
      det.appendChild(tbl);
      body.appendChild(det);
    }
  }
  const btns = document.createElement("div");
  btns.className = "d-flex flex-wrap gap-2 mt-3";
  // 预览按钮与文件列表分流保持一致（pdf/csv/lnk 也支持在线预览）
  const fk = fileKind(j.name);
  if (fk === "video") btns.appendChild(mkBtn(icon("play", 14) + " 在线预览", () => showVideo(j.path, j.name)));
  else if (fk === "image") btns.appendChild(mkBtn(icon("image", 14) + " 图片预览", () => showImage(j.path, j.name)));
  else if (fk === "markdown" || fk === "text") btns.appendChild(mkBtn(icon("text", 14) + " 在线查看", () => showText(j.path, j.name)));
  else if (fk === "archive") btns.appendChild(mkBtn(icon("archive", 14) + " 解压预览", () => showUnpack(j.path, j.name)));
  else if (fk === "pdf") btns.appendChild(mkBtn(icon("text", 14) + " PDF 预览", () => showPdf(j.path, j.name)));
  else if (fk === "csv") btns.appendChild(mkBtn(icon("list", 14) + " 表格预览", () => showCsv(j.path, j.name)));
  else if (fk === "lnk") btns.appendChild(mkBtn(icon("link", 14) + " 快捷方式跳转", () => showLnk(j.path, j.name)));
  const shareBtn = document.createElement("button");
  shareBtn.className = "btn btn-outline-secondary";   // 与操作面板分享按钮同风格（柔和灰描边）
  shareBtn.innerHTML = icon("share", 14) + (SHARE_MODE ? " 二次分享" : " 再分享");
  shareBtn.onclick = () => showShareDialog(j.path, j.name, SHARE_MODE ? { sub: true } : undefined);
  btns.appendChild(shareBtn);
  if (!j.locked && !j.is_dir) btns.appendChild(mkBtn(icon("download", 14) + " 下载", () => { location.href = dlUrl(j.path); }));
  if (btns.children.length) body.appendChild(btns);
  addFsButton(body, name, path, dlUrl(path));   // ⛶ 全屏放大详情
  });
}

// ---------------- 功能 2：视频在线播放 ----------------
// 高级播放器：画质选择 + 免证书(MSE)模式 + 缓存下载 + 字幕 + 拖动预览。
// 原生模式：video.src 直连流（原画 api/stream 或转码档 api/transdl）。
// MSE 模式：MediaSource + SourceBuffer 从 api/trans 按 offset 顺序拉 fMP4 分片追加，
//           浏览器对 MSE 喂入数据的格式嗅探不受"媒体子资源证书限制"，免装证书即可播放。
function showVideo(path, name) {
  const body = document.createElement("div");
  // B6（t13 批次1）：本预览创建的全部 Blob URL（subVtt/asrVtt/strip/MSE）统一登记，
  // 弹窗关闭时一次 revoke；disposed 标记让关闭后仍在飞行的异步回调（字幕/识别/缩略图条）
  // 新创建的 URL 直接 revoke，不做无谓保留，避免关闭后再泄漏。
  const blobUrls = [];
  let disposed = false;
  function keepBlob(u) {
    if (!u) return u;
    if (disposed) { try { URL.revokeObjectURL(u); } catch (e) { /* 忽略 */ } }
    else { blobUrls.push(u); }
    return u;
  }
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
  addFsButton(body, name, path, dlUrl(path), path);
  const v = document.createElement("video");
  v.controls = true;
  v.playsinline = true;
  v.setAttribute("webkit-playsinline", ""); // 老 iOS 兼容：同 playsinline，禁止全屏自动拉起
  v.preload = "metadata";
  v.crossOrigin = "anonymous";
  wrap.appendChild(v);
  body.appendChild(wrap);
  // ---- 固定视窗宽高比（依据源视频宽高与旋转）：切画质/切模式时分辨率变化，
  // video 元素高度不再跳动 → 播放器视窗/弹窗布局稳定不闪烁 ----
  function setViewportRatio(w, h, rot) {
    if (!(w > 0) || !(h > 0)) return;
    const swapped = (rot || 0) % 180 !== 0;   // 旋转 90/270：宽高互换
    const ratio = (swapped ? h : w) / (swapped ? w : h);
    try { wrap.style.aspectRatio = String(ratio); } catch (e) { /* 忽略 */ }
    try { v.style.aspectRatio = String(ratio); } catch (e) { /* 忽略 */ }
  }
  // 切换播放源（画质/模式）前定格当前帧作为 poster：重新加载期间画面不闪黑。
  // 播放恢复（新流首帧可渲染：loadeddata/canplay/playing 任一）时清除定格帧；
  // 多事件兜底——MSE 下 loadeddata 时序不稳定，单一事件可能漏清导致画面永久定格。
  function freezeFrame() {
    try {
      if (!v.videoWidth || !v.videoHeight) return;
      const canvas = document.createElement("canvas");
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      canvas.getContext("2d").drawImage(v, 0, 0);
      v.poster = canvas.toDataURL("image/jpeg", 0.6);
      const clear = () => {
        v.removeAttribute("poster");   // 必须 removeAttribute：poster="" 会被解析为相对 URL（页面地址）而非清空
        ["loadeddata", "canplay", "playing"].forEach(evt => v.removeEventListener(evt, clear));
      };
      ["loadeddata", "canplay", "playing"].forEach(evt => v.addEventListener(evt, clear));
    } catch (e) { /* 忽略 */ }
  }
  // ---- 进度条预览（缩略图条 + 单帧） ----
  const prev = document.createElement("div");
  prev.className = "video-preview";
  prev.style.display = "none";
  let prevW = 160;   // 预览图宽度（滑动/停止均为 160px；备用变量，防止 ReferenceError）
  const prevImg = document.createElement("img");
  prevImg.alt = "";
  prev.appendChild(prevImg);
  wrap.appendChild(prev);   // 挂到 wrap（position:relative）→ bottom 相对视频容器，进度条上方
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
    h.className = "fw-bold mb-2 vtitle";
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
    // ---- 作者行：头像 + 名字 + 类型徽章 + 制作公司徽章（去重：studio 与 author 相同不重复展示） ----
    const auth = document.createElement("div");
    auth.className = "d-flex flex-wrap align-items-center gap-2 vmeta-authors";
    const _display = m.author || m.studio || "";
    if (m.studio && m.studio !== _display) {   // 制作公司名牌（仅当与展示名不同才单独列出，避免 MADHOUSE 两处）
      const st = document.createElement("span");
      st.className = "vstudio-badge";
      st.textContent = m.studio;
      st.title = "制作公司：" + m.studio;
      auth.appendChild(st);
    }
    if (_display) {
      const av = document.createElement("span");
      av.className = "vavatar d-inline-flex align-items-center justify-content-center rounded-circle bg-primary text-white";
      av.textContent = _display.charAt(0) || "U";
      av.title = "作者头像：" + _display;
      auth.appendChild(av);
      const nm = document.createElement("span");
      nm.className = "fw-semibold small vname";
      nm.textContent = _display;
      nm.title = _display + (m.studio && m.studio === _display ? "（制作公司）" : "");
      auth.appendChild(nm);
    }
    if (m.type) {
      const b = document.createElement("span");
      b.className = "badge ms-1 vtype-badge " + (m.type === "裏番" ? "text-bg-warning" : "text-bg-secondary");
      b.textContent = m.type;
      b.title = "类型：" + m.type;
      auth.appendChild(b);
    }
    if (auth.children.length) metaBox.appendChild(auth);

    // ---- 资料行（data：评分/话数/放送 为核心——制作公司已并入作者行避免重复；扩展字段为次要） ----
    const dataCore = [];
    if (m.rating) {   // 评分徽章：★9.4（站内评分，与「点赞率」在统计行区分）
      const b = document.createElement("span");
      b.className = "vdata-chip vrate";
      const st = document.createElement("span");
      st.className = "vrate-star";
      st.textContent = "★";
      b.appendChild(st);
      b.appendChild(document.createTextNode(m.rating));
      b.title = "评分 " + m.rating;
      dataCore.push(b);
    }
    if (m.episodes) {
      const b = document.createElement("span");
      b.className = "vdata-chip";
      b.textContent = "全" + m.episodes + "话";
      b.title = "话数 " + m.episodes;
      dataCore.push(b);
    }
    if (m.broadcast) {
      const b = document.createElement("span");
      b.className = "vdata-chip";
      b.textContent = m.broadcast;
      b.title = "放送 " + m.broadcast;
      dataCore.push(b);
    }
    const dataSec = [];
    {   // 次要资料字段（聚合进第二行；识别到才显示）
      const secMap = [
        ["cast", "CV"], ["director", "监督"], ["original", "原作"],
        ["region", "地区"], ["year", "年份"], ["quality", "画质"], ["subtitle", "字幕"],
      ];
      secMap.forEach(([k, lbl]) => {
        if (m[k]) {
          const b = document.createElement("span");
          b.className = "vdata-chip vdata-sub";
          b.textContent = lbl + " " + m[k];
          b.title = lbl + " " + m[k];
          dataSec.push(b);
        }
      });
    }
    if (dataCore.length || dataSec.length) {
      const drow = document.createElement("div");
      drow.className = "vdata-row mt-2";
      const coreWrap = document.createElement("div");
      coreWrap.className = "d-flex flex-wrap align-items-center gap-1";
      dataCore.forEach(c => coreWrap.appendChild(c));
      if (dataCore.length) drow.appendChild(coreWrap);
      if (dataSec.length) {
        const secWrap = document.createElement("div");
        secWrap.className = "d-flex flex-wrap align-items-center gap-1 vdata-sec";
        dataSec.forEach(c => secWrap.appendChild(c));
        drow.appendChild(secWrap);
      }
      metaBox.appendChild(drow);
    }

    // ---- 统计行（stats：观看/点赞率/收藏/上传；时长/分辨率。防窄屏裁切见 CSS .vstat） ----
    const stats = [];
    if (m.views) stats.push(["👁", "观看", m.views, "观看 " + m.views]);
    if (m.likes) stats.push(["👍", "点赞率", m.likes, "点赞率（好评率）" + m.likes]);
    if (m.favorites) stats.push(["⭐", "收藏", m.favorites, "收藏 " + m.favorites]);
    if (m.upload) stats.push(["📅", "上传", m.upload, "上传 " + m.upload]);
    if (m.duration) stats.push(["⏱", "时长", m.duration, "时长 " + m.duration]);
    if (m.resolution && !m.quality) stats.push(["🖥", "分辨率", m.resolution, "分辨率 " + m.resolution]);   // 已用「画质」表同一信息则不重复
    if (stats.length) {
      const srow = document.createElement("div");
      srow.className = "d-flex flex-wrap align-items-center gap-2 mt-2 vstats";
      stats.forEach(s => {
        const it = document.createElement("span");
        it.className = "vstat";
        it.title = s[3];
        const ic = document.createElement("span");
        ic.className = "vstat-ic";
        ic.textContent = s[0];
        const lb = document.createElement("span");
        lb.className = "vstat-label";
        lb.textContent = s[1];
        const vl = document.createElement("span");
        vl.className = "vstat-val";
        vl.textContent = s[2];
        it.appendChild(ic);
        it.appendChild(lb);
        it.appendChild(vl);
        srow.appendChild(it);
      });
      metaBox.appendChild(srow);
    }
    // 标签行（B 站风格胶囊徽章；前缀用 🏷 chip 与前排 pill 样式统一）
    if (m.tags && m.tags.length) {
      const tr = document.createElement("div");
      tr.className = "d-flex flex-wrap align-items-center gap-1 mt-2 vtag-row";
      const lbl = document.createElement("span");
      lbl.className = "vtag-prefix";
      lbl.textContent = "🏷 标签";
      lbl.title = "标签";
      tr.appendChild(lbl);
      m.tags.forEach(t => {
        const b = document.createElement("span");
        b.className = "badge rounded-pill text-bg-light border vtag";
        b.textContent = t;
        tr.appendChild(b);
      });
      metaBox.appendChild(tr);
    }
    // 备注/简介卡片（notes 为主，extra 用户级未知键并入一行；超 3 行折叠，保持）
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
    // 技术信息（编码器/码率/声道等文件固有信息）：折叠为「技术信息」区，默认收起，降权展示（P3）
    if (m.tech && m.tech.length) {
      const det = document.createElement("details");
      det.className = "vtech-details mt-2";
      const sum = document.createElement("summary");
      sum.className = "vtech-summary";
      sum.textContent = "⚙ 技术信息";
      sum.title = "编码器 / 码率 / 采样率 / 声道等文件固有参数，点击展开";
      det.appendChild(sum);
      const tr = document.createElement("div");
      tr.className = "d-flex flex-wrap align-items-center gap-1 mt-1";
      m.tech.forEach(t => {
        const b = document.createElement("span");
        b.className = "badge text-bg-light border vtech";
        b.textContent = t.k + " " + t.v;
        b.title = t.k + " " + t.v;
        tr.appendChild(b);
      });
      det.appendChild(tr);
      metaBox.appendChild(det);
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
  btns.appendChild(mkBtn(icon("download", 14) + " 下载当前画质", () => {
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
let previewRatio = null; // 视频宽高比（h/w，loadedmetadata 后可用；预览图按此比例而非固定 90px）
  let lastFrameT = -1;     // 单帧预览防抖时间戳（80ms 内复用当前帧）
  let mimeCache = {};      // key=path|q → MSE mime（动态 codec，修复高清/标清/低清播不了）
  let mseDuration = 0;     // 源时长（vinfo 提供）；用于设置 MediaSource.duration，否则 seek 到缓冲外会被钳制到缓冲末尾
  let mseSeekGuard = 0;    // 重建时间戳：buildMse 重建期间/刚重建后忽略 seeking 事件，防止浏览器自动跳转触发二次重建循环
  let mseRetry = 0;        // append 失败重建重试计数（限 3 次，成功即清零）
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

  // 原生模式播放并（可选）恢复播放位置：切换 src 会让浏览器重新加载媒体（闪烁不可避免），
  // 但保持 currentTime 可避免"跳回开头"的额外突兀感。
  function playResume(resume) {
    if (resume > 0) {
      const onLoaded = () => {
        v.removeEventListener("loadedmetadata", onLoaded);
        v.removeAttribute("poster");   // 清除切换前的定格帧（画面已恢复）；poster="" 会被当相对 URL
        try { if (Math.abs(v.currentTime - resume) > 1) v.currentTime = resume; } catch (e) { /* 忽略 */ }
        v.play().catch(() => { /* 用户手势后静默 */ });
      };
      v.addEventListener("loadedmetadata", onLoaded);
    } else {
      v.removeAttribute("poster");   // 无位置恢复：直接清除定格帧
      v.play().catch(() => { /* 用户手势后静默 */ });
    }
  }

  function playNative(resumePos) {
    freezeFrame();   // 定格当前帧作 poster：切回原生（换 src 重新加载）期间画面不闪黑
    stopTransPoll();
    subMode = "none";
    clearSubOverlay();
    if (subChk.input.checked && subVtt) { subMode = "track"; }
    if (subVtt) v.setAttribute("crossorigin", "anonymous");
    else v.removeAttribute("crossorigin");
    const resume = (resumePos != null ? resumePos : v.currentTime) || 0;
    const q = qSel.value;
    if (q === "original") {
      // 原画：直连源流（缓存下载开关仅在此档生效）
      const url = BASE + "api/stream?path=" + encodeURIComponent(path) +
            (cacheChk.input.checked ? "&cache=1" : "");
      v.src = url;
      if (subMode === "track" && subVtt) attachTrack(subVtt.url);
      playResume(resume);
      return;
    }
    // 转码档：transdl 未转码完会返回 409。先查 transstatus，就绪则直接播；
    // 未就绪则打一次 transdl 触发后端开始转码（会 409 + 进度），随后每 2s 轮询（上限 120s）。
    const poll = { gen: 1, q, resume };
    transPoll = poll;
    fetch(BASE + "api/transstatus?path=" + encodeURIComponent(path) + "&q=" + q)
      .then(r => r.json().catch(() => null))
      .then(j => {
        if (transPoll !== poll || !v.isConnected) return;
        if (j && j.ready) startTransPlay(q, resume);
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
  function startTransPlay(q, resumePos) {
    stopTransPoll();
    v.src = BASE + "api/transdl?path=" + encodeURIComponent(path) + "&q=" + q;
    if (subMode === "track" && subVtt) attachTrack(subVtt.url);
    playResume(resumePos || 0);
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
        if (disposed) { try { URL.revokeObjectURL(url); } catch (e) { /* 忽略 */ } return; }   // B6：弹窗已关，立即释放
        subVtt = { url, src: txt };
        blobUrls.push(url);
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
        const url = URL.createObjectURL(new Blob([txt], { type: "text/vtt" }));
        if (disposed) { try { URL.revokeObjectURL(url); } catch (e) { /* 忽略 */ } return; }   // B6：弹窗已关，立即释放
        asrVtt = { url, src: txt };
        blobUrls.push(url);
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
          const d = parseFloat(j.duration);
          if (Number.isFinite(d) && d > 0) mseDuration = d;
          return j.mseMime;
        }
      }
    } catch (e) { /* vinfo 探测失败：用兜底 mime */ }
    mimeCache[key] = fallback;
    return fallback;
  }
  async function startMse(startPos) {
    freezeFrame();   // 定格当前帧：原生→MSE 切换（换 blob src）期间画面不闪黑
    stopTransPoll();
    if (mse) { stopStream(); }
    if (!window.MediaSource || !window.MediaSource.isTypeSupported) {
      showErr("该浏览器不支持 MediaSource，无法启用免证书模式");
      return;
    }
    const start = startPos || 0;              // 从原生切 MSE 时保持播放位置
    const q = qSel.value;                     // await 期间画质可能变化，用当时的 q
    const mime = await getMime(q);
    if (qSel.value !== q || !mseChk.input.checked || !v.isConnected) return;  // 状态已变则放弃
    if (!MediaSource.isTypeSupported(mime)) {
      showErr("浏览器不支持该格式的 fMP4 MSE 播放（" + mime + "）");
      return;
    }
    const ms = new MediaSource();
    mse = { ms, sb: null, fetching: false, offset: 0, buf: new Uint8Array(0), start, wantAppend: false, gen: (mse ? mse.gen : 0) + 1, fetchSeq: 0, pendingSeek: start, q };
    if (lastMsUrl) { try { URL.revokeObjectURL(lastMsUrl); } catch (e) { /* 忽略 */ } }
    lastMsUrl = keepBlob(URL.createObjectURL(ms));   // B6：MSE blob URL 一并登记，弹窗关闭统一 revoke
    v.src = lastMsUrl;
    const myGen = mse.gen;
    ms.addEventListener("sourceopen", () => {
      if (!mse || mse.gen !== myGen) return;
      // 设置 MediaSource duration（源时长）：允许 seek 到未缓冲位置，否则浏览器会把 currentTime 钳制到缓冲末尾
      try { if (mseDuration > 0) ms.duration = mseDuration; } catch (e) { /* 忽略 */ }
      try {
        const sb = ms.addSourceBuffer(mime);
        mse.sb = sb;
        sb.mode = "segments";
        // 从原生切 MSE 且带起播位置：数据时间戳从 start 偏移（后端 -ss start 输出时间戳 0 起）
        try { sb.timestampOffset = mse.start; } catch (e) { /* 忽略 */ }
        sb.addEventListener("updateend", () => {
          if (!mse || mse.gen !== myGen) return;
          // 上一轮 fetch 返回时 sb 正在 updating 暂存的数据：先补 append，避免丢帧
          if (mse.buf && mse.buf.length) {
            const arr = mse.buf;
            mse.buf = new Uint8Array(0);
            try { mse.sb.appendBuffer(arr); return; } catch (e) { /* 忽略 */ }
          }
          if (mse.wantAppend) {
            mse.wantAppend = false;
            pump();
          }
        });
        pump();
        // 勾选 MSE 后自动开始播放（startMse 原无 v.play，用户需再点一次播放才会动）
        try { v.play().catch(() => { /* autoplay 策略拒绝时静默，用户可手动点播放 */ }); } catch (e) { /* 忽略 */ }
      } catch (e) {
        showErr("MSE 初始化失败: " + e.message);
      }
    });
    // 字幕：MSE 模式用自定义 overlay
    if (subChk.input.checked && subVtt) { subMode = "overlay"; setupSubOverlay(); }
  }

  function seekMse(t) {
    if (!mse) return;
    mseSeekGuard = Date.now();   // 跳转期间忽略 seeking（新流时间戳偏移后浏览器自动跳转，防二次重建）
    mse.fetchSeq++;              // 使飞行中的旧拉取响应失效（其数据是旧时间轴，append 进来会污染新缓冲）
    mse.fetching = false;
    mse.start = t;
    mse.offset = 0;
    mse.buf = new Uint8Array(0);
    mse.wantAppend = false;
    if (mse.sb) {
      try { mse.sb.abort(); } catch (e) { /* 忽略 */ }
      // 时间戳偏移到 t：必须在 remove() 之前设置——remove 会使 sb 进入 updating 状态，
      // 此时给 timestampOffset 赋值会抛 InvalidStateError（被 catch 吞掉导致偏移静默失效）
      try { mse.sb.timestampOffset = t; } catch (e) { /* 忽略 */ }
      let removed = false;
      try { mse.sb.remove(0, mse.ms.duration || Infinity); removed = true; } catch (e) { /* 忽略 */ }
      if (removed) {
        mse.wantAppend = true;   // remove 完成后 updateend → pump 从新 start 拉流
      } else {
        pump();                  // remove 失败（无可清缓冲）：直接拉新流
      }
      // 不在这里直接设 currentTime：remove 清空缓冲后浏览器会把 currentTime 重置为 0，
      // 等新流首段数据 append 就绪（buffered 覆盖 t）后再拨过去（见 pump 的 pendingSeek 处理）
      mse.pendingSeek = t;
    } else {
      pump();
    }
  }

  async function buildMse(t) {
    if (!mse) return;
    freezeFrame();   // 定格当前帧：original↔转码档重建（换 blob src）期间画面不闪黑
    mseSeekGuard = Date.now();   // 重建期间忽略 seeking（新流时间戳偏移后浏览器自动跳转，防止触发二次重建）
    const mySeq = ++mseBuildSeq;          // 连续 seek/切画质只保留最后一次
    const q = qSel.value;
    const mime = await getMime(q);
    if (!mse || qSel.value !== q || mySeq !== mseBuildSeq || !v.isConnected) return;  // 状态已变则放弃
    if (!MediaSource.isTypeSupported(mime)) {
      showErr("浏览器不支持该格式的 fMP4 MSE 播放（" + mime + "）");
      return;
    }
    mse.gen++;
    mse.fetching = false;   // 修复：重建时重置拉取标志——旧 pump 的 fetch 响应会被 gen 检查丢弃（其 fetching 重置语句执行不到），
                            // 不重置则新流的 pump 永远被 fetching=true 挡住（seek/切画质后视频停住）
    try { mse.ms.removeAttribute("src"); } catch (e) { /* 忽略 */ }
    destroySb();
    try { mse.ms.endOfStream(); } catch (e) { /* 忽略 */ }
    mse.start = t;
    mse.offset = 0;
    mse.buf = new Uint8Array(0);
    mse.wantAppend = false;
    mse.q = q;                 // 记录当前画质（切画质时判断能否复用 SourceBuffer 避免闪烁）
    mse.pendingSeek = t;   // 重建后等新流首段就绪再拨 currentTime（避免归 0 卡在缓冲外）
    const ms = new MediaSource();
    mse.ms = ms;
    if (lastMsUrl) { try { URL.revokeObjectURL(lastMsUrl); } catch (e) { /* 忽略 */ } }
    lastMsUrl = keepBlob(URL.createObjectURL(ms));   // B6：MSE blob URL 一并登记，弹窗关闭统一 revoke
    v.src = lastMsUrl;
    const myGen = mse.gen;
    ms.addEventListener("sourceopen", () => {
      if (!mse || mse.gen !== myGen) return;
      // 设置 MediaSource duration（源时长）：允许 seek 到未缓冲位置，否则浏览器会把 currentTime 钳制到缓冲末尾
      try { if (mseDuration > 0) ms.duration = mseDuration; } catch (e) { /* 忽略 */ }
      try {
        const sb = ms.addSourceBuffer(mime);
        mse.sb = sb;
        sb.mode = "segments";
        // 切画质/seek 重建：后端 -ss start 输出的流时间戳从 0 起，timestampOffset 平移到 start，
        // 保证重建后 currentTime/进度条落在源时间轴的正确位置
        try { sb.timestampOffset = mse.start; } catch (e) { /* 忽略 */ }
        sb.addEventListener("updateend", () => {
          if (!mse || mse.gen !== myGen) return;
          // 上一轮 fetch 返回时 sb 正在 updating 暂存的数据：先补 append，避免丢帧
          if (mse.buf && mse.buf.length) {
            const arr = mse.buf;
            mse.buf = new Uint8Array(0);
            try { mse.sb.appendBuffer(arr); return; } catch (e) { /* 忽略 */ }
          }
          if (mse.wantAppend) { mse.wantAppend = false; pump(); }
        });
        pump();
        // 切画质/seek 重建后自动恢复播放（buildMse 原无 v.play，重建后视频会停在暂停态）
        try { v.play().catch(() => { /* autoplay 策略拒绝时静默 */ }); } catch (e) { /* 忽略 */ }
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
    if (!mse || !mse.sb) return;
    // 弹窗关闭（hidden.bs.modal → stopMedia 清 src）后 MediaSource 已被 detach、readyState 变为非 open：
    // 立即静默停止拉流（不 toast/不降级/不无限重试）；飞行中的 fetch 响应也会被 catch 容错丢弃
    try { if (mse.ms.readyState !== "open" || !v.isConnected) { mse.fetching = false; return; } } catch (e) { mse.fetching = false; return; }
    if (mse.fetching) { mse.wantAppend = true; return; }   // 修复：当前有 fetch 在飞时标记待续拉，旧响应释放 fetching 后补拉
    if (mse.sb.updating) { mse.wantAppend = true; return; }
    mse.fetching = true;
    const myGen = mse.gen;
    const myFetch = ++mse.fetchSeq;   // 拉取代际：seek 时递增使旧响应失效
    const q = qSel.value;
    const url = BASE + "api/trans?path=" + encodeURIComponent(path) +
                "&q=" + q + "&offset=" + mse.offset + "&need=524288&start=" + mse.start;
    fetch(url)
      .then(async res => {
        const done = res.headers.get("X-Trans-Finished") === "1";
        const newOff = parseInt(res.headers.get("X-Trans-Offset") || "0", 10);
        const blob = await res.blob();
        // 先释放 fetching（旧代响应也必须释放，否则 seek/重建后的新 pump 永远被 fetching=true 挡住）
        mse.fetching = false;
        if (!mse || mse.gen !== myGen || mse.fetchSeq !== myFetch) {
          // 旧代/旧 seek 的响应丢弃；若期间有拉取意图（wantAppend 被 pump 挡下时置位），补一次 pump
          if (mse && mse.sb && mse.wantAppend) { mse.wantAppend = false; pump(); }
          return;
        }
        if (!mse || !mse.sb) return;
        if (blob.size > 0) {
          const arr = new Uint8Array(await blob.arrayBuffer());
          if (!mse || mse.gen !== myGen || mse.fetchSeq !== myFetch) return;
          mse.offset = newOff;
          if (mse.sb.updating) { mse.buf = arr; mse.wantAppend = true; return; }
          try {
            mse.sb.appendBuffer(arr);
            if (done) { try { mse.ms.endOfStream(); } catch (e) { /* 忽略 */ } }
            else { mse.wantAppend = true; }  // 修复：append 完成后续拉下一段（updateend 触发 pump）
            mseRetry = 0;   // 拉流成功：重置重建重试计数
            // 挂起的 seek 目标：新流首段已就绪（buffered 已覆盖目标），把 currentTime 拨过去。
            // 设置时刷新 guard，防止触发的 seeking 再次进入防抖重建。
            if (mse.pendingSeek != null) {
              const pt = mse.pendingSeek;
              mse.pendingSeek = null;
              mseSeekGuard = Date.now();
              v.removeAttribute("poster");   // 清除切换/seek 前的定格帧（新流首帧已渲染）；poster="" 会被当相对 URL
              try { v.currentTime = pt; } catch (e) { /* 忽略 */ }
            }
          } catch (e) {
            if (e.name === "QuotaExceededError") { trimAndAppend(arr); return; }
            // 弹窗关闭（hidden.bs.modal → stopMedia 清 src）后 MediaSource 已被 detach、
            // readyState 变为非 open：飞行中的 pump 撞上 appendBuffer 抛 InvalidStateError，
            // 这是正常清理动作，静默停止即可（绝不能进降级/重试/报错）。
            try {
              if (!mse || mse.ms.readyState !== "open" || !v.isConnected ||
                  (v.currentSrc && !v.currentSrc.startsWith("blob:"))) {
                if (mse) mse.fetching = false;
                return;
              }
            } catch (e2) { /* 忽略 */ }
            // append 失败（典型：HTMLMediaElement.error 已置位，通常是后端流时序/会话竞态导致的瞬时问题）：
            // 原画档先降级高清；高清/后续仍失败则重建 MediaSource 重试当前画质（限 3 次），而非直接放弃黑屏。
            if (q === "original" && !mseFallbackDone && mse.gen === myGen) {
              mseFallbackDone = true;
              mseRetry = 0;
              toast("原画流不可用，已切换高清播放");
              qSel.value = "high";
              buildMse(v.currentTime || 0).catch(() => { /* 异步内部已兜底 */ });
              return;
            }
            if (mseRetry < 3) {
              mseRetry++;
              toast("播放流异常，正在重试…");
              buildMse(v.currentTime || 0).catch(() => { /* 异步内部已兜底 */ });
              return;
            }
            showErr("MSE 数据追加失败: " + (e && e.message));
          }
        } else {
          if (!mse || mse.gen !== myGen) return;
          if (done) {
            // 缓冲完全为空（初始化段都未 append）时，endOfStream 会触发 DEMUXER_ERROR 黑屏且不可恢复；
            // 明确报错而非静默失败，让用户/重试机制有机会处理
            try { if (!v.buffered.length) { showErr("视频流不可用（转码或封装失败）"); return; } } catch (e) { /* 忽略 */ }
            try { mse.ms.endOfStream(); } catch (e) { /* 忽略 */ }
            return;
          }
          setTimeout(() => { if (mse) pump(); }, 200);
        }
      })
      .catch(() => { if (mse) { mse.fetching = false; setTimeout(() => pump(), 500); } });
  }

  function trimAndAppend(arr) {
    if (!mse || !mse.sb) return;
    try {
      if (mse.sb.buffered.length && mse.sb.buffered.start(0) > 0) {
        mse.sb.remove(0, Math.max(0, v.currentTime - 30));
        // remove 异步执行：暂存数据等 updateend 补 append（避免立即 append 抛 InvalidStateError 丢数据），
        // 并标记续拉，保证补 append 后继续拉下一段
        mse.buf = arr;
        mse.wantAppend = true;
        return;
      }
    } catch (e) { /* 忽略 */ }
    try { mse.sb.appendBuffer(arr); } catch (e2) { /* 忽略 */ }
  }

  // ---- 画质 / 免证书 / 缓存下载切换 ----
  // 切画质：MSE 模式下转码档之间（high/medium/low）mime 恒为 avc1.640033，可复用同一个
  // SourceBuffer 平滑切换（像 seek 一样清缓冲+改 timestampOffset+拉新流），不重建 MediaSource
  // → video 不重新加载 → 不闪烁；涉及 original（mime 可能不同）或原生模式才重建/换 src。
  qSel.onchange = () => {
    if (mse) {
      const t = v.currentTime || 0;
      const newQ = qSel.value;
      const oldQ = mse.q || "original";
      mse.q = newQ;
      if (oldQ !== "original" && newQ !== "original") {
        seekMse(t);
      } else {
        buildMse(t).catch(() => { /* 异步内部已兜底 */ });
      }
    } else {
      playNative(v.currentTime);
    }
  };
  mseChk.input.onchange = () => {
    if (mseChk.input.checked) {
      // MSE（免证书）模式与缓存下载互斥：缓存只对原画原生流生效
      if (cacheChk.input.checked) { cacheChk.input.checked = false; cacheChk.el.classList.add("text-muted"); }
      const resume = v.currentTime || 0;   // 原生→MSE 保持播放位置
      startMse(resume).catch(e => showErr("MSE 启动失败: " + (e && e.message)));
    } else {
      const resume = v.currentTime || 0;   // MSE→原生 保持播放位置（先记录再 stopStream）
      stopStream();
      playNative(resume);
    }
  };
  cacheChk.input.onchange = () => {
    if (mse) { cacheChk.input.checked = false; toast("缓存下载仅在免证书关闭的原画播放时生效"); return; }
    if (qSel.value !== "original") { cacheChk.input.checked = false; toast("缓存下载仅对原画档生效"); return; }
    playNative(v.currentTime);
  };
  subChk.input.onchange = () => {
    if (subChk.input.checked) {
      if (subVtt) { if (mse) { subMode = "overlay"; setupSubOverlay(); } else { subMode = "track"; attachTrack(subVtt.url); } }
      else loadSubtitle();
    } else { clearSubOverlay(); removeTrack(); subMode = "none"; }
  };
  // MSE 模式：拖动进度条 → 防抖后按最终位置判断是否重建（seekMse）。
  // 连续拖动会触发多次 seeking：若每次立即 seekMse 会反复清空缓冲（"卡一下好一下"交替），
  // 若用固定 guard 忽略又会漏掉最终位置（currentTime 与流脱节卡死）。
  // 统一在拖动停止 250ms 后按最终 currentTime 处理一次；重建窗口内（guard 1s）的 seeking
  // 延后重试，保证拖动结束后的最终位置必定生效。
  let mseSeekDebounce = null;
  v.addEventListener("seeking", () => {
    if (!mse) return;
    const trySeek = () => {
      if (!mse || !mse.sb) return;
      if (Date.now() - mseSeekGuard < 1000) {
        // 上一轮 seek 重建窗口内：延后重试（用户可能仍在拖动，最终位置必须生效）
        mseSeekDebounce = setTimeout(trySeek, 200);
        return;
      }
      const t = v.currentTime || 0;
      let bufStart = 0, bufEnd = 0;
      try { if (v.buffered.length) { bufStart = v.buffered.start(0); bufEnd = v.buffered.end(v.buffered.length - 1); } } catch (e) { /* 忽略 */ }
      // 缓冲为空（起播/刚 remove 清空）时 currentTime 必然落在范围外，但此时没有可 seek 的数据，直接跳过；
      // 否则起播时 seeking（currentTime 归 0）会误触发 seekMse(0) → 反复清空缓冲 → 永远起播不了
      if (v.buffered.length && (t < bufStart - 1 || t > bufEnd + 1)) seekMse(t);
    };
    clearTimeout(mseSeekDebounce);
    mseSeekDebounce = setTimeout(trySeek, 250);
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
        // 固定视窗宽高比（切画质/切模式时布局不跳动）
        if (j.width && j.height) setViewportRatio(j.width, j.height, j.rotation);
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
        const url = URL.createObjectURL(b);
        if (disposed) { try { URL.revokeObjectURL(url); } catch (e) { /* 忽略 */ } return; }   // B6：弹窗已关，立即释放
        strip = { url, n, dur };
        blobUrls.push(url);
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
    img.style.width = prevW + "px";                       // prevW：滑动 160 / 停止放大 320
    img.style.height = previewRatio ? (prevW * previewRatio) + "px" : "";
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
    img.style.width = prevW + "px";                    // 单块窗口（滑动 160 / 停止 320）
    img.style.height = previewRatio ? (prevW * previewRatio) + "px" : "";
    img.style.objectPosition = (-idx * prevW) + "px 0"; // 像素级对齐到第 idx 块
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
    // 预览图跟随鼠标位置：显示在拖动点上方（top 约 8px 悬于进度条上），
    // left 居中于鼠标点，但钳制在 wrap 边界内避免超出屏幕
    const pw = 160;
    const margin = 4;
    let left = clientX - rect.left - pw / 2;                    // 鼠标点居中
    left = Math.max(margin, Math.min(rect.width - pw - margin, left));   // 左右边界钳制
    prev.style.left = left + "px";
    // 固定位于进度条上方（bottom 40px ≈ 控制条上方），避免长视频因 ph 计算错位
    prev.style.bottom = "40px";
    prev.style.display = "block";
    // 滑动时较透明（0.4）无滤镜；停止 400ms 后清晰（1.0）+ 提亮（brightness 1.2）
    prevImg.style.opacity = "0.4";
    prevImg.style.filter = "none";
    if (prev._t) clearTimeout(prev._t);
    prev._t = setTimeout(() => { prevImg.style.opacity = "1"; prevImg.style.filter = "brightness(1.1)"; }, 400);
  }
  function hidePreview() { prev.style.display = "none"; if (prev._t) clearTimeout(prev._t); }
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
    // 记录视频宽高比（预览浮层按此比例显示，而非固定 160x90）
    if (v.videoWidth > 0 && v.videoHeight > 0) previewRatio = v.videoHeight / v.videoWidth;
  });

  // ---- 加载启动 ----
  loadStrip();
  loadVinfo();
  if (mseChk.input.checked) startMse().catch(e => showErr("MSE 启动失败: " + (e && e.message)));
  else playNative();
  if (subChk.input.checked) loadSubtitle();

  // B6：注册本预览清理函数——弹窗关闭（hidden.bs.modal）或切换其它预览（openModal）时统一执行：
  // revoke subVtt/asrVtt/strip/MSE 的全部 Blob URL，并同步 removeTrack 释放 <track> 引用。
  // 顺序保障：hidden.bs.modal / openModal 均先 stopMedia（清 v.src）再执行本清理。
  _activePreviewCleanup = () => {
    disposed = true;
    try { removeTrack(); } catch (e) { /* 忽略 */ }
    blobUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch (e) { /* 忽略 */ } });
    blobUrls.length = 0;
  };
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
  if (j.error) {
    // 二进制/不可读文件：明确提示 + 下载查看（不再显示乱码）
    body.innerHTML = '<p class="muted">' + esc(j.error) + "</p>" +
      '<div class="d-flex flex-wrap gap-2 mt-3"><button class="btn btn-primary" id="txtDl">' + icon("download", 14) + " 下载查看</button></div>";
    $("txtDl").onclick = () => { location.href = dlUrl(path); };
    return;
  }
  // T36 敏感信息脱敏：默认打码，paint() 可被切换按钮重渲染
  const MAX_PREVIEW = 400000;
  const paint = () => {
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
    note.textContent = noteTxt + (previewMask ? " · 敏感信息已打码" : " · 显示明文");
    body.appendChild(note);
    // 预览上限：超大内容只渲染前 400KB，避免一次性插入巨文本长时间布局卡死主线程
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
      dl.innerHTML = icon("download", 14) + " 下载全文";
      dl.onclick = () => { location.href = dlUrl(path); };
      bigNote.appendChild(dl);
    }
    if (previewMask) text = maskSensitive(text);
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
    const tg = document.createElement("button");
    tg.type = "button";
    tg.className = "btn btn-outline-secondary btn-sm";
    tg.textContent = previewMask ? "显示明文" : "隐藏敏感信息";
    tg.title = previewMask ? "敏感信息（密钥等）已打码，点击查看原文" : "已显示明文，点击恢复脱敏";
    tg.onclick = () => { previewMask = !previewMask; paint(); };
    btns.appendChild(tg);
    btns.appendChild(mkBtn(icon("download", 14) + " 下载", () => { location.href = dlUrl(path); }));
    body.appendChild(btns);
    addFsButton(body, name, path, dlUrl(path), path);
  };
  paint();
  });
}

// ---------------- 功能 4：压缩包在线解压（T25：多格式 + 层级浏览） ----------------
async function showUnpack(path, name) {
  openPreviewModal(name, { type: "unpack", path, name }, null, async ({ body, ac }) => {
    body.innerHTML = "";   // 清掉"加载中"节点（与其他预览一致），下方渲染解压列表
    // 常驻容器：层级切换时只重建内容，保留顶部 ⛶ 放大按钮与弹窗结构
    const wrap = document.createElement("div");
    wrap.id = "unpackRoot";
    body.appendChild(wrap);
    addFsButton(body, name, path, dlUrl(path), path);
    await renderUnpackLevel(wrap, ac, path, name, "");
  });
}

// 渲染压缩包某一层：dir 为包内目录路径（正斜杠分隔，"" = 根层）。
// 根层走 api/unpack，子层走 api/unpackdir（后端同一 _unpack_list 实现）。
async function renderUnpackLevel(rootEl, ac, path, name, dir) {
  rootEl.innerHTML = "";
  const ep = dir
    ? "api/unpackdir?path=" + encodeURIComponent(path) + "&dir=" + encodeURIComponent(dir)
    : "api/unpack?path=" + encodeURIComponent(path);
  const j = await api(ep, { signal: ac.signal });
  if (ac.signal.aborted) return;
  if (j.error) { rootEl.innerHTML = '<p class="muted">' + esc(j.error) + "</p>"; return; }
  if (j.format === "unsupported") {
    rootEl.innerHTML = '<p class="muted">该格式暂不支持在线解压</p>';
    return;
  }
  const entries = Array.isArray(j.entries) ? j.entries : [];
  const MAX_ENTRIES = 5000;
  const shown = entries.slice(0, MAX_ENTRIES);
  const segs = dir ? dir.split("/").filter(Boolean) : [];
  // 面包屑 + 返回上级
  const crumbs = document.createElement("div");
  crumbs.className = "unpack-crumb";
  if (segs.length) {
    const up = document.createElement("button");
    up.type = "button";
    up.className = "btn btn-sm btn-outline-primary unpack-up";   // T38 P3-8：明显按钮样式
    up.innerHTML = icon("back", 14) + " 上级";
    up.title = "返回上级目录";
    up.onclick = () => renderUnpackLevel(rootEl, ac, path, name, segs.slice(0, -1).join("/"));
    crumbs.appendChild(up);
  }
  const mkSeg = (label, target, isCur) => {
    const s = document.createElement("span");
    s.className = "unpack-crumb-seg" + (isCur ? " cur" : "");
    s.textContent = label;
    s.title = target === "" ? "回到压缩包根目录" : "进入 " + target;
    if (!isCur) s.onclick = () => renderUnpackLevel(rootEl, ac, path, name, target);
    crumbs.appendChild(s);
  };
  mkSeg(name, "", segs.length === 0);   // 根（档案名）
  segs.forEach((seg, i) => {
    const sep = document.createElement("span");
    sep.className = "unpack-crumb-sep";
    sep.textContent = "/";
    crumbs.appendChild(sep);
    mkSeg(seg, segs.slice(0, i + 1).join("/"), i === segs.length - 1);
  });
  rootEl.appendChild(crumbs);
  // 统计信息
  const note = document.createElement("div");
  note.className = "mdl-note";
  const total = typeof j.total === "number" ? j.total : entries.length;
  note.textContent = "格式: " + String(j.format).toUpperCase() +
    " · 当前层 " + entries.length + " 项 / 共 " + total + " 项" +
    (entries.length > MAX_ENTRIES ? "（条目较多，仅显示前 " + MAX_ENTRIES + " 项）" : "");
  rootEl.appendChild(note);
  if (!entries.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = segs.length ? "该目录为空" : "压缩包为空";
    rootEl.appendChild(p);
  } else {
    const list = document.createElement("div");
    list.className = "unpack-list";
    shown.forEach(en => {
      const row = document.createElement("div");
      row.className = "unpack-row" + (en.is_dir ? " dir" : "");
      const icHtml = en.is_dir
        ? typeIcon("folder", 16)
        : fileIcon(en.name, 18);
      row.innerHTML =
        '<span class="ic">' + icHtml + "</span>" +
        '<span class="uname"></span>' +
        (en.is_dir
          ? '<span class="dir-arrow" title="进入目录">' + icon("chevronRight", 13) + "</span>"
          : '<span class="usz">' + fmtSize(en.size) + "</span>");
      row.querySelector(".uname").textContent = en.name;
      if (en.is_dir) {
        // 目录行：点击进入下一层（▶）
        row.onclick = () => renderUnpackLevel(rootEl, ac, path, name,
          (dir ? dir + "/" : "") + en.name);
      } else {
        row.onclick = () => {
          location.href = BASE + "api/unpackdl?archive=" + encodeURIComponent(path) +
                          "&entry=" + encodeURIComponent(en.path_in_archive);
        };
      }
      list.appendChild(row);
    });
    rootEl.appendChild(list);
  }
  const btns = document.createElement("div");
  btns.className = "d-flex flex-wrap gap-2 mt-3";
  btns.appendChild(mkBtn(icon("download", 14) + " 下载压缩包", () => { location.href = dlUrl(path); }));   // T38 P3-8 文案精简
  rootEl.appendChild(btns);
}

// A1（t13 批次1）：api() 改"永不抛"封装（修复断网/服务重启时永久骨架屏/白屏）。
// 策略：
//  - 内部 AbortController + 可配超时（默认 20s；opt.timeout 可覆盖，loadList 大目录放宽 40s）；
//  - 外部 signal（opt.signal）与内部 controller 并存：监听外部 abort → 同步 abort 内部请求，
//    并把 AbortError 原样抛回（五个带 signal 调用点的既有取消语义不变）；
//    不用 AbortSignal.any（Safari 15.4 前无此 API，且无法区分超时与取消）；
//  - 网络失败 / 非 2xx / 响应解析失败一律返回 { error }，永不 reject。
async function api(ep, opt) {
  opt = opt || {};
  const outer = opt.signal;
  const timeout = (typeof opt.timeout === "number" && opt.timeout > 0) ? opt.timeout : 20000;
  const ac = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ac.abort(); }, timeout);
  const onOuterAbort = () => ac.abort();
  if (outer) {
    if (outer.aborted) ac.abort();
    else outer.addEventListener("abort", onOuterAbort, { once: true });
  }
  try {
    const r = await fetch(BASE + ep, Object.assign({}, opt, { signal: ac.signal }));
    let j = null;
    try { j = await r.json(); } catch (e) { /* 非 JSON 响应（如 403 错误页），按失败处理 */ }
    if (!r.ok) {
      // 服务端错误响应若带 {error} 则透传（23 个调用点只认 j.error）
      if (j && typeof j === "object" && typeof j.error === "string") return j;
      return { error: "请求失败（HTTP " + r.status + "）" };
    }
    return j === null ? { error: "响应解析失败" } : j;
  } catch (e) {
    if (e && e.name === "AbortError") {
      if (timedOut) return { error: "请求超时，请重试" };
      if (outer && outer.aborted) throw e;   // 外部取消：保留原取消语义（调用方 await 收到 AbortError）
      return { error: "请求已取消" };
    }
    return { error: "网络错误，无法连接服务" };
  } finally {
    clearTimeout(timer);
    if (outer) { try { outer.removeEventListener("abort", onOuterAbort); } catch (e) { /* 忽略 */ } }
  }
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
  if (info.error) {
    // A1（t13 批次1）：api 永不抛后这里必然走到错误分支——显示错误 + 重试，不再白屏
    $("fileRows").innerHTML = '<div class="empty">' + esc(info.error) + "</div>";
    showAlert(info.error, [{ label: "↻ 重试", fn: () => init() }]);
    return;
  }
  roots = info.roots || [];
  pinned = info.pinned || [];
  infoUrls = Array.isArray(info.urls) ? info.urls : [];
  infoUrlsHttp = Array.isArray(info.urls_http) ? info.urls_http : [];
  renderDriveTabs();
  renderPinned();
  // ---- 恢复视图模式与上次目录（功能 2：刷新不丢状态） ----
  view = loadLS("drive.view") === "grid" ? "grid" : "list";
  syncViewBtns();
  iconStyle = loadLS("drive.iconStyle") === "color" ? "color" : "line";   // T34-2 图标风格恢复
  syncIconStyleBtns();
  const savedRoot = loadLS("drive.root");
  const savedCur = loadLS("drive.cur");
  if (roots.length) {
    // T26：优先按 savedCur 推断真实所属盘（修复盘符变化/跨盘缓存错位）；
    // savedCur 失效 → 回退 savedRoot；再失效 → roots[0] 并清理陈旧键
    const rootOfCur = savedCur ? rootOf(savedCur) : null;
    if (rootOfCur) {
      await switchDrive(rootOfCur);
      await loadList(savedCur);
    } else if (savedRoot && roots.indexOf(savedRoot) >= 0) {
      await switchDrive(savedRoot);
    } else {
      await switchDrive(roots[0]);
      try { localStorage.removeItem("drive.root"); localStorage.removeItem("drive.cur"); } catch (e) { /* 忽略 */ }
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

// ==================== T26 磁盘激活态同步（前进/后退/面包屑/刷新统一入口） ====================
// 从路径推断所属根：roots 中最长的前缀匹配（Windows 盘符大小写不敏感）
function rootOf(p) {
  const s = String(p || "").replace(/[\\\/]+$/, "");
  let best = null, bestLen = -1;
  roots.forEach(r => {
    const rn = String(r).replace(/[\\\/]+$/, "");
    const low = s.toLowerCase();
    if (low === rn.toLowerCase() ||
        low.startsWith(rn.toLowerCase() + "\\") ||
        low.startsWith(rn.toLowerCase() + "/")) {
      if (rn.length > bestLen) { best = r; bestLen = rn.length; }
    }
  });
  return best;
}
// 按当前目录 cur 同步顶部磁盘标签激活态与 activeRoot（loadList 成功后调用，
// 覆盖 switchDrive / navBack / navFwd / 面包屑点击 / .lnk 跳转 / 刷新恢复 所有导航路径）
function syncDriveUI() {
  if (SHARE_MODE) return;              // 分享模式无磁盘标签，activeRoot 由分享根决定
  const r = rootOf(cur);
  if (r !== null && r !== activeRoot) {
    activeRoot = r;
    renderDriveTabs();
  }
}

async function switchDrive(root) {
  activeRoot = root;
  renderDriveTabs();
  await loadList(root);
}

// ==================== T16 收藏（原置顶）：渲染到收藏面板 + 悬浮球徽标 ====================
function renderPinned() {
  // 悬浮球：主模式显示 + 数量徽标（分享模式无收藏，保持隐藏）
  const fab = $("pinFab");
  if (fab) fab.classList.toggle("d-none", SHARE_MODE);
  const badge = $("pinFabBadge");
  if (badge) {
    badge.textContent = pinned.length;
    badge.classList.toggle("d-none", pinned.length === 0);
  }
  const box = $("pinPanelBody");
  // 收藏非空时才显示「全部清空」
  $("pinClearBtn").classList.toggle("d-none", !pinned.length);
  // 面板标题：N 项 + 非目录项大小总和（有目录时补"含目录"）
  const n = pinned.length;
  let total = 0, hasDir = false;
  pinned.forEach(p => { if (p.is_dir) hasDir = true; else total += (p.size || 0); });
  const sizeTxt = n ? fmtSize(total) + (hasDir ? " · 含目录" : "") : "—";
  $("pinPanelTitle").innerHTML = '<span style="color:var(--brand-accent,#f59e0b)">' + icon("star", 15) + "</span> 收藏 · " + n + " 项 · 共 " + sizeTxt;
  if (!box) return;
  if (!pinned.length) { box.innerHTML = '<div class="empty" style="padding:20px 0">暂无收藏</div>'; return; }
  box.innerHTML = "";
  pinned.forEach(p => {
    const row = document.createElement("div");
    row.className = "prow d-flex align-items-center gap-2 py-2";
    row.innerHTML =
      '<span class="flex-shrink-0">' + (p.is_dir ? typeIcon("folder", 18) : fileIcon(p.name, 18)) + "</span>" +
      '<span class="pname flex-grow-1 text-truncate">' + esc(p.name) + "</span>" +
      '<span class="psize text-muted small flex-shrink-0 d-none d-sm-block">' + fmtSize(p.size) + "</span>" +
      '<button class="btn btn-outline-secondary btn-sm flex-shrink-0" data-a="share" title="分享">' + icon("share", 14) + '<span class="d-none d-sm-inline"> 分享</span></button>' +
      '<button class="btn btn-outline-secondary btn-sm flex-shrink-0" data-a="dl" title="下载">' + icon("download", 14) + '<span class="d-none d-sm-inline"> 下载</span></button>' +
      '<button class="btn btn-outline-secondary btn-sm flex-shrink-0" data-a="unpin" title="取消收藏">' + icon("close", 14) + '<span class="d-none d-sm-inline"> 取消</span></button>';
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

// 收藏悬浮球 / 面板开关（t16：替代原置顶折叠条）
let pinPanelOpen = false;
function openPinPanel() {
  pinPanelOpen = true;
  renderPinned();                       // 打开时刷新列表
  $("pinPanel").classList.add("show");
}
function closePinPanel() {
  pinPanelOpen = false;
  $("pinPanel").classList.remove("show");
}
function togglePinPanel() { pinPanelOpen ? closePinPanel() : openPinPanel(); }
$("pinFab").onclick = togglePinPanel;
$("pinPanelClose").onclick = closePinPanel;
// 悬浮球键盘可达（Enter/Space 等效点击）
$("pinFab").onkeydown = (ev) => {
  if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); $("pinFab").click(); }
};
// Esc 关闭收藏面板
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && pinPanelOpen) closePinPanel();
});

function renderBreadcrumb() {
  const bc = $("breadcrumb");
  bc.innerHTML = "";
  if (SHARE_MODE && shareVirtual) {
    // 虚拟分享：按 "/" 分隔虚拟路径渲染层级，根显示 info.root_name（不用绝对路径）
    const rel = cur ? String(cur).split("/").filter(Boolean) : [];
    let acc = "";
    rel.slice(0, -1).forEach(seg => {   // T35：末级段只由 .cur 渲染一次，避免重复
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
    last.textContent = rel.length ? rel[rel.length - 1] : (shareName || "收藏分享");   // T36：置顶→收藏 文案统一
    bc.appendChild(last);
    return;
  }
  if (SHARE_MODE && shareRoot) {
    // 分享模式：只显示从 shareRoot 起的相对层级（不能回到分享根之上）
    const rootNorm = String(shareRoot).replace(/[\\\/]+$/, "");
    const curNorm = String(cur).replace(/[\\\/]+$/, "");
    const rel = curNorm === rootNorm ? [] : curNorm.slice(rootNorm.length).replace(/^[\\\/]+/, "").split(/[\\\/]/).filter(Boolean);
    let acc = rootNorm;
    rel.slice(0, -1).forEach(seg => {   // T35：末级段只由 .cur 渲染一次，避免重复
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
  const addSeg = (label, target, cls) => {
    const s = document.createElement("span");
    s.className = "seg" + (cls ? " " + cls : "");
    s.textContent = label;
    s.onclick = () => loadList(target);
    bc.appendChild(s);
    // T38 P3-2：主模式段间用反斜杠分隔（Windows 路径风格），如 C: \ Users
    bc.appendChild(Object.assign(document.createElement("span"), { className: "sep", textContent: "\\" }));
  };
  let acc = "";
  let rootTarget = null;   // 盘符/根段目标（rootOf 精确匹配，兼容大小写与文件夹根）
  parts.forEach((part, i) => {
    // acc 拼接与后端 os.path.join 一致（单反斜杠分隔）：
    // i=0 首段带尾斜杠（F:\）；后续段仅在缺分隔符时补一个反斜杠，
    // 保证任意层级（2 层 / 3 层 / 深层）下最后一段 acc === cur 都成立，
    // 从而末级目录只由 last 高亮渲染一次（修复重复显示 + 深层路径断连）
    if (i === 0) {
      acc = part + "\\";
      // 盘符段（最左侧、唯一）：目标 = 实际所属根，标签与磁盘标签一致（"C:" / "D:\资料"）
      rootTarget = rootOf(cur) || acc;
      if (acc !== cur && rootTarget !== cur) addSeg(String(rootTarget).replace(/\\$/, ""), rootTarget, "drive");
      return;
    }
    acc += (acc.endsWith("\\") ? "" : "\\") + part;
    if (acc === cur) return;
    if (rootTarget && acc === rootTarget) return;   // 文件夹根：parts[1] 与根段重叠时跳过（盘符唯一）
    addSeg(part, acc);
  });
  const last = document.createElement("span");
  last.className = "cur" + (parts.length === 1 ? " drive" : "");   // T38：盘根时当前盘符加色
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
                           "track","album","artist","genre","comment","description","captions","lyrics",
                           // spec v1 §7.1：评论文本型新字段（可全文搜索；纯数值/日期如 rating/year/episodes/broadcast 不入，防噪）
                           "favorites","studio","cast","director","original","region"];
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
    b.title = "点击搜索该标签 · 出现于 " + t.score + " 个文件";   // T38 P3-5
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
// ==================== T34-2 图标风格切换（线条 / 彩色，localStorage 记住） ====================
function syncIconStyleBtns() {
  $("iconLineBtn").classList.toggle("active", iconStyle === "line");
  $("iconColorBtn").classList.toggle("active", iconStyle === "color");
}
function setIconStyle(v) {
  if (iconStyle === v) return;
  iconStyle = v === "color" ? "color" : "line";
  if (!SHARE_MODE) { try { localStorage.setItem("drive.iconStyle", iconStyle); } catch (e) { /* 忽略 */ } }
  syncIconStyleBtns();
  renderEntries();   // 列表/网格重渲染（含模糊插入）
  renderPinned();    // 收藏面板同步
}
$("iconLineBtn").onclick = () => setIconStyle("line");
$("iconColorBtn").onclick = () => setIconStyle("color");
syncIconStyleBtns();   // 初始态（iconStyle 已在 init 从 localStorage 读取）
// T37：显示隐藏文件开关（localStorage drive.showHidden；分享模式会话内有效不持久化）
function syncShowHiddenToggle() {
  const t = $("showHiddenToggle");
  if (t) t.checked = !!showHidden;
}
const shToggle = $("showHiddenToggle");
if (shToggle) shToggle.addEventListener("change", () => {
  showHidden = shToggle.checked;
  if (!SHARE_MODE) { try { localStorage.setItem("drive.showHidden", showHidden ? "1" : "0"); } catch (e) { /* 忽略 */ } }
  if (cur !== null) loadList(cur);
});
syncShowHiddenToggle();
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
  // T37 / A1（t13 批次1）：大目录 meta=1 响应慢，超时放宽到 40s（api 默认 20s 可配）
  const data = await api("api/list?path=" + encodeURIComponent(path) + "&meta=1" + (showHidden ? "&show_hidden=1" : ""), { timeout: 40000 });
  if (data.error) {
    currentEntries = [];
    tagScanReset(); tagRenderEmpty();
    rows.innerHTML = "";
    const stEl = $("listStats");
    if (stEl) stEl.classList.add("d-none");
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
  syncDriveUI();   // T26：任何导航后按当前目录同步顶部磁盘激活态（后退/前进跨盘、面包屑、刷新）
  // 保存当前目录/磁盘，供刷新后恢复（分享模式不写主站键，避免污染主页状态）
  if (SHARE_MODE) {
    try { localStorage.removeItem("drive.cur"); localStorage.removeItem("drive.root"); } catch (e) { /* 忽略 */ }
  } else {
    try { localStorage.setItem("drive.cur", cur); localStorage.setItem("drive.root", activeRoot || ""); } catch (e) { /* 忽略 */ }
  }
  renderBreadcrumb();
  updateNavBtns();
  currentEntries = data.entries;
  renderListStats();   // T37：统计行「共 N 项 · X 个目录 · Y 个文件」
  renderEntries();
  // 目录已切换/内容可能变化：使该目录标签缓存失效并重新扫描（侧边栏打开时可见渐出效果）
  _tagCache.delete(cur);
  startTagScan();
}

// T37：列表统计行「共 N 项 · X 个目录 · Y 个文件」
function renderListStats() {
  const el = $("listStats");
  if (!el) return;
  let dirs = 0, files = 0;
  currentEntries.forEach(e => { if (e.is_dir) dirs++; else files++; });
  el.textContent = "共 " + currentEntries.length + " 项 · " + dirs + " 个目录 · " + files + " 个文件";
  el.classList.remove("d-none");
}

// 列表模式条目（点击行为与 grid 一致）
function listItem(e) {
  const row = document.createElement("li");
  const locked = !!e.locked;
  const denied = !!e.denied;
  row.className = "list-group-item d-flex align-items-center gap-2 py-2" + (locked ? " text-muted opacity-75" : "") + (denied ? " denied" : "");
  if (denied) row.title = "无权限访问该目录";
  row.dataset.path = e.path;              // 多选批量操作取路径
  row.dataset.dir = e.is_dir ? "1" : "";  // 批量下载跳过目录
  // 常驻五角星已移除（t9）：置顶改由「长按多选 → 批量置顶」完成
  // 文件类型图标：inline SVG（currentColor 随主题）+ 26px（T17 补充）
  row.innerHTML =
    '<span class="bulk-cb"><input type="checkbox" class="form-check-input" aria-label="选择"></span>' +
    '<span class="ic flex-shrink-0 text-center" style="width:32px">' + (e.is_dir
      ? '<span class="ic-wrap">' + typeIcon("folder", 26) + (denied ? '<span class="deny-lock">' + icon("locked", 12) + "</span>" : "") + "</span>"
      : (locked ? typeIcon("locked", 26) : fileIcon(e.name, 26))) + "</span>" +
    '<span class="nm text-truncate flex-grow-1' + (e.is_dir ? " fw-medium" : "") + '"></span>' +
    '<span class="mt d-none d-md-block text-muted small flex-shrink-0 text-end" style="width:130px">' + fmtTime(e.mtime) + "</span>" +
    '<span class="sz text-muted small flex-shrink-0 text-end" style="min-width:70px">' + (e.is_dir ? "—" : fmtSize(e.size)) + "</span>";   // T35：行内分享按钮移除（批量再分享替代）
  const nm = row.querySelector(".nm");
  nm.textContent = e.name;
  nm.title = e.name;   // T37：悬停显示完整文件名（列表行截断时）
  bindRowAction(row, e, locked);   // T36：整行可点（原仅名称可点，图标/空白为死区）；复选框点击已 stopPropagation 不触发
  // T21：每行 ⓘ 详情按钮已移除——详情从操作面板 / 预览弹窗进入（showDetail 保留）
  // T35：分享模式同样启用长按多选（行内分享按钮已移除，改为批量再分享/下载）
  bindLongPress(row, e, locked);
  // 复选框点击不冒泡到行动作（避免勾选时误打开文件/目录）
  const cbWrap = row.querySelector(".bulk-cb");
  if (cbWrap) cbWrap.addEventListener("click", (ev) => ev.stopPropagation());
  row.addEventListener("click", (ev) => {
    if (bulkMode) { ev.preventDefault(); ev.stopPropagation(); toggleBulkSelect(row, e.path); }
  }, true);
  return row;
}

// 网格封面（A3/t13 批次1）：图片缩略图一律 createElement + 统一 onerror 回退，
// 消除旧实现「BASE/路径拼进 onerror 内联字符串」的引号嵌套注入通道；
// 回退到类型图标与 listItem 的图标回退同源（跟随当前线条/彩色风格）。
function gridCover(e) {
  if (e.is_dir) {
    const sp = document.createElement("span");
    sp.className = "grid-cover ic-inline";
    sp.innerHTML = '<span class="ic-wrap">' + typeIcon("folder", 72) +
      (e.denied ? '<span class="deny-lock">' + icon("locked", 16) + "</span>" : "") + "</span>";
    return sp;
  }
  if (e.locked) {
    const sp = document.createElement("span");
    sp.className = "grid-cover ic-inline";
    sp.innerHTML = typeIcon("locked", 72);
    return sp;
  }
  const kind = fileKind(e.name);
  if (kind === "video" || kind === "image") {
    const img = document.createElement("img");
    img.loading = "lazy";
    img.className = "grid-cover video-thumb";
    img.alt = "";
    img.dataset.fallback = kind;
    img.onerror = () => gridThumbFallback(img);
    img.src = BASE + (kind === "video" ? "api/thumb?path=" : "api/img?path=") + encodeURIComponent(e.path);
    return img;
  }
  const sp = document.createElement("span");
  sp.className = "grid-cover ic-inline";
  sp.innerHTML = fileIcon(e.name, 72);
  return sp;
}

// 缩略图加载失败统一回退：换成对应类型图标；先置 onerror=null 防回退图自身失败死循环
function gridThumbFallback(img) {
  img.onerror = null;
  const kind = img.dataset.fallback === "image" ? "image" : "video";
  img.src = BASE + (iconStyle === "color" ? "static/icons/color/" + kind + ".svg" : "static/icons/" + kind + ".svg");
}

// 网格模式条目：大图标 + 名称 + 大小；点击行为与 list 完全一致
function gridItem(e) {
  const locked = !!e.locked;
  const denied = !!e.denied;
  const card = document.createElement("li");
  card.className = "grid-item" + (locked ? " text-muted opacity-75" : "") + (denied ? " denied" : "");
  if (denied) card.title = "无权限访问该目录";
  const cover = gridCover(e);   // A3：createElement 构建封面（含 img.onerror 统一回退）
  card.dataset.path = e.path;              // 多选批量操作取路径
  card.dataset.dir = e.is_dir ? "1" : "";  // 批量下载跳过目录
  // 常驻 grid-star 已移除（t9）：置顶改由「长按多选 → 批量置顶」完成
  card.innerHTML =
    '<div class="grid-top">' +
    '  <span class="bulk-cb"><input type="checkbox" class="form-check-input" aria-label="选择"></span>' +
    "</div>" +
    '<div class="grid-cover-wrap"></div>' +
    '<div class="grid-name"></div>' +
    '<div class="grid-size">' + (e.is_dir ? "" : fmtSize(e.size)) + "</div>";   // T35：卡片分享按钮移除（批量再分享替代）
  card.querySelector(".grid-cover-wrap").appendChild(cover);
  card.querySelector(".grid-name").textContent = e.name;
  card.querySelector(".grid-name").title = e.name;   // T37：悬停显示完整文件名（网格截断时）
  bindRowAction(card, e, locked);
  // T21：卡片 ⓘ 详情按钮已移除——详情从操作面板 / 预览弹窗进入（showDetail 保留）
  // T35：分享模式同样启用长按多选（卡片分享按钮已移除，改为批量再分享/下载）
  bindLongPress(card, e, locked);
  // T36：复选框点击不冒泡到卡片行动作（原实现点复选框会误打开文件/目录）
  const cbWrap = card.querySelector(".bulk-cb");
  if (cbWrap) cbWrap.addEventListener("click", (ev) => ev.stopPropagation());
  card.addEventListener("click", (ev) => {
    if (bulkMode) { ev.preventDefault(); ev.stopPropagation(); toggleBulkSelect(card, e.path); }
  }, true);
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
  else if (kind === "lnk") openLnkTarget(path, name);   // 与 bindRowAction 分流一致：点击直接进入目标
  else location.href = dlUrl(path);   // 其它类型直接下载
}

// 文件/目录点击分流（list 行内名称与 grid 卡片共用）：目录进入、锁定提示、视频/文本/压缩包/PDF/CSV/lnk 弹窗、其它下载
function bindRowAction(el, e, locked) {
  if (e.is_dir) {
    if (e.denied) {
      // 无权限目录（T24）：不进入，行/卡片 shake 抖动 + toast 提示
      el.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        shakeEl(el);
        toast("无权限访问该目录");
      };
      el.style.cursor = "not-allowed";
      return;
    }
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
    // T34-1：点击 .lnk 直接进入目标（目录→进入；文件→进入所在目录；失效→toast）
    el.onclick = () => openLnkTarget(e.path, e.name);
    // T32：右键次要入口——打开操作面板（含"快捷方式目标"按钮 → showLnk 查看/跳转）
    el.addEventListener("contextmenu", (ev) => { ev.preventDefault(); showFileActions(e); });
  } else {
    // 其它类型（exe/iso/docx/xlsx/dll 等）：不直接下载，弹操作面板（T20）
    el.onclick = () => showFileActions(e);
  }
}

// T34-1: .lnk 点击直接进入目标：目录→进入；文件→进入所在目录；失效→toast
async function openLnkTarget(path, name) {
  let j = null;
  try { j = await api("api/lnk?path=" + encodeURIComponent(path)); } catch (e) { /* 网络失败按失效处理 */ }
  if (!j || !j.ok || !j.target) { toast("快捷方式已失效"); return; }
  const target = j.target;
  // 目标必须仍存在且在可访问根内（api/stat 越界/不存在都视为失效）
  let st = null;
  try { st = await api("api/stat?path=" + encodeURIComponent(target)); } catch (e) { /* 忽略 */ }
  if (!st || st.error) { toast("快捷方式已失效"); return; }
  loadList(st.is_dir ? target : dirnameOf(target));
}

// 未知类型文件操作面板（T20）：图标+名称+类型+大小 + 下载/详情/分享/收藏/取消
function showFileActions(e) {
  const body = document.createElement("div");
  openModal(e.name, body, { type: "fileActions", path: e.path, name: e.name });
  // 头部：图标 + 名称 + 类型/大小
  const head = document.createElement("div");
  head.className = "d-flex align-items-center gap-3 mb-3";
  const icWrap = document.createElement("div");
  icWrap.innerHTML = fileIcon(e.name, 40);
  head.appendChild(icWrap);
  const info = document.createElement("div");
  info.className = "flex-grow-1";
  info.style.minWidth = "0";
  const nm = document.createElement("div");
  nm.className = "fw-semibold text-truncate";
  nm.textContent = e.name;
  const meta = document.createElement("div");
  meta.className = "text-muted small";
  meta.textContent = "类型: " + (extOf(e.name).toUpperCase() || "未知") +
    (e.size != null ? " · " + fmtSize(e.size) : "");
  info.appendChild(nm);
  info.appendChild(meta);
  head.appendChild(info);
  body.appendChild(head);
  // 操作：下载（主按钮）+ 详情/分享/收藏/取消
  const dl = mkBtn(icon("download", 16) + " 下载", () => { location.href = dlUrl(e.path); });
  dl.className = "btn btn-primary w-100";
  body.appendChild(dl);
  const row = document.createElement("div");
  row.className = "d-flex flex-wrap gap-2 mt-2";
  const mkOut = (label, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-outline-secondary flex-fill";
    b.innerHTML = label;
    b.onclick = fn;
    return b;
  };
  // T21/T32：详情入口并入操作面板（完整详情弹窗：大小/时间/元数据/预览按钮）
  row.appendChild(mkOut(icon("info", 15) + " 详情", () => showDetail(e.path, e.name)));
  if (fileKind(e.name) === "lnk") {
    // T32：.lnk 次要入口——操作面板内可直接查看/跳转快捷方式目标（showLnk 保留）
    row.appendChild(mkOut(icon("link", 15) + " 快捷方式目标", () => showLnk(e.path, e.name)));
  }
  if (SHARE_MODE) {
    // T35：分享模式只读浏览 —— 无收藏/置顶；分享 = 二次分享（与父分享同步过期）
    row.appendChild(mkOut(icon("share", 15) + " 再分享", () => showSubShareDialog(e.path, e.name)));
  } else {
    row.appendChild(mkOut(icon("share", 15) + " 分享", () => showShareDialog(e.path, e.name)));
    row.appendChild(mkOut(icon("star", 15) + " 收藏", async () => {
      const j = await api("api/pin?add=1&path=" + encodeURIComponent(e.path));
      if (j && Array.isArray(j.pinned)) pinned = j.pinned;
      renderPinned();
      toast("已收藏");
      closeModal();
    }));
  }
  row.appendChild(mkOut("✕ 取消", () => closeModal()));
  body.appendChild(row);
}

// T24 无权限目录拦截动效：对行/卡片做 shake 抖动 ~300ms（CSS @keyframes denyShake，见 index.html）。
// list 模式绑定在 .nm 上，向上找整行；grid 模式 el 即卡片本身。
function shakeEl(el) {
  const t = el && el.closest ? (el.closest(".list-group-item, .grid-item") || el) : el;
  if (!t) return;
  t.classList.remove("deny-shake");
  void t.offsetWidth; // 强制重排，保证连续点击也能重启动画
  t.classList.add("deny-shake");
  setTimeout(() => t.classList.remove("deny-shake"), 400);
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
    if (locked || e.denied || bulkMode) return;   // T35：分享模式允许长按进入多选
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
  if (bulkMode) return;   // 已在多选模式：直接返回，避免重复初始化批量条（T35 分享模式进入多选的说明见 bindLongPress）
  bulkMode = true;
  document.querySelectorAll("#fileRows > .list-group-item, #fileRows > .grid-item").forEach(el => {
    el.classList.add("bulk-mode");
  });
  syncBulkBarForMode();
  const bar = $("bulkBar");
  if (bar) bar.classList.remove("d-none");
  updateBulkBar();
  toast(SHARE_MODE ? "已进入多选模式（勾选后可批量二次分享/下载）" : "已进入多选模式（勾选后可批量收藏/分享/下载）");
}

// T35：分享模式批量栏只保留 全选/再分享/下载（收藏/置顶/打包在分享模式不存在，隐藏）
function syncBulkBarForMode() {
  ["bulkPin", "bulkUnpin", "bulkPack"].forEach(id => {
    const el = $(id);
    if (el) el.classList.toggle("d-none", !!SHARE_MODE);
  });
  const bs = $("bulkShare");
  if (bs) {
    bs.title = SHARE_MODE ? "批量生成二次分享链接（与当前分享同步过期）" : "批量生成分享链接";
    const txt = [...bs.childNodes].find(n => n.nodeType === 3);
    if (txt) txt.textContent = SHARE_MODE ? " 再分享" : " 分享";
  }
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
  toast(ok + " 项已" + (doPin ? "收藏" : "取消收藏"));
  exitBulkMode();
}
$("bulkPin").onclick = () => bulkTogglePin(true);
$("bulkUnpin").onclick = () => bulkTogglePin(false);

// 批量分享：主模式 api/share?paths=...；分享模式（T35）api/sharesub 逐项（与父分享同步过期）
$("bulkShare").onclick = () => {
  const paths = [...bulkSelected];
  if (!paths.length) { toast("请先选择文件"); return; }
  if (SHARE_MODE) { bulkReshare(); return; }
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

// T35 分享模式批量再分享：api/sharesub 逐项（与父分享同步过期），结果列表 + 逐个复制
async function bulkReshare() {
  const paths = [...bulkSelected];
  const results = [];
  for (const p of paths) {
    try {
      const j = await api("api/sharesub?path=" + encodeURIComponent(p));
      if (j && j.ok && j.url) results.push({ name: j.name || String(p).split(/[\\\/]/).pop(), url: location.origin + j.url });
    } catch (e) { /* 单项失败继续 */ }
  }
  if (!results.length) { toast("二次分享失败，请重试"); return; }
  const body = document.createElement("div");
  body.innerHTML = '<div class="alert alert-success py-2 mb-2">已生成 ' + results.length + ' 个二次分享链接（与当前分享同步过期）</div>';
  const list = document.createElement("div");
  list.style.maxHeight = "50vh";
  list.style.overflowY = "auto";
  list.style.marginBottom = ".5rem";
  results.forEach(r => {
    const item = document.createElement("div");
    item.className = "d-flex align-items-center gap-2 mb-2";
    const nm = document.createElement("div");
    nm.className = "text-truncate small flex-grow-1";
    nm.textContent = r.name;
    nm.title = r.url;
    const cp = document.createElement("button");
    cp.type = "button";
    cp.className = "btn btn-sm btn-outline-primary flex-shrink-0";
    cp.innerHTML = icon("copy", 13) + " 复制";
    cp.onclick = () => {
      const ok = () => toast("链接已复制");
      const fb = () => { toast("复制失败，请长按手动复制"); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(r.url).then(ok).catch(fb);
      else fb();
    };
    item.appendChild(nm);
    item.appendChild(cp);
    list.appendChild(item);
  });
  body.appendChild(list);
  const close = document.createElement("button");
  close.type = "button";
  close.className = "btn btn-outline-secondary w-100";
  close.textContent = "✕ 关闭";
  close.onclick = closeModal;
  body.appendChild(close);
  openModal("批量二次分享", body);
  exitBulkMode();
}

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
          '<span class="flex-shrink-0">' + icon("pack", 15) + "</span>" +
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
            '<a class="btn btn-sm btn-primary" href="' + BASE + "api/archive/dl?id=" + encodeURIComponent(t.task_id) + '">' + icon("download", 13) + " 下载</a>" +
            "</div>";
    if (t.dl_total_bytes >= DIRECT_DL_THRESHOLD && pickDirectBase()) {
      card += '<div class="border-top pt-1 mt-1">' +
              '<div class="small text-warning">⚠️ 经域名下载大包可能触发网关超时，建议直连</div>' +
              '<div class="d-flex justify-content-end">' +
              '<button class="btn btn-sm btn-outline-primary py-0" onclick="copyDirectDl(\'' + esc(t.task_id) + '\')">' + icon("copy", 13) + " 复制直连下载链接</button>" +
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
      // T38 P3-4：统一「已完成 x/y」文案（避免 99% 与 完成 0/1 视觉矛盾）
      let txt = (done === total && total > 0) ? "已完成" : "已完成 " + done + "/" + total;
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
    if (show) {
      // T38 P3-4：百分比为主 + 明细「已完成 x/y」；全部完成时显示 100% · 已完成
      const txt = (done === total && total > 0)
        ? "100% · 已完成"
        : totalPct + "% · 已完成 " + done + "/" + total;
      mini.innerHTML = icon("pack", 14) + " " + txt;
    }
  }
}

// 提交区预览树：置顶顶层项（名称+大小，目录带 ▶ 可展开统计，不递归）
function createPackPreview() {
  const box = $("packPreviewTree");
  if (!box) return;
  $("packNewLabel").textContent = pinned.length
    ? "将打包收藏的 " + pinned.length + " 项"
    : "还没有收藏文件，先长按选择文件后收藏";   // T36：置顶→收藏 文案统一
  if (!pinned.length) { box.innerHTML = ""; return; }
  box.innerHTML = pinned.map(p => {
    return '<div class="pk-prow d-flex align-items-center gap-2"' +
           (p.is_dir ? ' data-dir="' + esc(p.path) + '"' : "") + ">" +
           '<span class="flex-shrink-0 small">' + (p.is_dir ? icon("folder", 14) : icon("text", 14)) + "</span>" +
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

// 打开打包中心（收藏面板的打包按钮；原顶部 #packBtn 已随 t16 移除）
$("pinPackBtn").onclick = () => { openPanel(); closePinPanel(); };

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

$("pinShareAllBtn").onclick = () => {
  if (!pinned.length) { toast("还没有收藏文件"); return; }
  showShareManyDialog();
};

// 一键清空收藏：后端 clear=1 原地清 list，前端同步 pinned 并刷新列表/预览树
$("pinClearBtn").onclick = async () => {
  if (!pinned.length) return;
  const j = await api("api/pin?clear=1");
  pinned = (j || {}).pinned || [];
  renderPinned();   // 列表行无星标，无需 loadList(cur)（t9）
  if (!$("packPanel").classList.contains("d-none")) createPackPreview();
  toast("已清空全部收藏");
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
  if (["zip","rar","7z","tar","gz","tgz","bz2","xz","tbz2","txz"].indexOf(e) >= 0) return "archive";   // T25 多格式
  if (["doc","docx","ppt","pptx"].indexOf(e) >= 0) return "doc";
  if (["xls","xlsx","csv"].indexOf(e) >= 0) return "sheet";
  if (e === "pdf") return "pdf";
  if (["exe","msi"].indexOf(e) >= 0) return "exe";
  if (CODE_EXT.indexOf(e) >= 0) return "code";                 // 含 bat：脚本按文本预览，用 code 图标
  if (["txt","md","markdown","log"].indexOf(e) >= 0) return "text";
  return "file";
}
// 图标 URL（目录/锁定由调用方特判，这里只负责普通文件）
// 文件图标 URL（T34-2：彩色风格走 static/icons/color/）
function iconUrl(e) {
  return iconStyle === "color"
    ? BASE + "static/icons/color/" + iconOf(e) + ".svg"
    : BASE + "static/icons/" + iconOf(e) + ".svg";
}
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
  if (j.error) {
    // 二进制/不可读文件：明确提示 + 下载查看（不再显示乱码）
    body.innerHTML = '<p class="muted">' + esc(j.error) + "</p>" +
      '<div class="d-flex flex-wrap gap-2 mt-3"><button class="btn btn-primary" id="csvDl">' + icon("download", 14) + " 下载查看</button></div>";
    $("csvDl").onclick = () => { location.href = dlUrl(path); };
    return;
  }
  // T36 敏感信息脱敏：逐单元格打码（保持表格结构），默认脱敏，可切换
  const MAX_ROWS = 2000;
  const paint = () => {
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
    note.textContent = noteTxt + (previewMask ? " · 敏感信息已打码" : " · 显示明文");
    body.appendChild(note);
    // 大 CSV：只解析前 300KB、最多渲染前 2000 行，避免一次性解析 + 构建巨表阻塞主线程
    let text = j.content;
    if (text.length > 300000) text = text.slice(0, 300000);
    const rows = parseCsv(text);
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
        const cell = previewMask ? maskSensitive(c) : c;
        html += (isHead ? "<th>" : "<td>") + esc(cell) + (isHead ? "</th>" : "</td>");
      });
      html += isHead ? "</tr></thead>" : "</tr>";
    });
    html += "</table>";
    wrap.innerHTML = html;
    body.appendChild(wrap);
    const btns = document.createElement("div");
    btns.className = "d-flex flex-wrap gap-2 mt-3";
    const tg = document.createElement("button");
    tg.type = "button";
    tg.className = "btn btn-outline-secondary btn-sm";
    tg.textContent = previewMask ? "显示明文" : "隐藏敏感信息";
    tg.title = previewMask ? "敏感信息（密钥等）已打码，点击查看原文" : "已显示明文，点击恢复脱敏";
    tg.onclick = () => { previewMask = !previewMask; paint(); };
    btns.appendChild(tg);
    btns.appendChild(mkBtn(icon("download", 14) + " 下载", () => { location.href = dlUrl(path); }));
    body.appendChild(btns);
    addFsButton(body, name, path, dlUrl(path), path);
  };
  paint();
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
  addFsButton(body, name, path, dlUrl(path), path);
  // 兜底：浏览器不支持内联 PDF 时，用户可点链接新窗口打开（T38 P3-8 醒目提示块）
  const fb = document.createElement("div");
  fb.className = "pdf-fallback mt-2";
  fb.innerHTML = '<span class="pdf-fb-ic">' + icon("text", 15) + "</span>" +
    '<span>浏览器未能直接显示 PDF，<a href="' + url + '" target="_blank" rel="noopener">点击这里在新窗口打开</a></span>';
  body.appendChild(fb);
  const btns = document.createElement("div");
  btns.className = "d-flex flex-wrap gap-2 mt-3";
  btns.appendChild(mkBtn(icon("download", 14) + " 下载", () => { location.href = dlUrl(path); }));
  body.appendChild(btns);
}

// 图片在线预览：内联 <img> + 缩放（按钮 +/−/适应宽度 + 滚轮）+ 下载；加载失败提示
function showImage(path, name) {
  const body = document.createElement("div");
  openModal(name, body, { type: "image", path, name });
  let scale = 1;
  const wrap = document.createElement("div");
  wrap.className = "img-preview-wrap";
  addFsButton(body, name, path, dlUrl(path), path);
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
  bar.appendChild(mkBtn(icon("zoomIn", 14) + " 放大", () => zoom(1.25)));
  bar.appendChild(mkBtn(icon("zoomOut", 14) + " 缩小", () => zoom(0.8)));
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
  btns.appendChild(mkBtn(icon("download", 14) + " 下载", () => { location.href = dlUrl(path); }));
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
      '<div class="d-flex flex-wrap gap-2 mt-3"><button class="btn btn-primary" id="lnkDlSelf">' + icon("download", 14) + " 下载快捷方式本身</button></div>";
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
    btns.appendChild(mkBtn(icon("download", 14) + " 下载原文件", () => { location.href = dlUrl(target); }));
  }
  btns.appendChild(mkBtn(icon("download", 14) + " 下载快捷方式本身", () => { location.href = dlUrl(path); }));
  body.appendChild(btns);
  addFsButton(body, name, path, dlUrl(path), path);
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
        '  <button class="btn btn-primary flex-fill" id="shareOpen">' + icon("link", 14) + " 打开分享页</button>" +
        '  <button class="btn btn-outline-primary flex-fill" id="shareCopy">' + icon("copy", 14) + " 复制链接</button>" +
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

// 启动入口：放在文件最末尾，确保上方所有 const/function 均已初始化（根治 TDZ）。
// 独立预览页（/view）不初始化主站 UI（无 driveTabs/appModal 等元素），由 view.html 内联脚本驱动。
if (location.pathname.replace(/\/$/, "").endsWith("/view")) {
  /* 独立页：view.html 内联脚本调用 renderPreview 渲染 */
} else {
  init();
}
