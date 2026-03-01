/**
 * 场景主题注册表
 * 定义不同氛围主题的颜色、光照、侧边装饰物
 * AI 或本地生成器通过 theme ID 索引到具体的视觉配置
 */

import * as THREE from 'three';

// ============ 类型定义 ============

/**
 * 侧边装饰物定义
 */
export interface SideDecoDef {
  name: string;
  probability: number;        // 每 10m 出现概率 (0-1)
  minDistFromTrack: number;   // 离赛道边缘最小距离
  maxDistFromTrack: number;   // 离赛道边缘最大距离
  scale?: number;             // 缩放倍率（默认 1）
  createMesh(): THREE.Object3D;
}

/**
 * 粒子效果定义
 */
export interface ParticleDef {
  type: 'snow' | 'firefly' | 'petal' | 'ember' | 'crystal' | 'neon' | 'bubble' | 'dust' | 'cloud' | 'spark';
  color: number;
  count: number;       // 粒子数量
  size: number;        // 粒子大小
  speed: number;       // 下落/漂浮速度
  spread: number;      // 横向扩散范围
}

/**
 * 场景主题定义
 */
export interface ThemeDef {
  id: string;
  name: string;
  // 天空 & 雾
  skyColor: number;
  fogColor: number;
  fogNear: number;
  fogFar: number;
  // 赛道颜色
  trackColor: number;
  grassColor: number;
  trackLineColor: number;
  // 光照
  ambientIntensity: number;
  sunIntensity: number;
  sunColor: number;
  // 侧边装饰物
  sideDecorations: SideDecoDef[];
  // 栅栏颜色
  fenceColor: number;
  // 粒子效果（可选）
  particles?: ParticleDef;
}

// ============ MeshToonMaterial 工具 ============

function toon(color: number, opts?: Partial<THREE.MeshToonMaterialParameters>): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, ...opts });
}

// ============ 通用装饰物工厂 ============

/** 标准绿树 */
function createDefaultTree(): THREE.Object3D {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.4, 2, 8),
    toon(0x8B4513)
  );
  trunk.position.y = 1; trunk.castShadow = true;
  const foliage = new THREE.Mesh(
    new THREE.ConeGeometry(1.5, 3, 8),
    toon(0x228B22)
  );
  foliage.position.y = 3.5; foliage.castShadow = true;
  g.add(trunk, foliage);
  return g;
}

/** 花丛 */
function createFlowerBush(): THREE.Object3D {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 8, 6),
    toon(0x32CD32)
  );
  base.scale.y = 0.5;
  base.position.y = 0.15;
  g.add(base);
  const colors = [0xFF69B4, 0xFFD700, 0xFF6347, 0x9370DB];
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 6, 6),
      toon(colors[i])
    );
    const a = (i / 4) * Math.PI * 2;
    f.position.set(Math.cos(a) * 0.3, 0.3, Math.sin(a) * 0.3);
    g.add(f);
  }
  return g;
}

/** 矮灌木 */
function createBush(): THREE.Object3D {
  const g = new THREE.Group();
  const bush = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 8, 6),
    toon(0x2E8B57)
  );
  bush.scale.set(1, 0.6, 1);
  bush.position.y = 0.35;
  bush.castShadow = true;
  g.add(bush);
  return g;
}

/** 高大深色树（森林） */
function createForestTree(): THREE.Object3D {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.5, 3.5, 8),
    toon(0x5D4037)
  );
  trunk.position.y = 1.75; trunk.castShadow = true;
  // 三层树冠
  for (let i = 0; i < 3; i++) {
    const foliage = new THREE.Mesh(
      new THREE.ConeGeometry(1.8 - i * 0.4, 2.0 - i * 0.3, 8),
      toon(0x1B5E20)
    );
    foliage.position.y = 3.5 + i * 1.2;
    foliage.castShadow = true;
    g.add(foliage);
  }
  g.add(trunk);
  return g;
}

/** 蘑菇（森林） */
function createMushroom(): THREE.Object3D {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.12, 0.4, 8),
    toon(0xFFF8DC)
  );
  stem.position.y = 0.2;
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    toon(0xFF4500)
  );
  cap.position.y = 0.4;
  g.add(stem, cap);
  return g;
}

/** 仙人掌（沙漠） */
function createCactus(): THREE.Object3D {
  const g = new THREE.Group();
  const mat = toon(0x2E8B57);
  // 主干
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.3, 2.0, 8),
    mat
  );
  body.position.y = 1.0; body.castShadow = true;
  g.add(body);
  // 左臂
  const armL = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.18, 0.8, 8),
    mat
  );
  armL.position.set(-0.35, 1.2, 0);
  armL.rotation.z = Math.PI / 4;
  g.add(armL);
  // 右臂
  const armR = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.18, 0.6, 8),
    mat
  );
  armR.position.set(0.35, 1.5, 0);
  armR.rotation.z = -Math.PI / 4;
  g.add(armR);
  return g;
}

/** 沙漠岩石 */
function createDesertRock(): THREE.Object3D {
  const mesh = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.6, 0),
    toon(0xC2B280)
  );
  mesh.scale.set(1.2, 0.7, 1.0);
  mesh.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, 0);
  mesh.position.y = 0.3;
  mesh.castShadow = true;
  return mesh;
}

/** 枯草（沙漠） */
function createDryGrass(): THREE.Object3D {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.4 + Math.random() * 0.3, 0.05),
      toon(0xBDB76B)
    );
    blade.position.set(
      (Math.random() - 0.5) * 0.4,
      0.2,
      (Math.random() - 0.5) * 0.4
    );
    blade.rotation.z = (Math.random() - 0.5) * 0.3;
    g.add(blade);
  }
  return g;
}

/** 路灯（黄昏） */
function createStreetLamp(): THREE.Object3D {
  const g = new THREE.Group();
  // 灯柱
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 3.5, 8),
    toon(0x555555)
  );
  pole.position.y = 1.75;
  g.add(pole);
  // 灯头横臂
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.06, 0.06),
    toon(0x555555)
  );
  arm.position.set(0.4, 3.5, 0);
  g.add(arm);
  // 灯泡（发光）
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 8, 8),
    toon(0xFFDD44, { emissive: 0xFFAA00, emissiveIntensity: 0.8 })
  );
  bulb.position.set(0.8, 3.4, 0);
  g.add(bulb);
  return g;
}

/** 黄昏深色树 */
function createSunsetTree(): THREE.Object3D {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.4, 2.5, 8),
    toon(0x4E342E)
  );
  trunk.position.y = 1.25; trunk.castShadow = true;
  const foliage = new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 8, 6),
    toon(0x2E7D32)
  );
  foliage.scale.y = 0.7;
  foliage.position.y = 3.2; foliage.castShadow = true;
  g.add(trunk, foliage);
  return g;
}

// ============ 雪地装饰物 ============

/** 雪松（白色树冠） */
function createSnowTree(): THREE.Object3D {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.4, 2, 8),
    toon(0x6D4C41)
  );
  trunk.position.y = 1; trunk.castShadow = true;
  // 白色/淡蓝树冠层
  for (let i = 0; i < 3; i++) {
    const foliage = new THREE.Mesh(
      new THREE.ConeGeometry(1.6 - i * 0.35, 1.8 - i * 0.2, 8),
      toon(0xE8F0F8)
    );
    foliage.position.y = 2.5 + i * 1.1;
    foliage.castShadow = true;
    g.add(foliage);
  }
  g.add(trunk);
  return g;
}

/** 冰块 */
function createIceBlock(): THREE.Object3D {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.6 + Math.random() * 0.5, 0.4 + Math.random() * 0.4, 0.5 + Math.random() * 0.3),
    toon(0xADD8E6, { transparent: true, opacity: 0.7 })
  );
  mesh.position.y = 0.2;
  mesh.rotation.y = Math.random() * Math.PI;
  mesh.castShadow = true;
  return mesh;
}

/** 雪堆 */
function createSnowMound(): THREE.Object3D {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.5 + Math.random() * 0.3, 8, 6),
    toon(0xFAFAFA)
  );
  mesh.scale.y = 0.4;
  mesh.position.y = 0.15;
  return mesh;
}

// ============ 夜间装饰物 ============

/** 暗色树（夜间） */
function createDarkTree(): THREE.Object3D {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.4, 2.5, 8),
    toon(0x1A1A1A)
  );
  trunk.position.y = 1.25; trunk.castShadow = true;
  const foliage = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 8, 6),
    toon(0x0A2E0A)
  );
  foliage.scale.y = 0.8;
  foliage.position.y = 3.0; foliage.castShadow = true;
  g.add(trunk, foliage);
  return g;
}

/** 萤火虫灯光（发光小球） */
function createFireflyLight(): THREE.Object3D {
  const g = new THREE.Group();
  // 2-4 个随机浮动的小发光球
  const count = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 6, 6),
      toon(0xAAFF00, { emissive: 0x88DD00, emissiveIntensity: 1.0 })
    );
    bulb.position.set(
      (Math.random() - 0.5) * 1.5,
      0.5 + Math.random() * 2,
      (Math.random() - 0.5) * 1.5
    );
    g.add(bulb);
  }
  return g;
}

// ============ 樱花装饰物 ============

/** 樱花树 */
function createCherryTree(): THREE.Object3D {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.35, 2, 8),
    toon(0x8B4513)
  );
  trunk.position.y = 1; trunk.castShadow = true;
  // 粉色球形树冠
  const foliage = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 12, 8),
    toon(0xFFB7C5)
  );
  foliage.scale.y = 0.7;
  foliage.position.y = 3.0; foliage.castShadow = true;
  g.add(trunk, foliage);
  // 底部散落花瓣（小粉色圆片）
  for (let i = 0; i < 5; i++) {
    const petal = new THREE.Mesh(
      new THREE.CircleGeometry(0.08, 6),
      toon(0xFF69B4)
    );
    petal.rotation.x = -Math.PI / 2;
    petal.position.set(
      (Math.random() - 0.5) * 2,
      0.01,
      (Math.random() - 0.5) * 2
    );
    g.add(petal);
  }
  return g;
}

// ============ 火山装饰物 ============

/** 岩浆石（发光红色岩石） */
function createLavaRock(): THREE.Object3D {
  const mesh = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.6 + Math.random() * 0.3, 0),
    toon(0x4A0000, { emissive: 0xFF4500, emissiveIntensity: 0.4 })
  );
  mesh.scale.set(1.0 + Math.random() * 0.5, 0.6 + Math.random() * 0.3, 1.0);
  mesh.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, 0);
  mesh.position.y = 0.3;
  mesh.castShadow = true;
  return mesh;
}

/** 烟雾柱（灰色半透明圆柱体） */
function createSmokeColumn(): THREE.Object3D {
  const g = new THREE.Group();
  // 底部裂缝
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.5, 0.3, 8),
    toon(0x333333)
  );
  base.position.y = 0.15;
  g.add(base);
  // 烟雾球（半透明灰色）
  for (let i = 0; i < 3; i++) {
    const smoke = new THREE.Mesh(
      new THREE.SphereGeometry(0.3 + i * 0.15, 8, 6),
      toon(0x666666, { transparent: true, opacity: 0.3 - i * 0.07 })
    );
    smoke.position.y = 0.5 + i * 0.6;
    g.add(smoke);
  }
  return g;
}

/** 焦黑树（火山场景） */
function createCharredTree(): THREE.Object3D {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.35, 2.5, 8),
    toon(0x1A1A1A)
  );
  trunk.position.y = 1.25; trunk.castShadow = true;
  // 光秃秃的分支
  const branch1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.1, 1, 6),
    toon(0x1A1A1A)
  );
  branch1.position.set(0.3, 2.2, 0);
  branch1.rotation.z = -Math.PI / 4;
  const branch2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.08, 0.8, 6),
    toon(0x1A1A1A)
  );
  branch2.position.set(-0.25, 2.5, 0);
  branch2.rotation.z = Math.PI / 3;
  g.add(trunk, branch1, branch2);
  return g;
}

// ============ 水晶洞穴装饰物 ============

/** 水晶柱 */
function createCrystalPillar(): THREE.Object3D {
  const g = new THREE.Group();
  const mat = toon(0x88CCFF, { transparent: true, opacity: 0.75, emissive: 0x3366AA, emissiveIntensity: 0.4 });
  // 主晶体
  const crystalGeo = new THREE.CylinderGeometry(0.15, 0.4, 2.5, 6);
  const crystal = new THREE.Mesh(crystalGeo, mat);
  crystal.position.y = 1.25; crystal.castShadow = true;
  g.add(crystal);
  // 侧晶体
  for (let i = 0; i < 2; i++) {
    const side = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.2, 1.2, 6),
      mat
    );
    side.position.set((i === 0 ? -0.3 : 0.3), 0.6, (i === 0 ? 0.1 : -0.1));
    side.rotation.z = (i === 0 ? 0.3 : -0.3);
    g.add(side);
  }
  return g;
}

/** 钟乳石 */
function createStalactite(): THREE.Object3D {
  const g = new THREE.Group();
  const mat = toon(0x667788);
  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.4, 1.5, 6),
    mat
  );
  body.position.y = 0.75;
  body.castShadow = true;
  g.add(body);
  return g;
}

// ============ 霓虹都市装饰物 ============

/** 霓虹灯柱 */
function createNeonPole(): THREE.Object3D {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 4, 8),
    toon(0x333333)
  );
  pole.position.y = 2; g.add(pole);
  // 霓虹灯管（多色）
  const neonColors = [0xFF00FF, 0x00FFFF, 0xFF0088, 0x0088FF];
  const neonColor = neonColors[Math.floor(Math.random() * neonColors.length)];
  const neon = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 1.2, 0.06),
    toon(neonColor, { emissive: neonColor, emissiveIntensity: 0.8 })
  );
  neon.position.set(0, 3.2, 0);
  g.add(neon);
  return g;
}

/** 光墙 */
function createLightWall(): THREE.Object3D {
  const colors = [0xFF00FF, 0x00FFFF, 0xFF6600, 0x00FF88];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 3, 2),
    toon(color, { transparent: true, opacity: 0.25, emissive: color, emissiveIntensity: 0.6 })
  );
  mesh.position.y = 1.5;
  return mesh;
}

// ============ 海底世界装饰物 ============

/** 珊瑚 */
function createCoral(): THREE.Object3D {
  const g = new THREE.Group();
  const colors = [0xFF6B8A, 0xFF8C42, 0xFFD54F, 0xE040FB];
  const mat = toon(colors[Math.floor(Math.random() * colors.length)]);
  // 分支结构
  for (let i = 0; i < 3; i++) {
    const branch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.15, 0.8 + Math.random() * 0.6, 6),
      mat
    );
    branch.position.set((Math.random() - 0.5) * 0.4, 0.4 + Math.random() * 0.3, (Math.random() - 0.5) * 0.4);
    branch.rotation.set((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4);
    g.add(branch);
  }
  return g;
}

/** 海草 */
function createSeaweed(): THREE.Object3D {
  const g = new THREE.Group();
  const mat = toon(0x2E8B57, { transparent: true, opacity: 0.8 });
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 1.2 + Math.random() * 0.8, 0.08),
      mat
    );
    blade.position.set((Math.random() - 0.5) * 0.3, 0.6, (Math.random() - 0.5) * 0.3);
    blade.rotation.z = (Math.random() - 0.5) * 0.3;
    g.add(blade);
  }
  return g;
}

// ============ 远古遗迹装饰物 ============

/** 石柱废墟 */
function createRuinPillar(): THREE.Object3D {
  const g = new THREE.Group();
  const mat = toon(0x8B8378);
  // 断裂石柱
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.4, 2.5 + Math.random() * 1.5, 8),
    mat
  );
  pillar.position.y = 1.25;
  pillar.rotation.z = (Math.random() - 0.5) * 0.15;
  pillar.castShadow = true;
  g.add(pillar);
  // 碎石底座
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.3, 1),
    mat
  );
  base.position.y = 0.15;
  g.add(base);
  return g;
}

/** 藤蔓 */
function createVines(): THREE.Object3D {
  const g = new THREE.Group();
  const mat = toon(0x228B22);
  for (let i = 0; i < 4; i++) {
    const vine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 1.5 + Math.random(), 4),
      mat
    );
    vine.position.set((Math.random() - 0.5) * 0.5, 0.8, (Math.random() - 0.5) * 0.5);
    vine.rotation.z = (Math.random() - 0.5) * 0.4;
    g.add(vine);
    // 小叶子
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 4, 4),
      toon(0x32CD32)
    );
    leaf.position.set(vine.position.x, Math.random() * 1.2, vine.position.z);
    g.add(leaf);
  }
  return g;
}

// ============ 云端天路装饰物 ============

/** 云柱 */
function createCloudPillar(): THREE.Object3D {
  const g = new THREE.Group();
  const mat = toon(0xFFFFFF, { transparent: true, opacity: 0.7 });
  // 堆叠的云朵球
  for (let i = 0; i < 4; i++) {
    const cloud = new THREE.Mesh(
      new THREE.SphereGeometry(0.6 + Math.random() * 0.4, 8, 6),
      mat
    );
    cloud.position.set(
      (Math.random() - 0.5) * 0.5,
      i * 0.8,
      (Math.random() - 0.5) * 0.5
    );
    cloud.scale.y = 0.5;
    g.add(cloud);
  }
  return g;
}

/** 彩虹桥段 — 从地面拱起到地面 */
function createRainbowArc(): THREE.Object3D {
  const g = new THREE.Group();
  const rainbowColors = [0xFF0000, 0xFF8800, 0xFFFF00, 0x00FF00, 0x0088FF, 0x8800FF];
  for (let i = 0; i < rainbowColors.length; i++) {
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(2.5 + i * 0.15, 0.08, 8, 32, Math.PI),
      toon(rainbowColors[i], { transparent: true, opacity: 0.65 })
    );
    // 不旋转：默认半圆弧从 (+R,0,0) 经 (0,+R,0) 到 (-R,0,0)
    // 即从地面拱起再落回地面，形成自然彩虹形状
    g.add(arc);
  }
  return g;
}

// ============ 熔岩地狱装饰物 ============

/** 熔岩喷泉（装饰版） */
function createLavaFountain(): THREE.Object3D {
  const g = new THREE.Group();
  // 底部裂缝
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.7, 0.4, 8),
    toon(0x333333)
  );
  base.position.y = 0.2;
  g.add(base);
  // 熔岩喷射
  for (let i = 0; i < 3; i++) {
    const lava = new THREE.Mesh(
      new THREE.SphereGeometry(0.15 + i * 0.05, 6, 6),
      toon(0xFF4500, { emissive: 0xFF2200, emissiveIntensity: 0.8 })
    );
    lava.position.set(
      (Math.random() - 0.5) * 0.3,
      0.5 + i * 0.4,
      (Math.random() - 0.5) * 0.3
    );
    g.add(lava);
  }
  return g;
}

/** 火焰壁 */
function createFlameWall(): THREE.Object3D {
  const g = new THREE.Group();
  const mat = toon(0xFF4500, { transparent: true, opacity: 0.4, emissive: 0xFF2200, emissiveIntensity: 0.6 });
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 2.5, 2),
    mat
  );
  wall.position.y = 1.25;
  g.add(wall);
  return g;
}

/** 木栅栏（通用侧边） */
function createFence(color: number = 0xFFFFFF): THREE.Object3D {
  const g = new THREE.Group();
  const mat = toon(color);
  const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);
  const p1 = new THREE.Mesh(postGeo, mat); p1.position.set(0, 0.5, -1);
  const p2 = new THREE.Mesh(postGeo, mat); p2.position.set(0, 0.5, 1);
  const railGeo = new THREE.BoxGeometry(0.08, 0.08, 2);
  const r1 = new THREE.Mesh(railGeo, mat); r1.position.y = 0.3;
  const r2 = new THREE.Mesh(railGeo, mat); r2.position.y = 0.7;
  g.add(p1, p2, r1, r2);
  return g;
}

// ============ 新增装饰物工厂 ============

/** 竹子丛 */
function createBamboo(): THREE.Object3D {
  const g = new THREE.Group();
  const mat = toon(0x4CAF50);
  const leafMat = toon(0x2E7D32);
  for (let i = 0; i < 5; i++) {
    const ox = (Math.random() - 0.5) * 0.8;
    const oz = (Math.random() - 0.5) * 0.8;
    const h = 2.5 + Math.random() * 2;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, h, 6), mat);
    stalk.position.set(ox, h / 2, oz);
    stalk.castShadow = true;
    g.add(stalk);
    // 节
    for (let j = 1; j < Math.floor(h); j++) {
      const node = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 4, 8), mat);
      node.position.set(ox, j, oz);
      node.rotation.x = Math.PI / 2;
      g.add(node);
    }
    // 顶部叶片
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 4), leafMat);
    leaf.position.set(ox, h + 0.2, oz);
    g.add(leaf);
  }
  return g;
}

/** 向日葵 */
function createSunflower(): THREE.Object3D {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.8, 6), toon(0x558B2F));
  stem.position.y = 0.9;
  g.add(stem);
  // 花盘
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.1, 12), toon(0x5D4037));
  disc.position.y = 1.85;
  disc.rotation.x = -0.2;
  g.add(disc);
  // 花瓣
  const petalMat = toon(0xFFD600);
  for (let i = 0; i < 10; i++) {
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), petalMat);
    const a = (i / 10) * Math.PI * 2;
    petal.position.set(Math.cos(a) * 0.35, 1.85, Math.sin(a) * 0.35);
    petal.scale.set(1, 0.4, 1);
    g.add(petal);
  }
  // 叶子
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 4), toon(0x388E3C));
  leaf.scale.set(1, 0.3, 0.5);
  leaf.position.set(0.15, 0.7, 0);
  g.add(leaf);
  return g;
}

/** 柳树（装饰物版本） */
function createWillowTree(): THREE.Object3D {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 3, 8), toon(0x6D4C41));
  trunk.position.y = 1.5;
  trunk.castShadow = true;
  g.add(trunk);
  // 垂枝
  const branchMat = toon(0x66BB6A);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.01, 2.5, 4), branchMat);
    branch.position.set(Math.cos(a) * 0.8, 2.8, Math.sin(a) * 0.8);
    branch.rotation.x = 0.3 * Math.cos(a);
    branch.rotation.z = 0.3 * Math.sin(a);
    g.add(branch);
    // 叶团
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 4), branchMat);
    leaf.position.set(Math.cos(a) * 1.0, 1.6, Math.sin(a) * 1.0);
    g.add(leaf);
  }
  // 树冠
  const crown = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 6), toon(0x4CAF50));
  crown.position.y = 3.2;
  crown.scale.set(1, 0.6, 1);
  crown.castShadow = true;
  g.add(crown);
  return g;
}

/** 小池塘 */
function createPond(): THREE.Object3D {
  const g = new THREE.Group();
  // 水面
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(1.2, 16),
    new THREE.MeshToonMaterial({ color: 0x4FC3F7, transparent: true, opacity: 0.7 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.02;
  g.add(water);
  // 石头边缘
  const stoneMat = toon(0x9E9E9E);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15 + Math.random() * 0.1, 0), stoneMat);
    stone.position.set(Math.cos(a) * 1.15, 0.1, Math.sin(a) * 1.15);
    g.add(stone);
  }
  return g;
}

/** 风车小屋 */
function createWindmill(): THREE.Object3D {
  const g = new THREE.Group();
  // 底座
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 2.5, 6), toon(0xFFF8E1));
  base.position.y = 1.25;
  base.castShadow = true;
  g.add(base);
  // 屋顶
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.8, 6), toon(0xD84315));
  roof.position.y = 2.9;
  g.add(roof);
  // 叶片
  const bladeMat = toon(0x8D6E63);
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.04), bladeMat);
    blade.position.set(0.65, 2.2, 0);
    blade.rotation.z = (i / 4) * Math.PI * 2;
    g.add(blade);
  }
  return g;
}

/** 篝火 */
function createCampfire(): THREE.Object3D {
  const g = new THREE.Group();
  // 石头围圈
  const stoneMat = toon(0x757575);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15, 0), stoneMat);
    stone.position.set(Math.cos(a) * 0.35, 0.1, Math.sin(a) * 0.35);
    g.add(stone);
  }
  // 木柴
  const logMat = toon(0x5D4037);
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), logMat);
    log.position.y = 0.1;
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i / 3) * Math.PI;
    g.add(log);
  }
  // 火焰
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.2, 0.6, 6),
    new THREE.MeshToonMaterial({ color: 0xFF6D00, emissive: 0xFF6D00, emissiveIntensity: 0.5 })
  );
  flame.position.y = 0.4;
  g.add(flame);
  const innerFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.1, 0.4, 6),
    new THREE.MeshToonMaterial({ color: 0xFFD600, emissive: 0xFFD600, emissiveIntensity: 0.6 })
  );
  innerFlame.position.y = 0.35;
  g.add(innerFlame);
  return g;
}

/** 图腾柱 */
function createTotemPole(): THREE.Object3D {
  const g = new THREE.Group();
  const colors = [0xD84315, 0x1565C0, 0x2E7D32, 0xF9A825, 0x6A1B9A];
  for (let i = 0; i < 5; i++) {
    const block = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 8), toon(colors[i]));
    block.position.y = 0.25 + i * 0.5;
    block.castShadow = true;
    g.add(block);
  }
  // 顶部装饰
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.4, 6), toon(0xFF6F00));
  top.position.y = 2.95;
  g.add(top);
  // 面具眼睛
  const eyeMat = toon(0xFFFFFF);
  const eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), eyeMat);
  eye1.position.set(-0.12, 2.3, 0.28);
  const eye2 = eye1.clone();
  eye2.position.set(0.12, 2.3, 0.28);
  g.add(eye1, eye2);
  return g;
}

/** 邮箱 */
function createMailbox(): THREE.Object3D {
  const g = new THREE.Group();
  // 柱子
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6), toon(0x795548));
  post.position.y = 0.5;
  g.add(post);
  // 箱体
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.25), toon(0xE53935));
  box.position.y = 1.1;
  box.castShadow = true;
  g.add(box);
  // 旗子
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.12), toon(0xFFD600));
  flag.position.set(0.2, 1.2, 0);
  g.add(flag);
  return g;
}

/** 魔法水晶 */
function createMagicCrystal(): THREE.Object3D {
  const g = new THREE.Group();
  // 底座
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.2, 8), toon(0x4A148C));
  base.position.y = 0.1;
  g.add(base);
  // 主水晶
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.5, 0),
    new THREE.MeshToonMaterial({ color: 0xAB47BC, emissive: 0x7B1FA2, emissiveIntensity: 0.4 })
  );
  crystal.position.y = 0.8;
  crystal.scale.y = 1.4;
  crystal.castShadow = true;
  g.add(crystal);
  // 小水晶
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const mini = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.15, 0),
      new THREE.MeshToonMaterial({ color: 0xCE93D8, emissive: 0x9C27B0, emissiveIntensity: 0.3 })
    );
    mini.position.set(Math.cos(a) * 0.4, 0.35, Math.sin(a) * 0.4);
    mini.scale.y = 1.3;
    g.add(mini);
  }
  return g;
}

/** 传送环 */
function createPortalRing(): THREE.Object3D {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.8, 0.1, 8, 24),
    new THREE.MeshToonMaterial({ color: 0x00E5FF, emissive: 0x006064, emissiveIntensity: 0.5 })
  );
  ring.position.y = 1.0;
  g.add(ring);
  // 内圈光面
  const inner = new THREE.Mesh(
    new THREE.CircleGeometry(0.7, 16),
    new THREE.MeshBasicMaterial({ color: 0x00BCD4, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
  );
  inner.position.y = 1.0;
  g.add(inner);
  // 底座
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.3, 8), toon(0x37474F));
  base.position.y = 0.15;
  g.add(base);
  return g;
}

/** 浮空小岛 */
function createFloatingIsland(): THREE.Object3D {
  const g = new THREE.Group();
  // 倒锥体岩石底
  const rock = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.2, 8), toon(0x795548));
  rock.position.y = 1.5;
  rock.rotation.x = Math.PI;
  g.add(rock);
  // 顶部草地
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.15, 8), toon(0x4CAF50));
  grass.position.y = 2.1;
  g.add(grass);
  // 小树
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.5, 6), toon(0x5D4037));
  trunk.position.y = 2.4;
  g.add(trunk);
  const foliage = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 6), toon(0x2E7D32));
  foliage.position.y = 2.8;
  g.add(foliage);
  return g;
}

/** 灯笼 */
function createLantern(): THREE.Object3D {
  const g = new THREE.Group();
  // 绳子
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 4), toon(0x5D4037));
  rope.position.y = 1.5;
  g.add(rope);
  // 灯笼体
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 8, 8),
    new THREE.MeshToonMaterial({ color: 0xE53935, emissive: 0xB71C1C, emissiveIntensity: 0.3 })
  );
  body.scale.y = 1.3;
  body.position.y = 1.15;
  g.add(body);
  // 顶盖 + 底环
  const capMat = toon(0xFFD600);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.2, 0.1, 8), capMat);
  top.position.y = 1.45;
  g.add(top);
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.08, 0.08, 8), capMat);
  bottom.position.y = 0.85;
  g.add(bottom);
  // 穗子
  const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.04, 0.2, 4), capMat);
  tassel.position.y = 0.7;
  g.add(tassel);
  return g;
}

// ============ 新增树木风格工厂 ============

/** 竹林风格树 */
function createBambooTree(): THREE.Object3D {
  const g = new THREE.Group();
  const mat = toon(0x388E3C);
  for (let i = 0; i < 4; i++) {
    const ox = (Math.random() - 0.5) * 0.6;
    const oz = (Math.random() - 0.5) * 0.6;
    const h = 4 + Math.random() * 2;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, h, 6), mat);
    stalk.position.set(ox, h / 2, oz);
    stalk.castShadow = true;
    g.add(stalk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.0, 6), toon(0x2E7D32));
    crown.position.set(ox, h + 0.3, oz);
    g.add(crown);
  }
  return g;
}

/** 柳树风格 */
function createWillowStyleTree(): THREE.Object3D {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 4, 8), toon(0x5D4037));
  trunk.position.y = 2;
  trunk.castShadow = true;
  g.add(trunk);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(1.8, 8, 6), toon(0x558B2F));
  crown.position.y = 4.5;
  crown.scale.y = 0.7;
  crown.castShadow = true;
  g.add(crown);
  // 垂枝
  const branchMat = toon(0x7CB342);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.01, 2.5, 4), branchMat);
    branch.position.set(Math.cos(a) * 1.2, 3.0, Math.sin(a) * 1.2);
    g.add(branch);
  }
  return g;
}

/** 粉色花树（浓密花冠） */
function createSakuraTree(): THREE.Object3D {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 3, 8), toon(0x5D4037));
  trunk.position.y = 1.5;
  trunk.castShadow = true;
  g.add(trunk);
  // 多层花冠
  const pinkMat = toon(0xF48FB1);
  const deepPink = toon(0xF06292);
  for (let i = 0; i < 5; i++) {
    const mat = i % 2 === 0 ? pinkMat : deepPink;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.8 + Math.random() * 0.4, 8, 6), mat);
    const a = (i / 5) * Math.PI * 2;
    ball.position.set(Math.cos(a) * 0.6, 3.5 + Math.random() * 0.5, Math.sin(a) * 0.6);
    ball.castShadow = true;
    g.add(ball);
  }
  // 中心花冠
  const center = new THREE.Mesh(new THREE.SphereGeometry(1.0, 8, 6), toon(0xF8BBD0));
  center.position.y = 3.8;
  center.castShadow = true;
  g.add(center);
  return g;
}

/** 秋树（橙红黄叶冠） */
function createAutumnTree(): THREE.Object3D {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 3.5, 8), toon(0x4E342E));
  trunk.position.y = 1.75;
  trunk.castShadow = true;
  g.add(trunk);
  const colors = [0xFF6F00, 0xE65100, 0xF9A825, 0xBF360C, 0xFFB300];
  for (let i = 0; i < 5; i++) {
    const foliage = new THREE.Mesh(
      new THREE.SphereGeometry(0.7 + Math.random() * 0.3, 8, 6),
      toon(colors[i])
    );
    const a = (i / 5) * Math.PI * 2;
    foliage.position.set(Math.cos(a) * 0.5, 3.8 + Math.random() * 0.6, Math.sin(a) * 0.5);
    foliage.castShadow = true;
    g.add(foliage);
  }
  return g;
}

// ============ 主题定义 ============

const THEMES: ThemeDef[] = [
  // ---- 草原 (默认) ----
  {
    id: 'meadow',
    name: '草原',
    skyColor: 0x88CCFF,
    fogColor: 0x88CCFF,
    fogNear: 40,
    fogFar: 120,
    trackColor: 0xF4A460,
    grassColor: 0x32CD32,
    trackLineColor: 0xFFFFFF,
    ambientIntensity: 0.8,
    sunIntensity: 1.0,
    sunColor: 0xFFFFFF,
    fenceColor: 0xFFFFFF,
    sideDecorations: [
      {
        name: '绿树',
        probability: 0.3,
        minDistFromTrack: 8,
        maxDistFromTrack: 20,
        createMesh: createDefaultTree,
      },
      {
        name: '花丛',
        probability: 0.25,
        minDistFromTrack: 2,
        maxDistFromTrack: 8,
        createMesh: createFlowerBush,
      },
      {
        name: '灌木',
        probability: 0.2,
        minDistFromTrack: 3,
        maxDistFromTrack: 10,
        createMesh: createBush,
      },
    ],
  },

  // ---- 森林 ----
  {
    id: 'forest',
    name: '森林',
    skyColor: 0x5B8C5A,
    fogColor: 0x4A7A4A,
    fogNear: 25,
    fogFar: 80,
    trackColor: 0x6D4C41,
    grassColor: 0x1B5E20,
    trackLineColor: 0xA5D6A7,
    ambientIntensity: 0.5,
    sunIntensity: 0.6,
    sunColor: 0xCCFFCC,
    fenceColor: 0x5D4037,
    sideDecorations: [
      {
        name: '高树',
        probability: 0.5,
        minDistFromTrack: 4,
        maxDistFromTrack: 18,
        createMesh: createForestTree,
      },
      {
        name: '蘑菇',
        probability: 0.3,
        minDistFromTrack: 2,
        maxDistFromTrack: 6,
        createMesh: createMushroom,
      },
      {
        name: '灌木',
        probability: 0.25,
        minDistFromTrack: 3,
        maxDistFromTrack: 8,
        createMesh: createBush,
      },
    ],
  },

  // ---- 沙漠 ----
  {
    id: 'desert',
    name: '沙漠',
    skyColor: 0xFFE4B5,
    fogColor: 0xDEB887,
    fogNear: 50,
    fogFar: 150,
    trackColor: 0xEDC9AF,
    grassColor: 0xDAA520,
    trackLineColor: 0xF5DEB3,
    ambientIntensity: 0.9,
    sunIntensity: 1.3,
    sunColor: 0xFFF8DC,
    fenceColor: 0xD2B48C,
    sideDecorations: [
      {
        name: '仙人掌',
        probability: 0.2,
        minDistFromTrack: 5,
        maxDistFromTrack: 18,
        createMesh: createCactus,
      },
      {
        name: '岩石',
        probability: 0.25,
        minDistFromTrack: 3,
        maxDistFromTrack: 15,
        createMesh: createDesertRock,
      },
      {
        name: '枯草',
        probability: 0.3,
        minDistFromTrack: 2,
        maxDistFromTrack: 10,
        createMesh: createDryGrass,
      },
    ],
  },

  // ---- 黄昏 ----
  {
    id: 'sunset',
    name: '黄昏',
    skyColor: 0xFF6B35,
    fogColor: 0xFF8C42,
    fogNear: 35,
    fogFar: 100,
    trackColor: 0x8B7355,
    grassColor: 0x228B22,
    trackLineColor: 0xFFE0B2,
    ambientIntensity: 0.6,
    sunIntensity: 0.7,
    sunColor: 0xFFAB40,
    fenceColor: 0x8D6E63,
    sideDecorations: [
      {
        name: '暗树',
        probability: 0.3,
        minDistFromTrack: 6,
        maxDistFromTrack: 20,
        createMesh: createSunsetTree,
      },
      {
        name: '路灯',
        probability: 0.12,
        minDistFromTrack: 1.5,
        maxDistFromTrack: 3,
        createMesh: createStreetLamp,
      },
      {
        name: '灌木',
        probability: 0.2,
        minDistFromTrack: 3,
        maxDistFromTrack: 10,
        createMesh: createBush,
      },
    ],
  },
  // ---- 雪地 ----
  {
    id: 'snow',
    name: '雪地',
    skyColor: 0xB0C4DE,
    fogColor: 0xC0C0C0,
    fogNear: 30,
    fogFar: 90,
    trackColor: 0xD3D3D3,
    grassColor: 0xF0F0F0,
    trackLineColor: 0xE0E0E0,
    ambientIntensity: 0.7,
    sunIntensity: 0.9,
    sunColor: 0xE0E8FF,
    fenceColor: 0xCCCCCC,
    particles: { type: 'snow', color: 0xFFFFFF, count: 200, size: 0.08, speed: 2.0, spread: 30 },
    sideDecorations: [
      {
        name: '雪松',
        probability: 0.35,
        minDistFromTrack: 5,
        maxDistFromTrack: 18,
        createMesh: createSnowTree,
      },
      {
        name: '冰块',
        probability: 0.15,
        minDistFromTrack: 3,
        maxDistFromTrack: 12,
        createMesh: createIceBlock,
      },
      {
        name: '雪堆',
        probability: 0.25,
        minDistFromTrack: 2,
        maxDistFromTrack: 8,
        createMesh: createSnowMound,
      },
    ],
  },

  // ---- 夜间 ----
  {
    id: 'night',
    name: '夜间',
    skyColor: 0x1A1A2E,
    fogColor: 0x16213E,
    fogNear: 20,
    fogFar: 70,
    trackColor: 0x3D3D3D,
    grassColor: 0x0F3D0F,
    trackLineColor: 0x555555,
    ambientIntensity: 0.2,
    sunIntensity: 0.3,
    sunColor: 0x8888CC,
    fenceColor: 0x444444,
    particles: { type: 'firefly', color: 0xAAFF00, count: 60, size: 0.05, speed: 0.5, spread: 25 },
    sideDecorations: [
      {
        name: '暗树',
        probability: 0.3,
        minDistFromTrack: 5,
        maxDistFromTrack: 18,
        createMesh: createDarkTree,
      },
      {
        name: '萤火虫灯',
        probability: 0.2,
        minDistFromTrack: 2,
        maxDistFromTrack: 10,
        createMesh: createFireflyLight,
      },
      {
        name: '路灯',
        probability: 0.15,
        minDistFromTrack: 1.5,
        maxDistFromTrack: 3,
        createMesh: createStreetLamp,
      },
    ],
  },

  // ---- 樱花 ----
  {
    id: 'cherry',
    name: '樱花',
    skyColor: 0xFFB7C5,
    fogColor: 0xFFB7C5,
    fogNear: 35,
    fogFar: 110,
    trackColor: 0xD2B48C,
    grassColor: 0x90EE90,
    trackLineColor: 0xFFC0CB,
    ambientIntensity: 0.8,
    sunIntensity: 0.9,
    sunColor: 0xFFE4E1,
    fenceColor: 0xDEB887,
    particles: { type: 'petal', color: 0xFFB7C5, count: 100, size: 0.1, speed: 1.2, spread: 25 },
    sideDecorations: [
      {
        name: '樱花树',
        probability: 0.4,
        minDistFromTrack: 4,
        maxDistFromTrack: 16,
        createMesh: createCherryTree,
      },
      {
        name: '花丛',
        probability: 0.25,
        minDistFromTrack: 2,
        maxDistFromTrack: 8,
        createMesh: createFlowerBush,
      },
      {
        name: '灌木',
        probability: 0.15,
        minDistFromTrack: 3,
        maxDistFromTrack: 8,
        createMesh: createBush,
      },
    ],
  },

  // ---- 火山 ----
  {
    id: 'volcano',
    name: '火山',
    skyColor: 0x4A0000,
    fogColor: 0x800000,
    fogNear: 20,
    fogFar: 75,
    trackColor: 0x5C4033,
    grassColor: 0x2F2F2F,
    trackLineColor: 0xFF4500,
    ambientIntensity: 0.3,
    sunIntensity: 0.5,
    sunColor: 0xFF6600,
    fenceColor: 0x333333,
    particles: { type: 'ember', color: 0xFF4500, count: 80, size: 0.06, speed: 1.5, spread: 20 },
    sideDecorations: [
      {
        name: '岩浆石',
        probability: 0.2,
        minDistFromTrack: 3,
        maxDistFromTrack: 15,
        createMesh: createLavaRock,
      },
      {
        name: '烟雾柱',
        probability: 0.15,
        minDistFromTrack: 5,
        maxDistFromTrack: 18,
        createMesh: createSmokeColumn,
      },
      {
        name: '焦黑树',
        probability: 0.2,
        minDistFromTrack: 4,
        maxDistFromTrack: 14,
        createMesh: createCharredTree,
      },
    ],
  },

  // ---- 水晶洞穴 ----
  {
    id: 'crystal',
    name: '水晶洞穴',
    skyColor: 0x1A1040,
    fogColor: 0x2A1860,
    fogNear: 15,
    fogFar: 65,
    trackColor: 0x4A6080,
    grassColor: 0x2A3050,
    trackLineColor: 0x88CCFF,
    ambientIntensity: 0.35,
    sunIntensity: 0.3,
    sunColor: 0x88BBFF,
    fenceColor: 0x556688,
    particles: { type: 'crystal', color: 0x88CCFF, count: 50, size: 0.06, speed: 0.3, spread: 20 },
    sideDecorations: [
      {
        name: '水晶柱',
        probability: 0.3,
        minDistFromTrack: 3,
        maxDistFromTrack: 14,
        createMesh: createCrystalPillar,
      },
      {
        name: '钟乳石',
        probability: 0.25,
        minDistFromTrack: 2,
        maxDistFromTrack: 10,
        createMesh: createStalactite,
      },
      {
        name: '冰块',
        probability: 0.15,
        minDistFromTrack: 4,
        maxDistFromTrack: 16,
        createMesh: createIceBlock,
      },
    ],
  },

  // ---- 霓虹都市 ----
  {
    id: 'neon',
    name: '霓虹都市',
    skyColor: 0x0A0A14,
    fogColor: 0x0A0A1E,
    fogNear: 20,
    fogFar: 80,
    trackColor: 0x1A1A2E,
    grassColor: 0x0A0A14,
    trackLineColor: 0xFF00FF,
    ambientIntensity: 0.15,
    sunIntensity: 0.2,
    sunColor: 0xFF00FF,
    fenceColor: 0x333366,
    particles: { type: 'neon', color: 0xFF00FF, count: 40, size: 0.04, speed: 0.8, spread: 20 },
    sideDecorations: [
      {
        name: '霓虹灯柱',
        probability: 0.3,
        minDistFromTrack: 2,
        maxDistFromTrack: 8,
        createMesh: createNeonPole,
      },
      {
        name: '光墙',
        probability: 0.15,
        minDistFromTrack: 5,
        maxDistFromTrack: 15,
        createMesh: createLightWall,
      },
      {
        name: '路灯',
        probability: 0.1,
        minDistFromTrack: 1.5,
        maxDistFromTrack: 3,
        createMesh: createStreetLamp,
      },
    ],
  },

  // ---- 海底世界 ----
  {
    id: 'underwater',
    name: '海底世界',
    skyColor: 0x0A2A3A,
    fogColor: 0x0A3040,
    fogNear: 18,
    fogFar: 70,
    trackColor: 0xC2B280,
    grassColor: 0x1A4A3A,
    trackLineColor: 0x4FC3F7,
    ambientIntensity: 0.4,
    sunIntensity: 0.35,
    sunColor: 0x66BBCC,
    fenceColor: 0x3A6A6A,
    particles: { type: 'bubble', color: 0x88DDFF, count: 80, size: 0.08, speed: 1.0, spread: 25 },
    sideDecorations: [
      {
        name: '珊瑚',
        probability: 0.35,
        minDistFromTrack: 2,
        maxDistFromTrack: 12,
        createMesh: createCoral,
      },
      {
        name: '海草',
        probability: 0.3,
        minDistFromTrack: 2,
        maxDistFromTrack: 8,
        createMesh: createSeaweed,
      },
    ],
  },

  // ---- 远古遗迹 ----
  {
    id: 'ancient',
    name: '远古遗迹',
    skyColor: 0xBBA060,
    fogColor: 0xAA9050,
    fogNear: 25,
    fogFar: 90,
    trackColor: 0x8B8378,
    grassColor: 0x6B7B3A,
    trackLineColor: 0xCDC9A5,
    ambientIntensity: 0.55,
    sunIntensity: 0.65,
    sunColor: 0xFFDD88,
    fenceColor: 0x6B6350,
    particles: { type: 'dust', color: 0xCCBB99, count: 40, size: 0.05, speed: 0.4, spread: 20 },
    sideDecorations: [
      {
        name: '石柱废墟',
        probability: 0.25,
        minDistFromTrack: 3,
        maxDistFromTrack: 15,
        createMesh: createRuinPillar,
      },
      {
        name: '藤蔓',
        probability: 0.3,
        minDistFromTrack: 2,
        maxDistFromTrack: 10,
        createMesh: createVines,
      },
      {
        name: '灌木',
        probability: 0.15,
        minDistFromTrack: 3,
        maxDistFromTrack: 8,
        createMesh: createBush,
      },
    ],
  },

  // ---- 云端天路 ----
  {
    id: 'cloud',
    name: '云端天路',
    skyColor: 0x88CCFF,
    fogColor: 0xDDEEFF,
    fogNear: 30,
    fogFar: 120,
    trackColor: 0xF0F0F0,
    grassColor: 0xE8F4FF,
    trackLineColor: 0xAADDFF,
    ambientIntensity: 0.9,
    sunIntensity: 1.1,
    sunColor: 0xFFFFFF,
    fenceColor: 0xDDDDDD,
    particles: { type: 'cloud', color: 0xFFFFFF, count: 60, size: 0.15, speed: 0.5, spread: 30 },
    sideDecorations: [
      {
        name: '云柱',
        probability: 0.3,
        minDistFromTrack: 4,
        maxDistFromTrack: 18,
        createMesh: createCloudPillar,
      },
      {
        name: '彩虹桥段',
        probability: 0.08,
        minDistFromTrack: 6,
        maxDistFromTrack: 16,
        createMesh: createRainbowArc,
      },
    ],
  },

  // ---- 熔岩地狱 ----
  {
    id: 'lava',
    name: '熔岩地狱',
    skyColor: 0x2A0A00,
    fogColor: 0x4A1500,
    fogNear: 15,
    fogFar: 60,
    trackColor: 0x1A1A1A,
    grassColor: 0x1A0A00,
    trackLineColor: 0xFF6600,
    ambientIntensity: 0.2,
    sunIntensity: 0.4,
    sunColor: 0xFF4400,
    fenceColor: 0x222222,
    particles: { type: 'spark', color: 0xFF6600, count: 100, size: 0.05, speed: 2.0, spread: 20 },
    sideDecorations: [
      {
        name: '熔岩喷泉',
        probability: 0.2,
        minDistFromTrack: 4,
        maxDistFromTrack: 14,
        createMesh: createLavaFountain,
      },
      {
        name: '火焰壁',
        probability: 0.15,
        minDistFromTrack: 3,
        maxDistFromTrack: 10,
        createMesh: createFlameWall,
      },
      {
        name: '岩浆石',
        probability: 0.25,
        minDistFromTrack: 3,
        maxDistFromTrack: 16,
        createMesh: createLavaRock,
      },
    ],
  },

  // ---- 竹林 ----
  {
    id: 'bamboo',
    name: '竹林',
    skyColor: 0x8BC34A,
    fogColor: 0xA5D6A7,
    fogNear: 25,
    fogFar: 90,
    trackColor: 0x6D4C41,
    grassColor: 0x33691E,
    trackLineColor: 0xC5E1A5,
    ambientIntensity: 0.6,
    sunIntensity: 0.7,
    sunColor: 0xDCE775,
    fenceColor: 0x4E342E,
    particles: { type: 'petal', color: 0x81C784, count: 50, size: 0.04, speed: 0.6, spread: 20 },
    sideDecorations: [
      {
        name: '竹子丛',
        probability: 0.35,
        minDistFromTrack: 2,
        maxDistFromTrack: 12,
        createMesh: createBamboo,
      },
      {
        name: '灯笼',
        probability: 0.15,
        minDistFromTrack: 2,
        maxDistFromTrack: 8,
        createMesh: createLantern,
      },
      {
        name: '池塘',
        probability: 0.08,
        minDistFromTrack: 5,
        maxDistFromTrack: 14,
        createMesh: createPond,
      },
    ],
  },

  // ---- 金秋 ----
  {
    id: 'autumn',
    name: '金秋',
    skyColor: 0xFFCC80,
    fogColor: 0xFFE0B2,
    fogNear: 25,
    fogFar: 100,
    trackColor: 0x8D6E63,
    grassColor: 0xBF360C,
    trackLineColor: 0xFFB74D,
    ambientIntensity: 0.6,
    sunIntensity: 0.75,
    sunColor: 0xFFB300,
    fenceColor: 0x5D4037,
    particles: { type: 'petal', color: 0xFF8F00, count: 70, size: 0.05, speed: 0.5, spread: 22 },
    sideDecorations: [
      {
        name: '向日葵',
        probability: 0.2,
        minDistFromTrack: 2,
        maxDistFromTrack: 10,
        createMesh: createSunflower,
      },
      {
        name: '篝火',
        probability: 0.1,
        minDistFromTrack: 4,
        maxDistFromTrack: 12,
        createMesh: createCampfire,
      },
      {
        name: '灌木',
        probability: 0.15,
        minDistFromTrack: 2,
        maxDistFromTrack: 8,
        createMesh: createBush,
      },
    ],
  },

  // ---- 糖果世界 ----
  {
    id: 'candy',
    name: '糖果世界',
    skyColor: 0xF8BBD0,
    fogColor: 0xFCE4EC,
    fogNear: 30,
    fogFar: 110,
    trackColor: 0xF48FB1,
    grassColor: 0xC8E6C9,
    trackLineColor: 0xFFFFFF,
    ambientIntensity: 0.8,
    sunIntensity: 0.9,
    sunColor: 0xFFFFFF,
    fenceColor: 0xF06292,
    particles: { type: 'crystal', color: 0xFF80AB, count: 60, size: 0.04, speed: 0.7, spread: 20 },
    sideDecorations: [
      {
        name: '邮箱',
        probability: 0.1,
        minDistFromTrack: 2,
        maxDistFromTrack: 6,
        createMesh: createMailbox,
      },
      {
        name: '风车小屋',
        probability: 0.12,
        minDistFromTrack: 5,
        maxDistFromTrack: 14,
        createMesh: createWindmill,
      },
      {
        name: '蘑菇',
        probability: 0.25,
        minDistFromTrack: 2,
        maxDistFromTrack: 10,
        createMesh: createMushroom,
      },
    ],
  },

  // ---- 太空 ----
  {
    id: 'space',
    name: '太空',
    skyColor: 0x0D0221,
    fogColor: 0x1A0533,
    fogNear: 20,
    fogFar: 80,
    trackColor: 0x1A1A2E,
    grassColor: 0x0D0221,
    trackLineColor: 0x7C4DFF,
    ambientIntensity: 0.2,
    sunIntensity: 0.3,
    sunColor: 0xB388FF,
    fenceColor: 0x311B92,
    particles: { type: 'crystal', color: 0xE1BEE7, count: 100, size: 0.03, speed: 0.3, spread: 30 },
    sideDecorations: [
      {
        name: '魔法水晶',
        probability: 0.25,
        minDistFromTrack: 3,
        maxDistFromTrack: 14,
        createMesh: createMagicCrystal,
      },
      {
        name: '传送环',
        probability: 0.1,
        minDistFromTrack: 5,
        maxDistFromTrack: 12,
        createMesh: createPortalRing,
      },
      {
        name: '浮空小岛',
        probability: 0.08,
        minDistFromTrack: 6,
        maxDistFromTrack: 18,
        createMesh: createFloatingIsland,
      },
    ],
  },

  // ---- 沼泽 ----
  {
    id: 'swamp',
    name: '沼泽',
    skyColor: 0x33691E,
    fogColor: 0x2E7D32,
    fogNear: 15,
    fogFar: 60,
    trackColor: 0x4E342E,
    grassColor: 0x1B5E20,
    trackLineColor: 0x689F38,
    ambientIntensity: 0.35,
    sunIntensity: 0.4,
    sunColor: 0xAED581,
    fenceColor: 0x3E2723,
    particles: { type: 'firefly', color: 0xCDDC39, count: 50, size: 0.04, speed: 0.8, spread: 18 },
    sideDecorations: [
      {
        name: '柳树',
        probability: 0.25,
        minDistFromTrack: 3,
        maxDistFromTrack: 14,
        createMesh: createWillowTree,
      },
      {
        name: '藤蔓',
        probability: 0.3,
        minDistFromTrack: 2,
        maxDistFromTrack: 10,
        createMesh: createVines,
      },
      {
        name: '池塘',
        probability: 0.1,
        minDistFromTrack: 5,
        maxDistFromTrack: 12,
        createMesh: createPond,
      },
    ],
  },
];

// ============ 注册表 ============

const THEME_MAP: Map<string, ThemeDef> = new Map();
for (const t of THEMES) {
  THEME_MAP.set(t.id, t);
}

/** 默认主题（草原） */
export const DEFAULT_THEME: ThemeDef = THEMES[0];

/**
 * 根据主题 ID 获取主题定义（找不到返回默认草原主题）
 */
export function getTheme(id: string): ThemeDef {
  return THEME_MAP.get(id) || DEFAULT_THEME;
}

/**
 * 获取所有有效主题 ID
 */
export function getThemeIds(): string[] {
  return THEMES.map(t => t.id);
}

/**
 * 获取所有主题（用于 AI prompt）
 */
export function getThemeLegend(): string {
  return THEMES.map(t => `${t.id} (${t.name})`).join(', ');
}

/**
 * 创建主题栅栏
 */
export function createThemeFence(theme: ThemeDef): THREE.Object3D {
  return createFence(theme.fenceColor);
}

// ============ 装饰物工厂注册表（供 StableScene AI 生成使用） ============

/**
 * 装饰物类型 key → 工厂函数映射
 * StableScene 根据 AI 返回的 decorations 数组查找工厂并实例化装饰物
 */
export const DECORATION_FACTORIES: Record<string, () => THREE.Object3D> = {
  'flower_bush': createFlowerBush,
  'mushroom': createMushroom,
  'bush': createBush,
  'forest_tree': createForestTree,
  'cactus': createCactus,
  'desert_rock': createDesertRock,
  'dry_grass': createDryGrass,
  'street_lamp': createStreetLamp,
  'snow_tree': createSnowTree,
  'ice_block': createIceBlock,
  'snow_mound': createSnowMound,
  'dark_tree': createDarkTree,
  'firefly_light': createFireflyLight,
  'cherry_tree': createCherryTree,
  'lava_rock': createLavaRock,
  'smoke_column': createSmokeColumn,
  'charred_tree': createCharredTree,
  'crystal_pillar': createCrystalPillar,
  'stalactite': createStalactite,
  'neon_pole': createNeonPole,
  'light_wall': createLightWall,
  'coral': createCoral,
  'seaweed': createSeaweed,
  'ruin_pillar': createRuinPillar,
  'vines': createVines,
  'cloud_pillar': createCloudPillar,
  'rainbow_arc': createRainbowArc,
  'lava_fountain': createLavaFountain,
  'flame_wall': createFlameWall,
  // —— 新增装饰物 ——
  'bamboo': createBamboo,
  'sunflower': createSunflower,
  'willow_tree': createWillowTree,
  'pond': createPond,
  'windmill': createWindmill,
  'campfire': createCampfire,
  'totem_pole': createTotemPole,
  'mailbox': createMailbox,
  'magic_crystal': createMagicCrystal,
  'portal_ring': createPortalRing,
  'floating_island': createFloatingIsland,
  'lantern': createLantern,
};

/**
 * 树木风格 key → 工厂函数映射
 */
export const TREE_STYLE_FACTORIES: Record<string, () => THREE.Object3D> = {
  'pine': createDefaultTree,
  'cherry': createCherryTree,
  'dark': createDarkTree,
  'snow': createSnowTree,
  'charred': createCharredTree,
  'forest': createForestTree,
  'palm': createDefaultTree, // palm 没有单独工厂，复用默认树
  // —— 新增树木风格 ——
  'bamboo_tree': createBambooTree,
  'willow': createWillowStyleTree,
  'sakura': createSakuraTree,
  'autumn': createAutumnTree,
};
