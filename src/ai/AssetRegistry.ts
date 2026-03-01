/**
 * 内置 3D 资源注册表
 * 每个字符映射到一种 3D 物体，供 ASCII 地图系统使用
 * 所有 mesh 使用 MeshToonMaterial 保持卡通风格
 */

import * as THREE from 'three';
import { GeometryUtils } from '../utils/GeometryUtils';

// ============ 类型定义 ============

export type AssetCategory = 'obstacle' | 'decoration' | 'collectible' | 'special';

export interface AssetDef {
  char: string;
  name: string;
  category: AssetCategory;
  width: number;      // 碰撞宽度 (X)
  height: number;     // 模型高度 (Y)
  depth: number;      // 碰撞深度 (Z)
  color: number;      // 主颜色
  isBlocking: boolean; // 是否阻挡玩家（碰撞=game over）
  trackPlaceable: boolean; // 是否可放置在赛道中央（false=只能放边缘/侧边）
  value?: number;     // 收集物品的分值
  createMesh(): THREE.Object3D;
}

// ============ 资源定义 ============

const ASSETS: AssetDef[] = [
  // --- 障碍物 ---
  {
    char: 'B',
    name: '木箱',
    category: 'obstacle',
    width: 1.5, height: 1.5, depth: 1.5,
    color: 0xA0522D,
    isBlocking: true,
    trackPlaceable: true,
    createMesh() {
      const geo = GeometryUtils.createRoundedBox(1.5, 1.5, 1.5, 0.1);
      const mat = new THREE.MeshToonMaterial({ color: 0xA0522D });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      // 木箱纹理：十字条纹
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(1.55, 0.12, 0.12),
        new THREE.MeshToonMaterial({ color: 0x8B4513 })
      );
      const stripe2 = stripe.clone();
      stripe2.rotation.z = Math.PI / 2;
      const group = new THREE.Group();
      group.add(mesh, stripe, stripe2);
      return group;
    }
  },
  {
    char: 'b',
    name: '小木箱',
    category: 'obstacle',
    width: 0.8, height: 0.8, depth: 0.8,
    color: 0xCD853F,
    isBlocking: true,
    trackPlaceable: true,
    createMesh() {
      const geo = GeometryUtils.createRoundedBox(0.8, 0.8, 0.8, 0.08);
      const mat = new THREE.MeshToonMaterial({ color: 0xCD853F });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      return mesh;
    }
  },
  {
    char: 'L',
    name: '大路障',
    category: 'obstacle',
    width: 2.0, height: 2.0, depth: 2.0,
    color: 0x654321,
    isBlocking: true,
    trackPlaceable: true,
    createMesh() {
      const geo = GeometryUtils.createRoundedBox(2.0, 2.0, 2.0, 0.12);
      const mat = new THREE.MeshToonMaterial({ color: 0x654321 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      // 警告条纹
      const warnStripe = new THREE.Mesh(
        new THREE.BoxGeometry(2.05, 0.2, 0.2),
        new THREE.MeshToonMaterial({ color: 0xFFCC00 })
      );
      warnStripe.position.y = 0.5;
      const group = new THREE.Group();
      group.add(mesh, warnStripe);
      return group;
    }
  },
  {
    char: 'A',
    name: '移动障碍',
    category: 'obstacle',
    width: 1.2, height: 1.2, depth: 1.2,
    color: 0xFF4444,
    isBlocking: true,
    trackPlaceable: true,
    createMesh() {
      const geo = GeometryUtils.createRoundedBox(1.2, 1.2, 1.2, 0.1);
      const mat = new THREE.MeshToonMaterial({ color: 0xFF4444 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      // 箭头指示移动方向
      const arrow = new THREE.Mesh(
        new THREE.ConeGeometry(0.2, 0.4, 8),
        new THREE.MeshToonMaterial({ color: 0xFFFFFF })
      );
      arrow.rotation.z = -Math.PI / 2;
      arrow.position.set(0.7, 0, 0);
      const arrow2 = arrow.clone();
      arrow2.rotation.z = Math.PI / 2;
      arrow2.position.set(-0.7, 0, 0);
      const group = new THREE.Group();
      group.add(mesh, arrow, arrow2);
      return group;
    }
  },
  {
    char: 'R',
    name: '岩石',
    category: 'obstacle',
    width: 1.0, height: 0.8, depth: 1.0,
    color: 0x808080,
    isBlocking: true,
    trackPlaceable: true,
    createMesh() {
      // 不规则岩石：多面体
      const geo = new THREE.DodecahedronGeometry(0.55, 0);
      const mat = new THREE.MeshToonMaterial({ color: 0x808080 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.scale.set(1.0, 0.7, 1.0);
      mesh.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, 0);
      mesh.castShadow = true;
      return mesh;
    }
  },
  {
    char: 'J',
    name: '跳板',
    category: 'obstacle',
    width: 1.5, height: 0.5, depth: 1.5,
    color: 0xDEB887,
    isBlocking: true,
    trackPlaceable: true,
    createMesh() {
      // 斜面跳板
      const group = new THREE.Group();
      const rampGeo = new THREE.BoxGeometry(1.5, 0.15, 1.5);
      const rampMat = new THREE.MeshToonMaterial({ color: 0xDEB887 });
      const ramp = new THREE.Mesh(rampGeo, rampMat);
      ramp.rotation.x = -0.25; // 略微倾斜
      ramp.position.y = 0.15;
      ramp.castShadow = true;
      group.add(ramp);
      // 支撑
      const support = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.3, 0.15),
        new THREE.MeshToonMaterial({ color: 0x8B4513 })
      );
      support.position.set(0, 0.15, 0.65);
      group.add(support);
      return group;
    }
  },
  {
    char: 'H',
    name: '干草堆',
    category: 'obstacle',
    width: 1.2, height: 1.0, depth: 1.2,
    color: 0xDAA520,
    isBlocking: true,
    trackPlaceable: true,
    createMesh() {
      const geo = new THREE.CylinderGeometry(0.6, 0.65, 1.0, 12);
      const mat = new THREE.MeshToonMaterial({ color: 0xDAA520 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      // 顶部稻草
      const topGeo = new THREE.CylinderGeometry(0.5, 0.6, 0.15, 12);
      const topMat = new THREE.MeshToonMaterial({ color: 0xF0C040 });
      const top = new THREE.Mesh(topGeo, topMat);
      top.position.y = 0.55;
      const group = new THREE.Group();
      group.add(mesh, top);
      return group;
    }
  },
  {
    char: 'F',
    name: '栅栏',
    category: 'obstacle',
    width: 2.0, height: 1.0, depth: 0.3,
    color: 0xFFFFFF,
    isBlocking: true,
    trackPlaceable: true,
    createMesh() {
      const group = new THREE.Group();
      const mat = new THREE.MeshToonMaterial({ color: 0xFFFFFF });
      // 两根柱子
      const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.0, 8);
      const post1 = new THREE.Mesh(postGeo, mat);
      post1.position.set(-0.8, 0, 0);
      const post2 = new THREE.Mesh(postGeo, mat);
      post2.position.set(0.8, 0, 0);
      // 两根横杆
      const railGeo = new THREE.BoxGeometry(1.8, 0.08, 0.08);
      const rail1 = new THREE.Mesh(railGeo, mat);
      rail1.position.y = 0.2;
      const rail2 = new THREE.Mesh(railGeo, mat);
      rail2.position.y = -0.15;
      group.add(post1, post2, rail1, rail2);
      group.castShadow = true;
      return group;
    }
  },
  {
    char: 'P',
    name: '石柱',
    category: 'obstacle',
    width: 0.6, height: 1.8, depth: 0.6,
    color: 0x999999,
    isBlocking: true,
    trackPlaceable: true,
    createMesh() {
      const geo = new THREE.CylinderGeometry(0.3, 0.35, 1.8, 10);
      const mat = new THREE.MeshToonMaterial({ color: 0x999999 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      // 顶部装饰
      const capGeo = new THREE.CylinderGeometry(0.4, 0.35, 0.15, 10);
      const cap = new THREE.Mesh(capGeo, mat);
      cap.position.y = 0.95;
      const group = new THREE.Group();
      group.add(mesh, cap);
      return group;
    }
  },
  {
    char: 'K',
    name: '木桶',
    category: 'obstacle',
    width: 0.8, height: 0.9, depth: 0.8,
    color: 0x8B4513,
    isBlocking: true,
    trackPlaceable: true,
    createMesh() {
      const geo = new THREE.CylinderGeometry(0.35, 0.4, 0.9, 12);
      const mat = new THREE.MeshToonMaterial({ color: 0x8B4513 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      // 金属箍
      const ringGeo = new THREE.TorusGeometry(0.38, 0.03, 8, 16);
      const ringMat = new THREE.MeshToonMaterial({ color: 0x888888 });
      const ring1 = new THREE.Mesh(ringGeo, ringMat);
      ring1.rotation.x = Math.PI / 2;
      ring1.position.y = 0.2;
      const ring2 = ring1.clone();
      ring2.position.y = -0.2;
      const group = new THREE.Group();
      group.add(mesh, ring1, ring2);
      return group;
    }
  },

  // --- 装饰物（不阻挡） ---
  {
    char: 'T',
    name: '树',
    category: 'decoration',
    width: 1.5, height: 5.5, depth: 1.5,
    color: 0x228B22,
    isBlocking: false,
    trackPlaceable: false,
    createMesh() {
      const group = new THREE.Group();
      // 树干
      const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 2.0, 8);
      const trunkMat = new THREE.MeshToonMaterial({ color: 0x8B4513 });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.0;
      trunk.castShadow = true;
      group.add(trunk);
      // 树冠
      const foliageGeo = new THREE.ConeGeometry(1.2, 2.5, 8);
      const foliageMat = new THREE.MeshToonMaterial({ color: 0x228B22 });
      const foliage = new THREE.Mesh(foliageGeo, foliageMat);
      foliage.position.y = 3.2;
      foliage.castShadow = true;
      group.add(foliage);
      // 第二层树冠（更小）
      const foliage2Geo = new THREE.ConeGeometry(0.8, 1.8, 8);
      const foliage2 = new THREE.Mesh(foliage2Geo, foliageMat);
      foliage2.position.y = 4.5;
      group.add(foliage2);
      return group;
    }
  },
  {
    char: 'M',
    name: '蘑菇',
    category: 'decoration',
    width: 0.6, height: 0.5, depth: 0.6,
    color: 0xFF4500,
    isBlocking: false,
    trackPlaceable: false,
    createMesh() {
      const group = new THREE.Group();
      // 菌柄
      const stemGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.3, 8);
      const stemMat = new THREE.MeshToonMaterial({ color: 0xFFF8DC });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.y = 0.15;
      group.add(stem);
      // 菌盖
      const capGeo = new THREE.SphereGeometry(0.25, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const capMat = new THREE.MeshToonMaterial({ color: 0xFF4500 });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = 0.3;
      group.add(cap);
      // 白色斑点
      const dotGeo = new THREE.SphereGeometry(0.05, 6, 6);
      const dotMat = new THREE.MeshToonMaterial({ color: 0xFFFFFF });
      for (let i = 0; i < 3; i++) {
        const dot = new THREE.Mesh(dotGeo, dotMat);
        const angle = (i / 3) * Math.PI * 2;
        dot.position.set(Math.cos(angle) * 0.15, 0.4, Math.sin(angle) * 0.15);
        group.add(dot);
      }
      return group;
    }
  },
  {
    char: 'V',
    name: '花丛',
    category: 'decoration',
    width: 1.0, height: 0.4, depth: 1.0,
    color: 0xFF69B4,
    isBlocking: false,
    trackPlaceable: false,
    createMesh() {
      const group = new THREE.Group();
      const colors = [0xFF69B4, 0xFFD700, 0xFF6347, 0x9370DB, 0x00CED1];
      // 几朵花 + 绿叶底座
      const baseGeo = new THREE.SphereGeometry(0.4, 8, 6);
      const baseMat = new THREE.MeshToonMaterial({ color: 0x32CD32 });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.scale.y = 0.4;
      base.position.y = 0.1;
      group.add(base);
      for (let i = 0; i < 5; i++) {
        const flowerGeo = new THREE.SphereGeometry(0.1, 6, 6);
        const flowerMat = new THREE.MeshToonMaterial({ color: colors[i] });
        const flower = new THREE.Mesh(flowerGeo, flowerMat);
        const angle = (i / 5) * Math.PI * 2;
        flower.position.set(
          Math.cos(angle) * 0.25,
          0.25 + Math.random() * 0.15,
          Math.sin(angle) * 0.25
        );
        group.add(flower);
      }
      return group;
    }
  },
  {
    char: 'G',
    name: '选择站拱门',
    category: 'decoration',
    width: 0.5, height: 7.0, depth: 0.5,
    color: 0xFFD700,
    isBlocking: false,
    trackPlaceable: false,
    createMesh() {
      const group = new THREE.Group();
      const pillarMat = new THREE.MeshToonMaterial({ color: 0xFFD700, emissive: 0xCC9900, emissiveIntensity: 0.15 });
      const glowMat = new THREE.MeshToonMaterial({ color: 0xFFFF00, emissive: 0xFFAA00, emissiveIntensity: 0.5 });

      // 左柱（赛道外侧，不挡路）
      const pillarGeo = new THREE.BoxGeometry(0.6, 7.0, 0.6);
      const leftPillar = new THREE.Mesh(pillarGeo, pillarMat);
      leftPillar.position.set(-5.5, 3.5, 0);
      leftPillar.castShadow = true;
      group.add(leftPillar);

      // 右柱
      const rightPillar = new THREE.Mesh(pillarGeo, pillarMat);
      rightPillar.position.set(5.5, 3.5, 0);
      rightPillar.castShadow = true;
      group.add(rightPillar);

      // 左柱底座
      const baseMat = new THREE.MeshToonMaterial({ color: 0xDAA520 });
      const baseGeo = new THREE.BoxGeometry(1.0, 0.4, 1.0);
      const leftBase = new THREE.Mesh(baseGeo, baseMat);
      leftBase.position.set(-5.5, 0.2, 0);
      group.add(leftBase);
      const rightBase = new THREE.Mesh(baseGeo, baseMat);
      rightBase.position.set(5.5, 0.2, 0);
      group.add(rightBase);

      // 横梁（高于马匹头顶，不挡视线）
      const beamGeo = new THREE.BoxGeometry(11.6, 0.5, 0.5);
      const beam = new THREE.Mesh(beamGeo, pillarMat);
      beam.position.set(0, 7.2, 0);
      beam.castShadow = true;
      group.add(beam);

      // 横梁底部装饰条（发光）
      const stripGeo = new THREE.BoxGeometry(11.6, 0.15, 0.6);
      const strip = new THREE.Mesh(stripGeo, glowMat);
      strip.position.set(0, 6.9, 0);
      group.add(strip);

      // 顶部装饰球（大一些，更醒目）
      const orbGeo = new THREE.SphereGeometry(0.5, 16, 16);
      const orb = new THREE.Mesh(orbGeo, glowMat);
      orb.position.set(0, 7.8, 0);
      group.add(orb);

      // 柱顶小球（左右各一个）
      const smallOrbGeo = new THREE.SphereGeometry(0.25, 12, 12);
      const leftOrb = new THREE.Mesh(smallOrbGeo, glowMat);
      leftOrb.position.set(-5.5, 7.2, 0);
      group.add(leftOrb);
      const rightOrb = new THREE.Mesh(smallOrbGeo, glowMat);
      rightOrb.position.set(5.5, 7.2, 0);
      group.add(rightOrb);

      return group;
    }
  },

  // --- 特殊物体 ---
  {
    char: 'W',
    name: '水坑',
    category: 'special',
    width: 1.5, height: 0.05, depth: 1.5,
    color: 0x4488FF,
    isBlocking: false,
    trackPlaceable: true,
    createMesh() {
      const geo = new THREE.CylinderGeometry(0.75, 0.75, 0.05, 16);
      const mat = new THREE.MeshToonMaterial({
        color: 0x4488FF,
        transparent: true,
        opacity: 0.7,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 0.03;
      return mesh;
    }
  },

  // --- 新增障碍物 ---
  {
    char: 'I',
    name: '冰柱',
    category: 'obstacle',
    width: 0.5, height: 2.0, depth: 0.5,
    color: 0x88CCFF,
    isBlocking: true,
    trackPlaceable: true,
    createMesh() {
      const group = new THREE.Group();
      const mat = new THREE.MeshToonMaterial({ color: 0x88CCFF, transparent: true, opacity: 0.75 });
      const geo = new THREE.CylinderGeometry(0.1, 0.3, 2.0, 6);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      group.add(mesh);
      // 顶部尖端
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.12, 0.3, 6),
        mat
      );
      tip.position.y = 1.15;
      group.add(tip);
      return group;
    }
  },
  {
    char: 'X',
    name: '交叉栏杆',
    category: 'obstacle',
    width: 2.0, height: 1.5, depth: 0.3,
    color: 0x8B4513,
    isBlocking: true,
    trackPlaceable: true,
    createMesh() {
      const group = new THREE.Group();
      const mat = new THREE.MeshToonMaterial({ color: 0x8B4513 });
      // X 形交叉
      const bar1 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.12), mat);
      bar1.rotation.z = Math.PI / 4;
      bar1.position.y = 0;
      const bar2 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.12), mat);
      bar2.rotation.z = -Math.PI / 4;
      bar2.position.y = 0;
      // 支撑柱
      const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.5, 6);
      const post1 = new THREE.Mesh(postGeo, mat);
      post1.position.set(-0.8, 0, 0);
      const post2 = new THREE.Mesh(postGeo, mat);
      post2.position.set(0.8, 0, 0);
      group.add(bar1, bar2, post1, post2);
      group.castShadow = true;
      return group;
    }
  },
  {
    char: 'D',
    name: '碎石堆',
    category: 'obstacle',
    width: 1.5, height: 0.6, depth: 1.5,
    color: 0x8B7355,
    isBlocking: true,
    trackPlaceable: true,
    createMesh() {
      const group = new THREE.Group();
      const colors = [0x8B7355, 0x9E8B6E, 0x7A6B50];
      for (let i = 0; i < 5; i++) {
        const stone = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.15 + Math.random() * 0.15, 0),
          new THREE.MeshToonMaterial({ color: colors[Math.floor(Math.random() * colors.length)] })
        );
        stone.position.set(
          (Math.random() - 0.5) * 0.8,
          0.1 + Math.random() * 0.2,
          (Math.random() - 0.5) * 0.8
        );
        stone.rotation.set(Math.random(), Math.random(), 0);
        stone.castShadow = true;
        group.add(stone);
      }
      return group;
    }
  },
  {
    char: 'N',
    name: '荆棘丛',
    category: 'obstacle',
    width: 1.0, height: 0.8, depth: 1.0,
    color: 0x2E5E1A,
    isBlocking: true,
    trackPlaceable: true,
    createMesh() {
      const group = new THREE.Group();
      const bushMat = new THREE.MeshToonMaterial({ color: 0x2E5E1A });
      const thornMat = new THREE.MeshToonMaterial({ color: 0x5C3A1A });
      // 灌木主体
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), bushMat);
      bush.scale.y = 0.7;
      bush.position.y = 0.3;
      bush.castShadow = true;
      group.add(bush);
      // 刺
      for (let i = 0; i < 6; i++) {
        const thorn = new THREE.Mesh(
          new THREE.ConeGeometry(0.03, 0.2, 4),
          thornMat
        );
        const angle = (i / 6) * Math.PI * 2;
        thorn.position.set(Math.cos(angle) * 0.4, 0.3, Math.sin(angle) * 0.4);
        thorn.rotation.z = Math.cos(angle) * 0.5;
        thorn.rotation.x = Math.sin(angle) * 0.5;
        group.add(thorn);
      }
      return group;
    }
  },
  {
    char: 'Z',
    name: '旋转锯片',
    category: 'obstacle',
    width: 1.2, height: 1.2, depth: 0.1,
    color: 0xAAAAAA,
    isBlocking: true,
    trackPlaceable: true,
    createMesh() {
      const group = new THREE.Group();
      // 锯片圆盘
      const discMat = new THREE.MeshToonMaterial({ color: 0xAAAAAA, emissive: 0x333333, emissiveIntensity: 0.2 });
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 16), discMat);
      disc.rotation.x = Math.PI / 2;
      disc.castShadow = true;
      group.add(disc);
      // 中心
      const center = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 0.1, 8),
        new THREE.MeshToonMaterial({ color: 0xFF4444 })
      );
      center.rotation.x = Math.PI / 2;
      group.add(center);
      // 标记为旋转动画
      group.userData.isSpinning = true;
      return group;
    }
  },
  {
    char: 'Q',
    name: '弹射板',
    category: 'special',
    width: 1.5, height: 0.1, depth: 1.5,
    color: 0x00FF88,
    isBlocking: false,
    trackPlaceable: true,
    createMesh() {
      const group = new THREE.Group();
      const mat = new THREE.MeshToonMaterial({ color: 0x00FF88, emissive: 0x008844, emissiveIntensity: 0.4 });
      const pad = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 1.5), mat);
      pad.position.y = 0.05;
      group.add(pad);
      // 箭头指示
      const arrow = new THREE.Mesh(
        new THREE.ConeGeometry(0.15, 0.3, 4),
        new THREE.MeshToonMaterial({ color: 0xFFFFFF })
      );
      arrow.position.set(0, 0.2, 0);
      group.add(arrow);
      return group;
    }
  },

  // --- 新增装饰物 ---
  {
    char: 'U',
    name: '拱门装饰',
    category: 'decoration',
    width: 2.0, height: 3.0, depth: 0.5,
    color: 0x8B8378,
    isBlocking: false,
    trackPlaceable: false,
    createMesh() {
      const group = new THREE.Group();
      const mat = new THREE.MeshToonMaterial({ color: 0x8B8378 });
      // 两根柱子
      const pillarGeo = new THREE.CylinderGeometry(0.15, 0.2, 2.5, 8);
      const lp = new THREE.Mesh(pillarGeo, mat);
      lp.position.set(-0.8, 1.25, 0);
      lp.castShadow = true;
      const rp = new THREE.Mesh(pillarGeo, mat);
      rp.position.set(0.8, 1.25, 0);
      rp.castShadow = true;
      // 拱形
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(0.8, 0.12, 8, 12, Math.PI),
        mat
      );
      arch.position.set(0, 2.5, 0);
      group.add(lp, rp, arch);
      return group;
    }
  },

  // --- 新增收集物 ---
  {
    char: 'E',
    name: '能量水晶',
    category: 'collectible',
    width: 0.4, height: 0.6, depth: 0.4,
    color: 0x00FFAA,
    isBlocking: false,
    trackPlaceable: true,
    value: 10,
    createMesh() {
      const group = new THREE.Group();
      // 六棱柱水晶
      const crystalGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.5, 6);
      const crystalMat = new THREE.MeshToonMaterial({
        color: 0x00FFAA,
        emissive: 0x00AA66,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.85,
      });
      const crystal = new THREE.Mesh(crystalGeo, crystalMat);
      crystal.position.y = 1.0;
      group.add(crystal);
      // 尖端
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.15, 0.2, 6),
        crystalMat
      );
      tip.position.y = 1.35;
      group.add(tip);
      const tipBot = new THREE.Mesh(
        new THREE.ConeGeometry(0.15, 0.2, 6),
        crystalMat
      );
      tipBot.position.y = 0.65;
      tipBot.rotation.x = Math.PI;
      group.add(tipBot);
      return group;
    }
  },

  // --- 收集物 ---
  {
    char: '*',
    name: '金币',
    category: 'collectible',
    width: 0.4, height: 0.4, depth: 0.4,
    color: 0xFFD700,
    isBlocking: false,
    trackPlaceable: true,
    value: 1,
    createMesh() {
      const geo = new THREE.CylinderGeometry(0.2, 0.2, 0.06, 16);
      const mat = new THREE.MeshToonMaterial({
        color: 0xFFD700,
        emissive: 0xCC9900,
        emissiveIntensity: 0.3,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = Math.PI / 2; // 立起来面向玩家
      mesh.position.y = 0.8; // 浮空
      return mesh;
    }
  },
  {
    char: 'S',
    name: '星星',
    category: 'collectible',
    width: 0.5, height: 0.5, depth: 0.5,
    color: 0xFFFF00,
    isBlocking: false,
    trackPlaceable: true,
    value: 5,
    createMesh() {
      // 五角星用扁平圆柱 + 发光
      const group = new THREE.Group();
      // 用多个小三角拼成星星外观
      const starShape = new THREE.Shape();
      const outerR = 0.25;
      const innerR = 0.1;
      for (let i = 0; i < 5; i++) {
        const outerAngle = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const innerAngle = ((i + 0.5) / 5) * Math.PI * 2 - Math.PI / 2;
        const ox = Math.cos(outerAngle) * outerR;
        const oy = Math.sin(outerAngle) * outerR;
        const ix = Math.cos(innerAngle) * innerR;
        const iy = Math.sin(innerAngle) * innerR;
        if (i === 0) starShape.moveTo(ox, oy);
        else starShape.lineTo(ox, oy);
        starShape.lineTo(ix, iy);
      }
      starShape.closePath();
      const starGeo = new THREE.ExtrudeGeometry(starShape, {
        depth: 0.06,
        bevelEnabled: false,
      });
      const starMat = new THREE.MeshToonMaterial({
        color: 0xFFFF00,
        emissive: 0xFFAA00,
        emissiveIntensity: 0.5,
      });
      const star = new THREE.Mesh(starGeo, starMat);
      star.position.y = 1.0; // 浮空
      group.add(star);
      return group;
    }
  },

  // --- 新增障碍物（第二批） ---
  {
    char: 'C',
    name: '仙人掌',
    category: 'obstacle',
    width: 1.0, height: 2.0, depth: 1.0,
    color: 0x2E8B57,
    isBlocking: true,
    trackPlaceable: true,
    createMesh() {
      const group = new THREE.Group();
      const mat = new THREE.MeshToonMaterial({ color: 0x2E8B57 });
      // 主干
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 1.6, 8), mat);
      body.position.y = 0.8;
      body.castShadow = true;
      group.add(body);
      // 左臂
      const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 8), mat);
      armL.position.set(-0.35, 1.0, 0);
      armL.rotation.z = Math.PI / 3;
      group.add(armL);
      const armLTop = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.5, 8), mat);
      armLTop.position.set(-0.5, 1.35, 0);
      group.add(armLTop);
      // 右臂
      const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8), mat);
      armR.position.set(0.3, 0.7, 0);
      armR.rotation.z = -Math.PI / 3;
      group.add(armR);
      const armRTop = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.4, 8), mat);
      armRTop.position.set(0.42, 1.0, 0);
      group.add(armRTop);
      // 顶部
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat);
      top.position.y = 1.65;
      group.add(top);
      return group;
    }
  },
  {
    char: 'O',
    name: '油桶',
    category: 'obstacle',
    width: 1.2, height: 1.5, depth: 1.2,
    color: 0xD32F2F,
    isBlocking: true,
    trackPlaceable: true,
    createMesh() {
      const group = new THREE.Group();
      const mat = new THREE.MeshToonMaterial({ color: 0xD32F2F });
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 1.5, 12), mat);
      barrel.position.y = 0.75;
      barrel.castShadow = true;
      group.add(barrel);
      // 警告条纹
      const stripeMat = new THREE.MeshToonMaterial({ color: 0xFFD600 });
      const s1 = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.04, 4, 16), stripeMat);
      s1.rotation.x = Math.PI / 2;
      s1.position.y = 0.5;
      group.add(s1);
      const s2 = s1.clone();
      s2.position.y = 1.0;
      group.add(s2);
      return group;
    }
  },
  {
    char: 'Y',
    name: '旋转风车',
    category: 'obstacle',
    width: 1.5, height: 2.5, depth: 1.5,
    color: 0x8D6E63,
    isBlocking: true,
    trackPlaceable: true,
    createMesh() {
      const group = new THREE.Group();
      // 立柱
      const poleMat = new THREE.MeshToonMaterial({ color: 0x8D6E63 });
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.0, 8), poleMat);
      pole.position.y = 1.0;
      pole.castShadow = true;
      group.add(pole);
      // 十字叶片
      const bladeMat = new THREE.MeshToonMaterial({ color: 0xFFFFFF });
      for (let i = 0; i < 4; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.8, 0.04), bladeMat);
        blade.position.y = 2.0;
        blade.rotation.z = (i / 4) * Math.PI * 2;
        blade.translateY(0.4);
        group.add(blade);
      }
      // 中心圆钮
      const hub = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshToonMaterial({ color: 0x455A64 }));
      hub.position.y = 2.0;
      group.add(hub);
      group.userData.isSpinning = true;
      return group;
    }
  },
  {
    char: '2',
    name: '双层木箱',
    category: 'obstacle',
    width: 1.5, height: 2.8, depth: 1.5,
    color: 0xA1887F,
    isBlocking: true,
    trackPlaceable: true,
    createMesh() {
      const group = new THREE.Group();
      const mat = new THREE.MeshToonMaterial({ color: 0xA1887F });
      const stripeMat = new THREE.MeshToonMaterial({ color: 0x6D4C41 });
      // 底箱
      const box1 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.3, 1.4), mat);
      box1.position.y = 0.65;
      box1.castShadow = true;
      group.add(box1);
      const s1 = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.1, 0.1), stripeMat);
      s1.position.y = 0.65;
      group.add(s1);
      // 上箱（稍小，偏移一点）
      const box2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), mat);
      box2.position.set(0.1, 1.9, -0.1);
      box2.rotation.y = 0.15;
      box2.castShadow = true;
      group.add(box2);
      const s2 = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.1, 0.1), stripeMat);
      s2.position.set(0.1, 1.9, -0.1);
      s2.rotation.y = 0.15;
      group.add(s2);
      return group;
    }
  },
  {
    char: '3',
    name: '三角路锥',
    category: 'obstacle',
    width: 0.8, height: 1.0, depth: 0.8,
    color: 0xFF6D00,
    isBlocking: true,
    trackPlaceable: true,
    createMesh() {
      const group = new THREE.Group();
      // 底座
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.08, 0.6),
        new THREE.MeshToonMaterial({ color: 0x212121 })
      );
      base.position.y = 0.04;
      group.add(base);
      // 锥体
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.25, 0.85, 8),
        new THREE.MeshToonMaterial({ color: 0xFF6D00 })
      );
      cone.position.y = 0.5;
      cone.castShadow = true;
      group.add(cone);
      // 白色条纹
      const stripeMat = new THREE.MeshToonMaterial({ color: 0xFFFFFF });
      const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 4, 12), stripeMat);
      stripe.rotation.x = Math.PI / 2;
      stripe.position.y = 0.45;
      group.add(stripe);
      const stripe2 = stripe.clone();
      stripe2.position.y = 0.65;
      group.add(stripe2);
      return group;
    }
  },
  {
    char: '4',
    name: '弹簧陷阱',
    category: 'obstacle',
    width: 1.5, height: 0.8, depth: 1.5,
    color: 0x78909C,
    isBlocking: true,
    trackPlaceable: true,
    createMesh() {
      const group = new THREE.Group();
      // 底板
      const baseMat = new THREE.MeshToonMaterial({ color: 0x546E7A });
      const basePlate = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 1.4), baseMat);
      basePlate.position.y = 0.05;
      group.add(basePlate);
      // 弹簧
      const springMat = new THREE.MeshToonMaterial({ color: 0xB0BEC5 });
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 6, 12), springMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.15 + i * 0.15;
        group.add(ring);
      }
      // 弹射板
      const padMat = new THREE.MeshToonMaterial({ color: 0xFF5722, emissive: 0xBF360C, emissiveIntensity: 0.2 });
      const pad = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 1.0), padMat);
      pad.position.y = 0.6;
      group.add(pad);
      return group;
    }
  },
  {
    char: '5',
    name: '激光围栏',
    category: 'obstacle',
    width: 2.0, height: 1.8, depth: 0.3,
    color: 0xF44336,
    isBlocking: true,
    trackPlaceable: true,
    createMesh() {
      const group = new THREE.Group();
      const poleMat = new THREE.MeshToonMaterial({ color: 0x616161 });
      // 左柱
      const lp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.8, 8), poleMat);
      lp.position.set(-0.9, 0.9, 0);
      lp.castShadow = true;
      group.add(lp);
      // 右柱
      const rp = lp.clone();
      rp.position.set(0.9, 0.9, 0);
      group.add(rp);
      // 红色光束
      const beamMat = new THREE.MeshToonMaterial({ color: 0xF44336, emissive: 0xD32F2F, emissiveIntensity: 0.6 });
      for (let i = 0; i < 3; i++) {
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 4), beamMat);
        beam.rotation.z = Math.PI / 2;
        beam.position.y = 0.4 + i * 0.5;
        group.add(beam);
      }
      // 顶部警示灯
      const warnLight = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 6, 6),
        new THREE.MeshToonMaterial({ color: 0xFF1744, emissive: 0xFF1744, emissiveIntensity: 0.8 })
      );
      warnLight.position.set(-0.9, 1.85, 0);
      group.add(warnLight);
      const warnLight2 = warnLight.clone();
      warnLight2.position.set(0.9, 1.85, 0);
      group.add(warnLight2);
      return group;
    }
  },
  {
    char: '6',
    name: '蘑菇障碍',
    category: 'obstacle',
    width: 1.5, height: 2.0, depth: 1.5,
    color: 0xD32F2F,
    isBlocking: true,
    trackPlaceable: true,
    createMesh() {
      const group = new THREE.Group();
      // 菌柄
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.3, 1.2, 8),
        new THREE.MeshToonMaterial({ color: 0xFFF8E1 })
      );
      stem.position.y = 0.6;
      stem.castShadow = true;
      group.add(stem);
      // 菌盖（大型）
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshToonMaterial({ color: 0xD32F2F })
      );
      cap.position.y = 1.2;
      cap.castShadow = true;
      group.add(cap);
      // 白色斑点
      const dotMat = new THREE.MeshToonMaterial({ color: 0xFFFFFF });
      for (let i = 0; i < 5; i++) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), dotMat);
        const a = (i / 5) * Math.PI * 2;
        dot.position.set(Math.cos(a) * 0.4, 1.45, Math.sin(a) * 0.4);
        group.add(dot);
      }
      return group;
    }
  },

  // --- 新增收集物（第二批） ---
  {
    char: '$',
    name: '钻石',
    category: 'collectible',
    width: 0.5, height: 0.5, depth: 0.5,
    color: 0x00BCD4,
    isBlocking: false,
    trackPlaceable: true,
    value: 15,
    createMesh() {
      const group = new THREE.Group();
      const mat = new THREE.MeshToonMaterial({
        color: 0x00BCD4,
        emissive: 0x006064,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.85,
      });
      // 菱形 = 两个四棱锥
      const topHalf = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.25, 4), mat);
      topHalf.position.y = 1.15;
      group.add(topHalf);
      const bottomHalf = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.15, 4), mat);
      bottomHalf.position.y = 0.92;
      bottomHalf.rotation.x = Math.PI;
      group.add(bottomHalf);
      return group;
    }
  },
  {
    char: '&',
    name: '宝箱',
    category: 'collectible',
    width: 0.6, height: 0.5, depth: 0.5,
    color: 0xFFB300,
    isBlocking: false,
    trackPlaceable: true,
    value: 20,
    createMesh() {
      const group = new THREE.Group();
      // 箱体
      const bodyMat = new THREE.MeshToonMaterial({ color: 0xFFB300 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.35), bodyMat);
      body.position.y = 0.85;
      group.add(body);
      // 箱盖
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.1, 0.37), new THREE.MeshToonMaterial({ color: 0xFFA000 }));
      lid.position.y = 1.05;
      group.add(lid);
      // 金属锁扣
      const lock = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.12, 0.06),
        new THREE.MeshToonMaterial({ color: 0x8D6E63 })
      );
      lock.position.set(0, 0.95, 0.2);
      group.add(lock);
      // 光效
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 8, 8),
        new THREE.MeshToonMaterial({ color: 0xFFFF00, emissive: 0xFFD600, emissiveIntensity: 0.6 })
      );
      glow.position.y = 1.2;
      group.add(glow);
      return group;
    }
  },
  {
    char: '%',
    name: '彩虹糖果',
    category: 'collectible',
    width: 0.4, height: 0.4, depth: 0.4,
    color: 0xE91E63,
    isBlocking: false,
    trackPlaceable: true,
    value: 8,
    createMesh() {
      const group = new THREE.Group();
      const colors = [0xE91E63, 0x9C27B0, 0x2196F3, 0x4CAF50, 0xFFEB3B, 0xFF5722];
      const mat = new THREE.MeshToonMaterial({
        color: colors[Math.floor(Math.random() * colors.length)],
        emissive: 0x880E4F,
        emissiveIntensity: 0.3,
      });
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), mat);
      ball.position.y = 0.9;
      group.add(ball);
      // 彩色光环
      const ringMat = new THREE.MeshToonMaterial({
        color: 0xFFFFFF,
        emissive: 0xFFFFFF,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.5,
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 4, 12), ringMat);
      ring.position.y = 0.9;
      ring.rotation.x = Math.PI / 4;
      group.add(ring);
      return group;
    }
  },
];

// ============ 注册表 Map ============

export const ASSET_MAP: Map<string, AssetDef> = new Map();
for (const def of ASSETS) {
  ASSET_MAP.set(def.char, def);
}

// ============ 公开方法 ============

/**
 * 根据字符获取资源定义
 */
export function getAssetDef(char: string): AssetDef | undefined {
  return ASSET_MAP.get(char);
}

/**
 * 生成给 AI prompt 使用的资源图例字符串
 */
/**
 * AI prompt 中不应出现的字符（模型过大/不适合当障碍）
 * T=树(5.5m高，侧边已有), G=拱门(7.5m宽，横跨整个赛道)
 */
const AI_EXCLUDED_CHARS = new Set(['T', 'G', 'U']);

export function getAssetLegend(): string {
  const lines: string[] = [];
  lines.push('ASSETS (character = object):');
  lines.push('. = empty space (passable)');
  for (const def of ASSETS) {
    // 跳过不适合 AI 使用的资源
    if (AI_EXCLUDED_CHARS.has(def.char)) continue;
    const catLabel = def.category === 'obstacle' ? 'BLOCK' :
                     def.category === 'collectible' ? 'COLLECT' :
                     def.category === 'special' ? 'SPECIAL' : 'DECO';
    const extra = def.value ? ` (+${def.value}pts)` : '';
    lines.push(`${def.char} = ${def.name} [${catLabel}]${extra}`);
  }
  return lines.join('\n');
}

/**
 * 获取所有有效资源字符（用于验证 ASCII 地图）
 */
export function getValidChars(): Set<string> {
  const chars = new Set<string>(['.']);
  for (const def of ASSETS) {
    chars.add(def.char);
  }
  return chars;
}
