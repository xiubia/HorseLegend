/**
 * 宠物抽蛋面板 — 全屏模态 UI
 * 参考图片1：概率展示网格 + 底部抽取按钮
 * 参考图片2：抽取结果展示
 */

import * as THREE from 'three';
import {
  getAllPets, getPetById, getPetRarityColor, getPetRarityLabel,
  GACHA_COST_SINGLE, GACHA_COST_MULTI, GACHA_MULTI_COUNT,
  rollGacha, rollGachaMulti, PetDef, PET_MAX_OWNED,
} from '../data/PetRegistry';
import { getPlayerProgress } from '../data/PlayerProgress';
import { Pet } from '../entities/Pet';

const FONT = "'Arial Rounded MT Bold', 'Nunito', sans-serif";

export class PetGachaUI {
  /** 共享离屏渲染器 — 所有 mini 预览复用同一个，避免创建过多 WebGL 上下文 */
  private static sharedMiniRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

  private overlay: HTMLDivElement | null = null;
  isOpen = false;

  // 3D 预览（结果展示用）
  private previewRenderer: THREE.WebGLRenderer | null = null;
  private previewScene: THREE.Scene | null = null;
  private previewCamera: THREE.PerspectiveCamera | null = null;
  private previewMesh: THREE.Object3D | null = null;
  private previewAnimId: number = 0;
  private previewRotation: number = 0;

  // 回调
  private onGachaCallback: (() => void) | null = null;

  /** 抽取后回调（刷新场景宠物跟随等） */
  onGacha(cb: () => void) {
    this.onGachaCallback = cb;
  }

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
    this.stopPreview();
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  dispose(): void {
    this.hide();
  }

  // ============ 主面板 ============

  private createPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.style.cssText = `
      background: #FFF9E6; color: #333; border-radius: 20px;
      width: 680px; max-width: 95vw; max-height: 85vh;
      border: 4px solid #000; box-shadow: 0 8px 0 #000;
      font-family: ${FONT}; display: flex; flex-direction: column;
      overflow: hidden;
    `;

    // 标题栏
    panel.appendChild(this.createHeader());

    // 概率展示区
    panel.appendChild(this.createOddsGrid());

    // 底部按钮区
    panel.appendChild(this.createActions());

    return panel;
  }

  private createHeader(): HTMLDivElement {
    const header = document.createElement('div');
    header.style.cssText = `
      background: #333; color: #fff; padding: 12px 20px;
      display: flex; justify-content: space-between; align-items: center;
      border-radius: 16px 16px 0 0;
    `;

    const titleWrap = document.createElement('div');
    titleWrap.style.cssText = 'display: flex; align-items: center; gap: 10px;';

    // 蛋图标
    const eggIcon = document.createElement('span');
    eggIcon.style.cssText = `
      display: inline-block; width: 32px; height: 40px;
      background: linear-gradient(135deg, #9B59B6, #E74C3C, #F1C40F);
      border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
    `;
    titleWrap.appendChild(eggIcon);

    const title = document.createElement('span');
    title.textContent = '抽蛋';
    title.style.cssText = 'font-size: 22px; font-weight: 900;';
    titleWrap.appendChild(title);

    header.appendChild(titleWrap);

    // 关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = `
      width: 36px; height: 36px; border: 3px solid #FFF;
      background: #FF6B6B; color: #fff; border-radius: 50%;
      font-size: 16px; font-weight: bold; cursor: pointer;
      box-shadow: 0 3px 0 rgba(0,0,0,0.3); font-family: ${FONT};
    `;
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });
    header.appendChild(closeBtn);

    return header;
  }

  private createOddsGrid(): HTMLDivElement {
    const container = document.createElement('div');
    container.style.cssText = `
      padding: 16px 20px; flex: 1; overflow-y: auto;
    `;

    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    `;

    // 按品质分组展示
    const rarityOrder: Array<{ rarity: string; prob: string; multiplier: string }> = [
      { rarity: 'common', prob: '70.00%', multiplier: '1.2x' },
      { rarity: 'rare', prob: '20.00%', multiplier: '1.6x' },
      { rarity: 'epic', prob: '8.00%', multiplier: '2.4x' },
      { rarity: 'legendary', prob: '2.00%', multiplier: '4x' },
    ];

    // 获取每个品质的一个代表宠物
    const allPets = getAllPets();
    const petsByRarity = new Map<string, PetDef[]>();
    for (const p of allPets) {
      if (!petsByRarity.has(p.rarity)) petsByRarity.set(p.rarity, []);
      petsByRarity.get(p.rarity)!.push(p);
    }

    for (const info of rarityOrder) {
      const pets = petsByRarity.get(info.rarity) || [];
      const pet = pets[0];
      if (!pet) continue;

      const card = document.createElement('div');
      const rarityColor = getPetRarityColor(pet.rarity);
      card.style.cssText = `
        background: ${this.getRarityBg(pet.rarity)};
        border: 3px solid ${rarityColor};
        border-radius: 14px; padding: 12px 8px;
        text-align: center; position: relative;
        box-shadow: 0 3px 0 rgba(0,0,0,0.15);
      `;

      // 概率标签
      const probLabel = document.createElement('div');
      probLabel.textContent = info.prob;
      probLabel.style.cssText = `
        font-size: 14px; font-weight: 900; color: #333;
        margin-bottom: 6px;
      `;
      card.appendChild(probLabel);

      // 宠物预览区（canvas）
      const previewDiv = document.createElement('div');
      previewDiv.style.cssText = `
        width: 100px; height: 80px; margin: 0 auto 6px;
        background: rgba(255,255,255,0.3); border-radius: 10px;
        overflow: hidden;
      `;
      card.appendChild(previewDiv);

      // 使用小 canvas 渲染宠物预览
      this.renderMiniPreview(previewDiv, pet);

      // 倍率标签
      const multLabel = document.createElement('div');
      multLabel.textContent = info.multiplier;
      multLabel.style.cssText = `
        font-size: 18px; font-weight: 900; color: ${rarityColor};
        text-shadow: 1px 1px 0 rgba(0,0,0,0.1);
      `;
      card.appendChild(multLabel);

      grid.appendChild(card);
    }

    container.appendChild(grid);
    return container;
  }

  private getRarityBg(rarity: string): string {
    switch (rarity) {
      case 'common': return 'linear-gradient(135deg, #F5F5F5, #E0E0E0)';
      case 'rare': return 'linear-gradient(135deg, #E8F5E9, #C8E6C9)';
      case 'epic': return 'linear-gradient(135deg, #E3F2FD, #BBDEFB)';
      case 'legendary': return 'linear-gradient(135deg, #FFF9C4, #FFE082)';
    }
    return '#FFF';
  }

  /**
   * 用共享离屏渲染器生成静态快照，避免每个卡片创建 WebGL 上下文
   */
  private renderMiniPreview(container: HTMLDivElement, pet: PetDef, w = 100, h = 80): void {
    const renderer = PetGachaUI.sharedMiniRenderer;
    renderer.setSize(w, h);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    camera.position.set(0, 0.8, 2.5);
    camera.lookAt(0, 0.5, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(2, 3, 2);
    scene.add(dir);

    const mesh = Pet.createPreviewMesh(pet);
    mesh.scale.set(0.8, 0.8, 0.8);
    mesh.rotation.y = 0.5;
    scene.add(mesh);

    renderer.render(scene, camera);

    // 将渲染结果转为静态图片
    const img = document.createElement('img');
    img.src = renderer.domElement.toDataURL();
    img.style.cssText = `width: ${w}px; height: ${h}px; display: block;`;
    container.appendChild(img);
  }

  private createActions(): HTMLDivElement {
    const container = document.createElement('div');
    container.style.cssText = `
      padding: 16px 20px; display: flex; justify-content: center;
      gap: 16px; border-top: 2px solid #EEE;
    `;

    const progress = getPlayerProgress();

    // 五连抽按钮
    const multiBtn = this.createGachaButton(
      `🏆 ${GACHA_COST_MULTI}\n打开X${GACHA_MULTI_COUNT}`,
      'linear-gradient(135deg, #F39C12, #E67E22)',
      () => this.doGacha(GACHA_MULTI_COUNT)
    );
    container.appendChild(multiBtn);

    // 单抽按钮
    const singleBtn = this.createGachaButton(
      `🏆 ${GACHA_COST_SINGLE}\n打开X1`,
      'linear-gradient(135deg, #2ECC71, #27AE60)',
      () => this.doGacha(1)
    );
    container.appendChild(singleBtn);

    return container;
  }

  private createGachaButton(label: string, bg: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    const lines = label.split('\n');
    btn.innerHTML = `
      <div style="font-size: 14px; margin-bottom: 2px;">${lines[0]}</div>
      <div style="font-size: 20px; font-weight: 900;">${lines[1]}</div>
    `;
    btn.style.cssText = `
      background: ${bg}; color: #FFF;
      border: 3px solid #000; border-radius: 14px;
      padding: 10px 30px; cursor: pointer;
      box-shadow: 0 4px 0 #000; font-family: ${FONT};
      transition: transform 0.1s;
      min-width: 150px;
    `;
    btn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      btn.style.transform = 'translateY(2px)';
    });
    btn.addEventListener('mouseup', (e) => {
      e.stopPropagation();
      btn.style.transform = '';
    });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  // ============ 抽蛋逻辑 ============

  private doGacha(count: number): void {
    const progress = getPlayerProgress();
    const cost = count === 1 ? GACHA_COST_SINGLE : GACHA_COST_MULTI;

    // 检查奖杯是否足够
    if (progress.totalTrophies < cost) {
      this.showMessage('奖杯不足！');
      return;
    }

    // 检查背包是否已满
    if (progress.getOwnedPetCount() + count > PET_MAX_OWNED) {
      this.showMessage('宠物背包已满（50/50）！');
      return;
    }

    // 扣除奖杯
    progress.spendTrophies(cost);

    // 执行抽蛋
    const results = count === 1 ? [rollGacha()] : rollGachaMulti(count);

    // 存入背包
    for (const pet of results) {
      progress.addPet(pet.id);
    }

    // 显示结果
    this.showResults(results);

    // 通知外部刷新
    if (this.onGachaCallback) this.onGachaCallback();
  }

  // ============ 结果展示 ============

  private showResults(pets: PetDef[]): void {
    // 关闭主面板
    this.hide();

    // 创建结果展示面板
    const resultOverlay = document.createElement('div');
    resultOverlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.6); z-index: 9600;
      display: flex; flex-direction: column;
      justify-content: center; align-items: center;
    `;

    const stopAll = (e: Event) => e.stopPropagation();
    resultOverlay.addEventListener('mousedown', stopAll);
    resultOverlay.addEventListener('mouseup', stopAll);
    resultOverlay.addEventListener('keydown', stopAll);

    if (pets.length === 1) {
      // 单抽结果 — 大型展示
      this.showSingleResult(resultOverlay, pets[0]);
    } else {
      // 多抽结果 — 网格展示
      this.showMultiResult(resultOverlay, pets);
    }

    // 跳过按钮
    const skipBtn = document.createElement('button');
    skipBtn.textContent = '跳过';
    skipBtn.style.cssText = `
      margin-top: 24px;
      background: linear-gradient(135deg, #2ECC71, #27AE60);
      color: #FFF; border: 3px solid #000; border-radius: 14px;
      padding: 12px 60px; font-size: 20px; font-weight: 900;
      cursor: pointer; box-shadow: 0 4px 0 #000;
      font-family: ${FONT}; transition: transform 0.1s;
    `;
    skipBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      skipBtn.style.transform = 'translateY(2px)';
    });
    skipBtn.addEventListener('mouseup', (e) => {
      e.stopPropagation();
      skipBtn.style.transform = '';
    });
    skipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.stopPreview();
      resultOverlay.remove();
    });
    resultOverlay.appendChild(skipBtn);

    document.body.appendChild(resultOverlay);
  }

  private showSingleResult(container: HTMLDivElement, pet: PetDef): void {
    // 3D 预览 canvas
    const previewCanvas = document.createElement('div');
    previewCanvas.style.cssText = `
      width: 300px; height: 250px;
      border-radius: 16px; overflow: hidden;
    `;
    container.appendChild(previewCanvas);

    this.startResultPreview(previewCanvas, pet);

    // 倍率和品质
    const info = document.createElement('div');
    info.style.cssText = 'text-align: center; margin-top: 16px;';

    const mult = document.createElement('div');
    mult.textContent = `${pet.speedMultiplier}x`;
    mult.style.cssText = `
      font-size: 36px; font-weight: 900; color: #FFF;
      text-shadow: 2px 2px 0 rgba(0,0,0,0.5);
    `;
    info.appendChild(mult);

    const rarity = document.createElement('div');
    rarity.textContent = getPetRarityLabel(pet.rarity);
    rarity.style.cssText = `
      font-size: 22px; font-weight: 900;
      color: ${getPetRarityColor(pet.rarity)};
      text-shadow: 1px 1px 0 rgba(0,0,0,0.5);
    `;
    info.appendChild(rarity);

    container.appendChild(info);
  }

  private showMultiResult(container: HTMLDivElement, pets: PetDef[]): void {
    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid; grid-template-columns: repeat(${Math.min(pets.length, 5)}, 1fr);
      gap: 12px; padding: 20px;
    `;

    for (const pet of pets) {
      const card = document.createElement('div');
      const rarityColor = getPetRarityColor(pet.rarity);
      card.style.cssText = `
        background: rgba(255,255,255,0.95);
        border: 3px solid ${rarityColor};
        border-radius: 14px; padding: 10px;
        text-align: center;
        box-shadow: 0 3px 0 rgba(0,0,0,0.2);
      `;

      // 宠物预览
      const previewDiv = document.createElement('div');
      previewDiv.style.cssText = `
        width: 90px; height: 70px; margin: 0 auto 6px;
        border-radius: 8px; overflow: hidden;
      `;
      card.appendChild(previewDiv);
      this.renderMiniPreview(previewDiv, pet, 90, 70);

      // 名称
      const name = document.createElement('div');
      name.textContent = pet.name;
      name.style.cssText = `font-size: 14px; font-weight: 700; color: #333;`;
      card.appendChild(name);

      // 倍率
      const mult = document.createElement('div');
      mult.textContent = `${pet.speedMultiplier}x`;
      mult.style.cssText = `
        font-size: 18px; font-weight: 900;
        color: ${rarityColor};
      `;
      card.appendChild(mult);

      // 品质
      const rarity = document.createElement('div');
      rarity.textContent = getPetRarityLabel(pet.rarity);
      rarity.style.cssText = `font-size: 12px; color: ${rarityColor};`;
      card.appendChild(rarity);

      grid.appendChild(card);
    }

    container.appendChild(grid);
  }

  // ============ 3D 预览 ============

  private startResultPreview(container: HTMLDivElement, pet: PetDef): void {
    this.stopPreview();

    const w = 300, h = 250;
    this.previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.previewRenderer.setSize(w, h);
    this.previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.previewRenderer.domElement);

    this.previewScene = new THREE.Scene();
    this.previewCamera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    this.previewCamera.position.set(0, 1, 3.5);
    this.previewCamera.lookAt(0, 0.5, 0);

    this.previewScene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(2, 3, 2);
    this.previewScene.add(dir);

    this.previewMesh = Pet.createPreviewMesh(pet);
    this.previewScene.add(this.previewMesh);

    this.previewRotation = 0;
    const animate = () => {
      if (!this.previewRenderer || !this.previewScene || !this.previewCamera) return;
      this.previewAnimId = requestAnimationFrame(animate);
      this.previewRotation += 0.02;
      if (this.previewMesh) {
        this.previewMesh.rotation.y = this.previewRotation;
        this.previewMesh.position.y = 0.5 + Math.sin(this.previewRotation * 2) * 0.1;
      }
      this.previewRenderer.render(this.previewScene, this.previewCamera);
    };
    animate();
  }

  private stopPreview(): void {
    if (this.previewAnimId) {
      cancelAnimationFrame(this.previewAnimId);
      this.previewAnimId = 0;
    }
    if (this.previewRenderer) {
      this.previewRenderer.dispose();
      this.previewRenderer = null;
    }
    this.previewScene = null;
    this.previewCamera = null;
    this.previewMesh = null;
  }

  // ============ 消息提示 ============

  private showMessage(text: string): void {
    const msg = document.createElement('div');
    msg.textContent = text;
    msg.style.cssText = `
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.85); color: #FFF;
      padding: 16px 32px; border-radius: 12px;
      font-size: 18px; font-weight: 900;
      font-family: ${FONT}; z-index: 9999;
      animation: fadeOut 1.5s forwards;
    `;
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 1500);
  }
}
