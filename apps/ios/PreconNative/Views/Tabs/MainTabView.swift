import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            OverviewView()
                .tabItem { Label("Overview", systemImage: "house") }

            ScheduleView()
                .tabItem { Label("Schedule", systemImage: "calendar") }

            PostBidListView()
                .tabItem { Label("Post-Bid", systemImage: "square.and.pencil") }

            SheetsListView()
                .tabItem { Label("Sheets", systemImage: "tablecells") }

            MoreHubView()
                .tabItem { Label("More", systemImage: "ellipsis.circle") }
        }
        // Grey layout kinship with Expo: system primary (not navy tint on every tab).
        .tint(Color.primary)
    }
}
