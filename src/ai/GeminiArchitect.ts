import { PlayerTelemetry } from '../systems/PlayerBehaviorTracker';
import { AsciiMapChunk, ParkourConfig, StableSceneConfig } from '../data/types/GameTypes';
import { AISettings, getProviderConfig, loadAISettings } from '../ui/SettingsUI';
import { getAssetLegend, getValidChars } from './AssetRegistry';
import { getThemeIds } from './ThemeRegistry';

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  latencyMs: number;
}

export class GeminiArchitect {
  private settings: AISettings;
  
  // Rate limiting to prevent 429 errors
  private lastRequestTime: number = 0;
  private minRequestInterval: number = 15000; // 15秒请求间隔（比30s更快）
  private backoffUntil: number = 0;
  private consecutiveErrors: number = 0;
  
  // 公开的连接状态（供 UI 读取）
  public lastConnectionOk: boolean = false;
  public hasApiKey: boolean = false;
  
  // 玩家当前持有的卡牌效果描述（由 ParkourScene 更新）
  public activeCardEffects: string = '';
  
  // 玩家自定义跑道配置（由 ParkourScene 设置）
  public parkourConfig: ParkourConfig | null = null;

  constructor(apiKey: string = '') {
    // 从 localStorage 加载设置，若有 apiKey 参数则作为后备
    this.settings = loadAISettings();
    if (!this.settings.apiKey && apiKey) {
      this.settings.apiKey = apiKey;
    }
    this.hasApiKey = !!this.settings.apiKey;
  }

  /**
   * 外部更新设置（设置面板保存后调用）
   */
  updateSettings(settings: AISettings) {
    this.settings = { ...settings };
    this.hasApiKey = !!settings.apiKey;
    // 重置 backoff 和连接状态（切换了供应商/key）
    this.backoffUntil = 0;
    this.consecutiveErrors = 0;
    this.lastConnectionOk = false;
  }

  setApiKey(key: string) {
    this.settings.apiKey = key;
  }

  canRequest(): boolean {
    const now = Date.now();
    if (now < this.backoffUntil) return false;
    if (now - this.lastRequestTime < this.minRequestInterval) return false;
    return true;
  }

  /**
   * 轻量连接测试 - 不受 rate limiting 限制
   * 用于设置面板保存后验证 API Key 是否有效
   */
  async testConnection(overrideSettings?: AISettings): Promise<ConnectionTestResult> {
    const settings = overrideSettings || this.settings;
    if (!settings.apiKey) {
      return { ok: false, message: '未填写 API Key', latencyMs: 0 };
    }

    const provider = getProviderConfig(settings.provider);
    const startTime = Date.now();

    try {
      if (provider.authType === 'query') {
        // Gemini: 简单测试请求
        const url = `${provider.baseUrl}/models/${settings.model}:generateContent?key=${settings.apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Reply with: OK' }] }],
            generationConfig: { maxOutputTokens: 10 }
          })
        });
        const latency = Date.now() - startTime;
        if (!response.ok) {
          const errText = response.status === 401 ? 'API Key 无效' :
                          response.status === 429 ? '请求频率过高' :
                          `${response.status} ${response.statusText}`;
          return { ok: false, message: errText, latencyMs: latency };
        }
        return { ok: true, message: `${provider.name} / ${settings.model}`, latencyMs: latency };
      } else {
        // OpenAI-compatible: 简单测试请求
        const url = `${provider.baseUrl}/chat/completions`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`,
          },
          body: JSON.stringify({
            model: settings.model,
            messages: [{ role: 'user', content: 'Reply with: OK' }],
            max_tokens: 10,
          })
        });
        const latency = Date.now() - startTime;
        if (!response.ok) {
          const errText = response.status === 401 ? 'API Key 无效' :
                          response.status === 429 ? '请求频率过高' :
                          `${response.status} ${response.statusText}`;
          return { ok: false, message: errText, latencyMs: latency };
        }
        return { ok: true, message: `${provider.name} / ${settings.model}`, latencyMs: latency };
      }
    } catch (e: any) {
      const latency = Date.now() - startTime;
      return { ok: false, message: e.message || '网络错误', latencyMs: latency };
    }
  }

  /**
   * 生成 ASCII 地图块 - 返回 AsciiMapChunk 或 null
   */
  async generateChunk(telemetry: PlayerTelemetry, difficulty: number): Promise<AsciiMapChunk | null> {
    if (!this.settings.apiKey) {
      return null;
    }

    if (!this.canRequest()) {
      return null;
    }

    this.lastRequestTime = Date.now();

    try {
      const prompt = this.buildAsciiPrompt(telemetry, difficulty);
      const responseText = await this.callAPI(prompt);
      const map = this.parseAsciiMap(responseText);
      this.consecutiveErrors = 0;
      this.lastConnectionOk = true;
      return map;
    } catch (e) {
      this.consecutiveErrors++;
      this.lastConnectionOk = false;
      const backoffMs = this.minRequestInterval * Math.pow(2, Math.min(this.consecutiveErrors, 5));
      this.backoffUntil = Date.now() + backoffMs;
      console.warn(`AIArchitect [${this.settings.provider}]: Error (backoff ${Math.round(backoffMs / 1000)}s)`, e);
      return null;
    }
  }

  private buildAsciiPrompt(telemetry: PlayerTelemetry, difficulty: number): string {
    const legend = getAssetLegend();
    const biasDesc = telemetry.laneBias < -0.3 ? 'They stick to the LEFT side.' :
                     telemetry.laneBias > 0.3 ? 'They stick to the RIGHT side.' :
                     'They stay in the CENTER.';
    
    // 构建玩家自定义描述上下文
    let customContext = '';
    if (this.parkourConfig) {
      const cfg = this.parkourConfig;
      if (cfg.mapDescription) {
        customContext += `\n[PLAYER_CUSTOM_REQUEST]\nThe player wants this kind of track: "${cfg.mapDescription}"\n`;
      }
      if (cfg.selectedTags && cfg.selectedTags.length > 0) {
        customContext += `Selected theme tags: ${cfg.selectedTags.join(', ')}\n`;
      }
      if (cfg.difficulty) {
        const diffLabel = cfg.difficulty === 'casual' ? 'Easy/Casual' :
                          cfg.difficulty === 'extreme' ? 'Extreme/Very Hard' : 'AI Adaptive';
        customContext += `Player chosen difficulty: ${diffLabel}\n`;
      }
      if (customContext) {
        customContext += `\nIMPORTANT: You MUST incorporate the player's description into your map generation.
- Choose the most fitting theme from the available themes that matches the description
- CRITICAL: Keep the SAME theme consistently across ALL chunks! Do NOT change themes between chunks.
- Select obstacles and decorations that match the described world
- The narration should reference the player's requested world atmosphere\n`;
      }
    }

    return `You are a "Mind-Reading Level Designer" for a 3D horse infinite runner game.
Generate a track section as an ASCII map. The horse runs from bottom (row 20) to top (row 1).

GRID: 8 columns x 20 rows. Each cell = 1.25m wide x 2.5m deep.
Column 1 = far left, Column 8 = far right.

${legend}
${customContext}
PLAYER TELEMETRY:
- Lane Bias: ${telemetry.laneBias.toFixed(2)} (-1=Left, 1=Right). ${biasDesc}
- Play Style: ${telemetry.style}
- Recent Crashes: ${telemetry.recentCrashes.join(', ') || 'None'}
- Current Difficulty: ${difficulty.toFixed(1)} (1.0=Normal, 2.0=Hard, 3.0=Extreme)
- Active Card Effects: ${this.activeCardEffects || 'None'}

DESIGN RULES:
- Each row MUST be exactly 8 characters.
- Every row MUST have at least 2 consecutive dots (.) for the player to pass through.
- DENSITY LIMIT: Maximum 5-8 obstacle characters per ENTIRE map (all 20 rows combined). Less is better! Sparse maps are more fun.
- SPACING: At least 3-4 completely empty rows (all dots) between ANY two obstacle rows. NEVER put obstacles in consecutive rows or rows close together.
- PER-ROW LIMIT: Never place more than 1 obstacle in the same row (exception: at difficulty >= 2.0, maximum 2 per row).
- EDGE ONLY: Decorations (M,V) MUST be in columns 1 or 8 only (the edges). NEVER place them in columns 2-7.
- Place obstacles (B,b,R,K,H) to counter the player's habits:
  * If they lean LEFT → put obstacles on the left, force them RIGHT.
  * If they lean RIGHT → put obstacles on the right, force them LEFT.
  * If they crash often → give a breather (more empty rows) then a single trick.
- Use coins (*) and stars (S) to reward skillful paths through narrow gaps.
- Gate arches (G) mark milestones — place at most 1 per map, only in column 1.
- Water puddles (W) slow the player — use at most 1 per map.
- Moving obstacles (A) oscillate left-right — use at most 1 per map, only at difficulty >= 2.0.
- Advanced obstacles (L,A,P,F,J) only appear when difficulty >= 2.0.
- Bottom 3 rows (rows 18-20) MUST be empty (all dots) — this is the player entry zone.

THEME SELECTION:
- theme MUST be one of: ${getThemeIds().join(', ')}
- If a PLAYER_CUSTOM_REQUEST or selected theme tags are specified above, you MUST use the matching theme consistently. Do NOT change themes!
- Otherwise, choose theme based on difficulty and variety:
  * Easy (difficulty < 1.0): meadow, cherry, or sunset
  * Medium (1.0-2.0): forest, desert, or snow
  * Hard (> 2.0): night, volcano, or snow

OUTPUT FORMAT (no markdown, no extra text):
---
theme: [one of: ${getThemeIds().join('/')}]
strategy: [one sentence in Chinese about your tactical intent]
narration: [one short phrase in Chinese, max 8 chars, your voice describing this theme's mood, e.g. "让我把路藏起来..." or "关灯了"]
analysis: [one short phrase in Chinese, max 10 chars, your read on the player's behavior, e.g. "你在试探我" or "太保守了"]
confidence: [0-100, how confident you are in predicting the player's next move]
comments: [3-5 short taunting phrases in Chinese separated by |, based on telemetry, e.g. "又往左了？|这次可不会放过你|金币是诱饵"]
---
[exactly 20 lines of 8 characters each]

EXAMPLE:
---
theme: forest
strategy: 你总往左，在右侧布置障碍逼你变道
narration: 让我把路藏起来...
analysis: 你在试探我的底线
confidence: 72
comments: 又往左了？|这次可不会放过你|金币是个好诱饵
---
........
...*..*.
........
..B...*.
........
........
..H.....
..*...*. 
........
........
..*...*. 
........
M......V
..B.....
...*.S..
........
........
..R.....
..*...*. 
........`;
  }

  /**
   * 统一 API 调用 - 自动适配 Gemini / OpenAI-compatible (DeepSeek, Hunyuan)
   * @param systemMessage 自定义系统消息（仅 OpenAI-compatible 生效），不传则使用地图生成默认消息
   */
  private async callAPI(prompt: string, systemMessage?: string): Promise<string> {
    const provider = getProviderConfig(this.settings.provider);

    if (provider.authType === 'query') {
      // Gemini 格式（无 system message，直接发送 prompt）
      return this.callGemini(prompt, provider.baseUrl, this.settings.model);
    } else {
      // OpenAI-compatible 格式 (DeepSeek, Hunyuan)
      return this.callOpenAICompatible(prompt, provider.baseUrl, this.settings.model, systemMessage);
    }
  }

  /**
   * Google Gemini API
   */
  private async callGemini(prompt: string, baseUrl: string, model: string): Promise<string> {
    const url = `${baseUrl}/models/${model}:generateContent?key=${this.settings.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (response.status === 429) {
      this.backoffUntil = Date.now() + 60000;
      throw new Error('429 Too Many Requests');
    }
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  /**
   * OpenAI-compatible API (DeepSeek, Hunyuan)
   */
  private async callOpenAICompatible(prompt: string, baseUrl: string, model: string, systemMessage?: string): Promise<string> {
    const url = `${baseUrl}/chat/completions`;
    const sysMsg = systemMessage || 'You are a game level designer AI. Output ASCII map grids only, exactly as specified in the prompt. No markdown, no extra text.';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.settings.apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: sysMsg },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 800,
      })
    });

    if (response.status === 429) {
      this.backoffUntil = Date.now() + 60000;
      throw new Error('429 Too Many Requests');
    }
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * 解析 AI 返回的 ASCII 地图文本
   */
  private parseAsciiMap(text: string): AsciiMapChunk {
    const validChars = getValidChars();
    let theme = 'default';
    let strategy = 'AI generated';
    let narration = '';
    let analysis = '';
    let confidence = -1;
    let comments: string[] = [];
    const rows: string[] = [];

    const lines = text.split('\n');

    // 解析 header（theme / strategy / narration / analysis / confidence / comments）
    let inHeader = false;
    let headerDone = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();

      // 跳过空行
      if (line === '') continue;

      // 检测 --- 分隔符
      if (line.match(/^-{3,}$/)) {
        if (!inHeader) {
          inHeader = true;
          continue;
        } else {
          inHeader = false;
          headerDone = true;
          continue;
        }
      }

      // 解析 header 字段
      if (inHeader) {
        const themeMatch = line.match(/^theme\s*:\s*(.+)/i);
        if (themeMatch) theme = themeMatch[1].trim();
        const stratMatch = line.match(/^strategy\s*:\s*(.+)/i);
        if (stratMatch) strategy = stratMatch[1].trim();
        const narrMatch = line.match(/^narration\s*:\s*(.+)/i);
        if (narrMatch) narration = narrMatch[1].trim();
        const analysisMatch = line.match(/^analysis\s*:\s*(.+)/i);
        if (analysisMatch) analysis = analysisMatch[1].trim();
        const confMatch = line.match(/^confidence\s*:\s*(\d+)/i);
        if (confMatch) confidence = Math.min(100, Math.max(0, parseInt(confMatch[1])));
        const commMatch = line.match(/^comments\s*:\s*(.+)/i);
        if (commMatch) {
          comments = commMatch[1].split('|').map(s => s.trim()).filter(s => s.length > 0);
        }
        continue;
      }

      // header 之后（或无 header）解析地图行
      if (headerDone || !inHeader) {
        // 提取可能的地图行：取前 8-10 个非空白字符
        // 去掉可能的 # 边界
        let mapLine = line.replace(/^#/, '').replace(/#$/, '');
        // 只保留有效字符
        let cleaned = '';
        for (const ch of mapLine) {
          if (validChars.has(ch)) {
            cleaned += ch;
          }
        }
        // 必须长度在 6-10 之间才认为是地图行
        if (cleaned.length >= 6 && cleaned.length <= 12) {
          // 标准化到 8 字符
          if (cleaned.length < 8) {
            cleaned = cleaned.padEnd(8, '.');
          } else if (cleaned.length > 8) {
            cleaned = cleaned.substring(0, 8);
          }
          rows.push(cleaned);
          if (rows.length >= 20) break;
        }
      }
    }

    // 如果行数不足 20 行，用空行补齐
    while (rows.length < 20) {
      rows.push('........');
    }

    // 将 theme 映射到有效主题 ID
    theme = this.mapToValidTheme(theme);

    const result: AsciiMapChunk = { theme, strategy, rows };
    if (narration) result.narration = narration;
    if (analysis) result.analysis = analysis;
    if (confidence >= 0) result.confidence = confidence;
    if (comments.length > 0) result.comments = comments;
    return result;
  }

  /**
   * 死亡评价 - 游戏结束时调用 AI 生成个性化评语
   * 不受 rate limit 约束（一次性调用）
   */
  async generateDeathEvaluation(
    telemetry: PlayerTelemetry,
    distance: number,
    score: number,
    survivalTime: number,
    pickedCards: string[]
  ): Promise<string | null> {
    if (!this.settings.apiKey) return null;

    const biasDesc = telemetry.laneBias < -0.3 ? '偏右' :
                     telemetry.laneBias > 0.3 ? '偏左' : '居中';

    const prompt = `你是一个 3D 赛马无限跑酷游戏中的"AI 设计师"，玩家刚刚撞死了。
请用你的语气（傲慢、戏谑、略带嘲讽但不恶意）给玩家写一句死亡评语。

玩家数据：
- 跑了 ${Math.floor(distance)} 米，存活 ${survivalTime.toFixed(1)} 秒
- 收集物得分：${score}
- 行为风格：${telemetry.style}（${biasDesc}）
- 碰撞次数：${telemetry.crashCount}
- 选择过的卡牌：${pickedCards.length > 0 ? pickedCards.join('、') : '无'}

要求：
- 用中文
- 一句话，15-30字
- 要体现"AI在分析你"的感觉
- 可以针对玩家的弱点（比如总往某一侧跑、太保守、太鲁莽等）

只输出评语文本，不要加引号或前缀。`;

    const deathSystemMsg = '你是一个 3D 赛马无限跑酷游戏中的 AI 设计师，以傲慢戏谑的语气给玩家写死亡评语。只输出中文评语文本。';

    try {
      const text = await this.callAPI(prompt, deathSystemMsg);
      const cleaned = text.trim().replace(/^["'「]/, '').replace(/["'」]$/, '');
      return cleaned || null;
    } catch (err) {
      console.warn('[GeminiArchitect] evaluateDeath 失败:', err);
      return null;
    }
  }

  /**
   * AI 教练分析 — 根据玩家统计数据生成个性化教练点评
   * 不受 rate limit 约束（一次性调用）
   */
  async generateCoachAnalysis(stats: {
    totalRaces: number;
    bestDistance: number;
    avgDistance: number;
    recentDistances: number[];
    totalTrophies: number;
    speedLevel: number;
    rebirthCount: number;
  }): Promise<string | null> {
    if (!this.settings.apiKey) return null;

    const trend = stats.recentDistances.length >= 3
      ? stats.recentDistances.join(' → ')
      : '数据不足';

    const prompt = `你是一个 3D 赛马游戏中的"AI 教练"，负责分析玩家的比赛表现。
请根据以下统计数据，写出 2-3 句个性化分析点评。

玩家数据：
- 总比赛次数：${stats.totalRaces}
- 最佳距离：${stats.bestDistance}m
- 平均距离：${stats.avgDistance}m
- 最近几局距离趋势：${trend}
- 累计奖杯：${stats.totalTrophies}
- 速度等级：${stats.speedLevel}
- 重生次数：${stats.rebirthCount}

要求：
- 用中文
- 2-3句话，总共50-80字
- 语气专业但幽默，像一个自信的AI教练
- 分析成长趋势、指出强弱项、给出简短建议
- 要体现"AI在分析你的数据"的智能感
- 不要加引号或前缀

只输出点评文本。`;

    const coachSystemMsg = '你是一个 3D 赛马游戏中的 AI 教练，擅长分析玩家比赛数据并给出个性化点评。只输出中文点评文本，不要加任何前缀或格式。';

    try {
      const text = await this.callAPI(prompt, coachSystemMsg);
      const cleaned = text.trim().replace(/^["'「]/, '').replace(/["'」]$/, '');
      return cleaned || null;
    } catch (err) {
      console.warn('[GeminiArchitect] generateCoachAnalysis 失败:', err);
      return null;
    }
  }

  /**
   * 生成出生点场景配置 — 根据玩家描述选择主题和装饰
   * 返回适合出生区域的主题 ID
   */
  async generateSpawnTheme(spawnDescription: string): Promise<string | null> {
    if (!this.settings.apiKey || !spawnDescription) return null;
    
    const themeIds = getThemeIds();
    const prompt = `You are a theme selector for a horse parkour game spawn area.
The player wants this spawn scene: "${spawnDescription}"

Available themes: ${themeIds.join(', ')}

Reply with ONLY ONE theme ID that best matches the description. Nothing else.`;

    const themeSystemMsg = 'You are a theme selector for a horse parkour game. Reply with only a theme ID, nothing else.';
    
    try {
      const text = await this.callAPI(prompt, themeSystemMsg);
      const cleaned = text.trim().toLowerCase();
      if (themeIds.includes(cleaned)) return cleaned;
      return this.mapToValidTheme(cleaned);
    } catch (err) {
      console.warn('[GeminiArchitect] generateSpawnTheme 失败:', err);
      return null;
    }
  }

  // ============ 马厩场景 AI 生成 ============

  /**
   * 可用装饰物类型列表（供 prompt 使用）
   */
  private static AVAILABLE_DECORATIONS = [
    'flower_bush', 'mushroom', 'bush', 'cactus', 'desert_rock', 'dry_grass',
    'street_lamp', 'snow_tree', 'ice_block', 'snow_mound', 'dark_tree',
    'firefly_light', 'cherry_tree', 'lava_rock', 'smoke_column', 'charred_tree',
    'crystal_pillar', 'stalactite', 'neon_pole', 'light_wall', 'coral',
    'seaweed', 'ruin_pillar', 'vines', 'cloud_pillar', 'rainbow_arc',
    'lava_fountain', 'flame_wall',
    // 新增装饰物
    'bamboo', 'sunflower', 'willow_tree', 'pond', 'windmill', 'campfire',
    'totem_pole', 'mailbox', 'magic_crystal', 'portal_ring', 'floating_island', 'lantern',
  ];

  /**
   * 可用树木风格列表
   */
  private static AVAILABLE_TREE_STYLES = [
    'pine', 'cherry', 'dark', 'snow', 'charred', 'forest', 'palm',
    // 新增树木风格
    'bamboo_tree', 'willow', 'sakura', 'autumn',
    'none',
  ];

  /**
   * 可用粒子类型列表
   */
  private static AVAILABLE_PARTICLES = [
    'snow', 'petal', 'ember', 'firefly', 'bubble', 'crystal', 'dust', 'none',
  ];

  /**
   * StableSceneConfig 默认值（作为回退和缺失字段补全）
   */
  static readonly DEFAULT_STABLE_CONFIG: StableSceneConfig = {
    skyColor: '#88CCFF',
    fogColor: '#88CCFF',
    fogNear: 50,
    fogFar: 150,
    groundColor: '#C68E6E',
    grassColor: '#8FBC5A',
    ambientColor: '#FFF8F0',
    ambientIntensity: 0.85,
    sunColor: '#FFEDD5',
    sunIntensity: 1.1,
    sunVisualColor: '#FFFF88',
    mountainColors: ['#8B9DAF', '#7D8E9F', '#8899AA', '#6B8E6B', '#7A9B7A'],
    mountainSnowCap: true,
    mountainSnowColor: '#F0F0F0',
    treeStyle: 'pine',
    foliageColor: '#1B5E20',
    trunkColor: '#6B4226',
    waterColor: '#4FC3F7',
    waterShineColor: '#81D4FA',
    waterOpacity: 0.7,
    fenceColor: '#8B6914',
    fencePostColor: '#6B4F1A',
    decorations: ['flower_bush', 'bush', 'mushroom'],
    decorationColors: ['#FF69B4', '#FFD700', '#FF6347', '#9370DB'],
    particleType: 'none',
    particleColor: '#FFFFFF',
  };

  /**
   * 根据玩家任意描述，调用 LLM 生成完整的马厩场景配置
   * 不受常规 rate limit 限制（一次性调用）
   */
  async generateStableSceneConfig(description: string): Promise<StableSceneConfig | null> {
    if (!this.settings.apiKey || !description) return null;

    const prompt = `你是一个 3D 卡通风格赛马游戏的场景设计 AI。玩家在马厩主场景中输入了一段场景风格描述，你需要根据描述生成一套完整的视觉配置参数。

玩家描述: "${description}"

请输出一个 JSON 对象（纯 JSON，不要 markdown 代码块，不要额外文字），包含以下字段：

{
  "skyColor": "#RRGGBB",         // 天空背景颜色
  "fogColor": "#RRGGBB",         // 雾效颜色（通常与天空接近）
  "fogNear": 10-80,              // 雾效起始距离
  "fogFar": 60-200,              // 雾效结束距离
  "groundColor": "#RRGGBB",      // 马厩地面颜色
  "grassColor": "#RRGGBB",       // 周围草地颜色
  "ambientColor": "#RRGGBB",     // 环境光颜色
  "ambientIntensity": 0.1-1.0,   // 环境光强度
  "sunColor": "#RRGGBB",         // 太阳光颜色
  "sunIntensity": 0.1-1.5,       // 太阳光强度
  "sunVisualColor": "#RRGGBB",   // 太阳球体显示颜色
  "mountainColors": ["#RRGGBB", ...],  // 3-5 个山脉颜色
  "mountainSnowCap": true/false, // 山顶是否有雪盖
  "mountainSnowColor": "#RRGGBB",// 雪盖颜色
  "treeStyle": "...",            // 树木风格，可选: ${GeminiArchitect.AVAILABLE_TREE_STYLES.join(', ')}
  "foliageColor": "#RRGGBB",     // 树叶颜色
  "trunkColor": "#RRGGBB",       // 树干颜色
  "waterColor": "#RRGGBB",       // 水面颜色
  "waterShineColor": "#RRGGBB",  // 水面高光颜色
  "waterOpacity": 0.3-0.9,       // 水面透明度
  "fenceColor": "#RRGGBB",       // 围栏颜色
  "fencePostColor": "#RRGGBB",   // 围栏柱子颜色
  "decorations": ["...", ...],   // 3-6 个装饰物，可选: ${GeminiArchitect.AVAILABLE_DECORATIONS.join(', ')}
  "decorationColors": ["#RRGGBB", ...],  // 4-6 个装饰物使用的颜色
  "particleType": "...",         // 粒子效果类型，可选: ${GeminiArchitect.AVAILABLE_PARTICLES.join(', ')}
  "particleColor": "#RRGGBB"     // 粒子颜色
}

要求：
1. 根据玩家描述创造性地设计颜色方案，不要拘泥于真实世界的颜色
2. 例如"糖果王国"应使用大量粉色、紫色、黄色等甜蜜色调
3. "星际太空"应使用深蓝色、紫色、银色等太空色调
4. 装饰物要与描述的主题匹配，如"海底"应选 coral、seaweed，"火山"应选 lava_rock、flame_wall
5. 所有颜色必须是有效的 "#RRGGBB" 格式
6. 数值必须在规定范围内
7. 只输出 JSON，不要任何其他文字`;

    const sceneSystemMsg = '你是一个 3D 卡通风格赛马游戏的场景设计 AI。根据玩家描述生成场景配置 JSON。只输出 JSON，不要任何其他文字。';

    try {
      const text = await this.callAPI(prompt, sceneSystemMsg);
      return this.parseStableSceneConfig(text);
    } catch (e) {
      console.warn('[GeminiArchitect] generateStableSceneConfig 失败:', e);
      return null;
    }
  }

  /**
   * 解析 LLM 返回的 StableSceneConfig JSON
   * 带有健壮的校验和默认值填充
   */
  private parseStableSceneConfig(text: string): StableSceneConfig {
    const defaults = GeminiArchitect.DEFAULT_STABLE_CONFIG;

    // 从返回文本中提取 JSON（可能被 markdown 代码块包裹）
    let jsonStr = text.trim();
    // 去掉 ```json ... ``` 包裹
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }
    // 尝试找到 { ... } 块
    const braceStart = jsonStr.indexOf('{');
    const braceEnd = jsonStr.lastIndexOf('}');
    if (braceStart >= 0 && braceEnd > braceStart) {
      jsonStr = jsonStr.substring(braceStart, braceEnd + 1);
    }

    let raw: any;
    try {
      raw = JSON.parse(jsonStr);
    } catch {
      console.warn('AI 返回 JSON 解析失败，使用默认配置');
      return { ...defaults };
    }

    // 校验并填充
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    const safeHex = (val: any, fallback: string): string =>
      typeof val === 'string' && hexRegex.test(val) ? val : fallback;
    const safeNum = (val: any, min: number, max: number, fallback: number): number => {
      const n = typeof val === 'number' ? val : parseFloat(val);
      if (isNaN(n)) return fallback;
      return Math.max(min, Math.min(max, n));
    };
    const safeArr = (val: any, allowed: string[], fallback: string[]): string[] => {
      if (!Array.isArray(val)) return fallback;
      const filtered = val.filter((v: any) => typeof v === 'string' && allowed.includes(v));
      return filtered.length > 0 ? filtered : fallback;
    };
    const safeHexArr = (val: any, fallback: string[]): string[] => {
      if (!Array.isArray(val)) return fallback;
      const filtered = val.filter((v: any) => typeof v === 'string' && hexRegex.test(v));
      return filtered.length > 0 ? filtered : fallback;
    };

    const config: StableSceneConfig = {
      skyColor: safeHex(raw.skyColor, defaults.skyColor),
      fogColor: safeHex(raw.fogColor, defaults.fogColor),
      fogNear: safeNum(raw.fogNear, 10, 80, defaults.fogNear),
      fogFar: safeNum(raw.fogFar, 60, 200, defaults.fogFar),
      groundColor: safeHex(raw.groundColor, defaults.groundColor),
      grassColor: safeHex(raw.grassColor, defaults.grassColor),
      ambientColor: safeHex(raw.ambientColor, defaults.ambientColor),
      ambientIntensity: safeNum(raw.ambientIntensity, 0.1, 1.0, defaults.ambientIntensity),
      sunColor: safeHex(raw.sunColor, defaults.sunColor),
      sunIntensity: safeNum(raw.sunIntensity, 0.1, 1.5, defaults.sunIntensity),
      sunVisualColor: safeHex(raw.sunVisualColor, defaults.sunVisualColor),
      mountainColors: safeHexArr(raw.mountainColors, defaults.mountainColors),
      mountainSnowCap: typeof raw.mountainSnowCap === 'boolean' ? raw.mountainSnowCap : defaults.mountainSnowCap,
      mountainSnowColor: safeHex(raw.mountainSnowColor, defaults.mountainSnowColor),
      treeStyle: GeminiArchitect.AVAILABLE_TREE_STYLES.includes(raw.treeStyle) ? raw.treeStyle : defaults.treeStyle,
      foliageColor: safeHex(raw.foliageColor, defaults.foliageColor),
      trunkColor: safeHex(raw.trunkColor, defaults.trunkColor),
      waterColor: safeHex(raw.waterColor, defaults.waterColor),
      waterShineColor: safeHex(raw.waterShineColor, defaults.waterShineColor),
      waterOpacity: safeNum(raw.waterOpacity, 0.3, 0.9, defaults.waterOpacity),
      fenceColor: safeHex(raw.fenceColor, defaults.fenceColor),
      fencePostColor: safeHex(raw.fencePostColor, defaults.fencePostColor),
      decorations: safeArr(raw.decorations, GeminiArchitect.AVAILABLE_DECORATIONS, defaults.decorations),
      decorationColors: safeHexArr(raw.decorationColors, defaults.decorationColors),
      particleType: GeminiArchitect.AVAILABLE_PARTICLES.includes(raw.particleType) ? raw.particleType : defaults.particleType,
      particleColor: safeHex(raw.particleColor, defaults.particleColor),
    };

    return config;
  }

  /**
   * 将 AI 返回的 theme 关键词映射到有效的 ThemeRegistry 主题 ID
   */
  private mapToValidTheme(rawTheme: string): string {
    const validIds = getThemeIds();
    const lower = rawTheme.toLowerCase().trim();

    // 直接匹配
    if (validIds.includes(lower)) return lower;

    // 关键词映射
    const keywords: Record<string, string[]> = {
      meadow: ['meadow', 'grass', 'field', 'open', 'gentle', 'intro', 'plain', '草原', '草地'],
      forest: ['forest', 'tree', 'wood', 'jungle', 'ambush', 'maze', '森林'],
      desert: ['desert', 'sand', 'rock', 'dry', 'arid', 'canyon', 'rocky', '沙漠'],
      sunset: ['sunset', 'dusk', 'evening', 'twilight', 'dawn', 'golden', '黄昏', '夕阳'],
      snow: ['snow', 'ice', 'winter', 'cold', 'frost', 'blizzard', '雪', '冰'],
      night: ['night', 'dark', 'midnight', 'moonlight', 'shadow', '夜', '黑暗'],
      cherry: ['cherry', 'sakura', 'blossom', 'pink', 'spring', 'petal', '樱花', '春'],
      volcano: ['volcano', 'fire', 'magma', 'inferno', '火山'],
      crystal: ['crystal', 'cave', 'gem', 'stalactite', 'cavern', '水晶', '洞穴', '宝石'],
      neon: ['neon', 'cyber', 'city', 'urban', 'synthwave', 'futuristic', '霓虹', '都市', '赛博'],
      underwater: ['underwater', 'ocean', 'sea', 'coral', 'fish', 'deep', 'aqua', '海底', '海洋', '水下'],
      ancient: ['ancient', 'ruin', 'temple', 'stone', 'old', 'roman', 'greek', '遗迹', '远古', '废墟', '神殿'],
      cloud: ['cloud', 'sky', 'heaven', 'float', 'rainbow', 'air', '云', '天空', '云端'],
      lava: ['lava', 'hell', 'demon', 'chaos', 'molten', 'obsidian', '熔岩', '地狱', '岩浆'],
    };

    for (const [themeId, kws] of Object.entries(keywords)) {
      for (const kw of kws) {
        if (lower.includes(kw)) return themeId;
      }
    }

    // 无法匹配时返回 meadow
    return 'meadow';
  }
}
