## Visual refresh: dark theme + blue accent + larger flags

### Theme (src/styles.css)
- Switch default to a **dark** palette (drop the light `:root`, promote dark values to root).
- Replace pitch-green primary with a modern **electric blue**:
  - `--primary: oklch(0.62 0.18 255)` (vivid blue)
  - `--ring`, `--pitch` updated to match
  - `--success` stays green (for points pills) but slightly desaturated to not fight the blue
  - `--background: oklch(0.16 0.02 260)` deep blue-black
  - `--card: oklch(0.20 0.02 260)` with subtle blue tint
  - `--border: oklch(0.28 0.02 260)`
- Add a soft gradient/glow token for hero/CTA polish:
  - `--gradient-primary: linear-gradient(135deg, oklch(0.62 0.18 255), oklch(0.70 0.16 230))`
  - `--shadow-glow: 0 10px 40px -10px color-mix(in oklab, var(--primary) 50%, transparent)`

### Flags — 2× size everywhere
- `MatchRow.tsx`: team flags `text-lg` → `text-3xl`; tighten vertical rhythm so rows don't grow too tall.
- `_authenticated.matches.$matchId.tsx`: hero flags `text-3xl` → `text-6xl`, add subtle drop-shadow.
- `_authenticated.dashboard.tsx`: Banker picker flag chips — bump flag size ~2×.
- Anywhere else `teamFlag()` is rendered at small sizes, scale up proportionally.

### Modern polish (light touch, no scope creep)
- Card hover: switch from border-color flip to subtle border + soft blue glow shadow.
- Live indicator dot keeps red but gets a soft pulse glow.
- Score pills: keep semantic colors, slightly rounder.

### Out of scope
- No logic changes (chips, scoring, auth, routes untouched).
- No layout restructuring beyond flag sizing.

### Files touched
- `src/styles.css`
- `src/components/MatchRow.tsx`
- `src/routes/_authenticated.matches.$matchId.tsx`
- `src/routes/_authenticated.dashboard.tsx`
