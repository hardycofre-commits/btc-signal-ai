const API_PRICE = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true';
const API_FEAR = 'https://api.alternative.me/fng/?limit=1';

const $ = (id) => document.getElementById(id);

let currentPrice = 0;
let currentChange = 0;
let currentFear = 50;
let currentFearText = 'Neutral';

function formatUsd(value) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatDate() {
  return new Date().toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}

async function fetchPrice() {
  const res = await fetch(API_PRICE);
  if (!res.ok) throw new Error('No se pudo obtener precio BTC');
  const data = await res.json();
  currentPrice = data.bitcoin.usd;
  currentChange = data.bitcoin.usd_24h_change || 0;
}

async function fetchFearGreed() {
  const res = await fetch(API_FEAR);
  if (!res.ok) throw new Error('No se pudo obtener Fear & Greed');
  const data = await res.json();
  currentFear = Number(data.data[0].value);
  currentFearText = data.data[0].value_classification;
}

function calculateSignal() {
  let score = 50;

  if (currentChange > 3) score += 18;
  else if (currentChange > 1) score += 10;
  else if (currentChange < -3) score -= 18;
  else if (currentChange < -1) score -= 10;

  if (currentFear >= 75) score -= 8;       // codicia extrema: posible sobrecalentamiento
  else if (currentFear >= 55) score += 8;
  else if (currentFear <= 25) score += 6;  // miedo extremo: posible oportunidad, pero con riesgo
  else if (currentFear <= 45) score -= 4;

  score = Math.max(0, Math.min(100, Math.round(score)));

  let signal = 'ESPERAR';
  let className = 'signal-wait';
  let risk = 'Medio';
  let message = 'No hay ventaja clara. Mejor esperar confirmación.';

  if (score >= 70) {
    signal = 'COMPRAR';
    className = 'signal-buy';
    risk = 'Medio';
    message = 'Sesgo alcista según precio y sentimiento.';
  } else if (score <= 35) {
    signal = 'VENDER';
    className = 'signal-sell';
    risk = 'Alto';
    message = 'Sesgo bajista. Evitar compras impulsivas.';
  }

  return { score, signal, className, risk, message };
}

function updateRiskPlan(signal) {
  const capital = Number($('capitalInput').value || 0);
  const riskPct = Number($('riskInput').value || 0);
  const maxLoss = capital * (riskPct / 100);

  $('maxLoss').textContent = formatUsd(maxLoss);

  if (!currentPrice) return;

  const entry = currentPrice;
  const stop = signal === 'VENDER' ? entry * 1.015 : entry * 0.985;
  const tp = signal === 'VENDER' ? entry * 0.970 : entry * 1.030;

  $('entryPrice').textContent = formatUsd(entry);
  $('stopLoss').textContent = formatUsd(stop);
  $('takeProfit').textContent = formatUsd(tp);
}

function paintScore(score) {
  const degrees = Math.round((score / 100) * 360);
  const circle = document.querySelector('.score-circle');
  let color = 'var(--yellow)';
  if (score >= 70) color = 'var(--green)';
  if (score <= 35) color = 'var(--red)';
  circle.style.background = `conic-gradient(${color} ${degrees}deg, var(--card-2) 0deg)`;
}

function saveHistory(signal, score) {
  if (!currentPrice) return;
  const history = JSON.parse(localStorage.getItem('btcSignalHistory') || '[]');
  history.unshift({ date: formatDate(), price: currentPrice, signal, score });
  localStorage.setItem('btcSignalHistory', JSON.stringify(history.slice(0, 20)));
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem('btcSignalHistory') || '[]');
  $('historyBody').innerHTML = history.map(item => `
    <tr>
      <td>${item.date}</td>
      <td>${formatUsd(item.price)}</td>
      <td>${item.signal}</td>
      <td>${item.score}/100</td>
    </tr>
  `).join('');
}

function render() {
  const result = calculateSignal();

  $('btcPrice').textContent = formatUsd(currentPrice);
  $('priceChange').textContent = `Variación 24h: ${currentChange.toFixed(2)}%`;
  $('fearValue').textContent = `${currentFear}/100`;
  $('fearText').textContent = `Sentimiento: ${currentFearText}`;
  $('signalText').textContent = result.signal;
  $('confidenceText').textContent = `Confianza: ${result.score}%`;
  $('scoreValue').textContent = result.score;
  $('scoreMessage').textContent = result.message;
  $('riskLevel').textContent = result.risk;

  $('factorTrend').textContent = currentChange >= 0 ? 'Positiva' : 'Negativa';
  $('factorFear').textContent = currentFearText;
  $('factorRisk').textContent = result.risk;
  $('factorSignal').textContent = result.signal;

  const signalBox = $('signalBox');
  signalBox.className = `signal-box ${result.className}`;

  paintScore(result.score);
  updateRiskPlan(result.signal);
  saveHistory(result.signal, result.score);
  renderHistory();
  $('lastUpdate').textContent = formatDate();
}

async function updateDashboard() {
  $('refreshBtn').disabled = true;
  $('refreshBtn').textContent = 'Actualizando...';

  try {
    await Promise.all([fetchPrice(), fetchFearGreed()]);
    render();
  } catch (error) {
    console.error(error);
    $('scoreMessage').textContent = 'No se pudieron cargar los datos. Intenta nuevamente.';
  } finally {
    $('refreshBtn').disabled = false;
    $('refreshBtn').textContent = 'Actualizar';
  }
}

$('refreshBtn').addEventListener('click', updateDashboard);
$('clearHistoryBtn').addEventListener('click', () => {
  localStorage.removeItem('btcSignalHistory');
  renderHistory();
});
$('capitalInput').addEventListener('input', () => updateRiskPlan($('signalText').textContent));
$('riskInput').addEventListener('input', () => updateRiskPlan($('signalText').textContent));

renderHistory();
updateDashboard();
setInterval(updateDashboard, 5 * 60 * 1000);
