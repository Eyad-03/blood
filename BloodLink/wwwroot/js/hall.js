const halls = [
 {id:1,name:"University of Jordan Conference Hall",governorate:"Amman",entity:"University",events:["Conference","Workshop","Training"],capacity:250,price:180,rating:4.9,tag:"Popular choice",tagClass:"",location:"Jubeiha, Amman",image:"https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=900&q=80",description:"A modern venue equipped for conferences, seminars, and academic events.",features:["Presentation screen","Sound system","Parking"]},
 {id:2,name:"Zaha Cultural Center",governorate:"Amman",entity:"Community center",events:["Initiative","Workshop","Training"],capacity:120,price:95,rating:4.8,tag:"Great for initiatives",tagClass:"green",location:"Khalda, Amman",image:"https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80",description:"A flexible space for community activities, training, and workshops.",features:["Wi-Fi","Equipment","Parking"]},
 {id:3,name:"Aqaba Grand Hall",governorate:"Aqaba",entity:"Private institution",events:["Conference","Initiative"],capacity:400,price:260,rating:4.7,tag:"Large capacity",tagClass:"green",location:"Aqaba city center",image:"https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=900&q=80",description:"A spacious hall with lighting and facilities for large events.",features:["Stage","Professional audio","Parking"]},
 {id:4,name:"Irbid Innovation Center",governorate:"Irbid",entity:"Government institution",events:["Initiative","Workshop","Training"],capacity:90,price:70,rating:4.8,tag:"Budget friendly",tagClass:"green",location:"University Street, Irbid",image:"https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&w=900&q=80",description:"A practical venue for youth initiatives and small community gatherings.",features:["Wi-Fi","Whiteboard","Parking"]},
 {id:5,name:"Greater Irbid Municipality Hall",governorate:"Irbid",entity:"Government institution",events:["Conference","Initiative"],capacity:180,price:130,rating:4.6,tag:"Available to book",tagClass:"green",location:"Downtown, Irbid",image:"https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=900&q=80",description:"A multi-purpose hall for public meetings and local events.",features:["Presentation screen","Sound system","Seating"]},
 {id:6,name:"King Abdullah II Community Center",governorate:"Zarqa",entity:"Community center",events:["Workshop","Training","Initiative"],capacity:70,price:55,rating:4.5,tag:"Affordable",tagClass:"amber",location:"New Zarqa, Zarqa",image:"https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=900&q=80",description:"A comfortable venue for short courses, workshops, and volunteer activities.",features:["Wi-Fi","Presentation setup","Seating"]}
];
const $ = id => document.getElementById(id);
const STORAGE_KEY = "mubadartiHallRequests";
let selectedPaymentRequest = null;

function readRequests(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]")}catch{return []}}
function saveRequests(rows){localStorage.setItem(STORAGE_KEY,JSON.stringify(rows))}
function money(value){return `${value} JOD`}
function esc(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function showToast(message){$("toast").textContent=message;$("toast").classList.add("show");clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>$("toast").classList.remove("show"),3200)}
function renderHalls(){
 let rows=[...halls];
 const q=$("searchInput").value.trim().toLowerCase(),gov=$("governorateFilter").value,entity=$("entityFilter").value,event=$("eventFilter").value,capacity=Number($("capacityFilter").value||0);
 rows=rows.filter(h=>(!q||[h.name,h.location,h.governorate,h.entity].some(v=>v.toLowerCase().includes(q)))&&(!gov||h.governorate===gov)&&(!entity||h.entity===entity)&&(!event||h.events.includes(event))&&(!capacity||h.capacity>=capacity));
 const sort=$("sortFilter").value;if(sort==="priceLow")rows.sort((a,b)=>a.price-b.price);if(sort==="capacity")rows.sort((a,b)=>b.capacity-a.capacity);
 $("resultsCount").textContent=rows.length;
 $("hallGrid").innerHTML=rows.map(h=>`<article class="hall-card">
  <div class="hall-image"><img src="${h.image}" alt="${esc(h.name)}" loading="lazy"><span class="image-tag ${h.tagClass}">${esc(h.tag)}</span><button class="favorite" type="button" aria-label="Add to favorites" data-favorite="${h.id}">♡</button></div>
  <div class="hall-body"><div class="hall-title-row"><h3>${esc(h.name)}</h3><span class="rating">★ ${h.rating}</span></div>
  <div class="hall-location"><span>●</span>${esc(h.location)} · ${esc(h.entity)}</div><p class="hall-desc">${esc(h.description)}</p>
  <div class="hall-meta"><div class="meta-item"><span>♙</span><b>${h.capacity}</b><small>people</small></div><div class="meta-item"><span>▣</span><b>${h.events.map(esc).join(", ")}</b><small>event types</small></div><div class="meta-item"><span>✓</span><b>Equipment</b><small>${h.features[0]}</small></div></div>
  <div class="hall-footer"><div class="price"><b>${h.price}</b> <em>JOD</em><small>per event / day</small></div><button class="details-btn" type="button" data-details="${h.id}">Details</button><button class="book-btn" type="button" data-book="${h.id}">Book venue →</button></div></div></article>`).join("");
 $("noResults").classList.toggle("hidden",rows.length!==0);$("hallGrid").classList.toggle("hidden",rows.length===0);
}
function openModal(id){$(id).classList.remove("hidden");document.body.style.overflow="hidden"}
function closeModal(id){$(id).classList.add("hidden");if(document.querySelectorAll(".modal-backdrop:not(.hidden)").length===0)document.body.style.overflow=""}
function startBooking(id){const hall=halls.find(h=>h.id===Number(id));if(!hall)return;$("selectedHallId").value=hall.id;$("selectedHallName").textContent=`${hall.name} · ${hall.governorate} · ${money(hall.price)}`;const minDate=new Date();minDate.setDate(minDate.getDate()+1);$("bookingForm").elements.eventDate.min=minDate.toISOString().slice(0,10);openModal("bookingModal")}
function statusInfo(status){if(status==="Pending approval")return ["Pending approval",""];if(status==="Approved")return ["Approved","approved"];if(status==="Paid")return ["Paid · Booking confirmed","paid"];return ["Rejected","rejected"]}
function renderRequests(){
 const rows=readRequests();$("requestCount").textContent=rows.length;
 if(!rows.length){$("requestsList").innerHTML='<div class="empty-requests">No requests yet.<br>Your request will appear here after you choose a venue and submit the documents.</div>';return}
 $("requestsList").innerHTML=[...rows].reverse().map(r=>{const [label,cls]=statusInfo(r.status);return `<article class="request-card"><div><h3>${esc(r.hallName)}</h3><p>Request ID: ${esc(r.id)} · ${esc(r.eventDate)} · ${esc(r.organization)}</p><p style="margin-top:5px">Booking fee: ${money(r.price)}</p></div><span class="request-status ${cls}">${label}</span>${r.status==="Approved"?`<div class="request-actions"><button class="small-btn pay" data-pay="${esc(r.id)}">Pay and confirm booking</button></div>`:""}</article>`}).join("");
}
function openPayment(id){const r=readRequests().find(x=>x.id===id);if(!r||r.status!=="Approved")return;selectedPaymentRequest=id;$("paymentHallName").textContent=r.hallName;$("paymentAmount").textContent=money(r.price);openModal("paymentModal")}
$("searchInput").addEventListener("input",renderHalls);
["governorateFilter","entityFilter","eventFilter","capacityFilter","sortFilter"].forEach(id=>$(id).addEventListener("change",renderHalls));
function resetFilters(){["searchInput","governorateFilter","entityFilter","eventFilter","capacityFilter"].forEach(id=>$(id).value="");$("sortFilter").value="recommended";renderHalls()}
$("resetFilters").addEventListener("click",resetFilters);$("resetEmpty").addEventListener("click",resetFilters);
$("hallGrid").addEventListener("click",e=>{
 const book=e.target.closest("[data-book]"),details=e.target.closest("[data-details]"),fav=e.target.closest("[data-favorite]");
 if(book)startBooking(book.dataset.book);
 if(details){const h=halls.find(x=>x.id===Number(details.dataset.details));if(h)showToast(`${h.name} — ${h.capacity} people — ${money(h.price)} — ${h.features.join(", ")}`)}
 if(fav){fav.classList.toggle("selected");fav.textContent=fav.classList.contains("selected")?"♥":"♡"}
});
document.querySelectorAll("[data-close]").forEach(btn=>btn.addEventListener("click",()=>closeModal(btn.dataset.close)));
document.querySelectorAll(".modal-backdrop").forEach(backdrop=>backdrop.addEventListener("click",e=>{if(e.target===backdrop)closeModal(backdrop.id)}));
document.addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll(".modal-backdrop:not(.hidden)").forEach(m=>closeModal(m.id))});
document.querySelectorAll('input[type="file"]').forEach(input=>input.addEventListener("change",()=>{const name=input.parentElement.querySelector(".file-name");if(name)name.textContent=input.files[0]?.name||"Choose a file"}));
$("bookingForm").addEventListener("submit",e=>{
 e.preventDefault();const form=e.currentTarget;if(!form.reportValidity())return;
 const fd=new FormData(form);const fileInputs=[...form.querySelectorAll('input[type="file"]')];
 for(const input of fileInputs){const file=input.files[0];if(!file){showToast("Please attach all required documents.");return}if(file.size>10*1024*1024){showToast(`File ${file.name} is larger than 10MB.`);return}}
 const hall=halls.find(h=>h.id===Number($("selectedHallId").value));const rows=readRequests();
 const request={id:`HB-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,hallId:hall.id,hallName:hall.name,governorate:hall.governorate,price:hall.price,organization:fd.get("organization"),contactName:fd.get("contactName"),email:fd.get("email"),phone:fd.get("phone"),eventType:fd.get("eventType"),eventDate:fd.get("eventDate"),attendees:Number(fd.get("attendees")),eventTime:fd.get("eventTime"),description:fd.get("description"),documents:fileInputs.map(i=>({label:i.parentElement.querySelector("b").textContent,fileName:i.files[0].name})),status:"Pending approval",createdAt:new Date().toISOString()};
 rows.push(request);saveRequests(rows);form.reset();document.querySelectorAll(".file-name").forEach(el=>el.textContent="Choose a file");closeModal("bookingModal");renderRequests();showToast("Your request has been submitted. Your documents will be reviewed before payment is enabled.");openModal("requestsModal");
});
$("myBookingsBtn").addEventListener("click",()=>{renderRequests();openModal("requestsModal")});
$("requestsList").addEventListener("click",e=>{const pay=e.target.closest("[data-pay]");if(pay)openPayment(pay.dataset.pay)});
$("confirmPayment").addEventListener("click",()=>{
 if(!selectedPaymentRequest)return;const rows=readRequests(),r=rows.find(x=>x.id===selectedPaymentRequest);if(!r||r.status!=="Approved")return;
 r.status="Paid";r.paymentMethod=document.querySelector('input[name="paymentMethod"]:checked')?.value||"Bank card";r.paidAt=new Date().toISOString();saveRequests(rows);closeModal("paymentModal");renderRequests();showToast("Demo payment recorded and booking confirmed.");
});
renderHalls();renderRequests();
