import {
  config,
  decryptTradeInfo,
  parseBody,
  safeJson,
  tradeSha
} from './newebpay-utils.mjs';

const GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbx1P4RKTxw4fH-ByVDOmN0H7quF5p6IUCtkpCTpDnQwrvSIpLyQ71B9GmVoFTtMh3BcoA/exec';

async function updateGoogleSheet(payment) {
  const result = payment.Result || {};
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error('PAYMENT_WEBHOOK_SECRET 尚未設定');
  }

  const isPaid =
    payment.Status === 'SUCCESS' &&
    (
      result.PaymentType !== 'VACC' ||
      Boolean(result.PayTime)
    );

  const paymentStatus = isPaid
    ? '付款成功'
    : result.PaymentType === 'VACC' &&
      payment.Status === 'SUCCESS'
      ? '待轉帳'
      : '付款失敗';

  const response = await fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      action: 'payment_update',
      secret: secret,
      orderNo: result.MerchantOrderNo || '',
      amount: Number(result.Amt) || 0,
      paymentStatus: paymentStatus,
      tradeNo: result.TradeNo || '',
      paidAt: result.PayTime || new Date().toISOString()
    })
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      'Google Sheet HTTP ' + response.status
    );
  }

  const output = safeJson(text);

  if (output && output.success === false) {
    throw new Error(
      output.message || 'Google Sheet 更新失敗'
    );
  }

  return paymentStatus;
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: '0|Method Not Allowed'
    };
  }

  try {
    const body = parseBody(event);
    const { hashKey, hashIv } = config();

    if (
      !body.TradeInfo ||
      !body.TradeSha ||
      tradeSha(
        body.TradeInfo,
        hashKey,
        hashIv
      ) !== body.TradeSha
    ) {
      return {
        statusCode: 400,
        body: '0|Invalid checksum'
      };
    }

    const payment = safeJson(
      decryptTradeInfo(
        body.TradeInfo,
        hashKey,
        hashIv
      )
    );

    if (!payment) {
      return {
        statusCode: 400,
        body: '0|Invalid payload'
      };
    }

    const paymentStatus =
      await updateGoogleSheet(payment);

    console.log(
      'NEWEBPAY_PAYMENT_RESULT',
      JSON.stringify({
        status: payment.Status,
        paymentStatus: paymentStatus,
        merchantOrderNo:
          payment.Result?.MerchantOrderNo,
        tradeNo: payment.Result?.TradeNo,
        amount: payment.Result?.Amt,
        paymentType: payment.Result?.PaymentType
      })
    );

    return {
      statusCode: 200,
      body: '1|OK'
    };

  } catch (error) {
    console.error(
      'payment-notify error',
      error
    );

    return {
      statusCode: 500,
      body: '0|Error'
    };
  }
}
