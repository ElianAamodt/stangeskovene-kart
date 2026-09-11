(function (window, document) {
  "use strict";

  var VERSION = "0.1.0";

  function mount(root) {
    var target = typeof root === "string" ? document.querySelector(root) : root;

    if (!target) {
      return { ok: false, reason: "missing-root", version: VERSION };
    }

    target.setAttribute("data-stangeskovene-map-ready", "true");
    target.dispatchEvent(
      new CustomEvent("stangeskovene:kartklart", {
        bubbles: true,
        detail: { version: VERSION },
      })
    );

    return { ok: true, root: target, version: VERSION };
  }

  window.StangeskoveneKart = Object.freeze({
    version: VERSION,
    mount: mount,
  });
})(window, document);

