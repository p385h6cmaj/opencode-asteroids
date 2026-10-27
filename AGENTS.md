# AGENTS.md — Asteroids

## Run
- Open `index.html` in a browser (double-click), or: `bun serve .` → `http://localhost:3000`

## Structure
Everything is flat. Two files + favicon:
- **`game.js`** (~685 lines) — all game logic, entities, and render loop. This is the only file that changes during development.
- **`index.html`** — minimal shell with a `<canvas id="canvas" width="800" height="600">`. Canvas size is also hardcoded as `W`/`H` constants at the top of `game.js`; keep them in sync if you resize.

## Architecture (game.js)
- `'use strict'`, ES6+ classes, no imports — single global scope.
- Entities: `Ship`, `Asteroid`, `Bullet`, `Particle`, `PowerUp`, `ShootingStar`
- State machine: `'playing'` → `'dead'` (2 s respawn) → `'playing'`, or `'gameover'` (Space to restart).
- All entities live in flat arrays (`bullets`, `asteroids`, etc.) updated/drawn each frame via `requestAnimationFrame`.
- Collision uses simple distance checks; asteroid hit radius is `radius * 0.82` for a forgiving feel.

## Key constants (top of game.js)
| Symbol | Value | Meaning |
|--------|-------|---------|
| `W`, `H` | 800 / 600 | Canvas dimensions |
| `RADII` | [16, 30, 50] | Asteroid sizes (small → large) |
| `SPEEDS` | [85, 55, 32] | Base speed by asteroid size |
| `POINTS` | [100, 50, 20] | Score by size (reversed: small = more points) |
| `STAR_POINTS_MULT` | 2 | Shooting star score multiplier |

## Conventions to preserve
- No linter, formatter, bundler, or test harness — the repo is intentionally bare.
- Comments are in Spanish; keep that style if adding new code.
- Canvas rendering uses the global `ctx`; avoid introducing module patterns or `import`.
