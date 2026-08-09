import SwiftUI

struct SheetsListView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var sheets: [SheetSummary] = []
    @State private var archived: [ArchivedSheet] = []
    @State private var filter = "all"
    @State private var query = ""
    @State private var showArchived = false
    @State private var loading = true
    @State private var error: String?
    @State private var showCreate = false
    @State private var newName = ""
    @State private var busyId: Int?

    /// Kind filter → search → sort (pinned / workflow rank / folder / name).
    private var visible: [SheetSummary] {
        var list = sheets
        if filter == "view" {
            list = list.filter { $0.kind == "view" }
        } else if filter == "grid" {
            list = list.filter { $0.kind != "view" }
        }
        list = SheetDisplay.filter(list, query: query)
        return SheetDisplay.sort(list)
    }

    private var sections: [(folder: String, sheets: [SheetSummary])] {
        SheetDisplay.groupByFolder(visible)
    }

    private var archivedVisible: [ArchivedSheet] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return archived }
        return archived.filter { s in
            let hay = [
                SheetDisplay.displayName(s.name),
                s.name,
                SheetDisplay.folderLabel(s.folder),
            ].joined(separator: " ").lowercased()
            return hay.contains(q)
        }
    }

    private var canCreate: Bool {
        session.user?.role != "leadership"
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                searchField
                chipRow

                if canCreate && !showArchived {
                    Button {
                        showCreate = true
                    } label: {
                        Label("Create grid sheet", systemImage: "plus")
                            .font(.subheadline.weight(.semibold))
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color.primary)
                    .padding(.horizontal)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.bottom, 6)
                }

                content
            }
            .navigationTitle("Sheets")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Text(
                        showArchived
                            ? "\(archivedVisible.count) archived"
                            : "\(visible.count) of \(sheets.count)"
                    )
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
            }
            .refreshable { await load() }
            // Reload whenever list appears (including after detail archive dismiss).
            .onAppear { Task { await load() } }
            .sheet(isPresented: $showCreate) { createSheet }
        }
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)
            TextField(showArchived ? "Find archived…" : "Find a sheet…", text: $query)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            if !query.isEmpty {
                Button {
                    query = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color.secondary.opacity(0.1)))
        .padding(.horizontal)
        .padding(.top, 8)
    }

    private var chipRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                if !showArchived {
                    filterChip("All", "all", count: sheets.count)
                    filterChip("Views", "view", count: sheets.filter { $0.kind == "view" }.count)
                    filterChip("Grids", "grid", count: sheets.filter { $0.kind != "view" }.count)
                }
                Button {
                    showArchived.toggle()
                } label: {
                    HStack(spacing: 4) {
                        Text("Archived")
                        if !archived.isEmpty {
                            Text("\(showArchived ? archivedVisible.count : archived.count)")
                                .font(.caption2.weight(.bold))
                                .opacity(0.8)
                        }
                    }
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(Capsule().fill(showArchived ? Color.primary : Color.secondary.opacity(0.12)))
                    .foregroundStyle(showArchived ? Color(UIColor.systemBackground) : Color.secondary)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal)
            .padding(.vertical, 10)
        }
    }

    @ViewBuilder
    private var content: some View {
        if loading && sheets.isEmpty && archived.isEmpty {
            LoadingBlock()
        } else if let error, sheets.isEmpty && archived.isEmpty {
            ErrorBlock(message: error)
        } else if showArchived {
            if archivedVisible.isEmpty {
                EmptyBlock(
                    message: query.isEmpty
                        ? "No archived sheets"
                        : "No archived sheets match “\(query)”"
                )
            } else {
                List {
                    Section {
                        ForEach(archivedVisible) { s in
                            HStack(spacing: 12) {
                                Image(systemName: "archivebox")
                                    .foregroundStyle(Color.secondary)
                                    .frame(width: 32)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(SheetDisplay.displayName(s.name))
                                        .font(.body.weight(.semibold))
                                    Text("\(SheetDisplay.folderLabel(s.folder)) · archived")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                if s.canRestore != false {
                                    Button("Restore") {
                                        Task { await patch(id: s.id, action: "restore") }
                                    }
                                    .buttonStyle(.bordered)
                                    .controlSize(.small)
                                    .disabled(busyId == s.id)
                                }
                            }
                        }
                    } header: {
                        HStack {
                            Text("Archived")
                            Spacer()
                            Text("\(archivedVisible.count)")
                                .foregroundStyle(.tertiary)
                        }
                        .font(.caption.weight(.semibold))
                        .textCase(nil)
                    }
                }
                .listStyle(.insetGrouped)
            }
        } else if visible.isEmpty {
            EmptyBlock(
                message: query.isEmpty
                    ? "No sheets in this filter"
                    : "No sheets match “\(query)”"
            )
        } else {
            List {
                ForEach(sections, id: \.folder) { section in
                    Section {
                        ForEach(section.sheets) { s in
                            NavigationLink {
                                SheetDetailView(
                                    sheetId: s.id,
                                    titleHint: SheetDisplay.displayName(s.name),
                                    initiallyPinned: s.pinned == true,
                                    initiallyCanManage: s.canManage == true
                                )
                            } label: {
                                sheetRow(s)
                            }
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                if s.canManage == true {
                                    Button(role: .destructive) {
                                        Task { await patch(id: s.id, action: "archive") }
                                    } label: {
                                        Label("Archive", systemImage: "archivebox")
                                    }
                                }
                            }
                            .swipeActions(edge: .leading, allowsFullSwipe: true) {
                                Button {
                                    Task { await patch(id: s.id, action: "pin") }
                                } label: {
                                    Label(
                                        s.pinned == true ? "Unpin" : "Pin",
                                        systemImage: s.pinned == true ? "pin.slash" : "pin"
                                    )
                                }
                                .tint(Color.primary)
                            }
                        }
                    } header: {
                        HStack {
                            Text(section.folder)
                            Spacer()
                            Text("\(section.sheets.count)")
                                .foregroundStyle(.tertiary)
                        }
                        .font(.caption.weight(.semibold))
                        .textCase(nil)
                    }
                }
            }
            .listStyle(.insetGrouped)
        }
    }

    private var createSheet: some View {
        NavigationStack {
            Form {
                TextField("Sheet name", text: $newName)
                Text("Leave blank for a timestamped name.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .navigationTitle("New sheet")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showCreate = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") { Task { await create() } }
                }
            }
        }
        .presentationDetents([.medium])
    }

    private func sheetRow(_ s: SheetSummary) -> some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(Color.secondary.opacity(0.12))
                    .frame(width: 40, height: 40)
                Image(systemName: s.kind == "view" ? "eye.fill" : "tablecells.fill")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Color.secondary)
            }
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(SheetDisplay.displayName(s.name))
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    if s.pinned == true {
                        Image(systemName: "pin.fill")
                            .font(.caption2)
                            .foregroundStyle(Color.secondary)
                    }
                }
                Text(SheetDisplay.subtitle(folder: s.folder, kind: s.kind, rowCount: s.rowCount, pinned: nil))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            Text(SheetDisplay.kindLabel(s.kind))
                .font(.caption2.weight(.semibold))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Capsule().fill(Color.secondary.opacity(0.12)))
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
        .accessibilityLabel(
            "\(SheetDisplay.displayName(s.name)), \(SheetDisplay.subtitle(folder: s.folder, kind: s.kind, rowCount: s.rowCount, pinned: s.pinned))"
        )
    }

    private func filterChip(_ title: String, _ key: String, count: Int) -> some View {
        Button {
            filter = key
        } label: {
            HStack(spacing: 4) {
                Text(title)
                if count > 0 {
                    Text("\(count)")
                        .font(.caption2.weight(.bold))
                        .opacity(0.8)
                }
            }
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(Capsule().fill(filter == key ? Color.primary : Color.secondary.opacity(0.12)))
            .foregroundStyle(filter == key ? Color(UIColor.systemBackground) : Color.secondary)
        }
        .buttonStyle(.plain)
    }

    private func load() async {
        if sheets.isEmpty && archived.isEmpty { loading = true }
        do {
            async let active: SheetsListResponse = APIClient.shared.get("/sheets")
            async let archivedRes: ArchivedSheetsResponse = APIClient.shared.get("/sheets?archived=1")
            let (a, ar) = try await (active, archivedRes)
            sheets = a.data
            archived = ar.data
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }

    private func patch(id: Int, action: String) async {
        busyId = id
        do {
            struct Ok: Codable {
                let ok: Bool?
                let pinned: Bool?
                let archived: Bool?
                let restored: Bool?
            }
            let _: Ok = try await APIClient.shared.patch(
                "/sheets/\(id)",
                body: SheetPatchBody(action: action, cell: nil)
            )
            await load()
        } catch {
            self.error = error.localizedDescription
        }
        busyId = nil
    }

    private func create() async {
        let name = newName.trimmingCharacters(in: .whitespaces).isEmpty
            ? "Native sheet \(Int(Date().timeIntervalSince1970))"
            : newName
        do {
            let res: CreateSheetResponse = try await APIClient.shared.post(
                "/sheets",
                body: CreateSheetBody(name: name, kind: "grid", folder: "Mobile")
            )
            showCreate = false
            newName = ""
            await load()
            _ = res.id ?? res.data?.id
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct SheetDetailView: View {
    let sheetId: Int
    var titleHint: String? = nil
    var initiallyPinned: Bool = false
    var initiallyCanManage: Bool = false
    @Environment(\.dismiss) private var dismiss
    @State private var detail: SheetDetailData?
    @State private var loading = true
    @State private var error: String?
    @State private var pinned = false
    @State private var canManage = false
    @State private var edit: (rowId: Int, key: String, label: String, value: String)?
    @State private var editText = ""

    private var navTitle: String {
        if let name = detail?.sheet.name {
            return SheetDisplay.displayName(name)
        }
        return titleHint ?? "Sheet"
    }

    private var showArchive: Bool {
        SheetDisplay.canShowArchive(canManage)
    }

    var body: some View {
        Group {
            if loading { LoadingBlock(label: "Loading sheet…") }
            else if let error, detail == nil { ErrorBlock(message: error) }
            else if let detail {
                if detail.columns.isEmpty {
                    EmptyBlock(message: "This sheet has no columns yet")
                } else if detail.rows.isEmpty {
                    EmptyBlock(message: detail.readOnly == true ? "No rows" : "No rows — tap Add row")
                } else {
                    sheetGrid(detail)
                }
            }
        }
        .navigationTitle(navTitle)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button(pinned ? "Unpin" : "Pin") {
                    Task { await patch(action: "pin", refresh: false) }
                }
                if detail?.readOnly != true {
                    Button("Add row") { Task { await patch(action: "add-row") } }
                }
                if showArchive {
                    Button("Archive", role: .destructive) {
                        Task { await archiveAndDismiss() }
                    }
                }
            }
        }
        .task {
            pinned = initiallyPinned
            canManage = initiallyCanManage
            await load()
        }
        .sheet(item: Binding(
            get: { edit.map { EditCell(id: "\($0.rowId)-\($0.key)", rowId: $0.rowId, key: $0.key, label: $0.label, value: $0.value) } },
            set: { v in
                if v == nil { edit = nil }
            }
        )) { cell in
            NavigationStack {
                Form {
                    Text(cell.label).font(.caption).foregroundStyle(.secondary)
                    TextField("Value", text: $editText)
                }
                .navigationTitle("Edit cell")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { edit = nil }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save") {
                            Task { await saveCell(cell) }
                        }
                    }
                }
                .onAppear { editText = cell.value }
            }
            .presentationDetents([.medium])
        }
    }

    private func sheetGrid(_ detail: SheetDetailData) -> some View {
        let matrix = SheetMatrix.build(columns: detail.columns, rows: detail.rows)
        let readOnly = detail.readOnly == true
        return VStack(alignment: .leading, spacing: 6) {
            Text("Swipe sideways · \(matrix.headers.count) cols · \(matrix.body.count) rows\(readOnly ? " · read-only" : "")")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.horizontal)

            ScrollView([.horizontal, .vertical]) {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 0) {
                        Text("#")
                            .frame(width: 40, alignment: .center)
                            .font(.caption2.weight(.bold))
                        ForEach(Array(matrix.headers.enumerated()), id: \.offset) { i, h in
                            Text(h)
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(Color.secondary)
                                .frame(width: colWidth(h), alignment: .leading)
                                .padding(.horizontal, 6)
                        }
                    }
                    .padding(.vertical, 10)
                    .background(Color.secondary.opacity(0.12))

                    ForEach(Array(matrix.body.enumerated()), id: \.offset) { ri, row in
                        HStack(spacing: 0) {
                            Text("\(ri + 1)")
                                .frame(width: 40, alignment: .center)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                            ForEach(Array(row.cells.enumerated()), id: \.offset) { ci, cell in
                                let key = matrix.keys[ci]
                                let label = matrix.headers[ci]
                                Button {
                                    guard !readOnly else { return }
                                    edit = (row.rowId, key, label, cell == "—" ? "" : cell)
                                } label: {
                                    Text(cell)
                                        .font(.caption)
                                        .foregroundStyle(cell == "—" ? .secondary : .primary)
                                        .frame(width: colWidth(label), alignment: .leading)
                                        .padding(.horizontal, 6)
                                }
                                .buttonStyle(.plain)
                                .disabled(readOnly)
                            }
                        }
                        .padding(.vertical, 10)
                        .background(ri % 2 == 1 ? Color.secondary.opacity(0.06) : Color.clear)
                    }
                }
            }
        }
    }

    private func colWidth(_ label: String) -> CGFloat {
        CGFloat(min(200, max(96, 28 + label.count * 8)))
    }

    private func load() async {
        loading = true
        do {
            let res: SheetDetailResponse = try await APIClient.shared.get("/sheets/\(sheetId)?limit=100&offset=0")
            detail = res.data
            // API is source of truth for pin/canManage (overrides list navigation seeds).
            if let p = res.data.pinned { pinned = p }
            if let m = res.data.canManage { canManage = m }
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }

    private func patch(action: String, refresh: Bool = true) async {
        do {
            struct Ok: Codable { let ok: Bool?; let pinned: Bool?; let rowId: Int? }
            let res: Ok = try await APIClient.shared.patch(
                "/sheets/\(sheetId)",
                body: SheetPatchBody(action: action, cell: nil)
            )
            if action == "pin" {
                if let p = res.pinned { pinned = p }
                else { pinned.toggle() }
            }
            if refresh { await load() }
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func archiveAndDismiss() async {
        do {
            struct Ok: Codable { let archived: Bool? }
            let _: Ok = try await APIClient.shared.patch(
                "/sheets/\(sheetId)",
                body: SheetPatchBody(action: "archive", cell: nil)
            )
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func saveCell(_ cell: EditCell) async {
        do {
            struct Ok: Codable { let ok: Bool? }
            let _: Ok = try await APIClient.shared.patch(
                "/sheets/\(sheetId)",
                body: SheetPatchBody(
                    action: nil,
                    cell: SheetCellPatch(rowId: cell.rowId, key: cell.key, value: editText)
                )
            )
            edit = nil
            await load()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct EditCell: Identifiable {
    let id: String
    let rowId: Int
    let key: String
    let label: String
    let value: String
}
