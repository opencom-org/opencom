(function (w, d) {
  var FALLBACK_VERSION = "__OPENCOM_WIDGET_FALLBACK_VERSION__";
  var METHOD_NAMES = [
    "init",
    "identify",
    "trackEvent",
    "startTour",
    "getAvailableTours",
    "destroy",
  ];
  var api = w.OpencomWidget && typeof w.OpencomWidget === "object" ? w.OpencomWidget : {};
  var queue = Array.isArray(api.q) ? api.q : [];
  var currentScript = d.currentScript;
  var baseUrl = "https://cdn.opencom.dev/";

  function isRecord(value) {
    return value !== null && typeof value === "object";
  }

  function parseBoolean(value) {
    if (typeof value !== "string") return undefined;
    var normalized = value.trim().toLowerCase();
    if (normalized === "") return true;
    if (
      normalized === "1" ||
      normalized === "true" ||
      normalized === "yes" ||
      normalized === "on"
    ) {
      return true;
    }
    if (
      normalized === "0" ||
      normalized === "false" ||
      normalized === "no" ||
      normalized === "off"
    ) {
      return false;
    }
    return undefined;
  }

  function getScriptConfig() {
    if (!currentScript || !currentScript.dataset) return null;

    var data = currentScript.dataset;
    var config = {};

    if (typeof data.opencomConvexUrl === "string" && data.opencomConvexUrl) {
      config.convexUrl = data.opencomConvexUrl.trim();
    }

    if (typeof data.opencomWorkspaceId === "string" && data.opencomWorkspaceId) {
      config.workspaceId = data.opencomWorkspaceId.trim();
    }

    if (
      typeof data.opencomOnboardingVerificationToken === "string" &&
      data.opencomOnboardingVerificationToken
    ) {
      config.onboardingVerificationToken = data.opencomOnboardingVerificationToken;
    } else if (typeof data.opencomVerificationToken === "string" && data.opencomVerificationToken) {
      config.onboardingVerificationToken = data.opencomVerificationToken;
    }

    if (typeof data.opencomClientIdentifier === "string" && data.opencomClientIdentifier) {
      config.clientIdentifier = data.opencomClientIdentifier.trim();
    }

    var trackPageViews = parseBoolean(data.opencomTrackPageViews);
    if (typeof trackPageViews === "boolean") {
      config.trackPageViews = trackPageViews;
    }

    return config;
  }

  function publishAutoInitConfig() {
    var scriptConfig = getScriptConfig();
    var settingsConfig = isRecord(w.opencomSettings) ? w.opencomSettings : null;
    var merged = {};
    var key;

    if (isRecord(scriptConfig)) {
      for (key in scriptConfig) merged[key] = scriptConfig[key];
    }

    if (settingsConfig) {
      for (key in settingsConfig) merged[key] = settingsConfig[key];
    }

    if (typeof merged.convexUrl === "string" && merged.convexUrl.trim()) {
      merged.convexUrl = merged.convexUrl.trim();
      if (typeof merged.workspaceId === "string") {
        merged.workspaceId = merged.workspaceId.trim();
      }
      w.__OPENCOM_WIDGET_AUTO_INIT_CONFIG = merged;
    }
  }

  api.q = queue;
  for (var i = 0; i < METHOD_NAMES.length; i++) {
    (function (method) {
      if (typeof api[method] !== "function") {
        api[method] = function () {
          queue.push([method, [].slice.call(arguments)]);
          if (method === "getAvailableTours") return [];
        };
      }
    })(METHOD_NAMES[i]);
  }
  w.OpencomWidget = api;

  try {
    baseUrl =
      new URL(".", (currentScript && currentScript.src) || "https://cdn.opencom.dev/widget.js") +
      "";
  } catch (_error) {
    baseUrl = "https://cdn.opencom.dev/";
  }

  publishAutoInitConfig();

  function flushQueue() {
    var runtimeApi = w.OpencomWidget;
    var pending = queue.splice(0);
    if (!runtimeApi || runtimeApi === api || !pending.length) return;
    for (var j = 0; j < pending.length; j++) {
      var call = pending[j];
      var fn = runtimeApi[call[0]];
      if (typeof fn === "function") {
        fn.apply(runtimeApi, call[1]);
      }
    }
  }

  function injectRuntime(version) {
    if (injectRuntime.loaded) return;
    injectRuntime.loaded = true;
    w.__OPENCOM_WIDGET_DEPLOY_VERSION = version;

    var runtimeScript = d.createElement("script");
    runtimeScript.async = true;
    runtimeScript.src = new URL("v/" + version + "/widget.js", baseUrl) + "";
    runtimeScript.onload = flushQueue;
    runtimeScript.onerror = function () {
      console.error("[OpencomLoader] runtime load failed", runtimeScript.src);
    };
    (d.head || d.body || d.documentElement).appendChild(runtimeScript);
  }

  var timeout = setTimeout(function () {
    console.warn("[OpencomLoader] manifest timeout, using fallback", FALLBACK_VERSION);
    injectRuntime(FALLBACK_VERSION);
  }, 3000);

  fetch(new URL("manifest.json", baseUrl), { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) throw new Error("status " + response.status);
      return response.json();
    })
    .then(
      function (manifest) {
        clearTimeout(timeout);
        injectRuntime(
          manifest && typeof manifest.latest === "string" && manifest.latest
            ? manifest.latest
            : FALLBACK_VERSION
        );
      },
      function (error) {
        clearTimeout(timeout);
        console.warn("[OpencomLoader] manifest fetch failed, using fallback", error);
        injectRuntime(FALLBACK_VERSION);
      }
    );
})(window, document);
