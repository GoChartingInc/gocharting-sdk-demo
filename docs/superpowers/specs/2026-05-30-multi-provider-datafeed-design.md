# Multi-Provider Datafeed + Provider Switch — Design

**Date:** 2026-05-30
**Status:** Approved (pending spec review)

## Problem

The demo app's default route (`/` → `Advanced2TradingPage` → `ChartSDKAdvanced2`) reads
`?datafeed=` from the URL (default `bybit`) and supports exactly two feeds — `bybit`
(`src/utils/chart-datafeed.ts`, ~2000 lines) and `twelvedata`
(`src/utils/twelve-chart-datafeed.ts`). The two files duplicate almost all datafeed
boilerplate; only ~5 things differ per provider. There is **no UI switch** — the feed can
only be changed by hand-editing the URL.

We want to:
1. Support many data providers (all keyless crypto exchanges, extensible to "all available").
2. Add a UI switch — **outside the SDK chart**, at the top of the page — driving `?datafeed=`.
3. Default to `bybit` when no param is present.

## Approach (chosen: A — adapter registry + generic factory)

Extract the shared datafeed boilerplate into one `createDatafeed(provider)` factory. Each
provider becomes a small **adapter config object** specifying only its unique bits. A
registry exports them all; the switch is data-driven off the registry, so new providers
appear in the UI automatically.

## File layout

```
src/utils/datafeed/
  types.ts            # DatafeedProvider interface, RawBar, TradeTick, shared types
  createDatafeed.ts   # generic factory: all shared boilerplate, takes a provider adapter
  providers/
    bybit.ts          # adapter (logic migrated from chart-datafeed.ts)
    binance.ts
    okx.ts
    coinbase.ts
    kraken.ts
    twelvedata.ts     # adapter (logic migrated from twelve-chart-datafeed.ts)
    index.ts          # PROVIDERS registry + getProvider() / listProviders()
src/components/DataProviderSwitch/
  DataProviderSwitch.tsx   # page-level native <select>, reads/writes ?datafeed=
  index.ts
```

`src/utils/chart-datafeed.ts` and `src/utils/twelve-chart-datafeed.ts` become **thin
re-exports** so the 4 existing importers keep working unchanged:

```ts
// chart-datafeed.ts
export const createChartDatafeed = () => createDatafeed(PROVIDERS.bybit);
// twelve-chart-datafeed.ts
export const createTwelveDataChartDatafeed = () => createDatafeed(PROVIDERS.twelvedata);
```

Importers that must keep working: `MultiBasicChart.tsx`, `ChartDemo.tsx`, `ChartSDK.tsx`,
`ChartSDKAdvanced.tsx`, `ChartSDKAdvanced2.tsx`.

## Provider adapter interface (`types.ts`)

```ts
type RawBar = { time: number; open: number; high: number; low: number; close: number; volume: number };

type TradeTick = {
  symbol: string;
  price: number;
  size: number;
  side: "BUY" | "SELL";
  timestampMs: number;
};

interface DatafeedProvider {
  id: string;                 // "binance"  (the ?datafeed= value)
  label: string;              // "Binance"  (switch UI text)
  exchange: string;           // "BINANCE"  (SymbolInfo.exchange)
  segment: string;            // "SPOT" | "FUTURE"
  quoteCurrency: string;      // "USDT" | "USD"

  // canonical base ("BTC","ETH","SOL","XRP") -> chart symbol + provider symbol
  resolveSymbol(base: string): { fullName: string; providerSymbol: string };

  // history
  mapInterval(resolution: string | Resolution): string;
  buildKlineUrl(providerSymbol: string, interval: string, params: PeriodParams): string;
  parseKlines(json: unknown): RawBar[];   // ALWAYS returns oldest-first

  // realtime
  wsUrl: string;
  buildSubscribe(providerSymbol: string): unknown;
  buildUnsubscribe(providerSymbol: string): unknown;
  parseTrade(rawMsg: unknown): TradeTick | null;  // null = ignore (heartbeats/status)
}
```

## Generic factory (`createDatafeed.ts`)

Holds everything currently duplicated across the two feeds:

- `getBars` → `provider.buildKlineUrl` + `provider.parseKlines` → UDF conversion;
  demo-data fallback on error (reuse existing `generateDemoData`/`convertToUDFFormat`).
- `resolveSymbol` → GoCharting `exactSearch` API first, adapter fallback
  (`provider.resolveSymbol` + shared `SymbolInfo` builder using `exchange`, `segment`,
  `quoteCurrency`, sensible 24x7 crypto defaults).
- `searchSymbols` → GoCharting `search` API with mock fallback (unchanged).
- Subscription/channel machinery (`subscribeOnStream`, `unsubscribeFromStream`, socket
  lifecycle, `channelToSubscription`) calling `provider.buildSubscribe` /
  `provider.parseTrade`, emitting `TradeMessage` to handlers.
- `getMarks` / `getTimescaleMarks` (unchanged demo marks).
- `destroy()` cleanup.

One implementation, N providers. Returns an object cast to the SDK `Datafeed` type, with a
`destroy()` method (as today).

## Registry + shipped providers

`providers/index.ts`:

```ts
export const PROVIDERS = { bybit, binance, okx, coinbase, kraken, twelvedata } as const;
export type ProviderId = keyof typeof PROVIDERS;
export const getProvider = (id: string): DatafeedProvider => PROVIDERS[id as ProviderId] ?? PROVIDERS.bybit;
export const listProviders = () => Object.values(PROVIDERS).map(p => ({ id: p.id, label: p.label }));
```

Adding a new exchange later = one adapter file + one registry line; it appears in the
switch automatically.

### Per-provider specifics (the only thing each adapter encodes)

| Provider | REST klines | Order | WS | Trade channel | Symbol | Interval map |
|---|---|---|---|---|---|---|
| Bybit | `api.bybit.com/v5/market/kline` | newest-first (reverse) | `stream.bybit.com/v5/public/linear` | `publicTrade.{sym}` | `BTCUSDT` | `1,5,15,30,60,240,D,W,M` |
| Binance | `api.binance.com/api/v3/klines` | oldest-first | `stream.binance.com:9443/ws` | `{sym}@trade` | `BTCUSDT` | `1m,5m,15m,30m,1h,4h,1d,1w,1M` |
| OKX | `www.okx.com/api/v5/market/candles` | newest-first (reverse) | `ws.okx.com:8443/ws/v5/public` | `{channel:"trades",instId}` | `BTC-USDT` | `1m,5m,15m,30m,1H,4H,1D,1W,1M` |
| Coinbase | `api.exchange.coinbase.com/products/{id}/candles` | newest-first (reverse) | `ws-feed.exchange.coinbase.com` | `matches` | `BTC-USD` | granularity secs `60,300,900,3600,21600,86400` |
| Kraken | `api.kraken.com/0/public/OHLC` | oldest-first | `ws.kraken.com` | `{name:"trade"}` | `XBT/USD` (BTC→XBT) | minutes `1,5,15,30,60,240,1440,...` |
| TwelveData | existing | per existing | existing | existing | `BTC/USD` | existing |

Quirks (Coinbase limited granularity set, Kraken `BTC→XBT`, newest-first ordering) live
**inside each adapter only** — the factory never sees them.

## Symbol model

Replace the single `BYBIT_TO_TWELVEDATA_SYMBOL` map in `ChartSDKAdvanced2` with a
**canonical base watchlist**: `["BTC","ETH","SOL","XRP"]`. The watchlist UI renders the
canonical bases; `handleSymbolChange` and price-fetch logic key off a stable canonical id,
and the **chart symbol** is derived per provider via `getProvider(datafeed).resolveSymbol(base).fullName`.
Internal trading logic remains provider-agnostic.

## Page-level switch + chart re-init

`<DataProviderSwitch>` (native `<select>`, styled to match the existing order-type select in
`ChartSDKAdvanced2.tsx:1565`) renders at the top of `Advanced2TradingPage`, above
`<ChartSDKAdvanced2>`, **outside the SDK**:

```tsx
const Advanced2TradingPage = () => (
  <>
    <DataProviderSwitch />
    <ChartSDKAdvanced2 key={datafeedParam} />
  </>
);
```

- `DataProviderSwitch` reads `searchParams.get("datafeed") ?? "bybit"`, options from
  `listProviders()`, and on change calls `setSearchParams` (preserving other params).
- The page reads the same param and passes `key={datafeed}` to `ChartSDKAdvanced2`, so a
  provider change **remounts** the chart component — its existing teardown/`destroy()` runs
  and the chart rebuilds with the new feed + that provider's default symbol. This is the
  cleanest fit for the component's current single-shot init (empty-deps `initChart`).

Inside `ChartSDKAdvanced2`, `initChart` swaps the hardcoded
`datafeed === "bybit" ? createChartDatafeed() : createTwelveDataChartDatafeed()` for
`createDatafeed(getProvider(datafeed))`, and the default symbol becomes
`getProvider(datafeed).resolveSymbol("BTC").fullName`.

## Error handling / fallback

- Network/parse failure in `getBars` → existing demo-data fallback (chart still renders).
- WS failure → logged; chart keeps historical bars (existing behavior).
- Unknown `?datafeed=` value → `getProvider` falls back to `bybit`; switch shows `bybit`.

## Testing / verification

Manual browser verification per provider via `?datafeed=<id>`: historical bars load + live
ticks stream. Verify end-to-end at minimum: Bybit (regression), Binance, and one of
OKX/Coinbase/Kraken. Confirm the 4 legacy importers still compile and render (re-export
shims).

## Out of scope

- No new test framework (project has none today; verification is manual).
- TwelveData adapter migration keeps its existing behavior; not re-architected beyond
  fitting the registry.
- No changes to the other routes/pages beyond the re-export shims.
