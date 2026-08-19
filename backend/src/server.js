import http from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { JsonStore, MongoStore } from "./store.js";
import { connectDatabase } from "./config/database.js";
import { AdminAuthService, adminErrorPayload } from "./admin-auth.js";

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(sourceDirectory, "../..");

async function loadLocalEnvironment() {
  try {
    const file = await readFile(path.join(projectRoot, ".env.local"), "utf8");
    for (const line of file.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || process.env[match[1]] != null) continue;
      const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
      process.env[match[1]] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

await loadLocalEnvironment();

const DEFAULT_PORT = Number(process.env.PORT || 4000);
const MAX_BODY_BYTES = 1_000_000;

let aiRecommend;
try {
  ({ recommend: aiRecommend } = await import("../../ai_service/src/recommendation.js"));
} catch {
  aiRecommend = fallbackRecommendation;
}

const identitySessions = new Map();
const identitySandboxEnabled = process.env.NODE_ENV !== "production"
  && process.env.SEHATLINE_IDENTITY_SANDBOX !== "false";
const otpSandboxEnabled = process.env.NODE_ENV !== "production"
  && process.env.SEHATLINE_OTP_SANDBOX === "true";
const msg91AuthKey = String(process.env.MSG91_AUTH_KEY || "").trim();
const msg91TemplateId = String(process.env.MSG91_TEMPLATE_ID || "").trim();
const msg91WidgetId = String(process.env.MSG91_WIDGET_ID || "").trim();
const msg91WidgetToken = String(process.env.MSG91_WIDGET_TOKEN || "").trim();
const msg91SendOtpConfigured = Boolean(msg91AuthKey && msg91TemplateId);
const msg91WidgetConfigured = Boolean(msg91AuthKey && msg91WidgetId && msg91WidgetToken);
const otpSendTimes = new Map();
const razorpayKeyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
const razorpayKeySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
const razorpayWebhookSecret = String(process.env.RAZORPAY_WEBHOOK_SECRET || "").trim();
const googleMapsServerApiKey = String(process.env.GOOGLE_MAPS_SERVER_API_KEY || "").trim();
const PATIENT_PAYMENT_RESERVATION_MS = 15 * 60 * 1000;
const DOCTOR_LAUNCH_PLAN = Object.freeze({
  id: "doctor-launch-599",
  name: "SehatLine Doctor Launch Plan",
  regularPrice: 999,
  offerPrice: 599,
  gstRate: 18,
  gstAmount: 107.82,
  total: 706.82,
  amountPaise: 70682,
  currency: "INR",
  billing: "one-time",
  policy: [
    "One-time onboarding charge; there is no automatic renewal.",
    "Payment covers profile setup, document review and clinic onboarding.",
    "Payment does not guarantee approval. Medical credentials must pass owner verification.",
    "A GST invoice is issued after a verified payment.",
    "Refund requests are reviewed only before document verification work starts."
  ]
});

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".mp4", "video/mp4"],
  [".ico", "image/x-icon"],
  [".txt", "text/plain; charset=utf-8"],
  [".pdf", "application/pdf"]
]);

const apiReference = {
  name: "SehatLine MVP API",
  version: "0.1.0",
  endpoints: [
    "GET /api/health",
    "GET|POST /api/doctors",
    "GET|PUT|PATCH|DELETE /api/doctors/:id",
    "POST /api/doctors/:id/verify",
    "POST /api/doctors/:id/reject",
    "GET /api/doctor/onboarding/plan",
    "POST /api/doctor/onboarding/payment/order",
    "POST /api/doctor/onboarding/payment/verify",
    "POST /api/patient/payments/order",
    "POST /api/patient/payments/verify",
    "POST /api/payments/razorpay/webhook",
    "GET|POST /api/labs",
    "GET|PUT|PATCH /api/labs/:id",
    "POST /api/labs/:id/verify",
    "GET|POST /api/bookings",
    "GET|POST /api/appointments",
    "GET|PATCH|PUT|DELETE /api/bookings/:id",
    "GET /api/reports",
    "GET /api/users",
    "GET|POST /api/notifications",
    "GET /api/admin/overview",
    "GET /api/public-care/facilities",
    "GET /api/public-care/facilities/:id",
    "GET /api/health-support/locations",
    "GET /api/health-support/schemes",
    "GET /api/health-support/insurance",
    "GET /api/auth/otp/config",
    "POST /api/auth/verify-widget-token",
    "POST /api/auth/patient/identity/start",
    "POST /api/auth/patient/identity/complete",
    "POST /api/ai/query",
    "POST /api/ai/recommend",
    "GET|PUT /api/doctor/profile",
    "GET|POST /api/doctor/appointments",
    "GET /api/doctor/dashboard",
    "GET|PUT /api/doctor/schedule",
    "GET|POST|PATCH /api/doctor/queue",
    "GET /api/doctor/patients",
    "GET /api/doctor/analytics"
  ]
};

const titleCase = value => String(value || "").toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
const slugId = prefix => `${prefix}-${randomUUID().slice(0, 8)}`;
const asArray = value => Array.isArray(value) ? value : value == null || value === "" ? [] : String(value).split(",").map(item => item.trim()).filter(Boolean);
const numeric = (value, fallback = 0) => {
  if (value == null || value === "") return fallback;
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
};
const optionalNumber = value => {
  if (value == null || value === "") return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
};
const firstText = (...values) => {
  const value = values.find(item => item != null && String(item).trim());
  return value == null ? "" : String(value).trim();
};
const verified = item => {
  const status = String(item?.status || "").toLowerCase();
  return status ? status === "verified" : item?.verified === true;
};
const jsonClone = value => JSON.parse(JSON.stringify(value));
const displayTimeAgo = () => "Just now";
const phoneDigits = value => String(value || "").replace(/\D/g, "").slice(-10);

async function providerJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text };
  }
}

function secureHexEqual(left, right) {
  const first = Buffer.from(String(left || ""), "utf8");
  const second = Buffer.from(String(right || ""), "utf8");
  return first.length === second.length && timingSafeEqual(first, second);
}

async function createRazorpayOrder(doctor, gateway, providerFetch = fetch) {
  const receipt = `sl-${String(doctor.id).replace(/[^a-z0-9_-]/gi, "").slice(-24)}-${Date.now()}`.slice(0, 40);
  const response = await providerFetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${gateway.keyId}:${gateway.keySecret}`).toString("base64")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: DOCTOR_LAUNCH_PLAN.amountPaise,
      currency: DOCTOR_LAUNCH_PLAN.currency,
      receipt,
      notes: { doctorId: doctor.id, planId: DOCTOR_LAUNCH_PLAN.id }
    })
  });
  const payload = await providerJson(response);
  if (!response.ok || !payload.id) {
    throw Object.assign(new Error(firstText(payload?.error?.description, payload?.message, "Payment order could not be created")), { statusCode: 502 });
  }
  return { ...payload, receipt };
}

async function createPatientBookingOrder({ doctor, patientId, date, time, amountPaise }, gateway, providerFetch = fetch) {
  const receipt = `sl-visit-${String(doctor.id).replace(/[^a-z0-9_-]/gi, "").slice(-14)}-${Date.now()}`.slice(0, 40);
  const response = await providerFetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${gateway.keyId}:${gateway.keySecret}`).toString("base64")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: { purpose: "patient-appointment", doctorId: doctor.id, patientId, date, time }
    })
  });
  const payload = await providerJson(response);
  if (!response.ok || !payload.id) {
    throw Object.assign(new Error(firstText(payload?.error?.description, payload?.message, "Appointment payment order could not be created")), { statusCode: 502 });
  }
  return { ...payload, receipt };
}

async function fetchRazorpayPayment(paymentId, gateway, providerFetch = fetch) {
  const response = await providerFetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${gateway.keyId}:${gateway.keySecret}`).toString("base64")}` }
  });
  const payload = await providerJson(response);
  if (!response.ok || !payload.id) {
    throw Object.assign(new Error(firstText(payload?.error?.description, payload?.message, "Payment status could not be confirmed")), { statusCode: 502 });
  }
  return payload;
}

function verifyRazorpayPaymentSignature(orderId, paymentId, signature, keySecret = razorpayKeySecret) {
  const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  return secureHexEqual(expected, signature);
}

function normalizeOnboardingSchedule(input = {}) {
  const allowedDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const workingDays = asArray(input.workingDays).filter(day => allowedDays.includes(day));
  const startTime = String(input.startTime || "09:00");
  const endTime = String(input.endTime || "17:00");
  const patientsPerHour = Math.max(1, Math.min(12, Number(input.patientsPerHour) || 4));
  const durationMinutes = Math.max(5, Math.round(60 / patientsPerHour));
  return {
    workingDays: workingDays.length ? workingDays : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    startTime,
    endTime,
    patientsPerHour,
    durationMinutes
  };
}

async function sendMsg91Otp(phone) {
  const url = new URL("https://control.msg91.com/api/v5/otp");
  url.searchParams.set("template_id", msg91TemplateId);
  url.searchParams.set("mobile", `91${phone}`);
  url.searchParams.set("authkey", msg91AuthKey);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  });
  const payload = await providerJson(response);
  if (!response.ok || payload.type !== "success") {
    throw new Error(firstText(payload.message, "MSG91 could not deliver the OTP"));
  }
  return payload;
}

async function verifyMsg91Otp(phone, otp) {
  const url = new URL("https://control.msg91.com/api/v5/otp/verify");
  url.searchParams.set("mobile", `91${phone}`);
  url.searchParams.set("otp", otp);
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      authkey: msg91AuthKey
    }
  });
  const payload = await providerJson(response);
  const verified = response.ok
    && (payload.type === "success" || /verified success/i.test(String(payload.message || "")));
  if (!verified) throw new Error(firstText(payload.message, "The OTP is invalid or expired"));
  return payload;
}

function decodeJwtPayload(token) {
  try {
    const encoded = String(token || "").split(".")[1];
    if (!encoded) return {};
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return {};
  }
}

function widgetIdentifier(payload, accessToken) {
  const claims = decodeJwtPayload(accessToken);
  return firstText(
    payload?.identifier,
    payload?.mobile,
    payload?.phone,
    payload?.data?.identifier,
    payload?.data?.mobile,
    payload?.data?.phone,
    claims.identifier,
    claims.mobile,
    claims.phone
  );
}

async function verifyMsg91WidgetAccessToken(accessToken, providerFetch = fetch) {
  const response = await providerFetch("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      authkey: msg91AuthKey,
      "access-token": accessToken
    })
  });
  const payload = await providerJson(response);
  const message = String(payload?.message || "");
  const tokenVerified = response.ok && (
    payload?.type === "success"
    || payload?.success === true
    || (/verified|valid/i.test(message) && !/invalid|failed|expired/i.test(message))
  );
  if (!tokenVerified) {
    throw new Error(firstText(payload?.message, "MSG91 could not verify this OTP session"));
  }
  return payload;
}

function hasRawIdentityData(input = {}) {
  const forbiddenKeys = new Set([
    "aadhaar",
    "aadhaarnumber",
    "uid",
    "vid",
    "face",
    "faceimage",
    "biometric",
    "selfie",
    "photo"
  ]);
  const inspect = value => {
    if (!value || typeof value !== "object") return false;
    return Object.entries(value).some(([key, nested]) =>
      forbiddenKeys.has(key.toLowerCase().replace(/[^a-z]/g, "")) || inspect(nested)
    );
  };
  return inspect(input);
}

function normalizeDoctor(input, current = {}) {
  const merged = { ...current, ...input };
  const name = firstText(merged.name, merged.fullName);
  const specialty = firstText(merged.specialty, merged.specialization, merged.specialisation);
  const qualification = firstText(merged.qualification, merged.degree);
  const phone = firstText(merged.phone, merged.phoneNumber, merged.mobile, merged.mobileNumber);
  const clinic = firstText(merged.clinic, merged.clinicName);
  const address = firstText(merged.address, merged.clinicAddress, merged.location);
  const location = firstText(merged.location, merged.address, merged.clinicAddress);
  const registrationNumber = firstText(
    merged.registrationNumber,
    merged.medicalRegistrationNumber,
    merged.licenseNumber,
    merged.licenceNumber
  );
  const registrationCouncil = firstText(
    merged.registrationCouncil,
    merged.medicalCouncil,
    merged.council,
    merged.licenseCouncil,
    merged.licenceCouncil
  );
  const fee = optionalNumber(merged.fee ?? merged.consultationFee);
  const experience = optionalNumber(merged.experience ?? merged.experienceYears);
  const requestedStatus = String(merged.status || (merged.verified ? "verified" : "pending")).toLowerCase();
  const status = ["pending", "verified", "rejected"].includes(requestedStatus) ? requestedStatus : "pending";
  const now = new Date().toISOString();
  return {
    ...merged,
    id: current.id || merged.id || slugId("doc"),
    name,
    initials: merged.initials || (name ? name.replace(/^Dr\.\s*/i, "").split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() : ""),
    specialty,
    specialization: specialty,
    qualification,
    phone,
    experience,
    fee,
    consultationFee: fee,
    rating: numeric(merged.rating),
    reviews: numeric(merged.reviews),
    distance: numeric(merged.distance, 0),
    gender: merged.gender || "Not specified",
    languages: asArray(merged.languages).length ? asArray(merged.languages) : (status === "verified" ? ["Hindi", "English"] : []),
    availability: merged.availability || (status === "verified" ? "Contact clinic" : "Pending verification"),
    nextSlot: merged.nextSlot || "Contact clinic",
    clinic,
    address,
    location,
    registrationNumber,
    registrationCouncil,
    avgWait: merged.avgWait || "Not available",
    colors: Array.isArray(merged.colors) && merged.colors.length >= 3 ? merged.colors : ["#d1fae5", "#bfdbfe", "#155e75"],
    services: asArray(merged.services).length ? asArray(merged.services) : ["Clinic consultation"],
    education: merged.education || qualification,
    status,
    verified: status === "verified",
    createdAt: merged.createdAt || now,
    appliedAt: merged.appliedAt || merged.createdAt || now,
    updatedAt: now
  };
}

const doctorWorkflowFields = new Set([
  "status",
  "verified",
  "verifiedAt",
  "verifiedBy",
  "approvedAt",
  "approvedBy",
  "approvalNote",
  "rejectedAt",
  "rejectedBy",
  "rejectionReason",
  "reviewedAt",
  "verification",
  "verificationHistory"
]);

function withoutDoctorWorkflowFields(input) {
  return Object.fromEntries(Object.entries(input).filter(([key]) => !doctorWorkflowFields.has(key)));
}

const doctorProfileFields = new Set([
  "name",
  "fullName",
  "specialty",
  "specialization",
  "specialisation",
  "qualification",
  "degree",
  "phone",
  "phoneNumber",
  "mobile",
  "mobileNumber",
  "email",
  "clinic",
  "clinicName",
  "address",
  "clinicAddress",
  "location",
  "city",
  "pincode",
  "registrationNumber",
  "medicalRegistrationNumber",
  "licenseNumber",
  "licenceNumber",
  "registrationCouncil",
  "medicalCouncil",
  "council",
  "licenseCouncil",
  "licenceCouncil",
  "fee",
  "consultationFee",
  "experience",
  "experienceYears",
  "gender",
  "languages",
  "documents",
  "registrationCertificateName",
  "registrationCertificateUrl",
  "degreeCertificateName",
  "degreeCertificateUrl",
  "photoIdName",
  "photoIdUrl",
  "registrationDocumentUrl",
  "licenseDocumentUrl",
  "applicationSource",
  "about",
  "photo",
  "photoUrl",
  "profilePhoto",
  "avatar",
  "avatarUrl",
  "availability",
  "nextSlot",
  "services",
  "education",
  "onlineConsultation",
  "homeVisit",
  "coordinates",
  "latitude",
  "longitude"
]);

function sanitizeDoctorProfileInput(input) {
  return Object.fromEntries(
    Object.entries(withoutDoctorWorkflowFields(input))
      .filter(([key]) => doctorProfileFields.has(key))
  );
}

function missingDoctorVerificationFields(doctor) {
  const missing = [];
  const hasText = value => typeof value === "string" && value.trim().length > 0;
  const hasNumber = value => value !== null && value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;
  const hasValidPhone = value => hasText(value) && /^\d{10,15}$/.test(value.replace(/\D/g, ""));
  const hasValidEmail = value => hasText(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const hasValidUrl = value => {
    try {
      return ["http:", "https:"].includes(new URL(String(value || "")).protocol);
    } catch {
      return false;
    }
  };
  const requireDocument = (key, label) => {
    const document = doctor.documents?.[key] || {};
    if (!hasText(document.name)) missing.push(`documents.${label}.name`);
    if (!hasValidUrl(document.url)) missing.push(`documents.${label}.url`);
  };

  if (!hasText(doctor.name)) missing.push("name");
  if (!hasValidPhone(doctor.phone)) missing.push("phone");
  if (!hasValidEmail(doctor.email)) missing.push("email");
  if (!hasText(doctor.specialty)) missing.push("specialty");
  if (!hasText(doctor.qualification) || doctor.qualification === "Qualification verification pending") missing.push("qualification");
  if (!hasNumber(doctor.experience)) missing.push("experience");
  if (!hasNumber(doctor.fee)) missing.push("fee");
  if (!hasText(doctor.clinic)) missing.push("clinic");
  if (!hasText(doctor.address) && !hasText(doctor.location)) missing.push("address/location");
  if (!hasText(doctor.city)) missing.push("city");
  if (!/^[1-9]\d{5}$/.test(String(doctor.pincode || ""))) missing.push("pincode");
  if (!Array.isArray(doctor.languages) || doctor.languages.length === 0) missing.push("languages");
  if (!hasText(doctor.registrationNumber)) missing.push("registrationNumber");
  if (!hasText(doctor.registrationCouncil)) missing.push("registrationCouncil");
  requireDocument("registrationCertificate", "registrationCertificate");
  requireDocument("degreeCertificate", "degreeCertificate");
  requireDocument("photoId", "photoId");
  if (doctor.applicationSource === "doctor-app" && !hasText(doctor.declarationAcceptedAt)) {
    missing.push("declarationAcceptedAt");
  }
  if (doctor.applicationSource === "doctor-app" && doctor.onboarding?.payment?.status !== "paid") {
    missing.push("onboarding.payment.status");
  }
  return missing;
}

const publicDoctorFields = [
  "id",
  "name",
  "initials",
  "specialty",
  "specialization",
  "qualification",
  "experience",
  "fee",
  "consultationFee",
  "rating",
  "reviews",
  "distance",
  "gender",
  "languages",
  "availability",
  "nextSlot",
  "clinic",
  "address",
  "location",
  "avgWait",
  "colors",
  "services",
  "education",
  "registrationNumber",
  "registrationCouncil",
  "about",
  "photo",
  "photoUrl",
  "profilePhoto",
  "avatar",
  "avatarUrl",
  "onlineConsultation",
  "homeVisit",
  "coordinates",
  "latitude",
  "longitude",
  "status",
  "verified",
  "verifiedAt",
  "updatedAt"
];

function publicDoctor(doctor) {
  return Object.fromEntries(
    publicDoctorFields
      .filter(field => doctor[field] !== undefined)
      .map(field => [field, doctor[field]])
  );
}

function normalizeLab(input, current = {}) {
  const merged = { ...current, ...input };
  const tests = Array.isArray(merged.tests) ? merged.tests.map((test, index) => ({
    ...test,
    id: test.id || slugId(`test${index + 1}`),
    name: test.name || "Diagnostic test",
    price: numeric(test.price),
    reportTime: test.reportTime || merged.reportTime || "Contact lab"
  })) : [];
  const featured = tests[0] || {};
  const status = String(merged.status || (merged.verified ? "verified" : "pending")).toLowerCase();
  return {
    ...merged,
    id: merged.id || slugId("lab"),
    name: String(merged.name || "Unnamed PathLab").trim(),
    location: merged.location || merged.address || "Prayagraj",
    address: merged.address || merged.location || "Prayagraj",
    rating: numeric(merged.rating),
    reviews: numeric(merged.reviews),
    distance: numeric(merged.distance),
    certified: merged.certified || merged.accreditation || "Verification pending",
    accreditation: merged.accreditation || merged.certified || "Verification pending",
    homeCollection: merged.homeCollection === true || merged.homeCollection === "true",
    reportTime: merged.reportTime || featured.reportTime || "Contact lab",
    test: merged.test || featured.name || "Test catalogue being updated",
    price: numeric(merged.price ?? featured.price),
    originalPrice: numeric(merged.originalPrice, numeric(merged.price ?? featured.price)),
    discount: numeric(merged.discount),
    nextSlot: merged.nextSlot || "Contact lab",
    tests,
    status,
    verified: status === "verified" || merged.verified === true,
    updatedAt: new Date().toISOString()
  };
}

function normalizeNotification(input) {
  const message = String(input.message || input.copy || "").trim();
  return {
    ...input,
    id: input.id || slugId("notification"),
    title: String(input.title || "SehatLine update").trim(),
    message,
    copy: message,
    audience: input.audience || "All patients",
    time: input.time || displayTimeAgo(),
    icon: input.icon || "bell",
    unread: input.unread ?? true,
    createdAt: input.createdAt || new Date().toISOString()
  };
}

function normalizeBooking(input, database) {
  const doctor = database.doctors.find(item => item.id === input.doctorId);
  const lab = database.labs.find(item => item.id === input.labId || item.id === input.providerId);
  const providerType = input.providerType || (lab ? "lab" : "doctor");
  const provider = providerType === "lab" ? lab : doctor;
  const dateValue = input.date || new Date().toISOString().slice(0, 10);
  const parsedDate = new Date(`${dateValue}T12:00:00`);
  const validDate = !Number.isNaN(parsedDate.valueOf());
  const patientName = input.patientName || input.patient || input.patientDetails?.name || "Demo Patient";
  const amount = providerType === "lab"
    ? numeric(input.amount, numeric(input.price, numeric(lab?.price)))
    : numeric(doctor?.fee, numeric(input.amount));
  const paymentMode = input.paymentMode === "online" ? "online" : "cash";
  const trustedPaymentStatus = input.paymentStatus === "paid" && input.paymentVerified === true ? "paid" : paymentMode === "cash" ? "due" : "pending";
  return {
    ...input,
    id: input.id || slugId(providerType === "lab" ? "lab-booking" : "appointment"),
    patientId: input.patientId || "u1",
    patientName,
    doctorId: providerType === "doctor" ? input.doctorId : undefined,
    doctorName: providerType === "doctor" ? doctor?.name || input.doctorName || "SehatLine doctor" : undefined,
    labId: providerType === "lab" ? lab?.id || input.labId || input.providerId : undefined,
    labName: providerType === "lab" ? lab?.name || input.labName || "SehatLine PathLab" : undefined,
    providerName: provider?.name || input.providerName || input.doctorName || input.labName || "SehatLine partner",
    providerType,
    date: validDate ? dateValue : new Date().toISOString().slice(0, 10),
    day: input.day || (validDate ? String(parsedDate.getDate()).padStart(2, "0") : ""),
    month: input.month || (validDate ? parsedDate.toLocaleString("en-IN", { month: "short" }) : ""),
    time: input.time || "To be confirmed",
    type: input.type || input.mode || (providerType === "lab" && input.homeCollection ? "Home collection" : "Clinic visit"),
    status: titleCase(input.status || "confirmed"),
    reason: input.reason || input.visitReason || input.test || "",
    amount,
    paymentMode,
    paymentStatus: trustedPaymentStatus,
    paymentVerified: trustedPaymentStatus === "paid",
    upcoming: input.upcoming ?? !["completed", "cancelled"].includes(String(input.status || "").toLowerCase()),
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function doctorAppointmentFromBooking(booking, workspace) {
  const match = String(booking.time || "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  const period = (match?.[3] || "PM").toUpperCase();
  const hour = match ? String(match[1]).padStart(2, "0") : "09";
  const minute = match?.[2] || "00";
  const sequence = workspace.appointments.length + 1;
  return {
    id: booking.id,
    time: `${hour}:${minute}`,
    period,
    name: booking.patientName,
    age: numeric(booking.patientAge),
    gender: booking.patientGender || "Not specified",
    phone: booking.patientPhone || "",
    token: booking.token || `A${String(sequence + 11).padStart(2, "0")}`,
    reason: booking.reason || "General consultation",
    type: booking.type || "New patient",
    status: String(booking.status || "confirmed").toLowerCase(),
    amount: numeric(booking.amount),
    paymentMode: booking.paymentMode || "cash",
    paymentStatus: booking.paymentStatus || (booking.paymentMode === "online" ? "pending" : "due"),
    note: booking.note || "",
    date: booking.date
  };
}

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  const body = payload == null ? "" : JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Cache-Control": "no-store",
    ...extraHeaders
  });
  response.end(body);
}

function sendError(response, statusCode, message, details) {
  sendJson(response, statusCode, { error: { message, ...(details ? { details } : {}) } });
}

function bearerToken(request) {
  const match = String(request.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

function ensureDoctorQueue(database, doctorId, date = new Date().toISOString().slice(0, 10)) {
  if (!database.queues || Array.isArray(database.queues)) database.queues = {};
  const queue = database.queues[doctorId] ||= {
    doctorId,
    date,
    status: "closed",
    capacity: 0,
    issued: 0,
    currentToken: "—",
    current: null,
    waiting: [],
    seen: 0,
    expectedMinutes: 15,
    delayMinutes: 0,
    updatedAt: new Date().toISOString()
  };
  if (queue.date !== date) {
    const schedule = database.doctorSchedules?.[doctorId]?.[date];
    Object.assign(queue, {
      date,
      status: "closed",
      capacity: Number(schedule?.capacity || 0),
      issued: 0,
      currentToken: "—",
      current: null,
      waiting: [],
      seen: 0,
      delayMinutes: 0,
      updatedAt: new Date().toISOString()
    });
  }
  queue.remaining = Math.max(0, Number(queue.capacity || 0) - Number(queue.issued || 0));
  return queue;
}

function scheduleSlots(startTime, endTime, durationMinutes, capacity) {
  const parse = value => {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
  };
  const start = parse(startTime);
  const end = parse(endTime);
  const duration = Math.max(5, Number(durationMinutes) || 15);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const slots = [];
  for (let minute = start; minute + duration <= end && slots.length < Math.max(1, Number(capacity) || 100); minute += duration) {
    slots.push({ time: `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`, available: true });
  }
  return slots;
}

function doctorWorkspaceFor(database, doctorId) {
  database.doctorWorkspaces ||= {};
  if (!database.doctorWorkspaces[doctorId]) {
    const legacy = database.doctorWorkspace?.doctorId === doctorId ? database.doctorWorkspace : null;
    const doctor = database.doctors.find(item => item.id === doctorId) || {};
    const onboardingSchedule = normalizeOnboardingSchedule(doctor.onboarding?.schedule || {});
    database.doctorWorkspaces[doctorId] = {
      doctorId,
      appointments: Array.isArray(legacy?.appointments) ? legacy.appointments : [],
      patients: Array.isArray(legacy?.patients) ? legacy.patients : [],
      profile: {
        name: doctor.name || "Doctor",
        specialty: doctor.specialty || "",
        specialisation: doctor.specialty || "",
        registrationNumber: doctor.registrationNumber || "",
        qualification: doctor.qualification || "",
        experience: doctor.experience || 0,
        languages: doctor.languages || [],
        clinic: doctor.clinic || "",
        address: doctor.address || "",
        services: [{ id: "consultation", name: "Clinic consultation", fee: numeric(doctor.fee), duration: `${onboardingSchedule.durationMinutes} min` }],
        availability: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => ({
          day,
          enabled: onboardingSchedule.workingDays.includes(day),
          from: onboardingSchedule.startTime,
          to: onboardingSchedule.endTime
        })),
        holidays: [],
        ...(legacy?.profile || {})
      },
      analytics: legacy?.analytics || {},
      schedules: Array.isArray(legacy?.schedules) ? legacy.schedules : []
    };
  }
  return database.doctorWorkspaces[doctorId];
}

function doctorBookings(database, doctorId) {
  return database.bookings.filter(item => item.doctorId === doctorId);
}

function activePaymentReservation(database, doctorId, date, time) {
  return Object.values(database.patientPaymentOrders || {}).find(item => item.doctorId === doctorId
    && item.date === date
    && item.time === time
    && item.status === "created"
    && Number(item.expiresAt) > Date.now());
}

function commitDoctorBooking(database, booking) {
  const schedule = database.doctorSchedules?.[booking.doctorId]?.[booking.date];
  const queue = ensureDoctorQueue(database, booking.doctorId, booking.date);
  const selectedSlot = schedule?.slots?.find(slot => slot.time === String(booking.time || "").slice(0, 5) && slot.available !== false);
  if (!schedule || !selectedSlot || queue.issued >= Number(schedule.capacity || 0)) return false;
  booking.token = `T${String((queue.issued || 0) + 1).padStart(3, "0")}`;
  database.bookings.unshift(booking);
  selectedSlot.available = false;
  queue.issued += 1;
  queue.capacity ||= schedule.capacity || 0;
  queue.remaining = Math.max(0, Number(queue.capacity || 0) - Number(queue.issued || 0));
  schedule.bookedCount = queue.issued;
  schedule.remainingTokens = queue.remaining;
  queue.waiting.push({ token: booking.token, name: booking.patientName, reason: booking.reason || "Consultation", appointmentId: booking.id, checkedIn: true, wait: queue.waiting.length * queue.expectedMinutes });
  const workspace = doctorWorkspaceFor(database, booking.doctorId);
  if (!workspace.appointments.some(item => item.id === booking.id)) workspace.appointments.push(doctorAppointmentFromBooking(booking, workspace));
  database.notifications.unshift(normalizeNotification({ title: "Appointment confirmed", message: `${booking.providerName} is booked for ${booking.date} at ${booking.time}.`, audience: "Single patient", icon: "check-circle" }));
  return true;
}

function commitPaidPatientBooking(database, order, paymentId) {
  if (order.status === "booked") return database.bookings.find(item => item.id === order.bookingId || item.paymentOrderId === order.orderId);
  const booking = normalizeBooking({
    ...(order.booking || {}),
    doctorId: order.doctorId,
    patientId: order.patientId,
    date: order.date,
    time: order.time,
    paymentMode: "online",
    paymentStatus: "paid",
    paymentVerified: true,
    paymentOrderId: order.orderId,
    paymentId,
    paidAt: new Date().toISOString(),
    amount: Number(order.amountPaise) / 100
  }, database);
  if (!commitDoctorBooking(database, booking)) return null;
  Object.assign(order, { status: "booked", paymentId, bookingId: booking.id, paidAt: booking.paidAt });
  return booking;
}

function activeBooking(item) {
  return !["cancelled", "rejected", "no-show"].includes(String(item.status || "").toLowerCase());
}

function doctorCollectionSnapshot(database, doctorId, date = new Date().toISOString().slice(0, 10)) {
  const today = doctorBookings(database, doctorId).filter(item => item.date === date && activeBooking(item));
  const online = today.filter(item => item.paymentMode === "online" && item.paymentStatus === "paid");
  const cash = today.filter(item => item.paymentMode === "cash" && item.paymentStatus === "paid");
  const due = today.filter(item => item.paymentStatus !== "paid");
  const sum = items => items.reduce((total, item) => total + numeric(item.amount), 0);
  return {
    date,
    currency: "INR",
    onlineAmount: sum(online),
    onlineCount: online.length,
    cashAmount: sum(cash),
    cashCount: cash.length,
    dueAmount: sum(due),
    dueCount: due.length,
    collectedAmount: sum([...online, ...cash]),
    collectedCount: online.length + cash.length,
    expectedAmount: sum(today),
    appointmentCount: today.length
  };
}

function doctorIncomeSnapshot(database, doctorId, date = new Date().toISOString().slice(0, 10), rangeDays = 30) {
  const bookings = doctorBookings(database, doctorId);
  const active = bookings.filter(activeBooking);
  const completed = active.filter(item => String(item.status || "").toLowerCase() === "completed");
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - Math.max(0, Number(rangeDays) - 1));
  const inRange = active.filter(item => {
    const value = new Date(`${item.date || ""}T12:00:00`);
    return !Number.isNaN(value.valueOf()) && value >= cutoff;
  });
  const todayBookings = active.filter(item => item.date === date);
  const uniquePatients = new Set(active.map(item => item.patientId || phoneDigits(item.patientPhone) || item.patientName).filter(Boolean));
  const paid = active.filter(item => item.paymentStatus === "paid");
  const totalIncome = paid.reduce((sum, item) => sum + numeric(item.amount), 0);
  const todayIncome = paid.filter(item => item.date === date).reduce((sum, item) => sum + numeric(item.amount), 0);
  const rangeIncome = inRange.filter(item => item.paymentStatus === "paid").reduce((sum, item) => sum + numeric(item.amount), 0);
  const collections = doctorCollectionSnapshot(database, doctorId, date);
  return {
    date,
    totalBookings: active.length,
    todayAppointments: todayBookings.length,
    totalPatients: uniquePatients.size,
    completedToday: completed.filter(item => item.date === date).length,
    pendingToday: todayBookings.filter(item => ["pending", "confirmed", "checked-in"].includes(String(item.status || "").toLowerCase())).length,
    totalIncome,
    todayIncome,
    rangeIncome,
    rangeDays: Number(rangeDays) || 30,
    currency: "INR",
    collections
  };
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      const error = new Error("Request body is too large");
      error.statusCode = 413;
      throw error;
    }
  }
  if (!body.trim()) return {};
  try {
    return JSON.parse(body);
  } catch {
    const error = new Error("Request body must be valid JSON");
    error.statusCode = 400;
    throw error;
  }
}

async function readText(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      throw Object.assign(new Error("Request body is too large"), { statusCode: 413 });
    }
  }
  return body;
}

function listDoctors(database, searchParams) {
  const includePending = searchParams.get("includePending") === "true";
  let list = database.doctors.filter(item => includePending || verified(item));
  const query = (searchParams.get("q") || searchParams.get("search") || "").toLowerCase();
  const status = (searchParams.get("status") || "").toLowerCase();
  const specialty = (searchParams.get("specialty") || "").toLowerCase();
  const gender = (searchParams.get("gender") || "").toLowerCase();
  const availability = (searchParams.get("availability") || "").toLowerCase();
  const maxFee = numeric(searchParams.get("maxFee"), Infinity);
  const maxDistance = numeric(searchParams.get("maxDistance"), Infinity);
  if (query) list = list.filter(item => `${item.name} ${item.specialty} ${item.clinic} ${item.location}`.toLowerCase().includes(query));
  if (status) list = list.filter(item => String(item.status).toLowerCase() === status);
  if (specialty) list = list.filter(item => item.specialty.toLowerCase().includes(specialty));
  if (gender) list = list.filter(item => item.gender.toLowerCase() === gender);
  if (availability) list = list.filter(item => item.availability.toLowerCase().includes(availability));
  list = list.filter(item => item.fee <= maxFee && item.distance <= maxDistance);
  return includePending ? list : list.map(publicDoctor);
}

function listLabs(database, searchParams) {
  const includePending = searchParams.get("includePending") === "true";
  let list = database.labs.filter(item => includePending || verified(item));
  const query = (searchParams.get("q") || searchParams.get("search") || searchParams.get("test") || "").toLowerCase();
  const homeOnly = searchParams.get("homeCollection") === "true";
  const maxPrice = numeric(searchParams.get("maxPrice"), Infinity);
  const maxDistance = numeric(searchParams.get("maxDistance"), Infinity);
  if (query) list = list.filter(item => `${item.name} ${item.test} ${item.location} ${(item.tests || []).map(test => test.name).join(" ")}`.toLowerCase().includes(query));
  if (homeOnly) list = list.filter(item => item.homeCollection);
  return list.filter(item => item.price <= maxPrice && item.distance <= maxDistance);
}

function calculateOverview(database) {
  const pendingDoctors = database.doctors.filter(item => {
    const status = String(item.status || "").toLowerCase();
    return status === "pending" || (!status && !verified(item));
  }).length;
  const rejectedDoctors = database.doctors.filter(item => String(item.status).toLowerCase() === "rejected").length;
  const pendingLabs = database.labs.filter(item => !verified(item)).length;
  return {
    users: database.users.length,
    totalUsers: database.users.length,
    doctors: database.doctors.filter(verified).length,
    totalDoctors: database.doctors.filter(verified).length,
    labs: database.labs.filter(verified).length,
    totalLabs: database.labs.filter(verified).length,
    bookings: database.bookings.length,
    totalBookings: database.bookings.length,
    pendingDoctors,
    rejectedDoctors,
    pendingLabs,
    revenue: database.bookings
      .filter(item => String(item.status).toLowerCase() !== "cancelled")
      .reduce((sum, item) => sum + numeric(item.amount), 0),
    activeCity: database.meta?.city || "Prayagraj",
    publicFacilities: (database.publicFacilities || []).length,
    healthSupportLocations: (database.healthSupportLocations || []).length,
    governmentSchemes: (database.governmentSchemes || []).length
    ,insurancePlans: (database.insurancePlans || []).length
  };
}

const ecosystemCollections = Object.freeze({
  "public-care/facilities": "publicFacilities",
  "health-support/locations": "healthSupportLocations",
  "health-support/schemes": "governmentSchemes",
  "health-support/insurance": "insurancePlans"
});

function radians(value) { return Number(value) * Math.PI / 180; }
function distanceKm(fromLat, fromLng, toLat, toLng) {
  const earthKm = 6371;
  const dLat = radians(toLat - fromLat), dLng = radians(toLng - fromLng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(fromLat)) * Math.cos(radians(toLat)) * Math.sin(dLng / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function sameText(left, right) { return Boolean(left && right) && String(left).trim().toLowerCase() === String(right).trim().toLowerCase(); }

function ecosystemList(items, searchParams, includeInactive = false) {
  let list = includeInactive ? [...(items || [])] : (items || []).filter(item => item.active !== false);
  const lat = optionalNumber(searchParams.get("lat")), lng = optionalNumber(searchParams.get("lng"));
  const filters = { state: "state", district: "district", city: "city", block: "block", pincode: "pincode", type: "type", facilityType: "facilityType", category: "category", governmentLevel: "governmentLevel", insuranceType: "insuranceType" };
  for (const [queryKey, field] of Object.entries(filters)) {
    const wanted = String(searchParams.get(queryKey) || "").trim().toLowerCase();
    if (wanted) list = list.filter(item => {
      if (lat != null && lng != null && ["state","district","city","block","pincode"].includes(queryKey) && item.latitude != null && item.longitude != null) return true;
      return String(item[field] || "").toLowerCase() === wanted;
    });
  }
  const status = String(searchParams.get("status") || "").toLowerCase();
  if (status === "active") list = list.filter(item => item.active !== false);
  if (["inactive", "disabled"].includes(status)) list = list.filter(item => item.active === false);
  const query = String(searchParams.get("search") || "").trim().toLowerCase().slice(0, 120);
  if (query) list = list.filter(item => `${item.name || ""} ${item.planName || ""} ${item.provider || ""} ${item.address || ""} ${item.district || ""} ${item.city || ""} ${item.block || ""} ${item.pincode || ""}`.toLowerCase().includes(query));
  const radiusKm = Math.min(100, Math.max(1, numeric(searchParams.get("radius"), 25000) / 1000));
  let locationMatch = null;
  if (lat != null && lng != null) {
    list = list.map(item => {
      if (item.latitude == null || item.longitude == null) return item;
      return { ...item, distanceKm: Math.round(distanceKm(lat, lng, item.latitude, item.longitude) * 10) / 10 };
    });
    const nearby = list.filter(item => item.distanceKm != null && item.distanceKm <= radiusKm).sort((a, b) => a.distanceKm - b.distanceKm);
    const withoutCoordinates = list.filter(item => item.distanceKm == null);
    if (nearby.length) { list = [...nearby, ...withoutCoordinates]; locationMatch = "nearby"; }
  }
  const requestedDistrict = searchParams.get("district"), requestedState = searchParams.get("state");
  if (!list.length && !includeInactive && requestedDistrict) {
    list = (items || []).filter(item => item.active !== false && sameText(item.district, requestedDistrict));
    locationMatch = "district-fallback";
  }
  if (!list.length && !includeInactive && requestedState) {
    list = (items || []).filter(item => item.active !== false && sameText(item.state, requestedState));
    locationMatch = "state-fallback";
  }
  const page = Math.max(1, numeric(searchParams.get("page"), 1));
  const limit = Math.min(50, Math.max(1, numeric(searchParams.get("limit"), 20)));
  const total = list.length;
  return { items: list.slice((page - 1) * limit, page * limit), pagination: { page, limit, total, pages: Math.ceil(total / limit) }, locationMatch };
}

function googleComponent(components, ...types) {
  return components?.find(component => types.some(type => component.types?.includes(type)))?.longText || "";
}
function normalizeGooglePlace(place = {}) {
  const components = place.addressComponents || [];
  const countryCode = components.find(component => component.types?.includes("country"))?.shortText || "";
  const locality = googleComponent(components, "locality", "postal_town", "administrative_area_level_3");
  const sublocality = googleComponent(components, "sublocality_level_1", "sublocality", "neighborhood");
  const name = place.displayName?.text || sublocality || locality || googleComponent(components, "administrative_area_level_2", "administrative_area_level_1");
  return {
    provider:"google", placeId: place.id || place.placeId || "", name, formattedAddress: place.formattedAddress || "",
    latitude: place.location?.latitude ?? null, longitude: place.location?.longitude ?? null,
    country: googleComponent(components, "country") || "India", countryCode: countryCode || "IN",
    state: googleComponent(components, "administrative_area_level_1"),
    district: googleComponent(components, "administrative_area_level_2"),
    city: googleComponent(components, "locality"), town: googleComponent(components, "postal_town"),
    village: googleComponent(components, "administrative_area_level_3"), locality, sublocality,
    postalCode: googleComponent(components, "postal_code")
  };
}
function normalizeNominatimPlace(place = {}) {
  const address = place.address || {}, osmType = String(place.osm_type || "").slice(0,1).toUpperCase();
  return { provider:"openstreetmap", placeId:osmType && place.osm_id ? `osm:${osmType}:${place.osm_id}` : "", name:place.name || address.village || address.town || address.city || address.suburb || String(place.display_name || "").split(",")[0], formattedAddress:place.display_name || "", latitude:optionalNumber(place.lat), longitude:optionalNumber(place.lon), country:address.country || "India", countryCode:String(address.country_code || "in").toUpperCase(), state:address.state || "", district:address.state_district || address.county || "", city:address.city || "", town:address.town || "", village:address.village || "", locality:address.suburb || address.city_district || address.village || address.town || address.city || "", sublocality:address.neighbourhood || address.quarter || "", postalCode:address.postcode || "" };
}

function normalizeEcosystemInput(input, collection, existing = {}) {
  const allowed = collection === "publicFacilities"
    ? ["name","facilityType","country","state","district","city","town","village","locality","sublocality","block","pincode","address","formattedAddress","placeId","phone","email","latitude","longitude","opdTimings","emergencyAvailable","services","departments","description","sourceUrl","active","verified","notes"]
    : collection === "healthSupportLocations"
      ? ["name","type","country","state","district","city","town","village","locality","sublocality","block","pincode","address","formattedAddress","placeId","phone","email","latitude","longitude","openingHours","services","description","active","verified"]
      : collection === "governmentSchemes"
        ? ["name","slug","governmentLevel","state","category","shortDescription","description","eligibility","benefits","requiredDocuments","applicationProcess","officialUrl","active","verified"]
        : ["provider","planName","insuranceType","state","shortDescription","description","eligibility","benefits","officialUrl","active","verified"];
  const item = { ...existing };
  for (const key of allowed) if (Object.hasOwn(input, key)) item[key] = input[key];
  for (const key of ["name","planName","provider","country","state","district","city","town","village","locality","sublocality","block","pincode","address","formattedAddress","placeId","phone","email","description","shortDescription","eligibility","applicationProcess","officialUrl","sourceUrl","notes","opdTimings","openingHours","category","slug"]) {
    if (Object.hasOwn(item, key)) item[key] = String(item[key] ?? "").trim().slice(0, key.includes("description") || key === "eligibility" ? 4000 : 300);
  }
  for (const key of ["services","departments","benefits","requiredDocuments"]) if (Object.hasOwn(item, key)) item[key] = asArray(item[key]).slice(0, 50).map(value => String(value).slice(0, 200));
  for (const key of ["emergencyAvailable","active","verified"]) if (typeof item[key] === "string") item[key] = item[key] === "true";
  item.active = item.active !== false;
  item.verified = item.verified === true;
  for (const key of ["latitude","longitude"]) if (Object.hasOwn(item, key)) item[key] = optionalNumber(item[key]);
  if (!item.country && ["publicFacilities", "healthSupportLocations"].includes(collection)) item.country = "India";
  item.updatedAt = new Date().toISOString();
  item.lastUpdated = item.updatedAt;
  return item;
}

function validateEcosystemItem(item, collection) {
  const enums = {
    publicFacilities: ["GOVT_HOSPITAL", "PHC", "CHC", "SADAR_HOSPITAL", "MEDICAL_COLLEGE", "OTHER"],
    healthSupportLocations: ["JAN_AUSHADHI", "PHARMACY", "OTHER"],
    governmentSchemes: ["CENTRAL", "STATE", "DISTRICT"],
    insurancePlans: ["GOVERNMENT", "PRIVATE"]
  };
  if (collection === "insurancePlans") {
    if (!item.provider || !item.planName) return "Provider and plan name are required";
    if (item.insuranceType && !enums.insurancePlans.includes(item.insuranceType)) return "Invalid insurance type";
  } else if (!item.name) return "Name is required";
  const enumField = ({ publicFacilities: "facilityType", healthSupportLocations: "type", governmentSchemes: "governmentLevel" })[collection];
  if (enumField && (!item[enumField] || !enums[collection].includes(item[enumField]))) return `Invalid ${enumField}`;
  if (item.pincode && !/^[1-9][0-9]{5}$/.test(item.pincode)) return "PIN code must contain six digits";
  if (item.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)) return "A valid email is required";
  if (item.officialUrl || item.sourceUrl) {
    try { const url = new URL(item.officialUrl || item.sourceUrl); if (!["http:", "https:"].includes(url.protocol)) throw new Error(); } catch { return "Official URL must use HTTP or HTTPS"; }
  }
  return "";
}

function fallbackRecommendation({ query = "", doctors = [], labs = [] }) {
  const normalized = query.toLowerCase();
  const emergency = /(severe chest|chest pain|breathing|faint|unconscious|सीने|सांस|बेहोश)/i.test(normalized);
  if (emergency) {
    return {
      type: "safety",
      intent: { emergency: true },
      results: [],
      resultIds: [],
      answer: "This may need urgent attention. If there is severe chest pain, breathing difficulty or fainting, call local emergency services or go to the nearest emergency department now.",
      warning: "Sehat AI is not a substitute for emergency care.",
      disclaimer: "Sehat AI does not diagnose or prescribe."
    };
  }
  const wantsLab = /\b(?:lab|labs|test|tests|thyroid|cbc|blood|vitamin|pathology|diagnostic)\b|जांच|खून/i.test(normalized);
  const candidates = wantsLab ? [...labs] : [...doctors];
  const gender = /(female|lady|महिला)/i.test(normalized) ? "Female" : /(male|पुरुष)/i.test(normalized) ? "Male" : null;
  const specialty = /(skin|derma|त्वचा)/i.test(normalized) ? "Dermatologist"
    : /(heart|cardio|दिल)/i.test(normalized) ? "Cardiologist"
    : /(child|pediatric|paediatric|बच्च)/i.test(normalized) ? "Paediatrician"
    : /(bone|joint|ortho|हड्डी)/i.test(normalized) ? "Orthopaedic" : null;
  const budget = numeric(normalized.match(/(?:₹|rs\.?|under|andar|अंदर)\s*(\d{2,5})/i)?.[1], Infinity);
  let matches = candidates.filter(item => verified(item));
  if (!wantsLab && gender) matches = matches.filter(item => item.gender === gender);
  if (!wantsLab && specialty) matches = matches.filter(item => item.specialty === specialty);
  matches = matches.filter(item => numeric(wantsLab ? item.price : item.fee) <= budget);
  matches.sort((a, b) => wantsLab ? a.price - b.price || b.rating - a.rating : b.rating - a.rating || a.fee - b.fee || a.distance - b.distance);
  const results = matches.slice(0, 3);
  return {
    type: wantsLab ? "lab" : "doctor",
    intent: { budget: Number.isFinite(budget) ? budget : null, gender, specialty },
    results,
    resultIds: results.map(item => item.id),
    answer: results.length
      ? `I found ${results.length} verified ${wantsLab ? "lab" : "doctor"} options matching your request. Compare price, distance and availability before booking.`
      : "I could not find an exact verified match. Try increasing your budget or distance.",
    disclaimer: "Sehat AI helps with discovery and comparison. It does not diagnose, prescribe or guarantee a provider."
  };
}

function updateQueue(queue, action, payload, database, workspace = doctorWorkspaceFor(database, queue.doctorId)) {
  const now = new Date().toISOString();
  if (["start", "resume"].includes(action)) queue.status = "live";
  if (action === "pause") queue.status = "paused";
  if (action === "close") queue.status = "closed";
  if (action === "delay") queue.delayMinutes = numeric(payload.delayMinutes ?? payload.minutes, queue.delayMinutes || 0);
  if (action === "settings") queue.expectedMinutes = numeric(payload.expectedMinutes, queue.expectedMinutes || 15);
  if (action === "next") {
    const previous = queue.current;
    if (previous?.appointmentId) {
      const appointment = workspace.appointments.find(item => item.id === previous.appointmentId);
      if (appointment) appointment.status = "completed";
      const booking = database.bookings.find(item => item.id === previous.appointmentId && item.doctorId === queue.doctorId);
      if (booking) booking.status = "completed";
    }
    queue.current = queue.waiting.shift() || null;
    queue.currentToken = queue.current?.token || "—";
    queue.seen = numeric(queue.seen) + (previous ? 1 : 0);
    if (queue.current?.appointmentId) {
      const appointment = workspace.appointments.find(item => item.id === queue.current.appointmentId);
      if (appointment) appointment.status = "in-progress";
      const booking = database.bookings.find(item => item.id === queue.current.appointmentId && item.doctorId === queue.doctorId);
      if (booking) booking.status = "in-progress";
    }
    queue.waiting = queue.waiting.map((item, index) => ({ ...item, wait: Math.max(0, numeric(queue.expectedMinutes, 15) * (index + 1) + numeric(queue.delayMinutes)) }));
  }
  if (action === "notify") {
    database.notifications.unshift(normalizeNotification({
      title: "Clinic queue update",
      message: "Your doctor’s live queue has been updated. Check your latest token estimate.",
      audience: "Queue patients",
      icon: "activity"
    }));
  }
  queue.remaining = Math.max(0, Number(queue.capacity || 0) - Number(queue.issued || 0));
  queue.updatedAt = now;
  return queue;
}

async function routeApi(request, response, url, store, runtime = {}) {
  const { pathname, searchParams } = url;
  const method = request.method;
  const database = store.snapshot();
  const providerFetch = runtime.providerFetch || fetch;
  const locationApiKey = String(runtime.googleMapsServerApiKey ?? googleMapsServerApiKey).trim();
  const runtimeLogger = runtime.logger || console;
  const useIdentitySandbox = runtime.identitySandboxEnabled ?? identitySandboxEnabled;
  const useOtpSandbox = runtime.otpSandboxEnabled ?? otpSandboxEnabled;
  const paymentGateway = {
    keyId: String(runtime.razorpayKeyId ?? razorpayKeyId).trim(),
    keySecret: String(runtime.razorpayKeySecret ?? razorpayKeySecret).trim(),
    webhookSecret: String(runtime.razorpayWebhookSecret ?? razorpayWebhookSecret).trim()
  };
  const paymentGatewayConfigured = Boolean(paymentGateway.keyId && paymentGateway.keySecret);
  const adminAuth = runtime.adminAuth;
  const doctorSessions = runtime.doctorSessions;
  const patientSessions = runtime.patientSessions;
  const authenticatedPatientId = patientSessions.get(bearerToken(request)) || "";
  const requirePatient = () => {
    if (!authenticatedPatientId) throw Object.assign(new Error("Patient login required"), { statusCode: 401, code: "PATIENT_AUTH_REQUIRED" });
    return authenticatedPatientId;
  };

  const requireDoctor = () => {
    const doctorId = doctorSessions.get(bearerToken(request));
    if (!doctorId) throw Object.assign(new Error("Doctor login required"), { statusCode: 401 });
    return doctorId;
  };

  if (runtime.requirePatientAuth && ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const protectedPatientPath = pathname === "/api/users"
      || pathname === "/api/reports"
      || pathname === "/api/bookings"
      || pathname === "/api/appointments"
      || /^\/api\/(bookings|appointments)\/[^/]+$/.test(pathname)
      || /^\/api\/queues\/[^/]+$/.test(pathname);
    if (protectedPatientPath) requirePatient();
  }
  if (runtime.requireDoctorAuth && pathname.startsWith("/api/doctor/") && !pathname.startsWith("/api/doctor/request-otp") && !pathname.startsWith("/api/doctor/verify-otp")) {
    requireDoctor();
  }

  if (method === "OPTIONS") {
    sendJson(response, 204, null);
    return true;
  }

  if ((pathname === "/api/health" || pathname === "/health") && method === "GET") {
    sendJson(response, 200, {
      status: "ok",
      service: "sehatline-api",
      version: "0.1.0",
      city: database.meta?.city,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    });
    return true;
  }
  if (pathname === "/api/docs" && method === "GET") {
    sendJson(response, 200, apiReference);
    return true;
  }

  if (/^\/api\/doctors\/[^/]+$/.test(pathname) && ["PATCH", "PUT", "DELETE"].includes(method)) {
    const auth = await adminAuth.authenticate(request);
    adminAuth.verifyCsrf(request, auth);
    adminAuth.requirePermission(auth, "doctor_management");
  }

  if (pathname === "/api/auth/otp/config" && method === "GET") {
    if (msg91WidgetConfigured) {
      sendJson(response, 200, {
        mode: "msg91-widget",
        widgetId: msg91WidgetId,
        tokenAuth: msg91WidgetToken
      });
    } else if (useOtpSandbox) {
      sendJson(response, 200, { mode: "local-sandbox" });
    } else {
      sendJson(response, 503, {
        mode: "unconfigured",
        error: { message: "Live SMS OTP is not configured" }
      });
    }
    return true;
  }

  if (pathname === "/api/admin/auth/login" && method === "POST") {
    const result = await adminAuth.login(await readJson(request), adminAuth.clientMeta(request));
    sendJson(response, 200, { admin: result.admin, csrfToken: result.csrfToken, mustChangePassword: result.admin.mustChangePassword }, { "Set-Cookie": adminAuth.cookie(result.token, result.remember) });
    return true;
  }
  if (pathname === "/api/admin/auth/me" && method === "GET") {
    const auth = await adminAuth.authenticate(request);
    sendJson(response, 200, { admin: (await adminAuth.authenticate(request)).admin, csrfToken: auth.session.csrfToken });
    return true;
  }
  if (pathname === "/api/admin/auth/change-password" && method === "POST") {
    const auth = await adminAuth.authenticate(request);
    adminAuth.verifyCsrf(request, auth);
    await adminAuth.changePassword(auth, await readJson(request));
    sendJson(response, 200, { changed: true }, { "Set-Cookie": adminAuth.clearCookie() });
    return true;
  }
  if (pathname === "/api/admin/auth/logout" && method === "POST") {
    const auth = await adminAuth.authenticate(request);
    adminAuth.verifyCsrf(request, auth);
    await adminAuth.logout(auth);
    sendJson(response, 200, { loggedOut: true }, { "Set-Cookie": adminAuth.clearCookie() });
    return true;
  }
  if (pathname === "/api/admin/overview" && method === "GET") {
    const auth = await adminAuth.authenticate(request);
    if (auth.admin.mustChangePassword) throw Object.assign(new Error("Password change required"), { statusCode: 403, code: "PASSWORD_CHANGE_REQUIRED" });
    adminAuth.requirePermission(auth, "dashboard");
    sendJson(response, 200, calculateOverview(database));
    return true;
  }

  if (pathname === "/api/uploads/profile-photo" && method === "POST") {
    const input = await readJson(request);
    const match = String(input.dataUrl || "").match(/^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) { sendError(response, 422, "A valid profile image is required"); return true; }
    const uploadRoot = path.resolve(runtime.uploadRoot || process.env.SEHATLINE_UPLOAD_ROOT || path.join(projectRoot, "uploads"));
    await mkdir(uploadRoot, { recursive: true });
    const filename = `${String(input.role || "profile").replace(/[^a-z0-9-]/gi, "-")}-${randomUUID()}.${match[1] === "jpeg" ? "jpg" : match[1]}`;
    await writeFile(path.join(uploadRoot, filename), Buffer.from(match[2], "base64"));
    sendJson(response, 201, { url: `/uploads/${filename}` });
    return true;
  }
  if (pathname === "/api/location/autocomplete" && method === "GET") {
    const input = String(searchParams.get("input") || "").trim().slice(0, 160);
    if (input.length < 2) { sendJson(response, 200, { suggestions: [] }); return true; }
    if (!locationApiKey) {
      runtimeLogger.warn?.("[SehatLine Location] Google key missing; using OpenStreetMap search fallback.");
      try {
        const fallbackResponse = await providerFetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=in&limit=6&q=${encodeURIComponent(input)}`, { headers:{ "User-Agent":"SehatLine/1.0", "Accept-Language":"en-IN,en" } });
        if (!fallbackResponse.ok) throw new Error(`status ${fallbackResponse.status}`);
        const places = await fallbackResponse.json();
        const suggestions = places.map(normalizeNominatimPlace).filter(place => place.placeId).map(place => ({ placeId:place.placeId, text:place.formattedAddress, primaryText:place.name, secondaryText:place.formattedAddress.split(",").slice(1).join(",").trim() }));
        sendJson(response, 200, { suggestions, provider:"openstreetmap-fallback" }); return true;
      } catch (error) { runtimeLogger.error?.(`[SehatLine Location] Fallback autocomplete failed: ${error.message}`); sendJson(response, 503, { error:{ code:"LOCATION_PROVIDER_UNAVAILABLE", message:"Unable to search locations right now. Please try again." } }); return true; }
    }
    const sessionToken = String(searchParams.get("sessionToken") || "").trim().slice(0, 80);
    const providerResponse = await providerFetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": locationApiKey, "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat" },
      body: JSON.stringify({ input, ...(sessionToken ? { sessionToken } : {}), includedRegionCodes: ["in"], regionCode: "in", languageCode: "en" })
    });
    if (!providerResponse.ok) { const diagnostic = await providerResponse.text().catch(() => ""); runtimeLogger.error?.(`[SehatLine Location] Google autocomplete failed (${providerResponse.status}) ${diagnostic.slice(0,500)}`); sendJson(response, 503, { error:{ code:"GOOGLE_PLACES_REQUEST_FAILED", message:"Unable to search locations right now. Please try again." } }); return true; }
    const payload = await providerResponse.json();
    const suggestions = (payload.suggestions || []).map(entry => entry.placePrediction).filter(Boolean).slice(0, 6).map(place => ({ placeId: place.placeId, text: place.text?.text || "", primaryText: place.structuredFormat?.mainText?.text || place.text?.text || "", secondaryText: place.structuredFormat?.secondaryText?.text || "" }));
    sendJson(response, 200, { suggestions }); return true;
  }
  if (pathname === "/api/location/place" && method === "GET") {
    const placeId = String(searchParams.get("placeId") || "").trim();
    if (placeId.startsWith("osm:")) {
      const [,type,id] = placeId.split(":");
      try {
        const fallbackResponse = await providerFetch(`https://nominatim.openstreetmap.org/lookup?format=jsonv2&addressdetails=1&osm_ids=${encodeURIComponent(type + id)}`, { headers:{ "User-Agent":"SehatLine/1.0", "Accept-Language":"en-IN,en" } });
        if (!fallbackResponse.ok) throw new Error();
        const location = normalizeNominatimPlace((await fallbackResponse.json())[0] || {});
        if (!location.placeId) { sendError(response,404,"Location details were not found"); return true; }
        sendJson(response,200,location); return true;
      } catch { sendJson(response,503,{ error:{ code:"LOCATION_DETAILS_FAILED",message:"Location details are temporarily unavailable" } }); return true; }
    }
    if (!placeId || !locationApiKey) { sendJson(response, locationApiKey ? 422 : 503, { error:{ code:locationApiKey ? "PLACE_ID_REQUIRED" : "GOOGLE_MAPS_NOT_CONFIGURED", message:locationApiKey ? "Place ID is required" : "Location search is temporarily unavailable" } }); return true; }
    const providerResponse = await providerFetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en&regionCode=in`, { headers: { "X-Goog-Api-Key": locationApiKey, "X-Goog-FieldMask": "id,displayName,formattedAddress,addressComponents,location" } });
    if (!providerResponse.ok) { runtimeLogger.error?.(`[SehatLine Location] Google place details failed (${providerResponse.status})`); sendJson(response, 503, { error:{ code:"GOOGLE_PLACE_DETAILS_FAILED", message:"Location details are temporarily unavailable" } }); return true; }
    const location = normalizeGooglePlace(await providerResponse.json());
    if (location.countryCode && location.countryCode !== "IN") { sendError(response, 422, "Please select a location in India"); return true; }
    sendJson(response, 200, location); return true;
  }
  if (pathname === "/api/location/reverse" && method === "POST") {
    const input = await readJson(request), latitude = optionalNumber(input.latitude), longitude = optionalNumber(input.longitude);
    if (latitude == null || longitude == null) { sendError(response, 422, "Valid coordinates are required"); return true; }
    if (!locationApiKey) {
      try {
        const fallbackResponse = await providerFetch(`https://nominatim.openstreetmap.org/reverse?format=json&countrycodes=in&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`, { headers:{ "User-Agent":"SehatLine/1.0" } });
        if (!fallbackResponse.ok) throw new Error();
        const payload = await fallbackResponse.json(), address = payload.address || {};
        sendJson(response, 200, { placeId:String(payload.place_id || ""), name:address.village || address.town || address.city || address.suburb || "Current location", formattedAddress:payload.display_name || "", latitude, longitude, country:address.country || "India", countryCode:String(address.country_code || "in").toUpperCase(), state:address.state || "", district:address.state_district || address.county || "", city:address.city || "", town:address.town || "", village:address.village || "", locality:address.suburb || address.village || address.town || address.city || "", sublocality:address.neighbourhood || "", postalCode:address.postcode || "" }); return true;
      } catch { sendError(response, 503, "Location detection is temporarily unavailable"); return true; }
    }
    const providerResponse = await providerFetch(`https://geocode.googleapis.com/v4/geocode/location?location.latitude=${encodeURIComponent(latitude)}&location.longitude=${encodeURIComponent(longitude)}&languageCode=en&regionCode=in`, { headers: { "X-Goog-Api-Key": locationApiKey, "X-Goog-FieldMask": "results.placeId,results.formattedAddress,results.addressComponents,results.location" } });
    if (!providerResponse.ok) { runtimeLogger.error?.(`[SehatLine Location] Google reverse geocoding failed (${providerResponse.status})`); sendJson(response, 503, { error:{ code:"GOOGLE_GEOCODING_FAILED", message:"Unable to identify your current location" } }); return true; }
    const payload = await providerResponse.json(), location = normalizeGooglePlace(payload.results?.[0] || {});
    location.latitude = latitude; location.longitude = longitude;
    if (location.countryCode && location.countryCode !== "IN") { sendError(response, 422, "Your current location is outside India"); return true; }
    sendJson(response, 200, location); return true;
  }
  if (pathname === "/api/support/tickets" && method === "POST") {
    const input = await readJson(request);
    const name = firstText(input.name).slice(0,100), email = firstText(input.email).toLowerCase().slice(0,160), phone = phoneDigits(input.phone), subject = firstText(input.subject).slice(0,160), message = firstText(input.message).slice(0,3000);
    const role = ["patient","doctor","receptionist","partner","other"].includes(input.role) ? input.role : "patient";
    const category = ["booking","payment","login","queue","doctor","lab","report","location","account","technical","feedback","other"].includes(input.category) ? input.category : "other";
    if (name.length < 2) { sendError(response,422,"Please enter your name"); return true; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && phone.length !== 10) { sendError(response,422,"Enter a valid email or 10-digit mobile number"); return true; }
    if (subject.length < 4 || message.length < 10) { sendError(response,422,"Add a clear subject and at least 10 characters of detail"); return true; }
    const now = new Date(), reference = `SL-SUP-${now.toISOString().slice(0,10).replaceAll("-","")}-${randomUUID().slice(0,6).toUpperCase()}`;
    const ticket = { id:slugId("support-ticket"), reference, name, email, phone:phone ? `+91 ${phone.slice(0,5)} ${phone.slice(5)}` : "", role, category, subject, message, sourceUrl:firstText(input.sourceUrl).slice(0,300), status:"open", priority:"normal", adminNote:"", assignedTo:"", createdAt:now.toISOString(), updatedAt:now.toISOString() };
    await store.mutate(data => { data.supportTickets ||= []; data.supportTickets.unshift(ticket); });
    sendJson(response,201,{ reference:ticket.reference, status:ticket.status, createdAt:ticket.createdAt }); return true;
  }
  const adminSupportMatch = pathname.match(/^\/api\/admin\/support-tickets(?:\/([^/]+))?$/);
  if (adminSupportMatch) {
    const auth = await adminAuth.authenticate(request);
    adminAuth.requirePermission(auth,"complaints_support");
    const id = adminSupportMatch[1] ? decodeURIComponent(adminSupportMatch[1]) : "";
    if (method === "GET" && !id) {
      let tickets = [...(database.supportTickets || [])];
      const status = String(searchParams.get("status") || "").toLowerCase(); if (status && status !== "all") tickets = tickets.filter(ticket => ticket.status === status);
      sendJson(response,200,{ items:tickets, total:tickets.length }); return true;
    }
    const existing = (database.supportTickets || []).find(ticket => ticket.id === id || ticket.reference === id);
    if (!existing) { sendError(response,404,"Support ticket not found"); return true; }
    if (method === "GET") { sendJson(response,200,existing); return true; }
    if (method === "PATCH") {
      adminAuth.verifyCsrf(request,auth); const input = await readJson(request);
      const allowedStatus = ["open","in_progress","waiting_user","resolved","closed"];
      const updated = { status:allowedStatus.includes(input.status) ? input.status : existing.status, priority:["low","normal","high","urgent"].includes(input.priority) ? input.priority : existing.priority, adminNote:Object.hasOwn(input,"adminNote") ? firstText(input.adminNote).slice(0,2000) : existing.adminNote, assignedTo:auth.admin.fullName || auth.admin.id, updatedAt:new Date().toISOString(), ...(input.status === "resolved" ? { resolvedAt:new Date().toISOString() } : {}) };
      await store.mutate(data => Object.assign(data.supportTickets.find(ticket => ticket.id === existing.id),updated)); sendJson(response,200,{...existing,...updated}); return true;
    }
  }
  const adminDataRoutes = new Map([
    ["/api/admin/doctors", ["doctor_management", "doctor_verification"]],
    ["/api/admin/labs", ["document_approval"]],
    ["/api/admin/bookings", ["live_queue"]],
    ["/api/admin/patients", ["patient_management"]],
    ["/api/admin/notifications", ["complaints_support"]]
  ]);
  if (adminDataRoutes.has(pathname) && method === "GET") {
    const auth = await adminAuth.authenticate(request);
    if (auth.admin.mustChangePassword) throw Object.assign(new Error("Password change required"), { statusCode: 403, code: "PASSWORD_CHANGE_REQUIRED" });
    const permissions = adminDataRoutes.get(pathname);
    if (!permissions.some(permission => auth.admin.role === "super_admin" || auth.admin.permissions?.includes(permission))) {
      adminAuth.requirePermission(auth, permissions[0]);
    }
    const payload = pathname.endsWith("/doctors")
      ? listDoctors(database, new URLSearchParams("includePending=true"))
      : pathname.endsWith("/labs")
        ? database.labs
        : pathname.endsWith("/bookings")
          ? database.bookings
          : pathname.endsWith("/patients")
            ? database.users
            : database.notifications;
    sendJson(response, 200, payload);
    return true;
  }
  if (pathname === "/api/admin/users" && method === "GET") {
    const auth = await adminAuth.authenticate(request);
    adminAuth.requirePermission(auth, "admin_management");
    sendJson(response, 200, adminAuth.listAdmins());
    return true;
  }
  if (pathname === "/api/admin/users" && method === "POST") {
    const auth = await adminAuth.authenticate(request);
    adminAuth.verifyCsrf(request, auth);
    adminAuth.requirePermission(auth, "admin_management");
    const created = await adminAuth.createAdmin(await readJson(request), { actor: auth.admin, meta: auth.meta });
    sendJson(response, 201, created);
    return true;
  }
  const adminUserMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)(?:\/(reset-password|status))?$/);
  if (adminUserMatch) {
    const auth = await adminAuth.authenticate(request);
    adminAuth.verifyCsrf(request, auth);
    adminAuth.requirePermission(auth, "admin_management");
    const [, targetId, action] = adminUserMatch;
    if (action === "reset-password" && method === "POST") {
      sendJson(response, 200, await adminAuth.resetPassword(auth, targetId));
      return true;
    }
    if (action === "status" && method === "PATCH") {
      sendJson(response, 200, await adminAuth.setStatus(auth, targetId, (await readJson(request)).status));
      return true;
    }
    if (!action && method === "PATCH") {
      sendJson(response, 200, await adminAuth.updateAdmin(auth, targetId, await readJson(request)));
      return true;
    }
  }
  if (pathname === "/api/admin/audit-logs" && method === "GET") {
    const auth = await adminAuth.authenticate(request);
    adminAuth.requirePermission(auth, "audit_logs");
    sendJson(response, 200, adminAuth.listAuditLogs(searchParams.get("limit")));
    return true;
  }

  if (pathname === "/api/doctor/onboarding/plan" && method === "GET") {
    sendJson(response, 200, { ...DOCTOR_LAUNCH_PLAN, gateway: "razorpay", paymentConfigured: paymentGatewayConfigured });
    return true;
  }
  if (pathname === "/api/doctor/onboarding/payment/order" && method === "POST") {
    if (!paymentGatewayConfigured) {
      sendError(response, 503, "Live payment gateway is not configured", ["Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env.local"]);
      return true;
    }
    const input = await readJson(request);
    const doctor = database.doctors.find(item => item.id === String(input.doctorId || ""));
    if (!doctor || phoneDigits(doctor.phone) !== phoneDigits(input.phone)) {
      sendError(response, 404, "Doctor application was not found");
      return true;
    }
    if (doctor.onboarding?.payment?.status === "paid") {
      sendError(response, 409, "This onboarding plan is already paid");
      return true;
    }
    const order = await createRazorpayOrder(doctor, paymentGateway, providerFetch);
    await store.mutate(data => {
      const saved = data.doctors.find(item => item.id === doctor.id);
      saved.onboarding ||= {};
      saved.onboarding.payment = {
        ...(saved.onboarding.payment || {}),
        status: "order-created",
        gateway: "razorpay",
        planId: DOCTOR_LAUNCH_PLAN.id,
        orderId: order.id,
        receipt: order.receipt,
        amountPaise: DOCTOR_LAUNCH_PLAN.amountPaise,
        currency: DOCTOR_LAUNCH_PLAN.currency,
        orderCreatedAt: new Date().toISOString()
      };
    });
    sendJson(response, 201, {
      keyId: paymentGateway.keyId,
      orderId: order.id,
      amount: DOCTOR_LAUNCH_PLAN.amountPaise,
      currency: DOCTOR_LAUNCH_PLAN.currency,
      plan: DOCTOR_LAUNCH_PLAN,
      prefill: { name: doctor.name, email: doctor.email, contact: doctor.phone }
    });
    return true;
  }
  if (pathname === "/api/doctor/onboarding/payment/verify" && method === "POST") {
    if (!paymentGatewayConfigured) { sendError(response, 503, "Live payment gateway is not configured"); return true; }
    const input = await readJson(request);
    const doctor = database.doctors.find(item => item.id === String(input.doctorId || ""));
    const payment = doctor?.onboarding?.payment;
    const orderId = String(payment?.orderId || "");
    const paymentId = String(input.razorpay_payment_id || "");
    const suppliedOrderId = String(input.razorpay_order_id || "");
    const signature = String(input.razorpay_signature || "");
    if (!doctor || !orderId || orderId !== suppliedOrderId || !paymentId || !verifyRazorpayPaymentSignature(orderId, paymentId, signature, paymentGateway.keySecret)) {
      sendError(response, 401, "Payment verification failed");
      return true;
    }
    const providerPayment = await fetchRazorpayPayment(paymentId, paymentGateway, providerFetch);
    if (providerPayment.order_id !== orderId
      || Number(providerPayment.amount) !== DOCTOR_LAUNCH_PLAN.amountPaise
      || String(providerPayment.currency) !== DOCTOR_LAUNCH_PLAN.currency
      || providerPayment.status !== "captured") {
      sendError(response, 409, "Payment is verified but has not been captured yet");
      return true;
    }
    const paidAt = new Date().toISOString();
    await store.mutate(data => {
      const saved = data.doctors.find(item => item.id === doctor.id);
      saved.onboarding.payment = { ...saved.onboarding.payment, status: "paid", paymentId, paidAt, verifiedAt: paidAt };
    });
    sendJson(response, 200, { verified: true, status: "paid", paymentId, paidAt, applicationId: doctor.id });
    return true;
  }

  const publicEcosystemMatch = pathname.match(/^\/api\/(public-care\/facilities|health-support\/(?:locations|schemes|insurance))(?:\/([^/]+))?$/);
  if (publicEcosystemMatch && method === "GET") {
    const collection = ecosystemCollections[publicEcosystemMatch[1]];
    const id = publicEcosystemMatch[2] ? decodeURIComponent(publicEcosystemMatch[2]) : "";
    if (id) {
      const item = (database[collection] || []).find(entry => entry.id === id && entry.active !== false);
      if (!item) { sendError(response, 404, "Healthcare resource not found"); return true; }
      sendJson(response, 200, item);
    } else {
      sendJson(response, 200, ecosystemList(database[collection], searchParams));
    }
    return true;
  }

  const adminEcosystemMatch = pathname.match(/^\/api\/admin\/(public-facilities|health-support-locations|health-support\/locations|government-schemes|insurance-plans|insurance)(?:\/([^/]+))?(?:\/(status))?$/);
  if (adminEcosystemMatch) {
    const auth = await adminAuth.authenticate(request);
    if (auth.admin.mustChangePassword) throw Object.assign(new Error("Password change required"), { statusCode: 403, code: "PASSWORD_CHANGE_REQUIRED" });
    adminAuth.requirePermission(auth, "dashboard");
    if (!["super_admin", "admin", "verification_admin"].includes(auth.admin.role)) throw Object.assign(new Error("Healthcare Network management permission required"), { statusCode: 403, code: "PERMISSION_DENIED" });
    const collection = ({ "public-facilities": "publicFacilities", "health-support-locations": "healthSupportLocations", "health-support/locations": "healthSupportLocations", "government-schemes": "governmentSchemes", "insurance-plans": "insurancePlans", insurance: "insurancePlans" })[adminEcosystemMatch[1]];
    const id = adminEcosystemMatch[2] ? decodeURIComponent(adminEcosystemMatch[2]) : "";
    const statusAction = adminEcosystemMatch[3] === "status";
    if (method === "GET") {
      if (id && !(database[collection] || []).some(item => item.id === id)) { sendError(response, 404, "Healthcare resource not found"); return true; }
      sendJson(response, 200, id ? (database[collection] || []).find(item => item.id === id) : ecosystemList(database[collection], searchParams, true));
      return true;
    }
    adminAuth.verifyCsrf(request, auth);
    if (method === "POST" && !id) {
      const input = await readJson(request);
      const item = normalizeEcosystemInput(input, collection, { id: slugId(collection.replace(/[A-Z]/g, value => `-${value.toLowerCase()}`)), createdAt: new Date().toISOString(), createdBy: auth.admin.id });
      const validationError = validateEcosystemItem(item, collection);
      if (validationError) { sendError(response, 422, validationError); return true; }
      await store.mutate(data => { data[collection] ||= []; data[collection].unshift(item); });
      sendJson(response, 201, item); return true;
    }
    const existing = (database[collection] || []).find(item => item.id === id);
    if (!existing) { sendError(response, 404, "Healthcare resource not found"); return true; }
    if (["PUT", "PATCH"].includes(method)) {
      const input = await readJson(request);
      const updated = normalizeEcosystemInput(statusAction ? { active: input.active } : input, collection, existing);
      const validationError = validateEcosystemItem(updated, collection);
      if (validationError) { sendError(response, 422, validationError); return true; }
      await store.mutate(data => Object.assign(data[collection].find(item => item.id === id), updated));
      sendJson(response, 200, updated); return true;
    }
    if (method === "DELETE") {
      await store.mutate(data => { data[collection] = data[collection].filter(item => item.id !== id); });
      sendJson(response, 200, { deleted: true, id }); return true;
    }
  }

  const savedItemMatch = pathname.match(/^\/api\/patient\/saved\/(public-facility|health-support|scheme|insurance)\/([^/]+)$/);
  if (savedItemMatch && ["POST", "DELETE"].includes(method)) {
    const patientId = requirePatient();
    const relation = ({ "public-facility": "savedPublicFacilities", "health-support": "savedHealthSupportLocations", scheme: "savedSchemes", insurance: "savedInsurancePlans" })[savedItemMatch[1]];
    const collection = ({ "public-facility": "publicFacilities", "health-support": "healthSupportLocations", scheme: "governmentSchemes", insurance: "insurancePlans" })[savedItemMatch[1]];
    const itemId = decodeURIComponent(savedItemMatch[2]);
    if (method === "POST" && !(database[collection] || []).some(item => item.id === itemId && item.active !== false)) { sendError(response, 404, "Active healthcare item not found"); return true; }
    let saved = false;
    await store.mutate(data => {
      const patient = data.users.find(item => item.id === patientId);
      if (!patient) throw Object.assign(new Error("Patient profile not found"), { statusCode: 404 });
      patient[relation] ||= [];
      if (method === "POST" && !patient[relation].includes(itemId)) patient[relation].push(itemId);
      if (method === "DELETE") patient[relation] = patient[relation].filter(id => id !== itemId);
      saved = patient[relation].includes(itemId);
    });
    sendJson(response, 200, { id: itemId, saved }); return true;
  }
  if (pathname === "/api/patient/saved-items" && method === "GET") {
    const patientId = requirePatient();
    const patient = database.users.find(item => item.id === patientId);
    if (!patient) { sendError(response, 404, "Patient profile not found"); return true; }
    const groups = [
      ["PUBLIC_FACILITY", "savedPublicFacilities", "publicFacilities"],
      ["JAN_AUSHADHI", "savedHealthSupportLocations", "healthSupportLocations"],
      ["GOVERNMENT_SCHEME", "savedSchemes", "governmentSchemes"],
      ["INSURANCE", "savedInsurancePlans", "insurancePlans"]
    ];
    const items = groups.flatMap(([itemType, relation, collection]) => (patient[relation] || []).map(itemId => {
      const item = (database[collection] || []).find(entry => entry.id === itemId);
      return item?.active === false || !item ? null : { id: `${itemType}:${itemId}`, itemType, itemId, item };
    }).filter(Boolean));
    sendJson(response, 200, { items, total: items.length }); return true;
  }
  if (pathname === "/api/patient/saved-items" && method === "POST") {
    const patientId = requirePatient(), input = await readJson(request), itemType = String(input.itemType || "").toUpperCase(), itemId = String(input.itemId || "");
    const config = ({ PUBLIC_FACILITY: ["savedPublicFacilities", "publicFacilities"], JAN_AUSHADHI: ["savedHealthSupportLocations", "healthSupportLocations"], GOVERNMENT_SCHEME: ["savedSchemes", "governmentSchemes"], INSURANCE: ["savedInsurancePlans", "insurancePlans"] })[itemType];
    if (!config || !itemId) { sendError(response, 422, "Valid itemType and itemId are required"); return true; }
    if (!(database[config[1]] || []).some(item => item.id === itemId && item.active !== false)) { sendError(response, 404, "Active healthcare item not found"); return true; }
    await store.mutate(data => { const patient = data.users.find(item => item.id === patientId); if (!patient) throw Object.assign(new Error("Patient profile not found"), { statusCode: 404 }); patient[config[0]] ||= []; if (!patient[config[0]].includes(itemId)) patient[config[0]].push(itemId); });
    sendJson(response, 200, { id: `${itemType}:${itemId}`, itemType, itemId, saved: true }); return true;
  }
  const genericSavedDelete = pathname.match(/^\/api\/patient\/saved-items\/(PUBLIC_FACILITY|JAN_AUSHADHI|GOVERNMENT_SCHEME|INSURANCE):([^/]+)$/i);
  if (genericSavedDelete && method === "DELETE") {
    const patientId = requirePatient(), itemType = genericSavedDelete[1].toUpperCase(), itemId = decodeURIComponent(genericSavedDelete[2]);
    const relation = ({ PUBLIC_FACILITY: "savedPublicFacilities", JAN_AUSHADHI: "savedHealthSupportLocations", GOVERNMENT_SCHEME: "savedSchemes", INSURANCE: "savedInsurancePlans" })[itemType];
    await store.mutate(data => { const patient = data.users.find(item => item.id === patientId); if (!patient) throw Object.assign(new Error("Patient profile not found"), { statusCode: 404 }); patient[relation] = (patient[relation] || []).filter(id => id !== itemId); });
    sendJson(response, 200, { itemType, itemId, saved: false }); return true;
  }
  if (pathname === "/api/patient/payments/order" && method === "POST") {
    const patientId = requirePatient();
    if (!paymentGatewayConfigured) { sendError(response, 503, "Online appointment payment is not configured"); return true; }
    const input = await readJson(request);
    const doctor = database.doctors.find(item => item.id === String(input.doctorId || "") && verified(item));
    const date = String(input.date || "");
    const time = String(input.time || "").slice(0, 5);
    const schedule = database.doctorSchedules?.[doctor?.id]?.[date];
    const slot = schedule?.slots?.find(item => item.time === time && item.available !== false);
    if (!doctor || !slot) { sendError(response, 409, "This appointment slot is no longer available"); return true; }
    const existingReservation = activePaymentReservation(database, doctor.id, date, time);
    if (existingReservation && existingReservation.patientId !== patientId) { sendError(response, 409, "This slot is being paid for by another patient"); return true; }
    const amountPaise = Math.max(100, Math.round(numeric(doctor.fee) * 100));
    const order = await createPatientBookingOrder({ doctor, patientId, date, time, amountPaise }, paymentGateway, providerFetch);
    await store.mutate(data => {
      data.patientPaymentOrders ||= {};
      data.patientPaymentOrders[order.id] = { orderId: order.id, patientId, doctorId: doctor.id, date, time, amountPaise, currency: "INR", status: "created", booking: { ...input.booking, patientId, doctorId: doctor.id, date, time }, expiresAt: Date.now() + PATIENT_PAYMENT_RESERVATION_MS, createdAt: new Date().toISOString() };
    });
    sendJson(response, 201, { keyId: paymentGateway.keyId, orderId: order.id, amount: amountPaise, currency: "INR", doctor: publicDoctor(doctor) });
    return true;
  }
  if (pathname === "/api/patient/payments/verify" && method === "POST") {
    const patientId = requirePatient();
    if (!paymentGatewayConfigured) { sendError(response, 503, "Online appointment payment is not configured"); return true; }
    const input = await readJson(request);
    const orderId = String(input.razorpay_order_id || "");
    const paymentId = String(input.razorpay_payment_id || "");
    const signature = String(input.razorpay_signature || "");
    const order = database.patientPaymentOrders?.[orderId];
    if (!order || order.patientId !== patientId || !paymentId || !verifyRazorpayPaymentSignature(orderId, paymentId, signature, paymentGateway.keySecret)) {
      sendError(response, 401, "Appointment payment verification failed"); return true;
    }
    const providerPayment = await fetchRazorpayPayment(paymentId, paymentGateway, providerFetch);
    if (providerPayment.order_id !== orderId || Number(providerPayment.amount) !== Number(order.amountPaise) || providerPayment.currency !== "INR" || providerPayment.status !== "captured") {
      sendError(response, 409, "Payment has not been captured yet"); return true;
    }
    let booking;
    await store.mutate(data => {
      const savedOrder = data.patientPaymentOrders?.[orderId];
      if (savedOrder) booking = commitPaidPatientBooking(data, savedOrder, paymentId);
    });
    if (!booking) { sendError(response, 409, "Payment succeeded, but the slot could not be confirmed. Contact SehatLine support with the payment ID."); return true; }
    sendJson(response, 201, booking);
    return true;
  }
  if (pathname === "/api/payments/razorpay/webhook" && method === "POST") {
    if (!paymentGateway.webhookSecret) { sendError(response, 503, "Payment webhook is not configured"); return true; }
    const rawBody = await readText(request);
    const suppliedSignature = String(request.headers["x-razorpay-signature"] || "");
    const expectedSignature = createHmac("sha256", paymentGateway.webhookSecret).update(rawBody).digest("hex");
    if (!secureHexEqual(expectedSignature, suppliedSignature)) { sendError(response, 401, "Invalid payment webhook signature"); return true; }
    const event = JSON.parse(rawBody || "{}");
    const paymentEntity = event?.payload?.payment?.entity || {};
    const orderId = String(paymentEntity.order_id || "");
    if (["payment.captured", "order.paid"].includes(event.event) && orderId) {
      await store.mutate(data => {
        const saved = data.doctors.find(item => item.onboarding?.payment?.orderId === orderId);
        if (saved
          && Number(paymentEntity.amount) === DOCTOR_LAUNCH_PLAN.amountPaise
          && String(paymentEntity.currency) === DOCTOR_LAUNCH_PLAN.currency
          && paymentEntity.status === "captured") {
          saved.onboarding.payment = { ...saved.onboarding.payment, status: "paid", paymentId: paymentEntity.id || saved.onboarding.payment.paymentId, paidAt: new Date().toISOString(), webhookVerified: true };
        }
        const patientOrder = data.patientPaymentOrders?.[orderId];
        if (patientOrder
          && Number(paymentEntity.amount) === Number(patientOrder.amountPaise)
          && paymentEntity.currency === "INR"
          && paymentEntity.status === "captured") {
          commitPaidPatientBooking(data, patientOrder, paymentEntity.id);
        }
      });
    }
    sendJson(response, 200, { received: true });
    return true;
  }

  if (pathname === "/api/doctors" && method === "GET") {
    sendJson(response, 200, listDoctors(database, searchParams));
    return true;
  }
  if (pathname === "/api/doctors" && method === "POST") {
    const input = await readJson(request);
    const now = new Date().toISOString();
    const duplicate = database.doctors.find(item => phoneDigits(item.phone) === phoneDigits(input.phone)
      || (firstText(input.registrationNumber, input.licenseNumber) && String(item.registrationNumber || "").toLowerCase() === String(firstText(input.registrationNumber, input.licenseNumber)).toLowerCase()));
    if (duplicate) {
      sendError(response, 409, "A doctor application already exists for this mobile number or registration number", { applicationId: duplicate.id, status: duplicate.status });
      return true;
    }
    const profileInput = sanitizeDoctorProfileInput(input);
    const declarationAcceptedAt = firstText(input.verification?.declarationAcceptedAt, input.declarationAcceptedAt);
    const onboardingSchedule = normalizeOnboardingSchedule(input.onboarding?.schedule || input.schedule || {});
    const doctor = normalizeDoctor({
      ...profileInput,
      ...(declarationAcceptedAt ? { declarationAcceptedAt } : {}),
      status: "pending",
      verified: false,
      createdAt: now,
      appliedAt: now,
      verification: {
        status: "pending",
        submittedAt: now
      },
      onboarding: {
        schedule: onboardingSchedule,
        payment: {
          status: "pending",
          gateway: "razorpay",
          planId: DOCTOR_LAUNCH_PLAN.id,
          amountPaise: DOCTOR_LAUNCH_PLAN.amountPaise,
          currency: DOCTOR_LAUNCH_PLAN.currency
        }
      }
    });
    await store.mutate(data => data.doctors.unshift(doctor));
    sendJson(response, 201, doctor);
    return true;
  }
  const doctorMatch = pathname.match(/^\/api\/doctors\/([^/]+)$/);
  if (doctorMatch && method === "GET") {
    const doctor = database.doctors.find(item => item.id === decodeURIComponent(doctorMatch[1]));
    const includePending = searchParams.get("includePending") === "true";
    if (!doctor || (!verified(doctor) && !includePending)) sendError(response, 404, "Doctor not found");
    else sendJson(response, 200, includePending ? doctor : publicDoctor(doctor));
    return true;
  }
  if (doctorMatch && ["PUT", "PATCH"].includes(method)) {
    const input = sanitizeDoctorProfileInput(await readJson(request));
    let updated;
    await store.mutate(data => {
      const index = data.doctors.findIndex(item => item.id === decodeURIComponent(doctorMatch[1]));
      if (index < 0) return;
      updated = normalizeDoctor(input, data.doctors[index]);
      data.doctors[index] = updated;
    });
    if (!updated) sendError(response, 404, "Doctor not found");
    else sendJson(response, 200, updated);
    return true;
  }
  if (doctorMatch && method === "DELETE") {
    let removed = false;
    await store.mutate(data => {
      const index = data.doctors.findIndex(item => item.id === decodeURIComponent(doctorMatch[1]));
      if (index < 0) return;
      data.doctors.splice(index, 1);
      removed = true;
    });
    if (!removed) sendError(response, 404, "Doctor not found");
    else sendJson(response, 200, { deleted: true });
    return true;
  }
  const doctorVerifyMatch = pathname.match(/^\/api\/doctors\/([^/]+)\/verify$/);
  if (doctorVerifyMatch && method === "POST") {
    const input = await readJson(request);
    const auth = await adminAuth.authenticate(request);
    adminAuth.verifyCsrf(request, auth);
    adminAuth.requirePermission(auth, "doctor_verification");
    let updated;
    await store.mutate(data => {
      const doctor = data.doctors.find(item => item.id === decodeURIComponent(doctorVerifyMatch[1]));
      if (!doctor) return;
      const missing = missingDoctorVerificationFields(doctor);
      if (missing.length) {
        updated = { validationError: missing };
        return;
      }
      const now = new Date().toISOString();
      const approvedBy = auth.admin.adminId;
      const approvalNote = firstText(input.approvalNote, input.verificationNote, input.note);
      doctor.status = "verified";
      doctor.verified = true;
      doctor.verifiedAt = now;
      doctor.verifiedBy = approvedBy;
      doctor.approvedAt = now;
      doctor.approvedBy = approvedBy;
      doctor.approvalNote = approvalNote;
      doctor.reviewedAt = now;
      doctor.updatedAt = now;
      doctor.verification = {
        status: "verified",
        decision: "approved",
        reviewedAt: now,
        reviewer: approvedBy,
        note: approvalNote
      };
      doctor.verificationHistory = [
        ...(Array.isArray(doctor.verificationHistory) ? doctor.verificationHistory : []),
        {
          decision: "approved",
          at: now,
          reviewedBy: approvedBy,
          note: approvalNote
        }
      ];
      delete doctor.rejectedAt;
      delete doctor.rejectedBy;
      delete doctor.rejectionReason;
      doctorWorkspaceFor(data, doctor.id);
      updated = doctor;
    });
    if (!updated) sendError(response, 404, "Doctor not found");
    else if (updated.validationError) sendError(
      response,
      422,
      updated.validationError.includes("onboarding.payment.status") ? "Verified launch plan payment is required before approval" : "Doctor profile is incomplete",
      updated.validationError
    );
    else sendJson(response, 200, updated);
    return true;
  }
  const doctorRejectMatch = pathname.match(/^\/api\/doctors\/([^/]+)\/reject$/);
  if (doctorRejectMatch && method === "POST") {
    const input = await readJson(request);
    const reason = firstText(input.reason, input.rejectionReason);
    if (!reason) {
      sendError(response, 422, "A rejection reason is required", ["reason"]);
      return true;
    }
    let updated;
    await store.mutate(data => {
      const doctor = data.doctors.find(item => item.id === decodeURIComponent(doctorRejectMatch[1]));
      if (!doctor) return;
      const now = new Date().toISOString();
      const rejectedBy = firstText(input.rejectedBy, input.reviewer) || null;
      doctor.status = "rejected";
      doctor.verified = false;
      doctor.rejectedAt = now;
      doctor.rejectedBy = rejectedBy;
      doctor.rejectionReason = reason;
      doctor.reviewedAt = now;
      doctor.updatedAt = now;
      doctor.verification = {
        status: "rejected",
        decision: "rejected",
        reviewedAt: now,
        reviewer: rejectedBy,
        reason
      };
      doctor.verificationHistory = [
        ...(Array.isArray(doctor.verificationHistory) ? doctor.verificationHistory : []),
        {
          decision: "rejected",
          at: now,
          reviewedBy: rejectedBy,
          reason
        }
      ];
      delete doctor.verifiedAt;
      delete doctor.verifiedBy;
      delete doctor.approvedAt;
      delete doctor.approvedBy;
      delete doctor.approvalNote;
      updated = doctor;
    });
    if (!updated) sendError(response, 404, "Doctor not found");
    else sendJson(response, 200, updated);
    return true;
  }

  if (pathname === "/api/labs" && method === "GET") {
    sendJson(response, 200, listLabs(database, searchParams));
    return true;
  }
  if (pathname === "/api/labs" && method === "POST") {
    const input = await readJson(request);
    const lab = normalizeLab({ ...input, status: "pending", verified: false });
    await store.mutate(data => data.labs.unshift(lab));
    sendJson(response, 201, lab);
    return true;
  }
  const labMatch = pathname.match(/^\/api\/labs\/([^/]+)$/);
  if (labMatch && method === "GET") {
    const lab = database.labs.find(item => item.id === decodeURIComponent(labMatch[1]));
    if (!lab || (!verified(lab) && searchParams.get("includePending") !== "true")) sendError(response, 404, "PathLab not found");
    else sendJson(response, 200, lab);
    return true;
  }
  if (labMatch && ["PUT", "PATCH"].includes(method)) {
    const input = await readJson(request);
    let updated;
    await store.mutate(data => {
      const index = data.labs.findIndex(item => item.id === decodeURIComponent(labMatch[1]));
      if (index < 0) return;
      updated = normalizeLab(input, data.labs[index]);
      data.labs[index] = updated;
    });
    if (!updated) sendError(response, 404, "PathLab not found");
    else sendJson(response, 200, updated);
    return true;
  }
  const labVerifyMatch = pathname.match(/^\/api\/labs\/([^/]+)\/verify$/);
  if (labVerifyMatch && method === "POST") {
    let updated;
    await store.mutate(data => {
      const lab = data.labs.find(item => item.id === decodeURIComponent(labVerifyMatch[1]));
      if (!lab) return;
      const missing = [];
      if (!lab.name) missing.push("name");
      if (!lab.location) missing.push("location");
      if (!lab.tests?.some(test => numeric(test.price) > 0)) missing.push("priced test");
      if (missing.length) {
        updated = { validationError: missing };
        return;
      }
      lab.status = "verified";
      lab.verified = true;
      lab.verifiedAt = new Date().toISOString();
      updated = lab;
    });
    if (!updated) sendError(response, 404, "PathLab not found");
    else if (updated.validationError) sendError(response, 422, "PathLab profile is incomplete", updated.validationError);
    else sendJson(response, 200, updated);
    return true;
  }

  if ((pathname === "/api/bookings" || pathname === "/api/appointments") && method === "GET") {
    let bookings = database.bookings;
    if (authenticatedPatientId) bookings = bookings.filter(item => item.patientId === authenticatedPatientId);
    if (searchParams.get("patientId")) bookings = bookings.filter(item => item.patientId === searchParams.get("patientId"));
    if (searchParams.get("doctorId")) bookings = bookings.filter(item => item.doctorId === searchParams.get("doctorId"));
    sendJson(response, 200, bookings);
    return true;
  }
  if ((pathname === "/api/bookings" || pathname === "/api/appointments") && method === "POST") {
    const input = await readJson(request);
    const booking = normalizeBooking({
      ...input,
      patientId: authenticatedPatientId || input.patientId,
      paymentStatus: undefined,
      paymentVerified: false
    }, database);
    if (booking.providerType === "doctor") {
      if (input.paymentMode === "online") {
        sendError(response, 422, "Use the secure online payment checkout before confirming this appointment");
        return true;
      }
      const schedule = database.doctorSchedules?.[booking.doctorId]?.[booking.date];
      const queue = ensureDoctorQueue(database, booking.doctorId, booking.date);
      if (!schedule) {
        sendError(response, 409, "The doctor has not published appointment slots for this date");
        return true;
      }
      const requestedTime = String(booking.time || "").slice(0, 5);
      const reservation = activePaymentReservation(database, booking.doctorId, booking.date, requestedTime);
      if (reservation && reservation.patientId !== booking.patientId) {
        sendError(response, 409, "This appointment slot is being paid for by another patient");
        return true;
      }
      const selectedSlot = schedule.slots?.find(slot => slot.time === requestedTime && slot.available !== false);
      if (!selectedSlot) {
        sendError(response, 409, "This appointment slot is no longer available");
        return true;
      }
      if (queue.issued >= schedule.capacity) {
        sendError(response, 409, "The doctor's daily appointment capacity is full");
        return true;
      }
    }
    let committed = true;
    await store.mutate(data => {
      if (booking.providerType === "doctor") committed = commitDoctorBooking(data, booking);
      else {
        data.bookings.unshift(booking);
        data.notifications.unshift(normalizeNotification({ title: "Lab booking confirmed", message: `${booking.providerName} is booked for ${booking.date} at ${booking.time}.`, audience: "Single patient", icon: "check-circle" }));
      }
    });
    if (!committed) {
      sendError(response, 409, "This appointment slot is no longer available");
      return true;
    }
    sendJson(response, 201, booking);
    return true;
  }
  const bookingMatch = pathname.match(/^\/api\/(?:bookings|appointments)\/([^/]+)$/);
  if (bookingMatch && method === "GET") {
    const booking = database.bookings.find(item => item.id === decodeURIComponent(bookingMatch[1]));
    if (!booking) sendError(response, 404, "Booking not found");
    else if (authenticatedPatientId && booking.patientId !== authenticatedPatientId) sendError(response, 403, "This appointment belongs to another patient");
    else sendJson(response, 200, booking);
    return true;
  }
  if (bookingMatch && ["PUT", "PATCH"].includes(method)) {
    const input = await readJson(request);
    let updated;
    await store.mutate(data => {
      const index = data.bookings.findIndex(item => item.id === decodeURIComponent(bookingMatch[1]));
      if (index < 0) return;
      if (authenticatedPatientId && data.bookings[index].patientId !== authenticatedPatientId) return;
      const current = data.bookings[index];
      updated = normalizeBooking({
        ...current,
        ...input,
        id: current.id,
        patientId: current.patientId,
        paymentMode: current.paymentMode,
        paymentStatus: current.paymentStatus,
        paymentVerified: current.paymentVerified
      }, data);
      data.bookings[index] = updated;
      const doctorAppointment = updated.doctorId ? doctorWorkspaceFor(data, updated.doctorId).appointments.find(item => item.id === updated.id) : null;
      if (doctorAppointment) Object.assign(doctorAppointment, doctorAppointmentFromBooking(updated, data.doctorWorkspace), { id: updated.id });
    });
    if (!updated) sendError(response, 404, "Booking not found");
    else sendJson(response, 200, updated);
    return true;
  }
  if (bookingMatch && method === "DELETE") {
    let removed;
    await store.mutate(data => {
      const index = data.bookings.findIndex(item => item.id === decodeURIComponent(bookingMatch[1]));
      if (index >= 0 && authenticatedPatientId && data.bookings[index].patientId !== authenticatedPatientId) return;
      if (index >= 0) removed = data.bookings.splice(index, 1)[0];
      if (removed?.doctorId) {
        const workspace = doctorWorkspaceFor(data, removed.doctorId);
        workspace.appointments = workspace.appointments.filter(item => item.id !== decodeURIComponent(bookingMatch[1]));
      }
    });
    if (!removed) sendError(response, 404, "Booking not found");
    else sendJson(response, 200, removed);
    return true;
  }

  if (pathname === "/api/users" && method === "GET") {
    sendJson(response, 200, database.users);
    return true;
  }
  if (pathname === "/api/reports" && method === "GET") {
    const patientId = searchParams.get("patientId");
    sendJson(response, 200, patientId ? database.reports.filter(item => item.patientId === patientId) : database.reports);
    return true;
  }
  if (pathname === "/api/notifications" && method === "GET") {
    sendJson(response, 200, database.notifications);
    return true;
  }
  if (pathname === "/api/notifications" && method === "POST") {
    const notification = normalizeNotification(await readJson(request));
    await store.mutate(data => data.notifications.unshift(notification));
    sendJson(response, 201, notification);
    return true;
  }

  const queueMatch = pathname.match(/^\/api\/queues\/([^/]+)$/);
  if (queueMatch && method === "GET") {
    const doctorId = decodeURIComponent(queueMatch[1]);
    const requestedDate = String(searchParams.get("date") || new Date().toISOString().slice(0, 10));
    const token = String(searchParams.get("token") || "").trim();
    if (!token) {
      sendError(response, 422, "An appointment token is required to view the live queue");
      return true;
    }
    const booking = database.bookings.find(item => item.doctorId === doctorId
      && item.date === requestedDate
      && item.token === token
      && (!authenticatedPatientId || item.patientId === authenticatedPatientId));
    if (!booking) {
      sendError(response, 404, "No matching appointment was found for this queue token");
      return true;
    }
    let queue = database.queues?.[doctorId];
    if (queue && queue.date !== requestedDate) {
      await store.mutate(data => { queue = ensureDoctorQueue(data, doctorId, requestedDate); });
    }
    if (!queue) sendError(response, 404, "Queue not found");
    else {
      const waitingIndex = queue.waiting.findIndex(item => item.token === token && item.appointmentId === booking.id);
      const isCurrent = queue.current?.token === token && queue.current?.appointmentId === booking.id;
      const bookingStatus = String(booking.status || "").toLowerCase();
      const patientStatus = isCurrent
        ? "in-progress"
        : waitingIndex >= 0
          ? "waiting"
          : bookingStatus === "completed"
            ? "completed"
            : queue.status === "closed"
              ? "clinic-closed"
              : "not-in-queue";
      const ahead = isCurrent ? 0 : waitingIndex >= 0 ? waitingIndex + (queue.current ? 1 : 0) : 0;
      const expectedMinutes = Math.max(1, numeric(queue.expectedMinutes, 15));
      const etaMinutes = patientStatus === "in-progress"
        ? 0
        : patientStatus === "waiting" && queue.status === "live"
          ? Math.max(0, ahead * expectedMinutes + numeric(queue.delayMinutes))
          : null;
      const message = patientStatus === "in-progress"
        ? "Your consultation is in progress."
        : patientStatus === "completed"
          ? "Your consultation is complete."
          : queue.status === "paused"
            ? "The clinic queue is paused. Your token remains secured."
            : queue.status === "closed"
              ? "The clinic queue has not started or is closed for the day."
              : patientStatus === "waiting"
                ? ahead === 0 ? "You are next. Please stay near the clinic." : `${ahead} patient${ahead === 1 ? "" : "s"} ahead of your token.`
                : "Your token is not currently waiting in the live queue.";
      sendJson(response, 200, {
        doctorId,
        date: queue.date,
        status: queue.status,
        capacity: numeric(queue.capacity),
        issued: numeric(queue.issued),
        remaining: Math.max(0, Number(queue.capacity || 0) - Number(queue.issued || 0)),
        currentToken: queue.current?.token || queue.currentToken || "—",
        expectedMinutes,
        delayMinutes: numeric(queue.delayMinutes),
        updatedAt: queue.updatedAt,
        live: { token, patientStatus, ahead, etaMinutes, message }
      });
    }
    return true;
  }
  const queueActionMatch = pathname.match(/^\/api\/queues\/([^/]+)\/action$/);
  if (queueActionMatch && method === "POST") {
    const payload = await readJson(request);
    let queue;
    await store.mutate(data => {
      const doctorId = decodeURIComponent(queueActionMatch[1]);
      queue = ensureDoctorQueue(data, doctorId, String(payload.date || new Date().toISOString().slice(0, 10)));
      if (queue) updateQueue(queue, payload.action, payload, data);
    });
    if (!queue) sendError(response, 404, "Queue not found");
    else sendJson(response, 200, queue);
    return true;
  }

  if (pathname === "/api/doctor/dashboard" && method === "GET") {
    const doctorId = requireDoctor();
    const date = String(searchParams.get("date") || new Date().toISOString().slice(0, 10));
    const income = doctorIncomeSnapshot(database, doctorId, date, 30);
    const queue = ensureDoctorQueue(database, doctorId, date);
    sendJson(response, 200, {
      metrics: [
        { label: "Today's appointments", value: String(income.todayAppointments), trend: `${queue.remaining} tokens open`, icon: "calendar", tone: "mint" },
        { label: "Total patients", value: String(income.totalPatients), trend: "Verified bookings", icon: "users", tone: "blue" },
        { label: "Waiting now", value: String(queue.waiting.length), trend: queue.status === "live" ? "Queue live" : "Queue closed", icon: "clock", tone: "amber" },
        { label: "Today's income", value: `₹${income.todayIncome.toLocaleString("en-IN")}`, trend: `${income.completedToday} completed`, icon: "rupee", tone: "violet" }
      ],
      income,
      collections: income.collections,
      queue
    });
    return true;
  }
  if (pathname === "/api/doctor/schedule" && method === "GET") {
    const doctorId = requireDoctor();
    const date = String(searchParams.get("date") || new Date().toISOString().slice(0, 10));
    const schedule = database.doctorSchedules?.[doctorId]?.[date] || null;
    sendJson(response, 200, schedule);
    return true;
  }
  if (pathname === "/api/doctor/schedule" && method === "PUT") {
    const doctorId = requireDoctor();
    const input = await readJson(request);
    const date = String(input.date || new Date().toISOString().slice(0, 10));
    const capacity = Math.max(1, Number(input.maxDailyTokens) || 100);
    const patientsPerHour = Math.max(1, Math.min(12, Number(input.patientsPerHour) || Math.round(60 / (Number(input.durationMinutes) || 15))));
    const durationMinutes = Math.max(5, Number(input.durationMinutes) || Math.round(60 / patientsPerHour));
    const slots = scheduleSlots(input.startTime, input.endTime, durationMinutes, capacity);
    if (!slots.length) { sendError(response, 422, "Provide a valid schedule window"); return true; }
    const existingQueue = ensureDoctorQueue(database, doctorId, date);
    if (slots.length < Number(existingQueue.issued || 0)) { sendError(response, 409, "Daily capacity cannot be lower than tokens already issued"); return true; }
    const bookedTimes = new Set(doctorBookings(database, doctorId).filter(item => item.date === date && !["cancelled", "rejected"].includes(String(item.status || "").toLowerCase())).map(item => String(item.time || "").slice(0, 5)));
    slots.forEach(slot => { if (bookedTimes.has(slot.time)) slot.available = false; });
    const schedule = { id: `schedule-${date}`, doctorId, date, startTime: input.startTime, endTime: input.endTime, patientsPerHour, durationMinutes, capacity: slots.length, maxDailyTokens: capacity, bookedCount: existingQueue.issued || bookedTimes.size, remainingTokens: Math.max(0, slots.length - Number(existingQueue.issued || bookedTimes.size)), slots };
    await store.mutate(data => {
      data.doctorSchedules ||= {};
      data.doctorSchedules[doctorId] ||= {};
      data.doctorSchedules[doctorId][date] = schedule;
      const workspace = doctorWorkspaceFor(data, doctorId);
      workspace.schedules = workspace.schedules.filter(item => item.date !== date);
      workspace.schedules.push(schedule);
      const queue = ensureDoctorQueue(data, doctorId, date);
      queue.capacity = slots.length;
      queue.expectedMinutes = durationMinutes;
      queue.remaining = Math.max(0, slots.length - Number(queue.issued || 0));
    });
    sendJson(response, 200, schedule);
    return true;
  }
  const doctorSlotsMatch = pathname.match(/^\/api\/doctors\/([^/]+)\/slots$/);
  if (doctorSlotsMatch && method === "GET") {
    const doctorId = decodeURIComponent(doctorSlotsMatch[1]);
    const schedule = database.doctorSchedules?.[doctorId]?.[searchParams.get("date")];
    if (!schedule) sendJson(response, 200, { doctorId, date: searchParams.get("date"), capacity: 0, slots: [], paymentConfigured: paymentGatewayConfigured });
    else sendJson(response, 200, { ...schedule, slots: (schedule.slots || []).map(slot => ({ time: slot.time, available: slot.available !== false, status: slot.available === false ? "booked" : "available" })), paymentConfigured: paymentGatewayConfigured });
    return true;
  }
  if (pathname === "/api/doctor/appointments" && method === "GET") {
    const doctorId = requireDoctor();
    let appointments = doctorWorkspaceFor(database, doctorId).appointments;
    const requestedDate = searchParams.get("date");
    const targetDate = requestedDate === "today" ? new Date().toISOString().slice(0, 10) : requestedDate;
    if (targetDate) appointments = appointments.filter(item => !item.date || item.date === targetDate);
    sendJson(response, 200, appointments);
    return true;
  }
  if (pathname === "/api/doctor/appointments" && method === "POST") {
    const doctorId = requireDoctor();
    const input = await readJson(request);
    const appointment = { ...input, doctorId, id: input.id || slugId("apt"), status: String(input.status || "pending").toLowerCase() };
    await store.mutate(data => doctorWorkspaceFor(data, doctorId).appointments.push(appointment));
    sendJson(response, 201, appointment);
    return true;
  }
  const doctorAppointmentMatch = pathname.match(/^\/api\/doctor\/appointments\/([^/]+)$/);
  if (doctorAppointmentMatch && method === "PATCH") {
    const doctorId = requireDoctor();
    const input = await readJson(request);
    const {
      paymentMode: ignoredPaymentMode,
      paymentStatus: ignoredPaymentStatus,
      paymentVerified: ignoredPaymentVerified,
      paymentId: ignoredPaymentId,
      paymentOrderId: ignoredPaymentOrderId,
      amount: ignoredAmount,
      ...safeInput
    } = input;
    let appointment;
    await store.mutate(data => {
      appointment = doctorWorkspaceFor(data, doctorId).appointments.find(item => item.id === decodeURIComponent(doctorAppointmentMatch[1]));
      if (appointment) Object.assign(appointment, safeInput, { updatedAt: new Date().toISOString() });
      const booking = data.bookings.find(item => item.id === decodeURIComponent(doctorAppointmentMatch[1]) && item.doctorId === doctorId);
      if (booking) Object.assign(booking, safeInput, { updatedAt: new Date().toISOString() });
    });
    if (!appointment) sendError(response, 404, "Appointment not found");
    else sendJson(response, 200, appointment);
    return true;
  }
  const doctorAppointmentSubMatch = pathname.match(/^\/api\/doctor\/appointments\/([^/]+)\/(reschedule|notes)$/);
  if (doctorAppointmentSubMatch && method === "POST") {
    const doctorId = requireDoctor();
    const input = await readJson(request);
    let appointment;
    await store.mutate(data => {
      appointment = doctorWorkspaceFor(data, doctorId).appointments.find(item => item.id === decodeURIComponent(doctorAppointmentSubMatch[1]));
      if (!appointment) return;
      if (doctorAppointmentSubMatch[2] === "reschedule") Object.assign(appointment, input, { status: "confirmed" });
      else appointment.note = input.note || "";
      appointment.updatedAt = new Date().toISOString();
    });
    if (!appointment) sendError(response, 404, "Appointment not found");
    else sendJson(response, 200, appointment);
    return true;
  }
  if (pathname === "/api/doctor/queue" && method === "GET") {
    const doctorId = requireDoctor();
    const date = String(searchParams.get("date") || new Date().toISOString().slice(0, 10));
    let queue;
    await store.mutate(data => { queue = ensureDoctorQueue(data, doctorId, date); });
    sendJson(response, 200, queue);
    return true;
  }
  const doctorQueueAction = pathname.match(/^\/api\/doctor\/queue\/(start|resume|pause|next|notify|close|delay|settings)$/);
  if (doctorQueueAction && ["POST", "PATCH"].includes(method)) {
    const doctorId = requireDoctor();
    const payload = await readJson(request);
    let queue;
    await store.mutate(data => {
      const date = String(payload.date || new Date().toISOString().slice(0, 10));
      queue = ensureDoctorQueue(data, doctorId, date);
      updateQueue(queue, doctorQueueAction[1], payload, data, doctorWorkspaceFor(data, doctorId));
    });
    sendJson(response, 200, queue);
    return true;
  }
  if (pathname === "/api/doctor/patients" && method === "GET") {
    const doctorId = requireDoctor();
    sendJson(response, 200, doctorWorkspaceFor(database, doctorId).patients);
    return true;
  }
  if (pathname === "/api/doctor/profile" && method === "GET") {
    const doctorId = requireDoctor();
    sendJson(response, 200, doctorWorkspaceFor(database, doctorId).profile);
    return true;
  }
  if (pathname === "/api/doctor/profile" && method === "PUT") {
    const doctorId = requireDoctor();
    const input = await readJson(request);
    let profile;
    await store.mutate(data => {
      const workspace = doctorWorkspaceFor(data, doctorId);
      profile = { ...workspace.profile, ...input, updatedAt: new Date().toISOString() };
      workspace.profile = profile;
      const index = data.doctors.findIndex(item => item.id === doctorId);
      if (index >= 0) {
        const publicUpdates = {
          name: profile.name,
          specialty: profile.specialisation || profile.specialty,
          clinic: profile.clinic,
          address: profile.address,
          location: profile.address,
          languages: profile.languages,
          services: Array.isArray(profile.services) ? profile.services.map(service => service.name || service) : undefined,
          fee: profile.services?.[0]?.fee ?? data.doctors[index].fee
        };
        data.doctors[index] = normalizeDoctor(publicUpdates, data.doctors[index]);
      }
    });
    sendJson(response, 200, profile);
    return true;
  }
  if (pathname === "/api/doctor/analytics" && method === "GET") {
    const doctorId = requireDoctor();
    const range = numeric(searchParams.get("range"), 30);
    const income = doctorIncomeSnapshot(database, doctorId, new Date().toISOString().slice(0, 10), range);
    sendJson(response, 200, {
      totalBookings: income.totalBookings,
      repeatPatients: "0%",
      revenue: `₹${income.rangeIncome.toLocaleString("en-IN")}`,
      todayIncome: income.todayIncome,
      totalIncome: income.totalIncome,
      rating: "0",
      cancellationRate: "0%",
      range,
      income
    });
    return true;
  }

  if (pathname === "/api/auth/patient/identity/start" && method === "POST") {
    const input = await readJson(request);
    if (hasRawIdentityData(input)) {
      sendError(response, 422, "Do not send raw Aadhaar numbers, VID, face images or biometric data to SehatLine");
      return true;
    }
    const phone = phoneDigits(input.phone);
    if (phone.length !== 10) {
      sendError(response, 422, "Verify a valid mobile number before identity verification");
      return true;
    }
    if (input.consent !== true) {
      sendError(response, 422, "Explicit identity-verification consent is required");
      return true;
    }
    if (!useIdentitySandbox) {
      sendError(response, 503, "UIDAI-authorised identity provider is not configured", [
        "Configure an approved Aadhaar requesting entity or verification provider",
        "Use UIDAI FaceRD for face authentication",
        "Never send raw biometrics through this API"
      ]);
      return true;
    }
    const verificationId = `identity-${randomUUID()}`;
    identitySessions.set(verificationId, {
      id: verificationId,
      phone,
      profile: {
        name: firstText(input.profile?.name),
        dateOfBirth: firstText(input.profile?.dateOfBirth)
      },
      method: "aadhaar-face",
      status: "pending",
      sandbox: true,
      createdAt: new Date().toISOString()
    });
    sendJson(response, 201, {
      verificationId,
      status: "pending",
      method: "aadhaar-face",
      provider: "UIDAI sandbox adapter",
      sandbox: true,
      nextAction: "launch-face-rd"
    });
    return true;
  }

  if (pathname === "/api/auth/patient/identity/complete" && method === "POST") {
    const input = await readJson(request);
    if (hasRawIdentityData(input)) {
      sendError(response, 422, "Do not send raw Aadhaar numbers, VID, face images or biometric data to SehatLine");
      return true;
    }
    const verification = identitySessions.get(String(input.verificationId || ""));
    if (!verification) {
      sendError(response, 404, "Identity verification session was not found or has expired");
      return true;
    }
    if (!useIdentitySandbox || verification.sandbox !== true) {
      sendError(response, 503, "UIDAI-authorised identity provider is not configured");
      return true;
    }
    const verifiedAt = new Date().toISOString();
    let user;
    await store.mutate(data => {
      const existingIndex = data.users.findIndex(item => phoneDigits(item.phone) === verification.phone);
      const existing = existingIndex >= 0 ? data.users[existingIndex] : {};
      user = {
        ...existing,
        id: existing.id || slugId("user"),
        name: verification.profile.name || existing.name || "SehatLine Member",
        phone: existing.phone || `+91 ${verification.phone.slice(0, 5)} ${verification.phone.slice(5)}`,
        dateOfBirth: verification.profile.dateOfBirth || existing.dateOfBirth || "",
        bookings: numeric(existing.bookings),
        lastActive: "Just now",
        status: "active",
        identityVerification: {
          status: "sandbox-verified",
          method: "aadhaar-face",
          provider: "UIDAI sandbox adapter",
          reference: verification.id,
          verifiedAt,
          rawIdentityStored: false
        }
      };
      if (existingIndex >= 0) data.users[existingIndex] = user;
      else data.users.push(user);
    });
    identitySessions.delete(verification.id);
    const patientSessionToken = `demo-${randomUUID()}`;
    patientSessions.set(patientSessionToken, user.id);
    sendJson(response, 200, {
      verified: true,
      sandbox: true,
      identityStatus: "sandbox-verified",
      token: patientSessionToken,
      user
    });
    return true;
  }

  if ((pathname === "/api/auth/send-otp" || pathname === "/api/auth/doctor/request-otp") && method === "POST") {
    const input = await readJson(request);
    const phone = phoneDigits(input.phone);
    if (phone.length !== 10) {
      sendError(response, 422, "Enter a valid phone number");
      return true;
    }
    const previousSend = otpSendTimes.get(phone) || 0;
    if (Date.now() - previousSend < 30_000) {
      sendError(response, 429, "Please wait 30 seconds before requesting another OTP");
      return true;
    }
    if (msg91SendOtpConfigured) {
      try {
        const providerResult = await sendMsg91Otp(phone);
        otpSendTimes.set(phone, Date.now());
        sendJson(response, 200, {
          sent: true,
          phone: `+91${phone}`,
          provider: "msg91",
          requestId: firstText(providerResult.request_id, providerResult.message),
          expiresInSeconds: 120
        });
      } catch (error) {
        sendError(response, 502, "SMS delivery failed", error.message);
      }
      return true;
    }
    if (useOtpSandbox) {
      otpSendTimes.set(phone, Date.now());
      sendJson(response, 200, {
        sent: true,
        phone: `+91${phone}`,
        provider: "local-sandbox",
        expiresInSeconds: 120
      });
      return true;
    }
    sendError(response, 503, "Live SMS OTP is not configured", [
      "Add MSG91_AUTH_KEY and MSG91_TEMPLATE_ID to .env.local",
      "Use an approved MSG91 OTP template for Indian mobile delivery"
    ]);
    return true;
  }
  if (pathname === "/api/auth/verify-widget-token" && method === "POST") {
    if (!msg91WidgetConfigured) {
      sendError(response, 503, "MSG91 OTP Widget is not configured");
      return true;
    }
    const input = await readJson(request);
    const accessToken = String(input.accessToken || "").trim();
    const requestedPhone = phoneDigits(input.phone);
    if (!accessToken || accessToken.length > 4096) {
      sendError(response, 422, "A valid MSG91 access token is required");
      return true;
    }
    try {
      const providerResult = await verifyMsg91WidgetAccessToken(accessToken, providerFetch);
      const verifiedPhone = phoneDigits(widgetIdentifier(providerResult, accessToken));
      if (requestedPhone.length === 10 && verifiedPhone.length === 10 && requestedPhone !== verifiedPhone) {
        sendError(response, 401, "The verified mobile number does not match this login");
        return true;
      }
      const phone = verifiedPhone.length === 10 ? verifiedPhone : requestedPhone;
      if (phone.length !== 10) {
        sendError(response, 401, "MSG91 did not return a verified mobile identifier");
        return true;
      }
      const existingPatient = database.users.find(item => phoneDigits(item.phone) === phone);
      sendJson(response, 200, {
        verified: true,
        provider: "msg91-widget",
        token: `session-${randomUUID()}`,
        user: existingPatient || {
          id: slugId("user"),
          name: "SehatLine Member",
          phone: `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`
        }
      });
    } catch (error) {
      sendError(response, 401, "The OTP session is invalid or expired", error.message);
    }
    return true;
  }
  if ((pathname === "/api/auth/verify-otp" || pathname === "/api/auth/doctor/verify-otp") && method === "POST") {
    const input = await readJson(request);
    const phone = phoneDigits(input.phone);
    const otp = String(input.otp || "").trim();
    if (phone.length !== 10 || !/^\d{4,9}$/.test(otp)) {
      sendError(response, 422, "Enter a valid phone number and OTP");
      return true;
    }
    try {
      if (msg91SendOtpConfigured) {
        await verifyMsg91Otp(phone, otp);
      } else if (useOtpSandbox) {
        if (otp !== "123456") {
          sendError(response, 401, "The OTP is invalid or expired");
          return true;
        }
      } else {
        sendError(response, 503, "Live SMS OTP is not configured");
        return true;
      }
    } catch (error) {
      sendError(response, 401, "The OTP is invalid or expired", error.message);
      return true;
    }
    const isDoctorLogin = pathname.includes("/doctor/");
    const matchedDoctor = isDoctorLogin ? database.doctors.find(item => phoneDigits(item.phone) === phone && verified(item)) : null;
    if (isDoctorLogin && !matchedDoctor) {
      sendError(response, 403, "This mobile number is not registered to an approved doctor");
      return true;
    }
    const existingPatient = database.users.find(item => phoneDigits(item.phone) === phone);
    const sessionToken = `${isDoctorLogin ? "doctor" : "patient"}-${randomUUID()}`;
    if (isDoctorLogin) doctorSessions.set(sessionToken, matchedDoctor.id);
    else patientSessions.set(sessionToken, existingPatient?.id || phone);
    sendJson(response, 200, {
      verified: true,
      provider: msg91SendOtpConfigured ? "msg91" : "local-sandbox",
      token: sessionToken,
      user: isDoctorLogin
        ? publicDoctor(matchedDoctor)
        : existingPatient || { id: slugId("user"), name: "SehatLine Member", phone: `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` },
      doctor: isDoctorLogin ? publicDoctor(matchedDoctor) : undefined
    });
    return true;
  }

  const receptionistAuth = async () => {
    const auth = await adminAuth.authenticate(request);
    if (![
      "receptionist",
      "super_admin"
    ].includes(auth.admin.role)) throw Object.assign(new Error("Receptionist access required"), { statusCode: 403, code: "ACCESS_DENIED" });
    return auth;
  };
  const receptionistAccess = async () => {
    const auth = await receptionistAuth();
    if (auth.admin.mustChangePassword) throw Object.assign(new Error("Password change required"), { statusCode: 403, code: "PASSWORD_CHANGE_REQUIRED" });
    const doctorId = String(searchParams.get("doctorId") || (await readJson(request).catch(() => ({}))).doctorId || "");
    if (auth.admin.role !== "super_admin" && (!doctorId || !auth.admin.assignedDoctorIds.includes(doctorId))) {
      throw Object.assign(new Error("This doctor is not assigned to your account"), { statusCode: 403, code: "DOCTOR_ACCESS_DENIED" });
    }
    return { auth, doctorId };
  };
  if (pathname === "/api/receptionist/auth/change-password" && method === "POST") {
    const auth = await receptionistAuth();
    adminAuth.verifyCsrf(request, auth);
    await adminAuth.changePassword(auth, await readJson(request));
    sendJson(response, 200, { changed: true }, { "Set-Cookie": adminAuth.clearCookie() });
    return true;
  }
  if (pathname === "/api/receptionist/auth/me" && method === "GET") {
    const auth = await receptionistAuth();
    const doctors = database.doctors.filter(doctor => auth.admin.role === "super_admin" || auth.admin.assignedDoctorIds.includes(doctor.id)).map(publicDoctor);
    sendJson(response, 200, { admin: auth.admin, doctors });
    return true;
  }
  if (pathname.startsWith("/api/receptionist/")) {
    const auth = await receptionistAuth();
    if (auth.admin.mustChangePassword) throw Object.assign(new Error("Password change required"), { statusCode: 403, code: "PASSWORD_CHANGE_REQUIRED" });
    const input = ["POST", "PATCH", "PUT"].includes(method) ? await readJson(request) : {};
    const doctorId = String(searchParams.get("doctorId") || input.doctorId || "");
    if (auth.admin.role !== "super_admin" && (!doctorId || !auth.admin.assignedDoctorIds.includes(doctorId))) {
      throw Object.assign(new Error("This doctor is not assigned to your account"), { statusCode: 403, code: "DOCTOR_ACCESS_DENIED" });
    }
    const doctor = database.doctors.find(item => item.id === doctorId);
    if (!doctor) { sendError(response, 404, "Assigned doctor not found"); return true; }
    const receptionistAppointment = pathname.match(/^\/api\/receptionist\/appointments\/([^/]+)$/);
    const appointmentDate = receptionistAppointment
      ? database.bookings.find(item => item.id === decodeURIComponent(receptionistAppointment[1]) && item.doctorId === doctorId)?.date
      : "";
    const date = String(searchParams.get("date") || input.date || appointmentDate || new Date().toISOString().slice(0, 10));
    const schedule = database.doctorSchedules?.[doctorId]?.[date]
      || database.doctorWorkspaces?.[doctorId]?.schedules?.find(item => item.date === date)
      || (database.doctorWorkspace?.doctorId === doctorId ? database.doctorWorkspace.schedules?.find(item => item.date === date) : null);
    const queue = ensureDoctorQueue(database, doctorId, date);
    if (schedule) queue.capacity ||= Number(schedule.capacity || schedule.maxDailyTokens || schedule.slots?.length || 0);
    if (pathname === "/api/receptionist/dashboard" && method === "GET") {
      const appointments = database.bookings.filter(item => item.doctorId === doctorId && item.date === date).map(item => doctorAppointmentFromBooking(item, { appointments: [] }));
      const patients = database.users.filter(item => appointments.some(appointment => phoneDigits(appointment.phone) === phoneDigits(item.phone)));
      const collections = doctorCollectionSnapshot(database, doctorId, date);
      sendJson(response, 200, { doctor: publicDoctor(doctor), doctors: [publicDoctor(doctor)], appointments, queue, patients, collections, metrics: { totalAppointments: appointments.length, checkedIn: appointments.filter(item => ["checked-in", "in-progress"].includes(item.status)).length, waiting: queue.waiting.length, completed: appointments.filter(item => item.status === "completed").length, remainingTokens: Math.max(0, Number(queue.capacity || 0) - Number(queue.issued || 0)) } });
      return true;
    }
    if (pathname === "/api/receptionist/patients" && method === "GET") {
      const query = String(searchParams.get("q") || "").toLowerCase();
      const patients = (database.users || []).filter(item => !query || `${item.name} ${item.phone}`.toLowerCase().includes(query));
      sendJson(response, 200, patients);
      return true;
    }
    if (receptionistAppointment && method === "PATCH") {
      let updated;
      await store.mutate(data => {
        const booking = data.bookings.find(item => item.id === decodeURIComponent(receptionistAppointment[1]) && item.doctorId === doctorId);
        if (!booking) return;
        booking.status = input.status || booking.status;
        if (input.paymentStatus === "paid" && booking.paymentMode === "cash") {
          booking.paymentStatus = "paid";
          booking.paymentVerified = true;
          booking.cashCollectedAt = new Date().toISOString();
          booking.cashCollectedBy = auth.admin.adminId;
        }
        updated = booking;
        const queueEntry = ensureDoctorQueue(data, doctorId, booking.date).waiting.find(item => item.appointmentId === booking.id);
        if (queueEntry) queueEntry.checkedIn = String(booking.status || "").toLowerCase() === "checked-in";
      });
      if (!updated) sendError(response, 404, "Appointment not found"); else sendJson(response, 200, updated);
      return true;
    }
    const queueAction = pathname.match(/^\/api\/receptionist\/queue\/(start|resume|pause|next|notify|close|delay)$/);
    if (queueAction && method === "POST") {
      let updated;
      await store.mutate(data => { updated = updateQueue(ensureDoctorQueue(data, doctorId, date), queueAction[1], input, data); });
      sendJson(response, 200, updated);
      return true;
    }
    if (pathname === "/api/receptionist/walk-ins" && method === "POST") {
      if (!schedule) { sendError(response, 409, "The doctor has not published a schedule for this date"); return true; }
      const nextSlot = schedule.slots.find(slot => slot.available);
      if (!nextSlot || queue.issued >= schedule.capacity) { sendError(response, 409, "The doctor's daily capacity is full"); return true; }
      const booking = normalizeBooking({ ...input, doctorId, date, time: nextSlot.time, providerType: "doctor", status: "checked-in", paymentMode: "cash" }, database);
      booking.token = `T${String(queue.issued + 1).padStart(3, "0")}`;
      await store.mutate(data => {
        data.bookings.unshift(booking);
        const savedSchedule = data.doctorSchedules?.[doctorId]?.[date];
        const savedSlot = savedSchedule?.slots?.find(slot => slot.time === nextSlot.time);
        if (savedSlot) savedSlot.available = false;
        const currentQueue = ensureDoctorQueue(data, doctorId, date);
        currentQueue.issued += 1;
        currentQueue.capacity = schedule.capacity;
        currentQueue.remaining = Math.max(0, currentQueue.capacity - currentQueue.issued);
        if (savedSchedule) {
          savedSchedule.bookedCount = currentQueue.issued;
          savedSchedule.remainingTokens = currentQueue.remaining;
        }
        currentQueue.waiting.push({ token: booking.token, name: booking.patientName, reason: booking.reason || "Consultation", appointmentId: booking.id, checkedIn: true, wait: currentQueue.waiting.length * currentQueue.expectedMinutes });
        doctorWorkspaceFor(data, doctorId).appointments.push(doctorAppointmentFromBooking(booking, doctorWorkspaceFor(data, doctorId)));
      });
      sendJson(response, 201, { ...booking, status: "checked-in", token: booking.token });
      return true;
    }
    sendError(response, 404, "Receptionist route not found");
    return true;
  }

  if ((pathname === "/api/ai/query" || pathname === "/api/ai/recommend") && method === "POST") {
    const input = await readJson(request);
    const recommendation = await aiRecommend({
      query: String(input.query || ""),
      location: input.location,
      doctors: database.doctors.filter(verified).map(publicDoctor),
      labs: database.labs.filter(verified)
    });
    const results = Array.isArray(recommendation.results) ? recommendation.results : [];
    const resultIds = recommendation.resultIds || results.map(item => typeof item === "string" ? item : item.id).filter(Boolean);
    const answer = recommendation.answer || recommendation.message || recommendation.explanation || "I found healthcare options for you.";
    if (pathname === "/api/ai/query") sendJson(response, 200, { ...recommendation, answer, message: answer, resultIds });
    else sendJson(response, 200, { ...recommendation, answer, resultIds });
    return true;
  }

  if (pathname.startsWith("/api/")) {
    sendError(response, 404, "API route not found");
    return true;
  }
  return false;
}

async function serveStatic(request, response, url, uploadRoot) {
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    sendError(response, 400, "Invalid URL encoding");
    return;
  }

  const portalRoots = [
    ["/patient", "patient_app"],
    ["/doctor", "doctor_app"],
    ["/receptionist", "receptionist_app"],
    ["/admin", "admin_panel"]
  ];
  for (const [route, directory] of portalRoots) {
    if (pathname === route) {
      response.writeHead(308, { Location: `${route}/`, "Cache-Control": "no-store" });
      response.end();
      return;
    }
    if (pathname.startsWith(`${route}/`)) {
      const requestedRelative = pathname.slice(route.length + 1);
      const adminAliases = {
        login: "login.html",
        dashboard: "index.html",
        "change-password": "change-password.html"
      };
      const relative = route === "/admin"
        ? adminAliases[requestedRelative] || requestedRelative || "index.html"
        : requestedRelative || "index.html";
      return sendFile(response, path.resolve(projectRoot, directory), relative);
    }
  }
  if (pathname === "/sitemap.xml") {
  return sendFile(response, projectRoot, "sitemap.xml");
}

if (pathname === "/robots.txt") {
  return sendFile(response, projectRoot, "robots.txt");
}
  if (pathname === "/about" || pathname === "/about/") {
  return sendFile(response, projectRoot, "about.html");
}

if (pathname === "/contact" || pathname === "/contact/") {
  return sendFile(response, projectRoot, "contact.html");
}
  if (pathname.startsWith("/assets/")) {
    return sendFile(response, path.resolve(projectRoot, "assets"), pathname.slice("/assets/".length));
  }
  if (pathname.startsWith("/uploads/") && uploadRoot) {
    return sendFile(response, path.resolve(uploadRoot), pathname.slice("/uploads/".length));
  }
  if (pathname === "/" || pathname === "/index.html") {
    return sendFile(response, projectRoot, "index.html");
  }
  sendError(response, 404, "Page not found");
}

async function sendFile(response, rootDirectory, relativePath) {
  const requested = path.resolve(rootDirectory, relativePath);
  const normalizedRoot = `${path.resolve(rootDirectory)}${path.sep}`;
  if (requested !== path.resolve(rootDirectory) && !requested.startsWith(normalizedRoot)) {
    sendError(response, 403, "Forbidden path");
    return;
  }
  let filePath = requested;
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = path.join(filePath, "index.html");
    const body = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": contentTypes.get(extension) || "application/octet-stream",
      "Content-Length": body.length,
      "Cache-Control": [".html", ".css", ".js"].includes(extension) ? "no-cache" : "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin"
    });
    response.end(body);
  } catch (error) {
    if (error.code === "ENOENT") sendError(response, 404, "Asset not found");
    else throw error;
  }
}

export async function createSehatLineServer(options = {}) {
  const useMongo = !options.store
    && !options.dataFile
    && options.useMongo !== false
    && Boolean(String(process.env.MONGODB_URI || "").trim())
    && process.env.SEHATLINE_SKIP_DATABASE !== "true";
  if (useMongo) await connectDatabase();
  const store = options.store || (useMongo ? new MongoStore() : new JsonStore(options.dataFile));
  if (!store.data) await store.initialize();
  const production = options.production ?? process.env.NODE_ENV === "production";
  const adminJwtSecret = options.adminJwtSecret || process.env.ADMIN_JWT_SECRET || (production ? "" : randomBytes(48).toString("hex"));
  if (production && !adminJwtSecret) throw new Error("ADMIN_JWT_SECRET is required in production");
  if (production && !useMongo) throw new Error("MONGODB_URI is required in production");
  const adminAuth = new AdminAuthService({
    store,
    jwtSecret: adminJwtSecret,
    production
  });
  await adminAuth.initialize();
  const doctorSessions = new Map();
  const patientSessions = new Map();
  const logger = options.logger || console;
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
      const handled = await routeApi(request, response, url, store, {
        adminAuth,
        doctorSessions,
        patientSessions,
        requirePatientAuth: production || options.requirePatientAuth === true,
        requireDoctorAuth: production || options.requireDoctorAuth === true,
        uploadRoot: options.uploadRoot,
        providerFetch: options.providerFetch,
        googleMapsServerApiKey: options.googleMapsServerApiKey,
        logger,
        razorpayKeyId: options.razorpayKeyId,
        razorpayKeySecret: options.razorpayKeySecret,
        razorpayWebhookSecret: options.razorpayWebhookSecret,
        identitySandboxEnabled: options.identitySandboxEnabled,
        otpSandboxEnabled: options.otpSandboxEnabled
      });
      if (!handled && url.pathname === "/admin/dashboard") {
        try {
          const auth = await adminAuth.authenticate(request);
          if (auth.admin.mustChangePassword) {
            response.writeHead(302, { Location: "/admin/change-password" });
            response.end();
          } else {
            await serveStatic(request, response, url, options.uploadRoot || process.env.SEHATLINE_UPLOAD_ROOT);
          }
        } catch {
          response.writeHead(302, { Location: "/admin/login" });
          response.end();
        }
      } else if (!handled) await serveStatic(request, response, url, options.uploadRoot || process.env.SEHATLINE_UPLOAD_ROOT);
    } catch (error) {
      logger.error?.("[SehatLine API]", error);
      const adminError = adminErrorPayload(error);
      if (!response.headersSent && adminError) sendJson(response, adminError.statusCode, adminError.payload);
      else if (!response.headersSent && error.code) sendJson(response, error.statusCode || 500, { error: { code: error.code, message: error.message } });
      else if (!response.headersSent) sendError(response, error.statusCode || 500, error.statusCode ? error.message : "Unexpected server error");
      else response.end();
    }
  });
  return { server, store, adminAuth };
}

export async function startServer(options = {}) {
  const { server, store, adminAuth } = await createSehatLineServer(options);
  const requestedPort = options.port ?? DEFAULT_PORT;
  const requestedHost = options.host || process.env.HOST || "0.0.0.0";
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(requestedPort, requestedHost, resolve);
  });
  const address = server.address();
  const port = typeof address === "object" ? address.port : requestedPort;
  const displayHost = requestedHost === "0.0.0.0" || requestedHost === "::" ? "localhost" : requestedHost;
  return { server, store, adminAuth, port, url: `http://${displayHost}:${port}` };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (isMain) {
  startServer()
    .then(({ url }) => {
      console.log(`\n  SehatLine is running at ${url}`);
      console.log(`  Patient: ${url}/patient/`);
      console.log(`  Doctor:  ${url}/doctor/`);
      console.log(`  Admin:   ${url}/admin/\n`);
    })
    .catch(error => {
      console.error("Failed to start SehatLine:", error);
      process.exitCode = 1;
    });
}
