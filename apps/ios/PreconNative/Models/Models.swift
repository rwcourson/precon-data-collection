import Foundation

// MARK: - Auth

struct PublicUser: Codable, Identifiable, Hashable {
    let id: Int
    let name: String
    let title: String?
    let role: String
    let region: String?
    let preconDepartment: String?
    let email: String?
}

struct DemoAuthResponse: Codable {
    let token: String
    let user: PublicUser
}

struct UsersResponse: Codable {
    let data: [PublicUser]
}

struct MeResponse: Codable {
    let user: PublicUser
    let workspace: WorkspaceInfo?
}

struct WorkspaceInfo: Codable {
    let region: String?
    let label: String?
    let available: [String]?
    let canViewCorporate: Bool?
}

// MARK: - Overview

struct OverviewResponse: Codable {
    let workspace: OverviewWorkspace?
    let bidYear: Int?
    let kpis: OverviewKPIs
    let byStatus: [String: Int]?
    let totalRounds: Int?
}

struct OverviewWorkspace: Codable {
    let region: String?
    let label: String?
}

struct OverviewKPIs: Codable {
    let ytdVolume: Double?
    let ytdVolumeLabel: String?
    let ytdRoundCount: Int?
    let awaitingPostBid: Int?
    let awaitingApproval: Int?
    let winRatePct: Int?
    let wins: Int?
    let decided: Int?
}

// MARK: - Schedule

struct BidScheduleResponse: Codable {
    let data: [ScheduleRow]
    let sections: [ScheduleSectionCount]?
    let count: Int?
}

struct ScheduleSectionCount: Codable {
    let key: String
    let count: Int
}

struct ScheduleRow: Codable, Identifiable {
    var id: Int { roundId }
    let roundId: Int
    let jobId: Int
    let jobNumber: String?
    let jobName: String
    let status: String
    let outcome: String?
    let region: String?
    let preconDepartment: String?
    let marketSector: String?
    let estimatePhase: String?
    let bidDueDate: String?
    let estimateValue: Double?
    let roundNumber: Int?
    let estimateLeadName: String?
    let groupKey: String?
}

struct CreatePursuitBody: Codable {
    let mode: String
    let jobName: String
    let region: String
    let preconDepartment: String
    let estimatePhase: String
    let bidYear: Int
    let initialStatus: String
    let bidDueDate: String?
    let jobNumber: String?
}

struct CreatePursuitResponse: Codable {
    let data: CreatePursuitData
}

struct CreatePursuitData: Codable {
    let jobId: Int?
    let roundId: Int?
    let id: Int?
}

struct JobDetailResponse: Codable {
    let data: JobDetailData
}

struct JobDetailData: Codable {
    let job: JobInfo
    let rounds: [JobRound]
}

struct JobInfo: Codable {
    let jobName: String
    let jobNumber: String?
    let region: String?
}

struct JobRound: Codable, Identifiable {
    let id: Int
    let status: String
    let roundNumber: Int?
    let estimatePhase: String?
}

// MARK: - Rounds / Post-bid

struct RoundDetailResponse: Codable {
    let data: RoundDetailData
}

struct RoundDetailData: Codable {
    let round: [String: JSONValue]
    let job: JobInfo
    let estimateLeadName: String?
    let multiValues: [String: [String]]?
    let fieldDefs: [FieldDef]?
    let referenceLists: [String: [String]]?
    let missingRequired: [String]?
}

struct FieldDef: Codable, Identifiable {
    var id: String { key }
    let key: String
    let label: String
    let type: String
    let tier: String?
    let group: String?
    let listKey: String?
    let note: String?
}

struct SaveRoundBody: Codable {
    let values: [String: String]
    let multiValues: [String: [String]]
    let customValues: [String: String]
}

struct OutcomeBody: Codable {
    let outcome: String
}

// MARK: - Sheets

struct SheetsListResponse: Codable {
    let data: [SheetSummary]
}

struct SheetSummary: Codable, Identifiable {
    let id: Int
    let name: String
    let folder: String?
    let kind: String?
    let pinned: Bool?
    let rowCount: Int?
    let canManage: Bool?
}

/// GET /sheets?archived=1
struct ArchivedSheetsResponse: Codable {
    let data: [ArchivedSheet]
}

struct ArchivedSheet: Codable, Identifiable {
    let id: Int
    let name: String
    let folder: String?
    let archivedAt: String?
    let canRestore: Bool?
}

struct SheetDetailResponse: Codable {
    let data: SheetDetailData
}

struct SheetDetailData: Codable {
    let sheet: SheetMeta
    let columns: [SheetColumn]
    let rows: [SheetRow]
    let kind: String?
    let readOnly: Bool?
    let pinned: Bool?
    let canManage: Bool?
    let pagination: SheetPagination?
}

struct SheetMeta: Codable {
    let name: String
    let kind: String?
}

struct SheetColumn: Codable, Identifiable {
    var id: String { key }
    let key: String
    let label: String
    let type: String?
}

struct SheetRow: Codable, Identifiable {
    let id: Int
    let values: [String: String?]?
}

struct SheetPagination: Codable {
    let total: Int?
    let hasMore: Bool?
}

struct CreateSheetBody: Codable {
    let name: String
    let kind: String
    let folder: String
}

struct CreateSheetResponse: Codable {
    let id: Int?
    let data: CreateSheetId?
}

struct CreateSheetId: Codable {
    let id: Int?
}

struct SheetPatchBody: Codable {
    var action: String?
    var cell: SheetCellPatch?
}

struct SheetCellPatch: Codable {
    let rowId: Int
    let key: String
    let value: String
}

// MARK: - Dashboards / Forecast

struct DashboardResponse: Codable {
    let level: String?
    let focusRegion: String?
    let groupBy: String?
    let groupVolumeTitle: String?
    let groupVolumeSubtitle: String?
    let kpis: [DashboardKPI]
    let headlineMetrics: [DashboardKPI]?
    let statusSeries: [SeriesPoint]?
    let groupVolume: [SeriesPoint]?
    let regionVolume: [SeriesPoint]?
    let empty: Bool?
    let emptyLabel: String?
    let studio: [StudioBoard]?
}

struct DashboardKPI: Codable, Identifiable {
    var id: String { key }
    let key: String
    let label: String
    let value: Double?
    let format: String?
    let group: String?
}

struct SeriesPoint: Codable, Identifiable {
    var id: String { label }
    let label: String
    let value: Double
}

struct StudioBoard: Codable, Identifiable {
    let id: Int
    let name: String
    let scope: String?
    let published: Bool?
}

struct ForecastResponse: Codable {
    let series: ForecastSeries?
    let empty: Bool?
    let emptyLabel: String?
}

struct ForecastSeries: Codable {
    let months: [ForecastMonth]?
}

struct ForecastMonth: Codable {
    let month: String
    let objective: Double
    let adjusted: Double
}

// MARK: - More

struct SearchResponse: Codable {
    let data: [SearchHit]?
}

struct SearchHit: Codable, Identifiable {
    var id: String { "\(type)-\(entityId)" }
    let type: String
    let entityId: Int
    let title: String?
    let subtitle: String?
}

struct NotificationsResponse: Codable {
    let data: [NotificationItem]?
}

struct NotificationItem: Codable, Identifiable {
    let id: Int
    let title: String?
    let body: String?
    let message: String?
}

struct AnnualResponse: Codable {
    let data: AnnualData?
    let empty: Bool?
}

struct AnnualData: Codable {
    let scope: String?
    let fromYear: Int?
    let toYear: Int?
    let years: [AnnualYear]?
    let emptyReason: String?
}

struct AnnualYear: Codable, Identifiable {
    var id: Int { year }
    let year: Int
    let stats: AnnualStats?
}

struct AnnualStats: Codable {
    let rounds: Int?
    let volume: Double?
    let winRate: Double?
}

struct AdminIndexResponse: Codable {
    let sections: [AdminSection]?
}

struct AdminSection: Codable, Identifiable {
    var id: String { key }
    let key: String
    let label: String
}

struct TrashResponse: Codable {
    let data: [TrashItem]?
}

struct TrashItem: Codable, Identifiable {
    var id: String { "\(entityType)-\(entityId)" }
    let entityType: String
    let entityId: Int
    let label: String?
}

struct ReportsResponse: Codable {
    let data: [SavedReport]?
    let presets: [ReportPreset]?
}

struct SavedReport: Codable, Identifiable {
    let id: Int
    let name: String
}

struct ReportPreset: Codable {
    let name: String
    let config: JSONValue?
}

struct ReportRunBody: Codable {
    let action: String
    let name: String?
    let config: JSONValue?
    let id: Int?
}

struct ReportRunResponse: Codable {
    let result: ReportRunResult?
    let id: Int?
    let ok: Bool?
}

struct ReportRunResult: Codable {
    let rowCount: Int?
}

struct TrashRestoreBody: Codable {
    let action: String
    let entityType: String
    let entityId: Int
}

struct AdminListResponse: Codable {
    let data: [AdminRow]?
    let sections: [AdminSection]?
    let role: String?
}

struct AdminRow: Codable, Identifiable {
    var id: String {
        if let n = numberId { return "n-\(n)" }
        if let k = stringId { return "s-\(k)" }
        return UUID().uuidString
    }
    let numberId: Int?
    let stringId: String?
    let raw: [String: JSONValue]

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let obj = try? c.decode([String: JSONValue].self) {
            raw = obj
            if case .number(let n) = obj["id"] { numberId = Int(n); stringId = nil }
            else if case .string(let s) = obj["id"] { stringId = s; numberId = nil }
            else if case .number(let n) = obj["valueId"] { numberId = Int(n); stringId = nil }
            else { numberId = nil; stringId = nil }
        } else {
            raw = [:]
            numberId = nil
            stringId = nil
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        try c.encode(raw)
    }

    var displayTitle: String {
        if case .string(let s) = raw["value"] { return s }
        if case .string(let s) = raw["name"] { return s }
        if case .string(let s) = raw["label"] { return s }
        if case .string(let s) = raw["action"] { return s }
        if case .string(let s) = raw["key"] { return s }
        return raw.keys.sorted().prefix(3).joined(separator: ", ")
    }

    var displaySubtitle: String {
        if case .string(let s) = raw["listKey"] { return s }
        if case .string(let s) = raw["type"] { return s }
        if case .string(let s) = raw["entity"] { return s }
        return ""
    }
}

struct AdminMutationBody: Codable {
    let action: String
    var listKey: String? = nil
    var value: String? = nil
    var text: String? = nil
}

struct AdminMutationResponse: Codable {
    let ok: Bool?
    let preview: [String: JSONValue]?
}

struct ReconUploadBody: Codable {
    let text: String
    let filename: String
    let name: String?
}

struct ReconUploadResponse: Codable {
    let status: String?
    let importId: Int?
    let message: String?
}

struct StudioDetailResponse: Codable {
    let data: StudioDetailData
}

struct StudioDetailData: Codable {
    let dashboard: StudioDashboard
    let widgets: [StudioWidget]
}

struct StudioDashboard: Codable {
    let id: Int
    let name: String
    let description: String?
    let scope: String?
    let region: String?
    let published: Bool?
}

struct StudioWidget: Codable, Identifiable {
    let id: Int
    let sortOrder: Int?
    let config: StudioWidgetConfig?
}

struct StudioWidgetConfig: Codable {
    let title: String?
    let kind: String?
    let metricKey: String?
}

struct CopilotBody: Codable {
    let action: String
    let prompt: String
}

struct CopilotResponse: Codable {
    let response: JSONValue?
}

struct WorkspaceBody: Codable {
    let region: String?
}

/// Loose OK envelope for mutation responses
struct OkEnvelope: Codable {
    let ok: Bool?
    let locked: Bool?
    let pinned: Bool?
    let rowId: Int?
    let id: Int?
}

// MARK: - Flexible JSON

enum JSONValue: Codable, Hashable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null; return }
        if let v = try? c.decode(Bool.self) { self = .bool(v); return }
        if let v = try? c.decode(Double.self) { self = .number(v); return }
        if let v = try? c.decode(String.self) { self = .string(v); return }
        if let v = try? c.decode([String: JSONValue].self) { self = .object(v); return }
        if let v = try? c.decode([JSONValue].self) { self = .array(v); return }
        self = .null
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .string(let s): try c.encode(s)
        case .number(let n): try c.encode(n)
        case .bool(let b): try c.encode(b)
        case .object(let o): try c.encode(o)
        case .array(let a): try c.encode(a)
        case .null: try c.encodeNil()
        }
    }

    var stringValue: String? {
        switch self {
        case .string(let s): return s
        case .number(let n): return String(n)
        case .bool(let b): return b ? "true" : "false"
        default: return nil
        }
    }
}
