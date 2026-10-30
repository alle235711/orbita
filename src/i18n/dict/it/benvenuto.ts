import type { Format } from '../../format/types'

// Il percorso guidato del primo avvio (e di "Completa il profilo").

export const benvenuto = {
  progress: 'Avanzamento',
  stepOf: (p: { n: number; total: number }) => `${p.n} di ${p.total}`,
  announce: (p: { n: number; total: number; title: string }) => `Passo ${p.n} di ${p.total}: ${p.title}`,
  back: 'Indietro',
  next: 'Avanti',
  finish: 'Fine',
  close: 'Chiudi',
  saving: 'Salvo…',
  errRange: 'Il valore è fuori dai limiti.',
  errCfuTotal: 'Scrivi un numero intero di crediti, da 1 a 600.',
  errCfuExam: 'Scrivi un numero intero di crediti, da 1 a 60.',
  errHours: 'Scrivi le ore al giorno, da 1 a 12.',

  step1: {
    titleA: 'Benvenuto',
    titleB: 'a bordo',
    lead: 'Due cose per cominciare. Tutto resta su questo dispositivo e funziona anche senza rete.',
    name: 'Come ti chiami',
    namePlaceholder: 'Facoltativo',
    language: 'Lingua',
    restore: 'Ripristina un backup',
    restoreHint: 'Hai già un backup di Orbita? Riprendi da lì.',
    restored: (p: { added: number }, f: Format) => `Backup ripristinato: ${f.count(p.added, 'record nuovo', 'record nuovi')}.`,
  },
  step2: {
    titleA: 'Il tuo',
    titleB: 'percorso',
    lead: 'Ateneo e corso di laurea servono solo a dare un nome alle cose. Puoi lasciare vuoto.',
  },
  step3: {
    titleA: 'I tuoi',
    titleB: 'esami',
    lead: 'Aggiungi gli esami che ti aspettano. Se non conosci il giorno, basta il mese.',
    exam: (p: { n: number }) => `Esame ${p.n}`,
    date: 'Data o mese',
    cfuPlaceholder: 'es. 6',
    remove: (p: { name: string }) => `Togli ${p.name}`,
    removeUnnamed: 'Togli la riga',
    add: 'Aggiungi un esame',
    empty: 'Nessun esame per ora: puoi aggiungerli anche dopo, da Dati.',
  },
  offer: {
    title: 'Mazzi d’esempio',
    lead: 'Ho trovato schede d’esempio che sembrano adatte. Le importo solo se le scegli.',
    item: (p: { deck: string; exam: string }) => `Mazzo d’esempio: «${p.deck}» per «${p.exam}»`,
    cards: (p: { n: number }, f: Format) => f.count(p.n, 'scheda', 'schede'),
  },
  step4: {
    titleA: 'Scegli',
    titleB: 'i moduli',
    lead: 'Accendi quello che usi davvero. Potrai cambiarli quando vuoi, da Dati.',
  },
  step5: {
    titleA: 'La tua',
    titleB: 'giornata',
    lead: 'Quanto studi di solito e come li vuoi i blocchi di studio.',
    hours: 'Ore di studio e lavoro al giorno',
    preset: 'Blocco di studio',
    presetHint: (p: { preset: string }) => `Quando l’energia è bassa i blocchi si accorciano: ${p.preset}.`,
    days: 'Giorni nell’altra lingua',
    daysHint: 'Al massimo tre giorni della settimana.',
  },
  complete: {
    close: 'Chiudi senza salvare',
  },
}
