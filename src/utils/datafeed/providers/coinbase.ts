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
