import { INPUTS, OPERATIVE, CONFIG, FUTURE, derive } from './model.js';

const STORAGE_KEY = 'margine-idraulici:v1';
const money = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const state = {};
for (const group of INPUTS) {
  for (const item of group.items) state[item.id] = item.value;
}

/* Le impostazioni sopravvivono alla chiusura della pagina: chi apre questo
   calcolatore lo apre più di una volta, e riscrivere quindici numeri ogni
   volta è il motivo per cui non lo si riapre. */
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  for (const [k, v] of Object.entries(saved)) {
    if (k in state && Number.isFinite(v)) state[k] = v;
  }
} catch { /* preferenze illeggibili: si riparte dai valori di partenza */ }

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* niente da fare */ }
}

/* ---------- modulo di inserimento ---------- */

function buildInputs() {
  const host = document.getElementById('inputs');
  const frag = document.createDocumentFragment();

  for (const group of INPUTS) {
    const title = document.createElement('p');
    title.className = 'fieldset-title';
    title.textContent = group.group;
    frag.appendChild(title);

    for (const item of group.items) {
      const wrap = document.createElement('div');
      wrap.className = 'field';

      const label = document.createElement('label');
      label.setAttribute('for', `f-${item.id}`);
      label.append(document.createTextNode(item.label));

      const hint = document.createElement('span');
      hint.className = 'hint';
      hint.textContent = item.hint;
      label.appendChild(hint);

      const input = document.createElement('input');
      input.type = 'number';
      input.id = `f-${item.id}`;
      input.value = String(state[item.id]);
      input.min = String(item.min);
      input.max = String(item.max);
      input.step = String(item.step);
      input.inputMode = 'decimal';

      input.addEventListener('input', () => {
        const raw = parseFloat(input.value);
        // Un campo svuotato vale zero invece di rompere tutto il conto.
        const n = Number.isFinite(raw) ? Math.min(item.max, Math.max(item.min, raw)) : item.min;
        state[item.id] = n;
        persist();
        render();
      });

      wrap.append(label, input);
      frag.appendChild(wrap);
    }
  }

  host.appendChild(frag);
}

/* ---------- righe di risultato ---------- */

function tag(text, cls) {
  const el = document.createElement('span');
  el.className = cls ? `tag ${cls}` : 'tag';
  el.textContent = text;
  return el;
}

function buildRow(entry, value, explanation) {
  const row = document.createElement('div');
  row.className = 'row';

  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = entry.name;

  const val = document.createElement('div');
  val.className = 'value';
  val.textContent = value === null ? '—' : money.format(value);

  const why = document.createElement('p');
  why.className = 'why';
  why.textContent = entry.problem;

  const formula = document.createElement('div');
  formula.className = 'formula';
  formula.textContent = `${entry.formula}\n= ${explanation}`;

  const meta = document.createElement('div');
  meta.className = 'meta';
  if (entry.confidence) {
    meta.appendChild(tag(`confidenza ${entry.confidence}`, `conf-${entry.confidence}`));
  }
  if (entry.needs) meta.appendChild(tag(`serve: ${entry.needs}`, 'needs'));
  for (const file of entry.files) {
    meta.appendChild(tag(file.split('/').pop().replace('.php', ''), 'code'));
  }

  row.append(name, val, why, formula, meta);
  return row;
}

function renderList(hostId, entries, derived) {
  const host = document.getElementById(hostId);
  host.textContent = '';
  let total = 0;

  for (const entry of entries) {
    const value = entry.compute(state, derived);
    if (typeof value === 'number') total += value;
    host.appendChild(buildRow(entry, value, entry.explain(state, derived)));
  }

  return total;
}

/* ---------- beneficio futuro ---------- */

function renderFuture(derived) {
  const host = document.getElementById('future-rows');
  host.textContent = '';

  for (const entry of FUTURE) {
    const value = entry.compute(state, derived);

    const row = document.createElement('div');
    row.className = 'row';

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = entry.name;

    const val = document.createElement('div');
    val.className = 'value';
    val.textContent = value === null ? 'non stimato' : money.format(value);

    const why = document.createElement('p');
    why.className = 'why';
    why.textContent = entry.problem;

    const exists = document.createElement('p');
    exists.className = 'why';
    exists.innerHTML = `<b>Cosa c'è già:</b> ${escapeHtml(entry.whatExists)}`;

    const misses = document.createElement('p');
    misses.className = 'why';
    misses.innerHTML = `<b>Cosa manca:</b> ${escapeHtml(entry.whatMisses)}`;

    const formula = document.createElement('div');
    formula.className = 'formula';
    formula.textContent = `${entry.formula}\n= ${entry.explain(state, derived)}`;

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.appendChild(tag(entry.state));
    for (const file of entry.files) {
      meta.appendChild(tag(file.split('/').pop().replace('.php', ''), 'code'));
    }

    row.append(name, val, why, exists, misses, formula, meta);
    host.appendChild(row);
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- disegno completo ---------- */

function render() {
  const derived = derive(state);

  const operativeTotal = renderList('operative-rows', OPERATIVE, derived);
  const configTotal = renderList('config-rows', CONFIG, derived);
  renderFuture(derived);

  document.getElementById('headline-amount').textContent = money.format(operativeTotal);
  document.getElementById('config-subtotal').textContent = money.format(configTotal);

  document.getElementById('stat-interventi').textContent = derived.interventiAnno.toLocaleString('it-IT');
  document.getElementById('stat-intervento').textContent = derived.interventiAnno > 0
    ? money.format(operativeTotal / derived.interventiAnno)
    : '—';
  document.getElementById('stat-tecnico').textContent = state.tecnici > 0
    ? money.format(operativeTotal / state.tecnici)
    : '—';

  // Nessun totale combinato, di proposito: sommare la sezione da configurare a
  // quella operativa darebbe un numero che oggi non esiste per nessuno.
}

/* ---------- tema ---------- */

const themeBtn = document.getElementById('theme-toggle');
const savedTheme = (() => {
  try { return localStorage.getItem('margine-idraulici:theme'); } catch { return null; }
})();
if (savedTheme === 'light' || savedTheme === 'dark') {
  document.documentElement.setAttribute('data-theme', savedTheme);
}

themeBtn.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const isDarkNow = current
    ? current === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches;
  const next = isDarkNow ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('margine-idraulici:theme', next); } catch { /* niente */ }
});

/* ---------- azioni ---------- */

document.getElementById('reset').addEventListener('click', () => {
  for (const group of INPUTS) {
    for (const item of group.items) {
      state[item.id] = item.value;
      const el = document.getElementById(`f-${item.id}`);
      if (el) el.value = String(item.value);
    }
  }
  persist();
  render();
});

document.getElementById('print').addEventListener('click', () => window.print());

buildInputs();
render();
