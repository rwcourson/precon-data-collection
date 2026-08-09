import SwiftUI

/// Pure hex/luminance helpers — unit-tested; mirrors Expo `tokens.ts` greys + contrast.
enum PreconThemeTokens {
    static let canvasLightHex = "F4F4F5"
    static let canvasDarkHex = "121214"
    static let foregroundLightHex = "18181B"
    static let foregroundDarkHex = "FAFAFA"
    static let mutedLightHex = "71717A"
    static let mutedDarkHex = "A1A1AA"
    /// Light-mode brand navy (CTA fill only — never body text in dark).
    static let brandNavyHex = "0C2048"
    /// Dark-mode brand remap (Expo `darkColors.brand` #c4cdd9).
    static let brandDarkHex = "C4CDD9"
    /// Dark primary button fill (Expo #e4e4e7).
    static let primaryDarkHex = "E4E4E7"
    static let primaryFgDarkHex = "18181B"
    static let primaryFgLightHex = "FAFAFA"

    static func textPrimaryHex(dark: Bool) -> String {
        dark ? foregroundDarkHex : foregroundLightHex
    }

    static func brandAccentHex(dark: Bool) -> String {
        dark ? brandDarkHex : brandNavyHex
    }

    static func primaryFillHex(dark: Bool) -> String {
        dark ? primaryDarkHex : brandNavyHex
    }

    static func primaryForegroundHex(dark: Bool) -> String {
        dark ? primaryFgDarkHex : primaryFgLightHex
    }

    static func canvasHex(dark: Bool) -> String {
        dark ? canvasDarkHex : canvasLightHex
    }

    static func hexToRgb(_ hex: String) -> (r: Double, g: Double, b: Double)? {
        var t = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        if t.hasPrefix("#") { t.removeFirst() }
        guard t.count == 6,
              let r = UInt8(t.prefix(2), radix: 16),
              let g = UInt8(t.dropFirst(2).prefix(2), radix: 16),
              let b = UInt8(t.dropFirst(4).prefix(2), radix: 16)
        else { return nil }
        return (Double(r) / 255, Double(g) / 255, Double(b) / 255)
    }

    private static func channelLuma(_ c: Double) -> Double {
        c <= 0.03928 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4)
    }

    static func relativeLuminance(hex: String) -> Double? {
        guard let rgb = hexToRgb(hex) else { return nil }
        return 0.2126 * channelLuma(rgb.r) + 0.7152 * channelLuma(rgb.g) + 0.0722 * channelLuma(rgb.b)
    }

    static func contrastRatio(fg: String, bg: String) -> Double? {
        guard let a = relativeLuminance(hex: fg), let b = relativeLuminance(hex: bg) else { return nil }
        let lighter = max(a, b)
        let darker = min(a, b)
        return (lighter + 0.05) / (darker + 0.05)
    }
}

/// B&G Precon tokens — grey layout kinship with Expo (zinc greys, navy accent only on CTAs).
enum PreconTheme {
    /// Fixed navy for charts / light CTAs only — prefer `brand(for:)` / `textPrimary(for:)`.
    static let brandNavy = Color(red: 12 / 255, green: 32 / 255, blue: 72 / 255) // #0c2048
    /// @available — legacy alias; dark UI must use scheme-aware APIs.
    static let brand = brandNavy
    static let brandMid = Color(red: 26 / 255, green: 51 / 255, blue: 96 / 255)
    /// Expo dark brand #c4cdd9
    static let brandOnDark = Color(red: 196 / 255, green: 205 / 255, blue: 217 / 255)
    /// Dark primary button fill #e4e4e7
    static let primaryOnDark = Color(red: 228 / 255, green: 228 / 255, blue: 231 / 255)

    static let steel = Color(red: 139 / 255, green: 149 / 255, blue: 168 / 255)
    static let sheet = Color(red: 244 / 255, green: 244 / 255, blue: 245 / 255)
    static let canvasDark = Color(red: 18 / 255, green: 18 / 255, blue: 20 / 255)
    static let foreground = Color(red: 24 / 255, green: 24 / 255, blue: 27 / 255)
    static let foregroundDark = Color(red: 250 / 255, green: 250 / 255, blue: 250 / 255)
    static let muted = Color(red: 113 / 255, green: 113 / 255, blue: 122 / 255)
    static let mutedDark = Color(red: 161 / 255, green: 161 / 255, blue: 170 / 255)
    static let copper = Color(red: 201 / 255, green: 118 / 255, blue: 43 / 255)
    static let success = Color(red: 63 / 255, green: 122 / 255, blue: 69 / 255)

    static let chartSeries: [Color] = [
        brandNavy,
        Color(red: 82 / 255, green: 82 / 255, blue: 91 / 255),
        Color(red: 63 / 255, green: 122 / 255, blue: 69 / 255),
        copper,
        Color(red: 156 / 255, green: 52 / 255, blue: 60 / 255),
        steel,
    ]

    static func canvas(for scheme: ColorScheme) -> Color {
        scheme == .dark ? canvasDark : sheet
    }

    /// High-emphasis body/title text — never navy in dark mode.
    static func textPrimary(for scheme: ColorScheme) -> Color {
        scheme == .dark ? foregroundDark : foreground
    }

    static func textMuted(for scheme: ColorScheme) -> Color {
        scheme == .dark ? mutedDark : muted
    }

    static func icon(for scheme: ColorScheme) -> Color {
        scheme == .dark ? mutedDark : Color(red: 82 / 255, green: 82 / 255, blue: 91 / 255)
    }

    /// Accent (links / selected icons) — steel-light in dark like Expo brand.
    static func brand(for scheme: ColorScheme) -> Color {
        scheme == .dark ? brandOnDark : brandNavy
    }

    /// Primary CTA fill (borderedProminent tint).
    static func primary(for scheme: ColorScheme) -> Color {
        scheme == .dark ? primaryOnDark : brandNavy
    }

    static func primaryForeground(for scheme: ColorScheme) -> Color {
        scheme == .dark ? foreground : foregroundDark
    }
}

struct GlassBackground: ViewModifier {
    @Environment(\.colorScheme) private var scheme

    func body(content: Content) -> some View {
        content
            .background {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(.ultraThinMaterial)
                    .overlay {
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .strokeBorder(
                                scheme == .dark
                                    ? Color.white.opacity(0.1)
                                    : Color.black.opacity(0.06),
                                lineWidth: 1
                            )
                    }
            }
    }
}

extension View {
    func preconGlassCard() -> some View {
        modifier(GlassBackground())
    }
}
