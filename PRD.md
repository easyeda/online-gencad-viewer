# PRD - Online GenCAD Viewer 产品需求文档

## 1. 产品概述

Online GenCAD Viewer 是一个纯前端的在线 PCB 文件查看器，支持解析和渲染 GenCAD (.cad) 格式文件。产品构建为单个自包含 HTML 文件，无需后端服务，可直接在浏览器中使用。

### 1.1 目标用户

- PCB 设计工程师
- 硬件工程师
- 需要查看 GenCAD 文件但没有安装专业 EDA 软件的用户

### 1.2 核心价值

- 零安装：单 HTML 文件，浏览器直接打开
- 快速预览：无需导入完整 EDA 工具即可查看 PCB 布局
- 交互式：支持缩放、平移、图层控制、元件/网络高亮

---

## 2. 技术架构

### 2.1 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 渲染引擎 | LeaferJS 2.x | HTML5 Canvas 场景图，高性能大量图元渲染 |
| 构建工具 | Vite 6.x | 开发服务器 + 生产构建 |
| 单文件打包 | vite-plugin-singlefile | 所有资源内联到单个 HTML |
| 语言 | TypeScript 5.x | 类型安全 |
| 视口控制 | LeaferJS zoomLayer + 手动 wheel/drag | 缩放平移 |

### 2.2 模块架构

```
┌─────────────────────────────────────────────────┐
│                   main.ts                        │
│         (应用入口、交互逻辑、高亮状态)            │
├─────────────────────────────────────────────────┤
│         UI Layer (src/ui/)                        │
│  layout | file-picker | layer-controls           │
│  left-panel | property-panel                     │
├─────────────────────────────────────────────────┤
│         Renderer Layer (src/renderer/)            │
│  index | board | route | component               │
│  primitives | colors                             │
├─────────────────────────────────────────────────┤
│         Parser Layer (src/parser/)                │
│  index | types | units                           │
└─────────────────────────────────────────────────┘
```

### 2.3 数据流

1. 用户加载 .cad 文件（拖拽、按钮选择、或内置示例文件）
2. Parser 解析文本为 `GenCADData` 结构
3. Renderer 将数据转换为 LeaferJS 场景图（分层 Group）
4. UI 根据 `layers` Map 构建图层控制和过滤器
5. 用户交互通过 main.ts 协调各模块

### 2.4 坐标系统

- GenCAD 使用 Y-up 坐标系
- Canvas 使用 Y-down 坐标系
- 渲染时对 Y 坐标取反：`canvasY = -gencadY`
- 旋转角度同样取反：`canvasRot = -gencadRot`
- 文本旋转遵循相同规则
- LeaferJS zoom 初始视口基于板框包围盒（Y取反后）

### 2.5 图层系统

渲染图层按视觉堆叠顺序（从底到顶）：

| 序号 | 图层 Key | 说明 |
|------|----------|------|
| 1 | BOARD | 板框 |
| 2 | ROUTES_BOTTOM | 底层走线容器 |
| 3 | ROUTE_BOTTOM | 底层走线 |
| 4 | PADS_BOTTOM | 底层焊盘（含 TH 焊盘的底层部分） |
| 5 | SILK_OUTLINE_BOTTOM | 底层丝印轮廓 |
| 6 | SILK_TEXT_BOTTOM | 底层丝印文本（位号） |
| 7 | VALUE_TEXT_BOTTOM | 底层值文本 |
| 8 | ROUTES | 内层走线容器 |
| 9 | ROUTE_INNER-n | 内层走线 |
| 10 | PADS_INNER-n | 内层焊盘（含 TH 焊盘的内层部分） |
| 11 | ROUTES_TOP | 顶层走线容器 |
| 12 | ROUTE_TOP | 顶层走线 |
| 13 | PADS_TOP | 顶层焊盘（含 TH 焊盘的顶层部分） |
| 14 | COMPONENTS | 元件轮廓组 |
| 15 | SILK_OUTLINE_TOP | 顶层丝印轮廓 |
| 16 | SILK_TEXT_TOP | 顶层丝印文本（位号） |
| 17 | VALUE_TEXT_TOP | 顶层值文本 |
| 18 | TH_DRILLS | 通孔钻孔 |
| 19 | VIAS_TOP / VIAS_BOTTOM / VIAS_INNER-n | 过孔焊盘（按层分组，跟随层可见性） |
| 20 | VIA_DRILLS | 过孔钻孔 |
| 21 | LABELS | 网络名标签 |

### 2.6 焊盘层分配规则

- **SMD 焊盘**：直接使用 `comp.layer` 作为目标层，不进行翻转
- **TH 焊盘**判定条件：`getDrillSize(pin.padName) > 0 && padstack.pads.length > 1`（不依赖 shape.insert 字段）
- **TH 焊盘层分配**：按 padstack 中每个 pad 的 layer 分别渲染到对应层
  - 底层元件的 TH 焊盘层名翻转：TOP↔BOTTOM
- **TH 钻孔**：统一放入 TH_DRILLS 组
- **带钻孔的 SMD 焊盘**（如连接器）：也会渲染钻孔到 TH_DRILLS

### 2.7 颜色系统

- 顶层：红色 `#ff4444`，底层：蓝色 `#4488ff`
- 内层：32 种预设亮色循环分配（`colors.ts` 中的 INNER_LAYER_COLORS）
- 丝印顶层：黄色 `#ffdd00`，丝印底层：棕色 `#aa6633`
- 网络名标签：白色
- 过孔：橙色 `#ffaa00`

---

## 3. 交互设计

### 3.1 视口操作

| 操作 | 行为 |
|------|------|
| 滚轮 | 以光标为中心缩放，倍率 1.35x |
| 左键拖拽 | 平移画布（setPointerCapture） |
| 右键拖拽 | 平移画布 |
| 工具栏放大 | 以画布中心放大 1.5x |
| 工具栏缩小 | 以画布中心缩小 1.5x |
| 适配视图 | 缩放并平移使整个板框可见 |

### 3.2 图层控制（右侧面板）

- 显示顺序：顶层 → 内层1~x → 底层 → 顶层丝印层 → 底层丝印层 → 钻孔层 → 板框层
- 点击眼睛图标切换单层可见性
- "全部图层"开关控制所有层
- 联动规则：
  - 隐藏走线层 → 同时隐藏对应 PADS_ 和 VIAS_ 组
  - 隐藏丝印层 → 同时隐藏对应 SILK_TEXT_ 和 VALUE_TEXT_ 组
  - 隐藏钻孔层 → 同时隐藏 VIA_DRILLS

### 3.3 图元过滤（顶部按钮）

| 按钮 | 控制目标 |
|------|----------|
| 全部 | 所有过滤器联动开关 |
| 导线 | ROUTES_BOTTOM, ROUTES, ROUTES_TOP |
| 过孔 | VIA_DRILLS + 所有 VIAS_* |
| 元件 | SILK_OUTLINE_*, PADS_*, TH_DRILLS |
| 位号 | SILK_TEXT_TOP, SILK_TEXT_BOTTOM |
| 值 | VALUE_TEXT_TOP, VALUE_TEXT_BOTTOM |
| 网络名 | LABELS |
| 焊盘 | PADS_TOP, PADS_BOTTOM, PADS_INNER-* |
| 钻孔层 | TH_DRILLS, VIA_DRILLS |

### 3.4 元件高亮

- 触发：点击左侧元件列表项
- 行为：
  1. 平移画布使元件位于视口中心
  2. 该元件的焊盘、丝印文本保持正常亮度（`_component === name`）
  3. 其他所有图元变暗（opacity: 0.15）
  4. BOARD 层保持正常亮度
  5. 右侧属性面板显示元件信息
- 实现：`dimChildrenExcept()` 按子元素匹配，非容器层整体 `dimGroup()`
- 退出：点击画布空白处（移动距离 < 5px 判定为点击）
- 强制重绘：`forceSyncRender()` 确保 Canvas 立即更新

### 3.5 网络高亮

- 触发：点击左侧网络列表项
- 行为：
  1. 计算网络包围盒中心，若不在可视区域则自动平移（`panToNetIfNeeded`）
  2. 该网络的走线段保持正常亮度（`_signal === signalName`）
  3. 该网络的过孔保持正常亮度
  4. 该网络连接的**特定引脚**焊盘保持正常亮度（精确到 `comp.pin` 级别，非元件级别）
  5. 其他所有图元变暗
  6. LABELS 层保持可见
  7. 跳过 ROUTES_BOTTOM/ROUTES/ROUTES_TOP 容器组，直接操作 ROUTE_ 子组
  8. 右侧属性面板显示网络信息（信号名、节点数、节点列表）
- 退出：点击画布空白处

### 3.6 文件加载

- 方式1：点击工具栏「打开文件」按钮
- 方式2：拖拽 .cad 文件到画布区域
- 方式3：欢迎页面点击「打开示例文件」按钮（加载内置 lckfb.cad）
- 加载后自动适配视图（`leafer.zoom('fit')`）

---

## 4. 渲染规则

### 4.1 走线

- 使用 Path/Line 元素，stroke 宽度为 track 宽度
- 颜色按层分配（colors.ts 定义）
- 圆弧走线使用 SVG Arc path（`arcSVGSegment`），strokeCap: 'round'
- GenCAD CCW 弧在 Y-down 坐标系中变为 CW → SVG sweep-flag = 0
- 网络名标签：白色，字体高度为导线宽度的 95%，居中显示在最长线段上
- 标签仅在线段长度足够容纳文本时显示

### 4.2 焊盘

- 根据 pad 定义的图元类型渲染：
  - LINE → LeaferJS Line
  - CIRCLE → LeaferJS Ellipse
  - RECTANGLE → LeaferJS Rect
  - 组合图元 → LeaferJS Path（`primitivesToPath` 合并路径，evenodd 填充）
- 颜色按所在层分配
- 焊盘标签：白色，显示 `引脚名:网络名`，字体自适应焊盘尺寸（`padSize * 0.8`）
- 标签旋转跟随焊盘方向

### 4.3 过孔

- 焊盘部分：按 padstack 各层分配到对应 VIAS_ 层组，使用层颜色
- 钻孔部分：背景色 `#1a1a2e` 填充圆形（模拟钻孔），放入 VIA_DRILLS
- 层可见性：VIAS_TOP/VIAS_BOTTOM/VIAS_INDER-n 各自独立控制

### 4.4 丝印

- 轮廓：按 shape 的 primitives 渲染线条/弧线
- 位号文本：TEXT 条目中 `str === comp.name` 的文本，放入 SILK_TEXT_ 层
- 值文本：TEXT 条目中 `str !== comp.name` 的文本，放入 VALUE_TEXT_ 层
- 居中位号：在 shape 包围盒中心额外渲染一个小字号位号

### 4.5 TEXT 角度计算

- GenCAD TEXT 的旋转是相对于所在 COMPONENT 的本地坐标
- 渲染时：父级 Group 承载元件旋转（`-comp.rotation`），TEXT 元素使用 `-txt.rot`
- 最终视觉角度 = comp.rotation + txt.rot（与 PCB 绝对角度一致）
- 镜像由父级 Group 的 scaleX/scaleY 处理，TEXT 本身不额外镜像

### 4.6 板框

- 按 board outline 的图元渲染封闭路径
- 填充半透明背景色
- 板框包围盒用于计算初始缩放和自适应尺寸参数（lineWidth, labelFontSize）

### 4.7 强制重绘

LeaferJS 设置 opacity 不会自动触发重绘，需要手动调用：
```typescript
function forceSyncRender(lf: Leafer) {
  const r = (lf as any).renderer;
  if (r) { r.totalTimes = 0; r.render(); }
}
```

---

## 5. 国际化

- 支持中文/英文切换
- 翻译函数 `t(key)` 从 `T` 对象获取当前语言文本
- 切换语言时自动刷新所有 UI 文本和属性面板（`refreshLabels`）
- 搜索框使用 `data-i18nPh` 属性标记
- 标题使用 `data-i18n` 属性标记

---

## 6. 构建与部署

- `npm run build` 输出单个 HTML 文件 `dist/online-gencad-viewer.html`
- 所有 JS/CSS 内联，无外部依赖
- CSS 通过 `src/style.css` 导入（非 index.html 内联，避免 vite-plugin-singlefile 冲突）
- 示例文件 `docs/lckfb.cad` 通过 Vite `?raw` 导入内联
- 版本号和构建日期通过 Vite `define` 注入（`__VERSION__`, `__BUILD_DATE__`）
- 可直接部署到任何静态文件服务器或 GitHub Pages
- 也可本地双击打开使用

---

## 7. 版本信息

- 版本号和构建日期通过 Vite define 注入
- 在关于弹窗中显示（包含 EasyEDA、LeaferJS 链接和项目描述）

---

## 变更记录

| 日期 | 变更内容 |
|------|----------|
| 2025-05 | 初始版本：SVG 渲染引擎 |
| 2026-05-12 | 迁移至 LeaferJS Canvas 渲染引擎，性能大幅提升 |
| 2026-05-13 | 完善图层控制、高亮交互、TH 焊盘多层渲染、网络自动平移、32层颜色、示例文件 |
