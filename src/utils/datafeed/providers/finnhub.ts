import type { Resolution, PeriodParams } from "@gocharting/chart-sdk";
import { DatafeedProvider, RawBar, TradeTick } from "../types";

// Multi-asset vendor (crypto + forex + stocks). Requires an API key.
// Get a free key at https://finnhub.io → set REACT_APP_FINNHUB_API_KEY.
const KEY = process.env.REACT_APP_FINNHUB_API_KEY ?? "";

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

export const finnhub: DatafeedProvider = {
	id: "finnhub",
	label: "Finnhub (multi-asset)",
	exchange: "FINNHUB",
	segment: "SPOT",
	quoteCurrency: QUOTE,

	// Crypto via the BINANCE feed symbol; the same adapter shape works for
	// forex (e.g. "OANDA:EUR_USD") and stocks ("AAPL") if you change the base.
	resolveSymbol(base) {
		const providerSymbol = `BINANCE:${base}${QUOTE}`; // BINANCE:BTCUSDT
		return { providerSymbol, fullName: `FINNHUB:SPOT:${providerSymbol}` };
	},

	mapInterval: (r: string | Resolution) => INTERVAL[String(r)] ?? "D",

	// NOTE: free-tier history (crypto/candle) is gated — expect HTTP 403 and a
	// demo-data fallback. Live trades over WS DO work on the free tier.
	buildKlineUrl(symbol, interval, params: PeriodParams) {
		const to =
			typeof params.to === "number"
				? params.to
				: Math.floor((params.to as Date).getTime() / 1000);
		const from =
			typeof params.from === "number"
				? params.from
				: Math.floor((params.from as Date).getTime() / 1000);
		return `https://finnhub.io/api/v1/crypto/candle?symbol=${encodeURIComponent(
			symbol
		)}&resolution=${interval}&from=${from}&to=${to}&token=${KEY}`;
	},

	parseKlines(json: any): RawBar[] {
		if (!json || json.s !== "ok" || !Array.isArray(json.t)) return [];
		return json.t.map((ts: number, i: number) => ({
			time: Math.floor(Number(ts)),
			open: Number(json.o[i]),
			high: Number(json.h[i]),
			low: Number(json.l[i]),
			close: Number(json.c[i]),
			volume: Number(json.v?.[i] ?? 0),
		}));
	},

	wsUrl: `wss://ws.finnhub.io?token=${KEY}`,
	buildSubscribe: (symbol) => ({ type: "subscribe", symbol }),
	buildUnsubscribe: (symbol) => ({ type: "unsubscribe", symbol }),

	parseTrade(raw: any): TradeTick | null {
		if (raw?.type !== "trade") return null;
		const t = raw?.data?.[0];
		if (!t) return null;
		return {
			symbol: t.s, // "BINANCE:BTCUSDT"
			price: Number(t.p),
			size: Number(t.v),
			side: "BUY", // Finnhub trades carry no taker side
			timestampMs: Number(t.t),
		};
	},
};
