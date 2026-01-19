// Add days to a date in UTC
export function addDaysUTC(date: Date, days: number): Date {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  utcDate.setUTCDate(utcDate.getUTCDate() + days);
  return utcDate;
}
// Utility for consistent UTC date formatting
export function formatDateYYYYMMDD(date: string | Date): string {
  if (typeof date === 'string') {
    // Accept MM/DD/YYYY or YYYY-MM-DD
    const parts = date.includes('-') ? date.split('-') : date.split('/');
    let yyyy, mm, dd;
    if (parts.length === 3) {
      if (date.includes('-')) {
        yyyy = Number(parts[0]);
        mm = Number(parts[1]);
        dd = Number(parts[2]);
      } else {
        mm = Number(parts[0]);
        dd = Number(parts[1]);
        yyyy = Number(parts[2]);
      }
      const d = new Date(Date.UTC(yyyy, mm - 1, dd));
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    }
  }
  // If already a Date object
  if (date instanceof Date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }
  return String(date);
}
