package com.stayopscall.mobile.work;

import androidx.hilt.work.WorkerAssistedFactory;
import androidx.work.ListenableWorker;
import dagger.Binds;
import dagger.Module;
import dagger.hilt.InstallIn;
import dagger.hilt.codegen.OriginatingElement;
import dagger.hilt.components.SingletonComponent;
import dagger.multibindings.IntoMap;
import dagger.multibindings.StringKey;
import javax.annotation.processing.Generated;

@Generated("androidx.hilt.AndroidXHiltProcessor")
@Module
@InstallIn(SingletonComponent.class)
@OriginatingElement(
    topLevelClass = StatusSyncWorker.class
)
public interface StatusSyncWorker_HiltModule {
  @Binds
  @IntoMap
  @StringKey("com.stayopscall.mobile.work.StatusSyncWorker")
  WorkerAssistedFactory<? extends ListenableWorker> bind(StatusSyncWorker_AssistedFactory factory);
}
