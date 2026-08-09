import SwiftUI

struct LoadingBlock: View {
    var label = "Loading…"
    var body: some View {
        VStack(spacing: 12) {
            ProgressView().tint(Color.secondary)
            Text(label).font(.subheadline).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct ErrorBlock: View {
    let message: String
    var body: some View {
        ContentUnavailableView(
            "Something went wrong",
            systemImage: "exclamationmark.triangle",
            description: Text(message)
        )
    }
}

struct EmptyBlock: View {
    let message: String
    var systemImage = "tray"
    var body: some View {
        ContentUnavailableView(message, systemImage: systemImage)
    }
}

struct StatusBadge: View {
    let status: String
    var body: some View {
        Text(status.replacingOccurrences(of: "_", with: " "))
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Capsule().fill(PreconTheme.steel.opacity(0.25)))
            .foregroundStyle(Color.secondary)
    }
}

struct KPICard: View {
    let label: String
    let value: String
    var sub: String?
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.caption)
                .foregroundStyle(PreconTheme.textMuted(for: scheme))
                .lineLimit(2)
            // High-emphasis value (Expo KpiCard uses colors.foreground) — not muted secondary.
            Text(value)
                .font(.title2.bold())
                .foregroundStyle(PreconTheme.textPrimary(for: scheme))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            if let sub {
                Text(sub)
                    .font(.caption2)
                    .foregroundStyle(PreconTheme.textMuted(for: scheme))
                    .lineLimit(2)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .preconGlassCard()
    }
}
