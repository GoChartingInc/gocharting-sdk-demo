import type { Resolution, PeriodParams } from "@gocharting/chart-sdk";
import { DatafeedProvider, RawBar, TradeTick } from "../types";
import { relay } from "../proxy";

const QUOTE = "USD";

// Bitstamp step is in seconds.
const INTERVAL: Record<string, string> = {
	"1": "60",
	"5": "300",
	"15": "900",
	"30": "1800",
	"60": "3600",
	"240": "14400",
	"1D": "86400",
	"1W": "259200", // max step is 3 days
	"1M": "259200",
};

export const bitstamp: DatafeedProvider = {
	id: "bitstamp",
	label: "Bitstamp",
	exchange: "BITSTAMP",
	segment: "SPOT",
	quoteCurrency: QUOTE,

	resolveSymbol(base) {
		const providerSymbol = `${base}${QUOTE}`.toLowerCase(); // btcusd
		return {
			providerSymbol,
			fullName: `BITSTAMP:SPOT:${providerSymbol.toUpperCase()}`,
		};
	},

	mapInterval: (r: string | Resolution) => INTERVAL[String(r)] ?? "86400",

	// Bitstamp REST is geo-blocked from some networks → fetch via relay proxy.
	buildKlineUrl(symbol, interval, params: PeriodParams) {
		const limit = Math.min(params.rows || 200, 1000);
		let url = `https://www.bitstamp.net/api/v2/ohlc/${symbol}/?step=${interval}&limit=${limit}`;
		if (!params.firstDataRequest) {
			const end =
				typeof params.to === "number"
					? params.to
					: Math.floor((params.to as Date).getTime() / 1000);
			url += `&end=${end}`;
		}
		return relay(url);
	},

	parseKlines(json: any): RawBar[] {
		const list = json?.data?.ohlc;
		if (!Array.isArray(list)) return [];
		// rows: { timestamp(s), open, high, low, close, volume } — oldest-first.
		return list.map((row: any) => ({
			time: Math.floor(Number(row.timestamp)),
			open: Number(row.open),
			high: Number(row.high),
			low: Number(row.low),
			close: Number(row.close),
			volume: Number(row.volume),
		}));
	},

	wsUrl: "wss://ws.bitstamp.net",
	buildSubscribe: (symbol) => ({
		event: "bts:subscribe",
		data: { channel: `live_trades_${symbol}` },
	}),
	buildUnsubscribe: (symbol) => ({
		event: "bts:unsubscribe",
		data: { channel: `live_trades_${symbol}` },
	}),

	parseTrade(raw: any): TradeTick | null {
		if (raw?.event !== "trade") return null;
		const t = raw?.data;
		const channel: string = raw?.channel || "";
		if (!t) return null;
		return {
			symbol: channel.replace("live_trades_", ""), // "btcusd"
			price: Number(t.price),
			size: Number(t.amount),
			side: Number(t.type) === 0 ? "BUY" : "SELL", // 0=buy, 1=sell
			timestampMs: Number(t.timestamp) * 1000,
		};
	},
};
