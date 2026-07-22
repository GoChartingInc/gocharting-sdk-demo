import { useEffect, useRef, useState } from "react";
import * as GoChartingSDK from "@gocharting/chart-sdk";
import type { ChartInstance, ChartWrapper } from "@gocharting/chart-sdk";
import { createChartDatafeed } from "@/utils/chart-datafeed";
import "./MultiBasicChart.scss";

const MultiBasicChart = () => {
	const chartContainerRef = useRef<HTMLDivElement>(null);
	// ChartWrapper is the wrapper returned by createChart(), ChartInstance is the component
	const chartWrapperRef = useRef<ChartWrapper | null>(null);
	const chartInstanceRef = useRef<ChartInstance | null>(null);
	const [status, setStatus] = useState<string>("Initializing chart...");
	const [currentSymbol, setCurrentSymbol] = useState<string>(
		"BYBIT:FUTURE:BTCUSDT"
	);

	useEffect(() => {
		let mounted = true;

		const initializeChart = async () => {
			if (!chartContainerRef.current) return;

			try {
				setStatus("Creating chart...");

				// Create datafeed
				const datafeed = createChartDatafeed();

				// Create chart using SDK
				const chart = GoChartingSDK.createChart(
					chartContainerRef.current,
					{
						symbol: currentSymbol,
						interval: "1m",
						datafeed: datafeed,
						debugLog: false,
						licenseKey: "demo-550e8400-e29b-41d4-a716-446655440000",
						exclude: {
							indicators: [
								"ACC",
								"CHAIKINMFI",
								"CHAIKINVOLATILITY",
								"COPPOCK",
								"EOM",
								"FORCEINDEX",
								"KLINGER",
								"KST",
								"MFI",
								"ONBALANCEVOLUME",
								"ROC",
								"SMA",
								"TWIGGSMONEYFLOW",
								"VOLUMEUNDERLAY",
								"VWAP",
								"VWMA",
								"WMFI",
								"OI",
								"SANBAND",
								"TRADEVOLUMEINDEX",
								"VOLUMEOSCILLATOR",
								"VOLUMEROC",
							],
						},
						theme: "dark",
						onReady: (chartInstance: any) => {
							// Store the actual chart instance from the callback
							chartInstanceRef.current = chartInstance;
							if (mounted) {
								setStatus("Chart ready!");
							}
						},
						onError: (error: Error) => {
							console.error("Chart creation error:", error);
							if (mounted) {
								setStatus(`❌ Error: ${error.message}`);
							}
						},
					}
				);

				// Store the chart instance (in installed SDK, this is the same as onReady param)
				if (!chartWrapperRef.current) {
					chartWrapperRef.current = chart;
				}
			} catch (error) {
				console.error("❌ Error initializing chart:", error);
				if (mounted) {
					setStatus(
						`❌ Error: ${
							error instanceof Error
								? error.message
								: "Unknown error"
						}`
					);
				}
			}
		};

		initializeChart();

		return () => {
			mounted = false;
			if (
				chartWrapperRef.current &&
				!chartWrapperRef.current.isDestroyed()
			) {
				try {
					chartWrapperRef.current.destroy();
				} catch (error) {
					console.error("Error destroying chart:", error);
				}
			}

			chartInstanceRef.current = null;
			chartWrapperRef.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleSymbolChange = (newSymbol: string) => {
		if (!chartInstanceRef.current) {
			setStatus("❌ Chart not ready");
			return;
		}

		try {
			setStatus(`🔄 Switching to ${newSymbol}...`);
			chartInstanceRef.current.setSymbol(newSymbol);
			setCurrentSymbol(newSymbol);
			setStatus(`✅ Switched to ${newSymbol}`);
		} catch (error) {
			console.error("❌ Error changing symbol:", error);
			setStatus(
				`❌ Error: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}
	};

	const handleResubscribeAll = () => {
		if (!chartInstanceRef.current) {
			setStatus("❌ Chart not ready");
			return;
		}

		try {
			chartInstanceRef.current.resubscribeAll();
			setStatus("✅ Resubscribed to all data streams");
		} catch (error) {
			console.error("❌ Error resubscribing:", error);
			setStatus(
				`❌ Error: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}
	};

	return (
		<div className='multi-basic-chart-container'>
			<div className='container'>
				<div className='header'>
					<h1>📈 GoCharting SDK Demo</h1>
					<p>
						Professional Financial Charts with Built-in AutoFit ✨
					</p>
				</div>

				<div className='controls'>
					<button
						id='symbol-btc-btn'
						className='btn primary'
						onClick={() =>
							handleSymbolChange("BYBIT:FUTURE:BTCUSDT")
						}
					>
						₿ BTC/USDT
					</button>
					<button
						id='symbol-eth-btn'
						className='btn primary'
						onClick={() =>
							handleSymbolChange("BYBIT:FUTURE:ETHUSDT")
						}
					>
						Ξ ETH/USDT
					</button>
					<button
						id='resubscribe-btn'
						className='btn success'
						onClick={handleResubscribeAll}
					>
						🔄 Resubscribe All
					</button>
				</div>

				<div id='chart-container' ref={chartContainerRef}>
					<div className='loading'>Loading chart...</div>
				</div>

				<div id='status' className='status'>
					{status}
				</div>
			</div>
		</div>
	);
};

export default MultiBasicChart;
