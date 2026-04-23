package com.stayopscall.mobile.work;

import android.content.Context;
import androidx.work.WorkerParameters;
import dagger.internal.DaggerGenerated;
import dagger.internal.InstanceFactory;
import javax.annotation.processing.Generated;
import javax.inject.Provider;

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
public final class StatusSyncWorker_AssistedFactory_Impl implements StatusSyncWorker_AssistedFactory {
  private final StatusSyncWorker_Factory delegateFactory;

  StatusSyncWorker_AssistedFactory_Impl(StatusSyncWorker_Factory delegateFactory) {
    this.delegateFactory = delegateFactory;
  }

  @Override
  public StatusSyncWorker create(Context arg0, WorkerParameters arg1) {
    return delegateFactory.get(arg0, arg1);
  }

  public static Provider<StatusSyncWorker_AssistedFactory> create(
      StatusSyncWorker_Factory delegateFactory) {
    return InstanceFactory.create(new StatusSyncWorker_AssistedFactory_Impl(delegateFactory));
  }

  public static dagger.internal.Provider<StatusSyncWorker_AssistedFactory> createFactoryProvider(
      StatusSyncWorker_Factory delegateFactory) {
    return InstanceFactory.create(new StatusSyncWorker_AssistedFactory_Impl(delegateFactory));
  }
}
