import type { Resolution, PeriodParams } from "@gocharting/chart-sdk";
import { DatafeedProvider, RawBar, TradeTick } from "../types";

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

export const bybit: DatafeedProvider = {
	id: "bybit",
	label: "Bybit",
	exchange: "BYBIT",
	segment: "FUTURE",
	quoteCurrency: QUOTE,

	resolveSymbol(base) {
		const providerSymbol = `${base}${QUOTE}`; // BTCUSDT
		return {
			providerSymbol,
			fullName: `BYBIT:FUTURE:${providerSymbol}`,
		};
	},

	mapInterval(resolution: string | Resolution) {
		return INTERVAL[String(resolution)] ?? "D";
	},

	buildKlineUrl(symbol, interval, params: PeriodParams) {
		const limit = params.rows || 200;
		if (params.firstDataRequest) {
			return `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&end=${Date.now()}&limit=${limit}`;
		}
		const start =
			typeof params.from === "number"
				? params.from * 1000
				: (params.from as Date).getTime();
		const end =
			typeof params.to === "number"
				? params.to * 1000
				: (params.to as Date).getTime();
		return `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&start=${start}&end=${end}&limit=${limit}`;
	},

	parseKlines(json: any): RawBar[] {
		const list = json?.result?.list;
		if (!Array.isArray(list)) return [];
		// Bybit returns newest-first → reverse to oldest-first.
		return list
			.map((row: string[]) => ({
				time: Math.floor(Number(row[0]) / 1000),
				open: Number(row[1]),
				high: Number(row[2]),
				low: Number(row[3]),
				close: Number(row[4]),
				volume: Number(row[5]),
			}))
			.reverse();
	},

	wsUrl: "wss://stream.bybit.com/v5/public/linear",
	buildSubscribe: (symbol) => ({
		op: "subscribe",
		args: [`publicTrade.${symbol}`],
	}),
	buildUnsubscribe: (symbol) => ({
		op: "unsubscribe",
		args: [`publicTrade.${symbol}`],
	}),

	parseTrade(raw: any): TradeTick | null {
		const topic: string | undefined = raw?.topic;
		if (!topic || !topic.startsWith("publicTrade")) return null;
		const first = raw?.data?.[0];
		if (!first) return null;
		return {
			symbol: first.s,
			price: Number(first.p),
			size: Number(first.v),
			side: String(first.S).toUpperCase() === "BUY" ? "BUY" : "SELL",
			timestampMs: Number(first.T),
		};
	},
};
