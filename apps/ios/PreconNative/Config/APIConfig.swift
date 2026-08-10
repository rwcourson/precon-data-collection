import Foundation

/// Mirrors Expo `EXPO_PUBLIC_API_URL` — override via Info.plist `API_BASE_URL` or UserDefaults.
enum APIConfig {
    static var baseURL: URL {
        let candidate: URL = {
            if let override = UserDefaults.standard.string(forKey: "apiBaseURL"),
               let url = URL(string: override.trimmingCharacters(in: CharacterSet(charactersIn: "/"))) {
                return url
            }
            if let plist = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String,
               let url = URL(string: plist) {
                return url
            }
            // Simulator / debug → host machine localhost only
            return URL(string: "http://127.0.0.1:3000")!
        }()
        #if DEBUG
        return candidate
        #else
        // Release builds reject non-HTTPS API bases (loopback HTTP is debug-only).
        precondition(
            candidate.scheme?.lowercased() == "https",
            "Release builds require an HTTPS API_BASE_URL"
        )
        return candidate
        #endif
    }

    static let mobilePrefix = "/api/v1/mobile"
}
