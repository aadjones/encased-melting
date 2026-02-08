// ── Presets ──────────────────────────────────────────────────────
var PRESETS = {
  drift: {
    label: 'Drift',
    numPlanes: 20,
    minW: 200, maxW: 400,
    minH: 120, maxH: 280,
    gridRes: 12,
    steps: 35,
    baseFreq: 0.005,
    freqMult: 0.1,
    ampMult: 1.0,
    animDuration: 12,
  },
  torrent: {
    label: 'Torrent',
    numPlanes: 55,
    minW: 60, maxW: 220,
    minH: 80, maxH: 200,
    gridRes: 12,
    steps: 60,
    baseFreq: 0.015,
    freqMult: 0.15,
    ampMult: 1.4,
    animDuration: 10,
  },
  filaments: {
    label: 'Filaments',
    numPlanes: 75,
    minW: 20, maxW: 60,
    minH: 80, maxH: 200,
    gridRes: 8,
    steps: 80,
    baseFreq: 0.025,
    freqMult: 0.2,
    ampMult: 1.8,
    animDuration: 8,
  },
};

var PRESET_KEYS = Object.keys(PRESETS);
var HOLD_MS = 2500;
var FADE_MS = 600;
var CREATOR_MAX_STEPS = 50;
var CREATOR_NUM_PLANES = 40;

// ── State ────────────────────────────────────────────────────────
let planes = [];
let animStartTime = 0;
let currentDuration = 8;
let currentMaxSteps = 60;
let activePreset = 'drift';

// Mode: 'showcase' or 'creator'
let mode = 'showcase';

// Showcase state machine: 'warping' → 'hold_warped' → 'fading' → (new preset)
let phase = 'warping';
let phaseStartTime = 0;

// Creator state
let interactiveSeed = null;
let interactiveNoiseSeed = null;

// Shuffle animation
let shuffleAnimating = false;
let shuffleStartTime = 0;
let shuffleOldPositions = [];
var SHUFFLE_MS = 800;

// DOM refs
let scaleSlider, intensitySlider;
let fadeOverlay;

// ── Easing ───────────────────────────────────────────────────────
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// ── p5 lifecycle ─────────────────────────────────────────────────
function setup() {
  let canvas = createCanvas(windowWidth, windowHeight, WEBGL);
  canvas.parent('canvas-container');
  colorMode(HSB, 360, 100, 100, 255);
  noStroke();

  scaleSlider = document.getElementById('scale-slider');
  intensitySlider = document.getElementById('intensity-slider');
  fadeOverlay = document.getElementById('fade-overlay');

  document.getElementById('make-own-btn').addEventListener('click', function () {
    switchMode('creator');
  });
  document.getElementById('back-btn').addEventListener('click', function () {
    switchMode('showcase');
  });
  document.getElementById('shuffle-btn').addEventListener('click', function () {
    shuffleOldPositions = planes.map(function (p) {
      return p.position.copy();
    });
    interactiveSeed = Math.floor(Math.random() * 1000000);
    interactiveNoiseSeed = Math.floor(Math.random() * 1000000);
    generateCreator();
    shuffleAnimating = true;
    shuffleStartTime = millis();
    loop();
  });
  scaleSlider.addEventListener('input', onSliderChange);
  intensitySlider.addEventListener('input', onSliderChange);

  enterShowcaseMode();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (mode === 'showcase') {
    generate(activePreset);
  } else {
    generateCreator();
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
    let scale = Number(scaleSlider.value) / 100;
    let step = intensity * currentMaxSteps;

    if (shuffleAnimating) {
      let t = constrain((millis() - shuffleStartTime) / SHUFFLE_MS, 0, 1);
      let easedT = easeOutCubic(t);
      for (let i = 0; i < planes.length; i++) {
        let oldP = i < shuffleOldPositions.length ? shuffleOldPositions[i] : planes[i].position;
        let newP = planes[i].position;
        let lerpPos = createVector(
          lerp(oldP.x, newP.x, easedT),
          lerp(oldP.y, newP.y, easedT),
          lerp(oldP.z, newP.z, easedT)
        );
        planes[i].renderAtStep(step, scale, lerpPos);
      }
      if (t >= 1) {
        shuffleAnimating = false;
        noLoop();
      }
    } else {
      for (let i = 0; i < planes.length; i++) {
        planes[i].renderAtStep(step, scale);
      }
      noLoop();
    }
    return;
  }

  // ── Showcase state machine ──
  let elapsed = (millis() - animStartTime) / 1000;

  if (phase === 'warping') {
    let globalT = constrain(elapsed / currentDuration, 0, 1);
    renderShowcaseFrame(globalT);
    if (globalT >= 1) {
      phase = 'hold_warped';
      phaseStartTime = millis();
    }
  } else if (phase === 'hold_warped') {
    renderShowcaseFrame(1);
    if (millis() - phaseStartTime >= HOLD_MS) {
      // Soft fade — partial overlay, not full blackout
      phase = 'fading';
      fadeOverlay.classList.add('soft');
      phaseStartTime = millis();
    }
  } else if (phase === 'fading') {
    renderShowcaseFrame(1);
    if (millis() - phaseStartTime >= FADE_MS) {
      // Generate new preset behind the soft overlay
      generate(randomPreset());
      setTimeout(function () {
        fadeOverlay.classList.remove('soft');
      }, 100);
    }
  }
}

function renderShowcaseFrame(globalProgress) {
  for (let i = 0; i < planes.length; i++) {
    let pl = planes[i];
    let localT = constrain((globalProgress - pl.delay) / pl.duration, 0, 1);
    let easedT = easeOutCubic(localT);
    let step = easedT * pl.maxSteps;
    pl.renderAtStep(step, 1);
  }
}

// ── Mode switching ───────────────────────────────────────────────
function switchMode(target) {
  fadeOverlay.classList.add('active');

  setTimeout(function () {
    if (target === 'creator') {
      enterCreatorMode();
    } else {
      enterShowcaseMode();
    }
    setTimeout(function () {
      fadeOverlay.classList.remove('active');
    }, 100);
  }, 500);
}

function enterShowcaseMode() {
  mode = 'showcase';

  document.getElementById('creator-ui').classList.add('hidden');
  document.getElementById('showcase-ui').classList.remove('hidden');

  generate(randomPreset());
  // Fade overlay out (covers initial load + mode switch)
  setTimeout(function () {
    fadeOverlay.classList.remove('active');
  }, 200);
}

function enterCreatorMode() {
  mode = 'creator';

  document.getElementById('showcase-ui').classList.add('hidden');
  document.getElementById('creator-ui').classList.remove('hidden');

  interactiveSeed = Math.floor(Math.random() * 1000000);
  interactiveNoiseSeed = Math.floor(Math.random() * 1000000);
  generateCreator();
}

// ── Slider handling ──────────────────────────────────────────────
function onSliderChange() {
  loop(); // draw one frame — both sliders are render-time only
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

  let maxDelay = 0.6;
  for (let i = 0; i < p.numPlanes; i++) {
    let pos = positions[i];
    let w = random(p.minW, p.maxW);
    let h = random(p.minH, p.maxH);
    let normal = p5.Vector.random3D();
    let dist = pos.mag();
    let delay = 0.4 * (dist / max(maxDist, 1)) * maxDelay + 0.6 * random(0, maxDelay);

    let dp = new DeformedPlane(pos, w, h, normal, p.steps, p);
    dp.delay = delay;
    dp.duration = 0.3;
    planes.push(dp);
  }

  animStartTime = millis();
  loop();
}

function generateCreator() {
  planes = [];
  currentMaxSteps = CREATOR_MAX_STEPS;

  let creatorParams = {
    gridRes: 15,
    steps: CREATOR_MAX_STEPS,
    baseFreq: 0.012,
    freqMult: 0.12,
    ampMult: 1.3,
  };

  randomSeed(interactiveSeed);
  noiseSeed(interactiveNoiseSeed);

  for (let i = 0; i < CREATOR_NUM_PLANES; i++) {
    let pos = createVector(
      random(-width / 2, width / 2),
      random(-height / 2, height / 2),
      random(-width / 2, width / 2)
    );
    let w = random(60, 250);
    let h = random(60, 250);
    let normal = p5.Vector.random3D();
    let dp = new DeformedPlane(pos, w, h, normal, CREATOR_MAX_STEPS, creatorParams);
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
  constructor(pos, sizeW, sizeH, normal, maxSteps, params) {
    this.position = pos.copy();
    this.sizeW = sizeW;
    this.sizeH = sizeH;
    this.normal = normal.copy().normalize();
    this.maxSteps = maxSteps;
    this.delay = 0;
    this.duration = 1;

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

    for (let s = 0; s < this.stepVertices.length; s++) {
      this.smoothGrid(this.stepVertices[s]);
    }
  }

  generateVertices(gridRes) {
    let vertices = [];
    let halfW = this.sizeW / 2;
    let halfH = this.sizeH / 2;
    for (let x = -halfW; x <= halfW; x += gridRes) {
      let row = [];
      for (let y = -halfH; y <= halfH; y += gridRes) {
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
    for (let i = 0; i < vertices.length; i++) {
      for (let j = 0; j < vertices[i].length; j++) {
        vertices[i][j] = smoothed[i][j];
      }
    }
  }

  renderAtStep(step, scale, posOverride) {
    let s0 = Math.floor(step);
    let s1 = Math.ceil(step);
    s0 = Math.min(s0, this.maxSteps);
    s1 = Math.min(s1, this.maxSteps);
    let frac = step - Math.floor(step);

    let grid0 = this.stepVertices[s0];
    let grid1 = this.stepVertices[s1];

    push();
    let p = posOverride || this.position;
    translate(p.x, p.y, p.z);

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

        vertex(v1.x * scale, v1.y * scale, v1.z * scale);
        vertex(v2.x * scale, v2.y * scale, v2.z * scale);
        vertex(v3.x * scale, v3.y * scale, v3.z * scale);
        vertex(v4.x * scale, v4.y * scale, v4.z * scale);
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
