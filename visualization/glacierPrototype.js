/** Illustrative ice display driven by the existing regional annual forecast.
 * Save this file and glacierFootprints.json beside visualization/main.js.
 * Preserves the existing two exports and slider API. No measured thickness,
 * individual-glacier forecast, or calibrated retreat prediction is implied.
 */
import * as THREE from './node_modules/three/build/three.module.js';

export function buildIllustrativeTimeline(records, { endFraction = 0.15, lossBudget } = {}) {
    if (!Array.isArray(records) || !records.length) throw new TypeError('Expected annual forecast records.');
    if (!Number.isFinite(endFraction) || endFraction < 0 || endFraction > 1) throw new RangeError('endFraction must be between 0 and 1.');
    if (lossBudget !== undefined && (!Number.isFinite(lossBudget) || lossBudget <= 0)) throw new RangeError('lossBudget must be positive.');
    const rows = records.map(row => {
        if (!Number.isInteger(row?.year) || !Number.isFinite(row?.predicted_mass_balance)) throw new TypeError('Forecast requires numeric year and predicted_mass_balance.');
        return { year: row.year, balance: row.predicted_mass_balance };
    }).sort((a, b) => a.year - b.year);
    let cumulative = 0;
    const totals = rows.map((row, i) => {
        if (i && row.year !== rows[i - 1].year + 1) throw new Error('Forecast years must be unique and consecutive.');
        // First forecast year is the display baseline, matching existing wiring.
        if (i) cumulative += row.balance;
        return cumulative;
    });
    const largestLoss = Math.max(0, -Math.min(...totals));
    return new Map(rows.map((row, i) => [row.year, THREE.MathUtils.clamp(
        lossBudget !== undefined ? 1 + totals[i] / lossBudget
            : largestLoss > 0 ? 1 + totals[i] / largestLoss * (1 - endFraction) : 1, 0, 1)]));
}

export async function createGlacierPrototype(model, {
    url = new URL('./glacierFootprints.json', import.meta.url),
    visualHeight = 0.08,
    showLabel = true
} = {}) {
    if (!model?.isObject3D) throw new TypeError('Expected the loaded mountain model.');
    if (!Number.isFinite(visualHeight) || visualHeight < 0) throw new RangeError('visualHeight must be finite and nonnegative.');
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Glacier footprints failed to load: ${response.status}`);
    const data = await response.json();
    const { positions, profile, indices } = data;
    if (!Array.isArray(positions) || !Array.isArray(profile) || !Array.isArray(indices)
        || positions.length !== profile.length * 3 || indices.length % 3
        || !positions.every(Number.isFinite)
        || !profile.every(n => Number.isFinite(n) && n >= 0 && n <= 1)
        || !indices.every(n => Number.isInteger(n) && n >= 0 && n < profile.length)) {
        throw new Error('Invalid glacier footprint data.');
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('iceProfile', new THREE.Float32BufferAttribute(profile, 1));
    geometry.setIndex(indices);
    const uniforms = { displayFraction: { value: 1 }, visualHeight: { value: visualHeight } };
    const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: `
            attribute float iceProfile;
            uniform float displayFraction;
            uniform float visualHeight;
            varying float vProfile;
            void main() {
                vProfile = iceProfile;
                vec3 p = position;
                p.y += 0.003 + visualHeight * iceProfile * displayFraction;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
            }
        `,
        fragmentShader: `
            uniform float displayFraction;
            varying float vProfile;
            void main() {
                float cutoff = mix(0.5, -0.05, displayFraction);
                float edge = smoothstep(cutoff - 0.035, cutoff + 0.035, vProfile);
                float alpha = edge * 0.95;
                if (alpha < 0.02) discard;
                vec3 ice = mix(vec3(0.67, 0.87, 0.94), vec3(0.91, 0.98, 1.0), vProfile);
                gl_FragColor = vec4(ice, alpha);
            }
        `,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'Illustrative regional glacier change';
    mesh.userData.glacierPrototype = true;
    mesh.userData.illustrative = true;
    mesh.userData.source = data.metadata;
    // Shader displacement exceeds original bounds; avoid incorrect culling.
    mesh.frustumCulled = false;
    mesh.raycast = () => {};
    model.add(mesh);
    let label = null;
    if (showLabel && typeof document !== 'undefined') {
        label = document.createElement('div');
        label.textContent = 'Illustrative glacier change · driven by regional mass-balance forecast';
        label.style.cssText = 'position:fixed;top:38px;left:10px;right:10px;width:fit-content;max-width:calc(100vw - 40px);z-index:20;padding:7px 10px;border-radius:5px;background:rgba(0,0,0,.65);color:#fff;font:12px/1.4 system-ui,sans-serif;pointer-events:none;';
        document.body.appendChild(label);
    }
    let disposed = false;
    return {
        mesh,
        metadata: data.metadata,
        setRemainingFraction(fraction) {
            if (disposed) throw new Error('Glacier display has been disposed.');
            if (!Number.isFinite(fraction)) throw new TypeError('Expected a finite display fraction.');
            const f = THREE.MathUtils.clamp(fraction, 0, 1);
            uniforms.displayFraction.value = f;
            mesh.visible = f > 0;
            return f;
        },
        dispose() {
            if (disposed) return;
            mesh.removeFromParent();
            geometry.dispose();
            material.dispose();
            label?.remove();
            disposed = true;
        }
    };
}
