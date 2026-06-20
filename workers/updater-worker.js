export default {
  async fetch(request, env) {

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Rate limiting por IP — 1 disparo a cada 5 minutos por endereço
    const COOLDOWN_S   = 300;
    const ip           = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimitKey = `rate:${ip}`;
    const lastCall     = await env.RATE_LIMIT.get(rateLimitKey);

    if (lastCall) {
      const elapsed   = Date.now() - parseInt(lastCall, 10);
      const remaining = Math.ceil((COOLDOWN_S * 1000 - elapsed) / 1000);
      if (elapsed < COOLDOWN_S * 1000) {
        return new Response(
          JSON.stringify({ ok: false, error: `Aguarde ${remaining}s antes de atualizar novamente.` }),
          { status: 429, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
      }
    }

    await env.RATE_LIMIT.put(rateLimitKey, Date.now().toString(), { expirationTtl: COOLDOWN_S });

    try {
      const res = await fetch(
        'https://api.github.com/repos/aorod/champions/actions/workflows/update-matchday.yml/dispatches',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.GITHUB_PAT}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'champions-worker',
          },
          body: JSON.stringify({ ref: 'main' }),
        }
      );

      if (res.status === 204) {
        return new Response(JSON.stringify({ ok: true }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      const body = await res.json().catch(() => ({}));
      return new Response(JSON.stringify({ ok: false, error: body.message }), {
        status: res.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });

    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
