import { useEffect, useRef, useState } from "react";
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

	// UI State
	const [status, setStatus] = useState<string>("Initializing chart...");
	const [selectedSymbol, setSelectedSymbol] = useState<string>(
		"BYBIT:FUTURE:BTCUSDT"
	);
	const [activeTab, setActiveTab] = useState<
		"positions" | "orders" | "closed"
	>("positions");
	const [symbolPrices] = useState<Record<string, number>>({});
	const [closedPositions, setClosedPositions] = useState<any[]>([]);

	// Trading inputs
	const [quantity, setQuantity] = useState<number>(1);
	const [stopLoss, setStopLoss] = useState<string>("");
	const [takeProfit, setTakeProfit] = useState<string>("");
	const [orderType, setOrderType] = useState<"market" | "limit">("market");
	const [limitPrice, setLimitPrice] = useState<string>("");
	const [pnlMultiplier, setPnlMultiplier] = useState<number>(1);

	// Helper methods
	const updateChartBrokerData = () => {
		if (!chartInstanceRef.current) {
			console.warn("Chart instance not available");
			return;
		}

		const demoBrokerData: GoChartingSDK.BrokerAccountData = {
			accountList: currentAccountList.current,
			orderBook: currentOrderBook.current,
			tradeBook: currentTradeBook.current,
			positions: currentPositions.current,
		};

		try {
			chartInstanceRef.current.setBrokerAccounts(demoBrokerData);
		} catch (error) {
			console.error("❌ Failed to update chart broker data:", error);
		}
	};

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

	const getCurrentLTP = () => {
		// Get current price from symbol prices or use default
		const symbolName = currentSymbol.current.split(":")[2];
		return symbolPrices[symbolName] || 50000;
	};

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
		const ltp = getCurrentLTP();
		const orderPrice =
			orderType === "limit" && limitPrice ? parseFloat(limitPrice) : ltp;

		const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
		const productId = `${currentSymbol.current}_${side.toUpperCase()}`;

		const newOrder: Order = {
			orderId: orderId,
			datetime: new Date(),
			timeStamp: new Date().getTime(),
			lastTradeTimestamp: null,
			status: orderType === "market" ? "filled" : "open",
			price: orderType === "limit" ? orderPrice : 0,
			stopPrice: null,
			size: quantity,
			productId: productId,
			remainingSize: orderType === "market" ? 0 : quantity,
			orderType: orderType,
			side: side,
			cost: null,
			trades: [],
			fee: { currency: "USDT", cost: 0.0, rate: 0.0 },
			info: {},
			fillPrice: orderType === "market" ? ltp : null,
			avgFillPrice: orderType === "market" ? ltp : null,
			filledSize: orderType === "market" ? quantity : 0,
			modifiedAt: null,
			exchange: "BYBIT",
			symbol: currentSymbol.current.split(":")[2],
			takeProfit: takeProfit ? parseFloat(takeProfit) : null,
			stopLoss: stopLoss ? parseFloat(stopLoss) : null,
			isGC: true,
			paperTraderKey: null,
			key: `demo-${productId}-${orderId}`,
			validity: "DAY",
			commissions: 0,
			broker: "demo",
			productType: "FUTURE",
			rejReason: null,
			security: createDemoSymbolInfo(
				currentSymbol.current,
				"BYBIT",
				"FUTURE"
			),
			userTag: null,
			segment: "FUTURE",
			currency: "USDT",
		};

		if (orderType === "market") {
			// Create position and trade immediately
			createPositionAndTrade(newOrder, ltp);
		} else {
			// Add to order book
			currentOrderBook.current.push(newOrder);
		}

		updateChartBrokerData();
		setStatus(`✅ ${side.toUpperCase()} order placed`);
	};

	const createPositionAndTrade = (newOrder: Order, ltp: number) => {
		// Create trade
		const tradeId = `TRADE_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
		const newTrade: Trade = {
			tradeId: tradeId,
			orderId: newOrder.orderId,
			datetime: new Date(),
			timeStamp: new Date().getTime(),
			price: ltp,
			size: newOrder.size,
			side: newOrder.side,
			productId: newOrder.productId,
			fee: {
				currency: "USDT",
				cost: newOrder.size * ltp * 0.0006,
				rate: 0.0006,
			},
			exchange: newOrder.exchange,
			symbol: newOrder.symbol,
			key: `demo-${newOrder.productId}-${tradeId}`,
			broker: "demo",
			productType: "FUTURE",
			security: newOrder.security,
		};

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
			const newSize =
				existingPosition.size +
				(newOrder.side === "buy" ? newOrder.size : -newOrder.size);

			if (Math.abs(newSize) < 0.0001) {
				// Position closed
				const closedPos = {
					...existingPosition,
					exitPrice: ltp,
					closedAt: new Date().toLocaleTimeString(),
					pnl:
						(ltp - existingPosition.price) *
						Math.abs(existingPosition.size),
				};
				setClosedPositions((prev) => [closedPos, ...prev]);
				currentPositions.current.splice(existingPositionIndex, 1);
			} else {
				// Update position
				const totalCost =
					existingPosition.price * Math.abs(existingPosition.size) +
					ltp * newOrder.size;
				const totalSize = Math.abs(newSize);
				currentPositions.current[existingPositionIndex] = {
					...existingPosition,
					size: newSize,
					price: totalCost / totalSize,
				};
			}
		} else {
			// Create new position
			const positionId = `POS_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
			const newPosition: Position = {
				id: positionId,
				size: newOrder.side === "buy" ? newOrder.size : -newOrder.size,
				size_currency: newOrder.size,
				price: ltp,
				amount: ltp * newOrder.size,
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
			};

			currentPositions.current.push(newPosition);
		}
	};

	// App callback handler
	const handleAppCallback: AppCallback = (eventType, message, _onClose) => {
		console.log("📞 App Callback:", eventType, message);

		switch (eventType) {
			case "PLACE_ORDER":
				console.log("Placing order from chart:", message);
				// Handle order placement from chart
				break;
			case "MODIFY_ORDER":
				console.log("Modifying order:", message);
				break;
			case "CANCEL_ORDER":
				console.log("Cancelling order:", message);
				break;
			case "CLOSE_POSITION":
				console.log("Closing position:", message);
				break;
			default:
				console.log("Unhandled event:", eventType);
		}
	};

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
					appCallback: handleAppCallback,
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
						<h1>📈 GoCharting SDK - Advanced Trading 2</h1>
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
																		<button className='action-btn close-btn'>
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
														(order) => (
															<tr
																key={
																	order.orderId
																}
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
																	{order.size}
																</td>
																<td>
																	$
																	{order.price.toFixed(
																		2
																	)}
																</td>
																<td>
																	<button className='action-btn close-btn'>
																		Cancel
																	</button>
																</td>
															</tr>
														)
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
