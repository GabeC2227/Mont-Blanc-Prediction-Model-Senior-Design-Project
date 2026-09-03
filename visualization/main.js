import * as THREE from './node_modules/three/build/three.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

// lighting 
const ambient = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambient);

const directional = new THREE.DirectionalLight(0xffffff, 2);
directional.position.set(5, 10, 5);
scene.add(directional);

let model; // keep a reference so animate() can rotate it once loaded

const loader = new GLTFLoader();
loader.load('./Assets/mont_blanc.glb',
    (gltf) => {
        model = gltf.scene;
        scene.add(model);
        console.log('Model loaded successfully!', gltf);

        // Auto-fit camera to model size (mountain models are often huge or tiny in scale)
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        console.log('Model size:', size);
        console.log('Model center:', center);

        const maxDim = Math.max(size.x, size.y, size.z);
        camera.near = maxDim / 100;
        camera.far = maxDim * 100;
        camera.updateProjectionMatrix();

        camera.position.set(center.x, center.y, center.z + maxDim * 1.5);
        camera.lookAt(center);
    },
    undefined, // onProgress
    (error) => { console.error('An error has occurred:', error); }
);

function animate( time ) {
    if (model) {
        model.rotation.y = time / 4000;
    }
    renderer.render( scene, camera );
}
renderer.setAnimationLoop(animate);