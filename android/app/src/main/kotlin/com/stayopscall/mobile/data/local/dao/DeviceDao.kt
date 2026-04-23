package com.stayopscall.mobile.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.stayopscall.mobile.data.local.entity.DeviceRegistrationEntity

@Dao
interface DeviceDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(device: DeviceRegistrationEntity)

    @Query("SELECT * FROM device_registration LIMIT 1")
    suspend fun get(): DeviceRegistrationEntity?
}
