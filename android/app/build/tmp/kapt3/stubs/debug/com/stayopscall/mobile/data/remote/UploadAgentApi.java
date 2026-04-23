package com.stayopscall.mobile.data.remote;

import okhttp3.MultipartBody;
import okhttp3.RequestBody;
import retrofit2.Response;
import retrofit2.http.Multipart;
import retrofit2.http.POST;
import retrofit2.http.Part;

/**
 * Upload agent API (server): POST /api/calls/upload (multipart)
 *
 * NOTE: This is intentionally separate from MobileApi (api/mobile paths).
 */
@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000\"\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\t\bf\u0018\u00002\u00020\u0001Jx\u0010\u0002\u001a\b\u0012\u0004\u0012\u00020\u00040\u00032\b\b\u0001\u0010\u0005\u001a\u00020\u00062\b\b\u0001\u0010\u0007\u001a\u00020\b2\b\b\u0001\u0010\t\u001a\u00020\b2\b\b\u0001\u0010\n\u001a\u00020\b2\n\b\u0001\u0010\u000b\u001a\u0004\u0018\u00010\b2\n\b\u0001\u0010\f\u001a\u0004\u0018\u00010\b2\n\b\u0001\u0010\r\u001a\u0004\u0018\u00010\b2\n\b\u0001\u0010\u000e\u001a\u0004\u0018\u00010\b2\n\b\u0001\u0010\u000f\u001a\u0004\u0018\u00010\bH\u00a7@\u00a2\u0006\u0002\u0010\u0010\u00a8\u0006\u0011"}, d2 = {"Lcom/stayopscall/mobile/data/remote/UploadAgentApi;", "", "uploadCall", "Lretrofit2/Response;", "Lcom/stayopscall/mobile/data/remote/UploadCallResponse;", "file", "Lokhttp3/MultipartBody$Part;", "sourceType", "Lokhttp3/RequestBody;", "fileFingerprint", "deviceId", "originalFileName", "mimeType", "startedAt", "phoneNumber", "direction", "(Lokhttp3/MultipartBody$Part;Lokhttp3/RequestBody;Lokhttp3/RequestBody;Lokhttp3/RequestBody;Lokhttp3/RequestBody;Lokhttp3/RequestBody;Lokhttp3/RequestBody;Lokhttp3/RequestBody;Lokhttp3/RequestBody;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "app_debug"})
public abstract interface UploadAgentApi {
    
    @retrofit2.http.Multipart()
    @retrofit2.http.POST(value = "/api/calls/upload")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object uploadCall(@retrofit2.http.Part()
    @org.jetbrains.annotations.NotNull()
    okhttp3.MultipartBody.Part file, @retrofit2.http.Part(value = "source_type")
    @org.jetbrains.annotations.NotNull()
    okhttp3.RequestBody sourceType, @retrofit2.http.Part(value = "file_fingerprint")
    @org.jetbrains.annotations.NotNull()
    okhttp3.RequestBody fileFingerprint, @retrofit2.http.Part(value = "device_id")
    @org.jetbrains.annotations.NotNull()
    okhttp3.RequestBody deviceId, @retrofit2.http.Part(value = "original_file_name")
    @org.jetbrains.annotations.Nullable()
    okhttp3.RequestBody originalFileName, @retrofit2.http.Part(value = "mime_type")
    @org.jetbrains.annotations.Nullable()
    okhttp3.RequestBody mimeType, @retrofit2.http.Part(value = "started_at")
    @org.jetbrains.annotations.Nullable()
    okhttp3.RequestBody startedAt, @retrofit2.http.Part(value = "phone_number")
    @org.jetbrains.annotations.Nullable()
    okhttp3.RequestBody phoneNumber, @retrofit2.http.Part(value = "direction")
    @org.jetbrains.annotations.Nullable()
    okhttp3.RequestBody direction, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super retrofit2.Response<com.stayopscall.mobile.data.remote.UploadCallResponse>> $completion);
}