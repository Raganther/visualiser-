// swift-tools-version: 5.9
// The Prism, native: an app package that opens in Swift Playgrounds on the iPad (4.4 or later) and in Xcode on a Mac.
import PackageDescription
import AppleProductTypes

let package = Package(
    name: "Prism Test",
    platforms: [
        .iOS("17.0")
    ],
    products: [
        .iOSApplication(
            name: "Prism Test",
            targets: ["AppModule"],
            bundleIdentifier: "com.afterglow.prismtest",
            displayVersion: "1.0",
            bundleVersion: "1",
            appIcon: .placeholder(icon: .sparkle),
            accentColor: .presetColor(.purple),
            supportedDeviceFamilies: [
                .pad,
                .phone
            ],
            supportedInterfaceOrientations: [
                .portrait,
                .landscapeRight,
                .landscapeLeft,
                .portraitUpsideDown(.when(deviceFamilies: [.pad]))
            ]
        )
    ],
    targets: [
        .executableTarget(
            name: "AppModule",
            path: "."
        )
    ]
)
