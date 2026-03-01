// AI读心跑酷场景 - 无限跑酷 + AI异步生成赛道

import * as THREE from 'three';
import type { Engine } from '../../engine/Engine';
import type { GameScene } from '../../engine/SceneManager';
import { Horse } from '../../entities/Horse';
import { HUD } from '../../ui/HUD';
import { ChunkManager } from '../ChunkManager';
import { PlayerBehaviorTracker } from '../../systems/PlayerBehaviorTracker';
import { getPlayerProgress } from '../../data/PlayerProgress';
import { getTheme, ThemeDef, ParticleDef, DEFAULT_THEME } from '../../ai/ThemeRegistry';
import { CardSystem } from '../../systems/CardSystem';
import { showCardPicker } from '../../ui/CardPickerUI';
import { getMountById } from '../../data/MountRegistry';
import { getTalentValue } from '../../data/TalentRegistry';
import { getTrailById } from '../../data/TrailRegistry';
import { TrailEffect } from '../../entities/TrailEffect';
import { ParkourConfig } from '../../data/types/GameTypes';
import { getTotalTrainerBonuses } from '../../data/TrainerRegistry';
import { Pet } from '../../entities/Pet';
import { getPetById, getPetSpeedBonus } from '../../data/PetRegistry';

/**
 * 跑酷结果
 */
export interface ParkourResult {
  distance: number;
  trophies: number;
  isNewRecord: boolean;
  milestones: number[];
  aiStyle: string; // AI对玩家的评价
}

/**
 * 场景回调
 */
export interface ParkourSceneCallbacks {
  onEnd: (result: ParkourResult) => void;
}

// 跑酷速度常量
const PARKOUR_INITIAL_SPEED_LEVEL = 12;    // 初始速度等级 => ~11 m/s
const PARKOUR_MAX_SPEED_LEVEL = 50;        // 最高速度等级 => ~30 m/s
const PARKOUR_SPEED_RAMP = 0.5;            // 每秒增加的速度等级
const PARKOUR_LATERAL_SPEED = 16;          // 横向闪避速度（同步提高，匹配更高前进速度）

// ============ AI 存在感：本地回退文本库 ============

const LOCAL_COMMENTS: Record<string, string[]> = {
  leanLeft: ['你又往左了...', '右边很舒服？', '我在左边等你', '又是左边'],
  leanRight: ['又往右？', '右边是你的舒适区', '试试左边', '右边有坑哦'],
  nearMiss: ['差一点...', '运气不错', 'tch...', '下次不会这么幸运', '可惜...'],
  speedMilestone: ['你在加速', '快到极限了', '还能更快？', '速度不错'],
  coinStreak: ['贪心...', '金币比命重要？', '被诱饵吸引了？', '目标明确啊'],
  afterCrash: ['害怕了？', '冷静一下', '摔疼了？', '吸取教训了吗'],
  styleChange: ['你变了...', '想骗我？', '突然转性了？', '模式切换？'],
};

const LOCAL_NARRATIONS: Record<string, string[]> = {
  forest: ['让我把路藏起来...', '树多了，眼花了吧'],
  night: ['关灯了', '看不见？那就对了'],
  volcano: ['升温了，小心', '热不热？'],
  snow: ['冷静一下吧', '冻住你'],
  cherry: ['别被美景分心', '花开了，路没了'],
  desert: ['干燥...', '沙子进眼了？'],
  sunset: ['天黑前赶路', '余晖中的陷阱'],
  meadow: ['轻松一下？别想了', '草原也有坑'],
  crystal: ['水晶碎了别怪我', '在洞穴迷路了？'],
  neon: ['霓虹灯晃花眼了吧', '都市丛林...'],
  underwater: ['别淹死了', '气泡里藏着陷阱'],
  ancient: ['远古的诅咒...', '废墟中的秘密'],
  cloud: ['踩空就完了', '云端可没有护栏'],
  lava: ['温度还行吗？', '岩浆比你快'],
};

const LOCAL_ANALYSIS: Record<string, string> = {
  safe: '你太谨慎了',
  aggressive: '你在冒险',
  erratic: '看不透你',
  balanced: '分析中...',
};

// AI 评论冷却常量
const COMMENT_GLOBAL_COOLDOWN = 4;   // 全局冷却 4 秒
const COMMENT_CATEGORY_COOLDOWN = 8; // 同类冷却 8 秒

/**
 * AI读心跑酷场景
 */
export class ParkourScene implements GameScene {
  private engine: Engine;
  private hud: HUD;
  private callbacks: ParkourSceneCallbacks;

  // 核心系统
  private chunkManager!: ChunkManager;
  private tracker!: PlayerBehaviorTracker;

  // 实体
  private playerHorse: Horse | null = null;
  private trailEffect: TrailEffect | null = null;
  private petEntities: Pet[] = [];

  // 状态
  private isInitialized = false;
  private isRunning = false;
  private isGameOver = false;
  private distance = 0;
  private startTime = 0;

  // 跑酷速度系统（独立于progress.speedLevel）
  private parkourSpeedLevel = PARKOUR_INITIAL_SPEED_LEVEL;

  // 收集物计分
  private collectibleScore = 0;

  // 水坑减速
  private waterSlowdownTimer = 0;

  // 复活无敌保护计时器
  private reviveInvincibleTimer = 0;

  // 相机
  private cameraAngleY = 0;
  private isMouseDown = false;
  private lastMouseX = 0;

  // 操作
  private readonly BASE_TRACK_HALF_WIDTH = 3.5;

  // 卡牌系统
  private cardSystem!: CardSystem;
  private isPickingCard = false;        // 正在选牌
  private cardPickerRemove: (() => void) | null = null;
  private prePickSpeedLevel = 0;        // 选牌前速度（用于恢复）
  private pendingGateZ: number | null = null; // 当前追踪的前方拱门 Z

  // UI元素
  private parkourUI: HTMLDivElement | null = null;
  private aiStatusUI: HTMLDivElement | null = null;
  private hintUI: HTMLDivElement | null = null;
  private effectBarUI: HTMLDivElement | null = null;
  private commentContainer: HTMLDivElement | null = null;  // AI 弹幕容器
  private narrationUI: HTMLDivElement | null = null;       // 场景旁白 UI

  // AI 存在感系统
  private commentQueue: string[] = [];                     // AI 评论队列
  private lastCommentTime: number = 0;                     // 全局评论冷却时间戳
  private commentCooldowns: Map<string, number> = new Map(); // 分类冷却
  private nearMissFlashList: { mesh: any; timer: number; originalColors: Map<any, number> }[] = []; // 闪红障碍
  private currentAIAnalysis: string = '分析中...';         // 当前 AI 分析文本
  private currentAIConfidence: number = 0;                 // 当前 AI 信心度
  private lastNarrationTheme: string = '';                 // 上次旁白对应的主题
  private prevStyle: string = '';                          // 上一次行为风格（用于检测变化）
  private coinStreakCount: number = 0;                     // 连续收集金币计数
  private lastSpeedMilestone: number = 0;                  // 上一个速度里程碑
  private timeSinceLastCrash: number = 0;                  // 距上次碰撞后的时间
  private leanTimer: number = 0;                           // 连续偏向计时
  private leanSide: string = '';                           // 连续偏向方向
  private deathEvalText: string = '';                      // AI 死亡评价文本（异步填充）

  // 主题过渡
  private currentThemeId: string = 'meadow';
  private targetTheme: ThemeDef = DEFAULT_THEME;
  private ambientLight: THREE.AmbientLight | null = null;
  private directionalLight: THREE.DirectionalLight | null = null;

  // 粒子系统
  private particleSystem: THREE.Points | null = null;
  private particlePositions: Float32Array | null = null;
  private particleDef: ParticleDef | null = null;

  // 玩家自定义跑道配置
  private parkourConfig: ParkourConfig | undefined;

  // 加载过渡 UI
  private loadingUI: HTMLDivElement | null = null;

  // 鼠标事件绑定
  private boundOnMouseDown: (e: MouseEvent) => void;
  private boundOnMouseUp: (e: MouseEvent) => void;
  private boundOnMouseMove: (e: MouseEvent) => void;

  constructor(engine: Engine, hud: HUD, callbacks: ParkourSceneCallbacks, config?: ParkourConfig) {
    this.engine = engine;
    this.hud = hud;
    this.callbacks = callbacks;
    this.parkourConfig = config;

    this.boundOnMouseDown = this.onMouseDown.bind(this);
    this.boundOnMouseUp = this.onMouseUp.bind(this);
    this.boundOnMouseMove = this.onMouseMove.bind(this);
  }

  // ============ Mouse Events ============

  private onMouseDown(e: MouseEvent): void {
    this.isMouseDown = true;
    this.lastMouseX = e.clientX;
  }

  private onMouseUp(): void {
    this.isMouseDown = false;
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.isMouseDown) return;
    const deltaX = e.clientX - this.lastMouseX;
    this.lastMouseX = e.clientX;
    this.cameraAngleY += deltaX * 0.005;
  }

  // ============ Scene Interface ============

  onEnter(engine: Engine): void {
    this.engine = engine;
  }

  onExit(): void {
    this.onDestroy();
  }

  onInit(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Clear world
    this.engine.world.clear();

    // Reset state
    this.distance = 0;
    this.isRunning = false;
    this.isGameOver = false;
    this.startTime = 0;
    this.parkourSpeedLevel = PARKOUR_INITIAL_SPEED_LEVEL;
    this.collectibleScore = 0;
    this.waterSlowdownTimer = 0;
    this.reviveInvincibleTimer = 0;
    this.currentThemeId = 'meadow';
    this.targetTheme = DEFAULT_THEME;
    this.updateParticles(null); // 清理旧粒子
    this.isPickingCard = false;
    this.pendingGateZ = null;
    if (this.cardPickerRemove) { this.cardPickerRemove(); this.cardPickerRemove = null; }

    // 重置 AI 存在感系统
    this.commentQueue = [];
    this.lastCommentTime = 0;
    this.commentCooldowns.clear();
    this.nearMissFlashList = [];
    this.currentAIAnalysis = '分析中...';
    this.currentAIConfidence = 0;
    this.lastNarrationTheme = '';
    this.prevStyle = '';
    this.coinStreakCount = 0;
    this.lastSpeedMilestone = 0;
    this.timeSinceLastCrash = 0;
    this.leanTimer = 0;
    this.leanSide = '';
    this.deathEvalText = '';

    // 卡牌系统 — 每局开始前强制创建全新实例，确保所有 buff 彻底清除
    if (this.cardSystem) {
      this.cardSystem.reset(); // 先移除旧效果，防止 remove 回调泄漏
    }
    this.cardSystem = new CardSystem();

    // 天赋：重生档位 — 给予初始复活次数
    {
      const progress = getPlayerProgress();
      const talentRevives = getTalentValue('revive', progress.getTalentLevel('revive'));
      if (talentRevives > 0) {
        const ctx = this.cardSystem.getContext();
        ctx.reviveCount += talentRevives;
      }
    }

    // Hide ALL existing HUD panels (stable HUD, trophy panel, etc.)
    this.hideAllHUD();

    // Sky - match RaceScene style
    this.engine.world.scene.background = new THREE.Color(0x88CCFF);
    this.engine.world.scene.fog = new THREE.Fog(0x88CCFF, 40, 120);

    // Environment
    this.createEnvironment();

    // Init Systems
    this.tracker = new PlayerBehaviorTracker();
    this.chunkManager = new ChunkManager(this.engine.world.scene);
    this.chunkManager.setTracker(this.tracker);
    this.chunkManager.resetGates();

    // 传递自定义配置到 ChunkManager 和 AI
    if (this.parkourConfig) {
      this.chunkManager.setParkourConfig(this.parkourConfig);
    }

    this.chunkManager.init();

    // Player
    this.createPlayerHorse();

    // Pets
    this.createPets();

    // Camera
    this.setupCamera();

    // Mouse events
    document.addEventListener('mousedown', this.boundOnMouseDown);
    document.addEventListener('mouseup', this.boundOnMouseUp);
    document.addEventListener('mousemove', this.boundOnMouseMove);

    // UI
    this.createParkourUI();

    // 立即测试 AI 连接（不阻塞游戏启动）
    this.testAIConnectionAsync();

    // 如果有自定义配置，显示加载过渡然后开始
    if (this.parkourConfig && this.parkourConfig.mapDescription) {
      this.showLoadingTransition(() => {
        this.startRunning();
      });
    } else {
      // 直接开始，无需倒计时
      this.startRunning();
    }
  }

  /**
   * 异步测试 AI 连接，快速更新状态指示器（不阻塞游戏）
   */
  private testAIConnectionAsync(): void {
    const architect = this.chunkManager.getArchitect();
    if (!architect.hasApiKey) return; // 没配 key，不测试

    architect.testConnection().then(result => {
      architect.lastConnectionOk = result.ok;
      // 立即刷新 UI 状态
      if (this.aiStatusUI) {
        if (result.ok) {
          this.aiStatusUI.innerHTML = `<span style="color:#4caf50;">🟢 AI 已连接</span><br><span style="color:#888; font-size:11px;">${result.latencyMs}ms</span>`;
          this.aiStatusUI.style.borderColor = 'rgba(76,175,80,0.3)';
        } else {
          this.aiStatusUI.innerHTML = `<span style="color:#ff4444;">❌ ${result.message}</span><br><span style="color:#888; font-size:11px;">本地算法回退</span>`;
          this.aiStatusUI.style.borderColor = 'rgba(255,68,68,0.3)';
        }
      }
    }).catch(() => {
      // 静默失败
    });
  }

  onUpdate(deltaTime: number): void {
    if (!this.isInitialized) return;
    if (this.isGameOver) return;

    // 相机始终跟随（倒计时期间也要更新，否则视角会卡住）
    this.updateCamera(deltaTime);

    if (this.isRunning) {
      // 卡牌效果倒计时
      this.cardSystem.tick(deltaTime);

      // 如果正在选牌，完全停止
      if (this.isPickingCard) {
        // 马匹静止：不更新 horse、不移动、不碰撞
        if (this.playerHorse) {
          this.playerHorse.setSpeedLevel(0);
          if (this.playerHorse.mesh) {
            this.playerHorse.mesh.rotation.z *= 0.9;
          }
        }
        // 相机保持当前位置不动（不更新）
        // chunk 保持更新（确保拱门动画继续播放）
        this.chunkManager.update(this.distance, deltaTime);
        this.updateParkourUI();
        this.updateEffectBar();
        return;
      }

      // Gradually increase speed over time
      this.parkourSpeedLevel = Math.min(
        PARKOUR_MAX_SPEED_LEVEL,
        this.parkourSpeedLevel + PARKOUR_SPEED_RAMP * deltaTime
      );

      // 水坑减速计时器
      if (this.waterSlowdownTimer > 0) {
        this.waterSlowdownTimer -= deltaTime;
      }
      // 复活无敌计时器
      if (this.reviveInvincibleTimer > 0) {
        this.reviveInvincibleTimer -= deltaTime;
      }

      // 卡牌效果影响速度
      const ctx = this.cardSystem.getContext();

      // Apply the parkour speed level to the horse (with water slowdown + card effects)
      if (this.playerHorse) {
        let effectiveLevel = this.parkourSpeedLevel;
        // 水坑减速
        if (this.waterSlowdownTimer > 0) effectiveLevel *= 0.5;
        // 卡牌速度倍率
        effectiveLevel *= ctx.speedMultiplier;
        this.playerHorse.setSpeedLevel(effectiveLevel);
      }

      // Update Player
      this.updatePlayer(deltaTime);

      // Update Telemetry
      if (this.playerHorse && this.playerHorse.mesh) {
        this.tracker.update(
          this.playerHorse.mesh.position.x,
          this.playerHorse.position.z,
          this.playerHorse.speed
        );
      }

      // 更新 AI 的卡牌效果信息
      const activeEffects = this.cardSystem.getActiveEffects();
      const architect = this.chunkManager.getArchitect();
      if (activeEffects.length > 0) {
        architect.activeCardEffects = activeEffects.map(e =>
          `${e.card.name}(${e.remainingTime < 0 ? 'permanent' : Math.ceil(e.remainingTime) + 's'})`
        ).join(', ');
      } else {
        architect.activeCardEffects = '';
      }

      // Update Chunks
      if (this.playerHorse) {
        this.chunkManager.update(this.playerHorse.position.z, deltaTime);

        // 主题过渡：根据当前所在 chunk 平滑切换场景氛围
        this.updateThemeTransition(deltaTime);
      }

      // 磁铁吸附金币
      if (ctx.magnetActive) {
        this.magnetAttractCoins();
      }

      // Collision Check (obstacles + water + collectibles)
      this.checkCollisions();
      this.checkCollectibles();

      // Update distance
      if (this.playerHorse) {
        this.distance = this.playerHorse.position.z;
      }

      // 卡牌触发检查：拱门选择站
      this.checkGateTrigger();

      // 雾距倍率
      this.applyFogMultiplier(ctx.fogMultiplier);

      // AI 存在感系统
      this.fetchAIComments();
      this.updateAIPresenceData();
      this.checkCommentTriggers(deltaTime);
      this.updateNearMissFlash(deltaTime);
      this.timeSinceLastCrash += deltaTime;

      // Update UI
      this.updateParkourUI();
      this.updateEffectBar();
    }
  }

  onDestroy(): void {
    // Remove mouse listeners
    document.removeEventListener('mousedown', this.boundOnMouseDown);
    document.removeEventListener('mouseup', this.boundOnMouseUp);
    document.removeEventListener('mousemove', this.boundOnMouseMove);

    // Remove card picker
    if (this.cardPickerRemove) { this.cardPickerRemove(); this.cardPickerRemove = null; }

    // Remove trail effect
    if (this.trailEffect) {
      this.trailEffect.dispose();
      this.trailEffect = null;
    }

    // Remove pets
    for (const pet of this.petEntities) {
      pet.destroy();
    }
    this.petEntities = [];

    // Remove particles
    this.updateParticles(null);

    // Remove ALL custom UI
    this.removeParkourUI();

    this.isInitialized = false;
  }

  /**
   * 显示加载过渡画面（AI 正在创造世界）
   */
  private showLoadingTransition(onComplete: () => void): void {
    // 注入动画 CSS
    if (!document.getElementById('parkour-loading-styles')) {
      const style = document.createElement('style');
      style.id = 'parkour-loading-styles';
      style.textContent = `
        @keyframes loadingSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes loadingPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes loadingFadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    this.loadingUI = document.createElement('div');
    this.loadingUI.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: radial-gradient(ellipse at center, rgba(20,10,40,0.95), rgba(0,0,0,0.98));
      z-index: 15000;
      display: flex; flex-direction: column; justify-content: center; align-items: center;
      font-family: 'Segoe UI', system-ui, sans-serif;
    `;

    // 马匹剪影（旋转图标）
    this.loadingUI.innerHTML = `
      <div style="font-size: 64px; animation: loadingSpin 2s linear infinite; margin-bottom: 24px;">
        🐴
      </div>
      <div style="font-size: 20px; color: #fff; font-weight: 700; margin-bottom: 12px;">
        AI 正在为你创造世界...
      </div>
      <div id="loading-status" style="font-size: 14px; color: #888; animation: loadingPulse 1.5s ease-in-out infinite;">
        生成跑道地形...
      </div>
    `;

    document.body.appendChild(this.loadingUI);

    // 进度模拟
    const statusEl = this.loadingUI.querySelector('#loading-status') as HTMLElement;
    const steps = ['生成出生点场景...', '构建跑道地形...', '布置障碍物...', '准备就绪！'];
    let stepIdx = 0;

    const interval = setInterval(() => {
      stepIdx++;
      if (stepIdx < steps.length && statusEl) {
        statusEl.textContent = steps[stepIdx];
      }
    }, 600);

    // 2.5秒后淡出并开始
    setTimeout(() => {
      clearInterval(interval);
      if (this.loadingUI) {
        this.loadingUI.style.animation = 'loadingFadeOut 0.5s ease forwards';
        setTimeout(() => {
          if (this.loadingUI) {
            this.loadingUI.remove();
            this.loadingUI = null;
          }
          onComplete();
        }, 500);
      } else {
        onComplete();
      }
    }, 2500);
  }

  /**
   * 清理所有跑酷 UI 元素（防止残留）
   */
  private removeParkourUI(): void {
    if (this.parkourUI) {
      this.parkourUI.remove();
      this.parkourUI = null;
    }
    if (this.aiStatusUI) {
      this.aiStatusUI.remove();
      this.aiStatusUI = null;
    }
    if (this.hintUI) {
      this.hintUI.remove();
      this.hintUI = null;
    }
    if (this.effectBarUI) {
      this.effectBarUI.remove();
      this.effectBarUI = null;
    }
    if (this.commentContainer) {
      this.commentContainer.remove();
      this.commentContainer = null;
    }
    if (this.narrationUI) {
      this.narrationUI.remove();
      this.narrationUI = null;
    }
    if (this.loadingUI) {
      this.loadingUI.remove();
      this.loadingUI = null;
    }
  }

  // ============ HUD Control ============

  /**
   * Hide all existing HUD panels from other modes (stable, race)
   */
  private hideAllHUD(): void {
    // Hide all HUD panels by querying the DOM IDs used by HUD.ts
    const panelIds = ['hud-status', 'hud-timer', 'hud-milestones', 'hud-message', 'hud-trophy',
      'hud-speedometer', 'hud-floating-indicator'];
    for (const id of panelIds) {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    }
    // Also try to hide anything the HUD may have created
    this.hud.setMode('race'); // This hides stable-specific panels
    // Then hide race-specific panels too
    this.hud.hideMessage();
  }

  // ============ Setup ============

  private createEnvironment(): void {
    const scene = this.engine.world.scene;

    // Ambient light（保存引用以便主题过渡时修改）
    this.ambientLight = new THREE.AmbientLight(0xffffff, DEFAULT_THEME.ambientIntensity);
    scene.add(this.ambientLight);

    // Directional light (sun)（保存引用）
    this.directionalLight = new THREE.DirectionalLight(DEFAULT_THEME.sunColor, DEFAULT_THEME.sunIntensity);
    this.directionalLight.position.set(10, 30, 20);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.width = 2048;
    this.directionalLight.shadow.mapSize.height = 2048;
    this.directionalLight.shadow.camera.far = 100;
    this.directionalLight.shadow.camera.left = -50;
    this.directionalLight.shadow.camera.right = 50;
    this.directionalLight.shadow.camera.top = 50;
    this.directionalLight.shadow.camera.bottom = -50;
    scene.add(this.directionalLight);

    // Sun sphere (matching RaceScene)
    const sunGeometry = new THREE.SphereGeometry(5, 16, 16);
    const sunMaterial = new THREE.MeshToonMaterial({ color: 0xFFFF00 });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.position.set(50, 80, 100);
    scene.add(sun);
  }

  private createPlayerHorse(): void {
    const progress = getPlayerProgress();
    const mount = getMountById(progress.getEquippedMount());

    this.playerHorse = new Horse('parkour_player', {
      id: mount.id,
      name: mount.name,
      bodyColor: mount.bodyColor,
      maneColor: mount.maneColor,
    });

    // 应用坐骑属性加成
    this.playerHorse.applyMountStats(mount);

    // 应用尾迹属性加成
    const trail = getTrailById(progress.getEquippedTrail());
    this.playerHorse.applyTrailStats(trail);

    // 创建尾迹特效
    this.trailEffect = new TrailEffect(this.engine.world.scene);
    this.trailEffect.setTrail(trail);

    // 应用天赋移速加成
    this.playerHorse.talentSpeedBonus = getTalentValue('speedBonus', progress.getTalentLevel('speedBonus'));

    this.playerHorse.playerId = 'player';
    this.playerHorse.playerName = 'You';
    this.playerHorse.isHuman = true;

    // Use parkour-specific speed level + talent starting speed bonus (includes trail start speed bonus)
    const trailStartBonus = trail.stats.startSpeedBonus;
    const startSpeedBonus = getTalentValue('startSpeed', progress.getTalentLevel('startSpeed')) + trailStartBonus;
    const adjustedInitialSpeed = Math.round(PARKOUR_INITIAL_SPEED_LEVEL * (1 + startSpeedBonus / 100));
    this.playerHorse.setSpeedLevel(adjustedInitialSpeed);

    // Create mesh
    const mesh = this.playerHorse.createMesh();
    mesh.position.set(0, 0, 5); // Start a few meters forward
    this.engine.world.scene.add(mesh);

    this.playerHorse.position.set(0, 0, 5);
    // Entity rotation stays (0,0,0) → syncMesh overwrites createMesh's PI → head faces +Z (forward) ✓
  }

  /**
   * 创建跟随宠物
   */
  private createPets(): void {
    const progress = getPlayerProgress();
    const equippedPets = progress.getEquippedPets();

    const offsets = [
      new THREE.Vector3(-1.5, 0, -2.5),
      new THREE.Vector3(0, 0, -3.5),
      new THREE.Vector3(1.5, 0, -2.5),
    ];

    // 计算宠物速度加成
    let totalBonus = 0;
    for (const petId of equippedPets) {
      const petDef = getPetById(petId);
      totalBonus += getPetSpeedBonus(petDef.speedMultiplier);
    }
    if (this.playerHorse) {
      this.playerHorse.applyPetStats(totalBonus);
    }

    for (let i = 0; i < equippedPets.length; i++) {
      const petDef = getPetById(equippedPets[i]);
      const pet = new Pet(petDef);
      pet.setFollowOffset(offsets[i] || offsets[0]);

      if (this.playerHorse) {
        const pos = this.playerHorse.position;
        pet.setPosition(pos.x + (offsets[i]?.x || 0), 0.5, pos.z + (offsets[i]?.z || 0));
      }

      pet.addToScene(this.engine.world.scene);
      this.petEntities.push(pet);
    }
  }

  /**
   * 更新宠物跟随
   */
  private updatePets(deltaTime: number): void {
    if (!this.playerHorse || this.petEntities.length === 0) return;
    const playerPos = this.playerHorse.position;
    const playerRotY = this.playerHorse.rotation.y;
    for (const pet of this.petEntities) {
      pet.setFollowTarget(playerPos, playerRotY);
      pet.update(deltaTime);
    }
  }

  private setupCamera(): void {
    this.engine.camera.fov = 65;
    this.engine.camera.updateProjectionMatrix();

    // 立即将相机放到马匹后方正确位置（避免倒计时期间视角异常）
    if (this.playerHorse) {
      const hz = this.playerHorse.position.z;
      this.engine.camera.position.set(0, 4, hz - 8);
      this.engine.camera.lookAt(0, 1, hz + 8);
    }
  }

  // ============ Countdown & Start ============

  private startCountdown(): void {
    let count = 3;

    const countdownDiv = document.createElement('div');
    countdownDiv.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      font-size: 80px; font-weight: bold; color: white; z-index: 2000;
      text-shadow: 0 0 20px rgba(0,255,136,0.8);
      font-family: 'Arial Black', sans-serif;
      transition: all 0.3s ease;
    `;
    document.body.appendChild(countdownDiv);

    const tick = () => {
      if (count > 0) {
        countdownDiv.textContent = `${count}`;
        countdownDiv.style.transform = 'translate(-50%, -50%) scale(1.5)';
        setTimeout(() => {
          countdownDiv.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 200);
        count--;
        setTimeout(tick, 1000);
      } else {
        countdownDiv.textContent = 'GO!';
        countdownDiv.style.color = '#00ff88';
        setTimeout(() => {
          countdownDiv.remove();
          this.startRunning();
        }, 500);
      }
    };

    tick();
  }

  private startRunning(): void {
    this.isRunning = true;
    this.startTime = Date.now();

    // 确保 buff 清零：重置速度等级到初始值（含天赋加成），卡牌上下文为干净状态
    const progress = getPlayerProgress();
    const trail = getTrailById(progress.getEquippedTrail());
    const trailStartBonus = trail.stats.startSpeedBonus;
    const startSpeedBonus = getTalentValue('startSpeed', progress.getTalentLevel('startSpeed')) + trailStartBonus;
    this.parkourSpeedLevel = Math.round(PARKOUR_INITIAL_SPEED_LEVEL * (1 + startSpeedBonus / 100));

    if (this.playerHorse) {
      this.playerHorse.setSpeedLevel(this.parkourSpeedLevel);
      this.playerHorse.startRunning();
    }
  }

  // ============ Player Update ============

  private updatePlayer(deltaTime: number): void {
    if (!this.playerHorse || !this.playerHorse.mesh) return;

    const input = this.engine.input;
    const ctx = this.cardSystem.getContext();

    // 动态赛道宽度（受卡牌效果影响）
    const trackHalfWidth = this.BASE_TRACK_HALF_WIDTH * ctx.trackWidthMultiplier;

    // Lateral movement
    const lateralSpeed = PARKOUR_LATERAL_SPEED + this.playerHorse.speed * 0.1;
    const rawInput = input.getAxis('horizontal');
    // 操控反转
    const inputDir = ctx.invertControls ? rawInput : -rawInput;
    const horizontal = inputDir;
    if (horizontal !== 0) {
      const newX = this.playerHorse.position.x + horizontal * lateralSpeed * deltaTime;
      this.playerHorse.position.x = Math.max(-trackHalfWidth, Math.min(trackHalfWidth, newX));
    }

    // Update horse physics
    this.playerHorse.update(deltaTime);

    // 更新尾迹特效
    if (this.trailEffect) {
      this.trailEffect.update(this.playerHorse.position, this.playerHorse.speed, deltaTime);
    }

    // 更新宠物跟随
    this.updatePets(deltaTime);

    // Visual lean
    if (horizontal !== 0) {
      this.playerHorse.mesh.rotation.z = -horizontal * 0.15;
    } else {
      this.playerHorse.mesh.rotation.z *= 0.9;
    }
  }

  // ============ Card System ============

  /**
   * 检查玩家是否经过拱门选择站
   */
  private checkGateTrigger(): void {
    if (this.isPickingCard || !this.playerHorse) return;

    // 获取前方最近的拱门
    const gateZ = this.chunkManager.getNextGateZ(this.distance - 2);
    if (gateZ === null) return;

    // 玩家经过拱门时触发
    if (this.distance >= gateZ) {
      this.chunkManager.consumeGate(gateZ);
      this.triggerCardPick();
    }
  }

  /**
   * 触发卡牌选择（拱门选择站）
   */
  private triggerCardPick(): void {
    if (this.isPickingCard) return;

    this.isPickingCard = true;
    this.prePickSpeedLevel = this.parkourSpeedLevel;

    // 完全停止马匹
    if (this.playerHorse) {
      this.playerHorse.setSpeedLevel(0);
      this.playerHorse.stopRunning();
    }

    // 生成手牌
    const telemetry = this.tracker.getTelemetry();
    const { cards, taunt } = this.cardSystem.generateHand(telemetry);

    // 显示卡牌 UI
    this.cardPickerRemove = showCardPicker(cards, taunt, (card) => {
      // 玩家选牌完毕
      this.cardSystem.applyCard(card);
      this.isPickingCard = false;
      this.cardPickerRemove = null;

      // 恢复速度 + 重新开始跑
      this.parkourSpeedLevel = this.prePickSpeedLevel;
      if (this.playerHorse) {
        this.playerHorse.setSpeedLevel(this.prePickSpeedLevel);
        this.playerHorse.startRunning();
      }

      // 选牌反馈
      const catLabel = card.category === 'buff' ? '增益' :
        card.category === 'reward' ? '奖励' : 'AI陷阱';
      this.showFloatingText(`${card.icon} ${card.name} (${catLabel})`, '#FFFFFF');

      // 显示 "GO!" 提示
      this.showGoPrompt();
    });
  }

  /**
   * 选牌结束后显示 "GO!" 提示
   */
  private showGoPrompt(): void {
    const goDiv = document.createElement('div');
    goDiv.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(1.5);
      font-size: 72px; font-weight: 900; color: #00ff88; z-index: 2000;
      text-shadow: 0 0 20px rgba(0,255,136,0.8), 0 4px 12px rgba(0,0,0,0.5);
      font-family: 'Arial Black', sans-serif;
      pointer-events: none;
      animation: goFadeOut 0.6s ease-out forwards;
    `;
    goDiv.textContent = 'GO!';
    document.body.appendChild(goDiv);

    // 添加动画 CSS
    if (!document.getElementById('parkour-go-anim')) {
      const style = document.createElement('style');
      style.id = 'parkour-go-anim';
      style.textContent = `
        @keyframes goFadeOut {
          0% { opacity: 1; transform: translate(-50%, -50%) scale(1.5); }
          60% { opacity: 1; transform: translate(-50%, -50%) scale(1.0); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        }
      `;
      document.head.appendChild(style);
    }

    setTimeout(() => goDiv.remove(), 600);
  }

  /**
   * 磁铁吸附附近金币
   */
  private magnetAttractCoins(): void {
    if (!this.playerHorse || !this.playerHorse.mesh) return;

    const collectibles = this.chunkManager.getCollectibles();
    const px = this.playerHorse.mesh.position.x;
    const pz = this.playerHorse.position.z;
    const magnetRange = 5.0; // 磁铁吸附范围 5m

    for (const col of collectibles) {
      if (col.collected || !col.mesh) continue;

      const dz = Math.abs(col.position.z - pz);
      if (dz > magnetRange) continue;

      const dx = Math.abs(px - col.position.x);
      if (dx > magnetRange) continue;

      // 向玩家移动
      const speed = 8; // 吸附速度
      const dt = 0.016;
      if (col.position.x < px) col.position.x += speed * dt;
      else col.position.x -= speed * dt;
      col.mesh.position.x = col.position.x;
    }
  }

  /**
   * 应用雾距倍率（卡牌迷雾效果）
   */
  private applyFogMultiplier(fogMul: number): void {
    if (!(this.engine.world.scene.fog instanceof THREE.Fog)) return;
    if (Math.abs(fogMul - 1.0) < 0.01) return; // 无变化

    const baseFar = this.targetTheme.fogFar;
    const baseNear = this.targetTheme.fogNear;
    const targetFar = baseFar * fogMul;
    const targetNear = baseNear * fogMul;

    const fog = this.engine.world.scene.fog;
    fog.far += (targetFar - fog.far) * 0.05;
    fog.near += (targetNear - fog.near) * 0.05;
  }

  /**
   * 更新效果栏 UI
   */
  private updateEffectBar(): void {
    const effects = this.cardSystem.getActiveEffects();

    if (effects.length === 0) {
      if (this.effectBarUI) {
        this.effectBarUI.style.display = 'none';
      }
      return;
    }

    // 确保效果栏存在
    if (!this.effectBarUI) {
      this.effectBarUI = document.createElement('div');
      this.effectBarUI.style.cssText = `
        position: fixed; top: 55px; left: 50%; transform: translateX(-50%);
        display: flex; gap: 8px; z-index: 1000;
        font-family: 'Segoe UI', system-ui, sans-serif;
      `;
      document.body.appendChild(this.effectBarUI);
    }

    this.effectBarUI.style.display = 'flex';

    // 构建效果图标
    const ctx = this.cardSystem.getContext();
    let html = '';
    for (const effect of effects) {
      // 特殊卡牌显示额外信息
      let extraInfo = '';
      if (effect.card.id === 'shield') {
        extraInfo = ` x${ctx.shieldCount}`;
      } else if (effect.card.id === 'revive') {
        extraInfo = ` x${ctx.reviveCount}`;
      }

      const timeLabel = effect.remainingTime < 0
        ? '∞'
        : `${Math.ceil(effect.remainingTime)}s`;
      const borderColor = effect.card.category === 'trap' ? '#FF4444' :
        effect.card.category === 'reward' ? '#FFD700' : '#4CAF50';
      html += `
        <div style="
          padding: 4px 10px;
          background: rgba(0,0,0,0.6);
          border: 2px solid ${borderColor};
          border-radius: 12px;
          color: white;
          font-size: 14px;
          backdrop-filter: blur(4px);
          white-space: nowrap;
        ">
          ${effect.card.icon}${extraInfo} <span style="font-size: 12px; color: #ccc;">${timeLabel}</span>
        </div>
      `;
    }
    this.effectBarUI.innerHTML = html;
  }

  // ============ AI 存在感系统 ============

  /**
   * 从 ChunkManager 获取新的 AI 评论并加入队列
   */
  private fetchAIComments(): void {
    const newComments = this.chunkManager.consumeComments();
    if (newComments.length > 0) {
      this.commentQueue.push(...newComments);
    }
  }

  /**
   * 更新 AI 存在感数据（分析、信心度）
   */
  private updateAIPresenceData(): void {
    if (!this.playerHorse) return;
    const data = this.chunkManager.getAIDataForCurrentChunk(this.playerHorse.position.z);
    if (data.analysis) {
      this.currentAIAnalysis = data.analysis;
    }
    if (data.confidence !== undefined) {
      this.currentAIConfidence = data.confidence;
    }
  }

  /**
   * 每帧检查 AI 评论触发条件
   */
  private checkCommentTriggers(deltaTime: number): void {
    const now = Date.now() / 1000;

    // 全局冷却检查
    if (now - this.lastCommentTime < COMMENT_GLOBAL_COOLDOWN) return;

    const telemetry = this.tracker.getTelemetry();
    if (telemetry.playTime < 5) return; // 游玩 5 秒后才开始评论

    // === 触发器 1：连续偏向同一侧 ===
    const currentSide = telemetry.laneBias < -0.3 ? 'right' : (telemetry.laneBias > 0.3 ? 'left' : 'center');
    if (currentSide !== 'center') {
      if (currentSide === this.leanSide) {
        this.leanTimer += deltaTime;
      } else {
        this.leanSide = currentSide;
        this.leanTimer = 0;
      }
      if (this.leanTimer > 3 && this.canShowComment('lean', now)) {
        const cat = currentSide === 'left' ? 'leanLeft' : 'leanRight';
        this.triggerComment(cat, now);
        this.leanTimer = 0;
        return;
      }
    } else {
      this.leanTimer = 0;
      this.leanSide = '';
    }

    // === 触发器 2：速度里程碑 ===
    if (this.playerHorse) {
      const speed = this.playerHorse.speed;
      const milestone = speed >= 25 ? 25 : (speed >= 20 ? 20 : (speed >= 15 ? 15 : 0));
      if (milestone > 0 && milestone > this.lastSpeedMilestone && this.canShowComment('speed', now)) {
        this.lastSpeedMilestone = milestone;
        this.triggerComment('speedMilestone', now);
        return;
      }
    }

    // === 触发器 3：碰撞后短暂无操作 ===
    if (this.timeSinceLastCrash > 0 && this.timeSinceLastCrash < 3 && this.canShowComment('crash', now)) {
      if (telemetry.crashCount > 0) {
        this.triggerComment('afterCrash', now);
        this.timeSinceLastCrash = 99; // 防止重复触发
        return;
      }
    }

    // === 触发器 4：行为风格变化 ===
    if (this.prevStyle && telemetry.style !== this.prevStyle && this.canShowComment('style', now)) {
      this.triggerComment('styleChange', now);
      this.prevStyle = telemetry.style;
      return;
    }
    this.prevStyle = telemetry.style;

    // === 触发器 5：连续收集金币（由 checkCollectibles 更新 coinStreakCount）===
    if (this.coinStreakCount >= 5 && this.canShowComment('coin', now)) {
      this.triggerComment('coinStreak', now);
      this.coinStreakCount = 0;
      return;
    }
  }

  /**
   * 检查某类评论是否冷却结束
   */
  private canShowComment(category: string, now: number): boolean {
    const lastTime = this.commentCooldowns.get(category) || 0;
    return now - lastTime >= COMMENT_CATEGORY_COOLDOWN;
  }

  /**
   * 触发一条评论：优先从 AI 队列取，否则从本地库随机
   */
  private triggerComment(category: string, now: number): void {
    let text: string | undefined;

    // 优先从 AI 评论队列取
    if (this.commentQueue.length > 0) {
      text = this.commentQueue.shift();
    }

    // 回退到本地预设
    if (!text) {
      const pool = LOCAL_COMMENTS[category];
      if (pool && pool.length > 0) {
        text = pool[Math.floor(Math.random() * pool.length)];
      }
    }

    if (text) {
      this.showAIComment(text);
      this.lastCommentTime = now;
      this.commentCooldowns.set(category, now);
    }
  }

  /**
   * 显示 AI 弹幕评论（右侧浮动，2秒消失）
   */
  private showAIComment(text: string): void {
    // 确保容器存在
    if (!this.commentContainer) {
      this.commentContainer = document.createElement('div');
      this.commentContainer.style.cssText = `
        position: fixed; top: 30%; right: 10px; z-index: 1500;
        display: flex; flex-direction: column; gap: 6px; align-items: flex-end;
        pointer-events: none;
      `;
      document.body.appendChild(this.commentContainer);
    }

    // 确保动画 CSS 存在
    if (!document.getElementById('ai-comment-anim')) {
      const style = document.createElement('style');
      style.id = 'ai-comment-anim';
      style.textContent = `
        @keyframes aiCommentSlideIn {
          0% { opacity: 0; transform: translateX(60px); }
          15% { opacity: 1; transform: translateX(0); }
          80% { opacity: 1; transform: translateX(0); }
          100% { opacity: 0; transform: translateX(30px); }
        }
      `;
      document.head.appendChild(style);
    }

    const el = document.createElement('div');
    el.style.cssText = `
      padding: 6px 14px;
      background: rgba(20, 0, 0, 0.75);
      border-left: 3px solid #ff4444;
      border-radius: 4px 12px 12px 4px;
      color: #ff8888;
      font-size: 14px;
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-weight: 600;
      backdrop-filter: blur(4px);
      white-space: nowrap;
      animation: aiCommentSlideIn 2.5s ease-out forwards;
    `;
    el.textContent = `AI: ${text}`;
    this.commentContainer.appendChild(el);

    // 限制同时显示的评论数量
    while (this.commentContainer.children.length > 3) {
      this.commentContainer.removeChild(this.commentContainer.children[0]);
    }

    setTimeout(() => {
      if (el.parentNode) el.remove();
    }, 2500);
  }

  /**
   * 显示场景旁白（屏幕中下方，渐隐 2.5 秒）
   */
  private showNarration(text: string): void {
    // 移除旧旁白
    if (this.narrationUI) {
      this.narrationUI.remove();
    }

    // 确保动画 CSS 存在
    if (!document.getElementById('ai-narration-anim')) {
      const style = document.createElement('style');
      style.id = 'ai-narration-anim';
      style.textContent = `
        @keyframes aiNarrationFade {
          0% { opacity: 0; transform: translate(-50%, 0) scale(0.9); }
          15% { opacity: 0.9; transform: translate(-50%, 0) scale(1); }
          75% { opacity: 0.9; }
          100% { opacity: 0; transform: translate(-50%, -10px) scale(1); }
        }
      `;
      document.head.appendChild(style);
    }

    this.narrationUI = document.createElement('div');
    this.narrationUI.style.cssText = `
      position: fixed; bottom: 25%; left: 50%; transform: translateX(-50%);
      padding: 10px 24px;
      background: rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 136, 0, 0.4);
      border-radius: 20px;
      color: #ffbb66;
      font-size: 18px;
      font-style: italic;
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-weight: 600;
      z-index: 1500;
      pointer-events: none;
      backdrop-filter: blur(4px);
      text-shadow: 0 1px 4px rgba(0,0,0,0.5);
      animation: aiNarrationFade 2.5s ease-out forwards;
    `;
    this.narrationUI.textContent = `— ${text}`;
    document.body.appendChild(this.narrationUI);

    const ref = this.narrationUI;
    setTimeout(() => {
      if (ref.parentNode) ref.remove();
      if (this.narrationUI === ref) this.narrationUI = null;
    }, 2500);
  }

  /**
   * 近闪躲障碍物闪红效果更新
   */
  private updateNearMissFlash(deltaTime: number): void {
    for (let i = this.nearMissFlashList.length - 1; i >= 0; i--) {
      const entry = this.nearMissFlashList[i];
      entry.timer -= deltaTime;
      if (entry.timer <= 0) {
        // 恢复原色
        entry.mesh.traverse?.((child: any) => {
          if (child.isMesh && child.material) {
            const origColor = entry.originalColors.get(child);
            if (origColor !== undefined) {
              child.material.color.setHex(origColor);
              child.material.emissive?.setHex(0x000000);
            }
          }
        });
        this.nearMissFlashList.splice(i, 1);
      }
    }
  }

  /**
   * 触发障碍物闪红效果
   */
  private flashObstacleRed(obsMesh: any): void {
    if (!obsMesh) return;

    const originalColors = new Map<any, number>();
    obsMesh.traverse?.((child: any) => {
      if (child.isMesh && child.material) {
        originalColors.set(child, child.material.color.getHex());
        child.material.color.setHex(0xff2222);
        if (child.material.emissive) {
          child.material.emissive.setHex(0xff0000);
        }
      }
    });

    this.nearMissFlashList.push({
      mesh: obsMesh,
      timer: 0.3,
      originalColors,
    });
  }

  // ============ Theme Transition ============

  /**
   * 检测当前 chunk 主题并平滑过渡场景氛围
   */
  private updateThemeTransition(deltaTime: number): void {
    if (!this.playerHorse) return;

    const newThemeId = this.chunkManager.getCurrentThemeId(this.playerHorse.position.z);

    // 主题发生变化时更新目标
    if (newThemeId !== this.currentThemeId) {
      this.currentThemeId = newThemeId;
      this.targetTheme = getTheme(newThemeId);
      console.log(`[Theme] 切换到: ${this.targetTheme.name} (${newThemeId})`);

      // 更新粒子系统
      this.updateParticles(this.targetTheme.particles || null);

      // === AI 场景旁白 ===
      if (newThemeId !== this.lastNarrationTheme) {
        this.lastNarrationTheme = newThemeId;
        // 优先使用 AI 返回的旁白
        const aiData = this.chunkManager.getAIDataForCurrentChunk(this.playerHorse.position.z);
        if (aiData.narration) {
          this.showNarration(aiData.narration);
        } else {
          // 回退到本地旁白库
          const pool = LOCAL_NARRATIONS[newThemeId];
          if (pool && pool.length > 0) {
            this.showNarration(pool[Math.floor(Math.random() * pool.length)]);
          }
        }
      }
    }

    // 平滑过渡（每帧 lerp）
    this.applyTheme(this.targetTheme, deltaTime);

    // 更新粒子动画
    this.animateParticles(deltaTime);
  }

  /**
   * 平滑应用主题到场景（天空、雾、光照、地面颜色）
   */
  private applyTheme(theme: ThemeDef, deltaTime: number): void {
    const scene = this.engine.world.scene;
    const lerpSpeed = 2.0 * deltaTime; // ~2s 完成过渡

    // 天空颜色
    if (scene.background instanceof THREE.Color) {
      const targetSky = new THREE.Color(theme.skyColor);
      scene.background.lerp(targetSky, lerpSpeed);
    }

    // 雾颜色和距离
    if (scene.fog instanceof THREE.Fog) {
      const targetFogColor = new THREE.Color(theme.fogColor);
      scene.fog.color.lerp(targetFogColor, lerpSpeed);
      scene.fog.near += (theme.fogNear - scene.fog.near) * lerpSpeed;
      scene.fog.far += (theme.fogFar - scene.fog.far) * lerpSpeed;
    }

    // 环境光强度
    if (this.ambientLight) {
      this.ambientLight.intensity += (theme.ambientIntensity - this.ambientLight.intensity) * lerpSpeed;
    }

    // 方向光颜色和强度
    if (this.directionalLight) {
      const targetSunColor = new THREE.Color(theme.sunColor);
      this.directionalLight.color.lerp(targetSunColor, lerpSpeed);
      this.directionalLight.intensity += (theme.sunIntensity - this.directionalLight.intensity) * lerpSpeed;
    }

    // 地面和草地颜色（跨 chunk 平滑过渡）
    this.chunkManager.lerpChunkMaterials(theme, lerpSpeed);
  }

  // ============ Particles ============

  /**
   * 创建或销毁粒子系统
   */
  private updateParticles(newDef: ParticleDef | null): void {
    // 移除旧粒子
    if (this.particleSystem) {
      this.engine.world.scene.remove(this.particleSystem);
      this.particleSystem.geometry.dispose();
      (this.particleSystem.material as THREE.PointsMaterial).dispose();
      this.particleSystem = null;
      this.particlePositions = null;
      this.particleDef = null;
    }

    if (!newDef) return;

    this.particleDef = newDef;
    const count = newDef.count;
    const positions = new Float32Array(count * 3);

    // 初始化粒子位置（围绕玩家的大范围区域）
    const pz = this.playerHorse ? this.playerHorse.position.z : 0;
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * newDef.spread * 2;     // x
      positions[i * 3 + 1] = Math.random() * 15;                         // y (0-15m 高)
      positions[i * 3 + 2] = pz + (Math.random() - 0.5) * newDef.spread * 2; // z
    }

    this.particlePositions = positions;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: newDef.color,
      size: newDef.size,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });

    this.particleSystem = new THREE.Points(geometry, material);
    this.engine.world.scene.add(this.particleSystem);
  }

  /**
   * 每帧更新粒子动画
   */
  private animateParticles(deltaTime: number): void {
    if (!this.particleSystem || !this.particlePositions || !this.particleDef) return;

    const positions = this.particlePositions;
    const def = this.particleDef;
    const count = positions.length / 3;
    const pz = this.playerHorse ? this.playerHorse.position.z : 0;
    const time = Date.now() * 0.001;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      switch (def.type) {
        case 'snow':
          // 雪花：匀速下落 + 轻微左右摆动
          positions[i3 + 1] -= def.speed * deltaTime;
          positions[i3] += Math.sin(time + i) * 0.3 * deltaTime;
          break;

        case 'petal':
          // 花瓣：缓慢下落 + 较大左右漂移
          positions[i3 + 1] -= def.speed * deltaTime;
          positions[i3] += Math.sin(time * 0.8 + i * 0.5) * 0.8 * deltaTime;
          positions[i3 + 2] += Math.cos(time * 0.6 + i * 0.3) * 0.3 * deltaTime;
          break;

        case 'firefly':
          // 萤火虫：缓慢随机漂浮
          positions[i3] += Math.sin(time * 0.5 + i * 1.7) * 0.5 * deltaTime;
          positions[i3 + 1] += Math.cos(time * 0.3 + i * 2.1) * 0.3 * deltaTime;
          positions[i3 + 2] += Math.sin(time * 0.4 + i * 1.3) * 0.5 * deltaTime;
          break;

        case 'ember':
        case 'spark':
          // 余烬/火花：向上飘起 + 随机晃动
          positions[i3 + 1] += def.speed * deltaTime;
          positions[i3] += Math.sin(time * 1.5 + i * 0.9) * 0.6 * deltaTime;
          break;

        case 'crystal':
        case 'neon':
          // 水晶光点/霓虹光点：缓慢随机漂浮
          positions[i3] += Math.sin(time * 0.4 + i * 1.5) * 0.3 * deltaTime;
          positions[i3 + 1] += Math.cos(time * 0.3 + i * 2.0) * 0.2 * deltaTime;
          positions[i3 + 2] += Math.sin(time * 0.5 + i * 1.1) * 0.3 * deltaTime;
          break;

        case 'bubble':
          // 气泡：向上缓慢漂浮 + 左右摆动
          positions[i3 + 1] += def.speed * deltaTime;
          positions[i3] += Math.sin(time * 0.6 + i * 0.8) * 0.4 * deltaTime;
          break;

        case 'dust':
          // 灰尘微粒：缓慢随机飘荡
          positions[i3] += Math.sin(time * 0.3 + i * 1.2) * 0.2 * deltaTime;
          positions[i3 + 1] += Math.cos(time * 0.2 + i * 0.9) * 0.1 * deltaTime;
          positions[i3 + 2] += Math.sin(time * 0.4 + i * 0.7) * 0.2 * deltaTime;
          break;

        case 'cloud':
          // 云雾：缓慢水平飘散
          positions[i3] += Math.sin(time * 0.2 + i * 0.5) * 0.4 * deltaTime;
          positions[i3 + 1] -= def.speed * 0.3 * deltaTime;
          positions[i3 + 2] += Math.cos(time * 0.3 + i * 0.4) * 0.3 * deltaTime;
          break;
      }

      // 超出范围的粒子重置到玩家附近
      if (positions[i3 + 1] < -1 || positions[i3 + 1] > 16) {
        positions[i3 + 1] = (def.type === 'ember' || def.type === 'spark' || def.type === 'bubble') ? 0 : 15;
        positions[i3] = (Math.random() - 0.5) * def.spread * 2;
        positions[i3 + 2] = pz + (Math.random() - 0.5) * def.spread * 2;
      }

      // 保持粒子跟随玩家的 Z 位置
      const dz = positions[i3 + 2] - pz;
      if (Math.abs(dz) > def.spread) {
        positions[i3 + 2] = pz + (Math.random() - 0.5) * def.spread * 2;
      }
    }

    // 更新 GPU 数据
    (this.particleSystem.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  // ============ Camera ============

  private updateCamera(deltaTime: number): void {
    if (!this.playerHorse || !this.playerHorse.mesh) return;

    const horse = this.playerHorse;
    const horseMesh = horse.mesh!;
    const cam = this.engine.camera;

    // Base camera position: behind and above the horse
    const cameraDistance = 8;
    const cameraHeight = 4;

    // Apply horizontal rotation from mouse drag
    const offsetX = Math.sin(this.cameraAngleY) * cameraDistance;
    const offsetZ = -Math.cos(this.cameraAngleY) * cameraDistance;

    const targetCamX = horseMesh.position.x * 0.3 + offsetX;
    const targetCamY = cameraHeight;
    const targetCamZ = horse.position.z + offsetZ;

    // Smooth camera follow
    cam.position.x += (targetCamX - cam.position.x) * 5 * deltaTime;
    cam.position.y += (targetCamY - cam.position.y) * 5 * deltaTime;
    cam.position.z += (targetCamZ - cam.position.z) * 5 * deltaTime;

    // Look slightly ahead of the horse
    const lookTarget = new THREE.Vector3(
      horseMesh.position.x * 0.1,
      1,
      horse.position.z + 8
    );
    cam.lookAt(lookTarget);

    // Return camera angle back to center gradually
    this.cameraAngleY *= 0.95;
  }

  // ============ Collision ============

  private checkCollisions(): void {
    if (!this.playerHorse || !this.playerHorse.mesh || this.isGameOver) return;
    // 复活无敌期内跳过碰撞检测
    if (this.reviveInvincibleTimer > 0) return;

    const obstacles = this.chunkManager.getObstacles();
    const px = this.playerHorse.mesh.position.x;
    const pz = this.playerHorse.position.z;
    const playerHalfWidth = 0.4;

    for (const obs of obstacles) {
      // 跳过已处理（被护盾抵消/隐藏）的障碍
      if (obs.mesh && !obs.mesh.visible) continue;

      // Quick Z distance check
      const dz = Math.abs(obs.position.z - pz);
      if (dz > 2) continue;

      // More precise check
      const dx = Math.abs(px - obs.position.x);
      const collisionWidth = (obs.width + playerHalfWidth) / 2;

      if (dx < collisionWidth && dz < 0.8) {
        // 水坑：减速而非 game over
        if (obs.type === 'W') {
          this.waterSlowdownTimer = 1.5;
          this.showFloatingText('💧 减速!', '#4488FF');
          continue;
        }
        // 弹射板：加速
        if (obs.type === 'Q') {
          this.parkourSpeedLevel = Math.min(PARKOUR_MAX_SPEED_LEVEL, this.parkourSpeedLevel + 8);
          this.showFloatingText('🚀 加速!', '#00FF88');
          if (obs.mesh) obs.mesh.visible = false; // 消耗后隐藏
          continue;
        }
        // 护盾：消耗一次，不 game over
        if (this.cardSystem.consumeShield()) {
          this.showFloatingText('🛡️ 护盾抵消!', '#4CAF50');
          // 隐藏被撞障碍
          if (obs.mesh) obs.mesh.visible = false;
          continue;
        }
        // 其他障碍：crash
        this.coinStreakCount = 0;
        this.onCrash(obs.type);
        return;
      }

      // === 近闪躲检测 ===
      // 条件：擦身而过但未碰撞（dx 略大于 collisionWidth，dz 很近）
      if (obs.type !== 'W' && dx < collisionWidth * 1.5 && dx >= collisionWidth && dz < 1.2) {
        // 检查是否已经在闪红列表中（避免重复触发）
        const alreadyFlashing = this.nearMissFlashList.some(e => e.mesh === obs.mesh);
        if (!alreadyFlashing && obs.mesh && obs.mesh.visible) {
          // 障碍闪红
          this.flashObstacleRed(obs.mesh);
          // 触发近闪躲 AI 评论
          const now = Date.now() / 1000;
          if (this.canShowComment('nearMiss', now)) {
            this.triggerComment('nearMiss', now);
          }
        }
      }
    }
  }

  /**
   * 检测收集物碰撞（金币/星星）
   */
  private checkCollectibles(): void {
    if (!this.playerHorse || !this.playerHorse.mesh || this.isGameOver) return;

    const collectibles = this.chunkManager.getCollectibles();
    const px = this.playerHorse.mesh.position.x;
    const pz = this.playerHorse.position.z;
    const playerHalfWidth = 0.6; // 收集物的拾取范围略大

    for (const col of collectibles) {
      if (col.collected) continue;

      const dz = Math.abs(col.position.z - pz);
      if (dz > 2) continue;

      const dx = Math.abs(px - col.position.x);
      const collectWidth = (col.width + playerHalfWidth) / 2;

      if (dx < collectWidth && dz < 1.0) {
        col.collected = true;
        const ctx = this.cardSystem.getContext();
        const mountCoinMult = 1 + (this.playerHorse?.mountCoinBonus ?? 0) / 100;
        const talentCoinMult = 1 + getTalentValue('coinBonus', getPlayerProgress().getTalentLevel('coinBonus')) / 100;
        const trainerCoinBonuses = getTotalTrainerBonuses(getPlayerProgress().getUnlockedTrainers());
        const trainerCoinMult = 1 + trainerCoinBonuses.totalCoinBonus / 100;
        const actualValue = Math.floor(col.value * ctx.coinMultiplier * mountCoinMult * talentCoinMult * trainerCoinMult);
        this.collectibleScore += actualValue;

        // 金币连击计数（用于 AI 弹幕触发）
        this.coinStreakCount++;

        // 隐藏 mesh
        if (col.mesh) {
          col.mesh.visible = false;
        }

        // 显示浮动文本
        const color = col.type === 'S' ? '#FFFF00' : '#FFD700';
        const multiplierTag = ctx.coinMultiplier > 1 ? ` x${ctx.coinMultiplier}` : '';
        const text = col.type === 'S' ? `⭐ +${actualValue}${multiplierTag}` : `🪙 +${actualValue}${multiplierTag}`;
        this.showFloatingText(text, color);
      }
    }
  }

  /**
   * 显示临时浮动文本（收集/减速提示）
   */
  private showFloatingText(text: string, color: string): void {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `
      position: fixed; top: 40%; left: 50%; transform: translate(-50%, 0);
      font-size: 24px; font-weight: bold; color: ${color}; z-index: 1500;
      text-shadow: 0 2px 8px rgba(0,0,0,0.5);
      pointer-events: none;
      animation: floatUp 0.8s ease-out forwards;
    `;
    document.body.appendChild(el);

    // 添加动画 CSS（如果还没有）
    if (!document.getElementById('parkour-float-anim')) {
      const style = document.createElement('style');
      style.id = 'parkour-float-anim';
      style.textContent = `
        @keyframes floatUp {
          0% { opacity: 1; transform: translate(-50%, 0) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -60px) scale(1.3); }
        }
      `;
      document.head.appendChild(style);
    }

    setTimeout(() => el.remove(), 800);
  }

  private onCrash(obstacleType: string): void {
    // Record crash in tracker
    this.tracker.recordCollision(obstacleType);
    this.timeSinceLastCrash = 0;

    // 复活卡检查
    if (this.cardSystem.consumeRevive()) {
      this.showFloatingText('❤️ 复活!', '#FF4444');
      // 2秒无敌保护期 + 减速
      this.reviveInvincibleTimer = 2.0;
      this.waterSlowdownTimer = 2.0;
      return;
    }

    this.isGameOver = true;
    this.isRunning = false;

    // Stop horse
    if (this.playerHorse) {
      this.playerHorse.stopRunning();
    }

    // Get telemetry for AI style description (本地回退)
    const telemetry = this.tracker.getTelemetry();
    let aiStyle = '';
    switch (telemetry.style) {
      case 'safe': aiStyle = 'AI评价：你太保守了，我都懒得布陷阱'; break;
      case 'aggressive': aiStyle = 'AI评价：莽夫！你的勇气大于你的反应力'; break;
      case 'erratic': aiStyle = 'AI评价：你的行为让我的预测模型崩溃了'; break;
      default: aiStyle = 'AI评价：平衡型玩家，需要更多数据来击败你'; break;
    }

    // Calculate rewards (距离奖励 + 收集物奖励 + 训练师加成)
    const baseTrophy = Math.floor(this.distance / 20) + Math.floor(this.collectibleScore / 2);
    const progress = getPlayerProgress();
    const trophyBonusPct = getTalentValue('trophyBonus', progress.getTalentLevel('trophyBonus'));
    const trainerBonuses = getTotalTrainerBonuses(progress.getUnlockedTrainers());
    const trophyReward = Math.floor(baseTrophy * (1 + trophyBonusPct / 100) * (1 + trainerBonuses.totalCoinBonus / 100));
    const isNewRecord = this.distance > progress.bestDistance;

    // 始终记录比赛历史（含完整 RaceRecord）
    const survivalDuration = (Date.now() - this.startTime) / 1000;
    progress.recordRaceResult(this.distance, trophyReward, {
      mode: 'parkour',
      duration: survivalDuration,
      timestamp: Date.now(),
      collectibleScore: this.collectibleScore,
    });

    // Show game over (先用本地评价)
    this.showGameOver(aiStyle, trophyReward, isNewRecord);

    // 异步请求 AI 死亡评价（返回后替换本地评价）
    const architect = this.chunkManager.getArchitect();
    if (architect.hasApiKey && architect.lastConnectionOk) {
      const survivalTime = (Date.now() - this.startTime) / 1000;
      const pickedCards = this.cardSystem.getPickedCards().map(c => c.name);
      architect.generateDeathEvaluation(
        telemetry, this.distance, this.collectibleScore, survivalTime, pickedCards
      ).then(evalText => {
        if (evalText) {
          this.deathEvalText = evalText;
          // 尝试更新结算界面中的评价文本
          const evalEl = document.getElementById('ai-death-eval');
          if (evalEl) {
            evalEl.textContent = `AI评价：${evalText}`;
            evalEl.style.opacity = '0';
            evalEl.style.transition = 'opacity 0.5s';
            requestAnimationFrame(() => { evalEl.style.opacity = '1'; });
          }
        }
      }).catch(() => { /* 静默失败 */ });
    }
  }

  private showGameOver(aiStyle: string, trophies: number, isNewRecord: boolean): void {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.3); z-index: 2000;
      display: flex; justify-content: center; align-items: center;
      font-family: 'Arial Rounded MT Bold', 'Segoe UI', system-ui, sans-serif;
    `;

    const survivalTime = ((Date.now() - this.startTime) / 1000).toFixed(1);

    const recordBadge = isNewRecord
      ? `<div style="color: #FFD700; font-size: 24px; margin-bottom: 10px; text-shadow: 2px 2px 0 #000; font-weight: 900;">🎉 新纪录!</div>`
      : '';

    overlay.innerHTML = `
      <div style="
        background: linear-gradient(180deg, #7DD3FC, #38BDF8);
        border-radius: 24px;
        border: 4px solid #0284C7;
        padding: 30px 40px;
        text-align: center;
        color: #000;
        min-width: 300px;
        box-shadow: 0 12px 40px rgba(0,0,0,0.4);
        animation: fadeIn 0.4s ease;
      ">
        <div style="font-size: 48px; margin-bottom: 10px;">🏁</div>
        ${recordBadge}
        <div style="font-size: 28px; font-weight: 900; margin-bottom: 15px;">跑酷结束!</div>
        
        <!-- 主成绩卡片 -->
        <div style="
          background: #FFFFFF;
          padding: 15px;
          border-radius: 12px;
          border: 3px solid #000;
          margin-bottom: 15px;
        ">
          <div style="font-size: 40px; color: #007bff; font-weight: 900;">
            ${Math.floor(this.distance)}m
          </div>
          <div style="font-size: 16px; color: #666; margin-top: 4px;">
            存活 ${survivalTime}s
          </div>
          <div style="display: flex; justify-content: center; gap: 20px; margin-top: 10px;">
            <div style="font-size: 20px; font-weight: 900; color: #FFD700; text-shadow: 1px 1px 0 #000;">
              🪙 ${this.collectibleScore}
            </div>
            <div style="font-size: 20px; font-weight: 900; color: #FFD700; text-shadow: 1px 1px 0 #000;">
              🏆 +${trophies}
            </div>
          </div>
        </div>
        
        <!-- 本局卡牌 -->
        ${this.renderPickedCards()}
        
        <!-- AI 评价 -->
        <div id="ai-death-eval" style="
          background: rgba(255,136,0,0.15);
          border: 2px solid #F97316;
          border-radius: 10px;
          padding: 8px 16px;
          margin-bottom: 18px;
          font-size: 14px;
          color: #9A3412;
          font-weight: 700;
        ">
          ${aiStyle}
        </div>
        
        <!-- 再来一次按钮 -->
        <button id="parkour-restart-btn" style="
          padding: 15px 40px;
          background-color: #00FF00;
          color: #000;
          border: 3px solid #000;
          border-radius: 12px;
          font-size: 20px;
          font-weight: 900;
          font-family: 'Arial Rounded MT Bold', sans-serif;
          cursor: pointer;
          box-shadow: 0 6px 0 #006400;
          transition: transform 0.1s, box-shadow 0.1s;
          width: 100%;
          margin-bottom: 10px;
        "
        onmouseover="this.style.transform='translateY(2px)'; this.style.boxShadow='0 4px 0 #006400'"
        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 6px 0 #006400'"
        >
          再来一次
        </button>
        
        <!-- 返回马厩按钮 -->
        <button id="parkour-back-btn" style="
          padding: 10px 30px;
          background-color: transparent;
          color: #0369A1;
          border: 2px solid #0369A1;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          width: 100%;
          transition: background 0.2s;
        "
        onmouseover="this.style.backgroundColor='rgba(3,105,161,0.1)'"
        onmouseout="this.style.backgroundColor='transparent'"
        >
          返回马厩
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    // Restart button
    const restartBtn = overlay.querySelector('#parkour-restart-btn') as HTMLElement;
    restartBtn.addEventListener('click', () => {
      overlay.remove();
      this.isInitialized = false;
      this.onInit();
    });

    // Back button
    const backBtn = overlay.querySelector('#parkour-back-btn') as HTMLElement;
    backBtn.addEventListener('click', () => {
      overlay.remove();
      this.callbacks.onEnd({
        distance: this.distance,
        trophies,
        isNewRecord,
        milestones: [],
        aiStyle
      });
    });
  }

  /**
   * 渲染本局选过的卡牌（用于结算界面）
   */
  private renderPickedCards(): string {
    const picked = this.cardSystem.getPickedCards();
    if (picked.length === 0) return '';

    const cardIcons = picked.map(c => {
      const borderColor = c.category === 'trap' ? '#FF4444' :
        c.category === 'reward' ? '#FFD700' : '#4CAF50';
      return `<span style="
        display: inline-block; padding: 3px 8px; margin: 2px;
        border: 2px solid ${borderColor}; border-radius: 8px;
        font-size: 14px; background: rgba(255,255,255,0.1);
      ">${c.icon} ${c.name}</span>`;
    }).join('');

    return `
      <div style="
        margin-bottom: 12px; padding: 8px 12px;
        background: rgba(0,0,0,0.05); border-radius: 10px;
      ">
        <div style="font-size: 12px; color: #666; margin-bottom: 4px;">本局卡牌</div>
        <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 4px;">
          ${cardIcons}
        </div>
      </div>
    `;
  }

  // ============ UI ============

  private createParkourUI(): void {
    // 先清理旧 UI（重启场景时防止残留）
    this.removeParkourUI();

    // Main HUD
    this.parkourUI = document.createElement('div');
    this.parkourUI.style.cssText = `
      position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
      padding: 10px 30px; background: rgba(0,0,0,0.5); color: white;
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 18px; border-radius: 25px; z-index: 1000;
      backdrop-filter: blur(4px); text-align: center;
      border: 1px solid rgba(255,255,255,0.1);
    `;
    document.body.appendChild(this.parkourUI);

    // AI "读心雷达" 指示器 (top right)
    this.aiStatusUI = document.createElement('div');
    this.aiStatusUI.style.cssText = `
      position: fixed; top: 10px; right: 10px;
      padding: 10px 14px; background: rgba(10, 0, 0, 0.7); color: #ff8800;
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 12px; border-radius: 12px; z-index: 1000;
      backdrop-filter: blur(6px);
      border: 1px solid rgba(255,136,0,0.3);
      min-width: 140px;
    `;
    this.aiStatusUI.innerHTML = this.buildRadarHUD();
    document.body.appendChild(this.aiStatusUI);

    // Controls hint (bottom)
    this.hintUI = document.createElement('div');
    this.hintUI.style.cssText = `
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      padding: 8px 20px; background: rgba(0,0,0,0.4); color: #aaa;
      font-family: sans-serif; font-size: 13px; border-radius: 15px; z-index: 1000;
    `;
    this.hintUI.textContent = 'A/D 或 左右方向键 躲避障碍';
    document.body.appendChild(this.hintUI);

    // Auto-fade hint after 5 seconds
    const hintRef = this.hintUI;
    setTimeout(() => {
      hintRef.style.transition = 'opacity 1s';
      hintRef.style.opacity = '0';
      setTimeout(() => {
        hintRef.remove();
        if (this.hintUI === hintRef) this.hintUI = null;
      }, 1000);
    }, 5000);
  }

  private updateParkourUI(): void {
    if (!this.parkourUI) return;

    const speed = this.playerHorse ? this.playerHorse.speed.toFixed(1) : '0';

    const slowIndicator = this.waterSlowdownTimer > 0
      ? '<span style="color: #4488FF; margin-left: 8px;">💧</span>' : '';

    this.parkourUI.innerHTML = `
      <span style="color: #00ff88; font-weight: bold;">${Math.floor(this.distance)}m</span>
      <span style="margin: 0 10px; color: #555;">|</span>
      <span style="color: #FFD700;">🪙 ${this.collectibleScore}</span>
      <span style="margin: 0 10px; color: #555;">|</span>
      <span style="color: #aaa;">${speed} m/s</span>${slowIndicator}
    `;

    // Update AI "读心雷达" HUD
    if (this.aiStatusUI) {
      this.aiStatusUI.innerHTML = this.buildRadarHUD();
    }
  }

  /**
   * 构建 AI 读心雷达 HUD 内容
   */
  private buildRadarHUD(): string {
    const architect = this.chunkManager.getArchitect();
    const telemetry = this.tracker.getTelemetry();

    // 连接状态指示点
    let statusDot: string;
    if (!architect.hasApiKey) {
      statusDot = '<span style="color:#888;">●</span>';
    } else if (architect.lastConnectionOk) {
      statusDot = '<span style="color:#4caf50;">●</span>';
    } else {
      statusDot = '<span style="color:#FFD700;">●</span>';
    }

    // AI 分析短评
    let analysisText = this.currentAIAnalysis;
    if (!analysisText || analysisText === '分析中...') {
      // 本地回退：根据行为风格生成拟人化描述
      analysisText = LOCAL_ANALYSIS[telemetry.style] || '分析中...';
    }

    // 信心度：API 返回或本地计算
    let confidence = this.currentAIConfidence;
    if (confidence <= 0) {
      // 本地计算：|laneBias| * 50 + (非erratic ? 30 : 0) + playTime因子
      confidence = Math.min(100, Math.round(
        Math.abs(telemetry.laneBias) * 50 +
        (telemetry.style !== 'erratic' ? 30 : 0) +
        Math.min(20, telemetry.playTime * 0.5)
      ));
    }

    // 信心度进度条颜色
    const barColor = confidence > 70 ? '#4caf50' : (confidence > 40 ? '#FFD700' : '#ff4444');

    return `
      <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
        ${statusDot}
        <span style="color:#ff8800; font-weight:700; font-size:13px;">AI 设计师</span>
      </div>
      <div style="color:#ffbb88; font-size:12px; margin-bottom:8px; font-style:italic;">
        "${analysisText}"
      </div>
      <div style="display:flex; align-items:center; gap:6px;">
        <span style="color:#888; font-size:10px;">信心</span>
        <div style="flex:1; height:6px; background:rgba(255,255,255,0.1); border-radius:3px; overflow:hidden;">
          <div style="width:${confidence}%; height:100%; background:${barColor}; border-radius:3px; transition:width 0.5s;"></div>
        </div>
        <span style="color:#aaa; font-size:10px;">${confidence}%</span>
      </div>
    `;
  }
}
