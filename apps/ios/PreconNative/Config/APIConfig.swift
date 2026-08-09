import Foundation

/// Mirrors Expo `EXPO_PUBLIC_API_URL` — override via Info.plist `API_BASE_URL` or UserDefaults.
enum APIConfig {
    static var baseURL: URL {
        if let override = UserDefaults.standard.string(forKey: "apiBaseURL"),
           let url = URL(string: override.trimmingCharacters(in: CharacterSet(charactersIn: "/"))) {
            return url
        }
        if let plist = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String,
           let url = URL(string: plist) {
            return url
        }
        // Simulator → host machine localhost
        return URL(string: "http://127.0.0.1:3000")!
    }

    static let mobilePrefix = "/api/v1/mobile"
}
