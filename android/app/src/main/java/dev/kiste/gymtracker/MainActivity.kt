package dev.kiste.gymtracker

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // App-local plugins must be registered before the bridge starts.
        registerPlugin(WidgetBridgePlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
