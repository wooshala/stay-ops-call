package com.stayopscall.mobile.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "device_registration")
data class DeviceRegistrationEntity(
    @PrimaryKey val deviceUuid: String,
    val androidId: String?,
    val model: String,
    val osVersion: String,
    val registeredAt: Long? = null,
    val accessToken: String? = null,
    val refreshToken: String? = null
)
