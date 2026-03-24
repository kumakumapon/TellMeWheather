// Weather component: API calls and weather data display

const WMO_CODES = {
  0:  { label: '快晴',         emoji: '☀️' },
  1:  { label: 'ほぼ晴れ',     emoji: '🌤️' },
  2:  { label: '一部曇り',     emoji: '⛅' },
  3:  { label: '曇り',         emoji: '☁️' },
  45: { label: '霧',           emoji: '🌫️' },
  48: { label: '霧（着氷）',   emoji: '🌫️' },
  51: { label: '霧雨（弱）',   emoji: '🌦️' },
  53: { label: '霧雨',         emoji: '🌦️' },
  55: { label: '霧雨（強）',   emoji: '🌧️' },
  61: { label: '雨（弱）',     emoji: '🌧️' },
  63: { label: '雨',           emoji: '🌧️' },
  65: { label: '雨（強）',     emoji: '🌧️' },
  71: { label: '雪（弱）',     emoji: '🌨️' },
  73: { label: '雪',           emoji: '❄️' },
  75: { label: '雪（強）',     emoji: '❄️' },
  77: { label: '雪粒',         emoji: '🌨️' },
  80: { label: 'にわか雨（弱）', emoji: '🌦️' },
  81: { label: 'にわか雨',     emoji: '🌧️' },
  82: { label: 'にわか雨（強）', emoji: '⛈️' },
  85: { label: 'にわか雪（弱）', emoji: '🌨️' },
  86: { label: 'にわか雪（強）', emoji: '❄️' },
  95: { label: '雷雨',         emoji: '⛈️' },
  96: { label: 'ひょうを伴う雷雨', emoji: '⛈️' },
  99: { label: 'ひょうを伴う雷雨（強）', emoji: '⛈️' },
};

function getWeatherInfo(code) {
  return WMO_CODES[code] || { label: '不明', emoji: '❓' };
}

async function geocodeCity(cityName) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=ja&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('ジオコーディング失敗');
  const data = await res.json();
  if (!data.results || data.results.length === 0) throw new Error(`「${cityName}」が見つかりません`);
  return { lat: data.results[0].latitude, lon: data.results[0].longitude, name: data.results[0].name };
}

async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max` +
    `&timezone=Asia%2FTokyo&forecast_days=7`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('天気データ取得失敗');
  return res.json();
}

function renderWeatherCard(data, cityName) {
  const daily = data.daily;
  // index 0 = today, index 1 = tomorrow
  const tomorrowIdx = 1;
  const code = daily.weather_code[tomorrowIdx];
  const info = getWeatherInfo(code);
  const maxTemp = Math.round(daily.temperature_2m_max[tomorrowIdx]);
  const minTemp = Math.round(daily.temperature_2m_min[tomorrowIdx]);
  const precip = daily.precipitation_sum[tomorrowIdx] ?? 0;
  const precipProb = daily.precipitation_probability_max[tomorrowIdx] ?? 0;
  const wind = Math.round(daily.wind_speed_10m_max[tomorrowIdx] ?? 0);

  const date = new Date(daily.time[tomorrowIdx]);
  const dateStr = `${date.getMonth() + 1}月${date.getDate()}日（${['日','月','火','水','木','金','土'][date.getDay()]}）`;

  return {
    html: `
      <div class="weather-card card">
        <div class="card-title">🌤 明日の天気 <span class="city-name">${cityName}</span></div>
        <div class="weather-date">${dateStr}</div>
        <div class="weather-main">
          <span class="weather-emoji">${info.emoji}</span>
          <span class="weather-label">${info.label}</span>
        </div>
        <div class="weather-details">
          <div class="weather-temp">
            <span class="temp-max">↑${maxTemp}℃</span>
            <span class="temp-min">↓${minTemp}℃</span>
          </div>
          <div class="weather-precip">☔ 降水確率 ${precipProb}%</div>
          <div class="weather-wind">💨 風速 ${wind} km/h</div>
        </div>
      </div>
    `,
    maxTemp,
    minTemp,
    precip,
    precipProb,
    wind,
  };
}

function renderWeekForecast(data) {
  const daily = data.daily;
  let rows = '';
  // Show days 1-5 (tomorrow + 4 more)
  for (let i = 1; i <= 5 && i < daily.time.length; i++) {
    const date = new Date(daily.time[i]);
    const dayLabel = ['日','月','火','水','木','金','土'][date.getDay()];
    const dateLabel = `${date.getMonth()+1}/${date.getDate()}(${dayLabel})`;
    const info = getWeatherInfo(daily.weather_code[i]);
    const maxT = Math.round(daily.temperature_2m_max[i]);
    const minT = Math.round(daily.temperature_2m_min[i]);
    const prob = daily.precipitation_probability_max[i] ?? 0;
    const laundryOk = prob < 50;
    rows += `
      <div class="week-row">
        <span class="week-date">${dateLabel}</span>
        <span class="week-emoji">${info.emoji}</span>
        <span class="week-temp"><span class="temp-max">↑${maxT}</span> <span class="temp-min">↓${minT}</span></span>
        <span class="week-rain">☔${prob}%</span>
        <span class="week-laundry ${laundryOk ? 'ok' : 'ng'}">${laundryOk ? '外干し◎' : '室内干し'}</span>
      </div>
    `;
  }
  return `
    <div class="week-card card">
      <div class="card-title">📅 週間見通し</div>
      <div class="week-list">${rows}</div>
    </div>
  `;
}
