package com.stayopscall.mobile.di;

import com.stayopscall.mobile.data.local.AppDatabase;
import com.stayopscall.mobile.data.local.dao.AppSettingDao;
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
public final class AppModule_ProvideAppSettingDaoFactory implements Factory<AppSettingDao> {
  private final Provider<AppDatabase> dbProvider;

  public AppModule_ProvideAppSettingDaoFactory(Provider<AppDatabase> dbProvider) {
    this.dbProvider = dbProvider;
  }

  @Override
  public AppSettingDao get() {
    return provideAppSettingDao(dbProvider.get());
  }

  public static AppModule_ProvideAppSettingDaoFactory create(Provider<AppDatabase> dbProvider) {
    return new AppModule_ProvideAppSettingDaoFactory(dbProvider);
  }

  public static AppSettingDao provideAppSettingDao(AppDatabase db) {
    return Preconditions.checkNotNullFromProvides(AppModule.INSTANCE.provideAppSettingDao(db));
  }
}
