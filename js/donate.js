
document.addEventListener("DOMContentLoaded", () => {
    const mapElement = document.getElementById("locationMap");
    const status = document.getElementById("mapStatus");

    if (!mapElement || typeof L === "undefined") {
        if (status) {
            status.textContent =
                "Map could not load. Please check the Leaflet library.";
        }
        return;
    }

    const map = L.map(mapElement).setView(
        [32.5556, 35.8500],
        13
    );

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors"
        }
    ).addTo(map);

    const marker = L.marker([32.5556, 35.8500], {
        draggable: true
    }).addTo(map);

    marker.bindPopup("Your selected donation location");

    if (status) {
        status.textContent = "Map loaded successfully.";
        status.classList.remove("error");
    }

    setTimeout(() => map.invalidateSize(), 300);
});
