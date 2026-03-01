# 3D AI Game Template

> An AI-native 3D browser game template powered by Three.js + TypeScript + Vite

---

## ✨ 项目简介

这是一个完整的、可直接运行的 **AI 原生 3D 赛马游戏**模板。
区别于传统游戏模板，本项目将 **大语言模型（LLM）深度集成到游戏核心玩法**中：

- 🤖 **AI 实时生成关卡** — Gemini/DeepSeek 在线生成跑酷赛道（ASCII → 3D）
- 🏇 **AI 控制对手** — GeminiRacer 驱动的 AI 赛手，有性格、有记忆
- 🃏 **Roguelike 卡牌** — AI 生成卡牌内容，玩家在选择门处做决策
- 🌍 **主题动态切换** — AI 根据玩家行为实时切换场景主题（沙漠/冰雪/森林等）

---

## 🎮 游戏内容

| 场景 | 玩法描述 |
|------|---------|
| **马厩 (StableScene)** | 游戏大厅，训练马匹、选择坐骑、进入各模式 |
| **限时竞速 (RaceScene)** | 60 秒限时赛马，冲刺拿奖杯 |
| **AI 对战 (BattleRaceScene)** | 与 AI 对手实时博弈的竞速对战 |
| **AI 跑酷 (ParkourScene)** | AI 无限生成的跑酷赛道，越跑越难 |

### 核心系统

- **坐骑系统** — 12 匹可解锁坐骑，各有速度/加速/金币加成
- **宠物系统** — 宠物跟随 + 抽卡
- **天赋系统** — 天赋树解锁被动能力
- **训练师系统** — 选择训练师获得专属加成
- **转生系统** — 重置属性换取永久加成
- **数值持久化** — 所有进度通过 localStorage 本地保存

---

## 🛠️ 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| [Three.js](https://threejs.org/) | ^0.170.0 | 3D 渲染引擎 |
| [TypeScript](https://www.typescriptlang.org/) | ^5.7.0 | 主开发语言 |
| [Vite](https://vitejs.dev/) | ^6.1.0 | 构建工具 + HMR |
| Gemini / DeepSeek / 混元 | — | LLM 关卡生成与 AI 对手 |

> **纯前端项目**，无后端依赖，所有 LLM 调用直接从浏览器发起。

---

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- 现代浏览器（支持 WebGL 2.0）
- （可选）Gemini API Key，用于 AI 关卡生成

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/YOUR_USERNAME/3d-game-template.git
cd 3d-game-template

# 安装依赖
npm install

# 启动开发服务器（局域网可访问）
npm run dev

# 生产构建
npm run build

# 预览构建产物
npm run preview
```

### 配置 AI 功能

游戏右上角 ⚙ 设置面板中，填入你的 LLM API Key（支持 Gemini / DeepSeek / 腾讯混元）即可启用 AI 关卡生成和 AI 对手。

---

## 📁 项目结构

```
3d-game-template/
├── index.html                  # 入口 HTML
├── package.json
├── tsconfig.json
├── vite.config.ts
├── assets/                     # 静态资源
│   ├── models/                 # 3D 模型
│   ├── textures/               # 纹理贴图
│   └── music/                  # 音频资源
├── docs/                       # 技术文档
│   ├── ARCHITECTURE.md         # 架构设计
│   ├── AI_NATIVE_FRAMEWORK.md  # AI 原生框架说明
│   ├── AI_GAME_JOURNEY.md      # 开发历程
│   └── NUMERIC_MODEL.md        # 数值模型设计
└── src/
    ├── main.ts                 # 游戏入口
    ├── engine/                 # 引擎核心
    │   ├── Engine.ts           # 主引擎（渲染/场景/生命周期）
    │   ├── Clock.ts            # 固定/可变时间步长时钟
    │   ├── SceneManager.ts     # 基于栈的场景管理
    │   └── LegacyAdapter.ts    # HL 兼容层
    ├── input/
    │   ├── InputManager.ts     # 统一输入（键盘/鼠标/触控/手柄）
    │   └── InputAction.ts      # 动作映射（可配置键位）
    ├── world/
    │   ├── World.ts            # 世界容器（Three.js Scene + 实体注册）
    │   └── Entity.ts           # 实体基类
    ├── audio/
    │   └── AudioManager.ts     # SFX / BGM（Web Audio API）
    ├── game/                   # 游戏主逻辑
    │   ├── DemoScene.ts        # 演示场景（模板起点）
    │   ├── GameDirector.ts     # 游戏总控（赛事 / AI 管理）
    │   ├── ChunkManager.ts     # AI 跑酷赛道块流式管理
    │   ├── SpawnSceneBuilder.ts
    │   └── scenes/             # 各游戏场景
    ├── entities/               # 游戏实体
    │   ├── Horse.ts            # 马匹（速度/动画/坐骑/战斗）
    │   ├── Pet.ts              # 宠物跟随
    │   ├── Track.ts            # 赛道
    │   └── TrailEffect.ts      # 尾迹特效
    ├── ai/                     # AI 系统
    │   ├── GeminiArchitect.ts  # LLM 赛道生成 + AI 存在感
    │   ├── GeminiRacer.ts      # AI 对战对手
    │   ├── ThemeRegistry.ts    # 场景主题注册（52 种主题）
    │   ├── AssetRegistry.ts    # ASCII 资产库
    │   ├── AIPersonality.ts    # AI 对手性格定义
    │   ├── PlayerMemory.ts     # AI 玩家记忆系统
    │   ├── llm/LLMBridge.ts    # LLM 多供应商桥接
    │   └── generators/
    ├── systems/                # 游戏系统
    │   ├── CardSystem.ts       # Roguelike 卡牌
    │   ├── DecisionSystem.ts   # 博弈决策
    │   ├── RewardSystem.ts     # 奖励系统
    │   ├── RebirthSystem.ts    # 转生系统
    │   └── PlayerBehaviorTracker.ts
    ├── data/                   # 数据与配置
    │   ├── PlayerProgress.ts   # 玩家进度持久化
    │   ├── MountRegistry.ts    # 坐骑数据（12 匹）
    │   ├── TalentRegistry.ts   # 天赋数据
    │   ├── PetRegistry.ts      # 宠物数据
    │   ├── types/GameTypes.ts  # 核心类型定义
    │   └── configs/*.json      # 静态配置
    ├── ui/                     # UI 组件（DOM 覆盖 Canvas）
    │   ├── HUD.ts              # 游戏内抬头显示
    │   ├── CardPickerUI.ts     # Roguelike 卡牌弹窗
    │   ├── MountUI.ts          # 坐骑选择面板
    │   ├── TalentUI.ts         # 天赋面板
    │   ├── PetUI.ts / PetGachaUI.ts
    │   ├── BattleUI.ts         # 对战 HUD
    │   └── SettingsUI.ts       # AI 设置面板
    ├── utils/
    │   ├── EventBus.ts         # 类型安全事件总线
    │   ├── AssetLoader.ts      # 资产加载与缓存
    │   └── GeometryUtils.ts
    └── platform/
        └── Bridge.ts           # 平台通信桥接（postMessage）
```

---

## 🏗️ 架构设计

### 引擎架构

```
┌─────────────────────────────────────┐
│           main.ts（入口）            │
├─────────────────────────────────────┤
│  模板引擎 Engine                     │
│  ├── WebGLRenderer + Camera         │
│  ├── SceneManager（栈式场景管理）    │
│  ├── World（实体注册 + Three.Scene） │
│  ├── InputManager                   │
│  └── AudioManager                   │
├─────────────────────────────────────┤
│  场景层 / 实体层 / 系统层 / AI 层    │
├─────────────────────────────────────┤
│  platform/Bridge.ts（跨平台通信）    │
└─────────────────────────────────────┘
```

### AI 跑酷数据流

```
PlayerBehaviorTracker（采集遥测数据）
        ↓
GeminiArchitect.generateChunk()（调用 LLM）
        ↓
AsciiMapChunk { theme, rows[], narration, cards }
        ↓
ChunkManager.buildChunkFromAsciiMap()（ASCII → 3D）
        ↓
ParkourScene.onUpdate()（碰撞 + 分数 + AI 叙事）
```

### 场景流转

```
       ┌──────────────────────────────┐
       │         StableScene          │
       │   马厩（大厅 / 选坐骑 / 训练）  │
       └──┬──────────┬────────────────┘
          │          │
    走向比赛门    走向跑酷门
          │          │
          ▼          ▼
    RaceScene    ParkourScene
    60秒竞速     AI无限跑酷
          │          │
       结算画面    死亡结算
          └────┬─────┘
               ▼
         返回 StableScene
```

---

## 🔧 开发指南

### 添加新场景

```typescript
// src/game/scenes/MyScene.ts
import { GameScene } from '../../engine/SceneManager';
import { Engine } from '../../engine/Engine';

export class MyScene implements GameScene {
  async onInit(engine: Engine): Promise<void> {
    // 初始化场景资源
  }

  onUpdate(dt: number): void {
    // 每帧更新（dt 单位：秒）
  }

  onDestroy(): void {
    // 清理资源
  }
}
```

### 创建游戏实体

```typescript
// src/entities/MyEntity.ts
import { Entity } from '../world/Entity';
import * as THREE from 'three';

export class MyEntity extends Entity {
  protected createMesh(): THREE.Object3D {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshToonMaterial({ color: 0xff6600 });
    return new THREE.Mesh(geo, mat);
  }

  onUpdate(dt: number): void {
    this.root.rotation.y += dt;
  }
}
```

### 使用事件总线

```typescript
import { EventBus } from '../utils/EventBus';

// 发布事件
EventBus.emit('race:finished', { trophies: 100 });

// 订阅事件
EventBus.on('race:finished', ({ trophies }) => {
  console.log('获得奖杯:', trophies);
});
```

---

## 📋 技术规范

- **语言**：TypeScript（严格模式，`strict: true`）
- **模块**：ES Module，路径别名 `@/` → `src/`
- **渲染**：Three.js `MeshToonMaterial`（Roblox 卡通风格）
- **UI**：DOM 元素覆盖在 Canvas 之上，无独立 UI 框架
- **存储**：localStorage 持久化玩家进度
- **LLM**：浏览器直接调用（Gemini / DeepSeek / 腾讯混元）
- **禁止**：Python 或任何后端语言

---

## 📚 文档

| 文件 | 说明 |
|------|------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 完整架构设计 |
| [docs/AI_NATIVE_FRAMEWORK.md](docs/AI_NATIVE_FRAMEWORK.md) | AI 原生框架设计理念 |
| [docs/NUMERIC_MODEL.md](docs/NUMERIC_MODEL.md) | 游戏数值模型（马匹/技能/奖励） |
| [docs/AI_GAME_JOURNEY.md](docs/AI_GAME_JOURNEY.md) | 项目开发历程 |
| [AGENTS.md](AGENTS.md) | AI Agent 开发规范 |

## 📄 License

本项目基于 [MIT License](LICENSE) 协议开源发布。
