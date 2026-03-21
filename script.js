// TouchTexture class

const overlay = document.getElementById('enter-overlay');
overlay.addEventListener('click', () => {
    overlay.style.display = 'none'; // 隱藏進入畫面
    togglePlay(); // 開始播放音樂
});
class TouchTexture {
  constructor() {
    this.size = 64;
    this.width = this.height = this.size;
    this.maxAge = 64;
    this.radius = 0.2 * this.size; // Larger touch radius for visible interaction
    this.speed = 1 / this.maxAge;
    this.trail = [];
    this.last = null;
    this.initTexture();
  }

  initTexture() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext("2d");
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.texture = new THREE.Texture(this.canvas);
  }

  update() {
    this.clear();
    let speed = this.speed;
    // Use reverse iteration to safely remove items
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const point = this.trail[i];
      let f = point.force * speed * (1 - point.age / this.maxAge);
      point.x += point.vx * f;
      point.y += point.vy * f;
      point.age++;
      if (point.age > this.maxAge) {
        this.trail.splice(i, 1);
      } else {
        this.drawPoint(point);
      }
    }
    this.texture.needsUpdate = true;
  }

  clear() {
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  addTouch(point) {
    let force = 0;
    let vx = 0;
    let vy = 0;
    const last = this.last;
    if (last) {
      const dx = point.x - last.x;
      const dy = point.y - last.y;
      if (dx === 0 && dy === 0) return;
      const dd = dx * dx + dy * dy;
      let d = Math.sqrt(dd);
      vx = dx / d;
      vy = dy / d;
      force = Math.min(dd * 20000, 2.0); // Much stronger force for very noticeable effect
    }
    this.last = { x: point.x, y: point.y };
    this.trail.push({ x: point.x, y: point.y, age: 0, force, vx, vy });
  }

  drawPoint(point) {
    const pos = {
      x: point.x * this.width,
      y: (1 - point.y) * this.height
    };

    let intensity = 1;
    if (point.age < this.maxAge * 0.3) {
      intensity = Math.sin((point.age / (this.maxAge * 0.3)) * (Math.PI / 2));
    } else {
      const t = 1 - (point.age - this.maxAge * 0.3) / (this.maxAge * 0.7);
      intensity = -t * (t - 2);
    }
    intensity *= point.force;

    const radius = this.radius;
    let offset = this.size * 10;
    
    // First, draw a main circle to show the interaction position clearly
    this.ctx.shadowOffsetX = offset;
    this.ctx.shadowOffsetY = offset;
    this.ctx.shadowBlur = radius * 2;
    this.ctx.shadowColor = `rgba(146, 173, 203, ${intensity * 0.2})`;
    
    this.ctx.beginPath();
    this.ctx.fillStyle = `rgba(146, 173, 203, ${intensity * 0.3})`;
    this.ctx.arc(pos.x - offset, pos.y - offset, radius, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Then add particles for dust effect
    const particleCount = 25;
    const spreadRadius = radius * 3;
    
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * spreadRadius;
      const px = pos.x - offset + Math.cos(angle) * distance;
      const py = pos.y - offset + Math.sin(angle) * distance;
      
      const particleSize = Math.random() * 2 + 0.5;
      const particleOpacity = (Math.random() * 0.3 + 0.2) * intensity;
      
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 0;
      this.ctx.shadowBlur = particleSize * 4;
      this.ctx.shadowColor = `rgba(146, 173, 203, ${particleOpacity * 0.3})`;
      
      this.ctx.beginPath();
      this.ctx.fillStyle = `rgba(146, 173, 203, ${particleOpacity})`;
      this.ctx.arc(px, py, particleSize, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
}

// GradientBackground class
class GradientBackground {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.mesh = null;
    this.uniforms = {
      uTime: { value: 0 },
      uResolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight)
      },
      uColor1: { value: new THREE.Vector3(0.098, 0.267, 0.667) }, // 92ADCB - Blue
      uColor2: { value: new THREE.Vector3(0.0, 0.0, 0.0) },       // 000000 - Black
      uColor3: { value: new THREE.Vector3(0.098, 0.267, 0.667) }, // 92ADCB - Blue
      uColor4: { value: new THREE.Vector3(0.0, 0.0, 0.0) },       // 000000 - Black
      uColor5: { value: new THREE.Vector3(0.098, 0.267, 0.667) }, // 92ADCB - Blue
      uColor6: { value: new THREE.Vector3(0.0, 0.0, 0.0) },       // 000000 - Black
      uSpeed: { value: 0.3 },
      uIntensity: { value: 0.6 },
      uTouchTexture: { value: null },
      uGrainIntensity: { value: 0.0 },
      uZoom: { value: 1.0 }, // Zoom/scale control - lower = less zoomed (more visible)
      uDarkNavy: { value: new THREE.Vector3(0.0, 0.0, 0.0) }, // #000000 - Black base color
      uGradientSize: { value: 1.0 }, // Control gradient size (smaller = more gradients)
      uGradientCount: { value: 6.0 }, // Number of gradient centers
      uColor1Weight: { value: 1.0 }, // Weight for color1 (orange) - reduce for more navy
      uColor2Weight: { value: 1.0 } // Weight for color2 (navy) - increase for more navy
    };
  }

  init() {
    const viewSize = this.sceneManager.getViewSize();
    const geometry = new THREE.PlaneGeometry(
      viewSize.width,
      viewSize.height,
      1,
      1
    );

    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
            varying vec2 vUv;
            void main() {
              vec3 pos = position.xyz;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.);
              vUv = uv;
            }
          `,
      fragmentShader: `
            uniform float uTime;
            uniform vec2 uResolution;
            uniform vec3 uColor1;
            uniform vec3 uColor2;
            uniform vec3 uColor3;
            uniform vec3 uColor4;
            uniform vec3 uColor5;
            uniform vec3 uColor6;
            uniform float uSpeed;
            uniform float uIntensity;
            uniform sampler2D uTouchTexture;
            uniform float uGrainIntensity;
            uniform float uZoom;
            uniform vec3 uDarkNavy;
            uniform float uGradientSize;
            uniform float uGradientCount;
            uniform float uColor1Weight;
            uniform float uColor2Weight;
            
            varying vec2 vUv;
            
            #define PI 3.14159265359
            
            // Grain function for film grain effect
            float grain(vec2 uv, float time) {
              vec2 grainUv = uv * uResolution * 0.5;
              float grainValue = fract(sin(dot(grainUv + time, vec2(12.9898, 78.233))) * 43758.5453);
              return grainValue * 2.0 - 1.0;
            }
            
            vec3 getGradientColor(vec2 uv, float time) {
              // Dynamic gradient size based on uniform
              float gradientRadius = uGradientSize;
              
              // Multiple animated centers with different speeds and patterns
              // Support up to 12 centers for more gradient action
              vec2 center1 = vec2(
                0.5 + sin(time * uSpeed * 0.4) * 0.4,
                0.5 + cos(time * uSpeed * 0.5) * 0.4
              );
              vec2 center2 = vec2(
                0.5 + cos(time * uSpeed * 0.6) * 0.5,
                0.5 + sin(time * uSpeed * 0.45) * 0.5
              );
              vec2 center3 = vec2(
                0.5 + sin(time * uSpeed * 0.35) * 0.45,
                0.5 + cos(time * uSpeed * 0.55) * 0.45
              );
              vec2 center4 = vec2(
                0.5 + cos(time * uSpeed * 0.5) * 0.4,
                0.5 + sin(time * uSpeed * 0.4) * 0.4
              );
              vec2 center5 = vec2(
                0.5 + sin(time * uSpeed * 0.7) * 0.35,
                0.5 + cos(time * uSpeed * 0.6) * 0.35
              );
              vec2 center6 = vec2(
                0.5 + cos(time * uSpeed * 0.45) * 0.5,
                0.5 + sin(time * uSpeed * 0.65) * 0.5
              );
              
              // Additional centers for more gradient action (7-12)
              vec2 center7 = vec2(
                0.5 + sin(time * uSpeed * 0.55) * 0.38,
                0.5 + cos(time * uSpeed * 0.48) * 0.42
              );
              vec2 center8 = vec2(
                0.5 + cos(time * uSpeed * 0.65) * 0.36,
                0.5 + sin(time * uSpeed * 0.52) * 0.44
              );
              vec2 center9 = vec2(
                0.5 + sin(time * uSpeed * 0.42) * 0.41,
                0.5 + cos(time * uSpeed * 0.58) * 0.39
              );
              vec2 center10 = vec2(
                0.5 + cos(time * uSpeed * 0.48) * 0.37,
                0.5 + sin(time * uSpeed * 0.62) * 0.43
              );
              vec2 center11 = vec2(
                0.5 + sin(time * uSpeed * 0.68) * 0.33,
                0.5 + cos(time * uSpeed * 0.44) * 0.46
              );
              vec2 center12 = vec2(
                0.5 + cos(time * uSpeed * 0.38) * 0.39,
                0.5 + sin(time * uSpeed * 0.56) * 0.41
              );
              
              float dist1 = length(uv - center1);
              float dist2 = length(uv - center2);
              float dist3 = length(uv - center3);
              float dist4 = length(uv - center4);
              float dist5 = length(uv - center5);
              float dist6 = length(uv - center6);
              float dist7 = length(uv - center7);
              float dist8 = length(uv - center8);
              float dist9 = length(uv - center9);
              float dist10 = length(uv - center10);
              float dist11 = length(uv - center11);
              float dist12 = length(uv - center12);
              
              // Smaller, tighter influence areas based on uGradientSize
              float influence1 = 1.0 - smoothstep(0.0, gradientRadius, dist1);
              float influence2 = 1.0 - smoothstep(0.0, gradientRadius, dist2);
              float influence3 = 1.0 - smoothstep(0.0, gradientRadius, dist3);
              float influence4 = 1.0 - smoothstep(0.0, gradientRadius, dist4);
              float influence5 = 1.0 - smoothstep(0.0, gradientRadius, dist5);
              float influence6 = 1.0 - smoothstep(0.0, gradientRadius, dist6);
              float influence7 = 1.0 - smoothstep(0.0, gradientRadius, dist7);
              float influence8 = 1.0 - smoothstep(0.0, gradientRadius, dist8);
              float influence9 = 1.0 - smoothstep(0.0, gradientRadius, dist9);
              float influence10 = 1.0 - smoothstep(0.0, gradientRadius, dist10);
              float influence11 = 1.0 - smoothstep(0.0, gradientRadius, dist11);
              float influence12 = 1.0 - smoothstep(0.0, gradientRadius, dist12);
              
              // Multiple rotation layers for depth
              vec2 rotatedUv1 = uv - 0.5;
              float angle1 = time * uSpeed * 0.15;
              rotatedUv1 = vec2(
                rotatedUv1.x * cos(angle1) - rotatedUv1.y * sin(angle1),
                rotatedUv1.x * sin(angle1) + rotatedUv1.y * cos(angle1)
              );
              rotatedUv1 += 0.5;
              
              vec2 rotatedUv2 = uv - 0.5;
              float angle2 = -time * uSpeed * 0.12;
              rotatedUv2 = vec2(
                rotatedUv2.x * cos(angle2) - rotatedUv2.y * sin(angle2),
                rotatedUv2.x * sin(angle2) + rotatedUv2.y * cos(angle2)
              );
              rotatedUv2 += 0.5;
              
              float radialGradient1 = length(rotatedUv1 - 0.5);
              float radialGradient2 = length(rotatedUv2 - 0.5);
              float radialInfluence1 = 1.0 - smoothstep(0.0, 0.8, radialGradient1);
              float radialInfluence2 = 1.0 - smoothstep(0.0, 0.8, radialGradient2);
              
              // Blend all colors with dynamic intensities - increased for more contrast
              vec3 color = vec3(0.0);
              color += uColor1 * influence1 * (0.55 + 0.45 * sin(time * uSpeed)) * uColor1Weight;
              color += uColor2 * influence2 * (0.55 + 0.45 * cos(time * uSpeed * 1.2)) * uColor2Weight;
              color += uColor3 * influence3 * (0.55 + 0.45 * sin(time * uSpeed * 0.8)) * uColor1Weight;
              color += uColor4 * influence4 * (0.55 + 0.45 * cos(time * uSpeed * 1.3)) * uColor2Weight;
              color += uColor5 * influence5 * (0.55 + 0.45 * sin(time * uSpeed * 1.1)) * uColor1Weight;
              color += uColor6 * influence6 * (0.55 + 0.45 * cos(time * uSpeed * 0.9)) * uColor2Weight;
              
              // Add extra centers if uGradientCount > 6
              if (uGradientCount > 6.0) {
                color += uColor1 * influence7 * (0.55 + 0.45 * sin(time * uSpeed * 1.4)) * uColor1Weight;
                color += uColor2 * influence8 * (0.55 + 0.45 * cos(time * uSpeed * 1.5)) * uColor2Weight;
                color += uColor3 * influence9 * (0.55 + 0.45 * sin(time * uSpeed * 1.6)) * uColor1Weight;
                color += uColor4 * influence10 * (0.55 + 0.45 * cos(time * uSpeed * 1.7)) * uColor2Weight;
              }
              if (uGradientCount > 10.0) {
                color += uColor5 * influence11 * (0.55 + 0.45 * sin(time * uSpeed * 1.8)) * uColor1Weight;
                color += uColor6 * influence12 * (0.55 + 0.45 * cos(time * uSpeed * 1.9)) * uColor2Weight;
              }
              
              // Add radial overlays - increased for more contrast, with color weighting
              color += mix(uColor1, uColor3, radialInfluence1) * 0.45 * uColor1Weight;
              color += mix(uColor2, uColor4, radialInfluence2) * 0.4 * uColor2Weight;
              
              // Clamp and apply intensity
              color = clamp(color, vec3(0.0), vec3(1.0)) * uIntensity;
              
              // Keep original color without oversaturation
              float luminance = dot(color, vec3(0.299, 0.587, 0.114));
              color = mix(vec3(luminance), color, 1.0);
              
              color = pow(color, vec3(1.0)); // No gamma adjustment
              
              // Ensure minimum brightness (navy blue base instead of grey/black)
              // Use higher threshold to ensure navy blue shows through in low-intensity areas
              float brightness1 = length(color);
              float mixFactor1 = max(brightness1 * 1.2, 0.0); // Higher threshold for navy blue base
              color = mix(uDarkNavy, color, mixFactor1);
              
              // Cap maximum brightness - increased for more contrast
              float maxBrightness = 1.0;
              float brightness = length(color);
              if (brightness > maxBrightness) {
                color = color * (maxBrightness / brightness);
              }
              
              return color;
            }
            
            void main() {
              vec2 uv = vUv;
              
              // Apply water distortion from touch texture - very strong
              vec4 touchTex = texture2D(uTouchTexture, uv);
              float vx = -(touchTex.r * 2.0 - 1.0);
              float vy = -(touchTex.g * 2.0 - 1.0);
              float intensity = touchTex.b;
              // Much increased distortion strength for very obvious effect
              uv.x += vx * 0.8 * intensity;
              uv.y += vy * 0.8 * intensity;
              
              // Combined ripple and wave effect for better performance
              vec2 center = vec2(0.5);
              float dist = length(uv - center);
              float ripple = sin(dist * 20.0 - uTime * 3.0) * 0.04 * intensity;
              float wave = sin(dist * 15.0 - uTime * 2.0) * 0.03 * intensity;
              uv += vec2(ripple + wave);
              
              vec3 color = getGradientColor(uv, uTime);
              
              // Minimal grain effect
              float grainValue = grain(uv, uTime);
              color += grainValue * uGrainIntensity * 0.3;
              
              // No color shifting - keep pure blue
              
              // Ensure minimum brightness (navy blue base instead of grey/black)
              // Use higher threshold to ensure navy blue shows through in low-intensity areas
              float brightness2 = length(color);
              float mixFactor2 = max(brightness2 * 1.2, 0.0); // Higher threshold for navy blue base
              color = mix(uDarkNavy, color, mixFactor2);
              
              // Clamp to valid color range
              color = clamp(color, vec3(0.0), vec3(1.0));
              
              // Cap maximum brightness - increased for more contrast
              float maxBrightness = 1.0;
              float brightness = length(color);
              if (brightness > maxBrightness) {
                color = color * (maxBrightness / brightness);
              }
              
              gl_FragColor = vec4(color, 1.0);
            }
          `
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.z = 0;
    this.sceneManager.scene.add(this.mesh);
  }

  update(delta) {
    if (this.uniforms.uTime) {
      this.uniforms.uTime.value += delta;
    }
  }

  onResize(width, height) {
    const viewSize = this.sceneManager.getViewSize();
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.geometry = new THREE.PlaneGeometry(
        viewSize.width,
        viewSize.height,
        1,
        1
      );
    }
    if (this.uniforms.uResolution) {
      this.uniforms.uResolution.value.set(width, height);
    }
  }
}

// App class
class App {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
      stencil: false,
      depth: false
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for performance
    this.renderer.setAnimationLoop(null); // We'll use our own tick loop
    document.body.appendChild(this.renderer.domElement);
    this.renderer.domElement.id = "webGLApp";

    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      10000
    );
    this.camera.position.z = 50;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000); // Black
    this.clock = new THREE.Clock();

    this.touchTexture = new TouchTexture();
    this.gradientBackground = new GradientBackground(this);
    this.gradientBackground.uniforms.uTouchTexture.value = this.touchTexture.texture;

    this.colorSchemes = {
      1: {
        color1: new THREE.Vector3(0.573, 0.678, 0.796), // 92ADCB - Blue
        color2: new THREE.Vector3(0.0, 0.0, 0.0)        // 000000 - Black
      }
    };
    this.currentScheme = 1;

    this.init();
  }

  setColorScheme(scheme) {
    if (!this.colorSchemes[scheme]) return;
    this.currentScheme = scheme;
    const colors = this.colorSchemes[scheme];
    const uniforms = this.gradientBackground.uniforms;

    uniforms.uColor1.value.copy(colors.color1);
    uniforms.uColor2.value.copy(colors.color2);
    uniforms.uColor3.value.copy(colors.color1);
    uniforms.uColor4.value.copy(colors.color2);
    uniforms.uColor5.value.copy(colors.color1);
    uniforms.uColor6.value.copy(colors.color2);

    this.scene.background = new THREE.Color(0x000000);
    uniforms.uDarkNavy.value.set(0.0, 0.0, 0.0);
    uniforms.uGradientSize.value = 0.6;
    uniforms.uGradientCount.value = 6.0;
    uniforms.uSpeed.value = 0.4;
    uniforms.uColor1Weight.value = 0.6;
    uniforms.uColor2Weight.value = 0.8;
  }

  init() {
    this.gradientBackground.init();
    // Apply Scheme 1 settings on startup
    this.setColorScheme(1);

    // Force initial render to wake up the browser
    this.render();

    // Start animation loop
    this.tick();

    window.addEventListener("resize", () => this.onResize());
    window.addEventListener("mousemove", (ev) => this.onMouseMove(ev));
    window.addEventListener("touchmove", (ev) => this.onTouchMove(ev));

    // Handle visibility changes to prevent throttling
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        // Force render when page becomes visible
        this.render();
      }
    });

    // Wake up animation on any user interaction
    const wakeUpAnimation = () => {
      this.render();
      window.removeEventListener("click", wakeUpAnimation);
      window.removeEventListener("touchstart", wakeUpAnimation);
      window.removeEventListener("mousemove", wakeUpAnimation);
    };
    window.addEventListener("click", wakeUpAnimation, { once: true });
    window.addEventListener("touchstart", wakeUpAnimation, { once: true });
    window.addEventListener("mousemove", wakeUpAnimation, { once: true });
  }

  onTouchMove(ev) {
    const touch = ev.touches[0];
    this.onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
  }

  onMouseMove(ev) {
    this.mouse = {
      x: ev.clientX / window.innerWidth,
      y: 1 - ev.clientY / window.innerHeight
    };
    this.touchTexture.addTouch(this.mouse);
  }

  getViewSize() {
    const fovInRadians = (this.camera.fov * Math.PI) / 180;
    const height = Math.abs(
      this.camera.position.z * Math.tan(fovInRadians / 2) * 2
    );
    return { width: height * this.camera.aspect, height };
  }

  update(delta) {
    this.touchTexture.update();
    this.gradientBackground.update(delta);
  }

  render() {
    const delta = this.clock.getDelta();
    // Only update if delta is reasonable (prevents large jumps)
    const clampedDelta = Math.min(delta, 0.1);
    this.renderer.render(this.scene, this.camera);
    this.update(clampedDelta);
  }

  tick() {
    this.render();
    // Use arrow function to maintain context and ensure continuous rendering
    requestAnimationFrame(() => this.tick());
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.gradientBackground.onResize(window.innerWidth, window.innerHeight);
  }
}

// Start the app
const app = new App();

// Force animation to start immediately by triggering a render
// This helps prevent browser throttling of requestAnimationFrame
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    app.render();
  });
} else {
  // DOM already loaded, force immediate render
  setTimeout(() => app.render(), 0);
}

// Custom cursor
const cursor = document.getElementById('customCursor');

if (cursor) {
  let mouseX = 0, mouseY = 0;
  let cursorX = 0, cursorY = 0;
  let isAnimating = false;

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (!isAnimating) {
      isAnimating = true;
      animate();
    }
  });

  window.addEventListener('mousedown', () => {
    cursor.style.transform = 'translate(-50%, -50%) scale(0.8)';
  });

  window.addEventListener('mouseup', () => {
    cursor.style.transform = 'translate(-50%, -50%) scale(1)';
  });

  function animate() {
    cursor.style.left = mouseX + 'px';
    cursor.style.top = mouseY + 'px';
    requestAnimationFrame(animate);
  }

  document.addEventListener('mouseover', (e) => {
    if (e.target.closest('a, button, .color-btn, .export-btn, .copy-btn, .toggle-adjuster-btn, .player-ctrl, .logo, .nav ul li')) {
      cursor.style.width = "30px";
      cursor.style.height = "30px";
    }
  });

  document.addEventListener('mouseout', (e) => {
    if (e.target.closest('a, button, .color-btn, .export-btn, .copy-btn, .toggle-adjuster-btn, .player-ctrl, .logo, .nav ul li')) {
      cursor.style.width = "20px";
      cursor.style.height = "20px";
    }
  });
}

// 音樂播放器邏輯
const music = document.getElementById('bgMusic');
const playBtn = document.getElementById('playBtn');
const playIcon = document.getElementById('playIcon');
const currentTimeDisplay = document.getElementById('currentTime');
const progressBar = document.getElementById('progressBar');

let isPlaying = false;

// 自動播放音樂
function autoPlayMusic() {
    // 嘗試播放
    music.play().then(() => {
        console.log("自動播放成功");
        if (playIcon) playIcon.src = 'assets/stop.svg';
        isPlaying = true;
        // 成功播放後，移除監聽器，避免每次點擊都觸發播放邏輯
        window.removeEventListener('click', autoPlayMusic);
    }).catch(error => {
        // 如果失敗（通常是瀏覽器擋掉），就靜靜等待下一次點擊
        console.log("等待使用者互動以播放音樂...");
    });
}

// 監聽全域點擊事件
window.addEventListener('click', autoPlayMusic);

// 針對手機端增加觸摸監聽
window.addEventListener('touchstart', autoPlayMusic);

// 切換播放/停止
function togglePlay() {
  console.log("按鈕被點擊了！目前播放狀態:", isPlaying); // Debug 用
  
  if (isPlaying) {
    music.pause();
    playIcon.src = 'assets/play.svg';
  } else {
    // 瀏覽器通常要求先有使用者互動才能播放
    music.play().then(() => {
        console.log("音樂開始播放");
        playIcon.src = 'assets/stop.svg';
    }).catch(error => {
        console.error("播放失敗:", error);
    });
  }
  isPlaying = !isPlaying;
}

if (playBtn) {
    playBtn.addEventListener('click', togglePlay);
}

const progressContainer = document.querySelector('.progress-container');
if (progressContainer) {
  progressContainer.addEventListener('click', (e) => {
    const width = progressContainer.clientWidth;
    const clickX = e.offsetX;
    const duration = music.duration;
    music.currentTime = (clickX / width) * duration;
  });
}

// 格式化時間 (00:00)
function formatTime(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

// 更新進度與時間顯示
music.addEventListener('timeupdate', () => {
  const { currentTime, duration } = music;
  
  if (duration) {
    // 1. 更新時間文字：顯示為 "00:00 / 03:45"
    currentTimeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
    
    // 2. 更新進度條長度 (這會帶動 CSS 中的圓點)
    const progressPercent = (currentTime / duration) * 100;
    progressBar.style.width = `${progressPercent}%`;
  }
});

// 當音樂加載完成時，先顯示總時長 (避免顯示 00:00 / 00:00)
music.addEventListener('loadedmetadata', () => {
  currentTimeDisplay.textContent = `00:00 / ${formatTime(music.duration)}`;
});



