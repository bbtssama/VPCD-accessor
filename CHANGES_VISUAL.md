# T2 视觉美化 · 改动摘要（CHANGES_VISUAL）

> 任务：t2 视觉美化（netdisk-frontend-opt 团队 engineer）
> 依据：FRONTEND_AUDIT.md「二、视觉 / UI」全部 P2 + 相关 P3
> 改动文件：`server/templates/index.html`（内联 <style> + 3 处 HTML）、`static/app.js`（2 处）
> 原则：功能零改动、所有 HTML id 不变、改动克制可回归；仅样式/结构/A11y 增强

## 1. 完整品牌色变量层（:root --brand-* 体系）
- 新增 `--brand-primary/success/info/warning/danger` 及各自 `-subtle`、`-emphasis`、`-rgb` 变体，外加中性面 `--brand-bg/surface/border/text/text-muted`。
- 映射为 Bootstrap 语义变量：`--bs-primary`、`--bs-success`、`--bs-info`、`--bs-warning`、`--bs-danger` 及 `-bg-subtle`、`-border-subtle`、`-text-emphasis` 全套 —— 按钮、badge、alert、text-muted、边框全部统一到品牌色。
- 修复两处「散落色」：
  - `--bs-progress-bar-bg` 默认是 Bootstrap 蓝 #0d6efd，现在指向 `var(--bs-primary)`（进度条与按钮同色）；
  - `--bs-link-color` 默认 #0d6efd → 品牌蓝。
- `--bs-secondary-color`（text-muted）、`--bs-tertiary-bg`、`--bs-secondary-bg`、`--bs-border-color` 统一到品牌灰阶（#6b7280 / #e9edf2 / #e5e7eb / #e5e7eb）。
- 基调克制：仍为 #2563eb 蓝 + #f3f4f6 灰。

## 2. 列表行 hover / 选中态
- `.list-group-item` 增加 `transition: background-color .15s`，桌面（`@media (hover: hover)`）悬停背景 `var(--bs-tertiary-bg)`，触屏无 sticky hover。
- 顺带把既有的 `#breadcrumb .seg`、`.unpack-row`、`.vtag`、`.tag-chip` hover 一并包进 `(hover: hover)`（修复审计 P3-6 触屏点按后 hover 残留）。

## 3. 深色模式（prefers-color-scheme: dark）
- 一套变量覆盖实现整站深色：页面底 #0f172a（slate-900）、面板 #1e293b（slate-800）、边框 #334155、正文 #f1f5f9、弱化 #94a3b8；primary 提亮为 #3b82f6 保证对比度，各 subtle/emphasis 同步翻转。
- 硬编码浅色处理：`.bg-white`（navbar / card-header）翻转到 `--brand-surface`；`.btn-close` 白色化；sidebar / pack-panel / type-chip / tag-chip 的白底改为 `var(--brand-surface)`（原硬编码 #fff 共 4 处）；打包空闲条纹走 `--bs-secondary-bg/tertiary-bg` 变量。
- highlight.js（GitHub 浅色主题）token 全套翻转为深色配色（`.hljs` 及 15 组 token 类），代码预览深色下可读。

## 4. 网格卡片层级
- `.grid-item` 增加 `border-radius: 10px` + `transition`，hover 时 `box-shadow: 0 4px 14px rgba(17,24,39,.10)`（桌面 only）。
- 图标区与名称区间距 6px → 8px；`.grid-star` 加 hover scale(1.15) 反馈（与 `.star` 一致）。

## 5. 字体
- body 桌面字号 14px → **14.5px**（移动端 15px 不变）。
- 字体栈加 `"Noto Sans SC"`，并同步 `--bs-body-font-family`（Bootstrap 组件也走同一栈）。

## 6. 置顶卡头部键盘可达
- index.html：`#pinnedHead` 加 `tabindex="0"`、`aria-expanded="true"`。
- app.js：`onkeydown` 处理 Enter / Space（`preventDefault` 后触发 click）；onclick 与 `renderPinned` 同步维护 `aria-expanded`（与 chevron 一致）。

## 7. toast / 焦点
- toast：`role="status"` 已有，补显式 `aria-live="polite"`；加轻投影提升可见性。
- 统一 `:focus-visible { outline: 2px solid var(--bs-primary); outline-offset: 2px }`，所有键盘可达控件一致高亮；`#pinnedHead` 加圆角让焦点环美观。

## 8. 其他（审计 P3，顺手项）
- favicon 由空 `data:,` 换成内联 SVG（品牌蓝圆角方块 + 白云），零额外请求。

## 验证
- `node --check static/app.js` 通过（exit 0）。
- HTML 非 void 标签闭合平衡校验通过；CSS 花括号深度平衡（0）。
- 功能与 id 未变；未触碰后端接口。

## 遗留说明（不属 t2 范围，供 t3/t4/reviewer 参考）
- 深色模式下视频区保持 #000（正常）；toast 仍为深色胶囊（两模式通用）。
- 移动端专项（导航栏顶部安全区、overscroll 防下拉刷新等）归 t3。
