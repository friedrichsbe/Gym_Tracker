package dev.kiste.gymtracker

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.text.format.DateUtils
import android.util.SizeF
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.text.NumberFormat
import kotlin.math.roundToLong

/**
 * Home-screen widget "Last workout" (classic AppWidgetProvider + RemoteViews, no Glance/Compose).
 * Data comes from the web app via WidgetBridgePlugin as JSON (see src/native/widgetPayload.ts, v = 1).
 * The relative date is computed here at every redraw; updatePeriodMillis keeps it fresh.
 */
class LastWorkoutWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { manager.updateAppWidget(it, views(context, manager.getAppWidgetOptions(it))) }
    }

    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
        manager.updateAppWidget(id, views(context, options))
    }

    private data class Workout(
        val name: String,
        val endedAt: Long,
        val durationSeconds: Long?,
        val sets: Int,
        val volume: Long?,
        val unit: String?,
    )

    companion object {
        private const val PREFS = "gym_tracker_widgets"
        private const val KEY_LAST_WORKOUT = "last_workout"

        fun store(context: Context, json: String?) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().apply {
                if (json == null) remove(KEY_LAST_WORKOUT) else putString(KEY_LAST_WORKOUT, json)
            }.apply()
        }

        fun refreshAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, LastWorkoutWidget::class.java))
            ids.forEach { manager.updateAppWidget(it, views(context, manager.getAppWidgetOptions(it))) }
        }

        private fun load(context: Context): Workout? {
            val json = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString(KEY_LAST_WORKOUT, null) ?: return null
            return try {
                val o = JSONObject(json)
                if (o.optInt("v") != 1) return null
                Workout(
                    name = o.optString("name", "Workout"),
                    endedAt = o.getLong("endedAt"),
                    durationSeconds = if (o.isNull("durationSeconds")) null else o.optLong("durationSeconds"),
                    sets = o.optInt("sets"),
                    volume = if (o.isNull("volume")) null else o.optLong("volume"),
                    unit = if (o.isNull("unit")) null else o.optString("unit"),
                )
            } catch (e: Exception) {
                null
            }
        }

        /** Android 12+: compact/full variants picked by the launcher per size; older: by the current options. */
        private fun views(context: Context, options: Bundle?): RemoteViews {
            val workout = load(context)
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                RemoteViews(
                    mapOf(
                        SizeF(120f, 40f) to build(context, workout, compact = true),
                        SizeF(120f, 100f) to build(context, workout, compact = false),
                    ),
                )
            } else {
                val minHeight = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT) ?: 110
                build(context, workout, compact = minHeight in 1 until 100)
            }
        }

        private fun build(context: Context, workout: Workout?, compact: Boolean): RemoteViews {
            val v = RemoteViews(context.packageName, R.layout.widget_last_workout)
            v.setOnClickPendingIntent(R.id.widget_root, openApp(context))
            if (workout == null) {
                v.setTextViewText(R.id.widget_date, "")
                v.setTextViewText(R.id.widget_title, context.getString(R.string.widget_empty_title))
                v.setTextViewText(R.id.widget_subtitle, context.getString(R.string.widget_empty_subtitle))
                v.setViewVisibility(R.id.widget_subtitle, if (compact) View.GONE else View.VISIBLE)
                v.setViewVisibility(R.id.widget_stats, View.GONE)
                return v
            }
            val relative = DateUtils.getRelativeTimeSpanString(
                workout.endedAt, System.currentTimeMillis(), DateUtils.DAY_IN_MILLIS,
            )
            v.setTextViewText(R.id.widget_date, relative)
            v.setTextViewText(R.id.widget_title, workout.name)
            v.setViewVisibility(R.id.widget_subtitle, View.GONE)
            v.setViewVisibility(R.id.widget_stats, if (compact) View.GONE else View.VISIBLE)

            val numbers = NumberFormat.getIntegerInstance()
            v.setTextViewText(R.id.widget_sets_value, numbers.format(workout.sets))
            v.setTextViewText(
                R.id.widget_volume_value,
                workout.volume?.let { "${numbers.format(it)} ${workout.unit ?: ""}".trim() } ?: "–",
            )
            v.setTextViewText(R.id.widget_duration_value, workout.durationSeconds?.let { duration(context, it) } ?: "–")
            return v
        }

        private fun duration(context: Context, seconds: Long): String {
            val minutes = (seconds / 60.0).roundToLong()
            return if (minutes < 60) context.getString(R.string.widget_minutes, minutes)
            else context.getString(R.string.widget_hours_minutes, minutes / 60, minutes % 60)
        }

        private fun openApp(context: Context): PendingIntent {
            val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
                ?: Intent(context, MainActivity::class.java)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
            return PendingIntent.getActivity(
                context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }
    }
}
