"use strict";

const appConfig = window.SEHATLINE_CONFIG || { mode: "production", apiBaseUrl: "", allowGuestAccess: false };
const isProduction = appConfig.mode === "production";
const apiUrl = (path) => `${String(appConfig.apiBaseUrl || "").replace(/\/+$/, "")}${path}`;

/* DEMO_DATA_START */
const seed = {
  doctors: [
    {
      id: "d1",
      name: "Dr. Aditi Sharma",
      initials: "AS",
      specialty: "Dermatologist",
      qualification: "MD Dermatology, AIIMS",
      experience: 12,
      fee: 450,
      rating: 4.9,
      reviews: 328,
      distance: 2.1,
      gender: "Female",
      languages: ["Hindi", "English"],
      availability: "Today",
      nextSlot: "5:30 PM",
      clinic: "Aura Skin & Laser Clinic",
      address: "Civil Lines, Prayagraj",
      avgWait: "12 min",
      colors: ["#d9f8f0", "#bce9ff", "#155f59"],
      services: ["Acne care", "Hair fall", "Skin allergy", "Laser consultation"],
      education: "MBBS — KGMU · MD Dermatology — AIIMS New Delhi"
    },
    {
      id: "d2",
      name: "Dr. Rohan Verma",
      initials: "RV",
      specialty: "Cardiologist",
      qualification: "DM Cardiology, BHU",
      experience: 16,
      fee: 700,
      rating: 4.8,
      reviews: 512,
      distance: 3.4,
      gender: "Male",
      languages: ["Hindi", "English", "Bhojpuri"],
      availability: "Tomorrow",
      nextSlot: "10:15 AM",
      clinic: "Pulse Heart Centre",
      address: "George Town, Prayagraj",
      avgWait: "18 min",
      colors: ["#dbeafe", "#c4d5ff", "#214c91"],
      services: ["Heart check-up", "ECG", "Hypertension", "Cardiac consultation"],
      education: "MBBS, MD Medicine — IMS BHU · DM Cardiology — SGPGI"
    },
    {
      id: "d3",
      name: "Dr. Nida Khan",
      initials: "NK",
      specialty: "Gynaecologist",
      qualification: "MS Obstetrics & Gynae",
      experience: 9,
      fee: 500,
      rating: 4.8,
      reviews: 276,
      distance: 4.2,
      gender: "Female",
      languages: ["Hindi", "English", "Urdu"],
      availability: "Today",
      nextSlot: "7:00 PM",
      clinic: "Nurture Women’s Clinic",
      address: "Lukerganj, Prayagraj",
      avgWait: "10 min",
      colors: ["#fae8ff", "#e3ccff", "#71347c"],
      services: ["Women’s health", "Pregnancy care", "PCOS", "Routine check-up"],
      education: "MBBS — AMU · MS Obstetrics & Gynaecology — MAMC"
    },
    {
      id: "d4",
      name: "Dr. Kabir Singh",
      initials: "KS",
      specialty: "Orthopaedic",
      qualification: "MS Orthopaedics",
      experience: 14,
      fee: 550,
      rating: 4.7,
      reviews: 410,
      distance: 5.6,
      gender: "Male",
      languages: ["Hindi", "English"],
      availability: "Today",
      nextSlot: "6:15 PM",
      clinic: "Motion Bone & Joint",
      address: "Tagore Town, Prayagraj",
      avgWait: "16 min",
      colors: ["#fef3c7", "#d7f0db", "#516642"],
      services: ["Joint pain", "Sports injury", "Fracture care", "Physiotherapy"],
      education: "MBBS — MLN Medical College · MS Orthopaedics — KGMU"
    },
    {
      id: "d5",
      name: "Dr. Meera Joshi",
      initials: "MJ",
      specialty: "Paediatrician",
      qualification: "MD Paediatrics",
      experience: 11,
      fee: 400,
      rating: 4.9,
      reviews: 389,
      distance: 6.1,
      gender: "Female",
      languages: ["Hindi", "English"],
      availability: "Tomorrow",
      nextSlot: "9:30 AM",
      clinic: "Little Steps Child Care",
      address: "Naini, Prayagraj",
      avgWait: "9 min",
      colors: ["#e0f2fe", "#c7f9ee", "#225b70"],
      services: ["Child wellness", "Vaccination", "Nutrition", "Newborn care"],
      education: "MBBS — GSVM Kanpur · MD Paediatrics — KGMU"
    },
    {
      id: "d6",
      name: "Dr. Arjun Malhotra",
      initials: "AM",
      specialty: "General Physician",
      qualification: "MD Internal Medicine",
      experience: 8,
      fee: 350,
      rating: 4.6,
      reviews: 198,
      distance: 1.8,
      gender: "Male",
      languages: ["Hindi", "English"],
      availability: "Today",
      nextSlot: "4:45 PM",
      clinic: "CareFirst Clinic",
      address: "Katra, Prayagraj",
      avgWait: "8 min",
      colors: ["#d1fae5", "#bfdbfe", "#155e75"],
      services: ["Fever & flu", "Diabetes", "General health", "Follow-up"],
      education: "MBBS — SN Medical College · MD Medicine — RML Lucknow"
    }
  ],
  labs: [
    {
      id: "l1",
      name: "HealthSure Diagnostics",
      rating: 4.8,
      reviews: 680,
      distance: 1.6,
      certified: "NABL",
      homeCollection: true,
      reportTime: "6 hours",
      test: "Thyroid Profile (T3, T4, TSH)",
      price: 499,
      originalPrice: 750,
      discount: 33,
      nextSlot: "Today, 4:00 PM"
    },
    {
      id: "l2",
      name: "CityCare PathLabs",
      rating: 4.7,
      reviews: 522,
      distance: 2.8,
      certified: "NABL",
      homeCollection: true,
      reportTime: "8 hours",
      test: "Thyroid Profile (T3, T4, TSH)",
      price: 449,
      originalPrice: 699,
      discount: 36,
      nextSlot: "Today, 5:30 PM"
    },
    {
      id: "l3",
      name: "Prima Diagnostics",
      rating: 4.6,
      reviews: 301,
      distance: 4.5,
      certified: "ISO",
      homeCollection: false,
      reportTime: "4 hours",
      test: "Thyroid Profile (T3, T4, TSH)",
      price: 575,
      originalPrice: 700,
      discount: 18,
      nextSlot: "Tomorrow, 7:00 AM"
    },
    {
      id: "l4",
      name: "Apollo Health Check",
      rating: 4.9,
      reviews: 917,
      distance: 6.2,
      certified: "NABL",
      homeCollection: true,
      reportTime: "12 hours",
      test: "Full Body Essential Package",
      price: 1299,
      originalPrice: 2299,
      discount: 43,
      nextSlot: "Tomorrow, 6:30 AM"
    }
  ],
  appointments: [
    {
      id: "a1",
      doctorId: "d1",
      date: "2026-07-26",
      day: "26",
      month: "Jul",
      time: "5:30 PM",
      type: "Clinic visit",
      status: "Confirmed",
      token: "A-18",
      currentToken: "A-14",
      ahead: 3,
      wait: 18,
      upcoming: true
    },
    {
      id: "a2",
      doctorId: "d4",
      date: "2026-07-30",
      day: "30",
      month: "Jul",
      time: "11:15 AM",
      type: "Clinic visit",
      status: "Confirmed",
      upcoming: true
    },
    {
      id: "a3",
      doctorId: "d6",
      date: "2026-07-10",
      day: "10",
      month: "Jul",
      time: "4:00 PM",
      type: "Clinic visit",
      status: "Completed",
      upcoming: false
    }
  ],
  reports: [
    { id: "r1", name: "Complete Blood Count", lab: "HealthSure Diagnostics", date: "22 Jul 2026", type: "Lab report", size: "1.8 MB" },
    { id: "r2", name: "Consultation Prescription", lab: "Dr. Arjun Malhotra", date: "10 Jul 2026", type: "Prescription", size: "620 KB" },
    { id: "r3", name: "Thyroid Profile", lab: "CityCare PathLabs", date: "28 Jun 2026", type: "Lab report", size: "1.2 MB" },
    { id: "r4", name: "Vitamin D & B12", lab: "Prima Diagnostics", date: "14 Jun 2026", type: "Lab report", size: "980 KB" }
  ],
  notifications: [
    { id: "n1", title: "Your turn is getting closer", copy: "Only 3 patients ahead of you at Aura Skin & Laser Clinic.", time: "2 min ago", icon: "activity", unread: true },
    { id: "n2", title: "Appointment confirmed", copy: "Dr. Kabir Singh confirmed your visit for 30 July at 11:15 AM.", time: "1 hour ago", icon: "check-circle", unread: true },
    { id: "n3", title: "New report uploaded", copy: "Your Complete Blood Count report is ready to view.", time: "22 Jul", icon: "file", unread: false },
    { id: "n4", title: "Health reminder", copy: "Stay hydrated today. Prayagraj is expected to be warm.", time: "21 Jul", icon: "heart", unread: false }
  ]
};
/* DEMO_DATA_END */

const state = {
  route: "home",
  doctors: [],
  labs: isProduction ? [] : structuredClone(seed.labs),
  appointments: isProduction ? [] : structuredClone(seed.appointments),
  reports: isProduction ? [] : structuredClone(seed.reports),
  notifications: isProduction ? [] : structuredClone(seed.notifications),
  doctorQuery: "",
  doctorSpecialty: "All",
  doctorMaxFee: 1000,
  doctorGender: "All",
  doctorSort: "recommended",
  labQuery: "",
  labHomeOnly: false,
  labSort: "recommended",
  compareDoctors: new Set(),
  compareLabs: new Set(),
  favorites: new Set(readStoredArray("sehatline-favorites")),
  savedLabs: new Set(readStoredArray("sehatline-saved-labs")),
  location: localStorage.getItem("sehatline-location") || "Civil Lines, Prayagraj",
  theme: localStorage.getItem("sehatline-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  appointmentTab: "upcoming",
  bookingDraft: {},
  authPhone: "",
  authMode: "login",
  authName: "",
  authDateOfBirth: "",
  authPhotoData: "",
  authPhotoUrl: "",
  pendingAuthToken: "",
  identityVerificationId: "",
  otpResendAvailableAt: 0,
  otpTimer: null,
  otpProviderMode: "",
  otpWidgetRequestId: "",
  authToken: localStorage.getItem("sehatline-auth-token") || "",
  chat: [],
  aiThinking: false,
  aiListening: false,
  aiSpeaking: false,
  aiVoiceStatus: "Ready to listen",
  voiceTranscript: "",
  pendingAi: "",
  queueTimer: null
};

let voiceRecognition = null;
let voiceFinalTranscript = "";
let voiceHadError = false;

function readStoredArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage can be unavailable in hardened/private browsing contexts.
    }
    return [];
  }
}

const icons = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10M9 20v-6h6v6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4m8-4v4M3 10h18"/>',
  sparkles: '<path d="m12 3-1.3 3.7L7 8l3.7 1.3L12 13l1.3-3.7L17 8l-3.7-1.3L12 3Z"/><path d="m5 14-.8 2.2L2 17l2.2.8L5 20l.8-2.2L8 17l-2.2-.8L5 14Zm14-1-.8 2.2L16 16l2.2.8L19 19l.8-2.2L22 16l-2.2-.8L19 13Z"/>',
  file: '<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 13h6m-6 4h6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 3.5-6 8-6s7.2 2 8 6"/>',
  map: '<path d="m9 18-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Z"/><path d="M9 3v15m6-12v15"/>',
  "map-pin": '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/>',
  moon: '<path d="M21 13.2A9 9 0 1 1 10.8 3a7 7 0 0 0 10.2 10.2Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  arrow: '<path d="m5 12 14 0m-6-6 6 6-6 6"/>',
  "arrow-left": '<path d="m19 12-14 0m6-6-6 6 6 6"/>',
  stethoscope: '<path d="M5 3v5a5 5 0 0 0 10 0V3M3 3h4m6 0h4"/><path d="M10 13v2a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="11" r="2"/>',
  compare: '<path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3m8-18h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3M8 8h8M8 16h8"/><path d="m11 5-3 3 3 3m2 2 3 3-3 3"/>',
  flask: '<path d="M9 2h6M10 2v7l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V2"/><path d="M7 16h10"/>',
  "calendar-plus": '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4m8-4v4M3 10h18m-9 3v5m-2.5-2.5h5"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5"/><path d="M4 15v5h16v-5"/>',
  activity: '<path d="M3 12h4l2-7 4 14 3-7h5"/>',
  star: '<path d="m12 2.7 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.3l6.2-.9L12 2.7Z"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  filter: '<path d="M4 5h16M7 12h10m-7 7h4"/><circle cx="8" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  "check-circle": '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  "chevron-down": '<path d="m6 9 6 6 6-6"/>',
  wallet: '<path d="M3 6h17v14H3z"/><path d="M3 9h17m-4 4h4"/>',
  users: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20c.5-4 2.5-6 6-6s5.5 2 6 6m0-5c3 0 5 1.5 5 5"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.4 8 8 10 4.6-2 8-5 8-10V6l-8-3Z"/><path d="m8 12 3 3 5-6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18m0-18c-3 3-3 15 0 18"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.7 2.7 0 1 1 3.6 2.5c-.8.3-1.1.9-1.1 1.5m0 4h.01"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  logout: '<path d="M10 4H5v16h5m4-4 4-4-4-4m4 4H9"/>',
  edit: '<path d="m4 16-1 5 5-1L19 9l-4-4L4 16Z"/><path d="m13 7 4 4"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 20h16"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.3m-6.6 6.9 6.6 4.3"/>',
  phone: '<path d="M6 3h4l1 5-2.5 1.5a15 15 0 0 0 6 6L16 13l5 1v4c0 1.7-1.3 3-3 3C9.7 21 3 14.3 3 6c0-1.7 1.3-3 3-3Z"/>',
  navigation: '<path d="m3 11 18-8-8 18-2-8-8-2Z"/>',
  alert: '<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5m0 3h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  camera: '<path d="M4 7h4l2-3h4l2 3h4v13H4z"/><circle cx="12" cy="13" r="4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/>'
};

function svg(name, className = "") {
  const body = icons[name] || icons.info;
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((node) => {
    node.innerHTML = svg(node.dataset.icon);
    node.removeAttribute("data-icon");
  });
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function doctorById(id) {
  return state.doctors.find((doctor) => doctor.id === id);
}

function labById(id) {
  return state.labs.find((lab) => lab.id === id);
}

function avatarStyle(doctor) {
  return `--avatar-a:${doctor.colors?.[0] || "#d9f8f0"};--avatar-b:${doctor.colors?.[1] || "#bce9ff"};--avatar-ink:${doctor.colors?.[2] || "#155f59"}`;
}

function doctorAvatar(doctor, large = false) {
  return `<div class="doctor-avatar${large ? " large" : ""}" style="${avatarStyle(doctor)}" aria-label="${escapeHtml(doctor.name)}"><span>${escapeHtml(doctor.initials)}</span></div>`;
}

function formatPrice(price) {
  return `₹${Number(price).toLocaleString("en-IN")}`;
}

function toast(message, icon = "check-circle") {
  const region = document.querySelector("#toastRegion");
  const node = document.createElement("div");
  node.className = "toast";
  node.innerHTML = `${svg(icon)}<span>${escapeHtml(message)}</span>`;
  region.append(node);
  setTimeout(() => {
    node.style.opacity = "0";
    node.style.transform = "translateX(18px)";
    setTimeout(() => node.remove(), 200);
  }, 3200);
}

async function apiRequest(path, options = {}) {
  const { timeoutMs = 1400, ...fetchOptions } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(apiUrl(path), {
      ...fetchOptions,
      headers: {
        "Content-Type": "application/json",
        ...(state.authToken ? { Authorization: `Bearer ${state.authToken}` } : {}),
        ...(fetchOptions.headers || {})
      },
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.error?.message || `Request failed (${response.status})`);
      error.status = response.status;
      error.details = payload?.error?.details;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

async function hydrateRemoteData() {
  window.SehatMotion?.setLoading(document.querySelector("#app"), true);
  const requests = [
    ["/api/doctors", "doctors"],
    ["/api/labs", "labs"],
    ["/api/appointments", "appointments"],
    ["/api/reports", "reports"],
    ["/api/notifications", "notifications"]
  ];
  await Promise.all(
    requests.map(async ([path, key]) => {
      try {
        const payload = await apiRequest(path);
        const list = Array.isArray(payload) ? payload : payload?.data;
        if (Array.isArray(list)) {
          if (key === "notifications") {
            state[key] = list.map((item) => ({ ...item, copy: item.copy ?? item.message ?? item.body ?? "" }));
          } else if (key === "doctors" || key === "labs") {
            state[key] = list.filter((item) => {
              const providerStatus = String(item.status || item.verificationStatus || "").toLowerCase();
              const allowedStatus = !providerStatus || ["verified", "approved", "active"].includes(providerStatus);
              return allowedStatus && item.isVerified !== false && item.verified !== false && item.active !== false;
            });
          } else {
            state[key] = list;
          }
        }
      } catch (error) {
        if (isProduction) {
          state[key] = [];
          console.error(`Unable to load production data: ${path}`, error);
        }
      }
    })
  );
  render();
  window.SehatMotion?.setLoading(document.querySelector("#app"), false);
}

function routeFromHash() {
  const route = location.hash.replace(/^#\/?/, "").split("?")[0] || "home";
  return ["home", "appointments", "ai", "reports", "profile", "doctors", "labs"].includes(route) ? route : "home";
}

function routeRequiresAuth(route) {
  return ["appointments", "reports", "profile"].includes(route);
}

function navigate(route) {
  if (!state.authToken && routeRequiresAuth(route)) {
    openAuth("login");
    return;
  }
  if (route === state.route && location.hash) {
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  location.hash = `#/${route}`;
}

function renderHeader() {
  const header = document.querySelector("#appHeader");
  const unread = state.notifications.some((notification) => notification.unread);
  const subRoute = ["doctors", "labs"].includes(state.route);
  header.innerHTML = `
    <div class="header-left">
      ${subRoute
        ? `<button class="icon-button" data-route="home" aria-label="Back to home">${svg("arrow-left")}</button>`
        : `<div class="mini-brand" aria-label="SehatLine">${animatedBrandMark()}<span>Sehat<span>Line</span></span></div>`}
      <div class="location-block">
        <p class="eyebrow">Your location</p>
        <button class="location-pill" data-action="location" aria-label="Change location">
          ${svg("map-pin")} <span>${escapeHtml(state.location)}</span> ${svg("chevron-down")}
        </button>
      </div>
    </div>
    <div class="header-actions">
      <button class="icon-button" data-action="theme" aria-label="Switch to ${state.theme === "dark" ? "light" : "dark"} mode">
        ${svg(state.theme === "dark" ? "sun" : "moon")}
      </button>
      <button class="icon-button" data-action="notifications" aria-label="Notifications">
        ${svg("bell")}${unread ? '<span class="badge-dot"></span>' : ""}
      </button>
      <button class="icon-button" data-route="profile" aria-label="Open profile">
        ${svg("user")}
      </button>
    </div>`;
}

function animatedBrandMark(extraClass = "") {
  return `<span class="animated-brand-mark ${extraClass}" aria-hidden="true">
    <img src="/assets/logos/sehatline-mark-frame.png" alt="">
    <video autoplay muted loop playsinline preload="metadata">
      <source src="/assets/logos/sehatline-animated.mp4" type="video/mp4">
    </video>
  </span>`;
}

function render() {
  const requestedRoute = routeFromHash();
  state.route = !state.authToken && routeRequiresAuth(requestedRoute) ? "home" : requestedRoute;
  if (state.route !== requestedRoute) history.replaceState(null, "", "#/home");
  renderHeader();
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.route === state.route);
  });
  const app = document.querySelector("#app");
  const renderers = {
    home: renderHome,
    appointments: renderAppointments,
    ai: renderAi,
    reports: renderReports,
    profile: renderProfile,
    doctors: renderDoctors,
    labs: renderLabs
  };
  app.innerHTML = renderers[state.route]();
  hydrateIcons(app);
  window.SehatMotion?.enhance(app);
  app.focus({ preventScroll: true });
  if (state.route === "ai") {
    scrollChat();
    if (state.pendingAi) {
      const prompt = state.pendingAi;
      state.pendingAi = "";
      setTimeout(() => handleAiQuery(prompt), 80);
    }
  }
}

function quickAction(iconName, label, route, color, bg) {
  return `
    <button class="quick-action" data-route="${route}">
      <span class="action-icon" style="--action-color:${color};--action-bg:${bg}">${svg(iconName)}</span>
      <span>${label}</span>
    </button>`;
}

const DOCTOR_CATEGORIES = Object.freeze([
  { value: "All", label: "All doctors", icon: "stethoscope", terms: [] },
  { value: "General Medicine", label: "General physician", icon: "activity", terms: ["general physician", "general medicine", "family medicine", "internal medicine"] },
  { value: "Women’s Health", label: "Gynaecologist", icon: "heart", terms: ["gynaec", "gynec", "obstetric", "women"] },
  { value: "Skin & Hair", label: "Skin & hair", icon: "sparkles", terms: ["dermat", "skin", "hair"] },
  { value: "Child Care", label: "Paediatrician", icon: "users", terms: ["paediatric", "pediatric", "child"] },
  { value: "Heart Care", label: "Cardiologist", icon: "activity", terms: ["cardio", "heart"] },
  { value: "Bones & Joints", label: "Orthopaedic", icon: "stethoscope", terms: ["ortho", "bone", "joint"] },
  { value: "ENT", label: "ENT", icon: "user", terms: ["ent", "ear nose", "otolaryng"] },
  { value: "Dental Care", label: "Dentist", icon: "shield", terms: ["dent", "oral"] },
  { value: "Mental Health", label: "Mental health", icon: "heart", terms: ["psychi", "psycholog", "mental"] },
  { value: "Eye Care", label: "Eye specialist", icon: "user", terms: ["ophthalm", "eye", "vision"] },
  { value: "Neurology", label: "Neurologist", icon: "activity", terms: ["neuro", "brain", "nerve"] },
  { value: "Diabetes & Hormones", label: "Diabetes care", icon: "activity", terms: ["diabet", "endocrin", "hormone"] },
  { value: "Stomach & Digestion", label: "Gastroenterologist", icon: "stethoscope", terms: ["gastro", "digest", "stomach", "liver"] },
  { value: "Kidney & Urinary", label: "Kidney & urinary", icon: "stethoscope", terms: ["nephro", "urolo", "kidney", "urinary"] },
  { value: "Lung Care", label: "Pulmonologist", icon: "activity", terms: ["pulmon", "respirat", "lung", "chest"] },
  { value: "Cancer Care", label: "Oncologist", icon: "shield", terms: ["oncolo", "cancer"] },
  { value: "Physiotherapy", label: "Physiotherapist", icon: "users", terms: ["physio", "rehabilitation"] }
]);

function doctorMatchesSpecialty(doctor, selected = state.doctorSpecialty) {
  if (selected === "All") return true;
  const specialty = String(doctor.specialty || "").toLowerCase();
  const category = DOCTOR_CATEGORIES.find((item) => item.value === selected);
  if (category) return category.terms.some((term) => specialty.includes(term));
  return specialty === String(selected).toLowerCase();
}

function doctorCategoryChips() {
  return DOCTOR_CATEGORIES.map((category) => `
    <button class="specialty-chip ${state.doctorSpecialty === category.value ? "active" : ""}" data-filter="specialty" data-value="${escapeHtml(category.value)}" aria-pressed="${state.doctorSpecialty === category.value}">
      <span>${svg(category.icon)}</span>${escapeHtml(category.label)}
    </button>`).join("");
}

function renderHome() {
  const upcoming = state.appointments.find((appointment) => appointment.upcoming);
  const doctor = upcoming ? doctorById(upcoming.doctorId) : state.doctors[0];
  const homeDoctors = filteredDoctors().slice(0, 5);
  return `
    <div class="page home-page">
      <section class="home-hero">
        <div class="hero-content">
          <p class="hello">Good evening, Abhigyan 👋</p>
          <h1 class="hero-title">Your health, made <span>simpler.</span></h1>
          <p class="hero-copy">Discover verified doctors, choose a suitable time and book your visit with confidence.</p>
          <div class="hero-actions" aria-label="Healthcare booking actions">
            <button class="btn btn-primary" data-route="doctors">${svg("stethoscope")} Find a doctor</button>
            <button class="btn btn-secondary" data-route="appointments">${svg("calendar")} My appointments</button>
          </div>
          <p class="hero-trust">${svg("shield")} Only admin-verified doctors are shown</p>
        </div>
        <img class="oxygen-tree oxygen-tree-patient" src="/assets/brand-motion/oxygen-tree.svg" alt="" aria-hidden="true" />
      </section>

      <section class="section" aria-labelledby="quickTitle">
        <div class="section-head">
          <h2 class="section-title" id="quickTitle">What do you need?</h2>
        </div>
        <div class="quick-grid">
          ${quickAction("stethoscope", "Find Doctor", "doctors", "var(--emerald-deep)", "rgba(0,185,130,.11)")}
          ${quickAction("calendar-plus", "Book Visit", "doctors", "var(--orange)", "rgba(247,144,9,.11)")}
          ${quickAction("activity", "Live Queue", "appointments", "var(--blue)", "rgba(37,99,235,.1)")}
          ${quickAction("file", "My Reports", "reports", "var(--red)", "rgba(239,71,111,.1)")}
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <h2 class="section-title">Care in progress</h2>
          <button class="section-link" data-route="appointments">All appointments</button>
        </div>
        <div class="home-grid">
          ${doctor ? `
          <article class="appointment-spotlight glass-card">
            <div class="appointment-top">
              ${doctorAvatar(doctor)}
              <div class="appointment-info">
                <span class="status-pill">${upcoming?.status || "Available"}</span>
                <h3>${escapeHtml(doctor.name)}</h3>
                <p>${escapeHtml(doctor.specialty)} · ${escapeHtml(doctor.clinic)}</p>
              </div>
            </div>
            <div class="appointment-time">
              <span class="info-pill">${svg("calendar")} ${upcoming?.date ? escapeHtml(bookingDateLabel(upcoming.date)) : "Choose a date"}</span>
              <span class="info-pill">${svg("clock")} ${escapeHtml(upcoming?.time || doctor.nextSlot)}</span>
              <span class="info-pill">${svg("map-pin")} ${upcoming?.type || "Clinic visit"}</span>
            </div>
            <div class="spotlight-actions">
              <button class="btn btn-primary" data-action="queue" data-id="${upcoming?.id || "a1"}">${svg("activity")} Live queue</button>
              <button class="btn btn-secondary" data-action="doctor-profile" data-id="${doctor.id}">View details</button>
            </div>
          </article>
          <article class="queue-card">
            <div class="section-head">
              <h3 class="section-title">Live clinic queue</h3>
              <span class="status-pill">Live</span>
            </div>
            <div class="queue-content">
              <div class="queue-ring">
                <div class="queue-number"><strong>${upcoming?.token || "A-18"}</strong><small>Your token</small></div>
              </div>
              <div class="queue-details">
                <strong>${upcoming?.ahead ?? 3} patients ahead</strong>
                <p>Estimated wait: ${upcoming?.wait || 18} minutes</p>
                <button class="btn" data-action="queue" data-id="${upcoming?.id || "a1"}">Track queue ${svg("arrow")}</button>
              </div>
            </div>
          </article>
          ` : `<div style="grid-column:1/-1">${emptyState("stethoscope", "No care in progress", "Your upcoming appointment will appear here once booked.", "Find a doctor", "go-doctors")}</div>`}
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <div>
            <p class="section-kicker">CHOOSE YOUR CARE</p>
            <h2 class="section-title">Verified doctors</h2>
          </div>
          <button class="section-link" data-route="doctors">View all</button>
        </div>
        <div class="specialty-scroll" aria-label="Doctor categories">${doctorCategoryChips()}</div>
        ${homeDoctors.length
          ? `<div class="horizontal-scroll">${homeDoctors.map((item) => doctorCard(item, true)).join("")}</div>`
          : state.doctors.length
            ? emptyState("search", "No doctors in this category yet", "Choose another category to see available verified doctors.", "Show all doctors", "reset-doctor-filters")
            : emptyState("stethoscope", "No doctors available yet", "Verified doctors for this location will appear here soon.", "", "")}
      </section>

      <section class="section coming-section" aria-labelledby="comingSoonTitle">
        <div class="section-head">
          <div>
            <p class="section-kicker">EXPANDING SEHATLINE</p>
            <h2 class="section-title" id="comingSoonTitle">Coming soon</h2>
          </div>
          <span class="coming-note">We are building these services carefully</span>
        </div>
        <div class="coming-grid">
          <article class="coming-card"><span class="coming-icon mint">${svg("flask")}</span><span class="coming-badge">Coming soon</span><h3>PathLabs</h3><p>Verified diagnostic centres and convenient home sample collection.</p></article>
          <article class="coming-card"><span class="coming-icon blue">${svg("file")}</span><span class="coming-badge">Coming soon</span><h3>Medicine delivery</h3><p>Prescription medicines delivered through verified pharmacy partners.</p></article>
          <article class="coming-card"><span class="coming-icon orange">${svg("users")}</span><span class="coming-badge">Coming soon</span><h3>Free medical camps</h3><p>Community check-ups and preventive care camps for underserved areas.</p></article>
          <article class="coming-card"><span class="coming-icon rose">${svg("heart")}</span><span class="coming-badge">Coming soon</span><h3>Critical care support</h3><p>Admin-verified fundraising for genuine critical medical situations.</p></article>
        </div>
      </section>

      <section class="section home-grid">
        <article class="offer-card">
          <span class="tag">SEHAT20</span>
          <h3>20% off your first health check</h3>
          <p>Verified labs · Transparent prices · Home collection</p>
        </article>
        <article class="tip-card card">
          <span class="tip-icon">${svg("heart")}</span>
          <h3 class="section-title">A small health win</h3>
          <p>A 10-minute walk after meals can support digestion and help manage blood sugar.</p>
        </article>
      </section>
    </div>`;
}

function doctorCard(doctor) {
  const isSaved = state.favorites.has(doctor.id);
  return `
    <article class="doctor-card" data-doctor-id="${doctor.id}">
      <button class="save-button ${isSaved ? "saved" : ""}" data-action="save-doctor" data-id="${doctor.id}" aria-label="${isSaved ? "Remove from" : "Add to"} saved doctors">${svg("heart")}</button>
      <div class="doctor-card-top">
        ${doctorAvatar(doctor)}
        <div class="doctor-main">
          <h3>${escapeHtml(doctor.name)}</h3>
          <p>${escapeHtml(doctor.specialty)}</p>
          <span class="verified">${svg("shield")} SehatLine verified</span>
        </div>
      </div>
      <div class="doctor-stats">
        <div class="stat-item"><strong>${formatPrice(doctor.fee)}</strong><small>Consultation</small></div>
        <div class="stat-item"><strong>${doctor.experience} yrs</strong><small>Experience</small></div>
        <div class="stat-item"><strong class="rating">${svg("star")} ${doctor.rating}</strong><small>${doctor.reviews} reviews</small></div>
      </div>
      <p class="fine">${svg("map-pin")} ${doctor.distance} km · Next: <strong class="text-emerald">${escapeHtml(doctor.nextSlot)}</strong></p>
      <div class="doctor-actions">
        <button class="btn btn-secondary" data-action="doctor-profile" data-id="${doctor.id}">Profile</button>
        <button class="btn btn-primary" data-action="book-doctor" data-id="${doctor.id}">Book</button>
      </div>
    </article>`;
}

function labCard(lab) {
  const selected = state.compareLabs.has(lab.id);
  const saved = state.savedLabs.has(lab.id);
  return `
    <article class="lab-card" data-lab-id="${lab.id}">
      <button class="save-button ${saved ? "saved" : ""}" data-action="save-lab" data-id="${lab.id}" aria-label="${saved ? "Remove from" : "Add to"} saved labs">${svg("heart")}</button>
      <div class="lab-card-top">
        <div class="lab-logo">${svg("flask")}</div>
        <div class="lab-main">
          <h3>${escapeHtml(lab.name)}</h3>
          <p><span class="rating">${svg("star")} ${lab.rating}</span> · ${lab.distance} km · ${lab.certified}</p>
          <span class="verified">${svg("shield")} Verified lab</span>
        </div>
      </div>
      <div class="lab-stats">
        <div class="stat-item"><strong>${formatPrice(lab.price)}</strong><small><s>${formatPrice(lab.originalPrice)}</s> · ${lab.discount}% off</small></div>
        <div class="stat-item"><strong>${escapeHtml(lab.reportTime)}</strong><small>Report time</small></div>
        <div class="stat-item"><strong>${lab.homeCollection ? "Available" : "Lab visit"}</strong><small>Home collection</small></div>
      </div>
      <p class="fine">${escapeHtml(lab.test)}</p>
      <div class="doctor-actions">
        <button class="compare-check ${selected ? "selected" : ""}" data-action="compare-lab" data-id="${lab.id}" aria-label="${selected ? "Remove from" : "Add to"} comparison">${selected ? svg("check") : svg("compare")}</button>
        <button class="btn btn-secondary" data-action="lab-details" data-id="${lab.id}">Details</button>
        <button class="btn btn-primary" data-action="book-lab" data-id="${lab.id}">Book test</button>
      </div>
    </article>`;
}

function doctorFilters() {
  return `
    <aside class="filter-panel card" aria-label="Doctor filters">
      <h2 class="filter-title">Filters <button class="section-link" data-action="reset-doctor-filters">Reset</button></h2>
      <div class="filter-group">
        <span class="filter-label">SPECIALIZATION</span>
        <div class="filter-options">
          ${DOCTOR_CATEGORIES.map((category) => `<button class="filter-chip ${state.doctorSpecialty === category.value ? "active" : ""}" data-filter="specialty" data-value="${escapeHtml(category.value)}">${escapeHtml(category.label)}</button>`).join("")}
        </div>
      </div>
      <div class="filter-group">
        <div class="range-line"><span>Maximum fee</span><strong>${formatPrice(state.doctorMaxFee)}</strong></div>
        <input type="range" min="300" max="1000" step="50" value="${state.doctorMaxFee}" data-filter="fee" aria-label="Maximum consultation fee" />
      </div>
      <div class="filter-group">
        <span class="filter-label">DOCTOR GENDER</span>
        <div class="filter-options">
          ${["All", "Female", "Male"].map((gender) => `<button class="filter-chip ${state.doctorGender === gender ? "active" : ""}" data-filter="gender" data-value="${gender}">${gender}</button>`).join("")}
        </div>
      </div>
      <div class="filter-group">
        <span class="filter-label">PREFERENCES</span>
        <div class="filter-options">
          <button class="filter-chip active">Available today</button>
          <button class="filter-chip">Within 5 km</button>
          <button class="filter-chip">Hindi</button>
        </div>
      </div>
    </aside>`;
}

function filteredDoctors() {
  const query = state.doctorQuery.toLowerCase().trim();
  const result = state.doctors.filter((doctor) => {
    const matchesQuery = !query || `${doctor.name} ${doctor.specialty} ${doctor.clinic}`.toLowerCase().includes(query);
    return matchesQuery
      && doctorMatchesSpecialty(doctor)
      && doctor.fee <= state.doctorMaxFee
      && (state.doctorGender === "All" || doctor.gender === state.doctorGender);
  });
  return result.sort((a, b) => {
    if (state.doctorSort === "fee") return a.fee - b.fee;
    if (state.doctorSort === "distance") return a.distance - b.distance;
    if (state.doctorSort === "rating") return b.rating - a.rating;
    return (b.rating * 10 + b.reviews / 100) - (a.rating * 10 + a.reviews / 100);
  });
}

function compareBar(type) {
  const set = type === "doctor" ? state.compareDoctors : state.compareLabs;
  if (!set.size) return "";
  return `
    <div class="compare-bar">
      <div><strong>${set.size} ${type}${set.size > 1 ? "s" : ""} selected</strong><small>Select ${Math.max(0, 2 - set.size)} more to compare</small></div>
      <button class="btn btn-ai" data-action="show-compare" data-type="${type}" ${set.size < 2 ? "disabled" : ""}>Compare now ${svg("arrow")}</button>
    </div>`;
}

function renderDoctors() {
  const results = filteredDoctors();
  const doctorsEmpty = state.doctors.length === 0;
  return `
    <div class="page">
      <div class="page-head">
        <div>
          <h1 class="page-title">Find your doctor</h1>
          <p class="page-subtitle">Explore admin-verified specialists by category, experience, location and availability.</p>
        </div>
        <button class="btn btn-ai" data-route="ai">${svg("sparkles")} Ask AI</button>
      </div>
      <div class="listing-layout">
        ${doctorFilters()}
        <section>
          <div class="search-toolbar">
            <label class="search-box">${svg("search")}<input data-doctor-search value="${escapeHtml(state.doctorQuery)}" aria-label="Search doctors" placeholder="Doctor, specialty or clinic" /></label>
            <button class="icon-button mobile-filter" data-action="mobile-doctor-filters" aria-label="Open filters">${svg("filter")}</button>
            <select class="select-box" data-doctor-sort aria-label="Sort doctors">
              <option value="recommended" ${state.doctorSort === "recommended" ? "selected" : ""}>Recommended</option>
              <option value="fee" ${state.doctorSort === "fee" ? "selected" : ""}>Lowest fee</option>
              <option value="distance" ${state.doctorSort === "distance" ? "selected" : ""}>Nearest</option>
              <option value="rating" ${state.doctorSort === "rating" ? "selected" : ""}>Top rated</option>
            </select>
          </div>
          <div class="result-line"><span id="doctorResultCount">${results.length} verified doctors</span><span>Updated just now</span></div>
          <div class="result-grid" id="doctorResults">
            ${results.length
              ? results.map((doctor) => doctorCard(doctor)).join("")
              : doctorsEmpty
                ? emptyState("stethoscope", "No doctors available yet", "Doctors approved by SehatLine Admin will appear here.", "", "")
                : emptyState("search", "No matching doctors", "Try widening your fee, specialty or gender filters.", "Reset filters", "reset-doctor-filters")}
          </div>
        </section>
      </div>
    </div>`;
}

function filteredLabs() {
  const query = state.labQuery.toLowerCase().trim();
  const result = state.labs.filter((lab) => {
    const matchesQuery = !query || `${lab.name} ${lab.test}`.toLowerCase().includes(query);
    return matchesQuery && (!state.labHomeOnly || lab.homeCollection);
  });
  return result.sort((a, b) => {
    if (state.labSort === "price") return a.price - b.price;
    if (state.labSort === "distance") return a.distance - b.distance;
    if (state.labSort === "speed") return parseInt(a.reportTime) - parseInt(b.reportTime);
    return b.rating - a.rating;
  });
}

function renderLabs() {
  const results = filteredLabs();
  return `
    <div class="page">
      <div class="page-head">
        <div>
          <h1 class="page-title">Compare diagnostic labs</h1>
          <p class="page-subtitle">Transparent test prices, trusted accreditation and convenient home collection.</p>
        </div>
        <button class="btn btn-ai" data-action="ask-lab-ai">${svg("sparkles")} Ask AI</button>
      </div>
      <div class="listing-layout">
        <aside class="filter-panel card" aria-label="Lab filters">
          <h2 class="filter-title">Filters <button class="section-link" data-action="reset-lab-filters">Reset</button></h2>
          <div class="filter-group">
            <span class="filter-label">COLLECTION</span>
            <div class="filter-options">
              <button class="filter-chip ${state.labHomeOnly ? "active" : ""}" data-action="home-collection">${svg("home")} Home collection</button>
              <button class="filter-chip active">${svg("shield")} NABL preferred</button>
            </div>
          </div>
          <div class="filter-group">
            <span class="filter-label">POPULAR TESTS</span>
            <div class="filter-options">
              ${["Thyroid", "CBC", "Vitamin D", "Diabetes", "Full body"].map((name) => `<button class="filter-chip" data-action="lab-query" data-value="${name}">${name}</button>`).join("")}
            </div>
          </div>
          <article class="offer-card violet">
            <span class="tag">HOME CARE</span>
            <h3>Free sample collection</h3>
            <p>On selected packages above ₹799</p>
          </article>
        </aside>
        <section>
          <div class="search-toolbar">
            <label class="search-box">${svg("search")}<input data-lab-search value="${escapeHtml(state.labQuery)}" aria-label="Search labs and tests" placeholder="Search test, package or lab" /></label>
            <button class="icon-button mobile-filter" data-action="mobile-lab-filters" aria-label="Open filters">${svg("filter")}</button>
            <select class="select-box" data-lab-sort aria-label="Sort labs">
              <option value="recommended" ${state.labSort === "recommended" ? "selected" : ""}>Recommended</option>
              <option value="price" ${state.labSort === "price" ? "selected" : ""}>Lowest price</option>
              <option value="distance" ${state.labSort === "distance" ? "selected" : ""}>Nearest</option>
              <option value="speed" ${state.labSort === "speed" ? "selected" : ""}>Fastest report</option>
            </select>
          </div>
          <div class="result-line"><span>${results.length} verified labs</span><span>Prices include taxes</span></div>
          <div class="result-grid">
            ${results.length ? results.map((lab) => labCard(lab)).join("") : emptyState("search", "No labs found", "Try another test name or turn off home collection.", "Reset filters", "reset-lab-filters")}
          </div>
        </section>
      </div>
      ${compareBar("lab")}
    </div>`;
}

function emptyState(iconName, title, copy, buttonText, action) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${svg(iconName)}</div>
      <h3>${title}</h3><p>${copy}</p>
      ${buttonText ? `<button class="btn btn-primary" data-action="${action}">${buttonText}</button>` : ""}
    </div>`;
}

function renderAppointments() {
  const list = state.appointments.filter((appointment) => state.appointmentTab === "upcoming" ? appointment.upcoming : !appointment.upcoming);
  return `
    <div class="page">
      <div class="page-head">
        <div>
          <h1 class="page-title">Appointments</h1>
          <p class="page-subtitle">Your consultations, live queue updates and care history.</p>
        </div>
        <button class="btn btn-primary" data-route="doctors">${svg("calendar-plus")} Book new</button>
      </div>
      <div class="appointment-tabs" role="tablist">
        <button role="tab" aria-selected="${state.appointmentTab === "upcoming"}" class="${state.appointmentTab === "upcoming" ? "active" : ""}" data-appointment-tab="upcoming">Upcoming</button>
        <button role="tab" aria-selected="${state.appointmentTab === "past"}" class="${state.appointmentTab === "past" ? "active" : ""}" data-appointment-tab="past">Past visits</button>
      </div>
      <div class="appointments-list">
        ${list.length ? list.map(appointmentCard).join("") : emptyState("calendar", "Nothing here yet", "New appointments will appear here.", "Find a doctor", "go-doctors")}
      </div>
    </div>`;
}

function appointmentCard(appointment) {
  const doctor = doctorById(appointment.doctorId) || {
    id: appointment.doctorId,
    name: appointment.doctorName || "Healthcare provider",
    specialty: appointment.specialty || "Consultation"
  };
  return `
    <article class="appointment-card card">
      <div class="date-block"><strong>${escapeHtml(appointment.day)}</strong><small>${escapeHtml(appointment.month)}</small></div>
      <div>
        <h3>${escapeHtml(doctor.name)}</h3>
        <p>${escapeHtml(doctor.specialty)} · ${escapeHtml(appointment.time)}</p>
        <span class="status-pill ${appointment.status === "Completed" ? "blue" : ""}">${escapeHtml(appointment.status)}</span>
      </div>
      <div class="appointment-card-actions">
        ${appointment.upcoming
          ? `<button class="btn btn-secondary" data-action="reschedule" data-id="${appointment.id}">Reschedule</button>
             <button class="btn btn-primary" data-action="queue" data-id="${appointment.id}">${svg("activity")} Queue</button>`
          : `<button class="btn btn-secondary" data-action="doctor-profile" data-id="${doctor.id}">Doctor</button>
             <button class="btn btn-primary" data-action="book-doctor" data-id="${doctor.id}">Book again</button>`}
      </div>
    </article>`;
}

function renderAi() {
  const medicalSuggestions = [
    { icon: "activity", title: "I have fever and body ache", copy: "General self-care and warning signs" },
    { icon: "stethoscope", title: "Which doctor should I consult?", copy: "Choose the right medical specialty" },
    { icon: "file", title: "Help me understand a lab report", copy: "Explain common report terms" },
    { icon: "shield", title: "Medicine safety information", copy: "General precautions and questions to ask" }
  ];
  const voiceState = state.aiListening ? "listening" : state.aiSpeaking ? "speaking" : state.aiThinking ? "thinking" : "idle";
  const voiceActionLabel = state.aiListening
    ? "Listening…"
    : state.aiSpeaking
      ? "Stop speaking"
      : "Talk to Medical AI";
  return `
    <div class="page ai-page">
      <aside class="ai-intro" data-voice-state="${voiceState}">
        <div class="assistant-stage" role="img" aria-label="Animated glass-style male SehatLine medical assistant">
          <span class="assistant-halo halo-one" aria-hidden="true"></span>
          <span class="assistant-halo halo-two" aria-hidden="true"></span>
          <span class="voice-wave wave-one" aria-hidden="true"></span>
          <span class="voice-wave wave-two" aria-hidden="true"></span>
          <div class="glass-boy" aria-hidden="true">
            <div class="glass-head">
              <span class="glass-hair"></span>
              <span class="glass-ear left"></span><span class="glass-ear right"></span>
              <span class="glass-eye left"></span><span class="glass-eye right"></span>
              <span class="glass-nose"></span>
              <span class="glass-mouth"><i></i><i></i><i></i></span>
            </div>
            <span class="glass-neck"></span>
            <div class="glass-body"><span class="owner-mark">S</span><span class="glass-lapel left"></span><span class="glass-lapel right"></span></div>
            <span class="glass-arm left"></span><span class="glass-arm right"></span>
            <span class="glass-hand left"></span><span class="glass-hand right"></span>
            <span class="glass-leg left"></span><span class="glass-leg right"></span>
          </div>
          <span class="stage-floor" aria-hidden="true"></span>
        </div>
        <div class="owner-ai-label"><i></i><span><strong>Sehat AI · Medical only</strong><small>${escapeHtml(state.aiVoiceStatus)}</small></span></div>
        <h1>Your medical assistant</h1>
        <p>Ask health questions, understand common medical terms, or find the right type of care. Non-medical topics stay outside this chat.</p>
        <button class="owner-voice-cta" type="button" data-action="voice" aria-pressed="${state.aiListening || state.aiSpeaking}">
          ${svg(state.aiSpeaking ? "x" : "activity")} <span>${voiceActionLabel}</span>
        </button>
        <div class="safety-note">${svg("shield")} General medical information only—not a diagnosis or prescription. For severe symptoms or emergencies, seek urgent in-person care.</div>
      </aside>
      <section class="ai-chat glass-card" aria-label="Chat with Sehat AI">
        <div class="chat-messages" id="chatMessages" aria-live="polite">
          ${state.chat.length ? state.chat.map(chatMessage).join("") : `
            <div class="ai-empty-start">
              <span class="ai-empty-mark">${svg("sparkles")}</span>
              <h2>How can I help with your health?</h2>
              <p>Choose a medical topic to start, or type your question below.</p>
              <div class="medical-suggestion-grid" aria-label="Medical chat suggestions">
                ${medicalSuggestions.map((suggestion) => `
                  <button class="medical-suggestion" data-ai-prompt="${escapeHtml(suggestion.title)}">
                    <span>${svg(suggestion.icon)}</span>
                    <strong>${escapeHtml(suggestion.title)}</strong>
                    <small>${escapeHtml(suggestion.copy)}</small>
                  </button>`).join("")}
              </div>
            </div>`}
          ${state.aiThinking ? `<div class="chat-message assistant"><span class="chat-avatar">${svg("sparkles")}</span><div class="bubble"><span class="typing"><i></i><i></i><i></i></span></div></div>` : ""}
        </div>
        <form class="chat-form" id="aiForm">
          <input name="query" value="${escapeHtml(state.voiceTranscript)}" autocomplete="off" aria-label="Ask a medical question" placeholder="${state.aiListening ? "Listening… बोलिए" : "Ask a medical question…"}" ${state.aiThinking ? "disabled" : ""} />
          <button type="button" class="icon-button voice-input-button ${state.aiListening ? "is-listening" : ""}" data-action="voice" aria-label="${state.aiListening ? "Stop voice input" : "Use voice input"}" aria-pressed="${state.aiListening}">${svg(state.aiSpeaking ? "x" : "activity")}</button>
          <button class="icon-button" aria-label="Send message" ${state.aiThinking ? "disabled" : ""}>${svg("arrow")}</button>
        </form>
      </section>
    </div>`;
}

function chatMessage(message) {
  return `
    <div class="chat-message ${message.role}">
      <span class="chat-avatar">${svg(message.role === "assistant" ? "sparkles" : "user")}</span>
      <div class="bubble">${escapeHtml(message.text).replace(/\n/g, "<br>")}</div>
    </div>`;
}

function stopVoiceAssistant({ announce = false } = {}) {
  if (voiceRecognition) {
    voiceRecognition.onend = null;
    try {
      voiceRecognition.stop();
    } catch {
      // Recognition may already be stopped by the browser.
    }
    voiceRecognition = null;
  }
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  voiceFinalTranscript = "";
  state.aiListening = false;
  state.aiSpeaking = false;
  state.aiVoiceStatus = "Ready to listen";
  if (state.route === "ai") render();
  if (announce) toast("Voice assistant stopped", "activity");
}

function preferredMedicalVoice(text) {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const isHindi = /[\u0900-\u097F]/.test(text);
  const preferredLanguage = isHindi ? "hi-IN" : "en-IN";
  return voices.find((voice) => voice.lang === preferredLanguage && /(ravi|hemant|male|aarav|guy|david)/i.test(voice.name))
    || voices.find((voice) => voice.lang === preferredLanguage)
    || voices.find((voice) => voice.lang?.startsWith(isHindi ? "hi" : "en"))
    || null;
}

function speakAiResponse(text) {
  if (!text || !("speechSynthesis" in window)) {
    state.aiVoiceStatus = "Voice output is unavailable";
    if (state.route === "ai") render();
    toast("Voice output is not supported on this device", "alert");
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = preferredMedicalVoice(text);
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || (/[\u0900-\u097F]/.test(text) ? "hi-IN" : "en-IN");
  utterance.rate = 0.96;
  utterance.pitch = 0.9;
  utterance.volume = 1;
  utterance.onstart = () => {
    state.aiSpeaking = true;
    state.aiVoiceStatus = "Speaking with you";
    if (state.route === "ai") render();
  };
  const finishSpeaking = () => {
    state.aiSpeaking = false;
    state.aiVoiceStatus = "Ready to listen";
    if (state.route === "ai") render();
  };
  utterance.onend = finishSpeaking;
  utterance.onerror = finishSpeaking;
  window.speechSynthesis.speak(utterance);
}

function startVoiceAssistant() {
  if (state.aiListening || state.aiSpeaking) {
    stopVoiceAssistant({ announce: true });
    return;
  }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    state.aiVoiceStatus = "Voice input is unavailable";
    render();
    toast("Voice input is not supported here. You can still type your message.", "alert");
    return;
  }

  voiceRecognition = new SpeechRecognition();
  voiceRecognition.lang = "hi-IN";
  voiceRecognition.continuous = false;
  voiceRecognition.interimResults = true;
  voiceRecognition.maxAlternatives = 1;
  voiceFinalTranscript = "";
  voiceHadError = false;

  voiceRecognition.onstart = () => {
    state.aiListening = true;
    state.aiVoiceStatus = "Listening… बोलिए";
    state.voiceTranscript = "";
    if (state.route === "ai") render();
  };
  voiceRecognition.onresult = (event) => {
    let interimTranscript = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index][0]?.transcript || "";
      if (event.results[index].isFinal) voiceFinalTranscript += transcript;
      else interimTranscript += transcript;
    }
    state.voiceTranscript = (voiceFinalTranscript || interimTranscript).trim();
    const input = document.querySelector("#aiForm input[name='query']");
    if (input) input.value = state.voiceTranscript;
    const status = document.querySelector(".owner-ai-label small");
    if (status) status.textContent = state.voiceTranscript || "Listening… बोलिए";
  };
  voiceRecognition.onerror = (event) => {
    voiceHadError = true;
    state.aiListening = false;
    state.aiVoiceStatus = event.error === "not-allowed" ? "Microphone permission needed" : "I could not hear that";
    if (state.route === "ai") render();
    toast(event.error === "not-allowed" ? "Please allow microphone access to use voice" : "I could not hear you. Please try again.", "alert");
  };
  voiceRecognition.onend = () => {
    voiceRecognition = null;
    state.aiListening = false;
    const query = voiceFinalTranscript.trim();
    voiceFinalTranscript = "";
    if (query && !voiceHadError) {
      state.voiceTranscript = "";
      handleAiQuery(query, { speakReply: true });
    } else if (!voiceHadError && state.route === "ai") {
      state.aiVoiceStatus = "Ready to listen";
      render();
    }
  };

  try {
    voiceRecognition.start();
  } catch {
    voiceRecognition = null;
    state.aiListening = false;
    state.aiVoiceStatus = "Ready to listen";
    toast("Voice could not start. Please try again.", "alert");
  }
}

async function handleAiQuery(rawText, { speakReply = false } = {}) {
  const text = rawText.trim();
  if (!text || state.aiThinking) return;
  state.voiceTranscript = "";
  state.chat.push({ role: "user", text });
  state.aiThinking = true;
  state.aiVoiceStatus = speakReply ? "Finding the best answer" : state.aiVoiceStatus;
  render();
  let response;
  try {
    const payload = await apiRequest("/api/ai/medical-chat", {
      method: "POST",
      body: JSON.stringify({
        query: text,
        location: state.location,
        history: state.chat.slice(-8).map(({ role, text: messageText }) => ({ role, text: messageText }))
      })
    });
    response = {
      role: "assistant",
      text: payload.answer || payload.message
    };
    if (!response.text) throw new Error("Invalid AI response");
  } catch {
    response = localMedicalAssistantResponse(text);
  }
  state.aiThinking = false;
  state.chat.push(response);
  render();
  if (speakReply) speakAiResponse(response.text);
}

function localMedicalAssistantResponse(text) {
  const normalized = text.toLowerCase();
  if (/(severe chest pain|chest pain|difficulty breathing|breathing difficulty|blue lips|faint|unconscious|बेहोश|सीने में दर्द|सांस लेने में दिक्कत)/.test(normalized)) {
    return {
      role: "assistant",
      text: "This could need urgent medical attention. Please contact local emergency services or go to the nearest emergency department now—especially for severe chest pain, breathing difficulty, blue lips, fainting, or unconsciousness. Do not wait for an online reply."
    };
  }

  const medicalTopic = /(health|medical|doctor|hospital|clinic|symptom|pain|fever|cold|cough|headache|vomit|nausea|diarrh|infection|rash|skin|heart|blood|pressure|sugar|diabetes|thyroid|pregnan|period|medicine|tablet|dose|report|test|lab|scan|x-ray|mental|anxiety|stress|sleep|diet|nutrition|exercise|injury|wound|vaccine|child|baby|fever|body ache|स्वास्थ्य|डॉक्टर|दवा|बुखार|दर्द|खांसी|जांच|रिपोर्ट|चक्कर|उल्टी|पेट|सांस)/i.test(normalized);
  if (!medicalTopic) {
    return {
      role: "assistant",
      text: "I’m a medical-only assistant, so I can’t help with that topic. You can ask me about symptoms, medicines, reports, doctor specialties, tests, or when to seek care."
    };
  }

  if (/(fever|body ache|बुखार|बदन दर्द)/.test(normalized)) return {
    role: "assistant",
    text: "For mild fever and body ache, rest, drink enough fluids, and monitor temperature. Avoid starting antibiotics on your own. Seek medical care sooner if fever is very high, lasts more than 2–3 days, or comes with breathing trouble, confusion, severe weakness, stiff neck, dehydration, pregnancy, or a serious existing illness. What is the temperature, how long has it lasted, and are there any other symptoms?"
  };

  if (/(medicine|tablet|dose|दवा|गोली)/.test(normalized)) return {
    role: "assistant",
    text: "I can explain general medicine safety, but I can’t prescribe, choose a dose, or tell you to stop a prescribed medicine. Please share the medicine name, strength, why it was prescribed, and any allergies or other medicines you take. For a dosing decision, confirm with a doctor or pharmacist."
  };

  if (/(report|lab|test|cbc|thyroid|blood|scan|x-ray|जांच|रिपोर्ट)/.test(normalized)) return {
    role: "assistant",
    text: "I can explain common report terms and what questions to ask your doctor. Share the test name, result, unit, and the laboratory’s reference range—remove your name, phone number, and other personal details. I will not diagnose from a report alone."
  };

  if (/(which doctor|specialist|specialty|consult|डॉक्टर|किस डॉक्टर)/.test(normalized)) return {
    role: "assistant",
    text: "Tell me the main symptom, where it is, how long it has been present, your age group, and whether it is getting worse. I can suggest the appropriate medical specialty, but a clinician must make the diagnosis."
  };

  if (/(anxiety|stress|mental|panic|sleep|चिंता|तनाव|नींद)/.test(normalized)) return {
    role: "assistant",
    text: "I can offer general mental-health information and help you decide what kind of professional support may fit. If you feel unsafe, might harm yourself, or cannot cope right now, seek immediate in-person help from local emergency services or a trusted person nearby. What have you been experiencing, and for how long?"
  };

  return {
    role: "assistant",
    text: "I can help with general medical information, not diagnosis or prescriptions. Please describe the symptom or health concern, how long it has been present, your age group, severity, and any warning signs such as breathing difficulty, fainting, heavy bleeding, or severe pain."
  };
}

function renderReports() {
  return `
    <div class="page">
      <div class="page-head">
        <div>
          <h1 class="page-title">Health records</h1>
          <p class="page-subtitle">Your reports, prescriptions and test history—securely organised.</p>
        </div>
        <button class="btn btn-primary" data-action="upload-report">${svg("upload")} Upload</button>
      </div>
      <div class="appointment-tabs">
        <button class="active">All records</button><button>Lab reports</button><button>Prescriptions</button>
      </div>
      <div class="reports-grid">
        ${state.reports.map((report) => `
          <article class="report-card card">
            <span class="report-icon ${report.type === "Prescription" ? "prescription" : ""}">${svg(report.type === "Prescription" ? "file" : "flask")}</span>
            <div>
              <h3>${escapeHtml(report.name)}</h3>
              <p>${escapeHtml(report.lab)}</p>
              <div class="report-meta"><span class="fine">${escapeHtml(report.date)}</span><span class="fine">·</span><span class="fine">${escapeHtml(report.size)}</span></div>
            </div>
            <div>
              <button class="icon-button" data-action="view-report" data-id="${report.id}" aria-label="View report">${svg("file")}</button>
              <button class="icon-button" data-action="share-report" data-id="${report.id}" aria-label="Share report">${svg("share")}</button>
            </div>
          </article>`).join("")}
      </div>
      <section class="section">
        <article class="offer-card violet">
          <span class="tag">COMING SOON</span>
          <h3>Understand your report with Sehat AI</h3>
          <p>Simple explanations with clear safety guidance—never a diagnosis.</p>
        </article>
      </section>
    </div>`;
}

function settingRow(iconName, title, subtitle, action, tail = "chevron") {
  return `
    <button class="setting-row" data-action="${action}">
      <span class="setting-icon">${svg(iconName)}</span>
      <span class="setting-copy"><strong>${title}</strong><small>${subtitle}</small></span>
      ${tail === "switch" ? `<span class="switch ${state.theme === "dark" ? "on" : ""}"></span>` : `<span class="chevron">${svg("chevron")}</span>`}
    </button>`;
}

function renderProfile() {
  return `
    <div class="page">
      <div class="page-head">
        <div><h1 class="page-title">My SehatLine</h1><p class="page-subtitle">Family health, saved care and account preferences.</p></div>
        <button class="btn btn-secondary" data-action="edit-profile">${svg("edit")} Edit profile</button>
      </div>
      <div class="profile-layout">
        <aside class="profile-card card">
          <div class="profile-hero">
            <div class="profile-avatar">AM</div>
            <div><h2>Abhigyan Maurya</h2><p>+91 98••• ••210</p><span class="verified">${svg("shield")} Phone verified</span></div>
          </div>
          <div class="profile-score">
            <div class="row"><strong>Profile complete</strong><span class="text-emerald strong">82%</span></div>
            <div class="progress"><span></span></div>
          </div>
          <div class="profile-mini-stats">
            <div><strong>${state.appointments.length}</strong><span>Appointments</span></div>
            <div><strong>${state.reports.length}</strong><span>Reports</span></div>
            <div><strong>${state.favorites.size}</strong><span>Saved</span></div>
          </div>
        </aside>
        <section class="settings-card card">
          <div class="settings-group">
            <h2 class="settings-label">Care & family</h2>
            ${settingRow("users", "Family members", "Manage profiles for your loved ones", "family")}
            ${settingRow("heart", "Saved doctors & labs", `${state.favorites.size + state.savedLabs.size} saved providers`, "saved")}
            ${settingRow("calendar", "Appointments", "Upcoming and past consultations", "go-appointments")}
            ${settingRow("file", "Medical records", `${state.reports.length} documents`, "go-reports")}
          </div>
          <div class="settings-group">
            <h2 class="settings-label">Preferences</h2>
            ${settingRow("globe", "Language", "English · हिंदी available", "language")}
            ${settingRow(state.theme === "dark" ? "moon" : "sun", "Dark appearance", state.theme === "dark" ? "On" : "Off", "theme", "switch")}
            ${settingRow("bell", "Notifications", "Appointments, queue and reports", "notifications-settings")}
          </div>
          <div class="settings-group">
            <h2 class="settings-label">Support & privacy</h2>
            ${settingRow("lock", "Account & privacy", "Security and data controls", "account")}
            ${settingRow("help", "Help & support", "FAQs and contact support", "support")}
            ${settingRow("logout", "Log out", "Secure sign-in will be required again", "logout")}
          </div>
        </section>
      </div>
    </div>`;
}

function openModal(content, wide = false) {
  closeQueueTimer();
  closeOtpTimer();
  const template = document.querySelector("#modalTemplate");
  const modal = template.content.cloneNode(true);
  const panel = modal.querySelector(".modal-panel");
  if (wide) panel.classList.add("wide");
  modal.querySelector(".modal-content").innerHTML = content;
  const root = document.querySelector("#modalRoot");
  root.replaceChildren(modal);
  hydrateIcons(root);
  window.SehatMotion?.openModal(root);
  document.body.style.overflow = "hidden";
  setTimeout(() => root.querySelector(".modal-close")?.focus(), 0);
}

function closeModal() {
  const root = document.querySelector("#modalRoot");
  if (root.dataset.authRequired === "true" && root.dataset.authDismissible !== "true" && !state.authToken) return;
  closeQueueTimer();
  closeOtpTimer();
  const cleanup = () => {
    delete root.dataset.authRequired;
    delete root.dataset.authDismissible;
    root.replaceChildren();
    document.body.style.overflow = "";
  };
  if (window.SehatMotion) window.SehatMotion.closeModal(root, cleanup);
  else cleanup();
}

function closeQueueTimer() {
  if (state.queueTimer) {
    clearInterval(state.queueTimer);
    state.queueTimer = null;
  }
}

function closeOtpTimer() {
  if (state.otpTimer) {
    clearInterval(state.otpTimer);
    state.otpTimer = null;
  }
}

function openDoctorProfile(id) {
  const doctor = doctorById(id);
  if (!doctor) return;
  const registrationNumber = doctor.registrationNumber || doctor.licenseNumber || "";
  const registrationCouncil = doctor.registrationCouncil || doctor.medicalCouncil || "";
  openModal(`
    <div class="profile-cover"></div>
    <div class="doctor-profile-head">
      ${doctorAvatar(doctor, true)}
      <div class="doctor-main">
        <span class="verified">${svg("shield")} SehatLine verified</span>
        <h2 class="modal-title" id="modalTitle">${escapeHtml(doctor.name)}</h2>
        <p>${escapeHtml(doctor.specialty)} · ${escapeHtml(doctor.qualification)}</p>
        <span class="rating">${svg("star")} ${doctor.rating} · ${doctor.reviews} reviews</span>
      </div>
    </div>
    <div class="profile-tags">
      ${doctor.languages.map((language) => `<span class="tag">${language}</span>`).join("")}
      <span class="tag">${doctor.gender}</span><span class="tag">${doctor.experience} years</span>
    </div>
    <section class="modal-section">
      <div class="detail-grid">
        <div class="detail-tile"><strong>${formatPrice(doctor.fee)}</strong><small>Consultation fee</small></div>
        <div class="detail-tile"><strong>${doctor.distance} km</strong><small>From your location</small></div>
        <div class="detail-tile"><strong>${doctor.avgWait}</strong><small>Average wait</small></div>
        ${registrationNumber ? `<div class="detail-tile"><strong>${escapeHtml(registrationNumber)}</strong><small>${escapeHtml(registrationCouncil || "Medical council")} registration</small></div>` : ""}
      </div>
    </section>
    <section class="modal-section">
      <h3 class="section-title">Clinic & availability</h3>
      <p class="modal-subtitle">${escapeHtml(doctor.clinic)} · ${escapeHtml(doctor.address)}</p>
      <div class="time-slots">
        <span class="time-chip active">${escapeHtml(doctor.nextSlot)}</span>
        <span class="time-chip">6:30 PM</span><span class="time-chip">7:15 PM</span>
      </div>
    </section>
    <section class="modal-section">
      <h3 class="section-title">About & education</h3>
      <p class="modal-subtitle">${escapeHtml(doctor.education)}. Experienced in patient-centred, evidence-based care.</p>
    </section>
    <section class="modal-section">
      <h3 class="section-title">Services</h3>
      <div class="profile-tags">${doctor.services.map((service) => `<span class="tag">${escapeHtml(service)}</span>`).join("")}</div>
    </section>
    <div class="profile-footer-actions">
      <button class="btn btn-secondary" data-action="save-doctor" data-id="${doctor.id}">${svg("heart")} Save</button>
      <button class="btn btn-primary" data-action="book-doctor" data-id="${doctor.id}">${svg("calendar-plus")} Book appointment · ${formatPrice(doctor.fee)}</button>
    </div>`);
}

function openLabDetails(id) {
  const lab = labById(id);
  if (!lab) return;
  openModal(`
    <div class="row" style="gap:14px">
      <span class="lab-logo">${svg("flask")}</span>
      <div><span class="verified">${svg("shield")} ${lab.certified} accredited</span><h2 class="modal-title" id="modalTitle">${escapeHtml(lab.name)}</h2><span class="rating">${svg("star")} ${lab.rating} · ${lab.reviews} reviews</span></div>
    </div>
    <p class="modal-subtitle">${lab.distance} km away · Reports in ${escapeHtml(lab.reportTime)} · ${lab.homeCollection ? "Home collection available" : "Lab visit required"}</p>
    <div class="booking-summary">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div><strong>${escapeHtml(lab.test)}</strong><p class="fine">Includes all standard parameters</p></div>
        <div style="text-align:right"><strong>${formatPrice(lab.price)}</strong><div class="fine"><s>${formatPrice(lab.originalPrice)}</s> · ${lab.discount}% off</div></div>
      </div>
    </div>
    <section class="modal-section">
      <h3 class="section-title">Why patients choose this lab</h3>
      <div class="detail-grid">
        <div class="detail-tile"><strong>${escapeHtml(lab.reportTime)}</strong><small>Digital report</small></div>
        <div class="detail-tile"><strong>${lab.homeCollection ? "Yes" : "No"}</strong><small>Home collection</small></div>
        <div class="detail-tile"><strong>${escapeHtml(lab.certified)}</strong><small>Accreditation</small></div>
      </div>
    </section>
    <div class="profile-footer-actions">
      <button class="btn btn-secondary" data-action="save-lab" data-id="${lab.id}">${svg("heart")} Save</button>
      <button class="btn btn-primary" data-action="book-lab" data-id="${lab.id}">Book test · ${formatPrice(lab.price)}</button>
    </div>`);
}

function localIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function bookingDateOptions(startIso) {
  const start = startIso ? new Date(`${startIso}T00:00:00`) : new Date();
  if (!startIso) start.setDate(start.getDate() + 1);
  return Array.from({ length: 4 }, (_, offset) => {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    return {
      iso: localIsoDate(date),
      weekday: new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(date),
      day: new Intl.DateTimeFormat("en-IN", { day: "2-digit" }).format(date),
      month: new Intl.DateTimeFormat("en-IN", { month: "short" }).format(date)
    };
  });
}

function bookingDateLabel(iso) {
  const date = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function appointmentDateParts(iso) {
  const date = new Date(`${iso}T00:00:00`);
  return {
    day: new Intl.DateTimeFormat("en-IN", { day: "2-digit" }).format(date),
    month: new Intl.DateTimeFormat("en-IN", { month: "short" }).format(date)
  };
}

function formatSlotTime(time) {
  const [hours, minutes] = String(time || "").split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return String(time || "");
  const hour = ((hours + 11) % 12) + 1;
  return `${hour}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}

async function openBooking(doctorId, step = 1) {
  const doctor = doctorById(doctorId);
  if (!doctor) return;
  state.bookingDraft.doctorId = doctorId;
  const dateOptions = bookingDateOptions(state.bookingDraft.rescheduleId ? state.bookingDraft.dateISO : undefined);
  state.bookingDraft.dateISO ||= dateOptions[0].iso;
  let liveSlots = [];
  if (step === 1) {
    try {
      const schedule = await apiRequest(`/api/doctors/${encodeURIComponent(doctorId)}/slots?date=${encodeURIComponent(state.bookingDraft.dateISO)}`, { timeoutMs: 5000 });
      liveSlots = Array.isArray(schedule?.slots) ? schedule.slots.filter(slot => slot.available !== false) : [];
    } catch {
      liveSlots = [];
    }
    if (!liveSlots.some(slot => slot.time === state.bookingDraft.time)) state.bookingDraft.time = liveSlots[0]?.time || "";
  }
  state.bookingDraft.type ||= "Clinic visit";
  state.bookingDraft.patient ||= "Abhigyan Maurya";
  const steps = `<div class="stepper"><span class="active"></span><span class="${step >= 2 ? "active" : ""}"></span><span class="${step >= 3 ? "active" : ""}"></span></div>`;
  let content = "";
  if (step === 1) {
    content = `
      <h2 class="modal-title" id="modalTitle">Choose a slot</h2>
      <p class="modal-subtitle">Book with ${escapeHtml(doctor.name)} · ${escapeHtml(doctor.clinic)}</p>${steps}
      <div class="field"><label>APPOINTMENT TYPE</label><div class="choice-row">
        ${["Clinic visit", "Online consult"].map((type) => `<button class="type-chip ${state.bookingDraft.type === type ? "active" : ""}" data-booking-choice="type" data-value="${type}">${svg(type === "Clinic visit" ? "map-pin" : "video")} ${type}</button>`).join("")}
      </div></div>
      <div class="field"><label>SELECT DATE</label><div class="choice-row">
        ${dateOptions.map((date) => `<button class="date-chip ${state.bookingDraft.dateISO === date.iso ? "active" : ""}" data-booking-choice="dateISO" data-value="${date.iso}"><span>${date.weekday}</span><strong>${date.day}</strong><span>${date.month}</span></button>`).join("")}
      </div></div>
      <div class="field"><label>AVAILABLE TIME</label><div class="choice-row">
        ${liveSlots.length ? liveSlots.map(slot => `<button class="time-chip ${state.bookingDraft.time === slot.time ? "active" : ""}" data-booking-choice="time" data-value="${slot.time}">${formatSlotTime(slot.time)}</button>`).join("") : `<div class="slot-empty">No live slots published for this date. Choose another date or ask the clinic.</div>`}
      </div></div>
      <button class="btn btn-primary btn-block" data-booking-next="2" ${liveSlots.length ? "" : "disabled"}>Continue ${svg("arrow")}</button>`;
  } else if (step === 2) {
    content = `
      <h2 class="modal-title" id="modalTitle">Patient details</h2>
      <p class="modal-subtitle">Tell the doctor who the appointment is for.</p>${steps}
      <div class="field"><label>PATIENT</label><select id="bookingPatient"><option>Abhigyan Maurya</option><option>Sunita Maurya</option><option>Add family member</option></select></div>
      <div class="field"><label>REASON FOR VISIT</label><textarea id="bookingReason" placeholder="Briefly describe the concern (optional)">${escapeHtml(state.bookingDraft.reason || "")}</textarea></div>
      <div class="field"><label>PAYMENT</label><div class="choice-row">
        <button class="type-chip active">${svg("wallet")} Pay at clinic</button><button class="type-chip">${svg("phone")} UPI</button>
      </div></div>
      <div class="row" style="gap:9px"><button class="btn btn-secondary" data-booking-next="1">Back</button><button class="btn btn-primary" style="flex:1" data-booking-next="3">Review booking ${svg("arrow")}</button></div>`;
  } else {
    content = `
      <h2 class="modal-title" id="modalTitle">Review & confirm</h2>
      <p class="modal-subtitle">Please check the details before booking.</p>${steps}
      <div class="booking-summary">
        <div class="booking-summary-head">${doctorAvatar(doctor)}<div><h3>${escapeHtml(doctor.name)}</h3><p class="fine">${escapeHtml(doctor.specialty)} · ${escapeHtml(doctor.clinic)}</p></div></div>
        <div class="appointment-time">
          <span class="info-pill">${svg("calendar")} ${escapeHtml(bookingDateLabel(state.bookingDraft.dateISO))}</span>
          <span class="info-pill">${svg("clock")} ${escapeHtml(formatSlotTime(state.bookingDraft.time))}</span>
          <span class="info-pill">${svg("map-pin")} ${escapeHtml(state.bookingDraft.type)}</span>
        </div>
        <div class="booking-total"><span>Pay ${state.bookingDraft.type === "Clinic visit" ? "at clinic" : "online"}</span><strong>${formatPrice(doctor.fee)}</strong></div>
      </div>
      <div class="safety-note" style="color:var(--text-soft);background:var(--surface-soft);border-color:var(--line)">${svg("info")} Free cancellation up to 2 hours before the appointment.</div>
      <div class="row" style="gap:9px;margin-top:16px"><button class="btn btn-secondary" data-booking-next="2">Back</button><button class="btn btn-primary" style="flex:1" data-action="confirm-booking">Confirm appointment</button></div>`;
  }
  openModal(content);
}

async function confirmBooking() {
  const doctor = doctorById(state.bookingDraft.doctorId);
  const rescheduleId = state.bookingDraft.rescheduleId;
  const dateParts = appointmentDateParts(state.bookingDraft.dateISO);
  const newAppointment = {
    id: rescheduleId || `a${Date.now()}`,
    doctorId: doctor.id,
    doctorName: doctor.name,
    date: state.bookingDraft.dateISO,
    day: dateParts.day,
    month: dateParts.month,
    time: state.bookingDraft.time,
    type: state.bookingDraft.type,
    patient: state.bookingDraft.patient,
    patientName: state.bookingDraft.patient,
    reason: state.bookingDraft.reason || "",
    amount: doctor.fee,
    status: "Confirmed",
    upcoming: true
  };
  let savedAppointment = newAppointment;
  try {
    const response = await apiRequest(rescheduleId ? `/api/appointments/${encodeURIComponent(rescheduleId)}` : "/api/appointments", {
      method: rescheduleId ? "PATCH" : "POST",
      body: JSON.stringify(newAppointment)
    });
    savedAppointment = { ...newAppointment, ...(response || {}) };
  } catch (error) {
    toast(error.message || "This token could not be booked. Please choose another slot.", "error");
    return;
  }
  if (rescheduleId) {
    state.appointments = state.appointments.map((appointment) =>
      appointment.id === rescheduleId ? { ...appointment, ...savedAppointment } : appointment
    );
  } else {
    state.appointments.unshift(savedAppointment);
  }
  openModal(`
    <div class="success-state">
      <div class="success-check">${svg("check")}</div>
      <h2 id="modalTitle">${rescheduleId ? "Appointment rescheduled!" : "Appointment confirmed!"}</h2>
      <p>Your visit with ${escapeHtml(doctor.name)} is ${rescheduleId ? "now scheduled" : "booked"} for ${escapeHtml(bookingDateLabel(state.bookingDraft.dateISO))} at ${escapeHtml(formatSlotTime(state.bookingDraft.time))}.</p>
      <div class="booking-summary"><span class="fine">${savedAppointment.token ? "LIVE TOKEN" : "BOOKING ID"}</span><h3>${escapeHtml(savedAppointment.token || savedAppointment.id?.toUpperCase() || rescheduleId?.toUpperCase() || "Confirmed")}</h3>${savedAppointment.token ? `<p class="fine">Issued from the doctor's real daily capacity.</p>` : ""}</div>
      <button class="btn btn-primary btn-block" data-action="view-appointments">View my appointments</button>
    </div>`);
  state.bookingDraft = {};
}

function openLabBooking(id) {
  const lab = labById(id);
  if (!lab) return;
  const dates = bookingDateOptions();
  openModal(`
    <h2 class="modal-title" id="modalTitle">Book a lab test</h2>
    <p class="modal-subtitle">${escapeHtml(lab.name)} · ${escapeHtml(lab.test)}</p>
    <div class="booking-summary">
      <div class="row" style="justify-content:space-between"><div><strong>${escapeHtml(lab.test)}</strong><p class="fine">${escapeHtml(lab.reportTime)} report</p></div><strong>${formatPrice(lab.price)}</strong></div>
    </div>
    <div class="field"><label>COLLECTION METHOD</label><div class="choice-row">
      ${lab.homeCollection ? `<button class="type-chip active" data-lab-collection-choice="home_collection">${svg("home")} Home collection</button>` : ""}
      <button class="type-chip ${lab.homeCollection ? "" : "active"}" data-lab-collection-choice="lab_visit">${svg("flask")} Visit lab</button>
      <input type="hidden" id="labCollection" value="${lab.homeCollection ? "home_collection" : "lab_visit"}" />
    </div></div>
    <div class="field-grid">
      <div class="field"><label for="labBookingDate">DATE</label><select id="labBookingDate">${dates.map((date) => `<option value="${date.iso}">${escapeHtml(bookingDateLabel(date.iso))}</option>`).join("")}</select></div>
      <div class="field"><label for="labBookingTime">TIME</label><select id="labBookingTime"><option>7:00–8:00 AM</option><option>8:00–9:00 AM</option></select></div>
    </div>
    <div class="field"><label for="labBookingAddress">ADDRESS</label><input id="labBookingAddress" value="${escapeHtml(state.location)}" /></div>
    <button class="btn btn-primary btn-block" data-action="confirm-lab-booking" data-id="${lab.id}">Confirm test booking · ${formatPrice(lab.price)}</button>`);
}

function openCompare(type) {
  const items = type === "doctor"
    ? [...state.compareDoctors].map(doctorById).filter(Boolean)
    : [...state.compareLabs].map(labById).filter(Boolean);
  if (items.length < 2) {
    toast(`Select at least 2 ${type}s to compare`, "info");
    return;
  }
  const doctorRows = [
    ["Consultation", (item) => formatPrice(item.fee)],
    ["Experience", (item) => `${item.experience} years`],
    ["Rating", (item) => `★ ${item.rating} (${item.reviews})`],
    ["Distance", (item) => `${item.distance} km`],
    ["Next slot", (item) => item.nextSlot],
    ["Languages", (item) => item.languages.join(", ")],
    ["Avg. wait", (item) => item.avgWait],
    ["Verified", () => "✓ SehatLine"]
  ];
  const labRows = [
    ["Test price", (item) => formatPrice(item.price)],
    ["Home collection", (item) => item.homeCollection ? "✓ Available" : "Lab visit"],
    ["Report time", (item) => item.reportTime],
    ["Rating", (item) => `★ ${item.rating} (${item.reviews})`],
    ["Distance", (item) => `${item.distance} km`],
    ["Accreditation", (item) => item.certified],
    ["Discount", (item) => `${item.discount}% off`],
    ["Next slot", (item) => item.nextSlot]
  ];
  const rows = type === "doctor" ? doctorRows : labRows;
  openModal(`
    <h2 class="modal-title" id="modalTitle">Compare ${type === "doctor" ? "doctors" : "labs"}</h2>
    <p class="modal-subtitle">A clear side-by-side view to help you make an informed choice.</p>
    <div class="compare-table-wrap"><table class="compare-table">
      <thead><tr><th>Compare</th>${items.map((item) => `<th><div class="compare-doctor-head">${type === "doctor" ? doctorAvatar(item) : `<span class="lab-logo">${svg("flask")}</span>`}<strong>${escapeHtml(item.name)}</strong></div></th>`).join("")}</tr></thead>
      <tbody>${rows.map(([label, getter]) => `<tr><td>${label}</td>${items.map((item) => `<td>${escapeHtml(getter(item))}</td>`).join("")}</tr>`).join("")}
      <tr><td></td>${items.map((item) => `<td><button class="btn btn-primary" data-action="${type === "doctor" ? "book-doctor" : "book-lab"}" data-id="${item.id}">Book now</button></td>`).join("")}</tr>
      </tbody>
    </table></div>`, true);
}

function openQueue(id) {
  const appointment = state.appointments.find((item) => item.id === id) || state.appointments[0];
  const doctor = doctorById(appointment.doctorId) || state.doctors[0];
  const initialWait = Math.max(0, Number(appointment.wait) || 18);
  const initialAhead = Math.max(0, Number(appointment.ahead) || 0);
  openModal(`
    <div class="queue-live">
      <span class="status-pill">● LIVE · OPD running</span>
      <h2 class="modal-title" id="modalTitle" style="margin-top:12px">${escapeHtml(doctor.name)}</h2>
      <p class="modal-subtitle">${escapeHtml(doctor.clinic)}</p>
      <div class="queue-ring" style="--progress:72%">
        <div class="queue-number"><strong>${escapeHtml(appointment.token || "—")}</strong><small>Your token</small></div>
      </div>
      <div class="queue-meta">
        <div><strong id="patientsAhead">${initialAhead}</strong><small>Patients ahead</small></div>
        <div><strong id="queueWait">${initialWait} min</strong><small>Estimated wait</small></div>
        <div><strong id="queueCurrentToken">${escapeHtml(appointment.currentToken || "—")}</strong><small>Now serving</small></div>
      </div>
      <div class="timeline">
        <div class="timeline-row"><span class="timeline-dot"></span><div><strong>You checked in</strong><small>5:07 PM</small></div></div>
        <div class="timeline-row"><span class="timeline-dot"></span><div><strong id="queueAiMessage">Connecting to live AI estimate…</strong><small id="queueUpdatedAt">Updating now</small></div></div>
        <div class="timeline-row pending"><span class="timeline-dot"></span><div><strong>Get ready when 1 patient is ahead</strong><small>We’ll send a notification</small></div></div>
      </div>
      <button class="btn btn-secondary btn-block" data-action="directions">${svg("navigation")} Get clinic directions</button>
    </div>`);
  const updateQueueEstimate = async () => {
    try {
      const liveQueue = await apiRequest(`/api/queues/${encodeURIComponent(appointment.doctorId)}?date=${encodeURIComponent(appointment.date || "")}&token=${encodeURIComponent(appointment.token || "")}`, { timeoutMs: 6000 });
      const estimatedWait = liveQueue.live?.etaMinutes;
      const estimatedAhead = liveQueue.live?.ahead;
      appointment.wait = estimatedWait ?? appointment.wait;
      appointment.ahead = estimatedAhead ?? appointment.ahead;
      appointment.currentToken = liveQueue.current?.token || liveQueue.currentToken || appointment.currentToken;
      const currentNode = document.querySelector("#queueCurrentToken");
      const messageNode = document.querySelector("#queueAiMessage");
      const updatedNode = document.querySelector("#queueUpdatedAt");
      if (currentNode) currentNode.textContent = appointment.currentToken || "—";
      if (messageNode) messageNode.textContent = liveQueue.live?.message || "Live queue connected";
      if (updatedNode) updatedNode.textContent = `Live · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    const waitNode = document.querySelector("#queueWait");
    const aheadNode = document.querySelector("#patientsAhead");
      const nextWait = estimatedWait > 0 ? `${estimatedWait} min` : estimatedWait === 0 ? "Any moment" : "Checking";
      const nextAhead = estimatedAhead == null ? "—" : String(estimatedAhead);
    if (waitNode && waitNode.textContent !== nextWait) {
      waitNode.textContent = nextWait;
      window.SehatMotion?.highlight(waitNode);
    }
    if (aheadNode && aheadNode.textContent !== nextAhead) {
      aheadNode.textContent = nextAhead;
      window.SehatMotion?.highlight(aheadNode);
    }
    } catch {
      const messageNode = document.querySelector("#queueAiMessage");
      if (messageNode) messageNode.textContent = "Reconnecting to the clinic queue…";
    }
  };
  updateQueueEstimate();
  state.queueTimer = setInterval(updateQueueEstimate, 10000);
}

function openNotifications() {
  const unread = state.notifications.filter((notification) => notification.unread).length;
  openModal(`
    <h2 class="modal-title" id="modalTitle">Notifications</h2>
    <p class="modal-subtitle">${unread ? `${unread} new updates for you` : "You’re all caught up"}</p>
    <div class="notification-list">
      ${state.notifications.map((notification) => `
        <article class="notification-row ${notification.unread ? "unread" : ""}">
          <span class="notification-icon">${svg(notification.icon)}</span>
          <div class="notification-copy"><strong>${escapeHtml(notification.title)}</strong><p>${escapeHtml(notification.copy)}</p><span class="fine">${escapeHtml(notification.time)}</span></div>
        </article>`).join("")}
    </div>`);
  state.notifications.forEach((notification) => { notification.unread = false; });
  renderHeader();
}

function openLocation() {
  const places = ["Civil Lines, Prayagraj", "George Town, Prayagraj", "Katra, Prayagraj", "Naini, Prayagraj"];
  openModal(`
    <h2 class="modal-title" id="modalTitle">Choose your location</h2>
    <p class="modal-subtitle">We’ll show nearby doctors, clinics and diagnostic labs.</p>
    <label class="search-box" style="margin-bottom:13px">${svg("search")}<input placeholder="Search area or city" aria-label="Search location" /></label>
    <button class="location-option" data-location="Use current location">${svg("navigation")}<span><strong>Use current location</strong><span class="fine" style="display:block">Allow device location</span></span>${svg("chevron")}</button>
    <h3 class="settings-label" style="padding-left:0">POPULAR AREAS</h3>
    <div class="location-list">
      ${places.map((place) => `<button class="location-option ${state.location === place ? "active" : ""}" data-location="${place}">${svg("map-pin")}<span>${place}</span>${state.location === place ? svg("check") : svg("chevron")}</button>`).join("")}
    </div>`);
}

function openMobileDoctorFilters() {
  openModal(`
    <h2 class="modal-title" id="modalTitle">Filter doctors</h2>
    <p class="modal-subtitle">Personalise your results.</p>
    <div class="filter-group"><span class="filter-label">SPECIALIZATION</span><div class="filter-options">
      ${DOCTOR_CATEGORIES.map((category) => `<button class="filter-chip ${state.doctorSpecialty === category.value ? "active" : ""}" data-modal-filter="specialty" data-value="${escapeHtml(category.value)}">${escapeHtml(category.label)}</button>`).join("")}
    </div></div>
    <div class="filter-group"><div class="range-line"><span>Maximum fee</span><strong>${formatPrice(state.doctorMaxFee)}</strong></div><input type="range" min="300" max="1000" step="50" value="${state.doctorMaxFee}" data-modal-filter="fee" /></div>
    <div class="filter-group"><span class="filter-label">GENDER</span><div class="filter-options">${["All", "Female", "Male"].map((gender) => `<button class="filter-chip ${state.doctorGender === gender ? "active" : ""}" data-modal-filter="gender" data-value="${gender}">${gender}</button>`).join("")}</div></div>
    <button class="btn btn-primary btn-block" data-action="apply-mobile-filters">Show matching doctors</button>`);
}

function openReport(id) {
  const report = state.reports.find((item) => item.id === id);
  if (!report) return;
  openModal(`
    <h2 class="modal-title" id="modalTitle">${escapeHtml(report.name)}</h2>
    <p class="modal-subtitle">${escapeHtml(report.lab)} · ${escapeHtml(report.date)}</p>
    <div class="empty-state" style="background:var(--surface-soft)">
      <div class="empty-state-icon">${svg(report.type === "Prescription" ? "file" : "flask")}</div>
      <h3>Secure document preview</h3>
      <p>${escapeHtml(report.type)} · ${escapeHtml(report.size)}<br>Your full report opens securely after identity confirmation.</p>
      <button class="btn btn-primary" data-action="download-report" data-id="${report.id}">${svg("download")} Download report</button>
    </div>
    <div class="safety-note" style="color:var(--text-soft);background:var(--surface);border-color:var(--line)">${svg("lock")} Your health records are private. Share them only with people you trust.</div>`);
}

function openProfileEditor() {
  openModal(`
    <h2 class="modal-title" id="modalTitle">Edit personal details</h2>
    <p class="modal-subtitle">Keep this updated for smoother appointments.</p>
    <div class="row" style="margin-bottom:18px"><div class="profile-avatar">AM</div><button class="btn btn-secondary">${svg("camera")} Change photo</button></div>
    <div class="field-grid"><div class="field"><label>FULL NAME</label><input id="profileName" value="Abhigyan Maurya" /></div><div class="field"><label>PHONE</label><input value="+91 98765 43210" disabled /></div></div>
    <div class="field-grid"><div class="field"><label>DATE OF BIRTH</label><input type="date" value="2002-01-01" /></div><div class="field"><label>GENDER</label><select><option>Male</option><option>Female</option><option>Other</option></select></div></div>
    <div class="field"><label>EMAIL</label><input type="email" value="abhigyan@example.com" /></div>
    <button class="btn btn-primary btn-block" data-action="save-profile">Save changes</button>`);
}

function simpleInfoModal(title, copy, items = []) {
  openModal(`
    <h2 class="modal-title" id="modalTitle">${title}</h2><p class="modal-subtitle">${copy}</p>
    <div class="location-list">${items.map((item) => `<button class="location-option">${svg(item.icon || "check-circle")}<span><strong>${item.title}</strong><span class="fine" style="display:block">${item.copy || ""}</span></span>${svg("chevron")}</button>`).join("")}</div>`);
}

function lockAuthModal() {
  if (state.authToken) return;
  const root = document.querySelector("#modalRoot");
  root.dataset.authRequired = "true";
  root.dataset.authDismissible = "true";
  root.querySelector(".modal-panel")?.classList.add("auth-modal");
  const closeButton = root.querySelector(".modal-close");
  closeButton?.setAttribute("aria-label", "Close sign in and browse SehatLine");
  closeButton?.setAttribute("title", "Browse without signing in");
  root.querySelector(".modal-backdrop")?.removeAttribute("data-close-modal");
}

function authProgress(activeStep) {
  const labels = ["Mobile", "Identity", "Face check"];
  return `<div class="auth-progress" aria-label="Sign-up progress">
    ${labels.map((label, index) => `<span class="${index + 1 <= activeStep ? "active" : ""}"><i>${index + 1}</i>${label}</span>`).join("")}
  </div>`;
}

function openAuth(mode = state.authMode) {
  state.authMode = mode === "signup" ? "signup" : "login";
  const isSignup = state.authMode === "signup";
  openModal(`
    <div class="auth-onboarding">
      <section class="auth-brand-pane">
        <div class="auth-scene-particles" aria-hidden="true"><i></i><i></i><i></i></div>
        ${animatedBrandMark("auth-brand-mark")}
        <span class="auth-security-kicker">${svg("shield")} Protected patient access</span>
        <h2>One secure identity for your healthcare.</h2>
        <p>Appointments, reports and family health data stay protected behind verified access.</p>
        <div class="auth-trust-list">
          <span>${svg("phone")} Mobile OTP verification</span>
          <span>${svg("shield")} Consent-based Aadhaar check</span>
          <span>${svg("user")} Protected face verification</span>
        </div>
      </section>
      <section class="auth-form-pane">
        <div class="auth-tabs" role="tablist" aria-label="Choose login or sign up">
          <button class="${!isSignup ? "active" : ""}" data-action="auth-login-mode" role="tab" aria-selected="${!isSignup}">Log in</button>
          <button class="${isSignup ? "active" : ""}" data-action="auth-signup-mode" role="tab" aria-selected="${isSignup}">Sign up</button>
        </div>
        <span class="eyebrow">${isSignup ? "Create patient account" : "Welcome back"}</span>
        <h2 class="auth-heading" id="modalTitle">${isSignup ? "Join SehatLine securely" : "Log in to your health account"}</h2>
        <p class="modal-subtitle">${isSignup ? "First verify your mobile. Identity verification follows after OTP." : "Use the mobile number linked to your SehatLine account."}</p>
        <div class="field">
          <label for="authPhone">MOBILE NUMBER</label>
          <div class="auth-phone-field"><span>+91</span><input id="authPhone" inputmode="numeric" autocomplete="tel-national" maxlength="10" placeholder="98765 43210" value="${escapeHtml(phoneDigitsForInput(state.authPhone))}" /></div>
        </div>
        ${isSignup ? `<label class="auth-consent"><input id="signupConsent" type="checkbox"><span>I agree to the Terms and Privacy Notice and consent to mobile verification. Aadhaar consent will be requested separately.</span></label>` : ""}
        <button class="btn btn-primary btn-block auth-primary" data-action="send-otp">${svg("lock")} Continue securely</button>
        <div class="auth-privacy-note">${svg("shield")} We do not store raw Aadhaar numbers, face images or biometric templates.</div>
      </section>
    </div>`, true);
  lockAuthModal();
  document.querySelector("#authPhone")?.focus();
}

function phoneDigitsForInput(value) {
  return String(value || "").replace(/\D/g, "").slice(-10);
}

function startOtpResendCountdown() {
  closeOtpTimer();
  const update = () => {
    const button = document.querySelector('[data-action="resend-otp"]');
    if (!button) {
      closeOtpTimer();
      return;
    }
    const seconds = Math.max(0, Math.ceil((state.otpResendAvailableAt - Date.now()) / 1000));
    button.disabled = seconds > 0;
    button.textContent = seconds > 0 ? `Resend OTP in ${seconds}s` : "Resend OTP";
    if (seconds === 0) closeOtpTimer();
  };
  update();
  state.otpTimer = setInterval(update, 1000);
}

let otpWidgetReadyPromise = null;

function loadExternalScript(url) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-sehatline-otp-sdk="${url}"]`);
    if (existing?.dataset.loaded === "true") {
      resolve();
      return;
    }
    const script = existing || document.createElement("script");
    script.src = url;
    script.async = true;
    script.dataset.sehatlineOtpSdk = url;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error("MSG91 OTP service could not be loaded")), { once: true });
    if (!existing) document.head.append(script);
  });
}

async function ensureOtpWidget() {
  if (otpWidgetReadyPromise) return otpWidgetReadyPromise;
  otpWidgetReadyPromise = (async () => {
    const config = await apiRequest("/api/auth/otp/config", { timeoutMs: 5000 });
    state.otpProviderMode = config.mode;
    if (config.mode !== "msg91-widget") return config;
    if (!config.widgetId || !config.tokenAuth) throw new Error("MSG91 OTP Widget configuration is incomplete");
    if (typeof window.initSendOTP !== "function") {
      try {
        await loadExternalScript("https://verify.msg91.com/otp-provider.js");
      } catch {
        await loadExternalScript("https://verify.phone91.com/otp-provider.js");
      }
    }
    if (typeof window.initSendOTP !== "function") throw new Error("MSG91 OTP service is unavailable");
    window.initSendOTP({
      widgetId: config.widgetId,
      tokenAuth: config.tokenAuth,
      exposeMethods: true,
      success: () => {},
      failure: () => {}
    });
    const startedAt = Date.now();
    while (typeof window.sendOtp !== "function") {
      if (Date.now() - startedAt > 5000) throw new Error("MSG91 OTP service did not initialise");
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return config;
  })().catch(error => {
    otpWidgetReadyPromise = null;
    throw error;
  });
  return otpWidgetReadyPromise;
}

function callOtpWidget(method, args = [], requestId = "") {
  return new Promise((resolve, reject) => {
    const operation = window[method];
    if (typeof operation !== "function") {
      reject(new Error("MSG91 OTP service is unavailable"));
      return;
    }
    const timer = setTimeout(() => reject(new Error("MSG91 OTP request timed out")), 60_000);
    const succeed = result => {
      clearTimeout(timer);
      resolve(result);
    };
    const fail = error => {
      clearTimeout(timer);
      reject(new Error(
        error?.message
        || error?.error
        || (typeof error === "string" ? error : "")
        || "MSG91 could not complete the OTP request"
      ));
    };
    try {
      const callArguments = [...args, succeed, fail];
      if (requestId) callArguments.push(requestId);
      const returned = operation(...callArguments);
      if (returned?.then) returned.then(succeed, fail);
    } catch (error) {
      fail(error);
    }
  });
}

 function otpRequestId(result) {
  if (!result) return "";

  if (typeof result === "string") {
    return result.trim();
  }

  if (typeof result !== "object") return "";

  const candidate =
    result.reqId ||
    result.req_id ||
    result.requestId ||
    result.request_id ||
    result.data?.reqId ||
    result.data?.req_id ||
    result.data?.requestId ||
    result.data?.request_id ||
    result.message ||
    result.data?.message ||
    "";

  return String(candidate || "").trim();
}


function otpAccessToken(result) {
  if (typeof result === "string") return result;
  if (!result || typeof result !== "object") return "";
  return String(
    result.accessToken
    || result["access-token"]
    || result.access_token
    || result.token
    || result.jwt
    || result.data?.accessToken
    || result.data?.["access-token"]
    || result.data?.access_token
    || result.data?.token
    || ""
  );
}

async function requestOtpDelivery({ resend = false } = {}) {
  const inputPhone = resend ? state.authPhone : document.querySelector("#authPhone")?.value.trim() || "";
  const digits = phoneDigitsForInput(inputPhone);
  if (digits.length !== 10) {
    toast("Enter a valid phone number", "alert");
    return;
  }
  if (!resend && state.authMode === "signup" && !document.querySelector("#signupConsent")?.checked) {
    toast("Please accept the Terms and Privacy Notice", "alert");
    return;
  }
  const button = document.querySelector(`[data-action="${resend ? "resend-otp" : "send-otp"}"]`);
  const originalContent = button?.innerHTML || "";
  if (button) {
    button.disabled = true;
    button.classList.add("is-loading");
    button.innerHTML = `<span class="button-spinner" aria-hidden="true"></span>${resend ? "Sending again…" : "Sending secure OTP…"}`;
  }
  state.authPhone = digits;
  try {
    const config = await ensureOtpWidget();
    if (config.mode === "msg91-widget") {
      if (resend) {
  const result = await callOtpWidget(
    "retryOtp",
    [11],
    state.otpWidgetRequestId
  );

  state.otpWidgetRequestId =
    otpRequestId(result) || state.otpWidgetRequestId;
} else {
  state.otpWidgetRequestId = "";

  const result = await callOtpWidget(
    "sendOtp",
    [`91${digits}`]
  );

  state.otpWidgetRequestId = otpRequestId(result);
}
     
    } else {
      await apiRequest("/api/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone: `+91${digits}`, purpose: state.authMode }),
        timeoutMs: 10_000
      });
    }
    state.otpResendAvailableAt = Date.now() + 10_000;
    if (resend) {
      toast("A fresh OTP was sent by SMS", "phone");
      if (button) {
        button.classList.remove("is-loading");
        button.innerHTML = originalContent;
      }
      startOtpResendCountdown();
    } else {
      openOtpStep();
    }
  } catch (error) {
    if (button) {
      button.disabled = false;
      button.classList.remove("is-loading");
      button.innerHTML = originalContent;
    }
    toast(error.message || "OTP could not be sent. Please try again.", "alert");
  }
}

async function verifyOtpDelivery(otp) {
  const config = await ensureOtpWidget();
  if (config.mode !== "msg91-widget") {
    return apiRequest("/api/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phone: `+91${phoneDigitsForInput(state.authPhone)}`, otp, purpose: state.authMode }),
      timeoutMs: 10_000
    });
  }
  const widgetResult = await callOtpWidget("verifyOtp", [Number(otp)], state.otpWidgetRequestId);
  const accessToken = otpAccessToken(widgetResult);
  if (!accessToken) throw new Error("MSG91 did not return a verification token");
  return apiRequest("/api/auth/verify-widget-token", {
    method: "POST",
    body: JSON.stringify({
      accessToken,
      phone: `+91${phoneDigitsForInput(state.authPhone)}`,
      purpose: state.authMode
    }),
    timeoutMs: 15_000
  });
}

function openOtpStep() {
  openModal(`
    <div class="auth-step-shell">
      ${state.authMode === "signup" ? authProgress(1) : ""}
      <span class="auth-step-icon">${svg("phone")}</span>
      <span class="eyebrow">Mobile verification</span>
      <h2 class="auth-heading" id="modalTitle">Enter the 4-digit OTP</h2>
      <p class="modal-subtitle">We sent a one-time code to +91 ${escapeHtml(phoneDigitsForInput(state.authPhone).replace(/(\d{5})(\d{5})/, "$1 $2"))}.</p>
      <div class="field"><label for="authOtp">ONE-TIME PASSWORD</label><input class="auth-otp-input" id="authOtp" inputmode="numeric" autocomplete="one-time-code" maxlength="4" placeholder="••••" /></div>
      <button class="btn btn-primary btn-block auth-primary" data-action="verify-otp">Verify mobile</button>
      <button class="btn btn-ghost btn-block" data-action="auth-back">Change mobile number</button>
      <button class="btn btn-ghost btn-block auth-resend" data-action="resend-otp">Resend OTP</button>
      <div class="auth-privacy-note">${svg("lock")} OTP expires quickly and can be used only once.</div>
    </div>`);
  lockAuthModal();
  startOtpResendCountdown();
  document.querySelector("#authOtp")?.focus();
}

function openSignupProfileStep() {
  openModal(`
    <div class="auth-step-shell">
      ${authProgress(1)}
      <span class="auth-step-icon success">${svg("check")}</span>
      <span class="eyebrow">Mobile verified</span>
      <h2 class="auth-heading" id="modalTitle">Tell us who you are</h2>
      <p class="modal-subtitle">Use the same name and date of birth that appear in your identity document.</p>
      <div class="field"><label for="authName">FULL NAME</label><input id="authName" autocomplete="name" placeholder="Your full name" value="${escapeHtml(state.authName)}"></div>
      <div class="field"><label for="authDob">DATE OF BIRTH</label><input id="authDob" type="date" autocomplete="bday" value="${escapeHtml(state.authDateOfBirth)}"></div>
      <label class="profile-photo-field" for="authPhoto">
        <span class="profile-photo-preview" id="authPhotoPreview" style="${state.authPhotoData ? `background-image:url('${state.authPhotoData}')` : ""}">${state.authPhotoData ? "" : svg("camera")}</span>
        <span><strong>Profile photo</strong><small>Required for a trusted patient account · JPG, PNG or WebP</small></span>
        <input id="authPhoto" type="file" accept="image/jpeg,image/png,image/webp" capture="user">
      </label>
      <button class="btn btn-primary btn-block auth-primary" data-action="continue-identity">Continue to identity check</button>
    </div>`);
  lockAuthModal();
  document.querySelector("#authName")?.focus();
}

function openIdentityStep() {
  openModal(`
    <div class="auth-step-shell identity-step">
      ${authProgress(2)}
      <span class="auth-step-icon">${svg("shield")}</span>
      <span class="eyebrow">Voluntary identity verification</span>
      <h2 class="auth-heading" id="modalTitle">Verify with Aadhaar securely</h2>
      <p class="modal-subtitle">Verification opens through a UIDAI-authorised provider. Do not type or upload your Aadhaar number inside SehatLine.</p>
      <div class="identity-method-card selected">
        <span>${svg("shield")}</span>
        <div><strong>Aadhaar + protected face check</strong><small>Uses provider reference only · No raw biometric storage</small></div>
        <i>${svg("check")}</i>
      </div>
      <label class="auth-consent"><input id="identityConsent" type="checkbox"><span>I voluntarily consent to identity verification for account safety. I understand this is separate from medical treatment and can review the Privacy Notice.</span></label>
      <button class="btn btn-primary btn-block auth-primary" data-action="start-identity">${svg("shield")} Start protected verification</button>
      <div class="identity-data-note"><strong>SehatLine keeps:</strong> verification status, provider reference and timestamp.<br><strong>SehatLine never keeps:</strong> Aadhaar number, VID, selfie or biometric template.</div>
    </div>`);
  lockAuthModal();
}

function openFaceCheckStep(session) {
  const sandboxLabel = session?.sandbox ? `<span class="sandbox-chip">Sandbox preview</span>` : "";
  openModal(`
    <div class="auth-step-shell face-step">
      ${authProgress(3)}
      <div class="face-scan-visual" aria-hidden="true"><span>${svg("user")}</span><i></i><b></b></div>
      ${sandboxLabel}
      <span class="eyebrow">Protected face check</span>
      <h2 class="auth-heading" id="modalTitle">${session?.sandbox ? "Preview FaceRD verification" : "Continue in UIDAI FaceRD"}</h2>
      <p class="modal-subtitle">${session?.sandbox ? "This local build simulates the provider callback without capturing a face." : "The approved FaceRD app performs matching. SehatLine receives only the result."}</p>
      <button class="btn btn-primary btn-block auth-primary" data-action="complete-identity">${svg("camera")} ${session?.sandbox ? "Run safe sandbox check" : "Open FaceRD"}</button>
      <button class="btn btn-ghost btn-block" data-action="identity-back">Review consent</button>
      <div class="auth-privacy-note">${svg("lock")} Camera frames and biometric data never enter the SehatLine API.</div>
    </div>`);
  lockAuthModal();
}

function openIdentitySuccess(payload) {
  openModal(`
    <div class="auth-step-shell auth-complete">
      <span class="success-check">${svg("check")}</span>
      <span class="verified">${svg("shield")} ${payload?.sandbox ? "Sandbox verification completed" : "Identity verified"}</span>
      <h2 class="auth-heading" id="modalTitle">Your account is protected</h2>
      <p class="modal-subtitle">Mobile and identity checks are complete. You can now access appointments and health records.</p>
      <div class="auth-result-grid"><span><b>Mobile</b><small>Verified</small></span><span><b>Aadhaar flow</b><small>${payload?.sandbox ? "Sandbox passed" : "Verified"}</small></span><span><b>Face check</b><small>${payload?.sandbox ? "Simulated safely" : "Passed"}</small></span></div>
      <button class="btn btn-primary btn-block auth-primary" data-action="finish-auth">Open SehatLine</button>
    </div>`);
}

function downloadReport(id) {
  const report = state.reports.find((item) => item.id === id);
  if (!report) return;
  const content = `SEHATLINE HEALTH RECORD\n\n${report.name}\nProvider: ${report.lab}\nDate: ${report.date}\n\nDemo prototype document.`;
  const blob = new Blob([content], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${report.name.replace(/\s+/g, "-").toLowerCase()}.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast("Report download started", "download");
}

function updateVisibleDoctorResults() {
  const container = document.querySelector("#doctorResults");
  if (!container) return;
  const results = filteredDoctors();
  container.innerHTML = results.length
    ? results.map((doctor) => doctorCard(doctor)).join("")
    : state.doctors.length === 0
      ? emptyState("stethoscope", "No doctors available yet", "Doctors approved by SehatLine Admin will appear here.", "", "")
      : emptyState("search", "No matching doctors", "Try widening your filters.", "Reset filters", "reset-doctor-filters");
  const count = document.querySelector("#doctorResultCount");
  if (count) count.textContent = `${results.length} verified doctors`;
  hydrateIcons(container);
}

function scrollChat() {
  requestAnimationFrame(() => {
    const messages = document.querySelector("#chatMessages");
    if (messages) messages.scrollTop = messages.scrollHeight;
  });
}

document.addEventListener("click", (event) => {
  const routeTarget = event.target.closest("[data-route]");
  if (routeTarget) {
    event.preventDefault();
    navigate(routeTarget.dataset.route);
    return;
  }

  if (event.target.hasAttribute("data-close-modal") || event.target.closest(".modal-close")) {
    closeModal();
    return;
  }

  const prompt = event.target.closest("[data-ai-prompt]");
  if (prompt) {
    handleAiQuery(prompt.dataset.aiPrompt);
    return;
  }

  const labCollectionChoice = event.target.closest("[data-lab-collection-choice]");
  if (labCollectionChoice) {
    const valueInput = document.querySelector("#labCollection");
    if (valueInput) valueInput.value = labCollectionChoice.dataset.labCollectionChoice;
    document.querySelectorAll("[data-lab-collection-choice]").forEach((choice) => {
      choice.classList.toggle("active", choice === labCollectionChoice);
    });
    return;
  }

  const tab = event.target.closest("[data-appointment-tab]");
  if (tab) {
    state.appointmentTab = tab.dataset.appointmentTab;
    render();
    return;
  }

  const bookingChoice = event.target.closest("[data-booking-choice]");
  if (bookingChoice) {
    state.bookingDraft[bookingChoice.dataset.bookingChoice] = bookingChoice.dataset.value;
    openBooking(state.bookingDraft.doctorId, 1);
    return;
  }

  const bookingNext = event.target.closest("[data-booking-next]");
  if (bookingNext) {
    const step = Number(bookingNext.dataset.bookingNext);
    if (step === 3) {
      state.bookingDraft.patient = document.querySelector("#bookingPatient")?.value || "Abhigyan Maurya";
      state.bookingDraft.reason = document.querySelector("#bookingReason")?.value || "";
    }
    openBooking(state.bookingDraft.doctorId, step);
    return;
  }

  const filter = event.target.closest("[data-filter]");
  if (filter && filter.dataset.filter !== "fee") {
    if (filter.dataset.filter === "specialty") state.doctorSpecialty = filter.dataset.value;
    if (filter.dataset.filter === "gender") state.doctorGender = filter.dataset.value;
    render();
    return;
  }

  const modalFilter = event.target.closest("[data-modal-filter]");
  if (modalFilter && modalFilter.dataset.modalFilter !== "fee") {
    if (modalFilter.dataset.modalFilter === "specialty") state.doctorSpecialty = modalFilter.dataset.value;
    if (modalFilter.dataset.modalFilter === "gender") state.doctorGender = modalFilter.dataset.value;
    openMobileDoctorFilters();
    return;
  }

  const locationTarget = event.target.closest("[data-location]");
  if (locationTarget) {
    if (locationTarget.dataset.location === "Use current location") {
      locationTarget.disabled = true;
      locationTarget.querySelector("strong").textContent = "Detecting your location…";
      window.SehatCare.requestLocation().then(result => {
        state.location = result.locality && result.city ? `${result.locality}, ${result.city}` : result.displayName;
        localStorage.setItem("sehatline-location", state.location);
        closeModal();
        renderHeader();
        toast(`Live location set to ${state.location}`, "map-pin");
      }).catch(error => {
        locationTarget.disabled = false;
        locationTarget.querySelector("strong").textContent = "Use current location";
        toast(error.message || "Location could not be detected", "alert");
      });
    } else {
      state.location = locationTarget.dataset.location;
      localStorage.setItem("sehatline-location", state.location);
      closeModal();
      renderHeader();
      toast(`Location changed to ${state.location}`, "map-pin");
    }
    return;
  }

  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) return;
  const { action, id, type, value } = actionTarget.dataset;

  const actions = {
    theme() {
      state.theme = state.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = state.theme;
      localStorage.setItem("sehatline-theme", state.theme);
      render();
    },
    notifications: openNotifications,
    location: openLocation,
    "doctor-profile": () => openDoctorProfile(id),
    "lab-details": () => openLabDetails(id),
    "book-doctor": () => {
      state.bookingDraft = {};
      openBooking(id, 1);
    },
    "book-lab": () => openLabBooking(id),
    queue: () => openQueue(id),
    "show-compare": () => openCompare(type),
    "compare-doctor": () => {
      if (state.compareDoctors.has(id)) state.compareDoctors.delete(id);
      else if (state.compareDoctors.size < 4) state.compareDoctors.add(id);
      else return toast("You can compare up to 4 doctors", "info");
      render();
    },
    "compare-lab": () => {
      if (state.compareLabs.has(id)) state.compareLabs.delete(id);
      else if (state.compareLabs.size < 4) state.compareLabs.add(id);
      else return toast("You can compare up to 4 labs", "info");
      render();
    },
    "save-doctor": () => {
      if (state.favorites.has(id)) state.favorites.delete(id); else state.favorites.add(id);
      localStorage.setItem("sehatline-favorites", JSON.stringify([...state.favorites]));
      toast(state.favorites.has(id) ? "Doctor saved" : "Doctor removed from saved");
      if (document.querySelector("#modalRoot").children.length) openDoctorProfile(id); else render();
    },
    "save-lab": () => {
      if (state.savedLabs.has(id)) state.savedLabs.delete(id); else state.savedLabs.add(id);
      localStorage.setItem("sehatline-saved-labs", JSON.stringify([...state.savedLabs]));
      toast(state.savedLabs.has(id) ? "Lab saved" : "Lab removed from saved");
      if (document.querySelector("#modalRoot").children.length) openLabDetails(id); else render();
    },
    "reset-doctor-filters": () => {
      state.doctorQuery = "";
      state.doctorSpecialty = "All";
      state.doctorMaxFee = 1000;
      state.doctorGender = "All";
      render();
    },
    "reset-lab-filters": () => {
      state.labQuery = "";
      state.labHomeOnly = false;
      state.labSort = "recommended";
      render();
    },
    "mobile-doctor-filters": openMobileDoctorFilters,
    "mobile-lab-filters": () => simpleInfoModal("Filter labs", "Choose your preferred collection method.", [
      { icon: "home", title: "Home collection", copy: "Sample collected at your address" },
      { icon: "flask", title: "Visit a lab", copy: "See all nearby centres" },
      { icon: "shield", title: "NABL accredited", copy: "Prioritise accredited labs" }
    ]),
    "apply-mobile-filters": () => {
      closeModal();
      render();
    },
    "home-collection": () => {
      state.labHomeOnly = !state.labHomeOnly;
      render();
    },
    "lab-query": () => {
      state.labQuery = value;
      render();
    },
    "ask-lab-ai": () => {
      state.pendingAi = "Cheapest and fastest thyroid test near me with home collection";
      closeModal();
      navigate("ai");
    },
    "confirm-booking": confirmBooking,
    "confirm-lab-booking": async () => {
      const lab = labById(id);
      if (!lab) {
        toast("Lab could not be found", "alert");
        return;
      }
      const booking = {
        providerType: "lab",
        providerId: lab.id,
        providerName: lab.name,
        labId: lab.id,
        labName: lab.name,
        testName: lab.test,
        amount: lab.price,
        patientName: "Abhigyan Maurya",
        collectionType: document.querySelector("#labCollection")?.value || "lab_visit",
        date: document.querySelector("#labBookingDate")?.value || bookingDateOptions()[0].iso,
        time: document.querySelector("#labBookingTime")?.value || "7:00–8:00 AM",
        address: document.querySelector("#labBookingAddress")?.value.trim() || state.location,
        status: "pending"
      };
      let savedBooking;
      try {
        savedBooking = await apiRequest("/api/bookings", {
          method: "POST",
          body: JSON.stringify(booking)
        });
      } catch {
        savedBooking = { id: `lb${Date.now()}`, ...booking };
      }
      openModal(`<div class="success-state"><div class="success-check">${svg("check")}</div><h2 id="modalTitle">Test booked!</h2><p>${escapeHtml(lab.name)} will confirm your collection slot shortly. You’ll receive updates here.</p><div class="booking-summary"><span class="fine">BOOKING ID</span><h3>${escapeHtml(savedBooking.id || savedBooking._id || `LB-${String(Date.now()).slice(-6)}`)}</h3></div><button class="btn btn-primary btn-block" data-close-modal>Done</button></div>`);
    },
    "view-appointments": () => {
      closeModal();
      navigate("appointments");
    },
    "go-doctors": () => navigate("doctors"),
    "go-appointments": () => navigate("appointments"),
    "go-reports": () => navigate("reports"),
    "reschedule": () => {
      const appointment = state.appointments.find((item) => item.id === id);
      if (!appointment) {
        toast("Appointment could not be found", "alert");
        return;
      }
      state.bookingDraft = {
        rescheduleId: appointment.id,
        dateISO: appointment.date,
        time: appointment.time,
        type: appointment.type,
        patient: appointment.patientName || appointment.patient || "Abhigyan Maurya",
        reason: appointment.reason || ""
      };
      openBooking(appointment.doctorId, 1);
    },
    directions: () => toast("Opening clinic directions…", "navigation"),
    "view-report": () => openReport(id),
    "download-report": () => downloadReport(id),
    "share-report": async () => {
      const report = state.reports.find((item) => item.id === id);
      const shareData = { title: report.name, text: `${report.name} — ${report.lab}, ${report.date}` };
      try {
        if (navigator.share) await navigator.share(shareData);
        else {
          await navigator.clipboard.writeText(shareData.text);
          toast("Report details copied to clipboard", "share");
        }
      } catch {
        // User cancellation requires no error.
      }
    },
    "upload-report": () => simpleInfoModal("Upload a health record", "Choose the kind of document you want to add.", [
      { icon: "flask", title: "Lab report", copy: "PDF, JPG or PNG up to 10 MB" },
      { icon: "file", title: "Prescription", copy: "Add a doctor’s prescription" },
      { icon: "camera", title: "Scan with camera", copy: "Capture a clear document image" }
    ]),
    "edit-profile": openProfileEditor,
    "save-profile": () => {
      closeModal();
      toast("Profile updated successfully");
    },
    family: () => simpleInfoModal("Family members", "Book and store records for the people you care about.", [
      { icon: "user", title: "Abhigyan Maurya", copy: "Self · Primary profile" },
      { icon: "user", title: "Sunita Maurya", copy: "Mother · Adult" },
      { icon: "users", title: "Add a family member", copy: "Create a new health profile" }
    ]),
    saved: () => simpleInfoModal("Saved care", "Your shortlisted doctors and diagnostic labs.", [
      ...[...state.favorites].map((doctorId) => ({ icon: "stethoscope", title: doctorById(doctorId)?.name || "Doctor", copy: doctorById(doctorId)?.specialty || "" })),
      ...[...state.savedLabs].map((labId) => ({ icon: "flask", title: labById(labId)?.name || "Lab", copy: "Verified diagnostic lab" }))
    ]),
    language: () => simpleInfoModal("Choose language", "SehatLine can be used in your preferred language.", [
      { icon: "check-circle", title: "English", copy: "Currently selected" },
      { icon: "globe", title: "हिंदी", copy: "Hindi" },
      { icon: "globe", title: "Hinglish", copy: "Best for Sehat AI chat" }
    ]),
    "notifications-settings": () => simpleInfoModal("Notification preferences", "Control the updates you receive.", [
      { icon: "activity", title: "Queue alerts", copy: "On · Recommended" },
      { icon: "calendar", title: "Appointment updates", copy: "On" },
      { icon: "file", title: "Report updates", copy: "On" },
      { icon: "heart", title: "Health tips & offers", copy: "Off" }
    ]),
    account: openAuth,
    support: () => simpleInfoModal("Help & support", "We’re here to help with bookings and your SehatLine experience.", [
      { icon: "help", title: "Frequently asked questions", copy: "Quick answers to common questions" },
      { icon: "phone", title: "Chat with support", copy: "Typical reply in under 10 minutes" },
      { icon: "alert", title: "Report a problem", copy: "Tell us what went wrong" }
    ]),
    logout: () => {
      state.authToken = "";
      localStorage.removeItem("sehatline-auth-token");
      openAuth();
    },
    "auth-login-mode": () => {
      state.authPhone = document.querySelector("#authPhone")?.value || state.authPhone;
      openAuth("login");
    },
    "auth-signup-mode": () => {
      state.authPhone = document.querySelector("#authPhone")?.value || state.authPhone;
      openAuth("signup");
    },
    "auth-back": () => openAuth(state.authMode),
    "identity-back": openIdentityStep,
    "send-otp": () => requestOtpDelivery(),
    "resend-otp": () => requestOtpDelivery({ resend: true }),
    "verify-otp": async () => {
      const otp = document.querySelector("#authOtp")?.value.trim() || "";
      if (!/^\d{4}$/.test(otp)) {
        window.SehatMotion?.shake(document.querySelector("#authOtp"));
        toast("Enter the complete 4-digit OTP", "alert");
        return;
      }
      const verifyButton = document.querySelector('[data-action="verify-otp"]');
      const verifyButtonContent = verifyButton?.innerHTML || "";
      if (verifyButton) {
        verifyButton.disabled = true;
        verifyButton.classList.add("is-loading");
        verifyButton.innerHTML = `<span class="button-spinner" aria-hidden="true"></span>Checking OTP…`;
      }
      let payload;
      try {
        payload = await verifyOtpDelivery(otp);
      } catch (error) {
        if (verifyButton) {
          verifyButton.disabled = false;
          verifyButton.classList.remove("is-loading");
          verifyButton.innerHTML = verifyButtonContent;
        }
        window.SehatMotion?.shake(document.querySelector("#authOtp"));
        toast(error.message || "That OTP is invalid or expired", "alert");
        return;
      }
      if (!payload?.verified && !payload?.token) {
        window.SehatMotion?.shake(document.querySelector("#authOtp"));
        toast("That OTP is invalid or expired", "alert");
        return;
      }
      if (state.authMode === "signup") {
        state.pendingAuthToken = payload.token || "";
        openSignupProfileStep();
        return;
      }
      state.authToken = payload.token || "";
      if (state.authToken) localStorage.setItem("sehatline-auth-token", state.authToken);
      await hydrateRemoteData();
      const root = document.querySelector("#modalRoot");
      delete root.dataset.authRequired;
      closeModal();
      toast("Signed in securely");
    },
    "continue-identity": async () => {
      const name = document.querySelector("#authName")?.value.trim() || "";
      const dateOfBirth = document.querySelector("#authDob")?.value || "";
      if (name.length < 3) {
        toast("Enter your full name", "alert");
        return;
      }
      if (!dateOfBirth) {
        toast("Select your date of birth", "alert");
        return;
      }
      const photoFile = document.querySelector("#authPhoto")?.files?.[0];
      if (!state.authPhotoData && !photoFile) {
        toast("Add your profile photo", "alert");
        return;
      }
      state.authName = name;
      state.authDateOfBirth = dateOfBirth;
      const button = document.querySelector('[data-action="continue-identity"]');
      if (button) button.disabled = true;
      try {
        if (photoFile) state.authPhotoData = await window.SehatCare.preparePhoto(photoFile);
        const uploaded = await window.SehatCare.uploadPhoto(state.authPhotoData, "patient");
        state.authPhotoUrl = uploaded.url;
        openIdentityStep();
      } catch (error) {
        if (button) button.disabled = false;
        toast(error.message || "Photo could not be uploaded", "alert");
      }
    },
    "start-identity": async () => {
      if (!document.querySelector("#identityConsent")?.checked) {
        toast("Identity verification needs your explicit consent", "alert");
        return;
      }
      try {
        const payload = await apiRequest("/api/auth/patient/identity/start", {
          method: "POST",
          body: JSON.stringify({
            phone: `+91${phoneDigitsForInput(state.authPhone)}`,
            consent: true,
            method: "aadhaar-face",
            profile: { name: state.authName, dateOfBirth: state.authDateOfBirth, photoUrl: state.authPhotoUrl }
          })
        });
        state.identityVerificationId = payload.verificationId;
        openFaceCheckStep(payload);
      } catch (error) {
        toast(error.message || "Approved Aadhaar provider is not configured yet", "alert");
      }
    },
    "complete-identity": async () => {
      if (!state.identityVerificationId) {
        toast("Start identity verification first", "alert");
        openIdentityStep();
        return;
      }
      try {
        const payload = await apiRequest("/api/auth/patient/identity/complete", {
          method: "POST",
          body: JSON.stringify({ verificationId: state.identityVerificationId })
        });
        state.authToken = payload.token || state.pendingAuthToken;
        if (state.authToken) localStorage.setItem("sehatline-auth-token", state.authToken);
        await hydrateRemoteData();
        state.identityVerificationId = "";
        openIdentitySuccess(payload);
      } catch (error) {
        toast(error.message || "Face verification could not be completed", "alert");
      }
    },
    "finish-auth": () => {
      const root = document.querySelector("#modalRoot");
      delete root.dataset.authRequired;
      closeModal();
      toast("Account created securely", "shield");
    },
    voice: startVoiceAssistant
  };
  actions[action]?.();
});

document.addEventListener("input", (event) => {
  if (event.target.matches("[data-doctor-search]")) {
    state.doctorQuery = event.target.value;
    updateVisibleDoctorResults();
  }
  if (event.target.matches("[data-filter='fee']")) {
    state.doctorMaxFee = Number(event.target.value);
    render();
  }
  if (event.target.matches("[data-modal-filter='fee']")) {
    state.doctorMaxFee = Number(event.target.value);
    openMobileDoctorFilters();
  }
  if (event.target.matches("[data-lab-search]")) {
    state.labQuery = event.target.value;
    const position = event.target.selectionStart;
    render();
    const next = document.querySelector("[data-lab-search]");
    next?.focus();
    next?.setSelectionRange(position, position);
  }
});

document.addEventListener("change", (event) => {
  if (event.target.matches("#authPhoto")) {
    const file = event.target.files?.[0];
    if (!file) return;
    window.SehatCare.preparePhoto(file).then(dataUrl => {
      state.authPhotoData = dataUrl;
      const preview = document.querySelector("#authPhotoPreview");
      if (preview) {
        preview.innerHTML = "";
        preview.style.backgroundImage = `url('${dataUrl}')`;
      }
    }).catch(error => toast(error.message, "alert"));
  }
  if (event.target.matches("[data-doctor-sort]")) {
    state.doctorSort = event.target.value;
    render();
  }
  if (event.target.matches("[data-lab-sort]")) {
    state.labSort = event.target.value;
    render();
  }
});

document.addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.target.id === "aiForm") {
    const query = new FormData(event.target).get("query")?.trim();
    if (query) handleAiQuery(query);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.querySelector("#modalRoot").children.length) closeModal();
});

window.addEventListener("hashchange", () => {
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

window.addEventListener("online", () => {
  document.querySelector("#offlineBanner").hidden = true;
  toast("You’re back online");
  hydrateRemoteData();
});

window.addEventListener("offline", () => {
  document.querySelector("#offlineBanner").hidden = false;
});

document.documentElement.dataset.theme = state.theme;
document.querySelector("#offlineBanner").hidden = navigator.onLine;
if (!location.hash) history.replaceState(null, "", "#/home");
state.route = routeFromHash();
hydrateIcons();
render();
setTimeout(() => {
  document.querySelector("#splash")?.classList.add("hidden");
  if (!state.authToken) openAuth();
}, 1900);
hydrateRemoteData();

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
