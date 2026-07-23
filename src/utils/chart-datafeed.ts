import {
	Datafeed,
	SymbolInfo,
	Resolution,
	PeriodParams,
	UDFResponse,
	RealtimeCallback,
	OnSymbolChangeEventHandler,
} from "@gocharting/chart-sdk";

// GoCharting demo WebSocket datafeed.
// Protocol: https://gocharting.com/sdk/docs/guides/demo-websocket
//
// Replaces the previous direct-Bybit integration. Streams real data from the
// GoCharting demo server: `timeseries` for history, a `trade` channel for live
// ticks, and a REST endpoint for symbol search. The demo is allowlisted to two
// symbols (BYBIT BTCUSDT / ETHUSDT perpetuals) and rate-limited to ~5
// connections per IP.

const DEMO_WS_URL = "wss://gocharting.com/sdk/ws";
const SEARCH_URL = "https://gocharting.com/sdk/instruments/search";

const DEMO_SYMBOLS = [
	{
		key: "BYBIT:FUTURE:BTCUSDT",
		exchange: "BYBIT",
		segment: "FUTURE",
		symbol: "BTCUSDT",
		description: "Bybit BTC/USDT perpetual",
		tick_size: 0.1,
		max_tick_precision: 1,
	},
	{
		key: "BYBIT:FUTURE:ETHUSDT",
		exchange: "BYBIT",
		segment: "FUTURE",
		symbol: "ETHUSDT",
		description: "Bybit ETH/USDT perpetual",
		tick_size: 0.01,
		max_tick_precision: 2,
	},
];

type RawBar = {
	time: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
};

function toIntervalString(resolution: string | Resolution): string {
	if (resolution == null) return "5m";
	if (typeof resolution === "string") return resolution;
	const r = resolution as any;
	if (r.type) return r.type;
	if (r.baseType) return r.baseType;
	if (r.scale === "minutes") return `${r.units || 1}m`;
	if (r.scale === "hours") return r.units === 1 ? "1h" : `${r.units}h`;
	if (r.scale === "days") return "1D";
	if (r.scale === "weeks") return "1W";
	if (r.scale === "months") return "1M";
	return "5m";
}

function fullSymbolKey(symbolInfoOrName: SymbolInfo | string): string {
	if (typeof symbolInfoOrName === "string") {
		const found = DEMO_SYMBOLS.find(
			(s) =>
				s.key === symbolInfoOrName ||
				s.symbol === symbolInfoOrName ||
				symbolInfoOrName.endsWith(":" + s.symbol),
		);
		return found ? found.key : symbolInfoOrName;
	}
	if (symbolInfoOrName?.full_name) return symbolInfoOrName.full_name;
	return symbolInfoOrName?.symbol || DEMO_SYMBOLS[0].key;
}

function parseBarTime(dateStr: string): number {
	// Demo server dates are often "YYYY-MM-DDTHH:mm:ss" without Z — treat as UTC.
	const raw = String(dateStr);
	const iso = /Z$|[+-]\d{2}:\d{2}$/.test(raw) ? raw : raw + "Z";
	return Math.floor(new Date(iso).valueOf() / 1000);
}

function flattenTimeseriesBars(payloadBars: any): RawBar[] {
	const out: RawBar[] = [];
	const push = (b: any) =>
		out.push({
			time: parseBarTime(b.date),
			open: Number(b.open),
			high: Number(b.high),
			low: Number(b.low),
			close: Number(b.close),
			volume: Number(b.volume ?? 0),
		});
	if (Array.isArray(payloadBars)) {
		payloadBars.forEach(push);
	} else if (payloadBars && typeof payloadBars === "object") {
		for (const day of Object.keys(payloadBars)) {
			(payloadBars[day] || []).forEach(push);
		}
	}
	out.sort((a, b) => a.time - b.time);
	return out;
}

// UDF shape — the SDK's DataProvider multiplies `t` by 1000, so return unix
// seconds here (not a { bars } array with ms timestamps).
function barsToUDF(rawBars: RawBar[]): UDFResponse {
	if (!rawBars.length) return { s: "no_data", nextTime: null };
	return {
		s: "ok",
		t: rawBars.map((b) => b.time),
		o: rawBars.map((b) => b.open),
		h: rawBars.map((b) => b.high),
		l: rawBars.map((b) => b.low),
		c: rawBars.map((b) => b.close),
		v: rawBars.map((b) => b.volume || 0),
	};
}

interface Pending {
	chunks: RawBar[];
	resolve: (bars: RawBar[]) => void;
	reject: (err: Error) => void;
	timer: ReturnType<typeof setTimeout>;
}

/**
 * Create a datafeed backed by the GoCharting demo WebSocket.
 *
 * @example
 * const datafeed = createChartDatafeed();
 * const chart = GoChartingSDK.createChart(el, {
 *   symbol: "BYBIT:FUTURE:BTCUSDT",
 *   interval: "1m",
 *   datafeed,
 *   licenseKey: "…",
 * });
 * // on teardown: datafeed.destroy();
 */
export const createChartDatafeed = (): Datafeed => {
	let ws: WebSocket | null = null;
	let ready: Promise<WebSocket> | null = null;
	let reqId = 1;
	let pingTimer: ReturnType<typeof setInterval> | null = null;
	let destroyed = false;
	const pending = new Map<number, Pending>();
	const tickSubs = new Map<
		string,
		{ symbolKey: string; callback: RealtimeCallback }
	>();
	let searchController: AbortController | null = null;

	function ensureWs(): Promise<WebSocket> {
		if (
			ws &&
			(ws.readyState === WebSocket.OPEN ||
				ws.readyState === WebSocket.CONNECTING)
		) {
			return ready!;
		}
		ready = new Promise<WebSocket>((resolve, reject) => {
			const socket = new WebSocket(DEMO_WS_URL);
			ws = socket;
			let opened = false;

			socket.onopen = () => {
				opened = true;
				socket.send("PING");
				if (pingTimer) clearInterval(pingTimer);
				pingTimer = setInterval(() => {
					if (socket.readyState === WebSocket.OPEN) socket.send("PING");
				}, 20000);
				resolve(socket);
			};
			socket.onerror = () => {
				if (!opened) reject(new Error("Demo WebSocket connection failed"));
			};
			socket.onclose = () => {
				if (pingTimer) clearInterval(pingTimer);
				pingTimer = null;
				ws = null;
				ready = null;
			};
			socket.onmessage = (ev) => handleMessage(ev);
		});
		return ready;
	}

	function handleMessage(ev: MessageEvent) {
		if (typeof ev.data !== "string") return;
		if (ev.data.startsWith("Welcome-") || ev.data.startsWith("PONG")) return;

		let msg: any;
		try {
			msg = JSON.parse(ev.data);
		} catch {
			return;
		}

		if (msg.command === "ERROR") {
			const p = msg.request_id != null ? pending.get(msg.request_id) : null;
			const err = new Error(
				msg.message || msg.out?.message || "Demo WebSocket ERROR",
			);
			if (p) {
				clearTimeout(p.timer);
				pending.delete(msg.request_id);
				p.reject(err);
			} else {
				console.warn("[chart-datafeed]", err.message, msg);
			}
			return;
		}

		if (msg.command === "timeseries") {
			const p = pending.get(msg.request_id);
			if (!p) return;
			p.chunks.push(...flattenTimeseriesBars(msg.payload?.bars));
			if (msg.final === 1 || msg.final === 2) {
				clearTimeout(p.timer);
				pending.delete(msg.request_id);
				const byTime = new Map<number, RawBar>();
				for (const b of p.chunks) byTime.set(b.time, b);
				p.resolve([...byTime.values()].sort((a, b) => a.time - b.time));
			}
			return;
		}

		if (
			msg.channel === "trade" &&
			msg.payload &&
			!Array.isArray(msg.payload) &&
			typeof msg.payload === "object" &&
			msg.command !== "SUBSCRIBE" &&
			msg.command !== "UNSUBSCRIBE"
		) {
			for (const [symbolKey, trades] of Object.entries(msg.payload)) {
				if (!Array.isArray(trades)) continue;
				for (const sub of tickSubs.values()) {
					if (sub.symbolKey !== symbolKey) continue;
					for (const t of trades as any[]) {
						if (!t || t.ltp == null) continue;
						const price = Number(t.ltp);
						if (!Number.isFinite(price)) continue;
						const qty = Number(t.l_sz ?? t.sz ?? 0);
						const ts = t.date
							? new Date(t.date)
							: t.t_ms != null
								? new Date(Number(t.t_ms))
								: new Date();
						if (Number.isNaN(ts.getTime())) continue;
						const parts = symbolKey.split(":");
						sub.callback({
							type: "trade",
							productId: symbolKey,
							symbol: parts[2] || symbolKey,
							exchange: parts[0] || "BYBIT",
							segment: parts[1] || "FUTURE",
							timeStamp: ts,
							tradeID: String(t.id ?? t.t_ms ?? Date.now()),
							price,
							quantity: qty,
							amount: price * qty,
							side: String(t.side || "Buy").toUpperCase(),
						} as any);
					}
				}
			}
		}
	}

	return {
		async getBars(
			symbolInfo: SymbolInfo,
			resolution: string | Resolution,
			periodParams: PeriodParams,
		) {
			const socket = await ensureWs();
			const symbol = fullSymbolKey(symbolInfo);
			const interval = toIntervalString(resolution);
			const rows =
				periodParams?.countBack || (periodParams as any)?.rows || 300;
			const request_id = reqId++;

			const bars = await new Promise<RawBar[]>((resolve, reject) => {
				const timer = setTimeout(() => {
					pending.delete(request_id);
					reject(
						new Error(`timeseries timeout for ${symbol} ${interval}`),
					);
				}, 20000);
				pending.set(request_id, { chunks: [], resolve, reject, timer });
				socket.send(
					JSON.stringify({
						request_id,
						command: "timeseries",
						payload: {
							symbol,
							interval,
							session: "RTH",
							hint: `rows=${rows}`,
						},
					}),
				);
			});

			const toSec = (v: Date | number) =>
				v instanceof Date
					? Math.floor(v.getTime() / 1000)
					: Number(v) > 1e12
						? Math.floor(Number(v) / 1000)
						: Number(v);
			const from = periodParams?.from != null ? toSec(periodParams.from) : null;
			const to = periodParams?.to != null ? toSec(periodParams.to) : null;
			const filtered =
				from != null &&
				to != null &&
				Number.isFinite(from) &&
				Number.isFinite(to)
					? bars.filter((b) => b.time >= from && b.time <= to)
					: bars;
			return barsToUDF(filtered.length ? filtered : bars);
		},

		resolveSymbol(
			symbolName: string,
			onResolve: OnSymbolChangeEventHandler,
			onError: (error: string) => void,
		) {
			const key = fullSymbolKey(symbolName);
			const meta = DEMO_SYMBOLS.find((s) => s.key === key);
			if (!meta) {
				onError?.(
					`Demo feed only supports: ${DEMO_SYMBOLS.map((s) => s.key).join(", ")}`,
				);
				return;
			}
			onResolve({
				exchange: meta.exchange,
				// `segment` is required: the SDK rebuilds the exchange:segment:symbol
				// key from these fields, and omitting it yields "BYBIT:undefined:…"
				// which the server won't answer.
				segment: meta.segment,
				symbol: meta.symbol,
				name: meta.description,
				ticker: meta.symbol,
				full_name: meta.key,
				description: meta.description,
				type: "crypto",
				asset_type: "CRYPTO",
				session: "24x7",
				timezone: "UTC",
				has_intraday: true,
				has_daily: true,
				supported_resolutions: ["1m", "5m", "15m", "1h", "4h", "1D"],
				tick_size: meta.tick_size,
				display_tick_size: meta.tick_size,
				max_tick_precision: meta.max_tick_precision,
				data_status: "streaming",
				delay_seconds: 0,
				tradeable: true,
				quote_currency: "USDT",
				// exchange_info (hours / valid_intervals) is consumed by the
				// symbol-switch path; omitting it crashes setSymbol.
				exchange_info: {
					name: "bybit",
					code: "BYBIT",
					zone: "UTC",
					hours: Array.from({ length: 7 }, () => ({ open: true })),
					valid_intervals: ["1m", "5m", "15m", "1h", "4h", "1D"],
				},
			} as SymbolInfo);
		},

		subscribeTicks(
			symbolInfo: SymbolInfo,
			_resolution: string | Resolution,
			onRealtimeCallback: RealtimeCallback,
			subscriberUID: string,
		) {
			const symbolKey = fullSymbolKey(symbolInfo);
			tickSubs.set(subscriberUID, { symbolKey, callback: onRealtimeCallback });
			ensureWs().then((socket) =>
				socket.send(
					JSON.stringify({
						command: "SUBSCRIBE",
						channel: "trade",
						payload: [symbolKey],
					}),
				),
			);
		},

		unsubscribeTicks(subscriberUID: string) {
			const sub = tickSubs.get(subscriberUID);
			tickSubs.delete(subscriberUID);
			if (!sub || !ws || ws.readyState !== WebSocket.OPEN) return;
			const stillNeeded = [...tickSubs.values()].some(
				(s) => s.symbolKey === sub.symbolKey,
			);
			if (!stillNeeded) {
				ws.send(
					JSON.stringify({
						command: "UNSUBSCRIBE",
						channel: "trade",
						payload: [sub.symbolKey],
					}),
				);
			}
		},

		searchSymbols(
			userInput: string,
			_exchange: string,
			_symbolType: string,
			onResult: (result: any) => void,
		) {
			(async () => {
				try {
					if (searchController) searchController.abort();
					searchController = new AbortController();
					const url = new URL(SEARCH_URL);
					url.searchParams.set("q", userInput);
					const res = await fetch(url, { signal: searchController.signal });
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					const data = await res.json();
					const items: any[] = [];
					if (data.status === 200 && data.payload?.results) {
						for (const result of data.payload.results) {
							const collect = (item: any) => {
								const segment = item.segment || "FUTURE";
								const key = `${item.exchange}:${segment}:${item.symbol}`;
								items.push({
									symbol: item.symbol,
									key,
									full_name: key,
									description: item.name,
									exchange: item.exchange,
									segment,
									type: String(item.asset_type || "crypto").toLowerCase(),
									ticker: item.symbol,
								});
							};
							if (result.item.is_group && result.item.members) {
								result.item.members.forEach((m: any) => collect(m.item));
							} else {
								collect(result.item);
							}
						}
					}
					onResult({ searchInProgress: false, items });
				} catch (err: any) {
					if (err?.name === "AbortError") return;
					onResult({ searchInProgress: false, items: [] });
				}
			})();
		},

		// Called by the demo components on teardown to release the socket/timers.
		destroy(): void {
			destroyed = true;
			if (searchController) {
				searchController.abort();
				searchController = null;
			}
			for (const p of pending.values()) {
				clearTimeout(p.timer);
				p.reject(new Error("datafeed destroyed"));
			}
			pending.clear();
			tickSubs.clear();
			if (pingTimer) {
				clearInterval(pingTimer);
				pingTimer = null;
			}
			if (ws) {
				try {
					ws.close();
				} catch {
					/* ignore */
				}
				ws = null;
			}
			ready = null;
			void destroyed;
		},
	};
};
