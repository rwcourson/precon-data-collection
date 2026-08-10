import { VisualizationSpec } from 'vega-embed';

declare const salesByRegion: {
    name: string;
    sales: number;
    target: number;
    profit: number;
}[];
declare const stackedSeries: {
    name: string;
    product: number;
    service: number;
    other: number;
}[];
declare const timeSeries: {
    date: string;
    revenue: number;
    cost: number;
    forecast: number;
}[];
declare const waterfallData: ({
    name: string;
    value: number;
    type: "total";
} | {
    name: string;
    value: number;
    type: "increase";
} | {
    name: string;
    value: number;
    type: "decrease";
})[];
declare const partToWhole: {
    name: string;
    value: number;
}[];
declare const funnelStages: {
    name: string;
    value: number;
}[];
declare const scatterPoints: {
    x: number;
    y: number;
    z: number;
    category: string;
    name: string;
}[];
declare const treemapData: {
    name: string;
    children: {
        name: string;
        size: number;
    }[];
}[];
declare const kpiMetrics: {
    label: string;
    value: number;
    delta: number;
    target: number;
}[];
declare const matrixRows: {
    region: string;
    q1: number;
    q2: number;
    q3: number;
    q4: number;
}[];
declare const ohlc: {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}[];
declare const distribution: {
    x: number;
    y: number;
}[];
declare const ganttTasks: ({
    id: string;
    name: string;
    start: number;
    end: number;
    lane: number;
    group: string;
    progress: number;
    status: "complete";
    dependencies?: undefined;
    critical?: undefined;
    milestone?: undefined;
} | {
    id: string;
    name: string;
    start: number;
    end: number;
    lane: number;
    group: string;
    progress: number;
    dependencies: string[];
    status: "active";
    critical?: undefined;
    milestone?: undefined;
} | {
    id: string;
    name: string;
    start: number;
    end: number;
    lane: number;
    group: string;
    progress: number;
    dependencies: string[];
    critical: boolean;
    status: "active";
    milestone?: undefined;
} | {
    id: string;
    name: string;
    start: number;
    end: number;
    lane: number;
    group: string;
    progress: number;
    dependencies: string[];
    status: "planned";
    critical?: undefined;
    milestone?: undefined;
} | {
    id: string;
    name: string;
    start: number;
    end: number;
    lane: number;
    group: string;
    progress: number;
    dependencies: string[];
    milestone: boolean;
    status: "planned";
    critical?: undefined;
})[];
declare const timelineEvents: ({
    id: string;
    date: number;
    label: string;
    description: string;
    status: "complete";
} | {
    id: string;
    date: number;
    label: string;
    description: string;
    status: "active";
} | {
    id: string;
    date: number;
    label: string;
    description: string;
    status: "planned";
})[];
declare const animatedTimelineFrames: {
    id: string;
    label: string;
    events: ({
        id: string;
        date: number;
        label: string;
        description: string;
        status: "complete";
    } | {
        id: string;
        date: number;
        label: string;
        description: string;
        status: "active";
    } | {
        id: string;
        date: number;
        label: string;
        description: string;
        status: "planned";
    })[];
}[];
declare const barRaceFrames: {
    label: string;
    values: {
        name: string;
        value: number;
    }[];
}[];
declare const animatedScatterFrames: {
    label: string;
    points: {
        id: string;
        x: number;
        y: number;
        size: number;
        category: string;
    }[];
}[];
declare const galleryImages: {
    id: string;
    src: string;
    alt: string;
    caption: string;
}[];
declare const gallerySafeHtml = "\n  <article>\n    <h3>Quarterly operating summary</h3>\n    <p><strong>Revenue increased 8.2%</strong> while return volume declined.</p>\n    <table>\n      <thead><tr><th>Region</th><th>Revenue</th></tr></thead>\n      <tbody><tr><td>West</td><td>$1.42M</td></tr><tr><td>East</td><td>$1.18M</td></tr></tbody>\n    </table>\n  </article>\n";
declare const gallerySafeSvg = "\n  <svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 420 220\">\n    <defs><linearGradient id=\"bar-fill\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop stop-color=\"#315fbb\"/><stop offset=\"1\" stop-color=\"#1f6b4a\"/></linearGradient></defs>\n    <g fill=\"url(#bar-fill)\">\n      <rect x=\"44\" y=\"118\" width=\"54\" height=\"70\" rx=\"5\"/>\n      <rect x=\"126\" y=\"82\" width=\"54\" height=\"106\" rx=\"5\"/>\n      <rect x=\"208\" y=\"48\" width=\"54\" height=\"140\" rx=\"5\"/>\n      <rect x=\"290\" y=\"28\" width=\"54\" height=\"160\" rx=\"5\"/>\n    </g>\n    <path d=\"M24 188H382\" stroke=\"#98a2b3\"/>\n  </svg>\n";
declare const sankeyNodes: {
    name: string;
}[];
declare const sankeyLinks: {
    source: number;
    target: number;
    value: number;
}[];
declare const calendarHeat: {
    date: string;
    value: number;
}[];
declare const words: {
    text: string;
    value: number;
}[];
/** Gallery-only inline specifications for the declarative renderer entries. */
declare const vegaBarSpec: VisualizationSpec;
declare const vegaLiteScatterSpec: VisualizationSpec;
declare const denebCompatibleSpec: VisualizationSpec;
declare const scientificContourSpec: VisualizationSpec;
declare const mlFeatureResult: {
    kind: "feature-importance";
    modelLabel: string;
    method: string;
    data: {
        feature: string;
        importance: number;
    }[];
};

export { animatedScatterFrames, animatedTimelineFrames, barRaceFrames, calendarHeat, denebCompatibleSpec, distribution, funnelStages, galleryImages, gallerySafeHtml, gallerySafeSvg, ganttTasks, kpiMetrics, matrixRows, mlFeatureResult, ohlc, partToWhole, salesByRegion, sankeyLinks, sankeyNodes, scatterPoints, scientificContourSpec, stackedSeries, timeSeries, timelineEvents, treemapData, vegaBarSpec, vegaLiteScatterSpec, waterfallData, words };
