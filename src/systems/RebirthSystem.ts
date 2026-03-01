/**
 * 重生系统 — 消耗速度等级(speedLevel)进行重生，永久提升训练效率
 *
 * 核心公式：
 *   1 次重生 = 消耗 REBIRTH_COST 速度等级
 *   训练倍率 = 1 + rebirthCount × (REBIRTH_BONUS_PERCENT / 100)
 */

// ============ 常量 ============

/** 每次重生消耗的速度等级 */
export const REBIRTH_COST = 1000;

/** 每次重生提供的训练速度加成百分比 */
export const REBIRTH_BONUS_PERCENT = 10;

/** 自动重生解锁所需奖杯 */
export const AUTO_REBIRTH_TROPHY_COST = 500;

// ============ 工具函数 ============

/**
 * 计算当前速度等级最多可以进行多少次重生
 */
export function getMaxRebirths(speedLevel: number): number {
  return Math.floor(speedLevel / REBIRTH_COST);
}

/**
 * 计算 N 次重生需要消耗的速度等级
 */
export function getRebirthCost(count: number): number {
  return count * REBIRTH_COST;
}

/**
 * 根据重生次数计算训练倍率
 * 例：10次重生 → 1 + 10 × 0.10 = 2.0（训练速度翻倍）
 */
export function getRebirthTrainingMultiplier(rebirthCount: number): number {
  return 1 + rebirthCount * (REBIRTH_BONUS_PERCENT / 100);
}

/**
 * 格式化速度等级为"万"单位（≥10000 时显示 X.XX万）
 */
export function formatSpeedLevel(speedLevel: number): string {
  if (speedLevel >= 10000) {
    return (speedLevel / 10000).toFixed(2) + '万';
  }
  return Math.floor(speedLevel).toString();
}
