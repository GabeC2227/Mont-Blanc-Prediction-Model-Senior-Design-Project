import * as THREE from './node_modules/three/build/three.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; //load model
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; //camera movement

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer();
renderer.setClearColor(0x1b4f8f, 1); //background color blue??? not working :(
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
function makePointsOfInterest(x, z, color, box, name, info) {

    const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 32, 32),
        new THREE.MeshBasicMaterial({ color })
    );
    //made points unclickable, fixed?
    //marker.raycast = () => {};

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
        
        //
        marker.userData = { name, info };   
        markers.push(marker);   

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

//beginning of point and click
const terrainMeshes = []; // for placing markers
const markers = []; //clickable points

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
        model.traverse((o) => { if (o.isMesh) terrainMeshes.push(o); }); //collect terrain meshes in loader
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
        makePointsOfInterest(0.34,6.20,0xff0000,box, 'Mont Blanc Summit',
    'The highest point in the Alps. French surveyors measured the summit at 4,807.47 m in October 2026. The height changes with the snow and ice cap on top of the rock.');

        //Aiguille du Midi - light blue CALIBRATION TEST 2
        makePointsOfInterest(2.188, 1.042,0x27C8F5,box, 'Aiguille du Midi',
    'A needle-shaped peak above Chamonix at 3,842 m, reached by cable car. It is the starting point for the Vallée Blanche.');

        // Bosson Glaicer - light green 
        makePointsOfInterest(0.371, 2.072, 0x00ff00, box, 'Bossons Glacier',
    'A glacier that flows from the Mont Blanc summit area down toward the Chamonix valley.');
        
        //Mer de Glace - light pink
        makePointsOfInterest(6.473, -1.226, 0xED74E7, box,
            'Mer de Glace',
            "France's largest glacier, about 7 km long and up to 200 m thick. In the last 30 years it has lost more ice than in the 170 years between 1825 and 1995.");

        // Argentiere Glacier - teal
        makePointsOfInterest(11.193, -5.716, 0x0DB896, box,
            'Argentière Glacier',
            'TODO: add facts about the Argentière Glacier.');

        // La Vallee Blanche - Magenta
        makePointsOfInterest(3.575, 1.525, 0xff00ff, box,
            'La Vallée Blanche',
            'A famous off-piste route across glacier ice, starting at the Aiguille du Midi.');

        // Glaciar de Bionnassay
        makePointsOfInterest(-3.032, 6.137, 0x00ffff, box,
            'Bionnassay Glacier',
            'TODO: add facts about the Bionnassay Glacier.');



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


//POI CLICK FUNCTIONALITY
//wonky camera controls when zoomed, also constant rotation wonky, needs fixing
let zoomGoal = null;        // where the camera is currently flying to (null = not flying)
const ZOOM_DISTANCE = 4;    // how close the camera ends up to the marker

const clickRaycaster = new THREE.Raycaster(); //raycaster reports what it hits
const pointer = new THREE.Vector2(); //2d, keeps track of where the mouse is
const panel = document.getElementById('poi-ui-panel') //gets info from HTML so the code can show/hide it and fill it in

//
renderer.domElement.addEventListener('click', (event)=> {
//
const rect = renderer.domElement.getBoundingClientRect(); //gets size and shape of screen
pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; // Mouse horizontal position into num
pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1; // mouse vert into num
clickRaycaster.setFromCamera(pointer, camera); // Aims the raycaster from the camera, through the spot where you clicked, into the scene.
const hits = clickRaycaster.intersectObjects(markers, false); //finds which marker has been clicked, false means only test markers themselves, not attached to them
//wth is happening omg it looks nuts
//if marker is clicked
if (hits.length > 0) {
    const { name, info } = hits[0].object.userData; //go to nearest to click and pull info
    panel.innerHTML = `<h2>${name}</h2><p>${info}</p>`; //fill popup panel with info
    panel.classList.remove('hidden');
    const markerPos = hits[0].object.getWorldPosition(new THREE.Vector3());
    const dir = camera.position.clone().sub(markerPos).normalize();
    zoomGoal = {
        target: markerPos,
        position: markerPos.clone().add(dir.multiplyScalar(ZOOM_DISTANCE))
    }; 
} else {
        // ...if the click missed every marker, hide the panel again.
        panel.classList.add('hidden');
    }
});







function animate( time ) {
    if (rotateModel && model && !CALIBRATION_MODE) {
    model.rotation.y += 0.01;   // constant rotation speed
    }

    //zoom animation math stuffs
    if (zoomGoal) {
        controls.target.lerp(zoomGoal.target, 0.08);
        camera.position.lerp(zoomGoal.position, 0.08);
        if (camera.position.distanceTo(zoomGoal.position) < 0.01) zoomGoal = null;
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