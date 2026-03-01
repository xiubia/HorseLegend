// 竞速场景 - 60秒限时自动跑

import * as THREE from 'three';
import type { Engine } from '../../engine/Engine';
import type { GameScene } from '../../engine/SceneManager';
import { Horse } from '../../entities/Horse';
import { HUD } from '../../ui/HUD';
import { getPlayerProgress } from '../../data/PlayerProgress';
import { RewardSystem, RaceReward } from '../../systems/RewardSystem';
import { getTheme, ThemeDef, createThemeFence, DEFAULT_THEME, getThemeIds } from '../../ai/ThemeRegistry';
import { getMountById } from '../../data/MountRegistry';
import { getTalentValue } from '../../data/TalentRegistry';
import { getTrailById } from '../../data/TrailRegistry';
import { getTotalTrainerBonuses } from '../../data/TrainerRegistry';
import { TrailEffect } from '../../entities/TrailEffect';
import { Pet } from '../../entities/Pet';
import { getPetById, getPetSpeedBonus } from '../../data/PetRegistry';

/**
 * 比赛结果
 */
export interface RaceResult {
  distance: number;
  trophies: number;
  isNewRecord: boolean;
  milestones: number[];
  duration?: number;  // 秒
}

/**
 * 场景回调
 */
export interface RaceSceneCallbacks {
  onRaceEnd: (result: RaceResult) => void;
}

/**
 * 竞速场景
 */
export class RaceScene implements GameScene {
  private engine: Engine;
  private hud: HUD;
  private callbacks: RaceSceneCallbacks;

  // 实体
  private playerHorse: Horse | null = null;
  private trailEffect: TrailEffect | null = null;
  private petEntities: Pet[] = [];

  // 赛道相关
  private trackObjects: THREE.Object3D[] = [];
  private lastTrackZ: number = 0;
  private readonly TRACK_SEGMENT_LENGTH = 50;
  private readonly TRACK_WIDTH = 10;

  // 比赛状态
  private isInitialized = false;
  private isRacing = false;
  private remainingTime = 60;
  private distance = 0;
  private readonly RACE_DURATION = 60;

  // 奖励系统
  private rewardSystem: RewardSystem;
  private collectedMilestones: number[] = [];

  // 装饰物
  private decorations: THREE.Object3D[] = [];

  // 主题系统
  private currentTheme: ThemeDef = DEFAULT_THEME;
  private themeChangeDistance: number = 800; // 首次切换在 800m

  // 相机控制
  private cameraAngleY: number = 0;  // 水平旋转角度
  private isMouseDown: boolean = false;
  private lastMouseX: number = 0;

  // 玩家左右移动
  private readonly LATERAL_SPEED = 8;  // 左右移动速度
  private readonly TRACK_HALF_WIDTH = 4;  // 跑道半宽（留一点边距）
  private lastLateralInput: number = 0;  // 保存横向输入用于倾斜动画

  // 鼠标事件绑定
  private boundOnMouseDown: (e: MouseEvent) => void;
  private boundOnMouseUp: (e: MouseEvent) => void;
  private boundOnMouseMove: (e: MouseEvent) => void;

  constructor(engine: Engine, hud: HUD, callbacks: RaceSceneCallbacks) {
    this.engine = engine;
    this.hud = hud;
    this.callbacks = callbacks;
    this.rewardSystem = new RewardSystem();

    // 绑定鼠标事件
    this.boundOnMouseDown = this.onMouseDown.bind(this);
    this.boundOnMouseUp = this.onMouseUp.bind(this);
    this.boundOnMouseMove = this.onMouseMove.bind(this);
  }

  /**
   * 鼠标按下
   */
  private onMouseDown(e: MouseEvent): void {
    this.isMouseDown = true;
    this.lastMouseX = e.clientX;
  }

  /**
   * 鼠标松开
   */
  private onMouseUp(): void {
    this.isMouseDown = false;
  }

  /**
   * 鼠标移动 - 旋转视角
   */
  private onMouseMove(e: MouseEvent): void {
    if (!this.isMouseDown) return;

    const deltaX = e.clientX - this.lastMouseX;
    this.lastMouseX = e.clientX;

    // 更新相机水平角度（正值向右旋转）
    this.cameraAngleY += deltaX * 0.005;
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

    // 重置状态
    this.remainingTime = this.RACE_DURATION;
    this.distance = 0;
    this.collectedMilestones = [];
    this.lastTrackZ = 0;

    // 重置主题为默认草原
    this.currentTheme = DEFAULT_THEME;
    this.themeChangeDistance = 800;

    // 创建环境（使用主题颜色）
    this.createEnvironment();

    // 创建初始赛道
    this.createInitialTrack();

    // 创建玩家马匹
    this.createPlayerHorse();

    // 创建跟随宠物
    this.createPets();

    // 设置相机
    this.setupCamera();

    // 添加鼠标事件监听
    document.addEventListener('mousedown', this.boundOnMouseDown);
    document.addEventListener('mouseup', this.boundOnMouseUp);
    document.addEventListener('mousemove', this.boundOnMouseMove);

    // 直接开始比赛
    this.startRace();
  }

  /**
   * 创建环境
   */
  private createEnvironment(): void {
    const theme = this.currentTheme;

    // 天空和雾（使用主题颜色）
    this.engine.world.scene.background = new THREE.Color(theme.skyColor);
    this.engine.world.scene.fog = new THREE.Fog(theme.fogColor, theme.fogNear, theme.fogFar);

    // 光照（使用主题参数）
    this.engine.world.createAmbientLight(0xffffff, theme.ambientIntensity);
    const sunLight = this.engine.world.createDirectionalLight(theme.sunColor, theme.sunIntensity, { x: 10, y: 30, z: 20 });
    sunLight.shadow.camera.left = -50;
    sunLight.shadow.camera.right = 50;
    sunLight.shadow.camera.top = 50;
    sunLight.shadow.camera.bottom = -50;

    // 创建太阳
    const sunGeometry = new THREE.SphereGeometry(5, 16, 16);
    const sunMaterial = new THREE.MeshToonMaterial({ color: 0xFFFF00 });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.position.set(50, 80, 100);
    this.engine.world.scene.add(sun);
  }

  /**
   * 创建初始赛道
   */
  private createInitialTrack(): void {
    // 创建起始区域和前方赛道
    for (let i = -2; i < 10; i++) {
      this.createTrackSegment(i * this.TRACK_SEGMENT_LENGTH);
    }

    // 起跑门
    this.createStartGate();
  }

  /**
   * 创建赛道段
   */
  private createTrackSegment(z: number): void {
    const group = new THREE.Group();

    // 设置 Group 位置，用于后续移除判断
    group.position.z = z;
    // 存储起始 Z 值用于精确判断
    group.userData.startZ = z;

    // 主赛道（使用主题颜色）
    const trackGeometry = new THREE.PlaneGeometry(this.TRACK_WIDTH, this.TRACK_SEGMENT_LENGTH);
    const trackMaterial = new THREE.MeshToonMaterial({ color: this.currentTheme.trackColor });
    const track = new THREE.Mesh(trackGeometry, trackMaterial);
    track.rotation.x = -Math.PI / 2;
    track.position.z = this.TRACK_SEGMENT_LENGTH / 2;
    track.receiveShadow = true;
    group.add(track);

    // 赛道边线（使用主题颜色）
    const lineGeometry = new THREE.PlaneGeometry(0.3, this.TRACK_SEGMENT_LENGTH);
    const lineMaterial = new THREE.MeshToonMaterial({ color: this.currentTheme.trackLineColor });

    const leftLine = new THREE.Mesh(lineGeometry, lineMaterial);
    leftLine.rotation.x = -Math.PI / 2;
    leftLine.position.set(-this.TRACK_WIDTH / 2 + 0.5, 0.01, this.TRACK_SEGMENT_LENGTH / 2);
    group.add(leftLine);

    const rightLine = new THREE.Mesh(lineGeometry, lineMaterial);
    rightLine.rotation.x = -Math.PI / 2;
    rightLine.position.set(this.TRACK_WIDTH / 2 - 0.5, 0.01, this.TRACK_SEGMENT_LENGTH / 2);
    group.add(rightLine);

    // 草地两侧（使用主题颜色）
    const grassGeometry = new THREE.PlaneGeometry(30, this.TRACK_SEGMENT_LENGTH);
    const grassMaterial = new THREE.MeshToonMaterial({ color: this.currentTheme.grassColor });

    const leftGrass = new THREE.Mesh(grassGeometry, grassMaterial);
    leftGrass.rotation.x = -Math.PI / 2;
    leftGrass.position.set(-this.TRACK_WIDTH / 2 - 15, -0.01, this.TRACK_SEGMENT_LENGTH / 2);
    leftGrass.receiveShadow = true;
    group.add(leftGrass);

    const rightGrass = new THREE.Mesh(grassGeometry, grassMaterial);
    rightGrass.rotation.x = -Math.PI / 2;
    rightGrass.position.set(this.TRACK_WIDTH / 2 + 15, -0.01, this.TRACK_SEGMENT_LENGTH / 2);
    rightGrass.receiveShadow = true;
    group.add(rightGrass);

    // 添加装饰（树木、围栏等）
    this.addDecorations(group, z);

    // 距离标记（每100米）
    const segmentStart = Math.floor(z / 100) * 100;
    const segmentEnd = z + this.TRACK_SEGMENT_LENGTH;
    for (let marker = segmentStart; marker < segmentEnd; marker += 100) {
      if (marker > 0 && marker >= z && marker < z + this.TRACK_SEGMENT_LENGTH) {
        this.addDistanceMarker(group, marker);
      }
    }

    this.engine.world.scene.add(group);
    this.trackObjects.push(group);
    this.lastTrackZ = z + this.TRACK_SEGMENT_LENGTH;
  }

  /**
   * 添加装饰物（使用 ThemeRegistry 主题装饰系统）
   */
  private addDecorations(group: THREE.Group, _z: number): void {
    const theme = this.currentTheme;

    // 主题栅栏：每 ~17m 一组（左右各一）
    for (let i = 0; i < 3; i++) {
      const fenceZ = i * (this.TRACK_SEGMENT_LENGTH / 3) + 5;

      const leftFence = createThemeFence(theme);
      leftFence.position.set(-this.TRACK_WIDTH / 2 - 1, 0, fenceZ);
      group.add(leftFence);

      const rightFence = createThemeFence(theme);
      rightFence.position.set(this.TRACK_WIDTH / 2 + 1, 0, fenceZ);
      group.add(rightFence);
    }

    // 主题侧边装饰物（按概率在赛道两侧放置，与 ChunkManager 相同逻辑）
    const step = 5; // 每 5 米检查一次
    for (let localZ = 0; localZ < this.TRACK_SEGMENT_LENGTH; localZ += step) {
      for (const deco of theme.sideDecorations) {
        if (Math.random() > deco.probability) continue;
        const side = Math.random() > 0.5 ? 1 : -1;
        const dist = deco.minDistFromTrack + Math.random() * (deco.maxDistFromTrack - deco.minDistFromTrack);
        const decoX = side * (this.TRACK_WIDTH / 2 + dist);
        const decoZ = localZ + Math.random() * step;
        const mesh = deco.createMesh();
        if (deco.scale) mesh.scale.multiplyScalar(deco.scale);
        mesh.position.set(decoX, 0, decoZ);
        mesh.rotation.y = Math.random() * Math.PI * 2;
        group.add(mesh);
      }
    }
  }

  /**
   * 添加距离标记
   */
  private addDistanceMarker(group: THREE.Group, distance: number): void {
    const markerGroup = new THREE.Group();

    // 标记牌
    const signGeometry = new THREE.BoxGeometry(2, 1, 0.1);
    const signMaterial = new THREE.MeshToonMaterial({ color: 0xFFD700 });
    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.position.y = 1.5;
    markerGroup.add(sign);

    // 支柱
    const poleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8);
    const poleMaterial = new THREE.MeshToonMaterial({ color: 0x333333 });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.y = 0.75;
    markerGroup.add(pole);

    // 使用相对于 group 的位置（distance - group.userData.startZ）
    const startZ = (group.userData.startZ as number) ?? 0;
    markerGroup.position.set(this.TRACK_WIDTH / 2 + 2, 0, distance - startZ);
    group.add(markerGroup);
  }

  /**
   * 创建起跑门
   */
  private createStartGate(): void {
    const gate = new THREE.Group();

    // 门柱
    const pillarGeometry = new THREE.BoxGeometry(0.5, 5, 0.5);
    const pillarMaterial = new THREE.MeshToonMaterial({ color: 0xFFD700 });

    const leftPillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    leftPillar.position.set(-this.TRACK_WIDTH / 2, 2.5, 0);
    gate.add(leftPillar);

    const rightPillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    rightPillar.position.set(this.TRACK_WIDTH / 2, 2.5, 0);
    gate.add(rightPillar);

    // 横梁
    const beamGeometry = new THREE.BoxGeometry(this.TRACK_WIDTH + 1, 0.8, 0.5);
    const beam = new THREE.Mesh(beamGeometry, pillarMaterial);
    beam.position.set(0, 5, 0);
    gate.add(beam);

    // "开始" 标牌
    const signGeometry = new THREE.PlaneGeometry(4, 1.5);
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(0, 0, 256, 96);
    ctx.fillStyle = '#8B0000';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('开始', 128, 48);

    const texture = new THREE.CanvasTexture(canvas);
    const signMaterial = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
    const sign = new THREE.Mesh(signGeometry, signMaterial);
    // 调整位置和旋转，让文字面向玩家（Z+ 方向）
    sign.position.set(0, 4, -0.3);
    sign.rotation.y = Math.PI;
    gate.add(sign);

    this.engine.world.scene.add(gate);
  }

  /**
   * 创建玩家马匹
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

    // 创建尾迹特效
    this.trailEffect = new TrailEffect(this.engine.world.scene);
    this.trailEffect.setTrail(trail);

    // 应用天赋移速加成
    this.playerHorse.talentSpeedBonus = getTalentValue('speedBonus', progress.getTalentLevel('speedBonus'));

    // 设置速度等级
    this.playerHorse.setSpeedLevel(progress.speedLevel);

    // 设置初始位置
    this.playerHorse.setPosition(0, 0, -5);
    this.playerHorse.addToScene(this.engine.world.scene);
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

  /**
   * 设置相机
   */
  private setupCamera(): void {
    this.engine.camera.position.set(0, 8, -15);
    this.engine.camera.lookAt(0, 1, 10);
  }

  /**
   * 开始比赛
   */
  private startRace(): void {
    this.isRacing = true;
    if (this.playerHorse) {
      this.playerHorse.startRunning();
    }
  }

  /**
   * 每帧更新
   */
  onUpdate(deltaTime: number): void {
    if (!this.playerHorse) return;

    // 处理玩家左右移动
    this.handlePlayerLateralMovement(deltaTime);

    // 更新马匹
    this.playerHorse.update(deltaTime);

    // 更新尾迹特效
    if (this.trailEffect && this.playerHorse.mesh) {
      this.trailEffect.update(this.playerHorse.position, this.playerHorse.speed, deltaTime);
    }

    // 更新宠物跟随
    this.updatePets(deltaTime);

    // 应用倾斜效果（在 update/syncMesh 之后，否则会被覆盖）
    if (this.playerHorse.mesh) {
      if (this.lastLateralInput !== 0) {
        // 倾斜方向修正（由于模型去除了 Math.PI，现在正确的前进倾侧需要加上负号）
        // D → lastLateralInput=-1 → -(-1)*0.15=+0.15 → 屏幕右倾 ✓
        this.playerHorse.mesh.rotation.z = -this.lastLateralInput * 0.15;
      } else {
        // 平滑回正
        this.playerHorse.mesh.rotation.z *= 0.9;
      }
    }

    if (this.isRacing) {
      // 更新距离
      this.distance = this.playerHorse.currentProgress;

      // 更新倒计时
      this.remainingTime -= deltaTime;
      if (this.remainingTime <= 0) {
        this.remainingTime = 0;
        this.endRace();
        return;
      }

      // 检查里程碑
      this.checkMilestones();

      // 动态生成赛道
      this.updateTrack();

      // 更新相机跟随
      this.updateCamera();

      // 更新HUD
      this.updateHUD();
    }
  }

  /**
   * 处理玩家左右移动
   */
  private handlePlayerLateralMovement(deltaTime: number): void {
    if (!this.playerHorse || !this.isRacing) {
      this.lastLateralInput = 0;
      return;
    }

    // 坐标系关键：相机在马后方看向 +Z，此时屏幕右方 = 世界 -X
    // 所以 D 键（rawInput=+1）需要让 position.x 减小（-X = 屏幕右方）
    const rawInput = this.engine.input.getAxis('horizontal');
    const lateralInput = -rawInput; // 取反适配相机坐标系
    this.lastLateralInput = lateralInput; // 保存屏幕方向正确的值

    if (lateralInput === 0) return;

    // 计算新位置
    const currentX = this.playerHorse.position.x;
    const newX = currentX + lateralInput * this.LATERAL_SPEED * deltaTime;

    // 限制在跑道范围内
    const clampedX = Math.max(-this.TRACK_HALF_WIDTH, Math.min(this.TRACK_HALF_WIDTH, newX));

    // 更新位置（只改变X，不影响前进方向）
    this.playerHorse.setPosition(clampedX, this.playerHorse.position.y, this.playerHorse.position.z);
  }

  /**
   * 检查里程碑
   */
  private checkMilestones(): void {
    const newMilestones = this.rewardSystem.checkMilestones(this.distance, this.collectedMilestones);

    for (const milestone of newMilestones) {
      this.collectedMilestones.push(milestone.distance);
      this.hud.showMessage(`${milestone.distance}m! +${milestone.trophies} 奖杯`, 1500);
    }
  }

  /**
   * 更新赛道（动态生成）
   */
  private updateTrack(): void {
    if (!this.playerHorse) return;

    const playerZ = this.playerHorse.position.z;

    // 主题切换：超过切换距离时随机选择新主题
    if (playerZ >= this.themeChangeDistance) {
      const ids = getThemeIds();
      const currentId = this.currentTheme.id;
      // 选一个不同的主题
      let newId = currentId;
      while (newId === currentId && ids.length > 1) {
        newId = ids[Math.floor(Math.random() * ids.length)];
      }
      this.currentTheme = getTheme(newId);
      this.themeChangeDistance += 600 + Math.random() * 400;

      // 平滑切换天空/雾颜色
      const scene = this.engine.world.scene;
      if (scene.background instanceof THREE.Color) {
        scene.background.set(this.currentTheme.skyColor);
      }
      if (scene.fog instanceof THREE.Fog) {
        scene.fog.color.set(this.currentTheme.fogColor);
        scene.fog.near = this.currentTheme.fogNear;
        scene.fog.far = this.currentTheme.fogFar;
      }
    }

    // 生成新的赛道段（前方 500 米确保不会虚空）
    while (this.lastTrackZ < playerZ + 500) {
      this.createTrackSegment(this.lastTrackZ);
    }

    // 移除太远的赛道段（后方 150 米）
    const removeThreshold = playerZ - 150;
    for (let i = this.trackObjects.length - 1; i >= 0; i--) {
      const segment = this.trackObjects[i];
      // 使用 group 的 position.z（已正确设置）
      const segmentEndZ = segment.position.z + this.TRACK_SEGMENT_LENGTH;
      if (segmentEndZ < removeThreshold) {
        this.engine.world.scene.remove(segment);
        this.trackObjects.splice(i, 1);
      }
    }
  }

  /**
   * 更新相机 - 支持旋转视角，相机始终跟随玩家
   */
  private updateCamera(): void {
    if (!this.playerHorse) return;

    const playerPos = this.playerHorse.position;
    const cameraDistance = 12;
    const cameraHeight = 6;

    // 基于旋转角度计算相机位置偏移（相对于玩家）
    const offsetX = Math.sin(this.cameraAngleY) * cameraDistance;
    const offsetZ = -Math.cos(this.cameraAngleY) * cameraDistance;

    // 相机位置直接跟随玩家（无延迟），确保相机始终围绕玩家旋转
    this.engine.camera.position.x = playerPos.x + offsetX;
    this.engine.camera.position.y = cameraHeight;
    this.engine.camera.position.z = playerPos.z + offsetZ;

    // 始终看向玩家位置
    this.engine.camera.lookAt(
      playerPos.x,
      1.5,
      playerPos.z
    );
  }

  /**
   * 更新HUD
   */
  private updateHUD(): void {
    const progress = getPlayerProgress();
    const nextMilestone = this.rewardSystem.getNextMilestone(this.distance);
    const totalTrophies = this.rewardSystem.calculateTotalTrophies(this.collectedMilestones);

    this.hud.updateRaceStatus({
      remainingTime: this.remainingTime,
      distance: this.distance,
      currentSpeed: this.playerHorse?.speed ?? 0,
      speedLevel: progress.speedLevel,
      trophiesEarned: totalTrophies,
      nextMilestone: nextMilestone?.distance ?? 0,
      nextMilestoneProgress: nextMilestone
        ? Math.min(1, this.distance / nextMilestone.distance)
        : 1,
    });
  }

  /**
   * 结束比赛
   */
  private endRace(): void {
    this.isRacing = false;

    if (this.playerHorse) {
      this.playerHorse.stopRunning();
    }

    // 计算奖励（含天赋加成 + 训练师加成）
    const baseTrophies = this.rewardSystem.calculateTotalTrophies(this.collectedMilestones);
    const progress = getPlayerProgress();
    const trophyBonusPct = getTalentValue('trophyBonus', progress.getTalentLevel('trophyBonus'));
    const trainerBonuses = getTotalTrainerBonuses(progress.getUnlockedTrainers());
    const totalTrophies = Math.floor(baseTrophies * (1 + trophyBonusPct / 100) * (1 + trainerBonuses.totalCoinBonus / 100));
    const isNewRecord = this.distance > progress.bestDistance;

    // 记录结果（含完整历史记录）
    const duration = this.RACE_DURATION - this.remainingTime;
    progress.recordRaceResult(this.distance, totalTrophies, {
      mode: 'race',
      duration,
      timestamp: Date.now(),
    });

    // 显示结果
    const result: RaceResult = {
      distance: Math.round(this.distance),
      trophies: totalTrophies,
      isNewRecord,
      milestones: this.collectedMilestones,
      duration,
    };

    this.hud.showMessage(
      isNewRecord ? `新纪录! ${Math.round(this.distance)}m` : `完成! ${Math.round(this.distance)}m`,
      2000
    );

    // 延迟回调
    setTimeout(() => {
      this.callbacks.onRaceEnd(result);
    }, 2500);
  }

  /**
   * 销毁场景
   */
  onDestroy(): void {
    // 移除鼠标事件监听
    document.removeEventListener('mousedown', this.boundOnMouseDown);
    document.removeEventListener('mouseup', this.boundOnMouseUp);
    document.removeEventListener('mousemove', this.boundOnMouseMove);

    // 清理赛道
    for (const obj of this.trackObjects) {
      this.engine.world.scene.remove(obj);
    }
    this.trackObjects = [];

    // 清理尾迹特效
    if (this.trailEffect) {
      this.trailEffect.dispose();
      this.trailEffect = null;
    }

    // 清理宠物
    for (const pet of this.petEntities) {
      pet.destroy();
    }
    this.petEntities = [];

    // 清理马匹
    if (this.playerHorse) {
      this.playerHorse.destroy();
      this.playerHorse = null;
    }

    // 重置相机角度
    this.cameraAngleY = 0;

    this.isInitialized = false;
    this.isRacing = false;
  }
}
