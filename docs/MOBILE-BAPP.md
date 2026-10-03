# Mobile, PWA and bWallet (bApp) notes

The web Mint (`website/`, served at bitcoin-mint.com) is mobile-first and runs as a
**bApp** inside bWallet. This page says how that fits together and what to keep in mind
when changing the shared UI.

## Layout

- Below 768px (`shared/hooks/useViewport.ts`) `MintApp` switches to one column: canvas on
  top, a **Library / Controls** switch, and one pane underneath. The CSS lives at the end of
  `shared/styles/mint-app.css` under `@media (max-width: 767px)`.
- The desktop topbar's secondary actions (Portfolio, Vault, Bit Trust, Print, Download
  Desktop, GitHub) move behind the **⋯** sheet on phones. The WIP carousel and the section
  nav (`TopNav`) are desktop-only.
- The web shell (`website/app/(app)/layout.tsx`) is a `100dvh` flex column: the page scrolls
  inside `main`, the section bar (`BottomNav`) is a normal flex child. Nothing is
  `position: fixed` at the viewport edges, which the bApp standard requires.
- Phone rules of thumb baked into the CSS: 44px tap targets, 16px inputs (iOS does not zoom
  on focus), horizontal chip rows scroll instead of wrapping, modals open as full-width
  sheets.
- Tailwind classes used in `shared/` are generated for the website because
  `website/app/globals.css` declares `@source "../../shared"`. Remember that `mint-app.css`
  is unlayered, so its element selectors (`button`, `input`) beat Tailwind utilities; use a
  class when you need something other than the gold pill button.

## PWA

- `website/public/manifest.json`: `start_url` `/mint`, standalone, maskable icon, shortcuts.
- `website/public/sw.js`: app shell precache, network-first pages with cache fallback,
  cache-first `/_next/static`, never caches `/api/` or other origins, sends nothing anywhere.
  Registered by `website/app/sw-register.tsx` in production only.
- Icons: `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` (80% safe zone),
  `apple-touch-icon.png` (180px). Regenerate from `public/mint/bcorp-mint-icon.png` with
  `sharp` if the artwork changes.

## bWallet / bApp standard

Spec: https://github.com/bitcoin-apps-suite/bapp-standard. bWallet source:
`b0ase/yours-mobile`, branch `bwallet`.

- bMint is listed in bWallet's Apps tab (`src/mobile/bapps.ts`, group Featured, url
  `https://www.bitcoin-mint.com/mint`).
- bWallet opens bApps **in-frame** (an iframe between its top bar and tab bar) when the site
  allows framing. `website/next.config.js` sends
  `Content-Security-Policy: frame-ancestors 'self' capacitor://localhost https://localhost`
  on every route and no `X-Frame-Options`. Remove the header and the wallet falls back to its
  full-screen browser.
- Detection (`shared/lib/bwallet.ts`): the wallet's user agent carries `bWallet/1
  YoursWalletMobile/1`; in-frame the iframe keeps the system UA, so the ancestor origin
  (`capacitor://localhost` / `https://localhost`) is checked too. It is a layout hint only.
- Inside the wallet: no section bar, no Download Desktop / GitHub, and the wallet chip becomes
  **Connect bWallet**, which fetches the BRC-100 identity key through `window.CWI` (full
  screen) or `@bsv/sdk`'s `WalletClient('auto')` (XDM over postMessage, in-frame). The key is
  kept in React state for the session only. Payments and inscriptions still go through the
  Mint's existing providers; routing them through the wallet's `createAction` is the next
  step.
- `website/public/bapp.json` is the bApp manifest (spec section 6, still **Proposed** in the
  wallet). `developer.identityKey` and `signature` are placeholders: sign the manifest with The
  Bitcoin Corporation's identity key (`protocolID [2, 'bapp manifest']`, `keyID '1'`,
  counterparty `anyone`, canonical sorted-key JSON without `signature`) before submitting
  the listing. Add `token` once `$bMint` has a BSV-21 token id.
- Known limit: HandCash OAuth uses cookies, and iOS partitions iframe storage, so the
  Hash/Sign HandCash login does not persist in-frame. The bApp standard's answer is wallet
  identity (challenge/response with `createSignature`) instead of a cookie session.
