import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import AdvancedTradingPage from "./pages/AdvancedTradingPage";
import Advanced2TradingPage from "./pages/Advanced2TradingPage";
import MultiBasicPage from "./pages/MultiBasicPage";

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
			</Routes>
		</Router>
	);
}

export default App;
