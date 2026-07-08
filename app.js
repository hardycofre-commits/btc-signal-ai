const API_PRICE = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true';
const API_FEAR = 'https://api.alternative.me/fng/?limit=1';

const $ = (id) => document.getElementById(id);

let currentPrice = 0;
let currentChange = 0;
let currentFear = 50;
let currentFearText = 'Neutral';
let lastSavedKey = '';

function formatUsd(value) {
  if (!Number.isFinite(value)) return '--';
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatDate() {
  return new Date().toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}

async function fetchPrice() {
  const res = await fetch(API_PRICE);
  if (!res.ok) throw new Error('No se pudo obtener precio BTC');
  const data = await res.json();
  currentPrice = Number(data.bitcoin.usd);
  currentChange = Number(data.bitcoin.usd_24h_change || 0);
}

async function fetchFearGreed() {
  const res = await fetch(API_FEAR);
  if (!res.ok) throw new Error('No se pudo obtener Fear & Greed');
  const data = await res.json();
  currentFear = Number(data.data[0].value);
  currentFearText = data.data[0].value_classification;
}

function scoreTrend(change) {
  if (change >= 5) return 22;
  if (change >= 3) return 16;
  if (change >= 1) return 9;
  if (change > -1) return 0;
  if (change > -3) return -9;
  if (change > -5) return -16;
  return -22;
}

function scoreFear(value) {
  // Miedo extremo puede ser oportunidad, pero no se compra solo por miedo.
  if (value <= 20) return 6;
  if (value <= 35) return 2;
  if (value <= 55) return 0;
  if (value <= 74) return 8;
  return -7;
}

function calculateSignal() {
  const trendPoints = scoreTrend(currentChange);
  const fearPoints = scoreFear(currentFear);
  const riskPct = Number($('riskInput').value || 1);
  const leverage = Number($('leverageInput').value || 1);
  const riskPenalty = riskPct > 2 || leverage > 5 ? -8 : riskPct > 1.5 || leverage > 3 ? -4 : 0;

  let score = 50 + trendPoints + fearPoints + riskPenalty;
  score = Math.max(0, Math.min(100, Math.round(score)));

  let signal = 'ESPERAR';
  let className = 'signal-wait';
  let risk = 'Medio';
  let message = 'No hay ventaja clara. Mejor esperar confirmación.';

  if (score >= 78) {
    signal = 'COMPRAR';
    className = 'signal-buy';
    risk = 'Medio';
    message = 'Sesgo alcista fuerte por tendencia y sentimiento.';
  } else if (score >= 62) {
    signal = 'ESPERAR';
    className = 'signal-wait';
    risk = 'Medio';
    message = 'Sesgo alcista moderado, pero falta confirmación.';
  } else if (score <= 32) {
    signal = 'VENDER';
    className = 'signal-sell';
    risk = 'Alto';
    message = 'Sesgo bajista fuerte. Cuidado con compras impulsivas.';
  } else if (score <= 45) {
    signal = 'PRECAUCIÓN';
    className = 'signal-precaution';
    risk = 'Alto';
    message = 'Mercado débil. Mejor reducir riesgo y esperar.';
  }

  return { score, signal, className, risk, message, trendPoints, fearPoints, riskPenalty };
}

function updateRiskPlan(signal) {
  const capital = Number($('capitalInput').value || 0);
  const riskPct = Number($('riskInput').value || 0);
  const leverage = Number($('leverageInput').value || 1);
  const maxLoss = capital * (riskPct / 100);

  $('maxLoss').textContent = formatUsd(maxLoss);
  if (!currentPrice) return;

  const entry = currentPrice;
  const stopDistance = signal === 'PRECAUCIÓN' ? 0.012 : 0.015;
  const takeDistance = signal === 'VENDER' ? 0.03 : 0.03;
  const stop = signal === 'VENDER' ? entry * (1 + stopDistance) : entry * (1 - stopDistance);
  const tp = signal === 'VENDER' ? entry * (1 - takeDistance) : entry * (1 + takeDistance);
  const positionSize = capital * leverage;

  $('entryPrice').textContent = formatUsd(entry);
  $('stopLoss').textContent = formatUsd(stop);
  $('takeProfit').textContent = formatUsd(tp);
  $('positionSize').textContent = formatUsd(positionSize);
}

function paintScore(score) {
  const degrees = Math.round((score / 100) * 360);
  const circle = document.querySelector('.score-circle');
  let color = 'var(--yellow)';
  if (score >= 78) color = 'var(--green)';
  if (score <= 45) color = 'var(--orange)';
  if (score <= 32) color = 'var(--red)';
  circle.style.background = `conic-gradient(${color} ${degrees}deg, var(--card-2) 0deg)`;
}

function saveHistory(signal, score) {
  if (!currentPrice) return;
  const key = `${Math.round(currentPrice)}-${signal}-${score}`;
  if (key === lastSavedKey) return;
  lastSavedKey = key;
  const history = JSON.parse(localStorage.getItem('btcSignalHistory') || '[]');
  history.unshift({ date: formatDate(), price: currentPrice, signal, score });
  localStorage.setItem('btcSignalHistory', JSON.stringify(history.slice(0, 30)));
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem('btcSignalHistory') || '[]');
  $('historyBody').innerHTML = history.length ? history.map(item => `
    <tr>
      <td>${item.date}</td>
      <td>${formatUsd(item.price)}</td>
      <td>${item.signal}</td>
      <td>${item.score}/100</td>
    </tr>
  `).join('') : '<tr><td colspan="4">Sin señales guardadas todavía.</td></tr>';
}

function renderAnalysis(result) {
  const trendText = currentChange >= 1 ? 'positiva' : currentChange <= -1 ? 'negativa' : 'neutral';
  const fearText = currentFear <= 25 ? 'miedo extremo' : currentFear >= 75 ? 'codicia extrema' : currentFearText;
  $('analysisBox').innerHTML = `
    <strong>Lectura rápida:</strong> tendencia 24h ${trendText} (${currentChange.toFixed(2)}%), sentimiento ${fearText} (${currentFear}/100).<br>
    <strong>Puntaje:</strong> base 50 + tendencia ${result.trendPoints} + sentimiento ${result.fearPoints} + riesgo ${result.riskPenalty} = <strong>${result.score}/100</strong>.<br>
    <strong>Conclusión:</strong> ${result.message}
  `;
}

function render() {
  const result = calculateSignal();

  $('btcPrice').textContent = formatUsd(currentPrice);
  $('priceChange').textContent = `Variación 24h: ${currentChange.toFixed(2)}%`;
  $('fearValue').textContent = `${currentFear}/100`;
  $('fearText').textContent = `Sentimiento: ${currentFearText}`;
  $('signalText').textContent = result.signal;
  $('confidenceText').textContent = `Confianza: ${result.score}%`;
  $('signalReason').textContent = result.message;
  $('scoreValue').textContent = result.score;
  $('scoreMessage').textContent = result.message;
  $('riskLevel').textContent = result.risk;

  $('factorTrend').textContent = currentChange >= 1 ? 'Positiva' : currentChange <= -1 ? 'Negativa' : 'Neutral';
  $('factorFear').textContent = currentFearText;
  $('factorRisk').textContent = result.risk;
  $('factorSignal').textContent = result.signal;
  $('trendScore').textContent = `${result.trendPoints >= 0 ? '+' : ''}${result.trendPoints} pts`;
  $('fearScore').textContent = `${result.fearPoints >= 0 ? '+' : ''}${result.fearPoints} pts`;
  $('riskScore').textContent = `${result.riskPenalty} pts`;
  $('finalScore').textContent = `${result.score}/100`;

  const signalBox = $('signalBox');
  signalBox.className = `signal-box ${result.className}`;

  paintScore(result.score);
  updateRiskPlan(result.signal);
  renderAnalysis(result);
  saveHistory(result.signal, result.score);
  renderHistory();
  $('lastUpdate').textContent = `Última actualización: ${formatDate()}`;
}

async function updateDashboard() {
  $('refreshBtn').disabled = true;
  $('refreshBtn').textContent = 'Actualizando...';

  try {
    await Promise.all([fetchPrice(), fetchFearGreed()]);
    render();
  } catch (error) {
    console.error(error);
    $('scoreMessage').textContent = 'No se pudieron cargar todos los datos. Revisa conexión o intenta nuevamente.';
    $('analysisBox').textContent = 'Error al cargar datos externos. El gráfico puede seguir funcionando si TradingView está disponible.';
  } finally {
    $('refreshBtn').disabled = false;
    $('refreshBtn').textContent = 'Actualizar datos';
  }
}

function loadTradingView() {
  if (!window.TradingView) return;
  new TradingView.widget({
    autosize: true,
    symbol: 'BINANCE:BTCUSDT',
    interval: '60',
    timezone: 'America/Santiago',
    theme: 'dark',
    style: '1',
    locale: 'es',
    toolbar_bg: '#091525',
    enable_publishing: false,
    hide_top_toolbar: false,
    hide_legend: false,
    save_image: false,
    container_id: 'tradingview_chart'
  });
}

$('refreshBtn').addEventListener('click', updateDashboard);
$('clearHistoryBtn').addEventListener('click', () => {
  localStorage.removeItem('btcSignalHistory');
  renderHistory();
});
['capitalInput', 'riskInput', 'leverageInput'].forEach(id => {
  $(id).addEventListener('input', () => {
    const result = calculateSignal();
    updateRiskPlan(result.signal);
    renderAnalysis(result);
  });
});

renderHistory();
loadTradingView();
updateDashboard();
setInterval(updateDashboard, 5 * 60 * 1000);
