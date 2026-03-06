import { useEffect, useRef, useState, useCallback } from "react";
import * as GoChartingSDK from "@gocharting/chart-sdk";
import { createChartDatafeed } from "@/utils/chart-datafeed";
import type {
	ChartWrapper,
	ChartInstance,
	Datafeed,
	AppCallbackEventHandler,
} from "@gocharting/chart-sdk";

/**
 * Test page that mimics Leverate dashboard layout:
 * - Header with logo and buttons
 * - Chart in the middle (flex: 1, should shrink but not collapse)
 * - Account info bar (fixed height)
 * - Positions table (fixed height)
 *
 * Used to verify GOCHA-14: chart should maintain min-height when squeezed
 */
const PositionsTestPage = () => {
	const chartContainerRef = useRef<HTMLDivElement>(null);
	const chartInstanceRef = useRef<ChartInstance | null>(null);
	const chartWrapperRef = useRef<ChartWrapper | null>(null);
	const datafeedRef = useRef<Datafeed | null>(null);
	const handleAppCallbackRef = useRef<AppCallbackEventHandler | null>(null);

	const [status, setStatus] = useState("Initializing...");

	useEffect(() => {
		if (!chartContainerRef.current) return;

		const datafeed = createChartDatafeed();
		datafeedRef.current = datafeed;

		const handleAppCallback = (event: any, data: any) => {
			console.log("App callback:", event, data);
		};
		handleAppCallbackRef.current = handleAppCallback as any;

		const config: any = {
			symbol: "BYBIT:FUTURE:BTCUSDT",
			interval: "1m",
			theme: "dark",
			datafeed,
			autosize: true,
			licenseKey: "demo-550e8400-e29b-41d4-a716-446655440000",
			topBarControls: { all: true },
			appCallback: (event: any, data: any) => {
				if (handleAppCallbackRef.current) {
					(handleAppCallbackRef.current as any)(event, data);
				}
			},
		};

		try {
			const wrapper = GoChartingSDK.createChart(
				"#gocharting-positions-test",
				config
			);
			chartWrapperRef.current = wrapper;
			chartInstanceRef.current = wrapper.chart;
			setStatus("Chart loaded");
		} catch (error) {
			console.error("Chart init error:", error);
			setStatus("Error: " + String(error));
		}

		return () => {
			if (chartWrapperRef.current && !chartWrapperRef.current.isDestroyed()) {
				try {
					chartWrapperRef.current.destroy();
				} catch (e) {}
			}
		};
	}, []);

	// Mock positions data
	const positions = [
		{ instrument: "AVAXUSD.", type: "Sell", amount: 10000, openTime: "20/02/2026 10:55", openPrice: 9.23, closePrice: "9.12000", stopLoss: "---", takeProfit: "---", profit: 1100, swap: 0, commission: 0 },
		{ instrument: "ADAUSD", type: "Buy", amount: 10000, openTime: "20/02/2026 10:54", openPrice: 0.27482, closePrice: "0.27715", stopLoss: "---", takeProfit: "---", profit: 23.3, swap: 0, commission: 0 },
		{ instrument: "EURGBP", type: "Sell", amount: 1000, openTime: "17/02/2026 13:25", openPrice: 0.87077, closePrice: "0.87435", stopLoss: "0.87887", takeProfit: "0.86692", profit: -4.88, swap: 0, commission: 0 },
		{ instrument: "ADBE", type: "Sell", amount: 0.1, openTime: "10/02/2026 20:47", openPrice: 264.78, closePrice: "259.220", stopLoss: "---", takeProfit: "---", profit: 5.56, swap: 0, commission: 0 },
	];

	return (
		<div style={{
			display: "flex",
			flexDirection: "column",
			height: "100vh",
			backgroundColor: "#1a1e2e",
			color: "#e0e0e0",
			fontFamily: "Arial, sans-serif",
			fontSize: "13px",
			overflow: "hidden",
		}}>
			{/* Header Bar */}
			<div style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				padding: "8px 16px",
				backgroundColor: "#1a1e2e",
				borderBottom: "1px solid #2a2e3e",
				flexShrink: 0,
			}}>
				<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
					<div style={{
						backgroundColor: "#0d1117",
						padding: "6px 16px",
						borderRadius: "6px",
						fontWeight: "bold",
						fontSize: "14px",
						color: "#4fc3f7",
					}}>
						Nurettinga
					</div>
				</div>
				<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
					{/* 1-Click Trading */}
					<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
						<span style={{ fontSize: "12px", opacity: 0.7 }}>1-Click Trading</span>
						<div style={{
							display: "flex",
							gap: "4px",
						}}>
							<div style={{ backgroundColor: "#ef5350", color: "white", padding: "4px 16px", borderRadius: "4px", fontSize: "12px" }}>
								<div style={{ fontSize: "10px" }}>Sell</div>
								<div style={{ fontWeight: "bold" }}>259.15</div>
							</div>
							<div style={{ backgroundColor: "#26a69a", color: "white", padding: "4px 16px", borderRadius: "4px", fontSize: "12px" }}>
								<div style={{ fontSize: "10px" }}>Buy</div>
								<div style={{ fontWeight: "bold" }}>259.22</div>
							</div>
						</div>
					</div>
					{/* Action buttons */}
					<button style={{ backgroundColor: "transparent", border: "1px solid #4fc3f7", color: "#4fc3f7", padding: "6px 16px", borderRadius: "4px", cursor: "pointer" }}>Funds</button>
					<button style={{ backgroundColor: "transparent", border: "1px solid #4fc3f7", color: "#4fc3f7", padding: "6px 16px", borderRadius: "4px", cursor: "pointer" }}>Deposit</button>
					<button style={{ backgroundColor: "transparent", border: "1px solid #4fc3f7", color: "#4fc3f7", padding: "6px 16px", borderRadius: "4px", cursor: "pointer" }}>Withdraw</button>
				</div>
			</div>

			{/* Main Content: Watchlist + Chart */}
			<div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
				{/* Watchlist Sidebar */}
				<div style={{
					width: "250px",
					flexShrink: 0,
					borderRight: "1px solid #2a2e3e",
					display: "flex",
					flexDirection: "column",
					overflow: "auto",
				}}>
					<div style={{ padding: "8px", borderBottom: "1px solid #2a2e3e" }}>
						<input
							type="text"
							placeholder="Search"
							style={{ width: "100%", backgroundColor: "#2a2e3e", border: "1px solid #3a3e4e", borderRadius: "4px", padding: "6px 8px", color: "#e0e0e0", fontSize: "12px" }}
						/>
					</div>
					<div style={{ padding: "4px 8px", borderBottom: "1px solid #2a2e3e", display: "flex", justifyContent: "space-between", fontSize: "11px", opacity: 0.6 }}>
						<span>Market (88)</span>
						<span>Sell</span>
						<span>Buy</span>
					</div>
					{[
						{ name: "AMAZON.", sell: "204.89", buy: "204.9", change: "+0.34%", flag: "us" },
						{ name: "BNBUSDT.", sell: "608.88", buy: "609.34", change: "+0.2%", flag: "crypto" },
						{ name: "XPDUSD", sell: "1,704.61", buy: "1,715.81", change: "+0.88%", flag: "us" },
						{ name: "BCHUSD", sell: "554.46", buy: "554.74", change: "-0.97%", flag: "us" },
						{ name: "AAL", sell: "13.35", buy: "13.36", change: "-1.33%", flag: "us" },
					].map((item, i) => (
						<div key={i} style={{
							padding: "8px",
							borderBottom: "1px solid #2a2e3e",
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							cursor: "pointer",
						}}>
							<div>
								<div style={{ fontWeight: "bold", fontSize: "12px" }}>{item.name}</div>
								<div style={{ fontSize: "10px", color: item.change.startsWith("-") ? "#ef5350" : "#26a69a" }}>{item.change}</div>
							</div>
							<div style={{ textAlign: "right", fontSize: "12px" }}>
								<div>{item.sell}</div>
							</div>
							<div style={{ textAlign: "right", fontSize: "12px" }}>
								<div>{item.buy}</div>
							</div>
						</div>
					))}
				</div>

				{/* Chart Area - this is the part that should resize but not collapse */}
				<div
					id="gocharting-positions-test"
					ref={chartContainerRef}
					style={{
						flex: 1,
						minHeight: 0,
						minWidth: 0,
						position: "relative",
					}}
				/>
			</div>

			{/* Account Info Bar */}
			<div style={{
				display: "flex",
				justifyContent: "space-between",
				padding: "12px 16px",
				backgroundColor: "#1e2230",
				borderTop: "1px solid #2a2e3e",
				borderBottom: "1px solid #2a2e3e",
				flexShrink: 0,
			}}>
				{[
					{ label: "Equity", value: "$102,442,050.53" },
					{ label: "Free margin", value: "$102,423,026.06" },
					{ label: "Used margin", value: "$19,024.13" },
					{ label: "Open P/L", value: "$1,124.36" },
					{ label: "Balance", value: "$102,440,925.73" },
					{ label: "Margin level", value: "538,484.81%" },
					{ label: "Credit", value: "$0.00" },
				].map((item, i) => (
					<div key={i} style={{ textAlign: "center" }}>
						<div style={{ fontSize: "10px", opacity: 0.5, marginBottom: "2px" }}>{item.label}</div>
						<div style={{ fontSize: "14px", fontWeight: "bold" }}>{item.value}</div>
					</div>
				))}
			</div>

			{/* Positions Panel */}
			<div style={{
				flexShrink: 0,
				minHeight: "200px",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
			}}>
				{/* Tabs */}
				<div style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					padding: "8px 16px",
					borderBottom: "1px solid #2a2e3e",
				}}>
					<div style={{ display: "flex", gap: "16px" }}>
						<span style={{ color: "#4fc3f7", borderBottom: "2px solid #4fc3f7", paddingBottom: "4px", fontSize: "13px" }}>
							Open positions <span style={{ backgroundColor: "#4fc3f7", color: "#1a1e2e", borderRadius: "10px", padding: "1px 6px", fontSize: "11px", marginLeft: "4px" }}>4</span>
						</span>
						<span style={{ opacity: 0.5, paddingBottom: "4px", fontSize: "13px" }}>Pending orders</span>
						<span style={{ opacity: 0.5, paddingBottom: "4px", fontSize: "13px" }}>Closed positions</span>
					</div>
					<button style={{ backgroundColor: "transparent", border: "1px solid #4fc3f7", color: "#4fc3f7", padding: "4px 12px", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>
						Close All Positions
					</button>
				</div>

				{/* Table */}
				<div style={{ flex: 1, overflow: "auto" }}>
					<table style={{ width: "100%", borderCollapse: "collapse" }}>
						<thead>
							<tr style={{ borderBottom: "1px solid #2a2e3e" }}>
								{["", "Instrument", "Type", "Amount", "Open time", "Open price", "Close price", "Stop loss", "Take profit", "Profit", "Swap", "Commission"].map((h, i) => (
									<th key={i} style={{ padding: "6px 8px", textAlign: "left", fontSize: "11px", opacity: 0.5, fontWeight: "normal" }}>{h}</th>
								))}
							</tr>
						</thead>
						<tbody>
							{positions.map((p, i) => (
								<tr key={i} style={{ borderBottom: "1px solid #2a2e3e" }}>
									<td style={{ padding: "8px" }}><input type="checkbox" /></td>
									<td style={{ padding: "8px" }}>{p.instrument}</td>
									<td style={{ padding: "8px", color: p.type === "Buy" ? "#26a69a" : "#ef5350" }}>{p.type}</td>
									<td style={{ padding: "8px" }}>{p.amount}</td>
									<td style={{ padding: "8px" }}>{p.openTime}</td>
									<td style={{ padding: "8px" }}>{p.openPrice}</td>
									<td style={{ padding: "8px" }}>{p.closePrice}</td>
									<td style={{ padding: "8px" }}>{p.stopLoss}</td>
									<td style={{ padding: "8px" }}>{p.takeProfit}</td>
									<td style={{ padding: "8px", color: p.profit >= 0 ? "#26a69a" : "#ef5350" }}>${p.profit.toFixed(2)}</td>
									<td style={{ padding: "8px" }}>${p.swap}</td>
									<td style={{ padding: "8px" }}>${p.commission}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
};

export default PositionsTestPage;
