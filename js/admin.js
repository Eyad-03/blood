/* =====================================================================
   BloodLink Admin Console
   - Account verification for hospitals / centers (inactive until activated)
   - Hall booking processing (shares storage with hall.html → "My Requests")
   - Incoming reports inbox
   Demo persistence: localStorage. Replace read/save with API calls later.
   ===================================================================== */
const $=id=>document.getElementById(id);
const reduceMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const KEYS={accounts:"bloodlinkAdminAccounts",reports:"bloodlinkAdminReports",log:"bloodlinkAdminLog",demoBookings:"bloodlinkAdminDemoBookings",hallRequests:"mubadartiHallRequests"};
const read=(k,f)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):f}catch{return f}};
const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ago=(d,h=0)=>new Date(Date.now()-(d*24+h)*3600e3).toISOString();
const ahead=d=>new Date(Date.now()+d*864e5).toISOString().slice(0,10);
const fmtDate=v=>{if(!v)return"—";const d=new Date(v.length===10?v+"T12:00:00":v);return isNaN(d)?esc(v):d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})};
function timeAgo(iso){const m=Math.round((Date.now()-new Date(iso))/6e4);if(m<1)return"just now";if(m<60)return`${m}m ago`;const h=Math.round(m/60);if(h<24)return`${h}h ago`;const d=Math.round(h/24);return d<30?`${d}d ago`:fmtDate(iso)}
const hoursSince=iso=>(Date.now()-new Date(iso))/36e5;
const initials=n=>n.split(/\s+/).filter(w=>/^[A-Za-z]/.test(w)).slice(0,2).map(w=>w[0]).join("").toUpperCase();
const AVATAR=[["#ef4562","#9e0d28"],["#f0a531","#b76a06"],["#4f8ae0","#244f9e"],["#34b07f","#0b6a49"],["#8a6be0","#4b2fa0"],["#ef6aa0","#a3245b"]];
const avatar=(name,lg)=>{const [a,b]=AVATAR[[...name].reduce((s,c)=>s+c.charCodeAt(0),0)%AVATAR.length];return`<span class="org-avatar${lg?" lg":""}" style="--a1:${a};--a2:${b}">${esc(initials(name))}</span>`};
const ICON={
 account:'<svg viewBox="0 0 24 24"><path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-6h6v6M10 10h4M12 8v4"/></svg>',
 booking:'<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
 report:'<svg viewBox="0 0 24 24"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
 doc:'<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
 check:'<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
 x:'<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
 flag:'<svg viewBox="0 0 24 24"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
 bug:'<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="13" rx="5"/><path d="M12 11v9M7 13H3M21 13h-4M7 17l-3 2M17 17l3 2M9 7l-2-3M15 7l2-3"/></svg>',
 user:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>',
 drop:'<svg viewBox="0 0 24 24"><path d="M12 2.5s-6.5 7.2-6.5 11.8a6.5 6.5 0 0013 0C18.5 9.7 12 2.5 12 2.5z"/></svg>',
 clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
 star:'<svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
 inbox:'<svg viewBox="0 0 24 24"><path d="M3 13l3-8h12l3 8v6a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M3 13h5l1 3h6l1-3h5"/></svg>',
 pay:'<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M7 15h4"/></svg>'
};

/* ---------------- Demo seed data ---------------- */
const DOCS=(a,b,c)=>[{name:"Ministry of Health operating license",file:a,size:"1.8 MB",checked:false},{name:"Registration certificate",file:b,size:"920 KB",checked:false},{name:"Authorized representative ID",file:c,size:"640 KB",checked:false}];
const seedAccounts=()=>[
 {id:"ORG-1042",name:"Al Rahma Specialty Hospital",type:"Hospital",city:"Irbid",license:"MOH-IRB-55821",email:"admin@alrahma-hospital.jo",phone:"+962 2 724 1100",contact:"Dr. Rami Odeh",address:"Al-Hashmi Street, Irbid",registeredAt:ago(0,5),status:"Pending",docs:DOCS("moh_license_alrahma.pdf","registration_alrahma.pdf","id_rami_odeh.jpg")},
 {id:"ORG-1041",name:"Northern Blood Donation Center",type:"Blood donation center",city:"Mafraq",license:"MOH-MAF-31207",email:"info@nbdc.jo",phone:"+962 2 623 4400",contact:"Lama Saeed",address:"Hospital Road, Mafraq",registeredAt:ago(1,3),status:"Pending",docs:DOCS("license_nbdc.pdf","certificate_nbdc.pdf","id_lama_saeed.pdf")},
 {id:"ORG-1039",name:"Amman Life Medical Center",type:"Medical center",city:"Amman",license:"MOH-AMM-90433",email:"contact@amman-life.jo",phone:"+962 6 551 9000",contact:"Khaled Nimri",address:"Mecca Street, Amman",registeredAt:ago(3,2),status:"Pending",docs:DOCS("moh_license_aml.pdf","registration_aml.pdf","id_khaled.jpg")},
 {id:"ORG-1037",name:"Zarqa Community Health Clinic",type:"Medical center",city:"Zarqa",license:"MOH-ZRQ-12090",email:"clinic@zarqahealth.jo",phone:"+962 5 398 2211",contact:"Nour Haddad",address:"New Zarqa, Zarqa",registeredAt:ago(4,6),status:"Pending",docs:[...DOCS("license_zchc.pdf","registration_zchc.pdf","")].slice(0,2)},
 {id:"ORG-1031",name:"Al Hayat Hospital",type:"Hospital",city:"Irbid",license:"MOH-IRB-40017",email:"bloodbank@alhayat.example",phone:"+962 2 700 0000",contact:"Hospital Admin",address:"University Street, Irbid",registeredAt:ago(22),status:"Active",decidedAt:ago(21),docs:DOCS("license.pdf","registration.pdf","id.pdf").map(d=>({...d,checked:true}))},
 {id:"ORG-1028",name:"Aqaba Red Crescent Center",type:"Blood donation center",city:"Aqaba",license:"MOH-AQB-77310",email:"aqaba@redcrescent.jo",phone:"+962 3 201 7788",contact:"Fadi Amro",address:"Aqaba city center",registeredAt:ago(30),status:"Active",decidedAt:ago(29),docs:DOCS("license.pdf","registration.pdf","id.pdf").map(d=>({...d,checked:true}))},
 {id:"ORG-1026",name:"Jerash Family Hospital",type:"Hospital",city:"Jerash",license:"MOH-JRS-20981",email:"info@jerashfamily.jo",phone:"+962 2 635 5500",contact:"Dr. Hiba Khatib",address:"Downtown, Jerash",registeredAt:ago(35),status:"Active",decidedAt:ago(33),docs:DOCS("license.pdf","registration.pdf","id.pdf").map(d=>({...d,checked:true}))},
 {id:"ORG-1024",name:"Quick Care Lab",type:"Medical center",city:"Amman",license:"—",email:"hello@quickcarelab.com",phone:"+962 7 9000 1234",contact:"Sami T.",address:"Abdoun, Amman",registeredAt:ago(40),status:"Rejected",decidedAt:ago(38),reason:"License number could not be verified with the Ministry of Health registry.",docs:DOCS("license_qcl.png","registration_qcl.pdf","id_sami.jpg")}
];
const seedBookings=()=>[
 {id:"HB-2026-418230",hallName:"Irbid Innovation Center",governorate:"Irbid",price:70,organization:"Irbid Youth Blood Drive",contactName:"Mais Qasem",email:"mais@iybd.org",phone:"0791112233",eventType:"Initiative",eventDate:ahead(9),attendees:60,eventTime:"Morning",description:"Community blood donation awareness day with a mobile donation unit.",documents:[{label:"Official venue booking request letter",fileName:"request_letter.pdf"},{label:"Event plan",fileName:"plan_iybd.pdf"},{label:"Proof of organization registration",fileName:"registration.pdf"}],status:"Pending approval",createdAt:ago(0,7)},
 {id:"HB-2026-417915",hallName:"University of Jordan Conference Hall",governorate:"Amman",price:180,organization:"Jordan Hematology Society",contactName:"Dr. Ola Faris",email:"ola@jhs.jo",phone:"0795554433",eventType:"Conference",eventDate:ahead(21),attendees:220,eventTime:"All day",description:"Annual conference on transfusion medicine and donor safety.",documents:[{label:"Official venue booking request letter",fileName:"jhs_letter.pdf"},{label:"Event plan",fileName:"agenda_2026.pdf"},{label:"Proof of organization registration",fileName:"jhs_registration.pdf"}],status:"Pending approval",createdAt:ago(2,4)},
 {id:"HB-2026-417702",hallName:"Zaha Cultural Center",governorate:"Amman",price:95,organization:"Lifeline Volunteers",contactName:"Yazan Kh.",email:"yazan@lifeline.org",phone:"0787771122",eventType:"Workshop",eventDate:ahead(5),attendees:45,eventTime:"Evening",description:"Training volunteers on donor registration and first aid.",documents:[{label:"Official venue booking request letter",fileName:"letter.pdf"},{label:"Event plan",fileName:"workshop_plan.docx"},{label:"Proof of organization registration",fileName:"cert.pdf"}],status:"Approved",createdAt:ago(5),adminNote:"Approved. Please complete payment to confirm."},
 {id:"HB-2026-417410",hallName:"Greater Irbid Municipality Hall",governorate:"Irbid",price:130,organization:"Red Drop Initiative",contactName:"Sara Nasser",email:"sara@reddrop.org",phone:"0779990011",eventType:"Initiative",eventDate:ahead(2),attendees:150,eventTime:"Morning",description:"Public donation campaign with partner hospitals.",documents:[{label:"Official venue booking request letter",fileName:"reddrop_letter.pdf"},{label:"Event plan",fileName:"campaign.pdf"},{label:"Proof of organization registration",fileName:"reddrop_reg.pdf"}],status:"Paid",createdAt:ago(9),paymentMethod:"Bank card"},
 {id:"HB-2026-416988",hallName:"Aqaba Grand Hall",governorate:"Aqaba",price:260,organization:"Southern Health Forum",contactName:"Ahmad Z.",email:"ahmad@shf.jo",phone:"0793334455",eventType:"Conference",eventDate:ago(6).slice(0,10),attendees:340,eventTime:"All day",description:"Regional forum on emergency blood supply.",documents:[{label:"Official venue booking request letter",fileName:"shf.pdf"},{label:"Event plan",fileName:"shf_plan.pdf"},{label:"Proof of organization registration",fileName:"shf_reg.pdf"}],status:"Completed",createdAt:ago(25),adminNote:"Booking completed. Thank you for hosting with BloodLink."},
 {id:"HB-2026-416550",hallName:"King Abdullah II Community Center",governorate:"Zarqa",price:55,organization:"Unnamed group",contactName:"—",email:"anon@mail.com",phone:"0700000000",eventType:"Training",eventDate:ahead(1),attendees:30,eventTime:"Evening",description:"No description provided.",documents:[{label:"Official venue booking request letter",fileName:"blank.pdf"}],status:"Rejected",createdAt:ago(12),adminNote:"Rejected: the organization registration document is missing."}
];
const seedReports=()=>[
 {id:"RP-3109",title:"Donor received wrong appointment time",category:"Donor complaint",priority:"high",from:"Hala Mahmoud",role:"Donor",email:"hala.mahmoud@example.com",createdAt:ago(0,2),status:"New",read:false,related:"Al Hayat Hospital",attachments:["sms_screenshot.png"],body:"I booked a donation for 10:00 but the confirmation SMS said 14:00. I arrived and waited for two hours.\n\nPlease check the reminder system so this doesn't happen to other donors."},
 {id:"RP-3108",title:"Hall listing shows wrong capacity",category:"Booking issue",priority:"medium",from:"Lifeline Volunteers",role:"Organization",email:"yazan@lifeline.org",createdAt:ago(0,9),status:"New",read:false,related:"Zaha Cultural Center",attachments:[],body:"The Zaha Cultural Center page says 120 people but the venue told us the limit is 90 for workshops."},
 {id:"RP-3105",title:"Suspicious hospital account",category:"Inappropriate content",priority:"high",from:"Omar Haddad",role:"Donor",email:"omar.haddad@example.com",createdAt:ago(1,4),status:"In review",read:true,related:"Quick Care Lab",attachments:["message_export.pdf"],body:"An account claiming to be a medical center messaged me asking for payment to 'reserve' a donation slot. Donations should be free."},
 {id:"RP-3101",title:"Map search not loading on mobile",category:"Technical issue",priority:"medium",from:"Zaid Fawzi",role:"Donor",email:"zaid.fawzi@example.com",createdAt:ago(2,1),status:"New",read:true,related:"Donor search page",attachments:["iphone_recording.mp4"],body:"On iPhone Safari the donor search map stays blank. It works on desktop."},
 {id:"RP-3097",title:"Request to correct blood type",category:"Data correction",priority:"low",from:"Yousef Saleh",role:"Donor",email:"yousef.saleh@example.com",createdAt:ago(4),status:"In review",read:true,related:"Donor profile",attachments:["lab_result.pdf"],body:"My profile shows A- but my latest lab result is B-. Attached the lab report."},
 {id:"RP-3090",title:"Inventory export missing notes",category:"Hospital issue",priority:"low",from:"Al Hayat Hospital",role:"Hospital",email:"bloodbank@alhayat.example",createdAt:ago(8),status:"Resolved",read:true,related:"Hospital portal",attachments:[],body:"The CSV export does not include the notes column.",response:"Fixed in the latest portal update — notes are now included in the export."}
];
const seedLog=()=>[
 {text:"Activated Jerash Family Hospital",icon:"check",color:"#13895f",at:ago(2,3)},
 {text:"Marked HB-2026-416988 as completed",icon:"star",color:"#6a4bc4",at:ago(3,1)},
 {text:"Rejected Quick Care Lab",icon:"x",color:"#d41d3d",at:ago(5)},
 {text:"Resolved report RP-3090",icon:"check",color:"#13895f",at:ago(6)}
];

let accounts=read(KEYS.accounts,null)||seedAccounts();
let reports=read(KEYS.reports,null)||seedReports();
let activity=read(KEYS.log,null)||seedLog();
if(!read(KEYS.demoBookings,null))save(KEYS.demoBookings,seedBookings());
save(KEYS.accounts,accounts);save(KEYS.reports,reports);save(KEYS.log,activity);

/* Bookings: real requests come from hall.html storage; demo ones live in an admin-only key. */
function allBookings(){
 const real=read(KEYS.hallRequests,[]).map(r=>({...r,_src:"real"}));
 const demo=read(KEYS.demoBookings,[]).map(r=>({...r,_src:"demo"}));
 return [...real,...demo].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
}
function updateBooking(id,patch){
 for(const key of [KEYS.hallRequests,KEYS.demoBookings]){
  const rows=read(key,[]);const r=rows.find(x=>x.id===id);
  if(r){Object.assign(r,patch,{updatedAt:new Date().toISOString()});(r.history=r.history||[]).push({status:r.status,at:r.updatedAt});save(key,rows);return r}
 }
}
function logAction(text,icon,color){activity.unshift({text,icon,color,at:new Date().toISOString()});activity=activity.slice(0,30);save(KEYS.log,activity)}

/* ---------------- Status helpers ---------------- */
const accountPill=s=>`<span class="status-pill ${s==="Pending"?"pending":s==="Active"?"active":"rejected"}">${s==="Pending"?"Pending review":esc(s)}</span>`;
const BOOKING_CLASS={"Pending approval":"pending","Approved":"approved","Paid":"paid","Completed":"completed","Rejected":"rejected"};
const bookingPill=s=>`<span class="status-pill ${BOOKING_CLASS[s]||"pending"}">${esc(s)}</span>`;
const reportPill=s=>`<span class="status-pill ${s==="New"?"new":s==="In review"?"review":"resolved"}">${esc(s)}</span>`;
const prioTag=p=>`<span class="prio ${p}">${p[0].toUpperCase()+p.slice(1)} priority</span>`;
const bookingNeedsAction=b=>b.status==="Pending approval"||b.status==="Paid";

/* ---------------- Overview ---------------- */
function counts(){
 const b=allBookings();
 return{
  pendingAcc:accounts.filter(a=>a.status==="Pending"),
  activeAcc:accounts.filter(a=>a.status==="Active"),
  bookings:b,
  todoBookings:b.filter(bookingNeedsAction),
  openReports:reports.filter(r=>r.status!=="Resolved"),
 };
}
function renderOverview(){
 const c=counts();
 const hour=new Date().getHours();
 $("adminGreeting").childNodes[0].textContent=hour<12?"Good morning, ":hour<18?"Good afternoon, ":"Good evening, ";
 const total=c.pendingAcc.length+c.todoBookings.length+c.openReports.length;
 $("heroSummary").textContent=total?`${total} item${total===1?"":"s"} waiting for you across verification, bookings and reports.`:"All queues are clear. Nice work.";
 $("sideQueueText").textContent=total?`${total} items in queue`:"All queues clear";
 $("navAccounts").textContent=c.pendingAcc.length;$("navBookings").textContent=c.todoBookings.length;$("navReports").textContent=c.openReports.length;
 ["navAccounts","navBookings","navReports"].forEach(id=>$(id).hidden=$(id).textContent==="0");
 $("kpiAccounts").textContent=c.pendingAcc.length;
 $("kpiAccountsOld").textContent=`${c.pendingAcc.filter(a=>hoursSince(a.registeredAt)>48).length} older than 48h`;
 $("kpiAccountsBar").style.width=`${accounts.length?c.pendingAcc.length/accounts.length*100:0}%`;
 $("kpiBookings").textContent=c.todoBookings.length;
 $("kpiBookingsDone").textContent=`${c.bookings.filter(b=>b.status==="Completed").length} completed`;
 $("kpiBookingsBar").style.width=`${c.bookings.length?c.todoBookings.length/c.bookings.length*100:0}%`;
 $("kpiReports").textContent=c.openReports.length;
 $("kpiReportsHigh").textContent=`${c.openReports.filter(r=>r.priority==="high").length} high priority`;
 $("kpiReportsBar").style.width=`${reports.length?c.openReports.length/reports.length*100:0}%`;
 $("kpiActive").textContent=c.activeAcc.length;
 const share=accounts.length?Math.round(c.activeAcc.length/accounts.length*100):0;
 $("kpiActiveBar").style.width=`${share}%`;$("kpiActiveHint").textContent=`${share}% of all registered organizations`;

 // Action queue — oldest first
 const items=[
  ...c.pendingAcc.map(a=>({kind:"account",id:a.id,title:a.name,sub:`${a.type} · ${a.city} · ${a.docs.length}/3 documents`,at:a.registeredAt})),
  ...c.todoBookings.map(b=>({kind:"booking",id:b.id,title:`${b.organization} → ${b.hallName}`,sub:b.status==="Paid"?"Paid — ready to mark completed":`${b.eventType} · ${fmtDate(b.eventDate)} · ${b.attendees} people`,at:b.createdAt})),
  ...c.openReports.filter(r=>r.status==="New").map(r=>({kind:"report",id:r.id,title:r.title,sub:`${r.category} · from ${r.from}`,at:r.createdAt}))
 ].sort((a,b)=>new Date(a.at)-new Date(b.at)).slice(0,6);
 $("queueCount").textContent=`${total} item${total===1?"":"s"}`;
 $("actionQueue").innerHTML=items.length?items.map(i=>`<div class="queue-item" data-open="${i.kind}" data-id="${esc(i.id)}" role="button" tabindex="0"><span class="q-icon ${i.kind}">${ICON[i.kind]}</span><div><b>${esc(i.title)}</b><small>${esc(i.sub)}</small></div><span class="q-age ${hoursSince(i.at)>48?"late":""}">${timeAgo(i.at)}</span></div>`).join("")
  :`<div class="queue-empty"><span>${ICON.check}</span><b>Nothing waiting</b><small>New registrations, bookings and reports will appear here.</small></div>`;

 $("activityLog").innerHTML=activity.slice(0,8).map(a=>`<li><span class="t-dot" style="--c:${a.color}">${ICON[a.icon]||ICON.check}</span><div><b>${esc(a.text)}</b><small>${timeAgo(a.at)}</small></div></li>`).join("")||'<li><div></div><small>No activity yet.</small></li>';
 updateBookingChart(c.bookings);
}

/* ---------------- Accounts ---------------- */
let accountFilter="Pending";
function renderAccounts(){
 const q=$("accountSearch").value.trim().toLowerCase();
 document.querySelectorAll("#accountTabs [data-count]").forEach(b=>{const f=b.dataset.count;b.textContent=f==="all"?accounts.length:accounts.filter(a=>a.status===f).length});
 const rows=accounts.filter(a=>(accountFilter==="all"||a.status===accountFilter)&&(!q||[a.name,a.city,a.type,a.license,a.email,a.id].some(v=>String(v).toLowerCase().includes(q))))
  .sort((a,b)=>a.status==="Pending"&&b.status==="Pending"?new Date(a.registeredAt)-new Date(b.registeredAt):new Date(b.registeredAt)-new Date(a.registeredAt));
 $("accountsBody").innerHTML=rows.map(a=>{const done=a.docs.filter(d=>d.checked).length;return`<tr>
  <td><div class="org-cell">${avatar(a.name)}<div><b>${esc(a.name)}</b><small>${esc(a.id)} · ${esc(a.email)}</small></div></div></td>
  <td>${esc(a.type)}</td><td>${esc(a.city)}</td>
  <td>${fmtDate(a.registeredAt)}<small class="cell-subtext">${timeAgo(a.registeredAt)}</small></td>
  <td><span class="doc-meter"><i>${[0,1,2].map(i=>`<span class="${a.docs[i]?.checked?"on":""}"></span>`).join("")}</i>${a.docs.length}/3 uploaded</span></td>
  <td>${accountPill(a.status)}</td>
  <td><button class="record-action ${a.status==="Pending"?"verify":"print"}" data-open="account" data-id="${esc(a.id)}">${a.status==="Pending"?"Review":"View"}</button></td></tr>`}).join("")
  ||`<tr><td colspan="7" class="empty-records">No ${accountFilter==="all"?"":accountFilter.toLowerCase()+" "}accounts${q?" match your search":""}.</td></tr>`;
}
function accountDrawer(a){
 const done=a.docs.filter(d=>d.checked).length,missing=3-a.docs.length;
 const body=`<header class="drawer-head"><svg class="hero-ecg ecg" data-cycles="4" viewBox="0 0 600 60" preserveAspectRatio="none"><path class="ecg-base"/><path class="ecg-trace"/></svg>
   <div class="org-cell">${avatar(a.name,true)}<div><h2 id="drawerTitle">${esc(a.name)}</h2><p>${esc(a.type)} · ${esc(a.city)} · registered ${timeAgo(a.registeredAt)}</p></div></div>${accountPill(a.status)}</header>
  <section class="drawer-section"><h3>Organization details</h3><div class="info-grid">
   <div><span>License no.</span><b>${esc(a.license)}</b></div><div><span>Account ID</span><b>${esc(a.id)}</b></div>
   <div><span>Contact person</span><b>${esc(a.contact)}</b></div><div><span>Phone</span><b>${esc(a.phone)}</b></div>
   <div class="wide"><span>Email</span><b>${esc(a.email)}</b></div><div class="wide"><span>Address</span><b>${esc(a.address)}</b></div></div></section>
  <section class="drawer-section"><h3>Submitted documents <small>${done}/3 checked${missing?` · ${missing} missing`:""}</small></h3><div class="doc-list">
   ${a.docs.map((d,i)=>`<div class="doc-row ${d.checked?"checked":""}"><span class="doc-ic">${ICON.doc}</span><div><b>${esc(d.name)}</b><small>${esc(d.file)} · ${esc(d.size)}</small></div><button class="record-action print" data-preview="${i}">Preview</button>${a.status==="Pending"?`<button class="doc-check" data-check="${i}" aria-pressed="${d.checked}" aria-label="Mark ${esc(d.name)} as verified"></button>`:""}</div>`).join("")}
   ${missing?`<div class="doc-row"><span class="doc-ic">${ICON.x}</span><div><b>Authorized representative ID</b><small>Not uploaded</small></div></div>`:""}
  </div>${a.status==="Pending"?`<div class="check-progress"><span style="--p:${done/3*100}%"></span></div><p class="hint">Open each document and tick it once verified. Activation unlocks when all 3 are checked.</p>`:""}</section>
  ${a.status==="Pending"?`<section class="drawer-section"><h3>Rejection reason <small>required to reject</small></h3><textarea class="note-field" id="decisionNote" placeholder="e.g. License number could not be verified…"></textarea></section>`
   :a.status==="Active"?`<section class="drawer-section"><div class="final-banner ok"><span>${ICON.check}</span><div><b>Account active</b><br>Activated ${timeAgo(a.decidedAt||a.registeredAt)}. The organization can sign in and use the portal.</div></div></section>`
   :`<section class="drawer-section"><div class="final-banner no"><span>${ICON.x}</span><div><b>Account rejected</b><br>${esc(a.reason||"No reason recorded.")}</div></div></section>`}
  <div style="height:20px"></div>`;
 const foot=a.status==="Pending"?`<button class="ghost-button danger" data-act="reject-account">Reject</button><button class="primary-button success" data-act="activate" ${done===3?"":"disabled"}>Activate account <span>→</span></button>`
  :a.status==="Active"?`<button class="ghost-button danger" data-act="revoke">Revoke activation</button>`
  :`<button class="ghost-button" data-act="reopen-account">Move back to pending</button>`;
 return{body,foot};
}

/* ---------------- Bookings ---------------- */
const STAGES=[["Pending approval","#f0a531",ICON.inbox,"Needs review"],["Approved","#13895f",ICON.check,"Awaiting payment"],["Paid","#3a72c9",ICON.pay,"Ready to complete"],["Completed","#6a4bc4",ICON.star,"Done"],["Rejected","#d41d3d",ICON.x,"Declined"]];
let bookingFilter="";
function renderBookings(){
 const rows=allBookings(),total=rows.length||1;
 $("pipeline").innerHTML=STAGES.map(([s,c,ic,label],i)=>{const n=rows.filter(r=>r.status===s).length;return`<button class="stage ${bookingFilter===s?"active":""}" data-stage="${s}" style="--c:${c};--p:${(n/total).toFixed(3)}"><div class="stage-top"><span class="stage-ic">${ic}</span><span class="stage-step">0${i+1}</span></div><b>${n}</b><small>${s} · ${label}</small></button>`}).join("");
 const q=$("bookingSearch").value.trim().toLowerCase();
 const list=rows.filter(r=>(!bookingFilter||r.status===bookingFilter)&&(!q||[r.id,r.organization,r.hallName,r.contactName,r.governorate].some(v=>String(v||"").toLowerCase().includes(q))))
  .sort((a,b)=>(bookingNeedsAction(b)-bookingNeedsAction(a))||new Date(b.createdAt)-new Date(a.createdAt));
 $("bookingTableTitle").textContent=bookingFilter?`${bookingFilter} requests`:"All requests";
 $("clearBookingFilter").hidden=!bookingFilter;
 $("bookingsBody").innerHTML=list.map(r=>`<tr>
  <td><span class="request-id">${esc(r.id)}</span><small class="cell-subtext">${timeAgo(r.createdAt)}${r._src==="real"?" · live":""}</small></td>
  <td><div class="org-cell">${avatar(r.organization||"?")}<div><b>${esc(r.organization)}</b><small>${esc(r.contactName)}</small></div></div></td>
  <td>${esc(r.hallName)}<small class="cell-subtext">${esc(r.governorate)}</small></td>
  <td>${fmtDate(r.eventDate)}<small class="cell-subtext">${esc(r.eventTime||"")}</small></td>
  <td>${Number(r.attendees)||0}</td><td><b>${Number(r.price)||0}</b> JOD</td>
  <td>${bookingPill(r.status)}</td>
  <td><button class="record-action ${bookingNeedsAction(r)?"verify":"print"}" data-open="booking" data-id="${esc(r.id)}">${bookingNeedsAction(r)?"Process":"View"}</button></td></tr>`).join("")
  ||'<tr><td colspan="8" class="empty-records">No booking requests here.</td></tr>';
}
function bookingDrawer(r){
 const flow=["Pending approval","Approved","Paid","Completed"];
 const idx=r.status==="Rejected"?-1:flow.indexOf(r.status);
 const steps=r.status==="Rejected"
  ?`<ol class="status-steps"><li class="done">Submitted</li><li class="stop">Rejected</li></ol>`
  :`<ol class="status-steps">${flow.map((s,i)=>{const skipped=s==="Paid"&&r.status==="Completed"&&!r.paymentMethod&&!r.paidAt;return`<li class="${i<=idx&&!skipped?"done":""} ${i===idx+1?"current":""}">${s==="Pending approval"?"Submitted":skipped?"Paid (skipped)":s}</li>`}).join("")}</ol>`;
 const docs=(r.documents||[]);
 const body=`<header class="drawer-head"><svg class="hero-ecg ecg" data-cycles="4" viewBox="0 0 600 60" preserveAspectRatio="none"><path class="ecg-base"/><path class="ecg-trace"/></svg>
   <div class="org-cell">${avatar(r.organization||"?",true)}<div><h2 id="drawerTitle">${esc(r.hallName)}</h2><p>${esc(r.id)} · ${esc(r.organization)}</p></div></div>${bookingPill(r.status)}</header>
  <section class="drawer-section"><h3>Progress <small>what the requester sees</small></h3>${steps}</section>
  <section class="drawer-section"><h3>Event details</h3><div class="info-grid">
   <div><span>Event type</span><b>${esc(r.eventType)}</b></div><div><span>Date & time</span><b>${fmtDate(r.eventDate)} · ${esc(r.eventTime)}</b></div>
   <div><span>Attendees</span><b>${Number(r.attendees)||0} people</b></div><div><span>Booking fee</span><b>${Number(r.price)||0} JOD${r.paymentMethod?` · paid by ${esc(r.paymentMethod)}`:""}</b></div>
   <div><span>Contact</span><b>${esc(r.contactName)}</b></div><div><span>Phone</span><b>${esc(r.phone)}</b></div>
   <div class="wide"><span>Email</span><b>${esc(r.email)}</b></div><div class="wide"><span>Description</span><b>${esc(r.description)}</b></div></div></section>
  <section class="drawer-section"><h3>Documents <small>${docs.length}/3 attached</small></h3><div class="doc-list">${docs.map((d,i)=>`<div class="doc-row"><span class="doc-ic">${ICON.doc}</span><div><b>${esc(d.label)}</b><small>${esc(d.fileName)}</small></div><button class="record-action print" data-preview="${i}">Preview</button></div>`).join("")||'<p class="hint">No documents attached.</p>'}</div></section>
  ${r.status==="Completed"?`<section class="drawer-section"><div class="final-banner done"><span>${ICON.star}</span><div><b>Booking completed</b><br>${esc(r.adminNote||"The requester can see this booking as completed.")}</div></div></section>`
   :r.status==="Rejected"?`<section class="drawer-section"><div class="final-banner no"><span>${ICON.x}</span><div><b>Request rejected</b><br>${esc(r.adminNote||"No reason recorded.")}</div></div></section>`
   :`<section class="drawer-section"><h3>Message to requester <small>${r.status==="Pending approval"?"required to reject":"optional"}</small></h3><textarea class="note-field" id="decisionNote" placeholder="Shown in the user's “My Requests”…"></textarea>${r.adminNote?`<p class="hint"><b>Last message sent:</b> ${esc(r.adminNote)}</p>`:""}
     <p class="hint">${r.status==="Approved"?"Approved — the requester can now pay. You can also mark it completed if it was settled offline.":r.status==="Paid"?"Payment received. Mark as completed once the booking is processed.":"Approving unlocks payment for the requester."}</p></section>`}
  <div style="height:20px"></div>`;
 const foot=r.status==="Pending approval"?`<button class="ghost-button danger" data-act="reject-booking">Reject</button><button class="primary-button success" data-act="approve">Approve request <span>→</span></button>`
  :r.status==="Approved"?`<button class="ghost-button danger" data-act="reject-booking">Reject</button><button class="primary-button violet" data-act="complete">Mark as completed <span>→</span></button>`
  :r.status==="Paid"?`<button class="primary-button violet" data-act="complete">Mark as completed <span>→</span></button>`:"";
 return{body,foot};
}

/* ---------------- Reports ---------------- */
let reportFilter="open",activeReport=null;
const CAT_ICON={"Technical issue":ICON.bug,"Donor complaint":ICON.user,"Inappropriate content":ICON.flag,"Booking issue":ICON.booking,"Hospital issue":ICON.account,"Data correction":ICON.drop};
function renderReports(){
 const q=$("reportSearch").value.trim().toLowerCase();
 document.querySelectorAll("#reportTabs [data-count]").forEach(b=>{const f=b.dataset.count;b.textContent=f==="open"?reports.filter(r=>r.status!=="Resolved").length:reports.filter(r=>r.status===f).length});
 const list=reports.filter(r=>(reportFilter==="open"?r.status!=="Resolved":r.status===reportFilter)&&(!q||[r.title,r.from,r.category,r.id,r.related,r.body].some(v=>String(v).toLowerCase().includes(q))))
  .sort((a,b)=>({high:0,medium:1,low:2}[a.priority]-{high:0,medium:1,low:2}[b.priority])||new Date(b.createdAt)-new Date(a.createdAt));
 $("reportList").innerHTML=list.map(r=>`<button class="report-item ${r.id===activeReport?"active":""}" data-report="${esc(r.id)}"><span class="r-ic ${r.priority}">${CAT_ICON[r.category]||ICON.flag}</span><div><div class="r-top"><b>${esc(r.title)}</b><time>${timeAgo(r.createdAt)}</time></div><p>${esc(r.from)} · ${esc(r.body)}</p><div class="r-tags">${reportPill(r.status)}${prioTag(r.priority)}</div></div>${r.read?"":'<span class="unread-dot"></span>'}</button>`).join("")
  ||'<div class="list-empty">No reports in this view.</div>';
 const r=reports.find(x=>x.id===activeReport);
 $("reportDetail").innerHTML=r?`<div class="rd-head"><span class="r-ic ${r.priority}">${CAT_ICON[r.category]||ICON.flag}</span><div><h2>${esc(r.title)}</h2><p>${esc(r.id)} · ${fmtDate(r.createdAt)} · ${timeAgo(r.createdAt)}</p><div class="rd-tags">${reportPill(r.status)}${prioTag(r.priority)}<span class="prio low">${esc(r.category)}</span></div></div></div>
  <div class="rd-body">${esc(r.body)}</div>
  <div class="rd-meta"><div><span>FROM</span><b>${esc(r.from)}</b></div><div><span>ROLE</span><b>${esc(r.role)}</b></div><div><span>RELATED TO</span><b>${esc(r.related)}</b></div></div>
  ${r.attachments?.length?`<div class="rd-attach">${r.attachments.map(a=>`<span>📎 ${esc(a)}</span>`).join("")}</div>`:""}
  ${r.status==="Resolved"?`<div class="rd-response"><b>Resolution sent</b>${esc(r.response||"Marked resolved.")}</div><div class="rd-actions"><button class="ghost-button" data-ract="reopen">Reopen</button></div>`
   :`
    </div>`}`
  :`<div class="empty-detail"><span>${ICON.inbox}</span><b>Select a report</b><small>Pick a report from the list to read and act on it.</small></div>`;
}
function openReport(id){
 const r=reports.find(x=>x.id===id);if(!r)return;
 activeReport=id;if(!r.read){r.read=true;save(KEYS.reports,reports)}
 renderReports();const d=$("reportDetail");d.classList.remove("swap");void d.offsetWidth;d.classList.add("swap");
 if(window.innerWidth<980)d.scrollIntoView({behavior:reduceMotion?"auto":"smooth",block:"start"});
}
$("reportList").addEventListener("click",e=>{const b=e.target.closest("[data-report]");if(b)openReport(b.dataset.report)});
$("reportDetail").addEventListener("click",e=>{
 const b=e.target.closest("[data-ract]");if(!b)return;const r=reports.find(x=>x.id===activeReport);if(!r)return;
 const act=b.dataset.ract,note=$("reportResponse")?.value.trim();
 if(act==="review"){r.status="In review";logAction(`Started reviewing ${r.id}`,"clock","#bd7c12");toast(`${r.id} moved to In review.`)}
 if(act==="resolve"){if(!note){shakeField($("reportResponse"),"Add a short resolution note before resolving.");return}r.status="Resolved";r.response=note;logAction(`Resolved report ${r.id}`,"check","#13895f");bloodBurst("#13895f");toast(`${r.id} resolved.`)}
 if(act==="reopen"){r.status="In review";logAction(`Reopened report ${r.id}`,"clock","#bd7c12");toast(`${r.id} reopened.`)}
 save(KEYS.reports,reports);renderAll();
});

/* ---------------- Drawer ---------------- */
let drawerState=null;
function openDrawer(kind,id){
 const item=kind==="account"?accounts.find(a=>a.id===id):allBookings().find(b=>b.id===id);
 if(!item)return;drawerState={kind,id};
 const {body,foot}=kind==="account"?accountDrawer(item):bookingDrawer(item);
 $("drawerBody").innerHTML=body;$("drawerFoot").innerHTML=foot;$("drawerBody").scrollTop=0;
 drawEcg($("drawerBody"));
 $("drawer").classList.add("open");$("drawerBackdrop").classList.add("open");$("drawer").setAttribute("aria-hidden","false");document.body.style.overflow="hidden";
 setTimeout(()=>$("drawerClose").focus({preventScroll:true}),50);
}
function refreshDrawer(){if(drawerState){const s=$("drawerBody").scrollTop;openDrawer(drawerState.kind,drawerState.id);$("drawerBody").scrollTop=s}}
function closeDrawer(){drawerState=null;$("drawer").classList.remove("open");$("drawerBackdrop").classList.remove("open");$("drawer").setAttribute("aria-hidden","true");document.body.style.overflow=""}
$("drawerClose").addEventListener("click",closeDrawer);$("drawerBackdrop").addEventListener("click",closeDrawer);
document.addEventListener("keydown",e=>{if(e.key==="Escape"){if($("docModal").classList.contains("open"))closeDoc();else if(drawerState)closeDrawer()}});
function shakeField(f,msg){if(!f)return;f.classList.remove("shake");void f.offsetWidth;f.classList.add("shake");f.focus();toast(msg)}

$("drawer").addEventListener("click",e=>{
 if(!drawerState)return;
 const {kind,id}=drawerState;
 const chk=e.target.closest("[data-check]"),prev=e.target.closest("[data-preview]"),act=e.target.closest("[data-act]");
 if(prev){const item=kind==="account"?accounts.find(a=>a.id===id):allBookings().find(b=>b.id===id);const d=kind==="account"?item.docs[prev.dataset.preview]:item.documents[prev.dataset.preview];openDoc(kind==="account"?d.name:d.label,kind==="account"?d.file:d.fileName,item.name||item.organization);return}
 if(chk){
  const a=accounts.find(x=>x.id===id),d=a.docs[chk.dataset.check];d.checked=!d.checked;save(KEYS.accounts,accounts);
  // Update in place so the drawer doesn't replay its entrance animation.
  chk.setAttribute("aria-pressed",String(d.checked));chk.closest(".doc-row").classList.toggle("checked",d.checked);
  const done=a.docs.filter(x=>x.checked).length,missing=3-a.docs.length;
  const bar=$("drawerBody").querySelector(".check-progress span");if(bar)bar.style.setProperty("--p",`${done/3*100}%`);
  const label=chk.closest(".drawer-section").querySelector("h3 small");if(label)label.textContent=`${done}/3 checked${missing?` · ${missing} missing`:""}`;
  const btn=$("drawerFoot").querySelector('[data-act="activate"]');if(btn)btn.disabled=done<3;
  renderAccounts();return}
 if(!act)return;
 const note=$("decisionNote")?.value.trim()||"";
 const a=act.dataset.act;
 if(kind==="account"){
  const acc=accounts.find(x=>x.id===id);
  if(a==="activate"){if(acc.docs.length<3||acc.docs.some(d=>!d.checked)){toast("Check all three documents first.");return}acc.status="Active";acc.decidedAt=new Date().toISOString();logAction(`Activated ${acc.name}`,"check","#13895f");bloodBurst("#13895f");toast(`${acc.name} is now active and can sign in.`)}
  if(a==="reject-account"){if(!note){shakeField($("decisionNote"),"Write the rejection reason so the organization knows what to fix.");return}acc.status="Rejected";acc.reason=note;acc.decidedAt=new Date().toISOString();logAction(`Rejected ${acc.name}`,"x","#d41d3d");toast(`${acc.name} was rejected.`)}
  if(a==="revoke"){if(!confirm(`Revoke activation for ${acc.name}? They will lose access until re-verified.`))return;acc.status="Pending";acc.docs.forEach(d=>d.checked=false);logAction(`Revoked activation of ${acc.name}`,"x","#d41d3d");toast(`${acc.name} moved back to pending.`)}
  if(a==="reopen-account"){acc.status="Pending";delete acc.reason;logAction(`Reopened ${acc.name} for review`,"clock","#bd7c12");toast(`${acc.name} moved back to pending.`)}
  save(KEYS.accounts,accounts);
 }else{
  if(a==="approve"){updateBooking(id,{status:"Approved",adminNote:note||"Your request has been approved. You can now pay to confirm."});logAction(`Approved booking ${id}`,"check","#13895f");bloodBurst("#13895f");toast(`${id} approved — payment is now unlocked for the requester.`)}
  if(a==="reject-booking"){if(!note){shakeField($("decisionNote"),"Add a short reason for the requester.");return}updateBooking(id,{status:"Rejected",adminNote:note});logAction(`Rejected booking ${id}`,"x","#d41d3d");toast(`${id} rejected.`)}
  if(a==="complete"){updateBooking(id,{status:"Completed",adminNote:note||"Your booking has been processed and completed.",completedAt:new Date().toISOString()});logAction(`Marked ${id} as completed`,"star","#6a4bc4");bloodBurst("#6a4bc4");toast(`${id} marked completed — the user will see it in My Requests.`)}
 }
 renderAll();refreshDrawer();
});

/* ---------------- Document preview ---------------- */
function openDoc(title,file,owner){
 $("docSheet").innerHTML=`<div class="doc-brand"><span>♥ BloodLink</span><small style="color:var(--muted);font:600 11px 'DM Sans'">${esc(file)}</small></div><h4>${esc(title)}</h4><p>Issued to <b>${esc(owner)}</b></p><div class="doc-lines">${"<i></i>".repeat(11)}</div><div class="doc-stamp">ON FILE</div><p class="hint" style="margin-top:22px">Demo preview — connect file storage to show the real uploaded document.</p><button class="ghost-button" id="closeDoc">Close preview</button>`;
 $("docModal").classList.add("open");$("docModal").setAttribute("aria-hidden","false");
}
function closeDoc(){$("docModal").classList.remove("open");$("docModal").setAttribute("aria-hidden","true")}
$("docModal").addEventListener("click",e=>{if(e.target===$("docModal")||e.target.id==="closeDoc")closeDoc()});

/* ---------------- Charts ---------------- */
let activityChart=null,bookingChart=null;
const PIPE_COLORS={"Pending approval":"#f0a531","Approved":"#13895f","Paid":"#3a72c9","Completed":"#6a4bc4","Rejected":"#d41d3d"};
function initCharts(){
 if(typeof Chart==="undefined"){document.querySelectorAll(".chart-wrap,.donut-wrap canvas").forEach(c=>c.insertAdjacentHTML("afterend",'<p class="hint">Charts could not load. Check your internet connection.</p>'));return}
 Chart.defaults.font.family='"DM Sans", sans-serif';Chart.defaults.font.size=12;Chart.defaults.color="#8b8c9e";
 Object.assign(Chart.defaults.plugins.tooltip,{backgroundColor:"rgba(27,28,40,.94)",padding:12,cornerRadius:10,boxPadding:5,usePointStyle:true});
 const months=[...Array(6)].map((_,i)=>{const d=new Date();d.setMonth(d.getMonth()-5+i);return d.toLocaleDateString("en-GB",{month:"short"})});
 const rise={y:{duration:1100,easing:"easeOutQuart",from:ctx=>ctx.type==="data"&&ctx.chart.scales.y?ctx.chart.scales.y.getPixelForValue(0):undefined,delay:ctx=>ctx.type==="data"&&ctx.mode==="default"?ctx.dataIndex*80+ctx.datasetIndex*140:0}};
 const fill=(ctx,rgb)=>{const {chart}=ctx,{ctx:c,chartArea}=chart;if(!chartArea)return`rgba(${rgb},.1)`;const g=c.createLinearGradient(0,chartArea.top,0,chartArea.bottom);g.addColorStop(0,`rgba(${rgb},.22)`);g.addColorStop(1,`rgba(${rgb},0)`);return g};
 const ds=(label,data,color,rgb,f)=>({label,data,borderColor:color,backgroundColor:f?ctx=>fill(ctx,rgb):"transparent",fill:f,tension:.42,pointRadius:4,pointHoverRadius:7,pointBackgroundColor:"#fff",pointBorderWidth:2.5,borderWidth:3});
 activityChart=new Chart($("activityChart"),{type:"line",data:{labels:months,datasets:[ds("Sign-ups",[6,9,7,12,10,accounts.filter(a=>hoursSince(a.registeredAt)<720).length+8],"#d41d3d","212,29,61",true),ds("Booking requests",[11,14,12,18,16,allBookings().length+12],"#f0a531","240,165,49",false),ds("Reports",[4,6,5,8,7,reports.length+3],"#3a72c9","58,114,201",false)]},
  options:{responsive:true,maintainAspectRatio:false,animations:rise,interaction:{mode:"index",intersect:false},plugins:{legend:{display:false}},scales:{x:{grid:{display:false},border:{display:false}},y:{beginAtZero:true,grid:{color:"#f1eef2"},border:{display:false},ticks:{maxTicksLimit:5}}}}});
 bookingChart=new Chart($("bookingChart"),{type:"doughnut",data:{labels:Object.keys(PIPE_COLORS),datasets:[{data:[0,0,0,0,0],backgroundColor:Object.values(PIPE_COLORS),borderColor:"#fff",borderWidth:3,borderRadius:6,spacing:2,hoverOffset:10}]},
  options:{responsive:true,maintainAspectRatio:false,cutout:"74%",animation:{animateRotate:true,animateScale:true,duration:1400,easing:"easeOutQuart"},plugins:{legend:{display:false}}}});
 updateBookingChart(allBookings());
}
function updateBookingChart(rows){
 const data=Object.keys(PIPE_COLORS).map(s=>rows.filter(r=>r.status===s).length);
 $("donutTotal").textContent=rows.length;
 $("bookingLegend").innerHTML=Object.entries(PIPE_COLORS).map(([s,c],i)=>`<div class="blood-legend-item"><i style="background:${c}"></i><span>${s}</span><b>${data[i]}</b></div>`).join("");
 if(bookingChart){bookingChart.data.datasets[0].data=data;bookingChart.update()}
}

/* ---------------- Navigation ---------------- */
const LABELS={overview:"Overview",accounts:"Account verification",bookings:"Hall bookings",reports:"Reports"};
function navigate(section){
 if(!LABELS[section])section="overview";
 document.querySelectorAll(".page-section").forEach(el=>{const on=el.id===section;el.classList.toggle("hidden-section",!on);el.classList.toggle("visible",on)});
 document.querySelectorAll(".nav-item[data-section]").forEach(a=>a.classList.toggle("active",a.dataset.section===section));
 const crumb=$("crumbTitle");crumb.textContent=LABELS[section];crumb.classList.remove("swap");void crumb.offsetWidth;crumb.classList.add("swap");
 if(section==="reports"&&!activeReport&&window.innerWidth>=980){const first=reports.filter(r=>r.status!=="Resolved").sort((a,b)=>({high:0,medium:1,low:2}[a.priority]-{high:0,medium:1,low:2}[b.priority]))[0];if(first)openReport(first.id)}
 if(section==="overview"){activityChart?.resize();bookingChart?.resize()}
 $("sidebar").classList.remove("open");$("menuButton").setAttribute("aria-expanded","false");
 history.replaceState(null,"",`#${section}`);
 window.scrollTo({top:0,behavior:reduceMotion?"auto":"smooth"});
 countUp($(section));
}
document.querySelectorAll(".nav-item[data-section]").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();navigate(a.dataset.section)}));
document.addEventListener("click",e=>{
 const go=e.target.closest("[data-go]");if(go){e.preventDefault();navigate(go.dataset.go);return}
 const open=e.target.closest("[data-open]");
 if(open){const k=open.dataset.open;if(k==="report"){navigate("reports");openReport(open.dataset.id)}else openDrawer(k,open.dataset.id)}
});
document.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.matches?.(".queue-item"))e.target.click()});
$("accountTabs").addEventListener("click",e=>{const t=e.target.closest("[data-filter]");if(!t)return;accountFilter=t.dataset.filter;$("accountTabs").querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b===t));renderAccounts()});
$("reportTabs").addEventListener("click",e=>{const t=e.target.closest("[data-filter]");if(!t)return;reportFilter=t.dataset.filter;$("reportTabs").querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b===t));renderReports()});
$("pipeline").addEventListener("click",e=>{const s=e.target.closest("[data-stage]");if(!s)return;bookingFilter=bookingFilter===s.dataset.stage?"":s.dataset.stage;renderBookings()});
$("clearBookingFilter").addEventListener("click",()=>{bookingFilter="";renderBookings()});
$("accountSearch").addEventListener("input",renderAccounts);$("bookingSearch").addEventListener("input",renderBookings);$("reportSearch").addEventListener("input",renderReports);
$("menuButton").addEventListener("click",()=>{const o=$("sidebar").classList.toggle("open");$("menuButton").setAttribute("aria-expanded",String(o))});
document.addEventListener("click",e=>{if(window.innerWidth<=760&&$("sidebar").classList.contains("open")&&!$("sidebar").contains(e.target)&&!$("menuButton").contains(e.target)){$("sidebar").classList.remove("open");$("menuButton").setAttribute("aria-expanded","false")}});
$("notificationButton").addEventListener("click",()=>{const c=counts();toast(`${c.pendingAcc.length} account${c.pendingAcc.length===1?"":"s"} to verify, ${c.todoBookings.length} booking${c.todoBookings.length===1?"":"s"} to process, ${c.openReports.filter(r=>!r.read).length} unread report${c.openReports.filter(r=>!r.read).length===1?"":"s"}.`)});
const HOME_URL="home.html"; // غيّر هذا السطر إذا كان اسم صفحة الـ home مختلفاً (مثلاً index.html)
$("logoutButton").addEventListener("click",()=>{window.location.href=HOME_URL});

// New booking submitted from hall.html in another tab → refresh live.
window.addEventListener("storage",e=>{if(e.key===KEYS.hallRequests){renderAll();if(drawerState?.kind==="booking")refreshDrawer();toast("Booking requests updated.")}});

function renderAll(){renderOverview();renderAccounts();renderBookings();renderReports()}

/* ---------------- Motion layer (shared with hospital dashboard) ---------------- */
let toastTimer;
function toast(m){const el=$("toast");el.textContent=m;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),3200)}
function ecgPath(w,h,cycles){const mid=h*.55,step=w/cycles;let d=`M0 ${mid}`;for(let i=0;i<cycles;i++){const x=i*step,u=step/20;d+=` L${x+u*5} ${mid} Q${x+u*6} ${mid-h*.12} ${x+u*7} ${mid} L${x+u*8} ${mid} L${x+u*8.6} ${mid+h*.12} L${x+u*9.4} ${h*.06} L${x+u*10.3} ${h*.94} L${x+u*11} ${mid} L${x+u*12.5} ${mid} Q${x+u*14} ${mid-h*.2} ${x+u*15.5} ${mid} L${x+step} ${mid}`}return d}
function drawEcg(root=document){root.querySelectorAll("svg.ecg").forEach(svg=>{const [, , w, h]=svg.getAttribute("viewBox").split(" ").map(Number);const d=ecgPath(w,h,Number(svg.dataset.cycles)||3);svg.querySelectorAll("path").forEach(p=>{p.setAttribute("d",d);p.setAttribute("pathLength","1000")})})}
function tickClock(){$("liveClock").textContent=new Date().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}
function countUp(root){
 if(reduceMotion||!root)return;
 root.querySelectorAll(".metric-value, .donut-center strong, .stage b").forEach(el=>{
  const node=[...el.childNodes].find(n=>n.nodeType===3&&/\d/.test(n.textContent));if(!node)return;
  const raw=node.textContent,m=raw.match(/\d[\d,]*(\.\d+)?/);if(!m)return;
  const target=parseFloat(m[0].replace(/,/g,"")),start=performance.now();
  (function tick(now){if(!node.isConnected)return;const p=Math.min(1,(now-start)/1100),e=1-Math.pow(1-p,4);node.textContent=p<1?raw.replace(m[0],Math.round(target*e)):raw;if(p<1)requestAnimationFrame(tick)})(start);
 });
}
document.addEventListener("pointerdown",e=>{
 window.__lastPointer={x:e.clientX,y:e.clientY};
 const b=e.target.closest(".primary-button,.ghost-button,.record-action,.icon-button,.tab,.stage");if(!b||reduceMotion||b.disabled)return;
 const r=b.getBoundingClientRect(),size=Math.max(r.width,r.height)*2.2,s=document.createElement("span");
 s.className="ripple";s.style.cssText=`width:${size}px;height:${size}px;left:${e.clientX-r.left-size/2}px;top:${e.clientY-r.top-size/2}px`;
 if(getComputedStyle(b).position==="static")b.style.position="relative";b.style.overflow="hidden";
 b.appendChild(s);s.addEventListener("animationend",()=>s.remove());
},true);
document.addEventListener("pointermove",e=>{const c=e.target.closest&&e.target.closest(".metric-card,.panel:not(.table-panel)");if(!c)return;const r=c.getBoundingClientRect();c.style.setProperty("--mx",`${e.clientX-r.left}px`);c.style.setProperty("--my",`${e.clientY-r.top}px`)},{passive:true});
function bloodBurst(color){
 if(reduceMotion)return;
 const {x,y}=window.__lastPointer||{x:innerWidth/2,y:innerHeight/2};
 const palette=color?[color,color,"#ffffff"]:["#d41d3d","#ef4562","#9e0d28"];
 const ring=document.createElement("span");ring.className="burst-ring";ring.style.cssText=`left:${x}px;top:${y}px;border-color:${palette[0]};z-index:95`;document.body.appendChild(ring);ring.addEventListener("animationend",()=>ring.remove());
 for(let i=0;i<16;i++){const a=(Math.PI*2*i)/16+Math.random()*.4,dist=50+Math.random()*60,d=document.createElement("span");d.className="burst-drop";
  d.style.cssText=`left:${x}px;top:${y}px;z-index:96;--tx:${Math.cos(a)*dist}px;--ty:${Math.sin(a)*dist+20}px;--r:${a*57+45}deg;--c:${palette[i%2]};width:${6+Math.random()*7}px;height:${6+Math.random()*7}px`;
  document.body.appendChild(d);d.addEventListener("animationend",()=>d.remove())}
}

/* ---------------- Boot ---------------- */
drawEcg();tickClock();setInterval(tickClock,15000);
$("todayDate").textContent=new Date().toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
renderAll();initCharts();
const startSection=location.hash.slice(1);if(LABELS[startSection]&&startSection!=="overview")navigate(startSection);
(function(){
 const loader=$("pageLoader");if(!loader)return;
 const hide=()=>{loader.classList.add("done");setTimeout(()=>loader.remove(),700);countUp(document.querySelector(".page-section:not(.hidden-section)"))};
 if(reduceMotion){loader.remove();return}
 const t0=performance.now(),go=()=>setTimeout(hide,Math.max(0,1100-(performance.now()-t0)));
 if(document.readyState==="complete")go();else window.addEventListener("load",go,{once:true});
 setTimeout(()=>{if(loader.isConnected)hide()},3000);
})();