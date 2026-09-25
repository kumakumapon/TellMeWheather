// Clothes advice component

// tempSensitivity: 'cold' | 'normal' | 'hot'
function getClothingAdvice(maxTemp, tempSensitivity, precipProb, uvIndex, hourlyTemps) {
  const offset = tempSensitivity === 'cold' ? -2 : tempSensitivity === 'hot' ? +2 : 0;
  const adjusted = maxTemp + offset;

  let outfit = '';
  let items = [];

  if (adjusted <= 10) {
    outfit = 'コート＋長袖＋インナー';
    items = ['コート', '手袋', 'マフラー'];
  } else if (adjusted <= 15) {
    outfit = '長袖＋上着';
    items = ['ジャケット', '上着'];
  } else if (adjusted <= 20) {
    outfit = '長袖 or 半袖＋薄手パーカー';
    items = ['薄手パーカー'];
  } else if (adjusted <= 24) {
    outfit = '半袖＋薄手上着';
    items = ['薄手の羽織り'];
  } else {
    outfit = '半袖';
    items = [];
  }

  // 降水確率 30% 以上なら傘を追加
  if ((precipProb ?? 0) >= 30) {
    items.push('折り畳み傘');
  }

  // UV 指数に応じて日焼け対策グッズを追加
  if ((uvIndex ?? 0) >= 6) {
    items.push('帽子');
  }
  if ((uvIndex ?? 0) >= 3) {
    items.push('日焼け止め');
  }

  const notes = [];
  if (hourlyTemps) {
    const diff = hourlyTemps.afternoon - hourlyTemps.morning;
    if (diff >= 8) {
      notes.push('朝と昼の寒暖差が大きいです。脱ぎ着しやすい服装を');
    } else if (hourlyTemps.morning <= 15 && hourlyTemps.afternoon >= 22) {
      notes.push('朝は肌寒く昼は暖かくなります。上着を持たせて');
    }
    if (hourlyTemps.morning <= 10) {
      notes.push('朝の登校時は冷え込みます。防寒対策を');
    }
    if (hourlyTemps.afternoon >= 30) {
      notes.push('午後は猛暑です。水筒・帽子を忘れずに');
    }
  }
  return { outfit, items, notes };
}

function gradeLabel(grade) {
  const grades = {
    '小1': '小学1年生', '小2': '小学2年生', '小3': '小学3年生',
    '小4': '小学4年生', '小5': '小学5年生', '小6': '小学6年生',
    '中1': '中学1年生', '中2': '中学2年生', '中3': '中学3年生',
  };
  return grades[grade] || grade;
}

function sensitivityLabel(s) {
  return s === 'cold' ? '寒がり' : s === 'hot' ? '暑がり' : '普通';
}

function renderKidsClothes(kids, maxTemp, precipProb, uvIndex, hourlyTemps) {
  if (!kids || kids.length === 0) {
    return `
      <div class="clothes-card card">
        <div class="card-title">👶 子どもの服装アドバイス</div>
        <p class="no-kids">設定画面でお子さんの情報を登録してください。</p>
      </div>
    `;
  }

  const cards = kids.map(kid => {
    const name = escapeHtml(kid.name || '子ども');
    const advice = getClothingAdvice(maxTemp, kid.sensitivity, precipProb, uvIndex, hourlyTemps);
    const { outfit, items } = advice;
    const itemsHtml = items.length > 0
      ? `<div class="kid-items">持ち物：${items.join('、')}</div>`
      : '';
    const notesHtml = (advice.notes && advice.notes.length > 0)
      ? `<div class="kid-notes">${advice.notes.map(n => `<span class="kid-note">💡 ${n}</span>`).join('')}</div>`
      : '';
    return `
      <div class="kid-card">
        <div class="kid-name">${name}
          <span class="kid-meta">（${gradeLabel(kid.grade)} ／ ${sensitivityLabel(kid.sensitivity)}）</span>
        </div>
        <div class="kid-outfit">👕 ${outfit}</div>
        ${itemsHtml}
        ${notesHtml}
      </div>
    `;
  }).join('');

  return `
    <div class="clothes-card card">
      <div class="card-title">👶 子どもの服装アドバイス</div>
      ${cards}
    </div>
  `;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getClothingAdvice, gradeLabel, sensitivityLabel };
}
