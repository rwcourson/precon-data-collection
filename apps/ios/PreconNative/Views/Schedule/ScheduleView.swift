import SwiftUI

struct ScheduleView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var rows: [ScheduleRow] = []
    @State private var section = "all"
    @State private var viewMode = "timeline"
    @State private var loading = true
    @State private var error: String?
    @State private var showCreate = false
    @State private var newName = ""

    private let sections = [
        ("all", "All"), ("active", "Active"), ("upcoming", "Upcoming"), ("outstanding", "Outstanding"),
    ]

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack {
                        chip("Timeline", selected: viewMode == "timeline") { viewMode = "timeline" }
                        chip("List", selected: viewMode == "list") { viewMode = "list" }
                    }
                    .padding(.horizontal)
                }
                .padding(.vertical, 8)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack {
                        ForEach(sections, id: \.0) { key, label in
                            chip(label, selected: section == key) {
                                section = key
                                Task { await load() }
                            }
                        }
                    }
                    .padding(.horizontal)
                }

                if session.user?.role != "leadership" {
                    Button("New pursuit") { showCreate = true }
                        .buttonStyle(.borderedProminent)
                        .tint(Color.primary)
                        .padding(.horizontal)
                        .padding(.top, 8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                content
            }
            .navigationTitle("Bid Schedule")
            .navigationDestination(for: Int.self) { jobId in
                JobDetailView(jobId: jobId)
            }
            .refreshable { await load() }
            .task { await load() }
            .sheet(isPresented: $showCreate) { createSheet }
        }
    }

    @ViewBuilder
    private var content: some View {
        if loading && rows.isEmpty {
            LoadingBlock()
        } else if let error, rows.isEmpty {
            ErrorBlock(message: error)
        } else if rows.isEmpty {
            EmptyBlock(message: "No rounds in this section")
        } else if viewMode == "timeline" {
            List {
                ForEach(DueBandLogic.group(rows), id: \.0) { band, items in
                    Section {
                        ForEach(items) { row in
                            NavigationLink(value: row.jobId) {
                                rowCell(row)
                            }
                        }
                    } header: {
                        HStack {
                            Circle().fill(bandColor(band)).frame(width: 8, height: 8)
                            Text(band.label)
                            Spacer()
                            Text("\(items.count)")
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
        } else {
            List(rows) { row in
                NavigationLink(value: row.jobId) {
                    rowCell(row)
                }
            }
            .listStyle(.insetGrouped)
        }
    }

    private func rowCell(_ row: ScheduleRow) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(row.jobName).font(.body.weight(.semibold)).foregroundStyle(Color.primary)
                Spacer()
                StatusBadge(status: row.status)
            }
            Text("\(row.jobNumber ?? "—") · \(row.estimatePhase ?? "")")
                .font(.caption)
                .foregroundStyle(.secondary)
            Text("Due \(Formatters.humanDate(row.bidDueDate))")
                .font(.caption.weight(.medium))
                .foregroundStyle(Color.primary)
        }
        .padding(.vertical, 2)
    }

    private var createSheet: some View {
        NavigationStack {
            Form {
                TextField("Job name", text: $newName)
            }
            .navigationTitle("New pursuit")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showCreate = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        Task { await createPursuit() }
                    }
                    .disabled(newName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .presentationDetents([.medium])
    }

    private func chip(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(Capsule().fill(selected ? Color.primary : Color.secondary.opacity(0.12)))
                .foregroundStyle(selected ? Color(UIColor.systemBackground) : Color.secondary)
        }
        .buttonStyle(.plain)
    }

    private func bandColor(_ b: DueBand) -> Color {
        switch b {
        case .overdue: return .red
        case .thisWeek: return PreconTheme.copper
        case .nextWeek: return PreconTheme.steel
        case .later: return PreconTheme.success
        case .none: return .secondary
        }
    }

    private func load() async {
        if rows.isEmpty { loading = true }
        error = nil
        do {
            let res: BidScheduleResponse = try await APIClient.shared.get(
                "/bid-schedule?section=\(section)&groupBy=none"
            )
            rows = res.data
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }

    private func createPursuit() async {
        let name = newName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        do {
            let body = CreatePursuitBody(
                mode: "manual",
                jobName: name,
                region: session.user?.region ?? "Central",
                preconDepartment: session.user?.preconDepartment ?? "Central Precon",
                estimatePhase: "ROM",
                bidYear: Calendar.current.component(.year, from: Date()),
                initialStatus: "upcoming",
                bidDueDate: nil,
                jobNumber: nil
            )
            let res: CreatePursuitResponse = try await APIClient.shared.post("/pursuits", body: body)
            showCreate = false
            newName = ""
            await load()
            _ = res.data.jobId
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct JobDetailView: View {
    let jobId: Int
    @State private var data: JobDetailData?
    @State private var error: String?
    @State private var loading = true

    var body: some View {
        Group {
            if loading { LoadingBlock() }
            else if let error { ErrorBlock(message: error) }
            else if let data {
                List {
                    Section("Job") {
                        Text(data.job.jobName).font(.headline)
                        Text(data.job.jobNumber ?? "—").foregroundStyle(.secondary)
                    }
                    Section("Rounds") {
                        ForEach(data.rounds) { r in
                            NavigationLink {
                                RoundEntryView(roundId: r.id)
                            } label: {
                                HStack {
                                    Text("Round \(r.roundNumber ?? r.id)")
                                    Spacer()
                                    StatusBadge(status: r.status)
                                }
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Job")
        .task {
            do {
                let res: JobDetailResponse = try await APIClient.shared.get("/jobs/\(jobId)")
                data = res.data
            } catch {
                self.error = error.localizedDescription
            }
            loading = false
        }
    }
}
