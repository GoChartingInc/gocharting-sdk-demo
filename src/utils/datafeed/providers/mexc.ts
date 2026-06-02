import type { Resolution, PeriodParams } from "@gocharting/chart-sdk";
import { DatafeedProvider, RawBar, TradeTick } from "../types";
import { relay } from "../proxy";

const QUOTE = "USDT";

const INTERVAL: Record<string, string> = {
	"1": "1m",
	"5": "5m",
	"15": "15m",
	"30": "30m",
	"60": "60m",
	"240": "4h",
	"1D": "1d",
	"1W": "1W",
	"1M": "1M",
};

export const mexc: DatafeedProvider = {
	id: "mexc",
	label: "MEXC",
	exchange: "MEXC",
	segment: "SPOT",
	quoteCurrency: QUOTE,

	resolveSymbol(base) {
		const providerSymbol = `${base}${QUOTE}`; // BTCUSDT
		return { providerSymbol, fullName: `MEXC:SPOT:${providerSymbol}` };
	},

	mapInterval: (r: string | Resolution) => INTERVAL[String(r)] ?? "1d",

	// MEXC REST has no CORS header → fetch via relay proxy. (Binance-compatible shape.)
	buildKlineUrl(symbol, interval, params: PeriodParams) {
		const limit = Math.min(params.rows || 500, 1000);
		let url = `https://api.mexc.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
		if (!params.firstDataRequest) {
			const start =
				typeof params.from === "number"
					? params.from * 1000
					: (params.from as Date).getTime();
			const end =
				typeof params.to === "number"
					? params.to * 1000
					: (params.to as Date).getTime();
			url += `&startTime=${start}&endTime=${end}`;
		}
		return relay(url);
	},

	parseKlines(json: any): RawBar[] {
		if (!Array.isArray(json)) return [];
		// rows: [openTimeMs, o, h, l, c, vol, closeTimeMs, quoteVol] — oldest-first.
		return json.map((row: any[]) => ({
			time: Math.floor(Number(row[0]) / 1000),
			open: Number(row[1]),
			high: Number(row[2]),
			low: Number(row[3]),
			close: Number(row[4]),
			volume: Number(row[5]),
		}));
	},

	// NOTE: MEXC's public WS now streams protobuf, which the JSON-only factory
	// cannot decode — this provider is effectively history-only. The subscribe
	// payload + JSON parseTrade below are kept for the legacy JSON deals channel.
	wsUrl: "wss://wbs.mexc.com/ws",
	buildSubscribe: (symbol) => ({
		method: "SUBSCRIPTION",
		params: [`spot@public.deals.v3.api@${symbol}`],
	}),
	buildUnsubscribe: (symbol) => ({
		method: "UNSUBSCRIPTION",
		params: [`spot@public.deals.v3.api@${symbol}`],
	}),

	parseTrade(raw: any): TradeTick | null {
		const d = raw?.d?.deals?.[0];
		if (!d || !raw?.s) return null;
		return {
			symbol: raw.s, // "BTCUSDT"
			price: Number(d.p),
			size: Number(d.v),
			side: Number(d.S) === 1 ? "BUY" : "SELL",
			timestampMs: Number(d.t),
		};
	},
};
