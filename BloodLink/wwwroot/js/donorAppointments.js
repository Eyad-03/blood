/* =====================================================================
   BloodLink — Donation appointments (donor side)
   Donor books a visit, answers a quick eligibility check, and the hospital
   approves it with a confirmed date and time (/Hospital → Appointments).
   Shared storage key: bloodlinkDonationAppointments
   ===================================================================== */
const $ = id => document.getElementById(id);
const KEY = "bloodlinkDonationAppointments";
const DEVICE_KEY = "bloodlinkDeviceId";
const DRAFT_KEY = "bloodlinkDonorProfileDraft";
const MIN_WEIGHT = 50, MIN_AGE = 18, MAX_AGE = 65, WAIT_DAYS = 56, BOOK_AHEAD_DAYS = 60;

/* Verified facilities (same organizations as the admin console). */
const FACILITIES = [
  { id: "ORG-1031", name: "Al Hayat Hospital", type: "Hospital", city: "Irbid", address: "University Street, Irbid", open: "08:00", close: "16:00" },
  { id: "ORG-1026", name: "Jerash Family Hospital", type: "Hospital", city: "Jerash", address: "Amman–Jerash Road, Jerash", open: "08:00", close: "15:00" },
  { id: "ORG-1028", name: "Aqaba Red Crescent Center", type: "Blood donation center", city: "Aqaba", address: "Aqaba city center", open: "09:00", close: "15:00" }
];
const facilityById = id => FACILITIES.find(f => f.id === id);

/* ---------- storage ---------- */
const read = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb } catch { return fb } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { } };
function deviceId() {
  let id = ""; try { id = localStorage.getItem(DEVICE_KEY) || "" } catch { }
  if (!id) { id = "D-" + Math.random().toString(36).slice(2, 10).toUpperCase(); try { localStorage.setItem(DEVICE_KEY, id) } catch { } }
  return id;
}
const ME = deviceId();
let all = read(KEY, []);
const mine = () => all.filter(a => a.ownerId === ME).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
const saveAll = () => write(KEY, all);

/* ---------- helpers ---------- */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => ymd(new Date());
const parseDay = s => new Date(s + "T12:00:00");
const addDays = (s, n) => { const d = parseDay(s); d.setDate(d.getDate() + n); return ymd(d) };
const fmtDate = (s, long) => { if (!s) return "—"; const d = parseDay(s); return Number.isNaN(d.getTime()) ? esc(s) : d.toLocaleDateString("en-GB", long ? { weekday: "long", day: "numeric", month: "long", year: "numeric" } : { weekday: "short", day: "numeric", month: "short", year: "numeric" }) };
const fmtTime = t => { if (!/^\d{2}:\d{2}$/.test(t || "")) return "—"; const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${pad(m)} ${h < 12 ? "AM" : "PM"}` };
const isFriday = s => parseDay(s).getDay() === 5;
let toastTimer;
function toast(msg) { const el = $("toast"); el.textContent = msg; el.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3800) }
const STATUS = { Pending: ["pending", "Awaiting approval"], Approved: ["accepted", "Confirmed"], Declined: ["declined", "Declined"], Completed: ["completed", "Completed"], Cancelled: ["cancelled", "Cancelled"] };

/* ---------- form state ---------- */
const form = $("bookingForm");
let facilityId = "";
const val = n => (form.elements[n]?.value ?? "").trim();
const radio = n => form.querySelector(`input[name="${n}"]:checked`)?.value || "";

function renderFacilities() {
  $("facilityList").innerHTML = FACILITIES.map(f => `<label class="ap-fac${f.id === facilityId ? " selected" : ""}">
    <input type="radio" name="facility" value="${f.id}"${f.id === facilityId ? " checked" : ""}>
    <span class="ap-fac-icon">${f.type === "Hospital" ? "✚" : "♥"}</span>
    <span class="ap-fac-text"><b>${esc(f.name)}</b><small>${esc(f.type)} · ${esc(f.city)}</small><small>${esc(f.address)}</small><em>Sun–Thu · ${fmtTime(f.open)} – ${fmtTime(f.close)}</em></span>
    <span class="ap-fac-tick" aria-hidden="true">✓</span></label>`).join("");
}
function renderTimes() {
  const sel = $("apTime"), keep = sel.value, f = facilityById(facilityId) || FACILITIES[0];
  const [oh, om] = f.open.split(":").map(Number), [ch, cm] = f.close.split(":").map(Number);
  let mins = oh * 60 + om; const end = ch * 60 + cm - 30, opts = ['<option value="">Select a time</option>'];
  for (; mins <= end; mins += 30) { const t = `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`; opts.push(`<option value="${t}">${fmtTime(t)}</option>`) }
  sel.innerHTML = opts.join("");
  if ([...sel.options].some(o => o.value === keep)) sel.value = keep;
}
function dateRange() { const min = addDays(todayStr(), 1); return { min, max: addDays(todayStr(), BOOK_AHEAD_DAYS) } }
function dateProblem(d) {
  const { min, max } = dateRange();
  if (!d) return "";
  if (d < min) return "Choose a date from tomorrow onwards.";
  if (d > max) return `Appointments can be booked up to ${BOOK_AHEAD_DAYS} days ahead.`;
  if (isFriday(d)) return "Centers are closed on Fridays. Please pick another day.";
  return "";
}
function updateDateHint() {
  const { min, max } = dateRange(), d = val("date"), p = dateProblem(d), el = $("dateHint");
  el.textContent = p || `Open Sunday to Thursday. Choose a date between ${fmtDate(min)} and ${fmtDate(max)}.`;
  el.classList.toggle("bad", !!p);
}

/* ---------- eligibility ---------- */
function evaluate() {
  const age = Number(val("age")), weight = Number(val("weight")), last = val("lastDonation"), appt = val("date");
  const blockers = [], flags = [];
  if (val("age") !== "") {
    if (age < MIN_AGE) blockers.push(`Donors must be at least ${MIN_AGE} years old.`);
    else if (age > MAX_AGE) blockers.push(`First-time donation is not allowed after ${MAX_AGE}. Please ask the center.`);
  }
  if (val("weight") !== "" && weight < MIN_WEIGHT) blockers.push(`Donors must weigh at least ${MIN_WEIGHT} kg.`);
  if (last) {
    const t = todayStr();
    if (last > t) blockers.push("Your last donation date can't be in the future.");
    else {
      const from = addDays(last, WAIT_DAYS);
      if (from > t) blockers.push(`You donated recently. You can donate again from ${fmtDate(from)} (${WAIT_DAYS} days after your last donation).`);
      else if (appt && appt < from) blockers.push(`Choose a date on or after ${fmtDate(from)}.`);
    }
  }
  if (radio("well") === "no") flags.push("Not feeling well today");
  if (radio("meds") === "yes") flags.push("Takes medication" + (val("medsDetail") ? `: ${val("medsDetail")}` : ""));
  if (radio("travel") === "yes") flags.push("Travelled abroad in the last 3 months" + (val("travelDetail") ? `: ${val("travelDetail")}` : ""));
  if (radio("procedure") === "yes") flags.push("Tattoo, piercing, surgery or dental work in the last 6 months");
  const answered = val("age") !== "" && val("weight") !== "" && ["well", "meds", "travel", "procedure"].every(radio);
  let state = "idle";
  if (blockers.length) state = "blocked"; else if (answered) state = flags.length ? "review" : "ok";
  return { state, blockers, flags, answered };
}
const ELIG_LABEL = { idle: "Not checked yet", ok: "Looks eligible", review: "Needs hospital review", blocked: "Not eligible right now" };
function renderEligibility() {
  const e = evaluate();
  const chip = $("eligChip"); chip.dataset.state = e.state; chip.textContent = ELIG_LABEL[e.state];
  const out = [];
  e.blockers.forEach(b => out.push(`<li class="bad">${esc(b)}</li>`));
  e.flags.forEach(f => out.push(`<li class="warn">${esc(f)}</li>`));
  let head = "";
  if (e.state === "ok") head = "<b>Great, you look eligible.</b><p>The center will still confirm on the day.</p>";
  else if (e.state === "review") head = "<b>You can still book.</b><p>The hospital will review these answers before approving your time:</p>";
  else if (e.state === "blocked") head = "<b>You can't book right now.</b><p>Please check the following:</p>";
  else head = "<p>Answer all questions to see if you can book.</p>";
  const box = $("eligResult"); box.dataset.state = e.state;
  box.innerHTML = head + (out.length ? `<ul>${out.join("")}</ul>` : "");
  $("submitBtn").disabled = e.state === "blocked";
  $("submitBtn").title = e.state === "blocked" ? "Fix the eligibility issues first" : "";
  return e;
}

/* ---------- submit ---------- */
function nextId() {
  const nums = all.map(a => Number(String(a.id).split("-").pop()) || 0);
  return `AP-${new Date().getFullYear()}-${String(Math.max(20, ...nums) + 1).padStart(3, "0")}`;
}
function fail(msg, el) {
  const box = $("formError"); box.textContent = msg; box.hidden = false;
  box.scrollIntoView({ behavior: "smooth", block: "center" });
  el?.focus?.({ preventScroll: true });
}
function submitBooking(ev) {
  ev.preventDefault();
  $("formError").hidden = true;
  const f = facilityById(facilityId);
  if (!f) return fail("Please choose a hospital or donation center.");
  if (!val("name")) return fail("Please enter your full name.", form.elements.name);
  if (!/^[+\d][\d\s-]{6,}$/.test(val("phone"))) return fail("Please enter a valid phone number.", form.elements.phone);
  if (val("email") && !/^\S+@\S+\.\S+$/.test(val("email"))) return fail("Please enter a valid email address.", form.elements.email);
  if (!val("type")) return fail("Please select your blood type.", form.elements.type);
  if (!val("date")) return fail("Please choose your preferred date.", form.elements.date);
  const dp = dateProblem(val("date")); if (dp) return fail(dp, form.elements.date);
  if (!val("time")) return fail("Please choose your preferred time.", form.elements.time);
  const e = evaluate();
  if (e.blockers.length) return fail(e.blockers[0]);
  if (!e.answered) return fail("Please answer every eligibility question.");
  if (!form.elements.consent.checked) return fail("Please confirm that your answers are true.", form.elements.consent);
  const now = new Date().toISOString();
  const rec = {
    id: nextId(), ownerId: ME, facilityId: f.id, facilityName: f.name, facilityType: f.type, facilityCity: f.city,
    donor: { name: val("name"), phone: val("phone"), email: val("email"), type: val("type") },
    requestedDate: val("date"), requestedTime: val("time"), notes: val("notes"),
    eligibility: {
      age: Number(val("age")), weight: Number(val("weight")), lastDonation: val("lastDonation"),
      well: radio("well"), meds: radio("meds"), medsDetail: val("medsDetail"), travel: radio("travel"), travelDetail: val("travelDetail"), procedure: radio("procedure"),
      state: e.state, flags: e.flags
    },
    status: "Pending", confirmedDate: "", confirmedTime: "", hospitalNote: "", declineReason: "", donorNotified: true, createdAt: now, updatedAt: now
  };
  all.unshift(rec); saveAll();
  write(DRAFT_KEY, { name: rec.donor.name, phone: rec.donor.phone, email: rec.donor.email, type: rec.donor.type, age: rec.eligibility.age, weight: rec.eligibility.weight, lastDonation: rec.eligibility.lastDonation });
  resetFormAfterSubmit();
  render();
  toast(`Request ${rec.id} sent to ${f.name}. You'll see the confirmed time here.`);
  setTimeout(() => $("myAppointments").scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  setTimeout(() => document.querySelector(`[data-ap="${CSS.escape(rec.id)}"]`)?.classList.add("flash"), 400);
}
function resetFormAfterSubmit() {
  form.reset(); facilityId = ""; renderFacilities(); renderTimes();
  document.querySelectorAll(".ap-follow").forEach(i => i.hidden = true);
  applyDraft(); updateDateHint(); renderEligibility();
}
function applyDraft() {
  const d = read(DRAFT_KEY, null); if (!d) return;
  ["name", "phone", "email", "type", "age", "weight", "lastDonation"].forEach(k => { if (d[k] !== undefined && form.elements[k]) form.elements[k].value = d[k] });
}

/* ---------- list ---------- */
function calendarLink(a) {
  const d = (a.confirmedDate || "").replace(/-/g, ""), t = (a.confirmedTime || "").replace(":", "");
  const end = (() => { const [h, m] = a.confirmedTime.split(":").map(Number), x = h * 60 + m + 45; return `${pad(Math.floor(x / 60) % 24)}${pad(x % 60)}` })();
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BloodLink//Appointments//EN", "BEGIN:VEVENT", `UID:${a.id}@bloodlink`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART:${d}T${t}00`, `DTEND:${d}T${end}00`, `SUMMARY:Blood donation at ${a.facilityName}`, `LOCATION:${(facilityById(a.facilityId)?.address || a.facilityName).replace(/,/g, "\\,")}`,
    "DESCRIPTION:Bring a valid ID. Eat a meal and drink water beforehand.", "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:Blood donation appointment", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = `bloodlink-${a.id}.ics`; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function card(a) {
  const [cls, label] = STATUS[a.status] || ["pending", a.status];
  let body = `<div class="ap-when"><span>Your request</span><b>${fmtDate(a.requestedDate)} · ${fmtTime(a.requestedTime)}</b></div>`, actions = "";
  if (a.status === "Approved") {
    body = `<div class="ap-confirm"><div class="ap-confirm-icon">✓</div><div><span>Confirmed appointment</span><b>${fmtDate(a.confirmedDate, true)}</b><strong>${fmtTime(a.confirmedTime)}</strong>${a.hospitalNote ? `<p>“${esc(a.hospitalNote)}”</p>` : ""}</div></div>
      <div class="ap-when dim"><span>You asked for</span><b>${fmtDate(a.requestedDate)} · ${fmtTime(a.requestedTime)}</b></div>`;
    actions = `<button class="primary-btn" data-cal="${esc(a.id)}">＋ Add to calendar</button><button class="small-btn" data-cancel="${esc(a.id)}">Cancel appointment</button>`;
  } else if (a.status === "Pending") {
    body += `<p class="ap-note">The center is reviewing your request. We'll show the confirmed time here as soon as it's approved.</p>`;
    actions = `<button class="small-btn" data-cancel="${esc(a.id)}">Cancel request</button>`;
  } else if (a.status === "Declined") {
    body += `<div class="ap-decline"><span>Reason from the center</span><p>${esc(a.declineReason || "No reason was given.")}</p></div>`;
    actions = `<button class="primary-btn" data-rebook="${esc(a.facilityId)}">Book another time</button>`;
  } else if (a.status === "Completed") {
    body = `<div class="ap-when"><span>Donated on</span><b>${fmtDate(a.confirmedDate || a.requestedDate)}</b></div><p class="ap-note">Thank you for saving lives. You can donate again from ${fmtDate(addDays(a.confirmedDate || a.requestedDate, WAIT_DAYS))}.</p>`;
  } else if (a.status === "Cancelled") {
    body += `<p class="ap-note">${a.cancelledBy === "hospital" ? "This appointment was cancelled by the center." : "You cancelled this request."}</p>`;
    if (a.cancelledBy === "hospital" && a.declineReason) body += `<div class="ap-decline"><span>Reason from the center</span><p>${esc(a.declineReason)}</p></div>`;
    actions = `<button class="small-btn" data-rebook="${esc(a.facilityId)}">Book again</button>`;
  }
  const meta = a.eligibility?.state === "review" ? `<span class="ap-chip warn">Sent for hospital review</span>` : "";
  return `<article class="ap-card ${cls}" data-ap="${esc(a.id)}">
    <div class="ap-card-top"><span class="ap-fac-icon">${a.facilityType === "Hospital" ? "✚" : "♥"}</span><div><b>${esc(a.facilityName)}</b><small>${esc(a.facilityType)} · ${esc(a.facilityCity || "")} · <span class="ap-id">${esc(a.id)}</span></small></div><span class="status ${cls}">${label}</span></div>
    ${body}${meta}${actions ? `<div class="ap-card-actions">${actions}</div>` : ""}</article>`;
}
function renderBanner() {
  const t = todayStr();
  const next = mine().filter(a => a.status === "Approved" && a.confirmedDate >= t).sort((a, b) => (a.confirmedDate + a.confirmedTime).localeCompare(b.confirmedDate + b.confirmedTime))[0];
  $("confirmedBanner").innerHTML = next ? `<div class="ap-banner"><div class="ap-banner-icon">✓</div><div class="ap-banner-text"><span>YOUR NEXT DONATION</span><b>${fmtDate(next.confirmedDate, true)} at ${fmtTime(next.confirmedTime)}</b><small>${esc(next.facilityName)} · ${esc(next.facilityCity || "")}</small></div><button class="primary-btn" data-cal="${esc(next.id)}">＋ Add to calendar</button></div>` : "";
}
function render() {
  const list = mine();
  $("sumTotal").textContent = list.length;
  $("sumPending").textContent = list.filter(a => a.status === "Pending").length;
  $("sumApproved").textContent = list.filter(a => a.status === "Approved").length;
  $("sumDone").textContent = list.filter(a => a.status === "Completed").length;
  $("listCount").textContent = list.length;
  $("apList").innerHTML = list.map(card).join("");
  $("apEmpty").classList.toggle("hidden", list.length > 0);
  renderBanner();
  notifyChanges(list);
}
function notifyChanges(list) {
  const fresh = list.filter(a => a.donorNotified === false);
  if (!fresh.length) return;
  const a = fresh[0];
  if (a.status === "Approved") toast(`${a.facilityName} confirmed your appointment: ${fmtDate(a.confirmedDate)} at ${fmtTime(a.confirmedTime)}.`);
  else if (a.status === "Declined") toast(`${a.facilityName} couldn't accept your request. Open it to see the reason.`);
  else if (a.status === "Cancelled") toast(`${a.facilityName} cancelled your appointment.`);
  else if (a.status === "Completed") toast("Thank you! Your donation was marked as completed.");
  fresh.forEach(x => { const rec = all.find(r => r.id === x.id); if (rec) rec.donorNotified = true }); saveAll();
}

/* ---------- events ---------- */
$("facilityList").addEventListener("change", e => {
  if (e.target.name !== "facility") return;
  facilityId = e.target.value; renderFacilities(); renderTimes();
});
form.addEventListener("input", e => {
  if (e.target.name === "date") updateDateHint();
  $("formError").hidden = true; renderEligibility();
});
form.addEventListener("change", e => {
  if (["meds", "travel"].includes(e.target.name)) {
    const follow = form.elements[e.target.name + "Detail"]; if (follow) { follow.hidden = e.target.value !== "yes"; if (e.target.value === "yes") follow.focus(); else follow.value = "" }
  }
  if (e.target.name === "date") updateDateHint();
  renderEligibility();
});
form.addEventListener("submit", submitBooking);
document.addEventListener("click", e => {
  const cal = e.target.closest("[data-cal]");
  if (cal) { const a = all.find(x => x.id === cal.dataset.cal); if (a && a.confirmedDate && a.confirmedTime) { calendarLink(a); toast("Calendar file downloaded. Open it to add the reminder.") } return }
  const cancel = e.target.closest("[data-cancel]");
  if (cancel) {
    const a = all.find(x => x.id === cancel.dataset.cancel); if (!a) return;
    if (!confirm(`Cancel your ${a.status === "Approved" ? "appointment" : "request"} at ${a.facilityName}?`)) return;
    a.status = "Cancelled"; a.cancelledBy = "donor"; a.updatedAt = new Date().toISOString(); saveAll(); render(); toast("Appointment cancelled."); return;
  }
  const re = e.target.closest("[data-rebook]");
  if (re) { facilityId = re.dataset.rebook; renderFacilities(); renderTimes(); $("bookingPanel").scrollIntoView({ behavior: "smooth", block: "start" }) }
});
window.addEventListener("storage", e => { if (e.key === KEY) { all = read(KEY, []); render() } });

/* ---------- init ---------- */
(function init() {
  const { min, max } = dateRange();
  $("apDate").min = min; $("apDate").max = max; $("apLast").max = todayStr();
  renderFacilities(); renderTimes(); applyDraft(); updateDateHint(); renderEligibility(); render();
  if (location.hash === "#my") setTimeout(() => $("myAppointments").scrollIntoView(), 50);
})();