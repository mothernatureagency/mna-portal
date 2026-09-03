// Shared by the text-based Monthly Planner (plan-month) and the photo-based
// one (plan-month-photos) so the date-spreading logic can't drift between
// the two — they should schedule identically, just fill different content.

/** Spread N posts/week across the month, skipping past days and days that
 * already have posts. Weekday preference keeps a natural cadence. */
export function autoPickDates(month: string, postsPerWeek: number, takenDates: Set<string>): string[] {
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const todayIso = new Date().toISOString().slice(0, 10);
  const preference = [2, 4, 6, 1, 3, 5, 0]; // Tue, Thu, Sat, Mon, Wed, Fri, Sun

  // Group the month's days by calendar week (Sun-start).
  const weeks: { iso: string; weekday: number }[][] = [];
  let week: { iso: string; weekday: number }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(y, m - 1, d);
    const iso = `${month}-${String(d).padStart(2, '0')}`;
    week.push({ iso, weekday: date.getDay() });
    if (date.getDay() === 6 || d === daysInMonth) { weeks.push(week); week = []; }
  }

  const picked: string[] = [];
  for (const w of weeks) {
    const usable = w.filter((d) => d.iso >= todayIso && !takenDates.has(d.iso));
    const chosen = preference
      .map((wd) => usable.find((d) => d.weekday === wd))
      .filter((d): d is { iso: string; weekday: number } => !!d)
      .slice(0, postsPerWeek)
      .map((d) => d.iso)
      .sort();
    picked.push(...chosen);
  }
  return picked;
}
