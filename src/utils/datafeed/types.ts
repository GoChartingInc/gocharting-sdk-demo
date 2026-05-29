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
	/**
	 * Provider-native symbol. MUST equal the providerSymbol passed to buildSubscribe()
	 * / buildKlineUrl() — the factory uses it as the channel key to route ticks to the
	 * right subscription. If it differs, live ticks are silently dropped.
	 */
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
