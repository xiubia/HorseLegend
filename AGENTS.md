# HorseLegend

这是一个基于 Three.js 的 3D 游戏项目。

## 重要：技术栈限制

**禁止使用 Python 或任何后端语言。** 本项目是纯前端游戏项目，只能使用以下技术栈：

- **TypeScript** - 主要开发语言
- **JavaScript** - 可选
- **Vite** - 构建工具
- **Three.js** - 3D 渲染引擎
- **HTML/CSS** - 页面结构和样式

所有游戏逻辑必须在浏览器端运行，通过 Vite 开发服务器提供 HMR 支持。

## 项目结构（统一规范）

```
├── index.html           # 入口 HTML
├── package.json         # 依赖配置
├── vite.config.ts       # Vite 配置
├── tsconfig.json        # TypeScript 配置
├── assets/              # 资源目录
│   ├── models/          # 3D 模型
│   ├── textures/        # 纹理贴图
│   └── music/           # 音频资源
└── src/
    ├── main.ts          # 游戏入口
    ├── engine/          # 引擎核心（通用功能）
    │   ├── Engine.ts    # 引擎主类
    │   ├── Clock.ts     # 时钟系统
    │   ├── Renderer.ts  # 渲染器封装
    │   └── SceneManager.ts # 场景管理器
    ├── input/           # 输入系统
    │   ├── InputManager.ts  # 输入管理器
    │   └── InputAction.ts   # 动作映射
    ├── world/           # 世界管理
    │   ├── World.ts     # 世界容器
    │   └── Entity.ts    # 实体基类
    ├── audio/           # 音频系统
    │   └── AudioManager.ts
    ├── game/            # 游戏逻辑（主要开发区）
    │   └── DemoScene.ts # 演示场景
    ├── systems/         # 游戏系统（碰撞、AI、物理等）
    ├── ui/              # UI 组件（菜单、HUD、对话框）
    │   └── UIManager.ts # UI 管理器
    ├── utils/           # 工具函数
    │   ├── EventBus.ts  # 事件总线
    │   └── AssetLoader.ts # 资源加载器
    └── platform/        # 平台通信（不要修改）
        └── Bridge.ts
```

## 目录职责

| 目录 | 职责 | 示例 |
|------|------|------|
| `engine/` | 引擎核心功能 | 游戏循环、渲染、时钟、场景管理 |
| `input/` | 输入系统 | 键盘/鼠标/触控/手柄输入、动作映射 |
| `world/` | 世界管理 | 场景图、实体、光照 |
| `audio/` | 音频系统 | 音效播放、BGM 管理 |
| `game/` | 游戏主逻辑 | 场景、关卡、游戏流程 |
| `systems/` | 游戏系统 | PhysicsSystem.ts, AISystem.ts |
| `ui/` | UI 组件 | Menu.ts, HUD.ts, Dialog.ts |
| `utils/` | 工具函数 | EventBus.ts, AssetLoader.ts |
| `platform/` | 平台通信 | **不要修改** |

## 开发指南

1. 开发文档在`docs`每次开发前请仔细阅读
2. 主要在 `src/game/` 中编写游戏场景，实现 `GameScene` 接口
3. 游戏实体继承 `Entity` 基类，放在 `src/world/` 或 `src/entities/` 目录
4. 复杂系统放在 `src/systems/` 目录
5. UI 组件放在 `src/ui/` 目录
6. 使用 Three.js 的 API 创建 3D 对象、灯光、材质、相机等
7. 使用 `src/engine/Engine.ts` 管理游戏循环和子系统
8. 使用 `src/input/InputAction.ts` 配置键位映射
9. 3D 模型放在 `assets/models/`，纹理放在 `assets/textures/`
10. 音频资源放在 `assets/music/` 目录下
11. **阶段性复盘**：每个任务完成后，请在 `history.md` 追加结构化总结。内容必须精简地包含：本阶段目标、关键逻辑/文件变更、以及引出该变更的核心对话 Prompt。
