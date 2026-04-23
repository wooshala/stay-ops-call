package com.stayopscall.mobile.di;

import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.Preconditions;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import javax.annotation.processing.Generated;
import okhttp3.OkHttpClient;

@ScopeMetadata("javax.inject.Singleton")
@QualifierMetadata("javax.inject.Named")
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
public final class AppModule_ProvideUploadAgentOkHttpClientFactory implements Factory<OkHttpClient> {
  @Override
  public OkHttpClient get() {
    return provideUploadAgentOkHttpClient();
  }

  public static AppModule_ProvideUploadAgentOkHttpClientFactory create() {
    return InstanceHolder.INSTANCE;
  }

  public static OkHttpClient provideUploadAgentOkHttpClient() {
    return Preconditions.checkNotNullFromProvides(AppModule.INSTANCE.provideUploadAgentOkHttpClient());
  }

  private static final class InstanceHolder {
    private static final AppModule_ProvideUploadAgentOkHttpClientFactory INSTANCE = new AppModule_ProvideUploadAgentOkHttpClientFactory();
  }
}
