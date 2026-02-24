package com.opencom.sdk.ui.compose

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.opencom.sdk.Opencom
import com.opencom.sdk.core.Carousel
import com.opencom.sdk.core.CarouselScreen
import kotlinx.coroutines.launch

/**
 * Swipeable carousel composable for onboarding and engagement.
 *
 * @param carouselId The carousel ID to display
 * @param onDismiss Callback when user dismisses the carousel
 * @param onComplete Callback when user completes the carousel
 * @param modifier Modifier for the root layout
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun OpencomCarousel(
    carouselId: String,
    onDismiss: () -> Unit,
    onComplete: () -> Unit,
    modifier: Modifier = Modifier
) {
    val theme = Opencom.theme
    val scope = rememberCoroutineScope()
    var carousel by remember { mutableStateOf<Carousel?>(null) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(carouselId) {
        try {
            carousel = Opencom.apiClientInternal?.getCarousel(carouselId)

            // Track carousel view
            Opencom.visitorId?.let { visitorId ->
                Opencom.apiClientInternal?.trackCarouselInteraction(
                    visitorId = visitorId,
                    carouselId = carouselId,
                    action = "view",
                    screenIndex = 0
                )
            }
        } catch (e: Exception) {
            // Handle error
        } finally {
            isLoading = false
        }
    }

    Surface(
        modifier = modifier.fillMaxSize(),
        color = theme.backgroundColor
    ) {
        when {
            isLoading -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = theme.primaryColor)
                }
            }
            carousel == null || carousel!!.screens.isEmpty() -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text("Carousel not found", color = theme.secondaryTextColor)
                }
            }
            else -> {
                CarouselContent(
                    carousel = carousel!!,
                    onDismiss = onDismiss,
                    onComplete = onComplete
                )
            }
        }
    }
}

/**
 * Carousel composable with pre-loaded screens.
 *
 * @param screens List of carousel screens to display
 * @param carouselId Optional carousel ID for tracking
 * @param onDismiss Callback when user dismisses the carousel
 * @param onComplete Callback when user completes the carousel
 * @param modifier Modifier for the root layout
 */
@Composable
fun OpencomCarousel(
    screens: List<CarouselScreen>,
    carouselId: String? = null,
    onDismiss: () -> Unit,
    onComplete: () -> Unit,
    modifier: Modifier = Modifier
) {
    val theme = Opencom.theme

    Surface(
        modifier = modifier.fillMaxSize(),
        color = theme.backgroundColor
    ) {
        if (screens.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Text("No screens to display", color = theme.secondaryTextColor)
            }
        } else {
            CarouselContent(
                carousel = Carousel(id = carouselId ?: "", name = null, screens = screens),
                onDismiss = onDismiss,
                onComplete = onComplete
            )
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun CarouselContent(
    carousel: Carousel,
    onDismiss: () -> Unit,
    onComplete: () -> Unit
) {
    val theme = Opencom.theme
    val scope = rememberCoroutineScope()
    val pagerState = rememberPagerState(pageCount = { carousel.screens.size })

    LaunchedEffect(pagerState.currentPage) {
        if (carousel.id.isNotEmpty()) {
            Opencom.visitorId?.let { visitorId ->
                Opencom.apiClientInternal?.trackCarouselInteraction(
                    visitorId = visitorId,
                    carouselId = carousel.id,
                    action = "view_screen",
                    screenIndex = pagerState.currentPage
                )
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxSize()
        ) { page ->
            CarouselScreenContent(
                screen = carousel.screens[page],
                isLastScreen = page == carousel.screens.size - 1,
                onNext = {
                    scope.launch {
                        if (page < carousel.screens.size - 1) {
                            pagerState.animateScrollToPage(page + 1)
                        } else {
                            if (carousel.id.isNotEmpty()) {
                                Opencom.visitorId?.let { visitorId ->
                                    Opencom.apiClientInternal?.trackCarouselInteraction(
                                        visitorId = visitorId,
                                        carouselId = carousel.id,
                                        action = "complete",
                                        screenIndex = page
                                    )
                                }
                            }
                            onComplete()
                        }
                    }
                }
            )
        }

        // Close button
        IconButton(
            onClick = {
                scope.launch {
                    if (carousel.id.isNotEmpty()) {
                        Opencom.visitorId?.let { visitorId ->
                            Opencom.apiClientInternal?.trackCarouselInteraction(
                                visitorId = visitorId,
                                carouselId = carousel.id,
                                action = "dismiss",
                                screenIndex = pagerState.currentPage
                            )
                        }
                    }
                    onDismiss()
                }
            },
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(16.dp)
        ) {
            Icon(
                Icons.Default.Close,
                contentDescription = "Close",
                tint = theme.secondaryTextColor
            )
        }

        // Page indicators
        Row(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 100.dp),
            horizontalArrangement = Arrangement.Center
        ) {
            repeat(carousel.screens.size) { index ->
                Box(
                    modifier = Modifier
                        .padding(4.dp)
                        .size(if (index == pagerState.currentPage) 10.dp else 8.dp)
                        .clip(CircleShape)
                        .background(
                            if (index == pagerState.currentPage) theme.primaryColor
                            else theme.secondaryTextColor.copy(alpha = 0.3f)
                        )
                )
            }
        }
    }
}

@Composable
private fun CarouselScreenContent(
    screen: CarouselScreen,
    isLastScreen: Boolean,
    onNext: () -> Unit
) {
    val theme = Opencom.theme

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        if (screen.imageUrl != null) {
            AsyncImage(
                model = screen.imageUrl,
                contentDescription = null,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(250.dp)
                    .clip(RoundedCornerShape(16.dp)),
                contentScale = ContentScale.Fit
            )
            Spacer(modifier = Modifier.height(32.dp))
        }

        if (screen.title != null) {
            Text(
                text = screen.title,
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = theme.textColor,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(16.dp))
        }

        if (screen.body != null) {
            Text(
                text = screen.body,
                fontSize = 16.sp,
                color = theme.secondaryTextColor,
                textAlign = TextAlign.Center,
                lineHeight = 24.sp
            )
        }

        Spacer(modifier = Modifier.height(48.dp))

        Button(
            onClick = onNext,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            shape = RoundedCornerShape(theme.buttonRadius.dp),
            colors = ButtonDefaults.buttonColors(containerColor = theme.primaryColor)
        ) {
            Text(
                text = screen.buttonText ?: if (isLastScreen) "Get Started" else "Next",
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}
