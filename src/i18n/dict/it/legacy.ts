// Tutto ciò che nomina cose personali della fase 1 (slice A le parametrizza o le toglie).

export const legacy = {
  lean: 'Lean',
  leanItem: 'Lean 4',
  elsa: 'ELSA',
  periodShort: 'Maldive',
  periodSpoken: 'tirocinio alle Maldive',
  periodRuleTitle: 'Tirocinio alle Maldive',
  stillInPeriod: ', ancora in tirocinio',
  periodDatesSet: 'Le date del tirocinio si cambiano in ',
  keyboardRecall: 'Tastiera dell’HP 250 G8: in rosso i tasti degli errori di battitura.',
  keyboardTyping: (p: { hint: string }) => `Tastiera italiana dell’HP 250 G8 con i tasti colorati per dito. ${p.hint}`,
  tutoring: 'Ripetizioni',
  watchFuture: 'Passi, sonno e battito arriveranno in una fase successiva, dal Redmi Watch attraverso Health Connect.',
  datiLead:
    'Tutto resta su questo dispositivo e funziona senza rete. Esporta un backup ogni tanto, e di sicuro prima di partire per le Maldive.',
  periodStartLabel: 'Tirocinio alle Maldive, partenza',
  periodRuleSummary: 'Durante il tirocinio valgono obiettivo orario e sport a parte: palestra e corsa al posto dell’arrampicata.',
  periodDatesMissing: 'Mancano le date del tirocinio: inseriscile in ',
}
