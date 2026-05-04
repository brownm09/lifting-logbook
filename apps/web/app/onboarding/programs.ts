export type Experience = 'beginner' | 'intermediate' | 'advanced';

export type Program = {
  id: string;
  name: string;
  experience: Experience;
  meta: string;
  description: string;
};

export const PROGRAMS: Program[] = [
  {
    id: 'starting-strength',
    name: 'Starting Strength',
    experience: 'beginner',
    meta: '3 days/week · Linear progression',
    description:
      'Mark Rippetoe’s linear progression program. Squat, press, deadlift, bench, and power clean — add weight every session until stalls require a deload.',
  },
  {
    id: 'stronglifts',
    name: 'StrongLifts 5×5',
    experience: 'beginner',
    meta: '3 days/week · 5×5 alternating workouts',
    description:
      'Two alternating workouts (A/B) with five compound lifts at 5 sets of 5 reps. Add 5 lb every session until plateau.',
  },
  {
    id: 'rpt',
    name: 'Reverse Pyramid Training (Lyle/Eric Helms)',
    experience: 'intermediate',
    meta: '3-4 days/week · Top-set focused',
    description:
      'Heaviest set first, then back-off sets at reduced load. Emphasizes intensity on the first work set with clear progression rules tied to top-set rep targets.',
  },
  {
    id: 'ppl',
    name: 'Push / Pull / Legs',
    experience: 'intermediate',
    meta: '6 days/week · Hypertrophy split',
    description:
      'Classic split that lets you train each major movement pattern twice per week. Volume scales with recovery; popular as PHUL/PHAT variants too.',
  },
  {
    id: 'upper-lower',
    name: 'Upper / Lower',
    experience: 'intermediate',
    meta: '4 days/week · Balanced split',
    description:
      'Upper body and lower body alternated four days per week. Good middle ground between full-body frequency and bodypart split volume.',
  },
  {
    id: '531',
    name: '5/3/1',
    experience: 'intermediate',
    meta: '4 days/week · Wave-loaded',
    description:
      'Jim Wendler’s 4-week wave with a top set on each main lift, then assistance work. Conservative training maxes (90% of 1RM) drive long-term progress.',
  },
  {
    id: '531-bbb',
    name: '5/3/1 Boring But Big',
    experience: 'intermediate',
    meta: '4 days/week · BBB volume template',
    description:
      'Standard 5/3/1 main work followed by 5×10 of the same lift (or its complement) at 50–70% TM. High-volume hypertrophy template most lifters can recover from.',
  },
  {
    id: '531-forever',
    name: '5/3/1 Forever',
    experience: 'advanced',
    meta: '3-5 days/week · Multi-cycle leader/anchor',
    description:
      'The latest evolution of 5/3/1 organized into "leader" volume blocks and "anchor" intensity blocks. Drops the deload week in favor of programmed light days.',
  },
  {
    id: 'leangains',
    name: 'Leangains (Berkhan)',
    experience: 'intermediate',
    meta: '3 days/week · RPT + IF protocol',
    description:
      'Reverse-pyramid lifting paired with intermittent fasting. Three compound-focused sessions per week with macros tuned to training and rest days.',
  },
  {
    id: 'conjugate',
    name: 'Westside Conjugate',
    experience: 'advanced',
    meta: '4 days/week · Max effort + dynamic effort',
    description:
      'Westside Barbell’s max-effort and dynamic-effort waves rotated across upper and lower days. Heavy emphasis on accommodating resistance and weak-point training.',
  },
  {
    id: 'smolov',
    name: 'Smolov (Squat)',
    experience: 'advanced',
    meta: '4 days/week · 13-week squat cycle',
    description:
      'Soviet squat specialization program. Brutal intro phase, base mesocycle, switching, and intense mesocycle. Use only with deep recovery support.',
  },
  {
    id: 'juggernaut',
    name: 'Juggernaut Method',
    experience: 'advanced',
    meta: '4 days/week · Block periodization',
    description:
      'Chad Wesley Smith’s block model with accumulation, intensification, and realization phases. Long-term progression with built-in volume waves.',
  },
  {
    id: 'creeping-death-2',
    name: 'Creeping Death II',
    experience: 'advanced',
    meta: '4 days/week · 5/3/1 program of programs',
    description:
      'A long-haul 5/3/1 template that stretches each cycle’s pace and increases supplemental work over time. Built for advanced lifters chasing slow PRs.',
  },
];
