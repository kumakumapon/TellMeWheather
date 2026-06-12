// Main app controller

// Cache key for last known weather data
const CACHE_KEY = 'tellmeweather_cache';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

let currentSettings = null;
let currentView = 'dashboard'; // 'dashboard' | 'settings'

function showView(view) {
  currentView = view;
  document.getElementById('view-dashboard').style.display = view === 'dashboard' ? '' : 'none';
  document.getElementById('view-settings').style.display = view === 'settings' ? '' : 'none';
  document.getElementById('nav-dashboard').classList.toggle('active', view === 'dashboard');
  document.getElementById('nav-settings').classList.toggle('active', view === 'settings');
}

function showError(msg) {
  const el = document.getElementById('error-banner');
  el.textContent = msg;
  el.style.display = msg ? '' : 'none';
}

function showLoading(show) {
  document.getElementById('loading').style.display = show ? '' : 'none';
  document.getElementById('dashboard-content').style.display = show ? 'none' : '';
}

function getCachedWeather() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

function setCachedWeather(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (e) {}
}

async function loadDashboard(settings) {
  showLoading(true);
  showError('');
  let weatherData = null;
  let cityName = settings.city;

  try {
    let lat = settings.lat;
    let lon = settings.lon;

    if (!lat || !lon) {
      const geo = await geocodeCity(settings.city);
      lat = geo.lat;
      lon = geo.lon;
      cityName = geo.name;
      // Cache coords for faster next load
      settings.lat = lat;
      settings.lon = lon;
      saveSettings(settings);
    }

    weatherData = await fetchWeather(lat, lon);
    setCachedWeather({ data: weatherData, cityName, ts: Date.now() });
  } catch (err) {
    console.error('Weather fetch error:', err);
    const cached = getCachedWeather();
    if (cached) {
      weatherData = cached.data;
      cityName = cached.cityName;
      const age = Math.round((Date.now() - cached.ts) / 60000);
      // Only use cache if less than 24 hours old
      if (age < 1440) {
        showError(`⚠️ データ取得に失敗しました。前回のデータ（${age}分前）を表示しています。`);
      } else {
        showError(`⚠️ キャッシュが古すぎます（${age}分前）。新しいデータ取得に失敗しました: ${err.message}`);
        showLoading(false);
        return;
      }
    } else {
      showError(`⚠️ データ取得に失敗しました: ${err.message}`);
      showLoading(false);
      return;
    }
  }

  const daily = weatherData.daily;
  
  // Validate API response structure
  if (!daily || !Array.isArray(daily.weather_code) || daily.weather_code.length < 2) {
    throw new Error('Invalid API response: missing or incomplete daily data');
  }
  
  const tomorrowIdx = 1;
  const precip = daily.precipitation_sum[tomorrowIdx] ?? 0;
  const precipProb = daily.precipitation_probability_max[tomorrowIdx] ?? 0;
  const wind = daily.wind_speed_10m_max[tomorrowIdx] ?? 0;
  const maxTemp = daily.temperature_2m_max[tomorrowIdx];
  const uvIndex = daily.uv_index_max ? (daily.uv_index_max[tomorrowIdx] ?? 0) : 0;
  const fetchedAt = Date.now();

  console.log(`Weather data for tomorrow (${daily.time[tomorrowIdx]}): code=${daily.weather_code[tomorrowIdx]}, temp=${maxTemp}°C, precip=${precip}mm, precipProb=${precipProb}%`);

  const quickSummaryHtml = renderQuickSummary(weatherData, settings);
  const { html: weatherHtml } = renderWeatherCard(weatherData, cityName, fetchedAt);
  const laundryHtml = renderLaundryAdvice(precip, precipProb, wind, settings);
  const clothesHtml = renderKidsClothes(settings.kids, maxTemp, precipProb, uvIndex);
  const weekHtml = renderWeekForecast(weatherData);

  document.getElementById('dashboard-content').innerHTML =
    quickSummaryHtml + weatherHtml + laundryHtml + clothesHtml + weekHtml;

  showLoading(false);
}


function renderQuickSummary(weatherData, settings) {
  const daily = weatherData.daily;
  const tomorrowIdx = 1;
  const maxTemp = daily.temperature_2m_max[tomorrowIdx];
  const minTemp = daily.temperature_2m_min[tomorrowIdx];
  const precip = daily.precipitation_sum[tomorrowIdx] ?? 0;
  const precipProb = daily.precipitation_probability_max[tomorrowIdx] ?? 0;
  const wind = daily.wind_speed_10m_max[tomorrowIdx] ?? 0;
  const uvIndex = daily.uv_index_max ? (daily.uv_index_max[tomorrowIdx] ?? 0) : 0;
  const weatherInfo = getWeatherInfo(daily.weather_code[tomorrowIdx]);
  const laundry = getLaundryAdvice(precip, precipProb, wind, settings);
  const clothing = getClothingAdvice(maxTemp, 'normal', precipProb, uvIndex);
  const bestLaundryDay = findBestLaundryDay(daily, settings);

  const umbrellaLabel = precipProb >= 60 || precip > 0
    ? '傘を忘れずに'
    : precipProb >= 30
      ? '折り畳み傘が安心'
      : '傘は不要そう';
  const tempLabel = `${Math.round(minTemp)}℃〜${Math.round(maxTemp)}℃`;
  const chips = [
    { icon: '🧺', label: laundry.label, cls: laundry.status },
    { icon: '👕', label: clothing.outfit, cls: 'info' },
    { icon: '☔', label: umbrellaLabel, cls: precipProb >= 30 ? 'caution' : 'ok' },
  ];

  const bestDayHtml = bestLaundryDay
    ? `<p class="quick-note">次の洗濯チャンス：<strong>${bestLaundryDay}</strong></p>`
    : '<p class="quick-note">今週は雨・風に注意。部屋干しも準備しておくと安心です。</p>';

  return `
    <section class="quick-summary card" aria-label="明日の結論">
      <div class="quick-summary-main">
        <div>
          <div class="quick-kicker">3秒チェック</div>
          <h2 class="quick-title">明日は${weatherInfo.emoji} ${weatherInfo.label}</h2>
          <p class="quick-subtitle">${tempLabel}・降水確率${Math.round(precipProb)}%・最大風速${Math.round(wind)}km/h</p>
        </div>
        <button class="quick-refresh" onclick="window.refreshWeather()" type="button">更新</button>
      </div>
      <div class="quick-chips">
        ${chips.map(chip => `<span class="quick-chip ${chip.cls}">${chip.icon} ${escapeHtml(chip.label)}</span>`).join('')}
      </div>
      ${bestDayHtml}
    </section>
  `;
}

function findBestLaundryDay(daily, settings) {
  const DAYS = ['日','月','火','水','木','金','土'];
  const considerWind = settings.considerWind ?? true;

  for (let i = 1; i < daily.time.length; i += 1) {
    const precip = daily.precipitation_sum[i] ?? 0;
    const precipProb = daily.precipitation_probability_max[i] ?? 0;
    const wind = daily.wind_speed_10m_max[i] ?? 0;
    const windy = considerWind && wind >= STRONG_WIND_THRESHOLD_KMH;

    if (precip === 0 && precipProb < 40 && !windy) {
      const date = new Date(daily.time[i]);
      const label = i === 1 ? '明日' : `${date.getMonth() + 1}/${date.getDate()}(${DAYS[date.getDay()]})`;
      return `${label}（☔${Math.round(precipProb)}%）`;
    }
  }

  return null;
}

function renderSettingsView(settings) {
  document.getElementById('settings-content').innerHTML = renderSettingsForm(settings);
  bindSettingsEvents(settings, (newSettings) => {
    currentSettings = newSettings;
    showView('dashboard');
    loadDashboard(newSettings);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  currentSettings = loadSettings();

  // Global refresh handler (called from inline onclick in weather card)
  window.refreshWeather = () => loadDashboard(currentSettings);

  // Nav buttons
  document.getElementById('nav-dashboard').addEventListener('click', () => {
    showView('dashboard');
    if (!document.getElementById('dashboard-content').innerHTML.trim()) {
      loadDashboard(currentSettings);
    }
  });

  document.getElementById('nav-settings').addEventListener('click', () => {
    showView('settings');
    renderSettingsView(currentSettings);
  });

  // Initial load
  showView('dashboard');
  loadDashboard(currentSettings);
});
