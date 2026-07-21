// Bộ cảm xúc cho hoạt động: like · vỗ tay · tim · bắp tay gồng · lửa (streak).
// Mỗi người bấm nhiều lần để tăng count -> nhìn "nhiều data" như Strava kudos.
export const REACT_EMOJIS = ["👍", "👏", "❤️", "💪", "🔥"];
export const REACT_LABEL: Record<string, string> = {
  "👍": "Thích", "👏": "Vỗ tay", "❤️": "Tim", "💪": "Cơ bắp", "🔥": "Cháy",
};

export interface ReactionRow { emoji: string; employeeId: string; name: string; count: number; }
export interface ReactionGroup { emoji: string; count: number; names: string[]; people: number; mine: boolean; mineCount: number; }

// Gom reaction theo emoji: count = tổng số lần bấm; people = số người; mine = tôi có bấm.
export function groupReactions(rows: ReactionRow[], meId: string): ReactionGroup[] {
  const m = new Map<string, ReactionGroup>();
  for (const r of rows) {
    let g = m.get(r.emoji);
    if (!g) { g = { emoji: r.emoji, count: 0, names: [], people: 0, mine: false, mineCount: 0 }; m.set(r.emoji, g); }
    g.count += r.count;
    g.people += 1;
    g.names.push(r.count > 1 ? `${r.name} ×${r.count}` : r.name);
    if (r.employeeId === meId) { g.mine = true; g.mineCount = r.count; }
  }
  return REACT_EMOJIS.filter((e) => m.has(e)).map((e) => m.get(e)!);
}
