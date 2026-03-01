/**
 * 每局结束简报弹窗
 * 在比赛/跑酷/对战结束后自动弹出
 * 显示本局数据 + 对比 + 柱状图 + AI 一句话点评
 */

import { getPlayerProgress, RaceRecord } from '../data/PlayerProgress';
import { drawBarChart } from './CanvasChart';
import { StatsUI } from './StatsUI';
import { GeminiArchitect } from '../ai/GeminiArchitect';

const FONT = "'Arial Rounded MT Bold', 'Nunito', sans-serif";

export interface PostGameData {
  mode: 'race' | 'parkour' | 'battle';
  distance: number;
  trophies: number;
  duration: number;         // 秒
  isNewRecord: boolean;
  collectibleScore?: number;
  winner?: string;
}

export class PostGameSummary {
  private overlay: HTMLDivElement | null = null;
  private architect: GeminiArchitect | null = null;
  private statsUI: StatsUI | null = null;

  constructor(architect?: GeminiArchitect) {
    this.architect = architect || null;
    this.statsUI = new StatsUI(architect);
  }

  /**
   * 显示每局结束简报
   * @param data 本局数据
   * @param onBack 返回马厩回调
   */
  show(data: PostGameData, onBack: () => void): void {
    this.dispose();

    const progress = getPlayerProgress();
    const history = progress.getRaceHistory();
    const stats = progress.getStats();

    // 计算对比数据
    const avgDist = stats.averageDistance;
    const distDiff = avgDist > 0 ? ((data.distance - avgDist) / avgDist * 100) : 0;

    // 遮罩
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.6); z-index: 10000;
      display: flex; justify-content: center; align-items: center;
      font-family: ${FONT};
    `;
    const stopAll = (e: Event) => e.stopPropagation();
    this.overlay.addEventListener('mousedown', stopAll);
    this.overlay.addEventListener('mouseup', stopAll);
    this.overlay.addEventListener('click', stopAll);
    this.overlay.addEventListener('keydown', stopAll);

    // 面板
    const panel = document.createElement('div');
    panel.style.cssText = `
      background: #FFF9E6; color: #333;
      border: 4px solid #000; border-radius: 20px;
      padding: 18px 22px 16px;
      max-width: 460px; width: 90%;
      max-height: 80vh; overflow-y: auto;
      box-shadow: 0 8px 0 #000;
      font-family: ${FONT};
    `;

    // AI 教练点评区（顶部）
    const aiBar = document.createElement('div');
    aiBar.style.cssText = `
      display: flex; align-items: center; gap: 10px;
      background: linear-gradient(135deg, #EDE7F6, #E8EAF6);
      border: 2px solid #000; border-radius: 12px;
      padding: 10px 12px; margin-bottom: 14px;
      box-shadow: 0 2px 0 #000;
    `;
    const aiAvatar = document.createElement('div');
    aiAvatar.style.cssText = 'font-size: 28px; flex-shrink: 0;';
    aiAvatar.textContent = '🤖';
    aiBar.appendChild(aiAvatar);
    const aiComment = document.createElement('div');
    aiComment.style.cssText = 'font-size: 12px; font-weight: 700; color: #333; line-height: 1.5;';
    aiComment.textContent = this.getLocalComment(data, distDiff);
    aiBar.appendChild(aiComment);
    panel.appendChild(aiBar);

    // 异步 AI 点评
    this.requestAIComment(data, aiComment);

    // 新纪录
    if (data.isNewRecord) {
      const badge = document.createElement('div');
      badge.style.cssText = `
        text-align: center; padding: 6px;
        background: linear-gradient(135deg, #FFD700, #FFA000);
        border: 2px solid #000; border-radius: 10px;
        font-size: 16px; font-weight: 900; color: #000;
        margin-bottom: 10px; box-shadow: 0 2px 0 #000;
      `;
      badge.textContent = '🎉 新纪录！';
      panel.appendChild(badge);
    }

    // 标题
    const modeLabels: Record<string, string> = { race: '🏇 竞速结算', parkour: '🎮 跑酷结算', battle: '⚔️ 对战结算' };
    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'text-align: center; font-size: 18px; font-weight: 900; margin-bottom: 12px;';
    titleEl.textContent = modeLabels[data.mode] || '比赛结算';
    panel.appendChild(titleEl);

    // 数据卡片行
    const cardsRow = document.createElement('div');
    cardsRow.style.cssText = 'display: flex; gap: 8px; margin-bottom: 14px; justify-content: center;';

    // 距离卡片（带对比箭头）
    const distCard = this.makeDataCard(
      '📏', '距离', this.fmtDist(data.distance),
      avgDist > 0 ? distDiff : undefined
    );
    cardsRow.appendChild(distCard);

    // 奖杯卡片
    cardsRow.appendChild(this.makeDataCard('🏆', '奖杯', `+${data.trophies}`));

    // 时间卡片
    if (data.duration > 0) {
      const timeStr = data.duration >= 60
        ? `${Math.floor(data.duration / 60)}:${String(Math.floor(data.duration % 60)).padStart(2, '0')}`
        : `${data.duration.toFixed(1)}s`;
      cardsRow.appendChild(this.makeDataCard('⏱️', '时间', timeStr));
    }

    // 对战结果
    if (data.mode === 'battle' && data.winner) {
      const winLabel = data.winner === 'player' ? '胜利' : data.winner === 'ai' ? '失败' : '平局';
      const winEmoji = data.winner === 'player' ? '🥇' : data.winner === 'ai' ? '😢' : '🤝';
      cardsRow.appendChild(this.makeDataCard(winEmoji, '结果', winLabel));
    }

    // 收集物
    if (data.collectibleScore !== undefined && data.collectibleScore > 0) {
      cardsRow.appendChild(this.makeDataCard('💎', '收集', `${data.collectibleScore}`));
    }
    panel.appendChild(cardsRow);

    // 柱状图（最近 10 局）
    if (history.length >= 2) {
      const chartSection = document.createElement('div');
      chartSection.style.cssText = 'margin-bottom: 14px;';

      const recent = history.slice(-10);
      const chartData = recent.map(r => Math.round(r.distance));
      const chartLabels = recent.map((_r, i) => i === recent.length - 1 ? '本局' : `${i + 1}`);

      const chartCanvas = drawBarChart({
        data: chartData,
        labels: chartLabels,
        width: 410,
        height: 150,
        barColor: '#54A0FF',
        highlightIndex: recent.length - 1,
        bestLine: stats.bestDistance,
        title: '最近战绩',
      });
      chartCanvas.style.cssText = 'width: 100%; height: auto; border-radius: 10px;';
      chartSection.appendChild(chartCanvas);
      panel.appendChild(chartSection);
    }

    // 按钮行
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 10px;';

    btnRow.appendChild(this.makeButton('🏠 返回马厩', '#FFD700', '#000', () => {
      this.dispose();
      onBack();
    }));

    if (history.length >= 2) {
      btnRow.appendChild(this.makeButton('📊 完整战绩', '#7E57C2', '#FFF', () => {
        this.dispose();
        if (this.statsUI) {
          this.statsUI.show();
        }
      }));
    }

    panel.appendChild(btnRow);

    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);
  }

  dispose(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  // ============ 私有方法 ============

  private makeDataCard(emoji: string, label: string, value: string, diffPct?: number): HTMLDivElement {
    const card = document.createElement('div');
    card.style.cssText = `
      flex: 1; min-width: 72px;
      background: #FFF; border: 2px solid #000; border-radius: 12px;
      padding: 8px 6px; text-align: center;
      box-shadow: 0 2px 0 #000;
    `;
    let diffHtml = '';
    if (diffPct !== undefined) {
      const arrow = diffPct >= 0 ? '▲' : '▼';
      const color = diffPct >= 0 ? '#4CAF50' : '#F44336';
      diffHtml = `<div style="font-size: 9px; font-weight: 700; color: ${color}; margin-top: 2px;">${arrow} ${Math.abs(diffPct).toFixed(0)}%</div>`;
    }
    card.innerHTML = `
      <div style="font-size: 14px;">${emoji}</div>
      <div style="font-size: 9px; font-weight: 700; color: #999;">${label}</div>
      <div style="font-size: 15px; font-weight: 900; color: #000;">${value}</div>
      ${diffHtml}
    `;
    return card;
  }

  private makeButton(text: string, bg: string, color: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      flex: 1; padding: 10px 14px;
      border-radius: 12px; cursor: pointer;
      font-family: ${FONT}; font-size: 14px; font-weight: 900;
      border: 3px solid #000; box-shadow: 0 3px 0 #000;
      background: ${bg}; color: ${color};
      transition: transform 0.1s;
    `;
    btn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      btn.style.transform = 'translateY(2px)';
      btn.style.boxShadow = '0 1px 0 #000';
    });
    btn.addEventListener('mouseup', (e) => {
      e.stopPropagation();
      btn.style.transform = '';
      btn.style.boxShadow = '0 3px 0 #000';
    });
    btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    return btn;
  }

  private fmtDist(d: number): string {
    if (d >= 10000) return (d / 1000).toFixed(1) + 'km';
    return Math.round(d) + 'm';
  }

  private getLocalComment(data: PostGameData, diffPct: number): string {
    if (data.isNewRecord) {
      return 'AI 教练：新纪录！你的潜力正在被 AI 记录，继续突破极限！';
    }
    if (data.mode === 'battle') {
      return data.winner === 'player'
        ? 'AI 教练：战胜了 AI 对手，不错的策略判断力。'
        : 'AI 教练：AI 对手赢了这局，但我已经记住了你的弱点...';
    }
    if (diffPct > 15) return 'AI 教练：这局超常发挥，比你的平均水平高出不少！';
    if (diffPct < -15) return 'AI 教练：这局有点失常，别灰心，AI 教练相信你下局能翻盘。';
    return 'AI 教练：表现稳定，AI 正在分析你的成长曲线...';
  }

  /** 异步请求 AI 一句话点评 */
  private async requestAIComment(data: PostGameData, targetEl: HTMLDivElement): Promise<void> {
    if (!this.architect || !this.architect.hasApiKey) return;
    try {
      const progress = getPlayerProgress();
      const history = progress.getRaceHistory();
      const recent = history.slice(-5).map(r => Math.round(r.distance));
      const result = await this.architect.generateCoachAnalysis({
        totalRaces: progress.getStats().totalRaces,
        bestDistance: Math.round(progress.bestDistance),
        avgDistance: progress.getStats().averageDistance,
        recentDistances: recent,
        totalTrophies: progress.totalTrophies,
        speedLevel: Math.round(progress.speedLevel),
        rebirthCount: progress.rebirthCount,
      });
      if (result && this.overlay) {
        targetEl.textContent = `AI 教练：${result}`;
      }
    } catch (err) {
      console.warn('[PostGameSummary] AI 点评请求失败:', err);
      // 保留本地文案
    }
  }
}
