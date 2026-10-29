'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Shooting Star (Estrella Fugaz) ────────────────────────────────────────────
const STAR_SPEEDS = [0, 280, 240, 200]; // velocidad base por tamaño
const STAR_POINTS_MULT = 2;             // multiplicador de puntos

class ShootingStar {
  constructor(x, y, size = 3) {
    this.x     = x;
    this.y     = y;
    this.size  = size;
    this.radius = RADII[size];
    this.dead   = false;

    const angle = rand(0, Math.PI * 2);
    const speed = STAR_SPEEDS[size] + rand(-40, 40);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-2.5, 2.5);
    this.rot = rand(0, Math.PI * 2);

    this.life   = 4;  // vida total en segundos
    this.ttl    = this.life;
    this.dead   = false;

    // Polígono irregular (más definido que el asteroide)
    const n = randInt(6, 10);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.75, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }

    // Estela: almacena posiciones anteriores para dibujar el trail
    this.trail = [];
    this.trailMax = 12;
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) { this.dead = true; return; }

    // Guardar posición para la estela
    this.trail.unshift({ x: this.x, y: this.y });
    if (this.trail.length > this.trailMax) this.trail.pop();
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    const fade = Math.min(1, this.ttl / 1.5); // se desvanece en los últimos 1.5s
    const alpha = fade.toFixed(2);

    // Dibujar estela (trail)
    for (let i = 1; i < this.trail.length; i++) {
      const t = this.trail[i];
      const trailAlpha = ((1 - i / this.trail.length) * 0.5 * fade).toFixed(2);
      ctx.strokeStyle = `rgba(255, 215, 0, ${trailAlpha})`;
      ctx.lineWidth   = (1 - i / this.trail.length) * 3;
      ctx.beginPath();
      ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
    }

    // Dibujar estrella fugaz
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);

    // Resplandor exterior pulsante
    const glowAlpha = (0.3 + 0.15 * Math.sin(Date.now() / 200)).toFixed(2);
    ctx.strokeStyle = `rgba(255, 215, 0, ${glowAlpha})`;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 6, 0, Math.PI * 2);
    ctx.stroke();

    // Polígono principal dorado
    ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`;
    ctx.lineWidth   = 2;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();

    // Núcleo brillante interior
    ctx.fillStyle = `rgba(255, 255, 200, ${(fade * 0.3).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// ── Skins de la nave ──────────────────────────────────────────────────────────
const SKINS = [
  // 0 — Clásico: triángulo con muesca trasera (el original)
  {
    name: 'Clásico',
    primary: '#ffffff', secondary: '#ffffff', glow: null,
    draw(ctx, x, y, angle, radius, thrusting, speedBoost, invincible, redShipMode) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      // Parpadeo durante invencibilidad
      if (invincible > 0 && Math.floor(invincible * 8) % 2 === 0) {
        ctx.restore();
        return;
      }

      // Modo nave roja (doble puntos, tamaño 2x)
      if (redShipMode) {
        ctx.scale(2, 2);
        ctx.strokeStyle = '#ff2200';
        ctx.lineWidth   = 1.5;
        ctx.lineJoin    = 'round';
        ctx.beginPath();
        ctx.moveTo( 20,  0);
        ctx.lineTo(-12, -9);
        ctx.lineTo( -7,  0);
        ctx.lineTo(-12,  9);
        ctx.closePath();
        ctx.stroke();

        if (thrusting && Math.random() > 0.35) {
          const len = rand(6, 14);
          ctx.beginPath();
          ctx.moveTo(-8, -4);
          ctx.lineTo(-8 - len, 0);
          ctx.lineTo(-8,  4);
          ctx.strokeStyle = 'rgba(255, 100, 0, 0.9)';
          ctx.lineWidth   = 1.5;
          ctx.stroke();
        }

        ctx.restore();
        return;
      }

      // Anillo de velocidad
      if (speedBoost > 0) {
        const pulse = 1 + 0.1 * Math.sin(Date.now() / 120);
        ctx.strokeStyle = `rgba(0, 200, 255, ${0.5 + 0.3 * Math.sin(Date.now() / 150)})`;
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.6 * pulse, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Silueta clásica
      ctx.strokeStyle = '#fff';
      ctx.lineWidth   = 1.5;
      ctx.lineJoin    = 'round';
      ctx.beginPath();
      ctx.moveTo( 20,  0);
      ctx.lineTo(-12, -9);
      ctx.lineTo( -7,  0);
      ctx.lineTo(-12,  9);
      ctx.closePath();
      ctx.stroke();

      // Propulsor
      if (thrusting && Math.random() > 0.35) {
        const boost = speedBoost > 0;
        const len   = boost ? rand(12, 24) : rand(6, 14);
        const color = boost ? 'rgba(0, 180, 255, 0.95)' : 'rgba(255, 130, 0, 0.85)';
        ctx.beginPath();
        ctx.moveTo(-8, -4);
        ctx.lineTo(-8 - len, 0);
        ctx.lineTo(-8,  4);
        ctx.strokeStyle = color;
        ctx.lineWidth   = boost ? 2.5 : 1.5;
        ctx.stroke();
      }

      ctx.restore();
    },
  },

  // 1 — Delta: alas anchas y punta afilada
  {
    name: 'Delta',
    primary: '#00d4ff', secondary: '#0088aa', glow: '#00d4ff',
    draw(ctx, x, y, angle, radius, thrusting, speedBoost, invincible, redShipMode) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      if (invincible > 0 && Math.floor(invincible * 8) % 2 === 0) {
        ctx.restore();
        return;
      }

      // Modo nave roja
      if (redShipMode) {
        ctx.scale(2, 2);
        ctx.strokeStyle = '#ff2200';
        ctx.lineWidth   = 1.5;
        ctx.lineJoin    = 'round';
        ctx.beginPath();
        ctx.moveTo( 20,  0);
        ctx.lineTo(-12, -9);
        ctx.lineTo( -7,  0);
        ctx.lineTo(-12,  9);
        ctx.closePath();
        ctx.stroke();

        if (thrusting && Math.random() > 0.35) {
          const len = rand(6, 14);
          ctx.beginPath();
          ctx.moveTo(-8, -4);
          ctx.lineTo(-8 - len, 0);
          ctx.lineTo(-8,  4);
          ctx.strokeStyle = 'rgba(255, 100, 0, 0.9)';
          ctx.lineWidth   = 1.5;
          ctx.stroke();
        }

        ctx.restore();
        return;
      }

      // Resplandor
      ctx.shadowColor = '#00d4ff';
      ctx.shadowBlur  = 10;

      // Anillo de velocidad
      if (speedBoost > 0) {
        const pulse = 1 + 0.1 * Math.sin(Date.now() / 120);
        ctx.strokeStyle = `rgba(0, 212, 255, ${0.5 + 0.3 * Math.sin(Date.now() / 150)})`;
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.6 * pulse, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Forma Delta: punta + alas anchas + motor compacto
      ctx.strokeStyle = '#00d4ff';
      ctx.fillStyle   = 'rgba(0, 212, 255, 0.08)';
      ctx.lineWidth   = 1.5;
      ctx.lineJoin    = 'round';
      ctx.beginPath();
      ctx.moveTo( 22,  0);
      ctx.lineTo(-10, -14);
      ctx.lineTo(-14, -6);
      ctx.lineTo(-16,  0);
      ctx.lineTo(-14,  6);
      ctx.lineTo(-10, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Línea central decorativa
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.4)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-12, 0);
      ctx.stroke();

      // Propulsor Delta (doble llama)
      if (thrusting && Math.random() > 0.35) {
        const boost = speedBoost > 0;
        const len   = boost ? rand(14, 26) : rand(8, 16);
        const color = boost ? 'rgba(0, 200, 255, 0.95)' : 'rgba(255, 130, 0, 0.85)';
        ctx.shadowBlur = 0;
        for (const dy of [-3, 3]) {
          ctx.beginPath();
          ctx.moveTo(-15, dy);
          ctx.lineTo(-15 - len * 0.7, dy * 0.5);
          ctx.lineTo(-15, dy + 2);
          ctx.strokeStyle = color;
          ctx.lineWidth   = boost ? 2 : 1.5;
          ctx.stroke();
        }
      }

      ctx.restore();
    },
  },

  // 2 — Ace: diseño angular agresivo con doble aleta
  {
    name: 'Ace',
    primary: '#ff4422', secondary: '#ff8800', glow: '#ff4422',
    draw(ctx, x, y, angle, radius, thrusting, speedBoost, invincible, redShipMode) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      if (invincible > 0 && Math.floor(invincible * 8) % 2 === 0) {
        ctx.restore();
        return;
      }

      // Modo nave roja
      if (redShipMode) {
        ctx.scale(2, 2);
        ctx.strokeStyle = '#ff2200';
        ctx.lineWidth   = 1.5;
        ctx.lineJoin    = 'round';
        ctx.beginPath();
        ctx.moveTo( 20,  0);
        ctx.lineTo(-12, -9);
        ctx.lineTo( -7,  0);
        ctx.lineTo(-12,  9);
        ctx.closePath();
        ctx.stroke();

        if (thrusting && Math.random() > 0.35) {
          const len = rand(6, 14);
          ctx.beginPath();
          ctx.moveTo(-8, -4);
          ctx.lineTo(-8 - len, 0);
          ctx.lineTo(-8,  4);
          ctx.strokeStyle = 'rgba(255, 100, 0, 0.9)';
          ctx.lineWidth   = 1.5;
          ctx.stroke();
        }

        ctx.restore();
        return;
      }

      ctx.shadowColor = '#ff4422';
      ctx.shadowBlur  = 12;

      if (speedBoost > 0) {
        const pulse = 1 + 0.1 * Math.sin(Date.now() / 120);
        ctx.strokeStyle = `rgba(0, 200, 255, ${0.5 + 0.3 * Math.sin(Date.now() / 150)})`;
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.6 * pulse, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Ace: nariz afilada + aletas traseras en V invertida
      ctx.strokeStyle = '#ff4422';
      ctx.fillStyle   = 'rgba(255, 68, 34, 0.1)';
      ctx.lineWidth   = 1.5;
      ctx.lineJoin    = 'round';
      ctx.beginPath();
      ctx.moveTo( 24,  0);     // nariz
      ctx.lineTo(  6, -7);
      ctx.lineTo(-10, -8);
      ctx.lineTo(-18, -16);    // aleta izq punta
      ctx.lineTo(-14, -5);
      ctx.lineTo(-12,  0);     // motor centro
      ctx.lineTo(-14,  5);
      ctx.lineTo(-18, 16);     // aleta der punta
      ctx.lineTo(-10,  8);
      ctx.lineTo(  6,  7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Detalles internos
      ctx.strokeStyle = 'rgba(255, 136, 0, 0.5)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(-8, -5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(-8, 5);
      ctx.stroke();

      // Propulsor Ace (llama ancha)
      if (thrusting && Math.random() > 0.35) {
        const boost = speedBoost > 0;
        const len   = boost ? rand(14, 28) : rand(8, 16);
        const color = boost ? 'rgba(0, 180, 255, 0.95)' : 'rgba(255, 100, 0, 0.9)';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(-13, -6);
        ctx.lineTo(-13 - len, 0);
        ctx.lineTo(-13,  6);
        ctx.strokeStyle = color;
        ctx.lineWidth   = boost ? 3 : 2;
        ctx.stroke();
      }

      ctx.restore();
    },
  },

  // 3 — Fénix: flecha estilizada con líneas internas doradas
  {
    name: 'Fénix',
    primary: '#ffcc00', secondary: '#aa8800', glow: '#ffcc00',
    draw(ctx, x, y, angle, radius, thrusting, speedBoost, invincible, redShipMode) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      if (invincible > 0 && Math.floor(invincible * 8) % 2 === 0) {
        ctx.restore();
        return;
      }

      // Modo nave roja
      if (redShipMode) {
        ctx.scale(2, 2);
        ctx.strokeStyle = '#ff2200';
        ctx.lineWidth   = 1.5;
        ctx.lineJoin    = 'round';
        ctx.beginPath();
        ctx.moveTo( 20,  0);
        ctx.lineTo(-12, -9);
        ctx.lineTo( -7,  0);
        ctx.lineTo(-12,  9);
        ctx.closePath();
        ctx.stroke();

        if (thrusting && Math.random() > 0.35) {
          const len = rand(6, 14);
          ctx.beginPath();
          ctx.moveTo(-8, -4);
          ctx.lineTo(-8 - len, 0);
          ctx.lineTo(-8,  4);
          ctx.strokeStyle = 'rgba(255, 100, 0, 0.9)';
          ctx.lineWidth   = 1.5;
          ctx.stroke();
        }

        ctx.restore();
        return;
      }

      ctx.shadowColor = '#ffcc00';
      ctx.shadowBlur  = 14;

      if (speedBoost > 0) {
        const pulse = 1 + 0.1 * Math.sin(Date.now() / 120);
        ctx.strokeStyle = `rgba(0, 200, 255, ${0.5 + 0.3 * Math.sin(Date.now() / 150)})`;
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.6 * pulse, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Fénix: forma de flecha elegante
      ctx.strokeStyle = '#ffcc00';
      ctx.fillStyle   = 'rgba(255, 204, 0, 0.06)';
      ctx.lineWidth   = 1.5;
      ctx.lineJoin    = 'round';
      ctx.beginPath();
      ctx.moveTo( 23,  0);     // punta
      ctx.lineTo(  8, -5);
      ctx.lineTo(-14, -12);    // ala superior
      ctx.lineTo(-16, -3);
      ctx.lineTo(-10,  0);     // motor
      ctx.lineTo(-16,  3);
      ctx.lineTo(-14, 12);     // ala inferior
      ctx.lineTo(  8,  5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Líneas internas en forma de V
      ctx.strokeStyle = 'rgba(255, 204, 0, 0.4)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(16, -3);
      ctx.lineTo(-8, -7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(16, 3);
      ctx.lineTo(-8, 7);
      ctx.stroke();

      // Propulsor Fénix (llama dorada)
      if (thrusting && Math.random() > 0.35) {
        const boost = speedBoost > 0;
        const len   = boost ? rand(12, 24) : rand(8, 16);
        const color = boost ? 'rgba(0, 180, 255, 0.95)' : 'rgba(255, 200, 50, 0.9)';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(-11, -4);
        ctx.lineTo(-11 - len, 0);
        ctx.lineTo(-11,  4);
        ctx.strokeStyle = color;
        ctx.lineWidth   = boost ? 2.5 : 1.5;
        ctx.stroke();
      }

      ctx.restore();
    },
  },

  // 4 — Fantasma: forma etérea con efecto de transparencia
  {
    name: 'Fantasma',
    primary: '#00ff88', secondary: '#00aa55', glow: '#00ff88',
    draw(ctx, x, y, angle, radius, thrusting, speedBoost, invincible, redShipMode) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      if (invincible > 0 && Math.floor(invincible * 8) % 2 === 0) {
        ctx.restore();
        return;
      }

      // Modo nave roja
      if (redShipMode) {
        ctx.scale(2, 2);
        ctx.strokeStyle = '#ff2200';
        ctx.lineWidth   = 1.5;
        ctx.lineJoin    = 'round';
        ctx.beginPath();
        ctx.moveTo( 20,  0);
        ctx.lineTo(-12, -9);
        ctx.lineTo( -7,  0);
        ctx.lineTo(-12,  9);
        ctx.closePath();
        ctx.stroke();

        if (thrusting && Math.random() > 0.35) {
          const len = rand(6, 14);
          ctx.beginPath();
          ctx.moveTo(-8, -4);
          ctx.lineTo(-8 - len, 0);
          ctx.lineTo(-8,  4);
          ctx.strokeStyle = 'rgba(255, 100, 0, 0.9)';
          ctx.lineWidth   = 1.5;
          ctx.stroke();
        }

        ctx.restore();
        return;
      }

      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur  = 16;

      if (speedBoost > 0) {
        const pulse = 1 + 0.1 * Math.sin(Date.now() / 120);
        ctx.strokeStyle = `rgba(0, 200, 255, ${0.5 + 0.3 * Math.sin(Date.now() / 150)})`;
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.6 * pulse, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Fantasma: triángulo con efecto fantasmal (múltiples capas)
      const ghostAlpha = 0.3 + 0.15 * Math.sin(Date.now() / 200);

      // Capa exterior difusa
      ctx.strokeStyle = `rgba(0, 255, 136, ${ghostAlpha})`;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo( 21,  0);
      ctx.lineTo(-10, -11);
      ctx.lineTo( -5,  0);
      ctx.lineTo(-10, 11);
      ctx.closePath();
      ctx.stroke();

      // Capa principal semi-transparente
      ctx.strokeStyle = `rgba(0, 255, 136, ${0.7 + ghostAlpha * 0.3})`;
      ctx.fillStyle   = `rgba(0, 255, 136, 0.05)`;
      ctx.lineWidth   = 1.5;
      ctx.lineJoin    = 'round';
      ctx.beginPath();
      ctx.moveTo( 20,  0);
      ctx.lineTo(-12, -9);
      ctx.lineTo( -7,  0);
      ctx.lineTo(-12,  9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Ojos del fantasma (puntos brillantes)
      ctx.shadowBlur = 8;
      ctx.fillStyle = `rgba(0, 255, 136, ${ghostAlpha + 0.2})`;
      ctx.beginPath();
      ctx.arc(4, -4, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(4, 4, 2, 0, Math.PI * 2);
      ctx.fill();

      // Propulsor Fantasma (llama verde espectral)
      if (thrusting && Math.random() > 0.35) {
        const boost = speedBoost > 0;
        const len   = boost ? rand(14, 26) : rand(8, 16);
        const color = boost ? 'rgba(0, 180, 255, 0.95)' : `rgba(0, 255, 136, ${ghostAlpha + 0.4})`;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(-8, -4);
        ctx.lineTo(-8 - len, 0);
        ctx.lineTo(-8,  4);
        ctx.strokeStyle = color;
        ctx.lineWidth   = boost ? 2.5 : 1.5;
        ctx.stroke();
      }

      ctx.restore();
    },
  },
];

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() {
    this.skinIndex = parseInt(localStorage.getItem('asteroids_skin')) || 0;
    if (this.skinIndex >= SKINS.length) this.skinIndex = 0;
    this.reset();
  }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.dead          = false;
    this.speedBoost    = 0;   // segundos restantes de boost
    this.shieldActive  = 0;   // segundos restantes de escudo
    this.tripleShot    = 0;   // segundos restantes de triple disparo
    this.redShipMode   = false;  // modo nave roja (doble puntos, tamaño 2x)
  }

  get skin() { return SKINS[this.skinIndex]; }
  cycleSkin(dir) {
    this.skinIndex = (this.skinIndex + dir + SKINS.length) % SKINS.length;
    localStorage.setItem('asteroids_skin', this.skinIndex);
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.speedBoost    > 0) this.speedBoost    -= dt;
    if (this.shieldActive  > 0) this.shieldActive  -= dt;
    if (this.tripleShot    > 0) this.tripleShot    -= dt;

    const ROT   = 3.5;   // rad/s
    const THRUST_BASE = 260;  // px/s²
    const DRAG   = 0.987;
    const thrustMult = this.speedBoost > 0 ? 2 : 1;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST_BASE * thrustMult * dt;
      this.vy += Math.sin(this.angle) * THRUST_BASE * thrustMult * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (this.tripleShot > 0) {
      return [
        new Bullet(ox, oy, this.angle - 0.15),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + 0.15),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw() {
    if (this.dead) return;
    this.skin.draw(ctx, this.x, this.y, this.angle, this.radius,
                   this.thrusting, this.speedBoost, this.invincible,
                   this.redShipMode);

    // Escudo protector
    if (this.shieldActive > 0) {
      const shieldPulse = 1 + 0.08 * Math.sin(Date.now() / 100);
      const r = this.radius * 1.8 * shieldPulse;
      // Resplandor interior del escudo
      ctx.strokeStyle = `rgba(0, 170, 255, ${0.15 + 0.08 * Math.sin(Date.now() / 150)})`;
      ctx.lineWidth   = 4;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
      ctx.stroke();
      // Borde brillante del escudo
      ctx.strokeStyle = `rgba(0, 200, 255, ${0.6 + 0.3 * Math.sin(Date.now() / 120)})`;
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
    this.color = null;   // null = blanco por defecto
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    let stroke;
    if (this.color) {
      stroke = this.color;
    } else {
      stroke = `rgba(255,255,255,${alpha.toFixed(2)})`;
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Power-Up ──────────────────────────────────────────────────────────────────
class PowerUp {
  constructor(x, y, type = 'speed') {
    this.x      = x;
    this.y      = y;
    this.radius = 10;
    this.type   = type;          // 'speed' | 'triple' | 'shield'
    this.ttl    = 15;            // desaparece a los 15s si nadie lo recoge
    this.rot    = rand(0, Math.PI * 2);
    this.rotSpeed = rand(-2, 2);
    const angle = rand(0, Math.PI * 2);
    const speed = rand(20, 40);
    this.vx     = Math.cos(angle) * speed;
    this.vy     = Math.sin(angle) * speed;
    this.dead   = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const pulse = 1 + 0.15 * Math.sin(Date.now() / 150);
    const r = this.radius * pulse;

    let color, glowColor;
    if (this.type === 'shield') {
      color   = '#0af';
      glowColor = 'rgba(0, 170, 255, ';
    } else if (this.type === 'triple') {
      color   = '#f44';
      glowColor = 'rgba(255, 68, 68, ';
    } else {
      color   = '#ffe600';
      glowColor = 'rgba(255, 230, 0, ';
    }

    // Resplandor exterior
    ctx.strokeStyle = `${glowColor}${0.4 + 0.2 * Math.sin(Date.now() / 200)})`;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r + 5, 0, Math.PI * 2);
    ctx.stroke();

    // Círculo principal
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    // Letra indicadora
    const letter = this.type === 'shield' ? 'E' : (this.type === 'triple' ? 'T' : 'S');
    ctx.fillStyle = color;
    ctx.font      = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, 0, 0);
    ctx.restore();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, powerUps, shootingStars;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;
let skinMenu;   // null o { open: bool, previewAngle: number }

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  powerUps  = [];
  shootingStars = [];
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  skinMenu = null;
  spawnAsteroids(4);
  spawnShootingStar();
}

function nextLevel() {
  level++;
  bullets   = [];
  particles = [];
  powerUps  = [];
  ship.reset();
  spawnAsteroids(3 + level);
  spawnShootingStar();
}

function spawnShootingStar() {
  const SAFE_DIST = 130;
  let x, y;
  do {
    x = rand(0, W);
    y = rand(0, H);
  } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
  const size = level >= 3 ? randInt(1, 2) : 1;
  shootingStars.push(new ShootingStar(x, y, size));
}

function explode(x, y, count = 8, color = null) {
  for (let i = 0; i < count; i++) {
    const p = new Particle(x, y);
    if (color) p.color = color;
    particles.push(p);
  }
}

function trySpawnPowerUp(x, y) {
  if (Math.random() < 0.10) {
    const types = ['speed', 'triple', 'shield'];
    const type = types[Math.floor(Math.random() * types.length)];
    powerUps.push(new PowerUp(x, y, type));
  }
}

function killShip() {
  // Si queda exactamente 1 vida, activar modo nave roja (sin morir)
  if (lives === 2) {
    ship.redShipMode = true;
    return;
  }
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    // Si estaba en modo rojo, desactivarlo antes de respawnear
    if (ship.redShipMode) {
      ship.redShipMode = false;
    }
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  // Menú de skins (separado de los estados del juego)
  if (skinMenu && skinMenu.open) {
    if (pressed('Tab'))       { skinMenu.open = false; }
    if (pressed('ArrowLeft'))  ship.cycleSkin(-1);
    if (pressed('ArrowRight')) ship.cycleSkin(1);
    if (pressed('Enter'))      { skinMenu.open = false; }
    // Actualizar preview con rotación suave
    skinMenu.previewAngle += dt * 1.2;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    powerUps.forEach(p => p.update(dt));
    powerUps = powerUps.filter(p => !p.dead);
    shootingStars.forEach(s => s.update(dt));
    shootingStars = shootingStars.filter(s => !s.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    powerUps.forEach(p => p.update(dt));
    powerUps = powerUps.filter(p => !p.dead);
    shootingStars.forEach(s => s.update(dt));
    shootingStars = shootingStars.filter(s => !s.dead);
    if (deadTimer <= 0) {
      state = 'playing';
      ship.reset();
      // Reactivar modo nave roja si el jugador tiene 1 vida
      if (lives === 1 && !ship.redShipMode) {
        ship.redShipMode = true;
      }
    }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  // Abrir menú de skins
  if (pressed('Tab')) {
    skinMenu = { open: true, previewAngle: ship.angle };
    return;
  }

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));
  powerUps.forEach(p => p.update(dt));
  shootingStars.forEach(s => s.update(dt));

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);
  powerUps  = powerUps.filter(p => !p.dead);
  shootingStars = shootingStars.filter(s => !s.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        const mult = ship.redShipMode ? 2 : 1;
        score += POINTS[a.size] * mult;
        explode(a.x, a.y, a.size * 5);
        trySpawnPowerUp(a.x, a.y);
        newAsteroids.push(...a.split());
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Bala vs estrella fugaz
  for (const b of bullets) {
    for (const s of shootingStars) {
      if (!s.dead && !b.dead && dist(b, s) < s.radius) {
        b.dead = true;
        s.dead = true;
        score += POINTS[s.size] * STAR_POINTS_MULT;
        explode(s.x, s.y, s.size * 6);
      }
    }
  }
  shootingStars = shootingStars.filter(s => !s.dead);
  bullets       = bullets.filter(b => !b.dead);

  // Nave vs asteroide
  if (ship.invincible <= 0) {
    for (const a of asteroids) {
      if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        if (ship.shieldActive > 0) {
          // Escudo destruye el asteroide con chispas azules
          explode(a.x, a.y, a.size * 5, '#0af');
          a.dead = true;
        } else {
          killShip();
        }
        break;
      }
    }
  }

  // Nave vs estrella fugaz
  if (ship.invincible <= 0) {
    for (const s of shootingStars) {
      if (dist(ship, s) < ship.radius + s.radius * 0.82) {
        if (ship.shieldActive > 0) {
          explode(s.x, s.y, s.size * 6, '#0af');
          s.dead = true;
        } else {
          killShip();
        }
        break;
      }
    }
  }

  // Nave vs power-up
  for (const p of powerUps) {
    if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
      if (p.type === 'speed') {
        ship.speedBoost = 5;
      } else if (p.type === 'triple') {
        ship.tripleShot = 5;
      } else if (p.type === 'shield') {
        ship.shieldActive = 8;   // 8 segundos de escudo
      }
      p.dead = true;
    }
  }
  powerUps = powerUps.filter(p => !p.dead);

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo( 9,  0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3,  0);
  ctx.lineTo(-6,  5);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  // Nombre del skin actual
  ctx.textAlign = 'center';
  ctx.font = '11px monospace';
  ctx.fillStyle = ship.skin.primary;
  ctx.fillText(`[ ${ship.skin.name} ]`, W / 2, 44);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  // Indicador de velocidad
  if (ship.speedBoost > 0) {
    const sec = Math.ceil(ship.speedBoost);
    const barW = sec * 20;
    ctx.fillStyle = '#0cf';
    ctx.fillRect(W / 2 - barW / 2, ship.tripleShot > 0 ? 56 : 32, barW, 4);
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    const yText = ship.tripleShot > 0 ? 74 : 50;
    ctx.fillText(`SPEED x2 — ${sec}s`, W / 2, yText);
  }

  // Indicador de triple disparo
  if (ship.tripleShot > 0) {
    const sec = Math.ceil(ship.tripleShot);
    const barW = sec * 20;
    ctx.fillStyle = '#f44';
    ctx.fillRect(W / 2 - barW / 2, ship.speedBoost > 0 ? 56 : 32, barW, 4);
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    const yText = ship.speedBoost > 0 ? 74 : 50;
    ctx.fillText(`TRIPLE SHOT — ${sec}s`, W / 2, yText);
  }

  // Indicador de escudo
  if (ship.shieldActive > 0) {
    const sec = Math.ceil(ship.shieldActive);
    const barW = sec * 18;
    ctx.fillStyle = '#0af';
    const shieldY = ship.speedBoost > 0 && ship.tripleShot > 0 ? 80 :
                    (ship.speedBoost > 0 || ship.tripleShot > 0) ? 64 : 32;
    ctx.fillRect(W / 2 - barW / 2, shieldY, barW, 4);
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    const yText = ship.speedBoost > 0 && ship.tripleShot > 0 ? 96 :
                  (ship.speedBoost > 0 || ship.tripleShot > 0) ? 80 : 48;
    ctx.fillText(`SHIELD — ${sec}s`, W / 2, yText);
  }

  // Indicador de modo nave roja (doble puntos)
  if (ship.redShipMode) {
    const pulse = 1 + 0.15 * Math.sin(Date.now() / 180);
    ctx.fillStyle = `rgba(255, 34, 0, ${0.7 + 0.3 * Math.sin(Date.now() / 180)})`;
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`★ DOBLE PUNTO ★`, W / 2, ship.shieldActive > 0 || ship.speedBoost > 0 || ship.tripleShot > 0 ? 96 : 32);
    // Barra pulsante roja
    const barW = 80 * pulse;
    ctx.fillStyle = 'rgba(255, 34, 0, 0.5)';
    ctx.fillRect(W / 2 - barW / 2, (ship.shieldActive > 0 || ship.speedBoost > 0 || ship.tripleShot > 0 ? 80 : 16), barW, 3);
  }
}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function drawSkinMenu() {
  // Fondo semitransparente
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(0, 0, W, H);

  const skin = ship.skin;
  const cx = W / 2;
  const cy = H / 2 - 10;
  const scale = 1.8;

  // Título
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 28px monospace';
  ctx.fillText('SELECCIONAR NAVE', cx, 40);

  // Indicador de skin actual con número
  ctx.font = '16px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText(`${ship.skinIndex + 1} / ${SKINS.length}`, cx, 70);

  // Vista previa: dibujar en canvas temporal y blitear
  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = W;
  tmpCanvas.height = H;
  const tmpCtx = tmpCanvas.getContext('2d');

  // Las funciones del skin reciben ctx como parámetro, así que pasamos tmpCtx
  skin.draw(tmpCtx, cx, cy, skinMenu.previewAngle, ship.radius, false, 0, 0);

  // Blitear preview escalado al centro
  const pw = W * scale;
  const ph = H * scale;
  ctx.drawImage(tmpCanvas, cx - pw/2, cy - ph/2, pw, ph);

  // Nombre del skin debajo de la vista previa
  ctx.textAlign   = 'center';
  ctx.fillStyle   = skin.primary;
  ctx.font        = 'bold 24px monospace';
  ctx.fillText(skin.name, cx, cy + H * scale / 2 + 30);

  // Instrucciones
  ctx.font = '15px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('← → cambiar   ENTER / TAB confirmar', cx, H - 30);

  // Flechas indicadoras con animación
  const arrowAlpha = 0.6 + 0.3 * Math.sin(Date.now() / 300);
  ctx.font = '28px monospace';
  ctx.textAlign = 'right';
  ctx.fillStyle = `rgba(255,255,255,${arrowAlpha})`;
  ctx.fillText('◀', cx - 140, cy + 10);
  ctx.textAlign = 'left';
  ctx.fillText('▶', cx + 140, cy + 10);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // Si el menú de skins está abierto, dibujarlo y retornar
  if (skinMenu && skinMenu.open) {
    drawSkinMenu();
    return;
  }

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  shootingStars.forEach(s => s.draw());
  powerUps.forEach(p => p.draw());
  bullets.forEach(b => b.draw());
  ship.draw();

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
