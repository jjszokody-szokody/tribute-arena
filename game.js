import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
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

// ---------- quality ----------
const PRESETS={
 low:{pr:1,shadow:0,grass:3500,trees:170,fog:95,water:'simple',bloom:false,aa:false,rocks:40},
 medium:{pr:1.5,shadow:1024,grass:11000,trees:260,fog:135,water:'simple',bloom:false,aa:false,rocks:60},
 high:{pr:2,shadow:2048,grass:26000,trees:340,fog:180,water:'reflect',bloom:true,aa:true,rocks:70}};
let qSetting=localStorage.getItem('ta_quality')||'auto';
function autoQ(){if(!isTouch)return 'high';const mem=navigator.deviceMemory||4,cores=navigator.hardwareConcurrency||4;return (mem>=6&&cores>=8)?'medium':'low';}
const qName=qSetting==='auto'?autoQ():qSetting,QL=PRESETS[qName];
document.querySelectorAll('#qual button').forEach(b=>{b.classList.toggle('on',b.dataset.q===qSetting);b.onclick=()=>{if(b.dataset.q===qSetting)return;localStorage.setItem('ta_quality',b.dataset.q);location.reload();};});
$('qual').insertAdjacentHTML('beforeend',` <span style="opacity:.6">(${qName})</span>`);

const CHARS=[
 {name:'Kestrel Vane',d:1,c:0xd4af37,hp:100,spd:1.0,str:1.0,stl:0.5,desc:'Luxury-trained all-rounder',model:'Soldier',scale:1.0},
 {name:'Brakk Holloway',d:2,c:0x8a8f99,hp:140,spd:0.85,str:1.4,stl:0.2,desc:'Masonry brute, hits hard',model:'Soldier',scale:1.12},
 {name:'Wren Ashby',d:7,c:0x4c8a3a,hp:95,spd:1.1,str:1.15,stl:0.6,desc:'Lumberjack, axe-strong',model:'Xbot',scale:1.02},
 {name:'Juniper Lark',d:11,c:0xc96b2c,hp:85,spd:1.25,str:0.85,stl:0.8,desc:'Orchard runner, fast',model:'Xbot',scale:0.93},
 {name:'Moss Tiller',d:9,c:0xe8d27a,hp:110,spd:1.0,str:1.0,stl:0.5,desc:'Grain farmer, sturdy',model:'Soldier',scale:1.04},
 {name:'Shade Corrin',d:12,c:0x6a6a90,hp:80,spd:1.15,str:0.9,stl:1.0,desc:'Miner, master of stealth',model:'Xbot',scale:0.96}];
const FIRST=['Ash','Briar','Cole','Dara','Ember','Fen','Gale','Hollis','Ivy','Jory','Kit','Lumen','Marr','Nell','Orin','Pike','Quill','Rook','Sable','Tamsin','Ula','Vesper','Wynn','Yarrow'];
let sel=0;
function rnd(a,b){return a+Math.random()*(b-a);}

// ---------- models ----------
const MODELS={};
const loader=new GLTFLoader();
const loadP=Promise.all(['Soldier','Xbot'].map(n=>new Promise((res,rej)=>loader.load('assets/models/'+n+'.glb',g=>{MODELS[n]=g;res();},undefined,rej))));
const ANIM={Soldier:{idle:'Idle',walk:'Walk',run:'Run'},Xbot:{idle:'idle',walk:'walk',run:'run'}};
function makeFigure(model,color,scale=1){
 const g=MODELS[model],root=new THREE.Group(),obj=SkeletonUtils.clone(g.scene);root.add(obj);obj.scale.multiplyScalar(scale);if(model==='Soldier')obj.rotation.y=Math.PI;
 const tint=new THREE.Color(color),mats=[];
 obj.traverse(o=>{if(o.isMesh){o.castShadow=true;o.frustumCulled=false;o.material=o.material.clone();const m=o.material;
  if(model==='Soldier'){if(/Body/.test(m.name))m.color.copy(new THREE.Color(1,1,1).lerp(tint,.65));}
  else{if(/Joints/.test(m.name))m.color.copy(tint).multiplyScalar(.35);else m.color.copy(tint);m.roughness=.45;m.metalness=.2;}
  m.emissive=new THREE.Color(0);mats.push(m);}});
 const mixer=new THREE.AnimationMixer(obj),acts={};
 for(const k in ANIM[model]){const clip=THREE.AnimationClip.findByName(g.animations,ANIM[model][k]);acts[k]=mixer.clipAction(clip);acts[k].play();acts[k].setEffectiveWeight(k==='idle'?1:0);}
 const bone=n=>obj.getObjectByName('mixamorig'+n)||obj.getObjectByName('mixamorig:'+n);
 root.userData={obj,mixer,acts,cur:'idle',mats,arm:bone('RightArm'),fore:bone('RightForeArm'),hand:bone('RightHand'),spine:bone('Spine1'),acc:0,weap:null};
 return root;}
function setAnim(f,name,speed=1){const u=f.userData;if(u.cur!==name){const from=u.acts[u.cur],to=u.acts[name];to.enabled=true;to.setEffectiveTimeScale(1);to.setEffectiveWeight(1);to.time=from.time*to.getClip().duration/from.getClip().duration;from.crossFadeTo(to,.25,true);u.cur=name;}u.acts[name].setEffectiveTimeScale(speed);}
function poseOverlay(f,swing){const u=f.userData;if(swing>0&&u.arm){const k=Math.sin((1-swing/.3)*Math.PI);u.arm.rotateX(-1.6*k);u.arm.rotateZ(.4*k);u.fore&&u.fore.rotateX(-.6*k);u.spine&&u.spine.rotateY(-.4*k);}}

// ---------- weapon & item meshes ----------
const metal=new THREE.MeshStandardMaterial({color:0xd8dde2,metalness:1,roughness:.25}),wood=new THREE.MeshStandardMaterial({color:0x7a5230,roughness:.8}),leather=new THREE.MeshStandardMaterial({color:0x3b2416,roughness:.9});
function weaponMesh(t){const g=new THREE.Group();
 if(t==='knife'){const b=new THREE.Mesh(new THREE.BoxGeometry(.04,.02,.32),metal);b.position.z=.22;const h=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.14,6),leather);h.rotation.x=Math.PI/2;g.add(b,h);}
 if(t==='spear'){const s=new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,2,6),wood);s.rotation.x=Math.PI/2;s.position.z=.4;const tip=new THREE.Mesh(new THREE.ConeGeometry(.05,.25,6),metal);tip.rotation.x=Math.PI/2;tip.position.z=1.5;g.add(s,tip);}
 if(t==='axe'){const s=new THREE.Mesh(new THREE.CylinderGeometry(.025,.03,.75,6),wood);s.rotation.x=Math.PI/2;s.position.z=.25;const hd=new THREE.Mesh(new THREE.BoxGeometry(.03,.2,.16),metal);hd.position.set(0,.09,.55);g.add(s,hd);}
 g.traverse(o=>{if(o.isMesh)o.castShadow=true;});return g;}
const crateMat=new THREE.MeshStandardMaterial({color:0x8b6a3e,roughness:.85}),bushMat=new THREE.MeshStandardMaterial({color:0x2f5f28,roughness:.9,flatShading:true}),berryMat=new THREE.MeshStandardMaterial({color:0xb5123f,roughness:.3}),bottleMat=new THREE.MeshStandardMaterial({color:0x7fc8ff,roughness:.05,metalness:.1,transparent:true,opacity:.75});
function itemMesh(t){if(t in WEAPONS&&t!=='fists'){const w=weaponMesh(t);w.rotation.set(0,rnd(0,6),0);w.children.forEach(c=>{});const g=new THREE.Group();w.rotation.z=Math.PI/2*0;w.position.y=.06;g.add(w);return g;}
 const g=new THREE.Group();
 if(t==='food'){const c=new THREE.Mesh(new THREE.BoxGeometry(.6,.4,.45),crateMat);c.position.y=.2;c.castShadow=true;g.add(c);}
 if(t==='water'){const c=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,.4,10),bottleMat);c.position.y=.2;const cap=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.06,8),leather);cap.position.y=.43;g.add(c,cap);}
 if(t==='berries'){const b=new THREE.Mesh(new THREE.IcosahedronGeometry(.55,1),bushMat);b.position.y=.4;b.scale.y=.8;b.castShadow=true;g.add(b);const bg=new THREE.SphereGeometry(.06,6,4);for(let i=0;i<9;i++){const s=new THREE.Mesh(bg,berryMat);const a=rnd(0,6.28),e=rnd(-.2,.9);s.position.set(Math.cos(a)*.5*Math.cos(e),.4+Math.sin(e)*.42,Math.sin(a)*.5*Math.cos(e));g.add(s);}}
 return g;}

// ---------- preview ----------
const pc=$('preview'),pr=new THREE.WebGLRenderer({canvas:pc,antialias:true,alpha:true});pr.toneMapping=THREE.ACESFilmicToneMapping;pr.toneMappingExposure=1.6;
const ps=new THREE.Scene(),pcam=new THREE.PerspectiveCamera(30,1,.1,50);pcam.position.set(0,1.2,4.6);pcam.lookAt(0,.95,0);
ps.add(new THREE.HemisphereLight(0xffffff,0x554433,1.6));const pd=new THREE.DirectionalLight(0xfff0dd,2.2);pd.position.set(2,4,3);ps.add(pd);const pd2=new THREE.DirectionalLight(0x88aaff,1);pd2.position.set(-3,2,-2);ps.add(pd2);
let pfig=null;const pclock=new THREE.Clock();
function setPreview(){if(!MODELS.Soldier)return;if(pfig)ps.remove(pfig);const c=CHARS[sel];pfig=makeFigure(c.model,c.c,c.scale);ps.add(pfig);}
function renderChars(){
 $('chars').innerHTML=CHARS.map((c,i)=>`<div class="ch ${i==sel?'sel':''}" data-i="${i}"><b style="color:#${c.c.toString(16).padStart(6,'0')}">${c.name}</b>District ${c.d} · ${c.desc}
 ${[['HP',c.hp/140,'#e33'],['SPD',c.spd/1.25,'#3c9'],['STR',c.str/1.4,'#e93'],['STL',c.stl,'#99f']].map(s=>`<div style="display:flex;gap:4px;align-items:center;font-size:10px"><span style="width:26px">${s[0]}</span><div class="bar" style="flex:1"><i style="width:${s[1]*100}%;background:${s[2]}"></i></div></div>`).join('')}</div>`).join('');
 document.querySelectorAll('.ch').forEach(e=>e.onclick=()=>{sel=+e.dataset.i;renderChars();setPreview();});}
renderChars();
function previewLoop(){requestAnimationFrame(previewLoop);if($('select').classList.contains('hidden')||!pfig)return;const w=pc.clientWidth,h=pc.clientHeight;if(pc.width!==w||pc.height!==h){pr.setSize(w,h,false);pcam.aspect=w/h;pcam.updateProjectionMatrix();}const dt=pclock.getDelta();pfig.rotation.y+=dt*.7;pfig.userData.mixer.update(dt);pr.render(ps,pcam);}previewLoop();

// ---------- audio ----------
let ac=null;function audio(){if(!ac)try{ac=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}if(ac&&ac.state==='suspended')ac.resume();}
function tone(f,dur,type='sine',vol=.3,slide=0){if(!ac)return;const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.value=f;if(slide)o.frequency.exponentialRampToValueAtTime(slide,ac.currentTime+dur);g.gain.setValueAtTime(vol,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+dur);o.connect(g).connect(ac.destination);o.start();o.stop(ac.currentTime+dur);}
function cannon(){if(!ac)return;tone(90,1.2,'sine',.8,30);const n=ac.createBufferSource(),b=ac.createBuffer(1,ac.sampleRate*.6,ac.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,3);n.buffer=b;const g=ac.createGain();g.gain.value=.5;const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=400;n.connect(f).connect(g).connect(ac.destination);n.start();}

// ---------- renderer / scene ----------
const R=95,LAKE={x:45,z:35,r:16},WL=-.6;
const RIVER={a:new THREE.Vector2(LAKE.x,LAKE.z),b:new THREE.Vector2(LAKE.x+40,LAKE.z+55)};
const renderer=new THREE.WebGLRenderer({antialias:QL.aa,powerPreference:'high-performance'});
let pixelRatio=Math.min(devicePixelRatio,QL.pr);renderer.setPixelRatio(pixelRatio);renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;renderer.outputColorSpace=THREE.SRGBColorSpace;
if(QL.shadow){renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;}
document.body.prepend(renderer.domElement);renderer.domElement.style.display='none';
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.1,1200);scene.add(camera);
scene.fog=new THREE.Fog(0xb8d0e0,25,QL.fog);
const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;
const hemi=new THREE.HemisphereLight(0xcfe8ff,0x4a5a2a,.6),sun=new THREE.DirectionalLight(0xfff2d0,2.4);scene.add(hemi,sun,sun.target);
if(QL.shadow){sun.castShadow=true;sun.shadow.mapSize.set(QL.shadow,QL.shadow);const c=sun.shadow.camera;c.left=c.bottom=-38;c.right=c.top=38;c.near=1;c.far=200;sun.shadow.bias=-.0005;sun.shadow.normalBias=.04;}
const sky=new Sky();sky.scale.setScalar(1000);scene.add(sky);const su=sky.material.uniforms;su.turbidity.value=6;su.rayleigh.value=1.6;su.mieCoefficient.value=.005;su.mieDirectionalG.value=.8;
let composer=null;
if(QL.bloom&&!isTouch){composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.25,.5,.9));composer.addPass(new OutputPass());}
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);composer&&composer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});

// ---------- textures ----------
const tl=new THREE.TextureLoader();
function tex(n,rep,srgb){const t=tl.load('assets/tex/'+n);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rep,rep);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=isTouch?2:8;return t;}

// ---------- terrain ----------
function sstep(a,b,x){const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);}
function distSeg(x,z){const abx=RIVER.b.x-RIVER.a.x,abz=RIVER.b.y-RIVER.a.y;const t=Math.min(1,Math.max(0,((x-RIVER.a.x)*abx+(z-RIVER.a.y)*abz)/(abx*abx+abz*abz)));return Math.hypot(x-(RIVER.a.x+abx*t),z-(RIVER.a.y+abz*t));}
function H(x,z){const r=Math.hypot(x,z);let h=2.4*Math.sin(x*.045)*Math.cos(z*.05)+1.3*Math.sin(x*.11+1.3)*Math.sin(z*.09+.7)+.45*Math.sin((x+z)*.21);
 h=h*sstep(9,30,r)+.4;const w=Math.max(sstep(LAKE.r+7,LAKE.r-3,Math.hypot(x-LAKE.x,z-LAKE.z)),sstep(7,2.5,distSeg(x,z)));h=h*(1-w)-2.2*w;
 return h+sstep(R,R+35,r)*18;}
function inWater(x,z){return H(x,z)<WL+.05;}
const TS=R+60,tseg=isTouch?110:180,tg=new THREE.PlaneGeometry(TS*2,TS*2,tseg,tseg);tg.rotateX(-Math.PI/2);
{const p=tg.attributes.position,col=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),y=H(x,z);p.setY(i,y);
 const r=Math.hypot(x,z),dirt=Math.max(1-sstep(8,14,r),sstep(WL+.6,WL-.3,y)*.9),c=new THREE.Color(.82,.9,.72).lerp(new THREE.Color(.75,.62,.48),dirt);col.set([c.r,c.g,c.b],i*3);}
 tg.setAttribute('color',new THREE.BufferAttribute(col,3));tg.computeVertexNormals();}
const ground=new THREE.Mesh(tg,new THREE.MeshStandardMaterial({map:tex('grass_c.jpg',TS/3,true),normalMap:tex('grass_n.jpg',TS/3),vertexColors:true,roughness:.95,envMapIntensity:.4}));ground.receiveShadow=true;scene.add(ground);
// dirt patch around cornucopia
{const dg=new THREE.CircleGeometry(14,40);dg.rotateX(-Math.PI/2);const p=dg.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,H(p.getX(i),p.getZ(i))+.03);
 const a=new Float32Array(p.count*4);for(let i=0;i<p.count;i++){const r=Math.hypot(p.getX(i),p.getZ(i));a.set([1,1,1,1-sstep(9,14,r)],i*4);}dg.setAttribute('color',new THREE.BufferAttribute(a,4));
 const dm=new THREE.Mesh(dg,new THREE.MeshStandardMaterial({map:tex('ground_c.jpg',6,true),normalMap:tex('ground_n.jpg',6),roughness:1,transparent:true,vertexColors:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));dm.receiveShadow=true;scene.add(dm);}
// water
const wnorm=tl.load('assets/tex/waternormals.jpg',t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;});wnorm.wrapS=wnorm.wrapT=THREE.RepeatWrapping;
let water,simpleWaterMat;const wgeo=new THREE.PlaneGeometry(90,100);
if(QL.water==='reflect'){water=new Water(wgeo,{textureWidth:512,textureHeight:512,waterNormals:wnorm,sunDirection:new THREE.Vector3(),sunColor:0xffffff,waterColor:0x1a4a5e,distortionScale:2.5,fog:true});}
else{wnorm.repeat.set(6,6);simpleWaterMat=new THREE.MeshStandardMaterial({color:0x1d5670,roughness:.08,metalness:.3,normalMap:wnorm,normalScale:new THREE.Vector2(.6,.6),transparent:true,opacity:.88,envMapIntensity:1.2});water=new THREE.Mesh(wgeo,simpleWaterMat);}
water.rotation.x=-Math.PI/2;water.position.set(62,WL,62);scene.add(water);
// boundary force field
const wall=new THREE.Mesh(new THREE.CylinderGeometry(R,R,14,64,1,true),new THREE.MeshBasicMaterial({color:0x66ccff,transparent:true,opacity:.1,side:THREE.DoubleSide,depthWrite:false,fog:false}));wall.position.y=5;scene.add(wall);
// firestorm ring
const zoneMesh=new THREE.Mesh(new THREE.CylinderGeometry(1,1,40,64,1,true),new THREE.MeshBasicMaterial({color:0xff4410,transparent:true,opacity:.28,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));zoneMesh.position.y=12;scene.add(zoneMesh);
// cornucopia
{const pts=[];for(let i=0;i<=20;i++){const t=i/20;pts.push(new THREE.Vector2(.15+3.2*Math.pow(t,1.6),t*9));}
 const cg=new THREE.LatheGeometry(pts,28);const corn=new THREE.Mesh(cg,new THREE.MeshStandardMaterial({color:0xd9a93a,metalness:1,roughness:.28,side:THREE.DoubleSide}));
 corn.rotation.x=Math.PI/2-.12;corn.position.set(0,2.4+H(0,0),-8.5);corn.castShadow=corn.receiveShadow=true;scene.add(corn);}
const obstacles=[{x:0,z:-1.5,r:2.8},{x:0,z:-5,r:1.8}];
const M4=new THREE.Matrix4(),QQ=new THREE.Quaternion(),S3=new THREE.Vector3(),P3=new THREE.Vector3(),E=new THREE.Euler();
// trees: pines + broadleaf
const barkMat=new THREE.MeshStandardMaterial({map:tex('bark_c.jpg',1,true),normalMap:tex('bark_n.jpg',1),roughness:.95});
barkMat.map.repeat.set(1,2);barkMat.normalMap.repeat.set(1,2);
const pineGeo=mergeGeometries([[2.3,2.8,2.9],[1.8,2.5,4.3],[1.25,2.2,5.6],[.7,1.6,6.7]].map(([r,h,y])=>{const g=new THREE.ConeGeometry(r,h,8,1);g.translate(0,y,0);return g;}));
const pineMat=new THREE.MeshStandardMaterial({color:0x2c5528,roughness:.9,flatShading:true});
const leafGeo=mergeGeometries([[0,4.6,0,1.9],[1,4,.6,1.3],[-1,4.2,-.4,1.4],[.2,5.4,-.6,1.2],[-.4,3.8,1,1.1]].map(([x,y,z,r])=>{const g=new THREE.IcosahedronGeometry(r,1);g.translate(x,y,z);return g;}));
{const p=leafGeo.attributes.position;for(let i=0;i<p.count;i++){const n=Math.sin(p.getX(i)*3.1+p.getY(i)*2.3)*.12;p.setXYZ(i,p.getX(i)*(1+n),p.getY(i)*(1+n*.5),p.getZ(i)*(1+n));}leafGeo.computeVertexNormals();}
const leafMat=new THREE.MeshStandardMaterial({color:0x4a7a30,roughness:.85,flatShading:true});
const trunkGeo=new THREE.CylinderGeometry(.18,.32,4.2,7);trunkGeo.translate(0,2.1,0);
const NT=QL.trees,nPine=Math.floor(NT*.65),nLeaf=NT-nPine;
const trunks=new THREE.InstancedMesh(trunkGeo,barkMat,NT),pines=new THREE.InstancedMesh(pineGeo,pineMat,nPine),leafs=new THREE.InstancedMesh(leafGeo,leafMat,nLeaf);
const col=new THREE.Color();
for(let i=0;i<NT;i++){let x,z;do{const a=Math.random()*6.283,r=rnd(17,R+25);x=Math.cos(a)*r;z=Math.sin(a)*r;}while(H(x,z)<WL+.6);
 const s=rnd(.8,1.5),y=H(x,z)-.2;QQ.setFromEuler(E.set(0,rnd(0,6.28),0));M4.compose(P3.set(x,y,z),QQ,S3.set(s,s,s));trunks.setMatrixAt(i,M4);
 if(i<nPine){pines.setMatrixAt(i,M4);pines.setColorAt(i,col.setHSL(rnd(.26,.33),rnd(.35,.5),rnd(.18,.26)));}else{leafs.setMatrixAt(i-nPine,M4);leafs.setColorAt(i-nPine,col.setHSL(rnd(.2,.3),rnd(.4,.55),rnd(.22,.32)));}
 if(Math.hypot(x,z)<R)obstacles.push({x,z,r:.35*s});}
[trunks,pines,leafs].forEach(m=>{m.castShadow=true;m.receiveShadow=true;scene.add(m);});
// rocks
const rockGeo=new THREE.DodecahedronGeometry(1,1);{const p=rockGeo.attributes.position;for(let i=0;i<p.count;i++){const v=P3.fromBufferAttribute(p,i),n=1+.18*Math.sin(v.x*4+v.y*3)*Math.cos(v.z*5);p.setXYZ(i,v.x*n,v.y*n,v.z*n);}rockGeo.computeVertexNormals();}
const rocks=new THREE.InstancedMesh(rockGeo,new THREE.MeshStandardMaterial({map:tex('rock_c.jpg',1,true),normalMap:tex('rock_n.jpg',1),roughness:.9}),QL.rocks);
for(let i=0;i<QL.rocks;i++){let x,z;do{x=rnd(-R,R);z=rnd(-R,R);}while(Math.hypot(x,z)>R-3||Math.hypot(x,z)<14||inWater(x,z));const s=rnd(.5,2.1);
 M4.compose(P3.set(x,H(x,z)+s*.25,z),QQ.setFromEuler(E.set(rnd(0,3),rnd(0,3),0)),S3.set(s,s*rnd(.5,.9),s*rnd(.8,1.2)));rocks.setMatrixAt(i,M4);obstacles.push({x,z,r:s*.9});}
rocks.castShadow=rocks.receiveShadow=true;scene.add(rocks);
// grass (instanced blades with wind)
const grassU={time:{value:0}};
{const bl=[];for(let k=0;k<3;k++){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-.035,0,0,.035,0,0,.0,.38,0],3));g.setAttribute('color',new THREE.Float32BufferAttribute([.12,.22,.06,.12,.22,.06,.38,.55,.18],3));g.rotateY(k*2.1);g.rotateX(rnd(-.2,.2));g.translate(rnd(-.1,.1),0,rnd(-.1,.1));bl.push(g);}
 const gg=mergeGeometries(bl);gg.computeVertexNormals();
 const gm=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
 gm.onBeforeCompile=s=>{s.uniforms.time=grassU.time;s.vertexShader='uniform float time;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n float ph=instanceMatrix[3].x*.35+instanceMatrix[3].z*.27; transformed.x+=sin(time*1.8+ph)*.09*position.y; transformed.z+=cos(time*1.3+ph)*.05*position.y;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>');};
 const gi=new THREE.InstancedMesh(gg,gm,QL.grass);let n=0;
 const centers=[];for(let i=0;i<70;i++)centers.push([rnd(-R,R),rnd(-R,R)]);
 while(n<QL.grass){const c=centers[n%centers.length],x=c[0]+rnd(-9,9),z=c[1]+rnd(-9,9);if(Math.hypot(x,z)>R-1||Math.hypot(x,z)<11||H(x,z)<WL+.3){n++;M4.makeScale(0,0,0);gi.setMatrixAt(n-1,M4);continue;}
  const s=rnd(.7,1.6);M4.compose(P3.set(x,H(x,z)-.03,z),QQ.setFromEuler(E.set(0,rnd(0,6.28),0)),S3.set(s,s*rnd(.8,1.4),s));gi.setMatrixAt(n++,M4);}
 gi.receiveShadow=false;scene.add(gi);}

// ---------- items ----------
const WEAPONS={fists:{n:'Fists',dmg:8,rng:1.9,cd:.45},knife:{n:'Knife',dmg:18,rng:2.2,cd:.4},spear:{n:'Spear',dmg:28,rng:3.3,cd:.75},axe:{n:'Axe',dmg:34,rng:2.4,cd:.9}};
let items=[];
function addItem(type,x,z){const m=itemMesh(type);m.position.set(x,H(x,z),z);m.rotation.y=rnd(0,6.28);scene.add(m);items.push({type,m,x,z,ph:rnd(0,6)});}
function spawnItems(){items.forEach(i=>scene.remove(i.m));items=[];
 const near=['knife','knife','spear','spear','axe','knife','spear','food','food','water','water','food','axe','knife','water','food'];
 near.forEach((t,i)=>{const a=i/near.length*6.283,r=rnd(5,10);addItem(t,Math.cos(a)*r,Math.sin(a)*r);});
 for(let i=0;i<45;i++){let x,z;do{x=rnd(-R+5,R-5);z=rnd(-R+5,R-5);}while(Math.hypot(x,z)>R-5||inWater(x,z));addItem(i<30?'berries':i<38?'food':i<42?'water':'knife',x,z);}}

// ---------- first-person arms ----------
const fpArms=new THREE.Group();camera.add(fpArms);
const skinMat=new THREE.MeshStandardMaterial({color:0xd9a27c,roughness:.6}),sleeveMat=new THREE.MeshStandardMaterial({color:0x666666,roughness:.8});
{const sleeve=new THREE.Mesh(new THREE.CylinderGeometry(.06,.07,.3,10),sleeveMat);sleeve.rotation.x=Math.PI/2;sleeve.position.z=0;
 const arm=new THREE.Mesh(new THREE.CylinderGeometry(.045,.055,.16,10),skinMat);arm.rotation.x=Math.PI/2;arm.position.z=-.22;
 const fist=new THREE.Mesh(new THREE.SphereGeometry(.06,10,8),skinMat);fist.scale.set(1,.85,1.2);fist.position.z=-.33;
 fpArms.add(sleeve,arm,fist);fpArms.position.set(.3,-.3,-.5);fpArms.rotation.set(.1,.45,0);}
let fpWeapon=null;
function setWeaponModel(){if(fpWeapon)fpArms.remove(fpWeapon);fpWeapon=null;const t=player.weapon;
 const u=player.fig.userData;if(u.weap){u.weap.parent.remove(u.weap);u.weap=null;}
 if(t==='fists')return;fpWeapon=weaponMesh(t);fpWeapon.position.set(0,0,-.33);fpWeapon.rotation.x=-.25;fpArms.add(fpWeapon);
 attachWeapon(player);}
function attachWeapon(e){const u=e.fig.userData;if(u.weap){u.weap.parent.remove(u.weap);u.weap=null;}if(e.weapon==='fists'||!u.hand)return;
 const w=weaponMesh(e.weapon);e.fig.updateMatrixWorld(true);const ws=new THREE.Vector3();u.hand.getWorldScale(ws);w.scale.setScalar(1/ws.x);w.rotation.set(Math.PI/2,0,0);w.position.set(0,.08/ws.x,0);u.hand.add(w);u.weap=w;}

// ---------- entities ----------
let ents=[],player=null,zoneR=R,time=0,running=false,camMode=isTouch?'third':'first',yaw=0,pitch=0;
const dayLen=150;
function makeEnt(cfg,isPlayer){const fig=makeFigure(cfg.model,cfg.c,cfg.scale||1);scene.add(fig);return{name:cfg.name,d:cfg.d,fig,isPlayer,hp:cfg.hp,maxhp:cfg.hp,spd:cfg.spd,str:cfg.str,stl:cfg.stl,hunger:100,thirst:100,weapon:'fists',x:0,z:0,y:0,vy:0,dir:0,cd:0,alive:true,swing:0,flash:0,think:0,tx:0,tz:0,target:null,aggro:rnd(.3,1),speed:0,deadT:0};}
function startGame(){
 audio();ents.forEach(e=>scene.remove(e.fig));ents=[];spawnItems();zoneR=R;time=0;
 const pcfg=CHARS[sel];player=makeEnt(pcfg,true);ents.push(player);sleeveMat.color.setHex(pcfg.c);
 const others=[];for(let d=1;d<=12;d++)for(let k=0;k<2;k++)others.push(d);others.splice(others.indexOf(pcfg.d),1);
 const names=FIRST.slice().sort(()=>Math.random()-.5);
 others.forEach((d,i)=>{const c=new THREE.Color().setHSL(Math.random(),.55,.45).getHex();ents.push(makeEnt({name:names[i],d,c,hp:rnd(80,130)|0,spd:rnd(.8,1.15),str:rnd(.8,1.3),stl:.5,model:Math.random()<.5?'Soldier':'Xbot',scale:rnd(.9,1.1)},false));});
 ents.forEach((e,i)=>{const a=i/24*6.283;e.x=Math.cos(a)*17;e.z=Math.sin(a)*17;e.y=H(e.x,e.z);e.dir=Math.atan2(-e.x,-e.z);e.tx=e.x;e.tz=e.z;});
 yaw=player.dir+Math.PI;pitch=0;
 ['select','end'].forEach(s=>$(s).classList.add('hidden'));['hud','count','cross'].forEach(s=>$(s).classList.remove('hidden'));
 if(isTouch){$('touch').classList.remove('hidden');$('btns').classList.remove('hidden');}
 renderer.domElement.style.display='block';running=true;setCam();fpsLog=[];
 announce('Let the Games begin!');$('hint').textContent=isTouch?'':'Click to lock mouse';updateCount();}
$('start').onclick=startGame;$('retry').onclick=startGame;
$('newchar').onclick=()=>{$('end').classList.add('hidden');$('select').classList.remove('hidden');renderer.domElement.style.display='none';};
loadP.then(()=>{$('start').disabled=false;$('start').textContent='Enter the Arena';setPreview();}).catch(e=>{$('start').textContent='Failed to load models';console.error(e);});
let msgT;function announce(t){const m=$('msg');m.textContent=t;m.style.opacity=1;clearTimeout(msgT);msgT=setTimeout(()=>m.style.opacity=0,3000);}
function alive(){return ents.filter(e=>e.alive);}
function updateCount(){$('count').innerHTML=`Tributes remaining: ${alive().length}`;}
function kill(e,by){if(!e.alive)return;e.alive=false;e.deadT=0;for(const k in e.fig.userData.acts)e.fig.userData.acts[k].fadeOut(.3);
 setTimeout(()=>scene.remove(e.fig),6000);
 if(e.weapon!=='fists'){addItem(e.weapon,e.x+1,e.z);const u=e.fig.userData;if(u.weap){u.weap.parent.remove(u.weap);u.weap=null;}}
 cannon();updateCount();
 if(e.isPlayer){camMode='third';setCam();return endGame(false,by);}announce(`BOOM! ${e.name}, District ${e.d}, has fallen${by&&by.isPlayer?' (by you)':''}`);
 if(player.alive&&alive().length===1)endGame(true);}
function endGame(win,by){running=false;if(document.pointerLockElement)document.exitPointerLock();
 $('endTitle').textContent=win?'VICTOR!':'YOU DIED';$('endTitle').style.color=win?'#f5b942':'#e33';
 const mins=Math.floor(time/60),secs=Math.floor(time%60);
 $('final').innerHTML=win?`${player.name} of District ${player.d} wins the Games!<br>Survived ${mins}m ${secs}s`:`Placed #${alive().length+1} of 24 · survived ${mins}m ${secs}s${by?`<br>Killed by ${by.name||by}`:''}`;
 setTimeout(()=>{$('end').classList.remove('hidden');['touch','btns','cross'].forEach(s=>$(s).classList.add('hidden'));},win?600:1800);}
function attack(a){if(a.cd>0||!a.alive)return;const w=WEAPONS[a.weapon];a.cd=w.cd;a.swing=.3;if(a.isPlayer)tone(220,.08,'square',.08,110);
 const fx=Math.sin(a.dir),fz=Math.cos(a.dir);let best=null,bd=1e9;
 for(const e of ents){if(e===a||!e.alive)continue;const dx=e.x-a.x,dz=e.z-a.z,d=Math.hypot(dx,dz);if(d>w.rng+.4)continue;if((dx*fx+dz*fz)/(d||1)<.4)continue;if(d<bd){bd=d;best=e;}}
 if(best){const dmg=w.dmg*a.str*rnd(.85,1.15)*(best.isPlayer?.55:1);best.hp-=dmg;best.flash=.2;best.x+=fx*.6;best.z+=fz*.6;if(!best.isPlayer)best.target=a;if(best.isPlayer||a.isPlayer)tone(140,.12,'sawtooth',.15,60);if(best.hp<=0)kill(best,a);}}
function pickup(e){let best=null,bd=2.6;for(const it of items){const d=Math.hypot(it.x-e.x,it.z-e.z);if(d<bd){bd=d;best=it;}}
 if(best){scene.remove(best.m);items.splice(items.indexOf(best),1);const t=best.type;
  if(WEAPONS[t]){if(e.weapon!=='fists')addItem(e.weapon,e.x+.8,e.z+.8);e.weapon=t;if(e.isPlayer){announce('Picked up '+WEAPONS[t].n);setWeaponModel();}else attachWeapon(e);}
  else if(t==='berries'){e.hunger=Math.min(100,e.hunger+20);e.hp=Math.min(e.maxhp,e.hp+5);if(e.isPlayer)announce('Ate berries');}
  else if(t==='food'){e.hunger=Math.min(100,e.hunger+45);e.hp=Math.min(e.maxhp,e.hp+10);if(e.isPlayer)announce('Ate rations');}
  else if(t==='water'){e.thirst=Math.min(100,e.thirst+50);if(e.isPlayer)announce('Drank water');}
  if(e.isPlayer)tone(660,.1,'triangle',.15,990);return true;}
 if(nearWater(e)){e.thirst=Math.min(100,e.thirst+35);if(e.isPlayer){announce('You drink from the water');tone(500,.15,'sine',.12,300);}return true;}return false;}
function nearWater(e){for(const[dx,dz]of[[0,0],[2,0],[-2,0],[0,2],[0,-2]])if(H(e.x+dx,e.z+dz)<WL)return true;return false;}
function setCam(){if(player)player.fig.visible=camMode==='third'||!player.alive;fpArms.visible=camMode==='first'&&player&&player.alive;if(player)setWeaponModel();}

// ---------- input (desktop) ----------
const keys={};let moveX=0,moveY=0;
addEventListener('keydown',e=>{keys[e.code]=true;if(!running)return;if(e.code==='KeyE')pickup(player);if(e.code==='KeyV'){camMode=camMode==='first'?'third':'first';setCam();}if(e.code==='Space'&&player.vy===0)player.vy=6;});
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
function btn(k){if(!running)return;if(k==='atk')attack(player);if(k==='jump'&&player.vy===0)player.vy=6;if(k==='use')pickup(player);if(k==='cam'){camMode=camMode==='first'?'third':'first';setCam();}}
document.querySelectorAll('#btns div').forEach(b=>{b.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();audio();if(b.dataset.b==='atk')atkHeld=true;btn(b.dataset.b);},{passive:false});
 b.addEventListener('touchend',e=>{e.preventDefault();if(b.dataset.b==='atk')atkHeld=false;});
 b.addEventListener('mousedown',e=>{e.stopPropagation();btn(b.dataset.b);});});

// ---------- simulation ----------
function collide(e){for(const o of obstacles){const dx=e.x-o.x,dz=e.z-o.z,d2=dx*dx+dz*dz,r=o.r+.35;if(d2<r*r&&d2>1e-6){const d=Math.sqrt(d2);e.x=o.x+dx/d*r;e.z=o.z+dz/d*r;}}
 const d=Math.hypot(e.x,e.z);if(d>R-1){e.x*=(R-1)/d;e.z*=(R-1)/d;}}
function move(e,mx,mz,dt){const ox=e.x,oz=e.z;const sp=4.6*e.spd*(inWater(e.x,e.z)?.5:1)*(e.hunger<=0||e.thirst<=0?.7:1);e.x+=mx*sp*dt;e.z+=mz*sp*dt;collide(e);e.speed=Math.hypot(e.x-ox,e.z-oz)/dt;}
function isNight(){const p=(time/dayLen)%1;return p>.55&&p<.95;}
function aiThink(e){
 const night=isNight(),dz=Math.hypot(e.x,e.z);
 if(e.target&&(!e.target.alive||Math.hypot(e.target.x-e.x,e.target.z-e.z)>25))e.target=null;
 if(!e.target&&time>12){let best=null,bd=1e9;for(const o of ents){if(o===e||!o.alive)continue;let sight=(o.isPlayer?14*(1.3-o.stl):11)*(night?.6:1)*e.aggro*(o.isPlayer?.8:1)*(e.weapon!=='fists'?1.3:1);const d=Math.hypot(o.x-e.x,o.z-e.z);if(d<sight&&d<bd){bd=d;best=o;}}
  if(best&&(e.hp>e.maxhp*.3))e.target=best;}
 if(e.hp<e.maxhp*.25&&e.target&&Math.random()<.5)e.target=null;
 if(!e.target){
  if(dz>zoneR-8){const a=Math.atan2(e.z,e.x);const r=Math.max(0,zoneR*.5);e.tx=Math.cos(a)*r;e.tz=Math.sin(a)*r;return;}
  if(e.thirst<40){if(nearWater(e))pickup(e);else{e.tx=LAKE.x;e.tz=LAKE.z;return;}}
  let want=null,bd=18;
  for(const it of items){if(WEAPONS[it.type]&&e.weapon!=='fists'&&WEAPONS[it.type].dmg<=WEAPONS[e.weapon].dmg)continue;if(!WEAPONS[it.type]&&e.hunger>70&&it.type!=='water')continue;const d=Math.hypot(it.x-e.x,it.z-e.z);if(d<bd){bd=d;want=it;}}
  if(want){e.tx=want.x;e.tz=want.z;if(bd<2)pickup(e);return;}
  if(Math.hypot(e.tx-e.x,e.tz-e.z)<2||Math.random()<.05){const a=Math.random()*6.283,r=Math.random()*Math.min(zoneR-5,R-5);e.tx=Math.cos(a)*r;e.tz=Math.sin(a)*r;}}}
let frameNo=0;
function animateFig(e,dt){const f=e.fig,u=f.userData;
 if(!e.alive){e.deadT+=dt;const k=Math.min(1,e.deadT*2.2);u.obj.rotation.x=-k*k*Math.PI/2;u.obj.position.y=k*.15;u.mixer.update(dt);return;}
 const dist=player?Math.hypot(e.x-player.x,e.z-player.z):0;f.visible=(e.isPlayer?(camMode==='third'||!e.alive):dist<QL.fog+10);
 if(!f.visible&&!e.isPlayer)return;
 const s=e.speed;if(s<.4)setAnim(f,'idle');else if(s<3.6)setAnim(f,'walk',s/2.4);else setAnim(f,'run',s/5.2);
 u.acc+=dt;const every=dist>45?3:dist>25?2:1;if(e.isPlayer||frameNo%every===0){u.mixer.update(u.acc);u.acc=0;}
 poseOverlay(f,e.swing);
 const fl=e.flash>0;for(const m of u.mats)m.emissive.setRGB(fl?.6:0,0,0);}
function updateEnt(e,dt){
 if(!e.alive)return;e.cd-=dt;e.swing=Math.max(0,e.swing-dt);e.flash=Math.max(0,e.flash-dt);
 e.hunger-=dt*(e.isPlayer?.55:.3);e.thirst-=dt*(e.isPlayer?.8:.4);
 if(e.hunger<0){e.hunger=0;e.hp-=dt*1.5;}if(e.thirst<0){e.thirst=0;e.hp-=dt*2.5;}
 if(Math.hypot(e.x,e.z)>zoneR){e.hp-=dt*8;if(e.isPlayer)$('danger').style.opacity=1;}else if(e.isPlayer)$('danger').style.opacity=0;
 if(e.hunger>60&&e.thirst>60)e.hp=Math.min(e.maxhp,e.hp+dt*.6);
 if(e.hp<=0)return kill(e,Math.hypot(e.x,e.z)>zoneR?'the firestorm':e.hunger<=0||e.thirst<=0?'starvation & thirst':null);
 e.speed=0;
 if(e.isPlayer){let mx=(keys.KeyD?1:0)-(keys.KeyA?1:0)+moveX,mz=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)+moveY;
  if(keys.ArrowLeft)yaw+=dt*2;if(keys.ArrowRight)yaw-=dt*2;const l=Math.hypot(mx,mz);if(l>1){mx/=l;mz/=l;}
  e.dir=yaw+Math.PI;const fx=Math.sin(e.dir),fz=Math.cos(e.dir),rx=-fz,rz=fx;
  if(l>.05)move(e,fx*mz-rx*mx,fz*mz-rz*mx,dt);if(atkHeld)attack(e);}
 else{e.think-=dt;if(e.think<=0){e.think=rnd(.3,.6);aiThink(e);}
  let tx=e.tx,tz=e.tz;if(e.target){tx=e.target.x;tz=e.target.z;}
  const dx=tx-e.x,dz=tz-e.z,d=Math.hypot(dx,dz);
  if(e.target&&d<WEAPONS[e.weapon].rng*.9){e.dir=Math.atan2(dx,dz);if(Math.random()<dt*(e.target.isPlayer?1.6:3))attack(e);}
  else if(d>.5){const want=Math.atan2(dx,dz);let dd=want-e.dir;dd=Math.atan2(Math.sin(dd),Math.cos(dd));e.dir+=dd*Math.min(1,dt*8);move(e,dx/d*(e.target?1:.55),dz/d*(e.target?1:.55),dt);}}
 const gy=Math.max(H(e.x,e.z),WL-.9);e.vy-=18*dt;e.y+=e.vy*dt;if(e.y<=gy){e.y=gy;e.vy=0;}
 e.fig.position.set(e.x,e.y,e.z);e.fig.rotation.y=e.dir;}

// ---------- loop ----------
const clock=new THREE.Clock(),skyDay=new THREE.Color(0xb8d0e0),skyDusk=new THREE.Color(0xd09070),skyNight=new THREE.Color(0x0a1022),fogC=new THREE.Color(),sunV=new THREE.Vector3();
let hudT=0,fpsLog=[],fpsT=0,fpsN=0,fpsNow=0;
function updateSky(){const p=(time/dayLen)%1,a=p*Math.PI*2+.8,elev=Math.sin(a);
 sunV.set(Math.cos(a)*.8,elev,.45).normalize();su.sunPosition.value.copy(sunV);
 const day=sstep(-.12,.35,elev);fogC.copy(skyNight).lerp(skyDusk,sstep(-.15,.05,elev)).lerp(skyDay,sstep(.05,.35,elev));scene.fog.color.copy(fogC);
 const moon=elev<0;const L=moon?sunV.clone().negate():sunV;sun.intensity=moon?.35:2.6*day;sun.color.setHex(moon?0x8aa4ff:0xfff0d8);hemi.intensity=.12+.55*day;
 renderer.toneMappingExposure=.35+.6*day;scene.environmentIntensity=undefined;envScale(.15+.85*day);
 const c=player||{x:0,z:0,y:0};sun.position.set(c.x+L.x*80,c.y+Math.max(.15,L.y)*80,c.z+L.z*80);sun.target.position.set(c.x,c.y,c.z);
 if(water.material.uniforms&&water.material.uniforms.sunDirection)water.material.uniforms.sunDirection.value.copy(L);
 return day;}
const envMats=[];scene.traverse(o=>{if(o.material&&o.material.isMeshStandardMaterial)envMats.push([o.material,o.material.envMapIntensity]);});
let lastEnv=-1;function envScale(k){if(Math.abs(k-lastEnv)<.03)return;lastEnv=k;for(const[m,b]of envMats)m.envMapIntensity=b*k;}
function loop(){requestAnimationFrame(loop);const dt=Math.min(clock.getDelta(),.05);frameNo++;
 if(renderer.domElement.style.display==='none')return;
 if(running){time+=dt;applyLook(dt);
  zoneR=THREE.MathUtils.clamp(R-(time-60)/420*(R-12),12,R);zoneMesh.scale.set(zoneR,1,zoneR);
  if(Math.abs(time-60)<dt)announce('The firestorm is closing in!');
  for(const e of ents)updateEnt(e,dt);}
 for(const e of ents)animateFig(e,dt);
 updateSky();grassU.time.value+=dt;
 if(water.material.uniforms&&water.material.uniforms.time)water.material.uniforms.time.value+=dt*.5;else if(simpleWaterMat){wnorm.offset.x+=dt*.01;wnorm.offset.y+=dt*.006;}
 zoneMesh.material.opacity=.22+.08*Math.sin(time*3);
 if(player){const hy=player.y+1.62*(CHARS[sel].scale||1);
  if(camMode==='first'&&player.alive){camera.position.set(player.x,hy,player.z);camera.rotation.set(pitch,yaw,0,'YXZ');}
  else{const back=4.2,cx=player.x+Math.sin(yaw)*back*Math.cos(pitch),cz=player.z+Math.cos(yaw)*back*Math.cos(pitch),cy=hy+.5-Math.sin(pitch)*back;camera.position.set(cx,Math.max(H(cx,cz)+.4,cy),cz);camera.lookAt(player.x,hy+.1,player.z);
   if(!player.alive){camera.position.y+=1.5;camera.lookAt(player.x,player.y,player.z);}}
  const sw=player.swing>0?Math.sin((1-player.swing/.3)*Math.PI):0;fpArms.rotation.x=.1-sw*.9;fpArms.position.z=-.5-sw*.15;
  const bob=player.speed>.5?Math.sin(time*11)*.012:0;fpArms.position.y=-.3+bob;}
 hudT-=dt;if(hudT<=0&&player){hudT=.15;$('hp').style.width=Math.max(0,player.hp/player.maxhp*100)+'%';$('hu').style.width=player.hunger+'%';$('th').style.width=player.thirst+'%';
  $('weap').textContent='Weapon: '+WEAPONS[player.weapon].n;$('dayl').textContent=`Day ${Math.floor(time/dayLen)+1} · ${isNight()?'Night 🌙':'Day ☀'} · ${Math.round(fpsNow)} fps`;
  let near=items.some(it=>Math.hypot(it.x-player.x,it.z-player.z)<2.6);$('hint').textContent=running&&near?(isTouch?'Tap GRAB to pick up':'Press E to pick up'):running&&nearWater(player)?(isTouch?'Tap GRAB to drink':'Press E to drink'):(!isTouch&&running&&document.pointerLockElement!==cv?'Click to lock mouse':'');}
 for(const it of items){it.ph+=dt;if(it.type in WEAPONS)it.m.rotation.y+=dt*.8;}
 if(composer)composer.render();else renderer.render(scene,camera);
 // fps + adaptive resolution
 fpsN++;const nowT=performance.now()/1000;if(!fpsT)fpsT=nowT;if(nowT-fpsT>=2){fpsNow=fpsN/(nowT-fpsT);fpsLog.push(fpsNow);fpsT=nowT;fpsN=0;if(0){}
  if(running&&qSetting==='auto'&&fpsNow<28&&pixelRatio>.7){pixelRatio=Math.max(.7,pixelRatio-.2);renderer.setPixelRatio(pixelRatio);if(composer){composer=null;}}
  else if(running&&qSetting==='auto'&&fpsNow>55&&pixelRatio<Math.min(devicePixelRatio,QL.pr)){pixelRatio=Math.min(Math.min(devicePixelRatio,QL.pr),pixelRatio+.1);renderer.setPixelRatio(pixelRatio);}}}
loop();
window.__game={tp:(x,z,yw)=>{player.x=x;player.z=z;yaw=yw;},get player(){return player},get ents(){return ents},setCam:m=>{camMode=m;setCam();},get fps(){return fpsLog},quality:qName,get pr(){return pixelRatio},swing:()=>{player.swing=.3;}};
