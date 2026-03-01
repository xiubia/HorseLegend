/**
 * 坐骑注册表 — 12匹坐骑的静态数据与查询 API
 */

export type MountRarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface MountStats {
    acceleration: number
    speedBonus: number
    coinBonus: number
}

export interface MountAppearance {
    scale: number
    horn?: 'unicorn' | 'demon' | 'none'
    wings?: 'pegasus' | 'demon' | 'none'
    armor?: 'iron' | 'gold' | 'crystal' | 'magma' | 'shadow' | 'none'
    particle?: 'fire' | 'ice' | 'shadow' | 'holy' | 'none'
}

export interface MountDef {
    id: string
    name: string
    rarity: MountRarity
    bodyColor: string
    maneColor: string
    unlockCost: number
    stats: MountStats
    appearance: MountAppearance
}

const MOUNTS: MountDef[] = [
    { id: 'horse_default', name: '小栗', rarity: 'common', bodyColor: '#8B4513', maneColor: '#4A2500', unlockCost: 0, stats: { acceleration: 30, speedBonus: 0, coinBonus: 0 }, appearance: { scale: 1.0, armor: 'none', horn: 'none', wings: 'none' } },
    { id: 'horse_white', name: '白雪', rarity: 'common', bodyColor: '#F5F5F5', maneColor: '#DDDDDD', unlockCost: 100, stats: { acceleration: 35, speedBonus: 5, coinBonus: 5 }, appearance: { scale: 1.0, armor: 'none', horn: 'none', wings: 'none' } },
    { id: 'horse_gray', name: '灰影', rarity: 'common', bodyColor: '#808080', maneColor: '#555555', unlockCost: 200, stats: { acceleration: 40, speedBonus: 5, coinBonus: 10 }, appearance: { scale: 1.0, armor: 'none', horn: 'none', wings: 'none' } },
    { id: 'horse_brown', name: '枣红', rarity: 'common', bodyColor: '#A0522D', maneColor: '#6B2500', unlockCost: 300, stats: { acceleration: 45, speedBonus: 10, coinBonus: 5 }, appearance: { scale: 1.0, armor: 'iron', horn: 'none', wings: 'none' } },
    { id: 'horse_golden', name: '金鬃', rarity: 'rare', bodyColor: '#DAA520', maneColor: '#FFD700', unlockCost: 800, stats: { acceleration: 50, speedBonus: 15, coinBonus: 15 }, appearance: { scale: 1.1, armor: 'gold', horn: 'none', wings: 'none' } },
    { id: 'horse_midnight', name: '夜行者', rarity: 'rare', bodyColor: '#1C1C2E', maneColor: '#4B0082', unlockCost: 1200, stats: { acceleration: 55, speedBonus: 20, coinBonus: 10 }, appearance: { scale: 1.1, armor: 'shadow', horn: 'none', wings: 'none' } },
    { id: 'horse_cherry', name: '樱花', rarity: 'rare', bodyColor: '#FFB7C5', maneColor: '#FF69B4', unlockCost: 1500, stats: { acceleration: 45, speedBonus: 15, coinBonus: 25 }, appearance: { scale: 1.1, armor: 'crystal', horn: 'none', wings: 'none' } },
    { id: 'horse_frost', name: '冰霜', rarity: 'epic', bodyColor: '#B0E0E6', maneColor: '#00CED1', unlockCost: 3000, stats: { acceleration: 60, speedBonus: 25, coinBonus: 20 }, appearance: { scale: 1.25, armor: 'crystal', horn: 'unicorn', wings: 'none', particle: 'ice' } },
    { id: 'horse_flame', name: '烈焰', rarity: 'epic', bodyColor: '#FF4500', maneColor: '#FF6347', unlockCost: 5000, stats: { acceleration: 70, speedBonus: 30, coinBonus: 15 }, appearance: { scale: 1.25, armor: 'magma', horn: 'demon', wings: 'none', particle: 'fire' } },
    { id: 'horse_storm', name: '雷鸣', rarity: 'epic', bodyColor: '#4169E1', maneColor: '#1E90FF', unlockCost: 8000, stats: { acceleration: 55, speedBonus: 25, coinBonus: 30 }, appearance: { scale: 1.3, armor: 'gold', horn: 'unicorn', wings: 'pegasus' } },
    { id: 'horse_shadow', name: '暗影', rarity: 'legendary', bodyColor: '#0D0D0D', maneColor: '#8B0000', unlockCost: 15000, stats: { acceleration: 75, speedBonus: 35, coinBonus: 25 }, appearance: { scale: 1.4, armor: 'shadow', horn: 'demon', wings: 'demon', particle: 'shadow' } },
    { id: 'horse_divine', name: '神驹', rarity: 'legendary', bodyColor: '#FFFFF0', maneColor: '#FFD700', unlockCost: 30000, stats: { acceleration: 80, speedBonus: 40, coinBonus: 35 }, appearance: { scale: 1.5, armor: 'gold', horn: 'unicorn', wings: 'pegasus', particle: 'holy' } },
]

const MOUNT_MAP = new Map<string, MountDef>()
for (const m of MOUNTS) MOUNT_MAP.set(m.id, m)

export function getAllMounts(): MountDef[] { return MOUNTS }
export function getMountById(id: string): MountDef { return MOUNT_MAP.get(id) || MOUNTS[0] }

export function getRarityColor(rarity: MountRarity): string {
    switch (rarity) {
        case 'common': return '#AAAAAA'
        case 'rare': return '#4488FF'
        case 'epic': return '#AA44FF'
        case 'legendary': return '#FFD700'
    }
}

export function getRarityLabel(rarity: MountRarity): string {
    switch (rarity) {
        case 'common': return '普通'
        case 'rare': return '稀有'
        case 'epic': return '史诗'
        case 'legendary': return '传说'
    }
}
