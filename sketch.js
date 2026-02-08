// ── Presets ──────────────────────────────────────────────────────
var PRESETS = {
  drift: {
    label: 'Drift',
    numPlanes: 20,
    minSize: 180,
    maxSize: 300,
    gridRes: 12,
    steps: 35,
    baseFreq: 0.005,
    freqMult: 0.1,
    ampMult: 1.0,
    animDuration: 8,
  },
  torrent: {
    label: 'Torrent',
    numPlanes: 55,
    minSize: 80,
    maxSize: 180,
    gridRes: 12,
    steps: 60,
    baseFreq: 0.015,
    freqMult: 0.15,
    ampMult: 1.4,
    animDuration: 6,
  },
  filaments: {
    label: 'Filaments',
    numPlanes: 75,
    minSize: 40,
    maxSize: 100,
    gridRes: 8,
    steps: 80,
    baseFreq: 0.025,
    freqMult: 0.2,
    ampMult: 1.8,
    animDuration: 5,
  },
};

var PRESET_KEYS = Object.keys(PRESETS);
var HOLD_MS = 2500;
var CREATOR_MAX_STEPS = 60;

// ── State ────────────────────────────────────────────────────────
let planes = [];
let animStartTime = 0;
let currentDuration = 8;
let currentMaxSteps = 60;
let activePreset = 'drift';

// Mode: 'showcase' or 'creator'
let mode = 'showcase';

// Showcase state machine
let phase = 'warping';
let phaseStartTime = 0;
let showcaseTimer = null;

// Creator state
let interactiveSeed = null;
let interactiveNoiseSeed = null;
let regenTimer = null;

// Shuffle animation
let shuffleAnimating = false;
let shuffleStartTime = 0;
let shuffleOldPlanes = [];
var SHUFFLE_MS = 800;

// DOM refs
let densitySlider, intensitySlider;

// ── Easing ───────────────────────────────────────────────────────
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInCubic(t) {
  return Math.pow(t, 3);
}

// ── p5 lifecycle ─────────────────────────────────────────────────
function setup() {
  let canvas = createCanvas(windowWidth, windowHeight, WEBGL);
  canvas.parent('canvas-container');
  colorMode(HSB, 360, 100, 100, 255);
  noStroke();

  densitySlider = document.getElementById('density-slider');
  intensitySlider = document.getElementById('intensity-slider');

  document.getElementById('make-own-btn').addEventListener('click', function () {
    switchMode('creator');
  });
  document.getElementById('back-btn').addEventListener('click', function () {
    switchMode('showcase');
  });
  document.getElementById('shuffle-btn').addEventListener('click', function () {
    shuffleOldPlanes = planes.map(function (p) {
      return { position: p.position.copy(), maxStep: p.maxSteps };
    });
    interactiveSeed = Math.floor(Math.random() * 1000000);
    interactiveNoiseSeed = Math.floor(Math.random() * 1000000);
    generateInstant(getUserParams());
    shuffleAnimating = true;
    shuffleStartTime = millis();
    loop();
  });
  densitySlider.addEventListener('input', onDensityChange);
  intensitySlider.addEventListener('input', onIntensityChange);

  enterShowcaseMode();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (mode === 'showcase') {
    generate(activePreset);
  } else {
    generateInstant(getUserParams());
  }
}

// ── Draw ─────────────────────────────────────────────────────────
function draw() {
  background(0);
  if (planes.length === 0) return;

  rotateX(PI / 4);
  rotateZ(PI / 6);

  if (mode === 'creator') {
    let intensity = Number(intensitySlider.value) / 100;
    let step = intensity * currentMaxSteps;
    for (let i = 0; i < planes.length; i++) {
      planes[i].renderAtStep(step);
    }
    if (shuffleAnimating) {
      let t = constrain((millis() - shuffleStartTime) / SHUFFLE_MS, 0, 1);
      if (t >= 1) {
        shuffleAnimating = false;
      }
    }
    noLoop();
    return;
  }

  // ── Showcase state machine ──
  let elapsed = (millis() - animStartTime) / 1000;

  if (phase === 'warping') {
    let globalT = constrain(elapsed / currentDuration, 0, 1);
    renderShowcaseFrame(globalT, false);
    if (globalT >= 1) {
      phase = 'hold_warped';
      phaseStartTime = millis();
    }
  } else if (phase === 'hold_warped') {
    renderShowcaseFrame(1, false);
    if (millis() - phaseStartTime >= HOLD_MS) {
      phase = 'unwarping';
      animStartTime = millis();
    }
  } else if (phase === 'unwarping') {
    let globalT = constrain(elapsed / currentDuration, 0, 1);
    renderShowcaseFrame(globalT, true);
    if (globalT >= 1) {
      phase = 'hold_flat';
      phaseStartTime = millis();
    }
  } else if (phase === 'hold_flat') {
    renderShowcaseFrame(0, false);
    if (millis() - phaseStartTime >= HOLD_MS) {
      generate(randomPreset());
    }
  }
}

function renderShowcaseFrame(globalProgress, reverse) {
  for (let i = 0; i < planes.length; i++) {
    let pl = planes[i];
    let localT = constrain((globalProgress - pl.delay) / pl.duration, 0, 1);
    let easedT = reverse ? (1 - easeInCubic(localT)) : easeOutCubic(localT);
    let step = easedT * pl.maxSteps;
    pl.renderAtStep(step);
  }
}

// ── Mode switching ───────────────────────────────────────────────
function switchMode(target) {
  let overlay = document.getElementById('fade-overlay');
  overlay.classList.add('active');

  setTimeout(function () {
    if (target === 'creator') {
      enterCreatorMode();
    } else {
      enterShowcaseMode();
    }
    setTimeout(function () {
      overlay.classList.remove('active');
    }, 100);
  }, 500);
}

function enterShowcaseMode() {
  clearTimeout(showcaseTimer);
  cancelAnimationFrame(regenTimer);
  mode = 'showcase';

  document.getElementById('creator-ui').classList.add('hidden');
  document.getElementById('showcase-ui').classList.remove('hidden');

  generate(randomPreset());
}

function enterCreatorMode() {
  clearTimeout(showcaseTimer);
  cancelAnimationFrame(regenTimer);
  mode = 'creator';

  document.getElementById('showcase-ui').classList.add('hidden');
  document.getElementById('creator-ui').classList.remove('hidden');

  interactiveSeed = Math.floor(Math.random() * 1000000);
  interactiveNoiseSeed = Math.floor(Math.random() * 1000000);
  generateInstant(getUserParams());
}

// ── Slider handling ──────────────────────────────────────────────
function getUserParams() {
  return {
    density: Number(densitySlider.value),
    intensity: Number(intensitySlider.value),
  };
}

function onDensityChange() {
  // Density change requires full regeneration
  cancelAnimationFrame(regenTimer);
  regenTimer = requestAnimationFrame(function () {
    generateInstant(getUserParams());
  });
}

function onIntensityChange() {
  // Intensity just picks a different pre-computed step — instant, no regeneration
  loop(); // draw one frame
}

// ── Generation ───────────────────────────────────────────────────
function generate(presetKey) {
  activePreset = presetKey;
  planes = [];
  phase = 'warping';

  let p = PRESETS[presetKey];
  currentDuration = p.animDuration;
  currentMaxSteps = p.steps;

  let maxDist = 0;
  let positions = [];

  // First pass: generate positions and find max distance
  for (let i = 0; i < p.numPlanes; i++) {
    let pos = createVector(
      random(-width / 2, width / 2),
      random(-height / 2, height / 2),
      random(-width / 2, width / 2)
    );
    positions.push(pos);
    let dist = pos.mag();
    if (dist > maxDist) maxDist = dist;
  }

  // Second pass: build planes with stagger delays
  let maxDelay = 0.6;
  for (let i = 0; i < p.numPlanes; i++) {
    let pos = positions[i];
    let size = random(p.minSize, p.maxSize);
    let normal = p5.Vector.random3D();
    let dist = pos.mag();
    let delay = 0.4 * (dist / max(maxDist, 1)) * maxDelay + 0.6 * random(0, maxDelay);
    let shardDuration = 0.3;

    let dp = new DeformedPlane(pos, size, normal, p.steps, p);
    dp.delay = delay;
    dp.duration = shardDuration;
    planes.push(dp);
  }

  animStartTime = millis();
  loop();
}

function generateInstant(params) {
  planes = [];
  currentMaxSteps = CREATOR_MAX_STEPS;

  let creatorParams = {
    gridRes: 10,
    steps: CREATOR_MAX_STEPS,
    baseFreq: 0.012,
    freqMult: 0.12,
    ampMult: 1.3,
  };

  randomSeed(interactiveSeed);
  noiseSeed(interactiveNoiseSeed);

  for (let i = 0; i < params.density; i++) {
    let pos = createVector(
      random(-width / 2, width / 2),
      random(-height / 2, height / 2),
      random(-width / 2, width / 2)
    );
    let size = random(80, 220);
    let normal = p5.Vector.random3D();
    let dp = new DeformedPlane(pos, size, normal, CREATOR_MAX_STEPS, creatorParams);
    dp.delay = 0;
    dp.duration = 1;
    planes.push(dp);
  }

  randomSeed(null);
  noiseSeed(null);
  loop();
}

function randomPreset() {
  return PRESET_KEYS[Math.floor(Math.random() * PRESET_KEYS.length)];
}

// ── DeformedPlane class ──────────────────────────────────────────
class DeformedPlane {
  constructor(pos, size, normal, maxSteps, params) {
    this.position = pos.copy();
    this.size = size;
    this.normal = normal.copy().normalize();
    this.maxSteps = maxSteps;
    this.delay = 0;
    this.duration = 1;

    // Pre-compute color once
    this.planeColor = getColorByBands(this.position);

    // Pre-compute vertex positions at every step
    this.stepVertices = [];
    let flatVerts = this.generateVertices(params.gridRes);
    this.stepVertices.push(this.copyGrid(flatVerts));

    let currentVerts = flatVerts;
    for (let s = 0; s < maxSteps; s++) {
      this.deformOneStep(currentVerts, params);
      this.stepVertices.push(this.copyGrid(currentVerts));
    }

    // Smooth each stored step for display
    for (let s = 0; s < this.stepVertices.length; s++) {
      this.smoothGrid(this.stepVertices[s]);
    }
  }

  generateVertices(gridRes) {
    let vertices = [];
    let halfSize = this.size / 2;
    for (let x = -halfSize; x <= halfSize; x += gridRes) {
      let row = [];
      for (let y = -halfSize; y <= halfSize; y += gridRes) {
        row.push(createVector(x, y, 0));
      }
      vertices.push(row);
    }
    return vertices;
  }

  deformOneStep(vertices, params) {
    for (let i = 0; i < vertices.length; i++) {
      for (let j = 0; j < vertices[i].length; j++) {
        let v = vertices[i][j];
        let flow = getCurlNoiseVector(
          v.x + this.position.x,
          v.y + this.position.y,
          this.position.z,
          params
        );
        v.add(flow.mult(0.5));
      }
    }
  }

  copyGrid(vertices) {
    return vertices.map(function (row) {
      return row.map(function (v) { return v.copy(); });
    });
  }

  smoothGrid(vertices) {
    let smoothed = [];
    for (let i = 0; i < vertices.length; i++) {
      let row = [];
      for (let j = 0; j < vertices[i].length; j++) {
        let sum = vertices[i][j].copy();
        let count = 1;
        if (i > 0) { sum.add(vertices[i - 1][j]); count++; }
        if (i < vertices.length - 1) { sum.add(vertices[i + 1][j]); count++; }
        if (j > 0) { sum.add(vertices[i][j - 1]); count++; }
        if (j < vertices[i].length - 1) { sum.add(vertices[i][j + 1]); count++; }
        row.push(sum.div(count));
      }
      smoothed.push(row);
    }
    // Copy back in place
    for (let i = 0; i < vertices.length; i++) {
      for (let j = 0; j < vertices[i].length; j++) {
        vertices[i][j] = smoothed[i][j];
      }
    }
  }

  renderAtStep(step) {
    let s0 = Math.floor(step);
    let s1 = Math.ceil(step);
    s0 = Math.min(s0, this.maxSteps);
    s1 = Math.min(s1, this.maxSteps);
    let frac = step - Math.floor(step);

    let grid0 = this.stepVertices[s0];
    let grid1 = this.stepVertices[s1];

    push();
    translate(this.position.x, this.position.y, this.position.z);

    // Rotate to match normal
    let up = createVector(0, 0, 1);
    let rotationAxis = up.cross(this.normal);
    let angle = acos(constrain(up.dot(this.normal), -1, 1));
    if (rotationAxis.mag() > 0.001) {
      rotate(angle, rotationAxis);
    }

    fill(this.planeColor);
    noStroke();

    for (let i = 0; i < grid0.length - 1; i++) {
      beginShape(QUADS);
      for (let j = 0; j < grid0[i].length - 1; j++) {
        let v1 = this.lerpVert(grid0[i][j], grid1[i][j], frac);
        let v2 = this.lerpVert(grid0[i + 1][j], grid1[i + 1][j], frac);
        let v3 = this.lerpVert(grid0[i + 1][j + 1], grid1[i + 1][j + 1], frac);
        let v4 = this.lerpVert(grid0[i][j + 1], grid1[i][j + 1], frac);

        vertex(v1.x, v1.y, v1.z);
        vertex(v2.x, v2.y, v2.z);
        vertex(v3.x, v3.y, v3.z);
        vertex(v4.x, v4.y, v4.z);
      }
      endShape(CLOSE);
    }
    pop();
  }

  lerpVert(a, b, t) {
    if (t === 0) return a;
    if (t === 1) return b;
    return createVector(
      a.x + (b.x - a.x) * t,
      a.y + (b.y - a.y) * t,
      a.z + (b.z - a.z) * t
    );
  }
}

// ── Curl noise ───────────────────────────────────────────────────
function curlNoise(x, y, z) {
  let eps = 0.01;
  let n1 = noise(x, y + eps, z) - noise(x, y - eps, z);
  let n2 = noise(x, y, z + eps) - noise(x, y, z - eps);
  let n3 = noise(x + eps, y, z) - noise(x - eps, y, z);
  let curlX = (n2 - n3) / (2 * eps);
  let curlY = (n3 - n1) / (2 * eps);
  let curlZ = (n1 - n2) / (2 * eps);
  return createVector(curlX, curlY, curlZ);
}

function getCurlNoiseVector(x, y, z, params) {
  let totalCurl = createVector(0, 0, 0);
  let frequency = params.baseFreq;
  let amplitude = params.ampMult;

  for (let i = 0; i < 3; i++) {
    let curl = curlNoise(x * frequency, y * frequency, z * frequency);
    totalCurl.add(curl.mult(amplitude));
    frequency *= params.freqMult;
    amplitude *= params.ampMult;
  }

  return totalCurl.mult(2);
}

// ── Coloring ─────────────────────────────────────────────────────
function getColorByBands(position) {
  let band = Math.floor(position.z / 50) % 2;
  return band === 0 ? color(10, 80, 80, 100) : color(260, 80, 80, 100);
}

// ── Keyboard controls ────────────────────────────────────────────
function keyPressed() {
  if (key === 's' || key === 'S') {
    let stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    saveCanvas('flow-' + stamp, 'png');
  }
}
