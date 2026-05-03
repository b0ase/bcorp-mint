---
title: "BTMS + Veriff KYC Integration"
subtitle: "Bitcoin Mint — session summary, 2026-04-19"
---

# What got built

A BTMS (Basic Token Management System) mode and a Veriff KYC flow were added to Bitcoin Mint. The Mint can now issue **stocks, bonds, tokens, and currency** on the BSV overlay network, and stocks/bonds are gated behind a cryptographically-signed identity certificate that any third party can verify.

This work happened in the Bitcoin Mint project (`/Volumes/2026/Projects/bCorp Mint`). It is **not** part of the bMovies BSVA submission — the KYC **pattern** was borrowed from bMovies, but the code lives here and is adapted for Electron + local-only privacy.

# The three backends in play

| Backend | What it is | Where it lives |
|---|---|---|
| `@bsv/btms` | BSV overlay token system (PushDrop-based). Issue / send / receive / burn / query. Topic Manager + Lookup Service enforce protocol rules. | `src/main/btms.ts` |
| Veriff | Hosted identity verification (document + biometric). | `src/main/kyc.ts` |
| `@bsv/sdk` BSM | Bitcoin Signed Message — used to sign the `BRC-KYC-Certificate` that the Mint issues after Veriff approval. | `src/main/kyc.ts` |

# Why the Mint is the right frontend for this

BTMS ships with a Vite + MUI web frontend at `btms.metanet.app`. That frontend is generic — it has no brand, no design pipeline, no stamp metadata, no local-first privacy. The Mint already has:

- A design pipeline (logos, vignette, frame, watermark, borders) that produces asset icons.
- Local-first filesystem storage in `userData/`.
- A HandCash wallet and a MetaNet Desktop BRC-100 wallet already wired up (`src/main/providers/metanet-wallet.ts`).
- The **Stamp → Mint** mental model that matches the physical-mint metaphor.

So the Mint becomes the issuance machine; BTMS is the asset protocol it speaks.

# Architecture

```
Renderer (React)
  ├── ModeToggle → Stamp | Mint | Ticket | Tokenise | BTMS
  ├── BtmsPanel.tsx ─ Vault / Issue / Send / Receive / Burn / KYC tabs
  └── KycPanel.tsx  ─ Start session → poll → show signed cert
          │
          │ window.mint.btms* / window.mint.kyc*
          ▼
Preload (contextBridge)
          │
          │ ipcRenderer.invoke('btms-*' | 'kyc-*')
          ▼
Main process
  ├── src/main/btms.ts  ─ wraps @bsv/btms, reuses MetaNet WalletClient
  │                        issuance gate: stock/bond require cert
  ├── src/main/kyc.ts   ─ Veriff session + BSM-signed BRC-KYC-Certificate
  │                        deterministic signing key, local JSON storage
  └── src/main/providers/metanet-wallet.ts (already existed)
          │
          ▼
Outside world
  ├── MetaNet Desktop  http://127.0.0.1:3321  (BRC-100 wallet)
  ├── BTMS overlay     Topic Manager + Lookup Service + MessageBox
  └── Veriff           https://stationapi.veriff.com/v1/sessions
```

# The KYC pattern (ported from bMovies)

Borrowed from `bmovies/api/kyc-start.ts`, `kyc-webhook.ts`, `src/kyc/certificate.ts`. Same schema, same BSM signing, same deterministic key derivation — adapted as follows:

| bMovies (web SaaS) | Bitcoin Mint (Electron) |
|---|---|
| Supabase `bct_user_kyc` row | Local JSON at `userData/kyc/certificate.json` |
| Hosted webhook `/api/kyc-webhook` + HMAC verification | No webhook — polls `GET /v1/sessions/{id}/decision` |
| Signing secret from Supabase service role key | Env var `KYC_CERT_SIGNING_SECRET` or auto-generated `userData/kyc/signer.secret` (0o600) |
| Issuer: "bMovies Platform (The Bitcoin Corporation Ltd)" | Issuer: "The Bitcoin Corporation Mint" |
| `protocolID: [1, 'bmovies-kyc']` | `protocolID: [1, 'bcorp-mint-kyc']` |

The certificate itself is **identical in form**. Any verifier that can verify a bMovies cert can verify a Mint cert with the same code path — just check `cert.issuerPublicKey`, run `BSM.verify(certJson, derSig, pubKey)`, and trust the provider field if that issuer key is whitelisted.

## What the certificate proves

```json
{
  "type": "BRC-KYC-Certificate",
  "version": "1.0",
  "issuer": "The Bitcoin Corporation Mint",
  "issuerPublicKey": "03…",
  "issuerAddress": "1…",
  "subject": "<user's BSV address or identity pubkey>",
  "kycProvider": "Veriff OÜ",
  "kycLevel": "document + biometric",
  "status": "verified",
  "verifiedAt": "2026-04-19T…",
  "protocolID": [1, "bcorp-mint-kyc"],
  "keyID": "kyc-cert-1",
  "issuedAt": "2026-04-19T…"
}
```

The signature is DER-encoded BSM over `JSON.stringify(cert)`. No PII in the cert itself — only the subject address, the fact that Veriff document+biometric succeeded, and a timestamp. Everything else (name, DOB, document number) stays at Veriff.

# The securities gate

```
IPC handler 'btms-issue'
  → if metadata.asset_class in {stock, bond}
      → require metadata.kyc_certificate + kyc_certificate_signature
      → verifyCertificatePair(...)  ← reuses KYC module's BSM.verify
      → throw if invalid
  → then @bsv/btms.issue(amount, metadata)
```

So the gate is in the main process, not just the UI. Even if the renderer were replaced, stock/bond issuance still can't happen without a valid cert.

# File-by-file summary

| File | Status | Purpose |
|---|---|---|
| `package.json` | edited | Added `@bsv/btms`, `@bsv/message-box-client` |
| `.env.example` | edited | Added Veriff + BTMS env vars |
| `src/main/btms.ts` | new | BTMS operation wrappers + asset taxonomy |
| `src/main/kyc.ts` | new | Veriff session + BRC-KYC-Certificate issuance |
| `src/main/index.ts` | edited | 14 new IPC handlers for `btms-*` / `kyc-*` |
| `src/preload/index.ts` | edited | Exposed APIs on `window.mint` |
| `src/renderer/global.d.ts` | edited | Types for the new `window.mint` surface |
| `src/renderer/lib/types.ts` | edited | Added `'btms'` to `AppMode` |
| `src/renderer/components/ModeToggle.tsx` | edited | Added BTMS tab |
| `src/renderer/components/BtmsPanel.tsx` | new | Vault / Issue / Send / Receive / Burn / KYC |
| `src/renderer/components/KycPanel.tsx` | new | Start → poll → cert viewer + self-verify |
| `src/renderer/App.tsx` | edited | Render `BtmsPanel` in BTMS mode |
| `src/renderer/styles.css` | edited | Appended ~250 lines of BTMS styling |
| `CLAUDE.md` | edited | BTMS Mode + KYC sections |

Build status: **clean**. `pnpm build` succeeds. `pnpm typecheck` has pre-existing errors in unrelated files (`WalletView`, `useMintDesigner`, `useWalletManager`, `electron-platform`) — none are in the new code.

# Privacy trade-off to understand

The Mint's `CLAUDE.md` has a non-negotiable "zero telemetry, local-first, no cloud sync" principle. That principle is preserved for Stamp and Tokenise modes. BTMS mode is the explicit exception:

- BTMS overlay calls go to Topic Manager + Lookup Service (public overlay network).
- `MessageBoxClient` routes token deliveries via a MessageBox host.
- Veriff calls go to `stationapi.veriff.com` — but only from `src/main/kyc.ts`, only when the user initiates KYC, and Veriff receives only the opaque `vendorData` (email or subject address).

Users who need strict local-only operation should stay in Stamp or Tokenise modes.

# Running it

1. `cp .env.example .env.local` and fill in `VERIFF_API_KEY` (sandbox works for testing).
2. Launch **MetaNet Desktop** and unlock the wallet (BTMS needs BRC-100).
3. `pnpm dev` (or the built app).
4. Click the **BTMS** tab in the top toolbar.
5. **Vault** shows your assets (empty at first). Hit **Issue**.
6. Try a **token** first (no gate). Hit `Issue token` — MetaNet Desktop will prompt for approval.
7. Try a **stock** — gate fires, redirects you to **KYC** tab.
8. **Start Veriff verification** → completes in browser → **Check decision** polls Veriff → certificate lands in `userData/kyc/certificate.json`.
9. Back to **Issue** → issue stock — cert is automatically attached to the issuance metadata.

# What's next

See `NEXT-SESSION.md` in the project root.
