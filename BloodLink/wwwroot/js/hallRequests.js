const $ = id => document.getElementById(id);
const STORAGE_KEY = "mubadartiHallRequests";
let activeFilter = "All";
let selectedRequestId = null;

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[c]));
const money = value => `${Number(value || 0).toLocaleString()} JOD`;
const dateLabel = value => {
  if (!value) return "Not provided";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? String(value) :
    date.toLocaleDateString(undefined, {year:"numeric", month:"short", day:"numeric"});
};
function readRequests() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}
function statusClass(status) {
  return ({ "Pending approval":"pending", "Approved":"approved", "Paid":"paid", "Rejected":"rejected" })[status] || "pending";
}
function statusLabel(status) {
  return ({
    "Pending approval":"Pending review",
    "Approved":"Approved — payment available",
    "Paid":"Booking confirmed",
    "Rejected":"Request rejected"
  })[status] || "Pending review";
}
function nextStep(status) {
  return ({
    "Pending approval":"Your request is waiting for the venue provider to review it.",
    "Approved":"Next step: complete payment to confirm your booking.",
    "Paid":"Your booking is confirmed. Keep your request ID for reference.",
    "Rejected":"This request was rejected. Contact the venue provider if you need clarification."
  })[status] || "Check back later for updates.";
}
function renderSummary(rows) {
  $("totalCount").textContent = rows.length;
  $("pendingCount").textContent = rows.filter(r => r.status === "Pending approval").length;
  $("approvedCount").textContent = rows.filter(r => r.status === "Approved").length;
  $("paidCount").textContent = rows.filter(r => r.status === "Paid").length;
  $("allTabCount").textContent = rows.length;
  document.querySelectorAll(".tab[data-filter]").forEach(tab => {
    const filter = tab.dataset.filter;
    let badge = tab.querySelector(".tab-count");
    const count = filter === "All" ? rows.length : rows.filter(r => r.status === filter).length;
    if (filter !== "All" && !badge) {
      badge = document.createElement("span"); badge.className = "tab-count"; tab.appendChild(badge);
    }
    if (filter !== "All" && badge) badge.textContent = count;
  });
}
function renderRequests() {
  const all = readRequests();
  renderSummary(all);
  const query = $("searchInput").value.trim().toLowerCase();
  let rows = all.filter(r =>
    (activeFilter === "All" || r.status === activeFilter) &&
    (!query || [r.hallName, r.id, r.organization, r.eventType, r.governorate]
      .some(v => String(v || "").toLowerCase().includes(query)))
  );
  const sort = $("sortSelect").value;
  rows.sort((a,b) => {
    if (sort === "oldest") return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    if (sort === "eventDate") return String(a.eventDate || "").localeCompare(String(b.eventDate || ""));
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
  $("visibleCount").textContent = rows.length;
  $("requestList").innerHTML = rows.map((r, index) => `
    <article class="request-card" style="--item-index:${index}">
      <div class="request-main">
        <div class="request-avatar" aria-hidden="true">▦</div>
        <div class="request-info">
          <div class="request-title-row"><h3>${esc(r.hallName || "Hall booking")}</h3><span class="blood-tag">${esc(r.eventType || "Event")}</span></div>
          <p>Request ID: ${esc(r.id || "—")} · Submitted ${esc(r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "date unavailable")}</p>
          <div class="request-meta">
            <span>▦ <b>${esc(dateLabel(r.eventDate))}</b></span>
            <span>⌖ ${esc(r.governorate || "Location not provided")}</span>
            <span>♙ <b>${esc(r.attendees ?? "—")}</b> attendees</span>
            <span>▣ <b>${esc(money(r.price))}</b></span>
          </div>
        </div>
      </div>
      <div class="request-side">
        <span class="status ${statusClass(r.status)}">${esc(statusLabel(r.status))}</span>
        <div class="next-step">${esc(nextStep(r.status))}</div>
        <div class="request-actions"><button class="small-btn" type="button" data-details="${esc(r.id)}">View details ↗</button></div>
      </div>
    </article>`).join("");
  $("emptyState").classList.toggle("hidden", rows.length > 0);
  $("requestList").classList.toggle("hidden", rows.length === 0);
  $("emptyTitle").textContent = all.length ? "No matching requests" : "No hall requests yet";
  $("emptyMessage").textContent = all.length
    ? "Try another status filter or search term."
    : "Once you submit a hall booking request, its status and details will appear here.";
  document.querySelectorAll(".tab[data-filter]").forEach(tab =>
    tab.classList.toggle("active", tab.dataset.filter === activeFilter));
}
function openDetails(id) {
  const r = readRequests().find(item => String(item.id) === String(id));
  if (!r) return;
  selectedRequestId = id;
  $("detailsTitle").textContent = r.hallName || "Hall booking request";
  const fields = [
    ["Request ID", r.id], ["Status", statusLabel(r.status)], ["Event date", dateLabel(r.eventDate)],
    ["Event type", r.eventType], ["Organization / initiative", r.organization],
    ["Contact person", r.contactName], ["Email", r.email], ["Phone", r.phone],
    ["Expected attendees", r.attendees], ["Event time", r.eventTime],
    ["Governorate", r.governorate], ["Booking fee", money(r.price)]
  ];
  $("detailsContent").innerHTML = `
    <div class="detail-grid">${fields.map(([label,value]) =>
      `<div class="detail-item"><small>${esc(label)}</small><b>${esc(value ?? "—")}</b></div>`
    ).join("")}</div>
    <div class="detail-note"><b>Next step</b><br>${esc(nextStep(r.status))}
    <br><br><b>Event description</b><br>${esc(r.description || "No description provided.")}
    <br><br><b>Documents submitted</b><br>${Array.isArray(r.documents) && r.documents.length
      ? r.documents.map(doc => `${esc(doc.label)} — ${esc(doc.fileName)}`).join("<br>")
      : "No document details saved."}</div>`;
  $("paymentLink").classList.toggle("hidden", r.status !== "Approved");
  $("detailsModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeModal(id) {
  $(id).classList.add("hidden");
  document.body.style.overflow = "";
}
document.querySelectorAll(".tab[data-filter]").forEach(tab => tab.addEventListener("click", () => {
  activeFilter = tab.dataset.filter; renderRequests();
}));
$("searchInput").addEventListener("input", renderRequests);
$("sortSelect").addEventListener("change", renderRequests);
$("requestList").addEventListener("click", event => {
  const button = event.target.closest("[data-details]");
  if (button) openDetails(button.dataset.details);
});
document.querySelectorAll("[data-close]").forEach(button =>
  button.addEventListener("click", () => closeModal(button.dataset.close)));
$("detailsModal").addEventListener("click", event => {
  if (event.target === $("detailsModal")) closeModal("detailsModal");
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") document.querySelectorAll(".modal-backdrop:not(.hidden)").forEach(m => closeModal(m.id));
});
window.addEventListener("storage", event => {
  if (event.key === STORAGE_KEY || event.key === null) renderRequests();
});
window.addEventListener("focus", renderRequests);
renderRequests();
