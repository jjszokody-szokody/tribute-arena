import * as THREE from 'three';
const $=id=>document.getElementById(id);
const CHARS=[
 {name:'Kestrel Vane',d:1,c:0xd4af37,hp:100,spd:1.0,str:1.0,stl:0.5,desc:'Luxury-trained all-rounder'},
 {name:'Brakk Holloway',d:2,c:0x8a8f99,hp:140,spd:0.85,str:1.4,stl:0.2,desc:'Masonry brute, hits hard'},
 {name:'Wren Ashby',d:7,c:0x4c8a3a,hp:95,spd:1.1,str:1.15,stl:0.6,desc:'Lumberjack, axe-strong'},
 {name:'Juniper Lark',d:11,c:0xc96b2c,hp:85,spd:1.25,str:0.85,stl:0.8,desc:'Orchard runner, fast'},
 {name:'Moss Tiller',d:9,c:0xe8d27a,hp:110,spd:1.0,str:1.0,stl:0.5,desc:'Grain farmer, sturdy'},
 {name:'Shade Corrin',d:12,c:0x6a6a90,hp:80,spd:1.15,str:0.9,stl:1.0,desc:'Miner, master of stealth'}];
const FIRST=['Ash','Briar','Cole','Dara','Ember','Fen','Gale','Hollis','Ivy','Jory','Kit','Lumen','Marr','Nell','Orin','Pike','Quill','Rook','Sable','Tamsin','Ula','Vesper','Wynn','Yarrow'];
const isTouch=matchMedia('(pointer:coarse)').matches||'ontouchstart' in window;
let sel=0;

// ---------- figure ----------
const geo={body:new THREE.BoxGeometry(.7,.9,.4),head:new THREE.IcosahedronGeometry(.28,0),leg:new THREE.BoxGeometry(.25,.7,.25),arm:new THREE.BoxGeometry(.18,.7,.18)};
const skin=new THREE.MeshLambertMaterial({color:0xe0b08a});
function makeFigure(color){
 const g=new THREE.Group(),m=new THREE.MeshLambertMaterial({color}),dark=new THREE.MeshLambertMaterial({color:new THREE.Color(color).multiplyScalar(.5)});
 const b=new THREE.Mesh(geo.body,m);b.position.y=1.15;g.add(b);
 const h=new THREE.Mesh(geo.head,skin);h.position.y=1.85;g.add(h);
 const l1=new THREE.Mesh(geo.leg,dark);l1.position.set(-.18,.35,0);const l2=l1.clone();l2.position.x=.18;g.add(l1,l2);
 const a1=new THREE.Mesh(geo.arm,m);a1.position.set(-.47,1.2,0);const a2=a1.clone();a2.position.x=.47;g.add(a1,a2);
 g.userData={m,l1,l2,a1,a2,base:new THREE.Color(color)};return g;}

// ---------- preview ----------
const pc=$('preview'),pr=new THREE.WebGLRenderer({canvas:pc,antialias:true,alpha:true});
const ps=new THREE.Scene(),pcam=new THREE.PerspectiveCamera(35,1,.1,50);pcam.position.set(0,1.4,5);pcam.lookAt(0,1,0);
ps.add(new THREE.HemisphereLight(0xffffff,0x444422,1.2));const pd=new THREE.DirectionalLight(0xffffff,1);pd.position.set(2,4,3);ps.add(pd);
let pfig=null;
function setPreview(){if(pfig)ps.remove(pfig);pfig=makeFigure(CHARS[sel].c);ps.add(pfig);}
function renderChars(){
 $('chars').innerHTML=CHARS.map((c,i)=>`<div class="ch ${i==sel?'sel':''}" data-i="${i}"><b style="color:#${c.c.toString(16).padStart(6,'0')}">${c.name}</b>District ${c.d} · ${c.desc}
 ${[['HP',c.hp/140,'#e33'],['SPD',c.spd/1.25,'#3c9'],['STR',c.str/1.4,'#e93'],['STL',c.stl,'#99f']].map(s=>`<div style="display:flex;gap:4px;align-items:center;font-size:10px"><span style="width:26px">${s[0]}</span><div class="bar" style="flex:1"><i style="width:${s[1]*100}%;background:${s[2]}"></i></div></div>`).join('')}</div>`).join('');
 document.querySelectorAll('.ch').forEach(e=>e.onclick=()=>{sel=+e.dataset.i;renderChars();setPreview();});}
renderChars();setPreview();
function previewLoop(){if(!$('select').classList.contains('hidden')){const w=pc.clientWidth,h=pc.clientHeight;if(pc.width!==w||pc.height!==h){pr.setSize(w,h,false);pcam.aspect=w/h;pcam.updateProjectionMatrix();}pfig.rotation.y+=.02;pr.render(ps,pcam);}requestAnimationFrame(previewLoop);}previewLoop();

// ---------- audio ----------
let ac=null;function audio(){if(!ac)try{ac=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}if(ac&&ac.state==='suspended')ac.resume();}
function tone(f,dur,type='sine',vol=.3,slide=0){if(!ac)return;const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.value=f;if(slide)o.frequency.exponentialRampToValueAtTime(slide,ac.currentTime+dur);g.gain.setValueAtTime(vol,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+dur);o.connect(g).connect(ac.destination);o.start();o.stop(ac.currentTime+dur);}
function cannon(){if(!ac)return;tone(90,1.2,'sine',.8,30);const n=ac.createBufferSource(),b=ac.createBuffer(1,ac.sampleRate*.6,ac.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,3);n.buffer=b;const g=ac.createGain();g.gain.value=.5;const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=400;n.connect(f).connect(g).connect(ac.destination);n.start();}

// ---------- main scene ----------
const R=95,LAKE={x:45,z:35,r:16};
const renderer=new THREE.WebGLRenderer({antialias:!isTouch,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,isTouch?1.25:1.5));renderer.setSize(innerWidth,innerHeight);
document.body.prepend(renderer.domElement);renderer.domElement.style.display='none';
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.1,300);scene.add(camera);
scene.fog=new THREE.Fog(0x9cc8e8,30,isTouch?110:150);
const hemi=new THREE.HemisphereLight(0xcfe8ff,0x4a5a2a,.9),sun=new THREE.DirectionalLight(0xfff2d0,1.1);sun.position.set(50,80,20);scene.add(hemi,sun);
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
// ground
const ground=new THREE.Mesh(new THREE.CircleGeometry(R+40,48),new THREE.MeshLambertMaterial({color:0x5f8a3a}));ground.rotation.x=-Math.PI/2;scene.add(ground);
const lake=new THREE.Mesh(new THREE.CircleGeometry(LAKE.r,28),new THREE.MeshLambertMaterial({color:0x2f78b8,transparent:true,opacity:.85}));lake.rotation.x=-Math.PI/2;lake.position.set(LAKE.x,.05,LAKE.z);scene.add(lake);
// river from lake
const river=new THREE.Mesh(new THREE.PlaneGeometry(6,60),lake.material);river.rotation.x=-Math.PI/2;river.rotation.z=.6;river.position.set(LAKE.x+20,.04,LAKE.z+28);scene.add(river);
const RIVER={a:new THREE.Vector2(LAKE.x,LAKE.z),b:new THREE.Vector2(LAKE.x+40,LAKE.z+55)};
// boundary wall (force field)
const wall=new THREE.Mesh(new THREE.CylinderGeometry(R,R,12,48,1,true),new THREE.MeshBasicMaterial({color:0x66ccff,transparent:true,opacity:.15,side:THREE.DoubleSide,depthWrite:false}));wall.position.y=6;scene.add(wall);
// danger zone ring
const zoneMesh=new THREE.Mesh(new THREE.CylinderGeometry(1,1,30,48,1,true),new THREE.MeshBasicMaterial({color:0xff3300,transparent:true,opacity:.22,side:THREE.DoubleSide,depthWrite:false}));zoneMesh.position.y=15;scene.add(zoneMesh);
// cornucopia
const corn=new THREE.Mesh(new THREE.ConeGeometry(3,8,10,1,true),new THREE.MeshLambertMaterial({color:0xc9a227,side:THREE.DoubleSide,flatShading:true}));corn.rotation.z=Math.PI/2;corn.position.set(0,2.6,0);scene.add(corn);
const obstacles=[{x:-1.5,z:0,r:2.6}];
// trees & rocks (instanced)
function rnd(a,b){return a+Math.random()*(b-a);}
function inWater(x,z){if(Math.hypot(x-LAKE.x,z-LAKE.z)<LAKE.r)return true;return distSeg(x,z)<3;}
function distSeg(x,z){const p=new THREE.Vector2(x,z),ab=RIVER.b.clone().sub(RIVER.a);const t=THREE.MathUtils.clamp(p.clone().sub(RIVER.a).dot(ab)/ab.lengthSq(),0,1);return p.distanceTo(RIVER.a.clone().add(ab.multiplyScalar(t)));}
const NT=isTouch?220:320,trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.25,.35,3,5),new THREE.MeshLambertMaterial({color:0x6b4a2b}),NT),leaves=new THREE.InstancedMesh(new THREE.ConeGeometry(1.8,4.5,6),new THREE.MeshLambertMaterial({color:0x2e6b2e,flatShading:true}),NT);
const M=new THREE.Matrix4(),Q=new THREE.Quaternion(),S=new THREE.Vector3(),P=new THREE.Vector3();
for(let i=0;i<NT;i++){let x,z;do{const a=Math.random()*6.283,r=rnd(18,R-3);x=Math.cos(a)*r;z=Math.sin(a)*r;}while(inWater(x,z)||Math.hypot(x-LAKE.x,z-LAKE.z)<LAKE.r+3);
 const s=rnd(.8,1.5);M.compose(P.set(x,1.5*s,z),Q.identity(),S.set(s,s,s));trunk.setMatrixAt(i,M);M.compose(P.set(x,4.5*s,z),Q,S);leaves.setMatrixAt(i,M);obstacles.push({x,z,r:.5*s});}
scene.add(trunk,leaves);
const NR=50,rocks=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:0x888880,flatShading:true}),NR);
for(let i=0;i<NR;i++){let x,z;do{x=rnd(-R,R);z=rnd(-R,R);}while(Math.hypot(x,z)>R-3||Math.hypot(x,z)<12||inWater(x,z));const s=rnd(.6,2);M.compose(P.set(x,s*.5,z),Q.setFromEuler(new THREE.Euler(rnd(0,3),rnd(0,3),0)),S.set(s,s*.8,s));rocks.setMatrixAt(i,M);obstacles.push({x,z,r:s*.9});}
scene.add(rocks);

// ---------- items ----------
const WEAPONS={fists:{n:'Fists',dmg:8,rng:1.9,cd:.45},knife:{n:'Knife',dmg:18,rng:2.2,cd:.4,col:0xcccccc},spear:{n:'Spear',dmg:28,rng:3.3,cd:.75,col:0x996633},axe:{n:'Axe',dmg:34,rng:2.4,cd:.9,col:0x777777}};
const itemGeo={knife:new THREE.BoxGeometry(.12,.08,.8),spear:new THREE.CylinderGeometry(.05,.05,2.4,5),axe:new THREE.BoxGeometry(.5,.12,1),food:new THREE.BoxGeometry(.5,.4,.4),berries:new THREE.IcosahedronGeometry(.3,0),water:new THREE.CylinderGeometry(.15,.15,.5,6)};
const itemMat={knife:new THREE.MeshLambertMaterial({color:0xdddddd,emissive:0x333333}),spear:new THREE.MeshLambertMaterial({color:0xb07a40,emissive:0x221100}),axe:new THREE.MeshLambertMaterial({color:0x999999,emissive:0x222222}),food:new THREE.MeshLambertMaterial({color:0xa0522d,emissive:0x221100}),berries:new THREE.MeshLambertMaterial({color:0xc2185b,emissive:0x330011}),water:new THREE.MeshLambertMaterial({color:0x66bbff,emissive:0x113355})};
let items=[];
function addItem(type,x,z){const m=new THREE.Mesh(itemGeo[type],itemMat[type]);m.position.set(x,.4,z);if(type==='spear')m.rotation.z=Math.PI/2;scene.add(m);items.push({type,m,x,z});}
function spawnItems(){items.forEach(i=>scene.remove(i.m));items=[];
 const near=['knife','knife','spear','spear','axe','knife','spear','food','food','water','water','food','axe','knife','water','food'];
 near.forEach((t,i)=>{const a=i/near.length*6.283,r=rnd(4,9);addItem(t,Math.cos(a)*r,Math.sin(a)*r);});
 for(let i=0;i<45;i++){let x,z;do{x=rnd(-R+5,R-5);z=rnd(-R+5,R-5);}while(Math.hypot(x,z)>R-5||inWater(x,z));addItem(i<30?'berries':i<38?'food':i<42?'water':'knife',x,z);}}

// ---------- entities ----------
let ents=[],player=null,zoneR=R,time=0,running=false,camMode=isTouch?'third':'first',yaw=0,pitch=0;
const dayLen=150;
function makeEnt(cfg,isPlayer){const fig=makeFigure(cfg.c);scene.add(fig);return{name:cfg.name,d:cfg.d,fig,isPlayer,hp:cfg.hp,maxhp:cfg.hp,spd:cfg.spd,str:cfg.str,stl:cfg.stl,hunger:100,thirst:100,weapon:'fists',x:0,z:0,y:0,vy:0,dir:0,cd:0,alive:true,swing:0,flash:0,think:0,tx:0,tz:0,target:null,aggro:rnd(.3,1)};}
function startGame(){
 audio();ents.forEach(e=>scene.remove(e.fig));ents=[];spawnItems();zoneR=R;time=0;
 const pcfg=CHARS[sel];player=makeEnt(pcfg,true);ents.push(player);
 const others=[];for(let d=1;d<=12;d++)for(let k=0;k<2;k++)others.push(d);others.splice(others.indexOf(pcfg.d),1);
 const names=FIRST.slice().sort(()=>Math.random()-.5);
 others.forEach((d,i)=>{const col=new THREE.Color().setHSL(Math.random(),.6,.45).getHex();const e=makeEnt({name:names[i],d,c:col,hp:rnd(80,130)|0,spd:rnd(.8,1.15),str:rnd(.8,1.3),stl:.5},false);ents.push(e);});
 ents.forEach((e,i)=>{const a=i/24*6.283;e.x=Math.cos(a)*16;e.z=Math.sin(a)*16;e.dir=Math.atan2(-e.x,-e.z);e.tx=e.x;e.tz=e.z;});
 yaw=player.dir+Math.PI;pitch=0;
 ['select','end'].forEach(s=>$(s).classList.add('hidden'));['hud','count','cross'].forEach(s=>$(s).classList.remove('hidden'));
 if(isTouch){$('touch').classList.remove('hidden');$('btns').classList.remove('hidden');}
 renderer.domElement.style.display='block';running=true;setCam();
 announce('Let the Games begin!');$('hint').textContent=isTouch?'':'Click to lock mouse';updateCount();
}
$('start').onclick=startGame;$('retry').onclick=startGame;
$('newchar').onclick=()=>{$('end').classList.add('hidden');$('select').classList.remove('hidden');renderer.domElement.style.display='none';};
let msgT;function announce(t){const m=$('msg');m.textContent=t;m.style.opacity=1;clearTimeout(msgT);msgT=setTimeout(()=>m.style.opacity=0,3000);}
function alive(){return ents.filter(e=>e.alive);}
function updateCount(){$('count').innerHTML=`Tributes remaining: ${alive().length}`;}
function kill(e,by){if(!e.alive)return;e.alive=false;e.fig.rotation.x=-Math.PI/2;e.fig.position.y=.3;setTimeout(()=>scene.remove(e.fig),4000);
 if(e.weapon!=='fists')addItem(e.weapon,e.x+1,e.z);cannon();updateCount();
 if(e.isPlayer)return endGame(false,by);announce(`BOOM! ${e.name}, District ${e.d}, has fallen${by&&by.isPlayer?' (by you)':''}`);
 if(player.alive&&alive().length===1)endGame(true);}
function endGame(win,by){running=false;if(document.pointerLockElement)document.exitPointerLock();
 $('endTitle').textContent=win?'VICTOR!':'YOU DIED';$('endTitle').style.color=win?'#f5b942':'#e33';
 const mins=Math.floor(time/60),secs=Math.floor(time%60);
 $('final').innerHTML=win?`${player.name} of District ${player.d} wins the Games!<br>Survived ${mins}m ${secs}s`:`Placed #${alive().length+1} of 24 · survived ${mins}m ${secs}s${by?`<br>Killed by ${by.name||by}`:''}`;
 setTimeout(()=>{$('end').classList.remove('hidden');['touch','btns','cross'].forEach(s=>$(s).classList.add('hidden'));},win?600:1200);}
function attack(a){if(a.cd>0||!a.alive)return;const w=WEAPONS[a.weapon];a.cd=w.cd;a.swing=.25;if(a.isPlayer)tone(220,.08,'square',.08,110);
 const fx=Math.sin(a.dir),fz=Math.cos(a.dir);let best=null,bd=1e9;
 for(const e of ents){if(e===a||!e.alive)continue;const dx=e.x-a.x,dz=e.z-a.z,d=Math.hypot(dx,dz);if(d>w.rng+.4)continue;if((dx*fx+dz*fz)/(d||1)<.4)continue;if(d<bd){bd=d;best=e;}}
 if(best){const dmg=w.dmg*a.str*rnd(.85,1.15)*(best.isPlayer?.55:1);best.hp-=dmg;best.flash=.2;best.x+=fx*.6;best.z+=fz*.6;if(!best.isPlayer)best.target=a;if(best.isPlayer||a.isPlayer)tone(140,.12,'sawtooth',.15,60);if(best.hp<=0)kill(best,a);}}
function pickup(e){let best=null,bd=2.6;for(const it of items){const d=Math.hypot(it.x-e.x,it.z-e.z);if(d<bd){bd=d;best=it;}}
 if(best){scene.remove(best.m);items.splice(items.indexOf(best),1);const t=best.type;
  if(WEAPONS[t]){if(e.weapon!=='fists')addItem(e.weapon,e.x+.8,e.z+.8);e.weapon=t;if(e.isPlayer){announce('Picked up '+WEAPONS[t].n);setWeaponModel();}}
  else if(t==='berries'){e.hunger=Math.min(100,e.hunger+20);e.hp=Math.min(e.maxhp,e.hp+5);if(e.isPlayer)announce('Ate berries');}
  else if(t==='food'){e.hunger=Math.min(100,e.hunger+45);e.hp=Math.min(e.maxhp,e.hp+10);if(e.isPlayer)announce('Ate rations');}
  else if(t==='water'){e.thirst=Math.min(100,e.thirst+50);if(e.isPlayer)announce('Drank water');}
  if(e.isPlayer)tone(660,.1,'triangle',.15,990);return true;}
 if(nearWater(e)){e.thirst=Math.min(100,e.thirst+35);if(e.isPlayer){announce('You drink from the water');tone(500,.15,'sine',.12,300);}return true;}return false;}
function nearWater(e){return Math.hypot(e.x-LAKE.x,e.z-LAKE.z)<LAKE.r+2||distSeg(e.x,e.z)<4.5;}
// FP weapon model
let wModel=null;function setWeaponModel(){if(wModel)camera.remove(wModel);wModel=null;const t=player.weapon;if(t==='fists')return;wModel=new THREE.Mesh(itemGeo[t],itemMat[t]);wModel.position.set(.35,-.3,-.6);if(t==='spear')wModel.rotation.x=Math.PI/2;camera.add(wModel);}
function setCam(){if(player)player.fig.visible=camMode==='third';setWeaponModel();if(wModel)wModel.visible=camMode==='first';}

// ---------- input ----------
const keys={};let moveX=0,moveY=0;
addEventListener('keydown',e=>{keys[e.code]=true;if(!running)return;if(e.code==='KeyE')pickup(player);if(e.code==='KeyV'){camMode=camMode==='first'?'third':'first';setCam();}if(e.code==='Space'&&player.y<=0)player.vy=6;});
addEventListener('keyup',e=>keys[e.code]=false);
const cv=renderer.domElement;
cv.addEventListener('mousedown',()=>{if(!running||isTouch)return;if(document.pointerLockElement!==cv){cv.requestPointerLock?.();$('hint').textContent='';}else attack(player);});
addEventListener('mousemove',e=>{if(document.pointerLockElement===cv){yaw-=e.movementX*.0025;pitch=THREE.MathUtils.clamp(pitch-e.movementY*.0025,-1.3,1.3);}});
// touch: two fixed joysticks, multitouch by identifier
let lookX=0,lookY=0;
function makeJoy(el,cb){const knob=el.querySelector('.knob');let id=null;const MAX=46;
 const set=(t)=>{const r=el.getBoundingClientRect();let dx=t.clientX-(r.left+r.width/2),dy=t.clientY-(r.top+r.height/2);const l=Math.hypot(dx,dy);if(l>MAX){dx*=MAX/l;dy*=MAX/l;}knob.style.transform=`translate(${dx}px,${dy}px)`;cb(dx/MAX,dy/MAX);};
 el.addEventListener('touchstart',e=>{e.preventDefault();audio();if(id!==null)return;const t=e.changedTouches[0];id=t.identifier;set(t);},{passive:false});
 el.addEventListener('touchmove',e=>{e.preventDefault();for(const t of e.changedTouches)if(t.identifier===id)set(t);},{passive:false});
 const end=e=>{for(const t of e.changedTouches)if(t.identifier===id){id=null;knob.style.transform='';cb(0,0);}};
 el.addEventListener('touchend',end);el.addEventListener('touchcancel',end);}
makeJoy($('joyL'),(x,y)=>{moveX=x;moveY=-y;});
makeJoy($('joyR'),(x,y)=>{lookX=x;lookY=y;});
document.addEventListener('touchmove',e=>{if(running)e.preventDefault();},{passive:false});
document.addEventListener('gesturestart',e=>e.preventDefault());
document.addEventListener('contextmenu',e=>{if(running)e.preventDefault();});
function applyLook(dt){const dz=.12,f=v=>{const a=Math.abs(v);return a<dz?0:Math.sign(v)*Math.pow((a-dz)/(1-dz),1.5);};
 yaw-=f(lookX)*2.6*dt;pitch=THREE.MathUtils.clamp(pitch-f(lookY)*1.8*dt,-1.2,1.2);}
let atkHeld=false;
document.querySelectorAll('#btns div').forEach(b=>{b.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();audio();if(!running)return;const k=b.dataset.b;
 if(k==='atk'){atkHeld=true;attack(player);}if(k==='jump'&&player.y<=0)player.vy=6;if(k==='use')pickup(player);if(k==='cam'){camMode=camMode==='first'?'third':'first';setCam();}},{passive:false});
 b.addEventListener('touchend',e=>{e.preventDefault();if(b.dataset.b==='atk')atkHeld=false;});
 b.addEventListener('mousedown',e=>{e.stopPropagation();if(!running)return;const k=b.dataset.b;if(k==='atk')attack(player);if(k==='jump'&&player.y<=0)player.vy=6;if(k==='use')pickup(player);if(k==='cam'){camMode=camMode==='first'?'third':'first';setCam();}});});

// ---------- simulation ----------
function collide(e){for(const o of obstacles){const dx=e.x-o.x,dz=e.z-o.z,d2=dx*dx+dz*dz,r=o.r+.35;if(d2<r*r&&d2>1e-6){const d=Math.sqrt(d2);e.x=o.x+dx/d*r;e.z=o.z+dz/d*r;}}
 const d=Math.hypot(e.x,e.z);if(d>R-1){e.x*=(R-1)/d;e.z*=(R-1)/d;}}
function move(e,mx,mz,dt){const sp=4.2*e.spd*(nearWater(e)&&inWater(e.x,e.z)?.55:1)*(e.hunger<=0||e.thirst<=0?.7:1);e.x+=mx*sp*dt;e.z+=mz*sp*dt;collide(e);return Math.hypot(mx,mz)>.05;}
function aiThink(e){
 const night=isNight(),dz=Math.hypot(e.x,e.z);
 if(e.target&&(!e.target.alive||Math.hypot(e.target.x-e.x,e.target.z-e.z)>25))e.target=null;
 if(!e.target&&time>12){let best=null,bd=1e9;for(const o of ents){if(o===e||!o.alive)continue;let sight=(o.isPlayer?14*(1.3-o.stl):11)*(night?.6:1)*e.aggro*(o.isPlayer?.8:1)*(e.weapon!=='fists'?1.3:1);const d=Math.hypot(o.x-e.x,o.z-e.z);if(d<sight&&d<bd){bd=d;best=o;}}
  if(best&&(e.hp>e.maxhp*.3))e.target=best;}
 if(e.hp<e.maxhp*.25&&e.target&&Math.random()<.5){e.target=null;e.flee=2;}
 if(!e.target){ // gather / wander
  if(dz>zoneR-8){const a=Math.atan2(e.z,e.x);const r=Math.max(0,zoneR*.5);e.tx=Math.cos(a)*r;e.tz=Math.sin(a)*r;return;}
  let want=null,bd=18;const needs=e.thirst<40;if(needs){if(Math.hypot(e.x-LAKE.x,e.z-LAKE.z)<LAKE.r+2){pickup(e);}else{e.tx=LAKE.x;e.tz=LAKE.z;return;}}
  for(const it of items){if(WEAPONS[it.type]&&e.weapon!=='fists'&&WEAPONS[it.type].dmg<=WEAPONS[e.weapon].dmg)continue;if(!WEAPONS[it.type]&&e.hunger>70&&it.type!=='water')continue;const d=Math.hypot(it.x-e.x,it.z-e.z);if(d<bd){bd=d;want=it;}}
  if(want){e.tx=want.x;e.tz=want.z;if(bd<2)pickup(e);return;}
  if(Math.hypot(e.tx-e.x,e.tz-e.z)<2||Math.random()<.05){const a=Math.random()*6.283,r=Math.random()*Math.min(zoneR-5,R-5);e.tx=Math.cos(a)*r;e.tz=Math.sin(a)*r;}}}
function isNight(){const p=(time/dayLen)%1;return p>.55&&p<.95;}
function updateEnt(e,dt){
 if(!e.alive)return;e.cd-=dt;e.swing=Math.max(0,e.swing-dt);e.flash=Math.max(0,e.flash-dt);
 e.hunger-=dt*(e.isPlayer?.55:.3);e.thirst-=dt*(e.isPlayer?.8:.4);
 if(e.hunger<0){e.hunger=0;e.hp-=dt*1.5;}if(e.thirst<0){e.thirst=0;e.hp-=dt*2.5;}
 if(Math.hypot(e.x,e.z)>zoneR){e.hp-=dt*8;if(e.isPlayer)$('danger').style.opacity=1;}else if(e.isPlayer)$('danger').style.opacity=0;
 if(e.hunger>60&&e.thirst>60)e.hp=Math.min(e.maxhp,e.hp+dt*.6);
 if(e.hp<=0)return kill(e,Math.hypot(e.x,e.z)>zoneR?'the firestorm':e.hunger<=0||e.thirst<=0?'starvation & thirst':null);
 let moving=false;
 if(e.isPlayer){let mx=(keys.KeyD?1:0)-(keys.KeyA?1:0)+moveX,mz=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)+moveY;
  if(keys.ArrowLeft)yaw+=dt*2;if(keys.ArrowRight)yaw-=dt*2;const l=Math.hypot(mx,mz);if(l>1){mx/=l;mz/=l;}
  e.dir=yaw+Math.PI;const fx=Math.sin(e.dir),fz=Math.cos(e.dir),rx=-fz,rz=fx;
  moving=move(e,fx*mz-rx*mx,fz*mz-rz*mx,dt);if(atkHeld)attack(e);}
 else{e.think-=dt;if(e.think<=0){e.think=rnd(.3,.6);aiThink(e);}
  let tx=e.tx,tz=e.tz;if(e.target){tx=e.target.x;tz=e.target.z;}
  const dx=tx-e.x,dz=tz-e.z,d=Math.hypot(dx,dz);
  if(e.target&&d<WEAPONS[e.weapon].rng*.9){e.dir=Math.atan2(dx,dz);if(Math.random()<dt*(e.target.isPlayer?1.6:3))attack(e);}
  else if(d>.5){e.dir=Math.atan2(dx,dz);moving=move(e,dx/d*(e.target?1:.7),dz/d*(e.target?1:.7),dt);}}
 e.vy-=18*dt;e.y=Math.max(0,e.y+e.vy*dt);if(e.y===0)e.vy=0;
 const f=e.fig,u=f.userData;f.position.set(e.x,e.y,e.z);f.rotation.y=e.dir;
 const s=moving?Math.sin(time*10)*.6:0;u.l1.rotation.x=s;u.l2.rotation.x=-s;u.a1.rotation.x=-s;u.a2.rotation.x=e.swing>0?-1.8+e.swing*4:s;
 u.m.color.copy(e.flash>0?new THREE.Color(0xff2222):u.base);}

// ---------- loop ----------
const clock=new THREE.Clock(),skyDay=new THREE.Color(0x9cc8e8),skyNight=new THREE.Color(0x0b1026),sky=new THREE.Color();
let hudT=0;
function loop(){requestAnimationFrame(loop);const dt=Math.min(clock.getDelta(),.05);if(!running&&(!player||player.alive))return renderer.domElement.style.display!=='none'&&renderer.render(scene,camera);
 if(running){time+=dt;
  // zone: holds 60s then shrinks to 12 over 7 minutes
  zoneR=THREE.MathUtils.clamp(R-(time-60)/420*(R-12),12,R);zoneMesh.scale.set(zoneR,1,zoneR);
  if(Math.abs(time-60)<dt)announce('The firestorm is closing in!');
  applyLook(dt);for(const e of ents)updateEnt(e,dt);}
 // day/night
 const p=(time/dayLen)%1,k=Math.max(0,Math.sin(p*Math.PI*2+0.3)*.5+.5);const light=THREE.MathUtils.smoothstep(k,.2,.6);
 sky.lerpColors(skyNight,skyDay,light);scene.background=sky;scene.fog.color.copy(sky);sun.intensity=.15+light*1;hemi.intensity=.25+light*.7;
 const a=p*6.283;sun.position.set(Math.cos(a)*80,Math.sin(a)*80+20,30);
 // camera
 if(player){const hy=player.y+1.75;if(camMode==='first'||!player.alive){camera.position.set(player.x,hy,player.z);camera.rotation.set(pitch,yaw,0,'YXZ');}
  else{const back=5,cx=player.x+Math.sin(yaw)*back*Math.cos(pitch),cz=player.z+Math.cos(yaw)*back*Math.cos(pitch),cy=hy+.6-Math.sin(pitch)*back;camera.position.set(cx,Math.max(.5,cy),cz);camera.lookAt(player.x,hy+.3,player.z);}
  if(wModel)wModel.rotation.y=player.swing>0?-player.swing*4:0;}
 hudT-=dt;if(hudT<=0&&player){hudT=.15;$('hp').style.width=Math.max(0,player.hp/player.maxhp*100)+'%';$('hu').style.width=player.hunger+'%';$('th').style.width=player.thirst+'%';
  $('weap').textContent='Weapon: '+WEAPONS[player.weapon].n;$('dayl').textContent=`Day ${Math.floor(time/dayLen)+1} · ${isNight()?'Night 🌙':'Day ☀'}`;
  let near=items.some(it=>Math.hypot(it.x-player.x,it.z-player.z)<2.6);$('hint').textContent=running&&near?(isTouch?'Tap GRAB to pick up':'Press E to pick up'):running&&nearWater(player)?(isTouch?'Tap GRAB to drink':'Press E to drink'):(!isTouch&&running&&document.pointerLockElement!==cv?'Click to lock mouse':'');}
 for(const it of items)it.m.rotation.y+=dt*1.5;
 renderer.render(scene,camera);}
loop();
window.__game={get player(){return player},get ents(){return ents},setCam:m=>{camMode=m;setCam();},startGame,sel:i=>{sel=i;}};
