// 浮生矩陣 — 命盤摘要補充資料（給報告引擎用）
// 在原本的 chartSummary() 之外，多提供三段實算資料：
//   【紫微十二宮】每一宮的主星／輔星／大限區間（主題書：家庭、財富、天職要用）
//   【八字大運】每一步大運的起始年、干支與十神（人生節奏表要用）
//   【流年】今年起四年的干支、十神、流年命宮落點、流年四化落宮（接下來三年要用）
// 全部由 lunar-javascript 與 iztro 的排盤結果直接取值，不做任何吉凶判斷。
// 任何一段取值失敗就略過該段，不影響原本的摘要。
(function () {
  const GAN = '甲乙丙丁戊己庚辛壬癸';
  const ZHI = '子丑寅卯辰巳午未申酉戌亥';
  // iztro 以簡體輸出宮名；這裡固定對照成繁體，不依賴轉換器
  const PALACES = [
    ['命宫', '命宮'], ['兄弟', '兄弟宮'], ['夫妻', '夫妻宮'], ['子女', '子女宮'],
    ['财帛', '財帛宮'], ['疾厄', '疾厄宮'], ['迁移', '遷移宮'], ['仆役', '僕役宮'],
    ['官禄', '官祿宮'], ['田宅', '田宅宮'], ['福德', '福德宮'], ['父母', '父母宮'],
  ];
  // 十干四化（祿、權、科、忌）
  const HUA = {
    甲: ['廉貞', '破軍', '武曲', '太陽'], 乙: ['天機', '天梁', '紫微', '太陰'],
    丙: ['天同', '天機', '文昌', '廉貞'], 丁: ['太陰', '天同', '天機', '巨門'],
    戊: ['貪狼', '太陰', '右弼', '天機'], 己: ['武曲', '貪狼', '天梁', '文曲'],
    庚: ['太陽', '武曲', '太陰', '天同'], 辛: ['巨門', '太陽', '文曲', '文昌'],
    壬: ['天梁', '紫微', '左輔', '武曲'], 癸: ['破軍', '巨門', '太陰', '貪狼'],
  };
  const HUA_NAME = ['祿', '權', '科', '忌'];

  // 某天干相對於日主的十神
  function shiShen(dayGan, gan) {
    const d = GAN.indexOf(dayGan), o = GAN.indexOf(gan);
    if (d < 0 || o < 0) return '';
    const same = d % 2 === o % 2;
    const rel = ((Math.floor(o / 2) - Math.floor(d / 2)) % 5 + 5) % 5;
    return [
      same ? '比肩' : '劫財',   // 同我
      same ? '食神' : '傷官',   // 我生
      same ? '偏財' : '正財',   // 我剋
      same ? '七殺' : '正官',   // 剋我
      same ? '偏印' : '正印',   // 生我
    ][rel];
  }
  const yearGan = (y) => GAN[((y - 4) % 10 + 10) % 10];
  const yearZhi = (y) => ZHI[((y - 4) % 12 + 12) % 12];

  window.chartExtras = function (o) {
    const out = [];
    const s2t = o.s2t || ((x) => x);
    const nowY = (o.now || new Date()).getFullYear();
    const nominalAge = nowY - o.birthYear + 1; // 虛歲（紫微大限以虛歲計）
    const zw = o.zw, ec = o.ec;
    const palTw = (cn) => (PALACES.find((p) => p[0] === cn) || [cn, s2t(cn)])[1];
    const starTxt = (s) => s2t(s.name) + (s.brightness ? s2t(s.brightness) : '') + (s.mutagen ? '化' + s2t(s.mutagen) : '');

    /* ---------- 紫微十二宮 ---------- */
    try {
      if (zw && zw.palaces) {
        const rows = [];
        let current = '';
        PALACES.forEach(([cn, tw]) => {
          const p = zw.palaces.find((x) => x.name === cn);
          if (!p) return;
          const major = (p.majorStars || []).map(starTxt).join('、') || '空宮';
          const minor = (p.minorStars || []).map(starTxt).join('、');
          const r = p.decadal && p.decadal.range;
          if (r && nominalAge >= r[0] && nominalAge <= r[1]) current = `${tw}（${r[0]}~${r[1]}歲）`;
          rows.push(`${tw}(${p.heavenlyStem || ''}${p.earthlyBranch || ''})：主星 ${major}${minor ? '｜輔星 ' + minor : ''}${r ? `｜大限 ${r[0]}~${r[1]}歲` : ''}${p.isBodyPalace ? '｜身宮在此' : ''}`);
        });
        if (rows.length) {
          out.push(
            `【紫微十二宮】${o.unknown ? '（出生時間不確定，十二宮僅供參考）' : ''}${rows.join('；')}` +
            (current ? `　→ 目前（虛歲約${nominalAge}）走的大限在：${current}` : '')
          );
        }
      }
    } catch (e) { /* 略過 */ }

    /* ---------- 八字大運 ---------- */
    try {
      if (ec) {
        const dayGan = ec.getDayGan();
        const dy = ec.getYun(o.gender === '男' ? 1 : 0).getDaYun().slice(1, 9);
        let cur = -1;
        dy.forEach((d, i) => { if (d.getStartYear() <= nowY) cur = i; });
        const rows = dy.map((d, i) => {
          const gz = d.getGanZhi();
          return `${d.getStartYear()}年起(約${d.getStartAge()}歲) ${gz}〔天干十神：${shiShen(dayGan, gz[0])}〕${i === cur ? '←目前' : ''}`;
        });
        if (rows.length) out.push(`【八字大運｜每步十年】日主 ${dayGan}；${rows.join('；')}`);
      }
    } catch (e) { /* 略過 */ }

    /* ---------- 流年（今年起四年） ---------- */
    try {
      if (ec) {
        const dayGan = ec.getDayGan(), dayZhi = ec.getDayZhi();
        const rows = [];
        for (let y = nowY; y <= nowY + 3; y++) {
          const g = yearGan(y), z = yearZhi(y);
          let t = `${y}年 ${g}${z}（虛歲${y - o.birthYear + 1}）：天干十神 ${shiShen(dayGan, g)}`;
          if ((ZHI.indexOf(z) - ZHI.indexOf(dayZhi) + 12) % 12 === 6) t += `｜流年沖日支(${z}沖${dayZhi})`;
          if (zw && zw.palaces && !o.unknown) {
            const lp = zw.palaces.find((p) => p.earthlyBranch === z);
            if (lp) t += `｜流年命宮落在本命${palTw(lp.name)}`;
            const hua = HUA[g].map((star, i) => {
              const hit = zw.palaces.find((p) => (p.majorStars || []).concat(p.minorStars || []).some((s) => s2t(s.name) === star));
              return hit ? `${star}化${HUA_NAME[i]}入${palTw(hit.name)}` : '';
            }).filter(Boolean);
            if (hua.length) t += `｜流年四化：${hua.join('、')}`;
          }
          rows.push(t);
        }
        out.push(`【流年｜只供寫「節奏與課題」，不可用來預言事件】${rows.join('；')}`);
      }
    } catch (e) { /* 略過 */ }

    return out;
  };
})();
