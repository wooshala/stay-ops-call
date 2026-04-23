package com.stayopscall.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.stayopscall.mobile.data.local.entity.AppSettingEntity

@Dao
interface AppSettingDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(setting: AppSettingEntity)

    @Query("SELECT * FROM app_settings WHERE `key` = :key LIMIT 1")
    suspend fun findByKey(key: String): AppSettingEntity?
}
