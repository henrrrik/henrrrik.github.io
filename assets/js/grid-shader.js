(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;

  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
  if (!gl) return;

  const SPACING = 8;
  const MIN_SIZE = 1;
  const MAX_SIZE = 8;
  const PROXIMITY = 180;
  const EASE_IN = 0.2;
  const EASE_OUT = 0.5;

  const colorFor = () => window.matchMedia('(prefers-color-scheme: dark)').matches
    ? { rgb: [0.78, 0.31, 0.94], opacity: 0.60 }
    : { rgb: [0.59, 0.16, 0.71], opacity: 0.60 };

  let color = colorFor();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { color = colorFor(); });

  const vertexSource = `attribute vec2 position;
attribute vec2 squarePosition;
attribute float currentSize;
uniform mat4 projectionMatrix;
varying vec2 vUv;
void main() {
  vUv = position;
  vec2 pixelPos = position * currentSize;
  vec2 finalPos = squarePosition + pixelPos - vec2(currentSize / 4.0);
  gl_Position = projectionMatrix * vec4(finalPos, 0.0, 1.0);
}`;

  const fragmentSource = `precision mediump float;
varying vec2 vUv;
uniform vec3 frontColor;
uniform float opacity;
void main() {
  vec2 c = vUv - vec2(0.5);
  float dist = max(abs(c.x), abs(c.y));
  float alpha = (1.0 - step(0.5, dist)) * opacity;
  gl_FragColor = vec4(frontColor, alpha);
}`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('grid-shader compile:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  const vs = compile(gl.VERTEX_SHADER, vertexSource);
  const fs = compile(gl.FRAGMENT_SHADER, fragmentSource);
  if (!vs || !fs) return;

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('grid-shader link:', gl.getProgramInfoLog(program));
    return;
  }
  gl.useProgram(program);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const positionLoc = gl.getAttribLocation(program, 'position');
  const squarePositionLoc = gl.getAttribLocation(program, 'squarePosition');
  const currentSizeLoc = gl.getAttribLocation(program, 'currentSize');
  const projectionLoc = gl.getUniformLocation(program, 'projectionMatrix');
  const frontColorLoc = gl.getUniformLocation(program, 'frontColor');
  const opacityLoc = gl.getUniformLocation(program, 'opacity');

  const squareVertices = new Float32Array([
    -0.5, -0.5,
     0.5, -0.5,
     0.5,  0.5,
    -0.5,  0.5,
  ]);
  const squareBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, squareBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, squareVertices, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(positionLoc);
  gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

  let squares = [];
  const projectionMatrix = new Float32Array(16);

  function setOrtho(width, height) {
    projectionMatrix.fill(0);
    projectionMatrix[0] = 2 / width;
    projectionMatrix[5] = -2 / height;
    projectionMatrix[10] = -1;
    projectionMatrix[12] = -1;
    projectionMatrix[13] = 1;
    projectionMatrix[15] = 1;
  }

  function buildGrid(w, h) {
    const cols = Math.ceil(w / SPACING) + 1;
    const rows = Math.ceil(h / SPACING) + 1;
    squares = new Array(cols * rows);
    let i = 0;
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        squares[i++] = {
          x: x * SPACING,
          y: y * SPACING,
          currentSize: MAX_SIZE,
          targetSize: MAX_SIZE,
          lastUpdateTime: 0,
        };
      }
    }
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    setOrtho(w, h);
    buildGrid(w, h);
  }

  let mouseX = -1e6;
  let mouseY = -1e6;
  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
  document.addEventListener('mouseleave', () => {
    mouseX = -1e6;
    mouseY = -1e6;
  });

  window.addEventListener('resize', resize);
  resize();

  function render(ts) {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniformMatrix4fv(projectionLoc, false, projectionMatrix);
    gl.uniform3f(frontColorLoc, color.rgb[0], color.rgb[1], color.rgb[2]);
    gl.uniform1f(opacityLoc, color.opacity);

    const proxSq = PROXIMITY * PROXIMITY;
    const len = squares.length;
    for (let i = 0; i < len; i++) {
      const s = squares[i];
      const dx = s.x - mouseX;
      const dy = s.y - mouseY;
      const distScale = Math.min((dx * dx + dy * dy) / proxSq, 1);
      s.targetSize = MIN_SIZE + (MAX_SIZE - MIN_SIZE) * Math.sqrt(distScale);

      const dt = (ts - s.lastUpdateTime) / 1000;
      const ease = s.currentSize > s.targetSize ? EASE_IN : EASE_OUT;
      const t = Math.min(dt / ease, 1);
      s.currentSize += (s.targetSize - s.currentSize) * t;
      s.lastUpdateTime = ts;

      gl.vertexAttrib2f(squarePositionLoc, s.x, s.y);
      gl.vertexAttrib1f(currentSizeLoc, s.currentSize);
      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    }

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
