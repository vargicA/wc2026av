export type ChipType = "double_down" | "insurance" | "all_in";

export const CHIP_META: Record<ChipType, { label: string; short: string; emoji: string; description: string }> = {
  double_down: {
    label: "Double Down",
    short: "2×",
    emoji: "⚡",
    description: "Doubles the points you score on this match (exact score becomes 6 pts).",
  },
  insurance: {
    label: "Insurance",
    short: "🛡",
    emoji: "🛡",
    description: "If you'd score 0 on this match, you get 1 point instead. Otherwise no effect.",
  },
  all_in: {
    label: "All-In",
    short: "🎲",
    emoji: "🎲",
    description: "Exact score = 12 pts, correct winner only = 2 pts, but anything else = −3 pts.",
  },
};

export const CHIP_ORDER: ChipType[] = ["double_down", "insurance", "all_in"];
