// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "VoiceStudio",
    platforms: [
        .macOS(.v14),
        .iOS(.v17),
    ],
    products: [
        .library(name: "VoiceStudio", targets: ["VoiceStudio"]),
    ],
    targets: [
        .target(name: "VoiceStudio"),
    ]
)
