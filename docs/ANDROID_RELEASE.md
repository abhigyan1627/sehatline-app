# Android release checklist

SehatLine has two independent Android applications:

- Patient: `in.sehatline.patient`
- Doctor: `in.sehatline.doctor`

## Local prerequisites

1. Install Android Studio.
2. During setup, install the Android SDK and Platform Tools.
3. Open `android/patient` and `android/doctor` once so Android Studio can finish
   Gradle and SDK setup.
4. Use a supported JDK from Android Studio rather than a random system JDK.

## Prepare app assets

From the repository root:

```powershell
$env:SEHATLINE_API_URL="https://api.your-domain.com"
pnpm mobile:prepare
pnpm android:patient:sync
pnpm android:doctor:sync
```

The URL must be the real HTTPS production backend. The build script rejects
missing or insecure URLs and strips all local demo records and guest controls.

## Before Play Store submission

- Configure a private upload keystore; never commit it or its passwords.
- Replace the generated launcher icons with final adaptive icons.
- Configure real OTP authentication and role-based backend authorization.
- Add FCM notification credentials outside the repository.
- Publish Privacy Policy, Terms, account deletion and support pages.
- Complete Play Console Data Safety and health-app declarations accurately.
- Test internal-track builds on physical phones.
- Produce signed `.aab` bundles from Android Studio or the Gradle release task.

The current local JSON backend and fixed demo OTP are for the separate demo
only and must never be used for production health data.
