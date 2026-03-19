// ── Noise helpers ─────────────────────────────────────────────────────────────
function hash(n) {
  const x = Math.sin(n) * 43758.5453123;
  return x - Math.floor(x);
}
function noise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix     + iy     * 57);
  const b = hash(ix + 1 + iy     * 57);
  const c = hash(ix     + (iy+1) * 57);
  const d = hash(ix + 1 + (iy+1) * 57);
  return a + (b-a)*ux + (c-a)*uy + (d-b-c+a)*ux*uy;
}
function fbm(x, y, oct) {
  let v = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < oct; i++) {
    v += amp * noise2(x * freq, y * freq);
    amp *= 0.5; freq *= 2;
  }
  return v;
}

// ── Single smoke ribbon ───────────────────────────────────────────────────────
class Ribbon {
  constructor(W, H, layer) {
    this.W = W; this.H = H;
    this.layer = layer;
    this.reset(true);
  }

  reset(initial = false) {
    this.x = Math.random() * this.W;
    this.y = initial ? Math.random() * this.H : this.H * (0.65 + Math.random() * 0.38);
    this.points = [{ x: this.x, y: this.y, w: 0 }];

    if (this.layer === 0) {
      // ── TUNE THICKNESS: baseW / maxW ──────────────────────────────
      this.maxPts = 55 + Math.floor(Math.random() * 35);   // shorter = less scattered
      this.speed  = 0.35 + Math.random() * 0.45;
      this.baseW  = 12 + Math.random() * 18;               // ← bg ribbon base width
      this.maxW   = this.baseW * 3.5;                      // ← bg ribbon max width
      this.alpha  = 0.07 + Math.random() * 0.05;
    } else {
      this.maxPts = 40 + Math.floor(Math.random() * 35);   // shorter = tighter
      this.speed  = 0.55 + Math.random() * 0.85;
      this.baseW  = 4 + Math.random() * 8;                 // ← fg ribbon base width
      this.maxW   = this.baseW * 2.8;                      // ← fg ribbon max width
      this.alpha  = 0.22 + Math.random() * 0.16;
    }

    this.maxAge = this.maxPts + 30 + Math.floor(Math.random() * 50);
    this.age    = initial ? Math.floor(Math.random() * this.maxAge * 0.5) : 0;
    this.r = 140 + Math.floor(Math.random() * 80);
    this.g = 175 + Math.floor(Math.random() * 50);
    this.b = 225 + Math.floor(Math.random() * 30);
    this.nox = Math.random() * 150;
    this.noy = Math.random() * 150;
  }

  update(t, mx, my, mActive) {
    this.age++;
    if (this.age > this.maxAge) { this.reset(); return; }

    const head = this.points[this.points.length - 1];

    const scale  = this.layer === 0 ? 2.2 : 3.2;
    const tscale = this.layer === 0 ? 0.04 : 0.07;
    const nx = (head.x / this.W) * scale + this.nox + t * tscale;
    const ny = (head.y / this.H) * scale + this.noy + t * (tscale * 0.55);
    const angle = fbm(nx, ny, 4) * Math.PI * 4;

    let dx = Math.cos(angle) * 0.45;
    let dy = Math.sin(angle) * 0.45 - this.speed;

    // ── TUNE MOUSE PUSH: radius / force ───────────────────────────
    if (mActive) {
      const ddx = head.x - mx, ddy = head.y - my;
      const dist = Math.sqrt(ddx * ddx + ddy * ddy);
      const R = 100;                                       // ← push radius (px)
      if (dist < R && dist > 0.1) {
        const f = (1 - dist / R) * 0.6;                   // ← push strength
        dx += (ddx / dist) * f * 1.2;
        dy += (ddy / dist) * f * 1.2;
      }
    }

    const prog = this.age / this.maxAge;
    const wEnv = prog < 0.25 ? prog / 0.25
               : prog > 0.72 ? 1 - (prog - 0.72) / 0.28
               : 1;
    const w = this.baseW + (this.maxW - this.baseW) * Math.min(prog * 1.6, 1) * 0.5;

    const nx2 = head.x + dx, ny2 = head.y + dy;
    this.points.push({ x: nx2, y: ny2, w: w * wEnv });
    if (this.points.length > this.maxPts) this.points.shift();
    if (ny2 < -80) this.reset();
  }

  draw(ctx) {
    if (this.points.length < 3) return;
    const prog = this.age / this.maxAge;
    let env = prog < 0.08 ? prog / 0.08
            : prog > 0.70 ? 1 - (prog - 0.70) / 0.30
            : 1;
    if (env <= 0) return;

    const pts = this.points;
    const left = [], right = [];
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[Math.max(0, i-1)];
      const next = pts[Math.min(pts.length-1, i+1)];
      const tdx = next.x - prev.x, tdy = next.y - prev.y;
      const len = Math.sqrt(tdx*tdx + tdy*tdy) || 1;
      const nx = -tdy / len, ny = tdx / len;
      const hw = pts[i].w * 0.5;
      left.push({ x: pts[i].x + nx * hw, y: pts[i].y + ny * hw });
      right.push({ x: pts[i].x - nx * hw, y: pts[i].y - ny * hw });
    }

    // Outer glow
    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (let i = 1; i < left.length; i++) {
      const p = left[i-1], q = left[i];
      ctx.quadraticCurveTo(p.x, p.y, (p.x+q.x)/2, (p.y+q.y)/2);
    }
    for (let i = right.length - 1; i >= 0; i--) {
      const p = right[Math.min(i+1, right.length-1)], q = right[i];
      ctx.quadraticCurveTo(p.x, p.y, (p.x+q.x)/2, (p.y+q.y)/2);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(${this.r},${this.g},${this.b},${this.alpha * env * 0.5})`;
    ctx.fill();

    // Bright core
    const cl = left.map((p, i)  => ({ x: (p.x + pts[i].x)*0.5, y: (p.y + pts[i].y)*0.5 }));
    const cr = right.map((p, i) => ({ x: (p.x + pts[i].x)*0.5, y: (p.y + pts[i].y)*0.5 }));
    ctx.beginPath();
    ctx.moveTo(cl[0].x, cl[0].y);
    for (let i = 1; i < cl.length; i++) {
      const p = cl[i-1], q = cl[i];
      ctx.quadraticCurveTo(p.x, p.y, (p.x+q.x)/2, (p.y+q.y)/2);
    }
    for (let i = cr.length - 1; i >= 0; i--) {
      const p = cr[Math.min(i+1, cr.length-1)], q = cr[i];
      ctx.quadraticCurveTo(p.x, p.y, (p.x+q.x)/2, (p.y+q.y)/2);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(215,230,255,${this.alpha * env * 0.75})`;
    ctx.fill();
  }
}

// ── Renderer ──────────────────────────────────────────────────────────────────
class SmokeRenderer {
  constructor() {
    this.bgCanvas = document.createElement("canvas");
    this.bgCanvas.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;z-index:1;";
    document.body.appendChild(this.bgCanvas);
    this.bgCtx = this.bgCanvas.getContext("2d");

    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;z-index:2;pointer-events:none;";
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");

    this.W = 0; this.H = 0;
    this.resize();

    this.mx = -999; this.my = -999;
    this.mActive = false;
    this._mt = null;

    // ── TUNE COUNT: bg / fg ribbon count ──────────────────────────
    const bg = Array.from({ length: 12 }, () => new Ribbon(this.W, this.H, 0));
    const fg = Array.from({ length: 28 }, () => new Ribbon(this.W, this.H, 1));
    this.ribbons = [...bg, ...fg];

    this.t = 0;
    window.addEventListener("resize", () => this.resize());
    window.addEventListener("mousemove", e => this.onMouse(e));
    this.tick();
  }

  resize() {
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.bgCanvas.width = this.canvas.width  = this.W;
    this.bgCanvas.height = this.canvas.height = this.H;
    this.ribbons?.forEach(r => { r.W = this.W; r.H = this.H; });
    this.drawBg();
  }

  drawBg() {
    const ctx = this.bgCtx;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.W, this.H);
    [
      { x: this.W * 0.20, y: this.H * 0.72, r: this.W * 0.40 },
      { x: this.W * 0.80, y: this.H * 0.38, r: this.W * 0.32 },
    ].forEach(({ x, y, r }) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0,   "rgba(25,68,170,0.22)");
      g.addColorStop(0.5, "rgba(10,30, 90,0.09)");
      g.addColorStop(1,   "rgba(0,  0,  0, 0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
    });
  }

  onMouse(e) {
    this.mx = e.clientX; this.my = e.clientY;
    this.mActive = true;
    clearTimeout(this._mt);
    this._mt = setTimeout(() => { this.mActive = false; }, 150);
  }

  tick() {
    this.t += 0.4;
    this.ctx.clearRect(0, 0, this.W, this.H);
    this.ctx.globalCompositeOperation = "lighter";
    for (const r of this.ribbons) {
      r.update(this.t, this.mx, this.my, this.mActive);
      r.draw(this.ctx);
    }
    this.ctx.globalCompositeOperation = "source-over";
    requestAnimationFrame(() => this.tick());
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const cursor = document.getElementById("customCursor");
  document.addEventListener("mousemove", e => {
    cursor.style.left = e.clientX + "px";
    cursor.style.top  = e.clientY + "px";
  });
});

new SmokeRenderer();