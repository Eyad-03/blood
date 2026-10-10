// BloodLink donor search page with working Leaflet map
const sampleDonors = [
  {id:1,name:"Lina Khalil",city:"Irbid",area:"University Street",type:"O+",distance:1.2,available:true,initials:"LK",lat:32.5355,lng:35.8515},
  {id:2,name:"Omar Haddad",city:"Irbid",area:"Al-Hashmi",type:"A+",distance:2.4,available:true,initials:"OH",lat:32.5482,lng:35.8578},
  {id:3,name:"Sara Nasser",city:"Amman",area:"Khalda",type:"B+",distance:6.1,available:false,initials:"SN",lat:31.9952,lng:35.8427},
  {id:4,name:"Yazan Saleh",city:"Irbid",area:"Al-Barha",type:"O+",distance:3.7,available:true,initials:"YS",lat:32.5512,lng:35.8394},
  {id:5,name:"Maya Ibrahim",city:"Amman",area:"Shmeisani",type:"AB+",distance:4.3,available:true,initials:"MI",lat:31.9648,lng:35.8967},
  {id:6,name:"Adam Faris",city:"Zarqa",area:"New Zarqa",type:"A-",distance:8.5,available:false,initials:"AF",lat:32.0728,lng:36.0942},
  {id:7,name:"Noor Samir",city:"Irbid",area:"Al-Husun",type:"O-",distance:5.4,available:true,initials:"NS",lat:32.4851,lng:35.8765},
  {id:8,name:"Kareem Adel",city:"Amman",area:"Jubaiha",type:"B-",distance:7.2,available:true,initials:"KA",lat:32.0184,lng:35.8721},
  {id:9,name:"Hala Mahmoud",city:"Irbid",area:"Downtown",type:"AB-",distance:1.8,available:false,initials:"HM",lat:32.5556,lng:35.8501},
  {id:10,name:"Tareq Amin",city:"Amman",area:"Abdoun",type:"O+",distance:9.1,available:true,initials:"TA",lat:31.9498,lng:35.8831},
  {id:11,name:"Dana Rami",city:"Zarqa",area:"Prince Hasan",type:"A+",distance:3.1,available:true,initials:"DR",lat:32.0833,lng:36.1056},
  {id:12,name:"Zaid Fawzi",city:"Irbid",area:"Al-Naseem",type:"B+",distance:2.9,available:true,initials:"ZF",lat:32.5422,lng:35.8664}
];

const $ = id => document.getElementById(id);
const searchForm = $("searchForm");
const bloodType = $("bloodType");
const cityInput = $("city");
const availabilitySelect = $("availability");
const sortBy = $("sortBy");
const donorGrid = $("donorGrid");
const emptyState = $("emptyState");
let activeFilters = {type:"", city:"", availability:"all"};
let donorMap = null;
let markerLayer = null;

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[char]);
}

function initDonorMap() {
  const status = $("mapStatus");
  const mapElement = $("donorMap");

  if (!mapElement) {
    console.error("Map element #donorMap was not found in donorSearch.html");
    return;
  }
  if (typeof L === "undefined") {
    if (status) {
      status.hidden = false;
      status.textContent = "Leaflet did not load. Check your internet connection or whether unpkg.com is blocked.";
      status.classList.add("map-status-error");
    }
    console.error("Leaflet (L) is undefined. Check the Leaflet script URL in donorSearch.html.");
    return;
  }

  try {
    donorMap = L.map(mapElement, {scrollWheelZoom:false}).setView([32.2, 35.9], 8);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
    }).addTo(donorMap);
    markerLayer = L.layerGroup().addTo(donorMap);

    if (status) status.hidden = true;

    // Ensure Leaflet calculates the correct size after the layout has rendered.
    requestAnimationFrame(() => donorMap && donorMap.invalidateSize());
    window.addEventListener("resize", () => donorMap && donorMap.invalidateSize());

    donorMap.on("tileerror", () => {
      if (status) {
        status.hidden = false;
        status.textContent = "The map opened, but its map tiles could not load. Check your internet connection or network restrictions.";
        status.classList.add("map-status-error");
      }
    });
  } catch (error) {
    console.error("Unable to initialize Leaflet map:", error);
    if (status) {
      status.hidden = false;
      status.textContent = "The map could not initialize. Open DevTools Console (F12) to see the error.";
      status.classList.add("map-status-error");
    }
  }
}

function updateMap(results) {
  if (!donorMap || !markerLayer) return;
  markerLayer.clearLayers();

  if (results.length === 0) {
    donorMap.setView([32.2, 35.9], 8);
    return;
  }

  const bounds = [];
  results.forEach(donor => {
    const markerIcon = L.divIcon({
      className: "custom-donor-marker",
      html: `<span><b>${escapeHTML(donor.type)}</b></span>`,
      iconSize: [35, 35],
      iconAnchor: [17, 34],
      popupAnchor: [0, -31]
    });

    L.marker([donor.lat, donor.lng], {icon: markerIcon})
      .bindPopup(`
        <div class="map-popup-name">${escapeHTML(donor.name)}</div>
        <div class="map-popup-meta">${escapeHTML(donor.area)}, ${escapeHTML(donor.city)}</div>
        <div class="map-popup-meta">${donor.available ? "Available (self-reported)" : "Not currently available"}</div>
        <span class="map-popup-type">${escapeHTML(donor.type)} blood type</span>
      `)
      .addTo(markerLayer);

    bounds.push([donor.lat, donor.lng]);
  });

  if (bounds.length === 1) donorMap.setView(bounds[0], 13);
  else donorMap.fitBounds(bounds, {padding:[25,25], maxZoom:12});
}

function renderDonors() {
  const cityQuery = activeFilters.city.trim().toLowerCase();
  let results = sampleDonors.filter(donor => {
    const matchesType = !activeFilters.type || donor.type === activeFilters.type;
    const matchesCity = !cityQuery ||
      donor.city.toLowerCase().includes(cityQuery) ||
      donor.area.toLowerCase().includes(cityQuery);
    const matchesAvailability = activeFilters.availability !== "available" || donor.available;
    return matchesType && matchesCity && matchesAvailability;
  });

  if (sortBy.value === "name") results.sort((a,b) => a.name.localeCompare(b.name));
  else results.sort((a,b) => a.distance - b.distance);

  $("resultCount").textContent = results.length;
  const filters = [];
  if (activeFilters.type) filters.push(activeFilters.type);
  if (activeFilters.city) filters.push(activeFilters.city);
  if (activeFilters.availability === "available") filters.push("available now");
  $("resultsDescription").textContent = filters.length
    ? `Showing ${results.length} sample donor${results.length === 1 ? "" : "s"} for ${filters.join(" · ")}.`
    : "Showing sample donors to preview the search experience.";

  donorGrid.innerHTML = results.map((donor,index) => `
    <article class="donor-card" style="animation-delay:${Math.min(index,8)*45}ms">
      <div class="card-top">
        <div class="donor-avatar" aria-hidden="true">${escapeHTML(donor.initials)}</div>
        <div><div class="donor-name">${escapeHTML(donor.name)}</div><div class="donor-location">⌖ ${escapeHTML(donor.area)}, ${escapeHTML(donor.city)}</div></div>
        <span class="availability ${donor.available ? "" : "unavailable"}">${donor.available ? "Available" : "Not active"}</span>
      </div>
      <div class="card-divider"></div>
      <div class="donor-meta">
        <div class="blood-tag"><span class="blood-drop">${escapeHTML(donor.type)}</span><span><span class="blood-caption">Blood type</span><strong class="blood-value">${escapeHTML(donor.type)}</strong></span></div>
        <div class="distance"><strong>${donor.distance.toFixed(1)} km away</strong><small>Estimated distance</small></div>
      </div>
      <div class="card-bottom"><button class="contact-button" type="button" data-contact="${donor.id}">View contact <span aria-hidden="true"> →</span></button></div>
    </article>`).join("");

  emptyState.hidden = results.length !== 0;
  donorGrid.hidden = results.length === 0;
  document.querySelectorAll(".type-pill").forEach(button => {
    button.classList.toggle("active", button.dataset.type === activeFilters.type);
    button.setAttribute("aria-pressed", button.dataset.type === activeFilters.type ? "true" : "false");
  });
  updateMap(results);
}

searchForm.addEventListener("submit", event => {
  event.preventDefault();
  if (!bloodType.value) {
    bloodType.focus();
    bloodType.setCustomValidity("Please select a blood type to search.");
    bloodType.reportValidity();
    return;
  }
  bloodType.setCustomValidity("");
  activeFilters = {type:bloodType.value, city:cityInput.value, availability:availabilitySelect.value};
  renderDonors();
  $("resultsSection").scrollIntoView({behavior:"smooth", block:"start"});
});

bloodType.addEventListener("change", () => bloodType.setCustomValidity(""));
document.querySelectorAll(".type-pill").forEach(button => {
  button.addEventListener("click", () => {
    bloodType.value = button.dataset.type;
    activeFilters = {type:button.dataset.type, city:cityInput.value, availability:availabilitySelect.value};
    renderDonors();
  });
});
sortBy.addEventListener("change", renderDonors);
$("resetSearch").addEventListener("click", () => {
  searchForm.reset();
  activeFilters = {type:"", city:"", availability:"all"};
  sortBy.value = "nearby";
  renderDonors();
});

donorGrid.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  const donor = sampleDonors.find(item => item.id === Number(button.dataset.contact || button.dataset.profile));
  if (donor) showModal(donor, button.hasAttribute("data-contact"));
});

function showModal(donor, isContact) {
  const oldModal = $("donorModal");
  if (oldModal) oldModal.remove();
  const modal = document.createElement("div");
  modal.id = "donorModal";
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <div class="modal-head"><h3 id="modalTitle">${isContact ? "Contact donor" : "Donor details"}</h3><button class="modal-close" type="button" aria-label="Close dialog">×</button></div>
      <div class="modal-person"><div class="donor-avatar">${escapeHTML(donor.initials)}</div><div><strong>${escapeHTML(donor.name)}</strong><small>${escapeHTML(donor.type)} blood type · ${escapeHTML(donor.area)}, ${escapeHTML(donor.city)}</small></div></div>
      <p>${isContact ? "In the full app, verified contact options would appear here after the donor's consent." : "This sample profile shows the donor's listed blood type, area, and self-reported availability."}</p>
      <button class="modal-action" type="button">Send Request</button>
    </section>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector(".modal-close").addEventListener("click", close);
  modal.querySelector(".modal-action").addEventListener("click", close);
  modal.addEventListener("click", event => { if (event.target === modal) close(); });
  modal.querySelector(".modal-close").focus();
  document.addEventListener("keydown", function onEscape(event) {
    if (event.key === "Escape") close();
  }, {once:true});
}

initDonorMap();
renderDonors();
