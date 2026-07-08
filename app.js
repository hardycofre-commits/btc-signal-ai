const API = {
  price: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true',
  fear: 'https://api.alternative.me/fng/?limit=1',
  news: 'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=BTC'
};

const state = {
  price: 0,
  change24h: 0,
  fearValue: 50,
  fearLabel: 'Neutral',
  newsScore: 0,
  newsItems: [],
  finalScore: 50,
  signal: 'ESPERAR'
};

const el = id => document.getElementById(id);
const money = n => n ? `US$${Number(n).toLocaleString('es-CL', { maximumFractionDigits: 0 })}` : '--';

function classifyNews(title) {
  const t = title.toLowerCase();
  const bullish = ['etf', 'inflow', 'buy', 'buys', 'bull', 'rally', 'surge', 'record', 'approval', 'adoption', 'accumulate', 'breakout', 'reserve'];
  const bearish = ['hack', 'outflow', 'sell', 'sells', 'bear', 'crash', 'drop', 'lawsuit', 'ban', 'fed', 'rate hike', 'liquidation', 'fear'];
  let score = 0;
  bullish.forEach(w => { if (t.includes(w)) score += 1; });
  bearish.forEach(w => { if (t.includes(w)) score -= 1; });
  if (score > 0) return { label: 'Alcista', cls: 'good', pts: 3 };
  if (score < 0) return { label: 'Bajista', cls: 'bad', pts: -3 };
  return { label: 'Neutral', cls: 'neutral', pts: 0 };
}

async function loadPrice() {
  const res = await fetch(API.price);
  const data = await res.json();
  state.price = data.bitcoin.usd;
  state.change24h = data.bitcoin.usd_24h_change || 0;
}

async function loadFear() {
  const res = await fetch(API.fear);
  const data = await res.json();
  const item = data.data[0];
  state.fearValue = Number(item.value);
  state.fearLabel = item.value_classification;
}

async function loadNews() {
  try {
    const res = await fetch(API.news);
    const data = await res.json();
    const list = (data.Data || []).slice(0, 8);
    state.newsItems = list.map(n => ({ ...n, sentiment: classifyNews(n.title) }));
    state.newsScore = state.newsItems.reduce((a, n) => a + n.sentiment.pts, 0);
  } catch (e) {
    state.newsItems = [];
    state.newsScore = 0;
  }
}

function calculateScore() {
  let score = 50;
  let pricePts = state.change24h > 1 ? 12 : state.change24h < -1 ? -12 : 0;
  let fearPts = 0;
  if (state.fearValue <= 25) fearPts = 6;       // miedo extremo puede ser zona de oportunidad, con cautela
  else if (state.fearValue >= 75) fearPts = -8; // codicia extrema aumenta riesgo
  else if (state.fearValue >= 45 && state.fearValue <= 65) fearPts = 4;
  let newsPts = Math.max(-15, Math.min(15, state.newsScore));
  let riskPts = state.fearValue <= 20 || Math.abs(state.change24h) > 5 ? -8 : 0;
  score += pricePts + fearPts + newsPts + riskPts;
  score = Math.max(0, Math.min(100, Math.round(score)));

  let signal = 'ESPERAR';
  if (score >= 75 && state.change24h >= 0) signal = 'COMPRAR';
  if (score <= 35 || (state.change24h < -3 && newsPts < 0)) signal = 'VENDER';

  state.finalScore = score;
  state.signal = signal;
  return { pricePts, fearPts, newsPts, riskPts, score, signal };
}

function renderNews() {
  const box = el('newsList');
  if (!state.newsItems.length) {
    el('newsStatus').textContent = 'No disponible';
    box.innerHTML = '<p>No se pudieron cargar noticias. Revisa conexión o CORS de la fuente.</p>';
    return;
  }
  el('newsStatus').textContent = `${state.newsItems.length} noticias`;
  box.innerHTML = state.newsItems.map(n => `
    <article class="news-item">
      <div class="badge ${n.sentiment.cls}">${n.sentiment.label}</div>
      <div>
        <h4><a href="${n.url}" target="_blank" rel="noopener">${n.title}</a></h4>
        <p>${n.source_info?.name || 'Fuente cripto'} · ${new Date(n.published_on * 1000).toLocaleString('es-CL')}</p>
      </div>
    </article>
  `).join('');
}

function renderRisk() {
  const capital = Number(el('capitalInput').value || 0);
  const risk = Number(el('riskInput').value || 0);
  const lev = Number(el('leverageInput').value || 1);
  const maxLoss = capital * risk / 100;
  const position = capital * lev;
  el('maxLoss').textContent = `US$${maxLoss.toFixed(2)}`;
  el('positionSize').textContent = `US$${position.toFixed(2)}`;
}

function renderAll() {
  const calc = calculateScore();
  const p = state.price;
  const isBuy = state.signal === 'COMPRAR';
  const isSell = state.signal === 'VENDER';
  const stop = isSell ? p * 1.015 : p * 0.985;
  const take = isSell ? p * 0.97 : p * 1.03;
  const riskLevel = state.finalScore >= 75 || state.finalScore <= 35 ? 'Medio' : 'Alto';

  el('btcPrice').textContent = money(p);
  el('btcChange').textContent = `${state.change24h.toFixed(2)}%`;
  el('lastUpdate').textContent = `Última actualización: ${new Date().toLocaleString('es-CL')}`;
  el('signalText').textContent = state.signal;
  el('confidenceText').textContent = `${state.finalScore}%`;
  el('signalCard').className = `card signal-card ${isBuy ? 'buy' : isSell ? 'sell' : 'wait'}`;
  el('scoreText').textContent = state.finalScore;
  el('scoreGauge').style.background = `conic-gradient(${isBuy ? 'var(--green)' : isSell ? 'var(--red)' : 'var(--yellow)'} ${state.finalScore * 3.6}deg, var(--panel-2) 0deg)`;
  el('scoreComment').textContent = isBuy ? 'Sesgo alcista. Revisar entrada con stop.' : isSell ? 'Sesgo bajista. Alta cautela.' : 'No hay ventaja clara. Mejor esperar confirmación.';
  el('fearValue').textContent = `${state.fearValue}/100`;
  el('fearLabel').textContent = state.fearLabel;
  el('entryPrice').textContent = money(p);
  el('stopLoss').textContent = money(stop);
  el('takeProfit').textContent = money(take);
  el('riskLevel').textContent = riskLevel;

  el('factorPrice').textContent = state.change24h > 1 ? 'Positiva' : state.change24h < -1 ? 'Negativa' : 'Neutral';
  el('factorPricePts').textContent = `${calc.pricePts > 0 ? '+' : ''}${calc.pricePts} pts`;
  el('factorFear').textContent = state.fearLabel;
  el('factorFearPts').textContent = `${calc.fearPts > 0 ? '+' : ''}${calc.fearPts} pts`;
  el('factorNews').textContent = calc.newsPts > 3 ? 'Alcistas' : calc.newsPts < -3 ? 'Bajistas' : 'Mixtas';
  el('factorNewsPts').textContent = `${calc.newsPts > 0 ? '+' : ''}${calc.newsPts} pts`;
  el('factorRisk').textContent = calc.riskPts < 0 ? 'Alto' : 'Normal';
  el('factorRiskPts').textContent = `${calc.riskPts} pts`;
  el('factorSignal').textContent = state.signal;
  el('factorTotal').textContent = `Total ${state.finalScore}/100`;

  renderRisk();
  renderNews();
  saveSignal();
  renderHistory();
}

function saveSignal() {
  const key = 'btc-signal-ai-history-v12';
  const history = JSON.parse(localStorage.getItem(key) || '[]');
  const last = history[0];
  const now = new Date();
  if (last && now - new Date(last.iso) < 30 * 60 * 1000) return;
  history.unshift({
    iso: now.toISOString(),
    date: now.toLocaleString('es-CL'),
    signal: state.signal,
    price: money(state.price),
    score: state.finalScore,
    reason: `24h ${state.change24h.toFixed(2)}%, Fear ${state.fearValue}, Noticias ${state.newsScore}`
  });
  localStorage.setItem(key, JSON.stringify(history.slice(0, 30)));
}

function renderHistory() {
  const key = 'btc-signal-ai-history-v12';
  const history = JSON.parse(localStorage.getItem(key) || '[]');
  el('historyBody').innerHTML = history.map(h => `
    <tr><td>${h.date}</td><td>${h.signal}</td><td>${h.price}</td><td>${h.score}</td><td>${h.reason}</td></tr>
  `).join('') || '<tr><td colspan="5">Sin historial aún.</td></tr>';
}

async function refresh() {
  el('refreshBtn').textContent = 'Actualizando...';
  try {
    await Promise.all([loadPrice(), loadFear(), loadNews()]);
    renderAll();
  } catch (e) {
    alert('No se pudo actualizar. Revisa conexión o intenta nuevamente.');
  } finally {
    el('refreshBtn').textContent = 'Actualizar';
  }
}

el('refreshBtn').addEventListener('click', refresh);
el('capitalInput').addEventListener('input', renderRisk);
el('riskInput').addEventListener('input', renderRisk);
el('leverageInput').addEventListener('input', renderRisk);
el('clearHistoryBtn').addEventListener('click', () => {
  localStorage.removeItem('btc-signal-ai-history-v12');
  renderHistory();
});

refresh();
setInterval(refresh, 120000);
