/**
 * 训练师选择面板 — 全屏模态 UI
 * 左侧 4 列网格浏览 + 右侧 3D 预览 + 属性面板 + 解锁按钮
 * 训练师为收集型系统：购买后永久生效，所有已拥有训练师的加成叠加
 * UI 风格匹配游戏 Roblox 卡通风格，布局参考赛马类手游训练师面板
 */

import * as THREE from 'three';
import { getAllTrainers, getTrainerById, getTotalTrainerBonuses, formatTrainerCost, TrainerDef } from '../data/TrainerRegistry';
import { getPlayerProgress } from '../data/PlayerProgress';

const FONT = "'Arial Rounded MT Bold', 'Nunito', sans-serif";

export class TrainerUI {
  private overlay: HTMLDivElement | null = null;
  private isOpen = false;
  private selectedTrainerId: string = '';

  // 3D 预览
  private previewRenderer: THREE.WebGLRenderer | null = null;
  private previewScene: THREE.Scene | null = null;
  private previewCamera: THREE.PerspectiveCamera | null = null;
  private previewMesh: THREE.Object3D | null = null;
  private previewAnimId: number = 0;
  private previewRotation: number = 0;

  // 回调
  private onEquipCallback: ((trainerId: string) => void) | null = null;

  onEquip(cb: (trainerId: string) => void) {
    this.onEquipCallback = cb;
  }

  show(): void {
    if (this.isOpen) return;
    this.isOpen = true;

    // 默认选中第一个训练师
    const trainers = getAllTrainers();
    this.selectedTrainerId = trainers[0].id;

    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.55); z-index: 9500;
      display: flex; justify-content: center; align-items: center;
    `;

    // 阻止事件穿透
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

    // 启动 3D 预览
    this.startPreview();
    this.updatePreviewModel();
  }

  hide(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.stopPreview();
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
      width: 820px; max-width: 95vw; max-height: 85vh;
      border: 4px solid #000; box-shadow: 0 8px 0 #000;
      font-family: ${FONT}; display: flex; flex-direction: column;
      overflow: hidden;
    `;

    // 标题栏（深色背景）
    panel.appendChild(this.createHeader());

    // 主体区域：左侧网格 + 右侧预览
    const body = document.createElement('div');
    body.style.cssText = `
      display: flex; gap: 16px; flex: 1; overflow: hidden;
      padding: 16px 20px;
    `;

    body.appendChild(this.createLeftGrid());
    body.appendChild(this.createRightPreview());

    panel.appendChild(body);
    return panel;
  }

  private createHeader(): HTMLDivElement {
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 20px;
      background: linear-gradient(90deg, #3D3D3D, #555555);
      border-bottom: 3px solid #000;
    `;

    // 左侧标签 + 说明
    const leftGroup = document.createElement('div');
    leftGroup.style.cssText = `display: flex; align-items: center; gap: 12px;`;

    const titleBadge = document.createElement('div');
    titleBadge.textContent = '\u{1F3C7} \u8BAD\u7EC3\u5E08';
    titleBadge.style.cssText = `
      background: #FF9800; color: #000; font-size: 16px; font-weight: 900;
      padding: 4px 14px; border-radius: 8px; border: 2px solid #000;
      font-family: ${FONT};
    `;

    const desc = document.createElement('div');
    desc.textContent = '\u8BAD\u7EC3\u5E08\u5C5E\u6027\u83B7\u53D6\u5373\u62E5\u6709\uFF0C\u65E0\u8BBA\u662F\u5426\u4E0A\u573A';
    desc.style.cssText = `
      color: #FFF; font-size: 13px; font-weight: bold;
      font-family: ${FONT};
    `;

    leftGroup.appendChild(titleBadge);
    leftGroup.appendChild(desc);

    // 关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '\u2715';
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

    header.appendChild(leftGroup);
    header.appendChild(closeBtn);
    return header;
  }

  private createLeftGrid(): HTMLDivElement {
    const left = document.createElement('div');
    left.id = 'trainer-grid-container';
    left.style.cssText = `
      flex: 0 0 420px; overflow-y: auto; overflow-x: hidden;
      padding-right: 8px;
    `;

    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid; grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    `;

    const progress = getPlayerProgress();
    const equippedId = progress.getEquippedTrainer();
    for (const trainer of getAllTrainers()) {
      const card = this.createTrainerCard(trainer, progress.isTrainerUnlocked(trainer.id), equippedId);
      grid.appendChild(card);
    }

    left.appendChild(grid);

    // 底部加成总计
    left.appendChild(this.createBonusSummary());

    return left;
  }

  private createTrainerCard(trainer: TrainerDef, unlocked: boolean, equippedId: string): HTMLDivElement {
    const card = document.createElement('div');
    const isSelected = trainer.id === this.selectedTrainerId;
    const isEquipped = trainer.id === equippedId;

    card.style.cssText = `
      border: 3px solid ${isEquipped ? '#FF9800' : (isSelected ? '#FFD700' : (unlocked ? '#4CAF50' : '#888'))};
      border-radius: 12px; cursor: pointer;
      background: ${isEquipped ? '#FFF3E0' : (isSelected ? '#FFF3D0' : (unlocked ? '#FFFFFF' : '#D5D5D5'))};
      box-shadow: ${isSelected ? '0 0 10px rgba(255,215,0,0.7)' : (isEquipped ? '0 0 8px rgba(255,152,0,0.5)' : '0 2px 0 #999')};
      transition: all 0.15s; text-align: center;
      position: relative; min-height: 110px;
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 2px;
      padding: 8px 4px;
    `;

    // 训练师缩略图（简单色块代表）
    const thumb = document.createElement('div');
    thumb.style.cssText = `
      width: 50px; height: 50px; border-radius: 10px;
      background: linear-gradient(135deg, ${trainer.bodyColor} 55%, ${trainer.accentColor} 100%);
      border: 2px solid #000; margin-bottom: 2px;
      position: relative;
    `;

    // 未解锁 → 灰色 + 锁头图标
    if (!unlocked) {
      thumb.style.filter = 'grayscale(80%)';
      thumb.style.opacity = '0.6';

      const lock = document.createElement('div');
      lock.textContent = '\u{1F512}';
      lock.style.cssText = `
        position: absolute; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        font-size: 22px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));
      `;
      thumb.appendChild(lock);
    }

    card.appendChild(thumb);

    // 名称
    const nameEl = document.createElement('div');
    nameEl.textContent = trainer.name;
    nameEl.style.cssText = `
      font-size: 12px; font-weight: bold; color: #000;
    `;
    card.appendChild(nameEl);

    // 状态/价格
    const statusEl = document.createElement('div');
    if (isEquipped) {
      statusEl.textContent = '\u{1F3C7} \u5DF2\u4E0A\u573A';
      statusEl.style.cssText = `font-size: 11px; font-weight: bold; color: #FF9800;`;
    } else if (unlocked) {
      statusEl.textContent = '\u2705 \u5DF2\u62E5\u6709';
      statusEl.style.cssText = `font-size: 11px; font-weight: bold; color: #4CAF50;`;
    } else {
      statusEl.innerHTML = `\u{1F512} \u{1F3C6}${formatTrainerCost(trainer.unlockCost)}`;
      statusEl.style.cssText = `
        font-size: 11px; font-weight: bold; color: #888;
        display: flex; align-items: center; gap: 2px; justify-content: center;
      `;
    }
    card.appendChild(statusEl);

    card.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectedTrainerId = trainer.id;
      this.refreshUI();
      this.updatePreviewModel();
    });

    return card;
  }

  private createBonusSummary(): HTMLDivElement {
    const summary = document.createElement('div');
    summary.id = 'trainer-bonus-summary';
    summary.style.cssText = `
      margin-top: 12px; padding: 10px 14px;
      background: linear-gradient(135deg, #FFF8E1, #FFFDE7);
      border: 2px solid #FFD700; border-radius: 12px;
      font-size: 13px; font-weight: bold;
    `;

    this.updateBonusSummaryContent(summary);
    return summary;
  }

  private updateBonusSummaryContent(el?: HTMLDivElement): void {
    const summary = el || (this.overlay?.querySelector('#trainer-bonus-summary') as HTMLDivElement);
    if (!summary) return;

    const progress = getPlayerProgress();
    const bonuses = getTotalTrainerBonuses(progress.getUnlockedTrainers());
    const ownedCount = progress.getUnlockedTrainers().length;
    const totalCount = getAllTrainers().length;

    summary.innerHTML = `
      <div style="color: #666; margin-bottom: 4px;">\u5DF2\u62E5\u6709: ${ownedCount}/${totalCount} \u4E2A\u8BAD\u7EC3\u5E08</div>
      <div style="display: flex; gap: 16px;">
        <span style="color: #FF9800;">\u{1F4B0} \u91D1\u5E01\u52A0\u6210: +${bonuses.totalCoinBonus}%</span>
        <span style="color: #4CAF50;">\u26A1 \u8BAD\u7EC3\u52A0\u6210: +${bonuses.totalTrainingBonus}%</span>
      </div>
    `;
  }

  private createRightPreview(): HTMLDivElement {
    const right = document.createElement('div');
    right.id = 'trainer-preview-container';
    right.style.cssText = `
      flex: 1; display: flex; flex-direction: column;
      align-items: center; gap: 10px;
    `;

    // 3D 预览画布
    const canvasWrap = document.createElement('div');
    canvasWrap.id = 'trainer-preview-canvas-wrap';
    canvasWrap.style.cssText = `
      width: 100%; height: 220px;
      border: 3px solid #000; border-radius: 14px;
      background: linear-gradient(180deg, #87CEEB 0%, #E0F0FF 60%, #FFF8E1 100%);
      overflow: hidden; position: relative;
    `;
    right.appendChild(canvasWrap);

    // 属性面板
    const statsPanel = document.createElement('div');
    statsPanel.id = 'trainer-stats-panel';
    statsPanel.style.cssText = `
      width: 100%; background: #FFF; border: 3px solid #000;
      border-radius: 14px; padding: 12px 16px;
    `;
    right.appendChild(statsPanel);

    // 操作按钮
    const actionDiv = document.createElement('div');
    actionDiv.id = 'trainer-action-div';
    actionDiv.style.cssText = `
      width: 100%; display: flex; justify-content: center; align-items: center;
    `;
    right.appendChild(actionDiv);

    // 延迟填充内容
    requestAnimationFrame(() => {
      this.updateStatsPanel();
      this.updateActionButton();
    });

    return right;
  }

  // ============ 刷新 UI ============

  private refreshUI(): void {
    if (!this.overlay) return;

    // 重建左侧网格
    const gridContainer = this.overlay.querySelector('#trainer-grid-container');
    if (gridContainer) {
      gridContainer.innerHTML = '';
      const grid = document.createElement('div');
      grid.style.cssText = `
        display: grid; grid-template-columns: repeat(4, 1fr);
        gap: 10px;
      `;
      const progress = getPlayerProgress();
      const equippedId = progress.getEquippedTrainer();
      for (const trainer of getAllTrainers()) {
        const card = this.createTrainerCard(trainer, progress.isTrainerUnlocked(trainer.id), equippedId);
        grid.appendChild(card);
      }
      gridContainer.appendChild(grid);

      // 重建加成总计
      const summaryEl = this.createBonusSummary();
      gridContainer.appendChild(summaryEl);
    }

    this.updateStatsPanel();
    this.updateActionButton();
  }

  private updateStatsPanel(): void {
    if (!this.overlay) return;
    const panel = this.overlay.querySelector('#trainer-stats-panel') as HTMLDivElement;
    if (!panel) return;

    const trainer = getTrainerById(this.selectedTrainerId);

    panel.innerHTML = `
      <div style="font-size: 20px; font-weight: 900; color: #000; margin-bottom: 10px; text-align: center;">
        ${trainer.name}
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin: 8px 0; padding: 6px 12px; background: #FFF8E1; border-radius: 8px;">
        <span style="font-size: 14px; font-weight: bold; color: #555;">\u{1F4B0} \u91D1\u5E01\u83B7\u53D6\uFF1A</span>
        <span style="font-size: 18px; font-weight: 900; color: #FF9800;">${trainer.coinBonus}%</span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin: 8px 0; padding: 6px 12px; background: #E8F5E9; border-radius: 8px;">
        <span style="font-size: 14px; font-weight: bold; color: #555;">\u26A1 \u8BAD\u7EC3\u52A0\u6210\uFF1A</span>
        <span style="font-size: 18px; font-weight: 900; color: #4CAF50;">${trainer.trainingBonus}%</span>
      </div>
    `;
  }

  private updateActionButton(): void {
    if (!this.overlay) return;
    const actionDiv = this.overlay.querySelector('#trainer-action-div') as HTMLDivElement;
    if (!actionDiv) return;
    actionDiv.innerHTML = '';

    const progress = getPlayerProgress();
    const trainer = getTrainerById(this.selectedTrainerId);
    const unlocked = progress.isTrainerUnlocked(trainer.id);
    const isEquipped = progress.getEquippedTrainer() === trainer.id;

    if (unlocked && isEquipped) {
      // 已上场 → 显示"下场"按钮
      const btn = this.createActionBtn('\u{1F3C7} \u5DF2\u4E0A\u573A', '#FF9800', true);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        progress.unequipTrainer();
        if (this.onEquipCallback) this.onEquipCallback('');
        this.refreshUI();
      });
      actionDiv.appendChild(btn);
    } else if (unlocked) {
      // 已解锁但未上场 → 显示"上场"按钮
      const btn = this.createActionBtn('\u{1F3C7} \u4E0A\u573A', '#54A0FF', true);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        progress.equipTrainer(trainer.id);
        if (this.onEquipCallback) this.onEquipCallback(trainer.id);
        this.refreshUI();
        this.updatePreviewModel();
      });
      actionDiv.appendChild(btn);
    } else {
      const canAfford = progress.totalTrophies >= trainer.unlockCost;
      const btn = this.createActionBtn(
        `\u89E3\u9501 \u{1F3C6}${formatTrainerCost(trainer.unlockCost)}`,
        canAfford ? '#FECA57' : '#CCCCCC',
        canAfford
      );
      if (canAfford) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (progress.unlockTrainer(trainer.id, trainer.unlockCost)) {
            this.refreshUI();
          }
        });
      }

      // 显示当前奖杯数
      const trophyInfo = document.createElement('div');
      trophyInfo.style.cssText = `
        font-size: 12px; color: ${canAfford ? '#2ECC40' : '#FF6B6B'}; margin-left: 12px;
        display: flex; align-items: center; font-weight: bold;
      `;
      trophyInfo.textContent = `\u5F53\u524D: \u{1F3C6}${progress.totalTrophies}`;

      actionDiv.appendChild(btn);
      actionDiv.appendChild(trophyInfo);
    }
  }

  private createActionBtn(text: string, bg: string, enabled: boolean): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      padding: 10px 32px; border: 3px solid #000; border-radius: 12px;
      background: ${bg}; color: #000; font-size: 16px; font-weight: 900;
      cursor: ${enabled ? 'pointer' : 'default'};
      box-shadow: 0 4px 0 #000; font-family: ${FONT};
      opacity: ${enabled ? '1' : '0.6'};
      transition: transform 0.1s;
    `;
    if (enabled) {
      btn.addEventListener('mousedown', () => { btn.style.transform = 'translateY(2px)'; });
      btn.addEventListener('mouseup', () => { btn.style.transform = ''; });
    }
    return btn;
  }

  // ============ 3D 预览 ============

  private startPreview(): void {
    if (!this.overlay) return;
    const canvasWrap = this.overlay.querySelector('#trainer-preview-canvas-wrap') as HTMLDivElement;
    if (!canvasWrap) return;

    const w = canvasWrap.clientWidth || 300;
    const h = canvasWrap.clientHeight || 220;

    this.previewScene = new THREE.Scene();
    this.previewScene.background = null; // 透明，使用 CSS 渐变

    // 灯光
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.previewScene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(3, 5, 3);
    this.previewScene.add(dir);

    // 相机
    this.previewCamera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
    this.previewCamera.position.set(0, 2.5, 6);
    this.previewCamera.lookAt(0, 1.0, 0);

    // 渲染器
    this.previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.previewRenderer.setSize(w, h);
    this.previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    canvasWrap.appendChild(this.previewRenderer.domElement);
    this.previewRenderer.domElement.style.cssText = 'width:100%; height:100%; display:block;';

    // 金色圆盘底座
    const floorGeo = new THREE.CylinderGeometry(1.8, 2.0, 0.15, 32);
    const floorMat = new THREE.MeshToonMaterial({ color: 0xDAA520 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.075;
    this.previewScene.add(floor);

    // 底座边缘装饰环
    const ringGeo = new THREE.TorusGeometry(1.9, 0.06, 8, 48);
    const ringMat = new THREE.MeshToonMaterial({ color: 0xFFD700 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.0;
    this.previewScene.add(ring);

    this.previewRotation = 0;
    this.animatePreview();
  }

  private animatePreview = (): void => {
    this.previewAnimId = requestAnimationFrame(this.animatePreview);
    if (!this.previewRenderer || !this.previewScene || !this.previewCamera) return;

    this.previewRotation += 0.008;
    if (this.previewMesh) {
      this.previewMesh.rotation.y = this.previewRotation;
    }

    this.previewRenderer.render(this.previewScene, this.previewCamera);
  };

  private stopPreview(): void {
    cancelAnimationFrame(this.previewAnimId);
    if (this.previewRenderer) {
      this.previewRenderer.dispose();
      this.previewRenderer = null;
    }
    this.previewScene = null;
    this.previewCamera = null;
    this.previewMesh = null;
  }

  private updatePreviewModel(): void {
    if (!this.previewScene) return;

    // 移除旧模型
    if (this.previewMesh) {
      this.previewScene.remove(this.previewMesh);
      this.previewMesh = null;
    }

    const trainer = getTrainerById(this.selectedTrainerId);
    const mesh = this.createTrainerModel(trainer);
    mesh.position.set(0, 0, 0);
    mesh.rotation.y = this.previewRotation;

    this.previewMesh = mesh;
    this.previewScene.add(mesh);
  }

  // ============ 程序化训练师模型 ============

  /**
   * 用 Three.js 基础几何体拼装 Roblox 风格的人形角色
   */
  private createTrainerModel(trainer: TrainerDef): THREE.Group {
    const group = new THREE.Group();
    const bodyColor = new THREE.Color(trainer.bodyColor);
    const accentColor = new THREE.Color(trainer.accentColor);

    // 头部（方块）
    const headGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
    const headMat = new THREE.MeshToonMaterial({ color: 0xFFDBAC }); // 肤色
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 2.35;
    group.add(head);

    // 眼睛
    const eyeGeo = new THREE.BoxGeometry(0.12, 0.1, 0.05);
    const eyeMat = new THREE.MeshToonMaterial({ color: 0x222222 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.15, 2.4, 0.36);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.15, 2.4, 0.36);
    group.add(rightEye);

    // 帽子（训练师标志性配饰）
    const hatBrimGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.06, 16);
    const hatMat = new THREE.MeshToonMaterial({ color: accentColor });
    const hatBrim = new THREE.Mesh(hatBrimGeo, hatMat);
    hatBrim.position.y = 2.72;
    group.add(hatBrim);

    const hatTopGeo = new THREE.CylinderGeometry(0.32, 0.38, 0.3, 16);
    const hatTop = new THREE.Mesh(hatTopGeo, hatMat);
    hatTop.position.y = 2.87;
    group.add(hatTop);

    // 身体（躯干）
    const bodyGeo = new THREE.BoxGeometry(0.8, 1.0, 0.5);
    const bodyMat = new THREE.MeshToonMaterial({ color: bodyColor });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.5;
    group.add(body);

    // 领巾/装饰（点缀色）
    const collarGeo = new THREE.BoxGeometry(0.82, 0.12, 0.52);
    const collarMat = new THREE.MeshToonMaterial({ color: accentColor });
    const collar = new THREE.Mesh(collarGeo, collarMat);
    collar.position.y = 1.96;
    group.add(collar);

    // 左臂
    const armGeo = new THREE.CylinderGeometry(0.15, 0.13, 0.8, 8);
    const armMat = new THREE.MeshToonMaterial({ color: bodyColor });
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.55, 1.5, 0);
    leftArm.rotation.z = 0.15;
    group.add(leftArm);

    // 右臂
    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.55, 1.5, 0);
    rightArm.rotation.z = -0.15;
    group.add(rightArm);

    // 左腿
    const legGeo = new THREE.CylinderGeometry(0.16, 0.14, 0.9, 8);
    const legMat = new THREE.MeshToonMaterial({ color: 0x3E2723 }); // 深棕色裤子
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.2, 0.55, 0);
    group.add(leftLeg);

    // 右腿
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.2, 0.55, 0);
    group.add(rightLeg);

    // 靴子
    const bootGeo = new THREE.BoxGeometry(0.22, 0.15, 0.3);
    const bootMat = new THREE.MeshToonMaterial({ color: 0x1A1A1A });
    const leftBoot = new THREE.Mesh(bootGeo, bootMat);
    leftBoot.position.set(-0.2, 0.1, 0.03);
    group.add(leftBoot);
    const rightBoot = new THREE.Mesh(bootGeo, bootMat);
    rightBoot.position.set(0.2, 0.1, 0.03);
    group.add(rightBoot);

    return group;
  }
}
