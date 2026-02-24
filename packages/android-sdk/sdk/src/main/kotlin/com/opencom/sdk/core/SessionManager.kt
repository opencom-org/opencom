package com.opencom.sdk.core

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.opencom.sdk.OpencomConfig
import com.opencom.sdk.OpencomUser
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

internal class SessionManager(
    private val context: Context,
    private val apiClient: OpencomAPIClient,
    private val config: OpencomConfig
) {
    private val mutex = Mutex()

    private var _visitorId: String? = null
    val visitorId: String? get() = _visitorId

    private var _sessionId: String? = null
    val sessionId: String? get() = _sessionId

    private var _sessionToken: String? = null
    val sessionToken: String? get() = _sessionToken

    private var _sessionExpiresAt: Long? = null
    val sessionExpiresAt: Long? get() = _sessionExpiresAt

    private var _isIdentified: Boolean = false
    val isIdentified: Boolean get() = _isIdentified

    private var refreshJob: Job? = null
    private val refreshScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private val prefs: SharedPreferences by lazy {
        try {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()

            EncryptedSharedPreferences.create(
                context,
                PREFS_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        }
    }

    suspend fun initializeSession() = mutex.withLock {
        // Boot a signed session
        val response = apiClient.bootSession()
        _visitorId = response.visitorId
        _sessionToken = response.sessionToken
        _sessionExpiresAt = response.expiresAt
        _sessionId = response.visitorId // use visitorId as sessionId fallback
        _isIdentified = false

        prefs.edit()
            .putString(KEY_VISITOR_ID, response.visitorId)
            .putString(KEY_SESSION_TOKEN, response.sessionToken)
            .putLong(KEY_SESSION_EXPIRES_AT, response.expiresAt)
            .putString(KEY_WORKSPACE_ID, config.workspaceId)
            .putBoolean(KEY_IS_IDENTIFIED, false)
            .apply()

        scheduleRefresh(response.expiresAt)
    }

    suspend fun identify(user: OpencomUser) = mutex.withLock {
        val currentVisitorId = _visitorId ?: throw IllegalStateException("No visitor ID")

        apiClient.identifyVisitor(currentVisitorId, _sessionToken, user)
        _isIdentified = true

        prefs.edit()
            .putBoolean(KEY_IS_IDENTIFIED, true)
            .apply()
    }

    suspend fun logout() = mutex.withLock {
        // Revoke current session
        _sessionToken?.let { token ->
            try {
                apiClient.revokeSession(token)
            } catch (e: Exception) {
                // Ignore errors when revoking session
            }
        }

        stopRefreshTimer()

        prefs.edit()
            .remove(KEY_VISITOR_ID)
            .remove(KEY_SESSION_TOKEN)
            .remove(KEY_SESSION_EXPIRES_AT)
            .remove(KEY_IS_IDENTIFIED)
            .apply()

        // Boot a new signed session
        val response = apiClient.bootSession()
        _visitorId = response.visitorId
        _sessionToken = response.sessionToken
        _sessionExpiresAt = response.expiresAt
        _sessionId = response.visitorId
        _isIdentified = false

        prefs.edit()
            .putString(KEY_VISITOR_ID, response.visitorId)
            .putString(KEY_SESSION_TOKEN, response.sessionToken)
            .putLong(KEY_SESSION_EXPIRES_AT, response.expiresAt)
            .putString(KEY_WORKSPACE_ID, config.workspaceId)
            .putBoolean(KEY_IS_IDENTIFIED, false)
            .apply()

        scheduleRefresh(response.expiresAt)
    }

    fun reset() {
        stopRefreshTimer()
        prefs.edit().clear().apply()
        _visitorId = null
        _sessionId = null
        _sessionToken = null
        _sessionExpiresAt = null
        _isIdentified = false
    }

    private fun scheduleRefresh(expiresAt: Long) {
        stopRefreshTimer()
        val delayMs = maxOf(0L, expiresAt - System.currentTimeMillis() - REFRESH_MARGIN_MS)
        refreshJob = refreshScope.launch {
            delay(delayMs)
            performRefresh()
        }
    }

    private suspend fun performRefresh() {
        val token = _sessionToken ?: return
        try {
            val result = apiClient.refreshSession(token)
            mutex.withLock {
                _sessionToken = result.sessionToken
                _sessionExpiresAt = result.expiresAt
                prefs.edit()
                    .putString(KEY_SESSION_TOKEN, result.sessionToken)
                    .putLong(KEY_SESSION_EXPIRES_AT, result.expiresAt)
                    .apply()
            }
            scheduleRefresh(result.expiresAt)
        } catch (e: Exception) {
            Logger.w("Session refresh failed", e)
        }
    }

    private fun stopRefreshTimer() {
        refreshJob?.cancel()
        refreshJob = null
    }

    companion object {
        private const val PREFS_NAME = "opencom_session"
        private const val KEY_VISITOR_ID = "visitor_id"
        private const val KEY_SESSION_TOKEN = "session_token"
        private const val KEY_SESSION_EXPIRES_AT = "session_expires_at"
        private const val KEY_WORKSPACE_ID = "workspace_id"
        private const val KEY_IS_IDENTIFIED = "is_identified"
        private const val REFRESH_MARGIN_MS = 60_000L
    }
}
