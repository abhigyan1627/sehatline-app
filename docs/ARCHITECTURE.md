# SehatLine Architecture

## Product surfaces

```text
Patient Android app ─┐
Doctor Android app  ─┼──> Shared REST API ──> Production database
Admin web panel     ─┘           │
                                 └──> Sehat AI recommendation engine
```

Patient and Doctor are separate Capacitor Android projects with unique Play
Store IDs. Their web sources remain independently testable in the local demo.
Production packaging injects the HTTPS API URL and removes demo records and
guest controls. Admin remains a private web surface.

## Repository boundaries

- `patient_app/`: discovery, comparison, booking, queue, reports and AI flows.
- `doctor_app/`: appointments, live OPD queue, patients and profile operations.
- `admin_panel/`: network, booking, users, notification and analytics control.
- `backend/`: HTTP API, seeded data, persistence and static-app serving.
- `ai_service/`: explainable doctor/lab matching and healthcare safety rules.
- `assets/`: shared identity assets.
- `docs/`: product, architecture and delivery notes.

## MVP integration strategy

The local demo calls `/api/*` and may use safe fixtures. Production Android apps
use a mandatory HTTPS API base URL and do not fall back to demo data. The final
backend must use authenticated role claims to scope every patient, doctor and
admin read/write.

## Production evolution

1. Replace JSON storage with MongoDB Atlas behind repository interfaces.
2. Replace demo identity with Firebase Phone Auth and role-based access tokens.
3. Move notifications to FCM and transactional WhatsApp adapters.
4. Add Cloudinary/S3 storage for reports, prescriptions and clinic media.
5. Connect Google Maps geocoding and distance matrix services.
6. Connect Razorpay/UPI through server-side payment intents and webhooks.
7. Keep the AI ranking engine deterministic; use an LLM only to parse intent
   and explain results. Never use it to diagnose or prescribe.
8. Keep Patient and Doctor as independently versioned Play Store apps while
   retaining shared API contracts and visual design tokens.

## Safety and privacy baseline

- Sehat AI recommends discovery options; it does not diagnose or prescribe.
- Emergency phrases produce an immediate emergency-care warning.
- Production health records require encryption, audit logs, signed URLs,
  explicit consent, least-privilege roles and retention policies.
- All partner verification must be completed before public listing.
