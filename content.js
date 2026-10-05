(() => {
  const SENSOR_IDS = [
    "sensor-pm25",
    "sensor-p-pm25",
    "sensor-pm10",
    "sensor-p-pm10",
    "sensor-o3",
    "sensor-p-o3",
    "sensor-no2",
    "sensor-p-no2",
    "sensor-temperature",
    "sensor-pressure",
    "sensor-humidity"
  ];

  let attempts = 0;
  let intervalId = null;

  function readText(id) {
    const element =
      document.getElementById(
        id
      );

    if (!element) {
      return null;
    }

    const value =
      element.textContent
        .replace(/\s+/g, " ")
        .trim();

    return value || null;
  }

  function readSensors() {
    const sensors = {};

    for (
      const id of SENSOR_IDS
    ) {
      sensors[id] =
        readText(id);
    }

    return sensors;
  }

  function hasSensorData(
    sensors
  ) {
    return Object.values(
      sensors
    ).some(
      value => value !== null
    );
  }

  function sendSensors() {
    const sensors =
      readSensors();

    if (
      !hasSensorData(
        sensors
      )
    ) {
      return;
    }

    chrome.runtime.sendMessage({
      type:
        "INPOST_SENSORS_FROM_PAGE",

      sensors,

      url:
        window.location.href,

      fetchedAt:
        new Date().toISOString()
    });
  }

  function startReading() {
    sendSensors();

    intervalId =
      setInterval(() => {
        attempts += 1;

        sendSensors();

        if (
          attempts >= 12
        ) {
          clearInterval(
            intervalId
          );
        }
      }, 2500);
  }

  startReading();
})();