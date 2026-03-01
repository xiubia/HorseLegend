/**
 * 尾迹注册表 — 9条尾迹的静态数据与查询 API
 */

export type TrailRarity = 'common' | 'rare' | 'epic' | 'legendary'
export type TrailParticleStyle = 'none' | 'ribbon' | 'spark' | 'flame' | 'frost' | 'lightning'

export interface TrailStats {
    accelerationBonus: number
    coinBonus: number
    startSpeedBonus: number
}

export interface TrailDef {
    id: string
    name: string
    rarity: TrailRarity
    primaryColor: string
    secondaryColor: string
    particleStyle: TrailParticleStyle
    unlockCost: number
    stats: TrailStats
}

const TRAILS: TrailDef[] = [
    { id: 'trail_none', name: '无尾迹', rarity: 'common', primaryColor: '#888888', secondaryColor: '#666666', particleStyle: 'none', unlockCost: 0, stats: { accelerationBonus: 0, coinBonus: 0, startSpeedBonus: 0 } },
    { id: 'trail_dust', name: '黄沙', rarity: 'common', primaryColor: '#DAA520', secondaryColor: '#F5DEB3', particleStyle: 'ribbon', unlockCost: 86, stats: { accelerationBonus: 10, coinBonus: 5, startSpeedBonus: 2 } },
    { id: 'trail_purple', name: '暮光', rarity: 'common', primaryColor: '#9B59B6', secondaryColor: '#E8D5F5', particleStyle: 'spark', unlockCost: 486, stats: { accelerationBonus: 15, coinBonus: 10, startSpeedBonus: 3 } },
    { id: 'trail_aurora', name: '极光', rarity: 'rare', primaryColor: '#E056A0', secondaryColor: '#B060E0', particleStyle: 'ribbon', unlockCost: 888, stats: { accelerationBonus: 30, coinBonus: 20, startSpeedBonus: 5 } },
    { id: 'trail_golden', name: '金焰', rarity: 'rare', primaryColor: '#FFD700', secondaryColor: '#FFA500', particleStyle: 'flame', unlockCost: 2500, stats: { accelerationBonus: 40, coinBonus: 25, startSpeedBonus: 6 } },
    { id: 'trail_frost', name: '冰霜', rarity: 'epic', primaryColor: '#00CED1', secondaryColor: '#B0E0FF', particleStyle: 'frost', unlockCost: 5000, stats: { accelerationBonus: 80, coinBonus: 50, startSpeedBonus: 8 } },
    { id: 'trail_lightning', name: '雷电', rarity: 'epic', primaryColor: '#4169E1', secondaryColor: '#87CEEB', particleStyle: 'lightning', unlockCost: 10000, stats: { accelerationBonus: 120, coinBonus: 80, startSpeedBonus: 10 } },
    { id: 'trail_inferno', name: '炼狱', rarity: 'epic', primaryColor: '#FF4500', secondaryColor: '#FF6347', particleStyle: 'flame', unlockCost: 18000, stats: { accelerationBonus: 150, coinBonus: 100, startSpeedBonus: 11 } },
    { id: 'trail_cosmic', name: '星辰', rarity: 'legendary', primaryColor: '#FFD700', secondaryColor: '#FF69B4', particleStyle: 'spark', unlockCost: 35000, stats: { accelerationBonus: 220, coinBonus: 200, startSpeedBonus: 12.5 } },
    { id: 'trail_divine', name: '神迹', rarity: 'legendary', primaryColor: '#FFFFF0', secondaryColor: '#FFD700', particleStyle: 'ribbon', unlockCost: 50000, stats: { accelerationBonus: 270, coinBonus: 900, startSpeedBonus: 13.5 } },
]

const TRAIL_MAP = new Map<string, TrailDef>()
for (const t of TRAILS) TRAIL_MAP.set(t.id, t)

export function getAllTrails(): TrailDef[] { return TRAILS }
export function getTrailById(id: string): TrailDef { return TRAIL_MAP.get(id) || TRAILS[0] }

export function getTrailRarityColor(rarity: TrailRarity): string {
    switch (rarity) {
        case 'common': return '#AAAAAA'
        case 'rare': return '#4488FF'
        case 'epic': return '#AA44FF'
        case 'legendary': return '#FFD700'
    }
}

export function getTrailRarityLabel(rarity: TrailRarity): string {
    switch (rarity) {
        case 'common': return '普通'
        case 'rare': return '稀有'
        case 'epic': return '史诗'
        case 'legendary': return '传说'
    }
}
