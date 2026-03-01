/**
 * 资源加载器
 *
 * 统一管理纹理、GLTF 模型和音频文件的加载，内置缓存防止重复请求。
 */

import * as THREE from 'three'

export type AssetType = 'texture' | 'audio'

interface CacheEntry {
    type: AssetType
    asset: THREE.Texture | AudioBuffer
}

export class AssetLoader {
    private cache = new Map<string, CacheEntry>()
    private textureLoader = new THREE.TextureLoader()
    private pending = new Map<string, Promise<unknown>>()

    /** 加载纹理 */
    async loadTexture(url: string): Promise<THREE.Texture> {
        const cached = this.cache.get(url)
        if (cached?.type === 'texture') return cached.asset as THREE.Texture

        // 防止并发重复加载
        let promise = this.pending.get(url)
        if (!promise) {
            promise = new Promise<THREE.Texture>((resolve, reject) => {
                this.textureLoader.load(
                    url,
                    (tex) => {
                        this.cache.set(url, { type: 'texture', asset: tex })
                        this.pending.delete(url)
                        resolve(tex)
                    },
                    undefined,
                    (err) => {
                        this.pending.delete(url)
                        reject(err)
                    },
                )
            })
            this.pending.set(url, promise)
        }
        return promise as Promise<THREE.Texture>
    }

    /** 加载音频为 AudioBuffer */
    async loadAudio(url: string, audioCtx: AudioContext): Promise<AudioBuffer> {
        const cached = this.cache.get(url)
        if (cached?.type === 'audio') return cached.asset as AudioBuffer

        let promise = this.pending.get(url)
        if (!promise) {
            promise = (async () => {
                const resp = await fetch(url)
                const arrBuf = await resp.arrayBuffer()
                const audioBuf = await audioCtx.decodeAudioData(arrBuf)
                this.cache.set(url, { type: 'audio', asset: audioBuf })
                this.pending.delete(url)
                return audioBuf
            })()
            this.pending.set(url, promise)
        }
        return promise as Promise<AudioBuffer>
    }

    /**
     * 批量加载纹理
     * @param urls 纹理路径列表
     * @param onProgress 进度回调 (loaded, total)
     */
    async loadTextures(
        urls: string[],
        onProgress?: (loaded: number, total: number) => void,
    ): Promise<THREE.Texture[]> {
        let loaded = 0
        const total = urls.length
        const results: THREE.Texture[] = []

        for (const url of urls) {
            const tex = await this.loadTexture(url)
            results.push(tex)
            loaded++
            onProgress?.(loaded, total)
        }
        return results
    }

    /** 检查资源是否已缓存 */
    has(url: string): boolean {
        return this.cache.has(url)
    }

    /** 获取缓存中的纹理 (同步，需先确保已加载) */
    getTexture(url: string): THREE.Texture | undefined {
        const entry = this.cache.get(url)
        return entry?.type === 'texture' ? (entry.asset as THREE.Texture) : undefined
    }

    /** 清除缓存并释放资源 */
    dispose(): void {
        for (const entry of this.cache.values()) {
            if (entry.type === 'texture') (entry.asset as THREE.Texture).dispose()
        }
        this.cache.clear()
        this.pending.clear()
    }
}
