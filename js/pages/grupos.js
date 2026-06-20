document.addEventListener('DOMContentLoaded', async () => {
  const groupsContainer  = document.getElementById('groupsContainer');
  const scorersContainer = document.getElementById('scorersContainer');
  const pageTabs = document.querySelectorAll('.page-tab');

  try {
    const [groupsData, scorersData, meta] = await Promise.all([
      DataLoader.load('data/groups.json'),
      DataLoader.load('data/scorers.json'),
      DataLoader.load('data/meta.json'),
    ]);

    DataLoader.setLastUpdated(meta.last_updated);
    renderGroups(groupsData.groups);
    renderScorers(scorersData);
  } catch (err) {
    groupsContainer.innerHTML = `
      <div class="state-empty">
        <div class="state-empty__icon">⚠️</div>
        <p class="state-empty__title">Erro ao carregar dados</p>
        <p class="state-empty__sub">${err.message}</p>
      </div>`;
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
