// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "OpencomSDK",
    platforms: [
        .iOS(.v15)
    ],
    products: [
        .library(
            name: "OpencomSDK",
            targets: ["OpencomSDK"]
        ),
    ],
    targets: [
        .target(
            name: "OpencomSDK",
            dependencies: [],
            path: "Sources/OpencomSDK"
        ),
        .testTarget(
            name: "OpencomSDKTests",
            dependencies: ["OpencomSDK"],
            path: "Tests/OpencomSDKTests"
        ),
    ]
)
