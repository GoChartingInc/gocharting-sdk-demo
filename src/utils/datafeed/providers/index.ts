import { DatafeedProvider } from "../types";
import { bybit } from "./bybit";

export const PROVIDERS: Record<string, DatafeedProvider> = {
	bybit,
};

export type ProviderId = string;

export const getProvider = (id: string | null | undefined): DatafeedProvider =>
	(id && PROVIDERS[id]) || PROVIDERS.bybit;

export const listProviders = (): Array<{ id: string; label: string }> =>
	Object.values(PROVIDERS).map((p) => ({ id: p.id, label: p.label }));
