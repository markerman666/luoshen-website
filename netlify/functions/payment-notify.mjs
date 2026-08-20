import { config, decryptTradeInfo, parseBody, safeJson, tradeSha } from './newebpay-utils.mjs';

export async function handler(event){
  if(event.httpMethod !== 'POST') return { statusCode: 405, body: '0|Method Not Allowed' };
  try{
    const body = parseBody(event);
    const { hashKey, hashIv } = config();
    if(!body.TradeInfo || !body.TradeSha || tradeSha(body.TradeInfo, hashKey, hashIv) !== body.TradeSha){
      return { statusCode: 400, body: '0|Invalid checksum' };
    }
    const payment = safeJson(decryptTradeInfo(body.TradeInfo, hashKey, hashIv));
    if(!payment) return { statusCode: 400, body: '0|Invalid payload' };

    // 付款結果會出現在 Netlify Functions log。下一階段可再將成功狀態回寫 Google 試算表。
    console.log('NEWEBPAY_PAYMENT_RESULT', JSON.stringify({
      status: payment.Status,
      merchantOrderNo: payment.Result?.MerchantOrderNo,
      tradeNo: payment.Result?.TradeNo,
      amount: payment.Result?.Amt,
      paymentType: payment.Result?.PaymentType
    }));
    return { statusCode: 200, body: '1|OK' };
  }catch(error){
    console.error('payment-notify error', error);
    return { statusCode: 500, body: '0|Error' };
  }
}

