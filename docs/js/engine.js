// In-browser copy of the scheduling engine. Used automatically when the C++ backend is not running
// (for example on GitHub Pages). Same algorithms and output format as backend/main.cpp.
function simLocal(list,alg,q){
 const P=list.map((p,i)=>({i,at:+p.at||0,bt:Math.max(1,+p.bt||1),pr:+p.pr||0,rem:Math.max(1,+p.bt||1),ct:null,rt:null}));
 const n=P.length,seg=[];let t=0,done=0;
 const push=(id,a,b)=>{const l=seg[seg.length-1];if(l&&l.id===id&&l.e===a)l.e=b;else seg.push({id,s:a,e:b})};
 const run=(p,d)=>{if(p.rt===null)p.rt=t-p.at;push(p.i,t,t+d);t+=d;p.rem-=d;if(p.rem===0){p.ct=t;done++}};
 const nextArr=()=>Math.min(...P.filter(p=>p.at>t).map(p=>p.at));
 if(alg==="rr"){
  const Q=[],added=new Set();
  const addArr=()=>P.slice().sort((a,b)=>a.at-b.at||a.i-b.i).forEach(p=>{if(p.at<=t&&!added.has(p.i)){added.add(p.i);Q.push(p)}});
  while(done<n){addArr();
   if(!Q.length){const a=nextArr();push(null,t,a);t=a;continue}
   const p=Q.shift(),d=Math.min(q,p.rem);run(p,d);addArr();if(p.rem>0)Q.push(p)}
 }else{
  while(done<n){
   const R=P.filter(p=>p.at<=t&&p.rem>0);
   if(!R.length){const a=nextArr();push(null,t,a);t=a;continue}
   const key={fcfs:p=>[p.at],sjf:p=>[p.bt],srtf:p=>[p.rem],pnp:p=>[p.pr],pp:p=>[p.pr]}[alg];
   R.sort((a,b)=>key(a)[0]-key(b)[0]||a.at-b.at||a.i-b.i);
   const p=R[0];run(p,(alg==="srtf"||alg==="pp")?1:p.rem)}
 }
 const end=t,busy=seg.filter(s=>s.id!==null).reduce((a,s)=>a+s.e-s.s,0);
 let cs=0,prev=null;seg.forEach(s=>{if(s.id!==null){if(prev!==null&&prev!==s.id)cs++;prev=s.id}});
 const rows=P.map(p=>({i:p.i,at:p.at,bt:p.bt,pr:p.pr,ct:p.ct,tat:p.ct-p.at,wt:p.ct-p.at-p.bt,rt:p.rt}));
 const av=k=>rows.reduce((a,r)=>a+r[k],0)/n;
 return{seg,rows,end,cs,util:busy/end*100,wt:av("wt"),tat:av("tat"),rt:av("rt"),thr:n/end};
}
