import * as THREE from './node_modules/three/build/three.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; //load model
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; //camera movement

import { createGlacierPrototype, buildIllustrativeTimeline } from './glacierPrototype.js';


const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer();
renderer.setClearColor(0x1b4f8f, 1); // background color blue
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

// This part three.js canvas is matched with the browser window 
window.addEventListener("resize", () => {

    camera.aspect =
        window.innerWidth / window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
});

//camera controls
const controls = new OrbitControls( camera, renderer.domElement );

// lighting 
const ambient = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambient);

const directional = new THREE.DirectionalLight(0xffffff, 2);
directional.position.set(5, 10, 5);
scene.add(directional);

const GEO_ANCHORS = {

    montBlanc: {
        latitude: 45.83267,
        longitude: 6.86512,
        x: 0.340,
        z: 6.200
    },

    aiguilleDuMidi: {
        latitude: 45.8785,
        longitude: 6.8875,
        x: 2.188,
        z: 1.042
    }

};

 
// true = top-down calibration grid
// false = normal 3D model view
const CALIBRATION_MODE = false;

//Converison of LAT/LONG into Three.js X/Z Coordinates
// Coordinate Plane is kinda goated here
// geoToModel() = WHERE horizontally

function geoToModel(latitude, longitude) {

    const anchorA = GEO_ANCHORS.montBlanc;
    const anchorB = GEO_ANCHORS.aiguilleDuMidi;


    const referenceLatitude = (anchorA.latitude + anchorB.latitude) / 2;
    const referenceLatitudeRad = THREE.MathUtils.degToRad(referenceLatitude);

    // Converts geo. differences into small local east/south plane
    function geographicOffset(lat, lon) {
        
    const east = (lon - anchorA.longitude) * Math.cos(referenceLatitudeRad);
    const south = -(lat - anchorA.latitude);

    return {east, south};
    }
    
    // Geographic direction from Mont Blanc to Aiguille du Midi
    const anchorBGeo = geographicOffset(anchorB.latitude, anchorB.longitude);
    
    const pointGeo = geographicOffset(latitude, longitude);

    const modelDX = anchorB.x - anchorA.x;
    const modelDZ = anchorB.z - anchorA.z;

    const geoDistance = Math.hypot(anchorBGeo.east, anchorBGeo.south);
    const modelDistance = Math.hypot(modelDX,modelDZ);
    const scale = modelDistance / geoDistance;

    const geographicAngle = Math.atan2(anchorBGeo.south, anchorBGeo.east);
    const modelAngle = Math.atan2(modelDZ, modelDX);
    const rotation = modelAngle - geographicAngle;

    const rotatedX = 
        pointGeo.east * Math.cos(rotation) - 
        pointGeo.south * Math.sin(rotation);

     const rotatedZ =
        pointGeo.east * Math.sin(rotation) +
        pointGeo.south * Math.cos(rotation);

    return {
        x: anchorA.x + rotatedX * scale,
        z: anchorA.z + rotatedZ * scale
    };
}

async function loadPredictionData() {

    const response = await fetch('../data-science/data/processed/MontBlanc_Future_MassBalance_Predictions_SSP245_2027-2076.csv');

    if (!response.ok) {
        throw new Error(`Prediction CSV failed to load: ${response.status}`);
    }

    const csvText = await response.text();

    // Split the CSV into individual rows.
    const lines = csvText
        .trim()
        .split(/\r?\n/);

    // First row contains the column names.
    const headers = lines[0]
        .split(',')
        .map(header => header.trim());

    // converts remaining rows into JS object
    const records = lines
        .slice(1)
        .map(line => {

    const values = line.split(',');
    const row = {};

        headers.forEach((header, index) => {
        row[header] = values[index]?.trim();
        });

    // converts the fields that are needed by three.js
    // from strings to numbers
    row.hydrological_year = Number(row.hydrological_year);
    row.glacier_index = Number(row.glacier_index);
    row.latitude = Number(row.latitude);
    row.longitude = Number(row.longitude);
    row.predicted_mass_balance = Number(row.predicted_mass_balance);

        return row;
    });

    return records;
}

//too much work and code to make points of interest one by one so I made a function
function makePointsOfInterest(x, z, color, box, name, info) {

    const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 32, 32),
        new THREE.MeshBasicMaterial({ color })
    );

    

    const rayOrigin = new THREE.Vector3(
        x,
        box.max.y + 10,
        z
    );

    const raycaster = new THREE.Raycaster(rayOrigin,new THREE.Vector3(0, -1, 0));
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

        marker.userData.name = name;
        marker.userData.info = info;

        poiMarkers.push(marker);


        console.log(`Point of interest placed: x=${x}, z=${z}`);
        return marker;
    }

    console.warn("Point of interest did not hit terrain:", x,z);
    return null;
}

// Converts the prediction severity into marker size and color.

function getPredictionStyle(value, globalMin, globalMax) {

    // converts mass balance from a 0-1 severity scale/value
    // 0 - weakest loss / slight gain or 1 - strongest predicted loss
   const severity = THREE.MathUtils.clamp(
    (globalMax - value) / (globalMax - globalMin), 0, 1);

    const scale = THREE.MathUtils.lerp(0.80, 2.00, severity);
    
    // color scale for severity from blue -> yellow -> red
    let color;

    if (severity < 0.25) {
        color = new THREE.Color(0x0047AB); // Blue
    } 
    else if (severity < 0.50) {
        color = new THREE.Color(0xFFD60A) // yellow
    } 
    else if (severity < 0.75) {
        color = new THREE.Color(0xFF8C00) // orange
    }
    else {
        color = new THREE.Color(0xD90429); // red
    }
    return {scale, color};
}

function makePredictionMarker(prediction, box, globalMin, globalMax) {
    
    const style = getPredictionStyle(prediction.predicted_mass_balance, globalMin, globalMax);

    const marker = new THREE.Mesh(
        predictionMarkerGeometry,
        new THREE.MeshBasicMaterial({
            color: style.color
        })
    );

    marker.scale.setScalar(style.scale);

    // This prevents the predict. markers from blocking terrain raycasts
    marker.raycast = () => {};

    const rayOrigin = new THREE.Vector3(prediction.x, box.max.y + 10, prediction.z);
    const raycaster = new THREE.Raycaster(rayOrigin, new THREE.Vector3(0, -1, 0));
    const intersections = raycaster.intersectObject(model, true);

    if (intersections.length === 0){
        return null;
    }

    const worldHitPoint = intersections[0].point.clone();
    model.updateMatrixWorld(true);

    const localHitPoint = model.worldToLocal(worldHitPoint.clone());

    marker.position.set(
        localHitPoint.x,
        localHitPoint.y + 0.1,
        localHitPoint.z
    );

    // Saves prediction info on the marker, will be useful when the year slider gets added
    marker.userData.glacier_index = prediction.glacier_index;
    marker.userData.predicted_mass_balance = prediction.predicted_mass_balance;

    predictionLayer.add(marker);

    predictionMarkers.set(prediction.glacier_index, marker);

    return marker;
}

function updatePredictionLayer(year, globalMin, globalMax) {
    const yearPredictions = predictionData.filter(
        row => row.hydrological_year === year 
    );

    let updatedMarkers = 0;
    yearPredictions.forEach(prediction => {
        const marker = predictionMarkers.get(prediction.glacier_index);

        if (!marker) {
            return;
        }

        const style = getPredictionStyle(prediction.predicted_mass_balance, globalMin, globalMax);

        // updating the size
        marker.scale.setScalar(style.scale);
        // updating the color
        marker.material.color.copy(style.color);

        // Updating data stored on marker
        marker.userData.predicted_mass_balance = prediction.predicted_mass_balance;
        marker.userData.hydrological_year = year;

        updatedMarkers++;
    });

    console.log(`Updated ${updatedMarkers} prediction markers for ${year}`);
}

let model; // keep a reference to model just in case
let predictionData = []; // Stores the ML prediction records

const predictionMarkerGeometry = new THREE.SphereGeometry(0.08, 16, 16);
const predictionLayer = new THREE.Group(); // oh yea its layering time
const glacierLayer = new THREE.Group();    // holds Yessi's ice mesh in group
const predictionMarkers = new Map();

const poiMarkers = [];
// =============================
//     CLICK DEBUGGER 
// =============================  

const calibrationRaycaster = new THREE.Raycaster();
const calibrationMouse = new THREE.Vector2();

// The POI Click/ Zoom for Mack's Branch

const poiClickRaycaster = new THREE.Raycaster();
const poiPointer = new THREE.Vector2();

let zoomGoal = null;

const ZOOM_DISTANCE = 4;

const poiPanel = document.getElementById("poi-ui-panel");

renderer.domElement.addEventListener("click", (event) => {

    if (!CALIBRATION_MODE || !model) return;

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

// POI Listener for the click raycaster 

renderer.domElement.addEventListener(
    "click",
    (event) => {

    if (CALIBRATION_MODE || !model) return;

    const rect = renderer.domElement
    .getBoundingClientRect();

    poiPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    poiPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    poiClickRaycaster.setFromCamera(poiPointer,camera);

    const hits = poiClickRaycaster.intersectObjects(poiMarkers, false);

    if (hits.length === 0) {
         poiPanel.classList.add("hidden");
        return;
    }

    const marker = hits[0].object;
    const {name, info} = marker.userData;

    poiPanel.innerHTML = `<h2>${name}</h2><p>${info}</p>`;
    poiPanel.classList.remove("hidden");

    const markerPosition = marker.getWorldPosition(new THREE.Vector3());

    const direction = camera.position.clone()
    .sub(markerPosition)
    .normalize();

    rotateModel = false;
    rotateCheckbox.checked = false;

    zoomGoal = {target: markerPosition,
        position:
        markerPosition
        .clone()
        .add(direction.multiplyScalar(ZOOM_DISTANCE))

        };
    }
);


const loader = new GLTFLoader();
loader.load('./Assets/mont_blanc.glb',
     async (gltf) => {
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

        let glacierTest = null;
        let glacierTimeline = new Map();
        try {
            const response = await fetch(
                '../data-science/data/processed/MontBlanc_Visualization_MassBalance_SSP245_2027-2076.json'
            );
            if (!response.ok) throw new Error(`Forecast JSON failed: ${response.status}`);
            glacierTimeline = buildIllustrativeTimeline(await response.json());
            glacierTest = await createGlacierPrototype(model);
            model.add(glacierLayer); //moves the mesh from model into the group
            glacierLayer.add(glacierTest.mesh); //moves the mesh from model into the group
            glacierTest.setRemainingFraction(
                glacierTimeline.get(Number(document.getElementById('AgeSlider').value)) ?? 1
            );
        } catch (error) {
            console.error('Terrain snow visualization:', error);
        }

        box = new THREE.Box3().setFromObject(model);
        // Prediction markers move and rotate with the mountain.
        model.add(predictionLayer);

        // recalculating the bounding box bc of the model
        // and its moved to the center of the scene of threejs
        box = new THREE.Box3().setFromObject(model);


        const maxDim = Math.max(size.x, size.y, size.z);
        camera.near = maxDim / 100;
        camera.far = maxDim * 100;
        camera.updateProjectionMatrix();

// Load and initialize prediction data or pleaseload CSV
try {
    predictionData = await loadPredictionData();

    const predictions2027 = predictionData.filter(
        row => row.hydrological_year === 2027
        );
    
    // ALL of the 2027-2076 range mass balance 
    const allMassBalanceValues = predictionData.map(
        row => row.predicted_mass_balance
    );

    const globalMinMassBalance = Math.min(...allMassBalanceValues);
    const globalMaxMassBalance = Math.max(...allMassBalanceValues);

    console.log("Global Mass Balance range:", globalMinMassBalance, "to", globalMaxMassBalance);
    console.log("Total prediction records:", predictionData.length);
    const mapped2027 = predictions2027.map(row => {
    const position = geoToModel(row.latitude, row.longitude);

    return {
        glacier_index: row.glacier_index,
        latitude: row.latitude,
        longitude: row.longitude,
        predicted_mass_balance: row.predicted_mass_balance,
        x: position.x,
        z: position.z
    };
});


const invalidPositions = mapped2027.filter(row =>
    !Number.isFinite(row.x) || !Number.isFinite(row.z));

const outsideModel = mapped2027.filter(row =>
    row.x < box.min.x ||
    row.x > box.max.x ||
    row.z < box.min.z ||
    row.z > box.max.z
);

console.log("Invalid mapped positions:", invalidPositions.length);
console.log("Positions outside model bounds:", outsideModel.length);



let terrainHits = 0;

mapped2027.forEach(prediction => {
    const marker = makePredictionMarker(prediction, box, globalMinMassBalance, globalMaxMassBalance);

    if (marker) {
        terrainHits++;
    }
});
console.log("2027 prediction terrain hits:", terrainHits, "/", mapped2027.length);
console.log("Prediction markers created:", predictionLayer.children.length);

// Connects the year-slider to the prediction layer
const yearDisplay = document.getElementById("yearDisplay");
yearSlider.addEventListener("input", () => {
    const selectedYear = Number(yearSlider.value);

    yearDisplay.textContent = selectedYear;
    updatePredictionLayer(selectedYear, globalMinMassBalance, globalMaxMassBalance);

    if (glacierTest && glacierTimeline.has(selectedYear)) {
        glacierTest.setRemainingFraction(glacierTimeline.get(selectedYear));
    }

});

} 
    catch (error){
    console.error("Prediction data error:",error);
}

 
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

    // Shows coordinate directions: red = +X | green = +Y | blue = +Z
    const axes = new THREE.AxesHelper(gridSize * 0.1);
    axes.position.y = box.max.y + 0.6;
    scene.add(axes);

    // Put camera directly above the model
    camera.position.set(
        0,
        box.max.y + maxDim * 1.5,
        0
    );

    /* geoToModel currently assumes:East  = +X | North = -Z
       Setting camera.up to -Z means:
       top of screen = North
       right side = East
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
    makePointsOfInterest(0.34,6.20,0xff0000, box, 
        'Mont Blanc Summit',
    'The highest point in the Alps. French surveyors measured the summit at 4,807.47 m in October 2026. The height changes with the snow and ice cap on top of the rock.');


    //Aiguille du Midi - light blue CALIBRATION TEST 2
    makePointsOfInterest(2.188, 1.042,0x27C8F5,box, 'Aiguille du Midi',
    'A needle-shaped peak above Chamonix at 3,842 m, reached by cable car. It is the starting point for the Vallée Blanche.');

    // Bosson Glaicer - light green 
    makePointsOfInterest(0.371, 2.072, 0x00ff00, box, 'Bosson Glacier',
    'A glacier that flows from the Mont Blanc summit area down toward the Chamonix valley.');
        
    //Mer de Glace - light pink
    makePointsOfInterest(6.473,-1.226, 0xED74E7, box, 'Mer de Glace',
    "France's largest glacier, about 7 km long and up to 200 m thick. In the last 30 years it has lost more ice than in the 170 years between 1825 and 1995.");

    // Argentiere Glacier - teal
    makePointsOfInterest(11.193,-5.716,0x0DB896, box, 'Argentière Glacier',
        'TODO: add facts about the Argentière Glacier');

    // La Vallee Blanche - Magenta 
    makePointsOfInterest(3.575, 1.525, 0xff00ff, box, 'La Vallée Blanche',
       'A famous off-piste route across glacier ice, starting at the Aiguille du Midi.');

    // Glaciar de Bionnassay
    makePointsOfInterest(-3.032, 6.137,0x00ffff, box, 'Bionnassay Glacier',
        'TODO: add facts about the Bionnassay Glacier');

    },
    undefined, // onProgress
    (error) => { console.error('An error has occurred:', error); }
);

const rotateCheckbox = document.getElementById("Rotate");
let rotateModel = false;

// When checkbox is clicked, toggle rotation
const yearSlider = document.getElementById("AgeSlider")
rotateCheckbox.addEventListener("change", () => {
    rotateModel = rotateCheckbox.checked;
});


// Switch between the two views or both
function setMode(mode) {
    if (mode === 'markers') {
        predictionLayer.visible = true;
        glacierLayer.visible = false;
    }

    else if (mode === 'ice') {
        predictionLayer.visible = false;
        glacierLayer.visible = true;
    }

    else if (mode === 'both') {
        predictionLayer.visible = true;
        glacierLayer.visible = true;
    }
}

document.querySelectorAll('input[name="viewMode"]').forEach((radio) => {
    radio.addEventListener('change', () => setMode(radio.value));
});

setMode('markers');   // which view shows first


function animate() {
    if (rotateModel && model && !CALIBRATION_MODE) {
    model.rotation.y += 0.01;   // constant rotation speed
    }

     if (zoomGoal) {

        controls.target.lerp(zoomGoal.target, 0.08);

        camera.position.lerp(zoomGoal.position, 0.08);
        
        if (camera.position.distanceTo(zoomGoal.position) < 0.01) {
            zoomGoal = null;
        }
    }

    controls.update(); // required for damping to work
    renderer.render( scene, camera);

}
renderer.setAnimationLoop(animate);