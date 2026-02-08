
# Multi-Plane Visualization with Curl Noise

---

## Description
This project visualizes dynamically deformed planes in a 3D environment, using curl noise to create intricate and flowing shapes. The planes are rendered with various coloring schemes and interactively updated parameters for a customizable experience.

---

## Features
- **Dynamic Deformation**: Each plane's vertices are deformed using curl noise, creating smooth and flowing structures.
- **Customizable Parameters**: Adjust parameters like grid resolution, noise frequency, amplitude, and number of planes using a GUI interface.
- **Coloring Schemes**: Choose from different coloring methods, such as warm/cool zones, banding patterns, noise gradients, or orientation-based hues.
- **Interactive Controls**:
  - Press the space bar to reinitialize planes.
  - Press 'S' to save snapshots of the current visualization.

---

## File Structure
```
project/
├── index.html          # Main HTML file
├── sketch.js           # Main p5.js simulation logic
└── README.md           # Documentation
```

---

## Key Components
### Plane Deformation
- **Grid-Based Vertices**: Each plane is divided into a grid for deformation.
- **Curl Noise**: Deformations are applied iteratively using a multi-octave curl noise function for added complexity.
- **Smoothing**: Vertices are smoothed across neighbors for a cohesive, flowing appearance.

### GUI Interface
- **dat.GUI Integration**: Provides sliders to adjust parameters like:
  - Number of planes
  - Plane size range
  - Grid resolution
  - Noise frequency and amplitude
  - Deformation steps

---

## Setup Instructions
1. Clone or download the project folder.
2. Open `index.html` in a web browser to run the simulation.

---

## Usage
- **Exploration**: Use the GUI sliders to modify plane parameters in real-time.
- **Customization**:
  - Change the coloring function (`getColorByZone`, `getColorByBands`, etc.) in the code for different visual effects.
  - Adjust deformation parameters in the `DeformedPlane` class for unique shapes.
- **Interaction**:
  - Press the space bar to regenerate planes with current parameters.
  - Press 'S' to save a snapshot of the canvas.

---

## Possible Extensions
- Add interactive features like mouse-based control of plane positions or orientations.
- Implement additional noise types (e.g., Perlin noise or simplex noise) for deformation.
- Introduce animation for continuous transformation of planes over time.

