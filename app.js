'use strict';
const $=id=>document.getElementById(id),KEY='lucky-smash-v1',reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const defaults=()=>({event:'SAINS Pickleball Event',logo:'',exclude:true,volume:65,sound:true,demo:true,players:Array.from({length:40},(_,i)=>({id:i+1,name:'Demo Player '+String(i+1).padStart(2,'0')})),results:[]});
let state=defaults();try{const v=JSON.parse(localStorage.getItem(KEY));if(v&&Array.isArray(v.players)&&v.players.length<=5000&&v.players.every(p=>Number.isSafeInteger(p.id)&&p.id>0&&typeof p.name==='string')&&Array.isArray(v.results)){state={...state,...v};state.results=v.results.filter(r=>r&&Number.isSafeInteger(r.id)&&typeof r.name==='string'&&['pending','collected','absent'].includes(r.status));}}catch(e){}
let phase='idle',current=null,preview=false,startedAt=0,toastTimer=0,autoTimer=0,revealTimer=0,lastNow=performance.now(),audio=null,bus=null,drone=null,played=new Set(),particles=[],flightTrail=[];
const drawSpeed = 1.3;
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));const ease=v=>{v=clamp(v);return v*v*v*(v*(v*6-15)+10);};const lerp=(a,b,t)=>a+(b-a)*t;
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4000);}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch(e){toast('Your browser could not save this session. Export your results to keep a copy.');return false;}}
function pendingWinner() {
  return state.results.findLast(result => result.status === 'pending');
}
function eligible(){const used=new Set(state.results.filter(r=>r.status==='pending'||r.status==='absent'||state.exclude).map(r=>r.id));return state.players.filter(p=>!used.has(p.id));}
function randomIndex(n){const a=new Uint32Array(1),limit=Math.floor(4294967296/n)*n;do{crypto.getRandomValues(a);}while(a[0]>=limit);return a[0]%n;}
function displayLogo(image, value) {
  image.hidden = !value;
  if (value) image.src = value;
  else image.removeAttribute('src');
}
function update(){
  displayLogo($('eventLogo'), state.logo);
  displayLogo($('winnerEventLogo'), state.logo);
  $('winnerPaddleIcon').toggleAttribute('hidden', Boolean(state.logo));
  const count=eligible().length;const pending=pendingWinner();$('eventTitle').textContent=state.event;$('eligibleCount').textContent=count;$('rosterCount').textContent=state.players.length;$('historyCount').textContent=state.results.length;$('demoTag').hidden=!state.demo;$('repeatLabel').textContent=state.exclude?'A fresh winner every time':'Collected winners can be drawn again';$('drawBtn').disabled=phase!=='idle'||(!count&&!pending);$('drawLabel').textContent=phase==='drawing'?'LUCK IS IN PLAY…':pending?'VIEW LAST WINNER':count?"LET'S SMASH":'ALL PLAYERS DRAWN';for(const id of ['settingsBtn','historyBtn','previewBtn'])$(id).disabled=phase==='drawing';$('soundBtn').classList.toggle('muted',!state.sound);$('soundBtn').setAttribute('aria-label',state.sound?'Mute sound':'Enable sound');$('soundBtn').title=state.sound?'Sound on':'Sound off';}
function prepareAudio(){try{if(!audio){audio=new (window.AudioContext||window.webkitAudioContext)();bus=audio.createGain();bus.connect(audio.destination);}bus.gain.value=state.sound?state.volume/100*.65:0;if(audio.state==='suspended')audio.resume().catch(()=>{});return true;}catch(e){return false;}}
function tone(freq,duration=.2,volume=.12,type='sine',delay=0,end){if(!audio||!bus)return;const t=audio.currentTime+delay,o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(end)o.frequency.exponentialRampToValueAtTime(end,t+duration);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(bus);o.start(t);o.stop(t+duration+.01);o.onended=()=>{o.disconnect();g.disconnect();};}
function pop(strong=false){tone(strong?225:410,.095,strong?.42:.25,'triangle',0,strong?72:150);if(!audio)return;const len=Math.floor(audio.sampleRate*.055),buffer=audio.createBuffer(1,len,audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<len;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/len,3);const source=audio.createBufferSource(),g=audio.createGain(),filter=audio.createBiquadFilter();source.buffer=buffer;filter.type='bandpass';filter.frequency.value=strong?900:1700;g.gain.value=strong?.8:.4;source.connect(filter);filter.connect(g);g.connect(bus);source.start();source.onended=()=>{source.disconnect();filter.disconnect();g.disconnect();};}
function suspense(){if(!audio)return;stopDrone();const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime;o.type='sine';o.frequency.setValueAtTime(76,t);o.frequency.linearRampToValueAtTime(132,t+6.3/drawSpeed);g.gain.setValueAtTime(.03,t);g.gain.linearRampToValueAtTime(.11,t+6.2/drawSpeed);o.connect(g);g.connect(bus);o.start();drone={o,g};}
function stopDrone(){if(drone){const d=drone;drone=null;try{d.g.gain.setTargetAtTime(.0001,audio.currentTime,.05);d.o.stop(audio.currentTime+.2);d.o.onended=()=>{d.o.disconnect();d.g.disconnect();};}catch(e){}}}
// A short rising fanfare with a held major chord at the reveal.
function playWinnerSound() {
  if (!audio || !bus || !state.sound) return;
  const melody = [523.25, 659.25, 783.99, 1046.50];
  melody.forEach((note, index) => {
    const delay = index * .105;
    tone(note, index === 3 ? .7 : .23, .21, 'triangle', delay);
    tone(note * 2, .16, .035, 'sine', delay);
  });
  [261.63, 523.25, 659.25, 783.99].forEach(note => {
    tone(note, .68, .07, 'sine', .315);
  });
}

function outcomeSound(present){if(present){[659,784,1047,1319].forEach((f,i)=>tone(f,.35,.15,'triangle',i*.09));}else{[392,330,262,196].forEach((f,i)=>tone(f,.42,.12,'sine',i*.15));}}
function playDrawAudio(cue) {
  if (!audio || !bus || !state.sound) return;
  try {
    cue();
  } catch (error) {
    console.warn('Lucky Smash audio cue unavailable', error);
  }
}

function startDraw(test=false){if(phase!=='idle'||$('settingsDialog').open||$('winnerDialog').open)return;
  const pending = test ? null : pendingWinner();
  if (pending) {
    prepareAudio();
    current = pending;
    preview = false;
    showWinner();
    return;
  }
  const pool=eligible();if(!test&&!pool.length)return toast('Every eligible player has been drawn. Add players or reset the history.');prepareAudio();preview=test;current=test?{id:28,name:'Demo Winner',status:'preview'}:{...pool[randomIndex(pool.length)],status:'pending',time:new Date().toISOString()};if(!test){state.results.push(current);save();}phase='drawing';startedAt=performance.now();flightTrail=[];played=new Set();$('arena').classList.add('drawing');$('status').textContent=test?'ANIMATION PREVIEW':'LUCK IS IN PLAY';$('actionCaption').textContent='PADDLES UP. YOUR MOMENT IS COMING.';update();revealTimer=setTimeout(revealDraw, (reduced ? 1800 : 8400 / drawSpeed) + 150);playDrawAudio(suspense);}
function revealDraw() {
  if (phase === 'drawing') showWinner();
}
function showWinner(){clearTimeout(revealTimer);stopDrone();phase='winner';$('flash').style.opacity=0;$('smashWord').classList.remove('active');$('winnerName').textContent=current.name;$('winnerNumber').textContent=String(current.id).padStart(2,'0');$('winnerTag').textContent=preview?'ANIMATION PREVIEW':'THE LUCKY SHOT';$('winnerQuestion').textContent=preview?'Preview only. Your players and results stay untouched.':'Is our winner here?';$('winnerActions').hidden=preview;$('previewActions').hidden=!preview;$('decisionNote').textContent=preview?'Ready for the real thing? Head back to the court.':'Close records the winner and returns to the court.';$('absentBtn').disabled=false;$('collectedBtn').disabled=false;$('winnerClose').disabled=false;$('winnerDialog').showModal();$('status').textContent=preview?'THAT WAS A PRACTICE SHOT':'WE HAVE A WINNER';$('actionCaption').textContent='';playDrawAudio(playWinnerSound);celebrate();update();}
function returnToCourt(){phase='idle';current=null;preview=false;flightTrail=[];$('arena').classList.remove('drawing');$('flash').style.opacity=0;$('smashWord').classList.remove('active');$('status').textContent=eligible().length?'THE COURT IS YOURS':'ALL SHOTS TAKEN';$('actionCaption').textContent='';update();}
function resolveWinner(present, redraw = true) {
  if (phase !== 'winner' || preview || current?.status !== 'pending') return;
  current.status = present ? 'collected' : 'absent';
  if (!save()) {
    current.status = 'pending';
    $('decisionNote').textContent = 'The result could not be saved. Please try again.';
    return;
  }
  for (const id of ['absentBtn', 'collectedBtn', 'winnerClose']) $(id).disabled = true;
  playDrawAudio(() => outcomeSound(present));
  if (present) celebrate();
  else particles = [];

  if (!redraw) {
    $('winnerDialog').close();
    returnToCourt();
    $('drawBtn').focus();
    toast('Winner recorded.');
    return;
  }

  $('winnerQuestion').textContent = present
    ? 'A winning moment! Getting the next rally ready…'
    : 'Missed this one. Another lucky shot is coming…';
  $('decisionNote').textContent = present
    ? 'Winner recorded · drawing again'
    : 'Marked absent · excluded from future draws';
  update();
  clearTimeout(autoTimer);
  autoTimer = setTimeout(() => {
    $('winnerDialog').close();
    returnToCourt();
    if (eligible().length) startDraw();
    else toast('All eligible players have been drawn. Thanks for playing!');
  }, 1300);
}
function closePreview(){$('winnerDialog').close();particles=[];returnToCourt();}
$('drawBtn').onclick=()=>startDraw();$('court').onclick=()=>startDraw();$('previewBtn').onclick=()=>{$('settingsDialog').close();startDraw(true);};$('closePreview').onclick=closePreview;$('absentBtn').onclick=()=>resolveWinner(false);$('collectedBtn').onclick=()=>resolveWinner(true);
$('winnerClose').onclick = () => {
  if (preview) closePreview();
  else resolveWinner(true, false);
};
$('winnerDialog').addEventListener('cancel', event => {
  event.preventDefault();
  $('winnerClose').click();
});
$('soundBtn').onclick=()=>{state.sound=!state.sound;prepareAudio();save();update();if(state.sound)tone(660,.12,.1);};
$('fullscreenBtn').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(e){toast('Full screen is unavailable here. Open the site in a browser tab.');}};document.addEventListener('fullscreenchange',()=>$('fullscreenBtn').setAttribute('aria-label',document.fullscreenElement?'Exit full screen':'Enter full screen'));
document.addEventListener('keydown',e=>{if(e.code!=='Space'||e.repeat||/INPUT|TEXTAREA|BUTTON|SELECT|A/.test(e.target.tagName)||$('settingsDialog').open||$('winnerDialog').open)return;e.preventDefault();startDraw();});
function selectTab(tab){for(const btn of document.querySelectorAll('[data-tab]')){const active=btn.dataset.tab===tab;btn.setAttribute('aria-selected',active);$(btn.dataset.tab+'Panel').hidden=!active;}if(tab==='winners')renderHistory();}
function openSettings(tab='setup'){if(phase==='drawing'||$('winnerDialog').open)return;resetLogoDraft();$('eventInput').value=state.event;$('excludeInput').checked=state.exclude;$('volumeInput').value=state.volume;$('playersInput').value=state.players.map(p=>p.name).join('\n');$('importNote').textContent=state.demo?'Demo players are loaded. Replace them with your event list.':'Duplicate names are combined into one entry.';selectTab(tab);$('settingsDialog').showModal();}
$('settingsBtn').onclick=()=>openSettings();$('historyBtn').onclick=()=>openSettings('winners');$('closeSettings').onclick=()=>$('settingsDialog').close();document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>selectTab(b.dataset.tab));
$('volumeInput').oninput=()=>{state.volume=Number($('volumeInput').value);prepareAudio();save();};
let logoDraft = '';
let logoRequest = 0;
const logoHelp = 'PNG, JPG or WebP, up to 5 MB.';
function updateLogoDraft(value, message = logoHelp) {
  logoDraft = value;
  displayLogo($('logoPreview'), value);
  $('removeLogo').hidden = !value;
  $('logoNote').textContent = message;
}
function resetLogoDraft() {
  logoRequest++;
  $('logoInput').value = '';
  $('saveSetup').disabled = false;
  updateLogoDraft(state.logo);
}
$('logoInput').onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;
  const request = ++logoRequest;
  $('saveSetup').disabled = true;
  let bitmap;
  try {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      throw new Error('Choose a PNG, JPG or WebP file up to 5 MB.');
    }
    bitmap = await createImageBitmap(file);
    if (request !== logoRequest || !$('settingsDialog').open) return;
    const size = Math.min(1, 480 / bitmap.width, 240 / bitmap.height);
    const image = document.createElement('canvas');
    image.width = Math.max(1, Math.round(bitmap.width * size));
    image.height = Math.max(1, Math.round(bitmap.height * size));
    image.getContext('2d').drawImage(bitmap, 0, 0, image.width, image.height);
    updateLogoDraft(image.toDataURL('image/png'), 'Logo ready. Save settings to apply it.');
  } catch (error) {
    if (request === logoRequest) {
      $('logoNote').textContent = error.message === 'Choose a PNG, JPG or WebP file up to 5 MB.'
        ? error.message : 'Could not read this image. Try another file.';
    }
  } finally {
    bitmap?.close();
    if (request === logoRequest) {
      $('logoInput').value = '';
      $('saveSetup').disabled = false;
    }
  }
};
$('removeLogo').onclick = () => {
  resetLogoDraft();
  updateLogoDraft('', 'Save settings to remove the logo.');
};
$('saveSetup').onclick = () => {
  const previous = state;
  state = {
    ...state,
    event: $('eventInput').value.trim() || 'Lucky Smash',
    exclude: $('excludeInput').checked,
    logo: logoDraft,
  };
  if (!save()) {
    state = previous;
    $('logoNote').textContent = 'Settings could not be saved. Try a smaller logo or clear the logo.';
    return;
  }
  update();
  $('settingsDialog').close();
  toast('Your court is ready.');
};
function cleanNames(names){const seen=new Set(),out=[];for(const name of names){const n=name.trim().replace(/\s+/g,' ');if(n&&!seen.has(n.toLocaleLowerCase())){seen.add(n.toLocaleLowerCase());out.push(n);}}return out;}
$('savePlayers').onclick=()=>{const names=cleanNames($('playersInput').value.split(/\r?\n/));if(!names.length)return toast('Add at least one player name.');if(names.length>5000)return toast('Please use no more than 5,000 player names.');if(state.results.length&&!confirm('Replace the players and clear the current draw history? Export your results first if you need a copy.'))return;state.players=names.map((name,i)=>({id:i+1,name}));state.results=[];state.demo=false;save();returnToCourt();$('settingsDialog').close();toast(names.length+' players are ready to smash.');};
function parseCSV(text){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(s=>s.trim()))rows.push(row);row=[];cell='';}else cell+=c;}if(quoted)throw new Error('A quotation mark is not closed in your CSV.');row.push(cell);if(row.some(s=>s.trim()))rows.push(row);return rows;}
$('csvInput').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2e6)throw new Error('Please use a CSV smaller than 2 MB.');const rows=parseCSV((await file.text()).replace(/^\uFEFF/,''));if(!rows.length)throw new Error('This CSV is empty.');const aliases=['name','full name','participant name','player name','nama','nama penuh'];let index=rows[0].findIndex(x=>aliases.includes(x.trim().toLowerCase()));let data;if(index>=0)data=rows.slice(1);else if(rows.every(row=>row.length===1)){index=0;data=rows;}else throw new Error('Please add a Name column to your CSV.');const names=cleanNames(data.map(row=>row[index]||''));if(!names.length)throw new Error('No player names were found.');if(names.length>5000)throw new Error('Please use no more than 5,000 players.');$('playersInput').value=names.join('\n');$('importNote').textContent=names.length+' unique names imported. Click Use this player list to apply.';}catch(err){toast(err.message);}finally{e.target.value='';}};
function download(text,filename){const url=URL.createObjectURL(new Blob(['\uFEFF'+text],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('sampleBtn').onclick=()=>download('Name\r\nNur Aisyah\r\nDaniel Wong\r\nSiti Hajar\r\n','lucky-smash-players-sample.csv');
function csvCell(value){let s=String(value??'');if(/^[\s]*[=+@\-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
$('exportBtn').onclick=()=>{if(!state.results.length)return toast('No results to export yet.');const rows=[['Draw','Number','Name','Status','Time'],...state.results.map((r,i)=>[i+1,r.id,r.name,r.status,r.time])];download(rows.map(row=>row.map(csvCell).join(',')).join('\r\n'),'lucky-smash-results.csv');};
$('resetBtn').onclick=()=>{if(!state.results.length)return toast('Your history is already empty.');if(!confirm('Reset all draw results and make every player eligible again? Export your history first if needed.'))return;state.results=[];save();returnToCourt();renderHistory();toast('Fresh court. Every player is back in the draw.');};
function renderHistory(){const root=$('winnerList');root.replaceChildren();const collected=state.results.filter(r=>r.status==='collected').length,absent=state.results.filter(r=>r.status==='absent').length;$('historySummary').textContent=state.results.length?collected+' collected · '+absent+' absent · '+state.results.length+' draws':'Your next lucky moment starts on court.';if(!state.results.length){const p=document.createElement('p');p.className='empty-results';p.textContent='No lucky shots yet. Paddles up!';root.append(p);}for(const r of [...state.results].reverse()){const row=document.createElement('div');row.className='winner-row';const n=document.createElement('span');n.className='row-number';n.textContent=String(r.id).padStart(2,'0');const detail=document.createElement('div'),name=document.createElement('strong');name.textContent=r.name;detail.append(name);const status=document.createElement('span');status.className='result-status '+r.status;status.textContent=r.status;row.append(n,detail,status);root.append(row);}}
// Court rendering uses real-time projected geometry, so paddle swings and ball flight stay continuous.
const canvas=$('court'),ctx=canvas.getContext('2d'),confetti=$('confetti'),fx=confetti.getContext('2d');let W=1200,H=600,dpr=1,FW=1200,FH=800;
function resize(){const box=canvas.getBoundingClientRect();W=box.width;H=box.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);FW=innerWidth;FH=innerHeight;confetti.width=Math.round(FW*dpr);confetti.height=Math.round(FH*dpr);fx.setTransform(dpr,0,0,dpr,0,0);}
new ResizeObserver(resize).observe($('arena'));window.addEventListener('resize',resize);
function project(x,y,z){const mobile=W<700,scale=1/(1+z*.0545),center=mobile?.50:.635;return{x:W*center+x/10*W*(mobile?.39:.34)*scale,y:H*(mobile?.97:.95)-(1-scale)/.706*H*(mobile?.54:.66)-y*scale*H*.048,s:scale};}
function path(points){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();}
function courtQuad(x1,z1,x2,z2,color){path([project(x1,0,z1),project(x2,0,z1),project(x2,0,z2),project(x1,0,z2)]);ctx.fillStyle=color;ctx.fill();}
function courtLine(x1,z1,x2,z2,width=2,color='#edf5ffcf'){const a=project(x1,.04,z1),b=project(x2,.04,z2);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
const grainTile = document.createElement('canvas');
grainTile.width = grainTile.height = 128;
const grainContext = grainTile.getContext('2d');
for (let i = 0; i < 4800; i++) {
  grainContext.fillStyle = i % 2 ? '#ecf5ff22' : '#040e2928';
  grainContext.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
}
const courtGrain = ctx.createPattern(grainTile, 'repeat');

function drawCourtLights() {
  const fixtures = W < 700 ? [[-14, 43], [14, 43]] : [[-13.2, 43], [13.2, 43], [-13.2, 24], [13.2, 24]];
  return fixtures.map(([side, depth]) => {
    const foot = project(side, 0, depth);
    const height = H * (depth > 30 ? .17 : .23);
    const top = foot.y - height;
    const scale = Math.max(.55, Math.min(1.55, W / 1000)) * (depth > 30 ? .77 : 1);
    const direction = -Math.sign(side);
    const lampX = foot.x + direction * 13 * scale;
    const glowRadius = 44 * scale;
    const halo = ctx.createRadialGradient(lampX, top, 0, lampX, top, glowRadius);
    halo.addColorStop(0, '#e3efff63');
    halo.addColorStop(.35, '#b2d0ff30');
    halo.addColorStop(1, '#b2d0ff00');
    ctx.fillStyle = halo;
    ctx.fillRect(lampX - glowRadius, top - glowRadius, 2 * glowRadius, 2 * glowRadius);

    const pole = ctx.createLinearGradient(foot.x - 3 * scale, 0, foot.x + 3 * scale, 0);
    pole.addColorStop(0, '#0a1425');
    pole.addColorStop(.48, '#7b8ca6');
    pole.addColorStop(1, '#293b56');
    ctx.fillStyle = pole;
    ctx.fillRect(foot.x - 2.8 * scale, top, 5.6 * scale, height);
    ctx.fillStyle = '#293a55';
    ctx.fillRect(foot.x - 6 * scale, foot.y - 3 * scale, 12 * scale, 4 * scale);
    ctx.fillRect(Math.min(lampX, foot.x), top - 2 * scale, Math.abs(lampX - foot.x), 4 * scale);

    ctx.save();
    ctx.translate(lampX, top);
    ctx.scale(scale, scale);
    ctx.rotate(direction * .14);
    ctx.fillStyle = '#0d1728';
    ctx.beginPath();
    ctx.roundRect(-17, -8, 34, 16, 2);
    ctx.fill();
    for (const x of [-14, 1]) {
      ctx.fillStyle = '#a8c4e6';
      ctx.fillRect(x, -5, 13, 10);
      ctx.fillStyle = '#f5f9ff';
      ctx.fillRect(x + 1, -4, 11, 8);
      ctx.fillStyle = '#bdd2ed';
      ctx.fillRect(x + 1, 0, 11, .55);
    }
    ctx.restore();
    return {pool: project(side * .44, 0, depth - 4), radius: Math.min(W * .15, H * .25)};
  });
}

function drawCourt(now){
 const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#102448');bg.addColorStop(.55,'#142f58');bg.addColorStop(1,'#192e54');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 const glow=ctx.createRadialGradient(W*.8,H*.35,0,W*.8,H*.35,W*.55);glow.addColorStop(0,'#577bcd29');glow.addColorStop(1,'#10212600');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
 const lights = drawCourtLights();
 const nearL=project(-11,0,-2),nearR=project(11,0,-2),farR=project(11,0,46),farL=project(-11,0,46);
 ctx.save();ctx.shadowColor='#0007';ctx.shadowBlur=45;ctx.shadowOffsetY=22;path([nearL,nearR,farR,farL]);ctx.fillStyle='#0a191e';ctx.fill();ctx.restore();
 path([nearL,nearR,{x:nearR.x,y:nearR.y+9},{x:nearL.x,y:nearL.y+9}]);ctx.fillStyle='#0b191d';ctx.fill();
 courtQuad(-11,-2,11,46,'#29436c');courtQuad(-10,0,10,44,'#214d89');courtQuad(-10,15,10,29,'#3767a9');
 // Acrylic surface grain and light falling across the playing area.
 ctx.save();
 path([project(-11,0,-2),project(11,0,-2),project(11,0,46),project(-11,0,46)]);
 ctx.clip();
 for (const {pool, radius} of lights) {
   const light = ctx.createRadialGradient(pool.x, pool.y, 0, pool.x, pool.y, radius);
   light.addColorStop(0, '#e4efff36');
   light.addColorStop(1, '#e4efff00');
   ctx.fillStyle = light;
   ctx.fillRect(pool.x - radius, pool.y - radius, 2 * radius, 2 * radius);
 }
 ctx.fillStyle = courtGrain;
 ctx.fillRect(0, 0, W, H);
 const lighting = ctx.createLinearGradient(0, farL.y, W, nearL.y);
 lighting.addColorStop(0, '#030e2366');
 lighting.addColorStop(.64, '#c4dfff22');
 lighting.addColorStop(1, '#030e2366');
 ctx.fillStyle = lighting;
 ctx.fillRect(0, 0, W, H);
 courtQuad(-10.65, 20.4, 10.65, 22.1, '#081a344f');
 ctx.restore();
 for(const [a,b,c,d]of[[-10,0,10,0],[-10,44,10,44],[-10,0,-10,44],[10,0,10,44],[-10,15,10,15],[-10,29,10,29],[0,0,0,15],[0,29,0,44]])courtLine(a,b,c,d,W<700?1.1:1.8);
 // Lime corner markers frame the competition surface.
 for(const x of [-11,11]){const p=project(x,0,-2);ctx.fillStyle='#ef455d';ctx.fillRect(p.x-2,p.y-2,6,3);}
}
function drawNet(){const l=project(-10.5,0,22),r=project(10.5,0,22),lt=project(-10.5,2.9,22),rt=project(10.5,2.9,22);path([l,r,rt,lt]);ctx.fillStyle='#091c2470';ctx.fill();for(let i=0;i<=28;i++){const x=lerp(-10.5,10.5,i/28),a=project(x,0,22),b=project(x,2.9,22);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle='#d4e4ff4a';ctx.lineWidth=.6;ctx.stroke();}for(let i=0;i<5;i++){const a=project(-10.5,i*.65,22),b=project(10.5,i*.65,22);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}for(const x of [-10.8,10.8]){const a=project(x,-.2,22),b=project(x,3.2,22);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineWidth=4;ctx.strokeStyle='#14262c';ctx.stroke();}ctx.beginPath();ctx.moveTo(lt.x,lt.y);ctx.lineTo(rt.x,rt.y);ctx.strokeStyle='#f4f7ff';ctx.lineWidth=3;ctx.stroke();}
function paddle(x, y, z, angle, far = false) {
  const point = project(x, y, z);
  const scale = point.s * Math.min(1.6, Math.max(.58, W / 960));
  drawShadow({x, y: 0, z});
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(angle);
  ctx.scale(scale * (.91 + .09 * Math.cos(angle)), scale);

  const grip = ctx.createLinearGradient(-10, 0, 10, 0);
  grip.addColorStop(0, '#080e17');
  grip.addColorStop(.4, '#394352');
  grip.addColorStop(1, '#101622');
  ctx.fillStyle = grip;
  ctx.beginPath();
  ctx.roundRect(-10, 26, 20, 64, 4);
  ctx.fill();
  for (let band = 40; band < 85; band += 6) {
    ctx.strokeStyle = '#030711c2';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-9, band);
    ctx.lineTo(9, band + 3);
    ctx.stroke();
  }
  ctx.fillStyle = far ? '#cbd7e6' : '#aa1f38';
  ctx.fillRect(-10, 86, 20, 5);

  const face = new Path2D();
  face.moveTo(-12, 39);
  face.quadraticCurveTo(-15, 33, -30, 23);
  face.quadraticCurveTo(-39, 16, -39, 1);
  face.lineTo(-39, -48);
  face.quadraticCurveTo(-39, -68, -18, -71);
  face.quadraticCurveTo(0, -74, 18, -71);
  face.quadraticCurveTo(39, -68, 39, -48);
  face.lineTo(39, 1);
  face.quadraticCurveTo(39, 16, 30, 23);
  face.quadraticCurveTo(15, 33, 12, 39);
  face.closePath();

  ctx.save();
  ctx.translate(4, 3);
  ctx.fillStyle = '#080f1d';
  ctx.fill(face);
  ctx.strokeStyle = '#080f1d';
  ctx.lineWidth = 5;
  ctx.stroke(face);
  ctx.restore();
  const finish = ctx.createLinearGradient(-40, -70, 42, 42);
  finish.addColorStop(0, far ? '#f0f6fc' : '#4c5a6e');
  finish.addColorStop(.38, far ? '#b8c9dc' : '#263245');
  finish.addColorStop(1, far ? '#8198b1' : '#141c2a');
  ctx.fillStyle = finish;
  ctx.fill(face);

  ctx.save();
  ctx.clip(face);
  ctx.lineWidth = .65;
  ctx.strokeStyle = far ? '#1b324522' : '#dbe9ff22';
  for (let stripe = -100; stripe < 155; stripe += 4) {
    ctx.beginPath();
    ctx.moveTo(-42, stripe);
    ctx.lineTo(42, stripe - 84);
    ctx.moveTo(-42, stripe - 84);
    ctx.lineTo(42, stripe);
    ctx.stroke();
  }
  ctx.fillStyle = far ? '#263b55' : '#f0f5fe';
  ctx.font = '800 11px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('SMASH', 0, -15);
  ctx.restore();

  const edge = ctx.createLinearGradient(-39, -67, 39, 33);
  edge.addColorStop(0, far ? '#ffffff' : '#ff6479');
  edge.addColorStop(1, far ? '#8799ae' : '#94192e');
  ctx.strokeStyle = edge;
  ctx.lineWidth = 3.5;
  ctx.stroke(face);
  ctx.restore();
}
function ballAt(ms){const segments=[{t:0,p:[-7,3,5]},{t:1200,p:[-7,3,5]},{t:2500,p:[6,3,38]},{t:3800,p:[-6,3,5]},{t:5100,p:[-5,3,38]},{t:6350,p:[6,3,5]}];for(let i=1;i<segments.length;i++)if(ms<segments[i].t){const a=segments[i-1],b=segments[i],u=(ms-a.t)/(b.t-a.t);if(i===1)return{x:-7,y:3+Math.sin(u*Math.PI)*.25,z:5};return{x:lerp(a.p[0],b.p[0],u),y:3+Math.sin(u*Math.PI)*7,z:lerp(a.p[2],b.p[2],u)};}return{x:6,y:3,z:5};}
function drawBall(p,r,rotation=0,number){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(rotation);const g=ctx.createRadialGradient(-r*.4,-r*.42,r*.03,0,0,r);g.addColorStop(0,'#ffffff');g.addColorStop(.25,'#f2f7ff');g.addColorStop(.66,'#b5caf0');g.addColorStop(1,'#5278b6');ctx.fillStyle=g;ctx.shadowColor='#accfff22';ctx.shadowBlur=Math.min(r*.35,22);ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.save();ctx.beginPath();ctx.arc(0,0,r*.975,0,Math.PI*2);ctx.clip();const holes=[[-.43,-.42,.12,.15], [.25,-.62,.12,.08],[.6,-.1,.08,.15],[-.65,.2,.07,.14],[-.19,.12,.14,.16],[.3,.48,.13,.11],[-.2,.75,.1,.05],[.72,.62,.06,.08]];for(const [x,y,rx,ry]of holes){const h=ctx.createRadialGradient(x*r-r*.03,y*r-r*.03,0,x*r,y*r,r*.19);h.addColorStop(0,'#244881');h.addColorStop(1,'#6688bd');ctx.fillStyle=h;ctx.beginPath();ctx.ellipse(x*r,y*r,rx*r,ry*r,-.2,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#eaf3ff80';ctx.lineWidth=Math.max(.5,r*.018);ctx.stroke();}ctx.restore();if(number!==undefined){ctx.fillStyle='#142e5f';ctx.font='900 '+r*.57+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(number).padStart(2,'0'),0,0);}ctx.restore();}
function drawShadow(b){const p=project(b.x,0,b.z);ctx.save();ctx.translate(p.x,p.y);ctx.scale(1,.24);const r=25*p.s*Math.min(W/1000,1.4),g=ctx.createRadialGradient(0,0,0,0,0,r);g.addColorStop(0,'#06191e80');g.addColorStop(1,'#06191e00');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.restore();}
function swing(ms,contact){const d=(ms-contact)/430;if(d<-.8||d>1)return 0;return Math.sin(clamp((d+.8)/1.8)*Math.PI*2)*.75;}
function celebrate(){particles=Array.from({length:110},()=>({x:FW*.5,y:FH*.35,vx:(Math.random()-.5)*10,vy:-Math.random()*8-3,rot:Math.random()*6,spin:(Math.random()-.5)*.15,life:1,w:3+Math.random()*5,color:['#ef455d','#ffffff','#416bc5','#bcd0ff'][Math.floor(Math.random()*4)]}));}
function render(now){const dt=Math.min((now-lastNow)/16.67,2);lastNow=now;ctx.clearRect(0,0,W,H);drawCourt(now);let ms=phase==='drawing'?Math.max(0, now-startedAt)*(reduced ? 8400/1800 : drawSpeed):0;
 const active=phase==='drawing',idleTime=reduced?0:now/1000,b=active?ballAt(ms):{x:-6.8,y:4+Math.sin(idleTime*1.7)*.4,z:5};
 const mainX=active?lerp(-7,6,ease((ms-3850)/2300)):-7,mainAngle=active?-.24+swing(ms,1200)+swing(ms,3800)-swing(ms,6350):-.4+Math.sin(idleTime*.8)*.025;
 const farX=active?lerp(6,-5,ease((ms-2700)/2200)):6;
 paddle(farX,3,38,.3+swing(ms,2500)+swing(ms,5100),true);
 if(!active||ms<6350){drawShadow(b);const p=project(b.x,b.y,b.z),r=Math.max(4,17*p.s*Math.min(1.3,W/1100));if(b.z>22)drawBall(p,r,idleTime*.3+ms*.001);drawNet();paddle(mainX,3,5,mainAngle);if(b.z<=22)drawBall(p,r,idleTime*.3+ms*.001);}
 else {drawNet();paddle(6,3,5,-1.1+ease((ms-6350)/650)*1.1);const start=project(6,3,5),u=clamp((ms-6350)/1200),e=u*(.55+.45*u),control={x:W*.8,y:H*.04},end={x:W*.53,y:H*.49};const p={x:(1-e)*(1-e)*start.x+2*(1-e)*e*control.x+e*e*end.x,y:(1-e)*(1-e)*start.y+2*(1-e)*e*control.y+e*e*end.y},r=lerp(17*start.s,Math.max(W,H)*.57,Math.pow(u,3.6));
 if(!reduced){flightTrail.push({...p,r});if(flightTrail.length>13)flightTrail.shift();flightTrail.forEach((q,i)=>{ctx.globalAlpha=i/flightTrail.length*.035;ctx.fillStyle='#ef455d';ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;}drawBall(p,r,ms*.003);
 }
 if(active){
 const contacts = [1200, 2500, 3800, 5100, 6350];
 for (const contact of contacts) {
   if (ms < contact || played.has(contact)) continue;
   played.add(contact);
   const smash = contact === 6350;
   if (smash) stopDrone();
   playDrawAudio(() => {
     pop(smash);
     if (smash) tone(350, .8, .15, 'sine', 0, 1100);
   });
 }
 $('smashWord').classList.toggle('active',!reduced&&ms>6030&&ms<6600);const caption = ms<2500?'YOUR LUCKY RALLY STARTS HERE':ms<5100?'WHO WILL TAKE THE WINNING SHOT?':ms<6350?'HERE COMES YOUR LUCKY MOMENT…':'AND THE LUCKY PLAYER IS…';if ($('actionCaption').textContent !== caption) $('actionCaption').textContent = caption;$('flash').style.opacity=ms>7750?String(Math.max(0,1-Math.abs(ms-7950)/220)):'0';if(ms>=8400)revealDraw();
 }
 fx.clearRect(0,0,FW,FH);if(!reduced){particles=particles.filter(p=>p.life>0&&p.y<FH+20);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=.055*dt;p.rot+=p.spin*dt;p.life-=.0027*dt;fx.save();fx.globalAlpha=Math.min(1,p.life*3);fx.translate(p.x,p.y);fx.rotate(p.rot);fx.fillStyle=p.color;fx.fillRect(-p.w/2,-2,p.w,4);fx.restore();}}
 requestAnimationFrame(render);}
update();resize();requestAnimationFrame(render);
