import "react-app-polyfill/ie11";
import "react-app-polyfill/stable";
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import * as GoChartingSDK from "@gocharting/chart-sdk";

// The SDK's lazy vendor scripts (drawTypeIcons, topBar, …) are IIFEs that
// resolve react etc. from window.GoChartingSDK.*. That global only exists
// when the SDK is loaded via <script src="index.umd.js">; when webpack
// bundles the npm package we must expose it ourselves.
(window as unknown as Record<string, unknown>).GoChartingSDK ??=
	GoChartingSDK;

// Suppress React import warning (needed for jsx-runtime compatibility)
void React;

const root = ReactDOM.createRoot(
	document.getElementById("root") as HTMLElement
);

// Note: StrictMode is disabled because the GoCharting SDK uses legacy
// ReactDOM.render/unmountComponentAtNode which conflicts with React 18's
// StrictMode double-mounting behavior. This causes "removeChild" errors.
// The SDK needs to be updated to use React 18's createRoot API.
root.render(<App />);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
