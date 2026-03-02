/**
 * AI 设置面板 - 模型选择 + API Key 配置
 * 数据持久化到 localStorage
 * UI 风格匹配游戏 Roblox 卡通风格
 */

export interface AIProviderConfig {
  id: string;
  name: string;
  models: string[];
  defaultModel: string;
  baseUrl: string;
  authType: 'query' | 'bearer';
}

export interface AISettings {
  provider: string;
  model: string;
  apiKey: string;
  spawnDescription?: string;  // 马厩场景风格描述
}

export const AI_PROVIDERS: AIProviderConfig[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    models: ['gemini-2.5-flash', 'gemini-2.0-flash'],
    defaultModel: 'gemini-2.5-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    authType: 'query',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    models: ['deepseek-chat'],
    defaultModel: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com/v1',
    authType: 'bearer',
  },
  {
    id: 'hunyuan',
    name: '腾讯混元',
    models: ['hunyuan-turbos-latest', 'hunyuan-turbo'],
    defaultModel: 'hunyuan-turbos-latest',
    baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
    authType: 'bearer',
  },
];

const STORAGE_KEY = 'ride_horse_ai_settings';
const FONT = "'Arial Rounded MT Bold', 'Nunito', sans-serif";

export function loadAISettings(): AISettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (AI_PROVIDERS.find(p => p.id === parsed.provider)) {
        return parsed;
      }
    }
  } catch { /* ignore */ }
  return { provider: 'gemini', model: 'gemini-2.5-flash', apiKey: '' };
}

export function saveAISettings(settings: AISettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/**
 * 开发模式下的代理路径映射（解决 CORS 问题）
 * key = provider id, value = 替换后的 baseUrl
 */
const DEV_PROXY_MAP: Record<string, string> = {
  hunyuan: '/api/hunyuan/v1',
  deepseek: '/api/deepseek/v1',
};

export function getProviderConfig(providerId: string): AIProviderConfig {
  const provider = AI_PROVIDERS.find(p => p.id === providerId) || AI_PROVIDERS[0];
  // 本地开发时使用 Vite 代理路径，绕过 CORS
  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const proxyUrl = isLocal ? DEV_PROXY_MAP[provider.id] : undefined;
  if (proxyUrl) {
    return { ...provider, baseUrl: proxyUrl };
  }
  return provider;
}

// ============ Settings UI ============

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  latencyMs: number;
}

export class SettingsUI {
  private btn: HTMLButtonElement | null = null;
  private overlay: HTMLDivElement | null = null;
  private isOpen = false;
  private onChangeCallback: ((settings: AISettings) => void) | null = null;
  private onSpawnDescChangeCallback: ((desc: string | undefined) => void) | null = null;
  private testFn: ((settings: AISettings) => Promise<ConnectionTestResult>) | null = null;

  // 当前编辑中的状态
  private selectedProvider = '';
  private selectedModel = '';

  constructor() {
    this.createButton();
  }

  onChange(cb: (settings: AISettings) => void) {
    this.onChangeCallback = cb;
  }

  /**
   * 注册马厩场景风格变化回调（保存设置时触发）
   */
  onSpawnDescChange(cb: (desc: string | undefined) => void) {
    this.onSpawnDescChangeCallback = cb;
  }

  /**
   * 注入连接测试函数（由 main.ts 注入，内部调用 architect.testConnection）
   */
  setTestFn(fn: (settings: AISettings) => Promise<ConnectionTestResult>) {
    this.testFn = fn;
  }

  private createButton(): void {
    this.btn = document.createElement('button');
    this.btn.innerHTML = '⚙';
    this.btn.style.cssText = `
      position: fixed; top: 12px; right: 12px;
      width: 40px; height: 40px;
      background: #FFFFFF; color: #333;
      border: 3px solid #000; border-radius: 50%;
      font-size: 20px; cursor: pointer; z-index: 9000;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 0 #000;
      font-family: ${FONT};
      transition: transform 0.1s;
      padding: 0; line-height: 1;
    `;
    this.btn.title = 'AI 设置';
    this.btn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      if (this.btn) this.btn.style.transform = 'translateY(2px)';
    });
    this.btn.addEventListener('mouseup', (e) => {
      e.stopPropagation();
      if (this.btn) this.btn.style.transform = '';
    });
    this.btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });
    document.body.appendChild(this.btn);
  }

  private toggle(): void {
    this.isOpen ? this.close() : this.open();
  }

  private open(): void {
    if (this.isOpen) return;
    this.isOpen = true;

    const settings = loadAISettings();
    this.selectedProvider = settings.provider;
    this.selectedModel = settings.model;

    // 遮罩层
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.45); z-index: 9500;
      display: flex; justify-content: center; align-items: center;
    `;
    // 阻止所有事件穿透到游戏
    const stopAll = (e: Event) => e.stopPropagation();
    this.overlay.addEventListener('mousedown', stopAll);
    this.overlay.addEventListener('mouseup', stopAll);
    this.overlay.addEventListener('keydown', stopAll);
    this.overlay.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.target === this.overlay) this.close();
    });

    // 面板
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    const panel = document.createElement('div');
    panel.style.cssText = `
      background: #FFF9E6; color: #333; border-radius: 20px;
      padding: ${isMobile ? '16px 20px' : '24px 28px'}; 
      width: ${isMobile ? '90vw' : '360px'}; 
      max-width: 90vw;
      max-height: ${isMobile ? '80vh' : 'none'};
      overflow-y: ${isMobile ? 'auto' : 'visible'};
      border: 4px solid #000; box-shadow: 0 8px 0 #000;
      font-family: ${FONT};
    `;

    // 标题
    const title = document.createElement('div');
    title.innerHTML = '⚙ AI 设置';
    title.style.cssText = `
      font-size: ${isMobile ? '18px' : '22px'}; 
      font-weight: 900; 
      margin-bottom: ${isMobile ? '12px' : '18px'}; 
      color: #000;
      text-shadow: 1px 1px 0 #ccc;
    `;
    panel.appendChild(title);

    // ---- 供应商选择 ----
    panel.appendChild(this.makeLabel('AI 供应商'));
    const providerGroup = document.createElement('div');
    providerGroup.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px;';

    for (const p of AI_PROVIDERS) {
      const chip = this.makeChip(p.name, p.id === this.selectedProvider, () => {
        this.selectedProvider = p.id;
        // 切换供应商时重置模型为默认
        const prov = getProviderConfig(p.id);
        this.selectedModel = prov.defaultModel;
        this.refreshPanel(panel, settings.apiKey);
      });
      providerGroup.appendChild(chip);
    }
    panel.appendChild(providerGroup);

    // ---- 模型选择 ----
    const currentProv = getProviderConfig(this.selectedProvider);
    panel.appendChild(this.makeLabel('模型'));
    const modelGroup = document.createElement('div');
    modelGroup.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px;';

    for (const m of currentProv.models) {
      const chip = this.makeChip(m, m === this.selectedModel, () => {
        this.selectedModel = m;
        this.refreshPanel(panel, apiKeyInput.value);
      });
      modelGroup.appendChild(chip);
    }
    panel.appendChild(modelGroup);

    // ---- API Key ----
    panel.appendChild(this.makeLabel('API Key'));
    const keyRow = document.createElement('div');
    keyRow.style.cssText = 'display: flex; gap: 8px; margin-bottom: 6px;';

    const apiKeyInput = document.createElement('input');
    apiKeyInput.type = 'password';
    apiKeyInput.placeholder = '输入你的 API Key';
    apiKeyInput.value = settings.apiKey;
    apiKeyInput.style.cssText = `
      flex: 1; padding: 10px 12px; box-sizing: border-box;
      background: #FFF; color: #333; border: 3px solid #000;
      border-radius: 12px; font-size: 14px;
      font-family: ${FONT}; outline: none;
    `;
    apiKeyInput.addEventListener('focus', () => { apiKeyInput.style.borderColor = '#FFD700'; });
    apiKeyInput.addEventListener('blur', () => { apiKeyInput.style.borderColor = '#000'; });
    apiKeyInput.addEventListener('mousedown', (e) => e.stopPropagation());
    apiKeyInput.addEventListener('keydown', (e) => e.stopPropagation());
    keyRow.appendChild(apiKeyInput);

    const eyeBtn = document.createElement('button');
    eyeBtn.textContent = '👁';
    eyeBtn.style.cssText = `
      width: 40px; background: #FFF; border: 3px solid #000;
      border-radius: 12px; cursor: pointer; font-size: 16px;
      box-shadow: 0 3px 0 #000; transition: transform 0.1s;
    `;
    eyeBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      eyeBtn.style.transform = 'translateY(2px)';
    });
    eyeBtn.addEventListener('mouseup', (e) => {
      e.stopPropagation();
      eyeBtn.style.transform = '';
    });
    eyeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
    });
    keyRow.appendChild(eyeBtn);
    panel.appendChild(keyRow);

    // 状态提示
    const statusDiv = document.createElement('div');
    statusDiv.style.cssText = 'font-size: 12px; color: #888; margin: 8px 0 16px; min-height: 16px;';
    if (settings.apiKey) {
      const prov = getProviderConfig(settings.provider);
      statusDiv.innerHTML = `当前: <b>${prov.name}</b> / <b>${settings.model}</b>`;
    } else {
      statusDiv.textContent = '未配置 API Key，AI 功能将使用本地生成器';
    }
    panel.appendChild(statusDiv);

    // ---- 马厩场景风格 ----
    panel.appendChild(this.makeLabel('🏞️ 马厩场景风格'));
    const spawnDescHint = document.createElement('div');
    spawnDescHint.style.cssText = 'font-size: 11px; color: #999; margin-bottom: 6px; font-weight: 700;';
    spawnDescHint.textContent = '保存后马厩场景会自动更新风格';
    panel.appendChild(spawnDescHint);

    const spawnInput = document.createElement('textarea');
    spawnInput.placeholder = '例如：樱花、雪地、霓虹都市、火山、夜晚...';
    spawnInput.maxLength = 150;
    spawnInput.rows = 2;
    spawnInput.value = settings.spawnDescription || '';
    spawnInput.style.cssText = `
      width: 100%; box-sizing: border-box; padding: 10px 12px;
      background: #FFF; color: #333; border: 3px solid #000;
      border-radius: 12px; font-size: 13px;
      font-family: ${FONT}; font-weight: 700;
      outline: none; resize: none;
    `;
    spawnInput.addEventListener('focus', () => { spawnInput.style.borderColor = '#FFD700'; });
    spawnInput.addEventListener('blur', () => { spawnInput.style.borderColor = '#000'; });
    spawnInput.addEventListener('mousedown', (e) => e.stopPropagation());
    spawnInput.addEventListener('keydown', (e) => e.stopPropagation());
    panel.appendChild(spawnInput);

    const spawnCountLabel = document.createElement('div');
    spawnCountLabel.style.cssText = 'text-align: right; font-size: 11px; color: #999; margin-top: 2px; margin-bottom: 14px; font-weight: 700;';
    spawnCountLabel.textContent = `${(settings.spawnDescription || '').length}/150`;
    spawnInput.addEventListener('input', () => {
      spawnCountLabel.textContent = `${spawnInput.value.length}/150`;
    });
    panel.appendChild(spawnCountLabel);

    // ---- 按钮行 ----
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';

    btnRow.appendChild(this.makeButton('取消', '#EEE', '#000', () => this.close()));
    const saveBtn = this.makeButton('保存', '#FFD700', '#000', () => {
      const newSettings: AISettings = {
        provider: this.selectedProvider,
        model: this.selectedModel,
        apiKey: apiKeyInput.value.trim(),
        spawnDescription: spawnInput.value.trim() || undefined,
      };
      saveAISettings(newSettings);
      if (this.onChangeCallback) this.onChangeCallback(newSettings);
      if (this.onSpawnDescChangeCallback) this.onSpawnDescChangeCallback(newSettings.spawnDescription);

      // 如果有 apiKey 且有测试函数，执行连接测试
      if (newSettings.apiKey && this.testFn) {
        statusDiv.innerHTML = '<span style="color:#FF9800; font-weight:bold;">⏳ 连接测试中...</span>';
        saveBtn.disabled = true;
        saveBtn.style.opacity = '0.6';

        this.testFn(newSettings).then((result) => {
          if (result.ok) {
            statusDiv.innerHTML = `<span style="color:#4caf50; font-weight:bold;">✅ 连接成功! (${result.latencyMs}ms)</span><br><span style="color:#666; font-size:11px;">${result.message}</span>`;
            setTimeout(() => this.close(), 800);
          } else {
            statusDiv.innerHTML = `<span style="color:#f44336; font-weight:bold;">❌ 连接失败: ${result.message}</span>`;
            saveBtn.disabled = false;
            saveBtn.style.opacity = '1';
          }
        }).catch(() => {
          statusDiv.innerHTML = '<span style="color:#f44336; font-weight:bold;">❌ 测试异常</span>';
          saveBtn.disabled = false;
          saveBtn.style.opacity = '1';
        });
      } else {
        // 无 apiKey 或无测试函数，直接保存关闭
        statusDiv.innerHTML = '<span style="color:#4caf50; font-weight:bold;">✓ 已保存!</span>';
        setTimeout(() => this.close(), 500);
      }
    });
    btnRow.appendChild(saveBtn);
    panel.appendChild(btnRow);

    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);
  }

  /**
   * 刷新面板内容（切换供应商/模型后重建）
   */
  private refreshPanel(oldPanel: HTMLElement, currentApiKey: string): void {
    const parent = oldPanel.parentElement;
    if (!parent) return;
    // 读取当前面板中正在编辑的 spawnDescription
    const spawnTextarea = oldPanel.querySelector('textarea') as HTMLTextAreaElement | null;
    const currentSpawnDesc = spawnTextarea?.value || '';
    // 关掉旧的，重新打开
    this.close();
    // 临时写入当前编辑状态
    const backup = loadAISettings();
    saveAISettings({
      provider: this.selectedProvider,
      model: this.selectedModel,
      apiKey: currentApiKey,
      spawnDescription: currentSpawnDesc || undefined,
    });
    this.open();
    // 恢复原始保存的设置（用户还没点保存）
    saveAISettings(backup);
  }

  private close(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    this.isOpen = false;
  }

  // ---- UI 组件 ----

  private makeLabel(text: string): HTMLDivElement {
    const label = document.createElement('div');
    label.textContent = text;
    label.style.cssText = `
      font-size: 13px; font-weight: 900; color: #666;
      margin-bottom: 6px; text-transform: uppercase;
      letter-spacing: 1px;
    `;
    return label;
  }

  /**
   * 卡通风格选择芯片（替代 native select）
   */
  private makeChip(text: string, active: boolean, onClick: () => void): HTMLButtonElement {
    const chip = document.createElement('button');
    chip.textContent = text;
    chip.style.cssText = `
      padding: 8px 16px; border-radius: 12px; cursor: pointer;
      font-family: ${FONT}; font-size: 13px; font-weight: 700;
      transition: transform 0.1s;
      border: 3px solid #000;
      box-shadow: 0 3px 0 #000;
      background: ${active ? '#FFD700' : '#FFF'};
      color: #000;
    `;
    chip.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      chip.style.transform = 'translateY(2px)';
      chip.style.boxShadow = '0 1px 0 #000';
    });
    chip.addEventListener('mouseup', (e) => {
      e.stopPropagation();
      chip.style.transform = '';
      chip.style.boxShadow = '0 3px 0 #000';
    });
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return chip;
  }

  private makeButton(text: string, bg: string, color: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      padding: 10px 24px; border-radius: 14px; cursor: pointer;
      font-family: ${FONT}; font-size: 15px; font-weight: 900;
      border: 3px solid #000; box-shadow: 0 4px 0 #000;
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
      btn.style.boxShadow = '0 4px 0 #000';
    });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  destroy(): void {
    this.close();
    if (this.btn) {
      this.btn.remove();
      this.btn = null;
    }
  }
}
