// Main app controller

// Cache key for last known weather data
const CACHE_KEY = 'tellmeweather_cache';

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
    console.error(err);
    const cached = getCachedWeather();
    if (cached) {
      weatherData = cached.data;
      cityName = cached.cityName;
      const age = Math.round((Date.now() - cached.ts) / 60000);
      showError(`⚠️ データ取得に失敗しました。前回のデータ（${age}分前）を表示しています。`);
    } else {
      showError(`⚠️ データ取得に失敗しました: ${err.message}`);
      showLoading(false);
      return;
    }
  }

  const daily = weatherData.daily;
  const tomorrowIdx = 1;
  const precip = daily.precipitation_sum[tomorrowIdx] ?? 0;
  const precipProb = daily.precipitation_probability_max[tomorrowIdx] ?? 0;
  const wind = daily.wind_speed_10m_max[tomorrowIdx] ?? 0;
  const maxTemp = daily.temperature_2m_max[tomorrowIdx];

  const { html: weatherHtml } = renderWeatherCard(weatherData, cityName);
  const laundryHtml = renderLaundryAdvice(precip, precipProb, wind, settings);
  const clothesHtml = renderKidsClothes(settings.kids, maxTemp);
  const weekHtml = renderWeekForecast(weatherData);

  document.getElementById('dashboard-content').innerHTML =
    weatherHtml + laundryHtml + clothesHtml + weekHtml;

  showLoading(false);
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
