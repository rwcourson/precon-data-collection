import SwiftUI
import Charts

struct MoreHubView: View {
    private let sections: [(String, [(String, String, String)])] = [
        ("Dashboards & AI", [
            ("Dashboards", "Corporate · region · division", "chart.bar.fill"),
            ("Forecast", "Projection curves", "chart.line.uptrend.xyaxis"),
            ("Studio", "Personal boards", "paintpalette"),
            ("Reconciliation", "DMR upload & compare", "arrow.left.arrow.right"),
            ("Magnus AI", "Ask Precon data", "sparkles"),
        ]),
        ("Reports & ops", [
            ("Reports", "Builder · export", "doc.text"),
            ("Annual Report", "Yearbook view", "book"),
            ("Admin", "Governance · Destini", "shield.checkered"),
            ("Trash", "Restore soft-deletes", "trash"),
        ]),
        ("Account", [
            ("Search", "Jobs & sheets", "magnifyingglass"),
            ("Notifications", "Alerts & reminders", "bell"),
            ("Settings", "Theme · persona · workspace", "gearshape"),
        ]),
    ]

    var body: some View {
        NavigationStack {
            List {
                ForEach(sections, id: \.0) { section in
                    Section(section.0) {
                        ForEach(section.1, id: \.0) { item in
                            NavigationLink {
                                moreDestination(item.0)
                            } label: {
                                Label {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(item.0)
                                        Text(item.1).font(.caption).foregroundStyle(.secondary)
                                    }
                                } icon: {
                                    Image(systemName: item.2).foregroundStyle(Color.secondary)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("More")
        }
    }

    @ViewBuilder
    private func moreDestination(_ title: String) -> some View {
        switch title {
        case "Dashboards": DashboardsView()
        case "Forecast": ForecastView()
        case "Studio": StudioListView()
        case "Reconciliation": ReconciliationView()
        case "Magnus AI": MagnusView()
        case "Reports": ReportsView()
        case "Annual Report": AnnualView()
        case "Admin": AdminView()
        case "Trash": TrashView()
        case "Search": SearchView()
        case "Notifications": NotificationsView()
        case "Settings": SettingsView()
        default: Text(title)
        }
    }
}

// MARK: - Dashboards

struct DashboardsView: View {
    @State private var level: DashboardLevel = .corporate
    @State private var data: DashboardResponse?
    @State private var loading = true
    @State private var error: String?

    var body: some View {
        Group {
            if loading && data == nil { LoadingBlock() }
            else if let error, data == nil { ErrorBlock(message: error) }
            else if let data, data.empty == true {
                EmptyBlock(message: data.emptyLabel ?? "No rounds")
            } else if let data {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack {
                                ForEach(DashboardLevel.allCases) { l in
                                    Button {
                                        level = l
                                        Task { await load() }
                                    } label: {
                                        Text(l.label)
                                            .font(.caption.weight(.semibold))
                                            .padding(.horizontal, 12)
                                            .padding(.vertical, 7)
                                            .background(Capsule().fill(level == l ? Color.primary : Color.secondary.opacity(0.12)))
                                            .foregroundStyle(level == l ? Color(UIColor.systemBackground) : Color.secondary)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }

                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                            ForEach(data.kpis) { k in
                                KPICard(
                                    label: k.label,
                                    value: Formatters.kpi(k.value, format: k.format),
                                    sub: nil
                                )
                            }
                        }

                        if let series = data.statusSeries, !series.isEmpty {
                            chartCard("Rounds by status", series: series, dollars: false)
                        }

                        if let vol = data.groupVolume ?? data.regionVolume, !vol.isEmpty {
                            chartCard(
                                data.groupVolumeTitle ?? "Pursuit volume",
                                series: vol,
                                dollars: true
                            )
                        }

                        if let studio = data.studio, !studio.isEmpty {
                            Text("Studio boards").font(.headline).foregroundStyle(Color.primary)
                            ForEach(studio.prefix(8)) { s in
                                NavigationLink {
                                    StudioDetailView(boardId: s.id)
                                } label: {
                                    Text(s.name)
                                        .padding(12)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .preconGlassCard()
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    .padding()
                }
            }
        }
        .navigationTitle("Dashboards")
        .task { await load() }
    }

    private func chartCard(_ title: String, series: [SeriesPoint], dollars: Bool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.headline).foregroundStyle(Color.primary)
            Chart(series.prefix(8)) { p in
                BarMark(
                    x: .value("Label", Formatters.shortLabel(p.label, max: 12)),
                    y: .value("Value", p.value)
                )
                .foregroundStyle(Color.primary)
            }
            .frame(height: 180)
            .chartYAxis {
                AxisMarks { val in
                    AxisValueLabel {
                        if let d = val.as(Double.self) {
                            Text(dollars ? Formatters.compactDollars(d) : "\(Int(d))")
                                .font(.caption2)
                        }
                    }
                }
            }
        }
        .padding(14)
        .preconGlassCard()
    }

    private func load() async {
        if data == nil { loading = true }
        do {
            data = try await APIClient.shared.get("/dashboards?level=\(level.rawValue)")
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }
}

// MARK: - Forecast

struct ForecastView: View {
    @State private var data: ForecastResponse?
    @State private var loading = true
    @State private var error: String?

    var body: some View {
        Group {
            if loading { LoadingBlock() }
            else if let error { ErrorBlock(message: error) }
            else if data?.empty == true || (data?.series?.months ?? []).isEmpty {
                EmptyBlock(message: data?.emptyLabel ?? "No forecast points yet")
            } else if let months = data?.series?.months {
                let slice = Array(months.suffix(12))
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        let obj = slice.reduce(0.0) { $0 + $1.objective }
                        let adj = slice.reduce(0.0) { $0 + $1.adjusted }
                        HStack {
                            KPICard(label: "Objective", value: Formatters.compactDollars(obj))
                            KPICard(label: "Risk-adjusted", value: Formatters.compactDollars(adj))
                        }

                        VStack(alignment: .leading, spacing: 8) {
                            Text("Monthly curves").font(.headline).foregroundStyle(Color.primary)
                            Chart {
                                ForEach(Array(slice.enumerated()), id: \.offset) { _, m in
                                    LineMark(
                                        x: .value("M", String(m.month.suffix(2))),
                                        y: .value("Obj", m.objective)
                                    )
                                    .foregroundStyle(Color.primary)
                                    AreaMark(
                                        x: .value("M", String(m.month.suffix(2))),
                                        y: .value("Obj", m.objective)
                                    )
                                    .foregroundStyle(Color.secondary.opacity(0.15))
                                }
                                ForEach(Array(slice.enumerated()), id: \.offset) { _, m in
                                    LineMark(
                                        x: .value("M", String(m.month.suffix(2))),
                                        y: .value("Adj", m.adjusted)
                                    )
                                    .foregroundStyle(PreconTheme.copper)
                                }
                            }
                            .frame(height: 200)
                            .chartYAxis {
                                AxisMarks { val in
                                    AxisValueLabel {
                                        if let d = val.as(Double.self) {
                                            Text(Formatters.compactDollars(d)).font(.caption2)
                                        }
                                    }
                                }
                            }
                        }
                        .padding(14)
                        .preconGlassCard()
                    }
                    .padding()
                }
            }
        }
        .navigationTitle("Forecast")
        .task {
            do {
                data = try await APIClient.shared.get("/forecast")
            } catch {
                self.error = error.localizedDescription
            }
            loading = false
        }
    }
}

// MARK: - Studio

struct StudioListView: View {
    @State private var boards: [StudioBoard] = []
    @State private var loading = true
    @State private var error: String?

    var body: some View {
        Group {
            if loading { LoadingBlock() }
            else if let error { ErrorBlock(message: error) }
            else if boards.isEmpty { EmptyBlock(message: "No studio boards") }
            else {
                List(boards) { b in
                    NavigationLink {
                        StudioDetailView(boardId: b.id)
                    } label: {
                        VStack(alignment: .leading) {
                            Text(b.name)
                            Text(b.scope ?? (b.published == true ? "Published" : "Personal"))
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle("Studio")
        .task {
            do {
                let res: DashboardResponse = try await APIClient.shared.get("/dashboards?level=corporate")
                boards = res.studio ?? []
            } catch {
                self.error = error.localizedDescription
                boards = []
            }
            loading = false
        }
    }
}

struct StudioDetailView: View {
    let boardId: Int
    @State private var detail: StudioDetailData?
    @State private var loading = true
    @State private var error: String?

    var body: some View {
        Group {
            if loading { LoadingBlock() }
            else if let error { ErrorBlock(message: error) }
            else if let detail {
                List {
                    Section {
                        if let d = detail.dashboard.description, !d.isEmpty {
                            Text(d).foregroundStyle(.secondary)
                        }
                        HStack {
                            Text(detail.dashboard.published == true ? "Published" : "Draft")
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 8).padding(.vertical, 4)
                                .background(Capsule().fill(PreconTheme.steel.opacity(0.25)))
                            if let scope = detail.dashboard.scope {
                                Text(scope).font(.caption).foregroundStyle(.secondary)
                            }
                            if let region = detail.dashboard.region {
                                Text(region).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                    Section("Widgets (\(detail.widgets.count))") {
                        if detail.widgets.isEmpty {
                            Text("No widgets on this board yet").foregroundStyle(.secondary)
                        } else {
                            ForEach(detail.widgets) { w in
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(w.config?.title ?? "Widget \(w.id)")
                                        .font(.body.weight(.semibold))
                                    Text("\(w.config?.kind ?? "widget")\(w.config?.metricKey.map { " · \($0)" } ?? "")")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            } else {
                EmptyBlock(message: "Dashboard not found")
            }
        }
        .navigationTitle(detail?.dashboard.name ?? "Board")
        .task {
            do {
                let res: StudioDetailResponse = try await APIClient.shared.get("/dashboards/\(boardId)")
                detail = res.data
            } catch {
                self.error = error.localizedDescription
            }
            loading = false
        }
    }
}

// MARK: - Reconciliation (DMR)

struct ReconciliationView: View {
    @State private var text = "JOB-001,1000000"
    @State private var status: String?
    @State private var busy = false

    var body: some View {
        Form {
            Section {
                Text("Paste CSV lines: jobNumber,dmrValue[,jobName,region]")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                TextEditor(text: $text)
                    .frame(minHeight: 140)
                    .font(.body.monospaced())
            } header: {
                Text("DMR upload")
            }
            Section {
                Button(busy ? "Uploading…" : "Upload") {
                    Task { await upload() }
                }
                .disabled(busy || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                if let status {
                    Text(status)
                        .font(.footnote)
                        .foregroundStyle(status.hasPrefix("success") ? PreconTheme.success : .primary)
                }
            }
        }
        .navigationTitle("DMR Reconciliation")
    }

    private func upload() async {
        busy = true
        status = nil
        do {
            let res: ReconUploadResponse = try await APIClient.shared.post(
                "/reconciliation",
                body: ReconUploadBody(
                    text: text,
                    filename: "dmr.csv",
                    name: "Native DMR upload"
                )
            )
            if let id = res.importId {
                status = "success: import \(id)"
            } else {
                status = "success: \(res.status ?? "ok")"
            }
        } catch {
            status = error.localizedDescription
        }
        busy = false
    }
}

// MARK: - Reports

struct ReportsView: View {
    @State private var reports: [SavedReport] = []
    @State private var presets: [ReportPreset] = []
    @State private var loading = true
    @State private var error: String?
    @State private var runInfo: String?
    @State private var busy = false

    var body: some View {
        List {
            if let error {
                Section { Text(error).foregroundStyle(.red) }
            }
            if let runInfo {
                Section("Last run") {
                    Text(runInfo).font(.footnote)
                }
            }
            if !presets.isEmpty {
                Section("Presets") {
                    ForEach(Array(presets.enumerated()), id: \.offset) { _, p in
                        Button {
                            Task { await runPreset(p) }
                        } label: {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(p.name).foregroundStyle(Color.primary)
                                    Text(busy ? "Running…" : "Tap to run & save")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Image(systemName: "play.circle.fill")
                                    .foregroundStyle(Color.primary)
                            }
                        }
                        .disabled(busy || p.config == nil)
                    }
                }
            }
            Section("Saved") {
                if reports.isEmpty {
                    Text("No saved reports yet").foregroundStyle(.secondary)
                } else {
                    ForEach(reports) { Text($0.name) }
                }
            }
        }
        .navigationTitle("Reports")
        .overlay { if loading { ProgressView() } }
        .refreshable { await load() }
        .task { await load() }
    }

    private func load() async {
        if reports.isEmpty && presets.isEmpty { loading = true }
        do {
            let res: ReportsResponse = try await APIClient.shared.get("/reports")
            reports = res.data ?? []
            presets = res.presets ?? []
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }

    private func runPreset(_ p: ReportPreset) async {
        guard let config = p.config else {
            runInfo = "Preset has no config"
            return
        }
        busy = true
        runInfo = nil
        do {
            let run: ReportRunResponse = try await APIClient.shared.post(
                "/reports",
                body: ReportRunBody(action: "run", name: nil, config: config, id: nil)
            )
            let count = run.result?.rowCount ?? 0
            runInfo = "Rows: \(count)"
            let _: ReportRunResponse = try await APIClient.shared.post(
                "/reports",
                body: ReportRunBody(
                    action: "save",
                    name: "Native \(p.name)",
                    config: config,
                    id: nil
                )
            )
            await load()
        } catch {
            runInfo = error.localizedDescription
        }
        busy = false
    }
}

// MARK: - Admin

struct AdminView: View {
    @State private var sections: [AdminSection] = []
    @State private var loading = true
    @State private var error: String?

    var body: some View {
        Group {
            if loading { LoadingBlock() }
            else if let error { ErrorBlock(message: error) }
            else if sections.isEmpty { EmptyBlock(message: "No admin sections") }
            else {
                List(sections) { s in
                    NavigationLink {
                        AdminSectionView(sectionKey: s.key, sectionLabel: s.label)
                    } label: {
                        Text(s.label)
                    }
                }
            }
        }
        .navigationTitle("Admin")
        .task {
            do {
                let res: AdminIndexResponse = try await APIClient.shared.get("/admin?section=index")
                sections = res.sections ?? []
            } catch {
                self.error = error.localizedDescription
            }
            loading = false
        }
    }
}

struct AdminSectionView: View {
    let sectionKey: String
    let sectionLabel: String
    @State private var rows: [AdminRow] = []
    @State private var loading = true
    @State private var error: String?
    @State private var msg: String?
    @State private var csv = "Job Number,Estimate Value\nTBD-1,1000000"
    @State private var busy = false

    var body: some View {
        List {
            if let msg {
                Section { Text(msg).font(.footnote).foregroundStyle(Color.primary) }
            }
            if let error {
                Section { Text(error).foregroundStyle(.red) }
            }

            if sectionKey == "lists" {
                Section("Actions") {
                    Button("Add sample market sector") {
                        Task { await addReference() }
                    }
                    .disabled(busy)
                }
            }

            if sectionKey == "destini" {
                Section("Destini CSV preview") {
                    TextEditor(text: $csv)
                        .frame(minHeight: 100)
                        .font(.caption.monospaced())
                    Button(busy ? "Previewing…" : "Preview Destini") {
                        Task { await destiniPreview() }
                    }
                    .disabled(busy)
                }
            }

            Section("Data (\(rows.count))") {
                if loading {
                    ProgressView()
                } else if rows.isEmpty {
                    Text("No rows (or section is action-only)").foregroundStyle(.secondary)
                } else {
                    ForEach(rows.prefix(100)) { row in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(row.displayTitle).font(.body.weight(.medium))
                            if !row.displaySubtitle.isEmpty {
                                Text(row.displaySubtitle).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle(sectionLabel)
        .refreshable { await load() }
        .task { await load() }
    }

    private func load() async {
        loading = true
        error = nil
        do {
            let res: AdminListResponse = try await APIClient.shared.get("/admin?section=\(sectionKey)")
            rows = res.data ?? []
        } catch {
            // Some sections return non-array payloads
            self.error = error.localizedDescription
            rows = []
        }
        loading = false
    }

    private func addReference() async {
        busy = true
        msg = nil
        do {
            let _: AdminMutationResponse = try await APIClient.shared.post(
                "/admin",
                body: AdminMutationBody(
                    action: "add-reference",
                    listKey: "marketSector",
                    value: "Native \(Int(Date().timeIntervalSince1970))"
                )
            )
            msg = "Value added"
            await load()
        } catch {
            msg = error.localizedDescription
        }
        busy = false
    }

    private func destiniPreview() async {
        busy = true
        msg = nil
        do {
            let res: AdminMutationResponse = try await APIClient.shared.post(
                "/admin",
                body: AdminMutationBody(action: "destini-preview", text: csv)
            )
            if let preview = res.preview {
                msg = "Preview keys: \(preview.keys.sorted().joined(separator: ", "))"
            } else {
                msg = "Preview complete"
            }
        } catch {
            msg = error.localizedDescription
        }
        busy = false
    }
}

// MARK: - Trash

struct TrashView: View {
    @State private var items: [TrashItem] = []
    @State private var loading = true
    @State private var error: String?
    @State private var busyId: String?

    var body: some View {
        Group {
            if loading { LoadingBlock() }
            else if let error { ErrorBlock(message: error) }
            else if items.isEmpty { EmptyBlock(message: "Trash is empty") }
            else {
                List(items) { t in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(t.label ?? "\(t.entityType) #\(t.entityId)")
                            .font(.body.weight(.semibold))
                        Text(t.entityType).font(.caption).foregroundStyle(.secondary)
                        Button {
                            Task { await restore(t) }
                        } label: {
                            Text(busyId == t.id ? "Restoring…" : "Restore")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .tint(Color.primary)
                        .disabled(busyId != nil)
                    }
                    .padding(.vertical, 4)
                }
            }
        }
        .navigationTitle("Trash")
        .refreshable { await load() }
        .task { await load() }
    }

    private func load() async {
        if items.isEmpty { loading = true }
        do {
            let res: TrashResponse = try await APIClient.shared.get("/trash")
            items = res.data ?? []
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }

    private func restore(_ item: TrashItem) async {
        busyId = item.id
        do {
            let _: OkEnvelope = try await APIClient.shared.post(
                "/trash",
                body: TrashRestoreBody(
                    action: "restore",
                    entityType: item.entityType,
                    entityId: item.entityId
                )
            )
            await load()
        } catch {
            self.error = error.localizedDescription
        }
        busyId = nil
    }
}

// MARK: - Settings / Search / Notifications / Annual / Magnus

struct SettingsView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        List {
            Section("Appearance") {
                Picker("Theme", selection: Binding(
                    get: { session.themePreference },
                    set: { session.setTheme($0) }
                )) {
                    ForEach(SessionStore.ThemePreference.allCases, id: \.self) {
                        Text($0.label).tag($0)
                    }
                }
            }
            Section("Workspace") {
                Text(session.workspaceLabel)
                ForEach(session.availableRegions, id: \.self) { r in
                    Button(r) { Task { await session.setWorkspace(r) } }
                }
                Button("Corporate") { Task { await session.setWorkspace("corporate") } }
            }
            Section("Account") {
                if let u = session.user {
                    Text(u.name)
                    Text(u.role).foregroundStyle(.secondary)
                }
                Button("Sign out", role: .destructive) {
                    Task { await session.signOut() }
                }
            }
            Section("API") {
                Text(APIConfig.baseURL.absoluteString).font(.caption)
            }
        }
        .navigationTitle("Settings")
    }
}

struct SearchView: View {
    @State private var q = ""
    @State private var hits: [SearchHit] = []
    @State private var error: String?

    var body: some View {
        List {
            Section {
                TextField("Search jobs & sheets", text: $q)
                    .textInputAutocapitalization(.never)
                    .onSubmit { Task { await run() } }
            }
            if let error {
                Text(error).foregroundStyle(.red)
            }
            ForEach(hits) { h in
                VStack(alignment: .leading) {
                    Text(h.title ?? "—").font(.body.weight(.semibold))
                    Text("\(h.type) · \(h.subtitle ?? "")").font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Search")
        .toolbar {
            Button("Go") { Task { await run() } }
        }
    }

    private func run() async {
        guard !q.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        do {
            let enc = q.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? q
            let res: SearchResponse = try await APIClient.shared.get("/search?q=\(enc)")
            hits = res.data ?? []
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct NotificationsView: View {
    @State private var items: [NotificationItem] = []
    @State private var loading = true

    var body: some View {
        Group {
            if loading { LoadingBlock() }
            else if items.isEmpty { EmptyBlock(message: "No notifications") }
            else {
                List(items) { n in
                    VStack(alignment: .leading) {
                        Text(n.title ?? "Notification").font(.body.weight(.semibold))
                        Text(n.body ?? n.message ?? "").font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .navigationTitle("Notifications")
        .toolbar {
            Button("Mark all read") {
                Task {
                    do {
                        let _: OkEnvelope = try await APIClient.shared.postEmpty("/notifications")
                        await load()
                    } catch {}
                }
            }
        }
        .task { await load() }
    }

    private func load() async {
        do {
            let res: NotificationsResponse = try await APIClient.shared.get("/notifications")
            items = res.data ?? []
        } catch { items = [] }
        loading = false
    }
}

struct AnnualView: View {
    @State private var data: AnnualData?
    @State private var loading = true
    @State private var error: String?

    var body: some View {
        Group {
            if loading { LoadingBlock() }
            else if let error { ErrorBlock(message: error) }
            else if let data {
                if let reason = data.emptyReason {
                    EmptyBlock(message: reason)
                } else {
                    List {
                        Section("Scope") {
                            Text(data.scope ?? "—")
                            Text("\(data.fromYear ?? 0)–\(data.toYear ?? 0)").foregroundStyle(.secondary)
                        }
                        Section("Years") {
                            ForEach(data.years ?? []) { y in
                                HStack {
                                    Text("\(y.year)")
                                    Spacer()
                                    Text("\(y.stats?.rounds ?? 0) rounds · \(Formatters.compactDollars(y.stats?.volume))")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Annual Report")
        .task {
            do {
                let res: AnnualResponse = try await APIClient.shared.get("/reports/annual")
                data = res.data
            } catch {
                self.error = error.localizedDescription
            }
            loading = false
        }
    }
}

struct MagnusView: View {
    @State private var prompt = "Summarize Central region pipeline"
    @State private var response = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        Form {
            Section("Ask Magnus") {
                TextEditor(text: $prompt)
                    .frame(minHeight: 80)
                Button(busy ? "Thinking…" : "Ask") {
                    Task { await ask() }
                }
                .disabled(busy)
            }
            if let error { Section { Text(error).foregroundStyle(.red) } }
            if !response.isEmpty {
                Section("Response") { Text(response) }
            }
        }
        .navigationTitle("Magnus AI")
    }

    private func ask() async {
        busy = true
        error = nil
        do {
            let res: CopilotResponse = try await APIClient.shared.post(
                "/copilot",
                body: CopilotBody(action: "ask", prompt: prompt)
            )
            if case .string(let s) = res.response {
                response = s
            } else if case .object(let o) = res.response, case .string(let m) = o["message"] {
                response = m
            } else {
                response = String(describing: res.response)
            }
        } catch {
            self.error = error.localizedDescription
        }
        busy = false
    }
}
