import * as React from 'react';

type MapValidationResult<T> = {
    ok: true;
    data: T;
} | {
    ok: false;
    message: string;
};
type GeoCoordinate = readonly [longitude: number, latitude: number];
type GeoProperties = Readonly<Record<string, unknown>>;
type GeoPointGeometry = {
    type: "Point";
    coordinates: GeoCoordinate;
};
type GeoMultiPointGeometry = {
    type: "MultiPoint";
    coordinates: readonly GeoCoordinate[];
};
type GeoLineStringGeometry = {
    type: "LineString";
    coordinates: readonly GeoCoordinate[];
};
type GeoMultiLineStringGeometry = {
    type: "MultiLineString";
    coordinates: readonly (readonly GeoCoordinate[])[];
};
type GeoPolygonGeometry = {
    type: "Polygon";
    coordinates: readonly (readonly GeoCoordinate[])[];
};
type GeoMultiPolygonGeometry = {
    type: "MultiPolygon";
    coordinates: readonly (readonly (readonly GeoCoordinate[])[])[];
};
type GeoGeometryCollection = {
    type: "GeometryCollection";
    geometries: readonly GeoGeometry[];
};
type GeoGeometry = GeoPointGeometry | GeoMultiPointGeometry | GeoLineStringGeometry | GeoMultiLineStringGeometry | GeoPolygonGeometry | GeoMultiPolygonGeometry | GeoGeometryCollection;
type GeoFeature<Properties extends GeoProperties = GeoProperties> = {
    type: "Feature";
    id?: string | number;
    properties: Properties | null;
    geometry: GeoGeometry | null;
};
type GeoFeatureCollection<Properties extends GeoProperties = GeoProperties> = {
    type: "FeatureCollection";
    features: readonly GeoFeature<Properties>[];
};
type GeoProjectionKind = "equal-earth" | "natural-earth" | "mercator" | "equirectangular";
type GeoPointDatum = {
    id?: string;
    longitude: number;
    latitude: number;
    value?: number;
    label?: string;
    color?: string;
    category?: string;
    symbol?: string;
    imageUrl?: string;
};
/** Legacy/provider-free diagram coordinates, never interpreted as longitude/latitude. */
type PlanarPointDatum = {
    id?: string;
    x: number;
    y: number;
    value?: number;
    label?: string;
    color?: string;
    category?: string;
    symbol?: string;
    imageUrl?: string;
};
type MapPointDatum = GeoPointDatum | PlanarPointDatum;
type GeoRouteEndpoint = GeoCoordinate | Pick<GeoPointDatum, "longitude" | "latitude"> | Pick<PlanarPointDatum, "x" | "y">;
type MapRouteDatum = {
    id?: string;
    from: GeoRouteEndpoint;
    to: GeoRouteEndpoint;
    value?: number;
    label?: string;
    color?: string;
};
type SchematicRegion = {
    id: string;
    path: string;
    label: string;
    cx: number;
    cy: number;
};
type GeoFeatureValueDatum = {
    featureId: string;
    value: number;
    label?: string;
    color?: string;
};
type GeoReferenceLayer = {
    id: string;
    label: string;
    features: GeoFeatureCollection;
    color?: string;
    fillOpacity?: number;
    strokeWidth?: number;
};
type GeoLayoutFeature = {
    id: string;
    label: string;
    feature: GeoFeature;
    path: string;
    centroid: readonly [number, number];
};
type GeoLayout = {
    width: number;
    height: number;
    padding: number;
    projection: GeoProjectionKind;
    features: readonly GeoLayoutFeature[];
    spherePath: string;
    graticulePath: string;
    geographicBounds: readonly [GeoCoordinate, GeoCoordinate];
    project: (coordinate: GeoCoordinate) => readonly [number, number] | undefined;
    pathForGeometry: (geometry: GeoGeometry) => string | undefined;
    invert: (point: readonly [number, number]) => GeoCoordinate | undefined;
    distanceForPixels: (start: readonly [number, number], pixels: number) => number | undefined;
};
type NormalizedMapPoint = {
    id: string;
    mode: "geographic" | "schematic";
    longitude?: number;
    latitude?: number;
    x?: number;
    y?: number;
    value: number;
    label: string;
    color?: string;
    category?: string;
    symbol?: string;
    imageUrl?: string;
};
type NormalizedMapRoute = {
    id: string;
    mode: "geographic" | "schematic";
    fromGeo?: GeoCoordinate;
    toGeo?: GeoCoordinate;
    fromPlanar?: readonly [number, number];
    toPlanar?: readonly [number, number];
    value: number;
    label: string;
    color?: string;
};
type ProjectedPointCluster = {
    id: string;
    x: number;
    y: number;
    count: number;
    value: number;
    pointIds: readonly string[];
    labels: readonly string[];
};
declare function clamp(value: number, minimum: number, maximum: number): number;
declare function isGeoCoordinate(value: unknown): value is GeoCoordinate;
declare function isGeoPointDatum(point: MapPointDatum): point is GeoPointDatum;
declare function isPlanarPointDatum(point: MapPointDatum): point is PlanarPointDatum;
declare function featureId(feature: GeoFeature, idProperty?: string): string | undefined;
declare function featureLabel(feature: GeoFeature, fallback: string, labelProperty?: string): string;
declare function validateFeatureCollection(collection: GeoFeatureCollection, options?: {
    idProperty?: string;
    labelProperty?: string;
    allowEmpty?: boolean;
}): MapValidationResult<readonly {
    id: string;
    label: string;
    feature: GeoFeature;
}[]>;
declare function normalizeMapPoints(points: readonly MapPointDatum[]): MapValidationResult<readonly NormalizedMapPoint[]>;
declare function normalizeMapRoutes(routes: readonly MapRouteDatum[]): MapValidationResult<readonly NormalizedMapRoute[]>;
declare function createGeoLayout(options: {
    features?: GeoFeatureCollection;
    coordinates?: readonly GeoCoordinate[];
    projection?: GeoProjectionKind;
    width?: number;
    height?: number;
    padding?: number;
    idProperty?: string;
    labelProperty?: string;
    fit?: "data" | "world";
}): MapValidationResult<GeoLayout>;
declare function normalizeFeatureValues(data: readonly GeoFeatureValueDatum[] | undefined, values: Readonly<Record<string, number>> | undefined): MapValidationResult<ReadonlyMap<string, GeoFeatureValueDatum>>;
declare function validateSchematicRegions(regions: readonly SchematicRegion[]): MapValidationResult<readonly SchematicRegion[]>;
declare function createClampedScale(values: readonly number[], range: readonly [number, number], transform?: "linear" | "sqrt"): {
    minimum: number;
    maximum: number;
    map: (value: number) => number;
};
declare function clusterProjectedPoints(points: readonly {
    id: string;
    x: number;
    y: number;
    value: number;
    label: string;
}[], cellSize?: number): MapValidationResult<readonly ProjectedPointCluster[]>;
declare function featureCollection(features: readonly GeoFeature[]): GeoFeatureCollection;

type GeographicMapProps = {
    className?: string;
    label?: string;
    description?: string;
    features?: GeoFeatureCollection;
    projection?: GeoProjectionKind;
    featureIdProperty?: string;
    featureLabelProperty?: string;
    fit?: "data" | "world";
    dataAttribution?: string;
};
type PointSelectionProps = {
    selectedPointId?: string | null;
    defaultSelectedPointId?: string | null;
    onPointSelect?: (pointId: string, point: NormalizedMapPoint) => void;
};
type BubbleMapProps = GeographicMapProps & PointSelectionProps & {
    points?: readonly MapPointDatum[];
    /** Legacy x/y SVG regions. Their use switches the component to schematic mode. */
    regions?: readonly SchematicRegion[];
    showLegend?: boolean;
};
type ProportionalSymbolMapProps = BubbleMapProps;
type MarkerMapProps = BubbleMapProps;
type CustomIconMarkerMapProps = BubbleMapProps;
type ImageMarkerMapProps = BubbleMapProps;
type Column3DMapProps = BubbleMapProps & {
    /** Compatibility alias for `points`. */
    columns?: readonly MapPointDatum[];
};
declare function BubbleMap({ points, label, ...props }?: BubbleMapProps): React.JSX.Element;
declare function ProportionalSymbolMap({ points, label, ...props }?: ProportionalSymbolMapProps): React.JSX.Element;
declare function MarkerMap({ points, label, ...props }?: MarkerMapProps): React.JSX.Element;
declare function CustomIconMarkerMap({ points, label, ...props }?: CustomIconMarkerMapProps): React.JSX.Element;
declare function ImageMarkerMap({ points, label, ...props }?: ImageMarkerMapProps): React.JSX.Element;
declare function Column3DMap({ points, columns, label, ...props }?: Column3DMapProps): React.JSX.Element;
type ChoroplethMapProps = GeographicMapProps & {
    data?: readonly GeoFeatureValueDatum[];
    values?: Readonly<Record<string, number>>;
    regions?: readonly SchematicRegion[];
    selectedFeatureId?: string | null;
    defaultSelectedFeatureId?: string | null;
    onFeatureSelect?: (featureId: string, feature?: GeoFeature) => void;
    showLegend?: boolean;
    showLabels?: boolean;
    legendTitle?: string;
};
type HeatMapGeoProps = ChoroplethMapProps;
type FilledChoroplethMapProps = ChoroplethMapProps;
declare function HeatMapGeo({ label, ...props }?: HeatMapGeoProps): React.JSX.Element;
declare function FilledChoroplethMap({ label, ...props }?: FilledChoroplethMapProps): React.JSX.Element;
type PolygonMapProps = ChoroplethMapProps & {
    highlightIds?: readonly string[];
};
declare function PolygonMap({ highlightIds, values, label, ...props }?: PolygonMapProps): React.JSX.Element;
type ShapeMapProps = ChoroplethMapProps;
declare function ShapeMap({ label, ...props }?: ShapeMapProps): React.JSX.Element;
type CountryMapProps = ChoroplethMapProps;
type StateMapProps = ChoroplethMapProps;
type CountyMapProps = ChoroplethMapProps;
type TerritoryMapProps = ChoroplethMapProps;
declare function CountryMap({ label, ...props }?: CountryMapProps): React.JSX.Element;
declare function StateMap({ label, ...props }?: StateMapProps): React.JSX.Element;
declare function CountyMap({ label, ...props }?: CountyMapProps): React.JSX.Element;
declare function TerritoryMap({ label, ...props }?: TerritoryMapProps): React.JSX.Element;
type RouteSelectionProps = {
    selectedRouteId?: string | null;
    defaultSelectedRouteId?: string | null;
    onRouteSelect?: (routeId: string, route: NormalizedMapRoute) => void;
};
type PathMapProps = GeographicMapProps & RouteSelectionProps & {
    routes?: readonly MapRouteDatum[];
    regions?: readonly SchematicRegion[];
    showLegend?: boolean;
};
type RouteMapProps = PathMapProps;
type ArcMapProps = PathMapProps;
type FlowMapProps = PathMapProps;
declare function PathMap({ routes, label, ...props }?: PathMapProps): React.JSX.Element;
declare function RouteMap({ routes, label, ...props }?: RouteMapProps): React.JSX.Element;
declare function ArcMap({ routes, label, ...props }?: ArcMapProps): React.JSX.Element;
declare function FlowMap({ routes, label, ...props }?: FlowMapProps): React.JSX.Element;
type PointClusterMapProps = BubbleMapProps & {
    clusterCellSize?: number;
    onClusterSelect?: (pointIds: readonly string[]) => void;
};
declare function PointClusterMap({ points, clusterCellSize, onClusterSelect, className, label, description, features, projection, featureIdProperty, featureLabelProperty, fit, dataAttribution, regions, }?: PointClusterMapProps): React.JSX.Element;
type GeoPieOverlayDatum = (Omit<GeoPointDatum, "value"> & {
    values: readonly number[];
}) | (Omit<PlanarPointDatum, "value"> & {
    values: readonly number[];
});
type PieChartMapOverlayProps = GeographicMapProps & {
    overlays?: readonly GeoPieOverlayDatum[];
    regions?: readonly SchematicRegion[];
};
declare function PieChartMapOverlay({ overlays, regions, className, label, description, features, projection, featureIdProperty, featureLabelProperty, fit, dataAttribution, }?: PieChartMapOverlayProps): React.JSX.Element;
type MapNetworkEdgeDatum = {
    id?: string;
    from: string | number;
    to: string | number;
    value?: number;
    label?: string;
    color?: string;
};
type NetworkMapProps = GeographicMapProps & {
    nodes?: readonly MapPointDatum[];
    edges?: readonly MapNetworkEdgeDatum[];
    regions?: readonly SchematicRegion[];
};
declare function NetworkMap({ nodes, edges, regions, className, label, description, features, projection, featureIdProperty, featureLabelProperty, fit, dataAttribution, }?: NetworkMapProps): React.JSX.Element;
type IsochroneBandDatum = {
    id?: string;
    minutes: number;
    feature: GeoFeature;
    color?: string;
    label?: string;
};
type IsochroneMapProps = GeographicMapProps & {
    /** Real travel-time polygons supplied by a routing/isochrone engine. */
    bands?: readonly IsochroneBandDatum[];
    origin?: GeoCoordinate;
    /** Legacy schematic center. Used only with `rings`. */
    center?: {
        x: number;
        y: number;
    };
    /** Legacy diagram radii; deliberately labeled as diagram units, never minutes. */
    rings?: readonly number[];
};
declare function IsochroneMap({ bands, origin, center, rings, className, label, description, projection, featureIdProperty, featureLabelProperty, fit, dataAttribution, }?: IsochroneMapProps): React.JSX.Element;
type ReferenceLayerMapProps = GeographicMapProps & {
    layers?: readonly GeoReferenceLayer[];
    regions?: readonly SchematicRegion[];
    showGrid?: boolean;
    showLabels?: boolean;
    showScale?: boolean;
};
declare function ReferenceLayerMap({ layers, features, regions, showGrid, showLabels, showScale, className, label, description, projection, featureIdProperty, featureLabelProperty, fit, dataAttribution, }?: ReferenceLayerMapProps): React.JSX.Element;
type ProviderMapAdapterProps = {
    className?: string;
};
declare function AzureMapsAdapter({ className }?: ProviderMapAdapterProps): React.JSX.Element;
declare function ArcGISMapsAdapter({ className }?: ProviderMapAdapterProps): React.JSX.Element;
declare function BingMapsAdapter({ className }?: ProviderMapAdapterProps): React.JSX.Element;
declare function EsriShapefileAdapter({ className }?: ProviderMapAdapterProps): React.JSX.Element;

type SchematicMapProps = {
    className?: string;
    label?: string;
    description?: string;
};
type SchematicRoomDatum = {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    value?: number;
    color?: string;
};
type SchematicZoneDatum = SchematicRoomDatum;
type SchematicBuildingDatum = SchematicRoomDatum;
type FloorPlanMapProps = SchematicMapProps & {
    rooms?: readonly SchematicRoomDatum[];
};
declare function FloorPlanMap({ className, rooms, label, description, }?: FloorPlanMapProps): React.JSX.Element;
type BuildingLayoutMapProps = FloorPlanMapProps & {
    currentLocation?: PlanarPointDatum | null;
};
declare function BuildingLayoutMap({ className, rooms, currentLocation, label, description, }?: BuildingLayoutMapProps): React.JSX.Element;
type SeatingPlanMapProps = SchematicMapProps & {
    rows?: number;
    cols?: number;
    occupiedSeatIds?: readonly string[];
    selectedSeatId?: string | null;
    defaultSelectedSeatId?: string | null;
    onSeatSelect?: (seatId: string) => void;
};
declare function SeatingPlanMap({ className, rows, cols, occupiedSeatIds, selectedSeatId, defaultSelectedSeatId, onSeatSelect, label, description, }?: SeatingPlanMapProps): React.JSX.Element;
type WarehouseLayoutMapProps = SchematicMapProps & {
    zones?: readonly SchematicZoneDatum[];
};
declare function WarehouseLayoutMap({ className, zones, label, description, }?: WarehouseLayoutMapProps): React.JSX.Element;
type CampusMapProps = SchematicMapProps & {
    buildings?: readonly SchematicBuildingDatum[];
};
declare function CampusMap({ className, buildings, label, description, }?: CampusMapProps): React.JSX.Element;
type HexMapProps = SchematicMapProps & {
    values?: readonly number[];
    rows?: number;
    cols?: number;
};
declare function HexMap({ className, values, rows, cols, label, description, }?: HexMapProps): React.JSX.Element;
type TileGridMapProps = SchematicMapProps & {
    cols?: number;
    rows?: number;
    values?: readonly number[];
};
declare function TileGridMap({ className, cols, rows, values, label, description, }?: TileGridMapProps): React.JSX.Element;
type IndoorMapProps = FloorPlanMapProps & {
    route?: readonly PlanarPointDatum[] | null;
};
declare function IndoorMap({ className, rooms, route, label, description, }?: IndoorMapProps): React.JSX.Element;

export { ArcGISMapsAdapter, ArcMap, type ArcMapProps, AzureMapsAdapter, BingMapsAdapter, BubbleMap, type BubbleMapProps, BuildingLayoutMap, type BuildingLayoutMapProps, CampusMap, type CampusMapProps, type ChoroplethMapProps, Column3DMap, type Column3DMapProps, CountryMap, type CountryMapProps, CountyMap, type CountyMapProps, CustomIconMarkerMap, type CustomIconMarkerMapProps, EsriShapefileAdapter, FilledChoroplethMap, type FilledChoroplethMapProps, FloorPlanMap, type FloorPlanMapProps, FlowMap, type FlowMapProps, type GeoCoordinate, type GeoFeature, type GeoFeatureCollection, type GeoFeatureValueDatum, type GeoGeometry, type GeoGeometryCollection, type GeoLayout, type GeoLayoutFeature, type GeoLineStringGeometry, type GeoMultiLineStringGeometry, type GeoMultiPointGeometry, type GeoMultiPolygonGeometry, type GeoPieOverlayDatum, type GeoPointDatum, type GeoPointGeometry, type GeoPolygonGeometry, type GeoProjectionKind, type GeoProperties, type GeoReferenceLayer, type GeoRouteEndpoint, type GeographicMapProps, HeatMapGeo, type HeatMapGeoProps, HexMap, type HexMapProps, ImageMarkerMap, type ImageMarkerMapProps, IndoorMap, type IndoorMapProps, type IsochroneBandDatum, IsochroneMap, type IsochroneMapProps, type MapNetworkEdgeDatum, type MapPointDatum, type MapRouteDatum, type MapValidationResult, MarkerMap, type MarkerMapProps, NetworkMap, type NetworkMapProps, type NormalizedMapPoint, type NormalizedMapRoute, PathMap, type PathMapProps, PieChartMapOverlay, type PieChartMapOverlayProps, type PlanarPointDatum, PointClusterMap, type PointClusterMapProps, type PointSelectionProps, PolygonMap, type PolygonMapProps, type ProjectedPointCluster, ProportionalSymbolMap, type ProportionalSymbolMapProps, type ProviderMapAdapterProps, ReferenceLayerMap, type ReferenceLayerMapProps, RouteMap, type RouteMapProps, type RouteSelectionProps, type SchematicBuildingDatum, type SchematicMapProps, type SchematicRegion, type SchematicRoomDatum, type SchematicZoneDatum, SeatingPlanMap, type SeatingPlanMapProps, ShapeMap, type ShapeMapProps, StateMap, type StateMapProps, TerritoryMap, type TerritoryMapProps, TileGridMap, type TileGridMapProps, WarehouseLayoutMap, type WarehouseLayoutMapProps, clamp, clusterProjectedPoints, createClampedScale, createGeoLayout, featureCollection, featureId, featureLabel, isGeoCoordinate, isGeoPointDatum, isPlanarPointDatum, normalizeFeatureValues, normalizeMapPoints, normalizeMapRoutes, validateFeatureCollection, validateSchematicRegions };
