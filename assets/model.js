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
    tempo: true,
    ramp: 1,
    rampNote: 'dal primo intervento che detti',
    name: 'Il rapportino si scrive da solo',
    plain: 'Racconti a voce cos\'hai fatto e il rapportino esce già scritto, con i materiali agganciati al listino.',
    problem: 'Oggi lo compili a mano sul posto o la sera al computer, quando i dettagli sono già sbiaditi.',
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
    tempo: true,
    ramp: 1,
    rampNote: 'dal primo cliente che firma sullo schermo',
    name: 'Il cliente firma sul telefono, subito',
    plain: 'Firma sullo schermo prima che tu risalga in furgone, e riceve il PDF nello stesso momento.',
    problem: 'Il foglio va fatto firmare, portato in ufficio, scansionato. Se il cliente non c\'e\', si torna.',
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
    ramp: 2,
    rampNote: 'appena gli interventi sono agganciati ai preventivi',
    name: 'Il pezzo fuori preventivo finisce in fattura',
    plain: 'Confronta pezzo per pezzo quello che hai usato con quello che avevi preventivato, e ti dice cosa manca.',
    problem: 'Se nessuno lo intercetta riga per riga, il materiale aggiunto in cantiere viene regalato senza che nessuno decida di regalarlo.',
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
    ramp: 6,
    rampNote: 'una segnalazione diventa lavoro col suo giro, non subito',
    name: 'I guasti che vedi non si perdono',
    plain: 'Il difetto notato e non risolto resta agganciato al cliente, e diventa il preventivo di domani invece del lavoro di un altro.',
    problem: 'Lo dici a voce e finisce li\'. Fra sei mesi il cliente chiama, e chiama qualcun altro.',
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
    tempo: true,
    ramp: 2,
    rampNote: 'dal primo preventivo che nasce da un intervento',
    name: 'Il preventivo nasce dall\'intervento',
    plain: 'Materiali, ore e diritto di chiamata passano dall\'intervento al preventivo con un tocco, senza ricopiare niente.',
    problem: 'Il preventivo del lavoro visto in cantiere lo riscrivi da zero la sera, ricopiando cose già annotate.',
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
    ramp: 5,
    rampNote: 'prima vanno censiti prodotti e furgoni, e serve un giro di inventario',
    name: 'Il materiale che esce e non torna',
    plain: 'Il furgone diventa un magazzino con un suo saldo: quello che carichi, quello che monti, e la differenza che resta.',
    problem: 'Il materiale esce dal magazzino, sale sul furgone e non compare in nessun documento. Non è una dimenticanza di fatturazione: è roba che non trovi più.',
    confidence: 'bassa',
    baseline: B(1, 0.95, 0.9, 0.5),
    needs: 'Censire i prodotti, creare un magazzino per ogni furgone e registrare i carichi.',
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
    ramp: 1,
    rampNote: 'il giorno stesso in cui scrivi il prezzo orario',
    name: 'Le ore vendute al tuo prezzo',
    plain: 'Metti una volta il tuo prezzo orario e da li\' in poi le ore del rapportino diventano un importo da sole.',
    problem: 'Il gestionale nasce senza un prezzo orario: finché non lo scrivi, il rapportino arriva al cliente con i soli materiali e le ore escono gratis.',
    confidence: 'alta',
    baseline: B(1, 0.9, 0.7, 0.35),
    needs: 'Inserire il prezzo orario in Impostazioni → Tariffa manodopera.',
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
    ramp: 1,
    rampNote: 'il giorno stesso',
    name: 'Il diritto di chiamata, sempre',
    plain: 'L\'uscita ha un prezzo a listino e si applica da sola, invece che quando ci si ricorda.',
    problem: 'Uscire costa comunque, ma se non è a listino te lo ricordi solo quando ti va bene.',
    confidence: 'alta',
    baseline: B(1, 0.95, 0.8, 0.4),
    needs: 'Inserire l\'importo nella stessa pagina della tariffa.',
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
    ramp: 1,
    rampNote: 'alla prima chiamata fuori orario',
    name: 'Notturno e festivo maggiorati',
    plain: 'La chiamata di domenica sera esce con la sua maggiorazione senza che tu debba ricordartene.',
    problem: 'Costa a te più di una del martedi\' mattina, ma esce dalla stessa tariffa.',
    confidence: 'media',
    baseline: B(1, 0.95, 0.85, 0.5),
    needs: 'Percentuali e fascia notturna da impostare. I festivi del calendario non sono riconosciuti: vanno corretti a mano.',
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
    problem: 'I clienti scrivono su WhatsApp. Qualcuno legge, capisce e riporta a mano — o non lo riporta.',
    whatExists: 'Il giro è scritto per intero e coperto da test: messaggio ricevuto, capito, trasformato in una proposta che tu approvi, ed eseguita davvero — l\'intervento lo crea lui.',
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
