// QuestLog service worker: offline support + reminders.
const CACHE='questlog-1.3.0';
const FILES=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png','favicon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k!=='questlog-reminders').map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put('index.html',cp));return r}).catch(()=>caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
// ---- reminders: the app saves a plan of what's due; when Android wakes us, show what's due today ----
function ymd(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
async function checkReminders(){
  const c=await caches.open('questlog-reminders');
  const pr=await c.match('/__plan');if(!pr)return;const plan=await pr.json();if(!plan.on)return;
  const now=new Date(),t=ymd(now),h=now.getHours();
  if(h<(plan.hour||8)||h>=21)return;
  const sr=await c.match('/__shown');const shown=sr?await sr.json():{};
  const clients=await self.clients.matchAll({type:'window'});if(clients.some(x=>x.visibilityState==='visible'))return;
  for(const it of plan.items||[]){
    if(it.date!==t||shown[it.id])continue;
    await self.registration.showNotification(it.title,{body:it.body,tag:it.id,icon:'icon-192.png',badge:'icon-192.png',data:{url:'./'}});
    shown[it.id]=t;
  }
  for(const k in shown)if(shown[k]<ymd(new Date(Date.now()-14*864e5)))delete shown[k];
  await c.put('/__shown',new Response(JSON.stringify(shown),{headers:{'content-type':'application/json'}}));
}
self.addEventListener('periodicsync',e=>{if(e.tag==='questlog-reminders')e.waitUntil(checkReminders())});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{for(const c of cs){if('focus' in c)return c.focus()}return self.clients.openWindow('./')}))});
