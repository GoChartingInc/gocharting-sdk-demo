import {
	SymbolInfo,
	Bar,
	Tick,
	Resolution,
	SearchResult,
	SearchSymbolsResult,
	DataStatus,
	Datafeed,
	UDFResponse,
	BarsResult,
	PeriodParams,
	Mark,
	TimescaleMark,
} from "@gocharting/chart-sdk";

/**
 * Twelve Data WebSocket message structure
 */
type TwelveDataWebSocketMessage = {
	/** Event type: "price", "heartbeat", "subscribe-status" */
	event?: string;
	/** Subscription status */
	status?: string;
	/** Symbol ticker (e.g., "BTC/USD") */
	symbol?: string;
	/** Base currency name (e.g., "Bitcoin") */
	currency_base?: string;
	/** Quote currency name (e.g., "US Dollar") */
	currency_quote?: string;
	/** Exchange name (e.g., "Coinbase Pro") */
	exchange?: string;
	/** Instrument type (e.g., "Digital Currency") */
	type?: string;
	/** Unix timestamp in seconds */
	timestamp?: number;
	/** Current price */
	price?: number;
};

// ============================================================================
// Datafeed Internal Types
// ============================================================================

/**
 * Raw bar data structure (before UDF conversion)
 */
type RawBar = {
	time: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
	date?: string;
};

/**
 * Resolution conversion result
 */
type ResolutionInfo = {
	scale: number;
	units: string;
	label: string;
};

/**
 * Exchange info lookup structure
 */
type ExchangeInfoLookup = {
	timezone: string;
	session: string;
	country_cd?: string;
};

/**
 * Union type for all real-time data callbacks
 */
type RealtimeDataCallback = (data: Bar | TickData | TradeMessage | any) => void;

/**
 * Streaming subscription handler
 */
type StreamingHandler = {
	id: string;
	callback: RealtimeDataCallback;
	resolution: string | Resolution;
	lastDailyBar: Bar | null | undefined;
	onResetCacheNeededCallback?: (() => void) | null;
};

/**
 * Subscription item for channel management
 */
type SubscriptionItem = {
	subscriberUID: string;
	resolution: string | Resolution;
	lastDailyBar: Bar | null | undefined;
	handlers: StreamingHandler[];
	symbolInfo: SymbolInfo;
	channelString: string;
};

/**
 * Trade message for real-time updates
 */
type TradeMessage = {
	type: string;
	productId: string;
	symbol: string;
	exchange: string;
	segment: string;
	timeStamp: Date;
	tradeID: string;
	price: number;
	quantity: number;
	amount: number;
	side: string;
};

/**
 * Tick data for real-time streaming
 */
type TickData = {
	time: number;
	price: number;
	volume: number;
};

/**
 * Demo socket type (mock WebSocket= )
 */
type DemoSocket = {
	readyState: number;
	url: string;
	send: (message: string) => void;
	close: () => void;
	addEventListener: (
		event: string,
		callback: (event?: unknown) => void
	) => void;
};

/**
 * Subscription request structure
 */
type SubscriptionRequest = {
	op: string;
	args: string[];
	symbol?: string;
};

/**
 * Mock symbol data structure
 */
type MockSymbolData = {
	symbol: string;
	description: string;
	industry: string;
	logo_url: string;
};

/**
 * Datafeed configuration ready callback config
 */
type DatafeedConfig = {
	supported_resolutions: string[];
	supports_marks: boolean;
	supports_timescale_marks: boolean;
	supports_time: boolean;
};

/**
 * Mock search result structure (extended with key for compare functionality)
 */
type MockSearchResult = {
	symbol: string;
	full_name: string;
	description: string;
	exchange: string;
	ticker: string;
	type: string;
	key: string;
};

/**
 * Creates a demo datafeed for the GoCharting SDK
 * This datafeed supports both real Bybit data and generated demo data
 *
 * @returns Datafeed object compatible with GoCharting SDK with additional destroy() method
 *
 * @example
 * ```typescript
 * const datafeed = createChartDatafeed();
 *
 * const chart = createChart('#chart', {
 *   symbol: 'BYBIT:FUTURE:BTCUSDT',
 *   interval: '1D',
 *   datafeed: datafeed,
 *   licenseKey: 'your-key'
 * });
 *
 * // Cleanup when done
 * datafeed.destroy();
 * ```
 */
export const createTwelveDataChartDatafeed = (): Datafeed => {
	// const API_KEY = "c4d9f4bbeff145d299d9b2ac67795522";
	const API_KEY = "0c8d6ab2284847b58505e2159b6f2d0c";
	const datafeed = {
		symbolCache: new Map<string, SymbolInfo>(),
		searchSymbolController: null as AbortController | null,
		streamingIntervals: {} as Record<
			string,
			ReturnType<typeof setInterval>
		>,
		channelToSubscription: null as Map<string, SubscriptionItem> | null,
		demoSocket: null as WebSocket | DemoSocket | null,

		// Cleanup method to prevent memory leaks
		destroy(): void {
			// Clear all streaming intervals
			Object.values(this.streamingIntervals).forEach((interval) => {
				clearInterval(interval as ReturnType<typeof setInterval>);
			});
			this.streamingIntervals = {};
			// Abort any pending search requests
			if (this.searchSymbolController) {
				this.searchSymbolController.abort();
			}
			// Clear symbol cache
			this.symbolCache.clear();
		},

		async getBars(
			symbolInfo: SymbolInfo,
			resolution: string | Resolution,
			periodParams: PeriodParams
		): Promise<BarsResult | UDFResponse> {
			const { from, to } = periodParams;
			try {
				let rawBars: RawBar[] = [];

				// Try Twelve Data API first
				try {
					rawBars = await this.getTwelveDataBars(
						symbolInfo,
						resolution,
						periodParams
					);
					const udfData = this.convertToUDFFormat(rawBars);
					return udfData;
				} catch (twelveDataError) {
					console.log(
						"⚠️ [DemoDatafeed] Twelve Data API failed, using demo data"
					);
				}

				// Fallback to demo data
				const fromDate =
					typeof from === "number" ? new Date(from * 1000) : from;
				const toDate =
					typeof to === "number" ? new Date(to * 1000) : to;
				rawBars = this.generateDemoData(
					fromDate,
					toDate,
					resolution,
					symbolInfo
				);

				// Convert to UDF format
				const udfData = this.convertToUDFFormat(rawBars);
				return udfData;
			} catch (error) {
				console.error("❌ [DemoDatafeed] getBars failed:", error);
				// Fallback to demo data on error
				// Convert timestamps to Date objects if needed
				const fromDate =
					typeof from === "number" ? new Date(from * 1000) : from;
				const toDate =
					typeof to === "number" ? new Date(to * 1000) : to;
				const rawBars = this.generateDemoData(
					fromDate,
					toDate,
					resolution,
					symbolInfo
				);
				const udfData = this.convertToUDFFormat(rawBars);
				return udfData;
			}
		},

		// Convert raw bars to UDF format
		convertToUDFFormat(rawBars: RawBar[]): BarsResult | UDFResponse {
			if (!rawBars || rawBars.length === 0) {
				return {
					s: "no_data" as const,
					nextTime: null,
				};
			}
			const t: number[] = []; // time
			const o: number[] = []; // open
			const h: number[] = []; // high
			const l: number[] = []; // low
			const c: number[] = []; // close
			const v: number[] = []; // volume
			rawBars.forEach((bar: RawBar) => {
				// Handle different time formats
				let timestamp: number;
				if (bar.time) {
					timestamp =
						typeof bar.time === "number"
							? bar.time
							: Math.floor(new Date(bar.time).getTime() / 1000);
				} else if (bar.date) {
					timestamp = Math.floor(new Date(bar.date).getTime() / 1000);
				} else {
					console.warn("Bar missing time/date:", bar);
					return;
				}
				t.push(timestamp);
				o.push(Number(bar.open));
				h.push(Number(bar.high));
				l.push(Number(bar.low));
				c.push(Number(bar.close));
				v.push(Number(bar.volume || 0));
			});
			return {
				s: "ok" as const,
				t,
				o,
				h,
				l,
				c,
				v,
			};
		},

		async resolveSymbol(
			symbolName: string,
			onResolve: (symbolInfo: SymbolInfo) => void,
			onError: (error: string) => void
		): Promise<void> {
			try {
				// Check cache first
				if (this.symbolCache.has(symbolName)) {
					const cachedSymbolInfo = this.symbolCache.get(symbolName);
					if (cachedSymbolInfo) {
						onResolve(cachedSymbolInfo);
						return;
					}
				}

				// Try Twelve Data API first
				try {
					const symbolInfo =
						await this.resolveTwelveDataSymbol(symbolName);
					this.symbolCache.set(symbolName, symbolInfo);
					onResolve(symbolInfo);
					return;
				} catch (twelveDataError) {
					console.log(
						"⚠️ [DemoDatafeed] Twelve Data API failed, trying GoCharting API"
					);
				}
				// Fallback to local symbol resolution
				const symbolInfo = this.resolveSymbolLocally(symbolName);
				this.symbolCache.set(symbolName, symbolInfo);
				onResolve(symbolInfo);
			} catch (error) {
				console.error(
					"❌ [DemoDatafeed] Error resolving symbol:",
					error
				);
				onError("Failed to resolve symbol");
			}
		},

		async resolveTwelveDataSymbol(symbolName: string): Promise<SymbolInfo> {
			// Extract just the ticker from "EXCHANGE:SEGMENT:TICKER" or "EXCHANGE:TICKER" format
			const parts = symbolName.split(":");
			const ticker =
				parts.length >= 3
					? parts[2]
					: parts.length === 2
						? parts[1]
						: symbolName;

			const url = new URL("https://api.twelvedata.com/symbol_search");
			url.search = new URLSearchParams({
				apikey: API_KEY,
				symbol: ticker,
				outputsize: "200",
				show_plan: "false",
			}).toString();

			const res = await fetch(url);
			if (!res.ok) {
				throw new Error(`HTTP ${res.status}: ${res.statusText}`);
			}

			const data = (await res.json()) as {
				data: Array<{
					symbol: string;
					instrument_name: string;
					exchange: string;
					mic_code: string;
					exchange_timezone: string;
					instrument_type: string;
					country: string;
					currency: string;
				}>;
				status: string;
			};

			if (data.status === "ok" && data.data?.length > 0) {
				// Get the first result (most relevant)
				const result = data.data[0];

				// Map instrument_type to SDK type
				const typeMap: Record<string, string> = {
					"Common Stock": "stock",
					"Depositary Receipt": "dr",
					ETF: "etf",
					"Mutual Fund": "fund",
					Index: "index",
				};

				const symbolInfo: SymbolInfo = {
					symbol: result.symbol,
					full_name: `${result.exchange}:${result.symbol}`,
					description: result.instrument_name,
					exchange: result.exchange,
					type: typeMap[result.instrument_type] || "stock",
					session: "0930-1600", // Default US market hours
					session_label: "0930-1600",
					timezone: result.exchange_timezone,
					ticker: result.symbol,
					has_intraday: true,
					intraday_multipliers: [
						"1",
						"5",
						"15",
						"30",
						"60",
						"240",
						"1D",
					],
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
					volume_precision: 0,
					data_status: "streaming",
					tick_size: 0.01,
					max_tick_precision: 2,
					quote_currency: result.currency,
					segment: "SPOT",
					exchange_info: {
						name: result.exchange.toLowerCase(),
						code: result.mic_code,
						country_cd: result.country,
						zone: result.exchange_timezone,
						has_unique_trade_id: true,
						holidays: null,
						hours: [
							{ open: false }, // Sunday
							{ open: true }, // Monday
							{ open: true }, // Tuesday
							{ open: true }, // Wednesday
							{ open: true }, // Thursday
							{ open: true }, // Friday
							{ open: false }, // Saturday
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
				};

				return symbolInfo;
			}

			throw new Error(`No symbol found for: ${symbolName}`);
		},

		async searchTwelveDataSymbol(
			userInput: string,
			callback: ((result: SearchSymbolsResult) => void) | undefined
		): Promise<void> {
			const url = new URL("https://api.twelvedata.com/symbol_search");
			url.search = new URLSearchParams({
				apikey: API_KEY,
				symbol: userInput,
				outputsize: "200",
				show_plan: "false",
			}).toString();

			if (this.searchSymbolController) {
				this.searchSymbolController.abort();
			}

			this.searchSymbolController = new AbortController();

			const res = await fetch(url, {
				signal: this.searchSymbolController.signal,
			});

			if (!res.ok) {
				throw new Error(`HTTP ${res.status}: ${res.statusText}`);
			}

			const data = (await res.json()) as {
				data: Array<{
					symbol: string;
					instrument_name: string;
					exchange: string;
					mic_code: string;
					exchange_timezone: string;
					instrument_type: string;
					country: string;
					currency: string;
				}>;
				status: string;
			};

			if (data.status === "ok" && data.data?.length > 0) {
				// Map instrument_type to SDK type
				const typeMap: Record<string, string> = {
					"Common Stock": "stock",
					"Depositary Receipt": "dr",
					ETF: "etf",
					"Mutual Fund": "fund",
					Index: "index",
				};

				const transformedResults: SearchResult[] = data.data.map(
					(result) => ({
						symbol: result.symbol,
						full_name: `${result.exchange}:${result.symbol}`,
						description: result.instrument_name,
						exchange: result.exchange,
						ticker: result.symbol,
						type: (typeMap[result.instrument_type] ||
							"stock") as SearchResult["type"],
					})
				);

				if (callback) {
					callback({
						searchInProgress: false,
						items: transformedResults,
					});
				}
			} else {
				if (callback) {
					callback({
						searchInProgress: false,
						items: [],
					});
				}
			}
		},

		async getTwelveDataBars(
			symbolInfo: SymbolInfo,
			resolution: string | Resolution,
			periodParams: PeriodParams
		): Promise<RawBar[]> {
			const { from, to, firstDataRequest, rows } = periodParams;

			// Convert resolution to Twelve Data interval format
			let interval: string;
			if (typeof resolution === "string") {
				const resolutionObj =
					this.convertIntervalToResolution(resolution);
				interval = resolutionObj.label;
			} else if (resolution && typeof resolution === "object") {
				const scale = resolution.scale as unknown as number;
				const units = resolution.units as unknown as string;
				interval = this.deriveIntervalLabel(scale, units);
			} else {
				console.error("❌ Invalid resolution format:", resolution);
				throw new Error("Invalid resolution format");
			}

			// Map SDK interval format to Twelve Data format
			const intervalMap: Record<string, string> = {
				"1": "1min",
				"5": "5min",
				"15": "15min",
				"30": "30min",
				"60": "1h",
				"240": "4h",
				D: "1day",
				W: "1week",
				M: "1month",
			};
			const twelveDataInterval = intervalMap[interval] || "1day";

			const url = new URL("https://api.twelvedata.com/time_series");
			const symbol = symbolInfo.symbol || symbolInfo.ticker || "";
			const exchange = symbolInfo.exchange || "";

			if (firstDataRequest) {
				// Use current time to get recent data up to today
				const currentTime = Date.now();
				const params: Record<string, string> = {
					apikey: API_KEY,
					symbol: symbol,
					interval: twelveDataInterval,
					outputsize: rows?.toString() || "200",
					end_date: new Date(currentTime).toISOString(),
					format: "JSON",
				};
				if (exchange) params.exchange = exchange;
				url.search = new URLSearchParams(params).toString();
			} else {
				// Convert to milliseconds if needed (from is in seconds in SDK)
				const startDate =
					typeof from === "number"
						? from * 1000
						: (from as Date).getTime();
				const endDate =
					typeof to === "number" ? to * 1000 : (to as Date).getTime();

				const params: Record<string, string> = {
					apikey: API_KEY,
					symbol: symbol,
					interval: twelveDataInterval,
					start_date: new Date(startDate).toISOString(),
					end_date: new Date(endDate).toISOString(),
					outputsize: rows?.toString() || "200",
					format: "JSON",
				};
				if (exchange) params.exchange = exchange;
				url.search = new URLSearchParams(params).toString();
			}

			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(
					`HTTP ${response.status}: ${response.statusText}`
				);
			}

			const data = (await response.json()) as {
				meta?: {
					symbol: string;
					interval: string;
					currency_base?: string;
					currency_quote?: string;
					type?: string;
				};
				values?: Array<{
					datetime: string;
					open: string;
					high: string;
					low: string;
					close: string;
					volume?: string;
				}>;
				status: string;
			};

			if (data.status === "ok" && data.values && data.values.length > 0) {
				const bars: RawBar[] = [];

				// Twelve Data returns newest first, we need oldest first
				const reversedValues = data.values?.toReversed();

				for (const value of reversedValues) {
					const bar: RawBar = {
						time: Math.floor(
							new Date(value.datetime).getTime() / 1000
						), // Convert to seconds
						open: Number(value.open),
						high: Number(value.high),
						low: Number(value.low),
						close: Number(value.close),
						volume: value.volume ? Number(value.volume) : 0,
					};
					bars.push(bar);
				}

				return bars;
			}

			throw new Error("No data from Twelve Data API");
		},

		resolveSymbolLocally(symbolName: string): SymbolInfo {
			// 🔍 Test case: Handle invalid symbol to trigger error
			if (symbolName === "INVALID:SYMBOL") {
				throw new Error(
					`Symbol not found: ${symbolName}. This symbol does not exist in our database.`
				);
			}
			// Check if this is a mock symbol (AAPL or TSLA)
			if (symbolName === "NASDAQ:AAPL" || symbolName === "NASDAQ:TSLA") {
				return this.createMockSymbolInfo(symbolName);
			}
			// Handle different symbol formats for other symbols
			const parts = symbolName.split(":");
			let exchange, ticker, instrumentType;
			if (parts.length === 3) {
				// Format: BYBIT:FUTURE:BTCUSDT
				[exchange, instrumentType, ticker] = parts;
			} else {
				// Format: NASDAQ:AAPL
				[exchange, ticker] = parts;
				instrumentType = null;
			}
			// Get proper timezone and session based on exchange
			const exchangeInfo = this.getExchangeInfo(exchange);
			// Note: Some fields (minmov, pricescale, etc.) are used by TradingView charting library
			// but not in the SDK's SymbolInfo type, so we cast to SymbolInfo
			return {
				symbol: ticker,
				full_name: symbolName,
				description: this.getSymbolDescription(ticker, instrumentType),
				type: this.getSymbolType(exchange),
				session: exchangeInfo.session,
				session_label: exchangeInfo.session,
				timezone: exchangeInfo.timezone,
				ticker: ticker,
				exchange: exchange,
				segment: instrumentType || "SPOT",
				has_intraday: true,
				has_daily: true,
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
				volume_precision: this.getVolumePrecision(exchange),
				data_status: "streaming" as const,
				tick_size: 1 / this.getPriceScale(exchange, ticker),
				max_tick_precision: Math.log10(
					this.getPriceScale(exchange, ticker)
				),
				quote_currency: this.getCurrencyCode(exchange, ticker),
				exchange_info: {
					name: exchange.toLowerCase(),
					code: exchange,
					country_cd: exchangeInfo.country_cd || "US",
					zone: exchangeInfo.timezone,
					has_unique_trade_id: true,
					holidays: null,
					hours:
						exchangeInfo.session === "24x7"
							? [
									{ open: true },
									{ open: true },
									{ open: true },
									{ open: true },
									{ open: true },
									{ open: true },
									{ open: true },
								]
							: [
									{ open: false },
									{ open: true },
									{ open: true },
									{ open: true },
									{ open: true },
									{ open: true },
									{ open: false },
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
			};
		},

		getExchangeInfo(exchange: string): ExchangeInfoLookup {
			const exchangeData: Record<string, ExchangeInfoLookup> = {
				NASDAQ: {
					timezone: "America/New_York",
					session: "0930-1600",
					country_cd: "US",
				},
				NYSE: {
					timezone: "America/New_York",
					session: "0930-1600",
					country_cd: "US",
				},
				BYBIT: {
					timezone: "Etc/UTC",
					session: "24x7",
				},
				BINANCE: {
					timezone: "Etc/UTC",
					session: "24x7",
				},
				FOREX: {
					timezone: "Etc/UTC",
					session: "24x5",
				},
			};
			return (
				exchangeData[exchange] || {
					timezone: "Etc/UTC",
					session: "24x7",
				}
			);
		},

		getSymbolDescription(
			ticker: string,
			instrumentType: string | null
		): string {
			const descriptions: Record<string, string> = {
				AAPL: "Apple Inc.",
				MSFT: "Microsoft Corporation",
				GOOGL: "Alphabet Inc.",
				TSLA: "Tesla Inc.",
				BTCUSDT: "Bitcoin / Tether",
				ETHUSDT: "Ethereum / Tether",
			};
			const baseDescription = descriptions[ticker] || ticker;
			if (instrumentType === "FUTURE") {
				return `${baseDescription} Future`;
			}
			return baseDescription;
		},

		getSymbolType(exchange: string): string {
			const types: Record<string, string> = {
				NASDAQ: "stock",
				NYSE: "stock",
				BYBIT: "crypto",
				BINANCE: "crypto",
				FOREX: "forex",
			};
			return types[exchange] || "crypto";
		},

		getPriceScale(exchange: string, ticker: string): number {
			// Crypto typically has more decimal places
			if (exchange === "BYBIT" || exchange === "BINANCE") {
				if (ticker.includes("USDT") || ticker.includes("USD")) {
					return 100; // 2 decimal places for USDT pairs
				}
				return 100000000; // 8 decimal places for BTC pairs
			}
			return 100; // 2 decimal places for stocks
		},

		getVolumePrecision(exchange: string): number {
			if (exchange === "BYBIT" || exchange === "BINANCE") {
				return 8; // Crypto volume precision
			}
			return 0; // Stock volume precision
		},

		getCurrencyCode(exchange: string, ticker: string): string {
			if (exchange === "BYBIT" || exchange === "BINANCE") {
				if (ticker.includes("USDT")) return "USDT";
				if (ticker.includes("USD")) return "USD";
				if (ticker.includes("BTC")) return "BTC";
			}
			return "USD";
		},

		convertIntervalToResolution(intervalString: string): ResolutionInfo {
			const intervalMap: Record<string, ResolutionInfo> = {
				// SDK resolution strings (e.g. from supported_resolutions)
				"1": { scale: 1, units: "minutes", label: "1" },
				"5": { scale: 5, units: "minutes", label: "5" },
				"15": { scale: 15, units: "minutes", label: "15" },
				"30": { scale: 30, units: "minutes", label: "30" },
				"60": { scale: 1, units: "hours", label: "60" },
				"240": { scale: 4, units: "hours", label: "240" },
				"1D": { scale: 1, units: "days", label: "D" },
				"1W": { scale: 1, units: "weeks", label: "W" },
				"1M": { scale: 1, units: "months", label: "M" },
				// Alternate "Xm"/"Xh" style keys as fallback
				"1m": { scale: 1, units: "minutes", label: "1" },
				"5m": { scale: 5, units: "minutes", label: "5" },
				"15m": { scale: 15, units: "minutes", label: "15" },
				"30m": { scale: 30, units: "minutes", label: "30" },
				"1h": { scale: 1, units: "hours", label: "60" },
				"4h": { scale: 4, units: "hours", label: "240" },
			};

			// console.log({ intervalString, intervalMap });

			const resolutionResult = intervalMap[intervalString];
			if (!resolutionResult) {
				console.warn(
					`Unknown interval: ${intervalString}, defaulting to 1D`
				);
				return {
					scale: 1,
					units: "days",
					label: "D",
				};
			}
			return resolutionResult;
		},

		deriveIntervalLabel(scale: number, units: string): string {
			switch (units) {
				case "minutes":
					return scale.toString();
				case "hours":
					return (scale * 60).toString();
				case "days":
					return scale === 1 ? "D" : `${scale}D`;
				case "weeks":
					return scale === 1 ? "W" : `${scale * 7}W`;
				case "months":
					return scale === 1 ? "M" : `${scale * 30}M`;
				default:
					console.warn(`Unknown units: ${units}, defaulting to D`);
					return "D";
			}
		},

		generateDemoData(
			from: Date,
			to: Date,
			resolution: string | Resolution,
			symbolInfo: SymbolInfo
		): RawBar[] {
			const bars: RawBar[] = [];

			// Calculate interval in milliseconds - matching HTML version exactly
			let intervalMs: number;
			const resolutionStr =
				typeof resolution === "string"
					? resolution
					: String(resolution);
			switch (resolutionStr) {
				case "1":
					intervalMs = 60 * 1000; // 1 minute
					break;
				case "5":
					intervalMs = 5 * 60 * 1000; // 5 minutes
					break;
				case "15":
					intervalMs = 15 * 60 * 1000; // 15 minutes
					break;
				case "30":
					intervalMs = 30 * 60 * 1000; // 30 minutes
					break;
				case "60":
					intervalMs = 60 * 60 * 1000; // 1 hour
					break;
				case "240":
					intervalMs = 4 * 60 * 60 * 1000; // 4 hours
					break;
				case "1D":
					intervalMs = 24 * 60 * 60 * 1000; // 1 day
					break;
				default:
					intervalMs = 24 * 60 * 60 * 1000; // Default to 1 day
			}

			let currentTime = from.getTime(); // Already in milliseconds
			const endTime = to.getTime(); // Already in milliseconds

			// Use realistic price ranges based on symbol
			const symbol =
				symbolInfo?.symbol ||
				symbolInfo?.ticker ||
				(symbolInfo as unknown as { name?: string })?.name ||
				"UNKNOWN";
			// console.log(
			// 	"🎯 [DemoDatafeed] Generating demo data for symbol:",
			// 	symbol
			// );

			// Generic price range for demo data
			let price = 100 + Math.random() * 100;

			while (currentTime <= endTime && bars.length < 500) {
				const change = (Math.random() - 0.5) * 5;
				const open = price;
				const close = Math.max(0.01, price + change);
				const high = Math.max(open, close) + Math.random() * 2;
				const low = Math.min(open, close) - Math.random() * 2;

				bars.push({
					time: Math.floor(currentTime / 1000), // Convert back to seconds for timestamp
					open: Math.round(open * 100) / 100,
					high: Math.round(high * 100) / 100,
					low: Math.round(Math.max(0.01, low) * 100) / 100,
					close: Math.round(close * 100) / 100,
					volume: Math.floor(Math.random() * 1000000) + 100000,
				});

				price = close;
				currentTime += intervalMs;
			}
			return bars;
		},

		// Create mock symbol info for AAPL and TSLA using GoCharting SDK SymbolInfo format
		createMockSymbolInfo(symbolName: string): SymbolInfo {
			const symbolData: Record<string, MockSymbolData> = {
				"NASDAQ:AAPL": {
					symbol: "AAPL",
					description: "Apple Inc. - Common Stock",
					industry: "technology",
					logo_url:
						"https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg",
				},
				"NASDAQ:TSLA": {
					symbol: "TSLA",
					description: "Tesla Inc. - Common Stock",
					industry: "automotive",
					logo_url:
						"https://upload.wikimedia.org/wikipedia/commons/b/bb/Tesla_T_symbol.svg",
				},
			};

			const data = symbolData[symbolName];
			if (!data) {
				throw new Error(
					`Mock symbol data not found for: ${symbolName}`
				);
			}

			// Return mock symbol info using GoCharting SDK SymbolInfo typ= e
			// Note: Fields like minmov, pricescale, name, listed_exchange are NOT in SDK typ= e
			// Use max_tick_precision + tick_size instead of minmov/pricescale
			// Use description instead of name
			// Use quote_currency instead of currency_code
			return {
				// Required fields
				symbol: data.symbol,
				full_name: symbolName,
				description: data.description,
				exchange: "NASDAQ",
				type: "stock",
				session: "0930-1600",
				timezone: "America/New_York",
				ticker: data.symbol,
				has_intraday: true,
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

				// Optional fields used by SDK
				segment: "SPOT",
				asset_type: "EQUITY",
				session_label: "0930-1600",
				tradeable: true,
				is_index: false,
				is_formula: false,
				delay_seconds: 0,
				data_status: "streaming" as const,
				industry: data.industry,
				symbol_logo_urls: [data.logo_url],

				// Price & Volume Precision (SDK uses these, NOT minmov/pricescale)
				contract_size: 1,
				tick_size: 0.01, // $0.01 minimum price movement
				display_tick_size: 0.01,
				volume_size_increment: 1,
				max_tick_precision: 2, // 2 decimal places
				max_volume_precision: 0,
				quote_currency: "USD", // NOT currency_code

				// Additional optional fields
				has_daily: true,
				volume_precision: 0,
				source_id: data.symbol,
				intraday_multipliers: ["1", "5", "15", "30", "60", "240"],

				// Exchange information
				exchange_info: {
					name: "nasdaq",
					code: "NASDAQ",
					country_cd: "US",
					zone: "America/New_York",
					has_unique_trade_id: true,
					logo_url:
						"https://upload.wikimedia.org/wikipedia/commons/4/48/Nasdaq_Logo.svg",
					holidays: null,
					hours: [
						{ open: false }, // Sunday
						{ open: true }, // Monday
						{ open: true }, // Tuesday
						{ open: true }, // Wednesday
						{ open: true }, // Thursday
						{ open: true }, // Friday
						{ open: false }, // Saturday
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
			};
		},

		onReady(callback: (config: DatafeedConfig) => void): void {
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

		searchSymbols(
			userInput: string,
			exchangeOrCallback:
				| string
				| ((result: SearchSymbolsResult) => void),
			symbolType?: string,
			onResultReadyCallback?: (result: SearchSymbolsResult) => void
		): void {
			// Handle different calling patterns - sometimes callback is 2nd param, sometimes 4th
			const callback:
				| ((result: SearchSymbolsResult) => void)
				| undefined =
				typeof exchangeOrCallback === "function"
					? exchangeOrCallback
					: onResultReadyCallback;

			if (!callback) {
				console.error(
					"🔍 [DemoDatafeed] No callback provided to searchSymbols"
				);
				return;
			}

			// Use async IIFE to handle the fetch, but don't make the function itself async
			(async () => {
				try {
					await this.searchTwelveDataSymbol(userInput, callback);
				} catch (error) {
					// Fallback to mock data
					this.searchSymbolsMock(userInput, callback);
				}
			})();
		},

		searchSymbolsMock(
			userInput: string,
			callback: (result: SearchSymbolsResult) => void
		): void {
			// Mock API response with symbols from your dropdown
			const symbols: MockSearchResult[] = [
				{
					symbol: "BTCUSDT",
					full_name: "BYBIT:FUTURE:BTCUSDT",
					description: "Bitcoin Future (BTCUSDT)",
					exchange: "BYBIT",
					ticker: "BTCUSDT",
					type: "crypto",
					key: "BYBIT:FUTURE:BTCUSDT", // Added key property for compare functionality
				},
				{
					symbol: "ETHUSDT",
					full_name: "BYBIT:FUTURE:ETHUSDT",
					description: "Ethereum Future (ETHUSDT)",
					exchange: "BYBIT",
					ticker: "ETHUSDT",
					type: "crypto",
					key: "BYBIT:FUTURE:ETHUSDT", // Added key property for compare functionality
				},
				{
					symbol: "AAPL",
					full_name: "NASDAQ:AAPL",
					description: "Apple (AAPL)",
					exchange: "NASDAQ",
					ticker: "AAPL",
					type: "stock",
					key: "NASDAQ:AAPL", // Added key property for compare functionality
				},
				{
					symbol: "TSLA",
					full_name: "NASDAQ:TSLA",
					description: "Tesla (TSLA)",
					exchange: "NASDAQ",
					ticker: "TSLA",
					type: "stock",
					key: "NASDAQ:TSLA", // Added key property for compare functionality
				},
				{
					symbol: "BTC",
					full_name: "BINANCE:BTC",
					description: "Bitcoin Spot (BTC)",
					exchange: "BINANCE",
					ticker: "BTC",
					type: "crypto",
					key: "BINANCE:BTC", // Added key property for compare functionality
				},
				{
					symbol: "INVALID_TEST",
					full_name: "TEST:INVALID_TEST",
					description: "Invalid Symbol (Test Error)",
					exchange: "TEST",
					ticker: "INVALID_TEST",
					type: "test",
					key: "TEST:INVALID_TEST", // Added key property for compare functionality
				},
			];

			// Filter symbols based on user input
			const filteredSymbols = symbols.filter(
				(s) =>
					s.symbol.toLowerCase().includes(userInput.toLowerCase()) ||
					s.description
						.toLowerCase()
						.includes(userInput.toLowerCase())
			);

			// Return filtered results in correct SDK format
			if (typeof callback === "function") {
				// The SDK expects SearchSymbolsResult with items array
				callback({
					searchInProgress: false,
					items: filteredSymbols as unknown as SearchResult[],
				});
			} else {
				console.error(
					"🔍 [DemoDatafeed] No valid callback provided to searchSymbols"
				);
			}
		},

		subscribeBars(
			symbolInfo: SymbolInfo,
			resolution: string | Resolution,
			onRealtimeCallback: RealtimeDataCallback,
			subscriberUID: string,
			_onResetCacheNeededCallback?: () => void
		): void {
			// For demo purposes, we'll simulate real-time updates
			// In production, this would connect to real WebSocket streams
			this.startDemoStreaming(
				symbolInfo,
				resolution,
				onRealtimeCallback,
				subscriberUID
			);
		},

		unsubscribeBars(subscriberUID: string): void {
			// Stop the demo streaming for this subscriber
			if (
				this.streamingIntervals &&
				this.streamingIntervals[subscriberUID]
			) {
				clearInterval(this.streamingIntervals[subscriberUID]);
				delete this.streamingIntervals[subscriberUID];
			}
		},

		// Optional datafeed type methods for real-time data
		subscribeTicks(
			symbolInfo: SymbolInfo,
			resolution: string | Resolution,
			onRealtimeCallback: RealtimeDataCallback,
			subscriberUID: string,
			onResetCacheNeededCallback?: () => void
		): void {
			// Use the same pattern as the real datafeed.js
			// The SDK now correctly types onRealtimeCallback to accept Bar | Tick | any
			this.subscribeOnStream(
				symbolInfo,
				resolution,
				onRealtimeCallback,
				subscriberUID,
				onResetCacheNeededCallback,
				null // lastDailyBar - not used in demo
			);
		},

		unsubscribeTicks(subscriberUID: string): void {
			// Use the same pattern as the real datafeed.js
			this.unsubscribeFromStream(subscriberUID);
		},

		// Start demo streaming for non-real-time symbols
		startDemoStreaming(
			_symbolInfo: SymbolInfo,
			_resolution: string | Resolution,
			onRealtimeCallback: RealtimeDataCallback,
			subscriberUID: string
		): void {
			// Initialize streaming intervals map if not exists
			if (!this.streamingIntervals) {
				this.streamingIntervals = {};
			}

			// Clear any existing interval for this subscriber
			if (this.streamingIntervals[subscriberUID]) {
				clearInterval(this.streamingIntervals[subscriberUID]);
			}

			// For demo purposes, simulate price updates every 2 seconds
			let lastPrice = 50000 + Math.random() * 10000; // Start with a random price around 50k-60k

			this.streamingIntervals[subscriberUID] = setInterval(() => {
				// Simulate realistic price movement
				const change = (Math.random() - 0.5) * 100; // +/- $50 change
				lastPrice = Math.max(1000, lastPrice + change); // Ensure price doesn't go below $1000

				const now = Date.now();
				const price = Math.round(lastPrice * 100) / 100; // Round to 2 decimal places

				// Create a proper Tick object (extends Bar)
				const tick: Tick = {
					time: Math.floor(now / 1000), // Unix timestamp in seconds (SDK expects seconds)
					open: price,
					high: price,
					low: price,
					close: price,
					volume: Math.floor(Math.random() * 1000) + 100, // Random volume
				};

				onRealtimeCallback(tick);
			}, 2000); // Update every 2 seconds
		},

		// Enhanced streaming implementation using Twelve Data WebSocket
		subscribeOnStream(
			symbolInfo: SymbolInfo,
			resolution: string | Resolution,
			onRealtimeCallback: RealtimeDataCallback,
			subscriberUID: string,
			onResetCacheNeededCallback?: (() => void) | null,
			lastDailyBar?: Bar | null
		): void {
			// Initialize streaming infrastructure
			if (!this.channelToSubscription) {
				this.channelToSubscription = new Map();
			}

			if (!this.demoSocket) {
				this.initializeTwelveDataSocket();
			}

			// Create channel string for Twelve Data
			const symbol: string = symbolInfo.symbol || symbolInfo.ticker || "";
			const channelString = `price:${symbol}`;

			const handler = {
				id: subscriberUID,
				callback: onRealtimeCallback,
				resolution: resolution,
				lastDailyBar: lastDailyBar,
				onResetCacheNeededCallback: onResetCacheNeededCallback,
			};

			let subscriptionItem =
				this.channelToSubscription.get(channelString);

			if (subscriptionItem) {
				// Already subscribed to the channel, use the existing subscription
				subscriptionItem.handlers.push(handler);
				return;
			}

			// console.log({ symbolInfo });

			// Create new subscription item
			subscriptionItem = {
				subscriberUID,
				resolution,
				lastDailyBar,
				handlers: [handler],
				symbolInfo: symbolInfo,
				channelString: channelString,
			};

			this.channelToSubscription.set(channelString, subscriptionItem);

			// Always start demo streaming immediately as a guaranteed fallback.
			// This mirrors chart-datafeed.ts: !isRealBybit → startChannelStreaming immediately.
			// The WebSocket may be CONNECTING or may fail entirely, so we cannot defer
			// this into socket open event listeners (which may never fire).
			// this.startChannelStreaming(subscriptionItem);

			// Send Twelve Data WebSocket subscription request
			// API expects symbols as a comma-separated string, not an array of objects
			const subRequest = {
				action: "subscribe",
				params: {
					symbols: [
						{
							symbol: symbol,
							exchange: symbolInfo.exchange,
						},
					],
				},
			};

			this.sendTwelveDataSubscription(subRequest, subscriptionItem);
		},

		unsubscribeFromStream(subscriberUID: string) {
			if (!this.channelToSubscription) {
				return;
			}

			// Find a subscription with id === subscriberUID (mirroring streaming.js logic)
			for (const channelString of this.channelToSubscription.keys()) {
				const subscriptionItem =
					this.channelToSubscription.get(channelString);
				if (!subscriptionItem) continue;

				const handlerIndex = subscriptionItem.handlers.findIndex(
					(handler: StreamingHandler) => handler.id === subscriberUID
				);

				if (handlerIndex !== -1) {
					// Remove from handlers
					subscriptionItem.handlers.splice(handlerIndex, 1);

					if (subscriptionItem.handlers.length === 0) {
						// Unsubscribe from the channel if it was the last handler
						const unsubRequest = {
							op: "unsubscribe",
							args: [channelString],
						};

						this.sendDemoUnsubscription(
							unsubRequest,
							channelString
						);
						this.channelToSubscription.delete(channelString);

						// Stop streaming intervals for this channel
						if (
							this.streamingIntervals &&
							this.streamingIntervals[channelString]
						) {
							clearInterval(
								this.streamingIntervals[channelString]
							);
							delete this.streamingIntervals[channelString];
						}
					}
					break;
				}
			}
		},

		// Initialize Twelve Data WebSocket
		initializeTwelveDataSocket() {
			if (
				this.demoSocket &&
				this.demoSocket.readyState === WebSocket.OPEN
			) {
				return this.demoSocket;
			}

			// Create Twelve Data WebSocket connection
			const uri = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${API_KEY}`;
			const ws = new WebSocket(uri);
			this.demoSocket = ws;

			ws.addEventListener("open", () => {
				console.log("✅ [TwelveData] WebSocket connected");

				// Start heartbeat to keep connection alive
				const heartbeatInterval = setInterval(() => {
					if (ws.readyState === WebSocket.OPEN) {
						ws.send(JSON.stringify({ action: "heartbeat" }));
					} else {
						clearInterval(heartbeatInterval);
					}
				}, 10 * 1000); // Send heartbeat every 10 seconds
			});

			ws.addEventListener("close", () => {
				console.log("🔌 [TwelveData] WebSocket disconnected");
			});

			ws.addEventListener("error", (error) => {
				console.error(
					"❌ [TwelveData] WebSocket connection failed:",
					error
				);
			});

			ws.addEventListener("message", (event: MessageEvent) => {
				this.handleTwelveDataMessage(event);
			});

			return this.demoSocket;
		},

		// Handle Twelve Data WebSocket messages
		handleTwelveDataMessage(event: MessageEvent) {
			try {
				const message = JSON.parse(
					event.data
				) as TwelveDataWebSocketMessage;

				// console.log("📨 [TwelveData] Message received:", message);

				// Handle heartbeat response
				if (message.event === "heartbeat") {
					// console.log("💓 [TwelveData] Heartbeat acknowledged");
					return;
				}

				// Handle connection events
				if (message.event === "subscribe-status") {
					console.log(
						"📡 [TwelveData] Subscription status:",
						message.status
					);
					return;
				}

				// Handle price updates
				if (
					message.event === "price" &&
					message.symbol &&
					message.price !== undefined
				) {
					const channelString = `price:${message.symbol}`;
					const subscriptionItem =
						this.channelToSubscription?.get(channelString);

					// console.log("🔍 [TwelveData] Looking for subscription:", {
					// 	channelString,
					// 	messageSymbol: message.symbol,
					// 	hasSubscription: !!subscriptionItem,
					// 	allChannels: Array.from(
					// 		this.channelToSubscription?.keys() || []
					// 	),
					// });

					if (!subscriptionItem) {
						console.warn(
							`⚠️ [TwelveData] No subscription found for ${channelString}`
						);
						return;
					}

					// console.log(
					// 	`📊 [TwelveData] Price update for ${message.symbol}: ${message.price}`,
					// 	{
					// 		currency_base: message.currency_base,
					// 		currency_quote: message.currency_quote,
					// 		exchange: message.exchange,
					// 		type: message.type,
					// 	}
					// );

					const { symbol, exchange, timestamp, price } = message;

					// Generate a unique trade ID
					const tradeID = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

					// For price updates, we don't have quantity, so use a default
					const quantity = 1;
					const amount = Number(price) * quantity;

					const tradeMessage: TradeMessage = {
						type: "trade",
						productId: `${exchange}:SPOT:${symbol}`,
						symbol: symbol || "",
						exchange: exchange || "TWELVEDATA",
						segment: "SPOT",
						timeStamp: new Date(
							(timestamp || Date.now() / 1000) * 1000
						),
						tradeID: tradeID,
						price: Number(price),
						quantity: quantity,
						amount: amount,
						side: "BUY", // Default side since Twelve Data doesn't provide this
					};

					// console.log({ tradeMessage, subscriptionItem });

					// Call all handlers for this channel
					subscriptionItem.handlers.forEach(
						(handler: StreamingHandler) => {
							try {
								// console.log(
								// 	`✅ [TwelveData] Calling handler ${handler.id} with tradeMessage:`,
								// 	tradeMessage
								// );
								handler.callback(tradeMessage);
							} catch (error) {
								console.error(
									`❌ [TwelveData] Error in handler ${handler.id}:`,
									error
								);
							}
						}
					);
				}
			} catch (error) {
				console.error("❌ [TwelveData] Error parsing message:", error);
			}
		},

		// Send Twelve Data WebSocket subscription
		sendTwelveDataSubscription(
			subRequest: {
				action: string;
				params: { symbols: { symbol: string; exchange: string }[] };
			},
			subscriptionItem: SubscriptionItem
		) {
			console.log(
				`📤 [TwelveData] Subscribing to ${subscriptionItem.symbolInfo.symbol}:`,
				subRequest
			);

			if (
				this.demoSocket &&
				this.demoSocket.readyState === WebSocket.OPEN
			) {
				// Send subscription request
				console.log(
					"✅ [TwelveData] Socket is OPEN, sending subscription",
					subRequest
				);
				this.demoSocket.send(JSON.stringify(subRequest));

				// startChannelStreaming already called unconditionally in subscribeOnStream
			} else if (
				this.demoSocket &&
				this.demoSocket.readyState === WebSocket.CONNECTING
			) {
				// Socket is connecting, wait for it to open
				console.log(
					"⏳ [TwelveData] Socket is CONNECTING, waiting for open event"
				);
				if (this.demoSocket instanceof WebSocket) {
					const socket = this.demoSocket;
					socket.addEventListener(
						"open",
						() => {
							console.log(
								"✅ [TwelveData] Socket opened, sending subscription",
								subRequest
							);
							socket.send(JSON.stringify(subRequest));

							// startChannelStreaming already called in subscribeOnStream
						},
						{ once: true }
					);
				}
			} else {
				// Socket is closed or failed, need to reconnect
				console.error(
					"❌ [TwelveData] Socket not connected. ReadyState:",
					this.demoSocket?.readyState
				);

				this.initializeTwelveDataSocket();
				// Wait for the new socket to connect
				if (this.demoSocket instanceof WebSocket) {
					const socket = this.demoSocket;
					socket.addEventListener(
						"open",
						() => {
							console.log(
								"✅ [TwelveData] Socket reconnected, sending subscription",
								subRequest
							);
							socket.send(JSON.stringify(subRequest));

							// startChannelStreaming already called in subscribeOnStream
						},
						{ once: true }
					);
				}
			}
		},

		// Send demo unsubscription (mirroring streaming.js unsubscription logic)
		sendDemoUnsubscription(
			unsubRequest: SubscriptionRequest,
			_channelString: string
		) {
			if (this.demoSocket && this.demoSocket.readyState === 1) {
				this.demoSocket.send(JSON.stringify(unsubRequest));
			}
		},

		// Chart marks/events - shows important events on the chart
		getMarks(
			symbolInfo: SymbolInfo,
			_startDate: number,
			_endDate: number,
			onDataCallback: (marks: Mark[]) => void,
			_resolution: string | Resolution
		): void {
			// console.log("[DemoDatafeed] getMarks called:", {
			// 	symbolInfo,
			// 	startDate: _startDate,
			// 	endDate: _endDate,
			// 	resolution: _resolution,
			// });

			// Use current time for more visible marks
			const now = Math.floor(Date.now() / 1000);
			const marks: Mark[] = [
				{
					id: 1,
					time: now - 86400 * 7, // 1 week ago
					color: "red",
					text: [
						"Earnings Report",
						"Q3 2025 Results",
						"Beat expectations by 15%",
					],
					label: "E",
					labelFontColor: "white",
					minSize: 25,
				},
				{
					id: 2,
					time: now - 86400 * 3, // 3 days ago
					color: "green",
					text: ["Product Launch", "New AI feature released"],
					label: "P",
					labelFontColor: "white",
					minSize: 25,
				},
				{
					id: 3,
					time: now - 86400, // Yesterday
					color: "blue",
					text: ["Market News", "Analyst upgrade to BUY"],
					label: "N",
					labelFontColor: "white",
					minSize: 25,
				},
			];

			console.log("[DemoDatafeed] getMarks returning marks:", marks);
			onDataCallback(marks);
		},

		// Timescale marks - shows events on the time axis
		getTimescaleMarks(
			symbolInfo: SymbolInfo,
			_startDate: number,
			_endDate: number,
			onDataCallback: (marks: TimescaleMark[]) => void,
			_resolution: string | Resolution
		): void {
			// console.log("[DemoDatafeed] getTimescaleMarks called:", {
			// 	symbolInfo,
			// 	startDate: _startDate,
			// 	endDate: _endDate,
			// 	resolution: _resolution,
			// });

			// Use current time for more visible marks
			const now = Math.floor(Date.now() / 1000);
			const marks: TimescaleMark[] = [
				{
					id: "1",
					time: now - 86400 * 5, // 5 days ago
					color: "red",
					label: "T1",
					tooltip:
						"Market Event - 5 days ago - Important trading session",
				},
				{
					id: "2",
					time: now - 86400 * 2, // 2 days ago
					color: "blue",
					label: "T2",
					tooltip: "Economic Data - 2 days ago - GDP release",
				},
				{
					id: "3",
					time: now + 86400, // Tomorrow
					color: "orange",
					label: "T3",
					tooltip: "Scheduled Event - Tomorrow - Fed meeting",
				},
			];

			console.log(
				"[DemoDatafeed] getTimescaleMarks returning marks:",
				marks
			);
			onDataCallback(marks);
		},
	};

	return datafeed as Datafeed;
};
