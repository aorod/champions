/**
 * test-api.js
 * Teste rápido da API football-data.org para a Copa do Mundo 2026.
 *
 * Como usar:
 *   node scripts/test-api.js SUA_API_KEY_AQUI
 */

const https = require('https');

const API_KEY = process.argv[2];

if (!API_KEY) {
  console.error('\nUso: node scripts/test-api.js SUA_API_KEY\n');
  process.exit(1);
}

function apiGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.get({
      hostname: 'api.football-data.org',
      path,
      headers: { 'X-Auth-Token': API_KEY },
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        console.log(`  Status HTTP: ${res.statusCode}`);
        resolve({ status: res.statusCode, body: JSON.parse(body) });
      });
    });
    req.on('error', reject);
  });
}

async function main() {
  const endpoints = [
    { label: 'Informações da competição', path: '/v4/competitions/WC' },
    { label: 'Classificação dos grupos',  path: '/v4/competitions/WC/standings' },
    { label: 'Artilheiros (top 5)',        path: '/v4/competitions/WC/scorers?limit=5' },
    { label: 'Partidas (próximas 3)',      path: '/v4/competitions/WC/matches?limit=3' },
  ];

  for (const ep of endpoints) {
    console.log(`\n── ${ep.label} ──`);
    try {
      const { status, body } = await apiGet(ep.path);
      if (status === 200) {
        console.log('  OK');
        // Mostra um resumo útil de cada endpoint
        if (body.competition)  console.log(`  Competição: ${body.competition.name} (${body.competition.code})`);
        if (body.season)       console.log(`  Temporada: ${body.season.startDate} → ${body.season.endDate}`);
        if (body.standings)    console.log(`  Grupos encontrados: ${body.standings.filter(s => s.type === 'TOTAL').length}`);
        if (body.scorers)      console.log(`  Artilheiros: ${body.scorers.length} · Top: ${body.scorers[0]?.player?.name ?? '—'} (${body.scorers[0]?.goals ?? 0} gols)`);
        if (body.matches)      console.log(`  Partidas retornadas: ${body.matches.length}`);
      } else {
        console.log(`  ERRO: ${body.message ?? JSON.stringify(body)}`);
      }
    } catch (err) {
      console.log(`  FALHA: ${err.message}`);
    }

    // Aguarda 1s entre requests para respeitar rate limit
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\nTeste concluído.\n');
}

main();
