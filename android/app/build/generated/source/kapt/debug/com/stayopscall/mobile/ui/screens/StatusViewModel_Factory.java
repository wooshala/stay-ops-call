package com.stayopscall.mobile.ui.screens;

import com.stayopscall.mobile.data.local.dao.CallRecordingDao;
import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import javax.annotation.processing.Generated;
import javax.inject.Provider;

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
public final class StatusViewModel_Factory implements Factory<StatusViewModel> {
  private final Provider<CallRecordingDao> callRecordingDaoProvider;

  public StatusViewModel_Factory(Provider<CallRecordingDao> callRecordingDaoProvider) {
    this.callRecordingDaoProvider = callRecordingDaoProvider;
  }

  @Override
  public StatusViewModel get() {
    return newInstance(callRecordingDaoProvider.get());
  }

  public static StatusViewModel_Factory create(
      Provider<CallRecordingDao> callRecordingDaoProvider) {
    return new StatusViewModel_Factory(callRecordingDaoProvider);
  }

  public static StatusViewModel newInstance(CallRecordingDao callRecordingDao) {
    return new StatusViewModel(callRecordingDao);
  }
}
