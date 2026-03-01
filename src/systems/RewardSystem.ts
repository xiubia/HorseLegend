// 奖励系统 - 距离里程碑奖励计算

/**
 * 里程碑配置
 */
export interface Milestone {
  distance: number;   // 距离（米）
  trophies: number;   // 奖杯数
}

/**
 * 比赛奖励
 */
export interface RaceReward {
  totalTrophies: number;
  milestones: Milestone[];
  isNewRecord: boolean;
}

/**
 * 里程碑配置表
 * 距离越远，奖励越丰厚（指数增长）
 */
export const MILESTONES: Milestone[] = [
  // 基础阶段 (+10)
  { distance: 20, trophies: 10 },
  { distance: 30, trophies: 10 },
  { distance: 40, trophies: 10 },
  { distance: 50, trophies: 10 },
  { distance: 60, trophies: 10 },
  { distance: 70, trophies: 10 },
  { distance: 80, trophies: 10 },
  { distance: 100, trophies: 10 },
  { distance: 500, trophies: 10 },

  // 进阶阶段 (+20)
  { distance: 1000, trophies: 20 },
  { distance: 2000, trophies: 20 },
  { distance: 4000, trophies: 20 },
  { distance: 8000, trophies: 20 },

  // 高级阶段 (+50)
  { distance: 15000, trophies: 50 },
  { distance: 30000, trophies: 50 },
];

/**
 * 奖励系统类
 */
export class RewardSystem {
  private milestones: Milestone[];
  
  constructor(customMilestones?: Milestone[]) {
    this.milestones = customMilestones ?? [...MILESTONES];
  }
  
  /**
   * 检查并返回新达成的里程碑
   */
  checkMilestones(currentDistance: number, alreadyCollected: number[]): Milestone[] {
    const newMilestones: Milestone[] = [];
    
    for (const milestone of this.milestones) {
      if (currentDistance >= milestone.distance && 
          !alreadyCollected.includes(milestone.distance)) {
        newMilestones.push(milestone);
      }
    }
    
    return newMilestones;
  }
  
  /**
   * 计算总奖杯数
   */
  calculateTotalTrophies(collectedMilestones: number[]): number {
    let total = 0;
    
    for (const distance of collectedMilestones) {
      const milestone = this.milestones.find(m => m.distance === distance);
      if (milestone) {
        total += milestone.trophies;
      }
    }
    
    return total;
  }
  
  /**
   * 获取下一个里程碑
   */
  getNextMilestone(currentDistance: number): Milestone | null {
    for (const milestone of this.milestones) {
      if (milestone.distance > currentDistance) {
        return milestone;
      }
    }
    return null;
  }
  
  /**
   * 获取已达成的里程碑数量
   */
  getCompletedMilestonesCount(currentDistance: number): number {
    return this.milestones.filter(m => currentDistance >= m.distance).length;
  }
  
  /**
   * 获取所有里程碑
   */
  getAllMilestones(): Milestone[] {
    return [...this.milestones];
  }
  
  /**
   * 计算距离对应的预估奖杯
   */
  estimateTrophies(distance: number): number {
    let total = 0;
    
    for (const milestone of this.milestones) {
      if (distance >= milestone.distance) {
        total += milestone.trophies;
      }
    }
    
    return total;
  }
  
  /**
   * 获取达成某个里程碑需要的速度等级（预估）
   * 假设60秒比赛时间
   */
  estimateRequiredSpeedLevel(targetDistance: number, raceDuration: number = 60): number {
    // 平均速度 = 距离 / 时间
    const requiredAvgSpeed = targetDistance / raceDuration;
    
    // 实际速度 = 5 + speedLevel * 0.5
    // requiredAvgSpeed = 5 + speedLevel * 0.5
    // speedLevel = (requiredAvgSpeed - 5) / 0.5
    const speedLevel = (requiredAvgSpeed - 5) / 0.5;
    
    return Math.max(0, Math.ceil(speedLevel));
  }
  
  /**
   * 根据速度等级预估可达距离
   */
  estimateDistance(speedLevel: number, raceDuration: number = 60): number {
    const speed = 5 + speedLevel * 0.5;
    return speed * raceDuration;
  }
  
  /**
   * 获取进度信息（用于UI显示）
   */
  getProgressInfo(currentDistance: number): {
    currentMilestone: Milestone | null;
    nextMilestone: Milestone | null;
    progressToNext: number;
    completedCount: number;
    totalCount: number;
  } {
    let currentMilestone: Milestone | null = null;
    let nextMilestone: Milestone | null = null;
    
    for (let i = 0; i < this.milestones.length; i++) {
      if (currentDistance >= this.milestones[i].distance) {
        currentMilestone = this.milestones[i];
      } else {
        nextMilestone = this.milestones[i];
        break;
      }
    }
    
    let progressToNext = 1;
    if (nextMilestone) {
      const prevDistance = currentMilestone?.distance ?? 0;
      const range = nextMilestone.distance - prevDistance;
      progressToNext = (currentDistance - prevDistance) / range;
    }
    
    return {
      currentMilestone,
      nextMilestone,
      progressToNext: Math.min(1, Math.max(0, progressToNext)),
      completedCount: this.getCompletedMilestonesCount(currentDistance),
      totalCount: this.milestones.length,
    };
  }
}

/**
 * 格式化距离显示
 */
export function formatDistance(distance: number): string {
  if (distance >= 10000) {
    return `${(distance / 1000).toFixed(1)}km`;
  } else if (distance >= 1000) {
    return `${(distance / 1000).toFixed(2)}km`;
  } else {
    return `${Math.round(distance)}m`;
  }
}

/**
 * 格式化奖杯数显示
 */
export function formatTrophies(trophies: number): string {
  if (trophies >= 10000) {
    return `${(trophies / 10000).toFixed(1)}万`;
  } else if (trophies >= 1000) {
    return `${(trophies / 1000).toFixed(1)}k`;
  } else {
    return `${trophies}`;
  }
}
