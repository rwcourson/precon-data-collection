import SwiftUI
import Charts

struct OverviewView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var data: OverviewResponse?
    @State private var loading = true
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Group {
                if loading && data == nil {
                    LoadingBlock(label: "Loading portfolio…")
                } else if let error, data == nil {
                    ErrorBlock(message: error)
                } else if let data {
                    content(data)
                }
            }
            .background(Color.clear)
            .navigationTitle("Overview")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink {
                        SearchView()
                    } label: {
                        Image(systemName: "magnifyingglass")
                    }
                }
            }
            .refreshable { await load() }
            .task { await load() }
        }
    }

    @ViewBuilder
    private func content(_ data: OverviewResponse) -> some View {
        let k = data.kpis
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("BRASFIELD & GORRIE · PRECON")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(PreconTheme.steel)
                        .tracking(1)
                    Text("\(data.bidYear ?? 2026) portfolio")
                        .font(.title2.bold())
                        .foregroundStyle(Color.primary)
                    Text("\(session.user?.name ?? "") · \(data.workspace?.label ?? session.workspaceLabel)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text("\(data.totalRounds ?? 0) rounds in scope")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .preconGlassCard()

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    KPICard(
                        label: "\(data.bidYear ?? 2026) Pursuit Volume",
                        value: k.ytdVolumeLabel ?? Formatters.compactDollars(k.ytdVolume),
                        sub: "\(k.ytdRoundCount ?? 0) estimate rounds"
                    )
                    KPICard(
                        label: "Awaiting Post-Bid",
                        value: "\(k.awaitingPostBid ?? 0)",
                        sub: "Submitted or in data entry"
                    )
                    KPICard(
                        label: "Awaiting RPD Approval",
                        value: "\(k.awaitingApproval ?? 0)",
                        sub: "In post-bid data entry"
                    )
                    KPICard(
                        label: "Win Rate (decided)",
                        value: k.winRatePct.map { "\($0)%" } ?? "—",
                        sub: "\(k.wins ?? 0) of \(k.decided ?? 0) decided"
                    )
                }

                if let by = data.byStatus, !by.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Rounds by status")
                            .font(.headline)
                            .foregroundStyle(Color.primary)
                        Chart {
                            ForEach(Array(by.filter { $0.value > 0 }.sorted { $0.value > $1.value }), id: \.key) { item in
                                BarMark(
                                    x: .value("Status", item.key.replacingOccurrences(of: "_", with: " ")),
                                    y: .value("Count", item.value)
                                )
                                .foregroundStyle(Color.primary)
                            }
                        }
                        .frame(height: 180)
                        .chartXAxis {
                            AxisMarks { _ in
                                AxisValueLabel().font(.caption2)
                            }
                        }
                    }
                    .padding(14)
                    .preconGlassCard()
                }

                Text("Modules")
                    .font(.headline)
                    .foregroundStyle(Color.primary)

                moduleLink("Bid Schedule", "Active · Upcoming · Outstanding", "calendar")
                moduleLink("Post-Bid Entry", "Complete · approve · lock", "square.and.pencil")
                moduleLink("Sheets", "Workspace grids & views", "tablecells")
                moduleLink("Dashboards", "Corporate · region · division", "chart.bar")
            }
            .padding(16)
            .padding(.bottom, 24)
        }
    }

    private func moduleLink(_ title: String, _ sub: String, _ icon: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(Color.primary)
                .frame(width: 36, height: 36)
                .background(RoundedRectangle(cornerRadius: 10).fill(PreconTheme.steel.opacity(0.2)))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.body.weight(.semibold)).foregroundStyle(Color.primary)
                Text(sub).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(14)
        .preconGlassCard()
    }

    private func load() async {
        if data == nil { loading = true }
        error = nil
        do {
            data = try await APIClient.shared.get("/overview")
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }
}
