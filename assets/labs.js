(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.OptionLab = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const strikePrice = 100;
  const premium = 5;
  const minPrice = 70;
  const maxPrice = 130;
  const breakEven = { call: strikePrice + premium, put: strikePrice - premium };
  const positions = {
    callLong: { name: '콜 매수', kind: 'call', sold: false, tone: 'up' },
    callShort: { name: '콜 매도', kind: 'call', sold: true, tone: 'down' },
    putLong: { name: '풋 매수', kind: 'put', sold: false, tone: 'down' },
    putShort: { name: '풋 매도', kind: 'put', sold: true, tone: 'up' },
  };
  const concepts = new Map([
    ['term-14bf024878ae0200', ['callLong', 'callShort']],
    ['term-0a2a533d821f0ae6', ['putLong', 'putShort']],
    ['term-70a08a62a316201f', ['callLong']],
    ['term-3615d9ed99851bb0', ['callShort']],
    ['term-404ec34ea67b20e8', ['putLong']],
    ['term-9cd75d41a3173bf4', ['putShort']],
  ]);
  const boundCards = new WeakSet();

  function payoffs(price, strike = strikePrice, callPremium = premium, putPremium = premium) {
    const s = Math.max(0, Math.min(200, Math.round(Number(price))));
    const callIntrinsic = Math.max(s - strike, 0);
    const putIntrinsic = Math.max(strike - s, 0);
    return {
      price: s,
      callLong: callIntrinsic - callPremium,
      callShort: callPremium - callIntrinsic,
      putLong: putIntrinsic - putPremium,
      putShort: putPremium - putIntrinsic,
      callIntrinsic,
      putIntrinsic,
    };
  }
  function signed(number) {
    if (number > 0) return `+${number}`;
    if (number < 0) return `−${Math.abs(number)}`;
    return '0';
  }

  function chartMarkup(key, result) {
    const position = positions[key];
    const left = 44;
    const right = 280;
    const top = 30;
    const bottom = 156;
    const x = price => left + (price - minPrice) * (right - left) / (maxPrice - minPrice);
    const y = profit => top + (30 - profit) * (bottom - top) / 60;
    const curve = [minPrice, strikePrice, maxPrice].map(price => `${x(price)},${y(payoffs(price)[key])}`).join(' ');
    const currentX = x(result.price);
    return `<svg data-option-chart class="option-lab-chart v2-labchart is-${position.tone}" viewBox="0 0 300 196" role="img" aria-label="${position.name} 만기 손익 그래프">
      <desc>만기 주가 ${result.price}원에서 순손익은 ${signed(result[key])}원입니다. ${breakEven[position.kind]}원에서 손익이 0원입니다.</desc>
      <text x="2" y="17">순손익 (원)</text>
      ${[30, 0, -30].map(profit => `
        <line class="${profit === 0 ? 'option-lab-axis' : 'option-lab-gridline'}" x1="${left}" y1="${y(profit)}" x2="${right}" y2="${y(profit)}"/>
        <text x="${left - 7}" y="${y(profit) + 5}" text-anchor="end">${signed(profit)}</text>
      `).join('')}
      <line class="option-lab-axis" x1="${left}" y1="${top}" x2="${left}" y2="${bottom}"/>
      ${[minPrice, strikePrice, maxPrice].map(price => `
        <line class="option-lab-axis" x1="${x(price)}" y1="${bottom}" x2="${x(price)}" y2="${bottom + 4}"/>
        <text x="${x(price)}" y="${bottom + 18}" text-anchor="middle">${price}</text>
      `).join('')}
      <text x="${right}" y="191" text-anchor="end">만기 주가 (원)</text>
      <line class="lab-current" x1="${currentX}" y1="${top}" x2="${currentX}" y2="${bottom}"/>
      <polyline class="v2-labcurve${position.sold ? ' is-dashed' : ''}" points="${curve}"/>
      <circle class="option-lab-break-even" cx="${x(breakEven[position.kind])}" cy="${y(0)}" r="3"><title>손익분기점 ${breakEven[position.kind]}원</title></circle>
      <circle class="v2-labdot option-lab-dot" cx="${currentX}" cy="${y(result[key])}" r="5"/>
    </svg>`;
  }

  function resultMarkup(key, values) {
    const position = positions[key];
    const profit = values[key];
    const intrinsic = values[`${position.kind}Intrinsic`];
    const label = profit === 0 ? '손익 0원' : `${profit > 0 ? '이익' : '손실'} ${signed(profit)}원`;
    const explanation = position.sold
      ? `받은 프리미엄 ${premium}원 − 행사로 내는 돈 ${intrinsic}원`
      : `행사로 얻는 돈 ${intrinsic}원 − 낸 프리미엄 ${premium}원`;
    return `<strong class="v2-number" data-option-profit="${profit}">${label}</strong>
      <p>${explanation}</p>`;
  }

  function conceptMarkup(termId) {
    const choices = concepts.get(termId);
    if (!choices) return '';
    const initial = choices[0];
    const position = positions[initial];
    const values = payoffs(strikePrice);
    const buttons = choices.length > 1 ? `<div class="option-lab-positions" role="group" aria-label="매수 또는 매도">
      ${choices.map(key => `<button type="button" data-option-position="${key}" aria-pressed="${key === initial}">${positions[key].name}</button>`).join('')}
    </div>` : '';
    return `<section class="option-lab" data-option-lab="${termId}" aria-label="옵션 만기손익 실습">
      <h3>만기손익 실습</h3>
      <p>주식 한 주를 기준으로 만기 주가를 바꿔 보세요.</p>
      <dl class="option-lab-facts">
        <div><dt>행사가격</dt><dd>${strikePrice}원</dd></div>
        <div><dt>프리미엄</dt><dd>${premium}원</dd></div>
        <div><dt>손익분기점</dt><dd data-option-break-even>${breakEven[position.kind]}원</dd></div>
      </dl>
      ${buttons}
      <label class="option-lab-slider">
        <span>만기 주가 <b data-option-price-label>${strikePrice}원</b></span>
        <input data-option-price type="range" min="${minPrice}" max="${maxPrice}" value="${strikePrice}" aria-label="만기 주가" aria-valuetext="${strikePrice}원">
      </label>
      <div data-option-result class="option-lab-result" role="status" aria-atomic="true">${resultMarkup(initial, values)}</div>
      <div data-option-plot>${chartMarkup(initial, values)}</div>
    </section>`;
  }

  function bindConcept(root) {
    const cards = root.matches?.('[data-option-lab]') ? [root] : root.querySelectorAll('[data-option-lab]');
    for (const card of cards) {
      if (boundCards.has(card)) continue;
      boundCards.add(card);
      const range = card.querySelector('[data-option-price]');
      const priceLabel = card.querySelector('[data-option-price-label]');
      const result = card.querySelector('[data-option-result]');
      const chart = card.querySelector('[data-option-plot]');
      const buttons = card.querySelectorAll('[data-option-position]');
      let key = concepts.get(card.dataset.optionLab)[0];
      function update() {
        const values = payoffs(range.value);
        priceLabel.textContent = `${values.price}원`;
        range.setAttribute('aria-valuetext', priceLabel.textContent);
        result.innerHTML = resultMarkup(key, values);
        chart.innerHTML = chartMarkup(key, values);
      }
      range.addEventListener('input', update);
      for (const button of buttons) {
        button.addEventListener('click', () => {
          key = button.dataset.optionPosition;
          for (const choice of buttons) choice.setAttribute('aria-pressed', choice === button);
          update();
        });
      }
    }
  }

  return Object.freeze({ payoffs, conceptMarkup, bindConcept });
});
