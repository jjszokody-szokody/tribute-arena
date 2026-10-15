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
const PALETTES=[
 {n:'Crimson',c:0xa01818},{n:'Forest',c:0x2d6a3a},{n:'Ocean',c:0x2a5f8a},{n:'Sand',c:0xc4a46a},{n:'Night',c:0x2a2a3a}
];
const CHARS=[
 {name:'Kestrel Vane',skin:0xf1c9a5,d:1,c:0xd4af37,hp:105,spd:1.0,str:1.05,stl:0.45,desc:'Career with a golden spear',model:'Knight_Golden_Female',scale:1.0,weapon:'spear',acc:'cape',accC:0xa01818,hair:0x2a1a0a},
 {name:'Brakk Holloway',skin:0xc68642,d:2,c:0x8a8f99,hp:140,spd:0.85,str:1.4,stl:0.2,desc:'Hulking brute, battle axe',model:'Viking_Male',scale:1.14,weapon:'axe',acc:'none',hair:0x3a2a1a},
 {name:'Lyra Quill',skin:0xe0ac69,d:4,c:0x9b59b6,hp:90,spd:1.15,str:0.95,stl:0.7,desc:'Career archer',model:'Elf',scale:0.98,weapon:'bow',acc:'quiver',accC:0x4a3050,hair:0xc9a227},
 {name:'Rook Iron',skin:0x8d5524,d:3,c:0x2e86c1,hp:120,spd:0.95,str:1.25,stl:0.35,desc:'Shield wall fighter',model:'Soldier_Female',scale:1.02,weapon:'sword',acc:'sash',accC:0x2e86c1,hair:0x1a1a1a},
 {name:'Wren Ashby',skin:0xe0ac69,d:7,c:0x4c8a3a,hp:95,spd:1.1,str:1.15,stl:0.55,desc:'Lumberjack, mace & pack',model:'Worker_Male',scale:1.02,weapon:'mace',acc:'backpack',accC:0x5a3d22,hair:0x4a3020},
 {name:'Juniper Lark',skin:0x8d5524,d:11,c:0xc96b2c,hp:85,spd:1.25,str:0.85,stl:0.85,desc:'Orchard runner, throwing knives',model:'Cowboy_Female',scale:0.93,weapon:'throwknife',acc:'quiver',accC:0x6b4a2b,hair:0x3a2010},
 {name:'Moss Tiller',skin:0xffdbac,d:9,c:0xe8d27a,hp:110,spd:1.0,str:1.0,stl:0.5,desc:'Farmer with a pitch-spear',model:'Cowboy_Male',scale:1.05,weapon:'spear',acc:'bedroll',accC:0x3d6b8a,hair:0x5a4030},
 {name:'Shade Corrin',skin:0xa86f45,d:12,c:0x6a6a90,hp:80,spd:1.2,str:0.9,stl:1.0,desc:'Silent ninja, knife',model:'Ninja_Male',scale:0.96,weapon:'knife',acc:'none',hair:0x111111},
 {name:'Coral Voss',skin:0xf1c9a5,d:4,c:0x16a085,hp:95,spd:1.05,str:1.1,stl:0.5,desc:'Harbor fighter, trident',model:'Pirate_Female',scale:0.97,weapon:'trident',acc:'sash',accC:0x16a085,hair:0x8a2030},
 {name:'Ashen Pike',skin:0xc68642,d:6,c:0xe67e22,hp:100,spd:1.05,str:1.0,stl:0.6,desc:'Slinger from the dunes',model:'Casual_Male',scale:1.0,weapon:'sling',acc:'backpack',accC:0x8a6030,hair:0x3a2a1a},
 {name:'Hana Mist',skin:0xffdbac,d:8,c:0xc0392b,hp:88,spd:1.18,str:0.88,stl:0.75,desc:'Blade dancer',model:'Kimono_Male',scale:0.95,weapon:'sword',acc:'sash',accC:0xc0392b,hair:0x1a1a1a},
 {name:'Nyx Ember',skin:0x5c3a21,d:5,c:0x7f8c8d,hp:92,spd:1.1,str:0.95,stl:0.9,desc:'Witch of the woods, knife',model:'Witch',scale:0.94,weapon:'knife',acc:'cape',accC:0x3a1a4a,hair:0x111111}
];
let custom={name:'',palette:0,accOn:true};
const AI_MODELS=['Knight_Golden_Female','Viking_Male','Worker_Male','Cowboy_Female','Cowboy_Male','Ninja_Male','Pirate_Female','Casual_Male','Soldier_Female','Kimono_Male','Elf','Casual3_Female','Witch'];
const FIRST=['Ash','Briar','Cole','Dara','Ember','Fen','Gale','Hollis','Ivy','Jory','Kit','Lumen','Marr','Nell','Orin','Pike','Quill','Rook','Sable','Tamsin','Ula','Vesper','Wynn','Yarrow'];
const DCOL=[0,0xd4af37,0x8a8f99,0x9b59b6,0x2e86c1,0x16a085,0xe67e22,0x4c8a3a,0xc0392b,0xe8d27a,0x7f8c8d,0xc96b2c,0x6a6a90];
let sel=0;

// ---------- models ----------
const MODELS={};
const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);
const needed=[...new Set([...AI_MODELS,...CHARS.map(c=>c.model),'Wolf','Deer','Boar'])];
const loadP=Promise.all(needed.map(n=>new Promise((res,rej)=>loader.load('assets/models/'+n+'.glb',g=>{g.scene.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(g.scene,['Wolf','Deer','Boar'].includes(n));g.h=b.max.y-b.min.y;MODELS[n]=g;res();},undefined,rej))));
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
 if(t==='knife'||t==='throwknife'||t==='spknife'){const b=new THREE.Mesh(new THREE.BoxGeometry(.04,.02,.32),t==='spknife'?new THREE.MeshStandardMaterial({color:0xe8eef8,metalness:1,roughness:.15}):metal);b.position.z=.22;const h=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.14,6),t==='spknife'?new THREE.MeshStandardMaterial({color:0xc9a227,roughness:.4}):leather);h.rotation.x=Math.PI/2;g.add(b,h);if(t==='throwknife'){const b2=b.clone();b2.position.x=.06;b2.rotation.y=.3;g.add(b2);}}
 if(t==='spear'||t==='throwspear'){const s=new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,2,6),wood);s.rotation.x=Math.PI/2;s.position.z=.4;const tip=new THREE.Mesh(new THREE.ConeGeometry(.05,.25,6),metal);tip.rotation.x=Math.PI/2;tip.position.z=1.5;g.add(s,tip);}
 if(t==='axe'){const s=new THREE.Mesh(new THREE.CylinderGeometry(.025,.03,.75,6),wood);s.rotation.x=Math.PI/2;s.position.z=.25;const hd=new THREE.Mesh(new THREE.BoxGeometry(.03,.2,.16),metal);hd.position.set(0,.09,.55);g.add(s,hd);}
 if(t==='sword'){const bl=new THREE.Mesh(new THREE.BoxGeometry(.04,.015,.7),metal);bl.position.z=.4;const gd=new THREE.Mesh(new THREE.BoxGeometry(.18,.03,.04),metal);gd.position.z=.08;const h=new THREE.Mesh(new THREE.CylinderGeometry(.03,.035,.16,8),leather);h.rotation.x=Math.PI/2;h.position.z=-.02;g.add(bl,gd,h);}
 if(t==='mace'){const s=new THREE.Mesh(new THREE.CylinderGeometry(.03,.035,.7,6),wood);s.rotation.x=Math.PI/2;s.position.z=.3;const hd=new THREE.Mesh(new THREE.DodecahedronGeometry(.12,0),metal);hd.position.z=.7;g.add(s,hd);}
 if(t==='trident'){const s=new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,1.7,6),wood);s.rotation.x=Math.PI/2;s.position.z=.35;for(const ox of [-.08,0,.08]){const pr=new THREE.Mesh(new THREE.ConeGeometry(.035,.28,5),metal);pr.rotation.x=Math.PI/2;pr.position.set(ox,0,1.35);}const tips=[-.08,0,.08].map(ox=>{const pr=new THREE.Mesh(new THREE.ConeGeometry(.035,.28,5),metal);pr.rotation.x=Math.PI/2;pr.position.set(ox,0,1.35);return pr;});g.add(s,...tips);}
 if(t==='bow'){const limb=new THREE.Mesh(new THREE.TorusGeometry(.55,.025,6,16,Math.PI),wood);limb.rotation.y=Math.PI/2;limb.rotation.z=Math.PI/2;const str=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,1.05,4),new THREE.MeshBasicMaterial({color:0xddd}));str.rotation.x=Math.PI/2;g.add(limb,str);}
 if(t==='sling'){const p=new THREE.Mesh(new THREE.SphereGeometry(.05,6,5),leather);p.position.z=.2;const c1=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.45,4),leather);c1.rotation.x=Math.PI/2;c1.position.set(.05,0,.0);const c2=c1.clone();c2.position.x=-.05;g.add(p,c1,c2);}
 if(t==='shield'){const sh=new THREE.Mesh(new THREE.CylinderGeometry(.38,.38,.06,12),wood);sh.rotation.x=Math.PI/2;const boss=new THREE.Mesh(new THREE.SphereGeometry(.08,8,6),metal);boss.position.z=.05;g.add(sh,boss);}
 g.traverse(o=>{if(o.isMesh)o.castShadow=true;});return g;}
const crateMat=new THREE.MeshStandardMaterial({color:0x8b6a3e,roughness:.85}),bushMat=new THREE.MeshStandardMaterial({color:0x2f5f28,roughness:.9,flatShading:true}),berryMat=new THREE.MeshStandardMaterial({color:0xb5123f,roughness:.3}),bottleMat=new THREE.MeshStandardMaterial({color:0x7fc8ff,roughness:.05,metalness:.1,transparent:true,opacity:.75});
const WEAPONS={
 fists:{n:'Fists',dmg:8,rng:1.9,cd:.45,melee:1},
 knife:{n:'Knife',dmg:18,rng:2.2,cd:.4,melee:1},
 sword:{n:'Sword',dmg:26,rng:2.5,cd:.55,melee:1},
 spear:{n:'Spear',dmg:28,rng:3.3,cd:.75,melee:1},
 axe:{n:'Axe',dmg:34,rng:2.4,cd:.9,melee:1},
 mace:{n:'Mace',dmg:32,rng:2.3,cd:.85,melee:1},
 trident:{n:'Trident',dmg:30,rng:3.5,cd:.8,melee:1},
 bow:{n:'Bow',dmg:22,rng:28,cd:.7,ranged:1,ammo:'arrow',ammoN:8,speed:42,noise:8},
 sling:{n:'Sling',dmg:14,rng:18,cd:.55,ranged:1,ammo:'stone',ammoN:12,speed:32,noise:5},
 throwknife:{n:'Throwing knives',dmg:16,rng:14,cd:.45,ranged:1,thrown:1,ammoN:5,speed:28,noise:6,fallback:'knife'},
 throwspear:{n:'Javelin',dmg:30,rng:16,cd:.9,ranged:1,thrown:1,ammoN:3,speed:30,noise:10,fallback:'spear'},
 shield:{n:'Shield',dmg:10,rng:1.8,cd:.6,melee:1,block:1},
 spknife:{n:'Sponsor knife',dmg:24,rng:2.3,cd:.35,melee:1}
};
const WI=Object.keys(WEAPONS);
function itemMesh(t){const g=new THREE.Group();
 if(t in WEAPONS){const w=weaponMesh(t);w.position.y=.06;g.add(w);return g;}
 if(t==='food'){const c=new THREE.Mesh(new THREE.BoxGeometry(.6,.4,.45),crateMat);c.position.y=.2;c.castShadow=true;g.add(c);}
 if(t==='water'){const c=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,.4,10),bottleMat);c.position.y=.2;const cap=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.06,8),leather);cap.position.y=.43;g.add(c,cap);}
 if(t==='berries'){const b=new THREE.Mesh(new THREE.IcosahedronGeometry(.55,1),bushMat);b.position.y=.4;b.scale.y=.8;b.castShadow=true;g.add(b);const bg=new THREE.SphereGeometry(.06,6,4);for(let i=0;i<9;i++){const s=new THREE.Mesh(bg,berryMat);const a=rnd(0,6.28),e=rnd(-.2,.9);s.position.set(Math.cos(a)*.5*Math.cos(e),.4+Math.sin(e)*.42,Math.sin(a)*.5*Math.cos(e));g.add(s);}}
  if(t==='sticks'){for(let i=0;i<3;i++){const st=new THREE.Mesh(new THREE.CylinderGeometry(.03,.04,.9,5),logMat);st.rotation.z=Math.PI/2;st.rotation.y=i*.7;st.position.y=.05+i*.04;st.castShadow=true;g.add(st);}}
  if(t==='meat'){const mm=new THREE.Mesh(new THREE.SphereGeometry(.2,8,6),meatMat);mm.scale.set(1.3,.6,1);mm.position.y=.13;mm.castShadow=true;const bone=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.5,6),boneMat);bone.rotation.z=Math.PI/2;bone.position.y=.14;g.add(mm,bone);}
 if(t==='medicine'){const box=new THREE.Mesh(new THREE.BoxGeometry(.28,.18,.2),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.5}));box.position.y=.12;const cross=new THREE.Mesh(new THREE.BoxGeometry(.12,.04,.04),new THREE.MeshStandardMaterial({color:0xcc2222}));cross.position.y=.22;g.add(box,cross);}
 if(t==='bandage'){const r=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,.22,8),new THREE.MeshStandardMaterial({color:0xf5f0e6,roughness:.8}));r.rotation.z=Math.PI/2;r.position.y=.1;g.add(r);}
 if(t==='ammo_arrow'){for(let i=0;i<3;i++){const a=new THREE.Mesh(new THREE.CylinderGeometry(.01,.01,.45,4),wood);a.rotation.x=Math.PI/2;a.position.set(i*.04,.12,0);g.add(a);}}
 if(t==='ammo_stone'){for(let i=0;i<4;i++){const s=new THREE.Mesh(new THREE.SphereGeometry(.05,5,4),new THREE.MeshStandardMaterial({color:0x888}));s.position.set((i%2)*.08,.08+(i>1)*.06,(i>>1)*.08);g.add(s);}}
 if(t==='cloak'){const c=new THREE.Mesh(new THREE.BoxGeometry(.5,.55,.12),new THREE.MeshStandardMaterial({color:0x3a4a6a,roughness:.9}));c.position.y=.3;g.add(c);}
 if(t==='flask'){const c=new THREE.Mesh(new THREE.CylinderGeometry(.09,.11,.35,10),new THREE.MeshStandardMaterial({color:0x4a7a9a,metalness:.4,roughness:.3}));c.position.y=.2;g.add(c);}
 return g;}
const meatMat=new THREE.MeshStandardMaterial({color:0xa8323a,roughness:.55}),boneMat=new THREE.MeshStandardMaterial({color:0xeee6d0,roughness:.6});

// ---------- select screen: thumbnails + rotating preview ----------
const pc=$('preview'),pr=new THREE.WebGLRenderer({canvas:pc,antialias:true,alpha:true,preserveDrawingBuffer:true});pr.toneMapping=THREE.ACESFilmicToneMapping;pr.toneMappingExposure=1.5;
const ps=new THREE.Scene(),pcam=new THREE.PerspectiveCamera(30,1,.1,50);pcam.position.set(0,1.2,4.8);pcam.lookAt(0,.95,0);
ps.add(new THREE.HemisphereLight(0xffffff,0x554433,1.6));const pd=new THREE.DirectionalLight(0xfff0dd,2.2);pd.position.set(2,4,3);ps.add(pd);const pd2=new THREE.DirectionalLight(0x88aaff,1);pd2.position.set(-3,2,-2);ps.add(pd2);
let pfig=null;const pclock=new THREE.Clock(),thumbs=[];
function charFig(c){const f=makeFigure(charLook(c));giveWeaponMesh(f,c.weapon);return f;}
function setPreview(){if(!MODELS[CHARS[0].model])return;if(pfig)ps.remove(pfig);pfig=charFig(CHARS[sel]);ps.add(pfig);sleeveMat.color.setHex((PALETTES[custom.palette]||PALETTES[0]).c);}
function makeThumbs(){pr.setSize(160,180,false);pcam.aspect=160/180;pcam.position.set(0,1.05,3.3);pcam.lookAt(0,.95,0);pcam.updateProjectionMatrix();
 CHARS.forEach((c,i)=>{const f=charFig(c);f.rotation.y=.5;ps.add(f);f.userData.mixer.update(.4);pr.render(ps,pcam);thumbs[i]=pc.toDataURL('image/png');ps.remove(f);});pcam.position.set(0,1.2,4.8);pcam.lookAt(0,.95,0);renderChars();}
function renderChars(){
 $('chars').innerHTML=CHARS.map((c,i)=>`<div class="ch ${i==sel?'sel':''}" data-i="${i}">${thumbs[i]?`<img src="${thumbs[i]}" alt="">`:''}<b style="color:#${c.c.toString(16).padStart(6,'0')}">${c.name}</b>D${c.d} · ${WEAPONS[c.weapon]?WEAPONS[c.weapon].n:''}<div style="opacity:.75;font-size:10px">${c.desc}</div>
 ${[['HP',c.hp/140,'#e33'],['SPD',c.spd/1.25,'#3c9'],['STR',c.str/1.4,'#e93'],['STL',c.stl,'#99f']].map(s=>`<div style="display:flex;gap:4px;align-items:center;font-size:10px"><span style="width:26px">${s[0]}</span><div class="bar" style="flex:1"><i style="width:${s[1]*100}%;background:${s[2]}"></i></div></div>`).join('')}</div>`).join('');
 document.querySelectorAll('.ch').forEach(e=>e.onclick=()=>{sel=+e.dataset.i;if(!$('cName').value)custom.name='';renderChars();setPreview();});}
function renderPals(){const row=$('palRow');if(!row)return;row.innerHTML=PALETTES.map((p,i)=>`<button type="button" data-p="${i}" style="width:28px;height:28px;border-radius:50%;border:2px solid ${i===custom.palette?'#f5b942':'#666'};background:#${p.c.toString(16).padStart(6,'0')};margin:0 3px;cursor:pointer" title="${p.n}"></button>`).join('');
 row.querySelectorAll('button').forEach(b=>b.onclick=()=>{custom.palette=+b.dataset.p;renderPals();setPreview();makeThumbs();});}
function wireCustomize(){const n=$('cName'),a=$('cAcc');if(!n)return;
 n.oninput=()=>{custom.name=n.value;};
 if(a)a.onchange=()=>{custom.accOn=a.checked;setPreview();makeThumbs();};
 renderPals();}
renderChars();wireCustomize();
function previewLoop(){requestAnimationFrame(previewLoop);if($('select').classList.contains('hidden')||!pfig)return;const w=pc.clientWidth,h=pc.clientHeight;if(pc.width!==w||pc.height!==h){pr.setSize(w,h,false);pcam.aspect=w/h;pcam.updateProjectionMatrix();}const dt=pclock.getDelta();pfig.rotation.y+=dt*.7;pfig.userData.mixer.update(dt);pr.render(ps,pcam);}previewLoop();

// ---------- audio ----------
let ac=null;function audio(){if(!ac)try{ac=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}if(ac&&ac.state==='suspended')ac.resume();}
function tone(f,dur,type='sine',vol=.3,slide=0){if(!ac)return;const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.value=f;if(slide)o.frequency.exponentialRampToValueAtTime(slide,ac.currentTime+dur);g.gain.setValueAtTime(vol,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+dur);o.connect(g).connect(ac.destination);o.start();o.stop(ac.currentTime+dur);}
function cannon(){if(!ac)return;tone(90,1.2,'sine',.8,30);const n=ac.createBufferSource(),b=ac.createBuffer(1,ac.sampleRate*.6,ac.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,3);n.buffer=b;const g=ac.createGain();g.gain.value=.5;const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=400;n.connect(f).connect(g).connect(ac.destination);n.start();}
// Capitol-style night anthem (original procedural WebAudio — not any copyrighted soundtrack)
let wasNight=false,anthemOn=false,anthemNodes=[],reelTimer=null,reelIdx=0;
function stopAnthem(){for(const n of anthemNodes){try{n.stop?.();n.disconnect?.();}catch(e){}}anthemNodes=[];anthemOn=false;hideDeathReel();}
function hideDeathReel(){clearTimeout(reelTimer);reelTimer=null;const el=$('nightReel');if(el){el.classList.remove('on');setTimeout(()=>el.classList.add('hidden'),1200);}}
function showDeathReel(){const el=$('nightReel');if(!el||simMode)return;const list=deaths.slice();el.classList.remove('hidden');requestAnimationFrame(()=>el.classList.add('on'));
 reelIdx=0;const tick=()=>{if(!list.length){$('reelName').textContent='No fallen yet';$('reelDist').textContent='';$('reelZone').textContent='The arena waits';}
  else{const d=list[reelIdx%list.length];$('reelName').textContent=d.name;$('reelDist').textContent=`District ${d.d}`;$('reelZone').textContent=d.zone||'';reelIdx++;}
  reelTimer=setTimeout(tick,list.length?2200:4000);};
 tick();setTimeout(hideDeathReel,22000);}
function note(freq,t0,dur,type,vol,filt){if(!ac)return;const o=ac.createOscillator(),g=ac.createGain(),f=ac.createBiquadFilter();
 o.type=type||'sawtooth';o.frequency.value=freq;f.type='lowpass';f.frequency.value=filt||1800;f.Q.value=0.7;
 g.gain.setValueAtTime(0.0001,t0);g.gain.exponentialRampToValueAtTime(vol,t0+.08);g.gain.exponentialRampToValueAtTime(vol*.55,t0+dur*.55);g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
 o.connect(f);f.connect(g);g.connect(ac.destination);o.start(t0);o.stop(t0+dur+.05);anthemNodes.push(o,g,f);}
function pad(freqs,t0,dur,vol){for(const fq of freqs){note(fq,t0,dur,'sine',vol*.45,900);note(fq*1.002,t0,dur,'triangle',vol*.25,700);}}
function playAnthem(fromNet){if(simMode)return;if(anthemOn)return;audio();anthemOn=true;showDeathReel();
 if(!ac){setTimeout(()=>{anthemOn=false;},22000);if(NET.role==='host'&&!fromNet)try{netBroadcast({t:'anthem'});}catch(e){}return;}
 try{if(ac.state==='suspended')ac.resume();}catch(e){}
 const t0=ac.currentTime+.05;
 // Solemn D-minor Capitol march (original): brass fanfare + choir pad, ~22s
 const bpm=72,beat=60/bpm;
 const mel=[ // [degree semitone from D3, beats, vol]
  [0,2,.14],[2,1,.12],[3,1,.12],[5,2,.15],[3,1,.11],[2,1,.11],[0,2,.14],
  [7,2,.13],[5,1,.12],[3,1,.12],[5,2,.14],[7,1,.11],[8,1,.11],[7,2,.13],
  [5,2,.14],[3,1,.12],[2,1,.12],[0,2,.15],[2,1,.11],[-2,1,.11],[0,3,.16],
  [12,2,.12],[10,1,.11],[8,1,.11],[7,2,.13],[5,1,.1],[3,1,.1],[0,4,.15]
 ];
 const D3=146.83;
 pad([D3,D3*1.2,D3*1.5],t0,beat*8,.07);
 pad([D3*.75,D3,D3*1.5],t0+beat*8,beat*8,.08);
 pad([D3,D3*1.189,D3*1.498],t0+beat*16,beat*10,.09);
 let t=t0+beat*.5;for(const [semi,beats,vol] of mel){const f=D3*Math.pow(2,semi/12);
  note(f,t,beat*beats*.92,'sawtooth',vol,1400);note(f*.5,t,beat*beats*.92,'triangle',vol*.55,900); // brass octave
  if(beats>=2)note(f*1.5,t+beat*.15,beat*(beats-.2)*.8,'triangle',vol*.22,1100); // soft fifth
  t+=beat*beats;}
 // closing choir swell
 pad([D3,D3*1.2,D3*1.5,D3*2],t0+beat*26,beat*6,.1);
 setTimeout(()=>{anthemOn=false;anthemNodes=[];},24000);
 if(NET.role==='host'&&!fromNet)try{netBroadcast({t:'anthem'});}catch(e){}}
function nightCycle(){const n=isNight();if(n&&!wasNight&&running&&!simMode)playAnthem();wasNight=n;}

// ---------- renderer / scene ----------
let R=220,WL=-.6,arenaId='wilds',arena=null,thirstK=1,coldK=0,hazT=0,hazActive=false;
let LAKE={x:95,z:70,r:30},POND={x:-120,z:-40,r:15},SPRING={x:14,z:17,r:5};
let RIVERS=[{a:[95,70],b:[205,120],w:3.2},{a:[-112,-32],b:[-35,38],w:2.2}];
let CORN={x:0,z:0},RUINS={x:115,z:-75},CAVE={x:-60,z:-170},CACHES=[],ARENA_SEED=20261015;
const ARENAS=[
 {id:'wilds',name:'The Wilds',blurb:'Forest, meadow, highlands & lake — the classic Games.',diff:'Classic',tag:'🌲',
  R:220,WL:-.6,seed:20261015,thirstK:1,coldK:0,muttMul:1,sky:{turb:6,ray:1.6,mie:.005},
  day:0xb8d0e0,dusk:0xd09070,night:0x0a1022,fogFar:1,hemi:0xcfe8ff,hemiG:0x4a5a2a,sunC:0xfff2d0,
  wall:0x66ccff,water:0x1a4a5e,waterS:0x1d5670,treeMul:1,rockMul:1,grassMul:1,berryMul:1,waterItems:1,
  animals:{rabbit:10,deer:6,boar:4,wolf:6,bear:1},animalTint:null,
  LAKE:{x:95,z:70,r:30},POND:{x:-120,z:-40,r:15},SPRING:{x:14,z:17,r:5},
  RIVERS:[{a:[95,70],b:[205,120],w:3.2},{a:[-112,-32],b:[-35,38],w:2.2}],
  RUINS:{x:115,z:-75},CAVE:{x:-60,z:-170},
  CACHES:[[-150,20],[0,165],[40,-175],[115,-75],[60,115],[-135,-70],[165,-20],[-60,120]]},
 {id:'desert',name:'Desert Wastes',blurb:'Dunes, rock mesas & scarce oases. Sandstorms punish the unsheltered.',diff:'Hard',tag:'🏜️',
  R:220,WL:-1.2,seed:20261016,thirstK:1.45,coldK:0,muttMul:1,sky:{turb:10,ray:.9,mie:.02},
  day:0xe8c890,dusk:0xc07040,night:0x1a1020,fogFar:.85,hemi:0xffe2a8,hemiG:0x8a6a3a,sunC:0xffe0a0,
  wall:0xe8b060,water:0x2a6a7a,waterS:0x2d7088,treeMul:.12,rockMul:1.6,grassMul:.08,berryMul:.25,waterItems:.45,
  animals:{rabbit:4,deer:2,boar:2,wolf:3,bear:0},animalTint:null,
  LAKE:{x:110,z:90,r:14},POND:{x:-90,z:-50,r:8},SPRING:{x:18,z:14,r:4},
  RIVERS:[],RUINS:{x:140,z:-40},CAVE:{x:-80,z:-160},
  CACHES:[[-140,40],[20,150],[-30,-160],[140,-40],[70,90],[-100,-80],[160,10],[-50,130],[0,-100]]},
 {id:'tundra',name:'Frozen Tundra',blurb:'Snow, ice & blizzards. Stay near fire or the cold will kill you.',diff:'Hard',tag:'❄️',
  R:210,WL:-.4,seed:20261017,thirstK:.85,coldK:1,muttMul:.8,sky:{turb:3,ray:1.1,mie:.002},
  day:0xc8d8ea,dusk:0xa0b0d0,night:0x081018,fogFar:.9,hemi:0xd8e8ff,hemiG:0x6a7a8a,sunC:0xe8f0ff,
  wall:0xa0c8ff,water:0x8ab0c8,waterS:0x9abcce,treeMul:.45,rockMul:1.1,grassMul:.15,berryMul:.35,waterItems:.7,
  animals:{rabbit:8,deer:5,boar:0,wolf:7,bear:1},animalTint:'arctic',
  LAKE:{x:80,z:60,r:34},POND:{x:-100,z:-30,r:12},SPRING:{x:12,z:16,r:4},
  RIVERS:[{a:[80,60],b:[180,40],w:2.4}],RUINS:{x:100,z:-90},CAVE:{x:-50,z:-155},
  CACHES:[[-130,30],[10,150],[50,-150],[100,-90],[40,100],[-120,-60],[150,-10],[-40,110]]},
 {id:'urban',name:'Urban Ruins',blurb:'Shattered city blocks, alleys & rooftops. Close-quarters and dark nights.',diff:'Brutal',tag:'🏙️',
  R:175,WL:-.8,seed:20261018,thirstK:1.05,coldK:0,muttMul:2.2,sky:{turb:8,ray:1.2,mie:.01},
  day:0x9aa8b0,dusk:0x806050,night:0x05060a,fogFar:.75,hemi:0xb0b8c0,hemiG:0x3a3a3a,sunC:0xd8d0c0,
  wall:0x8899aa,water:0x1a4050,waterS:0x1d4a5c,treeMul:.18,rockMul:.5,grassMul:.25,berryMul:.4,waterItems:1.1,
  animals:{rabbit:3,deer:1,boar:2,wolf:4,bear:0},animalTint:null,
  LAKE:{x:0,z:55,r:12},POND:{x:-70,z:-40,r:7},SPRING:{x:8,z:10,r:3.5},
  RIVERS:[],RUINS:{x:0,z:0},CAVE:{x:-90,z:-100},
  CACHES:[[-90,20],[40,100],[-40,-90],[70,-50],[90,40],[-100,-60],[60,70],[-60,80],[20,-70],[-20,40],[80,-20],[-80,-20]]}
];
arena=ARENAS[0];let hPhase=0,hScale=1,stormJitter=0,hazIntensity=1,worldBuilt=false;
let ground=null,dirtRing=null,water=null,simpleWaterMat=null,wall=null,zoneMesh=null,cornMesh=null,worldExtras=[];
let obstacles=[],SHORE=[],chunks=[],TL=[],PL=[],LL=[],RL=[];
const GC=8,grid=new Map(),CH=100;
const M4=new THREE.Matrix4(),QQ=new THREE.Quaternion(),S3=new THREE.Vector3(),P3=new THREE.Vector3(),E=new THREE.Euler(),col=new THREE.Color();

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
const _realRandom=Math.random;
function segDist(x,z,a,b){const abx=b[0]-a[0],abz=b[1]-a[1];const t=Math.min(1,Math.max(0,((x-a[0])*abx+(z-a[1])*abz)/(abx*abx+abz*abz)));return Math.hypot(x-(a[0]+abx*t),z-(a[1]+abz*t));}
function zoneW(x,z){
 if(arenaId==='desert'){const dune=sstep(30,80,Math.hypot(x*.7+40,z*.9-20));return{forest:0,meadow:dune*.4,high:sstep(-80,-140,z)*.7+sstep(120,170,Math.hypot(x-140,z+40))*.8,ruins:1-sstep(10,22,Math.hypot(x-RUINS.x,z-RUINS.z)),dune};}
 if(arenaId==='tundra'){return{forest:sstep(-40,-100,x)*(1-sstep(-80,-130,z))*.7,meadow:sstep(60,100,z)*.5,high:sstep(-90,-140,z),ruins:1-sstep(12,22,Math.hypot(x-RUINS.x,z-RUINS.z)),ice:sstep(LAKE.r+6,LAKE.r-2,Math.hypot(x-LAKE.x,z-LAKE.z))};}
 if(arenaId==='urban'){const bx=Math.floor((x+R)/28),bz=Math.floor((z+R)/28);const block=((bx*17+bz*31)&3);return{forest:0,meadow:block===0?.2:0,high:0,ruins:block?0.85:0.3,street:((Math.abs(x)%28)<5||(Math.abs(z)%28)<5)?1:0};}
 return{forest:sstep(-70,-110,x)*(1-sstep(-120,-150,z)),meadow:sstep(80,115,z)*(1-sstep(110,150,Math.abs(x))),high:sstep(-100,-145,z),ruins:1-sstep(14,26,Math.hypot(x-RUINS.x,z-RUINS.z))};}
function zoneName(x,z){const r=Math.hypot(x,z);if(r<22)return 'Cornucopia';
 if(arenaId==='desert'){if(Math.hypot(x-LAKE.x,z-LAKE.z)<LAKE.r+6)return 'Oasis';if(Math.hypot(x-POND.x,z-POND.z)<POND.r+5)return 'Wellspring';if(Math.hypot(x-SPRING.x,z-SPRING.z)<8)return 'Well';const w=zoneW(x,z);if(w.ruins>.5)return 'Sand Ruins';if(w.high>.5)return 'Rock Mesa';if(w.dune>.5)return 'Dune Sea';return 'Wastes';}
 if(arenaId==='tundra'){if(Math.hypot(x-LAKE.x,z-LAKE.z)<LAKE.r+6)return 'Frozen Lake';if(Math.hypot(x-POND.x,z-POND.z)<POND.r+5)return 'Ice Pond';const w=zoneW(x,z);if(w.ruins>.5)return 'Frozen Ruins';if(Math.hypot(x-CAVE.x,z-CAVE.z)<25)return 'Ice Caves';if(w.high>.5)return 'Glacial Ridge';if(w.forest>.4)return 'Sparse Pines';return 'Snowfield';}
 if(arenaId==='urban'){if(Math.hypot(x-LAKE.x,z-LAKE.z)<LAKE.r+5)return 'Fountain Plaza';const w=zoneW(x,z);if(w.street>.5)return 'Alley';if(w.ruins>.5)return 'Ruined Block';return 'Rubble';}
 if(Math.hypot(x-LAKE.x,z-LAKE.z)<LAKE.r+8)return 'Lake';if(Math.hypot(x-POND.x,z-POND.z)<POND.r+8)return 'Pond';
 const w=zoneW(x,z);if(w.ruins>.5)return 'Old Ruins';if(Math.hypot(x-CAVE.x,z-CAVE.z)<25)return 'Rock Caves';if(w.high>.5)return 'Rocky Highlands';if(w.forest>.5)return 'Dense Forest';if(w.meadow>.5)return 'Open Meadow';return 'Woodland';}
function H(x,z){const r=Math.hypot(x,z);let h;
 if(arenaId==='desert'){{const X=x*hScale+hPhase,Z=z*hScale+hPhase*1.2;h=1.2+3.5*Math.sin(X*.018)*Math.cos(Z*.02)+2.2*Math.sin(X*.04+1)*Math.sin(Z*.035)+1.1*Math.abs(Math.sin(X*.012)*Math.cos(Z*.015));}
  const w=zoneW(x,z);h=h*(1-.3*w.meadow)+w.high*(9+6*Math.abs(Math.sin(x*.04)*Math.cos(z*.05)));h=h*(1-w.ruins*.5)+w.ruins*1.5;
  h=h*sstep(9,28,r)+.5*(1-sstep(9,28,r));
  let wt=Math.max(sstep(LAKE.r+6,LAKE.r-2,Math.hypot(x-LAKE.x,z-LAKE.z)),sstep(POND.r+5,POND.r-2,Math.hypot(x-POND.x,z-POND.z)),sstep(SPRING.r+3,SPRING.r-1.5,Math.hypot(x-SPRING.x,z-SPRING.z)));
  h=h*(1-wt)-1.6*wt;return h+sstep(R,R+40,r)*22;}
 if(arenaId==='tundra'){{const X=x*hScale+hPhase,Z=z*hScale+hPhase*1.1;h=2.0*Math.sin(X*.028)*Math.cos(Z*.03)+1.1*Math.sin(X*.07)*Math.sin(Z*.06)+.4*Math.sin((X+Z)*.15);}h=h<0?h*.3:h;h+=.6;
  const w=zoneW(x,z);h=h*(1-.4*w.meadow)+w.high*(6+4*Math.abs(Math.sin(x*.04)*Math.cos(z*.045)));h=h*(1-w.ruins*.6)+w.ruins*1.0;
  h=h*sstep(9,28,r)+.35*(1-sstep(9,28,r));
  let wt=Math.max(sstep(LAKE.r+8,LAKE.r-4,Math.hypot(x-LAKE.x,z-LAKE.z)),sstep(POND.r+6,POND.r-3,Math.hypot(x-POND.x,z-POND.z)),sstep(SPRING.r+3,SPRING.r-2,Math.hypot(x-SPRING.x,z-SPRING.z)));
  for(const rv of RIVERS)wt=Math.max(wt,sstep(rv.w*2.3,rv.w*.8,segDist(x,z,rv.a,rv.b)));
  // frozen lake: flat ice near WL instead of deep water
  if(wt>.4&&Math.hypot(x-LAKE.x,z-LAKE.z)<LAKE.r+2)return WL+.08+Math.sin(x*.2)*Math.cos(z*.2)*.04;
  h=h*(1-wt)-1.8*wt;return h+sstep(R,R+40,r)*22;}
 if(arenaId==='urban'){const off=((hPhase*10)|0)%7;const bx=((x+R+off)%28+28)%28,bz=((z+R+off*3)%28+28)%28;const street=bx<5||bx>23||bz<5||bz>23;
  h=street?.35:1.1+((Math.floor((x+R)/28)*13+Math.floor((z+R)/28)*7+(hPhase|0))&3)*.15;
  // plaza fountain dip
  let wt=Math.max(sstep(LAKE.r+5,LAKE.r-2,Math.hypot(x-LAKE.x,z-LAKE.z)),sstep(POND.r+4,POND.r-2,Math.hypot(x-POND.x,z-POND.z)),sstep(SPRING.r+2.5,SPRING.r-1,Math.hypot(x-SPRING.x,z-SPRING.z)));
  h=h*(1-wt)-1.4*wt;h=h*sstep(8,22,r)+.4*(1-sstep(8,22,r));return h+sstep(R,R+30,r)*18;}
 // wilds
 {const X=x*hScale+hPhase,Z=z*hScale+hPhase*1.37;h=2.6*Math.sin(X*.03)*Math.cos(Z*.034)+1.4*Math.sin(X*.075+1.3)*Math.sin(Z*.062+.7)+.5*Math.sin((X+Z)*.18);}
 h=h<0?h*.25:h;h+=.8;const w=zoneW(x,z);
 h=h*(1-.6*w.meadow);h+=w.high*(7+5*Math.abs(Math.sin(x*.045)*Math.cos(z*.05))+2*Math.sin(x*.13+z*.09));
 h=h*(1-w.ruins*.7)+w.ruins*1.2;h=h*sstep(9,30,r)+.4*(1-sstep(9,30,r));
 let wt=Math.max(sstep(LAKE.r+8,LAKE.r-4,Math.hypot(x-LAKE.x,z-LAKE.z)),sstep(POND.r+6,POND.r-3,Math.hypot(x-POND.x,z-POND.z)),sstep(SPRING.r+3,SPRING.r-2,Math.hypot(x-SPRING.x,z-SPRING.z)));
 for(const rv of RIVERS)wt=Math.max(wt,sstep(rv.w*2.3,rv.w*.8,segDist(x,z,rv.a,rv.b)));
 h=h*(1-wt)-2.2*wt;return h+sstep(R,R+40,r)*22;}
function inWater(x,z){if(arenaId==='tundra'&&Math.hypot(x-LAKE.x,z-LAKE.z)<LAKE.r+1)return false;return H(x,z)<WL+.05;}
function onIce(x,z){return arenaId==='tundra'&&Math.hypot(x-LAKE.x,z-LAKE.z)<LAKE.r+1;}
const wnorm=tl.load('assets/tex/waternormals.jpg');wnorm.wrapS=wnorm.wrapT=THREE.RepeatWrapping;
const barkMat=new THREE.MeshStandardMaterial({map:tex('bark_c.jpg',1,true),normalMap:tex('bark_n.jpg',1),roughness:.95});barkMat.map.repeat.set(1,2);barkMat.normalMap.repeat.set(1,2);
const pineGeo=mergeGeometries([[2.3,2.8,2.9],[1.8,2.5,4.3],[1.25,2.2,5.6],[.7,1.6,6.7]].map(([r,h,y])=>{const g=new THREE.ConeGeometry(r,h,8,1);g.translate(0,y,0);return g;}));
const pineMat=new THREE.MeshStandardMaterial({color:0x2c5528,roughness:.9,flatShading:true});
const leafGeo=mergeGeometries([[0,4.6,0,1.9],[1,4,.6,1.3],[-1,4.2,-.4,1.4],[.2,5.4,-.6,1.2],[-.4,3.8,1,1.1]].map(([x,y,z,r])=>{const g=new THREE.IcosahedronGeometry(r,1);g.translate(x,y,z);return g;}));
{const p=leafGeo.attributes.position;for(let i=0;i<p.count;i++){const n=Math.sin(p.getX(i)*3.1+p.getY(i)*2.3)*.12;p.setXYZ(i,p.getX(i)*(1+n),p.getY(i)*(1+n*.5),p.getZ(i)*(1+n));}leafGeo.computeVertexNormals();}
const leafMat=new THREE.MeshStandardMaterial({color:0x4a7a30,roughness:.85,flatShading:true});
const trunkGeo=new THREE.CylinderGeometry(.18,.32,4.2,7);trunkGeo.translate(0,2.1,0);
const rockGeo=new THREE.DodecahedronGeometry(1,1);{const p=rockGeo.attributes.position;for(let i=0;i<p.count;i++){const v=P3.fromBufferAttribute(p,i),n=1+.18*Math.sin(v.x*4+v.y*3)*Math.cos(v.z*5);p.setXYZ(i,v.x*n,v.y*n,v.z*n);}rockGeo.computeVertexNormals();}
const rockMat=new THREE.MeshStandardMaterial({map:tex('rock_c.jpg',1,true),normalMap:tex('rock_n.jpg',1),roughness:.9});
const stoneMat=new THREE.MeshStandardMaterial({normalMap:tex('rock_n.jpg',1),color:0xcbc2ad,roughness:.85});
const grassU={time:{value:0}};
const grassBlade=(()=>{const bl=[];for(let k=0;k<3;k++){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-.035,0,0,.035,0,0,.0,.38,0],3));g.setAttribute('color',new THREE.Float32BufferAttribute([.12,.22,.06,.12,.22,.06,.38,.55,.18],3));g.rotateY(k*2.1);bl.push(g);}const gg=mergeGeometries(bl);gg.computeVertexNormals();return gg;})();
const grassMat=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
grassMat.onBeforeCompile=s=>{s.uniforms.time=grassU.time;s.vertexShader='uniform float time;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n float ph=instanceMatrix[3].x*.35+instanceMatrix[3].z*.27; transformed.x+=sin(time*1.8+ph)*.09*position.y; transformed.z+=cos(time*1.3+ph)*.05*position.y;');};
const groundMat=new THREE.MeshStandardMaterial({map:tex('grass_c.jpg',100,true),normalMap:tex('grass_n.jpg',100),vertexColors:true,roughness:.95,envMapIntensity:.4});
const dirtMat=new THREE.MeshStandardMaterial({map:tex('ground_c.jpg',6,true),normalMap:tex('ground_n.jpg',6),roughness:1,transparent:true,vertexColors:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
function gkey(cx,cz){return cx*10007+cz;}
function buildGrid(){grid.clear();for(const o of obstacles){const r=o.r*(o.b||1);for(let cx=Math.floor((o.x-r)/GC);cx<=Math.floor((o.x+r)/GC);cx++)for(let cz=Math.floor((o.z-r)/GC);cz<=Math.floor((o.z+r)/GC);cz++){const k=gkey(cx,cz);let a=grid.get(k);if(!a)grid.set(k,a=[]);a.push(o);}}}
function obsNear(x,z){return grid.get(gkey(Math.floor(x/GC),Math.floor(z/GC)))||[];}
function chunked(geo,mat,list,opts={}){const by=new Map();for(const it of list){const k=Math.floor(it.x/CH)+','+Math.floor(it.z/CH);if(!by.has(k))by.set(k,[]);by.get(k).push(it);}
 for(const [k,arr] of by){const m=new THREE.InstancedMesh(geo,mat,arr.length);let cx=0,cz=0;arr.forEach((it,i)=>{m.setMatrixAt(i,it.m);if(it.c)m.setColorAt(i,it.c);cx+=it.x;cz+=it.z;});
  m.castShadow=!!opts.shadow;m.receiveShadow=!!opts.recv;m.computeBoundingSphere();scene.add(m);chunks.push({m,x:cx/arr.length,z:cz/arr.length,dist:opts.dist||QL.fog+CH*.7});worldExtras.push(m);}}
function chunkedSmall(geo,mat,list){const C=40,by=new Map();for(const it of list){const k=Math.floor(it.x/C)+','+Math.floor(it.z/C);if(!by.has(k))by.set(k,[]);by.get(k).push(it);}
 for(const [,arr] of by){const m=new THREE.InstancedMesh(geo,mat,arr.length);let cx=0,cz=0;arr.forEach((it,i)=>{m.setMatrixAt(i,it.m);cx+=it.x;cz+=it.z;});m.computeBoundingSphere();scene.add(m);chunks.push({m,x:cx/arr.length,z:cz/arr.length,dist:QL.grassDist+20});worldExtras.push(m);}}
function updateChunks(px,pz){for(const c of chunks)c.m.visible=Math.hypot(c.x-px,c.z-pz)<c.dist;}
function treeDensity(x,z){const r=Math.hypot(x,z);if(r<24)return 0;const w=zoneW(x,z);if(w.ruins>.3||Math.hypot(x-CAVE.x,z-CAVE.z)<18)return 0;if(H(x,z)<WL+.6)return 0;
 const base=.28+w.forest*1.4-w.meadow*.27+w.high*-.1+(r>R?.35:0);return base*(arena.treeMul||1);}
function addRock(x,z,sx,sy,sz,ry=rnd(0,6),y0){const y=y0!==undefined?y0:H(x,z)+sy*.25;RL.push({x,z,m:new THREE.Matrix4().compose(P3.set(x,y,z),QQ.setFromEuler(E.set(rnd(-.3,.3),ry,rnd(-.3,.3))),S3.set(sx,sy,sz))});if(Math.hypot(x,z)<R)obstacles.push({x,z,r:Math.max(sx,sz)*.85,b:sy>1.2?1.3:.6,climb:sy>0.9?1:0,h:Math.max(1.2,sy*1.65)});}
function seedRng(seed){let s=seed|0;Math.random=()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function clearWorldMeshes(){for(const m of worldExtras){scene.remove(m);if(m.geometry&&m.geometry.dispose&&m!==ground)try{m.geometry.dispose();}catch(e){}}worldExtras=[];chunks=[];obstacles=[];SHORE=[];TL.length=0;PL.length=0;LL.length=0;RL.length=0;
 if(ground){scene.remove(ground);ground.geometry.dispose();ground=null;}if(dirtRing){scene.remove(dirtRing);dirtRing.geometry.dispose();dirtRing=null;}
 if(water){scene.remove(water);water=null;}if(wall){scene.remove(wall);wall=null;}if(zoneMesh){scene.remove(zoneMesh);zoneMesh=null;}if(cornMesh){scene.remove(cornMesh);cornMesh=null;}if(cornLight){scene.remove(cornLight);cornLight=null;}cornInside=null;}
function placeLandmarks(A){ // procedural from current seeded RNG
 const ang=()=>rnd(0,6.283),rad=(a,b)=>rnd(a,b);
 const spot=(rmin,rmax,avoid=[])=>{for(let i=0;i<40;i++){const a=ang(),r=rad(rmin,rmax),x=Math.cos(a)*r,z=Math.sin(a)*r;if(avoid.every(o=>Math.hypot(x-o.x,z-o.z)>(o.r||40)))return {x,z};}const a=ang(),r=(rmin+rmax)/2;return {x:Math.cos(a)*r,z:Math.sin(a)*r};};
 R=A.R;WL=A.WL;thirstK=A.thirstK;coldK=A.coldK;hazIntensity=.7+Math.random()*.6;stormJitter=rnd(-12,18);
 hPhase=rnd(-80,80);hScale=.92+Math.random()*.16;
 const base=A.LAKE;const lk=spot(Math.max(50,R*.35),Math.min(R*.62,130),[{x:0,z:0,r:35}]);
 LAKE={x:lk.x,z:lk.z,r:base.r*(.85+Math.random()*.35)};
 const pd=spot(Math.max(40,R*.28),Math.min(R*.55,120),[{x:0,z:0,r:30},{x:LAKE.x,z:LAKE.z,r:LAKE.r+25}]);
 POND={x:pd.x,z:pd.z,r:A.POND.r*(.8+Math.random()*.4)};
 SPRING={x:rnd(-22,22),z:rnd(-22,22),r:A.SPRING.r};
 const ru=spot(Math.max(70,R*.4),Math.min(R*.75,160),[{x:0,z:0,r:40},{x:LAKE.x,z:LAKE.z,r:35}]);
 RUINS={x:ru.x,z:ru.z};const cv=spot(Math.max(90,R*.5),Math.min(R*.85,190),[{x:0,z:0,r:50},{x:RUINS.x,z:RUINS.z,r:40}]);
 CAVE={x:cv.x,z:cv.z};
 CORN={x:rnd(-4,4),z:rnd(-4,4)};
 if(A.RIVERS&&A.RIVERS.length){RIVERS=[{a:[LAKE.x,LAKE.z],b:[Math.cos(ang())*(R*.85),Math.sin(ang())*(R*.85)],w:A.RIVERS[0].w*(.8+Math.random()*.4)}];if(A.RIVERS[1])RIVERS.push({a:[POND.x,POND.z],b:[Math.cos(ang())*(R*.7),Math.sin(ang())*(R*.7)],w:A.RIVERS[1].w});}else RIVERS=[];
 // caches: mix of fixed-ish + random
 CACHES=[];const nCache=A.id==='urban'?12:A.id==='desert'?9:8;
 for(let i=0;i<nCache;i++){const s=spot(30,R-20,[{x:0,z:0,r:18},...CACHES.map(([x,z])=>({x,z,r:28}))]);CACHES.push([s.x,s.z]);}
 // also keep a cache near ruins/cave
 CACHES.push([RUINS.x+rnd(-4,4),RUINS.z+rnd(-4,4)]);CACHES.push([CAVE.x+rnd(-6,6),CAVE.z+rnd(-6,6)]);
}
function groundColors(c,x,z,y,r,w){
 if(arenaId==='desert'){const sand=new THREE.Color(.91,.78,.52),mesa=new THREE.Color(.62,.48,.36),rockC=new THREE.Color(.55,.5,.45);c.copy(sand).lerp(mesa,w.high*.7).lerp(rockC,sstep(R,R+30,r)*.5).lerp(new THREE.Color(.45,.55,.35),Math.max(sstep(WL+.8,WL,y),1-sstep(8,14,r))*.4);return;}
 if(arenaId==='tundra'){const snow=new THREE.Color(.92,.95,.98),ice=new THREE.Color(.7,.82,.9),rockC=new THREE.Color(.55,.58,.62);c.copy(snow).lerp(rockC,w.high*.6).lerp(ice,w.ice||0).lerp(new THREE.Color(.5,.55,.45),(w.forest||0)*.35);return;}
 if(arenaId==='urban'){const ash=new THREE.Color(.45,.45,.42),road=new THREE.Color(.28,.28,.3),rubble=new THREE.Color(.55,.5,.42);c.copy(ash).lerp(road,w.street||0).lerp(rubble,w.ruins*.4).lerp(new THREE.Color(.35,.4,.3),1-sstep(8,14,r));return;}
 const g0=new THREE.Color(.82,.9,.72),dirtC=new THREE.Color(.75,.62,.48),rockC=new THREE.Color(.62,.6,.56),meadC=new THREE.Color(.95,1,.62);
 c.copy(g0).lerp(meadC,w.meadow*.6).lerp(rockC,Math.min(1,w.high*.8+sstep(R,R+30,r)*.6)).lerp(dirtC,Math.max(1-sstep(8,14,r),sstep(WL+.6,WL-.3,y)*.9,w.ruins*.7));
}

let cornLight=null,cornInside=null;
function buildCornucopia(A){
 if(cornLight){scene.remove(cornLight);cornLight=null;}
 const g=new THREE.Group();const y0=H(CORN.x,CORN.z);const R0=5.2,R1=4.4,Hwall=4.2,door=1.15; // door half-angle rad, opens toward +Z
 const id=A.id;
 const wallM=id==='desert'?new THREE.MeshStandardMaterial({color:0xb87333,metalness:.85,roughness:.35}):
  id==='tundra'?new THREE.MeshStandardMaterial({color:0xb8d4e8,metalness:.3,roughness:.25,transparent:true,opacity:.92}):
  id==='urban'?new THREE.MeshStandardMaterial({color:0x6a7078,metalness:.7,roughness:.45}):
  new THREE.MeshStandardMaterial({color:0xd9a93a,metalness:.95,roughness:.28});
 const roofM=wallM.clone();roofM.color=wallM.color.clone().offsetHSL(0,0,id==='tundra'?.1:-.08);
 const floorM=new THREE.MeshStandardMaterial({color:id==='desert'?0xc2a060:id==='tundra'?0xd0e0f0:id==='urban'?0x4a4a4a:0x8a6a3a,roughness:.9});
 // floor disc
 const floor=new THREE.Mesh(new THREE.CircleGeometry(R1-.15,24),floorM);floor.rotation.x=-Math.PI/2;floor.position.y=.04;floor.receiveShadow=true;g.add(floor);
 // wall segments (open door toward +Z = angle near 0 in atan2(x,z)? atan2(x,z): +Z is angle 0)
 const segs=18;for(let i=0;i<segs;i++){
  const a0=i/segs*Math.PI*2,a1=(i+.92)/segs*Math.PI*2,amid=(a0+a1)/2;
  let da=amid;while(da>Math.PI)da-=Math.PI*2;while(da<-Math.PI)da+=Math.PI*2;
  if(Math.abs(da)<door)continue; // entrance gap
  const x=Math.sin(amid)*((R0+R1)/2),z=Math.cos(amid)*((R0+R1)/2);
  const wlen=R0*2*Math.PI/segs*.9;
  const wall=new THREE.Mesh(new THREE.BoxGeometry(wlen,Hwall,.55),wallM);
  wall.position.set(x,Hwall/2,z);wall.rotation.y=amid;wall.castShadow=wall.receiveShadow=true;g.add(wall);
  obstacles.push({x:CORN.x+x,z:CORN.z+z,r:wlen*.45,b:1.6,corn:1,climb:1,h:Hwall});
 }
 // doorway pillars
 for(const side of [-1,1]){const a=side*door;const x=Math.sin(a)*R0,z=Math.cos(a)*R0;
  const p=new THREE.Mesh(new THREE.CylinderGeometry(.28,.32,Hwall+.3,8),wallM);p.position.set(x,Hwall/2+.1,z);p.castShadow=true;g.add(p);
  obstacles.push({x:CORN.x+x,z:CORN.z+z,r:.45,b:1.7,corn:1,climb:1,h:Hwall});}
 // roof / canopy (elevated so FP feels enclosed but walkable)
 if(id==='desert'){const roof=new THREE.Mesh(new THREE.ConeGeometry(R0+1.2,2.2,12,1,true),roofM);roof.position.y=Hwall+1.0;roof.castShadow=true;g.add(roof);
  // sunburst rays
  for(let i=0;i<8;i++){const a=i/8*6.28;const ray=new THREE.Mesh(new THREE.BoxGeometry(.15,.08,R0+2),wallM);ray.position.set(Math.sin(a)*(R0*.5),Hwall+.2,Math.cos(a)*(R0*.5));ray.rotation.y=a;g.add(ray);}}
 else if(id==='tundra'){for(let i=0;i<6;i++){const a=i/6*6.28+door;if(Math.abs(((a+Math.PI)%(Math.PI*2))-Math.PI)<door)continue;
  const sp=new THREE.Mesh(new THREE.ConeGeometry(.35,2.8,5),wallM);sp.position.set(Math.sin(a)*R1*.7,Hwall+1.2,Math.cos(a)*R1*.7);sp.castShadow=true;g.add(sp);}
  const dome=new THREE.Mesh(new THREE.SphereGeometry(R0*.95,12,8,0,Math.PI*2,0,Math.PI*.45),wallM);dome.position.y=Hwall*.85;g.add(dome);}
 else if(id==='urban'){const roof=new THREE.Mesh(new THREE.CylinderGeometry(R0+0.3,R0+0.6,.4,12),roofM);roof.position.y=Hwall+.15;g.add(roof);
  for(let i=0;i<4;i++){const a=i/4*6.28+.4;const beam=new THREE.Mesh(new THREE.BoxGeometry(.25,.25,R0*1.6),wallM);beam.position.set(Math.sin(a)*R0*.3,Hwall-.1,Math.cos(a)*R0*.3);beam.rotation.y=a;g.add(beam);}}
 else{ // wilds: iconic lying horn shell as pavilion rear + golden ring mouth
  const pts=[];for(let i=0;i<=14;i++){const t=i/14;pts.push(new THREE.Vector2(.9+2.4*Math.pow(t,1.3),t*7));}
  const horn=new THREE.Mesh(new THREE.LatheGeometry(pts,20),wallM);horn.rotation.x=Math.PI/2-.05;horn.position.set(0,2.8,-R0*.15);horn.scale.set(1.1,1.1,1.1);horn.castShadow=true;g.add(horn);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(R0+.1,.12,6,24),wallM);rim.rotation.x=Math.PI/2;rim.position.y=Hwall*.55;g.add(rim);
  // overflowing crates at mouth
  for(let i=0;i<5;i++){const cr=new THREE.Mesh(new THREE.BoxGeometry(.55,.4,.45),crateMat);const a=(-door+.2)+i*.35;cr.position.set(Math.sin(a)*(R0+.6),0.25,Math.cos(a)*(R0+.6));cr.rotation.y=a;cr.castShadow=true;g.add(cr);}}
 // interior light
 cornLight=new THREE.PointLight(id==='tundra'?0xaaccff:id==='desert'?0xffcc88:id==='urban'?0xffaa77:0xffd480,1.6,14,1.4);
 cornLight.position.set(CORN.x,y0+2.4,CORN.z);scene.add(cornLight);
 g.position.set(CORN.x,y0,CORN.z);g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 cornMesh=g;scene.add(g);cornInside={x:CORN.x,z:CORN.z,r:R1};
 worldExtras.push(g);
}
function inCornucopia(x,z){return cornInside&&Math.hypot(x-cornInside.x,z-cornInside.z)<cornInside.r;}

function rebuildArena(biomeId,seed){
 const A=ARENAS.find(a=>a.id===biomeId)||ARENAS[0];
 arena=A;arenaId=A.id;ARENA_SEED=seed|0;thirstK=A.thirstK;coldK=A.coldK;
 seedRng(ARENA_SEED);placeLandmarks(A);
 // mood
 su.turbidity.value=A.sky.turb;su.rayleigh.value=A.sky.ray;su.mieCoefficient.value=A.sky.mie;
 hemi.color.setHex(A.hemi);hemi.groundColor.setHex(A.hemiG);sun.color.setHex(A.sunC);
 scene.fog.near=25;scene.fog.far=QL.fog*(A.fogFar||1);scene.fog.color.setHex(A.day);
 pineMat.color.setHex(A.id==='tundra'?0x1a3a2a:A.id==='desert'?0x5a6a3a:0x2c5528);
 leafMat.color.setHex(A.id==='tundra'?0x3a5a40:A.id==='desert'?0x6a7a38:0x4a7a30);
 stoneMat.color.setHex(A.id==='desert'?0xc2a878:A.id==='tundra'?0xb8c4d0:A.id==='urban'?0x8a8680:0xcbc2ad);
 clearWorldMeshes();
 const TS=R+80;const tg=new THREE.PlaneGeometry(TS*2,TS*2,QL.tseg,QL.tseg);tg.rotateX(-Math.PI/2);
 {const p=tg.attributes.position,cols=new Float32Array(p.count*3),c=new THREE.Color();
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),y=H(x,z);p.setY(i,y);groundColors(c,x,z,y,Math.hypot(x,z),zoneW(x,z));cols.set([c.r,c.g,c.b],i*3);}
  tg.setAttribute('color',new THREE.BufferAttribute(cols,3));tg.computeVertexNormals();}
 groundMat.map.repeat.set(TS/3,TS/3);groundMat.normalMap.repeat.set(TS/3,TS/3);
 if(A.id==='desert'){groundMat.map=tex('ground_c.jpg',TS/3,true);groundMat.normalMap=tex('ground_n.jpg',TS/3);}
 else if(A.id==='tundra'){groundMat.map=tex('ground_c.jpg',TS/4,true);groundMat.normalMap=tex('rock_n.jpg',TS/4);}
 else if(A.id==='urban'){groundMat.map=tex('rock_c.jpg',TS/5,true);groundMat.normalMap=tex('rock_n.jpg',TS/5);}
 else{groundMat.map=tex('grass_c.jpg',TS/3,true);groundMat.normalMap=tex('grass_n.jpg',TS/3);}
 ground=new THREE.Mesh(tg,groundMat);ground.receiveShadow=true;scene.add(ground);
 {const dg=new THREE.CircleGeometry(14,40);dg.rotateX(-Math.PI/2);const p=dg.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,H(p.getX(i)+CORN.x,p.getZ(i)+CORN.z)+.03);
  const a=new Float32Array(p.count*4);for(let i=0;i<p.count;i++){const r=Math.hypot(p.getX(i),p.getZ(i));a.set([1,1,1,1-sstep(9,14,r)],i*4);}dg.setAttribute('color',new THREE.BufferAttribute(a,4));
  dirtRing=new THREE.Mesh(dg,dirtMat);dirtRing.position.set(CORN.x,0,CORN.z);dirtRing.receiveShadow=true;scene.add(dirtRing);}
 const wgeo=new THREE.PlaneGeometry(TS*2,TS*2);
 if(QL.water==='reflect'){water=new Water(wgeo,{textureWidth:512,textureHeight:512,waterNormals:wnorm,sunDirection:new THREE.Vector3(),sunColor:0xffffff,waterColor:A.water,distortionScale:A.id==='tundra'?1.2:2.5,fog:true});}
 else{wnorm.repeat.set(30,30);simpleWaterMat=new THREE.MeshStandardMaterial({color:A.waterS,roughness:A.id==='tundra'?.4:.08,metalness:A.id==='tundra'?.1:.3,normalMap:wnorm,normalScale:new THREE.Vector2(.6,.6),transparent:true,opacity:A.id==='tundra'?.7:.88,envMapIntensity:1.2});water=new THREE.Mesh(wgeo,simpleWaterMat);}
 water.rotation.x=-Math.PI/2;water.position.y=WL;if(A.id==='tundra')water.position.y=WL-.05;scene.add(water);
 for(let x=-R;x<=R;x+=3)for(let z=-R;z<=R;z+=3){if(Math.hypot(x,z)>R-4)continue;if(H(x,z)<WL&&(H(x+3,z)>WL||H(x-3,z)>WL||H(x,z+3)>WL||H(x,z-3)>WL))SHORE.push([x,z]);}
 // frozen lake drink points for tundra
 if(A.id==='tundra'){for(let i=0;i<24;i++){const a=i/24*6.28;SHORE.push([LAKE.x+Math.cos(a)*(LAKE.r+1),LAKE.z+Math.sin(a)*(LAKE.r+1)]);}}
 wall=new THREE.Mesh(new THREE.CylinderGeometry(R,R,16,96,1,true),new THREE.MeshBasicMaterial({color:A.wall,transparent:true,opacity:.1,side:THREE.DoubleSide,depthWrite:false,fog:false}));wall.position.y=6;scene.add(wall);
 zoneMesh=new THREE.Mesh(new THREE.CylinderGeometry(1,1,50,96,1,true),new THREE.MeshBasicMaterial({color:0xff4410,transparent:true,opacity:.28,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));zoneMesh.position.y=14;scene.add(zoneMesh);
 obstacles=[];buildCornucopia(A);
 // trees
 const nTrees=Math.max(40,Math.floor(QL.trees*(A.treeMul||1)));
 {let n=0,guard=0;while(n<nTrees&&guard++<nTrees*40){const a=Math.random()*6.283,r=Math.sqrt(Math.random())*(R+28),x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.random()*1.7>treeDensity(x,z))continue;
  const s=rnd(.8,1.5),y=H(x,z)-.2;QQ.setFromEuler(E.set(0,rnd(0,6.28),0));const m=new THREE.Matrix4().compose(P3.set(x,y,z),QQ,S3.set(s,s,s));TL.push({x,z,m});
  const pine=zoneW(x,z).high>.3||A.id==='tundra'||Math.random()<.6;(pine?PL:LL).push({x,z,m,c:pine?new THREE.Color().setHSL(rnd(.26,.33),rnd(.35,.5),rnd(.18,.26)):new THREE.Color().setHSL(rnd(.2,.3),rnd(.4,.55),rnd(.22,.32))});
  if(r<R)obstacles.push({x,z,r:.35*s,b:4,climb:1,h:3.8+s*1.4});n++;}}
 if(TL.length)chunked(trunkGeo,barkMat,TL,{shadow:true,recv:true});if(PL.length)chunked(pineGeo,pineMat,PL,{shadow:true});if(LL.length)chunked(leafGeo,leafMat,LL,{shadow:true});
 // rocks / mesas / urban rubble
 const nRocks=Math.floor(QL.rocks*(A.rockMul||1));
 {let n=0;while(n<nRocks){const x=rnd(-R,R),z=rnd(-R,R);if(Math.hypot(x,z)>R-3||Math.hypot(x,z)<16||inWater(x,z))continue;const hw=zoneW(x,z).high||0;if(Math.random()>.35+hw*.65&&A.id!=='urban')continue;if(A.id==='urban'&&!(zoneW(x,z).ruins>.4||zoneW(x,z).street>.5)&&Math.random()>.3)continue;const s=rnd(.5,2.1)*(1+hw*1.2)*(A.id==='desert'?1.3:1);addRock(x,z,s,s*rnd(.5,.9),s*rnd(.8,1.2));n++;}
  if(A.id!=='urban'){for(let i=0;i<14;i++){const a=rnd(0,6.28),r=rnd(R*.65,R*.95),x=Math.cos(a)*r,z=Math.sin(a)*r;addRock(x,z,rnd(6,10),rnd(5,9),rnd(3,5),a+Math.PI/2);}
   const c=CAVE,h=H(c.x,c.z);addRock(c.x-5,c.z,3,6,3.5,0);addRock(c.x+5,c.z,3,6,3.5,0);addRock(c.x,c.z,8,2.2,4,0,h+6.5);addRock(c.x-9,c.z+3,4,4,4);addRock(c.x+9,c.z-2,4,5,4);addRock(c.x,c.z-6,7,7,3,0);}}
 if(RL.length)chunked(rockGeo,rockMat,RL,{shadow:true,recv:true});
 // ruins / city blocks
 {const colG=new THREE.CylinderGeometry(.7,.8,1,10),wallG=new THREE.BoxGeometry(1,1,1),CL=[],WLs=[];
  if(A.id==='urban'){for(let bx=-3;bx<=3;bx++)for(let bz=-3;bz<=3;bz++){if(Math.abs(bx)+Math.abs(bz)<1)continue;const cx=bx*28+rnd(-3,3),cz=bz*28+rnd(-3,3);if(Math.hypot(cx,cz)>R-20||Math.hypot(cx,cz)<28)continue;
   for(let i=0;i<4;i++){const a=i/4*6.28+.2,x=cx+Math.cos(a)*8,z=cz+Math.sin(a)*8,hh=rnd(3,9),y=H(x,z);CL.push({x,z,m:new THREE.Matrix4().compose(P3.set(x,y+hh/2,z),QQ.identity(),S3.set(1.2,hh,1.2))});obstacles.push({x,z,r:1.1,b:1.4,climb:1,h:hh});}
   for(let i=0;i<3;i++){const a=rnd(0,6.28),x=cx+Math.cos(a)*rnd(2,7),z=cz+Math.sin(a)*rnd(2,7),l=rnd(4,9),hh=rnd(1.5,4),y=H(x,z);WLs.push({x,z,m:new THREE.Matrix4().compose(P3.set(x,y+hh/2,z),QQ.setFromEuler(E.set(0,a,0)),S3.set(l,hh,.7))});obstacles.push({x,z,r:l*.35,b:1,climb:1,h:hh});}}}
  else{for(let i=0;i<12;i++){const a=i/12*6.283,x=RUINS.x+Math.cos(a)*11,z=RUINS.z+Math.sin(a)*11,hh=Math.random()<.4?rnd(1,2.5):rnd(4.5,6.5),y=H(x,z);CL.push({x,z,m:new THREE.Matrix4().compose(P3.set(x,y+hh/2,z),QQ.identity(),S3.set(1,hh,1))});obstacles.push({x,z,r:.85,b:1.2,climb:1,h:hh});}
   for(let i=0;i<6;i++){const a=rnd(0,6.28),x=RUINS.x+Math.cos(a)*rnd(3,8),z=RUINS.z+Math.sin(a)*rnd(3,8),l=rnd(3,6),hh=rnd(.8,2.2),y=H(x,z);WLs.push({x,z,m:new THREE.Matrix4().compose(P3.set(x,y+hh/2,z),QQ.setFromEuler(E.set(0,a,0)),S3.set(l,hh,.6))});obstacles.push({x,z,r:l*.4,b:1,climb:1,h:hh});}}
  if(CL.length)chunked(colG,stoneMat,CL,{shadow:true,recv:true});if(WLs.length)chunked(wallG,stoneMat,WLs,{shadow:true,recv:true});}
 buildGrid();
 // grass / scrub
 {const nGrass=Math.floor(QL.grass*(A.grassMul||1));const GL=[],centers=[];
  for(let i=0;i<120;i++){let x,z;do{x=rnd(-R,R);z=rnd(-R,R);}while(Math.hypot(x,z)>R);centers.push([x,z,zoneW(x,z).meadow>.4?16:8]);}
  let guard=0;while(GL.length<nGrass&&guard++<Math.max(nGrass,1)*4){const c=pick(centers),x=c[0]+rnd(-c[2],c[2]),z=c[1]+rnd(-c[2],c[2]);if(Math.hypot(x,z)>R-1||Math.hypot(x,z)<11||H(x,z)<WL+.3||zoneW(x,z).high>.65)continue;
   const s=rnd(.7,1.6);GL.push({x,z,m:new THREE.Matrix4().compose(P3.set(x,H(x,z)-.03,z),QQ.setFromEuler(E.set(0,rnd(0,6.28),0)),S3.set(s,s*rnd(.8,1.4),s))});}
  if(GL.length)chunkedSmall(grassBlade,grassMat,GL);}
 Math.random=_realRandom;worldBuilt=true;redrawMinimapBg();
 return {biome:arenaId,seed:ARENA_SEED,code:arenaCode(ARENA_SEED)};}
function arenaCode(seed){return ((seed>>>0)%10000).toString().padStart(4,'0');}
function pickArenaSeed(biomeId){return (Math.random()*0xffffffff)|0;}
// initial Wilds build (seeded)
{const _s=ARENA_SEED;seedRng(_s);/*rebuild after mats ready*/}
Math.random=_realRandom;
// line of sight (trees' foliage and rocks block view)
function LOS(ax,az,bx,bz){const d=Math.hypot(bx-ax,bz-az),n=Math.ceil(d/GC)+1,seen=new Set();
 for(let i=0;i<=n;i++){const t=i/n,x=ax+(bx-ax)*t,z=az+(bz-az)*t;for(const o of obsNear(x,z)){if(seen.has(o))continue;seen.add(o);
  const r=o.r*(o.b||1)*.8;if(Math.hypot(o.x-ax,o.z-az)<r+.5||Math.hypot(o.x-bx,o.z-bz)<r+.5)continue;if(segDist(o.x,o.z,[ax,az],[bx,bz])<r)return false;}}return true;}

// ---------- items ----------
let items=[];
// CACHES set by arena;
let itemId=0,itemsVer=0;function addItem(type,x,z,id){const m=itemMesh(type);m.position.set(x,H(x,z),z);m.rotation.y=rnd(0,6.28);scene.add(m);items.push({type,m,x,z,id:id??itemId++});itemsVer++;}
let cacheCrates=[];
function biomeWeapons(){
 if(arenaId==='desert')return ['sword','mace','knife','sling','sling','axe','throwknife','shield','spear'];
 if(arenaId==='tundra')return ['bow','bow','axe','sword','spear','knife','mace','throwspear','shield'];
 if(arenaId==='urban')return ['sword','knife','mace','trident','shield','shield','throwknife','bow','axe'];
 return ['bow','spear','axe','sword','knife','mace','trident','throwknife','throwspear','sling','shield'];}
function spawnItems(){items.forEach(i=>scene.remove(i.m));items=[];cacheCrates.forEach(c=>scene.remove(c));cacheCrates=[];
 const pool=biomeWeapons();
 const near=[...pool,...pool.slice(0,4),'food','food','water','water','food','axe','knife'];
 near.forEach((t,i)=>{const a=i/near.length*6.283,r=rnd(5.5,12);addItem(t,CORN.x+Math.cos(a)*r,CORN.z+Math.sin(a)*r);});
 // high-value inside Cornucopia
 const inside=['food','water',pick(pool),pick(['sword','bow','trident','shield'])];
 inside.forEach((t,i)=>{const a=i/inside.length*6.283+1,r=rnd(.8,2.2);addItem(t,CORN.x+Math.sin(a)*r,CORN.z+Math.cos(a)*r);});
 for(const [cx,cz] of CACHES){const c=new THREE.Mesh(new THREE.BoxGeometry(1.2,.8,.9),crateMat);c.position.set(cx,H(cx,cz)+.4,cz);c.rotation.y=rnd(0,3);c.castShadow=true;scene.add(c);cacheCrates.push(c);
  for(const t of [pick(pool),'food','water',pick(['food','berries',pick(pool)])]){const a=rnd(0,6.28);addItem(t,cx+Math.cos(a)*2.2,cz+Math.sin(a)*2.2);}}
 // biome flavor near water
 if(arenaId==='urban'||arenaId==='wilds'){for(let i=0;i<3;i++){const a=rnd(0,6.28);addItem('trident',LAKE.x+Math.cos(a)*(LAKE.r+3),LAKE.z+Math.sin(a)*(LAKE.r+3));}}
 if(arenaId==='wilds'||arenaId==='tundra'){for(let i=0;i<4;i++){let x,z;do{x=rnd(-R+20,R-20);z=rnd(-R+20,R-20);}while(Math.hypot(x,z)<40);addItem('bow',x,z);}}
 for(let i=0;i<110;i++){let x,z;do{x=rnd(-R+5,R-5);z=rnd(-R+5,R-5);}while(Math.hypot(x,z)>R-5||inWater(x,z));const w=zoneW(x,z);
  addItem(i<70?(w.high>.5?'food':'berries'):i<92?'food':i<104?'water':pick(pool),x,z);}
 spawnSticks();}

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
 x.fillStyle='rgba(0,0,0,.45)';x.fillRect(20,8,216,48);x.fillStyle='#'+(DCOL[e.d]||0xffffff).toString(16).padStart(6,'0');x.fillRect(20,52,216,4);const mine=e.ally&&e.ally===myTeam();x.fillStyle=mine?'#5dff7a':e.isHuman?'#7fd4ff':e.ally?'#ff8a8a':'#fff';x.fillText(`${mine?'★ ':e.isHuman?'◆ ':''}${e.name} · D${e.d}`,128,42);
 const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthWrite:false,fog:false}));s.scale.set(1.6,.4,1);s.position.y=e.fig.userData.h+.45;s.visible=false;e.fig.add(s);return s;}
function refreshTag(e){if(!e.tag)return;const v=e.tag.visible;e.fig.remove(e.tag);e.tag.material.map.dispose();e.tag=makeTag(e);e.tag.visible=v;}

// ---------- entities ----------
let ents=[],player=null,zoneR=R,time=0,running=false,camMode=isTouch?'third':'first',yaw=0,pitch=0,simMode=false,deaths=[],allianceOn=true,winner=null;
const dayLen=150,GRACE=15,STORM_DUR=600,STORM_MIN=22;let STORM_START=40;
const PERS={spar:{aggr:.12,caution:.7,loot:.4},career:{aggr:.9,caution:.25,loot:.7},hunter:{aggr:.6,caution:.45,loot:.5},scavenger:{aggr:.35,caution:.55,loot:1},hider:{aggr:.15,caution:.9,loot:.35}};
function makeEnt(cfg,isPlayer){const fig=makeFigure(cfg.look);scene.add(fig);
 const e={name:cfg.name,d:cfg.d,fig,isPlayer,isHuman:!!(isPlayer||cfg.remote),isRemote:!!cfg.remote,conn:cfg.conn,look:cfg.look,hp:cfg.hp,maxhp:cfg.hp,spd:cfg.spd,str:cfg.str,stl:cfg.stl,hunger:100,thirst:100,weapon:cfg.weapon||'fists',ammo:(WEAPONS[cfg.weapon||'fists']&&WEAPONS[cfg.weapon||'fists'].ammoN)||0,x:0,z:0,y:0,vy:0,dir:0,cd:0,alive:true,swing:0,flash:0,think:0,tx:0,tz:0,target:null,speed:0,deadT:0,blocking:false,blockHeld:false,climbStam:100,coyote:0,jumpCd:0,climbCd:0,climbing:null,grounded:true,favor:cfg.pers==='career'?48:cfg.isPlayer||cfg.remote?32:28,cloak:0,campIdle:0,clutchT:0,lastGiftT:-999,emergUsed:0,
  pers:cfg.pers,P:PERS[cfg.pers]||PERS.hunter,ally:cfg.ally||0,state:'loot',mem:new Map(),windup:0,recover:0,strafe:Math.random()<.5?1:-1,strafeT:0,stuckT:0,detour:0,dx:0,dz:0,noise:0,hiding:false,lastX:0,lastZ:0,checkT:0,ambushSpot:null,kills:0};
 if(!isPlayer&&!cfg.noTag)e.tag=makeTag(e);if(e.weapon!=='fists')giveWeaponMesh(fig,e.weapon);return e;}
function aiLook(excl){const pool=AI_MODELS.filter(m=>!excl.includes(m));return {model:pick(pool),scale:rnd(.88,1.12),cloth:new THREE.Color().setHSL(Math.random(),rnd(.35,.75),rnd(.25,.55)).getHex(),skin:pick(SKINS),hair:new THREE.Color().setHSL(rnd(.02,.12),rnd(.3,.7),rnd(.08,.6)).getHex(),acc:pick(['none','backpack','quiver','bedroll','cape','sash']),accC:new THREE.Color().setHSL(Math.random(),.5,.35).getHex()};}
function charLook(c){const pal=PALETTES[custom.palette]||PALETTES[0];return {model:c.model,scale:c.scale,acc:custom.accOn===false?'none':(c.acc||'none'),accC:custom.accOn===false?c.accC:(pal.c),skin:c.skin,cloth:pal.c,hair:c.hair};}
function clearWorld(){ents.forEach(e=>scene.remove(e.fig));ents=[];clearAnimals();clearCamps();clearProjs();clearGifts();}
function startGame(opts={}){
 audio();
 if(opts.biome){rebuildArena(opts.biome,opts.seed|0);syncArenaSky();}
 else if(!opts.keepArena){const b=ARENAS[Math.floor(Math.random()*ARENAS.length)];rebuildArena(b.id,(Math.random()*0xffffffff)|0);syncArenaSky();}
 else if(!worldBuilt){rebuildArena(arenaId,ARENA_SEED);syncArenaSky();}
 clearWorld();spawnItems();zoneR=R;time=0;hazT=rnd(25,50);hazActive=false;STORM_START=40;deaths=[];allianceOn=true;winner=null;wasNight=isNight();stopAnthem();simMode=!!opts.sim;practice=!!opts.practice;survK=practice?.08:1;paused=false;homeActive=false;
 const pc=CHARS[sel];const pName=(custom.name||'').trim().slice(0,14)||pc.name;player=makeEnt({...pc,name:pName,look:charLook(pc),pers:'player'},true);ents.push(player);player.ghost=simMode;player.ally=TEAM;player.order='follow';player.netName=opts.myName||pName;player.ammo=(WEAPONS[player.weapon]&&WEAPONS[player.weapon].ammoN)||0;player.favor=34;onlyOneAnnounced=false;clearGifts();nextGiftT=practice?25:rnd(120,170);aidCd=0;sleeveMat.color.setHex((PALETTES[custom.palette]||PALETTES[0]).c);
 const usedD=[pc.d],models=[pc.model];
 (opts.remotes||[]).forEach((r,k)=>{const c=CHARS[r.char]||CHARS[0];const e=makeEnt({...c,name:r.name||c.name,look:{model:c.model,scale:c.scale,acc:c.acc||'none',accC:c.accC,skin:c.skin,cloth:c.c,hair:c.hair},pers:'player',remote:true,conn:r.conn},false);e.ally=100+k;e.order='follow';e.inp={};r.ent=e;ents.push(e);usedD.push(c.d);models.push(c.model);});
 const names=FIRST.slice().sort(()=>Math.random()-.5);
 if(practice){for(let i=0;i<3;i++)spawnSpar(names[i]);const dum=[[24,-6],[24,0],[24,6],[30,-3],[30,3]];dum.forEach(([x,z])=>spawnDummy(x,z));}
 else{const others=[];for(let d=1;d<=12;d++)for(let k=0;k<2;k++)others.push(d);for(const d of usedD){const ix=others.indexOf(d);if(ix>=0)others.splice(ix,1);}
  others.forEach((d,i)=>{const career=d<=2||d===4;const pers=career?'career':pick(['hunter','scavenger','scavenger','hider','hider','hunter']);
   ents.push(makeEnt({name:names[i%names.length],d,hp:(career?rnd(105,130):rnd(80,115))|0,spd:rnd(.85,1.12),str:career?rnd(1.05,1.3):rnd(.8,1.15),stl:pers==='hider'?.8:.5,look:aiLook(models),pers,ally:career?1:0},false));});}
 const ring=ents.filter(e=>!e.isDummy);ring.forEach((e,i)=>{const a=i/ring.length*6.283;e.x=Math.cos(a)*17;e.z=Math.sin(a)*17;e.y=H(e.x,e.z);e.dir=Math.atan2(-e.x,-e.z);e.tx=e.x;e.tz=e.z;e.lastX=e.x;e.lastZ=e.z;});
 if(practice){player.x=16;player.z=0;player.dir=Math.PI/2;}
 yaw=player.dir+Math.PI;pitch=0;
 spawnAnimals();
 if(simMode){running=true;return;}
 showGameUI();setCam();fpsLog=[];
 announce(`${arena.tag} ${arena.name} · Arena #${arenaCode(ARENA_SEED)}`);
 setTimeout(()=>announce(practice?'Practice: hit the dummies to the east!':'Let the Games begin!'),practice?0:2200);updateCount();
 if(practice)startTutorial();}
function showGameUI(){['select','end','home','online','pauseMenu'].forEach(s=>$(s).classList.add('hidden'));['hud','count','cross','mapwrap','pauseBtn','campBtn','aidBtn'].forEach(s=>$(s).classList.remove('hidden'));if($('aidBtn'))$('aidBtn').style.display='';
 if(isTouch){$('touch').classList.remove('hidden');$('btns').classList.remove('hidden');}
 renderer.domElement.style.display='block';running=true;$('hint').textContent=isTouch?'':'Click to lock mouse';}
function spawnSpar(name){const look=aiLook([]);const e=makeEnt({name:name||pick(FIRST),d:pick([3,5,6,8,10]),hp:70,spd:.85,str:.6,stl:.4,look,pers:'spar'},false);const a=rnd(0,6.28);e.x=Math.cos(a)*14;e.z=Math.sin(a)*14;e.y=H(e.x,e.z);e.tx=e.x;e.tz=e.z;ents.push(e);updateCount();return e;}
function spawnDummy(x,z){const g=new THREE.Group(),straw=new THREE.MeshStandardMaterial({color:0xc8a860,roughness:.9}),woodM=new THREE.MeshStandardMaterial({color:0x6b4a2b,roughness:.9});
 const post=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,1.8,6),woodM);post.position.y=.9;const body=new THREE.Mesh(new THREE.CylinderGeometry(.32,.28,.8,8),straw);body.position.y=1.25;const head=new THREE.Mesh(new THREE.SphereGeometry(.22,8,6),straw);head.position.y=1.85;const arm=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,1.1,5),woodM);arm.rotation.z=Math.PI/2;arm.position.y=1.45;
 g.add(post,body,head,arm);g.traverse(o=>{if(o.isMesh)o.castShadow=true;});g.userData={mats:[straw],h:1.9,mixer:{update(){}},acts:{}};const y=H(x,z);g.position.set(x,y,z);scene.add(g);
 const e={name:'Dummy',d:0,fig:g,isDummy:true,alive:true,hp:9999,maxhp:9999,x,z,y,dir:-Math.PI/2,weapon:'fists',str:1,stl:0,ally:0,noise:0,speed:0,flash:0,mem:new Map(),P:PERS.hider,kills:0};ents.push(e);return e;}
$('start').onclick=()=>startGame({practice:gameMode==='practice'});$('retry').onclick=()=>startGame({practice:gameMode==='practice'});
$('newchar').onclick=()=>{hideGameUI();$('end').classList.add('hidden');$('select').classList.remove('hidden');renderer.domElement.style.display='none';};
loadP.then(()=>{makeThumbs();$('start').disabled=false;$('start').textContent='Enter the Arena';setPreview();$('homeStatus').textContent='Each match rolls a random biome & layout';modelsReady=true;onReady();}).catch(e=>{$('start').textContent='Failed to load models';console.error(e);});
let msgT;const annLog=[];function announce(t){if(/night\s*(has\s+)?(fallen|falls|fall)|nightfall|dusk\s+has|darkness\s+falls/i.test(t||'')){annLog.push(Math.round(time)+'s [silenced night cue] '+t);return;}annLog.push(Math.round(time)+'s '+t);if(simMode)return;const m=$('msg');m.textContent=t;m.style.opacity=1;clearTimeout(msgT);msgT=setTimeout(()=>m.style.opacity=0,3000);}
function alive(){return ents.filter(e=>e.alive&&!e.ghost&&!e.isDummy);}
function updateCount(){if(!simMode)$('count').innerHTML=practice?`Practice: ${alive().length-1} sparring partners`:`Tributes remaining: ${alive().length}`;}
function kill(e,by){if(!e.alive)return;e.alive=false;e.deadT=0;const u=e.fig.userData;u.oneShot=0;playOnce(e.fig,'death',1.2);u.oneShot=99;if(e.tag)e.tag.visible=false;
 if(!simMode)setTimeout(()=>scene.remove(e.fig),8000);if(by&&by.kills!==undefined){by.kills++;by.favor=Math.min(100,(by.favor||0)+8+(by.isPlayer?4:0));}
 deaths.push({t:Math.round(time),name:e.name,d:e.d,pers:e.pers,by:by?(by.name||by):'?',zone:zoneName(e.x,e.z)});
 if(e.weapon!=='fists'){addItem(e.weapon,e.x+1,e.z);giveWeaponMesh(e.fig,null);}
 if(!simMode)cannon();updateCount();
 if(practice&&e.pers==='spar')setTimeout(()=>{if(practice&&running)spawnSpar();},8000);
 if(NET.role==='host'){netBroadcast({t:'ann',text:`BOOM! ${e.name}, District ${e.d}, has fallen`,cannon:1});if(e.isRemote&&e.conn)netSend(e.conn,{t:'dead',by:by?(by.name||by):''});}
 if(e.isPlayer){camMode='third';setCam();return endGame(false,by);}announce(`BOOM! ${e.name}, District ${e.d}, has fallen${by&&by.isPlayer?' (by you)':''}`);
 const al=alive();if(allianceOn&&al.length<=7){allianceOn=false;for(const t of ents)if(t.ally===1){t.ally=0;refreshTag(t);}announce("The Careers' alliance has broken!");}
 checkTeamEnd();
 if(simMode&&al.length===1){winner=al[0];running=false;}
 else if(!practice&&al.length===1&&NET.role==='host'){netBroadcast({t:'over',winner:al[0].name});if(al[0].isPlayer)endGame(true);}
 else if(!practice&&player.alive&&!player.ghost&&al.length===1)endGame(true);}
function endGame(win,by){if(NET.role!=='host')running=false;$('pauseBtn').classList.add('hidden');$('tut').classList.add('hidden');$('retry').classList.toggle('hidden',!!NET.role);$('newchar').classList.toggle('hidden',!!NET.role);if(document.pointerLockElement)document.exitPointerLock();
 $('endTitle').textContent=win?'VICTOR!':'YOU DIED';$('endTitle').style.color=win?'#f5b942':'#e33';
 const mins=Math.floor(time/60),secs=Math.floor(time%60);
 $('final').innerHTML=win?`${player.name} of District ${player.d} wins the Games!<br>Survived ${mins}m ${secs}s · ${player.kills} kills`:`${practice?'Practice over':'Placed #'+(alive().length+1)+' of 24'} · survived ${mins}m ${secs}s${by?`<br>Killed by ${by.name||by}`:''}`;
 setTimeout(()=>{$('end').classList.remove('hidden');['touch','btns','cross','mapwrap'].forEach(s=>$(s).classList.add('hidden'));},win?600:1800);}
let gifts=[],giftId=0,nextGiftT=140,aidCd=0,giftsVer=0;
function clearGifts(){for(const g of gifts)if(g.m)scene.remove(g.m);gifts=[];giftId=0;giftsVer++;}
function chuteMesh(){const g=new THREE.Group();
 const silk=new THREE.MeshStandardMaterial({color:0xd8dee8,metalness:.55,roughness:.35,side:THREE.DoubleSide});
 const chute=new THREE.Mesh(new THREE.SphereGeometry(.55,10,6,0,Math.PI*2,0,Math.PI*.55),silk);chute.position.y=1.35;chute.scale.set(1.15,.55,1.15);
 const cordM=new THREE.MeshBasicMaterial({color:0xbbbbbb});for(let i=0;i<6;i++){const a=i/6*6.28;const c=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,1.1,3),cordM);c.position.set(Math.cos(a)*.35,.75,Math.sin(a)*.35);c.rotation.z=Math.cos(a)*.25;c.rotation.x=Math.sin(a)*.25;g.add(c);}
 const box=new THREE.Mesh(new THREE.BoxGeometry(.32,.22,.28),new THREE.MeshStandardMaterial({color:0x8a9098,metalness:.7,roughness:.4}));box.position.y=.12;box.castShadow=true;
 const ribbon=new THREE.Mesh(new THREE.BoxGeometry(.34,.04,.04),new THREE.MeshStandardMaterial({color:0xc9a227,metalness:.6,roughness:.35}));ribbon.position.y=.24;
 g.add(chute,box,ribbon);g.traverse(o=>{if(o.isMesh)o.castShadow=true;});return g;}
function giftChime(){if(!ac){audio();if(!ac)return;}const t0=ac.currentTime;[[880,.12],[1100,.12],[1320,.18],[1760,.28]].forEach(([f,d],i)=>{const o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(.0001,t0+i*.1);g.gain.exponentialRampToValueAtTime(.12,t0+i*.1+.03);g.gain.exponentialRampToValueAtTime(.0001,t0+i*.1+d);o.connect(g).connect(ac.destination);o.start(t0+i*.1);o.stop(t0+i*.1+d+.02);});}
function giftLabel(t){return({food:'rations',water:'water',medicine:'medicine',bandage:'bandages',ammo_arrow:'arrows',ammo_stone:'sling stones',shield:'a shield',spknife:'a sponsor knife',sword:'a sword',bow:'a bow',cloak:'a warm cloak',flask:'a water flask',axe:'an axe',trident:'a trident',mace:'a mace',knife:'a knife'}[t]||t);}
function pickGiftContents(e,favor,emerg){const f=favor||0,need=[];
 if(e.hp/e.maxhp<.45||emerg)need.push('medicine','bandage');
 if(e.hunger<40||emerg)need.push('food','food');
 if(e.thirst<40||emerg)need.push('water','flask');
 if(arenaId==='tundra')need.push('cloak');
 if(arenaId==='desert')need.push('flask','water');
 if(e.weapon==='bow'&&(e.ammo|0)<4)need.push('ammo_arrow');
 if(e.weapon==='sling'&&(e.ammo|0)<4)need.push('ammo_stone');
 const tier=f>=75?3:f>=55?2:f>=35?1:0;
 const poolLow=['food','water','bandage','berries'];
 const poolMid=['food','water','medicine','bandage','ammo_arrow','ammo_stone','knife','cloak','flask'];
 const poolHi=['medicine','shield','spknife','bow','sword','ammo_arrow','cloak','flask','axe','trident'];
 const pool=tier>=3?poolHi.concat(poolMid):tier>=2?poolMid.concat(poolHi.slice(0,4)):tier>=1?poolMid:poolLow;
 const out=[];const n=emerg?1:(tier>=2?2:1);
 for(let i=0;i<n;i++){const t=need.length&&Math.random()<.55?pick(need):pick(pool);out.push(t);need.splice(need.indexOf(t),1);}
 if(tier>=3&&Math.random()<.35&&!out.includes('spknife'))out[0]='spknife';
 return out;}
function dropGift(target,opts={}){if(!target||!target.alive||simMode&&!opts.force)return null;
 const ang=rnd(0,6.28),dist=rnd(3.5,7.5);let x=target.x+Math.cos(ang)*dist,z=target.z+Math.sin(ang)*dist;
 if(Math.hypot(x,z)>R-6){x=target.x;z=target.z+4;}
 const fav=target.favor||30;const contents=opts.contents||pickGiftContents(target,fav,!!opts.emerg);
 const m=simMode?null:chuteMesh();const gy=H(x,z);if(m){m.position.set(x,gy+18,z);scene.add(m);}
 const instant=!!opts.instant;const g={id:giftId++,x,z,y:instant?gy:gy+18,landY:gy,landed:instant,opened:false,contents,forEnt:target,m,spin:rnd(0,6),age:0};
 gifts.push(g);giftsVer++;target.lastGiftT=time;if(m&&instant){m.position.set(x,gy,z);const ch=m.children[0];if(ch&&ch.scale)ch.scale.y=.25;}
 if(!simMode){giftChime();const who=target.isPlayer||target===player?'your sponsors':(target.name+"'s sponsors");
  if(target.isPlayer||target===player||Math.hypot((player?player.x:0)-x,(player?player.z:0)-z)<40)announce(`A gift from ${who}!`);
  if(NET.role==='host')netBroadcast({t:'ann',text:`A gift from ${who}!`});}
 return g;}
function openGift(e,g){if(!g||g.opened)return;g.opened=true;giftsVer++;
 const labels=g.contents.map(giftLabel);
 for(const t of g.contents){
  if(WEAPONS[t]){if(e.weapon!=='fists'&&e.weapon!=='shield'&&e.weapon!==t)addItem(e.weapon,e.x+.8,e.z+.8);e.weapon=t;e.ammo=WEAPONS[t].ammoN||0;if(e.isPlayer)setWeaponModel();else if(!simMode)giveWeaponMesh(e.fig,t);}
  else if(t==='food'){e.hunger=Math.min(100,e.hunger+50);e.hp=Math.min(e.maxhp,e.hp+8);}
  else if(t==='water'||t==='flask'){e.thirst=Math.min(100,e.thirst+(t==='flask'?100:55));if(t==='flask')e.flask=1;}
  else if(t==='medicine')e.hp=Math.min(e.maxhp,e.hp+55);
  else if(t==='bandage')e.hp=Math.min(e.maxhp,e.hp+25);
  else if(t==='ammo_arrow'){if(e.weapon==='bow')e.ammo=(e.ammo||0)+8;else{e.weapon='bow';e.ammo=8;if(e.isPlayer)setWeaponModel();else if(!simMode)giveWeaponMesh(e.fig,'bow');}}
  else if(t==='ammo_stone'){if(e.weapon==='sling')e.ammo=(e.ammo||0)+10;else{e.weapon='sling';e.ammo=10;if(e.isPlayer)setWeaponModel();else if(!simMode)giveWeaponMesh(e.fig,'sling');}}
  else if(t==='cloak')e.cloak=Math.max(e.cloak||0,200);
  else if(t==='berries'){e.hunger=Math.min(100,e.hunger+20);e.hp=Math.min(e.maxhp,e.hp+5);}
 }
 if(g.m){scene.remove(g.m);g.m=null;}
 gifts=gifts.filter(x=>x!==g);
 e.favor=Math.min(100,(e.favor||0)+3);
 const stolen=g.forEnt&&g.forEnt!==e;
 if(e.isPlayer){announce((stolen?'Stolen sponsor gift: ':'Sponsor gift: ')+labels.join(', '));tone(720,.12,'triangle',.14,1200);}
 else say(e,stolen?`Stole a parachute (${labels[0]})`:`Sponsor gift (${labels[0]})`);
 if(NET.role==='host')giftsVer++;}
function favorTick(dt){if(simMode||practice&&survK<.2){/* still track lightly in practice */}
 for(const e of ents){if(!e.alive||e.isDummy||e.ghost)continue;
  e.favor=e.favor??28;
  // survive slowly
  e.favor=Math.min(100,e.favor+dt*.035*(e.isHuman?1.15:1));
  // clutch: low HP while alive
  if(e.hp/e.maxhp<.28){e.favor=Math.min(100,e.favor+dt*.2);e.clutchT=(e.clutchT||0)+dt;}else e.clutchT=0;
  // camping forever penalty
  const camped=!!myCampNear(e,5)||e.sleeping||(e.state==='rest'&&e.speed<.2);
  if(camped){e.campIdle=(e.campIdle||0)+dt;if(e.campIdle>25)e.favor=Math.max(0,e.favor-dt*.08);}else e.campIdle=Math.max(0,(e.campIdle||0)-dt*2);
  // almost-died scare once per stretch
  if(e.hp/e.maxhp<.12&&!e.emergUsed){e.favor=Math.max(0,e.favor-4);e.emergUsed=1;}
  if(e.hp/e.maxhp>.4)e.emergUsed=0;
 }}
function giftTick(dt){if(simMode)return;if(NET.role==='client'){/* host owns drops; still animate */animateGifts(dt);return;}
 aidCd=Math.max(0,aidCd-dt);
 // drift / land
 animateGifts(dt);
 if(!running||!player||!player.alive)return;
 // scheduled gift for player
 if(time>=nextGiftT){nextGiftT=time+rnd(90,150);
  if((player.favor||0)>=28&&time- (player.lastGiftT||-999)>70)dropGift(player);}
 // emergency
 if((player.hp/player.maxhp<.22||player.hunger<12||player.thirst<12)&&(player.favor||0)>=38&&time-(player.lastGiftT||-999)>45){
  dropGift(player,{emerg:true});nextGiftT=Math.max(nextGiftT,time+80);}
 // AI gifts (rarer; careers favored)
 if(Math.random()<dt*.015){const cands=ents.filter(e=>e.alive&&!e.isPlayer&&!e.isDummy&&!e.ghost&&time-(e.lastGiftT||-999)>100);
  if(cands.length){cands.sort((a,b)=>(b.favor||0)+(b.pers==='career'?20:0)-((a.favor||0)+(a.pers==='career'?20:0)));
   const t=cands[0];if((t.favor||0)+(t.pers==='career'?15:0)>30)dropGift(t);}}
 // AI grab nearby landed gifts
 for(const e of ents){if(!e.alive||e.isPlayer||e.isDummy||e.isRemote)continue;if(Math.random()>dt*1.2)continue;
  for(const g of gifts.slice()){if(g.landed&&!g.opened&&Math.hypot(g.x-e.x,g.z-e.z)<2.5){openGift(e,g);break;}}}
}
function animateGifts(dt){for(const g of gifts){if(g.opened)continue;g.age+=dt;g.spin+=dt*.6;
  if(!g.landed){g.y-=dt*3.2;if(g.y<=g.landY+.05){g.y=g.landY;g.landed=true;giftsVer++;}
   else{g.x+=Math.sin(g.age*1.3)*.015;g.z+=Math.cos(g.age*1.1)*.015;}}
  if(g.m){g.m.position.set(g.x,g.y,g.z);g.m.rotation.y=g.spin;if(g.landed){const ch=g.m.children[0];if(ch&&ch.scale)ch.scale.y=.25;}}}}
function requestAid(){if(!player||!player.alive||aidCd>0||NET.role==='client'){if(NET.role==='client'){netSend(NET.conn,{t:'aid'});return;}if(aidCd>0)return announce('Sponsors need time…');return;}
 const cost=18;if((player.favor||0)<cost+5)return announce('Not enough sponsor favor');
 player.favor-=cost;aidCd=75;
 const chance=.35+player.favor*.005;if(Math.random()<chance){dropGift(player);announce('Your plea was heard…');}else announce('No gift this time — favor spent');}
function giftSnap(){return gifts.filter(g=>!g.opened).map(g=>[g.id,q(g.x),q(g.z),q(g.y),g.landed?1:0,ents.indexOf(g.forEnt),g.contents.join(',')]);}
function clientGifts(arr){const seen=new Set();for(const [id,x,z,y,landed,fi,cont] of arr){seen.add(id);let g=gifts.find(k=>k.id===id);
  if(!g){const m=chuteMesh();m.position.set(x,y,z);scene.add(m);g={id,x,z,y,landY:H(x,z),landed:!!landed,opened:false,contents:(cont||'food').split(','),forEnt:ents[fi]||null,m,spin:0,age:0};gifts.push(g);}
  g.x=x;g.z=z;g.y=y;g.landed=!!landed;if(g.m)g.m.position.set(x,y,z);}
 for(let i=gifts.length-1;i>=0;i--)if(!seen.has(gifts[i].id)){if(gifts[i].m)scene.remove(gifts[i].m);gifts.splice(i,1);}}

let projs=[];
function clearProjs(){for(const p of projs)if(p.m)scene.remove(p.m);projs=[];}
function projMesh(kind){if(kind==='arrow'||kind==='throwspear'){const g=new THREE.Group();const s=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.55,5),wood);s.rotation.x=Math.PI/2;const tip=new THREE.Mesh(new THREE.ConeGeometry(.04,.12,5),metal);tip.rotation.x=Math.PI/2;tip.position.z=.32;g.add(s,tip);return g;}
 if(kind==='throwknife'){const b=new THREE.Mesh(new THREE.BoxGeometry(.03,.01,.28),metal);return b;}
 const s=new THREE.Mesh(new THREE.SphereGeometry(.06,6,5),new THREE.MeshStandardMaterial({color:0x888}));return s;}
function fireProj(a,w){const ammo=a.ammo|0;if(ammo<=0){if(w.fallback){a.weapon=w.fallback;a.ammo=0;if(a.isPlayer){announce('Out of ammo — switching to '+WEAPONS[w.fallback].n);setWeaponModel();}else giveWeaponMesh(a.fig,a.weapon);}else if(a.isPlayer)announce('Out of ammo!');return;}
 a.ammo=ammo-1;a.cd=w.cd;a.swing=.25;a.noise=w.noise||10;
 if(!simMode)playOnce(a.fig,'slash',.4);if(a.isPlayer)tone(480,.06,'square',.1,200);
 const fx=Math.sin(a.dir),fz=Math.cos(a.dir);const kind=w.ammo||(w.thrown?a.weapon:'stone');
 const m=simMode?null:projMesh(kind);if(m){m.position.set(a.x,a.y+1.3,a.z);m.rotation.y=a.dir;scene.add(m);}
 projs.push({m,x:a.x,y:a.y+1.35,z:a.z,vx:fx*(w.speed||30),vz:fz*(w.speed||30),life:1.8,dmg:w.dmg*a.str*rnd(.9,1.1),owner:a,kind});}
function stepProjs(dt){for(let i=projs.length-1;i>=0;i--){const p=projs[i];p.life-=dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.y-=1.2*dt;
  if(p.m){p.m.position.set(p.x,p.y,p.z);p.m.rotation.y=Math.atan2(p.vx,p.vz);}
  let hit=null;for(const e of ents){if(e===p.owner||!e.alive||e.ghost||(p.owner.ally&&e.ally===p.owner.ally))continue;if(Math.hypot(e.x-p.x,e.z-p.z)<1.0&&Math.abs((e.y||0)+1-p.y)<1.6){hit=e;break;}}
  if(!hit){for(const an of animals){if(!an.alive)continue;if(Math.hypot(an.x-p.x,an.z-p.z)<.9){hitAnimal(an,p.dmg,p.owner);p.life=0;break;}}}
  if(hit){applyHit(p.owner,hit,p.dmg,Math.sin(Math.atan2(p.vx,p.vz)),Math.cos(Math.atan2(p.vx,p.vz)));p.life=0;}
  if(p.life<=0||p.y<H(p.x,p.z)-.2){if(p.m)scene.remove(p.m);projs.splice(i,1);}}}
function applyHit(a,best,dmg,fx,fz){if(best.blocking||(best.weapon==='shield'&&best.blockHeld)){dmg*=.25;if(a.isPlayer||best.isPlayer)tone(200,.08,'triangle',.12,100);}
 dmg*=(best.isHuman?.55:1);if(best.isDummy){best.flash=.25;best.lastDmg=dmg;if(a.isPlayer){bubble(best,Math.round(dmg)+' dmg','#a01818');tone(300,.08,'square',.1,200);}tutEvent('hit');return;}
 best.hp-=dmg;best.flash=.2;best.x+=(fx||0)*.45;best.z+=(fz||0)*.45;
 if(a.isHuman){a.lastHit=best;a.lastHitT=time;best.hitByPlayer=(best.hitByPlayer||0)+1;best.lastHitBy=a;}if(best.isHuman){best.lastAttacker=a;best.lastAttackT=time;}
 if(!best.isPlayer){remember(best,a,true);if(best.state!=='flee')best.target=a;}if(best.isPlayer||a.isPlayer)tone(140,.12,'sawtooth',.15,60);if(best.hp<=0)kill(best,a);}
function attack(a){if(a.cd>0||!a.alive||a.blocking)return;const w=WEAPONS[a.weapon];if(!w)return;
 if(w.ranged){fireProj(a,w);return;}
 a.cd=w.cd;a.swing=.3;a.noise=22;
 if(!simMode)playOnce(a.fig,a.weapon==='fists'?'punch':'slash',Math.max(.35,w.cd*.9));if(a.isPlayer)tone(220,.08,'square',.08,110);
 const fx=Math.sin(a.dir),fz=Math.cos(a.dir);let best=null,bd=1e9;
 for(const e of ents){if(e===a||!e.alive||e.ghost||(a.ally&&e.ally===a.ally))continue;const dx=e.x-a.x,dz=e.z-a.z,d=Math.hypot(dx,dz);if(d>w.rng+.4)continue;if((dx*fx+dz*fz)/(d||1)<.4)continue;if(d<bd){bd=d;best=e;}}
 {const an=animalInFront(a,fx,fz,w.rng+.4,best?bd:1e9);if(an){const dmg=w.dmg*a.str*rnd(.85,1.15)*(a.ambushBonus?1.6:1);a.ambushBonus=false;if(a.isHuman){a.lastAnimal=an;a.lastAnimalT=time;}hitAnimal(an,dmg,a);return;}}
 if(!best&&a.weapon==='axe'&&a.isHuman&&chopTree(a))return;
 if(best){const dmg=w.dmg*a.str*rnd(.85,1.15)*(a.ambushBonus?1.6:1);a.ambushBonus=false;applyHit(a,best,dmg,fx,fz);}}
function nearWater(e){for(const[dx,dz]of[[0,0],[2,0],[-2,0],[0,2],[0,-2]])if(H(e.x+dx,e.z+dz)<WL)return true;return false;}
function pickup(e){// sponsor parachute first
 let bg=null,bgd=2.8;for(const g of gifts){if(!g.landed||g.opened)continue;const d=Math.hypot(g.x-e.x,g.z-e.z);if(d<bgd){bgd=d;bg=g;}}
 if(bg){openGift(e,bg);return true;}
 let best=null,bd=2.6;for(const it of items){if(!e.isHuman&&it.type==='sticks')continue;if(e.isHuman&&it.type==='sticks'&&(e.wood||0)>=WOOD_MAX)continue;const d=Math.hypot(it.x-e.x,it.z-e.z);if(d<bd){bd=d;best=it;}}
 if(best){scene.remove(best.m);items.splice(items.indexOf(best),1);itemsVer++;const t=best.type;
  if(WEAPONS[t]){if(e.weapon!=='fists'&&e.weapon!=='shield')addItem(e.weapon,e.x+.8,e.z+.8);e.weapon=t;e.ammo=WEAPONS[t].ammoN||0;if(e.isPlayer){announce('Picked up '+WEAPONS[t].n+(e.ammo?` (${e.ammo})`:''));setWeaponModel();}else if(!simMode)giveWeaponMesh(e.fig,t);}
  else if(t==='berries'){e.hunger=Math.min(100,e.hunger+20);e.hp=Math.min(e.maxhp,e.hp+5);if(e.isPlayer)announce('Ate berries');}
  else if(t==='food'){e.hunger=Math.min(100,e.hunger+45);e.hp=Math.min(e.maxhp,e.hp+10);if(e.isPlayer)announce('Ate rations');}
  else if(t==='meat'){if(e.isHuman){if((e.meat||0)<MEAT_MAX){e.meat=(e.meat||0)+1;say(e,`Raw meat (🍖 ${e.meat}) – cook it at a campfire`);}else{e.hunger=Math.min(100,e.hunger+15);say(e,'Pack full – ate raw meat (+15)');}}else{e.hunger=Math.min(100,e.hunger+30);e.hp=Math.min(e.maxhp,e.hp+6);}}
  else if(t==='sticks'){e.wood=Math.min(WOOD_MAX,(e.wood||0)+2);say(e,`Gathered sticks (🪵 ${e.wood})`);}
  else if(t==='water'){e.thirst=Math.min(100,e.thirst+50);if(e.isPlayer)announce('Drank water');}
  else if(t==='medicine'){e.hp=Math.min(e.maxhp,e.hp+55);if(e.isPlayer)announce('Used medicine (+55 HP)');}
  else if(t==='bandage'){e.hp=Math.min(e.maxhp,e.hp+25);if(e.isPlayer)announce('Applied bandage (+25 HP)');}
  else if(t==='ammo_arrow'){if(e.weapon==='bow'){e.ammo=(e.ammo||0)+8;if(e.isPlayer)announce('Arrows +8');}else{e.weapon='bow';e.ammo=8;if(e.isPlayer){announce('Bow with arrows');setWeaponModel();}else giveWeaponMesh(e.fig,'bow');}}
  else if(t==='ammo_stone'){if(e.weapon==='sling'){e.ammo=(e.ammo||0)+10;if(e.isPlayer)announce('Stones +10');}else{e.weapon='sling';e.ammo=10;if(e.isPlayer){announce('Sling with stones');setWeaponModel();}else giveWeaponMesh(e.fig,'sling');}}
  else if(t==='cloak'){e.cloak=Math.max(e.cloak||0,180);if(e.isPlayer)announce('Warm cloak — protected from cold awhile');}
  else if(t==='flask'){e.thirst=100;e.flask=Math.max(e.flask||0,1);if(e.isPlayer)announce('Sponsor flask — thirst restored');}
  if(e.isPlayer)tone(660,.1,'triangle',.15,990);return true;}
 if(nearWater(e)){e.thirst=Math.min(100,e.thirst+35);if(e.isPlayer){announce('You drink from the water');tone(500,.15,'sine',.12,300);}return true;}return false;}
function setCam(){if(player)player.fig.visible=camMode==='third'||!player.alive;fpArms.visible=camMode==='first'&&player&&player.alive;if(player)setWeaponModel();}

// ---------- input ----------
const keys={};let moveX=0,moveY=0;
addEventListener('keydown',e=>{keys[e.code]=true;if(!running||simMode)return;if(e.code==='KeyF')cmdOffer();if(e.code==='Digit1')cmdOrder('follow');if(e.code==='Digit2')cmdOrder('hold');if(e.code==='Digit3')cmdOrder('scavenge');if(e.code==='Escape'||e.code==='KeyP')togglePause();if(e.code==='KeyE')cmdUse();if(e.code==='KeyV'){camMode=camMode==='first'?'third':'first';setCam();}if(e.code==='Space')cmdJump();});
addEventListener('keyup',e=>keys[e.code]=false);
const cv=renderer.domElement;
cv.addEventListener('mousedown',()=>{if(!running||isTouch)return;if(document.pointerLockElement!==cv){cv.requestPointerLock?.();$('hint').textContent='';}else cmdAttack();});
addEventListener('mousemove',e=>{if(document.pointerLockElement===cv){yaw-=e.movementX*.0025;pitch=THREE.MathUtils.clamp(pitch-e.movementY*.0025,-1.3,1.3);}});
let lookX=0,lookY=0;
function makeJoy(el,cb){const knob=el.querySelector('.knob');let id=null;const MAX=46;
 const set=(t)=>{const r=el.getBoundingClientRect();let dx=t.clientX-(r.left+r.width/2),dy=t.clientY-(r.top+r.height/2);const l=Math.hypot(dx,dy);if(l>MAX){dx*=MAX/l;dy*=MAX/l;}knob.style.transform=`translate(${dx}px,${dy}px)`;cb(dx/MAX,dy/MAX);};
 el.addEventListener('touchstart',e=>{e.preventDefault();audio();if(id!==null)return;const t=e.changedTouches[0];id=t.identifier;set(t);},{passive:false});
 el.addEventListener('touchmove',e=>{e.preventDefault();for(const t of e.changedTouches)if(t.identifier===id)set(t);},{passive:false});
 const end=e=>{for(const t of e.changedTouches)if(t.identifier===id){id=null;knob.style.transform='';cb(0,0);}};
 el.addEventListener('touchend',end);el.addEventListener('touchcancel',end);}
makeJoy($('joyL'),(x,y)=>{moveX=x;moveY=-y;});
makeJoy($('joyR'),(x,y)=>{lookX=x;lookY=y;if(x||y)tutEvent('look');});
document.addEventListener('touchmove',e=>{if(running)e.preventDefault();},{passive:false});
document.addEventListener('gesturestart',e=>e.preventDefault());
document.addEventListener('contextmenu',e=>{if(running)e.preventDefault();});
function applyLook(dt){const dz=.12,f=v=>{const a=Math.abs(v);return a<dz?0:Math.sign(v)*Math.pow((a-dz)/(1-dz),1.5);};
 yaw-=f(lookX)*2.6*dt;pitch=THREE.MathUtils.clamp(pitch-f(lookY)*1.8*dt,-1.2,1.2);}
let atkHeld=false,blkHeld=false;
function btn(k){if(!running)return;if(k==='atk')cmdAttack();if(k==='jump')cmdJump();if(k==='use')cmdUse();if(k==='cam'){camMode=camMode==='first'?'third':'first';setCam();}}
document.querySelectorAll('#btns div').forEach(b=>{b.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();audio();if(b.dataset.b==='atk')atkHeld=true;if(b.dataset.b==='block')blkHeld=true;btn(b.dataset.b);},{passive:false});
 b.addEventListener('touchend',e=>{e.preventDefault();if(b.dataset.b==='atk')atkHeld=false;if(b.dataset.b==='block')blkHeld=false;});
 b.addEventListener('mousedown',e=>{e.stopPropagation();if(b.dataset.b==='block'){blkHeld=true;const up=()=>{blkHeld=false;removeEventListener('mouseup',up);};addEventListener('mouseup',up);}btn(b.dataset.b);});});

// ---------- AI: perception ----------
function isNight(){const p=(time/dayLen)%1;return p>.55&&p<.95;}
function remember(e,o,share){if(o.ghost)return;e.mem.set(o,{x:o.x,z:o.z,t:time});if(share&&e.ally)for(const a of ents)if(a!==e&&a.alive&&a.ally===e.ally&&Math.hypot(a.x-e.x,a.z-e.z)<35)a.mem.set(o,{x:o.x,z:o.z,t:time});}
function perceive(e){const fx=Math.sin(e.dir),fz=Math.cos(e.dir),night=isNight();
 for(const o of ents){if(o===e||!o.alive||o.ghost||o.isDummy||(e.ally&&o.ally===e.ally)||(o.isHuman&&e.peaceUntil>time&&e.peaceWith===o))continue;const dx=o.x-e.x,dz=o.z-e.z,d=Math.hypot(dx,dz);if(d>50)continue;
  let sightR=(night?15:32)*(o.isHuman?1.25-o.stl*.6:1-o.stl*.3)*(o.hiding?.5:1);
  if(camps.length&&litCampNear(o,6))sightR=night?Math.max(sightR,50):sightR*1.4;
  const noiseR=o.noise*(o.isHuman?1.2-o.stl*.7:1)*(night?1.25:1);
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
 if(e.ally>=TEAM){if(allyBeast(e))return;if(allyCamp(e))return;return allyThink(e);}
 const P=e.P,hpF=e.hp/e.maxhp,t=perceive(e),known=t?e.mem.get(t):null,dT=t?Math.hypot(known.x-e.x,known.z-e.z):1e9;
 const myP=power(e),thP=t?power(t):1,ratio=Math.min(2.5,Math.max(.25,myP/thP)),grace=time<GRACE;
 const U={};
 U.hunt=t&&!grace?P.aggr*(.35+hpF)*ratio*(t.isHuman?.8:1)*(dT<35?1:.4)*(e.weapon==='fists'&&t.weapon!=='fists'?.5:1):0;
 U.flee=t?(hpF<.3?.9:0)+P.caution*(1-hpF)*1.3+(ratio<.55?P.caution*.9:0)*(dT<20?1:.3):0;
 U.drink=Math.pow(1-e.thirst/100,2)*1.6+(e.thirst<25?1.2:0)+(e.state==='drink'&&e.thirst<92?.8:0);
 U.forage=Math.pow(1-e.hunger/100,2)*1.4+(e.hunger<22?1:0)+(e.state==='forage'&&e.hunger<85?.6:0);
 const better=it=>{if(!(it.type in WEAPONS))return false;const A=WEAPONS[it.type],B=WEAPONS[e.weapon];return (A.dmg*(A.ranged?1.3:1))>(B.dmg*(B.ranged?1.3:1));};
 const loot=nearestItem(e,better,time<60?40:70);U.loot=loot?P.loot*(e.weapon==='fists'?1:.45):0;
 U.rest=!t||dT>25?(hpF<.75?(1-hpF)*1.4*(.5+P.caution):0):0;
 U.ambush=!t&&time>GRACE?(isNight()?.32:.14)*(e.pers==='hider'||e.pers==='career'?1.4:.6):0;
 U.patrol=.28;
 if(U[e.state]!==undefined)U[e.state]+=.12; // hysteresis
 let st='patrol',bv=-1;for(const k in U)if(U[k]>bv){bv=U[k];st=k;}
 if(st!==e.state){e.state=st;e.ambushSpot=null;e.stateT=0;}
 e.target=st==='hunt'?t:null;e.threat=t;e.hiding=st==='rest'||st==='ambush';
 // choose movement goal for state
 const safeR=Math.max(STORM_MIN-4,zoneR-12-(time>STORM_START+stormJitter?(R-STORM_MIN)/STORM_DUR*25:0));
 const outside=Math.hypot(e.x,e.z)>safeR;
 if(!simMode||true)aiCamp(e,st);
 if(!(e.pers!=='spar'&&aiBeast(e,t,dT,hpF)))switch(st){
  case 'hunt':e.tx=t.alive?(Math.hypot(t.x-e.x,t.z-e.z)<12?t.x:known.x):known.x;e.tz=Math.hypot(t.x-e.x,t.z-e.z)<12?t.z:known.z;e.pace=1;break;
  case 'flee':{const ax=e.x-known.x,az=e.z-known.z,l=Math.hypot(ax,az)||1;e.tx=e.x+ax/l*20;e.tz=e.z+az/l*20;e.pace=1;break;}
  case 'drink':{if(nearWater(e)){pickup(e);e.pace=0;e.tx=e.x;e.tz=e.z;}else{const it=nearestItem(e,i=>i.type==='water',30),s=it?[it.x,it.z]:nearestShore(e);if(s){e.tx=s[0];e.tz=s[1];if(it&&Math.hypot(it.x-e.x,it.z-e.z)<2)pickup(e);}e.pace=.75;}break;}
  case 'forage':{const it=nearestItem(e,i=>i.type==='food'||i.type==='berries'||i.type==='meat',80);if(it){e.tx=it.x;e.tz=it.z;if(Math.hypot(it.x-e.x,it.z-e.z)<2)pickup(e);}else wander(e,safeR);e.pace=.7;break;}
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
function collide(e){if(e.climbing)return;for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(const o of (grid.get(gkey(Math.floor(e.x/GC)+i,Math.floor(e.z/GC)+j))||[])){const dx=e.x-o.x,dz=e.z-o.z,d2=dx*dx+dz*dz,r=o.r+.35;if(d2<r*r&&d2>1e-6){const d=Math.sqrt(d2);e.x=o.x+dx/d*r;e.z=o.z+dz/d*r;}}
 const d=Math.hypot(e.x,e.z);if(d>R-1){e.x*=(R-1)/d;e.z*=(R-1)/d;}}
function move(e,mx,mz,dt){if(e.climbing)return;const ox=e.x,oz=e.z;let sp=4.6*e.spd*(inWater(e.x,e.z)?.5:1)*(e.hunger<=0||e.thirst<=0?.7:1)*(e.grounded===false?.85:1);if(onIce(e.x,e.z)){e.iceVx=(e.iceVx||0)*0.94+mx*sp*dt*2.2;e.iceVz=(e.iceVz||0)*0.94+mz*sp*dt*2.2;e.x+=e.iceVx;e.z+=e.iceVz;}else{e.iceVx=e.iceVz=0;e.x+=mx*sp*dt;e.z+=mz*sp*dt;}collide(e);e.speed=Math.hypot(e.x-ox,e.z-oz)/dt;}
function grounded(e){const gy=Math.max(H(e.x,e.z),WL-.9);return e.y<=gy+.08&&e.vy<=.15;}
function climbable(o){return !!(o&&(o.climb||o.b===4||o.corn)&&((o.h||0)>1.1));}
function findClimb(e,needFace){const fx=Math.sin(e.dir),fz=Math.cos(e.dir);let best=null,bd=2.4;
 for(const o of obsNear(e.x+fx*.6,e.z+fz*.6)){if(!climbable(o))continue;const dx=o.x-e.x,dz=o.z-e.z,d=Math.hypot(dx,dz),reach=o.r+.95;if(d>reach||d>bd)continue;
  if(needFace){const ahead=(dx*fx+dz*fz)/(d||1);if(ahead<.2)continue;}
  bd=d;best=o;}return best;}
function startClimb(e,o){if(!o||e.climbStam<(e.isHuman?12:8))return false;const dx=e.x-o.x,dz=e.z-o.z,d=Math.hypot(dx,dz)||1;
 const hold=o.r+.42;e.x=o.x+dx/d*hold;e.z=o.z+dz/d*hold;e.climbing={o,base:Math.max(H(e.x,e.z),e.y),maxH:Math.min(o.h||3.5,e.isHuman?7.5:2.8),stam:e.climbStam};e.vy=0;e.grounded=false;
 if(e.isPlayer&&!simMode){announce('Climbing — move up/down, JUMP to drop');tone(260,.08,'triangle',.1,180);}return true;}
function endClimb(e,push){if(!e.climbing)return;const o=e.climbing.o;e.climbStam=e.climbing.stam;e.climbing=null;e.climbCd=.55;
 if(push&&o){const dx=e.x-o.x,dz=e.z-o.z,d=Math.hypot(dx,dz)||1;e.x+=dx/d*.55;e.z+=dz/d*.55;e.vy=1.6;}
 collide(e);}
function stepClimb(e,mx,mz,dt){const C=e.climbing;if(!C)return;const o=C.o;C.stam-=dt*(e.isHuman?9:14);e.climbStam=C.stam;
 if(C.stam<=0||!e.alive){endClimb(e,true);return;}
 // stick to surface
 const dx=e.x-o.x,dz=e.z-o.z,d=Math.hypot(dx,dz)||1,hold=o.r+.42;e.x=o.x+dx/d*hold;e.z=o.z+dz/d*hold;
 // forward stick = climb up, back = down; strafe slides around
 const up=mz,slide=mx;const ang=Math.atan2(dx,dz)+slide*dt*1.6;
 e.x=o.x+Math.sin(ang)*hold;e.z=o.z+Math.cos(ang)*hold;
 e.y=Math.min(C.base+C.maxH, Math.max(C.base+.1, e.y+up*2.8*dt));const lo=C.base+.15,hi=C.base+C.maxH-.05;
 if(e.y>=hi-.02&&up>.25){endClimb(e,true);e.y=hi+.35;e.vy=1.2;}
 if(e.y<=lo&&up<-.2)endClimb(e,true);
 e.vy=0;e.speed=Math.abs(up)*2.5+Math.abs(slide)*1.2;e.dir=Math.atan2(o.x-e.x,o.z-e.z); // face wall
 if(!simMode&&e.fig)setAnim(e.fig,Math.abs(up)>.1||Math.abs(slide)>.1?'walk':'idle',1.1);}
function doJump(e){if(!e||!e.alive)return false;
 if(e.climbing){endClimb(e,true);if(!simMode&&e.fig)playOnce(e.fig,'punch',.35);return true;}
 const onG=grounded(e)||(e.coyote||0)>0;if(!onG||(e.jumpCd||0)>0){
  // try start climb if facing a wall/tree
  const o=findClimb(e,true);if(o&&(e.y<=Math.max(H(e.x,e.z),WL-.9)+1.2))return startClimb(e,o);
  return false;}
 e.vy=7.6;e.jumpCd=.38;e.coyote=0;e.grounded=false;
 if(!simMode&&e.fig)playOnce(e.fig,'punch',.32);if(e.isPlayer)tone(300,.05,'square',.06,140);return true;}
function face(e,want,dt,k=8){let dd=want-e.dir;dd=Math.atan2(Math.sin(dd),Math.cos(dd));e.dir+=dd*Math.min(1,dt*k);}
function aiAct(e,dt){
 const t=e.target;e.strafeT-=dt;if(e.strafeT<=0){e.strafeT=rnd(1.2,2.8);if(Math.random()<.5)e.strafe*=-1;}
 if(e.windup>0){e.windup-=dt;if(t)face(e,Math.atan2(t.x-e.x,t.z-e.z),dt,10);if(e.windup<=0){e.cd=0;attack(e);e.recover=rnd(.35,.75);}return;}
 // shield block when threatened at close range
 if(e.weapon==='shield'&&t&&t.alive&&Math.hypot(t.x-e.x,t.z-e.z)<4){e.blocking=true;e.blockHeld=true;face(e,Math.atan2(t.x-e.x,t.z-e.z),dt,8);return;}else{e.blocking=false;e.blockHeld=false;}
 if(t&&t.alive){const dx=t.x-e.x,dz=t.z-e.z,d=Math.hypot(dx,dz),w=WEAPONS[e.weapon];
  if(w&&w.ranged&&d>3.5&&d<w.rng&&e.cd<=0&&(e.ammo>0||!w.ammoN)){face(e,Math.atan2(dx,dz),dt,10);if(Math.random()<dt*2.5)attack(e);if(d<w.rng*.55){const [sx,sz]=steerDir(e,-dx,-dz);move(e,sx*.6,sz*.6,dt);}return;}
  if(d<w.rng+3){face(e,Math.atan2(dx,dz),dt,9);const nx=dx/d,nz=dz/d;
   if(e.recover>0){e.recover-=dt;move(e,-nx*.7+(-nz)*e.strafe*.4,-nz*.7+nx*e.strafe*.4,dt*.85);return;}
   if((t.windup>0||t.swing>.15)&&Math.random()<e.P.caution*dt*6){e.recover=.4;return;} // dodge back
   if(d<=w.rng*.95&&e.cd<=0&&Math.random()<dt*(t.isHuman?2.2:3.5)){e.windup=t.isHuman?.45:.3;if(!simMode)playOnce(e.fig,e.weapon==='fists'?'punch':'slash',.55);return;}
   const want=w.rng*.8,rad=(d-want)*.9;const [sx,sz]=steerDir(e,nx*rad+(-nz)*e.strafe*.65,nz*rad+nx*e.strafe*.65);move(e,sx*.75,sz*.75,dt);return;}}
 const dx=e.tx-e.x,dz=e.tz-e.z,d=Math.hypot(dx,dz);
 if(e.detour>0){e.detour-=dt;const ddx=e.dx-e.x,ddz=e.dz-e.z,l=Math.hypot(ddx,ddz)||1;face(e,Math.atan2(ddx,ddz),dt);move(e,ddx/l*.8,ddz/l*.8,dt);return;}
 if(d>1.2&&e.pace>0){const [sx,sz]=steerDir(e,dx,dz);face(e,Math.atan2(sx,sz),dt);move(e,sx*e.pace,sz*e.pace,dt);e.wantMove=true;}else e.wantMove=false;
 e.checkT+=dt;if(e.checkT>1.5){if(e.wantMove&&Math.hypot(e.x-e.lastX,e.z-e.lastZ)<1){e.stuck=(e.stuck||0)+1;const o=findClimb(e,false);if(o&&(o.h||0)<2.8&&!e.climbing&&Math.random()<.55){startClimb(e,o);e._cmz=1;e._cmx=0;}else{const a=Math.atan2(dz,dx)+(Math.random()<.5?1.7:-1.7);e.dx=e.x+Math.cos(a)*6;e.dz=e.z+Math.sin(a)*6;e.detour=1.3;}}e.checkT=0;e.lastX=e.x;e.lastZ=e.z;}}
// ---------- per-entity update ----------
function updateEnt(e,dt){
 if(!e.alive||e.ghost)return;e.cd-=dt;e.swing=Math.max(0,e.swing-dt);e.flash=Math.max(0,e.flash-dt);e.noise=Math.max(0,e.noise-dt*20);
 e.hunger-=dt*(e.isHuman?.2:.15)*survK;e.thirst-=dt*(e.isHuman?.27:.2)*survK*thirstK;
 if(e.hunger<0){e.hunger=0;e.hp-=dt*1.5;}if(e.thirst<0){e.thirst=0;e.hp-=dt*2.5;}
 // cold (tundra): drain without fire/shelter
 if(e.cloak>0)e.cloak-=dt;if(coldK>0&&!e.isDummy&&!practice){const warm=!!litCampNear(e,5)||!!myCampNear(e,4)||(e.cloak>0);if(!warm)e.hp-=dt*coldK*(isNight()?2.2:1.1)*survK;}
 // sandstorm (desert)
 if(arenaId==='desert'&&hazActive&&!e.isDummy){const shel=!!myCampNear(e,4)||obsNear(e.x,e.z).some(o=>o.b>1&&Math.hypot(o.x-e.x,o.z-e.z)<o.r+1.2);if(!shel){e.hp-=dt*3.5*hazIntensity;e.flash=.1;}}
 if(e.isDummy)return;const out=Math.hypot(e.x,e.z)>zoneR;if(out)e.hp-=dt*8;if(e.isPlayer&&!simMode)$('danger').style.opacity=out?1:0;
 if(e.hunger>50&&e.thirst>50)e.hp=Math.min(e.maxhp,e.hp+dt*(e.hiding&&e.speed<.5?2:.6));if(camps.length&&litCampNear(e,4))e.hp=Math.min(e.maxhp,e.hp+dt*1.2);
 if(e.hp<=0)return kill(e,out?'the firestorm':e.hunger<=0||e.thirst<=0?'starvation & thirst':null);
 if(e.sleeping){if(sleepTick(e,dt)){e.speed=0;e.fig.position.set(e.x,e.y,e.z);return;}}
 if(e.isHuman&&e.meat>0&&e.hunger<20&&eatMeat(e,false))say(e,'Starving – you ate raw meat');
 e.speed=0;
 if(e.isPlayer){e.blocking=!!(blkHeld||keys.ShiftLeft||keys.ShiftRight);e.blockHeld=e.blocking;
  let mx=(keys.KeyD?1:0)-(keys.KeyA?1:0)+moveX,mz=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)+moveY;
  if(keys.ArrowLeft)yaw+=dt*2;if(keys.ArrowRight)yaw-=dt*2;const l=Math.hypot(mx,mz);if(l>1){mx/=l;mz/=l;}
  e._cmx=mx;e._cmz=mz;e.dir=yaw+Math.PI;const fx=Math.sin(e.dir),fz=Math.cos(e.dir),rx=-fz,rz=fx;
  if(e.climbing){/* stick move handled in stepClimb */}else if(l>.05){move(e,fx*mz+rx*mx,fz*mz+rz*mx,dt);tutEvent('move');}if(atkHeld&&!e.blocking&&!e.climbing)attack(e);}
 else if(e.isRemote){const I=e.inp||{};e.blocking=!!I.block;e.blockHeld=e.blocking;let mx=I.mx||0,mz=I.mz||0;const l=Math.hypot(mx,mz);if(l>1){mx/=l;mz/=l;}e._cmx=mx;e._cmz=mz;e.dir=(I.yaw||0)+Math.PI;const fx=Math.sin(e.dir),fz=Math.cos(e.dir),rx=-fz,rz=fx;if(!e.climbing&&l>.05)move(e,fx*mz+rx*mx,fz*mz+rz*mx,dt);if(I.atk&&!e.blocking&&!e.climbing)attack(e);
  e.seen=e.seen||{};for(const k of ['jump','use','offer']){if((I[k]||0)!==(e.seen[k]||0)){e.seen[k]=I[k];if(k==='jump')doJump(e);if(k==='use')pickup(e);if(k==='offer')offerAlly(null,undefined,e);}}}
 else if(e.climbing){e._cmz=1;e._cmx=0;}else{e.think-=dt;if(e.think<=0){const dp=player&&!player.ghost?Math.hypot(e.x-player.x,e.z-player.z):0;e.think=(dp<60?rnd(.25,.4):dp<140?rnd(.5,.7):rnd(.9,1.2));aiThink(e);}aiAct(e,dt);}
 if(e.speed>3.6)e.noise=Math.max(e.noise,15);else if(e.speed>.4)e.noise=Math.max(e.noise,6);
 e.jumpCd=Math.max(0,(e.jumpCd||0)-dt);e.climbCd=Math.max(0,(e.climbCd||0)-dt);
 if(!e.climbing)e.climbStam=Math.min(100,(e.climbStam||100)+dt*14);
 if(e.climbing){stepClimb(e,e._cmx||0,e._cmz||0,dt);}
 else{const gy=Math.max(H(e.x,e.z),WL-.9);const wasG=e.grounded;e.vy-=18*dt;e.y+=e.vy*dt;
  if(e.y<=gy){e.y=gy;e.vy=0;e.grounded=true;e.coyote=.14;}else{e.grounded=false;e.coyote=Math.max(0,(e.coyote||0)-dt);}
  // auto-grab ledge while rising/falling next to climbable
  if(!e.grounded&&e.vy<1.5&&!(e.climbCd>0)&&(e.isHuman||e.isPlayer)){const o=findClimb(e,true);if(o&&e.y>gy+.4&&e.y<gy+(o.h||3)*.85){const d=Math.hypot(e.x-o.x,e.z-o.z);if(d<o.r+1.05&&d>o.r*.3)startClimb(e,o);}}}
 e.fig.position.set(e.x,e.y,e.z);e.fig.rotation.y=e.dir;}
let frameNo=0;
function animateFig(e,dt){const f=e.fig,u=f.userData;if(e.isDummy){for(const m of u.mats)m.emissive.setRGB(e.flash>0?.6:0,0,0);return;}
 if(!e.alive){if(f.parent)u.mixer.update(dt);return;}
 const dist=player?Math.hypot(e.x-player.x,e.z-player.z):0;f.visible=(e.isPlayer?(camMode==='third'||!e.alive):dist<QL.fog);
 if(e.tag)e.tag.visible=!e.isPlayer&&dist<22&&f.visible;
 if(!f.visible&&!e.isPlayer)return;
 if(u.oneShot>0){u.oneShot-=dt;if(u.oneShot<=0){u.oneShot=0;endOneShot(f);}}
 const s=e.speed;if(e.climbing)setAnim(f,s>.2?'walk':'idle',1.15);else if(!e.grounded&&(e.coyote||0)<=0)setAnim(f,'run',.7);else if(s<.4)setAnim(f,'idle');else if(s<3.6)setAnim(f,'walk',Math.max(.6,s/2.2));else setAnim(f,'run',s/5);
 u.acc+=dt;const every=dist>60?3:dist>30?2:1;if(e.isPlayer||frameNo%every===0){u.mixer.update(u.acc);u.acc=0;}
 const fl=e.flash>0;for(const m of u.mats)m.emissive.setRGB(fl?.6:0,0,0);}
const STORM_SPEED=(R-STORM_MIN)/STORM_DUR;
function hazTick(dt){if(practice||simMode)return;hazT-=dt;
 if(arenaId==='desert'){if(hazT<=0){if(!hazActive&&time>50&&Math.random()<.35){hazActive=true;hazT=rnd(12,22)*hazIntensity;annAll('🌪 Sandstorm! Find shelter!');}else if(hazActive){hazActive=false;hazT=rnd(40,80);annAll('The sandstorm fades…');}else hazT=rnd(20,45);}}
 else if(arenaId==='tundra'){if(hazT<=0){if(!hazActive&&isNight()&&Math.random()<.4){hazActive=true;hazT=rnd(15,28);annAll('❄ Blizzard rolling in!');}else if(hazActive){hazActive=false;hazT=rnd(35,70);annAll('The blizzard eases.');}else hazT=rnd(25,50);}}
 else hazActive=false;}
function stormR(t){if(practice)return R;const st=STORM_START+stormJitter;return THREE.MathUtils.clamp(R-(t-st)*STORM_SPEED,STORM_MIN,R);}
function stepWorld(dt){time+=dt;nightCycle();favorTick(dt);giftTick(dt);allyTick(dt);hazTick(dt);zoneR=stormR(time);if(Math.abs(time-(STORM_START+stormJitter))<dt*.6)announce('The firestorm is closing in!');for(const e of ents)updateEnt(e,dt);stepProjs(dt);animalsStep(dt);campsStep(dt);}

// ---------- minimap ----------
const mm=$('minimap'),mx=mm.getContext('2d'),MS=240;let mk=MS/2/(R+8);
const mmBg=document.createElement('canvas');mmBg.width=mmBg.height=MS;
function redrawMinimapBg(){mk=MS/2/(R+8);const g=mmBg.getContext('2d'),img=g.createImageData(MS,MS);
 for(let py=0;py<MS;py++)for(let px=0;px<MS;px++){const x=(px-MS/2)/mk,z=(py-MS/2)/mk,i=(py*MS+px)*4;if(Math.hypot(x,z)>R){img.data[i+3]=0;continue;}
  const h=H(x,z),w=zoneW(x,z);let c;
  if(arenaId==='desert')c=h<WL?[40,100,140]:w.high>.5?[150,120,80]:[210,180,110];
  else if(arenaId==='tundra')c=h<WL?[160,190,210]:w.high>.5?[140,150,160]:w.forest>.4?[80,110,90]:[230,235,240];
  else if(arenaId==='urban')c=h<WL?[40,80,100]:w.street>.5?[60,60,65]:w.ruins>.5?[120,110,95]:[90,90,88];
  else c=h<WL?[50,110,190]:w.high>.5?[130,125,115]:w.forest>.5?[30,80,35]:w.meadow>.5?[140,170,80]:w.ruins>.5?[180,160,120]:[70,120,55];
  img.data.set([...c,230],i);}g.putImageData(img,0,0);}
let mmT=0;
function drawMinimap(){const c=MS/2;mx.clearRect(0,0,MS,MS);mx.drawImage(mmBg,0,0);
 mx.strokeStyle='#ff5522';mx.lineWidth=4;mx.beginPath();mx.arc(c,c,zoneR*mk,0,7);mx.stroke();
 mx.fillStyle='#ffd24a';mx.beginPath();mx.arc(c,c,6,0,7);mx.fill();
 mx.fillStyle='#ddd';mx.fillRect(c+RUINS.x*mk-4,c+RUINS.z*mk-4,8,8);
 for(const [x,z] of CACHES){mx.fillStyle='#c8964a';mx.fillRect(c+x*mk-3,c+z*mk-3,6,6);}
 if(player){const px=c+player.x*mk,pz=c+player.z*mk,d=player.dir;mx.save();mx.translate(px,pz);mx.rotate(-d+Math.PI);mx.fillStyle='#fff';mx.strokeStyle='#000';mx.lineWidth=2;mx.beginPath();mx.moveTo(0,-11);mx.lineTo(7,8);mx.lineTo(0,4);mx.lineTo(-7,8);mx.closePath();mx.fill();mx.stroke();mx.restore();}
 for(const a of ents)if(a.alive&&a.ally&&a.ally===myTeam()&&a!==viewer()){mx.fillStyle='#4dff6a';mx.beginPath();mx.arc(c+a.x*mk,c+a.z*mk,6,0,7);mx.fill();}
 for(const k of camps){if(!(k.owner===viewer()||(k.owner&&k.owner.ally&&k.owner.ally===myTeam())))continue;const x=c+k.x*mk,z=c+k.z*mk;mx.fillStyle=k.lit?'#ff9a2a':'#a87a4a';mx.strokeStyle='#000';mx.lineWidth=2;mx.beginPath();mx.moveTo(x,z-8);mx.lineTo(x+7,z+6);mx.lineTo(x-7,z+6);mx.closePath();mx.fill();mx.stroke();}
 mx.fillStyle='#fff';mx.font='bold 22px system-ui';mx.textAlign='center';mx.fillText('N',c,22);}

// ---------- loop ----------
const clock=new THREE.Clock(),skyDay=new THREE.Color(0xb8d0e0),skyDusk=new THREE.Color(0xd09070),skyNight=new THREE.Color(0x0a1022),fogC=new THREE.Color(),sunV=new THREE.Vector3();
function syncArenaSky(){if(!arena)return;skyDay.setHex(arena.day);skyDusk.setHex(arena.dusk);skyNight.setHex(arena.night);}
let hudT=0,fpsLog=[],fpsT=0,fpsN=0,fpsNow=0;
const envMats=[];scene.traverse(o=>{if(o.material&&o.material.isMeshStandardMaterial)envMats.push([o.material,o.material.envMapIntensity]);});
let lastEnv=-1;function envScale(k){if(Math.abs(k-lastEnv)<.03)return;lastEnv=k;for(const[m,b]of envMats)m.envMapIntensity=b*k;}
function updateSky(){const p=(time/dayLen)%1,a=p*Math.PI*2+.8,elev=Math.sin(a);
 sunV.set(Math.cos(a)*.8,elev,.45).normalize();su.sunPosition.value.copy(sunV);
 const day=sstep(-.12,.35,elev);fogC.copy(skyNight).lerp(skyDusk,sstep(-.15,.05,elev)).lerp(skyDay,sstep(.05,.35,elev));
 if(hazActive&&arenaId==='desert'){fogC.lerp(new THREE.Color(0xc8a060),.55);scene.fog.near=8;scene.fog.far=Math.min(scene.fog.far,70);}else if(hazActive&&arenaId==='tundra'){fogC.lerp(new THREE.Color(0xd0dae8),.5);scene.fog.near=10;scene.fog.far=Math.min(QL.fog*.7,110);}else{scene.fog.near=25;scene.fog.far=QL.fog*(arena&&arena.fogFar||1)*(arenaId==='urban'&&isNight()?.55:1);}
 scene.fog.color.copy(fogC);
 const moon=elev<0,L=moon?sunV.clone().negate():sunV;sun.intensity=moon?.35:2.6*day;sun.color.setHex(moon?0x8aa4ff:0xfff0d8);hemi.intensity=.12+.55*day;
 renderer.toneMappingExposure=.35+.6*day;envScale(.15+.85*day);
 const c=player||{x:0,z:0,y:0};sun.position.set(c.x+L.x*80,c.y+Math.max(.15,L.y)*80,c.z+L.z*80);sun.target.position.set(c.x,c.y,c.z);
 if(water.material.uniforms&&water.material.uniforms.sunDirection)water.material.uniforms.sunDirection.value.copy(L);}
function loop(){requestAnimationFrame(loop);const dt=Math.min(clock.getDelta(),.05);frameNo++;
 if(renderer.domElement.style.display==='none'||simMode)return;
 if(homeActive){homeOrbit(dt);return;}
 if(running){applyLook(dt);if(NET.role==='client')clientStep(dt);else if(!paused||NET.role==='host'){stepWorld(dt);if(player&&player.sleeping&&!NET.role)for(let i=0;i<5&&player.sleeping&&running;i++)stepWorld(dt);if(NET.role==='host')hostTick(dt);}}
 zoneMesh.scale.set(zoneR,1,zoneR);
 for(const e of ents)animateFig(e,dt);animateAnimals(dt);campsVisual(dt);
 updateSky();grassU.time.value+=dt;
 if(water.material.uniforms&&water.material.uniforms.time)water.material.uniforms.time.value+=dt*.5;else if(simpleWaterMat){wnorm.offset.x+=dt*.01;wnorm.offset.y+=dt*.006;}
 zoneMesh.material.opacity=.22+.08*Math.sin(time*3);
 if(player){updateChunks(player.x,player.z);const hy=player.y+1.62*(CHARS[sel].scale||1);
  if(camMode==='first'&&player.alive){camera.position.set(player.x,hy,player.z);camera.rotation.set(pitch,yaw,0,'YXZ');}
  else{const back=4.2,cx=player.x+Math.sin(yaw)*back*Math.cos(pitch),cz=player.z+Math.cos(yaw)*back*Math.cos(pitch),cy=hy+.5-Math.sin(pitch)*back;camera.position.set(cx,Math.max(H(cx,cz)+.4,cy),cz);camera.lookAt(player.x,hy+.1,player.z);
   if(!player.alive){camera.position.y+=1.5;camera.lookAt(player.x,player.y,player.z);}}
  const sw=player.swing>0?Math.sin((1-player.swing/.3)*Math.PI):0;fpArms.rotation.x=.1-sw*.9;fpArms.position.z=-.5-sw*.15;
  fpArms.position.y=-.3+(player.speed>.5?Math.sin(time*11)*.012:0);}
 hudT-=dt;if(hudT<=0&&player){hudT=.2;$('hp').style.width=Math.max(0,player.hp/player.maxhp*100)+'%';$('hu').style.width=player.hunger+'%';$('th').style.width=player.thirst+'%';if($('favor'))$('favor').style.width=Math.max(0,Math.min(100,player.favor||0))+'%';
  $('weap').textContent='Weapon: '+WEAPONS[player.weapon].n+(player.ammo?` · ${player.ammo}`:'')+(player.blocking?' · 🛡':'');$('inv').textContent=`🪵 Wood ${player.wood||0}  ·  🍖 Raw meat ${player.meat||0}`;$('dayl').textContent=`${practice?'Practice · ':''}${arena?arena.tag+' ':''}#${arenaCode(ARENA_SEED)} · Day ${Math.floor(time/dayLen)+1} · ${isNight()?'Night 🌙':'Day ☀'}${hazActive?(arenaId==='desert'?' · 🌪':arenaId==='tundra'?' · ❄':''):''} · ${Math.round(fpsNow)} fps${NET.role==='client'?` · ping ${NET.ping|0}ms`:NET.role==='host'?` · hosting ${NET.conns.length}`:''}`;
  $('zonename').textContent=zoneName(player.x,player.z);drawMinimap();
  let near=items.some(it=>Math.hypot(it.x-player.x,it.z-player.z)<2.6);const nearGift=running&&player&&gifts.some(g=>g.landed&&!g.opened&&Math.hypot(g.x-player.x,g.z-player.z)<2.8);const climbP=running&&player&&!player.climbing&&findClimb(player,true);$('hint').textContent=nearGift?(isTouch?'Tap GRAB — sponsor gift':'Press E — open sponsor gift'):player&&player.climbing?(isTouch?'Stick up/down to climb · JUMP to drop':'W/S climb · Space to drop'):climbP?(isTouch?'JUMP to climb':'Space / JUMP to climb'):running&&near?(isTouch?'Tap GRAB to pick up':'Press E to pick up'):running&&nearWater(player)?(isTouch?'Tap GRAB to drink':'Press E to drink'):(!isTouch&&running&&document.pointerLockElement!==cv?'Click to lock mouse':'');updateAllyUI();}
 for(const it of items)if(it.type in WEAPONS)it.m.rotation.y+=dt*.8;
 if(composer)composer.render();else renderer.render(scene,camera);
 fpsN++;const nowT=performance.now()/1000;if(!fpsT)fpsT=nowT;if(nowT-fpsT>=2){fpsNow=fpsN/(nowT-fpsT);fpsLog.push(fpsNow);fpsT=nowT;fpsN=0;
  if(running&&qSetting==='auto'&&fpsNow<28&&pixelRatio>.7){pixelRatio=Math.max(.7,pixelRatio-.2);renderer.setPixelRatio(pixelRatio);composer=null;}
  else if(running&&qSetting==='auto'&&fpsNow>55&&pixelRatio<Math.min(devicePixelRatio,QL.pr)){pixelRatio=Math.min(Math.min(devicePixelRatio,QL.pr),pixelRatio+.1);renderer.setPixelRatio(pixelRatio);}}}
loop();

// ---------- headless sim harness ----------
function runSim(maxSec=1200,opts={},dt=.1){startGame({sim:true,...opts});const stuckLog={};let t0=performance.now();const samples=[];
 while(running&&time<maxSec){stepWorld(dt);if(Math.floor(time)%60===0&&Math.abs(time-Math.round(time))<dt/2)samples.push({t:Math.round(time),alive:alive().length,zoneR:Math.round(zoneR),states:alive().reduce((a,e)=>(a[e.state]=(a[e.state]||0)+1,a),{})});}
 for(const e of ents)if(!e.isPlayer)stuckLog[e.name]=e.stuck||0;
 const r={simSeconds:Math.round(time),wallMs:Math.round(performance.now()-t0),winner:winner?`${winner.name} D${winner.d} (${winner.pers}, ${winner.kills} kills)`:null,aliveAtEnd:alive().length,deaths,samples,stuckEvents:stuckLog,animalKills:animalKills.reduce((o,k)=>(o[k.kind]=(o[k.kind]||0)+1,o),{}),animalsAlive:animals.filter(a=>a.alive).length,muttReleases};
 simMode=false;running=false;ents.forEach(e=>scene.remove(e.fig));ents=[];clearAnimals();return r;}
window.__game={setMove:(x,y)=>{moveX=x;moveY=y;},camDirs:()=>{const f=new THREE.Vector3();camera.getWorldDirection(f);f.y=0;f.normalize();return {f:[f.x,f.z],r:[-f.z,f.x]};},
 tp:(x,z,yw)=>{player.x=x;player.z=z;player.y=H(x,z);player.fig.position.set(x,player.y,z);if(yw!==undefined){yaw=yw;player.dir=yw+Math.PI;player.fig.rotation.y=player.dir;}},get player(){return player},get ents(){return ents},setCam:m=>{camMode=m;setCam();},get fps(){return fpsLog},quality:qName,get pr(){return pixelRatio},swing:()=>{player.swing=.3;},
 dbgWeap:()=>{const u=player.fig.userData;if(!u.weap)return 'none';player.fig.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(u.weap),ws=new THREE.Vector3();u.hand.getWorldScale(ws);return JSON.stringify({min:b.min.toArray().map(v=>v.toFixed(2)),max:b.max.toArray().map(v=>v.toFixed(2)),p:[player.x.toFixed(1),player.y.toFixed(2),player.z.toFixed(1)],ws:ws.toArray()});},offerAlly:(e,force)=>offerAlly(e,force),allyChance:e=>allyChance(e),cand:()=>{const c=allyCandidate();return c?c.name:null},setOrder,get allies(){return teamAllies()},step:s=>{for(let t=0;t<s;t+=.05)stepWorld(.05);},kill:(e,by)=>kill(e,by),get announcements(){return annLog},runSim,setTime:t=>{time=t;},sel:i=>{sel=i;},chunks:()=>chunks.filter(c=>c.m.visible).length+'/'+chunks.length,counts:{obstacles:obstacles.length,shore:SHORE.length}};

// ---------- alliances (leader = any human tribute) ----------
const TEAM=99,MAX_ALLIES=3;let onlyOneAnnounced=false,allyCand=null,betrayT=0;
function myTeam(){return player?player.ally:0;}
function viewer(){return player;}
function humans(){return ents.filter(e=>e.isHuman&&e.alive&&!e.ghost);}
function say(h,text){if(!h||h.isPlayer)announce(text);else if(h.conn)netSend(h.conn,{t:'ann',text});}
function teamAllies(h=player){return h?ents.filter(e=>e.alive&&e.ally&&e.ally===h.ally&&!e.isHuman):[];}
let lastCand=null,lastCandT=0;
function allyCandidate(h=player){if(!h||!h.alive)return null;let best=null,bd=8;for(const e of ents){if(e===h||!e.alive||e.isDummy||e.ally&&e.ally===h.ally)continue;const d=Math.hypot(e.x-h.x,e.z-h.z);if(d>=bd)continue;
 if(e.target===h&&e.state==='hunt')continue;if(h.lastHit===e&&time-h.lastHitT<8)continue;
 const fx=Math.sin(e.dir),fz=Math.cos(e.dir);if(!e.isHuman&&d>5.5&&((h.x-e.x)*fx+(h.z-e.z)*fz)/d<.2)continue;if(!LOS(e.x,e.z,h.x,h.z))continue;bd=d;best=e;}
 if(h.isPlayer){if(best){lastCand=best;lastCandT=time;}else if(lastCand&&lastCand.alive&&lastCand.ally!==h.ally&&time-lastCandT<2.5&&Math.hypot(lastCand.x-h.x,lastCand.z-h.z)<9)best=lastCand;}return best;}
function allyChance(e,h=player){const base={hider:.75,scavenger:.65,hunter:.18,career:.08,spar:.8}[e.pers]??.3;let c=base;
 if(e.pers==='career'&&([1,2,4].includes(h.d)||power(h)>power(e)*1.2))c=.6;
 if(h.weapon!=='fists')c+=.12;c+=Math.min(.2,h.kills*.06);c+=(h.hp/h.maxhp-.5)*.3;
 const n=alive().length;if(n<=8)c-=.2;if(n<=5)c-=.3;if(e.hitByPlayer&&e.lastHitBy===h)c-=.6;else if(e.hitByPlayer)c-=.3;if(e.ally===1&&allianceOn)c-=.15;
 if(power(h)<power(e)*.5)c-=.1;return Math.max(0,Math.min(.95,c));}
function bubble(e,text,col='#222'){if(simMode)return;const c=document.createElement('canvas');c.width=320;c.height=72;const x=c.getContext('2d');x.fillStyle='rgba(255,255,255,.92)';x.beginPath();x.roundRect(6,4,308,52,14);x.fill();x.beginPath();x.moveTo(150,56);x.lineTo(160,70);x.lineTo(170,56);x.fill();
 x.fillStyle=col;x.font='bold 28px system-ui';x.textAlign='center';x.fillText(text,160,40);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:false,fog:false}));s.scale.set(2.2,.5,1);s.position.y=e.fig.userData.h+1;e.fig.add(s);setTimeout(()=>{e.fig.remove(s);s.material.map.dispose();},2500);
 if(NET.role==='host')netBroadcast({t:'bub',i:ents.indexOf(e),text,col});}
function joinTeam(e,h){if(h.isPlayer)tutEvent('ally');h.favor=Math.min(100,(h.favor||0)+12);e.ally=h.ally;e.leader=h;e.mem.delete(h);e.target=null;e.state='follow';e.peaceUntil=0;refreshTag(e);}
function offerAlly(target,force,h=player){if(!h||!h.alive)return {ok:false};const e=target||allyCandidate(h);if(!e){return {ok:false,why:'nobody'};}
 if(e.isHuman){ // human-to-human offer: ask them
  if(e.isPlayer)showHumanOffer(h);else if(e.conn)netSend(e.conn,{t:'offer',from:ents.indexOf(h),name:h.name});say(h,`Alliance offer sent to ${e.name}.`);return {ok:true,pending:true};}
 if(teamAllies(h).length>=MAX_ALLIES){say(h,'You already have 3 allies.');return {ok:false,why:'max'};}
 if((e.askCd||{})[ents.indexOf(h)]>time){say(h,`${e.name} is ignoring you for now.`);return {ok:false,why:'cooldown'};}
 e.askCd=e.askCd||{};e.askCd[ents.indexOf(h)]=time+25;const ch=allyChance(e,h),roll=force??Math.random();
 if(roll<ch){joinTeam(e,h);const l=pick(['Deal.','Together, then.','I\'ve got your back.','Fine. Stay close.']);bubble(e,l,'#187a2c');say(h,`${e.name} (D${e.d}) joined you: "${l}"`);if(h.isPlayer)tone(520,.12,'triangle',.15,780);return {ok:true,chance:ch};}
 const l=pick(['Not a chance.','Get lost.','I work alone.','Nice try.']);bubble(e,l,'#a01818');
 const angry=Math.random()<e.P.aggr*.7;if(angry&&time>GRACE){remember(e,h);e.target=h;e.state='hunt';e.askCd[ents.indexOf(h)]=time+60;say(h,`${e.name}: "${l}" — they turn on you!`);}else say(h,`${e.name}: "${l}"`);
 return {ok:false,why:'declined',chance:ch,angry};}
function acceptHumanOffer(fromIdx,toEnt){const h=ents[fromIdx];if(!h||!h.alive||!toEnt.alive)return;const old=toEnt.ally;for(const e of ents)if(e.alive&&old&&e.ally===old&&e!==toEnt){e.ally=h.ally;if(!e.isHuman)e.leader=e.leader;refreshTag(e);}toEnt.ally=h.ally;refreshTag(toEnt);for(const e of ents)refreshTag(e);
 announce(`${h.name} and ${toEnt.name} formed an alliance!`);if(NET.role==='host')netBroadcast({t:'ann',text:`${h.name} and ${toEnt.name} formed an alliance!`});}
function showHumanOffer(h){const box=$('offerBox');box.innerHTML=`<div>${h.name} offers an alliance</div><button id="offYes">Accept</button><button id="offNo">Decline</button>`;box.classList.remove('hidden');
 const done=y=>{box.classList.add('hidden');if(NET.role==='client')netSend(NET.conn,{t:'offerReply',from:NET.pendingFrom,yes:y});else if(y)acceptHumanOffer(ents.indexOf(h),player);};
 $('offYes').onclick=()=>done(true);$('offNo').onclick=()=>done(false);setTimeout(()=>box.classList.add('hidden'),12000);}
function setOrder(o,h=player){h.order=o;for(const a of teamAllies(h))a.holdAt=o==='hold'?[a.x,a.z]:null;say(h,'Allies: '+({follow:'Follow me',hold:'Hold here',scavenge:'Go scavenge'}[o]));if(h.isPlayer)updateAllyUI(true);}
function dismissAlly(e,h=player){if(!e||e.ally!==h.ally||e.isHuman)return;e.ally=0;e.leader=null;e.peaceUntil=time+90;e.peaceWith=h;e.mem.delete(h);e.state='patrol';const a=Math.atan2(e.z-h.z,e.x-h.x);e.tx=e.x+Math.cos(a)*40;e.tz=e.z+Math.sin(a)*40;refreshTag(e);bubble(e,'Good luck.');say(h,`You parted ways with ${e.name}.`);if(h.isPlayer)updateAllyUI(true);}
function betray(e,why){const h=e.leader||player;e.ally=0;e.leader=null;remember(e,h);e.target=h;e.state='hunt';e.ambushBonus=true;refreshTag(e);bubble(e,'Sorry. Only one wins.','#a01818');say(h,`${e.name} has betrayed you!${why?' ('+why+')':''}`);if(h.isPlayer&&!simMode)tone(200,.4,'sawtooth',.2,90);if(h.isPlayer)updateAllyUI(true);}
function checkTeamEnd(){if(onlyOneAnnounced||practice)return;const al=alive();if(al.length>1&&al[0].ally&&al.every(e=>e.ally===al[0].ally)&&al.some(e=>e.isHuman)){onlyOneAnnounced=true;
 for(const e of al){e.ally=0;e.leader=null;refreshTag(e);}for(const e of al)if(!e.isHuman){const h=al.find(x=>x.isHuman);remember(e,h);e.target=h;e.state='hunt';}
 announce('Only one can win! Your alliance dissolves.');if(NET.role==='host')netBroadcast({t:'ann',text:'Only one can win! Alliances dissolve.'});updateAllyUI(true);}}
function allyTick(dt){betrayT-=dt;const doBetray=betrayT<=0;if(doBetray)betrayT=10;
 for(const h of humans()){const team=teamAllies(h);if(!team.length)continue;h.shareT=(h.shareT??rnd(45,90))-dt;
  if(h.shareT<=0){h.shareT=rnd(45,90);const a=pick(team);if(Math.hypot(a.x-h.x,a.z-h.z)<15){if(h.hunger<65&&a.hunger>55){h.hunger=Math.min(100,h.hunger+20);a.hunger-=10;say(h,`${a.name} gave you berries`);}else if(h.thirst<65&&a.thirst>55){h.thirst=Math.min(100,h.thirst+20);a.thirst-=10;say(h,`${a.name} shared some water`);}}}
  if(doBetray&&!practice){const n=alive().length;for(const a of team){const tr={career:.55,hunter:.5,scavenger:.35,hider:.2}[a.pers]??.3;let p=0;if(n<=4)p=tr;else if(n<=7)p=tr*.12;if(a.hunger<15&&a.thirst<15)p+=.08;if(Math.random()<p){betray(a,n<=4?'only '+n+' left':'desperate');break;}}}}
 checkTeamEnd();}
function allyThink(e){const h=e.leader&&e.leader.alive&&e.leader.ally===e.ally?e.leader:humans().find(x=>x.ally===e.ally);if(!h){e.ally=0;refreshTag(e);return;}e.leader=h;
 const hpF=e.hp/e.maxhp;perceive(e);
 let threat=null,bd=26;for(const o of ents){if(!o.alive||o.ghost||o.isDummy||o.ally&&o.ally===e.ally)continue;const d=Math.hypot(o.x-e.x,o.z-e.z);if(d>bd)continue;
  if(o.target===h||o.target===e||(h.lastHit===o&&time-h.lastHitT<8)||(h.lastAttacker===o&&time-h.lastAttackT<8)){bd=d;threat=o;}}
 e.hiding=false;const dp=Math.hypot(h.x-e.x,h.z-e.z),order=h.order||'follow';
 if(threat&&time>GRACE&&hpF>.2){e.state='hunt';e.target=threat;remember(e,threat);e.tx=threat.x;e.tz=threat.z;e.pace=1;return;}
 e.target=null;
 if(e.thirst<30){e.state='drink';if(nearWater(e)){pickup(e);e.pace=0;}else{const s=nearestShore(e);if(s){e.tx=s[0];e.tz=s[1];}e.pace=.8;}return;}
 if(e.hunger<30||order==='scavenge'){const it=nearestItem(e,i=>(i.type==='food'||i.type==='berries'||i.type==='meat'||(i.type in WEAPONS&&WEAPONS[i.type].dmg>WEAPONS[e.weapon].dmg)),order==='scavenge'?45:30);
  if(it&&Math.hypot(it.x-h.x,it.z-h.z)<60){e.state='forage';e.tx=it.x;e.tz=it.z;e.pace=.8;if(Math.hypot(it.x-e.x,it.z-e.z)<2)pickup(e);return;}}
 if(order==='hold'){if(!e.holdAt)e.holdAt=[e.x,e.z];e.state='hold';e.tx=e.holdAt[0];e.tz=e.holdAt[1];e.pace=.6;return;}
 const idx=teamAllies(h).indexOf(e),side=[1,-1,0][idx]??1,ang=h.dir+Math.PI+side*.95,dist=idx===2?6:4.5;
 e.state='follow';e.tx=h.x+Math.sin(ang)*dist;e.tz=h.z+Math.cos(ang)*dist;e.pace=dp>14?1:dp>6?.8:.5;}
// ---------- alliance UI ----------
let allyUIKey='';
function updateAllyUI(force){if(simMode)return;const me=viewer();if(!me)return;
 const cand=NET.role==='client'?(NET.cand>=0?ents[NET.cand]:null):allyCandidate();if(cand)tutEvent('allyNear');allyCand=cand;
 const team=teamAllies(me);
 const ab=$('allyBtn');if(ab)ab.classList.toggle('hidden',!(running&&cand&&(team.length<MAX_ALLIES||cand.isHuman)));
 if(cand&&running&&!isTouch&&$('hint').textContent==='')$('hint').textContent=`Press F to offer ${cand.name} an alliance`;
 const order=(NET.role==='client'?NET.order:player.order)||'follow';
 const key=team.map(a=>a.name).join()+order;const panel=$('allies');panel.classList.toggle('hidden',!running||!team.length);
 if(force||key!==allyUIKey){allyUIKey=key;panel.innerHTML=`<div class="ah">Allies</div>`+team.map(a=>`<div class="ar"><span>${a.name} D${a.d}</span><div class="ab"><i data-hp="${a.name}"></i></div><b data-dis="${a.name}">✕</b></div>`).join('')+
  `<div class="ao">${['follow','hold','scavenge'].map((o,i)=>`<button data-o="${o}" class="${order===o?'on':''}">${['Follow','Hold','Scavenge'][i]}${isTouch?'':' ('+(i+1)+')'}</button>`).join('')}</div>`;
  panel.querySelectorAll('[data-o]').forEach(b=>{const f=ev=>{ev.preventDefault();ev.stopPropagation();cmdOrder(b.dataset.o);};b.addEventListener('touchstart',f,{passive:false});b.addEventListener('click',f);});
  panel.querySelectorAll('[data-dis]').forEach(b=>{const f=ev=>{ev.preventDefault();ev.stopPropagation();cmdDismiss(b.dataset.dis);};b.addEventListener('touchstart',f,{passive:false});b.addEventListener('click',f);});}
 for(const a of team){const i=panel.querySelector(`[data-hp="${a.name}"]`);if(i)i.style.width=Math.max(0,a.hp/a.maxhp*100)+'%';}}
function cmdOffer(){if(NET.role==='client')NET.inp.offer=(NET.inp.offer||0)+1;else offerAlly();}
function cmdOrder(o){if(NET.role==='client'){netSend(NET.conn,{t:'order',o});NET.order=o;updateAllyUI(true);}else setOrder(o);}
function cmdDismiss(name){if(NET.role==='client')netSend(NET.conn,{t:'dismiss',name});else{const a=teamAllies().find(t=>t.name===name);if(a)dismissAlly(a);}}
{const ab=$('allyBtn');const f=ev=>{ev.preventDefault();ev.stopPropagation();audio();if(running)cmdOffer();};ab.addEventListener('touchstart',f,{passive:false});ab.addEventListener('mousedown',f);}

// ---------- modes, home screen, pause, tutorial ----------
let practice=false,survK=1,paused=false,homeActive=true,gameMode='solo',modelsReady=false,homeT=0;
function hideGameUI(){['hud','count','cross','mapwrap','pauseBtn','touch','btns','allies','allyBtn','campBtn','aidBtn','campMenu','sleepOv','tut','offerBox','pauseMenu'].forEach(s=>$(s).classList.add('hidden'));$('danger').style.opacity=0;}
function showHome(){fpArms.visible=false;running=false;paused=false;practice=false;clearWorld();player=null;hideGameUI();['select','end','online','arena'].forEach(s=>{const el=$(s);if(el)el.classList.add('hidden');});$('home').classList.remove('hidden');homeActive=true;renderer.domElement.style.display='block';if(document.pointerLockElement)document.exitPointerLock();}
function homeOrbit(dt){homeT+=dt;time=40;const a=homeT*.05,r=70;camera.position.set(Math.cos(a)*r,26+H(Math.cos(a)*r,Math.sin(a)*r),Math.sin(a)*r);camera.lookAt(0,4,0);updateChunks(camera.position.x*.5,camera.position.z*.5);updateSky();grassU.time.value+=dt;
 if(water&&water.material.uniforms&&water.material.uniforms.time)water.material.uniforms.time.value+=dt*.5;if(zoneMesh)zoneMesh.scale.set(R,1,R);if(composer)composer.render();else renderer.render(scene,camera);}
function goSelect(mode){gameMode=mode;homeActive=false;$('home').classList.add('hidden');$('select').classList.remove('hidden');renderer.domElement.style.display='none';$('start').textContent=mode==='practice'?'Start Practice':'Enter the Arena';}
$('mPractice').onclick=()=>{audio();goSelect('practice');};$('mSolo').onclick=()=>{audio();goSelect('solo');};$('mOnline').onclick=()=>{audio();openOnline();};
$('sBack').onclick=()=>showHome();$('endHome').onclick=()=>{netClose();showHome();};
function onReady(){const room=new URLSearchParams(location.search).get('room');if(room){openOnline();$('oCode').value=room.toUpperCase();setTimeout(()=>$('oJoin').click(),300);}}
function togglePause(){if(!running&&!paused)return;paused=!paused;$('pauseMenu').classList.toggle('hidden',!paused);$('pauseNote').textContent=NET.role?'Online matches keep running while this menu is open.':'';if(paused&&document.pointerLockElement)document.exitPointerLock();}
{const pb=$('pauseBtn');const f=ev=>{ev.preventDefault();ev.stopPropagation();togglePause();};pb.addEventListener('touchstart',f,{passive:false});pb.addEventListener('click',f);}
$('pResume').onclick=()=>togglePause();$('pQuit').onclick=()=>{netClose();showHome();};
const TUT=[['move','Move: '+(isTouch?'drag the left joystick':'W A S D')],['look','Look around: '+(isTouch?'drag the right joystick':'move the mouse (click to lock it)')],['hit','Attack: '+(isTouch?'tap ATK':'left click')+' — hit a straw dummy to the east'],
 ['jump','Jump: '+(isTouch?'tap JUMP':'Space')+' — near a tree, rock, or wall, JUMP starts a climb'],['grab','Grab: '+(isTouch?'tap GRAB':'press E')+' near weapons and food, or at water to drink'],['cam','Camera: '+(isTouch?'tap CAM':'press V')+' to switch first/third person'],
 ['ally','Allies: walk up to a sparring tribute and '+(isTouch?'tap 🤝 ALLY':'press F')+'. Give orders in the Allies panel'+(isTouch?'':' (1/2/3)')],['map','Minimap (top right): white arrow = you, gold = Cornucopia, red ring = firestorm, green = allies. Pause with II'+(isTouch?'':' or P')+'.']];
let tutI=-1;function startTutorial(){tutI=0;showTut();}
function showTut(){if(tutI<0||tutI>=TUT.length){$('tut').classList.add('hidden');tutI=-1;return;}$('tut').classList.remove('hidden');$('tutText').innerHTML=`<b>Step ${tutI+1}/${TUT.length}</b><br>${TUT[tutI][1]}`;$('tutNext').textContent=tutI===TUT.length-1?'Done':'Next';}
function tutEvent(k){if(tutI>=0&&TUT[tutI][0]===k){tutI++;setTimeout(showTut,400);}}
$('tutNext').onclick=()=>{tutI++;showTut();};$('tutSkip').onclick=()=>{tutI=-1;showTut();};
function cmdAttack(){if(NET.role==='client'){NET.inp.atkUntil=performance.now()+150;return;}attack(player);}
function cmdJump(){tutEvent('jump');if(NET.role==='client'){NET.inp.jump=(NET.inp.jump||0)+1;return;}doJump(player);}
function cmdUse(){tutEvent('grab');if(NET.role==='client'){NET.inp.use=(NET.inp.use||0)+1;return;}pickup(player);}
addEventListener('keydown',e=>{if(e.code==='KeyV')tutEvent('cam');});document.querySelector('#btns [data-b="cam"]').addEventListener('touchstart',()=>tutEvent('cam'));
addEventListener('mousemove',()=>{if(document.pointerLockElement)tutEvent('look');});
const _al=applyLook;
// ---------- ONLINE (PeerJS WebRTC, host-authoritative) ----------
const NET={role:null,peer:null,conns:[],conn:null,lobby:[],code:'',me:null,inp:{},ping:0,cand:-1,order:'follow',snapT:0,inT:0,pingT:0,myChar:0,pendingFrom:-1};
function netSend(c,m){try{if(c&&c.open)c.send(m);}catch(e){}}
function netBroadcast(m){for(const c of NET.conns)netSend(c,m);}
function netClose(){try{NET.conns.forEach(c=>c.close());NET.conn&&NET.conn.close();NET.peer&&NET.peer.destroy();}catch(e){}NET.role=null;NET.peer=null;NET.conns=[];NET.conn=null;NET.lobby=[];}
function loadPeer(){return window.Peer?Promise.resolve():new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';s.onload=res;s.onerror=()=>rej(new Error('Could not load PeerJS'));document.head.appendChild(s);});}
function oStatus(t){$('oStatus').textContent=t;}
function openOnline(){homeActive=false;['home','select'].forEach(s=>$(s).classList.add('hidden'));$('online').classList.remove('hidden');renderer.domElement.style.display='none';
 $('oName').value=$('oName').value||localStorage.getItem('ta_name')||'';renderOChars();renderLobby();}
function renderOChars(){$('oChars').innerHTML=CHARS.map((c,i)=>`<button data-c="${i}" class="${i===NET.myChar?'on':''}">${c.name.split(' ')[0]} D${c.d}</button>`).join('');
 $('oChars').querySelectorAll('button').forEach(b=>b.onclick=()=>{NET.myChar=+b.dataset.c;renderOChars();if(NET.role==='client')netSend(NET.conn,{t:'char',char:NET.myChar});if(NET.role==='host'){NET.lobby[0].char=NET.myChar;pushLobby();}});}
function myName(){const n=($('oName').value||'').trim().slice(0,14)||CHARS[NET.myChar].name.split(' ')[0];localStorage.setItem('ta_name',n);return n;}
function renderLobby(){const L=NET.lobby;$('oLobby').innerHTML=L.length?`<b>Room ${NET.code}</b> · ${L.length}/6 players · AI fills to 24<div style="opacity:.75;font-size:12px;margin:4px 0">Biome rolls when the host starts (Wilds / Desert / Tundra / Urban)</div>`+L.map((p,i)=>`<div>${i===0?'👑 ':'• '}${p.name} — ${CHARS[p.char].name} (D${CHARS[p.char].d})</div>`).join(''):'';
 $('oStart').classList.toggle('hidden',NET.role!=='host');$('oCopy').classList.toggle('hidden',!NET.code);}
function pushLobby(){renderLobby();netBroadcast({t:'lobby',players:NET.lobby.map(p=>({name:p.name,char:p.char})),code:NET.code});}
function inviteLink(){return location.origin+location.pathname+'?room='+NET.code;}
$('oCopy').onclick=()=>{const l=inviteLink();(navigator.clipboard?navigator.clipboard.writeText(l):Promise.reject()).then(()=>oStatus('Invite link copied: '+l)).catch(()=>oStatus('Share this link: '+l));if(navigator.share&&isTouch)navigator.share({title:'Tribute Arena',url:l}).catch(()=>{});};
$('oBack').onclick=()=>{netClose();showHome();};
$('oHost').onclick=async()=>{audio();netClose();oStatus('Connecting to matchmaking…');try{await loadPeer();}catch(e){return oStatus(e.message);}
 const code=Array.from({length:5},()=>'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*31)]).join('');
 const peer=new Peer('tribarena-'+code,{debug:0});NET.peer=peer;
 peer.on('open',()=>{NET.role='host';NET.code=code;NET.lobby=[{name:myName(),char:NET.myChar,conn:null}];oStatus('Room ready. Share the code or link.');pushLobby();});
 peer.on('error',e=>oStatus('Network error: '+(e.type||e.message)));
 peer.on('connection',c=>{c.on('open',()=>{if(running||NET.lobby.length>=6){netSend(c,{t:'full'});setTimeout(()=>c.close(),300);return;}NET.conns.push(c);});
  c.on('data',m=>hostOnData(c,m));c.on('close',()=>hostOnClose(c));c.on('error',()=>hostOnClose(c));});};
$('oJoin').onclick=async()=>{audio();const code=($('oCode').value||'').trim().toUpperCase();if(code.length<4)return oStatus('Enter the room code.');netClose();oStatus('Connecting…');
 try{await loadPeer();}catch(e){return oStatus(e.message);}
 const peer=new Peer(undefined,{debug:0});NET.peer=peer;
 peer.on('error',e=>oStatus(e.type==='peer-unavailable'?'Room not found.':'Network error: '+(e.type||e.message)));
 peer.on('open',()=>{const c=peer.connect('tribarena-'+code,{reliable:true});NET.conn=c;
  const to=setTimeout(()=>{if(!c.open)oStatus('Could not reach host (strict network/firewall?).');},15000);
  c.on('open',()=>{clearTimeout(to);NET.role='client';NET.code=code;oStatus('Joined! Waiting for host to start…');netSend(c,{t:'hello',name:myName(),char:NET.myChar});});
  c.on('data',m=>clientOnData(m));c.on('close',()=>clientHostLeft());});};
$('oStart').onclick=()=>{if(NET.role!=='host')return;hostStart();};
function hostOnData(c,m){const L=NET.lobby;let p=L.find(x=>x.conn===c);
 if(m.t==='hello'){if(!p){p={name:m.name,char:m.char|0,conn:c};L.push(p);}pushLobby();return;}
 if(m.t==='char'&&p){p.char=m.char|0;pushLobby();return;}
 if(m.t==='ping'){netSend(c,{t:'pong',ts:m.ts});return;}
 if(m.t==='camp'&&p&&p.ent){if(m.a==='wake')wakeUp(p.ent,'');else campAction(p.ent,m.a);return;}
 if(m.t==='aid'&&p&&p.ent){const was=player;player=p.ent;requestAid();player=was;return;}
 const e=p&&p.ent;if(!e)return;
 if(m.t==='in'){e.inp=m;}
 else if(m.t==='order')setOrder(m.o,e);
 else if(m.t==='dismiss'){const a=teamAllies(e).find(t=>t.name===m.name);if(a)dismissAlly(a,e);}
 else if(m.t==='offerReply'){if(m.yes)acceptHumanOffer(m.from,e);else say(ents[m.from],`${e.name} declined your alliance.`);}}
function hostOnClose(c){NET.conns=NET.conns.filter(x=>x!==c);const p=NET.lobby.find(x=>x.conn===c);if(!p)return;NET.lobby=NET.lobby.filter(x=>x!==p);
 if(p.ent&&p.ent.alive){const e=p.ent;e.isRemote=false;e.isHuman=false;e.conn=null;e.pers='hunter';e.P=PERS.hunter;e.ally=0;e.state='patrol';refreshTag(e);announce(`${e.name} disconnected — an AI takes over`);netBroadcast({t:'ann',text:`${e.name} disconnected — an AI takes over`});}
 if(!running)pushLobby();}
function entInit(e){return {name:e.name,d:e.d,look:e.look,maxhp:e.maxhp,ally:e.ally,human:e.isHuman,weapon:e.weapon,dummy:!!e.isDummy};}
function hostStart(){sel=NET.myChar;const biome=ARENAS[Math.floor(Math.random()*ARENAS.length)].id,seed=(Math.random()*0xffffffff)|0;
 const remotes=NET.lobby.slice(1).map(p=>({name:p.name,char:p.char,conn:p.conn}));startGame({remotes,myName:NET.lobby[0].name,biome,seed});player.name=NET.lobby[0].name;refreshTag(player);
 remotes.forEach((r,i)=>{NET.lobby[i+1].ent=r.ent;});const init=ents.map(entInit);
 for(const p of NET.lobby.slice(1))netSend(p.conn,{t:'start',biome:arenaId,seed:ARENA_SEED,me:ents.indexOf(p.ent),ents:init,items:items.map(i=>[i.id,i.type,+i.x.toFixed(2),+i.z.toFixed(2)]),time});NET.sentVer=itemsVer;}
function q(v,k=100){return Math.round(v*k)/k;}
function hostTick(dt){NET.snapT-=dt;if(NET.snapT>0||!NET.conns.length)return;NET.snapT=1/12;
 const E=ents.map(e=>[q(e.x),q(e.z),q(e.y),q(e.dir),Math.round(e.hp),q(e.speed,10),e.alive?1:0,WI.indexOf(e.weapon),e.swing>.2?1:0,e.ally||0,e.flash>0?1:0]);
 const base={t:'s',time:q(time,10),zr:q(zoneR,10),e:E,a:animalSnap(),c:campSnap(),g:giftSnap()};if(NET.sentVer!==itemsVer){base.items=items.map(i=>[i.id,i.type,q(i.x),q(i.z)]);NET.sentVer=itemsVer;}
 for(const p of NET.lobby.slice(1)){const e=p.ent;if(!e)continue;const c=allyCandidate(e);netSend(p.conn,{...base,me:{hu:Math.round(e.hunger),th:Math.round(e.thirst),cand:c?ents.indexOf(c):-1,order:e.order||'follow',wd:e.wood||0,mt:e.meat||0,sl:e.sleeping?1:0,kills:e.kills,ammo:e.ammo|0,bl:e.blocking?1:0,fv:Math.round(e.favor||0)}});}}
// ---- client side ----
function clientOnData(m){
 if(m.t==='lobby'){NET.lobby=m.players;NET.code=m.code;renderLobby();return;}
 if(m.t==='full'){oStatus('Room is full or already playing.');return;}
 if(m.t==='pong'){NET.ping=performance.now()-m.ts;return;}
 if(m.t==='start')return clientStart(m);
 if(m.t==='s')return clientSnap(m);
 if(m.t==='ann'){announce(m.text);if(m.cannon)cannon();return;}
 if(m.t==='anthem'){if(NET.role==='client')playAnthem(true);return;}
 if(m.t==='bub'){const e=ents[m.i];if(e)bubble(e,m.text,m.col);return;}
 if(m.t==='offer'){NET.pendingFrom=m.from;showHumanOffer({name:m.name});return;}
 if(m.t==='dead'){if(player){player.alive=false;camMode='third';setCam();endGame(false,m.by?{name:m.by}:null);}return;}
 if(m.t==='over'){const win=player&&m.winner===player.name&&player.alive;if(win)endGame(true);else if(player&&player.alive){announce(`${m.winner} won the Games!`);endGame(false,{name:m.winner+' (winner)'});}}}
function clientStart(m){if(m.biome){rebuildArena(m.biome,m.seed|0);syncArenaSky();}
 clearWorld();items.forEach(i=>scene.remove(i.m));items=[];for(const [id,t,x,z] of m.items)addItem(t,x,z,id);
 practice=false;survK=1;homeActive=false;time=m.time;
 ents=m.ents.map((c,i)=>{if(c.dummy)return null;const e=makeEnt({name:c.name,d:c.d,hp:c.maxhp,spd:1,str:1,stl:.5,look:c.look,weapon:c.weapon,ally:c.ally,remote:c.human&&i!==m.me},i===m.me);e.ally=c.ally;e.isHuman=c.human;if(e.tag)refreshTag(e);return e;}).filter(Boolean);
 player=ents[m.me];NET.me=player;const ch=CHARS.findIndex(c=>c.model===player.look.model);sel=ch>=0?ch:0;sleeveMat.color.setHex(CHARS[sel].c);
 for(const e of ents)if(e.tag)refreshTag(e);
 showGameUI();setCam();announce(`${arena.tag} ${arena.name} · Arena #${arenaCode(ARENA_SEED)}`);}
function clientSnap(m){time=m.time;zoneR=m.zr;NET.lastSnap=performance.now();if(NET.role==="client")nightCycle();
 m.e.forEach((a,i)=>{const e=ents[i];if(!e)return;const [x,z,y,dir,hp,sp,al,wi,sw,ally,fl]=a;
  if(!e.net){e.x=x;e.z=z;e.y=y;e.dir=dir;}e.net={x,z,y,dir};e.hp=hp;e.speed=sp;if(fl)e.flash=.15;
  if(e.alive&&!al){e.alive=false;const u=e.fig.userData;u.oneShot=0;playOnce(e.fig,'death',1.2);u.oneShot=99;if(e.tag)e.tag.visible=false;}
  const w=WI[wi]||'fists';if(w!==e.weapon){e.weapon=w;if(e===player)setWeaponModel();else giveWeaponMesh(e.fig,w);}
  if(sw&&!e.netSw)playOnce(e.fig,w==='fists'?'punch':'slash',.5);e.netSw=sw;if(sw&&e===player)player.swing=.3;
  if((e.ally||0)!==ally){e.ally=ally;for(const o of ents)refreshTag(o);}});
 if(m.items){const keep=new Set(m.items.map(i=>i[0]));for(const it of items.slice())if(!keep.has(it.id)){scene.remove(it.m);items.splice(items.indexOf(it),1);}const have=new Set(items.map(i=>i.id));for(const [id,t,x,z] of m.items)if(!have.has(id))addItem(t,x,z,id);}
 if(m.me&&player){player.hunger=m.me.hu;player.thirst=m.me.th;NET.cand=m.me.cand;NET.order=m.me.order;player.kills=m.me.kills;player.wood=m.me.wd;player.meat=m.me.mt;if(m.me.ammo!=null)player.ammo=m.me.ammo;player.blocking=!!m.me.bl;player.blockHeld=player.blocking;if(m.me.fv!=null)player.favor=m.me.fv;if(!m.me.sl&&player.sleeping)$('sleepOv').classList.add('hidden');player.sleeping=!!m.me.sl;}
 if(m.a)clientAnimals(m.a);if(m.c)clientCamps(m.c);if(m.g)clientGifts(m.g);
 updateCount();}
function clientStep(dt){if(NET.lastSnap&&performance.now()-NET.lastSnap>20000){clientHostLeft();return;}const k=Math.min(1,dt*12);for(const e of ents){if(!e.net)continue;e.x+=(e.net.x-e.x)*k;e.z+=(e.net.z-e.z)*k;e.y+=(e.net.y-e.y)*k;let dd=e.net.dir-e.dir;dd=Math.atan2(Math.sin(dd),Math.cos(dd));e.dir+=dd*k;
  e.flash=Math.max(0,(e.flash||0)-dt);e.swing=Math.max(0,(e.swing||0)-dt);e.fig.position.set(e.x,e.y,e.z);e.fig.rotation.y=e.dir;}
 clientAnimalStep(dt);if(player&&player.alive)player.dir=yaw+Math.PI;
 NET.inT-=dt;if(NET.inT<=0){NET.inT=.05;const mx=(keys.KeyD?1:0)-(keys.KeyA?1:0)+moveX,mz=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)+moveY;
  netSend(NET.conn,{t:'in',mx:q(mx),mz:q(mz),yaw:q(yaw,1000),atk:(atkHeld||performance.now()<(NET.inp.atkUntil||0))?1:0,block:(blkHeld||keys.ShiftLeft||keys.ShiftRight)?1:0,jump:NET.inp.jump||0,use:NET.inp.use||0,offer:NET.inp.offer||0});}
 NET.pingT-=dt;if(NET.pingT<=0){NET.pingT=2;netSend(NET.conn,{t:'ping',ts:performance.now()});}}
function clientHostLeft(){if(NET.role!=='client')return;NET.role=null;NET.lastSnap=0;const wasPlaying=running;running=false;hideGameUI();clearWorld();
 $('end').classList.remove('hidden');$('endTitle').textContent='HOST LEFT';$('endTitle').style.color='#e33';$('final').textContent='The host closed the match.';$('retry').classList.add('hidden');$('newchar').classList.add('hidden');netClose();}

renderer.domElement.style.display='block';fpArms.visible=false;
addEventListener('beforeunload',()=>{try{NET.peer&&NET.peer.destroy()}catch(e){}});

// ---------- wildlife ----------
const AK={
 rabbit:{prey:1,hp:14,spd:5.6,h:.45,meat:1,n:'Rabbit'},
 deer:{prey:1,hp:45,spd:6.4,h:1.65,meat:2,model:'Deer',run:'Gallop',atk:'Attack_Headbutt',n:'Deer'},
 boar:{prey:1,fights:1,hp:75,spd:5.6,h:.95,meat:2,dmg:11,cd:1.1,rng:1.7,model:'Boar',run:'Run',atk:'Headbutt',tint:{AtlasMaterial:0x5a5550},n:'Wild boar'},
 wolf:{pred:1,hp:55,spd:6.9,h:1.0,meat:1,dmg:9,cd:1.15,rng:1.8,model:'Wolf',run:'Gallop',atk:'Attack',tint:{Main:0x8a8580,Main_Light:0xb8b2a8},n:'Wolf'},
 bear:{pred:1,hp:230,spd:5.4,h:1.45,meat:3,dmg:24,cd:1.6,rng:2.4,model:'Wolf',run:'Gallop',atk:'Attack',tint:{Main:0x4a2e1a,Main_Light:0x6e4a2e,Nose:0x111111},bulk:1.35,n:'Bear'},
 mutt:{pred:1,mutt:1,hp:70,spd:7.2,h:1.2,meat:1,dmg:10,cd:1.0,rng:1.9,model:'Wolf',run:'Gallop',atk:'Attack',tint:{Main:0x1c1c22,Main_Light:0x34343e},eyes:1,n:'Mutt'}};
const KI=Object.keys(AK);
const CAPS={rabbit:10,deer:6,boar:4,wolf:6,bear:1};
let animals=[],animalId=0,respawnT=0,muttReleases=0,muttNight=-1,animalKills=[];
function findClip(anims,n){return anims.find(c=>c.name===n)||anims.find(c=>c.name.endsWith('|'+n));}
function animalFig(kind){const K=AK[kind],root=new THREE.Group();
 if(!K.model){const fur=new THREE.MeshStandardMaterial({color:arena&&arena.animalTint==='arctic'?pick([0xe8eef4,0xd8e0ea,0xc8d0dc]):pick([0x9a8670,0x7d6a55,0xb5a58f]),roughness:.95}),wht=new THREE.MeshStandardMaterial({color:0xeeeeee,roughness:.9});
  const body=new THREE.Mesh(new THREE.SphereGeometry(.2,10,8),fur);body.scale.set(1,.85,1.35);body.position.y=.2;
  const head=new THREE.Mesh(new THREE.SphereGeometry(.12,10,8),fur);head.position.set(0,.33,.22);
  const e1=new THREE.Mesh(new THREE.CapsuleGeometry(.03,.16,3,6),fur);e1.position.set(.05,.5,.18);e1.rotation.x=-.3;const e2=e1.clone();e2.position.x=-.05;
  const tail=new THREE.Mesh(new THREE.SphereGeometry(.06,6,5),wht);tail.position.set(0,.24,-.27);
  const g=new THREE.Group();g.add(body,head,e1,e2,tail);g.traverse(o=>{if(o.isMesh)o.castShadow=true;});root.add(g);
  root.userData={hop:g,mats:[fur],acts:{},mixer:null,cur:'idle'};return root;}
 const src=MODELS[K.model],obj=SkeletonUtils.clone(src.scene);root.add(obj);const k=K.h/src.h;obj.scale.set(k*(K.bulk||1),k*(K.bulk||1),k);const mats=[];
 obj.traverse(n=>{if(n.isMesh){n.castShadow=true;n.frustumCulled=false;n.material=n.material.clone();const m=n.material;if(K.tint&&K.tint[m.name]!==undefined)m.color.multiply(new THREE.Color(K.tint[m.name])).multiplyScalar(K.model==='Boar'?.9:2.2);
  if(K.eyes&&/Eye/.test(m.name)){m.color.set(0xff2a00);m.emissive=new THREE.Color(0xff2000);m.emissiveIntensity=3;}else m.emissive=new THREE.Color(0);
  if(arena&&arena.animalTint==='arctic'&&!K.mutt){if(/Main|Atlas|Bunny/.test(m.name))m.color.lerp(new THREE.Color(0xe8eef5),.65);if(/Main_Light|Main_Dark/.test(m.name))m.color.lerp(new THREE.Color(0xd0d8e0),.5);}
  mats.push(m);}});
 if(K.eyes){const em=new THREE.MeshBasicMaterial({color:0xff3010});for(const s of [-1,1]){const p=new THREE.Mesh(new THREE.SphereGeometry(.045,6,5),em);p.position.set(s*.09,K.h*.78,K.h*.62);root.add(p);}}
 const mixer=new THREE.AnimationMixer(obj),acts={};const map={idle:'Idle',walk:'Walk',run:K.run,attack:K.atk,death:'Death',eat:'Eating'};
 for(const kk in map){const c=findClip(src.animations,map[kk]);if(!c)continue;const a=mixer.clipAction(c);acts[kk]=a;if(kk==='attack'||kk==='death'){a.setLoop(THREE.LoopOnce);a.clampWhenFinished=true;}else{a.play();a.setEffectiveWeight(kk==='idle'?1:0);}}
 root.userData={mats,acts,mixer,cur:'idle',one:0,acc:0};return root;}
function aAnim(a,name,sp=1){const u=a.fig.userData;if(!u.mixer||!u.acts[name])return;if(u.one>0&&name!=='death')return;
 if(name==='attack'||name==='death'){const ac=u.acts[name],from=u.acts[u.cur];ac.reset();ac.enabled=true;ac.setEffectiveWeight(1);ac.setEffectiveTimeScale(name==='attack'?1.4:1);ac.play();if(from&&from!==ac)from.crossFadeTo(ac,.12,false);u.cur=name;u.one=name==='death'?99:ac.getClip().duration/1.4;return;}
 if(u.cur!==name){const from=u.acts[u.cur],to=u.acts[name];to.enabled=true;to.setEffectiveTimeScale(1);to.setEffectiveWeight(1);if(!to.isRunning())to.play();if(from)from.crossFadeTo(to,.25,true);u.cur=name;}u.acts[name].setEffectiveTimeScale(sp);}
function makeAnimal(kind,x,z,o={}){const K=AK[kind];const a={id:o.id??animalId++,kind,K,x,z,y:H(x,z),dir:rnd(0,6.28),hp:K.hp,maxhp:K.hp,alive:true,speed:0,flash:0,cd:0,think:rnd(0,1),tx:x,tz:z,pace:0,state:'idle',target:null,fleeT:0,angryT:0,home:[x,z],pack:o.pack||0,windup:0,swing:0,atkT:0,deadT:0,isAnimal:true,born:time,stuckT:0,lx:x,lz:z};
 a.fig=simMode?null:animalFig(kind);if(a.fig){a.fig.position.set(x,a.y,z);scene.add(a.fig);}animals.push(a);return a;}
function clearAnimals(){for(const a of animals)if(a.fig)scene.remove(a.fig);animals=[];respawnT=0;muttReleases=0;muttNight=-1;animalKills=[];}
function humansNear(x,z,r){return ents.some(e=>e.alive&&!e.ghost&&e.isHuman&&Math.hypot(e.x-x,e.z-z)<r);}
function zoneSpot(kind,tries=40){for(let i=0;i<tries;i++){let x,z;
  if(kind==='bear'){const ang=rnd(0,6.28),r=rnd(6,22);x=CAVE.x+Math.cos(ang)*r;z=CAVE.z+Math.sin(ang)*r;}
  else{const ang=rnd(0,6.28),r=Math.sqrt(Math.random())*(R-12);x=Math.cos(ang)*r;z=Math.sin(ang)*r;}
  if(inWater(x,z)||Math.hypot(x,z)>Math.min(R-8,zoneR-8)||Math.hypot(x,z)<35)continue;if(obsNear(x,z).some(o=>Math.hypot(o.x-x,o.z-z)<o.r+1))continue;
  const w=zoneW(x,z);const ok={rabbit:w.meadow>.25||(w.forest<.3&&w.high<.3)||w.dune>.3||Math.random()<.4,deer:w.meadow>.25||w.forest>.25||Math.random()<.35,boar:w.forest>.3||w.ruins>.4||Math.random()<.25,wolf:w.forest>.3||w.high>.35||w.ruins>.4||Math.random()<.3,bear:true}[kind];
  if(ok)return [x,z];}return null;}
function spawnKind(kind,avoid=55){if(kind==='wolf'){const s=zoneSpot('wolf');if(!s||humansNear(s[0],s[1],avoid))return 0;const pk=animalId+1;let n=0;for(let i=0;i<3;i++){const x=s[0]+rnd(-3,3),z=s[1]+rnd(-3,3);if(!inWater(x,z)){makeAnimal('wolf',x,z,{pack:pk});n++;}}return n;}
 const s=zoneSpot(kind);if(!s||humansNear(s[0],s[1],avoid))return 0;makeAnimal(kind,s[0],s[1]);return 1;}
function spawnAnimals(){clearAnimals();const tab=arena&&arena.animals?arena.animals:CAPS;if(practice){for(let i=0;i<4;i++)makeAnimal('rabbit',rnd(-30,30),rnd(26,40));makeAnimal('deer',-28,30);makeAnimal('deer',-34,24);return;}
 for(const k of ['rabbit','deer','boar','bear']){const n=tab[k]|0;for(let i=0;i<n;i++)spawnKind(k,25);}const wn=Math.max(0,tab.wolf|0);for(let i=0;i<Math.ceil(wn/3);i++)spawnKind('wolf',40);}
function annAll(t){announce(t);if(NET.role==='host')netBroadcast({t:'ann',text:t});}
function tributes(){return ents.filter(e=>e.alive&&!e.ghost&&!e.isDummy);}
function animalThink(a){const K=a.K,night=isNight();let near=null,nd=1e9;
 for(const o of ents){if(!o.alive||o.ghost||o.isDummy)continue;const d=Math.hypot(o.x-a.x,o.z-a.z);if(d<nd){nd=d;near=o;}}
 const outside=Math.hypot(a.x,a.z)>zoneR-6;
 if(K.prey){let det=0;if(near){const st=1-(near.stl||.5)*.4;det=(night?6:11)*st+near.noise*.75*st;}
  if(K.fights&&a.angryT>time&&a.target&&a.target.alive){a.state='charge';a.tx=a.target.x;a.tz=a.target.z;a.pace=1;return;}
  if(K.fights&&near&&nd<3.2&&near.speed>.4&&Math.random()<.35){a.target=near;a.angryT=time+5;a.state='charge';return;} // cornered
  if(near&&(nd<det||a.fleeT>time)){if(nd<det)a.fleeT=time+rnd(2.5,4.5);a.state='flee';const ax=a.x-near.x,az=a.z-near.z,l=Math.hypot(ax,az)||1;let tx=a.x+ax/l*18,tz=a.z+az/l*18;if(Math.hypot(tx,tz)>zoneR-8||inWater(tx,tz)){const t2=a.x-az/l*18,z2=a.z+ax/l*18;tx=t2;tz=z2;}a.tx=tx;a.tz=tz;a.pace=1;a.target=null;return;}
  a.target=null;if(outside){a.tx=a.x*.6;a.tz=a.z*.6;a.pace=.6;a.state='walk';return;}
  if(Math.random()<.45){a.state='graze';a.pace=0;}else{const ang=rnd(0,6.28),r=rnd(5,14);const x=a.x+Math.cos(ang)*r,z=a.z+Math.sin(ang)*r;if(!inWater(x,z)&&Math.hypot(x,z)<zoneR-8){a.tx=x;a.tz=z;a.pace=.35;a.state='walk';}}return;}
 // predators
 if(a.hp<a.maxhp*.22&&!K.mutt&&a.kind!=='bear'){a.state='flee';if(near){const ax=a.x-near.x,az=a.z-near.z,l=Math.hypot(ax,az)||1;a.tx=a.x+ax/l*25;a.tz=a.z+az/l*25;}a.pace=1;a.target=null;return;}
 let range=K.mutt?400:a.kind==='bear'?14:night?40:16;let tgt=null,td=range;
 if(a.target&&a.target.alive&&!a.target.ghost&&(a.angryT>time||Math.hypot(a.target.x-a.x,a.target.z-a.z)<range*1.4))tgt=a.target,td=0;
 if(!tgt)for(const o of ents){if(!o.alive||o.ghost||o.isDummy)continue;const d=Math.hypot(o.x-a.x,o.z-a.z)*(o.hiding?1.6:1)*(1+(o.stl||.5)*.3)*(camps.length&&litCampNear(o,6)?(a.kind==='wolf'?3:.55):1);if(d<td){td=d;tgt=o;}}
 if(a.kind==='bear'&&tgt&&!(a.angryT>time)&&Math.hypot(tgt.x-a.home[0],tgt.z-a.home[1])>34)tgt=null; // territorial
 if(tgt){a.target=tgt;a.state='chase';a.tx=tgt.x;a.tz=tgt.z;a.pace=K.mutt||night||a.kind==='bear'?1:.85;
  if(a.pack)for(const b of animals)if(b!==a&&b.alive&&b.pack===a.pack&&!(b.target&&b.target.alive))b.target=tgt; return;}
 a.target=null;
 if(a.kind==='bear'&&Math.hypot(a.x-a.home[0],a.z-a.home[1])>20){a.tx=a.home[0];a.tz=a.home[1];a.pace=.5;a.state='walk';return;}
 if(a.pack){const lead=animals.find(b=>b.alive&&b.pack===a.pack);if(lead&&lead!==a&&Math.hypot(lead.x-a.x,lead.z-a.z)>5){a.tx=lead.x+rnd(-3,3);a.tz=lead.z+rnd(-3,3);a.pace=.6;a.state='walk';return;}}
 if(outside){a.tx=a.x*.6;a.tz=a.z*.6;a.pace=.6;a.state='walk';return;}
 if(Math.random()<.4){a.state='idle';a.pace=0;}else{const ang=rnd(0,6.28),r=rnd(6,20),x=a.x+Math.cos(ang)*r,z=a.z+Math.sin(ang)*r;if(!inWater(x,z)&&Math.hypot(x,z)<zoneR-8){a.tx=x;a.tz=z;a.pace=night?.55:.35;a.state='walk';}}}
function hurtEnt(t,dmg,a){if(!t.alive||t.ghost)return;if(t.isDummy)return;t.hp-=dmg*(t.isHuman?.75:1);t.flash=.2;const l=Math.hypot(t.x-a.x,t.z-a.z)||1;t.x+=(t.x-a.x)/l*.5;t.z+=(t.z-a.z)/l*.5;collide(t);t.beast=a;t.beastT=time;
 if(t.isPlayer){tone(120,.15,'sawtooth',.18,50);}if(!simMode&&player&&Math.hypot(a.x-player.x,a.z-player.z)<30)tone(a.kind==='bear'?70:180,.25,'sawtooth',.12,a.kind==='bear'?40:90);
 if(t.hp<=0)kill(t,{name:a.K.mutt?'Gamemaker mutts':a.kind==='wolf'?'a wolf pack':'a '+a.K.n.toLowerCase()});}
function animalAttack(a,dt){const K=a.K,t=a.target;if(!t||!t.alive)return false;const dx=t.x-a.x,dz=t.z-a.z,d=Math.hypot(dx,dz);
 if(a.windup>0){a.windup-=dt;face(a,Math.atan2(dx,dz),dt,10);if(a.windup<=0){if(d<K.rng+.8)hurtEnt(t,K.dmg*rnd(.8,1.2)*(K.mutt&&!t.isHuman?.7:1),a);a.cd=K.cd;}return true;}
 if(d<K.rng&&a.cd<=0){a.windup=.35;a.swing=.4;if(a.fig)aAnim(a,'attack');return true;}
 if(d<K.rng*.8){face(a,Math.atan2(dx,dz),dt,10);return true;}return false;}
function animalMove(a,dt){const dx=a.tx-a.x,dz=a.tz-a.z,d=Math.hypot(dx,dz);a.speed=0;if(d<1||a.pace<=0)return;
 const [sx,sz]=steerDir(a,dx,dz);const night=isNight();let sp=a.K.spd*a.pace*(a.pace<.7?.45:1)*(a.kind==='wolf'&&night?1.12:1);if(a.state==='flee'&&a.K.prey){a.tire=(a.tire||0)+dt;if(a.tire>6)sp*=.45;}else a.tire=Math.max(0,(a.tire||0)-dt*.5);
 const ox=a.x,oz=a.z;let nx=a.x+sx*sp*dt,nz=a.z+sz*sp*dt;if(inWater(nx,nz)&&!inWater(a.x,a.z)){a.tx=a.x-dx;a.tz=a.z-dz;return;}a.x=nx;a.z=nz;collide(a);face(a,Math.atan2(sx,sz),dt,7);a.speed=Math.hypot(a.x-ox,a.z-oz)/dt;}
function hitAnimal(a,dmg,by){if(!a.alive)return;a.hp-=dmg;a.flash=.2;const l=Math.hypot(a.x-by.x,a.z-by.z)||1;a.x+=(a.x-by.x)/l*.5;a.z+=(a.z-by.z)/l*.5;by.noise=Math.max(by.noise||0,22);
 if(by.isPlayer){tone(300,.08,'square',.1,200);if(!simMode&&a.alive)bubble(a,Math.round(dmg)+'','#a01818');}
 if(a.K.prey&&!a.K.fights){a.fleeT=time+5;a.think=0;}else{a.target=by;a.angryT=time+(a.K.fights?7:12);a.think=0;}
 if(a.hp<=0)killAnimal(a,by);}
function killAnimal(a,by){a.alive=false;a.deadT=time;a.speed=0;if(a.fig)aAnim(a,'death');
 for(let i=0;i<a.K.meat;i++){const ang=rnd(0,6.28);addItem('meat',a.x+Math.cos(ang)*.6,a.z+Math.sin(ang)*.6);}
 animalKills.push({t:Math.round(time),kind:a.kind,by:by?by.name:'?'});if(by&&by.isPlayer){announce(`You killed a ${a.K.n.toLowerCase()}${a.K.meat?' – grab the meat!':''}`);}
 else if(by&&by.isHuman&&by.conn)netSend(by.conn,{t:'ann',text:`You killed a ${a.K.n.toLowerCase()} – grab the meat!`});}
function animalInFront(att,fx,fz,rng,maxD){let best=null,bd=maxD;for(const a of animals){if(!a.alive)continue;const dx=a.x-att.x,dz=a.z-att.z,d=Math.hypot(dx,dz)-(a.K.h>1.2?.6:0);if(d>rng+.3||d>=bd)continue;if((dx*fx+dz*fz)/(Math.hypot(dx,dz)||1)<.35&&d>.8)continue;bd=d;best=a;}return best;}
function releaseMutts(){muttReleases++;const T=tributes();if(!T.length)return;const hs=T.filter(e=>e.isHuman);const focus=hs.length?pick(hs):pick(T);
 annAll('⚠ Attention, tributes! The Gamemakers have released the mutts. Run!');if(!simMode)tone(70,1.6,'sawtooth',.3,140);
 const n=Math.max(1,Math.round((1+Math.min(3,muttReleases))*(arena&&arena.muttMul||1)));for(let i=0;i<n;i++){for(let k=0;k<20;k++){const ang=rnd(0,6.28),r=rnd(30,45);const x=focus.x+Math.cos(ang)*r,z=focus.z+Math.sin(ang)*r;if(inWater(x,z)||Math.hypot(x,z)>zoneR-4)continue;const m=makeAnimal('mutt',x,z);m.target=focus;m.angryT=time+30;break;}}}
function animalsStep(dt){if(practice&&animals.some(a=>a.K.pred))return;
 const night=isNight(),day=Math.floor(time/dayLen);
 if(!practice&&running){if(night&&day>=1&&muttReleases<3&&muttNight!==day&&(day>=2||Math.random()<.5*dt/10)){muttNight=day;releaseMutts();}
  else if(!night&&muttNight!==-2&&tributes().length<=6&&muttReleases<2&&time>200){muttNight=-2;releaseMutts();}}
 respawnT-=dt;if(respawnT<=0){respawnT=25;const cnt={};for(const a of animals)if(a.alive)cnt[a.kind]=(cnt[a.kind]||0)+1;
  if(practice){if((cnt.rabbit||0)<4)makeAnimal('rabbit',rnd(-30,30),rnd(26,40));if((cnt.deer||0)<2)makeAnimal('deer',-30,28);}
  else for(const k of ['rabbit','deer','boar','wolf','bear']){if((cnt[k]||0)<(k==='wolf'?CAPS.wolf-2:CAPS[k])&&Math.random()<(k==='bear'?.15:.5)){spawnKind(k);break;}}}
 for(let i=animals.length-1;i>=0;i--){const a=animals[i];
  if(!a.alive){if(time-a.deadT>7){if(a.fig)scene.remove(a.fig);animals.splice(i,1);}continue;}
  if(Math.hypot(a.x,a.z)>zoneR+3){a.hp-=dt*10;if(a.hp<=0){a.alive=false;a.deadT=time;if(a.fig)aAnim(a,'death');continue;}}
  if(a.K.mutt&&time-a.born>100&&!humansNear(a.x,a.z,40)){if(a.fig)scene.remove(a.fig);animals.splice(i,1);continue;}
  a.cd-=dt;a.flash=Math.max(0,a.flash-dt);a.swing=Math.max(0,a.swing-dt);
  const dp=player&&!player.ghost?Math.hypot(a.x-player.x,a.z-player.z):0;
  a.think-=dt;if(a.think<=0){a.think=dp<60?rnd(.25,.45):rnd(.8,1.4);animalThink(a);}
  const fear=a.kind==='wolf'&&a.state==='chase'&&a.target&&camps.length?litCampNear(a.target,7):null;
  if(fear){const ax=a.x-fear.x,az=a.z-fear.z,l=Math.hypot(ax,az)||1;if(l<9){a.tx=fear.x+ax/l*11;a.tz=fear.z+az/l*11;a.pace=.8;}else{a.tx=a.x-az/l*3;a.tz=a.z+ax/l*3;a.pace=.4;}animalMove(a,dt);}
  else if((a.state==='chase'||a.state==='charge')&&a.target&&a.target.alive){a.tx=a.target.x;a.tz=a.target.z;if(animalAttack(a,dt)){a.speed=0;}else animalMove(a,dt);}
  else animalMove(a,dt);
  a.y=Math.max(H(a.x,a.z),WL-.6);if(a.fig){a.fig.position.set(a.x,a.y,a.z);a.fig.rotation.y=a.dir;}}}
function animateAnimals(dt){for(const a of animals){if(!a.fig)continue;const u=a.fig.userData;const dist=player?Math.hypot(a.x-player.x,a.z-player.z):0;a.fig.visible=dist<QL.fog;if(!a.fig.visible)continue;
 if(u.hop){const h=u.hop;if(!a.alive){h.rotation.z=Math.min(1.5,(h.rotation.z||0)+dt*4);h.position.y=0;}else if(a.speed>.3){u.ph=(u.ph||0)+dt*a.speed*2.2;h.position.y=Math.abs(Math.sin(u.ph))*.22;h.rotation.x=Math.cos(u.ph)*.2;}else{h.position.y*=.8;h.rotation.x=0;}}
 else{if(u.one>0&&u.one<90){u.one-=dt;if(u.one<=0){u.one=0;const ac=u.acts[u.cur],to=u.acts.idle;to.enabled=true;to.setEffectiveWeight(1);to.play();ac.crossFadeTo(to,.15,false);u.cur='idle';}}
  if(a.alive&&u.one<=0){const s=a.speed;if(s<.3)aAnim(a,a.state==='graze'&&u.acts.eat?'eat':'idle');else if(s<3.2)aAnim(a,'walk',Math.max(.6,s/1.8));else aAnim(a,'run',Math.max(.7,s/a.K.spd*1.1));}
  u.acc+=dt;const every=dist>50?3:dist>25?2:1;if(frameNo%every===0){u.mixer.update(u.acc);u.acc=0;}}
 const fl=a.flash>0;for(const m of u.mats)if(m.emissive&&!(a.K.eyes&&/Eye/.test(m.name)))m.emissive.setRGB(fl?.6:0,0,0);}}
// AI tributes vs wildlife
function aiBeast(e,t,dT,hpF){let pred=null,pd=1e9;for(const a of animals){if(!a.alive||!a.K.pred&&!(a.K.fights&&a.target===e))continue;const d=Math.hypot(a.x-e.x,a.z-e.z);if(d>16)continue;if(a.target===e||d<9){if(d<pd){pd=d;pred=a;}}}
 if(pred){const strong=e.weapon!=='fists'||pred.kind==='wolf'||pred.kind==='boar';if(hpF>.4&&(strong||pred.target!==e)&&!(pred.kind==='bear'&&hpF<.8&&e.weapon==='fists')){e.state='hunt';e.target=pred;e.tx=pred.x;e.tz=pred.z;e.pace=1;e.hiding=false;return true;}
  e.state='flee';e.target=null;const ax=e.x-pred.x,az=e.z-pred.z,l=Math.hypot(ax,az)||1;e.tx=e.x+ax/l*22;e.tz=e.z+az/l*22;e.pace=1;e.hiding=false;return true;}
 if(e.hunger<60&&(!t||dT>25)&&!['drink','flee'].includes(e.state)){const meat=nearestItem(e,i=>i.type==='meat',40);if(meat){e.state='forage';e.target=null;e.tx=meat.x;e.tz=meat.z;e.pace=.9;if(Math.hypot(meat.x-e.x,meat.z-e.z)<2)pickup(e);return true;}
  let prey=null,bd=e.hunger<35?45:30;for(const a of animals){if(!a.alive||!a.K.prey)continue;if(a.kind==='boar'&&e.weapon==='fists')continue;const d=Math.hypot(a.x-e.x,a.z-e.z);if(d<bd){bd=d;prey=a;}}
  if(prey){e.state='forage';e.target=prey;e.tx=prey.x;e.tz=prey.z;e.pace=1;e.hiding=false;return true;}}
 return false;}
function allyBeast(e){const h=e.leader;if(!h||!h.alive)return false;let best=null,bd=22;for(const a of animals){if(!a.alive)continue;if(!(a.target===h||a.target===e||(a.target&&a.target.ally===e.ally))&&!(h.lastAnimal===a&&time-h.lastAnimalT<6))continue;const d=Math.hypot(a.x-e.x,a.z-e.z);if(d<bd){bd=d;best=a;}}
 if(best&&e.hp/e.maxhp>.25){e.state='hunt';e.target=best;e.tx=best.x;e.tz=best.z;e.pace=1;e.hiding=false;return true;}return false;}
// net
function animalSnap(){return animals.map(a=>[a.id,KI.indexOf(a.kind),q(a.x),q(a.z),q(a.dir),q(a.speed,10),a.alive?1:0,a.flash>0?1:0,a.swing>.2?1:0,a.state==='graze'?1:0]);}
function clientAnimals(arr){const seen=new Set();for(const [id,ki,x,z,dir,sp,al,fl,sw,gz] of arr){seen.add(id);let a=animals.find(b=>b.id===id);
  if(!a){a=makeAnimal(KI[ki],x,z,{id});a.dir=dir;}a.net={x,z,dir};a.speed=sp;if(fl)a.flash=.15;a.state=gz?'graze':'walk';
  if(sw&&!a.netSw&&a.fig)aAnim(a,'attack');a.netSw=sw;if(a.alive&&!al){a.alive=false;a.deadT=time;if(a.fig)aAnim(a,'death');}}
 for(let i=animals.length-1;i>=0;i--)if(!seen.has(animals[i].id)){if(animals[i].fig)scene.remove(animals[i].fig);animals.splice(i,1);}}
function clientAnimalStep(dt){const k=Math.min(1,dt*10);for(const a of animals){if(!a.net)continue;a.x+=(a.net.x-a.x)*k;a.z+=(a.net.z-a.z)*k;let dd=a.net.dir-a.dir;dd=Math.atan2(Math.sin(dd),Math.cos(dd));a.dir+=dd*k;a.flash=Math.max(0,a.flash-dt);a.y=Math.max(H(a.x,a.z),WL-.6);if(a.fig){a.fig.position.set(a.x,a.y,a.z);a.fig.rotation.y=a.dir;}}}
Object.assign(window.__game,{animals:()=>animals.map(a=>({id:a.id,kind:a.kind,x:+a.x.toFixed(1),z:+a.z.toFixed(1),hp:Math.round(a.hp),alive:a.alive,state:a.state,target:a.target?a.target.name:null})),
 spawnAnimal:(k,x,z)=>makeAnimal(k,x,z).id,releaseMutts,animalKills:()=>animalKills,
 hitAnimal:(id,d)=>{const a=animals.find(b=>b.id===id);if(a)hitAnimal(a,d,player);},
 clearAnimals:()=>{for(const a of animals)if(a.fig)scene.remove(a.fig);animals=[];}});
Object.defineProperty(window.__game,'time',{get:()=>time});

// ---------- camping ----------
const WOOD_COST=4,WOOD_MAX=12,MEAT_MAX=4;let camps=[],campId=0;
const logMat=new THREE.MeshStandardMaterial({color:0x5a3a20,roughness:.95}),flameMat=new THREE.MeshBasicMaterial({color:0xff7a1a,transparent:true,opacity:.85,fog:false}),flameMat2=new THREE.MeshBasicMaterial({color:0xffd060,transparent:true,opacity:.9,fog:false}),
 tentMat=new THREE.MeshStandardMaterial({color:0x8c7a52,roughness:.9,side:THREE.DoubleSide}),bedMat=new THREE.MeshStandardMaterial({color:0x2f4f7a,roughness:.9}),ashMat=new THREE.MeshStandardMaterial({color:0x222222,roughness:1});
const campLight=new THREE.PointLight(0xff9040,0,16,1.5);scene.add(campLight);
function campMesh(){const g=new THREE.Group(),fire=new THREE.Group();g.add(fire);
 for(let i=0;i<3;i++){const l=new THREE.Mesh(new THREE.CylinderGeometry(.06,.07,.8,6),logMat);l.rotation.z=Math.PI/2;l.rotation.y=i*2.1;l.position.y=.08;fire.add(l);}
 for(let i=0;i<7;i++){const s=new THREE.Mesh(new THREE.DodecahedronGeometry(.11,0),rockMat);const a=i/7*6.28;s.position.set(Math.cos(a)*.5,.05,Math.sin(a)*.5);fire.add(s);}
 const ash=new THREE.Mesh(new THREE.CircleGeometry(.4,10),ashMat);ash.rotation.x=-Math.PI/2;ash.position.y=.02;fire.add(ash);
 const fl=new THREE.Mesh(new THREE.ConeGeometry(.24,.75,7),flameMat);fl.position.y=.45;const fl2=new THREE.Mesh(new THREE.ConeGeometry(.13,.45,6),flameMat2);fl2.position.y=.33;const flames=new THREE.Group();flames.add(fl,fl2);fire.add(flames);
 const sh=new THREE.Group();sh.position.set(0,0,-2.3);g.add(sh);
 for(const x of [-1,1]){const p=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,1.5,5),logMat);p.position.set(x*1.05,.75,.55);sh.add(p);}
 const ridge=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,2.3,5),logMat);ridge.rotation.z=Math.PI/2;ridge.position.set(0,1.48,.55);sh.add(ridge);
 const roof=new THREE.Mesh(new THREE.PlaneGeometry(2.3,1.9),tentMat);roof.position.set(0,.78,-.12);roof.rotation.x=-.88;sh.add(roof);
 const bed=new THREE.Mesh(new THREE.CapsuleGeometry(.2,1.4,3,8),bedMat);bed.rotation.z=Math.PI/2;bed.position.set(0,.18,.1);sh.add(bed);
 const snare=new THREE.Group();const sp=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.7,4),logMat);sp.position.y=.35;sp.rotation.z=.4;const loop=new THREE.Mesh(new THREE.TorusGeometry(.15,.015,4,10),bedMat);loop.rotation.x=Math.PI/2;loop.position.set(.15,.03,0);snare.add(sp,loop);snare.position.set(2.2,0,.6);snare.visible=false;g.add(snare);
 g.traverse(o=>{if(o.isMesh&&o.material!==flameMat&&o.material!==flameMat2)o.castShadow=true;});g.userData={flames,snare};return g;}
function campSet(c){if(!c.fig)return;c.fig.userData.flames.visible=c.lit;c.fig.userData.snare.visible=!!c.snare;}
function addCamp(owner,x,z,dir,o={}){removeCamp(owner);const c={id:o.id??campId++,owner,x,z,dir,lit:o.lit??true,snare:false,snareT:0,fig:null};if(!simMode){c.fig=campMesh();c.fig.position.set(x,H(x,z),z);c.fig.rotation.y=dir;scene.add(c.fig);campSet(c);}camps.push(c);if(owner)owner.camp=c;return c;}
function removeCamp(owner){if(!owner)return;for(const c of camps.filter(c=>c.owner===owner)){if(c.fig)scene.remove(c.fig);camps.splice(camps.indexOf(c),1);}owner.camp=null;}
function clearCamps(){for(const c of camps)if(c.fig)scene.remove(c.fig);camps=[];}
function litCampNear(o,r=6){for(const c of camps)if(c.lit&&Math.hypot(c.x-o.x,c.z-o.z)<r)return c;return null;}
function myCampNear(e,r=4){const c=e.camp;if(c&&Math.hypot(c.x-e.x,c.z-e.z)<r)return c;for(const k of camps)if(k.owner&&k.owner!==e&&e.ally&&k.owner.ally===e.ally&&Math.hypot(k.x-e.x,k.z-e.z)<r)return k;return null;}
function inCombat(e){if(time-(e.lastAttackT||-99)<8||time-(e.beastT||-99)<8)return true;for(const o of ents)if(o!==e&&o.alive&&!o.isDummy&&o.target===e&&Math.hypot(o.x-e.x,o.z-e.z)<15)return true;for(const a of animals)if(a.alive&&a.target===e&&Math.hypot(a.x-e.x,a.z-e.z)<18)return true;return false;}
function campBlock(e){if(inWater(e.x,e.z)||nearWater(e))return 'Too close to water';if(Math.hypot(e.x,e.z)>zoneR-4)return 'Not inside the firestorm';if(inCombat(e))return 'Not while in danger';if((e.wood||0)<WOOD_COST)return `Need ${WOOD_COST} wood (have ${e.wood||0}) – grab sticks or chop trees with an axe`;return null;}
function eatMeat(e,cooked){if(!(e.meat>0))return false;e.meat--;if(cooked){e.hunger=Math.min(100,e.hunger+55);e.hp=Math.min(e.maxhp,e.hp+12);}else{e.hunger=Math.min(100,e.hunger+15);if(Math.random()<.3){e.hp-=8;say(e,'Raw meat upset your stomach (-8 HP)');return true;}}return true;}
function wakeUp(e,why){if(!e.sleeping)return;e.sleeping=false;if(why){say(e,'⚠ You wake up! '+why);if(e.isPlayer&&!simMode){tone(880,.15,'square',.2,440);setTimeout(()=>tone(880,.15,'square',.2,440),200);}}if(e.isPlayer)$('sleepOv').classList.add('hidden');}
function campAction(e,act){if(!e||!e.alive)return;const c=myCampNear(e,4.5);
 if(act==='build'){const why=campBlock(e);if(why)return say(e,why);e.wood-=WOOD_COST;const fx=Math.sin(e.dir),fz=Math.cos(e.dir);const had=!!e.camp;addCamp(e,e.x+fx*1.8,e.z+fz*1.8,e.dir+Math.PI);tutEvent&&e.isPlayer&&tutEvent('camp');return say(e,had?'New camp built – the old one was abandoned':'Camp built! Campfire, shelter & bedroll ready');}
 if(act==='raw'){if(eatMeat(e,false))say(e,'You eat raw meat (+15 hunger)');return;}
 if(!c)return say(e,'Go back to your camp first');
 if(act==='cook'){if(!c.lit)return say(e,'Light the fire to cook');let n=0;while(e.meat>0&&e.hunger<96){eatMeat(e,true);n++;}return say(e,n?`Cooked & ate ${n} meat (+${n*55} hunger)`:e.meat?'You are not hungry':'No raw meat to cook');}
 if(act==='fire'){c.lit=!c.lit;campSet(c);return say(e,c.lit?'You light the campfire':'You stomp out the fire');}
 if(act==='snare'){if(c.snare)return say(e,'Snare already set');if((e.wood||0)<1)return say(e,'Need 1 wood');e.wood--;c.snare=true;c.snareT=time+rnd(50,90);campSet(c);return say(e,'Snare set – check back later');}
 if(act==='rest'){if(inCombat(e))return say(e,'Not while in danger');e.sleeping=true;e.sleepHp=e.hp;if(e.isPlayer&&!simMode){$('sleepOv').classList.remove('hidden');$('campMenu').classList.add('hidden');}return say(e,NET.role?'Resting… (health regenerates)':'Sleeping… time passes faster');}}
function sleepTick(e,dt){const c=myCampNear(e,6);if(!c){wakeUp(e,'');return false;}
 if(e.hp<e.sleepHp-1)return wakeUp(e,'You were attacked!'),false;
 for(const o of ents)if(o!==e&&o.alive&&!o.ghost&&!o.isDummy&&!(e.ally&&o.ally===e.ally)&&Math.hypot(o.x-e.x,o.z-e.z)<16){wakeUp(e,`${o.name} is close by!`);return false;}
 for(const a of animals)if(a.alive&&a.K.pred&&Math.hypot(a.x-e.x,a.z-e.z)<20){wakeUp(e,`A ${a.K.n.toLowerCase()} is nearby!`);return false;}
 if(Math.hypot(e.x,e.z)>zoneR-3){wakeUp(e,'The firestorm is coming!');return false;}
 e.hp=Math.min(e.maxhp,e.hp+dt*(c.lit?7:5));e.sleepHp=e.hp;return true;}
function campsStep(dt){for(const c of camps){if(c.owner&&!c.owner.alive&&c.owner.isAnimal)continue;
  if(c.snare&&time>c.snareT){c.snareT=time+rnd(60,110);const o=c.owner;if(o&&o.alive&&Math.hypot(o.x-c.x,o.z-c.z)>5||Math.random()<.5){const s=c.fig?c.fig.userData.snare:null;const a=c.dir;addItem('meat',c.x+Math.cos(a)*2.2,c.z-Math.sin(a)*2.2);if(o&&o.isHuman)say(o,'🪤 Your snare caught a rabbit!');}}}}
function campsVisual(dt){let best=null,bd=45;for(const c of camps){if(!c.fig)continue;const f=c.fig.userData.flames;if(c.lit){const t=performance.now()/1000+c.id;f.scale.set(1+Math.sin(t*13)*.08,1+Math.sin(t*9.3)*.18,1+Math.cos(t*11)*.08);}
  if(c.lit&&player){const d=Math.hypot(c.x-player.x,c.z-player.z);if(d<bd){bd=d;best=c;}}}
 if(best){campLight.position.set(best.x,H(best.x,best.z)+1,best.z);campLight.intensity=(isNight()?14:3)*(.85+Math.random()*.15);}else campLight.intensity=0;}
function aiCamp(e,st){if(e.camp||e.isHuman||camps.length>=8||!isNight()||!(st==='rest'||st==='ambush'))return;if(!(e.pers==='hider'||e.pers==='scavenger'&&Math.random()<.4))return;if(Math.random()>.08||inCombat(e)||nearWater(e))return;
 addCamp(e,e.x,e.z,e.dir,{lit:Math.random()<.45});e.ambushSpot=[e.x,e.z];}
function allyCamp(e){const h=e.leader;if(!h||!h.alive||!h.sleeping||!h.camp)return false;const c=h.camp,idx=teamAllies(h).indexOf(e),a=c.dir+1.6+idx*1.4;e.state='guard';e.target=null;e.tx=c.x+Math.sin(a)*3;e.tz=c.z+Math.cos(a)*3;e.pace=.6;e.hiding=false;return true;}
function chopTree(a){const fx=Math.sin(a.dir),fz=Math.cos(a.dir);for(const o of obsNear(a.x+fx*1.5,a.z+fz*1.5)){if(o.b!==4)continue;const dx=o.x-a.x,dz=o.z-a.z,d=Math.hypot(dx,dz);if(d<2.6&&(dx*fx+dz*fz)/(d||1)>.3){if((a.wood||0)>=WOOD_MAX)return say(a,'You can\'t carry more wood'),true;a.wood=(a.wood||0)+1;say(a,`Chopped wood (🪵 ${a.wood})`);if(a.isPlayer)tone(170,.1,'square',.12,120);return true;}}return false;}
function spawnSticks(){let n=0,g=0;while(n<70&&g++<2000){const t=pick(TL);if(Math.hypot(t.x,t.z)>R-8)continue;const a=rnd(0,6.28),x=t.x+Math.cos(a)*1.6,z=t.z+Math.sin(a)*1.6;if(inWater(x,z))continue;addItem('sticks',x,z);n++;}
 for(let i=0;i<6;i++){const a=rnd(0,6.28),r=rnd(18,30);addItem('sticks',Math.cos(a)*r,Math.sin(a)*r);}}
// UI
function campOptions(){const e=player;if(!e||!e.alive)return [];const c=myCampNear(e,4.5),o=[];const w=e.wood||0,m=e.meat||0;
 if(c){o.push(['cook',`🍖 Cook meat (${m})`,c.lit&&m>0]);o.push(['rest','💤 Rest / sleep',true]);o.push(['fire',c.lit?'🥾 Stomp out fire':'🔥 Light fire',true]);if(!c.snare)o.push(['snare','🪤 Set snare (1 wood)',w>=1]);}
 o.push(['build',(e.camp?'⛺ Move camp here':'⛺ Build camp')+` (${w}/${WOOD_COST} wood)`,w>=WOOD_COST]);if(m>0)o.push(['raw',`Eat raw meat (${m})`,true]);return o;}
function toggleCampMenu(force){const el=$('campMenu');const show=force!==undefined?force:el.classList.contains('hidden');if(!show){el.classList.add('hidden');return;}
 if(document.pointerLockElement)document.exitPointerLock();el.innerHTML='<div class="ch">Camp</div>'+campOptions().map(([k,t,en])=>`<button data-a="${k}" ${en?'':'class="off"'}>${t}</button>`).join('')+'<button data-a="close">✕ Close</button>';el.classList.remove('hidden');}
function cmdCamp(a){if(a==='close')return toggleCampMenu(false);toggleCampMenu(false);if(NET.role==='client'){netSend(NET.conn,{t:'camp',a});if(a==='rest')$('sleepOv').classList.remove('hidden');return;}campAction(player,a);}
$('campMenu').addEventListener('click',ev=>{const b=ev.target.closest('button');if(b)cmdCamp(b.dataset.a);});
for(const ev of ['touchstart','mousedown'])$('campBtn').addEventListener(ev,e=>{e.preventDefault();e.stopPropagation();audio();toggleCampMenu();},{passive:false});
for(const ev of ['touchstart','mousedown']){const ab=$('aidBtn');if(ab)ab.addEventListener(ev,e=>{e.preventDefault();e.stopPropagation();audio();requestAid();},{passive:false});}
addEventListener('keydown',e=>{if(!running||simMode)return;if(e.code==='KeyG')requestAid();});
$('sleepOv').addEventListener('click',()=>{if(NET.role==='client'){netSend(NET.conn,{t:'camp',a:'wake'});$('sleepOv').classList.add('hidden');}else if(player)wakeUp(player,'');});
addEventListener('keydown',e=>{if(!running||simMode)return;if(e.code==='KeyC')toggleCampMenu();});
function campSnap(){return camps.map(c=>[c.id,ents.indexOf(c.owner),q(c.x),q(c.z),q(c.dir,10),c.lit?1:0,c.snare?1:0]);}
function clientCamps(arr){const seen=new Set();for(const [id,oi,x,z,dir,lit,sn] of arr){seen.add(id);let c=camps.find(k=>k.id===id);const owner=ents[oi]||null;if(!c){if(owner)removeCamp(owner);c={id,owner,x,z,dir,lit:!!lit,snare:!!sn,fig:campMesh()};c.fig.position.set(x,H(x,z),z);c.fig.rotation.y=dir;scene.add(c.fig);camps.push(c);if(owner)owner.camp=c;}c.lit=!!lit;c.snare=!!sn;campSet(c);}
 for(let i=camps.length-1;i>=0;i--)if(!seen.has(camps[i].id)){const c=camps[i];if(c.fig)scene.remove(c.fig);if(c.owner&&c.owner.camp===c)c.owner.camp=null;camps.splice(i,1);}}
Object.assign(window.__game,{camps:()=>camps.map(c=>({id:c.id,owner:c.owner&&c.owner.name,x:+c.x.toFixed(1),z:+c.z.toFixed(1),lit:c.lit,snare:c.snare})),campAction:a=>campAction(player,a),campOptions,toggleCampMenu,
 setTime:t=>{time=t;},inv:()=>({wood:player.wood||0,meat:player.meat||0,sleeping:!!player.sleeping,hp:Math.round(player.hp),hunger:Math.round(player.hunger)})});
Object.assign(window.__game,{sticks:()=>{let b=null,bd=1e9;for(const it of items)if(it.type==='sticks'){const d=Math.hypot(it.x-player.x,it.z-player.z);if(d<bd){bd=d;b=it;}}return b&&{x:b.x,z:b.z};},killFar:()=>{for(const e of ents)if(!e.isPlayer&&Math.hypot(e.x-player.x,e.z-player.z)<40){e.x+=80;e.z+=80;}}});
window.__game.dbgA=()=>animals.map(a=>{const bb=new THREE.Box3().setFromObject(a.fig,true);return [a.kind,a.fig.visible,a.fig.parent===scene,bb.min.toArray().map(v=>+v.toFixed(1)),bb.max.toArray().map(v=>+v.toFixed(1)),a.K.model?+MODELS[a.K.model].h.toFixed(2):0]});
/*initArena*/try{rebuildArena('wilds',20261015);syncArenaSky();}catch(e){console.error('arena init',e);}
Object.assign(window.__game,{rebuildArena,runSim,
 arenaInfo:()=>({id:arenaId,name:arena&&arena.name,seed:ARENA_SEED,code:arenaCode(ARENA_SEED),R,LAKE:{...LAKE},RUINS:{...RUINS},CAVE:{...CAVE},POND:{...POND}}),
 roll:(b,sd)=>{const biome=b||ARENAS[Math.floor(Math.random()*ARENAS.length)].id;const seed=sd!=null?sd:(Math.random()*0xffffffff)|0;rebuildArena(biome,seed);syncArenaSky();return window.__game.arenaInfo();},
 peekArena:(b,s)=>{const r=window.__game.roll(b,s);homeActive=true;running=false;paused=false;hideGameUI();['home','select','end','online','arena'].forEach(id=>{const el=$(id);if(el)el.classList.add('hidden');});renderer.domElement.style.display='block';homeT=Math.random()*50;return r;}});
Object.assign(window.__game,{
 corn:()=>({pos:{x:CORN.x,z:CORN.z},inside:cornInside,obs:obstacles.filter(o=>o.corn).length,loot:items.filter(i=>inCornucopia(i.x,i.z)).map(i=>i.type)}),
 inCorn:()=>!!player&&inCornucopia(player.x,player.z),
 give:(t)=>{if(!player)return;player.weapon=t;player.ammo=(WEAPONS[t]&&WEAPONS[t].ammoN)||0;setWeaponModel();if($('weap'))$('weap').textContent='Weapon: '+WEAPONS[t].n+(player.ammo?` · ${player.ammo}`:'');return {weapon:player.weapon,ammo:player.ammo};},
 fire:()=>{if(player)attack(player);return {ammo:player&&player.ammo,w:player&&player.weapon};},
 weapons:Object.keys(WEAPONS),
 charNames:CHARS.map(c=>c.name),
 setCustom:(o)=>{Object.assign(custom,o||{});},
 startPractice:(biome,seed)=>startGame({practice:true,biome:biome||'wilds',seed:seed!=null?seed:42}),
 startSolo:(biome,seed)=>startGame({biome:biome||'wilds',seed:seed!=null?seed:42}),
 yaw:(v)=>{if(v!==undefined)yaw=v;return yaw;},
 pitch:(v)=>{if(v!==undefined)pitch=v;return pitch;},
 projs:()=>projs.map(p=>({x:+p.x.toFixed(1),z:+p.z.toFixed(1),y:+p.y.toFixed(2),life:+p.life.toFixed(2)})),
 playAnthem,stopAnthem,doJump,findClimb,startClimb,endClimb,grounded,anthemPlaying:()=>anthemOn,nightFlag:()=>wasNight,nightCycle,isNight,deaths:()=>deaths,cannon,
 nearestClimbable:(kind)=>{let best=null,bd=1e9;for(const o of obstacles){if(!climbable(o))continue;if(kind==='tree'&&o.b!==4)continue;if(kind==='rock'&&(o.b===4||o.corn))continue;if(kind==='corn'&&!o.corn)continue;const d=Math.hypot(o.x-(player?player.x:0),o.z-(player?player.z:0));if(d<bd){bd=d;best=o;}}return best?{x:best.x,z:best.z,h:best.h,r:best.r,b:best.b,corn:!!best.corn,d:bd}:null},
 forceGift:(opts={})=>{if(!player)return null;if(opts.favor!=null)player.favor=opts.favor;const g=dropGift(player,{force:true,instant:opts.instant!==false,contents:opts.contents,emerg:!!opts.emerg});return g&&{id:g.id,x:g.x,z:g.z,landed:g.landed,contents:g.contents.slice()};},
 gifts:()=>gifts.map(g=>({id:g.id,x:+g.x.toFixed(1),z:+g.z.toFixed(1),y:+g.y.toFixed(1),landed:g.landed,opened:g.opened,contents:g.contents.slice()})),
 openNearestGift:()=>{const g=gifts.find(x=>x.landed&&!x.opened);if(!g||!player)return false;openGift(player,g);return true;},
 setFavor:(v)=>{if(player)player.favor=v;},
 getFavor:()=>player&&player.favor,
 requestAid,


});
