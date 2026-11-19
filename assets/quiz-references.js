(() => {
  const generic = new Set([
    '가치', '가격', '개념', '거래', '교부', '기업', '등기', '등록', '매수', '매도', '매출',
    '당기순이익', '범위', '법인', '분모', '사원', '상품', '수익', '순자산', '시장', '심의', '요지', '위험', '위임', '인가',
    '액면가', '임면', '자본', '자산', '전략', '주가', '주식', '주주', '충당', '투자', '회사', '효과',
  ]);
  const particles = '으로부터|으로서는|에게서는|에서는|에서도|에서만|에게는|으로는|으로서|으로써|이라면|이라고|이었다|입니다|이라는|이며|이나|이란|이다|이고|에서|에게|한테|으로|부터|까지|마다|처럼|보다|라도|과는|에도|에만|에는|로는|로서|랑|과|와|은|는|이|가|을|를|의|에|로|도|만';
  const hangul = /[가-힣]/;
  const acronym = /^(?:[A-Z][A-Z0-9/-]{1,11}|REITs|M?VaR|T-(?:bill|bond|note))$/;
  const escaped = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const key = name => hangul.test(name) ? name.replace(/[ \t\u00a0]+/g, '') : name;
  const joined = name => Array.from(name, (char, i) =>
    (i > 0 && hangul.test(char) && hangul.test(name[i - 1]) ? '[ \\t\\u00a0]*' : '') + escaped(char)
  ).join('');

  function create(terms) {
    const byId = new Map(terms.map(term => [term.id, term]));
    const names = new Map();
    const lpId = 'glossary-69da5648e9c0752c4736';
    const basisPointId = 'glossary-158643d2decab8165339';
    function add(name, term, rank) {
      if (!name || !term) return;
      const normalized = key(name.trim());
      if (!normalized || generic.has(normalized)) return;
      if (hangul.test(normalized)) {
        if (!/^[A-Za-z0-9가-힣·-]+$/.test(normalized) || normalized.length < 2) return;
      } else if (!acronym.test(normalized) && !/^bps?$/.test(normalized)) {
        return;
      }
      const senses = names.get(normalized) || new Map();
      if (!senses.has(term.id) || senses.get(term.id).rank < rank) senses.set(term.id, {term, rank});
      names.set(normalized, senses);
    }

    for (const term of terms) {
      if (term.comparison || /^c\d+$/.test(term.id)) continue;
      for (const name of [term.title, term.displayTitle, ...(term.aliases || [])]) {
        if (!name) continue;
        const bare = name.replace(/\([A-Z][A-Za-z0-9/-]{1,11}\)$/, '').trim();
        add(bare, term, Number(name === term.title || name === term.displayTitle) + 1);
      }
    }

    const reviewed = [
      ['glossary-23611a9009c4e0a34430', 'PER', '주가수익비율'],
      ['glossary-465b53fe13942dbfa322', 'PBR', '주가순자산비율'],
      ['glossary-58c35f0cffaa25109dec', 'ETF', '상장지수펀드'],
      [lpId, 'LP', '유한책임사원'],
      [basisPointId, 'bp', 'bps'],
      ['glossary-85e6402f6ed1a3965b12', '상향식'],
      ['glossary-7a8b1074060e5d8fb22b', '영업보험료'],
      ['glossary-e9095ce109b2bc32289e', '다우이론'],
      ['glossary-cee3367491d21a665343', '무상증자'],
      ['glossary-7ca7ee3ef4051663421f', '보험자산배분', '포트폴리오 보험'],
      ['term-7510ca87213576ea', '예금보험'],
      ['glossary-aac0b852a1a4f56538be', '평균반전', '평균반전과정', '역투자전략', '과잉반응현상'],
    ];
    for (const [id, ...aliases] of reviewed) {
      for (const alias of aliases) add(alias, byId.get(id), 10);
    }

    const keys = [...names.keys()].sort((a, b) => b.length - a.length);
    const korean = keys.filter(name => hangul.test(name)).map(joined).join('|');
    const abbreviations = keys.filter(name => acronym.test(name)).map(escaped).join('|');
    const basisPoints = keys.includes('bp') || keys.includes('bps');
    const boundary = `(?=(?:${particles})?(?![\\p{L}\\p{N}_]))`;
    const expressions = [
      '<!--[\\s\\S]*?-->|</?[A-Za-z][^<>]*>|&(?:#[xX]?[0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]+);',
      korean && `(?<![\\p{L}\\p{N}_])(?:${korean})${boundary}`,
      basisPoints && `(?<=\\d[ \\t]*)BPS?${boundary}`,
      abbreviations && `(?<![A-Za-z0-9_.-])(?:${abbreviations})(?![A-Za-z0-9_-])`,
      basisPoints && `(?<![A-Za-z_.-])bps?${boundary}`,
    ].filter(Boolean);
    const pattern = new RegExp(expressions.join('|'), 'gu');

    function match(text, question) {
      const matches = [];
      if (!text) return matches;
      const direct = new Set(question?.conceptIds || []);
      const related = new Set();
      for (const id of direct) {
        for (const link of byId.get(id)?.links || []) related.add(link.target || link.id);
      }

      for (const result of text.matchAll(pattern)) {
        const surface = result[0];
        const start = result.index;
        const end = start + surface.length;
        const before = text.slice(Math.max(0, start - 48), start);
        const name = /^BPS?$/.test(surface) && /\d[ \t]*$/.test(before) ? surface.toLowerCase() : key(surface);
        const senses = names.get(name);
        if (!senses) continue;

        if (name === 'LP') {
          const after = text.slice(end, end + 48);
          const limitedPartner = /유한\s*책임\s*사원|Limited Partner/i;
          const liquidityProvider = /유동성\s*공급자?|Liquidity Provider/i;
          const expanded = before.match(/(?:유한\s*책임\s*사원|Limited Partner|유동성\s*공급자?|Liquidity Provider)\s*[(（]\s*$/i)?.[0] ||
            after.match(/^\s*[(（]\s*(?:유한\s*책임\s*사원|Limited Partner|유동성\s*공급자?|Liquidity Provider)/i)?.[0];
          const context = [text, question?.stem, question?.statement, question?.displayStem,
            ...(question?.options || []).map(option => option.text)].join(' ');
          if (expanded ? liquidityProvider.test(expanded) :
            liquidityProvider.test(context) || !(limitedPartner.test(context) ||
              /\bPEF\b|사모\s*(?:투자\s*)?펀드/.test(context) || direct.has(lpId))) continue;
        }

        let best = null;
        let bestScore = -1;
        for (const {term, rank} of senses.values()) {
          const score = rank + 4 * Number(direct.has(term.id)) + 2 * Number(related.has(term.id));
          if (score > bestScore) {
            best = term;
            bestScore = score;
          } else if (score === bestScore) {
            best = null;
          }
        }
        if (best) matches.push({start, end, id: best.id});
      }
      return matches;
    }

    return match;
  }

  window.QuizReferences = {create};
})();
