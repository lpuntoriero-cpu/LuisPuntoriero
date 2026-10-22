// Two continuous legs digitized from the reference. Their endpoints exchange lanes.
// z is used only on the bridge; the tunnel stays at ground level.
const tunnelPoints = [[560,525,0],[280,525,0],[195,512,0],[125,470,0],[82,390,0],[68,290,0],[77,190,0],[110,118,0],[180,85,0],[295,80,0],[405,85,0],[470,105,0],[492,143,0],[478,190,0],[449,242,0],[432,291,0],[445,330,0],[485,350,0],[580,363,0],[675,385,0],[750,385,0],[815,360,0],[853,315,0],[875,265,0],[870,229,0],[851,197,0],[850,170,0],[867,149,0],[893,146,0],[916,164,0],[935,204,0],[939,265,0],[932,350,0],[927,428,0],[902,470,0],[850,475,0],[560,475,0]];
const bridgePoints = [[560,475,0],[280,475,0],[213,462,0],[164,423,0],[137,355,0],[132,283,0],[149,218,0],[180,174,0],[215,157,0],[258,164,12],[335,194,53],[440,235,90],[550,278,90],[655,319,54],[729,329,10],[770,325,0],[794,305,0],[795,276,0],[775,250,0],[736,240,0],[704,215,0],[694,177,0],[707,139,0],[745,117,0],[798,113,0],[837,95,0],[873,78,0],[910,85,0],[955,124,0],[986,186,0],[1001,270,0],[995,367,0],[974,452,0],[936,503,0],[864,525,0],[560,525,0]];
function catmull(a,b,c,d,t) { return b.map((v,k)=>.5*((2*v)+(-a[k]+c[k])*t+(2*a[k]-5*v+4*c[k]-d[k])*t*t+(-a[k]+3*v-3*c[k]+d[k])*t*t*t)); }
function makePath(name,control) {
 const points=[];
 for(let i=0;i<control.length-1;i++) for(let j=0;j<24;j++) {const p=catmull(control[Math.max(0,i-1)],control[i],control[i+1],control[Math.min(control.length-1,i+2)],j/24);p[2]=Math.max(0,p[2]);points.push(p);}
 points.push(control.at(-1));const distances=[0];
 for(let i=1;i<points.length;i++) distances.push(distances.at(-1)+Math.hypot(...points[i].map((v,k)=>v-points[i-1][k])));
 const length=distances.at(-1);
 function at(distance) {distance=Math.max(0,Math.min(length,distance));let lo=0,hi=distances.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(distances[m]<distance)lo=m;else hi=m;}const f=(distance-distances[lo])/(distances[hi]-distances[lo]||1),p=points[lo].map((v,k)=>v+(points[hi][k]-v)*f);const d=points[hi].map((v,k)=>v-points[lo][k]);return {x:p[0],y:p[1],z:p[2],angle:Math.atan2(d[1],d[0])};}
 return {name,points,distances,length,at};
}
export const paths={tunnel:makePath('Túnel',tunnelPoints),bridge:makePath('Puente',bridgePoints)};
export const ROAD_WIDTH=35;
export const routeFor=(id,lap)=> ((id===0?0:1)+lap)%2===0?paths.tunnel:paths.bridge;
export function positionAt(id,distance,laps) {let lap=0;while(lap<laps-1&&distance>=routeFor(id,lap).length){distance-=routeFor(id,lap).length;lap++;}const path=routeFor(id,lap);return {...path.at(distance),lap,path,localDistance:Math.min(distance,path.length)};}
export const totalLength=(id,laps)=>Array.from({length:laps},(_,lap)=>routeFor(id,lap).length).reduce((a,b)=>a+b,0);
export function newRace({laps=2,speeds=[1,1],seed=1}={}) {let rand=seed|0;const random=()=>{rand=(rand*1664525+1013904223)|0;return(rand>>>0)/4294967296;};const pace=random()>.5?[1.006,.994]:[.994,1.006];return {time:0,laps,done:false,cars:[0,1].map(id=>({id,distance:0,finish:null,speed:165*speeds[id]*pace[id],total:totalLength(id,laps)}))};}
export function advance(race,dt) {if(race.done)return race;dt=Math.max(0,dt);for(const car of race.cars){if(car.finish!==null)continue;const before=car.distance;car.distance=Math.min(car.total,before+car.speed*dt);if(car.distance>=car.total)car.finish=race.time+(car.total-before)/car.speed;}race.time+=dt;race.done=race.cars.every(c=>c.finish!==null);return race;}
export function raceResult(race) {if(!race.done)return null;const [a,b]=race.cars;const gap=Math.abs(a.finish-b.finish);return {winner:gap<.001?null:a.finish<b.finish?0:1,gap,times:[a.finish,b.finish]};}
function intersect(a,b,c,d) {const cross=(u,v)=>u[0]*v[1]-u[1]*v[0];const r=[b[0]-a[0],b[1]-a[1]],s=[d[0]-c[0],d[1]-c[1]],q=[c[0]-a[0],c[1]-a[1]],den=cross(r,s);if(Math.abs(den)<1e-7)return null;const t=cross(q,s)/den,u=cross(q,r)/den;if(t<0||t>1||u<0||u>1)return null;return {x:a[0]+r[0]*t,y:a[1]+r[1]*t,clearance:Math.abs(a[2]+(b[2]-a[2])*t-c[2]-(d[2]-c[2])*u)};}
export function validateTrack() {const a=paths.tunnel.points,b=paths.bridge.points,errors=[],crossings=[];for(let i=1;i<a.length;i++)for(let j=1;j<b.length;j++){const hit=intersect(a[i-1],a[i],b[j-1],b[j]);if(hit && !((i<3&&j>b.length-4)||(j<3&&i>a.length-4))){crossings.push(hit);if(hit.clearance<45)errors.push('Cruce sin separación vertical');}}
 for(const path of Object.values(paths)){const p=path.points;for(let i=1;i<p.length;i++)for(let j=i+3;j<p.length;j++){if(intersect(p[i-1],p[i],p[j-1],p[j]))errors.push('Autointersección en '+path.name);}}
 const near=[];let minSameLevel=Infinity;for(let i=0;i<a.length;i+=2)for(let j=0;j<b.length;j+=2){if((paths.tunnel.distances[i]+paths.bridge.length-paths.bridge.distances[j]<85)||(paths.bridge.distances[j]+paths.tunnel.length-paths.tunnel.distances[i]<85))continue;const dist=Math.hypot(a[i][0]-b[j][0],a[i][1]-b[j][1]);if(Math.abs(a[i][2]-b[j][2])<25){minSameLevel=Math.min(minSameLevel,dist);if(dist<44)near.push({i,j,dist});}}
 if(near.length)errors.push('Carriles demasiado próximos al mismo nivel');
 if(crossings.length!==1)errors.push('Cantidad inesperada de cruces');
 if(Math.hypot(a.at(-1)[0]-b[0][0],a.at(-1)[1]-b[0][1])>1e-6||Math.hypot(b.at(-1)[0]-a[0][0],b.at(-1)[1]-a[0][1])>1e-6)errors.push('Retorno discontinuo');
 return {ok:!errors.length,errors,crossings,minSameLevel,lengths:{tunnel:paths.tunnel.length,bridge:paths.bridge.length},near:near.slice(0,3)};}
