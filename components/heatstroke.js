// Heat stroke alert component

// Australian Bureau of Meteorology's simplified outdoor/shade WBGT
// approximation, using air temperature and relative humidity (via vapor
// pressure). This is still an approximation (real WBGT needs a wet-bulb and
// globe thermometer), but it's meaningfully closer to Japan's Ministry of
// Environment 暑さ指数 than air temperature alone.
function estimateWbgt(tempC, humidityPct) {
  const vaporPressure = (humidityPct / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
  return 0.567 * tempC + 0.393 * vaporPressure + 3.94;
}

// Kids exercising outdoors (club activities, PE) generate more body heat and
// sweat more, so their effective heat stress is higher than the ambient
// reading suggests. Nudging the threshold comparison by a couple of degrees
// makes the alert trigger earlier/more severely on those days.
const ACTIVITY_DAY_BOOST = 2;

function getHeatLevel(maxTemp, humidity, isActivityDay) {
  const boost = isActivityDay ? ACTIVITY_DAY_BOOST : 0;

  if (humidity != null) {
    // WBGT-based thresholds (Japan's Ministry of Environment 暑さ指数 guide).
    const wbgt = estimateWbgt(maxTemp, humidity) + boost;
    if (wbgt >= 31) return { level: 'danger', label: '危険', color: '#b71c1c', icon: '🚨', message: '外での活動は避けてください。室内でも熱中症に注意。' };
    if (wbgt >= 28) return { level: 'severe', label: '厳重警戒', color: '#e65100', icon: '⚠️', message: '激しい運動は避け、こまめに水分補給を。' };
    if (wbgt >= 25) return { level: 'warning', label: '警戒', color: '#f39c12', icon: '💧', message: '運動時は休憩と水分補給を忘れずに。' };
    if (wbgt >= 21) return { level: 'caution', label: '注意', color: '#27ae60', icon: '💡', message: '水筒を持参しましょう。' };
    return null;
  }

  // No humidity data available — fall back to air-temperature-only thresholds.
  const effTemp = maxTemp + boost;
  if (effTemp >= 35) return { level: 'danger', label: '危険', color: '#b71c1c', icon: '🚨', message: '外での活動は避けてください。室内でも熱中症に注意。' };
  if (effTemp >= 31) return { level: 'severe', label: '厳重警戒', color: '#e65100', icon: '⚠️', message: '激しい運動は避け、こまめに水分補給を。' };
  if (effTemp >= 28) return { level: 'warning', label: '警戒', color: '#f39c12', icon: '💧', message: '運動時は休憩と水分補給を忘れずに。' };
  if (effTemp >= 25) return { level: 'caution', label: '注意', color: '#27ae60', icon: '💡', message: '水筒を持参しましょう。' };
  return null; // No alert needed below 25°C
}

function renderHeatstrokeAlert(weatherData, isActivityDay) {
  const daily = weatherData.daily;
  const tomorrowIdx = 1;
  const maxTemp = daily.temperature_2m_max[tomorrowIdx];

  // Evaluate each afternoon temperature with humidity from the same hour.
  let peakTemp = maxTemp;
  let peakHour = null;
  let heat = null;
  if (weatherData.hourly && weatherData.hourly.time) {
    const tomorrowDate = daily.time[tomorrowIdx];
    const afternoonHours = weatherData.hourly.time
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => t.startsWith(tomorrowDate) && parseInt(t.split('T')[1]) >= 10 && parseInt(t.split('T')[1]) <= 18);

    if (afternoonHours.length > 0) {
      const severityRank = { caution: 1, warning: 2, severe: 3, danger: 4 };
      let highestRank = 0;
      afternoonHours.forEach(({ t, i }) => {
        const temperature = Number(weatherData.hourly.temperature_2m[i]);
        if (!Number.isFinite(temperature)) return;

        const humidityValue = weatherData.hourly.relative_humidity_2m?.[i];
        const numericHumidity = Number(humidityValue);
        const humidity = humidityValue != null && Number.isFinite(numericHumidity) &&
          numericHumidity >= 0 && numericHumidity <= 100
          ? numericHumidity
          : null;
        const hourlyHeat = getHeatLevel(temperature, humidity, isActivityDay);
        const rank = hourlyHeat ? severityRank[hourlyHeat.level] : 0;

        if (rank > highestRank) {
          highestRank = rank;
          heat = hourlyHeat;
          peakTemp = Math.round(temperature);
          peakHour = parseInt(t.split('T')[1], 10);
        }
      });
    } else {
      heat = getHeatLevel(maxTemp, null, isActivityDay);
    }
  } else {
    heat = getHeatLevel(maxTemp, null, isActivityDay);
  }

  if (!heat) return '';

  const tips = [];
  if (peakTemp >= 31) {
    tips.push('水筒（多めの水分）');
    tips.push('帽子・日傘');
    tips.push('冷却タオル');
    tips.push('塩分タブレット');
  } else if (peakTemp >= 28) {
    tips.push('水筒');
    tips.push('帽子');
  } else {
    tips.push('水筒');
  }

  const peakHtml = peakHour !== null
    ? `<div class="heat-peak">ピーク：${peakHour}時頃 約${peakTemp}℃</div>`
    : '';

  return `
    <div class="heatstroke-card card" style="border-left: 4px solid ${heat.color};">
      <div class="card-title">${heat.icon} 熱中症アラート</div>
      <div class="heat-level" style="background: ${heat.color}15; color: ${heat.color}; padding: 8px 12px; border-radius: 8px; font-weight: 700; font-size: 1.1rem; margin-bottom: 8px;">
        ${heat.label}（最高${Math.round(maxTemp)}℃）
      </div>
      <p class="heat-message">${heat.message}</p>
      ${peakHtml}
      <div class="heat-tips">
        持ち物：${tips.join('、')}
      </div>
    </div>
  `;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getHeatLevel, estimateWbgt };
}
