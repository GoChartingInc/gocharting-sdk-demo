import { DatafeedProvider } from "../types";
import { bybit } from "./bybit";
import { binance } from "./binance";
import { okx } from "./okx";
import { coinbase } from "./coinbase";
import { kraken } from "./kraken";
import { twelvedata } from "./twelvedata";

/**
 * Provider registry. To add a new provider: create its adapter file and add one line here —
 * it appears in the DataProviderSwitch automatically.
 */
export const PROVIDERS: Record<string, DatafeedProvider> = {
	bybit,
	binance,
	okx,
	coinbase,
	kraken,
	twelvedata,
};

export const getProvider = (id: string | null | undefined): DatafeedProvider =>
	(id && PROVIDERS[id]) || PROVIDERS.bybit;

export const listProviders = (): Array<{ id: string; label: string }> =>
	Object.values(PROVIDERS).map((p) => ({ id: p.id, label: p.label }));
