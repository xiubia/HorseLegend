// LLM接口 - Gemini集成

import { GameState } from '../../game/states/GameState';
import { GameAction, AIDecision, PlayerSnapshot } from '../../data/types/GameTypes';

interface GeminiConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

interface GeminiResponse {
  candidates: {
    content: {
      parts: {
        text: string;
      }[];
    };
  }[];
}

export class LLMBridge {
  private config: GeminiConfig;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor(config: Partial<GeminiConfig> = {}) {
    this.config = {
      apiKey: config.apiKey || '',
      model: config.model || 'gemini-2.0-flash',
      maxTokens: config.maxTokens || 256,
      temperature: config.temperature || 0.7
    };
  }

  /**
   * 设置API Key
   */
  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
  }

  /**
   * 设置模型
   */
  setModel(model: string): void {
    this.config.model = model;
  }

  /**
   * AI决策
   */
  async decide(gameState: GameState, actions: GameAction[], playerName: string): Promise<AIDecision> {
    if (!this.config.apiKey) {
      console.warn('LLM API key not set, using fallback decision');
      return this.fallbackDecision(actions);
    }

    try {
      const prompt = this.buildDecisionPrompt(gameState, actions, playerName);
      const response = await this.callGemini(prompt);
      return this.parseResponse(response, actions);
    } catch (error) {
      console.error('LLM decision failed:', error);
      return this.fallbackDecision(actions);
    }
  }

  /**
   * 构建决策Prompt
   */
  private buildDecisionPrompt(gameState: GameState, actions: GameAction[], playerName: string): string {
    const snapshot = gameState.snapshot();
    const player = snapshot.players.find(p => p.name === playerName);
    const opponents = snapshot.players.filter(p => p.name !== playerName);

    return `你是一位名叫"${playerName}"的骑术大师AI，正在参加一场激烈的赛马比赛。

## 当前状态
- 进度：${player?.progress.toFixed(1) || 0}米 / ${snapshot.track?.totalLength || 500}米
- 速度：${player?.speed.toFixed(1) || 0} m/s
- 体力：${player?.stamina.toFixed(0) || 0} / ${player?.maxStamina || 100}
- 剩余时间：${snapshot.remainingTime.toFixed(1)}秒

## 对手情况
${opponents.map(o => {
      const diff = (o.progress - (player?.progress || 0));
      const status = diff > 0 ? `领先${diff.toFixed(1)}米` : `落后${Math.abs(diff).toFixed(1)}米`;
      return `- ${o.name}: ${status}, 体力${o.stamina.toFixed(0)}%`;
    }).join('\n') || '无对手'}

## 可用行动
${actions.map((a, i) => `${i + 1}. ${a.name} - ${a.description || ''} (消耗${a.staminaCost}体力)`).join('\n')}

## 任务
分析当前局势，选择最优行动。考虑：
1. 你的体力管理
2. 与对手的距离
3. 剩余时间

请用JSON格式回答：
{"action": "行动id", "reason": "简短理由(10字以内)"}`;
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
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data: GeminiResponse = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No response from Gemini');
    }

    return data.candidates[0].content.parts[0].text;
  }

  /**
   * 解析LLM响应
   */
  private parseResponse(response: string, actions: GameAction[]): AIDecision {
    try {
      // 尝试提取JSON
      const jsonMatch = response.match(/\{[\s\S]*"action"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const actionId = parsed.action;

        // 查找匹配的action
        const action = actions.find(a =>
          a.id === actionId ||
          a.name === actionId ||
          a.id.includes(actionId) ||
          actionId.includes(a.id)
        );

        if (action) {
          return {
            action: action.id,
            reasoning: parsed.reason || parsed.reasoning || '策略决策',
            confidence: 0.8
          };
        }
      }

      // 尝试匹配行动名称
      for (const action of actions) {
        if (response.includes(action.name) || response.includes(action.id)) {
          return {
            action: action.id,
            reasoning: '从响应中提取',
            confidence: 0.6
          };
        }
      }
    } catch (e) {
      console.warn('Failed to parse LLM response:', e);
    }

    return this.fallbackDecision(actions);
  }

  /**
   * 备用决策（当LLM失败时）
   */
  private fallbackDecision(actions: GameAction[]): AIDecision {
    // 简单的启发式决策
    const cruise = actions.find(a => a.id === 'cruise');
    const sprint = actions.find(a => a.id === 'sprint');

    // 随机选择
    const choice = Math.random() > 0.5 ? sprint : cruise;

    return {
      action: choice?.id || actions[0].id,
      reasoning: '备用策略',
      confidence: 0.5
    };
  }

  /**
   * 生成对话（嘲讽/交流）
   */
  async generateDialogue(
    context: string,
    personality: string,
    intent: 'taunt' | 'encourage' | 'react'
  ): Promise<string> {
    if (!this.config.apiKey) {
      return this.getFallbackDialogue(intent);
    }

    try {
      const prompt = `你是一个${personality}风格的赛马骑手。
      
情境：${context}

请生成一句${intent === 'taunt' ? '嘲讽对手' : intent === 'encourage' ? '鼓励' : '反应'}的短语（不超过15个字）。
只输出对话内容，不要其他解释。`;

      const response = await this.callGemini(prompt);
      return response.trim().replace(/["""]/g, '');
    } catch (e) {
      return this.getFallbackDialogue(intent);
    }
  }

  /**
   * 备用对话
   */
  private getFallbackDialogue(intent: string): string {
    const dialogues = {
      taunt: ['追上我啊！', '太慢了！', '就这？', '再快点！'],
      encourage: ['加油！', '继续！', '不错！', '冲！'],
      react: ['哼！', '有意思', '来吧', '...']
    };

    const list = dialogues[intent as keyof typeof dialogues] || dialogues.react;
    return list[Math.floor(Math.random() * list.length)];
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

// 导出单例
export const llmBridge = new LLMBridge();
