import type { Resolution, PeriodParams } from "@gocharting/chart-sdk";
import { DatafeedProvider, RawBar, TradeTick } from "../types";
import { relay } from "../proxy";

const QUOTE = "USDT";

const INTERVAL: Record<string, string> = {
	"1": "MINUTE_1",
	"5": "MINUTE_5",
	"15": "MINUTE_15",
	"30": "MINUTE_30",
	"60": "HOUR_1",
	"240": "HOUR_4",
	"1D": "DAY_1",
	"1W": "WEEK_1",
	"1M": "MONTH_1",
};

export const poloniex: DatafeedProvider = {
	id: "poloniex",
	label: "Poloniex",
	exchange: "POLONIEX",
	segment: "SPOT",
	quoteCurrency: QUOTE,

	resolveSymbol(base) {
		const providerSymbol = `${base}_${QUOTE}`; // BTC_USDT
		return { providerSymbol, fullName: `POLONIEX:SPOT:${providerSymbol}` };
	},

	mapInterval: (r: string | Resolution) => INTERVAL[String(r)] ?? "DAY_1",

	// Poloniex REST has no CORS header → fetch via relay proxy.
	buildKlineUrl(symbol, interval, params: PeriodParams) {
		const limit = Math.min(params.rows || 200, 500);
		let url = `https://api.poloniex.com/markets/${symbol}/candles?interval=${interval}&limit=${limit}`;
		if (!params.firstDataRequest) {
			const end =
				typeof params.to === "number"
					? params.to * 1000
					: (params.to as Date).getTime();
			url += `&endTime=${end}`;
		}
		return relay(url);
	},

	parseKlines(json: any): RawBar[] {
		if (!Array.isArray(json)) return [];
		// rows (strings): [low, high, open, close, quoteAmt, baseQty, ...,
		//   tradeCount(8), ts(9), weightedAvg, interval, startTime(12), closeTime(13)]
		return json
			.map((row: string[]) => ({
				time: Math.floor(Number(row[12]) / 1000),
				open: Number(row[2]),
				high: Number(row[1]),
				low: Number(row[0]),
				close: Number(row[3]),
				volume: Number(row[5]),
			}))
			.sort((a, b) => a.time - b.time);
	},

	wsUrl: "wss://ws.poloniex.com/ws/public",
	buildSubscribe: (symbol) => ({
		event: "subscribe",
		channel: ["trades"],
		symbols: [symbol],
	}),
	buildUnsubscribe: (symbol) => ({
		event: "unsubscribe",
		channel: ["trades"],
		symbols: [symbol],
	}),

	parseTrade(raw: any): TradeTick | null {
		if (raw?.channel !== "trades") return null;
		const t = raw?.data?.[0];
		if (!t) return null;
		return {
			symbol: t.symbol, // "BTC_USDT"
			price: Number(t.price),
			size: Number(t.quantity),
			side: String(t.takerSide).toUpperCase() === "BUY" ? "BUY" : "SELL",
			timestampMs: Number(t.ts),
		};
	},
};
