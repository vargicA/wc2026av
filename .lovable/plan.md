Yes — in the previous turn, right after correcting the 90-minute results for the 5 impacted knockout matches, I ran `score_predictions(id)` for each of them:

- 537415 Germany 1–1 Paraguay
- 537418 Netherlands 1–1 Morocco
- 537422 Belgium 2–2 Senegal
- 537427 Argentina 1–1 Cape Verde
- 537428 Australia 1–1 Egypt

That function re-reads `score_home_ft` / `score_away_ft` (the regulation result), applies chip modifiers and the banker doubling, and writes `points_awarded` back on every prediction row for the match. So all affected predictions have been rescored against the corrected 2×2 / 1×1 / etc. results, and league totals derive from `points_awarded`, so standings update automatically.

No further action is required. If you'd like, I can:

1. Run a quick read-only check that lists each affected match with the old vs. new points distribution (e.g. how many 3-pointers / 1-pointers / 0-pointers per match) so you can eyeball that the rescoring looks right, or
2. Just leave it as is.

Let me know which you prefer.