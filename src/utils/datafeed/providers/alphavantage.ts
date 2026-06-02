import type { Resolution, PeriodParams } from "@gocharting/chart-sdk";
import { DatafeedProvider, RawBar, TradeTick } from "../types";

// Multi-asset vendor (crypto + forex + stocks). Requires an API key.
// Get a free key at https://www.alphavantage.co/support/#api-key
// → set REACT_APP_ALPHAVANTAGE_API_KEY. Free tier: 25 requests/day, daily bars only.
const KEY = process.env.REACT_APP_ALPHAVANTAGE_API_KEY ?? "demo";

const QUOTE = "USD";

export const alphavantage: DatafeedProvider = {
	id: "alphavantage",
	label: "Alpha Vantage (multi-asset)",
	exchange: "ALPHAVANTAGE",
	segment: "SPOT",
	quoteCurrency: QUOTE,

	// providerSymbol is the bare base ("BTC"); market is fixed to USD.
	resolveSymbol(base) {
		return { providerSymbol: base, fullName: `ALPHAVANTAGE:SPOT:${base}` };
	},

	// Free crypto data is daily/weekly/monthly only — always daily here.
	mapInterval: (_r: string | Resolution) => "DAILY",

	buildKlineUrl(symbol, _interval, _params: PeriodParams) {
		return `https://www.alphavantage.co/query?function=DIGITAL_CURRENCY_DAILY&symbol=${symbol}&market=${QUOTE}&apikey=${KEY}`;
	},

	parseKlines(json: any): RawBar[] {
		const series = json?.["Time Series (Digital Currency Daily)"];
		if (!series || typeof series !== "object") return [];
		return Object.entries(series)
			.map(([date, v]: [string, any]) => ({
				time: Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000),
				open: Number(v["1. open"]),
				high: Number(v["2. high"]),
				low: Number(v["3. low"]),
				close: Number(v["4. close"]),
				volume: Number(v["5. volume"]),
			}))
			.sort((a, b) => a.time - b.time);
	},

	// No public realtime stream.
	wsUrl: "",
	buildSubscribe: () => ({}),
	buildUnsubscribe: () => ({}),
	parseTrade(): TradeTick | null {
		return null;
	},
};
