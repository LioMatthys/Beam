# Beam — Android sender

Expo (React Native) app that captures the phone screen and streams it to the
Windows receiver over Wi-Fi. The UI follows the Tempo design system; the actual
capture is a local native module (Kotlin) — `modules/beam-capture`.

## Why a native module (and not pure Expo)

Screen capture needs Android's `MediaProjection` + `MediaCodec` (hardware H.264
encoder), which are native APIs. The Expo/React Native layer renders the UI and
drives the module; the module runs a foreground service that captures, encodes,
and serves frames over TCP. **This means the app cannot run in Expo Go** — it
needs a custom dev build (`expo run:android`).

## Prerequisites

- Node + the repo installed (`npm install`).
- Android SDK with **platform android-36** + build-tools (present via Android Studio).
- **JDK 21** — use the one bundled with Android Studio at
  `C:\Program Files\Android\Android Studio\jbr` (the system JDK 25 is too new for the
  Android Gradle Plugin).
- An Android device (USB debugging) **or** an emulator. *(USB debugging is only for
  installing the build — the mirroring itself runs over Wi-Fi.)*

## Build & run

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
npm install
npx expo run:android      # prebuilds, compiles the native module, installs to device/emulator
```

Then in the app: tap **« Démarrer le partage »**, accept the system screen-capture
prompt. The screen shows your **IP**, **port (8787)** and a **6-digit code** — enter
those in the Windows app.

### ⚠️ Toolchain note (this machine)

Two environment issues affect the Gradle build here (not the app code):

1. **A JDK 17 is required** for the toolchain. One was downloaded to
   `C:\tmp\jdk17\jdk-17.0.19+10`. JDK 21 (Android Studio JBR) and android-36 cover the rest.
2. **Gradle 9.3.1 + a stale foojay JDK-resolver crash** on JDK auto-provisioning
   (`JvmVendorSpec.IBM_SEMERU` was removed in Gradle 9). The fix only works when passed
   as **Gradle CLI flags** — not via `gradle.properties` or `GRADLE_OPTS`:

   ```
   -Dorg.gradle.java.installations.auto-download=false
   -Dorg.gradle.java.installations.paths=C:/tmp/jdk17/jdk-17.0.19+10
   ```

Because `expo run:android` doesn't forward Gradle CLI flags, build the APK with Gradle
directly, then install it:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
cd android
.\gradlew.bat :app:assembleDebug `
  "-Dorg.gradle.java.installations.auto-download=false" `
  "-Dorg.gradle.java.installations.paths=C:/tmp/jdk17/jdk-17.0.19+10"
adb install -r app\build\outputs\apk\debug\app-debug.apk
```

> A full `:app:assembleDebug` also compiles reanimated/worklets C++, which needs the
> **Android NDK** + CMake — install them via Android Studio ▸ SDK Manager ▸ SDK Tools.
> (The cleanest long-term fix is when Expo/RN ship a Gradle-9-compatible foojay; then
> plain `expo run:android` works.)

## Architecture (mirrors the reference Tempo app)

```
src/
  constants/theme.ts        Tempo design tokens (dark, lime→teal)
  components/               gradient-button, status-pill
  app/                      expo-router screens
    _layout.tsx             providers (I18n, Connection) + Stack
    index.tsx               Connect screen (start/stop, IP + code)
    settings.tsx            quality settings (resolution, bitrate, fps)
  data/
    connection-context.tsx  Context: capture state + start/stop, native events
    storage.ts              AsyncStorage settings (KEY_PREFIX 'beam:')
    beam-capture.ts         re-export of the native module
  i18n/                     fr (default) + en, useT()

modules/beam-capture/        local Expo native module
  src/                       TS API + types
  android/src/main/
    AndroidManifest.xml      permissions + mediaProjection foreground service
    java/.../
      BeamCaptureModule.kt   JS bridge; MediaProjection permission via OnActivityResult
      ScreenCaptureService.kt foreground service: projection → encoder → server
      H264Encoder.kt         MediaCodec AVC encoder (Surface input)
      BeamServer.kt          TCP server: HELLO + pairing + framed frames
      Protocol.kt            wire constants + SPS→codec-string parser
      NetworkUtils.kt        Wi-Fi LAN IP
```

## Verify the native module compiles (no device, no NDK)

This compiles the Kotlin capture module against the real SDK + Expo Modules — the
fastest way to confirm the native code is sound. **Verified passing** (`BUILD SUCCESSFUL`):

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
cd android
.\gradlew.bat :beam-capture:compileDebugKotlin `
  "-Dorg.gradle.java.installations.auto-download=false" `
  "-Dorg.gradle.java.installations.paths=C:/tmp/jdk17/jdk-17.0.19+10"
```
