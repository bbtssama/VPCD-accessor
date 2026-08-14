# CHANGES_LNK_DETAIL.md — .lnk 点击行为 + 详情按钮落地（T32）

> 任务：t32（netdisk-frontend-opt 团队 / engineer）
> 语义已由用户确认：点击 .lnk → 解析目标 → 目录进入 / 文件进入其所在目录 / 失效 toast。
> 与 t20（操作面板）/ t21（详情重构）同一套面板联动；.lnk 直接进入目标主体为 T34-1 已落地，本任务补齐次要入口并修复后端编码缺陷。

## 一、确认的 .lnk 点击行为（已验证全链路）

| 场景 | 行为 | E2E 实测 |
|---|---|---|
| 目标存在且是目录 | loadList(目标) 直接进入 | ✅ 到目录.lnk → 进入 ...Desktop\Other |
| 目标存在是文件 | loadList(dirnameOf(目标)) 进入所在目录 | ✅ 到文件.lnk → 进入 ...Desktop |
| 目标失效/不存在 | toast("快捷方式已失效")，不导航 | ✅ 失效.lnk → toast，目录不变 |
| 越界/stat 校验 | 目标必须在可访问根内，否则视为失效 | ✅（openLnkTarget 双重校验 api/lnk + api/stat） |

## 二、本任务改动

### 1. server.py — _lnk_target 中文目标编码修复（关键 bug）
- 现象：目标文件名含中文时乱码，如 ai大模型api备注.txt → ai澶фā鍨媋pi澶囨敞.txt（UTF-8 字节被按 GBK 解码），导致 exists=false、快捷方式被误判失效。
- 根因：PowerShell 5.1 管道输出为 UTF-8 字节，原代码 encoding=gbk 解码。
- 修复：PS 命令开头强制 $OutputEncoding=[Console]::OutputEncoding=[Text.Encoding]::UTF8，Python 侧改 encoding=utf-8；中文路径（目录/文件/工作目录/参数）均正确。
- 验证：8123 与 8443 生产（已按流程重启，PID 65268 启动 10:25:15 > server.py mtime 10:24:12）实测 ai大模型api备注.txt → target 正确 / exists:true。

### 2. static/app.js — showLnk 次要入口落地
- 缺口：T34-1 让 .lnk 点击直接进目标后，操作面板无 lnk 分支、列表无入口 → showLnk（查看/跳转快捷方式目标）在 UI 上不可达。
- 修复：
  - showFileActions：fileKind==="lnk" 时在按钮区新增「快捷方式目标」按钮（link 图标，→ showLnk(e.path, e.name)），与 下载/分享/收藏/取消 并列；面板头部照常显示 图标+名+类型(LNK)+大小。
  - bindRowAction lnk 分支：点击仍为进入目标（确认语义不变）；新增 contextmenu（右键）次要入口 → 打开操作面板。桌面用户右键即可查看/跳转目标；移动端长按多选行为不变。
- showLnk 弹窗本身保留（目标路径 / 目标为目录📂 / 进入目标所在目录 / 下载快捷方式本身）。

### 3. 顺带修复：并行改动引入的语法错误
- gridItem 图片封面回退行（api/img onerror）被并行成员改坏（this.src='' 引号错位，node --check 失败），已按视频行模式修复为 this.src=\'...\'，node --check 恢复通过。提示：涉及该行（app.js ~3665）的并行改动请注意。

## 三、t21 详情 ⓘ 落地复核（收尾补充）
- 列表行/网格卡 .info-btn / .grid-info 数量 = 0（实测）；
- 详情入口：①操作面板新增「详情」按钮 → showDetail（完整详情弹窗：路径/大小/时间/元数据/预览按钮），other 与 lnk 面板均已实测；②有预览 → 预览弹窗内（addFsButton detailPath）；③分享模式行尾分享按钮保留。
- 收尾指令后补：showFileActions 按队长要求补回「详情」按钮（原 t21 曾以头部显示信息为由省略，现明确并入面板）。

## 四、验证
- node --check ✅ / py_compile server.py ✅
- 8123 E2E（Playwright + 真实 .lnk，PowerShell WScript.Shell 创建）：目录目标 / 文件目标 / 失效目标 / 右键面板 / 快捷方式目标弹窗 5 项全 PASS，0 pageerror
- 截图：G:\自建agent专用工作区\DSH\_t8shots\t32_lnk_panel.png
- 8443 生产服务已重启并验证（见上）；测试用 .lnk 已清理（Desktop\TestLnks 删除）

## 五、涉及文件
- server/server.py（_lnk_target 编码）
- static/app.js（showFileActions lnk 分支、bindRowAction contextmenu、图片回退引号修复）