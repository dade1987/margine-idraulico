/*
 * Modello economico di "Margine Idraulici".
 *
 * Ogni voce qui dentro corrisponde a una funzione che è stata letta nel codice
 * di gestionale_commesse: i campi `files` puntano ai file che la implementano e
 * `state` riporta lo stato verificato, non quello dedotto dal nome della classe.
 *
 * La separazione in tre gruppi non è cosmetica:
 *   - operative  → entrano nel risultato economico principale;
 *   - config     → contano solo dopo una configurazione fatta sull'attività;
 *   - future     → non si sommano a niente, mai.
 *
 * Il dettaglio completo, con stato e livello di confidenza per ogni voce, sta
 * in docs/analisi-gestionale-commesse.md.
 */

export const INPUTS = [
  {
    group: 'La tua attività',
    items: [
      { id: 'tecnici', label: 'Tecnici che fanno interventi', hint: 'Titolare compreso, se esce anche lui.', value: 2, min: 1, max: 200, step: 1 },
      { id: 'interventiSettimana', label: 'Interventi a settimana per tecnico', hint: 'Chiamate, manutenzioni, sopralluoghi.', value: 18, min: 1, max: 100, step: 1 },
      { id: 'settimane', label: 'Settimane lavorate all\'anno', hint: 'Tolte ferie e chiusure.', value: 46, min: 1, max: 52, step: 1 },
      { id: 'costoOrarioAzienda', label: 'Costo orario del tecnico (€)', hint: 'Costo pieno per te: paga, contributi, furgone. Non il prezzo di vendita.', value: 30, min: 0, max: 300, step: 1 },
      { id: 'prezzoOrarioVendita', label: 'Prezzo orario di vendita (€)', hint: 'Quello che metti in fattura per un\'ora di manodopera.', value: 40, min: 0, max: 400, step: 1 },
    ],
  },
  {
    group: 'Come lavori adesso',
    items: [
      { id: 'minutiRapportinoOggi', label: 'Minuti per scrivere un rapportino oggi', hint: 'A mano sul foglio, o la sera al computer.', value: 12, min: 0, max: 180, step: 1 },
      { id: 'minutiRapportinoDopo', label: 'Minuti per dettarlo e confermarlo', hint: 'Racconto a voce più la rilettura della bozza.', value: 3, min: 0, max: 180, step: 1 },
      { id: 'minutiConsegnaFirma', label: 'Minuti persi per firma e consegna', hint: 'Ritorni, scansioni, copie da portare in ufficio.', value: 7, min: 0, max: 180, step: 1 },
      { id: 'minutiPreventivo', label: 'Minuti per rifare a tavolino un preventivo già visto', hint: 'Ricopiare misure e materiali dell\'intervento.', value: 20, min: 0, max: 240, step: 1 },
    ],
  },
  {
    group: 'Quello che oggi si perde per strada',
    items: [
      { id: 'pctInterventiConExtra', label: 'Interventi con materiale non preventivato (%)', hint: 'Il pezzo in più tirato fuori dal furgone.', value: 25, min: 0, max: 100, step: 1 },
      { id: 'valoreMedioExtra', label: 'Valore medio di quel materiale (€)', hint: 'Prezzo di vendita, per intervento interessato.', value: 45, min: 0, max: 5000, step: 1 },
      { id: 'pctExtraNonFatturato', label: 'Quota che oggi non arriva in fattura (%)', hint: 'Dimenticata, regalata, o persa nel foglio.', value: 40, min: 0, max: 100, step: 1 },
      { id: 'pctSegnalazioni', label: 'Interventi in cui vedi un altro guasto (%)', hint: 'Il difetto notato ma non risolto sul momento.', value: 15, min: 0, max: 100, step: 1 },
      { id: 'pctSegnalazioniPerse', label: 'Quota di quelle che oggi si perde (%)', hint: 'Nessuno le riprende, e diventano il lavoro di un altro.', value: 60, min: 0, max: 100, step: 1 },
      { id: 'pctSegnalazioniConvertite', label: 'Quota che diventerebbe lavoro (%)', hint: 'Di quelle recuperate, quelle che il cliente approva.', value: 25, min: 0, max: 100, step: 1 },
      { id: 'valoreMedioLavoroExtra', label: 'Valore medio di quel lavoro (€)', hint: 'Importo del preventivo che ne esce.', value: 400, min: 0, max: 100000, step: 10 },
      { id: 'marginePct', label: 'Il tuo margine su un lavoro (%)', hint: 'Quanto resta dopo materiale e ore.', value: 30, min: 0, max: 100, step: 1 },
    ],
  },
  {
    group: 'Solo per la sezione da configurare',
    items: [
      { id: 'oreMedieIntervento', label: 'Ore medie di un intervento', hint: 'Tempo davvero passato sul posto.', value: 1.5, min: 0, max: 24, step: 0.25 },
      { id: 'pctOreNonFatturate', label: 'Ore che oggi non arrivano in fattura (%)', hint: 'Arrotondate per difetto, o non registrate.', value: 12, min: 0, max: 100, step: 1 },
      { id: 'dirittoChiamata', label: 'Diritto di chiamata / trasferta (€)', hint: 'Quello che vorresti applicare.', value: 25, min: 0, max: 1000, step: 1 },
      { id: 'pctSenzaDirittoChiamata', label: 'Uscite in cui oggi non lo applichi (%)', hint: 'Per dimenticanza o perché non è a listino.', value: 35, min: 0, max: 100, step: 1 },
      { id: 'pctFuoriOrario', label: 'Interventi fuori orario o nel weekend (%)', hint: 'Notte, sabato, domenica.', value: 8, min: 0, max: 100, step: 1 },
      { id: 'maggiorazionePct', label: 'Maggiorazione che applicheresti (%)', hint: 'Sul prezzo orario, fuori orario.', value: 30, min: 0, max: 200, step: 5 },
      { id: 'caldaieInManutenzione', label: 'Caldaie in manutenzione periodica', hint: 'Impianti che segui tu, anche solo a memoria.', value: 120, min: 0, max: 100000, step: 10 },
      { id: 'pctManutenzioniPerse', label: 'Scadenze che ogni anno ti sfuggono (%)', hint: 'Il cliente non chiama e nessuno se ne accorge.', value: 15, min: 0, max: 100, step: 1 },
      { id: 'prezzoManutenzione', label: 'Prezzo di una manutenzione (€)', hint: 'Compresi eventuali fumi e bollino.', value: 90, min: 0, max: 5000, step: 5 },
      { id: 'giorniIncassoOggi', label: 'Giorni medi per incassare', hint: 'Dalla fine del lavoro al bonifico.', value: 45, min: 0, max: 365, step: 1 },
      { id: 'pctIncassabileSubito', label: 'Interventi incassabili sul posto (%)', hint: 'Privati e piccole riparazioni, non i cantieri.', value: 30, min: 0, max: 100, step: 1 },
      { id: 'costoDenaroPct', label: 'Costo del denaro all\'anno (%)', hint: 'Quanto ti costa il fido o l\'anticipo fatture.', value: 8, min: 0, max: 50, step: 0.5 },
    ],
  },
  {
    group: 'Solo per il beneficio futuro',
    items: [
      { id: 'minutiWhatsAppGiorno', label: 'Minuti al giorno su messaggi dei clienti', hint: 'Leggerli, capirli, riportarli su commessa.', value: 25, min: 0, max: 600, step: 5 },
      { id: 'giorniLavorativi', label: 'Giorni lavorativi all\'anno', hint: 'Per il conto dei messaggi.', value: 230, min: 1, max: 366, step: 1 },
    ],
  },
];

const eur = (n) => Math.round(n);

/**
 * Voci che entrano nel risultato principale.
 *
 * Criterio di ammissione, applicato una voce alla volta: il flusso completo è
 * presente nel codice, ha test che lo coprono, e produce il suo effetto usando
 * solo i dati che l'idraulico inserisce già lavorando — nessun account esterno
 * da attivare, nessuna anagrafica da costruire prima.
 */
export const OPERATIVE = [
  {
    id: 'rapportino',
    name: 'Rapportino dettato invece che scritto',
    problem: 'Il rapportino si compila a fine giornata, quando i dettagli sono già sbiaditi, oppure a mano sul posto mentre il cliente aspetta.',
    impact: 'Minuti di tecnico risparmiati su ogni intervento, valorizzati al costo aziendale.',
    confidence: 'alta',
    confidenceWhy: 'Flusso completo e coperto da test; il tempo risparmiato dipende però da come scrivi oggi.',
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
    explain: (i, d) => {
      const minuti = Math.max(0, i.minutiRapportinoOggi - i.minutiRapportinoDopo);
      return `${d.interventiAnno.toLocaleString('it-IT')} interventi × ${minuti} min ÷ 60 × ${i.costoOrarioAzienda} €/h`;
    },
  },
  {
    id: 'firma',
    name: 'Firma del cliente sul telefono, subito',
    problem: 'Il foglio va fatto firmare, portato in ufficio, scansionato. Se il cliente non c\'è, si torna.',
    impact: 'Il giro di ritorno sparisce: il rapportino è già firmato e consegnato prima di risalire in furgone.',
    confidence: 'alta',
    confidenceWhy: 'Link pubblico, firma e PDF esistono e sono testati; quanto tempo ti fanno risparmiare dipende dai tuoi giri.',
    files: [
      'Modules/Signatures/Application/Actions/StoreSignatureForModelAction.php',
      'Modules/Interventions/Http/Controllers/PublicInterventionReportController.php',
      'Modules/Interventions/Application/Actions/CreateInterventionReportShareLinkAction.php',
      'Modules/Interventions/Application/Actions/GenerateInterventionReportPdfAction.php',
    ],
    formula: 'interventi/anno × minuti persi per firma e consegna ÷ 60 × costo orario',
    compute: (i, d) => eur(d.interventiAnno * (i.minutiConsegnaFirma / 60) * i.costoOrarioAzienda),
    explain: (i, d) => `${d.interventiAnno.toLocaleString('it-IT')} interventi × ${i.minutiConsegnaFirma} min ÷ 60 × ${i.costoOrarioAzienda} €/h`,
  },
  {
    id: 'extra',
    name: 'Materiale fuori preventivo che finisce in fattura',
    problem: 'Il pezzo aggiunto in cantiere non è nel preventivo. Se nessuno lo intercetta riga per riga, viene regalato.',
    impact: 'Ricavo che oggi esce dal furgone e non rientra da nessuna parte. È la voce più grossa, e anche la più verificabile.',
    confidence: 'alta',
    confidenceWhy: 'Il confronto è per quantità contro il preventivo vero, non per presenza della riga; c\'è già una dashboard che lo misura a consuntivo.',
    files: [
      'Modules/Interventions/Domain/Actions/DetectExtraQuotationMaterialsAction.php',
      'Modules/Interventions/Application/Actions/SyncInterventionExtraMaterialsAction.php',
      'Modules/Interventions/Application/Queries/GetExtraMaterialsRecapQuery.php',
      'app/Filament/Widgets/ExtraMaterialsRecapStats.php',
    ],
    formula: 'interventi/anno × % con extra × valore medio × % oggi non fatturata',
    compute: (i, d) => eur(d.interventiAnno * (i.pctInterventiConExtra / 100) * i.valoreMedioExtra * (i.pctExtraNonFatturato / 100)),
    explain: (i, d) => `${d.interventiAnno.toLocaleString('it-IT')} × ${i.pctInterventiConExtra}% × ${i.valoreMedioExtra} € × ${i.pctExtraNonFatturato}%`,
  },
  {
    id: 'segnalazioni',
    name: 'Guasti visti e non persi',
    problem: 'Il tecnico nota un secondo difetto, lo dice a voce e finisce lì. Il lavoro lo fa qualcun altro, sei mesi dopo.',
    impact: 'Margine sui lavori che nascono da segnalazioni oggi dimenticate.',
    confidence: 'media',
    confidenceWhy: 'La registrazione della segnalazione è certa e testata; quante diventino lavoro è una tua stima, non un dato del gestionale.',
    files: [
      'Modules/Interventions/Application/Actions/CreateIssueReportAction.php',
      'Modules/Interventions/Infrastructure/Models/IssueReport.php',
      'Modules/Quotations/Domain/Actions/BuildQuotationLinesFromInterventionAction.php',
    ],
    formula: 'interventi/anno × % guasti visti × % oggi persi × % che diventano lavoro × valore × margine',
    compute: (i, d) => eur(
      d.interventiAnno *
      (i.pctSegnalazioni / 100) *
      (i.pctSegnalazioniPerse / 100) *
      (i.pctSegnalazioniConvertite / 100) *
      i.valoreMedioLavoroExtra *
      (i.marginePct / 100)
    ),
    explain: (i, d) => `${d.interventiAnno.toLocaleString('it-IT')} × ${i.pctSegnalazioni}% × ${i.pctSegnalazioniPerse}% × ${i.pctSegnalazioniConvertite}% × ${i.valoreMedioLavoroExtra} € × ${i.marginePct}%`,
  },
  {
    id: 'preventivo',
    name: 'Preventivo generato dall\'intervento',
    problem: 'Il preventivo per il lavoro visto in cantiere si riscrive da zero la sera, ricopiando misure e materiali già annotati.',
    impact: 'Tempo di ufficio risparmiato su ogni preventivo che nasce da un intervento.',
    confidence: 'alta',
    confidenceWhy: 'Righe, manodopera e diritto di chiamata passano dall\'intervento al preventivo con un\'azione sola, testata.',
    files: [
      'Modules/Quotations/Application/Actions/CreateQuotationFromInterventionAction.php',
      'Modules/Quotations/Domain/Actions/BuildQuotationLinesFromInterventionAction.php',
    ],
    formula: 'preventivi da intervento/anno × minuti risparmiati ÷ 60 × costo orario',
    compute: (i, d) => eur(d.preventiviAnno * (i.minutiPreventivo / 60) * i.costoOrarioAzienda),
    explain: (i, d) => `${Math.round(d.preventiviAnno).toLocaleString('it-IT')} preventivi × ${i.minutiPreventivo} min ÷ 60 × ${i.costoOrarioAzienda} €/h`,
  },
];

/**
 * Voci che il pannello sa già fare, ma che restano a zero finché qualcuno non
 * inserisce i tuoi numeri o non collega il tuo account.
 *
 * Non sono promesse: sono campi che nel codice partono a zero per scelta, e a
 * zero restano. La tariffa oraria di vendita è l'esempio da manuale — la colonna
 * esiste da mesi, ma senza un prezzo configurato le ore continuano a uscire
 * gratis dal rapportino.
 */
export const CONFIG = [
  {
    id: 'tariffa',
    name: 'Tariffa oraria di vendita della manodopera',
    problem: 'Il rapportino arriva al cliente con i soli materiali, perché nel gestionale non esiste ancora un prezzo orario. Le ore vengono regalate senza che nessuno decida di regalarle.',
    impact: 'Ore lavorate che oggi non arrivano in fattura, vendute al tuo prezzo orario.',
    confidence: 'alta',
    confidenceWhy: 'Il calcolo esiste ed è testato; parte disattivato perché il valore predefinito è zero.',
    needs: 'Inserire il prezzo orario in Impostazioni → Tariffa manodopera.',
    files: [
      'Modules/Interventions/Domain/Actions/CalculateLabourAmountAction.php',
      'Modules/Interventions/Domain/Actions/ResolveInterventionPricingAction.php',
      'Modules/Interventions/Application/Settings/InterventionTariffSettings.php',
      'Modules/Interventions/Filament/Pages/LabourTariffSettingsPage.php',
    ],
    formula: 'interventi/anno × ore medie × % ore non fatturate × prezzo orario',
    compute: (i, d) => eur(d.interventiAnno * i.oreMedieIntervento * (i.pctOreNonFatturate / 100) * i.prezzoOrarioVendita),
    explain: (i, d) => `${d.interventiAnno.toLocaleString('it-IT')} × ${i.oreMedieIntervento} h × ${i.pctOreNonFatturate}% × ${i.prezzoOrarioVendita} €/h`,
  },
  {
    id: 'chiamata',
    name: 'Diritto di chiamata applicato sempre',
    problem: 'L\'uscita si paga, ma se il diritto di chiamata non è a listino te lo ricordi solo quando ti va bene.',
    impact: 'Uscite in cui il diritto di chiamata oggi non viene applicato.',
    confidence: 'alta',
    confidenceWhy: 'Il campo esiste, si può dettare a voce e viene ripreso nel preventivo; il valore predefinito è zero.',
    needs: 'Inserire l\'importo in Impostazioni → Tariffa manodopera.',
    files: [
      'Modules/Interventions/Application/Settings/InterventionTariffSettings.php',
      'Modules/Interventions/Domain/Actions/ResolveInterventionPricingAction.php',
    ],
    formula: 'interventi/anno × % senza diritto di chiamata × importo',
    compute: (i, d) => eur(d.interventiAnno * (i.pctSenzaDirittoChiamata / 100) * i.dirittoChiamata),
    explain: (i, d) => `${d.interventiAnno.toLocaleString('it-IT')} × ${i.pctSenzaDirittoChiamata}% × ${i.dirittoChiamata} €`,
  },
  {
    id: 'maggiorazioni',
    name: 'Maggiorazione notturna e festiva',
    problem: 'La chiamata di domenica sera costa a te più di una del martedì mattina, ma esce dalla stessa tariffa.',
    impact: 'Sovrapprezzo sulle ore fuori orario, applicato in automatico invece che a memoria.',
    confidence: 'media',
    confidenceWhy: 'Il calcolo c\'è ed è testato, ma le maggiorazioni non si sommano fra loro e i festivi del calendario non sono riconosciuti: vanno alzati a mano.',
    needs: 'Inserire percentuali e fascia notturna in Impostazioni → Tariffa manodopera.',
    files: [
      'Modules/Interventions/Domain/Actions/CalculateLabourAmountAction.php',
      'Modules/Interventions/Domain/DTO/LabourTariff.php',
    ],
    formula: 'interventi/anno × % fuori orario × ore medie × prezzo orario × % maggiorazione',
    compute: (i, d) => eur(d.interventiAnno * (i.pctFuoriOrario / 100) * i.oreMedieIntervento * i.prezzoOrarioVendita * (i.maggiorazionePct / 100)),
    explain: (i, d) => `${d.interventiAnno.toLocaleString('it-IT')} × ${i.pctFuoriOrario}% × ${i.oreMedieIntervento} h × ${i.prezzoOrarioVendita} € × ${i.maggiorazionePct}%`,
  },
  {
    id: 'caldaie',
    name: 'Scadenzario manutenzioni e controlli caldaia',
    problem: 'La manutenzione annuale la ricorda il cliente. Quando non la ricorda, l\'impianto lo prende un altro.',
    impact: 'Manutenzioni che oggi saltano e che uno scadenzario recupera.',
    confidence: 'media',
    confidenceWhy: 'Lo scadenzario e la generazione dell\'intervento esistono e sono testati, ma la generazione è manuale: nessun processo automatico crea gli interventi da solo.',
    needs: 'Censire impianti e caldaie con marca, potenza, combustibile e data dell\'ultimo controllo.',
    files: [
      'Modules/Compliance/Application/Queries/GetHeatingComplianceOverviewQuery.php',
      'Modules/Compliance/Application/Actions/GenerateMaintenanceInterventionAction.php',
      'Modules/Compliance/Application/Actions/RegisterMaintenanceControlAction.php',
      'Modules/Compliance/Filament/Pages/HeatingDeadlinesPage.php',
      'config/heating.php',
    ],
    formula: 'caldaie seguite × % scadenze perse × prezzo manutenzione × margine',
    compute: (i) => eur(i.caldaieInManutenzione * (i.pctManutenzioniPerse / 100) * i.prezzoManutenzione * (i.marginePct / 100)),
    explain: (i) => `${i.caldaieInManutenzione.toLocaleString('it-IT')} caldaie × ${i.pctManutenzioniPerse}% × ${i.prezzoManutenzione} € × ${i.marginePct}%`,
  },
  {
    id: 'incasso',
    name: 'Pagamento con carta sul rapportino firmato',
    problem: 'Il lavoro finisce a marzo e il bonifico arriva a maggio. Nel frattempo il materiale l\'hai già pagato tu.',
    impact: 'Costo del denaro risparmiato sui lavori incassati subito invece che a 45 giorni.',
    confidence: 'bassa',
    confidenceWhy: 'Il flusso di pagamento è completo, ma quanti clienti paghino davvero sul posto non lo sa nessuno prima di provarci.',
    needs: 'Account Stripe collegato e chiavi inserite.',
    files: [
      'Modules/Interventions/Application/Actions/CreateInterventionReportCheckoutAction.php',
      'Modules/Interventions/Application/Actions/ConfirmInterventionReportPaymentAction.php',
      'Modules/Interventions/Infrastructure/Payments/CashierReportPaymentGateway.php',
    ],
    formula: 'fatturato incassabile subito × giorni anticipati ÷ 365 × costo del denaro',
    compute: (i, d) => {
      const fatturato = d.interventiAnno * (i.pctIncassabileSubito / 100) *
        (i.oreMedieIntervento * i.prezzoOrarioVendita + i.valoreMedioExtra);
      return eur(fatturato * (i.giorniIncassoOggi / 365) * (i.costoDenaroPct / 100));
    },
    explain: (i, d) => {
      const fatturato = Math.round(d.interventiAnno * (i.pctIncassabileSubito / 100) *
        (i.oreMedieIntervento * i.prezzoOrarioVendita + i.valoreMedioExtra));
      return `${fatturato.toLocaleString('it-IT')} € × ${i.giorniIncassoOggi} gg ÷ 365 × ${i.costoDenaroPct}%`;
    },
  },
  {
    id: 'margine',
    name: 'Margine per commessa, lavoro per lavoro',
    problem: 'Sai come è andato l\'anno. Non sai quale cantiere ti ha mangiato il guadagno degli altri.',
    impact: 'Nessun euro immediato: è la voce che ti fa scoprire dove finiscono quelli delle altre righe.',
    confidence: 'bassa',
    confidenceWhy: 'Il calcolo è reale e ordina i lavori dal peggiore, ma il costo dei subappalti resta a zero perché a schema non è attribuito a nessuna commessa, e il materiale conta solo se carichi i DDT.',
    needs: 'Inserire il costo orario aziendale e caricare i DDT dei fornitori sulle commesse.',
    files: [
      'Modules/Billing/Application/Queries/GetJobMarginsQuery.php',
      'Modules/Billing/Domain/Actions/CalculateJobMarginAction.php',
      'Modules/Billing/Application/Actions/ReconcileSupplierInvoiceWithDeliveryNotesAction.php',
    ],
    formula: 'non monetizzata: dipende da cosa decidi dopo averla vista',
    compute: () => 0,
    explain: () => 'nessun importo attribuito — è informazione, non ricavo',
  },
];

/**
 * Beneficio futuro potenziale.
 *
 * Qui non si somma niente e niente entra nel totale. Ogni voce dichiara che
 * cosa manca davvero: in un caso il codice è finito ma il canale non è
 * attivabile senza un contratto, nell'altro l'integrazione è predisposta ma
 * spenta finché non esiste un abbonamento.
 */
export const FUTURE = [
  {
    id: 'whatsapp',
    name: 'Messaggi WhatsApp lavorati in automatico',
    state: 'Codice completo, canale non attivo',
    problem: 'I clienti scrivono su WhatsApp. Qualcuno legge, capisce, e riporta a mano su commessa — o non lo riporta.',
    whatExists: 'Il giro è scritto per intero e coperto da test: webhook con firma verificata (Meta e YCloud), messaggio salvato, coda, classificazione con un modello linguistico, proposta di azione, approvazione umana ed esecuzione che crea davvero l\'intervento o annota la commessa.',
    whatMisses: 'Serve un canale WhatsApp Business API attivo: contratto a pagamento, numero aziendale verificato e approvazione di Meta. Finché non c\'è, nel pannello non entra nessun messaggio. Nessuno l\'ha ancora fatto girare su traffico vero, quindi non esiste una misura da cui partire.',
    files: [
      'Modules/WhatsApp/Http/Controllers/WhatsAppWebhookController.php',
      'Modules/WhatsApp/Application/Actions/ProcessWhatsAppMessageAction.php',
      'Modules/WhatsApp/Application/AI/OpenAiWhatsAppMessageClassifier.php',
      'Modules/AiAssistant/Application/Actions/ExecuteAiActionProposalAction.php',
    ],
    formula: 'minuti al giorno × giorni lavorativi ÷ 60 × costo orario',
    compute: (i) => eur((i.minutiWhatsAppGiorno / 60) * i.giorniLavorativi * i.costoOrarioAzienda),
    explain: (i) => `${i.minutiWhatsAppGiorno} min × ${i.giorniLavorativi} gg ÷ 60 × ${i.costoOrarioAzienda} €/h`,
  },
  {
    id: 'metel',
    name: 'Listini fornitori aggiornati da soli (METEL)',
    state: 'Import da file operativo, sincronizzazione API disattivata',
    problem: 'I prezzi del listino cambiano e i preventivi restano indietro. Il materiale si vende al prezzo dell\'anno scorso.',
    whatExists: 'L\'import di un file di listino METEL funziona, con parsing dei tracciati e collegamento delle voci ai prodotti. Questa parte è già usabile oggi.',
    whatMisses: 'La sincronizzazione automatica via API METEL (MOP / Data Pool) è predisposta ma spenta: richiede un contratto METEL a pagamento e credenziali certificate, e senza quelle il codice stesso si disabilita e lo dichiara.',
    files: [
      'Modules/Catalog/Application/Actions/ImportMetelPriceListFileAction.php',
      'Modules/Catalog/Application/Actions/FetchMetelCatalogViaApiAction.php',
      'config/metel.php',
    ],
    formula: 'non quantificato: dipende dal contratto e da quanti listini gestisci',
    compute: () => null,
    explain: () => 'nessuna stima — servirebbe sapere quanti listini tieni e ogni quanto cambiano',
  },
];

export function derive(i) {
  const interventiAnno = Math.round(i.tecnici * i.interventiSettimana * i.settimane);
  const preventiviAnno = interventiAnno * (i.pctSegnalazioni / 100);
  return { interventiAnno, preventiviAnno };
}
