import { LiftRecord } from "../../models/LiftRecord";

/**
 * Extract lift records from a 2D grid of data.
 * @param {any[][]} data
 * @returns {LiftRecord[]}
 */

export function extractLiftRecords(data: any[][]): LiftRecord[] {
  if (!data || data.length < 2) return [];
  // Extract program and cycle from the first few rows (look for 'Program' and 'Cycle' headers)
  let program: string | undefined = undefined;
  let cycleNum: number | undefined = undefined;
  for (let i = 0; i < Math.min(5, data.length); i++) {
    const row = data[i];
    if (Array.isArray(row)) {
      for (let j = 0; j < row.length; j++) {
        if (typeof row[j] === "string" && row[j].trim() === "Program") {
          program = row[j + 1] !== undefined ? String(row[j + 1]) : undefined;
        }
        if (typeof row[j] === "string" && row[j].trim() === "Cycle") {
          const val = row[j + 1];
          if (val !== undefined && val !== "") {
            const num = Number(val);
            if (!isNaN(num)) cycleNum = num;
          }
        }
      }
    }
  }
  // Enforce required fields
  if (!program || cycleNum === undefined) {
    throw new Error(
      `Missing required program or cycle number in lift records data.`,
    );
  }
  // Find the header row for lift records
  const headerIdx = data.findIndex(
    (row) =>
      Array.isArray(row) &&
      row.length >= 6 &&
      row[0] === "Date" &&
      row[1] === "Lift" &&
      row[2] === "Set",
  );
  if (headerIdx === -1) throw new Error("Lift records header row not found.");
  const headers = data[headerIdx];
  const records: LiftRecord[] = [];
  // Map of date string to workout number (incremented as new dates are found)
  const dateToWorkoutNum = new Map<string, number>();
  let workoutCounter = 1;
  // Process rows after header
  for (let i = headerIdx + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 5) continue;
    // Check for required fields (all except Notes)
    const requiredIdxs = [0, 1, 2, 3]; // Date, Lift, Set, Weight
    let missingRequired = false;
    for (const idx of requiredIdxs) {
      if (row[idx] === undefined || row[idx] === "") {
        missingRequired = true;
        throw new Error(
          `Missing required field '${headers[idx]}' at row ${headerIdx + i + 1}, column ${idx + 1}`,
        );
      }
    }
    // if (missingRequired) continue;
    // Exclude warm-up sets
    const setVal = row[2];
    if (
      typeof setVal === "string" &&
      setVal.trim().toLowerCase().startsWith("warm-up")
    ) {
      continue;
    }
    // Exclude skipped work sets
    const repVal = row[4];
    if (repVal === undefined || repVal === "" || Number(repVal) === 0) {
      continue;
    }
    // Determine workoutNum from date
    const dateStr = String(row[0]);
    let workoutNum: number;
    if (dateToWorkoutNum.has(dateStr)) {
      workoutNum = dateToWorkoutNum.get(dateStr)!;
    } else {
      workoutNum = workoutCounter++;
      dateToWorkoutNum.set(dateStr, workoutNum);
    }
    // Map row to LiftRecord
    const rec: any = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j];
      let value = row[j];
      switch (key) {
        case "Set":
          const currSetMatch = value.match(/Set\s*(\d+)/i);
          if (currSetMatch) {
            rec.setNum = Number(currSetMatch[1]);
          } else {
            throw new Error(
              `Invalid Set string format at row ${headerIdx + i + 1}: ${value}`,
            );
          }
          break;
        case "Weight":
        case "Reps":
          rec[key.trim().toLowerCase()] = Number(value);
          break;
        default:
          rec[key.trim().toLowerCase()] = value;
          break;
      }
      // rec[`${LIFT_RECORD_HEADER_MAP[key]}`] = value;
    }
    // Add required program and cycleNum
    rec.program = program;
    rec.cycleNum = cycleNum;
    rec.workoutNum = workoutNum;
    records.push(rec as LiftRecord);
  }
  return records;
}
