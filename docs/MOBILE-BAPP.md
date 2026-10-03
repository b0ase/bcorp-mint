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
- Inside the wallet: no section bar, no Download Desktop / GitHub. The wallet chip offers
  **bWallet** (BRC-100) as the default provider; the web wallet manager
  (`website/lib/use-web-wallet-manager.ts`) lists Local Wallet, bWallet, HandCash and MetaNet
  Desktop and publishes the active one to the platform layer (`website/lib/providers/active.ts`).
- **Connect** (`shared/lib/bwallet.ts`, `website/lib/providers/bwallet-wallet.ts`): the identity
  key via `window.CWI` (full screen, extension) or `@bsv/sdk`'s `WalletClient('auto')` (XDM over
  postMessage, in-frame), then the `$handle`: bWallet handles are paymail aliases at
  `bwallet.space`, resolved from the identity key through the wallet's paymail server
  (`GET pay.bwallet.space/api/paymail/lookup?key=…`, proxied by `/api/bwallet/handle`). Nothing is
  persisted; the identity lives in React state.
- **Stamps, mints and signatures** go through the wallet when it is the active provider:
  `inscribeStamp` → `createAction` with an OP_RETURN output, `mintStampToken` → `createAction`
  with the 1-sat BSV-21 inscription locked to the user's ordinals address (or a wallet-derived
  key), `signMessage` → `createSignature` under `[1,'mint sign']` with counterparty `anyone`.
  The wallet funds, prompts, signs and broadcasts. With Local Wallet selected the old keystore
  path (`website/lib/mint-bridge.ts`) is used.
- **Login without passwords** (`/api/auth/bwallet/challenge` + `/verify`): the server issues a
  signed nonce bound to the origin, the wallet signs `bapp login|v1|origin=…|nonce=…` with
  `createSignature({ protocolID: [2,'bapp login'], keyID: '1', counterparty: 'anyone' })`, and
  the server verifies with `ProtoWallet('anyone')`, maps the identity to a unified user
  (`user_identities.provider = 'bwallet'`, `provider_user_id` = identity key) and returns an
  HMAC session token. The browser keeps it per tab and sends it as `Authorization: Bearer`
  (cookies are partitioned inside the wallet frame). `lib/auth.ts` resolves either session;
  `resolveUnifiedUserId()` is the provider-agnostic lookup for owner-scoped tables. Set
  `MINT_SESSION_SECRET` in production.
- Hash and Sign use the same auth context: inside bWallet the button says Connect bWallet and
  Hash inscribes through the wallet instead of `/api/inscribe` (HandCash).
- `website/public/bapp.json` is the bApp manifest (spec section 6, still **Proposed** in the
  wallet). `developer.identityKey` and `signature` are placeholders: sign the manifest with The
  Bitcoin Corporation's identity key (`protocolID [2, 'bapp manifest']`, `keyID '1'`,
  counterparty `anyone`, canonical sorted-key JSON without `signature`) before submitting
  the listing. Add `token` once `$bMint` has a BSV-21 token id.
- Known limits: HandCash OAuth still uses cookies, so it is offered only outside the wallet
  frame. Envelope payouts to signers (`/api/envelopes`) still use HandCash's pay API; a bWallet
  sender can create and sign envelopes but not fund signers from the server.
