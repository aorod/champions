const TeamModal = (() => {
  const POS_PT    = { G: 'Goleiro', D: 'Defensor', M: 'Meio-campista', F: 'Atacante' };
  const POS_ORDER = ['G', 'D', 'M', 'F'];

  let squadsData = null;
  let matchesData = null;
  let currentPlayers = [];
  let mode    = 'starter';   // 'position' | 'jersey' | 'starter'
  let subKey  = 'all';

  const overlay  = document.getElementById('teamModal');
  const closeBtn = document.getElementById('modalClose');
  const flagEl   = document.getElementById('modalFlag');
  const nameEl   = document.getElementById('modalTeamName');
  const metaEl   = document.getElementById('modalMeta');
  const modeBar  = document.getElementById('modalModeBar');
  const subBar   = document.getElementById('modalSubBar');
  const tbodyEl  = document.getElementById('modalPlayers');
  const stateEl  = document.getElementById('modalState');

  async function loadData() {
    if (squadsData) return;
    [squadsData, matchesData] = await Promise.all([
      DataLoader.load('data/squads.json'),
      DataLoader.load('data/matches.json'),
    ]);
  }

  function getNextMatch(tla) {
    const now = Date.now();
    return (matchesData?.matches ?? [])
      .filter(m => m.status === 'pending' &&
        (m.home?.tla === tla || m.away?.tla === tla) &&
        new Date(m.date).getTime() > now)
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0] ?? null;
  }

  function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });
  }

  // ── Sort helpers ──────────────────────────────────────────────────────────

  function byPosition(players) {
    return [...players].sort((a, b) => {
      const ai = POS_ORDER.indexOf(a.position ?? '');
      const bi = POS_ORDER.indexOf(b.position ?? '');
      const pa = ai === -1 ? 4 : ai;
      const pb = bi === -1 ? 4 : bi;
      return pa !== pb ? pa - pb : (a.jersey ?? 99) - (b.jersey ?? 99);
    });
  }

  function byJersey(players) {
    return [...players].sort((a, b) => (a.jersey ?? 99) - (b.jersey ?? 99));
  }

  function byPosThenJersey(players) {
    return [...players].sort((a, b) => {
      const ai = POS_ORDER.indexOf(a.position ?? ''); const pa = ai === -1 ? 4 : ai;
      const bi = POS_ORDER.indexOf(b.position ?? ''); const pb = bi === -1 ? 4 : bi;
      return pa !== pb ? pa - pb : (a.jersey ?? 99) - (b.jersey ?? 99);
    });
  }

  function byStarter(players) {
    return [...players].sort((a, b) => {
      const sv = v => v === true ? 0 : v === false ? 1 : 2;
      const d = sv(a.lastMatchStarter) - sv(b.lastMatchStarter);
      if (d !== 0) return d;
      const ai = POS_ORDER.indexOf(a.position ?? ''); const pa = ai === -1 ? 4 : ai;
      const bi = POS_ORDER.indexOf(b.position ?? ''); const pb = bi === -1 ? 4 : bi;
      return pa !== pb ? pa - pb : (a.jersey ?? 99) - (b.jersey ?? 99);
    });
  }

  // ── Row render ────────────────────────────────────────────────────────────

  function playerRow(p) {
    const pos       = p.position ?? '?';
    const posLabel  = POS_PT[pos] ?? pos;
    const jersey    = p.jersey != null ? p.jersey : '—';
    const goals     = p.goals    > 0 ? `<span class="modal__stat modal__stat--gold">${p.goals}</span>`     : '0';
    const assists   = p.assists  > 0 ? `<span class="modal__stat modal__stat--gold">${p.assists}</span>`   : '0';
    const yc        = p.yellowCards > 0 ? `<span class="modal__yc">${p.yellowCards}</span>` : '0';
    const rc        = p.redCards    > 0 ? `<span class="modal__rc">${p.redCards}</span>`    : '0';
    return `<tr>
      <td><span class="modal__jersey">${jersey}</span></td>
      <td>${p.name}</td>
      <td><span class="modal__pos-badge modal__pos-badge--${pos}">${posLabel}</span></td>
      <td>${goals}</td><td>${assists}</td><td>${yc}</td><td>${rc}</td>
    </tr>`;
  }

  function groupHeader(label) {
    return `<tr class="modal__group-hdr"><td colspan="7">${label}</td></tr>`;
  }

  // ── Table render ──────────────────────────────────────────────────────────

  function renderTable() {
    let players = currentPlayers;

    if (mode === 'position') {
      if (subKey !== 'all') players = players.filter(p => p.position === subKey);
      players = byPosition(players);
    } else if (mode === 'jersey') {
      players = byJersey(players);
    } else {
      // starter mode
      if (subKey === 'starter') players = byPosThenJersey(players.filter(p => p.lastMatchStarter === true));
      else if (subKey === 'bench') players = byPosThenJersey(players.filter(p => p.lastMatchStarter === false));
      else players = byStarter(players);
    }

    if (!players.length) {
      tbodyEl.innerHTML = '';
      stateEl.textContent = 'Nenhum jogador nessa seleção.';
      stateEl.hidden = false;
      return;
    }

    stateEl.hidden = true;

    if (mode === 'starter' && subKey === 'all') {
      const hasPlayed = currentPlayers.some(p => p.lastMatchStarter !== null);

      if (!hasPlayed) {
        tbodyEl.innerHTML = '';
        stateEl.textContent = 'Esta seleção ainda não disputou nenhum jogo.';
        stateEl.hidden = false;
        return;
      }

      const titulares = byPosThenJersey(players.filter(p => p.lastMatchStarter === true));
      const banco     = byPosThenJersey(players.filter(p => p.lastMatchStarter === false));
      const fora      = byPosThenJersey(players.filter(p => p.lastMatchStarter === null));

      let html = '';
      if (titulares.length) html += groupHeader('Titulares')   + titulares.map(playerRow).join('');
      if (banco.length)     html += groupHeader('Banco')       + banco.map(playerRow).join('');
      if (fora.length)      html += groupHeader('Fora do jogo')+ fora.map(playerRow).join('');
      tbodyEl.innerHTML = html;
    } else {
      tbodyEl.innerHTML = players.map(playerRow).join('');
    }
  }

  // ── Sub-bar ───────────────────────────────────────────────────────────────

  const SUB_OPTIONS = {
    position: [
      { key: 'all', label: 'Todos' },
      { key: 'G',   label: 'Goleiros' },
      { key: 'D',   label: 'Defensores' },
      { key: 'M',   label: 'Meio-campistas' },
      { key: 'F',   label: 'Atacantes' },
    ],
    jersey: [],
    starter: [
      { key: 'all',     label: 'Todos' },
      { key: 'starter', label: 'Titulares' },
      { key: 'bench',   label: 'Banco' },
    ],
  };

  function renderSubBar() {
    const opts = SUB_OPTIONS[mode] ?? [];
    if (!opts.length) { subBar.hidden = true; return; }
    subBar.hidden = false;
    subBar.innerHTML = opts.map(o =>
      `<button class="modal__filter${subKey === o.key ? ' active' : ''}" data-sub="${o.key}" type="button">${o.label}</button>`
    ).join('');
  }

  // ── Open / Close ──────────────────────────────────────────────────────────

  async function open(team) {
    overlay.classList.add('modal--open');
    document.body.style.overflow = 'hidden';

    mode   = 'starter';
    subKey = 'all';

    // Header
    flagEl.src   = DataLoader.flagUrl(team.flag, 80);
    flagEl.alt   = `Bandeira de ${team.name}`;
    nameEl.textContent = team.name;
    metaEl.textContent = `Grupo ${team.group}`;

    // Mode buttons
    modeBar.querySelectorAll('.modal__mode-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.mode === 'starter')
    );

    // Reset table
    currentPlayers = [];
    stateEl.textContent = 'Carregando elenco...';
    stateEl.hidden  = false;
    tbodyEl.innerHTML = '';
    renderSubBar();

    try {
      await loadData();

      const next = getNextMatch(team.id);
      if (next) {
        const opp = next.home?.tla === team.id ? next.away : next.home;
        metaEl.innerHTML =
          `Grupo ${team.group} &nbsp;·&nbsp; Próximo: <strong>vs ${opp?.name ?? '?'}</strong> ${formatDate(next.date)}`;
      }

      currentPlayers = squadsData?.squads?.[team.id] ?? [];

      if (!currentPlayers.length) {
        stateEl.textContent = 'Elenco não disponível.';
        return;
      }

      renderTable();
    } catch (e) {
      stateEl.textContent = `Erro ao carregar elenco: ${e.message}`;
    }
  }

  function close() {
    overlay.classList.remove('modal--open');
    document.body.style.overflow = '';
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  function init() {
    if (!overlay) return;

    closeBtn?.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && overlay.classList.contains('modal--open')) close();
    });

    // Primary mode buttons
    modeBar?.addEventListener('click', e => {
      const btn = e.target.closest('.modal__mode-btn');
      if (!btn) return;
      modeBar.querySelectorAll('.modal__mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      mode   = btn.dataset.mode;
      subKey = 'all';
      renderSubBar();
      renderTable();
    });

    // Sub-filter buttons (delegated)
    subBar?.addEventListener('click', e => {
      const btn = e.target.closest('.modal__filter');
      if (!btn) return;
      subBar.querySelectorAll('.modal__filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      subKey = btn.dataset.sub;
      renderTable();
    });
  }

  return { open, init };
})();

document.addEventListener('DOMContentLoaded', TeamModal.init);
