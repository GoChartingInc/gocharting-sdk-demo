import type { Resolution, PeriodParams } from "@gocharting/chart-sdk";
import { DatafeedProvider, RawBar, TradeTick } from "../types";

const QUOTE = "USD";

// Gemini candle time_frames (no 4h/1w — closest mappings used).
const INTERVAL: Record<string, string> = {
	"1": "1m",
	"5": "5m",
	"15": "15m",
	"30": "30m",
	"60": "1hr",
	"240": "6hr",
	"1D": "1day",
	"1W": "1day",
	"1M": "1day",
};

export const gemini: DatafeedProvider = {
	id: "gemini",
	label: "Gemini",
	exchange: "GEMINI",
	segment: "SPOT",
	quoteCurrency: QUOTE,

	resolveSymbol(base) {
		const providerSymbol = `${base}${QUOTE}`; // BTCUSD (WS uses upper-case)
		return { providerSymbol, fullName: `GEMINI:SPOT:${providerSymbol}` };
	},

	mapInterval: (r: string | Resolution) => INTERVAL[String(r)] ?? "1day",

	buildKlineUrl(symbol, interval, _params: PeriodParams) {
		// Gemini returns a fixed recent window; no from/to paging.
		return `https://api.gemini.com/v2/candles/${symbol.toLowerCase()}/${interval}`;
	},

	parseKlines(json: any): RawBar[] {
		if (!Array.isArray(json)) return [];
		// rows: [ms, open, high, low, close, volume] — newest-first → reverse.
		return json
			.map((row: number[]) => ({
				time: Math.floor(Number(row[0]) / 1000),
				open: Number(row[1]),
				high: Number(row[2]),
				low: Number(row[3]),
				close: Number(row[4]),
				volume: Number(row[5]),
			}))
			.reverse();
	},

	wsUrl: "wss://api.gemini.com/v2/marketdata",
	buildSubscribe: (symbol) => ({
		type: "subscribe",
		subscriptions: [{ name: "l2", symbols: [symbol] }],
	}),
	buildUnsubscribe: (symbol) => ({
		type: "unsubscribe",
		subscriptions: [{ name: "l2", symbols: [symbol] }],
	}),

	parseTrade(raw: any): TradeTick | null {
		if (raw?.type !== "trade") return null;
		return {
			symbol: raw.symbol, // "BTCUSD"
			price: Number(raw.price),
			size: Number(raw.quantity),
			side: String(raw.side).toUpperCase() === "BUY" ? "BUY" : "SELL",
			timestampMs: Number(raw.timestamp),
		};
	},
};
