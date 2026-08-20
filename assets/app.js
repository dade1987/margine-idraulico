import { QUESTIONS, DEFAULTS, SISTEMI } from './quiz.js';
import { computeAll } from './model.js';

const WHATSAPP = '393911352526';
const money = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('it-IT');

/* Le soglie decidono se alla fine si chiede qualcosa o no. Sotto la piu' bassa
   non si propone niente: a chi non ha margine da recuperare non si vende, gli
   si dice che non gli serve. E' anche l'unico modo perche' il numero mostrato
   agli altri resti credibile. */
const SOGLIA_ALTA = 6000;
const SOGLIA_MEDIA = 2500;

const answers = { ...DEFAULTS };
const chosen = {};           // id domanda → indice opzione, per tornare indietro
let step = -1;               // -1 = schermata iniziale
let asked = [];              // domande effettivamente poste (alcune sono condizionali)

const app = document.getElementById('app');

/* ---------- utilita' ---------- */

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function visibleQuestions() {
  return QUESTIONS.filter((q) => !q.onlyIf || q.onlyIf(answers));
}

function scrollTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------- schermata iniziale ---------- */

function renderIntro() {
  app.textContent = '';
  const s = el('section', 'screen intro');

  s.append(
    el('p', 'eyebrow', 'Per idraulici e termoidraulici'),
    el('h1', 'hero', 'Quanto stai regalando senza saperlo?'),
  );

  const p = el('p', 'lead');
  p.textContent = `Non lo so, e nessuno può saperlo al posto tuo. Però se rispondi a una decina di domande — un tocco l'una — te lo calcolo con i tuoi numeri, non con quelli di una brochure.`;
  s.appendChild(p);

  const facts = el('div', 'facts');
  [
    [String(visibleQuestions().length), 'domande, un tocco'],
    ['~90"', 'e hai finito'],
    ['0', 'dati che ti chiedo'],
  ].forEach(([big, small]) => {
    const f = el('div', 'fact');
    f.append(el('b', null, big), el('span', null, small));
    facts.appendChild(f);
  });
  s.appendChild(facts);

  const btn = el('button', 'btn primary big', 'Iniziamo');
  btn.type = 'button';
  btn.addEventListener('click', () => { step = 0; asked = visibleQuestions(); renderStep(); });
  s.appendChild(btn);

  s.appendChild(el('p', 'fineprint', 'Niente email, niente registrazione, niente cookie. Le risposte restano su questo telefono e non le vede nessuno, nemmeno io.'));

  app.appendChild(s);
}

/* ---------- una domanda ---------- */

function renderStep() {
  asked = visibleQuestions();
  const q = asked[step];
  if (!q) return renderResult();

  app.textContent = '';
  const s = el('section', 'screen question');

  // avanzamento
  const bar = el('div', 'progress');
  const fill = el('div', 'progress-fill');
  fill.style.width = `${(step / asked.length) * 100}%`;
  bar.appendChild(fill);
  s.appendChild(bar);
  s.appendChild(el('p', 'stepcount', `Domanda ${step + 1} di ${asked.length}`));

  s.append(el('p', 'eyebrow', q.eyebrow), el('h2', 'qtext', q.text));
  if (q.help) s.appendChild(el('p', 'qhelp', q.help));

  const list = el('div', 'options');
  q.options.forEach((opt, idx) => {
    const b = el('button', 'option');
    b.type = 'button';
    if (chosen[q.id] === idx) b.classList.add('selected');

    const main = el('span', 'option-label', opt.label);
    b.appendChild(main);
    if (opt.note) b.appendChild(el('span', 'option-note', opt.note));

    b.addEventListener('click', () => choose(q, opt, idx, b));
    list.appendChild(b);
  });
  s.appendChild(list);

  if (step > 0) {
    const back = el('button', 'btn ghost', '← Torna indietro');
    back.type = 'button';
    back.addEventListener('click', () => { step -= 1; renderStep(); });
    s.appendChild(back);
  }

  app.appendChild(s);
  scrollTop();
}

function choose(q, opt, idx, button) {
  Object.assign(answers, opt.set || {});
  for (const [k, v] of Object.entries(opt.bump || {})) {
    answers[k] = (answers[k] ?? 0) + v;
  }
  chosen[q.id] = idx;

  button.classList.add('selected');
  [...button.parentElement.children].forEach((c) => { if (c !== button) c.classList.add('dimmed'); });

  // Una battuta breve prima di andare avanti: e' quello che rende il quiz una
  // conversazione invece di un modulo. Senza reazione si passa e basta.
  if (opt.reaction) {
    const r = el('p', 'reaction', opt.reaction);
    button.parentElement.after(r);
    requestAnimationFrame(() => r.classList.add('in'));
    setTimeout(next, 1150);
  } else {
    setTimeout(next, 260);
  }

  function next() { step += 1; renderStep(); }
}

/* ---------- il risultato ---------- */

function renderResult() {
  const r = computeAll(answers);
  app.textContent = '';

  const s = el('section', 'screen result');

  s.append(
    el('p', 'eyebrow', 'Con le tue risposte'),
    el('h2', 'result-title', 'Ogni anno lasci sul tavolo'),
  );

  const amount = el('div', 'bignumber');
  amount.textContent = money.format(0);
  s.appendChild(amount);

  s.appendChild(el('p', 'result-sub', 'Solo con quello che il gestionale fa già così com\'è, senza configurare niente.'));

  const equiv = el('p', 'equivalence');
  equiv.style.opacity = '0';
  s.appendChild(equiv);

  const rows = el('div', 'result-rows');
  s.appendChild(rows);

  const extra = el('div', 'after-reveal');
  extra.style.opacity = '0';
  s.appendChild(extra);

  app.appendChild(s);
  scrollTop();

  countUp(amount, r.operativeTotal, () => {
    revealRows(rows, r, () => {
      showEquivalence(equiv, r);
      buildAfterReveal(extra, r);
      extra.style.transition = 'opacity .5s ease';
      extra.style.opacity = '1';
    });
  });
}

/* Il numero sale invece di comparire: e' il momento in cui la persona guarda
   davvero lo schermo, ed e' l'unica animazione che si e' guadagnata il posto. */
function countUp(node, target, done) {
  const dur = 1400;
  const start = performance.now();
  function frame(now) {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    node.textContent = money.format(Math.round(target * eased));
    if (t < 1) requestAnimationFrame(frame);
    else { node.classList.add('landed'); done?.(); }
  }
  requestAnimationFrame(frame);
}

function revealRows(host, r, done) {
  const items = r.operative.filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  items.forEach((item, n) => {
    setTimeout(() => {
      const row = el('div', 'rrow');
      row.append(el('span', 'rrow-name', item.entry.name), el('span', 'rrow-val', money.format(item.value)));
      const why = el('p', 'rrow-why', item.entry.plain);
      row.appendChild(why);
      host.appendChild(row);
      requestAnimationFrame(() => row.classList.add('in'));
      if (n === items.length - 1) setTimeout(done, 300);
    }, n * 220);
  });
  if (items.length === 0) done();
}

function showEquivalence(node, r) {
  const t = r.operativeTotal;
  const giornate = Math.round(t / (answers.costoOrarioAzienda * 8));
  const interventi = Math.round(t / Math.max(60, answers.oreMedieIntervento * answers.prezzoOrarioVendita));

  let text;
  if (t < 800) text = 'Poco più di una giornata di lavoro. Nel tuo caso è davvero poca cosa.';
  else if (giornate >= 20) text = `Sono ${num.format(giornate)} giornate di lavoro all'anno. Un mese e mezzo, regalato.`;
  else text = `Sono ${num.format(giornate)} giornate di lavoro, o ${num.format(interventi)} interventi fatti gratis.`;

  node.textContent = text;
  node.style.transition = 'opacity .6s ease';
  node.style.opacity = '1';
}

/* ---------- tutto quello che viene dopo il numero ---------- */

function buildAfterReveal(host, r) {
  host.textContent = '';

  // L'ordine e' la parte che conta: numero, una riga di onesta', e il pulsante.
  // Tutto il resto sta chiuso, e lo apre solo chi vuole approfondire.
  baselineNote(host, r);
  ctaBlock(host, r);

  const deep = el('div', 'deep');
  deep.appendChild(el('p', 'deep-title', 'Se vuoi andare a fondo'));
  timelineBlock(deep, r);
  if (r.config.length) configBlock(deep, r);
  plainExplanation(deep, r);
  host.appendChild(deep);

  restartBlock(host);
}

/** Quando arrivano davvero. Un totale a regime spacciato per primo anno e' la
    parte disonesta di ogni conto di questo tipo. */
function timelineBlock(host, r) {
  const box = el('details', 'block timeline-block');
  box.appendChild(el('summary', null, `In quanto tempo li recuperi — il primo anno ${money.format(r.firstYear)}`));
  box.appendChild(el('p', 'block-sub', `Non tutto arriva il primo giorno. Il primo anno ne vedi circa ${money.format(r.firstYear)}: dal secondo in poi vale il totale pieno, perché le voci più lente sono partite.`));

  const line = el('div', 'timeline');
  const buckets = [
    { key: 'subito', title: 'Subito', when: 'primo mese', items: [] },
    { key: 'presto', title: 'Poche settimane', when: 'entro 2-3 mesi', items: [] },
    { key: 'dopo', title: 'Col suo giro', when: 'entro 6 mesi', items: [] },
  ];

  r.operative.filter((x) => x.value > 0).forEach((item) => {
    const m = item.entry.ramp ?? 1;
    const b = m <= 1 ? buckets[0] : (m <= 3 ? buckets[1] : buckets[2]);
    b.items.push(item);
  });

  buckets.filter((b) => b.items.length).forEach((b) => {
    const col = el('div', `tl-step tl-${b.key}`);
    col.appendChild(el('span', 'tl-dot'));
    col.appendChild(el('b', 'tl-title', b.title));
    col.appendChild(el('span', 'tl-when', b.when));
    const sum = b.items.reduce((s2, x) => s2 + x.value, 0);
    col.appendChild(el('span', 'tl-sum', money.format(sum)));
    const ul = el('ul', 'tl-list');
    b.items.forEach((x) => {
      const li = el('li');
      li.append(el('b', null, x.entry.name));
      li.append(document.createTextNode(` — ${x.entry.rampNote}`));
      ul.appendChild(li);
    });
    col.appendChild(ul);
    line.appendChild(col);
  });

  box.appendChild(line);
  host.appendChild(box);
}

/** Quanto e' stato tolto perche' qualcosa lo fai gia'. Va detto, non nascosto. */
function baselineNote(host, r) {
  const sistema = answers.sistema;
  if (sistema === 'carta') return;

  const lordo = r.operative.reduce((s, x) => s + x.raw, 0);
  const tolto = lordo - r.operativeTotal;
  if (tolto < 200) return;

  const box = el('div', 'note-box');
  box.append(el('b', null, 'Ho già tolto quello che fai da solo. '));
  box.append(document.createTextNode(
    `Hai detto che usi ${SISTEMI[sistema]}, quindi ho scalato ${money.format(tolto)} dal conto: quella parte la stai già recuperando. Il numero sopra è solo quello che resta.`
  ));
  host.appendChild(box);
}

function configBlock(host, r) {
  const box = el('details', 'block config-block');
  box.appendChild(el('summary', null, `Ce n'è altri ${money.format(r.configTotal)}, ma va configurato`));
  box.appendChild(el('p', 'block-sub', 'Queste cose il gestionale le sa fare, ma partono spente: finché non ci si mette il tuo prezzo orario, o non si censiscono i furgoni, valgono zero. Per questo non le ho sommate sopra.'));

  r.config.sort((a, b) => b.value - a.value).forEach((item) => {
    const row = el('div', 'rrow in');
    row.append(el('span', 'rrow-name', item.entry.name), el('span', 'rrow-val', money.format(item.value)));
    row.appendChild(el('p', 'rrow-why', item.entry.plain));
    row.appendChild(el('p', 'rrow-needs', `Serve: ${item.entry.needs}`));
    box.appendChild(row);
  });

  host.appendChild(box);
}

function ctaBlock(host, r) {
  const totale = r.operativeTotal + r.configTotal;
  const box = el('div', 'block cta-block');

  if (r.operativeTotal < SOGLIA_MEDIA) {
    // Sotto soglia non si chiede niente. Un venditore che sa dire "a te non
    // serve" e' l'unico di cui ci si fida quando invece dice che serve.
    box.classList.add('quiet');
    box.appendChild(el('h3', null, 'Nel tuo caso, lascia stare'));
    box.appendChild(el('p', null, `${money.format(r.operativeTotal)} all'anno non giustificano di cambiare il modo in cui lavori. Il gestionale te lo ripaghi quando i numeri sono altri; adesso non lo sono, e dirti il contrario sarebbe una presa in giro. Se fra un anno sei cresciuto, questo conto lo rifai in novanta secondi.`));
    host.appendChild(box);
    return;
  }

  const forte = r.operativeTotal >= SOGLIA_ALTA;
  box.appendChild(el('h3', null, forte ? 'Questi soldi ci sono già. Vuoi vedere come si recuperano?' : 'Vale la pena guardarci dentro?'));
  box.appendChild(el('p', null, forte
    ? `${money.format(r.operativeTotal)} all'anno non sono lavoro in più da trovare: sono lavoro che hai già fatto e che non è arrivato in fattura. Ti faccio vedere in dieci minuti come il gestionale li intercetta, sul tuo telefono, con un intervento vero dei tuoi.`
    : `${money.format(r.operativeTotal)} all'anno non ti cambiano la vita, ma non sono nemmeno pochi. Se vuoi, ti mostro in dieci minuti da dove escono, senza impegno e senza presentazioni.`));

  const testo = `Ciao Davide, ho fatto il quiz sul margine. Mi esce ${money.format(r.operativeTotal)} all'anno a regime, ${money.format(r.firstYear)} il primo anno${r.configTotal > 0 ? `, piu ${money.format(r.configTotal)} da configurare` : ''}. Vorrei vedere la demo del gestionale.`;
  const a = el('a', 'btn primary big whatsapp');
  a.href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(testo)}`;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = 'Scrivimi su WhatsApp';
  box.appendChild(a);

  box.appendChild(el('p', 'fineprint', `Sono Davide Cavallini, Cavallini Service, Noale. Rispondo io, non un centralino. Se poi non ti interessa me lo dici e finisce lì.${totale > 0 ? '' : ''}`));

  host.appendChild(box);
}

/*
 * La spiegazione, aperta solo da chi la vuole.
 *
 * In parole, non in formule. Le formule esistono e stanno nel documento
 * tecnico, ma mostrarle qui trasformerebbe una risposta in un compito: chi
 * legge vuole sapere se il conto sta in piedi, non ripeterlo.
 */
function plainExplanation(host, r) {
  const det = el('details', 'block explain-block');
  det.appendChild(el('summary', null, 'Come ho fatto questo conto'));

  const body = el('div', 'explain-body');

  body.appendChild(el('p', null,
    `Il conto l'hai fatto tu, io ho solo moltiplicato. Mi hai detto quanti siete e quanti interventi fate: sono circa ${num.format(r.derived.interventiAnno)} interventi in un anno. Ogni cosa che si perde una volta sola, si perde ${num.format(r.derived.interventiAnno)} volte.`));

  body.appendChild(el('p', null,
    `Poi ho preso quello che mi hai detto che oggi va perso — i minuti sul rapportino, i pezzi che non arrivano in fattura, i guasti che nessuno riprende — e l'ho moltiplicato per quel numero. Il tempo l'ho contato a quanto ti costa un'ora di tecnico, non a quanto la vendi: risparmiare un'ora non ti fa guadagnare il prezzo di vendita, ti fa risparmiare il costo. E l'ho contato solo per metà, perché un'ora libera diventa soldi soltanto se la riempi con altro lavoro.`));

  const ul = el('ul', 'explain-list');
  r.operative.filter((x) => x.value > 0).sort((a, b) => b.value - a.value).forEach((item) => {
    const li = el('li');
    li.append(el('b', null, `${money.format(item.value)} — ${item.entry.name}. `));
    li.append(document.createTextNode(item.entry.problem));
    if (item.factor < 1) {
      li.append(el('em', null, ` Di questa voce ti ho lasciato solo la parte che non copri già.`));
    }
    ul.appendChild(li);
  });
  body.appendChild(ul);

  body.appendChild(el('p', null,
    `Sul tempo: il rapportino e la firma valgono dal primo intervento, il pezzo fuori preventivo appena colleghi gli interventi ai preventivi, i guasti segnalati ci mettono qualche mese perché un preventivo accettato ha il suo giro. Per questo il primo anno vale ${money.format(r.firstYear)} e non ${money.format(r.operativeTotal)}.`));

  body.appendChild(el('p', 'warn-line',
    `Due cose che è giusto tu sappia. Primo: sono stime costruite sulle tue risposte, non misure — quanto stai davvero regalando lo sa dire solo il gestionale, e solo dopo qualche mese che lo usi. Secondo: dove non ti ho chiesto niente ho usato valori prudenti, cioè bassi, non ottimistici.`));

  sourcesBlock(body, r);

  const link = el('p', 'tech-link');
  const a = el('a', null, 'Se sei uno che vuole vedere i conti veri');
  a.href = 'docs/analisi-gestionale-commesse.md';
  link.appendChild(a);
  link.append(document.createTextNode(': formule, funzione per funzione, con i pezzi di programma che le fanno.'));
  body.appendChild(link);

  det.appendChild(body);
  host.appendChild(det);
}

/*
 * Da dove vengono i valori che non ho chiesto.
 *
 * Le fonti sono etichettate per quello che sono: i dati ufficiali da una parte,
 * le indagini di chi vende software dall'altra. Chiamare "ricerca scientifica"
 * un sondaggio di un fornitore sarebbe lo stesso genere di scorciatoia che
 * questa pagina cerca di evitare, e chi legge se ne accorge.
 *
 * I riferimenti valgono per il Nord Italia. Il criterio, dove una fonte da' un
 * intervallo, e' sempre prendere il valore basso.
 *
 * Testi in backtick e non fra apici: sono frasi italiane piene di apostrofi, e
 * la prima versione con gli apici si e' rotta esattamente li'.
 */
function sourcesBlock(host, r) {
  const det = el('details', 'sources');
  det.appendChild(el('summary', null, 'Da dove vengono i numeri che non ti ho chiesto'));
  const body = el('div', 'sources-body');

  const items = [
    {
      t: 'Costo orario del tecnico',
      v: `${answers.costoOrarioAzienda} €/h`,
      k: 'dato ufficiale — Nord Italia',
      d: `Le tabelle ministeriali sul costo del lavoro in edilizia per il 2026 danno un costo orario pieno fra 27 e 29 € per un operaio comune: paga, contributi, Cassa Edile, TFR e ore non lavorate comprese. La retribuzione lorda nelle costruzioni sta molto più in basso — ISTAT rileva 13,7 €/h — e la differenza fra i due numeri è esattamente quella che un artigiano dimentica quando fa il conto a mente. Varia per provincia: circa 27 € a Bologna, oltre 43 € ad Aosta.`,
    },
    {
      t: 'Prezzo orario di vendita',
      v: `${answers.prezzoOrarioVendita} €/h`,
      k: 'rilevazioni di mercato — Nord Italia',
      d: `Le rilevazioni sui prezzi degli idraulici in Italia danno 40-70 €/h per interventi ordinari in orario di lavoro, con il Nord sopra la media nazionale (si parla di un 30-40% in più rispetto al Sud) e Milano e Torino oltre i 70. Resto sulla parte bassa della fascia del Nord, non sulla media italiana. Il diritto di chiamata che uso, 25 €, sta dentro la media rilevata di 20-30 € per l'intervento ordinario; fuori orario le stesse fonti arrivano a 80-120 €, e lì non ci vado.`,
    },
    {
      t: 'Minuti per rapportino',
      v: `${answers.minutiRapportinoOggi} min`,
      k: 'indagine di settore, usata al ribasso',
      d: `Le indagini sul field service parlano di circa 22 minuti a rapportino e di un 18-30% del tempo speso in attività amministrative. Sono numeri di chi vende software di field service, quindi vanno presi con le molle: qui ne uso fra 3 e 14 a seconda di come hai risposto, meno della metà di quanto dichiarano loro.`,
    },
    {
      t: 'Materiale che si disperde',
      v: `${answers.pctDispersione || 0}%`,
      k: 'stima di settore',
      d: `Nelle costruzioni si stima che furti e perdite aggiungano fra l'1% e il 5% ai costi di progetto. La frase che conta però è un'altra: se non confronti quello che consegni con quello che viene installato, il furto sembra spreco, e finisci per risolvere un problema di sprechi che è un problema di controllo. Uso 0,5% se mi hai detto che tieni una lista, 5% solo se mi hai detto tu che sparisce roba.`,
    },
    {
      t: 'Ore per intervento',
      v: `${r.derived.oreMedieIntervento.toFixed(1)} h`,
      k: 'ricavato dalle tue risposte',
      d: `Non è una risposta tua: la ricavo dal ritmo che hai dichiarato, contando circa due terzi della giornata come tempo davvero sul lavoro. Serve a non far uscire conti impossibili, tipo venticinque interventi da un'ora e mezza dentro una settimana da quaranta ore.`,
    },
    {
      t: `Un'ora risparmiata vale mezz'ora di soldi`,
      v: '50%',
      k: 'scelta prudenziale dichiarata',
      d: `Il tempo che ti liberi diventa margine solo se lo riempi con altro lavoro fatturabile. Altrimenti è comodità, che un valore ce l'ha ma non entra in cassa. Per questo dimezzo tutte le voci di tempo, ed è il taglio più grosso che mi faccio da solo.`,
    },
  ];

  if (r.cappedOperative) {
    items.push({
      t: 'Tetto sul totale',
      v: '9% del fatturato',
      k: 'rete di sicurezza, e qui è scattata',
      d: `Con le tue risposte il conto grezzo usciva sopra il 9% del fatturato che stimo per te, e l'ho tagliato fino a lì, abbassando tutte le voci nella stessa proporzione. Sopra quella soglia il numero smette di descrivere un'impresa vera, e uno che non riconosci come tuo non ti serve a niente.`,
    });
  }

  items.forEach((it) => {
    const row = el('div', 'source-row');
    const head = el('p', 'source-head');
    head.append(el('b', null, it.t), el('span', 'source-val', it.v));
    row.append(head, el('p', 'source-kind', it.k), el('p', 'source-desc', it.d));
    body.appendChild(row);
  });

  body.appendChild(el('p', 'source-note',
    `I riferimenti valgono per il Nord Italia: più a sud tariffe e costo del lavoro scendono, e con loro tutto il conto. Nessuna di queste è una legge di natura, e le percentuali sul field service arrivano da chi ha interesse a farle sembrare alte: dove c'era un intervallo ho preso il valore basso, e dove il numero era loro l'ho più che dimezzato.`));

  det.appendChild(body);
  host.appendChild(det);
}

function restartBlock(host) {
  const wrap = el('div', 'restart');
  const b = el('button', 'btn ghost', 'Rifai il quiz');
  b.type = 'button';
  b.addEventListener('click', () => {
    Object.assign(answers, DEFAULTS);
    for (const k of Object.keys(chosen)) delete chosen[k];
    step = -1;
    renderIntro();
    scrollTop();
  });
  wrap.appendChild(b);
  host.appendChild(wrap);
}

/* ---------- tema ---------- */

const themeBtn = document.getElementById('theme-toggle');
try {
  const t = localStorage.getItem('margine:theme');
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
} catch { /* preferenza non leggibile: si usa quella di sistema */ }

themeBtn?.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const isDark = cur ? cur === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  const next = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('margine:theme', next); } catch { /* niente */ }
});

renderIntro();
