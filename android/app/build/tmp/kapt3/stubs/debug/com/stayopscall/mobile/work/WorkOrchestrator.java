package com.stayopscall.mobile.work;

import android.content.Context;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.WorkManager;
import java.util.concurrent.TimeUnit;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000\u001a\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u0002\n\u0002\b\u0002\b\u0007\u0018\u00002\u00020\u0001B\r\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\u0002\u0010\u0004J\u0006\u0010\u0005\u001a\u00020\u0006J\u0006\u0010\u0007\u001a\u00020\u0006R\u000e\u0010\u0002\u001a\u00020\u0003X\u0082\u0004\u00a2\u0006\u0002\n\u0000\u00a8\u0006\b"}, d2 = {"Lcom/stayopscall/mobile/work/WorkOrchestrator;", "", "context", "Landroid/content/Context;", "(Landroid/content/Context;)V", "enqueueScanUploadSyncChain", "", "schedulePeriodicSync", "app_debug"})
public final class WorkOrchestrator {
    @org.jetbrains.annotations.NotNull()
    private final android.content.Context context = null;
    
    public WorkOrchestrator(@org.jetbrains.annotations.NotNull()
    android.content.Context context) {
        super();
    }
    
    public final void enqueueScanUploadSyncChain() {
    }
    
    public final void schedulePeriodicSync() {
    }
}