import type { Resolution, PeriodParams } from "@gocharting/chart-sdk";
import { DatafeedProvider, RawBar, TradeTick } from "../types";

// Kraken interval is in minutes.
const INTERVAL: Record<string, string> = {
	"1": "1",
	"5": "5",
	"15": "15",
	"30": "30",
	"60": "60",
	"240": "240",
	"1D": "1440",
	"1W": "10080",
	"1M": "21600",
};

const krakenBase = (base: string): string => (base === "BTC" ? "XBT" : base);

export const kraken: DatafeedProvider = {
	id: "kraken",
	label: "Kraken",
	exchange: "KRAKEN",
	segment: "SPOT",
	quoteCurrency: "USD",

	resolveSymbol(base) {
		const kb = krakenBase(base);
		return {
			providerSymbol: `${kb}USD`, // XBTUSD (REST + channel key)
			fullName: `KRAKEN:SPOT:${kb}USD`,
		};
	},

	mapInterval: (r: string | Resolution) => INTERVAL[String(r)] ?? "1440",

	buildKlineUrl(symbol, interval, params: PeriodParams) {
		let url = `https://api.kraken.com/0/public/OHLC?pair=${symbol}&interval=${interval}`;
		if (!params.firstDataRequest) {
			const since =
				typeof params.from === "number"
					? params.from
					: Math.floor((params.from as Date).getTime() / 1000);
			url += `&since=${since}`;
		}
		return url;
	},

	parseKlines(json: any): RawBar[] {
		const result = json?.result;
		if (!result) return [];
		const key = Object.keys(result).find((k) => k !== "last");
		const list = key ? result[key] : null;
		if (!Array.isArray(list)) return [];
		// oldest-first; row: [time(s), o, h, l, c, vwap, vol, count]
		return list.map((row: any[]) => ({
			time: Number(row[0]),
			open: Number(row[1]),
			high: Number(row[2]),
			low: Number(row[3]),
			close: Number(row[4]),
			volume: Number(row[6]),
		}));
	},

	wsUrl: "wss://ws.kraken.com",
	buildSubscribe: (symbol) => ({
		event: "subscribe",
		// WS wants slash form: XBTUSD -> XBT/USD
		pair: [`${symbol.slice(0, -3)}/${symbol.slice(-3)}`],
		subscription: { name: "trade" },
	}),
	buildUnsubscribe: (symbol) => ({
		event: "unsubscribe",
		pair: [`${symbol.slice(0, -3)}/${symbol.slice(-3)}`],
		subscription: { name: "trade" },
	}),

	parseTrade(raw: any): TradeTick | null {
		// Trade frames are arrays: [channelID, [[price,vol,time,side,...]], "trade", pair]
		if (!Array.isArray(raw)) return null;
		if (raw[2] !== "trade") return null;
		const trades = raw[1];
		const pair: string = raw[3]; // "XBT/USD"
		const first = trades?.[0];
		if (!first) return null;
		return {
			symbol: pair.replace("/", ""), // "XBTUSD" matches channel key
			price: Number(first[0]),
			size: Number(first[1]),
			side: first[3] === "b" ? "BUY" : "SELL",
			timestampMs: Math.floor(Number(first[2]) * 1000),
		};
	},
};
