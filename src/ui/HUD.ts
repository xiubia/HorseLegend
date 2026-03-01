// 游戏HUD - 新版赛马模拟器UI (Cartoon Style)

import { formatDistance, formatTrophies, MILESTONES } from '../systems/RewardSystem';

/**
 * 马棚状态数据
 */
export interface StableStatus {
  speedLevel: number;
  totalTrophies: number;
  currentSpeed: number;
  bestDistance: number;
  isTraining: boolean;
  trainingLevel: number;
  rebirthCount?: number;       // 重生次数（可选，向后兼容）
  trainingMultiplier?: number; // 训练倍率（可选，向后兼容）
}

/**
 * 比赛状态数据
 */
export interface RaceStatus {
  remainingTime: number;
  distance: number;
  currentSpeed: number;
  speedLevel: number;
  trophiesEarned: number;
  nextMilestone: number;
  nextMilestoneProgress: number;
}

// 进度条配置 - 缩小版
const BAR_CONFIG = [
  // Top Bar
  {
    milestones: [15000, 30000],
    colors: ['#00FFFF', '#FF0000'], // Cyan, Red
    reward: 50,
    height: 22,
    labels: ['1.50万', '3万']
  },
  // Middle Bar
  {
    milestones: [1000, 2000, 4000, 8000],
    colors: ['#008000', '#FF00FF', '#800080', '#FFA500'], // Green, Magenta, Purple, Orange
    reward: 20,
    height: 18,
    labels: ['1000', '2000', '4000', '8000']
  },
  // Bottom Bar
  {
    milestones: [20, 30, 40, 50, 60, 70, 80, 100, 500],
    colors: ['#808080', '#FF0000', '#800080', '#008000', '#00FFFF', '#FF00FF', '#FFA500', '#FFFF00', '#0000FF'],
    // Gray, Red, Purple, Green, Cyan, Magenta, Orange, Yellow, Blue
    reward: 10,
    height: 16,
    labels: ['20', '30', '40', '50', '60', '70', '80', '100', '500']
  }
];

export class HUD {
  private container: HTMLElement;

  // UI元素
  private statusPanel: HTMLElement | null = null;
  private timerPanel: HTMLElement | null = null;
  private milestoneBar: HTMLElement | null = null;
  private messagePanel: HTMLElement | null = null;
  private trophyPanel: HTMLElement | null = null;

  // 仪表盘
  private speedometerPanel: HTMLElement | null = null;
  private speedometerCanvas: HTMLCanvasElement | null = null;
  private speedometerValue: HTMLElement | null = null;

  // 右侧距离显示
  private floatingIndicatorPanel: HTMLElement | null = null;
  private floatingValue: HTMLElement | null = null;

  // 进度条片段引用，用于更新
  // barSegments[barIndex][segmentIndex] = HTMLElement (the fill div)
  private barSegments: HTMLElement[][] = [];

  // 当前模式
  private currentMode: 'stable' | 'race' = 'stable';

  constructor(container: HTMLElement) {
    this.container = container;
    this.createBaseUI();
  }

  /**
   * 创建基础UI框架
   */
  private createBaseUI(): void {
    const fontStack = '"Arial Rounded MT Bold", "Verdana", sans-serif';

    // 状态面板（左侧竖排）
    this.statusPanel = document.createElement('div');
    this.statusPanel.id = 'hud-status';
    this.statusPanel.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      display: flex;
      flex-direction: column;
      gap: 15px;
      z-index: 1000;
    `;
    this.container.appendChild(this.statusPanel);

    // 倒计时/计时器面板（顶部中央）
    this.timerPanel = document.createElement('div');
    this.timerPanel.id = 'hud-timer';
    this.timerPanel.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 10px 40px;
      background-color: #FFFFFF;
      color: #000000;
      font-family: ${fontStack};
      font-size: 48px;
      font-weight: 900;
      border-radius: 30px;
      z-index: 1000;
      border: 4px solid #000000;
      box-shadow: 0 6px 0 #000000;
      display: none;
      text-shadow: 2px 2px 0 #CCCCCC;
    `;
    this.container.appendChild(this.timerPanel);

    // 奖杯面板（右上角）
    this.trophyPanel = document.createElement('div');
    this.trophyPanel.id = 'hud-trophy';
    this.trophyPanel.style.cssText = `
      position: fixed;
      top: 20px;
      right: 60px;
      padding: 8px 16px;
      background-color: #FFD700;
      color: #000000;
      font-family: ${fontStack};
      font-size: 18px;
      font-weight: 900;
      border-radius: 20px;
      z-index: 1000;
      border: 3px solid #000000;
      box-shadow: 0 4px 0 #000000;
      display: flex;
      align-items: center;
      gap: 6px;
    `;
    this.container.appendChild(this.trophyPanel);

    // 里程碑进度条（底部）- 缩小版
    this.milestoneBar = document.createElement('div');
    this.milestoneBar.id = 'hud-milestone';
    this.milestoneBar.style.cssText = `
      position: fixed;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      width: 70%;
      max-width: 800px;
      padding: 5px;
      z-index: 1000;
      display: none;
      flex-direction: column;
      gap: 3px;
    `;
    this.container.appendChild(this.milestoneBar);

    // 初始化进度条结构
    this.initMilestoneBarStructure();

    // 创建仪表盘
    this.createSpeedometer();

    // 创建右侧动态提示
    this.createFloatingIndicator();

    // 消息面板（屏幕上方偏下）- 不遮挡计时器
    this.messagePanel = document.createElement('div');
    this.messagePanel.id = 'hud-message';
    this.messagePanel.style.cssText = `
      position: fixed;
      top: 20%;
      left: 50%;
      transform: translate(-50%, -50%);
      padding: 12px 25px;
      background-color: #00BFFF;
      color: white;
      font-family: ${fontStack};
      font-size: 20px;
      font-weight: 900;
      border-radius: 12px;
      z-index: 1001;
      display: none;
      text-align: center;
      border: 3px solid #FFFFFF;
      box-shadow: 0 4px 0 rgba(0,0,0,0.2);
      text-shadow: 2px 2px 0 rgba(0,0,0,0.2);
    `;
    this.container.appendChild(this.messagePanel);
  }

  /**
   * 创建仪表盘 - 缩小版
   */
  private createSpeedometer(): void {
    this.speedometerPanel = document.createElement('div');
    this.speedometerPanel.id = 'hud-speedometer';
    this.speedometerPanel.style.cssText = `
      position: fixed;
      bottom: 90px; /* 位于进度条上方，留出更多空间 */
      left: 50%;
      transform: translateX(-50%);
      width: 200px;
      height: 120px;
      z-index: 1001;
      display: none;
      pointer-events: none;
    `;

    // Canvas 用于绘制刻度盘和指针
    this.speedometerCanvas = document.createElement('canvas');
    this.speedometerCanvas.width = 200;
    this.speedometerCanvas.height = 120;
    this.speedometerCanvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    `;

    // 数值显示 (底部居中)
    this.speedometerValue = document.createElement('div');
    this.speedometerValue.style.cssText = `
      position: absolute;
      bottom: -5px;
      left: 50%;
      transform: translateX(-50%);
      font-family: 'Arial Rounded MT Bold', sans-serif;
      font-size: 20px;
      font-weight: 900;
      color: #FFFFFF;
      text-shadow: 2px 2px 0 #000;
      text-align: center;
    `;

    this.speedometerPanel.appendChild(this.speedometerCanvas);
    this.speedometerPanel.appendChild(this.speedometerValue);
    this.container.appendChild(this.speedometerPanel);
  }

  /**
   * 创建右侧距离显示
   */
  private createFloatingIndicator(): void {
    this.floatingIndicatorPanel = document.createElement('div');
    this.floatingIndicatorPanel.id = 'hud-indicator';
    this.floatingIndicatorPanel.style.cssText = `
      position: fixed;
      top: 45%;
      right: 10%;
      transform: translateY(-50%) rotate(-15deg);
      z-index: 999;
      display: none;
      pointer-events: none;
    `;

    this.floatingValue = document.createElement('div');
    this.floatingValue.style.cssText = `
      font-family: 'Arial Rounded MT Bold', sans-serif;
      font-size: 72px;
      font-weight: 900;
      color: #FFFFFF;
      -webkit-text-stroke: 4px #000000;
      text-shadow: 5px 5px 0 rgba(0,0,0,0.4);
    `;

    this.floatingIndicatorPanel.appendChild(this.floatingValue);
    this.container.appendChild(this.floatingIndicatorPanel);
  }

  /**
   * 绘制仪表盘 - 显示当前距离进度
   * 四个阶段，四个刻度（四等分）
   * @param currentDistance 当前已跑距离
   * @param scaleMax 仪表盘最大刻度（理论最大距离）
   */
  private drawSpeedometer(currentDistance: number, scaleMax: number): void {
    if (!this.speedometerCanvas || !this.speedometerValue) return;

    const ctx = this.speedometerCanvas.getContext('2d');
    if (!ctx) return;

    const width = this.speedometerCanvas.width;
    const height = this.speedometerCanvas.height;
    const centerX = width / 2;
    const centerY = height - 25; // 留空间给底部数值
    const radius = 75; // 更小的半径

    ctx.clearRect(0, 0, width, height);

    // 四个阶段的颜色 (从左到右: 蓝、绿、黄、橙红)
    const stageColors = ['#00BFFF', '#32CD32', '#FFD700', '#FF6347'];
    const stageCount = 4;
    const arcPerStage = Math.PI / stageCount;

    // 1. 绘制四个阶段的弧线
    for (let i = 0; i < stageCount; i++) {
      const startAngle = Math.PI + i * arcPerStage;
      const endAngle = startAngle + arcPerStage - 0.02; // 小间隙

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.lineWidth = 16; // 更小的线宽
      ctx.strokeStyle = stageColors[i];
      ctx.lineCap = 'butt';
      ctx.stroke();
    }

    // 2. 绘制刻度线 (在每个阶段的分界处)
    // 只在 25% 和 75% 位置显示刻度数值
    const tickPositions = [0, 0.25, 0.5, 0.75, 1]; // 5个刻度点

    for (let i = 0; i < tickPositions.length; i++) {
      const t = tickPositions[i];
      const angle = Math.PI + t * Math.PI;
      const innerR = radius - 10;
      const outerR = radius + 2;

      const sx = centerX + Math.cos(angle) * innerR;
      const sy = centerY + Math.sin(angle) * innerR;
      const ex = centerX + Math.cos(angle) * outerR;
      const ey = centerY + Math.sin(angle) * outerR;

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      // 只在 25% 和 75% 位置显示刻度数值
      if (i === 1 || i === 3) {
        const labelR = radius - 30;
        const lx = centerX + Math.cos(angle) * labelR;
        const ly = centerY + Math.sin(angle) * labelR;
        const labelValue = Math.round(scaleMax * t);

        ctx.font = 'bold 11px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillText(formatDistance(labelValue), lx, ly);
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }
    }

    // 3. 计算指针角度 (从左到右，0在左边180度，1在右边0度)
    const normalizedValue = Math.min(1, Math.max(0, currentDistance / (scaleMax || 1)));
    // 角度从 PI (左边, 180度) 到 2*PI (右边, 360度/0度)
    const needleAngle = Math.PI + normalizedValue * Math.PI;

    // 4. 绘制指针 (简单线条指针)
    const needleLen = radius - 20;
    const nx = centerX + Math.cos(needleAngle) * needleLen;
    const ny = centerY + Math.sin(needleAngle) * needleLen;

    // 指针边框
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(nx, ny);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#000000';
    ctx.lineCap = 'round';
    ctx.stroke();

    // 白色指针
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(nx, ny);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineCap = 'round';
    ctx.stroke();

    // 指针中心圆点
    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#8B4513'; // 棕色
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 更新数值显示 (当前距离)
    this.speedometerValue.innerText = formatDistance(currentDistance);
  }

  /**
   * 更新右侧距离显示 - 显示当前已跑距离，不断增加
   */
  private updateFloatingIndicator(distance: number): void {
    if (!this.floatingIndicatorPanel || !this.floatingValue) return;

    // 直接显示当前距离，带 + 前缀
    this.floatingValue.innerText = `+${Math.round(distance)}`;
    this.floatingIndicatorPanel.style.display = 'block';
  }

  /**
   * 初始化里程碑进度条的DOM结构 (只执行一次)
   */
  private initMilestoneBarStructure(): void {
    if (!this.milestoneBar) return;

    this.milestoneBar.innerHTML = '';
    this.barSegments = [];

    BAR_CONFIG.forEach((config, index) => {
      const barSegmentsRow: HTMLElement[] = [];

      const barContainer = document.createElement('div');
      barContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
      `;

      // 左侧头像 (只在最底层显示) - 缩小版
      const avatarHtml = index === 2 ? `
        <div style="
          width: 28px; 
          height: 28px; 
          border-radius: 4px; 
          border: 2px solid #fff; 
          box-shadow: 0 0 3px rgba(0,0,0,0.5);
          background-color: pink;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        ">
          👤
        </div>
      ` : `<div style="width: 28px;"></div>`;

      // 进度条部分容器
      const barWrapper = document.createElement('div');
      barWrapper.style.cssText = `
        flex: 1;
        display: flex;
        background: #000;
        border: 2px solid #fff;
        border-radius: 4px;
        overflow: hidden;
      `;

      // 生成片段
      config.milestones.forEach((milestone, mIndex) => {
        const label = config.labels[mIndex];
        const color = config.colors[mIndex % config.colors.length];

        const segmentDiv = document.createElement('div');
        segmentDiv.style.cssText = `
          flex: 1;
          height: ${config.height}px;
          background-color: #333;
          position: relative;
          border-right: 1px solid rgba(255,255,255,0.5);
          overflow: hidden;
        `;

        // 填充层
        const fillDiv = document.createElement('div');
        fillDiv.style.cssText = `
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          width: 0%; /* 初始为0 */
          background-color: ${color};
          transition: width 0.1s linear;
        `;

        // 标签层 - 缩小字体
        const labelDiv = document.createElement('div');
        labelDiv.innerText = label;
        labelDiv.style.cssText = `
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-family: 'Arial Rounded MT Bold', sans-serif;
          font-size: 10px;
          font-weight: bold;
          text-shadow: 1px 1px 0 #000;
          z-index: 2;
        `;

        segmentDiv.appendChild(fillDiv);
        segmentDiv.appendChild(labelDiv);
        barWrapper.appendChild(segmentDiv);

        // 保存fillDiv的引用以便更新
        barSegmentsRow.push(fillDiv);
      });

      // 右侧奖励图标 - 缩小版
      const rewardDiv = document.createElement('div');
      rewardDiv.innerHTML = `
        <span style="font-size: 14px; color: #FFD700;">🏆</span>
        <span>+${config.reward}</span>
      `;
      rewardDiv.style.cssText = `
        display: flex;
        align-items: center;
        gap: 2px;
        color: #fff;
        font-weight: bold;
        font-family: 'Arial Rounded MT Bold', sans-serif;
        font-size: 12px;
        min-width: 45px;
        text-shadow: 1px 1px 0 #000;
      `;

      barContainer.innerHTML = avatarHtml;
      barContainer.appendChild(barWrapper);
      barContainer.appendChild(rewardDiv);

      this.milestoneBar?.appendChild(barContainer);
      this.barSegments.push(barSegmentsRow);
    });
  }

  /**
   * 创建一个通用的卡通风格状态卡片
   */
  private createStatusCard(icon: string, label: string, value: string, color: string = '#FFFFFF'): string {
    return `
      <div style="
        background-color: ${color};
        padding: 12px 20px;
        border-radius: 15px;
        border: 3px solid #000000;
        box-shadow: 0 4px 0 rgba(0,0,0,0.2);
        font-family: 'Arial Rounded MT Bold', sans-serif;
        color: #000;
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 180px;
      ">
        <span style="font-size: 24px;">${icon}</span>
        <div style="display: flex; flex-direction: column;">
          <span style="font-size: 12px; opacity: 0.7; font-weight: bold; text-transform: uppercase;">${label}</span>
          <span style="font-size: 20px; font-weight: 900;">${value}</span>
        </div>
      </div>
    `;
  }

  /**
   * 更新马棚状态
   */
  updateStableStatus(status: StableStatus): void {
    this.currentMode = 'stable';

    if (this.timerPanel) this.timerPanel.style.display = 'none';
    if (this.milestoneBar) this.milestoneBar.style.display = 'none';
    if (this.speedometerPanel) this.speedometerPanel.style.display = 'none';
    if (this.floatingIndicatorPanel) this.floatingIndicatorPanel.style.display = 'none';

    // 更新状态面板
    if (this.statusPanel) {
      const trainingCard = status.isTraining
        ? this.createStatusCard('🏃', '正在训练', `Lv${status.trainingLevel} (+${status.trainingLevel <= 2 ? status.trainingLevel : status.trainingLevel <= 3 ? 3.5 : status.trainingLevel <= 4 ? 5 : 8}/s)`, '#90EE90')
        : '';

      const rebirthCard = (status.rebirthCount && status.rebirthCount > 0)
        ? this.createStatusCard('\u{1F504}', '重生', `${status.rebirthCount}次 (x${(status.trainingMultiplier ?? 1).toFixed(1)})`, '#B2EBF2')
        : '';

      this.statusPanel.innerHTML = `
        ${this.createStatusCard('⚡', '速度等级', status.speedLevel.toFixed(1), '#FFFFFF')}
        ${this.createStatusCard('🚀', '当前速度', `${status.currentSpeed.toFixed(1)} m/s`, '#FFFFFF')}
        ${this.createStatusCard('🏅', '最佳记录', formatDistance(status.bestDistance), '#ADD8E6')}
        ${rebirthCard}
        ${trainingCard}
      `;
    }

    // 更新奖杯面板
    if (this.trophyPanel) {
      this.trophyPanel.innerHTML = `
        <span style="font-size: 20px;">🏆</span>
        <span>${formatTrophies(status.totalTrophies)}</span>
      `;
    }
  }

  /**
   * 更新比赛状态
   */
  updateRaceStatus(status: RaceStatus): void {
    this.currentMode = 'race';

    // 显示计时器
    if (this.timerPanel) {
      this.timerPanel.style.display = 'block';
      const timeColor = status.remainingTime <= 10 ? '#FF6B6B' : '#000000';
      this.timerPanel.style.color = timeColor;
      this.timerPanel.innerHTML = this.formatTime(status.remainingTime);
    }

    // 隐藏状态面板（因为现在有仪表盘了）
    if (this.statusPanel) {
      this.statusPanel.style.display = 'none';
    }

    // 更新奖杯面板
    if (this.trophyPanel) {
      this.trophyPanel.innerHTML = `
        <span style="font-size: 20px;">🏆</span>
        <span>+${status.trophiesEarned}</span>
      `;
    }

    // 更新里程碑进度条 (高效版)
    this.updateMilestoneBar(status.distance);

    // 显示仪表盘 - 显示当前距离进度
    if (this.speedometerPanel) {
      this.speedometerPanel.style.display = 'block';

      // 仪表盘刻度上限 - 基于当前速度等级计算理论最大距离（60秒比赛）
      // 速度 = 5 + speedLevel * 0.5，理论最大距离 = 速度 * 60
      const theoreticalMaxDistance = (5 + status.speedLevel * 0.5) * 60;
      // 刻度上限取整到合适的值，并留一点余量
      const scaleMax = Math.max(500, Math.ceil(theoreticalMaxDistance * 1.1 / 100) * 100);

      // 当前距离作为指针位置
      this.drawSpeedometer(status.distance, scaleMax);
    }

    // 更新右侧浮动提示
    this.updateFloatingIndicator(status.distance);
  }

  /**
   * 更新里程碑进度条 (只更新宽度)
   */
  private updateMilestoneBar(currentDistance: number): void {
    if (!this.milestoneBar) return;

    this.milestoneBar.style.display = 'flex';

    // 如果结构未初始化，重新初始化（防止DOM被意外清空）
    if (this.barSegments.length === 0) {
      this.initMilestoneBarStructure();
    }

    BAR_CONFIG.forEach((config, index) => {
      let prevMilestone = 0;
      const row = this.barSegments[index];
      if (!row) return;

      config.milestones.forEach((milestone, mIndex) => {
        const fillDiv = row[mIndex];
        if (!fillDiv) return;

        let fillPercent = 0;
        if (currentDistance >= milestone) {
          fillPercent = 100;
        } else if (currentDistance > prevMilestone) {
          fillPercent = ((currentDistance - prevMilestone) / (milestone - prevMilestone)) * 100;
        }

        fillDiv.style.width = `${fillPercent}%`;

        prevMilestone = milestone;
      });
    });
  }

  /**
   * 格式化时间
   */
  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);

    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
    return `${secs}.${ms.toString().padStart(2, '0')}`;
  }

  /**
   * 显示消息
   */
  showMessage(text: string, duration: number = 2000): void {
    if (!this.messagePanel) return;

    this.messagePanel.innerHTML = text;
    this.messagePanel.style.display = 'block';

    if (duration > 0) {
      setTimeout(() => {
        if (this.messagePanel) {
          this.messagePanel.style.display = 'none';
        }
      }, duration);
    }
  }

  /**
   * 显示比赛结果
   */
  showRaceResult(result: {
    distance: number;
    trophies: number;
    isNewRecord: boolean;
    milestones: number[];
  }, onContinue: () => void): void {
    if (!this.messagePanel) return;

    // 隐藏其他面板
    if (this.timerPanel) this.timerPanel.style.display = 'none';
    if (this.milestoneBar) this.milestoneBar.style.display = 'none';
    if (this.speedometerPanel) this.speedometerPanel.style.display = 'none';
    if (this.floatingIndicatorPanel) this.floatingIndicatorPanel.style.display = 'none';

    const recordBadge = result.isNewRecord
      ? `<div style="color: #FFD700; font-size: 24px; margin-bottom: 10px; text-shadow: 2px 2px 0 #000;">🎉 新纪录!</div>`
      : '';

    // 修改面板位置为屏幕中央
    this.messagePanel.style.top = '50%';

    this.messagePanel.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 15px;">🏁</div>
      ${recordBadge}
      <div style="font-size: 28px; margin-bottom: 15px; font-weight: 900;">比赛结束!</div>
      
      <div style="
        background: #FFFFFF;
        color: #000;
        padding: 15px;
        border-radius: 12px;
        border: 3px solid #000;
        margin-bottom: 20px;
      ">
        <div style="font-size: 40px; color: #007bff; font-weight: 900;">
          ${formatDistance(result.distance)}
        </div>
        <div style="font-size: 24px; color: #FFD700; margin-top: 8px; font-weight: 900; text-shadow: 1px 1px 0 #000;">
          🏆 +${result.trophies}
        </div>
      </div>
      
      <button 
        id="continue-btn"
        style="
          padding: 15px 40px;
          background-color: #00FF00;
          color: #000;
          border: 3px solid #000;
          border-radius: 12px;
          font-size: 20px;
          font-weight: 900;
          font-family: 'Arial Rounded MT Bold', sans-serif;
          cursor: pointer;
          box-shadow: 0 6px 0 #006400;
          transition: transform 0.1s, box-shadow 0.1s;
        "
        onmouseover="this.style.transform='translateY(2px)'; this.style.boxShadow='0 4px 0 #006400'"
        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 6px 0 #006400'"
      >
        返回马棚
      </button>
    `;

    this.messagePanel.style.display = 'block';

    // 绑定继续按钮
    const btn = document.getElementById('continue-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        this.messagePanel!.style.display = 'none';
        onContinue();
      });
    }
  }

  /**
   * 隐藏消息面板
   */
  hideMessage(): void {
    if (this.messagePanel) {
      this.messagePanel.style.display = 'none';
    }
  }

  /**
   * 设置模式
   */
  setMode(mode: 'stable' | 'race'): void {
    this.currentMode = mode;

    if (mode === 'stable') {
      if (this.timerPanel) this.timerPanel.style.display = 'none';
      if (this.milestoneBar) this.milestoneBar.style.display = 'none';
      if (this.speedometerPanel) this.speedometerPanel.style.display = 'none';
      if (this.floatingIndicatorPanel) this.floatingIndicatorPanel.style.display = 'none';
      if (this.statusPanel) this.statusPanel.style.display = 'flex';
    }
  }

  // ============ 兼容旧接口 ============

  updateStatus(state: any): void {
    // 旧接口兼容
  }

  showDecision(actions: any[], timeRemaining: number): void {
    // 不再使用决策系统
  }

  hideDecision(): void {
    // 不再使用
  }

  showResults(results: any[]): void {
    // 使用新的 showRaceResult 代替
  }

  onAction(callback: (actionId: string) => void): void {
    // 不再使用
  }

  /**
   * 清理
   */
  dispose(): void {
    this.statusPanel?.remove();
    this.timerPanel?.remove();
    this.trophyPanel?.remove();
    this.milestoneBar?.remove();
    this.messagePanel?.remove();
    this.speedometerPanel?.remove();
    this.floatingIndicatorPanel?.remove();
  }
}
