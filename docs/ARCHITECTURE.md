# 技术架构文档

## 一、整体架构

本项目是基于 **Three.js + TypeScript + Vite** 的纯前端 3D 游戏模板，采用**双层引擎架构**：

- **模板引擎层**（Template Engine）：通用 3D 游戏框架，提供 `GameScene` 接口、`SceneManager`、`World`、`Entity` 基类等。
- **HL 兼容层**（Legacy Adapter）：桥接 Horse_Legend 项目的 `Scene`/`Engine`/`World`/`Input` 接口到模板引擎，使 HL 场景无需大规模重写。

```
┌─────────────────────────────────────────────────┐
│                 main.ts（入口）                   │
│  创建 Engine → createLegacyAdapter → 启动循环    │
├─────────────────────────────────────────────────┤
│  模板引擎 Engine                                 │
│  ├── renderer (THREE.WebGLRenderer)             │
│  ├── scenes (SceneManager → GameScene 接口)     │
│  ├── world (World → Entity 管理)                │
│  ├── input (InputManager)                       │
│  └── audio (AudioManager)                       │
├─────────────────────────────────────────────────┤
│  HL 兼容层 LegacyAdapter                         │
│  ├── Engine (HL Engine 接口包装)                  │
│  ├── LegacyWorld (HL World → THREE.Scene)       │
│  ├── LegacyInput (键盘/鼠标 → getAxis())        │
│  └── createLegacyAdapter() 工厂函数              │
├─────────────────────────────────────────────────┤
│  Entity 基类 + HL 兼容方法                        │
│  ├── setPosition/setRotation (→ root.position)  │
│  ├── addToScene/removeFromScene (→ scene.add)   │
│  ├── destroy (→ onDispose + removeFromParent)   │
│  ├── mesh getter (→ root)                       │
│  └── update (→ onUpdate)                        │
├─────────────────────────────────────────────────┤
│  场景层                                           │
│  ├── DemoScene (模板原生 GameScene)               │
│  ├── StableScene    马棚训练 (HL Scene)           │
│  ├── RaceScene      60秒限时竞速 (HL Scene)       │
│  ├── BattleRaceScene AI对战竞速 (HL Scene)       │
│  └── ParkourScene   AI跑酷 (HL Scene)            │
├─────────────────────────────────────────────────┤
│  系统层 / AI 层 / 数据层 / UI 层                  │
│  （详见下方说明）                                  │
├─────────────────────────────────────────────────┤
│  平台层                                           │
│  └── Bridge.ts (postMessage 跨平台通信)          │
└─────────────────────────────────────────────────┘
```

## 二、目录结构

```
src/
├── main.ts                     # 入口：创建引擎 + 兼容层 + 启动
├── engine/
│   ├── Engine.ts               # 模板引擎主类（渲染/场景/事件）
│   ├── LegacyAdapter.ts        # HL 兼容层（Engine/World/Input/Scene）
│   ├── SceneManager.ts         # 场景管理器（GameScene 接口）
│   └── AudioManager.ts         # 音频管理
├── world/
│   ├── World.ts                # 世界管理（THREE.Scene + Entity）
│   └── Entity.ts               # 实体基类 + HL 兼容方法
├── game/
│   ├── DemoScene.ts            # 模板演示场景
│   ├── GameDirector.ts         # 游戏总控（赛事/AI 管理）
│   ├── ChunkManager.ts         # AI跑酷赛道块流式管理
│   ├── SpawnSceneBuilder.ts    # 出生点场景构建
│   └── scenes/
│       ├── StableScene.ts      # 马棚场景
│       ├── RaceScene.ts        # 限时竞速
│       ├── BattleRaceScene.ts  # AI对战竞速
│       └── ParkourScene.ts     # AI跑酷
├── entities/
│   ├── Horse.ts                # 马匹实体（速度/动画/坐骑/战斗）
│   ├── Treadmill.ts            # 跑步机实体
│   ├── Track.ts                # 赛道实体
│   ├── Pet.ts                  # 宠物跟随实体
│   └── TrailEffect.ts          # 尾迹特效
├── ai/
│   ├── GeminiArchitect.ts      # LLM 赛道生成 + AI存在感
│   ├── GeminiRacer.ts          # AI 对战对手
│   ├── ThemeRegistry.ts        # 场景主题注册表
│   ├── AssetRegistry.ts        # ASCII 地图资产
│   ├── AIPersonality.ts        # AI 对手性格
│   ├── PlayerMemory.ts         # AI 记忆系统
│   ├── generators/TrackGenerator.ts
│   ├── prompts/race_prompt.ts
│   ├── llm/LLMBridge.ts
│   └── framework/AIPlayer.ts
├── systems/
│   ├── CardSystem.ts           # Roguelike 卡牌
│   ├── DecisionSystem.ts       # 博弈决策系统
│   ├── RewardSystem.ts         # 奖励系统
│   ├── RebirthSystem.ts        # 转生系统
│   └── PlayerBehaviorTracker.ts
├── data/
│   ├── PlayerProgress.ts       # 玩家进度持久化
│   ├── MountRegistry.ts        # 坐骑数据
│   ├── TalentRegistry.ts       # 天赋数据
│   ├── TrailRegistry.ts        # 尾迹数据
│   ├── PetRegistry.ts          # 宠物数据
│   ├── TrainerRegistry.ts      # 训练师数据
│   ├── types/GameTypes.ts      # 核心类型
│   └── configs/*.json          # 静态配置
├── ui/
│   ├── UIManager.ts            # 模板 UI 管理器
│   ├── HUD.ts                  # 主 HUD
│   ├── SettingsUI.ts           # AI 设置面板
│   ├── MountUI.ts              # 坐骑选择
│   ├── TalentUI.ts             # 天赋面板
│   ├── TrailUI.ts              # 尾迹选择
│   ├── PetUI.ts                # 宠物选择
│   ├── TrainerUI.ts            # 训练师选择
│   ├── RebirthUI.ts            # 转生面板
│   ├── CardPickerUI.ts         # 卡牌弹窗
│   ├── BattleUI.ts             # 对战 UI
│   ├── ThemePickerUI.ts        # 跑酷主题选择
│   ├── ParkourResultUI.ts      # 跑酷结算
│   ├── RaceResultUI.ts         # 竞速结算
│   └── MainMenuUI.ts           # 主菜单
├── utils/
│   └── GeometryUtils.ts        # 几何工具
└── platform/
    └── Bridge.ts               # 平台通信
```

## 三、场景流转

```
         ┌──────────────────────────────┐
         │        StableScene           │
         │   马棚（训练/选坐骑/入口）     │
         └──┬────────┬─────────┬────────┘
            │        │         │
      走向比赛门  走向跑酷门  走向坐骑门/按钮
            │        │         │
            ▼        ▼         ▼
      RaceScene  ParkourScene  MountUI
      60秒竞速   AI无限跑酷   坐骑选择面板
            │        │
        结算画面   死亡结算
            │        │
            ▼        ▼
         返回 StableScene
```

**BattleRaceScene** 从 main.ts 中独立注册，通过场景键名切换进入。

## 四、核心类说明

### Engine (`src/engine/Engine.ts`)

- 管理 Three.js `WebGLRenderer`、`PerspectiveCamera`
- 提供 `Scene` 接口（`onInit()`, `onUpdate(dt)`, `onDestroy()`）
- 游戏循环：`requestAnimationFrame` → `deltaTime` → `currentScene.onUpdate(dt)`

### Horse (`src/entities/Horse.ts`)

- 继承 `Entity` 基类
- 核心属性：`speedLevel`（速度等级）、`mountSpeedBonus`/`mountAccelBonus`/`mountCoinBonus`（坐骑加成）
- `calculateMaxSpeed()`: `(5 + speedLevel * 0.5) * (1 + mountSpeedBonus / 100)`
- `createMesh()`: 生成 Roblox 风格 3D 马匹模型（含骑手、鬃毛、马鞍、尾巴）
- `applyMountStats(mount)`: 应用坐骑属性加成

### PlayerProgress (`src/data/PlayerProgress.ts`)

- localStorage 持久化单例
- 字段：`speedLevel`, `totalTrophies`, `unlockedTreadmills`, `bestDistance`, `equippedMountId`, `unlockedMounts`
- 坐骑方法：`getEquippedMount()`, `unlockMount()`, `equipMount()`, `isMountUnlocked()`

### ChunkManager (`src/game/ChunkManager.ts`)

- AI跑酷核心：流式加载/卸载赛道块
- 接收 `AsciiMapChunk`（AI 生成的 ASCII 地图）→ 构建 3D 赛道
- 管理障碍物、收集物、选择门、侧面装饰
- 主题插值：平滑过渡天空/雾/赛道/草地颜色

### CardSystem (`src/systems/CardSystem.ts`)

- Roguelike 卡牌效果管理
- `GameContext`：存储所有活跃效果（速度倍率、赛道宽度、金币倍率、护盾、复活、反转操控、迷雾、磁铁等）
- 由 AI 生成卡牌内容，在选择门处触发选择

## 五、数据流

### AI 跑酷数据流

```
PlayerBehaviorTracker（收集遥测）
        ↓
GeminiArchitect.generateChunk()（LLM API 调用）
        ↓
AsciiMapChunk { theme, rows[], narration, analysis, confidence, comments }
        ↓
ChunkManager.buildChunkFromAsciiMap()（解析 ASCII → 3D 对象）
        ↓
ParkourScene.onUpdate()（碰撞检测 + 分数 + AI存在感展示）
```

### 坐骑数据流

```
MountRegistry（12匹静态数据）
        ↓
PlayerProgress（解锁/装备状态持久化）
        ↓
Horse.applyMountStats()（速度/加速/金币加成）
        ↓
RaceScene / ParkourScene（实际属性生效）
```

## 六、UI 体系

| 组件 | 类型 | 触发方式 | 说明 |
|------|------|---------|------|
| HUD | 常驻 | 场景自动更新 | 速度/奖杯/计时/里程碑 |
| SettingsUI | 模态 | 右上角⚙按钮 | AI 供应商/Key 设置 |
| MountUI | 模态 | 左下角按钮/走近坐骑门 | 坐骑浏览/解锁/装备 |
| CardPickerUI | 模态 | 走过选择门触发 | Roguelike 三选一卡牌 |
| BattleUI | 常驻 | 对战场景自动 | 对战 HUD |

所有 UI 均为 DOM 元素覆盖在 Three.js Canvas 之上，风格统一为 Roblox 卡通（圆角、粗边框、MeshToonMaterial 配色）。

## 七、第三方依赖

| 依赖 | 用途 |
|------|------|
| three | 3D 渲染引擎 |
| vite | 构建工具 + HMR 开发服务器 |
| typescript | 类型系统 |

无后端依赖，所有 LLM 调用直接从浏览器发起（Gemini / DeepSeek / 腾讯混元）。
