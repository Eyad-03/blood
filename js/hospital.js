const $=id=>document.getElementById(id);
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
 $("recordPending").textContent=records.length-verified.length;
 const requestCount=$("requestTableCount");if(requestCount)requestCount.textContent=records.length;
 const navRequestCount=$("navRequests");if(navRequestCount)navRequestCount.textContent=records.filter(r=>r.status!=="Verified").length;
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
 $("lowStockList").innerHTML=low.length?low.map(x=>`<div class="stock-row"><div class="stock-type">${x.type}</div><div class="stock-info"><b>${x.type} blood</b><small>Minimum target: 15 units</small></div><div class="stock-right"><b>${x.units} units</b><small>${x.units===0?"Out of stock":x.units<8?"Critical":"Low stock"}</small></div><div class="stock-bar"><span style="width:${Math.min(100,x.units/15*100)}%"></span></div></div>`).join(""):'<p class="empty-state">No low stock alerts. Inventory is above the minimum threshold.</p>';
 const alertCount=low.length;$("inventory").querySelector(".stock-alert-count").textContent=`${alertCount} alerts`;
 if(inventoryChart){inventoryChart.data.datasets[0].data=entries.map(x=>x.units);inventoryChart.update()}
 $("bloodLegend").innerHTML=entries.map((x,i)=>`<div class="blood-legend-item"><i style="background:${chartColors[i]}"></i><span>${x.type}</span><b>${x.units}</b></div>`).join("");
}
const chartColors=["#c91835","#e55a70","#e69a4b","#edc26b","#348f77","#69b89f","#547ec5","#94addc"];
function initCharts(){
 if(typeof Chart==="undefined"){document.querySelectorAll(".chart-wrap").forEach(c=>c.innerHTML='<p style="font-size:10px;color:#999;padding:20px">Charts could not load. Check your internet connection.</p>');return}
 Chart.defaults.font.family='"DM Sans", sans-serif';Chart.defaults.font.size=10;Chart.defaults.color="#9696a1";
 requestChart=new Chart($("requestsChart"),{type:"line",data:{labels:["May","Jun","Jul","Aug","Sep","Oct"],datasets:[{label:"Donation records",data:[82,98,90,125,112,136],borderColor:"#c91835",backgroundColor:"#c9183510",fill:true,tension:.38,pointRadius:3,pointHoverRadius:5,borderWidth:2},{label:"Verified transfers",data:[68,80,74,102,91,84],borderColor:"#45b58b",backgroundColor:"transparent",tension:.38,pointRadius:3,pointHoverRadius:5,borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:"#292631",padding:10,cornerRadius:7}},scales:{x:{grid:{display:false},border:{display:false}},y:{beginAtZero:true,grid:{color:"#f1eef2"},border:{display:false},ticks:{maxTicksLimit:5}}}}});
 inventoryChart=new Chart($("inventoryChart"),{type:"doughnut",data:{labels:BLOOD_TYPES,datasets:[{data:BLOOD_TYPES.map(t=>inventory[t]||0),backgroundColor:chartColors,borderColor:"#fff",borderWidth:3,hoverOffset:5}]},options:{responsive:true,maintainAspectRatio:false,cutout:"76%",plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${ctx.label}: ${ctx.raw} units`}}}}});
 reportChart=new Chart($("reportChart"),{type:"bar",data:{labels:["May","Jun","Jul","Aug","Sep","Oct"],datasets:[{label:"Donation records",data:[121,140,133,159,151,173],backgroundColor:"#c91835",borderRadius:5,maxBarThickness:28},{label:"Verified transfers",data:[88,102,95,123,116,94],backgroundColor:"#80cdb0",borderRadius:5,maxBarThickness:28}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"bottom",labels:{usePointStyle:true,boxWidth:7,boxHeight:7,padding:18}}},scales:{x:{grid:{display:false},border:{display:false}},y:{beginAtZero:true,grid:{color:"#f1eef2"},border:{display:false}}}}});
}
function navigate(section){
 const valid=["overview","donation-records","inventory","donors","reports","profile","settings","all-requests"];
 document.querySelectorAll(".page-section").forEach(el=>{el.classList.toggle("hidden-section",el.id!=="overview"&&el.id!==section);el.classList.toggle("visible",el.id===section&&el.id!=="overview")});
 if(section==="overview"){$("overview").classList.remove("hidden-section");$("overview").style.display="block"}else{$("overview").classList.add("hidden-section");$("overview").style.display="none"}
 document.querySelectorAll(".nav-item").forEach(a=>a.classList.toggle("active",a.dataset.section===section||(section==="all-requests"&&a.dataset.section==="donation-records")||(section==="inventory"&&a.dataset.section==="inventory")));
 const labels={overview:"Overview","donation-records":"Donation verification",requests:"Donation verification",inventory:"Blood inventory",donors:"Donor directory",reports:"Reports & analytics",profile:"Hospital profile",settings:"Settings","all-requests":"All blood requests"};
 $("crumbTitle").textContent=labels[section]||"Overview";
 if(section==="donation-records"||section==="all-requests")renderRecords();
 if(section==="inventory")renderInventory();
 if(section==="donation-records")renderRecords();
 if(section==="donors")renderDonors();
 if(section==="reports"&&reportChart)setTimeout(()=>reportChart.resize(),50);
 if(section==="overview"){if(requestChart)setTimeout(()=>requestChart.resize(),50);if(inventoryChart)setTimeout(()=>inventoryChart.resize(),50)}
 $("sidebar").classList.remove("open");window.scrollTo({top:0,behavior:"smooth"});
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
function verifyRecord(id){const r=records.find(x=>x.id===id);if(!r)return;if(!confirm(`Confirm that donation ${id} has been checked and can be marked Verified?`))return;r.status="Verified";save("bloodlinkDonationRecords",records);renderRecords();toast(`${id} verified. You can now print its record.`);}
$("recordSearch").addEventListener("input",renderRecords);
$("newDonationButton").addEventListener("click",()=>{$("createRecordPanel").scrollIntoView({behavior:"smooth",block:"start"});$("donationForm").elements.donor.focus()});
$("donationDate").value=new Date().toISOString().slice(0,10);
$("donationForm").addEventListener("submit",e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const rec={id:`DV-${new Date().getFullYear()}-${String(Math.max(0,...records.map(r=>Number(r.id.split("-").pop())||0))+1).padStart(3,"0")}`,donor:fd.get("donor").trim(),recipient:fd.get("recipient").trim(),type:fd.get("type"),units:Number(fd.get("units")),date:fd.get("date"),status:"Pending verification",notes:fd.get("notes").trim()};records.unshift(rec);save("bloodlinkDonationRecords",records);e.currentTarget.reset();$("donationDate").value=new Date().toISOString().slice(0,10);renderRecords();toast(`Donation record ${rec.id} saved.`);$("recordsTableCount")?.scrollIntoView({behavior:"smooth",block:"center"});});
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
$("dismissAlert").addEventListener("click",()=>$("overview").querySelector(".alert-banner").remove());
$("notificationButton").addEventListener("click",()=>toast("You have 3 low-stock alerts and 3 urgent requests."));
$("menuButton").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
$("logoutButton").addEventListener("click",()=>toast("Demo mode: connect authentication to sign out securely."));
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
 document.querySelector(".alert-banner").style.display=settings.lowStock?"flex":"none";
 document.querySelectorAll(".priority.urgent").forEach(el=>el.closest("tr").style.display=settings.urgent?"":"none");
 document.querySelectorAll("table").forEach(t=>t.classList.toggle("compact-table",settings.compact));
 $("settingsMessage").textContent="Settings saved in this browser demo.";
}));
$("todayDate").textContent=new Date().toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});

renderRecords();renderInventory();renderDonors();initCharts();
