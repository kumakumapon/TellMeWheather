// Settings component

const DEFAULT_SETTINGS = {
  city: '東京',
  lat: null,
  lon: null,
  kids: [
    { name: '', grade: '小3', sensitivity: 'normal' },
  ],
  considerPollen: false,
  considerWind: true,
};

const GRADES = ['小1','小2','小3','小4','小5','小6','中1','中2','中3'];

function loadSettings() {
  try {
    const raw = localStorage.getItem('tellmeweather_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn('設定の読み込みに失敗しました', e);
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings) {
  try {
    localStorage.setItem('tellmeweather_settings', JSON.stringify(settings));
  } catch (e) {
    console.warn('設定の保存に失敗しました', e);
  }
}

function renderSettingsForm(settings) {
  const kidsCount = settings.kids ? settings.kids.length : 1;

  const kidsHtml = (settings.kids || []).map((kid, i) => `
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
  `).join('');

  return `
    <div class="settings-form">
      <section class="settings-section">
        <h2>📍 地域設定</h2>
        <label>市区町村名
          <input type="text" id="setting-city" value="${escapeHtml(settings.city || '')}" placeholder="例：東京、大阪市、札幌市" maxlength="50">
        </label>
        <button type="button" id="gps-btn" class="btn-gps">📍 現在地を取得</button>
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
  let cityManuallyEdited = false;

  document.getElementById('setting-city').addEventListener('input', () => {
    cityManuallyEdited = true;
  });

  kidsCountEl.addEventListener('change', () => {
    const count = parseInt(kidsCountEl.value, 10);
    const current = settings.kids || [];
    while (current.length < count) {
      current.push({ name: '', grade: '小1', sensitivity: 'normal' });
    }
    settings.kids = current.slice(0, count);
    // Re-render kids list
    document.getElementById('kids-list').innerHTML =
      settings.kids.map((kid, i) => `
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
      `).join('');
    bindKidInputEvents(settings);
  });

  bindKidInputEvents(settings);

  document.getElementById('gps-btn').addEventListener('click', () => {
    const btn = document.getElementById('gps-btn');
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
            document.getElementById('setting-city').value = cityName;
          }
          settings.lat = lat;
          settings.lon = lon;
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
  });

  document.getElementById('save-settings-btn').addEventListener('click', () => {
    const city = document.getElementById('setting-city').value.trim();
    const pollen = document.getElementById('setting-pollen').checked;
    const wind = document.getElementById('setting-wind').checked;

    if (!city) {
      alert('市区町村名を入力してください。');
      return;
    }

    // Clear GPS coordinates only if the user manually edited the city text.
    // GPS lookup also changes the city text (via reverse geocoding), so comparing
    // against the old city value alone would always discard the fresh coordinates.
    if (cityManuallyEdited) {
      settings.lat = null;
      settings.lon = null;
    }
    settings.city = city;
    settings.considerPollen = pollen;
    settings.considerWind = wind;

    saveSettings(settings);
    onSave(settings);
  });
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
