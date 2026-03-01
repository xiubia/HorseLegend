import * as THREE from 'three';
import { TrackGenerator } from '../ai/generators/TrackGenerator';
import { GeminiArchitect } from '../ai/GeminiArchitect';
import { PlayerBehaviorTracker } from '../systems/PlayerBehaviorTracker';
import { Obstacle, Collectible, AsciiMapChunk, ParkourConfig } from '../data/types/GameTypes';
import { getAssetDef, AssetDef } from '../ai/AssetRegistry';
import { getTheme, ThemeDef, createThemeFence, DEFAULT_THEME } from '../ai/ThemeRegistry';
import { SpawnSceneBuilder } from './SpawnSceneBuilder';

// ============ 常量 ============

const TRACK_WIDTH = 10;
const CHUNK_LENGTH = 50;        // 每个 chunk 的 Z 深度 (20 行 × 2.5m)
const MAP_COLS = 8;
const MAP_ROWS = 20;
const CELL_WIDTH = 1.25;        // 每格宽度 = TRACK_WIDTH / MAP_COLS
const CELL_DEPTH = 2.5;         // 每格深度 = CHUNK_LENGTH / MAP_ROWS

// ============ Chunk 接口 ============

interface Chunk {
  id: string;
  startZ: number;
  endZ: number;
  mesh: THREE.Group;
  obstacles: Obstacle[];
  collectibles: Collectible[];
  mapData?: AsciiMapChunk;
  themeId: string;           // 当前 chunk 使用的主题 ID
  gateZ?: number;            // 选择站拱门 Z 位置（如果本 chunk 有）
  gateMesh?: THREE.Object3D; // 拱门 mesh 引用（用于动画）
  // 材质引用（用于主题过渡时 lerp 颜色）
  trackMat?: THREE.MeshToonMaterial;
  grassMatL?: THREE.MeshToonMaterial;
  grassMatR?: THREE.MeshToonMaterial;
  // AI 存在感扩展数据
  aiComments?: string[];     // AI 弹幕评论队列
  aiNarration?: string;      // AI 场景旁白
  aiAnalysis?: string;       // AI 玩家分析短评
  aiConfidence?: number;     // AI 信心度 (0-100)
}

// ============ 颜色（旧静态颜色，仅做 fallback） ============
// 主题颜色现在由 ThemeRegistry 提供

// ============ ChunkManager ============

export class ChunkManager {
  private scene: THREE.Scene;
  private generator: TrackGenerator;
  private architect: GeminiArchitect;
  private tracker: PlayerBehaviorTracker | null = null;
  private chunks: Chunk[] = [];
  private nextStartZ: number = 0;

  // AI 异步结果缓存
  private pendingAIMap: AsciiMapChunk | null = null;
  private isRequestingAI: boolean = false;
  
  // chunk 生成计数器（用于渐进难度）
  private chunkCounter: number = 0;
  
  // 选择站拱门
  private nextGateZ: number = 250;          // 首个拱门 250m（前 250m 纯热身）
  private static readonly GATE_INTERVAL = 300; // 之后每 300m 一个
  
  // 玩家自定义跑道配置
  private parkourConfig: ParkourConfig | null = null;
  
  // 持久化主题列表：一旦由 parkourConfig 设定，每个 chunk 从中随机选取
  private persistentThemeIds: string[] | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.generator = new TrackGenerator();
    this.architect = new GeminiArchitect();
  }

  /**
   * 设置自定义跑道配置（由 ParkourScene 调用）
   */
  setParkourConfig(config: ParkourConfig): void {
    this.parkourConfig = config;
    // 将配置传递给 AI Architect
    this.architect.parkourConfig = config;
    // 解析并持久化主题列表，后续每个 chunk 从中随机选取
    this.persistentThemeIds = this.resolveThemeList();
  }

  getArchitect(): GeminiArchitect {
    return this.architect;
  }

  setTracker(tracker: PlayerBehaviorTracker) {
    this.tracker = tracker;
  }

  init() {
    // 如果有自定义配置，使用出生点场景生成器为前 2 个 chunk 创建定制场景
    if (this.parkourConfig) {
      const spawnTheme = this.pickRandomTheme();
      // 前 2 个 chunk 是出生区域（无障碍，纯装饰）
      for (let i = 0; i < 2; i++) {
        this.createSpawnChunk(spawnTheme);
      }
      // 后 3 个正常 chunk
      for (let i = 0; i < 3; i++) {
        this.createChunkSync(i === 0 ? 0.5 : 0.8);
      }
    } else {
      // 默认模式：5 个初始 chunk（前 3 个引导，后 2 个低难度）
      for (let i = 0; i < 5; i++) {
        this.createChunkSync(i < 3 ? 0.5 : 0.8);
      }
    }
  }

  /**
   * 根据配置推断主题列表（支持多选）
   */
  private resolveThemeList(): string[] {
    if (!this.parkourConfig) return ['meadow'];
    
    // 优先使用选中的标签（支持多个）
    if (this.parkourConfig.selectedTags && this.parkourConfig.selectedTags.length > 0) {
      return [...this.parkourConfig.selectedTags];
    }
    
    // 从描述中推断
    const desc = this.parkourConfig.mapDescription || '';
    if (!desc.trim()) return ['meadow'];
    
    // 简单关键词匹配（可匹配多个主题）
    const keywordMap: Record<string, string[]> = {
      crystal: ['水晶', '洞穴', 'crystal', 'cave', '宝石'],
      neon: ['霓虹', '都市', '赛博', 'neon', 'cyber', 'city'],
      underwater: ['海底', '海洋', '水下', 'underwater', 'ocean', 'coral'],
      ancient: ['遗迹', '远古', '废墟', '神殿', 'ancient', 'ruin', 'temple'],
      cloud: ['云端', '天空', '云', 'cloud', 'sky', 'heaven', '彩虹', 'rainbow'],
      lava: ['熔岩', '岩浆', '地狱', 'lava', 'hell', 'molten'],
      volcano: ['火山', '岩浆', 'volcano', 'magma'],
      cherry: ['樱花', '花', 'cherry', 'sakura', 'blossom'],
      snow: ['雪', '冰', '冬', 'snow', 'ice', 'winter'],
      forest: ['森林', '树', 'forest', 'jungle'],
      desert: ['沙漠', '沙', 'desert', 'sand'],
      night: ['夜', '黑暗', '月光', 'night', 'dark'],
      sunset: ['黄昏', '夕阳', 'sunset', 'dusk'],
      bamboo: ['竹', '竹林', 'bamboo'],
      autumn: ['秋', '金秋', '落叶', 'autumn', 'fall'],
      candy: ['糖果', '甜', 'candy', 'sweet'],
      space: ['太空', '星空', '宇宙', 'space', 'star', 'cosmos'],
      swamp: ['沼泽', '湿地', '藤蔓', 'swamp', 'marsh', 'wetland'],
    };
    
    const matched: string[] = [];
    const lower = desc.toLowerCase();
    for (const [themeId, keywords] of Object.entries(keywordMap)) {
      for (const kw of keywords) {
        if (lower.includes(kw)) {
          matched.push(themeId);
          break;
        }
      }
    }
    
    return matched.length > 0 ? matched : ['meadow'];
  }

  /**
   * 从持久化主题列表中随机选取一个
   */
  private pickRandomTheme(): string {
    if (this.persistentThemeIds && this.persistentThemeIds.length > 0) {
      return this.persistentThemeIds[Math.floor(Math.random() * this.persistentThemeIds.length)];
    }
    return 'meadow';
  }

  /**
   * 创建出生点 chunk（无障碍，装饰性）
   */
  private createSpawnChunk(themeId: string): void {
    const theme = getTheme(themeId);
    const chunkId = `spawn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const group = new THREE.Group();
    const startZ = this.nextStartZ;
    const endZ = startZ + CHUNK_LENGTH;

    // 赛道表面
    const surfaceMats = this.addTrackSurface(group, startZ, CHUNK_LENGTH, theme);

    // 侧边装饰
    this.addSideDecorations(group, startZ, CHUNK_LENGTH, theme);

    // 使用 SpawnSceneBuilder 添加额外出生点装饰
    SpawnSceneBuilder.decorateSpawnChunk(group, startZ, CHUNK_LENGTH, theme, this.parkourConfig);

    const chunk: Chunk = {
      id: chunkId,
      startZ,
      endZ,
      mesh: group,
      obstacles: [],
      collectibles: [],
      themeId: theme.id,
      trackMat: surfaceMats.trackMat,
      grassMatL: surfaceMats.grassMatL,
      grassMatR: surfaceMats.grassMatR,
    };

    group.position.y = 0;
    this.scene.add(group);
    this.chunks.push(chunk);
    this.nextStartZ = endZ;
    this.chunkCounter++;
  }

  update(playerZ: number, _delta: number = 0.016) {
    // 动画：移动障碍(A)的左右摆动
    this.animateMovingObstacles();

    // 动画：收集物旋转/浮动
    this.animateCollectibles();

    // 动画：选择站拱门浮动
    this.animateGates();

    // 计算当前所在 chunk
    const currentChunkIndex = this.chunks.findIndex(c => playerZ >= c.startZ && playerZ < c.endZ);

    if (currentChunkIndex >= 0) {
      // 保持前方至少 3 个 chunk
      while (this.chunks.length - 1 - currentChunkIndex < 3) {
        const difficulty = this.calculateDifficulty();
        this.createChunkSync(difficulty);
      }
      // 移除玩家身后超过 1 个的 chunk
      while (currentChunkIndex > 1) {
        this.removeOldestChunk();
        break;
      }
    } else if (playerZ >= this.nextStartZ) {
      // 紧急生成
      const difficulty = this.calculateDifficulty();
      this.createChunkSync(difficulty);
      this.createChunkSync(difficulty);
      this.createChunkSync(difficulty);
    }

    // 后台异步请求 AI
    this.requestAIInBackground();
  }

  // ============ 难度计算 ============

  private calculateDifficulty(): number {
    // 从 0.5 缓慢起步，每 chunk +0.03，上限 3.0
    let difficulty = 0.5 + Math.min(2.5, this.chunkCounter * 0.03);

    if (this.tracker) {
      const telemetry = this.tracker.getTelemetry();
      if (telemetry.style === 'safe') difficulty += 0.15;
      else if (telemetry.style === 'erratic' || telemetry.crashCount > 5) {
        difficulty = Math.max(0.5, difficulty - 0.2);
      }
      difficulty += (telemetry.playTime / 60) * 0.05;
    }

    // 应用玩家选择的难度模式
    if (this.parkourConfig?.difficulty === 'casual') {
      difficulty *= 0.6; // 休闲模式降低40%难度
    } else if (this.parkourConfig?.difficulty === 'extreme') {
      difficulty *= 1.5; // 极限模式提高50%难度
    }

    return Math.min(3.0, difficulty);
  }

  // ============ Chunk 创建 ============

  /**
   * 同步创建 chunk：优先使用 AI 缓存，否则本地生成
   */
  private createChunkSync(difficulty: number) {
    const idx = this.chunkCounter++;
    let mapData: AsciiMapChunk;

    if (this.pendingAIMap) {
      mapData = this.pendingAIMap;
      this.pendingAIMap = null;
    } else {
      mapData = this.generator.generateAsciiMap(difficulty, idx);
    }

    // 持久化主题：如果玩家选择了主题，每个 chunk 随机选取一个
    if (this.persistentThemeIds && this.persistentThemeIds.length > 0) {
      mapData.theme = this.persistentThemeIds[Math.floor(Math.random() * this.persistentThemeIds.length)];
    }

    this.buildChunkFromAsciiMap(mapData, idx);
  }

  /**
   * 后台异步请求 AI 地图
   */
  private requestAIInBackground() {
    if (this.isRequestingAI || !this.tracker) return;
    if (this.pendingAIMap) return;

    const telemetry = this.tracker.getTelemetry();
    if (telemetry.playTime < 3) return; // 3秒后即可开始请求AI
    if (!this.architect.canRequest()) return;

    this.isRequestingAI = true;
    const difficulty = this.calculateDifficulty();

    this.architect.generateChunk(telemetry, difficulty)
      .then(map => {
        if (map && map.rows.length > 0) {
          this.pendingAIMap = map;
          console.log(`[AI Map] theme: ${map.theme} | strategy: ${map.strategy}`);
        }
      })
      .catch(() => { /* 静默失败，使用本地回退 */ })
      .finally(() => { this.isRequestingAI = false; });
  }

  // ============ ASCII 地图 → 3D 场景 ============

  /**
   * 从 AsciiMapChunk 构建完整 chunk
   */
  private static readonly MAX_OBSTACLES_PER_CHUNK = 8;

  private buildChunkFromAsciiMap(mapData: AsciiMapChunk, chunkIndex: number = 0) {
    const chunkId = `chunk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const group = new THREE.Group();
    const obstacles: Obstacle[] = [];
    const collectibles: Collectible[] = [];

    const startZ = this.nextStartZ;
    const endZ = startZ + CHUNK_LENGTH;

    // 根据 chunkIndex 计算本 chunk 的最大障碍数
    // 后期速度快，降低障碍上限让玩家有空间闪避
    const maxObs = Math.min(3 + chunkIndex, ChunkManager.MAX_OBSTACLES_PER_CHUNK);
    let obstacleCount = 0;

    // 行间距强制过滤（防止 AI 生成的地图障碍过密）
    const minRowGap = Math.min(4, 2 + Math.floor(chunkIndex / 10));
    let rowsSinceObstacle = minRowGap; // 初始允许

    // 查找主题
    const theme = getTheme(mapData.theme || 'meadow');

    // 1) 底层赛道表面（使用主题颜色，返回材质引用用于过渡）
    const surfaceMats = this.addTrackSurface(group, startZ, CHUNK_LENGTH, theme);

    // 2) 侧边装饰（使用主题装饰物）
    this.addSideDecorations(group, startZ, CHUNK_LENGTH, theme);

    // 3) 选择站拱门（每 300m 一个）
    let chunkGateZ: number | undefined;
    let chunkGateMesh: THREE.Object3D | undefined;
    if (this.nextGateZ >= startZ && this.nextGateZ < endZ) {
      chunkGateZ = this.nextGateZ;
      const gateDef = getAssetDef('G');
      if (gateDef) {
        const gateMesh = gateDef.createMesh();
        gateMesh.position.set(0, 0, chunkGateZ);
        // 标记拱门顶部球体用于动画
        gateMesh.userData.isGate = true;
        gateMesh.userData.baseOrbY = 7.8;
        group.add(gateMesh);
        chunkGateMesh = gateMesh;
      }
      this.nextGateZ += ChunkManager.GATE_INTERVAL;
    }

    // 4) 遍历 ASCII 地图网格，放置物体
    for (let row = 0; row < mapData.rows.length && row < MAP_ROWS; row++) {
      const rowStr = mapData.rows[row];
      let rowHasObstacle = false;

      for (let col = 0; col < rowStr.length && col < MAP_COLS; col++) {
        const ch = rowStr[col];
        if (ch === '.') continue; // 空地

        // 硬过滤：T(树) 和 G(拱门) 太大，完全跳过（侧边已有树装饰）
        if (ch === 'T' || ch === 'G') continue;

        const def = getAssetDef(ch);
        if (!def) continue;

        // 安全检查：非赛道物体(M/V)不放在中央列(1-6)
        if (!def.trackPlaceable && col >= 1 && col <= 6) {
          continue; // 跳过
        }

        // 后置障碍上限：超过 maxObs 的阻挡物不放置
        if (def.isBlocking && obstacleCount >= maxObs) {
          continue; // 跳过多余障碍
        }

        // 行间距强制：距上个障碍行不够远的阻挡物跳过
        if (def.isBlocking && rowsSinceObstacle < minRowGap) {
          continue;
        }

        // 网格坐标 → 世界坐标
        const worldX = (col - (MAP_COLS - 1) / 2) * CELL_WIDTH; // col 0→-4.375, col 7→+4.375
        const worldZ = startZ + row * CELL_DEPTH + CELL_DEPTH / 2;

        // 创建 mesh
        const objMesh = def.createMesh();
        objMesh.position.set(worldX, def.height / 2, worldZ);

        // 移动障碍(A)特殊处理
        if (ch === 'A') {
          objMesh.userData = {
            isMoving: true,
            originalX: worldX,
            speed: 1.5 + Math.random() * 2,
          };
        }

        // 收集物悬浮 + userData 标记
        if (def.category === 'collectible') {
          objMesh.position.y = def.height / 2 + 0.6; // 略高于地面
          objMesh.userData.isCollectible = true;
          objMesh.userData.baseY = objMesh.position.y;
        }

        group.add(objMesh);

        // 按类别分类
        if (def.category === 'obstacle' && def.isBlocking) {
          obstacleCount++;
          rowHasObstacle = true;
          obstacles.push({
            id: `obs_${chunkId}_${row}_${col}`,
            type: ch,
            position: { x: worldX, y: 0, z: worldZ },
            width: def.width,
            avoidable: true,
            mesh: objMesh,
          });
        } else if (def.category === 'collectible') {
          collectibles.push({
            id: `col_${chunkId}_${row}_${col}`,
            type: ch,
            position: { x: worldX, y: 0, z: worldZ },
            width: def.width,
            value: def.value || 1,
            collected: false,
            mesh: objMesh,
          });
        } else if (def.category === 'special') {
          // 特殊物体（水坑、弹射板等）
          obstacles.push({
            id: `special_${chunkId}_${row}_${col}`,
            type: ch,
            position: { x: worldX, y: 0, z: worldZ },
            width: def.width,
            avoidable: true,
            mesh: objMesh,
          });
        }
        // decoration 类不加入碰撞列表
      }

      // 更新行间距计数器
      if (rowHasObstacle) {
        rowsSinceObstacle = 0;
      } else {
        rowsSinceObstacle++;
      }
    }

    const chunk: Chunk = {
      id: chunkId,
      startZ,
      endZ,
      mesh: group,
      obstacles,
      collectibles,
      mapData,
      themeId: theme.id,
      gateZ: chunkGateZ,
      gateMesh: chunkGateMesh,
      trackMat: surfaceMats.trackMat,
      grassMatL: surfaceMats.grassMatL,
      grassMatR: surfaceMats.grassMatR,
      // AI 存在感扩展数据
      aiComments: mapData.comments ? [...mapData.comments] : undefined,
      aiNarration: mapData.narration,
      aiAnalysis: mapData.analysis,
      aiConfidence: mapData.confidence,
    };

    group.position.y = 0;
    this.scene.add(group);
    this.chunks.push(chunk);
    this.nextStartZ = endZ;
  }

  // ============ 赛道表面 ============

  private addTrackSurface(group: THREE.Group, startZ: number, length: number, theme: ThemeDef): {
    trackMat: THREE.MeshToonMaterial;
    grassMatL: THREE.MeshToonMaterial;
    grassMatR: THREE.MeshToonMaterial;
  } {
    // 主赛道（使用主题颜色）
    const trackGeo = new THREE.PlaneGeometry(TRACK_WIDTH, length);
    const trackMat = new THREE.MeshToonMaterial({ color: theme.trackColor });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.rotation.x = -Math.PI / 2;
    track.position.set(0, 0, startZ + length / 2);
    track.receiveShadow = true;
    group.add(track);

    // 边线
    const lineGeo = new THREE.PlaneGeometry(0.3, length);
    const lineMat = new THREE.MeshToonMaterial({ color: theme.trackLineColor });

    const leftLine = new THREE.Mesh(lineGeo, lineMat);
    leftLine.rotation.x = -Math.PI / 2;
    leftLine.position.set(-TRACK_WIDTH / 2 + 0.5, 0.01, startZ + length / 2);
    group.add(leftLine);

    const rightLine = new THREE.Mesh(lineGeo, lineMat);
    rightLine.rotation.x = -Math.PI / 2;
    rightLine.position.set(TRACK_WIDTH / 2 - 0.5, 0.01, startZ + length / 2);
    group.add(rightLine);

    // 两侧草地（各自独立材质，以便 lerp 过渡）
    const grassGeo = new THREE.PlaneGeometry(30, length);
    const grassMatL = new THREE.MeshToonMaterial({ color: theme.grassColor });
    const grassMatR = new THREE.MeshToonMaterial({ color: theme.grassColor });

    const leftGrass = new THREE.Mesh(grassGeo, grassMatL);
    leftGrass.rotation.x = -Math.PI / 2;
    leftGrass.position.set(-TRACK_WIDTH / 2 - 15, -0.01, startZ + length / 2);
    leftGrass.receiveShadow = true;
    group.add(leftGrass);

    const rightGrass = new THREE.Mesh(grassGeo, grassMatR);
    rightGrass.rotation.x = -Math.PI / 2;
    rightGrass.position.set(TRACK_WIDTH / 2 + 15, -0.01, startZ + length / 2);
    rightGrass.receiveShadow = true;
    group.add(rightGrass);

    return { trackMat, grassMatL, grassMatR };
  }

  // ============ 侧边装饰 ============

  private addSideDecorations(group: THREE.Group, startZ: number, length: number, theme: ThemeDef) {
    // 栅栏：每 ~17m（使用主题颜色）
    for (let i = 0; i < 3; i++) {
      const fenceZ = startZ + i * (length / 3) + 5;
      const fenceL = createThemeFence(theme);
      fenceL.position.set(-TRACK_WIDTH / 2 - 1, 0, fenceZ);
      group.add(fenceL);
      const fenceR = createThemeFence(theme);
      fenceR.position.set(TRACK_WIDTH / 2 + 1, 0, fenceZ);
      group.add(fenceR);
    }

    // 主题侧边装饰物（按概率在赛道两侧放置）
    const step = 5; // 每 5 米检查一次
    for (let z = startZ; z < startZ + length; z += step) {
      for (const deco of theme.sideDecorations) {
        if (Math.random() > deco.probability) continue;
        const side = Math.random() > 0.5 ? 1 : -1;
        const dist = deco.minDistFromTrack + Math.random() * (deco.maxDistFromTrack - deco.minDistFromTrack);
        const decoX = side * (TRACK_WIDTH / 2 + dist);
        const decoZ = z + Math.random() * step;
        const mesh = deco.createMesh();
        if (deco.scale) mesh.scale.multiplyScalar(deco.scale);
        mesh.position.set(decoX, 0, decoZ);
        // 添加随机 Y 旋转让装饰物朝向不一致
        mesh.rotation.y = Math.random() * Math.PI * 2;
        group.add(mesh);
      }
    }

    // 里程碑标记 (每 100m)
    const markerStart = Math.ceil(startZ / 100) * 100;
    for (let m = markerStart; m < startZ + length; m += 100) {
      if (m > 0) {
        const marker = this.createDistanceMarker();
        marker.position.set(-TRACK_WIDTH / 2 - 3, 0, m);
        group.add(marker);
      }
    }
  }

  // createFence / createSideTree 已移至 ThemeRegistry 主题装饰物系统

  private createDistanceMarker(): THREE.Group {
    const g = new THREE.Group();
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(2, 1, 0.1),
      new THREE.MeshToonMaterial({ color: 0xFFD700 })
    );
    sign.position.y = 1.5;
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 1.5, 8),
      new THREE.MeshToonMaterial({ color: 0x8B4513 })
    );
    post.position.y = 0.75;
    g.add(sign, post);
    return g;
  }

  // ============ 动画 ============

  private animateMovingObstacles() {
    const time = Date.now() * 0.001;
    for (const chunk of this.chunks) {
      for (const obs of chunk.obstacles) {
        if (!obs.mesh) continue;
        if (obs.type === 'A') {
          const data = obs.mesh.userData;
          if (data.isMoving) {
            obs.mesh.position.x = data.originalX + Math.sin(time * data.speed) * 2;
            obs.position.x = obs.mesh.position.x;
          }
        }
        // 旋转锯片动画
        if (obs.type === 'Z' && obs.mesh.userData.isSpinning) {
          obs.mesh.rotation.y += 0.08;
        }
      }
    }
  }

  private animateCollectibles() {
    const time = Date.now() * 0.001;
    for (const chunk of this.chunks) {
      for (const col of chunk.collectibles) {
        if (col.collected || !col.mesh) continue;
        // 上下浮动
        const baseY = col.mesh.userData.baseY || 0.8;
        col.mesh.position.y = baseY + Math.sin(time * 3) * 0.15;
        // 旋转
        col.mesh.rotation.y += 0.03;
      }
    }
  }

  /**
   * 拱门球体浮动动画（顶部 + 两侧柱顶）
   */
  private animateGates() {
    const time = Date.now() * 0.001;
    for (const chunk of this.chunks) {
      if (!chunk.gateMesh) continue;
      const children = chunk.gateMesh.children;
      const count = children.length;
      // 顶部球体（倒数第3个）、左柱顶球（倒数第2个）、右柱顶球（最后一个）
      if (count >= 3) {
        const topOrb = children[count - 3];
        const leftOrb = children[count - 2];
        const rightOrb = children[count - 1];
        const baseY = chunk.gateMesh.userData.baseOrbY || 7.8;
        topOrb.position.y = baseY + Math.sin(time * 2) * 0.25;
        leftOrb.position.y = 7.2 + Math.sin(time * 2 + 1.0) * 0.15;
        rightOrb.position.y = 7.2 + Math.sin(time * 2 + 2.0) * 0.15;
      }
    }
  }

  // ============ 清理 ============

  private removeOldestChunk() {
    const chunk = this.chunks.shift();
    if (chunk) {
      this.scene.remove(chunk.mesh);
      chunk.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) child.geometry.dispose();
        }
      });
    }
  }

  // ============ Public API ============

  public getObstacles(): Obstacle[] {
    return this.chunks.flatMap(c => c.obstacles);
  }

  public getCollectibles(): Collectible[] {
    return this.chunks.flatMap(c => c.collectibles);
  }

  public getChunks(): Chunk[] {
    return this.chunks;
  }

  /**
   * 获取玩家当前所在 chunk 的主题 ID
   */
  public getCurrentThemeId(playerZ: number): string {
    const chunk = this.chunks.find(c => playerZ >= c.startZ && playerZ < c.endZ);
    return chunk?.themeId || 'meadow';
  }

  /**
   * 平滑过渡所有可见 chunk 的地面/草地材质颜色到目标主题
   * 由 ParkourScene 每帧调用
   */
  public lerpChunkMaterials(targetTheme: ThemeDef, lerpSpeed: number): void {
    const targetTrackColor = new THREE.Color(targetTheme.trackColor);
    const targetGrassColor = new THREE.Color(targetTheme.grassColor);
    for (const chunk of this.chunks) {
      if (chunk.trackMat) {
        chunk.trackMat.color.lerp(targetTrackColor, lerpSpeed);
      }
      if (chunk.grassMatL) {
        chunk.grassMatL.color.lerp(targetGrassColor, lerpSpeed);
      }
      if (chunk.grassMatR) {
        chunk.grassMatR.color.lerp(targetGrassColor, lerpSpeed);
      }
    }
  }

  /**
   * 获取玩家前方最近的选择站拱门 Z 位置
   * @returns 拱门 Z 坐标，如果前方没有拱门则返回 null
   */
  public getNextGateZ(playerZ: number): number | null {
    for (const chunk of this.chunks) {
      if (chunk.gateZ !== undefined && chunk.gateZ > playerZ) {
        return chunk.gateZ;
      }
    }
    return null;
  }

  /**
   * 标记某个拱门已被消耗（玩家已选牌），移除 gateZ 避免重复触发
   */
  public consumeGate(gateZ: number): void {
    for (const chunk of this.chunks) {
      if (chunk.gateZ === gateZ) {
        chunk.gateZ = undefined;
        break;
      }
    }
  }

  /**
   * 重置拱门计数器（用于新一局游戏）
   */
  public resetGates(): void {
    this.nextGateZ = 250;
  }

  // ============ AI 存在感数据 API ============

  /**
   * 获取玩家当前所在 chunk 的 AI 扩展数据
   */
  public getAIDataForCurrentChunk(playerZ: number): {
    narration?: string;
    analysis?: string;
    confidence?: number;
  } {
    const chunk = this.chunks.find(c => playerZ >= c.startZ && playerZ < c.endZ);
    if (!chunk) return {};
    return {
      narration: chunk.aiNarration,
      analysis: chunk.aiAnalysis,
      confidence: chunk.aiConfidence,
    };
  }

  /**
   * 消费并返回所有待显示的 AI 评论（从所有 chunk 中收集后清空）
   */
  public consumeComments(): string[] {
    const result: string[] = [];
    for (const chunk of this.chunks) {
      if (chunk.aiComments && chunk.aiComments.length > 0) {
        result.push(...chunk.aiComments);
        chunk.aiComments = [];
      }
    }
    return result;
  }
}
