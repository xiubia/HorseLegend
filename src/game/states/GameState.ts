// 游戏状态管理

import {
  GamePhase,
  GameStateSnapshot,
  PlayerSnapshot,
  Track,
  DecisionPoint,
  GameAction,
  RaceResult
} from '../../data/types/GameTypes';
import { Horse } from '../../entities/Horse';
import { TrackEntity } from '../../entities/Track';

type EventHandler = (event: GameEvent) => void;

interface GameEvent {
  type: string;
  data?: any;
}

export class GameState {
  // 游戏阶段
  private _phase: GamePhase = 'menu';

  // 时间
  private _elapsedTime: number = 0;
  private _lastDecisionTime: number = 0;
  private _timeLimit: number = 60000; // 60秒

  // 玩家
  private _players: Map<string, Horse> = new Map();
  private _humanPlayerId: string = '';

  // 赛道
  private _track: TrackEntity | null = null;

  // 决策
  private _currentDecision: DecisionPoint | null = null;
  private _availableActions: GameAction[] = [];

  // 事件系统
  private eventListeners: Map<string, Set<EventHandler>> = new Map();

  // ========== Getters ==========

  get phase(): GamePhase {
    return this._phase;
  }

  get elapsedTime(): number {
    return this._elapsedTime;
  }

  get remainingTime(): number {
    return Math.max(0, this._timeLimit - this._elapsedTime) / 1000;
  }

  get timeSinceLastDecision(): number {
    return this._elapsedTime - this._lastDecisionTime;
  }

  get track(): TrackEntity | null {
    return this._track;
  }

  get currentDecision(): DecisionPoint | null {
    return this._currentDecision;
  }

  get humanPlayer(): Horse | null {
    return this._players.get(this._humanPlayerId) || null;
  }

  get allPlayers(): Horse[] {
    return Array.from(this._players.values());
  }

  get opponents(): Horse[] {
    return this.allPlayers.filter(p => p.playerId !== this._humanPlayerId);
  }

  // ========== 状态管理 ==========

  /**
   * 设置游戏阶段
   */
  setPhase(phase: GamePhase): void {
    const oldPhase = this._phase;
    this._phase = phase;
    this.emit({ type: 'phase_change', data: { from: oldPhase, to: phase } });
  }

  /**
   * 初始化比赛
   */
  initRace(track: TrackEntity, players: Horse[]): void {
    this._track = track;
    this._players.clear();
    this._elapsedTime = 0;
    this._lastDecisionTime = 0;

    for (const player of players) {
      this._players.set(player.playerId, player);
      if (player.isHuman) {
        this._humanPlayerId = player.playerId;
      }
    }

    this.setPhase('pre_race');
    this.emit({ type: 'race_init', data: { track, players } });
  }

  /**
   * 开始比赛
   */
  startRace(): void {
    this.setPhase('racing');
    this.emit({ type: 'race_start' });
  }

  /**
   * 更新游戏状态
   */
  update(deltaTime: number): void {
    if (this._phase !== 'racing') return;

    this._elapsedTime += deltaTime * 1000;

    // 更新所有玩家
    for (const player of this._players.values()) {
      player.onUpdate(deltaTime);
    }

    // 检查比赛结束
    this.checkRaceEnd();
  }

  /**
   * 检查比赛结束条件
   */
  private checkRaceEnd(): void {
    // 时间到
    if (this._elapsedTime >= this._timeLimit) {
      this.endRace();
      return;
    }

    // 检查是否有人到达终点
    if (this._track) {
      for (const player of this._players.values()) {
        if (player.currentProgress >= this._track.totalLength) {
          this.endRace();
          return;
        }
      }
    }
  }

  /**
   * 结束比赛
   */
  endRace(): void {
    this.setPhase('finished');

    // 计算结果
    const results = this.calculateResults();
    this.emit({ type: 'race_end', data: { results } });
  }

  /**
   * 计算比赛结果
   */
  calculateResults(): RaceResult[] {
    const players = Array.from(this._players.values());

    // 按进度排序
    players.sort((a, b) => b.currentProgress - a.currentProgress);

    return players.map((player, index) => ({
      playerId: player.playerId,
      position: index + 1,
      distance: player.currentProgress,
      time: this._elapsedTime / 1000,
      rewards: this.calculateRewards(index + 1, player.currentProgress)
    }));
  }

  /**
   * 计算奖励
   */
  private calculateRewards(position: number, distance: number): { gold: number; trophies: number; experience: number } {
    const baseGold = { 1: 100, 2: 50, 3: 25 }[position] ?? 10;
    const trophies = Math.floor(distance / 100);
    const experience = 50 + (4 - position) * 20;

    return { gold: baseGold, trophies, experience };
  }

  /**
   * 记录决策时间
   */
  recordDecisionTime(): void {
    this._lastDecisionTime = this._elapsedTime;
  }

  /**
   * 设置当前决策点
   */
  setCurrentDecision(decision: DecisionPoint | null, actions: GameAction[] = []): void {
    this._currentDecision = decision;
    this._availableActions = actions;

    if (decision) {
      this.emit({ type: 'decision_required', data: { decision, actions } });
    }
  }

  /**
   * 获取可用行动
   */
  getAvailableActions(): GameAction[] {
    return this._availableActions;
  }

  /**
   * 获取玩家
   */
  getPlayer(id: string): Horse | undefined {
    return this._players.get(id);
  }

  /**
   * 获取玩家进度
   */
  getPlayerProgress(): number {
    const human = this.humanPlayer;
    return human ? human.currentProgress : 0;
  }

  /**
   * 获取快照（供AI使用）
   */
  snapshot(): GameStateSnapshot {
    return {
      timestamp: Date.now(),
      phase: this._phase,
      players: this.allPlayers.map(p => p.getSnapshot()),
      track: this._track?.data || null,
      elapsedTime: this._elapsedTime,
      remainingTime: this.remainingTime,
      currentDecision: this._currentDecision
    };
  }

  /**
   * 转换为JSON（供LLM使用）
   */
  toJSON(): object {
    return {
      phase: this._phase,
      elapsedTime: this._elapsedTime / 1000,
      remainingTime: this.remainingTime,
      players: this.allPlayers.map(p => {
        const snapshot = p.getSnapshot();
        return {
          id: snapshot.id,
          name: snapshot.name,
          isHuman: snapshot.isHuman,
          progress: snapshot.progress,
          speed: snapshot.speed,
          stamina: snapshot.stamina,
          maxStamina: snapshot.maxStamina
        };
      }),
      trackLength: this._track?.totalLength || 0
    };
  }

  /**
   * 克隆状态（供AI模拟）
   */
  clone(): GameState {
    const cloned = new GameState();
    cloned._phase = this._phase;
    cloned._elapsedTime = this._elapsedTime;
    cloned._lastDecisionTime = this._lastDecisionTime;
    cloned._timeLimit = this._timeLimit;
    // 注意：这是浅克隆，仅用于简单模拟
    return cloned;
  }

  // ========== 事件系统 ==========

  on(eventType: string, handler: EventHandler): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(handler);

    return () => this.off(eventType, handler);
  }

  off(eventType: string, handler: EventHandler): void {
    this.eventListeners.get(eventType)?.delete(handler);
  }

  private emit(event: GameEvent): void {
    const handlers = this.eventListeners.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        handler(event);
      }
    }

    // 全局监听
    const allHandlers = this.eventListeners.get('*');
    if (allHandlers) {
      for (const handler of allHandlers) {
        handler(event);
      }
    }
  }

  // ========== 重置 ==========

  reset(): void {
    this._phase = 'menu';
    this._elapsedTime = 0;
    this._lastDecisionTime = 0;
    this._players.clear();
    this._track = null;
    this._currentDecision = null;
    this._availableActions = [];
  }
}
