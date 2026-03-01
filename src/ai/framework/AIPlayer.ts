// AI玩家框架

import { GameState } from '../../game/states/GameState';
import { Action, AIDecision, OpponentPersonality, PlayerSnapshot } from '../../data/types/GameTypes';
import { LLMBridge } from '../llm/LLMBridge';
import { Horse } from '../../entities/Horse';

/**
 * AI大脑接口
 */
export interface AIBrain {
  evaluate(state: GameState, actions: Action[]): Promise<Action>;
  updateModel?(outcome: any): void;
}

/**
 * 规则型AI - 简单但快速
 */
export class RuleBasedBrain implements AIBrain {
  private personality: OpponentPersonality;
  
  constructor(personality: OpponentPersonality) {
    this.personality = personality;
  }
  
  async evaluate(state: GameState, actions: Action[]): Promise<Action> {
    const snapshot = state.snapshot();
    const me = snapshot.players.find(p => p.name === this.personality.name);
    
    if (!me) {
      return actions[0];
    }
    
    const staminaRatio = me.stamina / me.maxStamina;
    const progress = me.progress / (snapshot.track?.totalLength || 500);
    
    // 根据策略选择行动
    switch (this.personality.strategy) {
      case 'aggressive':
        return this.aggressiveStrategy(actions, staminaRatio, progress);
      case 'defensive':
        return this.defensiveStrategy(actions, staminaRatio, progress);
      case 'opportunist':
        return this.opportunistStrategy(actions, staminaRatio, progress, snapshot);
      case 'steady':
        return this.steadyStrategy(actions, staminaRatio);
      case 'chaotic':
        return this.chaoticStrategy(actions);
      default:
        return this.steadyStrategy(actions, staminaRatio);
    }
  }
  
  private aggressiveStrategy(actions: Action[], stamina: number, progress: number): Action {
    // 激进：前半程全力冲刺
    if (progress < 0.5 && stamina > 0.3) {
      return actions.find(a => a.id === 'sprint') || actions[0];
    }
    // 后半程保持中速
    if (stamina > 0.2) {
      return actions.find(a => a.id === 'cruise') || actions[0];
    }
    return actions.find(a => a.id === 'rest') || actions[0];
  }
  
  private defensiveStrategy(actions: Action[], stamina: number, progress: number): Action {
    // 防守：始终保持中等速度，体力管理
    if (stamina < 0.4) {
      return actions.find(a => a.id === 'rest') || actions[0];
    }
    if (stamina > 0.7 && progress > 0.7) {
      return actions.find(a => a.id === 'sprint') || actions[0];
    }
    return actions.find(a => a.id === 'cruise') || actions[0];
  }
  
  private opportunistStrategy(
    actions: Action[], 
    stamina: number, 
    progress: number,
    snapshot: any
  ): Action {
    // 机会主义：保持第二，最后时刻反超
    const myPos = snapshot.players.find((p: any) => p.name === this.personality.name)?.progress || 0;
    const leader = snapshot.players.reduce((max: any, p: any) => 
      p.progress > max.progress ? p : max, { progress: 0 });
    
    // 如果落后太多，加速追赶
    if (leader.progress - myPos > 20 && stamina > 0.4) {
      return actions.find(a => a.id === 'sprint') || actions[0];
    }
    
    // 最后阶段爆发
    if (progress > 0.8 && stamina > 0.3) {
      return actions.find(a => a.id === 'burst') || 
             actions.find(a => a.id === 'sprint') || actions[0];
    }
    
    return actions.find(a => a.id === 'cruise') || actions[0];
  }
  
  private steadyStrategy(actions: Action[], stamina: number): Action {
    // 稳定：根据体力选择
    if (stamina > 0.6) {
      return actions.find(a => a.id === 'sprint') || actions[0];
    }
    if (stamina < 0.3) {
      return actions.find(a => a.id === 'rest') || actions[0];
    }
    return actions.find(a => a.id === 'cruise') || actions[0];
  }
  
  private chaoticStrategy(actions: Action[]): Action {
    // 混沌：完全随机
    return actions[Math.floor(Math.random() * actions.length)];
  }
}

/**
 * LLM型AI - 使用大语言模型决策
 */
export class LLMBrain implements AIBrain {
  private llm: LLMBridge;
  private personality: OpponentPersonality;
  private fallback: RuleBasedBrain;
  
  constructor(llm: LLMBridge, personality: OpponentPersonality) {
    this.llm = llm;
    this.personality = personality;
    this.fallback = new RuleBasedBrain(personality);
  }
  
  async evaluate(state: GameState, actions: Action[]): Promise<Action> {
    try {
      const decision = await this.llm.decide(state, actions, this.personality.name);
      const action = actions.find(a => a.id === decision.action);
      
      if (action) {
        return action;
      }
    } catch (e) {
      console.warn('LLM brain failed, using fallback:', e);
    }
    
    return this.fallback.evaluate(state, actions);
  }
}

/**
 * AI玩家
 */
export class AIPlayer {
  public id: string;
  public personality: OpponentPersonality;
  public horse: Horse;
  
  private brain: AIBrain;
  private decisionHistory: Array<{ action: Action; timestamp: number }> = [];
  
  constructor(
    id: string,
    personality: OpponentPersonality,
    horse: Horse,
    brain: AIBrain
  ) {
    this.id = id;
    this.personality = personality;
    this.horse = horse;
    this.brain = brain;
    
    // 设置马匹信息
    this.horse.playerId = id;
    this.horse.playerName = personality.name;
    this.horse.isHuman = false;
  }
  
  /**
   * 做出决策
   */
  async decide(state: GameState, availableActions: Action[]): Promise<Action> {
    // 应用性格影响
    const filteredActions = this.applyPersonalityFilter(availableActions);
    
    // 获取AI决策
    const action = await this.brain.evaluate(state, filteredActions);
    
    // 应用一致性（低一致性可能随机改变决策）
    const finalAction = this.applyConsistency(action, filteredActions);
    
    // 记录历史
    this.decisionHistory.push({
      action: finalAction,
      timestamp: Date.now()
    });
    
    return finalAction;
  }
  
  /**
   * 应用性格过滤
   */
  private applyPersonalityFilter(actions: Action[]): Action[] {
    // 过滤掉回避的行动（但保留至少一个）
    const filtered = actions.filter(a => 
      !this.personality.avoidedActions.includes(a.id)
    );
    
    return filtered.length > 0 ? filtered : actions;
  }
  
  /**
   * 应用一致性
   */
  private applyConsistency(action: Action, allActions: Action[]): Action {
    // 低一致性有概率随机改变决策
    if (Math.random() > this.personality.consistency) {
      // 优先选择偏好行动
      const preferred = allActions.filter(a => 
        this.personality.preferredActions.includes(a.id)
      );
      
      if (preferred.length > 0) {
        return preferred[Math.floor(Math.random() * preferred.length)];
      }
      
      // 否则随机
      return allActions[Math.floor(Math.random() * allActions.length)];
    }
    
    return action;
  }
  
  /**
   * 获取嘲讽语句
   */
  getTaunt(): string {
    const taunts = this.personality.taunts;
    return taunts[Math.floor(Math.random() * taunts.length)];
  }
  
  /**
   * 更新（每帧调用）
   */
  update(deltaTime: number): void {
    this.horse.update(deltaTime);
  }
}
