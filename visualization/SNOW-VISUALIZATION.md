# Illustrative glacier footprint animation

Restored the version immediately before the whole-terrain snow experiment.
Light blue overlays cover 50 glacier footprints. The existing regional annual
forecast drives visible thinning and edge shrinkage through the year slider.
The original mountain texture is unchanged. This version uses
`glacierFootprints.json` alongside `glacierPrototype.js`; both are required.

The displayed ice height, shrinkage and remaining fraction are illustrative,
not measured thickness or calibrated glacier retreat. One regional prediction
series drives all overlays. The first forecast year is the visual baseline.
The on-screen label identifies the effect as illustrative.

Moving from 2027 toward 2076 reduces the overlay; returning to 2027 restores it.
Prediction markers and camera controls retain their existing behavior.
Geometry is prepared offline so startup does not perform terrain ray sampling.
