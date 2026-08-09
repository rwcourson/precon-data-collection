import SwiftUI

struct SignInView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var token = ""
    @State private var busy = false
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    HStack {
                        Spacer()
                        Button {
                            cycleTheme()
                        } label: {
                            Image(systemName: scheme == .dark ? "sun.max" : "moon")
                                .font(.body.weight(.semibold))
                                .foregroundStyle(PreconTheme.icon(for: scheme))
                                .frame(width: 36, height: 36)
                                .background(Circle().fill(.ultraThinMaterial))
                        }
                        .accessibilityLabel("Toggle theme")
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("BRASFIELD & GORRIE")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(PreconTheme.textMuted(for: scheme))
                            .tracking(1.2)
                        Text("Precon")
                            .font(.largeTitle.bold())
                            .foregroundStyle(PreconTheme.textPrimary(for: scheme))
                        Text("Bid schedule · post-bid · dashboards — native iOS")
                            .font(.subheadline)
                            .foregroundStyle(PreconTheme.textMuted(for: scheme))
                    }
                    .padding(20)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .preconGlassCard()

                    if let err = session.error {
                        Text(err)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }

                    Text("Demo persona")
                        .font(.headline)
                        .foregroundStyle(PreconTheme.textPrimary(for: scheme))

                    if session.personas.isEmpty {
                        ContentUnavailableView(
                            "No personas",
                            systemImage: "person.crop.circle.badge.exclamationmark",
                            description: Text("Start the web API on port 3000 (AUTH_MODE=demo)")
                        )
                        .frame(minHeight: 120)
                    } else {
                        ForEach(session.personas) { p in
                            Button {
                                Task {
                                    busy = true
                                    await session.signInDemo(userId: p.id)
                                    busy = false
                                }
                            } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(p.name)
                                            .font(.body.weight(.semibold))
                                            .foregroundStyle(PreconTheme.textPrimary(for: scheme))
                                        Text("\(p.role) · \(p.region ?? "—")")
                                            .font(.caption)
                                            .foregroundStyle(PreconTheme.textMuted(for: scheme))
                                    }
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(.tertiary)
                                }
                                .padding(14)
                                .preconGlassCard()
                            }
                            .disabled(busy)
                            .buttonStyle(.plain)
                        }
                    }

                    Text("API token")
                        .font(.headline)
                        .foregroundStyle(PreconTheme.textPrimary(for: scheme))
                        .padding(.top, 8)

                    TextField("pcn_…", text: $token)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .foregroundStyle(PreconTheme.textPrimary(for: scheme))
                        .padding(12)
                        .background(RoundedRectangle(cornerRadius: 12).fill(.quaternary.opacity(0.4)))

                    Button {
                        Task {
                            busy = true
                            await session.signInToken(token)
                            busy = false
                        }
                    } label: {
                        Text("Sign in with token")
                            .font(.body.weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                    }
                    .buttonStyle(.borderedProminent)
                    // Brand/primary fill only on CTA — not on body labels.
                    .tint(PreconTheme.primary(for: scheme))
                    .disabled(busy || token.trimmingCharacters(in: .whitespaces).isEmpty)

                    Text("API: \(APIConfig.baseURL.absoluteString)")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                .padding(20)
            }
            .background(PreconTheme.canvas(for: scheme))
            .navigationBarHidden(true)
        }
    }

    private func cycleTheme() {
        switch session.themePreference {
        case .system: session.setTheme(.light)
        case .light: session.setTheme(.dark)
        case .dark: session.setTheme(.system)
        }
    }
}
