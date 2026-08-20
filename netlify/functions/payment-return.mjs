import { SITE_URL, config, decryptTradeInfo, parseBody, safeJson, tradeSha } from './newebpay-utils.mjs';

function escapeHtml(value=''){
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function page({ success, title, message, orderNo, tradeNo, amount, atm }){
  const detail = atm ? `\n+    <div class="atm"><b>ATM 付款資料</b><br>銀行代碼：${escapeHtml(atm.bankCode || '')}<br>虛擬帳號：${escapeHtml(atm.account || '')}<br>繳費期限：${escapeHtml(atm.expireDate || '')}</div>` : '';
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}｜洛神繪社</title><style>body{margin:0;background:#efe5c3;color:#332817;font-family:-apple-system,BlinkMacSystemFont,"Noto Sans TC",sans-serif}.card{max-width:620px;margin:8vh auto;padding:42px;background:#fff9ea;border:1px solid #d8bb7a;box-shadow:0 15px 45px #6b4c1620}.seal{width:58px;height:58px;margin:auto;border-radius:50%;display:grid;place-items:center;background:${success?'#48623c':'#900'};color:white;font-size:30px}h1{text-align:center}.msg{text-align:center;line-height:1.8}.details,.atm{margin-top:24px;padding:18px;background:#f4ecd4;line-height:1.9}.btn{display:block;margin:28px auto 0;padding:14px 22px;background:#8a0000;color:white;text-decoration:none;text-align:center;max-width:260px}</style></head><body><main class="card"><div class="seal">${success?'✓':'!'}</div><h1>${escapeHtml(title)}</h1><p class="msg">${escapeHtml(message)}</p><div class="details">訂單編號：${escapeHtml(orderNo || '—')}<br>藍新交易序號：${escapeHtml(tradeNo || '—')}<br>金額：NT$ ${escapeHtml(amount || '—')}</div>${detail}<a class="btn" href="${SITE_URL}">返回洛神繪社</a></main></body></html>`;
}

export async function handler(event){
  try{
    const body = parseBody(event);
    const { hashKey, hashIv } = config();
    const checksumOk = body.TradeInfo && body.TradeSha && tradeSha(body.TradeInfo, hashKey, hashIv) === body.TradeSha;
    const payment = checksumOk ? safeJson(decryptTradeInfo(body.TradeInfo, hashKey, hashIv)) : null;
    const result = payment?.Result || {};
    const isAtm = result.PaymentType === 'VACC';
    const success = payment?.Status === 'SUCCESS';
    const html = page({
      success,
      title: success ? (isAtm ? 'ATM 帳號已建立' : '付款成功') : '付款尚未完成',
      message: success
        ? (isAtm ? '請於繳費期限內完成轉帳，款項入帳後訂單才正式成立。' : '感謝您的支持，我們已收到付款結果。')
        : (payment?.Message || '付款未完成或驗證失敗，請返回網站重新操作。'),
      orderNo: result.MerchantOrderNo,
      tradeNo: result.TradeNo,
      amount: result.Amt,
      atm: isAtm ? { bankCode: result.BankCode, account: result.CodeNo, expireDate: result.ExpireDate } : null
    });
    return { statusCode: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }, body: html };
  }catch(error){
    console.error('payment-return error', error);
    return { statusCode: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: page({ success:false, title:'無法確認付款結果', message:'請聯絡洛神繪社協助查詢。' }) };
  }
}

