# Vexaris Wallet

> Modern, güvenli ve çok platformlu kripto cüzdan.

## 🏗️ Mimari

```
Vexaris-Wallet/
│
├── README.md                    ← (bu dosya)
│
├── packages/
│   ├── core/                    ← Paylaşılan TypeScript çekirdek (types, utils, crypto, storage...)
│   ├── wallet-ui/               ← Paylaşılan UI bileşenleri ve tasarım sistemi
│   │
│   ├── app/                     ← Mobil uygulama (React Native / Expo)
│   ├── desktop/                 ← Masaüstü uygulama (Tauri + React/TypeScript)
│   └── web/                     ← Web uygulaması (React / Next.js)
│
├── docs/                        ← Mimari, API ve geliştirici dokümanları
└── scripts/                     ← Build, deploy ve yardımcı scriptler
```

## 🛠️ Teknoloji Stack

| Katman        | Teknoloji                          |
|---------------|------------------------------------|
| **Core**      | TypeScript, Node.js                |
| **Desktop**   | Tauri 2.x, React, TypeScript       |
| **Web**       | React / Next.js, TypeScript        |
| **Mobile**    | React Native / Expo, TypeScript    |
| **Crypto**    |ethers.js, viem, @solana/web3.js   |
| **Storage**   | IndexedDB, LocalStorage, SQLite     |
| **UI**        | TailwindCSS, Poppins, Lucide ikonları |
| **State**     | Zustand / Jotai                    |
| **i18n**      | i18next                            |

## 🎯 Özellikler

### Temel
- [ ] Çoklu zincir desteği (EVM, Solana, Bitcoin, Cosmos...)
- [ ] HD Wallet desteği (BIP-39/BIP-44)
- [ ] Mnemonic → Seed → Private Key türetme
- [ ] Secure enclave / Hardware wallet entegrasyonu (Ledger, Trezor)
- [ ] QR kod ile adres paylaşımı
- [ ] addressbook (defter)

### Cüzdan
- [ ] Balance görüntüleme (tüm zincirler)
- [ ] Gönder / Al işlemleri
- [ ] Gas fee tahmini ve özelleştirme
- [ ] Pending tx izleme
- [ ] Tx history (zincir başına)

### DEX & DeFi
- [ ] Swap (1inch aggregator API)
- [ ] Cross-chain swap
- [ ] Stake / UnStake
- [ ] Liquidity pool görüntüleme

### NFT
- [ ] NFT galerisi
- [ ] NFT transferi
- [ ] Metadata görüntüleme

### Güvenlik
- [ ] Biometric authentication
- [ ] PIN / Password koruması
- [ ] Auto-lock timer
- [ ] Seed phrase şifreleme (AES-256)
- [ ]白 whitepaper gizli anahtar görüntüleme koruması

### Ayarlar
- [ ] Zincir ekleme / kaldırma
- [ ] RPC endpoint yönetimi
- [ ] Gösterge birimi (USD, EUR, BTC, ETH...)
- [ ] Tema (Açık / Koyu / Sistem)
- [ ] Dil seçeneği (i18n)

## 📦 Paketler (packages/core)

```
packages/
└── core/src/
    ├── crypto/          # Şifreleme, anahtar türetme, imzalama
    ├── wallet/          # Cüzdan mantığı (create, import, balance...)
    ├── storage/         # Safe storage, IndexedDB adapter
    ├── blockchain/      # Zincir soyutlama katmanı (abstract chain layer)
    ├── api/             # RPC, REST, WebSocket adapterları
    ├── utils/           # Genel yardımcı fonksiyonlar
    └── types/           # Paylaşılan TypeScript tipleri
```

## 🔗 Chain Soyutlama Katmanı

Tüm zincirler ortak bir arayüz üzerinden erişilir:

```typescript
interface IChain {
  id: string;
  name: string;
  nativeCurrency: ICurrency;
  rpcUrls: string[];
  blockExplorer: string;

  // Methods
  getBalance(address: string): Promise<bigint>;
  getTransactionCount(address: string): Promise<number>;
  sendTransaction(tx: ITransaction): Promise<string>;
  signMessage(message: string, privateKey: Uint8Array): Promise<string>;
  // ...
}
```

## 🚀 Geliştirme

```bash
# Tüm workspace'i install et
pnpm install

# Core build
cd packages/core && pnpm build

# Desktop dev
cd desktop && pnpm dev

# Web dev
cd web && pnpm dev
```

## 📝 Notlar

- **Güvenlik öncelikli**: Private key ve seed phrase'ler asla plain text olarak kaydedilmez.
- **Modüler mimari**: `packages/core` bağımsız olarak import edilebilir.
- **Cross-platform**: Aynı `core` paketi tüm platformlarda kullanılır.

---

> ⚠️ **ALPHA AŞAMASINDA** — Henüz production için uygun değil.
