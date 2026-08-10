# @rwcourson/chart-elements

Composable React data-visualization elements for dashboards and business-intelligence interfaces.

```bash
pnpm add @rwcourson/chart-elements
```

```tsx
import "@rwcourson/chart-elements/tokens.css"; // optional default tokens
import "@rwcourson/chart-elements/components.css";
import { BarColumnChart, ChartFrame } from "@rwcourson/chart-elements/charts";
```

Declarative Vega/Vega-Lite rendering is isolated behind its own entry point and
loads the renderer only when the component mounts:

```tsx
import { VegaLiteChart } from "@rwcourson/chart-elements/declarative";
import { vegaLiteScatterSpec } from "@rwcourson/chart-elements/sample-data";

<VegaLiteChart spec={vegaLiteScatterSpec} ariaLabel="Revenue and margin scatter" />;
```

Specifications cannot load remote data or images unless
`allowExternalData={true}` is set for a trusted spec.

The package ships compiled ESM, TypeScript declarations, source maps,
precompiled styles, and a CycloneDX runtime-dependency SBOM. The component CSS includes no preflight or document reset;
default tokens and unbranded demo palettes are separate opt-in exports. The
legacy `styles.css` path aliases `components.css`, and all component rules use a
named `chart-elements` cascade layer. It supports Node 18+ build tooling and
React/React DOM 18.2 or 19. See the [project documentation](https://github.com/rwcourson/chart-elements#readme)
and [live gallery](https://chart-elements.vercel.app) for integration guidance
and examples.

This project is independent and is not affiliated with or endorsed by Microsoft, Esri, or any other BI vendor.
