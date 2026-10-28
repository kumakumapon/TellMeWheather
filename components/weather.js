// Weather component: API calls and weather data display

// Open-Meteo returns date-only ISO strings (e.g. "2026-09-21"). `new Date(str)`
// parses that as UTC midnight, so getDay()/getMonth() (which read local time)
// can shift by a day outside UTC+ timezones. Build the Date from local
// components instead so day-of-week/date labels match the intended date.
function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// WMO weather codes used by Open-Meteo
const WMO_CODES = {
  0:  { label: '快晴',             emoji: '☀️' },
  1:  { label: 'ほぼ晴れ',         emoji: '🌤️' },
  2:  { label: '一部曇り',         emoji: '⛅' },
  3:  { label: '曇り',             emoji: '☁️' },
  45: { label: '霧',               emoji: '🌫️' },
  48: { label: '霧（着氷）',       emoji: '🌫️' },
  51: { label: '霧雨（弱）',       emoji: '🌦️' },
  53: { label: '霧雨',             emoji: '🌦️' },
  55: { label: '霧雨（強）',       emoji: '🌦️' },
  56: { label: '氷雨（弱）',       emoji: '🌧️' },
  57: { label: '氷雨',             emoji: '🌧️' },
  61: { label: '雨（弱）',         emoji: '🌧️' },
  63: { label: '雨',               emoji: '🌧️' },
  65: { label: '雨（強）',         emoji: '🌧️' },
  66: { label: '氷雨',             emoji: '🌧️' },
  67: { label: '氷雨（強）',       emoji: '🌧️' },
  71: { label: '雪（弱）',         emoji: '🌨️' },
  73: { label: '雪',               emoji: '🌨️' },
  75: { label: '雪（強）',         emoji: '❄️' },
  77: { label: '霰',               emoji: '🌨️' },
  80: { label: 'にわか雨（弱）',   emoji: '🌦️' },
  81: { label: 'にわか雨',         emoji: '🌧️' },
  82: { label: 'にわか雨（強）',   emoji: '⛈️' },
  85: { label: 'にわか雪（弱）',   emoji: '🌨️' },
  86: { label: 'にわか雪（強）',   emoji: '❄️' },
  95: { label: '雷雨',             emoji: '⛈️' },
  96: { label: '雷雨（雹）',       emoji: '⛈️' },
  99: { label: '雷雨（大雹）',     emoji: '⛈️' },
};

const WEATHER_IMAGE_PATHS = {
  sunny: 'assets/weather/sunny.png',
  cloudy: 'assets/weather/cloudy.png',
  rainy: 'assets/weather/rainy.png',
  snowy: 'assets/weather/snowy.png',
  storm: 'assets/weather/storm.png',
};

function getWeatherImage(code) {
  const codeNum = typeof code === 'string' ? parseInt(code, 10) : code;
  if ([0, 1].includes(codeNum)) return WEATHER_IMAGE_PATHS.sunny;
  if ([2, 3, 45, 48].includes(codeNum)) return WEATHER_IMAGE_PATHS.cloudy;
  if ([71, 73, 75, 77, 85, 86].includes(codeNum)) return WEATHER_IMAGE_PATHS.snowy;
  if ([95, 96, 99].includes(codeNum)) return WEATHER_IMAGE_PATHS.storm;
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(codeNum)) {
    return WEATHER_IMAGE_PATHS.rainy;
  }
  return null;
}

function renderWeatherVisual(code, info, sizeClass = '') {
  const imagePath = getWeatherImage(code);
  if (!imagePath) return `<span class="weather-emoji ${sizeClass}">${info.emoji}</span>`;

  return `
    <span class="weather-visual ${sizeClass}" aria-hidden="true">
      <img src="${imagePath}" alt="" width="256" height="256" loading="lazy" decoding="async"
        onerror="this.hidden=true;this.nextElementSibling.hidden=false">
      <span class="weather-emoji-fallback" hidden>${info.emoji}</span>
    </span>
  `;
}

function getWeatherInfo(code) {
  // Ensure code is a number (in case of string conversion from API or cache)
  const codeNum = typeof code === 'string' ? parseInt(code, 10) : code;
  
  if (WMO_CODES[codeNum]) {
    return WMO_CODES[codeNum];
  }
  
  // Fallback for unknown codes - log for debugging
  console.warn(`Unknown weather code: ${code} (type: ${typeof code})`);
  return { label: '不明', emoji: '❓' };
}

async function geocodeCity(cityName) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)}&format=json&limit=1&accept-language=ja`;
  // Note: browsers block setting User-Agent via fetch; the browser's own User-Agent is sent automatically.
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error('ジオコーディング失敗');
  const data = await res.json();
  if (!data || data.length === 0) throw new Error(`「${cityName}」が見つかりません`);
  const displayName = data[0].display_name.split(',')[0].trim();
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), name: displayName };
}

function getUvLevel(uv) {
  if (uv == null) return null;
  const val = Math.round(uv);
  if (uv <= 2) return { label: `UV ${val}（低い）`, cls: 'uv-low' };
  if (uv <= 5) return { label: `UV ${val}（やや高）`, cls: 'uv-moderate' };
  if (uv <= 7) return { label: `UV ${val}（高い）`, cls: 'uv-high' };
  if (uv <= 10) return { label: `UV ${val}（非常に高い）`, cls: 'uv-very-high' };
  return { label: `UV ${val}（危険）`, cls: 'uv-extreme' };
}

async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max&hourly=temperature_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m,relative_humidity_2m&timezone=auto&forecast_days=7`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('天気データ取得失敗');
  const raw = await res.json();

  return validateWeatherData({ daily: raw.daily, hourly: raw.hourly, timezone: raw.timezone });
}

function isFiniteNumber(value) {
  return value !== null && value !== '' && Number.isFinite(Number(value));
}

function hasFiniteNumberSeries(values, length) {
  return Array.isArray(values) && values.length >= length && values.slice(0, length).every(isFiniteNumber);
}

// Check the fields used by dashboard renderers before accepting API or cached data.
// Hourly data is optional: if its core fields are incomplete, daily views can
// still render and the app falls back to daily values for clothing/heat advice.
function validateWeatherData(data) {
  const daily = data && data.daily;
  const requiredDailySeries = [
    'weather_code',
    'temperature_2m_max',
    'temperature_2m_min',
    'precipitation_sum',
    'precipitation_probability_max',
    'wind_speed_10m_max',
  ];

  if (!daily || !Array.isArray(daily.time) || daily.time.length < 2 ||
      !daily.time.every(value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) ||
      !requiredDailySeries.every(key => hasFiniteNumberSeries(daily[key], daily.time.length))) {
    throw new Error('天気データの形式が不完全です');
  }

  const safeDaily = { ...daily };
  requiredDailySeries.forEach(key => { safeDaily[key] = daily[key].map(Number); });
  if (!hasFiniteNumberSeries(safeDaily.uv_index_max, daily.time.length)) {
    delete safeDaily.uv_index_max;
  }

  let safeHourly = data.hourly;
  if (!safeHourly || !Array.isArray(safeHourly.time) || safeHourly.time.length === 0 ||
      !safeHourly.time.every(value => typeof value === 'string') ||
      !hasFiniteNumberSeries(safeHourly.temperature_2m, safeHourly.time.length) ||
      !hasFiniteNumberSeries(safeHourly.weather_code, safeHourly.time.length) ||
      !Array.isArray(safeHourly.precipitation_probability) ||
      safeHourly.precipitation_probability.length < safeHourly.time.length) {
    safeHourly = null;
  } else {
    safeHourly = { ...safeHourly };
    safeHourly.temperature_2m = safeHourly.temperature_2m.map(Number);
    safeHourly.weather_code = safeHourly.weather_code.map(Number);
    safeHourly.precipitation_probability = safeHourly.precipitation_probability.map(value =>
      value != null && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100 ? Number(value) : null);
    if (!hasFiniteNumberSeries(safeHourly.relative_humidity_2m, safeHourly.time.length)) {
      delete safeHourly.relative_humidity_2m;
    }
  }

  return { daily: safeDaily, hourly: safeHourly, timezone: data.timezone };
}

// A cached forecast may have been fetched yesterday. Rebase its daily indices
// before any renderer interprets index 0/1 as today/tomorrow.
function alignWeatherToToday(data, now = Date.now()) {
  const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
  if (data.timezone) options.timeZone = data.timezone;
  const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(new Date(now));
  const value = type => parts.find(part => part.type === type).value;
  const today = `${value('year')}-${value('month')}-${value('day')}`;
  const start = data.daily.time.indexOf(today);
  if (start < 0 || start + 1 >= data.daily.time.length) throw new Error('保存済み予報に今日・明日のデータがありません');
  const daily = Object.fromEntries(Object.entries(data.daily).map(([key, values]) => [key, Array.isArray(values) ? values.slice(start) : values]));
  return { ...data, daily };
}

function renderWeatherCard(data, cityName, lastUpdated, isCached = false) {
  const daily = data.daily;
  const DAYS = ['日','月','火','水','木','金','土'];

  function buildDayBlock(idx, headerLabel) {
    const code = daily.weather_code[idx];
    const info = getWeatherInfo(code);
    const maxTemp = Math.round(daily.temperature_2m_max[idx]);
    const minTemp = Math.round(daily.temperature_2m_min[idx]);
    const precipProb = daily.precipitation_probability_max[idx] ?? 0;
    const wind = Math.round(daily.wind_speed_10m_max[idx] ?? 0);
    const date = parseLocalDate(daily.time[idx]);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}(${DAYS[date.getDay()]})`;
    const uvRaw = daily.uv_index_max ? daily.uv_index_max[idx] : null;
    const uvLevel = getUvLevel(uvRaw);
    const uvHtml = uvLevel
      ? `<div class="weather-uv ${uvLevel.cls}">${uvLevel.label}</div>`
      : '';
    return `
      <div class="day-col">
        <div class="day-col-header">${headerLabel} <span class="day-col-date">${dateStr}</span></div>
        <div class="day-col-main">
          ${renderWeatherVisual(code, info, 'weather-visual-main')}
          <span class="weather-label">${info.label}</span>
        </div>
        <div class="weather-temp">
          <span class="temp-max">↑${maxTemp}℃</span>
          <span class="temp-min">↓${minTemp}℃</span>
        </div>
        <div class="weather-precip">☔ ${precipProb}%</div>
        <div class="weather-wind">💨 ${wind}km/h</div>
        ${uvHtml}
      </div>
    `;
  }

  const updatedStr = lastUpdated
    ? `<span class="last-updated">🕐 ${isCached ? '前回取得' : '予報取得'}：${new Date(lastUpdated).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}${isCached ? '（キャッシュ）' : ''}</span>`
    : '';

  // index 0 = today, index 1 = tomorrow
  return {
    html: `
      <div class="weather-card card">
        <div class="card-title">
          🌤 今日・明日の天気 <span class="city-name">${escapeHtml(cityName)}</span>
          ${updatedStr}
          <button class="refresh-btn" data-action="refresh" title="天気を更新">🔄</button>
        </div>
        <div class="today-tomorrow-grid">
          ${buildDayBlock(0, '今日')}
          ${buildDayBlock(1, '明日')}
        </div>
      </div>
    `,
  };
}

function renderWeekForecast(data, settings) {
  const daily = data.daily;
  const DAYS = ['日','月','火','水','木','金','土'];
  let cols = '';
  // Show from tomorrow onward for all available days
  for (let i = 1; i < daily.time.length; i++) {
    const date = parseLocalDate(daily.time[i]);
    const dayLabel = DAYS[date.getDay()];
    const dateLabel = `${date.getMonth()+1}/${date.getDate()}`;
    const info = getWeatherInfo(daily.weather_code[i]);
    const maxT = Math.round(daily.temperature_2m_max[i]);
    const minT = Math.round(daily.temperature_2m_min[i]);
    const prob = daily.precipitation_probability_max[i] ?? 0;
    const precip = daily.precipitation_sum[i] ?? 0;
    const wind = daily.wind_speed_10m_max[i] ?? 0;
    const laundryOk = getLaundryAdvice(precip, prob, wind, settings, date.getMonth() + 1).status === 'ok';
    cols += `
      <div class="week-col">
        <div class="week-col-date">${dateLabel}</div>
        <div class="week-col-day">${dayLabel}</div>
        <div class="week-col-emoji">${renderWeatherVisual(daily.weather_code[i], info, 'weather-visual-week')}</div>
        <div class="week-col-temp"><span class="temp-max">↑${maxT}</span><span class="temp-min">↓${minT}</span></div>
        <div class="week-col-rain">☔${prob}%</div>
        <div class="week-col-laundry ${laundryOk ? 'ok' : 'ng'}">${laundryOk ? '◎' : '✕'}</div>
      </div>
    `;
  }
  return `
    <div class="week-card card">
      <div class="card-title">📅 週間見通し（明日〜）</div>
      <div class="week-cols">${cols}</div>
    </div>
  `;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getWeatherInfo, parseLocalDate, validateWeatherData, alignWeatherToToday };
}
