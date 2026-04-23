package com.stayopscall.mobile.di;

import com.stayopscall.mobile.core.auth.AuthTokenStore;
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
public final class AppModule_ProvideMobileOkHttpClientFactory implements Factory<OkHttpClient> {
  private final Provider<AuthTokenStore> tokenStoreProvider;

  public AppModule_ProvideMobileOkHttpClientFactory(Provider<AuthTokenStore> tokenStoreProvider) {
    this.tokenStoreProvider = tokenStoreProvider;
  }

  @Override
  public OkHttpClient get() {
    return provideMobileOkHttpClient(tokenStoreProvider.get());
  }

  public static AppModule_ProvideMobileOkHttpClientFactory create(
      Provider<AuthTokenStore> tokenStoreProvider) {
    return new AppModule_ProvideMobileOkHttpClientFactory(tokenStoreProvider);
  }

  public static OkHttpClient provideMobileOkHttpClient(AuthTokenStore tokenStore) {
    return Preconditions.checkNotNullFromProvides(AppModule.INSTANCE.provideMobileOkHttpClient(tokenStore));
  }
}
