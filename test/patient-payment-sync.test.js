import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { startServer } from "../backend/src/server.js";

const requestJson = (url, method, body, token = "") => fetch(url, {
  method,
  headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: body == null ? undefined : JSON.stringify(body)
});

test("patient cash and verified online bookings sync slots and doctor collections", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sehatline-patient-payment-"));
  const keySecret = "razorpay-test-secret";
  let providerOrderId = "order_patient_001";
  const providerFetch = async (url, options = {}) => {
    if (String(url).includes("/v1/orders")) {
      const payload = JSON.parse(options.body);
      return new Response(JSON.stringify({ id: providerOrderId, amount: payload.amount, currency: payload.currency }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (String(url).includes("/v1/payments/")) {
      return new Response(JSON.stringify({ id: "pay_patient_001", order_id: providerOrderId, amount: 50000, currency: "INR", status: "captured" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ display_name: "Gopalganj, Bihar", address: { city: "Gopalganj", state: "Bihar", postcode: "841428" } }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const { server, store, url } = await startServer({
    port: 0,
    dataFile: path.join(directory, "runtime.json"),
    uploadRoot: path.join(directory, "uploads"),
    providerFetch,
    otpSandboxEnabled: true,
    requirePatientAuth: true,
    razorpayKeyId: "rzp_test_patient",
    razorpayKeySecret: keySecret,
    razorpayWebhookSecret: "webhook-test-secret",
    logger: { error() {}, warn() {} }
  });

  try {
    await store.mutate(data => data.doctors.push({
      id: "doctor-payment-1",
      name: "Dr. Payment Sync",
      phone: "+91 98765 40000",
      email: "payment-doctor@example.test",
      specialty: "General Physician",
      clinic: "SehatLine Clinic",
      fee: 500,
      status: "verified",
      verified: true
    }));

    await requestJson(`${url}/api/auth/doctor/request-otp`, "POST", { phone: "9876540000" });
    const doctorLoginResponse = await requestJson(`${url}/api/auth/doctor/verify-otp`, "POST", { phone: "9876540000", otp: "123456" });
    const doctorLogin = await doctorLoginResponse.json();
    assert.equal(doctorLoginResponse.status, 200);
    const date = "2026-08-12";
    const scheduleResponse = await requestJson(`${url}/api/doctor/schedule`, "PUT", { date, startTime: "09:00", endTime: "09:30", durationMinutes: 15, maxDailyTokens: 2 }, doctorLogin.token);
    assert.equal(scheduleResponse.status, 200);

    await requestJson(`${url}/api/auth/send-otp`, "POST", { phone: "9123400000" });
    const patientLoginResponse = await requestJson(`${url}/api/auth/verify-otp`, "POST", { phone: "9123400000", otp: "123456" });
    const patientLogin = await patientLoginResponse.json();
    assert.equal(patientLoginResponse.status, 200);

    const forgedCashResponse = await requestJson(`${url}/api/appointments`, "POST", {
      doctorId: "doctor-payment-1",
      date,
      time: "09:15",
      patientName: "Cash Patient",
      reason: "Consultation",
      paymentMode: "cash",
      paymentStatus: "paid",
      paymentVerified: true
    }, patientLogin.token);
    const forgedCash = await forgedCashResponse.json();
    assert.equal(forgedCashResponse.status, 201);
    assert.equal(forgedCash.paymentStatus, "due");
    assert.equal(forgedCash.paymentVerified, false);

    const orderResponse = await requestJson(`${url}/api/patient/payments/order`, "POST", {
      doctorId: "doctor-payment-1",
      date,
      time: "09:00",
      booking: { patientName: "Online Patient", patientPhone: "9123400000", reason: "Consultation", type: "Clinic visit" }
    }, patientLogin.token);
    const order = await orderResponse.json();
    assert.equal(orderResponse.status, 201);
    assert.equal(order.amount, 50000);

    const signature = createHmac("sha256", keySecret).update(`${order.orderId}|pay_patient_001`).digest("hex");
    const verifyResponse = await requestJson(`${url}/api/patient/payments/verify`, "POST", {
      razorpay_order_id: order.orderId,
      razorpay_payment_id: "pay_patient_001",
      razorpay_signature: signature
    }, patientLogin.token);
    const verifiedBooking = await verifyResponse.json();
    assert.equal(verifyResponse.status, 201);
    assert.equal(verifiedBooking.paymentMode, "online");
    assert.equal(verifiedBooking.paymentStatus, "paid");
    assert.equal(verifiedBooking.token, "T002");

    const slotsResponse = await fetch(`${url}/api/doctors/doctor-payment-1/slots?date=${date}`);
    const slots = await slotsResponse.json();
    assert.equal(slotsResponse.status, 200);
    assert.deepEqual(slots.slots.map(slot => slot.status), ["booked", "booked"]);

    const doctorAppointmentsResponse = await fetch(`${url}/api/doctor/appointments?date=${date}`, { headers: { Authorization: `Bearer ${doctorLogin.token}` } });
    const doctorAppointments = await doctorAppointmentsResponse.json();
    assert.equal(doctorAppointmentsResponse.status, 200);
    assert.equal(doctorAppointments.length, 2);

    const dashboardResponse = await fetch(`${url}/api/doctor/dashboard?date=${date}`, { headers: { Authorization: `Bearer ${doctorLogin.token}` } });
    const dashboard = await dashboardResponse.json();
    assert.equal(dashboardResponse.status, 200);
    assert.equal(dashboard.collections.onlineAmount, 500);
    assert.equal(dashboard.collections.cashAmount, 0);
    assert.equal(dashboard.collections.dueAmount, 500);
    assert.equal(dashboard.collections.collectedAmount, 500);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
