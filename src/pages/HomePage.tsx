import { Link } from "react-router-dom";
import "./HomePage.css";

const HomePage = () => {
	return (
		<div className='home-page'>
			<div className='home-container'>
				<header className='home-header'>
					<h1>📈 GoCharting SDK Demo</h1>
					<p className='subtitle'>
						Professional Financial Charts - React Examples
					</p>
				</header>

				<div className='examples-grid'>
					<Link to='/advanced-trading' className='example-card'>
						<div className='card-icon'>💹</div>
						<h2>Advanced Trading</h2>
						<p>
							Full-featured trading interface with order
							management, positions, and real-time data streaming.
						</p>
						<ul className='feature-list'>
							<li>✓ Order Book & Trade Book</li>
							<li>✓ Position Management</li>
							<li>✓ Real-time Bybit Data</li>
							<li>✓ Interactive Trading Panel</li>
						</ul>
						<div className='card-footer'>
							<span className='badge'>Advanced</span>
							<span className='arrow'>→</span>
						</div>
					</Link>

					<Link to='/advanced-trading-2' className='example-card'>
						<div className='card-icon'>🚀</div>
						<h2>Advanced Trading 2</h2>
						<p>
							Enhanced trading interface with symbol watchlist,
							account manager, and multi-tab position tracking.
						</p>
						<ul className='feature-list'>
							<li>✓ Symbol Watchlist Sidebar</li>
							<li>✓ Account Manager (3 Tabs)</li>
							<li>✓ Open/Pending/Closed Positions</li>
							<li>✓ Dark Theme UI</li>
						</ul>
						<div className='card-footer'>
							<span className='badge'>Advanced</span>
							<span className='arrow'>→</span>
						</div>
					</Link>

					<Link to='/multi-basic' className='example-card'>
						<div className='card-icon'>📊</div>
						<h2>Multi-Basic Chart</h2>
						<p>
							Simple chart example with symbol switching and
							real-time data updates.
						</p>
						<ul className='feature-list'>
							<li>✓ Symbol Switching (BTC, ETH, OGN)</li>
							<li>✓ Real-time Bybit WebSocket</li>
							<li>✓ Resubscribe All Feature</li>
							<li>✓ Clean & Simple UI</li>
						</ul>
						<div className='card-footer'>
							<span className='badge basic'>Basic</span>
							<span className='arrow'>→</span>
						</div>
					</Link>
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
						v1.0.23
					</p>
					<p className='tech-stack'>
						React 19 • TypeScript • React Router • Bybit API
					</p>
				</footer>
			</div>
		</div>
	);
};

export default HomePage;
