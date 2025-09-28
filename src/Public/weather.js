let lon;
let lat;
const temperature = document.querySelector(".temp");
const summary = document.querySelector(".summary");
const loc = document.querySelector(".location");
const iconEl = document.querySelector(".icon");

function setIcon(iconCode, text) {
  if (!iconEl) return;
  // Si tu CSP NO permite imágenes externas, usa emoji:
  const emojiMap = {
    "01": "☀️",  // clear
    "02": "🌤️",  // few clouds
    "03": "⛅",   // scattered
    "04": "☁️",  // broken
    "09": "🌧️",  // shower rain
    "10": "🌦️",  // rain
    "11": "⛈️",  // thunderstorm
    "13": "❄️",  // snow
    "50": "🌫️"   // mist
  };
  const code2 = (iconCode || "").slice(0, 2);
  const emoji = emojiMap[code2] || "—";

  // Si QUIERES usar el icono oficial de OWM, añade a tu CSP:
  //   img-src 'self' data: https://openweathermap.org;
  // y descomenta este bloque para insertar <img>:
  //
  // if (iconCode) {
  //   const url = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
  //   iconEl.innerHTML = `<img src="${url}" alt="${text || 'icono'}" width="64" height="64">`;
  //   return;
  // }

  iconEl.textContent = emoji;
}

window.addEventListener("load", () => {
  if (!navigator.geolocation) {
    if (summary) summary.textContent = "Geolocalización no disponible.";
    return;
  }

  navigator.geolocation.getCurrentPosition(async (position) => {
    try {
      lon = position.coords.longitude;
      lat = position.coords.latitude;

      const api_id = "0e84017d23ac092dc6fc9b26862ab716"; // tu OWM key
      const url_base = `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&appid=${encodeURIComponent(api_id)}&units=metric&lang=es`;

      const response = await fetch(url_base, { headers: { Accept: "application/json" } });
      const data = await response.json();

      if (!response.ok) {
        const msg = data?.message || `OpenWeather error ${response.status}`;
        throw new Error(msg);
      }

      const temp_c = data?.main?.temp ?? null;
      const desc = data?.weather?.[0]?.description ?? "";
      const place = data?.name ?? "";
      const iconCode = data?.weather?.[0]?.icon ?? ""; // p.ej. "10d"

      if (temperature) temperature.textContent = temp_c === null ? "—" : `${temp_c} °C`;
      if (summary) summary.textContent = desc || "—";
      if (loc) loc.textContent = place || "—";
      setIcon(iconCode, desc);

    } catch (err) {
      console.error(err);
      if (summary) summary.textContent = err?.message || "Unable to load weather.";
      if (temperature) temperature.textContent = "—";
      if (loc) loc.textContent = "—";
      if (iconEl) iconEl.textContent = "—";
    }
  }, (geoErr) => {
    const map = { 1: "Permiso de ubicación denegado.", 2: "No se pudo obtener la ubicación.", 3: "Tiempo de espera agotado." };
    if (summary) summary.textContent = map[geoErr.code] || "Error de geolocalización.";
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
});

const timeEl = document.querySelector(".localTime .time");
function tickLocal() {
  if (!timeEl) return;
  const now = new Date();
  timeEl.textContent = now.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}
tickLocal();
setInterval(tickLocal, 1000);

// Referencias correctas (por si las quieres):
// const url_base2 = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${api_id}&units=metric&lang=es`;
// const url_base3 = `https://api.weatherapi.com/v1/current.json?key=${api_id}&q=${lat},${lon}&aqi=no`;