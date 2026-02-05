import { useEffect, useRef, useState } from "react";
import { Box } from "@/components/Box";
import { Text } from "@/components/Text";
import { useResponsive } from "@/hooks/useResponsive";
import { createChartDatafeed } from "@/utils/chart-datafeed";
import * as GoChartingSDK from "@gocharting/chart-sdk";
import type { ChartInstance, ChartConfig } from "@gocharting/chart-sdk";

// Extract the appCallback type from ChartConfig
type AppCallback = NonNullable<ChartConfig["appCallback"]>;

export const ChartSDK = () => {
	const chartContainerRef = useRef<HTMLDivElement>(null);
	const chartInstanceRef = useRef<ChartInstance | null>(null);
	const { isSmallDevice, isMediumDevice } = useResponsive();
	const isMobile = isSmallDevice || isMediumDevice;

	// Trading state
	const [quantity, setQuantity] = useState(100);
	const [stopLoss, setStopLoss] = useState("");
	const [takeProfit, setTakeProfit] = useState("");
	const [orderType, setOrderType] = useState<"market" | "limit">("market");
	const [limitPrice, setLimitPrice] = useState("");
	const [status, setStatus] = useState("Loading chart...");

	// Broker data state
	const currentSymbol = useRef("BYBIT:FUTURE:BTCUSDT");
	const currentOrderBook = useRef<any[]>([]);
	const currentTradeBook = useRef<any[]>([]);
	const currentPositions = useRef<any[]>([]);
	const currentAccountList = useRef<any[]>([
		{
			account_id: "DEMO_001",
			AccountID: "DEMO_001",
			AccountType: "Demo Trading",
			label: "Demo Account (Trading)",
			currency: "USD",
			balance: 100000,
			equity: 100000,
			margin: 0,
			freeMargin: 100000,
		},
	]);

	useEffect(() => {
		// Initialize chart when component mounts
		const timer = setTimeout(() => {
			initializeChart();
		}, 100);

		return () => {
			clearTimeout(timer);
			// Cleanup chart on unmount
			if (chartInstanceRef.current) {
				try {
					chartInstanceRef.current.destroy();
				} catch (e) {
					console.error("Error destroying chart:", e);
				}
			}
		};
	}, []);

	// Helper methods
	const updateChartBrokerData = () => {
		if (!chartInstanceRef.current) {
			console.warn("Chart instance not available");
			return;
		}

		const demoBrokerData = {
			accountList: currentAccountList.current,
			orderBook: currentOrderBook.current,
			tradeBook: currentTradeBook.current,
			positions: currentPositions.current,
		};

		try {
			chartInstanceRef.current.setBrokerAccounts(demoBrokerData);
			console.log("✅ Broker data updated successfully");
		} catch (error) {
			console.error("❌ Failed to update chart broker data:", error);
		}
	};

	const setupDemoBrokerData = (chartInstance: ChartInstance) => {
		console.log("🏦 Setting up demo broker data for trading...");

		const demoBrokerData = {
			accountList: currentAccountList.current,
			orderBook: currentOrderBook.current,
			tradeBook: currentTradeBook.current,
			positions: currentPositions.current,
		};

		try {
			chartInstance.setBrokerAccounts(demoBrokerData);
			console.log("✅ Demo broker data set successfully");
			setStatus("🏦 Demo trading data loaded");
		} catch (error) {
			console.error("❌ Failed to set broker data:", error);
			setStatus("❌ Failed to load trading data");
		}
	};

	const getCurrentLTP = () => {
		// Placeholder - in real implementation, get from chart
		return 110000;
	};

	const handleAppCallback: AppCallback = ({
		eventType,
		message,
		onClose,
	}) => {
		console.log("*** APP CALLBACK TRIGGERED ***");
		console.log("Event Type:", eventType);
		console.log("Message:", message);
		console.log("onClose callback:", onClose);
		console.log(`Trading Event: ${eventType}`, message);
	};

	const initializeChart = () => {
		if (!GoChartingSDK) {
			setStatus("GoCharting SDK not available");
			return;
		}

		if (!chartContainerRef.current) {
			setStatus("Chart container not available");
			return;
		}

		try {
			const datafeed = createChartDatafeed();

			// Add an ID to the container for the SDK
			if (chartContainerRef.current) {
				chartContainerRef.current.id = "gocharting-chart-container";
			}

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
					setStatus("Chart loaded with simplified API!");

					console.log("=== CHART READY - TRADING DIAGNOSTICS ===");
					console.log("Chart instance:", !!chartInstance);
					console.log("Trading enabled in config:", true);
					console.log(
						"setBrokerAccounts available:",
						typeof chartInstance.setBrokerAccounts
					);
					console.log(
						"Chart instance methods:",
						Object.getOwnPropertyNames(chartInstance)
					);
					console.log("==========================================");

					setupDemoBrokerData(chartInstance);
				},
				onError: (error) => {
					console.error("Chart creation error:", error);
					if (typeof error === "string") {
						setStatus(`❌ Error creating chart: ${error}`);
					} else {
						setStatus(`❌ Error creating chart: ${error.message}`);
					}
				},
			} satisfies ChartConfig;

			const chart = GoChartingSDK.createChart(
				"#gocharting-chart-container",
				chartConfig
			);

			chartInstanceRef.current = chart;
		} catch (error) {
			console.error("Error initializing chart:", error);
			setStatus("Failed to initialize chart");
		}
	};

	const placeBuyOrder = () => {
		console.log("🚀 [Trading Panel] BUY button clicked");

		const orderData = {
			order: {
				productId: currentSymbol.current,
				price: orderType === "limit" ? parseFloat(limitPrice) || 0 : 0,
				stopPrice: "",
				takeProfit: takeProfit || "",
				stopLoss: stopLoss || "",
				trailingSLSpread: "",
				size: parseFloat(String(quantity)) || 100,
				task: "placement",
				side: "buy",
				orderType: orderType,
			},
			security: {
				symbol: currentSymbol.current.replace("BYBIT:FUTURE:", ""),
				full_name: currentSymbol.current,
				exchange: "BYBIT",
				segment: "FUTURE",
			},
			ltp: getCurrentLTP(),
		};

		console.log("🚀 [Trading Panel] Order data:", orderData);

		const orderId = `ORDER_${Date.now()}_${Math.random()
			.toString(36)
			.substring(2, 11)}`;
		const newOrder = {
			orderId: orderId,
			datetime: new Date(),
			timeStamp: new Date().getTime(),
			status: "open",
			price: orderData.order.price,
			size: orderData.order.size,
			productId: orderData.order.productId,
			remainingSize: orderData.order.size,
			orderType: orderData.order.orderType,
			side: orderData.order.side,
			exchange: orderData.security.exchange,
			symbol: orderData.security.symbol,
			takeProfit: orderData.order.takeProfit,
			stopLoss: orderData.order.stopLoss,
			broker: "demo",
		};

		currentOrderBook.current.push(newOrder);
		updateChartBrokerData();
		setStatus(
			`✅ BUY order placed: ${quantity} @ ${
				orderType === "market" ? "Market" : limitPrice
			}`
		);
	};

	const placeSellOrder = () => {
		console.log("📉 [Trading Panel] SELL button clicked");

		const orderData = {
			order: {
				productId: currentSymbol.current,
				price: orderType === "limit" ? parseFloat(limitPrice) || 0 : 0,
				stopPrice: "",
				takeProfit: takeProfit || "",
				stopLoss: stopLoss || "",
				trailingSLSpread: "",
				size: parseFloat(String(quantity)) || 100,
				task: "placement",
				side: "sell",
				orderType: orderType,
			},
			security: {
				symbol: currentSymbol.current.replace("BYBIT:FUTURE:", ""),
				full_name: currentSymbol.current,
				exchange: "BYBIT",
				segment: "FUTURE",
			},
			ltp: getCurrentLTP(),
		};

		console.log("📉 [Trading Panel] Order data:", orderData);

		const orderId = `ORDER_${Date.now()}_${Math.random()
			.toString(36)
			.substring(2, 11)}`;
		const newOrder = {
			orderId: orderId,
			datetime: new Date(),
			timeStamp: new Date().getTime(),
			status: "open",
			price: orderData.order.price,
			size: orderData.order.size,
			productId: orderData.order.productId,
			remainingSize: orderData.order.size,
			orderType: orderData.order.orderType,
			side: orderData.order.side,
			exchange: orderData.security.exchange,
			symbol: orderData.security.symbol,
			takeProfit: orderData.order.takeProfit,
			stopLoss: orderData.order.stopLoss,
			broker: "demo",
		};

		currentOrderBook.current.push(newOrder);
		updateChartBrokerData();
		setStatus(
			`✅ SELL order placed: ${quantity} @ ${
				orderType === "market" ? "Market" : limitPrice
			}`
		);
	};

	const resetBroker = () => {
		console.log("🔄 Resetting broker data...");
		currentOrderBook.current = [];
		currentTradeBook.current = [];
		currentPositions.current = [];
		updateChartBrokerData();
		setStatus(
			"🔄 Broker data reset - All orders, trades, and positions cleared"
		);
	};

	return (
		<Box
			width='100%'
			flexDirection='column'
			gap={isMobile ? "16px" : "20px"}
		>
			{/* Trading Panel */}
			<Box
				width='100%'
				background='linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)'
				p={isMobile ? "16px" : "20px"}
				borderRadius='12px'
				border='1px solid rgba(255, 255, 255, 0.06)'
				flexDirection='column'
				gap='16px'
			>
				<Box
					width='100%'
					flexDirection={isMobile ? "column" : "row"}
					gap='12px'
					flexWrap='wrap'
				>
					{/* Quantity */}
					<Box
						flexDirection='column'
						gap='6px'
						flex='1'
						minWidth={isMobile ? "100%" : "120px"}
					>
						<Text
							fontSize='12px'
							fontWeight='600'
							textTransform='uppercase'
							opacity='0.7'
						>
							Quantity
						</Text>
						<input
							type='number'
							value={quantity}
							onChange={(e) =>
								setQuantity(Number(e.target.value))
							}
							min='1'
							style={{
								padding: "10px",
								borderRadius: "6px",
								border: "1px solid rgba(255, 255, 255, 0.3)",
								background: "rgba(255, 255, 255, 0.1)",
								color: "white",
								fontSize: "14px",
							}}
						/>
					</Box>

					{/* Stop Loss */}
					<Box
						flexDirection='column'
						gap='6px'
						flex='1'
						minWidth={isMobile ? "100%" : "120px"}
					>
						<Text
							fontSize='12px'
							fontWeight='600'
							textTransform='uppercase'
							opacity='0.7'
						>
							Stop Loss
						</Text>
						<input
							type='number'
							value={stopLoss}
							onChange={(e) => setStopLoss(e.target.value)}
							placeholder='45000'
							step='0.01'
							style={{
								padding: "10px",
								borderRadius: "6px",
								border: "1px solid rgba(255, 255, 255, 0.3)",
								background: "rgba(255, 255, 255, 0.1)",
								color: "white",
								fontSize: "14px",
							}}
						/>
					</Box>

					{/* Take Profit */}
					<Box
						flexDirection='column'
						gap='6px'
						flex='1'
						minWidth={isMobile ? "100%" : "120px"}
					>
						<Text
							fontSize='12px'
							fontWeight='600'
							textTransform='uppercase'
							opacity='0.7'
						>
							Take Profit
						</Text>
						<input
							type='number'
							value={takeProfit}
							onChange={(e) => setTakeProfit(e.target.value)}
							placeholder='55000'
							step='0.01'
							style={{
								padding: "10px",
								borderRadius: "6px",
								border: "1px solid rgba(255, 255, 255, 0.3)",
								background: "rgba(255, 255, 255, 0.1)",
								color: "white",
								fontSize: "14px",
							}}
						/>
					</Box>

					{/* Order Type */}
					<Box
						flexDirection='column'
						gap='6px'
						flex='1'
						minWidth={isMobile ? "100%" : "120px"}
					>
						<Text
							fontSize='12px'
							fontWeight='600'
							textTransform='uppercase'
							opacity='0.7'
						>
							Order Type
						</Text>
						<select
							value={orderType}
							onChange={(e) =>
								setOrderType(
									e.target.value as "market" | "limit"
								)
							}
							style={{
								padding: "10px",
								borderRadius: "6px",
								border: "1px solid rgba(255, 255, 255, 0.3)",
								background: "rgba(255, 255, 255, 0.1)",
								color: "white",
								fontSize: "14px",
							}}
						>
							<option value='market'>Market</option>
							<option value='limit'>Limit</option>
						</select>
					</Box>

					{/* Limit Price */}
					<Box
						flexDirection='column'
						gap='6px'
						flex='1'
						minWidth={isMobile ? "100%" : "120px"}
					>
						<Text
							fontSize='12px'
							fontWeight='600'
							textTransform='uppercase'
							opacity='0.7'
						>
							Limit Price
						</Text>
						<input
							type='number'
							value={limitPrice}
							onChange={(e) => setLimitPrice(e.target.value)}
							placeholder='50000'
							step='0.01'
							disabled={orderType === "market"}
							style={{
								padding: "10px",
								borderRadius: "6px",
								border: "1px solid rgba(255, 255, 255, 0.3)",
								background: "rgba(255, 255, 255, 0.1)",
								color: "white",
								fontSize: "14px",
								opacity: orderType === "market" ? 0.5 : 1,
								cursor:
									orderType === "market"
										? "not-allowed"
										: "text",
							}}
						/>
					</Box>
				</Box>

				{/* Trading Buttons */}
				<Box
					width='100%'
					gap='12px'
					justifyContent='center'
					flexDirection={isMobile ? "column" : "row"}
				>
					<button
						onClick={placeBuyOrder}
						style={{
							background:
								"linear-gradient(135deg, #28a745, #20c997)",
							minWidth: "100px",
							padding: "12px 24px",
							borderRadius: "8px",
							border: "none",
							color: "white",
							fontSize: "14px",
							fontWeight: "600",
							cursor: "pointer",
						}}
					>
						🚀 BUY
					</button>
					<button
						onClick={placeSellOrder}
						style={{
							background:
								"linear-gradient(135deg, #dc3545, #e74c3c)",
							minWidth: "100px",
							padding: "12px 24px",
							borderRadius: "8px",
							border: "none",
							color: "white",
							fontSize: "14px",
							fontWeight: "600",
							cursor: "pointer",
						}}
					>
						📉 SELL
					</button>
					<button
						onClick={resetBroker}
						style={{
							background:
								"linear-gradient(135deg, #6c757d, #5a6268)",
							minWidth: "100px",
							padding: "12px 24px",
							borderRadius: "8px",
							border: "none",
							color: "white",
							fontSize: "14px",
							fontWeight: "600",
							cursor: "pointer",
						}}
					>
						🔄 Reset Broker
					</button>
				</Box>
			</Box>

			{/* Chart Container */}
			<Box
				ref={chartContainerRef}
				width='100%'
				height={isMobile ? "400px" : "600px"}
				borderRadius='12px'
				overflow='hidden'
				background='#1a1a1a'
				alignItems='center'
				justifyContent='center'
			>
				<Text fontSize='18px'>{status}</Text>
			</Box>

			{/* Status Display */}
			<Box
				width='100%'
				background='linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)'
				p={isMobile ? "12px" : "16px"}
				borderRadius='12px'
				border='1px solid rgba(255, 255, 255, 0.06)'
				justifyContent='center'
			>
				<Text fontSize='14px' textAlign='center' opacity='0.6'>
					{status}
				</Text>
			</Box>
		</Box>
	);
};

export default ChartSDK;
