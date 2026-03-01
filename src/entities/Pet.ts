/**
 * 宠物实体 — Roblox 卡通风格小动物
 * 8种外观、跟随逻辑、idle 浮动动画
 */

import * as THREE from 'three'
import { Entity } from '../world/Entity'
import { World } from '../world/World'
import type { PetDef, PetType } from '../data/PetRegistry'

export class Pet extends Entity {
    petDef: PetDef
    private targetPos = new THREE.Vector3()
    private followOffset = new THREE.Vector3()
    private followSpeed = 12
    private animTime = 0
    private bobAmp = 0.15
    private bobSpeed = 3
    private baseY = 0.5

    private static MAX_LAG = 1.5

    constructor(petDef: PetDef) {
        super(['pet'])
        this.petDef = petDef
    }

    setFollowOffset(offset: THREE.Vector3): void { this.followOffset.copy(offset) }

    setFollowTarget(playerPos: THREE.Vector3, rotY: number): void {
        const cos = Math.cos(rotY), sin = Math.sin(rotY)
        const rx = this.followOffset.x * cos - this.followOffset.z * sin
        const rz = this.followOffset.x * sin + this.followOffset.z * cos
        this.targetPos.set(playerPos.x + rx, this.baseY, playerPos.z + rz)
    }

    snapToTarget(): void {
        this.position.copy(this.targetPos)
        this.root.position.copy(this.position)
    }

    onInit(world: World): void {
        super.onInit(world)
        if (this.root.children.length === 0) this.createMesh()
    }

    onUpdate(dt: number): void {
        this.animTime += dt
        const t = 1 - Math.exp(-this.followSpeed * dt)
        this.position.x += (this.targetPos.x - this.position.x) * t
        this.position.z += (this.targetPos.z - this.position.z) * t

        let dx = this.targetPos.x - this.position.x
        let dz = this.targetPos.z - this.position.z
        const dist = Math.sqrt(dx * dx + dz * dz)
        if (dist > Pet.MAX_LAG) {
            const ratio = Pet.MAX_LAG / dist
            this.position.x = this.targetPos.x - dx * ratio
            this.position.z = this.targetPos.z - dz * ratio
        }

        this.position.y = this.baseY + Math.sin(this.animTime * this.bobSpeed) * this.bobAmp

        if (dist > 0.05) {
            const targetRot = Math.atan2(this.targetPos.x - this.position.x, this.targetPos.z - this.position.z)
            let diff = targetRot - this.root.rotation.y
            while (diff > Math.PI) diff -= Math.PI * 2
            while (diff < -Math.PI) diff += Math.PI * 2
            this.root.rotation.y += diff * Math.min(t * 2, 1)
        }
        this.root.rotation.z = Math.sin(this.animTime * 2) * 0.05
        this.root.position.copy(this.position)
    }

    static createPreviewMesh(petDef: PetDef): THREE.Object3D {
        const temp = new Pet(petDef)
        const group = new THREE.Group()
        temp.buildInto(group, petDef)
        return group
    }

    createMesh(): THREE.Object3D {
        if (this.root.children.length > 0) return this.root
        this.buildInto(this.root, this.petDef)
        this.root.scale.set(0.5, 0.5, 0.5)
        return this.root
    }

    private buildInto(group: THREE.Group | THREE.Object3D, def: PetDef): void {
        const bMat = new THREE.MeshToonMaterial({ color: def.bodyColor })
        const aMat = new THREE.MeshToonMaterial({ color: def.accentColor })
        const eMat = new THREE.MeshToonMaterial({ color: 0x111111 })
        const wMat = new THREE.MeshToonMaterial({ color: 0xFFFFFF })

        switch (def.type) {
            case 'puppy': this.buildPuppy(group, bMat, aMat, eMat, wMat); break
            case 'kitten': this.buildKitten(group, bMat, aMat, eMat, wMat); break
            case 'koala': this.buildKoala(group, bMat, aMat, eMat, wMat); break
            case 'fox': this.buildFox(group, bMat, aMat, eMat, wMat); break
            case 'parrot': this.buildParrot(group, bMat, aMat, eMat, wMat); break
            case 'owl': this.buildOwl(group, bMat, aMat, eMat, wMat); break
            case 'bunny': this.buildBunny(group, bMat, aMat, eMat, wMat); break
            case 'dragon': this.buildDragon(group, bMat, aMat, eMat, wMat); break
        }
    }

    private addEyes(g: THREE.Group | THREE.Object3D, eM: THREE.Material, wM: THREE.Material, sp: number, ey: number, ez: number, r: number): void {
        for (const s of [-1, 1]) {
            const whitePart = new THREE.Mesh(new THREE.SphereGeometry(r * 1.5, 8, 8), wM);
            whitePart.position.set(s * sp, ey, ez);
            g.add(whitePart);
            
            const pupil = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 6), eM);
            pupil.position.set(s * sp, ey, ez + r * 0.8);
            g.add(pupil);
        }
    }

    private addLegs(g: THREE.Group | THREE.Object3D, mat: THREE.Material, r: number, h: number, sx: number, sz: number): void {
        const geo = new THREE.CylinderGeometry(r, r * 0.9, h, 8)
        for (const [x, z] of [[-sx, sz], [sx, sz], [-sx, -sz], [sx, -sz]]) {
            const leg = new THREE.Mesh(geo, mat)
            leg.position.set(x, h / 2, z)
            g.add(leg)
        }
    }

    // 每种宠物的建模方法（简化版，保留核心外观）

    private buildPuppy(g: THREE.Group | THREE.Object3D, b: THREE.Material, a: THREE.Material, e: THREE.Material, w: THREE.Material): void {
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), b); body.scale.set(1, 0.8, 1.2); body.position.y = 0.4; g.add(body)
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), b); head.position.set(0, 0.9, 0.4); g.add(head)
        const nose = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), a);
        nose.position.set(0, 0.85, 0.78);
        g.add(nose);
        this.addEyes(g, e, w, 0.15, 0.95, 0.7, 0.06)
        for (const x of [-0.2, 0.2]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 4), a); ear.position.set(x, 1.25, 0.35); ear.rotation.z = x < 0 ? 0.3 : -0.3; g.add(ear) }
        this.addLegs(g, b, 0.08, 0.25, 0.25, 0.35)
    }

    private buildKitten(g: THREE.Group | THREE.Object3D, b: THREE.Material, a: THREE.Material, e: THREE.Material, w: THREE.Material): void {
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), b); body.scale.set(1, 0.85, 1.1); body.position.y = 0.35; g.add(body)
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), b); head.position.set(0, 0.85, 0.35); g.add(head)
        this.addEyes(g, e, w, 0.14, 0.9, 0.65, 0.07)
        for (const x of [-0.22, 0.22]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 3), a); ear.position.set(x, 1.2, 0.3); ear.rotation.z = x < 0 ? 0.2 : -0.2; g.add(ear) }
        this.addLegs(g, b, 0.07, 0.2, 0.2, 0.3)
    }

    private buildKoala(g: THREE.Group | THREE.Object3D, b: THREE.Material, a: THREE.Material, e: THREE.Material, w: THREE.Material): void {
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), b); body.scale.set(1, 0.9, 0.9); body.position.y = 0.4; g.add(body)
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), b); head.position.set(0, 0.95, 0.3); g.add(head)
        this.addEyes(g, e, w, 0.16, 0.98, 0.62, 0.06)
        for (const x of [-0.35, 0.35]) {
            const ear = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), a);
            ear.position.set(x, 1.2, 0.25);
            g.add(ear);
        }
        this.addLegs(g, b, 0.1, 0.18, 0.25, 0.3)
    }

    private buildFox(g: THREE.Group | THREE.Object3D, b: THREE.Material, a: THREE.Material, e: THREE.Material, w: THREE.Material): void {
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), b); body.scale.set(0.9, 0.8, 1.3); body.position.y = 0.4; g.add(body)
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), b); head.scale.set(1, 1, 1.2); head.position.set(0, 0.85, 0.45); g.add(head)
        this.addEyes(g, e, w, 0.13, 0.9, 0.7, 0.055)
        for (const x of [-0.18, 0.18]) {
            const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 4), b);
            ear.position.set(x, 1.25, 0.35);
            g.add(ear);
        }
        const tail = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), b); tail.scale.set(0.6, 0.6, 1.5); tail.position.set(0, 0.35, -0.7); g.add(tail)
        this.addLegs(g, b, 0.06, 0.25, 0.2, 0.35)
    }

    private buildParrot(g: THREE.Group | THREE.Object3D, b: THREE.Material, a: THREE.Material, e: THREE.Material, w: THREE.Material): void {
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), b); body.scale.set(0.9, 1, 0.8); body.position.y = 0.5; g.add(body)
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), b); head.position.set(0, 0.95, 0.2); g.add(head)
        const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 4), new THREE.MeshToonMaterial({ color: 0xFFA500 }))
        beak.position.set(0, 0.85, 0.5); beak.rotation.x = -Math.PI / 2; g.add(beak)
        this.addEyes(g, e, w, 0.12, 1, 0.42, 0.05)
        for (const s of [-1, 1]) { const wing = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), a); wing.scale.set(0.3, 0.6, 1); wing.position.set(s * 0.35, 0.55, -0.05); wing.rotation.z = s * 0.3; g.add(wing) }
    }

    private buildOwl(g: THREE.Group | THREE.Object3D, b: THREE.Material, a: THREE.Material, e: THREE.Material, w: THREE.Material): void {
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), b); body.scale.set(1, 1.1, 0.9); body.position.y = 0.45; g.add(body)
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), b); head.position.set(0, 1, 0.15); g.add(head)
        const eyeGold = new THREE.MeshToonMaterial({ color: 0xFFD700 })
        for (const s of [-1, 1]) {
            const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), eyeGold);
            eyeWhite.position.set(s * 0.12, 1, 0.4);
            g.add(eyeWhite);
            
            const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), e);
            pupil.position.set(s * 0.12, 1, 0.48);
            g.add(pupil);
        }
        for (const s of [-1, 1]) { const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 4), a); horn.position.set(s * 0.2, 1.3, 0.1); horn.rotation.z = s * 0.2; g.add(horn) }
    }

    private buildBunny(g: THREE.Group | THREE.Object3D, b: THREE.Material, a: THREE.Material, e: THREE.Material, w: THREE.Material): void {
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), b); body.scale.set(0.9, 0.9, 0.9); body.position.y = 0.4; g.add(body)
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), b); head.position.set(0, 0.9, 0.25); g.add(head)
        this.addEyes(g, e, w, 0.14, 0.95, 0.52, 0.07)
        for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.5, 4, 8), b); ear.position.set(s * 0.15, 1.45, 0.15); ear.rotation.z = s * 0.15; g.add(ear) }
        const tail = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), w);
        tail.position.set(0, 0.3, -0.45);
        g.add(tail);
        this.addLegs(g, b, 0.08, 0.18, 0.2, 0.25)
    }

    private buildDragon(g: THREE.Group | THREE.Object3D, b: THREE.Material, a: THREE.Material, e: THREE.Material, w: THREE.Material): void {
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), b); body.scale.set(0.9, 0.85, 1.2); body.position.y = 0.45; g.add(body)
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), b); head.scale.set(1, 1, 1.15); head.position.set(0, 0.9, 0.45); g.add(head)
        const eyeYellow = new THREE.MeshToonMaterial({ color: 0xFFFF00 })
        this.addEyes(g, e, eyeYellow, 0.14, 0.95, 0.68, 0.055)
        for (const s of [-1, 1]) {
            const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.25, 5), a);
            horn.position.set(s * 0.15, 1.2, 0.35);
            horn.rotation.set(0, 0, s * 0.3);
            g.add(horn);
        }
        for (const s of [-1, 1]) { const wing = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.35, 3), a); wing.position.set(s * 0.45, 0.7, 0); wing.rotation.set(0, s * 0.3, s * (Math.PI / 2 + 0.3)); g.add(wing) }
        this.addLegs(g, b, 0.08, 0.22, 0.22, 0.35)
    }
}
