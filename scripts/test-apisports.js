const https = require('https');
const fs = require('fs');
const path = require('path');
const KEY = process.env.API_SPORTS_KEY;

function get(p) {
  return new Promise((resolve, reject) => {
    https.get({ hostname: 'v3.football.api-sports.io', path: p, headers: { 'x-apisports-key': KEY } }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });
}

async function main() {
  const groups = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/groups.json'), 'utf8'));
  const tlas = [...new Set(
    Object.values(groups.groups).flatMap(g => g.teams.map(t => t.id))
  )].sort();

  console.log(`Buscando IDs para ${tlas.length} times...\n`);
  const map = {};

  for (const tla of tlas) {
    const r = await get(`/teams?code=${tla}`);
    const t = r.response?.[0]?.team;
    map[tla] = t?.id ?? null;
    console.log(`  ${tla} → ${t?.id ?? 'NOT FOUND'} | ${t?.name ?? ''}`);
    await new Promise(res => setTimeout(res, 200)); // respeitar rate limit
  }

  console.log('\n\nMapa final para copiar no fetch-data.js:');
  console.log(JSON.stringify(map, null, 2));
}

main().catch(console.error);
