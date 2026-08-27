# GoCharting SDK Demo

A React (Create React App + CRACO) demo application showcasing the
[`@gocharting/chart-sdk`](https://www.npmjs.com/package/@gocharting/chart-sdk) —
GoCharting's embeddable charting and trading library.

Use this repository as a **reference implementation**: it shows how to create
charts, wire a datafeed, enable trading, handle SDK events, and theme the UI.
See [`NAVIGATION.md`](./NAVIGATION.md) and
[`ADVANCED_TRADING_EXAMPLE.md`](./ADVANCED_TRADING_EXAMPLE.md) for a tour of the
examples.

> **SDK access required to run the demo.**
> `@gocharting/chart-sdk` is a **private npm package**. To install and run this
> demo you need an npm access token and a license key from GoCharting — visit
> [gocharting.com](https://gocharting.com/) to get in touch. Without access you
> can still browse the source freely; the integration patterns in
> [`src/components/`](./src/components/) and the standalone HTML examples
> (`chart-sdk-codepen.html`, `codepen-advanced2.html`) are the useful parts.

## What's inside

| Example | Shows |
| --- | --- |
| `src/components/ChartSDK/` | Basic chart + simple trading panel |
| `src/components/ChartSDKAdvanced/` | Orders, positions, broker data round-trip |
| `src/components/ChartSDKAdvanced2/` | Full trading workflow: watchlist, order/position management, SL/TP modals, multiple datafeeds |
| `src/components/MultiBasic/` | Multiple charts on one page |
| `src/utils/chart-datafeed.ts` | Datafeed implementation against GoCharting APIs |
| `src/utils/twelve-chart-datafeed.ts` | Datafeed implementation against Twelve Data |
| `chart-sdk-codepen.html` | Self-contained single-file integration (UMD build, no bundler) |

## Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/) (`npm install -g pnpm`)
- npm access to `@gocharting/chart-sdk` (see note above)

## Quick start

Authenticate npm for the private package by creating an `.npmrc` in the repo
root (do **not** commit it):

```ini
registry=https://registry.npmjs.org/
//registry.npmjs.org/:_authToken=<your npm token>
```

Then:

```bash
pnpm install
pnpm start          # http://localhost:3000
```

Set your license key in the chart config (`licenseKey` in the examples) — the
demo ships with a placeholder key.

To try a different SDK version:

```bash
pnpm add @gocharting/chart-sdk@<version>
pnpm start
```

## Available scripts

| Script | Description |
| --- | --- |
| `pnpm start` | Run the demo in development mode (http://localhost:3000). |
| `pnpm run build` | Production build into `build/`. |
| `pnpm test` | Run the test runner in watch mode. |

---

## For GoCharting developers

External users can ignore this section.

The **`develop`** branch resolves the SDK from a local checkout instead of npm,
so the demo and the SDK can be developed side by side. It expects the SDK
repository next to this one:

```
parent/
├── gocharting-sdk-demo/            # this repo (on `develop`)
└── gocharting-web/GoCharting-SDK/  # SDK source
```

Wiring lives in `package.json` (`file:` dependency), `craco.config.js`
(webpack alias), and `tsconfig.json` (type paths) — keep those changes on
`develop` and never merge them into `main`, which must stay on the published
npm package.

```bash
git checkout develop
pnpm install
pnpm run build:sdk      # build the local SDK
pnpm start              # or: pnpm run build:start (build SDK, reinstall, start)
```

## Learn more

- [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started)
- [CRACO documentation](https://craco.js.org/)
- [React documentation](https://reactjs.org/)
