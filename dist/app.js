import{generate,clone,complete,won,move}from'./engine.js';
const $=s=>document.querySelector(s),colors=['#ff698f','#2cdbd5','#a475ff','#ffc747','#66b2ff','#9bdd75'],names=['rose','aqua','violet','gold','blue','lime'];
const icons={undo:'<path d="M9 5 3 11l6 6M3 11h11a7 7 0 0 1 0 14" transform="translate(1 -3)"/>',restart:'<path d="M20 10a8 8 0 1 1-5-6M15 1v5h5"/>',extra:'<path d="M12 4v16M4 12h16"/>',sound:'<path d="m11 4-5 4H3v8h3l5 4ZM15 8q5 4 0 8M18 4q9 8 0 16"/>',mute:'<path d="m11 4-5 4H3v8h3l5 4ZM16 9l6 6m0-6-6 6"/>'};const icon=n=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[n]}</svg>`;['undo','restart','extra'].forEach(n=>$('#'+n+' .circle').innerHTML=icon(n));
let level=1,board=[],history=[],selected=-1,moves=0,sound=false,extra=false,audio;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
try{let s=JSON.parse(localStorage.getItem('prism-pour'));if(s&&Number.isInteger(s.level)&&s.level>0&&s.level<=100000){level=s.level;sound=!!s.sound;let n=generate(level).board.length;if(Array.isArray(s.board)&&s.board.length>=n&&s.board.length<=n+1&&s.board.every(t=>Array.isArray(t)&&t.length<=4&&t.every(c=>Number.isInteger(c)&&c>=0&&c<6))){let counts=Array(6).fill(0);s.board.flat().forEach(c=>counts[c]++);if(counts.every(c=>c===0||c===4)&&counts.reduce((a,b)=>a+b,0)===(n-2)*4){board=clone(s.board);moves=Math.max(0,s.moves||0);extra=board.length>n;}}}}catch{}
if(!board.length)board=generate(level).board;
function save(){try{localStorage.setItem('prism-pour',JSON.stringify({level,board,moves,sound}));}catch{}}
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
function render(){let container=$('#board');container.classList.toggle('many',board.length>6);container.innerHTML=board.map((t,i)=>`<button class="tube ${complete(t)?'done':''} ${selected===i?'selected':''} ${selected>=0&&move(board,selected,i)?'valid':''}" aria-label="Tube ${i+1}: ${t.length?t.map(c=>names[c]).join(', ')+', bottom to top':'empty'}${complete(t)?', sorted':''}" aria-pressed="${selected===i}" data-i="${i}">${tubeSVG(t,i)}</button>`).join('');container.querySelectorAll('button').forEach(b=>b.onclick=()=>choose(+b.dataset.i));$('#level').textContent='LEVEL '+String(level).padStart(2,'0');$('#moves').textContent=moves;$('#sorted').textContent=board.filter(complete).length+' of '+(generateCount())+' sorted';$('#undo').disabled=!history.length;$('#extra').disabled=extra;$('#sound').innerHTML=icon(sound?'sound':'mute');$('#sound').setAttribute('aria-label',sound?'Turn sound off':'Turn sound on');}
function generateCount(){return Math.min(6,4+Math.floor((level-1)/4))}
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
  render();save();tone(660+result.count*45,.09);vibrate(8);
  $('#message').textContent='Tap a tube, then tap another to move marbles.';
  if(complete(board[i])){
    burst(to.left+to.width/2,to.top+to.height*.45,18);
    tone(990,.17);$('#message').textContent='One color. Perfect harmony.';
  }
  if(won(board))winTimer=setTimeout(()=>{winTimer=0;if(won(board))celebrate()},reduced?0:260);
}
function celebrate(){$('#win-text').textContent=`Level ${level} complete in ${moves} moves. Take a breath. Enjoy the little win.`;if(!$('#win-dialog').open)$('#win-dialog').showModal();if(!reduced){burst(innerWidth*.3,innerHeight*.4,70);burst(innerWidth*.7,innerHeight*.4,70)}}
function reset(){cancelWin();settleFlights();board=generate(level).board;history=[];moves=0;extra=false;selected=-1;render();save();$('#message').textContent='Tap a tube, then tap another to move marbles.'}
$('#undo').onclick=()=>{if(!history.length)return;cancelWin();settleFlights();let s=history.pop();board=s.board;moves=s.moves;extra=s.extra;selected=-1;render();save();tone(390)};$('#restart').onclick=()=>reset();$('#extra').onclick=()=>{if(extra)return;cancelWin();settleFlights();history.push({board:clone(board),moves,extra});board.push([]);extra=true;selected=-1;render();save();$('#message').textContent='A little breathing room. Always free.';tone(780)};$('#sound').onclick=()=>{sound=!sound;render();save();tone(720)};$('#help').onclick=()=>{settleFlights();$('#help-dialog').showModal()};$('#got-it').onclick=$('.close').onclick=()=>$('#help-dialog').close();$('#next').onclick=()=>{$('#win-dialog').close();level++;reset()};$('#replay').onclick=()=>{$('#win-dialog').close();reset()};document.addEventListener('keydown',e=>{if(e.key==='Escape'){selected=-1;render()}if((e.ctrlKey||e.metaKey)&&e.key==='z'&&!document.querySelector('dialog[open]')){e.preventDefault();$('#undo').click()}});
addEventListener('resize',()=>settleFlights());
addEventListener('scroll',()=>settleFlights(),{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden)settleFlights()});
let particles=[],raf=0,ctx=$('#particles').getContext('2d');function burst(x,y,n){if(reduced)return;for(let i=0;i<n;i++)particles.push({x,y,vx:(Math.random()-.5)*8,vy:-Math.random()*7-1,life:1,size:Math.random()*4+2,c:colors[i%colors.length]});if(!raf)raf=requestAnimationFrame(frame)}function frame(){let c=ctx.canvas;if(c.width!==innerWidth||c.height!==innerHeight){c.width=innerWidth;c.height=innerHeight}ctx.clearRect(0,0,c.width,c.height);particles=particles.filter(p=>p.life>0);for(let p of particles){p.x+=p.vx;p.y+=p.vy;p.vy+=.12;p.life-=.015;ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.c;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;raf=particles.length?requestAnimationFrame(frame):0}render();if(won(board))celebrate();
