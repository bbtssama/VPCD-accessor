# T14 全站乱码系统性修复 · 改动摘要（CHANGES_ENCODING_FIX）

> 任务：t14（netdisk-frontend-opt 团队 engineer）
> 用户反馈："其他还有各种地方都有乱码"，系统性排查所有编码处理点
> 改动文件：`server/server.py`（_smart_decode 公共函数 + 各编码点接入）
> 原则：功能主路径零破坏、py_compile 门禁、源文件编码确认

## 一、公共解码函数 _smart_decode（新）
`BOM → 无 BOM UTF-16（le/be）→ utf-8 → gbk → big5 → gb18030 → latin-1`，返回 (text, encoding)。
- 供文本预览 / 字幕 / 内嵌字幕输出等所有编码点共用，消除"各点各自硬编码"的散乱状态。
- gb18030 是 GBK 超集（繁体/全 Unicode 兜底）；big5 在 gbk 严格失败时尝试。
- 附加启发：GBK 的 A4xx 区是日文假名而 Big5 的 A4xx 区是常用汉字——gbk 解码出 >50% 片假名时改试 big5（部分挽救 Big5 误解码）。

## 二、各编码点修复
1. **【高优先】旁挂字幕硬编码 utf-8 → _smart_decode**（server.py _subtitle_vtt）：GBK 中文字幕（.srt/.ass/.ssa）不再乱码——实测 GBK srt/ass 均正确输出中文。
2. **内嵌字幕 ffmpeg 输出**：`r.stdout.decode("utf-8")` → `_smart_decode(r.stdout)`（GBK 内嵌字幕兜底）。
3. **子进程输出确认**：ffprobe JSON / ffmpeg -encoders（1880/2399/2425）为 UTF-8 标准输出 + `errors="replace"` 防崩，保持不动；lnk 解析 PowerShell 输出（2278）GBK 正确，保持。
4. **_read_text 解码链增强**：utf-8 → gbk → gb18030（+big5 启发），UTF-16 无 BOM 检测已在 t13 落地。
5. **上传文件名**：latin-1→utf-8 修复基础上，utf-8 失败时补 `gbk` 尝试（覆盖 GBK 浏览器上传中文名场景）。
6. **源文件编码确认**：index.html / app.js / cjk-normalize.js / server.py 全部 UTF-8（无 BOM）✓。

## 三、验证（真实环境，全部 PASS）
- `py_compile server.py` + `node --check static/app.js` ✓
- **编码单测**：
  - GBK 中文字幕 .srt → `WEBVTT …简体中文字幕测试GBK` ✓（核心修复）
  - GBK 中文 .ass → `中文ASS字幕` ✓
  - UTF-8 BOM srt ✓
  - utf-8 / gbk 文本正常解码 ✓；UTF-16 BOM / 无 BOM le/be ✓（t13 回归）
  - 二进制伪装拦截 ✓（t13 回归）
  - big5 中文（假名启发生效样本）+ 日文 GBK 不误判 ✓
- **源文件编码**：4 个文件全部 UTF-8 ✓

## 四、已知限制（如实记录）
- **GBK vs Big5 双字节区完全重叠**：Big5 字节序列几乎总能被 GBK "合法解码"（产生乱码映射），字节层面无法可靠区分；默认按 GBK（大陆主流）解码，gbk 严格失败或假名启发命中时才切 big5。繁体 Big5 文件若碰巧 GBK 解码成功仍可能乱码——已尽力（假名启发 + big5 兜底），完美区分需内容级统计，风险大于收益未做。

## 五、回归面
- 正常 utf-8/gbk/UTF-16 文本、字幕、JSON 输出解码路径不变；仅把硬编码改为统一 _smart_decode（行为等价或更健壮）。
