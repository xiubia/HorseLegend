/**
 * 天赋注册表 — 7种天赋的静态数据与查询 API
 */

export interface TalentDef {
    id: string
    name: string
    icon: string
    maxLevel: number
    perLevelValue: number
    unit: string
    costs: number[]
    description: string
}

function generateCosts(levels: number, baseCost: number, increment: number): number[] {
    const costs: number[] = []
    for (let i = 0; i < levels; i++) costs.push(baseCost + i * increment)
    return costs
}

const TALENTS: TalentDef[] = [
    { id: 'revive', name: '重生档位', icon: '🔄', maxLevel: 5, perLevelValue: 1, unit: '次', costs: [50, 80, 150, 300, 500], description: 'AI跑酷初始复活次数' },
    { id: 'doubleTrain', name: '双倍训练', icon: '✖️2', maxLevel: 10, perLevelValue: 4, unit: '%', costs: [20, 30, 50, 80, 120, 180, 260, 360, 500, 700], description: '训练时双倍速度等级概率' },
    { id: 'trophyBonus', name: '奖杯获取', icon: '🏆', maxLevel: 15, perLevelValue: 2, unit: '%', costs: generateCosts(15, 20, 15), description: '所有奖杯奖励加成' },
    { id: 'speedBonus', name: '移速加成', icon: '⚡', maxLevel: 15, perLevelValue: 2, unit: '%', costs: generateCosts(15, 20, 20), description: '永久最大速度加成' },
    { id: 'trainEfficiency', name: '训练加成', icon: '🔧', maxLevel: 10, perLevelValue: 3, unit: '%', costs: generateCosts(10, 20, 15), description: '跑步机训练速度加成' },
    { id: 'startSpeed', name: '起步速度', icon: '🚀', maxLevel: 10, perLevelValue: 5, unit: '%', costs: generateCosts(10, 20, 20), description: 'AI跑酷初始速度加成' },
    { id: 'coinBonus', name: '金币获取', icon: '💰', maxLevel: 15, perLevelValue: 2, unit: '%', costs: generateCosts(15, 20, 12), description: '收集物价值加成' },
]

const TALENT_MAP = new Map<string, TalentDef>()
for (const t of TALENTS) TALENT_MAP.set(t.id, t)

export function getAllTalents(): TalentDef[] { return TALENTS }
export function getTalentById(id: string): TalentDef | undefined { return TALENT_MAP.get(id) }

export function getTalentCost(id: string, currentLevel: number): number {
    const talent = TALENT_MAP.get(id)
    if (!talent || currentLevel >= talent.maxLevel) return -1
    return talent.costs[currentLevel]
}

export function getTalentValue(id: string, level: number): number {
    const talent = TALENT_MAP.get(id)
    if (!talent) return 0
    return talent.perLevelValue * Math.min(level, talent.maxLevel)
}
