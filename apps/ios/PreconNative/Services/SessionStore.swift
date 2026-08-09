import Foundation
import SwiftUI
import Security

@MainActor
final class SessionStore: ObservableObject {
    @Published var user: PublicUser?
    @Published var personas: [PublicUser] = []
    @Published var loading = true
    @Published var error: String?
    @Published var workspaceLabel: String = "Workspace"
    @Published var availableRegions: [String] = []
    @Published var themePreference: ThemePreference = .system

    enum ThemePreference: String, CaseIterable {
        case system, light, dark
        var label: String {
            switch self {
            case .system: return "System"
            case .light: return "Light"
            case .dark: return "Dark"
            }
        }
    }

    var colorSchemePreference: ColorScheme? {
        switch themePreference {
        case .system: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }

    private let tokenKey = "precon_native_token"
    private let workspaceKey = "precon_native_workspace"
    private let themeKey = "precon_native_theme"

    init() {
        if let t = UserDefaults.standard.string(forKey: themeKey),
           let p = ThemePreference(rawValue: t) {
            themePreference = p
        }
        Task { await bootstrap() }
    }

    func bootstrap() async {
        loading = true
        error = nil
        let token = KeychainStore.get(tokenKey)
        let workspace = UserDefaults.standard.string(forKey: workspaceKey)
        await APIClient.shared.setToken(token)
        await APIClient.shared.setWorkspace(workspace)

        if token != nil {
            do {
                let me: MeResponse = try await APIClient.shared.get("/me")
                user = me.user
                workspaceLabel = me.workspace?.label ?? "Workspace"
                availableRegions = me.workspace?.available ?? []
            } catch {
                user = nil
                KeychainStore.delete(tokenKey)
                await APIClient.shared.setToken(nil)
            }
        }

        await loadPersonas()
        loading = false
    }

    func loadPersonas() async {
        do {
            let res: UsersResponse = try await APIClient.shared.get("/users")
            personas = res.data
        } catch {
            personas = []
        }
    }

    func signInDemo(userId: Int) async {
        error = nil
        do {
            struct Body: Codable { let userId: Int }
            let res: DemoAuthResponse = try await APIClient.shared.post(
                "/auth/demo",
                body: Body(userId: userId)
            )
            KeychainStore.set(tokenKey, res.token)
            await APIClient.shared.setToken(res.token)
            user = res.user
            await refreshMe()
        } catch {
            self.error = error.localizedDescription
        }
    }

    func signInToken(_ raw: String) async {
        error = nil
        let token = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard token.hasPrefix("pcn_") else {
            error = "Token must start with pcn_"
            return
        }
        KeychainStore.set(tokenKey, token)
        await APIClient.shared.setToken(token)
        do {
            let me: MeResponse = try await APIClient.shared.get("/me")
            user = me.user
            workspaceLabel = me.workspace?.label ?? "Workspace"
            availableRegions = me.workspace?.available ?? []
        } catch {
            KeychainStore.delete(tokenKey)
            await APIClient.shared.setToken(nil)
            self.error = error.localizedDescription
        }
    }

    func signOut() async {
        KeychainStore.delete(tokenKey)
        await APIClient.shared.setToken(nil)
        user = nil
    }

    func setWorkspace(_ region: String?) async {
        if let region {
            UserDefaults.standard.set(region, forKey: workspaceKey)
        } else {
            UserDefaults.standard.removeObject(forKey: workspaceKey)
        }
        await APIClient.shared.setWorkspace(region)
        await refreshMe()
    }

    func setTheme(_ p: ThemePreference) {
        themePreference = p
        UserDefaults.standard.set(p.rawValue, forKey: themeKey)
    }

    private func refreshMe() async {
        do {
            let me: MeResponse = try await APIClient.shared.get("/me")
            user = me.user
            workspaceLabel = me.workspace?.label ?? "Workspace"
            availableRegions = me.workspace?.available ?? []
        } catch {
            // keep existing user
        }
    }
}

// Minimal Keychain wrapper for bearer token
enum KeychainStore {
    static func set(_ key: String, _ value: String) {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
        var add = query
        add[kSecValueData as String] = data
        SecItemAdd(add as CFDictionary, nil)
    }

    static func get(_ key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var out: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &out)
        guard status == errSecSuccess, let data = out as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func delete(_ key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
