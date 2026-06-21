document.addEventListener('DOMContentLoaded', async () => {
  const groupsContainer  = document.getElementById('groupsContainer');
  const scorersContainer = document.getElementById('scorersContainer');
  const matchesContainer = document.getElementById('matchesContainer');
  const pageTabs = document.querySelectorAll('.page-tab');

  try {
    const [groupsData, scorersData, matchesData, meta] = await Promise.all([
      DataLoader.load('data/groups.json'),
      DataLoader.load('data/scorers.json'),
      DataLoader.load('data/matches.json'),
      DataLoader.load('data/meta.json'),
    ]);

    DataLoader.setLastUpdated(meta.last_updated);
    renderGroups(groupsData.groups);
    renderScorers(scorersData);
    renderMatches(matchesData.matches ?? []);
    PageLoader.done();
  } catch (err) {
    groupsContainer.innerHTML = `
      <div class="state-empty">
        <div class="state-empty__icon">⚠️</div>
        <p class="state-empty__title">Erro ao carregar dados</p>
        <p class="state-empty__sub">${err.message}</p>
      </div>`;
    PageLoader.done();
  }

  // Tab switching
  pageTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      pageTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      document.querySelectorAll('.tab-panel').forEach(p => {
        p.hidden = p.dataset.panel !== target;
      });
    });
  });

  function renderGroups(groups) {
    groupsContainer.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'groups-grid';

    Object.entries(groups).forEach(([letter, group], gi) => {
      const block = document.createElement('div');
      block.className = 'group-block anim-fade-up';
      block.style.animationDelay = `${gi * 60}ms`;

      const sorted = [...group.teams].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.gd !== a.gd)         return b.gd - a.gd;
        return b.gf - a.gf;
      });

      block.innerHTML = `
        <div class="group-block__header">
          <span class="group-block__letter">${letter}</span>
          <span class="group-block__label">Grupo ${letter}</span>
        </div>
        <table class="group-table">
          <thead>
            <tr>
              <th></th>
              <th>Seleção</th>
              <th title="Jogos">J</th>
              <th title="Vitórias">V</th>
              <th title="Empates">E</th>
              <th title="Derrotas">D</th>
              <th title="Gols Feitos">GF</th>
              <th title="Gols Contra">GC</th>
              <th title="Saldo de Gols">SG</th>
              <th title="Pontos">PTS</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map((team, idx) => rowHTML(team, idx)).join('')}
          </tbody>
        </table>`;

      grid.appendChild(block);
    });

    groupsContainer.appendChild(grid);

    // Legend
    const legend = document.createElement('div');
    legend.className = 'group-legend';
    legend.innerHTML = `
      <div class="legend-item">
        <div class="legend-dot" style="background:var(--green)"></div>
        Classificado (Top 2)
      </div>
      <div class="legend-item">
        <div class="legend-dot" style="background:var(--cobalt)"></div>
        Possível vaga (3º lugar)
      </div>`;
    groupsContainer.appendChild(legend);
  }

  function rowHTML(team, idx) {
    const rowClass = idx < 2 ? 'qualified' : idx === 2 ? 'playoff' : '';
    const gdClass  = team.gd > 0 ? 'gd-pos' : team.gd < 0 ? 'gd-neg' : 'gd-zero';
    const gdSign   = team.gd > 0 ? '+' : '';

    return `<tr class="${rowClass}">
      <td class="rank">${idx + 1}</td>
      <td>
        <div class="group-table__team">
          <img class="group-table__flag"
               src="${DataLoader.flagUrl(team.flag, 40)}"
               alt="${team.name}" loading="lazy">
          <span class="group-table__name">${team.name}</span>
        </div>
      </td>
      <td>${team.played}</td>
      <td>${team.won}</td>
      <td>${team.drawn}</td>
      <td>${team.lost}</td>
      <td>${team.gf}</td>
      <td>${team.ga}</td>
      <td class="${gdClass}">${gdSign}${team.gd}</td>
      <td class="pts">${team.points}</td>
    </tr>`;
  }

  function renderMatches(matches) {
    if (!matchesContainer) return;
    if (!matches.length) {
      matchesContainer.innerHTML = `
        <div class="state-empty">
          <div class="state-empty__icon">📅</div>
          <p class="state-empty__title">Partidas ainda não disponíveis</p>
          <p class="state-empty__sub">Os dados serão atualizados em breve</p>
        </div>`;
      return;
    }

    function toBRT(utcStr) {
      const d = new Date(utcStr);
      return {
        dateKey:   d.toLocaleDateString('en-CA',  { timeZone: 'America/Sao_Paulo' }),
        dateLabel: d.toLocaleDateString('pt-BR',  { timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long' }),
        time:      d.toLocaleTimeString('pt-BR',  { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }),
      };
    }

    // Opções únicas para os selects
    const groups  = [...new Set(matches.map(m => m.group))].sort();
    const teams   = [...new Set(matches.flatMap(m => [m.home?.name, m.away?.name].filter(Boolean)))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const dates   = [...new Set(matches.map(m => toBRT(m.date).dateKey))].sort();

    // Default de data: hoje em BRT, ou a mais próxima com jogo
    const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const defaultDate = dates.includes(todayKey)
      ? todayKey
      : (dates.find(d => d >= todayKey) ?? dates[dates.length - 1] ?? 'all');

    let selGroup = 'all';
    let selTeam  = 'all';
    let selDate  = defaultDate;

    function applyFilters() {
      let filtered = matches;
      if (selGroup !== 'all') filtered = filtered.filter(m => m.group === selGroup);
      if (selTeam  !== 'all') filtered = filtered.filter(m => m.home?.name === selTeam || m.away?.name === selTeam);
      if (selDate  !== 'all') filtered = filtered.filter(m => toBRT(m.date).dateKey === selDate);

      const listEl = matchesContainer.querySelector('.matches-list');
      if (listEl) listEl.innerHTML = filtered.length ? renderList(filtered) : `
        <div class="state-empty">
          <p class="state-empty__title">Nenhuma partida encontrada</p>
          <p class="state-empty__sub">Tente outros filtros</p>
        </div>`;
    }

    function matchCardHTML(m) {
      const { time } = toBRT(m.date);
      const isFinished = m.status === 'finished';
      const isLive     = m.status === 'live';
      const homeWon = m.winner === 'home';
      const awayWon = m.winner === 'away';
      const homeClass = isFinished ? (homeWon ? 'match-team--winner' : 'match-team--loser') : '';
      const awayClass = isFinished ? (awayWon ? 'match-team--winner' : 'match-team--loser') : '';
      const homeFlag = m.home?.flag ? `<img class="match-team__flag" src="${DataLoader.flagUrl(m.home.flag, 40)}" alt="${m.home.name}" loading="lazy">` : '';
      const awayFlag = m.away?.flag ? `<img class="match-team__flag" src="${DataLoader.flagUrl(m.away.flag, 40)}" alt="${m.away.name}" loading="lazy">` : '';
      const venueText = [m.venue, m.city].filter(Boolean).join(' · ');
      const scoreHTML = isFinished || isLive
        ? `<span class="match-score__num ${homeWon ? 'match-score__num--winner' : ''}">${m.home_score ?? 0}</span>
           <span class="match-score__sep">─</span>
           <span class="match-score__num ${awayWon ? 'match-score__num--winner' : ''}">${m.away_score ?? 0}</span>`
        : `<span class="match-score__vs">${time} BRT</span>`;
      const liveBadge = isLive ? `<span class="match-card__live-badge">ao vivo</span>` : '';
      return `
        <div class="match-card ${isLive ? 'match-card--live' : ''} anim-fade-up">
          <div class="match-card__meta">
            <span class="match-card__group">Grupo ${m.group}</span>
            ${liveBadge}
            ${venueText ? `<span class="match-card__venue">${venueText}</span>` : ''}
            ${isFinished ? `<span class="match-card__time">Encerrado</span>` : `<span class="match-card__time">${time} BRT</span>`}
          </div>
          <div class="match-card__body">
            <div class="match-team match-team--home ${homeClass}">${homeFlag}<span class="match-team__name">${m.home?.name ?? 'A definir'}</span></div>
            <div class="match-score">${scoreHTML}</div>
            <div class="match-team match-team--away ${awayClass}"><span class="match-team__name">${m.away?.name ?? 'A definir'}</span>${awayFlag}</div>
          </div>
        </div>`;
    }

    function renderList(filtered) {
      const byDay = {};
      filtered.forEach(m => {
        const { dateKey, dateLabel } = toBRT(m.date);
        if (!byDay[dateKey]) byDay[dateKey] = { label: dateLabel, matches: [] };
        byDay[dateKey].matches.push(m);
      });
      return Object.entries(byDay).map(([, day]) => `
        <div class="matches-day">
          <div class="matches-day__header">
            <span class="matches-day__title">${day.label}</span>
            <span class="matches-day__count">${day.matches.length} jogos</span>
          </div>
          <div class="matches-day__list">${day.matches.map(matchCardHTML).join('')}</div>
        </div>`).join('');
    }

    // Formata data para exibir no select
    function formatDateOption(key) {
      return new Date(key + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
    }

    const groupOptions  = `<option value="all">Todos</option>` + groups.map(g => `<option value="${g}">Grupo ${g}</option>`).join('');
    const teamOptions   = `<option value="all">Todas</option>` + teams.map(t => `<option value="${t}">${t}</option>`).join('');
    const dateOptions   = `<option value="all">Todas</option>` + dates.map(d => `<option value="${d}" ${d === defaultDate ? 'selected' : ''}>${formatDateOption(d)}</option>`).join('');

    matchesContainer.innerHTML = `
      <div class="matches-filter">
        <div class="matches-filter__group">
          <span class="matches-filter__label">Grupo</span>
          <select class="matches-select" id="filterGroup">${groupOptions}</select>
        </div>
        <div class="matches-filter__group">
          <span class="matches-filter__label">Seleção</span>
          <select class="matches-select" id="filterTeam">${teamOptions}</select>
        </div>
        <div class="matches-filter__group">
          <span class="matches-filter__label">Data</span>
          <select class="matches-select" id="filterDate">${dateOptions}</select>
        </div>
      </div>
      <div class="matches-list">${renderList(matches.filter(m => toBRT(m.date).dateKey === selDate))}</div>`;

    matchesContainer.querySelector('#filterGroup').addEventListener('change', e => { selGroup = e.target.value; applyFilters(); });
    matchesContainer.querySelector('#filterTeam').addEventListener('change',  e => { selTeam  = e.target.value; applyFilters(); });
    matchesContainer.querySelector('#filterDate').addEventListener('change',  e => { selDate  = e.target.value; applyFilters(); });
  }

  function renderScorers(data) {
    if (!scorersContainer) return;

    const goalSection   = scorersContainer.querySelector('#scorersGoals');
    const assistSection = scorersContainer.querySelector('#scorersAssists');

    function listHTML(players, statKey, statLabel) {
      if (!players || !players.length) {
        return `<div class="state-empty">
          <div class="state-empty__icon">⚽</div>
          <p class="state-empty__title">Artilharia ainda não disponível</p>
          <p class="state-empty__sub">Os dados serão atualizados durante os jogos</p>
        </div>`;
      }

      return `<div class="scorers-list">
        ${players.slice(0, 20).map((p, i) => `
          <div class="scorer-row anim-fade-up" style="animation-delay:${i * 40}ms">
            <span class="scorer-rank ${i < 3 ? 'top' : ''}">${i + 1}</span>
            <img class="scorer-flag"
                 src="${DataLoader.flagUrl(p.flag_code, 40)}"
                 alt="${p.team_name}" loading="lazy">
            <div class="scorer-info">
              <div class="scorer-name">${p.player}</div>
              <div class="scorer-team">${p.team_name}</div>
            </div>
            <div class="scorer-stat">
              <div class="scorer-stat__value">${p[statKey]}</div>
              <div class="scorer-stat__label">${statLabel}</div>
            </div>
            <div class="scorer-stat">
              <div class="scorer-stat__value" style="color:var(--text-2);font-size:0.9rem">${p.matches}</div>
              <div class="scorer-stat__label">Jogos</div>
            </div>
          </div>`).join('')}
      </div>`;
    }

    if (goalSection)   goalSection.innerHTML   = listHTML(data.scorers,  'goals',   'Gols');
    if (assistSection) assistSection.innerHTML = listHTML(data.assists,  'assists', 'Assist.');
  }
});
