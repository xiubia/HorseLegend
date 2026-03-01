/**
 * 引擎主类
 *
 * 整合渲染、事件、场景管理的入口封装。
 * 集成 World（场景管理）、Camera、InputManager。
 */

import * as THREE from 'three'
import { SceneManager } from './SceneManager'
import { Clock } from './Clock'
import { AudioManager } from '../audio/AudioManager'
import { World } from '../world/World'
import { InputManager } from '../input/InputManager'

export interface EngineConfig {
    container: string | HTMLElement
    debug?: boolean
    renderer?: THREE.WebGLRendererParameters
}

export class Engine {
    public readonly renderer: THREE.WebGLRenderer
    public readonly scenes: SceneManager
    public readonly clock: Clock
    public readonly audio: AudioManager
    public readonly world: World
    public readonly camera: THREE.PerspectiveCamera
    public readonly input: InputManager

    public debug: boolean
    private isPlaying: boolean = false
    private animationFrameId: number = 0
    private containerElement: HTMLElement

    constructor(config: EngineConfig) {
        this.debug = config.debug ?? false

        // 绑定容器
        if (typeof config.container === 'string') {
            const el = document.querySelector(config.container)
            if (!el) throw new Error(`Container ${config.container} not found.`)
            this.containerElement = el as HTMLElement
        } else {
            this.containerElement = config.container
        }

        // 初始化渲染器
        this.renderer = new THREE.WebGLRenderer(config.renderer)
        this.renderer.setSize(window.innerWidth, window.innerHeight)
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        this.renderer.shadowMap.enabled = true
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
        this.containerElement.appendChild(this.renderer.domElement)

        // 调整窗口大小处理
        window.addEventListener('resize', this.onWindowResize.bind(this))

        // 子系统
        this.clock = new Clock()
        this.scenes = new SceneManager()
        this.scenes.bind(this)
        this.audio = new AudioManager()
        this.world = new World()
        this.camera = new THREE.PerspectiveCamera(
            75, window.innerWidth / window.innerHeight, 0.1, 1000
        )
        this.camera.position.set(0, 5, 10)
        this.camera.lookAt(0, 0, 0)
        this.input = new InputManager()
    }

    /** 启动引擎循环 */
    start(): void {
        if (this.isPlaying) return
        this.isPlaying = true
        this.clock.reset()
        this.loop(performance.now())
    }

    /** 暂停引擎循环 */
    pause(): void {
        if (!this.isPlaying) return
        this.isPlaying = false
        if (this.animationFrameId !== 0) {
            cancelAnimationFrame(this.animationFrameId)
        }
    }

    /** 恢复引擎循环 */
    resume(): void {
        if (this.isPlaying) return
        this.isPlaying = true
        this.loop(performance.now())
    }

    private onWindowResize(): void {
        this.renderer.setSize(window.innerWidth, window.innerHeight)

        // 更新引擎相机宽高比
        this.camera.aspect = window.innerWidth / window.innerHeight
        this.camera.updateProjectionMatrix()

        // 通知当前场景
        const currentScene = this.scenes.current
        if (currentScene && (currentScene as any).onResize) {
            (currentScene as any).onResize(window.innerWidth, window.innerHeight)
        }
    }

    private loop(time: number): void {
        if (!this.isPlaying) return

        this.animationFrameId = requestAnimationFrame(this.loop.bind(this))

        const fixedSteps = this.clock.tick(time)

        // 固定步长更新（物理等）
        for (let i = 0; i < fixedSteps; i++) {
            this.scenes.fixedUpdate(this.clock.fixedDeltaTime)
        }

        // 渲染帧更新
        this.scenes.update(this.clock.deltaTime)

        // 统一渲染 — 使用引擎的 world.scene 和 camera
        this.renderer.render(this.world.scene, this.camera)

        // 帧末清除瞬时输入状态
        this.input.update()
    }
}
