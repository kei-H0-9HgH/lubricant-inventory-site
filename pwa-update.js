(function () {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;

  var currentVersion = window.LUBRICANT_APP_VERSION || "dev";
  var promptedVersion = "";
  var acceptedVersion = "";
  var refreshing = false;

  function swUrl(version) {
    return "./sw.js?v=" + encodeURIComponent(version);
  }

  function ask(message) {
    return window.confirm(message || "新しいバージョンがあります。更新しますか？");
  }

  function activateWaitingWorker(registration) {
    if (!registration || !registration.waiting) return false;
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    return true;
  }

  function watchInstallingWorker(registration, version) {
    var worker = registration && registration.installing;
    if (!worker) return;
    worker.addEventListener("statechange", function () {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        if (acceptedVersion === version) {
          activateWaitingWorker(registration);
          return;
        }
        if (promptedVersion === version) return;
        promptedVersion = version;
        if (ask()) {
          acceptedVersion = version;
          activateWaitingWorker(registration);
        }
      }
    });
  }

  function registerVersion(version, shouldPrompt) {
    return navigator.serviceWorker.register(swUrl(version)).then(function (registration) {
      if (registration.waiting && navigator.serviceWorker.controller && shouldPrompt) {
        if (promptedVersion !== version) {
          promptedVersion = version;
          if (ask()) {
            acceptedVersion = version;
            activateWaitingWorker(registration);
          }
        }
      }

      registration.addEventListener("updatefound", function () {
        watchInstallingWorker(registration, version);
      });

      return registration;
    });
  }

  function checkRemoteVersion() {
    fetch("./app-version.json?ts=" + Date.now(), {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" }
    })
      .then(function (response) {
        if (!response.ok) throw new Error("version check failed");
        return response.json();
      })
      .then(function (data) {
        var nextVersion = data && data.version;
        if (!nextVersion || nextVersion === currentVersion || promptedVersion === nextVersion) return;
        promptedVersion = nextVersion;
        if (!ask()) return;
        acceptedVersion = nextVersion;
        registerVersion(nextVersion, false).then(function (registration) {
          if (activateWaitingWorker(registration)) return;
          registration.update();
          watchInstallingWorker(registration, nextVersion);
          setTimeout(function () {
            if (!refreshing) location.reload();
          }, 1500);
        });
      })
      .catch(function () {
        // Offline or version file unavailable. Keep current cached app.
      });
  }

  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });

  window.addEventListener("load", function () {
    registerVersion(currentVersion, true)
      .then(function (registration) {
        registration.update();
        checkRemoteVersion();
        setInterval(checkRemoteVersion, 30 * 60 * 1000);
      })
      .catch(function (error) {
        console.warn("Service Worker registration failed:", error);
      });
  });
})();
