## AppShip CLI (Türkçe)

AppShip; Flutter projeleri için build ve deploy süreçlerini tek komutla otomatikleştiren, fastlane ve Flutter araçlarını saran bir CLI’dır. `appship.config.json` ile proje bilgilerini saklar, hem Android hem iOS çıktıları için sürüm/çıktı yönetimini yapar.

### Özellikler
- Etkileşimli kurulum: proje adı, Android/iOS kimlik bilgileri, release notes, çıktı klasörü.
- Build akışı: platform seçimi, apk/aab seçimi, sürüm artırma, artefakt kopyalama.
- Deploy akışı: Google Play (supply) ve App Store/TestFlight (deliver/pilot) entegrasyonları.
- Tek komutta uçtan uca: `build-deploy` ile build + deploy.
- Çıktı temizleme: `build-clean` ile seçilen platformların build çıktıları silinir.
- Doktor: fastlane ve Flutter kurulumu/doğrulaması.
- Çoklu dil: en/tr; `appship lang` ile dil seçimi.

### Kurulum
```bash
npm install
npm link         # CLI'ı global komut olarak kullanmak için
```

Gereksinimler:
- Node 18+
- Flutter SDK ve Android/iOS build araçları
- fastlane kurulu (brew veya gem)
- App Store Connect API Key (.p8 veya JSON) ve Google Play Service Account JSON

### Kullanım
- **Kurulum**: `appship setup` (menü) veya `appship setup full`
  - Alt komutlar: `setup project-info`, `setup android-settings`, `setup ios-settings`, `setup release-notes`, `setup build-output-dir`
  - Parametreler: `--name`, `--google-play-service-account-key-path`, `--google-play-package-name`, `--apple-api-key-path`, `--apple-api-key-id`, `--apple-api-issuer-id`, `--apple-team-id`, `--apple-bundle-id`, `--release-notes-tr`, `--release-notes-en`, `--build-output-dir`
- **Build**: `appship build` (interaktif; platform/format, sürüm artırma)
- **Deploy**: `appship deploy` (interaktif; artefakt/target ve tek seferlik release notes)
- **Build + Deploy**: `appship build-deploy` (build ve deploy; hedefler baştan seçilir)
- **Çıktı Temizleme**: `appship build-clean [--android|--ios|--all]` (parametre yoksa menü)
- **Dil seçimi**: `appship lang`
- **Sağlık kontrolü**: `appship doctor [--flutter|--fastlane]`

### Yapılandırma
- Konfigürasyon dosyası otomatik oluşturulur: `appship.config.json`
- Çıktılar varsayılan: `appship-output/android` ve `appship-output/ios`
- Release notes ve bundle/package kimlikleri burada saklanır; tek seferlik değişiklikler, deploy sırasında config’i değiştirmeden yapılabilir.

#### Android ayarlarını hazırlama
1. Google Play Console > Settings > Developer account > API access > Service accounts: hizmet hesabı oluştur veya mevcut anahtarı indir.
2. İndirilen JSON yolunu `GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH` olarak kullan.
3. Paket adı: Play Console’daki `com.example.app` → `GOOGLE_PLAY_PACKAGE_NAME`.
4. `appship setup android-settings` ile bu değerleri gir veya CLI parametreleriyle çağır.

#### iOS ayarlarını hazırlama
1. App Store Connect > Users and Access > Keys: App Store Connect API Key oluştur, `.p8` indir.
2. Key ID (listede), Issuer ID (sayfanın üstünde) değerlerini al.
3. Team ID: Apple Developer hesabındaki 10 haneli takım kimliği.
4. Bundle ID: App Store Connect veya Xcode’taki `com.example.app`.
5. `appship setup ios-settings` ile `APPLE_API_KEY_PATH`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID`, `APPLE_TEAM_ID`, `APPLE_BUNDLE_ID` alanlarını doldur.

### Notlar
- Android deploy’da release notes, Google Play metadata yapısına uygun olarak gönderilir.
- iOS App Store Review gönderiminde release notes mevcut lokalizasyonlara göre otomatik eşlenir; en-US her zaman doldurulur, tr-TR lokalizasyon açıksa eklenir.
- `build-clean` komutu çalışırken gerekli ayarlar eksikse setup adımlarını tamamlamanız istenir.

---

## AppShip CLI (English)

AppShip is a CLI that automates Flutter build and deployment with fastlane. It stores project settings in `appship.config.json` and manages Android/iOS artifacts with interactive flows.

### Features
- Interactive setup for project info, Android/iOS credentials, release notes, and output directory.
- Build flow: platform selection, apk/aab choice, version bump, artifact copying.
- Deploy flow: Google Play (supply) and App Store/TestFlight (deliver/pilot) integration.
- One-shot pipeline: `build-deploy` runs build and deploy back-to-back.
- Cleanup: `build-clean` removes build artifacts for selected platforms.
- Doctor: verifies/installs Flutter and fastlane.
- Localization: en/tr; switch with `appship lang`.

### Setup
```bash
npm install
npm link         # register CLI globally as `appship`
```

Requirements:
- Node 18+
- Flutter SDK and Android/iOS toolchains
- fastlane installed (brew or gem)
- App Store Connect API Key (.p8 or JSON) and Google Play Service Account JSON

### Usage
- **Setup**: `appship setup` (menu) or `appship setup full`
  - Subcommands: `setup project-info`, `setup android-settings`, `setup ios-settings`, `setup release-notes`, `setup build-output-dir`
  - Params: `--name`, `--google-play-service-account-key-path`, `--google-play-package-name`, `--apple-api-key-path`, `--apple-api-key-id`, `--apple-api-issuer-id`, `--apple-team-id`, `--apple-bundle-id`, `--release-notes-tr`, `--release-notes-en`, `--build-output-dir`
- **Build**: `appship build` (interactive platform/format + version bump)
- **Deploy**: `appship deploy` (interactive artifact/target + per-run release notes)
- **Build + Deploy**: `appship build-deploy` (build then deploy; targets collected upfront)
- **Clean outputs**: `appship build-clean [--android|--ios|--all]` or interactive menu
- **Language**: `appship lang`
- **Doctor**: `appship doctor [--flutter|--fastlane]`

### Configuration
- Config auto-created: `appship.config.json`
- Default outputs: `appship-output/android` and `appship-output/ios`
- Release notes and identifiers live in config; per-run overrides are supported during deploy without persisting changes.

#### Preparing Android settings
1. Google Play Console > Settings > Developer account > API access > Service accounts: create a service account or download an existing JSON key.
2. Use the JSON path for `GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH`.
3. Package name from Play Console (`com.example.app`) → `GOOGLE_PLAY_PACKAGE_NAME`.
4. Fill via `appship setup android-settings` or pass CLI params.

#### Preparing iOS settings
1. App Store Connect > Users and Access > Keys: create App Store Connect API key and download `.p8`.
2. Note Key ID (list) and Issuer ID (top of page).
3. Team ID: Apple Developer 10-character team identifier.
4. Bundle ID: from App Store Connect or Xcode (`com.example.app`).
5. Fill via `appship setup ios-settings` with `APPLE_API_KEY_PATH`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID`, `APPLE_TEAM_ID`, `APPLE_BUNDLE_ID`.

### Notes
- Android deploy sends release notes via Google Play metadata structure.
- iOS App Store Review release notes are mapped to available localizations; en-US always sent, tr-TR only if enabled on App Store Connect.
- `build-clean` will request setup steps if required settings are missing.
