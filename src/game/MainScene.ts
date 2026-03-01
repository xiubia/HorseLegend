import * as THREE from 'three'
import { ChunkManager } from './ChunkManager'
import { Horse } from '../entities/Horse'
import { Obstacle } from '../data/types/GameTypes'

import { PlayerBehaviorTracker } from '../systems/PlayerBehaviorTracker'

export class MainScene {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private chunkManager: ChunkManager
  private player: Horse
  private tracker!: PlayerBehaviorTracker
  private clock = new THREE.Clock()
  private score = 0
  private gameOver = false
  private statusDiv!: HTMLDivElement
  private messageDiv!: HTMLDivElement
  private keys: { [key: string]: boolean } = {}

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene
    this.camera = camera
    this.chunkManager = new ChunkManager(scene)
    
    // Initialize player with default config
    this.player = new Horse('player', {
      id: 'player_1',
      name: 'Player',
      bodyColor: '#8B4513',
      maneColor: '#4A2500'
    })
  }

  init() {
    // Setup camera
    this.camera.position.set(0, 5, -10)
    this.camera.lookAt(0, 0, 10)
    this.camera.fov = 60
    this.camera.updateProjectionMatrix()

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene.add(ambientLight)

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(10, 20, 10)
    dirLight.castShadow = true
    this.scene.add(dirLight)

    // Init Chunk Manager
    this.chunkManager.init()

    // Init Tracker
    this.tracker = new PlayerBehaviorTracker()
    this.chunkManager.setTracker(this.tracker)

    // Init Player
    this.player.createMesh()
    if (this.player.mesh) {
      this.scene.add(this.player.mesh)
    }
    this.player.startRunning() // Auto run

    // Setup Input
    this.setupInput()

    // UI
    this.createUI()
    
    // Background
    this.scene.background = new THREE.Color(0x87CEEB) // Sky blue
    this.scene.fog = new THREE.Fog(0x87CEEB, 20, 60)
  }

  private setupInput() {
    window.addEventListener('keydown', (e) => { this.keys[e.code] = true })
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false })
  }

  private createUI() {
    this.statusDiv = document.createElement('div')
    this.statusDiv.style.cssText = `
      position: fixed; top: 10px; left: 10px; padding: 15px;
      background: rgba(0,0,0,0.5); color: white; font-family: sans-serif;
      font-size: 14px; border-radius: 8px; z-index: 1000;
    `
    document.body.appendChild(this.statusDiv)

    this.messageDiv = document.createElement('div')
    this.messageDiv.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      padding: 20px 40px; background: rgba(0,0,0,0.9); color: white;
      font-family: Arial; font-size: 28px; border-radius: 10px;
      z-index: 1001; display: none; text-align: center; border: 2px solid #00ff88;
    `
    document.body.appendChild(this.messageDiv)
  }

  update() {
    if (this.gameOver) return

    const delta = this.clock.getDelta()

    // Player Movement Input (Left/Right)
    const moveSpeed = 5 * delta
    if (!this.player.mesh) return
    
    // 坐标系：相机看向+Z，屏幕右方=世界-X
    // 实测: rotation.z>0=屏幕右倾, rotation.z<0=屏幕左倾
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
      this.player.mesh.position.x += moveSpeed  // +X = 屏幕左
      this.player.mesh.rotation.z = -0.1  // 屏幕左倾 ✓
    } else if (this.keys['KeyD'] || this.keys['ArrowRight']) {
      this.player.mesh.position.x -= moveSpeed  // -X = 屏幕右
      this.player.mesh.rotation.z = 0.1   // 屏幕右倾 ✓
    } else {
      this.player.mesh.rotation.z = 0
    }
    
    // Clamp X position
    this.player.mesh.position.x = Math.max(-3.5, Math.min(3.5, this.player.mesh.position.x))

    // Update Player (Forward movement)
    this.player.update(delta)

    // Update Telemetry
    this.tracker.update(this.player.mesh.position.x, this.player.mesh.position.z, this.player.speed)

    // Update Chunks
    this.chunkManager.update(this.player.position.z)

    // Collisions
    this.checkCollisions()

    // Camera Follow
    this.camera.position.x = this.player.position.x * 0.3
    this.camera.position.z = this.player.position.z - 8
    this.camera.position.y = 4
    this.camera.lookAt(this.player.position.x * 0.1, 1, this.player.position.z + 5)

    // UI
    this.updateUI()
  }

  private checkCollisions() {
    if (!this.player.mesh) return
    const obstacles = this.chunkManager.getObstacles()
    const playerBox = new THREE.Box3().setFromObject(this.player.mesh)
    // Shrink player box slightly for fairer collisions
    playerBox.expandByScalar(-0.2)

    for (const obs of obstacles) {
      // Simple distance check first for optimization
      if (Math.abs(obs.position.z - this.player.position.z) > 2) continue

      // Since we don't have direct access to obstacle meshes easily in this loop without a map,
      // we'll approximate collision with bounding boxes based on position and size
      const obsSize = obs.width // Approx size
      const obsBox = new THREE.Box3(
        new THREE.Vector3(obs.position.x - obsSize/2, 0, obs.position.z - 0.5),
        new THREE.Vector3(obs.position.x + obsSize/2, 2, obs.position.z + 0.5)
      )

      if (playerBox.intersectsBox(obsBox)) {
        this.gameOver = true
        this.showMessage('GAME OVER')
      }
    }
  }

  private updateUI() {
    this.statusDiv.innerHTML = `
      <div>Score: ${Math.floor(this.player.position.z)}m</div>
      <div>Speed: ${this.player.speed.toFixed(1)} m/s</div>
    `
  }

  private showMessage(text: string) {
    this.messageDiv.textContent = text
    this.messageDiv.style.display = 'block'
  }
}
