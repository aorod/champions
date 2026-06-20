const Updater = (() => {
  const WORKER_URL = 'https://champions-updater.oliveiraandersson.workers.dev';
  const WAIT_S     = 50;

  async function triggerWorkflow() {
    const res = await fetch(WORKER_URL, { method: 'POST' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
  }

  function startCountdown(btn, seconds) {
    btn.disabled = true;
    const tick = () => {
      btn.textContent = `⏳ ${seconds}s`;
      if (seconds <= 0) { window.location.reload(); return; }
      seconds--;
      setTimeout(tick, 1000);
    };
    tick();
  }

  function initButton() {
    const btn = document.getElementById('refreshBtn');
    if (!btn) return;

    const elapsed   = Date.now() - parseInt(localStorage.getItem('champions-last-update') || '0');
    const remaining = Math.ceil((WAIT_S * 1000 - elapsed) / 1000);
    if (elapsed < WAIT_S * 1000) { startCountdown(btn, remaining); return; }

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = '⏳ Atualizando metadados...';

      try {
        await triggerWorkflow();
        localStorage.setItem('champions-last-update', Date.now().toString());
        startCountdown(btn, WAIT_S);
      } catch (err) {
        console.error('Erro ao atualizar:', err.message);
        btn.textContent = '⚠️ Erro';
        setTimeout(() => { btn.disabled = false; btn.textContent = '↻ Atualizar'; }, 3000);
      }
    });
  }

  return { initButton };
})();

document.addEventListener('DOMContentLoaded', Updater.initButton);
