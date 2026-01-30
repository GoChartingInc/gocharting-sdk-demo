import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import * as GoChartingSDK from "@gocharting/chart-sdk";
import { createChartDatafeed } from "@/utils/chart-datafeed";
import type {
	ChartInstance,
	ChartConfig,
	Order,
	Trade,
	Position,
	OrderSide,
	Datafeed,
	SymbolInfo,
} from "@gocharting/chart-sdk";
import "./ChartSDKAdvanced2.scss";

// Extract the appCallback type from ChartConfig
type AppCallback = NonNullable<ChartConfig["appCallback"]>;

// Extended Order type with hidden flag
interface ExtendedOrder extends Order {
	hidden?: boolean;
}

/**
 * Helper function to create a proper SymbolInfo object for demo trading
 */
const createDemoSymbolInfo = (
	symbol: string,
	exchange: string = "BYBIT",
	segment: string = "FUTURE"
): SymbolInfo => {
	const cleanSymbol = symbol.replace(/^.*:/, ""); // Remove exchange prefix if present
	const fullName = `${exchange}:${segment}:${cleanSymbol}`;

	return {
		// Required fields
		symbol: cleanSymbol,
		full_name: fullName,
		description: `${cleanSymbol} Perpetual Futures`,
		exchange: exchange,
		type: "crypto",
		session: "24x7",
		timezone: "Etc/UTC",
		ticker: cleanSymbol,
		has_intraday: true,
		quote_currency: "USDT",
		supported_resolutions: ["1", "5", "15", "30", "60", "240", "1D", "1W"],

		// Optional fields
		segment: segment,
		tick_size: 0.01,
		contract_size: 1,
	};
};

interface SecurityData {
	exchange?: string;
	symbol?: string;
	full_name?: string;
	productType?: string;
	segment?: string;
}

interface OrderDetails {
	orderId?: string;
	price?: number;
	size?: number;
	quantity?: number;
	productId?: string;
	orderType?: string;
	side?: OrderSide;
	takeProfit?: number | string | null;
	stopLoss?: number | string | null;
	stopPrice?: number | null;
	symbol?: string;
}

interface DemoAccount {
	id: string;
	name: string;
	balance: number;
	currency: string;
	broker?: string;
	leverage?: number;
	marginUsed?: number;
	marginAvailable?: number;
	account_id?: string;
	AccountID?: string;
	AccountType?: string;
	label?: string;
	equity?: number;
	margin?: number;
	freeMargin?: number;
}

// Watchlist symbols
const WATCHLIST_SYMBOLS = [
	{ symbol: "BYBIT:FUTURE:BTCUSDT", name: "BTCUSDT" },
	{ symbol: "BYBIT:FUTURE:ETHUSDT", name: "ETHUSDT" },
	{ symbol: "BYBIT:FUTURE:SOLUSDT", name: "SOLUSDT" },
	{ symbol: "BYBIT:FUTURE:XRPUSDT", name: "XRPUSDT" },
];

export const ChartSDKAdvanced2 = () => {
	const chartContainerRef = useRef<HTMLDivElement>(null);
	const chartInstanceRef = useRef<ChartInstance | null>(null);
	const chartWrapperRef = useRef<GoChartingSDK.ChartWrapper | null>(null);
	const datafeedRef = useRef<Datafeed | null>(null);
	const currentSymbol = useRef<string>("BYBIT:FUTURE:BTCUSDT");

	// Trading data refs
	const currentAccountList = useRef<DemoAccount[]>([
		{
			id: "demo-account-1",
			name: "Demo Trading Account",
			balance: 100000,
			currency: "USDT",
			broker: "demo",
			leverage: 10,
			marginUsed: 0,
			marginAvailable: 100000,
		},
	]);
	const currentOrderBook = useRef<Order[]>([]);
	const currentTradeBook = useRef<Trade[]>([]);
	const currentPositions = useRef<Position[]>([]);

	// Ref to hold the latest app callback (to avoid stale closure in chart)
	const handleAppCallbackRef = useRef<AppCallback | null>(null);

	// UI State
	const [status, setStatus] = useState<string>("Initializing chart...");
	const [selectedSymbol, setSelectedSymbol] = useState<string>(
		"BYBIT:FUTURE:BTCUSDT"
	);
	const [activeTab, setActiveTab] = useState<
		"positions" | "orders" | "closed"
	>("positions");
	const [symbolPrices, setSymbolPrices] = useState<Record<string, number>>(
		{}
	);
	const [closedPositions, setClosedPositions] = useState<any[]>([]);
	// Force update counter to trigger re-renders when refs change
	const [, forceUpdate] = useState(0);
	const triggerUpdate = useCallback(() => forceUpdate((n) => n + 1), []);

	// Trading inputs
	const [quantity, setQuantity] = useState<number>(1);
	const [stopLoss, setStopLoss] = useState<string>("");
	const [takeProfit, setTakeProfit] = useState<string>("");
	const [orderType, setOrderType] = useState<"market" | "limit">("market");
	const [limitPrice, setLimitPrice] = useState<string>("");
	const [pnlMultiplier, setPnlMultiplier] = useState<number>(1);

	// Helper methods
	const updateChartBrokerData = useCallback(() => {
		if (!chartInstanceRef.current) {
			console.warn("Chart instance not available");
			return;
		}

		// Filter out hidden orders for chart display
		const visibleOrders = currentOrderBook.current.filter(
			(order) => !(order as ExtendedOrder).hidden
		);

		const demoBrokerData: GoChartingSDK.BrokerAccountData = {
			accountList: currentAccountList.current,
			orderBook: visibleOrders,
			tradeBook: currentTradeBook.current,
			positions: currentPositions.current,
		};

		try {
			chartInstanceRef.current.setBrokerAccounts(demoBrokerData);
			triggerUpdate(); // Force UI re-render
		} catch (error) {
			console.error("❌ Failed to update chart broker data:", error);
		}
	}, [triggerUpdate]);

	const setupDemoBrokerData = (chartInstance: ChartInstance) => {
		const demoBrokerData: GoChartingSDK.BrokerAccountData = {
			accountList: currentAccountList.current,
			orderBook: currentOrderBook.current,
			tradeBook: currentTradeBook.current,
			positions: currentPositions.current,
		};

		try {
			chartInstance.setBrokerAccounts(demoBrokerData);
			setStatus("🏦 Demo trading data loaded");
		} catch (error) {
			console.error("❌ Failed to set broker data:", error);
			setStatus("❌ Failed to load trading data");
		}
	};

	const getCurrentLTP = useCallback(
		(symbol?: string) => {
			// Get current price from symbol prices or use default
			const symbolName = symbol || currentSymbol.current.split(":")[2];
			return symbolPrices[symbolName] || 50000;
		},
		[symbolPrices]
	);

	// Close position with P&L calculation
	const closePosition = useCallback(
		(positionId: string) => {
			console.log("🔴 Close position:", positionId);
			const index = currentPositions.current.findIndex(
				(p) => p.id === positionId
			);
			if (index >= 0) {
				const position = currentPositions.current[index];

				// Extract symbol name for LTP lookup
				const symbolParts = (position.symbol || "").split(":");
				const baseSymbol =
					symbolParts[symbolParts.length - 1] || position.symbol;

				// Get exit price from price cache
				const exitPrice =
					symbolPrices[baseSymbol] || position.price || 50000;
				const avgPrice = position.price || 0;
				const size = Math.abs(position.size || 0);
				const isBuy = position.size > 0;
				const pnl = isBuy
					? (exitPrice - avgPrice) * size
					: (avgPrice - exitPrice) * size;

				// Create closed position record
				const closedPosition = {
					...position,
					exitPrice: exitPrice,
					pnl: pnl,
					closedAt: new Date().toLocaleTimeString(),
				};

				// Add to closed positions
				setClosedPositions((prev) => [closedPosition, ...prev]);

				// Remove from open positions
				currentPositions.current.splice(index, 1);

				updateChartBrokerData();
				setStatus(
					`Position ${positionId} closed with P&L: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}`
				);
			}
		},
		[symbolPrices, updateChartBrokerData]
	);

	// Cancel order
	const cancelOrder = useCallback(
		(orderId: string) => {
			console.log("🔴 Cancel order:", orderId);
			const index = currentOrderBook.current.findIndex(
				(o) => o.orderId === orderId
			);
			if (index >= 0) {
				currentOrderBook.current.splice(index, 1);
				updateChartBrokerData();
				setStatus(`Order ${orderId} cancelled`);
			} else {
				console.warn("Order not found:", orderId);
			}
		},
		[updateChartBrokerData]
	);

	// Hide order from chart display
	const hideOrder = useCallback(
		(orderId: string) => {
			console.log("👁️ Hide order:", orderId);
			const order = currentOrderBook.current.find(
				(o) => o.orderId === orderId
			) as ExtendedOrder | undefined;
			if (order) {
				order.hidden = true;
				updateChartBrokerData();
				setStatus(`Order ${orderId} hidden from chart`);
			}
		},
		[updateChartBrokerData]
	);

	// Unhide order
	const unhideOrder = useCallback(
		(orderId: string) => {
			console.log("👁️ Unhide order:", orderId);
			const order = currentOrderBook.current.find(
				(o) => o.orderId === orderId
			) as ExtendedOrder | undefined;
			if (order) {
				order.hidden = false;
				updateChartBrokerData();
				setStatus(`Order ${orderId} shown on chart`);
			}
		},
		[updateChartBrokerData]
	);

	// Remove order from order book
	const removeOrderFromOrderBook = useCallback(
		(orderId: string) => {
			console.log("🗑️ Remove order:", orderId);
			const orderIndex = currentOrderBook.current.findIndex(
				(order) => order.orderId === orderId
			);
			if (orderIndex !== -1) {
				currentOrderBook.current.splice(orderIndex, 1);
				updateChartBrokerData();
			} else {
				console.warn("Order not found:", orderId);
			}
		},
		[updateChartBrokerData]
	);

	// Modify order in order book
	const modifyOrderInOrderBook = useCallback(
		(orderData: any) => {
			console.log("✏️ Modify order:", orderData);
			const order = orderData.order || orderData;
			const orderId = order.orderId || orderData.orderId;

			const orderIndex = currentOrderBook.current.findIndex(
				(o) => o.orderId === orderId
			);

			if (orderIndex !== -1) {
				const existingOrder = currentOrderBook.current[orderIndex];

				// Handle specific update types
				if (order.update === "SHAPE_MODIFY") {
					switch (order.updateType) {
						case "TAKE_PROFIT":
						case "NEW_TAKE_PROFIT":
							existingOrder.takeProfit = order.takeProfit;
							break;
						case "STOP_LOSS":
						case "NEW_STOP_LOSS":
							existingOrder.stopLoss = order.stopLoss;
							break;
						case "DELETE_TAKE_PROFIT":
							existingOrder.takeProfit = null;
							break;
						case "DELETE_STOP_LOSS":
							existingOrder.stopLoss = null;
							break;
						case "LIMIT_PRICE":
							existingOrder.price = order.price;
							break;
						default:
							if (order.price !== undefined)
								existingOrder.price = order.price;
							if (order.size !== undefined) {
								existingOrder.size = order.size;
								existingOrder.remainingSize = order.size;
							}
					}
				} else if (order.update === "DELETE_SL") {
					existingOrder.stopLoss = null;
				} else if (order.update === "DELETE_TP") {
					existingOrder.takeProfit = null;
				} else {
					// Standard modifications
					if (order.price !== undefined)
						existingOrder.price = order.price;
					if (order.size !== undefined) {
						existingOrder.size = order.size;
						existingOrder.remainingSize = order.size;
					}
					if (order.takeProfit !== undefined)
						existingOrder.takeProfit = order.takeProfit;
					if (order.stopLoss !== undefined)
						existingOrder.stopLoss = order.stopLoss;
				}

				existingOrder.modifiedAt = new Date().getTime();
				updateChartBrokerData();
				setStatus(`Order ${orderId} modified`);
			}
		},
		[updateChartBrokerData]
	);

	// Update order TP/SL when position TP/SL is modified
	const updateOrderTPSL = useCallback(
		(
			productId: string,
			symbol: string,
			updates: { stopLoss?: number | null; takeProfit?: number | null }
		) => {
			console.log("🔍 ===== UPDATE ORDER TP/SL DEBUG =====");
			console.log("📝 Looking for order with productId:", productId);
			console.log("📝 Symbol:", symbol);
			console.log("📝 Updates to apply:", updates);

			if (currentOrderBook.current.length === 0) {
				console.log("📝 No orders in order book to update");
				return;
			}

			// Find matching orders for this position
			const matchingOrders = currentOrderBook.current.filter(
				(order) =>
					(order.productId === productId ||
						order.symbol === symbol) &&
					order.status === "open"
			);

			if (matchingOrders.length === 0) {
				console.log(
					"📝 No matching open orders found for this position"
				);
				return;
			}

			console.log(`📝 Found ${matchingOrders.length} matching order(s)`);

			matchingOrders.forEach((order) => {
				if (updates.stopLoss !== undefined) {
					console.log(
						`📉 Adding stopLoss ${updates.stopLoss} to order ${order.orderId}`
					);
					order.stopLoss = updates.stopLoss;
				}
				if (updates.takeProfit !== undefined) {
					console.log(
						`📈 Adding takeProfit ${updates.takeProfit} to order ${order.orderId}`
					);
					order.takeProfit = updates.takeProfit;
				}
				order.modifiedAt = new Date().getTime();
			});

			console.log("🔍 ===== END UPDATE ORDER TP/SL DEBUG =====");
		},
		[]
	);

	// Modify position (for TP/SL line drag events)
	const modifyPositionInPositions = useCallback(
		(positionData: any) => {
			console.log("🔍 ===== MODIFY POSITION DEBUG =====");
			console.log(
				"📝 Modify position data received:",
				JSON.stringify(positionData, null, 2)
			);

			const position = positionData.position || positionData;
			const positionId = position.id || positionData.id;

			console.log("📝 Extracted position ID:", positionId);
			console.log("📝 Update type:", position.update);
			console.log("📝 Update subtype:", position.updateType);

			const positionIndex = currentPositions.current.findIndex(
				(p) => p.id === positionId
			);

			if (positionIndex !== -1) {
				const existingPosition =
					currentPositions.current[positionIndex];
				console.log(
					"📝 Found existing position:",
					JSON.stringify(existingPosition, null, 2)
				);

				if (position.update === "SHAPE_MODIFY") {
					switch (position.updateType) {
						case "DELETE_STOP_LOSS":
							console.log("🗑️ Deleting stop loss from position");
							(existingPosition as any).stopLoss = null;
							break;
						case "DELETE_TAKE_PROFIT":
							console.log(
								"🗑️ Deleting take profit from position"
							);
							(existingPosition as any).takeProfit = null;
							break;
						case "STOP_LOSS":
						case "NEW_STOP_LOSS":
							console.log(
								"📉 Updating position stop loss:",
								position.stopLoss
							);
							(existingPosition as any).stopLoss =
								position.stopLoss;
							// Also update associated orders
							updateOrderTPSL(
								existingPosition.productId,
								existingPosition.symbol,
								{ stopLoss: position.stopLoss }
							);
							break;
						case "TAKE_PROFIT":
						case "NEW_TAKE_PROFIT":
							console.log(
								"📈 Updating position take profit:",
								position.takeProfit
							);
							(existingPosition as any).takeProfit =
								position.takeProfit;
							// Also update associated orders
							updateOrderTPSL(
								existingPosition.productId,
								existingPosition.symbol,
								{ takeProfit: position.takeProfit }
							);
							break;
						default:
							console.log(
								"📝 Other position shape modification:",
								position.updateType
							);
							if (position.takeProfit !== undefined) {
								(existingPosition as any).takeProfit =
									position.takeProfit;
							}
							if (position.stopLoss !== undefined) {
								(existingPosition as any).stopLoss =
									position.stopLoss;
							}
					}
				} else {
					console.log(
						"📝 Standard position modification (no update type)"
					);
					if (position.takeProfit !== undefined) {
						(existingPosition as any).takeProfit =
							position.takeProfit;
					}
					if (position.stopLoss !== undefined) {
						(existingPosition as any).stopLoss = position.stopLoss;
					}
				}

				console.log(
					"✅ Position modified:",
					JSON.stringify(existingPosition, null, 2)
				);

				updateChartBrokerData();
				setStatus(`Position ${positionId} modified`);
			} else {
				console.warn(
					"Position not found for modification:",
					positionId
				);
			}
			console.log("🔍 ===== END MODIFY POSITION DEBUG =====");
		},
		[updateChartBrokerData, updateOrderTPSL]
	);

	// Symbol switching
	const handleSymbolChange = (symbol: string) => {
		setSelectedSymbol(symbol);
		currentSymbol.current = symbol;

		if (chartInstanceRef.current) {
			try {
				chartInstanceRef.current.setSymbol(symbol);
			} catch (error) {
				console.error("Failed to change symbol:", error);
			}
		}
	};

	// Trading handlers
	const handleBuyOrder = () => {
		placeDemoOrder("buy");
	};

	const handleSellOrder = () => {
		placeDemoOrder("sell");
	};

	const handleResetBrokerData = () => {
		currentOrderBook.current = [];
		currentTradeBook.current = [];
		currentPositions.current = [];
		setClosedPositions([]);
		updateChartBrokerData();
		setStatus("🔄 Broker data reset");
	};

	const placeDemoOrder = (side: OrderSide) => {
		console.log(`🚀 [Trading Panel] ${side.toUpperCase()} button clicked`);

		const ltp = getCurrentLTP();

		// Create orderData in the same format as HTML reference (nested order structure)
		// This matches the format used by chart SDK's appCallback
		const orderData = {
			order: {
				productId: currentSymbol.current,
				price: orderType === "limit" ? parseFloat(limitPrice) || 0 : 0,
				stopPrice: "",
				takeProfit: takeProfit || "",
				stopLoss: stopLoss || "",
				trailingSLSpread: "",
				size: quantity || 1,
				task: "placement",
				side: side,
				orderType: orderType,
				pnlMultiplier: pnlMultiplier || 1,
			},
			security: {
				symbol: currentSymbol.current.replace("BYBIT:FUTURE:", ""),
				full_name: currentSymbol.current,
				exchange: "BYBIT",
				segment: "FUTURE",
				quote_currency: "USDT",
			},
			ltp: ltp,
		};

		console.log(
			`🚀 [Trading Panel] Triggering PLACE_ORDER event:`,
			orderData
		);

		// Use the same handleTradingEvent method as chart context menu
		handleAppCallback("PLACE_ORDER", orderData);
	};

	const createPositionAndTrade = (newOrder: Order, ltp: number) => {
		console.log("🔍 ===== CREATE POSITION AND TRADE DEBUG =====");
		console.log(
			"📝 Creating position and trade for order:",
			newOrder.orderId
		);

		// Create trade
		const tradeId = `TRADE_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
		const executionPrice = ltp; // Always use LTP for execution
		console.log("📝 Using LTP for trade execution:", executionPrice);

		// Create trade matching HTML reference implementation
		const newTrade: Trade = {
			tradeId: tradeId,
			orderId: newOrder.orderId,
			datetime: new Date(),
			timeStamp: new Date().getTime(),
			price: executionPrice,
			size: newOrder.size,
			tradeSize: newOrder.size, // Alias for size, used by HTML reference
			side: newOrder.side,
			productId: newOrder.productId,
			status: "filled",
			cost: executionPrice * newOrder.size,
			fee: {
				currency: "USDT",
				cost: executionPrice * newOrder.size * 0.001, // 0.1% fee
				rate: 0.001,
			},
			exchange: newOrder.exchange,
			symbol: newOrder.symbol,
			key: `demo-${newOrder.productId}-${tradeId}`,
			broker: "demo",
			productType: "FUTURE",
			security: newOrder.security,
		} as Trade;

		console.log("📝 Created trade:", JSON.stringify(newTrade, null, 2));
		currentTradeBook.current.push(newTrade);

		// Create or update position
		const existingPositionIndex = currentPositions.current.findIndex(
			(p) =>
				p.symbol === newOrder.symbol &&
				p.productId === newOrder.productId
		);

		if (existingPositionIndex >= 0) {
			// Update existing position
			const existingPosition =
				currentPositions.current[existingPositionIndex];
			const oldSize = existingPosition.size;
			const oldPrice = existingPosition.price;

			if (
				(newOrder.side === "buy" && oldSize > 0) ||
				(newOrder.side === "sell" && oldSize < 0)
			) {
				// Same side - add to position using LTP
				const totalSize = Math.abs(oldSize) + newOrder.size;
				const avgPrice =
					(oldPrice * Math.abs(oldSize) +
						executionPrice * newOrder.size) /
					totalSize;
				existingPosition.size =
					newOrder.side === "buy" ? totalSize : -totalSize;
				existingPosition.price = avgPrice;
				console.log(
					"📝 Updated existing position (same side):",
					JSON.stringify(existingPosition, null, 2)
				);
			} else {
				// Opposite side - reduce position
				const newSize =
					Math.abs(oldSize) -
					newOrder.size *
						(newOrder.side === "buy" && oldSize < 0 ? 1 : 1);
				if (Math.abs(newSize) < 0.0001) {
					// Position closed
					const closedPos = {
						...existingPosition,
						exitPrice: executionPrice,
						closedAt: new Date().toLocaleTimeString(),
						pnl:
							(executionPrice - existingPosition.price) *
							Math.abs(existingPosition.size),
					};
					setClosedPositions((prev) => [closedPos, ...prev]);
					currentPositions.current.splice(existingPositionIndex, 1);
					console.log("📝 Position closed and removed");
				} else {
					// Update position size
					currentPositions.current[existingPositionIndex] = {
						...existingPosition,
						size: existingPosition.size > 0 ? newSize : -newSize,
					};
				}
			}
		} else {
			// Create new position using LTP - matching HTML reference implementation
			const positionId = `POS_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
			const newPosition: Position = {
				id: positionId,
				size: newOrder.side === "buy" ? newOrder.size : -newOrder.size,
				size_currency: newOrder.size,
				price: executionPrice, // Use LTP for position price
				amount: executionPrice * newOrder.size,
				productId: newOrder.productId,
				broker: "demo",
				productType: "FUTURE",
				currency: "USDT",
				underlying: newOrder.symbol,
				symbol: newOrder.symbol,
				segment: "FUTURE",
				exchange: newOrder.exchange,
				key: `demo-${newOrder.productId}-${positionId}`,
				isGC: true,
				unPnl: 0,
				rPnl: 0,
				pnl: 0,
				security: newOrder.security,
				paperTraderKey: null,
				// Include TP/SL from the original order
				takeProfit: newOrder.takeProfit,
				stopLoss: newOrder.stopLoss,
				// Additional properties for feature parity with HTML reference
				showStopLossButton: true,
				showTakeProfitButton: true,
				pnlMultiplier: (newOrder as any).pnlMultiplier || 1,
			} as Position;

			console.log(
				"📝 Created new position:",
				JSON.stringify(newPosition, null, 2)
			);
			currentPositions.current.push(newPosition);
		}

		// Update order status to filled for market orders
		newOrder.status = "filled";
		newOrder.filledSize = newOrder.size;
		newOrder.remainingSize = 0;
		newOrder.fillPrice = executionPrice;
		newOrder.avgFillPrice = executionPrice;

		console.log("📝 Updated order status to filled");
		console.log("📝 Total positions:", currentPositions.current.length);
		console.log("📝 Total trades:", currentTradeBook.current.length);
		console.log("🔍 ===== END CREATE POSITION AND TRADE DEBUG =====");
	};

	// Add order to order book from chart (PLACE_ORDER event)
	const addOrderToOrderBook = useCallback(
		(orderData: any) => {
			console.log("🔍 ===== ADD ORDER TO ORDER BOOK =====");
			console.log(
				"📝 Raw order data:",
				JSON.stringify(orderData, null, 2)
			);

			if (!chartInstanceRef.current) {
				console.warn("Chart instance not available");
				return;
			}

			// Extract order details from nested structure
			const order = orderData.order || orderData;
			const security = orderData.security || {};
			const ltp = orderData.ltp || getCurrentLTP();

			// Generate unique order ID
			const orderId =
				order.orderId ||
				orderData.orderId ||
				`ORDER_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

			// Create order object with all properties matching HTML reference
			const newOrder: Order = {
				orderId: orderId,
				datetime: new Date(),
				timeStamp: new Date().getTime(),
				lastTradeTimestamp: null,
				status: "open",
				price: order.price || orderData.price || 0,
				size:
					order.size ||
					order.quantity ||
					orderData.quantity ||
					orderData.size ||
					0,
				productId:
					order.productId ||
					security.full_name ||
					orderData.symbol ||
					currentSymbol.current,
				remainingSize:
					order.size ||
					order.quantity ||
					orderData.quantity ||
					orderData.size ||
					0,
				orderType:
					order.orderType ||
					orderData.orderType ||
					orderData.type ||
					"limit",
				side: (order.side || orderData.side || "buy") as OrderSide,
				cost: null,
				trades: [],
				fee: { currency: "USDT", cost: 0, rate: 0 },
				info: {},
				fillPrice: null,
				avgFillPrice: null,
				filledSize: 0,
				modifiedAt: null,
				exchange: security.exchange || "BYBIT",
				symbol: (
					security.symbol ||
					order.symbol ||
					orderData.symbol ||
					currentSymbol.current
				).replace("BYBIT:FUTURE:", ""),
				takeProfit: order.takeProfit || orderData.takeProfit || null,
				stopLoss: order.stopLoss || orderData.stopLoss || null,
				isGC: true,
				paperTraderKey: null,
				key: `demo-${order.productId || security.full_name || orderData.symbol || currentSymbol.current}-${orderId}`,
				validity: "DAY",
				commissions: 0,
				broker: "demo",
				stopPrice: order.stopPrice || orderData.stopPrice || null,
				productType: "FUTURE",
				rejReason: null,
				security: createDemoSymbolInfo(
					(orderData.symbol || currentSymbol.current).replace(
						"BYBIT:FUTURE:",
						""
					),
					"BYBIT",
					"FUTURE"
				),
				userTag: null,
				segment: "FUTURE",
				currency: "USDT",
				// Additional properties for feature parity with HTML reference
				showStopLossButton: true,
				showTakeProfitButton: true,
				pnlMultiplier:
					order.pnlMultiplier || orderData.pnlMultiplier || 1,
			} as Order;

			// Add to order book
			currentOrderBook.current.push(newOrder);

			// Check if market order
			const isMarketOrder =
				(order.orderType || orderData.orderType || "").toLowerCase() ===
				"market";

			if (isMarketOrder) {
				console.log("🚀 Market order - creating position and trade...");
				createPositionAndTrade(newOrder, ltp);
				// Handle TP/SL for market orders
				handleMarketOrderWithTPSL(newOrder, order, ltp);
			}

			updateChartBrokerData();
			console.log("✅ Order added to order book");
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[getCurrentLTP, updateChartBrokerData]
	);

	// Handle market orders with TP/SL - create additional orders
	const handleMarketOrderWithTPSL = useCallback(
		(originalOrder: Order, orderDetails: any, _ltp: number) => {
			console.log("🔍 Checking for TP/SL on market order...");

			const hasTP =
				orderDetails.takeProfit &&
				parseFloat(orderDetails.takeProfit) > 0;
			const hasSL =
				orderDetails.stopLoss && parseFloat(orderDetails.stopLoss) > 0;

			if (!hasTP && !hasSL) {
				console.log("No TP/SL specified");
				return;
			}

			const oppositeSide: OrderSide =
				originalOrder.side === "buy" ? "sell" : "buy";

			// Place Take Profit order (Limit) - matching HTML reference implementation
			if (hasTP) {
				const tpOrderId = `TP_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
				const tpOrder: Order = {
					...originalOrder,
					orderId: tpOrderId,
					price: parseFloat(orderDetails.takeProfit),
					orderType: "limit",
					side: oppositeSide,
					takeProfit: null,
					stopLoss: null,
					key: `demo-${originalOrder.productId}-${tpOrderId}`,
					userTag: `takeProfit_for_${originalOrder.orderId}`,
					// Link TP order to parent order for feature parity
					parentOrderId: originalOrder.orderId,
					showStopLossButton: true,
					showTakeProfitButton: true,
					pnlMultiplier: (originalOrder as any).pnlMultiplier || 1,
				} as Order;
				currentOrderBook.current.push(tpOrder);
				setStatus(
					`🎯 Take Profit order placed @ $${orderDetails.takeProfit}`
				);
			}

			// Place Stop Loss order (Stop) - matching HTML reference implementation
			if (hasSL) {
				const slOrderId = `SL_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
				const slOrder: Order = {
					...originalOrder,
					orderId: slOrderId,
					price: 0,
					stopPrice: parseFloat(orderDetails.stopLoss),
					orderType: "stop",
					side: oppositeSide,
					takeProfit: null,
					stopLoss: null,
					key: `demo-${originalOrder.productId}-${slOrderId}`,
					userTag: `stopLoss_for_${originalOrder.orderId}`,
					// Link SL order to parent order for feature parity
					parentOrderId: originalOrder.orderId,
					showStopLossButton: true,
					showTakeProfitButton: true,
					pnlMultiplier: (originalOrder as any).pnlMultiplier || 1,
				} as Order;
				currentOrderBook.current.push(slOrder);
				setStatus(
					`🛑 Stop Loss order placed @ $${orderDetails.stopLoss}`
				);
			}

			// Update chart with new TP/SL orders
			updateChartBrokerData();
		},
		[updateChartBrokerData]
	);

	// App callback handler
	const handleAppCallback: AppCallback = useCallback(
		(eventType, message, _onClose) => {
			console.log("📞 App Callback:", eventType, message);
			const msg = message as any;

			switch (eventType) {
				case "CREATE_ORDER": {
					console.log("📝 Order creation requested from chart:", msg);
					setStatus(
						`📝 Order creation: ${msg.side} ${msg.quantity || "N/A"} @ ${msg.price || "Market"}`
					);
					break;
				}
				case "PLACE_ORDER": {
					console.log("📝 Order placed from chart:", msg);
					const order = msg.order || msg;

					// Check if this is an exit position request (X button on position)
					if (order.exitPosition) {
						console.log(
							"🔴 Exit position requested from chart X button"
						);
						const positionId =
							order.id || order.positionId || order.position?.id;
						if (positionId) {
							closePosition(positionId);
						} else {
							console.warn(
								"Could not find position ID for exit:",
								msg
							);
						}
					} else {
						addOrderToOrderBook(msg);
						setStatus(
							`✅ Order placed: ${msg.side || order.side} @ ${msg.price || order.price || "Market"}`
						);
					}
					break;
				}
				case "CANCEL_ORDER": {
					console.log(
						"❌ Order cancelled from chart:",
						JSON.stringify(msg, null, 2)
					);
					const orderId =
						msg.orderId ||
						msg.order?.orderId ||
						msg.id ||
						msg.order?.id;
					if (orderId) {
						removeOrderFromOrderBook(orderId);
						setStatus(`🗑️ Order cancelled: ${orderId}`);
					} else {
						console.error(
							"No orderId found in cancel order message:",
							msg
						);
						setStatus(
							"❌ Failed to cancel order: No order ID found"
						);
					}
					break;
				}
				case "MODIFY_ORDER": {
					console.log("✏️ Order modified from chart:", msg);
					modifyOrderInOrderBook(msg);
					setStatus(
						`✏️ Order modified: ${msg.orderId || msg.order?.orderId}`
					);
					break;
				}
				case "MODIFY_POSITION": {
					console.log("✏️ Position modified from chart:", msg);
					modifyPositionInPositions(msg);
					setStatus(
						`✏️ Position modified: ${msg.position?.id || msg.id}`
					);
					break;
				}
				case "CLOSE_POSITION": {
					console.log("🔴 Position close requested from chart:", msg);
					const positionId =
						msg.position?.id || msg.id || msg.positionId;
					if (positionId) {
						closePosition(positionId);
					} else {
						console.warn(
							"Could not extract position ID from close event:",
							msg
						);
					}
					break;
				}
				case "OPEN_TRADING_WIDGET":
					console.log("🎛️ Trading widget opened from chart");
					setStatus("🎛️ Trading widget opened");
					break;
				default:
					console.log(`🔔 Chart event: ${eventType}`, msg);
					break;
			}
		},
		[
			addOrderToOrderBook,
			closePosition,
			removeOrderFromOrderBook,
			modifyOrderInOrderBook,
			modifyPositionInPositions,
		]
	);

	// Keep the ref updated with the latest callback
	useEffect(() => {
		handleAppCallbackRef.current = handleAppCallback;
	}, [handleAppCallback]);

	// Real-time price fetching from Bybit API
	useEffect(() => {
		const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT"];

		const fetchPrices = async () => {
			for (const symbol of symbols) {
				try {
					const response = await fetch(
						`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`
					);
					const data = await response.json();
					if (data.result?.list?.[0]) {
						const price = parseFloat(data.result.list[0].lastPrice);
						setSymbolPrices((prev) => ({
							...prev,
							[symbol]: price,
						}));
					}
				} catch (error) {
					console.warn(`Failed to fetch price for ${symbol}:`, error);
				}
			}
		};

		// Initial fetch
		fetchPrices();

		// Fetch every 5 seconds
		const interval = setInterval(fetchPrices, 5000);

		return () => clearInterval(interval);
	}, []);

	// Chart initialization
	useEffect(() => {
		const initChart = async () => {
			try {
				setStatus("Creating chart...");

				// Create datafeed
				const datafeed = createChartDatafeed();
				datafeedRef.current = datafeed;

				const chartConfig = {
					symbol: "BYBIT:FUTURE:BTCUSDT",
					interval: "1D",
					datafeed: datafeed,
					debugLog: true,
					licenseKey: "demo-550e8400-e29b-41d4-a716-446655440000",
					theme: "dark",
					trading: {
						enableTrading: true,
						showReverseButton: false,
					},
					// Use a stable wrapper that calls through the ref to avoid stale closures
					appCallback: (eventType, message, onClose) => {
						console.log(
							"*** APP CALLBACK TRIGGERED ***",
							eventType,
							message
						);
						if (handleAppCallbackRef.current) {
							handleAppCallbackRef.current(
								eventType,
								message,
								onClose
							);
						}
					},
					onReady: (chartInstance) => {
						chartInstanceRef.current = chartInstance;
						setStatus(
							"Chart loaded with advanced trading features!"
						);
						setupDemoBrokerData(chartInstance);
					},
					onError: (error) => {
						console.error("Chart creation error:", error);
						setStatus(
							`❌ Error creating chart: ${typeof error === "string" ? error : error.message}`
						);
					},
				} satisfies ChartConfig;

				chartWrapperRef.current = GoChartingSDK.createChart(
					"#gocharting-chart-container-advanced2",
					chartConfig
				);
			} catch (error) {
				console.error("Error initializing chart:", error);
				setStatus("Failed to initialize chart");
			}
		};

		initChart();

		return () => {
			if (
				chartWrapperRef.current &&
				!chartWrapperRef.current.isDestroyed()
			) {
				chartWrapperRef.current.destroy();
			}
			if (
				datafeedRef.current &&
				typeof datafeedRef.current.destroy === "function"
			) {
				datafeedRef.current.destroy();
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<div className='advanced-trading-container-2'>
			<div className='container'>
				{/* Header */}
				<div className='header'>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							marginBottom: "10px",
						}}
					>
						<h1
							style={{
								alignSelf: "center",
							}}
						>
							📈 GoCharting SDK - Advanced Trading 2
						</h1>
						<Link
							to='/examples'
							style={{
								color: "#4a90e2",
								textDecoration: "none",
								fontSize: "14px",
								fontWeight: "600",
							}}
						>
							← View All Examples
						</Link>
					</div>
					<p>
						Professional Financial Charts with Integrated Trading
						Interface ⚡
					</p>
				</div>

				{/* Trading Panel */}
				<div className='trading-panel'>
					<div className='trading-group'>
						<label htmlFor='quantity'>Quantity</label>
						<input
							type='number'
							id='quantity'
							placeholder='1'
							value={quantity}
							onChange={(e) =>
								setQuantity(Number(e.target.value))
							}
							min='1'
							step='1'
						/>
					</div>

					<div className='trading-group'>
						<label htmlFor='stop-loss'>Stop Loss</label>
						<input
							type='number'
							id='stop-loss'
							placeholder='45000'
							value={stopLoss}
							onChange={(e) => setStopLoss(e.target.value)}
							step='0.01'
						/>
					</div>

					<div className='trading-group'>
						<label htmlFor='take-profit'>Take Profit</label>
						<input
							type='number'
							id='take-profit'
							placeholder='55000'
							value={takeProfit}
							onChange={(e) => setTakeProfit(e.target.value)}
							step='0.01'
						/>
					</div>

					<div className='trading-group'>
						<label htmlFor='order-type'>Order Type</label>
						<select
							id='order-type'
							value={orderType}
							onChange={(e) =>
								setOrderType(
									e.target.value as "market" | "limit"
								)
							}
						>
							<option value='market'>Market</option>
							<option value='limit'>Limit</option>
						</select>
					</div>

					<div className='trading-group'>
						<label htmlFor='limit-price'>Limit Price</label>
						<input
							type='number'
							id='limit-price'
							placeholder='50000'
							value={limitPrice}
							onChange={(e) => setLimitPrice(e.target.value)}
							step='0.01'
							disabled={orderType === "market"}
						/>
					</div>

					<div className='trading-group'>
						<label htmlFor='pnl-multiplier'>PnL Multiplier</label>
						<input
							type='number'
							id='pnl-multiplier'
							placeholder='1'
							value={pnlMultiplier}
							onChange={(e) =>
								setPnlMultiplier(Number(e.target.value))
							}
							min='0.001'
							step='0.001'
						/>
					</div>

					<div className='trading-buttons'>
						<button className='btn buy' onClick={handleBuyOrder}>
							🚀 BUY
						</button>
						<button className='btn sell' onClick={handleSellOrder}>
							📉 SELL
						</button>
						<button
							className='btn secondary'
							onClick={handleResetBrokerData}
						>
							🔄 Reset Broker
						</button>
					</div>
				</div>

				{/* Main Layout: Sidebar + Chart + Account Manager */}
				<div className='main-layout'>
					{/* Sidebar - Symbol Watchlist */}
					<div className='sidebar'>
						<h3>📊 Watchlist</h3>
						<div className='symbol-list'>
							{WATCHLIST_SYMBOLS.map((item) => (
								<button
									key={item.symbol}
									className={`symbol-btn ${selectedSymbol === item.symbol ? "active" : ""}`}
									onClick={() =>
										handleSymbolChange(item.symbol)
									}
								>
									<span className='symbol-name'>
										{item.name}
									</span>
									<span className='symbol-price'>
										{symbolPrices[item.name]
											? `$${symbolPrices[item.name].toFixed(2)}`
											: "--"}
									</span>
								</button>
							))}
						</div>
					</div>

					{/* Chart Area */}
					<div className='chart-area'>
						<div
							ref={chartContainerRef}
							id='gocharting-chart-container-advanced2'
						>
							<div className='loading'>
								Loading advanced trading chart...
							</div>
						</div>

						{/* Account Manager */}
						<div className='account-manager'>
							<div className='account-tabs'>
								<button
									className={`account-tab ${activeTab === "positions" ? "active" : ""}`}
									onClick={() => setActiveTab("positions")}
								>
									📊 Open Positions
								</button>
								<button
									className={`account-tab ${activeTab === "orders" ? "active" : ""}`}
									onClick={() => setActiveTab("orders")}
								>
									📋 Pending Orders
								</button>
								<button
									className={`account-tab ${activeTab === "closed" ? "active" : ""}`}
									onClick={() => setActiveTab("closed")}
								>
									✅ Closed Positions
								</button>
							</div>
							<div className='account-content'>
								{/* Open Positions Panel */}
								{activeTab === "positions" && (
									<div className='account-panel active'>
										<table className='account-table'>
											<thead>
												<tr>
													<th>Instrument</th>
													<th>Type</th>
													<th>Amount</th>
													<th>Avg Price</th>
													<th>Current Price</th>
													<th>P&L</th>
													<th>Actions</th>
												</tr>
											</thead>
											<tbody>
												{currentPositions.current
													.length === 0 ? (
													<tr>
														<td
															colSpan={7}
															className='empty-message'
														>
															No open positions
														</td>
													</tr>
												) : (
													currentPositions.current.map(
														(pos) => {
															const currentPrice =
																getCurrentLTP();
															const pnl =
																(currentPrice -
																	pos.price) *
																Math.abs(
																	pos.size
																);
															const side =
																pos.size > 0
																	? "BUY"
																	: "SELL";
															return (
																<tr
																	key={pos.id}
																>
																	<td>
																		{
																			pos.symbol
																		}
																	</td>
																	<td>
																		{side}
																	</td>
																	<td>
																		{
																			pos.size
																		}
																	</td>
																	<td>
																		$
																		{pos.price.toFixed(
																			2
																		)}
																	</td>
																	<td>
																		$
																		{currentPrice.toFixed(
																			2
																		)}
																	</td>
																	<td
																		className={
																			pnl >=
																			0
																				? "positive"
																				: "negative"
																		}
																	>
																		$
																		{pnl.toFixed(
																			2
																		)}
																	</td>
																	<td>
																		<button
																			className='action-btn close-btn'
																			onClick={() =>
																				closePosition(
																					pos.id
																				)
																			}
																		>
																			Close
																		</button>
																	</td>
																</tr>
															);
														}
													)
												)}
											</tbody>
										</table>
									</div>
								)}

								{/* Pending Orders Panel */}
								{activeTab === "orders" && (
									<div className='account-panel active'>
										<table className='account-table'>
											<thead>
												<tr>
													<th>Instrument</th>
													<th>Type</th>
													<th>Side</th>
													<th>Amount</th>
													<th>Price</th>
													<th>Actions</th>
												</tr>
											</thead>
											<tbody>
												{currentOrderBook.current
													.length === 0 ? (
													<tr>
														<td
															colSpan={6}
															className='empty-message'
														>
															No pending orders
														</td>
													</tr>
												) : (
													currentOrderBook.current.map(
														(order) => {
															const extOrder =
																order as ExtendedOrder;
															return (
																<tr
																	key={
																		order.orderId
																	}
																	style={{
																		opacity:
																			extOrder.hidden
																				? 0.5
																				: 1,
																	}}
																>
																	<td>
																		{
																			order.symbol
																		}
																	</td>
																	<td>
																		{order.orderType.toUpperCase()}
																	</td>
																	<td>
																		{order.side.toUpperCase()}
																	</td>
																	<td>
																		{
																			order.size
																		}
																	</td>
																	<td>
																		$
																		{order.price.toFixed(
																			2
																		)}
																	</td>
																	<td>
																		<button
																			className='action-btn close-btn'
																			onClick={() =>
																				cancelOrder(
																					order.orderId
																				)
																			}
																			style={{
																				marginRight:
																					"4px",
																			}}
																		>
																			Cancel
																		</button>
																		{extOrder.hidden ? (
																			<button
																				className='action-btn'
																				onClick={() =>
																					unhideOrder(
																						order.orderId
																					)
																				}
																				style={{
																					backgroundColor:
																						"#4a90e2",
																				}}
																			>
																				Show
																			</button>
																		) : (
																			<button
																				className='action-btn'
																				onClick={() =>
																					hideOrder(
																						order.orderId
																					)
																				}
																				style={{
																					backgroundColor:
																						"#6c757d",
																				}}
																			>
																				Hide
																			</button>
																		)}
																	</td>
																</tr>
															);
														}
													)
												)}
											</tbody>
										</table>
									</div>
								)}

								{/* Closed Positions Panel */}
								{activeTab === "closed" && (
									<div className='account-panel active'>
										<table className='account-table'>
											<thead>
												<tr>
													<th>Instrument</th>
													<th>Type</th>
													<th>Amount</th>
													<th>Entry Price</th>
													<th>Exit Price</th>
													<th>P&L</th>
													<th>Closed At</th>
												</tr>
											</thead>
											<tbody>
												{closedPositions.length ===
												0 ? (
													<tr>
														<td
															colSpan={7}
															className='empty-message'
														>
															No closed positions
														</td>
													</tr>
												) : (
													closedPositions.map(
														(pos, idx) => {
															const side =
																pos.size > 0
																	? "BUY"
																	: "SELL";
															return (
																<tr key={idx}>
																	<td>
																		{
																			pos.symbol
																		}
																	</td>
																	<td>
																		{side}
																	</td>
																	<td>
																		{Math.abs(
																			pos.size
																		)}
																	</td>
																	<td>
																		$
																		{pos.price.toFixed(
																			2
																		)}
																	</td>
																	<td>
																		$
																		{pos.exitPrice.toFixed(
																			2
																		)}
																	</td>
																	<td
																		className={
																			pos.pnl >=
																			0
																				? "positive"
																				: "negative"
																		}
																	>
																		$
																		{pos.pnl.toFixed(
																			2
																		)}
																	</td>
																	<td>
																		{
																			pos.closedAt
																		}
																	</td>
																</tr>
															);
														}
													)
												)}
											</tbody>
										</table>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>

				<div className='status'>{status}</div>
			</div>
		</div>
	);
};

export default ChartSDKAdvanced2;
