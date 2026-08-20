# Margine Idraulici

**Online su → https://dade1987.github.io/margine-idraulico/**

Quiz per idraulici e termoidraulici: dieci domande, un tocco l'una, e alla fine una stima di
quanto lascia sul tavolo ogni anno la sua impresa. Se il recuperabile è significativo, un
pulsante per scrivere su WhatsApp con il risultato già nel messaggio.

**Nessun numero compare prima che l'utente abbia risposto.** È la regola che tiene in piedi
il progetto: un importo affermato all'ingresso è una promessa di chi vende, lo stesso importo
che esce da dieci risposte è una conclusione di chi legge.

## Come funziona

1. **Il quiz** — una domanda per schermata, opzioni tappabili, una battuta di reazione ogni
   tanto. La prima domanda è sempre *cosa usi adesso*: chi ha già un gestionale completo si
   vede scalare quasi tutto, e glielo si dice.
2. **La stima** — il numero sale contando, poi compaiono le voci che lo compongono, ognuna
   con una riga in italiano su cosa fa il gestionale. Niente formule, niente percentuali,
   niente nomi di file.
3. **Il pulsante WhatsApp** — subito sotto, con il risultato già scritto nel messaggio. Ma
   solo sopra 2.500 €/anno: **sotto quella soglia la pagina dice di lasciar perdere**. Un
   venditore che sa dire "a te non serve" è l'unico di cui ci si fida quando dice il
   contrario.
4. **Il resto è chiuso** — tempi di recupero, voci che richiedono configurazione, e "come ho
   fatto questo conto" con le fonti. Si apre solo chi vuole.

## Perché i numeri stanno in piedi

Quattro correzioni, tutte dichiarate anche nella pagina:

- **situazione di partenza** — ogni voce viene scalata in base a cosa l'utente già usa;
- **il tempo vale metà** — un'ora risparmiata diventa margine solo se la riempi con lavoro
  fatturabile;
- **disciplina per dimensione** — le percentuali da artigiano solitario non si applicano a
  una squadra di sei, dove qualcuno che fattura c'è già;
- **tetto sul totale** — massimo il 9% del fatturato stimato, perché un numero che chi legge
  non riconosce come suo non è ambizioso, è falso.

I valori che il quiz non chiede sono ancorati a riferimenti del **Nord Italia** (tabelle
ministeriali sul costo del lavoro in edilizia, ISTAT, rilevazioni di mercato sulle tariffe
degli idraulici) e presi sempre sul lato basso dell'intervallo. Sono elencati uno per uno
nella pagina, etichettati per quello che sono: dato ufficiale, rilevazione di mercato o
indagine di settore.

L'analisi che sta dietro alla classificazione delle funzioni — file, classi, stato reale,
problema risolto, impatto, formula, confidenza e dipendenze — è in
[`docs/analisi-gestionale-commesse.md`](docs/analisi-gestionale-commesse.md).

## Struttura

```
index.html            la pagina (un solo contenitore, il resto lo disegna il JS)
assets/quiz.js        le domande e cosa scrive ogni risposta
assets/model.js       le voci economiche, le formule e i riferimenti ai file analizzati
assets/app.js         il percorso intro → domande → risultato
assets/styles.css     foglio di stile unico
docs/                 l'analisi del gestionale, funzione per funzione
```

Nessuna dipendenza, nessun passo di build, nessuna chiamata di rete. Si apre anche facendo
doppio clic su `index.html` da un browser che supporti i moduli ES, oppure con un server
statico locale:

```bash
python3 -m http.server 8000
```

## Pubblicazione su GitHub Pages

Il sito è pubblicato qui:

```
https://dade1987.github.io/margine-idraulico/
```

La sorgente è impostata su **GitHub Actions**: ogni push su `main` fa ripartire
`.github/workflows/pages.yml`, che carica la cartella così com'è — nessun passo di build.

Tutti i riferimenti a file sono relativi, quindi il sito non dipende dal percorso su cui
viene pubblicato: se un domani il repository cambia nome, o finisce sotto un dominio
personalizzato, continua a funzionare senza modificare una riga.

Se il deploy fallisce su `configure-pages` con *"Get Pages site failed"*, vuol dire che la
sorgente Pages è tornata su *Deploy from a branch*: va rimessa su **GitHub Actions** in
Impostazioni → Pages. Il token del workflow non ha il permesso di crearla da solo.

## I numeri

Le percentuali che il quiz non chiede sono prudenti, non ottimistiche, e sono elencate nella
pagina con la loro fonte. Restano stime costruite sulle risposte, non misure: quanto si stia
davvero regalando lo sa dire solo il gestionale, e solo dopo qualche mese di uso —
`GetExtraMaterialsRecapQuery` produce il numero vero, e a quel punto la stima si butta.

Niente viene salvato e niente esce dal dispositivo: nessuna email, nessuna registrazione,
nessun cookie, nessuna chiamata di rete.
