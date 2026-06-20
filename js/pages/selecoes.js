document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('teamsGrid');
  let allTeams = [];

  try {
    const [teamsData, meta] = await Promise.all([
      DataLoader.load('data/teams.json'),
      DataLoader.load('data/meta.json'),
    ]);

    allTeams = teamsData.teams;
    DataLoader.setLastUpdated(meta.last_updated);
    renderTeams(allTeams);
    initFilters(allTeams);
  } catch (err) {
    grid.innerHTML = `
      <div class="state-empty" style="grid-column:1/-1">
        <div class="state-empty__icon">⚠️</div>
        <p class="state-empty__title">Erro ao carregar dados</p>
        <p class="state-empty__sub">${err.message}</p>
      </div>`;
  }

  function renderTeams(teams) {
    if (!teams.length) {
      grid.innerHTML = `
        <div class="state-empty" style="grid-column:1/-1">
          <div class="state-empty__icon">🌍</div>
          <p class="state-empty__title">Nenhuma seleção encontrada</p>
          <p class="state-empty__sub">Tente outro filtro ou busca</p>
        </div>`;
      return;
    }

    grid.innerHTML = '';
    teams.forEach((team, i) => {
      const card = document.createElement('article');
      card.className = 'team-card anim-fade-up';
      card.dataset.conf = team.confederation;
      card.dataset.group = team.group;
      card.style.animationDelay = `${Math.min(i * 30, 500)}ms`;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `Ver elenco de ${team.name}`);

      card.innerHTML = `
        <div class="team-card__flag">
          <img
            src="${DataLoader.flagUrl(team.flag, 160)}"
            alt="Bandeira de ${team.name}"
            loading="lazy"
          >
        </div>
        <div class="team-card__body">
          <div class="team-card__top">
            <span class="team-card__group">Grupo ${team.group}</span>
            <span class="team-card__conf">${team.confederation}</span>
          </div>
          <h3 class="team-card__name">${team.name}</h3>
        </div>`;

      card.addEventListener('click', () => TeamModal.open(team));
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); TeamModal.open(team); }
      });

      grid.appendChild(card);
    });
  }

  function initFilters(teams) {
    const searchInput = document.getElementById('searchInput');
    const filterTabs  = document.querySelectorAll('.filter-tab');

    let activeConf = 'all';
    let searchTerm = '';

    function applyFilters() {
      const filtered = teams.filter(t => {
        const matchConf  = activeConf === 'all' || t.confederation === activeConf;
        const matchSearch = t.name.toLowerCase().includes(searchTerm) ||
                            t.id.toLowerCase().includes(searchTerm);
        return matchConf && matchSearch;
      });
      renderTeams(filtered);
    }

    if (searchInput) {
      searchInput.addEventListener('input', e => {
        searchTerm = e.target.value.toLowerCase().trim();
        applyFilters();
      });
    }

    filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeConf = tab.dataset.filter;
        applyFilters();
      });
    });
  }
});
