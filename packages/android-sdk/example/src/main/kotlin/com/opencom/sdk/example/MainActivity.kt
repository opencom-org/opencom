package com.opencom.sdk.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.opencom.sdk.Opencom
import com.opencom.sdk.OpencomUser
import com.opencom.sdk.ui.compose.OpencomLauncher
import com.opencom.sdk.ui.compose.OpencomMessenger
import com.opencom.sdk.ui.compose.OpencomHelpCenter
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                MainScreen()
            }
        }
    }
}

@Composable
fun MainScreen() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var showMessenger by remember { mutableStateOf(false) }
    var showHelpCenter by remember { mutableStateOf(false) }
    var isIdentified by remember { mutableStateOf(false) }

    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "Opencom SDK Example",
                style = MaterialTheme.typography.headlineMedium
            )

            Spacer(modifier = Modifier.height(32.dp))

            Button(
                onClick = {
                    scope.launch {
                        Opencom.identify(
                            OpencomUser(
                                userId = "user-123",
                                email = "demo@example.com",
                                name = "Demo User",
                                customAttributes = mapOf("plan" to "pro")
                            )
                        )
                        isIdentified = true
                    }
                },
                enabled = !isIdentified
            ) {
                Text(if (isIdentified) "User Identified" else "Identify User")
            }

            Spacer(modifier = Modifier.height(16.dp))

            Button(onClick = { showMessenger = true }) {
                Text("Open Messenger")
            }

            Spacer(modifier = Modifier.height(16.dp))

            Button(onClick = { showHelpCenter = true }) {
                Text("Open Help Center")
            }

            Spacer(modifier = Modifier.height(16.dp))

            Button(onClick = { Opencom.present(context) }) {
                Text("Present via Activity")
            }

            Spacer(modifier = Modifier.height(16.dp))

            OutlinedButton(
                onClick = {
                    scope.launch {
                        Opencom.trackEvent("button_clicked", mapOf("screen" to "main"))
                    }
                }
            ) {
                Text("Track Event")
            }

            Spacer(modifier = Modifier.height(16.dp))

            OutlinedButton(
                onClick = {
                    scope.launch {
                        Opencom.logout()
                        isIdentified = false
                    }
                },
                enabled = isIdentified
            ) {
                Text("Logout")
            }
        }

        // Floating launcher button
        OpencomLauncher(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(16.dp),
            onClick = { showMessenger = true }
        )

        // Full-screen messenger overlay
        if (showMessenger) {
            OpencomMessenger(
                onClose = { showMessenger = false }
            )
        }

        // Full-screen help center overlay
        if (showHelpCenter) {
            OpencomHelpCenter(
                onClose = { showHelpCenter = false },
                onStartConversation = {
                    showHelpCenter = false
                    showMessenger = true
                }
            )
        }
    }
}
