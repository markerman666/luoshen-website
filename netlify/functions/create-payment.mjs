import crypto from 'node:crypto';
import { SITE_URL, config, encodeParams, encryptTradeInfo, tradeSha } from './newebpay-utils.mjs';

const PRINT_PRICE = 200;
const ADDON_PRICE = 100;
const ADDON_SHIPPING = 60;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body)
});

export async function handler(event){
  if(event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try{
    const body = JSON.parse(event.body || '{}');
    const type = body.type === 'addon' ? 'addon' : body.type === 'print' ? 'print' : '';
    const count = Number.parseInt(body.count, 10);
    const method = body.paymentMethod === 'VACC' ? 'VACC' : body.paymentMethod === 'CREDIT' ? 'CREDIT' : '';
    const name = String(body.name || '').trim().slice(0, 40);
    const phone = String(body.phone || '').replace(/[^0-9+()-]/g, '').slice(0, 20);
    const address = String(body.address || '').trim().slice(0, 150);

    if(!type || !Number.isInteger(count) || count < 1 || count > 100 || !method || !name || !phone){
      return json(400, { error: '訂單資料不完整或格式不正確' });
    }
    if(type === 'addon' && !address) return json(400, { error: '加購訂單需要寄送地址' });

    const amount = type === 'print'
      ? count * PRINT_PRICE
      : count * ADDON_PRICE + ADDON_SHIPPING;
    const itemDesc = type === 'print'
      ? `助印大符 ${count}份`
      : `加購大符 ${count}張（含運費）`;
    const now = new Date();
    const stamp = now.toISOString().replace(/\D/g, '').slice(2, 14);
    const merchantOrderNo = `LS${stamp}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const { merchantId, hashKey, hashIv, gateway } = config();

    const tradeParams = {
      MerchantID: merchantId,
      RespondType: 'JSON',
      TimeStamp: Math.floor(Date.now() / 1000),
      Version: '2.0',
      LangType: 'zh-tw',
      MerchantOrderNo: merchantOrderNo,
      Amt: amount,
      ItemDesc: itemDesc,
      ReturnURL: `${SITE_URL}/.netlify/functions/payment-return`,
      NotifyURL: `${SITE_URL}/.netlify/functions/payment-notify`,
      ClientBackURL: SITE_URL,
      EmailModify: 1,
      CREDIT: method === 'CREDIT' ? 1 : 0,
      VACC: method === 'VACC' ? 1 : 0
    };
    const tradeInfo = encryptTradeInfo(encodeParams(tradeParams), hashKey, hashIv);

    return json(200, {
      action: gateway,
      orderNo: merchantOrderNo,
      amount,
      fields: {
        MerchantID: merchantId,
        TradeInfo: tradeInfo,
        TradeSha: tradeSha(tradeInfo, hashKey, hashIv),
        Version: '2.0'
      }
    });
  }catch(error){
    console.error('create-payment error', error);
    return json(500, { error: '付款服務暫時無法使用，請稍後再試' });
  }
}

