const API_BASE = `${location.protocol === "file:" ? "http://localhost:4000" : ""}/api`;

const fallback = {
  overview: {
    users: 148,
    doctors: 0,
    labs: 5,
    bookings: 326,
    pendingDoctors: 0,
    pendingLabs: 1,
    revenue: 168450
  },
  doctors: [],
  labs: [
    { id: "lab-1", name: "HealthFirst Diagnostics", location: "Kankarbagh", rating: 4.8, status: "verified", homeCollection: true, tests: [{ name: "Thyroid Profile", price: 499 }, { name: "CBC", price: 299 }] },
    { id: "lab-2", name: "Nova PathLabs", location: "Boring Road", rating: 4.7, status: "verified", homeCollection: true, tests: [{ name: "Thyroid Profile", price: 449 }, { name: "Vitamin D", price: 799 }] },
    { id: "lab-3", name: "CityCare Labs", location: "Rajendra Nagar", rating: 4.5, status: "pending", homeCollection: false, tests: [{ name: "CBC", price: 249 }, { name: "HbA1c", price: 399 }] },
    { id: "lab-4", name: "Precision Diagnostics", location: "Bailey Road", rating: 4.9, status: "verified", homeCollection: true, tests: [{ name: "Full Body Checkup", price: 1499 }] }
  ],
  bookings: [
    { id: "SL-24071", patientName: "Aarav Kumar", doctorName: "Dr. Meera Sharma", date: "2026-07-25", time: "10:30 AM", amount: 500, status: "confirmed", type: "Clinic" },
    { id: "SL-24072", patientName: "Riya Sinha", doctorName: "Dr. Sana Khan", date: "2026-07-25", time: "11:15 AM", amount: 450, status: "pending", type: "Clinic" },
    { id: "SL-24073", patientName: "Imran Ali", doctorName: "Dr. Arjun Verma", date: "2026-07-25", time: "12:00 PM", amount: 800, status: "completed", type: "Clinic" },
    { id: "SL-24074", patientName: "Neha Gupta", doctorName: "HealthFirst Diagnostics", date: "2026-07-26", time: "07:30 AM", amount: 499, status: "confirmed", type: "Home collection" },
    { id: "SL-24075", patientName: "Dev Raj", doctorName: "Dr. Rohan Singh", date: "2026-07-26", time: "04:00 PM", amount: 600, status: "cancelled", type: "Clinic" },
    { id: "SL-24076", patientName: "Kavya Jha", doctorName: "Nova PathLabs", date: "2026-07-27", time: "08:00 AM", amount: 799, status: "confirmed", type: "Home collection" }
  ],
  users: [
    { id: "u1", name: "Aarav Kumar", phone: "+91 98765 43021", bookings: 4, lastActive: "2 min ago" },
    { id: "u2", name: "Riya Sinha", phone: "+91 91234 56102", bookings: 2, lastActive: "12 min ago" },
    { id: "u3", name: "Imran Ali", phone: "+91 99881 22034", bookings: 7, lastActive: "1 hour ago" },
    { id: "u4", name: "Neha Gupta", phone: "+91 88990 11442", bookings: 3, lastActive: "Yesterday" }
  ],
  notifications: [
    { id: "n1", title: "Appointment confirmed", message: "Your appointment with Dr. Meera Sharma is confirmed.", audience: "Single patient", createdAt: "2026-07-25T14:20:00" },
    { id: "n2", title: "Free home collection", message: "Book a thyroid profile this weekend and save 15%.", audience: "All patients", createdAt: "2026-07-25T10:00:00" },
    { id: "n3", title: "Doctor running 15 min late", message: "Your live token estimate has been updated.", audience: "Queue patients", createdAt: "2026-07-24T16:40:00" }
  ]
};

const state = {
  overview: fallback.overview,
  doctors: fallback.doctors,
  labs: fallback.labs,
  bookings: fallback.bookings,
  users: fallback.users,
  notifications: fallback.notifications,
  doctorFilter: "all",
  labFilter: "all",
  searches: { doctors: "", labs: "", bookings: "", users: "" },
  bookingStatus: "all",
  modalType: null,
  modalMode: "create",
  modalEntityId: null,
  modalBusy: false
};

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
const initials = name => name.replace(/^Dr\.\s*/i, "").split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
const money = value => new Intl.NumberFormat("en-IN").format(Number(value || 0));
const displayDate = value => {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload?.data ?? payload;
}

function unwrapList(value, keys = []) {
  if (Array.isArray(value)) return value;
  for (const key of keys) if (Array.isArray(value?.[key])) return value[key];
  return [];
}

async function loadData() {
  const requests = await Promise.allSettled([
    api("/admin/overview"),
    api("/doctors?includePending=true"),
    api("/labs?includePending=true"),
    api("/bookings"),
    api("/users"),
    api("/notifications")
  ]);
  if (requests[0].status === "fulfilled") state.overview = { ...state.overview, ...requests[0].value };
  if (requests[1].status === "fulfilled") state.doctors = unwrapList(requests[1].value, ["doctors", "items"]);
  if (requests[2].status === "fulfilled") state.labs = unwrapList(requests[2].value, ["labs", "items"]);
  if (requests[3].status === "fulfilled") state.bookings = unwrapList(requests[3].value, ["bookings", "items"]);
  if (requests[4].status === "fulfilled" && unwrapList(requests[4].value, ["users", "items"]).length) state.users = unwrapList(requests[4].value, ["users", "items"]);
  if (requests[5].status === "fulfilled") state.notifications = unwrapList(requests[5].value, ["notifications", "items"]);
  renderAll();
}

function renderAll() {
  renderOverview();
  renderDoctors();
  renderLabs();
  renderBookings();
  renderUsers();
  renderAnalytics();
  renderNotifications();
}

function normalizeOverview() {
  const o = state.overview || {};
  return {
    users: o.users ?? o.totalUsers ?? fallback.overview.users,
    doctors: o.doctors ?? o.totalDoctors ?? state.doctors.filter(item => item.status === "verified" || item.verified).length,
    labs: o.labs ?? o.totalLabs ?? state.labs.length,
    bookings: o.bookings ?? o.totalBookings ?? state.bookings.length,
    pendingDoctors: o.pendingDoctors ?? state.doctors.filter(item => item.status === "pending" || item.verified === false).length,
    pendingLabs: o.pendingLabs ?? state.labs.filter(item => item.status === "pending" || item.verified === false).length,
    revenue: o.revenue ?? o.grossBookingValue ?? state.bookings.reduce((sum, item) => sum + Number(item.amount || item.fee || 0), 0)
  };
}

function renderOverview() {
  const metrics = normalizeOverview();
  Object.entries(metrics).forEach(([key, value]) => {
    $$(`[data-metric="${key}"]`).forEach(node => node.textContent = key === "revenue" ? money(value) : value);
  });
  $("#doctorBadge").textContent = metrics.pendingDoctors;
  $("#labBadge").textContent = metrics.pendingLabs;
  $("#liveBookings").textContent = Math.max(8, Math.round(metrics.bookings * .07));

  const weekly = [
    ["Mon", 42, 55], ["Tue", 58, 64], ["Wed", 51, 70], ["Thu", 76, 69],
    ["Fri", 82, 91], ["Sat", 68, 78], ["Sun", 47, 57]
  ];
  $("#activityChart").innerHTML = weekly.map(([day, bookings, revenue]) => `
    <div class="bar-group">
      <i class="bar booking" style="height:${bookings}%"></i>
      <i class="bar revenue" style="height:${revenue}%"></i>
      <span class="bar-label">${day}</span>
    </div>`).join("");

  const pending = [
    ...state.doctors.filter(item => getStatus(item) === "pending").map(item => ({ ...item, type: "Doctor" })),
    ...state.labs.filter(item => getStatus(item) === "pending").map(item => ({ ...item, type: "PathLab" }))
  ].slice(0, 4);
  $("#pendingList").innerHTML = pending.length ? pending.map(item => `
    <div class="compact-item">
      <span class="entity-avatar ${item.type === "PathLab" ? "lab" : ""}">${initials(item.name)}</span>
      <div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.specialty || item.location || "Partner")} · ${item.type}</small></div>
      <button class="mini-button" data-verify="${item.type}:${item.id}">Review</button>
    </div>`).join("") : `<div class="empty-state">All caught up. No pending partners.</div>`;

  $("#activityFeed").innerHTML = [
    ["✓", "A booking was confirmed with Dr. Meera Sharma", "4 min ago"],
    ["✚", "A new pediatrician submitted verification", "18 min ago"],
    ["⌬", "Nova PathLabs updated thyroid test pricing", "42 min ago"],
    ["◇", "A report-ready notification was delivered", "1 hour ago"]
  ].map(([icon, text, time]) => `
    <div class="timeline-item"><span class="timeline-icon">${icon}</span><div><p>${text}</p><small>SehatLine operations</small></div><small>${time}</small></div>
  `).join("");
}

function getStatus(item) {
  if (item.status) return String(item.status).toLowerCase();
  if (item.verified === true) return "verified";
  if (item.verified === false) return "pending";
  return "verified";
}

function renderDoctors() {
  const term = state.searches.doctors.toLowerCase();
  const rows = state.doctors.filter(item => {
    const matchesTerm = `${item.name} ${item.specialty} ${item.specialization || ""} ${item.location || ""} ${item.city || ""} ${item.registrationNumber || item.licenseNumber || ""}`.toLowerCase().includes(term);
    const matchesFilter = state.doctorFilter === "all" || getStatus(item) === state.doctorFilter;
    return matchesTerm && matchesFilter;
  });
  $("#doctorRows").innerHTML = rows.length ? rows.map(item => `
    <div class="table-row">
      <span class="doctor-cell"><i class="entity-avatar">${initials(item.name)}</i><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.qualification || `${item.experience || 0} years experience`)}</small></span></span>
      <span>${escapeHtml(item.specialty || item.specialization || "General Physician")}</span>
      <span class="registration-cell"><strong>${escapeHtml(item.registrationNumber || item.licenseNumber || "Not provided")}</strong><small>${escapeHtml(item.registrationCouncil || item.council || item.medicalCouncil || "Council pending")}</small></span>
      <strong>₹${money(item.fee || item.consultationFee)}</strong>
      <span class="badge ${getStatus(item)}">${getStatus(item)}</span>
      <span class="row-actions">
        <button class="review-button" data-doctor-action="${getStatus(item) === "verified" ? "edit" : "review"}" data-id="${escapeHtml(item.id)}">
          ${getStatus(item) === "verified" ? "Edit" : "Review"}
        </button>
      </span>
    </div>`).join("") : `<div class="empty-state">No doctors match this view.</div>`;
}

function renderLabs() {
  const term = state.searches.labs.toLowerCase();
  const labs = state.labs.filter(item => {
    const matchesTerm = `${item.name} ${item.location || item.address || ""}`.toLowerCase().includes(term);
    return matchesTerm && (state.labFilter === "all" || getStatus(item) === state.labFilter);
  });
  $("#labGrid").innerHTML = labs.length ? labs.map(item => {
    const tests = item.tests || [];
    const lowest = tests.length ? Math.min(...tests.map(test => Number(test.price || 0))) : 0;
    return `<article class="lab-card">
      <div class="lab-head">
        <span class="entity-avatar lab">${initials(item.name)}</span>
        <div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.location || item.address || "Launch city")}</p></div>
        <span class="badge ${getStatus(item)}">${getStatus(item)}</span>
      </div>
      <div class="lab-meta"><span>★ ${Number(item.rating || 0).toFixed(1)}</span><span>${item.homeCollection ? "⌂ Home collection" : "Walk-in"}</span><span>${item.accreditation || "Quality checked"}</span></div>
      <div class="lab-footer"><div><strong>${tests.length} tests listed</strong><small>${lowest ? `from ₹${money(lowest)}` : "Pricing being added"}</small></div>
      <span class="row-actions">${getStatus(item) === "pending" ? `<button data-lab-action="verify" data-id="${item.id}" title="Verify">✓</button>` : ""}<button data-lab-action="edit" data-id="${item.id}" title="Edit">✎</button></span></div>
    </article>`;
  }).join("") : `<div class="empty-state">No PathLabs match this view.</div>`;
}

function bookingProvider(item) {
  return item.doctorName || item.providerName || state.doctors.find(doctor => doctor.id === item.doctorId)?.name || "SehatLine partner";
}

function renderBookings() {
  const counts = { confirmed: 0, pending: 0, completed: 0, cancelled: 0 };
  state.bookings.forEach(item => counts[String(item.status || "pending").toLowerCase()] = (counts[String(item.status || "pending").toLowerCase()] || 0) + 1);
  Object.entries(counts).forEach(([status, count]) => $(`#${status}Count`).textContent = count);
  const term = state.searches.bookings.toLowerCase();
  const bookings = state.bookings.filter(item => {
    const status = String(item.status || "pending").toLowerCase();
    const haystack = `${item.id} ${item.patientName || ""} ${bookingProvider(item)}`.toLowerCase();
    return haystack.includes(term) && (state.bookingStatus === "all" || status === state.bookingStatus);
  });
  $("#bookingRows").innerHTML = bookings.length ? bookings.map(item => {
    const status = String(item.status || "pending").toLowerCase();
    return `<div class="table-row">
      <strong>#${escapeHtml(item.id)}</strong>
      <span class="doctor-cell"><i class="entity-avatar">${initials(item.patientName || "Patient")}</i><span><strong>${escapeHtml(item.patientName || "Patient")}</strong><small>${escapeHtml(item.type || item.mode || "Clinic")}</small></span></span>
      <span>${escapeHtml(bookingProvider(item))}</span>
      <span>${displayDate(item.date || item.scheduledAt)} · ${escapeHtml(item.time || "")}</span>
      <strong>₹${money(item.amount || item.fee)}</strong>
      <button class="badge ${status}" data-booking-id="${item.id}">${status}</button>
    </div>`;
  }).join("") : `<div class="empty-state">No bookings match this view.</div>`;
}

function renderUsers() {
  const term = state.searches.users.toLowerCase();
  const users = state.users.filter(item => `${item.name} ${item.phone || ""}`.toLowerCase().includes(term));
  $("#userGrid").innerHTML = users.length ? users.map(item => `
    <article class="person-card">
      <span class="entity-avatar">${initials(item.name)}</span>
      <div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.phone || "Phone verified")}</small></div>
      <small><b>${item.bookings || 0}</b> bookings<br>${escapeHtml(item.lastActive || "Recently active")}</small>
    </article>`).join("") : `<div class="empty-state">No users found.</div>`;
}

function renderAnalytics() {
  const specialties = [
    ["General Physician", 92], ["Dermatologist", 78], ["Pediatrician", 66],
    ["Gynecologist", 54], ["Orthopedist", 42]
  ];
  $("#specialtyBars").innerHTML = specialties.map(([name, value]) => `
    <div class="h-bar"><span>${name}</span><span class="h-bar-track"><i style="width:${value}%"></i></span><strong>${value}</strong></div>`).join("");
}

function renderNotifications() {
  $("#notificationList").innerHTML = state.notifications.length ? state.notifications.map(item => `
    <article class="notification-item">
      <span class="timeline-icon">◇</span>
      <div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.message)}</small></div>
      <small>${escapeHtml(item.audience || "Patients")}<br>${displayDate(item.createdAt)}</small>
    </article>`).join("") : `<div class="empty-state">No notifications sent yet.</div>`;
}

const viewMeta = {
  overview: ["Operations overview", "Good evening, Admin"],
  doctors: ["Partner network", "Doctor management"],
  labs: ["Diagnostics network", "PathLab management"],
  bookings: ["Care operations", "Booking management"],
  users: ["Community", "User management"],
  analytics: ["City intelligence", "Performance analytics"],
  notifications: ["Patient engagement", "Notification center"]
};

function switchView(view) {
  const safeView = viewMeta[view] ? view : "overview";
  $$(".view").forEach(node => node.classList.toggle("active", node.id === `view-${safeView}`));
  $$(".nav-item").forEach(node => node.classList.toggle("active", node.dataset.view === safeView));
  $("#pageEyebrow").textContent = viewMeta[safeView][0];
  $("#pageTitle").textContent = viewMeta[safeView][1];
  $("#sidebar").classList.remove("open");
  history.replaceState(null, "", `#${safeView}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

const valueForInput = value => escapeHtml(Array.isArray(value) ? value.join(", ") : value ?? "");

function safeDocumentUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function doctorDocument(doctor, key, aliases = {}) {
  const document = doctor.documents?.[key] || doctor.verification?.documents?.[key] || {};
  return {
    name: document.name || doctor[aliases.name] || "",
    url: document.url || doctor[aliases.url] || ""
  };
}

function documentReviewField(label, nameKey, urlKey, document) {
  const viewUrl = safeDocumentUrl(document.url);
  return `
    <div class="document-review-card full">
      <div class="document-review-heading">
        <span><b>${escapeHtml(label)}</b><small>Private · Admin verification only</small></span>
        ${viewUrl ? `<a class="document-review-link" href="${escapeHtml(viewUrl)}" target="_blank" rel="noopener noreferrer">View document ↗</a>` : `<em>No valid document link</em>`}
      </div>
      <div class="document-review-inputs">
        <div class="field"><label>Document name <b>*</b></label><input required name="${nameKey}" value="${valueForInput(document.name)}" placeholder="${escapeHtml(label)}"></div>
        <div class="field"><label>Secure document URL <b>*</b></label><input required type="url" name="${urlKey}" value="${valueForInput(document.url)}" placeholder="https://secure-view-link.example"></div>
      </div>
    </div>`;
}

function doctorFormFields(doctor = {}, mode = "create") {
  const status = getStatus(doctor);
  const registrationCertificate = doctorDocument(doctor, "registrationCertificate", {
    name: "registrationCertificateName",
    url: "registrationCertificateUrl"
  });
  if (!registrationCertificate.url) {
    registrationCertificate.url = doctor.registrationDocumentUrl || doctor.licenseDocumentUrl || "";
  }
  const degreeCertificate = doctorDocument(doctor, "degreeCertificate", {
    name: "degreeCertificateName",
    url: "degreeCertificateUrl"
  });
  const photoId = doctorDocument(doctor, "photoId", {
    name: "photoIdName",
    url: "photoIdUrl"
  });
  const reviewSummary = mode === "create" ? `
    <div class="verification-note">
      <span class="verification-icon">✓</span>
      <div><strong>Verification is mandatory</strong><p>This profile will stay hidden from patients until an admin checks the medical registration and approves it.</p></div>
    </div>` : `
    <div class="review-summary">
      <div><span class="review-label">Application status</span><span class="badge ${status}">${status}</span></div>
      <div><span class="review-label">Application ID</span><strong>${escapeHtml(doctor.id || "—")}</strong></div>
      <div><span class="review-label">Last updated</span><strong>${escapeHtml(displayDate(doctor.updatedAt || doctor.createdAt || "")) || "—"}</strong></div>
    </div>`;

  return `${reviewSummary}
    <div class="form-section-heading">
      <div><span>01</span><strong>Personal & professional details</strong></div>
      <p>Use the details exactly as they appear on the doctor's official records.</p>
    </div>
    <div class="form-grid">
      <div class="field full"><label>Doctor name <b>*</b></label><input required autocomplete="name" name="name" value="${valueForInput(doctor.name)}" placeholder="Dr. Full Name"></div>
      <div class="field"><label>Mobile number <b>*</b></label><input required autocomplete="tel" type="tel" name="mobile" value="${valueForInput(doctor.mobile || doctor.phone)}" placeholder="+91 98765 43210"></div>
      <div class="field"><label>Email address <b>*</b></label><input required autocomplete="email" type="email" name="email" value="${valueForInput(doctor.email)}" placeholder="doctor@example.com"></div>
      <div class="field"><label>Specialization <b>*</b></label><input required name="specialty" value="${valueForInput(doctor.specialty || doctor.specialization)}" placeholder="e.g. Dermatologist"></div>
      <div class="field"><label>Qualification <b>*</b></label><input required name="qualification" value="${valueForInput(doctor.qualification)}" placeholder="e.g. MBBS, MD Dermatology"></div>
      <div class="field"><label>Experience in years <b>*</b></label><input required type="number" min="0" max="80" name="experience" value="${valueForInput(doctor.experience)}" placeholder="8"></div>
      <div class="field"><label>Consultation fee (₹) <b>*</b></label><input required type="number" min="0" name="fee" value="${valueForInput(doctor.fee ?? doctor.consultationFee)}" placeholder="500"></div>
      <div class="field"><label>Gender</label><input name="gender" value="${valueForInput(doctor.gender === "Not specified" ? "" : doctor.gender)}" placeholder="Female, Male or another identity"></div>
      <div class="field"><label>Languages spoken <b>*</b></label><input required name="languages" value="${valueForInput(doctor.languages)}" placeholder="Hindi, English"></div>
    </div>

    <div class="form-section-heading">
      <div><span>02</span><strong>Clinic & location</strong></div>
      <p>This information will be shown to patients only after verification.</p>
    </div>
    <div class="form-grid">
      <div class="field full"><label>Clinic / hospital name <b>*</b></label><input required name="clinic" value="${valueForInput(doctor.clinic)}" placeholder="Clinic or hospital name"></div>
      <div class="field full"><label>Complete address <b>*</b></label><textarea required name="address" placeholder="Building, road and landmark">${valueForInput(doctor.address)}</textarea></div>
      <div class="field"><label>Area / locality <b>*</b></label><input required name="location" value="${valueForInput(doctor.location)}" placeholder="e.g. Civil Lines"></div>
      <div class="field"><label>City <b>*</b></label><input required name="city" value="${valueForInput(doctor.city)}" placeholder="e.g. Prayagraj"></div>
      <div class="field"><label>PIN code <b>*</b></label><input required inputmode="numeric" pattern="[1-9][0-9]{5}" maxlength="6" name="pincode" value="${valueForInput(doctor.pincode)}" placeholder="211001"></div>
    </div>

    <div class="form-section-heading">
      <div><span>03</span><strong>Medical registration</strong></div>
      <p>Cross-check the number and council before approving this doctor.</p>
    </div>
    <div class="form-grid">
      <div class="field"><label>Registration / licence number <b>*</b></label><input required name="registrationNumber" value="${valueForInput(doctor.registrationNumber || doctor.licenseNumber)}" placeholder="e.g. UPMC-2014-48291"></div>
      <div class="field"><label>Medical council <b>*</b></label><input required name="council" value="${valueForInput(doctor.registrationCouncil || doctor.council || doctor.medicalCouncil)}" placeholder="State Medical Council"></div>
      ${documentReviewField("Medical registration certificate", "registrationCertificateName", "registrationCertificateUrl", registrationCertificate)}
      ${documentReviewField("Medical degree certificate", "degreeCertificateName", "degreeCertificateUrl", degreeCertificate)}
      ${documentReviewField("Government photo ID", "photoIdName", "photoIdUrl", photoId)}
      ${mode === "create" ? "" : `<div class="field full rejection-field"><label>Rejection reason</label><textarea name="rejectionReason" id="rejectionReason" placeholder="Required when rejecting. Explain what must be corrected.">${valueForInput(doctor.rejectionReason)}</textarea><small>The doctor can use this reason to correct and resubmit the application.</small></div>`}
    </div>`;
}

const formTemplates = {
  doctor: {
    title: "Add doctor application",
    fields: doctorFormFields
  },
  lab: {
    title: "Add a PathLab",
    fields: `<div class="form-grid">
      <div class="field full"><label>Lab name</label><input required name="name" placeholder="Diagnostics center name"></div>
      <div class="field full"><label>Location</label><input required name="location" placeholder="Area, city"></div>
      <div class="field"><label>Accreditation</label><input name="accreditation" placeholder="e.g. NABL"></div>
      <div class="field"><label>Home collection</label><select name="homeCollection"><option value="true">Available</option><option value="false">Not available</option></select></div>
    </div>`
  },
  notification: {
    title: "Create notification",
    fields: `<div class="form-grid">
      <div class="field full"><label>Notification title</label><input required name="title" id="notificationTitle" placeholder="Short and useful"></div>
      <div class="field full"><label>Message</label><textarea required name="message" id="notificationMessage" placeholder="Tell patients what changed"></textarea></div>
      <div class="field full"><label>Audience</label><select name="audience"><option>All patients</option><option>Queue patients</option><option>Doctors</option><option>PathLabs</option></select></div>
    </div>`
  }
};

function openModal(type, options = {}) {
  const template = formTemplates[type] || formTemplates.doctor;
  const mode = options.mode || "create";
  const entity = type === "doctor" && options.id
    ? state.doctors.find(item => String(item.id) === String(options.id))
    : {};
  if (type === "doctor" && options.id && !entity) {
    showToast("Doctor application could not be found");
    return;
  }
  state.modalType = type;
  state.modalMode = mode;
  state.modalEntityId = entity?.id || null;
  const isDoctorReview = type === "doctor" && mode !== "create";
  const doctorStatus = entity ? getStatus(entity) : "pending";
  $("#modalTitle").textContent = isDoctorReview
    ? `${doctorStatus === "verified" ? "Edit" : "Review"} ${entity.name || "doctor application"}`
    : template.title;
  $("#formFields").innerHTML = typeof template.fields === "function" ? template.fields(entity, mode) : template.fields;
  $("#entityModal").classList.toggle("doctor-review-modal", type === "doctor");
  $("#verifyDoctor").hidden = !isDoctorReview || doctorStatus === "verified";
  $("#rejectDoctor").hidden = !isDoctorReview || doctorStatus === "verified";
  $("#saveEntity").textContent = type === "doctor" && mode === "create" ? "Save application" : "Save details";
  $("#formError").hidden = true;
  $("#formError").textContent = "";
  $("#modalBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
  $("#modalBackdrop input, #modalBackdrop textarea")?.focus();
  $("#notificationTitle")?.addEventListener("input", event => $("#previewTitle").textContent = event.target.value || "Your healthcare update");
  $("#notificationMessage")?.addEventListener("input", event => $("#previewMessage").textContent = event.target.value || "Important care information will appear here.");
}

function closeModal() {
  $("#modalBackdrop").hidden = true;
  document.body.style.overflow = "";
  $("#entityForm").reset();
  $("#entityModal").classList.remove("doctor-review-modal");
  $("#formError").hidden = true;
  $("#verifyDoctor").hidden = true;
  $("#rejectDoctor").hidden = true;
  setModalBusy(false);
  state.modalType = null;
  state.modalMode = "create";
  state.modalEntityId = null;
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function showFormError(message) {
  const error = $("#formError");
  error.textContent = message;
  error.hidden = !message;
  if (message) error.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function setModalBusy(isBusy) {
  state.modalBusy = isBusy;
  $$("#entityForm button").forEach(control => {
    control.disabled = isBusy;
  });
  $("#entityForm").setAttribute("aria-busy", String(isBusy));
  $("#closeModal").disabled = isBusy;
  $("#entityModal").classList.toggle("is-busy", isBusy);
}

function doctorPayloadFromForm() {
  const payload = Object.fromEntries(new FormData($("#entityForm")));
  Object.keys(payload).forEach(key => {
    if (typeof payload[key] === "string") payload[key] = payload[key].trim();
  });
  payload.fee = Number(payload.fee);
  payload.consultationFee = payload.fee;
  payload.experience = Number(payload.experience);
  payload.specialization = payload.specialty;
  payload.phone = payload.mobile;
  payload.licenseNumber = payload.registrationNumber;
  payload.medicalCouncil = payload.council;
  payload.registrationCouncil = payload.council;
  payload.documents = {
    registrationCertificate: {
      name: payload.registrationCertificateName,
      url: payload.registrationCertificateUrl
    },
    degreeCertificate: {
      name: payload.degreeCertificateName,
      url: payload.degreeCertificateUrl
    },
    photoId: {
      name: payload.photoIdName,
      url: payload.photoIdUrl
    }
  };
  payload.registrationDocumentUrl = payload.registrationCertificateUrl;
  return payload;
}

function upsertDoctor(doctor) {
  const index = state.doctors.findIndex(item => String(item.id) === String(doctor.id));
  if (index < 0) state.doctors.unshift(doctor);
  else state.doctors[index] = doctor;
  const verifiedDoctors = state.doctors.filter(item => getStatus(item) === "verified").length;
  const pendingDoctors = state.doctors.filter(item => getStatus(item) === "pending").length;
  state.overview = {
    ...state.overview,
    doctors: verifiedDoctors,
    totalDoctors: verifiedDoctors,
    pendingDoctors
  };
}

async function submitEntity(event) {
  event.preventDefault();
  const type = state.modalType;
  showFormError("");
  setModalBusy(true);
  try {
    if (type === "doctor") {
      const payload = doctorPayloadFromForm();
      const isCreate = state.modalMode === "create";
      if (isCreate) payload.status = "pending";
      const saved = await api(isCreate ? "/doctors" : `/doctors/${encodeURIComponent(state.modalEntityId)}`, {
        method: isCreate ? "POST" : "PATCH",
        body: JSON.stringify(payload)
      });
      upsertDoctor(saved);
    } else if (type === "lab") {
      const payload = Object.fromEntries(new FormData(event.currentTarget));
      payload.homeCollection = payload.homeCollection === "true"; payload.status = "pending";
      const created = await api("/labs", { method: "POST", body: JSON.stringify(payload) });
      state.labs.unshift(created);
    } else {
      const payload = Object.fromEntries(new FormData(event.currentTarget));
      payload.createdAt = new Date().toISOString();
      const created = await api("/notifications", { method: "POST", body: JSON.stringify(payload) });
      state.notifications.unshift(created);
      $("#previewTitle").textContent = payload.title;
      $("#previewMessage").textContent = payload.message;
    }
    closeModal();
    renderAll();
    showToast(type === "doctor" ? "Doctor details saved" : `${formTemplates[type].title.replace("Add a", "").replace("Create", "")} saved successfully`);
  } catch (error) {
    showFormError(`Could not save: ${error.message}. No changes were confirmed.`);
    showToast("Save failed — please check the form and try again");
  } finally {
    if (!$("#modalBackdrop").hidden) setModalBusy(false);
  }
}

async function verifyEntity(type, id) {
  if (type === "Doctor" || type === "doctor") {
    openModal("doctor", { mode: "review", id });
    return;
  }
  const collection = state.labs;
  const item = collection.find(entry => String(entry.id) === String(id));
  if (!item) return;
  try {
    const updated = await api(`/labs/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ status: "verified", verified: true }) });
    Object.assign(item, updated);
    renderAll();
    showToast(`${item.name} is now verified`);
  } catch (error) {
    showToast(`Verification failed: ${error.message}`);
  }
}

async function verifyCurrentDoctor() {
  const form = $("#entityForm");
  if (!form.reportValidity()) {
    showFormError("Complete every required profile and registration field before verification.");
    return;
  }
  showFormError("");
  setModalBusy(true);
  let detailsSaved = false;
  try {
    const saved = await api(`/doctors/${encodeURIComponent(state.modalEntityId)}`, {
      method: "PATCH",
      body: JSON.stringify(doctorPayloadFromForm())
    });
    detailsSaved = true;
    upsertDoctor(saved);
    const verifiedDoctor = await api(`/doctors/${encodeURIComponent(state.modalEntityId)}/verify`, {
      method: "POST",
      body: JSON.stringify({ approvedBy: "SehatLine Admin" })
    });
    upsertDoctor(verifiedDoctor);
    closeModal();
    renderAll();
    showToast(`${verifiedDoctor.name} is verified and visible to patients`);
  } catch (error) {
    renderAll();
    showFormError(`${detailsSaved ? "Details were saved, but verification failed" : "Verification failed"}: ${error.message}.`);
    showToast("Doctor was not verified");
  } finally {
    if (!$("#modalBackdrop").hidden) setModalBusy(false);
  }
}

async function rejectCurrentDoctor() {
  const reasonField = $("#rejectionReason");
  const reason = reasonField?.value.trim();
  if (!reason) {
    showFormError("Add a clear rejection reason before rejecting this application.");
    reasonField?.focus();
    return;
  }
  showFormError("");
  setModalBusy(true);
  let detailsSaved = false;
  try {
    const saved = await api(`/doctors/${encodeURIComponent(state.modalEntityId)}`, {
      method: "PATCH",
      body: JSON.stringify(doctorPayloadFromForm())
    });
    detailsSaved = true;
    upsertDoctor(saved);
    const rejected = await api(`/doctors/${encodeURIComponent(state.modalEntityId)}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason, rejectedBy: "SehatLine Admin" })
    });
    upsertDoctor(rejected);
    closeModal();
    renderAll();
    showToast(`${rejected.name}'s application was rejected`);
  } catch (error) {
    renderAll();
    showFormError(`${detailsSaved ? "Details were saved, but rejection failed" : "Could not reject this application"}: ${error.message}. Its status was not changed.`);
    showToast("Rejection failed");
  } finally {
    if (!$("#modalBackdrop").hidden) setModalBusy(false);
  }
}

function exportBookings() {
  const rows = [["Booking ID", "Patient", "Provider", "Date", "Time", "Amount", "Status"],
    ...state.bookings.map(item => [item.id, item.patientName, bookingProvider(item), item.date, item.time, item.amount, item.status])];
  const csv = rows.map(row => row.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  link.download = `sehatline-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Booking export downloaded");
}

function bindEvents() {
  $$(".nav-item").forEach(button => button.addEventListener("click", () => switchView(button.dataset.view)));
  $$("[data-jump]").forEach(button => button.addEventListener("click", () => switchView(button.dataset.jump)));
  $("#menuToggle").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  $("#themeToggle").addEventListener("click", () => {
    const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("sehatline-admin-theme", theme);
    $("#themeToggle").textContent = theme === "dark" ? "☀" : "☾";
  });
  $("#quickAddButton").addEventListener("click", () => openModal("doctor"));
  $$("[data-open-modal]").forEach(button => button.addEventListener("click", () => openModal(button.dataset.openModal)));
  $("#closeModal").addEventListener("click", closeModal);
  $("#cancelModal").addEventListener("click", closeModal);
  $("#verifyDoctor").addEventListener("click", verifyCurrentDoctor);
  $("#rejectDoctor").addEventListener("click", rejectCurrentDoctor);
  $("#modalBackdrop").addEventListener("click", event => { if (event.target === event.currentTarget) closeModal(); });
  $("#entityForm").addEventListener("submit", submitEntity);
  $("#exportBookings").addEventListener("click", exportBookings);
  $("#bookingStatusFilter").addEventListener("change", event => { state.bookingStatus = event.target.value; renderBookings(); });
  $$("[data-table-search]").forEach(input => input.addEventListener("input", event => {
    state.searches[event.target.dataset.tableSearch] = event.target.value;
    ({ doctors: renderDoctors, labs: renderLabs, bookings: renderBookings, users: renderUsers })[event.target.dataset.tableSearch]();
  }));
  $$("[data-filter-group]").forEach(group => group.addEventListener("click", event => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    $$("[data-filter]", group).forEach(item => item.classList.toggle("active", item === button));
    if (group.dataset.filterGroup === "doctors") { state.doctorFilter = button.dataset.filter; renderDoctors(); }
    else { state.labFilter = button.dataset.filter; renderLabs(); }
  }));
  document.addEventListener("click", event => {
    const verify = event.target.closest("[data-verify]");
    if (verify) {
      const [type, id] = verify.dataset.verify.split(":");
      switchView(type === "Doctor" ? "doctors" : "labs");
      if (type === "Doctor") openModal("doctor", { mode: "review", id });
      else showToast(`Reviewing ${type.toLowerCase()} application`);
    }
    const doctorAction = event.target.closest("[data-doctor-action]");
    if (doctorAction) openModal("doctor", {
      mode: doctorAction.dataset.doctorAction === "edit" ? "edit" : "review",
      id: doctorAction.dataset.id
    });
    const labAction = event.target.closest("[data-lab-action]");
    if (labAction?.dataset.labAction === "verify") verifyEntity("lab", labAction.dataset.id);
    if (labAction?.dataset.labAction === "edit") showToast("Lab editor will open with test catalogue");
    const booking = event.target.closest("[data-booking-id]");
    if (booking) showToast(`Booking ${booking.dataset.bookingId}: status controls ready`);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !$("#modalBackdrop").hidden) closeModal();
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault(); $("#globalSearch").focus();
    }
  });
  $("#globalSearch").addEventListener("input", event => {
    const value = event.target.value;
    if (!value) return;
    state.searches.doctors = value; state.searches.labs = value; state.searches.bookings = value; state.searches.users = value;
  });
  $("#globalSearch").addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    const value = event.currentTarget.value.toLowerCase();
    if (state.doctors.some(item => item.name.toLowerCase().includes(value))) switchView("doctors");
    else if (state.labs.some(item => item.name.toLowerCase().includes(value))) switchView("labs");
    else switchView("bookings");
    renderAll();
  });
}

function initialize() {
  const savedTheme = localStorage.getItem("sehatline-admin-theme") || "light";
  document.documentElement.dataset.theme = savedTheme;
  $("#themeToggle").textContent = savedTheme === "dark" ? "☀" : "☾";
  bindEvents();
  switchView(location.hash.slice(1) || "overview");
  renderAll();
  loadData();
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

initialize();
