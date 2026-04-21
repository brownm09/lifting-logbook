/**
 * Pre-built exercise slot maps for the built-in program templates.
 *
 * A slot map translates the `lift` field from LiftingProgramSpec (which may be
 * an abbreviated or program-specific name) to a canonical catalog Lift id.
 * Existing call sites require no changes — pass DEFAULT_SLOT_MAP to resolveLift.
 */

/**
 * Covers all slot names used by the 5/3/1 and RPT program templates,
 * including both canonical names (from LIFT_NAMES) and CSV-abbreviated forms.
 */
export const DEFAULT_SLOT_MAP: Record<string, string> = {
  // Canonical names shared by 5/3/1 and LIFT_NAMES
  'Squat':           'back-squat',
  'Bench Press':     'bench-press',
  'Deadlift':        'deadlift',
  'Overhead Press':  'overhead-press',
  'Barbell Row':     'barbell-row',
  'Chin-up':         'chin-up',
  'Cable Curls':     'cable-curl',
  'Calf Raise':      'calf-raise',
  'Dips':            'dip',
  'Face Pulls':      'face-pull',
  'Cable Lat Raise': 'lateral-raise',
  'Upright Row':     'upright-row',

  // RPT CSV-abbreviated slot names (where they differ from canonical)
  'Bench P.':    'bench-press',
  'BB Row':      'barbell-row',
  'Dip':         'dip',
  'OH Press':    'overhead-press',
  'OH Press-HV': 'overhead-press',
  'CBL Curls':   'cable-curl',
  'C. Lat Raise': 'lateral-raise',
};
