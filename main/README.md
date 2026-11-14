# Vexaris Wallet — Ana uygulama (Tauri)

Masaüstü (Windows) ve telefon (Android) hedefleyen Tauri cüzdanı. **v0.1.0**

## Çalıştırma

```bash
# kök dizinden
pnpm install

# tarayıcı modu (Rust gerekli değil — UI geliştirme için)
pnpm dev:desktop        # http://localhost:1420

# gerçek masaüstü penceresi (Rust toolchain gerekir)
pnpm tauri:dev
```

> **Ortam (bu makinede kurulu):** Rust 1.99 (`D:\dev\rust`) + VS Build Tools 2022
> (`D:\dev\BuildTools`, MSVC + Windows SDK). WebView2 sistemde mevcut.
> Build çıktıları `CARGO_TARGET_DIR=D:\dev\rust\cargo-target` altına yazılır, böylece
> C: sürücüsü dolmaz.

### Ortam değişkenleri (yeni terminal açınca gerekli)

```powershell
RUSTUP_HOME      = D:\dev\rust\rustup
CARGO_HOME       = D:\dev\rust\cargo
CARGO_TARGET_DIR = D:\dev\rust\cargo-target
# PATH: D:\dev\rust\cargo\bin
```

## Modlar

| Mod | Komut | IPC davranışı |
|-----|-------|----------------|
| Tarayıcı | `pnpm dev:desktop` | Mock yanıtlar (`src/lib/tauri/mock.ts`) |
| Tauri | `pnpm tauri:dev` | Gerçek Rust komutları (`src-tauri`) |

`src/lib/tauri/ipc.ts` ortamı otomatik algılar; frontend kodu iki modda da değişmeden çalışır.

## Yapı

```
main/
├── src/                      # React + TS frontend
│   ├── pages/                # Welcome, Unlock, Home, Send, Receive, Swap, Activity, TokenDetail,
│   │                         #   Nfts, Browser, Connections, Settings
│   ├── components/           # ui/ (Button, Card, Input, PinInput, Toast) · layout/ · browser/ · TokenIcon
│   ├── stores/               # zustand: wallet, account, chain, portfolio, history, swap,
│   │                         #   settings, browser, walletConnect, toast
│   ├── hooks/                # usePortfolio, useHistory, useMarket, useNfts, useCountUp
│   ├── lib/
│   │   ├── tauri/            # ipc sarmalayıcı + mock + wallet API
│   │   ├── chains/           # yerleşik zincirler (11 EVM) + EVM dışı ağlar
│   │   │                     #   (BTC/LTC/BCH/DOGE/SOL/TRX/TON/XRP/NEAR/APT/SUI/ADA/XLM)
│   │   ├── swap/             # Kyber (EVM) ve intents (zincirler arası) takas motorları
│   │   ├── browser/          # uygulama içi dApp tarayıcısı: adres çubuğu, provider köprüsü, sekmeler
│   │   ├── walletconnect/    # sign-client, pairing, oturum ve talep kuyruğu
│   │   ├── api/              # fiyat, bakiye, geçmiş, grafik, NFT, GoPlus risk, ENS
│   │   ├── i18n/             # kaynak dil Türkçe + İngilizce sözlük
│   │   └── utils.ts
│   └── types/
└── src-tauri/                # Rust backend
    ├── commands/             # wallet (keystore) · transaction (EIP-1559) · dapp (EIP-191/712)
    ├── crypto/               # mnemonic, keys (BIP-32/44), rlp, signature, signing, eip712
    ├── storage/              # keystore.rs (scrypt + AES-256-GCM) · throttle (deneme sayacı)
    └── plugins/              # tauri-plugin-vexwebview (Android'de yerel WebView + window.ethereum)
```

## Güvenlik sözleşmesi

1. Private key **asla** frontend'e çıkmaz — imzalama Rust tarafında yapılır; IPC'dan
   yalnızca imzalanmış ham işlem (`rawHex`) ve karması geçer.
2. Keystore masaüstünde `%APPDATA%/com.vexaris.wallet/keystore.json`, telefonda
   `app_data_dir()` altına şifreli yazılır.
3. Oturumdaki mnemonic yalnızca bellekte durur ve `lock_wallet` çağrısında `zeroize`
   ile silinir.

### Token güvenlik denetimi (GoPlus)

`src/lib/api/security.ts` takas onayı öncesi her iki bacağın sözleşmesini GoPlus'tan
sorar ve üç seviyede sınıflandırır:

| Seviye | Tetikleyici | Davranış |
|--------|-----------|----------|
| `blocked` | `is_honeypot`, `cannot_sell`/`can_sell=0`, `cannot_buy`, aynı üreticide honeypot geçmişi, alım/satım vergisi ≥ %20 | Onay ekranında kırmızı uyarı, **düğme kilitli**; `swapStore.execute()` emir oluşturmadan önce aynı denetimi tekrar yapar ve `null` döner |
| `warning` | doğrulanmamış kaynak, %5–20 vergi, proxy/selfdestruct/external_call/hidden_owner, kara liste·durdurma·basım·vergi değiştirme yetkileri | Sarı uyarı, takas serbest |
| `safe` | bulgu yok | Tek satır: "honeypot ve satış kilidi temiz" |
| `unknown` | kayıt yok, uç erişilemedi, EVM/Solana dışı ağ | Bilgi satırı, takas engellenmez |

- **Yanlış pozitif kontrolü:** `trust_list=1` veya büyük borsada listeli tokenlarda
  üretici yetkisi uyarıları bastırılır (USDC/USDT basılabilir ve transferi
  durdurulabilir — bu bilinçlidir). Honeypot ve vergi bulguları ise güven
  listesinde de olsa engeller.
- **Önbellek:** sözleşme başına 10 dakika, aynı anda gelen istekler birleştirilir;
  onay ekranı ile yürütme kapısı tek ağ isteğini paylaşır. Başarısız istek 30 sn
  sonra yeniden denenir.
- **Gizlilik:** GoPlus'a yalnızca sorgulanan **sözleşme adresi** gider; cüzdan
  adresi, bakiye veya kişisel veri paylaşılmaz. Anahtar/gerekmez.
- **Kapsam:** EVM zincirleri `token_security/{chainId}`, Solana
  `solana/token_security` (transfer hook / non-transferable). UTXO, TON, NEAR gibi
  ağlarda veri yoktur → `unknown`.
- Ayar: *Takas ayarları → Token güvenlik denetimi* (varsayılan açık).

### ENS (`.eth`) alıcı adı

`src/lib/api/ens.ts` ad çözümlemesini **zincir üstü** yapar: kayıt defterinden
`resolver(node)`, sonra çözümleyiciden `addr(node)` okunur. namehash, projedeki
bağımlılıksız `keccak256` ile üretilir; API anahtarı veya üçüncü taraf çözümleyici
yoktur. Gönder ekranındaki alıcı alanına `ahmet.eth` yazılabilir; adres ana
ağdan çözülür ve EVM zincirlerinin hepsinde kullanılabilir. Geri arama
(`reverseEnsName`) `name(bytes32)` üzerinden yapılır ve pointer eşleşmesini
sözleşme tarafında doğrular.

### Keystore (P0 — uygulandı)

| Katman | Uygulama |
|--------|----------|
| Mnemonic | BIP-39, 12 kelime (128-bit entropi, `tiny-bip39`), seed PBKDF2-HMAC-SHA512(2048) |
| Türetme | BIP-44 `m/44'/60'/0'/0/0`, secp256k1 (`k256`) |
| Adres | Keccak-256 + EIP-55 checksum |
| KDF | scrypt r=8, p=1 — **parola** sarmalayıcısı N=2¹⁷ (~128 MB, OWASP önerisi), **PIN** sarmalayıcısı N=2¹⁶ (~64 MB) |
| KDF parametreleri | Sarmalayıcı başına `kdf` alanında yazılır (v2); dosya geneli alan yalnızca v1 dosyalar için yedek |
| Şifreleme | AES-256-GCM (256-bit anahtar, 12 B nonce, AAD `vexaris-keystore-v1`) |
| Tuz/nonce | Her sarmalayıcı kendi 32 B tuz + 12 B nonce'un `OsRng` ile üretir; tekrar kullanılmaz |
| Bütünlük | Çözülen ifade kayıtlı adresi üretmek zorunda (adres eşleşmezse kilit açma reddedilir); tek bitlik ct/nonce/salt değişimi GCM'de düşer |
| Sarmalayıcılar | `password` (≥8 karakter) ve `pin` (6 hane) aynı mnemonic'i ayrı ayrı sarar |
| Deneme sayacı | `security.json`: 5 hatadan sonra 30 sn'den başlayarak ikiye katlanan bekleme, üst sınır 8 saat; saat geri alınırsa `updated_at` tabanı blokeyi korur |
| Dosya izinleri | Unix/Android'de keystore ve sayaç 0600; Windows'ta ACL uygulama dizinini zaten korur |
| Sürüm | `version: 2`; 0 veya >2 reddedilir, v1 dosyalar okunabilir |
| Kilit | Oturumdaki mnemonic `zeroize` ile silinir (`Zeroizing<String>`) |
| Kilit açma gecikmesi | scrypt arka plan iş parçacığında (`spawn_blocking`), bağımlılıklar `opt-level = 3` → bu makinede PIN 203 ms, parola 408 ms (`cargo test -- --ignored`) |
| Kurtarma ifadesi | Yalnızca **parola** ile gösterilir (PIN yeterli değil), tek scrypt turuyla çözülür |
| Sıfırlama | Parola doğrulaması + keystore ve `security.json` dosyalarının silinmesi |

Keystore yazımı atomiktir (geçici dosya + rename) ve dosyada private key / mnemonic
plaintext olarak bulunmaz. Yanlış parola veya PIN, GCM kimlik doğrulamasında reddedilir.

**Bilinçli olarak yapılamayanlar (dürüst sınır):**
- 6 haneli PIN ~20 bit entropi taşır. Dosya çalınıp çevrimdışı kırılmak istenirse
  scrypt maliyeti denemeleri yavaşlatır ama durdurmaz. Cihaz *içindeki* denemeleri
  `security.json` sayacı yavaşlatır; o dosya silinirse sayaç sıfırlanır — kalıcı
  koruma için Android Keystore (donanım arkası) gerekir, henüz entegre değil.
- `reveal_mnemonic` ifadeyi arayüze taşır (özellik bu); ekran görüntüsü engeli
  (`FLAG_SECURE`) Android tarafında uygulanmadı.

Doğrulama kod düzeyindedir (`cargo test`): diskte düz metin sır olmadığını, tuz/nonce
bağımsızlığını, değiştirilmiş ciphertext/nonce/salt reddini, parametre taklidi
denemesinin düşmesini, v1 geriye uyumu, üretim KDF sabitlerini ve deneme sayacını
kapayan testler var.

## Durum (çalışan / eksik)

- ✅ Create (4 adım: seçim → bilgiler → 6 haneli PIN → kurtarma ifadesi onayı) / Import akışı, yönlendirme guard'ları
- ✅ BIP-39 üretimi ve doğrulaması, BIP-44 türetme, EIP-55 adres, gerçek keystore şifreleme
- ✅ PIN veya parola ile kilit açma (yanlış sır reddedilir), bellek temizliği
- ✅ Ayarlar → kurtarma ifadesi gösterme / cüzdanı sıfırlama (parola korumalı), dil seçimi
- ✅ **EIP-1559 imzalama + broadcast:** RLP + secp256k1 (k256) Rust'ta, EIP-2 low-S,
  `from` adresi türetilen anahtarla eşleşmezse imza reddedilir
- ✅ Gönder ekranı: varlık seçimi (yerel coin + ERC-20), `eth_estimateGas` ile canlı ücret,
  yayın sonrası receipt takibi ve gezgin bağlantısı
- ✅ **Canlı veri:** DefiLlama/CoinGecko fiyatları, RPC bakiyeleri (yerel coin + ERC-20),
  işlem geçmişi, portföy grafiği, NFT koleksiyonu
- ✅ Takas: KyberSwap (EVM: Ethereum/Arbitrum/Base/Polygon/OP/BSC/Avalanche/Linea/Sonic/Unichain)
  ve NEAR Intents (BTC, LTC, BCH, DOGE, SOL, TRX, TON, XRP, NEAR, APT, SUI, ADA, XLM dahil
  zincirler arası), %0,35 komisyon
- ✅ **Takas güvenliği:** GoPlus honeypot/vergi/satış-kilidi denetimi — onay ekranında
  uyarı, riskli tokenda düğme kilitli ve `execute()` emir oluşturmadan reddeder;
  coin detayında güvenlik kartı
- ✅ **ENS:** gönder ekranında `ad.eth` alıcısı, ana ağ kayıt defterinden zincir üstü
  çözümleme (anahtarsız)
- ✅ **WalletConnect v2:** cüzdan tarafı `sign-client`; her işlem, `personal_sign` ve EIP-712 talebi
  onay ekranından geçer — sessiz imza yok. Proje kimliği `main/.env` içinde (`VITE_WALLETCONNECT_PROJECT_ID`)
- ✅ **dApp tarayıcısı (Android):** yerel Kotlin WebView eklentisi, enjekte edilen `window.ethereum`,
  sekme yönetimi, yer imleri / geçmiş / bağlı siteler ve oltalama denetimi
- ⚠️ `pnpm dev:desktop` (sahte IPC) modunda kripto/imza çalışmaz; yalnızca görsel geliştirme içindir.
- ⚠️ EVM dışı zincirlerde *doğrudan gönderim* kapalı; o ağlar takas üzerinden kullanılır.
- ⬜ Solana/Tron/Bitcoin native imzalama yolları (Intents yatırması EVM tarafından yapılır)
- ⬜ Biyometrik kilit, fiyat alarmları
- ⬜ İzin (approval) denetimi/geri alma: herkese açık uçlarda `eth_getLogs` 10.000 blokla
  sınırlı, Blockscout adres-log ucu geçmiş izinleri döndürmüyor → tam liste veremeyen bir
  ekran yanıltıcı olur; ayrı bir indexleyici (veya Revoke.cash veri sözleşmesi) bekleniyor
- ⬜ Arka plan "takas tamamlandı" bildirimi: `tauri-plugin-notification` (Rust + Gradle
  kaydı) ve yeni derleme gerektirir; şu an uygulama içi toast + emir geçmişi kullanılıyor

### Android derlemesi (Android Studio gerekmez)

Telefon için gereken tek şey SDK + NDK + JDK; gradle kendisi iner:

```bash
# bir defaya mahsus proje üretimi (bu depoda zaten mevcut: src-tauri/gen/android)
pnpm tauri android init

# USB'ye takılı telefonda geliştirme (adb reverse ile 1420 portu aktarılır)
pnpm tauri android dev
```

Android SDK bileşenleri **D:** diskine kuruldu (C:'de yer yok): `D:\dev\android-sdk`
(cmdline-tools/latest = 13114758, platform-tools 37.0.1, build-tools/37.0.0,
platforms/android-37.2, ndk/27.2.12479018) ve Gradle önbelleği `D:\dev\gradle-home`.
Hedef aralığı Android 9 → 15: `minSdk = 28`, `targetSdk = 35` (compileSdk 37, AGP 9.3.1
zorunluluğu). Aynı değer `src-tauri/tauri.conf.json` içinde `bundle.android.minSdkVersion`
olarak da bildirilir; `gen/` sürüm dışı olduğu için proje yeniden üretildiğinde iki yer de
kontrol edilmeli.

```bash
# bu makinedeki tek satırlık kurulum (sadece arm64, debug imzalı APK)
ANDROID_HOME=D:/dev/android-sdk \
ANDROID_NDK_HOME=D:/dev/android-sdk/ndk/27.2.12479018 \
JAVA_HOME="C:/Program Files/Java/jdk-17" \
GRADLE_USER_HOME=D:/dev/gradle-home \
CARGO_TARGET_DIR=D:/dev/rust/cargo-target \
  pnpm tauri android build --apk --target aarch64 --debug --ci
```

Çıktı `src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk`
yolunda oluşur (`--target` yalnızca Rust hedefini kısar), ve `mobile/outputs/` klasörüne
kopyalanır. Debug profilinde sembol koruması açık olduğundan APK ~207 MB'tır (büyük
çoğunluğu `libvexaris_wallet_lib.so`).

Release derleme (`--debug` olmadan) aynı komutun imzasız hâlidir; imza için yukarıdaki
`keystore.properties` gerekir. Bu makinedeki ölçülen sonuç:

| | debug | release |
|---|---|---|
| `libvexaris_wallet_lib.so` | ~200 MB | 7,9 MB |
| APK | 217 MB | **10,3 MB** |
| ABI | yalnızca arm64 (`abiList`) | yalnızca arm64 |
| İmza | Android debug key | `vexaris` anahtarı, APK Signing Block v3 |
| Optimizasyon | kapalı | R8 + kaynak küçültme (`optimization { enable = true }`) |

Frontend `dist/` APK'ya ayrı bir assets klasörü olarak değil, Rust kütüphanesinin
içine gömülür (`tauri::generate_context!`); APK listesinde yalnızca
`assets/tauri.conf.json` görünmesi normaldir.

Notlar: `src-tauri/Cargo.toml` crate-type `staticlib + cdylib + rlib`, `lib.rs`
`#[cfg_attr(mobile, tauri::mobile_entry_point)]` taşır; `capabilities/default.json`
android/iOS platformlarını da kapsar. `gen/android/local.properties` yalnızca
`sdk.dir=D\:\\dev\\android-sdk` içerir ve `.gitignore`'dadır.
`gen/android/gradle.properties` içindeki `kotlin.incremental=false` satırı, Windows'ta
Kotlin daemon'un cargo registry altındaki `.tab` önbelleklerini kapatamayıp her modülde
daemonsuz derlemeye düşmesini önler (derlemeyi bozan bir hata değildi, yalnızca gürültü).

#### `gen/android` içindeki elle değişiklikler (repo'ya girmez!)

`**/src-tauri/gen/` gitignore'da. `pnpm tauri android init` proje kökünü yeniden
üretirse aşağıdaki dört dosyayı tekrar uygulamak gerekir:

| Dosya | Ne yapıldı | Neden |
|-------|-----------|-------|
| `app/src/main/AndroidManifest.xml` | `<activity>` → `android:windowSoftInputMode="adjustResize"` | Varsayılan `adjustUnspecified` WebView'ı küçültmüyor; parola kutusu klavyenin altında kalıyordu |
| `app/src/main/java/com/vexaris/wallet/MainActivity.kt` | `enableEdgeToEdge()` + `applySystemBarInsets()` (WindowInsets → kök view'a padding, sonra `CONSUMED`) | Android 15 (targetSdk 35) kenardan kenara pencereyi zorunlu kılar; WebView durum çubuğunun altına girince üst bar dokunulamaz oluyordu. wry/tauri 2.12 Android'de inset'leri hiç uygulamıyor |
| `app/src/main/res/values{,-night}/themes.xml` | `windowBackground`/`colorBackground` → `@color/canvas` | Açılışta beyaz şerit/parlama yerine uygulama rengi |
| `app/src/main/res/values/colors.xml` | `canvas #FF09080C` | Yukarıdaki iki referans için |

CSS tarafı inset'leri çift uygulamamak için `env(safe-area-inset-*)` değerlerini native
padding'e bıraktı; açılış/kilit ekranları `.screen-center` sınıfıyla kaydırılabilir
(`100dvh` + `margin-block: auto`) olur.

#### Release imzası

`gen/android/keystore.properties` (gitignore'da, makinede kalır) `D:\dev\vexaris-signing`
altındaki PKCS12 keystore'u işaret eder; `app/build.gradle.kts` içindeki `signingConfigs`
bu dosya varsa release'e imza verir, yoksa derleme imzasız devam eder. `storeFile` yolu
**ileri ayraçla** (`D:/dev/...`) yazılmalı: Java `.properties` okuyucusu ters bölüyü kaçış
karakteri sayar ve `D:\dev\...` yolu `D:dev...`e bozulur. Yedek:

```bash
keytool -genkeypair -keystore D:\dev\vexaris-signing\release.keystore -storetype PKCS12 \
  -alias vexaris -keyalg RSA -keysize 2048 -validity 10950 \
  -dname "CN=Vexaris Wallet, OU=Mobile, O=Vexaris, L=Istanbul, ST=Istanbul, C=TR"
```

Aynı anahtarla imzalanmayan sürümler telefona **üzerine kurulamaz** — anahtarı kaybetmek
dağıtımı keser. `gradle.properties` içindeki `abiList/archList/targetList` yalnızca
arm64 bırakıldığı için derleme tek Rust hedefiyle sınırlıdır.

```bash
# release (R8 + kaynak küçültme, imzalı)
pnpm tauri android build --apk --target aarch64 --ci
# imza doğrulama
D:/dev/android-sdk/build-tools/37.0.0/apksigner.bat verify --print-certs <apk>
```

### Canlı veri kaynakları

| Veri | Kaynak | Not |
|------|--------|-----|
| Fiyat / 24s değişim | CoinGecko `simple/price` → Binance `ticker/24hr` yedeği | 60 sn önbellek |
| Bakiyeler | publicnode / drpc / 1rpc JSON-RPC | toplu `eth_getBalance` + `balanceOf` |
| İşlem geçmişi | Blockscout v2 `/transactions` + `/token-transfers` | yerel coin + ERC-20, ağ başına hata sessizce atlanır |
| Grafik | Binance kline (`{SYMBOL}USDT`) | 5 dk önbellek, en değerli 4 varlık |
| NFT | Blockscout v2 `addresses/{addr}/nft` | `ipfs://` ve `ar://` çözümlenir |
| Token riski | GoPlus Labs `token_security/{chainId}`, `solana/token_security` | anahtarsız; sözleşme adresi gönderilir, 10 dk önbellek |
| ENS | Ana ağ RPC `eth_call` (registry + resolver) | namehash `keccak256` ile yerelde üretilir, anahtar yok |

Tüm uçlar CORS'a açıktır; Tauri CSP'si yalnızca bu alan adlarına izin verir
(`src-tauri/tauri.conf.json` → `connect-src`).

## Tasarım

Sade, koyu yüzeyli ve tek vurgu rengi kırmızı (`#e5484d`) bir arayüz. Amaç gösterişli
efektler değil, günlük kullanımda okunaklı ve öngörülebilir bir cüzdan deneyimi.

- **Tipografi:** Inter Variable (`opsz` 14–32 + `wght` 100–900) ve adresler için JetBrains Mono
  Variable. Yalnız latin + latin-ext alt kümeleri self-host edilir (`src/styles/fonts.css`),
  Türkçe glifler dahil; ağ isteği yok. `font-optical-sizing: auto` sayesinde küçük etiketler
  Inter'in "small" çizimini, büyük bakiye "display" çizimini kullanır. `ss02` ile I/l/1 ayrışır.
- **İkonlar:** Phosphor Icons (`@phosphor-icons/react`), varsayılan `regular`, aktif nav ve
  onay işaretlerinde `fill`/`bold`. lucide kaldırıldı; `strokeWidth` yerine `weight` kullanılır.
- **Yüzeyler:** `canvas #09090a`, `surface 850/800…`; ince `white/[0.06]` kenarlıklar.
- **Vurgu:** yalnızca birincil buton, aktif nav, PIN odağı ve hata durumlarında kırmızı.
- **Animasyon:** sadece 3 küçük geçiş — `fade-up` (sayfa), `fade-in` (menü/toast), `shake` (hatalı PIN).
- **Token ikonları:** `components/TokenIcon.tsx` içinde gerçek marka geometrileriyle inline SVG
  (ETH, SOL, POL, BNB, USDC, USDT, LINK, ARB, OP, JUP, WBTC, GMX). Harici istek yok.

Bileşenler: `ui/Button`, `ui/Card`, `ui/Input`, `ui/PinInput` (girilen haneler için beyaz nokta),
`ui/ToastHost`, `layout/Sidebar`, `layout/TopBar`, `TokenIcon`, `ProfileAvatar`.
