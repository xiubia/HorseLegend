/**
 * 重生面板 — 消耗速度等级进行重生，提升训练效率
 * UI 布局参考：标题栏 + 换算说明 + 三档按钮（最大/1次/5次）+ 自动重生
 * 风格：Roblox 卡通（圆角、粗边框、渐变按钮）
 */

import { getPlayerProgress } from '../data/PlayerProgress';
import {
  REBIRTH_COST,
  REBIRTH_BONUS_PERCENT,
  AUTO_REBIRTH_TROPHY_COST,
  getMaxRebirths,
  getRebirthCost,
  getRebirthTrainingMultiplier,
  formatSpeedLevel,
} from '../systems/RebirthSystem';

const FONT = "'Arial Rounded MT Bold', 'Nunito', sans-serif";

export class RebirthUI {
  private overlay: HTMLDivElement | null = null;
  private isOpen = false;

  show(): void {
    if (this.isOpen) return;
    this.isOpen = true;

    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.55); z-index: 9500;
      display: flex; justify-content: center; align-items: center;
    `;

    const stopAll = (e: Event) => e.stopPropagation();
    this.overlay.addEventListener('mousedown', stopAll);
    this.overlay.addEventListener('mouseup', stopAll);
    this.overlay.addEventListener('keydown', stopAll);
    this.overlay.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.target === this.overlay) this.hide();
    });

    const panel = this.createPanel();
    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);
  }

  hide(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  dispose(): void {
    this.hide();
  }

  // ============ 面板构建 ============

  private createPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.id = 'rebirth-panel';
    panel.style.cssText = `
      background: #FFF9E6; color: #333; border-radius: 20px;
      padding: 0; width: 440px; max-width: 95vw; max-height: 85vh;
      border: 4px solid #000; box-shadow: 0 8px 0 #000;
      font-family: ${FONT}; display: flex; flex-direction: column;
      overflow: hidden;
    `;

    // ---- 标题栏 ----
    panel.appendChild(this.createHeader());

    // ---- 换算说明区 ----
    panel.appendChild(this.createExchangeInfo());

    // ---- 选项列表 ----
    const listContainer = document.createElement('div');
    listContainer.id = 'rebirth-list-container';
    listContainer.style.cssText = `
      flex: 1; overflow-y: auto; padding: 10px 14px;
      display: flex; flex-direction: column; gap: 8px;
    `;
    this.populateOptions(listContainer);
    panel.appendChild(listContainer);

    // ---- 自动重生 ----
    panel.appendChild(this.createAutoRebirthRow());

    return panel;
  }

  // ---- 标题栏 ----
  private createHeader(): HTMLDivElement {
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 20px;
      background: linear-gradient(135deg, #00BCD4 0%, #26C6DA 50%, #4DD0E1 100%);
      border-bottom: 3px solid #000;
    `;

    const titleGroup = document.createElement('div');
    titleGroup.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    const icon = document.createElement('span');
    icon.textContent = '\u{1F504}'; // 🔄
    icon.style.cssText = 'font-size: 22px;';
    titleGroup.appendChild(icon);

    const title = document.createElement('span');
    title.textContent = '重生';
    title.style.cssText = `
      font-size: 22px; font-weight: 900; color: #FFF;
      text-shadow: 1px 1px 0 rgba(0,0,0,0.3);
    `;
    titleGroup.appendChild(title);
    header.appendChild(titleGroup);

    // 关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '\u2715'; // ✕
    closeBtn.style.cssText = `
      width: 36px; height: 36px; border: 3px solid #000;
      background: #FF6B6B; color: #fff; border-radius: 50%;
      font-size: 16px; font-weight: bold; cursor: pointer;
      box-shadow: 0 3px 0 #000; font-family: ${FONT};
    `;
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });
    header.appendChild(closeBtn);

    return header;
  }

  // ---- 换算说明区 ----
  private createExchangeInfo(): HTMLDivElement {
    const info = document.createElement('div');
    info.style.cssText = `
      background: #FFFDE7; padding: 14px 20px;
      border-bottom: 2px solid #EEE; text-align: center;
    `;

    // 换算公式行
    const formulaRow = document.createElement('div');
    formulaRow.style.cssText = `
      display: flex; justify-content: center; align-items: center;
      gap: 10px; margin-bottom: 6px;
    `;

    // 重生图标
    const rebirthIcon = document.createElement('span');
    rebirthIcon.textContent = '\u{1F504}'; // 🔄
    rebirthIcon.style.cssText = 'font-size: 28px;';

    const numOne = document.createElement('span');
    numOne.textContent = '1';
    numOne.style.cssText = 'font-size: 24px; font-weight: 900; color: #00838F;';

    const equals = document.createElement('span');
    equals.textContent = '=';
    equals.style.cssText = 'font-size: 22px; font-weight: 900; color: #666;';

    const lightningIcon = document.createElement('span');
    lightningIcon.textContent = '\u26A1'; // ⚡
    lightningIcon.style.cssText = 'font-size: 28px;';

    const percent = document.createElement('span');
    percent.textContent = `${REBIRTH_BONUS_PERCENT}%`;
    percent.style.cssText = 'font-size: 24px; font-weight: 900; color: #F57C00;';

    formulaRow.appendChild(rebirthIcon);
    formulaRow.appendChild(numOne);
    formulaRow.appendChild(equals);
    formulaRow.appendChild(lightningIcon);
    formulaRow.appendChild(percent);
    info.appendChild(formulaRow);

    // 说明文字
    const desc = document.createElement('div');
    desc.textContent = '重生的次数越多，训练能量就越多';
    desc.style.cssText = 'font-size: 13px; color: #888; font-weight: bold;';
    info.appendChild(desc);

    return info;
  }

  // ---- 选项列表 ----
  private populateOptions(container: HTMLDivElement): void {
    container.innerHTML = '';

    const progress = getPlayerProgress();
    const speedLevel = progress.speedLevel;
    const currentRebirth = progress.rebirthCount;
    const maxRebirths = getMaxRebirths(speedLevel);

    // 行1: 最大重生
    if (maxRebirths > 0) {
      container.appendChild(
        this.createOptionRow(
          maxRebirths,
          getRebirthCost(maxRebirths),
          '最大',
          maxRebirths > 0,
          true, // 高亮行
        ),
      );
    } else {
      container.appendChild(this.createDisabledMaxRow(speedLevel));
    }

    // 行2: 1次重生
    container.appendChild(
      this.createOptionRow(1, REBIRTH_COST, '重生', speedLevel >= REBIRTH_COST, false),
    );

    // 行3: 5次重生
    container.appendChild(
      this.createOptionRow(5, REBIRTH_COST * 5, '重生', speedLevel >= REBIRTH_COST * 5, false),
    );

    // 当前状态提示
    const statusRow = document.createElement('div');
    statusRow.style.cssText = `
      text-align: center; padding: 8px 0 2px; font-size: 12px; color: #999;
      font-weight: bold;
    `;
    const multiplier = getRebirthTrainingMultiplier(currentRebirth);
    statusRow.innerHTML = `已重生 <span style="color:#00838F;font-size:14px;">${currentRebirth}</span> 次 &nbsp;|&nbsp; 训练倍率 <span style="color:#F57C00;font-size:14px;">x${multiplier.toFixed(1)}</span>`;
    container.appendChild(statusRow);
  }

  /**
   * 创建一个重生选项行
   */
  private createOptionRow(
    count: number,
    cost: number,
    btnLabel: string,
    canAfford: boolean,
    isMaxRow: boolean,
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex; align-items: center; justify-content: space-between;
      background: ${isMaxRow ? '#FFF8E1' : '#FFFFFF'};
      border: 3px solid ${isMaxRow ? '#FFB300' : '#DDD'};
      border-radius: 14px; padding: 12px 16px;
      transition: all 0.15s;
    `;

    // 左侧：重生次数 + 能量消耗
    const leftCol = document.createElement('div');
    leftCol.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';

    const countEl = document.createElement('div');
    countEl.style.cssText = 'font-size: 16px; font-weight: 900; color: #333;';
    countEl.innerHTML = `<span style="color:#00838F;">${count}</span> 重生`;
    leftCol.appendChild(countEl);

    const costEl = document.createElement('div');
    costEl.style.cssText = 'font-size: 13px; color: #888; font-weight: bold;';
    costEl.textContent = `${formatSpeedLevel(cost)} 能量`;
    leftCol.appendChild(costEl);

    row.appendChild(leftCol);

    // 右侧：按钮
    const btn = this.createGreenButton(btnLabel, canAfford, isMaxRow);
    if (canAfford) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.doRebirth(count);
      });
    }
    row.appendChild(btn);

    return row;
  }

  /**
   * 速度不足时的"最大"行（禁用）
   */
  private createDisabledMaxRow(speedLevel: number): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex; align-items: center; justify-content: space-between;
      background: #F5F5F5; border: 3px solid #DDD;
      border-radius: 14px; padding: 12px 16px;
    `;

    const leftCol = document.createElement('div');
    leftCol.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';

    const countEl = document.createElement('div');
    countEl.style.cssText = 'font-size: 16px; font-weight: 900; color: #999;';
    countEl.textContent = '0 重生';
    leftCol.appendChild(countEl);

    const costEl = document.createElement('div');
    costEl.style.cssText = 'font-size: 13px; color: #BBB; font-weight: bold;';
    costEl.textContent = `当前: ${formatSpeedLevel(speedLevel)} 能量（不足 ${REBIRTH_COST}）`;
    leftCol.appendChild(costEl);

    row.appendChild(leftCol);

    const btn = this.createGreenButton('最大', false, true);
    row.appendChild(btn);

    return row;
  }

  /**
   * 创建绿色渐变按钮
   */
  private createGreenButton(text: string, enabled: boolean, large: boolean): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;

    const height = large ? '42px' : '36px';
    const fontSize = large ? '18px' : '15px';
    const padding = large ? '0 28px' : '0 20px';

    if (enabled) {
      btn.style.cssText = `
        height: ${height}; padding: ${padding};
        background: linear-gradient(180deg, #66BB6A 0%, #43A047 50%, #388E3C 100%);
        color: #FFF; border: 3px solid #2E7D32;
        border-radius: 12px; font-size: ${fontSize}; font-weight: 900;
        cursor: pointer; font-family: ${FONT};
        box-shadow: 0 4px 0 #1B5E20;
        text-shadow: 1px 1px 0 rgba(0,0,0,0.3);
        transition: transform 0.1s;
        flex-shrink: 0;
      `;
      btn.addEventListener('mousedown', () => {
        btn.style.transform = 'translateY(2px)';
        btn.style.boxShadow = '0 2px 0 #1B5E20';
      });
      btn.addEventListener('mouseup', () => {
        btn.style.transform = '';
        btn.style.boxShadow = '0 4px 0 #1B5E20';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
        btn.style.boxShadow = '0 4px 0 #1B5E20';
      });
    } else {
      btn.style.cssText = `
        height: ${height}; padding: ${padding};
        background: #CCC; color: #999;
        border: 3px solid #AAA; border-radius: 12px;
        font-size: ${fontSize}; font-weight: 900;
        cursor: default; font-family: ${FONT};
        box-shadow: 0 3px 0 #999;
        flex-shrink: 0;
      `;
    }

    return btn;
  }

  // ---- 自动重生行 ----
  private createAutoRebirthRow(): HTMLDivElement {
    const row = document.createElement('div');
    row.id = 'rebirth-auto-row';
    row.style.cssText = `
      display: flex; justify-content: center; align-items: center; gap: 12px;
      padding: 12px 20px; border-top: 2px solid #EEE;
      background: #FAFAFA;
    `;

    const progress = getPlayerProgress();
    const unlocked = progress.isAutoRebirthUnlocked;

    const btn = document.createElement('button');
    btn.textContent = '自动重生';
    btn.style.cssText = `
      padding: 8px 24px;
      background: ${unlocked ? 'linear-gradient(180deg, #42A5F5 0%, #1E88E5 100%)' : 'linear-gradient(180deg, #546E7A 0%, #37474F 100%)'};
      color: #FFF; border: 3px solid ${unlocked ? '#1565C0' : '#263238'};
      border-radius: 12px; font-size: 15px; font-weight: 900;
      cursor: ${unlocked ? 'default' : 'pointer'};
      font-family: ${FONT}; box-shadow: 0 3px 0 ${unlocked ? '#0D47A1' : '#1a1a1a'};
      text-shadow: 1px 1px 0 rgba(0,0,0,0.3);
      transition: transform 0.1s;
    `;

    if (unlocked) {
      // 已解锁 — 显示已激活状态
      const statusEl = document.createElement('span');
      statusEl.textContent = '已激活 ✓';
      statusEl.style.cssText = 'font-size: 14px; font-weight: 900; color: #43A047;';
      row.appendChild(btn);
      row.appendChild(statusEl);
    } else {
      // 未解锁 — 显示奖杯价格
      const canAfford = progress.totalTrophies >= AUTO_REBIRTH_TROPHY_COST;

      if (!canAfford) {
        btn.style.background = 'linear-gradient(180deg, #9E9E9E 0%, #757575 100%)';
        btn.style.borderColor = '#616161';
        btn.style.boxShadow = '0 3px 0 #424242';
        btn.style.cursor = 'default';
      }

      btn.addEventListener('mousedown', () => {
        if (canAfford) btn.style.transform = 'translateY(2px)';
      });
      btn.addEventListener('mouseup', () => {
        btn.style.transform = '';
      });
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!canAfford) return;
        if (progress.unlockAutoRebirth(AUTO_REBIRTH_TROPHY_COST)) {
          this.refreshUI();
        }
      });

      const priceEl = document.createElement('span');
      priceEl.innerHTML = `\u{1F3C6} ${AUTO_REBIRTH_TROPHY_COST}`;
      priceEl.style.cssText = `
        font-size: 15px; font-weight: 900;
        color: ${canAfford ? '#F57C00' : '#999'};
      `;

      row.appendChild(btn);
      row.appendChild(priceEl);
    }

    return row;
  }

  // ============ 重生执行 ============

  private doRebirth(count: number): void {
    const progress = getPlayerProgress();
    const actual = progress.performRebirth(count, REBIRTH_COST);
    if (actual > 0) {
      this.refreshUI();
      this.showRebirthEffect(actual);
    }
  }

  /**
   * 重生成功后的简短反馈动效
   */
  private showRebirthEffect(count: number): void {
    if (!this.overlay) return;

    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 188, 212, 0.25); z-index: 9999;
      pointer-events: none;
      animation: rebirthFlash 0.5s ease-out forwards;
    `;

    // 注入动画样式（只注入一次）
    if (!document.getElementById('rebirth-anim-style')) {
      const style = document.createElement('style');
      style.id = 'rebirth-anim-style';
      style.textContent = `
        @keyframes rebirthFlash {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes rebirthTextPop {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
          50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(flash);

    // 中央弹出文字
    const text = document.createElement('div');
    text.textContent = `+${count} 重生!`;
    text.style.cssText = `
      position: fixed; top: 45%; left: 50%;
      transform: translate(-50%, -50%);
      font-size: 36px; font-weight: 900; color: #00BCD4;
      text-shadow: 2px 2px 0 #000, -1px -1px 0 #000;
      z-index: 10000; pointer-events: none;
      font-family: ${FONT};
      animation: rebirthTextPop 0.8s ease-out forwards;
    `;
    document.body.appendChild(text);

    setTimeout(() => {
      flash.remove();
      text.remove();
    }, 1000);
  }

  // ============ 刷新 ============

  private refreshUI(): void {
    if (!this.overlay) return;

    // 重建选项列表
    const container = this.overlay.querySelector('#rebirth-list-container') as HTMLDivElement;
    if (container) {
      this.populateOptions(container);
    }

    // 重建自动重生行
    const autoRow = this.overlay.querySelector('#rebirth-auto-row') as HTMLDivElement;
    if (autoRow) {
      const newRow = this.createAutoRebirthRow();
      autoRow.replaceWith(newRow);
    }
  }
}
