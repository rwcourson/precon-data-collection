import SwiftUI

struct PostBidListView: View {
    @State private var rows: [ScheduleRow] = []
    @State private var filter = "queue"
    @State private var loading = true
    @State private var error: String?

    private let filters = [
        ("queue", "Needs entry"),
        ("locked", "Locked"),
        ("all", "All"),
    ]

    private var visible: [ScheduleRow] {
        switch filter {
        case "queue":
            return rows.filter { ["submitted", "post_bid", "outstanding"].contains($0.status) }
        case "locked":
            return rows.filter { $0.status == "locked" }
        default:
            return rows
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack {
                        ForEach(filters, id: \.0) { key, label in
                            Button {
                                filter = key
                            } label: {
                                Text(label)
                                    .font(.caption.weight(.semibold))
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 7)
                                    .background(
                                        Capsule().fill(filter == key ? Color.primary : Color.secondary.opacity(0.12))
                                    )
                                    .foregroundStyle(filter == key ? Color(UIColor.systemBackground) : Color.secondary)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding()
                }

                if loading && rows.isEmpty {
                    LoadingBlock()
                } else if let error, rows.isEmpty {
                    ErrorBlock(message: error)
                } else if visible.isEmpty {
                    EmptyBlock(message: "No rounds in this filter")
                } else {
                    List(visible) { row in
                        NavigationLink {
                            RoundEntryView(roundId: row.roundId)
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    Text(row.jobName).font(.body.weight(.semibold))
                                    Spacer()
                                    StatusBadge(status: row.status)
                                }
                                Text("\(row.jobNumber ?? "—") · \(row.estimatePhase ?? "")")
                                    .font(.caption).foregroundStyle(.secondary)
                                Text("Due \(Formatters.humanDate(row.bidDueDate))")
                                    .font(.caption.weight(.medium)).foregroundStyle(Color.primary)
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("Post-Bid")
            .refreshable { await load() }
            .task { await load() }
        }
    }

    private func load() async {
        if rows.isEmpty { loading = true }
        do {
            let res: BidScheduleResponse = try await APIClient.shared.get("/bid-schedule?section=all")
            rows = res.data.filter {
                ["submitted", "post_bid", "locked", "outstanding"].contains($0.status)
            }
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }
}

struct RoundEntryView: View {
    let roundId: Int
    @EnvironmentObject private var session: SessionStore
    @State private var detail: RoundDetailData?
    @State private var values: [String: String] = [:]
    @State private var multi: [String: [String]] = [:]
    @State private var showOptional = false
    @State private var loading = true
    @State private var error: String?
    @State private var banner: String?
    @State private var saving = false

    private var canLock: Bool {
        let role = session.user?.role
        return role == "rpd" || role == "corporate_admin"
    }

    var body: some View {
        Group {
            if loading { LoadingBlock() }
            else if let error, detail == nil { ErrorBlock(message: error) }
            else if let detail {
                form(detail)
            }
        }
        .navigationTitle("Round")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func form(_ detail: RoundDetailData) -> some View {
        let defs = FieldVisibility.filterDefs(detail.fieldDefs ?? [], showOptional: showOptional)
        let groups = Dictionary(grouping: defs) { $0.group ?? "Fields" }

        return Form {
            Section {
                HStack {
                    StatusBadge(status: detail.round["status"]?.stringValue ?? "—")
                    Spacer()
                    Text("Lead: \(detail.estimateLeadName ?? "—")")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Text(detail.job.jobName).font(.headline)
                Text(detail.job.jobNumber ?? "").foregroundStyle(.secondary)
            }

            if let missing = detail.missingRequired, !missing.isEmpty {
                Section("Missing required (\(missing.count))") {
                    ForEach(missing.prefix(12), id: \.self) { m in
                        Text("• \(m)").font(.caption).foregroundStyle(.orange)
                    }
                }
            } else {
                Section {
                    Text("All required fields complete").foregroundStyle(PreconTheme.success)
                }
            }

            if let banner {
                Section { Text(banner).foregroundStyle(PreconTheme.success) }
            }

            Toggle("Show optional fields", isOn: $showOptional)

            ForEach(groups.keys.sorted(), id: \.self) { group in
                Section(group) {
                    ForEach(groups[group] ?? []) { field in
                        fieldEditor(field, lists: detail.referenceLists ?? [:])
                    }
                }
            }

            Section {
                Button(saving ? "Saving…" : "Save all fields") {
                    Task { await save() }
                }
                .disabled(saving)

                if canLock {
                    Button("Approve & Lock") {
                        Task { await approveLock() }
                    }
                    Button("Mark successful") {
                        Task { await setOutcome("successful") }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func fieldEditor(_ field: FieldDef, lists: [String: [String]]) -> some View {
        if field.type == "dropdown", let listKey = field.listKey, let opts = lists[listKey] {
            Picker(field.label, selection: binding(field.key)) {
                Text("—").tag("")
                ForEach(opts, id: \.self) { Text($0).tag($0) }
            }
        } else if field.type == "multi", let listKey = field.listKey, let opts = lists[listKey] {
            VStack(alignment: .leading) {
                Text(field.label + (field.tier == "required" ? " *" : ""))
                FlowChips(options: opts, selected: multi[field.key] ?? []) { opt in
                    var cur = multi[field.key] ?? []
                    if cur.contains(opt) { cur.removeAll { $0 == opt } } else { cur.append(opt) }
                    multi[field.key] = cur
                }
            }
        } else {
            TextField(field.label + (field.tier == "required" ? " *" : ""), text: binding(field.key))
                .keyboardType(field.type == "dollars" || field.type == "number" ? .decimalPad : .default)
        }
    }

    private func binding(_ key: String) -> Binding<String> {
        Binding(
            get: { values[key] ?? "" },
            set: { values[key] = $0 }
        )
    }

    private func load() async {
        loading = true
        do {
            let res: RoundDetailResponse = try await APIClient.shared.get("/rounds/\(roundId)")
            detail = res.data
            var next: [String: String] = [:]
            for (k, v) in res.data.round {
                if let s = v.stringValue { next[k] = s }
            }
            values = next
            multi = res.data.multiValues ?? [:]
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }

    private func save() async {
        saving = true
        banner = nil
        do {
            let body = SaveRoundBody(values: values, multiValues: multi, customValues: [:])
            let _: OkEnvelope = try await APIClient.shared.put("/rounds/\(roundId)", body: body)
            banner = "Saved successfully"
            await load()
        } catch {
            banner = error.localizedDescription
        }
        saving = false
    }

    private func approveLock() async {
        do {
            let _: OkEnvelope = try await APIClient.shared.postEmpty("/rounds/\(roundId)/approve-lock")
            banner = "Locked"
            await load()
        } catch let e as APIError {
            let miss = e.missingFields
            banner = miss.isEmpty ? e.localizedDescription : "Cannot lock:\n" + miss.joined(separator: "\n")
        } catch {
            banner = error.localizedDescription
        }
    }

    private func setOutcome(_ o: String) async {
        do {
            let _: OkEnvelope = try await APIClient.shared.post(
                "/rounds/\(roundId)/outcome",
                body: OutcomeBody(outcome: o)
            )
            banner = "Outcome updated"
            await load()
        } catch {
            banner = error.localizedDescription
        }
    }
}

struct FlowChips: View {
    let options: [String]
    let selected: [String]
    let toggle: (String) -> Void

    var body: some View {
        FlexibleView(data: options) { opt in
            Button {
                toggle(opt)
            } label: {
                Text(opt)
                    .font(.caption2.weight(.semibold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 5)
                    .background(
                        Capsule().fill(selected.contains(opt) ? Color.primary : Color.secondary.opacity(0.12))
                    )
                    .foregroundStyle(selected.contains(opt) ? Color(UIColor.systemBackground) : Color.secondary)
            }
            .buttonStyle(.plain)
        }
    }
}

/// Simple wrapping layout for chips
struct FlexibleView<Data: RandomAccessCollection, Content: View>: View where Data.Element: Hashable {
    let data: Data
    let content: (Data.Element) -> Content

    var body: some View {
        // Use LazyVGrid as a reliable wrap substitute
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 80), spacing: 6)], alignment: .leading, spacing: 6) {
            ForEach(Array(data), id: \.self) { content($0) }
        }
    }
}
