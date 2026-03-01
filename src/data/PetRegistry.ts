/**
 * 宠物注册表 — 8种宠物的静态数据、抽蛋概率与查询 API
 */

export type PetRarity = 'common' | 'rare' | 'epic' | 'legendary'
export type PetType = 'puppy' | 'kitten' | 'koala' | 'fox' | 'parrot' | 'owl' | 'bunny' | 'dragon'

export interface PetDef {
    id: string
    name: string
    type: PetType
    rarity: PetRarity
    bodyColor: string
    accentColor: string
    speedMultiplier: number
}

const PETS: PetDef[] = [
    { id: 'pet_puppy', name: '小土狗', type: 'puppy', rarity: 'common', bodyColor: '#C4A46C', accentColor: '#8B6914', speedMultiplier: 1.2 },
    { id: 'pet_kitten', name: '小猫咪', type: 'kitten', rarity: 'common', bodyColor: '#F4A460', accentColor: '#FF8C00', speedMultiplier: 1.2 },
    { id: 'pet_koala', name: '考拉', type: 'koala', rarity: 'rare', bodyColor: '#A0A0A0', accentColor: '#F5F5F5', speedMultiplier: 1.6 },
    { id: 'pet_fox', name: '小狐狸', type: 'fox', rarity: 'rare', bodyColor: '#E8751A', accentColor: '#FFFFFF', speedMultiplier: 1.6 },
    { id: 'pet_parrot', name: '鹦鹉', type: 'parrot', rarity: 'epic', bodyColor: '#2ECC71', accentColor: '#3498DB', speedMultiplier: 2.4 },
    { id: 'pet_owl', name: '猫头鹰', type: 'owl', rarity: 'epic', bodyColor: '#F5F5DC', accentColor: '#8B4513', speedMultiplier: 2.4 },
    { id: 'pet_bunny', name: '彩虹兔', type: 'bunny', rarity: 'legendary', bodyColor: '#DDA0DD', accentColor: '#FF69B4', speedMultiplier: 4.0 },
    { id: 'pet_dragon', name: '迷你龙', type: 'dragon', rarity: 'legendary', bodyColor: '#DC143C', accentColor: '#FFD700', speedMultiplier: 4.0 },
]

// ── 概率池 ──

export const GACHA_RATES: Record<PetRarity, number> = {
    common: 0.70,
    rare: 0.20,
    epic: 0.08,
    legendary: 0.02,
}

export const GACHA_COST_SINGLE = 100
export const GACHA_COST_MULTI = 450
export const GACHA_MULTI_COUNT = 5
export const PET_MAX_OWNED = 50
export const PET_MAX_EQUIPPED = 3

// ── 索引 ──

const PET_MAP = new Map<string, PetDef>()
for (const p of PETS) PET_MAP.set(p.id, p)

const PETS_BY_RARITY = new Map<PetRarity, PetDef[]>()
for (const p of PETS) {
    if (!PETS_BY_RARITY.has(p.rarity)) PETS_BY_RARITY.set(p.rarity, [])
    PETS_BY_RARITY.get(p.rarity)!.push(p)
}

// ── API ──

export function getAllPets(): PetDef[] { return PETS }
export function getPetById(id: string): PetDef { return PET_MAP.get(id) || PETS[0] }

export function getPetRarityColor(rarity: PetRarity): string {
    switch (rarity) {
        case 'common': return '#AAAAAA'
        case 'rare': return '#4488FF'
        case 'epic': return '#AA44FF'
        case 'legendary': return '#FFD700'
    }
}

export function getPetRarityLabel(rarity: PetRarity): string {
    switch (rarity) {
        case 'common': return '常见'
        case 'rare': return '稀有'
        case 'epic': return '史诗'
        case 'legendary': return '传说'
    }
}

export function getPetSpeedBonus(multiplier: number): number {
    return (multiplier - 1) * 10
}

export function rollGacha(): PetDef {
    const roll = Math.random()
    let cumulative = 0
    let selectedRarity: PetRarity = 'common'

    for (const [rarity, rate] of Object.entries(GACHA_RATES) as [PetRarity, number][]) {
        cumulative += rate
        if (roll < cumulative) { selectedRarity = rarity; break }
    }

    const pool = PETS_BY_RARITY.get(selectedRarity) || PETS_BY_RARITY.get('common')!
    return pool[Math.floor(Math.random() * pool.length)]
}

export function rollGachaMulti(count: number): PetDef[] {
    return Array.from({ length: count }, () => rollGacha())
}
