package dev.kiste.gymtracker

import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Data bridge web app -> home-screen widgets (src/native/widgetBridge.ts).
 * update({ payload: string | null }): stores the JSON and redraws every "last workout" widget.
 * Further widgets can read the same store or get their own key.
 */
@CapacitorPlugin(name = "WidgetBridge")
class WidgetBridgePlugin : Plugin() {
    @PluginMethod
    fun update(call: PluginCall) {
        val payload = if (call.data.isNull("payload")) null else call.getString("payload")
        LastWorkoutWidget.store(context, payload)
        LastWorkoutWidget.refreshAll(context)
        call.resolve()
    }
}
