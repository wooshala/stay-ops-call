package com.stayopscall.mobile.di;

import android.content.Context;
import androidx.room.Room;
import com.stayopscall.mobile.BuildConfig;
import com.stayopscall.mobile.core.auth.AuthTokenStore;
import com.stayopscall.mobile.data.local.AppDatabase;
import com.stayopscall.mobile.data.local.dao.AppSettingDao;
import com.stayopscall.mobile.data.local.dao.CallRecordingDao;
import com.stayopscall.mobile.data.local.dao.DeviceDao;
import com.stayopscall.mobile.data.remote.MobileApi;
import com.stayopscall.mobile.data.remote.UploadAgentApi;
import com.stayopscall.mobile.core.device.DeviceIdentityProvider;
import com.squareup.moshi.Moshi;
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory;
import dagger.Module;
import dagger.Provides;
import dagger.hilt.InstallIn;
import dagger.hilt.android.qualifiers.ApplicationContext;
import dagger.hilt.components.SingletonComponent;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Retrofit;
import retrofit2.converter.moshi.MoshiConverterFactory;
import javax.inject.Named;
import javax.inject.Singleton;

@dagger.Module()
@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000b\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u000e\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0004\n\u0002\u0018\u0002\n\u0002\b\u0003\b\u00c7\u0002\u0018\u00002\u00020\u0001B\u0007\b\u0002\u00a2\u0006\u0002\u0010\u0002J\u001a\u0010\u0003\u001a\u00020\u00042\u0006\u0010\u0005\u001a\u00020\u00042\b\u0010\u0006\u001a\u0004\u0018\u00010\u0007H\u0002J\u0010\u0010\b\u001a\u00020\t2\u0006\u0010\n\u001a\u00020\u000bH\u0007J\u0012\u0010\f\u001a\u00020\r2\b\b\u0001\u0010\u000e\u001a\u00020\u000fH\u0007J\u0010\u0010\u0010\u001a\u00020\u00112\u0006\u0010\n\u001a\u00020\u000bH\u0007J\u0012\u0010\u0012\u001a\u00020\u000b2\b\b\u0001\u0010\u000e\u001a\u00020\u000fH\u0007J\u0010\u0010\u0013\u001a\u00020\u00142\u0006\u0010\n\u001a\u00020\u000bH\u0007J\u0012\u0010\u0015\u001a\u00020\u00162\b\b\u0001\u0010\u000e\u001a\u00020\u000fH\u0007J\u001a\u0010\u0017\u001a\u00020\u00182\b\b\u0001\u0010\u0019\u001a\u00020\u001a2\u0006\u0010\u001b\u001a\u00020\u001cH\u0007J\u0010\u0010\u001d\u001a\u00020\u001a2\u0006\u0010\u001e\u001a\u00020\rH\u0007J\b\u0010\u001f\u001a\u00020\u001cH\u0007J\u001a\u0010 \u001a\u00020!2\b\b\u0001\u0010\"\u001a\u00020\u001a2\u0006\u0010\u001b\u001a\u00020\u001cH\u0007J\b\u0010#\u001a\u00020\u001aH\u0007\u00a8\u0006$"}, d2 = {"Lcom/stayopscall/mobile/di/AppModule;", "", "()V", "addBearerForMobileApi", "Lokhttp3/Request;", "request", "token", "", "provideAppSettingDao", "Lcom/stayopscall/mobile/data/local/dao/AppSettingDao;", "db", "Lcom/stayopscall/mobile/data/local/AppDatabase;", "provideAuthTokenStore", "Lcom/stayopscall/mobile/core/auth/AuthTokenStore;", "context", "Landroid/content/Context;", "provideCallDao", "Lcom/stayopscall/mobile/data/local/dao/CallRecordingDao;", "provideDb", "provideDeviceDao", "Lcom/stayopscall/mobile/data/local/dao/DeviceDao;", "provideDeviceIdentityProvider", "Lcom/stayopscall/mobile/core/device/DeviceIdentityProvider;", "provideMobileApi", "Lcom/stayopscall/mobile/data/remote/MobileApi;", "client", "Lokhttp3/OkHttpClient;", "moshi", "Lcom/squareup/moshi/Moshi;", "provideMobileOkHttpClient", "tokenStore", "provideMoshi", "provideUploadAgentApi", "Lcom/stayopscall/mobile/data/remote/UploadAgentApi;", "uploadClient", "provideUploadAgentOkHttpClient", "app_debug"})
@dagger.hilt.InstallIn(value = {dagger.hilt.components.SingletonComponent.class})
public final class AppModule {
    @org.jetbrains.annotations.NotNull()
    public static final com.stayopscall.mobile.di.AppModule INSTANCE = null;
    
    private AppModule() {
        super();
    }
    
    @dagger.Provides()
    @javax.inject.Singleton()
    @org.jetbrains.annotations.NotNull()
    public final com.squareup.moshi.Moshi provideMoshi() {
        return null;
    }
    
    @dagger.Provides()
    @javax.inject.Singleton()
    @org.jetbrains.annotations.NotNull()
    public final com.stayopscall.mobile.data.local.AppDatabase provideDb(@dagger.hilt.android.qualifiers.ApplicationContext()
    @org.jetbrains.annotations.NotNull()
    android.content.Context context) {
        return null;
    }
    
    @dagger.Provides()
    @org.jetbrains.annotations.NotNull()
    public final com.stayopscall.mobile.data.local.dao.CallRecordingDao provideCallDao(@org.jetbrains.annotations.NotNull()
    com.stayopscall.mobile.data.local.AppDatabase db) {
        return null;
    }
    
    @dagger.Provides()
    @org.jetbrains.annotations.NotNull()
    public final com.stayopscall.mobile.data.local.dao.DeviceDao provideDeviceDao(@org.jetbrains.annotations.NotNull()
    com.stayopscall.mobile.data.local.AppDatabase db) {
        return null;
    }
    
    @dagger.Provides()
    @org.jetbrains.annotations.NotNull()
    public final com.stayopscall.mobile.data.local.dao.AppSettingDao provideAppSettingDao(@org.jetbrains.annotations.NotNull()
    com.stayopscall.mobile.data.local.AppDatabase db) {
        return null;
    }
    
    @dagger.Provides()
    @javax.inject.Singleton()
    @org.jetbrains.annotations.NotNull()
    public final com.stayopscall.mobile.core.auth.AuthTokenStore provideAuthTokenStore(@dagger.hilt.android.qualifiers.ApplicationContext()
    @org.jetbrains.annotations.NotNull()
    android.content.Context context) {
        return null;
    }
    
    @dagger.Provides()
    @javax.inject.Singleton()
    @org.jetbrains.annotations.NotNull()
    public final com.stayopscall.mobile.core.device.DeviceIdentityProvider provideDeviceIdentityProvider(@dagger.hilt.android.qualifiers.ApplicationContext()
    @org.jetbrains.annotations.NotNull()
    android.content.Context context) {
        return null;
    }
    
    @dagger.Provides()
    @javax.inject.Singleton()
    @javax.inject.Named(value = "mobile")
    @org.jetbrains.annotations.NotNull()
    public final okhttp3.OkHttpClient provideMobileOkHttpClient(@org.jetbrains.annotations.NotNull()
    com.stayopscall.mobile.core.auth.AuthTokenStore tokenStore) {
        return null;
    }
    
    @dagger.Provides()
    @javax.inject.Singleton()
    @javax.inject.Named(value = "upload")
    @org.jetbrains.annotations.NotNull()
    public final okhttp3.OkHttpClient provideUploadAgentOkHttpClient() {
        return null;
    }
    
    @dagger.Provides()
    @javax.inject.Singleton()
    @org.jetbrains.annotations.NotNull()
    public final com.stayopscall.mobile.data.remote.MobileApi provideMobileApi(@javax.inject.Named(value = "mobile")
    @org.jetbrains.annotations.NotNull()
    okhttp3.OkHttpClient client, @org.jetbrains.annotations.NotNull()
    com.squareup.moshi.Moshi moshi) {
        return null;
    }
    
    @dagger.Provides()
    @javax.inject.Singleton()
    @org.jetbrains.annotations.NotNull()
    public final com.stayopscall.mobile.data.remote.UploadAgentApi provideUploadAgentApi(@javax.inject.Named(value = "upload")
    @org.jetbrains.annotations.NotNull()
    okhttp3.OkHttpClient uploadClient, @org.jetbrains.annotations.NotNull()
    com.squareup.moshi.Moshi moshi) {
        return null;
    }
    
    private final okhttp3.Request addBearerForMobileApi(okhttp3.Request request, java.lang.String token) {
        return null;
    }
}