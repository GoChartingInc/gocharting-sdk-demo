import "react-app-polyfill/ie11";
import "react-app-polyfill/stable";
import React from "react";
import * as GoChartingSDKNamespace from "@gocharting/chart-sdk";
import * as ReactDOMLegacy from "react-dom";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";

// Suppress React import warning (needed for jsx-runtime compatibility)
void React;

// The SDK loads its heavier pieces (drawTypeIcons, topBar, contextMenu, …) at
// runtime as IIFE <script>s that treat React as external and read it from the
// global GoChartingSDK.React. That global exists when the SDK is dropped in as
// a UMD script tag, which is how main consumes it — but here the SDK is a
// webpack alias, so nothing ever defined it and every vendor chunk threw
// "GoChartingSDK is not defined". Publish it before any chart mounts.
const sdkNamespace = GoChartingSDKNamespace as unknown as Record<string, unknown>;
(window as any).GoChartingSDK = {
	...((window as any).GoChartingSDK || {}),
	...sdkNamespace,
	// The SDK bundles its own React and re-exports it, and the vendor chunks
	// must use *that* copy. Handing them the app's React instead makes every
	// element they create fail the SDK React's $$typeof check — React error
	// #31, "object with keys {$$typeof, type, key, props, _owner, _store}".
	// The app's copies are only a fallback for an SDK build that omits them.
	React: sdkNamespace.React ?? React,
	ReactDOM: sdkNamespace.ReactDOM ?? ReactDOMLegacy,
};

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
