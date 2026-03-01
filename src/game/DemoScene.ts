import * as THREE from 'three'
import { GameScene } from '../engine/SceneManager'
import { Engine } from '../engine/Engine'

/**
 * 基础 3D 演示场景
 */
export class DemoScene implements GameScene {
    private scene: THREE.Scene
    private camera: THREE.PerspectiveCamera
    private engine: Engine | null = null

    // 演示对象：一个不断旋转的立方体
    private cube: THREE.Mesh

    constructor() {
        this.scene = new THREE.Scene()
        this.scene.background = new THREE.Color(0x202020)

        // 初始化相机
        const aspect = window.innerWidth / window.innerHeight
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000)
        this.camera.position.set(2, 2, 5)
        this.camera.lookAt(0, 0, 0)

        // 添加光源
        const ambientLight = new THREE.AmbientLight(0x404040, 2)
        this.scene.add(ambientLight)

        const dirLight = new THREE.DirectionalLight(0xffffff, 1)
        dirLight.position.set(5, 5, 5)
        dirLight.castShadow = true
        this.scene.add(dirLight)

        // 添加一个测试用的立方体
        const geometry = new THREE.BoxGeometry()
        const material = new THREE.MeshStandardMaterial({ color: 0x00ff88, roughness: 0.1, metalness: 0.8 })
        this.cube = new THREE.Mesh(geometry, material)
        this.cube.castShadow = true
        this.cube.receiveShadow = true
        this.scene.add(this.cube)
    }

    onEnter(engine: Engine): void {
        console.log('[DemoScene] Enter')
        this.engine = engine
    }

    onUpdate(dt: number): void {
        // 自转动画
        this.cube.rotation.x += 1 * dt
        this.cube.rotation.y += 2 * dt

        // 提交渲染
        if (this.engine) {
            this.engine.renderer.render(this.scene, this.camera)
        }
    }

    onFixedUpdate(fixedDt: number): void {
        // 物理更新，本演示无具体物理引擎介入
    }

    onExit(): void {
        console.log('[DemoScene] Exit')
    }

    /** 响应窗口重置大小（Engine 内部调用） */
    onResize(width: number, height: number): void {
        this.camera.aspect = width / height
        this.camera.updateProjectionMatrix()
    }
}
