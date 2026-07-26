(() => {
  "use strict";

  const appConfig = window.SEHATLINE_CONFIG || { mode: "demo", apiBaseUrl: "", allowGuestAccess: true };
  const isProduction = appConfig.mode === "production";
  const apiUrl = path => `${String(appConfig.apiBaseUrl || "").replace(/\/+$/, "")}${path}`;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clone = value => JSON.parse(JSON.stringify(value));
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  const escapeHTML = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const initials = name => String(name || "Patient")
    .replace(/^Dr\.\s*/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase();
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const storedAuthToken = () => {
    try {
      return JSON.parse(localStorage.getItem("sl_doctor_session") || "{}").token || "";
    } catch {
      return "";
    }
  };

  /* DEMO_DATA_START */
  const demoData = {
    dashboard: {
      metrics: [
        { label: "Today’s appointments", value: "21", trend: "+3 vs avg.", icon: "calendar", tone: "mint" },
        { label: "Total patients", value: "1,284", trend: "+8.6%", icon: "users", tone: "blue" },
        { label: "Pending requests", value: "3", trend: "Needs review", icon: "clock", tone: "amber" },
        { label: "Today’s earnings", value: "₹12.4k", trend: "+11.2%", icon: "rupee", tone: "violet" }
      ]
    },
    appointments: [
      { id: "apt-1001", time: "09:00", period: "AM", name: "Meera Sethi", age: 34, gender: "Female", phone: "98110 23418", token: "A08", reason: "Acne follow-up", type: "Follow-up", status: "completed", note: "Continue current routine for four weeks." },
      { id: "apt-1002", time: "10:30", period: "AM", name: "Arjun Verma", age: 27, gender: "Male", phone: "98990 31267", token: "A09", reason: "Hair fall consultation", type: "New patient", status: "completed", note: "" },
      { id: "apt-1003", time: "01:00", period: "PM", name: "Riya Sharma", age: 31, gender: "Female", phone: "99580 65012", token: "A12", reason: "Skin allergy review", type: "Follow-up", status: "in-progress", note: "" },
      { id: "apt-1004", time: "01:30", period: "PM", name: "Nisha Gupta", age: 42, gender: "Female", phone: "99102 78431", token: "A13", reason: "Pigmentation", type: "New patient", status: "confirmed", note: "" },
      { id: "apt-1005", time: "02:00", period: "PM", name: "Vikram Rao", age: 38, gender: "Male", phone: "98721 14496", token: "A14", reason: "Eczema follow-up", type: "Follow-up", status: "confirmed", note: "" },
      { id: "apt-1006", time: "04:30", period: "PM", name: "Kabir Malhotra", age: 24, gender: "Male", phone: "98188 63108", token: "A17", reason: "Rash and itching", type: "New patient", status: "pending", note: "" },
      { id: "apt-1007", time: "05:15", period: "PM", name: "Ananya Bose", age: 29, gender: "Female", phone: "98919 45723", token: "A18", reason: "Hair care consultation", type: "New patient", status: "pending", note: "" },
      { id: "apt-1008", time: "06:15", period: "PM", name: "Dev Khanna", age: 45, gender: "Male", phone: "98208 12764", token: "A19", reason: "Psoriasis review", type: "Follow-up", status: "pending", note: "" }
    ],
    queue: {
      status: "live",
      current: { token: "A12", name: "Riya Sharma", age: 31, reason: "Skin allergy review", appointmentId: "apt-1003" },
      waiting: [
        { token: "A13", name: "Nisha Gupta", wait: 6, reason: "Pigmentation", appointmentId: "apt-1004" },
        { token: "A14", name: "Vikram Rao", wait: 19, reason: "Eczema follow-up", appointmentId: "apt-1005" },
        { token: "A15", name: "Aarav Mehta", wait: 32, reason: "Acne consultation", appointmentId: null },
        { token: "A16", name: "Simran Kaur", wait: 45, reason: "Hair fall", appointmentId: null },
        { token: "A17", name: "Kabir Malhotra", wait: 58, reason: "Rash and itching", appointmentId: "apt-1006" },
        { token: "A18", name: "Ananya Bose", wait: 71, reason: "Hair care", appointmentId: "apt-1007" }
      ],
      seen: 11,
      averageMinutes: 14,
      expectedMinutes: 15,
      elapsedSeconds: 504,
      delayMinutes: 0
    },
    patients: [
      { id: "p-01", name: "Riya Sharma", phone: "99580 65012", age: 31, gender: "Female", lastVisit: "Today", visits: 6, concern: "Skin allergy", status: "Regular", tone: "mint", history: [{ date: "25 Jul 2026", concern: "Skin allergy review" }, { date: "08 May 2026", concern: "Contact dermatitis" }] },
      { id: "p-02", name: "Meera Sethi", phone: "98110 23418", age: 34, gender: "Female", lastVisit: "Today", visits: 4, concern: "Acne", status: "Follow-up due", tone: "violet", history: [{ date: "25 Jul 2026", concern: "Acne follow-up" }, { date: "12 Jun 2026", concern: "Acne consultation" }] },
      { id: "p-03", name: "Arjun Verma", phone: "98990 31267", age: 27, gender: "Male", lastVisit: "Today", visits: 2, concern: "Hair fall", status: "Regular", tone: "blue", history: [{ date: "25 Jul 2026", concern: "Hair fall consultation" }] },
      { id: "p-04", name: "Nisha Gupta", phone: "99102 78431", age: 42, gender: "Female", lastVisit: "18 Jul 2026", visits: 5, concern: "Pigmentation", status: "Follow-up due", tone: "amber", history: [{ date: "18 Jul 2026", concern: "Pigmentation review" }, { date: "03 Apr 2026", concern: "Melasma" }] },
      { id: "p-05", name: "Vikram Rao", phone: "98721 14496", age: 38, gender: "Male", lastVisit: "07 Jul 2026", visits: 8, concern: "Eczema", status: "Regular", tone: "blue", history: [{ date: "07 Jul 2026", concern: "Eczema follow-up" }, { date: "23 May 2026", concern: "Eczema flare-up" }] },
      { id: "p-06", name: "Ananya Bose", phone: "98919 45723", age: 29, gender: "Female", lastVisit: "22 Jun 2026", visits: 3, concern: "Hair care", status: "Regular", tone: "violet", history: [{ date: "22 Jun 2026", concern: "Scalp dryness" }] },
      { id: "p-07", name: "Dev Khanna", phone: "98208 12764", age: 45, gender: "Male", lastVisit: "09 Jun 2026", visits: 7, concern: "Psoriasis", status: "Follow-up due", tone: "mint", history: [{ date: "09 Jun 2026", concern: "Psoriasis review" }] }
    ],
    profile: {
      name: "Dr. Aditi Kapoor",
      specialisation: "Dermatologist",
      availability: [
        { day: "Monday", enabled: true, from: "09:00", to: "18:30" },
        { day: "Tuesday", enabled: true, from: "09:00", to: "18:30" },
        { day: "Wednesday", enabled: true, from: "10:00", to: "19:00" },
        { day: "Thursday", enabled: true, from: "09:00", to: "18:30" },
        { day: "Friday", enabled: true, from: "09:00", to: "18:30" },
        { day: "Saturday", enabled: true, from: "09:00", to: "14:00" },
        { day: "Sunday", enabled: false, from: "09:00", to: "13:00" }
      ],
      holidays: [
        { id: "h-1", date: "15 Aug 2026", label: "Independence Day" },
        { id: "h-2", date: "27 Aug 2026", label: "Personal leave" }
      ],
      services: [
        { id: "s-1", name: "Clinic consultation", fee: 700, duration: "15 min" },
        { id: "s-2", name: "Follow-up consultation", fee: 500, duration: "10 min" },
        { id: "s-3", name: "Skin procedure consultation", fee: 900, duration: "20 min" },
        { id: "s-4", name: "Hair & scalp assessment", fee: 800, duration: "20 min" }
      ]
    },
    analytics: {
      totalBookings: 426,
      repeatPatients: "64%",
      revenue: "₹2.84L",
      rating: "4.9",
      cancellationRate: "4.2%"
    }
  };
  /* DEMO_DATA_END */

  const state = {
    view: "dashboard",
    theme: localStorage.getItem("sl_doctor_theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
    authenticated: false,
    demoMode: false,
    loaded: false,
    appointmentFilter: "all",
    appointmentSearch: "",
    appointmentDateOffset: 0,
    patientSearch: "",
    patientSort: "recent",
    queueTimer: null,
    lastFocused: null,
    dashboard: clone(demoData.dashboard),
    appointments: clone(demoData.appointments),
    queue: clone(demoData.queue),
    patients: clone(demoData.patients),
    profile: clone(demoData.profile),
    analytics: clone(demoData.analytics)
  };

  async function apiRequest(path, options = {}, fallback = null) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const token = storedAuthToken();
    const headers = {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };
    if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";

    try {
      const response = await fetch(apiUrl(path), { ...options, headers, signal: controller.signal });
      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = response.status === 204 ? null : await response.json();
      return { data, fallback: false };
    } catch (error) {
      if (isProduction) throw error;
      console.info(`[SehatLine demo fallback] ${path}`, error.message);
      return { data: clone(fallback), fallback: true };
    } finally {
      clearTimeout(timeout);
    }
  }

  async function syncMutation(path, method, payload) {
    return apiRequest(path, {
      method,
      body: JSON.stringify(payload)
    }, { ok: true, ...payload });
  }

  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("sl_doctor_theme", theme);
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = theme === "dark" ? "#07131b" : "#f4f8f8";
  }

  function toggleTheme() {
    applyTheme(state.theme === "dark" ? "light" : "dark");
  }

  function showToast(title, detail = "", type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${icon(type === "error" ? "close" : "check")}</span>
      <span><b>${escapeHTML(title)}</b>${detail ? `<small>${escapeHTML(detail)}</small>` : ""}</span>
    `;
    $("#toast-region").append(toast);
    setTimeout(() => {
      toast.classList.add("leaving");
      setTimeout(() => toast.remove(), 260);
    }, 3500);
  }

  function setButtonLoading(button, loading, loadingText = "Please wait…") {
    if (!button) return;
    if (loading) {
      button.dataset.original = button.innerHTML;
      button.disabled = true;
      button.textContent = loadingText;
    } else {
      button.disabled = false;
      if (button.dataset.original) button.innerHTML = button.dataset.original;
      delete button.dataset.original;
    }
  }

  function formatClock(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
    const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  }

  function formatTimeValue(value) {
    const [hours, minutes] = value.split(":").map(Number);
    const hour = ((hours + 11) % 12) + 1;
    return `${hour}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
  }

  function timeOptions(selected) {
    const values = [];
    for (let hour = 8; hour <= 20; hour += 1) {
      for (const minute of [0, 30]) {
        const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        values.push(`<option value="${value}" ${value === selected ? "selected" : ""}>${formatTimeValue(value)}</option>`);
      }
    }
    return values.join("");
  }

  function normalizeLoadedData(data, fallback, shape = "object") {
    if (shape === "array") return Array.isArray(data) ? data : clone(fallback);
    return data && typeof data === "object" && !Array.isArray(data) ? { ...clone(fallback), ...data } : clone(fallback);
  }

  async function loadAppData() {
    if (state.loaded) return;
    const [dashboardResult, appointmentResult, queueResult, patientResult, profileResult, analyticsResult] = await Promise.all([
      apiRequest("/api/doctor/dashboard", {}, demoData.dashboard),
      apiRequest("/api/doctor/appointments?date=today", {}, demoData.appointments),
      apiRequest("/api/doctor/queue", {}, demoData.queue),
      apiRequest("/api/doctor/patients", {}, demoData.patients),
      apiRequest("/api/doctor/profile", {}, demoData.profile),
      apiRequest("/api/doctor/analytics?range=30", {}, demoData.analytics)
    ]);

    state.dashboard = normalizeLoadedData(dashboardResult.data, demoData.dashboard);
    state.appointments = normalizeLoadedData(appointmentResult.data, demoData.appointments, "array");
    state.queue = normalizeLoadedData(queueResult.data, demoData.queue);
    state.queue.waiting = Array.isArray(state.queue.waiting) ? state.queue.waiting : clone(demoData.queue.waiting);
    state.patients = normalizeLoadedData(patientResult.data, demoData.patients, "array");
    state.profile = normalizeLoadedData(profileResult.data, demoData.profile);
    state.profile.availability = Array.isArray(state.profile.availability) ? state.profile.availability : clone(demoData.profile.availability);
    state.profile.holidays = Array.isArray(state.profile.holidays) ? state.profile.holidays : clone(demoData.profile.holidays);
    state.profile.services = Array.isArray(state.profile.services) ? state.profile.services : clone(demoData.profile.services);
    state.analytics = normalizeLoadedData(analyticsResult.data, demoData.analytics);
    state.demoMode = state.demoMode || [dashboardResult, appointmentResult, queueResult, patientResult, profileResult, analyticsResult].some(result => result.fallback);
    state.loaded = true;
  }

  async function enterApp(session = {}, demo = false) {
    state.authenticated = true;
    state.demoMode = demo;
    localStorage.setItem("sl_doctor_session", JSON.stringify({ demo, at: Date.now(), token: session.token || null }));
    $("#auth-screen").hidden = true;
    $("#app-shell").hidden = false;
    document.body.classList.add("app-active");

    await loadAppData();
    renderAll();
    navigate(location.hash.replace("#", "") || "dashboard", false);
    startQueueClock();
    if (demo) showToast("Demo clinic ready", "Everything is interactive—no real patient data is used.");
  }

  function logout() {
    localStorage.removeItem("sl_doctor_session");
    state.authenticated = false;
    state.loaded = false;
    clearInterval(state.queueTimer);
    closeModal();
    $("#app-shell").hidden = true;
    $("#auth-screen").hidden = false;
    $("#phone-step").hidden = false;
    $("#otp-step").hidden = true;
    document.body.classList.remove("app-active");
    location.hash = "";
    $("#phone").focus();
  }

  function renderAll() {
    renderDashboard();
    renderAppointments();
    renderQueue();
    renderPatients();
    renderAnalytics();
    renderAvailability();
    renderHolidays();
    renderServices();
    updateNavCounts();
  }

  function renderDashboard() {
    $("#dashboard-metrics").innerHTML = state.dashboard.metrics.map(metric => `
      <article class="metric-card">
        <span class="metric-icon ${escapeHTML(metric.tone)}">${icon(metric.icon)}</span>
        <span class="metric-copy">
          <small>${escapeHTML(metric.label)}</small>
          <span><b>${escapeHTML(metric.value)}</b><em>${escapeHTML(metric.trend)}</em></span>
        </span>
      </article>
    `).join("");

    const items = state.appointments
      .filter(appointment => !["rejected", "no-show"].includes(appointment.status))
      .slice(0, 4);
    $("#dashboard-appointments").innerHTML = items.map(appointment => `
      <div class="timeline-row ${appointment.status === "in-progress" ? "current" : ""}">
        <span class="timeline-time">${escapeHTML(appointment.time)}<br>${escapeHTML(appointment.period)}</span>
        <i class="timeline-dot"></i>
        <button class="timeline-patient" type="button" data-open-appointment="${escapeHTML(appointment.id)}">
          <span class="patient-avatar ${appointment.name.length % 2 ? "blue" : ""}">${initials(appointment.name)}</span>
          <span><b>${escapeHTML(appointment.name)}</b><small>${escapeHTML(appointment.reason)}</small></span>
          <span class="token-chip">${escapeHTML(appointment.token)}</span>
        </button>
      </div>
    `).join("");

    if (state.queue.current) {
      $("#dashboard-token").textContent = state.queue.current.token;
      $("#dashboard-current-patient").textContent = state.queue.current.name;
    } else {
      $("#dashboard-token").textContent = "—";
      $("#dashboard-current-patient").textContent = state.queue.status === "closed" ? "Queue closed" : "Ready to begin";
    }
    $("#dashboard-waiting").textContent = state.queue.waiting.length;
  }

  function updateNavCounts() {
    const pending = state.appointments.filter(appointment => appointment.status === "pending").length;
    $("#pending-nav-count").textContent = pending;
    $("#pending-nav-count").hidden = pending === 0;
    $("#mobile-pending-dot").hidden = pending === 0;
    $("#filter-all-count").textContent = state.appointments.length;
    $("#filter-pending-count").textContent = pending;
  }

  function getFilteredAppointments() {
    if (state.appointmentDateOffset !== 0) return [];
    return state.appointments.filter(appointment => {
      const matchesFilter = state.appointmentFilter === "all" ||
        (state.appointmentFilter === "confirmed"
          ? ["confirmed", "in-progress"].includes(appointment.status)
          : appointment.status === state.appointmentFilter);
      const haystack = `${appointment.name} ${appointment.token} ${appointment.reason}`.toLowerCase();
      return matchesFilter && haystack.includes(state.appointmentSearch.toLowerCase());
    });
  }

  function appointmentActions(appointment) {
    if (appointment.status === "pending") {
      return `
        <button class="action-reject" type="button" data-appointment-action="reject" data-id="${escapeHTML(appointment.id)}">Reject</button>
        <button class="action-accept" type="button" data-appointment-action="accept" data-id="${escapeHTML(appointment.id)}">Accept</button>
        <button class="action-menu" type="button" aria-label="More options for ${escapeHTML(appointment.name)}" data-appointment-action="menu" data-id="${escapeHTML(appointment.id)}">${icon("more")}</button>
      `;
    }
    if (["confirmed", "in-progress"].includes(appointment.status)) {
      return `
        <button class="action-no-show" type="button" data-appointment-action="no-show" data-id="${escapeHTML(appointment.id)}">No-show</button>
        <button class="action-complete" type="button" data-appointment-action="complete" data-id="${escapeHTML(appointment.id)}">Complete</button>
        <button class="action-menu" type="button" aria-label="More options for ${escapeHTML(appointment.name)}" data-appointment-action="menu" data-id="${escapeHTML(appointment.id)}">${icon("more")}</button>
      `;
    }
    return `<button class="action-menu" type="button" aria-label="View details for ${escapeHTML(appointment.name)}" data-appointment-action="menu" data-id="${escapeHTML(appointment.id)}">${icon("more")}</button>`;
  }

  function renderAppointments() {
    const filtered = getFilteredAppointments();
    $("#appointment-list").innerHTML = filtered.map(appointment => `
      <article class="appointment-card" data-status="${escapeHTML(appointment.status)}">
        <div class="appointment-time"><b>${escapeHTML(appointment.time)}</b><small>${escapeHTML(appointment.period)}</small></div>
        <div class="appointment-person">
          <span class="patient-avatar ${appointment.name.length % 4 === 0 ? "violet" : appointment.name.length % 3 === 0 ? "amber" : "blue"}">${initials(appointment.name)}</span>
          <span><b>${escapeHTML(appointment.name)}</b><small>${escapeHTML(appointment.age)} yrs · ${escapeHTML(appointment.gender)} · ${escapeHTML(appointment.token)}</small><span class="appointment-status ${escapeHTML(appointment.status)}">${escapeHTML(appointment.status.replace("-", " "))}</span></span>
        </div>
        <div class="appointment-detail"><span>${escapeHTML(appointment.reason)}</span><small>${escapeHTML(appointment.type)}${appointment.note ? " · Note added" : ""}</small></div>
        <div class="appointment-actions">${appointmentActions(appointment)}</div>
      </article>
    `).join("");
    $("#appointment-empty").hidden = filtered.length > 0;
    updateNavCounts();
  }

  function renderQueue() {
    const queue = state.queue;
    const badge = $("#queue-state-badge");
    badge.className = `queue-state-badge ${queue.status}`;
    badge.innerHTML = `<i></i><span>${queue.status === "live" ? "OPD is live" : queue.status === "paused" ? "OPD is paused" : "Queue is closed"}</span>`;
    $("#queue-nav-dot").hidden = queue.status !== "live";
    $("#queue-main-ring").className = `queue-main-ring ${queue.status === "paused" ? "is-paused" : queue.status === "closed" ? "is-closed" : ""}`;
    $("#current-token").textContent = queue.current?.token || "—";
    $("#queue-elapsed").textContent = queue.current ? formatClock(queue.elapsedSeconds) : "Not started";
    $("#queue-waiting-count").textContent = queue.waiting.length;
    $("#queue-seen-count").textContent = queue.seen;
    $("#queue-avg-time").textContent = `${queue.averageMinutes}m`;
    $("#expected-time").value = queue.expectedMinutes;
    $("#expected-time-value").textContent = queue.expectedMinutes;
    updateRangeBackground($("#expected-time"));

    $("#current-patient-card").innerHTML = queue.current
      ? `<span>Current patient</span><h3>${escapeHTML(queue.current.name)}</h3><p>${escapeHTML(queue.current.age)} years · ${escapeHTML(queue.current.reason)}</p>`
      : `<span>${queue.status === "closed" ? "OPD ended" : "No patient active"}</span><h3>${queue.status === "closed" ? "Queue closed" : "Ready for next patient"}</h3><p>${queue.waiting.length ? `${queue.waiting.length} patient${queue.waiting.length === 1 ? "" : "s"} waiting` : "Your waiting list is clear"}</p>`;

    const pauseButton = $("#pause-queue");
    if (queue.status === "closed") {
      pauseButton.innerHTML = `${icon("play")} Start OPD`;
      pauseButton.disabled = false;
      $("#call-next").disabled = true;
    } else if (queue.status === "paused") {
      pauseButton.innerHTML = `${icon("play")} Resume OPD`;
      pauseButton.disabled = false;
      $("#call-next").disabled = true;
    } else {
      pauseButton.innerHTML = `${icon("pause")} Pause OPD`;
      pauseButton.disabled = false;
      $("#call-next").disabled = queue.waiting.length === 0;
    }
    $("#close-queue").disabled = queue.status === "closed";
    $("#delay-queue").disabled = queue.status === "closed";

    $("#queue-waiting-list").innerHTML = queue.waiting.length
      ? queue.waiting.map((patient, index) => `
          <button class="waiting-row" type="button" data-queue-patient="${escapeHTML(patient.token)}">
            <span class="patient-avatar ${index % 3 === 1 ? "blue" : index % 3 === 2 ? "violet" : ""}">${initials(patient.name)}</span>
            <span class="waiting-details"><b>${escapeHTML(patient.name)}</b><small>${escapeHTML(patient.token)} · ${escapeHTML(patient.reason)}</small></span>
            <span class="waiting-meta"><b>~${escapeHTML(patient.wait)} min</b><small>${index + 1}${index === 0 ? "st" : index === 1 ? "nd" : index === 2 ? "rd" : "th"} in line</small></span>
          </button>
        `).join("")
      : `<div class="waiting-empty">${icon("check")}<p>No patients are waiting right now.</p></div>`;
    renderDashboard();
  }

  function updateRangeBackground(input) {
    const min = Number(input.min);
    const max = Number(input.max);
    const value = Number(input.value);
    const percentage = ((value - min) / (max - min)) * 100;
    input.style.background = `linear-gradient(90deg, var(--mint) ${percentage}%, var(--line) ${percentage}%)`;
  }

  function renderPatients() {
    const query = state.patientSearch.toLowerCase();
    let list = state.patients.filter(patient =>
      `${patient.name} ${patient.phone} ${patient.concern}`.toLowerCase().includes(query)
    );
    if (state.patientSort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    if (state.patientSort === "visits") list.sort((a, b) => b.visits - a.visits);

    $("#patient-stats").innerHTML = `
      <article class="patient-stat-card"><span>${icon("users")}</span><span><b>${escapeHTML(state.patients.length >= 100 ? state.patients.length : "1,284")}</b><small>Total patients</small></span></article>
      <article class="patient-stat-card"><span>${icon("heart")}</span><span><b>64%</b><small>Repeat patients</small></span></article>
      <article class="patient-stat-card"><span>${icon("calendar")}</span><span><b>18</b><small>Follow-ups due</small></span></article>
    `;

    $("#patient-table-body").innerHTML = list.map(patient => `
      <tr>
        <td><span class="appointment-person"><span class="patient-avatar ${escapeHTML(patient.tone)}">${initials(patient.name)}</span><span><b>${escapeHTML(patient.name)}</b><small>${escapeHTML(patient.age)} yrs · ${escapeHTML(patient.gender)} · ${escapeHTML(patient.phone)}</small></span></span></td>
        <td>${escapeHTML(patient.lastVisit)}</td>
        <td>${escapeHTML(patient.visits)}</td>
        <td>${escapeHTML(patient.concern)}</td>
        <td><span class="patient-status ${patient.status.includes("Follow") ? "follow-up" : ""}">${escapeHTML(patient.status)}</span></td>
        <td><button class="icon-button" type="button" aria-label="View ${escapeHTML(patient.name)}" data-patient-id="${escapeHTML(patient.id)}">${icon("chevron")}</button></td>
      </tr>
    `).join("");

    $("#patient-mobile-list").innerHTML = list.map(patient => `
      <article class="patient-mobile-card">
        <span class="patient-avatar ${escapeHTML(patient.tone)}">${initials(patient.name)}</span>
        <span><b>${escapeHTML(patient.name)}</b><small>${escapeHTML(patient.concern)} · ${escapeHTML(patient.visits)} visits · ${escapeHTML(patient.lastVisit)}</small></span>
        <button class="icon-button" type="button" aria-label="View ${escapeHTML(patient.name)}" data-patient-id="${escapeHTML(patient.id)}">${icon("chevron")}</button>
      </article>
    `).join("");
  }

  function renderAnalytics(multiplier = 1) {
    const analytics = state.analytics;
    const bookings = Math.round((Number(analytics.totalBookings) || 426) * multiplier);
    const metrics = [
      { label: "Total bookings", value: bookings.toLocaleString("en-IN"), trend: "+12.4%", icon: "calendar" },
      { label: "Repeat patients", value: analytics.repeatPatients || "64%", trend: "+9% benchmark", icon: "users" },
      { label: "Revenue", value: analytics.revenue || "₹2.84L", trend: "+10.8%", icon: "rupee" },
      { label: "Average rating", value: analytics.rating || "4.9", trend: "128 reviews", icon: "star" },
      { label: "Cancellation rate", value: analytics.cancellationRate || "4.2%", trend: "−1.3%", icon: "chart" }
    ];
    $("#analytics-metrics").innerHTML = metrics.map(metric => `
      <article class="analytics-metric">
        <span>${escapeHTML(metric.label)} ${icon(metric.icon)}</span>
        <b>${escapeHTML(metric.value)}</b>
        <small>${escapeHTML(metric.trend)}</small>
      </article>
    `).join("");

    const hours = [
      { label: "9 AM", value: 42 },
      { label: "10 AM", value: 62 },
      { label: "11 AM", value: 78, peak: true },
      { label: "12 PM", value: 50 },
      { label: "2 PM", value: 66 },
      { label: "3 PM", value: 88, peak: true },
      { label: "4 PM", value: 73 },
      { label: "5 PM", value: 54 }
    ];
    $("#hour-bars").innerHTML = hours.map(hour => `
      <span class="hour-column ${hour.peak ? "peak" : ""}"><i style="height:${hour.value}%"></i><span>${hour.label}</span></span>
    `).join("");
  }

  function renderAvailability() {
    $("#availability-list").innerHTML = state.profile.availability.map((slot, index) => `
      <div class="availability-row ${slot.enabled ? "" : "off"}" data-availability-index="${index}">
        <b>${escapeHTML(slot.day)}</b>
        <label class="switch" aria-label="${escapeHTML(slot.day)} availability">
          <input type="checkbox" ${slot.enabled ? "checked" : ""} data-availability-toggle="${index}">
          <span></span>
        </label>
        <div class="time-pair">
          <select aria-label="${escapeHTML(slot.day)} start time" data-time-index="${index}" data-time-field="from">${timeOptions(slot.from)}</select>
          <span>to</span>
          <select aria-label="${escapeHTML(slot.day)} end time" data-time-index="${index}" data-time-field="to">${timeOptions(slot.to)}</select>
        </div>
        <button class="icon-button remove-slot" type="button" aria-label="Clear ${escapeHTML(slot.day)} hours">${icon("close")}</button>
      </div>
    `).join("");
  }

  function renderHolidays() {
    $("#holiday-list").innerHTML = state.profile.holidays.length
      ? state.profile.holidays.map(holiday => `
          <span class="holiday-chip"><b>${escapeHTML(holiday.date)}</b> ${escapeHTML(holiday.label)}
            <button type="button" aria-label="Remove ${escapeHTML(holiday.label)}" data-remove-holiday="${escapeHTML(holiday.id)}">${icon("close")}</button>
          </span>
        `).join("")
      : `<small>No dates blocked.</small>`;
  }

  function renderServices() {
    $("#services-list").innerHTML = state.profile.services.map((service, index) => `
      <div class="service-row" data-service-index="${index}">
        <input aria-label="Service name" value="${escapeHTML(service.name)}" data-service-field="name">
        <span class="service-fee"><input aria-label="Service fee" type="number" min="0" value="${escapeHTML(service.fee)}" data-service-field="fee"></span>
        <select aria-label="Service duration" data-service-field="duration">
          ${["10 min", "15 min", "20 min", "30 min"].map(value => `<option ${value === service.duration ? "selected" : ""}>${value}</option>`).join("")}
        </select>
        <button class="icon-button" type="button" aria-label="Remove ${escapeHTML(service.name)}" data-remove-service="${escapeHTML(service.id)}">${icon("close")}</button>
      </div>
    `).join("");
  }

  const viewTitles = {
    dashboard: { kicker: "SATURDAY, 25 JULY", title: "Good evening, Dr. Aditi 👋" },
    appointments: { kicker: "TODAY’S PRACTICE", title: "Manage appointments" },
    queue: { kicker: "LIVE CLINIC FLOW", title: "Queue control" },
    patients: { kicker: "PATIENT DIRECTORY", title: "Your patients" },
    analytics: { kicker: "PRACTICE PERFORMANCE", title: "Growth & insights" },
    profile: { kicker: "DOCTOR WORKSPACE", title: "Profile settings" }
  };

  function navigate(view, updateHash = true) {
    if (!viewTitles[view]) view = "dashboard";
    state.view = view;
    $$(".view").forEach(section => section.classList.toggle("active", section.id === `view-${view}`));
    $$("[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === view));
    $("#topbar-kicker").textContent = viewTitles[view].kicker;
    $("#page-title").textContent = viewTitles[view].title;
    if (updateHash) history.replaceState(null, "", `#${view}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
    $("#main-content").focus({ preventScroll: true });
  }

  function doctorApplicationModal() {
    openModal(`
      <div class="application-scroll">
        <div class="application-intro">
          <span class="eyebrow">${icon("shield")} Verified doctor network</span>
          <h2 id="modal-title">Apply to join SehatLine</h2>
          <p>Tell us about your medical registration and practice. Your profile stays private until the SehatLine admin team completes verification.</p>
          <div class="application-trust" aria-label="Application assurances">
            <span>${icon("check")} Manual admin review</span>
            <span>${icon("shield")} Licence verification</span>
            <span>${icon("file")} Secure document links</span>
          </div>
        </div>

        <form class="doctor-application-form" id="doctor-application-form" data-step="1" novalidate>
          <ol class="application-progress" aria-label="Application progress">
            <li class="active" data-application-progress="1" data-short-label="You" aria-current="step"><i>1</i><span>Your details</span></li>
            <li data-application-progress="2" data-short-label="Licence"><i>2</i><span>Credentials</span></li>
            <li data-application-progress="3" data-short-label="Clinic"><i>3</i><span>Practice</span></li>
            <li data-application-progress="4" data-short-label="Docs"><i>4</i><span>Documents</span></li>
          </ol>
          <span class="sr-only" id="application-step-status" aria-live="polite">Step 1 of 4: Your details</span>

          <fieldset class="application-step" data-application-step="1">
            <legend>
              <div class="application-step-heading">
                <h3>Let us know who you are</h3>
                <p>Use the same name and contact details shown on your official records.</p>
              </div>
            </legend>
            <div class="application-field-grid">
              <label class="application-field full" for="application-name">Full legal name <em aria-hidden="true">*</em>
                <input id="application-name" name="name" autocomplete="name" minlength="3" maxlength="100" placeholder="Dr. Aditi Kapoor" required>
              </label>
              <label class="application-field application-phone" for="application-phone">Mobile number <em aria-hidden="true">*</em>
                <span aria-hidden="true">+91</span>
                <input id="application-phone" name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" pattern="[6-9][0-9]{9}" maxlength="10" placeholder="9876543210" aria-describedby="application-phone-help" required>
                <small id="application-phone-help">We will use this number for application updates.</small>
              </label>
              <label class="application-field" for="application-email">Professional email <em aria-hidden="true">*</em>
                <input id="application-email" name="email" type="email" autocomplete="email" maxlength="160" placeholder="doctor@clinic.com" required>
              </label>
            </div>
          </fieldset>

          <fieldset class="application-step" data-application-step="2" hidden>
            <legend>
              <div class="application-step-heading">
                <h3>Medical credentials</h3>
                <p>We will verify your registration directly against the issuing medical council.</p>
              </div>
            </legend>
            <div class="application-field-grid">
              <label class="application-field" for="application-registration">Medical registration / licence number <em aria-hidden="true">*</em>
                <input id="application-registration" name="registrationNumber" autocomplete="off" minlength="4" maxlength="60" placeholder="e.g. UPMC-2014-48291" required>
              </label>
              <label class="application-field" for="application-council">Issuing medical council <em aria-hidden="true">*</em>
                <input id="application-council" name="medicalCouncil" list="medical-council-options" maxlength="120" placeholder="e.g. Uttar Pradesh Medical Council" required>
              </label>
              <datalist id="medical-council-options">
                <option value="National Medical Commission">
                <option value="Uttar Pradesh Medical Council">
                <option value="Delhi Medical Council">
                <option value="Bihar Council of Medical Registration">
                <option value="Maharashtra Medical Council">
              </datalist>
              <label class="application-field" for="application-specialty">Primary specialty <em aria-hidden="true">*</em>
                <input id="application-specialty" name="specialty" list="specialty-options" maxlength="100" placeholder="e.g. Dermatologist" required>
              </label>
              <datalist id="specialty-options">
                <option value="General Physician">
                <option value="Dermatologist">
                <option value="Pediatrician">
                <option value="Gynecologist">
                <option value="Orthopedist">
                <option value="Cardiologist">
                <option value="ENT Specialist">
                <option value="Psychiatrist">
              </datalist>
              <label class="application-field" for="application-qualification">Highest medical qualification <em aria-hidden="true">*</em>
                <input id="application-qualification" name="qualification" maxlength="140" placeholder="e.g. MBBS, MD (Dermatology)" required>
              </label>
              <label class="application-field" for="application-experience">Clinical experience in years <em aria-hidden="true">*</em>
                <input id="application-experience" name="experience" type="number" inputmode="numeric" min="0" max="80" step="1" placeholder="8" required>
              </label>
            </div>
          </fieldset>

          <fieldset class="application-step" data-application-step="3" hidden>
            <legend>
              <div class="application-step-heading">
                <h3>Clinic and consultation details</h3>
                <p>These details will appear in the Patient App only after your application is approved.</p>
              </div>
            </legend>
            <div class="application-field-grid">
              <label class="application-field" for="application-clinic">Clinic / hospital name <em aria-hidden="true">*</em>
                <input id="application-clinic" name="clinic" autocomplete="organization" maxlength="140" placeholder="Your clinic name" required>
              </label>
              <label class="application-field" for="application-fee">Consultation fee (INR) <em aria-hidden="true">*</em>
                <input id="application-fee" name="fee" type="number" inputmode="numeric" min="0" max="100000" step="1" placeholder="500" required>
              </label>
              <label class="application-field full" for="application-address">Clinic address <em aria-hidden="true">*</em>
                <textarea id="application-address" name="address" autocomplete="street-address" maxlength="260" rows="2" placeholder="Building, road and locality" required></textarea>
              </label>
              <label class="application-field" for="application-city">City <em aria-hidden="true">*</em>
                <input id="application-city" name="city" autocomplete="address-level2" maxlength="80" placeholder="Prayagraj" required>
              </label>
              <label class="application-field" for="application-pincode">PIN code <em aria-hidden="true">*</em>
                <input id="application-pincode" name="pincode" inputmode="numeric" autocomplete="postal-code" pattern="[1-9][0-9]{5}" maxlength="6" placeholder="211001" required>
              </label>
              <label class="application-field full" for="application-languages">Languages spoken <em aria-hidden="true">*</em>
                <input id="application-languages" name="languages" maxlength="180" placeholder="Hindi, English" aria-describedby="application-languages-help" required>
                <small id="application-languages-help">Separate multiple languages with commas.</small>
              </label>
            </div>
          </fieldset>

          <fieldset class="application-step" data-application-step="4" hidden>
            <legend>
              <div class="application-step-heading">
                <h3>Verification documents</h3>
                <p>Add a clear document name and secure view-only URL for each required record.</p>
              </div>
            </legend>
            <div class="application-review-grid" aria-label="Application summary">
              <div class="application-review-card"><span>${icon("user")}</span><span><b data-application-review="name">Doctor</b><small data-application-review="contact">Contact details</small></span></div>
              <div class="application-review-card"><span>${icon("shield")}</span><span><b data-application-review="registration">Registration number</b><small data-application-review="council">Medical council</small></span></div>
            </div>
            <div class="document-stack">
              <div class="document-card">
                <span aria-hidden="true">${icon("file")}</span>
                <label class="application-field" for="registration-certificate-name">Registration certificate name <em aria-hidden="true">*</em>
                  <input id="registration-certificate-name" name="registrationCertificateName" maxlength="160" placeholder="Medical registration certificate" required>
                </label>
                <label class="application-field" for="registration-certificate-url">Secure certificate URL <em aria-hidden="true">*</em>
                  <input id="registration-certificate-url" name="registrationCertificateUrl" type="url" inputmode="url" placeholder="https://drive.example.com/..." required>
                </label>
              </div>
              <div class="document-card">
                <span aria-hidden="true">${icon("file")}</span>
                <label class="application-field" for="degree-certificate-name">Degree document name <em aria-hidden="true">*</em>
                  <input id="degree-certificate-name" name="degreeCertificateName" maxlength="160" placeholder="MBBS / postgraduate degree" required>
                </label>
                <label class="application-field" for="degree-certificate-url">Secure degree URL <em aria-hidden="true">*</em>
                  <input id="degree-certificate-url" name="degreeCertificateUrl" type="url" inputmode="url" placeholder="https://drive.example.com/..." required>
                </label>
              </div>
              <div class="document-card">
                <span aria-hidden="true">${icon("file")}</span>
                <label class="application-field" for="photo-id-name">Photo ID name <em aria-hidden="true">*</em>
                  <input id="photo-id-name" name="photoIdName" maxlength="160" placeholder="Government photo ID" required>
                </label>
                <label class="application-field" for="photo-id-url">Secure photo ID URL <em aria-hidden="true">*</em>
                  <input id="photo-id-url" name="photoIdUrl" type="url" inputmode="url" placeholder="https://drive.example.com/..." required>
                </label>
              </div>
            </div>
            <p class="document-note">${icon("shield")} Use links that only the SehatLine verification team can view. Do not submit publicly searchable document links.</p>
            <label class="application-declaration" for="application-declaration">
              <input id="application-declaration" name="declaration" type="checkbox" required>
              <span>I confirm that these details and documents belong to me and are accurate. I understand that my doctor profile will remain hidden until manual admin verification is complete.</span>
            </label>
          </fieldset>

          <p class="application-form-error" id="application-form-error" role="alert"></p>
          <div class="application-actions">
            <span>Fields marked * are required</span>
            <div>
              <button class="secondary-button compact-button" type="button" data-application-back hidden>Back</button>
              <button class="primary-button compact-button" type="button" data-application-next>Continue ${icon("arrow")}</button>
              <button class="primary-button compact-button" type="submit" data-application-submit hidden>${icon("shield")} Submit for verification</button>
            </div>
          </div>
        </form>
      </div>
    `, { modalClass: "application-modal", focusSelector: "#application-name" });
    setApplicationStep($("#doctor-application-form"), 1, false);
  }

  function setApplicationStep(form, step, focus = true) {
    if (!form) return;
    const safeStep = Math.max(1, Math.min(4, Number(step) || 1));
    form.dataset.step = String(safeStep);
    $$("[data-application-step]", form).forEach(section => {
      section.hidden = Number(section.dataset.applicationStep) !== safeStep;
    });
    $$("[data-application-progress]", form).forEach(item => {
      const itemStep = Number(item.dataset.applicationProgress);
      item.classList.toggle("active", itemStep === safeStep);
      item.classList.toggle("complete", itemStep < safeStep);
      if (itemStep === safeStep) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    });
    const back = $("[data-application-back]", form);
    const next = $("[data-application-next]", form);
    const submit = $("[data-application-submit]", form);
    back.hidden = safeStep === 1;
    next.hidden = safeStep === 4;
    submit.hidden = safeStep !== 4;
    const labels = ["Your details", "Medical credentials", "Practice details", "Verification documents"];
    $("#application-step-status", form).textContent = `Step ${safeStep} of 4: ${labels[safeStep - 1]}`;
    $("#application-form-error", form).textContent = "";
    if (safeStep === 4) refreshApplicationReview(form);
    if (focus) {
      const target = $("input:not([type='hidden']), select, textarea", $(`[data-application-step="${safeStep}"]`, form));
      target?.focus({ preventScroll: true });
      $(".application-scroll", $("#modal"))?.scrollTo({ top: form.offsetTop, behavior: "smooth" });
    }
  }

  function validateApplicationStep(form, step) {
    const section = $(`[data-application-step="${step}"]`, form);
    const fields = $$("input, select, textarea", section);
    const invalid = fields.find(field => !field.checkValidity());
    if (!invalid) {
      $("#application-form-error", form).textContent = "";
      return true;
    }
    $("#application-form-error", form).textContent = invalid.validity.valueMissing
      ? "Please complete every required field before continuing."
      : "Please check the highlighted field and enter a valid value.";
    invalid.focus();
    invalid.reportValidity();
    return false;
  }

  function refreshApplicationReview(form) {
    const data = new FormData(form);
    const phone = String(data.get("phone") || "");
    const values = {
      name: data.get("name") || "Doctor",
      contact: `${phone ? `+91 ${phone}` : "Phone"} · ${data.get("email") || "Email"}`,
      registration: data.get("registrationNumber") || "Registration number",
      council: data.get("medicalCouncil") || "Medical council"
    };
    Object.entries(values).forEach(([key, value]) => {
      const node = $(`[data-application-review="${key}"]`, form);
      if (node) node.textContent = value;
    });
  }

  function buildDoctorApplicationPayload(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const phone = String(data.phone || "").replace(/\D/g, "");
    const languages = String(data.languages || "").split(",").map(value => value.trim()).filter(Boolean);
    const documents = {
      registrationCertificate: {
        name: String(data.registrationCertificateName || "").trim(),
        url: String(data.registrationCertificateUrl || "").trim()
      },
      degreeCertificate: {
        name: String(data.degreeCertificateName || "").trim(),
        url: String(data.degreeCertificateUrl || "").trim()
      },
      photoId: {
        name: String(data.photoIdName || "").trim(),
        url: String(data.photoIdUrl || "").trim()
      }
    };
    return {
      name: String(data.name || "").trim(),
      phone: `+91${phone}`,
      email: String(data.email || "").trim().toLowerCase(),
      registrationNumber: String(data.registrationNumber || "").trim(),
      licenseNumber: String(data.registrationNumber || "").trim(),
      medicalCouncil: String(data.medicalCouncil || "").trim(),
      specialty: String(data.specialty || "").trim(),
      specialization: String(data.specialty || "").trim(),
      qualification: String(data.qualification || "").trim(),
      experience: Number(data.experience),
      fee: Number(data.fee),
      consultationFee: Number(data.fee),
      clinic: String(data.clinic || "").trim(),
      address: String(data.address || "").trim(),
      city: String(data.city || "").trim(),
      pincode: String(data.pincode || "").trim(),
      location: `${String(data.city || "").trim()} - ${String(data.pincode || "").trim()}`,
      languages,
      documents,
      registrationCertificateName: documents.registrationCertificate.name,
      registrationCertificateUrl: documents.registrationCertificate.url,
      degreeCertificateName: documents.degreeCertificate.name,
      degreeCertificateUrl: documents.degreeCertificate.url,
      photoIdName: documents.photoId.name,
      photoIdUrl: documents.photoId.url,
      verification: {
        registrationNumber: String(data.registrationNumber || "").trim(),
        medicalCouncil: String(data.medicalCouncil || "").trim(),
        documents,
        declarationAcceptedAt: new Date().toISOString()
      },
      applicationSource: "doctor-app",
      appliedAt: new Date().toISOString(),
      status: "pending",
      verified: false
    };
  }

  async function submitDoctorApplication(payload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(apiUrl("/api/doctors"), {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || body.message || `Application API ${response.status}`);
      return body.data || body;
    } finally {
      clearTimeout(timeout);
    }
  }

  function showDoctorApplicationConfirmation(application) {
    const reference = application.id || application.applicationId || application.referenceId || "Pending assignment";
    try {
      localStorage.setItem("sl_doctor_application", JSON.stringify({ id: reference, status: "pending", at: Date.now() }));
    } catch {
      // The confirmation remains available even when local storage is blocked.
    }
    $("#modal-content").innerHTML = `
      <div class="application-scroll">
        <div class="application-success" role="status" aria-live="polite">
          <span class="application-success-mark" aria-hidden="true">${icon("check")}</span>
          <span class="eyebrow">Application received</span>
          <h2 id="modal-title">Your verification is pending</h2>
          <p>Our admin team will check your medical registration, issuing council and supporting documents. Your profile will not appear in the Patient App until it is manually approved.</p>
          <div class="application-reference">Reference: ${escapeHTML(reference)}</div>
          <ol class="application-review-timeline" aria-label="Verification process">
            <li>Documents received</li>
            <li>Licence review</li>
            <li>Admin decision</li>
          </ol>
          <button class="primary-button" type="button" data-application-done>Back to sign in</button>
        </div>
      </div>
    `;
    requestAnimationFrame(() => $("[data-application-done]", $("#modal"))?.focus());
  }

  function openModal(content, options = {}) {
    state.lastFocused = document.activeElement;
    $("#modal").className = `modal${options.modalClass ? ` ${options.modalClass}` : ""}`;
    $("#modal-content").innerHTML = content;
    $("#modal-backdrop").hidden = false;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      const focusTarget = options.focusSelector ? $(options.focusSelector, $("#modal")) : $("input, select, textarea, button:not(.modal-close)", $("#modal-content"));
      (focusTarget || $("#modal-close")).focus();
    });
  }

  function closeModal() {
    if ($("#modal-backdrop").hidden) return;
    $("#modal-backdrop").hidden = true;
    $("#modal-content").innerHTML = "";
    $("#modal").className = "modal";
    document.body.style.overflow = "";
    if (state.lastFocused && document.contains(state.lastFocused)) state.lastFocused.focus();
  }

  function statusModal(appointment, action) {
    const configs = {
      reject: {
        title: "Reject appointment?",
        text: `${appointment.name} will be notified. You can add a short reason to help them rebook.`,
        icon: "close",
        tone: "danger",
        label: "Reject appointment",
        status: "rejected"
      },
      "no-show": {
        title: "Mark as no-show?",
        text: `This records that ${appointment.name} did not arrive for the visit.`,
        icon: "clock",
        tone: "warning",
        label: "Mark no-show",
        status: "no-show"
      },
      complete: {
        title: "Complete consultation",
        text: `Add an optional clinical note before completing ${appointment.name}’s visit.`,
        icon: "check",
        tone: "",
        label: "Mark completed",
        status: "completed"
      }
    };
    const config = configs[action];
    openModal(`
      <span class="modal-icon ${config.tone}">${icon(config.icon)}</span>
      <h2 id="modal-title">${config.title}</h2>
      <p>${escapeHTML(config.text)}</p>
      <form id="status-form" data-appointment-id="${escapeHTML(appointment.id)}" data-next-status="${config.status}">
        <div class="modal-fields">
          <label>${action === "complete" ? "Consultation note (optional)" : "Reason (optional)"}
            <textarea name="note" rows="3" placeholder="${action === "complete" ? "Add care note or follow-up instruction…" : "Add a short explanation…"}">${action === "complete" ? escapeHTML(appointment.note || "") : ""}</textarea>
          </label>
        </div>
        <div class="modal-actions">
          <button class="secondary-button compact-button" type="button" data-close-modal>Cancel</button>
          <button class="primary-button compact-button" type="submit">${config.label}</button>
        </div>
      </form>
    `);
  }

  function rescheduleModal(appointment) {
    openModal(`
      <span class="modal-icon">${icon("calendar")}</span>
      <h2 id="modal-title">Reschedule appointment</h2>
      <p>Choose a new date and time for ${escapeHTML(appointment.name)}. They’ll receive an update automatically.</p>
      <form id="reschedule-form" data-appointment-id="${escapeHTML(appointment.id)}">
        <div class="modal-fields">
          <label>New date<input name="date" type="date" min="2026-07-25" value="2026-07-26" required></label>
          <label>New time<input name="time" type="time" value="10:30" required></label>
          <label>Message (optional)<textarea name="message" rows="2" placeholder="A short note for the patient"></textarea></label>
        </div>
        <div class="modal-actions">
          <button class="secondary-button compact-button" type="button" data-close-modal>Cancel</button>
          <button class="primary-button compact-button" type="submit">Confirm new time</button>
        </div>
      </form>
    `);
  }

  function appointmentMenuModal(appointment) {
    openModal(`
      <span class="modal-icon">${icon("calendar")}</span>
      <h2 id="modal-title">${escapeHTML(appointment.name)}</h2>
      <p>${escapeHTML(appointment.token)} · ${escapeHTML(appointment.time)} ${escapeHTML(appointment.period)} · ${escapeHTML(appointment.reason)}</p>
      <div class="patient-detail-grid">
        <span><small>Age</small><b>${escapeHTML(appointment.age)} years</b></span>
        <span><small>Visit</small><b>${escapeHTML(appointment.type)}</b></span>
        <span><small>Status</small><b>${escapeHTML(appointment.status.replace("-", " "))}</b></span>
      </div>
      ${appointment.note ? `<div class="visit-history"><h4>Note</h4><p>${escapeHTML(appointment.note)}</p></div>` : ""}
      <div class="modal-actions">
        <button class="secondary-button compact-button" type="button" data-add-note="${escapeHTML(appointment.id)}">${icon("edit")} Add note</button>
        ${!["completed", "rejected", "no-show"].includes(appointment.status) ? `<button class="primary-button compact-button" type="button" data-reschedule="${escapeHTML(appointment.id)}">${icon("calendar")} Reschedule</button>` : ""}
      </div>
    `);
  }

  function noteModal(appointment) {
    openModal(`
      <span class="modal-icon">${icon("edit")}</span>
      <h2 id="modal-title">Patient note</h2>
      <p>Add a concise note for ${escapeHTML(appointment.name)}. This prototype stores it only in the current browser.</p>
      <form id="note-form" data-appointment-id="${escapeHTML(appointment.id)}">
        <div class="modal-fields"><label>Note<textarea name="note" rows="5" maxlength="500" required>${escapeHTML(appointment.note || "")}</textarea></label></div>
        <div class="modal-actions"><button class="secondary-button compact-button" type="button" data-close-modal>Cancel</button><button class="primary-button compact-button" type="submit">Save note</button></div>
      </form>
    `);
  }

  function addAppointmentModal() {
    openModal(`
      <span class="modal-icon">${icon("plus")}</span>
      <h2 id="modal-title">Add appointment</h2>
      <p>Create a clinic appointment for a walk-in or phone booking.</p>
      <form id="add-appointment-form">
        <div class="modal-fields">
          <label>Patient name<input name="name" autocomplete="name" required placeholder="Full name"></label>
          <label>Mobile number<input name="phone" inputmode="tel" required placeholder="10-digit number"></label>
          <label>Time<input name="time" type="time" value="18:30" required></label>
          <label>Reason for visit<input name="reason" required placeholder="e.g. Skin consultation"></label>
        </div>
        <div class="modal-actions"><button class="secondary-button compact-button" type="button" data-close-modal>Cancel</button><button class="primary-button compact-button" type="submit">Add to schedule</button></div>
      </form>
    `);
  }

  function delayModal() {
    openModal(`
      <span class="modal-icon warning">${icon("clock")}</span>
      <h2 id="modal-title">Send delay update</h2>
      <p>All waiting patients will receive the revised expected wait time.</p>
      <form id="delay-form">
        <div class="modal-fields">
          <label>Additional delay<select name="delay"><option value="10">10 minutes</option><option value="15" selected>15 minutes</option><option value="20">20 minutes</option><option value="30">30 minutes</option></select></label>
          <label>Message<textarea name="message" rows="3">The doctor is running slightly behind schedule. Thank you for your patience.</textarea></label>
        </div>
        <div class="modal-actions"><button class="secondary-button compact-button" type="button" data-close-modal>Cancel</button><button class="primary-button compact-button" type="submit">Notify ${state.queue.waiting.length} patients</button></div>
      </form>
    `);
  }

  function closeQueueModal() {
    openModal(`
      <span class="modal-icon danger">${icon("stop")}</span>
      <h2 id="modal-title">Close today’s queue?</h2>
      <p>${state.queue.waiting.length ? `${state.queue.waiting.length} waiting patients will be told that today’s OPD has closed.` : "Today’s OPD will be marked complete."}</p>
      <div class="modal-actions"><button class="secondary-button compact-button" type="button" data-close-modal>Keep open</button><button class="primary-button compact-button" id="confirm-close-queue" type="button">Close queue</button></div>
    `);
  }

  function patientDetailModal(patient) {
    openModal(`
      <h2 class="sr-only" id="modal-title">Patient details for ${escapeHTML(patient.name)}</h2>
      <div class="patient-detail-hero">
        <span class="patient-avatar ${escapeHTML(patient.tone)}">${initials(patient.name)}</span>
        <span><h3>${escapeHTML(patient.name)}</h3><p>${escapeHTML(patient.age)} years · ${escapeHTML(patient.gender)} · ${escapeHTML(patient.phone)}</p></span>
      </div>
      <div class="patient-detail-grid">
        <span><small>Total visits</small><b>${escapeHTML(patient.visits)}</b></span>
        <span><small>Last visit</small><b>${escapeHTML(patient.lastVisit)}</b></span>
        <span><small>Care status</small><b>${escapeHTML(patient.status)}</b></span>
      </div>
      <div class="visit-history">
        <h4>Recent visit history</h4>
        ${(patient.history || []).map(item => `<div class="visit-history-row"><b>${escapeHTML(item.concern)}</b><span>${escapeHTML(item.date)}</span></div>`).join("") || "<p>No visit history available.</p>"}
      </div>
      <div class="modal-actions"><a class="secondary-button compact-button" href="tel:+91${escapeHTML(patient.phone.replace(/\s/g, ""))}">${icon("phone")} Call patient</a><button class="primary-button compact-button" type="button" data-create-followup="${escapeHTML(patient.id)}">${icon("calendar")} Book follow-up</button></div>
    `);
  }

  function addHolidayModal() {
    openModal(`
      <span class="modal-icon">${icon("calendar")}</span>
      <h2 id="modal-title">Block a date</h2>
      <p>Bookings will be unavailable for this clinic on the selected date.</p>
      <form id="holiday-form">
        <div class="modal-fields"><label>Date<input name="date" type="date" min="2026-07-25" required></label><label>Reason<input name="label" placeholder="Personal leave" required></label></div>
        <div class="modal-actions"><button class="secondary-button compact-button" type="button" data-close-modal>Cancel</button><button class="primary-button compact-button" type="submit">Block date</button></div>
      </form>
    `);
  }

  async function updateAppointmentStatus(id, nextStatus, note = "") {
    const appointment = state.appointments.find(item => item.id === id);
    if (!appointment) return;
    appointment.status = nextStatus;
    if (note) appointment.note = note;
    if (nextStatus === "completed" && state.queue.current?.appointmentId === id) {
      state.queue.seen += 1;
    }
    await syncMutation(`/api/doctor/appointments/${encodeURIComponent(id)}`, "PATCH", { status: nextStatus, note });
    renderAppointments();
    renderDashboard();
    updateNavCounts();
    showToast(
      nextStatus === "confirmed" ? "Appointment accepted" :
        nextStatus === "completed" ? "Consultation completed" :
          nextStatus === "no-show" ? "No-show recorded" : "Appointment updated",
      `${appointment.name} · ${appointment.time} ${appointment.period}`
    );
  }

  async function callNextPatient() {
    if (state.queue.status !== "live") return;
    if (!state.queue.waiting.length) {
      showToast("Queue is clear", "No patient is currently waiting.");
      return;
    }
    const previous = state.queue.current;
    if (previous?.appointmentId) {
      const appointment = state.appointments.find(item => item.id === previous.appointmentId);
      if (appointment) appointment.status = "completed";
    }
    const next = state.queue.waiting.shift();
    state.queue.current = {
      token: next.token,
      name: next.name,
      age: state.patients.find(patient => patient.name === next.name)?.age || "—",
      reason: next.reason,
      appointmentId: next.appointmentId
    };
    state.queue.seen += 1;
    state.queue.elapsedSeconds = 0;
    state.queue.waiting.forEach((patient, index) => {
      patient.wait = Math.max(5, state.queue.expectedMinutes * (index + 1) + state.queue.delayMinutes);
    });
    if (next.appointmentId) {
      const appointment = state.appointments.find(item => item.id === next.appointmentId);
      if (appointment) appointment.status = "in-progress";
    }
    await syncMutation("/api/doctor/queue/next", "POST", { previousToken: previous?.token, nextToken: next.token });
    renderQueue();
    renderAppointments();
    showToast(`${next.token} called`, `${next.name} has been notified to enter.`);
  }

  function startQueueClock() {
    clearInterval(state.queueTimer);
    state.queueTimer = setInterval(() => {
      if (!state.authenticated || state.queue.status !== "live" || !state.queue.current) return;
      state.queue.elapsedSeconds += 1;
      if ($("#queue-elapsed")) $("#queue-elapsed").textContent = formatClock(state.queue.elapsedSeconds);
    }, 1000);
  }

  function openNotifications(open = true) {
    $("#notification-drawer").classList.toggle("open", open);
    $("#notification-drawer").setAttribute("aria-hidden", String(!open));
    $("#notification-button").setAttribute("aria-expanded", String(open));
    $("#drawer-backdrop").hidden = !open;
    if (open) $("#close-notifications").focus();
  }

  async function saveProfile(form = $("#profile-form")) {
    const formData = new FormData(form);
    const fields = Object.fromEntries(formData.entries());
    const button = form.querySelector('button[type="submit"]');
    setButtonLoading(button, true, "Saving…");
    await syncMutation("/api/doctor/profile", "PUT", {
      ...fields,
      availability: state.profile.availability,
      holidays: state.profile.holidays,
      services: state.profile.services
    });
    await wait(250);
    setButtonLoading(button, false);
    const now = new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
    $("#profile-save-status").textContent = `Saved today at ${now}`;
    showToast("Profile saved", "Your public listing and clinic details are up to date.");
  }

  function downloadPatients() {
    const rows = [
      ["Name", "Phone", "Age", "Gender", "Last visit", "Visits", "Last concern", "Status"],
      ...state.patients.map(patient => [patient.name, patient.phone, patient.age, patient.gender, patient.lastVisit, patient.visits, patient.concern, patient.status])
    ];
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sehatline-patients.csv";
    link.click();
    URL.revokeObjectURL(url);
    showToast("Patient list exported", "The CSV download is ready.");
  }

  function bindAuth() {
    if (!appConfig.allowGuestAccess) {
      $("#demo-login")?.remove();
      $(".divider")?.remove();
      $(".demo-hint")?.remove();
    }

    $("#open-doctor-application")?.addEventListener("click", doctorApplicationModal);

    $("#phone").addEventListener("input", event => {
      const digits = event.target.value.replace(/\D/g, "").slice(0, 10);
      event.target.value = digits.replace(/(\d{5})(?=\d)/, "$1 ");
      $("#phone-error").textContent = "";
    });

    $("#phone-form").addEventListener("submit", async event => {
      event.preventDefault();
      const phone = $("#phone").value.replace(/\D/g, "");
      if (!/^[6-9]\d{9}$/.test(phone)) {
        $("#phone-error").textContent = "Enter a valid 10-digit Indian mobile number.";
        $("#phone").focus();
        return;
      }
      const button = event.submitter;
      setButtonLoading(button, true, "Sending OTP…");
      try {
        await apiRequest("/api/auth/doctor/request-otp", { method: "POST", body: JSON.stringify({ phone: `+91${phone}` }) }, { sent: true });
      } catch {
        setButtonLoading(button, false);
        $("#phone-error").textContent = "OTP could not be sent. Please try again.";
        return;
      }
      await wait(250);
      setButtonLoading(button, false);
      $("#phone-step").hidden = true;
      $("#otp-step").hidden = false;
      $("#masked-phone").textContent = `+91 ••••• •${phone.slice(-4)}`;
      $$(".otp-fields input")[0].focus();
      startResendCountdown();
    });

    $("#otp-back").addEventListener("click", () => {
      $("#otp-step").hidden = true;
      $("#phone-step").hidden = false;
      $("#phone").focus();
    });

    $$(".otp-fields input").forEach((input, index, fields) => {
      input.addEventListener("input", event => {
        event.target.value = event.target.value.replace(/\D/g, "").slice(-1);
        if (event.target.value && fields[index + 1]) fields[index + 1].focus();
        $("#otp-error").textContent = "";
      });
      input.addEventListener("keydown", event => {
        if (event.key === "Backspace" && !event.target.value && fields[index - 1]) fields[index - 1].focus();
      });
      input.addEventListener("paste", event => {
        const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        if (digits.length === 6) {
          event.preventDefault();
          fields.forEach((field, fieldIndex) => { field.value = digits[fieldIndex] || ""; });
          fields[5].focus();
        }
      });
    });

    $("#otp-form").addEventListener("submit", async event => {
      event.preventDefault();
      const code = $$(".otp-fields input").map(input => input.value).join("");
      if (code.length !== 6) {
        $("#otp-error").textContent = "Enter all 6 digits.";
        return;
      }
      const button = event.submitter;
      setButtonLoading(button, true, "Verifying…");
      const phone = $("#phone").value.replace(/\D/g, "");
      let result;
      try {
        result = await apiRequest("/api/auth/doctor/verify-otp", {
          method: "POST",
          body: JSON.stringify({ phone: `+91${phone}`, otp: code })
        }, { token: "demo-session", doctor: demoData.profile });
      } catch {
        setButtonLoading(button, false);
        $("#otp-error").textContent = "Verification failed. Please request a new code.";
        return;
      }
      if (result.fallback && code !== "123456") {
        setButtonLoading(button, false);
        $("#otp-error").textContent = "For this prototype, use OTP 123456.";
        return;
      }
      await enterApp(result.data || {}, result.fallback);
      setButtonLoading(button, false);
    });

    $("#demo-login")?.addEventListener("click", async event => {
      setButtonLoading(event.currentTarget, true, "Preparing your clinic…");
      await enterApp({ token: "demo-session" }, true);
      setButtonLoading(event.currentTarget, false);
    });

    $("#resend-otp").addEventListener("click", async event => {
      event.currentTarget.disabled = true;
      await apiRequest("/api/auth/doctor/request-otp", { method: "POST" }, { sent: true });
      showToast("OTP sent again", "Use 123456 in this prototype.");
      startResendCountdown();
    });
  }

  let resendInterval;
  function startResendCountdown() {
    clearInterval(resendInterval);
    let time = 30;
    $("#resend-time").textContent = time;
    $("#resend-otp").disabled = true;
    $("#resend-otp").innerHTML = `Resend code in <span id="resend-time">${time}</span>s`;
    resendInterval = setInterval(() => {
      time -= 1;
      const timer = $("#resend-time");
      if (timer) timer.textContent = time;
      if (time <= 0) {
        clearInterval(resendInterval);
        $("#resend-otp").disabled = false;
        $("#resend-otp").textContent = "Resend code";
      }
    }, 1000);
  }

  function bindNavigation() {
    document.addEventListener("click", event => {
      const navTarget = event.target.closest("[data-view]");
      if (navTarget && state.authenticated) {
        event.preventDefault();
        navigate(navTarget.dataset.view);
      }
      const linkTarget = event.target.closest("[data-view-link]");
      if (linkTarget && state.authenticated) {
        event.preventDefault();
        navigate(linkTarget.dataset.viewLink);
      }
    });
    $("#profile-shortcut").addEventListener("click", () => navigate("profile"));
    window.addEventListener("hashchange", () => {
      if (state.authenticated) navigate(location.hash.replace("#", ""), false);
    });
  }

  function bindAppointments() {
    $("#appointment-filters").addEventListener("click", event => {
      const button = event.target.closest("[data-filter]");
      if (!button) return;
      state.appointmentFilter = button.dataset.filter;
      $$("#appointment-filters button").forEach(item => {
        item.classList.toggle("active", item === button);
        item.setAttribute("aria-selected", String(item === button));
      });
      renderAppointments();
    });

    $("#appointment-search").addEventListener("input", event => {
      state.appointmentSearch = event.target.value.trim();
      renderAppointments();
    });

    $("#appointment-list").addEventListener("click", event => {
      const button = event.target.closest("[data-appointment-action]");
      if (!button) return;
      const appointment = state.appointments.find(item => item.id === button.dataset.id);
      if (!appointment) return;
      const action = button.dataset.appointmentAction;
      if (action === "accept") updateAppointmentStatus(appointment.id, "confirmed");
      else if (["reject", "complete", "no-show"].includes(action)) statusModal(appointment, action);
      else appointmentMenuModal(appointment);
    });

    $("#dashboard-appointments").addEventListener("click", event => {
      const button = event.target.closest("[data-open-appointment]");
      if (!button) return;
      const appointment = state.appointments.find(item => item.id === button.dataset.openAppointment);
      if (appointment) appointmentMenuModal(appointment);
    });

    $("#add-appointment").addEventListener("click", addAppointmentModal);

    const moveDate = direction => {
      state.appointmentDateOffset += direction;
      const date = new Date(2026, 6, 25 + state.appointmentDateOffset);
      $("#appointment-date span").textContent = state.appointmentDateOffset === 0
        ? "Today, 25 July"
        : date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
      renderAppointments();
    };
    $("#previous-day").addEventListener("click", () => moveDate(-1));
    $("#next-day").addEventListener("click", () => moveDate(1));
    $("#appointment-date").addEventListener("click", () => {
      state.appointmentDateOffset = 0;
      $("#appointment-date span").textContent = "Today, 25 July";
      renderAppointments();
    });
  }

  function bindQueue() {
    $("#pause-queue").addEventListener("click", async () => {
      if (state.queue.status === "closed") {
        state.queue.status = "live";
        state.queue.current = null;
        state.queue.elapsedSeconds = 0;
        await syncMutation("/api/doctor/queue/start", "POST", { status: "live", expectedMinutes: state.queue.expectedMinutes });
        showToast("OPD started", "You can now call the next waiting patient.");
      } else if (state.queue.status === "paused") {
        state.queue.status = "live";
        await syncMutation("/api/doctor/queue/resume", "POST", { status: "live" });
        showToast("OPD resumed", "Queue estimates are live again.");
      } else {
        state.queue.status = "paused";
        await syncMutation("/api/doctor/queue/pause", "POST", { status: "paused" });
        showToast("OPD paused", "Waiting patients can see that the queue is paused.");
      }
      renderQueue();
    });
    $("#call-next").addEventListener("click", callNextPatient);
    $("#delay-queue").addEventListener("click", delayModal);
    $("#close-queue").addEventListener("click", closeQueueModal);
    $("#notify-all").addEventListener("click", async () => {
      await syncMutation("/api/doctor/queue/notify", "POST", { patientTokens: state.queue.waiting.map(patient => patient.token) });
      showToast("Patients notified", `${state.queue.waiting.length} queue updates were sent.`);
    });
    $("#expected-time").addEventListener("input", event => {
      state.queue.expectedMinutes = Number(event.target.value);
      $("#expected-time-value").textContent = state.queue.expectedMinutes;
      updateRangeBackground(event.target);
      state.queue.waiting.forEach((patient, index) => {
        patient.wait = state.queue.expectedMinutes * (index + 1) + state.queue.delayMinutes;
      });
      renderQueue();
    });
    $("#expected-time").addEventListener("change", () => {
      syncMutation("/api/doctor/queue/settings", "PATCH", { expectedMinutes: state.queue.expectedMinutes });
      showToast("Queue timing updated", `${state.queue.expectedMinutes} minutes expected per patient.`);
    });
    $("#queue-waiting-list").addEventListener("click", event => {
      const row = event.target.closest("[data-queue-patient]");
      if (!row) return;
      const queued = state.queue.waiting.find(item => item.token === row.dataset.queuePatient);
      if (!queued) return;
      const patient = state.patients.find(item => item.name === queued.name);
      if (patient) patientDetailModal(patient);
      else showToast(queued.name, `${queued.token} · ${queued.reason} · approx. ${queued.wait} min`);
    });
  }

  function bindPatients() {
    $("#patient-search").addEventListener("input", event => {
      state.patientSearch = event.target.value.trim();
      renderPatients();
    });
    $("#patient-sort").addEventListener("change", event => {
      state.patientSort = event.target.value;
      renderPatients();
    });
    $("#view-patients").addEventListener("click", event => {
      const button = event.target.closest("[data-patient-id]");
      if (!button) return;
      const patient = state.patients.find(item => item.id === button.dataset.patientId);
      if (patient) patientDetailModal(patient);
    });
    $("#export-patients").addEventListener("click", downloadPatients);
  }

  function bindAnalytics() {
    $("#analytics-range").addEventListener("change", async event => {
      const value = event.target.value;
      const result = await apiRequest(`/api/doctor/analytics?range=${encodeURIComponent(value)}`, {}, demoData.analytics);
      state.analytics = normalizeLoadedData(result.data, demoData.analytics);
      renderAnalytics(value === "90" ? 2.75 : value === "365" ? 10.8 : 1);
      showToast("Analytics updated", event.target.options[event.target.selectedIndex].text);
    });
  }

  function bindProfile() {
    $(".profile-nav").addEventListener("click", event => {
      const button = event.target.closest("[data-profile-tab]");
      if (!button) return;
      $$(".profile-nav [data-profile-tab]").forEach(item => item.classList.toggle("active", item === button));
      $$(".profile-tab").forEach(panel => panel.classList.toggle("active", panel.dataset.profilePanel === button.dataset.profileTab));
    });
    $("#profile-form").addEventListener("submit", event => {
      event.preventDefault();
      saveProfile(event.currentTarget);
    });
    $("#save-profile-top").addEventListener("click", () => saveProfile());

    $("#profile-form textarea[name='about']").addEventListener("input", event => {
      if (event.target.value.length > 300) event.target.value = event.target.value.slice(0, 300);
      $("#about-count").textContent = event.target.value.length;
    });

    $("#availability-list").addEventListener("change", event => {
      if (event.target.matches("[data-availability-toggle]")) {
        const index = Number(event.target.dataset.availabilityToggle);
        state.profile.availability[index].enabled = event.target.checked;
        renderAvailability();
      }
      if (event.target.matches("[data-time-index]")) {
        const index = Number(event.target.dataset.timeIndex);
        state.profile.availability[index][event.target.dataset.timeField] = event.target.value;
      }
    });

    $("#copy-hours").addEventListener("click", () => {
      const monday = state.profile.availability[0];
      state.profile.availability.slice(1, 5).forEach(slot => {
        slot.enabled = monday.enabled;
        slot.from = monday.from;
        slot.to = monday.to;
      });
      renderAvailability();
      showToast("Hours copied", "Monday’s timing now applies Tuesday through Friday.");
    });

    $("#add-holiday").addEventListener("click", addHolidayModal);
    $("#holiday-list").addEventListener("click", event => {
      const button = event.target.closest("[data-remove-holiday]");
      if (!button) return;
      state.profile.holidays = state.profile.holidays.filter(item => item.id !== button.dataset.removeHoliday);
      renderHolidays();
      showToast("Blocked date removed");
    });

    $("#add-service").addEventListener("click", () => {
      state.profile.services.push({ id: `s-${Date.now()}`, name: "New service", fee: 700, duration: "15 min" });
      renderServices();
      const fields = $$("#services-list [data-service-field='name']");
      fields.at(-1)?.select();
    });
    $("#services-list").addEventListener("input", event => {
      const row = event.target.closest("[data-service-index]");
      if (!row || !event.target.matches("[data-service-field]")) return;
      const index = Number(row.dataset.serviceIndex);
      const field = event.target.dataset.serviceField;
      state.profile.services[index][field] = field === "fee" ? Number(event.target.value) : event.target.value;
    });
    $("#services-list").addEventListener("change", event => {
      const row = event.target.closest("[data-service-index]");
      if (!row || !event.target.matches("[data-service-field]")) return;
      state.profile.services[Number(row.dataset.serviceIndex)][event.target.dataset.serviceField] = event.target.value;
    });
    $("#services-list").addEventListener("click", event => {
      const button = event.target.closest("[data-remove-service]");
      if (!button) return;
      state.profile.services = state.profile.services.filter(item => item.id !== button.dataset.removeService);
      renderServices();
      showToast("Service removed");
    });

    $("#profile-photo").addEventListener("change", event => {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        $$(".large-avatar, .top-avatar, .avatar-doctor").forEach(avatar => {
          avatar.style.backgroundImage = `url("${reader.result}")`;
          avatar.style.backgroundSize = "cover";
          avatar.style.color = "transparent";
        });
        showToast("Photo updated", "Save changes to keep the new profile photo.");
      };
      reader.readAsDataURL(file);
    });
  }

  function bindModalActions() {
    $("#modal-close").addEventListener("click", closeModal);
    $("#modal-backdrop").addEventListener("click", event => {
      if (event.target === event.currentTarget) closeModal();
    });
    $("#modal-content").addEventListener("input", event => {
      if (event.target.matches("#application-phone, #application-pincode")) {
        event.target.value = event.target.value.replace(/\D/g, "").slice(0, Number(event.target.maxLength) || undefined);
      }
      if (event.target.closest("#doctor-application-form")) {
        $("#application-form-error")?.replaceChildren();
      }
    });
    $("#modal-content").addEventListener("click", async event => {
      if (event.target.closest("[data-close-modal]")) closeModal();

      const applicationNext = event.target.closest("[data-application-next]");
      if (applicationNext) {
        const form = applicationNext.closest("#doctor-application-form");
        const step = Number(form?.dataset.step || 1);
        if (form && validateApplicationStep(form, step)) setApplicationStep(form, step + 1);
      }

      const applicationBack = event.target.closest("[data-application-back]");
      if (applicationBack) {
        const form = applicationBack.closest("#doctor-application-form");
        if (form) setApplicationStep(form, Number(form.dataset.step || 1) - 1);
      }

      if (event.target.closest("[data-application-done]")) {
        closeModal();
        $("#phone")?.focus();
      }

      const reschedule = event.target.closest("[data-reschedule]");
      if (reschedule) {
        const appointment = state.appointments.find(item => item.id === reschedule.dataset.reschedule);
        if (appointment) rescheduleModal(appointment);
      }
      const note = event.target.closest("[data-add-note]");
      if (note) {
        const appointment = state.appointments.find(item => item.id === note.dataset.addNote);
        if (appointment) noteModal(appointment);
      }
      const followup = event.target.closest("[data-create-followup]");
      if (followup) {
        const patient = state.patients.find(item => item.id === followup.dataset.createFollowup);
        closeModal();
        addAppointmentModal();
        const form = $("#add-appointment-form");
        if (form && patient) {
          form.elements.name.value = patient.name;
          form.elements.phone.value = patient.phone;
          form.elements.reason.value = `${patient.concern} follow-up`;
        }
      }
      if (event.target.closest("#confirm-close-queue")) {
        state.queue.status = "closed";
        state.queue.current = null;
        await syncMutation("/api/doctor/queue/close", "POST", { status: "closed" });
        closeModal();
        renderQueue();
        showToast("Queue closed", "Today’s OPD summary is ready in Analytics.");
      }
    });

    $("#modal-content").addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.target;
      const button = event.submitter;
      setButtonLoading(button, true);

      if (form.id === "doctor-application-form") {
        const invalidStep = [1, 2, 3, 4].find(step => !validateApplicationStep(form, step));
        if (invalidStep) {
          setApplicationStep(form, invalidStep);
          validateApplicationStep(form, invalidStep);
          setButtonLoading(button, false);
          return;
        }
        try {
          const application = await submitDoctorApplication(buildDoctorApplicationPayload(form));
          showDoctorApplicationConfirmation(application || {});
        } catch (error) {
          $("#application-form-error", form).textContent = error.name === "AbortError"
            ? "Submission timed out. Check your connection and try again."
            : "We could not submit your application. Please try again.";
          showToast("Application not submitted", "Your details are still here so you can retry.", "error");
          setButtonLoading(button, false);
        }
        return;
      }

      if (form.id === "status-form") {
        const data = new FormData(form);
        await updateAppointmentStatus(form.dataset.appointmentId, form.dataset.nextStatus, data.get("note"));
        closeModal();
      }

      if (form.id === "reschedule-form") {
        const data = Object.fromEntries(new FormData(form).entries());
        const appointment = state.appointments.find(item => item.id === form.dataset.appointmentId);
        if (appointment) {
          const [hourString, minute] = data.time.split(":");
          const hour = Number(hourString);
          appointment.time = `${String(((hour + 11) % 12) + 1).padStart(2, "0")}:${minute}`;
          appointment.period = hour >= 12 ? "PM" : "AM";
          appointment.status = "confirmed";
          await syncMutation(`/api/doctor/appointments/${encodeURIComponent(appointment.id)}/reschedule`, "POST", data);
          renderAppointments();
          renderDashboard();
          closeModal();
          showToast("Appointment rescheduled", `${appointment.name} will be notified.`);
        }
      }

      if (form.id === "note-form") {
        const data = new FormData(form);
        const appointment = state.appointments.find(item => item.id === form.dataset.appointmentId);
        if (appointment) {
          appointment.note = data.get("note");
          await syncMutation(`/api/doctor/appointments/${encodeURIComponent(appointment.id)}/notes`, "POST", { note: appointment.note });
          renderAppointments();
          closeModal();
          showToast("Note saved", `Added to ${appointment.name}’s appointment.`);
        }
      }

      if (form.id === "add-appointment-form") {
        const data = Object.fromEntries(new FormData(form).entries());
        const [hourString, minute] = data.time.split(":");
        const hour = Number(hourString);
        const appointment = {
          id: `apt-${Date.now()}`,
          time: `${String(((hour + 11) % 12) + 1).padStart(2, "0")}:${minute}`,
          period: hour >= 12 ? "PM" : "AM",
          name: data.name,
          age: "—",
          gender: "—",
          phone: data.phone,
          token: `A${20 + state.appointments.filter(item => item.id.startsWith("apt-1")).length}`,
          reason: data.reason,
          type: "Clinic booking",
          status: "confirmed",
          note: ""
        };
        state.appointments.push(appointment);
        await syncMutation("/api/doctor/appointments", "POST", appointment);
        state.appointmentDateOffset = 0;
        $("#appointment-date span").textContent = "Today, 25 July";
        renderAppointments();
        renderDashboard();
        closeModal();
        showToast("Appointment added", `${appointment.name} · ${appointment.time} ${appointment.period}`);
      }

      if (form.id === "delay-form") {
        const data = Object.fromEntries(new FormData(form).entries());
        state.queue.delayMinutes = Number(data.delay);
        state.queue.waiting.forEach((patient, index) => {
          patient.wait = state.queue.expectedMinutes * (index + 1) + state.queue.delayMinutes;
        });
        await syncMutation("/api/doctor/queue/delay", "POST", data);
        renderQueue();
        closeModal();
        showToast("Delay update sent", `${state.queue.waiting.length} patients were notified of a ${data.delay}-minute delay.`);
      }

      if (form.id === "holiday-form") {
        const data = Object.fromEntries(new FormData(form).entries());
        const date = new Date(`${data.date}T12:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
        state.profile.holidays.push({ id: `h-${Date.now()}`, date, label: data.label });
        renderHolidays();
        closeModal();
        showToast("Date blocked", `${date} is unavailable for bookings.`);
      }

      setButtonLoading(button, false);
    });
  }

  function bindUtilities() {
    $("#theme-toggle").addEventListener("click", toggleTheme);
    $("#auth-theme-toggle").addEventListener("click", toggleTheme);
    $("#notification-button").addEventListener("click", () => openNotifications(true));
    $("#close-notifications").addEventListener("click", () => openNotifications(false));
    $("#drawer-backdrop").addEventListener("click", () => openNotifications(false));
    $("#mark-notifications-read").addEventListener("click", () => {
      $(".notification-button > i").hidden = true;
      openNotifications(false);
      showToast("All caught up", "Notifications marked as read.");
    });
    $("#sidebar-menu").addEventListener("click", () => {
      openModal(`
        <span class="modal-icon">${icon("user")}</span>
        <h2 id="modal-title">Dr. Aditi Kapoor</h2>
        <p>Dermatologist · Kapoor Skin &amp; Wellness Clinic</p>
        <div class="modal-actions"><button class="secondary-button compact-button" type="button" data-close-modal>Close</button><button class="primary-button compact-button" id="logout-button" type="button">${icon("logout")} Sign out</button></div>
      `);
    });
    $("#modal-content").addEventListener("click", event => {
      if (event.target.closest("#logout-button")) logout();
    });
    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      if (!$("#modal-backdrop").hidden) closeModal();
      else if ($("#notification-drawer").classList.contains("open")) openNotifications(false);
    });
  }

  async function bootstrap() {
    applyTheme(state.theme);
    bindAuth();
    bindNavigation();
    bindAppointments();
    bindQueue();
    bindPatients();
    bindAnalytics();
    bindProfile();
    bindModalActions();
    bindUtilities();

    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("./sw.js").catch(error => console.info("Service worker unavailable:", error.message));
    }

    const savedSession = localStorage.getItem("sl_doctor_session");
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        await enterApp(session, Boolean(session.demo));
      } catch {
        localStorage.removeItem("sl_doctor_session");
      }
    }
  }

  bootstrap();
})();
