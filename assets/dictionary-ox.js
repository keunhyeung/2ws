(() => {
  const individualLimit = 3;

  function validQuestion(question) {
    return question.id && question.statement?.trim() && question.explanation?.trim() &&
      typeof question.answer === 'boolean';
  }

  function sameStatement(value) {
    return value.normalize('NFKC').replace(/[\s"'‘’“”.,]+/g, '');
  }

  function collectConceptQuestions(terms, questions, choices) {
    const byTerm = new Map();
    const resolve = window.QuizReferences?.create(terms);
    const termIds = new Set(terms.map(term => term.id));

    function add(id, question, score) {
      if (!termIds.has(id)) return;
      const candidates = byTerm.get(id) || new Map();
      const existing = candidates.get(question.id);
      if (!existing || existing.score < score) candidates.set(question.id, {question, score});
      byTerm.set(id, candidates);
    }

    const byQuestion = new Map(questions.map(question => [question.id, question]));
    for (const term of terms) {
      for (const id of term.studyOxIds || []) {
        const question = byQuestion.get(id);
        if (question) add(term.id, question, 10);
      }
    }

    for (const question of questions) {
      const directIds = new Set(question.conceptIds || []);
      for (const id of directIds) add(id, question, directIds.size === 1 ? 9 : 8);
      for (const match of resolve?.(question.statement, question) || []) {
        const firstClause = question.statement.slice(0, match.start);
        add(match.id, question, firstClause.length < 24 && !/[;.!?]/.test(firstClause) ? 7 : 6);
      }
      if (question.answer === false) {
        const correction = question.explanation.split(/(?<=[.!?])\s/)[0];
        for (const match of resolve?.(correction, question) || []) {
          if (match.start === 0) add(match.id, question, 3);
        }
      }
    }

    for (const choice of choices) {
      const stem = choice.stem?.trim();
      if (choice.review?.status !== 'verified' || !stem || /[\n▷〈]/.test(stem)) continue;
      const wrong = /(?:틀린|옳지 않은|사실과 다른) (?:것|설명)은\?$/.test(stem);
      const right = /(?:옳은|맞는) (?:것|설명)은\?$/.test(stem);
      const bestWrong = /(?:가장 적절하지 않은|가장 거리가 먼) 것은\?$/.test(stem);
      if (!wrong && !right && !bestWrong) continue;

      for (const option of choice.options || []) {
        const selected = option.id === choice.correctOptionId;
        const statement = option.text?.trim();
        const explanation = option.explanation?.trim();
        if (!statement || !explanation || !isStandaloneOption(statement)) continue;
        if (bestWrong && (!selected || !/(틀렸|잘못|오류|반대다|할 수 없다|아니기 때문)/.test(explanation))) continue;
        if (!selected && !wrong) continue;
        const answer = right || (wrong && !selected);
        const question = {id: `dictionary-ox-${choice.id}-${option.id}`, statement, answer, explanation};
        for (const match of resolve?.(statement, choice) || []) {
          const prefix = statement.slice(0, match.start);
          const after = statement.slice(match.end);
          if (prefix.length < 24 && !/[,;.!?]|(?:은|는|이|가)\s/.test(prefix) &&
              /^(?:[\s(·,]|은|는|이|가|의|에서|를|을)/.test(after)) add(match.id, question, 2);
        }
      }
    }

    return byTerm;
  }

  function isStandaloneOption(statement) {
    if (statement.length < 20 || statement.length > 240 || /[\n<>①②③④⑤]|\[|\?/.test(statement)) return false;
    if (!/(?:다|된다|이다|함)\.$/.test(statement)) return false;
    return !/(?:이 회사|이 펀드|이 사례|이 경우|이때|동사|동 펀드|위 사례|다음|앞의|상기|보기|빈칸|그 수치|해당 수치|[ABC]안)|법상 [^ .]+에 해당된다/.test(statement);
  }

  const reviewed = {
    'r-rate14-interest': [false, '일반 이자소득에 적용되는 14% 원천징수세율에는 지방소득세가 포함된다.', '14%는 기본 소득세 원천징수 국세율이다. 지방소득세 1.4%를 합하면 15.4%다. 종합과세 여부는 별도로 판단한다.'],
    'r-rate154-interest': [true, '거주자의 일반 이자소득에 소득세 14%를 원천징수하면 지방소득세까지 합한 원천징수율은 15.4%다.'],
    'r-rate14-dividend': [true, '거주자의 일반 배당소득에 대한 기본 원천징수 국세율은 14%다.'],
    'r-rate154-dividend': [false, '거주자의 일반 배당소득에 대한 기본 원천징수율은 지방소득세를 포함해도 14%다.', '기본 국세 14%에 지방소득세 1.4%를 더하면 15.4%다. 출자공동사업자 배당 등은 세율이 다를 수 있다.'],
    'r-rate14-p2p': [true, '등록 온라인투자연계금융업자를 거친 비영업대금 이익이 소득세법상 예외 요건을 충족하면 14%를 적용한다.'],
    'r-rate154-p2p': [false, '등록 온라인투자연계금융업자를 거쳐 국세 14%가 적용되는 비영업대금 이익은 지방소득세를 포함해 27.5%를 원천징수한다.'],
    'r-rate14-court': [true, '법정 분리과세 대상인 법원보관금 이자의 소득세율은 14%다.'],
    'r-rate154-court': [true, '법정 분리과세 대상인 법원보관금 이자에 소득세 14%를 적용하면 지방소득세를 합한 세율은 15.4%다.'],
    'r-rate14-gov': [true, '만기보유 등 법정 요건을 충족한 개인투자용 국채의 특례 대상 이자에는 소득세 14% 분리과세를 적용한다.'],
    'r-rate154-gov': [false, '개인투자용 국채 이자에 14% 분리과세 특례를 적용할 때 그 14%에 지방소득세가 포함되어 있다.'],
    'r-stock-large-low': [false, '과세대상인 일반 대주주 주식 양도에 누진 기본세율을 적용할 때 과세표준 3억 원 이하 구간의 국세율은 25%다.'],
    'r-stock-large-high': [true, '과세대상인 일반 대주주 주식 양도에 누진 기본세율을 적용할 때 과세표준 중 3억 원을 넘는 구간의 국세율은 25%다.'],
    'r-stock-large-short': [true, '대주주가 1년 미만 보유한 중소기업 외의 과세대상 국내주식을 양도하는 경우 적용 국세율은 30%다.'],
    'r-other3m': [true, '해당 원천징수 기타소득의 연간 소득금액이 300만 원 이하이면 요건에 따라 분리과세 대신 종합과세를 선택할 수 있다.'],
    'r-saving65': [false, '2026년에 비과세종합저축에 가입할 때 고령자 자격 구분에서는 기초연금 수급 여부와 관계없이 만 65세 이상이면 충분하다.'],
    'r-closed90': [true, '별도 환금성 보장방법을 정하지 않은 법정 대상 환매금지형 투자신탁은 집합투자증권의 최초 발행일부터 90일 이내에 상장한다.'],
    'r-credit132': [true, '기본 연금계좌 세액공제의 소득세율 12%를 지방소득세 효과까지 반영해 표시하면 13.2%다.'],
    'r-large1pp': [false, '주식 등 대량보유 보고에서 기존 보유비율이 10%에서 10.1%로 오르면 1%포인트 변동한 것이다.'],
    'r-finance20m': [false, '일반 이자와 배당의 세전 합계가 2,000만 원을 넘으면, 그중 2,000만 원을 소득에서 공제한다.'],
    'r-isaannual': [false, '일반 개인종합자산관리계좌의 기본 연 납입한도와 총 납입한도는 모두 2,000만 원이다.'],
    'r-isa3tax': [true, '일반 개인종합자산관리계좌 가입 자격을 판단할 때 직전 3개 과세기간의 금융소득종합과세 대상 이력을 확인한다.'],
    'r-claim5y': [false, '일반 경정청구의 기본 청구기간 5년은 과세처분 통지를 받은 날부터 센다.', '일반 경정청구는 원칙적으로 법정신고기한이 지난 후 5년 이내에 관할 세무서장에게 청구한다.'],
    'r-claim3mo': [true, '후발적 사유에 따른 경정청구는 그 사유가 발생한 사실을 안 날부터 3개월 이내에 청구하는 것이 원칙이다.'],
    'r-appeal90': [true, '국세 과세처분을 통지받은 납세자의 심사·심판 청구 기본 기한은 통지를 받은 날부터 90일 이내다.'],
    'r-notice14': [false, '국세 서류를 공시송달하면 주요 내용을 공고한 당일에 송달된 것으로 본다.', '공시송달은 주요 내용을 공고한 뒤 14일이 지나면 송달된 것으로 본다.'],
    'r-collect5y': [false, '가산세를 제외한 국세가 5억 원 미만이면 징수권을 행사할 수 있는 때부터 기본 소멸시효는 10년이다.', '가산세를 제외하고 5억 원 미만인 국세의 기본 소멸시효는 징수권을 행사할 수 있는 때부터 5년이다. 5억 원 이상에는 기본 10년을 적용한다.'],
    'r-collect10y': [true, '가산세를 제외한 국세가 5억 원 이상이면 징수권을 행사할 수 있는 때부터 기본 소멸시효는 10년이다.'],
    'r-credit165': [true, '우대 소득요건을 충족한 연금계좌 세액공제의 소득세율 15%를 지방소득세 효과까지 반영해 표시하면 16.5%다.'],
    'r-access6': [true, '금융회사가 권리구제를 위한 적법한 자료 열람 요구를 받으면 원칙적으로 6영업일 이내에 자료를 제공한다.'],
    'r-asset10': [true, '일반펀드의 동일종목 편입 기본 한도는 해당 펀드 자산총액의 10%다.'],
    'r-compliance7': [false, '금융회사가 준법감시인을 임면하면 임면일부터 7일 이내에 금융위원회에 보고한다.', '준법감시인의 임면보고 기한은 임면일부터 7영업일 이내다.'],
    'r-discretion3mo': [true, '투자일임업자는 일반투자자에게 투자일임보고서를 3개월마다 한 번 이상 교부하는 것이 기본이다.'],
    'r-discretion2mo': [false, '투자일임보고서를 일반투자자에게 3개월마다 작성하는 경우, 대상 기간이 끝난 뒤 교부하기까지도 3개월을 기본 기한으로 본다.', '작성대상기간이 끝난 뒤 기본 교부 기한은 2개월 이내다. 3개월은 일반투자자에 대한 정기 교부 주기다.'],
    'r-terms7': [false, '금융투자회사가 일반 약관을 제정하거나 변경하면 원칙적으로 그 후 7영업일 이내에 협회에 보고한다.', '일반 약관의 사후보고 기한은 제정·변경 후 7일이다. 사전신고 대상 약관은 시행예정일을 기준으로 별도 기한을 계산한다.'],
    'r-terms10': [true, '사전신고 대상 약관을 제정하거나 변경하려는 금융투자회사는 시행예정일 10영업일 전까지 협회에 신고한다.', '사전신고 대상의 기산점은 시행예정일이다. 일반 약관의 사후보고는 제정·변경 후 7일 이내다.'],
    'r-infringe7': [true, '배타적 사용권 침해배제 신청을 받으면 접수일부터 7영업일 이내에 위원회를 소집해 심의한다.'],
    'r-infringe1': [false, '배타적 사용권 침해배제 결정이 나면 그 결정일부터 7영업일 이내에 신청회사에 서면으로 통지하고 공시한다.', '신청회사 서면통지와 공시는 결정일의 다음 영업일에 한다. 신청 접수일부터 7영업일 이내라는 기한은 소집·심의에 적용된다.'],
    'r-underwrite5': [false, '금융투자회사는 대표주관계약을 체결한 뒤 5일 이내에 협회에 신고한다.', '대표주관계약의 협회 신고는 계약 체결 후 5영업일 이내다.'],
    'r-ancillary2w': [true, '금융투자업자가 겸영·부수업무를 시작한 경우 기본 사후보고 기한은 시작일부터 2주 이내다.'],
    'r-solicit50': [false, '증권의 모집·매출에서 50인 기준은 권유받은 사람 중 매수를 완료한 사람 수로 판단한다.', '기본 기준은 청약을 권유받은 사람이 50인 이상인지다. 제외 대상과 과거 권유 합산 규정도 함께 적용한다.'],
    'r-solicit6mo': [true, '증권의 모집 여부를 판단할 때 현재 권유와 함께 과거 6개월간 같은 종류의 증권에 대한 권유 대상을 법정 방식으로 합산한다.'],
    'r-cert50': [false, '비지분증권의 전매제한 요건에서 50이라는 기준은 원칙적으로 권면 수량과 관계없이 증권을 산 사람의 수를 말한다.', '이 요건은 50매 미만 발행인지와 발행 후 1년 내 권면분할금지 특약 등 전매제한 조치를 확인한다.'],
    'r-cert1y': [true, '비지분증권을 50매 미만으로 발행하는 경우에도 전매제한 요건을 판단할 때 발행 후 1년 내 권면분할을 금지하는 특약 등을 확인한다.'],
    'r-convert1y': [false, '전환증권의 전매제한 기본조치에서 1년 기준은 전환권 행사 여부와 무관하게 그 채권의 모든 양도를 금지하는 기간이다.', '이 경우 1년 이상 전환권 행사를 금지하는 조치 등을 본다.'],
    'r-report90': [true, '일반 사업보고서 제출대상 법인은 사업연도가 끝난 뒤 90일 이내에 해당 사업보고서를 제출한다.'],
    'r-report5': [false, '새로 사업보고서 제출대상이 된 법인은 일반적으로 대상이 된 날부터 5영업일 이내에 직전연도 사업보고서를 제출한다.', '기본 기한은 제출대상이 된 날부터 5일 이내다. 대표주관계약의 협회 신고에는 5영업일을 적용한다.'],
    'r-prospectus1y': [true, '개방형펀드의 투자설명서는 정기적으로 1년마다 한 번 이상 개정해 제출한다.'],
    'r-research1': [false, '조사분석 대상 기업 지분 1%를 보유한 금융투자회사는 해당 자료의 공표가 기본적으로 금지된다.', '1% 이상 5% 미만 보유 구간은 이해관계 표시 등의 조건을 확인한다. 기본 공표금지 경계는 5% 이상이다.'],
    'r-research5': [true, '금융투자회사가 조사분석 대상 기업의 주식을 5% 이상 보유하면 기본적으로 그 기업에 대한 조사분석자료를 공표할 수 없다.'],
    'r-joint5': [true, '금융투자회사와 이해관계인의 직접보유 지분이 5% 이상 10% 미만인 기본 사례에서는 독립된 회사와 공동으로 주관한다.'],
    'r-joint10': [false, '금융투자회사와 이해관계인의 직접보유 지분이 10%에 이르러도 기본 규칙상 독립된 회사와 공동으로 주관할 수 있다.', '공동주관 기본 구간은 5% 이상 10% 미만이다. 10% 이상이면 기본적으로 주관업무가 금지된다.'],
    'r-research24h': [true, '금융투자분석사는 적용 대상 조사분석자료를 공표한 뒤 24시간이 지나기 전에는 관련 금융투자상품의 매매가 제한된다.'],
    'r-research7d': [false, '조사분석자료 공표 후 24시간이 지나면 해당 분석사의 투자의견 방향에 관한 매매제한도 곧바로 끝난다.', '공표 직후 24시간 매매제한과 별도로 공표일부터 7일 동안은 공표 의견과 같은 방향의 매매 제한을 적용한다.'],
    'r-mmfcd6mo': [true, '원화 단기금융집합투자기구가 양도성예금증서를 매입하는 기본 사례에서는 매입 시점의 잔존만기가 6개월 이내여야 한다.'],
    'r-mmfgov5y': [true, '원화 단기금융집합투자기구가 국채를 직접 편입하는 기본 사례에서는 해당 국채의 잔존만기가 5년 이내여야 한다.'],
    'r-mmflocal1y': [false, '원화 단기금융집합투자기구가 지방채를 직접 편입할 때 국채와 마찬가지로 잔존만기 5년 이내 기준을 적용한다.', '지방채와 특수채 등의 해당 직접편입 기준은 잔존만기 1년 이내다. 국채의 잔존만기 기준은 5년 이내다.'],
    'r-mmf40': [false, '단기금융집합투자기구의 채무증권 최소 편입 비중 40%를 계산할 때 환매조건부채권매매도 포함한다.', '채무증권은 40% 이상 편입하는 것이 기본이며, 이 비중을 계산할 때 환매조건부채권매매를 제외한다.'],
    'r-mmf5': [true, '단기금융집합투자기구가 최상위 신용등급의 채무증권을 편입하는 기본 사례에서 동일 발행자 합산 한도는 5%다.'],
    'r-mmf2': [false, '단기금융집합투자기구가 차상위 신용등급 채무증권을 편입할 때도 최상위등급과 동일하게 발행자별 기본 한도가 5%다.', '차상위등급의 동일 발행자 기본 한도는 2%다. 5%는 최상위등급의 기본 한도다.'],
    'r-mmfrp5': [false, '단기금융집합투자기구의 환매조건부 매도 기본 한도는 보유 증권총액의 50%다.', '단기금융집합투자기구에는 보유 증권총액의 5% 한도를 적용한다. 일반펀드의 기본 한도는 50%다.'],
    'r-fundrp50': [true, '일반펀드가 보유 증권을 환매조건부로 매도하는 기본 사례에서 그 한도는 보유 증권총액의 50%다.'],
    'r-mmf005': [false, '장부가 평가를 하는 단기금융집합투자기구에서 0.5%는 투자자에게 보장하는 최대 손실률이다.', '장부가 기준가격과 시가 등으로 계산한 기준가격의 괴리율이 0.5%를 초과하는 등 규약상 조건에 해당하면 정해진 조치를 취한다.'],
    'r-withdraw15d': [false, '법정 청약철회 대상 보험은 청약일에서 이미 30일이 지났더라도 보험증권을 받은 날부터 15일 안이면 기본적으로 철회할 수 있다.', '기본 기한은 보험증권을 받은 날부터 15일과 청약일부터 30일 중 먼저 오는 날이다.'],
    'r-withdraw30d': [true, '법정 청약철회 대상 보험에서 청약일부터 30일이 되는 날이 보험증권 수령 후 15일보다 먼저라면 청약일부터 30일이 기본 기한이다.'],
    'r-tender20d': [false, '공개매수기간의 기본 하한인 20일은 영업일로 센다.', '공개매수기간은 기본적으로 20일 이상 60일 이내다. 달력일 기준이다.'],
    'r-tender60d': [true, '공개매수기간은 기본적으로 60일 이내로 정한다.'],
    'r-outsource7': [false, '본질적 업무를 위탁하는 기본 사례에서는 수탁자가 업무를 시작한 뒤 7일 이내에 보고한다.'],
    'r-outsource14': [true, '본질적 업무 외의 위탁에 적용하는 기본 사례에서는 수탁자가 업무를 시작한 날부터 14일 이내에 보고한다.'],
    'r-gov-3years': [false, '개인투자용 국채 3년물을 만기까지 보유하면 5년 이상 종목과 동일한 분리과세 특례를 적용받는다.'],
    'r-pension-age70': [false, '연금 수령일 현재 70세인 사람이 기본 연금 원천징수세율을 적용받는다면 소득세율은 5%다.'],
    'r-pension-age80': [true, '연금 수령일 현재 80세인 사람이 기본 연금 원천징수세율을 적용받는다면 소득세율은 3%다.'],
    'r-pen-age-under70': [true, '연금 수령일 현재 69세인 사람에게 적용되는 기본 연금 원천징수 국세율은 5%다.'],
    'r-pen-age-70to80': [false, '연금 수령일 현재 75세인 사람에게 적용되는 기본 연금 원천징수 국세율은 3%다.'],
    'r-pen-age-over80': [true, '연금 수령일 현재 85세인 사람에게 적용되는 기본 연금 원천징수 국세율은 3%다.'],
    'r-pen-age-under70local': [false, '연금 수령일 현재 69세인 사람에게 적용되는 기본 연금 원천징수세율은 지방소득세를 포함해 4.4%다.'],
    'r-pen-age-70to80local': [true, '연금 수령일 현재 75세인 사람에게 적용되는 기본 연금 원천징수세율은 지방소득세를 포함해 4.4%다.'],
    'r-pen-age-over80local': [false, '연금 수령일 현재 85세인 사람에게 적용되는 기본 연금 원천징수세율은 지방소득세를 포함해 4.4%다.'],
    'f-gordon': [true, '요구수익률이 배당성장률보다 높을 때 고든 일정성장모형의 분자에는 다음 기 예상 주당배당금을 넣는다.', '주식을 산 뒤 처음 받을 배당은 다음 기 배당이다. 당기 배당이 1,000원이고 해마다 5%씩 성장한다고 가정하면 분자에는 1,050원을 넣는다.'],
    'f-equity-from-ev': [false, '단순 기업가치 모형에서 기업가치가 100억 원이고 순차입금이 20억 원이면 주주가치는 120억 원이다.', '사업 전체 가치 100억 원 중 채권자에게 돌아가는 순차입금이 20억 원이다. 주주에게 남는 몫은 100억 − 20억 = 80억 원이다.'],
    'f-eva': [false, '경제적 부가가치는 세후순영업이익에 투하자본의 자본비용을 더해서 계산한다.', '영업으로 번 돈에서 세금을 내고, 투자자들이 자본을 제공한 대가까지 충당한 뒤 얼마나 남는지를 묻는다. 그래서 세후순영업이익에서 투하자본의 자본비용을 뺀다.'],
    'f-wacc': [true, '법인세 효과를 반영하는 기본 가중평균자본비용 계산에서 부채비용에는 (1−법인세율)을 곱한다.', '법인세를 계산할 때 이자비용을 차감할 수 있다는 가정에서는 실제 부채비용이 낮아진다. 예를 들어 세전 부채비용이 5%이고 법인세율이 20%라면 세후 비용은 5% × 0.8 = 4%다.'],
    'f-pi-one': [true, '현금유출의 현재가치가 양수일 때 수익성지수가 1이라면 유입과 유출의 현재가치는 같다.', '수익성지수는 받을 돈의 현재가치를 낼 돈의 현재가치로 나눈 값이다. 비율이 정확히 1이면 받을 돈과 낼 돈의 현재가치가 같아 순현재가치도 0이다.'],
    'f-npv-zero': [false, '독립 투자안의 순현재가치가 음수이면 요구수익률을 기준으로 투자안을 채택한다.', '요구수익률로 할인했는데 순현재가치가 음수이면 받을 돈의 현재가치가 투자할 돈보다 작다는 뜻이다. 다른 제약이 없는 독립 투자안이라면 기각한다.'],
    'f-irr-hurdle': [true, '최초 투자 뒤 현금이 유입되는 통상적 투자안에서 내부수익률이 요구수익률보다 높으면 순현재가치는 양수다.', '처음 투자한 뒤 돈이 들어오는 구조에서는 할인율을 올릴수록 순현재가치가 줄어든다. 순현재가치가 0이 되는 내부수익률보다 낮은 요구수익률로 할인하면 순현재가치는 양수다.'],
    'f-sample-variance': [false, '표본분산을 구할 때 제곱편차의 합을 표본 크기 n으로 나눈다.', '표본평균을 먼저 구하면 각 값과 평균의 차이를 모두 더한 값은 0으로 정해진다. 그래서 모집단 분산을 추정하는 표본분산은 제곱편차의 합을 표본 수에서 1을 뺀 자유도로 나눈다.'],
    'f-correlation-range': [true, '두 자산 수익률의 상관계수가 −1이어도 각 자산의 표준편차가 다르면 같은 비중 포트폴리오의 표준편차가 0보다 클 수 있다.', '반대로 움직인다는 사실만으로 서로의 변동이 정확히 지워지지는 않는다. 두 자산의 변동 폭이 다르면 각 자산의 투자비중과 표준편차의 곱이 같아지도록 비중도 달리해야 한다.'],
    'f-hhi': [false, '허핀달·허쉬만지수는 상위 몇 개 기업의 시장점유율을 제곱하지 않고 더한 값이다.', '모든 기업의 시장점유율을 각각 제곱해 더한다. 제곱하기 때문에 시장점유율이 큰 기업일수록 지수에 더 큰 영향을 준다.'],
    'f-basis-point': [true, '수익률이 3.00%에서 3.25%로 오르면 25bp 상승한 것이다.', '두 수익률 차이는 0.25%포인트다. 1bp(베이시스포인트)는 0.01%포인트이므로 0.25 ÷ 0.01 = 25bp가 된다.'],
    'f-var-confidence': [false, '연속 손실분포에서 95% 신뢰수준의 최대예상손실액을 초과할 확률은 95%다.', '하루 95% 신뢰수준이면 모형에서 100일 중 약 95일의 손실이 기준선 이내라는 뜻이다. 기준보다 더 큰 손실이 날 확률은 나머지 약 5%다.'],
    'f-var-time': [true, '제곱근 시간법칙을 적용할 수 있다면 4일 최대예상손실액은 1일 최대예상손실액의 2배다.', '하루 위험에 기간의 제곱근을 곱하는 가정이다. 따라서 4일이면 √4 = 2를 곱하고, 9일이면 √9 = 3을 곱한다.'],
    'f-portfolio-var': [true, '두 포지션의 상관계수가 1이면 주어진 합산 모형에서 전체 최대예상손실액은 두 개별 값의 합과 같다.', '두 포지션의 손익이 완전히 같은 방향으로 움직이는 경우다. 이 모형에서는 분산효과가 생기지 않으므로 3억 원과 4억 원의 위험은 그대로 7억 원이 된다.'],
    'f-expected-loss': [true, '부도 시 위험노출액이 100억 원, 부도율이 2%, 부도 시 손실률이 40%라면 기대손실은 8,000만 원이다.', '부도가 나면 100억 원의 40%인 40억 원을 잃는다. 이 손실이 발생할 확률 2%를 곱하면 평균적으로 예상하는 손실은 0.8억 원, 즉 8,000만 원이다.'],
    'f-loss-sigma': [false, '부도 시 손실액이 L이고 부도확률이 p인 베르누이 모형에서 Lp는 손실의 표준편차다.', '부도 때 L을 잃고 그 밖에는 손실이 0이면 평균 손실은 L × p다. 손실이 그 평균을 중심으로 얼마나 흔들리는지를 나타내는 표준편차는 L × √[p(1−p)]다.'],
    'f-lgd-recovery': [true, '부도 시 회수율이 35%이면 부도 시 손실률은 65%다.', '빌려준 100원 가운데 35원을 되찾으면 잃는 금액은 65원이다. 회수율 35%와 부도 시 손실률 65%를 더하면 100%다.'],
    'f-cppi': [false, '고정비율 포트폴리오보험전략에서 위험자산 투자액을 계산할 때 전체 포트폴리오 가치에 승수를 곱한다.', '포트폴리오가 110이고 지킬 금액의 현재가치가 100이면 여유분인 쿠션은 10이다. 승수가 4라면 위험자산에 넣을 목표액은 110 × 4가 아니라 10 × 4 = 40이다.'],
    'f-te-ir': [false, '정보비율을 구할 때 분모에는 포트폴리오 수익률 자체의 표준편차를 넣는다.', '정보비율은 벤치마크보다 얼마나 더 벌었는지를 벤치마크와의 수익률 차이가 얼마나 흔들렸는지로 나눈 값이다. 그래서 분모는 그 차이의 표준편차인 추적오차다.'],
    'f-current-yield': [true, '연간 쿠폰이 5만 원이고 현재 채권가격이 125만 원이면 경상수익률은 4%다.', '‘지금 이 가격에 사면 1년 이자가 몇 %인가’를 묻는다. 125만 원을 내고 연간 5만 원을 받으므로 5만 ÷ 125만 = 4%다.'],
    'f-cb-parity': [true, '주가가 1만 2,000원이고 전환가격이 1만 원이면 전환사채 패리티는 120%다.', '전환가격 1만 원을 기준으로 받을 주식이 시장에서 1만 2,000원이다. 패리티는 12,000 ÷ 10,000 × 100 = 120%이며, 전환가격보다 20% 높은 수준이다.'],
    'f-cb-premium': [false, '전환가치가 10만 원이고 전환사채가격이 12만 원이면 전환가치 기준 괴리율은 약 16.7%다.', '주식으로 바꿨을 때의 가치보다 채권가격이 2만 원 비싸다. 전환가치 기준 괴리율의 분모는 10만 원이므로 2만 ÷ 10만 = 20%다.'],
    'f-duration-modified': [true, '연 1회 복리에서 만기수익률이 양수라면 수정듀레이션은 같은 채권의 맥컬레이 듀레이션보다 작다.', '연 1회 복리라면 맥컬레이 듀레이션을 ‘1 + 만기수익률’로 나눈다. 만기수익률이 양수이면 1보다 큰 수로 나누므로 수정듀레이션이 더 작다.'],
    'f-duration-convexity': [true, '수익률 변동 폭이 같고 방향만 반대이면 볼록성에 따른 채권가격 변화율 근사 보정항의 크기와 부호는 같다.', '볼록성 보정식에는 금리 변화의 제곱이 들어간다. 금리가 같은 폭으로 오르거나 내려도 제곱값은 같다. 양의 볼록성을 가진 채권이면 두 경우 모두 듀레이션으로 구한 가격에 보정액을 더한다.'],
    'f-spot-forward': [true, '연복리에서 2년 현물투자의 누적 성장배수는 1년 현물투자와 1년 뒤 시작하는 1년 선도투자의 성장배수를 곱한 값이다.', '오늘부터 2년을 한 번에 투자한 결과를 ‘오늘부터 1년’과 ‘그다음 1년’으로 나눠 계산할 수 있다. 각 구간에서 원금이 몇 배가 되는지를 곱해야 같은 만기금액이 나온다.'],
    'f-currency-forward': [false, '원/달러 환율을 달러당 원으로 표시할 때, 같은 만기의 원화 금리가 달러 금리보다 높으면 커버드 금리평가선의 선도환율은 현물환율보다 낮다.', '달러당 원으로 표시한 1년 이론 선도환율은 현물환율 × (1 + 원화금리) ÷ (1 + 달러금리)다. 원화금리가 더 높으면 곱하는 비율이 1을 넘어 선도환율이 현물환율보다 높다.'],
    'f-call-delta': [false, '표준 콜옵션을 매수하면 델타는 통상 −1과 0 사이에 있다.', '기초자산가격이 오르면 정해진 가격에 살 권리는 더 유리해진다. 일반적인 콜 매수의 델타는 0에서 1 사이이고, 콜 매도는 부호가 반대다.'],
    'f-put-delta': [true, '표준 풋옵션을 매수하면 델타는 통상 −1과 0 사이에 있다.', '시장에서 비싸게 팔 수 있게 되면 정해진 가격에 팔 권리의 가치는 내려간다. 일반적인 풋 매수는 주가와 반대로 움직여 델타가 −1에서 0 사이다.'],
    'f-option-break-even': [false, '풋옵션의 만기 손익분기 기초자산가격은 행사가격에 풋옵션 프리미엄을 더한 값이다.', '풋을 사면 가격이 충분히 내려가야 처음 낸 돈을 되찾는다. 100에 팔 권리를 4에 샀다면 만기 시장가격이 96일 때 행사 이익 4가 프리미엄 4를 정확히 메운다.'],
    'f-put-call-parity': [true, '배당이 없고 만기 및 행사가격이 같은 유럽형 옵션에서 기초자산 매수와 풋 매수, 콜 매도를 합하면 만기에 행사가격만큼을 받는 채권을 복제한다.', '주가가 오르면 상대가 콜을 행사해 주식을 행사가격에 넘긴다. 주가가 떨어지면 내가 풋을 행사해 같은 가격에 판다. 만기에 확보되는 돈은 어느 쪽이든 행사가격이다.'],
    'f-geometric-return': [false, '수익률이 첫 기간 +20%, 다음 같은 길이의 기간 −20%이면 두 기간의 누적 수익률은 0%다.', '100만 원이 첫 기간에 20% 오르면 120만 원이다. 여기서 20% 내리면 96만 원이 남아 누적수익률은 −4%다. 오를 때와 내릴 때의 기준 금액이 다르다.'],
    'f-annual-mean': [true, '월 산술평균 초과수익률을 단순 연율화할 때에는 12를 곱한다.', '월평균 초과수익률을 산술적으로 1년 단위로 표시할 때는 12를 곱한다. 실제로 재투자한 누적 성과를 구할 때는 각 달의 성장배수를 곱해야 한다.'],
    'f-annual-sigma': [false, '월별 수익률 간 상관이 없을 때 월 표준편차를 연율화하려면 12를 곱한다.', '월별 수익률의 분산이 같고 서로 상관이 없으면 12개월 합의 분산은 12배다. 표준편차는 그 제곱근이므로 월 표준편차에 √12를 곱한다.'],
    'f-annual-sharpe': [false, '단순 연율화의 표준 가정에서 월 샤프비율을 연 샤프비율로 바꿀 때 12를 곱한다.', '월평균 초과수익률에는 12를, 월 표준편차에는 √12를 곱한다. 샤프비율은 전자를 후자로 나눈 값이므로 월 샤프비율 × √12가 된다.'],
    'f-cml': [true, '자본시장선의 가로축은 포트폴리오 수익률의 표준편차를 나타낸다.'],
    'f-sml': [false, '증권시장선의 기준수익률을 구할 때 위험 변수로 개별 자산의 표준편차를 사용한다.'],
    'f-beta': [true, '시장과의 공분산이 0이고 시장수익률 분산이 양수라면 그 자산의 베타는 0이다.'],
    'f-di-fifty': [true, '경기확산지수가 50보다 높으면 개선 항목이 우세한 것으로 읽는다.'],
    'f-bsi-hundred': [false, '기업경기실사지수에서 긍정 응답과 부정 응답의 비중이 같으면 지수는 50이다.'],
    'f-treynor-black': [false, '트레이너–블랙 모형의 초기 비중 지표는 알파를 시장수익률의 분산으로 나누어 구한다.'],
  };

  const numberContrasts = [
    ['r-rate25-loan', 'r-rate275-loan'],
    ['r-rate25-partner', 'r-rate275-partner'],
    ['r-isa9', 'r-isa99'],
    ['r-stock-small-sme', 'r-stock-small-other'],
    ['r-stock-large-low', 'r-stock-large-high'],
    ['r-stock-deriv-base', 'r-stock-deriv-flex'],
    ['r-realname45', 'r-realname90'],
    ['r-collect5y', 'r-collect10y'],
    ['r-isa200', 'r-isa400'],
    ['r-pension6m', 'r-pension9m'],
    ['r-credit12', 'r-credit132'],
    ['r-credit15', 'r-credit165'],
    ['r-withdraw15', 'r-withdraw165'],
    ['r-mmf5', 'r-mmf2'],
    ['r-mmfrp5', 'r-fundrp50'],
    ['r-report90', 'r-report5'],
    ['r-research1', 'r-research5'],
    ['r-joint5', 'r-joint10'],
    ['r-mbb30', 'r-mbb100'],
    ['r-shares10', 'r-shares20'],
    ['r-illegal1y', 'r-illegal5y'],
    ['r-withdraw15d', 'r-withdraw30d'],
    ['r-invest7d', 'r-loan14d'],
    ['r-board5t', 'r-board2t'],
    ['r-benefit50k', 'r-benefit200k'],
    ['r-fof20', 'r-fof50'],
    ['r-borrow200', 'r-lend100'],
    ['r-margin140', 'r-short105'],
    ['r-tender20d', 'r-tender60d'],
    ['r-discretion3mo', 'r-discretion2mo'],
  ];

  const reviewedConcepts = {
    'glossary-b0cc820a82565c3ba5a3': [false, '채권수익률곡선의 가로축은 각 채권의 최초 발행일이다.', '수익률곡선은 한 시점에 조건이 비슷한 채권들의 잔존만기와 수익률을 비교한다.'],
    'glossary-aaf109fa7c045eed3910': [true, '발행사가 새 주식을 해외 시장에 직접 상장하지 않고도 주식을 예탁해 그 권리를 표시하는 증권으로 해외 거래를 가능하게 할 수 있다.', '증권예탁증권은 예탁된 원증권에 관한 권리를 표시한다.'],
    'glossary-29a719e73ff66050d5c7': [true, '다른 사람의 토지를 정해진 범위에서 사용하게 하는 용익물권과 채권 회수를 보장하는 담보물권은 모두 제한물권에 들어간다.', '제한물권은 물건에 대한 지배 범위가 정해져 있다. 사용·수익과 담보가 대표 목적이다.'],
    'glossary-7705084688a02e3e3b3e': [false, '자본시장법상 두 회사의 규모가 같으면 같은 종류의 금융투자업으로 분류한다.', '분류 기준은 회사가 수행하는 경제적 기능이다. 투자매매업과 투자중개업은 거래에서 담당하는 역할이 다르다.'],
    'glossary-8178327a7ee3d6057047': [false, '한국 국적이 없으면 국내에 주소를 두더라도 소득세법상 항상 비거주자다.', '거주자 여부는 주소, 거소, 생활관계 등으로 판단한다. 외국 국적자도 요건을 충족하면 거주자가 될 수 있다.'],
    'glossary-24cfa7472329ee9722c4': [true, '금융투자업자가 가격 급변이나 거래상대방의 부도로 손실을 입는 상황에서도 지급능력을 유지할 수 있는지 파악하는 데 순자본비율을 활용한다.', '순자본비율제도는 금융투자업자의 위험 부담과 손실흡수 여력을 고려하는 자기자본규제다.'],
    'glossary-f996563cb665c88b481b': [false, '개인종합자산관리계좌의 신탁형과 중개형은 가입자 소득에 따른 세제혜택 유형이다.', '신탁형, 일임형, 중개형은 운용방식 구분이다. 일반형, 서민형, 농어민형은 세제혜택 적용 대상을 구분한다.'],
    'glossary-7408ea115cf67e6da600': [true, '금융소비자의 요청 없이 판매자가 먼저 전화를 걸어 실시간으로 계약 체결을 권유하면 불초청권유의 기본형에 해당한다.', '요청 여부와 방문·전화 등 실시간 대화 방식에 주목한다. 금지 범위와 예외는 상품 및 법정 요건에 따라 판단한다.'],
    'glossary-cb1184ec2b739162cd7b': [false, '불편기대이론은 미래 단기금리 기대에 별도의 유동성프리미엄을 더해 장기수익률을 설명한다.', '불편기대이론에서는 장기채 보유에 대한 별도의 유동성프리미엄을 두지 않는다.'],
    'glossary-6b2ad18cd98f6e78c50f': [true, '위탁자가 맡긴 돈의 운용대상이나 운용방법을 지정하면 특정금전신탁에 해당할 수 있다.', '특정 여부는 위탁자의 운용 지시를 기준으로 구분한다.'],
    'glossary-6113b175f0fc6db31549': [false, '불특정금전신탁에서는 위탁자가 운용방법을 지정해야 한다.', '불특정금전신탁은 위탁자가 운용대상이나 방법을 특정하지 않는 유형이다.'],
    'glossary-e7d50f9aba1c73acf377': [false, '비상장주식을 당사자끼리 사적으로 주고받는 거래는 모두 K-OTC 거래다.', 'K-OTC는 금융투자협회의 장외시장이다. 그 시장에 등록·지정된 종목을 시장 절차로 거래하는 경우를 가리킨다.'],
    'glossary-956c49a9e2bd274da4c5': [true, '한국 소재 부동산에서 생기는 임대소득은 국내원천소득이 될 수 있다.', '비거주자는 원칙적으로 한국 세법상 국내원천소득에 대해 과세대상이 된다.'],
    'glossary-3de9d3e6c1917539dfcb': [false, '국세징수권의 소멸시효가 중단된 경우 이미 흐른 기간은 중단 사유가 끝난 뒤의 기간과 합산한다.', '중단은 그때까지 진행된 시효의 효력을 없앤다. 법에서 정한 때부터 새로운 시효가 진행한다.'],
    'glossary-3ca73bd59fbca65cbe32': [true, '우상향 수익률곡선이 그대로 유지된다면 채권을 보유하며 잔존만기가 짧아질 때 더 낮은 수익률 구간으로 이동해 가격 효과를 얻을 수 있다.', '수익률곡선타기 전략은 만기 단축에 따라 곡선 위에서 이동하는 효과를 이용한다. 곡선의 형태가 변하면 결과도 달라진다.'],
    'glossary-587b00fd7d075f6b1584': [false, '양도소득과세표준은 계산된 양도소득세에서 기본공제를 빼서 구한다.', '양도소득금액에서 양도소득기본공제를 뺀 뒤, 그 과세표준에 세율을 적용한다.'],
    'glossary-18bb0e757e7e29d5672e': [false, '인덱싱을 하려면 지수 구성종목을 모두 편입하는 완전복제법만 사용할 수 있다.', '지수와 비슷한 성과를 내기 위해 대표 종목을 고르는 표본추출이나 최적화도 사용할 수 있다.'],
    'glossary-3863c3b8bb07dcdf19d1': [true, '벤치마크를 중심으로 포트폴리오를 구성하되 일부 종목과 비중을 차등해 초과수익을 목표로 하면 준액티브 전략에 해당할 수 있다.', '준액티브 전략은 벤치마크를 중심에 두면서 일부 능동적 판단을 더하는 방식이다.'],
    'glossary-6a16485f31a6434e22c1': [false, '기술적 분석에서 VR은 주어진 신뢰수준에서 발생할 수 있는 포트폴리오 손실액을 추정한다.', '거래량비율 VR은 상승일과 하락일의 거래량을 비교한다. 신뢰수준에 따른 손실액 지표는 VaR이다.'],
    'glossary-cf2a2076b1c463de6326': [true, '두 수익률이 각자의 평균을 기준으로 대체로 같은 방향으로 움직이면 공분산은 양수가 되는 경향이 있다.', '공분산은 두 편차의 곱을 평균해 함께 움직이는 방향을 측정한다.'],
    'glossary-864a92a7bb790f7bc045': [false, '법정신고기한 내 신고서를 한 번도 내지 않았다면 이후 첫 신고는 수정신고에 해당한다.', '법정기한을 넘긴 뒤 처음 내는 신고는 기한 후 신고다. 수정신고는 이미 낸 신고 내용을 바로잡는 절차다.'],
    'glossary-4b01e4c24cf14bf1c919': [true, '기초자산의 현재가격이 110원이고 행사가격이 100원인 콜옵션은 내가격이다.', '콜옵션은 행사가격에 살 수 있는 권리다. 지금 행사한다고 가정하면 10원의 양의 행사가치가 있다.'],
    'glossary-eabd8d463c797df60280': [true, '델타감마분석법은 선형 델타 효과와 함께 감마로 나타나는 가격의 곡률도 반영한다.', '델타감마분석법은 가격 변화의 1차 및 2차 효과를 사용해 포지션 가치를 근사한다.'],
    'glossary-3e628d2d7f21f09500bf': [false, '등가격 옵션은 만기 전에도 내재가치와 시간가치가 모두 반드시 0이다.', '현재가격과 행사가격이 같으면 내재가치는 0이다. 만기 전에는 앞으로 가격이 움직일 가능성으로 시간가치가 남을 수 있다.'],
    'glossary-48f8461aee078e70dc4f': [true, '단기 선물로 장기 헤지를 유지하면 다음 만기 계약으로 교체할 때 가격이나 유동성 조건이 바뀔 수 있다.', '롤오버위험은 계약을 계속 교체할 때 원하는 헤지의 조건과 효과가 달라질 수 있는 위험이다.'],
    'glossary-d0b09f421f2f6ab2d517': [true, '소득의 수입시기는 세법상 그 소득을 어느 과세기간에 귀속시킬지 정하는 데 쓰인다.', '세법상 수입시기는 소득 종류별 기준으로 정해지는 귀속 시점이다.'],
    'glossary-e2e735a06e2963693020': [false, '주식시장 이상현상이 과거 자료에서 관찰됐다면 같은 전략은 앞으로도 초과수익을 보장한다.', '발견된 패턴의 재현성과 실제 수익성은 위험, 거래비용, 표본기간에 따라 달라진다.'],
    'glossary-0acfb8ffb0bb37ac2d51': [true, '표본추출 인덱싱에서는 지수의 특성을 대표하는 일부 종목을 편입할 수 있다.', '지수와 비슷하게 움직이는 포트폴리오를 구성하기 위한 방법이다.'],
    'glossary-f757ca8907bad728d3e7': [false, '확정기여형 퇴직연금의 최종 퇴직급여는 적립금의 운용성과와 무관하게 확정된다.', '확정되는 항목은 사용자 부담금의 기준이다. 최종 퇴직급여에는 운용성과가 반영된다.'],
    'glossary-8e75489de1aaea1be970': [false, '주식워런트증권의 패리티는 그 증권을 매수한 날부터의 투자수익률을 뜻한다.', '패리티는 기초자산 가격과 행사가격의 관계를 나타낸다. 두 가격이 같으면 100%를 기준으로 읽는다.'],
    'glossary-455d28de40425076e28e': [true, '주가수익비율과 주가순자산비율이 낮아도 사업 전망이 악화된 상태라면 가치 함정일 수 있다.', '낮은 배수를 해석할 때 이익의 질과 지속 가능성, 재무상태를 함께 평가한다.'],
    'glossary-0c2708eb05ae62fad47d': [true, '녹아웃형 주가연계증권에서는 기초자산 가격이 약정 장벽에 도달할 때 수익을 확정하는 구조가 가능하다.', '장벽에 닿는 사건을 기준으로 약정 수익이나 기존 지급구조의 종료 여부가 정해진다.'],
    'glossary-7c6c4a273996024ad69a': [false, '부분가치평가법은 시장금리가 달라질 때마다 모든 포지션을 처음부터 다시 가격화한다.', '부분가치평가법은 민감도를 사용해 가치 변동을 근사한다. 각 포지션을 새로 평가하는 방식은 완전가치평가에 해당한다.'],
    'glossary-87682cfe910074a126c6': [true, '사다리형 채권 만기전략은 채권의 만기 도래 및 재투자 시점을 분산하는 효과가 있다.', '채권 만기를 여러 시점으로 나눠 자금이 한꺼번에 재투자되는 상황을 줄인다.'],
  };

  const formulaConcepts = {
    'glossary-0231574e40ea2df73769': ['f-current-yield'],
    'glossary-158643d2decab8165339': ['f-basis-point'],
    'glossary-2a3176b4b0456f18a6cb': ['f-te-ir'],
    'glossary-54ced2c66c1b0346383c': ['f-annual-sharpe'],
    'glossary-57b8c82ea47171881fcf': ['f-pi-one'],
    'glossary-5aad4f0a06701e836064': ['f-beta'],
    'glossary-73d7d9521ab270ccce44': ['f-correlation-range'],
    'glossary-d3ab46d7f932ca2e6f30': ['f-put-call-parity'],
    'glossary-d5f67fba2b4ec1bdcd29': ['f-call-delta', 'f-put-delta'],
    'glossary-d743fddfbc94c98f0372': ['f-irr-hurdle'],
    'glossary-df3c9184083b00098495': ['f-npv-zero'],
    'glossary-ea8d223951f4898c79a4': ['f-duration-modified'],
    'term-20d1ed90891ed1cc': ['f-cml'],
    'term-3f155088614b0ce0': ['f-duration-convexity'],
    'term-8a591af40b145e90': ['f-sml'],
    'term-992ff431126e75fe': ['f-pi-one'],
    'term-be2852eea6d856bc': ['f-annual-sharpe'],
    'term-c7433fdd5e77493e': ['f-te-ir'],
  };

  function reliefCheck(item, byId) {
    const match = item.id.match(/^r-(correct|late)-(window|rate)-(\d+)$/);
    if (!match) return null;
    const [, type, field, index] = match;
    const rate = byId.get(`r-${type}-rate-${index}`);
    if (!rate || !/^\d+%$/.test(rate.value) || !rate.trigger) return null;
    const process = type === 'correct' ? '수정신고' : '기한 후 신고';
    const penalty = type === 'correct' ? '과소신고가산세' : '무신고가산세';
    const previousRate = byId.get(`r-${type}-rate-${Number(index) - 1}`);
    const testRate = field === 'window' && previousRate ? previousRate : rate;
    return [
      testRate.value === rate.value,
      `${rate.trigger} ${process}를 하고 감면 요건을 충족하면 ${penalty}의 ${testRate.value}를 감면받는다.`,
    ];
  }

  function createRegistryCheck(item, byId, alternatives) {
    const authored = Object.hasOwn(reviewed, item.id) ? reviewed[item.id] : reliefCheck(item, byId);
    const alternate = alternatives.get(item.id);
    const useAlternate = alternate?.family === item.family && alternate.value !== item.value;
    const value = useAlternate ? alternate.value : item.value;
    const [answer, statement, authoredExplanation] = authored || [
      !useAlternate,
      `${item.title}에 적용하는 기본 기준은 ${value}이다.`,
    ];
    if (!item.rule?.trim() || !statement || !value) return [];
    const explanation = authoredExplanation || [item.rule.replace(/;\s*/g, '. '), item.contrast]
      .filter(Boolean).map(part => /[.!?]$/.test(part) ? part : part + '.').join(' ');
    return [{id: `dictionary-ox-${item.id}`, statement, answer, explanation}];
  }

  function create(terms, numbers, oxQuestions, choices = []) {
    const questions = oxQuestions.filter(validQuestion);
    const additionalByTerm = new Map();
    for (const question of questions) {
      for (const id of question.dictionaryIds || []) {
        const linked = additionalByTerm.get(id) || [];
        linked.push(question);
        additionalByTerm.set(id, linked);
      }
    }
    const conceptQuestions = collectConceptQuestions(
      terms, questions.filter(question => !question.dictionaryIds), choices);
    const registry = new Map(numbers.map(item => [item.id, item]));
    const alternatives = new Map();
    for (const [id, otherId] of numberContrasts) {
      if (registry.has(otherId)) alternatives.set(id, registry.get(otherId));
    }

    return item => {
      if (!item) return [];
      if (registry.has(item.id)) return createRegistryCheck(registry.get(item.id), registry, alternatives);
      const candidates = [...(conceptQuestions.get(item.id)?.values() || [])];
      if (Object.hasOwn(reviewedConcepts, item.id)) {
        const [answer, statement, explanation] = reviewedConcepts[item.id];
        const question = {id: `dictionary-ox-${item.id}`, answer, statement, explanation};
        candidates.push({question, score: 8});
      }
      for (const id of formulaConcepts[item.id] || []) {
        const formula = registry.get(id);
        if (!formula || !Object.hasOwn(reviewed, id)) continue;
        const [question] = createRegistryCheck(formula, registry, alternatives);
        if (question) candidates.push({question, score: 8});
      }
      candidates.sort((a, b) => b.score - a.score || a.question.id.localeCompare(b.question.id));
      const seen = new Set();
      const selected = [];
      function add({id, statement, answer, explanation}) {
        const key = sameStatement(statement);
        if (seen.has(key)) return;
        seen.add(key);
        selected.push({id, statement, answer, explanation});
      }
      for (const {question} of candidates) {
        add(question);
        if (selected.length === individualLimit && !/^c\d+$/.test(item.id)) break;
      }
      for (const question of additionalByTerm.get(item.id) || []) add(question);
      return selected;
    };
  }

  window.DictionaryOx = {create};
})();
