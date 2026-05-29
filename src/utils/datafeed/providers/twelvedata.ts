import type { Resolution, PeriodParams } from "@gocharting/chart-sdk";
import { DatafeedProvider, RawBar, TradeTick } from "../types";
import { createTwelveDataChartDatafeed } from "@/utils/twelve-chart-datafeed";

/**
 * TwelveData reuses the existing, fully-working feed via the makeDatafeed escape hatch.
 * The history/realtime methods below are unused (makeDatafeed short-circuits the factory)
 * but are provided to satisfy the DatafeedProvider interface.
 */
export const twelvedata: DatafeedProvider = {
	id: "twelvedata",
	label: "Twelve Data",
	exchange: "Coinbase Pro",
	segment: "SPOT",
	quoteCurrency: "USD",

	resolveSymbol(base) {
		const providerSymbol = `${base}/USD`; // BTC/USD
		return {
			providerSymbol,
			fullName: `Coinbase Pro:SPOT:${providerSymbol}`,
		};
	},

	mapInterval: (_r: string | Resolution) => "1min",
	buildKlineUrl: (_s, _i, _p: PeriodParams) => "",
	parseKlines: (_json): RawBar[] => [],
	wsUrl: "",
	buildSubscribe: () => ({}),
	buildUnsubscribe: () => ({}),
	parseTrade: (_raw): TradeTick | null => null,

	makeDatafeed: () => createTwelveDataChartDatafeed(),
};
