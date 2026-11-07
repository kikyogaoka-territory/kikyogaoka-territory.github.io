/* Decode on this device; always navigate within the app's existing storage origin. */
window.QRReader=(()=>{
 const $=id=>document.getElementById(id),uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
 let decoder=null,stream=null,timer=null,generation=0,pending=null,initialized=false;
 function resolve(text){
  let source;try{source=new URL(String(text).trim());}catch{throw Error('区域地図のQRコード、または共有リンクを選んでください。');}
  const current=new URL(location.href);
  const approved=source.origin==='https://kikyogaoka-territory.github.io'&&/^\/(?:index\.html)?$/.test(source.pathname)
   ||source.origin==='https://nomuracomcom-ops.github.io'&&/^\/territory\/(?:index\.html)?$/.test(source.pathname)
   ||source.origin===current.origin&&source.pathname===current.pathname;
  if(!approved||source.username||source.password)throw Error('このQRコードは区域地図のものではありません。');
  for(const name of ['t','s','k'])if(source.searchParams.getAll(name).length>1)throw Error('QRコードのリンクを確認してください。');
  const ref=source.searchParams.get('t'),territory=Territory.get(ref);
  if(!territory)throw Error('この区域はまだアプリに登録されていません。担当者に確認してください。');
  const id=source.searchParams.get('s'),token=source.searchParams.get('k'),sharing=id!==null||token!==null;
  if(sharing&&(!uuid.test(id||'')||token?.length!==72||!uuid.test(token.slice(0,36))||!uuid.test(token.slice(36))))throw Error('共有リンクを確認してください。');
  const target=new URL(Territory.url(ref),current);
  if(sharing){target.searchParams.set('s',id);target.searchParams.set('k',token);}
  return {url:target.href,name:'区域 '+Territory.number(ref)+' '+territory.name,sharing};
 }
 function ensureDecoder(){
  if(window.jsQR)return Promise.resolve(window.jsQR);
  if(!decoder)decoder=new Promise((ok,fail)=>{const script=document.createElement('script');script.src='qr-decoder.js';script.onload=()=>window.jsQR?ok(window.jsQR):fail(Error('QR読み取りを準備できませんでした。'));script.onerror=()=>{script.remove();decoder=null;fail(Error('QR読み取りを準備できませんでした。通信を確認して開き直してください。'));};document.head.appendChild(script);});
  return decoder;
 }
 function stopCamera(){generation++;if(timer!==null){clearTimeout(timer);timer=null;}if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}const video=$('qrVideo');if(video){video.pause();video.srcObject=null;}}
 function say(text){$('qrStatus').textContent=text;}
 function accept(text){
  const result=resolve(text);pending=result;stopCamera();$('qrVideo').hidden=true;
  $('qrResult').textContent=result.name+(result.sharing?' · 同行者の共有に参加します':'');
  $('qrResult').hidden=false;$('qrGo').hidden=false;say('読み取れました。区域を確認して開いてください。');return result;
 }
 function decode(source,width,height,max){
  const scale=Math.min(1,max/Math.max(width,height)),canvas=$('qrCanvas');canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
  const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(source,0,0,canvas.width,canvas.height);
  const pixels=context.getImageData(0,0,canvas.width,canvas.height);return window.jsQR(pixels.data,pixels.width,pixels.height,{inversionAttempts:'attemptBoth'});
 }
 async function camera(){
  stopCamera();const mine=generation;pending=null;$('qrGo').hidden=true;$('qrResult').hidden=true;$('qrVideo').hidden=false;say('カメラを準備しています。許可の確認が出たら「許可」を選んでください。');
  try{
   await ensureDecoder();if(mine!==generation)return;
   if(!navigator.mediaDevices?.getUserMedia)throw Error('この端末ではカメラを開けません。下の「QRの写真を選ぶ」を使ってください。');
   const next=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
   if(mine!==generation){next.getTracks().forEach(t=>t.stop());return;}
   stream=next;const video=$('qrVideo');video.srcObject=next;await video.play();if(mine!==generation)return;say('枠の中に区域または共有のQRコードを映してください。');
   const scan=()=>{if(mine!==generation)return;try{if(video.readyState>=2){const code=decode(video,video.videoWidth,video.videoHeight,1000);if(code){accept(code.data);return;}}}catch(error){say(error.message||'QRコードを読み取れませんでした。');}timer=setTimeout(scan,250);};scan();
  }catch(error){if(mine!==generation)return;stopCamera();$('qrVideo').hidden=true;say(error.name==='NotAllowedError'?'カメラが許可されていません。「QRの写真を選ぶ」か「共有リンクから開く」を使えます。':error.message||'カメラを開けませんでした。QRの写真からも読み取れます。');}
 }
 async function photo(file){
  if(!file)return;stopCamera();const mine=generation;let url;
  try{
   pending=null;$('qrGo').hidden=true;$('qrResult').hidden=true;$('qrVideo').hidden=true;say('写真のQRコードを読み取っています…');await ensureDecoder();if(mine!==generation)return;
   url=URL.createObjectURL(file);const image=new Image();await new Promise((ok,fail)=>{image.onload=ok;image.onerror=()=>fail(Error('写真を読み込めませんでした。別の写真を選んでください。'));image.src=url;});
   if(mine!==generation)return;const code=decode(image,image.naturalWidth,image.naturalHeight,2200);if(!code)throw Error('QRコードが見つかりませんでした。大きく、はっきり写った写真を選んでください。');accept(code.data);
  }catch(error){if(mine===generation)say(error.message||'写真を読み取れませんでした。');}finally{if(url)URL.revokeObjectURL(url);}
 }
 function init(){
  if(initialized)return;initialized=true;const dialog=$('qrReader');
  $('qrClose').onclick=()=>dialog.close();dialog.addEventListener('close',stopCamera);dialog.addEventListener('cancel',stopCamera);
  $('qrRetry').onclick=camera;$('qrChoose').onclick=()=>{$('qrPhoto').value='';$('qrPhoto').click();};$('qrPhoto').onchange=e=>photo(e.target.files[0]);
  $('qrPasteOpen').onclick=()=>{try{accept($('qrLink').value);}catch(error){say(error.message);}};
  $('qrGo').onclick=()=>{if(pending){const url=pending.url;stopCamera();location.assign(url);}};
  window.addEventListener('pagehide',stopCamera);document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera();});
 }
 function open(){init();const dialog=$('qrReader');$('qrLink').value='';if(!dialog.open)dialog.showModal();void camera();}
 return {open,resolve,stop:stopCamera};
})();
