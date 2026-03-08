import {
	SymbolInfo,
	Bar,
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

type IResponse<T = any> = {
	id: string;
	payload: T;
	status: number;
};

// ============================================================================
// Bybit API Response Types
// ============================================================================

/**
 * Bybit Kline (OHLCV) API response structure
 */
type BybitKlineResponse = {
	retCode: number;
	retMsg: string;
	result: {
		symbol: string;
		category: string;
		list: [string, string, string, string, string, string, string][]; // [timestamp, open, high, low, close, volume, turnover]
	};
	retExtInfo: Record<string, unknown>;
	time: number;
};

/**
 * Bybit WebSocket trade data structure
 */
type BybitTradeData = {
	/** Timestamp in milliseconds */
	T: number;
	/** Symbol */
	s: string;
	/** Side: "Buy" or "Sell" */
	S: string;
	/** Price */
	p: string;
	/** Trade ID */
	i: string;
	/** Size/Volume */
	v: string;
};

/**
 * Bybit WebSocket message structure
 */
type BybitWebSocketMessage = {
	topic: string;
	type: string;
	data: BybitTradeData[];
	ts?: number;
};

// ============================================================================
// GoCharting API Response Types
// ============================================================================

/**
 * GoCharting instrument search API response
 */
type GoChartingSearchResponse = {
	q: string;
	results: GoChartingSearchResult[];
};

/**
 * Individual search result from GoCharting API
 */
type GoChartingSearchResult = {
	item: GoChartingSearchItem;
	matches: GoChartingSearchMatch[];
};

type GoChartingSearchItem = {
	exchange: string;
	segment: string;
	symbol: string;
	asset_type: string;
	name: string;
	key: string;
	is_group: boolean;
	data_source_location: string;
	members: GoChartingSearchItemMember[];
};

type GoChartingSearchMatch = {
	key: string;
	value: string;
	indices: number[][];
};

type GoChartingSearchItemMember = {
	item: Omit<GoChartingSearchItem, "is_group" | "members">;
	matches: GoChartingSearchMatch[];
};

type GoChartingExactSearchResponse = {
	q: string[];
	results: GoChartingExactSearchItem[];
};

/**
 * Search item structure from GoCharting API
 */
type GoChartingExactSearchItem = {
	symbol: string;
	name: string;
	exchange: string;
	segment: string;
	asset_type: string;
	key: string;
	is_group?: boolean;
	members?: GoChartingSearchResult[];
	max_tick_precision?: number;
	max_volume_precision?: number;
	contract_size?: number;
	tick_size?: number;
	quote_currency?: string;
	future_type?: string;
	tradeable?: boolean;
	delay_seconds?: number;
	symbol_logo_urls?: string[];
	data_status?: DataStatus;
	exchange_info?: {
		name?: string;
		code?: string;
		country_cd?: string;
		zone?: string;
		has_unique_trade_id?: boolean;
		holidays?: string[] | null;
		hours?: Array<{ open: boolean }>;
		contains_ambiguous_symbols?: boolean;
		valid_intervals?: string[];
	};
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
 * Matches the SDK's subscribeTicks callback signature: (data: Bar | Tick | any) => void
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
 * Bybit feed message structure for demo streaming
 */
type BybitFeedMessage = {
	topic?: string;
	type?: string;
	data?: BybitTradeData[];
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
 * Tick data for real-time streaming
 */
type TickData = {
	time: number;
	price: number;
	volume: number;
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
export const createChartDatafeed = (): Datafeed => {
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
			// Close WebSocket connection
			if (this.demoSocket) {
				try {
					this.demoSocket.close();
				} catch (_) {}
				this.demoSocket = null;
			}
			// Clear subscriptions
			if (this.channelToSubscription) {
				this.channelToSubscription.clear();
			}
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
				// Try to use real Bybit API for BYBIT symbols, fallback to demo data
				if (symbolInfo.exchange === "BYBIT") {
					rawBars = await this.getBybitBars(
						symbolInfo,
						resolution,
						periodParams
					);
				} else {
					// Generate demo data for other symbols or as fallback
					// Convert timestamps to Date objects if needed
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
				}
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
				// Try to use real GoCharting API for symbol resolution
				try {
					const symbolInfo =
						await this.resolveSymbolFromAPI(symbolName);
					this.symbolCache.set(symbolName, symbolInfo);
					onResolve(symbolInfo);
					return;
				} catch (apiError) {}
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

		async resolveSymbolFromAPI(symbolName: string): Promise<SymbolInfo> {
			const url = "https://gocharting.com/sdk/instruments/exactSearch";
			const params: Record<string, string> = {
				q: symbolName,
			};
			const urlWithParams = new URL(url);
			Object.keys(params).forEach((key) =>
				urlWithParams.searchParams.append(key, params[key])
			);
			const res = await fetch(urlWithParams);
			if (!res.ok) {
				throw new Error(`HTTP ${res.status}: ${res.statusText}`);
			}
			const data =
				(await res.json()) as IResponse<GoChartingExactSearchResponse>;
			if (data.status === 200 && data.payload?.results?.length > 0) {
				const result = data.payload.results[0];
				const symbolInfo: SymbolInfo = {
					symbol: result.symbol,
					full_name: `${result.exchange}:${result.segment}:${result.symbol}`,
					description: result.name,
					exchange: result.exchange,
					type: result.asset_type.toLowerCase(),
					session: "24x7",
					session_label: "24x7",
					timezone: result.exchange_info?.zone || "UTC",
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
					supported_resolutions: result.exchange_info
						?.valid_intervals || [
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
					volume_precision: result.max_volume_precision || 8,
					data_status: result.data_status || "streaming",
					contract_size: result.contract_size,
					tick_size: result.tick_size,
					max_tick_precision: result.max_tick_precision,
					quote_currency: result.quote_currency || "USDT",
					future_type: result.future_type,
					tradeable: result.tradeable,
					delay_seconds: result.delay_seconds,
					symbol_logo_urls: result.symbol_logo_urls,
					segment: result.segment,
					asset_type: result.asset_type,
					exchange_info: {
						name:
							result.exchange_info?.name ||
							result.exchange.toLowerCase(),
						code: result.exchange_info?.code || result.exchange,
						country_cd: result.exchange_info?.country_cd || "US",
						zone: result.exchange_info?.zone || "UTC",
						has_unique_trade_id:
							result.exchange_info?.has_unique_trade_id ?? true,
						holidays: result.exchange_info?.holidays || null,
						hours: result.exchange_info?.hours || [
							{ open: true },
							{ open: true },
							{ open: true },
							{ open: true },
							{ open: true },
							{ open: true },
							{ open: true },
						],
						contains_ambiguous_symbols:
							result.exchange_info?.contains_ambiguous_symbols ??
							false,
						valid_intervals: result.exchange_info
							?.valid_intervals || [
							"1m",
							"3m",
							"5m",
							"10m",
							"15m",
							"30m",
							"1h",
							"2h",
							"4h",
							"12h",
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

		async getBybitBars(
			symbolInfo: SymbolInfo,
			resolution: string | Resolution,
			periodParams: PeriodParams
		): Promise<RawBar[]> {
			const { from, to, firstDataRequest, rows } = periodParams;
			console.log("ByBit Bars [Period]", periodParams);
			// Use the same logic as real datafeed.js
			// Handle both string and object resolution formats
			let scale: number;
			let units: string;
			let interval: string;
			if (typeof resolution === "string") {
				// Convert string resolution to object format
				const resolutionObj =
					this.convertIntervalToResolution(resolution);
				scale = resolutionObj.scale;
				units = resolutionObj.units;
				interval = resolutionObj.label;
			} else if (resolution && typeof resolution === "object") {
				scale = resolution.scale;
				units = resolution.units;
				// Use type string if available for direct lookup, otherwise derive
				if (resolution.type) {
					const resolutionObj = this.convertIntervalToResolution(
						resolution.type
					);
					interval = resolutionObj.label;
				} else {
					interval = this.deriveIntervalLabel(scale, units);
				}
			} else {
				console.error("❌ Invalid resolution format:", resolution);
				throw new Error("Invalid resolution format");
			}

			// Extract the correct symbol for Bybit API
			const bybitSymbol: string =
				symbolInfo.symbol || symbolInfo.ticker || "";
			let url: string;
			if (firstDataRequest) {
				// Use current time to get recent data up to today
				const currentTime = Date.now();
				url = `https://api.bybit.com/v5/market/kline?symbol=${bybitSymbol}&interval=${interval}&end=${currentTime}&limit=${
					rows || 200
				}`;
			} else {
				// Convert to milliseconds if needed (from is in seconds in installed SDK)
				const startDate =
					typeof from === "number"
						? from * 1000
						: (from as Date).getTime();
				const endDate =
					typeof to === "number" ? to * 1000 : (to as Date).getTime();
				url = `https://api.bybit.com/v5/market/kline?symbol=${bybitSymbol}&interval=${interval}&start=${startDate}&end=${endDate}&limit=${
					rows || 200
				}`;
			}
			const response = await fetch(url);
			const data = (await response.json()) as BybitKlineResponse;
			if (data.result?.list) {
				const bars: RawBar[] = [];
				const list = data.result.list;
				for (let k = 0; k < list.length; k++) {
					const [timestamp, open, high, low, close, volume] = list[k];
					const bar: RawBar = {
						time: Math.floor(Number(timestamp) / 1000), // Convert to seconds
						open: Number(open),
						high: Number(high),
						low: Number(low),
						close: Number(close),
						volume: Number(volume),
					};
					bars.push(bar);
				}
				// Bybit returns newest first, we need oldest first
				const reversedBars = bars.reverse();
				return reversedBars;
			}
			throw new Error("No data from Bybit API");
		},

		convertIntervalToResolution(intervalString: string): ResolutionInfo {
			const intervalMap: Record<string, ResolutionInfo> = {
				// SDK/TradingView format (numbers = minutes, D/W/M for day/week/month)
				"1": { scale: 1, units: "minutes", label: "1" },
				"3": { scale: 3, units: "minutes", label: "3" },
				"5": { scale: 5, units: "minutes", label: "5" },
				"15": { scale: 15, units: "minutes", label: "15" },
				"30": { scale: 30, units: "minutes", label: "30" },
				"60": { scale: 60, units: "minutes", label: "60" },
				"120": { scale: 120, units: "minutes", label: "120" },
				"240": { scale: 240, units: "minutes", label: "240" },
				"360": { scale: 360, units: "minutes", label: "360" },
				"720": { scale: 720, units: "minutes", label: "720" },
				"1D": { scale: 1, units: "days", label: "D" },
				"1W": { scale: 1, units: "weeks", label: "W" },
				"1M": { scale: 1, units: "months", label: "M" },
				// Legacy format fallbacks
				"1m": { scale: 1, units: "minutes", label: "1" },
				"5m": { scale: 5, units: "minutes", label: "5" },
				"15m": { scale: 15, units: "minutes", label: "15" },
				"30m": { scale: 30, units: "minutes", label: "30" },
				"1h": { scale: 60, units: "minutes", label: "60" },
				"4h": { scale: 240, units: "minutes", label: "240" },
			};
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
				case "m":
				case "minutes":
					return scale.toString();
				case "h":
				case "hours":
					return (scale * 60).toString();
				case "D":
				case "days":
					return "D";
				case "W":
				case "weeks":
					return "W";
				case "M":
				case "months":
					return "M";
				default:
					console.warn(`Unknown units: ${units}, defaulting to D`);
					return "D";
			}
		},

		// Convert resolution to Bybit interval format (mirroring helpers.js getExchangeInterval)
		getExchangeInterval(scale: number, units: string): number | string {
			switch (units) {
				case "minutes":
					return scale;
				case "hours":
					return 60 * scale;
				case "days":
					return "D";
				case "weeks":
					return "W";
				case "months":
					return "M";
				default:
					return 60;
			}
		},

		// Legacy method for backward compatibility
		getBybitInterval(resolution: string | number): string {
			const intervalMap: Record<string | number, string> = {
				1: "1",
				5: "5",
				15: "15",
				30: "30",
				60: "60",
				240: "240",
				"1D": "D",
				"1W": "W",
				"1M": "M",
			};
			return intervalMap[resolution] || "D";
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
			console.log(
				"🎯 [DemoDatafeed] Generating demo data for symbol:",
				symbol
			);

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
					await this.searchSymbolsFromAPI(userInput, callback);
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

		async searchSymbolsFromAPI(
			userInput: string,
			callback: ((result: SearchSymbolsResult) => void) | undefined
		): Promise<void> {
			const url = "https://gocharting.com/sdk/instruments/search";
			const params: Record<string, string> = {
				q: userInput,
			};

			if (this.searchSymbolController) {
				this.searchSymbolController.abort();
			}

			this.searchSymbolController = new AbortController();

			const urlWithParams = new URL(url);
			Object.keys(params).forEach((key) =>
				urlWithParams.searchParams.append(key, params[key])
			);

			const res = await fetch(urlWithParams, {
				signal: this.searchSymbolController.signal,
			});

			if (!res.ok) {
				throw new Error(`HTTP ${res.status}: ${res.statusText}`);
			}

			const data =
				(await res.json()) as IResponse<GoChartingSearchResponse>;

			if (data.status === 200 && data.payload?.results) {
				const transformedResults: SearchResult[] = [];

				data.payload.results.forEach(
					(result: GoChartingSearchResult) => {
						const item: GoChartingSearchItem = result.item;

						if (item.is_group && item.members) {
							item.members.forEach((member) => {
								const memberItem = member.item;
								transformedResults.push({
									symbol: memberItem.symbol,
									full_name: memberItem.key,
									description: memberItem.name,
									exchange: memberItem.exchange,
									ticker: memberItem.symbol,
									type: memberItem.asset_type.toLowerCase() as SearchResult["type"],
								});
							});
						} else {
							transformedResults.push({
								symbol: item.symbol,
								full_name: item.key,
								description: item.name,
								exchange: item.exchange,
								ticker: item.symbol,
								type: item.asset_type.toLowerCase() as SearchResult["type"],
							});
						}
					}
				);

				if (callback) {
					// The SDK expects an object with searchInProgress and items properties
					callback({
						searchInProgress: false,
						items: transformedResults,
					});
				}
			} else {
				if (callback) {
					// The SDK expects an object with searchInProgress and items properties
					callback({
						searchInProgress: false,
						items: [],
					});
				}
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
			onRealtimeCallback: (bar: Bar) => void,
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
				const tick: TickData = {
					time: Math.floor(now / 1000), // Unix timestamp in seconds
					price: Math.round(lastPrice * 100) / 100, // Round to 2 decimal places
					volume: Math.floor(Math.random() * 1000) + 100, // Random volume
				};

				onRealtimeCallback(tick);
			}, 2000); // Update every 2 seconds
		},

		// Enhanced streaming implementation mirroring streaming.js capabilities
		subscribeOnStream(
			symbolInfo: SymbolInfo,
			resolution: string | Resolution,
			onRealtimeCallback: RealtimeDataCallback,
			subscriberUID: string,
			onResetCacheNeededCallback?: (() => void) | null,
			lastDailyBar?: Bar | null
		): void {
			// Initialize streaming infrastructure like streaming.js
			if (!this.channelToSubscription) {
				this.channelToSubscription = new Map();
			}

			if (!this.demoSocket) {
				this.initializeDemoSocket(symbolInfo);
			}

			// Create channel string similar to streaming.js format
			let channelString: string;
			if (symbolInfo.exchange === "BYBIT") {
				// Use real Bybit channel format
				const symbol: string =
					symbolInfo.symbol || symbolInfo.ticker || "";
				channelString = `publicTrade.${symbol}`;
			} else {
				// Use demo format for other exchanges
				channelString = `demoTrade.${
					symbolInfo.symbol || symbolInfo.ticker || ""
				}`;
			}

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

			// Create new subscription item like streaming.js
			subscriptionItem = {
				subscriberUID,
				resolution,
				lastDailyBar,
				handlers: [handler],
				symbolInfo: symbolInfo,
				channelString: channelString,
			};

			this.channelToSubscription.set(channelString, subscriptionItem);

			// Send subscription request (real Bybit format for BYBIT, demo for others)
			let subRequest: SubscriptionRequest;
			if (symbolInfo.exchange === "BYBIT") {
				// Real Bybit subscription format
				subRequest = {
					op: "subscribe",
					args: [channelString],
				};
			} else {
				// Demo subscription format
				subRequest = {
					op: "subscribe",
					args: [channelString],
					symbol:
						symbolInfo.symbol ||
						symbolInfo.ticker ||
						symbolInfo.description ||
						"",
				};
			}

			this.sendDemoSubscription(subRequest, subscriptionItem);
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

		// Initialize socket (mirroring streaming.js socket initialization)
		initializeDemoSocket(symbolInfo: SymbolInfo) {
			if (
				this.demoSocket &&
				this.demoSocket.readyState === WebSocket.OPEN
			) {
				return this.demoSocket;
			}

			// Create real Bybit WebSocket for BYBIT symbols, mock for others
			if (symbolInfo.exchange === "BYBIT") {
				const uri = this.getBybitWebSocketUrl(symbolInfo);
				const ws = new WebSocket(uri);
				this.demoSocket = ws;

				ws.addEventListener("open", () => {});

				ws.addEventListener("close", (event: CloseEvent) => {});

				ws.addEventListener("error", (event: Event) => {
					console.error(
						"WebSocket connection failed. Please check network connectivity and URL."
					);
				});

				ws.addEventListener("message", (event: MessageEvent) => {
					this.handleBybitMessage(event);
				});
			} else {
				// Create mock socket for non-Bybit symbols
				let mockReadyState = 1; // WebSocket.OPEN
				const mockSocket: DemoSocket = {
					get readyState() {
						return mockReadyState;
					},
					url: `wss://demo.gocharting.com/ws/${
						symbolInfo.exchange || "DEMO"
					}`,
					send: (message: string) => {},
					close: () => {
						mockReadyState = 3; // WebSocket.CLOSED
					},
					addEventListener: (
						event: string,
						_callback: (event?: unknown) => void
					) => {},
				};
				this.demoSocket = mockSocket;
			}

			return this.demoSocket;
		},

		// Get Bybit WebSocket URL (mirroring streaming.js getWebSocketUrl)
		getBybitWebSocketUrl(_symbolInfo: SymbolInfo) {
			// Use Bybit's public WebSocket endpoint
			return "wss://stream.bybit.com/v5/public/linear";
		},

		// Handle Bybit WebSocket messages (mirroring streaming.js message handling)
		handleBybitMessage(event: MessageEvent) {
			try {
				const feedMessage = JSON.parse(
					event.data
				) as BybitWebSocketMessage;
				const { topic } = feedMessage;

				if (!topic || !topic.startsWith("publicTrade")) {
					// Skip all non-trading events
					return;
				}

				// Find the subscription for this topic
				const subscriptionItem = this.channelToSubscription?.get(topic);

				if (!subscriptionItem) {
					return;
				}

				// Process real Bybit trade data
				this.processRealBybitData(topic, feedMessage);
			} catch (error) {
				console.error(
					"❌ [DemoDatafeed] Error parsing Bybit message:",
					error
				);
			}
		},

		// Process real Bybit trade data (mirroring streaming.js processing)
		processRealBybitData(
			topic: string,
			feedMessage: BybitWebSocketMessage
		) {
			const subscriptionItem = this.channelToSubscription?.get(topic);
			if (!subscriptionItem) {
				return;
			}

			const { data } = feedMessage;
			if (!data || data.length === 0) return;

			// Process each trade in the data array (matching streaming.js format exactly)
			data.forEach((each: BybitTradeData) => {
				const { T: timestamp, s, S: side, p: price, i, v: size } = each;

				const tradeMessage: TradeMessage = {
					type: "trade",
					productId: `BYBIT:FUTURE:${s}`,
					symbol: s,
					exchange: "BYBIT",
					segment: "FUTURE",
					timeStamp: new Date(timestamp),
					tradeID: i,
					price: Number(price),
					quantity: Number(size),
					amount: Number(price) * Number(size),
					side: side.toUpperCase(),
				};

				// Call all handlers for this channel (matching streaming.js exactly)
				subscriptionItem.handlers.forEach(
					(handler: StreamingHandler) => {
						try {
							handler.callback(tradeMessage);
						} catch (error) {
							console.error(
								`❌ [DemoDatafeed] Error in handler ${handler.id}:`,
								error
							);
						}
					}
				);
			});
		},

		// Send subscription (real Bybit or demo, mirroring streaming.js subscription logic)
		sendDemoSubscription(
			subRequest: SubscriptionRequest,
			subscriptionItem: SubscriptionItem
		) {
			const isRealBybit =
				subscriptionItem.symbolInfo.exchange === "BYBIT";

			if (
				this.demoSocket &&
				this.demoSocket.readyState === WebSocket.OPEN
			) {
				// Send real subscription request
				this.demoSocket.send(JSON.stringify(subRequest));

				// For non-Bybit symbols, start demo streaming
				// For Bybit symbols, real data will come through WebSocket messages
				if (!isRealBybit) {
					this.startChannelStreaming(subscriptionItem);
				}
			} else if (
				this.demoSocket &&
				this.demoSocket.readyState === WebSocket.CONNECTING
			) {
				// Socket is connecting, wait for it to open
				if (isRealBybit && this.demoSocket instanceof WebSocket) {
					const socket = this.demoSocket;
					socket.addEventListener(
						"open",
						() => {
							socket.send(JSON.stringify(subRequest));
						},
						{ once: true }
					);
				} else {
					// For demo sockets, simulate connection
					const socket = this.demoSocket;
					setTimeout(() => {
						if (socket) {
							socket.send(JSON.stringify(subRequest));
						}
						this.startChannelStreaming(subscriptionItem);
					}, 100);
				}
			} else {
				// Socket is closed or failed, need to reconnect
				console.error(
					"❌ [DemoDatafeed] Socket not connected. ReadyState:",
					this.demoSocket?.readyState
				);

				if (isRealBybit) {
					this.initializeDemoSocket(subscriptionItem.symbolInfo);
					// Wait for the new socket to connect
					if (this.demoSocket instanceof WebSocket) {
						const socket = this.demoSocket;
						socket.addEventListener(
							"open",
							() => {
								socket.send(JSON.stringify(subRequest));
							},
							{ once: true }
						);
					}
				} else {
					// For demo sockets, simulate connection
					const socket = this.demoSocket;
					setTimeout(() => {
						if (socket) {
							socket.send(JSON.stringify(subRequest));
						}
						this.startChannelStreaming(subscriptionItem);
					}, 100);
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

		// Start streaming for a specific channel (mirroring streaming.js message handling)
		startChannelStreaming(subscriptionItem: SubscriptionItem) {
			const { channelString } = subscriptionItem;

			if (!this.streamingIntervals) {
				this.streamingIntervals = {};
			}

			// Clear any existing interval for this channel
			if (this.streamingIntervals[channelString]) {
				clearInterval(this.streamingIntervals[channelString]);
			}

			// Simulate real-time trade data similar to streaming.js message processing
			let lastPrice = 50000 + Math.random() * 10000;

			this.streamingIntervals[channelString] = setInterval(() => {
				// Simulate realistic price movement
				const change = (Math.random() - 0.5) * 100;
				lastPrice = Math.max(1000, lastPrice + change);

				// Create trade data similar to streaming.js format
				const tradeData: BybitFeedMessage = {
					topic: channelString,
					type: "snapshot",
					data: [
						{
							T: Date.now(),
							s: subscriptionItem.symbolInfo?.symbol || "DEMO",
							S: Math.random() > 0.5 ? "Buy" : "Sell",
							p: String(Math.round(lastPrice * 100) / 100),
							i: Math.random().toString(36).substring(2, 11),
							v: (Math.random() * 10 + 0.1).toFixed(3),
						},
					],
				};

				// Process the trade data for all handlers (mirroring streaming.js message handling)
				this.processDemoTradeData(channelString, tradeData);
			}, 2000);
		},

		// Process demo trade data (mirroring streaming.js message processing)
		processDemoTradeData(
			channelString: string,
			feedMessage: BybitFeedMessage
		) {
			const subscriptionItem =
				this.channelToSubscription?.get(channelString);
			if (!subscriptionItem) {
				return;
			}

			const { data } = feedMessage;
			if (!data || data.length === 0) return;

			// Process each trade in the data array (matching streaming.js format exactly)
			data.forEach((each: BybitTradeData) => {
				const { T: timestamp, S: side, p: price, v: size } = each;

				const symbol = subscriptionItem.symbolInfo?.symbol || "DEMO";
				const tradeMessage = {
					type: "trade",
					productId: `DEMO:FUTURE:${symbol}`,
					symbol: symbol,
					exchange: subscriptionItem.symbolInfo?.exchange || "DEMO",
					segment: "FUTURE",
					timeStamp: new Date(timestamp),
					tradeID: Math.random().toString(36).substring(2, 11),
					price: Number(price),
					quantity: Number(size),
					amount: Number(price) * Number(size),
					side: side.toUpperCase(),
				};

				// Call all handlers for this channel (matching streaming.js exactly)
				subscriptionItem.handlers.forEach(
					(handler: StreamingHandler) => {
						try {
							handler.callback(tradeMessage);
						} catch (error) {
							console.error(
								`❌ [DemoDatafeed] Error in handler ${handler.id}:`,
								error
							);
						}
					}
				);
			});
		},

		// Chart marks/events - shows important events on the chart
		getMarks(
			symbolInfo: SymbolInfo,
			_startDate: number,
			_endDate: number,
			onDataCallback: (marks: Mark[]) => void,
			_resolution: string | Resolution
		): void {
			console.log("[DemoDatafeed] getMarks called:", {
				symbolInfo,
				startDate: _startDate,
				endDate: _endDate,
				resolution: _resolution,
			});

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
			console.log("[DemoDatafeed] getTimescaleMarks called:", {
				symbolInfo,
				startDate: _startDate,
				endDate: _endDate,
				resolution: _resolution,
			});

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
