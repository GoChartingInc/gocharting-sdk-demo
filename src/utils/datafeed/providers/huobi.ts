import type { Resolution, PeriodParams } from "@gocharting/chart-sdk";
import { DatafeedProvider, RawBar, TradeTick } from "../types";

const QUOTE = "USDT";

const INTERVAL: Record<string, string> = {
	"1": "1min",
	"5": "5min",
	"15": "15min",
	"30": "30min",
	"60": "60min",
	"240": "4hour",
	"1D": "1day",
	"1W": "1week",
	"1M": "1mon",
};

export const huobi: DatafeedProvider = {
	id: "huobi",
	label: "HTX (Huobi)",
	exchange: "HTX",
	segment: "SPOT",
	quoteCurrency: QUOTE,

	resolveSymbol(base) {
		const providerSymbol = `${base}${QUOTE}`; // BTCUSDT (REST lower-cases)
		return { providerSymbol, fullName: `HTX:SPOT:${providerSymbol}` };
	},

	mapInterval: (r: string | Resolution) => INTERVAL[String(r)] ?? "1day",

	buildKlineUrl(symbol, interval, params: PeriodParams) {
		const size = Math.min(params.rows || 300, 2000);
		return `https://api.huobi.pro/market/history/kline?symbol=${symbol.toLowerCase()}&period=${interval}&size=${size}`;
	},

	parseKlines(json: any): RawBar[] {
		const list = json?.data;
		if (!Array.isArray(list)) return [];
		// rows: { id: s, open, close, low, high, amount(base), vol(quote) } — newest-first.
		return list
			.map((row: any) => ({
				time: Math.floor(Number(row.id)),
				open: Number(row.open),
				high: Number(row.high),
				low: Number(row.low),
				close: Number(row.close),
				volume: Number(row.amount),
			}))
			.reverse();
	},

	// HTX WS streams gzip-compressed frames that the JSON-only factory cannot
	// inflate → history-only. Subscribe payload kept; parseTrade attempts the
	// (decompressed) JSON shape but will not fire under gzip.
	wsUrl: "wss://api.huobi.pro/ws",
	buildSubscribe: (symbol) => ({
		sub: `market.${symbol.toLowerCase()}.trade.detail`,
		id: symbol,
	}),
	buildUnsubscribe: (symbol) => ({
		unsub: `market.${symbol.toLowerCase()}.trade.detail`,
		id: symbol,
	}),

	parseTrade(raw: any): TradeTick | null {
		const ch: string | undefined = raw?.ch;
		const t = raw?.tick?.data?.[0];
		if (!ch || !ch.endsWith(".trade.detail") || !t) return null;
		const sym = ch.split(".")[1]?.toUpperCase(); // market.btcusdt.trade.detail
		return {
			symbol: sym,
			price: Number(t.price),
			size: Number(t.amount),
			side: String(t.direction).toUpperCase() === "BUY" ? "BUY" : "SELL",
			timestampMs: Number(t.ts),
		};
	},
};
