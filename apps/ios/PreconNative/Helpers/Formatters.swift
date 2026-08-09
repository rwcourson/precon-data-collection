import Foundation

/// Pure formatters — unit-tested against live API shapes.
enum Formatters {
    static func compactDollars(_ n: Double?) -> String {
        guard let n, n.isFinite else { return "—" }
        let abs = abs(n)
        let sign = n < 0 ? "-" : ""
        if abs >= 1_000_000_000 { return String(format: "%@%.1fB", sign + "$", abs / 1_000_000_000) }
        if abs >= 1_000_000 { return String(format: "%@%.1fM", sign + "$", abs / 1_000_000) }
        if abs >= 1_000 { return String(format: "%@%.0fK", sign + "$", abs / 1_000) }
        return "\(sign)$\(Int(abs.rounded()))"
    }

    static func kpi(_ value: Double?, format: String?) -> String {
        guard let value, value.isFinite else { return "—" }
        switch format {
        case "dollars": return compactDollars(value)
        case "percent":
            let pct = value > 0 && value <= 1 ? value * 100 : value
            return String(format: "%.1f%%", pct)
        case "number": return "\(Int(value.rounded()))"
        default: return String(format: "%.2f", value)
        }
    }

    static func humanDate(_ iso: String?) -> String {
        guard let iso, !iso.isEmpty else { return "No due date" }
        let prefix = String(iso.prefix(10))
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        guard let d = f.date(from: prefix) else { return iso }
        f.dateStyle = .medium
        f.timeStyle = .none
        f.locale = Locale(identifier: "en_US")
        return f.string(from: d)
    }

    static func shortLabel(_ s: String, max: Int = 10) -> String {
        let t = s.replacingOccurrences(of: "_", with: " ")
        if t.count <= max { return t }
        return String(t.prefix(max - 1)) + "…"
    }

    static func axisTick(_ label: String, dollars: Bool) -> String {
        let cleaned = label.replacingOccurrences(of: ",", with: "")
        guard let n = Double(cleaned) else { return label }
        if dollars || abs(n) >= 10_000 { return compactDollars(n) }
        return "\(Int(n.rounded()))"
    }
}

// MARK: - Due bands (schedule timeline)

enum DueBand: String, CaseIterable, Identifiable {
    case overdue, thisWeek, nextWeek, later, none
    var id: String { rawValue }

    var label: String {
        switch self {
        case .overdue: return "Overdue"
        case .thisWeek: return "This week"
        case .nextWeek: return "Next week"
        case .later: return "Later"
        case .none: return "No due date"
        }
    }
}

enum DueBandLogic {
    static func band(for iso: String?, now: Date = Date()) -> DueBand {
        guard let iso, let due = parseDay(iso) else { return .none }
        let cal = Calendar.current
        let today = cal.startOfDay(for: now)
        let days = cal.dateComponents([.day], from: today, to: due).day ?? 0
        if days < 0 { return .overdue }
        if days <= 7 { return .thisWeek }
        if days <= 14 { return .nextWeek }
        return .later
    }

    static func parseDay(_ iso: String) -> Date? {
        let prefix = String(iso.prefix(10))
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.date(from: prefix).map { Calendar.current.startOfDay(for: $0) }
    }

    static func group(_ rows: [ScheduleRow], now: Date = Date()) -> [(DueBand, [ScheduleRow])] {
        var map: [DueBand: [ScheduleRow]] = Dictionary(uniqueKeysWithValues: DueBand.allCases.map { ($0, []) })
        for r in rows {
            map[band(for: r.bidDueDate, now: now), default: []].append(r)
        }
        for b in DueBand.allCases {
            map[b]?.sort {
                (parseDay($0.bidDueDate ?? "") ?? .distantFuture)
                    < (parseDay($1.bidDueDate ?? "") ?? .distantFuture)
            }
        }
        return DueBand.allCases.compactMap { b in
            guard let list = map[b], !list.isEmpty else { return nil }
            return (b, list)
        }
    }
}

// MARK: - Sheet matrix

struct SheetMatrix {
    let headers: [String]
    let keys: [String]
    let body: [(rowId: Int, cells: [String])]

    static func build(columns: [SheetColumn], rows: [SheetRow]) -> SheetMatrix {
        let keys = columns.map(\.key)
        let headers = columns.map(\.label)
        let body = rows.map { r -> (Int, [String]) in
            let cells = keys.map { k in
                let v = r.values?[k] ?? nil
                let t = (v ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                return t.isEmpty ? "—" : t
            }
            return (r.id, cells)
        }
        return SheetMatrix(headers: headers, keys: keys, body: body)
    }

    var isAligned: Bool {
        guard !headers.isEmpty else { return false }
        return body.allSatisfy { $0.cells.count == headers.count }
    }
}

// MARK: - Dashboard level (web-aligned)

enum DashboardLevel: String, CaseIterable, Identifiable {
    case corporate, region, division
    var id: String { rawValue }
    var label: String {
        switch self {
        case .corporate: return "Corporate"
        case .region: return "Region"
        case .division: return "Division"
        }
    }
}

// MARK: - Sheet list presentation (keep in sync with mobile-data-display.ts)

enum SheetDisplay {
    /// Known keys → polished labels. Seed/import often ships `pcn_*` / snake_case.
    private static let labels: [String: String] = [
        "pcn_bid_schedule": "Bid Schedule",
        "bid_schedule": "Bid Schedule",
        "pcn_post_bid": "Post Bid",
        "post_bid": "Post Bid",
        "pcn_project_forecast": "Project Forecast",
        "project_forecast": "Project Forecast",
        "pcn_historical_projects": "Historical Projects",
        "historical_projects": "Historical Projects",
        "pcn_annual_stats": "Annual Stats",
        "annual_stats": "Annual Stats",
        "pcn_contacts": "Contacts",
        "contacts": "Contacts",
        "pcn_labor_rates": "Labor Rates",
        "labor_rates": "Labor Rates",
        "pcn_labor_rate_history": "Labor Rate History",
        "labor_rate_history": "Labor Rate History",
        "pcn_equipment_rates": "Equipment Rates",
        "equipment_rates": "Equipment Rates",
        "pcn_equipment_rate_history": "Equipment Rate History",
        "equipment_rate_history": "Equipment Rate History",
        "pcn_unit_prices": "Unit Prices",
        "unit_prices": "Unit Prices",
        "pcn_unit_price_history": "Unit Price History",
        "unit_price_history": "Unit Price History",
        "pcn_gmp_history": "GMP History",
        "gmp_history": "GMP History",
        "pcn_sub_rates": "Subcontractor Rates",
        "sub_rates": "Subcontractor Rates",
        "pcn_sub_rate_history": "Subcontractor Rate History",
        "sub_rate_history": "Subcontractor Rate History",
    ]

    /// Lower rank = higher in list (core B&G workflow first).
    private static let ranks: [String: Int] = [
        "pcn_bid_schedule": 10, "bid_schedule": 10,
        "pcn_post_bid": 20, "post_bid": 20,
        "pcn_project_forecast": 30, "project_forecast": 30,
        "pcn_historical_projects": 40, "historical_projects": 40,
        "pcn_annual_stats": 50, "annual_stats": 50,
        "pcn_contacts": 60, "contacts": 60,
        "pcn_labor_rates": 70, "labor_rates": 70,
        "pcn_labor_rate_history": 71, "labor_rate_history": 71,
        "pcn_equipment_rates": 80, "equipment_rates": 80,
        "pcn_equipment_rate_history": 81, "equipment_rate_history": 81,
        "pcn_unit_prices": 90, "unit_prices": 90,
        "pcn_unit_price_history": 91, "unit_price_history": 91,
        "pcn_gmp_history": 100, "gmp_history": 100,
        "pcn_sub_rates": 110, "sub_rates": 110,
        "pcn_sub_rate_history": 111, "sub_rate_history": 111,
    ]

    private static let acronyms: Set<String> = [
        "GMP", "RPD", "CBG", "BG", "ID", "AL", "FL", "GA", "TX", "CEN", "CAR",
    ]

    private static func normalizeKey(_ name: String) -> String {
        name.trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: #"\s+"#, with: "_", options: .regularExpression)
    }

    /// Never show raw `pcn_bid_schedule` in the UI.
    static func displayName(_ name: String?) -> String {
        let raw = (name ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else { return "Untitled sheet" }

        let key = normalizeKey(raw)
        if let hit = labels[key] { return hit }
        let stripped = key.replacingOccurrences(of: #"^pcn_"#, with: "", options: .regularExpression)
        if let hit = labels[stripped] { return hit }
        if let hit = labels["pcn_\(stripped)"] { return hit }

        // Already a human title — keep, but drop accidental pcn_ prefix.
        if raw.contains(where: { $0.isWhitespace }) && raw.contains(where: { $0.isUppercase }) {
            let cleaned = raw.replacingOccurrences(of: #"^pcn[_\s]+"#, with: "", options: [.regularExpression, .caseInsensitive])
            return cleaned.isEmpty ? raw : cleaned
        }

        var s = raw.replacingOccurrences(of: #"^pcn_"#, with: "", options: [.regularExpression, .caseInsensitive])
        if s.contains("_") || s.contains("-") || s == s.lowercased() {
            s = s
                .replacingOccurrences(of: #"[_-]+"#, with: " ", options: .regularExpression)
                .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
                .trimmingCharacters(in: .whitespaces)
            return s.split(separator: " ").map { word -> String in
                let w = String(word)
                let upper = w.uppercased()
                if acronyms.contains(upper) { return upper }
                guard let first = w.first else { return w }
                return String(first).uppercased() + w.dropFirst().lowercased()
            }.joined(separator: " ")
        }
        return s
    }

    static func folderLabel(_ folder: String?) -> String {
        let t = (folder ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if t.isEmpty || t == "—" { return "General" }
        return t
    }

    static func kindLabel(_ kind: String?) -> String {
        kind == "view" ? "View" : "Grid"
    }

    static func sortRank(_ name: String?) -> Int {
        let key = normalizeKey(name ?? "")
        if let r = ranks[key] { return r }
        let stripped = key.replacingOccurrences(of: #"^pcn_"#, with: "", options: .regularExpression)
        if let r = ranks[stripped] { return r }
        if let r = ranks["pcn_\(stripped)"] { return r }
        return 1000
    }

    static func subtitle(folder: String?, kind: String?, rowCount: Int?, pinned: Bool?) -> String {
        var parts = [
            folderLabel(folder),
            kindLabel(kind),
            "\((rowCount ?? 0).formatted()) rows",
        ]
        if pinned == true { parts.append("Pinned") }
        return parts.joined(separator: " · ")
    }

    /// Pinned first → workflow rank → folder → display name.
    static func sort(_ sheets: [SheetSummary]) -> [SheetSummary] {
        sheets.sorted { a, b in
            let pinA = a.pinned == true ? 0 : 1
            let pinB = b.pinned == true ? 0 : 1
            if pinA != pinB { return pinA < pinB }
            let rankA = sortRank(a.name)
            let rankB = sortRank(b.name)
            if rankA != rankB { return rankA < rankB }
            let fa = folderLabel(a.folder).localizedCaseInsensitiveCompare(folderLabel(b.folder))
            if fa != .orderedSame { return fa == .orderedAscending }
            return displayName(a.name).localizedCaseInsensitiveCompare(displayName(b.name)) == .orderedAscending
        }
    }

    static func filter(_ sheets: [SheetSummary], query: String) -> [SheetSummary] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return sheets }
        return sheets.filter { s in
            let hay = [
                displayName(s.name),
                s.name,
                folderLabel(s.folder),
                kindLabel(s.kind),
            ].joined(separator: " ").lowercased()
            return hay.contains(q)
        }
    }

    static func groupByFolder(_ sheets: [SheetSummary]) -> [(folder: String, sheets: [SheetSummary])] {
        let sorted = sort(sheets)
        var order: [String] = []
        var map: [String: [SheetSummary]] = [:]
        for s in sorted {
            let f = folderLabel(s.folder)
            if map[f] == nil {
                map[f] = []
                order.append(f)
            }
            map[f, default: []].append(s)
        }
        return order.map { (folder: $0, sheets: map[$0] ?? []) }
    }

    /// Detail Archive toolbar — same gate as list swipe and web SheetCard.
    static func canShowArchive(_ canManage: Bool?) -> Bool {
        canManage == true
    }
}
