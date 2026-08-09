import Foundation

/// Field list visibility for post-bid forms — matches Expo round entry.
enum FieldVisibility {
    static let readOnlyKeys: Set<String> = ["jobNumber", "jobName", "estimateLead"]

    /// Whether a field definition should appear given optional toggle.
    static func isVisible(key: String, tier: String?, showOptional: Bool) -> Bool {
        if readOnlyKeys.contains(key) { return false }
        if !showOptional && tier == "optional" { return false }
        return true
    }

    static func filterDefs(_ defs: [FieldDef], showOptional: Bool) -> [FieldDef] {
        defs.filter { isVisible(key: $0.key, tier: $0.tier, showOptional: showOptional) }
    }
}
