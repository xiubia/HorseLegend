/**
 * 3D Audio System - 音频系统
 * 
 * 基于 Web Audio API 的游戏音效系统
 */

// 音效配置
interface SoundConfig {
    src: string
    volume?: number
    throttleMs?: number
    loop?: boolean
}

// 默认音效定义（可根据需要修改）
const SOUNDS: Record<string, SoundConfig> = {
    // 示例音效配置
    // footstep: { src: 'footstep.mp3', volume: 0.3, throttleMs: 200 },
    // jump: { src: 'jump.mp3', volume: 0.5, throttleMs: 300 },
    // impact: { src: 'impact.mp3', volume: 0.6, throttleMs: 150 },
}

// BGM 文件（可根据需要修改）
const BGM_FILE = ''

interface LoadedSound {
    buffer: AudioBuffer
    config: SoundConfig
    lastPlayTime: number
}

export class AudioManager {
    private ctx: AudioContext | null = null
    private masterGain: GainNode | null = null
    private sfxGain: GainNode | null = null
    private bgmGain: GainNode | null = null

    private sounds: Map<string, LoadedSound> = new Map()
    private bgmBuffer: AudioBuffer | null = null
    private currentBgmSource: AudioBufferSourceNode | null = null

    private _masterVolume = 0.7
    private _sfxVolume = 1.0
    private _bgmVolume = 0.4
    private _muted = false

    private basePath: string
    private initialized = false

    constructor(basePath: string = '/assets/music/') {
        this.basePath = basePath
    }

    /**
     * 初始化音频系统
     */
    async init(): Promise<boolean> {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext
            this.ctx = new AudioContext()

            // 创建增益节点链
            this.masterGain = this.ctx.createGain()
            this.masterGain.connect(this.ctx.destination)
            this.masterGain.gain.value = this._masterVolume

            this.sfxGain = this.ctx.createGain()
            this.sfxGain.connect(this.masterGain)
            this.sfxGain.gain.value = this._sfxVolume

            this.bgmGain = this.ctx.createGain()
            this.bgmGain.connect(this.masterGain)
            this.bgmGain.gain.value = this._bgmVolume

            this.initialized = true
            console.log('[AudioManager] Initialized')
            return true
        } catch (e) {
            console.error('[AudioManager] Failed to initialize:', e)
            return false
        }
    }

    /**
     * 确保 AudioContext 已启动（需要用户交互）
     */
    async resume(): Promise<void> {
        if (this.ctx && this.ctx.state === 'suspended') {
            try {
                await this.ctx.resume()
                console.log('[AudioManager] AudioContext resumed')
            } catch (e) {
                console.error('[AudioManager] Failed to resume:', e)
            }
        }
    }

    /**
     * 预加载所有音效
     */
    async preload(): Promise<void> {
        if (!this.ctx) {
            await this.init()
        }

        // 加载音效
        for (const [key, config] of Object.entries(SOUNDS)) {
            try {
                const buffer = await this.loadAudioFile(config.src)
                this.sounds.set(key, {
                    buffer,
                    config,
                    lastPlayTime: 0,
                })
            } catch (e) {
                console.warn(`[AudioManager] Failed to load ${key}:`, e)
            }
        }

        // 加载 BGM
        if (BGM_FILE) {
            try {
                this.bgmBuffer = await this.loadAudioFile(BGM_FILE)
            } catch (e) {
                console.warn('[AudioManager] Failed to load BGM:', e)
            }
        }

        console.log(`[AudioManager] Loaded ${this.sounds.size} sounds`)
    }

    private async loadAudioFile(filename: string): Promise<AudioBuffer> {
        if (!this.ctx) throw new Error('AudioContext not initialized')

        const response = await fetch(this.basePath + filename)
        const arrayBuffer = await response.arrayBuffer()
        return await this.ctx.decodeAudioData(arrayBuffer)
    }

    /**
     * 播放音效
     */
    play(soundId: string, options?: { volume?: number }): void {
        if (!this.initialized || this._muted || !this.ctx || !this.sfxGain) return

        const sound = this.sounds.get(soundId)
        if (!sound) return

        const now = performance.now()

        // 节流
        if (sound.config.throttleMs && now - sound.lastPlayTime < sound.config.throttleMs) return

        try {
            const source = this.ctx.createBufferSource()
            source.buffer = sound.buffer

            const gainNode = this.ctx.createGain()
            const volume = (options?.volume ?? 1) * (sound.config.volume ?? 1)
            gainNode.gain.value = volume

            source.connect(gainNode)
            gainNode.connect(this.sfxGain)
            source.start(0)

            sound.lastPlayTime = now
        } catch (e) {
            console.error(`[AudioManager] Failed to play ${soundId}:`, e)
        }
    }

    /**
     * 播放 BGM
     */
    playBGM(): void {
        if (!this.initialized || !this.ctx || !this.bgmGain || !this.bgmBuffer) return

        this.stopBGM()

        try {
            this.currentBgmSource = this.ctx.createBufferSource()
            this.currentBgmSource.buffer = this.bgmBuffer
            this.currentBgmSource.loop = true
            this.currentBgmSource.connect(this.bgmGain)
            this.currentBgmSource.start(0)

            console.log('[AudioManager] Playing BGM')
        } catch (e) {
            console.error('[AudioManager] Failed to play BGM:', e)
        }
    }

    stopBGM(): void {
        if (this.currentBgmSource) {
            try {
                this.currentBgmSource.stop()
            } catch (e) {
                // Ignore
            }
            this.currentBgmSource = null
        }
    }

    get masterVolume(): number { return this._masterVolume }
    set masterVolume(value: number) {
        this._masterVolume = Math.max(0, Math.min(1, value))
        if (this.masterGain) {
            this.masterGain.gain.value = this._masterVolume
        }
    }

    get muted(): boolean { return this._muted }
    set muted(value: boolean) {
        this._muted = value
        if (this.masterGain) {
            this.masterGain.gain.value = value ? 0 : this._masterVolume
        }
    }

    toggleMute(): void {
        this.muted = !this.muted
    }

    destroy(): void {
        this.stopBGM()
        if (this.ctx) {
            this.ctx.close()
            this.ctx = null
        }
        this.sounds.clear()
        this.bgmBuffer = null
        this.initialized = false
    }
}
