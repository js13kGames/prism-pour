import{generate,clone,complete,won,move,colorCount,MAX_LEVEL}from'./engine.js';
const $=s=>document.querySelector(s),colors=['#ff9fbe','#00e5dc','#9b59f5','#ffe13b','#69bfff','#b2ed36','#ff8824','#f5f1e8','#ed3545','#139b56','#354dcc','#ef35bb'],names=['rose','aqua','violet','gold','blue','lime','orange','pearl','ruby','jade','indigo','magenta'];
const icons={undo:'<path d="M9 5 3 11l6 6M3 11h11a7 7 0 0 1 0 14" transform="translate(1 -3)"/>',restart:'<path d="M20 10a8 8 0 1 1-5-6M15 1v5h5"/>',extra:'<path d="M12 4v16M4 12h16"/>',sound:'<path d="m11 4-5 4H3v8h3l5 4ZM15 8q5 4 0 8M18 4q9 8 0 16"/>',mute:'<path d="m11 4-5 4H3v8h3l5 4ZM16 9l6 6m0-6-6 6"/>'};const icon=n=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[n]}</svg>`;['undo','restart','extra'].forEach(n=>$('#'+n+' .circle').innerHTML=icon(n));
let level=1,board=[],history=[],selected=-1,moves=0,sound=false,extra=false,audio;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    level=s.level;sound=!!s.sound;unlocked=Math.max(level,validLevel(s.unlocked)?s.unlocked:level);
    allUnlocked=s.allUnlocked===true;
    completed=new Set(Array.isArray(s.completed)?s.completed.filter(validLevel):Array.from({length:level-1},(_,i)=>i+1));
    if(s.sessions&&typeof s.sessions==='object'&&!Array.isArray(s.sessions))sessions=s.sessions;
    if(validBoard(s.board,level)){board=clone(s.board);moves=Number.isInteger(s.moves)&&s.moves>=0?s.moves:0;extra=board.length>new Set(board.flat()).size+2;}
  }
}catch{}
if(!board.length)board=generate(level).board;
function save(){
  sessions[level]={board:clone(board),moves,extra};
  try{localStorage.setItem('prism-pour',JSON.stringify({level,board,moves,sound,unlocked,allUnlocked,completed:[...completed],sessions}));}catch{}
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
function render(){let container=$('#board');container.classList.toggle('many',board.length>6);container.classList.toggle('large',board.length>10);container.innerHTML=board.map((t,i)=>`<button class="tube ${complete(t)?'done':''} ${selected===i?'selected':''} ${selected>=0&&move(board,selected,i)?'valid':''}" aria-label="Tube ${i+1}: ${t.length?t.map(c=>names[c]).join(', ')+', bottom to top':'empty'}${complete(t)?', sorted':''}" aria-pressed="${selected===i}" data-i="${i}">${tubeSVG(t,i)}</button>`).join('');container.querySelectorAll('button').forEach(b=>b.onclick=()=>choose(+b.dataset.i));$('#level').textContent='LEVEL '+String(level).padStart(2,'0');$('#moves').textContent=moves;$('#sorted').textContent=board.filter(complete).length+' of '+(generateCount())+' sorted';$('#undo').disabled=!history.length;$('#extra').disabled=extra||board.length>=14;$('#sound').innerHTML=icon(sound?'sound':'mute');$('#sound').setAttribute('aria-label',sound?'Turn sound off':'Turn sound on');}
function generateCount(){return new Set(board.flat()).size}
function flyMarbles(a,i,result,sourceLength,destLength,from,to){
  if(reduced)return;
  for(let j=0;j<result.count;j++){
    const slot=destLength+j;
    const size=44*from.width/82;
    const x=from.left+from.width/2-size/2;
    const y=from.top+(127-(sourceLength-1-j)*38)*from.width/82;
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
  if(selected<0){if(!board[i].length)return;settleFlights(i);selected=i;tone(570,.055);vibrate(6);render();return}
  if(selected===i){selected=-1;render();return}
  const a=selected,result=move(board,a,i);
  if(!result){selected=board[i].length?i:selected;settleFlights(i);render();
    $(`[data-i="${i}"]`).classList.add('shake');
    $('#message').textContent='Match the top marble, or use an empty tube.';tone(160,.07);return;}
  cancelWin();settleFlights(a);settleFlights(i);
  const from=$(`[data-i="${a}"]`).getBoundingClientRect(),to=$(`[data-i="${i}"]`).getBoundingClientRect();
  const sourceLength=board[a].length,destLength=board[i].length;
  history.push({board:clone(board),moves,extra});
  board=result.board;moves++;selected=-1;
  flyMarbles(a,i,result,sourceLength,destLength,from,to);
  recordWin();render();save();tone(660+result.count*45,.09);vibrate(8);
  $('#message').textContent='Tap a tube, then tap another to move marbles.';
  if(complete(board[i])){
    burst(to.left+to.width/2,to.top+to.height*.45,18);
    tone(990,.17);$('#message').textContent='One color. Perfect harmony.';
  }
  if(won(board))winTimer=setTimeout(()=>{winTimer=0;if(won(board))celebrate()},reduced?0:260);
}
function celebrate(){recordWin();save();$('#next').textContent=level===MAX_LEVEL?'Choose a level':'Next level →';$('#win-text').textContent=`Level ${level} complete in ${moves} moves. Take a breath. Enjoy the little win.`;if(!$('#win-dialog').open)$('#win-dialog').showModal();if(!reduced){burst(innerWidth*.3,innerHeight*.4,70);burst(innerWidth*.7,innerHeight*.4,70)}}
function reset(){cancelWin();settleFlights();board=generate(level).board;history=[];moves=0;extra=false;selected=-1;render();save();$('#message').textContent='Tap a tube, then tap another to move marbles.'}
$('#undo').onclick=()=>{if(!history.length)return;cancelWin();settleFlights();let s=history.pop();board=s.board;moves=s.moves;extra=s.extra;selected=-1;render();save();tone(390)};$('#restart').onclick=()=>reset();$('#extra').onclick=()=>{if(extra||board.length>=14)return;cancelWin();settleFlights();history.push({board:clone(board),moves,extra});board.push([]);extra=true;selected=-1;render();save();$('#message').textContent='A little breathing room. Always free.';tone(780)};$('#sound').onclick=()=>{sound=!sound;render();save();tone(720)};$('#help').onclick=()=>{settleFlights();$('#help-dialog').showModal()};$('#got-it').onclick=$('.close').onclick=()=>$('#help-dialog').close();$('#next').onclick=()=>{$('#win-dialog').close();if(level===MAX_LEVEL){openLevels();return}switchLevel(level+1)};$('#replay').onclick=()=>{$('#win-dialog').close();reset()};document.addEventListener('keydown',e=>{if(e.key==='Escape'){selected=-1;render()}if((e.ctrlKey||e.metaKey)&&e.key==='z'&&!document.querySelector('dialog[open]')){e.preventDefault();$('#undo').click()}});

function switchLevel(n){
  if(!validLevel(n)||(!allUnlocked&&n>unlocked))return false;
  cancelWin();settleFlights();save();level=n;history=[];selected=-1;
  const saved=sessions[n];
  if(saved&&validBoard(saved.board,n)){board=clone(saved.board);moves=Number.isInteger(saved.moves)&&saved.moves>=0?saved.moves:0;extra=board.length>new Set(board.flat()).size+2;render();save();}
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
  $('#level-grid').querySelectorAll('button').forEach(b=>b.onclick=()=>switchLevel(+b.dataset.level));
}
function openLevels(){cancelWin();settleFlights();save();levelPage=Math.floor((level-1)/40);renderLevels();$('#levels-dialog').showModal()}
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

addEventListener('resize',()=>settleFlights());
addEventListener('scroll',()=>settleFlights(),{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden)settleFlights()});
let particles=[],raf=0,ctx=$('#particles').getContext('2d');function burst(x,y,n){if(reduced)return;for(let i=0;i<n;i++)particles.push({x,y,vx:(Math.random()-.5)*8,vy:-Math.random()*7-1,life:1,size:Math.random()*4+2,c:colors[i%colors.length]});if(!raf)raf=requestAnimationFrame(frame)}function frame(){let c=ctx.canvas;if(c.width!==innerWidth||c.height!==innerHeight){c.width=innerWidth;c.height=innerHeight}ctx.clearRect(0,0,c.width,c.height);particles=particles.filter(p=>p.life>0);for(let p of particles){p.x+=p.vx;p.y+=p.vy;p.vy+=.12;p.life-=.015;ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.c;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;raf=particles.length?requestAnimationFrame(frame):0}render();if(won(board))celebrate();
