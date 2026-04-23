package com.stayopscall.mobile.data.remote;

import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.POST;
import retrofit2.http.Path;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000V\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\bf\u0018\u00002\u00020\u0001J\u0018\u0010\u0002\u001a\u00020\u00032\b\b\u0001\u0010\u0004\u001a\u00020\u0005H\u00a7@\u00a2\u0006\u0002\u0010\u0006J\u0018\u0010\u0007\u001a\u00020\b2\b\b\u0001\u0010\t\u001a\u00020\nH\u00a7@\u00a2\u0006\u0002\u0010\u000bJ\u0018\u0010\f\u001a\u00020\r2\b\b\u0001\u0010\u0004\u001a\u00020\u000eH\u00a7@\u00a2\u0006\u0002\u0010\u000fJ\u0018\u0010\u0010\u001a\u00020\u00112\b\b\u0001\u0010\u0004\u001a\u00020\u0012H\u00a7@\u00a2\u0006\u0002\u0010\u0013J\u0018\u0010\u0014\u001a\u00020\u00152\b\b\u0001\u0010\u0004\u001a\u00020\u0016H\u00a7@\u00a2\u0006\u0002\u0010\u0017J\u0018\u0010\u0018\u001a\u00020\u00192\b\b\u0001\u0010\u0004\u001a\u00020\u001aH\u00a7@\u00a2\u0006\u0002\u0010\u001b\u00a8\u0006\u001c"}, d2 = {"Lcom/stayopscall/mobile/data/remote/MobileApi;", "", "createCall", "Lcom/stayopscall/mobile/data/remote/CreateCallResponse;", "body", "Lcom/stayopscall/mobile/data/remote/CreateCallRequest;", "(Lcom/stayopscall/mobile/data/remote/CreateCallRequest;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "getCallStatus", "Lcom/stayopscall/mobile/data/remote/CallStatusResponse;", "callId", "", "(Ljava/lang/String;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "login", "Lcom/stayopscall/mobile/data/remote/LoginResponse;", "Lcom/stayopscall/mobile/data/remote/LoginRequest;", "(Lcom/stayopscall/mobile/data/remote/LoginRequest;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "refresh", "Lcom/stayopscall/mobile/data/remote/RefreshTokenResponse;", "Lcom/stayopscall/mobile/data/remote/RefreshTokenRequest;", "(Lcom/stayopscall/mobile/data/remote/RefreshTokenRequest;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "registerDevice", "Lcom/stayopscall/mobile/data/remote/RegisterDeviceResponse;", "Lcom/stayopscall/mobile/data/remote/RegisterDeviceRequest;", "(Lcom/stayopscall/mobile/data/remote/RegisterDeviceRequest;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "requestUploadUrl", "Lcom/stayopscall/mobile/data/remote/UploadUrlResponse;", "Lcom/stayopscall/mobile/data/remote/UploadUrlRequest;", "(Lcom/stayopscall/mobile/data/remote/UploadUrlRequest;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "app_debug"})
public abstract interface MobileApi {
    
    @retrofit2.http.POST(value = "auth/login")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object login(@retrofit2.http.Body()
    @org.jetbrains.annotations.NotNull()
    com.stayopscall.mobile.data.remote.LoginRequest body, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super com.stayopscall.mobile.data.remote.LoginResponse> $completion);
    
    @retrofit2.http.POST(value = "auth/refresh")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object refresh(@retrofit2.http.Body()
    @org.jetbrains.annotations.NotNull()
    com.stayopscall.mobile.data.remote.RefreshTokenRequest body, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super com.stayopscall.mobile.data.remote.RefreshTokenResponse> $completion);
    
    @retrofit2.http.POST(value = "devices/register")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object registerDevice(@retrofit2.http.Body()
    @org.jetbrains.annotations.NotNull()
    com.stayopscall.mobile.data.remote.RegisterDeviceRequest body, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super com.stayopscall.mobile.data.remote.RegisterDeviceResponse> $completion);
    
    @retrofit2.http.POST(value = "calls/upload-url")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object requestUploadUrl(@retrofit2.http.Body()
    @org.jetbrains.annotations.NotNull()
    com.stayopscall.mobile.data.remote.UploadUrlRequest body, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super com.stayopscall.mobile.data.remote.UploadUrlResponse> $completion);
    
    @retrofit2.http.POST(value = "calls")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object createCall(@retrofit2.http.Body()
    @org.jetbrains.annotations.NotNull()
    com.stayopscall.mobile.data.remote.CreateCallRequest body, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super com.stayopscall.mobile.data.remote.CreateCallResponse> $completion);
    
    @retrofit2.http.GET(value = "calls/{callId}/status")
    @org.jetbrains.annotations.Nullable()
    public abstract java.lang.Object getCallStatus(@retrofit2.http.Path(value = "callId")
    @org.jetbrains.annotations.NotNull()
    java.lang.String callId, @org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super com.stayopscall.mobile.data.remote.CallStatusResponse> $completion);
}