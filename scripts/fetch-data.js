/**
 * fetch-data.js
 * Roda via GitHub Actions. Busca dados da Copa do Mundo 2026
 * na API football-data.org e salva os JSONs em /data.
 *
 * Variáveis de ambiente necessárias:
 *   FOOTBALL_DATA_API_KEY  — chave da football-data.org (gratuita)
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const API_KEY    = process.env.FOOTBALL_DATA_API_KEY;
const BASE_URL   = 'api.football-data.org';
const WC_CODE    = 'WC';
const DATA_DIR   = path.join(__dirname, '..', 'data');

// Mapeamento completo TLA → código ISO para flagcdn.com
const KNOWN_FLAGS = {
  // CONMEBOL
  ARG: 'ar', BRA: 'br', COL: 'co', ECU: 'ec', URU: 'uy', VEN: 've',
  CHL: 'cl', CHI: 'cl', PAR: 'py', BOL: 'bo', PER: 'pe',
  // CONCACAF
  USA: 'us', CAN: 'ca', MEX: 'mx', PAN: 'pa', HND: 'hn', HON: 'hn',
  JAM: 'jm', CRC: 'cr', SLV: 'sv', HAI: 'ht', TRI: 'tt', CUW: 'cw',
  // UEFA
  FRA: 'fr', ESP: 'es', GER: 'de', ENG: 'gb-eng', POR: 'pt', ITA: 'it',
  NED: 'nl', BEL: 'be', CRO: 'hr', POL: 'pl', CZE: 'cz', SRB: 'rs',
  TUR: 'tr', UKR: 'ua', SUI: 'ch', DEN: 'dk', SWE: 'se', NOR: 'no',
  SCO: 'gb-sct', WAL: 'gb-wls', NIR: 'gb-nir', AUT: 'at', ROM: 'ro',
  ROU: 'ro', HUN: 'hu', SVK: 'sk', SVN: 'si', GRE: 'gr', ALB: 'al',
  MNE: 'me', BIH: 'ba', MKD: 'mk', KOS: 'xk', GEO: 'ge', ARM: 'am',
  AZE: 'az', FIN: 'fi', ISL: 'is', IRL: 'ie',
  // CAF
  MAR: 'ma', SEN: 'sn', CMR: 'cm', EGY: 'eg', RSA: 'za', ALG: 'dz',
  TUN: 'tn', CIV: 'ci', COD: 'cd', NGA: 'ng', GHA: 'gh', MLI: 'ml',
  GUI: 'gn', COG: 'cg', MOZ: 'mz', ZIM: 'zw', UGA: 'ug', TAN: 'tz',
  // AFC
  JPN: 'jp', KOR: 'kr', AUS: 'au', KSA: 'sa', IRN: 'ir', IRQ: 'iq',
  UZB: 'uz', JOR: 'jo', QAT: 'qa', CHN: 'cn', UAE: 'ae', KUW: 'kw',
  // OFC
  NZL: 'nz',
};

// Combina KNOWN_FLAGS com teams.json para máxima cobertura
function buildFlagMap() {
  try {
    const teams = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'teams.json'), 'utf8'));
    const map = { ...KNOWN_FLAGS };
    for (const t of teams.teams) if (!map[t.id]) map[t.id] = t.flag;
    return map;
  } catch {
    return { ...KNOWN_FLAGS };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function apiGet(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      path: `/v4/competitions/${WC_CODE}/${endpoint}`,
      method: 'GET',
      headers: { 'X-Auth-Token': API_KEY },
    };

    const req = https.get(options, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} em /${endpoint}: ${body}`));
          return;
        }
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(e); }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(new Error('Timeout')); });
  });
}

function saveJSON(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`✓ Salvo: ${filename}`);
}

// ── Transformers ──────────────────────────────────────────────────────────────

function buildGroupsJSON(standingsResp, flagMap) {
  const groups = {};

  for (const standing of standingsResp.standings) {
    if (standing.type !== 'TOTAL') continue;
    const letter = (standing.group ?? '').replace(/^(GROUP_|Group\s+)/i, '').trim() || '?';

    groups[letter] = {
      teams: standing.table.map(entry => ({
        id:     entry.team.tla,
        name:   entry.team.name,
        flag:   flagMap[entry.team.tla] ?? entry.team.tla.toLowerCase().slice(0, 2),
        played: entry.playedGames,
        won:    entry.won,
        drawn:  entry.draw,
        lost:   entry.lost,
        gf:     entry.goalsFor,
        ga:     entry.goalsAgainst,
        gd:     entry.goalDifference,
        points: entry.points,
      })),
    };
  }

  return { groups };
}

function buildScorersJSON(scorersResp, flagMap) {
  const scorers = (scorersResp.scorers ?? []).map(s => ({
    player:    s.player.name,
    team:      s.team.tla,
    team_name: s.team.name,
    flag_code: flagMap[s.team.tla] ?? null,
    goals:     s.goals ?? 0,
    assists:   s.assists ?? 0,
    matches:   s.playedMatches ?? 0,
  }));

  // Separar artilheiros de assistências
  const assists = [...scorers]
    .filter(s => s.assists > 0)
    .sort((a, b) => b.assists - a.assists);

  return { scorers, assists };
}

function buildBracketJSON(matchesResp, flagMap) {
  const knockout = {
    r32:   { label: 'Rodada de 32',    matches: [] },
    r16:   { label: 'Oitavas de Final', matches: [] },
    qf:    { label: 'Quartas de Final', matches: [] },
    sf:    { label: 'Semifinais',       matches: [] },
    third: { label: '3º Lugar',         matches: [] },
    final: { label: 'Final',            matches: [] },
  };

  const stageMap = {
    'LAST_32':            'r32',
    'ROUND_OF_16':        'r16',
    'QUARTER_FINALS':     'qf',
    'SEMI_FINALS':        'sf',
    'THIRD_PLACE':        'third',
    'FINAL':              'final',
  };

  for (const match of matchesResp.matches ?? []) {
    const key = stageMap[match.stage];
    if (!key) continue;

    knockout[key].matches.push({
      id:         match.id,
      home:       match.homeTeam?.name ? { name: match.homeTeam.name, flag: flagMap[match.homeTeam.tla] ?? null } : null,
      away:       match.awayTeam?.name ? { name: match.awayTeam.name, flag: flagMap[match.awayTeam.tla] ?? null } : null,
      home_score: match.score?.fullTime?.home ?? null,
      away_score: match.score?.fullTime?.away ?? null,
      winner:     match.score?.winner === 'HOME_TEAM'
                    ? match.homeTeam?.name
                    : match.score?.winner === 'AWAY_TEAM'
                    ? match.awayTeam?.name
                    : null,
      date:       match.utcDate ?? null,
      status:     match.status === 'IN_PLAY' ? 'live'
                : match.status === 'FINISHED'  ? 'finished'
                : 'pending',
    });
  }

  return { rounds: knockout };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!API_KEY) {
    console.error('Erro: variável FOOTBALL_DATA_API_KEY não definida.');
    process.exit(1);
  }

  console.log('Buscando dados da Copa do Mundo 2026...');

  const flagMap = buildFlagMap();
  console.log(`  Mapeamento de bandeiras: ${Object.keys(flagMap).length} times`);

  try {
    const [standings, scorers, matches] = await Promise.all([
      apiGet('standings'),
      apiGet('scorers?limit=30'),
      apiGet('matches'),
    ]);

    saveJSON('groups.json',  buildGroupsJSON(standings, flagMap));
    saveJSON('scorers.json', buildScorersJSON(scorers, flagMap));
    saveJSON('bracket.json', buildBracketJSON(matches, flagMap));

    saveJSON('meta.json', {
      last_updated:    new Date().toISOString(),
      tournament:      'FIFA World Cup 2026',
      tournament_start:'2026-06-11',
      tournament_end:  '2026-07-19',
      phase:           standings.competition?.currentSeason?.currentMatchday
                         ? 'group_stage'
                         : 'knockout',
      source:          'football-data.org',
    });

    console.log('Todos os dados atualizados com sucesso.');
  } catch (err) {
    console.error('Falha ao buscar dados:', err.message);
    process.exit(1);
  }
}

main();
