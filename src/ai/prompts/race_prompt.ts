// 心理博弈赛马 - Prompt模板

/**
 * AI性格接口
 */
export interface AIPersonality {
  name: string;
  avatar: string;
  traits: {
    aggression: number;    // 0-1: 激进程度
    suspicion: number;     // 0-1: 多疑程度
    talkative: number;     // 0-1: 话多程度
    memory: number;        // 0-1: 记忆力
  };
  backstory: string;
  speakingStyle: string;
}

/**
 * 比赛状态接口
 */
export interface RaceContext {
  progress: number;        // 比赛进度百分比
  aiPosition: number;      // AI位置（米）
  aiStamina: number;       // AI体力百分比
  playerPosition: number;  // 玩家位置（米）
  playerStamina: number;   // 玩家体力百分比（模糊）
  gap: number;             // 距离差（正=AI领先）
  remainingTime: number;   // 剩余时间
}

/**
 * 玩家历史行为
 */
export interface PlayerHistory {
  rounds: {
    shout: string;
    action: string;
    wasBluff: boolean;     // 是否是虚张声势
  }[];
  bluffRate: number;       // 历史欺骗率
  preferredAction: string; // 最常用行动
}

/**
 * 当前回合输入
 */
export interface RoundInput {
  playerAction: string;    // 玩家选择的行动
  playerShout: string;     // 玩家喊话
}

/**
 * AI响应接口
 */
export interface AIRaceResponse {
  analysis: string;        // 对玩家意图的分析
  action: 'sprint' | 'cruise' | 'rest';  // AI选择的行动
  response: string;        // AI的喊话回应
  innerThought: string;    // AI的内心想法
  confidence: number;      // 对判断的置信度
}

/**
 * 构建性格描述
 */
export function buildPersonalityDescription(personality: AIPersonality): string {
  const { traits, backstory } = personality;
  
  let description = backstory + '\n';
  
  if (traits.aggression > 0.7) {
    description += '你性格激进，喜欢主动进攻，不轻易退让。';
  } else if (traits.aggression < 0.3) {
    description += '你性格沉稳，善于观察，等待最佳时机。';
  } else {
    description += '你攻守平衡，见机行事。';
  }
  
  if (traits.suspicion > 0.7) {
    description += '你非常多疑，总觉得对手在骗你。';
  } else if (traits.suspicion < 0.3) {
    description += '你比较单纯，容易相信对手说的话。';
  }
  
  if (traits.memory > 0.7) {
    description += '你记忆力很好，能记住对手之前的套路。';
  }
  
  return description;
}

/**
 * 构建历史行为描述
 */
export function buildHistoryDescription(history: PlayerHistory): string {
  if (history.rounds.length === 0) {
    return '这是第一回合，还没有对手的历史数据。';
  }
  
  let description = `对手已进行${history.rounds.length}回合。\n`;
  description += `欺骗率：${(history.bluffRate * 100).toFixed(0)}%\n`;
  description += `最常用行动：${history.preferredAction}\n`;
  
  // 最近3回合
  const recentRounds = history.rounds.slice(-3);
  if (recentRounds.length > 0) {
    description += '最近行为：\n';
    recentRounds.forEach((round, i) => {
      const bluffMark = round.wasBluff ? '（虚张声势）' : '（真话）';
      description += `- 第${history.rounds.length - recentRounds.length + i + 1}回合：喊"${round.shout}" → 实际${round.action} ${bluffMark}\n`;
    });
  }
  
  return description;
}

/**
 * 主Prompt模板
 */
export function buildRacePrompt(
  personality: AIPersonality,
  context: RaceContext,
  history: PlayerHistory,
  input: RoundInput
): string {
  const personalityDesc = buildPersonalityDescription(personality);
  const historyDesc = buildHistoryDescription(history);
  
  return `你是赛马游戏中的AI骑手"${personality.name}"。

【你的性格】
${personalityDesc}
说话风格：${personality.speakingStyle}

【当前比赛状态】
- 比赛进度：${context.progress.toFixed(0)}%
- 你的位置：${context.aiPosition.toFixed(0)}米，体力：${context.aiStamina.toFixed(0)}%
- 对手位置：${context.playerPosition.toFixed(0)}米
- 距离差：${context.gap > 0 ? `你领先${context.gap.toFixed(0)}米` : `你落后${Math.abs(context.gap).toFixed(0)}米`}
- 剩余时间：${context.remainingTime.toFixed(0)}秒

【玩家历史行为模式】
${historyDesc}

【本回合】
玩家选择了：${input.playerAction}
玩家喊话："${input.playerShout}"

【你的任务】
1. 分析玩家喊话的真实意图（是真话还是欺骗？结合历史行为判断）
2. 选择你的行动：sprint(冲刺)/cruise(巡航)/rest(蓄力)
3. 给出你的回应喊话（符合你的性格，15字以内）

【输出要求】
只输出JSON格式，不要其他内容：
{
  "analysis": "你对玩家意图的分析（1-2句话）",
  "action": "sprint或cruise或rest",
  "response": "你的喊话回应（要有个性，15字以内）",
  "innerThought": "你的内心想法（用于展示给玩家看你的思考过程）"
}`;
}

/**
 * 预设喊话
 */
export const PRESET_SHOUTS = [
  { id: 'bluff_sprint', text: '我要冲刺了！', category: 'action' },
  { id: 'taunt', text: '你追不上我的', category: 'taunt' },
  { id: 'fake_tired', text: '体力快没了...', category: 'status' },
  { id: 'threaten', text: '别挡我的路', category: 'threat' },
  { id: 'confident', text: '这局稳了', category: 'taunt' },
  { id: 'desperate', text: '拼了！', category: 'action' },
];

/**
 * 行动定义
 */
export const RACE_ACTIONS = {
  sprint: { 
    id: 'sprint',
    name: '冲刺', 
    icon: '🏃',
    stamina: -25, 
    speed: 1.5, 
    duration: 10,
    description: '全力加速，消耗大量体力'
  },
  cruise: { 
    id: 'cruise',
    name: '巡航', 
    icon: '🚶',
    stamina: -5, 
    speed: 1.0, 
    duration: 10,
    description: '稳定速度，保存体力'
  },
  rest: { 
    id: 'rest',
    name: '蓄力', 
    icon: '😮‍💨',
    stamina: +20, 
    speed: 0.6, 
    duration: 10,
    description: '减速恢复，补充体力'
  },
};
