import { useSearchParams } from "react-router-dom";
import { listProviders } from "@/utils/datafeed/providers";

/**
 * Page-level provider switch. Lives OUTSIDE the SDK chart. Reads/writes the
 * `?datafeed=` search param (default "bybit"); changing it remounts the chart.
 */
export const DataProviderSwitch = () => {
	const [searchParams, setSearchParams] = useSearchParams();
	const current = searchParams.get("datafeed") ?? "bybit";
	const providers = listProviders();

	const handleChange = (id: string) => {
		const next = new URLSearchParams(searchParams);
		next.set("datafeed", id);
		// Symbol formats differ per provider — drop any provider-specific symbol param.
		next.delete("symbol");
		setSearchParams(next);
	};

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 8,
				padding: "8px 12px",
				background: "#16181d",
				borderBottom: "1px solid #2a2e39",
				color: "#d1d4dc",
				fontSize: 13,
				fontFamily: "system-ui, sans-serif",
			}}
		>
			<label htmlFor="data-provider-select" style={{ fontWeight: 600 }}>
				Data Provider
			</label>
			<select
				id="data-provider-select"
				value={current}
				onChange={(e) => handleChange(e.target.value)}
				style={{
					background: "#1e222d",
					color: "#d1d4dc",
					border: "1px solid #2a2e39",
					borderRadius: 4,
					padding: "4px 8px",
					fontSize: 13,
					cursor: "pointer",
				}}
			>
				{providers.map((p) => (
					<option key={p.id} value={p.id}>
						{p.label}
					</option>
				))}
			</select>
		</div>
	);
};
