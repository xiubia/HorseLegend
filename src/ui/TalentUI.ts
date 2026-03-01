/**
 * 天赋面板 — 列表式模态 UI
 * 参照截图：左侧图标 + 中间名称/数值 + 右侧费用/升级按钮
 * UI 风格匹配游戏 Roblox 卡通风格
 */

import { getAllTalents, getTalentCost, getTalentValue, TalentDef } from '../data/TalentRegistry';
import { getPlayerProgress } from '../data/PlayerProgress';

const FONT = "'Arial Rounded MT Bold', 'Nunito', sans-serif";

export class TalentUI {
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

  // ============ UI 构建 ============

  private createPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.style.cssText = `
      background: #FFF9E6; color: #333; border-radius: 20px;
      padding: 0; width: 440px; max-width: 95vw; max-height: 80vh;
      border: 4px solid #000; box-shadow: 0 8px 0 #000;
      font-family: ${FONT}; display: flex; flex-direction: column;
      overflow: hidden;
    `;

    // 标题栏
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 20px; background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
      border-bottom: 3px solid #000;
    `;

    const title = document.createElement('div');
    title.innerHTML = '<span style="font-size:20px;">⚡</span> 天赋';
    title.style.cssText = `
      font-size: 22px; font-weight: 900; color: #000;
      text-shadow: 1px 1px 0 rgba(255,255,255,0.5);
    `;

    // 奖杯余额
    const trophyInfo = document.createElement('div');
    const progress = getPlayerProgress();
    trophyInfo.id = 'talent-trophy-info';
    trophyInfo.innerHTML = `🏆 ${progress.totalTrophies}`;
    trophyInfo.style.cssText = `
      font-size: 16px; font-weight: bold; color: #000;
      background: rgba(255,255,255,0.5); padding: 4px 12px;
      border-radius: 10px; border: 2px solid #000;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = `
      width: 36px; height: 36px; border: 3px solid #000;
      background: #FF6B6B; color: #fff; border-radius: 50%;
      font-size: 16px; font-weight: bold; cursor: pointer;
      box-shadow: 0 3px 0 #000; font-family: ${FONT};
      margin-left: 10px;
    `;
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });

    header.appendChild(title);
    const rightGroup = document.createElement('div');
    rightGroup.style.cssText = 'display: flex; align-items: center; gap: 8px;';
    rightGroup.appendChild(trophyInfo);
    rightGroup.appendChild(closeBtn);
    header.appendChild(rightGroup);
    panel.appendChild(header);

    // 列表容器（可滚动）
    const listContainer = document.createElement('div');
    listContainer.id = 'talent-list-container';
    listContainer.style.cssText = `
      flex: 1; overflow-y: auto; padding: 10px 14px;
      display: flex; flex-direction: column; gap: 8px;
    `;

    this.populateList(listContainer);
    panel.appendChild(listContainer);

    return panel;
  }

  private populateList(container: HTMLDivElement): void {
    container.innerHTML = '';
    const progress = getPlayerProgress();
    const talents = getAllTalents();

    for (const talent of talents) {
      const row = this.createTalentRow(talent, progress.getTalentLevel(talent.id));
      container.appendChild(row);
    }
  }

  private createTalentRow(talent: TalentDef, currentLevel: number): HTMLDivElement {
    const progress = getPlayerProgress();
    const isMaxed = currentLevel >= talent.maxLevel;
    const cost = isMaxed ? -1 : getTalentCost(talent.id, currentLevel);
    const canAfford = !isMaxed && progress.totalTrophies >= cost;

    const currentValue = getTalentValue(talent.id, currentLevel);
    const nextValue = isMaxed ? currentValue : getTalentValue(talent.id, currentLevel + 1);

    const row = document.createElement('div');
    row.style.cssText = `
      display: flex; align-items: center; gap: 10px;
      background: #FFFFFF; border: 3px solid #DDD; border-radius: 14px;
      padding: 10px 14px; transition: all 0.15s;
    `;

    // 左：图标
    const iconEl = document.createElement('div');
    iconEl.style.cssText = `
      width: 48px; height: 48px; border: 3px solid #000;
      border-radius: 12px; background: #F5F5F5;
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; flex-shrink: 0;
    `;
    iconEl.textContent = talent.icon;
    row.appendChild(iconEl);

    // 中：名称 + 数值
    const infoEl = document.createElement('div');
    infoEl.style.cssText = 'flex: 1; min-width: 0;';

    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-size: 15px; font-weight: 900; color: #000;';
    nameEl.textContent = talent.name;
    infoEl.appendChild(nameEl);

    const valueEl = document.createElement('div');
    valueEl.style.cssText = 'font-size: 13px; color: #666; font-weight: bold;';
    if (isMaxed) {
      valueEl.innerHTML = `<span style="color:#2ECC40;">${currentValue}${talent.unit}（已满级）</span>`;
    } else {
      valueEl.innerHTML = `${currentValue}${talent.unit} <span style="color:#FF9F43; font-weight:900;">>></span> ${nextValue}${talent.unit}`;
    }
    infoEl.appendChild(valueEl);
    row.appendChild(infoEl);

    // 右：费用 + 按钮
    const actionEl = document.createElement('div');
    actionEl.style.cssText = 'display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0;';

    if (!isMaxed) {
      const costEl = document.createElement('div');
      costEl.style.cssText = `font-size: 13px; font-weight: bold; color: ${canAfford ? '#000' : '#999'};`;
      costEl.innerHTML = `🏆 ${cost}`;
      actionEl.appendChild(costEl);
    }

    const btn = document.createElement('button');
    if (isMaxed) {
      btn.textContent = '已满';
      btn.style.cssText = `
        padding: 6px 16px; border: 2px solid #999; border-radius: 10px;
        background: #DDD; color: #999; font-size: 13px; font-weight: 900;
        cursor: default; font-family: ${FONT}; box-shadow: 0 2px 0 #999;
      `;
    } else {
      btn.textContent = '升级';
      const bgColor = canAfford ? '#4CAF50' : '#CCCCCC';
      const borderColor = canAfford ? '#333' : '#999';
      btn.style.cssText = `
        padding: 6px 16px; border: 2px solid ${borderColor}; border-radius: 10px;
        background: ${bgColor}; color: ${canAfford ? '#FFF' : '#999'};
        font-size: 13px; font-weight: 900; cursor: ${canAfford ? 'pointer' : 'default'};
        font-family: ${FONT}; box-shadow: 0 2px 0 ${borderColor};
        transition: transform 0.1s;
      `;

      if (canAfford) {
        btn.addEventListener('mousedown', () => { btn.style.transform = 'translateY(1px)'; });
        btn.addEventListener('mouseup', () => { btn.style.transform = ''; });
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (progress.upgradeTalent(talent.id, cost)) {
            this.refreshUI();
          }
        });
      }
    }
    actionEl.appendChild(btn);
    row.appendChild(actionEl);

    return row;
  }

  // ============ 刷新 ============

  private refreshUI(): void {
    if (!this.overlay) return;

    // 更新奖杯余额
    const trophyInfo = this.overlay.querySelector('#talent-trophy-info');
    if (trophyInfo) {
      const progress = getPlayerProgress();
      trophyInfo.innerHTML = `🏆 ${progress.totalTrophies}`;
    }

    // 重建列表
    const container = this.overlay.querySelector('#talent-list-container') as HTMLDivElement;
    if (container) {
      this.populateList(container);
    }
  }
}
