/**
 * Shared relay-proxy helper for data providers.
 *
 * Some exchange REST hosts are unreachable from the browser — either CORS-blocked
 * (no Access-Control-Allow-Origin: gate.io, MEXC, Poloniex) or geo/firewall-blocked
 * from certain networks (OKX www host, Bitfinex, Crypto.com, Bitstamp). A local dev
 * proxy can't help when the host itself is unreachable from this machine, so we route
 * through a third-party relay that fetches server-side and streams the raw body back.
 *
 * Default relay: allorigins (`/raw` passthrough — returns the upstream body verbatim,
 * so each provider's parseKlines works unchanged). Override globally with
 * REACT_APP_DATA_PROXY, or per-provider where a provider reads its own env var.
 * Set to "" to disable proxying entirely (direct fetch).
 *
 * NOTE: public relays rate-limit under burst. For production, point REACT_APP_DATA_PROXY
 * at your own backend relay.
 */
const DEFAULT_RELAY = "https://api.allorigins.win/raw?url=";

export const RELAY_PREFIX =
	process.env.REACT_APP_DATA_PROXY ?? DEFAULT_RELAY;

/** Wrap a URL so it is fetched through the relay. No-op if the relay is disabled. */
export const relay = (url: string): string =>
	RELAY_PREFIX ? `${RELAY_PREFIX}${encodeURIComponent(url)}` : url;
