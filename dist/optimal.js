import {move,won} from './engine.js';
// Each move can merge at most one color run. This is an admissible lower bound.
export function lowerBound(board){let runs=0;const colors=new Set();for(const t of board)for(let i=0;i<t.length;i++){colors.add(t[i]);if(i===0||t[i]!==t[i-1])runs++}return runs-colors.size}
const key=b=>b.map(t=>t.map(c=>String.fromCharCode(65+c)).join('')).sort().join('|');
// Iterative deepening A*: the first solution is provably shortest. Tube positions
// are interchangeable, so canonical states eliminate equivalent permutations.
export function optimal(board,report=()=>{}){
 let bound=lowerBound(board),visits=0,last=0;
 const path=[];
 for(;;){
  report({minimum:bound,exact:false});
  const seen=new Map();
  function search(b,g){
   const f=g+lowerBound(b);if(f>bound)return f;if(won(b))return -1;
   const k=key(b),old=seen.get(k);if(old!==undefined&&old<=g)return Infinity;
   if(seen.size>150000)seen.clear();seen.set(k,g);
   if(++visits%4096===0&&Date.now()-last>1000){last=Date.now();report({minimum:bound,exact:false})}
   let next=Infinity;const children=[],unique=new Set();
   for(let a=0;a<b.length;a++)for(let z=0;z<b.length;z++){
    // Moving a uniform tube to an empty tube only renames interchangeable tubes.
    if(!b[z].length&&b[a].every(c=>c===b[a][0]))continue;
    const m=move(b,a,z);if(!m)continue;const ck=key(m.board);if(unique.has(ck))continue;unique.add(ck);
    children.push({b:m.board,h:lowerBound(m.board),a,z});
   }
   children.sort((a,b)=>a.h-b.h);
   for(const c of children){path.push([c.a,c.z]);const n=search(c.b,g+1);if(n===-1)return -1;path.pop();next=Math.min(next,n)}
   return next;
  }
  const result=search(board,0);if(result===-1){report({minimum:path.length,exact:true,path:path.map(m=>m.slice())});return path.length}
  if(!Number.isFinite(result))throw Error('No solution found');bound=result;
 }
}
