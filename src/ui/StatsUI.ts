/**
 * AI 战绩分析面板
 * 从马厩底部按钮打开的全屏模态面板
 * 显示概览卡片 + 柱状图 + AI 教练分析
 */

import { getPlayerProgress, RaceRecord } from '../data/PlayerProgress';
import { drawBarChart } from './CanvasChart';
import { GeminiArchitect } from '../ai/GeminiArchitect';

const FONT = "'Arial Rounded MT Bold', 'Nunito', sans-serif";

export class StatsUI {
  private overlay: HTMLDivElement | null = null;
  private architect: GeminiArchitect | null = null;

  constructor(architect?: GeminiArchitect) {
    this.architect = architect || null;
  }

  get isOpen(): boolean {
    return this.overlay !== null;
  }

  show(): void {
    if (this.isOpen) return;
    this.dispose();

    const progress = getPlayerProgress();
    const stats = progress.getStats();
    const history = progress.getRaceHistory();

    // 遮罩
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.55); z-index: 9500;
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
      max-width: 520px; width: 92%;
      max-height: 85vh; overflow-y: auto;
      box-shadow: 0 8px 0 #000;
      font-family: ${FONT};
      position: relative;
    `;

    // 关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      position: absolute; top: 10px; right: 14px;
      width: 28px; height: 28px;
      border: 2px solid #000; border-radius: 8px;
      background: #FFF; color: #000;
      font-size: 14px; font-weight: 900;
      cursor: pointer; font-family: ${FONT};
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 0 #000;
    `;
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); this.dispose(); });
    panel.appendChild(closeBtn);

    // 标题
    const title = document.createElement('div');
    title.style.cssText = 'text-align: center; margin-bottom: 14px;';
    title.innerHTML = `
      <div style="font-size: 20px; font-weight: 900; color: #000; text-shadow: 1px 1px 0 #ccc;">
        🤖 AI 战绩分析
      </div>
      <div style="font-size: 11px; font-weight: 700; color: #888; margin-top: 2px;">
        AI 教练正在分析你的每一步
      </div>
    `;
    panel.appendChild(title);

    // 概览卡片行
    const cardsRow = document.createElement('div');
    cardsRow.style.cssText = 'display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; justify-content: center;';
    cardsRow.appendChild(this.makeCard('🏁', '总比赛', stats.totalRaces.toString()));
    cardsRow.appendChild(this.makeCard('📏', '累计距离', this.fmtDist(stats.totalDistance)));
    cardsRow.appendChild(this.makeCard('🏆', '最佳记录', this.fmtDist(stats.bestDistance)));
    cardsRow.appendChild(this.makeCard('💰', '累计奖杯', progress.totalTrophies.toString()));
    panel.appendChild(cardsRow);

    // 柱状图区
    if (history.length > 0) {
      const chartSection = document.createElement('div');
      chartSection.style.cssText = 'margin-bottom: 14px;';

      const chartTitle = document.createElement('div');
      chartTitle.textContent = '📊 最近战绩趋势';
      chartTitle.style.cssText = 'font-size: 13px; font-weight: 900; color: #555; margin-bottom: 8px;';
      chartSection.appendChild(chartTitle);

      const recent = history.slice(-15);
      const chartData = recent.map(r => Math.round(r.distance));
      const chartLabels = recent.map((r, i) => {
        if (recent.length <= 10) return `#${history.length - recent.length + i + 1}`;
        return (i % 2 === 0) ? `#${history.length - recent.length + i + 1}` : '';
      });

      const chartCanvas = drawBarChart({
        data: chartData,
        labels: chartLabels,
        width: 470,
        height: 180,
        barColor: '#54A0FF',
        highlightIndex: recent.length - 1,
        bestLine: stats.bestDistance,
        title: '',
      });
      chartCanvas.style.cssText = 'width: 100%; height: auto; border-radius: 10px;';
      chartSection.appendChild(chartCanvas);
      panel.appendChild(chartSection);
    } else {
      const empty = document.createElement('div');
      empty.style.cssText = 'text-align: center; padding: 24px 0; color: #999; font-size: 13px; font-weight: 700;';
      empty.textContent = '暂无比赛记录，去跑一局吧！';
      panel.appendChild(empty);
    }

    // 分模式统计
    if (history.length > 0) {
      const modeSection = document.createElement('div');
      modeSection.style.cssText = 'margin-bottom: 14px;';
      const modeTitle = document.createElement('div');
      modeTitle.textContent = '📋 分模式统计';
      modeTitle.style.cssText = 'font-size: 13px; font-weight: 900; color: #555; margin-bottom: 6px;';
      modeSection.appendChild(modeTitle);

      const modeRow = document.createElement('div');
      modeRow.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';
      const modes: Array<{ key: string; label: string; emoji: string }> = [
        { key: 'race', label: '竞速', emoji: '🏇' },
        { key: 'parkour', label: '跑酷', emoji: '🎮' },
        { key: 'battle', label: '对战', emoji: '⚔️' },
      ];
      for (const m of modes) {
        const modeRecords = history.filter(r => r.mode === m.key);
        if (modeRecords.length === 0) continue;
        const avgDist = Math.round(modeRecords.reduce((s, r) => s + r.distance, 0) / modeRecords.length);
        const best = Math.round(Math.max(...modeRecords.map(r => r.distance)));
        const card = document.createElement('div');
        card.style.cssText = `
          flex: 1; min-width: 120px; background: #FFF; border: 2px solid #000;
          border-radius: 10px; padding: 8px 10px; box-shadow: 0 2px 0 #000;
        `;
        card.innerHTML = `
          <div style="font-size: 13px; font-weight: 900;">${m.emoji} ${m.label}</div>
          <div style="font-size: 11px; color: #888; margin-top: 3px;">
            ${modeRecords.length}局 · 均${this.fmtDist(avgDist)} · 最佳${this.fmtDist(best)}
          </div>
        `;
        modeRow.appendChild(card);
      }
      modeSection.appendChild(modeRow);
      panel.appendChild(modeSection);
    }

    // AI 分析区
    const aiSection = document.createElement('div');
    aiSection.style.cssText = `
      background: linear-gradient(135deg, #EDE7F6, #E8EAF6);
      border: 2px solid #000; border-radius: 12px;
      padding: 12px 14px; margin-bottom: 14px;
      box-shadow: 0 2px 0 #000;
    `;
    const aiHeader = document.createElement('div');
    aiHeader.style.cssText = 'font-size: 13px; font-weight: 900; color: #5E35B1; margin-bottom: 6px;';
    aiHeader.textContent = '🤖 AI 教练点评';
    aiSection.appendChild(aiHeader);

    const aiText = document.createElement('div');
    aiText.style.cssText = 'font-size: 12px; font-weight: 700; color: #333; line-height: 1.6; min-height: 36px;';

    // 判断是否有 API Key，显示加载态或兜底
    if (this.architect && this.architect.hasApiKey && stats.totalRaces > 0) {
      aiText.textContent = '🔄 AI 教练正在分析你的数据...';
    } else {
      aiText.textContent = this.generateLocalAnalysis(stats, history);
    }
    aiSection.appendChild(aiText);
    panel.appendChild(aiSection);

    // 异步请求 AI 分析
    this.requestAIAnalysis(stats, history, progress.speedLevel, progress.rebirthCount, aiText);

    // 关闭按钮
    const bottomBtn = document.createElement('button');
    bottomBtn.textContent = '关闭';
    bottomBtn.style.cssText = `
      display: block; width: 100%; padding: 10px;
      border: 3px solid #000; border-radius: 12px;
      background: #FFD700; color: #000;
      font-size: 15px; font-weight: 900;
      font-family: ${FONT}; cursor: pointer;
      box-shadow: 0 3px 0 #000;
    `;
    bottomBtn.addEventListener('click', (e) => { e.stopPropagation(); this.dispose(); });
    panel.appendChild(bottomBtn);

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

  private makeCard(emoji: string, label: string, value: string): HTMLDivElement {
    const card = document.createElement('div');
    card.style.cssText = `
      flex: 1; min-width: 90px;
      background: #FFF; border: 2px solid #000; border-radius: 12px;
      padding: 8px 6px; text-align: center;
      box-shadow: 0 2px 0 #000;
    `;
    card.innerHTML = `
      <div style="font-size: 16px;">${emoji}</div>
      <div style="font-size: 10px; font-weight: 700; color: #999; margin: 2px 0;">${label}</div>
      <div style="font-size: 16px; font-weight: 900; color: #000;">${value}</div>
    `;
    return card;
  }

  private fmtDist(d: number): string {
    if (d >= 10000) return (d / 1000).toFixed(1) + 'km';
    return Math.round(d) + 'm';
  }

  /** 本地兜底分析文案 */
  private generateLocalAnalysis(
    stats: { totalRaces: number; totalDistance: number; bestDistance: number; averageDistance: number },
    history: RaceRecord[]
  ): string {
    if (stats.totalRaces === 0) {
      return '还没有比赛记录呢，快去跑一局让 AI 教练分析你的实力吧！';
    }

    const parts: string[] = [];

    // 基础统计
    parts.push(`你已完成 ${stats.totalRaces} 场比赛，平均距离 ${this.fmtDist(stats.averageDistance)}。`);

    // 趋势分析
    if (history.length >= 3) {
      const recent3 = history.slice(-3);
      const older = history.slice(-6, -3);
      if (older.length > 0) {
        const recentAvg = recent3.reduce((s, r) => s + r.distance, 0) / recent3.length;
        const olderAvg = older.reduce((s, r) => s + r.distance, 0) / older.length;
        const diff = ((recentAvg - olderAvg) / olderAvg * 100);
        if (diff > 10) {
          parts.push(`最近表现呈上升趋势 (+${diff.toFixed(0)}%)，继续保持！`);
        } else if (diff < -10) {
          parts.push(`最近几局表现有所下滑，调整一下策略吧。`);
        } else {
          parts.push(`最近发挥稳定，距离最佳记录还差 ${this.fmtDist(stats.bestDistance - recentAvg)}。`);
        }
      }
    }

    return parts.join('');
  }

  /** 异步请求 AI 分析 */
  private async requestAIAnalysis(
    stats: { totalRaces: number; totalDistance: number; bestDistance: number; averageDistance: number },
    history: RaceRecord[],
    speedLevel: number,
    rebirthCount: number,
    targetEl: HTMLDivElement
  ): Promise<void> {
    if (!this.architect || !this.architect.hasApiKey || stats.totalRaces === 0) {
      // 无 API Key 或无数据，确保显示本地分析
      targetEl.textContent = this.generateLocalAnalysis(stats, history);
      return;
    }

    try {
      const recentDistances = history.slice(-10).map(r => Math.round(r.distance));
      const result = await this.architect.generateCoachAnalysis({
        totalRaces: stats.totalRaces,
        bestDistance: Math.round(stats.bestDistance),
        avgDistance: stats.averageDistance,
        recentDistances,
        totalTrophies: getPlayerProgress().totalTrophies,
        speedLevel: Math.round(speedLevel),
        rebirthCount,
      });
      if (result && this.overlay) {
        targetEl.textContent = result;
      } else if (this.overlay) {
        // AI 返回空结果，回退本地分析
        targetEl.textContent = this.generateLocalAnalysis(stats, history);
      }
    } catch (err) {
      console.warn('[StatsUI] AI 教练分析失败，使用本地兜底:', err);
      if (this.overlay) {
        targetEl.textContent = this.generateLocalAnalysis(stats, history);
      }
    }
  }
}
