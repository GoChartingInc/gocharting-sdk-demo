import type { Resolution, PeriodParams } from "@gocharting/chart-sdk";
import { DatafeedProvider, RawBar, TradeTick } from "../types";

const QUOTE = "USDT";

// Upbit splits candles across endpoints; map resolution → path segment.
const INTERVAL: Record<string, string> = {
	"1": "minutes/1",
	"5": "minutes/5",
	"15": "minutes/15",
	"30": "minutes/30",
	"60": "minutes/60",
	"240": "minutes/240",
	"1D": "days",
	"1W": "weeks",
	"1M": "months",
};

export const upbit: DatafeedProvider = {
	id: "upbit",
	label: "Upbit",
	exchange: "UPBIT",
	segment: "SPOT",
	quoteCurrency: QUOTE,

	resolveSymbol(base) {
		const providerSymbol = `${QUOTE}-${base}`; // USDT-BTC (quote-first)
		return { providerSymbol, fullName: `UPBIT:SPOT:${providerSymbol}` };
	},

	mapInterval: (r: string | Resolution) => INTERVAL[String(r)] ?? "days",

	buildKlineUrl(symbol, interval, params: PeriodParams) {
		const count = Math.min(params.rows || 200, 200);
		let url = `https://api.upbit.com/v1/candles/${interval}?market=${symbol}&count=${count}`;
		if (!params.firstDataRequest) {
			const to =
				typeof params.to === "number"
					? new Date(params.to * 1000)
					: (params.to as Date);
			// Upbit "to" is an exclusive upper bound, UTC "YYYY-MM-DD HH:mm:ss".
			url += `&to=${encodeURIComponent(
				to.toISOString().slice(0, 19).replace("T", " ")
			)}`;
		}
		return url;
	},

	parseKlines(json: any): RawBar[] {
		if (!Array.isArray(json)) return [];
		// newest-first; time from the candle's UTC open string.
		return json
			.map((row: any) => ({
				time: Math.floor(
					Date.parse(`${row.candle_date_time_utc}Z`) / 1000
				),
				open: Number(row.opening_price),
				high: Number(row.high_price),
				low: Number(row.low_price),
				close: Number(row.trade_price),
				volume: Number(row.candle_acc_trade_volume),
			}))
			.reverse();
	},

	// Upbit WS delivers JSON frames as binary — the factory sets binaryType to
	// "arraybuffer" and decodes them, so live ticks work.
	wsUrl: "wss://api.upbit.com/websocket/v1",
	buildSubscribe: (symbol) => [
		{ ticket: "gocharting" },
		{ type: "trade", codes: [symbol] },
	],
	buildUnsubscribe: (_symbol) => [
		{ ticket: "gocharting" },
		{ type: "trade", codes: [] },
	],

	parseTrade(raw: any): TradeTick | null {
		if (raw?.type !== "trade") return null;
		return {
			symbol: raw.code, // "USDT-BTC"
			price: Number(raw.trade_price),
			size: Number(raw.trade_volume),
			side: String(raw.ask_bid).toUpperCase() === "BID" ? "BUY" : "SELL",
			timestampMs: Number(raw.trade_timestamp),
		};
	},
};
