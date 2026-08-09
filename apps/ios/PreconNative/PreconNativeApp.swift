import SwiftUI

@main
struct PreconNativeApp: App {
    @StateObject private var session = SessionStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .preferredColorScheme(session.colorSchemePreference)
        }
    }
}
