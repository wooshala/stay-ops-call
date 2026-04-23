package com.stayopscall.mobile.di;

import com.squareup.moshi.Moshi;
import com.stayopscall.mobile.data.remote.UploadAgentApi;
import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.Preconditions;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import javax.annotation.processing.Generated;
import javax.inject.Provider;
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
public final class AppModule_ProvideUploadAgentApiFactory implements Factory<UploadAgentApi> {
  private final Provider<OkHttpClient> uploadClientProvider;

  private final Provider<Moshi> moshiProvider;

  public AppModule_ProvideUploadAgentApiFactory(Provider<OkHttpClient> uploadClientProvider,
      Provider<Moshi> moshiProvider) {
    this.uploadClientProvider = uploadClientProvider;
    this.moshiProvider = moshiProvider;
  }

  @Override
  public UploadAgentApi get() {
    return provideUploadAgentApi(uploadClientProvider.get(), moshiProvider.get());
  }

  public static AppModule_ProvideUploadAgentApiFactory create(
      Provider<OkHttpClient> uploadClientProvider, Provider<Moshi> moshiProvider) {
    return new AppModule_ProvideUploadAgentApiFactory(uploadClientProvider, moshiProvider);
  }

  public static UploadAgentApi provideUploadAgentApi(OkHttpClient uploadClient, Moshi moshi) {
    return Preconditions.checkNotNullFromProvides(AppModule.INSTANCE.provideUploadAgentApi(uploadClient, moshi));
  }
}
