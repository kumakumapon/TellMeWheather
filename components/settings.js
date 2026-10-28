// Settings component

const DEFAULT_SETTINGS = {
  locations: [
    { label: '自宅', city: '東京', lat: null, lon: null },
  ],
  activeLocationIndex: 0,
  kids: [
    { name: '', grade: '小3', sensitivity: 'normal' },
  ],
  considerPollen: false,
  considerWind: true,
  wearsUniform: false,
  commuteMode: 'walk',
  laundryPickupHour: '',
  activityDays: [false, false, false, false, false, false, false], // Sun..Sat
};

const MAX_LOCATIONS = 3;
const GRADES = ['小1','小2','小3','小4','小5','小6','中1','中2','中3'];
const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

// Fills in gaps left by settings saved before a given field existed, and
// migrates the pre-multi-location schema (flat city/lat/lon) into locations.
function normalizeSettings(parsed) {
  const merged = { ...DEFAULT_SETTINGS, ...parsed };

  if (!Array.isArray(parsed.locations) && parsed.city !== undefined) {
    merged.locations = [{ label: '自宅', city: parsed.city, lat: parsed.lat ?? null, lon: parsed.lon ?? null }];
  }
  if (!Array.isArray(merged.locations) || merged.locations.length === 0) {
    merged.locations = DEFAULT_SETTINGS.locations.map(loc => ({ ...loc }));
  }
  if (!Number.isInteger(merged.activeLocationIndex) || merged.activeLocationIndex >= merged.locations.length || merged.activeLocationIndex < 0) {
    merged.activeLocationIndex = 0;
  }
  if (!Array.isArray(merged.activityDays) || merged.activityDays.length !== 7) {
    merged.activityDays = DEFAULT_SETTINGS.activityDays.slice();
  }
  merged.wearsUniform = Boolean(merged.wearsUniform);
  if (!['walk', 'bike'].includes(merged.commuteMode)) merged.commuteMode = 'walk';
  if (![ '', '12', '14', '16', '18', '20' ].includes(String(merged.laundryPickupHour ?? ''))) {
    merged.laundryPickupHour = '';
  } else {
    merged.laundryPickupHour = String(merged.laundryPickupHour ?? '');
  }

  delete merged.city;
  delete merged.lat;
  delete merged.lon;

  return merged;
}

function getActiveLocation(settings) {
  const locations = settings.locations || DEFAULT_SETTINGS.locations;
  return locations[settings.activeLocationIndex] || locations[0];
}

function loadSettings() {
  try {
    const raw = localStorage.getItem('tellmeweather_settings');
    if (raw) {
      return normalizeSettings(JSON.parse(raw));
    }
  } catch (e) {
    console.warn('設定の読み込みに失敗しました', e);
  }
  return normalizeSettings({});
}

function saveSettings(settings) {
  try {
    localStorage.setItem('tellmeweather_settings', JSON.stringify(settings));
  } catch (e) {
    console.warn('設定の保存に失敗しました', e);
  }
}

function renderKidSetting(kid, i) {
  return `
    <div class="kid-setting" data-idx="${i}">
      <div class="kid-setting-title">子ども${i + 1}</div>
      <label>名前（任意）
        <input type="text" class="kid-name" data-idx="${i}" value="${escapeHtml(kid.name || '')}" placeholder="例：たろう" maxlength="20">
      </label>
      <label>学年
        <select class="kid-grade" data-idx="${i}">
          ${GRADES.map(g => `<option value="${g}" ${kid.grade === g ? 'selected' : ''}>${g}</option>`).join('')}
        </select>
      </label>
      <label>体感温度
        <select class="kid-sensitivity" data-idx="${i}">
          <option value="cold" ${kid.sensitivity === 'cold' ? 'selected' : ''}>寒がり</option>
          <option value="normal" ${kid.sensitivity === 'normal' ? 'selected' : ''}>普通</option>
          <option value="hot" ${kid.sensitivity === 'hot' ? 'selected' : ''}>暑がり</option>
        </select>
      </label>
    </div>
  `;
}

function renderLocationSetting(loc, i, canRemove) {
  return `
    <div class="location-setting" data-idx="${i}">
      <div class="location-setting-row">
        <input type="text" class="location-label" data-idx="${i}" value="${escapeHtml(loc.label || '')}" placeholder="例：自宅" maxlength="10">
        ${canRemove ? `<button type="button" class="location-remove" data-idx="${i}" aria-label="この地点を削除">✕</button>` : ''}
      </div>
      <label>市区町村名
        <input type="text" class="location-city" data-idx="${i}" value="${escapeHtml(loc.city || '')}" placeholder="例：東京、大阪市、札幌市" maxlength="50">
      </label>
      <button type="button" class="btn-gps location-gps" data-idx="${i}">📍 現在地を取得</button>
    </div>
  `;
}

function renderSettingsForm(settings) {
  const kidsCount = settings.kids ? settings.kids.length : 1;
  const locations = settings.locations || [];

  const kidsHtml = (settings.kids || []).map((kid, i) => renderKidSetting(kid, i)).join('');
  const locationsHtml = locations.map((loc, i) => renderLocationSetting(loc, i, locations.length > 1)).join('');
  const activityDaysHtml = DAY_LABELS.map((label, i) => `
    <label class="activity-day-toggle">
      <input type="checkbox" class="activity-day" data-idx="${i}" ${settings.activityDays?.[i] ? 'checked' : ''}>
      ${label}
    </label>
  `).join('');

  return `
    <div class="settings-form">
      <section class="settings-section">
        <h2>📍 地域設定</h2>
        <div id="locations-list">${locationsHtml}</div>
        <button type="button" id="add-location-btn" class="btn-secondary" ${locations.length >= MAX_LOCATIONS ? 'disabled' : ''}>＋ 地点を追加（最大${MAX_LOCATIONS}件）</button>
      </section>

      <section class="settings-section">
        <h2>🏃 部活・習い事</h2>
        <p class="settings-hint">屋外での部活・習い事がある曜日を選ぶと、その日は熱中症・雨への注意を強めに表示します。</p>
        <div class="activity-days">${activityDaysHtml}</div>
      </section>

      <section class="settings-section">
        <h2>👦 子ども情報</h2>
        <label>人数
          <select id="setting-kids-count">
            <option value="1" ${kidsCount === 1 ? 'selected' : ''}>1人</option>
            <option value="2" ${kidsCount === 2 ? 'selected' : ''}>2人</option>
            <option value="3" ${kidsCount === 3 ? 'selected' : ''}>3人</option>
          </select>
        </label>
        <div id="kids-list">${kidsHtml}</div>
      </section>

      <section class="settings-section">
        <h2>🏫 通学・生活スタイル</h2>
        <label class="checkbox-label">
          <input type="checkbox" id="setting-uniform" ${settings.wearsUniform ? 'checked' : ''}>
          制服で通学する
        </label>
        <label>通学手段
          <select id="setting-commute">
            <option value="walk" ${settings.commuteMode === 'walk' ? 'selected' : ''}>徒歩</option>
            <option value="bike" ${settings.commuteMode === 'bike' ? 'selected' : ''}>自転車</option>
          </select>
        </label>
        <label>洗濯物を取り込める最終時刻
          <select id="setting-laundry-pickup">
            <option value="" ${settings.laundryPickupHour === '' ? 'selected' : ''}>指定しない</option>
            ${[12, 14, 16, 18, 20].map(hour => `<option value="${hour}" ${settings.laundryPickupHour === String(hour) ? 'selected' : ''}>${hour}:00</option>`).join('')}
          </select>
        </label>
        <p class="settings-hint">通学時の服装・雨具と、外干しの候補時間に反映します。</p>
      </section>

      <section class="settings-section">
        <h2>🧺 洗濯設定</h2>
        <label class="checkbox-label">
          <input type="checkbox" id="setting-pollen" ${settings.considerPollen ? 'checked' : ''}>
          花粉を考慮する（春・秋に外干し非推奨）
        </label>
        <label class="checkbox-label">
          <input type="checkbox" id="setting-wind" ${settings.considerWind ? 'checked' : ''}>
          強風を考慮する
        </label>
      </section>

      <button id="save-settings-btn" class="btn-primary">💾 設定を保存</button>
    </div>
  `;
}

function bindSettingsEvents(settings, onSave) {
  const kidsCountEl = document.getElementById('setting-kids-count');
  const cityManuallyEdited = bindLocationEvents(settings);

  kidsCountEl.addEventListener('change', () => {
    const count = parseInt(kidsCountEl.value, 10);
    const current = settings.kids || [];
    while (current.length < count) {
      current.push({ name: '', grade: '小1', sensitivity: 'normal' });
    }
    settings.kids = current.slice(0, count);
    // Re-render kids list
    document.getElementById('kids-list').innerHTML =
      settings.kids.map((kid, i) => renderKidSetting(kid, i)).join('');
    bindKidInputEvents(settings);
  });

  bindKidInputEvents(settings);

  document.getElementById('save-settings-btn').addEventListener('click', () => {
    const pollen = document.getElementById('setting-pollen').checked;
    const wind = document.getElementById('setting-wind').checked;
    const wearsUniform = document.getElementById('setting-uniform').checked;
    const commuteMode = document.getElementById('setting-commute').value;
    const laundryPickupHour = document.getElementById('setting-laundry-pickup').value;
    const activityDays = Array.from(document.querySelectorAll('.activity-day')).map(el => el.checked);

    settings.locations.forEach((loc, i) => {
      loc.city = (loc.city || '').trim();
      // Clear GPS coordinates only if the user manually edited this location's
      // city text. GPS lookup also changes the city text (via reverse
      // geocoding), so comparing against the old city value alone would
      // always discard the fresh coordinates.
      if (cityManuallyEdited.has(i)) {
        loc.lat = null;
        loc.lon = null;
      }
    });

    if (settings.locations.some(loc => !loc.city)) {
      alert('すべての地点の市区町村名を入力してください。');
      return;
    }

    settings.considerPollen = pollen;
    settings.considerWind = wind;
    settings.wearsUniform = wearsUniform;
    settings.commuteMode = commuteMode;
    settings.laundryPickupHour = laundryPickupHour;
    settings.activityDays = activityDays;

    saveSettings(settings);
    onSave(settings);
  });
}

function bindLocationEvents(settings) {
  const container = document.getElementById('locations-list');
  const addBtn = document.getElementById('add-location-btn');
  const cityManuallyEdited = new Set();

  function rerender() {
    container.innerHTML = settings.locations
      .map((loc, i) => renderLocationSetting(loc, i, settings.locations.length > 1))
      .join('');
    addBtn.disabled = settings.locations.length >= MAX_LOCATIONS;
  }

  container.addEventListener('input', (e) => {
    const row = e.target.closest('[data-idx]');
    if (!row) return;
    const idx = parseInt(row.dataset.idx, 10);
    if (e.target.classList.contains('location-label')) {
      settings.locations[idx].label = e.target.value;
    } else if (e.target.classList.contains('location-city')) {
      settings.locations[idx].city = e.target.value;
      cityManuallyEdited.add(idx);
    }
  });

  container.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.location-remove');
    if (removeBtn) {
      const idx = parseInt(removeBtn.dataset.idx, 10);
      settings.locations.splice(idx, 1);
      if (settings.activeLocationIndex >= settings.locations.length) {
        settings.activeLocationIndex = 0;
      }
      cityManuallyEdited.clear();
      rerender();
      return;
    }

    const gpsBtn = e.target.closest('.location-gps');
    if (gpsBtn) {
      runLocationGpsLookup(parseInt(gpsBtn.dataset.idx, 10), gpsBtn, settings);
    }
  });

  addBtn.addEventListener('click', () => {
    if (settings.locations.length >= MAX_LOCATIONS) return;
    settings.locations.push({ label: `地点${settings.locations.length + 1}`, city: '', lat: null, lon: null });
    rerender();
  });

  return cityManuallyEdited;
}

function runLocationGpsLookup(idx, btn, settings) {
  if (!navigator.geolocation) {
    alert('このブラウザはGeolocationに対応していません。');
    return;
  }
  btn.disabled = true;
  btn.textContent = '取得中...';

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ja`
        );
        if (!res.ok) throw new Error('Nominatim response error');
        const data = await res.json();
        const addr = data.address || {};
        const cityName = addr.city || addr.town || addr.village || addr.county || addr.state || '';
        if (cityName) {
          const cityInput = document.querySelector(`.location-city[data-idx="${idx}"]`);
          if (cityInput) cityInput.value = cityName;
          settings.locations[idx].city = cityName;
        }
        settings.locations[idx].lat = lat;
        settings.locations[idx].lon = lon;
      } catch (e) {
        console.warn('逆ジオコーディングに失敗しました', e);
        alert('地名の取得に失敗しました。手動で入力してください。');
      } finally {
        btn.disabled = false;
        btn.textContent = '📍 現在地を取得';
      }
    },
    (err) => {
      btn.disabled = false;
      btn.textContent = '📍 現在地を取得';
      if (err.code === err.PERMISSION_DENIED) {
        alert('位置情報の取得が拒否されました。ブラウザの設定をご確認ください。');
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        alert('位置情報を取得できませんでした。');
      } else if (err.code === err.TIMEOUT) {
        alert('位置情報の取得がタイムアウトしました。');
      } else {
        alert('位置情報の取得に失敗しました。');
      }
    },
    { timeout: 10000 }
  );
}

function bindKidInputEvents(settings) {
  document.querySelectorAll('.kid-name').forEach(el => {
    el.addEventListener('input', e => {
      const idx = parseInt(e.target.dataset.idx, 10);
      settings.kids[idx].name = e.target.value;
    });
  });
  document.querySelectorAll('.kid-grade').forEach(el => {
    el.addEventListener('change', e => {
      const idx = parseInt(e.target.dataset.idx, 10);
      settings.kids[idx].grade = e.target.value;
    });
  });
  document.querySelectorAll('.kid-sensitivity').forEach(el => {
    el.addEventListener('change', e => {
      const idx = parseInt(e.target.dataset.idx, 10);
      settings.kids[idx].sensitivity = e.target.value;
    });
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { normalizeSettings, getActiveLocation };
}
