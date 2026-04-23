package com.stayopscall.mobile.data.remote

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface MobileApi {
    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): LoginResponse
    @POST("auth/refresh")
    suspend fun refresh(@Body body: RefreshTokenRequest): RefreshTokenResponse

    @POST("devices/register")
    suspend fun registerDevice(@Body body: RegisterDeviceRequest): RegisterDeviceResponse

    @POST("calls/upload-url")
    suspend fun requestUploadUrl(@Body body: UploadUrlRequest): UploadUrlResponse

    @POST("calls")
    suspend fun createCall(@Body body: CreateCallRequest): CreateCallResponse

    @GET("calls/{callId}/status")
    suspend fun getCallStatus(@Path("callId") callId: String): CallStatusResponse
}

data class LoginRequest(val shopAccount: String, val password: String)
data class LoginResponse(val accessToken: String, val refreshToken: String?)
data class RefreshTokenRequest(val refreshToken: String)
data class RefreshTokenResponse(val accessToken: String, val refreshToken: String?)

data class RegisterDeviceRequest(
    val deviceUuid: String,
    val androidId: String?,
    val model: String,
    val osVersion: String
)

data class RegisterDeviceResponse(val registered: Boolean, val deviceId: String)
data class UploadUrlRequest(val fileName: String, val contentType: String)
data class UploadUrlResponse(val uploadUrl: String, val objectKey: String)
data class CreateCallRequest(val objectKey: String, val recordedAt: Long)
data class CreateCallResponse(val callId: String, val status: String)
data class CallStatusResponse(val callId: String, val status: String, val reviewNeeded: Boolean)
