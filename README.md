# Mont Blanc Projection Model Predictor

## Project Description

The **Mont Blanc Projection Model Predictor** is an interactive glacier forecasting and 3D visualization project developed to explore how glacier conditions in the Mont Blanc region may change over time.

The project combines historical glacier and climate data, machine-learning-based surface mass-balance forecasting, and an interactive Three.js terrain visualization. Users can explore the Mont Blanc study area, move through prediction years from **2027–2076**, view localized prediction severity, and interact with educational points of interest.

The project is divided into three primary areas:

- **UI / UX** — Provides the educational website, navigation, user controls, and interactive points of interest.
- **Three.js Visualization / Application Logic** — Renders the Mont Blanc terrain, maps forecast data onto the 3D model, and manages user interaction.
- **Data Science / Machine Learning** — Processes historical and projected climate data and generates future glacier surface mass-balance predictions.

---

## Project Objectives

- Develop an interactive 3D representation of the Mont Blanc study area.
- Forecast glacier surface mass balance under projected future climate conditions.
- Connect geographic glacier prediction data to locations on the 3D terrain.
- Allow users to explore annual projections from **2027 through 2076**.
- Visually communicate differences in predicted glacier mass loss using color, marker size, and an illustrative glacier-change layer.
- Provide educational information about significant glaciers, landmarks, and the environmental importance of the Mont Blanc region.
- Create a framework that can be extended with improved datasets, additional climate scenarios, and future visualization techniques.

---

## Technical Application / Architecture

The project follows a pipeline in which climate and glacier data are processed in Python, exported into visualization-ready formats, and loaded into a browser-based Three.js application.

```text
Historical Glacier + Climate Data
                │
                ▼
       Data Cleaning / Processing
                │
                ▼
        Feature Engineering
                │
                ▼
     Machine Learning Evaluation
                │
                ▼
       Linear Regression Model
                │
                ▼
 Future SSP2-4.5 Climate Projections
                │
                ▼
  Surface Mass-Balance Predictions
                │
          CSV / JSON Output
                │
                ▼
       Three.js Visualization
                │
      ┌─────────┴─────────┐
      ▼                   ▼
Prediction Markers   Glacier Change Layer
      │                   │
      └─────────┬─────────┘
                ▼
       Interactive Web UI
```

### UI / UX

The user interface is implemented with **HTML, CSS, and JavaScript** and is designed to make the scientific visualization approachable to a general audience.

Major interface features include:

- A prediction-year slider covering **2027–2076**.
- Constant model rotation controls.
- Clickable points of interest containing educational information.
- Camera zooming when a point of interest is selected.
- Navigation between the informational website and the 3D visualization.
- Consistent styling across the interactive visualization and supporting pages.

### Three.js Visualization / Back-End Application Logic

**Three.js** provides the browser-based 3D rendering and interaction layer used to connect the processed prediction data with the Mont Blanc terrain model.

The visualization:

- Loads the Mont Blanc terrain as a GLB/GLTF model created in Blender.
- Uses `OrbitControls` for camera movement and exploration.
- Uses geographic coordinate mapping to convert latitude and longitude into model-space X/Z positions.
- Uses raycasting to locate the terrain surface and position markers correctly along the mountain.
- Displays prediction markers at fixed glacier-related sample locations.
- Updates marker color and size according to predicted surface mass-balance severity.
- Uses a translucent glacier overlay to illustrate relative glacier change over time.
- Updates both prediction and glacier visualization layers when the selected year changes.
- Uses raycasting for clickable points of interest and camera-focused educational interactions.

The prediction markers represent **local predicted surface mass-balance severity** and should not be interpreted as exact future glacier boundaries or glacier geometry.

### Data Science / Machine Learning

The data-science pipeline is implemented in Python through a sequence of Jupyter notebooks.

The workflow includes:

1. Preparing historical glacier and climate data.
2. Exploring the data and selecting climate features.
3. Training and comparing regression models.
4. Preparing and bias-correcting future climate projections.
5. Generating future glacier surface mass-balance forecasts.
6. Exporting CSV and JSON files for use by the Three.js visualization.

The final model uses four seasonal climate variables:

- Winter temperature
- Summer temperature
- Winter precipitation
- Summer precipitation

Multiple regression approaches were evaluated during development, including:

- Linear Regression
- Random Forest
- Gradient Boosting
- Support Vector Regression

The final forecasting workflow uses **Linear Regression** with time-based validation.

The future prediction output contains **58 glacier-related locations across 50 hydrological years**, resulting in **2,900 glacier-year predictions from 2027 through 2076**.

---

## Repository Structure

```text
Mont-Blanc-Prediction-Model-Senior-Design-Project/
│
├── data-science/
│   ├── data/
│   │   └── processed/
│   │       ├── MontBlanc_Historical_Model_Data_1968-2015.csv
│   │       ├── MontBlanc_Future_Climate_SSP245_2027-2076.csv
│   │       ├── MontBlanc_Future_MassBalance_Predictions_SSP245_2027-2076.csv
│   │       ├── MontBlanc_Yearly_MassBalance_Summary_SSP245_2027-2076.csv
│   │       └── MontBlanc_Visualization_MassBalance_SSP245_2027-2076.json
│   │
│   ├── notebooks/
│   │   ├── 01_prepare_historical_data.ipynb
│   │   ├── 02_explore_and_select_features.ipynb
│   │   ├── 03_train_and_compare_models.ipynb
│   │   ├── 04_prepare_future_climate_data.ipynb
│   │   └── 05_forecast_future_mass_balance.ipynb
│   │
│   └── README.md
│
├── visualization/
│   ├── Assets/
│   ├── index.html
│   ├── model.html
│   ├── main.js
│   ├── glacierPrototype.js
│   ├── glacierFootprints.json
│   ├── style.css
│   ├── package.json
│   └── README.md
│
├── docs/
│   ├── data-contract.md
│   └── README.md
│
├── index.html
└── README.md
```

---

## Datasets

The project combines historical glacier observations, historical climate information, and future climate projections.

### Historical Glacier Mass Balance

Historical glacier-wide surface mass-balance observations are used as the prediction target for machine-learning development.

The processed historical modeling dataset covers hydrological years **1968–2015** and includes glacier identifiers, geographic coordinates, seasonal climate variables, and observed mass balance.

**Source:** Bolibar et al. reconstructed annual glacier-wide mass-balance dataset for glaciers in the French Alps.

<!-- TODO - YESSI:
Please add or verify the following information for the historical glacier mass-balance dataset:
- Official dataset name
- Source / download URL
- Full citation
- License or access information
- Any relevant notes about how the dataset was obtained
-->

---

### Historical Climate Data

Historical temperature and precipitation data are derived from **ERA5** and processed for the Mont Blanc glacier locations.

Monthly climate information is converted into seasonal variables using an October–September hydrological year before being combined with the glacier observations.

**Source:** ERA5 climate data from the Copernicus Climate Data Store.

<!-- TODO - YESSI:
Please add or verify the following information for the ERA5 historical climate dataset:
- Exact ERA5 dataset/product name
- Source / download URL
- Full citation
- License or access information
- Climate variables used
- Historical time period downloaded
- Any important preprocessing notes
-->

---

### Future Climate Data

Future temperature and precipitation projections use the **CNRM-CM6-1 SSP2-4.5** climate scenario.

Future climate values are spatially mapped to the glacier locations and bias-corrected against historical climate conditions before being used by the forecasting model.

The processed future dataset contains **58 glacier-related locations across 50 complete hydrological years from 2027–2076**.

<!-- TODO - YESSI:
Please add or verify the following information for the future climate dataset:
- Official dataset/model name
- CNRM-CM6-1 source
- SSP2-4.5 scenario source
- Source / download URL
- Full citation
- License or access information
- Climate variables used
- Historical and future time ranges downloaded
- Any important notes about interpolation, bias correction, or preprocessing
-->

---

### Visualization Outputs

The data-science pipeline exports processed files for visualization and analysis.

Primary outputs include:

- Glacier-level future surface mass-balance predictions.
- Yearly mean, minimum, and maximum forecast summaries.
- A simplified JSON dataset used by the glacier-change visualization.
- Geographic coordinates used to place prediction markers on the Three.js terrain.

<!-- TODO - YESSI:
If additional explanation is useful, add:
- What each visualization output represents
- Which notebook generates each file
- Whether each file is intended for visualization, analysis, or both
-->

---

## Implementation and Testing Approach

Development was divided across the UI/UX, Three.js visualization, and data-science components before integration into the final application.

### Data Science Testing

The machine-learning pipeline uses chronological testing rather than a random train/test split because the final goal is to forecast future conditions.

Testing and validation include:

- Using earlier historical observations for model development and later observations for final evaluation.
- Time-based validation during feature and model selection.
- Comparing candidate models using common regression metrics such as:
  - Mean Absolute Error (MAE)
  - Root Mean Squared Error (RMSE)
  - R²
- Checking processed datasets for missing values and duplicate glacier-year records.
- Verifying expected year ranges and climate features.
- Reloading and validating exported prediction files before visualization integration.

### Three.js Visualization Testing

The visualization was developed and tested incrementally.

Testing included:

- Confirming that geographic coordinates map to valid Three.js terrain positions.
- Verifying prediction-marker placement using downward raycasting.
- Confirming valid terrain placement for all **58 prediction locations**.
- Testing the prediction-year slider across **2027–2076**.
- Verifying prediction marker color and size updates.
- Testing the glacier-change visualization alongside the prediction marker layer.
- Testing point-of-interest raycasting and selection.
- Testing educational information panels.
- Testing camera zoom behavior.
- Testing constant model rotation and camera controls.
- Integrating development branches before merging the final visualization into the main project branch.

### UI / UX Testing

The UI was tested alongside the visualization to ensure that the user can interact with the model without interfering with the underlying Three.js controls.

Testing included:

- Navigation between the main site and visualization.
- Prediction-year controls.
- Model rotation controls.
- Point-of-interest selection.
- Information-panel visibility.
- Camera interaction after point selection.
- Consistent visual styling throughout the project.

---

## Future Work

Potential future improvements include:

- Incorporating glacier-specific characteristics such as elevation, area, slope, and aspect into the prediction model.
- Evaluating additional machine-learning models and feature sets as more glacier data become available.
- Supporting additional climate scenarios beyond SSP2-4.5.
- Replacing the illustrative glacier-change layer with future glacier thickness, volume, or boundary datasets when reliable projections are available.
- Improving the spatial resolution of climate inputs and glacier-specific predictions.
- Expanding points of interest and educational information.
- Adding visualization modes for comparing different years, climate scenarios, or individual glaciers.
- Improving accessibility, responsive design, and mobile interaction.
- Extending the architecture so that the visualization approach can be adapted to other mountain and glacier regions.

---

## Tech Stack

| Area | Technologies |
|---|---|
| **UI / UX** | HTML5, CSS3, JavaScript |
| **3D Visualization / Application Logic** | Three.js, WebGL, OrbitControls, Raycaster, GLTFLoader |
| **3D Modeling** | Blender, GLB/GLTF |
| **Data Science** | Python, Pandas, Xarray, NumPy |
| **Machine Learning** | Scikit-learn |
| **Analysis / Development** | Jupyter Notebook |
| **Data Formats** | CSV, JSON, NetCDF |
| **Version Control** | Git, GitHub |
| **Development Environment** | GitHub Codespaces, Visual Studio Code |

---

## Project Limitations

The current implementation has several important limitations:

- Results are specific to the Mont Blanc study area.
- Historical glacier and climate data contain limited spatial and temporal detail.
- Future predictions depend on the selected **SSP2-4.5** climate scenario.
- Surface mass-balance predictions describe predicted gain or loss of glacier mass and do not directly predict exact future glacier thickness, volume, or boundaries.
- The glacier-change overlay is intended as an **illustrative visualization of relative predicted change**, not an exact reconstruction of future glacier geometry.

---

## Contributors

Developed as a **CSCI 495 Senior Design Project** at the University of Tennessee at Martin.

- **Gabriel Carranza** — Three.js visualization, application integration, geographic mapping, prediction visualization
- **McKenzie Hughes** — UI / UX, interaction design, educational interface
- **Yessi Chavez** — Data science, dataset preparation, machine-learning pipeline, glacier visualization data

<!-- TODO - TEAM:
Adjust contributor descriptions if needed so responsibilities accurately reflect each team member's final contributions.
-->

