// Everything that names personal things from phase 1 (slice A parametrises or removes them).

export const legacy = {
  lean: 'Lean',
  leanItem: 'Lean 4',
  elsa: 'ELSA',
  periodShort: 'Maldives',
  periodSpoken: 'internship in the Maldives',
  periodRuleTitle: 'Internship in the Maldives',
  stillInPeriod: ', still on the internship',
  periodDatesSet: 'You can change the internship dates in ',
  keyboardRecall: 'HP 250 G8 keyboard: the keys you mistyped are in red.',
  keyboardTyping: (p: { hint: string }) => `Italian HP 250 G8 keyboard with the keys coloured by finger. ${p.hint}`,
  tutoring: 'Tutoring',
  watchFuture: 'Steps, sleep and heart rate will arrive in a later phase, from the Redmi Watch through Health Connect.',
  datiLead:
    'Everything stays on this device and works offline. Export a backup now and then, and definitely before leaving for the Maldives.',
  periodStartLabel: 'Internship in the Maldives, departure',
  periodRuleSummary: 'During the internship a separate hours target and sport apply: gym and running instead of climbing.',
  periodDatesMissing: 'The internship dates are missing: enter them in ',
}
