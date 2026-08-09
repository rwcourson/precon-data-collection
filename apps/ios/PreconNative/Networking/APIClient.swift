import Foundation

enum APIError: LocalizedError {
    case http(status: Int, message: String, body: Data?)
    case decode(Error)
    case invalidURL

    var errorDescription: String? {
        switch self {
        case .http(_, let message, _): return message
        case .decode(let e): return e.localizedDescription
        case .invalidURL: return "Invalid URL"
        }
    }

    var missingFields: [String] {
        guard case .http(_, _, let body) = self, let body else { return [] }
        if let obj = try? JSONSerialization.jsonObject(with: body) as? [String: Any] {
            if let arr = obj["missingFields"] as? [String] { return arr }
            if let arr = obj["details"] as? [String] { return arr }
        }
        return []
    }
}

actor APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    var token: String?
    var workspaceRegion: String?

    init(session: URLSession = .shared) {
        self.session = session
        self.decoder = JSONDecoder()
        // API uses camelCase already
        self.encoder = JSONEncoder()
    }

    func setToken(_ token: String?) {
        self.token = token
    }

    func setWorkspace(_ region: String?) {
        self.workspaceRegion = region
    }

    func get<T: Decodable>(_ path: String) async throws -> T {
        try await request(path, method: "GET", body: Optional<Data>.none)
    }

    func post<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        let data = try encoder.encode(body)
        return try await request(path, method: "POST", body: data)
    }

    func put<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        let data = try encoder.encode(body)
        return try await request(path, method: "PUT", body: data)
    }

    func patch<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        let data = try encoder.encode(body)
        return try await request(path, method: "PATCH", body: data)
    }

    func postEmpty<T: Decodable>(_ path: String) async throws -> T {
        try await request(path, method: "POST", body: Data("{}".utf8))
    }

    private func request<T: Decodable>(_ path: String, method: String, body: Data?) async throws -> T {
        let full = APIConfig.baseURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            + APIConfig.mobilePrefix
            + (path.hasPrefix("/") ? path : "/" + path)
        guard let url = URL(string: full) else { throw APIError.invalidURL }

        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            req.httpBody = body
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        if let token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let workspaceRegion, !workspaceRegion.isEmpty {
            req.setValue(workspaceRegion, forHTTPHeaderField: "X-Workspace-Region")
        }

        let (data, resp) = try await session.data(for: req)
        guard let http = resp as? HTTPURLResponse else {
            throw APIError.http(status: -1, message: "No response", body: data)
        }
        if !(200..<300).contains(http.statusCode) {
            var message = "HTTP \(http.statusCode)"
            if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let err = obj["error"] as? String {
                message = err
            }
            throw APIError.http(status: http.statusCode, message: message, body: data)
        }
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decode(error)
        }
    }
}
