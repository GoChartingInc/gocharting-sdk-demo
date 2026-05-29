import type { Datafeed } from "@gocharting/chart-sdk";
import { createDatafeed } from "./datafeed/createDatafeed";
import { bybit } from "./datafeed/providers/bybit";

/**
 * Backwards-compatible Bybit datafeed factory.
 * Existing importers (MultiBasicChart, ChartDemo, ChartSDK, ChartSDKAdvanced,
 * ChartSDKAdvanced2) continue to call createChartDatafeed() unchanged.
 */
export const createChartDatafeed = (): Datafeed => createDatafeed(bybit);
