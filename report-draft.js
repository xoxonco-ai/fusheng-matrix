// Private local checkpoints, separated by account, case, version and input hash.
// Clearing this site's browser data removes these drafts. No automatic publication.
window.ReportDraft = (() => {
  const open = () => new Promise((resolve, reject) => {
    const r = indexedDB.open('fusheng-report-drafts', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('drafts');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(new Error('無法開啟草稿儲存，尚未開始生成'));
  });
  async function storage(key, value) {
    const db = await open();
    try { return await new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', value === undefined ? 'readonly' : 'readwrite');
      const store = tx.objectStore('drafts');
      const req = value === undefined ? store.get(key) : store.put(value, key);
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = tx.onabort = () => reject(new Error('草稿儲存失敗，已停止後續生成；請勿關閉此頁'));
    }); } finally { db.close(); }
  }
  async function run({payload, userId, caseId, request, progress}) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
    const hash = Array.from(new Uint8Array(bytes), n=>n.toString(16).padStart(2,'0')).join('');
    const key = ['chapter-v1',userId,caseId,payload.version,hash].join(':');
    if (!navigator.locks) throw new Error('此瀏覽器不支援安全續接，請使用新版 Chrome');
    return navigator.locks.request(key, {ifAvailable:true}, async lock => {
      if (!lock) throw new Error('另一個分頁正在生成同一份報告，請勿重複執行');
      const draft = await storage(key) || {parts:[],total:null};
      await storage(key,draft); // Check write access before incurring model costs.
      let chunksThisRun=0;
      while (draft.total === null || draft.parts.length < draft.total) {
        if(draft.validationError)throw new Error(draft.validationError+'；半成品已保存，請勿重複生成');
        if(chunksThisRun++>=40)throw new Error('本輪已達安全請求上限，草稿已保存，可稍後續接');
        const step = draft.parts.length;
        progress(step,draft.total);
        const data = await request({...payload,protocol:'chapter-v2',step,partial:draft.partial||'',previous:draft.parts.slice(1).join('\n\n').slice(-2500)});
        if(data.protocol!=='chapter-v2'||typeof data.complete!=='boolean'||data.step!==step||!data.text||!Number.isInteger(data.totalSteps)||data.totalSteps<2||data.totalSteps>20||draft.total!==null&&data.totalSteps!==draft.total) throw new Error('章節回覆不完整，先前草稿已保留');
        draft.total=data.totalSteps;
        if(data.complete){draft.parts.push(data.text);draft.partial='';}
        else {draft.partial=data.text;draft.validationError=data.validationError||'';}
        await storage(key,draft); // Must persist before requesting the next chapter.
      }
      return {excerpt:draft.parts[0],full:draft.parts.slice(1).join('\n\n')};
    });
  }
  return {run};
})();
