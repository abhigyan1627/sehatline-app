# Doctor verification workflow

Only verified doctors may appear in the Patient App.

## Application states

- `pending`: submitted by a doctor or created by Admin; hidden from patients.
- `verified`: reviewed and approved by Admin; visible to patients.
- `rejected`: rejected with an internal reason; hidden from patients.

## Required before approval

- Full name and mobile number
- Specialty and qualification
- Experience and consultation fee
- Clinic name and complete address/location
- Medical registration/licence number
- Medical council

Supporting registration certificate, degree and photo-ID references are stored
for Admin review only. They must never be returned by public doctor-catalog
endpoints.

## Flow

1. A doctor submits the application from the Doctor App, or Admin creates it.
2. The backend always records it as `pending`.
3. Admin opens Review, checks documents and may correct or complete fields.
4. Backend refuses approval while any required verification field is missing.
5. Admin approves or rejects with a reason.
6. Only approved records are returned to the Patient App.

Online verification against NMC/state medical-council sources and secure
document storage are production integrations; the Admin must not treat a
matching text format alone as proof of registration.
