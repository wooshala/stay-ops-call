package com.stayopscall.mobile;

import androidx.hilt.work.HiltWorkerFactory;
import dagger.MembersInjector;
import dagger.internal.DaggerGenerated;
import dagger.internal.InjectedFieldSignature;
import dagger.internal.QualifierMetadata;
import javax.annotation.processing.Generated;
import javax.inject.Provider;

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
public final class StayOpsCallApp_MembersInjector implements MembersInjector<StayOpsCallApp> {
  private final Provider<HiltWorkerFactory> workerFactoryProvider;

  public StayOpsCallApp_MembersInjector(Provider<HiltWorkerFactory> workerFactoryProvider) {
    this.workerFactoryProvider = workerFactoryProvider;
  }

  public static MembersInjector<StayOpsCallApp> create(
      Provider<HiltWorkerFactory> workerFactoryProvider) {
    return new StayOpsCallApp_MembersInjector(workerFactoryProvider);
  }

  @Override
  public void injectMembers(StayOpsCallApp instance) {
    injectWorkerFactory(instance, workerFactoryProvider.get());
  }

  @InjectedFieldSignature("com.stayopscall.mobile.StayOpsCallApp.workerFactory")
  public static void injectWorkerFactory(StayOpsCallApp instance, HiltWorkerFactory workerFactory) {
    instance.workerFactory = workerFactory;
  }
}
