package com.opencom.sdk.example

import android.app.Application
import com.opencom.sdk.Opencom
import com.opencom.sdk.OpencomConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class OpencomExampleApp : Application() {

    override fun onCreate() {
        super.onCreate()

        // Initialize Opencom SDK
        CoroutineScope(Dispatchers.Main).launch {
            Opencom.initialize(
                context = this@OpencomExampleApp,
                config = OpencomConfig(
                    workspaceId = "your-workspace-id",
                    convexUrl = "https://your-deployment.convex.cloud",
                    debug = true
                )
            )
        }
    }
}
