// 赛道生成器

import { Track, TrackSegment, SegmentType, SegmentModifier, AsciiMapChunk } from '../../data/types/GameTypes';

interface GenerationParams {
  difficulty: number;       // 0.5 - 1.5
  totalLength: number;      // 目标总长度
  playerWinRate?: number;   // 玩家历史胜率
  preferredTypes?: SegmentType[];
}

// 段落类型配置
const SEGMENT_CONFIG: Record<SegmentType, { 
  minLength: number; 
  maxLength: number;
  baseDifficulty: number;
  speedMultiplier: number;
}> = {
  straight: { minLength: 30, maxLength: 100, baseDifficulty: 1, speedMultiplier: 1.0 },
  curve_left: { minLength: 20, maxLength: 60, baseDifficulty: 1.5, speedMultiplier: 0.85 },
  curve_right: { minLength: 20, maxLength: 60, baseDifficulty: 1.5, speedMultiplier: 0.85 },
  uphill: { minLength: 30, maxLength: 80, baseDifficulty: 2, speedMultiplier: 0.7 },
  downhill: { minLength: 30, maxLength: 80, baseDifficulty: 1.5, speedMultiplier: 1.3 },
  obstacle: { minLength: 40, maxLength: 100, baseDifficulty: 2.5, speedMultiplier: 0.8 },
  water: { minLength: 20, maxLength: 50, baseDifficulty: 2, speedMultiplier: 0.5 },
  jump: { minLength: 10, maxLength: 20, baseDifficulty: 2, speedMultiplier: 1.0 }
};

// 段落类型权重（基于难度调整）
const BASE_TYPE_WEIGHTS: Record<SegmentType, number> = {
  straight: 0.35,
  curve_left: 0.15,
  curve_right: 0.15,
  uphill: 0.1,
  downhill: 0.1,
  obstacle: 0.1,
  water: 0.03,
  jump: 0.02
};

export class TrackGenerator {
  /**
   * 生成赛道
   */
  generate(params: GenerationParams): Track {
    const segments: TrackSegment[] = [];
    let remainingLength = params.totalLength;
    let previousType: SegmentType | null = null;
    
    // 开始段落总是直道
    const startSegment = this.createSegment('straight', params.difficulty, 50);
    segments.push(startSegment);
    remainingLength -= startSegment.length;
    previousType = 'straight';
    
    // 生成中间段落
    while (remainingLength > 30) {
      const segmentType = this.selectSegmentType(params.difficulty, previousType);
      const length = this.calculateSegmentLength(segmentType, remainingLength);
      
      const segment = this.createSegment(segmentType, params.difficulty, length);
      segments.push(segment);
      
      remainingLength -= length;
      previousType = segmentType;
    }
    
    // 结束段落是直道（冲刺区）
    if (remainingLength > 0) {
      const endSegment = this.createSegment('straight', params.difficulty, remainingLength);
      segments.push(endSegment);
    }
    
    // 计算总长度和难度
    const totalLength = segments.reduce((sum, s) => sum + s.length, 0);
    const difficultyScore = this.calculateTrackDifficulty(segments);
    const estimatedTime = this.estimateCompletionTime(segments);
    
    return {
      id: `track_${Date.now()}`,
      name: this.generateTrackName(difficultyScore),
      segments,
      totalLength,
      estimatedTime,
      difficultyScore
    };
  }
  
  /**
   * 生成单个赛道块（包含一个或多个段落，总长约50m）
   */
  generateChunkData(difficulty: number, previousType: SegmentType | null = null): TrackSegment[] {
    const segments: TrackSegment[] = [];
    let currentLength = 0;
    const TARGET_CHUNK_LENGTH = 50;
    
    // 如果没有前一个类型，默认为直道
    let prev = previousType || 'straight';

    while (currentLength < TARGET_CHUNK_LENGTH) {
      const segmentType = this.selectSegmentType(difficulty, prev);
      // 限制单个段落长度以便凑成 Chunk
      let length = this.calculateSegmentLength(segmentType, 100); 
      // 如果是最后一个补充段落，调整长度
      if (currentLength + length > TARGET_CHUNK_LENGTH + 20) {
         length = Math.max(20, TARGET_CHUNK_LENGTH - currentLength);
      }
      
      const segment = this.createSegment(segmentType, difficulty, length);
      segments.push(segment);
      currentLength += length;
      prev = segmentType;
      
      // 如果已经足够长了，就停止
      if (currentLength >= TARGET_CHUNK_LENGTH - 10) break;
    }
    
    return segments;
  }

  /**
   * 选择段落类型
   */
  private selectSegmentType(difficulty: number, previousType: SegmentType | null): SegmentType {
    // 根据难度调整权重
    const weights: Record<SegmentType, number> = { ...BASE_TYPE_WEIGHTS };
    
    // 高难度增加障碍和弯道
    if (difficulty > 1.0) {
      weights.obstacle *= 1 + (difficulty - 1);
      weights.curve_left *= 1 + (difficulty - 1) * 0.5;
      weights.curve_right *= 1 + (difficulty - 1) * 0.5;
      weights.straight *= 0.8;
    }
    
    // 避免连续相同类型（除了直道）
    if (previousType && previousType !== 'straight') {
      weights[previousType] *= 0.2;
    }
    
    // 避免连续弯道同方向
    if (previousType === 'curve_left') {
      weights.curve_left *= 0.3;
    } else if (previousType === 'curve_right') {
      weights.curve_right *= 0.3;
    }
    
    // 归一化并随机选择
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let random = Math.random() * total;
    
    for (const [type, weight] of Object.entries(weights)) {
      random -= weight;
      if (random <= 0) {
        return type as SegmentType;
      }
    }
    
    return 'straight';
  }
  
  /**
   * 计算段落长度
   */
  private calculateSegmentLength(type: SegmentType, remainingLength: number): number {
    const config = SEGMENT_CONFIG[type];
    const maxAllowed = Math.min(config.maxLength, remainingLength - 30);
    const length = config.minLength + Math.random() * (maxAllowed - config.minLength);
    return Math.max(config.minLength, Math.floor(length));
  }
  
  /**
   * 创建段落
   */
  private createSegment(type: SegmentType, difficulty: number, length: number): TrackSegment {
    const config = SEGMENT_CONFIG[type];
    
    // 计算实际难度（1-3）
    const baseDiff = config.baseDifficulty * difficulty;
    const segmentDifficulty = Math.min(3, Math.max(1, Math.round(baseDiff))) as 1 | 2 | 3;
    
    // 生成修饰符
    const modifiers = this.generateModifiers(type, difficulty);
    
    // 计算宽度（难度越高越窄）
    const width = Math.max(1, 3 - Math.floor(difficulty));
    
    // 计算海拔变化
    let elevation = 0;
    if (type === 'uphill') {
      elevation = 5 + Math.random() * 10;
    } else if (type === 'downhill') {
      elevation = -(5 + Math.random() * 10);
    }
    
    // 计算弯曲度
    let curvature = 0;
    if (type === 'curve_left' || type === 'curve_right') {
      curvature = 0.3 + Math.random() * 0.4;
    }
    
    return {
      type,
      length,
      width,
      difficulty: segmentDifficulty,
      elevation,
      curvature,
      modifiers
    };
  }
  
  /**
   * 生成修饰符
   */
  private generateModifiers(type: SegmentType, difficulty: number): SegmentModifier[] {
    const modifiers: SegmentModifier[] = [];
    
    // 高难度有概率添加修饰符
    if (difficulty > 1.0 && Math.random() < (difficulty - 1) * 0.5) {
      const modifierTypes: Array<'slippery' | 'narrow' | 'foggy' | 'windy'> = 
        ['slippery', 'narrow', 'foggy', 'windy'];
      const selectedType = modifierTypes[Math.floor(Math.random() * modifierTypes.length)];
      
      modifiers.push({
        type: selectedType,
        intensity: 0.3 + Math.random() * 0.5
      });
    }
    
    return modifiers;
  }
  
  /**
   * 计算赛道总难度
   */
  private calculateTrackDifficulty(segments: TrackSegment[]): number {
    let totalDifficulty = 0;
    let totalLength = 0;
    
    for (const segment of segments) {
      totalDifficulty += segment.difficulty * segment.length;
      totalLength += segment.length;
      
      // 修饰符增加难度
      for (const mod of segment.modifiers) {
        totalDifficulty += mod.intensity * segment.length * 0.5;
      }
    }
    
    return totalDifficulty / totalLength;
  }
  
  /**
   * 估算完成时间
   */
  private estimateCompletionTime(segments: TrackSegment[]): number {
    let totalTime = 0;
    const baseSpeed = 20; // 假设平均速度20m/s
    
    for (const segment of segments) {
      const config = SEGMENT_CONFIG[segment.type];
      const effectiveSpeed = baseSpeed * config.speedMultiplier;
      totalTime += segment.length / effectiveSpeed;
    }
    
    return totalTime;
  }
  
  /**
   * 生成赛道名称
   */
  private generateTrackName(difficulty: number): string {
    const prefixes = ['神秘', '古老', '荒野', '峡谷', '森林', '草原', '沙漠', '雪山'];
    const suffixes = ['之路', '赛道', '竞技场', '挑战', '征程'];
    
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    
    if (difficulty > 2) {
      return `地狱${prefix}${suffix}`;
    } else if (difficulty > 1.5) {
      return `困难${prefix}${suffix}`;
    } else {
      return `${prefix}${suffix}`;
    }
  }
  
  // ============ ASCII 地图生成（本地回退） ============

  /**
   * 程序化生成 8x20 ASCII 地图（本地回退，不依赖 AI）
   * @param difficulty 难度 (0.5 - 3.0)
   * @param chunkIndex chunk 序号，用于前几个 chunk 的引导场景
   */
  generateAsciiMap(difficulty: number, chunkIndex: number = 0): AsciiMapChunk {
    const COLS = 8;
    const ROWS = 20;

    // ---- 前 3 个 chunk：固定引导场景 ----
    if (chunkIndex <= 2) {
      return this.generateIntroMap(chunkIndex, COLS, ROWS);
    }

    // ---- chunkIndex 3+ 正常程序化生成 ----
    const rows: string[] = [];
    const basicObstacles = ['b', 'B', 'R', 'K'];
    const hardObstacles = ['L', 'A', 'P', 'F'];
    const decorations = ['M', 'V']; // T(树)太大，只在侧边装饰用

    // 每 chunk 最大障碍数（渐进增加，上限 8）
    // 后期速度快，障碍太多根本躲不过 → 上限从12降到8
    const maxObstacles = Math.min(3 + chunkIndex, 8);
    let obstacleCount = 0;

    // 行间距：速度越快（chunkIndex越大）需要越多空行给玩家反应
    // chunkIndex 3-10: gap=2, 11-20: gap=3, 21+: gap=4
    const minRowGap = Math.min(4, 2 + Math.floor(chunkIndex / 10));
    let rowsSinceLastObstacle = minRowGap; // 初始允许立即放

    for (let row = 0; row < ROWS; row++) {
      const chars: string[] = new Array(COLS).fill('.');

      // 行进度 0(底/近)→1(顶/远)
      const progress = row / ROWS;

      // 是否允许这行放障碍（已达上限 / 间距不够 → 跳过）
      const canPlaceObstacle = obstacleCount < maxObstacles && rowsSinceLastObstacle >= minRowGap;

      if (canPlaceObstacle) {
        // 低概率：每格约 3%-8%
        const obstacleProbBase = 0.02 + difficulty * 0.02 + progress * 0.04;
        // 每行最多 1-2 个障碍（后期每行只放1个，给玩家更多空间）
        const maxPerRow = chunkIndex > 15 ? 1 : 2;
        let rowObstacles = 0;

        for (let col = 1; col < COLS - 1; col++) { // 只在中间列(1-6)放障碍
          if (rowObstacles >= maxPerRow) break;
          if (obstacleCount >= maxObstacles) break;

          if (Math.random() < obstacleProbBase) {
            // 选障碍类型：高级障碍需 difficulty > 2.0
            if (difficulty > 2.0 && Math.random() < 0.3) {
              chars[col] = hardObstacles[Math.floor(Math.random() * hardObstacles.length)];
            } else {
              chars[col] = basicObstacles[Math.floor(Math.random() * basicObstacles.length)];
            }
            rowObstacles++;
            obstacleCount++;
          }
        }

        if (rowObstacles > 0) {
          rowsSinceLastObstacle = 0;
        } else {
          rowsSinceLastObstacle++;
        }
      } else {
        rowsSinceLastObstacle++;
      }

      // 确保可通行性
      this.ensurePassable(chars, COLS);

      // 边缘装饰（只在列 0 和 7，约 10% 概率）
      if (Math.random() < 0.10) {
        const edgeCol = Math.random() < 0.5 ? 0 : COLS - 1;
        if (chars[edgeCol] === '.') {
          chars[edgeCol] = decorations[Math.floor(Math.random() * decorations.length)];
        }
      }

      // 金币：约 15% 行
      if (Math.random() < 0.15) {
        const emptyCols: number[] = [];
        for (let c = 0; c < COLS; c++) {
          if (chars[c] === '.') emptyCols.push(c);
        }
        if (emptyCols.length > 0) {
          chars[emptyCols[Math.floor(Math.random() * emptyCols.length)]] = '*';
        }
      }

      // 星星：约 5% 行，只在中后段
      if (progress > 0.5 && Math.random() < 0.05) {
        const emptyCols: number[] = [];
        for (let c = 0; c < COLS; c++) {
          if (chars[c] === '.') emptyCols.push(c);
        }
        if (emptyCols.length > 0) {
          chars[emptyCols[Math.floor(Math.random() * emptyCols.length)]] = 'S';
        }
      }

      rows.push(chars.join(''));
    }

    // 最后 2 行始终空出（玩家进入区域）
    rows[ROWS - 2] = '........';
    rows[ROWS - 1] = '........';

    return {
      theme: this.pickLocalTheme(difficulty),
      strategy: `Local gen: ${obstacleCount} obstacles, chunk #${chunkIndex}`,
      rows,
    };
  }

  /**
   * 生成前 3 个引导 chunk（固定简单场景）
   */
  private generateIntroMap(chunkIndex: number, cols: number, rows: number): AsciiMapChunk {
    const map: string[] = new Array(rows).fill('.'.repeat(cols));

    if (chunkIndex === 0) {
      // chunk 0: 纯空赛道 + 金币引导路径
      map[5]  = '...*..*.';
      map[10] = '..*...*.'
      map[15] = '...*..*.';
    } else if (chunkIndex === 1) {
      // chunk 1: 1-2 个小障碍 + 金币
      map[4]  = '...*..*.';
      map[7]  = '...b....';
      map[10] = '..*...*.'
      map[14] = '....b...';
      map[17] = '...*..*.';
    } else if (chunkIndex === 2) {
      // chunk 2: 3-4 个基础障碍 + 金币
      map[3]  = '...*..*.';
      map[5]  = '..b.....';
      map[8]  = '....B...';
      map[10] = '..*...*.'
      map[13] = '.B......';
      map[15] = '.....b..';
      map[18] = '...*..*.';
    }

    return {
      theme: 'meadow',
      strategy: `Intro chunk #${chunkIndex}`,
      rows: map,
    };
  }

  /**
   * 确保一行中至少有 2 个连续空格（可通行）
   */
  private ensurePassable(chars: string[], cols: number): void {
    // 检查是否已经有 2 个连续空格
    let hasGap = false;
    for (let c = 0; c < cols - 1; c++) {
      if (chars[c] === '.' && chars[c + 1] === '.') {
        hasGap = true;
        break;
      }
    }
    if (hasGap) return;

    // 没有的话，随机清出一个 2 格间隙
    const startCol = Math.floor(Math.random() * (cols - 1));
    chars[startCol] = '.';
    chars[startCol + 1] = '.';
  }

  /**
   * 本地主题选择
   */
  private pickLocalTheme(difficulty: number): string {
    // 返回有效的 ThemeRegistry 主题 ID
    const themes = difficulty > 2 ? ['volcano', 'night', 'snow'] :
                   difficulty > 1.3 ? ['forest', 'desert', 'sunset', 'snow'] :
                   ['meadow', 'cherry', 'sunset', 'meadow'];
    return themes[Math.floor(Math.random() * themes.length)];
  }

  /**
   * 根据玩家表现调整难度生成
   */
  generateAdaptive(playerPerformance: { winRate: number; avgPosition: number }): Track {
    // 动态难度调整
    let difficulty = 1.0;
    
    if (playerPerformance.winRate > 0.6) {
      difficulty = 1.0 + (playerPerformance.winRate - 0.6) * 1.5;
    } else if (playerPerformance.winRate < 0.4) {
      difficulty = 1.0 - (0.4 - playerPerformance.winRate) * 0.8;
    }
    
    // 限制难度范围
    difficulty = Math.max(0.5, Math.min(1.5, difficulty));
    
    return this.generate({
      difficulty,
      totalLength: 500 + difficulty * 200
    });
  }
}
