"use strict";

const $ = selector =>
  document.querySelector(selector);

const $$ = selector =>
  Array.from(
    document.querySelectorAll(selector)
  );

const fmt = (
  value,
  digits = 1,
  fallback = "—"
) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  const number =
    Number(
      String(value).replace(",", ".")
    );

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return number.toLocaleString(
    "pl-PL",
    {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }
  );
};

const fmtDateTime = value => {
  if (!value) {
    return "brak danych";
  }

  const date =
    new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString(
    "pl-PL",
    {
      dateStyle: "short",
      timeStyle: "short"
    }
  );
};

const fmtDate = value => {
  if (!value) {
    return "brak danych";
  }

  const date =
    new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString(
    "pl-PL",
    {
      weekday: "short",
      day: "2-digit",
      month: "2-digit"
    }
  );
};

const fmtTime = value => {
  if (!value) {
    return "brak danych";
  }

  const date =
    new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleTimeString(
    "pl-PL",
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  );
};

const setText = (
  selector,
  value
) => {
  const element =
    $(selector);

  if (element) {
    element.textContent =
      value ?? "—";
  }
};

function getRuntimeMessage(message) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(
      message,
      response => {
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error:
              chrome.runtime.lastError.message
          });

          return;
        }

        resolve(
          response || {
            success: false,
            error: "Brak odpowiedzi z rozszerzenia."
          }
        );
      }
    );
  });
}

function setStatus(
  message,
  type = ""
) {
  const element =
    $("#error-message");

  if (!element) {
    return;
  }

  element.textContent =
    message || "";

  element.className =
    type
      ? `status-message ${type}`
      : "status-message";
}

function renderLocation(
  location
) {
  if (!location) {
    setText(
      "#locker-name",
      "Ustaw paczkomat w konfiguracji"
    );

    setText(
      "#locker-address",
      "Otwórz ustawienia rozszerzenia"
    );

    return;
  }

  setText(
    "#locker-name",
    location.name ||
      "Paczkomat InPost"
  );

  setText(
    "#locker-address",
    location.address ||
      "Adres niedostępny"
  );
}

function renderInPostSensors(
  sensors
) {
  if (!sensors) {
    return;
  }

  const values = [
    ["#sensor-pm25", sensors.pm25, " µg/m³"],
    ["#sensor-p-pm25", sensors.pm25Percent, ""],
    ["#sensor-pm10", sensors.pm10, " µg/m³"],
    ["#sensor-p-pm10", sensors.pm10Percent, ""],
    ["#sensor-o3", sensors.o3, " µg/m³"],
    ["#sensor-p-o3", sensors.o3Percent, ""],
    ["#sensor-no2", sensors.no2, " µg/m³"],
    ["#sensor-p-no2", sensors.no2Percent, ""],
    [
      "#inpost-temperature",
      sensors.temperature,
      " °C"
    ],
    [
      "#inpost-pressure",
      sensors.pressure,
      " hPa"
    ],
    [
      "#inpost-humidity",
      sensors.humidity,
      " %"
    ]
  ];

  for (
    const [
      selector,
      value,
      unit
    ] of values
  ) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      continue;
    }

    setText(
      selector,
      `${value}${unit}`
    );
  }

  renderAirQualityLevel(
    "pm25",
    sensors.pm25
  );

  renderAirQualityLevel(
    "pm10",
    sensors.pm10
  );

  renderAirQualityLevel(
    "o3",
    sensors.o3
  );

  renderAirQualityLevel(
    "no2",
    sensors.no2
  );
}

function getAirQualityLevel(
  type,
  value
) {
  const number =
    Number(
      String(value ?? "")
        .replace(",", ".")
    );

  if (!Number.isFinite(number)) {
    return {
      name: "Brak danych",
      className: "air-level-none"
    };
  }

  if (type === "pm25") {
    if (number <= 10) {
      return {
        name: "Bardzo dobra",
        className: "air-level-very-good"
      };
    }

    if (number <= 20) {
      return {
        name: "Dobra",
        className: "air-level-good"
      };
    }

    if (number <= 35) {
      return {
        name: "Umiarkowana",
        className: "air-level-moderate"
      };
    }

    if (number <= 50) {
      return {
        name: "Zła",
        className: "air-level-bad"
      };
    }

    return {
      name: "Bardzo zła",
      className: "air-level-very-bad"
    };
  }

  if (type === "pm10") {
    if (number <= 20) {
      return {
        name: "Bardzo dobra",
        className: "air-level-very-good"
      };
    }

    if (number <= 40) {
      return {
        name: "Dobra",
        className: "air-level-good"
      };
    }

    if (number <= 70) {
      return {
        name: "Umiarkowana",
        className: "air-level-moderate"
      };
    }

    if (number <= 100) {
      return {
        name: "Zła",
        className: "air-level-bad"
      };
    }

    return {
      name: "Bardzo zła",
      className: "air-level-very-bad"
    };
  }

  if (type === "o3") {
    if (number <= 60) {
      return {
        name: "Bardzo dobra",
        className: "air-level-very-good"
      };
    }

    if (number <= 120) {
      return {
        name: "Dobra",
        className: "air-level-good"
      };
    }

    if (number <= 180) {
      return {
        name: "Umiarkowana",
        className: "air-level-moderate"
      };
    }

    if (number <= 240) {
      return {
        name: "Zła",
        className: "air-level-bad"
      };
    }

    return {
      name: "Bardzo zła",
      className: "air-level-very-bad"
    };
  }

  if (type === "no2") {
    if (number <= 40) {
      return {
        name: "Bardzo dobra",
        className: "air-level-very-good"
      };
    }

    if (number <= 90) {
      return {
        name: "Dobra",
        className: "air-level-good"
      };
    }

    if (number <= 120) {
      return {
        name: "Umiarkowana",
        className: "air-level-moderate"
      };
    }

    if (number <= 230) {
      return {
        name: "Zła",
        className: "air-level-bad"
      };
    }

    return {
      name: "Bardzo zła",
      className: "air-level-very-bad"
    };
  }

  return {
    name: "Brak danych",
    className: "air-level-none"
  };
}

function renderAirQualityLevel(
  type,
  value
) {
  const card =
    $(`#air-card-${type}`);

  const level =
    $(`#level-${type}`);

  const tooltipLevel =
    $(`#tooltip-level-${type}`);

  if (!card || !level) {
    return;
  }

  const result =
    getAirQualityLevel(
      type,
      value
    );

  card.classList.remove(
    "air-level-none",
    "air-level-very-good",
    "air-level-good",
    "air-level-moderate",
    "air-level-bad",
    "air-level-very-bad"
  );

  card.classList.add(
    result.className
  );

  level.textContent =
    result.name;

  if (tooltipLevel) {
    tooltipLevel.textContent =
      `Poziom: ${result.name}.`;
  }
}

function renderOpenMeteo(
  weather
) {
  if (!weather) {
    return;
  }

  const current =
    weather.current || {};

  setText(
    "#current-temperature",
    `${fmt(current.temperature)} °C`
  );

  setText(
    "#current-humidity",
    `${fmt(current.humidity, 0)} %`
  );

  setText(
    "#current-pressure",
    `${fmt(current.pressure)} hPa`
  );

  setText(
    "#current-time",
    current.time
      ? `Pomiar: ${fmtDateTime(current.time)}`
      : "Brak danych"
  );

  renderForecast(
    weather.forecast
  );

  renderTemperatureChart(
    weather.history
  );
}

function renderForecast(
  forecast
) {
  const container =
    $("#open-meteo-forecast");

  if (!container) {
    return;
  }

  container.replaceChildren();

  if (
    !Array.isArray(forecast) ||
    forecast.length === 0
  ) {
    const message =
      document.createElement("p");

    message.className =
      "muted";

    message.textContent =
      "Brak prognozy.";

    container.appendChild(
      message
    );

    return;
  }

  for (
    const day of forecast
  ) {
    const article =
      document.createElement("article");

    article.className =
      "forecast-day";

    const date =
      document.createElement("h3");

    date.textContent =
      fmtDate(day.date);

    const temperature =
      document.createElement("strong");

    temperature.textContent =
      `${fmt(day.minTemperature)}° / ` +
      `${fmt(day.maxTemperature)}°`;

    const precipitation =
      document.createElement("p");

    precipitation.textContent =
      `Opad: ${fmt(day.precipitation)} mm`;

    const pressure =
      document.createElement("p");

    pressure.textContent =
      `Ciśnienie: ${fmt(day.pressure)} hPa`;

    article.append(
      date,
      temperature,
      precipitation,
      pressure
    );

    container.appendChild(
      article
    );
  }
}

function renderImgw(
  imgw
) {
  const message =
    $("#imgw-message");

  const content =
    $("#imgw-content");

  if (!message || !content) {
    return;
  }

  const station =
    imgw?.station;

  if (!station) {
    content.hidden = true;
    message.hidden = false;

    message.textContent =
      imgw?.error ||
      "Brak danych z najbliższej stacji IMGW.";

    return;
  }

  message.hidden = true;
  content.hidden = false;

  setText(
    "#imgw-station-name",
    station.name ||
      "Nieznana stacja"
  );

  setText(
    "#imgw-station-coordinates",
    `Położenie stacji: ` +
    `${fmt(station.latitude, 5)}°N, ` +
    `${fmt(station.longitude, 5)}°E`
  );

  setText(
    "#imgw-station-distance",
    `Odległość od paczkomatu: ` +
    `${fmt(station.distanceKm, 2)} km`
  );

  setText(
    "#imgw-station-altitude",
    `Wysokość: ` +
    `${fmt(station.altitudeMeters, 0)} m n.p.m.`
  );

  setText(
    "#imgw-observation-time",
    `Czas pomiaru: ` +
    `${fmtDateTime(station.observationTime)}`
  );

  setText(
    "#imgw-temperature",
    station.temperature === null ||
    station.temperature === undefined
      ? "brak danych"
      : `${fmt(station.temperature)} °C`
  );

  setText(
    "#imgw-humidity",
    station.humidity === null ||
    station.humidity === undefined
      ? "brak danych"
      : `${fmt(station.humidity, 0)} %`
  );

  setText(
    "#imgw-wind",
    station.averageWindSpeed === null ||
    station.averageWindSpeed === undefined
      ? "brak danych"
      : `${fmt(station.averageWindSpeed)} m/s`
  );

  setText(
    "#imgw-wind-direction",
    formatWindDirection(
      station.windDirection
    )
  );

  setText(
    "#imgw-wind-gust",
    station.windGust10Min === null ||
    station.windGust10Min === undefined
      ? "brak danych"
      : `${fmt(station.windGust10Min)} m/s`
  );

  setText(
    "#imgw-precipitation",
    station.precipitation10Min === null ||
    station.precipitation10Min === undefined
      ? "brak danych"
      : `${fmt(station.precipitation10Min)} mm`
  );
}

function formatWindDirection(
  value
) {
  const degrees =
    Number(value);

  if (!Number.isFinite(degrees)) {
    return "brak danych";
  }

  const directions = [
    "N",
    "NE",
    "E",
    "SE",
    "S",
    "SW",
    "W",
    "NW"
  ];

  const index =
    Math.round(degrees / 45) % 8;

  return (
    `${directions[index]} ` +
    `(${fmt(degrees, 0)}°)`
  );
}

function renderTemperatureChart(
  history
) {
  const container =
    $("#temperature-chart");

  if (!container) {
    return;
  }

  container.replaceChildren();

  if (
    !Array.isArray(history) ||
    history.length === 0
  ) {
    const message =
      document.createElement("p");

    message.className =
      "muted";

    message.textContent =
      "Brak danych historycznych.";

    container.appendChild(
      message
    );

    return;
  }

  const points =
    history
      .filter(item =>
        item &&
        item.time &&
        Number.isFinite(
          Number(item.temperature)
        )
      )
      .slice()
      .reverse();

  if (points.length === 0) {
    const message =
      document.createElement("p");

    message.className =
      "muted";

    message.textContent =
      "Brak poprawnych danych historycznych.";

    container.appendChild(
      message
    );

    return;
  }

  const values =
    points.map(point =>
      Number(point.temperature)
    );

  const minimum =
    Math.min(...values);

  const maximum =
    Math.max(...values);

  const range =
    Math.max(
      maximum - minimum,
      1
    );

  const chart =
    document.createElement("div");

  chart.className =
    "temperature-bar-chart";

  for (
    const point of points
  ) {
    const temperature =
      Number(point.temperature);

    const normalizedHeight =
      25 +
      ((temperature - minimum) / range) * 75;

    const column =
      document.createElement("div");

    column.className =
      "temperature-bar-column";

    const value =
      document.createElement("strong");

    value.className =
      "temperature-bar-value";

    value.textContent =
      `${fmt(temperature)}°`;

    const track =
      document.createElement("div");

    track.className =
      "temperature-bar-track";

    const bar =
      document.createElement("div");

    bar.className =
      "temperature-bar";

    bar.style.height =
      `${normalizedHeight}%`;

    if (temperature < 0) {
      bar.classList.add(
        "temperature-bar-cold"
      );
    } else if (temperature >= 25) {
      bar.classList.add(
        "temperature-bar-hot"
      );
    }

    const time =
      document.createElement("span");

    time.className =
      "temperature-bar-time";

    time.textContent =
      fmtTime(point.time);

    track.appendChild(
      bar
    );

    column.append(
      value,
      track,
      time
    );

    chart.appendChild(
      column
    );
  }

  container.appendChild(
    chart
  );
}

function renderTemperatureHistory(
  history
) {
  const container =
    $("#temperature-history");

  if (!container) {
    return;
  }

  container.replaceChildren();

  if (
    !Array.isArray(history) ||
    history.length === 0
  ) {
    const message =
      document.createElement("p");

    message.className =
      "muted";

    message.textContent =
      "Brak historii pobrań.";

    container.appendChild(
      message
    );

    return;
  }

  const list =
    document.createElement("div");

  list.className =
    "temperature-history-grid";

  for (
    const item of history
  ) {
    const card =
      document.createElement("article");

    card.className =
      "temperature-history-card";

    const date =
      document.createElement("span");

    date.className =
      "temperature-history-date";

    date.textContent =
      fmtDateTime(item.time);

    const label =
      document.createElement("span");

    label.className =
      "temperature-history-label";

    label.textContent =
      "Temperatura";

    const value =
      document.createElement("strong");

    value.className =
      "temperature-history-value";

    value.textContent =
      `${fmt(item.temperature)} °C`;

    card.append(
      date,
      label,
      value
    );

    list.appendChild(
      card
    );
  }

  container.appendChild(
    list
  );
}

function renderUpdatedAt(
  value
) {
  setText(
    "#last-update",
    value
      ? `Ostatnia aktualizacja: ${fmtDateTime(value)}`
      : "Ostatnia aktualizacja: brak danych"
  );
}

function renderSettings(
  settings
) {
  if (!settings) {
    return;
  }

  renderLocation(
    settings.location
  );

  renderInPostSensors(
    settings.inpostSensors
  );

  renderOpenMeteo(
    settings.weather
  );

  renderImgw(
    settings.imgw
  );

  renderTemperatureHistory(
    settings.temperatureHistory
  );

  renderUpdatedAt(
    settings.updatedAt
  );

  if (settings.error) {
    setStatus(
      settings.error,
      "error"
    );
  } else {
    setStatus("");
  }
}

async function loadSettings() {
  const response =
    await getRuntimeMessage({
      type: "GET_SETTINGS"
    });

  if (!response?.success) {
    setStatus(
      response?.error ||
        "Nie udało się pobrać ustawień.",
      "error"
    );

    return;
  }

  renderSettings(
    response.settings
  );
}

async function refreshWeather() {
  const refreshButton =
    $("#refresh-button");

  if (refreshButton) {
    refreshButton.disabled = true;
    refreshButton.textContent =
      "Odświeżanie…";
  }

  setStatus(
    "Pobieranie aktualnych danych…"
  );

  const response =
    await getRuntimeMessage({
      type: "UPDATE_WEATHER"
    });

  if (!response?.success) {
    setStatus(
      response?.error ||
        "Nie udało się odświeżyć danych.",
      "error"
    );
  } else {
    setStatus("");

    renderLocation(
      response.result?.location
    );

    renderOpenMeteo(
      response.result?.weather
    );

    renderImgw(
      response.result?.imgw
    );

    renderTemperatureHistory(
      response.result?.temperatureHistory
    );

    renderUpdatedAt(
      new Date().toISOString()
    );
  }

  if (refreshButton) {
    refreshButton.disabled = false;
    refreshButton.textContent =
      "Odśwież";
  }
}

function openSettings() {
  chrome.runtime.openOptionsPage();
}

function setupTooltips() {
  $$(".info-button").forEach(button => {
    button.addEventListener(
      "click",
      event => {
        event.stopPropagation();

        const tooltipId =
          button.getAttribute(
            "aria-describedby"
          );

        const tooltip =
          tooltipId
            ? document.getElementById(
                tooltipId
              )
            : null;

        if (!tooltip) {
          return;
        }

        tooltip.classList.toggle(
          "tooltip-visible"
        );
      }
    );
  });

  document.addEventListener(
    "click",
    () => {
      $$(".tooltip-visible").forEach(
        tooltip => {
          tooltip.classList.remove(
            "tooltip-visible"
          );
        }
      );
    }
  );
}

$("#refresh-button")?.addEventListener(
  "click",
  refreshWeather
);

$("#settings-button")?.addEventListener(
  "click",
  openSettings
);

setupTooltips();
loadSettings();