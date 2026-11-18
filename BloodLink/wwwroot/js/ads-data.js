/* =====================================================================
   BloodLink — shared advertisement data layer
   Used by the hospital dashboard (hospital.js) and the public ads page (ads.js).
   Demo storage: localStorage. Replace load/save with API calls in production.
   ===================================================================== */
(function(){
 const KEY="bloodlinkHospitalAds";
 const VAT_RATE=0.16; // Jordan general sales tax
 const CURRENCY="JOD";
 const PLANS={
  basic:   {id:"basic",   name:"Basic",    days:7,  price:25, perks:["Listed on the public ads page","Standard placement","7 days of visibility"]},
  featured:{id:"featured",name:"Featured", days:14, price:50, perks:["Highlighted card with badge","Priority placement","14 days of visibility"]},
  premium: {id:"premium", name:"Premium",  days:30, price:90, perks:["Top banner spot on the ads page","Featured badge + priority","30 days of visibility"]}
 };
 const DEPARTMENTS=["Orthopedics","Cardiology","Pediatrics","Internal medicine","Dermatology","Ophthalmology","Dental","Obstetrics & gynecology","Neurology","Blood bank","General / multiple"];
 const CATEGORIES={
  "Free consultation day":{color:"#13895f",icon:"stethoscope"},
  "Health screening":{color:"#3a72c9",icon:"pulse"},
  "Discounted service":{color:"#bd7c12",icon:"tag"},
  "Awareness campaign":{color:"#7a4cc2",icon:"megaphone"},
  "Blood donation drive":{color:"#d41d3d",icon:"drop"},
  "New service / clinic":{color:"#0f7f8f",icon:"spark"}
 };
 const pad=n=>String(n).padStart(2,"0");
 const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
 const today=()=>iso(new Date());
 const addDays=(isoDate,n)=>{const d=new Date(isoDate+"T12:00:00");d.setDate(d.getDate()+n);return iso(d)};
 const endDate=(start,planId)=>addDays(start,(PLANS[planId]?.days||7)-1);
 const fees=planId=>{const p=PLANS[planId]||PLANS.basic;const vat=Math.round(p.price*VAT_RATE*100)/100;return {fee:p.price,vat,total:Math.round((p.price+vat)*100)/100}};
 const money=n=>`${Number(n).toFixed(2)} ${CURRENCY}`;
 function status(ad,now=today()){
  if(ad.cancelled)return "Stopped";
  if(ad.startDate>now)return "Scheduled";
  if(ad.endDate<now)return "Expired";
  return "Active";
 }
 function seed(){
  const t=today();
  const mk=(o)=>({views:0,cancelled:false,createdAt:new Date().toISOString(),...o,endDate:endDate(o.startDate,o.plan),...(()=>{const f=fees(o.plan);return {paid:f.total}})()});
  return [
   mk({id:"AD-2026-002",owner:"self",hospital:"Al Hayat Hospital",title:"Free orthopedic consultation day",department:"Orthopedics",category:"Free consultation day",badge:"Free",
    description:"Meet our orthopedic consultants for a free assessment of knee, back, shoulder and joint pain. Bring any previous X-rays or reports. Limited slots — booking by phone is recommended.",
    eventDate:addDays(t,6),startTime:"09:00",endTime:"14:00",location:"Outpatient clinics, 2nd floor",phone:"+962 2 700 0000",booking:true,plan:"premium",startDate:addDays(t,-3),views:412}),
   mk({id:"AD-2026-001",owner:"self",hospital:"Al Hayat Hospital",title:"Community blood donation drive",department:"Blood bank",category:"Blood donation drive",badge:"Donate",
    description:"Help us restock O-, A- and B- blood. Every donor receives a free blood-type and hemoglobin check. Please eat beforehand and bring a valid ID.",
    eventDate:addDays(t,3),startTime:"10:00",endTime:"17:00",location:"Blood bank, ground floor",phone:"+962 2 700 0000",booking:false,plan:"featured",startDate:addDays(t,-5),views:268}),
   mk({id:"AD-2026-104",owner:"other",hospital:"Irbid Specialty Hospital",title:"Heart health screening week",department:"Cardiology",category:"Health screening",badge:"50% off",
    description:"ECG, blood pressure and cholesterol screening at half price for adults over 40. Results reviewed by a cardiologist on the same day.",
    eventDate:addDays(t,9),startTime:"08:30",endTime:"13:30",location:"Cardiology center",phone:"+962 2 710 0000",booking:true,plan:"featured",startDate:addDays(t,-1),views:193}),
   mk({id:"AD-2026-107",owner:"other",hospital:"Princess Basma Hospital",title:"Children's vision check",department:"Ophthalmology",category:"Free consultation day",badge:"Free",
    description:"Free eye exams for school children aged 5–14. Parents must accompany children. Glasses prescriptions provided where needed.",
    eventDate:addDays(t,4),startTime:"09:00",endTime:"12:00",location:"Eye clinic, building B",phone:"+962 2 720 0000",booking:false,plan:"basic",startDate:addDays(t,-2),views:121}),
   mk({id:"AD-2026-109",owner:"other",hospital:"Irbid Specialty Hospital",title:"Breast cancer awareness talk",department:"Obstetrics & gynecology",category:"Awareness campaign",badge:"Open to all",
    description:"A short talk on early detection and self-examination, followed by questions with our specialists. Free mammogram vouchers for eligible attendees.",
    eventDate:addDays(t,11),startTime:"16:00",endTime:"18:00",location:"Main auditorium",phone:"+962 2 710 0000",booking:false,plan:"basic",startDate:t,views:64})
  ];
 }
 function load(){
  try{const v=localStorage.getItem(KEY);if(v){const list=JSON.parse(v);if(Array.isArray(list))return list}}catch{}
  const s=seed();save(s);return s;
 }
 function save(list){try{localStorage.setItem(KEY,JSON.stringify(list))}catch{}}
 function nextId(list){const y=new Date().getFullYear();const n=Math.max(0,...list.map(a=>Number(String(a.id).split("-").pop())||0))+1;return `AD-${y}-${String(n).padStart(3,"0")}`}
 function formatDate(v,opts={day:"2-digit",month:"short",year:"numeric"}){if(!v)return "—";const d=new Date(v+"T12:00:00");return Number.isNaN(d.getTime())?v:d.toLocaleDateString("en-GB",opts)}
 function formatTime(t){if(!t)return "";const [h,m]=t.split(":").map(Number);const d=new Date();d.setHours(h,m||0);return d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}
 const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const ICONS={
  clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  pin:'<svg viewBox="0 0 24 24"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0113 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>',
  phone:'<svg viewBox="0 0 24 24"><path d="M6.5 3.5h3l1.5 4-2 1.3a10 10 0 005.2 5.2l1.3-2 4 1.5v3a2 2 0 01-2.2 2A16 16 0 014.5 5.7a2 2 0 012-2.2z"/></svg>',
  hospital:'<svg viewBox="0 0 24 24"><path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-6h6v6M10 10h4M12 8v4"/></svg>'
 };
 // One card template shared by the dashboard preview and the public page.
 function cardHTML(ad,{preview=false}={}){
  const cat=CATEGORIES[ad.category]||{color:"#d41d3d"};
  const d=ad.eventDate?new Date(ad.eventDate+"T12:00:00"):null;
  const valid=d&&!Number.isNaN(d.getTime());
  const day=valid?d.getDate():"--",mon=valid?d.toLocaleDateString("en-GB",{month:"short"}).toUpperCase():"DATE";
  const wk=valid?d.toLocaleDateString("en-GB",{weekday:"short"}):"";
  const time=[formatTime(ad.startTime),formatTime(ad.endTime)].filter(Boolean).join(" – ");
  const featured=ad.plan&&ad.plan!=="basic";
  return `<article class="ad-card plan-${esc(ad.plan||"basic")}${preview?" is-preview":""}" style="--accent:${cat.color}" data-ad-card="${esc(ad.id||"")}">
   <div class="ad-card-top">
    <div class="ad-date"><small>${esc(wk)}</small><b>${day}</b><small>${esc(mon)}</small></div>
    <div class="ad-tags"><span class="ad-cat">${esc(ad.category||"Ad type")}</span>${featured?`<span class="ad-featured">★ ${ad.plan==="premium"?"Premium":"Featured"}</span>`:""}</div>
    ${ad.badge?`<span class="ad-badge">${esc(ad.badge)}</span>`:""}
   </div>
   <h3>${esc(ad.title||"Your ad title")}</h3>
   <p class="ad-hospital">${ICONS.hospital}<span>${esc(ad.hospital||"Hospital")} · ${esc(ad.department||"Department")}</span></p>
   <p class="ad-desc">${esc(ad.description||"A short description of the event appears here.")}</p>
   <ul class="ad-facts"><li>${ICONS.clock}<span>${esc(time||"Time")}</span></li><li>${ICONS.pin}<span>${esc(ad.location||"Location")}</span></li></ul>
   <div class="ad-card-foot"><span class="sponsored">Sponsored</span>${ad.booking?'<span class="booking-chip">Booking required</span>':""}<button class="ad-more" type="button" data-ad="${esc(ad.id||"")}"${preview?" tabindex=\"-1\"":""}>Details <span>→</span></button></div>
  </article>`;
 }
 window.BloodLinkAds={KEY,VAT_RATE,CURRENCY,PLANS,DEPARTMENTS,CATEGORIES,ICONS,today,addDays,endDate,fees,money,status,load,save,nextId,formatDate,formatTime,esc,cardHTML};
})();
