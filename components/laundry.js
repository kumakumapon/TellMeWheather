// Laundry advice component

const STRONG_WIND_THRESHOLD_KMH = 8 * 3.6; // 8m/s in km/h

function getLaundryAdvice(precip, precipProb, wind, settings, month, pickupAdvice) {
  const considerPollen = settings.considerPollen ?? false;
  const considerWind = settings.considerWind ?? true;

  let status = 'ok';       // 'ok' | 'caution' | 'ng'
  let label = '外干しOK';
  const comments = [];

  if (precip > 0 || precipProb >= 50) {
    status = 'ng';
    label = '部屋干し推奨';
    comments.push(precip > 0
      ? `降水量${precip}mmの予報です`
      : `降水確率${Math.round(precipProb)}%のため、雨に備えてください`);
  } else if (considerWind && wind >= STRONG_WIND_THRESHOLD_KMH) {
    status = 'caution';
    label = '外干し注意';
    comments.push(`最大風速${Math.round(wind)}km/hの予報です（洗濯物が飛ばされる恐れ）`);
  }

  if (considerPollen && status !== 'ng') {
    // Simple heuristic: spring months (2-5) or autumn (8-10).
    // `month` is the month of the day being judged (1-12), passed in by the
    // caller — using "today"'s month here was wrong for any day other than
    // today, and skipped autumn entirely despite the comment/README saying
    // both seasons apply.
    const m = month ?? new Date().getMonth() + 1;
    if ((m >= 2 && m <= 5) || (m >= 8 && m <= 10)) {
      if (status === 'ok') {
        status = 'caution';
        label = '外干し注意';
      }
      comments.push('花粉が多い季節です。外干し非推奨');
    }
  }

  // Only worth mentioning if laundry is actually going outside today.
  if (status !== 'ng' && pickupAdvice) {
    comments.push(pickupAdvice);
  }

  if (comments.length === 0) {
    comments.push('洗濯日和です！');
  }

  return { status, label, comments };
}

function renderLaundryAdvice(precip, precipProb, wind, settings, month, pickupAdvice) {
  const { status, label, comments } = getLaundryAdvice(precip, precipProb, wind, settings, month, pickupAdvice);

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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getLaundryAdvice, STRONG_WIND_THRESHOLD_KMH };
}
