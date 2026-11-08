/** Illustrative snow/ice appearance across the complete terrain.
 * The existing regional forecast drives a texture-based snow-retreat effect.
 * This is not measured thickness, a glacier-specific forecast or a calibrated
 * snow classification. Existing exports are retained for main.js compatibility.
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

/** Change snowy-looking terrain pixels without adding ice meshes or changing
 * the land geometry. Starting fraction 1 reproduces the original texture.
 */
export async function createGlacierPrototype(model, { showLabel = true } = {}) {
    if (!model?.isObject3D) throw new TypeError('Expected the loaded terrain model.');
    model.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(model);
    if (bounds.isEmpty()) throw new Error('Terrain has no usable bounds.');
    const fraction = { value: 1 };
    const minHeight = { value: bounds.min.y };
    const heightRange = { value: Math.max(bounds.max.y - bounds.min.y, 0.0001) };
    const replacements = [];
    const clones = [];
    model.traverse(object => {
        if (!object.isMesh || object.userData.glacierPrototype) return;
        const original = object.material;
        const materials = Array.isArray(original) ? original : [original];
        const modified = materials.map(source => {
            if (!source?.map || !(source.isMeshStandardMaterial || source.isMeshPhongMaterial
                || source.isMeshLambertMaterial || source.isMeshBasicMaterial)) return source;
            const material = source.clone();
            material.onBeforeCompile = shader => {
                shader.uniforms.regionalSnowFraction = fraction;
                shader.uniforms.regionalMinHeight = minHeight;
                shader.uniforms.regionalHeightRange = heightRange;
                shader.vertexShader = `varying vec3 vRegionalTerrainPosition;\n` + shader.vertexShader;
                shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
                    #include <begin_vertex>
                    vRegionalTerrainPosition = (modelMatrix * vec4(position, 1.0)).xyz;
                `);
                shader.fragmentShader = `
                    uniform float regionalSnowFraction;
                    uniform float regionalMinHeight;
                    uniform float regionalHeightRange;
                    varying vec3 vRegionalTerrainPosition;
                ` + shader.fragmentShader;
                shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
                    #include <map_fragment>
                    // Classify bright, weakly saturated texture pixels as a
                    // visual snow/ice proxy. Bright rock can also be selected.
                    vec3 originalTerrain = diffuseColor.rgb;
                    float highChannel = max(max(originalTerrain.r, originalTerrain.g), originalTerrain.b);
                    float lowChannel = min(min(originalTerrain.r, originalTerrain.g), originalTerrain.b);
                    float chroma = highChannel - lowChannel;
                    float snowMask = smoothstep(0.28, 0.65, lowChannel)
                        * (1.0 - smoothstep(0.13, 0.32, chroma));
                    float altitude = clamp((vRegionalTerrainPosition.y - regionalMinHeight)
                        / regionalHeightRange, 0.0, 1.0);
                    float pattern = 0.5 + 0.5 * sin(vRegionalTerrainPosition.x * 13.0)
                        * sin(vRegionalTerrainPosition.z * 17.0);
                    float stage = 1.0 - regionalSnowFraction;
                    // Lower snow changes first. Even at high elevations the
                    // regional signal has a visible effect late in the timeline.
                    float exposure = clamp(stage * 1.85 - altitude * 0.65
                        + pattern * 0.18, 0.0, 1.0) * smoothstep(0.0, 0.08, stage);
                    float grain = 0.86 + 0.14 * pattern;
                    vec3 exposedRock = vec3(0.24, 0.225, 0.19) * grain;
                    diffuseColor.rgb = mix(originalTerrain, exposedRock, snowMask * exposure);
                `);
            };
            material.customProgramCacheKey = () => 'regional-snow-appearance-v1';
            material.needsUpdate = true;
            clones.push(material);
            return material;
        });
        object.material = Array.isArray(original) ? modified : modified[0];
        replacements.push({ object, original });
    });
    if (!clones.length) throw new Error('No supported textured terrain material was found.');
    let label = null;
    if (showLabel && typeof document !== 'undefined') {
        label = document.createElement('div');
        label.textContent = 'Illustrative snow & ice change across terrain · regional mass-balance forecast';
        label.style.cssText = 'position:fixed;top:38px;left:10px;right:10px;width:fit-content;max-width:calc(100vw - 40px);z-index:20;padding:7px 10px;border-radius:5px;background:rgba(0,0,0,.65);color:#fff;font:12px/1.4 system-ui,sans-serif;pointer-events:none;';
        document.body.appendChild(label);
    }
    let disposed = false;
    return {
        metadata: { illustrative: true, scope: 'entire textured terrain',
            method: 'snow-like texture colors fade toward illustrative rock colors',
            source: 'existing regional annual forecast', thicknessBased: false },
        setRemainingFraction(value) {
            if (disposed) throw new Error('Terrain snow display has been disposed.');
            if (!Number.isFinite(value)) throw new TypeError('Expected a finite display fraction.');
            fraction.value = THREE.MathUtils.clamp(value, 0, 1);
            return fraction.value;
        },
        dispose() {
            if (disposed) return;
            replacements.forEach(({ object, original }) => { object.material = original; });
            clones.forEach(material => material.dispose());
            label?.remove();
            disposed = true;
        }
    };
}
