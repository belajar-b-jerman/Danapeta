(function () {
  var installPrompt = null;
  var buttonId = "danapeta-install-button";
  var cardId = "danapeta-ios-install-card";
  var basePath = "/Danapeta/";

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function isIosSafari() {
    var ua = window.navigator.userAgent.toLowerCase();
    var isIos = /iphone|ipad|ipod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    var isSafari = /safari/.test(ua) && !/crios|fxios|edgios/.test(ua);
    return isIos && isSafari;
  }

  function removeInstallUi() {
    var button = document.getElementById(buttonId);
    var card = document.getElementById(cardId);
    if (button) button.remove();
    if (card) card.remove();
  }

  function baseStyle(el) {
    el.style.position = "fixed";
    el.style.right = "16px";
    el.style.zIndex = "9999";
    el.style.border = "0";
    el.style.borderRadius = "14px";
    el.style.boxShadow = "0 16px 36px rgba(15, 29, 43, 0.18)";
    el.style.fontFamily = "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  }

  function createInstallButton() {
    if (isStandalone() || document.getElementById(buttonId)) return;

    var button = document.createElement("button");
    button.id = buttonId;
    button.type = "button";
    button.textContent = "Install DANAPETA";
    baseStyle(button);
    button.style.bottom = "88px";
    button.style.padding = "12px 16px";
    button.style.background = "#203040";
    button.style.color = "#fff";
    button.style.fontSize = "14px";
    button.style.fontWeight = "700";
    button.style.cursor = "pointer";

    button.addEventListener("click", async function () {
      if (!installPrompt) return;
      installPrompt.prompt();
      var choice = await installPrompt.userChoice;
      if (choice && choice.outcome === "accepted") {
        installPrompt = null;
        removeInstallUi();
      }
    });

    document.body.appendChild(button);
  }

  function createIosHint() {
    if (isStandalone() || !isIosSafari() || document.getElementById(cardId)) return;

    var card = document.createElement("div");
    card.id = cardId;
    baseStyle(card);
    card.style.left = "16px";
    card.style.right = "16px";
    card.style.bottom = "84px";
    card.style.padding = "14px 44px 14px 16px";
    card.style.background = "#fffaf2";
    card.style.color = "#203040";
    card.style.fontSize = "13px";
    card.style.lineHeight = "1.45";
    card.innerHTML = "<strong>Install DANAPETA</strong><br />Di Safari, tap Share lalu pilih Add to Home Screen.";

    var close = document.createElement("button");
    close.type = "button";
    close.textContent = "x";
    close.style.position = "absolute";
    close.style.top = "8px";
    close.style.right = "10px";
    close.style.border = "0";
    close.style.background = "transparent";
    close.style.fontSize = "18px";
    close.style.cursor = "pointer";
    close.setAttribute("aria-label", "Tutup panduan install");
    close.addEventListener("click", function () {
      card.remove();
      try {
        localStorage.setItem("danapeta-ios-install-dismissed", "1");
      } catch (error) {}
    });

    try {
      if (localStorage.getItem("danapeta-ios-install-dismissed") === "1") return;
    } catch (error) {}

    card.appendChild(close);
    document.body.appendChild(card);
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register(basePath + "sw.js", { scope: basePath });
    });
  }

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    installPrompt = event;
    createInstallButton();
  });

  window.addEventListener("appinstalled", removeInstallUi);
  window.addEventListener("load", function () {
    setTimeout(createIosHint, 1200);
  });
})();
