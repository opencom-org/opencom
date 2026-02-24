import Foundation

/// Errors that can occur when using the Opencom SDK.
public enum OpencomError: LocalizedError {
    case notInitialized
    case noVisitor
    case networkError(Error)
    case invalidResponse
    case pushNotificationsFailed(Error)
    case invalidWorkspace

    public var errorDescription: String? {
        switch self {
        case .notInitialized:
            return "Opencom SDK is not initialized. Call Opencom.initialize() first."
        case .noVisitor:
            return "No visitor session available."
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .invalidResponse:
            return "Invalid response from server."
        case .pushNotificationsFailed(let error):
            return "Push notification registration failed: \(error.localizedDescription)"
        case .invalidWorkspace:
            return "Invalid workspace ID."
        }
    }
}
