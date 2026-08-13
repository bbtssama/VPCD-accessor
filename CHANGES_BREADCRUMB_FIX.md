# T6 面包屑重复显示末级目录 · 修复摘要（CHANGES_BREADCRUMB_FIX）

> 任务：t6 紧急 bug 修复（netdisk-frontend-opt 团队 engineer）
> 位置：`static/app.js` renderBreadcrumb 非分享分支（仅此一处，与 t5 复核区域不重叠）
> 原则：最小改动、行为一致；node --check 门禁

## Bug 现象
面包屑重复显示最后一级目录：`F: / Windows.declined / donghua / donghua`（donghua 出现两次），实际只有一个 donghua 目录。

## 根因
`renderBreadcrumb` 非分享分支中，首段 `acc = part + "\\"`（盘符根带尾斜杠，如 `F:\`），
后续段原实现 `acc += "\\" + part` 在 acc 已以反斜杠结尾时再补一个反斜杠，
产生双反斜杠 `F:\\Windows.declined`，与后端 `os.path.join` 返回的单反斜杠路径
`F:\Windows.declined\donghua` 永不相等 → `acc === cur` 永远 false →
最后一段被 `addSeg` 渲染一次，又被末尾 `last` 高亮渲染一次 → 重复。

## 修复（一行核心逻辑 + 注释）
```js
parts.forEach((part, i) => {
  if (i === 0) acc = part + "\\";                                  // 首段：F:\
  else acc += (acc.endsWith("\\") ? "" : "\\") + part;          // 后续段：缺分隔符才补一个
  if (acc === cur) return;
  addSeg(part, acc);
});
```
要点：段间恰好一个反斜杠（与后端 `os.path.join` 一致），任意层级下最后一段
`acc === cur` 成立 → 末级目录只由 `last` 高亮渲染一次。

> ⚠️ 补充说明：队长原推荐写法 `else acc += part` 经验证**只对 2 层路径正确**——
> 3 层及以上（如 `F:\Windows.declined\donghua`）第三段会丢失分隔符（`F:\Windows.declineddonghua`），
> 故采用「缺分隔符才补一个反斜杠」的更健壮写法，已用 node 模拟验证。

## 验证（node 模拟 + 语法）
| 场景 | acc 序列 | 末段命中 cur | 末级重复 |
|---|---|---|---|
| 3 层（用户场景）`F:\Windows.declined\donghua` | `["F:\", "F:\Windows.declined", "F:\Windows.declined\donghua"]` | ✅ | 0（仅高亮一次） |
| 2 层 `F:\Windows.declined` | ✅ | ✅ | 0 |
| 根 `F:\` | ✅ | ✅ | 0 |
| 4 层深层 `D:\a\b\c\d` | ✅ | ✅ | 0 |
- `node --check static/app.js` 通过（exit 0）。
- 分享模式分支 / 虚拟分享分支（`rootNorm` 已去尾斜杠，拼接正确）确认无此问题，未改动。

## 回归面
- 仅改非分享分支的面包屑拼接；`addSeg` 的点击 target 也随之变为单反斜杠规范路径（与后端一致）。
- 未触碰后端、HTML id、其它函数。
