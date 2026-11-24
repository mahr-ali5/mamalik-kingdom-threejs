import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = id => document.getElementById(id);
const status = $('status'), loading = $('loading'), toastEl = $('toast');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9bb58a);
scene.fog = new THREE.Fog(0x9bb58a, 85, 230);
const camera = new THREE.PerspectiveCamera(48, 1, .1, 500);
camera.position.set(35, 32, 42);
const renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('viewport').appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0,0,0); controls.enableDamping=true; controls.maxPolarAngle=Math.PI*.48;
controls.minDistance=12; controls.maxDistance=100;
scene.add(new THREE.HemisphereLight(0xe8f2d8,0x59664a,2.0));
const sun = new THREE.DirectionalLight(0xffedcf,2.2);
sun.position.set(-35,65,25); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-90;sun.shadow.camera.right=90;sun.shadow.camera.top=90;sun.shadow.camera.bottom=-90;scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(220,220),new THREE.MeshStandardMaterial({color:0x718d59,roughness:1}));
ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.name='ground';scene.add(ground);
const grid = new THREE.GridHelper(180,90,0x526d45,0x71875d);grid.position.y=.025;grid.material.transparent=true;grid.material.opacity=.13;scene.add(grid);
const water = new THREE.Mesh(new THREE.PlaneGeometry(220,32),new THREE.MeshStandardMaterial({color:0x4d91a0,roughness:.65}));
water.rotation.x=-Math.PI/2;water.position.set(0,-.08,-83);scene.add(water);
const loader = new FBXLoader();
let manifest=[], cache=new Map(), placed=[], ghost=null, selected=null, buildMode=true, explorer=false;
let resources={wood:500,stone:350,gold:250,food:400};
const keys={};
const player = new THREE.Mesh(new THREE.CapsuleGeometry(.55,.9,4,8),new THREE.MeshStandardMaterial({color:0x315b91}));
player.position.set(5,0,5);player.visible=false;scene.add(player);
const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2();
const groundPlane=ground;
function toast(msg){toastEl.textContent=msg;toastEl.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>toastEl.classList.remove('show'),2100);}
function resize(){const r=$('viewport').getBoundingClientRect();camera.aspect=r.width/Math.max(1,r.height);camera.updateProjectionMatrix();renderer.setSize(r.width,r.height,false);}
new ResizeObserver(resize).observe($('viewport'));resize();
function modelSize(obj){const b=new THREE.Box3().setFromObject(obj);const size=b.getSize(new THREE.Vector3());return Math.max(size.x,size.y,size.z)||1;}
function prepareModel(obj,target=5){obj.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(obj);const size=box.getSize(new THREE.Vector3());const scale=target/Math.max(size.x,size.y,size.z,0.001);obj.scale.multiplyScalar(scale);obj.updateMatrixWorld(true);const b2=new THREE.Box3().setFromObject(obj);obj.position.y-=b2.min.y;obj.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;if(n.material){const mats=Array.isArray(n.material)?n.material:[n.material];for(const m of mats){if(m.map)m.map.colorSpace=THREE.SRGBColorSpace;}}}});return obj;}
async function getModel(item){if(cache.has(item.file))return cache.get(item.file);const promise=new Promise((resolve,reject)=>loader.load('./'+item.file,resolve,undefined,reject));cache.set(item.file,promise);return promise;}
async function instantiate(item,position,preview=false){const source=await getModel(item);const obj=prepareModel(source.clone(true),item.category==='الطبيعة والموارد'?6:5);obj.position.copy(position);obj.userData.asset=item.file;obj.userData.displayName=item.name;if(preview){obj.traverse(n=>{if(n.isMesh){const old=n.material;n.material=(Array.isArray(old)?old:[old]).map(m=>{const c=m.clone();c.transparent=true;c.opacity=.55;return c;});}});}return obj;}
function setStatus(t){status.textContent=t;}
function updateResources(){for(const k of Object.keys(resources))$(k).textContent=resources[k];}
function showTab(name){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));document.querySelectorAll('.tab-content').forEach(s=>s.classList.toggle('hidden',s.id!==name));}
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{buildMode=b.dataset.mode==='build';explorer=!buildMode;player.visible=explorer;controls.enabled=!explorer;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));$('hint').textContent=explorer?'الاستكشاف: استخدم WASD أو الأسهم للتحرك':'اسحب لتدوير الكاميرا • اختر مبنى ثم اضغط على الأرض لوضعه';if(ghost){scene.remove(ghost);ghost=null;}toast(explorer?'بدأ وضع الاستكشاف':'بدأ وضع البناء');}));
function populate(){const cats=['الكل',...new Set(manifest.map(m=>m.category))];$('category').innerHTML=cats.map(c=>`<option>${c}</option>`).join('');fillModels();$('category').addEventListener('change',fillModels);$('model').addEventListener('change',()=>{selected=manifest.find(m=>m.file===$('model').value);$('modelName').textContent=selected?.name||'';$('modelCategory').textContent=selected?.category||'';});const quick=['مركز المدينة','منازل','الزراعة','التجارة والتخزين','الدفاع والتحصينات','التدريب والجيش'];$('quickBuild').innerHTML=quick.map((c,i)=>`<button data-quick="${c}">${['🏰 مركز المدينة','🏠 منزل','🌾 مزرعة','🛒 سوق','🛡️ برج دفاع','⚔️ ثكنة'][i]}</button>`).join('');document.querySelectorAll('[data-quick]').forEach(b=>b.addEventListener('click',()=>{const item=manifest.find(m=>m.category===b.dataset.quick);if(item){$('category').value=b.dataset.quick;fillModels();$('model').value=item.file;selected=item;$('modelName').textContent=item.name;$('modelCategory').textContent=item.category;startPlacement();}}));}
function fillModels(){const cat=$('category').value||'الكل';const list=manifest.filter(m=>cat==='الكل'||m.category===cat);$('model').innerHTML=list.map(m=>`<option value="${m.file}">${m.name}</option>`).join('');selected=list[0]||null;if(selected){$('modelName').textContent=selected.name;$('modelCategory').textContent=selected.category;}else{$('modelName').textContent='لم ترفع المجسمات بعد';$('modelCategory').textContent='بانتظار ملفات FBX';}}
async function startPlacement(){if(!selected){toast('لا توجد مجسمات في الكتالوج بعد');return;}buildMode=true;explorer=false;player.visible=false;controls.enabled=true;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode==='build'));if(ghost)scene.remove(ghost);try{ghost=await instantiate(selected,new THREE.Vector3(0,0,0),true);scene.add(ghost);toast('اضغط على الأرض لتثبيت المبنى');}catch(e){console.error(e);toast('تعذر تحميل هذا النموذج');}}
$('placeBtn').addEventListener('click',startPlacement);
$('cancelBtn').addEventListener('click',()=>{if(ghost)scene.remove(ghost);ghost=null;toast('تم إلغاء وضع المبنى');});
function hitGround(ev){const rect=renderer.domElement.getBoundingClientRect();pointer.x=((ev.clientX-rect.left)/rect.width)*2-1;pointer.y=-((ev.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObject(groundPlane);return hits[0]?.point||null;}
let downAt=null;
renderer.domElement.addEventListener('pointerdown',e=>{downAt={x:e.clientX,y:e.clientY};});
renderer.domElement.addEventListener('pointerup',async e=>{if(!downAt)return;const moved=Math.hypot(e.clientX-downAt.x,e.clientY-downAt.y);downAt=null;if(moved>7||!buildMode||!ghost)return;const p=hitGround(e);if(!p)return;const pos=new THREE.Vector3(Math.round(p.x/2)*2,0,Math.round(p.z/2)*2);const clone=ghost;ghost=null;scene.remove(clone);try{const obj=await instantiate(selected,pos,false);scene.add(obj);placed.push({file:selected.file,x:pos.x,z:pos.z});resources.wood=Math.max(0,resources.wood-25);resources.stone=Math.max(0,resources.stone-10);updateResources();toast(`تم وضع ${selected.name}`);}catch(err){console.error(err);toast('فشل وضع المجسم');}});
renderer.domElement.addEventListener('pointermove',e=>{if(!ghost||!buildMode)return;const p=hitGround(e);if(p){ghost.position.set(Math.round(p.x/2)*2,0,Math.round(p.z/2)*2);}});
function save(){const data={placed,resources};try{localStorage.setItem('mamalik-save-v1',JSON.stringify(data));toast('تم حفظ المدينة على هذا الجهاز');}catch(e){toast('تعذر الحفظ في هذا المتصفح');}}
$('saveBtn').addEventListener('click',save);
async function loadSave(){try{const data=JSON.parse(localStorage.getItem('mamalik-save-v1')||'null');if(!data)return;resources={...resources,...data.resources};updateResources();for(const p of data.placed||[]){const item=manifest.find(m=>m.file===p.file);if(item){const obj=await instantiate(item,new THREE.Vector3(p.x,0,p.z));scene.add(obj);placed.push(p);}}}catch(e){console.warn('Save load failed',e);}}
window.addEventListener('keydown',e=>keys[e.key.toLowerCase()]=true);window.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
function movePlayer(dt){if(!explorer)return;const v=new THREE.Vector3((keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0),0,(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0));if(v.lengthSq()){v.normalize().multiplyScalar(10*dt);player.position.add(v);camera.position.add(v);controls.target.copy(player.position);}}
let previous=performance.now();
function animate(now){requestAnimationFrame(animate);const dt=Math.min((now-previous)/1000,.04);previous=now;movePlayer(dt);controls.update();renderer.render(scene,camera);}
requestAnimationFrame(animate);
async function init(){try{setStatus('قراءة فهرس المجسمات…');const response=await fetch('./assets-manifest.json');if(!response.ok)throw new Error('manifest missing');manifest=await response.json();populate();setStatus(`${manifest.length} مجسم جاهز في الكتالوج`);await loadSave();loading.classList.add('done');toast('أهلاً بك في مملكتك!');}catch(e){console.error(e);loading.textContent='تعذر بدء اللعبة. افتحها عبر خادم أو استضافة ويب.';setStatus('تعذر التحميل');}}
init();