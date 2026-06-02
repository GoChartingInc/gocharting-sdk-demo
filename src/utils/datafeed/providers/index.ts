import { DatafeedProvider } from "../types";
import { bybit } from "./bybit";
import { binance } from "./binance";
import { okx } from "./okx";
import { coinbase } from "./coinbase";
import { kraken } from "./kraken";
import { gemini } from "./gemini";
import { bitget } from "./bitget";
import { gateio } from "./gateio";
import { mexc } from "./mexc";
import { poloniex } from "./poloniex";
import { bitfinex } from "./bitfinex";
import { cryptocom } from "./cryptocom";
import { huobi } from "./huobi";
import { upbit } from "./upbit";
import { bitstamp } from "./bitstamp";
import { finnhub } from "./finnhub";
import { polygon } from "./polygon";
import { alphavantage } from "./alphavantage";
import { twelvedata } from "./twelvedata";

/**
 * Provider registry. To add a new provider: create its adapter file and add one line here —
 * it appears in the DataProviderSwitch automatically.
 *
 * Live/history support varies by provider — see env-and-providers notes:
 *   • Full (history + live):  bybit, binance, coinbase, kraken, gemini, bitget,
 *                             gateio, poloniex, upbit, cryptocom*  (*geo-dependent)
 *   • History-only (WS is gzip/protobuf/binary or geo-blocked): okx (history via
 *                             proxy), mexc, huobi, bitfinex, bitstamp
 *   • Keyed multi-asset (forex/stocks/crypto): finnhub (live), polygon (history),
 *                             alphavantage (daily history), twelvedata
 * CORS/geo-blocked REST hosts are routed through the shared relay proxy (../proxy).
 */
export const PROVIDERS: Record<string, DatafeedProvider> = {
	bybit,
	binance,
	okx,
	coinbase,
	kraken,
	gemini,
	bitget,
	gateio,
	mexc,
	poloniex,
	bitfinex,
	cryptocom,
	huobi,
	upbit,
	bitstamp,
	finnhub,
	polygon,
	alphavantage,
	twelvedata,
};

export const getProvider = (id: string | null | undefined): DatafeedProvider =>
	(id && PROVIDERS[id]) || PROVIDERS.bybit;

export const listProviders = (): Array<{ id: string; label: string }> =>
	Object.values(PROVIDERS).map((p) => ({ id: p.id, label: p.label }));
