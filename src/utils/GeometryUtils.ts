import * as THREE from 'three'

/**
 * 几何工具 — Roblox 风格圆角方块等
 */
export class GeometryUtils {
    static createRoundedBox(
        width: number, height: number, depth: number,
        radius = 0.1, smoothness = 4
    ): THREE.BufferGeometry {
        const shape = new THREE.Shape()
        const eps = 0.00001
        shape.absarc(eps, eps, eps, -Math.PI / 2, -Math.PI, true)
        shape.absarc(eps, height - radius * 2, eps, Math.PI, Math.PI / 2, true)
        shape.absarc(width - radius * 2, height - radius * 2, eps, Math.PI / 2, 0, true)
        shape.absarc(width - radius * 2, eps, eps, 0, -Math.PI / 2, true)

        const geometry = new THREE.ExtrudeGeometry(shape, {
            depth: depth - radius * 2,
            bevelEnabled: true,
            bevelSegments: smoothness * 2,
            steps: 1,
            bevelSize: radius,
            bevelThickness: radius,
            curveSegments: smoothness,
        })
        geometry.center()
        return geometry
    }

    static createRoundedCylinder(
        radius: number, height: number,
        radialSegments = 16
    ): THREE.BufferGeometry {
        return new THREE.CapsuleGeometry(radius, height, 4, radialSegments)
    }
}
