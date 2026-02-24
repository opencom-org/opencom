package com.opencom.sdk.ui.views

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.fragment.app.Fragment
import com.opencom.sdk.ui.compose.OpencomCarousel
import com.opencom.sdk.ui.compose.OpencomHelpCenter
import com.opencom.sdk.ui.compose.OpencomMessenger

/**
 * Fragment wrapper for embedding Opencom UI in View-based apps.
 *
 * Usage:
 * ```kotlin
 * val fragment = OpencomFragment.newInstance(OpencomFragment.SCREEN_MESSENGER)
 * supportFragmentManager.beginTransaction()
 *     .replace(R.id.container, fragment)
 *     .addToBackStack(null)
 *     .commit()
 * ```
 */
class OpencomFragment : Fragment() {

    private var screen: String = SCREEN_MESSENGER
    private var carouselId: String? = null
    private var onCloseListener: (() -> Unit)? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        arguments?.let {
            screen = it.getString(ARG_SCREEN, SCREEN_MESSENGER)
            carouselId = it.getString(ARG_CAROUSEL_ID)
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                when (screen) {
                    SCREEN_MESSENGER -> {
                        OpencomMessenger(
                            onClose = { handleClose() }
                        )
                    }
                    SCREEN_HELP_CENTER -> {
                        OpencomHelpCenter(
                            onClose = { handleClose() },
                            onStartConversation = {
                                screen = SCREEN_MESSENGER
                                // Trigger recomposition
                                setContent {
                                    OpencomMessenger(onClose = { handleClose() })
                                }
                            }
                        )
                    }
                    SCREEN_CAROUSEL -> {
                        if (carouselId != null) {
                            OpencomCarousel(
                                carouselId = carouselId!!,
                                onDismiss = { handleClose() },
                                onComplete = { handleClose() }
                            )
                        }
                    }
                }
            }
        }
    }

    private fun handleClose() {
        onCloseListener?.invoke() ?: run {
            parentFragmentManager.popBackStack()
        }
    }

    /**
     * Set a listener for when the fragment should close.
     */
    fun setOnCloseListener(listener: () -> Unit) {
        onCloseListener = listener
    }

    companion object {
        private const val ARG_SCREEN = "screen"
        private const val ARG_CAROUSEL_ID = "carousel_id"

        const val SCREEN_MESSENGER = "messenger"
        const val SCREEN_HELP_CENTER = "help_center"
        const val SCREEN_CAROUSEL = "carousel"

        /**
         * Create a new messenger fragment.
         */
        @JvmStatic
        fun newInstance(screen: String = SCREEN_MESSENGER): OpencomFragment {
            return OpencomFragment().apply {
                arguments = Bundle().apply {
                    putString(ARG_SCREEN, screen)
                }
            }
        }

        /**
         * Create a new carousel fragment.
         */
        @JvmStatic
        fun newCarouselInstance(carouselId: String): OpencomFragment {
            return OpencomFragment().apply {
                arguments = Bundle().apply {
                    putString(ARG_SCREEN, SCREEN_CAROUSEL)
                    putString(ARG_CAROUSEL_ID, carouselId)
                }
            }
        }
    }
}
