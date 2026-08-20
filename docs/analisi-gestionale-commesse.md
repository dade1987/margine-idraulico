# Analisi di `gestionale_commesse` — cosa incide davvero su tempo, costi e margine di un'impresa idraulica

Documento di supporto a **Margine Idraulici**. Serve a rendere controllabile ogni cifra
mostrata dal calcolatore: per ogni funzione ci sono i file che la implementano, lo stato
verificato nel codice, il problema che risolve, l'impatto considerato, la formula, la
confidenza e le dipendenze.

**Metodo.** Nessuna funzione è stata classificata dal nome della classe. Per ognuna è stato
seguito il flusso completo: chi la chiama, cosa scrive a database, quali test la coprono, e
se il valore predefinito la lascia attiva o spenta. Dove il codice dichiara da solo un
limite — un costo che resta a zero, una festività non riconosciuta, un provider assente —
il limite è riportato qui invece di essere ignorato.

- **Repository analizzato:** `gestionale_commesse`, ramo `main`
- **Commit:** `154e6ab` (merge della PR #9)
- **Dimensione:** 104.204 righe PHP fra `Modules/` e `app/`, 286 file di test, 1.254 casi
- **Stack:** Laravel 12, Filament 5, `nwidart/laravel-modules`; PHPStan livello 9; gate di
  copertura al 100% su `Modules/` con esclusioni dichiarate in `phpunit.xml`
- **Non incluse nell'analisi:** il sottosistema WTS (rifiuti), `TimberBilling`, `Signage`,
  `EnergyBroker`, `PublicProcurement`, `Production`, `Bom`. Sono verticali di altri
  mestieri: presenti e funzionanti, ma senza effetto sul margine di un idraulico.

## Avvertenza sui numeri

Il gestionale sa misurare a consuntivo quanto materiale è uscito fuori preventivo
(`GetExtraMaterialsRecapQuery`). **Non** sa dire quanto ne stai regalando adesso, prima di
usarlo. Tutte le percentuali di partenza del calcolatore sono quindi stime prudenziali, non
misure, e sono modificabili una per una. Le formule sono esplicite proprio perché il
risultato possa essere contestato riga per riga.

---

## 1. Come sono stati assegnati gli stati

| Stato | Significato operativo | Dove finisce nel calcolatore |
|---|---|---|
| **Generica operativa** | Funziona per chiunque usi il pannello. Flusso completo, test presenti, nessun prerequisito. | Risultato principale |
| **Già adatta agli idraulici** | Pensata per questo mestiere (extra preventivo, caldaie, diritto di chiamata). Stessi requisiti della precedente. | Risultato principale |
| **Richiede configurazione** | Codice completo e testato, ma parte a zero o richiede un account/anagrafica esterna. | Sezione "configurazione" |
| **Parzialmente implementata** | Fa la maggior parte del lavoro, con un buco dichiarato nel codice stesso. | Sezione "configurazione", con il buco scritto |
| **In sviluppo** | Non produce ancora l'effetto economico. | Beneficio futuro, mai sommato |
| **Solo prevista o documentata** | Predisposizione o documentazione, non flusso funzionante. | Beneficio futuro, mai sommato |

---

## 2. Funzioni nel risultato economico principale

### 2.1 Rapportino dettato invece che scritto

**File e classi**

- `Modules/Interventions/Application/Actions/BuildInterventionReportDraftAction.php` — orchestrazione: trascrizione → estrazione → normalizzazione in DTO tipizzato
- `Modules/Interventions/Application/AI/InterventionReportExtractorInterface.php` — contratto
- `Modules/AiAssistant/Application/Reports/OpenAiInterventionReportExtractor.php` — implementazione live (DeepSeek → Groq → OpenAI, in quest'ordine di preferenza)
- `Modules/AiAssistant/Application/Speech/GroqWhisperTranscriptionProvider.php`, `OpenAiWhisperTranscriptionProvider.php` — voce → testo
- `Modules/Interventions/Application/Actions/MatchDictatedMaterialsToCatalogAction.php` — aggancio dei materiali dettati al catalogo
- `Modules/Interventions/Application/Actions/ApplyInterventionReportDraftAction.php` — scrittura definitiva dopo conferma dell'operatore
- `Modules/Interventions/Filament/Pages/RecordInterventionReportPage.php` — la pagina che l'operatore usa
- `Modules/Interventions/Domain/DTO/InterventionReportDraft.php`, `DictatedMaterialLine.php`

**Stato reale — generica operativa.** Il giro è completo e collegato: l'interfaccia
dell'estrattore è legata all'implementazione OpenAI-compatibile in
`AiAssistantServiceProvider` (riga 60), la pagina Filament chiama davvero
`BuildInterventionReportDraftAction` e poi `ApplyInterventionReportDraftAction`. La bozza è
esplicitamente una *proposta*: niente viene scritto prima che l'operatore confermi.
Se la chiamata al modello fallisce, la pagina tiene la trascrizione grezza come note
(`RecordInterventionReportPage.php`, righe 176-183) invece di perdere il lavoro.

Test: `tests/Feature/Interventions/VoiceInterventionReportTest.php`,
`RecordInterventionReportPageTest.php`, `ApplyInterventionReportDraftTest.php`.

**Problema operativo risolto.** Il rapportino si compila a fine giornata, quando i dettagli
sono sbiaditi, oppure a mano sul posto mentre il cliente aspetta.

**Impatto economico considerato.** Solo minuti di tecnico risparmiati, valorizzati al costo
orario aziendale. Non è contato nessun ricavo aggiuntivo su questa riga.

**Formula**

```
interventi/anno × (minuti oggi − minuti dettando) ÷ 60 × costo orario aziendale
```

**Confidenza: alta** sul funzionamento, **media** sul valore. Il flusso è certo; quanti
minuti risparmi dipende da come scrivi oggi, che è l'input più soggettivo del calcolatore.

**Dipendenze.** Una chiave API per un modello linguistico (DeepSeek, Groq oppure OpenAI) e
una per la trascrizione. Senza chiave l'estrattore restituisce un array vuoto e la pagina
degrada a scrittura manuale — non si rompe, ma il beneficio è zero.

**Nota sulla copertura.** `Modules/AiAssistant` è escluso dal gate di copertura al 100%
(`phpunit.xml`, riga 21). La normalizzazione dell'output non fidato del modello è coperta
dai test in `Modules/Interventions`; la chiamata HTTP live all'LLM no.

---

### 2.2 Firma del cliente sul telefono, subito

**File e classi**

- `Modules/Interventions/Application/Actions/CreateInterventionReportShareLinkAction.php` — link pubblico stabile, riusato se non scaduto
- `Modules/Interventions/Http/Controllers/PublicInterventionReportController.php` — pagina pubblica
- `Modules/Interventions/Routes/web.php` — `/rapportino/{token}`, `/pdf`, `/firma`, `/pagamento`, `/grazie`
- `Modules/Signatures/Application/Actions/StoreSignatureForModelAction.php` — firma polimorfica
- `Modules/Signatures/Filament/Pages/CaptureSignature.php` — cattura sul dispositivo
- `Modules/Interventions/Application/Actions/GenerateInterventionReportPdfAction.php`
- `Modules/Interventions/Application/Actions/GetInterventionReportPublicDataAction.php`

**Stato reale — generica operativa.** Le rotte pubbliche esistono e sono cinque, la firma si
salva, il PDF si genera, il link si riusa invece di accumulare URL morti.

Test: `InterventionReportShareTest.php`, `GetInterventionReportPublicDataTest.php`,
`GenerateInterventionReportPdfTest.php`, `tests/Feature/Signatures/`.

**Problema operativo risolto.** Il foglio va fatto firmare, portato in ufficio, scansionato.
Se il cliente non c'è al momento giusto, si torna.

**Impatto economico considerato.** Minuti persi per firma, consegna e ritorni, al costo
orario aziendale.

**Formula**

```
interventi/anno × minuti persi per firma e consegna ÷ 60 × costo orario aziendale
```

**Confidenza: alta** sul funzionamento, **media** sul valore: dipende da quanti giri di
ritorno fai davvero oggi.

**Dipendenze.** Nessuna. Funziona con il pannello installato.

---

### 2.3 Materiale fuori preventivo che finisce in fattura

**File e classi**

- `Modules/Interventions/Domain/Actions/DetectExtraQuotationMaterialsAction.php` — confronto usato/preventivato
- `Modules/Interventions/Application/Actions/SyncInterventionExtraMaterialsAction.php` — scrittura di `extra_quantity`, `extra_amount`, `extra_status_code` sulle righe
- `Modules/Interventions/Application/Actions/SyncWorkOrderExtraMaterialsAction.php` — stessa cosa a livello di commessa
- `Modules/Interventions/Application/Queries/GetExtraMaterialsRecapQuery.php` — riepilogo di periodo
- `app/Filament/Widgets/ExtraMaterialsRecapStats.php` — il dato in dashboard
- `Modules/Interventions/Domain/DTO/ExtraMaterialLine.php`, `QuotedMaterial.php`, `UsedMaterial.php`, `ExtraMaterialsRecap.php`
- Migrazione: `Modules/Interventions/Database/Migrations/2026_07_21_090000_add_extra_quotation_fields_to_intervention_material_lines.php`

**Stato reale — già adatta agli idraulici.** È la funzione meglio costruita del gruppo. Il
confronto **non** è "riga presente o assente" ma per quantità: se il preventivo copre 3 pezzi
e in cantiere ne servono 5, l'extra è 2 e non l'intera riga. Righe con la stessa descrizione
consumano la stessa disponibilità preventivata. Il riepilogo divide l'extra in tre stati —
da fatturare, in attesa di decisione, regalato — e proprio quest'ultimo è il numero che
cambia i comportamenti.

Test: `SyncInterventionExtraMaterialsTest.php`, `SyncWorkOrderExtraMaterialsTest.php`,
`InterventionExtraMaterialsSyncTest.php`, `ExtraMaterialsRecapTest.php`.

**Problema operativo risolto.** Il pezzo aggiunto in cantiere non è nel preventivo. Se
nessuno lo intercetta riga per riga, viene regalato senza che nessuno decida di regalarlo.

**Impatto economico considerato.** Ricavo, non tempo. È la voce più pesante del totale.

**Formula**

```
interventi/anno × % interventi con extra × valore medio extra × % oggi non fatturata
```

**Confidenza: alta.** È l'unica voce che il gestionale sa poi verificare da solo: dopo
qualche mese di uso, `GetExtraMaterialsRecapQuery` dice il numero vero e la stima si butta.

**Dipendenze.** Serve che l'intervento sia collegato a un preventivo, altrimenti non c'è
niente contro cui confrontare. Il codice è onesto su un punto che conviene ripetere: le
righe materiale possono anche essere digitate a mano nell'intervento, quindi il conteggio
include gli extra di ogni origine — chiamarlo "guadagnato grazie al rapportino vocale"
sarebbe un'affermazione che lo schema non regge (commento in
`GetExtraMaterialsRecapQuery.php`, righe 18-23).

---

### 2.4 Guasti visti e non persi

**File e classi**

- `Modules/Interventions/Application/Actions/CreateIssueReportAction.php`
- `Modules/Interventions/Infrastructure/Models/IssueReport.php`
- `Modules/Quotations/Domain/Actions/BuildQuotationLinesFromInterventionAction.php`
- `Modules/Interventions/Domain/DTO/InterventionReportDraft.php` — campo `issues`, dettabile a voce

**Stato reale — già adatta agli idraulici.** La segnalazione si registra durante il
rapportino, anche dettandola, e resta agganciata all'intervento. Nel DTO è documentata per
quello che è: *"guasti notati sul posto ma non risolti — la materia prima del prossimo
preventivo"*.

Test: `IssueReportTest.php`.

**Problema operativo risolto.** Il tecnico nota un secondo difetto, lo dice a voce e finisce
lì. Il lavoro lo fa qualcun altro, sei mesi dopo.

**Impatto economico considerato.** Margine sui lavori che nascono da segnalazioni oggi
dimenticate — non il fatturato, solo il margine.

**Formula**

```
interventi/anno × % guasti visti × % oggi persi × % che diventano lavoro
                × valore medio lavoro × margine %
```

**Confidenza: media.** La registrazione è certa e testata. Quante segnalazioni diventino
lavoro è una stima commerciale, non un dato del gestionale: è la catena di percentuali più
lunga del calcolatore, quindi anche la più fragile. Il passaggio da segnalazione a preventivo
resta un'azione umana — il gestionale la conserva e la mostra, non la vende.

**Dipendenze.** Nessuna tecnica. Serve però l'abitudine di dettare le segnalazioni.

---

### 2.5 Preventivo generato dall'intervento

**File e classi**

- `Modules/Quotations/Application/Actions/CreateQuotationFromInterventionAction.php`
- `Modules/Quotations/Domain/Actions/BuildQuotationLinesFromInterventionAction.php`
- `Modules/Quotations/Domain/Actions/CalculateQuotationTotalsAction.php`
- `Modules/Quotations/Application/Actions/GenerateQuotationPdfAction.php`

**Stato reale — generica operativa.** Righe materiale, manodopera e diritto di chiamata
passano dall'intervento al preventivo con una sola azione. Se non c'è niente da preventivare
l'azione restituisce `null` invece di creare un documento vuoto.

Test: la cartella `tests/Feature/Quotations/` contiene 33 file, fra cui la creazione da
intervento.

**Problema operativo risolto.** Il preventivo per il lavoro visto in cantiere si riscrive da
zero la sera, ricopiando misure e materiali già annotati poche ore prima.

**Impatto economico considerato.** Solo tempo di ufficio risparmiato. Nessun ricavo: quello
è già contato, e una volta sola, nella riga delle segnalazioni.

**Formula**

```
preventivi da intervento/anno × minuti risparmiati ÷ 60 × costo orario aziendale
```

dove `preventivi da intervento/anno = interventi/anno × % guasti visti`.

**Confidenza: alta** sul funzionamento, **media** sul volume.

**Dipendenze.** Nessuna.

---

## 3. Beneficio ottenibile con la configurazione per la tua attività

Queste funzioni sono scritte e testate. Restano a zero finché qualcuno non inserisce i tuoi
numeri o non collega il tuo account. **Non sono sommate al risultato principale.**

### 3.1 Tariffa oraria di vendita della manodopera

**File e classi**

- `Modules/Interventions/Domain/Actions/CalculateLabourAmountAction.php`
- `Modules/Interventions/Domain/Actions/ResolveInterventionPricingAction.php`
- `Modules/Interventions/Application/Settings/InterventionTariffSettings.php`
- `Modules/Interventions/Filament/Pages/LabourTariffSettingsPage.php`
- `Modules/Interventions/Domain/DTO/LabourTariff.php`, `LabourQuote.php`

**Stato reale — richiede configurazione.** Il codice lo dichiara senza giri di parole: *"lo
schema porta una colonna `amount` per la manodopera da marzo, ma non l'ha mai riempita
nessuno, perché nel codice non esisteva un prezzo di vendita. Gli interventi arrivavano al
cliente con i soli materiali, e le ore venivano regalate."* Il calcolo ora esiste, ma il
valore predefinito di `interventions.hourly_labour_price_cents` è zero, e con zero
`pricesLabour()` è falsa e l'importo resta zero.

La precedenza è dichiarata e testata: una cifra scritta da una persona non si tocca mai; poi
quella dettata a voce dall'operatore, che era sul posto; solo per ultima quella derivata
dalla tariffa.

Test: `LabourTariffSettingsPageTest.php`, più i test sul resolver.

**Problema operativo risolto.** Le ore escono gratis dal rapportino senza che nessuno decida
di regalarle.

**Impatto economico considerato.** Ore lavorate che oggi non arrivano in fattura, al prezzo
orario di vendita.

**Formula**

```
interventi/anno × ore medie × % ore non fatturate × prezzo orario di vendita
```

**Confidenza: alta** sul meccanismo, **media** sulla quota di ore oggi perse.

**Dipendenze.** Inserire il prezzo orario in *Impostazioni → Tariffa manodopera*. È
un'operazione da un minuto, ma senza di essa la funzione vale esattamente zero.

---

### 3.2 Diritto di chiamata applicato sempre

**File e classi**

- `Modules/Interventions/Application/Settings/InterventionTariffSettings.php` — `interventions.callout_fee_cents`
- `Modules/Interventions/Domain/Actions/ResolveInterventionPricingAction.php`
- `Modules/Interventions/Domain/DTO/InterventionReportDraft.php` — campo `calloutFee`, dettabile

**Stato reale — richiede configurazione.** Il campo esiste, si può dettare a voce (e in quel
caso batte il valore configurato), e viene riportato nel preventivo generato
dall'intervento. Predefinito: zero.

**Problema operativo risolto.** L'uscita si paga, ma se il diritto di chiamata non è a
listino te lo ricordi solo quando ti va bene.

**Impatto economico considerato.** Uscite in cui oggi non viene applicato.

**Formula**

```
interventi/anno × % uscite senza diritto di chiamata × importo
```

**Confidenza: alta** sul meccanismo, **media** sulla percentuale.

**Dipendenze.** Inserire l'importo nella stessa pagina della tariffa.

---

### 3.3 Maggiorazione notturna e festiva

**File e classi**

- `Modules/Interventions/Domain/Actions/CalculateLabourAmountAction.php`
- `Modules/Interventions/Domain/DTO/LabourTariff.php`

**Stato reale — parzialmente implementata.** Due limiti sono scritti nel codice, non
scoperti a posteriori:

1. **Le maggiorazioni non si sommano.** Un lavoro di domenica notte prende la più alta fra
   le due percentuali, non la somma. È una scelta dichiarata: le maggiorazioni cumulate sono
   difficili da difendere in fattura e non è così che fattura la categoria.
2. **I festivi non sono gestiti.** Riconoscere le festività italiane richiede un calendario
   (la Pasqua si muove, i patroni sono comunali) e farlo a metà sarebbe peggio che non farlo.
   L'operatore può alzare l'importo a mano sulla bozza.

**Problema operativo risolto.** La chiamata di domenica sera costa a te più di una del
martedì mattina, ma esce dalla stessa tariffa.

**Impatto economico considerato.** Sovrapprezzo sulle ore fuori orario.

**Formula**

```
interventi/anno × % fuori orario × ore medie × prezzo orario × % maggiorazione
```

**Confidenza: media**, con il limite dei festivi da tenere presente: il 25 dicembre viene
trattato come un qualsiasi giorno feriale, a meno che non cada di sabato o domenica.

**Dipendenze.** Percentuali e fascia notturna da inserire. Per i festivi: correzione manuale.

---

### 3.4 Scadenzario manutenzioni e controlli caldaia

**File e classi**

- `Modules/Compliance/Application/Queries/GetHeatingComplianceOverviewQuery.php` — scadenze ordinate dalla peggiore
- `Modules/Compliance/Application/Actions/GenerateMaintenanceInterventionAction.php` — genera l'intervento programmato
- `Modules/Compliance/Application/Actions/RegisterMaintenanceControlAction.php` — registra l'esito
- `Modules/Compliance/Application/Actions/GenerateRceePdfAction.php` — allegato RCEE
- `Modules/Compliance/Filament/Pages/HeatingDeadlinesPage.php`
- `Modules/Compliance/Filament/Resources/HeatingSystemResource/RelationManagers/BoilersRelationManager.php` — il pulsante che genera l'intervento (riga 141)
- `config/heating.php` — periodicità: manutenzione 12 mesi; RCEE 48 mesi per gas sotto soglia, 24 sopra 100 kW o per gasolio e biomassa (D.P.R. 74/2013)

**Stato reale — richiede configurazione, e parzialmente automatica.** Lo scadenzario
funziona e ordina per gravità (scaduto, in scadenza, a posto, sconosciuto). La generazione
dell'intervento **è manuale**: è un pulsante nella scheda della caldaia. Nessun processo
programmato crea gli interventi da solo — in `routes/console.php` girano solo la posta e la
sincronizzazione Google Calendar.

Test: `HeatingMaintenanceTest.php`, `CustomerSystemTest.php`, `ComplianceReadinessTest.php`.

**Problema operativo risolto.** La manutenzione annuale la ricorda il cliente. Quando non la
ricorda, l'impianto lo prende un altro.

**Impatto economico considerato.** Margine sulle manutenzioni che oggi saltano.

**Formula**

```
caldaie seguite × % scadenze perse ogni anno × prezzo manutenzione × margine %
```

**Confidenza: media.** La parte tecnica è solida; il numero di scadenze che oggi ti sfuggono
è una tua stima.

**Dipendenze.** Censire impianti e caldaie con marca, modello, potenza, combustibile e data
dell'ultimo controllo. È la personalizzazione più lunga di tutte, e senza di essa la pagina
delle scadenze è vuota.

---

### 3.5 Pagamento con carta sul rapportino firmato

**File e classi**

- `Modules/Interventions/Application/Actions/CreateInterventionReportCheckoutAction.php`
- `Modules/Interventions/Application/Actions/ConfirmInterventionReportPaymentAction.php`
- `Modules/Interventions/Infrastructure/Payments/CashierReportPaymentGateway.php` — Stripe via Laravel Cashier, guest checkout
- `Modules/Interventions/Application/Payments/ReportPaymentGatewayInterface.php`

**Stato reale — richiede configurazione.** Il flusso è completo e ha tre guardie sensate:
importo maggiore di zero, rapportino non già pagato, e **firma obbligatoria prima del
pagamento**. Il legame è dichiarato in `InterventionsServiceProvider` (riga 29).

Test: `InterventionReportPaymentTest.php`.

**Problema operativo risolto.** Il lavoro finisce a marzo e il bonifico arriva a maggio. Nel
frattempo il materiale l'hai già pagato tu.

**Impatto economico considerato.** Solo il costo del denaro risparmiato sull'anticipo, non
il fatturato: incassare prima non aumenta i ricavi, riduce il fabbisogno di cassa.

**Formula**

```
fatturato incassabile subito × giorni anticipati ÷ 365 × costo del denaro %
```

**Confidenza: bassa.** Il flusso è certo, ma quanti clienti paghino davvero con la carta sul
posto non lo sa nessuno prima di provarci. È la riga da guardare con più sospetto.

**Dipendenze.** Account Stripe e chiavi configurate. Commissioni Stripe non dedotte nella
formula.

---

### 3.6 Margine per commessa, lavoro per lavoro

**File e classi**

- `Modules/Billing/Application/Queries/GetJobMarginsQuery.php`
- `Modules/Billing/Domain/Actions/CalculateJobMarginAction.php` — con `worstFirst()`, che ordina i lavori dal peggiore
- `Modules/Billing/Domain/DTO/JobMargin.php`, `JobMarginReport.php`
- `Modules/Billing/Application/Actions/ReconcileSupplierInvoiceWithDeliveryNotesAction.php`

**Stato reale — parzialmente implementata.** La query documenta da sola da dove prende ogni
cifra, e i limiti sono dichiarati:

- il **ricavo** viene dagli importi degli interventi, non dalle fatture, perché una fattura
  può coprire più commesse e spezzarla sarebbe un'ipotesi;
- la **manodopera** sono i minuti al costo orario aziendale — un'unica tariffa nelle
  impostazioni, con predefinito 30 €/h, deliberatamente non zero perché *"costare il lavoro
  a zero fa sembrare profittevole ogni commessa, che è una bugia più cara di una tariffa
  approssimativa"*;
- il **materiale** è quello che i fornitori hanno davvero addebitato, letto dai DDT
  agganciati alla commessa — le righe dell'intervento portano prezzi di vendita e
  farebbero sembrare gratis ogni lavoro;
- il **costo dei subappalti resta zero**: a schema le fatture fornitore non sono attribuite a
  nessuna commessa, e inventare una ripartizione sarebbe peggio che non riportare niente.

**Problema operativo risolto.** Sai come è andato l'anno. Non sai quale cantiere ti ha
mangiato il guadagno degli altri.

**Impatto economico considerato: nessuno.** Nel calcolatore vale zero euro, di proposito. È
informazione, e attribuirle un ricavo sarebbe contarla due volte rispetto alle righe che
quel ricavo lo generano davvero.

**Formula.** Non monetizzata.

**Confidenza: bassa** come voce economica, **alta** come strumento diagnostico.

**Dipendenze.** Inserire il costo orario aziendale reale e caricare i DDT dei fornitori sulle
commesse. Se subappalti molto, il margine che vedi sarà più roseo del vero.

---

### 3.7 Altre funzioni che richiedono configurazione

Presenti, testate, ma con un prerequisito esterno. Non entrano in nessun totale del
calcolatore perché il loro effetto sul margine di un idraulico è indiretto.

| Funzione | File principali | Stato | Dipendenza |
|---|---|---|---|
| Sincronizzazione Google Calendar | `Modules/Interventions/Application/GoogleCalendar/Actions/PushInterventionToGoogleAction.php`, `PullGoogleCalendarChangesAction.php`, `Console/Commands/SyncGoogleCalendarsCommand.php` | Operativa, schedulata ogni 5 minuti | OAuth Google per utente |
| Posta in arrivo → intervento | `Modules/Email/Application/Actions/PollEmailInboxAction.php`, `ProcessEmailMessageAction.php`, `Console/Commands/PollEmailInboxCommand.php` | Operativa, schedulata ogni 5 minuti | Casella IMAP + chiave LLM + approvatore configurato |
| Fattura elettronica | `Modules/Fiscal/Domain/Actions/GenerateFatturaElettronicaXmlAction.php`, `Modules/Billing/Application/Actions/SendElectronicInvoiceAction.php` | XML generato in casa; invio verso endpoint generico configurabile | Contratto con un intermediario SDI. L'invio non è integrato con un provider specifico: è una POST verso un endpoint che va fatto combaciare |
| Import listino METEL da file | `Modules/Catalog/Application/Actions/ImportMetelPriceListFileAction.php`, `Application/Support/MetelRecordParser.php` | Operativa | File di listino dal fornitore |
| Magazzino e furgone | `Modules/Inventory/Application/Actions/CreateInventoryMovementAction.php`, `Application/Queries/GetStockSnapshotQuery.php` | Operativa (magazzini collegabili ai veicoli) | Anagrafica prodotti e magazzini. `Modules/Inventory` è escluso dal gate di copertura |
| Riconciliazione fatture fornitore con DDT | `Modules/Billing/Application/Actions/ReconcileSupplierInvoiceWithDeliveryNotesAction.php` | Operativa | Caricamento dei DDT |
| Registro F-Gas | `Modules/Compliance/Domain/Actions/CalculateFGasObligationAction.php`, `Application/Queries/GetFGasOverviewQuery.php` | Operativa e corretta sui Reg. UE 517/2014 art. 4 | Censimento apparecchiature con refrigerante e carica |
| Timbrature → minuti | `Modules/Interventions/Application/Actions/StartTimePunchAction.php`, `StopTimePunchAction.php`, `SyncInterventionWorkMinutesFromTimePunchesAction.php` | Operativa | Nessuna. Ma i minuti diventano soldi solo con la tariffa di 3.1 configurata |

Sulle timbrature vale la pena essere espliciti: il conteggio dei minuti funziona da subito e
non richiede niente. È la **conversione in denaro** che dipende dalla tariffa, e per questo
il beneficio economico è contato in 3.1 e non fra le funzioni operative.

---

## 4. Beneficio futuro potenziale

Niente di questa sezione entra in nessun totale.

### 4.1 Messaggi WhatsApp lavorati in automatico

**File e classi**

- `Modules/WhatsApp/Http/Controllers/WhatsAppWebhookController.php` — webhook Meta e YCloud, entrambi con verifica della firma
- `Modules/WhatsApp/Application/Security/MetaWebhookSignatureVerifier.php`, `YCloudWebhookSignatureVerifier.php`
- `Modules/WhatsApp/Application/Actions/StoreIncomingWhatsAppMessageAction.php` — salva e accoda
- `Modules/WhatsApp/Application/Jobs/ProcessWhatsAppMessageJob.php`
- `Modules/WhatsApp/Application/Actions/ProcessWhatsAppMessageAction.php` — classifica, archivia o propone
- `Modules/WhatsApp/Application/AI/OpenAiWhatsAppMessageClassifier.php`
- `Modules/AiAssistant/Application/Actions/ExecuteAiActionProposalAction.php` — esegue dopo approvazione umana
- `Modules/WhatsApp/Filament/Pages/WhatsAppInboxPage.php`, `WhatsAppSettingsPage.php`

**Stato reale — codice completo, canale non attivo.** Va detto con precisione, perché è
diverso da "non è ancora scritto": il giro c'è tutto ed è coperto da test
(`tests/Feature/WhatsApp/`, 5 file, fra cui `WhatsAppAiIntegrationTest.php` che verifica
webhook idempotente, classificazione, deduplica delle proposte, esecuzione e invio in
uscita). Il modulo è attivo in `modules_statuses.json` e visibile per impostazione
predefinita in `config/account_features.php`. Le azioni eseguibili dopo approvazione
includono `create_intervention_from_whatsapp` e `update_intervention_schedule_from_whatsapp`,
che creano davvero l'intervento.

**Perché resta un beneficio futuro.** Manca il canale, non il software:

- serve un account **WhatsApp Business API** (Meta Cloud API oppure YCloud): contratto a
  pagamento, numero aziendale verificato e approvazione di Meta. Finché non c'è, nel pannello
  non entra nessun messaggio e la funzione produce zero;
- serve una coda attiva, una chiave LLM e un utente approvatore configurato — senza
  quest'ultimo il messaggio resta in `needs_review` con l'errore *"Nessun approvatore
  configurato per WhatsApp AI"*;
- **nessuno l'ha fatto girare su traffico vero.** Non esiste una misura di quanti messaggi
  vengano classificati bene, quindi non esiste una base da cui derivare un risparmio
  difendibile.

**Impatto economico considerato: nessuno.** La cifra mostrata nel calcolatore è il tempo
speso oggi a leggere e riportare messaggi a mano — l'ordine di grandezza di ciò che sarebbe
in gioco, non una previsione di quanto verrebbe recuperato.

**Formula (solo indicativa)**

```
minuti al giorno su messaggi × giorni lavorativi ÷ 60 × costo orario aziendale
```

**Confidenza: non applicabile.** Non è una stima economica: è un ordine di grandezza.

---

### 4.2 Listini fornitori aggiornati da soli (METEL)

**File e classi**

- `Modules/Catalog/Application/Actions/FetchMetelCatalogViaApiAction.php`
- `config/metel.php`

**Stato reale — solo predisposta.** Il file di configurazione lo dichiara: *"l'accesso
ufficiale METEL (MOP, Data Pool, BMEcat) richiede un contratto Metel a pagamento e credenziali
certificate — non esiste un'API pubblica gratuita. Quando le credenziali mancano, la
sincronizzazione è disabilitata e riporta un errore chiaro."* `METEL_API_ENABLED` è `false`
per impostazione predefinita.

L'**import da file** (§ 3.7) invece funziona ed è usabile oggi: è la stessa funzione, per la
strada manuale.

**Impatto economico considerato: nessuno.** Servirebbe sapere quanti listini gestisci e ogni
quanto cambiano, e non è un dato che il gestionale possieda.

**Confidenza: non applicabile.**

---

## 5. Funzioni presenti ma senza effetto sul margine di un idraulico

Elencate per completezza: sono operative, ma appartengono ad altri mestieri o ad altri
verticali del prodotto. Nessuna entra in nessuna sezione del calcolatore.

| Area | Dove | Perché esclusa |
|---|---|---|
| WTS — tracciabilità rifiuti | `app/Wts/`, `app/Filament/Wts/`, `config/wts.php` | Verticale trattamento rifiuti, con integrazione ECOS in sola lettura |
| Fatturazione legno | `Modules/TimberBilling/` | Verticale segherie |
| Cartellonistica | `Modules/Signage/` | Verticale diverso |
| Intermediazione energia | `Modules/EnergyBroker/` | Verticale diverso |
| Appalti pubblici | `Modules/PublicProcurement/` | Rilevante per imprese che partecipano a gare, non per la manutenzione |
| Produzione e distinta base | `Modules/Production/`, `Modules/Bom/` | Manifattura |
| Risorse umane | `Modules/HR/` | Ferie, visite mediche, formazione: utile ma senza effetto diretto sul margine per intervento |
| Veicoli | `Modules/Vehicles/` | Documenti e scadenze mezzi; il collegamento magazzino-furgone è contato in § 3.7 |

---

## 6. Cosa può smentire queste cifre

Le tre voci più fragili, in ordine:

1. **Il pagamento sul posto (§ 3.5).** Confidenza bassa dichiarata: non si sa quanti clienti
   useranno la carta.
2. **I guasti che diventano lavoro (§ 2.4).** Quattro percentuali moltiplicate fra loro:
   basta sbagliarne una perché il risultato cambi del doppio.
3. **I minuti risparmiati sul rapportino (§ 2.1 e § 2.2).** Dipendono da come lavori adesso,
   e chi compila il calcolatore tende a ricordare il caso peggiore.

La voce più solida è il **materiale fuori preventivo (§ 2.3)**, ed è anche la più grossa —
il che è una fortuna, ma va detto perché è verificabile, non perché conviene: dopo qualche
mese di uso il gestionale produce il numero vero e la stima si butta via.

Una nota finale sul metodo. Il codice di `gestionale_commesse` è insolitamente esplicito sui
propri limiti — i subappalti a zero, i festivi non riconosciuti, la tariffa che parte spenta,
l'attribuzione degli extra che non si può ricondurre al solo rapportino vocale. Quei limiti
sono finiti in questo documento così come sono scritti nei commenti, perché una stima che
nasconde i propri buchi vale meno di una più bassa che li dichiara.
