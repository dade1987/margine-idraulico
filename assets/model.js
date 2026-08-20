/*
 * Modello economico di "Margine Idraulici".
 *
 * Ogni voce corrisponde a una funzione letta nel codice di gestionale_commesse:
 * `files` punta ai file che la implementano, `state` allo stato verificato — non
 * a quello dedotto dal nome della classe.
 *
 * Tre gruppi, e la separazione non è cosmetica:
 *   - OPERATIVE → entrano nel numero grande;
 *   - CONFIG    → contano solo dopo una configurazione fatta sull'attività;
 *   - FUTURE    → non si sommano a niente, mai.
 *
 * SITUAZIONE DI PARTENZA. Ogni voce ha un `baseline`: quanto di quel beneficio
 * è ancora da prendere, a seconda di cosa la persona usa già. Chi ha un
 * gestionale completo non ha davanti lo stesso recuperabile di chi lavora a
 * memoria, e dirgli di si' sarebbe il modo più rapido di perderlo. I fattori
 * non sono uguali fra loro di proposito: il tempo del rapportino lo azzera
 * qualsiasi gestionale, il confronto a quantita' contro il preventivo quasi
 * nessuno lo fa, ed è li' che resta il margine anche a chi è già attrezzato.
 *
 * Il dettaglio completo sta in docs/analisi-gestionale-commesse.md.
 */

const eur = (n) => Math.round(n);

/*
 * Un'ora risparmiata non è un'ora guadagnata.
 *
 * Diventa soldi solo se la riempi con altro lavoro fatturabile; altrimenti e'
 * comodità, che ha un valore ma non entra in cassa. Meta' è la quota che si
 * riesce a difendere davanti a un artigiano che fa il conto per davvero, e
 * dimezzare da soli le proprie voci è l'unico modo di poter poi chiedere che
 * le altre vengano prese sul serio.
 */
const TEMPO_IN_DENARO = 0.5;

/*
 * Piu' sei strutturato, meno perdi in percentuale: con sei tecnici c'è già
 * qualcuno che fattura, e le percentuali da artigiano solitario non reggono.
 * Non vale per il materiale che si disperde, che al contrario peggiora quando
 * il titolare non è più sul furgone.
 */
function disciplina(tecnici) {
  return 1 / (1 + Math.max(0, tecnici - 1) * 0.12);
}

/** Quanto resta da recuperare, per sistema già in uso. */
const B = (carta, excel, fatture, completo) => ({ carta, excel, fatture, completo });

export const OPERATIVE = [
  {
    id: 'rapportino',
    how: `Invece di scrivere, parli. Finito l'intervento racconti al telefono cos'hai fatto e il rapportino esce già pronto. Tu lo leggi, correggi se serve, e lo chiudi. Il tempo che avanza lo usi per un altro lavoro, o per tornare a casa prima.`,
    tempo: true,
    ramp: 1,
    rampNote: 'dal primo intervento che detti',
    name: 'Il rapportino si scrive da solo',
    plain: 'Racconti a voce cos\'hai fatto. Il rapportino esce già scritto, con i materiali presi dal listino.',
    problem: 'Oggi lo scrivi a mano sul posto, o la sera al computer quando non ricordi più i dettagli.',
    confidence: 'alta',
    baseline: B(1, 0.85, 0.7, 0.2),
    files: [
      'Modules/Interventions/Application/Actions/BuildInterventionReportDraftAction.php',
      'Modules/Interventions/Application/Actions/ApplyInterventionReportDraftAction.php',
      'Modules/AiAssistant/Application/Reports/OpenAiInterventionReportExtractor.php',
      'Modules/Interventions/Filament/Pages/RecordInterventionReportPage.php',
    ],
    formula: 'interventi/anno × (minuti oggi − minuti dettando) ÷ 60 × costo orario',
    compute: (i, d) => {
      const minuti = Math.max(0, i.minutiRapportinoOggi - i.minutiRapportinoDopo);
      return eur(d.interventiAnno * (minuti / 60) * i.costoOrarioAzienda);
    },
    explain: (i, d) => `${d.interventiAnno.toLocaleString('it-IT')} interventi × ${Math.max(0, i.minutiRapportinoOggi - i.minutiRapportinoDopo)} min ÷ 60 × ${i.costoOrarioAzienda} €/h`,
  },
  {
    id: 'firma',
    how: `Giri lo schermo al cliente e lui firma con il dito. Gli arriva subito il PDF sul telefono. Non torni indietro un'altra volta, non scansioni niente, non ti senti dire che non aveva chiesto quel lavoro.`,
    tempo: true,
    ramp: 1,
    rampNote: 'dal primo cliente che firma sullo schermo',
    name: 'Il cliente firma sul telefono, subito',
    plain: 'Firma sullo schermo prima che tu risalga in furgone. Il PDF gli arriva subito.',
    problem: `Il foglio lo devi far firmare, portare in ufficio e scansionare. Se il cliente non c'è, torni.`,
    confidence: 'alta',
    baseline: B(1, 0.95, 0.85, 0.25),
    files: [
      'Modules/Signatures/Application/Actions/StoreSignatureForModelAction.php',
      'Modules/Interventions/Http/Controllers/PublicInterventionReportController.php',
      'Modules/Interventions/Application/Actions/CreateInterventionReportShareLinkAction.php',
    ],
    formula: 'interventi/anno × minuti persi per firma e consegna ÷ 60 × costo orario',
    compute: (i, d) => eur(d.interventiAnno * (i.minutiConsegnaFirma / 60) * i.costoOrarioAzienda),
    explain: (i, d) => `${d.interventiAnno.toLocaleString('it-IT')} interventi × ${i.minutiConsegnaFirma} min ÷ 60 × ${i.costoOrarioAzienda} €/h`,
  },
  {
    id: 'extra',
    how: `Quando chiudi l'intervento ti compare un elenco corto: queste tre cose non erano nel preventivo. Tu decidi se metterle in fattura o regalarle. La differenza è che adesso lo decidi tu, prima succedeva e basta.`,
    ramp: 2,
    rampNote: 'appena gli interventi sono agganciati ai preventivi',
    name: 'Il pezzo fuori preventivo finisce in fattura',
    plain: 'Confronta pezzo per pezzo quello che hai usato con quello che avevi preventivato. Poi ti dice cosa manca.',
    problem: 'Il materiale aggiunto in cantiere lo regali senza deciderlo. Basta che nessuno lo veda riga per riga.',
    confidence: 'alta',
    // Anche un gestionale completo di solito non confronta le quantita' contro
    // il preventivo: guarda se la riga c'e', non quante ne erano previste.
    baseline: B(1, 0.9, 0.8, 0.55),
    files: [
      'Modules/Interventions/Domain/Actions/DetectExtraQuotationMaterialsAction.php',
      'Modules/Interventions/Application/Actions/SyncInterventionExtraMaterialsAction.php',
      'Modules/Interventions/Application/Queries/GetExtraMaterialsRecapQuery.php',
      'app/Filament/Widgets/ExtraMaterialsRecapStats.php',
    ],
    formula: 'interventi/anno × % con extra × valore medio del pezzo × % che oggi non fatturi',
    compute: (i, d) => eur(d.interventiAnno * (i.pctInterventiConExtra / 100) * d.valoreMedioExtra * (i.pctExtraNonFatturato / 100)),
    explain: (i, d) => `${d.interventiAnno.toLocaleString('it-IT')} × ${i.pctInterventiConExtra}% × ${Math.round(d.valoreMedioExtra)} € × ${i.pctExtraNonFatturato}%`,
  },
  {
    id: 'segnalazioni',
    how: `Mentre parli dici anche: ho visto che il boiler perde. Resta scritto sulla scheda di quel cliente. Quando lo richiami fra un mese, il preventivo è già mezzo fatto e sai di cosa stai parlando.`,
    ramp: 6,
    rampNote: 'una segnalazione diventa lavoro col suo giro, non subito',
    name: 'I guasti che vedi non si perdono',
    plain: 'Il difetto che hai visto resta attaccato al cliente. Diventa il tuo preventivo, non il lavoro di un altro.',
    problem: `Lo dici a voce e finisce lì. Fra sei mesi il cliente chiama qualcun altro.`,
    confidence: 'media',
    baseline: B(1, 0.85, 0.75, 0.45),
    files: [
      'Modules/Interventions/Application/Actions/CreateIssueReportAction.php',
      'Modules/Quotations/Domain/Actions/BuildQuotationLinesFromInterventionAction.php',
    ],
    formula: 'interventi/anno × % guasti visti × % oggi persi × % che diventano lavoro × valore × margine',
    compute: (i, d) => eur(
      d.interventiAnno * (i.pctSegnalazioni / 100) * (i.pctSegnalazioniPerse / 100) *
      (i.pctSegnalazioniConvertite / 100) * i.valoreMedioLavoroExtra * (i.marginePct / 100)
    ),
    explain: (i, d) => `${d.interventiAnno.toLocaleString('it-IT')} × ${i.pctSegnalazioni}% × ${i.pctSegnalazioniPerse}% × ${i.pctSegnalazioniConvertite}% × ${i.valoreMedioLavoroExtra} € × ${i.marginePct}%`,
  },
  {
    id: 'preventivo',
    how: `Apri l'intervento e premi un tasto. Il preventivo esce già compilato, con i materiali e le ore che hai usato. Tu sistemi il prezzo e lo mandi. Invece di riscriverlo la sera.`,
    tempo: true,
    ramp: 2,
    rampNote: 'dal primo preventivo che nasce da un intervento',
    name: 'Il preventivo nasce dall\'intervento',
    plain: 'Materiali, ore e diritto di chiamata passano dall\'intervento al preventivo con un tocco. Non ricopi niente.',
    problem: 'Il preventivo lo riscrivi da zero la sera. Ricopiando cose che avevi già scritto.',
    confidence: 'alta',
    baseline: B(1, 0.9, 0.7, 0.3),
    files: [
      'Modules/Quotations/Application/Actions/CreateQuotationFromInterventionAction.php',
      'Modules/Quotations/Domain/Actions/BuildQuotationLinesFromInterventionAction.php',
    ],
    formula: 'preventivi da intervento/anno × minuti risparmiati ÷ 60 × costo orario',
    compute: (i, d) => eur(d.preventiviAnno * (i.minutiPreventivo / 60) * i.costoOrarioAzienda),
    explain: (i, d) => `${Math.round(d.preventiviAnno).toLocaleString('it-IT')} preventivi × ${i.minutiPreventivo} min ÷ 60 × ${i.costoOrarioAzienda} €/h`,
  },
];

export const CONFIG = [
  {
    id: 'furgone',
    how: `Quando carichi il furgone lo segni, ci vogliono dieci secondi. A fine mese vedi tre numeri: cos'è entrato, cos'è stato montato, e cosa manca all'appello. Se manca qualcosa, lo sai subito e non fra un anno.`,
    ramp: 5,
    rampNote: 'prima vanno censiti prodotti e furgoni, e serve un giro di inventario',
    name: 'Il materiale che esce e non torna',
    plain: 'Il furgone diventa un magazzino con un saldo. Quello che carichi, quello che monti, e quello che manca.',
    problem: 'Il materiale esce dal magazzino e non compare in nessun documento. Non è una fattura dimenticata. È roba che non trovi più.',
    confidence: 'bassa',
    baseline: B(1, 0.95, 0.9, 0.5),
    needs: 'Elencare i prodotti, fare un magazzino per ogni furgone, segnare i carichi.',
    files: [
      'Modules/Inventory/Application/Actions/CreateInventoryMovementAction.php',
      'Modules/Inventory/Application/Queries/GetStockSnapshotQuery.php',
      'Modules/Billing/Application/Actions/ReconcileSupplierInvoiceWithDeliveryNotesAction.php',
    ],
    formula: 'materiale acquistato in un anno × % che si disperde',
    // Vale zero finché il quiz non tocca la domanda sul furgone, che compare
    // solo con dei dipendenti: da soli, il furgone è la propria tasca.
    compute: (i) => eur(i.materialeMese * 12 * ((i.pctDispersione || 0) / 100)),
    explain: (i) => `${(i.materialeMese * 12).toLocaleString('it-IT')} € all'anno × ${i.pctDispersione || 0}%`,
  },
  {
    id: 'tariffa',
    how: `Scrivi una volta sola quanto vuoi far pagare un'ora. Da quel momento ogni rapportino esce con le ore già calcolate e già valorizzate. Non devi ricordartene mai più.`,
    ramp: 1,
    rampNote: 'il giorno stesso in cui scrivi il prezzo orario',
    name: 'Le ore vendute al tuo prezzo',
    plain: `Scrivi una volta il tuo prezzo all'ora. Da lì in poi le ore diventano soldi da sole.`,
    problem: 'Finché non scrivi il tuo prezzo all\'ora, il rapportino arriva al cliente con i soli materiali. Le ore escono gratis.',
    confidence: 'alta',
    baseline: B(1, 0.9, 0.7, 0.35),
    needs: 'Scrivere il prezzo all\'ora nelle impostazioni. Un minuto.',
    files: [
      'Modules/Interventions/Domain/Actions/CalculateLabourAmountAction.php',
      'Modules/Interventions/Domain/Actions/ResolveInterventionPricingAction.php',
      'Modules/Interventions/Filament/Pages/LabourTariffSettingsPage.php',
    ],
    formula: 'interventi/anno × ore medie × % ore che oggi non fatturi × prezzo orario',
    compute: (i, d) => eur(d.interventiAnno * d.oreMedieIntervento * (i.pctOreNonFatturate / 100) * i.prezzoOrarioVendita),
    explain: (i, d) => `${d.interventiAnno.toLocaleString('it-IT')} × ${d.oreMedieIntervento.toFixed(1)} h × ${Math.round(i.pctOreNonFatturate)}% × ${i.prezzoOrarioVendita} €/h`,
  },
  {
    id: 'chiamata',
    how: `Metti l'uscita a listino, per esempio 25 €. Ogni rapportino parte già con quella riga dentro. Se vuoi togliere lo sconto lo togli, ma parti da lì invece che da zero.`,
    ramp: 1,
    rampNote: 'il giorno stesso',
    name: 'Il diritto di chiamata, sempre',
    plain: 'L\'uscita ha un prezzo suo e si applica da sola.',
    problem: 'Uscire costa sempre. Ma se non è a listino te lo ricordi a volte sì e a volte no.',
    confidence: 'alta',
    baseline: B(1, 0.95, 0.8, 0.4),
    needs: 'Scrivere l\'importo nelle impostazioni.',
    files: [
      'Modules/Interventions/Application/Settings/InterventionTariffSettings.php',
      'Modules/Interventions/Domain/Actions/ResolveInterventionPricingAction.php',
    ],
    formula: 'interventi/anno × % uscite senza diritto di chiamata × importo',
    compute: (i, d) => eur(d.interventiAnno * (i.pctSenzaDirittoChiamata / 100) * i.dirittoChiamata),
    explain: (i, d) => `${d.interventiAnno.toLocaleString('it-IT')} × ${i.pctSenzaDirittoChiamata}% × ${i.dirittoChiamata} €`,
  },
  {
    id: 'maggiorazioni',
    how: `Dici una volta che dopo le otto di sera e la domenica costa il 30% in più. Poi ci pensa lui: quando fai una chiamata di notte, il conto esce già maggiorato.`,
    ramp: 1,
    rampNote: 'alla prima chiamata fuori orario',
    name: 'Notturno e festivo maggiorati',
    plain: 'La chiamata di domenica sera esce già maggiorata. Non te la devi ricordare.',
    problem: `A te costa più di una del martedì mattina. Ma la fai pagare uguale.`,
    confidence: 'media',
    baseline: B(1, 0.95, 0.85, 0.5),
    needs: 'Impostare le percentuali e l\'orario notturno. I festivi li devi correggere a mano.',
    files: [
      'Modules/Interventions/Domain/Actions/CalculateLabourAmountAction.php',
      'Modules/Interventions/Domain/DTO/LabourTariff.php',
    ],
    formula: 'interventi/anno × % fuori orario × ore medie × prezzo orario × % maggiorazione',
    compute: (i, d) => eur(d.interventiAnno * (i.pctFuoriOrario / 100) * d.oreMedieIntervento * i.prezzoOrarioVendita * (i.maggiorazionePct / 100)),
    explain: (i, d) => `${d.interventiAnno.toLocaleString('it-IT')} × ${i.pctFuoriOrario}% × ${d.oreMedieIntervento.toFixed(1)} h × ${i.prezzoOrarioVendita} € × ${i.maggiorazionePct}%`,
  },
];

export const FUTURE = [
  {
    id: 'whatsapp',
    name: 'I messaggi dei clienti lavorati da soli',
    state: 'Codice completo, canale non attivo',
    problem: `I clienti scrivono su WhatsApp. Qualcuno legge, capisce e riporta a mano. Oppure non lo riporta.`,
    whatExists: `Il giro è scritto per intero. Il messaggio arriva, viene capito, diventa una proposta che tu approvi. Poi l'intervento lo crea lui.`,
    whatMisses: 'Serve un canale WhatsApp Business a pagamento, con numero verificato e approvazione di Meta. Finche\' non c\'e\', nel gestionale non entra nessun messaggio, e non esiste ancora una misura su traffico vero.',
    files: [
      'Modules/WhatsApp/Application/Actions/ProcessWhatsAppMessageAction.php',
      'Modules/AiAssistant/Application/Actions/ExecuteAiActionProposalAction.php',
    ],
    formula: 'minuti al giorno sui messaggi × giorni lavorativi ÷ 60 × costo orario',
    compute: (i) => eur((25 / 60) * 230 * i.costoOrarioAzienda),
    explain: (i) => `25 min × 230 gg ÷ 60 × ${i.costoOrarioAzienda} €/h`,
  },
];

/** Numeri che discendono dalle risposte invece di essere chiesti. */
export function derive(i) {
  const interventiAnno = Math.round(i.tecnici * i.interventiSettimana * i.settimane);
  const preventiviAnno = interventiAnno * (i.pctSegnalazioni / 100);

  // Le risposte possono contraddirsi: venticinque interventi a settimana da un'ora
  // e mezza fanno trentasette ore sul posto, più i viaggi — non ci stanno in una
  // settimana. Le ore per intervento si ricavano dal ritmo dichiarato, contando
  // che circa due terzi della giornata siano davvero sul lavoro.
  const oreDisponibiliSettimana = 40 * 0.65;
  const oreMedieIntervento = Math.max(
    0.4,
    Math.min(i.oreMedieIntervento, oreDisponibiliSettimana / Math.max(1, i.interventiSettimana)),
  );

  // Il valore del pezzo fuori preventivo non si chiede: nessuno lo sa a
  // memoria. Si ricava dal materiale che passa per un intervento — una
  // frazione, perché l'extra è un pezzo, non la fornitura intera.
  const materialePerIntervento = interventiAnno > 0 ? (i.materialeMese * 12) / interventiAnno : 0;
  const valoreMedioExtra = Math.max(15, Math.round(materialePerIntervento * 0.6));

  // Fatturato di riferimento, ricavato da quello che ha già risposto: serve solo
  // come metro per capire se il conto è finito fuori scala.
  const ricavoPerIntervento = oreMedieIntervento * i.prezzoOrarioVendita + materialePerIntervento * 1.35;
  const fatturato = Math.round(interventiAnno * ricavoPerIntervento);

  return { interventiAnno, preventiviAnno, valoreMedioExtra, oreMedieIntervento, fatturato };
}

/** Quanto di quella voce resta da prendere, visto cosa già usi. */
export function baselineFactor(entry, sistema) {
  return entry.baseline?.[sistema] ?? 1;
}

/*
 * Reti di sicurezza sul totale.
 *
 * Anche con formule corrette, moltiplicare percentuali fra loro su migliaia di
 * interventi porta in fretta a cifre che nessuna impresa riconoscerebbe come
 * proprie. Il tetto è espresso in quota del fatturato stimato: oltre quella
 * soglia il conto smette di descrivere un'impresa reale, e un numero che chi
 * legge non riconosce non è ambizioso, è semplicemente falso.
 */
const TETTO_OPERATIVO = 0.09;
const TETTO_CONFIG = 0.12;

export function computeAll(inputs) {
  const d = derive(inputs);
  const sistema = inputs.sistema || 'carta';
  const disc = disciplina(inputs.tecnici);

  // Le percentuali di "quello che si perde" vengono smussate sulle strutture
  // più grandi, dove qualcuno che fattura c'è già.
  const i = {
    ...inputs,
    pctExtraNonFatturato: Math.min(100, inputs.pctExtraNonFatturato) * disc,
    pctOreNonFatturate: Math.min(100, inputs.pctOreNonFatturate) * disc,
    pctSenzaDirittoChiamata: Math.min(100, inputs.pctSenzaDirittoChiamata) * disc,
    pctSegnalazioniPerse: Math.min(100, inputs.pctSegnalazioniPerse) * disc,
  };

  const shape = (entry) => {
    const grezzo = entry.compute(i, d);
    const factor = baselineFactor(entry, sistema);
    const tempo = entry.tempo ? TEMPO_IN_DENARO : 1;
    const raw = grezzo * tempo;
    return { entry, raw, factor, value: Math.round(raw * factor), explain: entry.explain(i, d) };
  };

  const operative = OPERATIVE.map(shape);
  const config = CONFIG.map(shape).filter((r) => r.value > 0);
  const future = FUTURE.map(shape);

  let operativeTotal = operative.reduce((s, r) => s + r.value, 0);
  let configTotal = config.reduce((s, r) => s + r.value, 0);

  // Se il tetto scatta, tutte le voci scendono in proporzione: alterarne una
  // sola cambierebbe il racconto di dove stanno i soldi.
  const capOp = Math.round(d.fatturato * TETTO_OPERATIVO);
  const cappedOperative = operativeTotal > capOp && capOp > 0;
  if (cappedOperative) {
    const k = capOp / operativeTotal;
    operative.forEach((r) => { r.value = Math.round(r.value * k); });
    operativeTotal = operative.reduce((s, r) => s + r.value, 0);
  }

  const capCfg = Math.round(d.fatturato * TETTO_CONFIG);
  if (configTotal > capCfg && capCfg > 0) {
    const k = capCfg / configTotal;
    config.forEach((r) => { r.value = Math.round(r.value * k); });
    configTotal = config.reduce((s, r) => s + r.value, 0);
  }

  // Il primo anno non rende come quelli dopo: una voce che parte al sesto mese
  // ne frutta sei, non dodici. Dire il totale a regime senza dire questo
  // sarebbe la parte disonesta del conto.
  const firstYear = operative.reduce(
    (s, r) => s + Math.round(r.value * Math.max(0, 12 - (r.entry.ramp ?? 1)) / 12),
    0,
  );

  return { derived: d, operative, config, future, operativeTotal, configTotal, firstYear, cappedOperative, disciplina: disc };
}
