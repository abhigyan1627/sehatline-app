"use strict";

const API_BASE = `${location.protocol === "file:" ? "http://localhost:4000" : ""}/api`;
const state = {
  csrfToken: "",
  staff: null,
  doctors: [],
  doctorId: "",
  date: localDateKey(),
  route: "dashboard",
  dashboard: null,
  patients: [],
  patientQuery: "",
  busy: false,
  walkinResult: null,
  liveTimer: null,
  liveSyncBusy: false
};

const icons = {
  shield:'<path d="M12 3 4 6v6c0 5 3.4 8 8 10 4.6-2 8-5 8-10V6l-8-3Z"/><path d="m8 12 3 3 5-6"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4m8-4v4M3 10h18"/>',
  activity:'<path d="M3 12h4l2-7 4 14 3-7h5"/>',
  "user-plus":'<circle cx="10" cy="8" r="4"/><path d="M3 21c.7-4 3-6 7-6 2.5 0 4.5.8 5.6 2.4M19 8v6m-3-3h6"/>',
  users:'<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20c.5-4 2.5-6 6-6s5.5 2 6 6m0-5c3 0 5 1.5 5 5"/>',
  logout:'<path d="M10 4H5v16h5m4-4 4-4-4-4m4 4H9"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  ticket:'<path d="M3 7a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-3a2 2 0 0 0 0-4V7Z"/><path d="M13 5v14"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  pause:'<path d="M8 5v14m8-14v14"/>',
  play:'<path d="m8 5 11 7-11 7V5Z"/>',
  next:'<path d="m6 5 9 7-9 7V5Zm11 0v14"/>',
  x:'<path d="m6 6 12 12M18 6 6 18"/>',
  refresh:'<path d="M20 6v5h-5M4 18v-5h5"/><path d="M18.5 9A7 7 0 0 0 6 6.5L4 11m16 2-2 4.5A7 7 0 0 1 5.5 15"/>',
  phone:'<path d="M6 3h4l2 5-3 2c1.3 2.8 3.2 4.7 6 6l2-3 5 2v4c0 1.7-1.3 3-3 3C10.2 22 2 13.8 2 5c0-1.1.9-2 2-2h2Z"/>'
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.grid}</svg>`;
const initials = name => String(name || "SL").split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
const normalizeStatus = value => String(value || "confirmed").toLowerCase().replaceAll(" ", "-");

function localDateKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function displayDate(value) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function displayTime(value) {
  const text = String(value || "");
  if (/am|pm/i.test(text)) return text;
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return text || "—";
  const hours = Number(match[1]);
  return `${((hours + 11) % 12) + 1}:${match[2]} ${hours >= 12 ? "PM" : "AM"}`;
}

function hydrateIcons(root = document) {
  $$('[data-icon]', root).forEach(node => { node.innerHTML = icon(node.dataset.icon); });
}

async function api(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(state.csrfToken && !["GET", "HEAD"].includes(method) ? { "X-Admin-CSRF": state.csrfToken } : {}),
      ...(options.headers || {})
    }
  });
  let payload;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    const error = new Error(payload?.error?.message || payload?.message || "The request could not be completed");
    error.code = payload?.error?.code || "REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }
  return payload?.data ?? payload;
}

function setButtonBusy(button, busy, text = "Please wait…") {
  if (!button) return;
  if (busy) {
    button.dataset.original = button.innerHTML;
    button.disabled = true;
    button.textContent = text;
  } else {
    button.disabled = false;
    if (button.dataset.original) button.innerHTML = button.dataset.original;
  }
}

function setError(selector, message = "") {
  const node = $(selector);
  if (!node) return;
  node.textContent = message;
  node.hidden = !message;
}

function toast(message, type = "success") {
  const node = $("#toast");
  node.textContent = message;
  node.classList.toggle("error", type === "error");
  node.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { node.hidden = true; }, 3600);
}

function showLogin(message = "") {
  $("#authShell").hidden = false;
  $("#portalShell").hidden = true;
  $("#loginForm").hidden = false;
  $("#passwordForm").hidden = true;
  setError("#loginError", message);
  setTimeout(() => $('#loginForm input[name="identifier"]')?.focus(), 40);
}

function showPasswordChange() {
  $("#authShell").hidden = false;
  $("#portalShell").hidden = true;
  $("#loginForm").hidden = true;
  $("#passwordForm").hidden = false;
  setTimeout(() => $('#passwordForm input[name="currentPassword"]')?.focus(), 40);
}

function enterPortal() {
  $("#authShell").hidden = true;
  $("#portalShell").hidden = false;
  $("#staffInitials").textContent = initials(state.staff?.fullName);
  $("#deskDate").value = state.date;
  populateDoctors();
  state.route = routeFromHash();
  loadWorkspace();
  clearInterval(state.liveTimer);
  state.liveTimer = setInterval(async () => {
    const activeElement = document.activeElement;
    const interacting = activeElement && activeElement !== document.body && activeElement.id !== "main";
    if (document.hidden || interacting || state.liveSyncBusy || !state.staff) return;
    state.liveSyncBusy = true;
    try { await loadWorkspace({ silent: true }); }
    finally { state.liveSyncBusy = false; }
  }, 6000);
}

function populateDoctors() {
  const select = $("#doctorSelect");
  select.innerHTML = state.doctors.length
    ? state.doctors.map(doctor => `<option value="${escapeHtml(doctor.id)}" ${doctor.id === state.doctorId ? "selected" : ""}>${escapeHtml(doctor.name)} · ${escapeHtml(doctor.clinic || doctor.specialty || "Clinic")}</option>`).join("")
    : `<option value="">No doctor assigned</option>`;
}

function routeFromHash() {
  const route = location.hash.replace(/^#\/?/, "").split("?")[0] || "dashboard";
  return ["dashboard", "appointments", "queue", "walk-in", "patients"].includes(route) ? route : "dashboard";
}

function navigate(route) {
  if (route === state.route && location.hash) return renderRoute();
  location.hash = `#/${route}`;
}

function updateChrome() {
  $$(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.route === state.route));
  const titles = { dashboard: "Clinic overview", appointments: "Appointments", queue: "Live token queue", "walk-in": "Register walk-in", patients: "Patient directory" };
  $("#pageTitle").textContent = titles[state.route];
  $("#todayLabel").textContent = displayDate(state.date);
  $("#sidebar").classList.remove("open");
}

function loadingMarkup() {
  return `<div class="loading"><span class="loader" aria-label="Loading clinic data"></span></div>`;
}

function emptyMarkup(title, copy, iconName = "calendar") {
  return `<div class="empty"><span>${icon(iconName)}</span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(copy)}</small></div>`;
}

async function loadWorkspace({ silent = false } = {}) {
  updateChrome();
  if (!state.doctors.length) {
    state.doctorId = "";
    state.dashboard = null;
    renderNoAssignment();
    return;
  }
  state.doctorId ||= state.doctors[0].id;
  $("#doctorSelect").value = state.doctorId;
  if (!silent) $("#main").innerHTML = loadingMarkup();
  try {
    state.dashboard = await api(`/receptionist/dashboard?doctorId=${encodeURIComponent(state.doctorId)}&date=${encodeURIComponent(state.date)}`);
    state.doctors = state.dashboard.doctors || state.doctors;
    if (state.route === "patients") await loadPatients(false);
    renderRoute();
  } catch (error) {
    if (["AUTH_REQUIRED", "SESSION_EXPIRED"].includes(error.code)) return showLogin("Your secure session expired. Please log in again.");
    if (!silent) $("#main").innerHTML = emptyMarkup("Clinic data unavailable", error.message, "shield");
  }
}

function renderNoAssignment() {
  updateChrome();
  $("#main").innerHTML = `<section class="no-assignment"><div><span>${icon("shield")}</span><h2>No clinic has been assigned yet</h2><p>Your account is secure, but the SehatLine Owner must assign at least one verified doctor before clinic data can be opened.</p><a class="button primary" href="mailto:support@sehatline.in?subject=Receptionist%20doctor%20assignment">Contact support</a></div></section>`;
}

function metricCard(iconName, value, label) {
  return `<article class="metric-card"><span class="metric-icon">${icon(iconName)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(label)}</small></article>`;
}

const money = value => `₹${Number(value || 0).toLocaleString("en-IN")}`;

function collectionMarkup(collections = {}) {
  return `<section class="collection-grid" aria-label="Today's clinic collections">
    <article class="collection-card online"><span>${icon("wallet")}</span><div><small>Online received</small><strong>${money(collections.onlineAmount)}</strong><em>${Number(collections.onlineCount || 0)} paid bookings</em></div></article>
    <article class="collection-card cash"><span>${icon("wallet")}</span><div><small>Cash collected</small><strong>${money(collections.cashAmount)}</strong><em>${Number(collections.cashCount || 0)} recorded at desk</em></div></article>
    <article class="collection-card due"><span>${icon("clock")}</span><div><small>Cash / payment due</small><strong>${money(collections.dueAmount)}</strong><em>${Number(collections.dueCount || 0)} appointments</em></div></article>
    <article class="collection-card total"><span>${icon("chart")}</span><div><small>Total collected</small><strong>${money(collections.collectedAmount)}</strong><em>Online + received cash</em></div></article>
  </section>`;
}

function appointmentRow(appointment, compact = false) {
  const status = normalizeStatus(appointment.status);
  const checkinAvailable = ["confirmed", "pending"].includes(status);
  return `<div class="appointment-row">
    <span class="appointment-time"><strong>${escapeHtml(displayTime(appointment.time))}</strong><small>${escapeHtml(appointment.token || "No token")}</small></span>
    <span class="patient-name"><strong>${escapeHtml(appointment.name || appointment.patientName || "Patient")}</strong><small>${escapeHtml(appointment.phone || "Mobile not provided")}</small></span>
    <span class="appointment-reason"><strong>${escapeHtml(appointment.reason || "Consultation")}</strong><small>${escapeHtml(appointment.type || "Clinic visit")}</small><i class="payment-label ${appointment.paymentStatus === "paid" ? "paid" : "due"}">${appointment.paymentMode === "online" ? "Online" : "Cash"} · ${appointment.paymentStatus === "paid" ? `${money(appointment.amount)} paid` : `${money(appointment.amount)} due`}</i></span>
    <span class="appointment-status"><i class="status ${status}">${escapeHtml(status.replaceAll("-", " "))}</i></span>
    <span class="row-actions">
      ${checkinAvailable ? `<button class="button small primary" data-appointment-status="checked-in" data-id="${escapeHtml(appointment.id)}"><span>Check in</span>${icon("check")}</button>` : ""}
      ${appointment.paymentMode === "cash" && appointment.paymentStatus !== "paid" ? `<button class="button small cash-button" data-cash-received data-id="${escapeHtml(appointment.id)}"><span>Cash received</span>${icon("wallet")}</button>` : ""}
      ${!["completed", "cancelled", "no-show"].includes(status) ? `<button class="button small danger" data-appointment-status="no-show" data-id="${escapeHtml(appointment.id)}" aria-label="Mark no-show">${icon("x")}</button>` : ""}
    </span>
  </div>`;
}

function queueItem(item, index) {
  const arrived = item.checkedIn !== false;
  return `<div class="queue-item"><span class="token">${escapeHtml(item.token)}</span><span><strong>${escapeHtml(item.name || "Patient")}</strong><small>${escapeHtml(item.reason || "Consultation")} · ${Math.max(0, Number(item.wait || 0))} min estimate</small></span><span class="arrival ${arrived ? "" : "not"}">${arrived ? "Checked in" : "Not arrived"}</span></div>`;
}

function renderDashboard() {
  const data = state.dashboard;
  const queue = data.queue || {};
  const metrics = data.metrics || {};
  const current = queue.current;
  $("#main").innerHTML = `
    <section class="clinic-hero"><div class="clinic-hero-copy"><span class="status ${normalizeStatus(queue.status)}">${escapeHtml(queue.status || "closed")}</span><h2>${escapeHtml(data.doctor.name)}</h2><p>${escapeHtml(data.doctor.specialty || "Doctor")} · ${escapeHtml(data.doctor.clinic || "Clinic")} · ${escapeHtml(data.doctor.address || data.doctor.city || "")}</p><div class="head-actions" style="margin-top:17px"><button class="button primary" data-route="walk-in">${icon("user-plus")} Register walk-in</button><button class="button" data-route="queue">${icon("activity")} Manage queue</button></div></div><div class="queue-orb"><span><strong>${escapeHtml(queue.currentToken || "—")}</strong><small>Now serving</small></span></div></section>
    <section class="metric-grid">
      ${metricCard("calendar", metrics.totalAppointments || 0, "Today's appointments")}
      ${metricCard("check", metrics.checkedIn || 0, "Checked in")}
      ${metricCard("clock", metrics.waiting || 0, "Waiting now")}
      ${metricCard("shield", metrics.completed || 0, "Completed")}
      ${metricCard("ticket", metrics.remainingTokens || 0, "Tokens remaining")}
    </section>
    ${collectionMarkup(data.collections)}
    <section class="dashboard-grid">
      <article class="panel"><div class="panel-head"><div><h3>Today’s appointments</h3><p>Real bookings for the selected doctor and date</p></div><button class="button small" data-route="appointments">View all ${icon("arrow")}</button></div><div class="appointment-list">${data.appointments?.length ? data.appointments.slice(0, 6).map(item => appointmentRow(item, true)).join("") : emptyMarkup("No appointments yet", "Bookings and walk-ins will appear here.")}</div></article>
      <article class="panel"><div class="panel-head"><div><h3>Live queue</h3><p>${queue.waiting?.length || 0} patients waiting</p></div><i class="status ${normalizeStatus(queue.status)}">${escapeHtml(queue.status || "closed")}</i></div><div class="queue-panel-body"><div class="current-token"><span class="token">${escapeHtml(queue.currentToken || "—")}</span><span><strong>${escapeHtml(current?.name || "No patient called")}</strong><small>${escapeHtml(current?.reason || "Start the queue when the clinic is ready")}</small></span></div><div class="queue-list">${queue.waiting?.length ? queue.waiting.slice(0, 5).map(queueItem).join("") : emptyMarkup("Queue is clear", "Checked-in patients will appear here.", "activity")}</div></div></article>
    </section>`;
}

function renderAppointments() {
  const appointments = state.dashboard?.appointments || [];
  $("#main").innerHTML = `<div class="page-head"><div><p class="eyebrow">PATIENT ARRIVALS</p><h2>Appointments</h2><p>Check patients in and keep the doctor’s real token queue accurate.</p></div><div class="head-actions"><button class="button" data-refresh>${icon("refresh")} Refresh</button><button class="button primary" data-route="walk-in">${icon("user-plus")} Add walk-in</button></div></div>
    ${collectionMarkup(state.dashboard?.collections)}<section class="panel"><div class="panel-head"><div><h3>${escapeHtml(displayDate(state.date))}</h3><p>${appointments.length} appointments found</p></div><label class="search-box">${icon("search")}<input id="appointmentSearch" placeholder="Search patient, phone or token"></label></div><div class="appointment-list" id="appointmentResults">${appointments.length ? appointments.map(appointmentRow).join("") : emptyMarkup("No appointments", "The doctor has no bookings for this date.")}</div></section>`;
}

function renderQueue() {
  const queue = state.dashboard?.queue || {};
  const current = queue.current;
  $("#main").innerHTML = `<div class="page-head"><div><p class="eyebrow">LIVE CLINIC OPERATIONS</p><h2>Token queue</h2><p>Only call checked-in patients. All queue actions are recorded.</p></div><div class="head-actions"><button class="button" data-refresh>${icon("refresh")} Refresh</button><button class="button primary" data-queue-action="${queue.status === "live" ? "pause" : queue.status === "paused" ? "resume" : "start"}">${icon(queue.status === "live" ? "pause" : "play")} ${queue.status === "live" ? "Pause" : queue.status === "paused" ? "Resume" : "Start queue"}</button></div></div>
    <section class="dashboard-grid"><article class="panel"><div class="panel-head"><div><h3>Waiting patients</h3><p>${queue.waiting?.length || 0} tokens in queue</p></div><i class="status ${normalizeStatus(queue.status)}">${escapeHtml(queue.status || "closed")}</i></div><div class="queue-panel-body"><div class="current-token"><span class="token">${escapeHtml(queue.currentToken || "—")}</span><span><strong>${escapeHtml(current?.name || "No patient called")}</strong><small>${escapeHtml(current?.reason || "Use Call next patient when ready")}</small></span></div><div class="queue-list">${queue.waiting?.length ? queue.waiting.map(queueItem).join("") : emptyMarkup("No patients waiting", "Check in an appointment or register a walk-in.", "activity")}</div></div></article>
    <aside class="panel"><div class="panel-head"><div><h3>Queue controls</h3><p>Front-desk operations</p></div></div><div class="queue-panel-body"><div class="queue-actions"><button class="button primary" data-queue-action="next">${icon("next")} Call next checked-in patient</button><button class="button" data-queue-action="notify">${icon("bell")} Notify queue</button><button class="button danger" data-queue-action="close">${icon("x")} Close queue</button></div><div class="queue-delay"><input id="delayMinutes" type="number" min="0" max="180" value="${Number(queue.delayMinutes || 0)}" aria-label="Delay minutes"><button class="button warn" data-queue-action="delay">Set delay</button></div><p class="muted">Daily capacity: ${Number(queue.capacity || 0)} · Issued: ${Number(queue.issued || 0)} · Remaining: ${Math.max(0, Number(queue.capacity || 0) - Number(queue.issued || 0))}</p></div></aside></section>`;
}

function renderWalkIn() {
  const result = state.walkinResult;
  $("#main").innerHTML = `<div class="page-head"><div><p class="eyebrow">FRONT-DESK REGISTRATION</p><h2>New walk-in patient</h2><p>The next real token and available slot will be assigned automatically.</p></div></div>
    ${result ? `<div class="walkin-success"><strong>${escapeHtml(result.token)}</strong><p>${escapeHtml(result.patientName)} is checked in for ${escapeHtml(displayTime(result.time))}.</p><div class="head-actions" style="justify-content:center"><button class="button primary" data-new-walkin>Register another</button><button class="button" data-route="queue">Open live queue</button></div></div>` : `<section class="walkin-layout"><form class="panel walkin-form" id="walkinForm"><div class="form-grid"><div class="field full"><label>Patient full name *</label><input name="patientName" autocomplete="name" required minlength="3" placeholder="As stated by the patient"></div><div class="field"><label>Mobile number *</label><input name="patientPhone" inputmode="numeric" autocomplete="tel" required pattern="[0-9]{10}" maxlength="10" placeholder="10-digit number"></div><div class="field"><label>Age</label><input name="patientAge" type="number" min="0" max="120" placeholder="Age in years"></div><div class="field"><label>Gender</label><select name="patientGender"><option>Not specified</option><option>Female</option><option>Male</option><option>Other</option></select></div><div class="field"><label>Visit date</label><input name="date" type="date" value="${escapeHtml(state.date)}" required></div><div class="field full"><label>Reason for visit</label><textarea name="reason" maxlength="300" placeholder="Short concern for the doctor"></textarea></div><div class="field full"><button class="primary-button" id="walkinButton" type="submit">Generate live token ${icon("ticket")}</button></div></div></form><aside class="panel walkin-note"><span class="auth-icon">${icon("shield")}</span><h3>Safe clinic registration</h3><p>This form creates a real appointment in the selected doctor’s published schedule.</p><ul><li>No token is issued beyond the doctor’s daily limit.</li><li>The next available time slot is selected automatically.</li><li>Patient details stay within the assigned clinic workspace.</li><li>Every creation is attached to your staff account.</li></ul></aside></section>`}`;
}

function renderPatients() {
  $("#main").innerHTML = `<div class="page-head"><div><p class="eyebrow">ASSIGNED CLINIC ONLY</p><h2>Patient directory</h2><p>Search people already registered with this doctor.</p></div></div><section class="panel"><div class="panel-head"><div><h3>Clinic patients</h3><p>${state.patients.length} records shown</p></div><label class="search-box">${icon("search")}<input id="patientSearch" value="${escapeHtml(state.patientQuery)}" placeholder="Name, mobile or concern"></label></div><div class="patient-list">${state.patients.length ? state.patients.map(patient => `<article class="patient-card"><span class="patient-avatar">${escapeHtml(initials(patient.name))}</span><span><strong>${escapeHtml(patient.name)}</strong><small>${escapeHtml(patient.phone || "No phone")}</small></span><span><strong>${Number(patient.age || 0) || "—"}</strong><small>Age</small></span><span><strong>${Number(patient.visits || 0)}</strong><small>Visits</small></span><span><strong>${escapeHtml(patient.concern || "Consultation")}</strong><small>Latest concern</small></span></article>`).join("") : emptyMarkup("No patients found", "Patients will appear after appointments or walk-ins are created.", "users")}</div></section>`;
}

function renderRoute() {
  updateChrome();
  if (!state.dashboard) return renderNoAssignment();
  const renderers = { dashboard: renderDashboard, appointments: renderAppointments, queue: renderQueue, "walk-in": renderWalkIn, patients: renderPatients };
  renderers[state.route]();
  hydrateIcons($("#main"));
  window.SehatMotion?.enhance($("#main"));
  $("#main").focus({ preventScroll: true });
}

async function loadPatients(render = true) {
  state.patients = await api(`/receptionist/patients?doctorId=${encodeURIComponent(state.doctorId)}&q=${encodeURIComponent(state.patientQuery)}`);
  if (render) renderPatients();
}

async function updateAppointment(id, status) {
  try {
    await api(`/receptionist/appointments/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ doctorId: state.doctorId, date: state.date, status }) });
    toast(status === "checked-in" ? "Patient checked in and queue updated" : `Appointment marked ${status}`);
    await loadWorkspace();
  } catch (error) { toast(error.message, "error"); }
}

async function markCashReceived(id) {
  try {
    await api(`/receptionist/appointments/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ doctorId: state.doctorId, date: state.date, paymentStatus: "paid" }) });
    toast("Cash payment recorded and synced to the doctor");
    await loadWorkspace();
  } catch (error) { toast(error.message, "error"); }
}

async function queueAction(action) {
  const payload = { doctorId: state.doctorId, date: state.date };
  if (action === "delay") payload.delayMinutes = Math.max(0, Number($("#delayMinutes")?.value || 0));
  try {
    await api(`/receptionist/queue/${action}`, { method: "POST", body: JSON.stringify(payload) });
    toast(action === "next" ? "Next checked-in patient called" : `Queue ${action} updated`);
    await loadWorkspace();
  } catch (error) { toast(error.message, "error"); }
}

document.addEventListener("click", async event => {
  const routeButton = event.target.closest("[data-route]");
  if (routeButton) { event.preventDefault(); navigate(routeButton.dataset.route); return; }
  const toggle = event.target.closest("[data-toggle-password]");
  if (toggle) { const input = $(`#${toggle.dataset.togglePassword}`); input.type = input.type === "password" ? "text" : "password"; toggle.textContent = input.type === "password" ? "Show" : "Hide"; return; }
  const statusButton = event.target.closest("[data-appointment-status]");
  if (statusButton) return updateAppointment(statusButton.dataset.id, statusButton.dataset.appointmentStatus);
  const cashButton = event.target.closest("[data-cash-received]");
  if (cashButton) return markCashReceived(cashButton.dataset.id);
  const queueButton = event.target.closest("[data-queue-action]");
  if (queueButton) return queueAction(queueButton.dataset.queueAction);
  if (event.target.closest("[data-refresh]")) return loadWorkspace();
  if (event.target.closest("[data-new-walkin]")) { state.walkinResult = null; return renderWalkIn(); }
});

$("#loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  setError("#loginError");
  const button = $("#loginButton");
  const formData = new FormData(event.currentTarget);
  setButtonBusy(button, true, "Verifying access…");
  try {
    const result = await api("/admin/auth/login", { method: "POST", body: JSON.stringify({ identifier: formData.get("identifier"), password: formData.get("password"), remember: formData.get("remember") === "on" }) });
    state.csrfToken = result.csrfToken;
    state.staff = result.admin;
    if (!["receptionist", "super_admin"].includes(result.admin.role)) {
      await api("/admin/auth/logout", { method: "POST", body: "{}" }).catch(() => {});
      state.csrfToken = "";
      throw new Error("This account is not approved for the Receptionist Portal");
    }
    if (result.mustChangePassword) showPasswordChange();
    else await restoreSession();
  } catch (error) { setError("#loginError", error.message); }
  finally { setButtonBusy(button, false); }
});

$("#passwordForm").addEventListener("submit", async event => {
  event.preventDefault();
  setError("#passwordError");
  const data = new FormData(event.currentTarget);
  const next = String(data.get("newPassword") || "");
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])\S{8,128}$/.test(next)) return setError("#passwordError", "Use uppercase, lowercase, number and a special character.");
  if (next !== data.get("confirmPassword")) return setError("#passwordError", "New passwords do not match.");
  const button = $("#passwordButton");
  setButtonBusy(button, true, "Securing account…");
  try {
    await api("/receptionist/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword: data.get("currentPassword"), newPassword: next }) });
    event.currentTarget.reset(); state.csrfToken = ""; state.staff = null; showLogin("Password updated. Sign in with your new password.");
  } catch (error) { setError("#passwordError", error.message); }
  finally { setButtonBusy(button, false); }
});

$("#walkinForm")?.addEventListener?.("submit", () => {});

document.addEventListener("submit", async event => {
  if (event.target.id !== "walkinForm") return;
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  const button = $("#walkinButton");
  setButtonBusy(button, true, "Creating live token…");
  try {
    state.walkinResult = await api("/receptionist/walk-ins", { method: "POST", body: JSON.stringify({ ...data, doctorId: state.doctorId }) });
    toast(`Token ${state.walkinResult.token} created securely`);
    await loadWorkspace();
    state.route = "walk-in";
    renderWalkIn();
  } catch (error) { toast(error.message, "error"); setButtonBusy(button, false); }
});

document.addEventListener("input", event => {
  if (event.target.id === "appointmentSearch") {
    const query = event.target.value.toLowerCase();
    const matches = (state.dashboard?.appointments || []).filter(item => `${item.name} ${item.phone} ${item.token} ${item.reason}`.toLowerCase().includes(query));
    $("#appointmentResults").innerHTML = matches.length ? matches.map(appointmentRow).join("") : emptyMarkup("No matching appointments", "Try another patient name, phone or token.", "search");
  }
  if (event.target.id === "patientSearch") {
    state.patientQuery = event.target.value;
    clearTimeout(state.patientTimer);
    state.patientTimer = setTimeout(() => loadPatients().catch(error => toast(error.message, "error")), 280);
  }
});

$("#doctorSelect").addEventListener("change", event => { state.doctorId = event.target.value; state.walkinResult = null; loadWorkspace(); });
$("#deskDate").addEventListener("change", event => { state.date = event.target.value || localDateKey(); state.walkinResult = null; loadWorkspace(); });
$("#menuButton").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
$("#profileButton").addEventListener("click", () => toast(`${state.staff?.fullName} · ${state.staff?.adminId}`));
$("#logoutButton").addEventListener("click", async () => { try { await api("/receptionist/auth/logout", { method: "POST", body: "{}" }); } catch {} clearInterval(state.liveTimer); state.csrfToken = ""; state.staff = null; showLogin("You have been logged out securely."); });
window.addEventListener("hashchange", () => { state.route = routeFromHash(); renderRoute(); window.scrollTo({ top: 0, behavior: "smooth" }); });

async function restoreSession() {
  try {
    const result = await api("/receptionist/auth/me");
    state.staff = result.staff;
    state.csrfToken = result.csrfToken;
    state.doctors = result.doctors || [];
    state.doctorId = state.doctors.some(doctor => doctor.id === state.doctorId) ? state.doctorId : state.doctors[0]?.id || "";
    if (state.staff.mustChangePassword) showPasswordChange();
    else enterPortal();
  } catch (error) { showLogin(error.code === "SESSION_EXPIRED" ? "Your secure session expired. Please log in again." : ""); }
}

hydrateIcons();
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("./sw.js").catch(() => {});
restoreSession();
