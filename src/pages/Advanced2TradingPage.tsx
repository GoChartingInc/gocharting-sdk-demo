import { useSearchParams } from "react-router-dom";
import ChartSDKAdvanced2 from "@/components/ChartSDKAdvanced2";
import { DataProviderSwitch } from "@/components/DataProviderSwitch";

const Advanced2TradingPage = () => {
	const [searchParams] = useSearchParams();
	const datafeed = searchParams.get("datafeed") ?? "bybit";

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
			<DataProviderSwitch />
			<div style={{ flex: 1, minHeight: 0 }}>
				{/* key remounts the chart (running its teardown) when the provider changes */}
				<ChartSDKAdvanced2 key={datafeed} />
			</div>
		</div>
	);
};

export default Advanced2TradingPage;
