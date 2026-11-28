# Android-App (Capacitor)

Eine Codebasis, zwei Ziele:

| Ziel | Build | Basis-Pfad | Service Worker |
| --- | --- | --- | --- |
| PWA (GitHub Pages) | `npm run build` (Deploy setzt `BASE_PATH`) | `/<repo>/` | ja |
| Android-APK | `npm run build:native` (`--mode native`, `VITE_TARGET=native`) | `./` | nein |

- Native Code steckt nur in `src/native/` und wird nur bei `__NATIVE__` (Build-Konstante) geladen. Zur Laufzeit prüft er zusätzlich `Capacitor.isNativePlatform()`. Der Pages-Build enthält keinen Capacitor-Code.
- Android-Projekt: `android/` (Kotlin: `MainActivity`, `WidgetBridgePlugin`, `LastWorkoutWidget`).
- Icons: `npm run icons` erzeugt PWA- und Android-Launcher-Icons (inkl. Adaptive- und Monochrome-Icon).

## Lokal bauen

```powershell
npm run cap:sync          # Web-Build (native) + in android/ kopieren
npm run android:open      # Android Studio
```

Gradle von der Kommandozeile mit dem JDK aus Android Studio:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"; cd android; .\gradlew assembleDebug
```

Signierte Release-Builds lokal: `android/keystore.properties` (nicht im Repo) mit `storeFile`, `storePassword`, `keyAlias`, `keyPassword`.

## Widget „Zuletzt trainiert"

Datenfluss: Dexie `liveQuery` (`src/native/widgetBridge.ts`) → `WidgetBridge.update({ payload })` → SharedPreferences → `LastWorkoutWidget` (RemoteViews). Zusätzlich synchronisiert die App beim Start und beim `pause`-Event. Payload-Format: `src/native/widgetPayload.ts` (`v: 1`). Das relative Datum berechnet das Widget selbst.

Weitere native Funktionen (Benachrichtigungen, Foreground Service) bekommen je ein eigenes Modul in `src/native/` und einen Aufruf in `initNative()`.

## Release

Ein Tag `v*` (z. B. `git tag v1.0.0; git push origin v1.0.0`) startet `.github/workflows/android-release.yml`. Der Workflow baut die signierte APK (`versionCode` = Run-Nummer, `versionName` = Tag ohne `v`) und hängt sie an das GitHub Release. Bei einem manuellen Start wird die APK nur als Artefakt hochgeladen.

Benötigte Secrets (Repository → Settings → Secrets and variables → Actions):

| Secret | Inhalt |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Base64 der `.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | Store-Passwort |
| `ANDROID_KEY_ALIAS` | `gymtracker` |
| `ANDROID_KEY_PASSWORD` | Key-Passwort |

**Der Keystore liegt nicht im Repo und muss extern gesichert sein.** Ohne ihn lassen sich keine Updates mehr über die installierte App installieren.
