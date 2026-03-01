/**
 * 尾迹特效 — 3D 拖尾粒子渲染
 * 5种风格：ribbon / spark / flame / frost / lightning
 */

import * as THREE from 'three'
import type { TrailDef, TrailParticleStyle } from '../data/TrailRegistry'

const RIBBON_SEG = 40
const MAX_PART = 80
const LIGHTNING_SEG = 12
const _yAxis = new THREE.Vector3(0, 1, 0)

export class TrailEffect {
    private scene: THREE.Scene
    private group: THREE.Group
    private def: TrailDef | null = null
    private style: TrailParticleStyle = 'none'

    // Ribbon
    private ribbonMesh: THREE.Mesh | null = null
    private ribbonPos: Float32Array | null = null
    private ribbonCol: Float32Array | null = null
    private ribbonHist: THREE.Vector3[] = []

    // Particles
    private ptsMesh: THREE.Points | null = null
    private ptsPos: Float32Array | null = null
    private ptsCol: Float32Array | null = null
    private ptsSz: Float32Array | null = null
    private ptsLife: Float32Array | null = null
    private ptsVel: THREE.Vector3[] = []

    // Lightning
    private ltLine: THREE.LineSegments | null = null
    private ltPos: Float32Array | null = null
    private ltTimer = 0

    private pc = new THREE.Color()
    private sc = new THREE.Color()
    private ready = false

    constructor(scene: THREE.Scene) {
        this.scene = scene
        this.group = new THREE.Group()
        scene.add(this.group)
    }

    setTrail(trail: TrailDef): void {
        this.clear()
        this.def = trail
        this.style = trail.particleStyle
        if (this.style === 'none') return
        this.pc.set(trail.primaryColor)
        this.sc.set(trail.secondaryColor)

        if (this.style === 'ribbon') this.initRibbon()
        else if (this.style === 'lightning') this.initLightning()
        else this.initParticles()
        this.ready = true
    }

    update(horsePos: THREE.Vector3, speed: number, dt: number, rotY = 0): void {
        if (!this.ready || this.style === 'none') return
        const raw = new THREE.Vector3(0, 0.9, -0.7)
        if (rotY !== 0) raw.applyAxisAngle(_yAxis, rotY)
        const emit = horsePos.clone().add(raw)

        if (this.style === 'ribbon') this.updateRibbon(emit, speed)
        else if (this.style === 'lightning') this.updateLightning(emit, speed, dt, rotY)
        else this.updateParticles(emit, speed, dt, rotY)
    }

    dispose(): void { this.clear(); this.scene.remove(this.group) }

    // ── Ribbon ──

    private initRibbon(): void {
        const vc = RIBBON_SEG * 2
        this.ribbonPos = new Float32Array(vc * 3)
        this.ribbonCol = new Float32Array(vc * 4)

        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(this.ribbonPos, 3))
        geo.setAttribute('color', new THREE.BufferAttribute(this.ribbonCol, 4))

        const idx: number[] = []
        for (let i = 0; i < RIBBON_SEG - 1; i++) {
            const a = i * 2, b = a + 1, c = (i + 1) * 2, d = c + 1
            idx.push(a, c, b, b, c, d)
        }
        geo.setIndex(idx)

        this.ribbonMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            vertexColors: true, transparent: true, side: THREE.DoubleSide,
            depthWrite: false, blending: THREE.AdditiveBlending,
        }))
        this.ribbonMesh.frustumCulled = false
        this.group.add(this.ribbonMesh)
    }

    private updateRibbon(emit: THREE.Vector3, speed: number): void {
        if (!this.ribbonPos || !this.ribbonCol || !this.ribbonMesh) return
        if (this.ribbonHist.length === 0 || emit.distanceTo(this.ribbonHist[0]) > 0.12) {
            this.ribbonHist.unshift(emit.clone())
            if (this.ribbonHist.length > RIBBON_SEG) this.ribbonHist.length = RIBBON_SEG
        }
        const w = 0.08 + Math.min(speed * 0.012, 0.17)
        const now = performance.now()

        for (let i = 0; i < RIBBON_SEG; i++) {
            const p = i < this.ribbonHist.length ? this.ribbonHist[i] : (this.ribbonHist.length > 0 ? this.ribbonHist[this.ribbonHist.length - 1] : emit)
            const t = i / RIBBON_SEG
            const ww = w * (1 - t * 0.6)
            const wx = Math.sin(i * 0.4 + now * 0.004) * 0.06 * (1 - t * 0.5)
            const wy = Math.sin(i * 0.5 + now * 0.003) * 0.15 * (1 - t * 0.3)
            const ii = i * 6
            this.ribbonPos[ii] = p.x + wx; this.ribbonPos[ii + 1] = p.y + ww + wy; this.ribbonPos[ii + 2] = p.z
            this.ribbonPos[ii + 3] = p.x + wx; this.ribbonPos[ii + 4] = p.y - ww + wy * 0.5; this.ribbonPos[ii + 5] = p.z

            const alpha = Math.max(0, (1 - t * 0.8) * Math.min(speed * 0.12, 1))
            const cr = THREE.MathUtils.lerp(this.pc.r, this.sc.r, t)
            const cg = THREE.MathUtils.lerp(this.pc.g, this.sc.g, t)
            const cb = THREE.MathUtils.lerp(this.pc.b, this.sc.b, t)
            const ci = i * 8
            this.ribbonCol[ci] = cr; this.ribbonCol[ci + 1] = cg; this.ribbonCol[ci + 2] = cb; this.ribbonCol[ci + 3] = alpha
            this.ribbonCol[ci + 4] = cr; this.ribbonCol[ci + 5] = cg; this.ribbonCol[ci + 6] = cb; this.ribbonCol[ci + 7] = alpha * 0.6
        }
        ; (this.ribbonMesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
            ; (this.ribbonMesh.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true
    }

    // ── Particles ──

    private initParticles(): void {
        this.ptsPos = new Float32Array(MAX_PART * 3)
        this.ptsCol = new Float32Array(MAX_PART * 3)
        this.ptsSz = new Float32Array(MAX_PART)
        this.ptsLife = new Float32Array(MAX_PART)
        this.ptsVel = Array.from({ length: MAX_PART }, () => new THREE.Vector3())

        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(this.ptsPos, 3))
        geo.setAttribute('color', new THREE.BufferAttribute(this.ptsCol, 3))
        geo.setAttribute('size', new THREE.BufferAttribute(this.ptsSz, 1))

        this.ptsMesh = new THREE.Points(geo, new THREE.PointsMaterial({
            size: 0.2, vertexColors: true, transparent: true, opacity: 0.85,
            depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
        }))
        this.ptsMesh.frustumCulled = false
        this.group.add(this.ptsMesh)
    }

    private updateParticles(emit: THREE.Vector3, speed: number, dt: number, rotY: number): void {
        if (!this.ptsPos || !this.ptsCol || !this.ptsSz || !this.ptsLife || !this.ptsMesh) return
        const rate = Math.min(speed * 2, 15)

        for (let i = 0; i < MAX_PART; i++) {
            if (this.ptsLife[i] > 0) {
                this.ptsLife[i] -= dt
                const v = this.ptsVel[i], ii = i * 3
                this.ptsPos[ii] += v.x * dt; this.ptsPos[ii + 1] += v.y * dt; this.ptsPos[ii + 2] += v.z * dt
                if (this.style === 'flame') { v.y += 1.2 * dt; v.x += (Math.random() - 0.5) * 1.5 * dt }
                else if (this.style === 'frost') { v.y -= 0.2 * dt; v.x += Math.sin(performance.now() * 0.005 + i) * 0.3 * dt }
                else { v.y += (Math.random() - 0.3) * 0.8 * dt }

                const l = Math.max(0, this.ptsLife[i] / 1.5)
                this.ptsCol[ii] = THREE.MathUtils.lerp(this.sc.r, this.pc.r, l)
                this.ptsCol[ii + 1] = THREE.MathUtils.lerp(this.sc.g, this.pc.g, l)
                this.ptsCol[ii + 2] = THREE.MathUtils.lerp(this.sc.b, this.pc.b, l)
                this.ptsSz[i] = l * (this.style === 'flame' ? 0.35 : 0.2)
            } else if (speed > 0.5 && Math.random() < rate * dt) {
                this.ptsLife[i] = 0.6 + Math.random() * 0.6
                const ii = i * 3
                this.ptsPos[ii] = emit.x + (Math.random() - 0.5) * 0.25
                this.ptsPos[ii + 1] = emit.y + (Math.random() - 0.5) * 0.2
                this.ptsPos[ii + 2] = emit.z + (Math.random() - 0.5) * 0.15
                const v = this.ptsVel[i]
                if (this.style === 'flame') v.set((Math.random() - 0.5) * 0.6, 0.3 + Math.random(), -(0.3 + Math.random() * 0.5))
                else if (this.style === 'frost') v.set((Math.random() - 0.5) * 0.8, (Math.random() - 0.3) * 0.4, -(0.2 + Math.random() * 0.4))
                else v.set((Math.random() - 0.5), (Math.random() - 0.2), -(0.3 + Math.random() * 0.8))
                if (rotY !== 0) v.applyAxisAngle(_yAxis, rotY)
                this.ptsCol[ii] = this.pc.r; this.ptsCol[ii + 1] = this.pc.g; this.ptsCol[ii + 2] = this.pc.b
                this.ptsSz[i] = this.style === 'flame' ? 0.35 : 0.2
            } else {
                this.ptsSz[i] = 0
            }
        }
        const ga = this.ptsMesh.geometry.attributes as Record<string, THREE.BufferAttribute>
        ga.position.needsUpdate = true; ga.color.needsUpdate = true; ga.size.needsUpdate = true
    }

    // ── Lightning ──

    private initLightning(): void {
        this.ltPos = new Float32Array(LIGHTNING_SEG * 2 * 3)
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(this.ltPos, 3))
        this.ltLine = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
            color: this.pc, transparent: true, opacity: 0.9, linewidth: 2, blending: THREE.AdditiveBlending,
        }))
        this.ltLine.frustumCulled = false
        this.group.add(this.ltLine)
    }

    private updateLightning(emit: THREE.Vector3, speed: number, dt: number, rotY: number): void {
        if (!this.ltPos || !this.ltLine) return
        this.ltTimer += dt
        const rate = Math.max(0.03, 0.08 - speed * 0.004)
        if (this.ltTimer >= rate) {
            this.ltTimer = 0
            let cur = emit.clone()
            const segLen = 0.2 + Math.min(speed * 0.03, 0.3)
            for (let i = 0; i < LIGHTNING_SEG; i++) {
                const ii = i * 6
                this.ltPos[ii] = cur.x; this.ltPos[ii + 1] = cur.y; this.ltPos[ii + 2] = cur.z
                const d = new THREE.Vector3((Math.random() - 0.5) * segLen * 1.2, (Math.random() - 0.5) * segLen * 0.8, -segLen * (0.4 + Math.random() * 0.5))
                if (rotY !== 0) d.applyAxisAngle(_yAxis, rotY)
                const next = cur.clone().add(d)
                this.ltPos[ii + 3] = next.x; this.ltPos[ii + 4] = next.y; this.ltPos[ii + 5] = next.z
                cur = next
            }
            ; (this.ltLine.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
        }
        this.ltLine.visible = speed > 0.5
        const mat = this.ltLine.material as THREE.LineBasicMaterial
        mat.opacity = 0.5 + Math.random() * 0.5
        mat.color.lerpColors(this.pc, this.sc, Math.random() * 0.3)
    }

    // ── Clear ──

    private clear(): void {
        if (this.ribbonMesh) { this.ribbonMesh.geometry.dispose(); (this.ribbonMesh.material as THREE.Material).dispose(); this.group.remove(this.ribbonMesh); this.ribbonMesh = null }
        this.ribbonPos = null; this.ribbonCol = null; this.ribbonHist = []
        if (this.ptsMesh) { this.ptsMesh.geometry.dispose(); (this.ptsMesh.material as THREE.Material).dispose(); this.group.remove(this.ptsMesh); this.ptsMesh = null }
        this.ptsPos = null; this.ptsCol = null; this.ptsSz = null; this.ptsLife = null; this.ptsVel = []
        if (this.ltLine) { this.ltLine.geometry.dispose(); (this.ltLine.material as THREE.Material).dispose(); this.group.remove(this.ltLine); this.ltLine = null }
        this.ltPos = null
        this.ready = false; this.style = 'none'
    }
}
