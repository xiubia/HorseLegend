// 游戏总控

import * as THREE from 'three';
import { Engine } from '../engine/Engine';
import { GameState } from './states/GameState';
import { DecisionSystem } from '../systems/DecisionSystem';
import { TrackGenerator } from '../ai/generators/TrackGenerator';
import { LLMBridge } from '../ai/llm/LLMBridge';
import { AIPlayer, RuleBasedBrain, LLMBrain } from '../ai/framework/AIPlayer';
import { Horse } from '../entities/Horse';
import { TrackEntity } from '../entities/Track';
import { RaceConfig, OpponentPersonality, HorseConfig } from '../data/types/GameTypes';

import horsesData from '../data/configs/horses.json';
import opponentsData from '../data/configs/opponents.json';

export class GameDirector {
  private engine: Engine;
  private gameState: GameState;
  private decisionSystem: DecisionSystem;
  private trackGenerator: TrackGenerator;
  private llmBridge: LLMBridge;

  private aiPlayers: AIPlayer[] = [];
  private playerHorse: Horse | null = null;
  private track: TrackEntity | null = null;

  // UI回调
  private onDecisionRequired?: (actions: any[]) => void;
  private onGameStateUpdate?: (state: any) => void;
  private onRaceEnd?: (results: any[]) => void;

  constructor(engine: Engine) {
    this.engine = engine;
    this.gameState = new GameState();
    this.decisionSystem = new DecisionSystem(this.gameState);
    this.trackGenerator = new TrackGenerator();
    this.llmBridge = new LLMBridge();

    // 监听游戏事件
    this.setupEventListeners();
  }

  /**
   * 设置LLM API
   */
  setupLLM(apiKey: string, model: string = 'gemini-2.0-flash'): void {
    this.llmBridge.setApiKey(apiKey);
    this.llmBridge.setModel(model);
  }

  /**
   * 设置事件监听
   */
  private setupEventListeners(): void {
    this.gameState.on('decision_required', (event) => {
      if (this.onDecisionRequired) {
        this.onDecisionRequired(event.data.actions);
      }
    });

    this.gameState.on('race_end', (event) => {
      if (this.onRaceEnd) {
        this.onRaceEnd(event.data.results);
      }
    });
  }

  /**
   * 开始新比赛
   */
  async startRace(config: RaceConfig = { difficulty: 1.0, opponentCount: 2, timeLimit: 60 }): Promise<void> {
    // 生成赛道
    const trackData = this.trackGenerator.generate({
      difficulty: config.difficulty,
      totalLength: 500
    });
    this.track = new TrackEntity('race_track', trackData);

    // 创建玩家马匹
    const playerHorseConfig = this.getHorseConfig('starter_horse');
    this.playerHorse = new Horse('player_horse', playerHorseConfig);
    this.playerHorse.playerId = 'player';
    this.playerHorse.playerName = '玩家';
    this.playerHorse.isHuman = true;
    this.playerHorse.setSkills(['gale_step', 'double_jump', 'iron_wall'], [15, 10, 20]);

    // 创建AI对手
    this.aiPlayers = [];
    const opponentConfigs = this.selectOpponents(config.opponentCount);

    for (let i = 0; i < opponentConfigs.length; i++) {
      const personality = opponentConfigs[i];
      const horseConfig = this.getHorseConfigForPersonality(personality);
      const horse = new Horse(`ai_horse_${i}`, horseConfig);

      // 根据配置选择AI类型
      const brain = i === 0 && this.llmBridge
        ? new LLMBrain(this.llmBridge, personality)
        : new RuleBasedBrain(personality);

      const aiPlayer = new AIPlayer(
        `ai_${i}`,
        personality,
        horse,
        brain
      );

      this.aiPlayers.push(aiPlayer);
    }

    // 收集所有马匹
    const allHorses = [this.playerHorse, ...this.aiPlayers.map(ai => ai.horse)];

    // 设置初始位置
    this.setupStartPositions(allHorses);

    // 初始化游戏状态
    this.gameState.initRace(this.track, allHorses);

    // 添加到场景
    this.addToScene();

    // 短暂延迟后开始
    setTimeout(() => {
      this.gameState.startRace();
    }, 1000);
  }

  /**
   * 获取马匹配置
   */
  private getHorseConfig(id: string): HorseConfig {
    const horse = (horsesData.horses as HorseConfig[]).find(h => h.id === id);
    return horse || (horsesData.horses[0] as HorseConfig);
  }

  /**
   * 根据性格获取马匹配置
   */
  private getHorseConfigForPersonality(personality: OpponentPersonality): HorseConfig {
    const pref = (personality as any).horsePreference || 'balanced';
    const horses = horsesData.horses as HorseConfig[];

    // 简单匹配
    switch (pref) {
      case 'speed':
        return horses.find(h => h.baseStats.speed > 40) || horses[0];
      case 'stamina':
        return horses.find(h => h.baseStats.stamina > 40) || horses[0];
      case 'agility':
        return horses.find(h => h.baseStats.agility > 40) || horses[0];
      default:
        return horses[Math.floor(Math.random() * horses.length)];
    }
  }

  /**
   * 选择对手
   */
  private selectOpponents(count: number): OpponentPersonality[] {
    const all = opponentsData.opponents as OpponentPersonality[];
    const shuffled = [...all].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * 设置起始位置
   */
  private setupStartPositions(horses: Horse[]): void {
    const laneWidth = 2;
    const startZ = 5;

    horses.forEach((horse, index) => {
      const laneOffset = (index - (horses.length - 1) / 2) * laneWidth;
      horse.setPosition(laneOffset, 0, startZ);
    });
  }

  /**
   * 添加到场景
   */
  private addToScene(): void {
    const scene = this.engine.world.scene;

    // 添加赛道
    if (this.track) {
      this.track.addToScene(scene);
    }

    // 添加玩家马匹
    if (this.playerHorse) {
      this.playerHorse.addToScene(scene);
    }

    // 添加AI马匹
    for (const ai of this.aiPlayers) {
      ai.horse.addToScene(scene);
    }

    // 添加光照
    this.setupLighting(scene);

    // 设置相机
    this.setupCamera();
  }

  /**
   * 设置光照
   */
  private setupLighting(scene: THREE.Scene): void {
    // 环境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // 方向光（太阳）
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 500;
    dirLight.shadow.camera.left = -100;
    dirLight.shadow.camera.right = 100;
    dirLight.shadow.camera.top = 100;
    dirLight.shadow.camera.bottom = -100;
    scene.add(dirLight);

    // 天空颜色
    scene.background = new THREE.Color(0x87CEEB);
  }

  /**
   * 设置相机
   */
  private setupCamera(): void {
    const camera = this.engine.camera;
    camera.position.set(0, 8, -5);
    camera.lookAt(0, 0, 10);
  }

  /**
   * 每帧更新
   */
  update(deltaTime: number): void {
    if (this.gameState.phase !== 'racing') return;

    // 更新游戏状态
    this.gameState.update(deltaTime);

    // 更新决策系统
    this.decisionSystem.update(deltaTime);

    // 更新AI决策
    this.updateAIDecisions();

    // 更新相机跟随
    this.updateCamera();

    // 通知UI更新
    if (this.onGameStateUpdate) {
      this.onGameStateUpdate(this.getUIState());
    }
  }

  /**
   * 更新AI决策
   */
  private async updateAIDecisions(): Promise<void> {
    const decision = this.decisionSystem.getCurrentDecision();
    if (!decision) return;

    const actions = this.gameState.getAvailableActions();

    for (const ai of this.aiPlayers) {
      // 检查是否已经提交决策
      const action = await ai.decide(this.gameState, actions);
      this.decisionSystem.submitDecision(ai.id, action);
    }
  }

  /**
   * 更新相机
   */
  private updateCamera(): void {
    if (!this.playerHorse) return;

    const camera = this.engine.camera;
    const target = this.playerHorse.position;

    // 第三人称跟随
    const offsetX = 0;
    const offsetY = 5;
    const offsetZ = -8;

    const targetCamPos = new THREE.Vector3(
      target.x + offsetX,
      target.y + offsetY,
      target.z + offsetZ
    );

    // 平滑跟随
    camera.position.lerp(targetCamPos, 0.05);

    // 看向玩家前方
    const lookAtPos = new THREE.Vector3(target.x, target.y + 1, target.z + 10);
    camera.lookAt(lookAtPos);
  }

  /**
   * 玩家提交决策
   */
  submitPlayerDecision(actionId: string): void {
    const actions = this.gameState.getAvailableActions();
    const action = actions.find(a => a.id === actionId);

    if (action) {
      this.decisionSystem.submitDecision('player', action);
    }
  }

  /**
   * 获取UI状态
   */
  getUIState(): any {
    const snapshot = this.gameState.snapshot();
    const playerSnapshot = this.playerHorse?.getSnapshot();

    return {
      phase: snapshot.phase,
      elapsedTime: snapshot.elapsedTime / 1000,
      remainingTime: snapshot.remainingTime,
      player: playerSnapshot,
      opponents: this.aiPlayers.map(ai => ai.horse.getSnapshot()),
      trackLength: this.track?.totalLength || 500,
      currentDecision: this.decisionSystem.getCurrentDecision(),
      decisionTimeRemaining: this.decisionSystem.getDecisionRemainingTime(),
      availableActions: this.gameState.getAvailableActions()
    };
  }

  /**
   * 注册UI回调
   */
  onUI(callbacks: {
    onDecisionRequired?: (actions: any[]) => void;
    onGameStateUpdate?: (state: any) => void;
    onRaceEnd?: (results: any[]) => void;
  }): void {
    this.onDecisionRequired = callbacks.onDecisionRequired;
    this.onGameStateUpdate = callbacks.onGameStateUpdate;
    this.onRaceEnd = callbacks.onRaceEnd;
  }

  /**
   * 清理
   */
  dispose(): void {
    this.track?.destroy();
    this.playerHorse?.destroy();
    this.aiPlayers.forEach(ai => ai.horse.destroy());
    this.gameState.reset();
  }
}
