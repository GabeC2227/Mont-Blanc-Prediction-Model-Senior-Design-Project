# Regional snow and ice appearance experiment

The year slider uses the existing annual regional mass-balance JSON to change
snow-like texture colors across the entire mountain terrain. The effect is no
longer restricted to the 50 glacier footprint overlays. It does not need
`glacierFootprints.json`, measured ice thickness, or new forecast outputs.

At 2027 the original terrain texture is unchanged. As cumulative predicted
loss increases, bright, low-saturation texture areas progressively fade toward
illustrative rock colors, with lower terrain changing sooner. Moving the slider
back restores the original appearance. Vegetation and darker rock colors are
preserved by the color mask. Prediction markers and camera controls are unchanged.

This is an illustrative regional effect, not a snow-cover, glacier-retreat or
ice-thickness forecast. Bright rock may be mistaken for snow; snow in deep
shadow may be missed. Exposed rock is a display color, not a measured bed surface.
The terrain geometry does not change. One regional series drives all terrain
snow appearance; no individual-glacier projection is claimed.

The display scales cumulative loss relative to the largest deficit in the
loaded timeline. The default `endFraction = 0.15` is an animation control, not
15% ice remaining. The first year is the visual baseline and does not apply
its own annual balance. Positive balances can restore part of the display.
The on-screen label states that the effect is illustrative.

## Files
- main.js: retains the terrain loader, markers and slider; connects the effect.
- glacierPrototype.js: exports the existing createGlacierPrototype and
  buildIllustrativeTimeline names for compatibility; modifies cloned terrain
  materials and restores their original references on disposal.
- Existing processed annual JSON: remains the regional forecast input.

Run from the repository root with `python3 -m http.server 8000`, then open
http://localhost:8000/visualization/model.html. Compare 2027 and 2076; returning
to 2027 should restore the original satellite texture. No npm packages are added.

Checks completed: annual timeline validation, shader injection against the
installed Three.js shader, shared-uniform updates, restoration, invalid input
handling, material disposal and absence of added terrain geometry.
The final appearance needs a visual check in Chrome after reloading.
