import XCTest
@testable import PreconNative

final class MapperTests: XCTestCase {
    func testCompactDollars() {
        XCTAssertEqual(Formatters.compactDollars(nil), "—")
        XCTAssertEqual(Formatters.compactDollars(31_000_000_000), "$31.0B")
        XCTAssertEqual(Formatters.compactDollars(45_000_000), "$45.0M")
    }

    func testKpiFormats() {
        XCTAssertEqual(Formatters.kpi(0.61, format: "percent"), "61.0%")
        XCTAssertEqual(Formatters.kpi(87, format: "number"), "87")
        XCTAssertTrue(Formatters.kpi(1_200_000, format: "dollars").contains("M") || Formatters.kpi(1_200_000, format: "dollars").contains("1"))
    }

    func testHumanDate() {
        XCTAssertEqual(Formatters.humanDate(nil), "No due date")
        let s = Formatters.humanDate("2026-09-15")
        XCTAssertTrue(s.contains("2026") || s.contains("Sep") || s.contains("15"))
    }

    func testDueBands() {
        let cal = Calendar(identifier: .gregorian)
        let now = cal.date(from: DateComponents(year: 2026, month: 8, day: 8))!
        XCTAssertEqual(DueBandLogic.band(for: "2026-08-01", now: now), .overdue)
        XCTAssertEqual(DueBandLogic.band(for: "2026-08-10", now: now), .thisWeek)
        XCTAssertEqual(DueBandLogic.band(for: "2026-08-18", now: now), .nextWeek)
        XCTAssertEqual(DueBandLogic.band(for: "2026-09-01", now: now), .later)
        XCTAssertEqual(DueBandLogic.band(for: nil, now: now), .none)
    }

    func testSheetMatrixAlignment() {
        let cols = [
            SheetColumn(key: "jobName", label: "Job Name", type: "text"),
            SheetColumn(key: "region", label: "Region", type: "text"),
        ]
        let rows = [
            SheetRow(id: 1, values: ["jobName": "UNC Rex", "region": "Carolinas"]),
            SheetRow(id: 2, values: ["jobName": nil, "region": "  "]),
        ]
        let m = SheetMatrix.build(columns: cols, rows: rows)
        XCTAssertEqual(m.headers.count, 2)
        XCTAssertTrue(m.isAligned)
        XCTAssertEqual(m.body[0].cells, ["UNC Rex", "Carolinas"])
        XCTAssertEqual(m.body[1].cells, ["—", "—"])
    }

    func testAxisTick() {
        XCTAssertEqual(Formatters.axisTick("31000000000", dollars: true), "$31.0B")
        XCTAssertEqual(Formatters.axisTick("12", dollars: false), "12")
    }

    func testSheetDisplayNameHumanizesRawKeys() {
        XCTAssertEqual(SheetDisplay.displayName("pcn_bid_schedule"), "Bid Schedule")
        XCTAssertEqual(SheetDisplay.displayName("pcn_gmp_history"), "GMP History")
        XCTAssertEqual(SheetDisplay.displayName("pcn_sub_rates"), "Subcontractor Rates")
        XCTAssertEqual(SheetDisplay.displayName("labor_rate_history"), "Labor Rate History")
        XCTAssertEqual(SheetDisplay.displayName("Weekly Region Bid Schedule"), "Weekly Region Bid Schedule")
        XCTAssertEqual(SheetDisplay.displayName(""), "Untitled sheet")
    }

    func testSheetSortPinsAndWorkflowRank() {
        let rows = [
            SheetSummary(id: 1, name: "pcn_unit_prices", folder: "Rates", kind: "grid", pinned: false, rowCount: 0, canManage: true),
            SheetSummary(id: 2, name: "pcn_bid_schedule", folder: "Core", kind: "view", pinned: false, rowCount: 10, canManage: true),
            SheetSummary(id: 3, name: "pcn_contacts", folder: "Core", kind: "grid", pinned: true, rowCount: 2, canManage: true),
            SheetSummary(id: 4, name: "pcn_post_bid", folder: "Core", kind: "view", pinned: false, rowCount: 5, canManage: true),
        ]
        let sorted = SheetDisplay.sort(rows)
        XCTAssertEqual(sorted.map(\.id), [3, 2, 4, 1])
        XCTAssertLessThan(SheetDisplay.sortRank("pcn_bid_schedule"), SheetDisplay.sortRank("pcn_labor_rates"))
    }

    func testSheetFilterAndGroup() {
        let rows = [
            SheetSummary(id: 1, name: "pcn_bid_schedule", folder: nil, kind: "view", pinned: false, rowCount: 1, canManage: true),
            SheetSummary(id: 2, name: "pcn_labor_rates", folder: "Rates", kind: "grid", pinned: false, rowCount: 3, canManage: true),
        ]
        XCTAssertEqual(SheetDisplay.filter(rows, query: "bid").map(\.id), [1])
        let groups = SheetDisplay.groupByFolder(rows)
        XCTAssertEqual(groups.first?.folder, "General")
        XCTAssertEqual(SheetDisplay.subtitle(folder: nil, kind: "grid", rowCount: 12, pinned: true), "General · Grid · 12 rows · Pinned")
    }

    func testArchivedSheetDecode() throws {
        let json = """
        {"data":[{"id":9,"name":"pcn_contacts","folder":"","archivedAt":"2026-08-01T00:00:00.000Z","canRestore":true}]}
        """.data(using: .utf8)!
        let res = try JSONDecoder().decode(ArchivedSheetsResponse.self, from: json)
        XCTAssertEqual(res.data.count, 1)
        XCTAssertEqual(SheetDisplay.displayName(res.data[0].name), "Contacts")
        XCTAssertEqual(res.data[0].canRestore, true)
    }

    func testSheetLifecycleActionBodies() throws {
        // Encode the same PATCH bodies the list/detail views send.
        let pin = try JSONEncoder().encode(SheetPatchBody(action: "pin", cell: nil))
        let archive = try JSONEncoder().encode(SheetPatchBody(action: "archive", cell: nil))
        let restore = try JSONEncoder().encode(SheetPatchBody(action: "restore", cell: nil))
        let pinS = String(data: pin, encoding: .utf8)!
        let archiveS = String(data: archive, encoding: .utf8)!
        let restoreS = String(data: restore, encoding: .utf8)!
        XCTAssertTrue(pinS.contains("\"pin\""))
        XCTAssertTrue(archiveS.contains("\"archive\""))
        XCTAssertTrue(restoreS.contains("\"restore\""))
    }

    func testThemeTextPrimaryReadableOnCanvas() {
        // Light: zinc grey canvas + near-black text
        let light = PreconThemeTokens.contrastRatio(
            fg: PreconThemeTokens.textPrimaryHex(dark: false),
            bg: PreconThemeTokens.canvasHex(dark: false)
        )
        XCTAssertNotNil(light)
        XCTAssertGreaterThanOrEqual(light!, 4.5)

        // Dark: charcoal canvas + near-white text (NOT navy brand on dark)
        let dark = PreconThemeTokens.contrastRatio(
            fg: PreconThemeTokens.textPrimaryHex(dark: true),
            bg: PreconThemeTokens.canvasHex(dark: true)
        )
        XCTAssertNotNil(dark)
        XCTAssertGreaterThanOrEqual(dark!, 4.5)

        // Navy brand on dark canvas is unreadable (~1.17) — prove we must not use it for text.
        let bad = PreconThemeTokens.contrastRatio(
            fg: PreconThemeTokens.brandNavyHex,
            bg: PreconThemeTokens.canvasDarkHex
        )
        XCTAssertNotNil(bad)
        XCTAssertLessThan(bad!, 2.0, "navy on charcoal fails WCAG — SignIn labels must use textPrimary")

        // Scheme-aware brand accent in dark is light steel, readable on charcoal
        let brandDark = PreconThemeTokens.contrastRatio(
            fg: PreconThemeTokens.brandAccentHex(dark: true),
            bg: PreconThemeTokens.canvasDarkHex
        )
        XCTAssertNotNil(brandDark)
        XCTAssertGreaterThanOrEqual(brandDark!, 4.5)

        XCTAssertEqual(PreconThemeTokens.canvasDarkHex, "121214")
        XCTAssertEqual(PreconThemeTokens.brandDarkHex, "C4CDD9")
        XCTAssertNotEqual(
            PreconThemeTokens.brandAccentHex(dark: true),
            PreconThemeTokens.brandNavyHex
        )
    }

    func testPrimaryCTAFillsAreSchemeAware() {
        XCTAssertEqual(PreconThemeTokens.primaryFillHex(dark: false), PreconThemeTokens.brandNavyHex)
        XCTAssertEqual(PreconThemeTokens.primaryFillHex(dark: true), PreconThemeTokens.primaryDarkHex)
        let darkBtn = PreconThemeTokens.contrastRatio(
            fg: PreconThemeTokens.primaryForegroundHex(dark: true),
            bg: PreconThemeTokens.primaryFillHex(dark: true)
        )
        XCTAssertNotNil(darkBtn)
        XCTAssertGreaterThanOrEqual(darkBtn!, 4.5)
    }

    func testSheetDetailDecodesPinnedAndCanManage() throws {
        let json = """
        {
          "data": {
            "sheet": { "name": "pcn_bid_schedule", "kind": "view" },
            "columns": [{ "key": "jobName", "label": "Job Name", "type": "text" }],
            "rows": [],
            "kind": "view",
            "readOnly": true,
            "pinned": true,
            "canManage": false,
            "pagination": { "total": 0, "hasMore": false }
          }
        }
        """.data(using: .utf8)!
        let res = try JSONDecoder().decode(SheetDetailResponse.self, from: json)
        XCTAssertEqual(res.data.pinned, true)
        XCTAssertEqual(res.data.canManage, false)
        XCTAssertEqual(SheetDisplay.displayName(res.data.sheet.name), "Bid Schedule")
        XCTAssertFalse(SheetDisplay.canShowArchive(res.data.canManage))
        XCTAssertTrue(SheetDisplay.canShowArchive(true))
    }

    func testOverviewJSONDecode() throws {
        let json = """
        {
          "bidYear": 2026,
          "kpis": {
            "ytdVolume": 1e9,
            "ytdVolumeLabel": "$1.0B",
            "ytdRoundCount": 10,
            "awaitingPostBid": 2,
            "awaitingApproval": 1,
            "winRatePct": 50,
            "wins": 3,
            "decided": 6
          },
          "byStatus": { "active": 4, "locked": 2 },
          "totalRounds": 6
        }
        """.data(using: .utf8)!
        let o = try JSONDecoder().decode(OverviewResponse.self, from: json)
        XCTAssertEqual(o.kpis.ytdRoundCount, 10)
        XCTAssertEqual(o.byStatus?["active"], 4)
    }

    func testDashboardJSONDecode() throws {
        let json = """
        {
          "level": "corporate",
          "groupBy": "region",
          "groupVolumeTitle": "Pursuit volume by region",
          "kpis": [
            { "key": "pipeline", "label": "Pipeline value", "value": 1e9, "format": "dollars" }
          ],
          "statusSeries": [{ "label": "locked", "value": 10 }],
          "groupVolume": [{ "label": "Central", "value": 5e8 }],
          "empty": false
        }
        """.data(using: .utf8)!
        let d = try JSONDecoder().decode(DashboardResponse.self, from: json)
        XCTAssertEqual(d.groupBy, "region")
        XCTAssertEqual(d.statusSeries?.first?.value, 10)
    }

    func testFieldVisibilityHidesOptionalIncludingMulti() {
        XCTAssertFalse(FieldVisibility.isVisible(key: "jobName", tier: "required", showOptional: false))
        XCTAssertTrue(FieldVisibility.isVisible(key: "estimateValue", tier: "required", showOptional: false))
        XCTAssertFalse(FieldVisibility.isVisible(key: "selfPerformWorkType", tier: "optional", showOptional: false))
        XCTAssertTrue(FieldVisibility.isVisible(key: "selfPerformWorkType", tier: "optional", showOptional: true))
        let defs = [
            FieldDef(key: "estimateValue", label: "Est", type: "dollars", tier: "required", group: "A", listKey: nil, note: nil),
            FieldDef(key: "selfPerformWorkType", label: "SP", type: "multi", tier: "optional", group: "A", listKey: "x", note: nil),
            FieldDef(key: "jobName", label: "Job", type: "text", tier: "required", group: "A", listKey: nil, note: nil),
        ]
        let filtered = FieldVisibility.filterDefs(defs, showOptional: false)
        XCTAssertEqual(filtered.map(\.key), ["estimateValue"])
        let withOpt = FieldVisibility.filterDefs(defs, showOptional: true)
        XCTAssertEqual(withOpt.map(\.key), ["estimateValue", "selfPerformWorkType"])
    }

    func testForecastJSONDecode() throws {
        let json = """
        {
          "series": {
            "months": [
              { "month": "2025-06", "objective": 175000000, "adjusted": 0 }
            ]
          },
          "empty": false
        }
        """.data(using: .utf8)!
        let f = try JSONDecoder().decode(ForecastResponse.self, from: json)
        XCTAssertEqual(f.series?.months?.count, 1)
        XCTAssertEqual(f.series?.months?.first?.objective, 175_000_000)
    }
}
