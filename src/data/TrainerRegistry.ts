/**
 * 训练师注册表 — 12名训练师的静态数据与查询 API
 * 收集型系统：购买后永久生效，所有已拥有训练师的加成叠加
 */

export interface TrainerDef {
    id: string
    name: string
    bodyColor: string
    accentColor: string
    unlockCost: number
    coinBonus: number
    trainingBonus: number
}

export interface TrainerBonuses {
    totalCoinBonus: number
    totalTrainingBonus: number
}

const TRAINERS: TrainerDef[] = [
    { id: 'trainer_xiaomage', name: '小马哥', bodyColor: '#8B6914', accentColor: '#4CAF50', unlockCost: 50, coinBonus: 3, trainingBonus: 2 },
    { id: 'trainer_jifeng', name: '疾风', bodyColor: '#E0E0E0', accentColor: '#42A5F5', unlockCost: 200, coinBonus: 5, trainingBonus: 3 },
    { id: 'trainer_tieqi', name: '铁骑', bodyColor: '#78909C', accentColor: '#EF5350', unlockCost: 500, coinBonus: 8, trainingBonus: 5 },
    { id: 'trainer_anye', name: '暗夜', bodyColor: '#212121', accentColor: '#AB47BC', unlockCost: 1000, coinBonus: 10, trainingBonus: 6 },
    { id: 'trainer_yinan', name: '银鞍', bodyColor: '#BDBDBD', accentColor: '#F5F5F5', unlockCost: 2500, coinBonus: 12, trainingBonus: 7 },
    { id: 'trainer_leichi', name: '雷驰', bodyColor: '#FDD835', accentColor: '#FF9800', unlockCost: 5000, coinBonus: 15, trainingBonus: 8 },
    { id: 'trainer_bingfeng', name: '冰锋', bodyColor: '#81D4FA', accentColor: '#E0E0E0', unlockCost: 10000, coinBonus: 18, trainingBonus: 9 },
    { id: 'trainer_lieyang', name: '烈阳', bodyColor: '#E53935', accentColor: '#FFD700', unlockCost: 20000, coinBonus: 20, trainingBonus: 10 },
    { id: 'trainer_xingchen', name: '星辰', bodyColor: '#1A237E', accentColor: '#FFD700', unlockCost: 40000, coinBonus: 25, trainingBonus: 12 },
    { id: 'trainer_fengming', name: '凤鸣', bodyColor: '#D32F2F', accentColor: '#FF6D00', unlockCost: 80000, coinBonus: 30, trainingBonus: 15 },
    { id: 'trainer_longxiang', name: '龙骧', bodyColor: '#2E7D32', accentColor: '#FFD700', unlockCost: 150000, coinBonus: 40, trainingBonus: 18 },
    { id: 'trainer_tianhen', name: '天痕', bodyColor: '#8B0000', accentColor: '#FFD700', unlockCost: 300000, coinBonus: 50, trainingBonus: 20 },
]

const TRAINER_MAP = new Map<string, TrainerDef>()
for (const t of TRAINERS) TRAINER_MAP.set(t.id, t)

export function getAllTrainers(): TrainerDef[] { return TRAINERS }
export function getTrainerById(id: string): TrainerDef { return TRAINER_MAP.get(id) || TRAINERS[0] }

export function getTotalTrainerBonuses(unlockedIds: string[]): TrainerBonuses {
    let totalCoinBonus = 0
    let totalTrainingBonus = 0
    for (const id of unlockedIds) {
        const trainer = TRAINER_MAP.get(id)
        if (trainer) {
            totalCoinBonus += trainer.coinBonus
            totalTrainingBonus += trainer.trainingBonus
        }
    }
    return { totalCoinBonus, totalTrainingBonus }
}

export function formatTrainerCost(cost: number): string {
    if (cost >= 10000) return `${(cost / 10000).toFixed(cost % 10000 === 0 ? 0 : 1)}万`
    if (cost >= 1000) return `${(cost / 1000).toFixed(cost % 1000 === 0 ? 0 : 1)}k`
    return `${cost}`
}
