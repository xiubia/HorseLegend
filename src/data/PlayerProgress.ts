/**
 * 玩家进度存储系统
 * 使用 localStorage 持久化，适配模板引擎的 EventBus
 */

const STORAGE_KEY = 'game_player_progress'

// ── 跑步机配置 ──

export interface TreadmillUnlock {
    level: number
    unlockCost: number
    speedGain: number
}

export const TREADMILL_CONFIGS: TreadmillUnlock[] = [
    { level: 1, unlockCost: 0, speedGain: 1 },
    { level: 2, unlockCost: 50, speedGain: 2 },
    { level: 3, unlockCost: 200, speedGain: 3.5 },
    { level: 4, unlockCost: 500, speedGain: 5 },
    { level: 5, unlockCost: 1000, speedGain: 8 },
]

// ── 比赛记录 ──

export interface RaceRecord {
    mode: 'race' | 'parkour' | 'battle'
    distance: number
    trophies: number
    duration: number
    isNewRecord: boolean
    timestamp: number
    collectibleScore?: number
    winner?: string
}

const MAX_RACE_HISTORY = 20

// ── 进度数据 ──

export interface PlayerProgressData {
    speedLevel: number
    totalTrophies: number
    unlockedTreadmills: number[]
    bestDistance: number
    totalRaces: number
    totalDistance: number
    equippedMountId: string
    unlockedMounts: string[]
    equippedTrailId: string
    unlockedTrails: string[]
    talentLevels: Record<string, number>
    rebirthCount: number
    autoRebirthUnlocked: boolean
    unlockedTrainers: string[]
    equippedTrainerId: string
    ownedPets: string[]
    equippedPets: string[]
    raceHistory: RaceRecord[]
}

const DEFAULT_PROGRESS: PlayerProgressData = {
    speedLevel: 0,
    totalTrophies: 0,
    unlockedTreadmills: [1],
    bestDistance: 0,
    totalRaces: 0,
    totalDistance: 0,
    equippedMountId: 'horse_default',
    unlockedMounts: ['horse_default'],
    equippedTrailId: 'trail_none',
    unlockedTrails: ['trail_none'],
    talentLevels: {},
    rebirthCount: 0,
    autoRebirthUnlocked: false,
    unlockedTrainers: [],
    equippedTrainerId: '',
    ownedPets: [],
    equippedPets: [],
    raceHistory: [],
}

// ── 进度管理器 ──

export class PlayerProgress {
    private data: PlayerProgressData
    private listeners: Set<(data: PlayerProgressData) => void> = new Set()

    constructor() {
        this.data = this.load()
    }

    private load(): PlayerProgressData {
        try {
            const saved = localStorage.getItem(STORAGE_KEY)
            if (saved) return { ...DEFAULT_PROGRESS, ...JSON.parse(saved) }
        } catch { /* ignore */ }
        return { ...DEFAULT_PROGRESS }
    }

    private save(): void {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)) } catch { /* ignore */ }
        this.notifyListeners()
    }

    private notifyListeners(): void {
        for (const fn of this.listeners) fn(this.getSnapshot())
    }

    getSnapshot(): PlayerProgressData { return { ...this.data } }

    // ── 速度/奖杯 ──

    get speedLevel(): number { return this.data.speedLevel }
    get totalTrophies(): number { return this.data.totalTrophies }
    get bestDistance(): number { return this.data.bestDistance }
    get totalRaces(): number { return this.data.totalRaces }

    addSpeedLevel(amount: number): void { this.data.speedLevel += amount; this.save() }
    setSpeedLevel(level: number): void { this.data.speedLevel = level; this.save() }
    addTrophies(amount: number): void { this.data.totalTrophies += amount; this.save() }

    spendTrophies(amount: number): boolean {
        if (this.data.totalTrophies < amount) return false
        this.data.totalTrophies -= amount
        this.save()
        return true
    }

    // ── 跑步机 ──

    isTreadmillUnlocked(level: number): boolean {
        return this.data.unlockedTreadmills.includes(level)
    }

    unlockTreadmill(level: number): boolean {
        if (this.isTreadmillUnlocked(level)) return true
        const config = TREADMILL_CONFIGS.find(t => t.level === level)
        if (!config || this.data.totalTrophies < config.unlockCost) return false
        this.data.totalTrophies -= config.unlockCost
        this.data.unlockedTreadmills.push(level)
        this.data.unlockedTreadmills.sort((a, b) => a - b)
        this.save()
        return true
    }

    getUnlockedTreadmills(): number[] { return [...this.data.unlockedTreadmills] }

    // ── 比赛记录 ──

    recordRaceResult(distance: number, trophies: number, record?: Partial<RaceRecord>): void {
        this.data.totalRaces++
        this.data.totalDistance += distance
        this.data.totalTrophies += trophies

        const isNewRecord = distance > this.data.bestDistance
        if (isNewRecord) this.data.bestDistance = distance

        if (!this.data.raceHistory) this.data.raceHistory = []
        this.data.raceHistory.push({
            mode: record?.mode || 'race',
            distance,
            trophies,
            duration: record?.duration || 0,
            isNewRecord,
            timestamp: record?.timestamp || Date.now(),
            ...(record?.collectibleScore !== undefined ? { collectibleScore: record.collectibleScore } : {}),
            ...(record?.winner !== undefined ? { winner: record.winner } : {}),
        })
        if (this.data.raceHistory.length > MAX_RACE_HISTORY) {
            this.data.raceHistory = this.data.raceHistory.slice(-MAX_RACE_HISTORY)
        }
        this.save()
    }

    getRaceHistory(): RaceRecord[] { return [...(this.data.raceHistory || [])] }

    // ── 监听器 ──

    addListener(callback: (data: PlayerProgressData) => void): () => void {
        this.listeners.add(callback)
        return () => this.listeners.delete(callback)
    }

    // ── 坐骑 ──

    getEquippedMount(): string { return this.data.equippedMountId || 'horse_default' }
    isMountUnlocked(mountId: string): boolean { return (this.data.unlockedMounts || []).includes(mountId) }

    unlockMount(mountId: string, cost: number): boolean {
        if (this.isMountUnlocked(mountId)) return true
        if (this.data.totalTrophies < cost) return false
        this.data.totalTrophies -= cost
        if (!this.data.unlockedMounts) this.data.unlockedMounts = ['horse_default']
        this.data.unlockedMounts.push(mountId)
        this.save()
        return true
    }

    equipMount(mountId: string): boolean {
        if (!this.isMountUnlocked(mountId)) return false
        this.data.equippedMountId = mountId
        this.save()
        return true
    }

    getUnlockedMounts(): string[] { return [...(this.data.unlockedMounts || ['horse_default'])] }

    // ── 尾迹 ──

    getEquippedTrail(): string { return this.data.equippedTrailId || 'trail_none' }
    isTrailUnlocked(trailId: string): boolean { return (this.data.unlockedTrails || []).includes(trailId) }

    unlockTrail(trailId: string, cost: number): boolean {
        if (this.isTrailUnlocked(trailId)) return true
        if (this.data.totalTrophies < cost) return false
        this.data.totalTrophies -= cost
        if (!this.data.unlockedTrails) this.data.unlockedTrails = ['trail_none']
        this.data.unlockedTrails.push(trailId)
        this.save()
        return true
    }

    equipTrail(trailId: string): boolean {
        if (!this.isTrailUnlocked(trailId)) return false
        this.data.equippedTrailId = trailId
        this.save()
        return true
    }

    getUnlockedTrails(): string[] { return [...(this.data.unlockedTrails || ['trail_none'])] }

    // ── 天赋 ──

    getTalentLevel(talentId: string): number { return (this.data.talentLevels || {})[talentId] || 0 }

    upgradeTalent(talentId: string, cost: number): boolean {
        if (this.data.totalTrophies < cost) return false
        if (!this.data.talentLevels) this.data.talentLevels = {}
        this.data.totalTrophies -= cost
        this.data.talentLevels[talentId] = (this.data.talentLevels[talentId] || 0) + 1
        this.save()
        return true
    }

    // ── 重生 ──

    get rebirthCount(): number { return this.data.rebirthCount || 0 }

    performRebirth(count: number, costPerRebirth: number): number {
        const maxAffordable = Math.floor(this.data.speedLevel / costPerRebirth)
        const actual = Math.min(count, maxAffordable)
        if (actual <= 0) return 0
        this.data.speedLevel -= actual * costPerRebirth
        this.data.rebirthCount = (this.data.rebirthCount || 0) + actual
        this.save()
        return actual
    }

    get isAutoRebirthUnlocked(): boolean { return this.data.autoRebirthUnlocked || false }

    unlockAutoRebirth(cost: number): boolean {
        if (this.data.autoRebirthUnlocked) return true
        if (this.data.totalTrophies < cost) return false
        this.data.totalTrophies -= cost
        this.data.autoRebirthUnlocked = true
        this.save()
        return true
    }

    // ── 训练师 ──

    isTrainerUnlocked(trainerId: string): boolean { return (this.data.unlockedTrainers || []).includes(trainerId) }

    unlockTrainer(trainerId: string, cost: number): boolean {
        if (this.isTrainerUnlocked(trainerId)) return true
        if (this.data.totalTrophies < cost) return false
        this.data.totalTrophies -= cost
        if (!this.data.unlockedTrainers) this.data.unlockedTrainers = []
        this.data.unlockedTrainers.push(trainerId)
        this.save()
        return true
    }

    getUnlockedTrainers(): string[] { return [...(this.data.unlockedTrainers || [])] }
    getEquippedTrainer(): string { return this.data.equippedTrainerId || '' }

    equipTrainer(trainerId: string): boolean {
        if (!this.isTrainerUnlocked(trainerId)) return false
        this.data.equippedTrainerId = trainerId
        this.save()
        return true
    }

    unequipTrainer(): void { this.data.equippedTrainerId = ''; this.save() }

    // ── 宠物 ──

    getOwnedPets(): string[] { return [...(this.data.ownedPets || [])] }
    getEquippedPets(): string[] { return [...(this.data.equippedPets || [])] }

    addPet(petId: string): boolean {
        if (!this.data.ownedPets) this.data.ownedPets = []
        if (this.data.ownedPets.length >= 50) return false
        this.data.ownedPets.push(petId)
        this.save()
        return true
    }

    removePet(petId: string): boolean {
        if (!this.data.ownedPets) return false
        const index = this.data.ownedPets.indexOf(petId)
        if (index === -1) return false
        if (!this.data.equippedPets) this.data.equippedPets = []
        const eqIndex = this.data.equippedPets.indexOf(petId)
        if (eqIndex !== -1) this.data.equippedPets.splice(eqIndex, 1)
        this.data.ownedPets.splice(index, 1)
        this.save()
        return true
    }

    equipPet(petId: string): boolean {
        if (!this.data.ownedPets) this.data.ownedPets = []
        if (!this.data.equippedPets) this.data.equippedPets = []
        if (!this.data.ownedPets.includes(petId)) return false
        if (this.data.equippedPets.length >= 3) return false
        if (this.data.equippedPets.includes(petId)) return true
        this.data.equippedPets.push(petId)
        this.save()
        return true
    }

    unequipPet(petId: string): boolean {
        if (!this.data.equippedPets) return false
        const index = this.data.equippedPets.indexOf(petId)
        if (index === -1) return false
        this.data.equippedPets.splice(index, 1)
        this.save()
        return true
    }

    isPetEquipped(petId: string): boolean { return (this.data.equippedPets || []).includes(petId) }
    getOwnedPetCount(): number { return (this.data.ownedPets || []).length }

    // ── 重置/统计 ──

    reset(): void { this.data = { ...DEFAULT_PROGRESS }; this.save() }

    calculateCurrentSpeed(): number { return 5 + this.data.speedLevel * 0.5 }

    getStats() {
        return {
            totalRaces: this.data.totalRaces,
            totalDistance: this.data.totalDistance,
            bestDistance: this.data.bestDistance,
            averageDistance: this.data.totalRaces > 0 ? Math.round(this.data.totalDistance / this.data.totalRaces) : 0,
        }
    }
}

// ── 单例 ──

let instance: PlayerProgress | null = null

export function getPlayerProgress(): PlayerProgress {
    if (!instance) instance = new PlayerProgress()
    return instance
}
