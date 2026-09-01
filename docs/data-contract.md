# Data Contract 

**Currently:** 
**Last Update:** [9/1/2026] Gabriel Carranza

## Purpose/Focus --

This is using a format for the ML model's output uses so Yessi's Python code and the Three.js visual code is compatible without breaking or messing up each other code. Or guessing what field each one is using.


```The JSON Dummy-Set and what its doing or what am i looking at and what does it even do

{
  "year": 2035,
  "ice_extent_pct": 0.72,
  "elevation_delta_by_region": [
    { "region_id": "north_face", "delta_m": -12.4 },
    { "region_id": "south_face", "delta_m": -8.1 }
  ]
}

```
## Field Defs:

| Field | Type | Explaination |

|  `year` | number | the projection year EX: 2035 (10 years from now) |

|`ice_extent_pct` | number (0-1) | Fraction of the ice extent that remains |

|`elevation_delta_by_region`| list | Per Region| elevation change (Or if you want to do the a single overall extent number) |

|`region_id`| string | Which part of the Mountain |

|`delta_m | number | The Elevation Change in meters (negative means its lower) | 


## Sample/Placeholder data

Live example file: `visualization/dummyset-predictions.json`

This is the fake data to mimic the real thing and Mckenzie this helps to finish/test the scroll-through-terrain  effect/animation as it visually changes. So its just somethig to use/test on to make sure that your code actually works.

This is a rough draft of the first schema for this.
-- Once Yessi gets the real predictions ready, then we can just swap this file for the real one.
Hopefully this helps you with your code.

This isnt set in stone just something to get you started or at least help you.