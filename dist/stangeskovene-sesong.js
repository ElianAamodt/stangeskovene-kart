(function (window, document) {
  "use strict";

  var VERSION = "2.0.0";
  var months = ["Jan", "Feb", "Mar", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Des"];
  var monthNames = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];
  var periods = [
    { id: "smarovdyr", tone: "lime", name: "Smårovdyr", start: [1, 1], end: [4, 15], range: "1. januar–15. april", text: "Kortet dekker flere arter og områder. Artsvise jakttider gjelder.", url: "/smarovdyrkort" },
    { id: "taksering", tone: "light", name: "Skogsfugltaksering", start: [8, 8], end: [8, 21], range: "Normalt 8.–21. august", text: "Årlig taksering med hundefører og observatør. Nye taksører kan melde interesse.", url: "/skogsfugltaksering" },
    { id: "rabukk", tone: "mist", name: "Råbukk", start: [8, 10], end: [9, 9], range: "10. august–9. september", text: "Et begrenset antall kort for arealer i Aurskog-Høland og Nes.", url: "/jakt-etter-rabukk" },
    { id: "baronskogen", tone: "forest", name: "Elgjakt på Baronskogen", start: [9, 25], end: [12, 23], range: "25. september–23. desember", text: "Tilrettelagt gjestejakt med hund på Baronskogen i Nes.", url: "/tilrettelagt-elgjakt-pa-baronskogen" }
  ];

  function dateFor(year, pair) {
    return new Date(year, pair[0] - 1, pair[1], 12, 0, 0, 0);
  }

  function activeInMonth(period, month) {
    return month === "all" || (month >= period.start[0] && month <= period.end[0]);
  }

  function statusFor(period, now) {
    var year = now.getFullYear();
    var start = dateFor(year, period.start);
    var end = dateFor(year, period.end);
    var next = dateFor(year + 1, period.start);
    if (now >= start && now <= end) return "Pågår nå";
    if (now < start) return "Starter " + period.start[1] + ". " + monthNames[period.start[0] - 1];
    return "Neste periode " + next.getDate() + ". " + monthNames[next.getMonth()];
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>\"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[character];
    });
  }

  function calendarCells(period) {
    return months.map(function (name, index) {
      var month = index + 1;
      var active = month >= period.start[0] && month <= period.end[0];
      var classes = "hunt-season__calendar-cell" + (active ? " has-period is-" + period.tone : "");
      var label = active ? period.name + " – " + name : "Ingen oppgitt periode for " + period.name + " i " + name;
      return '<span class="' + classes + '" data-calendar-month="' + month + '" aria-label="' + escapeHtml(label) + '">' + (active ? '<i aria-hidden="true"></i>' : '') + '</span>';
    }).join("");
  }

  function mount() {
    var article = document.querySelector("article.prose");
    var cards = article && article.querySelector(".card-grid");
    if (!article || !cards || article.querySelector("[data-hunt-season]") || location.pathname.replace(/\/$/, "") !== "/jakt") return;

    var now = new Date();
    var currentMonth = now.getMonth() + 1;
    var section = document.createElement("section");
    section.className = "hunt-season";
    section.setAttribute("data-hunt-season", "");
    section.setAttribute("aria-labelledby", "huntSeasonTitle");
    section.innerHTML = '<div class="hunt-season__intro"><div><p class="hunt-season__eyebrow">Årskalender</p><h2 id="huntSeasonTitle">Når skjer hva?</h2></div><p class="hunt-season__intro-text">Se de oppgitte periodene gjennom året. Velg en måned for å fremheve kalenderen og avgrense detaljene under.</p></div>' +
      '<div class="hunt-season__calendar" role="region" aria-label="Jaktkalender. Dra sidelengs for å se hele året." tabindex="0"><div class="hunt-season__calendar-grid"><div class="hunt-season__calendar-head"><button type="button" data-season-month="all">Hele året</button></div>' + months.map(function (name, index) { var month = index + 1; return '<div class="hunt-season__calendar-head" data-calendar-month="' + month + '"><button type="button" data-season-month="' + month + '"' + (month === currentMonth ? ' class="is-current"' : "") + '>' + name + '</button></div>'; }).join("") + periods.map(function (period) { return '<a class="hunt-season__calendar-label" href="' + escapeHtml(period.url) + '"><span class="hunt-season__swatch is-' + period.tone + '" aria-hidden="true"></span><strong>' + escapeHtml(period.name) + '</strong><small>' + escapeHtml(period.range) + '</small></a>' + calendarCells(period); }).join("") + '</div></div>' +
      '<div class="hunt-season__detail-head"><p class="hunt-season__result" aria-live="polite"></p><span>Oppgitte perioder</span></div><ul class="hunt-season__list">' + periods.map(function (period) { return '<li class="hunt-season__item is-' + period.tone + '" data-season-start="' + period.start[0] + '" data-season-end="' + period.end[0] + '"><div class="hunt-season__date"><strong>' + escapeHtml(period.range) + '</strong><span>Oppgitt periode</span></div><div class="hunt-season__copy"><strong>' + escapeHtml(period.name) + '</strong><span>' + escapeHtml(period.text) + '</span><a href="' + escapeHtml(period.url) + '">Les mer <span aria-hidden="true">→</span></a></div><span class="hunt-season__status">' + escapeHtml(statusFor(period, now)) + '</span></li>'; }).join("") + '<li class="hunt-season__empty" hidden><strong>Ingen oppgitte perioder denne måneden.</strong><span>Kalenderen viser fortsatt helheten. Velg «Hele året» for alle detaljene.</span></li></ul><p class="hunt-season__note">Periodene er en oversikt. Kontroller alltid gjeldende jakttider, tilgjengelighet og vilkår før jakt.</p>';
    cards.parentNode.insertBefore(section, cards);

    var calendar = section.querySelector(".hunt-season__calendar");
    var buttons = section.querySelectorAll("[data-season-month]");
    var calendarMonths = section.querySelectorAll("[data-calendar-month]");
    var items = section.querySelectorAll(".hunt-season__item");
    var result = section.querySelector(".hunt-season__result");
    var empty = section.querySelector(".hunt-season__empty");

    function selectMonth(value) {
      var month = value === "all" ? "all" : Number(value);
      var count = 0;
      Array.prototype.forEach.call(buttons, function (button) {
        var on = button.getAttribute("data-season-month") === String(value);
        button.classList.toggle("is-active", on);
        button.setAttribute("aria-pressed", on ? "true" : "false");
      });
      Array.prototype.forEach.call(items, function (item, index) {
        var show = activeInMonth(periods[index], month);
        item.hidden = !show;
        if (show) count += 1;
      });
      Array.prototype.forEach.call(calendarMonths, function (cell) {
        var selected = month !== "all" && Number(cell.getAttribute("data-calendar-month")) === month;
        cell.classList.toggle("is-selected-month", selected);
      });
      empty.hidden = count !== 0;
      result.textContent = month === "all" ? periods.length + " dokumenterte perioder" : count + (count === 1 ? " periode i " : " perioder i ") + monthNames[month - 1];
      if (month !== "all" && window.innerWidth < 768) {
        var header = section.querySelector('.hunt-season__calendar-head[data-calendar-month="' + month + '"]');
        if (header) calendar.scrollLeft = Math.max(0, header.offsetLeft - 152);
      }
    }

    Array.prototype.forEach.call(buttons, function (button) {
      button.addEventListener("click", function () { selectMonth(button.getAttribute("data-season-month")); });
    });
    selectMonth(String(currentMonth));
  }

  window.StangeskoveneSesong = Object.freeze({ version: VERSION, mount: mount });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})(window, document);
