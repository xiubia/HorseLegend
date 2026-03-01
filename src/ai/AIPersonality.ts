// AI性格定义 - 3个不同性格的AI对手

import { AIPersonality } from './prompts/race_prompt';

/**
 * AI对手配置列表
 */
export const AI_OPPONENTS: AIPersonality[] = [
  {
    name: '老谋深算·张三',
    avatar: '🧓',
    traits: { 
      aggression: 0.3, 
      suspicion: 0.9, 
      talkative: 0.4, 
      memory: 0.9 
    },
    backstory: '退役老骑手，见过太多套路，很难被骗。',
    speakingStyle: '简洁、老练、偶尔嘲讽'
  },
  {
    name: '热血新星·小明',
    avatar: '🧑',
    traits: { 
      aggression: 0.8, 
      suspicion: 0.3, 
      talkative: 0.9, 
      memory: 0.4 
    },
    backstory: '年轻气盛的新人，容易上头，喜欢正面对决。',
    speakingStyle: '热情、冲动、容易被激怒'
  },
  {
    name: '神秘骑士',
    avatar: '🎭',
    traits: { 
      aggression: 0.5, 
      suspicion: 0.5, 
      talkative: 0.1, 
      memory: 0.7 
    },
    backstory: '沉默寡言的神秘人，行为难以预测。',
    speakingStyle: '极少说话，偶尔一针见血'
  }
];

/**
 * 根据难度获取AI对手
 * @param difficulty 1-3难度
 */
export function getOpponentByDifficulty(difficulty: number): AIPersonality {
  // 难度1: 热血新星（容易被骗）
  // 难度2: 神秘骑士（中等）
  // 难度3: 老谋深算（难骗）
  const index = Math.min(Math.max(difficulty - 1, 0), AI_OPPONENTS.length - 1);
  
  // 调整顺序：难度1是最容易被骗的
  const orderedByDifficulty = [
    AI_OPPONENTS[1],  // 热血新星 - 最容易被骗
    AI_OPPONENTS[2],  // 神秘骑士 - 中等
    AI_OPPONENTS[0],  // 老谋深算 - 最难骗
  ];
  
  return orderedByDifficulty[index];
}

/**
 * 随机获取AI对手
 */
export function getRandomOpponent(): AIPersonality {
  const index = Math.floor(Math.random() * AI_OPPONENTS.length);
  return AI_OPPONENTS[index];
}

/**
 * 根据名字获取AI对手
 */
export function getOpponentByName(name: string): AIPersonality | undefined {
  return AI_OPPONENTS.find(o => o.name.includes(name));
}
