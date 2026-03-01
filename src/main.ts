/**
 * 游戏入口
 *
 * 创建引擎 → 加载马棚场景 → 启动循环
 */

import { Engine } from './engine/Engine'
import { Bridge } from './platform/Bridge'
import { HUD } from './ui/HUD'
import { StableScene } from './game/scenes/StableScene'
import { RaceScene } from './game/scenes/RaceScene'
import { ParkourScene } from './game/scenes/ParkourScene'
import { SettingsUI } from './ui/SettingsUI'
import type { ParkourConfig } from './data/types/GameTypes'

// ── 初始化引擎 ──

const engine = new Engine({
    container: '#game-root',
    debug: true,
    renderer: {
        antialias: true,
    },
})

const hudContainer = document.getElementById('game-root') || document.body
const hud = new HUD(hudContainer)
const settingsUI = new SettingsUI()

// ── 场景切换函数 ──

function loadStable(): void {
    const scene = new StableScene(engine, hud, {
        onStartRace: () => loadRace(),
        onStartParkour: (config?: ParkourConfig) => loadParkour(config),
    })
    engine.scenes.switch(scene)
}

function loadRace(): void {
    const scene = new RaceScene(engine, hud, {
        onRaceEnd: () => loadStable(),
    })
    engine.scenes.switch(scene)
}

function loadParkour(config?: ParkourConfig): void {
    const scene = new ParkourScene(engine, hud, {
        onEnd: () => loadStable(),
    }, config)
    engine.scenes.switch(scene)
}

// ── 平台通信 ──

const bridge = new Bridge()

bridge.on('play', () => {
    engine.resume()
    bridge.sendStatus({ status: 'running' })
})

bridge.on('pause', () => {
    engine.pause()
    bridge.sendStatus({ status: 'paused' })
})

bridge.on('reset', () => {
    location.reload()
})

bridge.on('debug', ({ enabled }: { enabled: boolean }) => {
    engine.debug = enabled
})

bridge.on('scene', ({ name }: { name: string }) => {
    switch (name) {
        case 'stable': loadStable(); break
        case 'race': loadRace(); break
        case 'parkour': loadParkour(); break
    }
})

// ── 启动（默认马棚场景）──

loadStable()
engine.start()

// 隐藏加载界面
const loading = document.getElementById('loading-overlay')
if (loading) loading.classList.add('fade-out')

// 通知平台就绪
bridge.sendReady()
bridge.sendStatus({ status: 'running', tick: 0, fps: 60, entityCount: 0 })

// 首次点击时恢复 AudioContext
document.addEventListener('click', () => engine.audio.resume(), { once: true })
