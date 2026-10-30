import * as THREE from './node_modules/three/build/three.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; //load model
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; //camera movement

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

// This part three.js canvas is matched with the browser window 
window.addEventListener("resize", () => {

    camera.aspect =
        window.innerWidth / window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );
});

//camera controls
const controls = new OrbitControls( camera, renderer.domElement );

// lighting 
const ambient = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambient);

const directional = new THREE.DirectionalLight(0xffffff, 2);
directional.position.set(5, 10, 5);
scene.add(directional);


// Geographic Bounds/Coordinates

const GEO_BOUNDS = {
    north: 45.9,
    south: 45.7,
    west: 6.6,
    east: 7.0
};

// Temp. Geographic calibration offset
// Current POIs are manually calibrated x/z coords
// Kept for future prediction data

const CALIBRATION_OFFSET = {
    x: -4.43,
    z: 10.28
};


// true = top-down calibration grid
// false = normal 3D model view
const CALIBRATION_MODE = false;

//Converison of LAT/LONG into Three.js X/Z Coordinates
// Coordinate Plane is kinda goated here
// geoToModel() = WHERE horizontally

function geoToModel(latitude, longitude, box) {

    // Converts long. into a 0-1 position from west to east
    const xPercent =
        (longitude - GEO_BOUNDS.west) / // figuring out how far west/east coordinate is
        (GEO_BOUNDS.east - GEO_BOUNDS.west);

    // Converts Lat. to a 0-1 position from South to North
    const zPercent = 
        (latitude - GEO_BOUNDS.south) /
        (GEO_BOUNDS.north - GEO_BOUNDS.south); 
    
    // Converts west/east percentage into threejs X
    const x =
        box.min.x +
        xPercent * (box.max.x - box.min.x);


    // Converts south/north percent into threejs Z
    // Higher Lat. currently maps to negative Z
    const z =
        box.max.z -
        zPercent * (box.max.z - box.min.z);

    // Send back the X and Z position
    //return {x, z};

    return { 
        x: x + CALIBRATION_OFFSET.x,
        z: z + CALIBRATION_OFFSET.z
    };
        
}
//too much work and code to make points of interest one by one so I made a function
function makePointsOfInterest(x, z, color, box) {

    const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 32, 32),
        new THREE.MeshBasicMaterial({ color })
    );

    marker.raycast = () => {};

    const rayOrigin = new THREE.Vector3(
        x,
        box.max.y + 10,
        z
    );

    const raycaster = new THREE.Raycaster(
        rayOrigin,
        new THREE.Vector3(0, -1, 0)
    );

    const intersections = raycaster.intersectObject(model, true);

    if (intersections.length > 0) {

        // Markers are like children of the model to rotate with the mountain.
        // Child positions use the local model's coordinates to convert world-space 
        // raycast to hit the local space or coords 
        const worldHitPoint = intersections[0].point.clone();

        model.updateMatrixWorld(true);

        const localHitPoint =
            model.worldToLocal(worldHitPoint.clone());

        marker.position.set(
            localHitPoint.x,
            localHitPoint.y + 0.2,
            localHitPoint.z
        );

        model.add(marker);

        console.log(
            `Point of interest placed: x=${x}, z=${z}`
        );

        return marker;
    }

    console.warn(
        "Point of interest did not hit terrain:",
        x,
        z
    );

    return null;
}


let model; // keep a reference to model just in case

// =============================
//     CLICK DEBUGGER 
// =============================  

const calibrationRaycaster = new THREE.Raycaster();
const calibrationMouse = new THREE.Vector2();

renderer.domElement.addEventListener("click", (event) => {

    if (!model) return;

    const rect = renderer.domElement.getBoundingClientRect();

    calibrationMouse.x =
        ((event.clientX - rect.left) / rect.width) * 2 - 1;

    calibrationMouse.y =
        -((event.clientY - rect.top) / rect.height) * 2 + 1;

    calibrationRaycaster.setFromCamera(
        calibrationMouse,
        camera
    );

    const hits =
        calibrationRaycaster.intersectObject(model, true);

    if (hits.length > 0) {

        const point = hits[0].point;

        console.log(
            `CALIBRATION CLICK: x=${point.x.toFixed(3)}, z=${point.z.toFixed(3)}`
        );
    }
});


const loader = new GLTFLoader();
loader.load('./Assets/mont_blanc.glb',
    (gltf) => {
        model = gltf.scene;
        scene.add(model);
        console.log('Model loaded successfully!', gltf);

        // Auto-fit camera to model size 
        // just in case const box is the original
        let box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Shift model so its center is at the origin
        model.position.sub(center);

        // recalculating the bounding box bc of the model
        // and its moved to the center of the scene of threejs
        box = new THREE.Box3().setFromObject(model);


        const maxDim = Math.max(size.x, size.y, size.z);
        camera.near = maxDim / 100;
        camera.far = maxDim * 100;
        camera.updateProjectionMatrix();


        // I removed the old camera code after i centered the model at the origin
        // With the help of yessi's coordinate bounds, now the new setup works pretty good and is centered.
       
        // THIS IS DEBUGGING WILL COME BACK TO IT LATERRRRR =============================
        /* camera.position.set(0, maxDim * 0.5, maxDim * 1.5);

        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();

        =====================================================
        */
 
        // ================ DEBUGGER CODE FOR RIGHT NOW CALIBRATION OFFSET = true part 
if (CALIBRATION_MODE) {

    // Width/depth of the terrain in Three.js coordinates
    const modelWidth = box.max.x - box.min.x;
    const modelDepth = box.max.z - box.min.z;

    // Make the grid large enough to cover the whole terrain
    const gridSize = Math.max(modelWidth, modelDepth);
    const gridDivisions = 20;

    controls.enableRotate = false;

    const grid = new THREE.GridHelper(
        gridSize,
        gridDivisions
    );

    // Put grid slightly above the highest point of the terrain
    grid.position.y = box.max.y + 0.5;

    // Make it easier to see the terrain underneath
    grid.material.transparent = true;
    grid.material.opacity = 0.35;

    scene.add(grid);

    // Shows coordinate directions:
    // red = +X
    // green = +Y
    // blue = +Z
    const axes = new THREE.AxesHelper(gridSize * 0.1);
    axes.position.y = box.max.y + 0.6;
    scene.add(axes);

    // Put camera directly above the model
    camera.position.set(
        0,
        box.max.y + maxDim * 1.5,
        0
    );

    /*
       Your geoToModel currently assumes:

       East  = +X
       North = -Z

       Setting camera.up to -Z means:
       top of screen = North
       right side    = East
    */
    camera.up.set(0, 0, -1);

    camera.lookAt(0, 0, 0);

    controls.target.set(0, 0, 0);
    controls.update();

    console.log(
        "Calibration grid cell size:",
        gridSize / gridDivisions
    );

} else {

    // Normal 3D camera
    camera.up.set(0, 1, 0);
    camera.position.set(0, maxDim * 0.5, maxDim * 1.5);
    camera.lookAt(0, 0, 0);

    controls.enableRotate = true;

    controls.target.set(0, 0, 0);
    controls.update();
}
        // Points of Interest
        // These aren't latitude/longitude values but calibrated using three.js x/z coordinates

        //Mont Blanc Summit - red using peakbagger coordinates test coords TEST 1
        makePointsOfInterest(0.34,6.20,0xff0000,box );

        //Aiguille du Midi - light blue CALIBRATION TEST 2
        makePointsOfInterest(2.188, 1.042,0x27C8F5,box);

        // Bosson Glaicer - light green 
        makePointsOfInterest(0.371, 2.072, 0x00ff00, box);
        
        //Mer de Glace - light pink

        
        makePointsOfInterest(6.473,-1.226, 0xED74E7,box);

        // Argentiere Glacier - teal
        makePointsOfInterest(11.193,-5.716,0x0DB896,box);

        // La Vallee Blanche - Magenta 
        makePointsOfInterest(3.575, 1.525, 0xff00ff, box);

        // Glaciar de Bionnassay
        makePointsOfInterest(-3.032, 6.137,0x00ffff, box);



    },
    undefined, // onProgress
    (error) => { console.error('An error has occurred:', error); }
);

const rotateCheckbox = document.getElementById("Rotate");
let rotateModel = false;

// When checkbox is clicked, toggle rotation
rotateCheckbox.addEventListener("change", () => {
    rotateModel = rotateCheckbox.checked;
});

//When check box is checked, auto progress slider
const ageSlider = document.getElementById("AgeSlider")
const autoCheckbox = document.getElementById("Auto");
//let autoProgress = false;
// autoCheckbox.addEventListener("change", () => {
//     autoProgress = autoCheckbox.checked;
// });

function animate( time ) {
    if (rotateModel && model && !CALIBRATION_MODE) {
    model.rotation.y += 0.01;   // constant rotation speed
    }

    controls.update(); // required for damping to work
    renderer.render( scene, camera );
    

    // if (autoProgress) {
    //     let currentValue = Number(ageSlider.value);
    //     currentValue += 0.05;
    //     if (currentValue > Number(ageSlider.max)) {
    //         currentValue = Number(ageSlider.min);
    //     }
    //     ageSlider.value = currentValue;
    // }


}
renderer.setAnimationLoop(animate);