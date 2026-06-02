import type { Resolution, PeriodParams } from "@gocharting/chart-sdk";
import { DatafeedProvider, RawBar, TradeTick } from "../types";
import { relay } from "../proxy";

const QUOTE = "USD";

const INTERVAL: Record<string, string> = {
	"1": "1m",
	"5": "5m",
	"15": "15m",
	"30": "30m",
	"60": "1h",
	"240": "6h",
	"1D": "1D",
	"1W": "1W",
	"1M": "1M",
};

export const bitfinex: DatafeedProvider = {
	id: "bitfinex",
	label: "Bitfinex",
	exchange: "BITFINEX",
	segment: "SPOT",
	quoteCurrency: QUOTE,

	resolveSymbol(base) {
		const providerSymbol = `${base}${QUOTE}`; // BTCUSD (REST prefixes with "t")
		return { providerSymbol, fullName: `BITFINEX:SPOT:${providerSymbol}` };
	},

	mapInterval: (r: string | Resolution) => INTERVAL[String(r)] ?? "1D",

	// Bitfinex REST is geo-blocked from some networks → fetch via relay proxy.
	buildKlineUrl(symbol, interval, params: PeriodParams) {
		const limit = Math.min(params.rows || 200, 10000);
		let url = `https://api-pub.bitfinex.com/v2/candles/trade:${interval}:t${symbol}/hist?limit=${limit}`;
		if (!params.firstDataRequest) {
			const end =
				typeof params.to === "number"
					? params.to * 1000
					: (params.to as Date).getTime();
			url += `&end=${end}`;
		}
		return relay(url);
	},

	parseKlines(json: any): RawBar[] {
		if (!Array.isArray(json)) return [];
		// rows: [MTS, OPEN, CLOSE, HIGH, LOW, VOLUME] — newest-first → reverse.
		return json
			.map((row: number[]) => ({
				time: Math.floor(Number(row[0]) / 1000),
				open: Number(row[1]),
				close: Number(row[2]),
				high: Number(row[3]),
				low: Number(row[4]),
				volume: Number(row[5]),
			}))
			.reverse();
	},

	// Bitfinex WS keys trades by a numeric channel id (not the symbol), which the
	// symbol-keyed factory can't route — this provider is history-only. The
	// subscribe payload is kept; parseTrade returns null (no live ticks).
	wsUrl: "wss://api-pub.bitfinex.com/ws/2",
	buildSubscribe: (symbol) => ({
		event: "subscribe",
		channel: "trades",
		symbol: `t${symbol}`,
	}),
	buildUnsubscribe: (symbol) => ({
		event: "unsubscribe",
		symbol: `t${symbol}`,
	}),

	parseTrade(): TradeTick | null {
		return null;
	},
};
