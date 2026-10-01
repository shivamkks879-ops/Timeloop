// Web stub for ad bootstrap — never initialises the native SDK on web.
export function areAdsReady(): boolean { return false; }
export async function startAds(): Promise<boolean> { return false; }
export async function showPrivacyOptions(): Promise<void> {}
