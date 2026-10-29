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

function getCachedWeather(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

function setCachedWeather(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {}
}

function isValidCoordinate(value) {
  return value !== null && value !== undefined && String(value).trim() !== '' &&
    Number.isFinite(Number(value));
}

function getWeatherCacheKey(location) {
  const hasCoordinates = isValidCoordinate(location.lat) && isValidCoordinate(location.lon);

  if (hasCoordinates) {
    return `${CACHE_KEY}:coords:${Number(location.lat).toFixed(4)},${Number(location.lon).toFixed(4)}`;
  }

  return `${CACHE_KEY}:city:${encodeURIComponent((location.city || '').trim().toLowerCase())}`;
}

function formatCacheAge(ageMs) {
  const totalMinutes = Math.floor(Math.max(0, ageMs) / 60000);
  if (totalMinutes < 60) return `${totalMinutes}分前`;
  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 48) {
    const remainder = totalMinutes % 60;
    return `${totalHours}時間${remainder ? `${remainder}分` : ''}前`;
  }
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return `${days}日${hours ? `${hours}時間` : ''}前`;
}

function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleString('ja-JP', {
    year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

async function loadDashboard(settings) {
  showLoading(true);
  showError('');
  let weatherData = null;
  let weatherFetchedAt = null;
  let isCachedWeather = false;
  const location = getActiveLocation(settings);
  let cityName = location.city;
  let cacheKey = getWeatherCacheKey(location);
  let forecastTimestamp = Date.now();

  try {
    try {
      let lat = location.lat;
      let lon = location.lon;

      if (!isValidCoordinate(lat) || !isValidCoordinate(lon)) {
        const geo = await geocodeCity(location.city);
        lat = geo.lat;
        lon = geo.lon;
        cityName = geo.name;
        // Cache coords for faster next load
        location.lat = lat;
        location.lon = lon;
        saveSettings(settings);
      }

      cacheKey = getWeatherCacheKey({ ...location, lat, lon });

      weatherData = await fetchWeather(lat, lon);
      weatherData = validateWeatherData(weatherData);
      forecastTimestamp = Date.now();
      weatherFetchedAt = forecastTimestamp;
      setCachedWeather(cacheKey, { data: weatherData, cityName, ts: forecastTimestamp });
    } catch (err) {
      console.error('Weather fetch error:', err);
      const cached = getCachedWeather(cacheKey);
      if (cached) {
        try {
          weatherData = alignWeatherToToday(validateWeatherData(cached.data));
          forecastTimestamp = Number(cached.ts);
          if (!Number.isFinite(forecastTimestamp) || forecastTimestamp <= 0 ||
              !Number.isFinite(new Date(forecastTimestamp).getTime())) {
            throw new Error('キャッシュの取得日時が不正です');
          }
        } catch (cacheError) {
          showError(`⚠️ データ取得に失敗しました: ${err.message}。保存済みデータも利用できません。`);
          return;
        }

        weatherFetchedAt = forecastTimestamp;
        isCachedWeather = true;
        cityName = cached.cityName || location.city;
        const ageMs = Math.max(0, Date.now() - forecastTimestamp);
        const ageLabel = formatCacheAge(ageMs);
        if (ageMs < 24 * 60 * 60 * 1000) {
          showError(`⚠️ データ取得に失敗しました。前回の予報（${ageLabel}）を表示しています。`);
        } else {
          showError(`⚠️ 最新予報を取得できませんでした。${formatTimestamp(forecastTimestamp)}取得の古い予報（${ageLabel}）を表示しています。予報が変わっている可能性があります。`);
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

    const tomorrowDate = parseLocalDate(daily.time[tomorrowIdx]);
    const isActivityDay = !!(settings.activityDays && settings.activityDays[tomorrowDate.getDay()]);
    // Base clothing on the actual morning (7-9am) commute temperature rather
    // than the day's max, which can be much warmer than what kids leave the
    // house in. Falls back to max temp when hourly data isn't available.
    const clothesBaseTemp = hourlyTemps ? hourlyTemps.morning : maxTemp;
    const weatherInfo = getWeatherInfo(daily.weather_code[tomorrowIdx]);
    const tomorrowMonth = tomorrowDate.getMonth() + 1;
    const pickupAdvice = weatherData.hourly
      ? getLaundryPickupAdvice(buildHourlyRainProbabilities(weatherData), settings.laundryPickupHour)
      : null;
    const laundryAdvice = getLaundryAdvice(precip, precipProb, wind, settings, tomorrowMonth, pickupAdvice);
    const shareText = buildShareText(weatherInfo, laundryAdvice, settings.kids, clothesBaseTemp, precipProb, uvIndex, hourlyTemps, settings, wind);

    const quickSummaryHtml = renderQuickSummary(weatherData, settings, shareText, isActivityDay, clothesBaseTemp, hourlyTemps, weatherFetchedAt, isCachedWeather);
    const { html: weatherHtml } = renderWeatherCard(weatherData, cityName, weatherFetchedAt, isCachedWeather);
    const hourlyHtml = renderHourlyForecast(weatherData);
    const rainTimelineHtml = renderRainTimeline(weatherData, settings);
    const laundryHtml = renderLaundryAdvice(precip, precipProb, wind, settings, tomorrowMonth, pickupAdvice);
    const heatstrokeHtml = renderHeatstrokeAlert(weatherData, isActivityDay);
    const clothesHtml = renderKidsClothes(settings.kids, clothesBaseTemp, precipProb, uvIndex, hourlyTemps, { ...settings, windSpeed: wind, precipitation: precip });
    const weekHtml = renderWeekForecast(weatherData, settings);

    document.getElementById('dashboard-content').innerHTML =
      quickSummaryHtml +
      renderDashboardDetail('今日・明日の天気', weatherHtml) +
      renderDashboardDetail('時間帯別予報・雨の見通し', hourlyHtml + rainTimelineHtml) +
      renderDashboardDetail('洗濯の判定理由', laundryHtml) +
      renderDashboardDetail('服装・熱中症の詳しいアドバイス', clothesHtml + heatstrokeHtml) +
      renderDashboardDetail('週間予報', weekHtml);

    lastRefreshTime = Date.now();
  } finally {
    showLoading(false);
  }
}


function renderDashboardDetail(title, html) {
  if (!html) return '';
  return `<details class="dashboard-detail"><summary>${escapeHtml(title)}</summary><div class="detail-content">${html}</div></details>`;
}

function renderQuickSummary(data, settings, shareText, isActivityDay, baseTemp, hourlyTemps, fetchedAt, isCached) {
  const d = data.daily;
  const prob = d.precipitation_probability_max[1];
  const wind = d.wind_speed_10m_max[1];
  const month = parseLocalDate(d.time[1]).getMonth() + 1;
  const laundry = getLaundryAdvice(d.precipitation_sum[1], prob, wind, settings, month);
  const hours = buildHourlyRainProbabilities(data);
  const outdoor = getLaundryAdvice(0, 0, wind, settings, month).status === 'ok';
  const window = outdoor ? getLaundryTimeAdvice(hours, 30, settings.laundryPickupHour) : null;
  const prefs = { ...settings, windSpeed: wind, precipitation: d.precipitation_sum[1] };
  const belongings = new Set();
  const kids = (settings.kids || []).map(kid => {
    const advice = getClothingAdvice(baseTemp, kid.sensitivity, prob, d.uv_index_max?.[1], hourlyTemps, prefs);
    advice.items.forEach(item => belongings.add(item));
    return `<div class="overview-kid"><strong>${escapeHtml(kid.name || '子ども')}</strong><span>${escapeHtml(advice.outfit)}</span></div>`;
  }).join('');
  const assessment = getHeatstrokeAssessment(data, isActivityDay);
  const heat = assessment.heat;
  if (heat) belongings.add('水筒');
  const info = getWeatherInfo(d.weather_code[1]);
  const location = getActiveLocation(settings);
  const switcher = settings.locations.length > 1 ? `<div class="location-switcher">${settings.locations.map((loc, i) =>
    `<button type="button" class="location-pill ${i === settings.activeLocationIndex ? 'active' : ''}" data-action="switch-location" data-idx="${i}" aria-pressed="${i === settings.activeLocationIndex}">${escapeHtml(loc.label || `地点${i + 1}`)}</button>`).join('')}</div>` : '';
  const periods = [{ name: '朝', from: 7, to: 10 }, { name: '昼', from: 12, to: 15 }, { name: '夕方', from: 15, to: 18 }];
  const periodHtml = periods.map(period => {
    const values = (data.hourly?.time || []).flatMap((time, i) => {
      const h = Number(time.slice(11, 13));
      return time.startsWith(d.time[1]) && h >= period.from && h < period.to ? [i] : [];
    });
    const temp = values.length ? `${Math.round(values.reduce((sum, i) => sum + Number(data.hourly.temperature_2m[i]), 0) / values.length)}℃` : '—';
    const probabilities = values.map(i => data.hourly.precipitation_probability[i]).filter(value => value !== null && Number.isFinite(Number(value)));
    const rain = probabilities.length === values.length && values.length ? `${Math.max(...probabilities)}%` : '不明';
    const today = (data.hourly?.time || []).flatMap((time, i) => time.startsWith(d.time[0]) && Number(time.slice(11, 13)) >= period.from && Number(time.slice(11, 13)) < period.to ? [Number(data.hourly.temperature_2m[i])] : []);
    const delta = today.length === values.length && values.length ? Math.round(Number.parseFloat(temp) - today.reduce((a, b) => a + b, 0) / today.length) : null;
    return `<div><span>${period.name}</span><strong>${temp}</strong><small>☔ ${rain}</small>${delta === null ? '' : `<small>今日比 ${delta > 0 ? '+' : ''}${delta}℃</small>`}</div>`;
  }).join('');
  const timestamp = fetchedAt ? formatTimestamp(fetchedAt) : '不明';
  const bestDay = findBestLaundryDay(d, settings);
  return `<section class="quick-summary card overview" aria-label="明日のまとめ">
    ${switcher}
    <div class="overview-heading"><div><p class="quick-kicker">${escapeHtml(location.label || '地点')} · ${escapeHtml(location.city)}</p>
    <h2>${info.emoji} 明日は${escapeHtml(info.label)}</h2></div>
    <div class="quick-actions"><button class="quick-refresh" type="button" data-action="refresh">更新</button><button class="quick-share" type="button" data-action="share" data-share-text="${escapeHtml(shareText)}">共有</button></div></div>
    <p class="overview-range">${Math.round(d.temperature_2m_min[1])}〜${Math.round(d.temperature_2m_max[1])}℃ <span>降水 ${prob}% · 風 ${Math.round(wind)}km/h</span></p>
    <div class="overview-periods">${periodHtml}</div>
    ${heat ? `<p class="overview-alert" role="status">${heat.icon} 熱中症：${heat.label} · ${heat.message}</p>` : ''}
    <div class="overview-section"><h3>🧺 ${laundry.label}</h3><p>${escapeHtml(laundry.comments[0])}${window ? ` · 雨の少ない時間 ${window.start}〜${window.end}時` : ''}</p>${bestDay ? `<p>次の洗濯チャンス：${escapeHtml(bestDay)}</p>` : ''}</div>
    <div class="overview-section"><h3>👕 服装</h3>${kids || '<p>設定で子どもを登録してください</p>'}</div>
    <div class="overview-section"><h3>🎒 持ち物</h3><p>${escapeHtml([...belongings].join('・') || '天気に応じた追加の持ち物なし')}</p></div>
    ${isActivityDay ? '<p class="overview-activity">🏃 部活・習い事の日</p>' : ''}
    <p class="overview-updated">${isCached ? '前回取得（キャッシュ）' : '予報取得'}：${escapeHtml(timestamp)}</p>
  </section>`;
}

function buildShareText(weatherInfo, laundryAdvice, kids, clothesBaseTemp, precipProb, uvIndex, hourlyTemps, settings = {}, windSpeed = 0) {
  const kidsParts = (kids || []).map(kid => {
    const advice = getClothingAdvice(clothesBaseTemp, kid.sensitivity, precipProb, uvIndex, hourlyTemps, { ...settings, windSpeed });
    return `${kid.name || '子ども'}は${advice.outfit}`;
  });
  const parts = [`明日は${weatherInfo.label}`, laundryAdvice.label, ...kidsParts];
  return parts.join('、');
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

  // Delegated click handler for buttons rendered inside dashboard-content
  // (avoids inline onclick= attributes, which CSP blocks).
  document.getElementById('dashboard-content').addEventListener('click', (e) => {
    if (e.target.closest('[data-action="refresh"]')) {
      window.refreshWeather();
      return;
    }

    const switchBtn = e.target.closest('[data-action="switch-location"]');
    if (switchBtn) {
      const idx = parseInt(switchBtn.dataset.idx, 10);
      if (idx !== currentSettings.activeLocationIndex) {
        currentSettings.activeLocationIndex = idx;
        saveSettings(currentSettings);
        loadDashboard(currentSettings);
      }
      return;
    }

    const shareBtn = e.target.closest('[data-action="share"]');
    if (shareBtn) {
      const text = shareBtn.dataset.shareText;
      if (navigator.share) {
        navigator.share({ text }).catch(() => {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(text)
          .then(() => alert('クリップボードにコピーしました'))
          .catch(() => alert(text));
      } else {
        alert(text);
      }
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
