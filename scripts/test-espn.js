const https = require('https');

function get(path) {
  return new Promise((resolve, reject) => {
    https.get({ hostname: 'site.api.espn.com', path, headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch(e) { resolve({ status: res.statusCode, raw: body.slice(0, 300) }); }
      });
    }).on('error', reject);
  });
}

async function main() {
  // 1. Schedule do Brasil (ESPN ID 205)
  console.log('=== Schedule Brasil ===');
  const sched = await get('/apis/site/v2/sports/soccer/fifa.world/teams/205/schedule');
  console.log('Status:', sched.status);
  if (sched.data) {
    const events = sched.data.events ?? [];
    console.log('Total eventos:', events.length);
    events.forEach(e => {
      const comp = e.competitions?.[0];
      const done = comp?.status?.type?.completed;
      const h = comp?.competitors?.find(c => c.homeAway === 'home');
      const a = comp?.competitors?.find(c => c.homeAway === 'away');
      console.log(`  [${done ? 'FIM' : '   '}] ID:${e.id} | ${h?.team?.abbreviation} x ${a?.team?.abbreviation} | ${e.date?.slice(0,10)}`);
    });

    // Pegar último jogo finalizado
    const lastEvent = [...events]
      .filter(e => e.competitions?.[0]?.status?.type?.completed)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    if (lastEvent) {
      console.log('\n=== Summary último jogo (titulares Brasil) ===');
      const summary = await get(`/apis/site/v2/sports/soccer/fifa.world/summary?event=${lastEvent.id}`);
      console.log('Status:', summary.status);
      const braRoster = summary.data?.rosters?.find(r => String(r.team?.id) === '205');
      console.log('Roster encontrado:', !!braRoster);
      braRoster?.roster?.slice(0, 15).forEach(p => {
        console.log(`  [${p.starter ? 'TIT' : 'RES'}] #${p.jersey} ${p.athlete?.displayName} | ${p.position?.abbreviation}`);
      });
    }
  } else {
    console.log('Raw:', sched.raw);
  }

  // 2. Testar com time que já jogou - Haiti (ID 2654)
  console.log('\n=== Schedule Haiti ===');
  const sched2 = await get('/apis/site/v2/sports/soccer/fifa.world/teams/2654/schedule');
  console.log('Status:', sched2.status, '| Eventos:', sched2.data?.events?.length);
}

main().catch(console.error);
