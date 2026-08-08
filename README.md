# SehatLine

**Smarter Care. Better Life.**

SehatLine is a connected healthcare web platform with separate Patient,
Doctor and Receptionist portals, a shared API, and a private operations dashboard.

## What is included

| Surface | Core workflows |
| --- | --- |
| Patient Android App | Doctor/lab discovery and comparison, booking, live queue, reports, notifications and Sehat AI |
| Doctor Android App | Daily dashboard, appointment decisions, OPD queue, patients, profile and analytics |
| Receptionist Web App | Assigned-clinic appointments, patient check-in, walk-ins, live tokens and queue operations |
| Admin Panel | Partner verification, bookings, users, notifications and city analytics |
| Backend | Seeded REST API, local persistence, cross-origin support and static app hosting |
| Sehat AI | Explainable doctor/lab ranking with Hinglish constraints and emergency safety rules |

The Doctor workspace is production-locked: only owner-approved doctors can
authenticate, each doctor receives an isolated workspace, and daily bookings
use persistent capacity-limited live tokens. Production Android bundles require
the shared HTTPS API and strip embedded demo records before packaging.

The Patient and Doctor apps share a green-white-blue visual system with an
animated oxygen-tree identity and reduced-motion support.

## Run locally

### Windows quick start

From PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-sehatline.ps1
```

The helper uses Node.js from the system or the Codex bundled runtime.

### Standard Node.js

Node.js 22 or newer is required for Android packaging.

```bash
npm start
```

Open:

- Product launcher: `http://localhost:4000`
- Patient App: `http://localhost:4000/patient`
- Doctor App: `http://localhost:4000/doctor`
- Receptionist Portal: `http://localhost:4000/receptionist`
- Admin Panel: `http://localhost:4000/admin`
- API health: `http://localhost:4000/api/health`

The Patient login can be dismissed with the close button for public website
browsing. Protected actions should require sign-in.

Receptionist accounts have no public signup. The Owner creates one from
**Admin Panel → Admin Management**, selects the **Receptionist** role and assigns
one or more verified doctors. The generated temporary password must be changed
on the receptionist's first login.

### Live SMS OTP (India)

The Patient App uses the MSG91 OTP Widget with custom SehatLine UI. Copy
`.env.example` to `.env.local`, then add the Widget ID, Widget Token and private
Auth Key created in MSG91:

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

Keep `SEHATLINE_OTP_SANDBOX=false` for real SMS delivery. The browser receives
only the Widget ID and client Widget Token. The private Auth Key stays on the
server and is used to verify MSG91's access token before SehatLine creates a
login session. Never commit or share `.env.local`.

`MSG91_TEMPLATE_ID` is optional and is used only by the legacy doctor SendOTP
route. Patient OTP delivery uses the template/channel selected inside the MSG91
Widget.

## Android production apps

Prerequisites:

- Android Studio with the Android SDK installed
- Node.js 22 or newer
- A deployed HTTPS backend URL

Install dependencies once:

```powershell
pnpm install
```

Prepare and sync production assets:

```powershell
$env:SEHATLINE_API_URL="https://api.your-domain.com"
pnpm mobile:prepare
pnpm android:patient:sync
pnpm android:doctor:sync
```

The native projects are `android/patient` and `android/doctor`. After release
signing is configured, build them with:

```powershell
pnpm android:patient:build
pnpm android:doctor:build
```

Never release a build using `https://api.sehatline.invalid`. Real OTP,
role-based authorization, a privacy policy, signing keys and a production
database are required before Play Store submission.

## Verify

```bash
npm test
npm run check
```

## Deploy with your own domain

The repository includes a production Docker stack with MongoDB persistence and
automatic HTTPS. Follow [the production deployment guide](docs/PRODUCTION_DEPLOYMENT.md)
after buying the domain and a Linux VPS. The Patient, Doctor, Receptionist and
Admin surfaces use the same connected API server.

The local server itself has no framework dependency. Capacitor dependencies are
used for native Android packaging.

## Project structure

```text
sehatline/
├── patient_app/          Patient web source and local demo
├── doctor_app/           Doctor web source and local demo
├── receptionist_app/     Secure front-desk web app and installable PWA
├── mobile/               Separate Capacitor configurations
├── android/patient/      Native Patient Android project
├── android/doctor/       Native Doctor Android project
├── admin_panel/          Private operations dashboard
├── backend/              Shared REST API
├── ai_service/           Recommendation and safety engine
├── assets/brand-motion/  Oxygen-tree identity
├── scripts/              Production build tooling
└── docs/                 Scope and architecture
```

## Product guardrails

Sehat AI helps users discover and compare healthcare options. It must not claim
to diagnose, prescribe medicine, guarantee a provider or replace emergency
care. Production credentials and regulated health data should never be stored
in the repository.

See [MVP scope](docs/MVP_SCOPE.md) and
[architecture](docs/ARCHITECTURE.md) for integration and production-evolution
notes.
