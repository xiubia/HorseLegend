/**
 * 出生点场景生成器
 * 根据玩家配置在出生区域 chunk 添加装饰性 3D 元素
 */

import * as THREE from 'three';
import { ThemeDef } from '../ai/ThemeRegistry';
import { ParkourConfig } from '../data/types/GameTypes';

// ============ Mesh 工具 ============

function toon(color: number, opts?: Partial<THREE.MeshToonMaterialParameters>): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, ...opts });
}

// ============ 出生点装饰工厂 ============

/** 瀑布 */
function createWaterfall(): THREE.Object3D {
  const g = new THREE.Group();
  // 半透明蓝色水幕
  const waterGeo = new THREE.PlaneGeometry(2, 4);
  const waterMat = toon(0x4FC3F7, { transparent: true, opacity: 0.45 });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.y = 2;
  g.add(water);
  // 水池底部
  const pool = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.5, 0.2, 16),
    toon(0x3498DB, { transparent: true, opacity: 0.5 })
  );
  pool.position.y = 0.1;
  g.add(pool);
  // 泡沫粒子（静态小球模拟）
  for (let i = 0; i < 6; i++) {
    const foam = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 6, 6),
      toon(0xFFFFFF, { transparent: true, opacity: 0.5 })
    );
    foam.position.set(
      (Math.random() - 0.5) * 1.2,
      0.3 + Math.random() * 0.3,
      (Math.random() - 0.5) * 0.5
    );
    g.add(foam);
  }
  return g;
}

/** 火把 */
function createTorch(): THREE.Object3D {
  const g = new THREE.Group();
  // 柱子
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 1.5, 6),
    toon(0x5D4037)
  );
  pole.position.y = 0.75;
  pole.castShadow = true;
  g.add(pole);
  // 火焰（橙色发光球）
  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 8, 8),
    toon(0xFF8C00, { emissive: 0xFF4400, emissiveIntensity: 0.9 })
  );
  flame.position.y = 1.6;
  g.add(flame);
  // 外圈
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 8, 8),
    toon(0xFF6600, { transparent: true, opacity: 0.3, emissive: 0xFF4400, emissiveIntensity: 0.5 })
  );
  glow.position.y = 1.6;
  g.add(glow);
  return g;
}

/** 旗帜 */
function createFlag(): THREE.Object3D {
  const g = new THREE.Group();
  // 旗杆
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 3, 6),
    toon(0x8B4513)
  );
  pole.position.y = 1.5;
  g.add(pole);
  // 旗面
  const colors = [0xFF4444, 0x4488FF, 0xFFD700, 0x44FF44, 0xFF88CC];
  const flagMat = toon(colors[Math.floor(Math.random() * colors.length)]);
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 0.5),
    flagMat
  );
  flag.position.set(0.4, 2.6, 0);
  flag.rotation.y = 0.1;
  g.add(flag);
  return g;
}

/** 浮空岛 */
function createFloatingIsland(): THREE.Object3D {
  const g = new THREE.Group();
  // 倒三角底部
  const base = new THREE.Mesh(
    new THREE.ConeGeometry(1.5, 2, 6),
    toon(0x8B6914)
  );
  base.position.y = -0.5;
  base.rotation.x = Math.PI;
  g.add(base);
  // 草地顶面
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.5, 0.3, 8),
    toon(0x32CD32)
  );
  top.position.y = 0.5;
  g.add(top);
  // 小树
  const tree = new THREE.Mesh(
    new THREE.ConeGeometry(0.4, 1, 6),
    toon(0x228B22)
  );
  tree.position.set(0.3, 1.3, 0);
  g.add(tree);
  return g;
}

/** 拱桥 */
function createArchBridge(): THREE.Object3D {
  const g = new THREE.Group();
  const mat = toon(0x8B8378);
  // 弧形桥面
  const arc = new THREE.Mesh(
    new THREE.TorusGeometry(2, 0.25, 8, 16, Math.PI),
    mat
  );
  arc.position.y = 0;
  arc.rotation.z = Math.PI / 2;
  arc.castShadow = true;
  g.add(arc);
  // 栏杆柱
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6),
        mat
      );
      post.position.set(side * 0.3, 0.3, -1 + i);
      g.add(post);
    }
  }
  return g;
}

/** 浮空云朵 */
function createCloud(): THREE.Object3D {
  const g = new THREE.Group();
  const cloudMat = toon(0xFFFFFF, { transparent: true, opacity: 0.85 });
  // 3-5 个球体组成云朵
  const count = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const r = 0.5 + Math.random() * 0.8;
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), cloudMat);
    sphere.position.set(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 1.2
    );
    sphere.scale.y = 0.5 + Math.random() * 0.3;
    g.add(sphere);
  }
  return g;
}

/** 彩虹拱门 — 从地面拱起到地面 */
function createRainbow(): THREE.Object3D {
  const g = new THREE.Group();
  const colors = [0xFF0000, 0xFF8800, 0xFFFF00, 0x00CC00, 0x0088FF, 0x4400CC, 0x8800CC];
  for (let i = 0; i < colors.length; i++) {
    const radius = 4 - i * 0.25;
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.12, 8, 32, Math.PI),
      toon(colors[i], { transparent: true, opacity: 0.7 })
    );
    // 默认半圆弧从 (+R,0,0) 经 (0,+R,0) 到 (-R,0,0)，自然彩虹形状
    g.add(arc);
  }
  return g;
}

/** 水晶柱 */
function createCrystal(): THREE.Object3D {
  const g = new THREE.Group();
  const colors = [0x88CCFF, 0xCC88FF, 0x88FFCC, 0xFF88CC];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const mat = toon(color, { transparent: true, opacity: 0.7, emissive: color, emissiveIntensity: 0.3 });
  const height = 1 + Math.random() * 2;
  const crystal = new THREE.Mesh(
    new THREE.ConeGeometry(0.3 + Math.random() * 0.3, height, 6),
    mat
  );
  crystal.position.y = height / 2;
  crystal.castShadow = true;
  g.add(crystal);
  // 底座光晕
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(0.6, 12),
    toon(color, { transparent: true, opacity: 0.3 })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.01;
  g.add(glow);
  return g;
}

/** 霓虹灯柱 */
function createNeonPole(): THREE.Object3D {
  const g = new THREE.Group();
  const colors = [0xFF00FF, 0x00FFFF, 0xFF4444, 0x44FF44];
  const color = colors[Math.floor(Math.random() * colors.length)];
  // 柱体
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 3, 8),
    toon(0x333333)
  );
  pole.position.y = 1.5;
  g.add(pole);
  // 发光环
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.05, 8, 16),
      toon(color, { emissive: color, emissiveIntensity: 0.8 })
    );
    ring.position.y = 0.8 + i * 0.9;
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
  }
  // 顶部灯球
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 8, 8),
    toon(color, { emissive: color, emissiveIntensity: 1 })
  );
  bulb.position.y = 3.1;
  g.add(bulb);
  return g;
}

/** 珊瑚 */
function createCoral(): THREE.Object3D {
  const g = new THREE.Group();
  const colors = [0xFF6B6B, 0xFF8E53, 0xE91E63, 0xFFAB91];
  const color = colors[Math.floor(Math.random() * colors.length)];
  // 主干
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.15, 1.2, 6),
    toon(color)
  );
  trunk.position.y = 0.6;
  g.add(trunk);
  // 分叉
  for (let i = 0; i < 3; i++) {
    const branch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.08, 0.7, 5),
      toon(color)
    );
    const angle = (i / 3) * Math.PI * 2;
    branch.position.set(Math.cos(angle) * 0.2, 0.9, Math.sin(angle) * 0.2);
    branch.rotation.z = 0.3 + Math.random() * 0.3;
    branch.rotation.y = angle;
    g.add(branch);
  }
  return g;
}

/** 石柱遗迹 */
function createRuinPillar(): THREE.Object3D {
  const g = new THREE.Group();
  const mat = toon(0xA09080);
  const height = 2 + Math.random() * 2;
  // 柱体（破损效果 - 不规则顶部）
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.4, height, 8),
    mat
  );
  pillar.position.y = height / 2;
  pillar.castShadow = true;
  g.add(pillar);
  // 底座
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.2, 1),
    mat
  );
  base.position.y = 0.1;
  g.add(base);
  // 碎石
  for (let i = 0; i < 2; i++) {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.15 + Math.random() * 0.1, 0),
      toon(0x908070)
    );
    rock.position.set((Math.random() - 0.5) * 0.8, 0.1, (Math.random() - 0.5) * 0.8);
    g.add(rock);
  }
  return g;
}

/** 熔岩喷泉 */
function createLavaGeyser(): THREE.Object3D {
  const g = new THREE.Group();
  // 岩石底座
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.6, 1),
    toon(0x444444)
  );
  rock.position.y = 0.3;
  rock.scale.y = 0.5;
  g.add(rock);
  // 熔岩柱
  const lava = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.3, 1.5, 8),
    toon(0xFF4400, { emissive: 0xFF2200, emissiveIntensity: 0.8 })
  );
  lava.position.y = 1.2;
  g.add(lava);
  // 光晕
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 8, 8),
    toon(0xFF6600, { transparent: true, opacity: 0.3, emissive: 0xFF4400, emissiveIntensity: 0.5 })
  );
  glow.position.y = 2;
  g.add(glow);
  return g;
}

// ============ 出生点预设 ============

interface SpawnPreset {
  name: string;
  keywords: string[];
  decorations: Array<{
    factory: () => THREE.Object3D;
    count: number;
    spreadX: number;
    spreadZ: number;
    yOffset?: number;
  }>;
}

const SPAWN_PRESETS: SpawnPreset[] = [
  {
    name: '彩虹天路',
    keywords: ['彩虹', 'rainbow', '七彩'],
    decorations: [
      { factory: createRainbow, count: 2, spreadX: 2, spreadZ: 20, yOffset: 5 },
      { factory: createCloud, count: 6, spreadX: 10, spreadZ: 25, yOffset: 4 },
      { factory: createFlag, count: 4, spreadX: 8, spreadZ: 15 },
    ]
  },
  {
    name: '云端天路',
    keywords: ['云', 'cloud', '天空', 'sky', '云端', '天堂', 'heaven'],
    decorations: [
      { factory: createCloud, count: 8, spreadX: 12, spreadZ: 25, yOffset: 3 },
      { factory: createFloatingIsland, count: 3, spreadX: 10, spreadZ: 20, yOffset: 5 },
      { factory: createFlag, count: 2, spreadX: 6, spreadZ: 10 },
    ]
  },
  {
    name: '石桥起点',
    keywords: ['桥', 'bridge', '石桥', '瀑布', 'waterfall'],
    decorations: [
      { factory: createArchBridge, count: 1, spreadX: 0, spreadZ: 5 },
      { factory: createWaterfall, count: 2, spreadX: 12, spreadZ: 10 },
      { factory: createFlag, count: 3, spreadX: 8, spreadZ: 15 },
    ]
  },
  {
    name: '水晶洞穴',
    keywords: ['水晶', 'crystal', '洞穴', 'cave', '宝石', 'gem'],
    decorations: [
      { factory: createCrystal, count: 10, spreadX: 8, spreadZ: 25 },
      { factory: createTorch, count: 4, spreadX: 6, spreadZ: 15 },
    ]
  },
  {
    name: '霓虹都市',
    keywords: ['霓虹', 'neon', '都市', '赛博', 'cyber', 'city', '城市'],
    decorations: [
      { factory: createNeonPole, count: 8, spreadX: 8, spreadZ: 25 },
      { factory: createFlag, count: 2, spreadX: 10, spreadZ: 15 },
    ]
  },
  {
    name: '海底世界',
    keywords: ['海底', '海洋', '水下', 'underwater', 'ocean', '珊瑚', 'coral', '鱼'],
    decorations: [
      { factory: createCoral, count: 8, spreadX: 8, spreadZ: 25 },
      { factory: createWaterfall, count: 2, spreadX: 10, spreadZ: 15 },
    ]
  },
  {
    name: '远古遗迹',
    keywords: ['遗迹', '远古', '废墟', '神殿', 'ancient', 'ruin', 'temple', '石柱'],
    decorations: [
      { factory: createRuinPillar, count: 8, spreadX: 8, spreadZ: 25 },
      { factory: createTorch, count: 4, spreadX: 6, spreadZ: 15 },
    ]
  },
  {
    name: '城堡大门',
    keywords: ['城堡', 'castle', '大门', '旗帜', 'flag'],
    decorations: [
      { factory: createTorch, count: 4, spreadX: 6, spreadZ: 10 },
      { factory: createFlag, count: 4, spreadX: 8, spreadZ: 15 },
    ]
  },
  {
    name: '樱花小径',
    keywords: ['樱花', 'cherry', '花', 'flower', 'sakura'],
    decorations: [
      { factory: createFlag, count: 4, spreadX: 10, spreadZ: 20 },
      { factory: createCloud, count: 3, spreadX: 10, spreadZ: 20, yOffset: 4 },
    ]
  },
  {
    name: '冰封隧道',
    keywords: ['冰', 'ice', '雪', 'snow', '冰封', '冬'],
    decorations: [
      { factory: createCrystal, count: 6, spreadX: 7, spreadZ: 20 },
      { factory: createTorch, count: 4, spreadX: 7, spreadZ: 15 },
    ]
  },
  {
    name: '火山熔岩',
    keywords: ['火山', 'volcano', '熔岩', 'lava', '火', '地狱', 'hell', '岩浆'],
    decorations: [
      { factory: createLavaGeyser, count: 6, spreadX: 8, spreadZ: 20 },
      { factory: createTorch, count: 6, spreadX: 8, spreadZ: 20 },
    ]
  },
  {
    name: '浮空岛',
    keywords: ['浮空', 'float', '空岛', 'island'],
    decorations: [
      { factory: createFloatingIsland, count: 4, spreadX: 10, spreadZ: 20, yOffset: 4 },
      { factory: createCloud, count: 4, spreadX: 12, spreadZ: 25, yOffset: 3 },
    ]
  },
  {
    name: '默认',
    keywords: [],
    decorations: [
      { factory: createFlag, count: 4, spreadX: 8, spreadZ: 15 },
      { factory: createTorch, count: 2, spreadX: 6, spreadZ: 8 },
    ]
  },
];

// ============ 出生点场景生成器 ============

export class SpawnSceneBuilder {
  /**
   * 在出生点 chunk 中添加装饰性 3D 元素
   */
  static decorateSpawnChunk(
    group: THREE.Group,
    startZ: number,
    chunkLength: number,
    theme: ThemeDef,
    config: ParkourConfig | null
  ): void {
    // 选择出生点预设
    const preset = SpawnSceneBuilder.selectPreset(config);

    // 放置装饰物
    for (const deco of preset.decorations) {
      for (let i = 0; i < deco.count; i++) {
        const mesh = deco.factory();
        const side = i % 2 === 0 ? 1 : -1;
        const x = side * (5 + Math.random() * deco.spreadX);
        const z = startZ + 5 + Math.random() * Math.min(deco.spreadZ, chunkLength - 10);
        const y = deco.yOffset || 0;
        mesh.position.set(x, y, z);
        mesh.rotation.y = Math.random() * Math.PI * 2;
        group.add(mesh);
      }
    }

    // 出生点欢迎标志（"AI 世界"浮动文字标牌）
    if (config && config.mapDescription) {
      const sign = SpawnSceneBuilder.createWelcomeSign(config);
      sign.position.set(0, 5, startZ + chunkLength * 0.4);
      group.add(sign);
    }
  }

  /**
   * 根据配置选择最匹配的出生点预设
   */
  private static selectPreset(config: ParkourConfig | null): SpawnPreset {
    if (!config) return SPAWN_PRESETS[SPAWN_PRESETS.length - 1]; // 默认

    const desc = (config.mapDescription || '').toLowerCase();
    if (!desc.trim()) return SPAWN_PRESETS[SPAWN_PRESETS.length - 1];

    for (const preset of SPAWN_PRESETS) {
      for (const kw of preset.keywords) {
        if (desc.includes(kw)) return preset;
      }
    }

    return SPAWN_PRESETS[SPAWN_PRESETS.length - 1]; // 默认
  }

  /**
   * 创建出生点欢迎标牌
   */
  private static createWelcomeSign(config: ParkourConfig): THREE.Object3D {
    const group = new THREE.Group();

    // 标牌背景
    const signGeo = new THREE.PlaneGeometry(4, 1.5);
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 512;
    signCanvas.height = 192;
    const ctx = signCanvas.getContext('2d')!;

    // 渐变背景
    const gradient = ctx.createLinearGradient(0, 0, 512, 0);
    gradient.addColorStop(0, 'rgba(155, 89, 182, 0.8)');
    gradient.addColorStop(0.5, 'rgba(52, 152, 219, 0.8)');
    gradient.addColorStop(1, 'rgba(155, 89, 182, 0.8)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 192);

    // 边框
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, 496, 176);

    // 文字
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const title = config.mapDescription
      ? (config.mapDescription.length > 16 ? config.mapDescription.slice(0, 16) + '...' : config.mapDescription)
      : 'AI 跑道';
    ctx.fillText(title, 256, 80);

    ctx.font = '22px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText('AI 为你创造的世界', 256, 140);

    const texture = new THREE.CanvasTexture(signCanvas);
    const signMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.rotation.y = Math.PI; // 面朝 Z- 方向（玩家方向），避免文字镜像
    group.add(sign);

    return group;
  }
}
