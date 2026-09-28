# Highway Rush — Android landscape build

This project wraps the supplied Three.js game in a native Android WebView and adds phone/tablet touch controls.

## Android behavior
- Landscape only (`sensorLandscape`): either landscape direction is allowed; portrait is not.
- Full-screen immersive gameplay with hidden status/navigation bars.
- Multi-touch controls: steer left/right, gas, brake/reverse, and handbrake can be held at the same time.
- Camera and sound buttons are available on-screen.
- Compact landscape HUD, safe-area padding, and a portrait rotate-device fallback.
- Persistent leaderboard via WebView DOM storage/localStorage.
- Hardware-accelerated WebGL.
- Android 7.0+ (`minSdk 24`).

## Offline APK
The game itself is local. The Gradle build automatically downloads the pinned Three.js r128 runtime into `app/src/main/assets/js/vendor/three.min.js` before packaging, so the finished APK does **not** need network access to run.

## Build in Android Studio
1. Open this folder as an Android Studio project.
2. Let Android Studio install/sync the requested Android SDK/Gradle components.
3. Build > Build APK(s).
4. The debug APK will be under `app/build/outputs/apk/debug/app-debug.apk`.

The first build needs internet access only so Gradle can download normal Android build dependencies and the pinned Three.js file.

## Build with GitHub Actions (no Android setup needed)
The included `.github/workflows/build-apk.yml` builds the APK automatically. Put this project in a GitHub repository, open **Actions > Build Highway Rush APK > Run workflow**, then download the `Highway-Rush-Android-APK` artifact.

## Package
- App name: Highway Rush
- Application ID: `com.highwayrush.game`
- Min SDK: 24
- Compile/target SDK: 35
