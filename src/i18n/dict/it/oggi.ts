export const oggi = {
  register: 'Registra',
  energyQuestion: 'Quanto mangia il tuo buco nero oggi?',
  /** Etichetta del pianeta "adesso" sull'orbita. */
  now: 'adesso',
  orbitHeading: 'L’orbita di oggi',
  noEvents: 'Nessun impegno in agenda oggi.',
  suggestedBlocks: (p: { blocks: { start: string; title: string }[] }) =>
    `Blocchi suggeriti dal piano: ${p.blocks.map((b) => `${b.start} ${b.title}`).join(', ')}.`,
  planHeading: 'Il piano di oggi',
  openReview: 'Apri il ripasso',
  openTyping: 'Apri la dattilografia',
  stopSave: 'Ferma e salva',
  startTimer: 'Avvia il timer',
  planItemAria: (p: { title: string; duration: string; detail: string; action: string }) =>
    `${p.title}, ${p.duration}. ${p.detail} ${p.action}.`,
  running: (p: { elapsed: string }) => `In corso, ${p.elapsed}`,
  tapToStop: 'Tocca per fermare',
}
