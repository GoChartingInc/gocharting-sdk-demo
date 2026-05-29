# Multi-Provider Datafeed + Provider Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two hand-duplicated chart datafeeds with one generic factory driven by small per-provider adapters, ship real keyless feeds for Bybit/Binance/OKX/Coinbase/Kraken (plus migrated TwelveData), and add a page-level provider switch driving `?datafeed=` (default `bybit`).

**Architecture:** A `createDatafeed(provider)` factory holds all shared boilerplate (history fetch → UDF, symbol resolution, WS subscription machinery, demo fallback, marks). Each provider is a `DatafeedProvider` adapter object specifying only its unique bits (kline URL/parse, interval map, WS url/subscribe/trade-parse, symbol mapping). A registry exports all adapters; a native `<select>` rendered above the chart lists the registry and remounts the chart on change.

**Tech Stack:** React 19, react-router-dom 7 (`useSearchParams`), TypeScript, `@gocharting/chart-sdk`, CRA/craco. No test framework — automated gate per task is `npx tsc --noEmit`; functional verification is manual in-browser.

**Project conventions:** Tabs for indentation. Path alias `@/*` → `src/*`. Files use named `export const create...`.

---

## File Structure

```
src/utils/datafeed/
  types.ts            # NEW — DatafeedProvider, RawBar, TradeTick, shared SymbolInfo builder
  createDatafeed.ts   # NEW — generic factory (shared boilerplate)
  providers/
    bybit.ts          # NEW — adapter
    binance.ts        # NEW — adapter
    okx.ts            # NEW — adapter
    coinbase.ts       # NEW — adapter
    kraken.ts         # NEW — adapter
    twelvedata.ts     # NEW — adapter (wraps existing twelve feed via legacy export)
    index.ts          # NEW — PROVIDERS registry + getProvider/listProviders
src/utils/chart-datafeed.ts          # MODIFY — becomes re-export shim
src/utils/twelve-chart-datafeed.ts   # KEEP as-is (twelvedata adapter delegates to it)
src/components/DataProviderSwitch/
  DataProviderSwitch.tsx   # NEW
  index.ts                 # NEW
src/pages/Advanced2TradingPage.tsx                       # MODIFY — render switch + key remount
src/components/ChartSDKAdvanced2/ChartSDKAdvanced2.tsx   # MODIFY — use getProvider/registry
```

> **Migration note:** The TwelveData feed (`twelve-chart-datafeed.ts`) is large and already
> works. To avoid re-architecting it, the `twelvedata` adapter is a lightweight registry
> entry whose `createDatafeed` is overridden to call the existing
> `createTwelveDataChartDatafeed()`. The factory supports this via an optional
> `makeDatafeed` escape hatch on the provider (see Task 1). All crypto-exchange providers use
> the generic factory path.

---

### Task 1: Shared types and SymbolInfo builder

**Files:**
- Create: `src/utils/datafeed/types.ts`

- [ ] **Step 1: Write `types.ts`**

```ts
import type {
	SymbolInfo,
	Resolution,
	PeriodParams,
	Datafeed,
} from "@gocharting/chart-sdk";

/** Raw OHLCV bar, provider-agnostic, ALWAYS oldest-first when returned from an adapter. */
export type RawBar = {
	time: number; // unix seconds
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
};

/** Normalized realtime trade tick produced by an adapter's parseTrade(). */
export type TradeTick = {
	symbol: string;
	price: number;
	size: number;
	side: "BUY" | "SELL";
	timestampMs: number;
};

/** Result of mapping a canonical base (e.g. "BTC") to a provider. */
export type ResolvedSymbol = {
	/** Chart full_name, e.g. "BYBIT:FUTURE:BTCUSDT" or "Coinbase Pro:SPOT:BTC/USD". */
	fullName: string;
	/** Provider-native symbol used in REST/WS calls, e.g. "BTCUSDT", "BTC-USD". */
	providerSymbol: string;
};

/**
 * A data provider adapter. Encodes ONLY the provider-specific bits; all shared
 * datafeed behavior lives in createDatafeed().
 */
export interface DatafeedProvider {
	id: string; // "binance" — the ?datafeed= value
	label: string; // "Binance" — switch UI text
	exchange: string; // "BINANCE" — SymbolInfo.exchange
	segment: string; // "SPOT" | "FUTURE"
	quoteCurrency: string; // "USDT" | "USD"

	/** Map a canonical base ("BTC","ETH","SOL","XRP") to chart + provider symbols. */
	resolveSymbol(base: string): ResolvedSymbol;

	// ---- history ----
	/** Convert SDK resolution to this provider's interval token. */
	mapInterval(resolution: string | Resolution): string;
	/** Build the REST klines URL. `from`/`to` in PeriodParams are unix seconds. */
	buildKlineUrl(
		providerSymbol: string,
		interval: string,
		params: PeriodParams
	): string;
	/** Parse the REST response into oldest-first RawBar[]. */
	parseKlines(json: unknown): RawBar[];

	// ---- realtime ----
	wsUrl: string;
	buildSubscribe(providerSymbol: string): unknown;
	buildUnsubscribe(providerSymbol: string): unknown;
	/** Parse a raw WS message into a TradeTick, or null to ignore it. */
	parseTrade(rawMsg: unknown): TradeTick | null;

	/**
	 * Optional escape hatch: if present, createDatafeed() returns this directly
	 * instead of using the generic factory (used by the legacy TwelveData feed).
	 */
	makeDatafeed?: () => Datafeed;
}

/** Default crypto SymbolInfo built from an adapter + provider symbol. */
export const buildCryptoSymbolInfo = (
	provider: DatafeedProvider,
	fullName: string,
	providerSymbol: string
): SymbolInfo => ({
	symbol: providerSymbol,
	full_name: fullName,
	description: `${providerSymbol} (${provider.label})`,
	exchange: provider.exchange,
	type: "crypto",
	session: "24x7",
	session_label: "24x7",
	timezone: "Etc/UTC",
	ticker: providerSymbol,
	has_intraday: true,
	has_daily: true,
	segment: provider.segment,
	quote_currency: provider.quoteCurrency,
	supported_resolutions: ["1", "5", "15", "30", "60", "240", "1D", "1W", "1M"],
	intraday_multipliers: ["1", "5", "15", "30", "60", "240"],
	volume_precision: 8,
	data_status: "streaming" as const,
	tick_size: 0.01,
	max_tick_precision: 2,
	exchange_info: {
		name: provider.exchange.toLowerCase(),
		code: provider.exchange,
		country_cd: "US",
		zone: "Etc/UTC",
		has_unique_trade_id: true,
		holidays: null,
		hours: [
			{ open: true },
			{ open: true },
			{ open: true },
			{ open: true },
			{ open: true },
			{ open: true },
			{ open: true },
		],
		contains_ambiguous_symbols: false,
		valid_intervals: [
			"1",
			"5",
			"15",
			"30",
			"60",
			"240",
			"1D",
			"1W",
			"1M",
		],
	},
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors introduced by this file — it is not yet imported anywhere).

- [ ] **Step 3: Commit**

```bash
git add src/utils/datafeed/types.ts
git commit -m "feat(datafeed): add provider adapter types + shared SymbolInfo builder"
```

---

### Task 2: Generic datafeed factory

**Files:**
- Create: `src/utils/datafeed/createDatafeed.ts`

This reproduces the shared behavior from `chart-datafeed.ts` (UDF conversion, GoCharting
symbol search, WS subscription machinery, demo fallback, marks), delegating provider-specific
calls to the adapter.

- [ ] **Step 1: Write `createDatafeed.ts`**

```ts
import {
	SymbolInfo,
	Resolution,
	SearchResult,
	SearchSymbolsResult,
	Datafeed,
	UDFResponse,
	BarsResult,
	PeriodParams,
	Mark,
	TimescaleMark,
	RealtimeCallback,
	TradeMessage,
} from "@gocharting/chart-sdk";
import {
	DatafeedProvider,
	RawBar,
	buildCryptoSymbolInfo,
} from "./types";

type IResponse<T = any> = { id: string; payload: T; status: number };

type StreamingHandler = {
	id: string;
	callback: RealtimeCallback;
	resolution: string | Resolution;
};

type SubscriptionItem = {
	subscriberUID: string;
	resolution: string | Resolution;
	handlers: StreamingHandler[];
	symbolInfo: SymbolInfo;
	channelString: string; // the provider symbol
};

type DemoSocket = {
	readyState: number;
	url: string;
	send: (message: string) => void;
	close: () => void;
	addEventListener: (event: string, cb: (event?: unknown) => void) => void;
};

/**
 * Create a GoCharting SDK datafeed backed by the given provider adapter.
 * If the provider supplies makeDatafeed(), that is returned directly (legacy escape hatch).
 */
export const createDatafeed = (provider: DatafeedProvider): Datafeed => {
	if (provider.makeDatafeed) {
		return provider.makeDatafeed();
	}

	const datafeed = {
		provider,
		symbolCache: new Map<string, SymbolInfo>(),
		searchSymbolController: null as AbortController | null,
		streamingIntervals: {} as Record<string, ReturnType<typeof setInterval>>,
		channelToSubscription: null as Map<string, SubscriptionItem> | null,
		socket: null as WebSocket | DemoSocket | null,

		destroy(): void {
			Object.values(this.streamingIntervals).forEach((i) =>
				clearInterval(i as ReturnType<typeof setInterval>)
			);
			this.streamingIntervals = {};
			if (this.searchSymbolController) this.searchSymbolController.abort();
			if (this.socket) {
				try {
					this.socket.close();
				} catch (e) {}
				this.socket = null;
			}
			this.channelToSubscription?.clear();
			this.symbolCache.clear();
		},

		onReady(callback: (config: unknown) => void): void {
			setTimeout(
				() =>
					callback({
						supported_resolutions: [
							"1",
							"5",
							"15",
							"30",
							"60",
							"240",
							"1D",
							"1W",
							"1M",
						],
						supports_marks: false,
						supports_timescale_marks: false,
						supports_time: true,
					}),
				0
			);
		},

		// ---------------- history ----------------
		async getBars(
			symbolInfo: SymbolInfo,
			resolution: string | Resolution,
			periodParams: PeriodParams
		): Promise<BarsResult | UDFResponse> {
			try {
				const interval = provider.mapInterval(resolution);
				const providerSymbol =
					symbolInfo.symbol || symbolInfo.ticker || "";
				const url = provider.buildKlineUrl(
					providerSymbol,
					interval,
					periodParams
				);
				const res = await fetch(url);
				const json = await res.json();
				const rawBars = provider.parseKlines(json);
				if (!rawBars || rawBars.length === 0) {
					return this.demoBars(resolution, periodParams);
				}
				return this.toUDF(rawBars);
			} catch (error) {
				console.error(
					`❌ [${provider.id}] getBars failed, using demo data:`,
					error
				);
				return this.demoBars(resolution, periodParams);
			}
		},

		toUDF(rawBars: RawBar[]): BarsResult | UDFResponse {
			if (!rawBars.length) return { s: "no_data" as const, nextTime: null };
			const t: number[] = [];
			const o: number[] = [];
			const h: number[] = [];
			const l: number[] = [];
			const c: number[] = [];
			const v: number[] = [];
			rawBars.forEach((b) => {
				t.push(b.time);
				o.push(Number(b.open));
				h.push(Number(b.high));
				l.push(Number(b.low));
				c.push(Number(b.close));
				v.push(Number(b.volume || 0));
			});
			return { s: "ok" as const, t, o, h, l, c, v };
		},

		demoBars(
			resolution: string | Resolution,
			periodParams: PeriodParams
		): BarsResult | UDFResponse {
			const { from, to } = periodParams;
			const fromDate =
				typeof from === "number" ? new Date(from * 1000) : (from as Date);
			const toDate =
				typeof to === "number" ? new Date(to * 1000) : (to as Date);
			let intervalMs: number;
			switch (String(resolution)) {
				case "1":
					intervalMs = 60_000;
					break;
				case "5":
					intervalMs = 5 * 60_000;
					break;
				case "15":
					intervalMs = 15 * 60_000;
					break;
				case "30":
					intervalMs = 30 * 60_000;
					break;
				case "60":
					intervalMs = 60 * 60_000;
					break;
				case "240":
					intervalMs = 4 * 60 * 60_000;
					break;
				default:
					intervalMs = 24 * 60 * 60_000;
			}
			const bars: RawBar[] = [];
			let cur = fromDate.getTime();
			const end = toDate.getTime();
			let price = 100 + Math.random() * 100;
			while (cur <= end && bars.length < 500) {
				const change = (Math.random() - 0.5) * 5;
				const open = price;
				const close = Math.max(0.01, price + change);
				const high = Math.max(open, close) + Math.random() * 2;
				const low = Math.min(open, close) - Math.random() * 2;
				bars.push({
					time: Math.floor(cur / 1000),
					open: Math.round(open * 100) / 100,
					high: Math.round(high * 100) / 100,
					low: Math.round(Math.max(0.01, low) * 100) / 100,
					close: Math.round(close * 100) / 100,
					volume: Math.floor(Math.random() * 1_000_000) + 100_000,
				});
				price = close;
				cur += intervalMs;
			}
			return this.toUDF(bars);
		},

		// ---------------- symbol resolve ----------------
		async resolveSymbol(
			symbolName: string,
			onResolve: (s: SymbolInfo) => void,
			onError: (e: string) => void
		): Promise<void> {
			try {
				const cached = this.symbolCache.get(symbolName);
				if (cached) return onResolve(cached);
				try {
					const fromApi = await this.resolveFromAPI(symbolName);
					this.symbolCache.set(symbolName, fromApi);
					return onResolve(fromApi);
				} catch (e) {}
				const local = this.resolveLocally(symbolName);
				this.symbolCache.set(symbolName, local);
				onResolve(local);
			} catch (error) {
				console.error(`❌ [${provider.id}] resolveSymbol failed:`, error);
				onError("Failed to resolve symbol");
			}
		},

		async resolveFromAPI(symbolName: string): Promise<SymbolInfo> {
			const url = new URL(
				"https://gocharting.com/sdk/instruments/exactSearch"
			);
			url.searchParams.append("q", symbolName);
			const res = await fetch(url);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json()) as IResponse<{
				results: Array<Record<string, any>>;
			}>;
			if (data.status === 200 && data.payload?.results?.length > 0) {
				const r = data.payload.results[0];
				return buildCryptoSymbolInfo(
					provider,
					`${r.exchange}:${r.segment}:${r.symbol}`,
					r.symbol
				);
			}
			throw new Error(`No symbol found for: ${symbolName}`);
		},

		resolveLocally(symbolName: string): SymbolInfo {
			// symbolName is a chart full_name; the provider symbol is the last segment.
			const parts = symbolName.split(":");
			const providerSymbol = parts[parts.length - 1];
			return buildCryptoSymbolInfo(provider, symbolName, providerSymbol);
		},

		// ---------------- search (GoCharting API, mock fallback) ----------------
		searchSymbols(
			userInput: string,
			exchangeOrCb: string | ((r: SearchSymbolsResult) => void),
			_symbolType?: string,
			onResultReady?: (r: SearchSymbolsResult) => void
		): void {
			const callback =
				typeof exchangeOrCb === "function" ? exchangeOrCb : onResultReady;
			if (!callback) return;
			(async () => {
				try {
					await this.searchFromAPI(userInput, callback);
				} catch (e) {
					callback({ searchInProgress: false, items: [] });
				}
			})();
		},

		async searchFromAPI(
			userInput: string,
			callback: (r: SearchSymbolsResult) => void
		): Promise<void> {
			const url = new URL("https://gocharting.com/sdk/instruments/search");
			url.searchParams.append("q", userInput);
			if (this.searchSymbolController) this.searchSymbolController.abort();
			this.searchSymbolController = new AbortController();
			const res = await fetch(url, {
				signal: this.searchSymbolController.signal,
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json()) as IResponse<{
				results: Array<{ item: any; matches: any }>;
			}>;
			const items: SearchResult[] = [];
			if (data.status === 200 && data.payload?.results) {
				data.payload.results.forEach((result) => {
					const item = result.item;
					const pushItem = (it: any) =>
						items.push({
							symbol: it.symbol,
							full_name: it.key,
							description: it.name,
							exchange: it.exchange,
							ticker: it.symbol,
							type: it.asset_type.toLowerCase() as SearchResult["type"],
						});
					if (item.is_group && item.members)
						item.members.forEach((m: any) => pushItem(m.item));
					else pushItem(item);
				});
			}
			callback({ searchInProgress: false, items });
		},

		// ---------------- realtime (ticks) ----------------
		subscribeBars(
			symbolInfo: SymbolInfo,
			resolution: string | Resolution,
			onRealtimeCallback: RealtimeCallback,
			subscriberUID: string
		): void {
			this.subscribeOnStream(
				symbolInfo,
				resolution,
				onRealtimeCallback,
				subscriberUID
			);
		},

		unsubscribeBars(subscriberUID: string): void {
			this.unsubscribeFromStream(subscriberUID);
		},

		subscribeTicks(
			symbolInfo: SymbolInfo,
			resolution: string | Resolution,
			onRealtimeCallback: RealtimeCallback,
			subscriberUID: string
		): void {
			this.subscribeOnStream(
				symbolInfo,
				resolution,
				onRealtimeCallback,
				subscriberUID
			);
		},

		unsubscribeTicks(subscriberUID: string): void {
			this.unsubscribeFromStream(subscriberUID);
		},

		subscribeOnStream(
			symbolInfo: SymbolInfo,
			resolution: string | Resolution,
			onRealtimeCallback: RealtimeCallback,
			subscriberUID: string
		): void {
			if (!this.channelToSubscription)
				this.channelToSubscription = new Map();
			const providerSymbol =
				symbolInfo.symbol || symbolInfo.ticker || "";
			const channelString = providerSymbol;
			this.initSocket();

			const handler: StreamingHandler = {
				id: subscriberUID,
				callback: onRealtimeCallback,
				resolution,
			};
			const existing = this.channelToSubscription.get(channelString);
			if (existing) {
				existing.handlers.push(handler);
				return;
			}
			const item: SubscriptionItem = {
				subscriberUID,
				resolution,
				handlers: [handler],
				symbolInfo,
				channelString,
			};
			this.channelToSubscription.set(channelString, item);
			this.sendWhenOpen(provider.buildSubscribe(providerSymbol));
		},

		unsubscribeFromStream(subscriberUID: string): void {
			if (!this.channelToSubscription) return;
			for (const channelString of this.channelToSubscription.keys()) {
				const item = this.channelToSubscription.get(channelString);
				if (!item) continue;
				const idx = item.handlers.findIndex(
					(h) => h.id === subscriberUID
				);
				if (idx !== -1) {
					item.handlers.splice(idx, 1);
					if (item.handlers.length === 0) {
						this.sendWhenOpen(
							provider.buildUnsubscribe(channelString)
						);
						this.channelToSubscription.delete(channelString);
					}
					break;
				}
			}
		},

		initSocket(): void {
			if (
				this.socket &&
				this.socket.readyState === WebSocket.OPEN
			)
				return;
			if (
				this.socket &&
				this.socket.readyState === WebSocket.CONNECTING
			)
				return;
			const ws = new WebSocket(provider.wsUrl);
			this.socket = ws;
			ws.addEventListener("message", (event: MessageEvent) =>
				this.handleMessage(event)
			);
			ws.addEventListener("error", () =>
				console.error(`❌ [${provider.id}] WebSocket error`)
			);
		},

		sendWhenOpen(payload: unknown): void {
			const msg = JSON.stringify(payload);
			const sock = this.socket;
			if (!sock) return;
			if (sock.readyState === WebSocket.OPEN) {
				sock.send(msg);
			} else if (sock instanceof WebSocket) {
				sock.addEventListener(
					"open",
					() => sock.send(msg),
					{ once: true }
				);
			}
		},

		handleMessage(event: MessageEvent): void {
			try {
				const raw = JSON.parse(event.data);
				const tick = provider.parseTrade(raw);
				if (!tick) return;
				const item = this.channelToSubscription?.get(tick.symbol);
				if (!item) return;
				const tradeMessage: TradeMessage = {
					type: "trade",
					productId: `${provider.exchange}:${provider.segment}:${tick.symbol}`,
					symbol: tick.symbol,
					exchange: provider.exchange,
					segment: provider.segment,
					timeStamp: new Date(tick.timestampMs),
					tradeID: Math.random().toString(36).substring(2, 11),
					price: tick.price,
					quantity: tick.size,
					amount: tick.price * tick.size,
					side: tick.side,
					pnlMultiplier: 2.22,
				};
				item.handlers.forEach((h) => {
					try {
						h.callback(tradeMessage);
					} catch (e) {
						console.error(
							`❌ [${provider.id}] handler ${h.id} error:`,
							e
						);
					}
				});
			} catch (e) {
				// non-JSON or unparseable frame — ignore
			}
		},

		// ---------------- marks (demo) ----------------
		getMarks(
			_symbolInfo: SymbolInfo,
			_startDate: number,
			_endDate: number,
			onDataCallback: (marks: Mark[]) => void
		): void {
			const now = Math.floor(Date.now() / 1000);
			onDataCallback([
				{
					id: 1,
					time: now - 86400 * 7,
					color: "red",
					text: ["Earnings Report", "Beat expectations"],
					label: "E",
					labelFontColor: "white",
					minSize: 25,
				},
				{
					id: 2,
					time: now - 86400 * 3,
					color: "green",
					text: ["Product Launch"],
					label: "P",
					labelFontColor: "white",
					minSize: 25,
				},
			]);
		},

		getTimescaleMarks(
			_symbolInfo: SymbolInfo,
			_startDate: number,
			_endDate: number,
			onDataCallback: (marks: TimescaleMark[]) => void
		): void {
			const now = Math.floor(Date.now() / 1000);
			onDataCallback([
				{
					id: "1",
					time: now - 86400 * 5,
					color: "red",
					label: "T1",
					tooltip: "Market Event",
				},
			]);
		},
	};

	return datafeed as unknown as Datafeed;
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS. If the SDK's `Datafeed` type rejects the `as unknown as Datafeed` cast, leave the cast (the existing `chart-datafeed.ts` casts similarly).

- [ ] **Step 3: Commit**

```bash
git add src/utils/datafeed/createDatafeed.ts
git commit -m "feat(datafeed): add generic datafeed factory"
```

---

### Task 3: Bybit adapter

**Files:**
- Create: `src/utils/datafeed/providers/bybit.ts`

- [ ] **Step 1: Write `bybit.ts`**

```ts
import type { Resolution, PeriodParams } from "@gocharting/chart-sdk";
import { DatafeedProvider, RawBar, TradeTick } from "../types";

const QUOTE = "USDT";

const INTERVAL: Record<string, string> = {
	"1": "1",
	"5": "5",
	"15": "15",
	"30": "30",
	"60": "60",
	"240": "240",
	"1D": "D",
	"1W": "W",
	"1M": "M",
};

export const bybit: DatafeedProvider = {
	id: "bybit",
	label: "Bybit",
	exchange: "BYBIT",
	segment: "FUTURE",
	quoteCurrency: QUOTE,

	resolveSymbol(base) {
		const providerSymbol = `${base}${QUOTE}`; // BTCUSDT
		return {
			providerSymbol,
			fullName: `BYBIT:FUTURE:${providerSymbol}`,
		};
	},

	mapInterval(resolution: string | Resolution) {
		return INTERVAL[String(resolution)] ?? "D";
	},

	buildKlineUrl(symbol, interval, params: PeriodParams) {
		const limit = params.rows || 200;
		if (params.firstDataRequest) {
			return `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&end=${Date.now()}&limit=${limit}`;
		}
		const start =
			typeof params.from === "number"
				? params.from * 1000
				: (params.from as Date).getTime();
		const end =
			typeof params.to === "number"
				? params.to * 1000
				: (params.to as Date).getTime();
		return `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&start=${start}&end=${end}&limit=${limit}`;
	},

	parseKlines(json: any): RawBar[] {
		const list = json?.result?.list;
		if (!Array.isArray(list)) return [];
		// Bybit returns newest-first → reverse to oldest-first.
		return list
			.map((row: string[]) => ({
				time: Math.floor(Number(row[0]) / 1000),
				open: Number(row[1]),
				high: Number(row[2]),
				low: Number(row[3]),
				close: Number(row[4]),
				volume: Number(row[5]),
			}))
			.reverse();
	},

	wsUrl: "wss://stream.bybit.com/v5/public/linear",
	buildSubscribe: (symbol) => ({
		op: "subscribe",
		args: [`publicTrade.${symbol}`],
	}),
	buildUnsubscribe: (symbol) => ({
		op: "unsubscribe",
		args: [`publicTrade.${symbol}`],
	}),

	parseTrade(raw: any): TradeTick | null {
		const topic: string | undefined = raw?.topic;
		if (!topic || !topic.startsWith("publicTrade")) return null;
		const first = raw?.data?.[0];
		if (!first) return null;
		return {
			symbol: first.s,
			price: Number(first.p),
			size: Number(first.v),
			side: String(first.S).toUpperCase() === "BUY" ? "BUY" : "SELL",
			timestampMs: Number(first.T),
		};
	},
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/utils/datafeed/providers/bybit.ts
git commit -m "feat(datafeed): add Bybit adapter"
```

---

### Task 4: Registry (partial) + Bybit re-export shim + legacy regression

**Files:**
- Create: `src/utils/datafeed/providers/index.ts`
- Modify: `src/utils/chart-datafeed.ts` (replace entire file with shim)

This task wires Bybit through the new factory and proves the 4 legacy importers still compile.

- [ ] **Step 1: Write `providers/index.ts` (Bybit only for now)**

```ts
import { DatafeedProvider } from "../types";
import { bybit } from "./bybit";

export const PROVIDERS: Record<string, DatafeedProvider> = {
	bybit,
};

export type ProviderId = string;

export const getProvider = (id: string | null | undefined): DatafeedProvider =>
	(id && PROVIDERS[id]) || PROVIDERS.bybit;

export const listProviders = (): Array<{ id: string; label: string }> =>
	Object.values(PROVIDERS).map((p) => ({ id: p.id, label: p.label }));
```

- [ ] **Step 2: Replace `src/utils/chart-datafeed.ts` with a shim**

Replace the ENTIRE contents of `src/utils/chart-datafeed.ts` with:

```ts
import type { Datafeed } from "@gocharting/chart-sdk";
import { createDatafeed } from "./datafeed/createDatafeed";
import { bybit } from "./datafeed/providers/bybit";

/**
 * Backwards-compatible Bybit datafeed factory.
 * Existing importers (MultiBasicChart, ChartDemo, ChartSDK, ChartSDKAdvanced,
 * ChartSDKAdvanced2) continue to call createChartDatafeed() unchanged.
 */
export const createChartDatafeed = (): Datafeed => createDatafeed(bybit);
```

- [ ] **Step 3: Type-check the whole project (legacy importers must still compile)**

Run: `npx tsc --noEmit`
Expected: PASS. The 4 legacy importers reference only `createChartDatafeed()`, which still exists.

- [ ] **Step 4: Commit**

```bash
git add src/utils/datafeed/providers/index.ts src/utils/chart-datafeed.ts
git commit -m "feat(datafeed): route Bybit through factory via re-export shim"
```

---

### Task 5: Binance adapter

**Files:**
- Create: `src/utils/datafeed/providers/binance.ts`

- [ ] **Step 1: Write `binance.ts`**

```ts
import type { Resolution, PeriodParams } from "@gocharting/chart-sdk";
import { DatafeedProvider, RawBar, TradeTick } from "../types";

const QUOTE = "USDT";

const INTERVAL: Record<string, string> = {
	"1": "1m",
	"5": "5m",
	"15": "15m",
	"30": "30m",
	"60": "1h",
	"240": "4h",
	"1D": "1d",
	"1W": "1w",
	"1M": "1M",
};

export const binance: DatafeedProvider = {
	id: "binance",
	label: "Binance",
	exchange: "BINANCE",
	segment: "SPOT",
	quoteCurrency: QUOTE,

	resolveSymbol(base) {
		const providerSymbol = `${base}${QUOTE}`; // BTCUSDT
		return {
			providerSymbol,
			fullName: `BINANCE:SPOT:${providerSymbol}`,
		};
	},

	mapInterval: (r: string | Resolution) => INTERVAL[String(r)] ?? "1d",

	buildKlineUrl(symbol, interval, params: PeriodParams) {
		const limit = Math.min(params.rows || 500, 1000);
		let url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
		if (!params.firstDataRequest) {
			const start =
				typeof params.from === "number"
					? params.from * 1000
					: (params.from as Date).getTime();
			const end =
				typeof params.to === "number"
					? params.to * 1000
					: (params.to as Date).getTime();
			url += `&startTime=${start}&endTime=${end}`;
		}
		return url;
	},

	parseKlines(json: any): RawBar[] {
		if (!Array.isArray(json)) return []; // error objects come back as {code,msg}
		// Binance returns oldest-first already.
		return json.map((row: any[]) => ({
			time: Math.floor(Number(row[0]) / 1000),
			open: Number(row[1]),
			high: Number(row[2]),
			low: Number(row[3]),
			close: Number(row[4]),
			volume: Number(row[5]),
		}));
	},

	wsUrl: "wss://stream.binance.com:9443/ws",
	buildSubscribe: (symbol) => ({
		method: "SUBSCRIBE",
		params: [`${symbol.toLowerCase()}@trade`],
		id: 1,
	}),
	buildUnsubscribe: (symbol) => ({
		method: "UNSUBSCRIBE",
		params: [`${symbol.toLowerCase()}@trade`],
		id: 1,
	}),

	parseTrade(raw: any): TradeTick | null {
		if (raw?.e !== "trade") return null; // skip subscribe-ack {result,id}
		return {
			symbol: raw.s, // upper-case, matches channel key
			price: Number(raw.p),
			size: Number(raw.q),
			// m = "is buyer the market maker"; true → seller-initiated → SELL
			side: raw.m ? "SELL" : "BUY",
			timestampMs: Number(raw.T),
		};
	},
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/utils/datafeed/providers/binance.ts
git commit -m "feat(datafeed): add Binance adapter"
```

---

### Task 6: OKX adapter

**Files:**
- Create: `src/utils/datafeed/providers/okx.ts`

- [ ] **Step 1: Write `okx.ts`**

```ts
import type { Resolution, PeriodParams } from "@gocharting/chart-sdk";
import { DatafeedProvider, RawBar, TradeTick } from "../types";

const QUOTE = "USDT";

const INTERVAL: Record<string, string> = {
	"1": "1m",
	"5": "5m",
	"15": "15m",
	"30": "30m",
	"60": "1H",
	"240": "4H",
	"1D": "1D",
	"1W": "1W",
	"1M": "1M",
};

export const okx: DatafeedProvider = {
	id: "okx",
	label: "OKX",
	exchange: "OKX",
	segment: "SPOT",
	quoteCurrency: QUOTE,

	resolveSymbol(base) {
		const providerSymbol = `${base}-${QUOTE}`; // BTC-USDT
		return {
			providerSymbol,
			fullName: `OKX:SPOT:${providerSymbol}`,
		};
	},

	mapInterval: (r: string | Resolution) => INTERVAL[String(r)] ?? "1D",

	buildKlineUrl(symbol, interval, params: PeriodParams) {
		const limit = Math.min(params.rows || 200, 300);
		// history-candles supports paging via `after` (ms, exclusive upper bound).
		if (params.firstDataRequest) {
			return `https://www.okx.com/api/v5/market/candles?instId=${symbol}&bar=${interval}&limit=${limit}`;
		}
		const end =
			typeof params.to === "number"
				? params.to * 1000
				: (params.to as Date).getTime();
		return `https://www.okx.com/api/v5/market/history-candles?instId=${symbol}&bar=${interval}&after=${end}&limit=${limit}`;
	},

	parseKlines(json: any): RawBar[] {
		const list = json?.data;
		if (!Array.isArray(list)) return [];
		// OKX returns newest-first → reverse to oldest-first.
		// row: [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]
		return list
			.map((row: string[]) => ({
				time: Math.floor(Number(row[0]) / 1000),
				open: Number(row[1]),
				high: Number(row[2]),
				low: Number(row[3]),
				close: Number(row[4]),
				volume: Number(row[5]),
			}))
			.reverse();
	},

	wsUrl: "wss://ws.okx.com:8443/ws/v5/public",
	buildSubscribe: (symbol) => ({
		op: "subscribe",
		args: [{ channel: "trades", instId: symbol }],
	}),
	buildUnsubscribe: (symbol) => ({
		op: "unsubscribe",
		args: [{ channel: "trades", instId: symbol }],
	}),

	parseTrade(raw: any): TradeTick | null {
		if (raw?.arg?.channel !== "trades") return null;
		const first = raw?.data?.[0];
		if (!first) return null;
		return {
			symbol: first.instId, // "BTC-USDT", matches channel key
			price: Number(first.px),
			size: Number(first.sz),
			side: String(first.side).toUpperCase() === "BUY" ? "BUY" : "SELL",
			timestampMs: Number(first.ts),
		};
	},
};
```

- [ ] **Step 2: Type-check** — `npx tsc --noEmit` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/utils/datafeed/providers/okx.ts
git commit -m "feat(datafeed): add OKX adapter"
```

---

### Task 7: Coinbase adapter

**Files:**
- Create: `src/utils/datafeed/providers/coinbase.ts`

- [ ] **Step 1: Write `coinbase.ts`**

```ts
import type { Resolution, PeriodParams } from "@gocharting/chart-sdk";
import { DatafeedProvider, RawBar, TradeTick } from "../types";

const QUOTE = "USD";

// Coinbase only supports a fixed granularity set (seconds).
const GRANULARITY: Record<string, number> = {
	"1": 60,
	"5": 300,
	"15": 900,
	"30": 1800, // not native; falls back below
	"60": 3600,
	"240": 21600, // 6h (nearest supported to 4h)
	"1D": 86400,
};
const SUPPORTED = new Set([60, 300, 900, 3600, 21600, 86400]);
const nearestGranularity = (g: number): number => {
	if (SUPPORTED.has(g)) return g;
	// pick the closest supported value
	return [...SUPPORTED].reduce((best, v) =>
		Math.abs(v - g) < Math.abs(best - g) ? v : best
	);
};

export const coinbase: DatafeedProvider = {
	id: "coinbase",
	label: "Coinbase",
	exchange: "COINBASE",
	segment: "SPOT",
	quoteCurrency: QUOTE,

	resolveSymbol(base) {
		const providerSymbol = `${base}-${QUOTE}`; // BTC-USD
		return {
			providerSymbol,
			fullName: `COINBASE:SPOT:${providerSymbol}`,
		};
	},

	mapInterval(r: string | Resolution) {
		const g = GRANULARITY[String(r)] ?? 86400;
		return String(nearestGranularity(g));
	},

	buildKlineUrl(symbol, interval, params: PeriodParams) {
		// `interval` is granularity in seconds. Coinbase caps at 300 candles/request.
		let url = `https://api.exchange.coinbase.com/products/${symbol}/candles?granularity=${interval}`;
		if (!params.firstDataRequest) {
			const start =
				typeof params.from === "number"
					? params.from
					: Math.floor((params.from as Date).getTime() / 1000);
			const end =
				typeof params.to === "number"
					? params.to
					: Math.floor((params.to as Date).getTime() / 1000);
			url += `&start=${new Date(start * 1000).toISOString()}&end=${new Date(
				end * 1000
			).toISOString()}`;
		}
		return url;
	},

	parseKlines(json: any): RawBar[] {
		if (!Array.isArray(json)) return [];
		// row: [time(s), low, high, open, close, volume]; newest-first → reverse.
		return json
			.map((row: number[]) => ({
				time: Number(row[0]),
				low: Number(row[1]),
				high: Number(row[2]),
				open: Number(row[3]),
				close: Number(row[4]),
				volume: Number(row[5]),
			}))
			.reverse();
	},

	wsUrl: "wss://ws-feed.exchange.coinbase.com",
	buildSubscribe: (symbol) => ({
		type: "subscribe",
		product_ids: [symbol],
		channels: ["matches"],
	}),
	buildUnsubscribe: (symbol) => ({
		type: "unsubscribe",
		product_ids: [symbol],
		channels: ["matches"],
	}),

	parseTrade(raw: any): TradeTick | null {
		if (raw?.type !== "match" && raw?.type !== "last_match") return null;
		return {
			symbol: raw.product_id, // "BTC-USD", matches channel key
			price: Number(raw.price),
			size: Number(raw.size),
			// Coinbase `side` is the maker side; taker is the opposite.
			side: String(raw.side).toUpperCase() === "BUY" ? "SELL" : "BUY",
			timestampMs: new Date(raw.time).getTime(),
		};
	},
};
```

- [ ] **Step 2: Type-check** — `npx tsc --noEmit` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/utils/datafeed/providers/coinbase.ts
git commit -m "feat(datafeed): add Coinbase adapter"
```

---

### Task 8: Kraken adapter

**Files:**
- Create: `src/utils/datafeed/providers/kraken.ts`

> Kraken names BTC as `XBT`. The WS `trade` channel echoes the *subscribed* pair name
> (e.g. `XBT/USD`) in the message, but our channel key is the REST/provider symbol
> (`XBTUSD`). The adapter normalizes both to the provider symbol so the factory's channel
> lookup matches.

- [ ] **Step 1: Write `kraken.ts`**

```ts
import type { Resolution, PeriodParams } from "@gocharting/chart-sdk";
import { DatafeedProvider, RawBar, TradeTick } from "../types";

// Kraken interval is in minutes.
const INTERVAL: Record<string, string> = {
	"1": "1",
	"5": "5",
	"15": "15",
	"30": "30",
	"60": "60",
	"240": "240",
	"1D": "1440",
	"1W": "10080",
	"1M": "21600",
};

const krakenBase = (base: string): string => (base === "BTC" ? "XBT" : base);

export const kraken: DatafeedProvider = {
	id: "kraken",
	label: "Kraken",
	exchange: "KRAKEN",
	segment: "SPOT",
	quoteCurrency: "USD",

	resolveSymbol(base) {
		const kb = krakenBase(base);
		return {
			providerSymbol: `${kb}USD`, // XBTUSD (REST + channel key)
			fullName: `KRAKEN:SPOT:${kb}USD`,
		};
	},

	mapInterval: (r: string | Resolution) => INTERVAL[String(r)] ?? "1440",

	buildKlineUrl(symbol, interval, params: PeriodParams) {
		let url = `https://api.kraken.com/0/public/OHLC?pair=${symbol}&interval=${interval}`;
		if (!params.firstDataRequest) {
			const since =
				typeof params.from === "number"
					? params.from
					: Math.floor((params.from as Date).getTime() / 1000);
			url += `&since=${since}`;
		}
		return url;
	},

	parseKlines(json: any): RawBar[] {
		const result = json?.result;
		if (!result) return [];
		const key = Object.keys(result).find((k) => k !== "last");
		const list = key ? result[key] : null;
		if (!Array.isArray(list)) return [];
		// oldest-first; row: [time(s), o, h, l, c, vwap, vol, count]
		return list.map((row: any[]) => ({
			time: Number(row[0]),
			open: Number(row[1]),
			high: Number(row[2]),
			low: Number(row[3]),
			close: Number(row[4]),
			volume: Number(row[6]),
		}));
	},

	wsUrl: "wss://ws.kraken.com",
	buildSubscribe: (symbol) => ({
		event: "subscribe",
		// WS wants slash form: XBTUSD -> XBT/USD
		pair: [`${symbol.slice(0, -3)}/${symbol.slice(-3)}`],
		subscription: { name: "trade" },
	}),
	buildUnsubscribe: (symbol) => ({
		event: "unsubscribe",
		pair: [`${symbol.slice(0, -3)}/${symbol.slice(-3)}`],
		subscription: { name: "trade" },
	}),

	parseTrade(raw: any): TradeTick | null {
		// Trade frames are arrays: [channelID, [[price,vol,time,side,...]], "trade", pair]
		if (!Array.isArray(raw)) return null;
		if (raw[2] !== "trade") return null;
		const trades = raw[1];
		const pair: string = raw[3]; // "XBT/USD"
		const first = trades?.[0];
		if (!first) return null;
		return {
			symbol: pair.replace("/", ""), // "XBTUSD" matches channel key
			price: Number(first[0]),
			size: Number(first[1]),
			side: first[3] === "b" ? "BUY" : "SELL",
			timestampMs: Math.floor(Number(first[2]) * 1000),
		};
	},
};
```

- [ ] **Step 2: Type-check** — `npx tsc --noEmit` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/utils/datafeed/providers/kraken.ts
git commit -m "feat(datafeed): add Kraken adapter"
```

---

### Task 9: TwelveData adapter (legacy escape hatch)

**Files:**
- Create: `src/utils/datafeed/providers/twelvedata.ts`

- [ ] **Step 1: Write `twelvedata.ts`**

```ts
import type { Resolution, PeriodParams } from "@gocharting/chart-sdk";
import { DatafeedProvider, RawBar, TradeTick } from "../types";
import { createTwelveDataChartDatafeed } from "@/utils/twelve-chart-datafeed";

/**
 * TwelveData reuses the existing, fully-working feed via the makeDatafeed escape hatch.
 * The history/realtime methods below are unused (makeDatafeed short-circuits the factory)
 * but are provided to satisfy the DatafeedProvider interface.
 */
export const twelvedata: DatafeedProvider = {
	id: "twelvedata",
	label: "Twelve Data",
	exchange: "Coinbase Pro",
	segment: "SPOT",
	quoteCurrency: "USD",

	resolveSymbol(base) {
		const providerSymbol = `${base}/USD`; // BTC/USD
		return {
			providerSymbol,
			fullName: `Coinbase Pro:SPOT:${providerSymbol}`,
		};
	},

	mapInterval: (_r: string | Resolution) => "1min",
	buildKlineUrl: (_s, _i, _p: PeriodParams) => "",
	parseKlines: (_json): RawBar[] => [],
	wsUrl: "",
	buildSubscribe: () => ({}),
	buildUnsubscribe: () => ({}),
	parseTrade: (_raw): TradeTick | null => null,

	makeDatafeed: () => createTwelveDataChartDatafeed(),
};
```

- [ ] **Step 2: Type-check** — `npx tsc --noEmit` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/utils/datafeed/providers/twelvedata.ts
git commit -m "feat(datafeed): add TwelveData adapter via legacy escape hatch"
```

---

### Task 10: Complete the registry

**Files:**
- Modify: `src/utils/datafeed/providers/index.ts`

- [ ] **Step 1: Replace `providers/index.ts` with the full registry**

```ts
import { DatafeedProvider } from "../types";
import { bybit } from "./bybit";
import { binance } from "./binance";
import { okx } from "./okx";
import { coinbase } from "./coinbase";
import { kraken } from "./kraken";
import { twelvedata } from "./twelvedata";

/**
 * Provider registry. To add a new provider: create its adapter file and add one line here —
 * it appears in the DataProviderSwitch automatically.
 */
export const PROVIDERS: Record<string, DatafeedProvider> = {
	bybit,
	binance,
	okx,
	coinbase,
	kraken,
	twelvedata,
};

export const getProvider = (id: string | null | undefined): DatafeedProvider =>
	(id && PROVIDERS[id]) || PROVIDERS.bybit;

export const listProviders = (): Array<{ id: string; label: string }> =>
	Object.values(PROVIDERS).map((p) => ({ id: p.id, label: p.label }));
```

- [ ] **Step 2: Type-check** — `npx tsc --noEmit` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/utils/datafeed/providers/index.ts
git commit -m "feat(datafeed): register all providers in the registry"
```

---

### Task 11: DataProviderSwitch component

**Files:**
- Create: `src/components/DataProviderSwitch/DataProviderSwitch.tsx`
- Create: `src/components/DataProviderSwitch/index.ts`

- [ ] **Step 1: Write `DataProviderSwitch.tsx`**

```tsx
import { useSearchParams } from "react-router-dom";
import { listProviders } from "@/utils/datafeed/providers";

/**
 * Page-level provider switch. Lives OUTSIDE the SDK chart. Reads/writes the
 * `?datafeed=` search param (default "bybit"); changing it remounts the chart.
 */
export const DataProviderSwitch = () => {
	const [searchParams, setSearchParams] = useSearchParams();
	const current = searchParams.get("datafeed") ?? "bybit";
	const providers = listProviders();

	const handleChange = (id: string) => {
		const next = new URLSearchParams(searchParams);
		next.set("datafeed", id);
		// Symbol formats differ per provider — drop any provider-specific symbol param.
		next.delete("symbol");
		setSearchParams(next);
	};

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 8,
				padding: "8px 12px",
				background: "#16181d",
				borderBottom: "1px solid #2a2e39",
				color: "#d1d4dc",
				fontSize: 13,
				fontFamily: "system-ui, sans-serif",
			}}
		>
			<label htmlFor="data-provider-select" style={{ fontWeight: 600 }}>
				Data Provider
			</label>
			<select
				id="data-provider-select"
				value={current}
				onChange={(e) => handleChange(e.target.value)}
				style={{
					background: "#1e222d",
					color: "#d1d4dc",
					border: "1px solid #2a2e39",
					borderRadius: 4,
					padding: "4px 8px",
					fontSize: 13,
					cursor: "pointer",
				}}
			>
				{providers.map((p) => (
					<option key={p.id} value={p.id}>
						{p.label}
					</option>
				))}
			</select>
		</div>
	);
};
```

- [ ] **Step 2: Write `index.ts`**

```ts
export { DataProviderSwitch } from "./DataProviderSwitch";
```

- [ ] **Step 3: Type-check** — `npx tsc --noEmit` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/DataProviderSwitch
git commit -m "feat: add page-level DataProviderSwitch component"
```

---

### Task 12: Wire the switch + registry into the page and chart

**Files:**
- Modify: `src/pages/Advanced2TradingPage.tsx`
- Modify: `src/components/ChartSDKAdvanced2/ChartSDKAdvanced2.tsx`

- [ ] **Step 1: Replace `Advanced2TradingPage.tsx`**

```tsx
import { useSearchParams } from "react-router-dom";
import ChartSDKAdvanced2 from "@/components/ChartSDKAdvanced2";
import { DataProviderSwitch } from "@/components/DataProviderSwitch";

const Advanced2TradingPage = () => {
	const [searchParams] = useSearchParams();
	const datafeed = searchParams.get("datafeed") ?? "bybit";

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
			<DataProviderSwitch />
			<div style={{ flex: 1, minHeight: 0 }}>
				{/* key remounts the chart (running its teardown) when the provider changes */}
				<ChartSDKAdvanced2 key={datafeed} />
			</div>
		</div>
	);
};

export default Advanced2TradingPage;
```

- [ ] **Step 2: Update imports in `ChartSDKAdvanced2.tsx`**

In `src/components/ChartSDKAdvanced2/ChartSDKAdvanced2.tsx`, replace the two datafeed imports (lines 4 and 21):

```ts
import { createChartDatafeed } from "@/utils/chart-datafeed";
```
and
```ts
import { createTwelveDataChartDatafeed } from "@/utils/twelve-chart-datafeed";
```

with:

```ts
import { createDatafeed } from "@/utils/datafeed/createDatafeed";
import { getProvider } from "@/utils/datafeed/providers";
```

- [ ] **Step 3: Replace the watchlist constants + symbol map (lines 80–94)**

Replace the `WATCHLIST_SYMBOLS` block and the `BYBIT_TO_TWELVEDATA_SYMBOL` map with a
canonical base watchlist:

```ts
// Canonical watchlist bases — each provider resolves these to its own symbol.
const WATCHLIST_BASES = ["BTC", "ETH", "SOL", "XRP"];
```

- [ ] **Step 4: Update the `datafeed` typing + default symbol (lines 98–111)**

Replace:

```ts
	const datafeed = (searchParams.get("datafeed") ?? "bybit") as
		| "bybit"
		| "twelvedata";
	const chartSymbol = searchParams.get("symbol");
	const chartContainerRef = useRef<HTMLDivElement>(null);
	const chartInstanceRef = useRef<ChartInstance | null>(null);
	const chartWrapperRef = useRef<ChartWrapper | null>(null);
	const datafeedRef = useRef<Datafeed | null>(null);
	const currentSymbol = useRef<string>(
		chartSymbol ??
			(datafeed === "bybit"
				? "BYBIT:FUTURE:BTCUSDT"
				: "Coinbase Pro:SPOT:BTC/USD")
	);
```

with:

```ts
	const datafeed = searchParams.get("datafeed") ?? "bybit";
	const provider = getProvider(datafeed);
	const chartSymbol = searchParams.get("symbol");
	const chartContainerRef = useRef<HTMLDivElement>(null);
	const chartInstanceRef = useRef<ChartInstance | null>(null);
	const chartWrapperRef = useRef<ChartWrapper | null>(null);
	const datafeedRef = useRef<Datafeed | null>(null);
	const defaultFullName = provider.resolveSymbol("BTC").fullName;
	const currentSymbol = useRef<string>(chartSymbol ?? defaultFullName);
```

- [ ] **Step 5: Update `selectedSymbol` initial state (lines 135–137)**

Replace:

```ts
	const [selectedSymbol, setSelectedSymbol] = useState<string>(
		"BYBIT:FUTURE:BTCUSDT"
	);
```

with (track the canonical base, default BTC):

```ts
	const [selectedSymbol, setSelectedSymbol] = useState<string>("BTC");
```

- [ ] **Step 6: Update `handleSymbolChange` (lines 671–688)**

Replace the function body so it takes a canonical base and resolves per provider:

```ts
	// Symbol switching — `base` is a canonical base like "BTC".
	const handleSymbolChange = (base: string) => {
		setSelectedSymbol(base);
		const fullName = provider.resolveSymbol(base).fullName;
		currentSymbol.current = fullName;
		if (chartInstanceRef.current) {
			try {
				chartInstanceRef.current.setSymbol(fullName);
			} catch (error) {
				console.error("Failed to change symbol:", error);
			}
		}
	};
```

- [ ] **Step 7: Update datafeed creation in `initChart` (lines 1369–1390)**

Replace:

```ts
			// Create datafeed
			const currentDatafeed =
				datafeed === "bybit"
					? createChartDatafeed()
					: createTwelveDataChartDatafeed();
			datafeedRef.current = currentDatafeed;

			console.log({
				chartSymbol,
				symbol:
					chartSymbol ??
					(datafeed === "bybit"
						? "BYBIT:FUTURE:BTCUSDT"
						: "Coinbase Pro:SPOT:BTC/USD"),
			});

			const chartConfig = {
				symbol:
					chartSymbol ??
					(datafeed === "bybit"
						? "BYBIT:FUTURE:BTCUSDT"
						: "Coinbase Pro:SPOT:BTC/USD"),
```

with:

```ts
			// Create datafeed from the active provider adapter
			const currentDatafeed = createDatafeed(provider);
			datafeedRef.current = currentDatafeed;

			const chartConfig = {
				symbol: chartSymbol ?? defaultFullName,
```

- [ ] **Step 8: Update the watchlist render (lines 1633–1650)**

Replace the `WATCHLIST_SYMBOLS.map(...)` block with a `WATCHLIST_BASES.map(...)` block that
resolves the price key per provider. The sidebar price still comes from Bybit tickers
(reference price), keyed by the canonical base's Bybit symbol:

```tsx
							{WATCHLIST_BASES.map((base) => {
								const priceKey = `${base}USDT`; // Bybit ticker key
								return (
									<button
										key={base}
										className={`symbol-btn ${selectedSymbol === base ? "active" : ""}`}
										onClick={() => handleSymbolChange(base)}
									>
										<span className='symbol-name'>{base}</span>
										<span className='symbol-price'>
											{symbolPrices[priceKey]
												? `$${symbolPrices[priceKey].toFixed(2)}`
												: "--"}
										</span>
									</button>
								);
							})}
```

- [ ] **Step 9: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: PASS. If `Datafeed`/`ChartInstance` imports are now unused, remove them from the
import list to satisfy `noUnusedLocals` if enabled. Re-run until clean.

- [ ] **Step 10: Commit**

```bash
git add src/pages/Advanced2TradingPage.tsx src/components/ChartSDKAdvanced2/ChartSDKAdvanced2.tsx
git commit -m "feat: wire provider registry + switch into Advanced2 page"
```

---

### Task 13: Browser verification

**Files:** none (manual verification).

- [ ] **Step 1: Start the dev server**

Run: `pnpm start` (CRA/craco; serves on http://localhost:3000 unless `PORT` set).
Expected: compiles with no TypeScript errors.

- [ ] **Step 2: Verify Bybit (regression, default)**

Open `http://localhost:3000/` (no param). Expected: switch shows "Bybit"; chart loads BTCUSDT
historical candles; live ticks update. Watchlist BTC/ETH/SOL/XRP show prices.

- [ ] **Step 3: Verify each new provider via the switch**

For each of Binance, OKX, Coinbase, Kraven via the dropdown (URL becomes
`?datafeed=binance` etc.):
- Chart remounts and loads historical candles for BTC.
- Live ticks stream (watch the last candle update).
- Switching the watchlist symbol (ETH/SOL/XRP) updates the chart.

Open DevTools → Network/WS to confirm REST klines return data and the WS connection receives
trade frames. If a provider's history is empty, check its `parseKlines` against the live
response shape (ordering / nesting).

- [ ] **Step 4: Verify TwelveData still works**

`?datafeed=twelvedata` → existing TwelveData behavior unchanged.

- [ ] **Step 5: Verify default fallback**

`?datafeed=bogus` → switch falls back to Bybit, chart loads.

- [ ] **Step 6: Commit any fixes found during verification**

```bash
git add -A
git commit -m "fix(datafeed): adjust adapters per live API verification"
```

---

## Self-Review Notes

- **Spec coverage:** adapter interface (Task 1), generic factory (Task 2), all 6 providers
  (Tasks 3,5–9), registry (Tasks 4,10), legacy re-export shim + regression (Task 4), switch
  outside SDK (Task 11), page key-remount + canonical watchlist + per-provider symbol
  resolution (Task 12), `?datafeed=` default `bybit` + unknown fallback (Tasks 11–12,
  verified Task 13). All spec sections mapped.
- **Type consistency:** `DatafeedProvider`, `RawBar`, `TradeTick`, `ResolvedSymbol`,
  `buildCryptoSymbolInfo`, `getProvider`, `listProviders`, `createDatafeed` names are used
  identically across tasks. `resolveSymbol(base)` returns `{ fullName, providerSymbol }`
  everywhere.
- **Known follow-ups (out of scope, acceptable for a demo):** Coinbase 4h→6h granularity
  approximation; sidebar prices remain Bybit-sourced regardless of active provider; OKX/
  Coinbase history paging uses a single window (sufficient for demo scroll-back depth).
