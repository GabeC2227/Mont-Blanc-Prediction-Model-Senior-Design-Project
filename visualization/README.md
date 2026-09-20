# Visualization -- The  Three.js terrain generation code, heightmap assets and the scroll/slider feature. 

## Geographic Coordinate Mapping Prototype

### Overview

This update adds a prototype for mapping real-world latitude and longitude coordinates onto the Mont Blanc 3D terrain model in Three.js.

The current goal is to take coordinates from the project dataset, convert them into Three.js positions, and place markers directly on the terrain surface.

### Geographic Bounds

The terrain model currently uses the following geographic bounds:

- North: `45.9`
- South: `45.7`
- West: `6.6`
- East: `7.0`

These bounds represent the area covered by the Mont Blanc model.

### Coordinate Conversion

The `geoToModel()` function converts geographic coordinates into Three.js coordinates:

- Longitude → X
- Latitude → Z

Latitude and longitude are first normalized into a `0–1` range, then mapped to the model's bounding box.

### Model Centering

The terrain model is centered at the Three.js origin:

```text
(0, 0, 0)

### Terrain Raycasting

A Three.js `Raycaster` is used to determine the terrain height at the converted X/Z position.

The ray starts above the terrain and travels downward until it intersects the GLB model.

The first intersection provides the exact surface position:

- X = east/west location
- Y = terrain height
- Z = north/south location
