import type { Resolution, PeriodParams } from "@gocharting/chart-sdk";
import { DatafeedProvider, RawBar, TradeTick } from "../types";

const QUOTE = "USDT";

const INTERVAL: Record<string, string> = {
	"1": "1m",
	"5": "5m",
	"15": "15m",
	"30": "30m",
	"60": "1h",
	"240": "4h",
	"1D": "1d",
	"1W": "1w",
	"1M": "1M",
};

export const binance: DatafeedProvider = {
	id: "binance",
	label: "Binance",
	exchange: "BINANCE",
	segment: "SPOT",
	quoteCurrency: QUOTE,

	resolveSymbol(base) {
		const providerSymbol = `${base}${QUOTE}`; // BTCUSDT
		return {
			providerSymbol,
			fullName: `BINANCE:SPOT:${providerSymbol}`,
		};
	},

	mapInterval: (r: string | Resolution) => INTERVAL[String(r)] ?? "1d",

	buildKlineUrl(symbol, interval, params: PeriodParams) {
		const limit = Math.min(params.rows || 500, 1000);
		let url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
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
		return url;
	},

	parseKlines(json: any): RawBar[] {
		if (!Array.isArray(json)) return []; // error objects come back as {code,msg}
		// Binance returns oldest-first already.
		return json.map((row: any[]) => ({
			time: Math.floor(Number(row[0]) / 1000),
			open: Number(row[1]),
			high: Number(row[2]),
			low: Number(row[3]),
			close: Number(row[4]),
			volume: Number(row[5]),
		}));
	},

	wsUrl: "wss://stream.binance.com:9443/ws",
	buildSubscribe: (symbol) => ({
		method: "SUBSCRIBE",
		params: [`${symbol.toLowerCase()}@trade`],
		id: 1,
	}),
	buildUnsubscribe: (symbol) => ({
		method: "UNSUBSCRIBE",
		params: [`${symbol.toLowerCase()}@trade`],
		id: 1,
	}),

	parseTrade(raw: any): TradeTick | null {
		if (raw?.e !== "trade") return null; // skip subscribe-ack {result,id}
		return {
			symbol: raw.s, // upper-case, matches channel key
			price: Number(raw.p),
			size: Number(raw.q),
			// m = "is buyer the market maker"; true → seller-initiated → SELL
			side: raw.m ? "SELL" : "BUY",
			timestampMs: Number(raw.T),
		};
	},
};
