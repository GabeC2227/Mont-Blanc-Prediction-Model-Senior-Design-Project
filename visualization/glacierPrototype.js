/**
 * Illustrative glacier experiment. Save beside visualization/main.js.
 * Uses main.js's Three.js instance; no extra dependencies or network requests.
 * Footprint, thickness and loss scale are illustrative, not measured ice geometry.
 */
import * as THREE from './node_modules/three/build/three.module.js';

/** Annual balances after the first year accumulate against an illustrative budget.
 * The first year is the visual baseline (fraction 1). Units of lossBudget must
 * match the JSON balances. Positive balances can restore ice up to the baseline.
 * Missing, duplicate or malformed annual records throw rather than silently reset.
 */
export function buildIllustrativeTimeline(records, { lossBudget = 100 } = {}) {
    if (!Array.isArray(records) || records.length === 0) {
        throw new TypeError('Expected a nonempty array of annual forecast records.');
    }
    if (!Number.isFinite(lossBudget) || lossBudget <= 0) {
        throw new RangeError('lossBudget must be positive and finite.');
    }
    const rows = records.map(row => {
        const year = row?.year;
        const balance = row?.predicted_mass_balance;
        if (!Number.isInteger(year) || !Number.isFinite(balance)) {
            throw new TypeError('Each forecast needs numeric year and predicted_mass_balance.');
        }
        return { year, balance };
    }).sort((a, b) => a.year - b.year);
    const timeline = new Map();
    let cumulative = 0;
    rows.forEach((row, index) => {
        if (index && row.year !== rows[index - 1].year + 1) {
            throw new Error('Forecast years must be unique and consecutive.');
        }
        if (index) cumulative += row.balance;
        timeline.set(row.year, THREE.MathUtils.clamp(1 + cumulative / lossBudget, 0, 1));
    });
    return timeline;
}

// Same two-anchor calibration as the inspected main.js; coordinates are WORLD
// coordinates after centering, and are converted to model-local points below.
function geoToWorld(latitude, longitude) {
    const latA = 45.83267, lonA = 6.86512;
    const eastScale = Math.cos(THREE.MathUtils.degToRad((latA + 45.8785) / 2));
    const eastB = (6.8875 - lonA) * eastScale;
    const southB = -(45.8785 - latA);
    const dx = 2.188 - 0.340, dz = 1.042 - 6.200;
    const scale = Math.hypot(dx, dz) / Math.hypot(eastB, southB);
    const angle = Math.atan2(dz, dx) - Math.atan2(southB, eastB);
    const east = (longitude - lonA) * eastScale, south = -(latitude - latA);
    return {
        x: 0.340 + (east * Math.cos(angle) - south * Math.sin(angle)) * scale,
        z: 6.200 + (east * Math.sin(angle) + south * Math.cos(angle)) * scale
    };
}

/** Call after model.position.sub(center), before adding prediction markers.
 * Default follows a channel traced visually in this project's terrain texture.
 * This is an illustrative trace, not a measured or georeferenced glacier outline.
 * options.centerline can override it with world-space {x,z} points.
 * Optional center:{x,z}, radiusX/radiusZ, thickness and clearance use world units.
 * Terrain is assumed Y-up at creation; subsequent model motion carries the ice.
 */
export async function createGlacierPrototype(model, options = {}) {
    if (!model?.isObject3D) throw new TypeError('Expected the loaded terrain model.');
    model.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(model);
    const span = bounds.getSize(new THREE.Vector3());
    if (bounds.isEmpty() || Math.max(span.x, span.z) <= 0) {
        throw new Error('Terrain has no usable bounds.');
    }
    const horizontal = Math.max(span.x, span.z);
    const center = options.center ?? geoToWorld(45.899, 6.932);
    const radiusX = options.radiusX ?? horizontal * 0.018;
    const radiusZ = options.radiusZ ?? horizontal * 0.065;
    const thickness = options.thickness ?? horizontal * 0.008;
    const clearance = options.clearance ?? horizontal * 0.0003;
    const segments = options.segments ?? 48;
    // The inspected GLB maps texture U across X and texture image Y across Z.
    // Trace a short section of the visible channel rather than using geo anchors
    // to place an oval across a steep slope. Fractions refer to this GLB's bounds.
    const textureTrace = [[0.690, 0.540], [0.701, 0.510], [0.706, 0.480],
        [0.718, 0.450], [0.716, 0.420]];
    const pathPoints = options.centerline ?? (options.center ? null : textureTrace.map(([u, v]) => ({
        x: bounds.min.x + u * span.x,
        z: bounds.min.z + v * span.z
    })));
    if (pathPoints && (!Array.isArray(pathPoints) || pathPoints.length < 2
        || !pathPoints.every(p => Number.isFinite(p?.x) && Number.isFinite(p?.z)))) {
        throw new TypeError('centerline needs at least two finite {x,z} points.');
    }
    const path = pathPoints ? new THREE.CatmullRomCurve3(
        pathPoints.map(p => new THREE.Vector3(p.x, 0, p.z)), false, 'centripetal'
    ) : null;
    if (![center.x, center.z, radiusX, radiusZ, thickness, clearance].every(Number.isFinite)
        || radiusX <= 0 || radiusZ <= 0 || thickness <= 0 || clearance < 0
        || !Number.isInteger(segments) || segments < 4 || segments > 128) {
        throw new RangeError('Invalid glacier dimensions, center or segments (4–128).');
    }
    const terrain = [];
    model.traverse(object => {
        if (object.isMesh && !object.userData.glacierPrototype) terrain.push(object);
    });
    // Index triangles once in X/Z cells. Each vertical sample then checks
    // nearby triangles instead of scanning the entire ~390,000-triangle GLB.
    const cells = 64;
    const cellX = x => Math.max(0, Math.min(cells - 1,
        Math.floor((x - bounds.min.x) / span.x * cells)));
    const cellZ = z => Math.max(0, Math.min(cells - 1,
        Math.floor((z - bounds.min.z) / span.z * cells)));
    const point = new THREE.Vector3();
    const indexedTerrain = terrain.map(source => {
        const position = source.geometry.getAttribute('position');
        const index = source.geometry.index;
        const world = new Float64Array(position.count * 3);
        for (let i = 0; i < position.count; i++) {
            point.fromBufferAttribute(position, i).applyMatrix4(source.matrixWorld);
            point.toArray(world, i * 3);
        }
        const bins = Array.from({ length: cells * cells }, () => []);
        const count = index ? index.count : position.count;
        const vertex = offset => index ? index.getX(offset) : offset;
        for (let k = 0; k + 2 < count; k += 3) {
            const a = vertex(k) * 3, b = vertex(k + 1) * 3, c = vertex(k + 2) * 3;
            const minX = cellX(Math.min(world[a], world[b], world[c]));
            const maxX = cellX(Math.max(world[a], world[b], world[c]));
            const minZ = cellZ(Math.min(world[a + 2], world[b + 2], world[c + 2]));
            const maxZ = cellZ(Math.max(world[a + 2], world[b + 2], world[c + 2]));
            for (let z = minZ; z <= maxZ; z++) {
                for (let x = minX; x <= maxX; x++) bins[z * cells + x].push(k);
            }
        }
        return { world, bins, vertex };
    });
    const ray = new THREE.Ray();
    const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
    const intersection = new THREE.Vector3();
    const sampleTerrain = (x, z) => {
        let highest = -Infinity;
        const bin = cellZ(z) * cells + cellX(x);
        for (const { world, bins, vertex } of indexedTerrain) {
            for (const offset of bins[bin]) {
                va.fromArray(world, vertex(offset) * 3);
                vb.fromArray(world, vertex(offset + 1) * 3);
                vc.fromArray(world, vertex(offset + 2) * 3);
                if (ray.intersectTriangle(va, vb, vc, false, intersection)) {
                    highest = Math.max(highest, intersection.y);
                }
            }
        }
        return Number.isFinite(highest) ? new THREE.Vector3(x, highest, z) : null;
    };
    const base = [], raised = [], indices = [];
    const samples = new Map();
    const padding = Math.max(span.y, horizontal, 1);
    {
        for (let j = 0; j <= segments; j++) {
            for (let i = 0; i <= segments; i++) {
                const squareU = 2 * i / segments - 1;
                const squareV = 2 * j / segments - 1;
                // Map the entire square grid onto a disk. All boundary samples
                // lie on its rim, avoiding the old stair-step cut through cells.
                const u = squareU * Math.sqrt(1 - squareV * squareV / 2);
                const v = squareV * Math.sqrt(1 - squareU * squareU / 2);
                const width = 0.70 + 0.30 * (v + 1) / 2;
                const bend = 0.25 * Math.sin(Math.PI * v);
                let x = center.x + radiusX * (u * width + bend);
                let z = center.z + v * radiusZ;
                let profile = Math.max(0, 1 - u * u - v * v);
                if (path) {
                    const t = j / segments;
                    const point = path.getPoint(t);
                    const tangent = path.getTangent(t).normalize();
                    const cap = Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.45);
                    // Keep both caps numerically closed, with a narrow ribbon
                    // and considerably less vertical exaggeration than the oval.
                    const halfWidth = (options.radiusX ?? horizontal * 0.007) * cap;
                    x = point.x - tangent.z * squareU * halfWidth;
                    z = point.z + tangent.x * squareU * halfWidth;
                    profile = (1 - squareU * squareU) * cap;
                }
                ray.set(new THREE.Vector3(x, bounds.max.y + padding, z), new THREE.Vector3(0, -1, 0));
                const hit = sampleTerrain(x, z);
                if (!hit) continue;
                // Smoothly feather thickness into the terrain at the rim.
                // Clamp roundoff so boundary vertices never become NaN.
                const height = (path && options.thickness === undefined ? horizontal * 0.003 : thickness) * profile;
                const bottom = model.worldToLocal(hit.clone().add(new THREE.Vector3(0, clearance, 0)));
                const top = model.worldToLocal(hit.clone().add(new THREE.Vector3(0, clearance + height, 0)));
                samples.set(j * (segments + 1) + i, base.length / 3);
                base.push(bottom.x, bottom.y, bottom.z);
                raised.push(top.x, top.y, top.z);
            }
        }
    }
    for (let j = 0; j < segments; j++) {
        for (let i = 0; i < segments; i++) {
            const key = j * (segments + 1) + i;
            const a = samples.get(key), b = samples.get(key + 1);
            const c = samples.get(key + segments + 1), d = samples.get(key + segments + 2);
            if ([a, c, b].every(Number.isInteger)) indices.push(a, c, b);
            if ([b, c, d].every(Number.isInteger)) indices.push(b, c, d);
        }
    }
    if (!indices.length) {
        throw new Error('Glacier footprint missed terrain. Adjust options.center/radiusX/radiusZ using the calibration grid.');
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(raised, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const material = new THREE.MeshStandardMaterial({
        color: 0xc9efff, roughness: 0.65, metalness: 0, side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'Illustrative glacier prototype';
    mesh.userData.glacierPrototype = true;
    // Preserve existing terrain marker picking.
    mesh.raycast = () => {};
    model.add(mesh);
    let disposed = false;
    return {
        mesh,
        setRemainingFraction(fraction) {
            if (disposed) throw new Error('Glacier prototype has been disposed.');
            if (!Number.isFinite(fraction)) throw new TypeError('Expected a finite remaining fraction.');
            const f = THREE.MathUtils.clamp(fraction, 0, 1);
            const attribute = geometry.getAttribute('position');
            for (let k = 0; k < base.length; k++) {
                attribute.array[k] = base[k] + (raised[k] - base[k]) * f;
            }
            attribute.needsUpdate = true;
            geometry.computeVertexNormals();
            geometry.computeBoundingSphere();
            geometry.computeBoundingBox();
            mesh.visible = f > 0;
            return f;
        },
        dispose() {
            if (disposed) return;
            mesh.removeFromParent();
            geometry.dispose();
            material.dispose();
            disposed = true;
        }
    };
}
