'use strict';
const $=id=>document.getElementById(id);
const state={start:{name:'',lat:null,lon:null},stops:[],suggestions:[],startSuggestions:[]};
const setStatus=s=>$('status').textContent=s;
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(){const root=$('stops');root.replaceChildren();$('count').textContent=state.stops.length;state.stops.forEach((s,i)=>{const item=document.createElement('div');item.className='stop'+(s.done?' done':'');item.draggable=true;item.dataset.index=i;const drag=document.createElement('span');drag.className='drag';drag.textContent='⠿';drag.title='Zum Verschieben ziehen';const done=document.createElement('input');done.type='checkbox';done.checked=!!s.done;done.title='Erledigt';done.addEventListener('change',()=>{s.done=done.checked;render()});const name=document.createElement('strong');name.className='name';name.textContent=`${i+1}. ${s.name}`;const up=document.createElement('button');up.textContent='↑';up.title='Nach oben';up.disabled=i===0;up.onclick=()=>move(i,i-1);const down=document.createElement('button');down.textContent='↓';down.title='Nach unten';down.disabled=i===state.stops.length-1;down.onclick=()=>move(i,i+1);const del=document.createElement('button');del.className='delete';del.textContent='✕';del.title='Entfernen';del.onclick=()=>{state.stops.splice(i,1);render()};item.append(drag,done,name,up,down,del);item.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',String(i));item.classList.add('dragging')});item.addEventListener('dragend',()=>item.classList.remove('dragging'));item.addEventListener('dragover',e=>e.preventDefault());item.addEventListener('drop',e=>{e.preventDefault();const from=Number(e.dataTransfer.getData('text/plain'));if(Number.isInteger(from))move(from,i)});root.append(item)})}
function move(a,b){if(a===b||a<0||b<0||a>=state.stops.length||b>=state.stops.length)return;state.stops.splice(b,0,state.stops.splice(a,1)[0]);render()}
function addStop(name,lat=null,lon=null){name=name.trim();if(!name)return;state.stops.push({name,lat,lon,done:false});$('search').value='';$('suggestions').replaceChildren();render()}
function label(f){const p=f.properties||{};return [p.name,p.street,p.housenumber,p.postcode,p.city,p.state,p.country].filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i).join(', ')}
// Version 5: Suche am Startpunkt, sonst am bereits erlaubten GPS-Standort.
function validCoords(p){return p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)}
function distanceKm(a,b){const rad=x=>x*Math.PI/180;const dl=rad(b.lat-a.lat),dn=rad(b.lon-a.lon);const h=Math.sin(dl/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dn/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(h)))}
async function lookup(q,origin=null,limit=6){const u=new URL('https://photon.komoot.io/api/');u.searchParams.set('q',q);u.searchParams.set('lang','de');u.searchParams.set('limit',String(limit));if(validCoords(origin)){u.searchParams.set('lat',String(origin.lat));u.searchParams.set('lon',String(origin.lon))}const r=await fetch(u);if(!r.ok)throw Error('Adressdienst nicht erreichbar');const j=await r.json();const found=(j.features||[]).filter(f=>Array.isArray(f.geometry?.coordinates)).map(f=>({name:label(f),lon:f.geometry.coordinates[0],lat:f.geometry.coordinates[1]})).filter(validCoords);if(validCoords(origin)){found.forEach(f=>f.distanceKm=distanceKm(origin,f));found.sort((a,b)=>a.distanceKm-b.distanceKm)}return found.slice(0,6)}
let originLookup=null;
// GPS ist nur ein Suchbezug, KEIN Ersatz für den Startpunkt der Route.
// Keine neue Standort-Berechtigungsabfrage während des Tippens auslösen.
let gpsSearchCache=null;
let gpsSearchPending=null;
async function getGpsSearchOrigin(){
  if(!navigator.geolocation || !navigator.permissions?.query)return null;
  if(gpsSearchCache && Date.now()-gpsSearchCache.time<120000)return gpsSearchCache.point;
  if(gpsSearchPending)return gpsSearchPending;
  gpsSearchPending=(async()=>{
    try{
      const permission=await navigator.permissions.query({name:'geolocation'});
      if(permission.state!=='granted')return null;
      const point=await new Promise(resolve=>{
        navigator.geolocation.getCurrentPosition(
          p=>resolve({lat:p.coords.latitude,lon:p.coords.longitude}),
          ()=>resolve(null),
          {enableHighAccuracy:false,maximumAge:120000,timeout:3500}
        );
      });
      if(validCoords(point))gpsSearchCache={point,time:Date.now()};
      return validCoords(point)?point:null;
    }catch{return null}
  })();
  try{return await gpsSearchPending}finally{gpsSearchPending=null}
}
async function getSearchOrigin(){const name=$('start').value.trim();if(!name)return null;if(state.start.name===name&&validCoords(state.start))return state.start;if(originLookup?.name===name)return originLookup.promise;const promise=(async()=>{try{const results=await lookup(name);if(!results.length)return null;const f=results[0];if($('start').value.trim()!==name)return null;state.start={name,lat:f.lat,lon:f.lon};return state.start}catch{return null}})();originLookup={name,promise};return promise}
function setupAutocomplete(inputId,listId,onSelect,isStop=false){let timer,token=0;$(inputId).addEventListener('input',()=>{clearTimeout(timer);const q=$(inputId).value.trim(),t=++token;$(listId).replaceChildren();if(q.length<3)return;timer=setTimeout(async()=>{try{const origin=isStop?( $('start').value.trim()?await getSearchOrigin():await getGpsSearchOrigin() ):null;if(t!==token)return;const results=await lookup(q,origin,isStop&&validCoords(origin)?20:6);if(t!==token)return;results.forEach(x=>{const b=document.createElement('button');b.className='suggestion';b.textContent=x.name+(Number.isFinite(x.distanceKm)?' · '+x.distanceKm.toLocaleString('de-DE',{maximumFractionDigits:1})+' km Luftlinie':'');b.onclick=()=>{onSelect(x);$(listId).replaceChildren()};$(listId).append(b)})}catch(e){if(t===token)setStatus(e.message)}},350)})}
setupAutocomplete('search','suggestions',x=>addStop(x.name,x.lat,x.lon),true);
setupAutocomplete('start','startSuggestions',x=>{state.start=x;originLookup=null;$('start').value=x.name});
$('start').addEventListener('input',()=>{state.start={name:$('start').value,lat:null,lon:null};originLookup=null});
// Optionale Browser-Spracherkennung. Die Adressvorschläge bleiben die Bestätigung.
(function setupSpeechInput(){
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  const buttons=[{id:'micStart',input:'start'},{id:'micSearch',input:'search'}];
  let active=null;
  const notice=message=>{$('speechStatus').textContent=message};
  const reset=()=>{if(active){active.button.classList.remove('listening');active.button.setAttribute('aria-pressed','false');active=null}};
  if(!SpeechRecognition){
    buttons.forEach(({id})=>{$(id).title='Spracherkennung in diesem Browser nicht verfügbar';$(id).addEventListener('click',()=>notice('Spracherkennung wird hier nicht unterstützt. Bitte die Tastatur bzw. die Mikrofontaste der Smartphone-Tastatur verwenden.'))});
    return;
  }
  buttons.forEach(({id,input})=>{
    const button=$(id);
    button.setAttribute('aria-pressed','false');
    button.addEventListener('click',()=>{
      if(active){const wasSame=active.button===button;const old=active.recognition;reset();old.abort();if(wasSame){notice('Spracheingabe abgebrochen.');return}}
      const recognition=new SpeechRecognition();
      recognition.lang='de-DE';recognition.interimResults=false;recognition.maxAlternatives=1;recognition.continuous=false;
      active={button,recognition};button.classList.add('listening');button.setAttribute('aria-pressed','true');
      notice('🎤 Bitte jetzt die Adresse sprechen …');
      recognition.onresult=event=>{
        if(!active||active.recognition!==recognition)return;
        const spoken=event.results?.[0]?.[0]?.transcript?.trim();
        if(!spoken)return;
        const field=$(input);field.value=spoken;
        field.dispatchEvent(new Event('input',{bubbles:true}));
        notice('Erkannt: „'+spoken+'“. Bitte passenden Adressvorschlag auswählen.');
      };
      recognition.onerror=event=>{
        if(!active||active.recognition!==recognition)return;
        const messages={'not-allowed':'Mikrofonzugriff verweigert. Bitte Berechtigung prüfen.','audio-capture':'Kein Mikrofon verfügbar.','no-speech':'Keine Sprache erkannt. Bitte erneut versuchen.','network':'Spracherkennung benötigt möglicherweise Internet.','language-not-supported':'Deutsche Spracherkennung nicht verfügbar.','service-not-allowed':'Spracherkennung vom Browser nicht erlaubt.'};
        if(event.error!=='aborted')notice(messages[event.error]||'Spracheingabe fehlgeschlagen ('+event.error+'). Bitte manuell eingeben.');
      };
      recognition.onend=()=>{if(active?.recognition===recognition)reset()};
      try{recognition.start()}catch(error){reset();notice('Spracheingabe konnte nicht gestartet werden: '+error.message)}
    });
  });
})();
$('insert').onclick=()=>addStop($('search').value);
$('add').onclick=()=>{$('search').focus();setStatus('Adresse eingeben und auf „Hinzufügen“ tippen.')};
$('gps').onclick=()=>{if(!navigator.geolocation){setStatus('GPS wird nicht unterstützt.');return}setStatus('GPS-Standort wird ermittelt …');navigator.geolocation.getCurrentPosition(p=>{state.start={name:'Mein GPS-Standort',lat:p.coords.latitude,lon:p.coords.longitude};originLookup=null;$('start').value=state.start.name;setStatus('GPS-Standort übernommen.')},e=>setStatus('GPS nicht verfügbar: '+e.message),{enableHighAccuracy:true,timeout:15000})};
async function resolve(point){if(Number.isFinite(point.lat)&&Number.isFinite(point.lon))return point;const matches=await lookup(point.name,point===state.start?null:(validCoords(state.start)?state.start:null));if(!matches.length)throw Error('Adresse nicht gefunden: '+point.name);point.lat=matches[0].lat;point.lon=matches[0].lon;return point}
function startPoint(){const name=$('start').value.trim();if(!name)throw Error('Bitte zuerst einen Startpunkt eingeben oder GPS verwenden.');if(state.start.name!==name)state.start={name,lat:null,lon:null};return state.start}
$('optimize').onclick=async()=>{const btn=$('optimize');btn.disabled=true;try{const start=await resolve(startPoint());if(state.stops.length<2)throw Error('Mindestens zwei Zwischenstopps für die Optimierung eingeben.');setStatus('Adressen werden geprüft …');for(const s of state.stops)await resolve(s);const points=[start,...state.stops];const coords=points.map(p=>`${p.lon},${p.lat}`).join(';');const round=$('roundtrip').checked;const url=`https://router.project-osrm.org/trip/v1/driving/${coords}?source=first&destination=any&roundtrip=${round?'true':'false'}&overview=false&steps=false`;setStatus('Route wird optimiert …');const r=await fetch(url);if(!r.ok)throw Error('Routing-Dienst nicht erreichbar');const j=await r.json();if(j.code!=='Ok'||!j.waypoints)throw Error('Route konnte nicht optimiert werden.');const order=j.waypoints.map((w,i)=>({i,order:w.waypoint_index})).filter(x=>x.i>0).sort((a,b)=>a.order-b.order).map(x=>state.stops[x.i-1]);if(order.length!==state.stops.length)throw Error('Ungültige Routing-Antwort');state.stops=order;render();const km=j.trips?.[0]?.distance/1000;setStatus(`Route optimiert!${Number.isFinite(km)?' Ca. '+km.toFixed(1)+' km':''}\nHinweis: Die Fahrstrecke basiert auf dem OSRM-Autoprofil.`)}catch(e){setStatus('Fehler: '+e.message)}finally{btn.disabled=false}};
$('navigate').onclick=()=>{try{const start=startPoint();if(!state.stops.length)throw Error('Bitte mindestens einen Stopp hinzufügen.');const all=[start.name,...state.stops.map(s=>s.name),...($('roundtrip').checked?[start.name]:[])];if(all.length>10)setStatus('Viele Stopps: Google Maps wird in Teilstrecken geöffnet. Bitte die nächste Teilstrecke nach Ankunft öffnen.');const chunks=[];let i=0;while(i<all.length-1){const end=Math.min(i+8,all.length-1);const segment=all.slice(i,end+1);const origin=segment[0]==='Mein GPS-Standort'&&start.lat!==null?`${start.lat},${start.lon}`:segment[0];const dest=segment.at(-1)==='Mein GPS-Standort'&&start.lat!==null?`${start.lat},${start.lon}`:segment.at(-1);const waypoints=segment.slice(1,-1).join('|');chunks.push('https://www.google.com/maps/dir/?api=1&travelmode=driving&origin='+encodeURIComponent(origin)+'&destination='+encodeURIComponent(dest)+(waypoints?'&waypoints='+encodeURIComponent(waypoints):''));i=end}if(chunks.length===1){window.open(chunks[0],'_blank','noopener')}else{const root=$('status');root.replaceChildren(document.createTextNode('Route besteht aus '+chunks.length+' Teilstrecken: '));chunks.forEach((u,i)=>{const a=document.createElement('a');a.href=u;a.target='_blank';a.rel='noopener';a.textContent=`Teilstrecke ${i+1} öffnen`;a.style.display='block';root.append(a)})}}catch(e){setStatus(e.message)}};
$('save').onclick=()=>{localStorage.setItem('rp-pwa-route',JSON.stringify({start:state.start,stops:state.stops,roundtrip:$('roundtrip').checked}));setStatus('Route auf diesem Gerät gespeichert.')};
$('load').onclick=()=>{try{const d=JSON.parse(localStorage.getItem('rp-pwa-route'));if(!d)throw Error('Noch keine gespeicherte Route vorhanden.');state.start=d.start||{name:'',lat:null,lon:null};state.stops=Array.isArray(d.stops)?d.stops:[];$('start').value=state.start.name||'';$('roundtrip').checked=d.roundtrip!==false;render();setStatus('Route geladen.')}catch(e){setStatus(e.message)}};
$('clear').onclick=()=>{if(confirm('Aktuelle Route wirklich leeren?')){state.start={name:'',lat:null,lon:null};state.stops=[];$('start').value='';render();setStatus('Route geleert.')}};
$('export').onclick=()=>{const rows=['Stopp;Adresse',...state.stops.map((s,i)=>`${i+1};"${s.name.replaceAll('"','""')}"`)];const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'}));a.download='RoutenPlaner-Stopps.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)};
$('file').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;const text=await file.text();const lines=text.replace(/^\ufeff/,'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);let count=0;for(const line of lines){if(/^stopp\s*[;,]/i.test(line)||/^adresse\s*[;,]/i.test(line))continue;let value=line;if(/^[0-9]+;/.test(line))value=line.replace(/^[0-9]+;/,'').replace(/^"|"$/g,'').replaceAll('""','"');else if(/^[0-9]+,/.test(line))value=line.replace(/^[0-9]+,/,'');if(value){addStop(value);count++}}setStatus(`${count} Stopps importiert. Bitte Adressen kontrollieren.`);e.target.value=''};
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
render();

// Benannte Routen: separat vom bisherigen Schnellspeicher (rp-pwa-route).
const NAMED_KEY='rp-pwa-named-routes-v2';
function getNamedRoutes(){try{const d=JSON.parse(localStorage.getItem(NAMED_KEY)||'[]');return Array.isArray(d)?d.filter(x=>x&&typeof x.id==='string'&&typeof x.name==='string'&&x.route&&Array.isArray(x.route.stops)):[]}catch{return []}}
function putNamedRoutes(routes){localStorage.setItem(NAMED_KEY,JSON.stringify(routes))}
function snapshotRoute(){return {start:{...state.start},stops:state.stops.map(x=>({...x})),roundtrip:$('roundtrip').checked}}
function applyRoute(route){state.start={...route.start};state.stops=route.stops.map(x=>({...x}));$('start').value=state.start.name||'';$('roundtrip').checked=route.roundtrip!==false;render()}
function renderNamedRoutes(){const root=$('savedRoutes');root.replaceChildren();const routes=getNamedRoutes();if(!routes.length){const p=document.createElement('p');p.className='hint';p.textContent='Noch keine benannten Routen gespeichert.';root.append(p);return}
for(const r of routes){const item=document.createElement('div');item.className='saved-route';const info=document.createElement('div');info.className='saved-info';const title=document.createElement('strong');title.textContent=r.name;const detail=document.createElement('small');detail.textContent=r.route.stops.length+' Zwischenstopps';info.append(title,detail);const actions=document.createElement('div');actions.className='saved-actions';const load=document.createElement('button');load.textContent='Laden';load.onclick=()=>{if((state.stops.length||$('start').value.trim())&&!confirm('Aktuelle Route durch „'+r.name+'“ ersetzen?'))return;applyRoute(r.route);$('routeName').value=r.name;setStatus('Route „'+r.name+'“ geladen.')};const rename=document.createElement('button');rename.textContent='Umbenennen';rename.onclick=()=>{const n=prompt('Neuer Routenname:',r.name);if(n===null)return;const name=n.trim();if(!name){setStatus('Bitte einen Routennamen eingeben.');return}const all=getNamedRoutes();if(all.some(x=>x.id!==r.id&&x.name.toLocaleLowerCase('de')===name.toLocaleLowerCase('de'))){setStatus('Dieser Routenname existiert bereits.');return}const current=all.find(x=>x.id===r.id);if(current){current.name=name;putNamedRoutes(all);renderNamedRoutes();setStatus('Route umbenannt.')}};const del=document.createElement('button');del.textContent='Löschen';del.className='delete';del.onclick=()=>{if(!confirm('Gespeicherte Route „'+r.name+'“ wirklich löschen?'))return;putNamedRoutes(getNamedRoutes().filter(x=>x.id!==r.id));renderNamedRoutes();setStatus('Gespeicherte Route gelöscht. Die aktuelle Route bleibt erhalten.')};actions.append(load,rename,del);item.append(info,actions);root.append(item)}}
$('saveNamed').onclick=()=>{const name=$('routeName').value.trim();if(!name){setStatus('Bitte zuerst einen Routennamen eingeben.');$('routeName').focus();return}if(!state.stops.length){setStatus('Bitte mindestens einen Zwischenstopp hinzufügen.');return}const routes=getNamedRoutes();const existing=routes.find(x=>x.name.toLocaleLowerCase('de')===name.toLocaleLowerCase('de'));if(existing){if(!confirm('Route „'+name+'“ existiert bereits. Mit aktueller Route überschreiben?'))return;existing.route=snapshotRoute();existing.updatedAt=new Date().toISOString()}else{routes.push({id:(typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(36).slice(2)),name,route:snapshotRoute(),updatedAt:new Date().toISOString()})}try{putNamedRoutes(routes);renderNamedRoutes();setStatus('Route „'+name+'“ gespeichert.')}catch(e){setStatus('Speichern fehlgeschlagen: '+e.message)}};
renderNamedRoutes();
