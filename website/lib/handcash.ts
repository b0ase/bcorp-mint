import { HandCashConnect } from '@handcash/handcash-connect';

const appId = process.env.HANDCASH_APP_ID || '';
const appSecret = process.env.HANDCASH_APP_SECRET || '';

export const handCashConnect = appId && appSecret
  ? new HandCashConnect({ appId, appSecret })
  : null;
