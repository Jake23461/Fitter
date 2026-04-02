# Fitter Mobile

Expo app for the Fitter mobile client.

## Run on your phone

1. Install Expo Go on your phone.
2. Make sure your phone and this computer are on the same Wi-Fi network.
3. In `mobile`, create `.env` from `.env.example` if you do not already have one.
4. Install dependencies with `npm install` if `node_modules` is missing.
5. Start Expo:

```powershell
npm start
```

If port `8081` is already in use on your machine, start Expo on `8082` instead:

```powershell
npx expo start --host lan --port 8082
```

6. Open Expo Go and scan the QR code from the terminal.

## Notes

- This app expects `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`.
- For local testing away from a gym, set `EXPO_PUBLIC_DISABLE_GYM_PROXIMITY_CHECK=true` in `.env`.
- Metro successfully started locally on `http://localhost:8082` during verification.
- A local React Native DevTools install warning (`spawn EPERM`) appeared during startup, but Metro still booted. That warning should not block testing in Expo Go.
