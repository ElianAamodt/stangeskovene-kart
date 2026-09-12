(function (window, document) {
  "use strict";

  var VERSION = "1.0.0";
  var state = {
    area: "nes-eidskog",
    age: "adult",
    duration: "day"
  };

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>\"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[character];
    });
  }

  function clean(value) {
    return String(value == null ? "" : value).replace(/^\s+|\s+$/g, "");
  }

  function choiceButton(group, value, label) {
    return '<button type="button" data-fish-choice="' + escapeHtml(group) + '" data-fish-value="' + escapeHtml(value) + '" aria-pressed="false">' + escapeHtml(label) + '</button>';
  }

  function resultFor() {
    if (state.area === "aurskog-holand") {
      return {
        eyebrow: "Aurskog-Høland",
        price: "Egen ordning",
        title: "Se lokal informasjon",
        text: "Fisket administreres separat i Aurskog-Høland. Sjekk gjeldende kort, priser og vilkår før du drar.",
        cta: "Se informasjon om fiskekort"
      };
    }
    if (state.age === "child") {
      return {
        eyebrow: "Nes og Eidskog · under 16 år",
        price: "Gratis",
        title: "Fiskekort uten kostnad",
        text: "Barn under 16 år fisker gratis i vannene som omfattes av ordningen.",
        cta: "Se vilkår og fiskeområder"
      };
    }
    if (state.duration === "year") {
      return {
        eyebrow: "Nes og Eidskog · årskort",
        price: "300 kr",
        title: "For deg som fisker flere ganger",
        text: "Årskortet gjelder for vannene som inngår i Stangeskovenes fiskekortordning i Nes og Eidskog.",
        cta: "Gå til fiskekort"
      };
    }
    return {
      eyebrow: "Nes og Eidskog · dagskort",
      price: "40 kr",
      title: "For én dag ved vannet",
      text: "Dagskortet gjelder for vannene som inngår i Stangeskovenes fiskekortordning i Nes og Eidskog.",
      cta: "Gå til fiskekort"
    };
  }

  function mount() {
    var article = document.querySelector("article.prose");
    var cards = article && article.querySelector(".card-grid");
    if (!article || !cards || article.querySelector("[data-fish-pass]") || clean(location.pathname).replace(/\/$/, "") !== "/fiske") return;

    var section = document.createElement("section");
    section.className = "fish-pass";
    section.setAttribute("data-fish-pass", "");
    section.setAttribute("aria-labelledby", "fishPassTitle");
    section.innerHTML = '<div class="fish-pass__intro"><div><p class="fish-pass__eyebrow">Fiskekortvelger</p><h2 id="fishPassTitle">Hva passer for turen?</h2></div><p>Velg område, alder og varighet. Du får ett tydelig svar og kan gå videre til kort og vilkår.</p></div>' +
      '<div class="fish-pass__controls">' +
        '<fieldset><legend>1. Område</legend><div class="fish-pass__choices">' + choiceButton("area", "nes-eidskog", "Nes og Eidskog") + choiceButton("area", "aurskog-holand", "Aurskog-Høland") + '</div></fieldset>' +
        '<fieldset><legend>2. Alder</legend><div class="fish-pass__choices">' + choiceButton("age", "adult", "16 år eller eldre") + choiceButton("age", "child", "Under 16 år") + '</div></fieldset>' +
        '<fieldset data-fish-duration><legend>3. Varighet</legend><div class="fish-pass__choices">' + choiceButton("duration", "day", "Én dag") + choiceButton("duration", "year", "Hele året") + '</div></fieldset>' +
      '</div>' +
      '<div class="fish-pass__result" aria-live="polite"><div class="fish-pass__price"><span data-fish-eyebrow></span><strong data-fish-price></strong></div><div class="fish-pass__summary"><h3 data-fish-title></h3><p data-fish-text></p></div><a class="fish-pass__cta" href="/fiskekort" data-fish-cta></a></div>' +
      '<p class="fish-pass__note">Prisene over gjelder opplysningene på nettsiden. Kontroller alltid gjeldende regler og hvilke vann kortet omfatter.</p>';
    cards.parentNode.insertBefore(section, cards);

    var buttons = section.querySelectorAll("[data-fish-choice]");
    var duration = section.querySelector("[data-fish-duration]");
    var eyebrow = section.querySelector("[data-fish-eyebrow]");
    var price = section.querySelector("[data-fish-price]");
    var title = section.querySelector("[data-fish-title]");
    var text = section.querySelector("[data-fish-text]");
    var cta = section.querySelector("[data-fish-cta]");

    function render() {
      var result = resultFor();
      Array.prototype.forEach.call(buttons, function (button) {
        var group = button.getAttribute("data-fish-choice");
        var selected = state[group] === button.getAttribute("data-fish-value");
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-pressed", selected ? "true" : "false");
      });
      duration.hidden = state.area === "aurskog-holand" || state.age === "child";
      eyebrow.textContent = result.eyebrow;
      price.textContent = result.price;
      title.textContent = result.title;
      text.textContent = result.text;
      cta.textContent = result.cta + " →";
    }

    Array.prototype.forEach.call(buttons, function (button) {
      button.addEventListener("click", function () {
        state[button.getAttribute("data-fish-choice")] = button.getAttribute("data-fish-value");
        render();
      });
    });
    render();
  }

  window.StangeskoveneFiskekort = Object.freeze({ version: VERSION, mount: mount });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})(window, document);
