# The Stamp

**A generative content tree built on Bitcoin keys.**

---

![The Stamp — a wax seal pressing $ paths into the chain](/images/blog/the-stamp/stamp-press.jpg)

You make something. A photo. A comic page. An AI render. Where does it live? A folder. A cloud. A feed that scrolls past in seconds.

Nobody knows you made it. Nobody can prove when. If someone copies it, your word against theirs. Digital content has no provenance, no weight, no permanence.

But that's the old problem. Here's the new one:

What if the content doesn't exist yet — but it's already yours?

---

## The Key Is The Art

Every Bitcoin wallet starts with a seed. A master key. From that key, using a standard called BIP32, you can derive an infinite tree of child keys. Each child is a new address. Each address is mathematically unique and deterministically reproducible.

Now: a private key is 256 bits of entropy. That's a number. A very large, very random number.

That number is also a **seed for a generative model.**

Feed it to Stable Diffusion. Feed it to ComfyUI. Feed it to a 29-layer compositing engine. Out comes an image. Same key, same image, every time.

Which means your master key doesn't just hold Bitcoin. It holds an **infinite gallery of images you haven't seen yet.** Every leaf on the tree is a picture waiting to be rendered. You own them all. You just haven't looked.

---

## The Dollar Sign

![The $ glyph constructed from /$NPG/$SERIES/$ISSUE/$PAGE paths](/images/blog/the-stamp/dollar-sign-seam.jpg)

Look at a URL: `npg.com/$SERIES-01/$ISSUE-1/$PAGE-001`

That dollar sign isn't decoration. It's a **contract**.

When a server returns HTTP 402 — Payment Required — it's making a standing offer. A unilateral contract: pay X, receive Y. No negotiation. No API key. No signup flow. The offer exists at the URL, machine-readable, waiting for anyone to accept it by paying.

The $ in the path marks where these contracts live. Every $ is a node on a content tree. Every node is a standing offer for generative content — a comic page that hasn't been rendered, a character that hasn't been composited, an image that hasn't been generated from its key. The tree is full of them — branching, forking, each $ a contract waiting to be settled.

A master key holds this structure implicitly. Your tree is full of $ contracts you haven't published yet. Someone else's tree is full of $ contracts you haven't settled yet. The $ is the signal. The device that settles them is the claw.

---

## The Crawl

![A lobster crawls across a field of text, tracing $ connections](/images/blog/the-stamp/lobster-indexing.jpg)

The internet is full of $ contracts. Most of them are invisible — buried in URL paths, hidden behind 402 responses, scattered across domains nobody has crawled yet. Each one is a standing offer for generative content: a comic page that hasn't been rendered, a character that hasn't been composited, an image that hasn't been generated from its key.

The crawl is the act of sweeping the web for these contracts and settling them.

"Settling" means: finding the $ contract, generating the content it describes (or serving content you've already generated), and completing the transaction. The content gets delivered. The payment gets made. The stamp goes on-chain. Contract settled.

This is Proof of Indexing — but it's not passive cataloguing. It's active economic work. Every $ contract you settle earns $402 tokens. The faster you settle, the more you earn. The cheaper you can serve the content, the more competitive you are against other ClawMiners reaching for the same $ node.

---

## The Claw

![The claw reaches for glowing $NPG, $402, $1SHOT tags across the text field](/images/blog/the-stamp/claw-reaches.jpg)

The claw is not a metaphor. It's a competitive mechanism.

A lobster doesn't think about food. It reaches, grabs, tests, discards, reaches again. It works the environment. Every claw-strike is a probe. Every probe returns data: is this worth grabbing? Can I settle this before the other claws reach it? Move on.

The ClawMiner does the same thing to the $ namespace. It discovers generative content contracts, evaluates the cost to settle them, and races to fulfill them. If it can render the content faster than a competitor — or serve it cheaper — it wins the settlement. The content gets stamped. The $402 reward gets paid. The next claw reaches for the next $.

This is where the economics get real. Your ClawMiner isn't just indexing — it's **competing**. Every $ contract on the network is a race. Multiple claws reaching for the same node. The one that settles first — that generates the content, delivers it, stamps the proof — takes the reward. Speed matters. Cost matters. The box that can render a 29-layer character composite in 2 seconds beats the box that takes 10.

But the claw doesn't just settle other people's contracts.

---

## The Stamp

![The device sits at the centre of a radiating $ path network](/images/blog/the-stamp/stamp-device.jpg)

The ClawMiner is a stamp.

Not a metaphor for a stamp. An actual stamp. A device that presses proof into the blockchain the way a seal presses into wax. The device derives a key from your master seed, generates content at that leaf, hashes it, and writes the hash on-chain in a single OP_RETURN:

```
OP_RETURN | STAMP | $NPG/SERIES-01/ISSUE-1/PAGE-024 | a3f8c1... | 2026-02-17T14:30:00Z
```

Protocol identifier. Namespace path. Content fingerprint. Timestamp. Permanently on-chain. Less than a penny.

The image never touches the blockchain. Only the hash. Only the proof. The content stays on your machine — or more accurately, the content stays in your key. Delete the file. Re-derive the key. Re-run the generator. Same image, same hash, every time.

**The key is the backup. The key is the art. The key is the proof.**

The stamp and the crawl are the same motion. Pressing outward — writing new leaves to the tree. Reading inward — indexing what's already there. One device. Two directions. The same act.

---

## We've Already Done This

This isn't theory. We've been building generative content on Bitcoin keys for years — we just didn't have the language for it.

**Ninja Punk Girls** is a cyberpunk collectible card franchise on BSV. Each character is a "stack" — 29 PNG layers composited on a canvas: background, body, face, hair, weapons, armour, effects. 362 unique assets across those layers. 55,094 total cards. Two factions — NPG and Erobot — fighting across Neo-Tokyo.

Every stack is generated procedurally. The system selects one asset from each of the 29 layers, composites them, assigns stats (Strength, Speed, Skill, Stamina, Stealth, Style), and gives the character an authentic Japanese name from a curated pool. Miyuki. Kazuyo. Toki. Each one unique. Each one ownable. Each one a BSV-21 token.

The $NPG token — 2,045,457 supply, 1:1 with NPG Ltd shares, 125 verified shareholders — is the equity layer. The cards are the content layer. The tree connecting them is the derivation path.

The original filename convention for every NPG card was literally the character's genome:

```
07_001_Right-Weapon_Boxing-Glove_Yamarashii_Erobot_x_Uncommon_Strength_2_Speed_0_Skill_1_Stamina_1_Stealth_1_Style_1_.png
```

Layer number. Asset number. Category. Item name. Character. Faction. Rarity. Six stats. Everything about this card encoded in a string. Now imagine that string isn't stored in a filename — it's derived from a key. The key at `$NPG/CHARACTERS/SLOT-182` deterministically selects all 29 layers. The character's genome IS the key material.

**One-Shot Comics** takes it further. Five series — *Quantum Paradox*, *Cypherpunk Chronicles*, *Street Justice*, *Mystic Realms*, *Ninja Punk Girls* — each with AI-generated covers, characters, and full story scripts. *NPG Red: Digital Shadows* is a 22-page readable comic, cover to cover, generated from AI pipelines. The $1SHOT token wraps the whole thing.

These projects already have the pieces: generative content, Bitcoin tokens, namespace paths, on-chain identity. The Stamp is the architecture that connects them.

---

## The Tree

Here's what the NPG tree actually looks like:

```
Master Key
└── $NPG
    ├── SERIES-01 / Cyberpunk Origins       ← model: 29-layer compositor
    │   ├── ISSUE-1 / The Awakening
    │   │   ├── PAGE-001                    ← derive key → composite → stamp hash
    │   │   ├── PAGE-002
    │   │   └── ... (24 pages)
    │   ├── ISSUE-2 / Neon Shadows          ← 28 pages
    │   └── ISSUE-3 / Erobot Uprising       ← 32 pages
    │
    ├── CHARACTERS
    │   ├── SLOT-001 / Miyuki               ← 27 cards, Erobot faction
    │   ├── SLOT-002 / Kazuyo               ← 27 cards, NPG faction
    │   ├── SLOT-182 / Toki                 ← real NFT, on-chain
    │   └── ... (3,333 total slots)
    │
    └── $1SHOT
        ├── QUANTUM-PARADOX
        │   ├── ISSUE-1 / The Awakening     ← derive key → Stable Diffusion → stamp
        │   └── ISSUE-2 / Reality Shift
        ├── CYPHERPUNK-CHRONICLES
        │   └── ISSUE-1 / Digital Revolution
        ├── STREET-JUSTICE
        │   └── ISSUE-1 / Urban Legends
        ├── MYSTIC-REALMS
        │   └── ISSUE-1 / The Ancient Awakening
        └── NPG-RED
            └── DIGITAL-SHADOWS             ← 22 pages, fully rendered
```

Each path maps directly to an HD key derivation. The namespace IS the wallet. Each segment is a branch. Each terminal leaf is an address. Each address deterministically generates one image.

The branch defines the style. `SERIES-01/Cyberpunk Origins` routes to the 29-layer character compositor — cyberpunk body skins, neon-lit backgrounds, katanas and laser rifles. `$1SHOT/QUANTUM-PARADOX` routes to Stable Diffusion with cosmic particle prompts and temporal distortion effects. The series isn't just organisation — it's a **generative parameter**. The branch chooses the style. The leaf chooses the seed.

---

## The Scattered Comic

When you generate the full tree — every leaf, every page — what comes out is a complete comic book. Cover to cover. Every page. Every panel. A full narrative, already written, hiding inside your keys.

*NPG Red: Digital Shadows* already exists as a 22-page comic. Miyuki discovers her cybernetic enhancements. The Erobots rise. Neo-Tokyo burns. But those pages were generated individually, assembled manually. With The Stamp, the entire series — every issue of *Cyberpunk Origins*, every episode of *Quantum Paradox*, every page of *Street Justice* — is already in the key tree. Scattered across branches. Waiting to be rendered.

The pages are **scattered**. They're leaves on different branches. The story is there but it's in pieces. Shattered across the tree like fragments of broken pottery.

**Kintsugi** — the Japanese art of repairing broken pottery with gold. You take the shattered pieces. You find how they connect. You join them with visible gold seams. The repair doesn't hide the damage. It celebrates it. The broken thing becomes more beautiful than the original.

The scattered pages are the shattered pottery. The derivation paths — the HD key tree that connects branch to branch, leaf to leaf — those are the gold seams. The act of traversing the tree, discovering the pages, assembling the narrative — that IS the repair. That IS the art.

The comic book was always whole. It was always in the key. The gold just hadn't been applied yet.

---

## The Machine

![The claw descends on glowing $ symbols — the machine at work](/images/blog/the-stamp/claw-machine.jpg)

The ClawMiner is a physical device. A small box. Inside: an ARM board, a GPU, a Bitcoin node, and a generative model. It costs $402. It earns $402.

It does three things simultaneously:

**1. Stamps.** The box derives a new leaf from your master key. Uses the key material as a seed. Runs the generative model — the 29-layer NPG compositor, Stable Diffusion for comic art, a text model for dialogue. An image appears, deterministically tied to that address. The box stamps the hash on-chain. Moves to the next leaf. Press. Stamp. Next.

**2. Crawls.** The box sweeps the web for $ symbols. It follows namespace paths. Catalogs trees. Maps branches. Records leaves. This is Proof of Indexing — real work, finding and organising the world's stamped content. Every $ it finds earns $402 tokens.

**3. Discovers.** Your own tree is full of content you haven't seen. The box renders it, page by page, character by character. You come back to find new images in your gallery. New NPG characters you haven't met. New comic pages from series you haven't read. Generated overnight. Deterministic. Yours. Art you own but hadn't met yet.

The box is a stamp, an indexer, and a reader. It writes the tree and reads the tree. Same device. Same motion. Same $ paths flowing in both directions.

---

## The Constellation

![Top-down view — $ symbols form a constellation across the text field, the lobster mapping connections](/images/blog/the-stamp/constellation.jpg)

Pull back far enough and you see it. Every $ on the web is a star. The crawlers trace lines between them — derivation paths, namespace hierarchies, parent-child relationships. What emerges is a constellation. A map of every content tree on the network.

The more stamps on the network, the denser the constellation. The more claws crawling, the faster the map grows. Every ClawMiner sold is a new crawler on the field. Every stamp pressed is a new star in the sky.

---

## The Properties

This architecture has properties that no existing system has:

**You don't need to store images.** Lose the file? Re-derive the key. Re-run the compositor. Same character, same comic page, same image. The key IS the storage. NPG's 55,094 cards don't need a CDN. They need a seed.

**Proof and creation are the same thing.** The key that generates the image is the key that owns the address where the stamp lives. There's no gap between making and proving. They're mathematically identical.

**Delegation is built in.** Give an artist the extended key for `$1SHOT/QUANTUM-PARADOX`. They can generate and stamp every page of that series. They can't touch your other series. You gave them a branch, not the trunk. This is how licensing works — you hand over a branch of the tree, not the tree itself.

**The tree is navigable on-chain.** Indexers follow the paths. They see the stamps. They can reconstruct the tree structure — every series, every issue, every page, every character. The hierarchy is public. The master key is private.

**Nobody knows what's in the tree until they render it.** Including you. Somewhere in the $NPG tree there's a character you haven't generated yet. She has a name you haven't assigned. She has stats you haven't rolled. She has a face composited from layers you haven't combined. She's determined but undiscovered.

---

## The Franchise

NPG isn't just a collection of characters. It's a franchise — $NPG token, 2,045,457 supply, 1:1 with company shares, BSV-21 standard. 125 verified shareholders. The token IS the equity.

Every franchise is a tree:

```
$NPG     → 3,333 character slots, 5+ comic series, merchandise branches
$1SHOT   → 5 series, unlimited issues, per-page tokenisation
$NPGRED  → mature content branch, separate licensing, same master key
```

Each namespace is a franchise. Each branch is a product line. Each leaf is a licensable, tradeable, provable piece of content. The deeper the tree, the richer the body of work, the more valuable the namespace token.

An investor doesn't buy JPEGs. They buy a branch of a tree that hasn't finished growing. The characters at the leaves don't exist yet. But they're deterministic. They're provable. And they belong to whoever holds the key.

**Rarity is structural.** NPG already has this: Legendary (1-50 copies), Epic (51-100), Rare (101-200), Uncommon (201-400), Common (401+). In the key tree, rarity maps to depth. Shallow leaves are common. Deep leaves — three, four, five branches deep — are rare by definition. The deeper you go, the more specific the generative parameters, the more unique the output.

---

## The Economy

The ClawMiner has three revenue streams, all driven by $ contracts:

**Settlement fees.** Every $ contract settled earns a fee. Your box finds a generative content contract at `$NPG/CHARACTERS/SLOT-450` — nobody has rendered that character yet. Your box generates the 29-layer composite, delivers the content, stamps the hash. You earned the settlement. Another ClawMiner was 3 seconds too slow. The competitive pressure keeps settlement costs low and speeds high.

**$402 tokens.** Earned by Proof of Indexing — the ongoing work of discovering, mapping, and cataloguing $ contracts across the network. More stamps on the network means more $ paths to crawl, more contracts to discover, more $402 earned. The indexing economy funds the content economy.

**Serving revenue.** Once you've settled a contract and hold the content, you can re-serve it. When another node or an AI agent requests that content, you serve it from cache — faster and cheaper than regenerating it. You earn a margin on every serve. Early settlers profit most: they hold content that future buyers need.

**Namespace tokens** ($NPG, $1SHOT, $NPGRED) sit above all of this. The tree of settled $ contracts under a namespace builds the brand. The deeper the tree, the more contracts settled, the more content proven, the more valuable the namespace token.

The box pays for itself by settling contracts. Your content gets stamped as a side effect of the box competing. The competition drives the network. The network creates more contracts. The claws feed each other.

---

## What This Is

This is not an NFT marketplace. There's no JPEG on-chain. There's no right-click-save debate.

This is not a DRM system. It doesn't prevent copying. It proves origination.

This is not generative art in the usual sense. The art isn't random. It's deterministic. It lives in the key. It was always there. NPG's 29 layers, One-Shot's five series, NPG Red's 22-page comic — all of it was hiding in the master key. We just hadn't rendered it yet.

**This is a machine that grows a tree of content from a single seed, stamps each leaf on the blockchain, and lets the world's claws index the branches.** The content is the key. The proof is the stamp. The $ is the signal. The claw is the crawler. The constellation grows with every press.

The characters are real. The comics are real. The tokens are real. The franchises are real. The tree just needed a stamp.

---

## The Name

We considered calling it "The Mint." Minting implies creation from nothing.

We kept **"The Stamp."** Stamping implies authority. The content already exists — in potential, in the key, waiting to be rendered. The stamp is the act of making it real. Pressing the seal into the wax. Collapsing the wavefunction. Saying: this image, at this address, at this time. It was always mine. Now it's proven.

Miyuki was always in the key. Toki was always at slot 182. *Digital Shadows* was always scattered across the branches. The $ was always the signal. The claw was always reaching.

The box is a stamp. The tree grows with every press. The claws find every dollar sign. The scattered pages find their gold seams.

---

*b0ase / NPGX / 2026*

---

## Image Credits

All images generated from ClawMiner packaging prompts. Orange/black palette. The $ is the signal.

| Image | Description |
|-------|-------------|
| stamp-press.jpg | The stamp mid-press — $ radiating from the impact point |
| dollar-sign-seam.jpg | The $ glyph built from /$NPG/$SERIES/$ISSUE/$PAGE paths |
| lobster-indexing.jpg | The claw crawling a text field, tracing $ connections |
| claw-reaches.jpg | Wireframe claw reaching for $NPG, $402, $1SHOT tags |
| stamp-device.jpg | The device at the centre of its radiating $ path network |
| claw-machine.jpg | The claw descending on blazing $ symbols |
| constellation.jpg | Top-down: $ constellation across dense text, lobster mapping |
