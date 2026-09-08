import{downloadUpdate,updateBetweenLevels}from'./pwa.js';
import{generate,clone,complete,won,move,colorCount,MAX_LEVEL}from'./engine.js';
const $=s=>document.querySelector(s),colors=['#ff9fbe','#00e5dc','#9b59f5','#ffe13b','#69bfff','#b2ed36','#ff8824','#f5f1e8','#ed3545','#139b56','#354dcc','#ef35bb'],names=['rose','aqua','violet','gold','blue','lime','orange','pearl','ruby','jade','indigo','magenta'];
const icons={undo:'<path d="M9 5 3 11l6 6M3 11h11a7 7 0 0 1 0 14" transform="translate(1 -3)"/>',restart:'<path d="M20 10a8 8 0 1 1-5-6M15 1v5h5"/>',extra:'<path d="M12 4v16M4 12h16"/>',sound:'<path d="m11 4-5 4H3v8h3l5 4ZM15 8q5 4 0 8M18 4q9 8 0 16"/>',mute:'<path d="m11 4-5 4H3v8h3l5 4ZM16 9l6 6m0-6-6 6"/>'};const icon=n=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[n]}</svg>`;['undo','restart','extra'].forEach(n=>$('#'+n+' .circle').innerHTML=icon(n));
let level=1,board=[],history=[],selected=-1,moves=0,sound=false,extra=false,audio;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let startBoard=null, replayMoves=[];
let unlocked=1,allUnlocked=false,completed=new Set(),sessions={},levelPage=0;
const validLevel=n=>Number.isInteger(n)&&n>=1&&n<=MAX_LEVEL;
function validBoard(b,l){
  if(!Array.isArray(b)||b.length<6||b.length>14)return false;
  const counts=Array(12).fill(0);
  if(!b.every(t=>Array.isArray(t)&&t.length<=4&&t.every(c=>Number.isInteger(c)&&c>=0&&c<colorCount(l))))return false;
  b.flat().forEach(c=>counts[c]++);
  const n=counts.filter(Boolean).length;
  return n>=4&&n<=colorCount(l)&&counts.every(c=>c===0||c===4)&&b.length>=n+2&&b.length<=n+3;
}
try{
  const s=JSON.parse(localStorage.getItem('prism-pour'));
  if(s&&validLevel(s.level)){
    replayMoves=Array.isArray(s.replayMoves)?s.replayMoves:null;
    level=s.level;sound=!!s.sound;unlocked=Math.max(level,validLevel(s.unlocked)?s.unlocked:level);
    allUnlocked=s.allUnlocked===true;
    completed=new Set(Array.isArray(s.completed)?s.completed.filter(validLevel):Array.from({length:level-1},(_,i)=>i+1));
    if(s.sessions&&typeof s.sessions==='object'&&!Array.isArray(s.sessions))sessions=s.sessions;
    if(validBoard(s.board,level)){board=clone(s.board);startBoard=validBoard(s.startBoard,level)?clone(s.startBoard):generate(level,new Set(board.flat()).size).board;moves=Number.isInteger(s.moves)&&s.moves>=0?s.moves:0;extra=board.length>new Set(board.flat()).size+2;}
  }
}catch{}
if(!board.length)board=generate(level).board;
if(!startBoard)startBoard=clone(board);
function save(){
  sessions[level]={board:clone(board),startBoard:clone(startBoard),moves,extra,replayMoves};
  try{localStorage.setItem('prism-pour',JSON.stringify({level,board,startBoard,replayMoves,moves,sound,unlocked,allUnlocked,completed:[...completed],sessions}));}catch{}
}
function recordWin(){if(won(board)){completed.add(level);unlocked=Math.max(unlocked,Math.min(MAX_LEVEL,level+1));}}
function tone(freq=500,duration=.12){if(!sound)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();let o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(freq*.7,audio.currentTime+duration);g.gain.setValueAtTime(.065,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}catch{}}
function vibrate(n){if(!reduced)navigator.vibrate?.(n)}
// Flights are visual only. The board and history commit synchronously on every move.
const flights=new Set();
let winTimer=0;
function cancelWin(){clearTimeout(winTimer);winTimer=0;}
function finishFlight(f){
  if(!flights.delete(f))return;
  f.animation?.cancel();f.el?.remove();
  const marble=$(`[data-i="${f.to}"] [data-slot="${f.slot}"]`);
  if(marble){marble.style.opacity='1';if(!reduced)marble.animate([
    {transform:'scale(1.16,.84)'},{transform:'scale(.96,1.04)'},{transform:'scale(1)'}
  ],{duration:140,easing:'ease-out'});}
}
function settleFlights(tube){
  for(const f of [...flights])if(tube===undefined||f.from===tube||f.to===tube)finishFlight(f);
}
function marbleSVG(c,id){return `<svg viewBox="0 0 44 44" aria-hidden="true"><defs>
  <radialGradient id="ball${id}" cx="32%" cy="24%" r="78%"><stop stop-color="#fff"/><stop offset=".15" stop-color="${colors[c]}"/><stop offset=".6" stop-color="${colors[c]}"/><stop offset="1" stop-color="#17183b"/></radialGradient>
  </defs><circle cx="22" cy="22" r="20" fill="url(#ball${id})" stroke="${colors[c]}" stroke-width=".8"/>
  <ellipse cx="15" cy="12" rx="6" ry="3.2" transform="rotate(-32 15 12)" fill="#fff" opacity=".75"/>
  <path d="M29 36Q36 33 38 26" fill="none" stroke="${colors[c]}" stroke-width="2" stroke-linecap="round"/>
  <circle cx="29" cy="13" r="1.8" fill="#fff" opacity=".45"/></svg>`;}
function tubeSVG(t,id){let segments=t.map((c,i)=>{
  const hidden=[...flights].some(f=>f.to===id&&f.slot===i);
  return `<g class="marble" data-slot="${i}" style="opacity:${hidden?0:1}"><ellipse cx="41" cy="${171-i*38}" rx="17" ry="3" fill="#02061455"/><svg x="19" y="${127-i*38}" width="44" height="44">${marbleSVG(c,`${id}-${i}`)}</svg></g>`;
}).join('');return `<svg viewBox="0 0 82 184" aria-hidden="true"><defs><linearGradient id="glass${id}"><stop stop-color="#e1eaff88"/><stop offset=".1" stop-color="#d3deff0a"/><stop offset=".5" stop-color="#cce1ff02"/><stop offset=".85" stop-color="#bacaff15"/><stop offset="1" stop-color="#dce5ff77"/></linearGradient></defs><path d="M7 10H75V143Q75 177 41 177Q7 177 7 143Z" fill="url(#glass${id})" stroke="#c7d3f4aa" stroke-width="1.5"/>${segments}<path d="M11 15V142Q11 171 40 173" fill="none" stroke="#fff9" stroke-width="2"/><path d="M71 17V141Q71 165 57 169" fill="none" stroke="#c9d8ff88" stroke-width="2"/><path d="M16 21V130" stroke="#fff4" stroke-width="3" stroke-linecap="round"/><ellipse cx="41" cy="10" rx="34" ry="5" fill="#13183077" stroke="#f3f2ffe0" stroke-width="1.5"/><ellipse cx="41" cy="11" rx="30" ry="3" fill="none" stroke="#b3c4ef88"/></svg>`}
function render(){let container=$('#board');container.classList.toggle('many',board.length>6);container.classList.toggle('large',board.length>10);const resized=container.childElementCount!==board.length;
if(resized)container.innerHTML=board.map((_,i)=>`<button class="tube" data-i="${i}"></button>`).join('');
container.querySelectorAll('.tube').forEach((el,i)=>{
 const t=board[i],signature=t.join(',')+'|'+[...flights].filter(f=>f.to===i).map(f=>f.slot).join(',');
 if(el.dataset.signature!==signature){el.innerHTML=tubeSVG(t,i);el.dataset.signature=signature}
 el.classList.toggle('done',complete(t));
 el.setAttribute('aria-label',`Tube ${i+1}: ${t.length?t.map(c=>names[c]).join(', ')+', bottom to top':'empty'}${complete(t)?', sorted':''}`);
});renderSelection();if(resized)fitBoard();$('#level').textContent='LEVEL '+String(level).padStart(2,'0');$('#moves').textContent=moves;$('#sorted').textContent=board.filter(complete).length+' of '+(generateCount())+' sorted';$('#undo').disabled=!history.length;$('#extra').disabled=extra||board.length>=14;$('#sound').innerHTML=icon(sound?'sound':'mute');$('#sound').setAttribute('aria-label',sound?'Turn sound off':'Turn sound on');}
function generateCount(){return new Set(board.flat()).size}
function flyMarbles(a,i,result,sourceLength,destLength,from,to,sourceLift=0){
  if(reduced)return;
  for(let j=0;j<result.count;j++){
    const slot=destLength+j;
    const size=44*from.width/82;
    const x=from.left+from.width/2-size/2;
    const y=from.top+(127-(sourceLength-1-j)*38-sourceLift)*from.width/82;
    const dx=to.left+to.width/2-size/2-x;
    const dy=to.top+(127-slot*38)*to.width/82-y;
    const el=document.createElement('div');el.className='flying-marble';
    el.innerHTML=marbleSVG(result.color,`flight-${moves}-${j}`);
    el.style.cssText=`left:${x}px;top:${y}px;width:${size}px;height:${size}px;color:${colors[result.color]}`;
    document.body.append(el);
    const f={from:a,to:i,slot,el,animation:null};flights.add(f);
    const lift=Math.min(70,24+Math.abs(dx)*.14);
    f.animation=el.animate([
      {transform:'translate(0,0) scale(1)',offset:0},
      {transform:`translate(${dx*.48}px,${Math.min(0,dy)-lift}px) scale(1.08,.92)`,offset:.45},
      {transform:`translate(${dx}px,${dy}px) scale(.96,1.04)`,offset:1}
    ],{duration:190,delay:j*18,easing:'cubic-bezier(.2,.6,.4,1)',fill:'both'});
    f.animation.finished.then(()=>finishFlight(f),()=>finishFlight(f));
  }
}
function choose(i){
  if(won(board))return;
  if(selected<0){if(!board[i].length)return;settleFlights(i);selected=i;tone(570,.055);vibrate(6);renderSelection();return}
  if(selected===i){selected=-1;renderSelection();return}
  const a=selected,result=move(board,a,i);
  if(!result){selected=board[i].length?i:selected;settleFlights(i);renderSelection();
    $(`[data-i="${i}"]`).classList.add('shake');
    $('#message').textContent='Match the top marble, or use an empty tube.';tone(160,.07);return;}
  cancelWin();settleFlights(a);settleFlights(i);
  const from=$(`[data-i="${a}"]`).getBoundingClientRect(),to=$(`[data-i="${i}"]`).getBoundingClientRect();
  const sourceLength=board[a].length,destLength=board[i].length;
  let sourceRun=0;for(let j=sourceLength-1;j>=0&&board[a][j]===board[a].at(-1);j--)sourceRun++;
  const sourceLift=174-(sourceLength-sourceRun)*38;
  history.push({board:clone(board),moves,extra,replayLength:replayMoves?.length});
  replayMoves?.push([a,i]);board=result.board;moves++;selected=-1;
  flyMarbles(a,i,result,sourceLength,destLength,from,to,sourceLift);
  recordWin();render();save();tone(660+result.count*45,.09);vibrate(8);
  $('#message').textContent='Tap a tube, then tap another to move marbles.';
  if(complete(board[i])){
    burst(to.left+to.width/2,to.top+to.height*.45,18);
    tone(990,.17);$('#message').textContent='One color. Perfect harmony.';
  }
  if(won(board))winTimer=setTimeout(()=>{winTimer=0;if(won(board))celebrate()},reduced?0:260);
}
function celebrate(){downloadUpdate();showMinimum();recordWin();save();$('#next').textContent=level===MAX_LEVEL?'Choose a level':'Next level →';$('#win-text').textContent=`Level ${level} complete in ${moves} moves. Take a breath. Enjoy the little win.`;if(!$('#win-dialog').open)$('#win-dialog').showModal();if(!reduced){burst(innerWidth*.3,innerHeight*.4,70);burst(innerWidth*.7,innerHeight*.4,70)}}
function reset(){stopMinimum();cancelWin();settleFlights();board=generate(level).board;startBoard=clone(board);history=[];replayMoves=[];moves=0;extra=false;selected=-1;render();save();$('#message').textContent='Tap a tube, then tap another to move marbles.'}
$('#undo').onclick=()=>{if(!history.length)return;cancelWin();settleFlights();let s=history.pop();board=s.board;moves=s.moves;extra=s.extra;if(replayMoves)replayMoves.length=s.replayLength;selected=-1;render();save();tone(390)};$('#restart').onclick=()=>reset();$('#extra').onclick=()=>{if(extra||board.length>=14)return;cancelWin();settleFlights();history.push({board:clone(board),moves,extra,replayLength:replayMoves?.length});replayMoves?.push("extra");board.push([]);extra=true;selected=-1;render();save();$('#message').textContent='A little breathing room. Always free.';tone(780)};$('#sound').onclick=()=>{sound=!sound;render();save();tone(720)};$('#help').onclick=()=>{settleFlights();$('#help-dialog').showModal()};$('#got-it').onclick=$('.close').onclick=()=>$('#help-dialog').close();$('#next').onclick=()=>{if(level===MAX_LEVEL){$('#win-dialog').close();openLevels();return}changeLevel(level+1)};$('#replay').onclick=()=>{$('#win-dialog').close();reset()};document.addEventListener('keydown',e=>{if(e.key==='Escape'){selected=-1;render()}if((e.ctrlKey||e.metaKey)&&e.key==='z'&&!document.querySelector('dialog[open]')){e.preventDefault();$('#undo').click()}});

function switchLevel(n){
  if(!validLevel(n)||(!allUnlocked&&n>unlocked))return false;
  stopMinimum();cancelWin();settleFlights();save();level=n;history=[];selected=-1;
  const saved=sessions[n];
  if(saved&&validBoard(saved.board,n)){replayMoves=Array.isArray(saved.replayMoves)?saved.replayMoves:null;board=clone(saved.board);startBoard=validBoard(saved.startBoard,n)?clone(saved.startBoard):generate(n,new Set(board.flat()).size).board;moves=Number.isInteger(saved.moves)&&saved.moves>=0?saved.moves:0;extra=board.length>new Set(board.flat()).size+2;render();save();}
  else reset();
  $('#levels-dialog').close();$('#win-dialog').close();
  $('#message').textContent=won(board)?'Already sorted. Restart to play this level again.':'Tap a tube, then tap another to move marbles.';
  return true;
}
function renderLevels(){
  const start=levelPage*40+1,end=Math.min(MAX_LEVEL,start+39);
  $('#level-summary').textContent=allUnlocked?'All levels unlocked':`Unlocked through level ${unlocked}`;
  $('#level-range').textContent=`${start}–${end}`;
  $('#levels-prev').disabled=levelPage===0;
  $('#levels-next').disabled=end===MAX_LEVEL;
  $('#level-grid').innerHTML=Array.from({length:end-start+1},(_,j)=>{
    const n=start+j,locked=!allUnlocked&&n>unlocked,done=completed.has(n);
    return `<button class="level-tile ${n===level?'current':''} ${done?'completed':''}" data-level="${n}" ${locked?'disabled':''} aria-label="Level ${n}${locked?', locked':done?', completed':''}" ${n===level?'aria-current="true"':''}><span>${n}</span><small>${locked?'Locked':done?'✓':`${colorCount(n)} colors`}</small></button>`;
  }).join('');
  $('#level-grid').querySelectorAll('button').forEach(b=>b.onclick=()=>changeLevel(+b.dataset.level));
}
function openLevels(){stopMinimum();cancelWin();settleFlights();save();levelPage=Math.floor((level-1)/40);renderLevels();$('#levels-dialog').showModal()}
$('#levels').onclick=openLevels;
$('#levels-close').onclick=()=>$('#levels-dialog').close();
$('#levels-prev').onclick=()=>{levelPage=Math.max(0,levelPage-1);renderLevels()};
$('#levels-next').onclick=()=>{levelPage=Math.min(Math.ceil(MAX_LEVEL/40)-1,levelPage+1);renderLevels()};
$('#level-jump').onsubmit=e=>{e.preventDefault();const n=Number($('#level-number').value);if(!validLevel(n)){ $('#level-feedback').textContent=`Choose a level from 1 to ${MAX_LEVEL.toLocaleString()}.`;return}levelPage=Math.floor((n-1)/40);renderLevels();$('#level-feedback').textContent=!allUnlocked&&n>unlocked?'Finish earlier levels to unlock this one.':'';};
function unlockAll(){allUnlocked=true;save();renderLevels();$('#level-feedback').textContent='POOJA! Every level is unlocked.';$('#message').textContent='POOJA! Every level is unlocked.';tone(990,.2);vibrate(15)}
let cheatBuffer='';
document.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey||e.repeat||e.target?.matches('input,textarea'))return;
  if(e.key.length===1){cheatBuffer=(cheatBuffer+e.key.toUpperCase()).slice(-5);if(cheatBuffer==='POOJA'){unlockAll();cheatBuffer=''}}
});
$('#cheat-code').addEventListener('input',e=>{if(e.target.value.trim().toUpperCase()==='POOJA'){unlockAll();e.target.value=''}});


let changingLevel=false;
async function changeLevel(n){
 if(changingLevel||!validLevel(n)||(!allUnlocked&&n>unlocked))return;
 changingLevel=true;stopMinimum();save();
 $('#next').disabled=true;$('#level-grid').inert=true;
 const message=$('#update-status');message.textContent='Checking for updates…';
 try{
  // Only reload if the destination can be restored after navigation.
  let canReload=false;try{sessionStorage.setItem('prism-next-level',String(n));canReload=true}catch{}
  if(canReload&&await updateBetweenLevels())return;
  try{sessionStorage.removeItem('prism-next-level')}catch{}
  switchLevel(n);
 }finally{changingLevel=false;$('#next').disabled=false;$('#level-grid').inert=false;message.textContent=''}
}
function renderSelection(){
 $('#board').querySelectorAll('.tube').forEach(el=>{
  const i=+el.dataset.i;el.classList.toggle('selected',selected===i);
  el.classList.toggle('valid',selected>=0&&!!move(board,selected,i));
  el.setAttribute('aria-pressed',String(selected===i));
  const t=board[i];let run=0;
  if(selected===i)for(let j=t.length-1;j>=0&&t[j]===t.at(-1);j--)run++;
  el.querySelectorAll('.marble').forEach(ball=>{
   const lifted=run>0&&+ball.dataset.slot>=t.length-run;
   ball.style.transform=lifted?`translateY(-${174-(t.length-run)*38}px)`:'';
  });
 });
}
// Touch-down is the action, not a delayed synthetic click on release.
$('#board').addEventListener('pointerdown',e=>{
 if(!e.isPrimary||e.button!==0||changingLevel)return;
 const tube=e.target.closest('.tube');if(!tube)return;
 e.preventDefault();choose(+tube.dataset.i);
});
$('#board').addEventListener('click',e=>{
 // Keyboard and assistive-technology activation still use click (detail 0).
 if(e.detail!==0||changingLevel)return;
 const tube=e.target.closest('.tube');if(tube)choose(+tube.dataset.i);
});
function fitBoard(){
 const el=$('#board'),main=document.querySelector('main');if(!main)return;
 const width=main.clientWidth-24;
 const count=board.length,landscape=innerWidth>innerHeight;
 const gap=landscape?8:12;
 const chrome=document.querySelector('.intro').offsetHeight+document.querySelector('.controls').offsetHeight+$('#message').offsetHeight+document.querySelector('footer').offsetHeight+(landscape?40:70);
 const room=Math.max(70,main.clientHeight-chrome);
 let cols=1,size=0;
 for(let candidate=1;candidate<=count;candidate++){
  const rows=Math.ceil(count/candidate);
  const proposed=Math.min(90,(width-(candidate-1)*gap)/candidate,(room-(rows-1)*gap)/rows*82/184);
  if(proposed>size){size=proposed;cols=candidate}
 }
 size=Math.max(20,size);
 el.style.setProperty('--tube-width',size+'px');el.style.gridTemplateColumns=`repeat(${cols},${size}px)`;el.style.gap=gap+'px';
}
addEventListener('resize',()=>{settleFlights();fitBoard()});
window.visualViewport?.addEventListener('resize',fitBoard);

addEventListener('scroll',()=>settleFlights(),{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden)settleFlights()});

let optimalWorker=null;
function stopMinimum(){optimalWorker?.terminate();optimalWorker=null;}
let bestReplay=null, yourReplay=null, comparisonStep=0;
function replayPath(initial,path){
 if(!Array.isArray(path))return null;
 let b=clone(initial),steps=[{board:clone(b),label:'Starting puzzle'}],count=0;
 for(const event of path){
  if(event==='extra'){if(b.length>=14)return null;b.push([]);steps[steps.length-1].board=clone(b);steps[steps.length-1].label+=' · extra tube added (free)';continue}
  if(!Array.isArray(event)||event.length!==2||!event.every(Number.isInteger))return null;
  const [a,z]=event,result=move(b,a,z);if(!result)return null;
  b=result.board;count++;
  steps.push({board:clone(b),label:`Move ${count}: tube ${a+1} → ${z+1} · ${result.count} marble${result.count===1?'':'s'}`});
 }
 return {steps,count,board:b};
}
function renderComparison(){
 const max=Math.max(yourReplay?.count||0,bestReplay?.count||0);
 comparisonStep=Math.min(comparisonStep,max);
 $('#compare-step').max=max;$('#compare-step').value=comparisonStep;
 $('#compare-position').textContent=comparisonStep===0?'Starting puzzle':`Move ${comparisonStep} of ${max}`;
 $('#compare-prev').disabled=comparisonStep===0;$('#compare-next').disabled=comparisonStep===max;
 for(const [id,replay] of [['your',yourReplay],['best',bestReplay]]){
  const frame=replay?.steps[Math.min(comparisonStep,replay.count)];
  $('#'+id+'-caption').textContent=frame?frame.label+(comparisonStep>replay.count?' · finished':''):id==='your'?'This older attempt has no saved move history. Replay the level to record it.':'Finding a proven shortest solution…';
  $('#'+id+'-board').innerHTML=frame?frame.board.map((t,i)=>`<div class="replay-tube" aria-label="Tube ${i+1}: ${t.map(c=>names[c]).join(', ')||'empty'}, bottom to top">${tubeSVG(t,`replay-${id}-${i}`)}<span>${i+1}</span></div>`).join(''):'';
 }
 $('#compare-summary').textContent=bestReplay?`You: ${moves} moves · Best: ${bestReplay.count} moves · ${moves===bestReplay.count?'Optimal!':`${moves-bestReplay.count} extra move${moves-bestReplay.count===1?'':'s'}`}`:`You: ${moves} moves · Best: calculating…`;
}
$('#compare').onclick=()=>{comparisonStep=0;renderComparison();$('#compare-dialog').showModal()};
$('#compare-close').onclick=()=>$('#compare-dialog').close();
$('#compare-prev').onclick=()=>{comparisonStep--;renderComparison()};
$('#compare-next').onclick=()=>{comparisonStep++;renderComparison()};
$('#compare-step').oninput=e=>{comparisonStep=+e.target.value;renderComparison()};
function showMinimum(){
 stopMinimum();bestReplay=null;
 yourReplay=replayPath(startBoard,replayMoves);
 if(yourReplay&&(yourReplay.count!==moves||JSON.stringify(yourReplay.board)!==JSON.stringify(board)))yourReplay=null;
 const initial=clone(startBoard);if(extra&&initial.length<board.length)initial.push([]);
 const cacheKey='prism-optimal-v2:'+JSON.stringify(initial);
 const label=$('#win-minimum');
 $('#win-rules').textContent=`From the starting puzzle${extra?', with the free extra tube available from the start':''}. A matching group moved together counts as one move. The final move counts; selections and undo do not.`;
 function accept(data){
  if(data.exact){
   const candidate=replayPath(initial,data.path);
   if(!candidate||!won(candidate.board)||candidate.count!==data.minimum)throw Error('Invalid solution');
   bestReplay=candidate;
  }
  label.textContent=data.exact?`Theoretical minimum: ${data.minimum} moves`:`Theoretical minimum: at least ${data.minimum} moves · still calculating`;
  renderComparison();
 }
 try{const cached=JSON.parse(localStorage.getItem(cacheKey));if(cached?.exact){accept(cached);return}}catch{}
 label.textContent='Theoretical minimum: calculating…';renderComparison();
 function failed(){label.textContent='Theoretical minimum: unavailable';$('#best-caption').textContent='The best solution could not be calculated. Reopen this level to retry.';stopMinimum()}
 try{
  optimalWorker=new Worker('./optimal-worker.js',{type:'module'});
  optimalWorker.onmessage=({data})=>{
   if(data.error){failed();return}
   try{accept(data)}catch{failed();return}
   if(data.exact){try{localStorage.setItem(cacheKey,JSON.stringify(data))}catch{}stopMinimum()}
  };
  optimalWorker.onerror=failed;
  optimalWorker.postMessage({board:initial});
 }catch{failed()}
}
$('#win-dialog').addEventListener('close',stopMinimum);

let particles=[],raf=0,ctx=$('#particles').getContext('2d');function burst(x,y,n){if(reduced)return;for(let i=0;i<n;i++)particles.push({x,y,vx:(Math.random()-.5)*8,vy:-Math.random()*7-1,life:1,size:Math.random()*4+2,c:colors[i%colors.length]});if(!raf)raf=requestAnimationFrame(frame)}function frame(){let c=ctx.canvas;if(c.width!==innerWidth||c.height!==innerHeight){c.width=innerWidth;c.height=innerHeight}ctx.clearRect(0,0,c.width,c.height);particles=particles.filter(p=>p.life>0);for(let p of particles){p.x+=p.vx;p.y+=p.vy;p.vy+=.12;p.life-=.015;ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.c;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;raf=particles.length?requestAnimationFrame(frame):0}render();let pendingLevel=0;try{pendingLevel=Number(sessionStorage.getItem('prism-next-level'));sessionStorage.removeItem('prism-next-level')}catch{}if(validLevel(pendingLevel))switchLevel(pendingLevel);if(won(board))celebrate();
