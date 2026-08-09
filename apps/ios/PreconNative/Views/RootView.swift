import SwiftUI

struct RootView: View {
    @EnvironmentObject private var session: SessionStore
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        Group {
            if session.loading {
                ZStack {
                    PreconTheme.canvas(for: scheme).ignoresSafeArea()
                    ProgressView("Opening Precon…")
                        .tint(PreconTheme.icon(for: scheme))
                }
            } else if session.user == nil {
                SignInView()
            } else {
                MainTabView()
            }
        }
        .animation(.easeInOut(duration: 0.2), value: session.user?.id)
    }
}
