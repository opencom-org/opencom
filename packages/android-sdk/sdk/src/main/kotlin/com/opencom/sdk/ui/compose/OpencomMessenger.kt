package com.opencom.sdk.ui.compose

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.opencom.sdk.Opencom
import com.opencom.sdk.core.Conversation
import com.opencom.sdk.core.Message
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

/**
 * Full messenger UI composable.
 * Shows conversation list or conversation detail based on state.
 *
 * @param onClose Callback when user wants to close the messenger
 * @param modifier Modifier for the root layout
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OpencomMessenger(
    onClose: () -> Unit,
    modifier: Modifier = Modifier
) {
    val theme = Opencom.theme
    var selectedConversationId by remember { mutableStateOf<String?>(null) }

    Surface(
        modifier = modifier.fillMaxSize(),
        color = theme.backgroundColor
    ) {
        if (selectedConversationId != null) {
            ConversationDetail(
                conversationId = selectedConversationId!!,
                onBack = { selectedConversationId = null },
                onClose = onClose
            )
        } else {
            ConversationList(
                onConversationSelected = { selectedConversationId = it },
                onClose = onClose
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ConversationList(
    onConversationSelected: (String) -> Unit,
    onClose: () -> Unit
) {
    val theme = Opencom.theme
    val scope = rememberCoroutineScope()
    var conversations by remember { mutableStateOf<List<Conversation>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        try {
            val visitorId = Opencom.visitorId
            if (visitorId != null) {
                val sessionToken = Opencom.sessionManagerInternal?.sessionToken
                conversations = Opencom.apiClientInternal?.getConversations(visitorId, sessionToken) ?: emptyList()
            }
        } catch (e: Exception) {
            error = e.message
        } finally {
            isLoading = false
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Messages") },
                navigationIcon = {
                    IconButton(onClick = onClose) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Close")
                    }
                },
                actions = {
                    IconButton(onClick = {
                        scope.launch {
                            try {
                                val visitorId = Opencom.visitorId ?: return@launch
                                val sessionToken = Opencom.sessionManagerInternal?.sessionToken
                                val newConversation = Opencom.apiClientInternal?.createConversation(visitorId, sessionToken)
                                newConversation?.let { onConversationSelected(it.id) }
                            } catch (e: Exception) {
                                error = e.message
                            }
                        }
                    }) {
                        Icon(Icons.Default.Add, contentDescription = "New conversation")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = theme.backgroundColor
                )
            )
        }
    ) { padding ->
        when {
            isLoading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = theme.primaryColor)
                }
            }
            error != null -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    Text(error ?: "An error occurred", color = Color.Red)
                }
            }
            conversations.isEmpty() -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            "No conversations yet",
                            color = theme.secondaryTextColor
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = {
                                scope.launch {
                                    try {
                                        val visitorId = Opencom.visitorId ?: return@launch
                                        val sessionToken = Opencom.sessionManagerInternal?.sessionToken
                                        val newConversation = Opencom.apiClientInternal?.createConversation(visitorId, sessionToken)
                                        newConversation?.let { onConversationSelected(it.id) }
                                    } catch (e: Exception) {
                                        error = e.message
                                    }
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = theme.primaryColor)
                        ) {
                            Text("Start a conversation")
                        }
                    }
                }
            }
            else -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                ) {
                    items(conversations) { conversation ->
                        ConversationItem(
                            conversation = conversation,
                            onClick = { onConversationSelected(conversation.id) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ConversationItem(
    conversation: Conversation,
    onClick: () -> Unit
) {
    val theme = Opencom.theme
    val dateFormat = remember { SimpleDateFormat("MMM d", Locale.getDefault()) }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = conversation.title ?: "Conversation",
                fontWeight = if (conversation.unreadCount > 0) FontWeight.Bold else FontWeight.Normal,
                color = theme.textColor
            )
            if (conversation.lastMessage != null) {
                Text(
                    text = conversation.lastMessage,
                    color = theme.secondaryTextColor,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    fontSize = 14.sp
                )
            }
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(
                text = dateFormat.format(Date(conversation.lastMessageAt)),
                color = theme.secondaryTextColor,
                fontSize = 12.sp
            )
            if (conversation.unreadCount > 0) {
                Spacer(modifier = Modifier.height(4.dp))
                Box(
                    modifier = Modifier
                        .size(20.dp)
                        .background(theme.primaryColor, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = conversation.unreadCount.toString(),
                        color = theme.onPrimaryColor,
                        fontSize = 12.sp
                    )
                }
            }
        }
    }
    HorizontalDivider()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ConversationDetail(
    conversationId: String,
    onBack: () -> Unit,
    onClose: () -> Unit
) {
    val theme = Opencom.theme
    val scope = rememberCoroutineScope()
    var messages by remember { mutableStateOf<List<Message>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var messageText by remember { mutableStateOf("") }
    var isSending by remember { mutableStateOf(false) }
    val listState = rememberLazyListState()

    LaunchedEffect(conversationId) {
        try {
            val sessionToken = Opencom.sessionManagerInternal?.sessionToken
            messages = Opencom.apiClientInternal?.getMessages(conversationId, Opencom.visitorId, sessionToken) ?: emptyList()
        } catch (e: Exception) {
            // Handle error
        } finally {
            isLoading = false
        }
    }

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Conversation") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = theme.backgroundColor
                )
            )
        },
        bottomBar = {
            Surface(
                shadowElevation = 8.dp,
                color = theme.backgroundColor
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = messageText,
                        onValueChange = { messageText = it },
                        modifier = Modifier.weight(1f),
                        placeholder = { Text("Type a message...") },
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                        keyboardActions = KeyboardActions(
                            onSend = {
                                if (messageText.isNotBlank() && !isSending) {
                                    scope.launch {
                                        sendMessage(
                                            conversationId = conversationId,
                                            content = messageText,
                                            onSuccess = { newMessage ->
                                                messages = messages + newMessage
                                                messageText = ""
                                            },
                                            onComplete = { isSending = false }
                                        )
                                    }
                                    isSending = true
                                }
                            }
                        ),
                        singleLine = true,
                        shape = RoundedCornerShape(24.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    IconButton(
                        onClick = {
                            if (messageText.isNotBlank() && !isSending) {
                                scope.launch {
                                    sendMessage(
                                        conversationId = conversationId,
                                        content = messageText,
                                        onSuccess = { newMessage ->
                                            messages = messages + newMessage
                                            messageText = ""
                                        },
                                        onComplete = { isSending = false }
                                    )
                                }
                                isSending = true
                            }
                        },
                        enabled = messageText.isNotBlank() && !isSending
                    ) {
                        Icon(
                            Icons.AutoMirrored.Filled.Send,
                            contentDescription = "Send",
                            tint = if (messageText.isNotBlank()) theme.primaryColor else theme.secondaryTextColor
                        )
                    }
                }
            }
        }
    ) { padding ->
        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = theme.primaryColor)
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = 16.dp),
                state = listState
            ) {
                items(messages) { message ->
                    MessageBubble(message = message)
                    Spacer(modifier = Modifier.height(8.dp))
                }
            }
        }
    }
}

@Composable
private fun MessageBubble(message: Message) {
    val theme = Opencom.theme
    val isUser = message.senderType == "visitor"
    val bubbleColor = if (isUser) theme.userMessageColor else theme.agentMessageColor
    val textColor = if (isUser) theme.onPrimaryColor else theme.textColor

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = if (isUser) Alignment.End else Alignment.Start
    ) {
        if (!isUser && message.senderName != null) {
            Text(
                text = message.senderName,
                fontSize = 12.sp,
                color = theme.secondaryTextColor,
                modifier = Modifier.padding(bottom = 4.dp)
            )
        }
        Box(
            modifier = Modifier
                .widthIn(max = 280.dp)
                .clip(
                    RoundedCornerShape(
                        topStart = theme.messageBubbleRadius.dp,
                        topEnd = theme.messageBubbleRadius.dp,
                        bottomStart = if (isUser) theme.messageBubbleRadius.dp else 4.dp,
                        bottomEnd = if (isUser) 4.dp else theme.messageBubbleRadius.dp
                    )
                )
                .background(bubbleColor)
                .padding(12.dp)
        ) {
            Text(
                text = message.content,
                color = textColor
            )
        }
    }
}

private suspend fun sendMessage(
    conversationId: String,
    content: String,
    onSuccess: (Message) -> Unit,
    onComplete: () -> Unit
) {
    try {
        val visitorId = Opencom.visitorId ?: return
        val sessionToken = Opencom.sessionManagerInternal?.sessionToken
        val message = Opencom.apiClientInternal?.sendMessage(conversationId, visitorId, content, sessionToken)
        message?.let { onSuccess(it) }
    } catch (e: Exception) {
        // Handle error
    } finally {
        onComplete()
    }
}

private val CircleShape = RoundedCornerShape(50)
