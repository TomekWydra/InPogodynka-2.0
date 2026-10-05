const ALARM_NAME = "weather-update";

const OPEN_METEO_BASE_URL =
  "https://api.open-meteo.com/v1/forecast";

const IMGW_METEO_URL =
  "https://danepubliczne.imgw.pl/api/data/meteo/";

const ALLOWED_INPOST_HOSTS = [
  "inpost.pl",
  "www.inpost.pl"
];

const DEFAULT_LOCATION = {
  name: "",
  address: "",
  country: "",
  latitude: null,
  longitude: null
};

const KNOWN_LOCKERS = {
  rwl01bapp: {
    name: "Paczkomat InPost RWL01BAPP",
    address: "Warszawska 37, 96-332 Radziwiłłów",
    country: "PL",
    latitude: 52.00147,
    longitude: 20.29644
  }
};

let sensorTabId = null;
let sensorTabTimer = null;
let currentSensorRequest = null;

chrome.runtime.onInstalled.addListener(async () => {
  await createUpdateAlarm();

  try {
    await updateWeather();
  } catch (error) {
    console.warn(
      "Pierwsza aktualizacja nie powiodła się:",
      getErrorMessage(error)
    );
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await createUpdateAlarm();

  try {
    await updateWeather();
  } catch (error) {
    console.warn(
      "Aktualizacja po uruchomieniu Chrome nie powiodła się:",
      getErrorMessage(error)
    );
  }
});

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== ALARM_NAME) {
    return;
  }

  try {
    await updateWeather();
  } catch (error) {
    console.error(
      "Błąd aktualizacji z alarmu:",
      getErrorMessage(error)
    );
  }
});

chrome.tabs.onRemoved.addListener(tabId => {
  if (tabId !== sensorTabId) {
    return;
  }

  sensorTabId = null;

  if (sensorTabTimer) {
    clearTimeout(sensorTabTimer);
    sensorTabTimer = null;
  }
});

chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {
    if (!message || !message.type) {
      return false;
    }

    if (message.type === "SAVE_LOCKER_URL") {
      saveLockerUrl(message.url)
        .then(location => {
          sendResponse({
            success: true,
            location
          });
        })
        .catch(error => {
          sendResponse({
            success: false,
            error: getErrorMessage(error)
          });
        });

      return true;
    }

    if (message.type === "UPDATE_WEATHER") {
      updateWeather()
        .then(result => {
          sendResponse({
            success: true,
            result
          });
        })
        .catch(error => {
          sendResponse({
            success: false,
            error: getErrorMessage(error)
          });
        });

      return true;
    }

    if (message.type === "GET_SETTINGS") {
      getSettings()
        .then(settings => {
          sendResponse({
            success: true,
            settings
          });
        })
        .catch(error => {
          sendResponse({
            success: false,
            error: getErrorMessage(error)
          });
        });

      return true;
    }

    if (message.type === "CLEAR_WEATHER_CACHE") {
      chrome.storage.local.remove([
        "weather",
        "imgw",
        "temperatureHistory"
      ])
        .then(() => {
          sendResponse({
            success: true
          });
        })
        .catch(error => {
          sendResponse({
            success: false,
            error: getErrorMessage(error)
          });
        });

      return true;
    }

    if (
      message.type === "INPOST_SENSORS_FROM_PAGE"
    ) {
      saveSensorsFromPage(message, sender)
        .then(() => {
          sendResponse({
            success: true
          });
        })
        .catch(error => {
          sendResponse({
            success: false,
            error: getErrorMessage(error)
          });
        });

      return true;
    }

    return false;
  }
);

async function createUpdateAlarm() {
  const existingAlarm =
    await chrome.alarms.get(ALARM_NAME);

  if (existingAlarm) {
    return;
  }

  const firstRun =
    getNextUpdateTime();

  await chrome.alarms.create(
    ALARM_NAME,
    {
      when: firstRun.getTime(),
      periodInMinutes: 120
    }
  );

  console.info(
    "Utworzono alarm aktualizacji:",
    firstRun.toLocaleString("pl-PL")
  );
}

function getNextUpdateTime() {
  const now = new Date();
  const next = new Date(now);

  next.setSeconds(0, 0);

  const currentHour =
    next.getHours();

  if (
    currentHour === 0 &&
    next.getMinutes() < 1
  ) {
    next.setHours(0, 1, 0, 0);
    return next;
  }

  let nextHour =
    Math.ceil(
      (currentHour + 1) / 2
    ) * 2;

  if (nextHour >= 24) {
    next.setDate(
      next.getDate() + 1
    );

    next.setHours(0, 1, 0, 0);

    return next;
  }

  next.setHours(
    nextHour,
    1,
    0,
    0
  );

  if (next <= now) {
    next.setDate(
      next.getDate() + 1
    );

    next.setHours(0, 1, 0, 0);
  }

  return next;
}

async function saveLockerUrl(url) {
  const validatedUrl =
    validateInPostUrl(url);

  const html =
    await fetchText(
      validatedUrl,
      "Nie udało się pobrać strony paczkomatu."
    );

  let location =
    parseInPostLocation(html);

  const knownLocation =
    getKnownLockerLocation(validatedUrl);

  if (knownLocation) {
    location = {
      ...location,
      ...knownLocation
    };
  }

  if (
    !Number.isFinite(
      location.latitude
    ) ||
    !Number.isFinite(
      location.longitude
    )
  ) {
    throw new Error(
      "Nie znaleziono prawidłowych współrzędnych GPS na stronie paczkomatu."
    );
  }

  await chrome.storage.local.set({
    lockerUrl: validatedUrl,
    location,
    error: ""
  });

  try {
    await updateWeather();
  } catch (error) {
    console.warn(
      "URL zapisano, ale nie udało się pobrać pogody:",
      getErrorMessage(error)
    );
  }

  return location;
}

async function updateWeather() {
  const settings =
    await chrome.storage.local.get([
      "lockerUrl",
      "location",
      "temperatureHistory"
    ]);

  if (!settings.lockerUrl) {
    const errorMessage =
      "Nie ustawiono adresu strony paczkomatu.";

    await chrome.storage.local.set({
      error: errorMessage
    });

    return {
      success: false,
      skipped: true,
      error: errorMessage
    };
  }

  const lockerUrl =
    validateInPostUrl(
      settings.lockerUrl
    );

  const html =
    await fetchText(
      lockerUrl,
      "Nie udało się pobrać strony paczkomatu."
    );

  let parsedLocation =
    parseInPostLocation(html);

  const knownLocation =
    getKnownLockerLocation(
      lockerUrl
    );

  if (knownLocation) {
    parsedLocation = {
      ...parsedLocation,
      ...knownLocation
    };
  }

  const location =
    mergeLocation(
      settings.location ||
      DEFAULT_LOCATION,
      parsedLocation
    );

  if (
    !Number.isFinite(
      location.latitude
    ) ||
    !Number.isFinite(
      location.longitude
    )
  ) {
    throw new Error(
      "Strona paczkomatu nie zawiera prawidłowych współrzędnych GPS."
    );
  }

  const [
    weather,
    imgw
  ] = await Promise.all([
    fetchWeather(
      location.latitude,
      location.longitude
    ),

    fetchImgwNearestStation(
      location.latitude,
      location.longitude
    ).catch(error => {
      console.warn(
        "Nie udało się pobrać danych IMGW:",
        getErrorMessage(error)
      );

      return {
        source: "IMGW-PIB",
        fetchedAt:
          new Date().toISOString(),
        station: null,
        error:
          getErrorMessage(error)
      };
    })
  ]);

  const temperatureHistory =
    updateTemperatureHistory(
      settings.temperatureHistory ||
      [],
      weather.current
    );

  await chrome.storage.local.set({
    lockerUrl,
    location,
    weather,
    imgw,
    temperatureHistory,
    updatedAt:
      new Date().toISOString(),
    error: ""
  });

  try {
    await collectSensorsFromInPostPage(
      lockerUrl
    );
  } catch (error) {
    console.warn(
      "Nie udało się pobrać sensorów InPost:",
      getErrorMessage(error)
    );
  }

  return {
    success: true,
    location,
    weather,
    imgw,
    temperatureHistory
  };
}

async function fetchWeather(
  latitude,
  longitude
) {
  const url =
    buildOpenMeteoUrl(
      latitude,
      longitude
    );

  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Open-Meteo zwróciło błąd HTTP ${response.status}.`
    );
  }

  const json =
    await response.json();

  return prepareWeatherData(
    json
  );
}

function buildOpenMeteoUrl(
  latitude,
  longitude
) {
  const params =
    new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),

      current: [
        "temperature_2m",
        "relative_humidity_2m",
        "pressure_msl"
      ].join(","),

      hourly: [
        "temperature_2m"
      ].join(","),

      daily: [
        "temperature_2m_min",
        "temperature_2m_max",
        "precipitation_sum",
        "pressure_msl_mean"
      ].join(","),

      past_hours: "25",
      forecast_days: "16",
      timezone: "auto"
    });

  return (
    `${OPEN_METEO_BASE_URL}?${params.toString()}`
  );
}

function prepareWeatherData(
  json
) {
  const current =
    json.current || {};

  const hourly =
    json.hourly || {};

  const daily =
    json.daily || {};

  const hourlyTimes =
    Array.isArray(hourly.time)
      ? hourly.time
      : [];

  const hourlyTemperatures =
    Array.isArray(
      hourly.temperature_2m
    )
      ? hourly.temperature_2m
      : [];

  const history =
    buildTwoHourHistory(
      hourlyTimes,
      hourlyTemperatures
    );

  const forecast =
    buildFiveDayForecast(
      daily
    );

  return {
    source: "Open-Meteo",

    timezone:
      json.timezone ||
      "Europe/Warsaw",

    current: {
      time:
        current.time ||
        null,

      temperature:
        toNumberOrNull(
          current.temperature_2m
        ),

      humidity:
        toNumberOrNull(
          current.relative_humidity_2m
        ),

      pressure:
        toNumberOrNull(
          current.pressure_msl
        )
    },

    history,
    forecast
  };
}

function buildTwoHourHistory(
  times,
  temperatures
) {
  if (
    !Array.isArray(times) ||
    !Array.isArray(temperatures) ||
    times.length === 0 ||
    temperatures.length === 0
  ) {
    return [];
  }

  const count =
    Math.min(
      times.length,
      temperatures.length
    );

  const now =
    new Date();

  const currentHour =
    new Date(now);

  currentHour.setMinutes(
    0,
    0,
    0
  );

  const nowTimestamp =
    currentHour.getTime();

  const oldestAllowedTimestamp =
    nowTimestamp -
    25 * 60 * 60 * 1000;

  const validPoints = [];

  for (
    let index = 0;
    index < count;
    index++
  ) {
    const time =
      times[index];

    const temperature =
      toNumberOrNull(
        temperatures[index]
      );

    if (
      !time ||
      temperature === null
    ) {
      continue;
    }

    const timestamp =
      parseOpenMeteoLocalTime(
        time,
        now
      );

    if (
      !Number.isFinite(
        timestamp
      )
    ) {
      continue;
    }

    if (
      timestamp > nowTimestamp ||
      timestamp < oldestAllowedTimestamp
    ) {
      continue;
    }

    validPoints.push({
      time,
      timestamp,
      temperature
    });
  }

  if (
    validPoints.length === 0
  ) {
    return [];
  }

  validPoints.sort(
    (first, second) =>
      first.timestamp -
      second.timestamp
  );

  const result = [];

  for (
    let index = validPoints.length - 1;
    index >= 0 &&
    result.length < 13;
    index -= 2
  ) {
    result.unshift({
      time:
        validPoints[index].time,

      temperature:
        validPoints[index].temperature
    });
  }

  return result;
}

function parseOpenMeteoLocalTime(
  value,
  referenceDate
) {
  if (!value) {
    return NaN;
  }

  const match =
    String(value).match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/
    );

  if (!match) {
    const fallback =
      new Date(value);

    return fallback.getTime();
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]) - 1;

  const day =
    Number(match[3]);

  const hour =
    Number(match[4]);

  const minute =
    Number(match[5]);

  const localDate =
    new Date(
      year,
      month,
      day,
      hour,
      minute,
      0,
      0
    );

  const localTimestamp =
    localDate.getTime();

  const referenceTimestamp =
    referenceDate.getTime();

  const difference =
    localTimestamp -
    referenceTimestamp;

  const oneDay =
    24 * 60 * 60 * 1000;

  if (
    Math.abs(difference) >
    3 * oneDay
  ) {
    return Date.UTC(
      year,
      month,
      day,
      hour,
      minute,
      0,
      0
    );
  }

  return localTimestamp;
}

function buildFiveDayForecast(
  daily
) {
  const dates =
    Array.isArray(daily.time)
      ? daily.time
      : [];

  const minTemperatures =
    Array.isArray(
      daily.temperature_2m_min
    )
      ? daily.temperature_2m_min
      : [];

  const maxTemperatures =
    Array.isArray(
      daily.temperature_2m_max
    )
      ? daily.temperature_2m_max
      : [];

  const precipitation =
    Array.isArray(
      daily.precipitation_sum
    )
      ? daily.precipitation_sum
      : [];

  const pressures =
    Array.isArray(
      daily.pressure_msl_mean
    )
      ? daily.pressure_msl_mean
      : [];

  const result = [];

  for (
    let index = 0;
    index < Math.min(
      5,
      dates.length
    );
    index++
  ) {
    result.push({
      date:
        dates[index] ||
        null,

      minTemperature:
        toNumberOrNull(
          minTemperatures[index]
        ),

      maxTemperature:
        toNumberOrNull(
          maxTemperatures[index]
        ),

      precipitation:
        toNumberOrNull(
          precipitation[index]
        ),

      pressure:
        toNumberOrNull(
          pressures[index]
        )
    });
  }

  return result;
}

function updateTemperatureHistory(
  previousHistory,
  currentWeather
) {
  const history =
    Array.isArray(previousHistory)
      ? previousHistory
      : [];

  const temperature =
    currentWeather?.temperature;

  if (
    !Number.isFinite(
      Number(temperature)
    )
  ) {
    return history.slice(0, 3);
  }

  const newValue = {
    time:
      currentWeather.time ||
      new Date().toISOString(),

    temperature:
      Number(temperature)
  };

  const firstValue =
    history[0];

  if (
    firstValue &&
    firstValue.time ===
    newValue.time
  ) {
    return history.slice(0, 3);
  }

  return [
    newValue,
    ...history
  ].slice(0, 3);
}

async function fetchImgwNearestStation(
  latitude,
  longitude
) {
  const response =
    await fetch(
      IMGW_METEO_URL,
      {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
      }
    );

  if (!response.ok) {
    throw new Error(
      `IMGW zwróciło błąd HTTP ${response.status}.`
    );
  }

  const stations =
    await response.json();

  if (!Array.isArray(stations)) {
    throw new Error(
      "IMGW zwróciło nieprawidłową listę stacji."
    );
  }

  const validStations =
    stations
      .map(station =>
        normalizeImgwStation(
          station,
          latitude,
          longitude
        )
      )
      .filter(Boolean)
      .sort(
        (first, second) =>
          first.distanceKm -
          second.distanceKm
      );

  return {
    source: "IMGW-PIB",
    fetchedAt:
      new Date().toISOString(),
    station:
      validStations[0] ||
      null
  };
}

function normalizeImgwStation(
  station,
  targetLatitude,
  targetLongitude
) {
  const stationLatitude =
    normalizeCoordinate(
      station?.lat
    );

  const stationLongitude =
    normalizeCoordinate(
      station?.lon
    );

  if (
    stationLatitude === null ||
    stationLongitude === null
  ) {
    return null;
  }

  const distance =
    calculateDistanceKm(
      targetLatitude,
      targetLongitude,
      stationLatitude,
      stationLongitude
    );

  return {
    code:
      station.kod_stacji ||
      null,

    name:
      cleanText(
        station.nazwa_stacji
      ) ||
      "Nieznana stacja",

    latitude:
      stationLatitude,

    longitude:
      stationLongitude,

    altitudeMeters:
      toNumberOrNull(
        station.wysokosc_npm
      ),

    foundedYear:
      toNumberOrNull(
        station.rok_zalozenia_stacji
      ),

    distanceKm:
      roundNumber(
        distance,
        2
      ),

    temperature:
      toNumberOrNull(
        station.temperatura_powietrza
      ),

    temperatureDate:
      station.temperatura_powietrza_data ||
      null,

    groundTemperature:
      toNumberOrNull(
        station.temperatura_gruntu
      ),

    humidity:
      toNumberOrNull(
        station.wilgotnosc_wzglednej
      ),

    humidityDate:
      station.wilgotnosc_wzgledna_data ||
      null,

    windDirection:
      toNumberOrNull(
        station.wiatr_kierunek
      ),

    windDirectionDate:
      station.wiatr_kierunek_data ||
      null,

    averageWindSpeed:
      toNumberOrNull(
        station.wiatr_srednia_predkosc
      ),

    averageWindSpeedDate:
      station.wiatr_srednia_predkosc_data ||
      null,

    maximumWindSpeed:
      toNumberOrNull(
        station.wiatr_predkosc_maksymalna
      ),

    maximumWindSpeedDate:
      station.wiatr_predkosc_maksymalna_data ||
      null,

    windGust10Min:
      toNumberOrNull(
        station.wiatr_poryw_10min
      ),

    windGust10MinDate:
      station.wiatr_poryw_10min_data ||
      null,

    precipitation10Min:
      toNumberOrNull(
        station.opad_10min
      ),

    precipitation10MinDate:
      station.opad_10min_data ||
      null,

    observationTime:
      getImgwObservationTime(
        station
      )
  };
}

function getImgwObservationTime(
  station
) {
  const dates = [
    station?.temperatura_powietrza_data,
    station?.wilgotnosc_wzgledna_data,
    station?.wiatr_kierunek_data,
    station?.wiatr_srednia_predkosc_data,
    station?.opad_10min_data
  ]
    .filter(Boolean)
    .map(value =>
      parseImgwDate(value)
    )
    .filter(Boolean)
    .sort(
      (first, second) =>
        second.getTime() -
        first.getTime()
    );

  return dates[0]
    ? dates[0].toISOString()
    : null;
}

function parseImgwDate(
  value
) {
  if (!value) {
    return null;
  }

  const date =
    new Date(
      String(value).replace(
        " ",
        "T"
      )
    );

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}

function calculateDistanceKm(
  firstLatitude,
  firstLongitude,
  secondLatitude,
  secondLongitude
) {
  const earthRadiusKm =
    6371;

  const toRadians =
    value =>
      value *
      Math.PI /
      180;

  const latitudeDifference =
    toRadians(
      secondLatitude -
      firstLatitude
    );

  const longitudeDifference =
    toRadians(
      secondLongitude -
      firstLongitude
    );

  const firstLatitudeRadians =
    toRadians(
      firstLatitude
    );

  const secondLatitudeRadians =
    toRadians(
      secondLatitude
    );

  const a =
    Math.sin(
      latitudeDifference / 2
    ) ** 2 +
    Math.cos(
      firstLatitudeRadians
    ) *
    Math.cos(
      secondLatitudeRadians
    ) *
    Math.sin(
      longitudeDifference / 2
    ) ** 2;

  return (
    2 *
    earthRadiusKm *
    Math.asin(
      Math.sqrt(a)
    )
  );
}

function roundNumber(
  value,
  decimals
) {
  if (
    !Number.isFinite(
      Number(value)
    )
  ) {
    return null;
  }

  const multiplier =
    10 ** decimals;

  return Math.round(
    Number(value) *
    multiplier
  ) / multiplier;
}

async function collectSensorsFromInPostPage(
  lockerUrl
) {
  if (currentSensorRequest) {
    return currentSensorRequest;
  }

  currentSensorRequest =
    new Promise(async resolve => {
      let finished = false;

      const finish = async result => {
        if (finished) {
          return;
        }

        finished = true;

        if (sensorTabTimer) {
          clearTimeout(
            sensorTabTimer
          );

          sensorTabTimer =
            null;
        }

        await closeSensorTab();

        currentSensorRequest =
          null;

        resolve(result);
      };

      sensorTabTimer =
        setTimeout(() => {
          finish({
            success: false,
            reason:
              "Przekroczono czas oczekiwania na sensory."
          });
        }, 30000);

      try {
        const tab =
          await chrome.tabs.create({
            url: lockerUrl,
            active: false
          });

        sensorTabId =
          tab.id;
      } catch (error) {
        await finish({
          success: false,
          reason:
            getErrorMessage(error)
        });
      }
    });

  return currentSensorRequest;
}

async function closeSensorTab() {
  if (
    !Number.isInteger(
      sensorTabId
    )
  ) {
    return;
  }

  const tabId =
    sensorTabId;

  sensorTabId =
    null;

  try {
    await chrome.tabs.remove(
      tabId
    );
  } catch (error) {
    console.warn(
      "Nie udało się zamknąć karty sensorów:",
      getErrorMessage(error)
    );
  }
}

async function saveSensorsFromPage(
  message,
  sender
) {
  if (
    !message ||
    !message.sensors ||
    typeof message.sensors !== "object"
  ) {
    throw new Error(
      "Nie otrzymano prawidłowych danych sensorów."
    );
  }

  const settings =
    await chrome.storage.local.get([
      "lockerUrl"
    ]);

  if (
    settings.lockerUrl &&
    message.url &&
    !sameLockerUrl(
      settings.lockerUrl,
      message.url
    )
  ) {
    return;
  }

  const sensors = {
    pm25:
      message.sensors[
        "sensor-pm25"
      ] || null,

    pm25Percent:
      message.sensors[
        "sensor-p-pm25"
      ] || null,

    pm10:
      message.sensors[
        "sensor-pm10"
      ] || null,

    pm10Percent:
      message.sensors[
        "sensor-p-pm10"
      ] || null,

    o3:
      message.sensors[
        "sensor-o3"
      ] || null,

    o3Percent:
      message.sensors[
        "sensor-p-o3"
      ] || null,

    no2:
      message.sensors[
        "sensor-no2"
      ] || null,

    no2Percent:
      message.sensors[
        "sensor-p-no2"
      ] || null,

    temperature:
      message.sensors[
        "sensor-temperature"
      ] || null,

    pressure:
      message.sensors[
        "sensor-pressure"
      ] || null,

    humidity:
      message.sensors[
        "sensor-humidity"
      ] || null,

    source: "InPost DOM",

    pageUrl:
      message.url ||
      null,

    fetchedAt:
      message.fetchedAt ||
      new Date().toISOString()
  };

  const hasData =
    Object.entries(
      sensors
    ).some(([key, value]) => {
      const metadataKeys = [
        "source",
        "pageUrl",
        "fetchedAt"
      ];

      return (
        !metadataKeys.includes(
          key
        ) &&
        value !== null &&
        value !== ""
      );
    });

  if (!hasData) {
    return;
  }

  await chrome.storage.local.set({
    inpostSensors: sensors,
    inpostSensorsUpdatedAt:
      new Date().toISOString()
  });

  if (
    sender &&
    sender.tab &&
    sender.tab.id === sensorTabId
  ) {
    await closeSensorTab();
  }
}

function sameLockerUrl(
  firstUrl,
  secondUrl
) {
  try {
    const first =
      new URL(firstUrl);

    const second =
      new URL(secondUrl);

    return (
      first.hostname ===
        second.hostname &&
      first.pathname ===
        second.pathname
    );
  } catch {
    return firstUrl === secondUrl;
  }
}

function getKnownLockerLocation(
  url
) {
  const normalizedUrl =
    String(url).toLowerCase();

  for (
    const lockerId of
    Object.keys(KNOWN_LOCKERS)
  ) {
    if (
      normalizedUrl.includes(
        lockerId
      )
    ) {
      return {
        ...KNOWN_LOCKERS[
          lockerId
        ]
      };
    }
  }

  return null;
}

function parseInPostLocation(
  html
) {
  const jsonLdObjects =
    extractJsonLdObjects(
      html
    );

  const locationData =
    findLocationInJsonLd(
      jsonLdObjects
    );

  const fallbackCoordinates =
    extractCoordinatesFromHtml(
      html
    );

  const metaDescription =
    extractMetaDescription(
      html
    );

  return {
    name:
      cleanText(
        locationData.name
      ) ||
      extractLockerNameFromHtml(
        html
      ) ||
      "Paczkomat InPost",

    address:
      cleanText(
        locationData.address
      ) ||
      cleanText(
        metaDescription
      ),

    country:
      cleanText(
        locationData.country
      ),

    latitude:
      normalizeCoordinate(
        locationData.latitude ??
        fallbackCoordinates.latitude
      ),

    longitude:
      normalizeCoordinate(
        locationData.longitude ??
        fallbackCoordinates.longitude
      )
  };
}

function findLocationInJsonLd(
  objects
) {
  const result = {
    name: null,
    address: null,
    country: null,
    latitude: null,
    longitude: null
  };

  for (
    const object of objects
  ) {
    inspectJsonLdObject(
      object,
      result
    );
  }

  return result;
}

function inspectJsonLdObject(
  object,
  result
) {
  if (
    !object ||
    typeof object !== "object"
  ) {
    return;
  }

  if (
    !result.name &&
    isUsefulName(
      object.name
    )
  ) {
    result.name =
      object.name;
  }

  if (
    !result.address &&
    object.address
  ) {
    const address =
      parseAddress(
        object.address
      );

    if (address) {
      result.address =
        address;
    }
  }

  if (
    !result.country &&
    object.addressCountry
  ) {
    result.country =
      normalizeCountry(
        object.addressCountry
      );
  }

  if (
    object.address &&
    typeof object.address ===
      "object" &&
    !result.country &&
    object.address.addressCountry
  ) {
    result.country =
      normalizeCountry(
        object.address.addressCountry
      );
  }

  if (
    !result.latitude &&
    object.latitude !== undefined
  ) {
    result.latitude =
      object.latitude;
  }

  if (
    !result.longitude &&
    object.longitude !== undefined
  ) {
    result.longitude =
      object.longitude;
  }

  if (
    object.geo &&
    typeof object.geo === "object"
  ) {
    if (
      !result.latitude &&
      object.geo.latitude !==
        undefined
    ) {
      result.latitude =
        object.geo.latitude;
    }

    if (
      !result.longitude &&
      object.geo.longitude !==
        undefined
    ) {
      result.longitude =
        object.geo.longitude;
    }
  }

  if (
    object.location &&
    typeof object.location ===
      "object"
  ) {
    inspectJsonLdObject(
      object.location,
      result
    );
  }

  if (
    Array.isArray(
      object["@graph"]
    )
  ) {
    for (
      const item of
      object["@graph"]
    ) {
      inspectJsonLdObject(
        item,
        result
      );
    }
  }

  if (
    Array.isArray(
      object.itemListElement
    )
  ) {
    for (
      const item of
      object.itemListElement
    ) {
      inspectJsonLdObject(
        item,
        result
      );
    }
  }

  if (Array.isArray(object)) {
    for (
      const item of object
    ) {
      inspectJsonLdObject(
        item,
        result
      );
    }
  }
}

function parseAddress(
  address
) {
  if (!address) {
    return "";
  }

  if (
    typeof address ===
    "string"
  ) {
    return cleanText(
      address
    );
  }

  if (
    typeof address !==
    "object"
  ) {
    return "";
  }

  return cleanText(
    [
      address.streetAddress,
      address.postalCode,
      address.addressLocality,
      address.addressRegion
    ]
      .filter(Boolean)
      .join(", ")
  );
}

function normalizeCountry(
  value
) {
  if (!value) {
    return "";
  }

  if (
    typeof value ===
    "object"
  ) {
    value =
      value.name ||
      value.identifier ||
      "";
  }

  const text =
    cleanText(
      value
    ).toUpperCase();

  if (
    text === "PL" ||
    text === "POLSKA" ||
    text === "POLAND"
  ) {
    return "PL";
  }

  return text;
}

function extractJsonLdObjects(
  html
) {
  const objects = [];

  const scriptPattern =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match;

  while (
    (match =
      scriptPattern.exec(
        html
      )) !== null
  ) {
    const rawJson =
      match[1]
        .trim()
        .replace(
          /<!--/g,
          ""
        )
        .replace(
          /-->/g,
          ""
        );

    if (!rawJson) {
      continue;
    }

    const parsed =
      parseJsonLdSafely(
        rawJson
      );

    if (!parsed) {
      continue;
    }

    if (Array.isArray(parsed)) {
      objects.push(
        ...parsed
      );
    } else {
      objects.push(
        parsed
      );
    }
  }

  return objects;
}

function parseJsonLdSafely(
  rawJson
) {
  const variants = [
    rawJson,
    removeControlCharacters(
      rawJson
    ),
    repairJsonLdText(
      rawJson
    )
  ];

  for (
    const variant of variants
  ) {
    try {
      return JSON.parse(
        variant
      );
    } catch {
      continue;
    }
  }

  return null;
}

function removeControlCharacters(
  value
) {
  return String(value).replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,
    " "
  );
}

function repairJsonLdText(
  value
) {
  return String(value)
    .replace(
      /\r/g,
      "\\r"
    )
    .replace(
      /\n/g,
      "\\n"
    )
    .replace(
      /\t/g,
      "\\t"
    );
}

function extractCoordinatesFromHtml(
  html
) {
  const latitudePatterns = [
    /"latitude"\s*:\s*"([^"]+)"/i,
    /"latitude"\s*:\s*([-+]?\d+(?:[.,]\d+)?)/i,
    /"lat"\s*:\s*"([^"]+)"/i,
    /data-latitude=["']([^"']+)["']/i,
    /data-lat=["']([^"']+)["']/i
  ];

  const longitudePatterns = [
    /"longitude"\s*:\s*"([^"]+)"/i,
    /"longitude"\s*:\s*([-+]?\d+(?:[.,]\d+)?)/i,
    /"lng"\s*:\s*"([^"]+)"/i,
    /"lon"\s*:\s*"([^"]+)"/i,
    /data-longitude=["']([^"']+)["']/i,
    /data-lng=["']([^"']+)["']/i
  ];

  return {
    latitude:
      findFirstMatch(
        html,
        latitudePatterns
      ),

    longitude:
      findFirstMatch(
        html,
        longitudePatterns
      )
  };
}

function findFirstMatch(
  text,
  patterns
) {
  for (
    const pattern of patterns
  ) {
    const match =
      text.match(
        pattern
      );

    if (
      match &&
      match[1]
    ) {
      return match[1];
    }
  }

  return null;
}

function extractLockerNameFromHtml(
  html
) {
  const patterns = [
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i
  ];

  for (
    const pattern of patterns
  ) {
    const match =
      html.match(
        pattern
      );

    if (
      !match ||
      !match[1]
    ) {
      continue;
    }

    const text =
      cleanText(
        match[1]
          .replace(
            /<[^>]+>/g,
            " "
          )
      );

    if (
      text &&
      text.toLowerCase() !==
      "inpost"
    ) {
      return text;
    }
  }

  return "";
}

function extractMetaDescription(
  html
) {
  const patterns = [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i
  ];

  for (
    const pattern of patterns
  ) {
    const match =
      html.match(
        pattern
      );

    if (match) {
      return decodeHtmlEntities(
        match[1]
      );
    }
  }

  return "";
}

function mergeLocation(
  previous,
  current
) {
  return {
    name:
      current.name ||
      previous.name ||
      DEFAULT_LOCATION.name,

    address:
      current.address ||
      previous.address ||
      DEFAULT_LOCATION.address,

    country:
      current.country ||
      previous.country ||
      DEFAULT_LOCATION.country,

    latitude:
      Number.isFinite(
        current.latitude
      )
        ? current.latitude
        : previous.latitude,

    longitude:
      Number.isFinite(
        current.longitude
      )
        ? current.longitude
        : previous.longitude
  };
}

async function getSettings() {
  return chrome.storage.local.get([
    "lockerUrl",
    "location",
    "weather",
    "imgw",
    "inpostSensors",
    "temperatureHistory",
    "updatedAt",
    "inpostSensorsUpdatedAt",
    "error"
  ]);
}

async function fetchText(
  url,
  errorMessage
) {
  let response;

  try {
    response =
      await fetch(
        url,
        {
          method: "GET",
          redirect: "follow",
          cache: "no-store",
          headers: {
            Accept:
              "text/html,application/xhtml+xml"
          }
        }
      );
  } catch (error) {
    throw new Error(
      `${errorMessage} ${
        getErrorMessage(error)
      }`
    );
  }

  if (!response.ok) {
    throw new Error(
      `${errorMessage} HTTP ${
        response.status
      }.`
    );
  }

  return response.text();
}

function validateInPostUrl(
  value
) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(
      "Adres strony paczkomatu nie może być pusty."
    );
  }

  let url;

  try {
    url =
      new URL(
        value.trim()
      );
  } catch {
    throw new Error(
      "Podany adres URL jest nieprawidłowy."
    );
  }

  const hostname =
    url.hostname.toLowerCase();

  const isAllowedHost =
    ALLOWED_INPOST_HOSTS.includes(
      hostname
    ) ||
    hostname.endsWith(
      ".inpost.pl"
    );

  if (
    url.protocol !== "https:" ||
    !isAllowedHost
  ) {
    throw new Error(
      "Dozwolone są wyłącznie adresy HTTPS z domeny inpost.pl."
    );
  }

  return url.toString();
}

function toNumberOrNull(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(
      String(value).replace(",", ".")
    );

  return Number.isFinite(
    number
  )
    ? number
    : null;
}

function normalizeCoordinate(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number.parseFloat(
      String(value)
        .replace(",", ".")
        .trim()
    );

  return Number.isFinite(
    number
  )
    ? number
    : null;
}

function isUsefulName(
  value
) {
  if (!value) {
    return false;
  }

  const name =
    cleanText(
      value
    );

  if (!name) {
    return false;
  }

  return (
    name.toLowerCase() !==
    "inpost"
  );
}

function cleanText(
  value
) {
  return decodeHtmlEntities(
    String(value || "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function decodeHtmlEntities(
  value
) {
  return String(value || "")
    .replace(
      /&nbsp;/gi,
      " "
    )
    .replace(
      /&amp;/gi,
      "&"
    )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /&#39;|&apos;/gi,
      "'"
    )
    .replace(
      /&lt;/gi,
      "<"
    )
    .replace(
      /&gt;/gi,
      ">"
    );
}

function getErrorMessage(
  error
) {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return String(
    error ||
    "Nieznany błąd."
  );
}