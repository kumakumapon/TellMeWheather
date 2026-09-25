// Heat stroke alert component

function getHeatLevel(maxTemp, humidity) {
  // Simplified WBGT approximation (without humidity, use temp-based thresholds)
  // Japan's Ministry of Environment guidelines for children
  if (maxTemp >= 35) return { level: 'danger', label: '危険', color: '#b71c1c', icon: '🚨', message: '外での活動は避けてください。室内でも熱中症に注意。' };
  if (maxTemp >= 31) return { level: 'severe', label: '厳重警戒', color: '#e65100', icon: '⚠️', message: '激しい運動は避け、こまめに水分補給を。' };
  if (maxTemp >= 28) return { level: 'warning', label: '警戒', color: '#f39c12', icon: '💧', message: '運動時は休憩と水分補給を忘れずに。' };
  if (maxTemp >= 25) return { level: 'caution', label: '注意', color: '#27ae60', icon: '💡', message: '水筒を持参しましょう。' };
  return null; // No alert needed below 25°C
}

function renderHeatstrokeAlert(weatherData) {
  const daily = weatherData.daily;
  const tomorrowIdx = 1;
  const maxTemp = daily.temperature_2m_max[tomorrowIdx];

  const heat = getHeatLevel(maxTemp);
  if (!heat) return '';

  // Calculate afternoon peak from hourly data
  let peakTemp = maxTemp;
  let peakHour = null;
  if (weatherData.hourly && weatherData.hourly.time) {
    const tomorrowDate = daily.time[tomorrowIdx];
    const afternoonHours = weatherData.hourly.time
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => t.startsWith(tomorrowDate) && parseInt(t.split('T')[1]) >= 10 && parseInt(t.split('T')[1]) <= 16);

    if (afternoonHours.length > 0) {
      let maxH = afternoonHours[0];
      afternoonHours.forEach(h => {
        if (weatherData.hourly.temperature_2m[h.i] > weatherData.hourly.temperature_2m[maxH.i]) {
          maxH = h;
        }
      });
      peakTemp = Math.round(weatherData.hourly.temperature_2m[maxH.i]);
      peakHour = parseInt(maxH.t.split('T')[1]);
    }
  }

  const tips = [];
  if (maxTemp >= 31) {
    tips.push('水筒（多めの水分）');
    tips.push('帽子・日傘');
    tips.push('冷却タオル');
    tips.push('塩分タブレット');
  } else if (maxTemp >= 28) {
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
  module.exports = { getHeatLevel };
}
