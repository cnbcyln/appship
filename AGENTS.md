# Repository Guidelines

AppShip CLI, Flutter ve Fastlane kurulumlarını otomatikleştiren kompakt bir Node.js aracıdır. Bu kılavuz, katkıların proje düzeni, kalite standartları ve teslim süreçleriyle uyumlu kalmasını sağlar.

## Project Structure & Module Organization
- `bin/appship` giriş noktasını sağlar ve `index.js` üzerinden Commander programını çağırır.
- Tüm komut mantığını `src/commands/<komut>/index.js` altında tutun; yeni komutlar için ayrı klasör açın ve sadece dışa açık kaydı döndürün.
- Ortak yardımcılar `src/lib/` (oluşturmanız gerekebilir) içinde toplanmalı, manuel senaryolar veya fixture çıktıları `fixtures/` altında tutulmalıdır.
- Test dosyaları için `src/__tests__/` veya ilgili komut klasörü altındaki `__tests__` dizinini tercih edin.

## Build, Test, and Development Commands
```
npm install                 # Bağımlılıkları yükler
npm link                    # CLI'ı yerelde `appship` olarak kayıt eder
node index.js setup --full  # Bağımsız çalıştırma
APP_ENV=dev appship setup   # Linked CLI ile örnek çağrı
npm pack                    # Yayın öncesi paket bütünlüğü kontrolü
```
Komuta özel entegrasyonları doğrulamak için `DEBUG=appship:*` gibi ortam değişkenleriyle ayrıntılı log açabilirsiniz.

## Coding Style & Naming Conventions
- CommonJS kullanın, Node 18+ hedefleyin, 2 boşluk girinti ve noktalı virgüller standarttır.
- Commander seçenek isimleri gerçek araçları yansıtsın (`--flutter`, `--fastlane`), fonksiyonlar fiil tabanlı (`setupCommand`, `deployCommand`).
- Lint aracı tanımlı değil; PR açmadan önce `node --check` ve `npm pack` ile temel doğrulama yapın.

## Testing Guidelines
- Tercih edilen çatı `node:test`; gerekirse Jest ekleyin ve `npm test` script'ini güncelleyin.
- Test isimleri davranışı açıklamalı (örn. `"setup komutu flutter kurulumunu doğrular"`).
- Kilit komutlar için en az %80 ifade kapsaması hedefleyin; manuel adımlar PR açıklamasına eklenmeli.

## Commit & Pull Request Guidelines
- Son geçmişte kısa sürüm mesajları (`1.0.2`, `.`) görülüyor; bundan sonra emir kipinde açıklayıcı başlıklar (`feat: add deploy command`) kullanın.
- Commit body bölümünde ilgili issue referanslarını (`Closes #12`) ve olası kırıcı değişiklikleri belirtin.
- PR'larda: değişiklik özeti, çalıştırılan komutlar, yeni ortam değişkenleri ve varsa terminal çıktıları/screenshot'lar yer almalı.

## Security & Configuration Tips
- CLI dış sistemlere kimlik bilgileriyle erişeceğinden, gizli anahtarları `.env.local` gibi versiyon kontrolü dışı dosyalarda tutun.
- Fastlane veya Flutter yükleme komutları çalışırken `sudo` gereksinimini açıkça belgeleyin ve kullanıcı doğrulaması ekleyin.
