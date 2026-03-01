// PlayerMemory - 玩家历史行为记录
// 用于AI分析玩家套路

/**
 * 单回合记录
 */
export interface RoundRecord {
  roundNumber: number;
  timestamp: number;
  shout: string;
  action: string;
  wasBluff: boolean;
  aiResponse: string;
  aiAction: string;
  aiPredictedCorrectly: boolean;
}

/**
 * 比赛记录
 */
export interface RaceRecord {
  raceId: string;
  opponentName: string;
  timestamp: number;
  rounds: RoundRecord[];
  winner: 'player' | 'ai' | 'draw';
  playerFinalDistance: number;
  aiFinalDistance: number;
}

/**
 * 玩家行为模式分析
 */
export interface BehaviorPattern {
  overallBluffRate: number;       // 总体欺骗率
  bluffRateByShout: Record<string, number>;  // 各类喊话的欺骗率
  preferredAction: string;         // 最常用行动
  actionDistribution: Record<string, number>; // 行动分布
  patternStrength: number;         // 模式强度（0-1，越高越有规律）
}

/**
 * PlayerMemory - 玩家记忆管理器
 */
export class PlayerMemory {
  private static STORAGE_KEY = 'horse_racing_player_memory';
  private raceHistory: RaceRecord[] = [];
  private currentRace: RaceRecord | null = null;
  
  constructor() {
    this.load();
  }
  
  /**
   * 开始新比赛
   */
  startNewRace(opponentName: string): void {
    this.currentRace = {
      raceId: this.generateRaceId(),
      opponentName,
      timestamp: Date.now(),
      rounds: [],
      winner: 'draw',
      playerFinalDistance: 0,
      aiFinalDistance: 0
    };
  }
  
  /**
   * 记录一回合
   */
  recordRound(record: Omit<RoundRecord, 'roundNumber' | 'timestamp'>): void {
    if (!this.currentRace) {
      console.warn('No active race to record round');
      return;
    }
    
    this.currentRace.rounds.push({
      ...record,
      roundNumber: this.currentRace.rounds.length + 1,
      timestamp: Date.now()
    });
  }
  
  /**
   * 结束比赛
   */
  endRace(winner: 'player' | 'ai' | 'draw', playerDistance: number, aiDistance: number): void {
    if (!this.currentRace) return;
    
    this.currentRace.winner = winner;
    this.currentRace.playerFinalDistance = playerDistance;
    this.currentRace.aiFinalDistance = aiDistance;
    
    this.raceHistory.push(this.currentRace);
    this.currentRace = null;
    
    // 保持最多50场比赛记录
    if (this.raceHistory.length > 50) {
      this.raceHistory = this.raceHistory.slice(-50);
    }
    
    this.save();
  }
  
  /**
   * 获取当前比赛的回合记录
   */
  getCurrentRaceRounds(): RoundRecord[] {
    return this.currentRace?.rounds || [];
  }
  
  /**
   * 分析玩家行为模式
   */
  analyzePattern(): BehaviorPattern {
    const allRounds = this.getAllRounds();
    
    if (allRounds.length === 0) {
      return {
        overallBluffRate: 0,
        bluffRateByShout: {},
        preferredAction: 'cruise',
        actionDistribution: { sprint: 0, cruise: 0, rest: 0 },
        patternStrength: 0
      };
    }
    
    // 计算总体欺骗率
    const bluffCount = allRounds.filter(r => r.wasBluff).length;
    const overallBluffRate = bluffCount / allRounds.length;
    
    // 计算各类喊话的欺骗率
    const shoutStats: Record<string, { total: number; bluff: number }> = {};
    for (const round of allRounds) {
      const shoutKey = this.normalizeShout(round.shout);
      if (!shoutStats[shoutKey]) {
        shoutStats[shoutKey] = { total: 0, bluff: 0 };
      }
      shoutStats[shoutKey].total++;
      if (round.wasBluff) {
        shoutStats[shoutKey].bluff++;
      }
    }
    
    const bluffRateByShout: Record<string, number> = {};
    for (const [shout, stats] of Object.entries(shoutStats)) {
      bluffRateByShout[shout] = stats.bluff / stats.total;
    }
    
    // 计算行动分布
    const actionCounts: Record<string, number> = { sprint: 0, cruise: 0, rest: 0 };
    for (const round of allRounds) {
      if (actionCounts[round.action] !== undefined) {
        actionCounts[round.action]++;
      }
    }
    
    const actionDistribution: Record<string, number> = {};
    for (const [action, count] of Object.entries(actionCounts)) {
      actionDistribution[action] = count / allRounds.length;
    }
    
    // 找出最常用行动
    let preferredAction = 'cruise';
    let maxCount = 0;
    for (const [action, count] of Object.entries(actionCounts)) {
      if (count > maxCount) {
        maxCount = count;
        preferredAction = action;
      }
    }
    
    // 计算模式强度（行动分布的集中程度）
    const entropy = Object.values(actionDistribution)
      .filter(p => p > 0)
      .reduce((sum, p) => sum - p * Math.log2(p), 0);
    const maxEntropy = Math.log2(3);  // 3种行动
    const patternStrength = 1 - (entropy / maxEntropy);
    
    return {
      overallBluffRate,
      bluffRateByShout,
      preferredAction,
      actionDistribution,
      patternStrength
    };
  }
  
  /**
   * 获取所有回合记录
   */
  private getAllRounds(): RoundRecord[] {
    const rounds: RoundRecord[] = [];
    
    for (const race of this.raceHistory) {
      rounds.push(...race.rounds);
    }
    
    if (this.currentRace) {
      rounds.push(...this.currentRace.rounds);
    }
    
    return rounds;
  }
  
  /**
   * 标准化喊话（用于统计）
   */
  private normalizeShout(shout: string): string {
    const lowerShout = shout.toLowerCase();
    
    if (lowerShout.includes('冲') || lowerShout.includes('sprint')) {
      return '冲刺类';
    }
    if (lowerShout.includes('累') || lowerShout.includes('力')) {
      return '体力类';
    }
    if (lowerShout.includes('追') || lowerShout.includes('赢')) {
      return '嘲讽类';
    }
    if (lowerShout.includes('休') || lowerShout.includes('蓄')) {
      return '休息类';
    }
    
    return '其他';
  }
  
  /**
   * 生成比赛ID
   */
  private generateRaceId(): string {
    return `race_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * 获取统计数据
   */
  getStats(): {
    totalRaces: number;
    playerWins: number;
    aiWins: number;
    draws: number;
    totalRounds: number;
  } {
    const playerWins = this.raceHistory.filter(r => r.winner === 'player').length;
    const aiWins = this.raceHistory.filter(r => r.winner === 'ai').length;
    const draws = this.raceHistory.filter(r => r.winner === 'draw').length;
    const totalRounds = this.raceHistory.reduce((sum, r) => sum + r.rounds.length, 0);
    
    return {
      totalRaces: this.raceHistory.length,
      playerWins,
      aiWins,
      draws,
      totalRounds
    };
  }
  
  /**
   * 清除所有记录
   */
  clearAll(): void {
    this.raceHistory = [];
    this.currentRace = null;
    localStorage.removeItem(PlayerMemory.STORAGE_KEY);
  }
  
  /**
   * 保存到localStorage
   */
  private save(): void {
    try {
      localStorage.setItem(PlayerMemory.STORAGE_KEY, JSON.stringify(this.raceHistory));
    } catch (e) {
      console.warn('Failed to save player memory:', e);
    }
  }
  
  /**
   * 从localStorage加载
   */
  private load(): void {
    try {
      const data = localStorage.getItem(PlayerMemory.STORAGE_KEY);
      if (data) {
        this.raceHistory = JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to load player memory:', e);
      this.raceHistory = [];
    }
  }
}

// 导出单例
export const playerMemory = new PlayerMemory();
