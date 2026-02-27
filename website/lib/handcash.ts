import { HandCashConnect } from '@handcash/handcash-connect';

const appId = process.env.HANDCASH_APP_ID;
const appSecret = process.env.HANDCASH_APP_SECRET;

const isDemoMode = !appId || !appSecret;

if (isDemoMode) {
    console.log('[HandCash] Running in DEMO MODE (no credentials configured)');
}

export const handCashConnect = isDemoMode
    ? null
    : new HandCashConnect({
        appId: appId!,
        appSecret: appSecret!,
    });

/**
 * Returns the "House" account instance using the HOUSE_AUTH_TOKEN.
 * Used for platform operations, minting, and payouts.
 */
export function getHouseAccount() {
    if (!handCashConnect) {
        console.warn('[HandCash] DEMO MODE - no real account available');
        return null;
    }
    const houseAuthToken = process.env.HOUSE_AUTH_TOKEN;
    if (!houseAuthToken) {
        console.warn('[HandCash] HOUSE_AUTH_TOKEN is not configured');
        return null;
    }
    return handCashConnect.getAccountFromAuthToken(houseAuthToken);
}

/**
 * Returns a user's account instance given their auth token.
 */
export function getUserAccount(authToken: string) {
    if (!handCashConnect) return null;
    return handCashConnect.getAccountFromAuthToken(authToken);
}
