import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import AdvancedTradingPage from "./pages/AdvancedTradingPage";
import Advanced2TradingPage from "./pages/Advanced2TradingPage";
import MultiBasicPage from "./pages/MultiBasicPage";
import PositionsTestPage from "./pages/PositionsTestPage";

function App() {
	return (
		<Router>
			<Routes>
				<Route path='/' element={<Advanced2TradingPage />} />
				<Route path='/examples' element={<HomePage />} />
				<Route
					path='/advanced-trading'
					element={<AdvancedTradingPage />}
				/>
				<Route
					path='/advanced-trading-2'
					element={<Advanced2TradingPage />}
				/>
				<Route path='/multi-basic' element={<MultiBasicPage />} />
				<Route path='/positions-test' element={<PositionsTestPage />} />
			</Routes>
		</Router>
	);
}

export default App;
