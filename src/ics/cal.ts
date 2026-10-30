// Aiuto per i test: avvolge dei VEVENT in un calendario inventato.
export const cal = (...events: string[][]): string =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events.flatMap((e) => ['BEGIN:VEVENT', ...e, 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n')
