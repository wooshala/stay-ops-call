package com.stayopscall.mobile.di;

import com.squareup.moshi.Moshi;
import com.stayopscall.mobile.data.remote.MobileApi;
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
public final class AppModule_ProvideMobileApiFactory implements Factory<MobileApi> {
  private final Provider<OkHttpClient> clientProvider;

  private final Provider<Moshi> moshiProvider;

  public AppModule_ProvideMobileApiFactory(Provider<OkHttpClient> clientProvider,
      Provider<Moshi> moshiProvider) {
    this.clientProvider = clientProvider;
    this.moshiProvider = moshiProvider;
  }

  @Override
  public MobileApi get() {
    return provideMobileApi(clientProvider.get(), moshiProvider.get());
  }

  public static AppModule_ProvideMobileApiFactory create(Provider<OkHttpClient> clientProvider,
      Provider<Moshi> moshiProvider) {
    return new AppModule_ProvideMobileApiFactory(clientProvider, moshiProvider);
  }

  public static MobileApi provideMobileApi(OkHttpClient client, Moshi moshi) {
    return Preconditions.checkNotNullFromProvides(AppModule.INSTANCE.provideMobileApi(client, moshi));
  }
}
