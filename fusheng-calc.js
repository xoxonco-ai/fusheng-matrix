/* 浮生矩陣｜共用命理計算層 — fusheng-calc.js
   =========================================================================
   paipan.html（單人盤）與 hepan.html（合盤）原本各自帶一份計算層，約 14 項
   重複。兩份一致時看不出問題，風險在改動：只改一邊，單人盤與合盤就會對同一
   個人算出不同的盤，而且不會拋錯。使用者通常不會同時買兩種報告去對照，所以
   這種漂移極難被發現。

   演算法只改這裡。不要把這些函式複製回頁面裡就地展開。

   依賴：astronomy-engine（天文）、opencc-js（選用，簡繁轉換）。
   載入順序：必須在上述 CDN 之後、頁面自己的 inline <script> 之前。
   注意：classic script 的頂層 const 與 inline script 共用同一個全域詞法環境，
   所以頁面裡不可再宣告同名變數，否則整個 inline 區塊會因重複宣告而不執行。
   ========================================================================= */

/* ===== 簡繁轉換 ===== */
const s2t=(window.OpenCC)?OpenCC.Converter({from:'cn',to:'tw'}):(x=>x);

/* ===== 摘要用格式化（固定繁中、零位小數，不隨介面語言變動） ===== */
const _SG=['牡羊','金牛','雙子','巨蟹','獅子','處女','天秤','天蠍','射手','摩羯','水瓶','雙魚'];
const _fmt=l=>{l=((l%360)+360)%360;return _SG[Math.floor(l/30)]+(l%30).toFixed(0)+'°'};
const _CNM={head:'頭腦',ajna:'邏輯',throat:'喉嚨',g:'G中心',heart:'意志力',spleen:'直覺',sacral:'薦骨',solar:'情緒',root:'根部'};

/* ===== 人類圖對照 ===== */
const GATE_ORDER=[41,19,13,49,30,55,37,63,22,36,25,17,21,51,42,3,27,24,2,23,8,20,16,35,45,12,15,52,39,53,62,56,31,33,7,4,29,59,40,64,47,6,46,18,48,57,32,50,28,44,1,43,14,34,9,5,26,11,10,58,38,54,61,60];
const GATE_CENTER={head:[64,61,63],ajna:[47,24,4,17,11,43],throat:[62,23,56,16,20,35,12,45,33,8,31],g:[7,1,13,10,25,46,2,15],heart:[21,40,26,51],spleen:[48,57,44,50,32,28,18],sacral:[5,14,29,59,9,3,42,27,34],solar:[6,37,22,36,30,55,49],root:[53,60,52,19,39,41,58,38,54]};
const MOTORS=['sacral','heart','solar','root'];
const CHANNELS=[[1,8],[2,14],[3,60],[4,63],[5,15],[6,59],[7,31],[9,52],[10,20],[10,34],[10,57],[11,56],[16,48],[12,22],[13,33],[17,62],[18,58],[19,49],[20,34],[20,57],[21,45],[23,43],[24,61],[25,51],[26,44],[27,50],[28,38],[29,46],[30,41],[32,54],[34,57],[35,36],[37,40],[39,55],[42,53],[47,64]];
const gco=g=>{for(const c in GATE_CENTER)if(GATE_CENTER[c].includes(g))return c};
const lonToGate=l=>{let d=((l-302)%360+360)%360;let i=Math.floor(d/5.625);let w=d-i*5.625;return{gate:GATE_ORDER[i],line:Math.floor(w/0.9375)+1}};

/* ===== 天文 ===== */
function trueNodeLon(date){const e1=Astronomy.Ecliptic(Astronomy.GeoVector('Moon',date,true)).vec;const e2=Astronomy.Ecliptic(Astronomy.GeoVector('Moon',new Date(date.getTime()+43200),true)).vec;const r=e1,v={x:e2.x-e1.x,y:e2.y-e1.y,z:e2.z-e1.z};const h={x:r.y*v.z-r.z*v.y,y:r.z*v.x-r.x*v.z,z:r.x*v.y-r.y*v.x};return((Math.atan2(h.x,-h.y)*180/Math.PI)%360+360)%360}
function planetLon(b,d){if(b==='Earth')return(Astronomy.Ecliptic(Astronomy.GeoVector('Sun',d,true)).elon+180)%360;if(b==='NNode')return trueNodeLon(d);if(b==='SNode')return(trueNodeLon(d)+180)%360;return Astronomy.Ecliptic(Astronomy.GeoVector(b,d,true)).elon}
const sunLon=d=>Astronomy.Ecliptic(Astronomy.GeoVector('Sun',d,true)).elon;
const designTime=utc=>{                                            // 出生前太陽黃經退 88° 的時刻
  const tg=(sunLon(utc)-88+360)%360;
  let lo=new Date(utc-95*864e5),hi=new Date(utc-80*864e5);
  for(let i=0;i<60;i++){let m=new Date((+lo+ +hi)/2);let df=((sunLon(m)-tg+540)%360)-180;if(df>0)hi=m;else lo=m}
  return new Date((+lo+ +hi)/2);
};

/* ===== 紫微 ===== */
const ziweiHourIndex=h=>(h===23)?12:Math.floor((h+1)/2);

/* ===== 八字五行對照 ===== */
const STEM_WUXING={甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'};
const BRANCH_WUXING={子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水'};

/* ===== 關卡年訊號 ===== */
const saturnReturn=utc=>{
  const _natSat=Astronomy.Ecliptic(Astronomy.GeoVector('Saturn',utc,true)).elon;
  let _best=null;
  for(let age=27;age<=32;age+=0.05){const _dt=new Date(utc.getTime()+age*365.25*864e5);let _dd=((Astronomy.Ecliptic(Astronomy.GeoVector('Saturn',_dt,true)).elon-_natSat+540)%360)-180;if(_best===null||Math.abs(_dd)<Math.abs(_best.d)){_best={age,d:_dd,year:_dt.getUTCFullYear()};}}
  return _best;
};
const chongYears=(dayZhi,Y)=>{
  const _ZHI=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  const _di=_ZHI.indexOf(dayZhi);const _opp=(_di+6)%12;
  const _chong=[];for(let y=Y+14;y<=Y+55;y++){if((((y-4)%12)+12)%12===_opp)_chong.push(y);}
  return{years:_chong,opp:_ZHI[_opp]};   // opp = 對沖地支，paipan 的文案要用
};
