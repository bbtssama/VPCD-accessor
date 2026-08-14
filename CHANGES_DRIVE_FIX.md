# T26 磁盘标签激活态同步 + 盘号显示修复 · 改动摘要（CHANGES_DRIVE_FIX）

> 任务：t26（netdisk-frontend-opt 团队 feature-engineer）
> 改动文件：`static/app.js`
> 现象（用户反馈）：前进/后退切换目录时（尤其跨盘，如 C 进 D 再后退），顶部磁盘标签激活高亮、面包屑 🏠 不刷新，显示的仍是旧盘。

## 根因
- `loadList`（原 app.js:3293）只调 `renderBreadcrumb()` + `updateNavBtns()`，从不调 `renderDriveTabs()`；
- `renderDriveTabs()` 只在 `switchDrive`（原 2431）里调用；
- `navBack` / `navFwd`（原 2586-2587）直接 `loadList(navStack[...])`，不更新 `activeRoot`；
- ⇒ 跨盘导航后：磁盘激活态不刷新、面包屑 🏠 指向旧 activeRoot、localStorage drive.root 也保存错误盘。

## 修复
1. **新增 `rootOf(path)`**：从路径推断所属根——roots 中最长的前缀匹配（Windows 盘符**大小写不敏感**，兼容 `/` 与 `\\` 分隔），无匹配返回 null。
2. **新增 `syncDriveUI()`**（统一同步入口）：按当前 `cur` 推断所属盘，若与 `activeRoot` 不一致则更新 `activeRoot` 并重渲染 `renderDriveTabs()`；分享模式跳过（无磁盘标签，activeRoot 由分享根决定）。
3. **`loadList` 成功路径挂接**：`cur = path` 之后立即调用 `syncDriveUI()`——覆盖**所有**导航路径（switchDrive / navBack / navFwd / 面包屑点击 / 目录行点击 / .lnk 跳转 / 刷新恢复 / 收藏面板跳转），一处改动全局生效；错误路径不触发（cur 未变）。
4. **init 恢复逻辑强化**（盘号显示不一致的边缘场景）：
   - 优先按 `savedCur` 用 `rootOf` 推断真实所属盘（修复 savedRoot 与 savedCur 跨盘错位缓存）；
   - `savedCur` 失效（盘消失/目录被删）→ 回退 `savedRoot`；
   - 两者都失效 → `roots[0]` 并**清理陈旧 localStorage 键**（drive.root / drive.cur）。
5. **面包屑 🏠**：因 `activeRoot` 现在始终与 cur 同步，`if (cur !== activeRoot) addSeg("🏠", activeRoot)` 自动指向正确盘。

## 验证
- node --check 通过；
- **rootOf 逻辑单测（9/9 PASS）**：C:\\ / C:\\Users\\x / D:\\data / 大小写 d:\\data / F: / G:\\deep 均正确；X:\\no 与空串返回 null；最深前缀优先；
- **跨盘模拟 PASS**：C: 根 → 进入 D:\\data\\sub（activeRoot=D）→ 后退回 C:（activeRoot=C）→ 再前进回 D（activeRoot=D）；
- 全导航路径审计：所有 loadList 调用点（面包屑/后退/前进/目录行/刷新/.lnk/收藏/init）均经 syncDriveUI，无遗漏旁路。
