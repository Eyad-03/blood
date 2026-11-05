const $=id=>document.getElementById(id);
const reduceMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const BLOOD_TYPES=["O+","O-","A+","A-","B+","B-","AB+","AB-"];
const initialInventory={"O+":52,"O-":12,"A+":44,"A-":8,"B+":36,"B-":6,"AB+":61,"AB-":29};
const initialRecords=[
{id:"DV-2026-006",donor:"Lina Khalil",recipient:"Patient #2841",type:"O-",units:2,date:"2026-10-10",status:"Verified",notes:"Hospital transfer confirmed"},
{id:"DV-2026-005",donor:"Omar Haddad",recipient:"Patient #2839",type:"A+",units:3,date:"2026-10-09",status:"Verified",notes:"Recipient receipt confirmed"},
{id:"DV-2026-004",donor:"Hala Mahmoud",recipient:"Patient #2835",type:"B-",units:1,date:"2026-10-09",status:"Pending verification",notes:"Awaiting staff confirmation"},
{id:"DV-2026-003",donor:"Zaid Fawzi",recipient:"Patient #2828",type:"O+",units:2,date:"2026-10-08",status:"Verified",notes:"Hospital transfer confirmed"},
{id:"DV-2026-002",donor:"Sara Nasser",recipient:"Patient #2822",type:"AB-",units:1,date:"2026-10-07",status:"Pending verification",notes:"Awaiting recipient confirmation"},
{id:"DV-2026-001",donor:"Yousef Saleh",recipient:"Patient #2819",type:"A-",units:1,date:"2026-10-06",status:"Verified",notes:"Hospital transfer confirmed"}
];
const donors=[
 {name:"Lina Khalil",email:"lina.khalil@example.com",type:"O+",location:"University Street, Irbid",last:"12 Aug 2026",availability:"Available"},
 {name:"Omar Haddad",email:"omar.haddad@example.com",type:"A-",location:"Downtown, Irbid",last:"28 Jul 2026",availability:"Available"},
 {name:"Hala Mahmoud",email:"hala.mahmoud@example.com",type:"B+",location:"Al-Hashmi, Irbid",last:"02 Sep 2026",availability:"Not active"},
 {name:"Zaid Fawzi",email:"zaid.fawzi@example.com",type:"AB+",location:"Al-Naseem, Irbid",last:"15 Jun 2026",availability:"Available"},
 {name:"Sara Nasser",email:"sara.nasser@example.com",type:"O-",location:"Khalda, Amman",last:"09 Aug 2026",availability:"Available"},
 {name:"Yousef Saleh",email:"yousef.saleh@example.com",type:"B-",location:"Irbid City Center",last:"20 Jul 2026",availability:"Available"}
];
const read=(key,fallback)=>{try{const v=localStorage.getItem(key);return v?JSON.parse(v):fallback}catch{return fallback}};
const save=(key,val)=>localStorage.setItem(key,JSON.stringify(val));
let records=read("bloodlinkDonationRecords",initialRecords);
// Adding a record documents it, so every record counts as verified.
records.forEach(r=>{r.status="Verified"});
let inventory=read("bloodlinkHospitalInventory",initialInventory);
let requestChart=null,inventoryChart=null,reportChart=null,toastTimer=null;
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2800)}
function statusClass(status){return status.toLowerCase()}
function priorityClass(p){return p.toLowerCase()}
function formatDate(value){if(!value)return "—";const d=new Date(value+"T12:00:00");return Number.isNaN(d.getTime())?esc(value):d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}
function recordStatusClass(status){return status==="Verified"?"verified":"pending-verification"}
function recordMatches(r,q){return [r.id,r.donor,r.recipient,r.type,r.status,r.date].some(v=>String(v||"").toLowerCase().includes(q))}
function renderRecordRows(target,rows,withPrint=true){
 target.innerHTML=rows.length?rows.map(r=>`<tr><td><span class="request-id">${esc(r.id)}</span></td><td><b>${esc(r.donor)}</b></td><td>${esc(r.recipient)}</td><td><span class="blood-type">${esc(r.type)}</span></td><td>${Number(r.units)||0}</td><td>${formatDate(r.date)}</td><td><div class="record-actions"><button class="record-action print" data-print="${esc(r.id)}">Print</button></div></td></tr>`).join(""):'<tr><td colspan="7" class="empty-records">No donation records found.</td></tr>';
}
function renderRecords(){
 const verified=records.filter(r=>r.status==="Verified");
 $("recordTotal").textContent=records.length;
 $("recordVerified").textContent=verified.length;
 $("recordUnits").innerHTML=`${records.reduce((sum,r)=>sum+(Number(r.units)||0),0)} <small>units</small>`;
 $("recordPending").textContent=new Set(records.map(r=>r.type)).size;
 const requestCount=$("requestTableCount");if(requestCount)requestCount.textContent=records.length;
 const navRequestCount=$("navRequests");if(navRequestCount)navRequestCount.textContent=records.length;
 $("recordTableCount").textContent=records.length;
 const q=($("recordSearch")?.value||"").toLowerCase();
 const filtered=records.filter(r=>recordMatches(r,q));
 if($("donationRecordsBody"))renderRecordRows($("donationRecordsBody"),filtered);
 const recentBody=$("recentRequestsBody");
 if(recentBody)recentBody.innerHTML=records.slice(0,5).map(r=>`<tr><td><span class="request-id">${esc(r.id)}</span></td><td><b>${esc(r.donor)}</b><small class="cell-subtext">to ${esc(r.recipient)}</small></td><td><span class="blood-type">${esc(r.type)}</span></td><td>${Number(r.units)||0}</td><td>${formatDate(r.date)}</td><td><div class="record-actions">${r.status!=="Verified"?`<button class="record-action verify" data-verify="${esc(r.id)}">Verify</button>`:""}<button class="record-action print" data-print="${esc(r.id)}">Print</button></div></td></tr>`).join("")||'<tr><td colspan="7" class="empty-records">No donation records found.</td></tr>';
 if($("allRequestsBody"))renderRecordRows($("allRequestsBody"),filterRecords(),true);
}
function filterRecords(){return records}
function printRecord(id){
 const r=records.find(x=>x.id===id);if(!r)return;
 const w=window.open("","_blank","width=800,height=700");
 if(!w){toast("Please allow pop-ups to print the donation record.");return}
 w.document.write(`<!doctype html><html><head><title>Donation Verification ${esc(r.id)}</title><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#222;padding:36px;max-width:760px;margin:auto}.brand{font-size:24px;font-weight:bold;color:#c91835}.sub{color:#666;font-size:12px}.rule{height:3px;background:#c91835;margin:18px 0 26px}.title{font-size:22px;margin-bottom:6px}.badge{display:inline-block;border:1px solid #16835b;color:#16835b;padding:6px 9px;border-radius:5px;font-size:12px;font-weight:bold}table{border-collapse:collapse;width:100%;margin-top:22px}td{border:1px solid #ddd;padding:12px;font-size:13px}td:first-child{width:36%;background:#f8f8fa;font-weight:bold}.note{margin-top:20px;padding:13px;background:#f8f8fa;font-size:12px}.signatures{display:flex;gap:50px;margin-top:65px}.signatures div{flex:1;border-top:1px solid #999;padding-top:9px;font-size:11px;color:#555}.foot{margin-top:45px;border-top:1px solid #ddd;padding-top:12px;font-size:10px;color:#777}</style></head><body><div class="brand">♥ BloodLink</div><div class="sub">HOSPITAL DONATION DOCUMENTATION</div><div class="rule"></div><h1 class="title">Donation Verification Record</h1><p>Record ID: <b>${esc(r.id)}</b> &nbsp; <span class="badge">${esc(r.status)}</span></p><p class="sub">Generated on ${new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"})}</p><table><tr><td>Donor full name</td><td>${esc(r.donor)}</td></tr><tr><td>Recipient / patient</td><td>${esc(r.recipient)}</td></tr><tr><td>Blood type</td><td>${esc(r.type)}</td></tr><tr><td>Units documented</td><td>${Number(r.units)||0}</td></tr><tr><td>Donation date</td><td>${formatDate(r.date)}</td></tr><tr><td>Verification status</td><td>${esc(r.status)}</td></tr></table><div class="note"><b>Hospital notes</b><br>${esc(r.notes||"No additional notes provided.")}</div><div class="signatures"><div>Authorized hospital staff</div><div>Recipient / authorized representative</div></div><div class="foot">BloodLink demo record. Official use requires verification by authorized hospital personnel and secure storage in the hospital system.</div><script>window.onload=()=>window.print();<\/script></body></html>`);
 w.document.close();
}
function renderInventory(){
 const entries=BLOOD_TYPES.map(type=>({type,units:Number(inventory[type])||0}));const total=entries.reduce((s,x)=>s+x.units,0);
 $("totalUnits").innerHTML=`${total} <small>units</small>`;$("donutTotal").textContent=total;
 const low=entries.filter(x=>x.units<15).sort((a,b)=>a.units-b.units);
 $("lowStockList").innerHTML=low.length?low.map(x=>`<div class="stock-row ${x.units<8?"critical":"low"}"><div class="stock-type">${x.type}</div><div class="stock-info"><b>${x.type} blood</b><small>Minimum target: 15 units</small></div><div class="stock-right"><b>${x.units} units</b><small>${x.units===0?"Out of stock":x.units<8?"Critical":"Low stock"}</small></div><div class="stock-bar"><span style="width:${Math.min(100,x.units/15*100)}%"></span></div></div>`).join(""):'<p class="empty-state">No low stock alerts. Inventory is above the minimum threshold.</p>';
 const alertCount=low.length;$("inventory").querySelector(".stock-alert-count").textContent=`${alertCount} alert${alertCount===1?"":"s"}`;
 const bannerCount=$("lowStockBannerCount");if(bannerCount)bannerCount.textContent=`${alertCount} blood type${alertCount===1?"":"s"}`;
 const rack=$("bloodVials");
 if(rack)rack.innerHTML=entries.map((x,i)=>{const pct=Math.max(4,Math.min(100,x.units/80*100));const state=x.units<8?"critical":x.units<15?"low":"";
  return `<div class="vial ${state}" style="--fill:${pct.toFixed(1)}%;--d:${i*70}ms" title="${x.type}: ${x.units} units"><div class="vial-tube"><div class="vial-marks"></div><div class="vial-liquid"><svg class="vial-wave back" viewBox="0 0 120 10" preserveAspectRatio="none"><path d="M0 5 Q15 0 30 5 T60 5 T90 5 T120 5 V10 H0Z"/></svg><svg class="vial-wave" viewBox="0 0 120 10" preserveAspectRatio="none"><path d="M0 5 Q15 10 30 5 T60 5 T90 5 T120 5 V10 H0Z"/></svg><span class="bubble"></span><span class="bubble"></span><span class="bubble"></span></div></div><b>${x.type}</b><small>${x.units} units</small></div>`}).join("");
 if(inventoryChart){inventoryChart.data.datasets[0].data=entries.map(x=>x.units);inventoryChart.update()}
 $("bloodLegend").innerHTML=entries.map((x,i)=>`<div class="blood-legend-item"><i style="background:${chartColors[i]}"></i><span>${x.type}</span><b>${x.units}</b></div>`).join("");
}
const chartColors=["#c91835","#e55a70","#e69a4b","#edc26b","#348f77","#69b89f","#547ec5","#94addc"];
function initCharts(){
 if(typeof Chart==="undefined"){document.querySelectorAll(".chart-wrap").forEach(c=>c.innerHTML='<p style="font-size:10px;color:#999;padding:20px">Charts could not load. Check your internet connection.</p>');return}
 Chart.defaults.font.family='"DM Sans", sans-serif';Chart.defaults.font.size=12;Chart.defaults.color="#8b8c9e";
 Object.assign(Chart.defaults.plugins.tooltip,{backgroundColor:"rgba(27,28,40,.94)",padding:12,cornerRadius:10,titleFont:{weight:"700"},boxPadding:5,usePointStyle:true});
 const redFill=ctx=>{const {chart}=ctx;const {ctx:c,chartArea}=chart;if(!chartArea)return "rgba(212,29,61,.08)";const g=c.createLinearGradient(0,chartArea.top,0,chartArea.bottom);g.addColorStop(0,"rgba(212,29,61,.28)");g.addColorStop(1,"rgba(212,29,61,0)");return g};
 const rise={y:{duration:1100,easing:"easeOutQuart",from:ctx=>ctx.type==="data"&&ctx.chart.scales.y?ctx.chart.scales.y.getPixelForValue(0):undefined,delay:ctx=>ctx.type==="data"&&ctx.mode==="default"?ctx.dataIndex*90+ctx.datasetIndex*160:0}};
 requestChart=new Chart($("requestsChart"),{type:"line",data:{labels:["May","Jun","Jul","Aug","Sep","Oct"],datasets:[{label:"Donation records",data:[82,98,90,125,112,136],borderColor:"#d41d3d",backgroundColor:redFill,fill:true,tension:.42,pointRadius:4,pointHoverRadius:7,pointBackgroundColor:"#fff",pointBorderWidth:2.5,borderWidth:3},{label:"Verified transfers",data:[68,80,74,102,91,84],borderColor:"#38b484",backgroundColor:"transparent",tension:.42,pointRadius:4,pointHoverRadius:7,pointBackgroundColor:"#fff",pointBorderWidth:2.5,borderWidth:3,borderDash:[6,5]}]},options:{responsive:true,maintainAspectRatio:false,animations:rise,interaction:{mode:"index",intersect:false},plugins:{legend:{display:false}},scales:{x:{grid:{display:false},border:{display:false}},y:{beginAtZero:true,grid:{color:"#f1eef2"},border:{display:false},ticks:{maxTicksLimit:5}}}}});
 inventoryChart=new Chart($("inventoryChart"),{type:"doughnut",data:{labels:BLOOD_TYPES,datasets:[{data:BLOOD_TYPES.map(t=>inventory[t]||0),backgroundColor:chartColors,borderColor:"#fff",borderWidth:3,borderRadius:6,hoverOffset:10,spacing:2}]},options:{responsive:true,maintainAspectRatio:false,cutout:"74%",animation:{animateRotate:true,animateScale:true,duration:1400,easing:"easeOutQuart"},plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${ctx.label}: ${ctx.raw} units`}}}}});
 reportChart=new Chart($("reportChart"),{type:"bar",data:{labels:["May","Jun","Jul","Aug","Sep","Oct"],datasets:[{label:"Donation records",data:[121,140,133,159,151,173],backgroundColor:"#d41d3d",borderRadius:8,maxBarThickness:30},{label:"Verified transfers",data:[88,102,95,123,116,94],backgroundColor:"#7fd0b0",borderRadius:8,maxBarThickness:30}]},options:{responsive:true,maintainAspectRatio:false,animations:rise,plugins:{legend:{position:"bottom",labels:{usePointStyle:true,boxWidth:7,boxHeight:7,padding:18}}},scales:{x:{grid:{display:false},border:{display:false}},y:{beginAtZero:true,grid:{color:"#f1eef2"},border:{display:false}}}}});
}
function navigate(section){
 // Inventory is a panel inside Overview, so reveal Overview and scroll to that panel.
 const targetSection=section==="inventory"?"overview":section;
 document.querySelectorAll(".page-section").forEach(el=>{
   const active=el.id===targetSection;
   el.classList.toggle("hidden-section",!active);
   el.classList.toggle("visible",active&&el.id!=="overview");
   if(el.id==="overview")el.style.display=active?"block":"none";
 });
 document.querySelectorAll(".nav-item").forEach(a=>a.classList.toggle("active",
   a.dataset.section===section || (section==="all-requests"&&a.dataset.section==="donation-records") || (section==="inventory"&&a.dataset.section==="overview")));
 const labels={overview:"Overview","donation-records":"Donation verification",requests:"Donation verification",inventory:"Blood inventory",donors:"Donor directory",reports:"Reports & analytics",profile:"Hospital profile",settings:"Settings","all-requests":"All blood requests",ads:"Advertisements","hall-bookings":"Hall bookings"};
 $("crumbTitle").textContent=labels[section]||"Overview";
 if(section==="donation-records"||section==="all-requests")renderRecords();
 if(section==="inventory")renderInventory();
 if(section==="donors")renderDonors();
 if(section==="ads"&&typeof renderAds==="function"){renderAds();updateAdPreview()}
 if(section==="hall-bookings"&&typeof window.renderHallBookings==="function")window.renderHallBookings();
 if(section==="reports"&&reportChart)setTimeout(()=>reportChart.resize(),80);
 if(section==="overview"){if(requestChart)setTimeout(()=>requestChart.resize(),80);if(inventoryChart)setTimeout(()=>inventoryChart.resize(),80)}
 $("sidebar").classList.remove("open");
 const menu=$("menuButton");if(menu)menu.setAttribute("aria-expanded","false");
 if(section==="inventory")setTimeout(()=>$("inventory").scrollIntoView({behavior:"smooth",block:"start"}),60);
 else window.scrollTo({top:0,behavior:"smooth"});
}
function getFilteredDonors(){
 const q=($("donorSearch")?.value||"").trim().toLowerCase();
 const blood=$("donorBloodFilter")?.value||"all";
 const availability=$("donorAvailabilityFilter")?.value||"all";
 return donors.filter(d=>{
  const matchesQuery=[d.name,d.email,d.type,d.location,d.availability].some(v=>String(v).toLowerCase().includes(q));
  const matchesBlood=blood==="all"||d.type===blood;
  const matchesAvailability=availability==="all"||d.availability===availability;
  return matchesQuery&&matchesBlood&&matchesAvailability;
 });
}
function renderDonors(){
 const filtered=getFilteredDonors();
 const count=$("donorResultsCount");if(count)count.textContent=filtered.length;
 const body=$("donorTableBody");
 if(!body)return;
 body.innerHTML=filtered.map(d=>`<tr>
  <td><b>${esc(d.name)}</b></td>
  <td><a class="donor-email-link" href="mailto:${encodeURIComponent(d.email)}">${esc(d.email)}</a></td>
  <td><span class="blood-type">${esc(d.type)}</span></td>
  <td>${esc(d.location)}</td>
  <td>${esc(d.last)}</td>
  <td><span class="status-pill ${d.availability==="Available"?"fulfilled":"pending"}">${esc(d.availability)}</span></td>
  <td><button class="donor-action" type="button" data-email-donor="${esc(d.email)}">Email</button></td>
 </tr>`).join("")||'<tr><td colspan="7" class="empty-records">No donors match your filters.</td></tr>';
}
function emailFilteredDonors(){
 const filtered=getFilteredDonors();
 if(!filtered.length){toast("No donors match the current filters.");return}
 const recipients=filtered.map(d=>d.email).filter(Boolean);
 const subject="Blood donation invitation — BloodLink";
 const body="Hello,\\n\\nWe hope you are doing well. Our hospital is checking whether previous donors may be willing and eligible to donate blood again. If you are interested, please reply to coordinate with the hospital team. Please donate only if you meet the medical eligibility requirements and enough time has passed since your last donation.\\n\\nThank you for helping save lives.\\nAl Hayat Hospital — BloodLink";
 const mailto=`mailto:?bcc=${encodeURIComponent(recipients.join(","))}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
 window.location.href=mailto;
}

document.querySelectorAll(".nav-item[data-section]").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();navigate(a.dataset.section)}));
document.querySelectorAll('a[href="#inventory"]').forEach(a=>a.addEventListener("click",e=>{e.preventDefault();navigate("inventory")}));
if($("viewAllRequests"))$("viewAllRequests").addEventListener("click",e=>{e.preventDefault();navigate("all-requests")});
$("manageInventory").addEventListener("click",()=>navigate("inventory"));
if($("recentRequestsBody"))$("recentRequestsBody").addEventListener("click",e=>{const p=e.target.closest("[data-print]");const v=e.target.closest("[data-verify]");if(p)printRecord(p.dataset.print);if(v)verifyRecord(v.dataset.verify);});
$("donationRecordsBody").addEventListener("click",e=>{const p=e.target.closest("[data-print]");const v=e.target.closest("[data-verify]");if(p)printRecord(p.dataset.print);if(v)verifyRecord(v.dataset.verify);});
if($("allRequestsBody"))$("allRequestsBody").addEventListener("click",e=>{const p=e.target.closest("[data-print]");const v=e.target.closest("[data-verify]");if(p)printRecord(p.dataset.print);if(v)verifyRecord(v.dataset.verify);});
function verifyRecord(id){const r=records.find(x=>x.id===id);if(!r)return;if(!confirm(`Confirm that donation ${id} has been checked and can be marked Verified?`))return;r.status="Verified";save("bloodlinkDonationRecords",records);renderRecords();bloodBurst("#13895f");flashRow(id);toast(`${id} verified. You can now print its record.`);}
$("recordSearch").addEventListener("input",renderRecords);
$("newDonationButton").addEventListener("click",()=>{$("createRecordPanel").scrollIntoView({behavior:"smooth",block:"start"});$("donationForm").elements.donor.focus()});
$("donationDate").value=new Date().toISOString().slice(0,10);
$("donationForm").addEventListener("submit",e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const rec={id:`DV-${new Date().getFullYear()}-${String(Math.max(0,...records.map(r=>Number(r.id.split("-").pop())||0))+1).padStart(3,"0")}`,donor:fd.get("donor").trim(),recipient:fd.get("recipient").trim(),type:fd.get("type"),units:Number(fd.get("units")),date:fd.get("date"),status:"Verified",notes:fd.get("notes").trim()};records.unshift(rec);save("bloodlinkDonationRecords",records);e.currentTarget.reset();$("donationDate").value=new Date().toISOString().slice(0,10);renderRecords();bloodBurst();flashRow(rec.id);toast(`Donation record ${rec.id} saved.`);$("recordTableCount")?.scrollIntoView({behavior:"smooth",block:"center"});});
if($("allRequestsBody"))$("allRequestsBody").addEventListener("change",e=>{const s=e.target.closest(".row-status");if(!s)return;const r=records.find(x=>x.id===s.dataset.id);if(r){r.status=s.value;save("bloodlinkDonationRecords",records);renderRecords();toast(`${r.id} status updated to ${r.status}.`)}});

$("donorSearch").addEventListener("input",renderDonors);
$("donorBloodFilter")?.addEventListener("change",renderDonors);
$("donorAvailabilityFilter")?.addEventListener("change",renderDonors);
$("emailDonorsButton")?.addEventListener("click",emailFilteredDonors);
$("donorTableBody")?.addEventListener("click",e=>{
 const button=e.target.closest("[data-email-donor]");
 if(button)window.location.href=`mailto:${encodeURIComponent(button.dataset.emailDonor)}?subject=${encodeURIComponent("Blood donation invitation — BloodLink")}`;
});
$("exportReport").addEventListener("click",()=>{
 const rows=[["Record ID","Donor","Recipient / Patient","Blood Type","Units","Donation Date","Verification Status","Notes"],...records.map(r=>[r.id,r.donor,r.recipient,r.type,r.units,r.date,r.status,r.notes])];
 const csv=rows.map(row=>row.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");
 const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="bloodlink-donation-verification-report.csv";a.click();URL.revokeObjectURL(url);toast("Donation verification CSV exported.");
});
$("dismissAlert").addEventListener("click",()=>{const b=$("overview").querySelector(".alert-banner");if(!b)return;if(reduceMotion){b.remove();return}b.animate([{opacity:1,transform:"none",height:b.offsetHeight+"px",marginBottom:"20px"},{opacity:0,transform:"translateX(30px)",height:"0px",marginBottom:"0px",paddingTop:"0px",paddingBottom:"0px"}],{duration:450,easing:"cubic-bezier(.22,.8,.2,1)"}).onfinish=()=>b.remove();});
$("notificationButton").addEventListener("click",()=>{const low=BLOOD_TYPES.filter(t=>(Number(inventory[t])||0)<15).length,pending=records.filter(r=>r.status!=="Verified").length;const due=typeof window.hallPaymentsDue==="function"?window.hallPaymentsDue():0;toast(`You have ${low} low-stock alert${low===1?"":"s"}, ${pending} record${pending===1?"":"s"} awaiting verification${due?` and ${due} hall booking${due===1?"":"s"} ready for payment`:""}.`)});
$("menuButton").addEventListener("click",()=>{
 const opened=$("sidebar").classList.toggle("open");
 $("menuButton").setAttribute("aria-expanded",String(opened));
});
const HOME_URL="home.html"; // غيّر هذا السطر إذا كان اسم صفحة الـ home مختلفاً (مثلاً index.html)
$("logoutButton").addEventListener("click",()=>{window.location.href=HOME_URL});
$("chartRange").addEventListener("change",()=>{
 if(!requestChart)return;const v=$("chartRange").value;
 const labels=v==="7"?["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]:v==="12"?["Nov","Dec","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct"]:["May","Jun","Jul","Aug","Sep","Oct"];
 const incoming=v==="7"?[18,22,16,27,24,19,30]:v==="12"?[70,78,85,76,91,101,82,98,90,125,112,136]:[82,98,90,125,112,136];
 const fulfilled=v==="7"?[12,18,12,20,17,15,22]:v==="12"?[55,61,68,63,71,78,68,80,74,102,91,84]:[68,80,74,102,91,84];
 requestChart.data.labels=labels;requestChart.data.datasets[0].data=incoming;requestChart.data.datasets[1].data=fulfilled;requestChart.update();
});
$("saveHospitalProfile").addEventListener("click",()=>{const data={name:$("hospitalName").value,email:$("hospitalEmail").value,phone:$("hospitalPhone").value,city:$("hospitalCity").value,address:$("hospitalAddress").value};save("bloodlinkHospitalProfile",data);toast("Hospital profile saved in this browser demo.")});
["lowStockSetting","urgentSetting","compactSetting"].forEach(id=>$(id).addEventListener("change",()=>{
 const settings={lowStock:$("lowStockSetting").checked,urgent:$("urgentSetting").checked,compact:$("compactSetting").checked};save("bloodlinkHospitalSettings",settings);
 const banner=document.querySelector(".alert-banner");if(banner)banner.style.display=settings.lowStock?"flex":"none";
 document.querySelectorAll(".priority.urgent").forEach(el=>el.closest("tr").style.display=settings.urgent?"":"none");
 document.querySelectorAll("table").forEach(t=>t.classList.toggle("compact-table",settings.compact));
 $("settingsMessage").textContent="Settings saved in this browser demo.";
}));
$("todayDate").textContent=new Date().toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
// Personalize the greeting to the visitor's local time.
const greetingHeading=document.querySelector(".welcome-row h1");
if(greetingHeading){const hour=new Date().getHours();const greeting=hour<12?"Good morning, ":hour<18?"Good afternoon, ":"Good evening, ";greetingHeading.childNodes[0].textContent=greeting;}
// Restore browser-demo preferences and profile values on refresh.
const savedProfile=read("bloodlinkHospitalProfile",null);
if(savedProfile){
 const fields={hospitalName:savedProfile.name,hospitalEmail:savedProfile.email,hospitalPhone:savedProfile.phone,hospitalCity:savedProfile.city,hospitalAddress:savedProfile.address};
 Object.entries(fields).forEach(([id,value])=>{if($(id)&&value!==undefined)$(id).value=value});
 const switchName=document.querySelector(".hospital-switch b");if(switchName&&savedProfile.name)switchName.textContent=savedProfile.name;
}
const savedSettings=read("bloodlinkHospitalSettings",null);
if(savedSettings){
 if($("lowStockSetting"))$("lowStockSetting").checked=savedSettings.lowStock!==false;
 if($("urgentSetting"))$("urgentSetting").checked=savedSettings.urgent!==false;
 if($("compactSetting"))$("compactSetting").checked=!!savedSettings.compact;
 document.querySelectorAll("table").forEach(t=>t.classList.toggle("compact-table",!!savedSettings.compact));
 if($("overview")?.querySelector(".alert-banner"))$("overview").querySelector(".alert-banner").style.display=savedSettings.lowStock===false?"none":"flex";
}
// Reveal content as it enters view, without breaking reduced-motion preferences.
if("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
 const revealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
   if(entry.isIntersecting){entry.target.classList.add("is-visible");revealObserver.unobserve(entry.target)}
 }),{threshold:.12});
 document.querySelectorAll(".metric-card,.panel,.alert-banner").forEach(el=>revealObserver.observe(el));
}
// Close the mobile drawer when tapping outside it.
document.addEventListener("click",event=>{
 if(window.innerWidth<=760 && $("sidebar").classList.contains("open") && !$("sidebar").contains(event.target) && !$("menuButton").contains(event.target)){
   $("sidebar").classList.remove("open");$("menuButton").setAttribute("aria-expanded","false");
 }
});
renderRecords();renderInventory();renderDonors();initCharts();

/* =====================================================================
   Motion layer — heartbeat-themed interactions
   ===================================================================== */
// ECG traces: build a heartbeat waveform path sized to each SVG's viewBox.
function ecgPath(w,h,cycles){
 const mid=h*.55,step=w/cycles;let d=`M0 ${mid}`;
 for(let i=0;i<cycles;i++){
  const x=i*step,u=step/20;
  d+=` L${x+u*5} ${mid} Q${x+u*6} ${mid-h*.12} ${x+u*7} ${mid}`+        // P wave
     ` L${x+u*8} ${mid} L${x+u*8.6} ${mid+h*.12} L${x+u*9.4} ${h*.06}`+    // Q-R
     ` L${x+u*10.3} ${h*.94} L${x+u*11} ${mid} L${x+u*12.5} ${mid}`+        // S
     ` Q${x+u*14} ${mid-h*.2} ${x+u*15.5} ${mid} L${x+step} ${mid}`;        // T wave
 }
 return d;
}
document.querySelectorAll("svg.ecg").forEach(svg=>{
 const [, , w, h]=svg.getAttribute("viewBox").split(" ").map(Number);
 const d=ecgPath(w,h,Number(svg.dataset.cycles)||3);
 svg.querySelectorAll("path").forEach(p=>{p.setAttribute("d",d);p.setAttribute("pathLength","1000")});
});

// Intro loader: one heartbeat, then reveal the dashboard.
(function(){
 const loader=$("pageLoader");if(!loader)return;
 const hide=()=>{loader.classList.add("done");setTimeout(()=>loader.remove(),700);countUp(document.querySelector(".page-section:not(.hidden-section)"))};
 if(reduceMotion){loader.remove();return}
 const started=performance.now();
 const go=()=>setTimeout(hide,Math.max(0,1100-(performance.now()-started)));
 if(document.readyState==="complete")go();else window.addEventListener("load",go,{once:true});
 setTimeout(()=>{if(loader.isConnected)hide()},3000);
})();

// Live clock in the hero.
function tickClock(){const c=$("liveClock");if(c)c.textContent=new Date().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}
tickClock();setInterval(tickClock,15000);

// Count-up for metric numbers (keeps units like "<small>units</small>").
function countUp(root){
 if(reduceMotion||!root)return;
 root.querySelectorAll(".metric-value, .donut-center strong, .donor-results-count b").forEach(el=>{
  const node=[...el.childNodes].find(n=>n.nodeType===3&&/\d/.test(n.textContent));if(!node)return;
  const raw=node.textContent,m=raw.match(/\d[\d,]*(\.\d+)?/);if(!m)return;
  const target=parseFloat(m[0].replace(/,/g,"")),dec=(m[1]||"").length-(m[1]?1:0),comma=m[0].includes(",");
  const fmt=v=>raw.replace(m[0],comma?v.toLocaleString("en-US",{minimumFractionDigits:dec,maximumFractionDigits:dec}):v.toFixed(dec));
  const start=performance.now(),dur=1200;
  (function tick(now){
   if(!node.isConnected)return;
   const p=Math.min(1,(now-start)/dur),e=1-Math.pow(1-p,4);
   node.textContent=p<1?fmt(target*e):raw;
   if(p<1)requestAnimationFrame(tick);
  })(start);
 });
}

// Section changes: animate breadcrumb and re-run counters.
const baseNavigate=navigate;
navigate=function(section){
 baseNavigate(section);
 const crumb=$("crumbTitle");crumb.classList.remove("swap");void crumb.offsetWidth;crumb.classList.add("swap");
 const target=section==="inventory"?"overview":section;
 countUp($(target));
};

// Ripple on buttons.
document.addEventListener("pointerdown",e=>{
 window.__lastPointer={x:e.clientX,y:e.clientY};
 const b=e.target.closest(".primary-button,.full-button,.record-action,.donor-action,.icon-button");
 if(!b||reduceMotion)return;
 const r=b.getBoundingClientRect(),size=Math.max(r.width,r.height)*2.2,s=document.createElement("span");
 s.className="ripple";s.style.cssText=`width:${size}px;height:${size}px;left:${e.clientX-r.left-size/2}px;top:${e.clientY-r.top-size/2}px`;
 b.appendChild(s);s.addEventListener("animationend",()=>s.remove());
},true);

// Cursor-following glow on cards and panels.
document.addEventListener("pointermove",e=>{
 const c=e.target.closest&&e.target.closest(".metric-card,.panel:not(.table-panel)");if(!c)return;
 const r=c.getBoundingClientRect();c.style.setProperty("--mx",`${e.clientX-r.left}px`);c.style.setProperty("--my",`${e.clientY-r.top}px`);
},{passive:true});

// Blood-drop burst for successful actions.
function bloodBurst(color){
 if(reduceMotion)return;
 const {x,y}=window.__lastPointer||{x:innerWidth/2,y:innerHeight/2};
 const palette=color?[color,color,"#5fd1a2"]:["#d41d3d","#ef4562","#9e0d28"];
 const ring=document.createElement("span");ring.className="burst-ring";ring.style.cssText=`left:${x}px;top:${y}px;border-color:${palette[0]}`;document.body.appendChild(ring);
 ring.addEventListener("animationend",()=>ring.remove());
 for(let i=0;i<16;i++){
  const a=(Math.PI*2*i)/16+Math.random()*.4,dist=50+Math.random()*60,d=document.createElement("span");
  d.className="burst-drop";
  d.style.cssText=`left:${x}px;top:${y}px;--tx:${Math.cos(a)*dist}px;--ty:${Math.sin(a)*dist+20}px;--r:${a*57+45}deg;--c:${palette[i%3]};width:${6+Math.random()*7}px;height:${6+Math.random()*7}px`;
  document.body.appendChild(d);d.addEventListener("animationend",()=>d.remove());
 }
}
function flashRow(id){
 document.querySelectorAll(`[data-print="${CSS.escape(id)}"]`).forEach(b=>{const tr=b.closest("tr");if(tr){tr.classList.remove("row-flash");void tr.offsetWidth;tr.classList.add("row-flash")}});
}
/* =====================================================================
   Advertisements — create paid hospital ads, checkout, and campaign list
   Shared data/template lives in ads-data.js (window.BloodLinkAds).
   ===================================================================== */
const ADS=window.BloodLinkAds;
let ads=ADS?ADS.load():[];
let selectedPlan="featured";
let pendingAd=null;
const hospitalName=()=>($("hospitalName")?.value||"Al Hayat Hospital").trim();
const myAds=()=>ads.filter(a=>a.owner==="self");

function renderPlans(){
 $("planGrid").innerHTML=Object.values(ADS.PLANS).map(p=>`<label class="plan-card${p.id===selectedPlan?" selected":""}${p.id==="featured"?" popular":""}">
  <input type="radio" name="adPlan" value="${p.id}"${p.id===selectedPlan?" checked":""}>
  ${p.id==="featured"?'<span class="plan-flag">Most chosen</span>':""}
  <span class="plan-name">${p.name}</span>
  <span class="plan-price"><b>${p.price}</b> ${ADS.CURRENCY}<small>/ ${p.days} days</small></span>
  <ul>${p.perks.map(x=>`<li>${x}</li>`).join("")}</ul>
  <span class="plan-pick">${p.id===selectedPlan?"Selected":"Choose plan"}</span>
 </label>`).join("");
}
function readAdForm(){
 const f=$("adForm"),fd=new FormData(f);
 const get=k=>String(fd.get(k)||"").trim();
 const startDate=get("startDate")||ADS.today();
 return {title:get("title"),department:get("department"),category:get("category"),badge:get("badge"),eventDate:get("eventDate"),startTime:get("startTime"),endTime:get("endTime"),
  location:get("location"),phone:get("phone"),description:get("description"),booking:!!fd.get("booking"),plan:selectedPlan,startDate,endDate:ADS.endDate(startDate,selectedPlan),
  hospital:hospitalName(),owner:"self"};
}
function updateAdPreview(){
 if(!ADS)return;
 const ad=readAdForm();
 $("adPreview").innerHTML=ADS.cardHTML(ad,{preview:true});
 const p=ADS.PLANS[selectedPlan],f=ADS.fees(selectedPlan);
 $("summaryPlan").textContent=`${p.name} plan · ${p.days} days`;
 $("summaryRun").textContent=`Live ${ADS.formatDate(ad.startDate)} → ${ADS.formatDate(ad.endDate)}`;
 $("summaryFee").textContent=ADS.money(f.fee);$("summaryVat").textContent=ADS.money(f.vat);$("summaryTotal").textContent=ADS.money(f.total);
 $("adDescCount").textContent=ad.description.length;
}
function validateAd(ad){
 const t=ADS.today();
 if(!ad.title||!ad.department||!ad.category||!ad.eventDate||!ad.startTime||!ad.endTime||!ad.location||!ad.phone||!ad.description)return "Please fill in all required fields.";
 if(ad.description.length<20)return "Please write a description of at least 20 characters.";
 if(ad.startDate<t)return "The ad can't go live on a past date.";
 if(ad.eventDate<t)return "The event date can't be in the past.";
 if(ad.eventDate<ad.startDate)return "The ad must go live on or before the event date.";
 if(ad.endTime<=ad.startTime)return "The end time must be after the start time.";
 if(!/^[+\d][\d\s-]{6,}$/.test(ad.phone))return "Please enter a valid contact phone number.";
 return "";
}
function adStatusClass(s){return {Active:"verified",Scheduled:"matched",Expired:"pending",Stopped:"stopped"}[s]||"pending"}
function renderAds(){
 if(!ADS)return;
 const mine=myAds(),filter=$("adStatusFilter")?.value||"all";
 const withStatus=mine.map(a=>({...a,_s:ADS.status(a)}));
 $("adActive").textContent=withStatus.filter(a=>a._s==="Active").length;
 $("adScheduled").textContent=withStatus.filter(a=>a._s==="Scheduled").length;
 $("adViews").textContent=mine.reduce((s,a)=>s+(Number(a.views)||0),0).toLocaleString("en-US");
 $("adSpent").innerHTML=`${Math.round(mine.reduce((s,a)=>s+(Number(a.paid)||0),0)).toLocaleString("en-US")} <small>${ADS.CURRENCY}</small>`;
 $("navAds").textContent=withStatus.filter(a=>a._s==="Active").length;
 const rows=withStatus.filter(a=>filter==="all"||a._s===filter);
 $("adTableCount").textContent=mine.length;
 $("adTableBody").innerHTML=rows.length?rows.map(a=>`<tr>
  <td><span class="request-id">${ADS.esc(a.id)}</span></td>
  <td><b>${ADS.esc(a.title)}</b><small class="cell-subtext">${ADS.esc(a.department)} · event ${ADS.formatDate(a.eventDate)}</small></td>
  <td><span class="plan-chip plan-${ADS.esc(a.plan)}">${ADS.esc(ADS.PLANS[a.plan]?.name||a.plan)}</span></td>
  <td>${ADS.formatDate(a.startDate,{day:"2-digit",month:"short"})} → ${ADS.formatDate(a.endDate,{day:"2-digit",month:"short"})}</td>
  <td><span class="status-pill ${adStatusClass(a._s)}">${a._s}</span></td>
  <td>${(Number(a.views)||0).toLocaleString("en-US")}</td>
  <td>${ADS.money(a.paid||0)}</td>
  <td><div class="record-actions"><a class="record-action print" href="ads.html#${encodeURIComponent(a.id)}" target="_blank" rel="noopener">View</a>${a._s==="Active"||a._s==="Scheduled"?`<button class="record-action stop" type="button" data-stop-ad="${ADS.esc(a.id)}">Stop</button>`:""}</div></td>
 </tr>`).join(""):'<tr><td colspan="8" class="empty-records">No advertisements yet. Create your first one above.</td></tr>';
}

/* ---------- Checkout ---------- */
const dlg=$("checkoutDialog");
function showStep(step){dlg.querySelectorAll(".checkout-step").forEach(s=>s.hidden=s.dataset.step!==step)}
function selectedMethod(){return dlg.querySelector('input[name="method"]:checked')?.value||"card"}
function openCheckout(){
 const ad=readAdForm(),err=validateAd(ad),box=$("adFormError");
 box.hidden=!err;box.textContent=err;
 if(err){$("adForm").reportValidity?.();box.scrollIntoView({behavior:"smooth",block:"center"});return}
 pendingAd=ad;
 const f=ADS.fees(selectedPlan),p=ADS.PLANS[selectedPlan];
 $("coTitle").textContent=ad.title;
 $("coMeta").textContent=`${p.name} plan · ${p.days} days · live from ${ADS.formatDate(ad.startDate)}`;
 $("coTotal").textContent=ADS.money(f.total);$("payAmount").textContent=ADS.money(f.total);
 $("cliqRef").textContent=ADS.nextId(ads);
 $("payError").hidden=true;$("adTerms").checked=false;
 ["cardNumber","cardExpiry","cardCvc","cliqTxn"].forEach(id=>$(id).value="");
 $("cardName").value=hospitalName();
 showStep("pay");
 if(typeof dlg.showModal==="function")dlg.showModal();else dlg.setAttribute("open","");
}
function closeCheckout(){if(dlg.open)dlg.close();else dlg.removeAttribute("open")}
function luhn(num){let s=0,alt=false;for(let i=num.length-1;i>=0;i--){let n=+num[i];if(alt){n*=2;if(n>9)n-=9}s+=n;alt=!alt}return s%10===0}
function validatePayment(){
 const m=selectedMethod();
 if(m==="card"){
  const num=$("cardNumber").value.replace(/\s/g,""),exp=$("cardExpiry").value,cvc=$("cardCvc").value;
  if(!$("cardName").value.trim())return "Enter the name on the card.";
  if(!/^\d{13,19}$/.test(num)||!luhn(num))return "Enter a valid card number.";
  const mm=/^(\d{2})\/(\d{2})$/.exec(exp);if(!mm||+mm[1]<1||+mm[1]>12)return "Enter the expiry as MM/YY.";
  const now=new Date(),y=2000+ +mm[2];if(y<now.getFullYear()||(y===now.getFullYear()&&+mm[1]<now.getMonth()+1))return "This card has expired.";
  if(!/^\d{3,4}$/.test(cvc))return "Enter a valid CVC.";
 }
 if(m==="cliq"&&$("cliqTxn").value.trim().length<4)return "Enter the CliQ transfer reference.";
 if(!$("adTerms").checked)return "Please confirm the ad details and fee terms.";
 return "";
}
function pay(){
 const err=validatePayment(),box=$("payError");box.hidden=!err;box.textContent=err;if(err)return;
 const m=selectedMethod(),f=ADS.fees(pendingAd.plan);
 showStep("processing");
 setTimeout(()=>{
  const ad={...pendingAd,id:ADS.nextId(ads),paid:f.total,fee:f.fee,vat:f.vat,payMethod:m,receipt:`RC-${Date.now().toString(36).toUpperCase()}`,views:0,cancelled:false,createdAt:new Date().toISOString()};
  ads.unshift(ad);ADS.save(ads);
  // Card details are intentionally discarded; only the method is recorded.
  ["cardNumber","cardExpiry","cardCvc"].forEach(id=>$(id).value="");
  const live=ADS.status(ad)==="Active";
  $("successText").textContent=live?`"${ad.title}" is now live on the public ads page until ${ADS.formatDate(ad.endDate)}.`:`"${ad.title}" is scheduled to go live on ${ADS.formatDate(ad.startDate)}.`;
  $("rcptId").textContent=ad.receipt;$("rcptAmount").textContent=ADS.money(ad.paid);
  $("rcptMethod").textContent={card:"Card",cliq:"CliQ transfer",invoice:"Monthly invoice"}[m];
  $("viewPublicAd").href=`ads.html#${encodeURIComponent(ad.id)}`;
  showStep("success");
  $("adForm").reset();resetAdFormDefaults();updateAdPreview();renderAds();bloodBurst("#13895f");
  toast(`Payment received — ${ad.id} ${live?"is live":"is scheduled"}.`);
 },1400);
}
function resetAdFormDefaults(){
 const t=ADS.today();
 $("adStartDate").value=t;$("adStartDate").min=t;$("adEventDate").min=t;
 if(!$("adEventDate").value)$("adEventDate").value=ADS.addDays(t,7);
 if(!$("adPhone").value)$("adPhone").value=$("hospitalPhone")?.value||"";
}
function initAds(){
 if(!ADS||!$("adForm"))return;
 $("adDepartment").innerHTML='<option value="">Select department</option>'+ADS.DEPARTMENTS.map(d=>`<option${d==="Orthopedics"?" selected":""}>${d}</option>`).join("");
 $("adCategory").innerHTML='<option value="">Select ad type</option>'+Object.keys(ADS.CATEGORIES).map(c=>`<option${c==="Free consultation day"?" selected":""}>${c}</option>`).join("");
 resetAdFormDefaults();renderPlans();updateAdPreview();renderAds();
 $("planGrid").addEventListener("change",e=>{if(e.target.name==="adPlan"){selectedPlan=e.target.value;renderPlans();updateAdPreview()}});
 $("adForm").addEventListener("input",()=>{updateAdPreview();$("adFormError").hidden=true});
 $("adForm").addEventListener("change",updateAdPreview);
 $("adForm").addEventListener("submit",e=>{e.preventDefault();openCheckout()});
 $("proceedPayment").addEventListener("click",openCheckout);
 $("newAdButton").addEventListener("click",()=>{$("adBuilder").scrollIntoView({behavior:"smooth",block:"start"});setTimeout(()=>$("adForm").elements.title.focus({preventScroll:true}),400)});
 $("adStatusFilter").addEventListener("change",renderAds);
 $("adTableBody").addEventListener("click",e=>{
  const b=e.target.closest("[data-stop-ad]");if(!b)return;
  const ad=ads.find(a=>a.id===b.dataset.stopAd);if(!ad)return;
  if(!confirm(`Stop ${ad.id}? It will be removed from the public page. Posting fees are non-refundable.`))return;
  ad.cancelled=true;ADS.save(ads);renderAds();toast(`${ad.id} stopped and removed from the public page.`);
 });
 // Checkout interactions
 dlg.addEventListener("click",e=>{if(!dlg.querySelector('[data-step="processing"]').hidden)return;if(e.target.closest("[data-close]")||e.target===dlg)closeCheckout()});
 dlg.addEventListener("cancel",e=>{if(!dlg.querySelector('[data-step="processing"]').hidden)e.preventDefault()});
 dlg.addEventListener("change",e=>{if(e.target.name==="method"){dlg.querySelectorAll(".pay-fields").forEach(p=>p.hidden=p.dataset.method!==e.target.value);$("payError").hidden=true}});
 $("payButton").addEventListener("click",pay);
 $("cardNumber").addEventListener("input",e=>{e.target.value=e.target.value.replace(/\D/g,"").slice(0,19).replace(/(\d{4})(?=\d)/g,"$1 ")});
 $("cardExpiry").addEventListener("input",e=>{let v=e.target.value.replace(/\D/g,"").slice(0,4);if(v.length>2)v=v.slice(0,2)+"/"+v.slice(2);e.target.value=v});
 $("cardCvc").addEventListener("input",e=>{e.target.value=e.target.value.replace(/\D/g,"").slice(0,4)});
 // Keep in sync if the public page updates views in another tab.
 window.addEventListener("storage",e=>{if(e.key===ADS.KEY){ads=ADS.load();renderAds()}});
}
initAds();
// Open a section directly from the URL (e.g. hospital.html#ads from the public page).
(function(){const h=location.hash.slice(1);if(h&&document.querySelector(`.nav-item[data-section="${CSS.escape(h)}"]`))navigate(h)})();