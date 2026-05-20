const API_BASE = import.meta.env.DEV ? 'http://localhost:8000' : '';

async function fetchAPI(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export function healthCheck() { return fetchAPI('/api/health'); }
export function getUniverses() { return fetchAPI('/api/universes'); }
export function searchTickers(query) { return fetchAPI(`/api/tickers/search?q=${encodeURIComponent(query)}&limit=20`); }
export function validateTickers(tickers) { return fetchAPI('/api/tickers/validate', { method: 'POST', body: JSON.stringify(tickers) }); }
export function getRegime() { return fetchAPI('/api/regime'); }
export function startScan(tickers, rsThreshold, runVcp, runPocketPivot, generateCharts) {
  return fetchAPI('/api/scan', { method: 'POST', body: JSON.stringify({ tickers, rs_threshold: rsThreshold, run_vcp: runVcp, run_pocket_pivot: runPocketPivot, generate_charts: generateCharts }) });
}
export function getScanStatus(jobId) { return fetchAPI(`/api/scan/${jobId}`); }
export function cancelScan(jobId) { return fetchAPI(`/api/scan/${jobId}`, { method: 'DELETE' }); }
export function getChartUrl(jobId, ticker) { return `${API_BASE}/api/scan/${jobId}/chart/${ticker}.png`; }
