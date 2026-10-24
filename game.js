/* Световой След — playable 5-level fantasy-light puzzle prototype.
   Artistic backdrops are original game concept renders; rays and progression are interactive. */
'use strict';
(() => {
const W=941,H=1672,$=s=>document.querySelector(s);
const canvas=$('#scene'),ctx=canvas.getContext('2d',{alpha:false});
const panels=['startScreen','levelsScreen','gameHud','pauseScreen','winScreen'];
const LEVELS=[
 {title:'Первый луч',subtitle:'Поверни светильник и зеркало',goal:[608,307],hero:[463,1064],nodes:[
  {id:'l1',type:'lamp',x:192,y:668,initial:1,target:2},{id:'m1',type:'mirror',x:487,y:741,initial:2,target:3}],
  chains:[['l1','m1','goal']],par:2},
 {title:'Два отражения',subtitle:'Соедини две дорожки света',goal:[630,325],hero:[465,1090],nodes:[
  {id:'l1',type:'lamp',x:237,y:591,initial:3,target:0},{id:'m1',type:'mirror',x:350,y:680,initial:1,target:2},
  {id:'m2',type:'mirror',x:643,y:750,initial:0,target:1},{id:'l2',type:'lamp',x:777,y:924,initial:2,target:3}],
  chains:[['l1','m1','m2','goal'],['l2','m2','goal']],par:4},
 {title:'Запертый проход',subtitle:'Поверни лучи и отодвинь ящик',goal:[657,302],hero:[455,1071],nodes:[
  {id:'l1',type:'lamp',x:154,y:596,initial:3,target:0},{id:'m1',type:'mirror',x:425,y:711,initial:0,target:1},
  {id:'m2',type:'mirror',x:672,y:846,initial:2,target:3},{id:'l2',type:'lamp',x:772,y:1018,initial:1,target:2}],
  crate:{x:558,y:653,to:[560,805]},chains:[['l1','m1','goal'],['l2','m2','goal']],par:5},
 {title:'Лабиринт теней',subtitle:'Три зеркала и преграда',goal:[571,308],hero:[450,1100],nodes:[
  {id:'l1',type:'lamp',x:188,y:560,initial:1,target:2},{id:'m1',type:'mirror',x:446,y:588,initial:2,target:3},
  {id:'m2',type:'mirror',x:743,y:619,initial:0,target:1},{id:'m3',type:'mirror',x:608,y:971,initial:3,target:0},
  {id:'l2',type:'lamp',x:776,y:1015,initial:0,target:1}],
  crate:{x:312,y:842,to:[346,950]},chains:[['l1','m1','m2','m3','goal'],['l2','m3','goal']],par:6},
 {title:'Храм света',subtitle:'Последняя тайна древнего храма',goal:[469,314],hero:[460,1350],nodes:[
  {id:'l1',type:'lamp',x:147,y:606,initial:2,target:3},{id:'m1',type:'mirror',x:374,y:588,initial:1,target:2},
  {id:'m2',type:'mirror',x:574,y:763,initial:3,target:0},{id:'m3',type:'mirror',x:595,y:951,initial:2,target:3},
  {id:'l2',type:'lamp',x:798,y:1087,initial:0,target:1}],
  crate:{x:475,y:905,to:[324,971]},chains:[['l1','m1','m2','goal'],['l2','m3','goal']],par:6}
];
const resources=LEVELS.map((_,i)=>{const img=new Image(); img.src=`assets/level${i+1}.webp`;return img});
const LS='svetovoi_sled_v01';let saved;
try{saved=JSON.parse(localStorage.getItem(LS)||'{}')}catch{saved={}}
saved={unlocked:Math.max(0,Math.min(4,Number(saved.unlocked)||0)),stars:Array.isArray(saved.stars)?saved.stars.slice(0,5):[0,0,0,0,0]};
let phase='start',index=0,level=LEVELS[0],nodes=[],crateMoved=false,moves=0,hints=0,history=[],started=0,selected=null,particles=[],raf=0,winning=false,lastFx=0,lastTip=0,historyAnchor=0;
const rand=(a,b)=>a+(b-a)*Math.random(),clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const dist=(a,b,c,d)=>Math.hypot(a-c,b-d);
function persist(){try{localStorage.setItem(LS,JSON.stringify(saved))}catch{}}
function show(...visible){for(const id of panels)$('#'+id).classList.toggle('hidden',!visible.includes(id))}
function tone(freq=550,duration=.085,type='sine',volume=.045){try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;const a=tone.audio||(tone.audio=new AC());if(a.state==='suspended')a.resume();let o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(freq,a.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(freq*.7,20),a.currentTime+duration);g.gain.setValueAtTime(volume,a.currentTime);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+duration);o.connect(g).connect(a.destination);o.start();o.stop(a.currentTime+duration)}catch{}}
function get(id){return nodes.find(n=>n.id===id)}
function done(id){return id==='goal'||get(id)?.value===get(id)?.target}
function chainDone(chain){return chain.slice(0,-1).every(done)}
function success(){return level.chains.every(chainDone)&&(!level.crate||crateMoved)}
function finish(){if(phase!=='game'||winning||!success())return;winning=true;const count= Math.max(1,3-(moves>level.par+4?1:0)-(hints>0?1:0));saved.stars[index]=Math.max(saved.stars[index]||0,count);saved.unlocked=Math.max(saved.unlocked,Math.min(index+1,4));persist();$('#resultStars').textContent='★'.repeat(count)+'☆'.repeat(3-count);$('#winMessage').textContent=index===4?'Ты открыл все пять порталов!':'Тень нашла дорогу к свету';$('#stats').textContent=`Ходов: ${moves}  ·  Время: ${Math.round((Date.now()-started)/1000)} сек.`;$('#nextBtn').textContent=index===4?'Играть заново ↻':'Следующий уровень →';makeBurst(490,490,72);tone(730,.28,'triangle',.10);setTimeout(()=>tone(990,.32,'sine',.075),170);setTimeout(()=>{if(phase==='game'){phase='win';show('winScreen')}},750)}
function updatedGuide(){let left=nodes.filter(n=>n.value!==n.target);if(left.length){const first=left[0];$('#guideTitle').textContent=first.type==='lamp'?'Настрой светильник':'Поверни зеркало';$('#guideText').textContent='Коснись сияющего кольца на поле'}else if(level.crate&&!crateMoved){$('#guideTitle').textContent='Освободи путь';$('#guideText').textContent='Нажми на деревянный ящик'}else{$('#guideTitle').textContent='Световой путь собран';$('#guideText').textContent='Портал пробуждается…'}let total=nodes.length+(level.crate?1:0),ready=nodes.filter(n=>n.value===n.target).length+(level.crate&&crateMoved?1:0);$('#progressFill').style.width=(ready/total*100)+'%';$('#hudStars').textContent=(saved.stars[index]?'★'.repeat(saved.stars[index])+'☆'.repeat(3-saved.stars[index]):'☆☆☆')}
function startGame(i){index=i;level=LEVELS[index];nodes=level.nodes.map(n=>({...n,value:n.initial}));crateMoved=false;moves=0;hints=0;history=[];selected=null;winning=false;phase='game';started=Date.now();particles=[];$('#levelTag').textContent='Уровень '+(index+1);show('gameHud');updatedGuide();toast(index===0?'Коснись светильника или зеркала, чтобы повернуть':'Поверни все зеркала и направь свет к порталу');tone(510,.15)}
function mainMenu(){phase='start';show('startScreen')}
function choose(){phase='levels';show('levelsScreen');let g=$('#levelsGrid');g.innerHTML='';LEVELS.forEach((l,i)=>{let b=document.createElement('button');b.className='level-tile';b.disabled=i>saved.unlocked;b.innerHTML=`<strong>${i+1}</strong><small>${i>saved.unlocked?'🔒':(saved.stars[i]?'★'.repeat(saved.stars[i])+'☆'.repeat(3-saved.stars[i]):l.title)}</small>`;b.addEventListener('click',()=>startGame(i));g.appendChild(b)})}
function snapshot(){history.push({values:nodes.map(n=>n.value),crateMoved});if(history.length>30)history.shift()}
function rotate(n){if(phase!=='game'||winning)return;snapshot();n.value=(n.value+1)%4;selected=n.id;moves++;tone(n.value===n.target?710:370,.08,'triangle');smallBurst(n.x,n.y,n.value===n.target?'#fff09b':'#80d7ff',14);updatedGuide();if(n.value===n.target)toast(n.type==='lamp'?'Светильник настроен!':'Зеркало отражает свет!');finish()}
function moveCrate(){if(phase!=='game'||winning||!level.crate)return;snapshot();crateMoved=!crateMoved;selected='crate';moves++;tone(280,.11,'triangle');smallBurst(crateMoved?level.crate.to[0]:level.crate.x,crateMoved?level.crate.to[1]:level.crate.y,'#e3c18a',16);toast(crateMoved?'Проход свободен!':'Ящик вернулся на место');updatedGuide();finish()}
let toastTimer=0;function toast(s){$('#toast').textContent=s;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),1950)}
function doUndo(){if(!history.length){toast('Пока нечего отменять');return}const prev=history.pop();nodes.forEach((n,i)=>n.value=prev.values[i]);crateMoved=prev.crateMoved;moves=Math.max(0,moves-1);selected=null;updatedGuide();tone(390,.09)}
function hint(){if(phase!=='game')return;hints++;let target=nodes.find(n=>n.value!==n.target);if(target){selected=target.id;toast(`Попробуй повернуть ${target.type==='lamp'?'светильник':'зеркало'} — он подсвечен`)}else if(level.crate&&!crateMoved){selected='crate';toast('Нажми на деревянный ящик, чтобы переместить его')}else toast('Путь готов!');tone(770,.11);}
function onClickBoard(x,y){if(phase!=='game')return;
  for(const n of nodes){if(dist(x,y,n.x,n.y)<75){rotate(n);return}}
  if(level.crate){let c=level.crate,p=crateMoved?c.to:[c.x,c.y];if(dist(x,y,p[0],p[1])<94||dist(x,y,c.x,c.y)<70){moveCrate();return}}
  if(y>1310&&y<1610){if(x<305){const a=nodes.filter(n=>n.type==='lamp'),n=a.find(v=>v.value!==v.target)||a[0];if(n)rotate(n)}else if(x<630){const a=nodes.filter(n=>n.type==='mirror'),n=a.find(v=>v.value!==v.target)||a[0];if(n)rotate(n)}else if(level.crate){moveCrate()}else toast('На этом уровне ящик не требуется');return}
  const nearest=[...nodes].sort((a,b)=>dist(x,y,a.x,a.y)-dist(x,y,b.x,b.y))[0]; if(nearest&&dist(x,y,nearest.x,nearest.y)<108){rotate(nearest);return}toast('Нажми на светильник, зеркало или ящик')
}
canvas.addEventListener('pointerdown',e=>{if(phase!=='game')return;const rect=canvas.getBoundingClientRect();onClickBoard((e.clientX-rect.left)*W/rect.width,(e.clientY-rect.top)*H/rect.height)});
$('#playBtn').addEventListener('click',()=>startGame(saved.unlocked));$('#chooseBtn').addEventListener('click',choose);$('#levelsBack').addEventListener('click',mainMenu);
$('#pauseBtn').addEventListener('click',()=>{phase='pause';show('pauseScreen')});$('#continueBtn').addEventListener('click',()=>{phase='game';show('gameHud')});$('#restartMenuBtn').addEventListener('click',()=>startGame(index));$('#homeBtn').addEventListener('click',mainMenu);
$('#undoBtn').addEventListener('click',doUndo);$('#restartBtn').addEventListener('click',()=>startGame(index));$('#hintBtn').addEventListener('click',hint);
$('#nextBtn').addEventListener('click',()=>startGame(index===4?0:index+1));$('#winMenuBtn').addEventListener('click',choose);
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&phase==='game'){$('#pauseBtn').click()}else if(e.key==='Escape'&&phase==='pause'){$('#continueBtn').click()}else if((e.key==='z'||e.key==='Backspace')&&phase==='game'){doUndo()}else if(e.key==='h'&&phase==='game'){hint()}});
function smallBurst(x,y,color,count=8){for(let i=0;i<count;i++){let a=rand(0,Math.PI*2),s=rand(.9,4);particles.push({x,y,dx:Math.cos(a)*s,dy:Math.sin(a)*s-2,life:rand(26,75),max:75,color,size:rand(1,5)})}}
function makeBurst(x,y,n){smallBurst(x,y,'#ffd579',n)}
function drawImage(img){if(img.complete&&img.naturalWidth)ctx.drawImage(img,0,0,W,H);else{let bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#193756');bg.addColorStop(1,'#060a22');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H)}}
function ray(from,to,alpha,time,strong=true){let [x1,y1]=from,[x2,y2]=to;let d=dist(x1,y1,x2,y2);if(d<4)return;ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=alpha;ctx.lineCap='round';
  let beam=ctx.createLinearGradient(x1,y1,x2,y2);beam.addColorStop(0,'#ffad30');beam.addColorStop(.42,'#ffe889');beam.addColorStop(1,'#fffed8');
  for(const [w,a,blur] of [[33,.13,28],[17,.27,16],[7,.6,10],[2,.85,5]]){ctx.strokeStyle=beam;ctx.lineWidth=w;ctx.globalAlpha=alpha*a;ctx.shadowColor='#ffcb66';ctx.shadowBlur=blur;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}
  ctx.shadowBlur=0;let ux=(x2-x1)/d,uy=(y2-y1)/d;const density=Math.max(1,Math.floor(d/72));for(let i=0;i<density;i++){let pos=((time*.00025+i/density)%1),xx=x1+(x2-x1)*pos,yy=y1+(y2-y1)*pos;ctx.fillStyle='#fff8be';ctx.globalAlpha=alpha*(.15+.55*(1-pos));ctx.beginPath();ctx.arc(xx,yy,1.4+2*(1-pos),0,Math.PI*2);ctx.fill()}
  ctx.restore()}
function brokenRay(n,next,time){let targetAngle=Math.atan2(next[1]-n.y,next[0]-n.x),offset=(((n.value-n.target+4)%4)+4)%4;let angle=targetAngle+offset*Math.PI/2;const end=[clamp(n.x+Math.cos(angle)*randDet(n.id)*265,90,875),clamp(n.y+Math.sin(angle)*randDet(n.id)*265,210,1290)];ray([n.x,n.y],end,.78,time,false)}
function randDet(str){let v=0;for(let i=0;i<str.length;i++)v+=(str.charCodeAt(i)*(i+1));return .8+(v%31)/100}
function targetPos(id){if(id==='goal')return level.goal;let n=get(id);return[n.x,n.y]}
function beams(time){let connections=new Set();for(const chain of level.chains){let active=true;for(let i=0;i<chain.length-1;i++){
  const k=chain[i],next=chain[i+1],obj=get(k);if(!obj)break;if(!active)break;
  let key=k+'>'+next,can=obj.value===obj.target;
  if(can&&(!level.crate||crateMoved||next!=='goal')){if(!connections.has(key)){ray([obj.x,obj.y],targetPos(next),.95,time);connections.add(key)}}else{brokenRay(obj,targetPos(next),time);active=false}if(!can)active=false;
  if(next==='goal'&&level.crate&&!crateMoved){active=false}
 }}
}
function glowCircle(x,y,r,color,alpha,time){ctx.save();ctx.globalCompositeOperation='screen';let gr=ctx.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,color);gr.addColorStop(.24,color);gr.addColorStop(1,'#00000000');ctx.globalAlpha=alpha;ctx.fillStyle=gr;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.restore()}
function drawNode(n,time){const okay=n.value===n.target,sel=selected===n.id,rad=n.type==='lamp'?47:54;let oscillate=(Math.sin(time*.003+n.x)*.5+.5);
  if(okay||sel)glowCircle(n.x,n.y,rad*2.15,okay?'#ffd57f':'#68c8ff',okay?.20:.20,time);
  ctx.save();ctx.translate(n.x,n.y);let a=(n.value-n.target)*Math.PI/2;
  ctx.strokeStyle=okay?'#ffeaba':'#7bbfff';ctx.shadowColor=okay?'#ffb64c':'#47afff';ctx.shadowBlur=okay?17:9;ctx.lineWidth=sel?4:2.4;ctx.globalAlpha=sel?.96:.68;
  ctx.beginPath();ctx.arc(0,0,rad+7,-Math.PI*.10,Math.PI*.83);ctx.stroke();ctx.beginPath();ctx.arc(0,0,rad+7,Math.PI*.9,Math.PI*1.72);ctx.stroke();ctx.shadowBlur=0;
  // Animated pointer makes rotations visually obvious, while keeping the original painted object intact.
  ctx.rotate(a-.6);ctx.beginPath();ctx.moveTo(rad+17,0);ctx.lineTo(rad+2,-9);ctx.lineTo(rad+2,9);ctx.closePath();ctx.fillStyle=okay?'#fff4c6':'#b7e9ff';ctx.fill();
  if(sel){ctx.beginPath();ctx.arc(0,0,rad+19,0,Math.PI*2);ctx.setLineDash([6,11]);ctx.strokeStyle='#fff9be';ctx.lineWidth=2;ctx.globalAlpha=.5+oscillate*.3;ctx.stroke();ctx.setLineDash([])}ctx.restore();
}
function drawCrate(time){if(!level.crate)return;const c=level.crate,p=crateMoved?c.to:[c.x,c.y];let sel=selected==='crate';if(crateMoved){glowCircle(c.x,c.y,68,'#fff4a0',.23,time);ctx.save();ctx.strokeStyle='#fbe6b6';ctx.lineWidth=3;ctx.setLineDash([8,10]);ctx.beginPath();ctx.arc(c.x,c.y,45,0,Math.PI*2);ctx.stroke();ctx.restore();
  // Stylized animated crate at its movable position; the painted original location is retained as environmental scenery.
  drawWoodenCrate(p[0],p[1]);}
  ctx.save();ctx.strokeStyle=crateMoved?'#a5ffdb':'#ffdf99';ctx.lineWidth=sel?5:3;ctx.shadowColor='#e9ae64';ctx.shadowBlur=18;ctx.globalAlpha=.7+Math.sin(time*.003)*.1;ctx.beginPath();ctx.arc(p[0],p[1],66,.2,Math.PI*1.8);ctx.stroke();ctx.restore();
  if(!crateMoved){ctx.save();ctx.setLineDash([8,9]);ctx.strokeStyle='#d5e5f9';ctx.globalAlpha=.32;ctx.strokeRect(c.to[0]-38,c.to[1]-37,76,74);ctx.restore()}
}
function drawWoodenCrate(x,y){ctx.save();ctx.translate(x,y);ctx.shadowColor='#000a';ctx.shadowBlur=13;ctx.shadowOffsetY=8;ctx.fillStyle='#51301a';ctx.fillRect(-43,-42,86,83);ctx.shadowBlur=0;ctx.shadowOffsetY=0;let grad=ctx.createLinearGradient(-42,-42,44,43);grad.addColorStop(0,'#9f6032');grad.addColorStop(.45,'#e19b56');grad.addColorStop(1,'#643717');ctx.fillStyle=grad;ctx.fillRect(-38,-37,76,74);ctx.strokeStyle='#442418';ctx.lineWidth=10;ctx.strokeRect(-39,-38,78,76);ctx.beginPath();ctx.moveTo(-33,-32);ctx.lineTo(33,30);ctx.moveTo(32,-31);ctx.lineTo(-33,31);ctx.stroke();ctx.strokeStyle='#efb577';ctx.lineWidth=3;ctx.strokeRect(-31,-30,62,60);ctx.restore()}
function drawParticles(time){if(phase==='game'||phase==='win'){if(time-lastFx>95){lastFx=time;particles.push({x:rand(110,830),y:rand(210,1270),dx:rand(-.2,.2),dy:rand(-1.4,-.3),life:rand(95,200),max:200,color:Math.random()>.6?'#ffe098':'#a2cfff',size:rand(.7,2)})}}
 for(let i=particles.length-1;i>=0;i--){let p=particles[i];p.x+=p.dx;p.y+=p.dy;p.dy+=.006;p.life--;if(p.life<=0){particles.splice(i,1);continue}ctx.save();ctx.globalAlpha=clamp(p.life/p.max,0,.85);ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=7;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();ctx.restore()}}
function drawCracks(time){if(phase!=='game')return;let visible=0;for(const c of level.chains)if(chainDone(c))visible++;if(visible){glowCircle(level.goal[0],level.goal[1],150,'#ffeaa0',.10+visible*.07+Math.sin(time*.004)*.02,time)}
 if(winning){ctx.save();let a=clamp((Date.now()-started)*.003,0,1);glowCircle(level.goal[0],level.goal[1],370,'#ffe3a4',.45,time);ctx.restore()}}
function paint(time){if(phase==='start'){drawImage(resources[0]);ctx.fillStyle='#03102b33';ctx.fillRect(0,0,W,H)}else if(phase==='levels'){drawImage(resources[4]);ctx.fillStyle='#07122b88';ctx.fillRect(0,0,W,H)}else{
  drawImage(resources[index]);ctx.save();let d=ctx.createLinearGradient(0,160,0,1340);d.addColorStop(0,'#00102c66');d.addColorStop(.15,'#03152d72');d.addColorStop(.83,'#03152d80');d.addColorStop(1,'#03152d00');ctx.fillStyle=d;ctx.fillRect(0,180,W,1135);ctx.restore();beams(time);drawCracks(time);for(const n of nodes)drawNode(n,time);drawCrate(time)}
 drawParticles(time);raf=requestAnimationFrame(paint)}
resources[0].onerror=()=>console.warn('Не найден файл художественного фона: assets/level1.webp');
raf=requestAnimationFrame(paint);
// Test-only read access for automated local validation; no production cheat controls.
window.svetDebug=()=>({phase,index,values:nodes.map(n=>({id:n.id,value:n.value,target:n.target,x:n.x,y:n.y})),crateMoved,moves,unlocked:saved.unlocked,stars:saved.stars.slice()});
})();