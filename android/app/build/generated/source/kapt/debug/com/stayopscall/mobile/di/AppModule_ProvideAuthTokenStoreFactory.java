package com.stayopscall.mobile.di;

import android.content.Context;
import com.stayopscall.mobile.core.auth.AuthTokenStore;
import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.Preconditions;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import javax.annotation.processing.Generated;
import javax.inject.Provider;

@ScopeMetadata("javax.inject.Singleton")
@QualifierMetadata("dagger.hilt.android.qualifiers.ApplicationContext")
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
public final class AppModule_ProvideAuthTokenStoreFactory implements Factory<AuthTokenStore> {
  private final Provider<Context> contextProvider;

  public AppModule_ProvideAuthTokenStoreFactory(Provider<Context> contextProvider) {
    this.contextProvider = contextProvider;
  }

  @Override
  public AuthTokenStore get() {
    return provideAuthTokenStore(contextProvider.get());
  }

  public static AppModule_ProvideAuthTokenStoreFactory create(Provider<Context> contextProvider) {
    return new AppModule_ProvideAuthTokenStoreFactory(contextProvider);
  }

  public static AuthTokenStore provideAuthTokenStore(Context context) {
    return Preconditions.checkNotNullFromProvides(AppModule.INSTANCE.provideAuthTokenStore(context));
  }
}
