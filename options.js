const form = document.getElementById("settings-form");
const urlInput = document.getElementById("locker-url");
const statusElement = document.getElementById("status");
const previewElement = document.getElementById("preview");

document.addEventListener("DOMContentLoaded", loadSettings);

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const url = urlInput.value.trim();

  if (!isValidInPostUrl(url)) {
    showStatus(
      "Wpisz prawidłowy adres strony inpost.pl.",
      "error"
    );
    return;
  }

  setFormState(true);
  showStatus("Pobieranie danych paczkomatu...", "info");

  try {
    const response = await chrome.runtime.sendMessage({
      type: "SAVE_LOCKER_URL",
      url
    });

    if (!response?.success) {
      throw new Error(response?.error || "Nie udało się zapisać ustawień.");
    }

    showLockerPreview(response.location);
    showStatus(
      "Ustawienia zapisane. Dane pogodowe zostaną pobrane automatycznie.",
      "success"
    );
  } catch (error) {
    showStatus(error.message, "error");
  } finally {
    setFormState(false);
  }
});

async function loadSettings() {
  const settings = await chrome.storage.local.get("lockerUrl");

  if (settings.lockerUrl) {
    urlInput.value = settings.lockerUrl;
  }
}

function isValidInPostUrl(value) {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      (url.hostname === "inpost.pl" ||
        url.hostname.endsWith(".inpost.pl"))
    );
  } catch {
    return false;
  }
}

function showLockerPreview(location) {
  document.getElementById("preview-name").textContent =
    location.name || "Nie znaleziono nazwy";

  document.getElementById("preview-address").textContent =
    location.address || "Nie znaleziono adresu";

  document.getElementById("preview-coordinates").textContent =
    `${location.latitude}, ${location.longitude}`;

  previewElement.classList.remove("hidden");
}

function showStatus(message, type) {
  statusElement.textContent = message;
  statusElement.className = `status ${type}`;
}

function setFormState(disabled) {
  urlInput.disabled = disabled;
  form.querySelector("button").disabled = disabled;
}