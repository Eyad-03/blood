/* ==========================================
   BloodLink - Donor Search
   Leaflet map (OpenStreetMap tiles), animated radar hero,
   blood-cell background, heartbeat line, compatibility
   matching and micro-interactions. No API key required.
========================================== */

const sampleDonors = [
  { id: 1, name: "Lina Khalil", city: "Irbid", area: "University Street", type: "O+", distance: 1.2, available: true, initials: "LK", lat: 32.5355, lng: 35.8515 },
  { id: 2, name: "Omar Haddad", city: "Irbid", area: "Al-Hashmi", type: "A+", distance: 2.4, available: true, initials: "OH", lat: 32.5482, lng: 35.8578 },
  { id: 3, name: "Sara Nasser", city: "Amman", area: "Khalda", type: "B+", distance: 6.1, available: false, initials: "SN", lat: 31.9952, lng: 35.8427 },
  { id: 4, name: "Yazan Saleh", city: "Irbid", area: "Al-Barha", type: "O+", distance: 3.7, available: true, initials: "YS", lat: 32.5512, lng: 35.8394 },
  { id: 5, name: "Maya Ibrahim", city: "Amman", area: "Shmeisani", type: "AB+", distance: 4.3, available: true, initials: "MI", lat: 31.9648, lng: 35.8967 },
  { id: 6, name: "Adam Faris", city: "Zarqa", area: "New Zarqa", type: "A-", distance: 8.5, available: false, initials: "AF", lat: 32.0728, lng: 36.0942 },
  { id: 7, name: "Noor Samir", city: "Irbid", area: "Al-Husun", type: "O-", distance: 5.4, available: true, initials: "NS", lat: 32.4851, lng: 35.8765 },
  { id: 8, name: "Kareem Adel", city: "Amman", area: "Jubaiha", type: "B-", distance: 7.2, available: true, initials: "KA", lat: 32.0184, lng: 35.8721 },
  { id: 9, name: "Hala Mahmoud", city: "Irbid", area: "Downtown", type: "AB-", distance: 1.8, available: false, initials: "HM", lat: 32.5556, lng: 35.8501 },
  { id: 10, name: "Tareq Amin", city: "Amman", area: "Abdoun", type: "O+", distance: 9.1, available: true, initials: "TA", lat: 31.9498, lng: 35.8831 },
  { id: 11, name: "Dana Rami", city: "Zarqa", area: "Prince Hasan", type: "A+", distance: 3.1, available: true, initials: "DR", lat: 32.0833, lng: 36.1056 },
  { id: 12, name: "Zaid Fawzi", city: "Irbid", area: "Al-Naseem", type: "B+", distance: 2.9, available: true, initials: "ZF", lat: 32.5422, lng: 35.8664 }
];

/* Red-cell compatibility: patient type -> donor types that can give to them */
const COMPATIBLE_DONORS = {
  "O-":  ["O-"],
  "O+":  ["O+", "O-"],
  "A-":  ["A-", "O-"],
  "A+":  ["A+", "A-", "O+", "O-"],
  "B-":  ["B-", "O-"],
  "B+":  ["B+", "B-", "O+", "O-"],
  "AB-": ["AB-", "A-", "B-", "O-"],
  "AB+": ["AB+", "AB-", "A+", "A-", "B+", "B-", "O+", "O-"]
};

const $ = id => document.getElementById(id);
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const CAN_HOVER = window.matchMedia("(hover: hover)").matches;

const searchForm = $("searchForm");
const bloodType = $("bloodType");
const cityInput = $("city");
const availabilitySelect = $("availability");
const sortBy = $("sortBy");
const donorGrid = $("donorGrid");
const emptyState = $("emptyState");
const compatToggle = $("compatToggle");

let activeFilters = {
  type: "",
  city: "",
  availability: "all",
  compatible: false
};

let donorMap = null;
let markerLayer = null;
let markerByDonorId = new Map();

/* Safely escape text before adding it to HTML */
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

/* ==========================================
   INITIALIZE MAP
========================================== */

const MAP_CENTER = [32.2, 35.9];
const MAP_ZOOM = 8;
const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>';

const CARTO_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>';

let tileLayers = {};
let highlightCircle = null;
let lastBounds = [];

function setMapStatus(message, isError) {
  const status = $("mapStatus");
  if (!status) return;
  status.hidden = !message;
  status.textContent = message || "";
  status.classList.toggle("map-status-error", Boolean(isError));
}

/* Switch between the dark (default) and light basemaps */
let currentStyle = "dark";

function switchTiles(name = "dark") {
  if (!donorMap || !tileLayers[name]) return;

  Object.values(tileLayers).forEach(layer => {
    if (donorMap.hasLayer(layer)) donorMap.removeLayer(layer);
  });

  tileLayers[name].addTo(donorMap);
  currentStyle = name;

  const el = donorMap.getContainer();
  el.classList.toggle("theme-dark", name === "dark" || name === "darkFallback");
  el.classList.toggle("theme-light", name === "light");
  el.classList.toggle("tiles-fallback", name === "darkFallback");

  const wrap = el.closest(".map-wrap");
  if (wrap) wrap.dataset.theme = name === "light" ? "light" : "dark";

  document.querySelectorAll(".map-switch button").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.style === (name === "light" ? "light" : "dark")
    );
  });
}

/* "My location" blue dot with accuracy ring + direction cone */
let meMarker = null;
let meAccuracy = null;

function locateMe() {
  if (!donorMap) return;

  if (!navigator.geolocation) {
    setMapStatus("Location is not supported by this browser.", true);
    return;
  }

  setMapStatus("Finding your location…");

  navigator.geolocation.getCurrentPosition(
    position => {
      const { latitude, longitude, accuracy, heading } = position.coords;
      const latlng = [latitude, longitude];
      const hasHeading = typeof heading === "number" && !Number.isNaN(heading);

      const icon = L.divIcon({
        className: "me-marker",
        html:
          `<div class="me-wrap">` +
          (hasHeading ? `<span class="me-cone" style="transform:rotate(${heading}deg)"></span>` : "") +
          `<span class="me-pulse"></span><span class="me-dot"></span></div>`,
        iconSize: [60, 60],
        iconAnchor: [30, 30]
      });

      if (meMarker) donorMap.removeLayer(meMarker);
      if (meAccuracy) donorMap.removeLayer(meAccuracy);

      meAccuracy = L.circle(latlng, {
        radius: accuracy,
        weight: 1,
        color: "#4d8dff",
        fillColor: "#4d8dff",
        fillOpacity: 0.12,
        interactive: false
      }).addTo(donorMap);

      meMarker = L.marker(latlng, { icon, interactive: false, zIndexOffset: 1000 }).addTo(donorMap);

      donorMap.flyTo(latlng, 14, { duration: 0.8 });
      setMapStatus("");
    },
    () => setMapStatus("Could not get your location. Please allow location access.", true),
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function fitToResults() {
  if (!donorMap) return;

  if (lastBounds.length === 0) {
    donorMap.flyTo(MAP_CENTER, MAP_ZOOM, { duration: 0.7 });
  } else if (lastBounds.length === 1) {
    donorMap.flyTo(lastBounds[0], 13, { duration: 0.7 });
  } else {
    donorMap.fitBounds(lastBounds, {
      padding: [50, 50],
      maxZoom: 12,
      animate: true,
      duration: 0.7
    });
  }
}

function initDonorMap() {
  const mapElement = $("donorMap");

  if (!mapElement) return;

  if (typeof L === "undefined") {
    setMapStatus("Leaflet did not load. Check your internet connection.", true);
    return;
  }

  try {
    donorMap = L.map(mapElement, {
      scrollWheelZoom: false,
      zoomControl: false,
      zoomSnap: 0.5,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 90,
      minZoom: 6,
      maxBoundsViscosity: 0.6,
      attributionControl: true
    }).setView(MAP_CENTER, MAP_ZOOM);

    donorMap.attributionControl.setPrefix(false);

    /* Dark basemap (CARTO Dark Matter, tinted navy by CSS) */
    tileLayers.dark = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      { subdomains: "abcd", maxZoom: 20, attribution: CARTO_ATTR, crossOrigin: true }
    );

    /* Light basemap: OpenStreetMap */
    tileLayers.light = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      { maxZoom: 19, attribution: OSM_ATTR, crossOrigin: true }
    );

    /* Fallback: OpenStreetMap inverted into a dark theme with CSS filters */
    tileLayers.darkFallback = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      { maxZoom: 19, attribution: OSM_ATTR, crossOrigin: true }
    );

    let darkErrors = 0;
    tileLayers.dark.on("tileerror", () => {
      darkErrors += 1;
      if (darkErrors >= 4 && currentStyle === "dark") switchTiles("darkFallback");
    });

    Object.values(tileLayers).forEach(layer => {
      layer.on("tileload", () => setMapStatus(""));
    });

    tileLayers.light.on("tileerror", () => {
      setMapStatus("Map tiles could not load. Check your internet connection or try again.", true);
    });

    switchTiles("dark");

    /* Controls */
    const MapSwitch = L.Control.extend({
      options: { position: "topright" },
      onAdd() {
        const box = L.DomUtil.create("div", "map-switch leaflet-bar");
        box.innerHTML =
          '<button type="button" data-style="dark" class="active">Dark</button>' +
          '<button type="button" data-style="light">Light</button>';
        L.DomEvent.disableClickPropagation(box);
        box.querySelectorAll("button").forEach(button => {
          L.DomEvent.on(button, "click", () => switchTiles(button.dataset.style));
        });
        return box;
      }
    });

    const FitControl = L.Control.extend({
      options: { position: "topright" },
      onAdd() {
        const button = L.DomUtil.create("button", "map-fit");
        button.type = "button";
        button.setAttribute("aria-label", "Fit map to all shown donors");
        button.innerHTML = "<span>⤢</span> Show all";
        L.DomEvent.disableClickPropagation(button);
        L.DomEvent.on(button, "click", fitToResults);
        return button;
      }
    });

    const LocateControl = L.Control.extend({
      options: { position: "bottomright" },
      onAdd() {
        const button = L.DomUtil.create("button", "map-locate");
        button.type = "button";
        button.setAttribute("aria-label", "Show my location");
        button.innerHTML =
          '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.8 8.2l-2.1 5.5-5.5 2.1 2.1-5.5z" fill="currentColor"/></svg>';
        L.DomEvent.disableClickPropagation(button);
        L.DomEvent.on(button, "click", locateMe);
        return button;
      }
    });

    new MapSwitch().addTo(donorMap);
    new FitControl().addTo(donorMap);
    L.control.zoom({ position: "bottomright" }).addTo(donorMap);
    new LocateControl().addTo(donorMap);

    markerLayer = L.layerGroup().addTo(donorMap);

    setMapStatus("");

    requestAnimationFrame(() => { if (donorMap) donorMap.invalidateSize(); });
    window.addEventListener("resize", () => { if (donorMap) donorMap.invalidateSize(); });
  } catch (error) {
    console.error("Unable to initialize map:", error);
    setMapStatus("The map could not initialize. Check the browser console.", true);
  }
}

/* ==========================================
   FOCUS ON A DONOR
========================================== */

function focusDonor(donor) {
  const marker = markerByDonorId.get(donor.id);
  if (!donorMap || !marker) return;

  donorMap.flyTo([donor.lat, donor.lng], Math.max(donorMap.getZoom(), 13), { duration: 0.7 });
  setTimeout(() => marker.openPopup(), 650);
}

/* Bounce a pin when its card is hovered */
function setPinHover(id, on) {
  const marker = markerByDonorId.get(id);
  const el = marker && marker.getElement();
  if (!el) return;
  el.classList.toggle("hovered", on);
  marker.setZIndexOffset(on ? 900 : 0);
}

/* ==========================================
   MAP PINS + POPUPS
========================================== */

function buildPinIcon(donor, index) {
  return L.divIcon({
    className: `custom-donor-marker ${donor.available ? "" : "unavailable"}`,
    html:
      `<div class="pin" style="animation-delay:${Math.min(index, 10) * 70}ms">` +
        '<span class="pin-pulse"></span>' +
        '<svg class="pin-shape" viewBox="0 0 44 54" aria-hidden="true">' +
          '<path d="M22 52C22 52 4 33.5 4 21a18 18 0 1 1 36 0C40 33.5 22 52 22 52Z"/>' +
          '<circle cx="22" cy="21" r="13"/>' +
        '</svg>' +
        `<b class="pin-blood-type" aria-label="Blood type ${escapeHTML(donor.type)}">${escapeHTML(donor.type)}</b>` +
      '</div>',
    iconSize: [44, 54],
    iconAnchor: [22, 52],
    popupAnchor: [0, -48]
  });
}

function buildPopup(donor) {
  return `
    <div class="pop-head">
      <div class="pop-avatar">${escapeHTML(donor.initials)}</div>
      <div>
        <div class="map-popup-name">${escapeHTML(donor.name)}</div>
        <div class="map-popup-meta">⌖ ${escapeHTML(donor.area)}, ${escapeHTML(donor.city)}</div>
      </div>
    </div>
    <div class="pop-body">
      <div class="pop-tags">
        <span class="pop-tag type">${escapeHTML(donor.type)}</span>
        <span class="pop-tag ${donor.available ? "ok" : ""}">
          ${donor.available ? "Available (self-reported)" : "Not currently available"}
        </span>
        <span class="pop-tag">${donor.distance.toFixed(1)} km</span>
      </div>
      <button type="button" class="pop-btn" data-popup-contact="${donor.id}">View contact ↗</button>
    </div>`;
}

function clearHighlight() {
  if (highlightCircle && donorMap) donorMap.removeLayer(highlightCircle);
  highlightCircle = null;
}

/* ==========================================
   UPDATE MAP MARKERS
========================================== */

function updateMap(results) {
  const shown = $("mapShown");

  if (shown) {
    const available = results.filter(donor => donor.available).length;
    shown.textContent = results.length
      ? `${results.length} donor${results.length === 1 ? "" : "s"} · ${available} available`
      : "No donors in view";
  }

  if (!donorMap || !markerLayer) return;

  clearHighlight();
  markerLayer.clearLayers();
  markerByDonorId.clear();
  lastBounds = [];

  results.forEach((donor, index) => {
    const marker = L.marker([donor.lat, donor.lng], {
      icon: buildPinIcon(donor, index),
      riseOnHover: true,
      keyboard: true,
      title: `${donor.name} · ${donor.type}`
    });

    marker.bindPopup(buildPopup(donor), {
      className: "donor-popup",
      minWidth: 240,
      maxWidth: 240,
      autoPanPadding: [30, 60]
    });

    marker.on("popupopen", event => {
      const element = marker.getElement();
      if (element) element.classList.add("active");

      clearHighlight();
      highlightCircle = L.circle([donor.lat, donor.lng], {
        radius: 1800,
        color: donor.available ? "#ff4d6d" : "#8f9bb0",
        weight: 1.5,
        dashArray: "5 7",
        fillColor: donor.available ? "#ff4d6d" : "#8f9bb0",
        fillOpacity: 0.08,
        interactive: false,
        className: "donor-ring"
      }).addTo(donorMap);

      const button = event.popup.getElement().querySelector("[data-popup-contact]");
      if (button) button.addEventListener("click", () => showModal(donor, true));

      /* Highlight the matching card */
      const card = donorGrid.querySelector(`[data-card="${donor.id}"]`);
      if (card) card.classList.add("linked");
    });

    marker.on("popupclose", () => {
      const element = marker.getElement();
      if (element) element.classList.remove("active");
      clearHighlight();
      const card = donorGrid.querySelector(`[data-card="${donor.id}"]`);
      if (card) card.classList.remove("linked");
    });

    marker.addTo(markerLayer);
    markerByDonorId.set(donor.id, marker);
    lastBounds.push([donor.lat, donor.lng]);
  });

  fitToResults();
}

/* ==========================================
   COMPATIBILITY PANEL
========================================== */

function renderCompatPanel() {
  const panel = $("compatPanel");
  if (!panel) return;

  const type = bloodType.value;

  if (!type) {
    panel.innerHTML = '<span class="compat-hint">Pick a blood type to see who can donate</span>';
    return;
  }

  const donors = COMPATIBLE_DONORS[type] || [type];
  const all = ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"];

  panel.innerHTML =
    `<span class="compat-title">Can donate to <b>${escapeHTML(type)}</b></span>` +
    '<span class="compat-chips">' +
    all.map((t, i) => {
      const ok = donors.includes(t);
      const exact = t === type;
      return `<span class="compat-chip ${ok ? "ok" : "no"} ${exact ? "exact" : ""}" style="--i:${i}">${escapeHTML(t)}</span>`;
    }).join("") +
    "</span>";
}

/* ==========================================
   RENDER DONOR CARDS AND APPLY FILTERS
========================================== */

function getResults() {
  const cityQuery = activeFilters.city.trim().toLowerCase();
  const allowedTypes = activeFilters.type
    ? (activeFilters.compatible ? COMPATIBLE_DONORS[activeFilters.type] : [activeFilters.type])
    : null;

  const results = sampleDonors.filter(donor => {
    const matchesType = !allowedTypes || allowedTypes.includes(donor.type);
    const matchesCity =
      !cityQuery ||
      donor.city.toLowerCase().includes(cityQuery) ||
      donor.area.toLowerCase().includes(cityQuery);
    const matchesAvailability = activeFilters.availability !== "available" || donor.available;
    return matchesType && matchesCity && matchesAvailability;
  });

  if (sortBy.value === "name") {
    results.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    /* Exact matches first when compatible donors are included, then distance */
    results.sort((a, b) => {
      if (activeFilters.compatible && activeFilters.type) {
        const ea = a.type === activeFilters.type ? 0 : 1;
        const eb = b.type === activeFilters.type ? 0 : 1;
        if (ea !== eb) return ea - eb;
      }
      return a.distance - b.distance;
    });
  }

  return results;
}

function donorCardHTML(donor, index) {
  const isExact = activeFilters.type && donor.type === activeFilters.type;
  const matchBadge = activeFilters.type
    ? `<span class="match-badge ${isExact ? "exact" : "compat"}">${isExact ? "Exact match" : "Compatible"}</span>`
    : "";

  return `
    <article class="donor-card ${donor.available ? "" : "is-away"}" data-card="${donor.id}" style="--delay:${Math.min(index, 8) * 70}ms">
      <span class="card-glow" aria-hidden="true"></span>
      <div class="card-top">
        <div class="donor-avatar" aria-hidden="true">${escapeHTML(donor.initials)}</div>
        <div>
          <div class="donor-name">${escapeHTML(donor.name)}</div>
          <div class="donor-location">⌖ ${escapeHTML(donor.area)}, ${escapeHTML(donor.city)}</div>
        </div>
        <span class="availability ${donor.available ? "" : "unavailable"}">${donor.available ? "Available" : "Not active"}</span>
      </div>

      <div class="card-divider"></div>

      <div class="donor-meta">
        <div class="blood-tag">
          <span class="blood-drop">
            <svg viewBox="0 0 32 40" aria-hidden="true"><path d="M16 2C12 9 4 17 4 25a12 12 0 0 0 24 0C28 17 20 9 16 2Z"/></svg>
            <b>${escapeHTML(donor.type)}</b>
          </span>
          <span>
            <span class="blood-caption">Blood type</span>
            <strong class="blood-value">${escapeHTML(donor.type)}</strong>
          </span>
        </div>
        ${matchBadge}
        <div class="distance">
          <strong>${donor.distance.toFixed(1)} km away</strong>
          <small>Estimated distance</small>
          <span class="distance-bar"><i style="--w:${Math.max(8, 100 - donor.distance * 9)}%"></i></span>
        </div>
      </div>

      <div class="card-bottom">
        <button class="contact-button" type="button" data-contact="${donor.id}">
          View contact <span aria-hidden="true">↗</span>
        </button>
        <button class="profile-button" type="button" data-map="${donor.id}" aria-label="Show ${escapeHTML(donor.name)} on map">
          Map pin
        </button>
      </div>
    </article>`;
}

function renderDonors() {
  const results = getResults();

  animateNumber($("resultCount"), results.length, 500);

  const filters = [];
  if (activeFilters.type) filters.push(activeFilters.compatible ? `${activeFilters.type} + compatible` : activeFilters.type);
  if (activeFilters.city) filters.push(activeFilters.city);
  if (activeFilters.availability === "available") filters.push("available now");

  $("resultsDescription").textContent = filters.length
    ? `Showing ${results.length} sample donor${results.length === 1 ? "" : "s"} for ${filters.join(" · ")}.`
    : "Explore sample donors and their approximate locations.";

  donorGrid.innerHTML = results.map(donorCardHTML).join("");

  emptyState.hidden = results.length !== 0;
  donorGrid.hidden = results.length === 0;

  document.querySelectorAll(".type-pill").forEach(button => {
    const selected = button.dataset.type === activeFilters.type;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  });

  updateMap(results);
}

/* Skeleton + map "scan" sweep before results appear */
let scanTimer = null;

function runSearch({ scroll = true } = {}) {
  clearTimeout(scanTimer);

  const scanBtn = searchForm.querySelector(".search-button");
  const mapScan = $("mapScan");

  if (REDUCED_MOTION) {
    renderDonors();
  } else {
    scanBtn.classList.add("loading");
    if (mapScan) mapScan.classList.add("on");
    emptyState.hidden = true;
    donorGrid.hidden = false;
    donorGrid.innerHTML = Array.from({ length: 3 }, () => `
      <div class="donor-card skeleton" aria-hidden="true">
        <div class="sk-row"><span class="sk sk-avatar"></span><span class="sk-col"><span class="sk sk-line w60"></span><span class="sk sk-line w40"></span></span></div>
        <span class="sk sk-line w100"></span>
        <span class="sk sk-btn"></span>
      </div>`).join("");

    scanTimer = setTimeout(() => {
      scanBtn.classList.remove("loading");
      if (mapScan) mapScan.classList.remove("on");
      renderDonors();
      const count = donorGrid.querySelectorAll(".donor-card").length;
      showToast(
        count ? `Found ${count} potential donor${count === 1 ? "" : "s"}` : "No donors match these filters",
        count ? "success" : "info"
      );
    }, 850);
  }

  if (scroll) $("resultsSection").scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ==========================================
   SEARCH FORM
========================================== */

searchForm.addEventListener("submit", event => {
  event.preventDefault();

  if (!bloodType.value) {
    bloodType.setCustomValidity("Please select a blood type to search.");
    bloodType.reportValidity();
    const wrap = bloodType.closest(".select-wrap");
    wrap.classList.remove("shake");
    void wrap.offsetWidth;
    wrap.classList.add("shake");
    return;
  }

  bloodType.setCustomValidity("");

  activeFilters = {
    type: bloodType.value,
    city: cityInput.value,
    availability: availabilitySelect.value,
    compatible: compatToggle.checked
  };

  runSearch();
});

bloodType.addEventListener("change", () => {
  bloodType.setCustomValidity("");
  renderCompatPanel();
});

compatToggle.addEventListener("change", () => {
  if (!activeFilters.type) return;
  activeFilters.compatible = compatToggle.checked;
  runSearch({ scroll: false });
});

/* Ripple on primary buttons */
document.addEventListener("pointerdown", event => {
  const button = event.target.closest(".search-button, .contact-button, .modal-action, .type-pill, .pop-btn");
  if (!button || REDUCED_MOTION) return;
  const rect = button.getBoundingClientRect();
  const ripple = document.createElement("span");
  ripple.className = "ripple-fx";
  const size = Math.max(rect.width, rect.height) * 2;
  ripple.style.width = ripple.style.height = size + "px";
  ripple.style.left = event.clientX - rect.left - size / 2 + "px";
  ripple.style.top = event.clientY - rect.top - size / 2 + "px";
  button.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove());
});

/* ==========================================
   QUICK BLOOD-TYPE FILTERS
========================================== */

document.querySelectorAll(".type-pill").forEach(button => {
  button.addEventListener("click", () => {
    bloodType.value = button.dataset.type;
    bloodType.setCustomValidity("");
    renderCompatPanel();

    activeFilters = {
      type: button.dataset.type,
      city: cityInput.value,
      availability: availabilitySelect.value,
      compatible: compatToggle.checked
    };

    runSearch();
  });
});

sortBy.addEventListener("change", renderDonors);

$("resetSearch").addEventListener("click", () => {
  searchForm.reset();
  compatToggle.checked = false;
  activeFilters = { type: "", city: "", availability: "all", compatible: false };
  sortBy.value = "nearby";
  renderCompatPanel();
  renderDonors();
});

/* ==========================================
   DONOR CARD BUTTONS + EFFECTS
========================================== */

donorGrid.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;

  const id = Number(button.dataset.contact || button.dataset.profile || button.dataset.map);
  const donor = sampleDonors.find(item => item.id === id);
  if (!donor) return;

  if (button.hasAttribute("data-map")) {
    focusDonor(donor);
    $("donorMap").scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    showModal(donor, button.hasAttribute("data-contact"));
  }
});

/* Hover a card -> bounce its pin; 3D tilt + spotlight following the cursor */
let hoveredCardId = null;

donorGrid.addEventListener("pointerover", event => {
  const card = event.target.closest(".donor-card[data-card]");
  const id = card ? Number(card.dataset.card) : null;
  if (id === hoveredCardId) return;
  if (hoveredCardId !== null) setPinHover(hoveredCardId, false);
  hoveredCardId = id;
  if (id !== null) setPinHover(id, true);
});

donorGrid.addEventListener("pointerleave", () => {
  if (hoveredCardId !== null) setPinHover(hoveredCardId, false);
  hoveredCardId = null;
});

if (CAN_HOVER && !REDUCED_MOTION) {
  donorGrid.addEventListener("pointermove", event => {
    const card = event.target.closest(".donor-card[data-card]");
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    card.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
    card.style.setProperty("--my", (py * 100).toFixed(1) + "%");
    card.style.setProperty("--ry", ((px - 0.5) * 8).toFixed(2) + "deg");
    card.style.setProperty("--rx", ((0.5 - py) * 8).toFixed(2) + "deg");
  });

  donorGrid.addEventListener("pointerout", event => {
    const card = event.target.closest(".donor-card[data-card]");
    if (card && !card.contains(event.relatedTarget)) {
      card.style.setProperty("--ry", "0deg");
      card.style.setProperty("--rx", "0deg");
    }
  });
}

/* ==========================================
   TOASTS
========================================== */

function showToast(message, kind = "info") {
  const stack = $("toastStack");
  if (!stack) return;

  const toast = document.createElement("div");
  toast.className = `toast ${kind}`;
  toast.setAttribute("role", "status");
  toast.innerHTML =
    `<span class="toast-icon">${kind === "success" ? "✓" : kind === "love" ? "♥" : "ⓘ"}</span>` +
    `<span>${escapeHTML(message)}</span><i class="toast-timer"></i>`;
  stack.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("out");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
    if (REDUCED_MOTION) toast.remove();
  }, 3200);
}

/* ==========================================
   CONTACT / DONOR MODAL
========================================== */

function showModal(donor, isContact) {
  const oldModal = $("donorModal");
  if (oldModal) oldModal.remove();

  const lastFocus = document.activeElement;
  const modal = document.createElement("div");
  modal.id = "donorModal";
  modal.className = "modal-backdrop";

  modal.innerHTML = `
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <div class="modal-head">
        <h3 id="modalTitle">${isContact ? "Contact donor" : "Donor details"}</h3>
        <button class="modal-close" type="button" aria-label="Close dialog">×</button>
      </div>

      <div class="modal-person">
        <div class="modal-drop" aria-hidden="true">
          <svg viewBox="0 0 40 50">
            <defs><clipPath id="dropClip"><path d="M20 2C15 11 4 21 4 32a16 16 0 0 0 32 0C36 21 25 11 20 2Z"/></clipPath></defs>
            <path class="drop-outline" d="M20 2C15 11 4 21 4 32a16 16 0 0 0 32 0C36 21 25 11 20 2Z"/>
            <g clip-path="url(#dropClip)">
              <path class="drop-fill" d="M-20 30 Q-10 26 0 30 T20 30 T40 30 T60 30 V60 H-20 Z"/>
            </g>
          </svg>
          <b>${escapeHTML(donor.type)}</b>
        </div>
        <div>
          <strong>${escapeHTML(donor.name)}</strong>
          <small>${escapeHTML(donor.type)} blood type · ${escapeHTML(donor.area)}, ${escapeHTML(donor.city)}</small>
          <small class="modal-status ${donor.available ? "ok" : ""}">${donor.available ? "● Available (self-reported)" : "○ Not currently available"}</small>
        </div>
      </div>

      <p>
        ${isContact
          ? "In the full app, verified contact options would appear here after the donor's consent."
          : "This sample profile shows the donor's listed blood type, area, and self-reported availability."}
      </p>

      <div class="modal-warning">Demo profile only. No real contact details are available in preview mode.</div>

      <button class="modal-action" type="button"><span>Send Request</span></button>
    </section>`;

  document.body.appendChild(modal);
  document.body.classList.add("modal-open");

  const onKey = event => {
    if (event.key === "Escape") close();
    if (event.key === "Tab") {
      const focusables = modal.querySelectorAll("button");
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  };

  const close = () => {
    modal.classList.add("closing");
    document.removeEventListener("keydown", onKey);
    document.body.classList.remove("modal-open");
    const done = () => { modal.remove(); if (lastFocus) lastFocus.focus(); };
    if (REDUCED_MOTION) done();
    else setTimeout(done, 220);
  };

  modal.querySelector(".modal-close").addEventListener("click", close);

  const action = modal.querySelector(".modal-action");
  action.addEventListener("click", () => {
    if (action.classList.contains("sent")) return;
    action.classList.add("sent");
    action.querySelector("span").textContent = "Request sent ✓";
    burstHearts(action);
    showToast(`Demo request sent to ${donor.name}`, "love");
    setTimeout(close, 1100);
  });

  modal.addEventListener("click", event => { if (event.target === modal) close(); });
  document.addEventListener("keydown", onKey);
  modal.querySelector(".modal-close").focus();
}

/* Little hearts that float up from a button */
function burstHearts(origin) {
  if (REDUCED_MOTION) return;
  const rect = origin.getBoundingClientRect();
  for (let i = 0; i < 10; i++) {
    const heart = document.createElement("span");
    heart.className = "heart-fx";
    heart.textContent = "♥";
    heart.style.left = rect.left + rect.width / 2 + "px";
    heart.style.top = rect.top + rect.height / 2 + "px";
    heart.style.setProperty("--dx", (Math.random() * 160 - 80).toFixed(0) + "px");
    heart.style.setProperty("--dy", (-60 - Math.random() * 90).toFixed(0) + "px");
    heart.style.setProperty("--rot", (Math.random() * 60 - 30).toFixed(0) + "deg");
    heart.style.animationDelay = i * 35 + "ms";
    heart.style.fontSize = 10 + Math.random() * 10 + "px";
    document.body.appendChild(heart);
    heart.addEventListener("animationend", () => heart.remove());
  }
}

/* ==========================================
   NUMBER ANIMATION HELPER
========================================== */

function animateNumber(el, target, duration = 1400, delay = 0) {
  if (!el) return;
  if (REDUCED_MOTION) { el.textContent = target; return; }

  const from = Number(el.textContent) || 0;
  const start = performance.now() + delay;

  const tick = now => {
    const p = Math.min(Math.max((now - start) / duration, 0), 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (target - from) * eased);
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  el.classList.remove("bump");
  void el.offsetWidth;
  el.classList.add("bump");
}

/* ==========================================
   HERO RADAR ANIMATION
========================================== */

function initRadar() {
  const svg = $("radarSvg");
  const linkLayer = $("radarLinks");
  const pinLayer = $("radarPins");

  if (!svg || !linkLayer || !pinLayer) return;

  const NS = "http://www.w3.org/2000/svg";
  const CENTER = { x: 260, y: 180 };
  const SWEEP_SECONDS = 7; /* keep in sync with the CSS "sweep" animation */

  const donorPoints = [
    { x: 92,  y: 152, type: "O+", bend: -30 },
    { x: 200, y: 92,  type: "A+", bend: 24 },
    { x: 384, y: 98,  type: "B+", bend: 34 },
    { x: 446, y: 214, type: "AB+", bend: -26 },
    { x: 146, y: 264, type: "O-", bend: 28 },
    { x: 322, y: 256, type: "A-", bend: -22 },
    { x: 262, y: 64,  type: "B-", bend: -18 }
  ];

  const make = (name, attrs) => {
    const el = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    return el;
  };

  donorPoints.forEach((point, index) => {
    const dx = point.x - CENTER.x;
    const dy = point.y - CENTER.y;
    const length = Math.hypot(dx, dy);

    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angle < 0) angle += 360;

    const delay = ((angle / 360) * SWEEP_SECONDS).toFixed(2) + "s";
    const appear = (0.7 + index * 0.16).toFixed(2) + "s";

    const cx = (point.x + CENTER.x) / 2 + (-dy / length) * point.bend;
    const cy = (point.y + CENTER.y) / 2 + (dx / length) * point.bend;
    const d = `M${point.x} ${point.y} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${CENTER.x} ${CENTER.y}`;

    const link = make("path", { class: "radar-link", d });
    link.style.setProperty("--d", delay);
    linkLayer.appendChild(link);

    const travel = (3 + (index % 3) * 0.4).toFixed(1) + "s";
    const begin = (1.2 + index * 0.45).toFixed(2) + "s";

    const drop = make("circle", { r: "3.4", fill: "#e3294b", opacity: "0" });
    drop.appendChild(make("animateMotion", { dur: travel, begin, repeatCount: "indefinite", path: d, calcMode: "spline", keyTimes: "0;1", keySplines: ".4 0 .6 1" }));
    drop.appendChild(make("animate", { attributeName: "opacity", values: "0;1;1;0", keyTimes: "0;.15;.8;1", dur: travel, begin, repeatCount: "indefinite" }));
    linkLayer.appendChild(drop);

    const group = make("g", { transform: `translate(${point.x} ${point.y})` });
    const pop = make("g", { class: "pin-pop" });
    pop.style.setProperty("--appear", appear);

    pop.appendChild(make("circle", { class: "pin-halo", r: "17" }));

    const ping = make("circle", { class: "pin-ping", r: "7" });
    ping.style.setProperty("--d", delay);
    pop.appendChild(ping);

    pop.appendChild(make("circle", { class: "pin-dot", r: "7" }));

    const tag = make("g", { class: "pin-tag" });
    tag.style.setProperty("--d", delay);
    tag.appendChild(make("rect", { x: "-17", y: "-39", width: "34", height: "19", rx: "9" }));
    const label = make("text", { x: "0", y: "-26" });
    label.textContent = point.type;
    tag.appendChild(label);
    pop.appendChild(tag);

    group.appendChild(pop);
    pinLayer.appendChild(group);
  });

  const counter = $("radarCount");
  const target = donorPoints.length * 3;

  if (REDUCED_MOTION) {
    if (svg.pauseAnimations) svg.pauseAnimations();
    if (counter) counter.textContent = target;
    return;
  }

  animateNumber(counter, target, 1600, 900);

  /* Cycling blood type in the "matching locations" chip */
  const typeBadge = $("radarType");
  let typeIndex = 0;

  if (typeBadge) {
    setInterval(() => {
      if (document.hidden) return;
      typeIndex = (typeIndex + 1) % donorPoints.length;
      typeBadge.textContent = donorPoints[typeIndex].type;
      typeBadge.classList.remove("swap");
      void typeBadge.offsetWidth;
      typeBadge.classList.add("swap");
    }, 2300);
  }

  /* Subtle 3D tilt that follows the pointer */
  const stage = svg.closest(".radar-stage");
  const card = $("radarCard");

  if (stage && card && CAN_HOVER) {
    stage.addEventListener("mousemove", event => {
      const rect = stage.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty("--ry", (px * 7).toFixed(2) + "deg");
      card.style.setProperty("--rx", (-py * 7).toFixed(2) + "deg");
    });

    stage.addEventListener("mouseleave", () => {
      card.style.setProperty("--ry", "0deg");
      card.style.setProperty("--rx", "0deg");
    });
  }
}

/* ==========================================
   FLOATING RED BLOOD CELLS (hero section only)
   Biconcave discs drifting slowly, gently pushed
   away by the pointer.
========================================== */

function initBloodCells() {
  const canvas = $("cellCanvas");
  if (!canvas || REDUCED_MOTION) return;

  const ctx = canvas.getContext("2d");
  let width = 0, height = 0, dpr = 1;
  let cells = [];
  const pointer = { x: -9999, y: -9999 };

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.round(Math.min(22, Math.max(9, width / 70)));
    cells = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 7 + Math.random() * 15,
      vx: (Math.random() - 0.5) * 0.18,
      vy: -0.08 - Math.random() * 0.22,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.004,
      tilt: 0.45 + Math.random() * 0.55,
      alpha: 0.05 + Math.random() * 0.09
    }));
  };

  const drawCell = c => {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    ctx.scale(1, c.tilt);

    const g = ctx.createRadialGradient(0, 0, c.r * 0.15, 0, 0, c.r);
    g.addColorStop(0, `rgba(190,20,50,${c.alpha * 0.45})`);
    g.addColorStop(0.55, `rgba(227,41,75,${c.alpha * 0.9})`);
    g.addColorStop(1, `rgba(227,41,75,${c.alpha * 1.4})`);

    ctx.beginPath();
    ctx.arc(0, 0, c.r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    /* concave centre highlight */
    ctx.beginPath();
    ctx.arc(0, 0, c.r * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${c.alpha * 0.9})`;
    ctx.fill();
    ctx.restore();
  };

  let running = true;

  const frame = () => {
    if (!running) return;
    ctx.clearRect(0, 0, width, height);

    cells.forEach(c => {
      const dx = c.x - pointer.x;
      const dy = c.y - pointer.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 140 && dist > 0) {
        const force = (140 - dist) / 140 * 0.6;
        c.x += (dx / dist) * force;
        c.y += (dy / dist) * force;
      }

      c.x += c.vx;
      c.y += c.vy;
      c.rot += c.vr;

      if (c.y < -40) { c.y = height + 40; c.x = Math.random() * width; }
      if (c.x < -40) c.x = width + 40;
      if (c.x > width + 40) c.x = -40;

      drawCell(c);
    });

    requestAnimationFrame(frame);
  };

  resize();
  window.addEventListener("resize", resize);
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas.parentElement);

  window.addEventListener("pointermove", e => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
  });

  /* Only animate while the hero is on screen and the tab is visible */
  let inView = true;
  const setRunning = () => {
    const next = inView && !document.hidden;
    if (next && !running) { running = true; requestAnimationFrame(frame); }
    else running = next;
  };
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      setRunning();
    }).observe(canvas.parentElement);
  }
  document.addEventListener("visibilitychange", setRunning);
  requestAnimationFrame(frame);
}

/* ==========================================
   HEARTBEAT / BPM + STATS + SCROLL EFFECTS
========================================== */

function initHeartbeat() {
  const bpm = $("bpmValue");
  if (!bpm || REDUCED_MOTION) return;
  setInterval(() => {
    if (document.hidden) return;
    bpm.textContent = 68 + Math.round(Math.random() * 10);
  }, 1800);
}

function initStats() {
  const values = {
    donors: sampleDonors.length,
    available: sampleDonors.filter(d => d.available).length,
    cities: new Set(sampleDonors.map(d => d.city)).size,
    types: new Set(sampleDonors.map(d => d.type)).size
  };

  const els = document.querySelectorAll("[data-count]");
  const start = () => els.forEach((el, i) => animateNumber(el, values[el.dataset.count] || 0, 1300, i * 120));

  const strip = document.querySelector(".stats-strip");
  if (!strip || !("IntersectionObserver" in window)) { start(); return; }

  const io = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) { start(); io.disconnect(); }
  }, { threshold: 0.4 });
  io.observe(strip);
}

function initScrollEffects() {
  /* Reveal on scroll */
  const items = document.querySelectorAll("[data-reveal]");
  if (REDUCED_MOTION || !("IntersectionObserver" in window)) {
    items.forEach(el => el.classList.add("revealed"));
  } else {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    items.forEach(el => io.observe(el));
  }

  /* Blood-vessel progress bar + topbar shadow */
  const bar = $("scrollProgress");
  const topbar = document.querySelector(".topbar");
  let ticking = false;

  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? window.scrollY / max : 0;
    if (bar) bar.style.transform = `scaleX(${p.toFixed(4)})`;
    if (topbar) topbar.classList.toggle("scrolled", window.scrollY > 8);
    ticking = false;
  };

  window.addEventListener("scroll", () => {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
  update();
}

/* ==========================================
   START APPLICATION
========================================== */

initRadar();
initBloodCells();
initHeartbeat();
initStats();
initScrollEffects();
initDonorMap();
renderCompatPanel();
renderDonors();