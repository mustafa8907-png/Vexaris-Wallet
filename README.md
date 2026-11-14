# Vexaris Wallet

> Self-custodial multi-chain wallet — one Tauri 2 codebase that runs on Windows desktop and Android (arm64).

**Status: alpha.** The signing path, keystore and dApp approval flow are real and working; non-EVM
coverage is receive-and-swap only. Do not hold significant funds here yet.

## What it does

| Area | State |
|------|-------|
| Wallet creation / import | BIP-39 mnemonic, 6-digit PIN + password wrappers, on-screen recovery confirmation |
| At rest | scrypt (N = 2<sup>17</sup> for a password, 2<sup>16</sup> for a PIN) → AES-256-GCM keystore, atomic write, key material zeroized on lock |
| Key custody | Private keys never cross the IPC boundary — signing happens in Rust, only the signed raw transaction leaves |
| Send | EIP-1559 signing, RLP encoding and broadcast on every EVM chain |
| Chains | 24 built-in: 11 EVM + 13 non-EVM, plus user-added networks and custom RPC endpoints |
| Swap | KyberSwap aggregator (EVM) + cross-chain intents router, 0.35% fee taken from the output asset |
| Swap safety | GoPlus honeypot / tax / sell-lock screening — a `blocked` token cannot be swapped even if the UI is bypassed |
| dApp access | WalletConnect v2 (`sign-client`, wallet side) and an in-app browser on Android with an injected `window.ethereum` |
| dApp consent | **Nothing signs silently** — every transaction, `personal_sign` and EIP-712 request lands on an approval screen first |
| Name resolution | ENS `.eth` resolved on-chain (registry → resolver), no API key, no third-party resolver |
| Market data | CoinGecko / Binance prices, DefiLlama stats, Blockscout history and NFTs, public JSON-RPC balances |
| Interface | Turkish and English (Turkish is the source language), dark single-accent theme, Inter + JetBrains Mono, Phosphor icons |

## Chains

**EVM — send, receive, swap:** Ethereum, Base, Arbitrum One, BNB Smart Chain, OP Mainnet,
Polygon PoS, Avalanche C-Chain, Linea, Sonic, Monad, Arc.

**Non-EVM — receive and swap only, by design:** Bitcoin, Litecoin, Bitcoin Cash, Dogecoin, Solana,
Tron, TON, XRP Ledger, NEAR, Aptos, Sui, Cardano, Stellar.

Direct sends on those networks are deliberately disabled; funding and exit run through the swap
engine, which settles them from the EVM side.

## Layout

```
Vexaris-Wallet/
├── main/                                  # the whole app (Tauri 2 + React)
│   ├── src/
│   │   ├── pages/                         # Welcome, Unlock, Home, Send, Receive, Swap, Activity,
│   │   │                                  #   Token detail, Collections, Browser, Connections, Settings
│   │   ├── components/                    # ui/ · layout/ · browser/ · TokenIcon · ProfileAvatar
│   │   ├── stores/                        # zustand: wallet, account, chain, portfolio, history,
│   │   │                                  #   swap, settings, browser, walletConnect, toast
│   │   ├── lib/
│   │   │   ├── chains/                    # built-in registry + user-added networks
│   │   │   ├── swap/                      # Kyber and intents engines, quoting, execution
│   │   │   ├── browser/                   # in-app dApp browser: address bar, provider bridge, tab pool
│   │   │   ├── walletconnect/             # sign-client, pairing, session and request handling
│   │   │   ├── api/                       # prices, balances, history, charts, NFTs, security, ENS
│   │   │   ├── tauri/                     # IPC wrapper + browser-mode mock
│   │   │   └── i18n/                      # Turkish source strings, English dictionary
│   │   └── styles/
│   └── src-tauri/
│       ├── src/
│       │   ├── commands/                  # wallet · transaction (EIP-1559) · dapp (EIP-191 / EIP-712)
│       │   ├── crypto/                    # mnemonic, BIP-32/44 keys, RLP, secp256k1, EIP-712
│       │   └── storage/                   # keystore + failed-attempt throttle
│       └── plugins/
│           └── tauri-plugin-vexwebview/   # local Kotlin WebView plugin (Android dApp browser)
├── mobile/outputs/                        # built APKs — local only, never committed
├── pnpm-workspace.yaml
└── LICENSE                                # AGPL-3.0-only
```

## Stack

| Layer | Choice |
|-------|--------|
| Shell | Tauri 2.x (Rust) — one project targeting Windows and Android |
| Frontend | React 18, TypeScript 5.6 (`strict`, `noUnusedLocals`), Vite 5, Tailwind CSS 3.4 |
| State / routing | Zustand 5 (with `persist`), React Router 6 (HashRouter) |
| Crypto | `k256` (secp256k1), `aes-gcm`, `scrypt`, `tiny-bip39`, `sha3` (Keccak-256), `zeroize`, in-tree RLP encoder |
| dApp | `@walletconnect/sign-client` 2.23.6 · local `android.webkit.WebView` plugin |
| Icons / type | Phosphor Icons · Inter Variable + JetBrains Mono Variable (self-hosted, latin + latin-ext) |

## Getting started

Requirements: a Node LTS, pnpm 12, and either a Rust toolchain with MSVC Build Tools (desktop) or the
Android SDK/NDK with JDK 17 (mobile). No vendor API keys are needed for any feature.

```bash
pnpm install
cp main/.env.example main/.env      # then fill in VITE_WALLETCONNECT_PROJECT_ID
```

| Command | Result |
|---------|--------|
| `pnpm dev:desktop` | UI in a plain browser against mocked IPC — crypto and signing are unavailable |
| `pnpm tauri:dev` | Real desktop window with the Rust backend |
| `pnpm tauri:build` | Desktop bundle |
| `pnpm android:dev` | Hot reload on a USB-connected phone |
| `pnpm android:build` | Android bundle (`-- --apk --target aarch64` narrows it to an arm64 APK) |

Android spans `minSdk 28` (Android 9) to `targetSdk 35` (Android 15) and ships `arm64-v8a` only.
`src-tauri/gen/` is generated and not versioned — [main/README.md](main/README.md) lists the
hand-applied edits that must be redone after `tauri android init`, plus the release signing setup.

## Configuration

`main/.env` is gitignored and holds a single value:

```ini
VITE_WALLETCONNECT_PROJECT_ID=      # Reown Cloud project id, used for the relay handshake
```

Signing keystores, `keystore.properties`, built APKs, `gen/` and any `*.log` are excluded by
`.gitignore`. Ad-hoc debug logs in particular have captured live WalletConnect pairing URIs together
with their `symKey` — keep them out of the repository.

## Security notes

- A stolen keystore is protected by scrypt cost, not by file permissions. A 6-digit PIN carries about
  20 bits of entropy; the on-device attempt counter slows guessing but resets if `security.json` is
  deleted. Hardware-backed storage (Android Keystore) is not integrated yet.
- `FLAG_SECURE` is not set, so the recovery-phrase screen is not screenshot-protected on Android.
- The dApp browser injects `window.ethereum` into third-party pages. Origins on the phishing list
  never receive an approve button, and a connection grant exposes the address only — moving any
  asset always requires a separate confirmation.

## License

AGPL-3.0-only. See [LICENSE](LICENSE).

## Disclaimer

This is unfinished software that handles real private keys. Test with a fresh wallet holding a small
balance, and keep the recovery phrase offline.
