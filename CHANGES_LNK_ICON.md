# T34 .lnk 直接进入目标 + 双图标方案 · 改动摘要（CHANGES_LNK_ICON）

> 任务：t34（netdisk-frontend-opt 团队，原属 engineer 改派 feature-engineer）
> 改动文件：`static/app.js`、`server/templates/index.html`、`server/server.py`（静态白名单）、`static/icons/color/`（新增 14 个彩色 SVG）
> 原则：功能零破坏；showLnk 保留（操作面板查看目标）；线条图标体系完全保留；node --check 门禁。

## 一、.lnk 点击直接进入目标
- `bindRowAction` 的 lnk 分支：`showLnk`（弹窗）→ `openLnkTarget(e.path, e.name)`（直接导航）；
- 新增 `openLnkTarget`：调 `api/lnk` 解析 → 目标必须存在且在可访问根内（`api/stat` 校验，越界/不存在都算失效）→
  **目录 → loadList(target) 进入；文件 → loadList(dirnameOf(target)) 进入所在目录；失效 → toast("快捷方式已失效")**；
- `showLnk` 保留：操作面板（T20）"快捷方式跳转"按钮与 `previewFile`、弹窗恢复仍走它，行为不变。

## 二、双图标方案（线条 / 彩色可切换）
1. **彩色图标资源**：新增 `static/icons/color/` 14 个彩色 SVG（黄色文件夹、蓝视频、绿图片、紫音频、橙压缩包、蓝文档、绿表格、深色终端 exe、青代码、灰文本、浅灰通用文件、橙 ISO、黄+蓝快捷方式、琥珀锁）；
2. **后端白名单**：`_send_static` 的 icons 分支从 `os.path.join(STATIC_DIR, "icons", name)` 改为保留子目录（`os.path.normpath(STATIC_DIR + rel)` + 必须落在 icons/ 内），`static/icons/color/*.svg` 可正常服务，路径穿越仍被拦截（E2E 验证 404）；
3. **前端切换**：
   - 新增 `let iconStyle`（"line"|"color"）+ `typeIcon(kind, size)`：line → 内联线条 SVG；color → `<img src="static/icons/color/<kind>.svg">`（loading=lazy）；
   - `fileIcon()` / `iconUrl()` 按 `iconStyle` 取；目录/锁定图标调用点（列表行/网格卡/详情/解压行/收藏面板）全部改为 `typeIcon("folder"/"locked")`；
   - 侧边栏（视图与筛选面板）新增"图标风格"切换（线条/彩色按钮组，样式与视图切换一致），localStorage `drive.iconStyle` 记住，init 恢复；
   - 切换后 `renderEntries()` + `renderPinned()` 立即重渲染；分享模式不写 localStorage。
4. 保留线条：T24 deny-lock 小角标（12/16px 覆盖层）、打包面板行图标——刻意维持线条风格。

## 三、验证
- node --check / py_compile / CSS 括号平衡（348/348）全通过；
- **逻辑单测 10/10 PASS**：fileIcon line→内联 SVG、color→img（video/folder/pdf/image/archive/other 路径正确）；openLnkTarget 决策（目录→loadList(target)、文件→loadList(父目录)、stat 失败→toast）；
- **HTTP E2E PASS**（8897）：`static/icons/color/folder.svg` 200（内容含 #fbbf24 黄色）、video.svg 200、线条 folder.svg 仍 200；路径穿越 `icons/../app.js`、`icons/color/../../app.js` 均 404；
  真实 .lnk（PowerShell WScript.Shell 创建）：目录目标 is_dir=True、文件目标 is_dir=False；失效目标 exists=False + stat 403（前端 toast 路径）；
- 测试服务器已关、临时文件已清。
