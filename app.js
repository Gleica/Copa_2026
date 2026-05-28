import { figurinhas }      from './data/figurinhas.js';
import { ACCESS_PIN_HASH } from './config.js';
import { fetchFaltantes, markCollected, undoCollected, fetchRecents, subscribeToChanges } from './db.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const ALBUM_TOTAL = 979;

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
  return state.teams.filter(t =>
    normalize(t.code).startsWith(q) ||
    normalize(t.name).includes(q)
  );
}

function isNeeded(team, num) {
  return team.missing.includes(num);
}

function totalMissing() {
  return state.teams.reduce((acc, t) => acc + t.missing.length, 0);
}

function updateTeamMissing(teamCode, number, action) {
  return state.teams.map(t => {
    if (t.code !== teamCode) return t;
    const missing = action === 'remove'
      ? t.missing.filter(n => n !== number)
      : [...t.missing, number].sort((a, b) => a - b);
    return { ...t, missing };
  });
}

function quickCheck(input) {
  if (!input.trim()) return null;
  const m = input.trim().match(/^([a-zA-Z]{2,4})\s*[-]?\s*(\d{1,2})$/);
  if (!m) return null;
  const code = m[1].toUpperCase();
  const num  = parseInt(m[2], 10);
  const team = state.teams.find(t => t.code === code);
  if (!team) return null;
  return { team, num, needed: isNeeded(team, num) };
}

async function verifyPin(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hex === ACCESS_PIN_HASH;
}

async function loadTeams() {
  const data = await fetchFaltantes();
  const byTeam = {};
  for (const row of data) {
    if (!byTeam[row.team_code]) byTeam[row.team_code] = [];
    byTeam[row.team_code].push(row.number);
  }
  return figurinhas.map(team => ({
    ...team,
    missing: (byTeam[team.code] || []).sort((a, b) => a - b),
  }));
}

// ── State ─────────────────────────────────────────────────────────────────────

let state = {
  view:           'check',
  query:          '',
  filteredTeams:  [],
  selectedTeam:   null,
  stickerNum:     '',
  dropdownOpen:   false,
  highlightedIdx: 0,
  quickInput:     '',
  source:         'loading',
  teams:          [],
  userName:       localStorage.getItem('fifa26_username') || '',
  showNamePrompt: false,
  recents:        [],
  recentsOpen:    false,
  recentsLoading: false,
  canEdit:        localStorage.getItem('fifa26_edit_unlocked') === 'true',
  showPinPrompt:  false,
  initialized:    false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTime(isoStr) {
  if (!isoStr) return '';
  return new Date(isoStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ── Toast ─────────────────────────────────────────────────────────────────────

let toastTimer = null;

function showToast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('toast--visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('toast--visible'), 3500);
}

// ── Export ────────────────────────────────────────────────────────────────────

function buildExportText() {
  const lines = state.teams
    .filter(t => t.missing.length > 0)
    .map(t => `${t.code} - ${t.name}: ${t.missing.join(', ')}`);
  return `Copa 2026 - Figurinhas Faltando\nTotal: ${totalMissing()}\n\n${lines.join('\n')}`;
}

async function exportList() {
  const text = buildExportText();
  if (navigator.share) {
    try { await navigator.share({ text }); return; } catch { /* cancelado */ }
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast('Lista copiada para a área de transferência!');
  } catch {
    showToast('Não foi possível copiar. Tente novamente.');
  }
}

// ── Templates ─────────────────────────────────────────────────────────────────

function tplSourceBadge() {
  const { source } = state;
  if (source === 'loading') return `<span class="badge badge--loading">carregando...</span>`;
  if (source === 'cloud')   return `<span class="badge badge--cloud">nuvem</span>`;
  return                           `<span class="badge badge--local">local</span>`;
}

function tplHeader() {
  const { source, teams, canEdit } = state;
  const stats = source === 'loading'
    ? 'buscando dados...'
    : `<strong>${totalMissing()}</strong> faltando &nbsp;&middot;&nbsp; <strong>${teams.length}</strong> seleções`;
  const lockSvg = canEdit
    ? `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="3" y="7" width="10" height="8" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M5 7V5a3 3 0 0 1 6 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="3" y="7" width="10" height="8" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return `
    <header class="header">
      <div class="header__top">
        <h1 class="header__title">
          Conferidor <span class="header__accent">Copa 2026</span>
        </h1>
        <div class="header__right">
          ${tplSourceBadge()}
          <button class="lock-btn${canEdit ? ' lock-btn--unlocked' : ''}" id="lock-btn" type="button"
            aria-label="${canEdit ? 'Bloquear edição' : 'Desbloquear edição'}">
            ${lockSvg}
          </button>
        </div>
      </div>
      <p class="header__stats">${stats}</p>
    </header>
  `;
}

function tplNav() {
  const { view, source } = state;
  if (source === 'loading') return '';
  return `
    <nav class="nav" aria-label="Navegação principal">
      <button class="nav__tab${view === 'check' ? ' nav__tab--active' : ''}"
              type="button" data-view="check" role="tab" aria-selected="${view === 'check'}">
        Conferir
      </button>
      <button class="nav__tab${view === 'progress' ? ' nav__tab--active' : ''}"
              type="button" data-view="progress" role="tab" aria-selected="${view === 'progress'}">
        Progresso
      </button>
    </nav>
  `;
}

function tplOfflineBanner() {
  if (state.source !== 'local') return '';
  return `
    <div class="offline-banner" role="alert">
      Sem conexão com o Supabase &mdash; usando dados locais (somente leitura)
    </div>
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
            role="option" data-index="${i}" aria-selected="${i === highlightedIdx}">
          <span class="dropdown__code">${esc(t.code)}</span>
          <span class="dropdown__name">${esc(t.name)}</span>
          <span class="dropdown__page">p.${esc(String(t.page))}</span>
        </li>
      `).join('')}
    </ul>
  `;
}

function tplQuickCheck() {
  const { quickInput } = state;
  const result = quickCheck(quickInput);
  let resultHtml = '';
  if (quickInput.trim() && result) {
    const mod = result.needed ? 'needed' : 'have';
    resultHtml = `
      <div class="quick-result quick-result--${mod}" aria-live="polite" aria-atomic="true">
        <span class="quick-result__code">${esc(result.team.code)} #${result.num}</span>
        <span class="quick-result__verdict">${result.needed ? 'PRECISA!' : 'JÁ TEM'}</span>
      </div>`;
  } else if (quickInput.trim()) {
    resultHtml = `<p class="quick-result__hint" aria-live="polite">Código não encontrado &mdash; ex: BRA 8</p>`;
  }
  return `
    <div class="field">
      <label class="field__label" for="quick-input">Busca rápida</label>
      <input class="field__input" type="text" id="quick-input"
        placeholder="Ex: BRA 8, ARG 12"
        value="${esc(quickInput)}"
        autocomplete="off" autocorrect="off" autocapitalize="characters"
        spellcheck="false" inputmode="search" />
      ${resultHtml}
    </div>
  `;
}

function tplSearch() {
  const { query, selectedTeam, stickerNum, dropdownOpen } = state;
  return `
    <div class="search">
      <div class="field">
        <label class="field__label" for="team-input">Seleção</label>
        <div class="field__wrap" id="team-wrap">
          <input class="field__input" type="text" id="team-input"
            placeholder="Ex: bra, brasil, tchequia..."
            value="${esc(query)}"
            autocomplete="off" autocorrect="off" spellcheck="false"
            role="combobox" aria-autocomplete="list"
            aria-expanded="${dropdownOpen}" aria-controls="team-listbox" />
          ${selectedTeam ? `
            <button class="field__clear" id="clear-btn" type="button" aria-label="Limpar seleção">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
              </svg>
            </button>` : ''}
          ${tplDropdown()}
        </div>
      </div>
      <div class="field">
        <label class="field__label" for="num-input">Nº da figurinha</label>
        <input class="field__input field__input--num" type="number" id="num-input"
          placeholder="Ex: 7" min="1" max="20" inputmode="numeric"
          value="${esc(stickerNum)}"
          ${!selectedTeam ? 'disabled aria-disabled="true"' : ''} />
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
      <span class="result__label">${esc(selectedTeam.code)} &middot; figurinha ${num}</span>
      <span class="result__verdict">${needed ? 'PRECISA!' : 'JÁ TEM'}</span>
      <span class="result__sub">${needed ? 'Está na lista de faltantes' : 'Não precisa desta'}</span>
    </div>
  `;
}

function tplTeamCard() {
  const { selectedTeam, stickerNum, source, canEdit } = state;
  if (!selectedTeam) return '';
  const checkedNum  = parseInt(stickerNum, 10);
  const interactive = canEdit && source === 'cloud';
  const chips = selectedTeam.missing.map(n => {
    const isActive = n === checkedNum;
    if (interactive) {
      return `<button type="button" class="chip${isActive ? ' chip--active' : ''}" data-num="${n}" aria-label="Marcar figurinha ${n} como colada">${n}</button>`;
    }
    return `<span class="chip${isActive ? ' chip--active' : ''}">${n}</span>`;
  }).join('');
  const hint = interactive
    ? '<p class="chips__hint">Toque num número para marcar como colada</p>'
    : source === 'cloud' && !canEdit
      ? '<p class="chips__hint">Bloqueado — toque no cadeado para editar</p>'
      : '';
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
      ${hint}
    </section>
  `;
}

function tplRecents() {
  const { recentsOpen, recents, recentsLoading, source, canEdit } = state;
  if (source !== 'cloud' || !canEdit) return '';
  const chevron = recentsOpen ? '&uarr;' : '&darr;';
  let body = '';
  if (recentsOpen) {
    if (recentsLoading) {
      body = `<p class="recents__empty">Carregando...</p>`;
    } else if (recents.length === 0) {
      body = `<p class="recents__empty">Nenhuma figurinha colada ainda.</p>`;
    } else {
      body = `<ul class="recents__list">
        ${recents.map(r => `
          <li class="recents__item">
            <span class="recents__info">
              <span class="recents__code">${esc(r.team_code)}</span>
              <span class="recents__num">#${r.number}</span>
              <span class="recents__by">${esc(r.updated_by || '?')}</span>
              <span class="recents__time">${formatTime(r.updated_at)}</span>
            </span>
            <button type="button" class="recents__undo"
              data-team="${esc(r.team_code)}" data-num="${r.number}"
              aria-label="Desfazer figurinha ${r.team_code} ${r.number}">desfazer</button>
          </li>`).join('')}
      </ul>`;
    }
  }
  return `
    <div class="recents">
      <button class="recents__toggle" id="recents-toggle" type="button" aria-expanded="${recentsOpen}">
        Coladas recentes ${chevron}
      </button>
      ${body}
    </div>
  `;
}

function tplProgress() {
  const { teams } = state;
  const collected  = ALBUM_TOTAL - totalMissing();
  const pct        = ALBUM_TOTAL > 0 ? Math.round(collected / ALBUM_TOTAL * 100) : 0;
  const completed  = teams.filter(t => t.missing.length === 0);
  const incomplete = [...teams.filter(t => t.missing.length > 0)]
    .sort((a, b) => a.missing.length - b.missing.length);
  return `
    <main class="main">
      <div class="prog-summary">
        <div class="prog-stat">
          <span class="prog-stat__num">${totalMissing()}</span>
          <span class="prog-stat__label">faltando</span>
        </div>
        <div class="prog-stat">
          <span class="prog-stat__num prog-stat__num--accent">${collected}</span>
          <span class="prog-stat__label">coladas</span>
        </div>
        <div class="prog-stat">
          <span class="prog-stat__num prog-stat__num--green">${completed.length}</span>
          <span class="prog-stat__label">completas</span>
        </div>
      </div>
      <div class="prog-bar-wrap" role="progressbar"
           aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"
           aria-label="Progresso: ${pct}%">
        <div class="prog-bar" style="width: ${pct}%"></div>
      </div>
      <p class="prog-bar__label">${pct}% do álbum (${ALBUM_TOTAL - totalMissing()} de ${ALBUM_TOTAL})</p>
      ${incomplete.length > 0 ? `
        <ul class="prog-list" aria-label="Seleções com faltantes">
          ${incomplete.map(t => `
            <li class="prog-item">
              <span class="prog-item__code">${esc(t.code)}</span>
              <span class="prog-item__name">${esc(t.name)}</span>
              <span class="prog-item__count">${t.missing.length}</span>
            </li>`).join('')}
        </ul>` : ''}
      ${completed.length > 0 ? `
        <p class="prog-section-label">Seleções completas</p>
        <ul class="prog-list prog-list--done" aria-label="Seleções completas">
          ${completed.map(t => `
            <li class="prog-item prog-item--done">
              <span class="prog-item__code">${esc(t.code)}</span>
              <span class="prog-item__name">${esc(t.name)}</span>
              <span class="prog-item__check" aria-label="completa">&#10003;</span>
            </li>`).join('')}
        </ul>` : ''}
    </main>
  `;
}

function tplNamePrompt() {
  return `
    <div class="name-prompt" role="dialog" aria-modal="true" aria-labelledby="name-prompt-title">
      <div class="name-prompt__card">
        <h2 class="name-prompt__title" id="name-prompt-title">Qual é o seu perfil?</h2>
        <p class="name-prompt__sub">Escolha para identificar quem colou cada figurinha.</p>
        <div class="name-choices">
          <button class="name-choice-btn" type="button" data-name="Gleica">Gleica</button>
          <button class="name-choice-btn" type="button" data-name="Patty">Patty</button>
        </div>
      </div>
    </div>
  `;
}

function tplPinPrompt() {
  return `
    <div class="name-prompt" role="dialog" aria-modal="true" aria-labelledby="pin-prompt-title">
      <div class="name-prompt__card">
        <h2 class="name-prompt__title" id="pin-prompt-title">Modo editor</h2>
        <p class="name-prompt__sub">Digite o PIN para poder marcar e desmarcar figurinhas.</p>
        <input class="field__input name-prompt__input" type="password" id="pin-input"
          placeholder="PIN" autocomplete="current-password" maxlength="50" />
        <p class="pin-error" id="pin-error" aria-live="polite"></p>
        <button class="name-prompt__btn" id="pin-save-btn" type="button">Entrar como editor</button>
        <button class="name-prompt__btn name-prompt__btn--cancel" id="pin-cancel-btn" type="button">Cancelar</button>
      </div>
    </div>
  `;
}

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
  const { source, showNamePrompt, showPinPrompt, view } = state;

  // Main UI — always rendered so inputs and events stay alive
  let body = '';
  if (source === 'loading') {
    body = `<div class="loading" aria-live="polite" aria-busy="true">Buscando figurinhas...</div>`;
  } else if (view === 'progress') {
    body = `${tplOfflineBanner()}${tplProgress()}`;
  } else {
    body = `
      ${tplOfflineBanner()}
      <main class="main">
        ${tplQuickCheck()}
        <div class="search-divider" role="separator"></div>
        ${tplSearch()}
        ${tplResult()}
        ${tplTeamCard()}
        ${tplRecents()}
      </main>`;
  }
  document.getElementById('app').innerHTML = `${tplHeader()}${tplNav()}${body}`;
  if (source !== 'loading') attachEvents();

  // Modal overlay — rendered in separate div so it never disturbs #app events
  const modalEl = document.getElementById('modal');
  if (showPinPrompt) {
    modalEl.innerHTML = tplPinPrompt();
    attachPinPromptEvents();
  } else if (showNamePrompt) {
    modalEl.innerHTML = tplNamePrompt();
    attachNamePromptEvents();
  } else {
    modalEl.innerHTML = '';
  }
}

// ── Events ────────────────────────────────────────────────────────────────────

function attachEvents() {
  const navEl      = document.querySelector('.nav');
  const quickInput = document.getElementById('quick-input');
  const teamInput  = document.getElementById('team-input');
  const numInput   = document.getElementById('num-input');
  const clearBtn   = document.getElementById('clear-btn');
  const wrap       = document.getElementById('team-wrap');
  const recentsBtn = document.getElementById('recents-toggle');
  const card       = document.querySelector('.team-card .chips');
  const lockBtn    = document.getElementById('lock-btn');

  navEl?.addEventListener('click',       onNavClick);
  quickInput?.addEventListener('input',  onQuickInput);
  teamInput?.addEventListener('input',   onTeamInput);
  teamInput?.addEventListener('keydown', onTeamKeydown);
  teamInput?.addEventListener('focus',   onTeamFocus);
  numInput?.addEventListener('input',    onNumInput);
  clearBtn?.addEventListener('click',    onClearTeam);
  wrap?.addEventListener('click',        onWrapClick);
  recentsBtn?.addEventListener('click',  onRecentsToggle);
  card?.addEventListener('click',        onChipClick);
  document.querySelector('.recents__list')?.addEventListener('click', onUndoClick);
  lockBtn?.addEventListener('click',     onLockClick);
}

function attachNamePromptEvents() {
  document.querySelectorAll('.name-choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.name;
      if (!name) return;
      localStorage.setItem('fifa26_username', name);
      state = { ...state, userName: name, showNamePrompt: false };
      render();
      init();
    });
  });
}

function attachPinPromptEvents() {
  const input     = document.getElementById('pin-input');
  const saveBtn   = document.getElementById('pin-save-btn');
  const cancelBtn = document.getElementById('pin-cancel-btn');
  const errorEl   = document.getElementById('pin-error');
  input?.focus();

  const confirm = async () => {
    const pin = (input?.value || '').trim();
    if (!pin) return;
    const ok = await verifyPin(pin);
    if (!ok) {
      if (errorEl) errorEl.textContent = 'PIN incorreto. Tente novamente.';
      if (input) { input.value = ''; input.focus(); }
      return;
    }
    localStorage.setItem('fifa26_edit_unlocked', 'true');
    const needsName = !state.userName;
    state = { ...state, canEdit: true, showPinPrompt: false, showNamePrompt: needsName };
    render();
  };

  const cancel = () => {
    state = { ...state, showPinPrompt: false };
    render();
  };

  saveBtn?.addEventListener('click', confirm);
  cancelBtn?.addEventListener('click', cancel);
  input?.addEventListener('keydown', e => { if (e.key === 'Enter') confirm(); });
}

function onLockClick() {
  if (state.canEdit) {
    localStorage.removeItem('fifa26_edit_unlocked');
    state = { ...state, canEdit: false };
    render();
    showToast('Modo visualização ativado.');
  } else {
    state = { ...state, showPinPrompt: true };
    render();
  }
}

function onNavClick(e) {
  const btn = e.target.closest('.nav__tab');
  if (!btn || !btn.dataset.view) return;
  state = { ...state, view: btn.dataset.view };
  render();
}

function onQuickInput(e) {
  state = { ...state, quickInput: e.target.value };
  render();
  refocus('quick-input');
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

async function onChipClick(e) {
  const btn = e.target.closest('.chip');
  if (!btn || !btn.dataset.num) return;
  const num       = parseInt(btn.dataset.num, 10);
  const team      = state.selectedTeam;
  if (!team) return;
  const prevTeams = state.teams;
  const prevTeam  = state.selectedTeam;
  const nextTeams = updateTeamMissing(team.code, num, 'remove');
  const nextTeam  = nextTeams.find(t => t.code === team.code) || null;
  state = { ...state, teams: nextTeams, selectedTeam: nextTeam };
  render();
  refocus('num-input');
  try {
    await markCollected(team.code, num, state.userName);
    if (state.recentsOpen) await reloadRecents();
  } catch (err) {
    console.warn('markCollected falhou, revertendo:', err.message);
    state = { ...state, teams: prevTeams, selectedTeam: prevTeam };
    render();
    showToast('Erro ao salvar. Tente novamente.');
  }
}

async function onUndoClick(e) {
  const btn = e.target.closest('.recents__undo');
  if (!btn) return;
  const teamCode    = btn.dataset.team;
  const number      = parseInt(btn.dataset.num, 10);
  const prevTeams   = state.teams;
  const prevRecents = state.recents;
  const nextTeams   = updateTeamMissing(teamCode, number, 'add');
  const nextRecents = state.recents.filter(r => !(r.team_code === teamCode && r.number === number));
  const nextTeam    = state.selectedTeam?.code === teamCode
    ? nextTeams.find(t => t.code === teamCode) || null
    : state.selectedTeam;
  state = { ...state, teams: nextTeams, selectedTeam: nextTeam, recents: nextRecents };
  render();
  try {
    await undoCollected(teamCode, number, state.userName);
  } catch (err) {
    console.warn('undoCollected falhou, revertendo:', err.message);
    state = { ...state, teams: prevTeams, recents: prevRecents };
    render();
    showToast('Erro ao desfazer. Tente novamente.');
  }
}

async function onRecentsToggle() {
  const opening = !state.recentsOpen;
  state = { ...state, recentsOpen: opening, recentsLoading: opening };
  render();
  if (opening) await reloadRecents();
}

async function reloadRecents() {
  try {
    const recents = await fetchRecents(20);
    state = { ...state, recents, recentsLoading: false };
  } catch {
    state = { ...state, recents: [], recentsLoading: false };
  }
  render();
}

function selectTeam(team) {
  state = { ...state, selectedTeam: team, query: `${team.code} - ${team.name}`,
            dropdownOpen: false, filteredTeams: [], stickerNum: '' };
  render();
  refocus('num-input');
}

function refocus(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.focus();
  if (el.type !== 'number') {
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }
}

// ── Realtime ──────────────────────────────────────────────────────────────────

function handleRemoteUpdate(payload) {
  const row = payload.new;
  if (!row) return;
  const isOwnUpdate = row.updated_by === state.userName;
  const action      = row.status === 'colada' ? 'remove' : 'add';
  state = { ...state, teams: updateTeamMissing(row.team_code, row.number, action) };
  const updatedTeam = state.teams.find(t => t.code === state.selectedTeam?.code);
  if (updatedTeam) state = { ...state, selectedTeam: updatedTeam };
  render();
  if (!isOwnUpdate && row.updated_by) {
    const verb = row.status === 'colada' ? 'colou' : 'desfez';
    showToast(`${row.updated_by} ${verb} ${row.team_code} #${row.number}`);
  }
  if (state.recentsOpen) reloadRecents();
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('click', (e) => {
  if (!e.target.closest('#team-wrap') && state.dropdownOpen) {
    state = { ...state, dropdownOpen: false };
    render();
  }
});

async function init() {
  if (state.initialized) return;
  render();
  try {
    const teams = await loadTeams();
    state = { ...state, source: 'cloud', teams, initialized: true };
    subscribeToChanges(handleRemoteUpdate);
  } catch (err) {
    console.warn('Supabase indisponível, usando dados locais:', err.message);
    state = { ...state, source: 'local', teams: figurinhas, initialized: true };
  }
  render();
}

if (state.canEdit && !state.userName) {
  state = { ...state, showNamePrompt: true };
  render();
} else {
  init();
}
