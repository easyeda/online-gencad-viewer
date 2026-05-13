# Online GenCAD Viewer

[English](./README-EN.md) | 中文

在线 GenCAD (.cad) PCB 文件查看器，支持多层布局、走线、焊盘、过孔、丝印等元素的交互式可视化展示。

你可以直接在这里使用：https://pcbtool.net/tools/online-gencad-viewer.html

## 功能特性

- 解析并渲染 GenCAD 格式 PCB 文件
- 多层可视化：顶层、底层、内层、丝印层、钻孔层、板框层
- 图层独立显示/隐藏控制
- 图元过滤：导线、过孔、元件、位号、值、网络名
- 元件列表与网络列表，支持搜索
- 点击元件/网络高亮，自动平移到可视区域
- 滚轮缩放（光标中心）、拖拽平移
- 适配视图、放大、缩小
- 中英文界面切换
- 构建为单个 HTML 文件，无需服务器即可使用

## 技术栈

- **渲染引擎**: [LeaferJS](https://www.leaferjs.com) (HTML5 Canvas)
- **构建工具**: [Vite](https://vitejs.dev) + [vite-plugin-singlefile](https://github.com/nickreese/vite-plugin-singlefile)
- **语言**: TypeScript
- **输出**: 单个自包含 HTML 文件

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本（输出到 dist/online-gencad-viewer.html）
npm run build

# 预览生产构建
npm run preview
```

## 使用方式

1. 打开页面后，点击「打开文件」按钮或直接拖拽 `.cad` 文件到页面
2. 使用右侧图层面板控制各层的显示/隐藏
3. 使用顶部过滤按钮切换图元类型的显示
4. 在左侧面板搜索并点击元件或网络进行高亮定位
5. 点击画布空白处退出高亮模式
6. 滚轮缩放，左键/右键拖拽平移

## 项目结构

```
src/
├── parser/          # GenCAD 文件解析器
│   ├── index.ts     # 主解析逻辑
│   ├── types.ts     # 数据类型定义
│   └── units.ts     # 单位转换
├── renderer/        # LeaferJS 渲染器
│   ├── index.ts     # 渲染入口，图层组装
│   ├── board-renderer.ts      # 板框渲染
│   ├── route-renderer.ts      # 走线/过孔渲染
│   ├── component-renderer.ts  # 元件/焊盘/丝印渲染
│   ├── primitives.ts          # 图元转换工具
│   └── colors.ts              # 图层颜色定义
├── ui/              # 用户界面
│   ├── layout.ts    # 布局、工具栏、国际化
│   ├── file-picker.ts         # 文件加载
│   ├── layer-controls.ts      # 图层/过滤控制
│   ├── left-panel.ts          # 元件/网络列表
│   └── property-panel.ts      # 属性面板
└── main.ts          # 应用入口，交互逻辑
```

## 作者

[EasyEDA](https://easyeda.com)

## 许可证

MIT
