(() => {
  "use strict";

  const LOG_PREFIX = "[InPogodynka]";

  function isValidCoordinate(value) {
    return Number.isFinite(Number(value));
  }

  function cleanText(value) {
    return String(value ?? "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function findLocationObject(value) {
    if (!value || typeof value !== "object") {
      return null;
    }

    if (
      isValidCoordinate(value.latitude) &&
      isValidCoordinate(value.longitude)
    ) {
      return value;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const result = findLocationObject(item);

        if (result) {
          return result;
        }
      }

      return null;
    }

    for (const child of Object.values(value)) {
      const result = findLocationObject(child);

      if (result) {
        return result;
      }
    }

    return null;
  }

  function readJsonLdLocation() {
    const scripts = document.querySelectorAll(
      'script[type="application/ld+json"]'
    );

    for (const script of scripts) {
      try {
        const json = JSON.parse(script.textContent);
        const location = findLocationObject(json);

        if (location) {
          return location;
        }
      } catch (error) {
        console.debug(
          `${LOG_PREFIX} Pominięto niepoprawny JSON-LD`,
          error
        );
      }
    }

    return null;
  }

  function readPageLocation() {
    const location = readJsonLdLocation();

    if (!location) {
      return null;
    }

    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return null;
    }

    return {
      name: cleanText(location.name),
      latitude,
      longitude,
      address: location.address ?? null,
      source: "inpost-jsonld",
      savedAt: new Date().toISOString()
    };
  }

  async function saveLocation() {
    const location = readPageLocation();

    if (!location) {
      console.debug(
        `${LOG_PREFIX} Nie znaleziono współrzędnych`
      );
      return;
    }

    await chrome.storage.local.set({
      inpostLocation: location
    });

    await chrome.storage.local.remove([
      "weatherCache",
      "temperatureHistory"
    ]);

    console.log(
      `${LOG_PREFIX} Zapisano lokalizację Paczkomatu`,
      location
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      saveLocation,
      { once: true }
    );
  } else {
    saveLocation();
  }
})();