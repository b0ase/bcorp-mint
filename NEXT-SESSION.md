# Next session — Bitcoin Mint

**Project**: `/Volumes/2026/Projects/bCorp Mint` (The Mint, Electron app)
**Not this project**: bMovies / BSVA submission. That's at `/Volumes/2026/Projects/bmovies`.

## What we did on 2026-04-19

Added BTMS (`@bsv/btms`) as a token backend for stocks / bonds / tokens / currency, and a Veriff-powered KYC flow that issues a BSM-signed `BRC-KYC-Certificate`. The KYC pattern was ported from bMovies but adapted for Electron + local-only storage.

Read `docs/BTMS-KYC-INTEGRATION.pdf` for the full session summary.

## State of things

- **Build is clean** (`pnpm build` passes).
- **Typecheck**: all new code is clean. Pre-existing errors in `WalletView`, `useMintDesigner`, `useWalletManager`, `electron-platform`, `mint-defaults` are untouched — separate issue.
- **Dependencies added**: `@bsv/btms`, `@bsv/message-box-client`. Committed to `pnpm-lock.yaml`.
- **Not committed to git yet** — review before committing.
- **Not tested end-to-end** — needs a manual run with a live `VERIFF_API_KEY` and a running MetaNet Desktop.

## Pick-up tasks (in priority order)

1. **End-to-end smoke test.**
   - Fill in `VERIFF_API_KEY` (sandbox) in `.env.local`.
   - Start MetaNet Desktop, unlock it.
   - `pnpm dev`, click BTMS tab.
   - Try issuing a `token` (no gate) — confirm MetaNet Desktop prompt, confirm asset appears in Vault.
   - Try issuing a `stock` — confirm the gate fires.
   - Start KYC in the KYC tab, complete in browser (sandbox has test IDs), poll decision, confirm cert lands in `~/Library/Application Support/bcorp-mint/kyc/certificate.json` (or platform equivalent).
   - Issue a `stock` again with cert present — should now go through.

2. **Fix the pre-existing typecheck errors.** None of them block BTMS, but `electron-platform.ts` declares a second `mint` on `Window` that conflicts with ours. Clean that up so typecheck is clean across the board.

3. **UHRP icon upload.** BTMS metadata takes `iconURL` as a string. Right now the user pastes in a UHRP or https URL. Wire the Mint's existing stamp-design canvas into BTMS issuance — design an icon in the Mint's canvas, upload it to UHRP, auto-fill `iconURL`. This is the real Kintsugi moment where "design the currency, mint the currency" becomes one gesture.

4. **Revocation / re-issuance of KYC certs.** If `userData/kyc/signer.secret` is rotated the issuer pubkey changes and all prior certs still check out under the old key but new certs check under the new one. Worth adding a `certificateHistory` file or just document the rotation policy clearly.

5. **Securities metadata.** `stock` / `bond` issuance currently only carries `asset_class` + the cert. Real securities need `par_value`, `coupon_rate`, `maturity_date`, `issuer_legal_name`, `jurisdiction`, `cusip_or_isin`. Add fields to `MintAssetMetadata` and to the Issue form. Probably needed before anyone would trust issuance from the Mint.

6. **Refunds on incoming transfers.** `@bsv/btms` has a `refund()` method we haven't surfaced. Add a "Reject" button alongside "Accept" in the Receive tab.

7. **Prove ownership flow.** `@bsv/btms` supports `proveOwnership()` / `verifyOwnership()` — key-linkage revelation so a third party can confirm you hold a given asset without spending it. Add a "Prove ownership" button on asset rows. Very useful for voting, audits, and gated content.

8. **Ownership proofs → receipts.** When you prove ownership you can sign it into a receipt — fits naturally with the Mint's existing stamp receipt pattern.

## Things NOT to do

- Do not introduce telemetry, crash reporting, or any analytics in the Mint. The privacy rule is absolute — it's in `CLAUDE.md`.
- Do not store any Veriff PII on disk. The cert carries subject + "verified" + timestamp and nothing else.
- Do not replace HandCash OAuth with BRC-100 wholesale. They coexist. HandCash is still the primary for Stamp/Tokenise/Mint modes. BRC-100 is only for BTMS.

## Files to skim first next time

- `docs/BTMS-KYC-INTEGRATION.pdf` (or `.md`)
- `CLAUDE.md` (updated — look for the "BTMS Mode" and "KYC" sections)
- `src/main/btms.ts`
- `src/main/kyc.ts`
- `src/renderer/components/BtmsPanel.tsx`
