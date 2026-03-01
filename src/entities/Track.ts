/**
 * 赛道实体 — 动态赛道段生成与碰撞检测
 */

import * as THREE from 'three'
import { Entity } from '../world/Entity'
import { World } from '../world/World'
import type { Track as TrackData, TrackSegment, Obstacle } from '../data/types/GameTypes'

export class TrackEntity extends Entity {
    data: TrackData
    obstacles: Obstacle[] = []

    constructor(trackDataOrId: TrackData | string, trackDataArg?: TrackData) {
        super(['track'])
        this.data = typeof trackDataOrId === 'string' ? trackDataArg! : trackDataOrId
        this.generateObstacles()
    }

    private generateObstacles(): void {
        this.obstacles = []
        let z = 50
        for (const seg of this.data.segments) {
            if (seg.type === 'obstacle') {
                const count = Math.floor(seg.length / 20)
                for (let i = 0; i < count; i++) {
                    this.obstacles.push({
                        id: `obs_${this.obstacles.length}`,
                        type: ['small', 'medium', 'large'][Math.floor(Math.random() * 3)],
                        position: { x: (Math.random() - 0.5) * 6, y: 0, z: z + i * 20 + Math.random() * 10 },
                        width: 1 + Math.random() * 1.5,
                        avoidable: true,
                    })
                }
            }
            z += seg.length
        }
    }

    onInit(world: World): void {
        super.onInit(world)
        if (this.root.children.length === 0) this.createMesh()
    }

    onUpdate(_dt: number): void { /* static track */ }

    getSegmentAt(progress: number): TrackSegment | null {
        let acc = 0
        for (const seg of this.data.segments) {
            acc += seg.length
            if (progress <= acc) return seg
        }
        return this.data.segments[this.data.segments.length - 1]
    }

    getObstaclesAhead(progress: number, dist: number): Obstacle[] {
        return this.obstacles.filter(o => o.position.z > progress && o.position.z < progress + dist)
    }

    checkCollision(x: number, z: number, w = 0.5): Obstacle | null {
        for (const o of this.obstacles) {
            if (Math.abs(x - o.position.x) < (o.width + w) / 2 && Math.abs(z - o.position.z) < 1) return o
        }
        return null
    }

    get totalLength(): number { return this.data.totalLength }

    createMesh(): THREE.Object3D {
        if (this.root.children.length > 0) return this.root

        let curZ = 0
        for (const seg of this.data.segments) {
            const tw = 8
            const track = new THREE.Mesh(
                new THREE.PlaneGeometry(tw, seg.length),
                new THREE.MeshLambertMaterial({ color: 0xD2B48C, side: THREE.DoubleSide })
            )
            track.rotation.x = -Math.PI / 2
            track.position.set(0, 0.01, curZ + seg.length / 2)
            track.receiveShadow = true
            this.root.add(track)

            for (const side of [-1, 1]) {
                const grass = new THREE.Mesh(
                    new THREE.PlaneGeometry(4, seg.length),
                    new THREE.MeshLambertMaterial({ color: 0x4A7C3F, side: THREE.DoubleSide })
                )
                grass.rotation.x = -Math.PI / 2
                grass.position.set(side * 6, 0, curZ + seg.length / 2)
                this.root.add(grass)

                const line = new THREE.Mesh(
                    new THREE.PlaneGeometry(0.2, seg.length),
                    new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide })
                )
                line.rotation.x = -Math.PI / 2
                line.position.set(side * (tw / 2 - 0.3), 0.02, curZ + seg.length / 2)
                this.root.add(line)
            }
            curZ += seg.length
        }

        for (const o of this.obstacles) {
            const sizes: Record<string, [number, number]> = { small: [0.8, 0.4], medium: [1.2, 0.7], large: [1.8, 1.0] }
            const [w, h] = sizes[o.type] || sizes.medium
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.6), new THREE.MeshLambertMaterial({ color: 0x8B4513 }))
            mesh.position.set(o.position.x, h / 2, o.position.z)
            mesh.castShadow = true
            this.root.add(mesh)
        }

        // 起点/终点线
        for (const [z, c] of [[0, 0x00FF00], [this.data.totalLength, 0xFF0000]] as [number, number][]) {
            const m = new THREE.Mesh(
                new THREE.PlaneGeometry(10, 1),
                new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
            )
            m.rotation.x = -Math.PI / 2
            m.position.set(0, 0.03, z)
            this.root.add(m)
        }
        return this.root
    }
}
