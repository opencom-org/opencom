Pod::Spec.new do |s|
  s.name             = 'OpencomSDK'
  s.version          = '1.0.0'
  s.summary          = 'Native iOS SDK for Opencom customer messaging'
  s.description      = <<-DESC
    OpencomSDK provides native SwiftUI and UIKit components for integrating
    Opencom customer messaging into your iOS app. Features include chat messenger,
    help center, mobile carousels, push notifications, and event tracking.
  DESC

  s.homepage         = 'https://github.com/opencom-org/opencom-ios'
  s.license          = { :type => 'AGPL-3.0', :file => 'LICENSE' }
  s.author           = { 'Opencom' => 'support@opencom.io' }
  s.source           = { :git => 'https://github.com/opencom-org/opencom-ios.git', :tag => s.version.to_s }

  s.ios.deployment_target = '15.0'
  s.swift_version = '5.9'

  s.source_files = 'Sources/OpencomSDK/**/*.swift'

  s.frameworks = 'UIKit', 'SwiftUI', 'UserNotifications', 'Security'
end
