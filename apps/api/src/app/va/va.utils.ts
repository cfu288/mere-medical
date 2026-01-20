export function buildVARedirectUrl(
  webAppUrl: string,
  code: string,
  state: string | undefined,
): string {
  const url = new URL('/va/callback', webAppUrl);
  url.searchParams.set('code', code);
  if (state) {
    url.searchParams.set('state', state);
  }
  return url.toString();
}
