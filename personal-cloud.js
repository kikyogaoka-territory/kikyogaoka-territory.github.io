/* Private encrypted snapshots. Sharing invitations and this recovery card are separate capabilities. */
window.PersonalCloud=(()=>{
 const service='https://kikyogaoka-companions.balmy-titan-5521.chatgpt.site/api/personal-backup',KEY='personal-cloud-state',ROLLBACK='personal-before-restore';
 const $=id=>document.getElementById(id);let state=null,busy=false,restoring=false,conflict=false,timer=null,candidate=null,candidateGeneration=0,started=false;
 function say(message){const el=$('personalCloudStatus');if(el){el.hidden=false;el.textContent=message;}if($('cloudDetail'))$('cloudDetail').textContent=message;if($('cloudKeepLocal'))$('cloudKeepLocal').hidden=!conflict;if($('cloudSetup'))$('cloudSetup').hidden=!state||!!state.cardKept;}
 function read(){const raw=localStorage.getItem(KEY);if(!raw)return null;const s=JSON.parse(raw);if(s.version!==1||!Number.isSafeInteger(s.revision)||s.revision<0)throw Error('保存先の設定を確認してください。');BackupCrypto.parseCode(s.secret);return s;}
 function persist(){localStorage.setItem(KEY,JSON.stringify(state));}
 function snapshot(){const b=App.backup();App.validateBackup(b);return b;}
 async function request(identity,body=null,revision=null,meta=false){
  const url=service+(revision!==null?'?revision='+revision:meta?'?meta=1':'');
  const r=await fetch(url,{method:body?'POST':'GET',headers:{'X-Backup-Id':identity.id,'X-Backup-Key':identity.auth,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(15000)});
  const data=await r.json();if(!r.ok)throw Object.assign(Error(data.error||'保存先に接続できません。'),{status:r.status});return data;
 }
 function schedule(){if(!started||restoring)return;clearTimeout(timer);say(navigator.onLine===false?'この端末に保存しました · 通信が戻ると自動バックアップします':'この端末に保存しました · 自動バックアップ中…');timer=setTimeout(()=>void sync(),1800);}
 async function sync(){
  if(!started||busy||restoring)return;if(navigator.onLine===false){say('この端末に保存済み · 通信待ち');return;}busy=true;
  try{
   state=read();if(!state)throw Error('保存先の設定を確認してください。');const identity=await BackupCrypto.identity(state.secret);let head;
   try{head=await request(identity,null,null,true);}catch(e){if(e.status!==404)throw e;head={revision:0};}
   if(state.pending&&head.operation===state.pending.body.operation){state.revision=head.revision;state.ack=state.pending.hash;state.savedAt=head.created;delete state.pending;persist();}
   const current=snapshot(),hash=await BackupCrypto.fingerprint(current.records);
   if(head.revision!==state.revision){
    if(head.revision>0){const remote=await request(identity);const data=await BackupCrypto.decrypt(state.secret,remote.envelope);App.validateBackup(data);if(await BackupCrypto.fingerprint(data.records)===hash){state.revision=remote.latest;state.ack=hash;state.savedAt=remote.created;delete state.pending;persist();}else{conflict=true;say('別の端末の保存があります · 今の記録は保持しています。「記録を守る」で確認してください。');return;}}
    else{conflict=true;say('保存先を確認できません · この端末の記録は保持しています。');return;}
   }
   conflict=false;if(hash===state.ack&&!state.pending){say('✓ この端末と自動バックアップに保存済み');return;}
   if(!state.pending){state.pending={hash,body:{base:state.revision,operation:crypto.randomUUID(),envelope:await BackupCrypto.encrypt(state.secret,current)}};persist();}
   const sent=state.pending,result=await request(identity,sent.body);state.revision=result.revision;state.ack=sent.hash;state.savedAt=result.created;delete state.pending;persist();
   if(await BackupCrypto.fingerprint(snapshot().records)!==state.ack){schedule();}else say('✓ この端末と自動バックアップに保存済み');
  }catch(error){if(error.status===409){conflict=true;say('別の端末で保存されています · 上書きせず保持しています。「記録を守る」で確認してください。');}else say('この端末に保存済み · 自動バックアップは確認待ちです。通信後に再試行します。');}
  finally{busy=false;}
 }
 function sharing(){for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key.startsWith('inline-share:')){try{const s=JSON.parse(localStorage.getItem(key));if(s&&!s.ended&&(!s.expires||s.expires>Date.now()))return true;}catch{}}}return false;}
 function initialize(){if(initialized)return;initialized=true;const dialog=$('cloudDialog');$('cloudClose').onclick=()=>dialog.close();$('cloudRetry').onclick=()=>void sync();$('cloudCardShow').onclick=()=>void card();$('cloudReadCode').onclick=()=>void loadCandidate();$('cloudRestore').onclick=()=>void restoreCandidate();$('cloudKeepLocal').onclick=()=>void keepLocal();$('cloudCardKept').onclick=()=>{if(!confirm('復元カードを、担当者と一緒に保管できましたか？\nスマホが壊れたときには、このカードが必要です。'))return;try{state=read();state.cardKept=true;persist();if($('cloudSetup'))$('cloudSetup').hidden=true;say('復元カードの保管を確認しました。普段は記録するだけで使えます。');}catch(e){say(e.message);}};$('cloudOwnHistory').onclick=()=>{try{$('cloudCode').value='KIKYO1-'+read().secret;void loadCandidate();}catch(e){say(e.message);}};$('cloudVersion').onchange=()=>void loadCandidate(Number($('cloudVersion').value));$('cloudUndoRestore').onclick=()=>void undoRestore();}
 let initialized=false;
 function open(){initialize();const d=$('cloudDialog');if(!d.open)d.showModal();$('cloudUndoRestore').hidden=!localStorage.getItem(ROLLBACK);$('cloudCard').hidden=true;$('cloudHistory').hidden=true;$('cloudRestore').hidden=true;$('cloudPreview').textContent='';candidate=null;candidateGeneration++;}
 async function card(){
  try{state=read();if(!state)throw Error('保存先の準備を確認してください。');$('cloudCard').hidden=false;const code='KIKYO1-'+state.secret;$('cloudCardCode').textContent=code;
   if(!window.RecoveryQR)await new Promise((ok,fail)=>{const script=document.createElement('script');script.src='recovery-qr.js';script.onload=ok;script.onerror=()=>fail(Error('復元カードを表示できませんでした。通信を確認してください。'));document.head.appendChild(script);});
   const url=new URL('?t=home',location.href);url.hash=new URLSearchParams({restore:code}).toString();await RecoveryQR.toCanvas($('cloudCardQR'),url.href,{width:250,margin:4,errorCorrectionLevel:'M'});
  }catch(e){say(e.message);}
 }
 async function loadCandidate(revision=null){
  const mine=++candidateGeneration;candidate=null;$('cloudRestore').hidden=true;
  try{
   const secret=BackupCrypto.parseCode($('cloudCode').value),identity=await BackupCrypto.identity(secret),remote=await request(identity,null,revision),backup=await BackupCrypto.decrypt(secret,remote.envelope);App.validateBackup(backup);
   if(mine!==candidateGeneration)return;candidate={secret,remote,backup};const select=$('cloudVersion');if(revision===null){select.replaceChildren();for(const item of remote.history){const option=document.createElement('option');option.value=item.revision;option.textContent=new Date(item.created).toLocaleString('ja-JP');select.appendChild(option);}select.value=remote.revision;}
   $('cloudHistory').hidden=false;$('cloudRestore').hidden=false;$('cloudPreview').textContent=new Date(remote.created).toLocaleString('ja-JP')+' の保存記録（'+Object.keys(backup.records).length+'項目）。まだ今の記録は変更していません。';
  }catch(e){if(mine!==candidateGeneration)return;candidate=null;$('cloudRestore').hidden=true;$('cloudPreview').textContent=e.status===404?'この復元カードの保存記録が見つかりません。':e.message;}
 }
 async function replace(backup,next){
  const before=snapshot(),old=read();if(!old)throw Error('今の保存先を確認してください。');
  // Persist the previous device snapshot and the new identity in the same rollback-capable write batch.
  const previous={created:Date.now(),state:old,envelope:await BackupCrypto.encrypt(old.secret,before)};
  App.replaceBackup(backup,before.records,{[ROLLBACK]:JSON.stringify(previous),[KEY]:JSON.stringify(next)});state=next;location.reload();
 }
 async function restoreCandidate(){
  if(!candidate)return;if(busy){say('保存が終わってから、もう一度お試しください。');return;}if(sharing()){say('同行者との共有を終了してから復元してください。');return;}
  try{if(BackupCrypto.parseCode($('cloudCode').value)!==candidate.secret)throw Error();}catch{candidate=null;$('cloudRestore').hidden=true;say('復元コードが変わっています。もう一度「保存記録を確認」を押してください。');return;}
  if(!confirm('選んだ保存記録に戻しますか？\n今の端末の記録は、復元前の記録として残します。\n同行者の共有用QRではなく、本人専用の復元カードです。'))return;
  restoring=true;try{await replace(candidate.backup,{version:1,secret:candidate.secret,revision:candidate.remote.latest,ack:null,cardKept:true});}catch(e){restoring=false;say('復元できませんでした。元の記録は保持しています。'+e.message);}
 }
 async function undoRestore(){
  if(busy||sharing()){say('保存や同行者との共有が終わってから操作してください。');return;}
  try{const old=JSON.parse(localStorage.getItem(ROLLBACK)||'null');if(!old)throw Error('復元前の記録がありません。');const backup=await BackupCrypto.decrypt(old.state.secret,old.envelope);App.validateBackup(backup);if(!confirm('この端末で復元する前の記録に戻しますか？今の記録も保持します。'))return;restoring=true;await replace(backup,{...old.state,pending:undefined,ack:null});}catch(e){restoring=false;say(e.message);}
 }
 async function keepLocal(){
  if(busy||restoring){say('保存が終わってから操作してください。');return;}
  if(!confirm('この端末の記録を、新しい保存記録として残しますか？\n今の端末の記録は変えません。保存先の以前の記録は履歴から確認できます。'))return;
  restoring=true;try{state=read();const identity=await BackupCrypto.identity(state.secret),head=await request(identity,null,null,true);snapshot();state.revision=head.revision;state.ack=null;delete state.pending;persist();conflict=false;restoring=false;await sync();}catch(e){restoring=false;say('保存できませんでした。端末の記録は保持しています。'+e.message);}
 }
 function mount(){
  if(started)return;
  if(!globalThis.crypto?.subtle){say('この端末に保存しています · 自動バックアップの準備を確認してください。');return;}
  try{state=read();if(!state){state={version:1,secret:BackupCrypto.secret(),revision:0,ack:null};persist();}snapshot();started=true;}
  catch{say('保存設定を確認できません · 元の記録は保持しています。担当者に確認してください。');return;}
  window.addEventListener('personal-records-saved',schedule);window.addEventListener('online',()=>void sync());window.addEventListener('focus',()=>void sync());window.addEventListener('storage',()=>void sync());document.addEventListener('visibilitychange',()=>{if(!document.hidden)void sync();});setInterval(()=>{if(!document.hidden)void sync();},30000);
  say('この端末に保存済み · 自動バックアップを確認しています…');
  const params=new URLSearchParams(location.hash.slice(1));if(params.has('restore')){open();$('cloudCode').value=params.get('restore');$('cloudCode').closest('details').open=true;history.replaceState(null,'',location.pathname+location.search);say('本人専用の復元カードを読み取りました。「保存記録を確認」を押してください。');}
  void sync();
 }
 return {mount,open,sync,openCard:()=>{open();void card();},hasConflict:()=>conflict};
})();
