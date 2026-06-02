import type { Resolution, PeriodParams } from "@gocharting/chart-sdk";
import { DatafeedProvider, RawBar, TradeTick } from "../types";

const QUOTE = "USDT";

const INTERVAL: Record<string, string> = {
	"1": "1min",
	"5": "5min",
	"15": "15min",
	"30": "30min",
	"60": "1h",
	"240": "4h",
	"1D": "1day",
	"1W": "1week",
	"1M": "1M",
};

export const bitget: DatafeedProvider = {
	id: "bitget",
	label: "Bitget",
	exchange: "BITGET",
	segment: "SPOT",
	quoteCurrency: QUOTE,

	resolveSymbol(base) {
		const providerSymbol = `${base}${QUOTE}`; // BTCUSDT
		return { providerSymbol, fullName: `BITGET:SPOT:${providerSymbol}` };
	},

	mapInterval: (r: string | Resolution) => INTERVAL[String(r)] ?? "1day",

	buildKlineUrl(symbol, interval, params: PeriodParams) {
		const limit = Math.min(params.rows || 200, 1000);
		let url = `https://api.bitget.com/api/v2/spot/market/candles?symbol=${symbol}&granularity=${interval}&limit=${limit}`;
		if (!params.firstDataRequest) {
			const end =
				typeof params.to === "number"
					? params.to * 1000
					: (params.to as Date).getTime();
			url += `&endTime=${end}`;
		}
		return url;
	},

	parseKlines(json: any): RawBar[] {
		const list = json?.data;
		if (!Array.isArray(list)) return [];
		// rows: [ms, open, high, low, close, baseVol, quoteVol, usdtVol] — oldest-first.
		return list.map((row: string[]) => ({
			time: Math.floor(Number(row[0]) / 1000),
			open: Number(row[1]),
			high: Number(row[2]),
			low: Number(row[3]),
			close: Number(row[4]),
			volume: Number(row[5]),
		}));
	},

	wsUrl: "wss://ws.bitget.com/v2/ws/public",
	buildSubscribe: (symbol) => ({
		op: "subscribe",
		args: [{ instType: "SPOT", channel: "trade", instId: symbol }],
	}),
	buildUnsubscribe: (symbol) => ({
		op: "unsubscribe",
		args: [{ instType: "SPOT", channel: "trade", instId: symbol }],
	}),

	parseTrade(raw: any): TradeTick | null {
		if (raw?.arg?.channel !== "trade") return null;
		const t = raw?.data?.[0];
		if (!t) return null;
		return {
			symbol: raw.arg.instId, // "BTCUSDT"
			price: Number(t.price),
			size: Number(t.size),
			side: String(t.side).toUpperCase() === "BUY" ? "BUY" : "SELL",
			timestampMs: Number(t.ts),
		};
	},
};
