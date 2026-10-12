// The Prism, native: a test of the Afterglow Prism alone in the void, with your music and Jam, in Swift and Metal.
import SwiftUI

@main
struct PrismApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
                .statusBarHidden(true)
                .persistentSystemOverlays(.hidden)
        }
    }
}
