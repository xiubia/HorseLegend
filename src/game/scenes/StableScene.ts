// 马棚训练场景 - 玩家可以使用跑步机训练提升速度等级

import * as THREE from 'three';
import type { Engine } from '../../engine/Engine';
import type { GameScene } from '../../engine/SceneManager';
import { Treadmill } from '../../entities/Treadmill';
import { Horse } from '../../entities/Horse';
import { getPlayerProgress, TREADMILL_CONFIGS } from '../../data/PlayerProgress';
import { HUD } from '../../ui/HUD';
import { MountUI } from '../../ui/MountUI';
import { getMountById } from '../../data/MountRegistry';
import { TalentUI } from '../../ui/TalentUI';
import { getTalentValue } from '../../data/TalentRegistry';
import { ParkourConfigUI } from '../../ui/ParkourConfigUI';
import { RebirthUI } from '../../ui/RebirthUI';
import { TrailUI } from '../../ui/TrailUI';
import { TrainerUI } from '../../ui/TrainerUI';
import { getTrailById } from '../../data/TrailRegistry';
import { getTotalTrainerBonuses } from '../../data/TrainerRegistry';
import { TrailEffect } from '../../entities/TrailEffect';
import { Pet } from '../../entities/Pet';
import { PetGachaUI } from '../../ui/PetGachaUI';
import { PetUI } from '../../ui/PetUI';
import { getPetById, getPetSpeedBonus } from '../../data/PetRegistry';
import { ParkourConfig, StableSceneConfig } from '../../data/types/GameTypes';
import { loadAISettings } from '../../ui/SettingsUI';
import { getTheme, ThemeDef, DECORATION_FACTORIES, TREE_STYLE_FACTORIES } from '../../ai/ThemeRegistry';
import { getRebirthTrainingMultiplier, getMaxRebirths, REBIRTH_COST } from '../../systems/RebirthSystem';
import { GeminiArchitect } from '../../ai/GeminiArchitect';
import { StatsUI } from '../../ui/StatsUI';

/**
 * 场景切换回调
 */
export interface StableSceneCallbacks {
  onStartRace: () => void;
  onStartParkour?: (config?: ParkourConfig) => void;
}

/**
 * 马棚训练场景
 */
export class StableScene implements GameScene {
  private engine: Engine;
  private hud: HUD;
  private callbacks: StableSceneCallbacks;

  // 实体
  private treadmills: Treadmill[] = [];
  private playerHorse: Horse | null = null;
  private raceGate: THREE.Object3D | null = null;
  private parkourGate: THREE.Object3D | null = null;
  private mountGate: THREE.Object3D | null = null;

  // 状态
  private isInitialized = false;
  private currentTreadmill: Treadmill | null = null;
  private trainingTime: number = 0;
  private treadmillInputReleased: boolean = false; // 进入跑步机后是否已松开过按键

  // 马棚尺寸
  private readonly STABLE_WIDTH = 30;
  private readonly STABLE_LENGTH = 40;

  // 坐骑系统
  private mountUI: MountUI | null = null;
  private mountBtn: HTMLButtonElement | null = null;
  private mountGateTriggered: boolean = false;

  // 天赋系统
  private talentUI: TalentUI | null = null;
  private talentBtn: HTMLButtonElement | null = null;

  // 跑酷配置面板
  private parkourConfigUI: ParkourConfigUI | null = null;
  private parkourGateTriggered: boolean = false;

  // 重生系统
  private rebirthUI: RebirthUI | null = null;
  private rebirthBtn: HTMLButtonElement | null = null;

  // 尾迹系统
  private trailUI: TrailUI | null = null;
  private trailBtn: HTMLButtonElement | null = null;
  private trailEffect: TrailEffect | null = null;

  // 训练师系统
  private trainerUI: TrainerUI | null = null;
  private trainerBtn: HTMLButtonElement | null = null;

  // 底部按钮容器
  private bottomBar: HTMLDivElement | null = null;

  // 战绩面板
  private statsUI: StatsUI | null = null;

  // 宠物系统
  private petGachaUI: PetGachaUI | null = null;
  private petUI: PetUI | null = null;
  private petBtn: HTMLButtonElement | null = null;
  private petEgg: THREE.Object3D | null = null;
  private petEggSign: THREE.Object3D | null = null;
  private petEggTriggered: boolean = false;
  private petEntities: Pet[] = [];
  private petEggAnimTime: number = 0;

  // 装饰性视觉元素分组（用于 AI 重建场景时整体替换）
  private environmentGroup: THREE.Group | null = null;

  // AI 场景生成加载提示
  private loadingOverlay: HTMLDivElement | null = null;

  // 玩家移动
  private readonly MOVE_SPEED = 8;

  // 相机控制
  private cameraAngleY: number = Math.PI;  // 水平旋转角度（初始面向开始点，即旋转180度）
  private cameraAngleX: number = 0.3;      // 垂直角度（俯仰）
  private cameraDistance: number = 12;     // 相机距离
  private isMouseDown: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  // 触控支持
  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private isTouching: boolean = false;
  private touchId: number | null = null;

  // 虚拟摇杆
  private joystickBase: HTMLDivElement | null = null;
  private joystickStick: HTMLDivElement | null = null;
  private joystickActive: boolean = false;
  private joystickTouchId: number | null = null;
  private joystickInputX: number = 0;
  private joystickInputZ: number = 0;

  // 全屏按钮
  private fullscreenBtn: HTMLButtonElement | null = null;

  // 鼠标事件绑定
  private boundOnMouseDown: (e: MouseEvent) => void;
  private boundOnMouseUp: (e: MouseEvent) => void;
  private boundOnMouseMove: (e: MouseEvent) => void;
  private boundOnWheel: (e: WheelEvent) => void;

  // 触控事件绑定
  private boundOnTouchStart: (e: TouchEvent) => void;
  private boundOnTouchMove: (e: TouchEvent) => void;
  private boundOnTouchEnd: (e: TouchEvent) => void;

  constructor(engine: Engine, hud: HUD, callbacks: StableSceneCallbacks) {
    this.engine = engine;
    this.hud = hud;
    this.callbacks = callbacks;

    // 绑定鼠标事件
    this.boundOnMouseDown = this.onMouseDown.bind(this);
    this.boundOnMouseUp = this.onMouseUp.bind(this);
    this.boundOnMouseMove = this.onMouseMove.bind(this);
    this.boundOnWheel = this.onWheel.bind(this);

    // 绑定触控事件
    this.boundOnTouchStart = this.onTouchStart.bind(this);
    this.boundOnTouchMove = this.onTouchMove.bind(this);
    this.boundOnTouchEnd = this.onTouchEnd.bind(this);
  }

  /**
   * 初始化场景
   */
  onEnter(engine: Engine): void {
    this.engine = engine;
    // 重置宠物蛋触发标志
    this.petEggTriggered = false;
  }

  onExit(): void {
    this.onDestroy();
  }

  onInit(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 清空世界
    this.engine.world.clear();

    // 设置天空颜色
    this.engine.world.scene.background = new THREE.Color(0x88CCFF);

    // 创建环境
    this.createEnvironment();

    // 创建跑步机
    this.createTreadmills();

    // 创建玩家马匹
    this.createPlayerHorse();

    // 创建跑道入口门
    this.createRaceGate();

    // 创建AI跑酷入口门
    this.createParkourGate();

    // 创建坐骑入口门
    this.createMountGate();

    // 创建宠物蛋
    this.createPetEgg();

    // 设置相机
    this.setupCamera();

    // 添加鼠标事件监听
    this.setupMouseControls();

    // 创建底部按钮栏（统一容器，自动居中）
    this.createBottomButtons();

    // 初始化宠物跟随
    this.refreshPets();

    // 更新HUD
    this.updateHUD();

    // 显示提示消息
    this.hud.showMessage('WASD移动，鼠标拖拽旋转视角，滚轮缩放', 3000);
  }

  /**
   * 设置鼠标控制
   */
  private setupMouseControls(): void {
    const canvas = this.engine.renderer.domElement;
    canvas.addEventListener('mousedown', this.boundOnMouseDown);
    canvas.addEventListener('mouseup', this.boundOnMouseUp);
    canvas.addEventListener('mouseleave', this.boundOnMouseUp);
    canvas.addEventListener('mousemove', this.boundOnMouseMove);
    canvas.addEventListener('wheel', this.boundOnWheel);

    // 添加触控事件
    canvas.addEventListener('touchstart', this.boundOnTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this.boundOnTouchMove, { passive: false });
    canvas.addEventListener('touchend', this.boundOnTouchEnd);
    canvas.addEventListener('touchcancel', this.boundOnTouchEnd);

    // 创建虚拟摇杆（仅移动端显示）
    this.createVirtualJoystick();

    // 创建全屏按钮
    this.createFullscreenButton();
  }

  /**
   * 移除鼠标控制
   */
  private removeMouseControls(): void {
    const canvas = this.engine.renderer.domElement;
    canvas.removeEventListener('mousedown', this.boundOnMouseDown);
    canvas.removeEventListener('mouseup', this.boundOnMouseUp);
    canvas.removeEventListener('mouseleave', this.boundOnMouseUp);
    canvas.removeEventListener('mousemove', this.boundOnMouseMove);
    canvas.removeEventListener('wheel', this.boundOnWheel);

    // 移除触控事件
    canvas.removeEventListener('touchstart', this.boundOnTouchStart);
    canvas.removeEventListener('touchmove', this.boundOnTouchMove);
    canvas.removeEventListener('touchend', this.boundOnTouchEnd);
    canvas.removeEventListener('touchcancel', this.boundOnTouchEnd);

    // 移除虚拟摇杆
    if (this.joystickBase) {
      this.joystickBase.remove();
      this.joystickBase = null;
      this.joystickStick = null;
    }

    // 移除全屏按钮
    if (this.fullscreenBtn) {
      this.fullscreenBtn.remove();
      this.fullscreenBtn = null;
    }
  }

  /**
   * 鼠标按下
   */
  private onMouseDown(e: MouseEvent): void {
    this.isMouseDown = true;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  }

  /**
   * 鼠标释放
   */
  private onMouseUp(e: MouseEvent): void {
    this.isMouseDown = false;
  }

  /**
   * 鼠标移动
   */
  private onMouseMove(e: MouseEvent): void {
    if (!this.isMouseDown) return;

    const deltaX = e.clientX - this.lastMouseX;
    const deltaY = e.clientY - this.lastMouseY;

    // 水平旋转
    this.cameraAngleY -= deltaX * 0.01;

    // 垂直旋转（限制角度）
    this.cameraAngleX += deltaY * 0.01;
    this.cameraAngleX = Math.max(0.1, Math.min(1.2, this.cameraAngleX));

    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  }

  /**
   * 鼠标滚轮缩放
   */
  private onWheel(e: WheelEvent): void {
    this.cameraDistance += e.deltaY * 0.02;
    this.cameraDistance = Math.max(5, Math.min(25, this.cameraDistance));
  }

  /**
   * 触摸开始
   */
  private onTouchStart(e: TouchEvent): void {
    // 阻止默认行为（防止页面滚动）
    e.preventDefault();

    // 只处理第一个触摸点用于相机旋转
    if (this.touchId === null && e.touches.length > 0) {
      const touch = e.touches[0];
      this.touchId = touch.identifier;
      this.isTouching = true;
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
    }
  }

  /**
   * 触摸移动
   */
  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();

    if (!this.isTouching || this.touchId === null) return;

    // 找到对应的触摸点
    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      if (touch.identifier === this.touchId) {
        const deltaX = touch.clientX - this.touchStartX;
        const deltaY = touch.clientY - this.touchStartY;

        // 水平旋转
        this.cameraAngleY -= deltaX * 0.01;

        // 垂直旋转（限制角度）
        this.cameraAngleX += deltaY * 0.01;
        this.cameraAngleX = Math.max(0.1, Math.min(1.2, this.cameraAngleX));

        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
        break;
      }
    }
  }

  /**
   * 触摸结束
   */
  private onTouchEnd(e: TouchEvent): void {
    // 检查是否是我们跟踪的触摸点结束了
    if (this.touchId !== null) {
      let found = false;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === this.touchId) {
          found = true;
          break;
        }
      }
      if (!found) {
        this.isTouching = false;
        this.touchId = null;
      }
    }
  }

  /**
   * 创建虚拟摇杆
   */
  private createVirtualJoystick(): void {
    // 检测是否为移动设备
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) return;

    // 创建摇杆底座 - 调整位置避开底部按钮
    this.joystickBase = document.createElement('div');
    this.joystickBase.style.cssText = `
      position: fixed;
      left: 20px;
      bottom: 120px;
      width: 100px;
      height: 100px;
      background: rgba(255, 255, 255, 0.3);
      border: 3px solid rgba(255, 255, 255, 0.5);
      border-radius: 50%;
      z-index: 2000;
      touch-action: none;
    `;

    // 创建摇杆手柄
    this.joystickStick = document.createElement('div');
    this.joystickStick.style.cssText = `
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 40px;
      height: 40px;
      background: rgba(255, 255, 255, 0.7);
      border: 3px solid rgba(255, 255, 255, 0.9);
      border-radius: 50%;
      transition: all 0.1s;
    `;

    this.joystickBase.appendChild(this.joystickStick);
    document.body.appendChild(this.joystickBase);

    // 摇杆触控事件
    this.joystickBase.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.touches.length > 0) {
        this.joystickActive = true;
        this.joystickTouchId = e.touches[0].identifier;
        this.updateJoystick(e.touches[0]);
      }
    });

    this.joystickBase.addEventListener('touchmove', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!this.joystickActive || this.joystickTouchId === null) return;

      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === this.joystickTouchId) {
          this.updateJoystick(e.touches[i]);
          break;
        }
      }
    });

    const endJoystick = (e: TouchEvent) => {
      if (this.joystickTouchId !== null) {
        let found = false;
        for (let i = 0; i < e.touches.length; i++) {
          if (e.touches[i].identifier === this.joystickTouchId) {
            found = true;
            break;
          }
        }
        if (!found) {
          this.joystickActive = false;
          this.joystickTouchId = null;
          this.joystickInputX = 0;
          this.joystickInputZ = 0;
          if (this.joystickStick) {
            this.joystickStick.style.transform = 'translate(-50%, -50%)';
          }
        }
      }
    };

    this.joystickBase.addEventListener('touchend', endJoystick);
    this.joystickBase.addEventListener('touchcancel', endJoystick);
  }

  /**
   * 更新摇杆位置
   */
  private updateJoystick(touch: Touch): void {
    if (!this.joystickBase || !this.joystickStick) return;

    const rect = this.joystickBase.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let deltaX = touch.clientX - centerX;
    let deltaY = touch.clientY - centerY;

    // 限制在圆形范围内
    const maxDistance = 35; // 最大偏移距离
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance > maxDistance) {
      deltaX = (deltaX / distance) * maxDistance;
      deltaY = (deltaY / distance) * maxDistance;
    }

    // 更新手柄位置
    this.joystickStick.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px))`;

    // 计算输入值 (-1 到 1)
    this.joystickInputX = deltaX / maxDistance;
    this.joystickInputZ = deltaY / maxDistance;
  }

  /**
   * 创建全屏按钮
   */
  private createFullscreenButton(): void {
    this.fullscreenBtn = document.createElement('button');
    this.fullscreenBtn.innerHTML = '⛶';
    this.fullscreenBtn.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      width: 44px;
      height: 44px;
      background: rgba(0, 0, 0, 0.5);
      color: white;
      border: 2px solid rgba(255, 255, 255, 0.5);
      border-radius: 8px;
      font-size: 20px;
      cursor: pointer;
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    `;

    this.fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.log('无法进入全屏:', err);
        });
        this.fullscreenBtn!.innerHTML = '⛶';
      } else {
        document.exitFullscreen();
        this.fullscreenBtn!.innerHTML = '⛶';
      }
    });

    // 监听全屏状态变化
    document.addEventListener('fullscreenchange', () => {
      if (this.fullscreenBtn) {
        this.fullscreenBtn.innerHTML = document.fullscreenElement ? '⛶' : '⛶';
      }
    });

    document.body.appendChild(this.fullscreenBtn);
  }

  /**
   * 创建马棚环境（默认配置）
   * 所有装饰性视觉对象放入 environmentGroup，方便 AI 重建时整体替换
   */
  private createEnvironment(): void {
    this.buildEnvironmentGroup(GeminiArchitect.DEFAULT_STABLE_CONFIG);

    // 异步应用玩家自定义主题（如有描述）
    this.applyStableTheme();
  }

  /**
   * 根据配置构建环境分组（地面、草地、太阳、围栏、山脉、树木、水域、装饰物、灯光）
   */
  private buildEnvironmentGroup(config: StableSceneConfig): void {
    // 清除旧的环境组
    if (this.environmentGroup) {
      this.engine.world.scene.remove(this.environmentGroup);
      this.environmentGroup = null;
    }

    const group = new THREE.Group();
    group.name = '__stableEnvironment';

    // 天空 & 雾效
    this.engine.world.scene.background = new THREE.Color(config.skyColor);
    this.engine.world.scene.fog = new THREE.Fog(
      new THREE.Color(config.fogColor).getHex(),
      config.fogNear,
      config.fogFar
    );

    // 灯光
    const ambient = new THREE.AmbientLight(
      new THREE.Color(config.ambientColor).getHex(),
      config.ambientIntensity
    );
    group.add(ambient);

    const dirLight = new THREE.DirectionalLight(
      new THREE.Color(config.sunColor).getHex(),
      config.sunIntensity
    );
    dirLight.position.set(15, 35, 20);
    dirLight.castShadow = true;
    group.add(dirLight);

    // 地面
    const groundGeo = new THREE.PlaneGeometry(this.STABLE_WIDTH, this.STABLE_LENGTH);
    const groundMat = new THREE.MeshToonMaterial({ color: new THREE.Color(config.groundColor) });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    group.add(ground);

    // 周围草地
    const grassGeo = new THREE.PlaneGeometry(200, 200);
    const grassMat = new THREE.MeshToonMaterial({ color: new THREE.Color(config.grassColor) });
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.02;
    grass.receiveShadow = true;
    group.add(grass);

    // 太阳球体
    const sunGeo = new THREE.SphereGeometry(3, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(config.sunVisualColor) });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    sun.position.set(40, 60, 50);
    group.add(sun);

    // 围栏
    this.buildFences(group, new THREE.Color(config.fenceColor), new THREE.Color(config.fencePostColor));

    // 山脉
    this.buildMountains(group, config.mountainColors, config.mountainSnowCap, config.mountainSnowColor);

    // 树木
    this.buildTrees(group, config.treeStyle, config.foliageColor, config.trunkColor);

    // 水域
    this.buildWaterArea(group, config.waterColor, config.waterShineColor, config.waterOpacity);

    // 装饰物（来自 AI 或默认）
    this.buildDecorations(group, config.decorations, config.decorationColors);

    // 比赛门后方风景（树木、花丛、石头、路灯、草地）— 使用主题颜色
    this.buildGateBackdrop(group, config);

    this.environmentGroup = group;
    this.engine.world.scene.add(group);
  }

  // ============ AI 场景主题系统 ============

  /**
   * 从设置中读取出生点描述，调用 AI 生成场景配置并重建
   * 优先级：缓存 → AI 生成 → 关键词匹配 → 默认
   */
  private async applyStableTheme(): Promise<void> {
    const settings = loadAISettings();
    const desc = settings.spawnDescription?.trim();
    if (!desc) return; // 没有描述，保持默认外观

    // 1. 检查 localStorage 缓存
    const cacheKey = 'stable_scene_config_' + this.hashDescription(desc);
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const config = JSON.parse(cached) as StableSceneConfig;
        console.log('[StableScene] 从缓存加载 AI 场景配置');
        this.buildEnvironmentGroup(config);
        return;
      } catch {
        localStorage.removeItem(cacheKey);
      }
    }

    // 2. 尝试调用 AI 生成
    if (settings.apiKey) {
      this.showLoadingOverlay();
      try {
        const architect = new GeminiArchitect();
        const config = await architect.generateStableSceneConfig(desc);
        this.hideLoadingOverlay();

        if (config) {
          console.log('[StableScene] AI 生成场景配置成功');
          // 缓存结果
          localStorage.setItem(cacheKey, JSON.stringify(config));
          this.buildEnvironmentGroup(config);
          return;
        }
      } catch (e) {
        console.warn('[StableScene] AI 场景生成失败:', e);
        this.hideLoadingOverlay();
      }
    }

    // 3. 回退：关键词匹配预设主题
    const themeId = this.resolveStableThemeByKeywords(desc);
    if (themeId !== 'meadow') {
      const theme = getTheme(themeId);
      const fallbackConfig = this.themeDefToConfig(theme);
      console.log(`[StableScene] 关键词匹配主题: ${themeId}`);
      this.buildEnvironmentGroup(fallbackConfig);
    }
    // 如果是 meadow 则保持 createEnvironment 创建的默认外观
  }

  /**
   * 将 ThemeDef 转换为 StableSceneConfig（关键词回退用）
   */
  private themeDefToConfig(theme: ThemeDef): StableSceneConfig {
    const defaults = GeminiArchitect.DEFAULT_STABLE_CONFIG;
    const hexStr = (n: number) => '#' + n.toString(16).padStart(6, '0');

    // 根据主题选择合适的装饰物和树木风格
    let treeStyle: StableSceneConfig['treeStyle'] = 'pine';
    let decos = defaults.decorations;
    let particleType: StableSceneConfig['particleType'] = 'none';
    let particleColor = '#FFFFFF';

    switch (theme.id) {
      case 'forest': treeStyle = 'forest'; decos = ['mushroom', 'bush', 'vines']; break;
      case 'cherry': treeStyle = 'cherry'; decos = ['flower_bush', 'cherry_tree']; break;
      case 'snow': treeStyle = 'snow'; decos = ['ice_block', 'snow_mound', 'snow_tree']; break;
      case 'night': treeStyle = 'dark'; decos = ['firefly_light', 'dark_tree', 'street_lamp']; break;
      case 'desert': treeStyle = 'none'; decos = ['cactus', 'desert_rock', 'dry_grass']; break;
      case 'volcano': treeStyle = 'charred'; decos = ['lava_rock', 'smoke_column', 'charred_tree']; break;
      case 'crystal': treeStyle = 'none'; decos = ['crystal_pillar', 'stalactite', 'ice_block']; break;
      case 'neon': treeStyle = 'none'; decos = ['neon_pole', 'light_wall', 'street_lamp']; break;
      case 'underwater': treeStyle = 'none'; decos = ['coral', 'seaweed']; break;
      case 'ancient': treeStyle = 'forest'; decos = ['ruin_pillar', 'vines', 'bush']; break;
      case 'cloud': treeStyle = 'none'; decos = ['cloud_pillar', 'rainbow_arc']; break;
      case 'lava': treeStyle = 'charred'; decos = ['lava_fountain', 'flame_wall', 'lava_rock']; break;
      case 'sunset': treeStyle = 'forest'; decos = ['street_lamp', 'bush', 'flower_bush']; break;
    }

    if (theme.particles) {
      particleType = theme.particles.type as StableSceneConfig['particleType'];
      particleColor = hexStr(theme.particles.color);
    }

    return {
      skyColor: hexStr(theme.skyColor),
      fogColor: hexStr(theme.fogColor),
      fogNear: theme.fogNear,
      fogFar: theme.fogFar,
      groundColor: hexStr(theme.trackColor),
      grassColor: hexStr(theme.grassColor),
      ambientColor: defaults.ambientColor,
      ambientIntensity: theme.ambientIntensity,
      sunColor: hexStr(theme.sunColor),
      sunIntensity: theme.sunIntensity,
      sunVisualColor: hexStr(theme.sunColor),
      mountainColors: [hexStr(theme.skyColor), hexStr(theme.fogColor), hexStr(theme.grassColor)],
      mountainSnowCap: theme.id === 'snow' || theme.id === 'cloud',
      mountainSnowColor: '#F0F0F0',
      treeStyle,
      foliageColor: hexStr(theme.grassColor),
      trunkColor: defaults.trunkColor,
      waterColor: hexStr(theme.skyColor),
      waterShineColor: hexStr(theme.fogColor),
      waterOpacity: 0.7,
      fenceColor: hexStr(theme.fenceColor),
      fencePostColor: defaults.fencePostColor,
      decorations: decos,
      decorationColors: defaults.decorationColors,
      particleType,
      particleColor,
    };
  }

  /**
   * 关键词匹配预设主题 ID（作为 AI 不可用时的回退）
   */
  private resolveStableThemeByKeywords(desc: string): string {
    const keywordMap: Record<string, string[]> = {
      crystal: ['水晶', '洞穴', 'crystal', 'cave', '宝石'],
      neon: ['霓虹', '都市', '赛博', 'neon', 'cyber', 'city', '城市'],
      underwater: ['海底', '海洋', '水下', 'underwater', 'ocean', 'coral'],
      ancient: ['遗迹', '远古', '废墟', '神殿', 'ancient', 'ruin', 'temple'],
      cloud: ['云端', '天空', '云', 'cloud', 'sky', 'heaven', '彩虹', 'rainbow'],
      lava: ['熔岩', '岩浆', '地狱', 'lava', 'hell', 'molten'],
      volcano: ['火山', 'volcano', 'magma'],
      cherry: ['樱花', 'cherry', 'sakura', 'blossom', '日式'],
      snow: ['雪', '冰', '冬', 'snow', 'ice', 'winter'],
      forest: ['森林', '树', 'forest', 'jungle', '丛林'],
      desert: ['沙漠', '沙', 'desert', 'sand'],
      night: ['夜', '黑暗', '月光', 'night', 'dark', '夜晚'],
      sunset: ['黄昏', '夕阳', 'sunset', 'dusk'],
    };

    const lower = desc.toLowerCase();
    for (const [themeId, keywords] of Object.entries(keywordMap)) {
      for (const kw of keywords) {
        if (lower.includes(kw)) return themeId;
      }
    }
    return 'meadow';
  }

  /**
   * 简单字符串哈希（用于缓存 key）
   */
  private hashDescription(desc: string): string {
    let hash = 0;
    for (let i = 0; i < desc.length; i++) {
      const chr = desc.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 显示 AI 场景生成加载提示
   */
  private showLoadingOverlay(): void {
    if (this.loadingOverlay) return;
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.45); z-index: 9999; pointer-events: none;
    `;
    const box = document.createElement('div');
    box.style.cssText = `
      background: #FFF8E7; border: 3px solid #222; border-radius: 16px;
      padding: 28px 40px; text-align: center; font-family: sans-serif;
      box-shadow: 4px 4px 0 #222;
    `;
    box.innerHTML = `
      <div style="font-size: 32px; margin-bottom: 12px; animation: spin 1s linear infinite;">&#9881;</div>
      <div style="font-size: 16px; font-weight: bold; color: #333;">AI 正在生成场景...</div>
      <div style="font-size: 12px; color: #888; margin-top: 6px;">根据你的描述创造全新世界</div>
    `;
    // 添加旋转动画
    if (!document.getElementById('__stableSceneSpinStyle')) {
      const style = document.createElement('style');
      style.id = '__stableSceneSpinStyle';
      style.textContent = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
      document.head.appendChild(style);
    }
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    this.loadingOverlay = overlay;
  }

  /**
   * 隐藏加载提示
   */
  private hideLoadingOverlay(): void {
    if (this.loadingOverlay) {
      this.loadingOverlay.remove();
      this.loadingOverlay = null;
    }
  }

  /**
   * 创建围栏（参数化颜色，添加到指定 group）
   */
  private buildFences(parent: THREE.Group, fenceColor: THREE.Color, postColor: THREE.Color): void {
    const fenceMaterial = new THREE.MeshToonMaterial({ color: fenceColor });
    const postMaterial = new THREE.MeshToonMaterial({ color: postColor });

    const createFenceSection = (x: number, z: number, rotation: number) => {
      const group = new THREE.Group();

      const postGeometry = new THREE.CylinderGeometry(0.1, 0.14, 1.6, 6);
      const post1 = new THREE.Mesh(postGeometry, postMaterial);
      post1.position.set(-1.5, 0.8, 0);
      post1.castShadow = true;
      group.add(post1);

      const capGeo = new THREE.ConeGeometry(0.12, 0.15, 6);
      const cap1 = new THREE.Mesh(capGeo, postMaterial);
      cap1.position.set(-1.5, 1.65, 0);
      group.add(cap1);

      const post2 = new THREE.Mesh(postGeometry, postMaterial);
      post2.position.set(1.5, 0.8, 0);
      post2.castShadow = true;
      group.add(post2);

      const cap2 = new THREE.Mesh(capGeo, postMaterial);
      cap2.position.set(1.5, 1.65, 0);
      group.add(cap2);

      const railGeometry = new THREE.CylinderGeometry(0.06, 0.06, 3, 8);
      railGeometry.rotateZ(Math.PI / 2);
      for (const ry of [0.45, 0.95, 1.35]) {
        const rail = new THREE.Mesh(railGeometry, fenceMaterial);
        rail.position.set(0, ry, 0);
        rail.castShadow = true;
        group.add(rail);
      }

      group.position.set(x, 0, z);
      group.rotation.y = rotation;
      parent.add(group);
    };

    const halfW = this.STABLE_WIDTH / 2;
    const halfL = this.STABLE_LENGTH / 2;

    for (let x = -halfW + 1.5; x < halfW; x += 3) {
      createFenceSection(x, -halfL, 0);
      if (Math.abs(x) > 3) {
        createFenceSection(x, halfL, 0);
      }
    }
    for (let z = -halfL + 1.5; z < halfL; z += 3) {
      createFenceSection(-halfW, z, Math.PI / 2);
      createFenceSection(halfW, z, Math.PI / 2);
    }
  }

  /**
   * 创建背景山脉（参数化颜色和雪盖）
   */
  private buildMountains(parent: THREE.Group, colors: string[], snowCap: boolean, snowColor: string): void {
    // 固定布局位置，使用 AI 配置的颜色
    const positions = [
      { x: -60, z: -70, scale: 1.5, h: 25 },
      { x: 0, z: -80, scale: 2.0, h: 35 },
      { x: 50, z: -75, scale: 1.8, h: 30 },
      { x: -40, z: -85, scale: 1.3, h: 22 },
      { x: 70, z: -80, scale: 1.4, h: 28 },
      { x: -35, z: -55, scale: 1.2, h: 18 },
      { x: 25, z: -60, scale: 1.0, h: 15 },
      { x: 60, z: -55, scale: 1.1, h: 16 },
      { x: -55, z: -60, scale: 0.9, h: 14 },
      { x: -75, z: -30, scale: 1.3, h: 20 },
      { x: 80, z: -35, scale: 1.5, h: 24 },
      { x: -80, z: 10, scale: 1.1, h: 18 },
      { x: 85, z: 5, scale: 1.2, h: 20 },
    ];

    const snowColorObj = new THREE.Color(snowColor);

    for (let i = 0; i < positions.length; i++) {
      const def = positions[i];
      const color = new THREE.Color(colors[i % colors.length]);
      const mountainGroup = new THREE.Group();

      const geo = new THREE.ConeGeometry(def.h * 0.7, def.h, 6 + Math.floor(Math.random() * 3));
      const mat = new THREE.MeshToonMaterial({ color });
      const mountain = new THREE.Mesh(geo, mat);
      mountain.position.y = def.h / 2;
      mountain.scale.set(def.scale, 1, def.scale * (0.8 + Math.random() * 0.4));
      mountain.castShadow = true;
      mountainGroup.add(mountain);

      if (snowCap && def.h > 20) {
        const snowGeo = new THREE.ConeGeometry(def.h * 0.25, def.h * 0.2, 6);
        const snowMat = new THREE.MeshToonMaterial({ color: snowColorObj });
        const snow = new THREE.Mesh(snowGeo, snowMat);
        snow.position.y = def.h * 0.9;
        snow.scale.set(def.scale, 1, def.scale * 0.9);
        mountainGroup.add(snow);
      }

      mountainGroup.position.set(def.x, 0, def.z);
      mountainGroup.rotation.y = Math.random() * 0.3;
      parent.add(mountainGroup);
    }
  }

  /**
   * 创建树木群（参数化样式和颜色）
   * 如果 treeStyle 为 'none' 则不创建
   * 如果匹配 TREE_STYLE_FACTORIES 中的样式则使用对应工厂
   * 否则使用默认松树（可自定义颜色）
   */
  private buildTrees(parent: THREE.Group, style: string, foliageColor: string, trunkColor: string): void {
    if (style === 'none') return;

    // 树木位置布局（固定）
    const treePositions: { x: number; z: number; s: number }[] = [];
    for (let i = 0; i < 8; i++) {
      treePositions.push({ x: -25 + Math.random() * 50, z: -28 - Math.random() * 20, s: 0.7 + Math.random() * 0.8 });
    }
    for (let i = 0; i < 5; i++) {
      treePositions.push({ x: -20 - Math.random() * 15, z: -15 + Math.random() * 30, s: 0.6 + Math.random() * 0.7 });
    }
    for (let i = 0; i < 5; i++) {
      treePositions.push({ x: 20 + Math.random() * 15, z: -15 + Math.random() * 30, s: 0.6 + Math.random() * 0.7 });
    }
    for (let i = 0; i < 4; i++) {
      const side = i < 2 ? -1 : 1;
      treePositions.push({ x: side * (18 + Math.random() * 10), z: 15 + Math.random() * 15, s: 0.5 + Math.random() * 0.6 });
    }

    const factory = TREE_STYLE_FACTORIES[style];
    const foliageHex = new THREE.Color(foliageColor).getHex();
    const trunkHex = new THREE.Color(trunkColor).getHex();

    for (const pos of treePositions) {
      let tree: THREE.Object3D;
      if (factory) {
        // 使用 ThemeRegistry 中预设的树木工厂
        tree = factory();
        tree.scale.setScalar(pos.s);
      } else {
        // 使用自定义颜色的松树
        tree = this.createPineTree(trunkHex, foliageHex, pos.s);
      }
      tree.position.set(pos.x, 0, pos.z);
      tree.rotation.y = Math.random() * Math.PI * 2;
      parent.add(tree);
    }
  }

  /**
   * 创建单棵松树/杉树（可自定义颜色）
   */
  private createPineTree(trunkColor: number, foliageColor: number, scale: number): THREE.Group {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshToonMaterial({ color: trunkColor });
    const foliageMat = new THREE.MeshToonMaterial({ color: foliageColor });

    const trunkHeight = 2.5 * scale;
    const trunkGeo = new THREE.CylinderGeometry(0.2 * scale, 0.35 * scale, trunkHeight, 7);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = trunkHeight / 2;
    trunk.castShadow = true;
    group.add(trunk);

    for (let i = 0; i < 3; i++) {
      const radius = (1.8 - i * 0.4) * scale;
      const height = (2.2 - i * 0.3) * scale;
      const foliageGeo = new THREE.ConeGeometry(radius, height, 7);
      const foliage = new THREE.Mesh(foliageGeo, foliageMat);
      foliage.position.y = trunkHeight + i * height * 0.55 + 0.3;
      foliage.castShadow = true;
      group.add(foliage);
    }

    return group;
  }

  /**
   * 创建水域区域（参数化颜色）
   */
  private buildWaterArea(parent: THREE.Group, waterColorStr: string, shineColorStr: string, opacity: number): void {
    const waterGroup = new THREE.Group();

    const waterGeo = new THREE.CircleGeometry(6, 24);
    const waterMat = new THREE.MeshToonMaterial({
      color: new THREE.Color(waterColorStr),
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.02;
    water.scale.set(1.3, 1, 1);
    waterGroup.add(water);

    const waterShineGeo = new THREE.CircleGeometry(4, 20);
    const waterShineMat = new THREE.MeshToonMaterial({
      color: new THREE.Color(shineColorStr),
      transparent: true,
      opacity: opacity * 0.55,
    });
    const waterShine = new THREE.Mesh(waterShineGeo, waterShineMat);
    waterShine.rotation.x = -Math.PI / 2;
    waterShine.position.set(1, 0.03, -0.5);
    waterGroup.add(waterShine);

    const stoneColors = [0x9E9E9E, 0x8D8D8D, 0xA0A0A0, 0x7E7E7E];
    const stonePositions = [
      { x: -5, z: -3, s: 0.8 }, { x: -6.5, z: 0.5, s: 0.6 },
      { x: -4, z: 3, s: 0.7 }, { x: 4, z: -4, s: 0.5 },
      { x: 6, z: -1, s: 0.9 }, { x: 5, z: 3, s: 0.6 },
      { x: -2, z: 4.5, s: 0.5 }, { x: 2, z: -5, s: 0.7 },
    ];

    for (const sp of stonePositions) {
      const stoneGeo = new THREE.DodecahedronGeometry(0.4 * sp.s, 0);
      const stoneMat = new THREE.MeshToonMaterial({
        color: stoneColors[Math.floor(Math.random() * stoneColors.length)]
      });
      const stone = new THREE.Mesh(stoneGeo, stoneMat);
      stone.position.set(sp.x, 0.15 * sp.s, sp.z);
      stone.scale.set(1.2, 0.6, 1.0);
      stone.rotation.y = Math.random() * Math.PI;
      stone.castShadow = true;
      waterGroup.add(stone);
    }

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dist = 5.5 + Math.random() * 2;
      const grassGroup = new THREE.Group();
      for (let j = 0; j < 3; j++) {
        const bladeGeo = new THREE.BoxGeometry(0.05, 0.3 + Math.random() * 0.2, 0.05);
        const bladeMat = new THREE.MeshToonMaterial({ color: 0x4CAF50 });
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.set((Math.random() - 0.5) * 0.2, 0.15, (Math.random() - 0.5) * 0.2);
        blade.rotation.z = (Math.random() - 0.5) * 0.3;
        grassGroup.add(blade);
      }
      grassGroup.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
      waterGroup.add(grassGroup);
    }

    waterGroup.position.set(-22, -0.05, 5);
    parent.add(waterGroup);
  }

  /**
   * 创建装饰物（参数化类型和颜色）
   * 从 DECORATION_FACTORIES 中查找工厂函数，在固定位置散布
   * 自动过滤掉靠近门（Race/Parkour/Mount/Talent）的位置
   */
  private buildDecorations(parent: THREE.Group, decoTypes: string[], decoColors: string[]): void {
    // 门/交互物的位置 & 排斥半径（不在附近放装饰物）
    const halfW = this.STABLE_WIDTH / 2;
    const halfL = this.STABLE_LENGTH / 2;
    const gateExclusions = [
      { x: 5, z: halfL - 2 },            // Race gate（前方偏右）
      { x: -5, z: halfL - 2 },           // Parkour gate（前方偏左）
      { x: -(halfW - 2), z: 5 },         // Mount gate（左侧）
      { x: halfW - 3, z: 5 },            // Pet egg（右侧）
      { x: 0, z: 0 },                    // 玩家出生点
    ];
    const GATE_RADIUS = 6; // 排斥半径（加大以确保门周围空旷）

    const isTooCloseToGate = (x: number, z: number) => {
      for (const g of gateExclusions) {
        const dx = x - g.x;
        const dz = z - g.z;
        if (dx * dx + dz * dz < GATE_RADIUS * GATE_RADIUS) return true;
      }
      return false;
    };

    // 装饰物散布位置（围栏内散布 + 边缘散布）
    // 注意避开：出生点(0,0)、两个门(±5, 18)、坐骑门(-13, 5)、宠物蛋(12, 5)、跑步机区域
    const innerPositions = [
      { x: 10, z: -15 }, { x: 12, z: -13 }, { x: -10, z: -16 },
      { x: -5, z: -12 }, { x: -8, z: -8 }, { x: 6, z: -10 },
      { x: 2, z: -14 }, { x: -3, z: -6 }, { x: 8, z: -6 },
      { x: -10, z: -3 }, { x: 10, z: -3 },
      { x: -12, z: -10 }, { x: 12, z: -10 },
    ];

    const outerPositions = [
      { x: 7, z: -17 }, { x: -9, z: -14 }, { x: -11, z: -6 },
      { x: 11, z: -7 }, { x: -6, z: -18 }, { x: 3, z: -17 },
    ];

    // 合并并过滤掉靠近门的位置
    const allPositions = [...innerPositions, ...outerPositions]
      .filter(p => !isTooCloseToGate(p.x, p.z));

    // 使用 AI 指定的装饰物类型，循环分配到各个位置
    const validFactories = decoTypes
      .map(t => DECORATION_FACTORIES[t])
      .filter(Boolean);

    if (validFactories.length === 0) {
      // 如果没有有效工厂，放置默认的彩色小石头
      const colors = decoColors.map(c => new THREE.Color(c).getHex());
      const safeOuter = outerPositions.filter(p => !isTooCloseToGate(p.x, p.z));
      for (const pos of safeOuter) {
        const stoneGeo = new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.2, 0);
        const stoneMat = new THREE.MeshToonMaterial({
          color: colors[Math.floor(Math.random() * colors.length)]
        });
        const stone = new THREE.Mesh(stoneGeo, stoneMat);
        stone.position.set(pos.x, 0.1, pos.z);
        stone.rotation.set(Math.random(), Math.random(), 0);
        stone.scale.y = 0.6;
        stone.castShadow = true;
        parent.add(stone);
      }
      return;
    }

    // 在每个位置放置一个装饰物
    for (let i = 0; i < allPositions.length; i++) {
      const pos = allPositions[i];
      const factory = validFactories[i % validFactories.length];
      const deco = factory();
      deco.position.set(pos.x, 0, pos.z);
      deco.rotation.y = Math.random() * Math.PI * 2;
      const scale = 0.6 + Math.random() * 0.8;
      deco.scale.setScalar(scale);
      parent.add(deco);
    }

    // 水桶（始终放置 — 功能性装饰）
    const bucketGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.6, 12);
    const bucketMat = new THREE.MeshToonMaterial({ color: 0x5C6BC0 });
    const bucket = new THREE.Mesh(bucketGeo, bucketMat);
    bucket.position.set(8, 0.3, -10);
    bucket.castShadow = true;
    parent.add(bucket);

    const handleGeo = new THREE.TorusGeometry(0.2, 0.03, 8, 12, Math.PI);
    const handleMat = new THREE.MeshToonMaterial({ color: 0x888888 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.set(8, 0.65, -10);
    handle.rotation.x = Math.PI;
    parent.add(handle);
  }

  /**
   * 创建可爱方块小动物NPC
   */
  private createAnimalNPC(x: number, z: number, bodyColor: number, faceColor: number, type: string): void {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshToonMaterial({ color: bodyColor });
    const faceMat = new THREE.MeshToonMaterial({ color: faceColor });
    const eyeMat = new THREE.MeshToonMaterial({ color: 0x222222 });
    const noseMat = new THREE.MeshToonMaterial({ color: 0xFF6B6B });

    if (type === 'cat') {
      // 身体（方块）
      const bodyGeo = new THREE.BoxGeometry(0.5, 0.4, 0.6);
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.3;
      body.castShadow = true;
      group.add(body);

      // 头
      const headGeo = new THREE.BoxGeometry(0.45, 0.4, 0.4);
      const head = new THREE.Mesh(headGeo, bodyMat);
      head.position.set(0, 0.6, 0.25);
      head.castShadow = true;
      group.add(head);

      // 耳朵（三角形）
      const earGeo = new THREE.ConeGeometry(0.08, 0.15, 4);
      const earL = new THREE.Mesh(earGeo, bodyMat);
      earL.position.set(-0.13, 0.88, 0.25);
      group.add(earL);
      const earR = new THREE.Mesh(earGeo, bodyMat);
      earR.position.set(0.13, 0.88, 0.25);
      group.add(earR);

      // 脸部白色区域
      const faceGeo = new THREE.BoxGeometry(0.3, 0.25, 0.05);
      const face = new THREE.Mesh(faceGeo, faceMat);
      face.position.set(0, 0.55, 0.46);
      group.add(face);

      // 眼睛
      const eyeGeo = new THREE.SphereGeometry(0.035, 6, 6);
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-0.08, 0.63, 0.47);
      group.add(eyeL);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeR.position.set(0.08, 0.63, 0.47);
      group.add(eyeR);

      // 鼻子
      const noseGeo = new THREE.SphereGeometry(0.02, 6, 6);
      const nose = new THREE.Mesh(noseGeo, noseMat);
      nose.position.set(0, 0.56, 0.48);
      group.add(nose);

      // 尾巴
      const tailGeo = new THREE.CylinderGeometry(0.04, 0.03, 0.4, 6);
      const tail = new THREE.Mesh(tailGeo, bodyMat);
      tail.position.set(0, 0.4, -0.32);
      tail.rotation.x = -0.5;
      group.add(tail);

      // 四条小腿
      const legGeo = new THREE.BoxGeometry(0.1, 0.15, 0.1);
      const legPositions = [
        { lx: -0.15, lz: 0.2 }, { lx: 0.15, lz: 0.2 },
        { lx: -0.15, lz: -0.2 }, { lx: 0.15, lz: -0.2 },
      ];
      for (const lp of legPositions) {
        const leg = new THREE.Mesh(legGeo, bodyMat);
        leg.position.set(lp.lx, 0.08, lp.lz);
        group.add(leg);
      }
    } else {
      // 小狗
      const bodyGeo = new THREE.BoxGeometry(0.5, 0.45, 0.7);
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.35;
      body.castShadow = true;
      group.add(body);

      // 头
      const headGeo = new THREE.BoxGeometry(0.45, 0.4, 0.4);
      const head = new THREE.Mesh(headGeo, bodyMat);
      head.position.set(0, 0.65, 0.3);
      head.castShadow = true;
      group.add(head);

      // 垂耳
      const earGeo = new THREE.BoxGeometry(0.12, 0.2, 0.08);
      const earMat = new THREE.MeshToonMaterial({ color: faceColor });
      const earL = new THREE.Mesh(earGeo, earMat);
      earL.position.set(-0.22, 0.7, 0.3);
      earL.rotation.z = 0.2;
      group.add(earL);
      const earR = new THREE.Mesh(earGeo, earMat);
      earR.position.set(0.22, 0.7, 0.3);
      earR.rotation.z = -0.2;
      group.add(earR);

      // 脸部
      const faceGeo = new THREE.BoxGeometry(0.3, 0.2, 0.05);
      const face = new THREE.Mesh(faceGeo, faceMat);
      face.position.set(0, 0.6, 0.51);
      group.add(face);

      // 眼睛
      const eyeGeo = new THREE.SphereGeometry(0.035, 6, 6);
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-0.08, 0.68, 0.52);
      group.add(eyeL);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeR.position.set(0.08, 0.68, 0.52);
      group.add(eyeR);

      // 鼻子
      const noseGeo = new THREE.SphereGeometry(0.03, 6, 6);
      const nose = new THREE.Mesh(noseGeo, eyeMat);
      nose.position.set(0, 0.6, 0.53);
      group.add(nose);

      // 嘴巴（微笑弧线 - 用两个小球）
      const tongueGeo = new THREE.SphereGeometry(0.02, 6, 6);
      const tongue = new THREE.Mesh(tongueGeo, noseMat);
      tongue.position.set(0, 0.55, 0.52);
      tongue.scale.set(1.5, 0.8, 1);
      group.add(tongue);

      // 尾巴（向上翘）
      const tailGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.35, 6);
      const tail = new THREE.Mesh(tailGeo, bodyMat);
      tail.position.set(0, 0.55, -0.38);
      tail.rotation.x = -0.8;
      group.add(tail);

      // 四条小腿
      const legGeo = new THREE.BoxGeometry(0.1, 0.18, 0.1);
      const legPositions = [
        { lx: -0.15, lz: 0.25 }, { lx: 0.15, lz: 0.25 },
        { lx: -0.15, lz: -0.25 }, { lx: 0.15, lz: -0.25 },
      ];
      for (const lp of legPositions) {
        const leg = new THREE.Mesh(legGeo, bodyMat);
        leg.position.set(lp.lx, 0.09, lp.lz);
        group.add(leg);
      }
    }

    group.position.set(x, 0, z);
    group.rotation.y = Math.random() * Math.PI * 2;
    this.engine.world.scene.add(group);
  }

  /**
   * 创建跑步机
   */
  private createTreadmills(): void {
    const progress = getPlayerProgress();

    // 跑步机位置布局（半圆形，在玩家身后）
    const positions = [
      { x: -8, z: -5 },   // Lv1
      { x: -4, z: -8 },   // Lv2
      { x: 0, z: -10 },   // Lv3
      { x: 4, z: -8 },    // Lv4
      { x: 8, z: -5 },    // Lv5
    ];

    for (let i = 0; i < 5; i++) {
      const level = i + 1;
      const treadmill = new Treadmill(`treadmill_${level}`, {
        level,
        position: positions[i],
      });

      // 设置解锁状态
      treadmill.setUnlocked(progress.isTreadmillUnlocked(level));

      // 添加到场景
      treadmill.addToScene(this.engine.world.scene);

      // 旋转跑步机180度
      if (treadmill.mesh) {
        treadmill.mesh.rotation.y = Math.PI;
      }

      this.treadmills.push(treadmill);
    }
  }

  /**
   * 创建玩家马匹（使用装备的坐骑外观）
   */
  private createPlayerHorse(): void {
    const progress = getPlayerProgress();
    const mount = getMountById(progress.getEquippedMount());

    this.playerHorse = new Horse('player_horse', {
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

    // 创建/更新尾迹特效
    if (this.trailEffect) {
      this.trailEffect.dispose();
    }
    this.trailEffect = new TrailEffect(this.engine.world.scene);
    this.trailEffect.setTrail(trail);

    // 应用天赋移速加成
    this.playerHorse.talentSpeedBonus = getTalentValue('speedBonus', progress.getTalentLevel('speedBonus'));

    // 应用宠物速度加成
    this.applyPetBonusToHorse();

    // 设置初始位置
    this.playerHorse.setPosition(0, 0, 0);
    this.playerHorse.addToScene(this.engine.world.scene);
  }

  /**
   * 创建跑道入口门 - 白色拱形门+金色装饰
   */
  private createRaceGate(): void {
    const gateGroup = new THREE.Group();

    const whiteMat = new THREE.MeshToonMaterial({ color: 0xFAFAFA });
    const goldMat = new THREE.MeshToonMaterial({ color: 0xFFD700 });
    const goldGlowMat = new THREE.MeshToonMaterial({ color: 0xFFD700, emissive: 0xCC9900, emissiveIntensity: 0.3 });

    // 门柱 - 白色圆柱
    const pillarGeometry = new THREE.CylinderGeometry(0.3, 0.35, 4.5, 12);

    const leftPillar = new THREE.Mesh(pillarGeometry, whiteMat);
    leftPillar.position.set(-2.5, 2.25, 0);
    leftPillar.castShadow = true;
    gateGroup.add(leftPillar);

    const rightPillar = new THREE.Mesh(pillarGeometry, whiteMat);
    rightPillar.position.set(2.5, 2.25, 0);
    rightPillar.castShadow = true;
    gateGroup.add(rightPillar);

    // 柱顶装饰球
    const capGeo = new THREE.SphereGeometry(0.35, 12, 10);
    const capL = new THREE.Mesh(capGeo, goldGlowMat);
    capL.position.set(-2.5, 4.6, 0);
    gateGroup.add(capL);
    const capR = new THREE.Mesh(capGeo, goldGlowMat);
    capR.position.set(2.5, 4.6, 0);
    gateGroup.add(capR);

    // 拱形横梁 - 用半圆环模拟
    const archGeo = new THREE.TorusGeometry(2.5, 0.25, 10, 20, Math.PI);
    const arch = new THREE.Mesh(archGeo, whiteMat);
    arch.position.set(0, 4.5, 0);
    arch.rotation.z = 0;
    arch.castShadow = true;
    gateGroup.add(arch);

    // 拱顶金色装饰星
    const starGroup = new THREE.Group();
    const starOrbGeo = new THREE.SphereGeometry(0.25, 10, 10);
    const starOrb = new THREE.Mesh(starOrbGeo, goldGlowMat);
    starGroup.add(starOrb);
    // 小金色光线
    for (let i = 0; i < 6; i++) {
      const rayGeo = new THREE.BoxGeometry(0.06, 0.3, 0.06);
      const ray = new THREE.Mesh(rayGeo, goldMat);
      const angle = (i / 6) * Math.PI * 2;
      ray.position.set(Math.cos(angle) * 0.25, Math.sin(angle) * 0.25, 0);
      ray.rotation.z = angle;
      starGroup.add(ray);
    }
    starGroup.position.set(0, 7, 0);
    gateGroup.add(starGroup);

    // 金色边框装饰带
    const stripGeo = new THREE.BoxGeometry(5.5, 0.12, 0.15);
    const strip1 = new THREE.Mesh(stripGeo, goldMat);
    strip1.position.set(0, 4.5, 0.15);
    gateGroup.add(strip1);
    const strip2 = new THREE.Mesh(stripGeo, goldMat);
    strip2.position.set(0, 4.5, -0.15);
    gateGroup.add(strip2);

    // "开始" 标志
    const signGeometry = new THREE.PlaneGeometry(3.5, 1.2);
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 320;
    signCanvas.height = 80;
    const ctx = signCanvas.getContext('2d')!;
    // 渐变金色背景
    const gradient = ctx.createLinearGradient(0, 0, 320, 0);
    gradient.addColorStop(0, '#FFD700');
    gradient.addColorStop(0.5, '#FFF8DC');
    gradient.addColorStop(1, '#FFD700');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 320, 80);
    // 边框
    ctx.strokeStyle = '#B8860B';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 312, 72);
    // 文字
    ctx.fillStyle = '#8B0000';
    ctx.font = 'bold 44px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('开始比赛', 160, 42);

    const signTexture = new THREE.CanvasTexture(signCanvas);
    const signMaterial = new THREE.MeshBasicMaterial({
      map: signTexture,
      side: THREE.DoubleSide
    });
    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.position.set(0, 3.2, -0.3);
    sign.rotation.y = Math.PI;
    gateGroup.add(sign);

    // 发光地板指示（渐变彩虹色条纹）
    const glowColors = [0xFF6B6B, 0xFFD93D, 0x6BCB77, 0x4D96FF, 0x9B59B6];
    for (let i = 0; i < glowColors.length; i++) {
      const stripeGeo = new THREE.PlaneGeometry(5, 0.5);
      const stripeMat = new THREE.MeshBasicMaterial({
        color: glowColors[i],
        transparent: true,
        opacity: 0.35,
      });
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0, 0.01, -1.2 + i * 0.6);
      gateGroup.add(stripe);
    }

    // 放在前方偏右（与 AI 跑酷门并排）
    gateGroup.position.set(5, 0, this.STABLE_LENGTH / 2 - 2);
    this.engine.world.scene.add(gateGroup);
    this.raceGate = gateGroup;
  }

  /**
   * 在比赛门后方生成风景装饰（树木、花丛、石头、路灯）
   */
  /**
   * 比赛门后方风景装饰（树木、花丛、石头、路灯、草地）
   * 添加到 environmentGroup 中，随主题一起重建
   */
  private buildGateBackdrop(parent: THREE.Group, config: StableSceneConfig): void {
    const gateZ = this.STABLE_LENGTH / 2 - 2; // 门的 Z 位置 ≈ 18

    // 从 config 提取颜色
    const trunkHex = new THREE.Color(config.trunkColor).getHex();
    const foliageHex = new THREE.Color(config.foliageColor).getHex();
    const grassHex = new THREE.Color(config.grassColor).getHex();
    const fenceHex = new THREE.Color(config.fencePostColor).getHex();

    // --- 小路（从两个门各延伸出去） ---
    const pathMat = new THREE.MeshToonMaterial({ color: new THREE.Color(config.groundColor) });
    // 左门（AI跑酷 x=-5）小路
    for (let i = 0; i < 5; i++) {
      const pathGeo = new THREE.BoxGeometry(2.2, 0.04, 1.5);
      const pathBlock = new THREE.Mesh(pathGeo, pathMat);
      pathBlock.position.set(-5 + (Math.random() - 0.5) * 0.4, 0.02, gateZ + 3 + i * 2.2);
      pathBlock.receiveShadow = true;
      parent.add(pathBlock);
    }
    // 右门（开始比赛 x=5）小路
    for (let i = 0; i < 5; i++) {
      const pathGeo = new THREE.BoxGeometry(2.2, 0.04, 1.5);
      const pathBlock = new THREE.Mesh(pathGeo, pathMat);
      pathBlock.position.set(5 + (Math.random() - 0.5) * 0.4, 0.02, gateZ + 3 + i * 2.2);
      pathBlock.receiveShadow = true;
      parent.add(pathBlock);
    }

    // --- 两侧树木（使用主题颜色，避开门前方通道） ---
    const treeDefs = [
      // 远左侧
      { x: -12, z: gateZ + 6, s: 0.9 },
      { x: -14, z: gateZ + 12, s: 1.1 },
      { x: -11, z: gateZ + 18, s: 0.8 },
      { x: -13, z: gateZ + 24, s: 1.0 },
      // 远右侧
      { x: 12, z: gateZ + 5, s: 1.0 },
      { x: 14, z: gateZ + 11, s: 0.85 },
      { x: 11, z: gateZ + 17, s: 1.1 },
      { x: 13, z: gateZ + 23, s: 0.9 },
      // 远处中央（门后方足够远）
      { x: -2, z: gateZ + 28, s: 1.2 },
      { x: 3, z: gateZ + 30, s: 1.0 },
      { x: 0, z: gateZ + 35, s: 0.9 },
    ];
    if (config.treeStyle !== 'none') {
      for (const td of treeDefs) {
        const tree = this.createPineTree(trunkHex, foliageHex, td.s);
        tree.position.set(td.x, 0, td.z);
        tree.rotation.y = Math.random() * Math.PI * 2;
        parent.add(tree);
      }
    }

    // --- 花丛（低矮灌木+花） ---
    const decoColors = config.decorationColors.length > 0
      ? config.decorationColors.map(c => new THREE.Color(c).getHex())
      : [0xFF6B8A, 0xFFD54F, 0xBA68C8, 0xFF8A65, 0x4FC3F7, 0xAED581];
    const bushMat = new THREE.MeshToonMaterial({ color: foliageHex });
    const flowerDefs = [
      { x: -10, z: gateZ + 8 }, { x: 10, z: gateZ + 7 },
      { x: -13, z: gateZ + 15 }, { x: 13, z: gateZ + 14 },
      { x: -2, z: gateZ + 25 }, { x: 4, z: gateZ + 26 },
      { x: -9, z: gateZ + 20 }, { x: 10, z: gateZ + 21 },
    ];
    for (const fd of flowerDefs) {
      const bushGroup = new THREE.Group();
      const bushGeo = new THREE.SphereGeometry(0.5 + Math.random() * 0.3, 8, 6);
      const bush = new THREE.Mesh(bushGeo, bushMat);
      bush.position.y = 0.3;
      bush.scale.set(1, 0.6, 1);
      bushGroup.add(bush);
      const count = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const fc = decoColors[Math.floor(Math.random() * decoColors.length)];
        const flowerMat = new THREE.MeshToonMaterial({ color: fc });
        const flower = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), flowerMat);
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        flower.position.set(
          Math.cos(angle) * 0.35,
          0.5 + Math.random() * 0.15,
          Math.sin(angle) * 0.35
        );
        bushGroup.add(flower);
      }
      bushGroup.position.set(fd.x, 0, fd.z);
      parent.add(bushGroup);
    }

    // --- 石头 ---
    const stoneMat = new THREE.MeshToonMaterial({ color: 0x9E9E9E });
    const stoneDefs = [
      { x: -6, z: gateZ + 8, s: 0.6 },
      { x: 8, z: gateZ + 14, s: 0.5 },
      { x: -1, z: gateZ + 24, s: 0.7 },
      { x: 5, z: gateZ + 28, s: 0.4 },
    ];
    for (const sd of stoneDefs) {
      const stoneGeo = new THREE.DodecahedronGeometry(sd.s, 0);
      const stone = new THREE.Mesh(stoneGeo, stoneMat);
      stone.position.set(sd.x, sd.s * 0.35, sd.z);
      stone.scale.set(1, 0.6, 1.2);
      stone.rotation.set(Math.random(), Math.random(), 0);
      stone.castShadow = true;
      parent.add(stone);
    }

    // --- 路灯（使用围栏颜色） ---
    const poleMat = new THREE.MeshToonMaterial({ color: fenceHex });
    const lampMat = new THREE.MeshToonMaterial({ color: 0xFFF9C4, emissive: 0xFFE082, emissiveIntensity: 0.5 });
    [-3.5, 3.5].forEach(xOff => {
      [gateZ + 8, gateZ + 18].forEach(zOff => {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.08, 3, 6),
          poleMat
        );
        pole.position.set(xOff, 1.5, zOff);
        pole.castShadow = true;
        parent.add(pole);

        const lamp = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 8, 8),
          lampMat
        );
        lamp.position.set(xOff, 3.1, zOff);
        parent.add(lamp);
      });
    });

    // --- 门后方延伸草地（使用主题草地颜色） ---
    const grassMat2 = new THREE.MeshToonMaterial({ color: grassHex });
    const grassGeo2 = new THREE.PlaneGeometry(40, 40);
    const grass2 = new THREE.Mesh(grassGeo2, grassMat2);
    grass2.rotation.x = -Math.PI / 2;
    grass2.position.set(0, 0.01, gateZ + 20);
    grass2.receiveShadow = true;
    parent.add(grass2);
  }

  /**
   * 创建AI跑酷入口门
   */
  private createParkourGate(): void {
    const gateGroup = new THREE.Group();

    const purpleMat = new THREE.MeshToonMaterial({ color: 0x7E3BAF });
    const darkPurpleMat = new THREE.MeshToonMaterial({ color: 0x5B2D8E });
    const glowPurpleMat = new THREE.MeshToonMaterial({ color: 0xBB77FF, emissive: 0x6633AA, emissiveIntensity: 0.4 });
    const cyanMat = new THREE.MeshToonMaterial({ color: 0x00E5FF, emissive: 0x004D66, emissiveIntensity: 0.5 });

    // 门柱 — 圆柱 + 顶部装饰球
    const pillarGeo = new THREE.CylinderGeometry(0.3, 0.35, 4.5, 12);
    const leftPillar = new THREE.Mesh(pillarGeo, purpleMat);
    leftPillar.position.set(-2.2, 2.25, 0);
    leftPillar.castShadow = true;
    gateGroup.add(leftPillar);
    const rightPillar = new THREE.Mesh(pillarGeo, purpleMat);
    rightPillar.position.set(2.2, 2.25, 0);
    rightPillar.castShadow = true;
    gateGroup.add(rightPillar);

    // 柱顶装饰球
    const capGeo = new THREE.SphereGeometry(0.35, 12, 12);
    const capL = new THREE.Mesh(capGeo, glowPurpleMat);
    capL.position.set(-2.2, 4.6, 0);
    gateGroup.add(capL);
    const capR = new THREE.Mesh(capGeo, glowPurpleMat);
    capR.position.set(2.2, 4.6, 0);
    gateGroup.add(capR);

    // 柱底座
    const baseGeo = new THREE.CylinderGeometry(0.5, 0.55, 0.3, 12);
    const baseL = new THREE.Mesh(baseGeo, darkPurpleMat);
    baseL.position.set(-2.2, 0.15, 0);
    gateGroup.add(baseL);
    const baseR = new THREE.Mesh(baseGeo, darkPurpleMat);
    baseR.position.set(2.2, 0.15, 0);
    gateGroup.add(baseR);

    // 拱形横梁 — 用弧线方块模拟弧顶
    const beamGeo = new THREE.BoxGeometry(4.9, 0.4, 0.4);
    const beam = new THREE.Mesh(beamGeo, purpleMat);
    beam.position.set(0, 4.5, 0);
    gateGroup.add(beam);
    // 弧顶中央三角装饰
    const archGeo = new THREE.ConeGeometry(0.5, 0.6, 4);
    const arch = new THREE.Mesh(archGeo, glowPurpleMat);
    arch.position.set(0, 5, 0);
    gateGroup.add(arch);

    // 传送门能量面 — 半透明渐变面
    const portalGeo = new THREE.PlaneGeometry(3.8, 4);
    const portalCanvas = document.createElement('canvas');
    portalCanvas.width = 128;
    portalCanvas.height = 128;
    const pCtx = portalCanvas.getContext('2d')!;
    const pGrad = pCtx.createRadialGradient(64, 64, 5, 64, 64, 64);
    pGrad.addColorStop(0, 'rgba(0, 229, 255, 0.35)');
    pGrad.addColorStop(0.5, 'rgba(155, 89, 182, 0.2)');
    pGrad.addColorStop(1, 'rgba(155, 89, 182, 0)');
    pCtx.fillStyle = pGrad;
    pCtx.fillRect(0, 0, 128, 128);
    const portalTex = new THREE.CanvasTexture(portalCanvas);
    const portalMat = new THREE.MeshBasicMaterial({
      map: portalTex, transparent: true, side: THREE.DoubleSide, depthWrite: false
    });
    const portal = new THREE.Mesh(portalGeo, portalMat);
    portal.position.set(0, 2.3, 0);
    gateGroup.add(portal);

    // "AI 跑酷" 标志牌 — 与竞速门同样方式，面朝 Z- 方向（玩家方向）
    const signGeo = new THREE.PlaneGeometry(3.2, 0.9);
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 320;
    signCanvas.height = 80;
    const sCtx = signCanvas.getContext('2d')!;
    // 圆角渐变背景
    sCtx.fillStyle = '#2C1354';
    sCtx.beginPath();
    sCtx.roundRect(4, 4, 312, 72, 12);
    sCtx.fill();
    const sGrad = sCtx.createLinearGradient(0, 0, 320, 0);
    sGrad.addColorStop(0, '#9B59B6');
    sGrad.addColorStop(0.5, '#6C3FA0');
    sGrad.addColorStop(1, '#3498DB');
    sCtx.fillStyle = sGrad;
    sCtx.beginPath();
    sCtx.roundRect(6, 6, 308, 68, 10);
    sCtx.fill();
    // 文字
    sCtx.fillStyle = '#FFFFFF';
    sCtx.font = 'bold 42px Arial';
    sCtx.textAlign = 'center';
    sCtx.textBaseline = 'middle';
    sCtx.shadowColor = 'rgba(0,0,0,0.5)';
    sCtx.shadowBlur = 4;
    sCtx.fillText('AI 跑酷', 160, 42);
    const signTex = new THREE.CanvasTexture(signCanvas);
    const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(0, 3.2, -0.3);
    sign.rotation.y = Math.PI; // 面朝 Z- 方向（玩家方向）
    gateGroup.add(sign);

    // AI 浮动光球 — 门顶
    const orbGeo = new THREE.SphereGeometry(0.25, 16, 16);
    const orb = new THREE.Mesh(orbGeo, cyanMat);
    orb.position.set(0, 5.5, 0);
    gateGroup.add(orb);

    // 地面光圈
    const glowGeo = new THREE.RingGeometry(1.2, 2.2, 24);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x9B59B6, transparent: true, opacity: 0.25, side: THREE.DoubleSide
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.02;
    gateGroup.add(glow);

    // 放在前方偏左（与竞速门并排），不旋转整个门组
    gateGroup.position.set(-5, 0, this.STABLE_LENGTH / 2 - 2);
    this.engine.world.scene.add(gateGroup);
    this.parkourGate = gateGroup;
  }

  /**
   * 检测AI跑酷入口交互 — 弹出定制面板
   */
  private checkParkourGateInteraction(): void {
    if (!this.playerHorse || !this.parkourGate || !this.callbacks.onStartParkour) return;

    // 面板已打开时不做任何检测（防止重复触发导致面板闪烁）
    if (this.parkourConfigUI?.isOpen) return;

    const playerPos = this.playerHorse.position;
    const gatePos = this.parkourGate.position;

    const dx = Math.abs(playerPos.x - gatePos.x);
    const dz = Math.abs(playerPos.z - gatePos.z);
    const inRange = dx < 2.5 && dz < 2.5;

    if (inRange && !this.parkourGateTriggered) {
      this.parkourGateTriggered = true;
      this.showParkourConfigUI();
    } else if (!inRange) {
      this.parkourGateTriggered = false;
    }
  }

  /**
   * 显示 AI 跑道定制面板
   */
  private showParkourConfigUI(): void {
    if (!this.parkourConfigUI) {
      this.parkourConfigUI = new ParkourConfigUI();
    }
    this.parkourConfigUI.show({
      onConfirm: (config: ParkourConfig) => {
        if (this.callbacks.onStartParkour) {
          this.callbacks.onStartParkour(config);
        }
      },
      onCancel: () => {
        // 用户取消，不重置触发标志；玩家需走出门范围再走回来才重新触发
      },
    });
  }

  /**
   * 设置相机
   */
  private setupCamera(): void {
    // 第三人称视角：相机在玩家后上方
    this.engine.camera.position.set(0, 6, 12);
    this.engine.camera.lookAt(0, 1, 0);
  }

  /**
   * 每帧更新
   */
  onUpdate(deltaTime: number): void {
    if (!this.playerHorse) return;

    // 处理玩家移动
    this.handlePlayerMovement(deltaTime);

    // 检测跑步机交互
    this.checkTreadmillInteraction(deltaTime);

    // 检测跑道入口（可能触发场景切换，之后 playerHorse 会变 null）
    this.checkRaceGateInteraction();
    if (!this.playerHorse) return;

    // 检测跑酷入口（同上）
    this.checkParkourGateInteraction();
    if (!this.playerHorse) return;

    // 检测坐骑入口
    this.checkMountGateInteraction();

    // 检测宠物蛋交互
    this.checkPetEggInteraction();

    // 更新宠物蛋动画
    this.updatePetEggAnim(deltaTime);

    // 更新跑步机
    for (const treadmill of this.treadmills) {
      treadmill.update(deltaTime);
    }

    // 更新马匹
    this.playerHorse.update(deltaTime);

    // 更新尾迹特效（马厩中移动时也显示）
    if (this.trailEffect && this.playerHorse) {
      this.trailEffect.update(this.playerHorse.position, this.playerHorse.externalAnimSpeed || this.playerHorse.speed, deltaTime);
    }

    // 更新宠物跟随
    this.updatePetFollow(deltaTime);

    // 更新相机跟随
    this.updateCamera();
  }

  /**
   * 处理玩家移动
   */
  private handlePlayerMovement(deltaTime: number): void {
    if (!this.playerHorse) return;

    // UI 面板打开时禁止移动（防止马匹移出门区域导致面板闪烁）
    if (this.parkourConfigUI?.isOpen) return;

    // 跑步机训练中：松开按键后再按方向键才能离开
    if (this.currentTreadmill && this.currentTreadmill.isTraining) {
      const input = this.engine.input;
      const hasInput = input.getAxis('horizontal') !== 0 || input.getAxis('vertical') !== 0 || this.joystickActive;

      // 等玩家先松开所有按键
      if (!hasInput) {
        this.treadmillInputReleased = true;
      }

      // 松开过之后再按才触发离开
      if (this.treadmillInputReleased && hasInput) {
        this.currentTreadmill.stopTraining();
        this.playerHorse.externalAnimSpeed = 0;

        // 向后移动一步，脱离跑步机碰撞区域
        const facing = this.currentTreadmill.getFacingRotationY();
        this.playerHorse.setPosition(
          this.playerHorse.position.x - Math.sin(facing) * 2.5,
          0,
          this.playerHorse.position.z - Math.cos(facing) * 2.5
        );
        this.currentTreadmill = null;
        this.treadmillInputReleased = false;
        this.updateHUD(); // 刷新 HUD 隐藏训练指示器
      }
      return;
    }

    const input = this.engine.input;
    let inputX = input.getAxis('horizontal');  // A=-1, D=+1
    let inputZ = input.getAxis('vertical');    // W=-1, S=+1

    // 如果虚拟摇杆激活，使用摇杆输入
    if (this.joystickActive) {
      inputX = this.joystickInputX;
      inputZ = this.joystickInputZ;
    }

    if (inputX !== 0 || inputZ !== 0) {
      // 基于相机朝向计算世界空间移动方向
      // 相机位置 = (sin(angle), cos(angle)) * distance
      // 相机前方（远离相机）= (-sin(angle), -cos(angle))
      // 相机右方 = (cos(angle), -sin(angle))
      const cos = Math.cos(this.cameraAngleY);
      const sin = Math.sin(this.cameraAngleY);

      // 将输入转换为世界坐标
      // W(inputZ=-1) = 向远离相机方向移动
      // D(inputX=+1) = 向屏幕右方移动
      const worldX = inputX * cos + inputZ * sin;
      const worldZ = -inputX * sin + inputZ * cos;

      // 计算移动
      const speed = this.MOVE_SPEED * deltaTime;
      let newX = this.playerHorse.position.x + worldX * speed;
      let newZ = this.playerHorse.position.z + worldZ * speed;

      // 边界限制
      const halfW = this.STABLE_WIDTH / 2 - 1;
      const halfL = this.STABLE_LENGTH / 2 - 1;
      newX = Math.max(-halfW, Math.min(halfW, newX));
      newZ = Math.max(-halfL, Math.min(halfL, newZ));

      this.playerHorse.setPosition(newX, 0, newZ);

      // 更新马匹朝向（马头在 Z+ 方向）
      // 让马头朝向移动方向
      const moveAngle = Math.atan2(worldX, worldZ);
      this.playerHorse.setRotation(0, moveAngle, 0);

      // 播放行走动画（使用移动速度驱动）
      this.playerHorse.externalAnimSpeed = this.MOVE_SPEED;
    } else {
      // 停止行走动画
      this.playerHorse.externalAnimSpeed = 0;
    }
  }

  /**
   * 检测跑步机交互
   */
  private checkTreadmillInteraction(deltaTime: number): void {
    if (!this.playerHorse) return;

    const playerPos = this.playerHorse.position;
    let onTreadmill: Treadmill | null = null;

    for (const treadmill of this.treadmills) {
      if (treadmill.isPlayerOn(playerPos)) {
        onTreadmill = treadmill;
        break;
      }
    }

    // 处理跑步机状态变化
    if (onTreadmill !== this.currentTreadmill) {
      // 离开旧跑步机
      if (this.currentTreadmill) {
        this.currentTreadmill.stopTraining();
        // 停止马匹奔跑动画
        this.playerHorse.externalAnimSpeed = 0;
        this.updateHUD(); // 刷新 HUD 隐藏训练指示器
      }

      // 进入新跑步机
      this.currentTreadmill = onTreadmill;
      this.treadmillInputReleased = false; // 等玩家松开按键后才允许离开

      if (onTreadmill) {
        if (onTreadmill.isUnlocked) {
          onTreadmill.startTraining();
          // 锁定马匹到跑步机中央，面朝控制面板方向
          const center = onTreadmill.getCenterPosition();
          this.playerHorse.setPosition(center.x, 0, center.z);
          this.playerHorse.setRotation(0, onTreadmill.getFacingRotationY(), 0);
          this.hud.showMessage(`正在使用 Lv${onTreadmill.level} 跑步机训练`, 1500);
        } else {
          // 尝试解锁
          const progress = getPlayerProgress();
          if (progress.totalTrophies >= onTreadmill.unlockCost) {
            if (progress.unlockTreadmill(onTreadmill.level)) {
              onTreadmill.setUnlocked(true);
              onTreadmill.startTraining();
              // 锁定马匹到跑步机中央
              const center = onTreadmill.getCenterPosition();
              this.playerHorse.setPosition(center.x, 0, center.z);
              this.playerHorse.setRotation(0, onTreadmill.getFacingRotationY(), 0);
              this.hud.showMessage(`解锁了 Lv${onTreadmill.level} 跑步机！`, 2000);
            }
          } else {
            this.hud.showMessage(`需要 ${onTreadmill.unlockCost} 奖杯解锁`, 1500);
          }
        }
      }

      this.trainingTime = 0;
    }

    // 训练中：锁定马匹位置 + 播放奔跑动画 + 增加速度等级
    if (this.currentTreadmill && this.currentTreadmill.isUnlocked) {
      // 保持马匹固定在跑步机中央
      const center = this.currentTreadmill.getCenterPosition();
      this.playerHorse.setPosition(center.x, 0, center.z);

      // 播放奔跑动画（速度与跑步机等级挂钩）
      this.playerHorse.externalAnimSpeed = 5 + this.currentTreadmill.level * 3;
    }

    // 训练中增加速度等级（应用天赋加成 + 重生倍率）
    if (this.currentTreadmill && this.currentTreadmill.isUnlocked) {
      const progress = getPlayerProgress();
      const trainEfficiency = getTalentValue('trainEfficiency', progress.getTalentLevel('trainEfficiency'));
      const doubleChance = getTalentValue('doubleTrain', progress.getTalentLevel('doubleTrain'));

      let baseGain = this.currentTreadmill.getSpeedGain() * deltaTime;
      baseGain *= (1 + trainEfficiency / 100); // 天赋：训练加成
      baseGain *= getRebirthTrainingMultiplier(progress.rebirthCount); // 重生：训练倍率
      const trainerBonuses = getTotalTrainerBonuses(progress.getUnlockedTrainers());
      baseGain *= (1 + trainerBonuses.totalTrainingBonus / 100); // 训练师：训练加成
      if (doubleChance > 0 && Math.random() * 100 < doubleChance) {
        baseGain *= 2; // 天赋：双倍训练概率
      }
      progress.addSpeedLevel(baseGain);
      this.trainingTime += deltaTime;

      // 自动重生：已解锁时，每秒检查一次并自动执行
      if (progress.isAutoRebirthUnlocked && getMaxRebirths(progress.speedLevel) > 0) {
        const maxRebirths = getMaxRebirths(progress.speedLevel);
        progress.performRebirth(maxRebirths, REBIRTH_COST);
      }

      // 更新HUD
      this.updateHUD();
    }
  }

  /**
   * 检测跑道入口交互
   */
  private checkRaceGateInteraction(): void {
    if (!this.playerHorse || !this.raceGate) return;

    const playerPos = this.playerHorse.position;
    const gatePos = this.raceGate.position;

    const dx = Math.abs(playerPos.x - gatePos.x);
    const dz = Math.abs(playerPos.z - gatePos.z);

    if (dx < 2 && dz < 2) {
      // 进入跑道
      this.callbacks.onStartRace();
    }
  }

  /**
   * 更新相机
   */
  private updateCamera(): void {
    if (!this.playerHorse) return;

    // 基于鼠标控制的第三人称视角
    const playerPos = this.playerHorse.position;

    // 计算相机位置（球坐标）
    const horizontalDist = this.cameraDistance * Math.cos(this.cameraAngleX);
    const height = this.cameraDistance * Math.sin(this.cameraAngleX);

    const offsetX = horizontalDist * Math.sin(this.cameraAngleY);
    const offsetZ = horizontalDist * Math.cos(this.cameraAngleY);

    const targetX = playerPos.x + offsetX;
    const targetY = playerPos.y + height + 1;  // 加1是玩家高度偏移
    const targetZ = playerPos.z + offsetZ;

    // 平滑跟随
    this.engine.camera.position.x += (targetX - this.engine.camera.position.x) * 0.1;
    this.engine.camera.position.y += (targetY - this.engine.camera.position.y) * 0.1;
    this.engine.camera.position.z += (targetZ - this.engine.camera.position.z) * 0.1;

    // 看向玩家
    this.engine.camera.lookAt(playerPos.x, playerPos.y + 1, playerPos.z);
  }

  /**
   * 更新HUD显示
   */
  private updateHUD(): void {
    const progress = getPlayerProgress();

    this.hud.updateStableStatus({
      speedLevel: progress.speedLevel,
      totalTrophies: progress.totalTrophies,
      currentSpeed: progress.calculateCurrentSpeed(),
      bestDistance: progress.bestDistance,
      isTraining: this.currentTreadmill !== null && this.currentTreadmill.isUnlocked,
      trainingLevel: this.currentTreadmill?.level ?? 0,
      rebirthCount: progress.rebirthCount,
      trainingMultiplier: getRebirthTrainingMultiplier(progress.rebirthCount),
    });
  }

  /**
   * 创建底部按钮栏（统一容器，自动居中排列）
   */
  private createBottomButtons(): void {
    // 创建容器
    this.bottomBar = document.createElement('div');
    this.bottomBar.style.cssText = `
      position: fixed; bottom: 20px; left: 50%;
      transform: translateX(-50%);
      display: flex; gap: 8px;
      z-index: 9000;
    `;

    const FONT = "'Arial Rounded MT Bold', 'Nunito', sans-serif";
    const btnStyle = (bg: string, color: string, extra: string = '') => `
      padding: 10px 20px; border: 3px solid #000; border-radius: 14px;
      font-size: 16px; font-weight: 900; cursor: pointer;
      box-shadow: 0 4px 0 #000; font-family: ${FONT};
      transition: transform 0.1s; white-space: nowrap;
      background: ${bg}; color: ${color}; ${extra}
    `;

    const makeBtn = (label: string, bg: string, color: string, onClick: () => void, extra: string = ''): HTMLButtonElement => {
      const btn = document.createElement('button');
      btn.innerHTML = label;
      btn.style.cssText = btnStyle(bg, color, extra);
      btn.addEventListener('mousedown', (e) => { e.stopPropagation(); btn.style.transform = 'translateY(2px)'; });
      btn.addEventListener('mouseup', (e) => { e.stopPropagation(); btn.style.transform = ''; });
      btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
      return btn;
    };

    // 坐骑
    this.mountBtn = makeBtn('🐴 坐骑', '#FFD700', '#000', () => this.openMountUI());
    this.bottomBar.appendChild(this.mountBtn);

    // 天赋
    this.talentBtn = makeBtn('⚡ 天赋', 'linear-gradient(135deg, #FFD700, #FFA500)', '#000', () => this.openTalentUI());
    this.bottomBar.appendChild(this.talentBtn);

    // 重生
    this.rebirthBtn = makeBtn('\u{1F504} 重生', 'linear-gradient(135deg, #00BCD4, #0097A7)', '#FFF', () => this.openRebirthUI(), 'text-shadow: 1px 1px 0 rgba(0,0,0,0.3);');
    this.bottomBar.appendChild(this.rebirthBtn);

    // 尾迹
    this.trailBtn = makeBtn('\u2728 尾迹', 'linear-gradient(135deg, #9B59B6, #8E44AD)', '#FFF', () => this.openTrailUI(), 'text-shadow: 1px 1px 0 rgba(0,0,0,0.3);');
    this.bottomBar.appendChild(this.trailBtn);

    // 训练师
    this.trainerBtn = makeBtn('\u{1F3C7} 训练师', 'linear-gradient(135deg, #FF9800, #F57C00)', '#FFF', () => this.openTrainerUI(), 'text-shadow: 1px 1px 0 rgba(0,0,0,0.3);');
    this.bottomBar.appendChild(this.trainerBtn);

    // 宠物
    this.petBtn = makeBtn('🐾 宠物', 'linear-gradient(135deg, #4FC3F7, #0288D1)', '#FFF', () => this.openPetUI(), 'text-shadow: 1px 1px 0 rgba(0,0,0,0.3);');
    this.bottomBar.appendChild(this.petBtn);

    // 战绩
    const statsBtn = makeBtn('📊 战绩', 'linear-gradient(135deg, #7E57C2, #5E35B1)', '#FFF', () => this.openStatsUI(), 'text-shadow: 1px 1px 0 rgba(0,0,0,0.3);');
    this.bottomBar.appendChild(statsBtn);

    document.body.appendChild(this.bottomBar);
  }

  /**
   * 打开重生面板
   */
  private openRebirthUI(): void {
    if (!this.rebirthUI) {
      this.rebirthUI = new RebirthUI();
    }
    this.rebirthUI.show();
  }


  /**
   * 打开天赋面板
   */
  private openTalentUI(): void {
    if (!this.talentUI) {
      this.talentUI = new TalentUI();
    }
    this.talentUI.show();
  }

  private createMountGate(): void {
    const gateGroup = new THREE.Group();

    const woodMat = new THREE.MeshToonMaterial({ color: 0x8B6914 });
    const goldMat = new THREE.MeshToonMaterial({ color: 0xFFD700 });
    const goldGlowMat = new THREE.MeshToonMaterial({ color: 0xFFD700, emissive: 0xCC9900, emissiveIntensity: 0.3 });

    // 门柱 — 木质圆柱
    const pillarGeo = new THREE.CylinderGeometry(0.25, 0.3, 4, 10);
    const leftPillar = new THREE.Mesh(pillarGeo, woodMat);
    leftPillar.position.set(-2, 2, 0);
    leftPillar.castShadow = true;
    gateGroup.add(leftPillar);

    const rightPillar = new THREE.Mesh(pillarGeo, woodMat);
    rightPillar.position.set(2, 2, 0);
    rightPillar.castShadow = true;
    gateGroup.add(rightPillar);

    // 柱顶金色马蹄装饰
    const capGeo = new THREE.TorusGeometry(0.2, 0.08, 8, 12, Math.PI);
    const capL = new THREE.Mesh(capGeo, goldGlowMat);
    capL.position.set(-2, 4.15, 0);
    gateGroup.add(capL);
    const capR = new THREE.Mesh(capGeo, goldGlowMat);
    capR.position.set(2, 4.15, 0);
    gateGroup.add(capR);

    // 拱形横梁
    const archGeo = new THREE.TorusGeometry(2, 0.2, 8, 16, Math.PI);
    const arch = new THREE.Mesh(archGeo, woodMat);
    arch.position.set(0, 4, 0);
    arch.castShadow = true;
    gateGroup.add(arch);

    // 拱顶金色马头装饰
    const horseHeadGroup = new THREE.Group();
    // 头部
    const headGeo = new THREE.BoxGeometry(0.4, 0.5, 0.3);
    const head = new THREE.Mesh(headGeo, goldGlowMat);
    head.position.y = 0.1;
    horseHeadGroup.add(head);
    // 耳朵
    const earGeo = new THREE.ConeGeometry(0.06, 0.18, 4);
    const earL = new THREE.Mesh(earGeo, goldGlowMat);
    earL.position.set(-0.12, 0.42, 0);
    horseHeadGroup.add(earL);
    const earR = new THREE.Mesh(earGeo, goldGlowMat);
    earR.position.set(0.12, 0.42, 0);
    horseHeadGroup.add(earR);
    // 鬃毛
    const maneGeo = new THREE.BoxGeometry(0.1, 0.35, 0.15);
    const mane = new THREE.Mesh(maneGeo, new THREE.MeshToonMaterial({ color: 0xB8860B }));
    mane.position.set(0, 0.2, -0.18);
    horseHeadGroup.add(mane);

    horseHeadGroup.position.set(0, 6.1, 0);
    gateGroup.add(horseHeadGroup);

    // "坐骑" 标志
    const signGeo = new THREE.PlaneGeometry(3, 1);
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 256;
    signCanvas.height = 64;
    const ctx = signCanvas.getContext('2d')!;
    // 渐变背景
    const gradient = ctx.createLinearGradient(0, 0, 256, 0);
    gradient.addColorStop(0, '#DAA520');
    gradient.addColorStop(0.5, '#FFD700');
    gradient.addColorStop(1, '#DAA520');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 64);
    // 边框
    ctx.strokeStyle = '#8B6914';
    ctx.lineWidth = 3;
    ctx.strokeRect(3, 3, 250, 58);
    // 文字
    ctx.fillStyle = '#4A2500';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐴 坐骑', 128, 34);

    const signTexture = new THREE.CanvasTexture(signCanvas);
    const signMaterial = new THREE.MeshBasicMaterial({
      map: signTexture,
      side: THREE.DoubleSide,
    });
    const sign = new THREE.Mesh(signGeo, signMaterial);
    sign.position.set(0, 3, 0.3);
    gateGroup.add(sign);

    // 发光地板指示 — 金色
    const glowGeo = new THREE.PlaneGeometry(4, 3);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xFFD700,
      transparent: true,
      opacity: 0.25,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.01;
    gateGroup.add(glow);

    // 两侧小栅栏装饰
    const fenceMat = new THREE.MeshToonMaterial({ color: 0x6B4F1A });
    for (const side of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        const postGeo = new THREE.CylinderGeometry(0.06, 0.08, 1.2, 6);
        const post = new THREE.Mesh(postGeo, fenceMat);
        post.position.set(side * (3 + i * 1.2), 0.6, 0);
        gateGroup.add(post);
      }
      const railGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6);
      railGeo.rotateZ(Math.PI / 2);
      const rail = new THREE.Mesh(railGeo, woodMat);
      rail.position.set(side * 3.6, 0.85, 0);
      gateGroup.add(rail);
    }

    // 放在马棚左侧（与跑酷门对称）
    gateGroup.position.set(-(this.STABLE_WIDTH / 2 - 2), 0, 5);
    gateGroup.rotation.y = Math.PI / 2; // 面朝马棚内部（X+方向）
    this.engine.world.scene.add(gateGroup);
    this.mountGate = gateGroup;
  }

  /**
   * 检测坐骑入口交互
   */
  private checkMountGateInteraction(): void {
    if (!this.playerHorse || !this.mountGate) return;

    const playerPos = this.playerHorse.position;
    const gatePos = this.mountGate.position;

    const dx = Math.abs(playerPos.x - gatePos.x);
    const dz = Math.abs(playerPos.z - gatePos.z);

    const inRange = dx < 2.5 && dz < 2.5;

    if (inRange && !this.mountGateTriggered) {
      this.mountGateTriggered = true;
      this.openMountUI();
    } else if (!inRange) {
      // 离开范围后重置，允许下次再触发
      this.mountGateTriggered = false;
    }
  }

  /**
   * 打开坐骑面板
   */
  private openMountUI(): void {
    if (!this.mountUI) {
      this.mountUI = new MountUI();
      this.mountUI.onEquip((mountId: string) => {
        this.refreshPlayerHorse();
      });
    }
    this.mountUI.show();
  }

  // ============ 尾迹系统 ============

  // 尾迹按钮已移至 createBottomButtons()

  /**
   * 打开尾迹面板
   */
  private openTrailUI(): void {
    if (!this.trailUI) {
      this.trailUI = new TrailUI();
      this.trailUI.onEquip((trailId: string) => {
        this.refreshPlayerHorse();
      });
    }
    this.trailUI.show();
  }

  // 训练师按钮已移至 createBottomButtons()

  /**
   * 打开训练师面板
   */
  private openTrainerUI(): void {
    if (!this.trainerUI) {
      this.trainerUI = new TrainerUI();
      this.trainerUI.onEquip((_trainerId: string) => {
        this.refreshPlayerHorse();
      });
    }
    this.trainerUI.show();
  }

  // ============ 宠物系统 ============

  /**
   * 创建宠物蛋 3D 模型 — 放在场景右侧（与坐骑门对称）
   */
  private createPetEgg(): void {
    const eggGroup = new THREE.Group();

    // 蛋体（椭球）
    const eggGeo = new THREE.SphereGeometry(1.2, 16, 16);
    const eggMat = new THREE.MeshToonMaterial({ color: 0xFFE4E1 });
    const egg = new THREE.Mesh(eggGeo, eggMat);
    egg.scale.set(1, 1.3, 1);
    egg.position.y = 1.5;
    eggGroup.add(egg);

    // 彩色斑点
    const spotColors = [0xFF69B4, 0x9B59B6, 0x3498DB, 0x2ECC71, 0xF1C40F];
    for (let i = 0; i < 8; i++) {
      const spotGeo = new THREE.SphereGeometry(0.15 + Math.random() * 0.1, 8, 8);
      const spotMat = new THREE.MeshToonMaterial({ color: spotColors[i % spotColors.length] });
      const spot = new THREE.Mesh(spotGeo, spotMat);
      const angle = (i / 8) * Math.PI * 2;
      const height = 0.8 + Math.random() * 1.2;
      spot.position.set(
        Math.sin(angle) * (0.8 + Math.random() * 0.3),
        height + 0.8,
        Math.cos(angle) * (0.8 + Math.random() * 0.3)
      );
      eggGroup.add(spot);
    }

    // 浮动问号标识
    const questionGroup = new THREE.Group();
    // 问号球
    const qBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 10, 10),
      new THREE.MeshToonMaterial({ color: 0xFFD700, emissive: 0xCC9900, emissiveIntensity: 0.3 })
    );
    qBall.position.y = 3.5;
    questionGroup.add(qBall);
    // 问号文字（简单用小圆柱代替）
    const qMark = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.15, 8),
      new THREE.MeshToonMaterial({ color: 0xFFFFFF })
    );
    qMark.position.y = 3.1;
    questionGroup.add(qMark);
    eggGroup.add(questionGroup);

    // 底座
    const baseMat = new THREE.MeshToonMaterial({ color: 0x8B6914 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 0.4, 16), baseMat);
    base.position.y = 0.2;
    eggGroup.add(base);

    // 放在马棚右侧中央（原跑酷门位置，显眼位置）
    const eggX = this.STABLE_WIDTH / 2 - 3;
    const eggZ = 5;
    eggGroup.position.set(eggX, 0, eggZ);
    this.engine.world.scene.add(eggGroup);
    this.petEgg = eggGroup;

    // 字牌 — 独立于 eggGroup（不跟随旋转），悬浮在蛋上方
    const signGroup = new THREE.Group();
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 256;
    signCanvas.height = 72;
    const sCtx = signCanvas.getContext('2d')!;
    // 圆角背景
    sCtx.fillStyle = 'rgba(0,0,0,0.35)';
    sCtx.beginPath();
    sCtx.roundRect(4, 4, 248, 64, 14);
    sCtx.fill();
    const grad = sCtx.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0, '#FF69B4');
    grad.addColorStop(0.5, '#FFD700');
    grad.addColorStop(1, '#FF69B4');
    sCtx.fillStyle = grad;
    sCtx.beginPath();
    sCtx.roundRect(6, 6, 244, 60, 12);
    sCtx.fill();
    // 文字
    sCtx.fillStyle = '#FFFFFF';
    sCtx.font = 'bold 36px Arial';
    sCtx.textAlign = 'center';
    sCtx.textBaseline = 'middle';
    sCtx.shadowColor = 'rgba(0,0,0,0.5)';
    sCtx.shadowBlur = 4;
    sCtx.fillText('宠物蛋', 128, 36);
    const signTex = new THREE.CanvasTexture(signCanvas);
    const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true, side: THREE.DoubleSide });
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.7), signMat);
    signGroup.add(signMesh);

    signGroup.position.set(eggX, 4.2, eggZ);
    this.engine.world.scene.add(signGroup);
    this.petEggSign = signGroup;
  }

  /**
   * 更新宠物蛋 idle 动画（旋转 + 上下浮动）
   */
  private updatePetEggAnim(deltaTime: number): void {
    if (!this.petEgg) return;
    this.petEggAnimTime += deltaTime;
    // 缓慢旋转
    this.petEgg.rotation.y += deltaTime * 0.3;
    // 上下浮动
    const bobY = Math.sin(this.petEggAnimTime * 1.5) * 0.15;
    this.petEgg.position.y = bobY;
    // 字牌跟随浮动 + 面朝相机
    if (this.petEggSign) {
      this.petEggSign.position.y = 4.2 + bobY;
      // billboard：让字牌始终面朝相机
      const cam = this.engine.camera;
      this.petEggSign.lookAt(cam.position.x, this.petEggSign.position.y, cam.position.z);
    }
  }

  /**
   * 检测宠物蛋交互
   */
  private checkPetEggInteraction(): void {
    if (!this.playerHorse || !this.petEgg) return;

    const playerPos = this.playerHorse.position;
    const eggPos = this.petEgg.position;

    const dx = Math.abs(playerPos.x - eggPos.x);
    const dz = Math.abs(playerPos.z - eggPos.z);

    const inRange = dx < 3 && dz < 3;

    if (inRange) {
      if (!this.petEggTriggered) {
        this.petEggTriggered = true;
        this.openPetGachaUI();
      }
    } else {
      // 离开范围后重置，允许再次触发
      this.petEggTriggered = false;
    }
  }

  // 宠物按钮已移至 createBottomButtons()

  /**
   * 打开抽蛋面板
   */
  private openPetGachaUI(): void {
    if (!this.petGachaUI) {
      this.petGachaUI = new PetGachaUI();
      this.petGachaUI.onGacha(() => {
        this.refreshPets();
        this.updateHUD();
      });
    }
    this.petGachaUI.show();
  }

  /**
   * 打开宠物管理面板
   */
  private openPetUI(): void {
    if (!this.petUI) {
      this.petUI = new PetUI();
      this.petUI.onChange(() => {
        this.refreshPets();
      });
    }
    this.petUI.show();
  }

  private openStatsUI(): void {
    if (!this.statsUI) {
      this.statsUI = new StatsUI(new GeminiArchitect());
    }
    this.statsUI.show();
  }

  /**
   * 刷新宠物跟随实体（装备变化后调用）
   */
  private refreshPets(): void {
    // 清除旧宠物实体
    for (const pet of this.petEntities) {
      pet.removeFromScene();
      pet.destroy();
    }
    this.petEntities = [];

    const progress = getPlayerProgress();
    const equippedPets = progress.getEquippedPets();

    // 宠物跟随偏移位置
    const offsets = [
      new THREE.Vector3(-1.5, 0, -2.5),
      new THREE.Vector3(0, 0, -3.5),
      new THREE.Vector3(1.5, 0, -2.5),
    ];

    // 创建新宠物实体
    for (let i = 0; i < equippedPets.length; i++) {
      const petDef = getPetById(equippedPets[i]);
      const pet = new Pet(petDef);
      pet.setFollowOffset(offsets[i] || offsets[0]);

      // 设置初始位置在马匹附近
      if (this.playerHorse) {
        const pos = this.playerHorse.position;
        pet.setPosition(pos.x + (offsets[i]?.x || 0), 0.5, pos.z + (offsets[i]?.z || 0));
      }

      pet.addToScene(this.engine.world.scene);
      this.petEntities.push(pet);
    }

    // 更新马匹宠物速度加成
    this.applyPetBonusToHorse();
  }

  /**
   * 计算并应用宠物速度加成到马匹
   */
  private applyPetBonusToHorse(): void {
    if (!this.playerHorse) return;

    const progress = getPlayerProgress();
    const equippedPets = progress.getEquippedPets();

    let totalBonus = 0;
    for (const petId of equippedPets) {
      const petDef = getPetById(petId);
      totalBonus += getPetSpeedBonus(petDef.speedMultiplier);
    }

    this.playerHorse.applyPetStats(totalBonus);
  }

  /**
   * 每帧更新宠物跟随位置
   */
  private updatePetFollow(deltaTime: number): void {
    if (!this.playerHorse || this.petEntities.length === 0) return;

    const playerPos = this.playerHorse.position;
    const playerRotY = this.playerHorse.rotation.y;

    for (const pet of this.petEntities) {
      pet.setFollowTarget(playerPos, playerRotY);
      pet.update(deltaTime);
    }
  }

  /**
   * 刷新马棚中的马匹外观（装备坐骑后调用）
   */
  private refreshPlayerHorse(): void {
    if (!this.playerHorse) return;

    // 保存当前位置和旋转
    const pos = this.playerHorse.position.clone();
    const rot = this.playerHorse.rotation.clone();

    // 从场景移除旧马匹
    this.playerHorse.removeFromScene();
    this.playerHorse.destroy();

    // 创建新马匹
    this.createPlayerHorse();

    // 恢复位置和旋转
    if (this.playerHorse) {
      this.playerHorse.setPosition(pos.x, pos.y, pos.z);
      this.playerHorse.setRotation(rot.x, rot.y, rot.z);
    }
  }

  /**
   * 销毁场景
   */
  onDestroy(): void {
    // 移除鼠标控制
    this.removeMouseControls();

    // 清理底部按钮栏
    if (this.bottomBar) {
      this.bottomBar.remove();
      this.bottomBar = null;
    }
    this.mountBtn = null;
    this.talentBtn = null;
    this.rebirthBtn = null;
    this.trailBtn = null;
    this.trainerBtn = null;
    this.petBtn = null;

    // 清理坐骑 UI
    if (this.mountUI) {
      this.mountUI.dispose();
      this.mountUI = null;
    }

    // 清理天赋 UI
    if (this.talentUI) {
      this.talentUI.dispose();
      this.talentUI = null;
    }

    // 清理重生 UI
    if (this.rebirthUI) {
      this.rebirthUI.dispose();
      this.rebirthUI = null;
    }

    // 清理尾迹 UI 和特效
    if (this.trailUI) {
      this.trailUI.dispose();
      this.trailUI = null;
    }
    if (this.trailEffect) {
      this.trailEffect.dispose();
      this.trailEffect = null;
    }

    // 清理训练师 UI
    if (this.trainerUI) {
      this.trainerUI.dispose();
      this.trainerUI = null;
    }

    // 清理跑酷配置面板
    if (this.parkourConfigUI) {
      this.parkourConfigUI.dispose();
      this.parkourConfigUI = null;
    }

    // 清理宠物系统
    if (this.petGachaUI) {
      this.petGachaUI.dispose();
      this.petGachaUI = null;
    }
    if (this.petUI) {
      this.petUI.dispose();
      this.petUI = null;
    }
    if (this.statsUI) {
      this.statsUI.dispose();
      this.statsUI = null;
    }
    for (const pet of this.petEntities) {
      pet.destroy();
    }
    this.petEntities = [];
    this.petEgg = null;
    if (this.petEggSign) {
      this.engine.world.scene.remove(this.petEggSign);
      this.petEggSign = null;
    }

    // 清理环境组
    this.environmentGroup = null;

    // 清理加载提示
    this.hideLoadingOverlay();

    // 清理跑步机
    for (const treadmill of this.treadmills) {
      treadmill.destroy();
    }
    this.treadmills = [];

    // 清理马匹
    if (this.playerHorse) {
      this.playerHorse.destroy();
      this.playerHorse = null;
    }

    this.isInitialized = false;
  }
}
