const API_KEY_STORAGE_KEY = 'llm_cost_optimizer_api_key';

const state = {
  timeframe: '24h'
};

const el = {
  apiKeyInput: document.getElementById('apiKeyInput'),
  refreshBtn: document.getElementById('refreshBtn'),
  clearCacheBtn: document.getElementById('clearCacheBtn'),
  statusLine: document.getElementById('statusLine'),
  timeframeRow: document.getElementById('timeframeRow'),
  statTotalRequests: document.getElementById('statTotalRequests'),
  statCacheHitRate: document.getElementById('statCacheHitRate'),
  statCostSaved: document.getElementById('statCostSaved'),
  statAvgTime: document.getElementById('statAvgTime'),
  modelUsage: document.getElementById('modelUsage'),
  recentRequestsBody: document.getElementById('recentRequestsBody')
};

el.apiKeyInput.value = localStorage.getItem(API_KEY_STORAGE_KEY) || '';

function authHeaders() {
  const key = el.apiKeyInput.value.trim();
  return key ? { 'x-api-key': key } : {};
}

function setStatus(message, isError = false) {
  el.statusLine.textContent = message;
  el.statusLine.classList.toggle('error', isError);
}

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(4)}`;
}

function formatMs(value) {
  return `${Math.round(Number(value || 0))} ms`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function fetchJson(path) {
  const response = await fetch(path, { headers: authHeaders() });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized — check the x-api-key value above');
    }
    throw new Error(`Request to ${path} failed (${response.status})`);
  }
  return response.json();
}

function renderModelUsage(modelUsage) {
  if (!modelUsage || modelUsage.length === 0) {
    el.modelUsage.innerHTML = '<div class="empty">No data yet</div>';
    return;
  }

  const maxCount = Math.max(...modelUsage.map((m) => m.count));
  el.modelUsage.innerHTML = modelUsage
    .map((m) => {
      const pct = maxCount > 0 ? Math.max(4, Math.round((m.count / maxCount) * 100)) : 0;
      return `
        <div class="bar-row">
          <div class="name" title="${escapeHtml(m._id || 'unknown')}">${escapeHtml(m._id || 'unknown')}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
          <div class="count">${m.count}</div>
        </div>
      `;
    })
    .join('');
}

function renderRecentRequests(requests) {
  if (!requests || requests.length === 0) {
    el.recentRequestsBody.innerHTML = '<tr><td colspan="6" class="empty">No data yet</td></tr>';
    return;
  }

  el.recentRequestsBody.innerHTML = requests
    .map((r) => {
      const time = new Date(r.timestamp).toLocaleString();
      const prompt = (r.originalPrompt || '').slice(0, 80);
      const cachePill = r.cacheHit
        ? '<span class="pill hit">hit</span>'
        : '<span class="pill">miss</span>';
      return `
        <tr>
          <td>${escapeHtml(time)}</td>
          <td class="prompt" title="${escapeHtml(r.originalPrompt || '')}">${escapeHtml(prompt)}</td>
          <td>${escapeHtml(r.model || '')}</td>
          <td>${cachePill}</td>
          <td>${formatMoney(r.cost?.saved)}</td>
          <td>${formatMs(r.processingTime)}</td>
        </tr>
      `;
    })
    .join('');
}

async function loadDashboard() {
  setStatus('Loading…');
  try {
    const stats = await fetchJson(`/api/dashboard/stats?timeframe=${state.timeframe}`);

    el.statTotalRequests.textContent = stats.totalRequests ?? 0;
    el.statCacheHitRate.textContent = `${stats.cacheHitRate ?? 0}%`;
    el.statCostSaved.textContent = formatMoney(stats.totalCostSaved);
    el.statAvgTime.textContent = formatMs(stats.avgProcessingTime);

    renderModelUsage(stats.modelUsage);
    renderRecentRequests(stats.recentRequests);

    setStatus(`Updated ${new Date().toLocaleTimeString()}`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function clearCache() {
  setStatus('Clearing cache…');
  try {
    const response = await fetch('/api/dashboard/cache/clear', {
      method: 'POST',
      headers: authHeaders()
    });
    if (!response.ok) {
      throw new Error(response.status === 401 ? 'Unauthorized — check the x-api-key value above' : 'Failed to clear cache');
    }
    await loadDashboard();
  } catch (error) {
    setStatus(error.message, true);
  }
}

el.apiKeyInput.addEventListener('change', () => {
  localStorage.setItem(API_KEY_STORAGE_KEY, el.apiKeyInput.value.trim());
  loadDashboard();
});

el.refreshBtn.addEventListener('click', loadDashboard);
el.clearCacheBtn.addEventListener('click', clearCache);

el.timeframeRow.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-timeframe]');
  if (!button) return;
  state.timeframe = button.dataset.timeframe;
  [...el.timeframeRow.querySelectorAll('button')].forEach((b) => b.classList.toggle('active', b === button));
  loadDashboard();
});

loadDashboard();
setInterval(loadDashboard, 30000);
