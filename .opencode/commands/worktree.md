---
description: Crea un worktree git en .worktrees/<nombre> (maneja espacios y abrevia nombres largos)
---

Crea un worktree de git siguiendo estos pasos:

1. Toma el nombre recibido en `$ARGUMENTS`.
2. Si contiene espacios, reemplázalos por guiones (`-`). Ejemplo: `"mi feature"` → `mi-feature`.
3. Si el nombre resultante tiene más de 40 caracteres, abrévalo: toma las primeras 3 letras de cada palabra y une todo con guiones. Si aún supera los 40, recorta a 40 caracteres exactos.
4. Ejecuta `git worktree add .worktrees/<nombre-procesado>` usando la herramienta shell.

Ejemplos:
- `/worktree feature-login` → `.worktrees/feature-login`
- `/worktree mi feature branch` → `.worktrees/mi-feature-branch`
- `/worktree implementacion-del-nuevo-sistema-de-autenticacion` → `.worktrees/imp-nue-sist-auth`
