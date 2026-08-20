/*
 * Le domande.
 *
 * Regola che tiene in piedi tutto il progetto: nessun numero viene mostrato
 * prima che l'idraulico abbia risposto. Un importo affermato all'ingresso e'
 * una promessa di chi vende; lo stesso importo che esce da dieci risposte sue
 * è una conclusione sua, e non si può liquidare come una sparata.
 *
 * Ogni opzione porta un `set` (valori che scrive) e a volte un `bump` (valori
 * che somma a quelli già presenti). Le due cose sono separate perché certe
 * risposte non definiscono un parametro, lo peggiorano: chi non fa il
 * rapportino non ci perde tempo, ma perde molto di più altrove.
 */

/** Dal meno al piu' attrezzato: se ne seleziona piu' d'uno, vince l'ultimo. */
export const SCALA_SISTEMI = ['carta', 'excel', 'fatture', 'completo'];

export const SISTEMI = {
  carta: 'carta, memoria e WhatsApp',
  excel: 'Excel o note sul telefono',
  fatture: 'un gestionale, ma solo per fatturare',
  completo: 'un gestionale completo, rapportini compresi',
};

export const QUESTIONS = [
  {
    id: 'sistema',
    multi: true,
    eyebrow: 'Partiamo da dove sei',
    text: 'Oggi come tieni traccia del lavoro?',
    help: 'Se una cosa la fai già, poi te la tolgo dal conto.',
    options: [
      { label: 'Carta, memoria e WhatsApp', note: 'Funziona, finché sei piccolo', set: { sistema: 'carta' }, reaction: 'Onesto. Come quasi tutti.' },
      { label: 'Excel o note sul telefono', note: 'Meglio. Ma lo aggiorni tu', set: { sistema: 'excel' }, reaction: 'Meglio della carta. Ma il file lo tieni su tu.' },
      { label: 'Un gestionale, ma lo uso per fatturare', note: 'Il cantiere resta fuori', set: { sistema: 'fatture' }, reaction: 'Le fatture sono a posto. E prima?' },
      { label: 'Un gestionale completo, rapportini compresi', note: 'Sei avanti', set: { sistema: 'completo' }, reaction: 'Bene. Allora ti restera poco da recuperare, e te lo diro.' },
    ],
  },
  {
    id: 'tecnici',
    eyebrow: 'La squadra',
    text: 'Quanti siete a uscire sugli interventi?',
    help: 'Conta anche te, se esci in furgone.',
    options: [
      { label: 'Solo io', set: { tecnici: 1, costoOrarioAzienda: 29 }, reaction: 'Ogni ora in ufficio è un\'ora tolta al lavoro.' },
      { label: 'Siamo in due', set: { tecnici: 2, costoOrarioAzienda: 31 }, reaction: null },
      { label: 'Tre o quattro', set: { tecnici: 3.5, costoOrarioAzienda: 33 }, reaction: 'Da qui in poi, quello che non è scritto non esiste.' },
      { label: 'Cinque o più', set: { tecnici: 6, costoOrarioAzienda: 34 }, reaction: 'Con una squadra così serve ordine.' },
    ],
  },
  {
    id: 'interventiSettimana',
    eyebrow: 'Il ritmo',
    text: 'In una settimana normale, quanti interventi fai per persona?',
    help: 'Chiamate, manutenzioni, sopralluoghi.',
    options: [
      { label: 'Meno di dieci', note: 'Pochi lavori, ma lunghi', set: { interventiSettimana: 8 } },
      { label: 'Una decina', set: { interventiSettimana: 12 } },
      { label: 'Una ventina', set: { interventiSettimana: 20 } },
      { label: 'Venticinque o più', note: 'Assistenza e pronto intervento', set: { interventiSettimana: 25 }, reaction: 'A questo ritmo un minuto vale una settimana all\'anno.' },
    ],
  },
  {
    id: 'rapportino',
    multi: true,
    eyebrow: 'Il rapportino',
    text: 'Il rapportino di fine intervento, come lo fai?',
    options: [
      { label: 'A mano sul foglio, sul posto', set: { minutiRapportinoOggi: 10 } },
      { label: 'La sera al computer', note: 'A mente fredda', set: { minutiRapportinoOggi: 14 }, reaction: 'Alle nove di sera non ti ricordi le nove di mattina.' },
      { label: 'Lo detto a qualcuno in ufficio', set: { minutiRapportinoOggi: 12 } },
      {
        label: 'Quasi mai, vado a memoria',
        note: 'Fatturi quel che ricordi',
        set: { minutiRapportinoOggi: 3 },
        // Non fare il rapportino fa risparmiare minuti e costa molto altrove:
        // il pezzo montato e il guasto visto non li ricorda nessuno.
        bump: { pctExtraNonFatturato: 15, pctSegnalazioniPerse: 15, pctOreNonFatturate: 8 },
        reaction: 'Il tempo non lo perdi lì. Lo perdi dopo.',
      },
    ],
  },
  {
    id: 'firma',
    multi: true,
    eyebrow: 'La firma',
    text: 'Il cliente come ti firma il lavoro?',
    help: 'Faccio una media. Anche chi torna non torna sempre.',
    options: [
      { label: 'Firma il foglio, poi lo porto in ufficio', set: { minutiConsegnaFirma: 4 } },
      { label: 'Gli mando tutto dopo, per mail o WhatsApp', set: { minutiConsegnaFirma: 6 } },
      { label: 'Devo tornare apposta a farlo firmare', set: { minutiConsegnaFirma: 9 }, reaction: 'Un viaggio per una firma è il lavoro più caro che fai.' },
      { label: 'Non faccio firmare niente', note: 'Ci si fida', set: { minutiConsegnaFirma: 2 }, reaction: 'Funziona. Fino a quello che dice di non aver chiesto niente.' },
    ],
  },
  {
    id: 'materialeMese',
    eyebrow: 'Il materiale',
    text: 'Quanto spendi di materiale in un mese?',
    help: 'A occhio, quello che ti fatturano i fornitori.',
    options: [
      { label: 'Meno di 1.000 €', set: { materialeMese: 800 } },
      { label: 'Fra 1.000 e 3.000 €', set: { materialeMese: 2000 } },
      { label: 'Fra 3.000 e 8.000 €', set: { materialeMese: 5000 } },
      { label: 'Piu di 8.000 €', set: { materialeMese: 12000 } },
    ],
  },
  {
    id: 'fuoriPreventivo',
    eyebrow: 'Il pezzo in più',
    text: 'Ti capita di montare roba che non era nel preventivo?',
    options: [
      { label: 'Praticamente mai', set: { pctInterventiConExtra: 8 } },
      { label: 'Ogni tanto', set: { pctInterventiConExtra: 20 } },
      { label: 'Spesso, e la norma', set: { pctInterventiConExtra: 35 }, reaction: 'Quindi un lavoro su tre finisce diverso dal preventivo.' },
      { label: 'Quasi sempre, si lavora così', set: { pctInterventiConExtra: 50 }, reaction: 'Allora il preventivo è una base, non un contratto.' },
    ],
  },
  {
    id: 'extraFatturato',
    eyebrow: 'Il pezzo in più',
    text: 'Quel materiale in più, finisce in fattura?',
    help: 'Rispondi sincero. Qui non ti legge nessuno.',
    options: [
      { label: 'Sempre, lo segno subito', set: { pctExtraNonFatturato: 12 }, reaction: 'Sei fra i pochi. Sul serio.' },
      { label: 'Quasi sempre', set: { pctExtraNonFatturato: 28 } },
      { label: 'Se me lo ricordo', set: { pctExtraNonFatturato: 50 }, reaction: 'Ed e proprio questa la riga che pesa di più, alla fine.' },
      { label: 'Quasi mai, lascio andare', note: 'Tanto è poca roba', set: { pctExtraNonFatturato: 75 }, reaction: 'Poca roba per volta. Poi la moltiplichi per un anno.' },
    ],
  },
  {
    id: 'segnalazioni',
    multi: true,
    eyebrow: 'I guasti che vedi',
    text: 'Quando noti un altro problema che non risolvi sul momento?',
    options: [
      { label: 'Faccio subito il preventivo', set: { pctSegnalazioni: 15, pctSegnalazioniPerse: 15 }, reaction: 'Bravo. È il lavoro che costa meno da trovare.' },
      { label: 'Lo dico al cliente e basta', set: { pctSegnalazioni: 18, pctSegnalazioniPerse: 70 }, reaction: 'E fra sei mesi chiama un altro.' },
      { label: 'Me lo segno da qualche parte', set: { pctSegnalazioni: 15, pctSegnalazioniPerse: 45 } },
      { label: 'Capita di rado', set: { pctSegnalazioni: 6, pctSegnalazioniPerse: 50 } },
    ],
  },
  {
    id: 'manodopera',
    multi: true,
    eyebrow: 'Le ore',
    text: 'La manodopera come la metti in conto?',
    options: [
      { label: 'Prezzo orario fisso, sempre', set: { prezzoOrarioVendita: 48, pctOreNonFatturate: 8, pctSenzaDirittoChiamata: 35 } },
      { label: 'A occhio, sul totale del lavoro', set: { prezzoOrarioVendita: 45, pctOreNonFatturate: 28, pctSenzaDirittoChiamata: 45 }, reaction: 'Se il totale sembra alto, le prime a scendere sono le ore.' },
      { label: 'La sconto per chiudere il lavoro', set: { prezzoOrarioVendita: 45, pctOreNonFatturate: 30, pctSenzaDirittoChiamata: 50 }, reaction: 'Il materiale non lo sconti mai. Le tue ore sì.' },
      { label: 'Ore più diritto di chiamata', set: { prezzoOrarioVendita: 55, pctOreNonFatturate: 6, pctSenzaDirittoChiamata: 10 }, reaction: 'Hai già il pezzo che agli altri manca.' },
    ],
  },
  {
    id: 'furgone',
    eyebrow: 'Il furgone',
    text: 'Sai cosa c\'e adesso nel furgone dei tuoi?',
    help: 'Non il magazzino. Proprio il furgone, adesso.',
    // Ha senso solo con dei dipendenti: da solo, il furgone è la tua tasca.
    onlyIf: (a) => (a.tecnici ?? 1) > 1,
    options: [
      { label: 'Si, c\'e una lista aggiornata', set: { pctDispersione: 0.5 }, reaction: 'Raro. Vuol dire che qualcuno se ne occupa.' },
      { label: 'Piu o meno, a memoria', set: { pctDispersione: 2 } },
      { label: 'No, e ogni tanto sparisce roba', set: { pctDispersione: 5 }, reaction: 'Questa risposta pesa più di tutte le altre.' },
      { label: 'Non ci ho mai pensato', set: { pctDispersione: 3 }, reaction: 'Ci pensiamo adesso.' },
    ],
  },
];

/** Valori di partenza: quello che il quiz non chiede, per non farlo lungo. */
export const DEFAULTS = {
  sistema: 'carta',
  tecnici: 2,
  interventiSettimana: 18,
  settimane: 46,
  costoOrarioAzienda: 30,
  prezzoOrarioVendita: 45,
  minutiRapportinoOggi: 12,
  minutiRapportinoDopo: 3,
  minutiConsegnaFirma: 8,
  minutiPreventivo: 18,
  materialeMese: 2000,
  pctInterventiConExtra: 25,
  pctExtraNonFatturato: 40,
  pctSegnalazioni: 15,
  pctSegnalazioniPerse: 60,
  pctSegnalazioniConvertite: 25,
  valoreMedioLavoroExtra: 400,
  marginePct: 30,
  oreMedieIntervento: 1.5,
  pctOreNonFatturate: 12,
  dirittoChiamata: 25,
  pctSenzaDirittoChiamata: 35,
  pctFuoriOrario: 8,
  maggiorazionePct: 30,
  pctDispersione: 0,
};
