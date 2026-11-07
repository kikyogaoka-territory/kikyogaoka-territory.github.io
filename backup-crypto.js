/* Encryption and authorization use separate keys. The recovery secret never leaves this device. */
window.BackupCrypto=(()=>{
 const encoder=new TextEncoder(),decoder=new TextDecoder();
 const encode=bytes=>{let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);};
 const decode=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
 const digest=async text=>new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(text)));
 const hex=bytes=>[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
 const canonical=bytes=>encode(bytes).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 function secret(){return canonical(crypto.getRandomValues(new Uint8Array(32)));}
 function parseCode(value){
  let text=String(value).trim();if(/^https?:/.test(text)){const url=new URL(text);if(!['https://kikyogaoka-territory.github.io','https://nomuracomcom-ops.github.io',location.origin].includes(url.origin))throw Error('本人専用の復元カードを確認してください。');text=new URLSearchParams(url.hash.slice(1)).get('restore')||'';}
  text=text.replace(/\s/g,'').replace(/^KIKYO1-/,'');if(!/^[A-Za-z0-9_-]{43}$/.test(text))throw Error('復元コードを確認してください。');
  const bytes=decode(text.replace(/-/g,'+').replace(/_/g,'/')+'=');if(bytes.length!==32||canonical(bytes)!==text)throw Error('復元コードを確認してください。');return text;
 }
 async function identity(value){const s=parseCode(value),auth=hex(await digest('kikyo-backup-auth-v1:'+s));return {secret:s,auth,id:hex(await digest('personal-backup:'+auth))};}
 async function key(s){return crypto.subtle.importKey('raw',await digest('kikyo-backup-encryption-v1:'+parseCode(s)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
 async function encrypt(s,backup){const raw=encoder.encode(JSON.stringify(backup));if(raw.length>1900000)throw Error('記録が大きいため、担当者に保存方法を確認してください。');const iv=crypto.getRandomValues(new Uint8Array(12)),data=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode('kikyo-encrypted-backup:1')},await key(s),raw));return {format:'kikyo-encrypted-backup',version:1,iv:encode(iv),data:encode(data)};}
 async function decrypt(s,envelope){if(!envelope||envelope.format!=='kikyo-encrypted-backup'||envelope.version!==1||typeof envelope.iv!=='string'||typeof envelope.data!=='string'||envelope.data.length>2700000)throw Error('保存された記録を確認できません。');try{return JSON.parse(decoder.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(envelope.iv),additionalData:encoder.encode('kikyo-encrypted-backup:1')},await key(s),decode(envelope.data))));}catch{throw Error('この復元カードでは記録を開けません。カードを確認してください。');}}
 async function fingerprint(records){return hex(await digest(JSON.stringify(Object.keys(records).sort().map(k=>[k,records[k]]))));}
 return {secret,parseCode,identity,encrypt,decrypt,fingerprint};
})();
