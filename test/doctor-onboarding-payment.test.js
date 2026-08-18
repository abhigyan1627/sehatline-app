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

test("doctor launch onboarding verifies payment, publishes capacity and reports only live income", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sehatline-onboarding-"));
  const keySecret = "test_razorpay_secret_123456789";
  let orderRequest;
  const providerFetch = async (url, options) => {
    if (String(url) === "https://api.razorpay.com/v1/orders") {
      orderRequest = { options, body: JSON.parse(options.body) };
      return new Response(JSON.stringify({ id: "order_sehatline_test", amount: 70682, currency: "INR", status: "created" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (String(url) === "https://api.razorpay.com/v1/payments/pay_sehatline_test") {
      return new Response(JSON.stringify({ id: "pay_sehatline_test", order_id: "order_sehatline_test", amount: 70682, currency: "INR", status: "captured" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    throw new Error(`Unexpected provider request: ${url}`);
  };
  const { server, store, url } = await startServer({
    port: 0,
    dataFile: path.join(directory, "runtime.json"),
    providerFetch,
    otpSandboxEnabled: true,
    razorpayKeyId: "rzp_test_sehatline",
    razorpayKeySecret: keySecret,
    logger: { error() {}, warn() {} }
  });

  try {
    const applicationResponse = await requestJson(`${url}/api/doctors`, "POST", {
      name: "Dr. Launch Doctor",
      phone: "+91 98765 40001",
      email: "launch-doctor@example.test",
      specialty: "General Physician",
      qualification: "MBBS",
      experience: 6,
      fee: 500,
      clinic: "Launch Care Clinic",
      address: "Gopalganj, Bihar",
      city: "Gopalganj",
      pincode: "841428",
      languages: ["Hindi", "English"],
      registrationNumber: "BCMR-LAUNCH-001",
      registrationCouncil: "Bihar Council of Medical Registration",
      applicationSource: "doctor-app",
      verification: { declarationAcceptedAt: new Date().toISOString() },
      documents: {
        registrationCertificate: { name: "Registration", url: "https://secure.example.test/registration" },
        degreeCertificate: { name: "Degree", url: "https://secure.example.test/degree" },
        photoId: { name: "Photo ID", url: "https://secure.example.test/photo-id" }
      },
      onboarding: { schedule: { workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], startTime: "09:00", endTime: "17:00", patientsPerHour: 4 } }
    });
    const application = await applicationResponse.json();
    assert.equal(applicationResponse.status, 201);
    assert.equal(application.onboarding.payment.status, "pending");
    assert.equal(application.onboarding.schedule.durationMinutes, 15);

    const plan = await fetch(`${url}/api/doctor/onboarding/plan`).then(response => response.json());
    assert.equal(plan.offerPrice, 599);
    assert.equal(plan.gstAmount, 107.82);
    assert.equal(plan.total, 706.82);
    assert.equal(plan.paymentConfigured, true);

    const orderResponse = await requestJson(`${url}/api/doctor/onboarding/payment/order`, "POST", { doctorId: application.id, phone: application.phone });
    const order = await orderResponse.json();
    assert.equal(orderResponse.status, 201);
    assert.equal(order.amount, 70682);
    assert.equal(orderRequest.body.amount, 70682);
    assert.match(orderRequest.options.headers.Authorization, /^Basic /);

    const paymentId = "pay_sehatline_test";
    const signature = createHmac("sha256", keySecret).update(`${order.orderId}|${paymentId}`).digest("hex");
    const verificationResponse = await requestJson(`${url}/api/doctor/onboarding/payment/verify`, "POST", {
      doctorId: application.id,
      razorpay_order_id: order.orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature
    });
    assert.equal(verificationResponse.status, 200);
    assert.equal(store.snapshot().doctors[0].onboarding.payment.status, "paid");

    await store.mutate(data => {
      data.doctors[0].status = "verified";
      data.doctors[0].verified = true;
    });
    await requestJson(`${url}/api/auth/doctor/request-otp`, "POST", { phone: "9876540001" });
    const loginResponse = await requestJson(`${url}/api/auth/doctor/verify-otp`, "POST", { phone: "9876540001", otp: "123456" });
    const login = await loginResponse.json();
    assert.equal(loginResponse.status, 200);

    const today = new Date().toISOString().slice(0, 10);
    const scheduleResponse = await requestJson(`${url}/api/doctor/schedule`, "PUT", { date: today, startTime: "09:00", endTime: "10:00", patientsPerHour: 4, maxDailyTokens: 4 }, login.token);
    const schedule = await scheduleResponse.json();
    assert.equal(schedule.capacity, 4);
    assert.equal(schedule.durationMinutes, 15);

    const bookingResponse = await requestJson(`${url}/api/appointments`, "POST", { doctorId: application.id, date: today, time: "09:00", patientId: "patient-live-1", patientName: "Live Patient", amount: 1, reason: "Consultation" });
    const booking = await bookingResponse.json();
    assert.equal(bookingResponse.status, 201);
    assert.equal(booking.token, "T001");
    await requestJson(`${url}/api/doctor/appointments/${booking.id}`, "PATCH", { status: "completed" }, login.token);

    const dashboard = await fetch(`${url}/api/doctor/dashboard`, { headers: { Authorization: `Bearer ${login.token}` } }).then(response => response.json());
    assert.equal(dashboard.income.todayIncome, 0);
    assert.equal(dashboard.income.completedToday, 1);
    assert.equal(dashboard.income.collections.dueAmount, 500);
    assert.equal(dashboard.metrics.at(-1).value, "₹0");

    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const resetQueue = await fetch(`${url}/api/doctor/queue?date=${tomorrow}`, { headers: { Authorization: `Bearer ${login.token}` } }).then(response => response.json());
    assert.equal(resetQueue.issued, 0);
    assert.equal(resetQueue.seen, 0);
    assert.equal(resetQueue.current, null);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
