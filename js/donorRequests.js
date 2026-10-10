const $ = id => document.getElementById(id);
const STORAGE_KEY = "bloodlinkDonorIncomingRequests";
const AVAILABILITY_KEY = "bloodlinkDonorAvailability";

const demoRequests = [
  {id:"BR-2026-0214", recipientName:"Ahmad Saleh", initials:"AS", bloodType:"O−", location:"Al-Hashmi, Irbid", distance:"2.4 km away", sentAt:"Today, 10:42 AM", dateValue:"2026-10-10T10:42:00", status:"Pending", priority:"Urgent", units:2, hospital:"Al Hayat Hospital", message:"We urgently need O− blood for a family member. The hospital can coordinate the donation.", recipientPhone:"+962 7 9000 2001", recipientEmail:"ahmad.recipient@example.com"},
  {id:"BR-2026-0212", recipientName:"Maya Nasser", initials:"MN", bloodType:"O−", location:"University Street, Irbid", distance:"3.1 km away", sentAt:"Today, 9:15 AM", dateValue:"2026-10-10T09:15:00", status:"Pending", priority:"High", units:1, hospital:"Princess Basma Hospital", message:"Looking for a compatible donor. Please let us know if you are available.", recipientPhone:"+962 7 9000 2002", recipientEmail:"maya.nasser@example.com"},
  {id:"BR-2026-0198", recipientName:"Khaled Omar", initials:"KO", bloodType:"A+", location:"Downtown, Irbid", distance:"4.6 km away", sentAt:"Yesterday, 4:15 PM", dateValue:"2026-10-09T16:15:00", status:"Accepted", priority:"Normal", units:1, hospital:"Irbid Specialty Hospital", message:"Thank you for considering my request. Please coordinate with the hospital.", recipientPhone:"+962 7 9000 2003", recipientEmail:"khaled.omar@example.com"},
  {id:"BR-2026-0186", recipientName:"Sara Haddad", initials:"SH", bloodType:"B+", location:"Al-Naseem, Irbid", distance:"5.2 km away", sentAt:"Oct 7, 2026", dateValue:"2026-10-07T12:00:00", status:"Completed", priority:"Normal", units:1, hospital:"Al Hayat Hospital", message:"Thank you for your help.", recipientPhone:"", recipientEmail:""}
];
let activeFilter = "All";
let selectedRequestId = null;

function esc(value){return String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function readRequests(){
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if(stored !== null) return JSON.parse(stored);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demoRequests));
    return [...demoRequests];
  } catch { return [...demoRequests]; }
}
function saveRequests(rows){localStorage.setItem(STORAGE_KEY,JSON.stringify(rows));}
function statusClass(status){return ({Pending:"pending",Accepted:"accepted",Declined:"declined",Completed:"completed"})[status]||"pending";}
function statusLabel(status){return ({Pending:"Awaiting your response",Accepted:"Request accepted",Declined:"Request declined",Completed:"Donation completed"})[status]||status;}
function renderSummary(rows){
  $("totalCount").textContent=rows.length;
  $("pendingCount").textContent=rows.filter(r=>r.status==="Pending").length;
  $("acceptedCount").textContent=rows.filter(r=>r.status==="Accepted").length;
  $("completedCount").textContent=rows.filter(r=>r.status==="Completed").length;
  $("allTabCount").textContent=rows.length;
}
function renderRequests(){
  const all=readRequests(); renderSummary(all);
  const q=$("searchInput").value.trim().toLowerCase();
  let rows=all.filter(r=>(activeFilter==="All"||r.status===activeFilter)&&(!q||[r.recipientName,r.id,r.location,r.bloodType,r.hospital].some(v=>String(v||"").toLowerCase().includes(q))));
  const sort=$("sortSelect").value;
  rows.sort((a,b)=>sort==="urgent"?({Urgent:0,High:1,Normal:2}[a.priority]??3)-({Urgent:0,High:1,Normal:2}[b.priority]??3):sort==="newest"?new Date(b.dateValue)-new Date(a.dateValue):new Date(a.dateValue)-new Date(b.dateValue));
  $("visibleCount").textContent=rows.length;
  $("requestList").innerHTML=rows.map(r=>`
    <article class="request-card">
      <div class="request-main">
        <div class="request-avatar">${esc(r.initials||r.recipientName.split(" ").map(n=>n[0]).join("").slice(0,2))}</div>
        <div class="request-info">
          <div class="request-title-row"><h3>${esc(r.recipientName)}</h3><span class="blood-tag">${esc(r.bloodType)}</span><span class="priority ${String(r.priority||"Normal").toLowerCase()}">${esc(r.priority||"Normal")} priority</span></div>
          <p>Request ID: ${esc(r.id)} · Received ${esc(r.sentAt)}</p>
          <div class="request-meta"><span>⌖ ${esc(r.location)}</span><span>↗ <b>${esc(r.distance||"Distance unavailable")}</b></span><span>▣ ${esc(r.units)} unit${Number(r.units)===1?"":"s"}</span></div>
        </div>
      </div>
      <div class="request-side">
        <span class="status ${statusClass(r.status)}">${statusLabel(r.status)}</span>
        <div class="request-actions"><button class="small-btn" data-details="${esc(r.id)}">View details</button>${r.status==="Pending"?`<button class="small-btn decline" data-decline="${esc(r.id)}">Decline</button><button class="small-btn accept" data-accept="${esc(r.id)}">Accept</button>`:r.status==="Accepted"?`<button class="small-btn" data-complete="${esc(r.id)}">Mark completed</button>`:""}</div>
      </div>
    </article>`).join("");
  $("emptyState").classList.toggle("hidden",rows.length>0);
  $("requestList").classList.toggle("hidden",rows.length===0);
  document.querySelectorAll(".tab").forEach(tab=>tab.classList.toggle("active",tab.dataset.filter===activeFilter));
}
function toast(message){$("toast").textContent=message;$("toast").classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>$("toast").classList.remove("show"),2800);}
function openDetails(id){
  const r=readRequests().find(x=>x.id===id);if(!r)return;selectedRequestId=id;
  $("detailsTitle").textContent=`Request ${r.id}`;
  const fields=[["Recipient",r.recipientName],["Blood type requested",r.bloodType],["Priority",r.priority||"Normal"],["Units requested",r.units],["Location",r.location],["Distance",r.distance||"Not available"],["Hospital",r.hospital||"Not provided"],["Date received",r.sentAt]];
  $("detailsContent").innerHTML=`<div class="detail-grid">${fields.map(([label,value])=>`<div class="detail-item"><small>${esc(label)}</small><b>${esc(value)}</b></div>`).join("")}</div><div class="detail-note"><b>Recipient's message</b><br>${esc(r.message||"No message provided")}<br><br>${r.status==="Pending"?"Please review the details and accept only if you are comfortable and eligible to donate.":r.status==="Accepted"?"You accepted this request. Coordinate with the recipient and hospital before arranging any donation.":r.status==="Declined"?"You declined this request. No further action is needed.":"This request is marked as completed."}</div>`;
  $("acceptDetailBtn").classList.toggle("hidden",r.status!=="Pending");
  $("declineDetailBtn").classList.toggle("hidden",r.status!=="Pending");
  $("completeBtn").classList.toggle("hidden",r.status!=="Accepted");
  $("detailsModal").classList.remove("hidden");document.body.style.overflow="hidden";
}
function closeModal(id){$(id).classList.add("hidden");document.body.style.overflow="";}
function updateStatus(id,status){
  const rows=readRequests(),r=rows.find(x=>x.id===id);if(!r)return;
  if(status==="Accepted" && !$("availabilityToggle").checked){toast("Turn on your availability before accepting a request.");return;}
  r.status=status;r.updatedAt=new Date().toISOString();saveRequests(rows);
  closeModal("detailsModal");renderRequests();
  toast(status==="Accepted"?"Request accepted. Coordinate through the hospital.":status==="Declined"?"Request declined.":"Donation marked as completed.");
}
document.querySelectorAll(".tab").forEach(tab=>tab.addEventListener("click",()=>{activeFilter=tab.dataset.filter;renderRequests();}));
$("searchInput").addEventListener("input",renderRequests);
$("sortSelect").addEventListener("change",renderRequests);
$("clearFilters").addEventListener("click",()=>{$("searchInput").value="";activeFilter="All";renderRequests();});
$("requestList").addEventListener("click",e=>{
  const details=e.target.closest("[data-details]"),accept=e.target.closest("[data-accept]"),decline=e.target.closest("[data-decline]"),complete=e.target.closest("[data-complete]");
  if(details)openDetails(details.dataset.details);
  if(accept)updateStatus(accept.dataset.accept,"Accepted");
  if(decline)updateStatus(decline.dataset.decline,"Declined");
  if(complete)updateStatus(complete.dataset.complete,"Completed");
});
$("acceptDetailBtn").addEventListener("click",()=>selectedRequestId&&updateStatus(selectedRequestId,"Accepted"));
$("declineDetailBtn").addEventListener("click",()=>selectedRequestId&&updateStatus(selectedRequestId,"Declined"));
$("completeBtn").addEventListener("click",()=>selectedRequestId&&updateStatus(selectedRequestId,"Completed"));
document.querySelectorAll("[data-close]").forEach(btn=>btn.addEventListener("click",()=>closeModal(btn.dataset.close)));
$("detailsModal").addEventListener("click",e=>{if(e.target===$("detailsModal"))closeModal("detailsModal");});
document.addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll(".modal-backdrop:not(.hidden)").forEach(m=>closeModal(m.id));});
const savedAvailability=localStorage.getItem(AVAILABILITY_KEY);
if(savedAvailability!==null)$("availabilityToggle").checked=savedAvailability==="true";
function renderAvailability(){
  const available=$("availabilityToggle").checked;
  localStorage.setItem(AVAILABILITY_KEY,String(available));
  $("availabilityText").textContent=available?"Available to donate":"Not available right now";
  $("availabilityToggle").closest(".availability").classList.toggle("unavailable",!available);
}
$("availabilityToggle").addEventListener("change",()=>{renderAvailability();toast($("availabilityToggle").checked?"Your status is now available.":"Your status is now unavailable.");});
renderAvailability();
renderRequests();
