# Margine Idraulici

Web app statica che stima quanto lascia sul tavolo, ogni anno, un'impresa idraulica italiana
— usando **solo** le funzioni che nel pannello `gestionale_commesse` sono state verificate
una per una nel codice.

## Come è organizzata

Tre sezioni, e la separazione è il punto di tutto il progetto:

1. **Risultato economico** — solo funzioni realmente operative: flusso completo nel codice,
   test che lo coprono, nessun account esterno da attivare e nessuna anagrafica da costruire
   prima. È l'unico numero che viene sommato.
2. **Beneficio ottenibile con la configurazione per la tua attività** — funzioni scritte e
   testate che però partono spente (la tariffa oraria parte a zero) o che richiedono un
   account esterno. Totale separato, **mai** sommato al primo.
3. **Beneficio futuro potenziale** — quello che oggi non si può contare, con il motivo
   preciso. Non entra in nessun totale.

L'analisi che sta dietro alla classificazione — file, classi, stato reale, problema risolto,
impatto, formula, confidenza e dipendenze per ogni funzione — è in
[`docs/analisi-gestionale-commesse.md`](docs/analisi-gestionale-commesse.md).

## Struttura

```
index.html            la pagina
assets/model.js       il modello economico: voci, formule, riferimenti ai file analizzati
assets/app.js         interfaccia e calcolo
assets/styles.css     foglio di stile unico
docs/                 l'analisi del gestionale
```

Nessuna dipendenza, nessun passo di build, nessuna chiamata di rete. Si apre anche facendo
doppio clic su `index.html` da un browser che supporti i moduli ES, oppure con un server
statico locale:

```bash
python3 -m http.server 8000
```

## Pubblicazione su GitHub Pages

Impostazioni → Pages → *Deploy from a branch* → ramo `main`, cartella `/ (root)`.

Il sito viene servito all'indirizzo che GitHub ricava dal nome del repository:

```
https://dade1987.github.io/margine-idraulico/
```

Tutti i riferimenti a file sono relativi, quindi il sito non dipende dal percorso su cui
viene pubblicato: se un domani il repository cambia nome, o finisce sotto un dominio
personalizzato, continua a funzionare senza modificare una riga.

## I numeri

Le percentuali di partenza sono stime prudenziali per un'impresa di due o tre persone, non
misure. Sono tutte modificabili e restano salvate sul dispositivo di chi le inserisce. Sotto
ogni riga del risultato ci sono la formula usata e le classi che implementano la funzione,
perché ogni cifra possa essere contestata singolarmente.

Le due che spostano di più il totale sono la quota di materiale extra oggi non fatturata e i
minuti che si perdono per rapportino e firma.
