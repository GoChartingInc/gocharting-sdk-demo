import type { Resolution, PeriodParams } from "@gocharting/chart-sdk";
import { DatafeedProvider, RawBar, TradeTick } from "../types";
import { relay as withProxy } from "../proxy";

const QUOTE = "USDT";

// OKX's REST host (www.okx.com) is geo/firewall-blocked on some networks, so a
// direct browser fetch times out. Route history through the shared relay proxy
// (see ../proxy) that CAN reach OKX. Live WS (ws.okx.com) is unaffected.

const INTERVAL: Record<string, string> = {
	"1": "1m",
	"5": "5m",
	"15": "15m",
	"30": "30m",
	"60": "1H",
	"240": "4H",
	"1D": "1D",
	"1W": "1W",
	"1M": "1M",
};

export const okx: DatafeedProvider = {
	id: "okx",
	label: "OKX",
	exchange: "OKX",
	segment: "SPOT",
	quoteCurrency: QUOTE,

	resolveSymbol(base) {
		const providerSymbol = `${base}-${QUOTE}`; // BTC-USDT
		return {
			providerSymbol,
			fullName: `OKX:SPOT:${providerSymbol}`,
		};
	},

	mapInterval: (r: string | Resolution) => INTERVAL[String(r)] ?? "1D",

	buildKlineUrl(symbol, interval, params: PeriodParams) {
		const limit = Math.min(params.rows || 200, 300);
		// history-candles supports paging via `after` (ms, exclusive upper bound).
		if (params.firstDataRequest) {
			return withProxy(
				`https://www.okx.com/api/v5/market/candles?instId=${symbol}&bar=${interval}&limit=${limit}`
			);
		}
		const end =
			typeof params.to === "number"
				? params.to * 1000
				: (params.to as Date).getTime();
		return withProxy(
			`https://www.okx.com/api/v5/market/history-candles?instId=${symbol}&bar=${interval}&after=${end}&limit=${limit}`
		);
	},

	parseKlines(json: any): RawBar[] {
		const list = json?.data;
		if (!Array.isArray(list)) return [];
		// OKX returns newest-first → reverse to oldest-first.
		// row: [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]
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

	wsUrl: "wss://ws.okx.com:8443/ws/v5/public",
	buildSubscribe: (symbol) => ({
		op: "subscribe",
		args: [{ channel: "trades", instId: symbol }],
	}),
	buildUnsubscribe: (symbol) => ({
		op: "unsubscribe",
		args: [{ channel: "trades", instId: symbol }],
	}),

	parseTrade(raw: any): TradeTick | null {
		if (raw?.arg?.channel !== "trades") return null;
		const first = raw?.data?.[0];
		if (!first) return null;
		return {
			symbol: first.instId, // "BTC-USDT", matches channel key
			price: Number(first.px),
			size: Number(first.sz),
			side: String(first.side).toUpperCase() === "BUY" ? "BUY" : "SELL",
			timestampMs: Number(first.ts),
		};
	},
};
