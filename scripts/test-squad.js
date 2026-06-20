const https = require('https');
const API_KEY = process.env.FOOTBALL_DATA_API_KEY;

function apiGet(path) {
  return new Promise((resolve, reject) => {
    https.get({
      hostname: 'api.football-data.org',
      path,
      headers: { 'X-Auth-Token': API_KEY },
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body) }));
    }).on('error', reject);
  });
}

async function main() {
  // 1. Squad via teams endpoint
  console.log('\n=== /v4/competitions/WC/teams (first team squad) ===');
  const teams = await apiGet('/v4/competitions/WC/teams');
  console.log('Status:', teams.status);
  const firstTeam = teams.data.teams?.[0];
  if (firstTeam) {
    console.log('Time:', firstTeam.name, '| TLA:', firstTeam.tla);
    console.log('Squad (primeiros 3):', JSON.stringify(firstTeam.squad?.slice(0, 3), null, 2));
  }

  // 2. Detalhes de uma partida finalizada
  console.log('\n=== /v4/matches (primeiro jogo finalizado) ===');
  const matches = await apiGet('/v4/competitions/WC/matches?status=FINISHED');
  console.log('Status:', matches.status);
  const match = matches.data.matches?.[0];
  if (match) {
    console.log('Partida:', match.homeTeam?.name, 'x', match.awayTeam?.name);
    console.log('Goals:', JSON.stringify(match.goals?.slice(0, 2), null, 2));
    console.log('Bookings:', JSON.stringify(match.bookings?.slice(0, 2), null, 2));
    console.log('Lineups keys:', match.lineups ? Object.keys(match.lineups[0] ?? {}) : 'null');
  }
}

main().catch(console.error);
