export function unpaidTopupsOnDate(topups, dateStr) {
  return (topups || []).flatMap(topup =>
    (topup.payments || [])
      .filter(payment => payment.dateStr === dateStr && !topup.records?.[payment.installment])
      .map(payment => ({ topup, payment }))
  );
}

export function paymentTotal(mainAmount, topupEntries) {
  return (Number(mainAmount) || 0) + topupEntries.reduce(
    (total, { topup }) => total + (Number(topup.interestAmount) || 0), 0
  );
}

export function boldAmount(amount) {
  return Array.from(Number(amount).toLocaleString('th-TH'), char =>
    /[0-9]/.test(char) ? String.fromCodePoint(0x1d7ce + Number(char)) : char
  ).join('');
}
