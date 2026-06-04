import { Lift } from '@lifting-logbook/types';

/**
 * Curated seed catalog of common barbell, dumbbell, and bodyweight movements.
 * Each entry carries a training-role `classification` (compound | accessory) and a
 * `movementProfile` describing three orthogonal axes:
 *
 *   - patterns:     kinesiological pattern tags (combine to express a movement)
 *   - jointActions: anatomical joint actions driven through the range of motion
 *   - complexity:   single-joint (simple) vs multi-joint (compound) mechanics
 *
 * Patterns combine to express a movement:
 *   push + vertical   = overhead press pattern
 *   push + horizontal = bench press / dip pattern
 *   pull + vertical   = chin-up / lat pulldown pattern
 *   pull + horizontal = row pattern
 *   squat             = knee-dominant squat pattern
 *   hinge             = hip hinge pattern (deadlift, RDL)
 *   carry             = loaded carry pattern
 *
 * NOTE: movement `complexity` (simple|compound) is distinct from role `classification`
 * (compound|accessory). A Goblet Squat is movement-`compound` yet role-`accessory`.
 */
export const LIFT_CATALOG: readonly Lift[] = [
  // --- Squat pattern ---
  { id: 'back-squat',    name: 'Back Squat',    classification: 'compound',  movementProfile: { patterns: ['squat'], jointActions: ['flexion', 'extension'], complexity: 'compound' } },
  { id: 'front-squat',   name: 'Front Squat',   classification: 'compound',  movementProfile: { patterns: ['squat'], jointActions: ['flexion', 'extension'], complexity: 'compound' } },
  { id: 'goblet-squat',  name: 'Goblet Squat',  classification: 'accessory', movementProfile: { patterns: ['squat'], jointActions: ['flexion', 'extension'], complexity: 'compound' } },

  // --- Hip hinge pattern ---
  { id: 'deadlift',           name: 'Deadlift',                 classification: 'compound',  movementProfile: { patterns: ['hinge'], jointActions: ['flexion', 'extension'], complexity: 'compound' } },
  { id: 'romanian-deadlift',  name: 'Romanian Deadlift',        classification: 'compound',  movementProfile: { patterns: ['hinge'], jointActions: ['flexion', 'extension'], complexity: 'compound' } },
  { id: 'hip-thrust',         name: 'Hip Thrust',               classification: 'accessory', movementProfile: { patterns: ['hinge'], jointActions: ['extension'], complexity: 'simple' } },
  { id: 'kb-swing',           name: 'Kettlebell Swing',         classification: 'accessory', movementProfile: { patterns: ['hinge'], jointActions: ['flexion', 'extension'], complexity: 'compound' } },

  // --- Vertical push pattern ---
  { id: 'overhead-press',  name: 'Overhead Press',  classification: 'compound',  movementProfile: { patterns: ['push', 'vertical'], jointActions: ['flexion', 'extension'], complexity: 'compound' } },
  { id: 'push-press',      name: 'Push Press',      classification: 'compound',  movementProfile: { patterns: ['push', 'vertical'], jointActions: ['flexion', 'extension'], complexity: 'compound' } },

  // --- Horizontal push pattern ---
  { id: 'bench-press',         name: 'Bench Press',         classification: 'compound',  movementProfile: { patterns: ['push', 'horizontal'], jointActions: ['flexion', 'extension'], complexity: 'compound' } },
  { id: 'incline-bench-press', name: 'Incline Bench Press', classification: 'compound',  movementProfile: { patterns: ['push', 'horizontal'], jointActions: ['flexion', 'extension'], complexity: 'compound' } },
  { id: 'dip',                 name: 'Dip',                 classification: 'compound',  movementProfile: { patterns: ['push', 'horizontal'], jointActions: ['flexion', 'extension'], complexity: 'compound' }, isBodyweightComponent: true },

  // --- Vertical pull pattern ---
  { id: 'chin-up',       name: 'Chin-up',       classification: 'compound',  movementProfile: { patterns: ['pull', 'vertical'], jointActions: ['flexion', 'extension'], complexity: 'compound' }, isBodyweightComponent: true },
  { id: 'pull-up',       name: 'Pull-up',        classification: 'compound',  movementProfile: { patterns: ['pull', 'vertical'], jointActions: ['flexion', 'extension'], complexity: 'compound' }, isBodyweightComponent: true },
  { id: 'lat-pulldown',  name: 'Lat Pulldown',   classification: 'accessory', movementProfile: { patterns: ['pull', 'vertical'], jointActions: ['flexion', 'extension'], complexity: 'compound' } },

  // --- Horizontal pull pattern ---
  { id: 'barbell-row',  name: 'Barbell Row',   classification: 'compound',  movementProfile: { patterns: ['pull', 'horizontal'], jointActions: ['flexion', 'extension'], complexity: 'compound' } },
  { id: 'db-row',       name: 'Dumbbell Row',  classification: 'accessory', movementProfile: { patterns: ['pull', 'horizontal'], jointActions: ['flexion', 'extension'], complexity: 'compound' } },
  { id: 'upright-row',  name: 'Upright Row',   classification: 'accessory', movementProfile: { patterns: ['pull', 'horizontal'], jointActions: ['abduction'], complexity: 'compound' } },
  { id: 'face-pull',    name: 'Face Pull',      classification: 'accessory', movementProfile: { patterns: ['pull', 'horizontal'], jointActions: ['external-rotation'], complexity: 'simple' } },

  // --- Carry pattern ---
  { id: 'farmers-carry',  name: "Farmer's Carry",  classification: 'compound',  movementProfile: { patterns: ['carry'], jointActions: [], complexity: 'compound' } },

  // --- Common accessories ---
  { id: 'cable-curl',    name: 'Cable Curl',    classification: 'accessory', movementProfile: { patterns: ['pull'], jointActions: ['flexion'], complexity: 'simple' } },
  { id: 'lateral-raise', name: 'Lateral Raise', classification: 'accessory', movementProfile: { patterns: ['push', 'vertical'], jointActions: ['abduction'], complexity: 'simple' } },
  { id: 'calf-raise',    name: 'Calf Raise',    classification: 'accessory', movementProfile: { patterns: [], jointActions: ['extension'], complexity: 'simple' } },
];
