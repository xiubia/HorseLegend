// 决策系统 - 核心博弈逻辑

import { GameState } from '../game/states/GameState';
import { Action, DecisionPoint, DecisionResult, Skill } from '../data/types/GameTypes';
import { Horse } from '../entities/Horse';
import skillsData from '../data/configs/skills.json';

// 基础行动定义
const BASE_ACTIONS: Action[] = [
  {
    id: 'sprint',
    name: '加速冲刺',
    description: '全力加速，消耗更多体力',
    staminaCost: 20,
    speedModifier: 1.5
  },
  {
    id: 'cruise',
    name: '稳定巡航',
    description: '保持中等速度',
    staminaCost: 5,
    speedModifier: 1.0
  },
  {
    id: 'rest',
    name: '蓄力待发',
    description: '减速恢复体力',
    staminaCost: 0,
    speedModifier: 0.7,
    recovery: 10
  },
  {
    id: 'burst',
    name: '极速爆发',
    description: '消耗大量体力换取极速',
    staminaCost: 40,
    speedModifier: 2.0
  }
];

export class DecisionSystem {
  private gameState: GameState;
  private currentDecisionPoint: DecisionPoint | null = null;
  private decisionTimer: number = 0;
  private pendingDecisions: Map<string, Action> = new Map();
  private decisionCallbacks: Map<string, (action: Action) => void> = new Map();
  
  // 决策间隔（毫秒）
  private readonly DECISION_INTERVAL = 3000;
  
  constructor(gameState: GameState) {
    this.gameState = gameState;
  }
  
  /**
   * 每帧更新
   */
  update(deltaTime: number): void {
    if (this.gameState.phase !== 'racing') return;
    
    // 检查是否需要触发新的决策点
    this.checkDecisionTriggers();
    
    // 更新决策计时器
    if (this.currentDecisionPoint) {
      this.decisionTimer += deltaTime * 1000;
      
      if (this.decisionTimer >= this.currentDecisionPoint.timeWindow) {
        this.resolveDecision();
      }
    }
  }
  
  /**
   * 检查决策触发条件
   */
  private checkDecisionTriggers(): void {
    if (this.currentDecisionPoint) return;
    
    // 周期性决策（每3秒）
    if (this.gameState.timeSinceLastDecision >= this.DECISION_INTERVAL) {
      this.triggerDecision({
        id: 'periodic_riding',
        type: 'periodic',
        timeWindow: this.DECISION_INTERVAL,
        defaultAction: 'cruise'
      });
    }
  }
  
  /**
   * 触发决策点
   */
  triggerDecision(decisionPoint: DecisionPoint): void {
    this.currentDecisionPoint = decisionPoint;
    this.decisionTimer = 0;
    this.pendingDecisions.clear();
    
    // 获取可用行动
    const availableActions = this.getAvailableActions(decisionPoint);
    
    // 通知游戏状态
    this.gameState.setCurrentDecision(decisionPoint, availableActions);
    
    // 请求所有玩家决策
    for (const player of this.gameState.allPlayers) {
      if (player.isHuman) {
        // 人类玩家通过UI决策
        this.notifyHumanPlayer(player, decisionPoint, availableActions);
      } else {
        // AI玩家请求决策
        this.requestAIDecision(player, decisionPoint, availableActions);
      }
    }
  }
  
  /**
   * 获取可用行动
   */
  getAvailableActions(decisionPoint: DecisionPoint): Action[] {
    const actions: Action[] = [...BASE_ACTIONS];
    const humanPlayer = this.gameState.humanPlayer;
    
    if (!humanPlayer) return actions;
    
    // 检查体力限制
    const filteredActions = actions.filter(action => {
      if (action.staminaCost > humanPlayer.currentStamina) {
        return false;
      }
      return true;
    });
    
    // 添加可用技能
    const snapshot = humanPlayer.getSnapshot();
    for (const skillState of snapshot.skills) {
      if (skillState.isReady) {
        const skillDef = this.getSkillDefinition(skillState.skillId);
        if (skillDef && skillDef.staminaCost <= humanPlayer.currentStamina) {
          filteredActions.push({
            id: `skill_${skillDef.id}`,
            name: skillDef.name,
            description: skillDef.description,
            staminaCost: skillDef.staminaCost,
            isSkill: true,
            skillId: skillDef.id
          });
        }
      }
    }
    
    return filteredActions;
  }
  
  /**
   * 获取技能定义
   */
  private getSkillDefinition(skillId: string): Skill | undefined {
    return (skillsData.skills as Skill[]).find(s => s.id === skillId);
  }
  
  /**
   * 通知人类玩家需要决策
   */
  private notifyHumanPlayer(player: Horse, decision: DecisionPoint, actions: Action[]): void {
    // 通过回调通知UI
    const callback = this.decisionCallbacks.get(player.playerId);
    if (callback) {
      // 等待玩家选择
    }
  }
  
  /**
   * 请求AI决策
   */
  private requestAIDecision(player: Horse, decision: DecisionPoint, actions: Action[]): void {
    // AI决策会由AIManager处理
    // 这里使用简单的默认逻辑
    const action = this.simpleAIDecision(player, actions);
    this.submitDecision(player.playerId, action);
  }
  
  /**
   * 简单AI决策（备用）
   */
  private simpleAIDecision(player: Horse, actions: Action[]): Action {
    const snapshot = player.getSnapshot();
    const staminaRatio = snapshot.stamina / snapshot.maxStamina;
    
    // 根据体力选择行动
    if (staminaRatio < 0.2) {
      return actions.find(a => a.id === 'rest') || actions[0];
    } else if (staminaRatio > 0.6) {
      return actions.find(a => a.id === 'sprint') || actions[0];
    } else {
      return actions.find(a => a.id === 'cruise') || actions[0];
    }
  }
  
  /**
   * 提交决策
   */
  submitDecision(playerId: string, action: Action): void {
    if (!this.currentDecisionPoint) return;
    
    this.pendingDecisions.set(playerId, action);
    
    // 检查是否所有玩家都已决策
    if (this.pendingDecisions.size === this.gameState.allPlayers.length) {
      this.resolveDecision();
    }
  }
  
  /**
   * 解析并执行决策
   */
  private resolveDecision(): void {
    if (!this.currentDecisionPoint) return;
    
    // 为未决策的玩家使用默认行动
    for (const player of this.gameState.allPlayers) {
      if (!this.pendingDecisions.has(player.playerId)) {
        const defaultAction = this.getDefaultAction(this.currentDecisionPoint);
        this.pendingDecisions.set(player.playerId, defaultAction);
      }
    }
    
    // 执行所有决策
    const results: DecisionResult[] = [];
    for (const [playerId, action] of this.pendingDecisions) {
      const result = this.executeAction(playerId, action);
      results.push(result);
    }
    
    // 重置状态
    this.currentDecisionPoint = null;
    this.gameState.setCurrentDecision(null);
    this.gameState.recordDecisionTime();
  }
  
  /**
   * 获取默认行动
   */
  private getDefaultAction(decision: DecisionPoint): Action {
    return BASE_ACTIONS.find(a => a.id === decision.defaultAction) || BASE_ACTIONS[1];
  }
  
  /**
   * 执行行动
   */
  private executeAction(playerId: string, action: Action): DecisionResult {
    const player = this.gameState.getPlayer(playerId);
    
    if (!player) {
      return { playerId, action, success: false, timestamp: Date.now() };
    }
    
    // 消耗体力
    if (!player.consumeStamina(action.staminaCost)) {
      // 体力不足，使用默认行动
      const defaultAction = BASE_ACTIONS[1]; // cruise
      player.setAction(defaultAction.id, defaultAction.speedModifier || 1.0);
      return { playerId, action: defaultAction, success: true, timestamp: Date.now() };
    }
    
    // 应用行动效果
    if (action.speedModifier) {
      player.setAction(action.id, action.speedModifier);
    }
    
    if (action.recovery) {
      player.recoverStamina(action.recovery);
    }
    
    // 处理技能
    if (action.isSkill && action.skillId) {
      this.executeSkill(player, action.skillId);
    }
    
    return { playerId, action, success: true, timestamp: Date.now() };
  }
  
  /**
   * 执行技能
   */
  private executeSkill(player: Horse, skillId: string): void {
    const skillDef = this.getSkillDefinition(skillId);
    if (!skillDef) return;
    
    // 触发冷却
    player.triggerSkillCooldown(skillId, skillDef.cooldown);
    
    // 应用效果
    for (const effect of skillDef.effects) {
      if (effect.target === 'self') {
        this.applyEffectToPlayer(player, effect);
      } else if (effect.target === 'opponent') {
        // 应用到最近的对手
        const opponent = this.findNearestOpponent(player);
        if (opponent) {
          this.applyEffectToPlayer(opponent, effect);
        }
      }
    }
  }
  
  /**
   * 应用效果到玩家
   */
  private applyEffectToPlayer(player: Horse, effect: any): void {
    switch (effect.type) {
      case 'speed_boost':
        player.setSpeedModifier(1 + effect.value, (effect.duration || 3) * 1000);
        break;
      case 'speed_reduction':
        player.setSpeedModifier(1 - effect.value, (effect.duration || 2) * 1000);
        break;
      case 'stamina_heal':
        player.recoverStamina(effect.value);
        break;
      case 'stamina_damage':
        player.consumeStamina(effect.value);
        break;
    }
  }
  
  /**
   * 找到最近的对手
   */
  private findNearestOpponent(player: Horse): Horse | null {
    let nearest: Horse | null = null;
    let minDistance = Infinity;
    
    for (const other of this.gameState.allPlayers) {
      if (other.playerId === player.playerId) continue;
      
      const distance = Math.abs(other.currentProgress - player.currentProgress);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = other;
      }
    }
    
    return nearest;
  }
  
  /**
   * 注册决策回调（供UI使用）
   */
  onDecisionRequired(playerId: string, callback: (action: Action) => void): void {
    this.decisionCallbacks.set(playerId, callback);
  }
  
  /**
   * 获取当前决策点
   */
  getCurrentDecision(): DecisionPoint | null {
    return this.currentDecisionPoint;
  }
  
  /**
   * 获取决策剩余时间
   */
  getDecisionRemainingTime(): number {
    if (!this.currentDecisionPoint) return 0;
    return Math.max(0, this.currentDecisionPoint.timeWindow - this.decisionTimer) / 1000;
  }
}
