const translations = {
    ko: {
        "nav-home": "홈 (대시보드)",
        "nav-simple": "일반 복리",
        "nav-periodic": "적립식 복리",
        "nav-goal": "목표 자산 계산",
        "nav-kelly": "켈리 공식",
        "nav-avg": "평단가(물타기)",
        "nav-roi": "수익률/퍼센트",
        "nav-exchange": "환율",

        "history-title": "최근 계산 기록",
        "setting-currency": "화폐 단위",
        "setting-theme": "다크 모드",
        "setting-lang": "언어 (Language)",
        
        "home-title": "핀 파일럿",
        "home-desc": "주식 물타기 계산기, 평단가 계산기부터 복리 계산, 켈리 공식까지 — 필요한 계산기를 선택해 스마트한 금융 계획을 세워보세요.",
        "card-simple": "일반 복리 계산기",
        "card-periodic": "적립식 복리 (SIP)",
        "card-goal": "목표 자산 계산 (Goal)",
        "card-avg": "평단가 / 물타기",
        "card-kelly": "켈리 공식 최적화",
        "card-roi": "수익률 / 퍼센트",
        "card-exchange": "실시간 환율 변환",

        "avg-page-title": "평단가(물타기) 계산기",
        "avg-page-desc": "추가 매수 시 평균 단가와 수익률 변화를 실시간으로 시뮬레이션합니다.",
        "label-avg-current-price": "보유 평단가",
        "label-avg-current-qty": "보유 수량",
        "label-avg-market-price": "현재 시장가",
        "avg-inline-connector1": "으로",
        "avg-inline-connector2": "주 더 구매하면",
        "avg-compare-current": "현재 평균",
        "avg-compare-expected": "예상 평균",
        "result-avg-compare-title": "물타기 전 · 후 비교",
        "result-avg-chart-title": "매수 금액에 따른 평단가 곡선",
        "th-avg-metric": "항목",
        "th-avg-before": "현재 상태",
        "th-avg-after": "물타기 이후",
        "row-avg-price": "평단가",
        "row-avg-qty": "총 보유 수량",
        "row-avg-invested": "총 매수금액",
        "row-avg-pnl": "평가손익",
        "row-avg-roi": "수익률",

        "btn-calculate": "계산하기",
        "btn-back": "←",
        
        "label-principal": "초기 원금",
        "label-rate": "연 수익률 (%)",
        "label-years": "투자 기간 (년)",
        "label-addition": "월 적립액",
        
        "advanced-options": "고급 옵션 (세금, 물가상승률) ⚙️",
        "result-final": "최종 자산",
        "theory-72": "💡 72의 법칙",

        "simple-title": "일반 복리 계산기",
        "simple-desc": "초기 원금을 바탕으로 특정 수익률과 기간 동안의 자산 변화를 계산합니다.",
        "label-tax-rate": "세율 (%)",
        "label-inflation-rate": "물가상승률 (%)",
        "label-principal-colon": "원금:",
        "label-profit-colon": "수익금:",
        "btn-toggle-table": "상세 내역 표 보기/숨기기",
        "theory-72-desc": "자산이 2배가 되는 데 걸리는 시간(년) = 72 ÷ 연 수익률",

        "periodic-title": "적립식 복리 계산기",
        "periodic-desc": "매월 일정 금액을 꾸준히 투자할 때의 놀라운 복리 효과를 확인하세요.",
        "label-compound-frequency": "복리 주기",
        "option-monthly": "월 복리",
        "option-yearly": "연 복리",
        "option-semiannual": "반기 복리",
        "label-total-principal-colon": "총 납입 원금:",
        "label-total-profit-colon": "총 수익금:",

        "goal-title": "목표 자산 계산기 (Goal Planner)",
        "goal-desc": "원하는 목표 금액을 모으기 위해 매월 얼마를 투자해야 하는지 역산합니다.",
        "label-goal-target": "목표 금액",
        "label-goal-rate": "예상 연 수익률 (%)",
        "label-goal-current": "현재 보유 금액 (선택)",
        "btn-goal-calculate": "월 적립액 계산하기",
        "result-goal-monthly": "필요한 월 적립액",
        "label-compound-profit-colon": "복리 수익:",

        "kelly-title": "켈리 공식 계산기",
        "kelly-desc": "승률과 손익비를 바탕으로 파산 위험을 최소화하고 수익을 극대화하는 최적의 투자 비중을 계산합니다.",
        "label-kelly-win-rate": "승률 (%)",
        "label-kelly-profit": "예상 이익 (이길 때 얻는 비율)",
        "label-kelly-loss": "예상 손실 (질 때 잃는 비율)",
        "theory-kelly-title": "💡 손익비 (Risk/Reward Ratio)",
        "theory-kelly-desc": "손익비 = 예상 이익 ÷ 예상 손실 · 켈리 공식을 통한 투자는 승률과 손익비가 유리할 때만 의미가 있습니다.",
        "result-kelly-title": "최적 투자 비중 (전체 자산 대비)",
        "kelly-msg-negative": "기대 수익이 마이너스이거나 너무 낮습니다. 투자를 권장하지 않습니다.",
        "kelly-msg-half": "안정성을 위해 Half-Kelly ({value}%) 비중을 추천합니다.",

        "roi-title": "수익률 및 퍼센트 계산기",
        "roi-desc": "투자 금액 대비 수익률을 계산하거나 기본적인 퍼센트 비율을 확인합니다.",
        "roi-section-title": "수익률 계산",
        "label-roi-invested": "투자 원금",
        "label-roi-current": "현재 자산 (또는 매도 금액)",
        "btn-roi-calculate": "수익률 계산",
        "pct-section-title": "퍼센트 할인/증가 계산",
        "placeholder-pct-base": "기준 금액",
        "pct-of": "의",
        "pct-is": "% 는?",
        "btn-pct-calculate": "퍼센트 계산",
        "result-roi-title": "수익률 결과",
        "result-pct-title": "퍼센트 결과",

        "exchange-title": "환율 계산기",
        "exchange-desc": "통화 간 변환을 계산합니다. 실시간 환율을 반영하거나 직접 입력할 수 있습니다.",
        "exchange-section-title": "환율 변환",
        "exchange-manual-input": "직접 입력",
        "label-exchange-from": "보내는 금액",
        "label-exchange-to": "받는 통화",
        "label-manual-rate": "적용 환율 (1 기준통화 당)",
        "btn-exchange-calculate": "변환하기",
        "result-exchange-title": "변환 결과",
        "exchange-info-loading": "최신 환율 정보를 가져오는 중...",
        "exchange-info-updated": "최신 환율 업데이트: {date}",
        "exchange-info-failed": "환율을 가져오는데 실패했습니다. 직접 입력을 사용해주세요.",
        "exchange-rate-manual": "(직접 입력 환율 적용)",
        "exchange-rate-live": "(실시간 환율: 1 {from} = {rate} {to})",

        "table-year": "년도",
        "table-principal": "납입 원금",
        "table-profit-pretax": "세전 수익금",
        "table-profit-posttax": "세후 수익금",
        "table-final-asset": "최종 자산",

        "unit-year": "년",
        "footer-disclaimer": "모든 계산 결과는 참고용이며 투자 판단의 근거가 될 수 없습니다. 실제 투자에 대한 책임은 투자자 본인에게 있습니다.",
        "footer-rights": "All rights reserved.",

        "ticker-loading": "실시간 데이터를 불러오는 중...",
        "ticker-kospi": "코스피",
        "ticker-kosdaq": "코스닥",
        "ticker-nasdaq": "나스닥",
        "ticker-sp500": "S&P 500",
        "ticker-dow": "다우존스",
        "ticker-usdkrw": "환율 (USD/KRW)",
        "ticker-delayed": "(지연)",
        "unit-won": "원"
    },
    en: {
        "nav-home": "Home (Dashboard)",
        "nav-simple": "Simple Compound",
        "nav-periodic": "SIP Compound",
        "nav-goal": "Goal Planner",
        "nav-kelly": "Kelly Criterion",
        "nav-avg": "Average Price",
        "nav-roi": "ROI / Percent",
        "nav-exchange": "Exchange Rate",

        "history-title": "Recent History",
        "setting-currency": "Currency",
        "setting-theme": "Dark Mode",
        "setting-lang": "Language",
        
        "home-title": "핀 파일럿",
        "home-desc": "From a stock average down calculator and average price calculator to compound interest and the Kelly criterion — choose the tool you need and build a smarter financial plan.",
        "card-simple": "Simple Compound",
        "card-periodic": "SIP Compound",
        "card-goal": "Goal Planner",
        "card-avg": "Average Price",
        "card-kelly": "Kelly Criterion",
        "card-roi": "ROI / Percent",
        "card-exchange": "Exchange Rate",

        "avg-page-title": "Average Down Calculator",
        "avg-page-desc": "Simulate how your average price and return change in real time as you buy more.",
        "label-avg-current-price": "Average Price Held",
        "label-avg-current-qty": "Shares Held",
        "label-avg-market-price": "Current Market Price",
        "avg-inline-connector1": "invested buys",
        "avg-inline-connector2": "more shares",
        "avg-compare-current": "Current Average",
        "avg-compare-expected": "Expected Average",
        "result-avg-compare-title": "Before vs. After Averaging Down",
        "result-avg-chart-title": "Average Price Curve by Purchase Amount",
        "th-avg-metric": "Metric",
        "th-avg-before": "Current",
        "th-avg-after": "After Averaging Down",
        "row-avg-price": "Average Price",
        "row-avg-qty": "Total Shares",
        "row-avg-invested": "Total Invested",
        "row-avg-pnl": "Unrealized P&L",
        "row-avg-roi": "Return",

        "btn-calculate": "Calculate",
        "btn-back": "←",
        
        "label-principal": "Initial Principal",
        "label-rate": "Annual Rate (%)",
        "label-years": "Investment Years",
        "label-addition": "Monthly Addition",
        
        "advanced-options": "Advanced Options (Tax, Inflation) ⚙️",
        "result-final": "Final Asset",
        "theory-72": "💡 Rule of 72",

        "simple-title": "Simple Compound Calculator",
        "simple-desc": "Calculate how your assets change over time at a given rate of return, based on your initial principal.",
        "label-tax-rate": "Tax Rate (%)",
        "label-inflation-rate": "Inflation Rate (%)",
        "label-principal-colon": "Principal:",
        "label-profit-colon": "Profit:",
        "btn-toggle-table": "Show/Hide Detailed Table",
        "theory-72-desc": "Years to double your money = 72 ÷ annual rate of return",

        "periodic-title": "SIP Compound Calculator",
        "periodic-desc": "See the remarkable compounding effect of investing a fixed amount every month.",
        "label-compound-frequency": "Compounding Frequency",
        "option-monthly": "Monthly",
        "option-yearly": "Yearly",
        "option-semiannual": "Semi-annual",
        "label-total-principal-colon": "Total Principal:",
        "label-total-profit-colon": "Total Profit:",

        "goal-title": "Goal Planner",
        "goal-desc": "Work backward to find how much you need to invest monthly to reach your target amount.",
        "label-goal-target": "Target Amount",
        "label-goal-rate": "Expected Annual Rate (%)",
        "label-goal-current": "Current Holdings (optional)",
        "btn-goal-calculate": "Calculate Monthly Contribution",
        "result-goal-monthly": "Required Monthly Contribution",
        "label-compound-profit-colon": "Compound Profit:",

        "kelly-title": "Kelly Criterion Calculator",
        "kelly-desc": "Calculate the optimal position size that minimizes ruin risk and maximizes returns, based on win rate and payoff ratio.",
        "label-kelly-win-rate": "Win Rate (%)",
        "label-kelly-profit": "Expected Gain (ratio when winning)",
        "label-kelly-loss": "Expected Loss (ratio when losing)",
        "theory-kelly-title": "💡 Risk/Reward Ratio",
        "theory-kelly-desc": "Risk/Reward Ratio = Expected Gain ÷ Expected Loss · The Kelly Criterion is only meaningful when both your win rate and risk/reward ratio are favorable.",
        "result-kelly-title": "Optimal Position Size (of Total Assets)",
        "kelly-msg-negative": "Expected return is negative or too low. Investing is not recommended.",
        "kelly-msg-half": "For stability, a Half-Kelly ({value}%) allocation is recommended.",

        "roi-title": "Return & Percentage Calculator",
        "roi-desc": "Calculate your return on investment or a basic percentage ratio.",
        "roi-section-title": "Return Calculation",
        "label-roi-invested": "Amount Invested",
        "label-roi-current": "Current Value (or Sale Amount)",
        "btn-roi-calculate": "Calculate Return",
        "pct-section-title": "Percentage Discount/Increase",
        "placeholder-pct-base": "Base Amount",
        "pct-of": "of",
        "pct-is": "is?",
        "btn-pct-calculate": "Calculate Percentage",
        "result-roi-title": "Return Result",
        "result-pct-title": "Percentage Result",

        "exchange-title": "Exchange Rate Calculator",
        "exchange-desc": "Convert between currencies using live rates or your own manual rate.",
        "exchange-section-title": "Currency Conversion",
        "exchange-manual-input": "Manual Rate",
        "label-exchange-from": "Amount to Send",
        "label-exchange-to": "Receiving Currency",
        "label-manual-rate": "Applied Rate (per 1 base currency)",
        "btn-exchange-calculate": "Convert",
        "result-exchange-title": "Conversion Result",
        "exchange-info-loading": "Fetching the latest exchange rates...",
        "exchange-info-updated": "Rates last updated: {date}",
        "exchange-info-failed": "Failed to fetch exchange rates. Please use manual input.",
        "exchange-rate-manual": "(Using manually entered rate)",
        "exchange-rate-live": "(Live rate: 1 {from} = {rate} {to})",

        "table-year": "Year",
        "table-principal": "Principal Paid",
        "table-profit-pretax": "Pre-tax Profit",
        "table-profit-posttax": "Post-tax Profit",
        "table-final-asset": "Final Asset",

        "unit-year": "yr",
        "footer-disclaimer": "All calculation results are for reference only and do not constitute investment advice. You are solely responsible for your own investment decisions.",
        "footer-rights": "All rights reserved.",

        "ticker-loading": "Loading live market data...",
        "ticker-kospi": "KOSPI",
        "ticker-kosdaq": "KOSDAQ",
        "ticker-nasdaq": "NASDAQ",
        "ticker-sp500": "S&P 500",
        "ticker-dow": "Dow Jones",
        "ticker-usdkrw": "USD/KRW",
        "ticker-delayed": "(delayed)",
        "unit-won": " KRW"
    },
    ja: {
        "nav-home": "ホーム (ダッシュボード)",
        "nav-simple": "単利複利",
        "nav-periodic": "積立複利",
        "nav-goal": "目標資産計算",
        "nav-kelly": "ケリー基準",
        "nav-avg": "平均取得単価",
        "nav-roi": "利回り/パーセント",
        "nav-exchange": "為替レート",

        "history-title": "最近の計算履歴",
        "setting-currency": "通貨",
        "setting-theme": "ダークモード",
        "setting-lang": "言語 (Language)",
        
        "home-title": "핀 파일럿",
        "home-desc": "株式ナンピン計算機や平均取得単価計算機から、複利計算、ケリー基準まで。必要な計算機を選んで、スマートな資産形成を始めましょう。",
        "card-simple": "一般複利計算機",
        "card-periodic": "積立複利 (SIP)",
        "card-goal": "目標資産計算",
        "card-avg": "平均取得単価",
        "card-kelly": "ケリー最適化",
        "card-roi": "利回り / パーセント",
        "card-exchange": "リアルタイム為替変換",

        "avg-page-title": "ナンピン(平均取得単価)計算機",
        "avg-page-desc": "追加購入時の平均取得単価と収益率の変化をリアルタイムでシミュレーションします。",
        "label-avg-current-price": "保有平均単価",
        "label-avg-current-qty": "保有数量",
        "label-avg-market-price": "現在の市場価格",
        "avg-inline-connector1": "で",
        "avg-inline-connector2": "株を追加購入すると",
        "avg-compare-current": "現在の平均",
        "avg-compare-expected": "予想平均",
        "result-avg-compare-title": "ナンピン前後の比較",
        "result-avg-chart-title": "購入金額による平均単価の変化",
        "th-avg-metric": "項目",
        "th-avg-before": "現在の状態",
        "th-avg-after": "ナンピン後",
        "row-avg-price": "平均単価",
        "row-avg-qty": "総保有数量",
        "row-avg-invested": "総購入金額",
        "row-avg-pnl": "評価損益",
        "row-avg-roi": "収益率",

        "btn-calculate": "計算する",
        "btn-back": "←",
        
        "label-principal": "初期元本",
        "label-rate": "年利 (%)",
        "label-years": "投資期間 (年)",
        "label-addition": "月額積立金",
        
        "advanced-options": "詳細オプション (税金, インフレ) ⚙️",
        "result-final": "最終資産",
        "theory-72": "💡 72の法則",

        "simple-title": "一般複利計算機",
        "simple-desc": "初期元本をもとに、特定の収益率と期間における資産の変化を計算します。",
        "label-tax-rate": "税率 (%)",
        "label-inflation-rate": "インフレ率 (%)",
        "label-principal-colon": "元本:",
        "label-profit-colon": "収益金:",
        "btn-toggle-table": "詳細テーブルの表示/非表示",
        "theory-72-desc": "資産が2倍になるまでの年数 = 72 ÷ 年利回り",

        "periodic-title": "積立複利計算機",
        "periodic-desc": "毎月一定額を積み立てたときの驚きの複利効果を確認しましょう。",
        "label-compound-frequency": "複利周期",
        "option-monthly": "月複利",
        "option-yearly": "年複利",
        "option-semiannual": "半期複利",
        "label-total-principal-colon": "総積立元本:",
        "label-total-profit-colon": "総収益金:",

        "goal-title": "目標資産計算機 (Goal Planner)",
        "goal-desc": "目標金額を貯めるために毎月いくら投資すべきかを逆算します。",
        "label-goal-target": "目標金額",
        "label-goal-rate": "予想年利回り (%)",
        "label-goal-current": "現在の保有金額（任意）",
        "btn-goal-calculate": "月積立額を計算する",
        "result-goal-monthly": "必要な月積立額",
        "label-compound-profit-colon": "複利収益:",

        "kelly-title": "ケリー基準計算機",
        "kelly-desc": "勝率と損益比をもとに、破産リスクを最小化しつつ収益を最大化する最適な投資比率を計算します。",
        "label-kelly-win-rate": "勝率 (%)",
        "label-kelly-profit": "予想利益（勝った時の倍率）",
        "label-kelly-loss": "予想損失（負けた時の倍率）",
        "theory-kelly-title": "💡 損益比 (Risk/Reward Ratio)",
        "theory-kelly-desc": "損益比 = 予想利益 ÷ 予想損失 · ケリー基準は勝率と損益比の両方が有利な場合にのみ意味を持ちます。",
        "result-kelly-title": "最適投資比率（総資産に対する割合）",
        "kelly-msg-negative": "期待収益がマイナス、または低すぎます。投資はお勧めできません。",
        "kelly-msg-half": "安定性のため、ハーフケリー（{value}%）の比率をお勧めします。",

        "roi-title": "利回り・パーセント計算機",
        "roi-desc": "投資金額に対する利回りを計算したり、基本的なパーセント比率を確認します。",
        "roi-section-title": "利回り計算",
        "label-roi-invested": "投資元本",
        "label-roi-current": "現在の資産（または売却金額）",
        "btn-roi-calculate": "利回りを計算する",
        "pct-section-title": "パーセント割引・増加計算",
        "placeholder-pct-base": "基準金額",
        "pct-of": "の",
        "pct-is": "% は?",
        "btn-pct-calculate": "パーセントを計算する",
        "result-roi-title": "利回り結果",
        "result-pct-title": "パーセント結果",

        "exchange-title": "為替計算機",
        "exchange-desc": "通貨間の変換を計算します。リアルタイム為替を反映するか、直接入力できます。",
        "exchange-section-title": "為替変換",
        "exchange-manual-input": "直接入力",
        "label-exchange-from": "送る金額",
        "label-exchange-to": "受け取る通貨",
        "label-manual-rate": "適用為替レート（基準通貨1単位あたり）",
        "btn-exchange-calculate": "変換する",
        "result-exchange-title": "変換結果",
        "exchange-info-loading": "最新の為替情報を取得しています...",
        "exchange-info-updated": "最新レート更新: {date}",
        "exchange-info-failed": "為替レートの取得に失敗しました。直接入力をご利用ください。",
        "exchange-rate-manual": "（直接入力レートを適用）",
        "exchange-rate-live": "（リアルタイムレート: 1 {from} = {rate} {to}）",

        "table-year": "年度",
        "table-principal": "積立元本",
        "table-profit-pretax": "税引前収益",
        "table-profit-posttax": "税引後収益",
        "table-final-asset": "最終資産",

        "unit-year": "年目",
        "footer-disclaimer": "すべての計算結果は参考用であり、投資判断の根拠にはなりません。実際の投資に関する責任は投資者ご本人にあります。",
        "footer-rights": "All rights reserved.",

        "ticker-loading": "リアルタイムデータを取得中...",
        "ticker-kospi": "コスピ指数",
        "ticker-kosdaq": "コスダック指数",
        "ticker-nasdaq": "NASDAQ",
        "ticker-sp500": "S&P 500",
        "ticker-dow": "ダウ平均",
        "ticker-usdkrw": "為替 (USD/KRW)",
        "ticker-delayed": "(遅延)",
        "unit-won": "ウォン"
    },
    zh: {
        "nav-home": "首页 (仪表盘)",
        "nav-simple": "普通复利",
        "nav-periodic": "定投复利",
        "nav-goal": "目标资产计算",
        "nav-kelly": "凯利公式",
        "nav-avg": "平均成本",
        "nav-roi": "收益率/百分比",
        "nav-exchange": "汇率",

        "history-title": "最近计算记录",
        "setting-currency": "货币",
        "setting-theme": "深色模式",
        "setting-lang": "语言 (Language)",
        
        "home-title": "핀 파일럿",
        "home-desc": "从股票补仓计算器、平均成本计算器,到复利计算和凯利公式——选择您需要的工具,开启智能理财规划。",
        "card-simple": "普通复利计算器",
        "card-periodic": "定投复利 (SIP)",
        "card-goal": "目标资产计算",
        "card-avg": "平均成本 / 加仓",
        "card-kelly": "凯利公式优化",
        "card-roi": "收益率 / 百分比",
        "card-exchange": "实时汇率转换",

        "avg-page-title": "补仓(摊薄成本)计算器",
        "avg-page-desc": "实时模拟追加买入后平均成本和收益率的变化。",
        "label-avg-current-price": "持仓平均成本",
        "label-avg-current-qty": "持仓数量",
        "label-avg-market-price": "当前市场价",
        "avg-inline-connector1": "可买入",
        "avg-inline-connector2": "股",
        "avg-compare-current": "当前平均",
        "avg-compare-expected": "预期平均",
        "result-avg-compare-title": "补仓前后对比",
        "result-avg-chart-title": "买入金额对应的平均成本曲线",
        "th-avg-metric": "项目",
        "th-avg-before": "当前状态",
        "th-avg-after": "补仓之后",
        "row-avg-price": "平均成本",
        "row-avg-qty": "总持仓数量",
        "row-avg-invested": "总买入金额",
        "row-avg-pnl": "浮动盈亏",
        "row-avg-roi": "收益率",

        "btn-calculate": "计算",
        "btn-back": "←",
        
        "label-principal": "初始本金",
        "label-rate": "年化收益率 (%)",
        "label-years": "投资年限",
        "label-addition": "每月定投",
        
        "advanced-options": "高级选项 (税收, 通胀) ⚙️",
        "result-final": "最终资产",
        "theory-72": "💡 72法则",

        "simple-title": "普通复利计算器",
        "simple-desc": "根据初始本金，计算特定收益率和期限内的资产变化。",
        "label-tax-rate": "税率 (%)",
        "label-inflation-rate": "通货膨胀率 (%)",
        "label-principal-colon": "本金:",
        "label-profit-colon": "收益金:",
        "btn-toggle-table": "显示/隐藏详细表格",
        "theory-72-desc": "资产翻倍所需时间(年) = 72 ÷ 年收益率",

        "periodic-title": "定投复利计算器",
        "periodic-desc": "查看每月定额投资带来的惊人复利效果。",
        "label-compound-frequency": "复利周期",
        "option-monthly": "月复利",
        "option-yearly": "年复利",
        "option-semiannual": "半年复利",
        "label-total-principal-colon": "总投入本金:",
        "label-total-profit-colon": "总收益金:",

        "goal-title": "目标资产计算器 (Goal Planner)",
        "goal-desc": "反向计算为达成目标金额，每月需要投资多少。",
        "label-goal-target": "目标金额",
        "label-goal-rate": "预期年收益率 (%)",
        "label-goal-current": "当前持有金额（可选）",
        "btn-goal-calculate": "计算每月定投金额",
        "result-goal-monthly": "所需每月定投金额",
        "label-compound-profit-colon": "复利收益:",

        "kelly-title": "凯利公式计算器",
        "kelly-desc": "根据胜率和盈亏比，计算能将破产风险降到最低、收益最大化的最优仓位比例。",
        "label-kelly-win-rate": "胜率 (%)",
        "label-kelly-profit": "预期收益（获胜时的倍数）",
        "label-kelly-loss": "预期损失（失败时的倍数）",
        "theory-kelly-title": "💡 盈亏比 (Risk/Reward Ratio)",
        "theory-kelly-desc": "盈亏比 = 预期收益 ÷ 预期损失 · 只有当胜率和盈亏比都有利时，凯利公式的投资才有意义。",
        "result-kelly-title": "最优仓位比例（占总资产）",
        "kelly-msg-negative": "预期收益为负或过低，不建议投资。",
        "kelly-msg-half": "为稳健起见，建议采用半凯利（{value}%）仓位。",

        "roi-title": "收益率与百分比计算器",
        "roi-desc": "计算投资金额的收益率，或进行基本的百分比换算。",
        "roi-section-title": "收益率计算",
        "label-roi-invested": "投资本金",
        "label-roi-current": "当前资产（或卖出金额）",
        "btn-roi-calculate": "计算收益率",
        "pct-section-title": "百分比折扣/增长计算",
        "placeholder-pct-base": "基准金额",
        "pct-of": "的",
        "pct-is": "% 是多少?",
        "btn-pct-calculate": "计算百分比",
        "result-roi-title": "收益率结果",
        "result-pct-title": "百分比结果",

        "exchange-title": "汇率计算器",
        "exchange-desc": "计算货币之间的兑换，可使用实时汇率或手动输入汇率。",
        "exchange-section-title": "汇率转换",
        "exchange-manual-input": "手动输入",
        "label-exchange-from": "汇出金额",
        "label-exchange-to": "接收货币",
        "label-manual-rate": "适用汇率（每1单位基准货币）",
        "btn-exchange-calculate": "转换",
        "result-exchange-title": "转换结果",
        "exchange-info-loading": "正在获取最新汇率信息...",
        "exchange-info-updated": "汇率更新时间: {date}",
        "exchange-info-failed": "获取汇率失败，请使用手动输入。",
        "exchange-rate-manual": "（应用手动输入汇率）",
        "exchange-rate-live": "（实时汇率: 1 {from} = {rate} {to}）",

        "table-year": "年度",
        "table-principal": "投入本金",
        "table-profit-pretax": "税前收益",
        "table-profit-posttax": "税后收益",
        "table-final-asset": "最终资产",

        "unit-year": "年",
        "footer-disclaimer": "所有计算结果仅供参考,不构成投资建议。实际投资的责任由投资者本人承担。",
        "footer-rights": "All rights reserved.",

        "ticker-loading": "正在获取实时数据...",
        "ticker-kospi": "韩国综合指数",
        "ticker-kosdaq": "韩国创业板指数",
        "ticker-nasdaq": "纳斯达克",
        "ticker-sp500": "标普500",
        "ticker-dow": "道琼斯",
        "ticker-usdkrw": "汇率 (USD/KRW)",
        "ticker-delayed": "(延迟)",
        "unit-won": "韩元"
    }
};

// 현재 선택된 언어 조회 (탭/계산기 JS에서 동적 텍스트를 만들 때 사용)
window.getCurrentLang = function () {
    return localStorage.getItem('fincalc_lang') || 'ko';
};

// 번역 헬퍼: translations에 없는 키는 한국어 -> 키 순으로 폴백, {token} 치환 지원
window.t = function (key, params) {
    const lang = window.getCurrentLang();
    let str = (translations[lang] && translations[lang][key])
        || (translations.ko && translations.ko[key])
        || key;

    if (params) {
        Object.keys(params).forEach(token => {
            str = str.replace(new RegExp('\\{' + token + '\\}', 'g'), params[token]);
        });
    }
    return str;
};

function changeLanguage(lang) {
    if (!translations[lang]) return;

    // Save to localStorage
    localStorage.setItem('fincalc_lang', lang);
    
    // Update DOM elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang][key]) {
            // Keep specific formatting if needed, or simply replace textContent
            // For inputs, we might want to update placeholders
            if (el.tagName === 'INPUT' && el.type !== 'button') {
                el.placeholder = translations[lang][key];
            } else {
                // If it contains child elements (like span for icons), we should be careful.
                // For simplicity, we just replace innerText if it's a simple element.
                // In a robust app, we'd use innerHTML or specifically target text nodes.
                
                // Check if element has child nodes that are elements
                let hasElementChildren = false;
                for (let i=0; i<el.childNodes.length; i++) {
                    if (el.childNodes[i].nodeType === 1) { // ELEMENT_NODE
                        hasElementChildren = true;
                        break;
                    }
                }
                
                if (!hasElementChildren) {
                    el.innerText = translations[lang][key];
                } else {
                    // For buttons with icons or mixed content, this is tricky.
                    // For this basic setup, we'll assume most data-i18n elements are simple text containers.
                    // Alternatively, we can use a wrapper span for the text inside.
                    el.innerText = translations[lang][key];
                }
            }
        }
    });
    
    // Update document language
    document.documentElement.lang = lang;
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('fincalc_lang') || 'ko';
    
    const langSelect = document.getElementById('lang-select');
    const mobileLangSelect = document.getElementById('mobile-lang-select');
    
    function updateLangSelects(val) {
        if (langSelect) langSelect.value = val;
        if (mobileLangSelect) mobileLangSelect.value = val;
    }

    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            changeLanguage(e.target.value);
            updateLangSelects(e.target.value);
        });
    }
    
    if (mobileLangSelect) {
        mobileLangSelect.addEventListener('change', (e) => {
            changeLanguage(e.target.value);
            updateLangSelects(e.target.value);
        });
    }
    
    updateLangSelects(savedLang);
    
    // Apply initial language
    if (savedLang !== 'ko') {
        changeLanguage(savedLang);
    }
});
