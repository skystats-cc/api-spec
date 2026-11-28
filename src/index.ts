import createClient from 'openapi-fetch';
import type { components, paths } from './schema.js';

export type { components, paths };
type Schemas = components['schemas'];
export type BazaarProduct = Schemas['BazaarProduct'];
export type BazaarSnapshot = Schemas['BazaarSnapshot'];
export type HypixelStatus = Schemas['HypixelStatus'];
export type StatusIndicator = HypixelStatus['indicator'];
export type Account = Schemas['Account'];
export type ModChallenge = Schemas['ModChallenge'];
export type ModSession = Schemas['ModSession'];
export type Pairing = Schemas['Pairing'];
export type PairingStatus = Schemas['PairingStatus'];
export type Profile = Schemas['Profile'];
export type ProfileMember = Schemas['ProfileMember'];
export type MyProfiles = Schemas['MyProfiles'];
export type Tier = Schemas['Tier'];
export type Entitlement = Schemas['Entitlement'];
export type MoneyHistory = Schemas['MoneyHistory'];
export type MoneyPoint = Schemas['MoneyPoint'];
export type PrivacySettings = Schemas['PrivacySettings'];
export type ModSnapshot = Schemas['ModSnapshot'];
export type PublicPlayer = Schemas['PublicPlayer'];
export type DiscordLink = Schemas['DiscordLink'];
export type LinkedAccount = Schemas['LinkedAccount'];
export type SessionInfo = Schemas['SessionInfo'];
export type BotPairingStatus = Schemas['BotPairingStatus'];
export type NotificationPrefs = Schemas['NotificationPrefs'];
export type AlertRule = Schemas['AlertRule'];
export type NewAlertRule = Schemas['NewAlertRule'];
export type Goal = Schemas['Goal'];
export type ApiKey = Schemas['ApiKey'];
export type PendingSignup = Schemas['PendingSignup'];
export type GuildSettings = Schemas['GuildSettings'];
export type Webhook = Schemas['Webhook'];
export type Notification = Schemas['Notification'];
export type NewsItem = Schemas['NewsItem'];
export type Election = Schemas['Election'];
export type Item = Schemas['Item'];
export type Movers = Schemas['Movers'];
export type Flip = Schemas['Flip'];
export type CraftPlan = Schemas['CraftPlan'];
export type AuctionPrices = Schemas['AuctionPrices'];
export type MethodSummary = Schemas['MethodSummary'];
export type MethodDetail = Schemas['MethodDetail'];
export type CustomMethodInput = Schemas['CustomMethodInput'];
export type OrderLevel = Schemas['OrderLevel'];
export type PlaySession = Schemas['PlaySession'];
export type MoneyDays = Schemas['MoneyDays'];
export type Annotation = Schemas['Annotation'];
export type CoopView = Schemas['CoopView'];
export type Leaderboard = Schemas['Leaderboard'];
export type Achievement = Schemas['Achievement'];
export type Wrapped = Schemas['Wrapped'];
export type ProfileLook = Schemas['ProfileLook'];
export type Competition = Schemas['Competition'];
export type MoneyRange = NonNullable<NonNullable<paths['/v1/me/money']['get']['parameters']['query']>['range']>;

export class SkystatsApiError extends Error {
  /** status 0 = network error / timeout (API unreachable) */
  constructor(
    public readonly status: number,
    message: string,
    /** machine-readable code from the API, e.g. "expired_code" */
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'SkystatsApiError';
  }
  get unreachable() {
    return this.status === 0;
  }
}

export interface ClientOptions {
  /** e.g. https://api.skystats.cc, or '' for same-origin in the browser */
  baseUrl: string;
  timeoutMs?: number;
  /** Bearer token provider (mod tokens / server-to-server). Browsers use the session cookie instead. */
  getToken?: () => string | null | undefined;
  /** Extra headers per request (the bot sends x-bot-key and x-discord-user-id) */
  getHeaders?: () => Record<string, string>;
}

type Result<T> = { data?: T; error?: unknown; response: Response };

async function unwrap<T>(call: () => Promise<Result<T>>): Promise<T> {
  let result: Result<T>;
  try {
    result = await call();
  } catch (err) {
    throw new SkystatsApiError(0, err instanceof Error ? err.message : 'SkyStats API unreachable');
  }
  const { data, error, response } = result;
  if (error !== undefined || !response.ok) {
    const body = error as { message?: string; error?: string } | undefined;
    throw new SkystatsApiError(
      response.status,
      body?.message ?? `SkyStats API returned ${response.status}`,
      body?.error,
    );
  }
  return data as T;
}

export function createSkystatsClient({ baseUrl, timeoutMs = 5000, getToken, getHeaders }: ClientOptions) {
  const raw = createClient<paths>({
    baseUrl: baseUrl.replace(/\/$/, ''),
    fetch: (req: Request) => {
      const token = getToken?.();
      const extra = getHeaders?.();
      if (token || extra) {
        const headers = new Headers(req.headers);
        if (token) headers.set('Authorization', `Bearer ${token}`);
        for (const [k, v] of Object.entries(extra ?? {})) headers.set(k, v);
        req = new Request(req, { headers });
      }
      return fetch(req, { signal: AbortSignal.timeout(timeoutMs) });
    },
  });

  return {
    /** Lower-level openapi-fetch client for anything not wrapped below */
    raw,
    health: () => unwrap(() => raw.GET('/healthz')),

    bazaar: {
      list: (q?: string) => unwrap(() => raw.GET('/v1/bazaar', { params: { query: q ? { q } : {} } })),
      get: (productId: string) =>
        unwrap(() => raw.GET('/v1/bazaar/{productId}', { params: { path: { productId } } })),
      history: (productId: string, days = 7) =>
        unwrap(() =>
          raw.GET('/v1/bazaar/{productId}/history', {
            params: { path: { productId }, query: { days } },
          }),
        ),
    },

    status: () => unwrap(() => raw.GET('/v1/status')),

    auth: {
      modChallenge: () => unwrap(() => raw.POST('/v1/auth/mod/challenge')),
      modVerify: (username: string, serverId: string) =>
        unwrap(() => raw.POST('/v1/auth/mod/verify', { body: { username, serverId } })),
      logout: () => unwrap(() => raw.POST('/v1/auth/logout')),
    },

    pairing: {
      /** Website: create a code to show the player */
      create: () => unwrap(() => raw.POST('/v1/pairing')),
      /** Website: poll until `linked` (the response then sets the session cookie) */
      poll: (pairingId: string, secret: string) =>
        unwrap(() =>
          raw.POST('/v1/pairing/{pairingId}/poll', { params: { path: { pairingId } }, body: { secret } }),
        ),
      /** Mod: claim a code the player typed */
      claim: (code: string) => unwrap(() => raw.POST('/v1/pairing/claim', { body: { code } })),
    },

    mod: {
      heartbeat: (modVersion: string, minecraftVersion: string) =>
        unwrap(() => raw.POST('/v1/mod/heartbeat', { body: { modVersion, minecraftVersion } })),
      snapshot: (body: ModSnapshot) => unwrap(() => raw.POST('/v1/mod/snapshot', { body })),
      events: (body: { profileId?: string | null; events: { type: 'rare_drop'; at: number; itemName: string; itemId?: string; qty?: number }[] }) =>
        unwrap(() => raw.POST('/v1/mod/events', { body })),
    },

    players: {
      /** Public summary; 404 unless the player made their profile public */
      get: (name: string) => unwrap(() => raw.GET('/v1/players/{name}', { params: { path: { name } } })),
    },

    billing: {
      entitlement: () => unwrap(() => raw.GET('/v1/me/entitlement')),
      checkout: (tier: 'pro' | 'max', interval: 'month' | 'year' = 'month', creator?: string) =>
        unwrap(() => raw.POST('/v1/billing/checkout', { body: { tier, interval, ...(creator ? { creator } : {}) } })),
      portal: () => unwrap(() => raw.POST('/v1/billing/portal')),
      gift: (tier: 'pro' | 'max') => unwrap(() => raw.POST('/v1/billing/gift', { body: { tier } })),
      redeem: (code: string) => unwrap(() => raw.POST('/v1/billing/redeem', { body: { code } })),
    },

    platform: {
      flags: () => unwrap(() => raw.GET('/v1/flags')),
      apiStatus: () => unwrap(() => raw.GET('/v1/api/status')),
      batch: (paths: string[]) => unwrap(() => raw.POST('/v1/batch', { body: { requests: paths.map((path) => ({ path })) } })),
      apiKeys: () => unwrap(() => raw.GET('/v1/me/api-keys')),
      createApiKey: (name: string) => unwrap(() => raw.POST('/v1/me/api-keys', { body: { name } })),
      revokeApiKey: (id: string) => unwrap(() => raw.DELETE('/v1/me/api-keys/{id}', { params: { path: { id } } })),
      webhooks: () => unwrap(() => raw.GET('/v1/me/webhooks')),
      createWebhook: (url: string) => unwrap(() => raw.POST('/v1/me/webhooks', { body: { url } })),
      deleteWebhook: (id: string) => unwrap(() => raw.DELETE('/v1/me/webhooks/{id}', { params: { path: { id } } })),
      testWebhook: (id: string) => unwrap(() => raw.POST('/v1/me/webhooks/{id}/test', { params: { path: { id } } })),
      rotateSession: () => unwrap(() => raw.POST('/v1/me/sessions/rotate')),
      /** Live bazaar prices (browser only: uses EventSource). Returns a function that closes the stream. */
      streamBazaar: (onPrices: (e: { at: string; products: { id: string; buyPrice: number; sellPrice: number }[] }) => void) => {
        const es = new EventSource(`${baseUrl.replace(/\/$/, '')}/v1/bazaar/stream`);
        es.addEventListener('prices', (ev) => onPrices(JSON.parse((ev as MessageEvent<string>).data)));
        return () => es.close();
      },
    },

    me: {
      get: () => unwrap(() => raw.GET('/v1/me')),
      updateSettings: (settings: { trackingEnabled?: boolean }) =>
        unwrap(() => raw.PATCH('/v1/me/settings', { body: settings })),
      profiles: () => unwrap(() => raw.GET('/v1/me/profiles')),
      refreshProfiles: () => unwrap(() => raw.POST('/v1/me/profiles/refresh')),
      money: (profileId: string, range: MoneyRange = '7d') =>
        unwrap(() => raw.GET('/v1/me/money', { params: { query: { profileId, range } } })),
      privacy: () => unwrap(() => raw.GET('/v1/me/privacy')),
      updatePrivacy: (patch: Partial<PrivacySettings>) => unwrap(() => raw.PATCH('/v1/me/privacy', { body: patch })),
      /** Browser: link to this URL to download; this helper returns the parsed JSON */
      exportData: () => unwrap(() => raw.GET('/v1/me/export')),
      deleteAccount: () => unwrap(() => raw.POST('/v1/me/delete', { body: { confirm: 'DELETE' } })),
      sessions: () => unwrap(() => raw.GET('/v1/me/sessions')),
      revokeSession: (sessionId: string) =>
        unwrap(() => raw.DELETE('/v1/me/sessions/{sessionId}', { params: { path: { sessionId } } })),
      revokeOtherSessions: () => unwrap(() => raw.POST('/v1/me/sessions/revoke-others')),
    },

    discord: {
      /** Browser: navigate (not fetch) here to sign in or link */
      startUrl: (mode: 'login' | 'link') => `${baseUrl.replace(/\/$/, '')}/v1/auth/discord/start?mode=${mode}`,
      status: () => unwrap(() => raw.GET('/v1/me/discord')),
      unlink: () => unwrap(() => raw.DELETE('/v1/me/discord')),
      accounts: () => unwrap(() => raw.GET('/v1/me/accounts')),
      switchTo: (uuid: string) => unwrap(() => raw.POST('/v1/me/switch', { body: { uuid } })),
      /** Signed up with Discord, Minecraft not paired yet (401 when there's no sign-up) */
      pending: () => unwrap(() => raw.GET('/v1/auth/pending')),
      cancelPending: () => unwrap(() => raw.DELETE('/v1/auth/pending')),
    },

    insight: {
      sessions: (days = 7) => unwrap(() => raw.GET('/v1/me/play-sessions', { params: { query: { days } } })),
      tagSession: (id: string, methodId: string | null) => unwrap(() => raw.PATCH('/v1/me/play-sessions/{id}', { params: { path: { id } }, body: { methodId } })),
      days: (profileId: string, days = 30) => unwrap(() => raw.GET('/v1/me/money/days', { params: { query: { profileId, days } } })),
      breakdown: (profileId: string, days = 30) => unwrap(() => raw.GET('/v1/me/money/breakdown', { params: { query: { profileId, days } } })),
      compare: (profileId: string, days = 7) => unwrap(() => raw.GET('/v1/me/money/compare', { params: { query: { profileId, days } } })),
      csvUrl: (profileId: string) => `${baseUrl.replace(/\/$/, '')}/v1/me/money.csv?profileId=${profileId}`,
      drops: (days = 7) => unwrap(() => raw.GET('/v1/me/drops', { params: { query: { days } } })),
      annotations: (profileId: string) => unwrap(() => raw.GET('/v1/me/annotations', { params: { query: { profileId } } })),
      addAnnotation: (profileId: string, at: string, text: string) => unwrap(() => raw.POST('/v1/me/annotations', { body: { profileId, at, text } })),
      deleteAnnotation: (id: string) => unwrap(() => raw.DELETE('/v1/me/annotations/{id}', { params: { path: { id } } })),
      methodPerformance: (id: string) => unwrap(() => raw.GET('/v1/me/methods-performance/{id}', { params: { path: { id } } })),
      coop: (profileId: string, days = 7) => unwrap(() => raw.GET('/v1/me/coop/{profileId}', { params: { path: { profileId }, query: { days } } })),
    },

    social: {
      leaderboard: (q: { board?: 'gain' | 'consistency' | 'coop'; period?: '7d' | '30d'; scope?: string } = {}) =>
        unwrap(() => raw.GET('/v1/leaderboards', { params: { query: q } })),
      following: () => unwrap(() => raw.GET('/v1/me/follows')),
      follow: (name: string) => unwrap(() => raw.PUT('/v1/me/follows/{name}', { params: { path: { name } } })),
      unfollow: (name: string) => unwrap(() => raw.DELETE('/v1/me/follows/{name}', { params: { path: { name } } })),
      feed: () => unwrap(() => raw.GET('/v1/me/feed')),
      achievements: () => unwrap(() => raw.GET('/v1/me/achievements')),
      wrapped: (period: string) => unwrap(() => raw.GET('/v1/me/wrapped', { params: { query: { period } } })),
      look: () => unwrap(() => raw.GET('/v1/me/profile-look')),
      setLook: (body: { profileTheme?: string | null; vanity?: string | null }) =>
        unwrap(() => raw.PATCH('/v1/me/profile-look', { body: body as never })),
      ogPlayerUrl: (name: string) => `${baseUrl.replace(/\/$/, '')}/v1/og/player/${name}.png`,
    },

    alerts: {
      prefs: () => unwrap(() => raw.GET('/v1/me/notification-prefs')),
      updatePrefs: (patch: Schemas['NotificationPrefsPatch']) => unwrap(() => raw.PATCH('/v1/me/notification-prefs', { body: patch })),
      list: () => unwrap(() => raw.GET('/v1/me/alerts')),
      create: (rule: NewAlertRule) => unwrap(() => raw.POST('/v1/me/alerts', { body: rule })),
      remove: (id: string) => unwrap(() => raw.DELETE('/v1/me/alerts/{id}', { params: { path: { id } } })),
      goals: () => unwrap(() => raw.GET('/v1/me/goals')),
      createGoal: (profileId: string, target: number) => unwrap(() => raw.POST('/v1/me/goals', { body: { profileId, target } })),
      removeGoal: (id: string) => unwrap(() => raw.DELETE('/v1/me/goals/{id}', { params: { path: { id } } })),
      inbox: () => unwrap(() => raw.GET('/v1/me/notifications')),
      readAll: () => unwrap(() => raw.POST('/v1/me/notifications/read-all')),
    },

    market: {
      items: (q: string) => unwrap(() => raw.GET('/v1/items', { params: { query: { q } } })),
      movers: (window: '1h' | '24h' | '7d' = '24h') => unwrap(() => raw.GET('/v1/bazaar-insights/movers', { params: { query: { window } } })),
      categories: () => unwrap(() => raw.GET('/v1/bazaar-insights/categories')),
      index: (days = 30) => unwrap(() => raw.GET('/v1/bazaar-insights/index', { params: { query: { days } } })),
      npcArbitrage: () => unwrap(() => raw.GET('/v1/bazaar-insights/npc-arbitrage')),
      flips: () => unwrap(() => raw.GET('/v1/bazaar-insights/flips')),
      anomalies: () => unwrap(() => raw.GET('/v1/bazaar-insights/anomalies')),
      depth: (productId: string) => unwrap(() => raw.GET('/v1/bazaar/{productId}/depth', { params: { path: { productId } } })),
      spread: (productId: string, days = 7) => unwrap(() => raw.GET('/v1/bazaar/{productId}/spread', { params: { path: { productId }, query: { days } } })),
      seasonality: (productId: string) => unwrap(() => raw.GET('/v1/bazaar/{productId}/seasonality', { params: { path: { productId } } })),
      correlations: (productId: string) => unwrap(() => raw.GET('/v1/bazaar/{productId}/correlations', { params: { path: { productId } } })),
      craft: (productId: string) => unwrap(() => raw.GET('/v1/bazaar/{productId}/craft', { params: { path: { productId } } })),
      auction: (productId: string, days = 7) => unwrap(() => raw.GET('/v1/auctions/{productId}', { params: { path: { productId }, query: { days } } })),
      electionHistory: () => unwrap(() => raw.GET('/v1/election/history')),
      embedUrl: (productId: string, days = 7) => `${baseUrl.replace(/\/$/, '')}/v1/embed/bazaar/${productId}.svg?days=${days}`,
      watchlist: () => unwrap(() => raw.GET('/v1/me/watchlist')),
      watch: (productId: string) => unwrap(() => raw.PUT('/v1/me/watchlist/{productId}', { params: { path: { productId } } })),
      unwatch: (productId: string) => unwrap(() => raw.DELETE('/v1/me/watchlist/{productId}', { params: { path: { productId } } })),
    },

    methods: {
      list: () => unwrap(() => raw.GET('/v1/methods')),
      get: (id: string) => unwrap(() => raw.GET('/v1/methods/{id}', { params: { path: { id } } })),
      history: (id: string, days = 30) => unwrap(() => raw.GET('/v1/methods/{id}/history', { params: { path: { id }, query: { days } } })),
      vote: (id: string, vote: 1 | -1, extra: { stillWorks?: boolean; difficulty?: number } = {}) =>
        unwrap(() => raw.PUT('/v1/methods/{id}/vote', { params: { path: { id } }, body: { vote, ...extra } })),
      createCustom: (input: CustomMethodInput) => unwrap(() => raw.POST('/v1/me/methods', { body: input })),
      updateCustom: (id: string, input: CustomMethodInput) => unwrap(() => raw.PUT('/v1/me/methods/{id}', { params: { path: { id } }, body: input })),
      deleteCustom: (id: string) => unwrap(() => raw.DELETE('/v1/me/methods/{id}', { params: { path: { id } } })),
    },

    news: () => unwrap(() => raw.GET('/v1/news')),
    election: () => unwrap(() => raw.GET('/v1/election')),

    /** Internal: only works with getHeaders supplying x-bot-key and x-discord-user-id */
    bot: {
      serverLeaderboard: (discordIds: string[], board: 'gain' | 'consistency' = 'gain', period: '7d' | '30d' = '7d') =>
        unwrap(() => raw.POST('/v1/bot/leaderboard', { body: { discordIds, board, period } })),
      createCompetition: (guildId: string, name: string, hours: number) => unwrap(() => raw.POST('/v1/bot/competitions', { body: { guildId, name, hours } })),
      competitions: (guildId: string) => unwrap(() => raw.GET('/v1/bot/competitions', { params: { query: { guildId } } })),
      joinCompetition: (id: string) => unwrap(() => raw.POST('/v1/bot/competitions/{id}/join', { params: { path: { id } } })),
      standings: (id: string) => unwrap(() => raw.GET('/v1/bot/competitions/{id}', { params: { path: { id } } })),
      gameToday: (game: 'guess' | 'predict') => unwrap(() => raw.GET('/v1/bot/games/{game}/today', { params: { path: { game } } })),
      guess: (guess: number) => unwrap(() => raw.POST('/v1/bot/games/guess', { body: { guess } })),
      predict: (direction: 1 | -1) => unwrap(() => raw.POST('/v1/bot/games/predict', { body: { direction } })),
      gameBoard: (game: 'guess' | 'predict') => unwrap(() => raw.GET('/v1/bot/games/{game}/leaderboard', { params: { path: { game } } })),
      richOrNot: () => unwrap(() => raw.GET('/v1/bot/games/rich-or-not')),
      claimNotifications: (limit = 25) => unwrap(() => raw.POST('/v1/bot/notifications/claim', { body: { limit } })),
      notificationResult: (id: number, ok: boolean) =>
        unwrap(() => raw.POST('/v1/bot/notifications/{id}/result', { params: { path: { id } }, body: { ok } })),
      unannouncedNews: () => unwrap(() => raw.GET('/v1/bot/news/unannounced')),
      markAnnounced: (id: string) => unwrap(() => raw.POST('/v1/bot/news/announced', { body: { id } })),
      startPairing: (discordUsername?: string | null) =>
        unwrap(() => raw.POST('/v1/bot/pairing', { body: { discordUsername: discordUsername ?? null } })),
      pairingStatus: (pairingId: string) =>
        unwrap(() => raw.GET('/v1/bot/pairing/{pairingId}', { params: { path: { pairingId } } })),
      whois: (discordId: string) => unwrap(() => raw.GET('/v1/bot/whois/{discordId}', { params: { path: { discordId } } })),
      roleSync: () => unwrap(() => raw.GET('/v1/bot/role-sync')),
      guildSettings: (guildId: string) => unwrap(() => raw.GET('/v1/bot/guilds/{guildId}/settings', { params: { path: { guildId } } })),
      updateGuildSettings: (guildId: string, body: Partial<Omit<GuildSettings, 'guildId'>>) =>
        unwrap(() => raw.PUT('/v1/bot/guilds/{guildId}/settings', { params: { path: { guildId } }, body })),
      forgetGuild: (guildId: string) => unwrap(() => raw.DELETE('/v1/bot/guilds/{guildId}/settings', { params: { path: { guildId } } })),
      guildChannels: (kind: 'status' | 'news' | 'board' | 'bazaar') => unwrap(() => raw.GET('/v1/bot/guild-channels', { params: { query: { kind } } })),
    },
  };
}

export type SkystatsClient = ReturnType<typeof createSkystatsClient>;
