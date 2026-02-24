package com.opencom.sdk.ui.compose

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.opencom.sdk.Opencom
import com.opencom.sdk.core.Article
import kotlinx.coroutines.launch

/**
 * Help center UI composable with article search and display.
 *
 * @param onClose Callback when user wants to close the help center
 * @param onStartConversation Optional callback to start a conversation
 * @param modifier Modifier for the root layout
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OpencomHelpCenter(
    onClose: () -> Unit,
    onStartConversation: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val theme = Opencom.theme
    var selectedArticle by remember { mutableStateOf<Article?>(null) }

    Surface(
        modifier = modifier.fillMaxSize(),
        color = theme.backgroundColor
    ) {
        if (selectedArticle != null) {
            ArticleDetail(
                article = selectedArticle!!,
                onBack = { selectedArticle = null },
                onStartConversation = onStartConversation
            )
        } else {
            ArticleList(
                onArticleSelected = { selectedArticle = it },
                onClose = onClose,
                onStartConversation = onStartConversation
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ArticleList(
    onArticleSelected: (Article) -> Unit,
    onClose: () -> Unit,
    onStartConversation: (() -> Unit)?
) {
    val theme = Opencom.theme
    val scope = rememberCoroutineScope()
    var articles by remember { mutableStateOf<List<Article>>(emptyList()) }
    var searchResults by remember { mutableStateOf<List<Article>?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var searchQuery by remember { mutableStateOf("") }
    var isSearching by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        try {
            articles = Opencom.apiClientInternal?.getArticles() ?: emptyList()
        } catch (e: Exception) {
            // Handle error
        } finally {
            isLoading = false
        }
    }

    fun performSearch(query: String) {
        if (query.isBlank()) {
            searchResults = null
            return
        }
        scope.launch {
            isSearching = true
            try {
                searchResults = Opencom.apiClientInternal?.searchArticles(query)
            } catch (e: Exception) {
                // Handle error
            } finally {
                isSearching = false
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Help Center") },
                navigationIcon = {
                    IconButton(onClick = onClose) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Close")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = theme.backgroundColor
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = {
                    searchQuery = it
                    performSearch(it)
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                placeholder = { Text("Search articles...") },
                leadingIcon = {
                    Icon(Icons.Default.Search, contentDescription = null)
                },
                singleLine = true,
                shape = RoundedCornerShape(24.dp)
            )

            val displayArticles = searchResults ?: articles

            when {
                isLoading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = theme.primaryColor)
                    }
                }
                isSearching -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = theme.primaryColor)
                    }
                }
                displayArticles.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                if (searchQuery.isNotBlank()) "No results found" else "No articles available",
                                color = theme.secondaryTextColor
                            )
                            if (onStartConversation != null) {
                                Spacer(modifier = Modifier.height(16.dp))
                                Button(
                                    onClick = onStartConversation,
                                    colors = ButtonDefaults.buttonColors(containerColor = theme.primaryColor)
                                ) {
                                    Text("Contact Support")
                                }
                            }
                        }
                    }
                }
                else -> {
                    LazyColumn(modifier = Modifier.fillMaxSize()) {
                        items(displayArticles) { article ->
                            ArticleItem(
                                article = article,
                                onClick = { onArticleSelected(article) }
                            )
                        }

                        if (onStartConversation != null) {
                            item {
                                Spacer(modifier = Modifier.height(16.dp))
                                Box(
                                    modifier = Modifier.fillMaxWidth(),
                                    contentAlignment = Alignment.Center
                                ) {
                                    TextButton(onClick = onStartConversation) {
                                        Text(
                                            "Can't find what you're looking for? Contact us",
                                            color = theme.primaryColor
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.height(16.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ArticleItem(
    article: Article,
    onClick: () -> Unit
) {
    val theme = Opencom.theme

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(16.dp)
    ) {
        Text(
            text = article.title,
            fontWeight = FontWeight.Medium,
            color = theme.textColor
        )
        if (article.summary != null) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = article.summary,
                color = theme.secondaryTextColor,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                fontSize = 14.sp
            )
        }
    }
    HorizontalDivider()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ArticleDetail(
    article: Article,
    onBack: () -> Unit,
    onStartConversation: (() -> Unit)?
) {
    val theme = Opencom.theme

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Article") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = theme.backgroundColor
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
        ) {
            Text(
                text = article.title,
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = theme.textColor
            )

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = article.content ?: article.summary ?: "",
                color = theme.textColor,
                lineHeight = 24.sp
            )

            if (onStartConversation != null) {
                Spacer(modifier = Modifier.height(32.dp))
                HorizontalDivider()
                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = "Still need help?",
                    fontWeight = FontWeight.Medium,
                    color = theme.textColor
                )
                Spacer(modifier = Modifier.height(8.dp))
                Button(
                    onClick = onStartConversation,
                    colors = ButtonDefaults.buttonColors(containerColor = theme.primaryColor)
                ) {
                    Text("Contact Support")
                }
            }
        }
    }
}
