const $ = id => document.getElementById(id);
const STORAGE_KEY = "bloodlinkRecipientRequests";

const demoRequests = [
  {id:"BR-2026-0184", donorName:"Lina Khalil", donorInitials:"LK", bloodType:"O−", location:"University Street, Irbid", distance:"2.4 km away", sentAt:"Today, 10:42 AM", dateValue:"2026-10-10T10:42:00", status:"Pending", message:"Urgently need O− blood for a family member.", donorPhone:"", donorEmail:"lina@example.com"},
  {id:"BR-2026-0179", donorName:"Omar Haddad", donorInitials:"OH", bloodType:"A+", location:"Downtown, Irbid", distance:"3.1 km away", sentAt:"Yesterday, 4:15 PM", dateValue:"2026-10-09T16:15:00", status:"Accepted", message:"Thank you for offering to help. Please coordinate with the hospital.", donorPhone:"+962 7 9000 1234", donorEmail:"omar@example.com"},
];
let activeFilter = "All";
let selectedRequestId = null;

function escapeHTML(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function readRequests(){
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if(stored !== null) return JSON.parse(stored);
    localStorage.setItem(STORAGE_KEY,JSON.stringify(demoRequests));
    return [...demoRequests];
  } catch { return [...demoRequests]; }
}
function saveRequests(rows){localStorage.setItem(STORAGE_KEY,JSON.stringify(rows));}
function statusClass(status){return ({Pending:"pending",Accepted:"accepted",Declined:"declined",Completed:"completed"})[status]||"pending";}
function statusLabel(status){return ({Pending:"Waiting for response",Accepted:"Request accepted",Declined:"Request declined",Completed:"Donation completed"})[status]||status;}
function formatBloodType(type){return escapeHTML(type);}
function renderSummary(rows){
  $("totalCount").textContent=rows.length;
  $("pendingCount").textContent=rows.filter(r=>r.status==="Pending").length;
  $("acceptedCount").textContent=rows.filter(r=>r.status==="Accepted").length;
  $("completedCount").textContent=rows.filter(r=>r.status==="Completed").length;
  $("allTabCount").textContent=rows.length;
}
function renderRequests(){
  const all=readRequests();
  renderSummary(all);
  const query=$("searchInput").value.trim().toLowerCase();
  let rows=all.filter(r=>(activeFilter==="All"||r.status===activeFilter)&&(!query||[r.donorName,r.id,r.location,r.bloodType].some(v=>String(v||"").toLowerCase().includes(query))));
  rows.sort((a,b)=>$("sortSelect").value==="newest"?new Date(b.dateValue)-new Date(a.dateValue):new Date(a.dateValue)-new Date(b.dateValue));
  $("visibleCount").textContent=rows.length;
  $("requestList").innerHTML=rows.map(r=>`
    <article class="request-card">
      <div class="request-main">
        <div class="donor-avatar">${escapeHTML(r.donorInitials||r.donorName.split(" ").map(n=>n[0]).join("").slice(0,2))}</div>
        <div class="request-info">
          <div class="request-title-row"><h3>${escapeHTML(r.donorName)}</h3><span class="blood-tag">${formatBloodType(r.bloodType)}</span></div>
          <p>Request ID: ${escapeHTML(r.id)} · Sent ${escapeHTML(r.sentAt)}</p>
          <div class="request-meta"><span>⌖ ${escapeHTML(r.location)}</span><span>↗ <b>${escapeHTML(r.distance||"Location shared")}</b></span><span>▣ ${escapeHTML(r.id)}</span></div>
        </div>
      </div>
      <div class="request-side">
        <span class="status ${statusClass(r.status)}">${statusLabel(r.status)}</span>
        <div class="request-actions"><button class="small-btn" data-details="${escapeHTML(r.id)}">View details</button>${r.status==="Accepted"?`<button class="small-btn contact" data-contact="${escapeHTML(r.id)}">Contact donor</button>`:""}</div>
      </div>
    </article>`).join("");
  $("emptyState").classList.toggle("hidden",rows.length>0);
  $("requestList").classList.toggle("hidden",rows.length===0);
  document.querySelectorAll(".tab").forEach(tab=>tab.classList.toggle("active",tab.dataset.filter===activeFilter));
}
function showToast(message){$("toast").textContent=message;$("toast").classList.add("show");clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>$("toast").classList.remove("show"),3000);}
function openDetails(id){
  const r=readRequests().find(x=>x.id===id);if(!r)return;selectedRequestId=id;
  $("detailsTitle").textContent=`Request ${r.id}`;
  const fields=[["Donor",r.donorName],["Blood type",r.bloodType],["Request status",statusLabel(r.status)],["Location",r.location],["Distance",r.distance||"Not available"],["Date sent",r.sentAt],["Recipient message",r.message||"No message added"]];
  $("detailsContent").innerHTML=`<div class="detail-grid">${fields.map(([label,value])=>`<div class="detail-item"><small>${escapeHTML(label)}</small><b>${escapeHTML(value)}</b></div>`).join("")}</div><div class="detail-note">${r.status==="Pending"?"Your request has been sent. The donor has not responded yet. You can wait for their reply or send requests to other available donors.":r.status==="Accepted"?"The donor accepted your request. Contact them to coordinate safely through the hospital. Do not treat acceptance as confirmation that a donation has taken place.":r.status==="Declined"?"The donor declined this request. You can return to the donor map and contact another eligible donor.":"This request has been marked as completed. Follow up with the medical facility for official documentation."}</div>`;
  $("completeBtn").classList.toggle("hidden",r.status!=="Accepted");
  $("completeBtn").textContent="Mark donation as completed";
  $("detailsModal").classList.remove("hidden");document.body.style.overflow="hidden";
}

function openContact(id){
  const r=readRequests().find(x=>x.id===id);
  if(!r)return;
  if(r.status!=="Accepted"){showToast("Contact details are available after the donor accepts your request.");return;}
  $("contactAvatar").textContent=r.donorInitials||r.donorName.split(" ").map(n=>n[0]).join("").slice(0,2);
  $("contactTitle").textContent=r.donorName;
  $("contactSubtitle").textContent="The donor accepted your request. You can use the details below to coordinate safely.";
  $("contactEmail").textContent=r.donorEmail||"Not provided";
  $("contactPhone").textContent=r.donorPhone||"Not provided";
  $("contactLocation").textContent=r.location||"Not provided";
  const emailBtn=$("emailDonorBtn"), callBtn=$("callDonorBtn");
  if(r.donorEmail){
    emailBtn.href="mailto:"+r.donorEmail+"?subject="+encodeURIComponent("Blood donation request "+r.id);
    emailBtn.classList.remove("hidden");
  } else {emailBtn.removeAttribute("href");emailBtn.classList.add("hidden");}
  if(r.donorPhone){
    callBtn.href="tel:"+r.donorPhone.replace(/[^\d+]/g,"");
    callBtn.classList.remove("hidden");
  } else {callBtn.removeAttribute("href");callBtn.classList.add("hidden");}
  $("contactModal").classList.remove("hidden");
  document.body.style.overflow="hidden";
}
document.querySelectorAll("[data-copy]").forEach(btn=>btn.addEventListener("click",async()=>{
  const value=$(btn.dataset.copy).textContent;
  if(!value||value==="Not provided"||value==="—"){showToast("This contact detail is not available.");return;}
  try{
    await navigator.clipboard.writeText(value);
    showToast("Copied to clipboard.");
  }catch{
    const temp=document.createElement("textarea");temp.value=value;document.body.appendChild(temp);temp.select();
    const copied=document.execCommand("copy");temp.remove();
    showToast(copied?"Copied to clipboard.":"Unable to copy this detail.");
  }
}));

function closeModal(id){$(id).classList.add("hidden");document.body.style.overflow="";}
document.querySelectorAll(".tab").forEach(tab=>tab.addEventListener("click",()=>{activeFilter=tab.dataset.filter;renderRequests();}));
$("searchInput").addEventListener("input",renderRequests);
$("sortSelect").addEventListener("change",renderRequests);
$("clearFilters").addEventListener("click",()=>{$("searchInput").value="";activeFilter="All";renderRequests();});
$("requestList").addEventListener("click",e=>{
 const details=e.target.closest("[data-details]"),contact=e.target.closest("[data-contact]");
 if(details)openDetails(details.dataset.details);
 if(contact){openContact(contact.dataset.contact);}
});
$("completeBtn").addEventListener("click",()=>{
 const rows=readRequests(),r=rows.find(x=>x.id===selectedRequestId);if(!r||r.status!=="Accepted")return;
 r.status="Completed";r.completedAt=new Date().toISOString();saveRequests(rows);closeModal("detailsModal");renderRequests();showToast("Request marked as completed.");
});
document.querySelectorAll("[data-close]").forEach(btn=>btn.addEventListener("click",()=>closeModal(btn.dataset.close)));
$("detailsModal").addEventListener("click",e=>{if(e.target===$("detailsModal"))closeModal("detailsModal");});
document.addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll(".modal-backdrop:not(.hidden)").forEach(m=>closeModal(m.id));});
$("findDonorsBtn").addEventListener("click",e=>{e.preventDefault();showToast("Connect this button to your donorSearch.html page.");});
$("emergencyInfo").addEventListener("click",e=>{e.preventDefault();showToast("For emergencies, contact your hospital or local emergency services immediately.");});
renderRequests();
