/* Световой След 0.2 — реальные отражения, поворот спрайтов, перетаскивание ящиков. */
'use strict';
(()=>{
const canvas=document.getElementById('scene'),ctx=canvas.getContext('2d',{alpha:false});
const $=id=>document.getElementById(id),W=720,H=1280,C=82,BX=73,BY=257,COLS=7,ROWS=9;
const dx=[0,1,0,-1],dy=[-1,0,1,0];
const STAGES=[
 {title:'Первый луч',description:'Поверни фонарь, затем зеркало',lamp:[0,6,0,1],mirrors:[[3,6,1,0]],goal:[3,1],crates:[],par:2},
 {title:'Два зеркала',description:'Проведи луч через два отражения',lamp:[0,7,1,1],mirrors:[[2,7,1,0],[2,3,1,0]],goal:[6,3],crates:[],par:2},
 {title:'Передвинь ящик',description:'Освободи лучу дорогу',lamp:[0,7,0,1],mirrors:[[3,7,1,0],[3,2,0,0]],goal:[6,2],crates:[[[5,2],[5,4]]],par:3},
 {title:'Три отражения',description:'Зеркала и преграда',lamp:[0,6,1,1],mirrors:[[2,6,1,0],[2,2,1,0],[5,2,0,1]],goal:[5,5],crates:[[[2,4],[0,4]]],par:4},
 {title:'Храм света',description:'Открой древний портал',lamp:[0,7,0,1],mirrors:[[2,7,1,0],[2,2,1,0],[5,2,0,1],[5,5,0,1]],goal:[6,5],crates:[[[2,4],[0,4]],[[4,2],[4,4]]],par:7}
];
const stone=new Image();stone.src='assets/stone_atlas.webp';stone.onload=()=>backgroundDirty=true;
const images=STAGES.map((_,i)=>{const im=new Image();im.src=`assets/level${i+1}.webp`;im.onload=()=>backgroundDirty=true;return im});
const KEY='svetovoi_sled_v02',storage=(()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}})();
const saved={unlocked:Math.max(0,Math.min(4,Number(storage.unlocked)||0)),stars:Array.isArray(storage.stars)?storage.stars.slice(0,5):[0,0,0,0,0]};
let mode='start',level=0,stage=null,objects=[],lamp=null,crates=[],trace=null,history=[],steps=0,hints=0,finishAt=0,finished=false,started=0,drag=null,activeGlow=null,backgroundDirty=true,background=document.createElement('canvas'),bctx=background.getContext('2d'),toasty=0,lastTick=0,particles=[];
background.width=W;background.height=H;
function save(){try{localStorage.setItem(KEY,JSON.stringify(saved))}catch{}}
function x(c){return BX+(c+.5)*C}function y(r){return BY+(r+.5)*C}function inside(c,r){return c>=0&&c<COLS&&r>=0&&r<ROWS}
function show(ids){for(const s of ['start','choose','hud','pauseModal','win'])$(s).classList.toggle('hidden',!ids.includes(s))}
function rnd(n){const z=Math.sin(n*33.931)*43758.545;return z-Math.floor(z)}
function saveState(){history.push({lamp:lamp.dir,mirrors:objects.map(o=>o.slash),crates:crates.map(c=>c.moved)});if(history.length>70)history.shift()}
function snapshot(){return{level, lamp:lamp.dir,mirrors:objects.map(o=>o.slash),crates:crates.map(c=>c.moved)}}
function center(o){return [x(o.c),y(o.r)]}
function sound(freq=540,dur=.09){try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;const a=sound.a||(sound.a=new Audio());a.resume();const osc=a.createOscillator(),g=a.createGain();osc.type='triangle';osc.frequency.setValueAtTime(freq,a.currentTime);osc.frequency.exponentialRampToValueAtTime(Math.max(130,freq*.65),a.currentTime+dur);g.gain.setValueAtTime(.042,a.currentTime);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+dur);osc.connect(g);g.connect(a.destination);osc.start();osc.stop(a.currentTime+dur)}catch{}}
function toast(t){$('toast').textContent=t;$('toast').classList.add('visible');clearTimeout(toasty);toasty=setTimeout(()=>$('toast').classList.remove('visible'),2200)}
function begin(i){level=i;stage=STAGES[i];lamp={c:stage.lamp[0],r:stage.lamp[1],dir:stage.lamp[2],target:stage.lamp[3],drawAngle:stage.lamp[2]*Math.PI/2};objects=stage.mirrors.map((m,j)=>({id:j,c:m[0],r:m[1],slash:m[2],target:m[3],angle:m[2]?-Math.PI/4:Math.PI/4}));crates=stage.crates.map((item,j)=>({id:j,c:item[0][0],r:item[0][1],targetC:item[1][0],targetR:item[1][1],moved:false,visualX:x(item[0][0]),visualY:y(item[0][1])}));history=[];drag=null;steps=0;hints=0;finished=false;finishAt=0;started=performance.now();mode='game';backgroundDirty=true;trace=cast();$('levelNumber').textContent=`УРОВЕНЬ ${i+1} / 5`;$('levelTitle').textContent=stage.title;$('stars').textContent=(saved.stars[i]?'★'.repeat(saved.stars[i])+'☆'.repeat(3-saved.stars[i]):'☆☆☆');show(['hud']);guide();}
function menu(){mode='start';show(['start']);backgroundDirty=true}
function selectLevels(){mode='choose';show(['choose']);backgroundDirty=true;let host=$('levelGrid');host.innerHTML='';STAGES.forEach((s,i)=>{const b=document.createElement('button');b.disabled=i>saved.unlocked;b.innerHTML=`<strong>${i+1}</strong><small>${i>saved.unlocked?'🔒 Закрыт':saved.stars[i]?'★'.repeat(saved.stars[i])+'☆'.repeat(3-saved.stars[i]):s.title}</small>`;b.onclick=()=>begin(i);host.appendChild(b)})}
// Deterministic optical reflection. Direction: 0 up, 1 right, 2 down, 3 left.
function cast(){let c=lamp.c,r=lamp.r,d=lamp.dir;const path=[[x(c),y(r)]],seen=new Set();let hit='edge',blocked=null;
 for(let i=0;i<110;i++){
 const signature=`${c}/${r}/${d}`;if(seen.has(signature)){hit='loop';break}seen.add(signature);
 c+=dx[d];r+=dy[d];if(!inside(c,r)){const prev=path[path.length-1];path.push([prev[0]+dx[d]*C*.47,prev[1]+dy[d]*C*.47]);hit='edge';break}
 path.push([x(c),y(r)]);
 if(stage.goal[0]===c&&stage.goal[1]===r){hit='goal';break}
 const block=crates.find(q=>(q.moved?q.targetC:q.c)===c&&(q.moved?q.targetR:q.r)===r);if(block){hit='crate';blocked=block;break}
 const m=objects.find(q=>q.c===c&&q.r===r);if(m){blocked=m;d=m.slash?[3,2,1,0][d]:[1,0,3,2][d]}
 }
 return{path,hit,blocked};}
function recalc(){trace=cast();guide();if(trace.hit==='goal'&&!finished&&mode==='game'){finished=true;finishAt=performance.now();spark(x(stage.goal[0]),y(stage.goal[1]),55);sound(910,.25)}}
function nextIncorrect(){if(lamp.dir!==lamp.target)return {kind:'lamp',item:lamp};for(const m of objects)if(m.slash!==m.target)return{kind:'mirror',item:m};for(const c of crates)if(!c.moved)return{kind:'crate',item:c};return null}
function guide(){const n=nextIncorrect();if(!n){$('instruction').textContent='✨ Луч достиг портала!';$('explanation').textContent='Дверь открывается…';return}
 if(n.kind==='lamp'){$('instruction').textContent='👆 Нажми на фонарь';$('explanation').textContent='Он ПОВЕРНЁТСЯ и изменит направление луча'}
 else if(n.kind==='mirror'){$('instruction').textContent='👆 Нажми на синее зеркало';$('explanation').textContent='Зеркало ПОВЕРНЁТСЯ и отразит луч'}
 else{$('instruction').textContent='☝️ Перетащи деревянный ящик';$('explanation').textContent='Убери его с луча в зелёный квадрат'}
 activeGlow=n}
function doRotate(hit){if(mode!=='game'||finished)return;saveState();steps++;
 if(hit.kind==='lamp'){lamp.dir=(lamp.dir+1)%4;toast('Фонарь поворачивается!')}else{hit.item.slash=1-hit.item.slash;toast('Зеркало повернулось!')}
 const p=center(hit.item);spark(p[0],p[1],12);sound(hit.kind==='lamp'?490:680);recalc()}
function moveCrate(cr,complete){if(mode!=='game'||finished)return;const orig=cr.moved;if(orig===complete)return;saveState();cr.moved=complete;steps++;sound(280,.12);toast(complete?'Отлично! Луч больше не закрыт':'Ящик возвращён');spark(x(cr.targetC),y(cr.targetR),13);recalc()}
function undo(){if(mode!=='game'||!history.length)return;const h=history.pop();lamp.dir=h.lamp;objects.forEach((m,i)=>m.slash=h.mirrors[i]);crates.forEach((c,i)=>c.moved=h.crates[i]);finished=false;steps=Math.max(0,steps-1);sound(310);recalc();toast('Последний ход отменён')}
function hint(){if(mode!=='game'||finished)return;const n=nextIncorrect();if(!n){toast('Путь уже открыт!');return}hints++;if(n.kind==='lamp'){lamp.dir=lamp.target}else if(n.kind==='mirror'){n.item.slash=n.item.target}else{n.item.moved=true}steps++;spark(x(n.item.c),y(n.item.r),15);recalc();toast('Подсказка выполнила один правильный ход');sound(720,.13)}
function complete(){if(mode!=='game')return;mode='win';const starCount=Math.max(1,3-(steps>stage.par+3?1:0)-(hints?1:0));saved.stars[level]=Math.max(saved.stars[level]||0,starCount);saved.unlocked=Math.max(saved.unlocked,Math.min(4,level+1));save();$('resultStars').textContent='★'.repeat(starCount)+'☆'.repeat(3-starCount);$('winDescription').textContent=`Победа за ${steps} ходов · ${stage.title}`;$('next').textContent=level===4?'Вернуться к первому →':'Следующий уровень →';show(['win']);sound(850,.31)}
function pt(e){let b=canvas.getBoundingClientRect();return[(e.clientX-b.left)*W/b.width,(e.clientY-b.top)*H/b.height]}
function itemAt(px,py){const near=(o,r=39)=>Math.hypot(px-x(o.c),py-y(o.r))<r;
 for(const c of [...crates].reverse()){const cc=c.moved?c.targetC:c.c,rr=c.moved?c.targetR:c.r;if(Math.hypot(px-x(cc),py-y(rr))<46)return{kind:'crate',item:c}}
 for(const m of objects)if(near(m,43))return{kind:'mirror',item:m};if(near(lamp,46))return{kind:'lamp',item:lamp};return null}
canvas.addEventListener('pointerdown',e=>{if(mode!=='game'||finished)return;const [px,py]=pt(e),hit=itemAt(px,py);if(!hit)return;if(hit.kind==='crate'){drag={item:hit.item,startX:px,startY:py,px,py,dist:0};canvas.setPointerCapture(e.pointerId)}else doRotate(hit)});
canvas.addEventListener('pointermove',e=>{if(!drag)return;const [px,py]=pt(e);drag.px=px;drag.py=py;drag.dist=Math.hypot(px-drag.startX,py-drag.startY)});
function release(){if(!drag)return;const d=drag;drag=null;if(d.dist<12){toast('Перетащи ящик в зелёную клетку')}else if(Math.hypot(d.px-x(d.item.targetC),d.py-y(d.item.targetR))<C*1.3){moveCrate(d.item,true)}else if(Math.hypot(d.px-x(d.item.c),d.py-y(d.item.r))<C*1.3&&d.item.moved){moveCrate(d.item,false)}else{toast('Помести ящик в подсвеченный квадрат');sound(230)}}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
$('play').onclick=()=>begin(saved.unlocked);$('levelChoice').onclick=selectLevels;$('back').onclick=menu;$('pause').onclick=()=>{mode='pause';show(['pauseModal'])};$('resume').onclick=()=>{mode='game';show(['hud'])};$('again').onclick=()=>begin(level);$('toMenu').onclick=menu;$('undo').onclick=undo;$('reset').onclick=()=>begin(level);$('hint').onclick=hint;$('next').onclick=()=>begin(level===4?0:level+1);$('toChoice').onclick=selectLevels;
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&mode==='game')$('pause').click();else if(e.key==='Escape'&&mode==='pause')$('resume').click();else if((e.key==='Backspace'||e.key==='z')&&mode==='game')undo();else if(e.key==='h'&&mode==='game')hint()});
function rounded(cx,cy,w,h,r){ctx.beginPath();ctx.roundRect(cx,cy,w,h,r)}
function shine(cx,cy,r,color,opacity=.4){ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=opacity;const g=ctx.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,color);g.addColorStop(.3,color+'aa');g.addColorStop(1,'#00000000');ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();ctx.restore()}
function rubble(){// Slightly rough perimeter and the waters of a lost temple
 const gr=bctx.createLinearGradient(0,230,720,1090);gr.addColorStop(0,'#172c4b');gr.addColorStop(.5,'#20436a');gr.addColorStop(1,'#07162f');bctx.fillStyle=gr;bctx.fillRect(BX-34,BY-25,COLS*C+68,ROWS*C+52);
 for(let i=0;i<100;i++){const px=24+rnd(i*3)*672,py=BY-16+rnd(i*9)*ROWS*C+32;if(px>BX&&px<BX+COLS*C)continue;bctx.fillStyle=i%2?'#1e71998c':'#84c7d731';bctx.beginPath();bctx.ellipse(px,py,2+rnd(i)*13,1+rnd(i+6)*5,0,0,Math.PI*2);bctx.fill()}}
function tile(c,r){const px=BX+c*C,py=BY+r*C,k=c+11*r;const g=bctx.createLinearGradient(px,py,px+C,py+C);const q=rnd(k*31);g.addColorStop(0,`hsl(${218+q*17} 18% ${35+q*7}%)`);g.addColorStop(.45,`hsl(${214+q*12} 18% ${30+q*7}%)`);g.addColorStop(1,`hsl(${217+q*11} 24% ${18+q*7}%)`);
 bctx.shadowColor='#020b19';bctx.shadowBlur=3;bctx.shadowOffsetY=3;
 bctx.fillStyle=g;bctx.beginPath();bctx.roundRect(px+2,py+3,C-5,C-5,4);bctx.fill();bctx.save();bctx.clip();
 if(stone.complete&&stone.naturalWidth){const tileIndex=(k*7+3*r)%16;bctx.globalAlpha=.72;bctx.drawImage(stone,(tileIndex%4)*112,Math.floor(tileIndex/4)*112,112,112,px+2,py+3,C-5,C-5);bctx.globalAlpha=1}
 const shade=bctx.createLinearGradient(px,py,px+C,py+C);shade.addColorStop(0,'#f9d9a020');shade.addColorStop(.45,'#00000000');shade.addColorStop(1,'#0713268a');bctx.fillStyle=shade;bctx.fillRect(px+1,py+2,C-3,C-3);bctx.restore();bctx.shadowBlur=0;bctx.shadowOffsetY=0;
 bctx.strokeStyle='#d1c3a650';bctx.lineWidth=1.3;bctx.stroke();bctx.fillStyle='#d3bfa31a';bctx.fillRect(px+9,py+9,C-20,1);
 // tiny organic cracks, etched decorative masonry instead of a flat code-like grid
 if(q>.38){bctx.strokeStyle='#1024386d';bctx.lineWidth=1.5;bctx.beginPath();bctx.moveTo(px+12,py+27);bctx.lineTo(px+30,py+29);bctx.lineTo(px+35,py+38);bctx.lineTo(px+44,py+36);bctx.stroke()}
 if(q>.76){bctx.fillStyle='#244f32aa';for(let n=0;n<4;n++){bctx.beginPath();bctx.ellipse(px+8+n*6,py+C-9-n%2*5,7,3.6,(n-2)*.8,0,Math.PI*2);bctx.fill()}}}
function atmosphere(){bctx.clearRect(0,0,W,H);const img=images[mode==='start'?0:mode==='choose'?4:level];if(img&&img.complete&&img.naturalWidth){bctx.save();bctx.filter='blur(1.5px)';bctx.drawImage(img,0,170,941,1310,0,0,720,1280);bctx.restore()}
 const g=bctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#041127a3');g.addColorStop(.27,'#07162c70');g.addColorStop(.8,'#06152a66');g.addColorStop(1,'#03101fe4');bctx.fillStyle=g;bctx.fillRect(0,0,W,H);
 // amber windows and ruins, night sky
 for(let i=0;i<5;i++){const xx=42+rnd(i*7)*650,yy=160+rnd(i*12)*850;const rg=bctx.createRadialGradient(xx,yy,0,xx,yy,80);rg.addColorStop(0,'#ffba5d48');rg.addColorStop(1,'#0000');bctx.fillStyle=rg;bctx.fillRect(xx-85,yy-85,170,170)}
 if(mode!=='game'&&mode!=='pause'&&mode!=='win')return;
 rubble();bctx.save();bctx.shadowColor='#020618';bctx.shadowBlur=18;for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)tile(c,r);bctx.restore();
 // botanical hanging vines, blue water beyond carved edge
 for(let k=0;k<32;k++){let side=k%2?BX-16:BX+COLS*C+10;let yy=BY+28+k*22;const green=rnd(k*93);bctx.fillStyle=green>.5?'#28572b':'#4b7731';bctx.beginPath();bctx.ellipse(side+(k%2?1:-1)*12,yy,8+green*8,4+green*5,(k%5)*.4,0,Math.PI*2);bctx.fill()}
 const rim=bctx.createLinearGradient(BX,BY,BX+COLS*C,BY+ROWS*C);rim.addColorStop(0,'#c2ab75');rim.addColorStop(1,'#425271');bctx.strokeStyle=rim;bctx.lineWidth=6;bctx.strokeRect(BX-4,BY-3,COLS*C+8,ROWS*C+7);
 // Warm torch splashes on the edges
 for(const [xx,yy] of [[BX-9,BY+110],[BX+COLS*C+7,BY+155]]){const rg=bctx.createRadialGradient(xx,yy,3,xx,yy,116);rg.addColorStop(0,'#ffc06a92');rg.addColorStop(1,'#ffa93100');bctx.fillStyle=rg;bctx.fillRect(xx-116,yy-116,232,232)}
}
function drawTorch(tx,ty,t){ctx.save();ctx.translate(tx,ty);ctx.shadowColor='#ffbb56';ctx.shadowBlur=22;ctx.fillStyle='#ffe2a0';ctx.beginPath();ctx.moveTo(0,-16-3*Math.sin(t/180));ctx.quadraticCurveTo(-16,-1,0,17);ctx.quadraticCurveTo(14,0,0,-16-3*Math.sin(t/180));ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#77512a';ctx.fillRect(-6,20,12,24);ctx.strokeStyle='#c39a52';ctx.lineWidth=3;ctx.strokeRect(-8,-5,16,24);ctx.restore()}
function mirror(cx,cy,m,t){const wanted=m.slash?-Math.PI/4:Math.PI/4;m.angle+=((wanted-m.angle+Math.PI*3)%(Math.PI*2)-Math.PI)*.19;const active=activeGlow&&activeGlow.item===m&&mode==='game';
 shine(cx,cy,70,active?'#45bcff':'#3675c7',active?.33:.16);ctx.save();ctx.translate(cx,cy+4);ctx.shadowColor='#000f';ctx.shadowBlur=17;ctx.shadowOffsetY=13;ctx.fillStyle='#493c3c';rounded(-45,-18,90,38,9);ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.rotate(m.angle);
 const rim=ctx.createLinearGradient(-48,-15,47,18);rim.addColorStop(0,'#fff3b4');rim.addColorStop(.28,'#94723a');rim.addColorStop(.67,'#d6c190');rim.addColorStop(1,'#5d513e');ctx.fillStyle=rim;rounded(-51,-14,102,28,5);ctx.fill();
 const glass=ctx.createLinearGradient(-46,-14,43,14);glass.addColorStop(0,'#0c3568');glass.addColorStop(.24,'#54c6f2');glass.addColorStop(.48,'#c9faff');glass.addColorStop(.65,'#367abd');glass.addColorStop(1,'#091f55');ctx.fillStyle=glass;rounded(-46,-10,92,20,3);ctx.fill();ctx.strokeStyle='#d6ffffa9';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-37,-5);ctx.lineTo(18,-5);ctx.lineTo(34,6);ctx.stroke();ctx.restore();
 if(active){ctx.strokeStyle=`rgba(166,228,255,${.5+.3*Math.sin(t/260)})`;ctx.lineWidth=3;ctx.beginPath();ctx.arc(cx,cy,58,0,Math.PI*2);ctx.stroke()}}
function lampSprite(cx,cy,angle,t,active){shine(cx,cy,80,'#ffab40',active?.42:.26);ctx.save();ctx.translate(cx,cy);ctx.fillStyle='#130f18ba';ctx.beginPath();ctx.ellipse(4,30,44,16,0,0,Math.PI*2);ctx.fill();
 // Engraved pedestal remains grounded; the whole brass emitter barrel rotates
 const stem=ctx.createLinearGradient(-20,0,20,0);stem.addColorStop(0,'#442414');stem.addColorStop(.4,'#ca914d');stem.addColorStop(.74,'#7d4a2c');stem.addColorStop(1,'#261a19');ctx.fillStyle=stem;rounded(-22,12,44,18,4);ctx.fill();ctx.fillStyle='#b17b40';ctx.fillRect(-5,-3,10,22);
 ctx.rotate(angle);const metal=ctx.createLinearGradient(-23,-52,24,-48);metal.addColorStop(0,'#34252c');metal.addColorStop(.16,'#e1a75c');metal.addColorStop(.39,'#9d6032');metal.addColorStop(.7,'#e3bd75');metal.addColorStop(1,'#57361f');ctx.fillStyle=metal;rounded(-23,-44,46,61,12);ctx.fill();ctx.strokeStyle='#e8bb73';ctx.lineWidth=4;ctx.strokeRect(-22,-46,44,8);ctx.strokeStyle='#502b27';ctx.lineWidth=3;ctx.strokeRect(-23,-6,46,7);
 ctx.shadowBlur=15;ctx.shadowColor='#ffe5a0';ctx.fillStyle='#ffe8ab';ctx.beginPath();ctx.ellipse(0,-44,17,8,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
 ctx.strokeStyle='#684d37';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-9,16);ctx.lineTo(-18,27);ctx.moveTo(9,16);ctx.lineTo(18,27);ctx.stroke();ctx.restore();
 if(active){ctx.save();ctx.strokeStyle=`rgba(255,227,146,${.7+.2*Math.sin(t/230)})`;ctx.lineWidth=4;ctx.beginPath();ctx.arc(cx,cy,60,-2,2);ctx.stroke();ctx.restore()}}
function crateSprite(cx,cy,t,active,held){ctx.save();ctx.translate(cx,cy);ctx.shadowColor='#000e';ctx.shadowBlur=14;ctx.shadowOffsetY=9;ctx.fillStyle='#2b1b16';rounded(-34,-32,68,68,5);ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
 let wood=ctx.createLinearGradient(-30,-33,32,32);wood.addColorStop(0,'#c18a4a');wood.addColorStop(.4,'#9a5f31');wood.addColorStop(1,'#482a22');ctx.fillStyle=wood;rounded(-32,-32,64,62,4);ctx.fill();ctx.strokeStyle='#482b1e';ctx.lineWidth=8;ctx.strokeRect(-29,-29,58,54);ctx.strokeStyle='#d2a161';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-24,-24);ctx.lineTo(25,25);ctx.moveTo(25,-24);ctx.lineTo(-24,25);ctx.stroke();ctx.fillStyle='#d8b479';for(const xx of [-24,24])for(const yy of [-22,22]){ctx.beginPath();ctx.arc(xx,yy,2.7,0,Math.PI*2);ctx.fill()}ctx.restore();
 if(active||held){ctx.save();ctx.strokeStyle='#ffdb93';ctx.lineWidth=3;ctx.setLineDash([7,5]);ctx.beginPath();ctx.arc(cx,cy,48,0,Math.PI*2);ctx.stroke();ctx.restore()}}
function portal(cx,cy,t){const pulse=.55+.45*Math.sin(t/430),won=finished||mode==='win';shine(cx,cy,won?142:100,'#ffbb43',won?.65:.35);ctx.save();ctx.translate(cx,cy+3);ctx.scale(1.32,1.32);ctx.shadowColor='#ffab44';ctx.shadowBlur=16;const g=ctx.createLinearGradient(-33,-40,37,32);g.addColorStop(0,'#6b5132');g.addColorStop(.43,'#e4c17f');g.addColorStop(1,'#695044');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-37,39);ctx.lineTo(-37,-9);ctx.arc(0,-9,37,Math.PI,0);ctx.lineTo(37,39);ctx.closePath();ctx.fill();ctx.fillStyle=won?'#fff2af':'#8d4f26';ctx.beginPath();ctx.moveTo(-27,31);ctx.lineTo(-27,-10);ctx.arc(0,-10,27,Math.PI,0);ctx.lineTo(27,31);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
 ctx.strokeStyle=won?'#ffcc60':'#ffed9f';ctx.lineWidth=4;ctx.beginPath();for(let i=0;i<130;i++){let a=.12*i+t/1200,r=(25-i*.155)*Math.max(.24,pulse);const xx=Math.cos(a)*r,yy=-9+Math.sin(a)*r;if(i===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy)}ctx.stroke();ctx.restore()}
function shineBeams(t){if(!trace)return;const points=trace.path;ctx.save();ctx.lineJoin='round';ctx.lineCap='round';ctx.globalCompositeOperation='screen';for(const [width,alpha,blur] of [[43,.17,38],[22,.32,20],[9,.75,13],[3,1,7]]){ctx.beginPath();points.forEach(([xx,yy],i)=>i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy));ctx.strokeStyle='#ffd76d';ctx.lineWidth=width;ctx.globalAlpha=alpha;ctx.shadowColor='#ffba4c';ctx.shadowBlur=blur;ctx.stroke()}ctx.restore();
 let length=0;for(let i=1;i<points.length;i++)length+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);if(!length)return;const progress=((t*.14)%length);let left=progress;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(left<len){const p=left/len;shine(a[0]+(b[0]-a[0])*p,a[1]+(b[1]-a[1])*p,20,'#fff9be',.4);break}left-=len}}
function shadowHero(cx,cy,t){ctx.save();ctx.translate(cx,cy);ctx.fillStyle='#030a1c90';ctx.beginPath();ctx.ellipse(9,35,35,13,0,0,Math.PI*2);ctx.fill();const sway=Math.sin(t/400)*2;ctx.fillStyle='#17172a';ctx.beginPath();ctx.ellipse(0,-3+sway,17,26,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#b3272c';ctx.beginPath();ctx.moveTo(-8,-16);ctx.quadraticCurveTo(-42,4+sway,-36,36);ctx.lineTo(0,21);ctx.closePath();ctx.fill();ctx.fillStyle='#251b21';ctx.beginPath();ctx.arc(0,-30+sway,14,0,Math.PI*2);ctx.fill();ctx.fillStyle='#201724';for(const s of [-1,1]){ctx.beginPath();ctx.ellipse(s*10,-37+sway,8,11,s*.5,0,Math.PI*2);ctx.fill()}ctx.strokeStyle='#120f1e';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(-8,19);ctx.lineTo(-10,33);ctx.moveTo(8,19);ctx.lineTo(10,33);ctx.stroke();ctx.restore()}
function ghostArrow(obj,t){if(!obj||mode!=='game'||finished)return;const xx=x(obj.item.c),yy=y(obj.item.r),pulse=(Math.sin(t/330)+1)/2;ctx.save();ctx.shadowColor='#ffdf74';ctx.shadowBlur=17;ctx.strokeStyle=`rgba(255,235,150,${.6+.3*pulse})`;ctx.lineWidth=3;ctx.beginPath();ctx.arc(xx,yy,56,-2.1,-.5);ctx.stroke();ctx.beginPath();ctx.moveTo(xx+49,yy-27);ctx.lineTo(xx+55,yy-10);ctx.lineTo(xx+39,yy-14);ctx.stroke();ctx.restore()}
function spark(px,py,count){for(let i=0;i<count;i++){const a=rnd(i+performance.now())*Math.PI*2,spd=1+rnd(i*4+px)*3;particles.push({x:px,y:py,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd-1,life:40+rnd(i)*40,col:i%2?'#a9e5ff':'#fff2a9'})}}
function particleRender(){ctx.save();for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx;p.y+=p.vy;p.vy+=.05;p.life-=1.2;if(p.life<=0){particles.splice(i,1);continue}ctx.globalAlpha=Math.min(.9,p.life/60);ctx.fillStyle=p.col;ctx.shadowColor=p.col;ctx.shadowBlur=7;ctx.beginPath();ctx.arc(p.x,p.y,2,0,Math.PI*2);ctx.fill()}ctx.restore()}
function draw(t){if(backgroundDirty){atmosphere();backgroundDirty=false}ctx.drawImage(background,0,0);
 if(mode==='game'||mode==='pause'||mode==='win'){
  drawTorch(BX-7,BY+105,t);drawTorch(BX+COLS*C+7,BY+155,t);const goal=stage.goal;portal(x(goal[0]),y(goal[1]),t);shineBeams(t);
  // Drop target deliberately visible, distinct from the crate's original space.
  crates.forEach(c=>{if(!c.moved){ctx.save();const px=x(c.targetC),py=y(c.targetR);ctx.strokeStyle=`rgba(149,250,149,${.6+.2*Math.sin(t/290)})`;ctx.fillStyle='#45b34a23';ctx.lineWidth=3;ctx.setLineDash([10,7]);rounded(px-35,py-36,70,72,8);ctx.fill();ctx.stroke();ctx.restore()}});
  objects.forEach(m=>mirror(x(m.c),y(m.r),m,t));lamp.drawAngle+=((lamp.dir*Math.PI/2-lamp.drawAngle+Math.PI*3)%(Math.PI*2)-Math.PI)*.16;lampSprite(x(lamp.c),y(lamp.r),lamp.drawAngle,t,activeGlow&&activeGlow.kind==='lamp');
  crates.forEach(c=>{const cpos=c.moved?[c.targetC,c.targetR]:[c.c,c.r];if(drag&&drag.item===c){crateSprite(drag.px,drag.py,t,true,true)}else{const cx=x(cpos[0]),cy=y(cpos[1]);c.visualX+=(cx-c.visualX)*.18;c.visualY+=(cy-c.visualY)*.18;crateSprite(c.visualX,c.visualY,t,activeGlow&&activeGlow.item===c,false)}});
  const heroX=x(0),heroY=y(8);if(finished){const pct=Math.min(1,(t-finishAt)/1300);shadowHero(heroX+(x(goal[0])-heroX)*pct,heroY+(y(goal[1])-heroY)*pct,t)}else shadowHero(heroX,heroY,t);ghostArrow(activeGlow,t);
  if(finished&&t-finishAt>1350)complete();
 }particleRender();requestAnimationFrame(draw)}
// Stable test hooks for verifying actual optics, rotation, drag and level progression.
window.svetTest={start:begin,rotateLamp:()=>doRotate({kind:'lamp',item:lamp}),rotateMirror:i=>doRotate({kind:'mirror',item:objects[i]}),moveCrate:i=>moveCrate(crates[i],true),state:()=>({mode,level,steps,lamp:lamp?.dir,mirrors:objects.map(m=>m.slash),crates:crates.map(c=>c.moved),trace:trace?{hit:trace.hit,path:trace.path}:null,unlocked:saved.unlocked})};
requestAnimationFrame(draw);
})();