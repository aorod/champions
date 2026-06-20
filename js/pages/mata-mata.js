document.addEventListener('DOMContentLoaded', async () => {
  const bracketEl = document.getElementById('bracket');

  try {
    const [bracketData, meta] = await Promise.all([
      DataLoader.load('data/bracket.json'),
      DataLoader.load('data/meta.json'),
    ]);

    DataLoader.setLastUpdated(meta.last_updated);
    renderBracket(bracketData.rounds);
  } catch (err) {
    bracketEl.innerHTML = `
      <div class="state-empty">
        <div class="state-empty__icon">⚠️</div>
        <p class="state-empty__title">Erro ao carregar dados</p>
        <p class="state-empty__sub">${err.message}</p>
      </div>`;
  }

  function renderBracket(rounds) {
    bracketEl.innerHTML = '';
    const scroll = document.createElement('div');
    scroll.className = 'bracket-scroll';

    const bracket = document.createElement('div');
    bracket.className = 'bracket';

    const roundOrder = ['r32', 'r16', 'qf', 'sf', 'final'];

    roundOrder.forEach(key => {
      const round = rounds[key];
      if (!round) return;

      const col = document.createElement('div');
      col.className = 'bracket__round';

      const isFinal = key === 'final';
      col.innerHTML = `
        ${isFinal ? '<div class="bracket__trophy">🏆</div>' : ''}
        <div class="bracket__round-label">${round.label}</div>`;

      const matchesWrap = document.createElement('div');
      matchesWrap.className = 'bracket__matches';

      round.matches.forEach(match => {
        matchesWrap.appendChild(buildMatchCard(match, isFinal));
      });

      col.appendChild(matchesWrap);

      // Third place alongside final
      if (key === 'final' && rounds.third) {
        const thirdLabel = document.createElement('div');
        thirdLabel.className = 'bracket__round-label';
        thirdLabel.style.cssText = 'margin-top:var(--s8);color:var(--text-2)';
        thirdLabel.textContent = rounds.third.label;
        col.appendChild(thirdLabel);

        const thirdWrap = document.createElement('div');
        thirdWrap.className = 'bracket__matches';
        rounds.third.matches.forEach(match => {
          thirdWrap.appendChild(buildMatchCard(match, false));
        });
        col.appendChild(thirdWrap);
      }

      bracket.appendChild(col);
    });

    scroll.appendChild(bracket);
    bracketEl.appendChild(scroll);
  }

  function buildMatchCard(match, isFinal) {
    const card = document.createElement('div');
    card.className = `bracket__match${isFinal ? ' final-match' : ''}${match.status === 'pending' ? ' pending' : ''}`;

    const homeTeam = match.home;
    const awayTeam = match.away;
    const isPending = !homeTeam && !awayTeam;

    card.appendChild(teamSlot(homeTeam, match.winner, match.home_score, isPending));
    card.appendChild(teamSlot(awayTeam, match.winner, match.away_score, isPending));

    if (match.date) {
      const dateEl = document.createElement('div');
      dateEl.className = 'bracket__date';
      dateEl.textContent = formatMatchDate(match.date);
      card.appendChild(dateEl);
    }

    if (match.status === 'live') {
      const badge = document.createElement('span');
      badge.className = 'live-badge';
      badge.textContent = 'AO VIVO';
      card.appendChild(badge);
    }

    return card;
  }

  function teamSlot(team, winner, score, isPending) {
    const slot = document.createElement('div');
    slot.className = 'bracket__team';

    if (team && team === winner) slot.classList.add('winner');

    if (isPending || !team) {
      slot.innerHTML = `
        <div class="bracket__team-flag" style="background:var(--bg-raised)"></div>
        <span class="bracket__team-name tbd">A definir</span>`;
    } else {
      const flagImg = team.flag
        ? `<img class="bracket__team-flag" src="${DataLoader.flagUrl(team.flag, 40)}" alt="${team.name}" loading="lazy">`
        : `<div class="bracket__team-flag"></div>`;

      slot.innerHTML = `
        ${flagImg}
        <span class="bracket__team-name">${team.name}</span>
        <span class="bracket__team-score">${score !== null && score !== undefined ? score : ''}</span>`;
    }

    return slot;
  }

  function formatMatchDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  }
});
