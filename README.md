# skystats api-spec

The contract for the SkyStats public API (`openapi.yaml`) and a typed TypeScript client generated from it (`@skystats/api-client`).

The server implements this spec. The website, Discord bot, and anything else consume the generated client — nobody hand-writes API types.

## Using the client

```bash
npm install github:skystats-cc/api-spec#v0.8.0
```

```ts
import { createSkystatsClient, SkystatsApiError } from '@skystats/api-client';

const api = createSkystatsClient({ baseUrl: 'https://api.skystats.cc' });
const diamond = await api.bazaar.get('ENCHANTED_DIAMOND');   // fully typed
const status = await api.status();
```

Errors throw `SkystatsApiError` with `.status` (`0` means unreachable/timeout) and `.code` (e.g. `expired_code`).

Authenticated calls: browsers send the `ss_session` cookie automatically (same-origin). Other clients pass a token:

```ts
const api = createSkystatsClient({ baseUrl, getToken: () => process.env.SKYSTATS_TOKEN });
await api.me.profiles();
```

## Auth & pairing flow

```
Website                         API                              Mod (in game)
POST /v1/pairing  ───────────►  code ABCD-EFGH + secret
shows "/skystats link ABCD-EFGH" [Copy]
                                                                 /skystats link ABCD-EFGH → [Confirm]
                                POST /v1/auth/mod/challenge ◄─── (once; token cached afterwards)
                                serverId ──────────────────────► Mojang joinServer(serverId)
                                POST /v1/auth/mod/verify ◄────── username + serverId
                                Mojang hasJoined ✔ → mod token ─►
                                POST /v1/pairing/claim ◄──────── code (Bearer mod token)
POST /v1/pairing/{id}/poll ──►  status=linked + Set-Cookie ss_session
```

Installing from GitHub runs `prepare`, which generates and builds the client — you only need git access to the repo, no package registry token.

## Changing the API

1. Edit `openapi.yaml`.
2. `npm run generate` (updates `src/schema.ts`; commit it).
3. `npm run lint`.
4. Open a PR. Once merged, tag a release: `git tag v0.2.0 && git push --tags`.
5. Bump the `#vX.Y.Z` in each consumer's `package.json`.

**Versioning:** additive changes (new endpoint, new optional field) → minor bump. Removing or renaming anything → major bump **and** a new `/v2` path in the server; `/v1` keeps working until the mod and bot have moved over.

## Docs

`npm run docs` builds a static HTML reference into `docs/`.
