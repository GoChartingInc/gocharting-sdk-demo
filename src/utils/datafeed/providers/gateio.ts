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
	"1D": "1d",
	"1W": "7d",
	"1M": "30d",
};

export const gateio: DatafeedProvider = {
	id: "gateio",
	label: "Gate.io",
	exchange: "GATEIO",
	segment: "SPOT",
	quoteCurrency: QUOTE,

	resolveSymbol(base) {
		const providerSymbol = `${base}_${QUOTE}`; // BTC_USDT
		return { providerSymbol, fullName: `GATEIO:SPOT:${providerSymbol}` };
	},

	mapInterval: (r: string | Resolution) => INTERVAL[String(r)] ?? "1d",

	// Gate.io REST has no Access-Control-Allow-Origin → fetch via relay proxy.
	buildKlineUrl(symbol, interval, params: PeriodParams) {
		const limit = Math.min(params.rows || 200, 1000);
		let url = `https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=${symbol}&interval=${interval}&limit=${limit}`;
		if (!params.firstDataRequest) {
			const to =
				typeof params.to === "number"
					? params.to
					: Math.floor((params.to as Date).getTime() / 1000);
			url += `&to=${to}`;
		}
		return relay(url);
	},

	parseKlines(json: any): RawBar[] {
		if (!Array.isArray(json)) return [];
		// rows: [ts(s), quoteVol, close, high, low, open, baseVol, windowClosed] — oldest-first.
		return json.map((row: string[]) => ({
			time: Math.floor(Number(row[0])),
			open: Number(row[5]),
			high: Number(row[3]),
			low: Number(row[4]),
			close: Number(row[2]),
			volume: Number(row[6]),
		}));
	},

	wsUrl: "wss://api.gateio.ws/ws/v4/",
	buildSubscribe: (symbol) => ({
		time: Math.floor(Date.now() / 1000),
		channel: "spot.trades",
		event: "subscribe",
		payload: [symbol],
	}),
	buildUnsubscribe: (symbol) => ({
		time: Math.floor(Date.now() / 1000),
		channel: "spot.trades",
		event: "unsubscribe",
		payload: [symbol],
	}),

	parseTrade(raw: any): TradeTick | null {
		if (raw?.channel !== "spot.trades" || raw?.event !== "update")
			return null;
		const r = raw.result;
		if (!r) return null;
		return {
			symbol: r.currency_pair, // "BTC_USDT"
			price: Number(r.price),
			size: Number(r.amount),
			side: String(r.side).toUpperCase() === "BUY" ? "BUY" : "SELL",
			timestampMs: Number(r.create_time_ms),
		};
	},
};
