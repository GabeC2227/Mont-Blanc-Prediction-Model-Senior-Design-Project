import * as THREE from './node_modules/three/build/three.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; //load model
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; //camera movement

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

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
    const z =
        box.max.z -
        zPercent * (box.max.z - box.min.z);

    // Send back the X and Z position
    return {x, z};
        
}
//too much work and code to make points of interest one by one so I made a function
function makePointsOfInterest(latitude, longitude, color, box){

    const position = geoToModel(
            latitude,
            longitude,
            box
    );

    const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 32, 32),
        new THREE.MeshBasicMaterial({ color })
    );

    const rayOrigin = new THREE.Vector3(
        position.x,
        box.max.y + 10,
        position.z
    );
    
    const raycaster = new THREE.Raycaster( rayOrigin, new THREE.Vector3(0, -1, 0));
    
    const intersections = raycaster.intersectObject(model, true);
    
    if (intersections.length > 0) {
        const hitPoint = intersections[0].point; 
        marker.position.set( hitPoint.x, hitPoint.y + 0.2, hitPoint.z);
        scene.add(marker);
        console.log("Marker placed:", latitude, longitude, marker.position);
    return marker;
    }
    //Chamonix-Mont-Blanc and Mer de Glace dont hit??? HELP
    console.warn("Raycaster didn't hit terrain:", latitude, longitude, position);
    
    return null;
};


let model; // keep a reference to model just in case

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
        camera.position.set(0, maxDim * 0.5, maxDim * 1.5);

        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();
    

        const testLatitude = 45.8;
        const testLongitude = 6.8;

        const secondLatitude = 45.85;
        const secondLongitude = 6.95;

        //reference to center
        const centerPosition = geoToModel(
            testLatitude,
            testLongitude,
            box
        );

        // Debug test if we see that this code sec is running
        console.log("TEST MARKER SHOW UPPPPP", centerPosition); 

        //Mont Blanc Summit
        makePointsOfInterest(
            45.8,
            6.8,
            0xff0000,
            box
        );
        //Chamonix-Mont-Blanc - didnt hit
        makePointsOfInterest(
            45.89,
            6.87,
            0x00ff00,
            box
        );
        //Aiguille du Midi
        makePointsOfInterest(
            45.88,
            6.89,
            0x00ff00,
            box
        );
        //Mer de Glace - didnt hit
        makePointsOfInterest(
            45.89,
            6.93,
            0x00ff00,
            box
        );
        //Glacier des Bossons
        makePointsOfInterest(
            45.89,
            6.84,
            0x00ff00,
            box
        );

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


function animate( time ) {
    if (rotateModel && model) {
    model.rotation.y += 0.01;   // constant rotation speed
    }

    controls.update(); // required for damping to work
    renderer.render( scene, camera );
    
}
renderer.setAnimationLoop(animate);