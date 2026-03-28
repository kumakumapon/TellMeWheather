// Weather component: API calls and weather data display

// WorldWeatherOnline (WWO) codes used by wttr.in
const WWO_CODES = {
  113: { label: '快晴',               emoji: '☀️' },
  116: { label: 'ほぼ晴れ',           emoji: '🌤️' },
  119: { label: '一部曇り',           emoji: '⛅' },
  122: { label: '曇り',               emoji: '☁️' },
  143: { label: '霧',                 emoji: '🌫️' },
  176: { label: 'にわか雨',           emoji: '🌦️' },
  179: { label: 'にわか雪',           emoji: '🌨️' },
  182: { label: '霙',                 emoji: '🌧️' },
  185: { label: '氷雨',               emoji: '🌧️' },
  200: { label: '雷雨',               emoji: '⛈️' },
  227: { label: '吹雪',               emoji: '❄️' },
  230: { label: '猛吹雪',             emoji: '❄️' },
  248: { label: '霧',                 emoji: '🌫️' },
  260: { label: '霧（着氷）',         emoji: '🌫️' },
  263: { label: '霧雨（弱）',         emoji: '🌦️' },
  266: { label: '霧雨',               emoji: '🌦️' },
  281: { label: '氷雨',               emoji: '🌧️' },
  284: { label: '氷雨（強）',         emoji: '🌧️' },
  293: { label: '雨（弱）',           emoji: '🌧️' },
  296: { label: '雨（弱）',           emoji: '🌧️' },
  299: { label: '雨',                 emoji: '🌧️' },
  302: { label: '雨',                 emoji: '🌧️' },
  305: { label: '雨（強）',           emoji: '🌧️' },
  308: { label: '雨（強）',           emoji: '🌧️' },
  311: { label: '霙（弱）',           emoji: '🌧️' },
  314: { label: '霙',                 emoji: '🌧️' },
  317: { label: '霙（弱）',           emoji: '🌧️' },
  320: { label: '霙',                 emoji: '🌧️' },
  323: { label: '雪（弱）',           emoji: '🌨️' },
  326: { label: '雪（弱）',           emoji: '🌨️' },
  329: { label: '雪',                 emoji: '❄️' },
  332: { label: '雪',                 emoji: '❄️' },
  335: { label: '雪（強）',           emoji: '❄️' },
  338: { label: '大雪',               emoji: '❄️' },
  350: { label: 'ひょう',             emoji: '🌨️' },
  353: { label: 'にわか雨（弱）',     emoji: '🌦️' },
  356: { label: 'にわか雨（強）',     emoji: '🌧️' },
  359: { label: 'にわか雨（豪雨）',   emoji: '⛈️' },
  362: { label: 'にわか霙（弱）',     emoji: '🌧️' },
  365: { label: 'にわか霙',           emoji: '🌧️' },
  368: { label: 'にわか雪（弱）',     emoji: '🌨️' },
  371: { label: 'にわか雪（強）',     emoji: '❄️' },
  374: { label: 'にわかひょう（弱）', emoji: '🌨️' },
  377: { label: 'にわかひょう',       emoji: '🌨️' },
  386: { label: '雷雨',               emoji: '⛈️' },
  389: { label: '雷雨（強）',         emoji: '⛈️' },
  392: { label: '雷雪',               emoji: '⛈️' },
  395: { label: '雷雪（強）',         emoji: '⛈️' },
};

function getWeatherInfo(code) {
  return WWO_CODES[code] || { label: '不明', emoji: '❓' };
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

async function fetchWeather(lat, lon) {
  const url = `https://wttr.in/${lat},${lon}?format=j1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('天気データ取得失敗');
  const raw = await res.json();
  return normalizeWttrData(raw);
}

function normalizeWttrData(raw) {
  const daily = {
    time: [],
    weather_code: [],
    temperature_2m_max: [],
    temperature_2m_min: [],
    precipitation_sum: [],
    precipitation_probability_max: [],
    wind_speed_10m_max: [],
  };

  for (const day of raw.weather) {
    daily.time.push(day.date);
    daily.temperature_2m_max.push(parseFloat(day.maxtempC));
    daily.temperature_2m_min.push(parseFloat(day.mintempC));

    // wttr.in provides 8 hourly slots per day at 0000, 0300, 0600, 0900, 1200, 1500, 1800, 2100
    // Use the 1200 slot (index 4) as the representative daytime weather code
    const midday = day.hourly[4] || day.hourly[0];
    daily.weather_code.push(parseInt(midday.weatherCode, 10));

    // Sum hourly precipitation for daily total
    const precipSum = day.hourly.reduce((sum, h) => sum + parseFloat(h.precipMM || 0), 0);
    daily.precipitation_sum.push(Math.round(precipSum * 10) / 10);

    // Max chance of rain across all hourly slots
    const maxProb = Math.max(...day.hourly.map(h => parseInt(h.chanceofrain || 0, 10)));
    daily.precipitation_probability_max.push(maxProb);

    // Max wind speed (already in km/h)
    const maxWind = Math.max(...day.hourly.map(h => parseInt(h.windspeedKmph || 0, 10)));
    daily.wind_speed_10m_max.push(maxWind);
  }

  return { daily };
}

function renderWeatherCard(data, cityName) {
  const daily = data.daily;
  const DAYS = ['日','月','火','水','木','金','土'];

  function buildDayBlock(idx, headerLabel) {
    const code = daily.weather_code[idx];
    const info = getWeatherInfo(code);
    const maxTemp = Math.round(daily.temperature_2m_max[idx]);
    const minTemp = Math.round(daily.temperature_2m_min[idx]);
    const precipProb = daily.precipitation_probability_max[idx] ?? 0;
    const wind = Math.round(daily.wind_speed_10m_max[idx] ?? 0);
    const date = new Date(daily.time[idx]);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}(${DAYS[date.getDay()]})`;
    return `
      <div class="day-col">
        <div class="day-col-header">${headerLabel} <span class="day-col-date">${dateStr}</span></div>
        <div class="day-col-main">
          <span class="weather-emoji">${info.emoji}</span>
          <span class="weather-label">${info.label}</span>
        </div>
        <div class="weather-temp">
          <span class="temp-max">↑${maxTemp}℃</span>
          <span class="temp-min">↓${minTemp}℃</span>
        </div>
        <div class="weather-precip">☔ ${precipProb}%</div>
        <div class="weather-wind">💨 ${wind}km/h</div>
      </div>
    `;
  }

  // index 0 = today, index 1 = tomorrow
  return {
    html: `
      <div class="weather-card card">
        <div class="card-title">🌤 今日・明日の天気 <span class="city-name">${cityName}</span></div>
        <div class="today-tomorrow-grid">
          ${buildDayBlock(0, '今日')}
          ${buildDayBlock(1, '明日')}
        </div>
      </div>
    `,
  };
}

function renderWeekForecast(data) {
  const daily = data.daily;
  const DAYS = ['日','月','火','水','木','金','土'];
  let cols = '';
  // Show from tomorrow onward for all available days
  for (let i = 1; i < daily.time.length; i++) {
    const date = new Date(daily.time[i]);
    const dayLabel = DAYS[date.getDay()];
    const dateLabel = `${date.getMonth()+1}/${date.getDate()}`;
    const info = getWeatherInfo(daily.weather_code[i]);
    const maxT = Math.round(daily.temperature_2m_max[i]);
    const minT = Math.round(daily.temperature_2m_min[i]);
    const prob = daily.precipitation_probability_max[i] ?? 0;
    const laundryOk = prob < 50;
    cols += `
      <div class="week-col">
        <div class="week-col-date">${dateLabel}</div>
        <div class="week-col-day">${dayLabel}</div>
        <div class="week-col-emoji">${info.emoji}</div>
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
