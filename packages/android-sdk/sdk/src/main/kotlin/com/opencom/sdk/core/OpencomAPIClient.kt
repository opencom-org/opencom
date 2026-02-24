package com.opencom.sdk.core

import com.opencom.sdk.OpencomConfig
import com.opencom.sdk.OpencomError
import com.opencom.sdk.OpencomUser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.logging.HttpLoggingInterceptor
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

internal class OpencomAPIClient(private val config: OpencomConfig) {

    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .apply {
            if (config.debug) {
                addInterceptor(HttpLoggingInterceptor().apply {
                    level = HttpLoggingInterceptor.Level.BODY
                })
            }
        }
        .build()

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private val baseUrl: String
        get() = config.convexUrl.trimEnd('/')

    suspend fun bootSession(): BootSessionResponse = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("workspaceId", config.workspaceId)
        }

        val response = post("/api/sessions/boot", body)
        BootSessionResponse(
            visitorId = response.getJSONObject("visitor").getString("_id"),
            sessionToken = response.getString("sessionToken"),
            expiresAt = response.getLong("expiresAt")
        )
    }

    suspend fun refreshSession(sessionToken: String): RefreshSessionResponse = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("workspaceId", config.workspaceId)
            put("sessionToken", sessionToken)
        }

        val response = post("/api/sessions/refresh", body)
        RefreshSessionResponse(
            sessionToken = response.getString("sessionToken"),
            expiresAt = response.getLong("expiresAt")
        )
    }

    suspend fun revokeSession(sessionToken: String): Unit = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("workspaceId", config.workspaceId)
            put("sessionToken", sessionToken)
        }

        post("/api/sessions/revoke", body)
    }

    suspend fun identifyVisitor(
        visitorId: String,
        sessionToken: String?,
        user: OpencomUser
    ): Unit = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("visitorId", visitorId)
            put("workspaceId", config.workspaceId)
            sessionToken?.let { put("sessionToken", it) }
            user.userId?.let { put("userId", it) }
            user.email?.let { put("email", it) }
            user.name?.let { put("name", it) }
            user.company?.let { put("company", it) }
            if (user.customAttributes.isNotEmpty()) {
                put("customAttributes", JSONObject(user.customAttributes))
            }
        }

        post("/api/visitors/identify", body)
    }

    suspend fun trackEvent(
        visitorId: String,
        sessionToken: String?,
        name: String,
        properties: Map<String, Any>?,
        sessionId: String
    ): Unit = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("visitorId", visitorId)
            put("workspaceId", config.workspaceId)
            sessionToken?.let { put("sessionToken", it) }
            put("name", name)
            put("sessionId", sessionId)
            properties?.let { put("properties", JSONObject(it)) }
        }

        post("/api/events/track", body)
    }

    suspend fun heartbeat(visitorId: String, sessionToken: String?): Unit = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("visitorId", visitorId)
            put("workspaceId", config.workspaceId)
            sessionToken?.let { put("sessionToken", it) }
        }

        post("/api/visitors/heartbeat", body)
    }

    suspend fun endSession(visitorId: String, sessionId: String): Unit = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("visitorId", visitorId)
            put("sessionId", sessionId)
            put("workspaceId", config.workspaceId)
        }

        post("/api/sessions/end", body)
    }

    suspend fun registerPushToken(
        visitorId: String,
        token: String,
        platform: String = "android"
    ): Unit = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("visitorId", visitorId)
            put("workspaceId", config.workspaceId)
            put("token", token)
            put("platform", platform)
        }

        post("/api/push/register", body)
    }

    suspend fun getConversations(visitorId: String, sessionToken: String? = null): List<Conversation> = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("visitorId", visitorId)
            put("workspaceId", config.workspaceId)
            sessionToken?.let { put("sessionToken", it) }
        }

        val response = post("/api/conversations/list", body)
        val conversations = response.optJSONArray("conversations") ?: JSONArray()

        (0 until conversations.length()).map { i ->
            val conv = conversations.getJSONObject(i)
            Conversation(
                id = conv.getString("id"),
                title = conv.optString("title"),
                lastMessage = conv.optString("lastMessage"),
                lastMessageAt = conv.optLong("lastMessageAt"),
                unreadCount = conv.optInt("unreadCount", 0)
            )
        }
    }

    suspend fun getMessages(conversationId: String, visitorId: String? = null, sessionToken: String? = null): List<Message> = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("conversationId", conversationId)
            put("workspaceId", config.workspaceId)
            visitorId?.let { put("visitorId", it) }
            sessionToken?.let { put("sessionToken", it) }
        }

        val response = post("/api/messages/list", body)
        val messages = response.optJSONArray("messages") ?: JSONArray()

        (0 until messages.length()).map { i ->
            val msg = messages.getJSONObject(i)
            Message(
                id = msg.getString("id"),
                conversationId = msg.getString("conversationId"),
                content = msg.getString("content"),
                senderType = msg.getString("senderType"),
                senderName = msg.optString("senderName"),
                createdAt = msg.getLong("createdAt"),
                isRead = msg.optBoolean("isRead", false)
            )
        }
    }

    suspend fun sendMessage(
        conversationId: String,
        visitorId: String,
        content: String,
        sessionToken: String? = null
    ): Message = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("conversationId", conversationId)
            put("visitorId", visitorId)
            put("workspaceId", config.workspaceId)
            put("content", content)
            sessionToken?.let { put("sessionToken", it) }
        }

        val response = post("/api/messages/send", body)
        Message(
            id = response.getString("id"),
            conversationId = conversationId,
            content = content,
            senderType = "visitor",
            senderName = null,
            createdAt = response.getLong("createdAt"),
            isRead = false
        )
    }

    suspend fun createConversation(visitorId: String, sessionToken: String? = null): Conversation = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("visitorId", visitorId)
            put("workspaceId", config.workspaceId)
            sessionToken?.let { put("sessionToken", it) }
        }

        val response = post("/api/conversations/create", body)
        Conversation(
            id = response.getString("id"),
            title = null,
            lastMessage = null,
            lastMessageAt = System.currentTimeMillis(),
            unreadCount = 0
        )
    }

    suspend fun getArticles(): List<Article> = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("workspaceId", config.workspaceId)
        }

        val response = post("/api/articles/list", body)
        val articles = response.optJSONArray("articles") ?: JSONArray()

        (0 until articles.length()).map { i ->
            val article = articles.getJSONObject(i)
            Article(
                id = article.getString("id"),
                title = article.getString("title"),
                summary = article.optString("summary"),
                content = article.optString("content"),
                collectionId = article.optString("collectionId")
            )
        }
    }

    suspend fun searchArticles(query: String): List<Article> = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("workspaceId", config.workspaceId)
            put("query", query)
        }

        val response = post("/api/articles/search", body)
        val articles = response.optJSONArray("articles") ?: JSONArray()

        (0 until articles.length()).map { i ->
            val article = articles.getJSONObject(i)
            Article(
                id = article.getString("id"),
                title = article.getString("title"),
                summary = article.optString("summary"),
                content = article.optString("content"),
                collectionId = article.optString("collectionId")
            )
        }
    }

    suspend fun getCarousel(carouselId: String): Carousel? = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("workspaceId", config.workspaceId)
            put("carouselId", carouselId)
        }

        try {
            val response = post("/api/carousels/get", body)
            val screens = response.optJSONArray("screens") ?: JSONArray()

            Carousel(
                id = response.getString("id"),
                name = response.optString("name"),
                screens = (0 until screens.length()).map { i ->
                    val screen = screens.getJSONObject(i)
                    CarouselScreen(
                        id = screen.getString("id"),
                        title = screen.optString("title"),
                        body = screen.optString("body"),
                        imageUrl = screen.optString("imageUrl"),
                        buttonText = screen.optString("buttonText"),
                        buttonAction = screen.optString("buttonAction")
                    )
                }
            )
        } catch (e: Exception) {
            null
        }
    }

    suspend fun trackCarouselInteraction(
        visitorId: String,
        carouselId: String,
        action: String,
        screenIndex: Int
    ): Unit = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("visitorId", visitorId)
            put("workspaceId", config.workspaceId)
            put("carouselId", carouselId)
            put("action", action)
            put("screenIndex", screenIndex)
        }

        post("/api/carousels/track", body)
    }

    private fun post(path: String, body: JSONObject): JSONObject {
        val request = Request.Builder()
            .url("$baseUrl$path")
            .post(body.toString().toRequestBody(jsonMediaType))
            .header("Content-Type", "application/json")
            .build()

        val response = client.newCall(request).execute()

        if (!response.isSuccessful) {
            val errorBody = response.body?.string()
            throw OpencomError.ApiError(response.code, errorBody)
        }

        val responseBody = response.body?.string() ?: "{}"
        return try {
            JSONObject(responseBody)
        } catch (e: Exception) {
            throw OpencomError.ParseError(e)
        }
    }

    data class BootSessionResponse(
        val visitorId: String,
        val sessionToken: String,
        val expiresAt: Long
    )

    data class RefreshSessionResponse(
        val sessionToken: String,
        val expiresAt: Long
    )
}

data class Conversation(
    val id: String,
    val title: String?,
    val lastMessage: String?,
    val lastMessageAt: Long,
    val unreadCount: Int
)

data class Message(
    val id: String,
    val conversationId: String,
    val content: String,
    val senderType: String,
    val senderName: String?,
    val createdAt: Long,
    val isRead: Boolean
)

data class Article(
    val id: String,
    val title: String,
    val summary: String?,
    val content: String?,
    val collectionId: String?
)

data class Carousel(
    val id: String,
    val name: String?,
    val screens: List<CarouselScreen>
)

data class CarouselScreen(
    val id: String,
    val title: String?,
    val body: String?,
    val imageUrl: String?,
    val buttonText: String?,
    val buttonAction: String?
)
