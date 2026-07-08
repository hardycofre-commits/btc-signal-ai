const BYBIT_URL = 'https://api.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT';

const state = {
  price: null,
  change24: null,
  high24: null,
  low24: null,
  volume24: null,
  turnover24: null,
  bid1: null,
  ask1: null,
  sources: {
    bybit: false,
    tradingview: false
  },
  lastCheck: null
};

const $ = (id) => document.getElementById(id);
const money = (n, digits = 2) => Number(n || 0).toLocaleString('en-US', { style:'currency', currency:'USD', minimumFractionDigits:digits, maximumFractionDigits:digits });
const number = (n, digits = 2) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits:digits });

function setSource(id, status, message, detail){
  const el = $(id);
  if(!el) return;
  el.classList.remove('ok','fail','waiting');
  el.classList.add(status);
  const em = el.querySelector('em');
  const span = el.querySelector('span');
  if(em) em.textContent = message;
  if(span && detail) span.textContent = detail;
}

function updateConnectionDot(){
  const total = 2;
  const active = [state.sources.bybit, state.sources.tradingview].filter(Boolean).length;
  const dot = $('connectionDot');
  dot.className = 'connection-dot ' + (active === total ? 'ok' : active > 0 ? 'waiting' : 'fail');
  dot.textContent = `${active}/${total} fuentes activas`;
}

async function fetchBybit(){
  setSource('srcBybit','waiting','⏳ Conectando...','Consultando API pública Bybit');
  const response = await fetch(BYBIT_URL, { cache:'no-store' });
  if(!response.ok) throw new Error('Bybit no respondió correctamente');
  const data = await response.json();
  const ticker = data?.result?.list?.[0];
  if(!ticker) throw new Error('Respuesta inválida desde Bybit');

  state.price = Number(ticker.lastPrice);
  state.change24 = Number(ticker.price24hPcnt) * 100;
  state.high24 = Number(ticker.highPrice24h);
  state.low24 = Number(ticker.lowPrice24h);
  state.volume24 = Number(ticker.volume24h);
  state.turnover24 = Number(ticker.turnover24h);
  state.bid1 = Number(ticker.bid1Price);
  state.ask1 = Number(ticker.ask1Price);
  state.sources.bybit = true;
  setSource('srcBybit','ok','✅ Conectado','Precio, volumen y rango 24h OK');
}

function initTradingView(){
  setSource('srcTrading','waiting','⏳ Cargando...','Widget TradingView');
  try{
    if(typeof TradingView === 'undefined') throw new Error('Librería TradingView no disponible');
    new TradingView.widget({
      autosize: true,
      symbol: 'BYBIT:BTCUSDT',
      interval: '60',
      timezone: 'America/Santiago',
      theme: 'dark',
      style: '1',
      locale: 'es',
      enable_publishing: false,
      allow_symbol_change: false,
      container_id: 'tradingview_chart',
      studies: ['Volume@tv-basicstudies']
    });
    state.sources.tradingview = true;
    setSource('srcTrading','ok','✅ Cargado','Gráfico disponible');
  }catch(error){
    state.sources.tradingview = false;
    setSource('srcTrading','fail','❌ Error','No se pudo cargar gráfico');
  }
}

function buildMarketReading(){
  if(!state.sources.bybit) return 'No hay datos suficientes para leer el mercado.';
  const range = state.high24 - state.low24;
  const position = range > 0 ? ((state.price - state.low24) / range) * 100 : 50;
  let trend = 'neutral';
  if(state.change24 > 1) trend = 'positiva';
  if(state.change24 < -1) trend = 'negativa';

  let zone = 'zona media del rango diario';
  if(position >= 70) zone = 'parte alta del rango diario';
  if(position <= 30) zone = 'parte baja del rango diario';

  return `Tendencia 24h ${trend}. El precio está en la ${zone} (${Math.round(position)}%). Esta lectura aún no es señal de trading; será entrada para el módulo técnico.`;
}

function renderSummary(){
  const spreadAbs = state.ask1 && state.bid1 ? state.ask1 - state.bid1 : null;
  const spreadPct = spreadAbs && state.price ? (spreadAbs / state.price) * 100 : null;
  const range = state.high24 && state.low24 ? state.high24 - state.low24 : null;
  const rows = [
    ['Fuente principal', state.sources.bybit ? 'Bybit Spot BTCUSDT conectado' : 'Bybit sin conexión', state.sources.bybit ? 'OK' : 'ERROR'],
    ['Rango 24h', range ? `${money(range)} entre máximo y mínimo` : 'Sin datos', range ? 'OK' : 'PENDIENTE'],
    ['Spread', spreadPct !== null ? `${money(spreadAbs)} (${spreadPct.toFixed(4)}%)` : 'Sin datos', spreadPct !== null ? 'OK' : 'PENDIENTE'],
    ['Volumen', state.volume24 ? `${number(state.volume24)} BTC negociados` : 'Sin datos', state.volume24 ? 'OK' : 'PENDIENTE'],
    ['Estado del módulo', state.sources.bybit && state.sources.tradingview ? 'Módulo 1 operativo' : 'Faltan conexiones', state.sources.bybit && state.sources.tradingview ? 'LISTO' : 'REVISAR']
  ];

  $('dataSummary').innerHTML = rows.map(([name, detail, status]) => {
    const cls = status === 'OK' || status === 'LISTO' ? 'positive' : status === 'ERROR' || status === 'REVISAR' ? 'negative' : 'neutral';
    return `<div class="decision-row"><div><strong>${name}</strong><br><span>${detail}</span></div><strong class="${cls}">${status}</strong></div>`;
  }).join('');
}

function render(){
  const spreadAbs = state.ask1 && state.bid1 ? state.ask1 - state.bid1 : null;
  const spreadPct = spreadAbs && state.price ? (spreadAbs / state.price) * 100 : null;

  $('btcPrice').textContent = state.price ? money(state.price) : '--';
  $('lastPrice').textContent = state.price ? money(state.price) : '--';
  $('priceChange').textContent = state.change24 !== null ? `${state.change24.toFixed(2)}% 24h` : '--';
  $('priceChange').className = `change ${state.change24 >= 0 ? 'positive' : 'negative'}`;
  $('change24').textContent = state.change24 !== null ? `${state.change24.toFixed(2)}%` : '--';
  $('change24').className = state.change24 >= 0 ? 'positive' : 'negative';
  $('changeLabel').textContent = state.change24 > 0 ? 'Sesgo diario positivo' : state.change24 < 0 ? 'Sesgo diario negativo' : 'Sin variación';
  $('high24').textContent = state.high24 ? money(state.high24) : '--';
  $('low24').textContent = state.low24 ? money(state.low24) : '--';
  $('volume24').textContent = state.volume24 ? `${number(state.volume24)} BTC` : '--';
  $('turnover24').textContent = state.turnover24 ? money(state.turnover24, 0) : '--';
  $('bidPrice').textContent = state.bid1 ? money(state.bid1) : '--';
  $('askPrice').textContent = state.ask1 ? money(state.ask1) : '--';
  $('bidAskDiff').textContent = spreadAbs !== null ? money(spreadAbs, 2) : '--';
  $('spread').textContent = spreadPct !== null ? `${spreadPct.toFixed(4)}%` : '--';
  $('marketReading').textContent = buildMarketReading();

  state.lastCheck = new Date();
  $('lastCheck').textContent = state.lastCheck.toLocaleString('es-CL');
  renderSummary();
  updateConnectionDot();
}

async function refreshAll(){
  try{
    await fetchBybit();
  }catch(error){
    state.sources.bybit = false;
    setSource('srcBybit','fail','❌ Error', error.message || 'No se pudo conectar');
  }
  render();
}

document.addEventListener('DOMContentLoaded', () => {
  $('refreshBtn').addEventListener('click', refreshAll);
  initTradingView();
  refreshAll();
  setInterval(refreshAll, 30000);
});
