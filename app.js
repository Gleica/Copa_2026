import { figurinhas } from './data/figurinhas.js';

// ── Logic ─────────────────────────────────────────────────────────────────────

function normalize(str) {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function searchTeams(query) {
  const q = normalize(query.trim());
  if (!q) return [];
  return figurinhas.filter(t =>
    normalize(t.code).startsWith(q) ||
    normalize(t.name).includes(q)
  );
}

function isNeeded(team, num) {
  return team.missing.includes(num);
}

function totalMissing() {
  return figurinhas.reduce((acc, t) => acc + t.missing.length, 0);
}

// ── State ─────────────────────────────────────────────────────────────────────

let state = {
  query:           '',
  filteredTeams:   [],
  selectedTeam:    null,
  stickerNum:      '',
  dropdownOpen:    false,
  highlightedIdx:  0,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Templates ─────────────────────────────────────────────────────────────────

function tplHeader() {
  return `
    <header class="header">
      <div class="header__top">
        <h1 class="header__title">
          Conferidor <span class="header__accent">Copa 2026</span>
        </h1>
      </div>
      <p class="header__stats">
        <strong>${totalMissing()}</strong> figurinhas faltando
        &nbsp;·&nbsp;
        <strong>${figurinhas.length}</strong> seleções
      </p>
    </header>
  `;
}

function tplDropdown() {
  const { filteredTeams, dropdownOpen, highlightedIdx, query } = state;
  if (!dropdownOpen || !query) return '';

  if (filteredTeams.length === 0) {
    return `<div class="dropdown dropdown--empty">Nenhuma seleção encontrada</div>`;
  }

  return `
    <ul class="dropdown" role="listbox" id="team-listbox">
      ${filteredTeams.map((t, i) => `
        <li class="dropdown__item${i === highlightedIdx ? ' dropdown__item--hi' : ''}"
            role="option"
            data-index="${i}"
            aria-selected="${i === highlightedIdx}">
          <span class="dropdown__code">${esc(t.code)}</span>
          <span class="dropdown__name">${esc(t.name)}</span>
          <span class="dropdown__page">p.${esc(String(t.page))}</span>
        </li>
      `).join('')}
    </ul>
  `;
}

function tplSearch() {
  const { query, selectedTeam, stickerNum, dropdownOpen } = state;
  return `
    <div class="search">
      <div class="field">
        <label class="field__label" for="team-input">Seleção</label>
        <div class="field__wrap" id="team-wrap">
          <input
            class="field__input"
            type="text"
            id="team-input"
            placeholder="Ex: bra, brasil, tchequia…"
            value="${esc(query)}"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="${dropdownOpen}"
            aria-controls="team-listbox"
          />
          ${selectedTeam ? `
            <button class="field__clear" id="clear-btn" type="button" aria-label="Limpar seleção">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
              </svg>
            </button>
          ` : ''}
          ${tplDropdown()}
        </div>
      </div>

      <div class="field">
        <label class="field__label" for="num-input">Nº da figurinha</label>
        <input
          class="field__input field__input--num"
          type="number"
          id="num-input"
          placeholder="Ex: 7"
          min="1"
          max="20"
          inputmode="numeric"
          value="${esc(stickerNum)}"
          ${!selectedTeam ? 'disabled aria-disabled="true"' : ''}
        />
      </div>
    </div>
  `;
}

function tplResult() {
  const { selectedTeam, stickerNum } = state;
  if (!selectedTeam || stickerNum === '') return '';

  const num = parseInt(stickerNum, 10);
  if (isNaN(num) || num < 1) return '';

  const needed = isNeeded(selectedTeam, num);
  const mod    = needed ? 'needed' : 'have';

  return `
    <div class="result result--${mod}" aria-live="assertive" aria-atomic="true">
      <span class="result__label">${esc(selectedTeam.code)} · figurinha ${num}</span>
      <span class="result__verdict">${needed ? 'PRECISA!' : 'JÁ TEM'}</span>
      <span class="result__sub">${needed ? 'Está na lista de faltantes' : 'Não precisa desta'}</span>
    </div>
  `;
}

function tplTeamCard() {
  const { selectedTeam, stickerNum } = state;
  if (!selectedTeam) return '';

  const checkedNum = parseInt(stickerNum, 10);
  const chips = selectedTeam.missing.map(n =>
    `<span class="chip${n === checkedNum ? ' chip--active' : ''}">${n}</span>`
  ).join('');

  return `
    <section class="team-card">
      <div class="team-card__head">
        <div class="team-card__id">
          <span class="team-card__code">${esc(selectedTeam.code)}</span>
          <span class="team-card__name">${esc(selectedTeam.name)}</span>
        </div>
        <span class="team-card__badge">${selectedTeam.missing.length} faltando</span>
      </div>
      <p class="team-card__page">Página ${esc(String(selectedTeam.page))}</p>
      <div class="chips">
        ${chips || '<span class="chips__empty">Nenhuma faltando!</span>'}
      </div>
    </section>
  `;
}

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
  document.getElementById('app').innerHTML = `
    ${tplHeader()}
    <main class="main">
      ${tplSearch()}
      ${tplResult()}
      ${tplTeamCard()}
    </main>
  `;
  attachEvents();
}

// ── Events ────────────────────────────────────────────────────────────────────

function attachEvents() {
  const teamInput = document.getElementById('team-input');
  const numInput  = document.getElementById('num-input');
  const clearBtn  = document.getElementById('clear-btn');
  const wrap      = document.getElementById('team-wrap');

  teamInput?.addEventListener('input',   onTeamInput);
  teamInput?.addEventListener('keydown', onTeamKeydown);
  teamInput?.addEventListener('focus',   onTeamFocus);
  numInput?.addEventListener('input',    onNumInput);
  clearBtn?.addEventListener('click',    onClearTeam);
  wrap?.addEventListener('click',        onWrapClick);
}

function onTeamInput(e) {
  const query    = e.target.value;
  const filtered = searchTeams(query);
  state = { ...state, query, filteredTeams: filtered, dropdownOpen: query.length > 0,
            highlightedIdx: 0, selectedTeam: null, stickerNum: '' };
  render();
  refocus('team-input');
}

function onTeamFocus() {
  if (state.query && !state.selectedTeam && state.filteredTeams.length > 0 && !state.dropdownOpen) {
    state = { ...state, dropdownOpen: true };
    render();
    refocus('team-input');
  }
}

function onTeamKeydown(e) {
  if (!state.dropdownOpen) return;
  const { filteredTeams, highlightedIdx } = state;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    state = { ...state, highlightedIdx: Math.min(highlightedIdx + 1, filteredTeams.length - 1) };
    render(); refocus('team-input');
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    state = { ...state, highlightedIdx: Math.max(highlightedIdx - 1, 0) };
    render(); refocus('team-input');
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const team = filteredTeams[highlightedIdx >= 0 ? highlightedIdx : 0];
    if (team) selectTeam(team);
  } else if (e.key === 'Escape') {
    state = { ...state, dropdownOpen: false };
    render(); refocus('team-input');
  }
}

function onNumInput(e) {
  state = { ...state, stickerNum: e.target.value };
  render();
  refocus('num-input');
}

function onClearTeam() {
  state = { ...state, query: '', selectedTeam: null, filteredTeams: [],
            dropdownOpen: false, stickerNum: '' };
  render();
  refocus('team-input');
}

function onWrapClick(e) {
  const item = e.target.closest('.dropdown__item');
  if (!item) return;
  const team = state.filteredTeams[parseInt(item.dataset.index, 10)];
  if (team) selectTeam(team);
}

function selectTeam(team) {
  state = { ...state, selectedTeam: team, query: `${team.code} — ${team.name}`,
            dropdownOpen: false, filteredTeams: [], stickerNum: '' };
  render();
  refocus('num-input');
}

function refocus(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.focus();
  // After a full re-render the new input element's cursor defaults to position 0
  // on several mobile browsers, causing reversed typing. Move it to the end.
  if (el.type !== 'number') {
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('click', (e) => {
  if (!e.target.closest('#team-wrap') && state.dropdownOpen) {
    state = { ...state, dropdownOpen: false };
    render();
  }
});

render();
