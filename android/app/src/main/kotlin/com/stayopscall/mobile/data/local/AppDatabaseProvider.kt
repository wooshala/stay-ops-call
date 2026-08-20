package com.stayopscall.mobile.data.local

import android.content.Context
import androidx.room.Room

/**
 * Single Room instance for Hilt + WorkManager DbHolders.
 * Duplicate builders on the same file cause migration / connection races.
 */
object AppDatabaseProvider {
    @Volatile
    private var instance: AppDatabase? = null

    fun get(context: Context): AppDatabase {
        instance?.let { return it }
        return synchronized(this) {
            instance ?: Room.databaseBuilder(
                context.applicationContext,
                AppDatabase::class.java,
                "stay_ops_call.db",
            )
                .addMigrations(*AppDatabase.ALL_MIGRATIONS)
                .build()
                .also { instance = it }
        }
    }
}
