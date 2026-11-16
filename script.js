const STORAGE_KEY = 'nod_krai_fatui_player_sheet_v2';

const CLASSES = {
  assassin: { name: 'Ocak Evi Suikastçısı' },
  mage: { name: 'Cicin / Ayna Büyücüsü' },
  vanguard: { name: 'Öncü İnfazcı (Vanguard)' },
  skirmisher: { name: 'Avcı Nişancı (Skirmisher)' }
};

const ELEMENTS = {
  pyro: { label: 'Ateş (Pyro)', icon: '🔥' },
  hydro: { label: 'Su (Hydro)', icon: '💧' },
  cryo: { label: 'Buz (Cryo)', icon: '❄️' },
  electro: { label: 'Elektrik (Electro)', icon: '⚡' },
  anemo: { label: 'Rüzgar (Anemo)', icon: '🌪️' },
  geo: { label: 'Toprak (Geo)', icon: '🪨' },
  dendro: { label: 'Doğa (Dendro)', icon: '🌿' }
};

function getCorruptionSymptom(val) {
  if (val <= 0) {
    return '<strong>Mevcut Aşama: 0 / 10</strong> — Sanrı taşın şu an dengede.';
  }
  return `<strong>Mevcut Aşama: ${val} / 10</strong> — Bu aşamanın üzerindeki etkilerini DM oyun akışında betimleyecektir.`;
}

// Tüm alanlar tamamen boş ve seçilmemiş başlar
function defaultState() {
  return {
    charName: '',
    charClass: '',
    charElement: '',
    charBio: '',
    stats: { str: '', dex: '', int: '', wis: '' },
    hpCurrent: '',
    hpMax: '',
    armorClass: '',
    tempShield: '',
    delusionCharges: 0,
    corruption: 0,
    syringes: [false, false, false],
    weaponName: '',
    weaponHit: '',
    weaponDmg: '',
    sneakActive: false,
    skillName: '',
    skillHit: '',
    skillDmg: '',
    skillDesc: '',
    burstName: '',
    burstMode: '',
    burstDesc: '',
    classPassiveText: '',
    inventory: [],
    questNotes: '',
    rollMode: 'normal'
  };
}

let state = loadState();
let diceHistory = [];

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return Object.assign(defaultState(), JSON.parse(raw));
  } catch (e) {
    return defaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const badge = document.getElementById('saveIndicator');
    badge.textContent = '✓ Otomatik Kaydedildi';
  } catch (e) {}
}

function showToast(msg) {
  const el = document.getElementById('toastMsg');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove('show'), 2500);
}

// Zar Motoru
function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function parseAndRollDamage(formula, doubleDice = false) {
  const clean = String(formula || '1d6').replace(/\s+/g, '');
  const regex = /([+-]?\d*d\d+)|([+-]?\d+)/gi;
  let match;
  let total = 0;
  const parts = [];

  while ((match = regex.exec(clean)) !== null) {
    const token = match[0];
    if (/d/i.test(token)) {
      const sign = token.startsWith('-') ? -1 : 1;
      const unsigned = token.replace(/^[+-]/, '');
      const [cntStr, sideStr] = unsigned.split(/d/i);
      let count = parseInt(cntStr || '1', 10);
      if (doubleDice) count *= 2;
      const sides = parseInt(sideStr, 10);
      const rolls = [];
      for (let i = 0; i < count; i++) {
        const r = rollDie(sides);
        rolls.push(r);
        total += sign * r;
      }
      parts.push(`${sign < 0 ? '-' : ''}${count}d${sides}[${rolls.join(',')}]`);
    } else {
      const bonus = parseInt(token, 10);
      total += bonus;
      parts.push(bonus >= 0 ? `+${bonus}` : `${bonus}`);
    }
  }
  return { total: Math.max(0, total), detail: parts.join(' ').replace(/^\+/, '') };
}

function rollD20Check(title, bonusNum, dmgFormula = null, dmgLabel = 'Hasar') {
  const r1 = rollDie(20);
  const r2 = rollDie(20);
  let chosen = r1;
  let modeNote = `d20(${r1})`;

  if (state.rollMode === 'adv') {
    chosen = Math.max(r1, r2);
    modeNote = `Avantaj[${r1}, ${r2} → ${chosen}]`;
  } else if (state.rollMode === 'dis') {
    chosen = Math.min(r1, r2);
    modeNote = `Dezavantaj[${r1}, ${r2} → ${chosen}]`;
  }

  const isCrit = chosen === 20;
  const isFumble = chosen === 1;
  const total = chosen + bonusNum;
  const signStr = bonusNum >= 0 ? `+ ${bonusNum}` : `- ${Math.abs(bonusNum)}`;

  let dmgHtml = '';
  let histExtra = '';
  if (dmgFormula) {
    const dmgRes = parseAndRollDamage(dmgFormula, isCrit);
    dmgHtml = `<div class="roll-dmg-pill">${isCrit ? '🔥 KRİTİK 2x ZAR! ' : ''}${dmgLabel}: ${dmgRes.total} <span style="opacity:.75;font-weight:400;">(${dmgRes.detail})</span></div>`;
    histExtra = ` | ${dmgLabel}: ${dmgRes.total}`;
  }

  const box = document.getElementById('diceResultBox');
  box.innerHTML = `
    <div class="roll-title">${title}</div>
    <div class="roll-big-total ${isCrit ? 'crit-win' : ''} ${isFumble ? 'crit-fail' : ''}">
      ${total} ${isCrit ? '🌟 DOĞAL 20!' : ''} ${isFumble ? '💀 DOĞAL 1!' : ''}
    </div>
    <div class="roll-Formula">${modeNote} ${signStr}</div>
    ${dmgHtml}
  `;

  diceHistory.unshift({ title, text: `${total}${isCrit ? ' (KRİTİK!)' : ''}${histExtra}` });
  diceHistory = diceHistory.slice(0, 8);
  renderDiceHistory();
}

function renderDiceHistory() {
  const wrap = document.getElementById('diceHistory');
  wrap.innerHTML = diceHistory
    .map(h => `<div class="dice-hist-item"><span>${h.title}</span><strong>${h.text}</strong></div>`)
    .join('');
}

// Arayüz Güncelleme
function renderAll() {
  const elemKey = state.charElement || 'none';
  document.body.setAttribute('data-element', elemKey);
  const elemInfo = ELEMENTS[state.charElement];
  document.getElementById('elementCrest').textContent = elemInfo ? elemInfo.icon : '❖';

  document.getElementById('charName').value = state.charName;
  document.getElementById('charClass').value = state.charClass;
  document.getElementById('charElement').value = state.charElement;
  document.getElementById('charBio').value = state.charBio;

  // Element hapları
  document.querySelectorAll('.elem-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.elem === state.charElement);
  });

  // Nitelikler
  document.getElementById('statStr').value = state.stats.str === '' ? '' : String(state.stats.str);
  document.getElementById('statDex').value = state.stats.dex === '' ? '' : String(state.stats.dex);
  document.getElementById('statInt').value = state.stats.int === '' ? '' : String(state.stats.int);
  document.getElementById('statWis').value = state.stats.wis === '' ? '' : String(state.stats.wis);

  const rawStats = [state.stats.str, state.stats.dex, state.stats.int, state.stats.wis];
  const valBadge = document.getElementById('statValidationBadge');
  if (rawStats.some(v => v === '' || v === null || v === undefined)) {
    const chosenCount = rawStats.filter(v => v !== '' && v !== null && v !== undefined).length;
    valBadge.textContent = chosenCount === 0 ? 'Henüz seçilmedi' : `${chosenCount} / 4 nitelik seçildi`;
    valBadge.className = 'stat-validation neutral';
  } else {
    const nums = rawStats.map(v => Number(v)).sort((a, b) => b - a);
    const isStandard = nums[0] === 3 && nums[1] === 2 && nums[2] === 1 && nums[3] === 0;
    if (isStandard) {
      valBadge.textContent = '✓ +3, +2, +1, 0 Dengeli Dağıtıldı';
      valBadge.className = 'stat-validation valid';
    } else {
      valBadge.textContent = `Dağılım: ${nums.map(v => (v >= 0 ? '+' + v : v)).join(', ')}`;
      valBadge.className = 'stat-validation warn';
    }
  }

  // Can, Zırh, Kalkan, İnisiyatif
  document.getElementById('hpCurrent').value = state.hpCurrent === '' ? '' : state.hpCurrent;
  document.getElementById('hpMax').value = state.hpMax === '' ? '' : state.hpMax;
  document.getElementById('armorClass').value = state.armorClass === '' ? '' : state.armorClass;
  document.getElementById('tempShield').value = state.tempShield === '' ? '' : state.tempShield;

  if (state.stats.dex === '' || state.stats.dex === null || state.stats.dex === undefined) {
    document.getElementById('initDisplay').textContent = '—';
  } else {
    const dx = Number(state.stats.dex);
    document.getElementById('initDisplay').textContent = dx >= 0 ? `+${dx}` : `${dx}`;
  }

  const hpBar = document.getElementById('hpBarInner');
  const hpTag = document.getElementById('hpStatusTag');
  const hasHp = state.hpCurrent !== '' && state.hpMax !== '' && Number(state.hpMax) > 0;
  if (!hasHp) {
    hpBar.style.width = '0%';
    hpTag.textContent = 'Girilmedi';
    hpTag.style.color = '#9ba3be';
  } else {
    const cur = Number(state.hpCurrent);
    const mx = Math.max(1, Number(state.hpMax));
    const pct = Math.max(0, Math.min(100, Math.round((cur / mx) * 100)));
    hpBar.style.width = `${pct}%`;
    if (cur <= 0) {
      hpTag.textContent = '💀 0 HP (Düştü!)';
      hpTag.style.color = '#ff6b7a';
      hpBar.style.background = '#d91e36';
    } else if (pct <= 35) {
      hpTag.textContent = '⚠️ Ağır Yaralı';
      hpTag.style.color = '#f5b942';
      hpBar.style.background = '#e0533c';
    } else {
      hpTag.textContent = 'Sağlam';
      hpTag.style.color = '#3dd68c';
      hpBar.style.background = 'linear-gradient(90deg, #27a868, #3dd68c)';
    }
  }

  // Sanrı Yükü Kristalleri
  document.getElementById('delusionHeaderIcon').textContent = elemInfo ? elemInfo.icon : '❖';
  document.getElementById('delusionElemLabel').textContent = elemInfo ? `(${elemInfo.label})` : '(Element Seçilmedi)';
  document.getElementById('delusionCountText').textContent = `${state.delusionCharges} / 4`;
  document.querySelectorAll('.gem-slot').forEach((slot, idx) => {
    slot.classList.toggle('active', idx < state.delusionCharges);
  });

  // Karanlık İz
  document.getElementById('corruptionCountText').textContent = `${state.corruption} / 10`;
  document.querySelectorAll('.corrupt-box').forEach(box => {
    const v = parseInt(box.dataset.corruptVal, 10);
    box.classList.toggle('active', v <= state.corruption);
  });
  document.getElementById('corruptionSymptomBox').innerHTML = getCorruptionSymptom(state.corruption);

  // Sınıf Özel Kontrolleri
  document.getElementById('syringePanel').classList.toggle('hidden', state.charClass !== 'skirmisher');
  document.querySelectorAll('.syringe-btn').forEach((btn, idx) => {
    const avail = Boolean(state.syringes[idx]);
    btn.classList.toggle('active', avail);
    btn.textContent = avail ? `💉 Şırınga ${idx + 1} (Dolu)` : `💉 Şırınga ${idx + 1} (Boş)`;
  });
  document.getElementById('assassinSneakWrap').classList.toggle('hidden', state.charClass !== 'assassin');
  document.getElementById('chkSneakAttack').checked = Boolean(state.sneakActive);

  // Yetenek Alanları
  document.getElementById('weaponName').value = state.weaponName;
  document.getElementById('weaponHit').value = state.weaponHit;
  document.getElementById('weaponDmg').value = state.weaponDmg;
  document.getElementById('skillName').value = state.skillName;
  document.getElementById('skillHit').value = state.skillHit;
  document.getElementById('skillDmg').value = state.skillDmg;
  document.getElementById('skillDesc').value = state.skillDesc;
  document.getElementById('burstName').value = state.burstName;
  document.getElementById('burstMode').value = state.burstMode;
  document.getElementById('burstDesc').value = state.burstDesc;
  document.getElementById('classPassiveText').value = state.classPassiveText;
  document.getElementById('questNotes').value = state.questNotes;

  // Zar Modu
  document.querySelectorAll('.mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === state.rollMode);
  });

  renderInventory();
}

function renderInventory() {
  const list = document.getElementById('inventoryList');
  if (!state.inventory.length) {
    list.innerHTML = '<li class="inv-item" style="color:#8b93ad;">Envanterin şu an boş. Yukarıdan eşya ekleyebilirsin.</li>';
    return;
  }
  list.innerHTML = state.inventory
    .map(
      (item, idx) => `
      <li class="inv-item">
        <span class="inv-name">${escapeHtml(item.name)}</span>
        <div class="inv-controls">
          <button type="button" data-inv-act="dec" data-idx="${idx}">-</button>
          <span class="inv-qty">${item.qty}</span>
          <button type="button" data-inv-act="inc" data-idx="${idx}">+</button>
          <button type="button" data-inv-act="del" data-idx="${idx}" title="Sil" style="color:#ff7b88;">✕</button>
        </div>
      </li>
    `
    )
    .join('');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getCorruptionDamageBonus() {
  if (state.corruption >= 5) return 2;
  if (state.corruption >= 3) return 1;
  return 0;
}

// Event Bağlantıları
document.getElementById('charName').addEventListener('input', e => {
  state.charName = e.target.value;
  saveState();
});

// Sınıf seçildiğinde diğer alanları otomatik doldurmaz — oyuncu kendi değerlerini sıfırdan girer
document.getElementById('charClass').addEventListener('change', e => {
  state.charClass = e.target.value;
  saveState();
  renderAll();
});

function setElement(elemKey) {
  state.charElement = elemKey;
  saveState();
  renderAll();
}

document.getElementById('charElement').addEventListener('change', e => setElement(e.target.value));
document.getElementById('elementPills').addEventListener('click', e => {
  const btn = e.target.closest('.elem-pill');
  if (!btn) return;
  const clicked = btn.dataset.elem;
  setElement(state.charElement === clicked ? '' : clicked);
});

document.getElementById('charBio').addEventListener('input', e => {
  state.charBio = e.target.value;
  saveState();
});

// Nitelikler
['Str', 'Dex', 'Int', 'Wis'].forEach(k => {
  const el = document.getElementById('stat' + k);
  el.addEventListener('change', e => {
    const val = e.target.value;
    state.stats[k.toLowerCase()] = val === '' ? '' : parseInt(val, 10);
    saveState();
    renderAll();
  });
});

document.querySelectorAll('[data-roll-stat]').forEach(btn => {
  btn.addEventListener('click', () => {
    const sel = document.getElementById(btn.dataset.rollStat);
    let bonus = sel.value === '' ? 0 : (parseInt(sel.value, 10) || 0);
    let label = sel.dataset.statLabel;
    if (btn.dataset.rollStat === 'statWis' && state.corruption >= 5) {
      bonus -= 1;
      label += ' (Aşınma -1)';
    }
    rollD20Check(`${label} Kontrolü`, bonus);
  });
});

// Can & Kalkan
document.getElementById('hpCurrent').addEventListener('input', e => {
  const v = e.target.value;
  state.hpCurrent = v === '' ? '' : Math.max(0, parseInt(v, 10) || 0);
  saveState();
  renderAll();
});
document.getElementById('hpMax').addEventListener('input', e => {
  const v = e.target.value;
  state.hpMax = v === '' ? '' : Math.max(1, parseInt(v, 10) || 1);
  saveState();
  renderAll();
});
document.querySelectorAll('[data-hp-delta]').forEach(btn => {
  btn.addEventListener('click', () => {
    const delta = parseInt(btn.dataset.hpDelta, 10);
    let cur = Number(state.hpCurrent) || 0;
    const mx = Number(state.hpMax) || 999;
    let sh = Number(state.tempShield) || 0;

    if (delta < 0 && sh > 0) {
      const absorb = Math.min(sh, Math.abs(delta));
      sh -= absorb;
      state.tempShield = sh;
      const rem = Math.abs(delta) - absorb;
      cur = Math.max(0, cur - rem);
    } else {
      cur = Math.max(0, Math.min(mx, cur + delta));
    }
    state.hpCurrent = cur;
    saveState();
    renderAll();
  });
});
document.getElementById('btnFillHp').addEventListener('click', () => {
  if (state.hpMax === '' || Number(state.hpMax) <= 0) {
    showToast('Önce Maksimum Can (HP) değerini gir!');
    return;
  }
  state.hpCurrent = Number(state.hpMax);
  saveState();
  renderAll();
});

document.getElementById('armorClass').addEventListener('input', e => {
  const v = e.target.value;
  state.armorClass = v === '' ? '' : Math.max(1, parseInt(v, 10) || 1);
  saveState();
});
document.getElementById('tempShield').addEventListener('input', e => {
  const v = e.target.value;
  state.tempShield = v === '' ? '' : Math.max(0, parseInt(v, 10) || 0);
  saveState();
});
document.getElementById('btnShieldMinus').addEventListener('click', () => {
  state.tempShield = Math.max(0, (Number(state.tempShield) || 0) - 1);
  saveState();
  renderAll();
});
document.getElementById('btnShieldPlus').addEventListener('click', () => {
  state.tempShield = (Number(state.tempShield) || 0) + 1;
  saveState();
  renderAll();
});
document.getElementById('btnCrystalShield').addEventListener('click', () => {
  const res = parseAndRollDamage('1d8+2');
  state.tempShield = res.total;
  saveState();
  renderAll();
  document.getElementById('diceResultBox').innerHTML = `
    <div class="roll-title">💠 Geçici Kalkan Zarı</div>
    <div class="roll-big-total" style="color:var(--shield-color);">+${res.total} Kalkan</div>
    <div class="roll-Formula">${res.detail} (Geçici Kalkan kutuna eklendi)</div>
  `;
});

document.getElementById('btnRollInit').addEventListener('click', () => {
  const dexBonus = state.stats.dex === '' ? 0 : (Number(state.stats.dex) || 0);
  rollD20Check('⚡ İnisiyatif (Savaş Sırası)', dexBonus);
});

// Dinlenme Butonları
document.getElementById('btnShortRest').addEventListener('click', () => {
  state.delusionCharges = Math.min(4, state.delusionCharges + 2);
  saveState();
  renderAll();
  showToast('Kısa Mola: +2 Sanrı Yükü yenilendi!');
});

document.getElementById('btnFullRest').addEventListener('click', () => {
  if (state.hpMax !== '' && Number(state.hpMax) > 0) {
    state.hpCurrent = Number(state.hpMax);
  }
  state.delusionCharges = 4;
  saveState();
  renderAll();
  showToast('Tam Yenilenme: Can ve 4 Sanrı Yükü dolduruldu!');
});

// Sanrı Yükü Kristalleri (Tıklayarak Ekle/Çıkar)
document.getElementById('delusionGems').addEventListener('click', e => {
  const slot = e.target.closest('.gem-slot');
  if (!slot) return;
  const idx = parseInt(slot.dataset.gemIndex, 10);
  state.delusionCharges = state.delusionCharges === idx ? idx - 1 : idx;
  saveState();
  renderAll();
});
document.getElementById('btnChargeMinus').addEventListener('click', () => {
  state.delusionCharges = Math.max(0, state.delusionCharges - 1);
  saveState();
  renderAll();
});
document.getElementById('btnChargePlus').addEventListener('click', () => {
  state.delusionCharges = Math.min(4, state.delusionCharges + 1);
  saveState();
  renderAll();
});

// Sanrı Aşırı Yükleme (Overdrive)
document.getElementById('btnOverdrive').addEventListener('click', () => {
  const selfDmg = rollDie(4);
  if (state.hpCurrent !== '') {
    state.hpCurrent = Math.max(0, Number(state.hpCurrent) - selfDmg);
  }
  state.corruption = Math.min(10, state.corruption + 1);
  const bonusDmg = parseAndRollDamage('2d6');
  saveState();
  renderAll();

  document.getElementById('diceResultBox').innerHTML = `
    <div class="roll-title">⚠️ SANRI AŞIRI YÜKLEME (OVERDRIVE)!</div>
    <div class="roll-big-total" style="color:#df80ff;">+${bonusDmg.total} Ekstra Hasar</div>
    <div class="roll-Formula">Saldırını <strong>AVANTAJLI</strong> at! (2d6: ${bonusDmg.detail})</div>
    <div class="roll-dmg-pill" style="border-color:#ff6b7a;color:#ffb3bc;">Bedel: -${selfDmg} Öz Hasar (1d4) ve +1 Karanlık İz uygulandı!</div>
  `;
  showToast(`Overdrive! -${selfDmg} Can ve +1 Karanlık İz işlendi.`);
});

// Karanlık İz Kutuları (Tıklayarak Ekle/Çıkar)
document.getElementById('corruptionBoxes').addEventListener('click', e => {
  const box = e.target.closest('.corrupt-box');
  if (!box) return;
  const val = parseInt(box.dataset.corruptVal, 10);
  state.corruption = state.corruption === val ? val - 1 : val;
  saveState();
  renderAll();
});
document.getElementById('btnCorruptMinus').addEventListener('click', () => {
  state.corruption = Math.max(0, state.corruption - 1);
  saveState();
  renderAll();
});
document.getElementById('btnCorruptPlus').addEventListener('click', () => {
  state.corruption = Math.min(10, state.corruption + 1);
  saveState();
  renderAll();
});
document.getElementById('btnCorruptClear').addEventListener('click', () => {
  state.corruption = 0;
  saveState();
  renderAll();
  showToast('Karanlık İz sıfırlandı!');
});

// Avcı Nişancı Şırıngaları
document.querySelectorAll('.syringe-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const idx = parseInt(btn.dataset.syringe, 10);
    state.syringes[idx] = !state.syringes[idx];
    saveState();
    renderAll();
  });
});
document.getElementById('btnUseSyringeHeal').addEventListener('click', () => {
  const availIdx = state.syringes.findIndex(Boolean);
  if (availIdx === -1) {
    showToast('Önce dolu bir şırınga işaretlemelisin!');
    return;
  }
  state.syringes[availIdx] = false;
  const healRes = parseAndRollDamage('1d8+2');
  const penalty = state.corruption >= 3 ? 1 : 0;
  const finalHeal = Math.max(1, healRes.total - penalty);
  if (state.hpCurrent !== '') {
    const mx = Number(state.hpMax) || 999;
    state.hpCurrent = Math.min(mx, Number(state.hpCurrent) + finalHeal);
  }
  saveState();
  renderAll();
  document.getElementById('diceResultBox').innerHTML = `
    <div class="roll-title">💉 Fatui Adrenalin Şırıngası</div>
    <div class="roll-big-total" style="color:#3dd68c;">+${finalHeal} Can</div>
    <div class="roll-Formula">${healRes.detail}${penalty ? ' - 1' : ''}</div>
  `;
});

// Silah ve Yetenek Alanları
const textBindings = [
  ['weaponName', 'weaponName'],
  ['weaponHit', 'weaponHit'],
  ['weaponDmg', 'weaponDmg'],
  ['skillName', 'skillName'],
  ['skillHit', 'skillHit'],
  ['skillDmg', 'skillDmg'],
  ['skillDesc', 'skillDesc'],
  ['burstName', 'burstName'],
  ['burstMode', 'burstMode'],
  ['burstDesc', 'burstDesc'],
  ['classPassiveText', 'classPassiveText'],
  ['questNotes', 'questNotes']
];

textBindings.forEach(([domId, key]) => {
  const el = document.getElementById(domId);
  el.addEventListener('input', e => {
    state[key] = e.target.value;
    saveState();
  });
  el.addEventListener('change', e => {
    state[key] = e.target.value;
    saveState();
  });
});

document.getElementById('chkSneakAttack').addEventListener('change', e => {
  state.sneakActive = e.target.checked;
  saveState();
});

// Saldırı & Yetenek Zarları
document.getElementById('btnRollWeapon').addEventListener('click', () => {
  const hitBonus = parseInt(state.weaponHit, 10) || 0;
  let dmg = state.weaponDmg.trim() || '1d8';
  if (state.charClass === 'assassin' && state.sneakActive) {
    dmg += '+1d6';
  }
  rollD20Check(`🗡️ ${state.weaponName || 'Silah Saldırısı'}`, hitBonus, dmg, 'Hasar');
});

document.getElementById('btnRollSkill').addEventListener('click', () => {
  const hitBonus = parseInt(state.skillHit, 10) || 0;
  const corruptBonus = getCorruptionDamageBonus();
  let dmg = state.skillDmg.trim() || '1d8';
  if (corruptBonus > 0) dmg += `+${corruptBonus}`;
  const elem = ELEMENTS[state.charElement];
  const title = `${elem ? elem.icon : '⚡'} ${state.skillName || 'Elemental Beceri'}`;
  rollD20Check(title, hitBonus, dmg, elem ? `${elem.label} Hasarı` : 'Element Hasarı');
});

document.getElementById('btnRollBurst').addEventListener('click', () => {
  if (!state.burstMode) {
    showToast('Önce Patlama Türünü seçmelisin!');
    return;
  }
  if (state.delusionCharges < 2) {
    showToast('Yetersiz Sanrı Yükü! (Patlama için en az 2 yük işaretlemelisin!)');
    return;
  }
  state.delusionCharges -= 2;
  saveState();
  renderAll();

  const corruptBonus = getCorruptionDamageBonus();
  const title = `💥 ${state.burstName || 'Sanrı Patlaması'} (-2 Yük)`;

  if (state.burstMode === 'support') {
    const res = parseAndRollDamage('2d6+2');
    document.getElementById('diceResultBox').innerHTML = `
      <div class="roll-title">${title}</div>
      <div class="roll-big-total" style="color:#3dd68c;">+${res.total} Şifa / Kalkan</div>
      <div class="roll-Formula">Tüm takım arkadaşlarına uygulanır (${res.detail})</div>
    `;
  } else {
    let formula = state.burstMode === 'single' ? '3d8+3' : '2d6+3';
    if (corruptBonus > 0) formula += `+${corruptBonus}`;
    const hitBonus = parseInt(state.skillHit, 10) || 0;
    rollD20Check(title, hitBonus, formula, state.burstMode === 'single' ? 'Tekil Patlama Hasarı' : 'Alan Patlama Hasarı');
  }
});

// Zar Modu ve Hızlı Zarlar
document.getElementById('rollModeGroup').addEventListener('click', e => {
  const btn = e.target.closest('.mode-btn');
  if (!btn) return;
  state.rollMode = btn.dataset.mode;
  saveState();
  renderAll();
});

document.querySelectorAll('[data-quick-die]').forEach(btn => {
  btn.addEventListener('click', () => {
    const sides = parseInt(btn.dataset.quickDie, 10);
    if (sides === 20) {
      rollD20Check('🎲 Serbest d20 Zarı', 0);
    } else {
      const r = rollDie(sides);
      document.getElementById('diceResultBox').innerHTML = `
        <div class="roll-title">🎲 Serbest 1d${sides}</div>
        <div class="roll-big-total">${r}</div>
      `;
      diceHistory.unshift({ title: `1d${sides}`, text: `${r}` });
      diceHistory = diceHistory.slice(0, 8);
      renderDiceHistory();
    }
  });
});

// Envanter Ekle/Çıkar
function addInventoryItem() {
  const inp = document.getElementById('newItemInput');
  const name = inp.value.trim();
  if (!name) return;
  state.inventory.push({ name, qty: 1 });
  inp.value = '';
  saveState();
  renderInventory();
}
document.getElementById('btnAddItem').addEventListener('click', addInventoryItem);
document.getElementById('newItemInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') addInventoryItem();
});

document.getElementById('inventoryList').addEventListener('click', e => {
  const btn = e.target.closest('button[data-inv-act]');
  if (!btn) return;
  const idx = parseInt(btn.dataset.idx, 10);
  const act = btn.dataset.invAct;
  if (!state.inventory[idx]) return;
  if (act === 'inc') state.inventory[idx].qty += 1;
  if (act === 'dec') state.inventory[idx].qty = Math.max(0, state.inventory[idx].qty - 1);
  if (act === 'del') state.inventory.splice(idx, 1);
  saveState();
  renderInventory();
});

// Discord Özeti Kopyala
document.getElementById('btnCopyDiscord').addEventListener('click', () => {
  const cls = CLASSES[state.charClass];
  const elem = ELEMENTS[state.charElement];
  const fmt = v => (v === '' ? '—' : (Number(v) >= 0 ? `+${v}` : `${v}`));
  const chargesBar = '❖'.repeat(state.delusionCharges) + '◇'.repeat(4 - state.delusionCharges);
  const text = [
    `**❄️ ${state.charName || 'İsimsiz Fatui Ajanı'}** — *${cls ? cls.name : 'Birim Seçilmedi'}*`,
    `${elem ? elem.icon : '❖'} **Sanrı:** ${elem ? elem.label : 'Seçilmedi'} | ❤️ **Can:** \`${state.hpCurrent !== '' ? state.hpCurrent : '—'}/${state.hpMax !== '' ? state.hpMax : '—'}\`${Number(state.tempShield) > 0 ? ` (+${state.tempShield} Kalkan)` : ''} | 🛡️ **AC:** \`${state.armorClass !== '' ? state.armorClass : '—'}\``,
    `📊 **Nitelikler:** GÜÇ \`${fmt(state.stats.str)}\` | ÇEV \`${fmt(state.stats.dex)}\` | ZEK \`${fmt(state.stats.int)}\` | İRD \`${fmt(state.stats.wis)}\``,
    `💎 **Sanrı Yükü:** \`[${chargesBar}] (${state.delusionCharges}/4)\` | 🌑 **Karanlık İz:** \`${state.corruption}/10\``,
    `🗡️ **Silah:** ${state.weaponName || '—'} (\`${state.weaponHit || '—'}\` | \`${state.weaponDmg || '—'}\`)`,
    `⚡ **Beceri:** ${state.skillName || '—'} (\`${state.skillDmg || '—'}\`) | 💥 **Patlama:** ${state.burstName || '—'}`
  ].join('\n');

  navigator.clipboard.writeText(text).then(() => {
    showToast('📋 Discord karakter özeti panoya kopyalandı!');
  });
});

// DM'e Gönderilecek Kodu Kopyala
document.getElementById('btnCopyDmCode').addEventListener('click', () => {
  const payload = {
    name: state.charName || 'Ajan',
    cls: state.charClass || 'assassin',
    elem: state.charElement || 'pyro',
    hp: Number(state.hpCurrent) || 0,
    hpMax: Number(state.hpMax) || 1,
    ac: Number(state.armorClass) || 10,
    shield: Number(state.tempShield) || 0,
    charges: state.delusionCharges,
    corruption: state.corruption,
    dex: Number(state.stats.dex) || 0,
    wis: Number(state.stats.wis) || 0,
    weaponHit: state.weaponHit || '',
    weaponDmg: state.weaponDmg || '',
    skillHit: state.skillHit || '',
    skillDmg: state.skillDmg || '',
    burstMode: state.burstMode || ''
  };
  const encoded = 'FATUI1:' + btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  navigator.clipboard.writeText(encoded).then(() => {
    showToast('🔗 DM Kodu kopyalandı! Discord\'dan DM\'e gönderebilirsin.');
  });
});

// JSON İndir / Yükle
document.getElementById('btnExportJson').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  const safeName = (state.charName || 'fatui_ajani').replace(/[^a-z0-9ğüşıöç_-]/gi, '_');
  a.href = URL.createObjectURL(blob);
  a.download = `${safeName}_karakter.json`;
  a.click();
});

document.getElementById('inputImportJson').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const parsed = JSON.parse(ev.target.result);
      state = Object.assign(defaultState(), parsed);
      saveState();
      renderAll();
      showToast('📂 Karakter dosyası başarıyla yüklendi!');
    } catch (err) {
      showToast('Dosya okunamadı!');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

// İki Aşamalı Güvenli Form Sıfırlama (Hem Üst Hem Alt Buton İçin)
let resetArmed = false;
let resetTimer = null;

function handleResetClick(btnEl) {
  const topBtn = document.getElementById('btnResetSheetTop');
  const botBtn = document.getElementById('btnResetSheetBottom');

  if (!resetArmed) {
    resetArmed = true;
    topBtn.textContent = '⚠️ Onaylamak İçin Tekrar Tıkla';
    botBtn.textContent = '⚠️ Emin misin? Sıfırlamak İçin Tekrar Tıkla';
    showToast('Sıfırlamayı onaylamak için butona tekrar tıkla.');
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      resetArmed = false;
      topBtn.textContent = '🔄 Formu Sıfırla';
      botBtn.textContent = '🗑️ Tüm Karakter Kağıdını Sıfırla';
    }, 4000);
    return;
  }

  resetArmed = false;
  clearTimeout(resetTimer);
  topBtn.textContent = '🔄 Formu Sıfırla';
  botBtn.textContent = '🗑️ Tüm Karakter Kağıdını Sıfırla';

  state = defaultState();
  diceHistory = [];
  localStorage.removeItem(STORAGE_KEY);
  saveState();
  renderAll();
  renderDiceHistory();
  document.getElementById('diceResultBox').innerHTML =
    '<div class="dice-placeholder">Bir yeteneğe veya aşağıdaki zarlara tıkla!</div>';
  showToast('✓ Karakter kağıdındaki tüm alanlar sıfırlandı!');
}

document.getElementById('btnResetSheetTop').addEventListener('click', e => handleResetClick(e.currentTarget));
document.getElementById('btnResetSheetBottom').addEventListener('click', e => handleResetClick(e.currentTarget));

renderAll();
