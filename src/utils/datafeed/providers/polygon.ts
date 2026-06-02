import type { Resolution, PeriodParams } from "@gocharting/chart-sdk";
import { DatafeedProvider, RawBar, TradeTick } from "../types";

// Multi-asset vendor (crypto + forex + stocks). Requires an API key.
// Get a free key at https://polygon.io → set REACT_APP_POLYGON_API_KEY.
const KEY = process.env.REACT_APP_POLYGON_API_KEY ?? "";

const QUOTE = "USD";

// "{multiplier}/{timespan}" for the aggregates endpoint.
const INTERVAL: Record<string, string> = {
	"1": "1/minute",
	"5": "5/minute",
	"15": "15/minute",
	"30": "30/minute",
	"60": "1/hour",
	"240": "4/hour",
	"1D": "1/day",
	"1W": "1/week",
	"1M": "1/month",
};

const DAY = 86400;

export const polygon: DatafeedProvider = {
	id: "polygon",
	label: "Polygon.io (multi-asset)",
	exchange: "POLYGON",
	segment: "SPOT",
	quoteCurrency: QUOTE,

	// Crypto aggregates ticker: "X:BTCUSD". Forex would be "C:EURUSD", stocks "AAPL".
	resolveSymbol(base) {
		const providerSymbol = `X:${base}${QUOTE}`; // X:BTCUSD
		return { providerSymbol, fullName: `POLYGON:SPOT:${providerSymbol}` };
	},

	mapInterval: (r: string | Resolution) => INTERVAL[String(r)] ?? "1/day",

	// Free tier = end-of-day / delayed aggregates (history only, no realtime WS).
	buildKlineUrl(symbol, interval, params: PeriodParams) {
		const limit = Math.min(params.rows || 200, 5000);
		const toSec =
			typeof params.to === "number"
				? params.to
				: Math.floor((params.to as Date).getTime() / 1000);
		const fromSec =
			typeof params.from === "number"
				? params.from
				: toSec - limit * DAY;
		const from = fromSec * 1000;
		const to = toSec * 1000;
		return `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/${interval}/${from}/${to}?adjusted=true&sort=asc&limit=${limit}&apiKey=${KEY}`;
	},

	parseKlines(json: any): RawBar[] {
		const list = json?.results;
		if (!Array.isArray(list)) return [];
		// rows: { t: ms, o, h, l, c, v } — oldest-first (sort=asc).
		return list.map((row: any) => ({
			time: Math.floor(Number(row.t) / 1000),
			open: Number(row.o),
			high: Number(row.h),
			low: Number(row.l),
			close: Number(row.c),
			volume: Number(row.v),
		}));
	},

	// Realtime WS requires a paid plan → no live ticks on free tier.
	wsUrl: "wss://socket.polygon.io/crypto",
	buildSubscribe: (symbol) => ({
		action: "subscribe",
		params: `XT.${symbol.replace("X:", "")}`,
	}),
	buildUnsubscribe: (symbol) => ({
		action: "unsubscribe",
		params: `XT.${symbol.replace("X:", "")}`,
	}),

	parseTrade(): TradeTick | null {
		return null; // free tier has no realtime stream
	},
};
