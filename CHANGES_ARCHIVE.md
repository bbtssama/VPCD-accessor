# T25 压缩包预览升级：多格式 + 层级目录浏览 · 改动摘要（CHANGES_ARCHIVE）

> 任务：t25（netdisk-frontend-opt 团队 feature-engineer）
> 改动文件：`server/server.py`（主要）、`static/app.js`、`server/templates/index.html`
> 原则：zip 现有逻辑零破坏（仅在原路径上加层级过滤）；rar/7z 依赖外部工具，探测到才启用；
> 与 engineer T18（全屏预览）/T17（图标体系）并行无冲突（app.js 只动 showUnpack 区域 + ARCHIVE_EXT/iconOf/ICONS 一行）。

## 一、后端（server/server.py）
1. **多格式识别** `_archive_fmt(path)`：zip → zipfile；tar/tgz/tbz2/txz/tar.gz/tar.bz2/tar.xz → tarfile（`r:*` 自动识别压缩）；
   rar/7z → 外部工具；gz/bz2/xz 单文件（非 tar）尝试 tarfile，失败返回明确提示"单文件压缩，无内部目录结构"。
   `_ARCHIVE_EXT` 扩展为 {zip,rar,7z,tar,tgz,tbz2,txz,gz,bz2,xz}（`_preview_kind`/`_meta_kind`/`_MIME_BY_EXT` 同步扩展）。
2. **层级浏览核心** `_hier_level(raw, prefix, fmt)`：按 prefix 把扁平条目归并为该层一级子条目；
   隐含目录（只有文件无显式目录项）由文件路径推断；返回 {format, dir, entries, total}（total=该层含嵌套总数）。
3. **`_unpack_list(path, dir="")`**：dir 缺省=根层；zip/tar/7z/rar 统一返回层级条目。
   - tar 中文名修复 `_fix_tar_name`：GBK 字节被 tarfile 按 UTF-8 解出代理字符时，安全重解码（仅含代理字符且 GBK 解码含中文才采用）。
   - rar/7z：探测 7-Zip（`C:\Program Files\7-Zip\7z.exe` 等常见路径 + PATH）→ `7z l -slt -ba -sccUTF-8` 技术列表解析（Folder=+ / Attributes=D 判目录）；
     无 7-Zip 时回退 WinRAR（UnRAR/WinRAR lb 裸列表，尽力而为）；都没有 → **明确提示**"未找到 7-Zip 或 WinRAR，请安装后重试"。
4. **新增 `api/unpackdir`**（主站 + 分享路由）：带 `dir` 参数返回包内指定目录的子条目；`api/unpack` 同时支持可选 `dir`（向后兼容）。
5. **`_unpack_download` 多格式**：zip（原逻辑不动）；tar（tarfile 流式，Content-Length 精确）；7z（先 `7z l -slt` 查 size 设 Content-Length，再 `7z e -so` 流式）；
   WinRAR 备选（解压临时目录后流式，WinRAR 不支持 stdout）；目录条目下载返回 403 明确提示。

## 二、前端（static/app.js）
1. **`ARCHIVE_EXT`** 扩展为 [zip,rar,7z,tar,tgz,tbz2,txz,gz,bz2,xz]（`fileKind` archive 分支自动生效）；`iconOf` 同步。
2. **`showUnpack` 层级改造**：
   - 常驻 `#unpackRoot` 容器：层级切换只重建内容，顶部 ⛶ 放大按钮/弹窗结构保留；
   - 面包屑（根=档案名 → 各级目录，点击任意段直接跳层）+ 子层显示"⛶ 上级"返回按钮；
   - 目录行 ▶ 指示（新增 `chevronRight` SVG 图标）可点击进入下一层（`api/unpackdir?dir=`）；
   - 文件行点击下载（`api/unpackdl` 不变）；统计行显示"格式 · 当前层 N 项 / 共 M 项"。
3. 弹窗刷新恢复（`st.type==="unpack"`）仍从根层恢复。

## 三、样式（server/templates/index.html）
- `.unpack-row.dir`：cursor pointer + 文件名加粗 + hover 品牌浅蓝底（`--bs-primary-bg-subtle`）；
- `.dir-arrow`（▶ 指示，`--bs-secondary-color`）；`.unpack-crumb` 面包屑（seg hover/当前层高亮/分隔符），
  颜色全走 `--bs-*` 变量 → **深色模式自动适配**。

## 四、验证
- py_compile + node --check + CSS 括号平衡（344/344）通过。
- **后端单测**：zip/tar.gz/7z/rar 根层 + 子层（含中文名、隐含目录、空目录）全 PASS；
  `_fix_tar_name` GBK 模拟单测 PASS（中文路径还原、ASCII/UTF-8 名不动）；缺失 7z/WinRAR 时明确提示 PASS；单文件 gz 明确提示 PASS。
- **HTTP E2E**（端口 8898）：api/unpack（zip/tar/7z/rar）200；api/unpackdir（zip docs、7z docs/deep）200 层级正确；
  api/unpackdl 内容逐字节校验通过（zip 两级、tar.gz、7z、rar，均 200 + 内容一致）。测试服务器已关、临时文件已清。

## 五、已知边界
- rar/7z 需系统装有 7-Zip（推荐）或 WinRAR；未安装时预览/下载返回明确安装提示（非静默 unsupported）。
- 7z/WinRAR 下载的条目名若含 `*``?``[``]` 通配符，7z 可能按通配匹配（罕见场景，文档记录）。
- 单文件 gz/bz2/xz（非 tar 打包）无内部目录，返回明确提示并引导直接下载原文件。
- 空目录在 tar 中只有显式目录项才可见（tar 格式语义如此）；zip/7z 正常。


## 六、依赖最小化约束合规（用户强调"依赖尽可能小"）
1. **zip/tar 家族 = Python 标准库零新增依赖**：zipfile（原有）+ tarfile（本次新增 import，属标准库）；不引入任何新 pip 包。
2. **rar/7z 不引入新 pip 包**（无 py7zr/rarfile），改为**探测系统已有工具**：
   - 7-Zip：`C:\Program Files\7-Zip\7z.exe`、`C:\Program Files (x86)\7-Zip\7z.exe`、`7zz.exe`；
   - WinRAR：`C:\Program Files\WinRAR\Rar.exe` / `UnRAR.exe` / `WinRAR.exe`（含 (x86) 变体）；
   - 另自动探测 `%ProgramFiles%` / `%ProgramFiles(x86)%` / `%ProgramW6432%` 环境变量根目录与 PATH（`shutil.which`）；
   - 探测到才启用 rar/7z；未探测到 → 明确提示"需要 7-Zip 或 WinRAR，请安装 7-Zip（https://www.7-zip.org/）"（非静默 unsupported）。
3. **零新增 npm/pip 依赖、不下载二进制**；探测路径为模块级常量列表 `_SEVEN_7Z_PATHS` / `_WINRAR_PATHS`（server.py），用户可直接追加自定义安装路径。
4. 本机实测：7-Zip 已安装于 `C:\Program Files\7-Zip\7z.exe`（常量路径命中）；rar 经 7-Zip 读取验证通过；WinRAR 未安装（回退分支按文档实现，未实测）。
5. 该约束同样适用于团队其它任务（t24 无权限拦截等）：全程仅使用 Python 标准库 + 现有静态资源，无任何新增外部依赖。
