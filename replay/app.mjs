import {paths,ROAD_WIDTH,routeFor,positionAt,newRace,advance,raceResult,validateTrack} from './core.mjs';
const $=id=>document.getElementById(id),canvas=$('track'),ctx=canvas.getContext('2d');
const colors=['#54b9ff','#ff656c'],names=['Azul','Rojo'],keys=['blue','red'];
let replayData=null,replayElapsed=0,replayPaused=false;
let autoCamera=true, cameraStep=-1;
let view='perspective',showRoutes=false,phase='ready',resumePhase='running',race=null,countTime=0,lastFrame=0,seed=Date.now()|0,w=0,h=0,dpr=1,s=1,ox=0,oy=0,confettiAt=0;
const ground=document.createElement('canvas'),bridge=document.createElement('canvas');
const check=validateTrack();
window.__DM_APP_STARTED__ = true;
$('validationDetails').innerHTML=check.ok?'<b>✓ Geometría comprobada</b><br>✓ Un único cruce, separado en altura<br>✓ Ninguna autointersección en los recorridos<br>✓ Separación entre carriles al mismo nivel<br>✓ Enlaces continuos en la recta de meta<br>✓ Azul por túnel y rojo por puente en la primera vuelta':'El trazado necesita revisión.';
if(!check.ok){$('start').disabled=true;$('statusText').textContent='Trazado pendiente de revisión';console.error(check.errors);}
const format=n=>n.toFixed(3),clock=n=>{const m=Math.floor(n/60).toString().padStart(2,'0'),v=(n%60).toFixed(3).padStart(6,'0');return `${m}:${v.slice(0,2)}<span>${v.slice(2)}</span>`;};
function project(x,y,z=0){const t=view==='overhead'?1:.70,skew=view==='overhead'?0:.12;return {x:ox+(x-535+(y-300)*skew)*s,y:oy+((y-300)*t-z*(view==='overhead'?.10:.67))*s};}
function poly(c,pts,color,stroke=null,width=1){c.beginPath();pts.forEach((p,i)=>{const q=project(...p);i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y);});c.closePath();c.fillStyle=color;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width*s;c.stroke();}}
function line(c,pts,color,width=1,dash=[]){c.beginPath();pts.forEach((p,i)=>{const q=project(...p);i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y);});c.strokeStyle=color;c.lineWidth=width*s;c.setLineDash(dash.map(v=>v*s));c.stroke();c.setLineDash([]);}
function offset(path,i,amount,zdelta=0){const p=path.points[i],a=path.points[Math.max(0,i-1)],b=path.points[Math.min(path.points.length-1,i+1)],angle=Math.atan2(b[1]-a[1],b[0]-a[0]);return[p[0]-Math.sin(angle)*amount,p[1]+Math.cos(angle)*amount,p[2]+zdelta];}
function road(c,path,start=0,end=path.points.length-1,raised=false){const indices=[];for(let i=start;i<=end;i+=2)indices.push(i);if(indices.at(-1)!==end)indices.push(end);const strip=half=>indices.map(i=>offset(path,i,half)).concat(indices.slice().reverse().map(i=>offset(path,i,-half)));
 if(raised){poly(c,indices.map(i=>offset(path,i,21,-8)).concat(indices.slice().reverse().map(i=>offset(path,i,-21,-8))),'#101b22');}
 poly(c,strip(22),'#59615d');poly(c,strip(20),'#c5c7ba');poly(c,strip(17.5),'#303c43');
 for(let k=1;k<indices.length;k+=1){const i=indices[k-1],j=indices[k];const distance=path.distances[i];if(Math.floor(distance/12)%2===0){for(const side of[-1,1])poly(c,[offset(path,i,side*18),offset(path,j,side*18),offset(path,j,side*21),offset(path,i,side*21)],'#ae5146');}}
 line(c,indices.map(i=>offset(path,i,0,.2)),'#adb7b04d',.7,[7,14]);
 if(showRoutes){const col=path===paths.tunnel?'#54b9ff':'#ff656c';line(c,indices.map(i=>offset(path,i,0,.5)),col+'a0',1.5,[5,8]);for(let dist=200;dist<path.length-70;dist+=370){const p=path.at(dist);if(p.z<.5&&raised)continue;if(raised===false&&p.z>2)continue;arrow(c,p,col);}}
 if(raised){line(c,indices.map(i=>offset(path,i,21,7)),'#9aa59d',1.4);line(c,indices.map(i=>offset(path,i,-21,7)),'#9aa59d',1.4);for(let k=0;k<indices.length;k+=10){const i=indices[k];for(const side of[-1,1])line(c,[offset(path,i,side*21,-3),offset(path,i,side*21,8)],'#566761',1.8);}}
}
function arrow(c,p,color){const a=p.angle,local=(x,y)=>[p.x+Math.cos(a)*x-Math.sin(a)*y,p.y+Math.sin(a)*x+Math.cos(a)*y,p.z+1];line(c,[local(-4,-4),local(2,0),local(-4,4)],color,1.6);}
function textAt(c,text,x,y,z,color,size=10,align='center'){const p=project(x,y,z);c.font=`600 ${Math.max(6,size*s)}px Arial`;c.textAlign=align;c.fillStyle=color;c.fillText(text,p.x,p.y);}
function cache(){for(const c of[ground,bridge]){c.width=w*dpr;c.height=h*dpr;c.getContext('2d').scale(dpr,dpr);}const g=ground.getContext('2d'),b=bridge.getContext('2d');
 // Raised rectangular table, grass infield, and the same asymmetric lobes as the photo.
 poly(g,[[28,48,-14],[1047,48,-14],[1047,565,-14],[28,565,-14]],'#302720');
 poly(g,[[28,48,0],[1047,48,0],[1047,565,0],[28,565,0]],'#665241','#87725c',1);
 poly(g,[[43,62,0],[1033,62,0],[1033,550,0],[43,550,0]],'#253e32');
 let random=41;for(let n=0;n<2000;n++){random=(random*1664525+1013904223)>>>0;const x=48+random/4294967296*980;random=(random*1664525+1013904223)>>>0;const y=65+random/4294967296*480;const p=project(x,y,0);g.fillStyle=n%2?'#6a825a25':'#0e241c35';g.fillRect(p.x,p.y,1.4*s,1*s);}
 // Track furniture stays outside the driving surface.
 for(const loc of[[66,95],[1019,82],[65,527],[1015,526]]){const[x,y]=loc;line(g,[[x,y,0],[x,y,35]],'#5a6b63',2);poly(g,[[x-7,y-3,35],[x+7,y-3,35],[x+7,y+3,35],[x-7,y+3,35]],'#d4d4a8');}
 // Bridge shadow and columns; the tunnel centre is left unobstructed.
 const elevated=paths.bridge.points.filter(p=>p[2]>5);line(g,elevated.map(p=>[p[0]+4,p[1]+10,0]),'#0a1217aa',45);
 for(const d of[710,910]){const p=paths.bridge.at(d);if(p.z<12)continue;for(const side of[-1,1]){const x=p.x-Math.sin(p.angle)*side*24,y=p.y+Math.cos(p.angle)*side*24;poly(g,[[x-4,y-4,0],[x+4,y-4,0],[x+4,y+4,0],[x-4,y+4,0]],'#2f3a33');line(g,[[x,y,0],[x,y,p.z-6]],'#758077',6);}}
 road(g,paths.bridge);road(g,paths.tunnel);
 let start=paths.bridge.points.findIndex(p=>p[2]>1),end=paths.bridge.points.length-1;while(paths.bridge.points[end][2]<=1)end--;road(b,paths.bridge,start-1,end+1,true);
 // A single finish gantry spans both lanes, with checker stripes at x=560.
 for(let row=0;row<2;row++)for(let col=0;col<12;col++){const x=556+row*4,y=455+col*8;poly(g,[[x,y,.4],[x+4,y,.4],[x+4,y+8,.4],[x,y+8,.4]],(col+row)%2?'#19232b':'#e3e3d3');}
 line(g,[[568,450,0],[568,450,35],[568,550,35],[568,550,0]],'#10171d',7);
 for(let j=0;j<6;j++){const p=project(568,460+j*15,37);g.fillStyle=['#5cd7e4','#5c90ff','#9171ff','#ec64c6','#fd9566','#b4e08c'][j];g.shadowColor=g.fillStyle;g.shadowBlur=5*s;g.beginPath();g.arc(p.x,p.y,2.5*s,0,Math.PI*2);g.fill();g.shadowBlur=0;}
 textAt(g,'DRIFT',568,503,40,'#e6e8d7',7);textAt(g,'LARGADA / META',625,549,1,'#9caa96',9);
 if(showRoutes){textAt(g,'TÚNEL',420,300,0,'#7dc7ec',10);line(g,[[420,289,0],[441,258,0]],'#72a8c083',1);textAt(b,'PUENTE',519,259,115,'#f2b1a2',10);}
 textAt(g,'1 / 24',272,385,0,'#7b947c55',29);textAt(g,'DRIFT MASTERS',300,408,0,'#7b947c66',10);
}
function resize(){const r=canvas.getBoundingClientRect();w=r.width;h=r.height;dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);const height=view==='overhead'?535:408;s=Math.min((w-38)/1070,(h-95)/height);ox=w/2;oy=h/2+7;cache();}
function drawCar(car,p){const id=car.id,c=ctx;const drift=phase==='running'&&p.z<1?Math.sin(car.distance/36)*.055:0,a=p.angle+drift;const loc=(x,y,z=0)=>[p.x+Math.cos(a)*x-Math.sin(a)*y,p.y+Math.sin(a)*x+Math.cos(a)*y,p.z+z];const rect=(x1,y1,x2,y2,z,color)=>poly(c,[loc(x1,y1,z),loc(x2,y1,z),loc(x2,y2,z),loc(x1,y2,z)],color);
 poly(c,[loc(-17,-9,0),loc(17,-9,0),loc(17,9,0),loc(-17,9,0)],'#050c11aa');
 for(const x of[-10,9])for(const y of[-8,8])rect(x-4,y-2,x+4,y+2,3,'#0c1116');
 poly(c,[loc(16,-5,4),loc(12,-8,4),loc(-12,-8,4),loc(-16,-5,4),loc(-16,5,4),loc(-12,8,4),loc(12,8,4),loc(16,5,4)],id===0?'#178ed3':'#d83d4b','#0b151e',.6);
 poly(c,[loc(15,-5,6),loc(11,-7,6),loc(-12,-7,6),loc(-15,-4,6),loc(-15,4,6),loc(-12,7,6),loc(11,7,6),loc(15,5,6)],colors[id]);
 rect(-14,-2,14,2,6.2,'#e4edf0');rect(-6,-6,7,6,8,'#0b293b');rect(-4,-5,3,5,10,id===0?'#2385bd':'#d9515a');rect(-2,-1.4,3,1.4,10.2,'#d5e3e6');
 rect(-15,-10,-12,10,9,'#111d29');rect(12,-6,15,-3,7,'#fff9c3');rect(12,3,15,6,7,'#fff9c3');rect(-15,-6,-14,-3,6,'#ff3e51');rect(-15,3,-14,6,6,'#ff3e51');
 const q=project(p.x,p.y,p.z+23);c.fillStyle=colors[id];c.font=`bold ${Math.max(8,10*s)}px Arial`;c.textAlign='center';c.fillText(id===0?'01':'02',q.x,q.y);
}
function draw(now){ctx.clearRect(0,0,w,h);ctx.drawImage(ground,0,0,w,h);const cars=(race?race.cars:[{id:0,distance:0},{id:1,distance:0}]).map(c=>({car:c,p:positionAt(c.id,c.distance,race?.laps||Number($('laps').value))}));for(const o of cars.filter(o=>o.p.z<1).sort((a,b)=>a.p.y-b.p.y))drawCar(o.car,o.p);ctx.drawImage(bridge,0,0,w,h);for(const o of cars.filter(o=>o.p.z>=1).sort((a,b)=>a.p.y-b.p.y))drawCar(o.car,o.p);
 if(phase==='finished'&&now-confettiAt<3000){const age=(now-confettiAt)/1000;for(let j=0;j<46;j++){const x=(j*113%Math.max(1,w))+Math.sin(j+age*2)*12,y=age*(35+j%30)-j*3;if(y<0)continue;ctx.fillStyle=['#ff7043','#54b9ff','#e5d3ac'][j%3];ctx.fillRect(x,y,4,2);}}
}
function lock(isLocked){for(const id of['laps','blueSpeed','redSpeed'])$(id).disabled=isLocked;}
function setState(text,stage){$('statusText').textContent=text;$('stageState').textContent=stage;}
function reset(){$('saveFinish').disabled=true;replayData=null;replayElapsed=0;replayPaused=false;updateReplayButtons();phase='ready';race=null;countTime=0;$('countdown').hidden=true;lock(false);$('pause').disabled=true;$('pause').textContent='Ⅱ Pausar';$('start').disabled=!check.ok;$('start').innerHTML='<span>▶</span> Iniciar carrera <span>↗</span>';setState('Todo listo para largar','AUTOS EN POSICIÓN');$('clock').innerHTML=clock(0);$('resultTitle').textContent='La pista está lista.';$('resultTitle').style.color='';$('resultDetail').textContent='El ganador y la diferencia aparecen acá al llegar.';$('resultTag').textContent='ESPERANDO LARGADA';document.body.classList.remove('paused');updateTelemetry();}
function start(){if(phase==='replay'||phase==='replay-paused')reset();if(!check.ok||['running','countdown','paused'].includes(phase))return;race=newRace({laps:Number($('laps').value),speeds:[Number($('blueSpeed').value)/100,Number($('redSpeed').value)/100],seed:++seed});phase='countdown';countTime=0;lock(true);$('pause').disabled=false;$('start').disabled=true;$('resultTitle').textContent='Concentración total.';$('resultDetail').textContent='La largada se habilita después de la cuenta regresiva.';$('resultTitle').style.color='';$('resultTag').textContent='PREPARADOS';$('countdown').hidden=false;$('countdown').textContent='3';setState('Secuencia de largada','CUENTA REGRESIVA');updateTelemetry();}
function pause(){if(phase==='paused'){phase=resumePhase;$('pause').textContent='Ⅱ Pausar';document.body.classList.remove('paused');setState(phase==='countdown'?'Secuencia de largada':'Carrera en curso',phase==='countdown'?'CUENTA REGRESIVA':'CARRERA EN VIVO');}else if(phase==='running'||phase==='countdown'){resumePhase=phase;phase='paused';$('pause').textContent='▶ Continuar';document.body.classList.add('paused');setState('Carrera pausada','PAUSA');}}
function finish(now){phase='finished';$('pause').disabled=true;lock(false);$('start').disabled=false;$('start').innerHTML='<span>▶</span> Correr de nuevo <span>↗</span>';const r=raceResult(race),winner=r.winner;setState('Carrera finalizada','BANDERA A CUADROS');$('resultTitle').textContent=winner===null?'¡Empate!':`¡Gana el ${names[winner]}!`;$('resultTitle').style.color=winner===null?'#f3e0b2':colors[winner];$('resultDetail').textContent=winner===null?'Ambos autos cruzaron juntos.':`${format(r.times[winner])} s · Ventaja de ${format(r.gap)} s`;$('resultTag').textContent=`${race.laps} VUELTA${race.laps>1?'S':''} COMPLETADA${race.laps>1?'S':''}`;confettiAt=now;}
function updateTelemetry(){const laps=race?.laps||Number($('laps').value);const result=race?raceResult(race):null;for(let id=0;id<2;id++){const key=keys[id],car=race?.cars[id],p=positionAt(id,car?.distance||0,laps),progress=car?car.distance/car.total:0;$(key+'Progress').style.width=`${progress*100}%`;$(key+'Percent').textContent=`${Math.floor(progress*100)}%`;$(key+'Lap').textContent=`Vuelta ${car?.finish!==null&&car?laps:car&&phase!=='countdown'?p.lap+1:0} / ${laps}`;$(key+'Time').innerHTML=car?.finish!=null?`${format(car.finish)}<small> s</small>`:'—<small> s</small>';
 let loc=id===0?'En posición · túnel primero':'En posición · puente primero';if(car&&phase!=='countdown'){loc=car.finish!==null?'Llegada confirmada':p.path===paths.bridge?(p.z>4?'Sobre el puente':'Recorrido del puente'):'Recorrido del túnel';if(p.path===paths.tunnel&&p.x>420&&p.x<480&&p.y>215&&p.y<275)loc='Dentro del túnel';}$(key+'Location').textContent=loc;
 $(key+'Place').textContent=result?(result.winner===null?'=1':result.winner===id?'1º':'2º'):(car&&car.distance>0?(car.distance/car.total>=race.cars[1-id].distance/race.cars[1-id].total?'1º':'2º'):'—');}}

// REPLAY DIFERIDO. Los tiempos de la micro:bit son acumulados desde GO (ms).
// Movimiento uniforme en cada vuelta; NO representa posiciones reales intermedias.
const realFields=['realBlue1','realBlueTotal','realRed1','realRedTotal'];
function loadReplayValues(x){
  const v=[x.azul1,x.azulTotal,x.rojo1,x.rojoTotal];
  v.forEach((n,i)=>$(realFields[i]).value=Number.isFinite(n)&&n>=0?(n/1000).toFixed(3):'');
  $('realStatus').textContent='Datos importados. Pulsá Reproducir carrera.';
}
function getReplayTimes(){
  const values=realFields.map(id=>$(id).value.trim()===''?NaN:Number($(id).value)*1000);
  if(values.some(v=>!Number.isFinite(v)||v<=0))throw Error('Ingresá los cuatro tiempos mayores que cero.');
  if(values[1]<=values[0]||values[3]<=values[2])throw Error('El tiempo total debe superar el de la primera vuelta de cada auto.');
  if(values.some(v=>v>600000))throw Error('Los tiempos deben ser menores que 600 segundos.');
  return {azul1:values[0],azulTotal:values[1],rojo1:values[2],rojoTotal:values[3]};
}
function updateReplayButtons(){
  $('realPause').disabled=!['replay','replay-paused'].includes(phase);
  $('realPause').textContent=phase==='replay-paused'?'▶ Continuar':'Ⅱ Pausar';
}
function setReplayView(mode){
  if(view===mode)return;
  view=mode;
  for(const m of ['perspective','overhead']){$(m).classList.toggle('active',m===mode);$(m).setAttribute('aria-pressed',String(m===mode));}
  resize();
}
function updateReplayCamera(){
  if(!autoCamera||!replayData)return;
  const first=Math.min(replayData.azul1,replayData.rojo1)/1000;
  const end=Math.min(replayData.azulTotal,replayData.rojoTotal)/1000;
  const step=replayElapsed<first*.60?0:replayElapsed<first*1.15?1:replayElapsed<end*.82?2:3;
  if(step!==cameraStep){cameraStep=step;setReplayView(step===1||step===3?'overhead':'perspective');}
}
function updateRealReplay(dt){
  if(!replayData)return;
  const speed=Number($('realSpeed').value)||1;
  const limit=Math.max(replayData.azulTotal,replayData.rojoTotal)/1000;
  replayElapsed=Math.min(limit,replayElapsed+dt*speed);
  updateReplayCamera();
  race.time=replayElapsed;
  race.cars.forEach((car,id)=>{
    const first=(id===0?replayData.azul1:replayData.rojo1)/1000;
    const total=(id===0?replayData.azulTotal:replayData.rojoTotal)/1000;
    const distanceFirst=routeFor(id,0).length;
    const distanceSecond=routeFor(id,1).length;
    car.distance= replayElapsed<=first? distanceFirst*Math.min(1,replayElapsed/first)
      : distanceFirst+distanceSecond*Math.min(1,(replayElapsed-first)/(total-first));
    car.finish=replayElapsed>=total?total:null;
  });
  race.done=race.cars.every(car=>car.finish!==null);
  $('clock').innerHTML=clock(replayElapsed);
  $('realBlueInfo').textContent=`Azul · V1 ${(replayData.azul1/1000).toFixed(3)}s · V2 ${((replayData.azulTotal-replayData.azul1)/1000).toFixed(3)}s`;
  $('realRedInfo').textContent=`Rojo · V1 ${(replayData.rojo1/1000).toFixed(3)}s · V2 ${((replayData.rojoTotal-replayData.rojo1)/1000).toFixed(3)}s`;
  $('realStatus').textContent=`Reproduciendo: ${replayElapsed.toFixed(3)} / ${limit.toFixed(3)} s · ${speed}×`;
  updateTelemetry();
  if(race.done){
    const result=raceResult(race);phase='replay-finished';confettiAt=performance.now();$('saveFinish').disabled=false;
    $('realStatus').textContent='Repetición completa. Ganador real: '+(result.winner===null?'EMPATE':names[result.winner].toUpperCase());
    $('resultTitle').textContent=result.winner===null?'¡Empate!':`¡Gana el ${names[result.winner]}!`;
    $('resultTitle').style.color=result.winner===null?'#f3e0b2':colors[result.winner];
    $('resultDetail').textContent=`Azul ${(replayData.azulTotal/1000).toFixed(3)} s · Rojo ${(replayData.rojoTotal/1000).toFixed(3)} s · Diferencia ${(result.gap).toFixed(3)} s`;
    $('resultTag').textContent='REPETICIÓN REAL · DOS VUELTAS';
    setState('Repetición terminada','BANDERA A CUADROS');
    $('realStart').disabled=false;updateReplayButtons();
  }
}
function beginRealReplay(){
  try{
    const data=getReplayTimes();if(!check.ok)throw Error('El trazado no superó la validación.');
    reset();replayData=data;replayElapsed=0;cameraStep=-1;
    race={time:0,laps:2,done:false,cars:[0,1].map(id=>({id,distance:0,finish:null,total:routeFor(id,0).length+routeFor(id,1).length}))};
    phase='replay';lock(true);$('start').disabled=true;$('pause').disabled=true;$('realStart').disabled=true;
    $('countdown').hidden=true;$('resultTitle').textContent='Repetición en marcha';
    $('resultDetail').textContent='Dos vueltas reconstruidas con los tiempos reales de cada auto.';
    $('resultTag').textContent='RACE REPLAY';setState('Reproduciendo carrera real','REPETICIÓN REAL');
    updateReplayButtons();updateRealReplay(0);
  }catch(error){$('realStatus').textContent='⚠ '+error.message;}
}
$('realStart').addEventListener('click',beginRealReplay);
$('realPause').addEventListener('click',()=>{
  if(phase==='replay'){phase='replay-paused';setState('Repetición pausada','PAUSA');}
  else if(phase==='replay-paused'){phase='replay';setState('Reproduciendo carrera real','REPETICIÓN REAL');}
  updateReplayButtons();
});
$('realReset').addEventListener('click',()=>{reset();$('realStatus').textContent='Repetición reiniciada. Los tiempos cargados se conservaron.';});
$('realFile').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
    const data=JSON.parse(await file.text());
    if(!['azul1','azulTotal','rojo1','rojoTotal'].every(k=>Number.isFinite(data[k])))throw Error('El JSON no contiene las cuatro marcas de tiempo necesarias.');
    loadReplayValues(data);
  }catch(e){$('realStatus').textContent='⚠ '+e.message;}
});

function tick(now){const dt=Math.min((now-lastFrame)/1000||0,.1);lastFrame=now;if(phase==='countdown'){countTime+=dt;if(countTime>=3){phase='running';setState('Carrera en curso','CARRERA EN VIVO');$('countdown').textContent='¡YA!';$('resultTitle').textContent='Duelo en marcha.';$('resultDetail').textContent='Cada auto mantiene su recorrido hasta la meta.';$('resultTag').textContent='CRONÓMETRO ACTIVO';}else $('countdown').textContent=String(3-Math.floor(countTime));}else if(phase==='replay'){updateRealReplay(dt); }else if(phase==='running'){advance(race,dt);countTime+=dt;if(countTime>3.65)$('countdown').hidden=true;$('clock').innerHTML=clock(race.done?Math.max(...race.cars.map(c=>c.finish)):race.time);if(race.done)finish(now);else if(race.cars.some(c=>c.finish!==null)){$('resultTitle').textContent=`${names[race.cars.find(c=>c.finish!==null).id]} cruza la meta`;$('resultDetail').textContent='Esperando la llegada del segundo auto.';}updateTelemetry();}draw(now);requestAnimationFrame(tick);}
$('start').addEventListener('click',start);$('pause').addEventListener('click',pause);$('reset').addEventListener('click',reset);$('laps').addEventListener('change',()=>{if(phase==='finished')reset();else updateTelemetry();});for(const name of['blue','red'])$(name+'Speed').addEventListener('input',()=>{$(name+'Output').value=$(name+'Speed').value+'%';});
for(const mode of['perspective','overhead'])$(mode).addEventListener('click',()=>{autoCamera=false;$('autoCamera').checked=false;setReplayView(mode);});
$('routes').addEventListener('click',()=>{showRoutes=!showRoutes;$('routes').classList.toggle('active',showRoutes);$('routes').setAttribute('aria-pressed',String(showRoutes));cache();});
for(const id of['reference','validation']){$(id).addEventListener('click',()=>$(id+'Dialog').showModal());$(id+'Dialog').querySelector('.close').addEventListener('click',()=>$(id+'Dialog').close());$(id+'Dialog').addEventListener('click',e=>{if(e.target===$(id+'Dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});}
document.addEventListener('keydown',e=>{if(e.target.matches('input,select,button')||document.querySelector('dialog[open]'))return;if(e.code==='Space'){e.preventDefault();['running','countdown','paused'].includes(phase)?pause():start();}if(e.key.toLowerCase()==='r')reset();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&['running','countdown'].includes(phase))pause();});new ResizeObserver(resize).observe(canvas);reset();resize();requestAnimationFrame(tick);window.__DM_APP_READY__=true;document.getElementById('bootStatus').textContent='Motor de simulación iniciado ✓';

// Visual summary based solely on the supplied lap/total times.
function refreshSimpleResult(){
  const ids=['realBlue1','realBlueTotal','realRed1','realRedTotal'];
  const v=ids.map(id=>Number($(id).value));
  const valid=ids.every(id=>$(id).value.trim()!=='')&&v.every(n=>Number.isFinite(n)&&n>0)&&v[1]>v[0]&&v[3]>v[2];
  const w=$('simpleWinner'),g=$('simpleGap');
  if(!valid){w.textContent='—';w.style.color='';g.textContent='';return;}
  if(Math.abs(v[1]-v[3])<0.0005){w.textContent='EMPATE';w.style.color='#f3e0b2';g.textContent='Mismo tiempo total';}
  else {const blue=v[1]<v[3];w.textContent=blue?'AZUL':'ROJO';w.style.color=blue?'#54b9ff':'#ff656c';g.textContent=`Ventaja de ${Math.abs(v[1]-v[3]).toFixed(3)} s`;}
}
for(const id of ['realBlue1','realBlueTotal','realRed1','realRedTotal'])$(id).addEventListener('input',refreshSimpleResult);
$('realFile').addEventListener('change',()=>setTimeout(refreshSimpleResult,0));
refreshSimpleResult();
// Precarga automática desde el control de carrera. No arranca sola: el usuario elige verla.
try {
  const params=new URLSearchParams(window.location.search);
  if(['a1','at','r1','rt'].every(k=>params.has(k))){
    const v=['a1','at','r1','rt'].map(k=>Number(params.get(k)));
    if(v.every(Number.isFinite) && v[0]>0 && v[1]>v[0] && v[2]>0 && v[3]>v[2] && v.every(t=>t<600000)){
      ['realBlue1','realBlueTotal','realRed1','realRedTotal'].forEach((id,i)=>{
        $(id).value=(v[i]/1000).toFixed(3);
        $(id).dispatchEvent(new Event('input',{bubbles:true}));
      });
      $('realStatus').textContent='Tiempos reales cargados. Tocá «Ver repetición» cuando quieras.';
    }else{
      $('realStatus').textContent='Los tiempos recibidos no son válidos.';
    }
  }
}catch(error){
  $('realStatus').textContent='No se pudieron cargar los tiempos: '+error.message;
}


// Foto de llegada: composición local del circuito y los resultados reales.
$('autoCamera').addEventListener('change',e=>{autoCamera=e.target.checked;cameraStep=-1;if(autoCamera)updateReplayCamera();});
$('saveFinish').addEventListener('click',()=>{
  if(!replayData || phase!=='replay-finished')return;
  const out=document.createElement('canvas');out.width=1280;out.height=850;
  const c=out.getContext('2d');
  c.fillStyle='#081321';c.fillRect(0,0,1280,850);
  c.drawImage(canvas,0,0,1280,665);
  c.fillStyle='#071422';c.fillRect(0,665,1280,185);
  const blue=replayData.azulTotal/1000,red=replayData.rojoTotal/1000;
  const name=Math.abs(blue-red)<.0005?'EMPATE':blue<red?'AZUL':'ROJO';
  c.textAlign='left';c.fillStyle='#f1f7ff';c.font='bold 38px system-ui';c.fillText('DRIFT MASTERS · RACE REPLAY',40,721);
  c.font='bold 28px system-ui';c.fillStyle='#54cfff';c.fillText('AZUL  '+blue.toFixed(3)+' s',40,777);
  c.fillStyle='#ff6585';c.fillText('ROJO  '+red.toFixed(3)+' s',490,777);
  c.fillStyle='#c9ffbc';c.font='bold 26px system-ui';c.fillText('GANA '+name,910,777);
  c.fillStyle='#96adc2';c.font='19px system-ui';c.fillText('Diferencia: '+Math.abs(blue-red).toFixed(3)+' s · Representación simulada',40,821);
  const a=document.createElement('a');a.download='drift-masters-foto-llegada.png';a.href=out.toDataURL('image/png');a.click();
});
