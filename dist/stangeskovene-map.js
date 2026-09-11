(function (window, document) {
  "use strict";

  var VERSION = "1.0.0";
  var COLORS = { forest: "#063528", deep: "#04241b", lime: "#d7e08d", coral: "#e8543f", white: "#ffffff" };
  var TYPE_LABELS = { omrade: "Område", hytte: "Hytte", vei: "Vei" };

  function textField(node, key) {
    var field = node.querySelector('[data-field="' + key + '"]');
    return field ? field.textContent.replace(/\s+/g, " ").trim() : "";
  }
  function numberField(node, key) {
    var raw = textField(node, key);
    if (!raw) return null;
    var value = Number(String(raw).replace(",", "."));
    return Number.isFinite(value) ? value : null;
  }
  function normalize(value) {
    return String(value || "").toLocaleLowerCase("nb-NO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  function itemUrl(type, item) {
    if (item.external) return item.external;
    if (type === "hytte" && item.slug) return "/" + item.slug;
    if (type === "vei") return "/veiavgift" + (item.slug ? "#" + item.slug : "");
    if (type === "omrade") return "/vare-skogeiendommer" + (item.slug ? "#" + item.slug : "");
    return "";
  }
  function collectItems() {
    var items = [];
    document.querySelectorAll("[data-stangeskovene-source] [data-map-item]").forEach(function (node, index) {
      var type = node.getAttribute("data-type") || "omrade";
      var item = {
        id: type + "-" + (textField(node, "slug") || index), type: type,
        name: textField(node, "name") || "Uten navn", lat: numberField(node, "lat"), lng: numberField(node, "lng"),
        status: textField(node, "status"), description: textField(node, "description"), price: textField(node, "price"),
        region: textField(node, "region"), slug: textField(node, "slug"), external: textField(node, "external"), geojson: textField(node, "geojson")
      };
      item.url = itemUrl(type, item);
      item.search = normalize([item.name, item.status, item.description, item.price, item.region, TYPE_LABELS[type]].join(" "));
      items.push(item);
    });
    return items;
  }
  function escapeHtml(value) {
    return String(value || "").replace(/[&<>\"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[character];
    });
  }

  function mount(root) {
    var target = typeof root === "string" ? document.querySelector(root) : root;
    if (!target) return { ok: false, reason: "missing-root", version: VERSION };
    if (target.getAttribute("data-stangeskovene-map-ready") === "true") return { ok: true, reason: "already-mounted", root: target, version: VERSION };

    var canvas = target.querySelector("[data-map-canvas]");
    var results = target.querySelector("[data-map-results]");
    var count = target.querySelector("[data-map-count]");
    var search = target.querySelector("[data-map-search]");
    var chips = target.querySelector("[data-map-chips]");
    var empty = target.querySelector("[data-map-empty]");
    var follow = target.querySelector("[data-map-follow]");
    var reset = target.querySelector("[data-map-reset]");
    var typeButtons = Array.prototype.slice.call(target.querySelectorAll("[data-map-type]"));
    var viewButtons = Array.prototype.slice.call(target.querySelectorAll("[data-map-view]"));
    var items = collectItems();

    if (!canvas || !results || !count || !chips || !empty) {
      target.setAttribute("data-map-error", "missing-structure");
      return { ok: false, reason: "missing-structure", version: VERSION };
    }

    var state = { type: "alle", query: "", selected: null, view: "list" };
    var map = null;
    var markerLayer = null;
    var polygonLayer = null;
    var markers = new Map();
    var polygonsLoaded = false;

    function markerIcon(item, selected) {
      var color = selected ? COLORS.coral : item.type === "omrade" ? COLORS.lime : COLORS.forest;
      var border = item.type === "omrade" && !selected ? COLORS.forest : COLORS.white;
      return window.L.divIcon({
        className: "sk-map-marker-shell",
        html: '<span class="sk-map-marker sk-map-marker--' + item.type + '" style="background:' + color + ";border-color:" + border + '" aria-hidden="true"></span>',
        iconSize: [30, 30], iconAnchor: [15, 15]
      });
    }
    function visibleItems() {
      return items.filter(function (item) {
        return (state.type === "alle" || item.type === state.type) && (!state.query || item.search.indexOf(state.query) !== -1);
      });
    }
    function fitVisible() {
      if (!map || !follow || !follow.checked) return;
      var coordinates = visibleItems().filter(function (item) { return item.lat !== null && item.lng !== null; });
      if (!coordinates.length) return;
      if (coordinates.length === 1) return map.flyTo([coordinates[0].lat, coordinates[0].lng], 12, { duration: 0.45 });
      map.fitBounds(coordinates.map(function (item) { return [item.lat, item.lng]; }), { padding: [42, 42], maxZoom: 11, animate: true });
    }
    function setSelected(item, moveMap) {
      state.selected = item ? item.id : null;
      markers.forEach(function (marker, id) {
        var match = items.find(function (candidate) { return candidate.id === id; });
        marker.setIcon(markerIcon(match, id === state.selected));
      });
      results.querySelectorAll("[data-result-id]").forEach(function (button) {
        var on = button.getAttribute("data-result-id") === state.selected;
        button.classList.toggle("is-selected", on);
        button.setAttribute("aria-pressed", on ? "true" : "false");
      });
      if (item && map && moveMap && item.lat !== null && item.lng !== null) {
        map.flyTo([item.lat, item.lng], Math.max(map.getZoom(), 12), { duration: 0.45 });
        var marker = markers.get(item.id);
        if (marker) marker.openPopup();
      }
    }
    function cardMarkup(item) {
      var meta = [TYPE_LABELS[item.type], item.region, item.status].filter(Boolean).join(" · ");
      var detail = item.description || item.price || (item.lat === null ? "Kartposisjon kommer." : "Velg for å se stedet i kartet.");
      var price = item.price ? '<span class="sk-map-result-price">' + escapeHtml(item.price) + "</span>" : "";
      return '<article class="sk-map-result"><button type="button" data-result-id="' + escapeHtml(item.id) + '" aria-pressed="false">' +
        '<span class="sk-map-result-meta">' + escapeHtml(meta) + "</span><strong>" + escapeHtml(item.name) + '</strong><span class="sk-map-result-copy">' + escapeHtml(detail) + "</span>" + price +
        (item.lat === null ? '<span class="sk-map-result-note">Ikke plassert i kartet ennå</span>' : "") + "</button>" +
        (item.url ? '<a href="' + escapeHtml(item.url) + '"' + (item.external ? ' target="_blank" rel="noreferrer"' : "") + '>Les mer <span aria-hidden="true">→</span></a>' : "") + "</article>";
    }
    function renderChips() {
      var html = "";
      if (state.type !== "alle") html += '<button type="button" data-remove="type">' + escapeHtml(TYPE_LABELS[state.type]) + ' <span aria-hidden="true">×</span></button>';
      if (state.query) html += '<button type="button" data-remove="query">Søk: ' + escapeHtml(search ? search.value.trim() : state.query) + ' <span aria-hidden="true">×</span></button>';
      chips.innerHTML = html;
      chips.hidden = !html;
      chips.querySelectorAll("[data-remove]").forEach(function (button) {
        button.addEventListener("click", function () {
          if (button.getAttribute("data-remove") === "type") state.type = "alle";
          if (button.getAttribute("data-remove") === "query") { state.query = ""; if (search) search.value = ""; }
          render(true);
        });
      });
    }
    function render(shouldFit) {
      var visible = visibleItems();
      results.innerHTML = visible.map(cardMarkup).join("");
      count.textContent = visible.length + " treff i kart og liste";
      empty.hidden = visible.length !== 0;
      results.hidden = visible.length === 0;
      typeButtons.forEach(function (button) {
        var on = button.getAttribute("data-map-type") === state.type;
        button.classList.toggle("is-active", on);
        button.setAttribute("aria-pressed", on ? "true" : "false");
      });
      renderChips();
      results.querySelectorAll("[data-result-id]").forEach(function (button) {
        button.addEventListener("click", function () {
          var item = items.find(function (candidate) { return candidate.id === button.getAttribute("data-result-id"); });
          if (item) setSelected(item, true);
        });
      });
      markers.forEach(function (marker, id) {
        var show = visible.some(function (item) { return item.id === id; });
        if (show && markerLayer && !markerLayer.hasLayer(marker)) marker.addTo(markerLayer);
        if (!show && markerLayer && markerLayer.hasLayer(marker)) markerLayer.removeLayer(marker);
      });
      if (shouldFit) fitVisible();
    }
    function loadPolygons() {
      if (!map || polygonsLoaded) return;
      polygonsLoaded = true;
      items.filter(function (item) { return item.type === "omrade" && item.geojson; }).forEach(function (item) {
        window.fetch(item.geojson).then(function (response) {
          if (!response.ok) throw new Error("HTTP " + response.status);
          return response.json();
        }).then(function (data) {
          window.L.geoJSON(data, {
            style: { color: COLORS.lime, weight: 2, fillColor: COLORS.lime, fillOpacity: 0.15 },
            onEachFeature: function (_, layer) { layer.bindTooltip(item.name, { sticky: true }); }
          }).addTo(polygonLayer);
        }).catch(function () { target.setAttribute("data-map-polygon-warning", "true"); });
      });
    }
    function initMap() {
      if (!window.L) {
        canvas.innerHTML = '<p class="sk-map-fallback">Kartet kunne ikke lastes. Listen fungerer fortsatt.</p>';
        target.setAttribute("data-map-error", "leaflet-missing");
        return;
      }
      map = window.L.map(canvas, { zoomControl: true, scrollWheelZoom: false, attributionControl: true }).setView([60.17, 11.7], 8);
      window.L.tileLayer("https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png", {
        minZoom: 3, maxZoom: 18,
        attribution: 'Kartgrunnlag © <a href="https://www.kartverket.no/" target="_blank" rel="noreferrer">Kartverket</a>'
      }).addTo(map);
      markerLayer = window.L.layerGroup().addTo(map);
      polygonLayer = window.L.layerGroup().addTo(map);
      items.filter(function (item) { return item.lat !== null && item.lng !== null; }).forEach(function (item) {
        var popup = '<strong class="sk-map-popup-title">' + escapeHtml(item.name) + '</strong><span class="sk-map-popup-type">' + escapeHtml(TYPE_LABELS[item.type]) + "</span>" +
          (item.url ? '<a href="' + escapeHtml(item.url) + '">Les mer →</a>' : "");
        var marker = window.L.marker([item.lat, item.lng], { icon: markerIcon(item, false), keyboard: true, title: item.name }).bindPopup(popup).on("click", function () { setSelected(item, false); });
        marker.addTo(markerLayer);
        markers.set(item.id, marker);
      });
      loadPolygons();
      fitVisible();
      window.setTimeout(function () { map.invalidateSize(); }, 80);
    }

    typeButtons.forEach(function (button) {
      button.addEventListener("click", function () { state.type = button.getAttribute("data-map-type") || "alle"; state.selected = null; render(true); });
    });
    if (search) search.addEventListener("input", function () { state.query = normalize(search.value.trim()); render(true); });
    if (follow) follow.addEventListener("change", function () { if (follow.checked) fitVisible(); });
    if (reset) reset.addEventListener("click", function () { state.type = "alle"; state.query = ""; state.selected = null; if (search) search.value = ""; render(true); });
    viewButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        state.view = button.getAttribute("data-map-view") || "list";
        target.setAttribute("data-mobile-view", state.view);
        viewButtons.forEach(function (candidate) {
          var on = candidate === button;
          candidate.classList.toggle("is-active", on);
          candidate.setAttribute("aria-pressed", on ? "true" : "false");
        });
        if (state.view === "map" && map) window.setTimeout(function () { map.invalidateSize(); }, 30);
      });
    });

    render(false);
    initMap();
    target.setAttribute("data-stangeskovene-map-ready", "true");
    target.dispatchEvent(new CustomEvent("stangeskovene:kartklart", { bubbles: true, detail: { version: VERSION, items: items.length } }));
    return { ok: true, root: target, version: VERSION, items: items.length, map: map };
  }

  function autoMount() {
    var target = document.querySelector("[data-stangeskovene-map]");
    if (target) mount(target);
  }
  window.StangeskoveneKart = Object.freeze({ version: VERSION, mount: mount });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoMount);
  else autoMount();
})(window, document);
