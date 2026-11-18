/* BloodLink — public health events & offers page */
(function(){
 const A=window.BloodLinkAds,$=id=>document.getElementById(id),esc=A.esc;
 let all=[],dept="all",toastTimer=null;

 function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),2600)}
 const liveAds=()=>A.load().filter(a=>A.status(a)==="Active"&&a.eventDate>=A.today());
 const isFree=a=>/free/i.test(`${a.badge} ${a.category}`);
 const planRank={premium:0,featured:1,basic:2};

 function filtered(){
  const q=$("adSearch").value.trim().toLowerCase(),type=$("typeFilter").value,sort=$("sortBy").value;
  const list=all.filter(a=>(dept==="all"||a.department===dept)&&(type==="all"||a.category===type)&&
   (!q||[a.title,a.department,a.category,a.hospital,a.description,a.badge,a.location].some(v=>String(v||"").toLowerCase().includes(q))));
  const by={soon:(x,y)=>x.eventDate.localeCompare(y.eventDate)||x.startTime.localeCompare(y.startTime),
   new:(x,y)=>String(y.createdAt||y.startDate).localeCompare(String(x.createdAt||x.startDate)),
   popular:(x,y)=>(y.views||0)-(x.views||0)}[sort];
  // Paid placement: premium/featured ads rank above basic ones, then the chosen sort applies.
  return list.sort((x,y)=>(planRank[x.plan]??2)-(planRank[y.plan]??2)||by(x,y));
 }
 function renderChips(){
  const depts=[...new Set(all.map(a=>a.department))].sort();
  if(dept!=="all"&&!depts.includes(dept))dept="all";
  $("deptChips").innerHTML=["all",...depts].map(d=>{const n=d==="all"?all.length:all.filter(a=>a.department===d).length;
   return `<button type="button" class="chip${d===dept?" active":""}" data-dept="${esc(d)}" aria-pressed="${d===dept}">${d==="all"?"All departments":esc(d)} <span>${n}</span></button>`}).join("");
 }
 function renderTypes(){
  const sel=$("typeFilter"),cur=sel.value;
  sel.innerHTML='<option value="all">All types</option>'+Object.keys(A.CATEGORIES).map(c=>`<option${c===cur?" selected":""}>${esc(c)}</option>`).join("");
 }
 function spotlightHTML(a){
  const c=A.CATEGORIES[a.category]?.color||"#d41d3d";
  return `<article class="spot" style="--accent:${c}" data-ad="${esc(a.id)}" tabindex="0" role="button" aria-label="${esc(a.title)} — view details">
   <div class="spot-tags"><span>★ Premium</span><span>${esc(a.category)}</span></div>
   ${a.badge?`<span class="spot-badge">${esc(a.badge)}</span>`:""}
   <h3>${esc(a.title)}</h3>
   <p>${esc(a.hospital)} · ${esc(a.department)}</p>
   <div class="spot-foot"><span>${A.formatDate(a.eventDate,{weekday:"short",day:"numeric",month:"short"})} · ${esc(A.formatTime(a.startTime))}</span><b>Details →</b></div>
  </article>`;
 }
 function render(){
  const list=filtered();
  $("adGrid").innerHTML=list.map(a=>A.cardHTML(a)).join("");
  $("emptyState").hidden=list.length>0;
  $("resultsLine").textContent=`${list.length} event${list.length===1?"":"s"}${dept!=="all"?` in ${dept}`:""}`;
  const premium=all.filter(a=>a.plan==="premium");
  $("spotlightWrap").hidden=!premium.length;
  $("spotlight").innerHTML=premium.map(spotlightHTML).join("");
 }
 function refresh(){
  all=liveAds();
  $("statAds").textContent=all.length;
  $("statHospitals").textContent=new Set(all.map(a=>a.hospital)).size;
  $("statFree").textContent=all.filter(isFree).length;
  renderTypes();renderChips();render();
 }

 /* ---------- Details dialog ---------- */
 const dlg=$("adDialog");
 function bumpViews(id){
  const k="bloodlinkAdSeen";let seen=[];try{seen=JSON.parse(sessionStorage.getItem(k)||"[]")}catch{}
  if(seen.includes(id))return;
  const list=A.load(),ad=list.find(a=>a.id===id);if(!ad)return;
  ad.views=(Number(ad.views)||0)+1;A.save(list);
  try{sessionStorage.setItem(k,JSON.stringify([...seen,id]))}catch{}
 }
 function openAd(id){
  const a=all.find(x=>x.id===id);
  if(!a){toast("This event is no longer available.");return}
  const c=A.CATEGORIES[a.category]?.color||"#d41d3d";
  const when=A.formatDate(a.eventDate,{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  const days=Math.round((new Date(a.eventDate+"T12:00:00")-new Date(A.today()+"T12:00:00"))/864e5);
  const rel=days===0?"Today":days===1?"Tomorrow":`In ${days} days`;
  $("dlgBody").innerHTML=`<header class="dlg-hero" style="--accent:${c}">
    <button class="dlg-close" type="button" data-close aria-label="Close">×</button>
    <div class="dlg-tags"><span>${esc(a.category)}</span>${a.plan!=="basic"?`<span>★ ${a.plan==="premium"?"Premium":"Featured"}</span>`:""}${a.badge?`<span class="solid">${esc(a.badge)}</span>`:""}</div>
    <h2 id="dlgTitle">${esc(a.title)}</h2>
    <p>${A.ICONS.hospital}${esc(a.hospital)} · ${esc(a.department)}</p>
   </header>
   <div class="dlg-content">
    <div class="dlg-when"><div><small>${rel.toUpperCase()}</small><b>${esc(when)}</b><span>${esc(A.formatTime(a.startTime))} – ${esc(A.formatTime(a.endTime))}</span></div></div>
    <p class="dlg-desc">${esc(a.description)}</p>
    <ul class="dlg-facts">
     <li>${A.ICONS.pin}<div><small>Location</small><b>${esc(a.location)}, ${esc(a.hospital)}</b></div></li>
     <li>${A.ICONS.phone}<div><small>Contact</small><b>${esc(a.phone)}</b></div></li>
     ${a.booking?`<li class="note">${A.ICONS.clock}<div><small>Booking</small><b>Booking by phone is required — slots may be limited.</b></div></li>`:""}
    </ul>
    <div class="dlg-actions">
     <a class="btn primary" href="tel:${esc(a.phone.replace(/[^\d+]/g,""))}">${A.ICONS.phone} Call to ${a.booking?"book":"ask"}</a>

    </div>
    <p class="dlg-legal">Sponsored listing by ${esc(a.hospital)}. Please confirm details with the hospital before visiting.</p>
   </div>`;
  bumpViews(id);
  if(location.hash!==`#${id}`)history.replaceState(null,"",`#${encodeURIComponent(id)}`);
  if(typeof dlg.showModal==="function"){if(!dlg.open)dlg.showModal()}else dlg.setAttribute("open","");
 }
 function closeAd(){if(dlg.open)dlg.close();else dlg.removeAttribute("open")}
 dlg.addEventListener("close",()=>history.replaceState(null,"",location.pathname+location.search));
 dlg.addEventListener("click",e=>{
  if(e.target===dlg||e.target.closest("[data-close]")){closeAd();return}
  const ics=e.target.closest("[data-ics]");if(ics)downloadICS(ics.dataset.ics);
  const sh=e.target.closest("[data-share]");if(sh)share(sh.dataset.share);
 });
 function downloadICS(id){
  const a=all.find(x=>x.id===id);if(!a)return;
  const dt=(d,t)=>d.replace(/-/g,"")+"T"+t.replace(":","")+"00";
  const clean=s=>String(s||"").replace(/([,;\\])/g,"\\$1").replace(/\n/g,"\\n");
  const ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//BloodLink//Health Events//EN","BEGIN:VEVENT",
   `UID:${a.id}@bloodlink`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,"").slice(0,15)}Z`,
   `DTSTART:${dt(a.eventDate,a.startTime)}`,`DTEND:${dt(a.eventDate,a.endTime)}`,
   `SUMMARY:${clean(a.title)}`,`LOCATION:${clean(a.location+", "+a.hospital)}`,
   `DESCRIPTION:${clean(a.description+"\nContact: "+a.phone)}`,"END:VEVENT","END:VCALENDAR"].join("\r\n");
  const url=URL.createObjectURL(new Blob([ics],{type:"text/calendar"})),link=document.createElement("a");
  link.href=url;link.download=`${a.id}.ics`;link.click();setTimeout(()=>URL.revokeObjectURL(url),500);
  toast("Calendar event downloaded.");
 }
 async function share(id){
  const a=all.find(x=>x.id===id);if(!a)return;
  const url=`${location.origin}${location.pathname}#${encodeURIComponent(id)}`;
  try{
   if(navigator.share){await navigator.share({title:a.title,text:`${a.title} — ${a.hospital}`,url});return}
   await navigator.clipboard.writeText(url);toast("Link copied to clipboard.");
  }catch(err){if(err?.name!=="AbortError")toast("Couldn't share — copy the address bar link instead.")}
 }

 /* ---------- Events ---------- */
 $("adSearch").addEventListener("input",render);
 $("typeFilter").addEventListener("change",render);
 $("sortBy").addEventListener("change",render);
 $("deptChips").addEventListener("click",e=>{const b=e.target.closest("[data-dept]");if(!b)return;dept=b.dataset.dept;renderChips();render()});
 $("clearFilters").addEventListener("click",()=>{dept="all";$("adSearch").value="";$("typeFilter").value="all";renderChips();render()});
 document.addEventListener("click",e=>{const t=e.target.closest(".ad-more[data-ad], .spot[data-ad]");if(t&&!dlg.contains(t))openAd(t.dataset.ad)});
 $("adGrid").addEventListener("click",e=>{if(e.target.closest(".ad-more"))return;const card=e.target.closest("[data-ad-card]");if(card)openAd(card.dataset.adCard)});
 $("spotlight").addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.matches(".spot")){e.preventDefault();openAd(e.target.dataset.ad)}});
 window.addEventListener("storage",e=>{if(e.key===A.KEY)refresh()});
 window.addEventListener("hashchange",()=>{const id=decodeURIComponent(location.hash.slice(1));if(id)openAd(id)});

 refresh();
 const initial=decodeURIComponent(location.hash.slice(1));if(initial)openAd(initial);
})();
