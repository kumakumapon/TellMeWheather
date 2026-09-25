// WMO weather codes ordered from mildest to most severe. The numeric code
// value does not correlate with severity (e.g. 77 "snow grains" > 65 "heavy
// rain" numerically but is not worse), so pick the "worst" hour by looking
// up each code's position in this table instead of comparing codes directly.
const WMO_SEVERITY_ORDER = [
  0, 1, 2, 3,             // clear -> overcast
  45, 48,                 // fog
  51, 53, 55, 56, 57,     // drizzle (incl. freezing)
  61, 80,                 // slight rain / slight showers
  71,                     // slight snow
  77,                     // snow grains (light precipitation)
  63, 81,                 // moderate rain / moderate showers
  73, 85,                 // moderate snow / slight snow showers
  65, 66,                 // heavy rain / light freezing rain
  75,                     // heavy snow
  67, 86,                 // heavy freezing rain / heavy snow showers
  82,                     // violent rain showers
  95, 96, 99,             // thunderstorm (incl. hail)
];

function getWeatherSeverity(code) {
  const idx = WMO_SEVERITY_ORDER.indexOf(code);
  return idx === -1 ? 0 : idx;
}

function buildSummary(slots) {
  if (slots.length === 0) return '';

  const labelOf = slot => slot.info.label;
  const isRainy = code => {
    const label = code.info.label;
    return label.includes('雨') || label.includes('雷') || label.includes('霧雨');
  };
  const isCloudy = slot => slot.info.label.includes('曇');
  const isSunny = slot => slot.info.label.includes('晴') || slot.info.label === '快晴';

  const morning = slots.find(s => s.name === '朝');
  const afternoon = slots.find(s => s.name === '昼過ぎ');
  const evening = slots.find(s => s.name === '夕方');

  const parts = [];

  if (morning && afternoon) {
    if (!isRainy(morning) && isRainy(afternoon)) {
      parts.push('昼から雨');
    } else if (isRainy(morning) && !isRainy(afternoon)) {
      parts.push('午前中は雨、昼から回復');
    } else if (isRainy(morning) && isRainy(afternoon)) {
      if (evening && !isRainy(evening)) {
        parts.push('雨は夕方までに止む見込み');
      } else {
        parts.push('一日中雨の見込み');
      }
    } else if (isSunny(morning) && isCloudy(afternoon)) {
      parts.push('朝は晴れ、午後から曇り');
    } else if (isCloudy(morning) && isSunny(afternoon)) {
      parts.push('朝は曇り、午後から晴れ');
    } else if (isSunny(morning) && isSunny(afternoon)) {
      parts.push('終日晴れの見込み');
    } else {
      parts.push('おおむね' + labelOf(morning));
    }
  } else if (slots.length > 0) {
    parts.push('おおむね' + labelOf(slots[0]));
  }

  if (evening && isRainy(evening) && parts.length > 0 && !parts[0].includes('雨')) {
    parts.push('夕方から雨');
  }

  return parts.join('、') + 'でしょう';
}

function renderHourlyForecast(data) {
  if (!data.hourly || !data.hourly.time) return '';

  const tomorrowDate = data.daily.time[1];

  const TIME_SLOTS = [
    { name: '早朝', from: 5, to: 7 },
    { name: '朝',   from: 7, to: 10 },
    { name: '昼前', from: 10, to: 12 },
    { name: '昼過ぎ', from: 12, to: 15 },
    { name: '夕方', from: 15, to: 18 },
    { name: '夜',   from: 18, to: 21 },
  ];

  const hourly = data.hourly;

  const slots = TIME_SLOTS.map(slot => {
    const indices = hourly.time
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => {
        if (!t.startsWith(tomorrowDate)) return false;
        const h = parseInt(t.split('T')[1]);
        return h >= slot.from && h < slot.to;
      });

    if (indices.length === 0) return null;

    const avgTemp = Math.round(
      indices.reduce((s, { i }) => s + hourly.temperature_2m[i], 0) / indices.length
    );
    const maxPrecipProb = Math.max(...indices.map(({ i }) => hourly.precipitation_probability[i] ?? 0));

    const codes = indices.map(({ i }) => hourly.weather_code[i]);
    const worstCode = codes.reduce(
      (a, b) => (getWeatherSeverity(b) > getWeatherSeverity(a) ? b : a),
      codes[0]
    );
    const info = getWeatherInfo(worstCode);

    return { name: slot.name, avgTemp, maxPrecipProb, code: worstCode, info };
  }).filter(Boolean);

  const summary = buildSummary(slots);

  const slotsHtml = slots.map(slot => `
    <div class="hourly-slot">
      <div class="hourly-slot-name">${slot.name}</div>
      <div class="hourly-slot-emoji">${renderWeatherVisual(slot.code, slot.info, 'weather-visual-hourly')}</div>
      <div class="hourly-slot-temp">${slot.avgTemp}℃</div>
      <div class="hourly-slot-rain">☔${slot.maxPrecipProb}%</div>
    </div>
  `).join('');

  return `
    <div class="hourly-card card">
      <div class="card-title">⏰ 明日の時間帯別予報</div>
      <div class="hourly-summary">${escapeHtml(summary)}</div>
      <div class="hourly-slots">${slotsHtml}</div>
    </div>
  `;
}

// Hourly precipitation probability for tomorrow, 6:00-21:00. Shared by the
// rain timeline card and the laundry pickup-time advice below so both read
// from the same hour-by-hour data instead of each re-deriving it.
function buildHourlyRainProbabilities(data) {
  if (!data.hourly || !data.hourly.time) return [];

  const tomorrowDate = data.daily.time[1];
  const hourly = data.hourly;

  const hours = [];
  for (let h = 6; h <= 21; h++) {
    const timeStr = `${tomorrowDate}T${String(h).padStart(2, '0')}:00`;
    const idx = hourly.time.indexOf(timeStr);
    const prob = idx >= 0 ? (hourly.precipitation_probability[idx] ?? 0) : 0;
    hours.push({ h, prob });
  }
  return hours;
}

// If rain becomes likely (>=50%) sometime after 9am, suggest bringing
// laundry in an hour before it starts. Ignores earlier hours since laundry
// wouldn't realistically be hung out before then anyway.
function getLaundryPickupAdvice(hours) {
  const firstRain = hours.find(({ h, prob }) => h >= 9 && prob >= 50);
  if (!firstRain) return null;
  return `${firstRain.h}時から雨の可能性。${firstRain.h - 1}時までに取り込むと安心です`;
}

function renderRainTimeline(data) {
  if (!data.hourly || !data.hourly.time) return '';

  const hours = buildHourlyRainProbabilities(data);

  function barColor(prob) {
    if (prob >= 80) return '#1565c0';
    if (prob >= 60) return '#42a5f5';
    if (prob >= 30) return '#90caf9';
    return 'var(--color-border)';
  }

  const barsHtml = hours.map(({ prob }) => {
    const heightPct = Math.max(prob, 2);
    return `<div class="rain-bar" style="height:${heightPct}%;background:${barColor(prob)};"></div>`;
  }).join('');

  const labelHours = [6, 9, 12, 15, 18, 21];
  const labelsHtml = labelHours.map(h => `<span>${h}</span>`).join('');

  const maxProb = Math.max(...hours.map(h => h.prob));
  let summaryHtml;
  if (maxProb >= 30) {
    const firstRain = hours.find(h => h.prob >= 30);
    summaryHtml = `🌧 ${firstRain.h}時頃から雨の可能性（降水確率${maxProb}%）`;
  } else {
    summaryHtml = '☀️ 明日は雨の心配なし';
  }

  return `
    <div class="rain-timeline-card card">
      <div class="card-title">🌧 降雨タイムライン（明日）</div>
      <div class="rain-timeline-summary">${escapeHtml(summaryHtml)}</div>
      <div class="rain-bars">${barsHtml}</div>
      <div class="rain-labels">${labelsHtml}</div>
    </div>
  `;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildSummary, getWeatherSeverity, buildHourlyRainProbabilities, getLaundryPickupAdvice };
}
