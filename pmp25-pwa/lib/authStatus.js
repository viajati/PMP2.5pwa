const VERIFIED_PROVIDER_IDS = new Set(["google.com"]);

export function userProviderIds(user) {
  return user?.providerData?.map((provider) => provider.providerId) || [];
}

export function isAppVerifiedUser(user) {
  if (!user) return false;
  if (user.emailVerified) return true;

  return userProviderIds(user).some((providerId) =>
    VERIFIED_PROVIDER_IDS.has(providerId)
  );
}
