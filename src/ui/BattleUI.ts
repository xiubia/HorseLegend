// BattleUI - 心理博弈回合UI
// 处理玩家行动选择、喊话输入、AI响应展示

import { RACE_ACTIONS, PRESET_SHOUTS, AIPersonality } from '../ai/prompts/race_prompt';
import { RoundResult } from '../ai/GeminiRacer';

/**
 * 玩家选择结果
 */
export interface PlayerChoice {
  action: 'sprint' | 'cruise' | 'rest';
  shout: string;
}

/**
 * 回合回调
 */
export interface BattleUICallbacks {
  onPlayerChoice: (choice: PlayerChoice) => void;
  onRoundComplete: () => void;
}

/**
 * BattleUI - 博弈回合UI
 */
export class BattleUI {
  private container: HTMLElement;
  private callbacks: BattleUICallbacks;
  
  // UI元素
  private overlay: HTMLElement | null = null;
  private decisionPanel: HTMLElement | null = null;
  private resultPanel: HTMLElement | null = null;
  private aiInfoPanel: HTMLElement | null = null;
  
  // 状态
  private isVisible: boolean = false;
  private selectedAction: string | null = null;
  private selectedShout: string = '';
  private decisionTimer: number = 0;
  private timerInterval: number | null = null;
  
  // 当前AI信息
  private currentAI: AIPersonality | null = null;
  private aiLastResponse: string = '';
  
  constructor(container: HTMLElement, callbacks: BattleUICallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.createUI();
  }
  
  /**
   * 创建UI结构
   */
  private createUI(): void {
    // 创建半透明遮罩
    this.overlay = document.createElement('div');
    this.overlay.id = 'battle-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 2000;
      display: none;
      justify-content: center;
      align-items: center;
    `;
    this.container.appendChild(this.overlay);
    
    // 创建决策面板
    this.decisionPanel = document.createElement('div');
    this.decisionPanel.id = 'battle-decision';
    this.decisionPanel.style.cssText = `
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border: 3px solid #00BFFF;
      border-radius: 20px;
      padding: 20px;
      min-width: 400px;
      max-width: 500px;
      color: white;
      font-family: 'Arial Rounded MT Bold', sans-serif;
      box-shadow: 0 0 30px rgba(0, 191, 255, 0.3);
    `;
    this.overlay.appendChild(this.decisionPanel);
    
    // 创建结果面板（初始隐藏）
    this.resultPanel = document.createElement('div');
    this.resultPanel.id = 'battle-result';
    this.resultPanel.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border: 3px solid #FFD700;
      border-radius: 20px;
      padding: 25px;
      min-width: 350px;
      color: white;
      font-family: 'Arial Rounded MT Bold', sans-serif;
      z-index: 2001;
      display: none;
      box-shadow: 0 0 30px rgba(255, 215, 0, 0.3);
    `;
    this.container.appendChild(this.resultPanel);
    
    // 创建AI信息面板（比赛期间持续显示）
    this.aiInfoPanel = document.createElement('div');
    this.aiInfoPanel.id = 'ai-info-panel';
    this.aiInfoPanel.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      border: 2px solid #00BFFF;
      border-radius: 15px;
      padding: 15px;
      min-width: 200px;
      color: white;
      font-family: 'Arial Rounded MT Bold', sans-serif;
      z-index: 1500;
      display: none;
    `;
    this.container.appendChild(this.aiInfoPanel);
  }
  
  /**
   * 设置当前AI对手
   */
  setAIOpponent(ai: AIPersonality): void {
    this.currentAI = ai;
    this.updateAIInfoPanel();
  }
  
  /**
   * 更新AI信息面板
   */
  private updateAIInfoPanel(): void {
    if (!this.aiInfoPanel || !this.currentAI) return;
    
    const staminaLevel = this.getStaminaLevel();
    
    this.aiInfoPanel.innerHTML = `
      <div style="font-size: 14px; color: #888; margin-bottom: 5px;">对手</div>
      <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">
        ${this.currentAI.avatar} ${this.currentAI.name}
      </div>
      <div style="font-size: 12px; color: #aaa; margin-bottom: 8px;">
        ${this.currentAI.backstory}
      </div>
      <div style="font-size: 14px; margin-bottom: 5px;">
        体力: <span style="color: ${staminaLevel.color}">${staminaLevel.text}</span>
      </div>
      ${this.aiLastResponse ? `
        <div style="
          margin-top: 10px;
          padding: 10px;
          background: rgba(0, 191, 255, 0.1);
          border-radius: 10px;
          font-style: italic;
        ">
          💬 "${this.aiLastResponse}"
        </div>
      ` : ''}
    `;
  }
  
  /**
   * 获取体力描述（模糊化）
   */
  private getStaminaLevel(): { text: string; color: string } {
    // 随机显示，模拟不完全信息
    const levels = [
      { text: '充沛', color: '#00FF00' },
      { text: '适中', color: '#FFFF00' },
      { text: '疲惫', color: '#FF6600' }
    ];
    // 随机偏向适中
    const rand = Math.random();
    if (rand < 0.3) return levels[0];
    if (rand < 0.7) return levels[1];
    return levels[2];
  }
  
  /**
   * 显示决策面板
   */
  showDecisionPanel(timeLimit: number = 5): void {
    if (!this.overlay || !this.decisionPanel) return;
    
    this.isVisible = true;
    this.selectedAction = null;
    this.selectedShout = '';
    this.decisionTimer = timeLimit;
    
    this.renderDecisionPanel();
    this.overlay.style.display = 'flex';
    
    // 启动倒计时
    this.startTimer();
  }
  
  /**
   * 渲染决策面板内容
   */
  private renderDecisionPanel(): void {
    if (!this.decisionPanel) return;
    
    const actions = Object.values(RACE_ACTIONS);
    
    this.decisionPanel.innerHTML = `
      <div style="text-align: center; margin-bottom: 15px;">
        <div style="font-size: 14px; color: #888;">决策时间</div>
        <div id="decision-timer" style="font-size: 36px; font-weight: bold; color: #FFD700;">
          ${this.decisionTimer}
        </div>
      </div>
      
      <div style="margin-bottom: 20px;">
        <div style="font-size: 14px; color: #888; margin-bottom: 10px;">选择你的行动:</div>
        <div id="action-buttons" style="display: flex; gap: 10px; justify-content: center;">
          ${actions.map(action => `
            <button 
              data-action="${action.id}"
              style="
                padding: 15px 20px;
                background: ${this.selectedAction === action.id ? '#00BFFF' : '#333'};
                border: 2px solid ${this.selectedAction === action.id ? '#00BFFF' : '#555'};
                border-radius: 10px;
                color: white;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.2s;
                min-width: 100px;
              "
            >
              <div style="font-size: 24px;">${action.icon}</div>
              <div>${action.name}</div>
              <div style="font-size: 10px; color: #aaa;">${action.stamina > 0 ? '+' : ''}${action.stamina} 体力</div>
            </button>
          `).join('')}
        </div>
      </div>
      
      <div style="margin-bottom: 20px;">
        <div style="font-size: 14px; color: #888; margin-bottom: 10px;">喊话给对手（可选）:</div>
        <div id="shout-buttons" style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;">
          ${PRESET_SHOUTS.map(shout => `
            <button 
              data-shout="${shout.text}"
              style="
                padding: 8px 15px;
                background: ${this.selectedShout === shout.text ? '#FF6600' : '#444'};
                border: 2px solid ${this.selectedShout === shout.text ? '#FF6600' : '#666'};
                border-radius: 20px;
                color: white;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s;
              "
            >
              ${shout.text}
            </button>
          `).join('')}
        </div>
        <div style="margin-top: 10px; text-align: center;">
          <input 
            type="text" 
            id="custom-shout"
            placeholder="或输入自定义喊话..."
            maxlength="20"
            style="
              padding: 10px 15px;
              background: #222;
              border: 2px solid #555;
              border-radius: 10px;
              color: white;
              font-size: 14px;
              width: 250px;
              text-align: center;
            "
          />
        </div>
      </div>
      
      <div style="text-align: center;">
        <button 
          id="confirm-btn"
          style="
            padding: 15px 50px;
            background: linear-gradient(135deg, #00FF00 0%, #00CC00 100%);
            border: none;
            border-radius: 25px;
            color: #000;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
            opacity: ${this.selectedAction ? 1 : 0.5};
          "
          ${!this.selectedAction ? 'disabled' : ''}
        >
          确认决策
        </button>
      </div>
    `;
    
    this.bindDecisionEvents();
  }
  
  /**
   * 绑定决策事件
   */
  private bindDecisionEvents(): void {
    // 行动按钮
    const actionButtons = document.querySelectorAll('#action-buttons button');
    actionButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = (e.currentTarget as HTMLElement).dataset.action;
        if (action) {
          this.selectedAction = action;
          this.renderDecisionPanel();
        }
      });
    });
    
    // 喊话按钮
    const shoutButtons = document.querySelectorAll('#shout-buttons button');
    shoutButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const shout = (e.currentTarget as HTMLElement).dataset.shout;
        if (shout) {
          this.selectedShout = shout;
          const customInput = document.getElementById('custom-shout') as HTMLInputElement;
          if (customInput) customInput.value = '';
          this.renderDecisionPanel();
        }
      });
    });
    
    // 自定义喊话输入
    const customInput = document.getElementById('custom-shout') as HTMLInputElement;
    if (customInput) {
      customInput.addEventListener('input', () => {
        this.selectedShout = customInput.value;
      });
    }
    
    // 确认按钮
    const confirmBtn = document.getElementById('confirm-btn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        this.confirmChoice();
      });
    }
  }
  
  /**
   * 启动倒计时
   */
  private startTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    
    this.timerInterval = window.setInterval(() => {
      this.decisionTimer--;
      
      const timerElement = document.getElementById('decision-timer');
      if (timerElement) {
        timerElement.textContent = String(this.decisionTimer);
        if (this.decisionTimer <= 2) {
          timerElement.style.color = '#FF0000';
        }
      }
      
      if (this.decisionTimer <= 0) {
        // 时间到，自动选择
        if (!this.selectedAction) {
          this.selectedAction = 'cruise'; // 默认巡航
        }
        this.confirmChoice();
      }
    }, 1000);
  }
  
  /**
   * 确认选择
   */
  private confirmChoice(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    
    if (!this.selectedAction) {
      this.selectedAction = 'cruise';
    }
    
    this.hideDecisionPanel();
    
    this.callbacks.onPlayerChoice({
      action: this.selectedAction as 'sprint' | 'cruise' | 'rest',
      shout: this.selectedShout || '...'
    });
  }
  
  /**
   * 隐藏决策面板
   */
  hideDecisionPanel(): void {
    if (this.overlay) {
      this.overlay.style.display = 'none';
    }
    this.isVisible = false;
  }
  
  /**
   * 显示回合结果
   */
  showRoundResult(result: RoundResult, duration: number = 3000): void {
    if (!this.resultPanel) return;
    
    // 更新AI最后回应
    this.aiLastResponse = result.aiResponse;
    this.updateAIInfoPanel();
    
    const bluffText = result.playerWasBluffing ? '（虚张声势）' : '（真话）';
    const predictionText = result.aiPredictedCorrectly ? 
      '🎯 AI识破了你的意图！' : 
      '😏 你成功骗过了AI！';
    const predictionColor = result.aiPredictedCorrectly ? '#FF6600' : '#00FF00';
    
    const bonusText = result.speedBonus.player > 0 ? 
      `你获得 +${(result.speedBonus.player * 100).toFixed(0)}% 速度加成！` :
      (result.speedBonus.ai > 0 ? `AI获得 +${(result.speedBonus.ai * 100).toFixed(0)}% 速度加成！` : '');
    
    this.resultPanel.innerHTML = `
      <div style="text-align: center; margin-bottom: 15px;">
        <div style="font-size: 20px; font-weight: bold; color: #FFD700;">📊 回合结算</div>
      </div>
      
      <div style="
        background: rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        padding: 15px;
        margin-bottom: 15px;
      ">
        <div style="margin-bottom: 10px;">
          <span style="color: #888;">你:</span>
          喊了"${result.playerShout}" → 实际<span style="color: #00BFFF; font-weight: bold;">${this.getActionName(result.playerAction)}</span>
          <span style="color: ${result.playerWasBluffing ? '#FF6600' : '#00FF00'}; font-size: 12px;">${bluffText}</span>
        </div>
        
        <div style="margin-bottom: 10px;">
          <span style="color: #888;">AI:</span>
          "${result.aiAnalysis}"
          <br/>
          → 选择<span style="color: #FF6600; font-weight: bold;">${this.getActionName(result.aiAction)}</span>
        </div>
        
        <div style="
          font-style: italic;
          color: #aaa;
          background: rgba(0, 0, 0, 0.3);
          padding: 8px;
          border-radius: 5px;
          margin-top: 10px;
        ">
          💭 AI心声: "${result.aiInnerThought}"
        </div>
      </div>
      
      <div style="text-align: center;">
        <div style="font-size: 18px; font-weight: bold; color: ${predictionColor};">
          ${predictionText}
        </div>
        ${bonusText ? `<div style="color: #FFD700; margin-top: 5px;">${bonusText}</div>` : ''}
      </div>
    `;
    
    this.resultPanel.style.display = 'block';
    
    // 自动隐藏
    setTimeout(() => {
      this.hideRoundResult();
    }, duration);
  }
  
  /**
   * 隐藏回合结果
   */
  hideRoundResult(): void {
    if (this.resultPanel) {
      this.resultPanel.style.display = 'none';
    }
    this.callbacks.onRoundComplete();
  }
  
  /**
   * 获取行动名称
   */
  private getActionName(actionId: string): string {
    const action = RACE_ACTIONS[actionId as keyof typeof RACE_ACTIONS];
    return action ? `${action.icon} ${action.name}` : actionId;
  }
  
  /**
   * 显示AI信息面板
   */
  showAIInfo(): void {
    if (this.aiInfoPanel) {
      this.aiInfoPanel.style.display = 'block';
    }
  }
  
  /**
   * 隐藏AI信息面板
   */
  hideAIInfo(): void {
    if (this.aiInfoPanel) {
      this.aiInfoPanel.style.display = 'none';
    }
  }
  
  /**
   * 显示加载中状态
   */
  showLoading(message: string = 'AI思考中...'): void {
    if (!this.overlay || !this.decisionPanel) return;
    
    this.decisionPanel.innerHTML = `
      <div style="text-align: center; padding: 40px;">
        <div style="font-size: 48px; margin-bottom: 20px;">🤔</div>
        <div style="font-size: 18px; color: #00BFFF;">${message}</div>
        <div style="margin-top: 20px;">
          <div style="
            display: inline-block;
            width: 40px;
            height: 40px;
            border: 4px solid #333;
            border-top-color: #00BFFF;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          "></div>
        </div>
      </div>
      <style>
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    `;
    
    this.overlay.style.display = 'flex';
  }
  
  /**
   * 隐藏加载状态
   */
  hideLoading(): void {
    this.hideDecisionPanel();
  }
  
  /**
   * 清理
   */
  dispose(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.overlay?.remove();
    this.resultPanel?.remove();
    this.aiInfoPanel?.remove();
  }
}
