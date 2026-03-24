// Laundry advice component

const STRONG_WIND_THRESHOLD_KMH = 8 * 3.6; // 8m/s in km/h

function getLaundryAdvice(precip, precipProb, wind, settings) {
  const considerPollen = settings.considerPollen ?? false;
  const considerWind = settings.considerWind ?? true;

  let status = 'ok';       // 'ok' | 'caution' | 'ng'
  let label = '外干しOK';
  const comments = [];

  if (precip > 0 || precipProb >= 50) {
    status = 'ng';
    label = '部屋干し推奨';
    comments.push('雨が予想されます');
  } else if (considerWind && wind >= STRONG_WIND_THRESHOLD_KMH) {
    status = 'caution';
    label = '外干し注意';
    comments.push('強風注意（洗濯物が飛ばされる恐れ）');
  }

  if (considerPollen && status !== 'ng') {
    // Simple heuristic: spring months (2-5) or autumn (8-10)
    const month = new Date().getMonth() + 1; // 1-based, but we check tomorrow ~same month
    if (month >= 2 && month <= 5) {
      if (status === 'ok') {
        status = 'caution';
        label = '外干し注意';
      }
      comments.push('花粉が多い季節です。外干し非推奨');
    }
  }

  if (comments.length === 0) {
    comments.push('洗濯日和です！');
  }

  return { status, label, comments };
}

function renderLaundryAdvice(precip, precipProb, wind, settings) {
  const { status, label, comments } = getLaundryAdvice(precip, precipProb, wind, settings);

  const iconMap = {
    ok:      '✅',
    caution: '⚠️',
    ng:      '❌',
  };

  const colorMap = {
    ok:      'status-ok',
    caution: 'status-caution',
    ng:      'status-ng',
  };

  return `
    <div class="laundry-card card">
      <div class="card-title">👕 洗濯アドバイス</div>
      <div class="laundry-status ${colorMap[status]}">
        <span class="laundry-icon">${iconMap[status]}</span>
        <span class="laundry-label">${label}</span>
      </div>
      <ul class="laundry-comments">
        ${comments.map(c => `<li>${c}</li>`).join('')}
      </ul>
    </div>
  `;
}
