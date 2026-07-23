import { Link } from "react-router-dom";
// Read the SDK version from the installed package rather than hard-coding it —
// the footer claimed v1.0.23 long after the demo had moved on.
import sdkPkg from "@gocharting/chart-sdk/package.json";
import "./HomePage.css";

type Example = {
	to: string;
	title: string;
	blurb: string;
	points: string[];
	level: "Basic" | "Advanced";
};

const EXAMPLES: Example[] = [
	{
		to: "/advanced-trading-2",
		title: "Trading terminal",
		blurb:
			"The fullest example: watchlist, account manager and position tracking around a live chart.",
		points: [
			"Symbol watchlist sidebar",
			"Account manager — open, pending and closed positions",
			"Order placement from the chart",
			"Dark theme",
		],
		level: "Advanced",
	},
	{
		to: "/advanced-trading",
		title: "Order and trade books",
		blurb:
			"Trading interface focused on order management and the data behind it.",
		points: [
			"Order book and trade book",
			"Position management",
			"Interactive trading panel",
			"Streaming updates",
		],
		level: "Advanced",
	},
	{
		to: "/multi-basic",
		title: "Basic chart",
		blurb:
			"The smallest useful integration — a chart, a symbol switch and live updates.",
		points: [
			"Switch between BTCUSDT and ETHUSDT",
			"Live ticks over the demo WebSocket",
			"Resubscribe handling",
			"Minimal UI",
		],
		level: "Basic",
	},
];

const HomePage = () => (
	<div className='home-page'>
		<div className='home-container'>
			<header className='home-header'>
				<img
					className='home-logo'
					src={`${process.env.PUBLIC_URL}/logo192.png`}
					alt=''
					width={40}
					height={40}
				/>
				<div>
					<h1>GoCharting SDK</h1>
					<p className='subtitle'>
						React examples, running against live market data.
					</p>
				</div>
			</header>

			<div className='examples-grid'>
				{EXAMPLES.map((ex) => (
					<Link key={ex.to} to={ex.to} className='example-card'>
						<div className='card-head'>
							<h2>{ex.title}</h2>
							<span
								className={`badge${ex.level === "Basic" ? " basic" : ""}`}
							>
								{ex.level}
							</span>
						</div>
						<p>{ex.blurb}</p>
						<ul className='feature-list'>
							{ex.points.map((p) => (
								<li key={p}>{p}</li>
							))}
						</ul>
						<span className='card-open'>Open example</span>
					</Link>
				))}
			</div>

			<footer className='home-footer'>
				<p>
					Built with{" "}
					<a
						href='https://gocharting.com'
						target='_blank'
						rel='noopener noreferrer'
					>
						GoCharting SDK
					</a>{" "}
					v{sdkPkg.version} · React 19 · TypeScript
				</p>
				<p className='tech-stack'>
					Market data streams from the GoCharting demo WebSocket
					(BYBIT BTCUSDT / ETHUSDT).{" "}
					<a
						href='https://gocharting.com/sdk/docs'
						target='_blank'
						rel='noopener noreferrer'
					>
						Read the docs
					</a>
				</p>
			</footer>
		</div>
	</div>
);

export default HomePage;
