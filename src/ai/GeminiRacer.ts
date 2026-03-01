// GeminiRacer - 心理博弈赛马AI
// 使用Gemini 2.5 Flash进行自然语言博弈

import {
  AIPersonality,
  RaceContext,
  PlayerHistory,
  RoundInput,
  AIRaceResponse,
  buildRacePrompt,
  RACE_ACTIONS
} from './prompts/race_prompt';

/**
 * Gemini配置
 */
interface GeminiConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

/**
 * Gemini API响应格式
 */
interface GeminiAPIResponse {
  candidates?: {
    content: {
      parts: {
        text: string;
      }[];
    };
  }[];
  error?: {
    message: string;
  };
}

/**
 * 博弈回合结果
 */
export interface RoundResult {
  playerAction: string;
  playerShout: string;
  aiAction: string;
  aiResponse: string;
  aiAnalysis: string;
  aiInnerThought: string;
  playerWasBluffing: boolean;  // 玩家是否在虚张声势
  aiPredictedCorrectly: boolean;  // AI是否预测正确
  speedBonus: { player: number; ai: number };  // 速度加成
}

/**
 * GeminiRacer - 心理博弈AI
 */
export class GeminiRacer {
  private config: GeminiConfig;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  private personality: AIPersonality;
  private playerHistory: PlayerHistory;
  
  constructor(personality: AIPersonality, apiKey: string) {
    this.personality = personality;
    this.config = {
      apiKey: apiKey,
      model: 'gemini-2.5-flash',
      maxTokens: 500,
      temperature: 0.8  // 较高温度让回复更有个性
    };
    
    // 初始化玩家历史
    this.playerHistory = {
      rounds: [],
      bluffRate: 0,
      preferredAction: 'cruise'
    };
  }
  
  /**
   * 获取当前AI性格
   */
  getPersonality(): AIPersonality {
    return this.personality;
  }
  
  /**
   * 设置AI性格
   */
  setPersonality(personality: AIPersonality): void {
    this.personality = personality;
  }
  
  /**
   * 重置玩家历史（新比赛）
   */
  resetHistory(): void {
    this.playerHistory = {
      rounds: [],
      bluffRate: 0,
      preferredAction: 'cruise'
    };
  }
  
  /**
   * 核心方法：进行一回合博弈
   */
  async playRound(
    context: RaceContext,
    playerAction: string,
    playerShout: string
  ): Promise<RoundResult> {
    const input: RoundInput = { playerAction, playerShout };
    
    // 调用Gemini获取AI响应
    const aiResponse = await this.getAIResponse(context, input);
    
    // 判断玩家是否在虚张声势
    const playerWasBluffing = this.detectBluff(playerShout, playerAction);
    
    // 判断AI是否预测正确
    const aiPredictedCorrectly = this.checkPrediction(aiResponse, playerAction, playerWasBluffing);
    
    // 计算速度加成
    const speedBonus = this.calculateSpeedBonus(aiPredictedCorrectly);
    
    // 更新玩家历史
    this.updateHistory(playerShout, playerAction, playerWasBluffing);
    
    return {
      playerAction,
      playerShout,
      aiAction: aiResponse.action,
      aiResponse: aiResponse.response,
      aiAnalysis: aiResponse.analysis,
      aiInnerThought: aiResponse.innerThought,
      playerWasBluffing,
      aiPredictedCorrectly,
      speedBonus
    };
  }
  
  /**
   * 调用Gemini API获取AI响应
   */
  private async getAIResponse(context: RaceContext, input: RoundInput): Promise<AIRaceResponse> {
    if (!this.config.apiKey) {
      console.warn('Gemini API key not set, using fallback');
      return this.fallbackResponse(input);
    }
    
    try {
      const prompt = buildRacePrompt(this.personality, context, this.playerHistory, input);
      const responseText = await this.callGemini(prompt);
      return this.parseResponse(responseText);
    } catch (error) {
      console.error('Gemini API call failed:', error);
      return this.fallbackResponse(input);
    }
  }
  
  /**
   * 调用Gemini API
   */
  private async callGemini(prompt: string): Promise<string> {
    const url = `${this.baseUrl}/${this.config.model}:generateContent?key=${this.config.apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          maxOutputTokens: this.config.maxTokens,
          temperature: this.config.temperature
        }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }
    
    const data: GeminiAPIResponse = await response.json();
    
    if (data.error) {
      throw new Error(`Gemini error: ${data.error.message}`);
    }
    
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No response from Gemini');
    }
    
    return data.candidates[0].content.parts[0].text;
  }
  
  /**
   * 解析Gemini响应
   */
  private parseResponse(responseText: string): AIRaceResponse {
    try {
      // 尝试提取JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // 验证action是否有效
        const validActions = ['sprint', 'cruise', 'rest'];
        const action = validActions.includes(parsed.action) ? parsed.action : 'cruise';
        
        return {
          analysis: parsed.analysis || '正在分析...',
          action: action as 'sprint' | 'cruise' | 'rest',
          response: parsed.response || '...',
          innerThought: parsed.innerThought || parsed.analysis || '',
          confidence: 0.8
        };
      }
    } catch (e) {
      console.warn('Failed to parse Gemini response:', e);
    }
    
    // 解析失败，返回默认响应
    return this.fallbackResponse({ playerAction: 'cruise', playerShout: '' });
  }
  
  /**
   * 备用响应（当API失败时）
   */
  private fallbackResponse(input: RoundInput): AIRaceResponse {
    const { traits } = this.personality;
    
    // 根据性格决定行动
    let action: 'sprint' | 'cruise' | 'rest' = 'cruise';
    if (traits.aggression > 0.6 && Math.random() > 0.4) {
      action = 'sprint';
    } else if (traits.aggression < 0.3 && Math.random() > 0.6) {
      action = 'rest';
    }
    
    // 根据性格生成回应
    const responses = {
      high_talk: ['有意思...', '就这？', '来吧！', '看招！'],
      low_talk: ['...', '嗯。', '哼。'],
      normal: ['不错', '继续', '来吧']
    };
    
    const responseList = traits.talkative > 0.6 ? responses.high_talk :
                         traits.talkative < 0.3 ? responses.low_talk :
                         responses.normal;
    
    return {
      analysis: '观察中...',
      action,
      response: responseList[Math.floor(Math.random() * responseList.length)],
      innerThought: '让我看看你要做什么...',
      confidence: 0.5
    };
  }
  
  /**
   * 检测玩家是否在虚张声势
   */
  private detectBluff(shout: string, action: string): boolean {
    // 喊话内容与实际行动不符视为虚张声势
    const shoutLower = shout.toLowerCase();
    
    // "冲刺"相关喊话但没有冲刺
    if ((shoutLower.includes('冲') || shoutLower.includes('sprint') || shoutLower.includes('加速')) 
        && action !== 'sprint') {
      return true;
    }
    
    // "没力气/累了"但实际冲刺
    if ((shoutLower.includes('没力') || shoutLower.includes('累') || shoutLower.includes('体力'))
        && action === 'sprint') {
      return true;
    }
    
    // "休息/蓄力"相关但没有休息
    if ((shoutLower.includes('休息') || shoutLower.includes('蓄力'))
        && action !== 'rest') {
      return true;
    }
    
    return false;
  }
  
  /**
   * 检查AI预测是否正确
   */
  private checkPrediction(
    aiResponse: AIRaceResponse, 
    playerAction: string, 
    playerWasBluffing: boolean
  ): boolean {
    // 如果AI在分析中提到"欺骗"、"虚张声势"、"骗"等，且玩家确实在骗
    const analysisLower = aiResponse.analysis.toLowerCase();
    const innerThoughtLower = aiResponse.innerThought.toLowerCase();
    
    const aiDetectedBluff = 
      analysisLower.includes('骗') || 
      analysisLower.includes('虚张') ||
      analysisLower.includes('不信') ||
      analysisLower.includes('怀疑') ||
      innerThoughtLower.includes('骗') ||
      innerThoughtLower.includes('虚张');
    
    // AI预测正确的情况：
    // 1. 玩家骗人，AI识破了
    // 2. 玩家说真话，AI相信了
    if (playerWasBluffing && aiDetectedBluff) {
      return true;
    }
    if (!playerWasBluffing && !aiDetectedBluff) {
      return true;
    }
    
    return false;
  }
  
  /**
   * 计算速度加成
   */
  private calculateSpeedBonus(aiPredictedCorrectly: boolean): { player: number; ai: number } {
    // 被骗方减速10%，读心成功方加速10%
    if (aiPredictedCorrectly) {
      return { player: 0, ai: 0.1 };  // AI预测正确，AI获得10%加速
    } else {
      return { player: 0.1, ai: 0 };  // 玩家骗过AI，玩家获得10%加速
    }
  }
  
  /**
   * 更新玩家历史
   */
  private updateHistory(shout: string, action: string, wasBluff: boolean): void {
    this.playerHistory.rounds.push({
      shout,
      action,
      wasBluff
    });
    
    // 更新欺骗率
    const bluffCount = this.playerHistory.rounds.filter(r => r.wasBluff).length;
    this.playerHistory.bluffRate = bluffCount / this.playerHistory.rounds.length;
    
    // 更新最常用行动
    const actionCounts: Record<string, number> = {};
    for (const round of this.playerHistory.rounds) {
      actionCounts[round.action] = (actionCounts[round.action] || 0) + 1;
    }
    let maxCount = 0;
    for (const [act, count] of Object.entries(actionCounts)) {
      if (count > maxCount) {
        maxCount = count;
        this.playerHistory.preferredAction = act;
      }
    }
  }
  
  /**
   * 获取玩家历史数据
   */
  getPlayerHistory(): PlayerHistory {
    return { ...this.playerHistory };
  }
  
  /**
   * 检查API是否可用
   */
  async checkAvailability(): Promise<boolean> {
    if (!this.config.apiKey) return false;
    
    try {
      await this.callGemini('回复"ok"');
      return true;
    } catch {
      return false;
    }
  }
}

// 导出行动定义
export { RACE_ACTIONS };
