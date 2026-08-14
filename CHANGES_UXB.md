# CHANGES_UXB.md — P3 打包预览树编码核查 + 筛选面板抽屉化验证（t39）

> 任务：t39（netdisk-frontend-opt 团队 / engineer）
> UX_REPORT §4 P3-9（打包预览树乱码 "演@构骰吧@"）与 P3-1（右侧筛选面板遮挡列表）。

## 结论先行

两项经代码定位 + 端到端复现验证：**均已由既有修复覆盖，无需新增改动**（避免与并行 t38 视觉区冲突、遵守"零功能破坏"）。

---

## 一、打包预览树乱码（P3-9）——已验证无复现

### 定位过程
打包/解压所有读文件名的代码路径逐一核查，均已在 t14（编码系统性修复）/ t25（多格式解压）接入统一编码修复：

| 路径 | 函数 | 编码处理 |
|---|---|---|
| zip 条目名 | `_unpack_zip` → `_fix_zip_name`（server.py:3597） | cp437→GBK 重解码，CJK≥2 且无控制字符才采用；ASCII/UTF-8 标志名不动 |
| tar/tgz 条目名 | `_unpack_tar` → `_fix_tar_name`（3640） | surrogateescape→GBK，CJK≥1 采用 |
| 7z 列表 | `_seven_list`（-sccUTF-8）+ `_decode_cmd`（3714） | UTF-8 优先、GBK 回退 |
| WinRAR 备选 | `_unpack_winrar` → `_decode_cmd` | 同上 |
| 打包任务名/current_file | `_archive_new_task` / `_archive_worker` | 真实路径（Python unicode，无解码环节） |
| 打包预览树/目录统计 | `_archive_preview` / `createPackPreview`（前端） | 真实路径直传 |

### 复现验证（8123，真实夹具）
- **GBK 无 UTF-8 标志 zip**（老式 Windows 打包）：`api/unpack` → 条目 `['中文条目.txt']` 正确（无乱码）
- **浏览器全流程**：中文文件夹（中文文档.txt / 资料/子文件.md / 老式中文包.zip）收藏 → 打包面板预览树 `T39Test ▶ 资料 ▶ 中文文档.txt 5 B 老式中文包.zip 131 B` 中文全部正确；提交打包 → 任务卡 `T39Test、资料 等 4 项 … 压缩完成 · 待下载` 正确；0 pageerror
- mimo 视觉验收：打包预览树/任务卡中文正常，无 "演@构骰吧@" 类乱码

> UX 报告截图（t5_pack_done）早于 t14/t25 编码修复；当前代码已不存在该缺陷。本地无 7z/rar 工具（Get-Command 为空），该路径按 `_decode_cmd` 逻辑核查无误。

## 二、筛选面板抽屉式（P3-1）——已验证已实现

### 现状核查（index.html）
`.sidebar` 已是标准右侧抽屉：`position: fixed; right:0; width:min(320px,86vw); transform:translateX(102%); transition:transform .28s ease`，`.show` 滑入；`.sidebar-mask` 半透明遮罩（z-index 1040 < sidebar 1041），点遮罩/✕ 关闭。

### 浏览器实测（Playwright）
- 桌面 1280px：打开抽屉后**列表宽度 1182→1182 零变化**（overlay 浮层不挤压列表）✅；侧边栏宽度恰为 320px ✅
- 点遮罩关闭 ✅；✕ 按钮关闭 ✅
- 手机 375px：抽屉 320px ≤ 视口（约 85% 宽）✅
- 面板功能完整（搜索/排序/类型筛选/推荐标签/重置/图标风格/显示隐藏文件均在 sidebar-body 内，HTML id 未变）
- 0 pageerror；mimo 验收：抽屉从右滑入、不遮挡列表、移动端适配良好

## 三、验证记录

- node --check ✅ / py_compile ✅（本任务未改 server.py，无重启需求）
- 8123 E2E 全项 PASS；截图 t39_pack_tree / t39_pack_done / t39_drawer_desktop / t39_drawer_mobile
- 夹具（Desktop\T39Test）已清理；测试 8123 的瞬态 pin/任务随重启清空，8443 生产未受影响

## 四、涉及文件

- 本任务未改动任何源码（两项均已由既有实现覆盖）；`CHANGES_UXB.md` 为核查与验证记录。
