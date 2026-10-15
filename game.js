import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {Sky} from 'three/addons/objects/Sky.js';
import {Water} from 'three/addons/objects/Water.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
const $=id=>document.getElementById(id);
const isTouch=matchMedia('(pointer:coarse)').matches||'ontouchstart' in window;
function rnd(a,b){return a+Math.random()*(b-a);}
function pick(a){return a[Math.floor(Math.random()*a.length)];}
function sstep(a,b,x){const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);}

// ---------- quality ----------
// counts scale sub-linearly with area; chunks beyond draw distance are hidden
const PRESETS={
 low:{pr:1,shadow:0,grass:6000,grassDist:38,trees:480,fog:120,water:'simple',bloom:false,aa:false,rocks:110,tseg:150},
 medium:{pr:1.5,shadow:1024,grass:16000,grassDist:55,trees:800,fog:165,water:'simple',bloom:false,aa:false,rocks:160,tseg:190},
 high:{pr:2,shadow:2048,grass:36000,grassDist:80,trees:1300,fog:240,water:'reflect',bloom:true,aa:true,rocks:220,tseg:250}};
let qSetting=localStorage.getItem('ta_quality')||'auto';
function autoQ(){if(!isTouch)return 'high';const mem=navigator.deviceMemory||4,cores=navigator.hardwareConcurrency||4;return (mem>=6&&cores>=8)?'medium':'low';}
const qName=qSetting==='auto'?autoQ():qSetting,QL=PRESETS[qName];
document.querySelectorAll('#qual button').forEach(b=>{b.classList.toggle('on',b.dataset.q===qSetting);b.onclick=()=>{if(b.dataset.q===qSetting)return;localStorage.setItem('ta_quality',b.dataset.q);location.reload();};});
$('qual').insertAdjacentHTML('beforeend',` <span style="opacity:.6">(${qName})</span>`);

// ---------- characters ----------
const CHARS=[
 {name:'Kestrel Vane',skin:0xf1c9a5,d:1,c:0xd4af37,hp:100,spd:1.0,str:1.0,stl:0.5,desc:'Golden-armored Career, spear',model:'Knight_Golden_Female',scale:1.0,weapon:'spear',acc:'cape',accC:0xa01818},
 {name:'Brakk Holloway',skin:0xc68642,d:2,c:0x8a8f99,hp:140,spd:0.85,str:1.4,stl:0.2,desc:'Hulking brute, battle axe',model:'Viking_Male',scale:1.14,weapon:'axe',acc:'none'},
 {name:'Wren Ashby',skin:0xe0ac69,d:7,c:0x4c8a3a,hp:95,spd:1.1,str:1.15,stl:0.6,desc:'Lumberjack with a hatchet',model:'Worker_Male',scale:1.02,weapon:'axe',acc:'backpack',accC:0x5a3d22},
 {name:'Juniper Lark',skin:0x8d5524,d:11,c:0xc96b2c,hp:85,spd:1.25,str:0.85,stl:0.8,desc:'Orchard runner, knife & quiver',model:'Cowboy_Female',scale:0.93,weapon:'knife',acc:'quiver',accC:0x6b4a2b},
 {name:'Moss Tiller',skin:0xffdbac,d:9,c:0xe8d27a,hp:110,spd:1.0,str:1.0,stl:0.5,desc:'Farmer with a pitch-spear',model:'Cowboy_Male',scale:1.05,weapon:'spear',acc:'bedroll',accC:0x3d6b8a},
 {name:'Shade Corrin',skin:0xa86f45,d:12,c:0x6a6a90,hp:80,spd:1.15,str:0.9,stl:1.0,desc:'Silent miner-ninja, knife',model:'Ninja_Male',scale:0.96,weapon:'knife',acc:'none'}];
const AI_MODELS=['Knight_Golden_Female','Viking_Male','Worker_Male','Cowboy_Female','Cowboy_Male','Ninja_Male','Pirate_Female','Casual_Male','Soldier_Female','Kimono_Male','Elf','Casual3_Female','Witch'];
const FIRST=['Ash','Briar','Cole','Dara','Ember','Fen','Gale','Hollis','Ivy','Jory','Kit','Lumen','Marr','Nell','Orin','Pike','Quill','Rook','Sable','Tamsin','Ula','Vesper','Wynn','Yarrow'];
const DCOL=[0,0xd4af37,0x8a8f99,0x9b59b6,0x2e86c1,0x16a085,0xe67e22,0x4c8a3a,0xc0392b,0xe8d27a,0x7f8c8d,0xc96b2c,0x6a6a90];
let sel=0;

// ---------- models ----------
const MODELS={};
const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);
const needed=[...new Set([...AI_MODELS,...CHARS.map(c=>c.model)])];
const loadP=Promise.all(needed.map(n=>new Promise((res,rej)=>loader.load('assets/models/'+n+'.glb',g=>{const b=new THREE.Box3().setFromObject(g.scene);g.h=b.max.y-b.min.y;MODELS[n]=g;res();},undefined,rej))));
const CLOTH=/Shirt|Pants|Jacket|Top|Scarf|Main|Clothes|Vest|Beige|DarkGreen|Light|Band|Belt/,HAIRM=/Hair/,SKINM=/^Skin$/;
const SKINS=[0xf1c9a5,0xe0ac69,0xc68642,0x8d5524,0x5c3a21,0xffdbac];
const accMats={};function accMat(c){return accMats[c]||(accMats[c]=new THREE.MeshStandardMaterial({color:c,roughness:.8}));}
function addAccessory(root,kind,c,h){if(kind==='none')return;const g=new THREE.Group(),m=accMat(c||0x553322);
 if(kind==='backpack'){const b=new THREE.Mesh(new THREE.BoxGeometry(.36,.42,.18),m);b.position.set(0,1.2,-.22);g.add(b);}
 if(kind==='quiver'){const q=new THREE.Mesh(new THREE.CylinderGeometry(.07,.06,.55,8),m);q.position.set(.12,1.25,-.2);q.rotation.z=.4;g.add(q);for(let i=0;i<3;i++){const a=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.25,4),accMat(0xdddddd));a.position.set(.2+i*.02,1.55,-.2);a.rotation.z=.4;g.add(a);}}
 if(kind==='bedroll'){const r=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,.5,10),m);r.rotation.z=Math.PI/2;r.position.set(0,1.45,-.2);g.add(r);}
 if(kind==='cape'){const p=new THREE.Mesh(new THREE.PlaneGeometry(.55,.95),new THREE.MeshStandardMaterial({color:c,roughness:.7,side:THREE.DoubleSide}));p.position.set(0,1.0,-.2);p.rotation.x=.12;g.add(p);}
 if(kind==='sash'){const s=new THREE.Mesh(new THREE.TorusGeometry(.2,.03,5,12),m);s.position.set(0,1.0,0);s.rotation.x=Math.PI/2;s.scale.set(1,1.2,1);g.add(s);}
 g.scale.setScalar(h/1.8);g.traverse(o=>{if(o.isMesh)o.castShadow=true;});root.add(g);}
function makeFigure(o){ // o:{model,scale,cloth,skin,hair,acc,accC}
 const g=MODELS[o.model],root=new THREE.Group(),obj=SkeletonUtils.clone(g.scene);root.add(obj);
 const k=1.8/g.h*(o.scale||1);obj.scale.setScalar(k);const mats=[];
 obj.traverse(n=>{if(n.isMesh){n.castShadow=true;n.frustumCulled=false;n.material=n.material.clone();const m=n.material;
  if(o.cloth!==undefined&&CLOTH.test(m.name))m.color.lerp(new THREE.Color(o.cloth),.7);
  if(o.skin!==undefined&&SKINM.test(m.name))m.color.set(o.skin);
  if(o.hair!==undefined&&HAIRM.test(m.name))m.color.set(o.hair);
  m.emissive=new THREE.Color(0);mats.push(m);}});
 addAccessory(root,o.acc||'none',o.accC,1.8*(o.scale||1));
 const mixer=new THREE.AnimationMixer(obj),acts={};
 const map={idle:'Idle',walk:'Walk',run:'Run',slash:'SwordSlash',punch:'Punch',death:'Death',hit:'RecieveHit'};
 for(const kk in map){const clip=THREE.AnimationClip.findByName(g.animations,map[kk]);if(!clip)continue;const a=mixer.clipAction(clip);acts[kk]=a;
  if(['slash','punch','death','hit'].includes(kk)){a.setLoop(THREE.LoopOnce);a.clampWhenFinished=true;}else{a.play();a.setEffectiveWeight(kk==='idle'?1:0);}}
 root.userData={obj,mixer,acts,cur:'idle',mats,hand:obj.getObjectByName('FistR')||obj.getObjectByName('Fist.R'),head:obj.getObjectByName('Head'),acc:0,weap:null,oneShot:0,h:1.8*(o.scale||1)};
 return root;}
function setAnim(f,name,speed=1){const u=f.userData;if(u.oneShot>0)return;if(u.cur!==name){const from=u.acts[u.cur],to=u.acts[name];to.enabled=true;to.setEffectiveTimeScale(1);to.setEffectiveWeight(1);if(!to.isRunning())to.play();from.crossFadeTo(to,.25,true);u.cur=name;}u.acts[name].setEffectiveTimeScale(speed);}
function playOnce(f,name,dur){const u=f.userData,a=u.acts[name];if(!a)return;const from=u.acts[u.cur];a.reset();a.enabled=true;a.setEffectiveWeight(1);a.setEffectiveTimeScale(a.getClip().duration/dur);a.play();if(from&&from!==a)from.crossFadeTo(a,.1,false);u.cur=name;u.oneShot=dur;}
function endOneShot(f){const u=f.userData;if(u.oneShot>0||u.cur==='death')return;if(!['slash','punch','hit'].includes(u.cur))return;const a=u.acts[u.cur],to=u.acts.idle;to.enabled=true;to.setEffectiveWeight(1);to.setEffectiveTimeScale(1);to.play();a.crossFadeTo(to,.2,false);u.cur='idle';}

// ---------- weapon & item meshes ----------
const metal=new THREE.MeshStandardMaterial({color:0xd8dde2,metalness:1,roughness:.25}),wood=new THREE.MeshStandardMaterial({color:0x7a5230,roughness:.8}),leather=new THREE.MeshStandardMaterial({color:0x3b2416,roughness:.9});
function weaponMesh(t){const g=new THREE.Group();
 if(t==='knife'){const b=new THREE.Mesh(new THREE.BoxGeometry(.04,.02,.32),metal);b.position.z=.22;const h=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.14,6),leather);h.rotation.x=Math.PI/2;g.add(b,h);}
 if(t==='spear'){const s=new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,2,6),wood);s.rotation.x=Math.PI/2;s.position.z=.4;const tip=new THREE.Mesh(new THREE.ConeGeometry(.05,.25,6),metal);tip.rotation.x=Math.PI/2;tip.position.z=1.5;g.add(s,tip);}
 if(t==='axe'){const s=new THREE.Mesh(new THREE.CylinderGeometry(.025,.03,.75,6),wood);s.rotation.x=Math.PI/2;s.position.z=.25;const hd=new THREE.Mesh(new THREE.BoxGeometry(.03,.2,.16),metal);hd.position.set(0,.09,.55);g.add(s,hd);}
 g.traverse(o=>{if(o.isMesh)o.castShadow=true;});return g;}
const crateMat=new THREE.MeshStandardMaterial({color:0x8b6a3e,roughness:.85}),bushMat=new THREE.MeshStandardMaterial({color:0x2f5f28,roughness:.9,flatShading:true}),berryMat=new THREE.MeshStandardMaterial({color:0xb5123f,roughness:.3}),bottleMat=new THREE.MeshStandardMaterial({color:0x7fc8ff,roughness:.05,metalness:.1,transparent:true,opacity:.75});
const WEAPONS={fists:{n:'Fists',dmg:8,rng:1.9,cd:.45},knife:{n:'Knife',dmg:18,rng:2.2,cd:.4},spear:{n:'Spear',dmg:28,rng:3.3,cd:.75},axe:{n:'Axe',dmg:34,rng:2.4,cd:.9}};
function itemMesh(t){const g=new THREE.Group();
 if(t in WEAPONS){const w=weaponMesh(t);w.position.y=.06;g.add(w);return g;}
 if(t==='food'){const c=new THREE.Mesh(new THREE.BoxGeometry(.6,.4,.45),crateMat);c.position.y=.2;c.castShadow=true;g.add(c);}
 if(t==='water'){const c=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,.4,10),bottleMat);c.position.y=.2;const cap=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.06,8),leather);cap.position.y=.43;g.add(c,cap);}
 if(t==='berries'){const b=new THREE.Mesh(new THREE.IcosahedronGeometry(.55,1),bushMat);b.position.y=.4;b.scale.y=.8;b.castShadow=true;g.add(b);const bg=new THREE.SphereGeometry(.06,6,4);for(let i=0;i<9;i++){const s=new THREE.Mesh(bg,berryMat);const a=rnd(0,6.28),e=rnd(-.2,.9);s.position.set(Math.cos(a)*.5*Math.cos(e),.4+Math.sin(e)*.42,Math.sin(a)*.5*Math.cos(e));g.add(s);}}
 return g;}

// ---------- select screen: thumbnails + rotating preview ----------
const pc=$('preview'),pr=new THREE.WebGLRenderer({canvas:pc,antialias:true,alpha:true,preserveDrawingBuffer:true});pr.toneMapping=THREE.ACESFilmicToneMapping;pr.toneMappingExposure=1.5;
const ps=new THREE.Scene(),pcam=new THREE.PerspectiveCamera(30,1,.1,50);pcam.position.set(0,1.2,4.8);pcam.lookAt(0,.95,0);
ps.add(new THREE.HemisphereLight(0xffffff,0x554433,1.6));const pd=new THREE.DirectionalLight(0xfff0dd,2.2);pd.position.set(2,4,3);ps.add(pd);const pd2=new THREE.DirectionalLight(0x88aaff,1);pd2.position.set(-3,2,-2);ps.add(pd2);
let pfig=null;const pclock=new THREE.Clock(),thumbs=[];
function charFig(c){const f=makeFigure({model:c.model,scale:c.scale,acc:c.acc,accC:c.accC,skin:c.skin});giveWeaponMesh(f,c.weapon);return f;}
function setPreview(){if(!MODELS[CHARS[0].model])return;if(pfig)ps.remove(pfig);pfig=charFig(CHARS[sel]);ps.add(pfig);}
function makeThumbs(){pr.setSize(160,180,false);pcam.aspect=160/180;pcam.position.set(0,1.05,3.3);pcam.lookAt(0,.95,0);pcam.updateProjectionMatrix();
 CHARS.forEach((c,i)=>{const f=charFig(c);f.rotation.y=.5;ps.add(f);f.userData.mixer.update(.4);pr.render(ps,pcam);thumbs[i]=pc.toDataURL('image/png');ps.remove(f);});pcam.position.set(0,1.2,4.8);pcam.lookAt(0,.95,0);renderChars();}
function renderChars(){
 $('chars').innerHTML=CHARS.map((c,i)=>`<div class="ch ${i==sel?'sel':''}" data-i="${i}">${thumbs[i]?`<img src="${thumbs[i]}" alt="">`:''}<b style="color:#${c.c.toString(16).padStart(6,'0')}">${c.name}</b>District ${c.d} · ${c.desc}
 ${[['HP',c.hp/140,'#e33'],['SPD',c.spd/1.25,'#3c9'],['STR',c.str/1.4,'#e93'],['STL',c.stl,'#99f']].map(s=>`<div style="display:flex;gap:4px;align-items:center;font-size:10px"><span style="width:26px">${s[0]}</span><div class="bar" style="flex:1"><i style="width:${s[1]*100}%;background:${s[2]}"></i></div></div>`).join('')}</div>`).join('');
 document.querySelectorAll('.ch').forEach(e=>e.onclick=()=>{sel=+e.dataset.i;renderChars();setPreview();});}
renderChars();
function previewLoop(){requestAnimationFrame(previewLoop);if($('select').classList.contains('hidden')||!pfig)return;const w=pc.clientWidth,h=pc.clientHeight;if(pc.width!==w||pc.height!==h){pr.setSize(w,h,false);pcam.aspect=w/h;pcam.updateProjectionMatrix();}const dt=pclock.getDelta();pfig.rotation.y+=dt*.7;pfig.userData.mixer.update(dt);pr.render(ps,pcam);}previewLoop();

// ---------- audio ----------
let ac=null;function audio(){if(!ac)try{ac=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}if(ac&&ac.state==='suspended')ac.resume();}
function tone(f,dur,type='sine',vol=.3,slide=0){if(!ac)return;const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.value=f;if(slide)o.frequency.exponentialRampToValueAtTime(slide,ac.currentTime+dur);g.gain.setValueAtTime(vol,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+dur);o.connect(g).connect(ac.destination);o.start();o.stop(ac.currentTime+dur);}
function cannon(){if(!ac)return;tone(90,1.2,'sine',.8,30);const n=ac.createBufferSource(),b=ac.createBuffer(1,ac.sampleRate*.6,ac.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,3);n.buffer=b;const g=ac.createGain();g.gain.value=.5;const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=400;n.connect(f).connect(g).connect(ac.destination);n.start();}

// ---------- renderer / scene ----------
const R=220,WL=-.6;
const LAKE={x:95,z:70,r:30},POND={x:-120,z:-40,r:15},SPRING={x:14,z:17,r:5};
const RIVERS=[{a:[95,70],b:[205,120],w:3.2},{a:[-112,-32],b:[-35,38],w:2.2}];
const CORN={x:0,z:0},RUINS={x:115,z:-75},CAVE={x:-60,z:-170};
const renderer=new THREE.WebGLRenderer({antialias:QL.aa,powerPreference:'high-performance'});
let pixelRatio=Math.min(devicePixelRatio,QL.pr);renderer.setPixelRatio(pixelRatio);renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;renderer.outputColorSpace=THREE.SRGBColorSpace;
if(QL.shadow){renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;}
document.body.prepend(renderer.domElement);renderer.domElement.style.display='none';
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.1,1500);scene.add(camera);
scene.fog=new THREE.Fog(0xb8d0e0,30,QL.fog);
const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;
const hemi=new THREE.HemisphereLight(0xcfe8ff,0x4a5a2a,.6),sun=new THREE.DirectionalLight(0xfff2d0,2.4);scene.add(hemi,sun,sun.target);
if(QL.shadow){sun.castShadow=true;sun.shadow.mapSize.set(QL.shadow,QL.shadow);const c=sun.shadow.camera;c.left=c.bottom=-38;c.right=c.top=38;c.near=1;c.far=220;sun.shadow.bias=-.0005;sun.shadow.normalBias=.04;}
const sky=new Sky();sky.scale.setScalar(1300);scene.add(sky);const su=sky.material.uniforms;su.turbidity.value=6;su.rayleigh.value=1.6;su.mieCoefficient.value=.005;su.mieDirectionalG.value=.8;
let composer=null;
if(QL.bloom&&!isTouch){composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.25,.5,.9));composer.addPass(new OutputPass());}
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);composer&&composer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
const tl=new THREE.TextureLoader();
function tex(n,rep,srgb){const t=tl.load('assets/tex/'+n);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rep,rep);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=isTouch?2:8;return t;}

// ---------- terrain & zones ----------
function segDist(x,z,a,b){const abx=b[0]-a[0],abz=b[1]-a[1];const t=Math.min(1,Math.max(0,((x-a[0])*abx+(z-a[1])*abz)/(abx*abx+abz*abz)));return Math.hypot(x-(a[0]+abx*t),z-(a[1]+abz*t));}
function zoneW(x,z){return{forest:sstep(-70,-110,x)*(1-sstep(-120,-150,z)),meadow:sstep(80,115,z)*(1-sstep(110,150,Math.abs(x))),high:sstep(-100,-145,z),ruins:1-sstep(14,26,Math.hypot(x-RUINS.x,z-RUINS.z))};}
function zoneName(x,z){const r=Math.hypot(x,z);if(r<22)return 'Cornucopia';if(Math.hypot(x-LAKE.x,z-LAKE.z)<LAKE.r+8)return 'Lake';if(Math.hypot(x-POND.x,z-POND.z)<POND.r+8)return 'Pond';
 const w=zoneW(x,z);if(w.ruins>.5)return 'Old Ruins';if(Math.hypot(x-CAVE.x,z-CAVE.z)<25)return 'Rock Caves';if(w.high>.5)return 'Rocky Highlands';if(w.forest>.5)return 'Dense Forest';if(w.meadow>.5)return 'Open Meadow';return 'Woodland';}
function H(x,z){const r=Math.hypot(x,z);
 let h=2.6*Math.sin(x*.03)*Math.cos(z*.034)+1.4*Math.sin(x*.075+1.3)*Math.sin(z*.062+.7)+.5*Math.sin((x+z)*.18);
 h=h<0?h*.25:h;h+=.8;const w=zoneW(x,z);
 h=h*(1-.6*w.meadow);
 h+=w.high*(7+5*Math.abs(Math.sin(x*.045)*Math.cos(z*.05))+2*Math.sin(x*.13+z*.09));
 h=h*(1-w.ruins*.7)+w.ruins*1.2;
 h=h*sstep(9,30,r)+.4*(1-sstep(9,30,r));
 let wt=Math.max(sstep(LAKE.r+8,LAKE.r-4,Math.hypot(x-LAKE.x,z-LAKE.z)),sstep(POND.r+6,POND.r-3,Math.hypot(x-POND.x,z-POND.z)),sstep(SPRING.r+3,SPRING.r-2,Math.hypot(x-SPRING.x,z-SPRING.z)));
 for(const rv of RIVERS)wt=Math.max(wt,sstep(rv.w*2.3,rv.w*.8,segDist(x,z,rv.a,rv.b)));
 h=h*(1-wt)-2.2*wt;
 return h+sstep(R,R+40,r)*22;}
function inWater(x,z){return H(x,z)<WL+.05;}
const TS=R+80,tg=new THREE.PlaneGeometry(TS*2,TS*2,QL.tseg,QL.tseg);tg.rotateX(-Math.PI/2);
{const p=tg.attributes.position,col=new Float32Array(p.count*3),c=new THREE.Color(),g0=new THREE.Color(.82,.9,.72),dirtC=new THREE.Color(.75,.62,.48),rockC=new THREE.Color(.62,.6,.56),meadC=new THREE.Color(.95,1,.62);
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),y=H(x,z);p.setY(i,y);const r=Math.hypot(x,z),w=zoneW(x,z);
  c.copy(g0).lerp(meadC,w.meadow*.6).lerp(rockC,Math.min(1,w.high*.8+sstep(R,R+30,r)*.6)).lerp(dirtC,Math.max(1-sstep(8,14,r),sstep(WL+.6,WL-.3,y)*.9,w.ruins*.7));col.set([c.r,c.g,c.b],i*3);}
 tg.setAttribute('color',new THREE.BufferAttribute(col,3));tg.computeVertexNormals();}
const ground=new THREE.Mesh(tg,new THREE.MeshStandardMaterial({map:tex('grass_c.jpg',TS/3,true),normalMap:tex('grass_n.jpg',TS/3),vertexColors:true,roughness:.95,envMapIntensity:.4}));ground.receiveShadow=true;scene.add(ground);
{const dg=new THREE.CircleGeometry(14,40);dg.rotateX(-Math.PI/2);const p=dg.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,H(p.getX(i),p.getZ(i))+.03);
 const a=new Float32Array(p.count*4);for(let i=0;i<p.count;i++){const r=Math.hypot(p.getX(i),p.getZ(i));a.set([1,1,1,1-sstep(9,14,r)],i*4);}dg.setAttribute('color',new THREE.BufferAttribute(a,4));
 const dm=new THREE.Mesh(dg,new THREE.MeshStandardMaterial({map:tex('ground_c.jpg',6,true),normalMap:tex('ground_n.jpg',6),roughness:1,transparent:true,vertexColors:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));dm.receiveShadow=true;scene.add(dm);}
// water: one plane, only visible where terrain dips below WL
const wnorm=tl.load('assets/tex/waternormals.jpg');wnorm.wrapS=wnorm.wrapT=THREE.RepeatWrapping;
let water,simpleWaterMat;const wgeo=new THREE.PlaneGeometry(TS*2,TS*2);
if(QL.water==='reflect'){water=new Water(wgeo,{textureWidth:512,textureHeight:512,waterNormals:wnorm,sunDirection:new THREE.Vector3(),sunColor:0xffffff,waterColor:0x1a4a5e,distortionScale:2.5,fog:true});}
else{wnorm.repeat.set(30,30);simpleWaterMat=new THREE.MeshStandardMaterial({color:0x1d5670,roughness:.08,metalness:.3,normalMap:wnorm,normalScale:new THREE.Vector2(.6,.6),transparent:true,opacity:.88,envMapIntensity:1.2});water=new THREE.Mesh(wgeo,simpleWaterMat);}
water.rotation.x=-Math.PI/2;water.position.y=WL;scene.add(water);
// shoreline sample points for AI drinking
const SHORE=[];for(let x=-R;x<=R;x+=3)for(let z=-R;z<=R;z+=3){if(Math.hypot(x,z)>R-4)continue;if(H(x,z)<WL&&(H(x+3,z)>WL||H(x-3,z)>WL||H(x,z+3)>WL||H(x,z-3)>WL))SHORE.push([x,z]);}
const wall=new THREE.Mesh(new THREE.CylinderGeometry(R,R,16,96,1,true),new THREE.MeshBasicMaterial({color:0x66ccff,transparent:true,opacity:.1,side:THREE.DoubleSide,depthWrite:false,fog:false}));wall.position.y=6;scene.add(wall);
const zoneMesh=new THREE.Mesh(new THREE.CylinderGeometry(1,1,50,96,1,true),new THREE.MeshBasicMaterial({color:0xff4410,transparent:true,opacity:.28,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));zoneMesh.position.y=14;scene.add(zoneMesh);
{const pts=[];for(let i=0;i<=20;i++){const t=i/20;pts.push(new THREE.Vector2(.15+3.2*Math.pow(t,1.6),t*9));}
 const corn=new THREE.Mesh(new THREE.LatheGeometry(pts,28),new THREE.MeshStandardMaterial({color:0xd9a93a,metalness:1,roughness:.28,side:THREE.DoubleSide}));
 corn.rotation.x=Math.PI/2-.12;corn.position.set(0,2.4+H(0,0),-8.5);corn.castShadow=corn.receiveShadow=true;scene.add(corn);}

// obstacles + spatial grid
const obstacles=[{x:0,z:-1.5,r:2.8,b:1},{x:0,z:-5,r:1.8,b:1}];
const GC=8,grid=new Map();
function gkey(cx,cz){return cx*10007+cz;}
function buildGrid(){grid.clear();for(const o of obstacles){const r=o.r*(o.b||1);for(let cx=Math.floor((o.x-r)/GC);cx<=Math.floor((o.x+r)/GC);cx++)for(let cz=Math.floor((o.z-r)/GC);cz<=Math.floor((o.z+r)/GC);cz++){const k=gkey(cx,cz);let a=grid.get(k);if(!a)grid.set(k,a=[]);a.push(o);}}}
function obsNear(x,z){return grid.get(gkey(Math.floor(x/GC),Math.floor(z/GC)))||[];}
const M4=new THREE.Matrix4(),QQ=new THREE.Quaternion(),S3=new THREE.Vector3(),P3=new THREE.Vector3(),E=new THREE.Euler(),col=new THREE.Color();
// chunked instancing: one InstancedMesh per (type, chunk) so far chunks can be hidden
const CH=100,chunks=[];
function chunked(geo,mat,list,opts={}){const by=new Map();for(const it of list){const k=Math.floor(it.x/CH)+','+Math.floor(it.z/CH);if(!by.has(k))by.set(k,[]);by.get(k).push(it);}
 for(const [k,arr] of by){const m=new THREE.InstancedMesh(geo,mat,arr.length);let cx=0,cz=0;arr.forEach((it,i)=>{m.setMatrixAt(i,it.m);if(it.c)m.setColorAt(i,it.c);cx+=it.x;cz+=it.z;});
  m.castShadow=!!opts.shadow;m.receiveShadow=!!opts.recv;m.computeBoundingSphere();scene.add(m);chunks.push({m,x:cx/arr.length,z:cz/arr.length,dist:opts.dist||QL.fog+CH*.7});}}
function updateChunks(px,pz){for(const c of chunks)c.m.visible=Math.hypot(c.x-px,c.z-pz)<c.dist;}
// trees by zone density
const barkMat=new THREE.MeshStandardMaterial({map:tex('bark_c.jpg',1,true),normalMap:tex('bark_n.jpg',1),roughness:.95});barkMat.map.repeat.set(1,2);barkMat.normalMap.repeat.set(1,2);
const pineGeo=mergeGeometries([[2.3,2.8,2.9],[1.8,2.5,4.3],[1.25,2.2,5.6],[.7,1.6,6.7]].map(([r,h,y])=>{const g=new THREE.ConeGeometry(r,h,8,1);g.translate(0,y,0);return g;}));
const pineMat=new THREE.MeshStandardMaterial({color:0x2c5528,roughness:.9,flatShading:true});
const leafGeo=mergeGeometries([[0,4.6,0,1.9],[1,4,.6,1.3],[-1,4.2,-.4,1.4],[.2,5.4,-.6,1.2],[-.4,3.8,1,1.1]].map(([x,y,z,r])=>{const g=new THREE.IcosahedronGeometry(r,1);g.translate(x,y,z);return g;}));
{const p=leafGeo.attributes.position;for(let i=0;i<p.count;i++){const n=Math.sin(p.getX(i)*3.1+p.getY(i)*2.3)*.12;p.setXYZ(i,p.getX(i)*(1+n),p.getY(i)*(1+n*.5),p.getZ(i)*(1+n));}leafGeo.computeVertexNormals();}
const leafMat=new THREE.MeshStandardMaterial({color:0x4a7a30,roughness:.85,flatShading:true});
const trunkGeo=new THREE.CylinderGeometry(.18,.32,4.2,7);trunkGeo.translate(0,2.1,0);
function treeDensity(x,z){const r=Math.hypot(x,z);if(r<24)return 0;const w=zoneW(x,z);if(w.ruins>.3||Math.hypot(x-CAVE.x,z-CAVE.z)<18)return 0;if(H(x,z)<WL+.6)return 0;return .28+w.forest*1.4-w.meadow*.27+w.high*-.1+(r>R?.35:0);}
const TL=[],PL=[],LL=[];
{let n=0,guard=0;while(n<QL.trees&&guard++<QL.trees*40){const a=Math.random()*6.283,r=Math.sqrt(Math.random())*(R+28),x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.random()*1.7>treeDensity(x,z))continue;
 const s=rnd(.8,1.5),y=H(x,z)-.2;QQ.setFromEuler(E.set(0,rnd(0,6.28),0));const m=new THREE.Matrix4().compose(P3.set(x,y,z),QQ,S3.set(s,s,s));TL.push({x,z,m});
 const pine=zoneW(x,z).high>.3||Math.random()<.6;(pine?PL:LL).push({x,z,m,c:pine?new THREE.Color().setHSL(rnd(.26,.33),rnd(.35,.5),rnd(.18,.26)):new THREE.Color().setHSL(rnd(.2,.3),rnd(.4,.55),rnd(.22,.32))});
 if(r<R)obstacles.push({x,z,r:.35*s,b:4});n++;}}
chunked(trunkGeo,barkMat,TL,{shadow:true,recv:true});chunked(pineGeo,pineMat,PL,{shadow:true});chunked(leafGeo,leafMat,LL,{shadow:true});
// rocks: scattered + highlands boulders + cliffs + cave arch
const rockGeo=new THREE.DodecahedronGeometry(1,1);{const p=rockGeo.attributes.position;for(let i=0;i<p.count;i++){const v=P3.fromBufferAttribute(p,i),n=1+.18*Math.sin(v.x*4+v.y*3)*Math.cos(v.z*5);p.setXYZ(i,v.x*n,v.y*n,v.z*n);}rockGeo.computeVertexNormals();}
const rockMat=new THREE.MeshStandardMaterial({map:tex('rock_c.jpg',1,true),normalMap:tex('rock_n.jpg',1),roughness:.9});
const RL=[];
function addRock(x,z,sx,sy,sz,ry=rnd(0,6),y0){const y=y0!==undefined?y0:H(x,z)+sy*.25;RL.push({x,z,m:new THREE.Matrix4().compose(P3.set(x,y,z),QQ.setFromEuler(E.set(rnd(-.3,.3),ry,rnd(-.3,.3))),S3.set(sx,sy,sz))});if(Math.hypot(x,z)<R)obstacles.push({x,z,r:Math.max(sx,sz)*.85,b:sy>1.2?1.3:.6});}
{let n=0;while(n<QL.rocks){const x=rnd(-R,R),z=rnd(-R,R);if(Math.hypot(x,z)>R-3||Math.hypot(x,z)<16||inWater(x,z))continue;const hw=zoneW(x,z).high;if(Math.random()>.35+hw*.65)continue;const s=rnd(.5,2.1)*(1+hw*1.2);addRock(x,z,s,s*rnd(.5,.9),s*rnd(.8,1.2));n++;}
 for(let i=0;i<14;i++){const a=rnd(-2.6,-.5),r=rnd(150,205),x=Math.cos(a)*r,z=Math.sin(a)*r;addRock(x,z,rnd(6,10),rnd(5,9),rnd(3,5),a+Math.PI/2);} // cliffs
 const c=CAVE,h=H(c.x,c.z);addRock(c.x-5,c.z,3,6,3.5,0);addRock(c.x+5,c.z,3,6,3.5,0);addRock(c.x,c.z,8,2.2,4,0,h+6.5);addRock(c.x-9,c.z+3,4,4,4);addRock(c.x+9,c.z-2,4,5,4);addRock(c.x,c.z-6,7,7,3,0);}
chunked(rockGeo,rockMat,RL,{shadow:true,recv:true});
// ruins: broken stone columns and walls
{const stone=new THREE.MeshStandardMaterial({normalMap:tex('rock_n.jpg',1),color:0xcbc2ad,roughness:.85});const colG=new THREE.CylinderGeometry(.7,.8,1,10),wallG=new THREE.BoxGeometry(1,1,1);const CL=[],WLs=[];
 for(let i=0;i<12;i++){const a=i/12*6.283,x=RUINS.x+Math.cos(a)*11,z=RUINS.z+Math.sin(a)*11,hh=Math.random()<.4?rnd(1,2.5):rnd(4.5,6.5),y=H(x,z);CL.push({x,z,m:new THREE.Matrix4().compose(P3.set(x,y+hh/2,z),QQ.identity(),S3.set(1,hh,1))});obstacles.push({x,z,r:.85,b:1.2});}
 for(let i=0;i<6;i++){const a=rnd(0,6.28),x=RUINS.x+Math.cos(a)*rnd(3,8),z=RUINS.z+Math.sin(a)*rnd(3,8),l=rnd(3,6),hh=rnd(.8,2.2),y=H(x,z);WLs.push({x,z,m:new THREE.Matrix4().compose(P3.set(x,y+hh/2,z),QQ.setFromEuler(E.set(0,a,0)),S3.set(l,hh,.6))});obstacles.push({x,z,r:l*.4,b:1});}
 chunked(colG,stone,CL,{shadow:true,recv:true});chunked(wallG,stone,WLs,{shadow:true,recv:true});}
buildGrid();
// grass: chunked, only drawn near the player
const grassU={time:{value:0}};
{const bl=[];for(let k=0;k<3;k++){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-.035,0,0,.035,0,0,.0,.38,0],3));g.setAttribute('color',new THREE.Float32BufferAttribute([.12,.22,.06,.12,.22,.06,.38,.55,.18],3));g.rotateY(k*2.1);g.rotateX(rnd(-.2,.2));g.translate(rnd(-.1,.1),0,rnd(-.1,.1));bl.push(g);}
 const gg=mergeGeometries(bl);gg.computeVertexNormals();
 const gm=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
 gm.onBeforeCompile=s=>{s.uniforms.time=grassU.time;s.vertexShader='uniform float time;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n float ph=instanceMatrix[3].x*.35+instanceMatrix[3].z*.27; transformed.x+=sin(time*1.8+ph)*.09*position.y; transformed.z+=cos(time*1.3+ph)*.05*position.y;');};
 const GL=[],centers=[];for(let i=0;i<160;i++){let x,z;do{x=rnd(-R,R);z=rnd(-R,R);}while(Math.hypot(x,z)>R);centers.push([x,z,zoneW(x,z).meadow>.5?16:9]);}
 for(let i=0;i<40;i++)centers.push([rnd(-110,110),rnd(100,200),18]);
 let guard=0;while(GL.length<QL.grass&&guard++<QL.grass*3){const c=pick(centers),x=c[0]+rnd(-c[2],c[2]),z=c[1]+rnd(-c[2],c[2]);if(Math.hypot(x,z)>R-1||Math.hypot(x,z)<11||H(x,z)<WL+.3||zoneW(x,z).high>.6)continue;
  const s=rnd(.7,1.6);GL.push({x,z,m:new THREE.Matrix4().compose(P3.set(x,H(x,z)-.03,z),QQ.setFromEuler(E.set(0,rnd(0,6.28),0)),S3.set(s,s*rnd(.8,1.4),s))});}
 const save=CH;chunkedSmall(gg,gm,GL);}
function chunkedSmall(geo,mat,list){const C=40,by=new Map();for(const it of list){const k=Math.floor(it.x/C)+','+Math.floor(it.z/C);if(!by.has(k))by.set(k,[]);by.get(k).push(it);}
 for(const [,arr] of by){const m=new THREE.InstancedMesh(geo,mat,arr.length);let cx=0,cz=0;arr.forEach((it,i)=>{m.setMatrixAt(i,it.m);cx+=it.x;cz+=it.z;});m.computeBoundingSphere();scene.add(m);chunks.push({m,x:cx/arr.length,z:cz/arr.length,dist:QL.grassDist+20});}}
// line of sight (trees' foliage and rocks block view)
function LOS(ax,az,bx,bz){const d=Math.hypot(bx-ax,bz-az),n=Math.ceil(d/GC)+1,seen=new Set();
 for(let i=0;i<=n;i++){const t=i/n,x=ax+(bx-ax)*t,z=az+(bz-az)*t;for(const o of obsNear(x,z)){if(seen.has(o))continue;seen.add(o);
  const r=o.r*(o.b||1)*.8;if(Math.hypot(o.x-ax,o.z-az)<r+.5||Math.hypot(o.x-bx,o.z-bz)<r+.5)continue;if(segDist(o.x,o.z,[ax,az],[bx,bz])<r)return false;}}return true;}

// ---------- items ----------
let items=[];
const CACHES=[[-150,20],[0,165],[40,-175],[RUINS.x,RUINS.z],[60,115],[-135,-70],[165,-20],[-60,120]];
function addItem(type,x,z){const m=itemMesh(type);m.position.set(x,H(x,z),z);m.rotation.y=rnd(0,6.28);scene.add(m);items.push({type,m,x,z});}
let cacheCrates=[];
function spawnItems(){items.forEach(i=>scene.remove(i.m));items=[];cacheCrates.forEach(c=>scene.remove(c));cacheCrates=[];
 const near=['knife','knife','spear','spear','axe','knife','spear','food','food','water','water','food','axe','knife','water','food','spear','axe'];
 near.forEach((t,i)=>{const a=i/near.length*6.283,r=rnd(5,11);addItem(t,Math.cos(a)*r,Math.sin(a)*r);});
 for(const [cx,cz] of CACHES){const c=new THREE.Mesh(new THREE.BoxGeometry(1.2,.8,.9),crateMat);c.position.set(cx,H(cx,cz)+.4,cz);c.rotation.y=rnd(0,3);c.castShadow=true;scene.add(c);cacheCrates.push(c);
  for(const t of [pick(['knife','spear','axe']),'food','water',pick(['food','berries','knife'])]){const a=rnd(0,6.28);addItem(t,cx+Math.cos(a)*2.2,cz+Math.sin(a)*2.2);}}
 for(let i=0;i<110;i++){let x,z;do{x=rnd(-R+5,R-5);z=rnd(-R+5,R-5);}while(Math.hypot(x,z)>R-5||inWater(x,z));const w=zoneW(x,z);
  addItem(i<70?(w.high>.5?'food':'berries'):i<92?'food':i<104?'water':pick(['knife','spear']),x,z);}}

// ---------- first-person arms ----------
const fpArms=new THREE.Group();camera.add(fpArms);
const skinMat=new THREE.MeshStandardMaterial({color:0xd9a27c,roughness:.6}),sleeveMat=new THREE.MeshStandardMaterial({color:0x666666,roughness:.8});
{const sleeve=new THREE.Mesh(new THREE.CylinderGeometry(.06,.07,.3,10),sleeveMat);sleeve.rotation.x=Math.PI/2;
 const arm=new THREE.Mesh(new THREE.CylinderGeometry(.045,.055,.16,10),skinMat);arm.rotation.x=Math.PI/2;arm.position.z=-.22;
 const fist=new THREE.Mesh(new THREE.SphereGeometry(.06,10,8),skinMat);fist.scale.set(1,.85,1.2);fist.position.z=-.33;
 fpArms.add(sleeve,arm,fist);fpArms.position.set(.3,-.3,-.5);fpArms.rotation.set(.1,.45,0);}
let fpWeapon=null;
function giveWeaponMesh(f,t){const u=f.userData;if(u.weap){u.weap.parent.remove(u.weap);u.weap=null;}if(!t||t==='fists'||!u.hand)return;
 const w=weaponMesh(t);f.updateMatrixWorld(true);const ws=new THREE.Vector3();u.hand.getWorldScale(ws);const fs=new THREE.Vector3();f.getWorldScale(fs);w.scale.setScalar(fs.x/ws.x);w.rotation.set(Math.PI/2,0,0);u.hand.add(w);u.weap=w;}
function setWeaponModel(){if(fpWeapon)fpArms.remove(fpWeapon);fpWeapon=null;giveWeaponMesh(player.fig,player.weapon);const t=player.weapon;
 if(t==='fists')return;fpWeapon=weaponMesh(t);fpWeapon.position.set(0,0,-.33);fpWeapon.rotation.x=-.25;fpArms.add(fpWeapon);}

// ---------- name tags ----------
function makeTag(e){const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d');x.font='bold 30px system-ui';x.textAlign='center';
 x.fillStyle='rgba(0,0,0,.45)';x.fillRect(20,8,216,48);x.fillStyle='#'+(DCOL[e.d]||0xffffff).toString(16).padStart(6,'0');x.fillRect(20,52,216,4);x.fillStyle=e.ally?'#ff8a8a':'#fff';x.fillText(`${e.name} · D${e.d}`,128,42);
 const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthWrite:false,fog:false}));s.scale.set(1.6,.4,1);s.position.y=e.fig.userData.h+.45;s.visible=false;e.fig.add(s);return s;}

// ---------- entities ----------
let ents=[],player=null,zoneR=R,time=0,running=false,camMode=isTouch?'third':'first',yaw=0,pitch=0,simMode=false,deaths=[],allianceOn=true,winner=null;
const dayLen=150,GRACE=15,STORM_START=40,STORM_DUR=600,STORM_MIN=22;
const PERS={career:{aggr:.9,caution:.25,loot:.7},hunter:{aggr:.6,caution:.45,loot:.5},scavenger:{aggr:.35,caution:.55,loot:1},hider:{aggr:.15,caution:.9,loot:.35}};
function makeEnt(cfg,isPlayer){const fig=makeFigure(cfg.look);scene.add(fig);
 const e={name:cfg.name,d:cfg.d,fig,isPlayer,hp:cfg.hp,maxhp:cfg.hp,spd:cfg.spd,str:cfg.str,stl:cfg.stl,hunger:100,thirst:100,weapon:cfg.weapon||'fists',x:0,z:0,y:0,vy:0,dir:0,cd:0,alive:true,swing:0,flash:0,think:0,tx:0,tz:0,target:null,speed:0,deadT:0,
  pers:cfg.pers,P:PERS[cfg.pers]||PERS.hunter,ally:cfg.ally||0,state:'loot',mem:new Map(),windup:0,recover:0,strafe:Math.random()<.5?1:-1,strafeT:0,stuckT:0,detour:0,dx:0,dz:0,noise:0,hiding:false,lastX:0,lastZ:0,checkT:0,ambushSpot:null,kills:0};
 if(!isPlayer)e.tag=makeTag(e);if(e.weapon!=='fists')giveWeaponMesh(fig,e.weapon);return e;}
function startGame(opts={}){
 audio();ents.forEach(e=>scene.remove(e.fig));ents=[];spawnItems();zoneR=R;time=0;deaths=[];allianceOn=true;winner=null;simMode=!!opts.sim;
 const pc=CHARS[sel];player=makeEnt({...pc,look:{model:pc.model,scale:pc.scale,acc:pc.acc,accC:pc.accC,skin:pc.skin},pers:'player'},true);ents.push(player);player.ghost=simMode;sleeveMat.color.setHex(pc.c);
 const others=[];for(let d=1;d<=12;d++)for(let k=0;k<2;k++)others.push(d);others.splice(others.indexOf(pc.d),1);
 const names=FIRST.slice().sort(()=>Math.random()-.5),pool=AI_MODELS.filter(m=>m!==pc.model);let mi=Math.floor(Math.random()*pool.length);
 others.forEach((d,i)=>{const career=d<=2||d===4;const pers=career?'career':pick(['hunter','scavenger','scavenger','hider','hider','hunter']);
  const look={model:pool[(mi+i)%pool.length],scale:rnd(.88,1.12),cloth:new THREE.Color().setHSL(Math.random(),rnd(.35,.75),rnd(.25,.55)).getHex(),skin:pick(SKINS),hair:new THREE.Color().setHSL(rnd(.02,.12),rnd(.3,.7),rnd(.08,.6)).getHex(),acc:pick(['none','backpack','quiver','bedroll','cape','sash']),accC:new THREE.Color().setHSL(Math.random(),.5,.35).getHex()};
  ents.push(makeEnt({name:names[i],d,hp:(career?rnd(105,130):rnd(80,115))|0,spd:rnd(.85,1.12),str:career?rnd(1.05,1.3):rnd(.8,1.15),stl:pers==='hider'?.8:.5,look,pers,ally:career?1:0},false));});
 ents.forEach((e,i)=>{const a=i/24*6.283;e.x=Math.cos(a)*17;e.z=Math.sin(a)*17;e.y=H(e.x,e.z);e.dir=Math.atan2(-e.x,-e.z);e.tx=e.x;e.tz=e.z;e.lastX=e.x;e.lastZ=e.z;});
 yaw=player.dir+Math.PI;pitch=0;
 if(simMode){running=true;return;}
 ['select','end'].forEach(s=>$(s).classList.add('hidden'));['hud','count','cross','mapwrap'].forEach(s=>$(s).classList.remove('hidden'));
 if(isTouch){$('touch').classList.remove('hidden');$('btns').classList.remove('hidden');}
 renderer.domElement.style.display='block';running=true;setCam();fpsLog=[];
 announce('Let the Games begin!');$('hint').textContent=isTouch?'':'Click to lock mouse';updateCount();}
$('start').onclick=()=>startGame();$('retry').onclick=()=>startGame();
$('newchar').onclick=()=>{$('end').classList.add('hidden');$('select').classList.remove('hidden');renderer.domElement.style.display='none';$('mapwrap').classList.add('hidden');};
loadP.then(()=>{makeThumbs();$('start').disabled=false;$('start').textContent='Enter the Arena';setPreview();}).catch(e=>{$('start').textContent='Failed to load models';console.error(e);});
let msgT;function announce(t){if(simMode)return;const m=$('msg');m.textContent=t;m.style.opacity=1;clearTimeout(msgT);msgT=setTimeout(()=>m.style.opacity=0,3000);}
function alive(){return ents.filter(e=>e.alive&&!e.ghost);}
function updateCount(){if(!simMode)$('count').innerHTML=`Tributes remaining: ${alive().length}`;}
function kill(e,by){if(!e.alive)return;e.alive=false;e.deadT=0;const u=e.fig.userData;u.oneShot=0;playOnce(e.fig,'death',1.2);u.oneShot=99;if(e.tag)e.tag.visible=false;
 if(!simMode)setTimeout(()=>scene.remove(e.fig),8000);if(by&&by.kills!==undefined)by.kills++;
 deaths.push({t:Math.round(time),name:e.name,d:e.d,pers:e.pers,by:by?(by.name||by):'?',zone:zoneName(e.x,e.z)});
 if(e.weapon!=='fists'){addItem(e.weapon,e.x+1,e.z);giveWeaponMesh(e.fig,null);}
 if(!simMode)cannon();updateCount();
 if(e.isPlayer){camMode='third';setCam();return endGame(false,by);}announce(`BOOM! ${e.name}, District ${e.d}, has fallen${by&&by.isPlayer?' (by you)':''}`);
 const al=alive();if(allianceOn&&al.length<=7){allianceOn=false;for(const t of ents)t.ally=0;announce("The Careers' alliance has broken!");}
 if(simMode&&al.length===1){winner=al[0];running=false;}
 else if(player.alive&&!player.ghost&&al.length===1)endGame(true);}
function endGame(win,by){running=false;if(document.pointerLockElement)document.exitPointerLock();
 $('endTitle').textContent=win?'VICTOR!':'YOU DIED';$('endTitle').style.color=win?'#f5b942':'#e33';
 const mins=Math.floor(time/60),secs=Math.floor(time%60);
 $('final').innerHTML=win?`${player.name} of District ${player.d} wins the Games!<br>Survived ${mins}m ${secs}s · ${player.kills} kills`:`Placed #${alive().length+1} of 24 · survived ${mins}m ${secs}s${by?`<br>Killed by ${by.name||by}`:''}`;
 setTimeout(()=>{$('end').classList.remove('hidden');['touch','btns','cross','mapwrap'].forEach(s=>$(s).classList.add('hidden'));},win?600:1800);}
function attack(a){if(a.cd>0||!a.alive)return;const w=WEAPONS[a.weapon];a.cd=w.cd;a.swing=.3;a.noise=22;
 if(!simMode)playOnce(a.fig,a.weapon==='fists'?'punch':'slash',Math.max(.35,w.cd*.9));if(a.isPlayer)tone(220,.08,'square',.08,110);
 const fx=Math.sin(a.dir),fz=Math.cos(a.dir);let best=null,bd=1e9;
 for(const e of ents){if(e===a||!e.alive||e.ghost)continue;const dx=e.x-a.x,dz=e.z-a.z,d=Math.hypot(dx,dz);if(d>w.rng+.4)continue;if((dx*fx+dz*fz)/(d||1)<.4)continue;if(d<bd){bd=d;best=e;}}
 if(best){const dmg=w.dmg*a.str*rnd(.85,1.15)*(best.isPlayer?.55:1)*(a.ambushBonus?1.6:1);a.ambushBonus=false;best.hp-=dmg;best.flash=.2;best.x+=fx*.6;best.z+=fz*.6;
  if(!best.isPlayer){remember(best,a,true);if(best.state!=='flee')best.target=a;}if(best.isPlayer||a.isPlayer)tone(140,.12,'sawtooth',.15,60);if(best.hp<=0)kill(best,a);}}
function nearWater(e){for(const[dx,dz]of[[0,0],[2,0],[-2,0],[0,2],[0,-2]])if(H(e.x+dx,e.z+dz)<WL)return true;return false;}
function pickup(e){let best=null,bd=2.6;for(const it of items){const d=Math.hypot(it.x-e.x,it.z-e.z);if(d<bd){bd=d;best=it;}}
 if(best){scene.remove(best.m);items.splice(items.indexOf(best),1);const t=best.type;
  if(WEAPONS[t]){if(e.weapon!=='fists')addItem(e.weapon,e.x+.8,e.z+.8);e.weapon=t;if(e.isPlayer){announce('Picked up '+WEAPONS[t].n);setWeaponModel();}else if(!simMode)giveWeaponMesh(e.fig,t);}
  else if(t==='berries'){e.hunger=Math.min(100,e.hunger+20);e.hp=Math.min(e.maxhp,e.hp+5);if(e.isPlayer)announce('Ate berries');}
  else if(t==='food'){e.hunger=Math.min(100,e.hunger+45);e.hp=Math.min(e.maxhp,e.hp+10);if(e.isPlayer)announce('Ate rations');}
  else if(t==='water'){e.thirst=Math.min(100,e.thirst+50);if(e.isPlayer)announce('Drank water');}
  if(e.isPlayer)tone(660,.1,'triangle',.15,990);return true;}
 if(nearWater(e)){e.thirst=Math.min(100,e.thirst+35);if(e.isPlayer){announce('You drink from the water');tone(500,.15,'sine',.12,300);}return true;}return false;}
function setCam(){if(player)player.fig.visible=camMode==='third'||!player.alive;fpArms.visible=camMode==='first'&&player&&player.alive;if(player)setWeaponModel();}

// ---------- input ----------
const keys={};let moveX=0,moveY=0;
addEventListener('keydown',e=>{keys[e.code]=true;if(!running||simMode)return;if(e.code==='KeyE')pickup(player);if(e.code==='KeyV'){camMode=camMode==='first'?'third':'first';setCam();}if(e.code==='Space'&&player.vy===0)player.vy=6;});
addEventListener('keyup',e=>keys[e.code]=false);
const cv=renderer.domElement;
cv.addEventListener('mousedown',()=>{if(!running||isTouch)return;if(document.pointerLockElement!==cv){cv.requestPointerLock?.();$('hint').textContent='';}else attack(player);});
addEventListener('mousemove',e=>{if(document.pointerLockElement===cv){yaw-=e.movementX*.0025;pitch=THREE.MathUtils.clamp(pitch-e.movementY*.0025,-1.3,1.3);}});
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
function btn(k){if(!running)return;if(k==='atk')attack(player);if(k==='jump'&&player.vy===0)player.vy=6;if(k==='use')pickup(player);if(k==='cam'){camMode=camMode==='first'?'third':'first';setCam();}}
document.querySelectorAll('#btns div').forEach(b=>{b.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();audio();if(b.dataset.b==='atk')atkHeld=true;btn(b.dataset.b);},{passive:false});
 b.addEventListener('touchend',e=>{e.preventDefault();if(b.dataset.b==='atk')atkHeld=false;});
 b.addEventListener('mousedown',e=>{e.stopPropagation();btn(b.dataset.b);});});

// ---------- AI: perception ----------
function isNight(){const p=(time/dayLen)%1;return p>.55&&p<.95;}
function remember(e,o,share){if(o.ghost)return;e.mem.set(o,{x:o.x,z:o.z,t:time});if(share&&e.ally)for(const a of ents)if(a!==e&&a.alive&&a.ally===e.ally&&Math.hypot(a.x-e.x,a.z-e.z)<35)a.mem.set(o,{x:o.x,z:o.z,t:time});}
function perceive(e){const fx=Math.sin(e.dir),fz=Math.cos(e.dir),night=isNight();
 for(const o of ents){if(o===e||!o.alive||o.ghost||(e.ally&&o.ally===e.ally))continue;const dx=o.x-e.x,dz=o.z-e.z,d=Math.hypot(dx,dz);if(d>50)continue;
  const sightR=(night?15:32)*(o.isPlayer?1.25-o.stl*.6:1-o.stl*.3)*(o.hiding?.5:1);
  const noiseR=o.noise*(o.isPlayer?1.2-o.stl*.7:1)*(night?1.25:1);
  if(d<noiseR||d<2.5){remember(e,o,true);continue;}
  if(d<sightR&&(dx*fx+dz*fz)/d>.34&&LOS(e.x,e.z,o.x,o.z))remember(e,o,true);}
 let best=null,bd=1e9;for(const [o,m] of e.mem){if(!o.alive||time-m.t>9||(e.ally&&o.ally===e.ally)){e.mem.delete(o);continue;}const d=Math.hypot(m.x-e.x,m.z-e.z);if(d<bd){bd=d;best=o;}}
 return best;}
const power=o=>Math.max(1,o.hp)*WEAPONS[o.weapon].dmg*o.str;
function nearestItem(e,f,maxD){let best=null,bd=maxD;for(const it of items){if(!f(it))continue;const d=Math.hypot(it.x-e.x,it.z-e.z);if(d<bd){bd=d;best=it;}}return best;}
function nearestShore(e){let b=null,bd=1e9;for(const s of SHORE){if(Math.hypot(s[0],s[1])>zoneR-6)continue;const d=Math.hypot(s[0]-e.x,s[1]-e.z);if(d<bd){bd=d;b=s;}}return b;}
function coverSpot(e){let b=null,bd=1e9;for(let i=0;i<8;i++){const a=rnd(0,6.28),r=rnd(4,18),x=e.x+Math.cos(a)*r,z=e.z+Math.sin(a)*r;if(Math.hypot(x,z)>zoneR-10||inWater(x,z))continue;const n=obsNear(x,z).length;const s=-n*3+r*.2;if(s<bd){bd=s;b=[x,z];}}return b||[e.x,e.z];}
// ---------- AI: utility decision (staggered) ----------
function aiThink(e){
 const P=e.P,hpF=e.hp/e.maxhp,t=perceive(e),known=t?e.mem.get(t):null,dT=t?Math.hypot(known.x-e.x,known.z-e.z):1e9;
 const myP=power(e),thP=t?power(t):1,ratio=Math.min(2.5,Math.max(.25,myP/thP)),grace=time<GRACE;
 const U={};
 U.hunt=t&&!grace?P.aggr*(.35+hpF)*ratio*(t.isPlayer?.8:1)*(dT<35?1:.4)*(e.weapon==='fists'&&t.weapon!=='fists'?.5:1):0;
 U.flee=t?(hpF<.3?.9:0)+P.caution*(1-hpF)*1.3+(ratio<.55?P.caution*.9:0)*(dT<20?1:.3):0;
 U.drink=Math.pow(1-e.thirst/100,2)*1.6+(e.thirst<25?1.2:0)+(e.state==='drink'&&e.thirst<92?.8:0);
 U.forage=Math.pow(1-e.hunger/100,2)*1.4+(e.hunger<22?1:0)+(e.state==='forage'&&e.hunger<85?.6:0);
 const better=it=>it.type in WEAPONS&&WEAPONS[it.type].dmg>WEAPONS[e.weapon].dmg;
 const loot=nearestItem(e,better,time<60?40:70);U.loot=loot?P.loot*(e.weapon==='fists'?1:.45):0;
 U.rest=!t||dT>25?(hpF<.75?(1-hpF)*1.4*(.5+P.caution):0):0;
 U.ambush=!t&&time>GRACE?(isNight()?.32:.14)*(e.pers==='hider'||e.pers==='career'?1.4:.6):0;
 U.patrol=.28;
 if(U[e.state]!==undefined)U[e.state]+=.12; // hysteresis
 let st='patrol',bv=-1;for(const k in U)if(U[k]>bv){bv=U[k];st=k;}
 if(st!==e.state){e.state=st;e.ambushSpot=null;e.stateT=0;}
 e.target=st==='hunt'?t:null;e.threat=t;e.hiding=st==='rest'||st==='ambush';
 // choose movement goal for state
 const safeR=Math.max(STORM_MIN-4,zoneR-12-(time>STORM_START?STORM_SPEED*25:0));
 const outside=Math.hypot(e.x,e.z)>safeR;
 switch(st){
  case 'hunt':e.tx=t.alive?(Math.hypot(t.x-e.x,t.z-e.z)<12?t.x:known.x):known.x;e.tz=Math.hypot(t.x-e.x,t.z-e.z)<12?t.z:known.z;e.pace=1;break;
  case 'flee':{const ax=e.x-known.x,az=e.z-known.z,l=Math.hypot(ax,az)||1;e.tx=e.x+ax/l*20;e.tz=e.z+az/l*20;e.pace=1;break;}
  case 'drink':{if(nearWater(e)){pickup(e);e.pace=0;e.tx=e.x;e.tz=e.z;}else{const it=nearestItem(e,i=>i.type==='water',30),s=it?[it.x,it.z]:nearestShore(e);if(s){e.tx=s[0];e.tz=s[1];if(it&&Math.hypot(it.x-e.x,it.z-e.z)<2)pickup(e);}e.pace=.75;}break;}
  case 'forage':{const it=nearestItem(e,i=>i.type==='food'||i.type==='berries',80);if(it){e.tx=it.x;e.tz=it.z;if(Math.hypot(it.x-e.x,it.z-e.z)<2)pickup(e);}else wander(e,safeR);e.pace=.7;break;}
  case 'loot':if(loot){e.tx=loot.x;e.tz=loot.z;if(Math.hypot(loot.x-e.x,loot.z-e.z)<2)pickup(e);}e.pace=time<30?1:.75;break;
  case 'rest':if(!e.ambushSpot)e.ambushSpot=coverSpot(e);e.tx=e.ambushSpot[0];e.tz=e.ambushSpot[1];e.pace=.5;break;
  case 'ambush':if(!e.ambushSpot){const s=pick([nearestShore(e),[e.x+rnd(-15,15),e.z+rnd(-15,15)]])||[e.x,e.z];e.ambushSpot=coverSpot({x:s[0],z:s[1]});}e.tx=e.ambushSpot[0];e.tz=e.ambushSpot[1];e.pace=.45;
   for(const o of ents)if(o!==e&&o.alive&&!o.ghost&&!(e.ally&&o.ally===e.ally)&&Math.hypot(o.x-e.x,o.z-e.z)<8&&time>GRACE){remember(e,o);e.state='hunt';e.target=o;e.ambushBonus=true;e.hiding=false;break;}break;
  default:{ // patrol; careers stick together
   if(e.ally){const lead=ents.find(a=>a.alive&&a.ally===e.ally);if(lead&&lead!==e&&Math.hypot(lead.x-e.x,lead.z-e.z)>6){e.tx=lead.x+rnd(-4,4);e.tz=lead.z+rnd(-4,4);e.pace=.8;break;}}
   if(Math.hypot(e.tx-e.x,e.tz-e.z)<3||Math.random()<.04)wander(e,safeR);e.pace=.55;}}
 if(outside&&!(st==='hunt'&&Math.hypot(e.tx,e.tz)<safeR)){const a=Math.atan2(e.z,e.x)+rnd(-.4,.4),r=safeR*.55;e.tx=Math.cos(a)*r;e.tz=Math.sin(a)*r;e.pace=1;}}
function wander(e,safeR){for(let i=0;i<6;i++){const a=Math.random()*6.283,r=rnd(10,45),x=e.x+Math.cos(a)*r,z=e.z+Math.sin(a)*r;if(Math.hypot(x,z)<Math.min(safeR,R-6)&&!inWater(x,z)){e.tx=x;e.tz=z;return;}}const a=Math.atan2(e.z,e.x);e.tx=Math.cos(a)*safeR*.5;e.tz=Math.sin(a)*safeR*.5;}
// ---------- AI: steering with obstacle avoidance ----------
function steerDir(e,dx,dz){let l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;let ax=0,az=0;
 for(const o of obsNear(e.x+dx*2,e.z+dz*2)){const rx=o.x-e.x,rz=o.z-e.z,ahead=rx*dx+rz*dz;if(ahead<=0||ahead>3.5)continue;const lat=rx*-dz+rz*dx,need=o.r+.75;if(Math.abs(lat)<need){const s=(lat>0?-1:1)*(1-ahead/3.5)*2.2;ax+=-dz*s;az+=dx*s;}}
 for(const o of ents){if(o===e||!o.alive)continue;const rx=e.x-o.x,rz=e.z-o.z,d=Math.hypot(rx,rz);if(d<1.1&&d>.01){ax+=rx/d*.8;az+=rz/d*.8;}}
 dx+=ax;dz+=az;l=Math.hypot(dx,dz)||1;return[dx/l,dz/l];}
function collide(e){for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(const o of (grid.get(gkey(Math.floor(e.x/GC)+i,Math.floor(e.z/GC)+j))||[])){const dx=e.x-o.x,dz=e.z-o.z,d2=dx*dx+dz*dz,r=o.r+.35;if(d2<r*r&&d2>1e-6){const d=Math.sqrt(d2);e.x=o.x+dx/d*r;e.z=o.z+dz/d*r;}}
 const d=Math.hypot(e.x,e.z);if(d>R-1){e.x*=(R-1)/d;e.z*=(R-1)/d;}}
function move(e,mx,mz,dt){const ox=e.x,oz=e.z;const sp=4.6*e.spd*(inWater(e.x,e.z)?.5:1)*(e.hunger<=0||e.thirst<=0?.7:1);e.x+=mx*sp*dt;e.z+=mz*sp*dt;collide(e);e.speed=Math.hypot(e.x-ox,e.z-oz)/dt;}
function face(e,want,dt,k=8){let dd=want-e.dir;dd=Math.atan2(Math.sin(dd),Math.cos(dd));e.dir+=dd*Math.min(1,dt*k);}
function aiAct(e,dt){
 const t=e.target;e.strafeT-=dt;if(e.strafeT<=0){e.strafeT=rnd(1.2,2.8);if(Math.random()<.5)e.strafe*=-1;}
 if(e.windup>0){e.windup-=dt;if(t)face(e,Math.atan2(t.x-e.x,t.z-e.z),dt,10);if(e.windup<=0){e.cd=0;attack(e);e.recover=rnd(.35,.75);}return;}
 if(t&&t.alive){const dx=t.x-e.x,dz=t.z-e.z,d=Math.hypot(dx,dz),w=WEAPONS[e.weapon];
  if(d<w.rng+3){face(e,Math.atan2(dx,dz),dt,9);const nx=dx/d,nz=dz/d;
   if(e.recover>0){e.recover-=dt;move(e,-nx*.7+(-nz)*e.strafe*.4,-nz*.7+nx*e.strafe*.4,dt*.85);return;}
   if((t.windup>0||t.swing>.15)&&Math.random()<e.P.caution*dt*6){e.recover=.4;return;} // dodge back
   if(d<=w.rng*.95&&e.cd<=0&&Math.random()<dt*(t.isPlayer?2.2:3.5)){e.windup=t.isPlayer?.45:.3;if(!simMode)playOnce(e.fig,e.weapon==='fists'?'punch':'slash',.55);return;}
   const want=w.rng*.8,rad=(d-want)*.9;const [sx,sz]=steerDir(e,nx*rad+(-nz)*e.strafe*.65,nz*rad+nx*e.strafe*.65);move(e,sx*.75,sz*.75,dt);return;}}
 const dx=e.tx-e.x,dz=e.tz-e.z,d=Math.hypot(dx,dz);
 if(e.detour>0){e.detour-=dt;const ddx=e.dx-e.x,ddz=e.dz-e.z,l=Math.hypot(ddx,ddz)||1;face(e,Math.atan2(ddx,ddz),dt);move(e,ddx/l*.8,ddz/l*.8,dt);return;}
 if(d>1.2&&e.pace>0){const [sx,sz]=steerDir(e,dx,dz);face(e,Math.atan2(sx,sz),dt);move(e,sx*e.pace,sz*e.pace,dt);e.wantMove=true;}else e.wantMove=false;
 e.checkT+=dt;if(e.checkT>1.5){if(e.wantMove&&Math.hypot(e.x-e.lastX,e.z-e.lastZ)<1){e.stuck=(e.stuck||0)+1;const a=Math.atan2(dz,dx)+(Math.random()<.5?1.7:-1.7);e.dx=e.x+Math.cos(a)*6;e.dz=e.z+Math.sin(a)*6;e.detour=1.3;}e.checkT=0;e.lastX=e.x;e.lastZ=e.z;}}
// ---------- per-entity update ----------
function updateEnt(e,dt){
 if(!e.alive||e.ghost)return;e.cd-=dt;e.swing=Math.max(0,e.swing-dt);e.flash=Math.max(0,e.flash-dt);e.noise=Math.max(0,e.noise-dt*20);
 e.hunger-=dt*(e.isPlayer?.4:.3);e.thirst-=dt*(e.isPlayer?.55:.4);
 if(e.hunger<0){e.hunger=0;e.hp-=dt*1.5;}if(e.thirst<0){e.thirst=0;e.hp-=dt*2.5;}
 const out=Math.hypot(e.x,e.z)>zoneR;if(out)e.hp-=dt*8;if(e.isPlayer&&!simMode)$('danger').style.opacity=out?1:0;
 if(e.hunger>50&&e.thirst>50)e.hp=Math.min(e.maxhp,e.hp+dt*(e.hiding&&e.speed<.5?2:.6));
 if(e.hp<=0)return kill(e,out?'the firestorm':e.hunger<=0||e.thirst<=0?'starvation & thirst':null);
 e.speed=0;
 if(e.isPlayer){let mx=(keys.KeyD?1:0)-(keys.KeyA?1:0)+moveX,mz=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)+moveY;
  if(keys.ArrowLeft)yaw+=dt*2;if(keys.ArrowRight)yaw-=dt*2;const l=Math.hypot(mx,mz);if(l>1){mx/=l;mz/=l;}
  e.dir=yaw+Math.PI;const fx=Math.sin(e.dir),fz=Math.cos(e.dir),rx=-fz,rz=fx;
  if(l>.05)move(e,fx*mz+rx*mx,fz*mz+rz*mx,dt);if(atkHeld)attack(e);}
 else{e.think-=dt;if(e.think<=0){const dp=player&&!player.ghost?Math.hypot(e.x-player.x,e.z-player.z):0;e.think=(dp<60?rnd(.25,.4):dp<140?rnd(.5,.7):rnd(.9,1.2));aiThink(e);}aiAct(e,dt);}
 if(e.speed>3.6)e.noise=Math.max(e.noise,15);else if(e.speed>.4)e.noise=Math.max(e.noise,6);
 const gy=Math.max(H(e.x,e.z),WL-.9);e.vy-=18*dt;e.y+=e.vy*dt;if(e.y<=gy){e.y=gy;e.vy=0;}
 e.fig.position.set(e.x,e.y,e.z);e.fig.rotation.y=e.dir;}
let frameNo=0;
function animateFig(e,dt){const f=e.fig,u=f.userData;
 if(!e.alive){if(f.parent)u.mixer.update(dt);return;}
 const dist=player?Math.hypot(e.x-player.x,e.z-player.z):0;f.visible=(e.isPlayer?(camMode==='third'||!e.alive):dist<QL.fog);
 if(e.tag)e.tag.visible=!e.isPlayer&&dist<22&&f.visible;
 if(!f.visible&&!e.isPlayer)return;
 if(u.oneShot>0){u.oneShot-=dt;if(u.oneShot<=0){u.oneShot=0;endOneShot(f);}}
 const s=e.speed;if(s<.4)setAnim(f,'idle');else if(s<3.6)setAnim(f,'walk',Math.max(.6,s/2.2));else setAnim(f,'run',s/5);
 u.acc+=dt;const every=dist>60?3:dist>30?2:1;if(e.isPlayer||frameNo%every===0){u.mixer.update(u.acc);u.acc=0;}
 const fl=e.flash>0;for(const m of u.mats)m.emissive.setRGB(fl?.6:0,0,0);}
const STORM_SPEED=(R-STORM_MIN)/STORM_DUR;
function stormR(t){return THREE.MathUtils.clamp(R-(t-STORM_START)*STORM_SPEED,STORM_MIN,R);}
function stepWorld(dt){time+=dt;zoneR=stormR(time);if(Math.abs(time-STORM_START)<dt*.6)announce('The firestorm is closing in!');for(const e of ents)updateEnt(e,dt);}

// ---------- minimap ----------
const mm=$('minimap'),mx=mm.getContext('2d'),MS=240,mk=MS/2/(R+8);
const mmBg=document.createElement('canvas');mmBg.width=mmBg.height=MS;
{const g=mmBg.getContext('2d'),img=g.createImageData(MS,MS);for(let py=0;py<MS;py++)for(let px=0;px<MS;px++){const x=(px-MS/2)/mk,z=(py-MS/2)/mk,i=(py*MS+px)*4;if(Math.hypot(x,z)>R){img.data[i+3]=0;continue;}
  const h=H(x,z),w=zoneW(x,z);let c=h<WL?[50,110,190]:w.high>.5?[130,125,115]:w.forest>.5?[30,80,35]:w.meadow>.5?[140,170,80]:w.ruins>.5?[180,160,120]:[70,120,55];img.data.set([...c,230],i);}
 g.putImageData(img,0,0);}
let mmT=0;
function drawMinimap(){const c=MS/2;mx.clearRect(0,0,MS,MS);mx.drawImage(mmBg,0,0);
 mx.strokeStyle='#ff5522';mx.lineWidth=4;mx.beginPath();mx.arc(c,c,zoneR*mk,0,7);mx.stroke();
 mx.fillStyle='#ffd24a';mx.beginPath();mx.arc(c,c,6,0,7);mx.fill();
 mx.fillStyle='#ddd';mx.fillRect(c+RUINS.x*mk-4,c+RUINS.z*mk-4,8,8);
 for(const [x,z] of CACHES){mx.fillStyle='#c8964a';mx.fillRect(c+x*mk-3,c+z*mk-3,6,6);}
 if(player){const px=c+player.x*mk,pz=c+player.z*mk,d=player.dir;mx.save();mx.translate(px,pz);mx.rotate(-d+Math.PI);mx.fillStyle='#fff';mx.strokeStyle='#000';mx.lineWidth=2;mx.beginPath();mx.moveTo(0,-11);mx.lineTo(7,8);mx.lineTo(0,4);mx.lineTo(-7,8);mx.closePath();mx.fill();mx.stroke();mx.restore();}
 mx.fillStyle='#fff';mx.font='bold 22px system-ui';mx.textAlign='center';mx.fillText('N',c,22);}

// ---------- loop ----------
const clock=new THREE.Clock(),skyDay=new THREE.Color(0xb8d0e0),skyDusk=new THREE.Color(0xd09070),skyNight=new THREE.Color(0x0a1022),fogC=new THREE.Color(),sunV=new THREE.Vector3();
let hudT=0,fpsLog=[],fpsT=0,fpsN=0,fpsNow=0;
const envMats=[];scene.traverse(o=>{if(o.material&&o.material.isMeshStandardMaterial)envMats.push([o.material,o.material.envMapIntensity]);});
let lastEnv=-1;function envScale(k){if(Math.abs(k-lastEnv)<.03)return;lastEnv=k;for(const[m,b]of envMats)m.envMapIntensity=b*k;}
function updateSky(){const p=(time/dayLen)%1,a=p*Math.PI*2+.8,elev=Math.sin(a);
 sunV.set(Math.cos(a)*.8,elev,.45).normalize();su.sunPosition.value.copy(sunV);
 const day=sstep(-.12,.35,elev);fogC.copy(skyNight).lerp(skyDusk,sstep(-.15,.05,elev)).lerp(skyDay,sstep(.05,.35,elev));scene.fog.color.copy(fogC);
 const moon=elev<0,L=moon?sunV.clone().negate():sunV;sun.intensity=moon?.35:2.6*day;sun.color.setHex(moon?0x8aa4ff:0xfff0d8);hemi.intensity=.12+.55*day;
 renderer.toneMappingExposure=.35+.6*day;envScale(.15+.85*day);
 const c=player||{x:0,z:0,y:0};sun.position.set(c.x+L.x*80,c.y+Math.max(.15,L.y)*80,c.z+L.z*80);sun.target.position.set(c.x,c.y,c.z);
 if(water.material.uniforms&&water.material.uniforms.sunDirection)water.material.uniforms.sunDirection.value.copy(L);}
function loop(){requestAnimationFrame(loop);const dt=Math.min(clock.getDelta(),.05);frameNo++;
 if(renderer.domElement.style.display==='none'||simMode)return;
 if(running){applyLook(dt);stepWorld(dt);}
 zoneMesh.scale.set(zoneR,1,zoneR);
 for(const e of ents)animateFig(e,dt);
 updateSky();grassU.time.value+=dt;
 if(water.material.uniforms&&water.material.uniforms.time)water.material.uniforms.time.value+=dt*.5;else if(simpleWaterMat){wnorm.offset.x+=dt*.01;wnorm.offset.y+=dt*.006;}
 zoneMesh.material.opacity=.22+.08*Math.sin(time*3);
 if(player){updateChunks(player.x,player.z);const hy=player.y+1.62*(CHARS[sel].scale||1);
  if(camMode==='first'&&player.alive){camera.position.set(player.x,hy,player.z);camera.rotation.set(pitch,yaw,0,'YXZ');}
  else{const back=4.2,cx=player.x+Math.sin(yaw)*back*Math.cos(pitch),cz=player.z+Math.cos(yaw)*back*Math.cos(pitch),cy=hy+.5-Math.sin(pitch)*back;camera.position.set(cx,Math.max(H(cx,cz)+.4,cy),cz);camera.lookAt(player.x,hy+.1,player.z);
   if(!player.alive){camera.position.y+=1.5;camera.lookAt(player.x,player.y,player.z);}}
  const sw=player.swing>0?Math.sin((1-player.swing/.3)*Math.PI):0;fpArms.rotation.x=.1-sw*.9;fpArms.position.z=-.5-sw*.15;
  fpArms.position.y=-.3+(player.speed>.5?Math.sin(time*11)*.012:0);}
 hudT-=dt;if(hudT<=0&&player){hudT=.2;$('hp').style.width=Math.max(0,player.hp/player.maxhp*100)+'%';$('hu').style.width=player.hunger+'%';$('th').style.width=player.thirst+'%';
  $('weap').textContent='Weapon: '+WEAPONS[player.weapon].n;$('dayl').textContent=`Day ${Math.floor(time/dayLen)+1} · ${isNight()?'Night 🌙':'Day ☀'} · ${Math.round(fpsNow)} fps`;
  $('zonename').textContent=zoneName(player.x,player.z);drawMinimap();
  let near=items.some(it=>Math.hypot(it.x-player.x,it.z-player.z)<2.6);$('hint').textContent=running&&near?(isTouch?'Tap GRAB to pick up':'Press E to pick up'):running&&nearWater(player)?(isTouch?'Tap GRAB to drink':'Press E to drink'):(!isTouch&&running&&document.pointerLockElement!==cv?'Click to lock mouse':'');}
 for(const it of items)if(it.type in WEAPONS)it.m.rotation.y+=dt*.8;
 if(composer)composer.render();else renderer.render(scene,camera);
 fpsN++;const nowT=performance.now()/1000;if(!fpsT)fpsT=nowT;if(nowT-fpsT>=2){fpsNow=fpsN/(nowT-fpsT);fpsLog.push(fpsNow);fpsT=nowT;fpsN=0;
  if(running&&qSetting==='auto'&&fpsNow<28&&pixelRatio>.7){pixelRatio=Math.max(.7,pixelRatio-.2);renderer.setPixelRatio(pixelRatio);composer=null;}
  else if(running&&qSetting==='auto'&&fpsNow>55&&pixelRatio<Math.min(devicePixelRatio,QL.pr)){pixelRatio=Math.min(Math.min(devicePixelRatio,QL.pr),pixelRatio+.1);renderer.setPixelRatio(pixelRatio);}}}
loop();

// ---------- headless sim harness ----------
function runSim(maxSec=1200,dt=.1){startGame({sim:true});const stuckLog={};let t0=performance.now();const samples=[];
 while(running&&time<maxSec){stepWorld(dt);if(Math.floor(time)%60===0&&Math.abs(time-Math.round(time))<dt/2)samples.push({t:Math.round(time),alive:alive().length,zoneR:Math.round(zoneR),states:alive().reduce((a,e)=>(a[e.state]=(a[e.state]||0)+1,a),{})});}
 for(const e of ents)if(!e.isPlayer)stuckLog[e.name]=e.stuck||0;
 const r={simSeconds:Math.round(time),wallMs:Math.round(performance.now()-t0),winner:winner?`${winner.name} D${winner.d} (${winner.pers}, ${winner.kills} kills)`:null,aliveAtEnd:alive().length,deaths,samples,stuckEvents:stuckLog};
 simMode=false;running=false;ents.forEach(e=>scene.remove(e.fig));ents=[];return r;}
window.__game={setMove:(x,y)=>{moveX=x;moveY=y;},camDirs:()=>{const f=new THREE.Vector3();camera.getWorldDirection(f);f.y=0;f.normalize();return {f:[f.x,f.z],r:[-f.z,f.x]};},
 tp:(x,z,yw)=>{player.x=x;player.z=z;if(yw!==undefined)yaw=yw;},get player(){return player},get ents(){return ents},setCam:m=>{camMode=m;setCam();},get fps(){return fpsLog},quality:qName,get pr(){return pixelRatio},swing:()=>{player.swing=.3;},
 dbgWeap:()=>{const u=player.fig.userData;if(!u.weap)return 'none';player.fig.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(u.weap),ws=new THREE.Vector3();u.hand.getWorldScale(ws);return JSON.stringify({min:b.min.toArray().map(v=>v.toFixed(2)),max:b.max.toArray().map(v=>v.toFixed(2)),p:[player.x.toFixed(1),player.y.toFixed(2),player.z.toFixed(1)],ws:ws.toArray()});},runSim,setTime:t=>{time=t;},sel:i=>{sel=i;},chunks:()=>chunks.filter(c=>c.m.visible).length+'/'+chunks.length,counts:{obstacles:obstacles.length,shore:SHORE.length}};
