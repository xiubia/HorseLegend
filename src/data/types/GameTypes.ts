/**
 * 游戏核心类型定义
 * 适配自 Horse_Legend，去除 THREE 依赖（纯类型层不应依赖渲染库）
 */

// ── 基础类型 ──

export interface Vector3 {
    x: number
    y: number
    z: number
}

// ── 马匹属性 ──

export interface HorseStats {
    speed: number        // 1-100，最高速度 = 10 + speed * 0.4 m/s
    stamina: number      // 1-100，总体力 = 50 + stamina * 2
    acceleration: number // 1-100，加速度 = 1 + acceleration * 0.05 m/s²
    agility: number      // 1-100，转向速率 = 30 + agility * 1.5 度/秒
}

export type HorseRarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface HorseConfig {
    id: string
    name: string
    rarity: HorseRarity
    baseStats: HorseStats
    appearance: {
        bodyColor: string
        maneColor: string
    }
    specialAbility?: string
}

// ── 技能系统 ──

export type SkillCategory = 'movement' | 'defense' | 'control' | 'utility' | 'ultimate'

export type EffectType =
    | 'speed_boost'
    | 'speed_reduction'
    | 'stamina_damage'
    | 'stamina_heal'
    | 'immunity'
    | 'stealth'
    | 'reveal'
    | 'stun'
    | 'displacement'

export interface SkillEffect {
    type: EffectType
    target: 'self' | 'opponent' | 'area' | 'all_opponents'
    value: number
    duration?: number
    delay?: number
}

export interface Skill {
    id: string
    name: string
    category: SkillCategory
    description: string
    staminaCost: number
    cooldown: number
    effects: SkillEffect[]
    aiPriority: number
    unlockLevel: number
}

export interface SkillState {
    skillId: string
    cooldownRemaining: number
    isReady: boolean
}

// ── 行动系统 ──

export interface GameAction {
    id: string
    name: string
    description?: string
    staminaCost: number
    speedModifier?: number
    duration?: number
    recovery?: number
    isSkill?: boolean
    skillId?: string
}

/** @deprecated 使用 GameAction */
export type Action = GameAction

export interface ActionOutcome {
    playerId: string
    action: GameAction
    success: boolean
    effects: SkillEffect[]
    newState?: PlayerSnapshot
}

// ── 决策系统 ──

export type DecisionType = 'pre_race' | 'periodic' | 'skill' | 'reaction' | 'emergency'

export interface DecisionPoint {
    id: string
    type: DecisionType
    timeWindow: number
    defaultAction: string
}

export interface DecisionResult {
    playerId: string
    action: GameAction
    success: boolean
    timestamp: number
}

// ── 赛道系统 ──

export type SegmentType =
    | 'straight'
    | 'curve_left'
    | 'curve_right'
    | 'uphill'
    | 'downhill'
    | 'obstacle'
    | 'water'
    | 'jump'

export interface TrackSegment {
    type: SegmentType
    length: number
    width: number
    difficulty: 1 | 2 | 3
    elevation: number
    curvature: number
    modifiers: SegmentModifier[]
}

export interface SegmentModifier {
    type: 'slippery' | 'narrow' | 'foggy' | 'windy' | 'night'
    intensity: number
}

export interface Track {
    id: string
    name: string
    segments: TrackSegment[]
    totalLength: number
    estimatedTime: number
    difficultyScore: number
}

export interface Obstacle {
    id: string
    type: string
    position: Vector3
    width: number
    avoidable: boolean
    mesh?: any
}

export interface Collectible {
    id: string
    type: string
    position: Vector3
    width: number
    value: number
    collected: boolean
    mesh?: any
}

/**
 * ASCII 地图块 - AI 或本地生成器输出的地图数据
 */
export interface AsciiMapChunk {
    theme: string
    strategy: string
    rows: string[]
    narration?: string
    analysis?: string
    confidence?: number
    comments?: string[]
}

// ── 玩家状态 ──

export interface PlayerSnapshot {
    id: string
    name: string
    isHuman: boolean
    position: Vector3
    progress: number
    speed: number
    stamina: number
    maxStamina: number
    skills: SkillState[]
    activeBuffs: BuffInstance[]
    currentAction: string
}

export interface BuffInstance {
    id: string
    type: 'buff' | 'debuff'
    source: string
    speedModifier: number
    staminaModifier: number
    remainingTime: number
    stacks: number
}

// ── 游戏状态 ──

export type GamePhase = 'menu' | 'stable' | 'pre_race' | 'racing' | 'finished' | 'result'

export interface GameStateSnapshot {
    timestamp: number
    phase: GamePhase
    players: PlayerSnapshot[]
    track: Track | null
    elapsedTime: number
    remainingTime: number
    currentDecision: DecisionPoint | null
}

// ── AI 相关 ──

export type AIStrategy = 'aggressive' | 'defensive' | 'opportunist' | 'steady' | 'chaotic'

export interface OpponentPersonality {
    id: string
    name: string
    strategy: AIStrategy
    riskTolerance: number
    adaptability: number
    consistency: number
    preferredActions: string[]
    avoidedActions: string[]
    taunts: string[]
}

export interface AIDecision {
    action: string
    reasoning: string
    confidence: number
}

// ── 比赛结果 ──

export interface RaceResult {
    playerId: string
    position: number
    distance: number
    time: number
    rewards: {
        gold: number
        trophies: number
        experience: number
    }
}

// ── 配置类型 ──

export interface RaceConfig {
    trackId?: string
    difficulty: number
    opponentCount: number
    timeLimit: number
}

export interface GameConfig {
    geminiApiKey: string
    geminiModel: string
    debugMode: boolean
}

// ── 跑酷配置 ──

export interface ParkourConfig {
    mapDescription?: string
    selectedTags?: string[]
    difficulty?: 'casual' | 'adaptive' | 'extreme'
}

// ── AI 马厩场景配置 ──

export interface StableSceneConfig {
    skyColor: string
    fogColor: string
    fogNear: number
    fogFar: number

    groundColor: string
    grassColor: string

    ambientColor: string
    ambientIntensity: number
    sunColor: string
    sunIntensity: number
    sunVisualColor: string

    mountainColors: string[]
    mountainSnowCap: boolean
    mountainSnowColor: string

    treeStyle: 'pine' | 'cherry' | 'dark' | 'snow' | 'charred' | 'forest' | 'palm' | 'none'
    foliageColor: string
    trunkColor: string

    waterColor: string
    waterShineColor: string
    waterOpacity: number

    fenceColor: string
    fencePostColor: string

    decorations: string[]
    decorationColors: string[]

    particleType: 'snow' | 'petal' | 'ember' | 'firefly' | 'bubble' | 'crystal' | 'dust' | 'none'
    particleColor: string
}
