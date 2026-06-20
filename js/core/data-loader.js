const DataLoader = (() => {
  const cache = {};

  async function load(path) {
    if (cache[path]) return cache[path];
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Erro ao carregar ${path} (${res.status})`);
    const data = await res.json();
    cache[path] = data;
    return data;
  }

  function formatDateTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function setLastUpdated(iso) {
    const el = document.getElementById('lastUpdated');
    if (el) el.textContent = iso ? formatDateTime(iso) : 'Aguardando dados';
  }

  function flagUrl(code, size = 40) {
    return `https://flagcdn.com/w${size}/${code.toLowerCase()}.png`;
  }

  function flagImg(code, alt, size = 40) {
    const img = document.createElement('img');
    img.src = flagUrl(code, size);
    img.alt = alt;
    img.loading = 'lazy';
    return img;
  }

  return { load, setLastUpdated, flagUrl, flagImg };
})();
