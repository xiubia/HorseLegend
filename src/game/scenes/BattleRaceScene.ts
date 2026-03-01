// BattleRaceScene - 心理博弈赛马场景
// 整合GeminiRacer、BattleUI实现完整的博弈比赛体验

import * as THREE from 'three';
import type { Engine } from '../../engine/Engine';
import type { GameScene } from '../../engine/SceneManager';
import { Horse } from '../../entities/Horse';
import { HUD } from '../../ui/HUD';
import { BattleUI, PlayerChoice } from '../../ui/BattleUI';
import { GeminiRacer, RACE_ACTIONS, RoundResult } from '../../ai/GeminiRacer';
import { AIPersonality, RaceContext } from '../../ai/prompts/race_prompt';
import { getOpponentByDifficulty, AI_OPPONENTS } from '../../ai/AIPersonality';
import { playerMemory } from '../../ai/PlayerMemory';
import { getPlayerProgress } from '../../data/PlayerProgress';

/**
 * 比赛结果
 */
export interface BattleRaceResult {
  winner: 'player' | 'ai' | 'draw';
  playerDistance: number;
  aiDistance: number;
  totalRounds: number;
  playerBluffSuccessRate: number;
  aiPredictionRate: number;
}

/**
 * 场景回调
 */
export interface BattleRaceCallbacks {
  onRaceEnd: (result: BattleRaceResult) => void;
}

/**
 * 博弈赛马场景
 */
export class BattleRaceScene implements GameScene {
  private engine: Engine;
  private hud: HUD;
  private callbacks: BattleRaceCallbacks;

  // UI
  private battleUI: BattleUI | null = null;

  // AI
  private geminiRacer: GeminiRacer | null = null;
  private aiPersonality: AIPersonality | null = null;

  // 实体
  private playerHorse: Horse | null = null;
  private aiHorse: Horse | null = null;

  // 赛道
  private trackObjects: THREE.Object3D[] = [];
  private readonly TRACK_LENGTH = 500;
  private readonly TRACK_WIDTH = 12;

  // 比赛状态
  private isInitialized = false;
  private isRacing = false;
  private isPaused = false;

  // 时间
  private remainingTime = 60;
  private readonly RACE_DURATION = 60;
  private readonly ROUND_INTERVAL = 10; // 每10秒一个博弈回合
  private timeSinceLastRound = 0;
  private currentRound = 0;

  // 位置和速度
  private playerDistance = 0;
  private aiDistance = 0;
  private playerBaseSpeed = 10;
  private aiBaseSpeed = 10;
  private playerSpeedMultiplier = 1.0;
  private aiSpeedMultiplier = 1.0;
  private playerStamina = 100;
  private aiStamina = 100;

  // 当前行动
  private playerCurrentAction = 'cruise';
  private aiCurrentAction = 'cruise';

  // 统计
  private roundResults: RoundResult[] = [];

  // Gemini API Key
  private apiKey: string;

  constructor(engine: Engine, hud: HUD, callbacks: BattleRaceCallbacks, apiKey: string) {
    this.engine = engine;
    this.hud = hud;
    this.callbacks = callbacks;
    this.apiKey = apiKey;
  }

  /**
   * 设置难度（选择AI对手）
   */
  setDifficulty(difficulty: number): void {
    this.aiPersonality = getOpponentByDifficulty(difficulty);
  }

  /**
   * 直接设置AI对手
   */
  setAIOpponent(personality: AIPersonality): void {
    this.aiPersonality = personality;
  }

  /**
   * 初始化场景
   */
  onEnter(engine: Engine): void {
    this.engine = engine;
  }

  onExit(): void {
    this.onDestroy();
  }

  onInit(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 清空世界
    this.engine.world.clear();

    // 默认AI对手
    if (!this.aiPersonality) {
      this.aiPersonality = AI_OPPONENTS[1]; // 热血新星（最容易）
    }

    // 初始化GeminiRacer
    this.geminiRacer = new GeminiRacer(this.aiPersonality, this.apiKey);

    // 初始化BattleUI
    this.battleUI = new BattleUI(document.body, {
      onPlayerChoice: (choice) => this.handlePlayerChoice(choice),
      onRoundComplete: () => this.resumeRace()
    });
    this.battleUI.setAIOpponent(this.aiPersonality);

    // 开始记录
    playerMemory.startNewRace(this.aiPersonality.name);

    // 创建环境
    this.createEnvironment();
    this.createTrack();

    // 创建马匹
    this.createHorses();

    // 设置相机
    this.setupCamera();

    // 开始比赛
    this.startRace();
  }

  /**
   * 创建环境
   */
  private createEnvironment(): void {
    // 天空盒颜色
    this.engine.world.scene.background = new THREE.Color(0x87CEEB);

    // 光照
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.engine.world.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    this.engine.world.scene.add(directionalLight);

    // 地面
    const groundGeometry = new THREE.PlaneGeometry(200, this.TRACK_LENGTH + 200);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = this.TRACK_LENGTH / 2;
    ground.receiveShadow = true;
    this.engine.world.scene.add(ground);
  }

  /**
   * 创建赛道
   */
  private createTrack(): void {
    // 赛道地面
    const trackGeometry = new THREE.PlaneGeometry(this.TRACK_WIDTH, this.TRACK_LENGTH);
    const trackMaterial = new THREE.MeshLambertMaterial({ color: 0xD2691E });
    const track = new THREE.Mesh(trackGeometry, trackMaterial);
    track.rotation.x = -Math.PI / 2;
    track.position.y = 0.01;
    track.position.z = this.TRACK_LENGTH / 2;
    this.engine.world.scene.add(track);
    this.trackObjects.push(track);

    // 赛道边线
    const lineGeometry = new THREE.PlaneGeometry(0.3, this.TRACK_LENGTH);
    const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });

    const leftLine = new THREE.Mesh(lineGeometry, lineMaterial);
    leftLine.rotation.x = -Math.PI / 2;
    leftLine.position.set(-this.TRACK_WIDTH / 2, 0.02, this.TRACK_LENGTH / 2);
    this.engine.world.scene.add(leftLine);

    const rightLine = new THREE.Mesh(lineGeometry, lineMaterial);
    rightLine.rotation.x = -Math.PI / 2;
    rightLine.position.set(this.TRACK_WIDTH / 2, 0.02, this.TRACK_LENGTH / 2);
    this.engine.world.scene.add(rightLine);

    // 中线
    const centerLine = new THREE.Mesh(
      new THREE.PlaneGeometry(0.1, this.TRACK_LENGTH),
      new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.5 })
    );
    centerLine.rotation.x = -Math.PI / 2;
    centerLine.position.set(0, 0.02, this.TRACK_LENGTH / 2);
    this.engine.world.scene.add(centerLine);

    // 起点线
    const startLine = new THREE.Mesh(
      new THREE.PlaneGeometry(this.TRACK_WIDTH, 1),
      new THREE.MeshBasicMaterial({ color: 0xFFFFFF })
    );
    startLine.rotation.x = -Math.PI / 2;
    startLine.position.set(0, 0.03, 0);
    this.engine.world.scene.add(startLine);
  }

  /**
   * 创建马匹
   */
  private createHorses(): void {
    const progress = getPlayerProgress();

    // 玩家马匹（左侧）
    this.playerHorse = new Horse('battle_player', {
      id: 'battle_player',
      name: '玩家',
      bodyColor: '#8B4513',
      maneColor: '#4A2500',
    });
    this.playerHorse.addToScene(this.engine.world.scene);
    this.playerHorse.setPosition(-2, 0, 0);
    this.playerHorse.speedLevel = progress.speedLevel;
    this.playerBaseSpeed = 5 + progress.speedLevel * 0.5;

    // AI马匹（右侧）
    this.aiHorse = new Horse('battle_ai', {
      id: 'battle_ai',
      name: this.aiPersonality?.name || 'AI',
      bodyColor: '#2F4F4F',
      maneColor: '#1A2A2A',
    });
    this.aiHorse.addToScene(this.engine.world.scene);
    this.aiHorse.setPosition(2, 0, 0);
    this.aiHorse.speedLevel = progress.speedLevel; // AI与玩家同等级
    this.aiBaseSpeed = this.playerBaseSpeed;
  }

  /**
   * 设置相机
   */
  private setupCamera(): void {
    this.engine.camera.position.set(0, 8, -15);
    this.engine.camera.lookAt(0, 0, 10);
  }

  /**
   * 开始比赛
   */
  private startRace(): void {
    this.isRacing = true;
    this.isPaused = false;
    this.remainingTime = this.RACE_DURATION;
    this.timeSinceLastRound = 0;
    this.currentRound = 0;

    this.playerDistance = 0;
    this.aiDistance = 0;
    this.playerStamina = 100;
    this.aiStamina = 100;

    // 显示AI信息
    this.battleUI?.showAIInfo();

    // 显示开始消息
    this.hud.showMessage(`对手: ${this.aiPersonality?.name}`, 2000);

    // 3秒后开始第一回合
    setTimeout(() => {
      this.triggerBattleRound();
    }, 3000);
  }

  /**
   * 触发博弈回合
   */
  private triggerBattleRound(): void {
    if (!this.isRacing) return;

    this.currentRound++;
    this.isPaused = true;

    // 显示决策面板
    this.battleUI?.showDecisionPanel(5);
  }

  /**
   * 处理玩家选择
   */
  private async handlePlayerChoice(choice: PlayerChoice): Promise<void> {
    if (!this.geminiRacer || !this.battleUI) return;

    // 显示加载
    this.battleUI.showLoading('AI正在思考...');

    // 构建比赛上下文
    const context: RaceContext = {
      progress: (this.remainingTime / this.RACE_DURATION) * 100,
      aiPosition: this.aiDistance,
      aiStamina: this.aiStamina,
      playerPosition: this.playerDistance,
      playerStamina: this.playerStamina,
      gap: this.aiDistance - this.playerDistance,
      remainingTime: this.remainingTime
    };

    try {
      // 调用AI
      const result = await this.geminiRacer.playRound(context, choice.action, choice.shout);

      // 应用行动效果
      this.applyActions(choice.action, result.aiAction);

      // 记录
      this.roundResults.push(result);
      playerMemory.recordRound({
        shout: choice.shout,
        action: choice.action,
        wasBluff: result.playerWasBluffing,
        aiResponse: result.aiResponse,
        aiAction: result.aiAction,
        aiPredictedCorrectly: result.aiPredictedCorrectly
      });

      // 隐藏加载，显示结果
      this.battleUI.hideLoading();
      this.battleUI.showRoundResult(result, 3000);

    } catch (error) {
      console.error('AI decision failed:', error);
      this.battleUI.hideLoading();

      // 使用默认AI响应
      this.applyActions(choice.action, 'cruise');
      this.resumeRace();
    }
  }

  /**
   * 应用行动效果
   */
  private applyActions(playerAction: string, aiAction: string): void {
    this.playerCurrentAction = playerAction;
    this.aiCurrentAction = aiAction;

    // 玩家行动
    const playerActionData = RACE_ACTIONS[playerAction as keyof typeof RACE_ACTIONS];
    if (playerActionData) {
      this.playerSpeedMultiplier = playerActionData.speed;
      this.playerStamina = Math.max(0, Math.min(100, this.playerStamina + playerActionData.stamina));
    }

    // AI行动
    const aiActionData = RACE_ACTIONS[aiAction as keyof typeof RACE_ACTIONS];
    if (aiActionData) {
      this.aiSpeedMultiplier = aiActionData.speed;
      this.aiStamina = Math.max(0, Math.min(100, this.aiStamina + aiActionData.stamina));
    }
  }

  /**
   * 恢复比赛
   */
  private resumeRace(): void {
    this.isPaused = false;
    this.timeSinceLastRound = 0;
  }

  /**
   * 更新
   */
  onUpdate(deltaTime: number): void {
    if (!this.isRacing || this.isPaused) return;

    // 更新时间
    this.remainingTime -= deltaTime;
    this.timeSinceLastRound += deltaTime;

    // 检查是否触发新回合
    if (this.timeSinceLastRound >= this.ROUND_INTERVAL && this.remainingTime > 5) {
      this.triggerBattleRound();
      return;
    }

    // 更新位置
    this.updatePositions(deltaTime);

    // 更新马匹动画
    this.updateHorses(deltaTime);

    // 更新相机
    this.updateCamera();

    // 更新HUD
    this.updateHUD();

    // 检查结束
    if (this.remainingTime <= 0) {
      this.endRace();
    }
  }

  /**
   * 更新位置
   */
  private updatePositions(deltaTime: number): void {
    // 体力影响速度
    const playerStaminaFactor = this.playerStamina > 20 ? 1 : 0.7;
    const aiStaminaFactor = this.aiStamina > 20 ? 1 : 0.7;

    // 计算实际速度
    const playerSpeed = this.playerBaseSpeed * this.playerSpeedMultiplier * playerStaminaFactor;
    const aiSpeed = this.aiBaseSpeed * this.aiSpeedMultiplier * aiStaminaFactor;

    // 更新距离
    this.playerDistance += playerSpeed * deltaTime;
    this.aiDistance += aiSpeed * deltaTime;

    // 更新马匹位置
    if (this.playerHorse) {
      this.playerHorse.setPosition(-2, 0, this.playerDistance);
      this.playerHorse.currentProgress = this.playerDistance;
    }

    if (this.aiHorse) {
      this.aiHorse.setPosition(2, 0, this.aiDistance);
      this.aiHorse.currentProgress = this.aiDistance;
    }
  }

  /**
   * 更新马匹
   */
  private updateHorses(deltaTime: number): void {
    this.playerHorse?.update(deltaTime);
    this.aiHorse?.update(deltaTime);
  }

  /**
   * 更新相机
   */
  private updateCamera(): void {
    const avgZ = (this.playerDistance + this.aiDistance) / 2;

    this.engine.camera.position.x = 0;
    this.engine.camera.position.y = 8;
    this.engine.camera.position.z = avgZ - 15;

    this.engine.camera.lookAt(0, 1, avgZ + 10);
  }

  /**
   * 更新HUD
   */
  private updateHUD(): void {
    // 使用现有HUD显示基本信息
    this.hud.updateRaceStatus({
      remainingTime: this.remainingTime,
      distance: this.playerDistance,
      currentSpeed: this.playerBaseSpeed * this.playerSpeedMultiplier,
      speedLevel: getPlayerProgress().speedLevel,
      trophiesEarned: 0,
      nextMilestone: 100,
      nextMilestoneProgress: this.playerDistance / 100
    });
  }

  /**
   * 结束比赛
   */
  private endRace(): void {
    this.isRacing = false;

    // 隐藏AI信息
    this.battleUI?.hideAIInfo();

    // 计算结果
    const winner = this.playerDistance > this.aiDistance ? 'player' :
      this.aiDistance > this.playerDistance ? 'ai' : 'draw';

    const bluffSuccessCount = this.roundResults.filter(r =>
      r.playerWasBluffing && !r.aiPredictedCorrectly
    ).length;
    const bluffAttempts = this.roundResults.filter(r => r.playerWasBluffing).length;

    const aiCorrectCount = this.roundResults.filter(r => r.aiPredictedCorrectly).length;

    const result: BattleRaceResult = {
      winner,
      playerDistance: this.playerDistance,
      aiDistance: this.aiDistance,
      totalRounds: this.roundResults.length,
      playerBluffSuccessRate: bluffAttempts > 0 ? bluffSuccessCount / bluffAttempts : 0,
      aiPredictionRate: this.roundResults.length > 0 ? aiCorrectCount / this.roundResults.length : 0
    };

    // 记录比赛结果
    playerMemory.endRace(winner, this.playerDistance, this.aiDistance);

    // 显示结果
    this.showFinalResult(result);
  }

  /**
   * 显示最终结果
   */
  private showFinalResult(result: BattleRaceResult): void {
    const winText = result.winner === 'player' ? '🎉 你赢了！' :
      result.winner === 'ai' ? '😢 AI获胜' : '🤝 平局';

    const gap = Math.abs(result.playerDistance - result.aiDistance).toFixed(1);

    this.hud.showMessage(`
      ${winText}
      <br/>
      你: ${result.playerDistance.toFixed(1)}米
      <br/>
      AI: ${result.aiDistance.toFixed(1)}米
      <br/>
      差距: ${gap}米
    `, 5000);

    // 5秒后回调
    setTimeout(() => {
      this.callbacks.onRaceEnd(result);
    }, 5000);
  }

  /**
   * 销毁场景
   */
  onDestroy(): void {
    this.battleUI?.dispose();

    for (const obj of this.trackObjects) {
      this.engine.world.scene.remove(obj);
    }
    this.trackObjects = [];

    this.playerHorse?.destroy();
    this.aiHorse?.destroy();

    this.isInitialized = false;
    this.isRacing = false;
  }
}
