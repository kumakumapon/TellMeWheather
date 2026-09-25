// Main app controller

// Cache key for last known weather data
const CACHE_KEY = 'tellmeweather_cache';

let currentSettings = null;
let currentView = 'dashboard'; // 'dashboard' | 'settings'
let lastRefreshTime = Date.now();

function showView(view) {
  currentView = view;
  document.getElementById('view-dashboard').style.display = view === 'dashboard' ? '' : 'none';
  document.getElementById('view-settings').style.display = view === 'settings' ? '' : 'none';
  document.getElementById('nav-dashboard').classList.toggle('active', view === 'dashboard');
  document.getElementById('nav-settings').classList.toggle('active', view === 'settings');
  document.getElementById('nav-dashboard').setAttribute('aria-selected', String(view === 'dashboard'));
  document.getElementById('nav-settings').setAttribute('aria-selected', String(view === 'settings'));
}

function showError(msg) {
  const el = document.getElementById('error-banner');
  el.textContent = msg;
  el.style.display = msg ? '' : 'none';
}

function showLoading(show) {
  const loadingEl = document.getElementById('loading');
  const contentEl = document.getElementById('dashboard-content');
  document.getElementById('view-dashboard').setAttribute('aria-busy', String(show));
  if (show) {
    loadingEl.innerHTML = renderSkeletonUI();
    loadingEl.style.display = '';
    contentEl.style.display = 'none';
  } else {
    loadingEl.style.display = 'none';
    contentEl.style.display = '';
  }
}

function renderSkeletonUI() {
  return `
    <div class="skeleton-card">
      <div class="skeleton-line title"></div>
      <div class="skeleton-line long"></div>
      <div class="skeleton-line medium"></div>
    </div>
    <div class="skeleton-card">
      <div class="skeleton-line title"></div>
      <div class="skeleton-grid">
        <div class="skeleton-grid-item">
          <div class="skeleton-circle"></div>
          <div class="skeleton-line full"></div>
          <div class="skeleton-line short"></div>
        </div>
        <div class="skeleton-grid-item">
          <div class="skeleton-circle"></div>
          <div class="skeleton-line full"></div>
          <div class="skeleton-line short"></div>
        </div>
      </div>
    </div>
    <div class="skeleton-card">
      <div class="skeleton-line title"></div>
      <div class="skeleton-line long"></div>
      <div class="skeleton-line medium"></div>
      <div class="skeleton-line short"></div>
    </div>
    <div class="skeleton-card">
      <div class="skeleton-line title"></div>
      <div class="skeleton-line full"></div>
      <div class="skeleton-line long"></div>
    </div>
  `;
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

      // Validate API response structure before trusting/caching it
      const daily = weatherData.daily;
      if (!daily || !Array.isArray(daily.weather_code) || daily.weather_code.length < 2) {
        throw new Error('Invalid API response: missing or incomplete daily data');
      }

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
          return;
        }
      } else {
        showError(`⚠️ データ取得に失敗しました: ${err.message}`);
        return;
      }
    }

    const daily = weatherData.daily;
    const tomorrowIdx = 1;
    const precip = daily.precipitation_sum[tomorrowIdx] ?? 0;
    const precipProb = daily.precipitation_probability_max[tomorrowIdx] ?? 0;
    const wind = daily.wind_speed_10m_max[tomorrowIdx] ?? 0;
    const maxTemp = daily.temperature_2m_max[tomorrowIdx];
    const uvIndex = daily.uv_index_max ? (daily.uv_index_max[tomorrowIdx] ?? 0) : 0;
    const fetchedAt = Date.now();

    let hourlyTemps = null;
    if (weatherData.hourly && weatherData.hourly.time) {
      const tomorrowDate = daily.time[tomorrowIdx];
      const morningHours = weatherData.hourly.time
        .map((t, i) => ({ t, i }))
        .filter(({ t }) => t.startsWith(tomorrowDate) && parseInt(t.split('T')[1]) >= 7 && parseInt(t.split('T')[1]) <= 9);
      const afternoonHours = weatherData.hourly.time
        .map((t, i) => ({ t, i }))
        .filter(({ t }) => t.startsWith(tomorrowDate) && parseInt(t.split('T')[1]) >= 12 && parseInt(t.split('T')[1]) <= 14);

      if (morningHours.length > 0 && afternoonHours.length > 0) {
        const avgMorning = morningHours.reduce((s, h) => s + weatherData.hourly.temperature_2m[h.i], 0) / morningHours.length;
        const avgAfternoon = afternoonHours.reduce((s, h) => s + weatherData.hourly.temperature_2m[h.i], 0) / afternoonHours.length;
        hourlyTemps = { morning: Math.round(avgMorning), afternoon: Math.round(avgAfternoon) };
      }
    }

    const quickSummaryHtml = renderQuickSummary(weatherData, settings);
    const { html: weatherHtml } = renderWeatherCard(weatherData, cityName, fetchedAt);
    const hourlyHtml = renderHourlyForecast(weatherData);
    const rainTimelineHtml = renderRainTimeline(weatherData);
    const tomorrowMonth = parseLocalDate(daily.time[tomorrowIdx]).getMonth() + 1;
    const laundryHtml = renderLaundryAdvice(precip, precipProb, wind, settings, tomorrowMonth);
    const heatstrokeHtml = renderHeatstrokeAlert(weatherData);
    const clothesHtml = renderKidsClothes(settings.kids, maxTemp, precipProb, uvIndex, hourlyTemps);
    const weekHtml = renderWeekForecast(weatherData, settings);

    document.getElementById('dashboard-content').innerHTML =
      quickSummaryHtml + weatherHtml + hourlyHtml + rainTimelineHtml + laundryHtml + heatstrokeHtml + clothesHtml + weekHtml;

    lastRefreshTime = Date.now();
  } finally {
    showLoading(false);
  }
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
  const tomorrowMonth = parseLocalDate(daily.time[tomorrowIdx]).getMonth() + 1;
  const laundry = getLaundryAdvice(precip, precipProb, wind, settings, tomorrowMonth);
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
          <h2 class="quick-title">
            ${renderWeatherVisual(daily.weather_code[tomorrowIdx], weatherInfo, 'weather-visual-quick')}
            <span>明日は${weatherInfo.label}</span>
          </h2>
          <p class="quick-subtitle">${tempLabel}・降水確率${Math.round(precipProb)}%・最大風速${Math.round(wind)}km/h</p>
        </div>
        <button class="quick-refresh" data-action="refresh" type="button">更新</button>
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

  for (let i = 1; i < daily.time.length; i += 1) {
    const precip = daily.precipitation_sum[i] ?? 0;
    const precipProb = daily.precipitation_probability_max[i] ?? 0;
    const wind = daily.wind_speed_10m_max[i] ?? 0;
    const date = parseLocalDate(daily.time[i]);

    if (getLaundryAdvice(precip, precipProb, wind, settings, date.getMonth() + 1).status === 'ok') {
      const label = i === 1 ? '明日' : `${date.getMonth() + 1}/${date.getDate()}(${DAYS[date.getDay()]})`;
      return `${label}（☔${Math.round(precipProb)}%）`;
    }
  }

  return null;
}

function renderSettingsView(settings) {
  // Edit a copy so unsaved changes (kid names, GPS lookups, etc.) don't leak
  // into currentSettings if the user navigates away without saving.
  const draft = JSON.parse(JSON.stringify(settings));
  document.getElementById('settings-content').innerHTML = renderSettingsForm(draft);
  bindSettingsEvents(draft, (newSettings) => {
    currentSettings = newSettings;
    showView('dashboard');
    loadDashboard(newSettings);
  });
}

// Theme toggle
function initTheme() {
  const saved = localStorage.getItem('tellmeweather_theme');
  if (saved === 'dark') {
    document.documentElement.classList.add('dark-mode');
  } else if (saved === 'light') {
    document.documentElement.classList.remove('dark-mode');
  } else {
    // Follow system preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark-mode');
    }
  }
  updateThemeIcon();
}

function updateThemeIcon() {
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    const isDark = document.documentElement.classList.contains('dark-mode');
    btn.textContent = isDark ? '☀️' : '🌙';
  }
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark-mode');
  localStorage.setItem('tellmeweather_theme', isDark ? 'dark' : 'light');
  updateThemeIcon();
}

document.addEventListener('DOMContentLoaded', () => {
  currentSettings = loadSettings();
  initTheme();
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  window.refreshWeather = () => loadDashboard(currentSettings);

  // Delegated click handler for the refresh buttons rendered inside
  // dashboard-content (avoids inline onclick= attributes, which CSP blocks).
  document.getElementById('dashboard-content').addEventListener('click', (e) => {
    if (e.target.closest('[data-action="refresh"]')) {
      window.refreshWeather();
    }
  });

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

  // Service Worker registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});

// Auto-refresh when tab becomes visible after 30+ minutes
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    const elapsed = Date.now() - lastRefreshTime;
    if (elapsed >= 30 * 60 * 1000 && currentSettings) {
      lastRefreshTime = Date.now();
      loadDashboard(currentSettings);
    }
  }
});
