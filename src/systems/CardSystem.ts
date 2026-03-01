/**
 * Roguelike 挑战卡系统
 * AI 根据玩家行为数据策略性出牌，玩家每 100m 选择一张卡牌
 */

import { PlayerTelemetry } from './PlayerBehaviorTracker';

// ============ 游戏上下文（卡牌效果作用的状态） ============

export interface GameContext {
  speedMultiplier: number;       // 速度倍率 (默认 1.0)
  trackWidthMultiplier: number;  // 赛道宽度倍率 (默认 1.0)
  coinMultiplier: number;        // 金币价值倍率 (默认 1.0)
  obstacleMultiplier: number;    // 障碍密度倍率 (默认 1.0)
  fogMultiplier: number;         // 雾距倍率 (默认 1.0，<1=视距缩短)
  shieldCount: number;           // 护盾次数
  reviveCount: number;           // 复活次数
  invertControls: boolean;       // 操控反转
  highlightObstacles: boolean;   // 障碍物高亮
  magnetActive: boolean;         // 磁铁吸金币
  forceStarNextChunk: boolean;   // 下段必出星星
}

export function createDefaultContext(): GameContext {
  return {
    speedMultiplier: 1.0,
    trackWidthMultiplier: 1.0,
    coinMultiplier: 1.0,
    obstacleMultiplier: 1.0,
    fogMultiplier: 1.0,
    shieldCount: 0,
    reviveCount: 0,
    invertControls: false,
    highlightObstacles: false,
    magnetActive: false,
    forceStarNextChunk: false,
  };
}

// ============ 卡牌定义 ============

export type CardCategory = 'buff' | 'reward' | 'trap';

export interface CardDef {
  id: string;
  icon: string;
  name: string;
  desc: string;
  cost?: string;           // 代价描述（增益卡才有）
  category: CardCategory;
  duration?: number;        // 持续秒数; 0=永久; undefined=即时
  apply(ctx: GameContext): void;
  remove?(ctx: GameContext): void;
}

export interface ActiveEffect {
  card: CardDef;
  remainingTime: number;    // -1=永久, >0=倒计时秒
}

// ============ 8 张核心卡牌 ============

const CARD_SPEED_BOOST: CardDef = {
  id: 'speed_boost',
  icon: '🚀',
  name: '极速',
  desc: '速度+30%',
  cost: '赛道变窄',
  category: 'buff',
  duration: 30,  // 30秒
  apply(ctx) {
    ctx.speedMultiplier *= 1.3;
    ctx.trackWidthMultiplier *= 0.7;
  },
  remove(ctx) {
    ctx.speedMultiplier /= 1.3;
    ctx.trackWidthMultiplier /= 0.7;
  },
};

const CARD_MAGNET: CardDef = {
  id: 'magnet',
  icon: '🧲',
  name: '磁铁',
  desc: '自动吸金币',
  cost: '障碍变多',
  category: 'buff',
  duration: 20,  // 20秒
  apply(ctx) {
    ctx.magnetActive = true;
    ctx.obstacleMultiplier *= 1.5;
  },
  remove(ctx) {
    ctx.magnetActive = false;
    ctx.obstacleMultiplier /= 1.5;
  },
};

const CARD_SHIELD: CardDef = {
  id: 'shield',
  icon: '🛡️',
  name: '护盾',
  desc: '免疫1次碰撞',
  cost: '速度-20%',
  category: 'buff',
  duration: 30,  // 30秒内有效（超时未触发则过期）
  apply(ctx) {
    ctx.shieldCount += 1;
    ctx.speedMultiplier *= 0.8;
  },
  remove(ctx) {
    ctx.shieldCount = Math.max(0, ctx.shieldCount - 1);
    ctx.speedMultiplier /= 0.8;
  },
};

const CARD_COIN_TRIPLE: CardDef = {
  id: 'coin_triple',
  icon: '💰',
  name: '暴富',
  desc: '金币价值x3',
  category: 'reward',
  duration: 25,  // 25秒
  apply(ctx) {
    ctx.coinMultiplier *= 3;
  },
  remove(ctx) {
    ctx.coinMultiplier /= 3;
  },
};

const CARD_REVIVE: CardDef = {
  id: 'revive',
  icon: '❤️',
  name: '重生',
  desc: '复活1次',
  category: 'reward',
  duration: 0,  // 永久有效，不限时
  apply(ctx) {
    ctx.reviveCount += 1;
  },
};

const CARD_FOG: CardDef = {
  id: 'fog',
  icon: '🌫️',
  name: '赌雾',
  desc: '视距-50% 金币x5',
  category: 'trap',
  duration: 15,
  apply(ctx) {
    ctx.fogMultiplier *= 0.5;
    ctx.coinMultiplier *= 5;
  },
  remove(ctx) {
    ctx.fogMultiplier /= 0.5;
    ctx.coinMultiplier /= 5;
  },
};

const CARD_MIRROR: CardDef = {
  id: 'mirror',
  icon: '🔄',
  name: '镜中财',
  desc: '反转5秒 送1护盾',
  category: 'trap',
  duration: 5,
  apply(ctx) {
    ctx.invertControls = true;
    ctx.shieldCount += 1;
  },
  remove(ctx) {
    ctx.invertControls = false;
    // 护盾不随反转结束移除，可保留使用
  },
};

const CARD_FORCE_SPEED: CardDef = {
  id: 'force_speed',
  icon: '⚡',
  name: '狂飙',
  desc: '加速5秒 金币x3+磁铁',
  category: 'trap',
  duration: 5,
  apply(ctx) {
    ctx.speedMultiplier *= 1.8;
    ctx.coinMultiplier *= 3;
    ctx.magnetActive = true;
  },
  remove(ctx) {
    ctx.speedMultiplier /= 1.8;
    ctx.coinMultiplier /= 3;
    ctx.magnetActive = false;
  },
};

// 全部卡牌池
const ALL_CARDS: CardDef[] = [
  CARD_SPEED_BOOST,
  CARD_MAGNET,
  CARD_SHIELD,
  CARD_COIN_TRIPLE,
  CARD_REVIVE,
  CARD_FOG,
  CARD_MIRROR,
  CARD_FORCE_SPEED,
];

const BUFF_CARDS = ALL_CARDS.filter(c => c.category === 'buff');
const REWARD_CARDS = ALL_CARDS.filter(c => c.category === 'reward');
const TRAP_CARDS = ALL_CARDS.filter(c => c.category === 'trap');

// ============ AI 嘲讽文本库 ============

const TAUNTS: Record<string, string[]> = {
  leanLeft: ['你总是往左跑...', '左边很安全？', '试试右边的世界'],
  leanRight: ['又往右？', '右边是你的舒适区吗', '我在右边等你'],
  safe: ['胆小鬼...', '来点刺激的', '你在怕什么'],
  aggressive: ['鲁莽！', '勇气可嘉', '你真敢选'],
  balanced: ['看不透你', '再给我点数据', '有点意思'],
  afterCrash: ['摔疼了？', '这次小心点', '送你个礼物'],
  highSpeed: ['还能更快吗', '极限在哪里', '快到模糊了'],
  general: ['来，选一张', '命运在你手中', '我看你不敢选', '准备好了吗'],
};

// ============ CardSystem 核心类 ============

export class CardSystem {
  private activeEffects: ActiveEffect[] = [];
  private context: GameContext;
  private pickedCards: CardDef[] = [];  // 本局已选过的卡牌记录

  constructor() {
    this.context = createDefaultContext();
  }

  // ---- 获取当前上下文 ----

  getContext(): GameContext {
    return this.context;
  }

  getActiveEffects(): ActiveEffect[] {
    return this.activeEffects;
  }

  getPickedCards(): CardDef[] {
    return this.pickedCards;
  }

  // ---- AI 出牌：生成 3 张手牌 ----

  generateHand(telemetry: PlayerTelemetry): { cards: CardDef[]; taunt: string } {
    const cards: CardDef[] = [];

    // 1) AI 陷阱卡（必定有 1 张，根据玩家行为选择）
    const trap = this.pickTrap(telemetry);
    cards.push(trap);

    // 2) 增益卡（1 张）
    const buff = this.pickRandom(BUFF_CARDS, cards);
    cards.push(buff);

    // 3) 第三张：30% 纯奖励，70% 增益或陷阱
    if (Math.random() < 0.3) {
      const reward = this.pickRandom(REWARD_CARDS, cards);
      cards.push(reward);
    } else {
      // 玩家保守 → 更多增益引诱冒险；激进 → 更多陷阱
      const pool = telemetry.style === 'aggressive' ? TRAP_CARDS : BUFF_CARDS;
      const third = this.pickRandom(pool, cards);
      cards.push(third);
    }

    // 打乱顺序
    this.shuffle(cards);

    // 生成嘲讽
    const taunt = this.pickTaunt(telemetry);

    return { cards, taunt };
  }

  // ---- 应用卡牌效果 ----

  applyCard(card: CardDef): void {
    this.pickedCards.push(card);

    // 应用效果到 context
    card.apply(this.context);

    // 如果有持续时间，加入 activeEffects
    if (card.duration !== undefined) {
      this.activeEffects.push({
        card,
        remainingTime: card.duration === 0 ? -1 : card.duration,
      });
    }
  }

  // ---- 每帧更新倒计时 ----

  tick(deltaTime: number): void {
    const expired: ActiveEffect[] = [];

    for (const effect of this.activeEffects) {
      if (effect.remainingTime > 0) {
        effect.remainingTime -= deltaTime;
        if (effect.remainingTime <= 0) {
          expired.push(effect);
        }
      }
      // remainingTime === -1 表示永久，不递减
    }

    // 移除过期效果
    for (const e of expired) {
      if (e.card.remove) {
        e.card.remove(this.context);
      }
      const idx = this.activeEffects.indexOf(e);
      if (idx >= 0) this.activeEffects.splice(idx, 1);
    }
  }

  // ---- 护盾消耗 ----

  consumeShield(): boolean {
    if (this.context.shieldCount > 0) {
      this.context.shieldCount--;
      // 护盾被碰撞消耗：移除对应的 activeEffect 并恢复速度
      const shieldEffect = this.activeEffects.find(e => e.card.id === 'shield');
      if (shieldEffect) {
        // 只恢复速度减益，不再修改 shieldCount（已经减了）
        this.context.speedMultiplier /= 0.8;
        const idx = this.activeEffects.indexOf(shieldEffect);
        if (idx >= 0) this.activeEffects.splice(idx, 1);
      }
      return true;
    }
    return false;
  }

  // ---- 复活消耗 ----

  consumeRevive(): boolean {
    if (this.context.reviveCount > 0) {
      this.context.reviveCount--;
      return true;
    }
    return false;
  }

  // ---- 重置 ----

  reset(): void {
    // 移除所有效果
    for (const e of this.activeEffects) {
      if (e.card.remove) e.card.remove(this.context);
    }
    this.activeEffects = [];
    this.context = createDefaultContext();
    this.pickedCards = [];
  }

  // ============ 内部方法 ============

  /** 根据行为数据选择最有针对性的陷阱卡 */
  private pickTrap(telemetry: PlayerTelemetry): CardDef {
    // 偏左/偏右 → 镜像卡
    if (Math.abs(telemetry.laneBias) > 0.3 && Math.random() < 0.6) {
      return CARD_MIRROR;
    }
    // 高速/激进 → 强制加速
    if (telemetry.style === 'aggressive' && Math.random() < 0.5) {
      return CARD_FORCE_SPEED;
    }
    // 保守 → 迷雾（逼出舒适区）
    if (telemetry.style === 'safe' && Math.random() < 0.5) {
      return CARD_FOG;
    }
    // 默认随机
    return TRAP_CARDS[Math.floor(Math.random() * TRAP_CARDS.length)];
  }

  /** 从池中随机选一张（排除已选） */
  private pickRandom(pool: CardDef[], exclude: CardDef[]): CardDef {
    const available = pool.filter(c => !exclude.some(e => e.id === c.id));
    if (available.length === 0) {
      // 无可用则从全池选
      return pool[Math.floor(Math.random() * pool.length)];
    }
    return available[Math.floor(Math.random() * available.length)];
  }

  /** 根据行为数据选择嘲讽文本 */
  private pickTaunt(telemetry: PlayerTelemetry): string {
    let pool: string[];

    if (telemetry.recentCrashes.length > 0) {
      pool = TAUNTS.afterCrash;
    } else if (telemetry.laneBias < -0.3) {
      pool = TAUNTS.leanLeft;
    } else if (telemetry.laneBias > 0.3) {
      pool = TAUNTS.leanRight;
    } else if (telemetry.style === 'safe') {
      pool = TAUNTS.safe;
    } else if (telemetry.style === 'aggressive') {
      pool = TAUNTS.aggressive;
    } else if (telemetry.style === 'balanced') {
      pool = TAUNTS.balanced;
    } else {
      pool = TAUNTS.general;
    }

    return pool[Math.floor(Math.random() * pool.length)];
  }

  /** Fisher-Yates 洗牌 */
  private shuffle(arr: CardDef[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}
