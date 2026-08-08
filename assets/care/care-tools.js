(() => {
  "use strict";

  const apiBase = () => String(window.SEHATLINE_CONFIG?.apiBaseUrl || "").replace(/\/+$/, "");

  function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("The selected photo could not be read"));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("The selected file is not a valid photo"));
      image.src = source;
    });
  }

  async function preparePhoto(file) {
    if (!(file instanceof File)) throw new Error("Select a profile photo first");
    if (!/^image\/(?:jpeg|png|webp)$/i.test(file.type)) throw new Error("Use a JPG, PNG or WebP photo");
    if (file.size > 8 * 1024 * 1024) throw new Error("Photo must be smaller than 8 MB");
    const original = await readAsDataUrl(file);
    const image = await loadImage(original);
    const scale = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.82);
  }

  async function uploadPhoto(dataUrl, role) {
    const response = await fetch(`${apiBase()}/api/uploads/profile-photo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl, role })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || "Photo upload failed");
    return payload;
  }

  function devicePosition() {
    if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
      return Promise.reject(new Error("Live location needs an HTTPS connection"));
    }
    if (!navigator.geolocation) return Promise.reject(new Error("Location is not supported on this device"));
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, error => {
        const messages = {
          1: "Location permission was not allowed",
          2: "Your location is currently unavailable",
          3: "Location request timed out"
        };
        reject(new Error(messages[error.code] || "Location could not be detected"));
      }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 });
    });
  }

  async function requestLocation() {
    const position = await devicePosition();
    const response = await fetch(`${apiBase()}/api/location/reverse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || "Address could not be resolved");
    return payload;
  }

  window.SehatCare = { preparePhoto, uploadPhoto, requestLocation };
})();
