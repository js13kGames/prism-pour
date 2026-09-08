let registrationPromise=null,installPrompt=null;
const timeout=(promise,ms)=>Promise.race([promise,new Promise(resolve=>setTimeout(()=>resolve(null),ms))]);
if('serviceWorker' in navigator){
 registrationPromise=navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).catch(()=>null);
}
export function downloadUpdate(){registrationPromise?.then(r=>r?.update()).catch(()=>{});}
export async function updateBetweenLevels(){
 if(!navigator.onLine||!registrationPromise)return false;
 const reg=await timeout(registrationPromise,1500);if(!reg)return false;
 await timeout(reg.update().catch(()=>null),1800);
 if(reg.installing){await timeout(new Promise(resolve=>{const w=reg.installing;w.addEventListener('statechange',()=>{if(['installed','redundant'].includes(w.state))resolve(true)});}),6000);}
 const waiting=reg.waiting;if(!waiting)return false;
 // Never reload on a controller change during play. Only this boundary opts in.
 return new Promise(resolve=>{
  let done=false;
  const finish=()=>{if(done)return;done=true;clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',finish);resolve(true);location.reload()};
  const timer=setTimeout(()=>{if(done)return;done=true;navigator.serviceWorker.removeEventListener('controllerchange',finish);resolve(false)},3000);
  navigator.serviceWorker.addEventListener('controllerchange',finish);
  waiting.postMessage({type:'ACTIVATE_UPDATE'});
 });
}
const install=document.querySelector('#install');
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;install.textContent='Install Prism Pour';install.hidden=false;});
addEventListener('appinstalled',()=>{installPrompt=null;install.hidden=true;});
install.onclick=async()=>{
 if(installPrompt){const p=installPrompt;installPrompt=null;await p.prompt();const result=await p.userChoice;if(result.outcome==='accepted')install.hidden=true;return;}
 document.querySelector('#install-help').hidden=false;
};
if(matchMedia('(display-mode: standalone)').matches||navigator.standalone)install.hidden=true;
