package com.stayopscall.mobile.work;

import android.content.Context;
import android.net.Uri;
import android.util.Log;
import androidx.room.Room;
import androidx.work.CoroutineWorker;
import androidx.work.WorkerParameters;
import com.stayopscall.mobile.BuildConfig;
import com.stayopscall.mobile.core.device.DeviceIdentityProvider;
import com.stayopscall.mobile.core.storage.WorkerDebugStore;
import com.stayopscall.mobile.data.local.RecordingStatus;
import com.stayopscall.mobile.data.local.AppDatabase;
import com.stayopscall.mobile.data.local.dao.CallRecordingDao;
import com.stayopscall.mobile.data.remote.UploadAgentApi;
import com.stayopscall.mobile.data.remote.UploadCallErrorResponse;
import com.squareup.moshi.Moshi;
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory;
import okhttp3.MultipartBody;
import okhttp3.OkHttpClient;
import okhttp3.RequestBody;
import okhttp3.logging.HttpLoggingInterceptor;
import okio.BufferedSink;
import retrofit2.Retrofit;
import retrofit2.converter.moshi.MoshiConverterFactory;

/**
 * Upload worker instantiated by WorkManager directly (no Hilt).
 *
 * NOTE: This uses a small service-locator for its dependencies to avoid WorkerFactory injection issues.
 */
@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000J\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\b\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u000b\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0004\b\u0007\u0018\u0000 \u00192\u00020\u0001:\u0002\u0019\u001aB\u0015\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\u0006\u0010\u0004\u001a\u00020\u0005\u00a2\u0006\u0002\u0010\u0006J\u000e\u0010\n\u001a\u00020\u000bH\u0096@\u00a2\u0006\u0002\u0010\fJ(\u0010\r\u001a\u00020\u000e2\u0006\u0010\u000f\u001a\u00020\u00102\u0006\u0010\u0011\u001a\u00020\u00122\b\u0010\u0013\u001a\u0004\u0018\u00010\u0014H\u0082@\u00a2\u0006\u0002\u0010\u0015J\u0014\u0010\u0016\u001a\u0004\u0018\u00010\u00172\b\u0010\u0018\u001a\u0004\u0018\u00010\u0014H\u0002R\u000e\u0010\u0007\u001a\u00020\bX\u0082D\u00a2\u0006\u0002\n\u0000R\u000e\u0010\t\u001a\u00020\bX\u0082D\u00a2\u0006\u0002\n\u0000\u00a8\u0006\u001b"}, d2 = {"Lcom/stayopscall/mobile/work/UploadQueueWorker;", "Landroidx/work/CoroutineWorker;", "appContext", "Landroid/content/Context;", "workerParams", "Landroidx/work/WorkerParameters;", "(Landroid/content/Context;Landroidx/work/WorkerParameters;)V", "maxRetryCount", "", "testProcessLimit", "doWork", "Landroidx/work/ListenableWorker$Result;", "(Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "markFailedWithRetryPolicy", "", "callRecordingDao", "Lcom/stayopscall/mobile/data/local/dao/CallRecordingDao;", "item", "Lcom/stayopscall/mobile/data/local/entity/CallRecordingEntity;", "error", "", "(Lcom/stayopscall/mobile/data/local/dao/CallRecordingDao;Lcom/stayopscall/mobile/data/local/entity/CallRecordingEntity;Ljava/lang/String;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "parseUploadError", "Lcom/stayopscall/mobile/data/remote/UploadCallErrorResponse;", "raw", "Companion", "UploadWorkerDeps", "app_debug"})
public final class UploadQueueWorker extends androidx.work.CoroutineWorker {
    private final int maxRetryCount = 3;
    private final int testProcessLimit = 10;
    @org.jetbrains.annotations.NotNull()
    private static final kotlinx.coroutines.sync.Mutex uploadMutex = null;
    @org.jetbrains.annotations.NotNull()
    public static final com.stayopscall.mobile.work.UploadQueueWorker.Companion Companion = null;
    
    public UploadQueueWorker(@org.jetbrains.annotations.NotNull()
    android.content.Context appContext, @org.jetbrains.annotations.NotNull()
    androidx.work.WorkerParameters workerParams) {
        super(null, null);
    }
    
    @java.lang.Override()
    @org.jetbrains.annotations.Nullable()
    public java.lang.Object doWork(@org.jetbrains.annotations.NotNull()
    kotlin.coroutines.Continuation<? super androidx.work.ListenableWorker.Result> $completion) {
        return null;
    }
    
    private final java.lang.Object markFailedWithRetryPolicy(com.stayopscall.mobile.data.local.dao.CallRecordingDao callRecordingDao, com.stayopscall.mobile.data.local.entity.CallRecordingEntity item, java.lang.String error, kotlin.coroutines.Continuation<? super java.lang.Boolean> $completion) {
        return null;
    }
    
    private final com.stayopscall.mobile.data.remote.UploadCallErrorResponse parseUploadError(java.lang.String raw) {
        return null;
    }
    
    @kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000\u0012\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\b\u0086\u0003\u0018\u00002\u00020\u0001B\u0007\b\u0002\u00a2\u0006\u0002\u0010\u0002R\u000e\u0010\u0003\u001a\u00020\u0004X\u0082\u0004\u00a2\u0006\u0002\n\u0000\u00a8\u0006\u0005"}, d2 = {"Lcom/stayopscall/mobile/work/UploadQueueWorker$Companion;", "", "()V", "uploadMutex", "Lkotlinx/coroutines/sync/Mutex;", "app_debug"})
    public static final class Companion {
        
        private Companion() {
            super();
        }
    }
    
    @kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000\u001c\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\b\u00c2\u0002\u0018\u00002\u00020\u0001:\u0001\bB\u0007\b\u0002\u00a2\u0006\u0002\u0010\u0002J\u000e\u0010\u0005\u001a\u00020\u00042\u0006\u0010\u0006\u001a\u00020\u0007R\u0010\u0010\u0003\u001a\u0004\u0018\u00010\u0004X\u0082\u000e\u00a2\u0006\u0002\n\u0000\u00a8\u0006\t"}, d2 = {"Lcom/stayopscall/mobile/work/UploadQueueWorker$UploadWorkerDeps;", "", "()V", "instance", "Lcom/stayopscall/mobile/work/UploadQueueWorker$UploadWorkerDeps$Deps;", "get", "context", "Landroid/content/Context;", "Deps", "app_debug"})
    static final class UploadWorkerDeps {
        @kotlin.jvm.Volatile()
        @org.jetbrains.annotations.Nullable()
        private static volatile com.stayopscall.mobile.work.UploadQueueWorker.UploadWorkerDeps.Deps instance;
        @org.jetbrains.annotations.NotNull()
        public static final com.stayopscall.mobile.work.UploadQueueWorker.UploadWorkerDeps INSTANCE = null;
        
        private UploadWorkerDeps() {
            super();
        }
        
        @org.jetbrains.annotations.NotNull()
        public final com.stayopscall.mobile.work.UploadQueueWorker.UploadWorkerDeps.Deps get(@org.jetbrains.annotations.NotNull()
        android.content.Context context) {
            return null;
        }
        
        @kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000>\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0012\n\u0002\u0010\u000b\n\u0002\b\u0002\n\u0002\u0010\b\n\u0000\n\u0002\u0010\u000e\n\u0000\b\u0087\b\u0018\u00002\u00020\u0001B-\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\u0006\u0010\u0004\u001a\u00020\u0005\u0012\u0006\u0010\u0006\u001a\u00020\u0007\u0012\u0006\u0010\b\u001a\u00020\t\u0012\u0006\u0010\n\u001a\u00020\u000b\u00a2\u0006\u0002\u0010\fJ\t\u0010\u0017\u001a\u00020\u0003H\u00c6\u0003J\t\u0010\u0018\u001a\u00020\u0005H\u00c6\u0003J\t\u0010\u0019\u001a\u00020\u0007H\u00c6\u0003J\t\u0010\u001a\u001a\u00020\tH\u00c6\u0003J\t\u0010\u001b\u001a\u00020\u000bH\u00c6\u0003J;\u0010\u001c\u001a\u00020\u00002\b\b\u0002\u0010\u0002\u001a\u00020\u00032\b\b\u0002\u0010\u0004\u001a\u00020\u00052\b\b\u0002\u0010\u0006\u001a\u00020\u00072\b\b\u0002\u0010\b\u001a\u00020\t2\b\b\u0002\u0010\n\u001a\u00020\u000bH\u00c6\u0001J\u0013\u0010\u001d\u001a\u00020\u001e2\b\u0010\u001f\u001a\u0004\u0018\u00010\u0001H\u00d6\u0003J\t\u0010 \u001a\u00020!H\u00d6\u0001J\t\u0010\"\u001a\u00020#H\u00d6\u0001R\u0011\u0010\u0004\u001a\u00020\u0005\u00a2\u0006\b\n\u0000\u001a\u0004\b\r\u0010\u000eR\u0011\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\b\n\u0000\u001a\u0004\b\u000f\u0010\u0010R\u0011\u0010\n\u001a\u00020\u000b\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0011\u0010\u0012R\u0011\u0010\u0006\u001a\u00020\u0007\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0013\u0010\u0014R\u0011\u0010\b\u001a\u00020\t\u00a2\u0006\b\n\u0000\u001a\u0004\b\u0015\u0010\u0016\u00a8\u0006$"}, d2 = {"Lcom/stayopscall/mobile/work/UploadQueueWorker$UploadWorkerDeps$Deps;", "", "db", "Lcom/stayopscall/mobile/data/local/AppDatabase;", "callRecordingDao", "Lcom/stayopscall/mobile/data/local/dao/CallRecordingDao;", "moshi", "Lcom/squareup/moshi/Moshi;", "uploadAgentApi", "Lcom/stayopscall/mobile/data/remote/UploadAgentApi;", "deviceIdentityProvider", "Lcom/stayopscall/mobile/core/device/DeviceIdentityProvider;", "(Lcom/stayopscall/mobile/data/local/AppDatabase;Lcom/stayopscall/mobile/data/local/dao/CallRecordingDao;Lcom/squareup/moshi/Moshi;Lcom/stayopscall/mobile/data/remote/UploadAgentApi;Lcom/stayopscall/mobile/core/device/DeviceIdentityProvider;)V", "getCallRecordingDao", "()Lcom/stayopscall/mobile/data/local/dao/CallRecordingDao;", "getDb", "()Lcom/stayopscall/mobile/data/local/AppDatabase;", "getDeviceIdentityProvider", "()Lcom/stayopscall/mobile/core/device/DeviceIdentityProvider;", "getMoshi", "()Lcom/squareup/moshi/Moshi;", "getUploadAgentApi", "()Lcom/stayopscall/mobile/data/remote/UploadAgentApi;", "component1", "component2", "component3", "component4", "component5", "copy", "equals", "", "other", "hashCode", "", "toString", "", "app_debug"})
        public static final class Deps {
            @org.jetbrains.annotations.NotNull()
            private final com.stayopscall.mobile.data.local.AppDatabase db = null;
            @org.jetbrains.annotations.NotNull()
            private final com.stayopscall.mobile.data.local.dao.CallRecordingDao callRecordingDao = null;
            @org.jetbrains.annotations.NotNull()
            private final com.squareup.moshi.Moshi moshi = null;
            @org.jetbrains.annotations.NotNull()
            private final com.stayopscall.mobile.data.remote.UploadAgentApi uploadAgentApi = null;
            @org.jetbrains.annotations.NotNull()
            private final com.stayopscall.mobile.core.device.DeviceIdentityProvider deviceIdentityProvider = null;
            
            public Deps(@org.jetbrains.annotations.NotNull()
            com.stayopscall.mobile.data.local.AppDatabase db, @org.jetbrains.annotations.NotNull()
            com.stayopscall.mobile.data.local.dao.CallRecordingDao callRecordingDao, @org.jetbrains.annotations.NotNull()
            com.squareup.moshi.Moshi moshi, @org.jetbrains.annotations.NotNull()
            com.stayopscall.mobile.data.remote.UploadAgentApi uploadAgentApi, @org.jetbrains.annotations.NotNull()
            com.stayopscall.mobile.core.device.DeviceIdentityProvider deviceIdentityProvider) {
                super();
            }
            
            @org.jetbrains.annotations.NotNull()
            public final com.stayopscall.mobile.data.local.AppDatabase getDb() {
                return null;
            }
            
            @org.jetbrains.annotations.NotNull()
            public final com.stayopscall.mobile.data.local.dao.CallRecordingDao getCallRecordingDao() {
                return null;
            }
            
            @org.jetbrains.annotations.NotNull()
            public final com.squareup.moshi.Moshi getMoshi() {
                return null;
            }
            
            @org.jetbrains.annotations.NotNull()
            public final com.stayopscall.mobile.data.remote.UploadAgentApi getUploadAgentApi() {
                return null;
            }
            
            @org.jetbrains.annotations.NotNull()
            public final com.stayopscall.mobile.core.device.DeviceIdentityProvider getDeviceIdentityProvider() {
                return null;
            }
            
            @org.jetbrains.annotations.NotNull()
            public final com.stayopscall.mobile.data.local.AppDatabase component1() {
                return null;
            }
            
            @org.jetbrains.annotations.NotNull()
            public final com.stayopscall.mobile.data.local.dao.CallRecordingDao component2() {
                return null;
            }
            
            @org.jetbrains.annotations.NotNull()
            public final com.squareup.moshi.Moshi component3() {
                return null;
            }
            
            @org.jetbrains.annotations.NotNull()
            public final com.stayopscall.mobile.data.remote.UploadAgentApi component4() {
                return null;
            }
            
            @org.jetbrains.annotations.NotNull()
            public final com.stayopscall.mobile.core.device.DeviceIdentityProvider component5() {
                return null;
            }
            
            @org.jetbrains.annotations.NotNull()
            public final com.stayopscall.mobile.work.UploadQueueWorker.UploadWorkerDeps.Deps copy(@org.jetbrains.annotations.NotNull()
            com.stayopscall.mobile.data.local.AppDatabase db, @org.jetbrains.annotations.NotNull()
            com.stayopscall.mobile.data.local.dao.CallRecordingDao callRecordingDao, @org.jetbrains.annotations.NotNull()
            com.squareup.moshi.Moshi moshi, @org.jetbrains.annotations.NotNull()
            com.stayopscall.mobile.data.remote.UploadAgentApi uploadAgentApi, @org.jetbrains.annotations.NotNull()
            com.stayopscall.mobile.core.device.DeviceIdentityProvider deviceIdentityProvider) {
                return null;
            }
            
            @java.lang.Override()
            public boolean equals(@org.jetbrains.annotations.Nullable()
            java.lang.Object other) {
                return false;
            }
            
            @java.lang.Override()
            public int hashCode() {
                return 0;
            }
            
            @java.lang.Override()
            @org.jetbrains.annotations.NotNull()
            public java.lang.String toString() {
                return null;
            }
        }
    }
}