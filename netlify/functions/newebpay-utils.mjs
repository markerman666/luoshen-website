import crypto from 'node:crypto';

export const SITE_URL = 'https://luoshen.netlify.app';

export function config(){
  const merchantId = process.env.NEWEBPAY_MERCHANT_ID;
  const hashKey = process.env.NEWEBPAY_HASH_KEY;
  const hashIv = process.env.NEWEBPAY_HASH_IV;
  const environment = (process.env.NEWEBPAY_ENV || 'production').toLowerCase();
  if(!merchantId || !hashKey || !hashIv) throw new Error('藍新環境變數尚未完整設定');
  if(Buffer.byteLength(hashKey) !== 32 || Buffer.byteLength(hashIv) !== 16){
    throw new Error('藍新 HashKey 或 HashIV 長度不正確');
  }
  return {
    merchantId,
    hashKey,
    hashIv,
    gateway: environment === 'production'
      ? 'https://core.newebpay.com/MPG/mpg_gateway'
      : 'https://ccore.newebpay.com/MPG/mpg_gateway'
  };
}

export function encryptTradeInfo(plainText, hashKey, hashIv){
  const cipher = crypto.createCipheriv('aes-256-cbc', hashKey, hashIv);
  return Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]).toString('hex');
}

export function decryptTradeInfo(encrypted, hashKey, hashIv){
  const decipher = crypto.createDecipheriv('aes-256-cbc', hashKey, hashIv);
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'hex')),
    decipher.final()
  ]).toString('utf8');
}

export function tradeSha(tradeInfo, hashKey, hashIv){
  return crypto.createHash('sha256')
    .update(`HashKey=${hashKey}&${tradeInfo}&HashIV=${hashIv}`)
    .digest('hex')
    .toUpperCase();
}

export function encodeParams(params){
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}

export function parseBody(event){
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : (event.body || '');
  const contentType = event.headers?.['content-type'] || event.headers?.['Content-Type'] || '';
  if(contentType.includes('application/json')) return JSON.parse(raw || '{}');
  return Object.fromEntries(new URLSearchParams(raw));
}

export function safeJson(value){
  try { return JSON.parse(value); } catch { return null; }
}

