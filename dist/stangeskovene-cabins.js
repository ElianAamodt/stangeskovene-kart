(function (window, document) {
  "use strict";

  var VERSION = "1.1.4";
  var state = { need: "alle", guests: 0, query: "", selected: null, compare: [] };

  function field(node, name) {
    var target = node.querySelector('[data-cabin-field="' + name + '"]');
    return target ? target.textContent.replace(/\s+/g, " ").trim() : "";
  }
  function number(value) {
    var raw = String(value || "").trim().replace(",", ".");
    if (!raw) return null;
    var parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  function clean(value) {
    return String(value || "").toLocaleLowerCase("nb-NO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  function escapeHtml(value) {
    return String(value || "").replace(/[&<>\"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[character];
    });
  }
  function collect() {
    return Array.prototype.map.call(document.querySelectorAll("[data-cabin-cms-item]"), function (node) {
      var item = {
        name: field(node, "name"), slug: field(node, "slug"), lat: number(field(node, "lat")), lng: number(field(node, "lng")),
        status: field(node, "status"), description: field(node, "description"), price: field(node, "price"),
        capacity: number(field(node, "capacity")), availability: field(node, "availability"), access: field(node, "access")
      };
      var haystack = clean([item.name, item.description, item.availability, item.access].join(" "));
      item.features = {
        strom: /strom|elektr/.test(haystack),
        vann: /sjo|strand|vann|bat|fiske/.test(haystack),
        enkel: /enkel|utedo|ikke innlagt|vedovn|gassovn/.test(haystack)
      };
      var verifiedFeatures = {
        buhol: { strom: true, vann: true, enkel: false },
        buneskoia: { strom: true, vann: true, enkel: true },
        sandvika: { strom: false, vann: true, enkel: true },
        tyribua: { strom: false, vann: false, enkel: true }
      };
      if (verifiedFeatures[item.slug]) item.features = verifiedFeatures[item.slug];
      item.search = haystack;
      item.id = item.slug || clean(item.name).replace(/\s+/g, "-");
      item.url = "/hytter/" + item.slug;
      return item;
    }).filter(function (item) { return item.name; });
  }

  function mount() {
    var root = document.querySelector(".estate[data-map]");
    var source = document.querySelector("[data-cabin-cms-source]");
    if (!root || !source || !window.L || root.dataset.cmsCabinsReady === "true") return;
    var items = collect();
    if (!items.length) return;
    root.dataset.mapView = "list";

    var copy = root.querySelector(".estate-copy");
    var list = root.querySelector(".cabin-list");
    var stage = root.querySelector(".map-stage");
    var title = root.querySelector("[data-map-title]");
    var description = root.querySelector("[data-map-text]");
    var action = root.querySelector("[data-map-cta]");
    var detail = root.querySelector(".place-detail");
    if (!copy || !list || !stage) return;

    var controls = document.createElement("div");
    controls.className = "cabin-fit";
    controls.innerHTML = '<div class="cabin-fit-head"><div><span>Finn riktig hytte</span><strong data-cabin-count></strong></div><button type="button" data-cabin-clear hidden>Nullstill filtre</button></div>' +
      '<div class="cabin-fit-row"><label class="cabin-select">Antall personer<select data-cabin-guests><option value="0">Alle størrelser</option><option value="2">1–2 personer</option><option value="4">3–4 personer</option><option value="6">5–6 personer</option><option value="7">7 eller flere</option></select></label>' +
      '<div class="cabin-needs"><span class="cabin-control-label" id="cabinNeedsLabel">Behov</span><div role="group" aria-labelledby="cabinNeedsLabel"><button type="button" class="is-on" data-cabin-need="alle" aria-pressed="true">Alle</button><button type="button" data-cabin-need="strom" aria-pressed="false">Strøm</button><button type="button" data-cabin-need="vann" aria-pressed="false">Nær vann</button><button type="button" data-cabin-need="enkel" aria-pressed="false">Enkel standard</button></div></div></div>';
    list.parentNode.insertBefore(controls, list);

    var compare = document.createElement("div");
    compare.className = "cabin-compare";
    compare.hidden = true;
    list.parentNode.insertBefore(compare, list.nextSibling);

    stage.innerHTML = '<div class="cabin-leaflet" data-cabin-map aria-label="Kart over utleiehyttene"></div>' +
      '<form class="map-search cabin-search" role="search"><svg class="cabin-search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m15.5 15.5 5 5"></path></svg><label class="visually-hidden" for="cabinCmsSearch">Søk</label><input id="cabinCmsSearch" type="search" placeholder="Søk etter hytte eller sted" autocomplete="off"></form>' +
      '<p class="map-caption"><strong>Omtrentlige plasseringer.</strong> Nøyaktig adkomst sendes ved bekreftet bestilling.</p>';

    var map = window.L.map(stage.querySelector("[data-cabin-map]"), { zoomControl: false, scrollWheelZoom: false, attributionControl: true }).setView([60.08, 11.8], 10);
    window.L.control.zoom({ position: "topright", zoomInTitle: "Zoom inn", zoomOutTitle: "Zoom ut" }).addTo(map);
    window.L.tileLayer("https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png", { minZoom: 4, maxZoom: 18, attribution: 'Kartgrunnlag © <a href="https://www.kartverket.no/" target="_blank" rel="noreferrer">Kartverket</a>' }).addTo(map);
    var layer = window.L.layerGroup().addTo(map);
    var markers = new Map();

    function icon(selected) {
      return window.L.divIcon({ className: "cabin-marker-shell", html: '<span class="cabin-marker' + (selected ? " is-on" : "") + '"></span>', iconSize: [34, 34], iconAnchor: [17, 17] });
    }
    function visible() {
      return items.filter(function (item) {
        var guestsOk = !state.guests || (state.guests === 7 ? item.capacity >= 7 : item.capacity >= state.guests);
        var needOk = state.need === "alle" || item.features[state.need];
        var queryOk = !state.query || item.search.indexOf(state.query) !== -1;
        return guestsOk && needOk && queryOk;
      });
    }
    function focus(item, move) {
      state.selected = item.id;
      list.querySelectorAll(".cabin-choice").forEach(function (button) {
        var on = button.dataset.cabin === item.id;
        button.classList.toggle("is-on", on);
        button.setAttribute("aria-pressed", on ? "true" : "false");
      });
      markers.forEach(function (marker, id) { marker.setIcon(icon(id === item.id)); });
      if (title) title.textContent = item.name;
      if (description) description.textContent = item.description;
      if (action) { action.href = item.url; action.innerHTML = "Se hytte og priser <span>→</span>"; }
      if (move && item.lat !== null && item.lng !== null) map.flyTo([item.lat, item.lng], 13, { duration: 0.45 });
    }
    function compareMarkup() {
      var chosen = state.compare.map(function (id) { return items.find(function (item) { return item.id === id; }); }).filter(Boolean);
      compare.hidden = chosen.length === 0;
      if (!chosen.length) return;
      compare.innerHTML = '<div class="cabin-compare-head"><span>Sammenlign hytter</span><strong>' + chosen.length + ' av 2 valgt</strong></div><div class="cabin-compare-grid">' + chosen.map(function (item) {
        return '<article><button type="button" data-remove-compare="' + escapeHtml(item.id) + '" aria-label="Fjern ' + escapeHtml(item.name) + '">×</button><strong>' + escapeHtml(item.name) + '</strong><dl><div><dt>Plass</dt><dd>' + escapeHtml(item.capacity ? item.capacity + " personer" : "Ikke oppgitt") + '</dd></div><div><dt>Pris</dt><dd>' + escapeHtml(item.price || "Pris på forespørsel") + '</dd></div><div><dt>Strøm</dt><dd>' + (item.features.strom ? "Ja" : "Nei / ikke oppgitt") + '</dd></div></dl><a href="' + escapeHtml(item.url) + '">Se hytta →</a></article>';
      }).join("") + "</div>";
      compare.querySelectorAll("[data-remove-compare]").forEach(function (button) {
        button.addEventListener("click", function () { state.compare = state.compare.filter(function (id) { return id !== button.dataset.removeCompare; }); render(false); });
      });
    }
    function render(fit) {
      var shown = visible();
      var count = controls.querySelector("[data-cabin-count]");
      var clearButton = controls.querySelector("[data-cabin-clear]");
      count.textContent = shown.length + (shown.length === 1 ? " hytte passer" : " hytter passer");
      clearButton.hidden = state.need === "alle" && !state.guests && !state.query;
      list.innerHTML = shown.length ? shown.map(function (item) {
        var checked = state.compare.indexOf(item.id) !== -1;
        var disabled = state.compare.length >= 2 && !checked;
        return '<div class="cabin-choice-row"><button class="cabin-choice' + (state.selected === item.id ? " is-on" : "") + '" type="button" data-cabin="' + escapeHtml(item.id) + '" aria-pressed="' + (state.selected === item.id ? "true" : "false") + '"><span class="choice-name"><strong>' + escapeHtml(item.name) + '</strong><span>' + escapeHtml([item.capacity ? item.capacity + " personer" : "", item.availability].filter(Boolean).join(" · ")) + '</span></span><span class="choice-price">' + escapeHtml(item.price || "Pris på forespørsel") + '</span></button><label class="cabin-compare-check' + (checked ? " is-on" : "") + (disabled ? " is-disabled" : "") + '"><input type="checkbox" data-compare="' + escapeHtml(item.id) + '"' + (checked ? " checked" : "") + (disabled ? " disabled" : "") + '><span>' + (checked ? "Valgt" : "Sammenlign") + '</span></label></div>';
      }).join("") : '<div class="cabin-no-match"><strong>Ingen hytter passer alle valgene.</strong><button type="button" data-cabin-clear>Vis alle hytter</button></div>';
      list.querySelectorAll(".cabin-choice").forEach(function (button) { button.addEventListener("click", function () { var item = items.find(function (candidate) { return candidate.id === button.dataset.cabin; }); if (item) focus(item, true); }); });
      list.querySelectorAll("[data-compare]").forEach(function (input) { input.addEventListener("change", function () {
        if (input.checked && state.compare.length >= 2) { input.checked = false; return; }
        state.compare = input.checked ? state.compare.concat(input.dataset.compare) : state.compare.filter(function (id) { return id !== input.dataset.compare; });
        render(false);
      }); });
      list.querySelectorAll("[data-cabin-clear]").forEach(function (button) { button.addEventListener("click", clear); });
      markers.forEach(function (marker, id) { var show = shown.some(function (item) { return item.id === id; }); if (show && !layer.hasLayer(marker)) marker.addTo(layer); if (!show && layer.hasLayer(marker)) layer.removeLayer(marker); });
      if (detail) detail.hidden = shown.length === 0;
      if (shown.length && !shown.some(function (item) { return item.id === state.selected; })) focus(shown[0], false);
      compareMarkup();
      if (fit) {
        var located = shown.filter(function (item) { return item.lat !== null && item.lng !== null; });
        if (located.length === 1) map.flyTo([located[0].lat, located[0].lng], 13, { duration: 0.45 });
        else if (located.length > 1) map.fitBounds(located.map(function (item) { return [item.lat, item.lng]; }), { padding: [55, 55], maxZoom: 11 });
      }
    }
    function clear() {
      state.need = "alle"; state.guests = 0; state.query = "";
      controls.querySelector("[data-cabin-guests]").value = "0";
      stage.querySelector("#cabinCmsSearch").value = "";
      controls.querySelectorAll("[data-cabin-need]").forEach(function (button) { var on = button.dataset.cabinNeed === "alle"; button.classList.toggle("is-on", on); button.setAttribute("aria-pressed", on ? "true" : "false"); });
      render(true);
    }

    items.forEach(function (item) {
      if (item.lat === null || item.lng === null) return;
      var marker = window.L.marker([item.lat, item.lng], { icon: icon(false), keyboard: true, title: item.name }).on("click", function () { focus(item, false); });
      marker.bindTooltip(item.name, { direction: "top", offset: [0, -12] }).addTo(layer);
      markers.set(item.id, marker);
    });
    controls.querySelector("[data-cabin-guests]").addEventListener("change", function (event) { state.guests = Number(event.target.value); render(true); });
    controls.querySelectorAll("[data-cabin-need]").forEach(function (button) { button.addEventListener("click", function () { state.need = button.dataset.cabinNeed; controls.querySelectorAll("[data-cabin-need]").forEach(function (candidate) { var on = candidate === button; candidate.classList.toggle("is-on", on); candidate.setAttribute("aria-pressed", on ? "true" : "false"); }); render(true); }); });
    controls.querySelector("[data-cabin-clear]").addEventListener("click", clear);
    var search = stage.querySelector("#cabinCmsSearch");
    search.closest("form").addEventListener("submit", function (event) { event.preventDefault(); });
    search.addEventListener("input", function () { state.query = clean(search.value.trim()); render(true); });
    root.querySelectorAll("button[data-map-view]").forEach(function (button) { button.addEventListener("click", function () { var view = button.dataset.mapView; root.dataset.mapView = view; root.querySelectorAll("button[data-map-view]").forEach(function (candidate) { var on = candidate === button; candidate.setAttribute("aria-pressed", on ? "true" : "false"); }); if (view === "map") window.setTimeout(function () { map.invalidateSize(); }, 50); }); });

    state.selected = items[0].id;
    render(true);
    focus(items[0], false);
    root.dataset.cmsCabinsReady = "true";
    window.setTimeout(function () { map.invalidateSize(); }, 100);
  }

  window.StangeskoveneHytter = Object.freeze({ version: VERSION, mount: mount });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})(window, document);
