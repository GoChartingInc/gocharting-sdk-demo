import type { Resolution, PeriodParams } from "@gocharting/chart-sdk";
import { DatafeedProvider, RawBar, TradeTick } from "../types";
import { relay } from "../proxy";

const QUOTE = "USDT";

const INTERVAL: Record<string, string> = {
	"1": "1m",
	"5": "5m",
	"15": "15m",
	"30": "30m",
	"60": "1h",
	"240": "4h",
	"1D": "1D",
	"1W": "7D",
	"1M": "1M",
};

export const cryptocom: DatafeedProvider = {
	id: "cryptocom",
	label: "Crypto.com",
	exchange: "CRYPTOCOM",
	segment: "SPOT",
	quoteCurrency: QUOTE,

	resolveSymbol(base) {
		const providerSymbol = `${base}_${QUOTE}`; // BTC_USDT
		return { providerSymbol, fullName: `CRYPTOCOM:SPOT:${providerSymbol}` };
	},

	mapInterval: (r: string | Resolution) => INTERVAL[String(r)] ?? "1D",

	// Crypto.com REST is geo-blocked from some networks → fetch via relay proxy.
	buildKlineUrl(symbol, interval, _params: PeriodParams) {
		return relay(
			`https://api.crypto.com/v2/public/get-candlestick?instrument_name=${symbol}&timeframe=${interval}`
		);
	},

	parseKlines(json: any): RawBar[] {
		const list = json?.result?.data;
		if (!Array.isArray(list)) return [];
		// rows: { t: ms, o, h, l, c, v } — oldest-first.
		return list.map((row: any) => ({
			time: Math.floor(Number(row.t) / 1000),
			open: Number(row.o),
			high: Number(row.h),
			low: Number(row.l),
			close: Number(row.c),
			volume: Number(row.v),
		}));
	},

	wsUrl: "wss://stream.crypto.com/exchange/v1/market",
	buildSubscribe: (symbol) => ({
		id: 1,
		method: "subscribe",
		params: { channels: [`trade.${symbol}`] },
	}),
	buildUnsubscribe: (symbol) => ({
		id: 1,
		method: "unsubscribe",
		params: { channels: [`trade.${symbol}`] },
	}),

	parseTrade(raw: any): TradeTick | null {
		if (raw?.result?.channel !== "trade") return null;
		const t = raw?.result?.data?.[0];
		if (!t) return null;
		return {
			symbol: raw.result.instrument_name, // "BTC_USDT"
			price: Number(t.p),
			size: Number(t.q),
			side: String(t.s).toUpperCase() === "BUY" ? "BUY" : "SELL",
			timestampMs: Number(t.t),
		};
	},
};
