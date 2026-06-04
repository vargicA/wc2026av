## Problem

In `src/components/MatchRow.tsx`, each team side uses `flex-1 truncate` with the flag and team name in a single horizontal row. On narrow screens the flag + score column eat most of the width, so longer names like "South Korea", "Saudi Arabia", "United States" get clipped ("uth Korea").

## Fix

Update only `src/components/MatchRow.tsx` (presentation-only change):

1. **Stack flag above name on mobile, side-by-side on larger screens.**
   - Home side: `flex-col items-center sm:flex-row sm:justify-end sm:items-center`
   - Away side: `flex-col items-center sm:flex-row sm:items-center`
   - Flag stays large; name sits under it on mobile, centered.

2. **Allow the name to wrap and shrink instead of truncating.**
   - Replace `truncate` with `text-center sm:text-right` (home) / `sm:text-left` (away).
   - Use `text-sm sm:text-base` so long names fit better on small screens.
   - Use `break-words leading-tight` so two-word names like "South Korea" wrap cleanly to two lines.

3. **Tighten the score column on mobile.**
   - Change `min-w-[72px]` to `min-w-[56px] sm:min-w-[72px]` to give more room to team names.
   - Reduce horizontal gap on mobile: `gap-2 sm:gap-3`.

4. **Keep desktop appearance identical** — all current sizing/alignment is preserved at the `sm:` breakpoint and up.

No changes to data, routes, or other components.
