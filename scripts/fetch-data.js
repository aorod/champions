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
const ESPN_HOST  = 'site.api.espn.com';
const WC_CODE    = 'WC';
const DATA_DIR   = path.join(__dirname, '..', 'data');

// TLA → ESPN team ID (Copa do Mundo 2026, mapeamento fixo)
const ESPN_TEAM_IDS = {
  ALG:624,  ARG:202,  AUS:628,  AUT:474,  BEL:459,  BIH:452,  BRA:205,
  CAN:206,  CIV:4789, COD:2850, COL:208,  CPV:2597, CRO:477,  CUW:11678,
  CZE:450,  ECU:209,  EGY:2620, ENG:448,  ESP:164,  FRA:478,  GER:481,
  GHA:4469, HAI:2654, IRN:469,  IRQ:4375, JOR:2917, JPN:627,  KOR:451,
  KSA:655,  MAR:2869, MEX:203,  NED:449,  NOR:464,  NZL:2666, PAN:2659,
  PAR:210,  POR:482,  QAT:4398, RSA:467,  SCO:580,  SEN:654,  SUI:475,
  SWE:466,  TUN:659,  TUR:465,  URU:212,  USA:660,  UZB:2570,
};

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
  CPV: 'cv',
  // AFC
  JPN: 'jp', KOR: 'kr', AUS: 'au', KSA: 'sa', IRN: 'ir', IRQ: 'iq',
  UZB: 'uz', JOR: 'jo', QAT: 'qa', CHN: 'cn', UAE: 'ae', KUW: 'kw',
  // OFC
  NZL: 'nz',
};

// Nomes das seleções em Português-BR (chave = TLA da API)
const TEAM_NAMES_PT = {
  // CONMEBOL
  ARG: 'Argentina',    BRA: 'Brasil',         COL: 'Colômbia',
  ECU: 'Equador',      URU: 'Uruguai',        VEN: 'Venezuela',
  CHL: 'Chile',        CHI: 'Chile',          PAR: 'Paraguai',
  BOL: 'Bolívia',      PER: 'Peru',
  // CONCACAF
  USA: 'Estados Unidos', CAN: 'Canadá',       MEX: 'México',
  PAN: 'Panamá',       HND: 'Honduras',       HON: 'Honduras',
  JAM: 'Jamaica',      CRC: 'Costa Rica',     SLV: 'El Salvador',
  HAI: 'Haiti',        TRI: 'Trinidad e Tobago', CUW: 'Curaçao',
  // UEFA
  FRA: 'França',       ESP: 'Espanha',        GER: 'Alemanha',
  ENG: 'Inglaterra',   POR: 'Portugal',       ITA: 'Itália',
  NED: 'Países Baixos',BEL: 'Bélgica',        CRO: 'Croácia',
  POL: 'Polônia',      CZE: 'República Tcheca', SRB: 'Sérvia',
  TUR: 'Turquia',      UKR: 'Ucrânia',        SUI: 'Suíça',
  DEN: 'Dinamarca',    SWE: 'Suécia',         NOR: 'Noruega',
  SCO: 'Escócia',      WAL: 'País de Gales',  NIR: 'Irlanda do Norte',
  AUT: 'Áustria',      ROM: 'Romênia',        ROU: 'Romênia',
  HUN: 'Hungria',      SVK: 'Eslováquia',     SVN: 'Eslovênia',
  GRE: 'Grécia',       ALB: 'Albânia',        MNE: 'Montenegro',
  BIH: 'Bósnia e Herzegovina', MKD: 'Macedônia do Norte',
  KOS: 'Kosovo',       GEO: 'Geórgia',        ARM: 'Armênia',
  AZE: 'Azerbaijão',   FIN: 'Finlândia',      ISL: 'Islândia',
  IRL: 'Irlanda',
  // CAF
  CPV: 'Cabo Verde',
  MAR: 'Marrocos',     SEN: 'Senegal',        CMR: 'Camarões',
  EGY: 'Egito',        RSA: 'África do Sul',  ALG: 'Argélia',
  TUN: 'Tunísia',      CIV: 'Costa do Marfim',COD: 'RD Congo',
  NGA: 'Nigéria',      GHA: 'Gana',           MLI: 'Mali',
  GUI: 'Guiné',        COG: 'Congo',          MOZ: 'Moçambique',
  ZIM: 'Zimbábue',     UGA: 'Uganda',         TAN: 'Tanzânia',
  // AFC
  JPN: 'Japão',        KOR: 'Coreia do Sul',  AUS: 'Austrália',
  KSA: 'Arábia Saudita', IRN: 'Irã',          IRQ: 'Iraque',
  UZB: 'Uzbequistão',  JOR: 'Jordânia',       QAT: 'Catar',
  CHN: 'China',        UAE: 'Emirados Árabes Unidos', KUW: 'Kuwait',
  // OFC
  NZL: 'Nova Zelândia',
};

// Confederação por TLA
const TEAM_CONF = {
  ARG:'CONMEBOL',BRA:'CONMEBOL',COL:'CONMEBOL',ECU:'CONMEBOL',URU:'CONMEBOL',
  VEN:'CONMEBOL',PAR:'CONMEBOL',BOL:'CONMEBOL',PER:'CONMEBOL',CHL:'CONMEBOL',CHI:'CONMEBOL',
  USA:'CONCACAF',CAN:'CONCACAF',MEX:'CONCACAF',PAN:'CONCACAF',HND:'CONCACAF',HON:'CONCACAF',
  JAM:'CONCACAF',CRC:'CONCACAF',SLV:'CONCACAF',HAI:'CONCACAF',TRI:'CONCACAF',CUW:'CONCACAF',
  FRA:'UEFA',ESP:'UEFA',GER:'UEFA',ENG:'UEFA',POR:'UEFA',ITA:'UEFA',NED:'UEFA',BEL:'UEFA',
  CRO:'UEFA',POL:'UEFA',CZE:'UEFA',SRB:'UEFA',TUR:'UEFA',UKR:'UEFA',SUI:'UEFA',DEN:'UEFA',
  SWE:'UEFA',NOR:'UEFA',SCO:'UEFA',WAL:'UEFA',NIR:'UEFA',AUT:'UEFA',ROM:'UEFA',ROU:'UEFA',
  HUN:'UEFA',SVK:'UEFA',SVN:'UEFA',GRE:'UEFA',ALB:'UEFA',MNE:'UEFA',BIH:'UEFA',MKD:'UEFA',
  KOS:'UEFA',GEO:'UEFA',ARM:'UEFA',AZE:'UEFA',FIN:'UEFA',ISL:'UEFA',IRL:'UEFA',
  MAR:'CAF',SEN:'CAF',CMR:'CAF',EGY:'CAF',RSA:'CAF',ALG:'CAF',TUN:'CAF',CIV:'CAF',
  COD:'CAF',NGA:'CAF',GHA:'CAF',MLI:'CAF',GUI:'CAF',COG:'CAF',MOZ:'CAF',ZIM:'CAF',
  UGA:'CAF',TAN:'CAF',CPV:'CAF',
  JPN:'AFC',KOR:'AFC',AUS:'AFC',KSA:'AFC',IRN:'AFC',IRQ:'AFC',UZB:'AFC',JOR:'AFC',
  QAT:'AFC',CHN:'AFC',UAE:'AFC',KUW:'AFC',
  NZL:'OFC',
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

function espnGet(urlPath) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      { hostname: ESPN_HOST, path: urlPath, headers: { 'User-Agent': 'Mozilla/5.0' } },
      res => {
        let body = '';
        res.on('data', c => { body += c; });
        res.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error(`JSON inválido de ${urlPath}`)); }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('ESPN timeout')));
  });
}

function squadNeedsUpdate() {
  try {
    const f = path.join(DATA_DIR, 'squads.json');
    if (!fs.existsSync(f)) return true;
    const { updated } = JSON.parse(fs.readFileSync(f, 'utf8'));
    return (Date.now() - new Date(updated).getTime()) > 12 * 3600 * 1000;
  } catch { return true; }
}

// Cache de summaries por eventId para não buscar o mesmo jogo duas vezes
const summaryCache = new Map();

async function getStarterIds(eventId, espnTeamId) {
  if (!summaryCache.has(eventId)) {
    const summary = await espnGet(`/apis/site/v2/sports/soccer/fifa.world/summary?event=${eventId}`);
    const byTeam = new Map();
    for (const r of summary.rosters ?? []) {
      const tid = String(r.team?.id);
      const starters = new Set(
        (r.roster ?? []).filter(p => p.starter).map(p => String(p.athlete?.id))
      );
      const bench = new Set(
        (r.roster ?? []).filter(p => !p.starter).map(p => String(p.athlete?.id))
      );
      byTeam.set(tid, { starters, bench });
    }
    summaryCache.set(eventId, byTeam);
  }
  const entry = summaryCache.get(eventId)?.get(String(espnTeamId));
  return entry ?? null;
}

async function buildSquadsJSON(tlas) {
  const squads = {};
  for (const tla of tlas) {
    const id = ESPN_TEAM_IDS[tla];
    if (!id) { squads[tla] = []; continue; }
    try {
      const [rosterData, schedData] = await Promise.all([
        espnGet(`/apis/site/v2/sports/soccer/fifa.world/teams/${id}/roster`),
        espnGet(`/apis/site/v2/sports/soccer/fifa.world/teams/${id}/schedule`),
      ]);

      // Último jogo finalizado
      const lastEvent = [...(schedData.events ?? [])]
        .filter(e => e.competitions?.[0]?.status?.type?.completed)
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0] ?? null;

      let starterEntry = null;
      if (lastEvent) {
        starterEntry = await getStarterIds(lastEvent.id, id);
      }

      const players = (rosterData.athletes ?? []).map(a => {
        const statMap = {};
        for (const cat of a.statistics?.splits?.categories ?? [])
          for (const s of cat.stats ?? []) statMap[s.name] = s.value ?? 0;

        const espnId = String(a.id);
        let lastMatchStarter = null;
        if (starterEntry) {
          if (starterEntry.starters.has(espnId))     lastMatchStarter = true;
          else if (starterEntry.bench.has(espnId))   lastMatchStarter = false;
          // null = não estava na lista dos 23 do jogo
        }

        return {
          espnId,
          name:             a.displayName,
          jersey:           a.jersey ? parseInt(a.jersey, 10) : null,
          position:         a.position?.abbreviation ?? null,
          goals:            statMap.totalGoals    ?? 0,
          assists:          statMap.goalAssists   ?? 0,
          yellowCards:      statMap.yellowCards   ?? 0,
          redCards:         statMap.redCards      ?? 0,
          appearances:      statMap.appearances   ?? 0,
          lastMatchStarter,
        };
      });
      players.sort((a, b) => (a.jersey ?? 99) - (b.jersey ?? 99));
      squads[tla] = players;
      process.stdout.write('.');
    } catch (e) {
      console.warn(`\n  Aviso: squad ${tla} falhou: ${e.message}`);
      squads[tla] = [];
    }
    await new Promise(r => setTimeout(r, 150));
  }
  console.log();
  return { updated: new Date().toISOString(), squads };
}

// ── Transformers ──────────────────────────────────────────────────────────────

function buildTeamsJSON(standingsResp, flagMap) {
  const teams = [];

  for (const standing of standingsResp.standings) {
    if (standing.type !== 'TOTAL') continue;
    const group = (standing.group ?? '').replace(/^(GROUP_|Group\s+)/i, '').trim() || '?';

    for (const entry of standing.table) {
      const tla = entry.team.tla;
      teams.push({
        id:            tla,
        name:          TEAM_NAMES_PT[tla] ?? entry.team.name,
        flag:          flagMap[tla] ?? tla.toLowerCase().slice(0, 2),
        confederation: TEAM_CONF[tla] ?? 'OTHER',
        group,
      });
    }
  }

  teams.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  return { teams };
}

function buildGroupsJSON(standingsResp, flagMap) {
  const groups = {};

  for (const standing of standingsResp.standings) {
    if (standing.type !== 'TOTAL') continue;
    const letter = (standing.group ?? '').replace(/^(GROUP_|Group\s+)/i, '').trim() || '?';

    groups[letter] = {
      teams: standing.table.map(entry => ({
        id:     entry.team.tla,
        name:   TEAM_NAMES_PT[entry.team.tla] ?? entry.team.name,
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
    team_name: TEAM_NAMES_PT[s.team.tla] ?? s.team.name,
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

// Tradução de cidades ESPN → português (formato "Cidade, Estado")
const CITY_PT = {
  'Mexico City':                  'Cidade do México',
  'Guadalajara':                  'Guadalajara',
  'Guadalupe':                    'Monterrey',
  'Philadelphia, Pennsylvania':   'Filadélfia, PA',
  'East Rutherford, New Jersey':  'Nova York / Nova Jersey',
  'Inglewood, California':        'Los Angeles, CA',
  'Santa Clara, California':      'San Jose / Bay Area, CA',
  'Glendale, Arizona':            'Phoenix, AZ',
  'Kansas City, Missouri':        'Kansas City, MO',
  'Chicago, Illinois':            'Chicago, IL',
  'Houston, Texas':               'Houston, TX',
  'Miami Gardens, Florida':       'Miami, FL',
  'Arlington, Texas':             'Dallas, TX',
  'Atlanta, Georgia':             'Atlanta, GA',
  'Foxborough, Massachusetts':    'Boston, MA',
  'Seattle, Washington':          'Seattle, WA',
  'Vancouver':                    'Vancouver, BC',
  'Toronto':                      'Toronto, ON',
};

// Normalização de TLAs que diferem entre football-data.org e ESPN
const ESPN_TLA_MAP = {
  'URY': 'URU',  // Uruguai
  'GRN': 'GRE',  // Grécia (se aparecer)
};

async function buildVenueMap(matchDates) {
  const venueMap = {};
  const unique = [...new Set(matchDates)].sort();

  // Agrupa em chunks de 7 dias para minimizar requests
  const chunks = [];
  for (let i = 0; i < unique.length; i += 7) chunks.push(unique.slice(i, i + 7));

  for (const chunk of chunks) {
    const from = chunk[0].replace(/-/g, '');
    const to   = chunk[chunk.length - 1].replace(/-/g, '');
    const range = from === to ? from : `${from}-${to}`;

    try {
      const data = await espnGet(`/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${range}`);
      for (const event of data.events ?? []) {
        const comp = event.competitions?.[0];
        const home = comp?.competitors?.find(c => c.homeAway === 'home');
        const away = comp?.competitors?.find(c => c.homeAway === 'away');
        if (!home?.team?.abbreviation || !away?.team?.abbreviation) continue;

        const normTLA = tla => ESPN_TLA_MAP[tla] ?? tla;
        const homeTLA = normTLA(home.team.abbreviation);
        const awayTLA = normTLA(away.team.abbreviation);

        const venueName = comp?.venue?.fullName ?? null;
        const rawCity   = comp?.venue?.address?.city ?? null;
        const city      = rawCity ? (CITY_PT[rawCity] ?? rawCity) : null;

        venueMap[`${homeTLA}|${awayTLA}`] = { venue: venueName, city };
      }
    } catch (e) {
      console.warn(`  Aviso: venues ESPN falhou (${range}): ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`  Venues ESPN: ${Object.keys(venueMap).length} partidas mapeadas`);
  return venueMap;
}

function buildGroupMatchesJSON(matchesResp, flagMap, venueMap = {}) {
  const groupMatches = (matchesResp.matches ?? [])
    .filter(m => m.stage === 'GROUP_STAGE')
    .map(match => {
      const group    = (match.group ?? '').replace(/^(GROUP_|Group\s+)/i, '').trim();
      const homeTLA  = match.homeTeam?.tla;
      const awayTLA  = match.awayTeam?.tla;
      const venueKey = `${homeTLA}|${awayTLA}`;
      const venueData = venueMap[venueKey] ?? {};
      return {
        id:         match.id,
        group:      group || '?',
        matchday:   match.matchday ?? null,
        home:       match.homeTeam?.name
                      ? { name: TEAM_NAMES_PT[homeTLA] ?? match.homeTeam.name, tla: homeTLA, flag: flagMap[homeTLA] ?? null }
                      : null,
        away:       match.awayTeam?.name
                      ? { name: TEAM_NAMES_PT[awayTLA] ?? match.awayTeam.name, tla: awayTLA, flag: flagMap[awayTLA] ?? null }
                      : null,
        home_score: match.score?.fullTime?.home ?? null,
        away_score: match.score?.fullTime?.away ?? null,
        winner:     match.score?.winner === 'HOME_TEAM' ? 'home'
                  : match.score?.winner === 'AWAY_TEAM' ? 'away'
                  : match.score?.winner === 'DRAW'      ? 'draw'
                  : null,
        date:       match.utcDate ?? null,
        venue:      venueData.venue ?? null,
        city:       venueData.city  ?? null,
        status:     match.status === 'IN_PLAY'  ? 'live'
                  : match.status === 'FINISHED'  ? 'finished'
                  : 'pending',
      };
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return { matches: groupMatches };
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
      home:       match.homeTeam?.name ? { name: TEAM_NAMES_PT[match.homeTeam.tla] ?? match.homeTeam.name, tla: match.homeTeam.tla, flag: flagMap[match.homeTeam.tla] ?? null } : null,
      away:       match.awayTeam?.name ? { name: TEAM_NAMES_PT[match.awayTeam.tla] ?? match.awayTeam.name, tla: match.awayTeam.tla, flag: flagMap[match.awayTeam.tla] ?? null } : null,
      home_score: match.score?.fullTime?.home ?? null,
      away_score: match.score?.fullTime?.away ?? null,
      winner:     match.score?.winner === 'HOME_TEAM' ? 'home'
                : match.score?.winner === 'AWAY_TEAM' ? 'away'
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

    const teamsJSON = buildTeamsJSON(standings, flagMap);
    saveJSON('teams.json',   teamsJSON);
    saveJSON('groups.json',  buildGroupsJSON(standings, flagMap));
    saveJSON('scorers.json', buildScorersJSON(scorers, flagMap));
    saveJSON('bracket.json', buildBracketJSON(matches, flagMap));

    const matchDates = [...new Set(
      (matches.matches ?? [])
        .filter(m => m.stage === 'GROUP_STAGE' && m.utcDate)
        .map(m => m.utcDate.slice(0, 10))
    )];
    console.log(`Buscando venues ESPN para ${matchDates.length} datas...`);
    const venueMap = await buildVenueMap(matchDates);
    saveJSON('matches.json', buildGroupMatchesJSON(matches, flagMap, venueMap));

    if (squadNeedsUpdate()) {
      const tlas = teamsJSON.teams.map(t => t.id);
      console.log(`Buscando elencos ESPN para ${tlas.length} times...`);
      const squadsData = await buildSquadsJSON(tlas);
      saveJSON('squads.json', squadsData);
    } else {
      console.log('  squads.json recente, sem atualização.');
    }

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
