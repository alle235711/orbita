export const oggi = {
  register: 'Log',
  energyQuestion: 'How hungry is your black hole today?',
  /** Label of the "now" planet on the orbit. */
  now: 'now',
  orbitHeading: 'Today’s orbit',
  noEvents: 'Nothing on the agenda today.',
  suggestedBlocks: (p: { blocks: { start: string; title: string }[] }) =>
    `Blocks suggested by the plan: ${p.blocks.map((b) => `${b.start} ${b.title}`).join(', ')}.`,
  planHeading: 'Today’s plan',
  openReview: 'Open review',
  openTyping: 'Open typing',
  stopSave: 'Stop and save',
  startTimer: 'Start the timer',
  planItemAria: (p: { title: string; duration: string; detail: string; action: string }) =>
    `${p.title}, ${p.duration}. ${p.detail} ${p.action}.`,
  running: (p: { elapsed: string }) => `Running, ${p.elapsed}`,
  tapToStop: 'Tap to stop',
}
