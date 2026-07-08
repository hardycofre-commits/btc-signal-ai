const BYBIT_URL = 'https://api.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT';
const FEAR_URL = 'https://api.alternative.me/fng/?limit=1&format=json';
const NEWS_URL = 'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=BTC';

const state = {
  price: null,
  change24: null,
  high24: null,
  low24: null,
  volume24: null,
  fear: null,
  fearLabel: null,
  news: [],
  newsScore: 0,
  score: 50,
  signal: 'ESPERAR'
};

const $ = (id) => document.getElementById(id);
const money = (n) => Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const num = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

async function fetchBybit(){
  const res = await fetch(BYBIT_URL);
  if(!res.ok) throw new Error('No se pudo conectar con Bybit');
  const data = await res.json();
  const t = data?.result?.list?.[0];
  if(!t) throw new Error('Respuesta Bybit inválida');
  state.price = Number(t.lastPrice);
  state.change24 = Number(t.price24hPcnt) * 100;
  state.high24 = Number(t.highPrice24h);
  state.low24 = Number(t.lowPrice24h);
  state.volume24 = Number(t.volume24h);
}

async function fetchFear(){
  const res = await fetch(FEAR_URL);
  if(!res.ok) throw new Error('No se pudo conectar con Fear & Greed');
  const data = await res.json();
  const item = data?.data?.[0];
  if(!item) throw new Error('Respuesta Fear & Greed inválida');
  state.fear = Number(item.value);
  state.fearLabel = item.value_classification;
}

function classifyNews(text){
  const t = (text || '').toLowerCase();
  const positive = ['rally','surge','soar','bull','bullish','gain','gains','rise','rises','upside','etf inflow','inflow','buy','accumulat','adoption','approval','record high','breakout'];
  const negative = ['crash','plunge','drop','drops','fall','falls','bear','bearish','selloff','outflow','hack','lawsuit','ban','risk','liquidation','recession','rate hike','probe'];
  let pos = positive.some(w => t.includes(w));
  let neg = negative.some(w => t.includes(w));
  if(pos && !neg) return { label: 'Alcista', points: 2, cls: 'positive' };
  if(neg && !pos) return { label: 'Bajista', points: -2, cls: 'negative' };
  return { label: 'Neutral', points: 0, cls: 'neutral' };
}

async function fetchNews(){
  $('newsStatus').textContent = 'Cargando noticias...';
  try{
    const res = await fetch(NEWS_URL);
    if(!res.ok) throw new Error('No se pudo conectar con CryptoCompare');
    const data = await res.json();
    const items = (data?.Data || []).slice(0, 8).map(n => {
      const c = classifyNews(`${n.title} ${n.body}`);
      return {
        title: n.title,
        url: n.url,
        source: n.source_info?.name || n.source || 'CryptoCompare',
        published: n.published_on ? new Date(n.published_on * 1000).toLocaleString('es-CL') : '',
        label: c.label,
        points: c.points,
        cls: c.cls
      };
    });
    state.news = items;
    state.newsScore = Math.max(-10, Math.min(10, items.reduce((sum, n) => sum + n.points, 0)));
    renderNews();
    $('newsStatus').textContent = `${items.length} noticias cargadas`;
  }catch(err){
    state.news = [];
    state.newsScore = 0;
    $('newsStatus').textContent = 'Noticias no disponibles';
    $('newsList').innerHTML = `<div class="news-item"><strong>No se pudieron cargar noticias</strong><small>${err.message}. Si GitHub Pages bloquea la consulta, lo dejaremos para backend seguro.</small></div>`;
  }
}

function scoreEngine(){
  const rows = [];
  let score = 50;

  let priceScore = 0;
  if(state.change24 > 2) priceScore = 14;
  else if(state.change24 > 0.5) priceScore = 8;
  else if(state.change24 < -2) priceScore = -14;
  else if(state.change24 < -0.5) priceScore = -8;
  rows.push(['Bybit variación 24h', `${state.change24?.toFixed(2)}%`, priceScore]);
  score += priceScore;

  let fearScore = 0;
  if(state.fear >= 75) fearScore = -8;
  else if(state.fear >= 55) fearScore = 7;
  else if(state.fear <= 25) fearScore = 8;
  else if(state.fear <= 45) fearScore = -4;
  rows.push(['Fear & Greed', `${state.fear} · ${state.fearLabel}`, fearScore]);
  score += fearScore;

  const range = state.high24 - state.low24;
  const position = range > 0 ? (state.price - state.low24) / range : 0.5;
  let rangeScore = 0;
  if(position > 0.7) rangeScore = 8;
  else if(position < 0.3) rangeScore = -8;
  rows.push(['Posición en rango 24h', `${Math.round(position * 100)}% del rango`, rangeScore]);
  score += rangeScore;

  let volumeScore = 0;
  if(state.volume24 > 10000 && Math.abs(state.change24) > 1) volumeScore = state.change24 > 0 ? 6 : -6;
  rows.push(['Volumen 24h', `${num(state.volume24)} BTC`, volumeScore]);
  score += volumeScore;

  rows.push(['Noticias BTC', `${state.news.length} noticias analizadas`, state.newsScore]);
  score += state.newsScore;

  score = Math.max(0, Math.min(100, Math.round(score)));
  state.score = score;

  if(score >= 75){ state.signal = 'COMPRAR'; }
  else if(score <= 35){ state.signal = 'VENDER'; }
  else { state.signal = 'ESPERAR'; }

  return rows;
}

function render(rows){
  $('btcPrice').textContent = state.price ? money(state.price) : '--';
  $('priceChange').textContent = state.change24 !== null ? `${state.change24.toFixed(2)}% 24h` : '--';
  $('priceChange').className = `change ${state.change24 >= 0 ? 'positive' : 'negative'}`;
  $('high24').textContent = money(state.high24);
  $('low24').textContent = money(state.low24);
  $('volume24').textContent = `${num(state.volume24)} BTC`;
  $('fearValue').textContent = state.fear ?? '--';
  $('fearLabel').textContent = state.fearLabel ?? '--';
  $('fearText').textContent = state.fear ? `Lectura actual del sentimiento: ${state.fearLabel}.` : 'Sin datos.';
  $('scoreValue').textContent = state.score;
  $('confidenceText').textContent = `Confianza: ${state.score >= 80 ? 'Alta' : state.score >= 60 ? 'Media' : 'Baja'}`;

  const badge = $('signalBadge');
  badge.textContent = state.signal;
  badge.className = 'badge ' + (state.signal === 'COMPRAR' ? 'buy' : state.signal === 'VENDER' ? 'sell' : 'wait');
  $('mainSignal').textContent = state.signal === 'COMPRAR' ? '🟢 Comprar' : state.signal === 'VENDER' ? '🔴 Vender' : '🟡 Esperar';
  $('signalText').textContent = state.signal === 'ESPERAR' ? 'No hay ventaja clara. Mejor esperar confirmación.' : `Señal calculada por el motor de puntuación.`;

  $('entryPrice').textContent = money(state.price);
  $('stopLoss').textContent = money(state.price * 0.985);
  $('takeProfit').textContent = money(state.price * 1.03);

  $('decisionDetails').innerHTML = rows.map(([name, detail, pts]) => `
    <div class="decision-row">
      <div><strong>${name}</strong><br><span>${detail}</span></div>
      <strong class="${pts >= 0 ? 'positive' : 'negative'}">${pts >= 0 ? '+' : ''}${pts}</strong>
    </div>`).join('');
}

function renderNews(){
  if(!state.news.length){
    $('newsList').innerHTML = `<div class="news-item"><strong>Sin noticias cargadas</strong><small>Presiona actualizar noticias.</small></div>`;
    return;
  }
  $('newsList').innerHTML = state.news.map(n => `
    <div class="news-item">
      <div class="news-top"><span class="news-tag ${n.cls}">${n.label}</span><small>${n.source} · ${n.published}</small></div>
      <a href="${n.url}" target="_blank" rel="noopener">${n.title}</a>
    </div>`).join('');
}

async function updateAll(){
  $('signalText').textContent = 'Actualizando datos reales...';
  try{
    await Promise.all([fetchBybit(), fetchFear(), fetchNews()]);
    const rows = scoreEngine();
    render(rows);
  }catch(err){
    $('signalText').textContent = 'Error al cargar datos: ' + err.message;
    console.error(err);
  }
}

function loadTradingView(){
  if(!window.TradingView) return;
  new TradingView.widget({
    autosize: true,
    symbol: 'BYBIT:BTCUSDT',
    interval: '60',
    timezone: 'America/Santiago',
    theme: 'dark',
    style: '1',
    locale: 'es',
    toolbar_bg: '#0e1b2e',
    enable_publishing: false,
    hide_side_toolbar: false,
    allow_symbol_change: true,
    container_id: 'tradingview_chart'
  });
}

function saveSignal(){
  const history = JSON.parse(localStorage.getItem('btc_signal_history') || '[]');
  history.unshift({ date: new Date().toLocaleString('es-CL'), signal: state.signal, price: state.price, score: state.score });
  localStorage.setItem('btc_signal_history', JSON.stringify(history.slice(0, 30)));
  renderHistory();
}
function renderHistory(){
  const history = JSON.parse(localStorage.getItem('btc_signal_history') || '[]');
  $('historyBody').innerHTML = history.map(h => `<tr><td>${h.date}</td><td>${h.signal}</td><td>${money(h.price)}</td><td>${h.score}</td></tr>`).join('') || `<tr><td colspan="4">Sin señales guardadas.</td></tr>`;
}

$('refreshBtn').addEventListener('click', updateAll);
$('refreshNewsBtn').addEventListener('click', async () => { await fetchNews(); const rows = scoreEngine(); render(rows); });
$('saveSignalBtn').addEventListener('click', saveSignal);
$('clearHistoryBtn').addEventListener('click', () => { localStorage.removeItem('btc_signal_history'); renderHistory(); });

loadTradingView();
renderHistory();
updateAll();
setInterval(updateAll, 60000);
