# COMPILE / RUN TARGETS

## iPhone / iPad
Requires macOS + Xcode + a physical iOS device.
1. Add Capacitor iOS platform if not already present.
2. Add/register ActorOSNativeCameraPlugin.swift.
3. Merge Info.plist camera/microphone usage strings.
4. Build to the physical device in Xcode.
5. Open gauntlet/PHYSICAL_DEVICE_GAUNTLET.html from the app bundle or wire it as a debug route.
6. Run the device card.

## Android
Requires Android Studio + Android SDK + a physical Android device.
1. Add/register ActorOSNativeCameraPlugin.kt.
2. Add CameraX dependencies used by the plugin.
3. Merge AndroidManifest camera/microphone declarations.
4. Build/install debug APK.
5. Open the gauntlet route inside the app.
6. Run the device card.

## Evidence
Do not call a platform/device supported until its report is preserved.
