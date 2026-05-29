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
