package com.stayopscall.mobile.di;

import com.stayopscall.mobile.data.local.AppDatabase;
import com.stayopscall.mobile.data.local.dao.CallRecordingDao;
import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.Preconditions;
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
public final class AppModule_ProvideCallDaoFactory implements Factory<CallRecordingDao> {
  private final Provider<AppDatabase> dbProvider;

  public AppModule_ProvideCallDaoFactory(Provider<AppDatabase> dbProvider) {
    this.dbProvider = dbProvider;
  }

  @Override
  public CallRecordingDao get() {
    return provideCallDao(dbProvider.get());
  }

  public static AppModule_ProvideCallDaoFactory create(Provider<AppDatabase> dbProvider) {
    return new AppModule_ProvideCallDaoFactory(dbProvider);
  }

  public static CallRecordingDao provideCallDao(AppDatabase db) {
    return Preconditions.checkNotNullFromProvides(AppModule.INSTANCE.provideCallDao(db));
  }
}
