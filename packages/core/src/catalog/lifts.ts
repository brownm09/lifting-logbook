import { Lift } from '@lifting-logbook/types';

/**
 * Curated seed catalog of common barbell, dumbbell, and bodyweight movements.
 * Each entry carries classification (compound | accessory) and one or more
 * movement pattern tags.
 *
 * Tags combine to express a pattern:
 *   push + vertical   = overhead press pattern
 *   push + horizontal = bench press / dip pattern
 *   pull + vertical   = chin-up / lat pulldown pattern
 *   pull + horizontal = row pattern
 *   hinge             = hip hinge pattern (deadlift, RDL)
 *   carry             = loaded carry pattern
 *
 * Squats are represented as compound lifts with no movement tags — the squat
 * pattern does not map to any of the above axes.
 */
export const LIFT_CATALOG: Lift[] = [
  // --- Squat pattern ---
  { id: 'back-squat',    name: 'Back Squat',    classification: 'compound',  movementTags: [] },
  { id: 'front-squat',   name: 'Front Squat',   classification: 'compound',  movementTags: [] },
  { id: 'goblet-squat',  name: 'Goblet Squat',  classification: 'accessory', movementTags: [] },

  // --- Hip hinge pattern ---
  { id: 'deadlift',           name: 'Deadlift',                 classification: 'compound',  movementTags: ['hinge'] },
  { id: 'romanian-deadlift',  name: 'Romanian Deadlift',        classification: 'compound',  movementTags: ['hinge'] },
  { id: 'hip-thrust',         name: 'Hip Thrust',               classification: 'accessory', movementTags: ['hinge'] },
  { id: 'kb-swing',           name: 'Kettlebell Swing',         classification: 'accessory', movementTags: ['hinge'] },

  // --- Vertical push pattern ---
  { id: 'overhead-press',  name: 'Overhead Press',  classification: 'compound',  movementTags: ['push', 'vertical'] },
  { id: 'push-press',      name: 'Push Press',      classification: 'compound',  movementTags: ['push', 'vertical'] },

  // --- Horizontal push pattern ---
  { id: 'bench-press',         name: 'Bench Press',         classification: 'compound',  movementTags: ['push', 'horizontal'] },
  { id: 'incline-bench-press', name: 'Incline Bench Press', classification: 'compound',  movementTags: ['push', 'horizontal'] },
  { id: 'dip',                 name: 'Dip',                 classification: 'compound',  movementTags: ['push', 'horizontal'] },

  // --- Vertical pull pattern ---
  { id: 'chin-up',       name: 'Chin-up',       classification: 'compound',  movementTags: ['pull', 'vertical'] },
  { id: 'pull-up',       name: 'Pull-up',        classification: 'compound',  movementTags: ['pull', 'vertical'] },
  { id: 'lat-pulldown',  name: 'Lat Pulldown',   classification: 'accessory', movementTags: ['pull', 'vertical'] },

  // --- Horizontal pull pattern ---
  { id: 'barbell-row',  name: 'Barbell Row',   classification: 'compound',  movementTags: ['pull', 'horizontal'] },
  { id: 'db-row',       name: 'Dumbbell Row',  classification: 'accessory', movementTags: ['pull', 'horizontal'] },
  { id: 'upright-row',  name: 'Upright Row',   classification: 'accessory', movementTags: ['pull', 'horizontal'] },
  { id: 'face-pull',    name: 'Face Pull',      classification: 'accessory', movementTags: ['pull', 'horizontal'] },

  // --- Carry pattern ---
  { id: 'farmers-carry',  name: "Farmer's Carry",  classification: 'compound',  movementTags: ['carry'] },

  // --- Common accessories ---
  { id: 'cable-curl',    name: 'Cable Curl',    classification: 'accessory', movementTags: ['pull'] },
  { id: 'lateral-raise', name: 'Lateral Raise', classification: 'accessory', movementTags: ['push', 'vertical'] },
  { id: 'calf-raise',    name: 'Calf Raise',    classification: 'accessory', movementTags: [] },
];
