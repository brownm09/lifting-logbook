import { StrengthGoalEntry, SpreadsheetCell } from '../../models';

/**
 * Parses a transposed `Strength_Goals` CSV into `StrengthGoalEntry[]`.
 *
 * The layout is **pivoted**: lifts run across the header row and each subsequent
 * row is an attribute. Example:
 *
 *   Metric,     Squat,    Bench,    Deadlift, OHP
 *   Goal Type,  absolute, absolute, relative, absolute
 *   Target,     405,      275,      ,         185
 *   Unit,       lbs,      lbs,      lbs,      lbs
 *   Ratio,      ,         ,         2.0,
 *
 * → one entry per lift column. Attribute rows are matched by a fuzzy label on
 * the first cell (substring, case-insensitive), so "Goal Type" / "Type",
 * "Target" / "Target Weight", "Ratio" / "BW Ratio", "Unit" all resolve.
 *
 * PROVISIONAL FORMAT (#477): pending the user's real export. The matching is
 * deliberately tolerant; tighten the attribute labels and add a fixture once the
 * canonical export shape is confirmed.
 */
export function parseStrengthGoals(data: SpreadsheetCell[][]): StrengthGoalEntry[] {
  if (data.length < 2) return [];

  const header = data[0]!;
  const lifts = header.slice(1).map((c) => String(c ?? '').trim());

  // Index attribute rows by a normalized first-cell label.
  const attrRows = new Map<string, SpreadsheetCell[]>();
  for (const row of data.slice(1)) {
    const label = String(row[0] ?? '').trim().toLowerCase();
    if (label) attrRows.set(label, row);
  }
  const findAttr = (token: string): SpreadsheetCell[] | undefined => {
    for (const [label, row] of attrRows) if (label.includes(token)) return row;
    return undefined;
  };

  const goalTypeRow = findAttr('type');
  const targetRow = findAttr('target');
  const unitRow = findAttr('unit');
  const ratioRow = findAttr('ratio');

  const num = (cell: SpreadsheetCell | undefined): number | undefined => {
    const s = String(cell ?? '').trim();
    if (!s) return undefined;
    const n = Number(s);
    return isNaN(n) ? undefined : n;
  };

  const entries: StrengthGoalEntry[] = [];
  lifts.forEach((lift, i) => {
    if (!lift) return;
    const col = i + 1;
    const target = num(targetRow?.[col]);
    const ratio = num(ratioRow?.[col]);
    const goalTypeRaw = String(goalTypeRow?.[col] ?? '').trim().toLowerCase();

    // Nothing to import for this lift column.
    if (!goalTypeRaw && target === undefined && ratio === undefined) return;

    const goalType: StrengthGoalEntry['goalType'] =
      goalTypeRaw.includes('relative') || (goalTypeRaw === '' && ratio !== undefined)
        ? 'relative'
        : 'absolute';

    const unitRaw = String(unitRow?.[col] ?? '').trim().toLowerCase();
    const unit: StrengthGoalEntry['unit'] = unitRaw === 'kg' ? 'kg' : 'lbs';

    entries.push({
      lift,
      goalType,
      unit,
      updatedAt: new Date(),
      ...(target !== undefined ? { target } : {}),
      ...(ratio !== undefined ? { ratio } : {}),
    });
  });

  return entries;
}
