const ALG={fcfs:"FCFS",sjf:"SJF (non-preemptive)",srtf:"SRTF (preemptive SJF)",pnp:"Priority (non-preemptive)",pp:"Priority (preemptive)",rr:"Round Robin"};
let procs=[{at:0,bt:5,pr:2},{at:1,bt:3,pr:1},{at:2,bt:8,pr:4},{at:3,bt:2,pr:3}];
let st={tab:0,alg:"fcfs",q:2,cur:0,timer:null,res:null,qi:0,qa:{}};
const col=i=>`hsl(${(i*67+150)%360} 50% 38%)`;
const chip=i=>`<span class="chip" style="background:${col(i)}">P${i+1}</span>`;

// The scheduling engine now lives in the C++ backend (backend/main.cpp).
async function api(list,alg,q){
 const body=`algo=${alg}&q=${q}&procs=${list.map(p=>[+p.at||0,Math.max(1,+p.bt||1),+p.pr||0].join(",")).join(";")}`;
 let out,mode;
 try{
  const r=await fetch("/api/simulate",{method:"POST",body});
  if(!r.ok)throw new Error("no backend");
  out=await r.json();mode="C++ backend";
 }catch(e){
  out=alg==="all"?Object.fromEntries(Object.keys(ALG).map(k=>[k,simLocal(list,k,q)])):simLocal(list,alg,q);
  mode="in-browser engine";
 }
 const m=document.getElementById("mode");if(m)m.textContent="Engine: "+mode;
 return out;
}
function showErr(e){document.getElementById("v").innerHTML=`<div class="c"><h2>Backend not reachable</h2><p>${e.message}. Start the C++ server (<code>./scheduler</code> in the backend folder) and open <b>http://localhost:8080</b>, not the HTML file directly.</p></div>`}
const f=x=>Number.isInteger(x)?x:x.toFixed(2);

function tabs(){const nav=document.getElementById("nav");
 nav.innerHTML=["Simulator","Compare","Quiz","Learn"].map((t,i)=>`<button class="${st.tab===i?"on":""}" onclick="go(${i})">${t}</button>`).join("");}
function go(i){stop();st.tab=i;tabs();[sim_,cmp,quiz,learn][i]()}
const V=h=>document.getElementById("v").innerHTML=h;

async function sim_(){
 try{st.res=await api(procs,st.alg,st.q)}catch(e){return showErr(e)}
 st.cur=Math.min(st.cur,st.res.end);
 V(`<div class="c"><h2>1. Processes</h2><div class="sc"><table><tr><th>Process</th><th>Arrival</th><th>Burst</th><th>Priority</th><th></th></tr>
 ${procs.map((p,i)=>`<tr><td>${chip(i)}</td><td><input type="number" min="0" value="${p.at}" onchange="ed(${i},'at',this.value)" aria-label="Arrival P${i+1}"></td>
 <td><input type="number" min="1" value="${p.bt}" onchange="ed(${i},'bt',this.value)" aria-label="Burst P${i+1}"></td>
 <td><input type="number" value="${p.pr}" onchange="ed(${i},'pr',this.value)" aria-label="Priority P${i+1}"></td>
 <td><button class="b" onclick="rm(${i})" aria-label="Remove P${i+1}">Remove</button></td></tr>`).join("")}</table></div>
 <div class="row" style="margin-top:10px"><button class="b" onclick="add()">Add process</button><button class="b" onclick="rnd()">Random set</button>
 <button class="b" onclick="procs=[{at:0,bt:5,pr:2},{at:1,bt:3,pr:1},{at:2,bt:8,pr:4},{at:3,bt:2,pr:3}];rs()">Example set</button></div>
 <p class="mu" style="margin:8px 0 0">Lower priority number means higher priority. Priority is only used by the two priority algorithms.</p></div>
 <div class="c"><h2>2. Algorithm</h2><div class="row"><select id="al" onchange="st.alg=this.value;rs()" aria-label="Algorithm">${Object.entries(ALG).map(([k,v])=>`<option value="${k}" ${k===st.alg?"selected":""}>${v}</option>`).join("")}</select>
 ${st.alg==="rr"?`<label>Quantum <input type="number" min="1" value="${st.q}" style="width:64px" onchange="st.q=Math.max(1,+this.value||1);rs()"></label>`:""}</div></div>
 <div class="c"><h2>3. Gantt chart</h2><div class="row"><button class="b p" onclick="play()" id="pl">${st.timer?"Pause":"Play"}</button><button class="b" onclick="stp(1)">Step +1</button><button class="b" onclick="stp(-1)">Step −1</button><button class="b" onclick="st.cur=st.res.end;stop();draw()">Show all</button><button class="b" onclick="st.cur=0;stop();draw()">Reset</button>
 <span class="mu" id="clk"></span></div><div class="sc" id="gc"></div><div id="rq"></div></div>
 <div class="c"><h2>4. Results</h2><div class="sc" id="tb"></div><div class="stats" id="sts"></div></div>`);
 draw();
}
function draw(){
 const r=st.res,U=Math.max(22,Math.min(44,Math.floor(900/r.end))),c=st.cur;
 let g=`<div class="g" style="width:${r.end*U}px">`;
 r.seg.forEach(s=>{if(s.s<c){const e=Math.min(s.e,c);g+=`<div class="${s.id===null?"idle":""}" style="left:${s.s*U}px;width:${(e-s.s)*U}px;${s.id!==null?`background:${col(s.id)}`:""}">${s.id===null?"idle":"P"+(s.id+1)}</div>`}});
 g+=`</div><div class="tk" style="width:${r.end*U}px">`;
 const pts=new Set([0,c]);r.seg.forEach(s=>{if(s.s<=c)pts.add(s.s);if(s.e<=c)pts.add(s.e)});
 [...pts].forEach(x=>g+=`<span style="left:${x*U}px">${x}</span>`);
 document.getElementById("gc").innerHTML=g+"</div>";
 document.getElementById("clk").textContent=`Time ${c} of ${r.end}`;
 const run=r.seg.find(s=>s.s<=c&&c<s.e),ready=r.rows.filter(x=>x.at<=c&&x.ct>c&&(!run||run.id!==x.i));
 document.getElementById("rq").innerHTML=`<div class="row" style="margin-top:8px"><b>Running:</b> ${c>=r.end?'<span class="mu">finished</span>':run&&run.id!==null?chip(run.id):'<span class="mu">idle</span>'} <b>Ready:</b> <span class="rq">${ready.map(x=>chip(x.i)).join("")||'<span class="mu">empty</span>'}</span></div>`;
 const fin=c>=r.end;
 document.getElementById("tb").innerHTML=`<table><tr><th>Process</th><th>AT</th><th>BT</th><th>CT</th><th>TAT</th><th>WT</th><th>RT</th></tr>`+
 r.rows.map(x=>{const d=x.ct<=c;return `<tr><td>${chip(x.i)}</td><td>${x.at}</td><td>${x.bt}</td><td>${d?x.ct:"…"}</td><td>${d?x.tat:"…"}</td><td>${d?x.wt:"…"}</td><td>${x.rt!==null&&x.at+x.rt<=c?x.rt:"…"}</td></tr>`}).join("")+
 `</table><p class="mu" style="margin:8px 0 0">TAT = CT − AT &nbsp; WT = TAT − BT &nbsp; RT = first CPU time − AT</p>`;
 document.getElementById("sts").innerHTML=fin?[["Avg waiting time",f(r.wt)],["Avg turnaround",f(r.tat)],["Avg response",f(r.rt)],["CPU utilization",f(r.util)+"%"],["Context switches",r.cs],["Throughput",f(r.thr)+" /unit"]].map(([a,b])=>`<div class="st"><b>${b}</b><small>${a}</small></div>`).join(""):`<span class="mu">Averages appear when the run finishes.</span>`;
}
function rs(){stop();st.cur=0;sim_()}
function ed(i,k,v){procs[i][k]=+v;rs()}
function rm(i){if(procs.length>1){procs.splice(i,1);rs()}}
function add(){if(procs.length<10){procs.push({at:procs.length,bt:3,pr:1});rs()}}
function rnd(){const n=4+Math.floor(Math.random()*3);procs=Array.from({length:n},()=>({at:Math.floor(Math.random()*8),bt:1+Math.floor(Math.random()*8),pr:1+Math.floor(Math.random()*5)}));rs()}
function stp(d){st.cur=Math.max(0,Math.min(st.res.end,st.cur+d));draw()}
function stop(){if(st.timer){clearInterval(st.timer);st.timer=null}const b=document.getElementById("pl");if(b)b.textContent="Play"}
function play(){if(st.timer){stop();return}if(st.cur>=st.res.end)st.cur=0;document.getElementById("pl").textContent="Pause";
 st.timer=setInterval(()=>{if(st.cur>=st.res.end){stop();return}stp(1)},600)}

async function cmp(){
 let all;try{all=await api(procs,"all",st.q)}catch(e){return showErr(e)}
 const rs_=Object.keys(ALG).map(k=>({k,r:all[k]}));
 const m=(key,lab,low=true,fmt=f)=>{const vals=rs_.map(x=>x.r[key]),best=low?Math.min(...vals):Math.max(...vals),mx=Math.max(...vals)||1;
  return `<div class="c"><h2>${lab}</h2>`+rs_.map(x=>`<div class="bar"><span class="n">${ALG[x.k].split(" (")[0]}${x.k==="srtf"?" (SJF-P)":""}</span><i class="${x.r[key]===best?"best":""}" style="width:${Math.max(1,x.r[key]/mx*60)}%"></i><em>${fmt(x.r[key])}</em></div>`).join("")+`</div>`};
 const bw=Math.min(...rs_.map(x=>x.r.wt));
 V(`<div class="c"><h2>Performance comparison</h2><p class="mu" style="margin:0">Same process set (edit it on the Simulator tab), Round Robin quantum = ${st.q}. Gold bars mark the best value.</p>
 <div class="sc" style="margin-top:10px"><table><tr><th>Algorithm</th><th>Avg WT</th><th>Avg TAT</th><th>Avg RT</th><th>CPU %</th><th>Switches</th></tr>
 ${rs_.map(x=>`<tr><td>${ALG[x.k]}</td><td>${f(x.r.wt)}</td><td>${f(x.r.tat)}</td><td>${f(x.r.rt)}</td><td>${f(x.r.util)}</td><td>${x.r.cs}</td></tr>`).join("")}</table></div>
 <p style="margin:10px 0 0"><b>Lowest average waiting time:</b> ${rs_.filter(x=>x.r.wt===bw).map(x=>ALG[x.k]).join(", ")}. Preemption lowers response time but usually adds context switches.</p></div>
 ${m("wt","Average waiting time")}${m("tat","Average turnaround time")}${m("rt","Average response time")}${m("cs","Context switches",true,x=>x)}`);
}

const BANK=[
 {q:"Which algorithm is provably optimal for minimum average waiting time (with all processes known)?",o:["FCFS","SJF / SRTF","Round Robin","Priority"],a:1,e:"Running the shortest job first minimizes the sum of waiting times; SRTF is the preemptive form."},
 {q:"What is the convoy effect?",o:["Many short jobs stuck behind one long job","Processes starving forever","Too many context switches","Priority inversion"],a:0,e:"It happens in FCFS when a long CPU-bound process delays everything behind it."},
 {q:"Turnaround time is calculated as…",o:["WT − BT","CT − AT","CT − BT","AT + BT"],a:1,e:"TAT = Completion time − Arrival time. Waiting time is TAT − BT."},
 {q:"A Round Robin quantum that is extremely large behaves like…",o:["SJF","Priority","FCFS","SRTF"],a:2,e:"If the quantum exceeds every burst, no one is preempted and order is arrival order."},
 {q:"What is the main risk of priority scheduling?",o:["Starvation of low-priority processes","High response time for all","No preemption possible","Deadlock"],a:0,e:"Low-priority processes may never run. Aging gradually raises their priority to fix this."},
 {q:"A very small Round Robin quantum mostly increases…",o:["Waiting for short jobs","Context-switch overhead","Starvation","Burst times"],a:1,e:"Each tiny slice costs a switch, so useful CPU time falls."},
 {q:"Which algorithm usually gives the best (lowest) average response time for interactive work?",o:["FCFS","Non-preemptive SJF","Round Robin","Non-preemptive priority"],a:2,e:"Every process gets the CPU within (n−1)×quantum, so response is bounded."}];
async function mk(){
 const all=await api(procs,"all",st.q);
 const ks=Object.keys(ALG).filter(k=>k!=="rr").slice(0,5),k=ks[Math.floor(Math.random()*ks.length)],r=all[k].wt;
 const set=new Set([+f(r)]);let d=1;while(set.size<4){set.add(+(r+(Math.random()<.5?-1:1)*d*(0.5+Math.random())).toFixed(2));d++}
 const arr=[...set].map(Number).sort(()=>Math.random()-.5);
 const best=Object.keys(ALG).map(x=>[x,all[x].wt]);const mn=Math.min(...best.map(b=>b[1]));
 const dyn={q:`For your current process set, what is the average waiting time under ${ALG[k]}?`,o:arr.map(String),a:arr.indexOf(+f(r)),e:`Compute WT = CT − AT − BT for each process, then average. Answer: ${f(r)}. Check the Simulator tab to see the Gantt chart.`};
 const names=best.filter(b=>b[1]===mn).map(b=>ALG[b[0]]);
 const wrong=Object.values(ALG).filter(x=>!names.includes(x)).sort(()=>Math.random()-.5).slice(0,3);
 const o2=[names[0],...wrong].sort(()=>Math.random()-.5);
 const dyn2={q:"Which algorithm gives the lowest average waiting time on your current process set?",o:o2,a:o2.indexOf(names[0]),e:`${names.join(" and ")} scored ${f(mn)}. Ties are possible, so any listed winner counts.`};
 return [...BANK.sort(()=>Math.random()-.5).slice(0,5),dyn,dyn2];
}
async function quiz(){
 if(!st.qs){try{st.qs=await mk()}catch(e){return showErr(e)}st.qi=0;st.sc=0;st.ans=null}
 const qs=st.qs;
 if(st.qi>=qs.length){V(`<div class="c"><h2>Quiz complete</h2><p style="font-size:20px"><b>${st.sc} / ${qs.length}</b></p><p class="mu">${st.sc>=6?"Strong grasp of scheduling.":st.sc>=4?"Good. Review the Learn tab for the rest.":"Try the Learn tab, then step through a few runs."}</p><button class="b p" onclick="st.qs=null;quiz()">New quiz</button></div>`);return}
 const q=qs[st.qi];
 V(`<div class="c"><h2>Question ${st.qi+1} of ${qs.length}</h2><p>${q.q}</p>
 ${q.o.map((o,i)=>`<button class="b opt ${st.ans!==null?(i===q.a?"ok":i===st.ans?"no":""):""}" ${st.ans!==null?"disabled":""} onclick="pick(${i})">${o}</button>`).join("")}
 ${st.ans!==null?`<p class="ex"><b>${st.ans===q.a?"Correct.":"Not quite."}</b> ${q.e}</p><button class="b p" onclick="st.qi++;st.ans=null;quiz()">${st.qi===qs.length-1?"See score":"Next question"}</button>`:""}
 <p class="mu" style="margin-top:12px">Score so far: ${st.sc}</p></div>`);
}
function pick(i){st.ans=i;if(i===st.qs[st.qi].a)st.sc++;quiz()}

function learn(){
 const L=[["FCFS","Runs processes in arrival order. Simple and fair by arrival, but long jobs delay short ones (convoy effect). Non-preemptive."],
 ["SJF","Picks the ready process with the shortest burst. Minimizes average waiting time but needs burst estimates and can starve long jobs."],
 ["SRTF","Preemptive SJF: whenever a process arrives with less remaining time than the running one, it takes over."],
 ["Priority","Runs the highest priority (lowest number here) first. Can be preemptive or not. Starvation is fixed with aging."],
 ["Round Robin","Each process gets one quantum in turn, then returns to the queue tail. Good response time; the quantum size is the key trade-off."]];
 V(`<div class="c"><h2>Algorithms</h2>${L.map(x=>`<p><b>${x[0]}.</b> ${x[1]}</p>`).join("")}</div>
 <div class="c"><h2>Formulas</h2><table><tr><td>Turnaround time (TAT)</td><td>CT − AT</td></tr><tr><td>Waiting time (WT)</td><td>TAT − BT</td></tr><tr><td>Response time (RT)</td><td>First CPU start − AT</td></tr>
 <tr><td>CPU utilization</td><td>Busy time ÷ total time × 100</td></tr><tr><td>Context switches</td><td>Times the CPU moves from one process to a different one (idle gaps ignored)</td></tr></table></div>
 <div class="c"><h2>Try this</h2><p>Load the example set and run FCFS, then SRTF. Compare their waiting times, then set Round Robin quantum to 1, then to 10, and watch the context switches change.</p></div>`);
}
tabs();sim_();

// ---------- Theme toggle and keyboard shortcuts ----------
function toggleTheme(){
  const r=document.documentElement,dark=r.dataset.theme?r.dataset.theme==='dark':matchMedia('(prefers-color-scheme:dark)').matches;
  r.dataset.theme=dark?'light':'dark';
}
document.addEventListener('keydown',e=>{
  if(st.tab!==0||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
  if(e.code==='Space'){e.preventDefault();play()}
  else if(e.key==='ArrowRight')stp(1);
  else if(e.key==='ArrowLeft')stp(-1);
});
