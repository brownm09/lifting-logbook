// TrainingMax header mapping for parsing
export const TRAINING_MAX_HEADER_MAP: Record<
  string,
  { key: string; type: string }
> = {
  "Date Updated": { key: "dateUpdated", type: "string" },
  Lift: { key: "lift", type: "string" },
  Weight: { key: "weight", type: "number" },
};
// RptProgramSpec header mapping for parsing
export const RPT_PROGRAM_SPEC_HEADER_MAP: Record<
  string,
  { key: string; type: string }
> = {
  Offset: { key: "offset", type: "number" },
  Lift: { key: "lift", type: "string" },
  Increment: { key: "increment", type: "number" },
  Order: { key: "order", type: "number" },
  Sets: { key: "sets", type: "number" },
  Reps: { key: "reps", type: "number" },
  "AMRAP?": { key: "amrap", type: "boolean|string" },
  "Warm-Up %": { key: "warmUpPct", type: "string" },
  "WT Decrement %": { key: "wtDecrementPct", type: "number" },
  Activation: { key: "activation", type: "string" },
};
