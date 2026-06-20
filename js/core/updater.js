const Updater = (() => {
  const WORKER_URL = 'https://champions-updater.oliveiraandersson.workers.dev';
  const WAIT_S     = 50;

  // ── Manual refresh button ────────────────────────────────────────────────

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
      btn.textContent = '⏳ Atualizando...';

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

  // ── Auto-refresh polling ─────────────────────────────────────────────────

  let _lastUpdate      = null;
  let _pollTimer       = null;
  let _lastInteraction = Date.now();

  // Rastreia interação do usuário para decidir: auto-reload vs toast
  ['click', 'keydown', 'scroll', 'touchstart', 'mousemove'].forEach(evt => {
    document.addEventListener(evt, () => { _lastInteraction = Date.now(); }, { passive: true });
  });

  function pollInterval() {
    // Horas com jogos: 00–06 UTC (Costa Oeste EUA) e 12–23 UTC (restante)
    const h = new Date().getUTCHours();
    const isMatchHour = h <= 6 || h >= 12;
    return isMatchHour ? 60_000 : 300_000;
  }

  function showUpdateToast() {
    if (document.getElementById('update-toast')) return;

    const toast = document.createElement('div');
    toast.id = 'update-toast';
    toast.setAttribute('role', 'status');
    toast.innerHTML = `
      <span class="update-toast__msg">⚽ Placar atualizado</span>
      <button class="update-toast__btn" id="update-reload-btn">Recarregar</button>
      <button class="update-toast__close" id="update-toast-close" aria-label="Fechar">✕</button>
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('update-toast--visible'));

    const dismiss = () => {
      toast.classList.remove('update-toast--visible');
      setTimeout(() => toast.remove(), 300);
    };

    document.getElementById('update-reload-btn').addEventListener('click', () => window.location.reload());
    document.getElementById('update-toast-close').addEventListener('click', dismiss);

    // Auto-dismiss após 25s se usuário não clicar
    setTimeout(() => { if (document.getElementById('update-toast')) dismiss(); }, 25_000);
  }

  async function poll() {
    try {
      const r = await fetch(`data/meta.json?t=${Date.now()}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const meta = await r.json();

      if (_lastUpdate && meta.last_updated !== _lastUpdate) {
        // Atualiza indicador de última atualização no nav
        DataLoader.setLastUpdated(meta.last_updated);

        const idleMs = Date.now() - _lastInteraction;
        if (idleMs > 30_000) {
          // Usuário inativo: reload silencioso
          window.location.reload();
        } else {
          // Usuário ativo: toast não-intrusivo
          showUpdateToast();
        }
      }

      _lastUpdate = meta.last_updated;
    } catch (_) {
      // Falha silenciosa — tenta de novo no próximo ciclo
    }

    _pollTimer = setTimeout(poll, pollInterval());
  }

  function startAutoRefresh() {
    // Lê baseline (sem alterar UI) e agenda primeiro poll
    fetch(`data/meta.json?t=${Date.now()}`)
      .then(r => r.json())
      .then(meta => { _lastUpdate = meta.last_updated; })
      .catch(() => {})
      .finally(() => { _pollTimer = setTimeout(poll, pollInterval()); });
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    initButton();
    startAutoRefresh();
  });

  return { initButton, startAutoRefresh };
})();
