import {Stage} from './stage.mjs';
import {readSelection, resolveSelection, selectionURL} from './state.mjs';

const $=id=>document.getElementById(id);
let catalog, selected, selectedMotion, stage, loading=true, toastTimer;
const hueMap={'愛麗絲':340,'亥珀':225,'灰妲':305,'艾':160,'菲絲':25,'守':195,'絆':35,'柯塔':215,'萊娜':350,'萊爾':270,'代理教主':30,'真教主':15,'解':170,'雷':235};
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3200);}
function updateURL(){if(selected&&selectedMotion)history.replaceState(null,'',selectionURL(location.href,selected.id,selectedMotion.id));}
function showError(error){
  console.error(error);
  loading=false;
  $('loading').hidden=false;$('loading').classList.add('error');
  $('loading-title').textContent='档案暂时未能打开';
  $('loading-detail').textContent=`${error.message || '资源载入失败'}。请检查网络，或切换其他模型重试。`;
  $('retry').hidden=false;$('play').disabled=true;
}
function renderModels(){
  const filter=$('model-search').value.trim().toLowerCase();
  const models=catalog.models.filter(m=>`${m.character} ${m.name} ${m.variant}`.toLowerCase().includes(filter));
  const list=$('model-list');list.replaceChildren();
  const groups=new Map();
  for(const model of models){if(!groups.has(model.character))groups.set(model.character,[]);groups.get(model.character).push(model);}
  for(const [character,variants] of groups){
    const group=document.createElement('div');group.className='character-group';
    const title=document.createElement('div');title.className='group-title';title.textContent=character;group.append(title);
    for(const meta of variants){
      const button=document.createElement('button');button.className='model-card'+(selected?.id===meta.id?' selected':'');
      button.dataset.model=meta.id;button.setAttribute('aria-pressed',String(selected?.id===meta.id));button.title=meta.name;
      const portrait=document.createElement('span');portrait.className='portrait';portrait.style.setProperty('--hue',hueMap[character] || 330);portrait.textContent=character.slice(0,1);
      const copy=document.createElement('span');copy.className='model-copy';
      const name=document.createElement('strong');name.textContent=meta.variant==='主模型'?meta.character:meta.variant;
      const detail=document.createElement('span');detail.textContent=`${meta.motions.length} 个动作 · ${Math.round(meta.bytes/1024/1024)} MB`;
      copy.append(name,detail);
      const arrow=document.createElement('span');arrow.className='model-arrow';arrow.textContent=selected?.id===meta.id?'·':'';
      button.append(portrait,copy,arrow);button.addEventListener('click',()=>chooseModel(meta));group.append(button);
    }
    list.append(group);
  }
  if(!models.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='没有找到这个角色';list.append(empty);}
  $('model-count').textContent=`${models.length} 个模型`;
}
function renderMotions(){
  const filter=$('motion-search').value.trim().toLowerCase();
  const list=$('motion-list');list.replaceChildren();
  $('motion-count').textContent=selected.motions.length;
  selected.motions.forEach((meta,index)=>{
    if(!meta.name.toLowerCase().includes(filter))return;
    const button=document.createElement('button');button.className='motion-item'+(selectedMotion?.id===meta.id?' selected':'');
    button.dataset.motion=meta.id;button.disabled=loading;button.setAttribute('aria-pressed',String(selectedMotion?.id===meta.id));
    const label=document.createElement('span');label.className='motion-label';
    const number=document.createElement('span');number.className='motion-index';number.textContent=selectedMotion?.id===meta.id?'▸':String(index+1).padStart(2,'0');
    const text=document.createElement('span');text.textContent=meta.name;label.append(number,text);
    const duration=document.createElement('span');duration.className='motion-duration';duration.textContent=`${meta.duration.toFixed(2)} s`;
    button.append(label,duration);button.addEventListener('click',()=>chooseMotion(meta));list.append(button);
  });
  if(!list.childElementCount){const empty=document.createElement('p');empty.className='empty';empty.textContent='没有找到这个动作';list.append(empty);}
}
async function chooseModel(meta, motionId){
  selected=meta;
  selectedMotion=meta.motions.find(m=>m.id===motionId)||meta.motions.find(m=>m.id===meta.defaultMotion)||meta.motions[0];
  loading=true;
  $('character-name').replaceChildren(document.createTextNode(meta.character));
  const dot=document.createElement('span');dot.className='name-dot';dot.textContent='.';$('character-name').append(dot);
  $('variant-name').textContent=`${meta.variant} / ${meta.motions.length} 个动作`;
  $('model-info').textContent=`${meta.physics?'PHYSICS ENABLED · ':''}${(meta.bytes/1024/1024).toFixed(1)} MB`;
  $('motion-search').value='';$('play').disabled=true;
  renderModels();renderMotions();updateURL();
  if(!stage)return;
  await stage.load(meta,selectedMotion);
}
async function chooseMotion(meta){
  if(loading||!stage?.model)return;
  selectedMotion=meta;renderMotions();updateURL();
  try{await stage.selectMotion(meta);}catch(error){toast(error.message);}
}
function onPlaying(playing){$('play-symbol').textContent=playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',playing?'暂停':'播放');}

async function boot(){
  try{
    const response=await fetch('./assets/catalog.json');
    if(!response.ok)throw Error(`资源目录请求失败 (${response.status})`);
    catalog=await response.json();
    stage=new Stage($('live2d'),$('stage'),{
      loading(meta){loading=true;$('loading').hidden=false;$('loading').classList.remove('error');$('retry').hidden=true;$('loading-title').textContent=`正在打开${meta.character}的档案`;$('loading-detail').textContent=`模型约 ${(meta.bytes/1024/1024).toFixed(1)} MB，首次载入请稍候`;$('play').disabled=true;},
      ready(meta){if(meta.id!==selected.id)return;loading=false;$('loading').hidden=true;$('play').disabled=false;$('stage-badge').textContent=`LIVE2D / ${meta.variant}`;renderMotions();},
      error:showError,
      motion(meta){$('motion-caption').textContent=meta.name;$('duration').textContent=meta.duration.toFixed(2);},
      playing:onPlaying,
      loop(enabled){
        $('loop').classList.toggle('active',enabled);
        $('loop').setAttribute('aria-pressed',String(enabled));
      },
      time(position,duration){$('current-time').textContent=position.toFixed(2);$('progress').value=duration?position/duration:0;},
      zoom(zoom){$('zoom-reset').textContent=`${Math.round(zoom*100)}%`;},
      fps(value){$('fps').textContent=`${value} FPS`;}
    });
    const initial=resolveSelection(catalog.models,readSelection(location.href));
    await chooseModel(initial.model,initial.motion.id);
  }catch(error){showError(error);}
}
$('model-search').addEventListener('input',()=>catalog&&renderModels());
$('motion-search').addEventListener('input',()=>selected&&renderMotions());
$('retry').addEventListener('click',()=>stage&&selected?chooseModel(selected,selectedMotion.id):location.reload());
$('play').addEventListener('click',()=>stage?.togglePlay().catch(showError));
$('restart').addEventListener('click',()=>selectedMotion&&chooseMotion(selectedMotion));
$('speed').addEventListener('change',event=>{if(stage)stage.speed=Number(event.target.value);});
$('loop').addEventListener('click',()=>{if(stage?.motion&&!loading)stage.setLoop(!stage.loop);});
$('zoom-in').addEventListener('click',()=>stage?.setZoom(stage.zoom*1.15));
$('zoom-out').addEventListener('click',()=>stage?.setZoom(stage.zoom/1.15));
$('zoom-reset').addEventListener('click',()=>stage?.resetView());
$('follow').addEventListener('change',event=>{if(!stage)return;stage.follow=event.target.checked;if(!stage.follow&&stage.model)stage.model.internalModel.focusController.focus(0,0,true);});
$('physics').addEventListener('change',event=>stage?.setPhysics(event.target.checked));
document.querySelectorAll('[data-bg]').forEach(button=>button.addEventListener('click',()=>{
  $('stage').dataset.background=button.dataset.bg;
  document.querySelectorAll('[data-bg]').forEach(item=>{const selected=item===button;item.classList.toggle('selected',selected);item.setAttribute('aria-pressed',String(selected));});
}));
$('custom-background').addEventListener('input',event=>{
  $('stage').dataset.background='custom';$('stage').style.setProperty('--custom-background',event.target.value);
  document.querySelectorAll('[data-bg]').forEach(item=>{item.classList.remove('selected');item.setAttribute('aria-pressed','false');});
});
$('random-motion').addEventListener('click',()=>{if(!selected||loading)return;const others=selected.motions.filter(m=>m.id!==selectedMotion.id);chooseMotion(others[Math.floor(Math.random()*others.length)]||selectedMotion);});
$('share').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(location.href);toast('已复制角色与动作链接');}
  catch{toast('复制失败，请复制浏览器地址栏中的链接');}
});
$('screenshot').addEventListener('click',()=>{
  try{const link=document.createElement('a');link.download=`${selected.id}_${selectedMotion.id}.png`;link.href=stage.screenshot();link.click();toast('已保存透明背景 PNG');}
  catch(error){toast(error.message);}
});
$('fullscreen').addEventListener('click',async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else await $('stage').requestFullscreen();}
  catch{toast('当前浏览器不支持舞台全屏');}
});
$('about-button').addEventListener('click',()=>$('about').showModal());
$('close-about').addEventListener('click',()=>$('about').close());
document.addEventListener('keydown',event=>{
  if(['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName)||$('about').open)return;
  if(event.code==='Space'){event.preventDefault();stage?.togglePlay().catch(showError);}
  if(event.key.toLowerCase()==='r'&&selectedMotion)chooseMotion(selectedMotion);
});
window.addEventListener('popstate',()=>{if(!catalog)return;const selection=resolveSelection(catalog.models,readSelection(location.href));chooseModel(selection.model,selection.motion.id);});
// Defer module startup until classic defer scripts (Core and rendering libraries) finish.
if(document.readyState==='complete')boot();else window.addEventListener('load',boot,{once:true});
