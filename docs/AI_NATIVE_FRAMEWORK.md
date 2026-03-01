# AI 原生玩法框架

## 一、设计理念

本项目的核心是**生成式 AI 原生玩法**——AI 不是辅助工具，而是游戏内容的实时生产者和互动伙伴。玩家无需输入文字，AI 通过观察玩家行为自主生成赛道、障碍、主题氛围、卡牌选择和实时评论。

**关键原则：**
- **异步不打断**：AI 在后台生成内容，不阻塞玩家操作
- **无文本输入**：玩家通过跑位、选卡等游戏行为与 AI 交互
- **渐进式参与**：从固定入门段到 AI 全面接管，难度随玩家水平动态调整
- **多维度存在感**：AI 不仅生成关卡，还提供旁白、弹幕评论、死亡评价

## 二、AI 系统总览

```
┌─────────────────────────────────────────────┐
│           GeminiArchitect（AI 建筑师）         │
│  统一 LLM 接口 → 赛道 + 主题 + AI 存在感数据   │
├─────────────────────────────────────────────┤
│  输入：PlayerBehaviorTracker（玩家遥测）       │
│  输出：AsciiMapChunk + AI 评论/旁白/分析       │
├─────────────────────────────────────────────┤
│           支持三种 LLM 供应商                  │
│  Gemini 2.5 Flash（默认）│ DeepSeek │ 腾讯混元 │
└─────────────────────────────────────────────┘
```

## 三、ASCII 地图生成系统

### 3.1 生成流程

```
ParkourScene.onUpdate()
  → 检测剩余赛道块 < 阈值
  → GeminiArchitect.generateChunk(telemetry)
  → LLM 返回 ASCII 地图 + 元数据
  → ChunkManager.buildChunkFromAsciiMap()
  → 3D 赛道实时呈现
```

### 3.2 ASCII 地图格式

每个 Chunk 是 20 行 × 8 列的字符网格：

```
# = 赛道边界
. = 空地
B = 固定障碍（岩石/木桶/路障）
A = 可移动障碍（滚石/矿车）
C = 金币
S = 星星（高价值收集物）
W = 水坑（减速陷阱）
T = 树木（仅装饰，不碰撞）
F = 花丛（仅装饰）
R = 灌木（仅装饰）
L = 路灯（仅装饰）
G = 选择门（触发 Roguelike 卡牌选择）
```

### 3.3 资产注册表 (`AssetRegistry.ts`)

每个字符码对应一个 3D 资产定义：
- `width` / `height`：碰撞体尺寸
- `isObstacle`：是否为障碍物
- `isCollectible`：是否为收集物
- `isDecoration`：是否仅为装饰
- `createMesh()`：生成 Three.js 3D 模型的工厂函数

**碰撞规则**：只有 `isObstacle: true` 的资产才会触发碰撞检测，装饰物（树/花/灌木/路灯）不会阻碍玩家。

### 3.4 难度控制

| 阶段 | chunk 编号 | 行为 |
|------|-----------|------|
| 入门段 | 0-2 | 固定预设赛道（无 AI 参与），极少障碍 |
| 过渡段 | 3-5 | AI 生成，限制最大障碍数 ≤ 3，行间距 ≥ 4 |
| 正常段 | 6+ | AI 完全控制，根据玩家遥测动态调难 |

**速度与障碍密度**：速度越高，`minRowGap` 越大（确保玩家有反应时间）。

### 3.5 Prompt 工程

GeminiArchitect 构建的 Prompt 包含：
1. **角色设定**：你是赛道设计师
2. **地图格式说明**：字符含义、尺寸约束
3. **玩家遥测**：偏好车道、反应时间、碰撞历史、当前速度
4. **难度指令**：基于 chunk 编号的障碍密度限制
5. **输出格式**：JSON 含 `theme`, `strategy`, `rows[]`, `narration`, `analysis`, `confidence`, `comments`

## 四、场景主题系统

### 4.1 ThemeRegistry (`ThemeRegistry.ts`)

定义多种场景氛围主题，每个主题包含：

```typescript
interface ThemeDef {
  id: string;
  skyColor: number;          // 天空颜色
  fogColor: number;          // 雾颜色
  fogNear / fogFar: number;  // 雾距离
  ambientIntensity: number;  // 环境光强度
  sunIntensity: number;      // 日光强度
  sunColor: number;          // 日光颜色
  trackColor: number;        // 赛道颜色
  trackLineColor: number;    // 赛道线颜色
  grassColor: number;        // 草地颜色
  sideDecorations: SideDecoDef[];  // 侧面装饰物列表
  particles?: ParticleDef;   // 粒子效果（雪花/萤火虫等）
}
```

### 4.2 主题切换

- **AI 跑酷**：AI 在生成的 chunk 中指定 `theme` 字段，ChunkManager 通过 `lerp` 平滑插值天空/雾/赛道/草地材质颜色
- **普通竞速**：每 600-1000m 随机切换主题，立即更新背景色和雾效

### 4.3 内置主题示例

| 主题 | 特色 |
|------|------|
| 草原 (grassland) | 绿色草地、蓝天白雾 |
| 沙漠 (desert) | 黄沙、橙色天空 |
| 雪地 (snow) | 白色地面、雪花粒子 |
| 森林 (forest) | 深绿、浓雾、大量树木 |
| 火山 (volcano) | 红色天空、熔岩色赛道 |
| 夜晚 (night) | 深蓝天空、萤火虫粒子 |
| 樱花 (sakura) | 粉色天空、花瓣粒子 |

## 五、Roguelike 卡牌系统

### 5.1 触发机制

- 赛道中每隔一定距离放置**选择门**（ASCII 码 `G`）
- 玩家走到选择门时**完全停下**，弹出三张卡牌
- 选择后继续奔跑

### 5.2 卡牌设计

由 AI 生成卡牌内容，或使用本地预设库。每张卡有：
- **名称**：简短直观（如"加速器"、"迷雾"、"磁铁"）
- **效果描述**：一句话说明
- **正面/负面标签**：玩家凭直觉判断

### 5.3 GameContext 效果

```typescript
interface GameContext {
  speedMultiplier: number;   // 速度倍率
  trackWidth: number;        // 赛道宽度
  coinMultiplier: number;    // 金币价值倍率
  shieldCount: number;       // 护盾次数
  reviveCount: number;       // 复活次数
  invertControls: boolean;   // 反转操控
  fogLevel: number;          // 迷雾等级
  magnetActive: boolean;     // 金币磁铁
}
```

### 5.4 卡牌平衡

- 所有临时效果都有**时间限制**（非永久）
- 负面卡牌搭配**正面奖励**（如迷雾 + 金币翻倍）
- 护盾可吸收一次碰撞（碰撞后护盾消耗，障碍隐藏）

## 六、AI 存在感系统

### 6.1 设计目标

让玩家在游戏全程感受到"有个 AI 在观察和回应我"。

### 6.2 四维存在感

| 维度 | 实现 | 说明 |
|------|------|------|
| **实时弹幕** | 右侧浮动评论 | 由 AI 生成或本地触发（擦肩而过/连击/速度里程碑/偏向） |
| **场景旁白** | 中央淡入淡出 | 主题切换时展示 AI 对当前场景的一句话描述 |
| **读心雷达** | 右上角 HUD | 显示 AI 分析（短评）+ AI 信心度进度条 |
| **死亡评价** | 结算画面 | AI 根据全局遥测生成个性化死亡评语（异步 API 调用） |

### 6.3 数据来源

GeminiArchitect 的每次 `generateChunk()` 调用同时返回：
- `narration`：场景旁白
- `analysis`：玩家行为短评
- `confidence`：AI 预测信心度 (0-100)
- `comments`：弹幕评论列表

当 AI API 不可用时，自动降级为本地预设文本库。

### 6.4 弹幕触发条件与冷却

| 触发器 | 条件 | 冷却 |
|--------|------|------|
| 偏向检测 | 连续倾斜同侧 > 3秒 | 15秒 |
| 速度里程碑 | 每提速 2 级 | 20秒 |
| 金币连击 | 连续拾取 ≥ 5 个 | 10秒 |
| 碰撞后 | 碰撞 1.5秒后 | 8秒 |
| 擦肩而过 | 差 0.5 内宽度闪过障碍 | 5秒 |
| 风格变化 | 主题切换时 | 无 |

## 七、AI 对战系统

### 7.1 GeminiRacer (`GeminiRacer.ts`)

用于 BattleRaceScene 的 AI 对手：
- 接收 `AIPersonality`（性格参数）和 `PlayerMemory`（历史记忆）
- 通过 LLM 生成对手决策（加速/减速/使用技能）
- 支持多种性格：激进型、稳健型、策略型

### 7.2 AI 供应商配置

通过 `SettingsUI` 配置，持久化到 localStorage：

| 供应商 | 默认模型 | 认证方式 |
|--------|---------|---------|
| Google Gemini | gemini-2.5-flash | URL query key |
| DeepSeek | deepseek-chat | Bearer token |
| 腾讯混元 | hunyuan-turbos-latest | Bearer token |

右上角 AI 状态指示：连接成功显示绿色，失败提示"本地算法"。

## 八、玩家行为追踪

### PlayerBehaviorTracker (`PlayerBehaviorTracker.ts`)

实时收集玩家遥测数据供 AI 参考：

| 指标 | 说明 |
|------|------|
| 车道偏好 | 左/中/右各占比 |
| 反应时间 | 看到障碍到变道的平均时间 |
| 碰撞历史 | 最近 N 次碰撞的位置和障碍类型 |
| 当前速度 | 实时速度值 |
| 存活时间 | 本局已存活时长 |
| 金币拾取率 | 拾取金币数/经过金币总数 |

这些数据打包为 `PlayerTelemetry` 对象，每次 AI 生成请求时附带。
