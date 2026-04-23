package com.stayopscall.mobile.work;

import android.content.Context;
import androidx.work.WorkerParameters;
import dagger.internal.DaggerGenerated;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import javax.annotation.processing.Generated;

@ScopeMetadata
@QualifierMetadata
@DaggerGenerated
@Generated(
    value = "dagger.internal.codegen.ComponentProcessor",
    comments = "https://dagger.dev"
)
@SuppressWarnings({
    "unchecked",
    "rawtypes",
    "KotlinInternal",
    "KotlinInternalInJava",
    "cast",
    "deprecation"
})
public final class StatusSyncWorker_Factory {
  public StatusSyncWorker get(Context appContext, WorkerParameters params) {
    return newInstance(appContext, params);
  }

  public static StatusSyncWorker_Factory create() {
    return InstanceHolder.INSTANCE;
  }

  public static StatusSyncWorker newInstance(Context appContext, WorkerParameters params) {
    return new StatusSyncWorker(appContext, params);
  }

  private static final class InstanceHolder {
    private static final StatusSyncWorker_Factory INSTANCE = new StatusSyncWorker_Factory();
  }
}
