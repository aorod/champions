document.addEventListener('DOMContentLoaded', async () => {
  const bracketEl = document.getElementById('bracket');

  let bracketData = null;
  let groupsData  = null;
  let simActive   = false;
  let simState    = null;

  // Constants used during initial render must be before the try block (avoids TDZ)
  const CHAIN  = ['r32', 'r16', 'qf', 'sf', 'final'];
  const LABELS = { r32: 'R32', r16: 'Oitavas', qf: 'Quartas', sf: 'Semi', final: 'Final' };
  const SEEDING = [
    { h: '1A', a: '2B' }, { h: '1C', a: '2D' }, { h: '1E', a: '2F' }, { h: '1G', a: '2H' },
    { h: '1I', a: '2J' }, { h: '1K', a: '2L' }, { h: 'T1', a: 'T8' }, { h: 'T2', a: 'T7' },
    { h: '1B', a: '2A' }, { h: '1D', a: '2C' }, { h: '1F', a: '2E' }, { h: '1H', a: '2G' },
    { h: '1J', a: '2I' }, { h: '1L', a: '2K' }, { h: 'T3', a: 'T6' }, { h: 'T4', a: 'T5' },
  ];

  try {
    const [bd, gd, meta] = await Promise.all([
      DataLoader.load('data/bracket.json'),
      DataLoader.load('data/groups.json'),
      DataLoader.load('data/meta.json'),
    ]);
    bracketData = bd;
    groupsData  = gd;
    DataLoader.setLastUpdated(meta.last_updated);
    renderUI();
    PageLoader.done();
  } catch (err) {
    bracketEl.innerHTML = `
      <div class="state-empty">
        <div class="state-empty__icon">⚠️</div>
        <p class="state-empty__title">Erro ao carregar dados</p>
        <p class="state-empty__sub">${err.message}</p>
      </div>`;
    PageLoader.done();
  }

  // ── UI shell ──────────────────────────────────────────────────────────────

  function renderUI() {
    bracketEl.innerHTML = '';

    const simBar = document.createElement('div');
    simBar.className = 'sim-bar';
    bracketEl.appendChild(simBar);

    const scrollWrap = document.createElement('div');
    scrollWrap.className = 'bkt-scroll';
    bracketEl.appendChild(scrollWrap);

    renderSimBar(simBar);
    renderBracket(scrollWrap, apiState());
  }

  function renderSimBar(bar) {
    if (simActive) {
      bar.innerHTML = `
        <span class="sim-hint">Clique em uma seleção para avançá-la</span>
        <button class="btn-sim btn-sim--reset" id="simReset">↺ Resetar simulação</button>`;
      bar.querySelector('#simReset').addEventListener('click', () => {
        simActive = false;
        simState  = null;
        renderSimBar(bar);
        renderBracket(bracketEl.querySelector('.bkt-scroll'), apiState());
      });
    } else {
      bar.innerHTML = `<button class="btn-sim" id="simBtn">🎮 Simular Mata-Mata</button>`;
      bar.querySelector('#simBtn').addEventListener('click', () => {
        simState  = buildSimState();
        simActive = true;
        renderSimBar(bar);
        renderBracket(bracketEl.querySelector('.bkt-scroll'), simState);
      });
    }
  }

  // ── API state builder ─────────────────────────────────────────────────────

  function apiState() {
    const toM = m => ({
      h:   m?.home ?? null,
      a:   m?.away ?? null,
      hs:  m?.home_score ?? null,
      as_: m?.away_score ?? null,
      win: m?.winner === 'home' ? 'h' : m?.winner === 'away' ? 'a' : null,
      date: m?.date ?? null,
      status: m?.status ?? 'pending',
    });
    const r = bracketData?.rounds ?? {};
    return {
      r32:   (r.r32?.matches  ?? []).map(toM),
      r16:   (r.r16?.matches  ?? []).map(toM),
      qf:    (r.qf?.matches   ?? []).map(toM),
      sf:    (r.sf?.matches   ?? []).map(toM),
      final: (r.final?.matches ?? []).map(toM),
      third: (r.third?.matches ?? []).map(toM),
    };
  }

  // ── Simulation state builder ──────────────────────────────────────────────

  function sortTeams(teams) {
    return [...teams].sort((a, b) =>
      b.points !== a.points ? b.points - a.points :
      b.gd     !== a.gd     ? b.gd - a.gd :
      b.gf     !== a.gf     ? b.gf - a.gf : 0
    );
  }

  function buildSimState() {
    const byPos = {};

    Object.entries(groupsData.groups).forEach(([letter, group]) => {
      sortTeams(group.teams).forEach((team, i) => { byPos[`${i + 1}${letter}`] = team; });
    });

    // 8 melhores terceiros colocados (T1 = melhor, T8 = pior dos 8)
    const thirds = Object.entries(groupsData.groups)
      .map(([, g]) => sortTeams(g.teams)[2] ?? null)
      .filter(Boolean);
    sortTeams(thirds).slice(0, 8).forEach((t, i) => { byPos[`T${i + 1}`] = t; });

    const blankM = () => ({ h: null, a: null, hs: null, as_: null, win: null, status: 'pending' });

    const r32 = SEEDING.map(s => ({
      ...blankM(),
      h: byPos[s.h] ?? null,
      a: byPos[s.a] ?? null,
    }));

    return {
      r32,
      r16:   Array(8).fill(null).map(blankM),
      qf:    Array(4).fill(null).map(blankM),
      sf:    Array(2).fill(null).map(blankM),
      final: [blankM()],
      third: [blankM()],
    };
  }

  // ── Simulation: click + propagate ─────────────────────────────────────────

  function onSimClick(round, matchIdx, side) {
    const match = simState[round]?.[matchIdx];
    if (!match || !match[side]) return;

    match.win = match.win === side ? null : side;   // toggle
    propagate(round, matchIdx);
    renderBracket(bracketEl.querySelector('.bkt-scroll'), simState);
  }

  function propagate(round, matchIdx) {
    const ri = CHAIN.indexOf(round);
    if (ri < 0 || ri >= CHAIN.length - 1) return;

    const nextRound = CHAIN[ri + 1];
    const curMatch  = simState[round][matchIdx];
    const nextIdx   = Math.floor(matchIdx / 2);
    const nextSide  = matchIdx % 2 === 0 ? 'h' : 'a';
    const nextMatch = simState[nextRound]?.[nextIdx];
    if (!nextMatch) return;

    const newWinner = curMatch?.win ? curMatch[curMatch.win] : null;
    const oldTeam   = nextMatch[nextSide];

    if (oldTeam === newWinner) return;   // nothing changed, stop cascade

    nextMatch[nextSide] = newWinner;

    // If old team was the winner of the next match, that result is now invalid
    if (nextMatch.win && oldTeam) {
      const winnerOfNext = nextMatch[nextMatch.win];
      if (winnerOfNext === oldTeam) {
        nextMatch.win = null;
      }
    }

    // Cascade upward (nextMatch winner may now point to changed slot)
    propagate(nextRound, nextIdx);
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  function renderBracket(container, state) {
    container.innerHTML = '';
    container.appendChild(buildLabelRow());

    const bkt = document.createElement('div');
    bkt.className = 'bkt';

    // Left half: R32 → R16 → QF → SF
    const leftHalf = document.createElement('div');
    leftHalf.className = 'bkt-half bkt-half--left';
    leftHalf.appendChild(buildCol(state.r32.slice(0, 8), 'r32', 0,  true));
    leftHalf.appendChild(buildCol(state.r16.slice(0, 4), 'r16', 0,  true));
    leftHalf.appendChild(buildCol(state.qf.slice(0, 2),  'qf',  0,  true));
    leftHalf.appendChild(buildCol(state.sf.slice(0, 1),  'sf',  0,  false));
    bkt.appendChild(leftHalf);

    // Center (Final + 3rd)
    bkt.appendChild(buildCenter(state));

    // Right half: SF ← QF ← R16 ← R32 (reversed by flex-direction: row-reverse)
    const rightHalf = document.createElement('div');
    rightHalf.className = 'bkt-half bkt-half--right';
    // DOM order is reversed by flex-direction:row-reverse → add outermost first
    rightHalf.appendChild(buildCol(state.r32.slice(8),    'r32', 8, true));
    rightHalf.appendChild(buildCol(state.r16.slice(4, 8), 'r16', 4, true));
    rightHalf.appendChild(buildCol(state.qf.slice(2, 4),  'qf',  2, true));
    rightHalf.appendChild(buildCol(state.sf.slice(1, 2),  'sf',  1, false));
    bkt.appendChild(rightHalf);

    container.appendChild(bkt);
  }

  // ── Column ────────────────────────────────────────────────────────────────

  function buildCol(matches, round, globalOffset, usePairs) {
    const col = document.createElement('div');
    col.className = 'bkt-col';

    if (!usePairs || matches.length <= 1) {
      col.appendChild(buildPair(matches, round, globalOffset, false));
    } else {
      for (let i = 0; i < matches.length; i += 2) {
        col.appendChild(buildPair(matches.slice(i, i + 2), round, globalOffset + i, true));
      }
    }

    return col;
  }

  // ── Pair ──────────────────────────────────────────────────────────────────

  function buildPair(matchArr, round, globalOffset, hasConnector) {
    const pair = document.createElement('div');
    // SF uses vertical bar only (horizontal handled by .bkt-center wires)
    const extraClass = !hasConnector ? (round === 'sf' ? ' sf-pair' : ' no-connector') : '';
    pair.className = 'bkt-pair' + extraClass;

    matchArr.forEach((match, mi) => {
      if (!match) {
        pair.appendChild(buildSlot(null, null, false, false));
        pair.appendChild(buildSlot(null, null, false, false));
        return;
      }

      const globalIdx = globalOffset + mi;
      const homeWon   = match.win === 'h';
      const awayWon   = match.win === 'a';
      const decided   = homeWon || awayWon;

      const hSlot = buildSlot(match.h, match.hs, homeWon, decided && !homeWon);
      const aSlot = buildSlot(match.a, match.as_, awayWon, decided && !awayWon);

      if (simActive) {
        if (match.h) { hSlot.classList.add('sim-click'); hSlot.addEventListener('click', () => onSimClick(round, globalIdx, 'h')); }
        if (match.a) { aSlot.classList.add('sim-click'); aSlot.addEventListener('click', () => onSimClick(round, globalIdx, 'a')); }
      }

      pair.appendChild(hSlot);
      pair.appendChild(aSlot);

      if (!simActive && match.date) {
        const dateEl = document.createElement('div');
        dateEl.className   = 'bkt-date';
        dateEl.textContent = formatDate(match.date);
        pair.appendChild(dateEl);
      }
    });

    return pair;
  }

  // ── Slot ──────────────────────────────────────────────────────────────────

  function buildSlot(team, score, isWinner, isLoser) {
    const slot = document.createElement('div');
    slot.className = 'bkt-slot'
      + (isWinner ? ' winner' : '')
      + (isLoser  ? ' loser'  : '');

    if (!team) {
      const f = document.createElement('div');
      f.className = 'bkt-flag';
      f.style.cssText = 'opacity:0.2;border:1px dashed var(--border)';

      const t = document.createElement('span');
      t.className   = 'bkt-tla tbd';
      t.textContent = '?';

      slot.appendChild(f);
      slot.appendChild(t);
    } else {
      // team.flag  = 2-letter ISO code ("br")
      // team.tla or team.id = FIFA 3-letter code ("BRA")
      const f = document.createElement('img');
      f.className = 'bkt-flag';
      f.src       = DataLoader.flagUrl(team.flag ?? '', 40);
      f.alt       = team.name ?? team.tla ?? team.id ?? '';
      f.loading   = 'lazy';
      f.onerror   = () => { f.style.opacity = '0.2'; };

      const t = document.createElement('span');
      t.className   = 'bkt-tla';
      t.textContent = team.tla ?? team.id ?? '?';

      slot.appendChild(f);
      slot.appendChild(t);

      if (score !== null && score !== undefined) {
        const sc = document.createElement('span');
        sc.className   = 'bkt-score';
        sc.textContent = score;
        slot.appendChild(sc);
      }
    }

    return slot;
  }

  // ── Center ────────────────────────────────────────────────────────────────

  function buildCenter(state) {
    const center = document.createElement('div');
    center.className = 'bkt-center';

    const trophy = document.createElement('div');
    trophy.className   = 'bkt-trophy';
    trophy.textContent = '🏆';
    center.appendChild(trophy);

    const label = document.createElement('div');
    label.className   = 'bkt-center-label';
    label.textContent = 'Final';
    center.appendChild(label);

    const finalMatch = state.final?.[0] ?? {};
    const finalSlots = document.createElement('div');
    finalSlots.className = 'bkt-final-slots';

    [{ team: finalMatch.h, score: finalMatch.hs,  side: 'h' },
     { team: finalMatch.a, score: finalMatch.as_, side: 'a' }].forEach(({ team, score, side }) => {
      const isWinner = finalMatch.win === side;
      const isLoser  = finalMatch.win && !isWinner;
      const slot = document.createElement('div');
      slot.className = 'bkt-final-slot';
      if (isLoser) slot.style.opacity = '0.35';

      const f = document.createElement(team ? 'img' : 'div');
      f.className = 'bkt-flag';
      if (team) { f.src = DataLoader.flagUrl(team.flag ?? '', 40); f.alt = team.name ?? ''; f.loading = 'lazy'; }
      else f.style.cssText = 'opacity:0.2;border:1px dashed var(--border-gold)';

      const t = document.createElement('span');
      t.className   = 'bkt-tla' + (team ? '' : ' tbd');
      t.textContent = team ? (team.tla ?? team.id ?? '?') : '?';

      slot.appendChild(f);
      slot.appendChild(t);

      if (score !== null && score !== undefined) {
        const sc = document.createElement('span');
        sc.className = 'bkt-score';
        sc.textContent = score;
        slot.appendChild(sc);
      }

      if (simActive && team) {
        slot.classList.add('sim-click');
        slot.addEventListener('click', () => onSimClick('final', 0, side));
      }

      finalSlots.appendChild(slot);
    });

    center.appendChild(finalSlots);

    // 3rd place
    const thirdMatch = state.third?.[0];
    if (thirdMatch?.h || thirdMatch?.a) {
      const sec = document.createElement('div');
      sec.className = 'bkt-third';

      const lbl = document.createElement('div');
      lbl.className   = 'bkt-third-label';
      lbl.textContent = '3º Lugar';
      sec.appendChild(lbl);

      const tSlots = document.createElement('div');
      tSlots.className = 'bkt-third-slots';

      [thirdMatch.h, thirdMatch.a].forEach(team => {
        const s = document.createElement('div');
        s.className = 'bkt-final-slot';
        s.style.cssText = 'background:transparent;border-color:var(--border)';

        const f = document.createElement(team ? 'img' : 'div');
        f.className = 'bkt-flag';
        if (team) { f.src = DataLoader.flagUrl(team.flag ?? '', 40); f.alt = ''; f.loading = 'lazy'; }
        else f.style.cssText = 'opacity:0.2;border:1px dashed var(--border)';

        const t = document.createElement('span');
        t.className   = 'bkt-tla' + (team ? '' : ' tbd');
        t.textContent = team ? (team.tla ?? team.id ?? '?') : '?';
        s.appendChild(f); s.appendChild(t);
        tSlots.appendChild(s);
      });

      sec.appendChild(tSlots);
      center.appendChild(sec);
    }

    return center;
  }

  // ── Label row ─────────────────────────────────────────────────────────────

  function buildLabelRow() {
    const row = el('div', 'bkt-labels');

    const lh = el('div', 'bkt-label-half');
    ['r32', 'r16', 'qf', 'sf'].forEach(k => {
      const c = el('div', 'bkt-label-col');
      c.textContent = LABELS[k];
      lh.appendChild(c);
    });

    const ctr = el('div', 'bkt-label-center');
    ctr.textContent = 'Final';

    const rh = el('div', 'bkt-label-half bkt-label-half--right');
    ['r32', 'r16', 'qf', 'sf'].forEach(k => {
      const c = el('div', 'bkt-label-col');
      c.textContent = LABELS[k];
      rh.appendChild(c);
    });

    row.appendChild(lh);
    row.appendChild(ctr);
    row.appendChild(rh);
    return row;
  }

  // ── DOM helpers ───────────────────────────────────────────────────────────

  function el(tag, className) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    return e;
  }

  function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit',
    });
  }
});
