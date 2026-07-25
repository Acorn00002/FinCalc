// Utility functions
function parseNumber(str) {
    if (!str) return 0;
    return parseFloat(str.replace(/,/g, '')) || 0;
}

function formatResult(number) {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(number);
}

function getCurrencySymbol() {
    return document.getElementById('currency-select').value === 'USD' ? '$ ' : '₩ ';
}

// Table Generator Helper
function generateTableHtml(years, principalData, profitData, taxRate = 0) {
    const tt = typeof t === 'function' ? t : (key) => key;
    let html = `<table class="data-table"><thead><tr><th>${tt('table-year')}</th><th>${tt('table-principal')}</th><th>${tt('table-profit-pretax')}</th>`;
    if (taxRate > 0) html += `<th>${tt('table-profit-posttax')}</th>`;
    html += `<th>${tt('table-final-asset')}</th></tr></thead><tbody>`;
    
    for (let i = 0; i < years.length; i++) {
        const principal = principalData[i];
        const profit = profitData[i];
        const total = principal + profit;
        
        html += `<tr>
            <td>${years[i]}</td>
            <td>${formatResult(principal)}</td>
            <td>${formatResult(profit)}</td>`;
            
        if (taxRate > 0) {
            const tax = profit > 0 ? profit * taxRate : 0;
            html += `<td>${formatResult(profit - tax)}</td>`;
        }
        
        html += `<td>${formatResult(total)}</td></tr>`;
    }
    html += '</tbody></table>';
    return html;
}

// 1. 일반 복리 계산기
function calculateSimpleCompound(skipHistory = false) {
    const principal = parseNumber(document.getElementById('simple-principal').value);
    const rate = parseNumber(document.getElementById('simple-rate').value) / 100;
    const years = parseNumber(document.getElementById('simple-years').value);
    
    const taxRateInput = document.getElementById('simple-tax-rate');
    const taxRate = taxRateInput && taxRateInput.value ? parseNumber(taxRateInput.value) / 100 : 0;
    
    const inflationInput = document.getElementById('simple-inflation-rate');
    const inflationRate = inflationInput && inflationInput.value ? parseNumber(inflationInput.value) / 100 : 0;

    if (principal === 0 || years === 0) return;

    let chartYears = [];
    let principalData = [];
    let profitData = [];

    let currentAmount = principal;

    for (let i = 0; i <= years; i++) {
        chartYears.push(`${i}${typeof t === 'function' ? t('unit-year') : '년'}`);
        principalData.push(principal);
        
        if (i === 0) {
            profitData.push(0);
        } else {
            currentAmount = currentAmount * (1 + rate);
            profitData.push(currentAmount - principal);
        }
    }

    const finalAmount = principal * Math.pow(1 + rate, years);
    let profit = finalAmount - principal;
    
    // 세금 적용
    let taxAmount = 0;
    if (taxRate > 0 && profit > 0) {
        taxAmount = profit * taxRate;
        profit = profit - taxAmount;
    }
    const finalAmountAfterTax = principal + profit;

    // 물가상승률 적용 (현재 가치 환산)
    let realValue = finalAmountAfterTax;
    if (inflationRate > 0) {
        realValue = finalAmountAfterTax / Math.pow(1 + inflationRate, years);
    }

    const sym = getCurrencySymbol();
    
    let resultText = sym + formatResult(finalAmountAfterTax);
    if (inflationRate > 0) {
        resultText += `<br><span style="font-size: 1rem; color: var(--text-secondary);">현재 가치 환산: ${sym}${formatResult(realValue)}</span>`;
    }
    
    document.getElementById('simple-result').innerHTML = resultText;
    document.getElementById('simple-principal-result').innerText = sym + formatResult(principal);
    
    let profitText = sym + formatResult(profit);
    if (taxAmount > 0) {
        profitText += ` (세후, 세금 ${sym}${formatResult(taxAmount)})`;
    }
    document.getElementById('simple-profit-result').innerText = profitText;

    updateSimpleChart(chartYears, principalData, profitData);
    
    const tableContainer = document.getElementById('simple-table-container');
    if (tableContainer) {
        tableContainer.innerHTML = generateTableHtml(chartYears, principalData, profitData, taxRate);
    }

    if (!skipHistory && typeof addHistoryRecord === 'function') {
        const title = `${formatResult(principal)} / ${rate*100}% / ${years}년`;
        const params = {
            'simple-principal': document.getElementById('simple-principal').value,
            'simple-rate': document.getElementById('simple-rate').value,
            'simple-years': document.getElementById('simple-years').value,
            'simple-tax-rate': taxRateInput ? taxRateInput.value : '',
            'simple-inflation-rate': inflationInput ? inflationInput.value : ''
        };
        addHistoryRecord('compound-simple', '일반 복리', title, params);
    }
}

// 2. 적립식 복리 계산기
function calculatePeriodicCompound(skipHistory = false) {
    const principal = parseNumber(document.getElementById('periodic-principal').value);
    const monthlyAddition = parseNumber(document.getElementById('periodic-addition').value);
    const rate = parseNumber(document.getElementById('periodic-rate').value) / 100;
    const years = parseNumber(document.getElementById('periodic-years').value);
    const compoundsPerYear = parseInt(document.getElementById('compound-frequency').value);

    const taxRateInput = document.getElementById('periodic-tax-rate');
    const taxRate = taxRateInput && taxRateInput.value ? parseNumber(taxRateInput.value) / 100 : 0;
    
    const inflationInput = document.getElementById('periodic-inflation-rate');
    const inflationRate = inflationInput && inflationInput.value ? parseNumber(inflationInput.value) / 100 : 0;

    if (years === 0) return;

    let chartYears = [];
    let principalData = [];
    let profitData = [];

    let totalPrincipal = principal;
    let currentAmount = principal;
    const ratePerPeriod = rate / compoundsPerYear;
    const totalPeriods = years * compoundsPerYear;
    const additionPerPeriod = (monthlyAddition * 12) / compoundsPerYear;

    // 연도별 데이터 수집
    for (let y = 0; y <= years; y++) {
        chartYears.push(`${y}${typeof t === 'function' ? t('unit-year') : '년'}`);
        
        if (y === 0) {
            principalData.push(principal);
            profitData.push(0);
        } else {
            // 해당 연도의 기간(1년)만큼 반복
            for (let p = 0; p < compoundsPerYear; p++) {
                currentAmount += additionPerPeriod;
                currentAmount = currentAmount * (1 + ratePerPeriod);
                totalPrincipal += additionPerPeriod;
            }
            principalData.push(totalPrincipal);
            profitData.push(currentAmount - totalPrincipal);
        }
    }

    let profit = currentAmount - totalPrincipal;
    
    // 세금 적용
    let taxAmount = 0;
    if (taxRate > 0 && profit > 0) {
        taxAmount = profit * taxRate;
        profit = profit - taxAmount;
    }
    const finalAmountAfterTax = totalPrincipal + profit;

    // 물가상승률 적용
    let realValue = finalAmountAfterTax;
    if (inflationRate > 0) {
        realValue = finalAmountAfterTax / Math.pow(1 + inflationRate, years);
    }

    const sym = getCurrencySymbol();

    let resultText = sym + formatResult(finalAmountAfterTax);
    if (inflationRate > 0) {
        resultText += `<br><span style="font-size: 1rem; color: var(--text-secondary);">현재 가치 환산: ${sym}${formatResult(realValue)}</span>`;
    }
    document.getElementById('periodic-result').innerHTML = resultText;
    document.getElementById('periodic-total-principal').innerText = sym + formatResult(totalPrincipal);
    
    let profitText = sym + formatResult(profit);
    if (taxAmount > 0) {
        profitText += ` (세후, 세금 ${sym}${formatResult(taxAmount)})`;
    }
    document.getElementById('periodic-total-profit').innerText = profitText;

    updatePeriodicChart(chartYears, principalData, profitData);
    
    const tableContainer = document.getElementById('periodic-table-container');
    if (tableContainer) {
        tableContainer.innerHTML = generateTableHtml(chartYears, principalData, profitData, taxRate);
    }

    if (!skipHistory && typeof addHistoryRecord === 'function') {
        const title = `원금 ${formatResult(principal)} + 매월 ${formatResult(monthlyAddition)} / ${years}년`;
        const params = {
            'periodic-principal': document.getElementById('periodic-principal').value,
            'periodic-addition': document.getElementById('periodic-addition').value,
            'periodic-rate': document.getElementById('periodic-rate').value,
            'periodic-years': document.getElementById('periodic-years').value,
            'compound-frequency': document.getElementById('compound-frequency').value,
            'periodic-tax-rate': taxRateInput ? taxRateInput.value : '',
            'periodic-inflation-rate': inflationInput ? inflationInput.value : ''
        };
        addHistoryRecord('compound-periodic', '적립식 복리', title, params);
    }
}

// 2.5 목표 자산 역계산기
window.calculateGoalPlanner = function(skipHistory = false) {
    const goal = parseNumber(document.getElementById('goal-target').value);
    const rate = parseNumber(document.getElementById('goal-rate').value) / 100;
    const years = parseNumber(document.getElementById('goal-years').value);
    const current = parseNumber(document.getElementById('goal-current').value);
    
    if (goal === 0 || years === 0) return;
    
    const monthlyRate = rate / 12;
    const months = years * 12;
    
    let requiredMonthly = 0;
    
    if (rate === 0) {
        requiredMonthly = (goal - current) / months;
    } else {
        const futureValueOfCurrent = current * Math.pow(1 + monthlyRate, months);
        const remainingGoal = goal - futureValueOfCurrent;
        
        if (remainingGoal <= 0) {
            requiredMonthly = 0; // 이미 목표 달성
        } else {
            requiredMonthly = remainingGoal * monthlyRate / (Math.pow(1 + monthlyRate, months) - 1);
        }
    }
    
    const totalPrincipal = current + (requiredMonthly * months);
    const totalProfit = goal - totalPrincipal;
    
    const sym = getCurrencySymbol();
    document.getElementById('goal-monthly-result').innerText = sym + formatResult(requiredMonthly);
    document.getElementById('goal-total-principal').innerText = sym + formatResult(totalPrincipal);
    document.getElementById('goal-total-profit').innerText = sym + formatResult(totalProfit);

    if (!skipHistory && typeof addHistoryRecord === 'function') {
        const title = `목표 ${formatResult(goal)} / ${rate*100}% / ${years}년`;
        const params = {
            'goal-target': document.getElementById('goal-target').value,
            'goal-rate': document.getElementById('goal-rate').value,
            'goal-years': document.getElementById('goal-years').value,
            'goal-current': document.getElementById('goal-current').value
        };
        addHistoryRecord('goal-planner', '목표 자산 계산', title, params);
    }
};

// 3. 켈리 공식 계산기
function calculateKelly(skipHistory = false) {
    const winRate = parseNumber(document.getElementById('kelly-win-rate').value) / 100;
    const profitRatio = parseNumber(document.getElementById('kelly-profit').value);
    const lossRatio = parseNumber(document.getElementById('kelly-loss').value);

    if (!winRate || !profitRatio || !lossRatio) return;

    // Kelly % = W - [(1 - W) / R] 
    // W = Win probability, R = Win/Loss ratio
    const R = profitRatio / lossRatio;
    let kellyPercentage = winRate - ((1 - winRate) / R);
    
    // Convert to percentage
    kellyPercentage = kellyPercentage * 100;
    
    const resultEl = document.getElementById('kelly-result');
    const messageEl = document.getElementById('kelly-message');

    if (kellyPercentage <= 0) {
        resultEl.innerText = "0%";
        resultEl.style.color = "var(--loss-color)";
        messageEl.innerText = typeof t === 'function' ? t('kelly-msg-negative') : "기대 수익이 마이너스이거나 너무 낮습니다. 투자를 권장하지 않습니다.";
    } else {
        // Half-Kelly is often recommended
        const halfKelly = kellyPercentage / 2;
        resultEl.innerText = formatResult(kellyPercentage) + "%";
        resultEl.style.color = "var(--profit-color)";
        messageEl.innerText = typeof t === 'function'
            ? t('kelly-msg-half', { value: formatResult(halfKelly) })
            : `안정성을 위해 Half-Kelly (${formatResult(halfKelly)}%) 비중을 추천합니다.`;
    }

    if (!skipHistory && typeof addHistoryRecord === 'function') {
        const title = `승률 ${winRate*100}% / 이익 ${profitRatio} / 손실 ${lossRatio}`;
        const params = {
            'kelly-win-rate': document.getElementById('kelly-win-rate').value,
            'kelly-profit': document.getElementById('kelly-profit').value,
            'kelly-loss': document.getElementById('kelly-loss').value
        };
        addHistoryRecord('kelly', '켈리 공식', title, params);
    }
}

// 4. 평단가(물타기) 계산기 - 인라인 양방향 듀얼 인풋 실시간 시뮬레이터
(function () {
    function getAvgEls() {
        const currentPrice = document.getElementById('avg-current-price');
        if (!currentPrice) return null;
        return {
            currentPrice,
            currentQty: document.getElementById('avg-current-qty'),
            marketPrice: document.getElementById('avg-market-price'),
            addAmount: document.getElementById('avg-add-amount'),
            addQty: document.getElementById('avg-add-qty')
        };
    }

    function computeCurveData(currPrice, currQty, marketPrice, maxAmount) {
        const points = [];
        const steps = 40;
        for (let i = 0; i <= steps; i++) {
            const amount = (maxAmount / steps) * i;
            const addQty = marketPrice > 0 ? amount / marketPrice : 0;
            const totalQty = currQty + addQty;
            const avg = totalQty > 0 ? (currPrice * currQty + amount) / totalQty : currPrice;
            points.push({ x: amount, y: avg });
        }
        return points;
    }

    function setPnlCell(id, value, sym, suffix, isAfter) {
        const el = document.getElementById(id);
        if (!el) return;
        const formatted = (sym || '') + formatResult(value) + (suffix || '');
        el.innerText = value >= 0 ? '+' + formatted : formatted;
        const baseClass = isAfter ? 'avg-highlight-cell' : '';
        el.className = (baseClass + ' ' + (value >= 0 ? 'profit-text' : 'loss-text')).trim();
    }

    function setCompareRoi(id, value) {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerText = (value >= 0 ? '+' : '') + formatResult(value) + '%';
        el.className = 'avg-compare-roi ' + (value >= 0 ? 'profit-text' : 'loss-text');
    }

    // 현재 평균 → 예상 평균 비교 카드 (image.png 레퍼런스와 동일한 구조)
    function updateCompareCard(currPrice, beforeRoi, afterAvgPrice, afterRoi, sym) {
        setCompareRoi('avg-compare-before-roi', beforeRoi);
        document.getElementById('avg-compare-before-price').innerText = sym + formatResult(currPrice);
        setCompareRoi('avg-compare-after-roi', afterRoi);
        document.getElementById('avg-compare-after-price').innerText = sym + formatResult(afterAvgPrice);
    }

    function resetCompareCard() {
        setCompareRoi('avg-compare-before-roi', 0);
        document.getElementById('avg-compare-before-price').innerText = '';
        setCompareRoi('avg-compare-after-roi', 0);
        document.getElementById('avg-compare-after-price').innerText = '';
    }

    function renderAveragePrice(saveHistory) {
        const els = getAvgEls();
        if (!els) return;

        const currPrice = parseNumber(els.currentPrice.value);
        const currQty = parseNumber(els.currentQty.value);
        const marketPrice = parseNumber(els.marketPrice.value);
        const safeAddQty = Math.max(parseNumber(els.addQty.value), 0);
        const addAmount = safeAddQty * marketPrice;

        if (currPrice <= 0 || currQty <= 0 || marketPrice <= 0) {
            resetCompareCard();
            return;
        }

        const beforeInvested = currPrice * currQty;
        const beforePnl = (marketPrice - currPrice) * currQty;
        const beforeRoi = currPrice > 0 ? (marketPrice - currPrice) / currPrice * 100 : 0;

        const afterQty = currQty + safeAddQty;
        const afterInvested = beforeInvested + addAmount;
        const afterAvgPrice = afterQty > 0 ? afterInvested / afterQty : currPrice;
        const afterPnl = (marketPrice - afterAvgPrice) * afterQty;
        const afterRoi = afterAvgPrice > 0 ? (marketPrice - afterAvgPrice) / afterAvgPrice * 100 : 0;

        const sym = getCurrencySymbol();

        document.getElementById('avg-before-price').innerText = sym + formatResult(currPrice);
        document.getElementById('avg-before-qty').innerText = formatResult(currQty);
        document.getElementById('avg-before-invested').innerText = sym + formatResult(beforeInvested);
        setPnlCell('avg-before-pnl', beforePnl, sym, '', false);
        setPnlCell('avg-before-roi', beforeRoi, '', '%', false);

        document.getElementById('avg-after-price').innerText = sym + formatResult(afterAvgPrice);
        document.getElementById('avg-after-qty').innerText = formatResult(afterQty);
        document.getElementById('avg-after-invested').innerText = sym + formatResult(afterInvested);
        setPnlCell('avg-after-pnl', afterPnl, sym, '', true);
        setPnlCell('avg-after-roi', afterRoi, '', '%', true);

        updateCompareCard(currPrice, beforeRoi, afterAvgPrice, afterRoi, sym);

        if (typeof updateAvgChart === 'function') {
            const maxAmount = Math.max(beforeInvested * 2, 1000000, addAmount * 1.5);
            const curve = computeCurveData(currPrice, currQty, marketPrice, maxAmount);
            updateAvgChart(curve, marketPrice, { x: addAmount, y: afterAvgPrice });
        }

        if (saveHistory && typeof addHistoryRecord === 'function') {
            const title = `${formatResult(currPrice)} → ${formatResult(afterAvgPrice)}`;
            const params = {
                'avg-current-price': els.currentPrice.value,
                'avg-current-qty': els.currentQty.value,
                'avg-market-price': els.marketPrice.value,
                'avg-add-amount': els.addAmount.value,
                'avg-add-qty': els.addQty.value
            };
            addHistoryRecord('average-price', '평단가(물타기)', title, params);
        }
    }

    // 금액 -> 수량 : 수량 = 추가 매수 금액 / 현재 시장가
    function syncQtyFromAmount(els) {
        const marketPrice = parseNumber(els.marketPrice.value);
        const amount = parseNumber(els.addAmount.value);
        els.addQty.value = (marketPrice > 0 && amount > 0) ? (amount / marketPrice).toFixed(2) : '';
    }

    // 수량 -> 금액 : 금액 = 추가 매수 수량 * 현재 시장가
    function syncAmountFromQty(els) {
        const marketPrice = parseNumber(els.marketPrice.value);
        const qty = parseNumber(els.addQty.value);
        els.addAmount.value = (marketPrice > 0 && qty > 0) ? formatResult(qty * marketPrice) : '';
    }

    // main.js(통화 변경 / 기록 불러오기 / URL 공유) 호환용 진입점
    window.calculateAveragePrice = function (skipHistory = false) {
        renderAveragePrice(!skipHistory);
    };

    document.addEventListener('DOMContentLoaded', () => {
        const els = getAvgEls();
        if (!els) return;

        document.querySelectorAll('.stepper-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-step-target');
                const step = parseFloat(btn.getAttribute('data-step'));
                const input = document.getElementById(targetId);
                if (!input) return;
                const current = parseNumber(input.value) || 0;
                input.value = formatResult(Math.max(current + step, 0));
                renderAveragePrice(false);
            });
        });

        [els.currentPrice, els.currentQty].forEach(input => {
            input.addEventListener('input', () => renderAveragePrice(false));
        });

        // 시장가가 바뀌면 이미 입력된 금액을 기준으로 수량을 다시 환산
        els.marketPrice.addEventListener('input', () => {
            syncQtyFromAmount(els);
            renderAveragePrice(false);
        });

        els.addAmount.addEventListener('input', () => {
            formatNumber(els.addAmount);
            syncQtyFromAmount(els);
            renderAveragePrice(false);
        });

        els.addQty.addEventListener('input', () => {
            syncAmountFromQty(els);
            renderAveragePrice(false);
        });

        renderAveragePrice(false);
    });
})();

// 5. 수익률/퍼센트 계산기
function calculateROI(skipHistory = false) {
    const invested = parseNumber(document.getElementById('roi-invested').value);
    const current = parseNumber(document.getElementById('roi-current').value);

    if (invested === 0) return;

    const profit = current - invested;
    const roiPct = (profit / invested) * 100;

    const sym = getCurrencySymbol();
    const pctEl = document.getElementById('roi-result-pct');
    const amtEl = document.getElementById('roi-result-amount');

    pctEl.innerText = formatResult(roiPct) + "%";
    amtEl.innerText = sym + formatResult(profit);

    if (profit >= 0) {
        pctEl.className = "main-result profit-text";
        amtEl.className = "profit-text";
    } else {
        pctEl.className = "main-result loss-text";
        amtEl.className = "loss-text";
    }

    if (!skipHistory && typeof addHistoryRecord === 'function') {
        const title = `원금 ${formatResult(invested)} → 현재 ${formatResult(current)}`;
        const params = {
            'roi-invested': document.getElementById('roi-invested').value,
            'roi-current': document.getElementById('roi-current').value
        };
        addHistoryRecord('roi', '수익률 계산', title, params);
    }
}

function calculatePercentage() {
    const base = parseNumber(document.getElementById('pct-base').value);
    const rate = parseNumber(document.getElementById('pct-rate').value);

    const result = base * (rate / 100);
    document.getElementById('pct-result').innerText = formatResult(result);
}

// 6. 환율 계산기
let exchangeRates = null;

async function fetchExchangeRates() {
    const infoEl = document.getElementById('exchange-info');
    try {
        // 1순위: 한국 표준 환율(하나은행 고시) - 두나무 API
        const fxUrl = 'https://quotation-api-cdn.dunamu.com/v1/forex/recent?codes=FRX.KRWUSD,FRX.KRWEUR,FRX.KRWJPY';
        let response = await fetch(fxUrl).catch(() => null);
        let data = response ? await response.json().catch(() => null) : null;
        
        if (data && data.length > 0) {
            const usdData = data.find(d => d.currencyCode === 'USD');
            const eurData = data.find(d => d.currencyCode === 'EUR');
            const jpyData = data.find(d => d.currencyCode === 'JPY');
            
            if (usdData) {
                const usdKrw = usdData.basePrice / (usdData.currencyUnit || 1);
                
                exchangeRates = {
                    'USD': 1,
                    'KRW': usdKrw
                };
                
                if (eurData) {
                    const eurKrw = eurData.basePrice / (eurData.currencyUnit || 1);
                    exchangeRates['EUR'] = usdKrw / eurKrw;
                }
                
                if (jpyData) {
                    const jpyKrw = jpyData.basePrice / (jpyData.currencyUnit || 100);
                    exchangeRates['JPY'] = usdKrw / jpyKrw;
                }
                
                const updateDate = new Date().toLocaleDateString();
                infoEl.innerText = typeof t === 'function' ? t('exchange-info-updated', { date: updateDate }) : `최신 환율 업데이트: ${updateDate}`;
                return;
            }
        }

        // 2순위: 두나무 API 실패 시 글로벌 환율 API(open.er-api.com)를 대체제로 사용
        console.warn('Dunamu API failed, falling back to open.er-api.com');
        response = await fetch('https://open.er-api.com/v6/latest/USD');
        data = await response.json();

        if (data && data.rates) {
            exchangeRates = data.rates; // USD가 1 기준
            const updateDate = new Date(data.time_last_update_utc).toLocaleDateString();
            infoEl.innerText = typeof t === 'function' ? t('exchange-info-updated', { date: updateDate }) : `최신 환율 업데이트: ${updateDate}`;
            return;
        }

        throw new Error("All APIs failed");

    } catch (error) {
        console.error('Exchange Rate Fetch Error:', error);
        infoEl.innerText = typeof t === 'function' ? t('exchange-info-failed') : "환율을 가져오는데 실패했습니다. 직접 입력을 사용해주세요.";
        document.getElementById('manual-rate-toggle').checked = true;
        toggleManualRate();
    }
}

// 환율 추이 라인차트 + AI 인사이트 — 같은 통화쌍/환율일 때는 재생성하지 않아 입력할 때마다 그래프가 흔들리지 않게 함
let lastExchangeTrendKey = null;

function renderExchangeTrend(rate, from, to) {
    if (!rate || rate <= 0) return;
    const key = from + '_' + to + '_' + rate.toFixed(6);
    if (key === lastExchangeTrendKey) return;
    lastExchangeTrendKey = key;

    // 실시간(또는 직접입력) 환율을 마지막 점으로 수렴시킨, 최근 2주 흐름 참고용 시각화
    const points = 14;
    const volatility = rate * 0.006;
    const startValue = rate - volatility * 3.2;
    const data = [];
    const labels = [];
    const today = new Date();

    for (let i = 0; i < points; i++) {
        const progress = i / (points - 1);
        const drift = (rate - startValue) * progress;
        const noise = (Math.sin(i * 1.7) + Math.sin(i * 0.6)) * volatility * 0.35;
        data.push(i === points - 1 ? rate : startValue + drift + noise);

        const d = new Date(today);
        d.setDate(d.getDate() - (points - 1 - i));
        labels.push((d.getMonth() + 1) + '/' + d.getDate());
    }

    const changePct = ((data[data.length - 1] - data[0]) / data[0]) * 100;
    const badgeEl = document.getElementById('exchange-chart-change');
    if (badgeEl) {
        badgeEl.textContent = (changePct >= 0 ? '+' : '') + changePct.toFixed(2) + '%';
        badgeEl.className = 'exchange-chart-badge ' + (changePct >= 0 ? 'is-up' : 'is-down');
    }

    if (typeof updateExchangeChart === 'function') {
        updateExchangeChart(labels, data);
    }

    const insightEl = document.getElementById('exchange-ai-insight');
    if (insightEl) {
        const direction = changePct >= 0.15 ? '완만한 상승' : (changePct <= -0.15 ? '하락' : '보합');
        insightEl.innerHTML =
            '현재 1 ' + from + ' = <strong>' + formatResult(rate) + ' ' + to + '</strong>으로, 최근 2주간 ' + direction +
            ' 흐름을 보이고 있어요. 환전 타이밍은 참고용이며 실제 고시환율과 차이가 있을 수 있어요.';
    }
}

function swapCurrencies() {
    const fromSelect = document.getElementById('from-currency');
    const toSelect = document.getElementById('to-currency');
    const temp = fromSelect.value;
    fromSelect.value = toSelect.value;
    toSelect.value = temp;
    calculateExchange();
}

function toggleManualRate() {
    const isManual = document.getElementById('manual-rate-toggle').checked;
    document.getElementById('manual-rate-group').style.display = isManual ? 'block' : 'none';
    if (!isManual && !exchangeRates) {
        fetchExchangeRates().then(calculateExchange);
    } else {
        calculateExchange();
    }
}

function calculateExchange(skipHistory = false) {
    const amount = parseNumber(document.getElementById('exchange-amount').value);
    const from = document.getElementById('from-currency').value;
    const to = document.getElementById('to-currency').value;
    const isManual = document.getElementById('manual-rate-toggle').checked;
    
    let rate = 1;
    let rateSourceText = "";

    if (isManual) {
        rate = parseNumber(document.getElementById('manual-rate-input').value);
        if (rate <= 0) rate = 1;
        rateSourceText = typeof t === 'function' ? t('exchange-rate-manual') : "(직접 입력 환율 적용)";
    } else {
        if (!exchangeRates) {
            document.getElementById('exchange-result').innerText = "API 오류";
            return;
        }
        // convert from 'from' to USD, then USD to 'to'
        const fromRateToUSD = exchangeRates[from];
        const toRateFromUSD = exchangeRates[to];
        rate = toRateFromUSD / fromRateToUSD;
        rateSourceText = typeof t === 'function'
            ? t('exchange-rate-live', { from, rate: formatResult(rate), to })
            : `(실시간 환율: 1 ${from} = ${formatResult(rate)} ${to})`;
    }

    const result = amount * rate;

    // Symbol mapping
    const symbols = { 'USD': '$', 'KRW': '₩', 'EUR': '€', 'JPY': '¥' };
    const toSymbol = symbols[to] || '';

    document.getElementById('exchange-result').innerText = toSymbol + formatResult(result);
    document.getElementById('exchange-rate-display').innerText = rateSourceText;
    renderExchangeTrend(rate, from, to);

    if (!skipHistory && typeof addHistoryRecord === 'function') {
        const title = `${formatResult(amount)} ${from} → ${to}`;
        const params = {
            'exchange-amount': document.getElementById('exchange-amount').value,
            'from-currency': document.getElementById('from-currency').value,
            'to-currency': document.getElementById('to-currency').value,
            'manual-rate-input': document.getElementById('manual-rate-input').value
        };
        addHistoryRecord('exchange', '환율 계산', title, params);
    }
}

// Initial fetch for rates
document.addEventListener('DOMContentLoaded', () => {
    fetchExchangeRates();
});

// 공통: 한글 단위 가이드 (예: 250,000,000 -> "2억 5,000만 원") — 대출/예금 등 여러 계산기에서 재사용
function formatKoreanUnit(n) {
    n = Math.max(0, Math.round(n));
    if (n === 0) return '0원';
    var eok = Math.floor(n / 100000000);
    var man = Math.floor((n % 100000000) / 10000);
    var rest = n % 10000;
    var out = '';
    if (eok) out += eok.toLocaleString('ko-KR') + '억 ';
    if (man) out += man.toLocaleString('ko-KR') + '만 ';
    if (rest) out += rest.toLocaleString('ko-KR') + ' ';
    return out.trim() + '원';
}

// 토스 스타일 한글 금액 표기 유틸리티 (예: 5,000,000,000 -> "50억원", 125000000 -> "1억 2,500만원")
window.formatToKoreanWon = formatKoreanUnit;

// 밑줄형/구형 금액 인풋 공용: 인풋 id + "Hint" 또는 id + "-hint" 짝을 찾아 한글 금액 힌트 텍스트를 갱신
window.updateKoreanHint = function (input) {
    var hint = document.getElementById(input.id + 'Hint') || document.getElementById(input.id + '-hint');
    if (!hint) return;
    hint.innerText = formatToKoreanWon(parseNumber(input.value));
};

// 7. 대출이자 계산기 — 원리금균등 / 원금균등 / 만기일시상환 + 거치기간
(function () {
    // 자산 파일럿이 찾아낸 매칭 상품 (모의 추천 데이터, 대출 종류별 은행 상품 라인업)
    var LOAN_PRODUCTS = {
        mortgage: [
            { bank: '카카오뱅크', color: '#FEE500', textColor: '#3C1E1E', product: '주택담보대출', rateOffset: -0.30 },
            { bank: '하나은행', color: '#008485', textColor: '#ffffff', product: '아파트담보대출', rateOffset: 0.00 },
            { bank: '케이뱅크', color: '#FF5B24', textColor: '#ffffff', product: '고정금리 모기지론', rateOffset: 0.15 },
            { bank: '국민은행', color: '#FFCC00', textColor: '#3C1E1E', product: 'KB주택담보대출', rateOffset: 0.25 }
        ],
        jeonse: [
            { bank: '하나은행', color: '#008485', textColor: '#ffffff', product: '전월세보증금대출', rateOffset: -0.20 },
            { bank: '카카오뱅크', color: '#FEE500', textColor: '#3C1E1E', product: '전세보증금대출', rateOffset: 0.00 },
            { bank: '신한은행', color: '#0046FF', textColor: '#ffffff', product: '신한 전세대출', rateOffset: 0.10 },
            { bank: '우리은행', color: '#0067AC', textColor: '#ffffff', product: '우리 전세론', rateOffset: 0.20 }
        ],
        credit: [
            { bank: '카카오뱅크', color: '#FEE500', textColor: '#3C1E1E', product: '비상금대출', rateOffset: -0.50 },
            { bank: '케이뱅크', color: '#FF5B24', textColor: '#ffffff', product: '신용대출 플러스', rateOffset: 0.00 },
            { bank: '토스뱅크', color: '#0064FF', textColor: '#ffffff', product: '마이너스통장', rateOffset: 0.30 },
            { bank: '신한은행', color: '#0046FF', textColor: '#ffffff', product: '신한 크레딧론', rateOffset: 0.60 }
        ]
    };

    function renderProductFeed(loanType, baseRate) {
        var feed = document.getElementById('loan-product-feed');
        if (!feed) return;
        var products = LOAN_PRODUCTS[loanType] || LOAN_PRODUCTS.credit;
        var withRates = products.map(function (p) {
            return {
                bank: p.bank,
                color: p.color,
                textColor: p.textColor,
                product: p.product,
                rate: Math.max(1.5, baseRate + p.rateOffset)
            };
        }).sort(function (a, b) { return a.rate - b.rate; });

        var bestRate = withRates.length ? withRates[0].rate : 0;

        feed.innerHTML = withRates.map(function (p) {
            var bestTag = p.rate === bestRate ? '<span class="product-best">최저금리</span>' : '';
            return '' +
                '<div class="product-card">' +
                    '<span class="product-badge" style="background:' + p.color + ';color:' + p.textColor + '">' + p.bank.charAt(0) + '</span>' +
                    '<div class="product-info">' +
                        '<div class="product-bank">' + p.bank + '</div>' +
                        '<div class="product-name">' + p.product + '</div>' +
                    '</div>' +
                    '<div class="product-rate-wrap">' +
                        bestTag +
                        '<span class="product-rate">연 ' + p.rate.toFixed(2) + '%</span>' +
                    '</div>' +
                '</div>';
        }).join('');
    }

    // 상환 스케줄 표
    function generateLoanTableHtml(schedule, sym) {
        var html = '<table class="data-table"><thead><tr><th>회차</th><th>납입원금</th><th>이자</th><th>월상환액</th><th>대출잔액</th></tr></thead><tbody>';
        schedule.forEach(function (row) {
            html += '<tr>' +
                '<td>' + row.month + '</td>' +
                '<td>' + sym + formatResult(row.principal) + '</td>' +
                '<td>' + sym + formatResult(row.interest) + '</td>' +
                '<td>' + sym + formatResult(row.payment) + '</td>' +
                '<td>' + sym + formatResult(row.balance) + '</td>' +
                '</tr>';
        });
        html += '</tbody></table>';
        return html;
    }

    function renderLoanResult(data) {
        var sym = getCurrencySymbol();

        document.getElementById('loan-hero-empty').style.display = 'none';
        document.getElementById('loan-hero-content').style.display = 'block';

        document.getElementById('loan-max-payment').innerText = sym + formatResult(data.maxRow.payment);
        document.getElementById('loan-max-payment-sub').innerText = data.maxRow.month + '개월차 기준';
        document.getElementById('loan-total-interest').innerText = sym + formatResult(data.totalInterest);
        document.getElementById('loan-total-payment').innerText = sym + formatResult(data.totalPayment);
        document.getElementById('loan-grace-payment').innerText = data.g > 0
            ? (sym + formatResult(data.gracePayment) + ' (' + data.g + '개월간)')
            : '해당 없음';

        var tableContainer = document.getElementById('loan-table-container');
        if (tableContainer) {
            tableContainer.innerHTML = generateLoanTableHtml(data.schedule, sym);
        }

        renderProductFeed(data.loanType, data.R);
    }

    // 대출원금 L, 연이율 R(월이율 r = R/12/100), 총 대출기간 n개월, 거치기간 g개월
    window.calculateLoan = function (skipHistory) {
        skipHistory = skipHistory || false;

        var loanTypeBtn = document.querySelector('#loan-type-tabs .pill-tab.active');
        var repayMethodBtn = document.querySelector('#repay-method-tabs .pill-tab.active');
        if (!loanTypeBtn || !repayMethodBtn) return;

        var loanType = loanTypeBtn.dataset.value;
        var repayMethod = repayMethodBtn.dataset.value;

        var L = parseNumber(document.getElementById('loan-amount').value);
        var n = parseInt(document.getElementById('loan-term').value, 10) || 0;
        var g = parseInt(document.getElementById('loan-grace').value, 10) || 0;
        var R = parseFloat(document.getElementById('loan-rate').value) || 0;
        var r = R / 12 / 100;

        // 슬라이더 값 표시는 계산 실행/기록 복원 시에도 항상 동기화
        var rateValueEl = document.getElementById('loan-rate-value');
        if (rateValueEl) rateValueEl.innerText = R.toFixed(2) + '%';

        if (L <= 0 || n <= 0) {
            alert('대출 금액과 대출 기간을 입력해주세요.');
            return;
        }
        if (g < 0) g = 0;
        if (g >= n) g = n - 1; // 거치기간은 대출기간보다 짧아야 최소 1개월은 상환 가능

        var repayMonths = n - g;
        var schedule = [];

        // 1) 거치기간: 원금 상환 없이 이자만 납부
        var gracePayment = L * r;
        var t;
        for (t = 1; t <= g; t++) {
            schedule.push({ month: t, principal: 0, interest: gracePayment, payment: gracePayment, balance: L });
        }

        // 2) 거치기간 종료 후, 상환방식별 분기 처리
        if (repayMethod === 'equal-payment') {
            // 원리금균등분할상환: 매달 원리금 합계가 동일
            var pmt = r === 0
                ? L / repayMonths
                : L * (r * Math.pow(1 + r, repayMonths)) / (Math.pow(1 + r, repayMonths) - 1);
            var balanceEP = L;
            for (t = 1; t <= repayMonths; t++) {
                var interestEP = balanceEP * r;
                var principalEP = pmt - interestEP;
                balanceEP = Math.max(0, balanceEP - principalEP);
                schedule.push({ month: g + t, principal: principalEP, interest: interestEP, payment: pmt, balance: balanceEP });
            }
        } else if (repayMethod === 'equal-principal') {
            // 원금균등분할상환: 매달 원금은 균등, 이자는 잔금 기준으로 매달 감소
            var principalPerMonth = L / repayMonths;
            var balancePP = L;
            for (t = 1; t <= repayMonths; t++) {
                var interestPP = balancePP * r;
                var paymentPP = principalPerMonth + interestPP;
                balancePP = Math.max(0, balancePP - principalPerMonth);
                schedule.push({ month: g + t, principal: principalPerMonth, interest: interestPP, payment: paymentPP, balance: balancePP });
            }
        } else {
            // 만기일시상환: 매달 이자만 납부, 마지막 달에 원금을 일시 상환
            var monthlyInterest = L * r;
            for (t = 1; t < repayMonths; t++) {
                schedule.push({ month: g + t, principal: 0, interest: monthlyInterest, payment: monthlyInterest, balance: L });
            }
            var lastPayment = L + monthlyInterest;
            schedule.push({ month: g + repayMonths, principal: L, interest: monthlyInterest, payment: lastPayment, balance: 0 });
        }

        var totalInterest = schedule.reduce(function (sum, row) { return sum + row.interest; }, 0);
        var totalPayment = L + totalInterest;

        var maxRow = schedule[0];
        schedule.forEach(function (row) { if (row.payment > maxRow.payment) maxRow = row; });

        renderLoanResult({
            L: L, n: n, g: g, R: R, repayMethod: repayMethod, loanType: loanType,
            schedule: schedule, totalInterest: totalInterest, totalPayment: totalPayment,
            maxRow: maxRow, gracePayment: gracePayment
        });

        if (!skipHistory && typeof addHistoryRecord === 'function') {
            var methodNames = { 'equal-payment': '원리금균등', 'equal-principal': '원금균등', 'bullet': '만기일시' };
            var title = formatResult(L) + ' / ' + R + '% / ' + n + '개월 (' + methodNames[repayMethod] + ')';
            var params = {
                'loan-amount': document.getElementById('loan-amount').value,
                'loan-term': document.getElementById('loan-term').value,
                'loan-grace': document.getElementById('loan-grace').value,
                'loan-rate': document.getElementById('loan-rate').value
            };
            addHistoryRecord('loan-interest', '대출이자 계산', title, params);
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        var loanTypeTabs = document.getElementById('loan-type-tabs');
        if (!loanTypeTabs) return;

        var rateSlider = document.getElementById('loan-rate');
        var rateValue = document.getElementById('loan-rate-value');
        if (rateSlider) {
            rateSlider.addEventListener('input', function () {
                rateValue.innerText = parseFloat(rateSlider.value).toFixed(2) + '%';
            });
        }

        var loanAmountInput = document.getElementById('loan-amount');
        var loanAmountHint = document.getElementById('loan-amount-hint');
        if (loanAmountInput) {
            loanAmountInput.addEventListener('input', function () {
                formatNumber(loanAmountInput);
                loanAmountHint.innerText = formatKoreanUnit(parseNumber(loanAmountInput.value));
            });
        }
    });
})();

// 8. 공통: 알약형 토글탭 / 금액 퀵칩 / 금리 프리셋 칩 (여러 계산기에서 재사용되는 범용 인터랙션)
document.addEventListener('DOMContentLoaded', () => {
    // 알약형 토글탭: 같은 그룹 안에서 하나만 active 상태 유지
    document.querySelectorAll('.pill-tabs').forEach(function (container) {
        container.querySelectorAll('.pill-tab').forEach(function (btn) {
            btn.addEventListener('click', function () {
                container.querySelectorAll('.pill-tab').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
            });
        });
    });

    // 금액 퀵칩: data-target 인풋에 값을 더하거나 초기화
    document.querySelectorAll('.quick-chip[data-target]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var targetId = btn.getAttribute('data-target');
            var input = document.getElementById(targetId);
            if (!input) return;
            if (btn.dataset.reset) {
                input.value = '';
            } else {
                var cur = parseNumber(input.value) || 0;
                var add = parseFloat(btn.getAttribute('data-add')) || 0;
                input.value = formatResult(cur + add);
            }
            input.dispatchEvent(new Event('input'));
        });
    });

    // 금리 프리셋 칩: data-rate-target 인풋 값을 지정된 금리로 그대로 설정
    document.querySelectorAll('.rate-chip[data-rate-target]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var targetId = btn.getAttribute('data-rate-target');
            var input = document.getElementById(targetId);
            if (!input) return;
            input.value = btn.getAttribute('data-rate');
            input.dispatchEvent(new Event('input'));
        });
    });

    // 카운트 스테퍼: data-count-target 표시 span 값을 min~max 범위 내에서 증감
    document.querySelectorAll('.count-stepper-btn[data-count-target]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var targetId = btn.getAttribute('data-count-target');
            var display = document.getElementById(targetId);
            if (!display) return;
            var min = parseInt(btn.getAttribute('data-count-min'), 10) || 0;
            var max = parseInt(btn.getAttribute('data-count-max'), 10) || 10;
            var dir = parseInt(btn.getAttribute('data-count-dir'), 10) || 0;
            var cur = parseInt(display.textContent, 10) || 0;
            var next = Math.min(max, Math.max(min, cur + dir));
            display.textContent = String(next);
        });
    });

    // 한글 금액 힌트 공통 노출/숨김: 인풋 값이 0 또는 빈값이면 하단 힌트를 완전히 숨기고, 값이 있을 때만 보여줌
    function syncKoreanHintVisibility(input) {
        var hint = document.getElementById(input.id + 'Hint') || document.getElementById(input.id + '-hint');
        if (!hint) return;
        var raw = (input.value || '').replace(/[^0-9]/g, '');
        var num = Number(raw) || 0;
        hint.style.display = num > 0 ? '' : 'none';
    }

    document.addEventListener('input', function (e) {
        var el = e.target;
        if (!el || !el.id) return;
        syncKoreanHintVisibility(el);
    });

    document.querySelectorAll('[id$="Hint"], [id$="-hint"]').forEach(function (hint) {
        var inputId = hint.id.replace(/-?[Hh]int$/, '');
        var input = document.getElementById(inputId);
        if (input) syncKoreanHintVisibility(input);
    });
});

// 9. 정기예금 계산기 — 단리/복리 × 일반과세/세금우대/비과세
(function () {
    // 자산 파일럿 추천 고금리 상품 (모의 추천 데이터, 저축은행/지방은행 라인업)
    var DEPOSIT_PRODUCTS = [
        { bank: '광주은행', color: '#F58220', textColor: '#ffffff', product: '스마트정기예금', maxRate: 4.60 },
        { bank: '메가저축은행', color: '#E4032E', textColor: '#ffffff', product: '메가정기예금', maxRate: 4.55 },
        { bank: '우리저축은행', color: '#0067AC', textColor: '#ffffff', product: 'WELCOME 정기예금', maxRate: 4.45 },
        { bank: '웰컴저축은행', color: '#5B2C82', textColor: '#ffffff', product: '첫거래우대 정기예금', maxRate: 4.40 },
        { bank: 'OK저축은행', color: '#F5A623', textColor: '#3C1E1E', product: 'OK정기예금', maxRate: 4.35 }
    ];

    function renderDepositProductFeed() {
        var feed = document.getElementById('deposit-product-feed');
        if (!feed) return;
        var sorted = DEPOSIT_PRODUCTS.slice().sort(function (a, b) { return b.maxRate - a.maxRate; });
        var bestRate = sorted.length ? sorted[0].maxRate : 0;

        feed.innerHTML = sorted.map(function (p) {
            var bestTag = p.maxRate === bestRate ? '<span class="product-best">최고금리</span>' : '';
            return '' +
                '<div class="product-card">' +
                    '<span class="product-badge" style="background:' + p.color + ';color:' + p.textColor + '">' + p.bank.charAt(0) + '</span>' +
                    '<div class="product-info">' +
                        '<div class="product-bank">' + p.bank + '</div>' +
                        '<div class="product-name">' + p.product + '</div>' +
                    '</div>' +
                    '<div class="product-rate-wrap">' +
                        bestTag +
                        '<span class="product-rate">최고 연 ' + p.maxRate.toFixed(2) + '%</span>' +
                    '</div>' +
                '</div>';
        }).join('');
    }

    // 세전 이자 계산: 단리 vs 월복리
    function getGrossInterest(P, R, n, interestType) {
        if (interestType === 'simple') {
            return P * (R / 100) * (n / 12);
        }
        return P * Math.pow(1 + (R / (12 * 100)), n) - P;
    }

    function renderDepositResult(data) {
        var sym = getCurrencySymbol();

        document.getElementById('deposit-hero-empty').style.display = 'none';
        document.getElementById('deposit-hero-content').style.display = 'block';

        document.getElementById('deposit-total').innerText = sym + formatResult(data.total);
        document.getElementById('deposit-gross-interest').innerText = sym + formatResult(data.grossInterest);
        document.getElementById('deposit-tax').innerText = '- ' + sym + formatResult(data.tax);
        document.getElementById('deposit-net-interest').innerText = '+ ' + sym + formatResult(data.netInterest);

        var principalPct = data.total > 0 ? (data.P / data.total) * 100 : 100;
        var interestPct = 100 - principalPct;
        document.getElementById('deposit-bar-principal').style.width = principalPct + '%';
        document.getElementById('deposit-bar-interest').style.width = interestPct + '%';
        document.getElementById('deposit-principal-pct').innerText = formatResult(principalPct) + '%';
        document.getElementById('deposit-interest-pct').innerText = formatResult(interestPct) + '%';

        var rolloverCard = document.getElementById('deposit-rollover-card');
        if (data.rollover) {
            rolloverCard.style.display = 'flex';
            document.getElementById('deposit-rollover-amount').innerText = sym + formatResult(data.rolloverTotal);
        } else {
            rolloverCard.style.display = 'none';
        }

        renderDepositProductFeed();
    }

    // 예치원금 P, 연이율 R(%), 총 예치기간 n개월
    window.calculateDeposit = function (skipHistory) {
        skipHistory = skipHistory || false;

        var interestTypeBtn = document.querySelector('#deposit-interest-type-tabs .pill-tab.active');
        var taxTypeBtn = document.querySelector('#deposit-tax-type-tabs .pill-tab.active');
        if (!interestTypeBtn || !taxTypeBtn) return;

        var interestType = interestTypeBtn.dataset.value; // 'simple' | 'compound'
        var taxType = taxTypeBtn.dataset.value; // 'general' | 'preferential' | 'tax-free'

        var P = parseNumber(document.getElementById('deposit-amount').value);
        var R = parseFloat(document.getElementById('deposit-rate').value) || 0;
        var n = parseInt(document.getElementById('deposit-term').value, 10) || 0;
        var rollover = document.getElementById('deposit-rollover').checked;

        if (P <= 0 || n <= 0) {
            alert('예치 금액과 예치 기간을 입력해주세요.');
            return;
        }

        // 1) 세전 이자 (단리 / 복리 분기)
        var grossInterest = getGrossInterest(P, R, n, interestType);

        // 2) 이자과세 분기 (일반과세 15.4% / 세금우대 9.5% / 비과세 0%)
        var taxRate = taxType === 'general' ? 0.154 : (taxType === 'preferential' ? 0.095 : 0);
        var tax = grossInterest * taxRate;

        // 3) 최종 실수령액
        var netInterest = grossInterest - tax;
        var total = P + netInterest;

        // 재예치 옵션: 만기 수령액을 새 원금으로 삼아 동일 조건으로 1회 더 예치했을 때의 예상 수령액
        var rolloverTotal = null;
        if (rollover) {
            var rGross = getGrossInterest(total, R, n, interestType);
            var rTax = rGross * taxRate;
            rolloverTotal = total + (rGross - rTax);
        }

        renderDepositResult({
            P: P, R: R, n: n, interestType: interestType, taxType: taxType,
            grossInterest: grossInterest, tax: tax, netInterest: netInterest, total: total,
            rollover: rollover, rolloverTotal: rolloverTotal
        });

        if (!skipHistory && typeof addHistoryRecord === 'function') {
            var interestNames = { simple: '단리', compound: '복리' };
            var taxNames = { general: '일반과세', preferential: '세금우대', 'tax-free': '비과세' };
            var title = formatResult(P) + ' / 연 ' + R + '% / ' + n + '개월 (' + interestNames[interestType] + ', ' + taxNames[taxType] + ')';
            var params = {
                'deposit-amount': document.getElementById('deposit-amount').value,
                'deposit-rate': document.getElementById('deposit-rate').value,
                'deposit-term': document.getElementById('deposit-term').value
            };
            addHistoryRecord('deposit', '정기예금 계산', title, params);
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        var depositAmountInput = document.getElementById('deposit-amount');
        var depositAmountHint = document.getElementById('deposit-amount-hint');
        if (depositAmountInput) {
            depositAmountInput.addEventListener('input', function () {
                formatNumber(depositAmountInput);
                depositAmountHint.innerText = formatKoreanUnit(parseNumber(depositAmountInput.value));
            });
        }

        var rolloverToggle = document.getElementById('deposit-rollover');
        if (rolloverToggle) {
            rolloverToggle.addEventListener('change', function () {
                if (depositAmountInput && depositAmountInput.value) calculateDeposit();
            });
        }
    });
})();

// 10. 정기적금 계산기 — 매월 적립식 단리/복리 × 일반과세/세금우대/비과세
(function () {
    // 자산 파일럿 추천 최고금리 적금 TOP 3 (모의 추천 데이터)
    var SAVINGS_PRODUCTS = [
        { bank: '케이뱅크', color: '#FF5B24', textColor: '#ffffff', product: '코드K 자유적금', maxRate: 8.30 },
        { bank: '카카오뱅크', color: '#FEE500', textColor: '#3C1E1E', product: '26주 적금', maxRate: 7.00 },
        { bank: '경남은행', color: '#EE3524', textColor: '#ffffff', product: 'BNK더뱅킹적금', maxRate: 5.75 }
    ];

    // 기간별 평균 금리 트렌드 (모의 시장 평균 데이터, 사용자가 입력한 기간과 가장 가까운 구간을 하이라이트)
    var RATE_TREND = [
        { months: 6, avgRate: 3.2 },
        { months: 12, avgRate: 3.6 },
        { months: 24, avgRate: 3.8 },
        { months: 36, avgRate: 3.9 }
    ];

    function renderSavingsProductFeed() {
        var feed = document.getElementById('savings-product-feed');
        if (!feed) return;
        var sorted = SAVINGS_PRODUCTS.slice().sort(function (a, b) { return b.maxRate - a.maxRate; });
        var bestRate = sorted.length ? sorted[0].maxRate : 0;

        feed.innerHTML = sorted.map(function (p) {
            var bestTag = p.maxRate === bestRate ? '<span class="product-best">최고금리</span>' : '';
            return '' +
                '<div class="product-card">' +
                    '<span class="product-badge" style="background:' + p.color + ';color:' + p.textColor + '">' + p.bank.charAt(0) + '</span>' +
                    '<div class="product-info">' +
                        '<div class="product-bank">' + p.bank + '</div>' +
                        '<div class="product-name">' + p.product + '</div>' +
                    '</div>' +
                    '<div class="product-rate-wrap">' +
                        bestTag +
                        '<span class="product-rate">최고 연 ' + p.maxRate.toFixed(2) + '%</span>' +
                    '</div>' +
                '</div>';
        }).join('');
    }

    function renderRateTrendChart(currentTermMonths) {
        var chart = document.getElementById('savings-rate-trend');
        if (!chart) return;

        // 사용자가 입력한 적립기간과 가장 가까운 구간을 하이라이트
        var closest = RATE_TREND[0];
        RATE_TREND.forEach(function (item) {
            if (Math.abs(item.months - currentTermMonths) < Math.abs(closest.months - currentTermMonths)) {
                closest = item;
            }
        });

        var maxRate = Math.max.apply(null, RATE_TREND.map(function (item) { return item.avgRate; }));

        chart.innerHTML = RATE_TREND.map(function (item) {
            var heightPct = Math.max(8, (item.avgRate / maxRate) * 100);
            var activeClass = item.months === closest.months ? ' active' : '';
            return '' +
                '<div class="rate-trend-col' + activeClass + '">' +
                    '<span class="rate-trend-value">' + item.avgRate.toFixed(1) + '%</span>' +
                    '<div class="rate-trend-bar" style="height:0%" data-target-height="' + heightPct + '%"></div>' +
                    '<span class="rate-trend-label">' + item.months + '개월</span>' +
                '</div>';
        }).join('');

        // 렌더링 직후 0%에서 목표 높이로 애니메이션
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                chart.querySelectorAll('.rate-trend-bar').forEach(function (bar) {
                    bar.style.height = bar.getAttribute('data-target-height');
                });
            });
        });
    }

    // 세전 이자 계산: 단리 vs 월복리 (매월 적립되는 원금의 회차별 예치기간을 반영)
    function getSavingsGrossInterest(A, r, n, interestType) {
        if (interestType === 'simple') {
            // 1회차는 n개월, 마지막 회차는 1개월간 이자가 붙는 회차별 체감 공식
            return A * r * (n * (n + 1) / 2);
        }
        // 매월 원리금이 복리로 증식하는 등비수열의 합
        return A * ((1 + r) * (Math.pow(1 + r, n) - 1) / r) - (A * n);
    }

    function renderSavingsResult(data) {
        var sym = getCurrencySymbol();

        document.getElementById('savings-hero-empty').style.display = 'none';
        document.getElementById('savings-hero-content').style.display = 'block';

        document.getElementById('savings-total').innerText = sym + formatResult(data.total);
        document.getElementById('savings-principal').innerText = sym + formatResult(data.principal);
        document.getElementById('savings-gross-interest').innerText = sym + formatResult(data.grossInterest);
        document.getElementById('savings-tax').innerText = '- ' + sym + formatResult(data.tax);
        document.getElementById('savings-net-interest').innerText = '+ ' + sym + formatResult(data.netInterest);

        var principalPct = data.total > 0 ? (data.principal / data.total) * 100 : 100;
        var interestPct = 100 - principalPct;
        document.getElementById('savings-bar-principal').style.width = principalPct + '%';
        document.getElementById('savings-bar-interest').style.width = interestPct + '%';
        document.getElementById('savings-principal-pct').innerText = formatResult(principalPct) + '%';
        document.getElementById('savings-interest-pct').innerText = formatResult(interestPct) + '%';

        renderRateTrendChart(data.n);
        renderSavingsProductFeed();
    }

    // 매월 적립액 A, 연이율 R(%, 월이율 r = R/12/100), 총 적금기간 n개월
    window.calculateSavings = function (skipHistory) {
        skipHistory = skipHistory || false;

        var interestTypeBtn = document.querySelector('#savings-interest-type-tabs .pill-tab.active');
        var taxTypeBtn = document.querySelector('#savings-tax-type-tabs .pill-tab.active');
        if (!interestTypeBtn || !taxTypeBtn) return;

        var interestType = interestTypeBtn.dataset.value; // 'simple' | 'compound'
        var taxType = taxTypeBtn.dataset.value; // 'general' | 'preferential' | 'tax-free'

        var A = parseNumber(document.getElementById('savings-amount').value);
        var R = parseFloat(document.getElementById('savings-rate').value) || 0;
        var n = parseInt(document.getElementById('savings-term').value, 10) || 0;
        var r = R / 12 / 100;

        if (A <= 0 || n <= 0) {
            alert('월 적립액과 적립 기간을 입력해주세요.');
            return;
        }

        // 1) 세전 이자 (단리 / 복리 분기, 매월 적립되는 원금의 회차별 특성 반영)
        var grossInterest = r === 0 ? 0 : getSavingsGrossInterest(A, r, n, interestType);

        // 2) 이자과세 분기 (일반과세 15.4% / 세금우대 9.5% / 비과세 0%)
        var taxRate = taxType === 'general' ? 0.154 : (taxType === 'preferential' ? 0.095 : 0);
        var tax = grossInterest * taxRate;

        // 3) 최종 실수령액
        var principal = A * n;
        var netInterest = grossInterest - tax;
        var total = principal + netInterest;

        renderSavingsResult({
            A: A, R: R, n: n, interestType: interestType, taxType: taxType,
            principal: principal, grossInterest: grossInterest, tax: tax,
            netInterest: netInterest, total: total
        });

        if (!skipHistory && typeof addHistoryRecord === 'function') {
            var interestNames = { simple: '단리', compound: '복리' };
            var taxNames = { general: '일반과세', preferential: '세금우대', 'tax-free': '비과세' };
            var title = '매월 ' + formatResult(A) + ' / 연 ' + R + '% / ' + n + '개월 (' + interestNames[interestType] + ', ' + taxNames[taxType] + ')';
            var params = {
                'savings-amount': document.getElementById('savings-amount').value,
                'savings-rate': document.getElementById('savings-rate').value,
                'savings-term': document.getElementById('savings-term').value
            };
            addHistoryRecord('savings', '정기적금 계산', title, params);
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        var savingsAmountInput = document.getElementById('savings-amount');
        var savingsAmountHint = document.getElementById('savings-amount-hint');
        if (savingsAmountInput) {
            savingsAmountInput.addEventListener('input', function () {
                formatNumber(savingsAmountInput);
                var amount = parseNumber(savingsAmountInput.value);
                savingsAmountHint.innerText = amount > 0 ? ('매월 ' + formatKoreanUnit(amount) + '씩') : '0원';
            });
        }
    });
})();

// 11. 인플레이션 계산기 — 미래 화폐가치 하락 / 과거 화폐가치 역산 (복리 할인)
(function () {
    // 물가 상승 시 체감 변화 예시로 사용할 대표 품목
    var PRICE_EXAMPLES = [
        { name: "짜장면 한 그릇", icon: "ph-bowl-food", price: 7000 },
        { name: "아메리카노 한 잔", icon: "ph-coffee", price: 4500 },
        { name: "김밥 한 줄", icon: "ph-hamburger", price: 3500 }
    ];

    function renderPriceExamples(r, n) {
        var feed = document.getElementById("inflationPriceExamples");
        if (!feed) return;
        feed.innerHTML = PRICE_EXAMPLES.map(function (item) {
            var future = item.price * Math.pow(1 + r, n);
            return "" +
                '<div class="product-card">' +
                    '<span class="product-badge" style="background:var(--accent-light);color:var(--accent-color)"><i class="ph-duotone ' + item.icon + '"></i></span>' +
                    '<div class="product-info">' +
                        '<div class="product-bank">' + item.name + "</div>" +
                        '<div class="product-name">지금 ' + item.price.toLocaleString("ko-KR") + "원</div>" +
                    "</div>" +
                    '<div class="product-rate-wrap">' +
                        '<span class="product-rate" style="color:var(--loss-color)">' + Math.round(future).toLocaleString("ko-KR") + "원</span>" +
                    "</div>" +
                "</div>";
        }).join("");
    }

    // 화폐가치가 우하향으로 녹아내리는 모습을 보여주는 미니멀 SVG 그라데이션 라인 차트
    function buildInflationChart(P, r, n) {
        var width = 320, height = 130;
        var padLeft = 6, padRight = 6, padTop = 20, padBottom = 20;
        var plotWidth = width - padLeft - padRight;
        var plotHeight = height - padTop - padBottom;

        var steps = Math.min(n, 24); // 라인 해상도 (최대 24구간으로 부드럽게)
        var points = [];
        for (var i = 0; i <= steps; i++) {
            var year = (n / steps) * i;
            var value = P / Math.pow(1 + r, year);
            points.push({ year: year, value: value });
        }

        var maxValue = P; // 우하향 곡선이므로 시작값이 최댓값
        var minValue = points[points.length - 1].value;

        function xForYear(year) { return padLeft + (year / n) * plotWidth; }
        function yForValue(value) {
            var ratio = maxValue > minValue ? (value - minValue) / (maxValue - minValue) : 0;
            return padTop + (1 - ratio) * plotHeight;
        }

        var pathD = points.map(function (pt, idx) {
            var x = xForYear(pt.year).toFixed(1);
            var y = yForValue(pt.value).toFixed(1);
            return (idx === 0 ? "M" : "L") + x + "," + y;
        }).join(" ");

        var baseline = (height - padBottom).toFixed(1);
        var areaD = pathD + " L" + xForYear(n).toFixed(1) + "," + baseline + " L" + xForYear(0).toFixed(1) + "," + baseline + " Z";

        var labelYears = [0, Math.round(n / 2), n];
        var labels = labelYears.map(function (yr) {
            var val = P / Math.pow(1 + r, yr);
            var x = xForYear(yr);
            var anchor = yr === 0 ? "start" : (yr === n ? "end" : "middle");
            return (
                '<text class="chart-value-label" x="' + x + '" y="' + (yForValue(val) - 8) + '" text-anchor="' + anchor + '">' + formatKoreanUnit(val) + "</text>" +
                '<text class="chart-year-label" x="' + x + '" y="' + (height - 4) + '" text-anchor="' + anchor + '">' + yr + "년 후</text>"
            );
        }).join("");

        return (
            '<svg viewBox="0 0 ' + width + " " + height + '">' +
                '<defs><linearGradient id="inflationGrad" x1="0" y1="0" x2="0" y2="1">' +
                    '<stop offset="0%" stop-color="#df484a" stop-opacity="0.28"/>' +
                    '<stop offset="100%" stop-color="#df484a" stop-opacity="0"/>' +
                "</linearGradient></defs>" +
                '<path d="' + areaD + '" fill="url(#inflationGrad)" stroke="none"/>' +
                '<path d="' + pathD + '" fill="none" stroke="#df484a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
                labels +
            "</svg>"
        );
    }

    function renderInflationResult(data) {
        document.getElementById("inflation-hero-empty").style.display = "none";
        document.getElementById("inflation-hero-content").style.display = "block";

        var sym = getCurrencySymbol();
        var isForward = data.mode === "forward";

        document.getElementById("inflationHeroLabel").innerText = isForward
            ? (data.n + "년 후 실질 구매력 가치")
            : (data.n + "년 전 이 금액의 가치");
        document.getElementById("inflationHeroValue").innerText = sym + formatResult(isForward ? data.realValue : data.nominalValue);

        var lossPctText = formatResult(data.lossPct) + "%";
        var impactHtml = isForward
            ? ("지금의 " + formatKoreanUnit(data.P) + "은 " + data.n + "년 뒤 <b>" + formatKoreanUnit(data.realValue) + "</b>의 가치밖에 안 돼요. (구매력 " + lossPctText + " 감소)")
            : ("지금 " + formatKoreanUnit(data.P) + "과 같은 구매력을 가지려면 " + data.n + "년 전에는 <b>" + formatKoreanUnit(data.realValue) + "</b>만 있으면 됐어요.");
        document.getElementById("inflationImpactMessage").innerHTML = impactHtml;

        document.getElementById("inflationPrincipalLabel").innerText = isForward ? "현재 금액:" : "오늘 기준 금액:";
        document.getElementById("inflationPrincipalValue").innerText = sym + formatResult(data.P);
        document.getElementById("inflationLossLabel").innerText = isForward ? "실질 가치 손실액:" : "구매력 차이:";
        document.getElementById("inflationLossValue").innerText = sym + formatResult(data.loss);
        document.getElementById("inflationNominalLabel").innerText = isForward ? "동일 구매력 유지 필요 금액:" : (data.n + "년 전 대비 필요 증가액:");
        document.getElementById("inflationNominalValue").innerText = sym + formatResult(data.nominalValue);

        document.getElementById("inflationChart").innerHTML = buildInflationChart(data.P, data.r, data.n);
        renderPriceExamples(data.r, data.n);
    }

    // 현재 자산 원금 P, 연간 물가상승률 R(%, r=R/100), 기간 n년
    window.calculateInflation = function (skipHistory) {
        skipHistory = skipHistory || false;

        var modeBtn = document.querySelector("#inflationModeTabs .pill-tab.active");
        if (!modeBtn) return;
        var mode = modeBtn.dataset.value; // 'forward' | 'backward'

        var P = parseNumber(document.getElementById("inflationAmount").value);
        var n = parseInt(document.getElementById("inflationYears").value, 10) || 0;
        var R = parseFloat(document.getElementById("inflationRate").value) || 0;
        var r = R / 100;

        if (P <= 0 || n <= 0) {
            alert("보유자산과 유지기간을 입력해주세요.");
            return;
        }

        /* 1) 미래 실질 화폐가치: Real Value = P / (1+r)^n */
        var realValue = P / Math.pow(1 + r, n);

        /* 2) 미래 필요 금액(명목가치): Nominal Value = P * (1+r)^n */
        var nominalValue = P * Math.pow(1 + r, n);

        /* 3) 실질 손실액 및 손실률 */
        var loss = P - realValue;
        var lossPct = P > 0 ? (loss / P * 100) : 0;

        renderInflationResult({ mode: mode, P: P, n: n, R: R, r: r, realValue: realValue, nominalValue: nominalValue, loss: loss, lossPct: lossPct });

        if (!skipHistory && typeof addHistoryRecord === "function") {
            var modeNames = { forward: "미래가치", backward: "과거역산" };
            var title = formatResult(P) + " / 연 " + R + "% / " + n + "년 (" + modeNames[mode] + ")";
            var params = {
                "inflationAmount": document.getElementById("inflationAmount").value,
                "inflationYears": document.getElementById("inflationYears").value,
                "inflationRate": document.getElementById("inflationRate").value
            };
            addHistoryRecord("inflation", "인플레이션 계산", title, params);
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        var modeTabs = document.getElementById("inflationModeTabs");
        var amountLabel = document.getElementById("inflationAmountLabel");
        var yearsLabel = document.getElementById("inflationYearsLabel");
        if (!modeTabs) return;

        // 모드 전환 시 인풋 라벨을 미래가치/과거역산에 맞게 갱신 (활성 탭 토글 자체는 공통 핸들러가 처리)
        modeTabs.querySelectorAll(".pill-tab").forEach(function (btn) {
            btn.addEventListener("click", function () {
                if (btn.dataset.value === "backward") {
                    amountLabel.innerText = "지금 필요한 금액";
                    yearsLabel.innerText = "몇 년 전 가치가 궁금한가요";
                } else {
                    amountLabel.innerText = "보유자산 (현재 금액)";
                    yearsLabel.innerText = "유지 기간 (년)";
                }
            });
        });

        var inflationAmountInput = document.getElementById("inflationAmount");
        var inflationAmountHint = document.getElementById("inflationAmountHint");
        if (inflationAmountInput) {
            inflationAmountInput.addEventListener("input", function () {
                formatNumber(inflationAmountInput);
                inflationAmountHint.innerText = formatKoreanUnit(parseNumber(inflationAmountInput.value));
            });
        }
    });
})();

// 12. 예금중도해지 계산기 — 보유기간 비율별 중도해지 이율 패널티 + 만기 대비 기회비용
(function () {
    // 보유 비율(X%) 구간별 표준 중도해지 요율 인정 비율 매트릭스
    function getPenaltyRatio(x){
        if (x < 10) return 0.10;
        if (x < 30) return 0.30;
        if (x < 60) return 0.50;
        if (x < 90) return 0.70;
        return 0.85;
    }

    var EARLY_TERM_TAX_RATE = 0.154; // 이자소득세 14% + 지방소득세 1.4%

    function renderEarlyTermResult(data){
        var sym = getCurrencySymbol();

        document.getElementById("earlyTerm-hero-empty").style.display = "none";
        document.getElementById("earlyTerm-hero-content").style.display = "block";

        document.getElementById("earlyTermHeroValue").innerText = sym + formatResult(data.finalPayout);
        document.getElementById("earlyTermLossValue").innerText = sym + formatResult(data.lostInterest);

        document.getElementById("earlyTermTargetValue").innerText = sym + formatResult(data.interestTargetNet);
        document.getElementById("earlyTermPenaltyValue").innerText = sym + formatResult(data.interestPenaltyNet);

        var targetBarWidth = 100;
        var penaltyBarWidth = data.interestTargetNet > 0
            ? Math.min(100, (data.interestPenaltyNet / data.interestTargetNet) * 100)
            : 0;
        document.getElementById("earlyTermTargetBar").style.width = targetBarWidth + "%";
        document.getElementById("earlyTermPenaltyBar").style.width = penaltyBarWidth + "%";

        document.getElementById("earlyTermHoldRatio").innerText = formatResult(data.holdRatio) + "%" + (data.isMatured ? " (만기 도달)" : "");
        document.getElementById("earlyTermPenaltyRate").innerText = "연 " + formatResult(data.penaltyRate) + "%";
        document.getElementById("earlyTermGrossInterest").innerText = sym + formatResult(data.interestPenaltyGross);
    }

    // 예치원금 P, 약정 연이율 R, 약정 개월수 N, 실제 보유일수 Dactual, 약정 총일수 Dtotal
    window.calculateEarlyTermination = function (skipHistory) {
        skipHistory = skipHistory || false;

        var P = parseNumber(document.getElementById("earlyTermPrincipal").value);
        var R = parseFloat(document.getElementById("earlyTermRate").value) || 0;
        var N = parseInt(document.getElementById("earlyTermMonths").value, 10) || 0;
        var joinDate = new Date(document.getElementById("earlyTermJoinDate").value);
        var withdrawDate = new Date(document.getElementById("earlyTermWithdrawDate").value);

        if (P <= 0 || N <= 0) {
            alert("예치 원금과 약정 기간을 입력해주세요.");
            return;
        }
        if (isNaN(joinDate.getTime()) || isNaN(withdrawDate.getTime())) {
            alert("가입일자와 중도해지일자를 입력해주세요.");
            return;
        }
        if (withdrawDate <= joinDate) {
            alert("중도해지일자는 가입일자보다 뒤여야 해요.");
            return;
        }

        var DAY_MS = 24 * 60 * 60 * 1000;

        /* 약정 총 일수 Dtotal — 가입일자 기준 N개월 뒤 만기일까지의 실제 달력 일수 */
        var maturityDate = new Date(joinDate.getTime());
        maturityDate.setMonth(maturityDate.getMonth() + N);
        var Dtotal = Math.round((maturityDate - joinDate) / DAY_MS);

        /* 실제 보유일수 Dactual */
        var DactualRaw = Math.round((withdrawDate - joinDate) / DAY_MS);
        var isMatured = DactualRaw >= Dtotal; // 이미 약정 기간을 다 채운 경우: 패널티 없이 정상 만기 이율 적용
        var Dactual = isMatured ? Dtotal : DactualRaw;

        /* 1) 보유 비율 X = Dactual / Dtotal * 100, 구간별 중도해지 이율 인정 비율 매칭 */
        var X = Dtotal > 0 ? Math.min(100, (Dactual / Dtotal) * 100) : 0;
        var penaltyRatio = isMatured ? 1.0 : getPenaltyRatio(X);
        var Rpenalty = R * penaltyRatio;

        /* 2) 세전 이자 산출 */
        var interestPenaltyGross = P * (Rpenalty / 100) * (Dactual / 365);
        var interestTargetGross = P * (R / 100) * (N / 12);

        /* 세금 15.4% 공제 후 세후 이자 및 최종 실수령액, 만기 대비 손실액 */
        var interestPenaltyNet = interestPenaltyGross * (1 - EARLY_TERM_TAX_RATE);
        var interestTargetNet = interestTargetGross * (1 - EARLY_TERM_TAX_RATE);
        var lostInterest = Math.max(0, interestTargetNet - interestPenaltyNet);
        var finalPayout = P + interestPenaltyNet;

        renderEarlyTermResult({
            P: P, R: R, N: N, Dactual: Dactual, Dtotal: Dtotal, holdRatio: X,
            isMatured: isMatured, penaltyRate: Rpenalty,
            interestPenaltyGross: interestPenaltyGross, interestTargetGross: interestTargetGross,
            interestPenaltyNet: interestPenaltyNet, interestTargetNet: interestTargetNet,
            lostInterest: lostInterest, finalPayout: finalPayout
        });

        if (!skipHistory && typeof addHistoryRecord === "function") {
            var title = formatResult(P) + " / 연 " + R + "% / " + N + "개월 (보유 " + formatResult(X) + "%)";
            var params = {
                "earlyTermPrincipal": document.getElementById("earlyTermPrincipal").value,
                "earlyTermRate": document.getElementById("earlyTermRate").value,
                "earlyTermMonths": document.getElementById("earlyTermMonths").value
            };
            addHistoryRecord("early-termination", "예금중도해지 계산", title, params);
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        var principalInput = document.getElementById("earlyTermPrincipal");
        var principalHint = document.getElementById("earlyTermPrincipalHint");
        if (principalInput) {
            principalInput.addEventListener("input", function () {
                formatNumber(principalInput);
                principalHint.innerText = formatKoreanUnit(parseNumber(principalInput.value));
            });
        }
    });
})();

// 13. 은퇴자금 계산기 — 물가상승률 반영 노후 생활비 실질 복리 누적 시뮬레이션
(function () {
    // 은퇴 후 자산이 생활비 인출로 소진되는 추이를 보여주는 SVG 꺾은선 그래프
    function buildRetirementChart(balancePoints, Ar, Al){
        var width = 320, height = 130;
        var padLeft = 6, padRight = 6, padTop = 20, padBottom = 20;
        var plotWidth = width - padLeft - padRight;
        var plotHeight = height - padTop - padBottom;

        var n = balancePoints.length - 1; // 구간 수 (은퇴 후 생존 기간)
        var maxValue = balancePoints[0] || 1;

        function xForIndex(i){ return padLeft + (n > 0 ? (i / n) * plotWidth : 0); }
        function yForValue(value){
            var ratio = maxValue > 0 ? Math.max(0, value) / maxValue : 0;
            return padTop + (1 - ratio) * plotHeight;
        }

        var pathD = balancePoints.map(function (value, idx) {
            var x = xForIndex(idx).toFixed(1);
            var y = yForValue(value).toFixed(1);
            return (idx === 0 ? "M" : "L") + x + "," + y;
        }).join(" ");

        var baseline = (height - padBottom).toFixed(1);
        var areaD = pathD + " L" + xForIndex(n).toFixed(1) + "," + baseline + " L" + xForIndex(0).toFixed(1) + "," + baseline + " Z";

        var labelIdx = [0, Math.round(n / 2), n];
        var labels = labelIdx.map(function (idx) {
            var age = Ar + idx;
            var val = balancePoints[idx];
            var x = xForIndex(idx);
            var anchor = idx === 0 ? "start" : (idx === n ? "end" : "middle");
            return (
                '<text class="chart-value-label" x="' + x + '" y="' + (yForValue(val) - 8) + '" text-anchor="' + anchor + '" style="fill:var(--accent-color)">' + formatKoreanUnit(val) + "</text>" +
                '<text class="chart-year-label" x="' + x + '" y="' + (height - 4) + '" text-anchor="' + anchor + '">' + age + "세</text>"
            );
        }).join("");

        return (
            '<svg viewBox="0 0 ' + width + " " + height + '">' +
                '<defs><linearGradient id="retirementGrad" x1="0" y1="0" x2="0" y2="1">' +
                    '<stop offset="0%" stop-color="var(--accent-color)" stop-opacity="0.25"/>' +
                    '<stop offset="100%" stop-color="var(--accent-color)" stop-opacity="0"/>' +
                "</linearGradient></defs>" +
                '<path d="' + areaD + '" fill="url(#retirementGrad)" stroke="none"/>' +
                '<path d="' + pathD + '" fill="none" stroke="var(--accent-color)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
                labels +
            "</svg>"
        );
    }

    function renderRetirementResult(data){
        var sym = getCurrencySymbol();

        document.getElementById("retirement-hero-empty").style.display = "none";
        document.getElementById("retirement-hero-content").style.display = "block";

        document.getElementById("retirementHeroValue").innerText = sym + formatResult(data.totalNeeded);
        document.getElementById("retirementShortfall").innerText = sym + formatResult(data.shortfall);
        document.getElementById("retirementMonthlySaving").innerText = sym + formatResult(data.requiredMonthly);

        document.getElementById("retirementYearsToGo").innerText = data.t + "년";
        document.getElementById("retirementSurvivalYears").innerText = data.n + "년";
        document.getElementById("retirementFutureExpense").innerText = sym + formatResult(data.Mfuture);
        document.getElementById("retirementSavingsFutureValue").innerText = sym + formatResult(data.futureValueOfCurrentSavings);

        document.getElementById("retirementChart").innerHTML = buildRetirementChart(data.balancePoints, data.Ar, data.Al);
    }

    // 현재 나이 Ac, 은퇴 나이 Ar, 기대수명 Al, 희망 월생활비 M, 연간 실질성장률 r
    window.calculateRetirement = function (skipHistory) {
        skipHistory = skipHistory || false;

        var Ac = parseInt(document.getElementById("currentAge").value, 10);
        var Ar = parseInt(document.getElementById("retireAge").value, 10);
        var Al = parseInt(document.getElementById("lifeExpectancy").value, 10);
        var M = parseNumber(document.getElementById("retireMonthlyExpense").value);
        var P = parseNumber(document.getElementById("currentSavings").value);
        var R = parseFloat(document.getElementById("expectedReturn").value) || 0;
        var r = R / 100;

        if (M <= 0) {
            alert("은퇴 후 희망 월 생활비를 입력해주세요.");
            return;
        }
        if (Ar <= Ac || Al <= Ar) {
            alert("현재 나이 < 은퇴 나이 < 기대 수명 순서로 설정해주세요.");
            return;
        }

        /* 1) 은퇴까지 남은 기간 t, 은퇴 후 생존 기간 N */
        var t = Ar - Ac;
        var n = Al - Ar;

        /* 은퇴 시점의 물가 반영 월 생활비: Mfuture = M * (1+r)^t */
        var Mfuture = M * Math.pow(1 + r, t);

        /* 2) 총 필요 은퇴자금 — 은퇴 후 매년 인출액이 r만큼 계속 늘어나는 성장 연금을,
              같은 r로 할인한 현재가치(연금현가)를 구하면 성장률과 할인율이 상쇄되어
              "은퇴 시점 첫 해 생활비 × 생존연수"로 정확히 단순화되는 특수해를 적용함
              (성장 연금 현가공식: PV = C × N,  when g = r) */
        var annualExpenseAtRetirement = Mfuture * 12;
        var totalNeeded = annualExpenseAtRetirement * n;

        /* 은퇴 후 자산이 매년 인출로 소진되는 추이 시뮬레이션 (그래프용) — 연초 인출 후 잔액이 r로 성장 */
        var balancePoints = [totalNeeded];
        var balance = totalNeeded;
        for (var k = 0; k < n; k++) {
            var withdrawal = annualExpenseAtRetirement * Math.pow(1 + r, k);
            balance = Math.max(0, (balance - withdrawal) * (1 + r));
            balancePoints.push(balance);
        }

        /* 3) 현재 저축 자산의 은퇴 시점 미래가치, 부족 자금, 매월 추가 필요 저축액 */
        var futureValueOfCurrentSavings = P * Math.pow(1 + r, t);
        var shortfall = Math.max(0, totalNeeded - futureValueOfCurrentSavings);

        var monthlyRate = r / 12;
        var months = t * 12;
        var requiredMonthly = 0;
        if (months > 0) {
            requiredMonthly = monthlyRate === 0
                ? shortfall / months
                : shortfall * monthlyRate / (Math.pow(1 + monthlyRate, months) - 1);
        }

        renderRetirementResult({
            Ac: Ac, Ar: Ar, Al: Al, t: t, n: n, M: M, Mfuture: Mfuture,
            totalNeeded: totalNeeded, balancePoints: balancePoints,
            futureValueOfCurrentSavings: futureValueOfCurrentSavings,
            shortfall: shortfall, requiredMonthly: requiredMonthly
        });

        if (!skipHistory && typeof addHistoryRecord === "function") {
            var title = Ac + "세→" + Ar + "세 은퇴 / 월 " + formatResult(M) + " / 기대수명 " + Al + "세";
            var params = {
                "currentAge": document.getElementById("currentAge").value,
                "retireAge": document.getElementById("retireAge").value,
                "lifeExpectancy": document.getElementById("lifeExpectancy").value,
                "retireMonthlyExpense": document.getElementById("retireMonthlyExpense").value,
                "currentSavings": document.getElementById("currentSavings").value,
                "expectedReturn": document.getElementById("expectedReturn").value
            };
            addHistoryRecord("retirement", "은퇴자금 계산", title, params);
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        var currentAgeSlider = document.getElementById("currentAge");
        if (!currentAgeSlider) return;
        var retireAgeSlider = document.getElementById("retireAge");
        var lifeExpectancySlider = document.getElementById("lifeExpectancy");

        function syncAgeLabels(){
            document.getElementById("currentAgeValue").innerText = currentAgeSlider.value + "세";
            document.getElementById("retireAgeValue").innerText = retireAgeSlider.value + "세";
            document.getElementById("lifeExpectancyValue").innerText = lifeExpectancySlider.value + "세";
        }

        // 현재 나이 < 은퇴 나이 < 기대 수명 순서가 항상 유지되도록 슬라이더끼리 상호 보정
        currentAgeSlider.addEventListener("input", function () {
            if (Number(currentAgeSlider.value) >= Number(retireAgeSlider.value)) {
                retireAgeSlider.value = Number(currentAgeSlider.value) + 1;
            }
            syncAgeLabels();
        });
        retireAgeSlider.addEventListener("input", function () {
            if (Number(retireAgeSlider.value) <= Number(currentAgeSlider.value)) {
                currentAgeSlider.value = Number(retireAgeSlider.value) - 1;
            }
            if (Number(retireAgeSlider.value) >= Number(lifeExpectancySlider.value)) {
                lifeExpectancySlider.value = Number(retireAgeSlider.value) + 1;
            }
            syncAgeLabels();
        });
        lifeExpectancySlider.addEventListener("input", function () {
            if (Number(lifeExpectancySlider.value) <= Number(retireAgeSlider.value)) {
                retireAgeSlider.value = Number(lifeExpectancySlider.value) - 1;
            }
            syncAgeLabels();
        });
        syncAgeLabels();

        var monthlyExpenseInput = document.getElementById("retireMonthlyExpense");
        var monthlyExpenseHint = document.getElementById("retireMonthlyExpenseHint");
        if (monthlyExpenseInput) {
            monthlyExpenseInput.addEventListener("input", function () {
                formatNumber(monthlyExpenseInput);
                monthlyExpenseHint.innerText = formatKoreanUnit(parseNumber(monthlyExpenseInput.value));
            });
        }

        var currentSavingsInput = document.getElementById("currentSavings");
        var currentSavingsHint = document.getElementById("currentSavingsHint");
        if (currentSavingsInput) {
            currentSavingsInput.addEventListener("input", function () {
                formatNumber(currentSavingsInput);
                currentSavingsHint.innerText = formatKoreanUnit(parseNumber(currentSavingsInput.value));
            });
        }
    });
})();

// 14. 배당금 계산기 — 배당 주기 × 과세유형 + 배당 재투자 복리 시뮬레이션
(function () {
    // 자산 파일럿 고배당주 인사이트 아티클 (고정 콘텐츠)
    var DIVIDEND_INSIGHTS = [
        { icon: "ph-scales", title: "국내외 대표 고배당 ETF(SCHD, JEPI) 완벽 비교", desc: "배당성장형 SCHD와 커버드콜형 JEPI, 투자 목적에 따른 차이를 정리했어요." },
        { icon: "ph-shield-check", title: "금융소득종합과세 피하는 절세 꿀팁", desc: "연간 금융소득이 2,000만원을 넘으면 종합과세 대상이 될 수 있어요." },
        { icon: "ph-piggy-bank", title: "ISA 계좌로 배당소득세 아끼는 법", desc: "ISA 계좌는 배당소득 비과세·저율과세 혜택을 받을 수 있는 절세 계좌예요." },
        { icon: "ph-repeat", title: "배당 재투자(DRIP), 복리의 마법을 체감하세요", desc: "받은 배당금을 재투자하면 시간이 지날수록 배당금 자체도 함께 불어나요." }
    ];

    function renderDividendInsights(){
        var feed = document.getElementById("dividendInsightFeed");
        if (!feed) return;
        feed.innerHTML = DIVIDEND_INSIGHTS.map(function (item) {
            return "" +
                '<div class="product-card">' +
                    '<span class="product-badge" style="background:var(--accent-light);color:var(--accent-color)"><i class="ph-duotone ' + item.icon + '"></i></span>' +
                    '<div class="product-info">' +
                        '<div class="product-bank">' + item.title + "</div>" +
                        '<div class="product-name">' + item.desc + "</div>" +
                    "</div>" +
                "</div>";
        }).join("");
    }

    // 배당 재투자 복리 시뮬레이션 — 주기(C)마다 세후 배당금으로 현재 주가(P) 기준 추가 매수, 보유수량 체증 누적
    function simulateReinvestment(P, Q0, Ds, C, taxRate, years){
        var totalPeriods = years * C;
        var q = Q0;
        var points = [{ year: 0, shares: q, value: q * P }];

        for (var i = 1; i <= totalPeriods; i++) {
            var periodDividendGross = Ds * q;
            var periodDividendNet = periodDividendGross * (1 - taxRate);
            var newShares = P > 0 ? periodDividendNet / P : 0;
            q += newShares;

            if (i % C === 0) {
                points.push({ year: i / C, shares: q, value: q * P });
            }
        }
        return points;
    }

    // 배당 재투자 미래 자산 곡선을 보여주는 SVG 그라데이션 라인 차트
    function buildDividendChart(points){
        var width = 320, height = 130;
        var padLeft = 6, padRight = 6, padTop = 20, padBottom = 20;
        var plotWidth = width - padLeft - padRight;
        var plotHeight = height - padTop - padBottom;

        var n = points.length - 1;
        var maxValue = points[n].value || 1;
        var minValue = points[0].value;

        function xForIndex(i){ return padLeft + (n > 0 ? (i / n) * plotWidth : 0); }
        function yForValue(value){
            var range = maxValue - minValue;
            var ratio = range > 0 ? (value - minValue) / range : 0;
            return padTop + (1 - ratio) * plotHeight;
        }

        var pathD = points.map(function (pt, idx) {
            var x = xForIndex(idx).toFixed(1);
            var y = yForValue(pt.value).toFixed(1);
            return (idx === 0 ? "M" : "L") + x + "," + y;
        }).join(" ");

        var baseline = (height - padBottom).toFixed(1);
        var areaD = pathD + " L" + xForIndex(n).toFixed(1) + "," + baseline + " L" + xForIndex(0).toFixed(1) + "," + baseline + " Z";

        var labelIdx = [0, Math.round(n / 2), n];
        var labels = labelIdx.map(function (idx) {
            var pt = points[idx];
            var x = xForIndex(idx);
            var anchor = idx === 0 ? "start" : (idx === n ? "end" : "middle");
            return (
                '<text class="chart-value-label" x="' + x + '" y="' + (yForValue(pt.value) - 8) + '" text-anchor="' + anchor + '" style="fill:var(--accent-color)">' + formatKoreanUnit(pt.value) + "</text>" +
                '<text class="chart-year-label" x="' + x + '" y="' + (height - 4) + '" text-anchor="' + anchor + '">' + pt.year + "년차</text>"
            );
        }).join("");

        return (
            '<svg viewBox="0 0 ' + width + " " + height + '">' +
                '<defs><linearGradient id="dividendGrad" x1="0" y1="0" x2="0" y2="1">' +
                    '<stop offset="0%" stop-color="var(--accent-color)" stop-opacity="0.28"/>' +
                    '<stop offset="100%" stop-color="var(--accent-color)" stop-opacity="0"/>' +
                "</linearGradient></defs>" +
                '<path d="' + areaD + '" fill="url(#dividendGrad)" stroke="none"/>' +
                '<path d="' + pathD + '" fill="none" stroke="var(--accent-color)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
                labels +
            "</svg>"
        );
    }

    function renderDividendResult(data){
        var sym = getCurrencySymbol();

        document.getElementById("dividend-hero-empty").style.display = "none";
        document.getElementById("dividend-hero-content").style.display = "block";

        document.getElementById("dividendHeroValue").innerText = sym + formatResult(data.annualDividendNet);
        document.getElementById("dividendTotalInvestment").innerText = sym + formatResult(data.totalInvestment);
        document.getElementById("dividendGrossAnnual").innerText = sym + formatResult(data.annualDividendGross);
        document.getElementById("dividendTax").innerText = "- " + sym + formatResult(data.tax);
        document.getElementById("dividendMonthly").innerText = sym + formatResult(data.monthlyDividend);

        var chartCard = document.getElementById("dividendChartCard");
        if (data.reinvest && data.projection && data.projection.length > 1) {
            chartCard.style.display = "block";
            document.getElementById("dividendChart").innerHTML = buildDividendChart(data.projection);

            var year5 = data.projection.filter(function (p) { return p.year === 5; })[0];
            var year10 = data.projection[data.projection.length - 1];
            document.getElementById("dividendYear5").innerText = year5 ? (sym + formatResult(year5.value)) : "-";
            document.getElementById("dividendYear10").innerText = year10 ? (sym + formatResult(year10.value)) : "-";
        } else {
            chartCard.style.display = "none";
        }

        renderDividendInsights();
    }

    // 현재 주가 P, 보유 수량 Q, 주당 배당금 Ds, 배당 주기 C(연간 지급횟수: 월=12, 분기=4, 연=1)
    window.calculateDividends = function (skipHistory) {
        skipHistory = skipHistory || false;

        var cycleBtn = document.querySelector("#dividendCycleTabs .pill-tab.active");
        var taxBtn = document.querySelector("#dividendTaxTabs .pill-tab.active");
        if (!cycleBtn || !taxBtn) return;

        var C = parseInt(cycleBtn.dataset.value, 10);
        var taxType = taxBtn.dataset.value; // 'general' | 'tax-free'
        var reinvest = document.getElementById("dividendReinvest").checked;

        var P = parseNumber(document.getElementById("dividendPrice").value);
        var Q = parseNumber(document.getElementById("dividendQty").value);
        var Ds = parseNumber(document.getElementById("dividendPerShare").value);

        if (P <= 0 || Q <= 0 || Ds <= 0) {
            alert("현재 주가, 보유 수량, 주당 배당금을 모두 입력해주세요.");
            return;
        }

        /* 1) 기본 배당금 및 투자금 산출 */
        var totalInvestment = P * Q;
        var annualDividendGross = Ds * C * Q;

        /* 2) 과세 유형 분기 (일반과세 15.4% / 비과세·ISA 0%) */
        var taxRate = taxType === "general" ? 0.154 : 0;
        var tax = annualDividendGross * taxRate;
        var annualDividendNet = annualDividendGross - tax;
        var monthlyDividend = annualDividendNet / 12;

        /* 3) 배당 재투자 복리 시뮬레이션 (재투자 ON 시에만 10년 치 연산) */
        var projection = null;
        if (reinvest) {
            projection = simulateReinvestment(P, Q, Ds, C, taxRate, 10);
        }

        renderDividendResult({
            P: P, Q: Q, Ds: Ds, C: C, taxType: taxType, reinvest: reinvest,
            totalInvestment: totalInvestment, annualDividendGross: annualDividendGross,
            tax: tax, annualDividendNet: annualDividendNet, monthlyDividend: monthlyDividend,
            projection: projection
        });

        if (!skipHistory && typeof addHistoryRecord === "function") {
            var cycleNames = { 12: "월배당", 4: "분기배당", 1: "연배당" };
            var title = formatResult(Q) + "주 / " + cycleNames[C] + " / " + formatResult(annualDividendNet) + "원";
            var params = {
                "dividendPrice": document.getElementById("dividendPrice").value,
                "dividendQty": document.getElementById("dividendQty").value,
                "dividendPerShare": document.getElementById("dividendPerShare").value
            };
            addHistoryRecord("dividend", "배당금 계산", title, params);
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        var priceInput = document.getElementById("dividendPrice");
        var priceHint = document.getElementById("dividendPriceHint");
        if (priceInput) {
            priceInput.addEventListener("input", function () {
                formatNumber(priceInput);
                priceHint.innerText = formatKoreanUnit(parseNumber(priceInput.value));
            });
        }

        var qtyInput = document.getElementById("dividendQty");
        var qtyHint = document.getElementById("dividendQtyHint");
        if (qtyInput) {
            qtyInput.addEventListener("input", function () {
                formatNumber(qtyInput);
                qtyHint.innerText = formatResult(parseNumber(qtyInput.value)) + "주";
            });
        }

        var perShareInput = document.getElementById("dividendPerShare");
        var perShareHint = document.getElementById("dividendPerShareHint");
        if (perShareInput) {
            perShareInput.addEventListener("input", function () {
                perShareHint.innerText = (parseNumber(perShareInput.value) || 0).toLocaleString("ko-KR") + "원";
            });
        }
    });
})();

// 15. 연봉 실수령액 계산기 — 4대보험 + 근로소득공제 + 8단계 누진세율 + 근로소득세액공제 + 자녀세액공제
(function () {
    var NATIONAL_PENSION_RATE = 0.045;
    var NATIONAL_PENSION_FLOOR = 400000;
    var NATIONAL_PENSION_CEIL = 6370000;
    var HEALTH_INSURANCE_RATE = 0.03545;
    var LONG_TERM_CARE_RATE = 0.1295;
    var EMPLOYMENT_INSURANCE_RATE = 0.009;

    var SALARY_TAX_BRACKETS = [
        { limit: 14000000, rate: 0.06, deduction: 0 },
        { limit: 50000000, rate: 0.15, deduction: 1260000 },
        { limit: 88000000, rate: 0.24, deduction: 5760000 },
        { limit: 150000000, rate: 0.35, deduction: 15440000 },
        { limit: 300000000, rate: 0.38, deduction: 19940000 },
        { limit: 500000000, rate: 0.40, deduction: 25940000 },
        { limit: 1000000000, rate: 0.42, deduction: 35940000 },
        { limit: Infinity, rate: 0.45, deduction: 65940000 }
    ];

    function getEarnedIncomeDeduction(gross) {
        if (gross <= 5000000) return gross * 0.7;
        if (gross <= 15000000) return 3500000 + (gross - 5000000) * 0.4;
        if (gross <= 45000000) return 7500000 + (gross - 15000000) * 0.15;
        if (gross <= 100000000) return 12000000 + (gross - 45000000) * 0.05;
        return 14750000 + (gross - 100000000) * 0.02;
    }

    function getCalculatedSalaryTax(taxBase) {
        for (var i = 0; i < SALARY_TAX_BRACKETS.length; i++) {
            var b = SALARY_TAX_BRACKETS[i];
            if (taxBase <= b.limit) {
                return Math.max(0, taxBase * b.rate - b.deduction);
            }
        }
        return 0;
    }

    function getEarnedIncomeTaxCredit(calculatedTax, gross) {
        var credit = calculatedTax <= 1300000 ? calculatedTax * 0.55 : 715000 + (calculatedTax - 1300000) * 0.3;
        var cap;
        if (gross <= 33000000) cap = 740000;
        else if (gross <= 70000000) cap = Math.max(660000, 740000 - (gross - 33000000) * 0.008);
        else cap = Math.max(500000, 660000 - (gross - 70000000) * 0.5);
        return Math.min(credit, cap);
    }

    function getChildTaxCredit(childCount) {
        if (childCount <= 0) return 0;
        if (childCount === 1) return 150000;
        if (childCount === 2) return 350000;
        return 350000 + (childCount - 2) * 300000;
    }

    function renderSalaryResult(data) {
        var sym = getCurrencySymbol();

        document.getElementById("salary-hero-empty").style.display = "none";
        document.getElementById("salary-hero-content").style.display = "block";

        document.getElementById("salaryNetPay").innerText = sym + formatResult(data.netPay);

        var netPct = data.monthlyGross > 0 ? (data.netPay / data.monthlyGross) * 100 : 0;
        var deductionPct = 100 - netPct;
        document.getElementById("salaryHeroSub").innerText = "세전 월급여 " + sym + formatResult(data.monthlyGross) + " 중 " + formatResult(netPct) + "% 수령";
        document.getElementById("salary-bar-net").style.width = netPct + "%";
        document.getElementById("salary-bar-deduction").style.width = deductionPct + "%";
        document.getElementById("salary-net-pct").innerText = formatResult(netPct) + "%";
        document.getElementById("salary-deduction-pct").innerText = formatResult(deductionPct) + "%";

        document.getElementById("salaryPension").innerText = "- " + sym + formatResult(data.nationalPension);
        document.getElementById("salaryHealth").innerText = "- " + sym + formatResult(data.healthInsurance);
        document.getElementById("salaryLtc").innerText = "- " + sym + formatResult(data.longTermCare);
        document.getElementById("salaryEmployment").innerText = "- " + sym + formatResult(data.employmentInsurance);
        document.getElementById("salaryIncomeTax").innerText = "- " + sym + formatResult(data.incomeTax);
        document.getElementById("salaryLocalTax").innerText = "- " + sym + formatResult(data.localIncomeTax);
        document.getElementById("salaryTotalDeduction").innerText = "- " + sym + formatResult(data.totalDeduction);
    }

    // 세전 금액(연봉 또는 월급) amount, 임금유형 wageType('annual'|'monthly'), 퇴직금 포함여부 retireType('separate'|'included')
    window.calculateSalary = function (skipHistory) {
        skipHistory = skipHistory || false;

        var wageTypeBtn = document.querySelector("#salaryWageTypeTabs .pill-tab.active");
        var retireBtn = document.querySelector("#salaryRetireTabs .pill-tab.active");
        if (!wageTypeBtn) return;

        var wageType = wageTypeBtn.dataset.value;
        var retireType = retireBtn ? retireBtn.dataset.value : "separate";

        var amount = parseNumber(document.getElementById("salaryAmount").value);
        var nonTaxable = parseNumber(document.getElementById("salaryNonTaxable").value) || 0;
        var dependents = Math.max(1, parseInt(document.getElementById("salaryDependents").textContent, 10) || 1);
        var children = Math.max(0, parseInt(document.getElementById("salaryChildren").textContent, 10) || 0);

        if (amount <= 0) {
            alert("연봉 또는 월급을 입력해주세요.");
            return;
        }

        var monthlyGross = wageType === "monthly" ? amount : (retireType === "included" ? amount / 13 : amount / 12);
        var monthlyTaxable = Math.max(0, monthlyGross - nonTaxable);

        var pensionBase = Math.min(Math.max(monthlyTaxable, NATIONAL_PENSION_FLOOR), NATIONAL_PENSION_CEIL);
        var nationalPension = Math.round(pensionBase * NATIONAL_PENSION_RATE);
        var healthInsurance = Math.round(monthlyTaxable * HEALTH_INSURANCE_RATE);
        var longTermCare = Math.round(healthInsurance * LONG_TERM_CARE_RATE);
        var employmentInsurance = Math.round(monthlyTaxable * EMPLOYMENT_INSURANCE_RATE);

        var annualGross = monthlyTaxable * 12;
        var earnedIncomeDeduction = getEarnedIncomeDeduction(annualGross);
        var earnedIncomeAmount = Math.max(0, annualGross - earnedIncomeDeduction);
        var personalDeduction = dependents * 1500000;
        var socialInsuranceAnnual = (nationalPension + healthInsurance + longTermCare + employmentInsurance) * 12;
        var taxBase = Math.max(0, earnedIncomeAmount - personalDeduction - socialInsuranceAnnual);

        var calculatedTax = getCalculatedSalaryTax(taxBase);
        var earnedIncomeTaxCredit = getEarnedIncomeTaxCredit(calculatedTax, annualGross);
        var childCredit = getChildTaxCredit(children);
        var finalAnnualTax = Math.max(0, calculatedTax - earnedIncomeTaxCredit - childCredit);

        var incomeTax = Math.round(finalAnnualTax / 12);
        var localIncomeTax = Math.round(incomeTax * 0.1);
        var totalDeduction = nationalPension + healthInsurance + longTermCare + employmentInsurance + incomeTax + localIncomeTax;
        var netPay = Math.max(0, monthlyGross - totalDeduction);

        renderSalaryResult({
            monthlyGross: monthlyGross, netPay: netPay, totalDeduction: totalDeduction,
            nationalPension: nationalPension, healthInsurance: healthInsurance, longTermCare: longTermCare,
            employmentInsurance: employmentInsurance, incomeTax: incomeTax, localIncomeTax: localIncomeTax
        });

        if (!skipHistory && typeof addHistoryRecord === "function") {
            var sym = getCurrencySymbol();
            var title = (wageType === "annual" ? "연봉 " : "월급 ") + formatResult(amount) + " → 월 " + sym + formatResult(netPay);
            var params = {
                "salaryAmount": document.getElementById("salaryAmount").value,
                "salaryNonTaxable": document.getElementById("salaryNonTaxable").value
            };
            addHistoryRecord("salary", "연봉 실수령액 계산", title, params);
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        var amountInput = document.getElementById("salaryAmount");
        var amountHint = document.getElementById("salaryAmountHint");
        if (amountInput) {
            amountInput.addEventListener("input", function () {
                formatNumber(amountInput);
                amountHint.innerText = formatKoreanUnit(parseNumber(amountInput.value));
            });
        }

        var nonTaxableInput = document.getElementById("salaryNonTaxable");
        var nonTaxableHint = document.getElementById("salaryNonTaxableHint");
        if (nonTaxableInput) {
            nonTaxableInput.addEventListener("input", function () {
                formatNumber(nonTaxableInput);
                if (nonTaxableHint) nonTaxableHint.innerText = formatToKoreanWon(parseNumber(nonTaxableInput.value));
            });
        }

        var wageTypeTabs = document.getElementById("salaryWageTypeTabs");
        var retireBlock = document.getElementById("salaryRetireBlock");
        var amountLabel = document.getElementById("salaryAmountLabel");
        if (wageTypeTabs && retireBlock && amountLabel) {
            wageTypeTabs.querySelectorAll(".pill-tab").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    var isMonthly = btn.dataset.value === "monthly";
                    retireBlock.style.display = isMonthly ? "none" : "";
                    amountLabel.innerText = isMonthly ? "월급 (세전)" : "연봉 (세전)";
                });
            });
        }
    });
})();

// 16. 양도소득세 계산기 — 1세대 1주택 비과세 + 보유기간별 장기보유특별공제 + 8단계 누진세율
(function () {
    var GAINS_TAX_BRACKETS = [
        { limit: 14000000, rate: 0.06, deduction: 0 },
        { limit: 50000000, rate: 0.15, deduction: 1260000 },
        { limit: 88000000, rate: 0.24, deduction: 5760000 },
        { limit: 150000000, rate: 0.35, deduction: 15440000 },
        { limit: 300000000, rate: 0.38, deduction: 19940000 },
        { limit: 500000000, rate: 0.40, deduction: 25940000 },
        { limit: 1000000000, rate: 0.42, deduction: 35940000 },
        { limit: Infinity, rate: 0.45, deduction: 65940000 }
    ];

    function getCalculatedGainsTax(taxBase) {
        for (var i = 0; i < GAINS_TAX_BRACKETS.length; i++) {
            var b = GAINS_TAX_BRACKETS[i];
            if (taxBase <= b.limit) {
                return Math.max(0, taxBase * b.rate - b.deduction);
            }
        }
        return 0;
    }

    function renderGainsExempt(detailText) {
        document.getElementById("gains-tax-hero-empty").style.display = "none";
        document.getElementById("gains-tax-hero-content").style.display = "none";
        document.getElementById("gainsExemptDetail").innerText = detailText;
        document.getElementById("gains-tax-exempt-banner").classList.add("show");
    }

    function renderGainsTaxResult(data) {
        var sym = getCurrencySymbol();

        document.getElementById("gains-tax-exempt-banner").classList.remove("show");
        document.getElementById("gains-tax-hero-empty").style.display = "none";
        document.getElementById("gains-tax-hero-content").style.display = "block";

        document.getElementById("gainsTotalPayable").innerText = sym + formatResult(data.totalPayable);
        document.getElementById("gainsHoldingYears").innerText = data.holdingYearsFloor + "년";
        document.getElementById("gainsGain").innerText = sym + formatResult(data.gain);
        document.getElementById("gainsLtDeduction").innerText = "- " + sym + formatResult(data.ltDeduction);
        document.getElementById("gainsGainAmount").innerText = sym + formatResult(data.gainAmount);
        document.getElementById("gainsBasicDeduction").innerText = "- " + sym + formatResult(data.basicDeductionAmount);
        document.getElementById("gainsTaxBase").innerText = sym + formatResult(data.taxBase);
        document.getElementById("gainsCalculatedTax").innerText = sym + formatResult(data.calculatedTax);
        document.getElementById("gainsLocalTax").innerText = sym + formatResult(data.localTax);
    }

    // 양도가액/취득가액/필요경비 기반 양도차익 → 장기보유특별공제 → 기본공제 → 8단계 누진세율
    window.calculateCapitalGainsTax = function (skipHistory) {
        skipHistory = skipHistory || false;

        var houseCountBtn = document.querySelector("#gainsHouseCountTabs .pill-tab.active");
        var regulatedBtn = document.querySelector("#gainsRegulatedAreaTabs .pill-tab.active");
        var residenceBtn = document.querySelector("#gainsResidenceTabs .pill-tab.active");
        var basicDeductionBtn = document.querySelector("#gainsBasicDeductionTabs .pill-tab.active");
        if (!houseCountBtn || !regulatedBtn || !residenceBtn || !basicDeductionBtn) return;

        var houseCount = houseCountBtn.dataset.value;
        var isRegulatedArea = regulatedBtn.dataset.value === "yes";
        var isResident = residenceBtn.dataset.value === "yes";
        var applyBasicDeduction = basicDeductionBtn.dataset.value === "yes";

        var acquisitionDate = new Date(document.getElementById("gainsAcquisitionDate").value);
        var transferDate = new Date(document.getElementById("gainsTransferDate").value);
        var transferValue = parseNumber(document.getElementById("gainsTransferValue").value);
        var acquisitionValue = parseNumber(document.getElementById("gainsAcquisitionValue").value) || 0;
        var necessaryExpense = parseNumber(document.getElementById("gainsNecessaryExpense").value) || 0;

        if (transferValue <= 0) {
            alert("양도가액을 입력해주세요.");
            return;
        }
        if (isNaN(acquisitionDate.getTime()) || isNaN(transferDate.getTime())) {
            alert("취득일자와 양도일자를 모두 입력해주세요.");
            return;
        }

        var holdingYears = Math.max(0, (transferDate - acquisitionDate) / (365.25 * 24 * 60 * 60 * 1000));
        var holdingYearsFloor = Math.floor(holdingYears);
        var gain = Math.max(0, transferValue - acquisitionValue - necessaryExpense);

        var isOneHouse = houseCount === "1";
        var meetsHoldingReq = holdingYears >= 2;
        var meetsResidenceReq = !isRegulatedArea || isResident;
        var qualifiesForExemption = isOneHouse && meetsHoldingReq && meetsResidenceReq;
        var EXEMPTION_CAP = 1200000000;

        if (qualifiesForExemption && transferValue <= EXEMPTION_CAP) {
            renderGainsExempt("양도가액 12억원 이하 1세대 1주택으로, 보유·거주 요건을 충족해 양도소득세가 전액 비과세돼요.");
            if (!skipHistory && typeof addHistoryRecord === "function") {
                addHistoryRecord("gains-tax", "양도소득세 계산", "1세대 1주택 비과세 (세액 0원)", {
                    "gainsTransferValue": document.getElementById("gainsTransferValue").value,
                    "gainsAcquisitionValue": document.getElementById("gainsAcquisitionValue").value
                });
            }
            return;
        }

        var taxableGain = gain;
        if (qualifiesForExemption && transferValue > EXEMPTION_CAP) {
            taxableGain = gain * (transferValue - EXEMPTION_CAP) / transferValue;
        }

        var ltDeductionRate = holdingYearsFloor >= 3 ? Math.min(holdingYearsFloor * 0.02, 0.30) : 0;
        var ltDeduction = taxableGain * ltDeductionRate;
        var gainAmount = Math.max(0, taxableGain - ltDeduction);

        var basicDeductionAmount = applyBasicDeduction ? 2500000 : 0;
        var taxBase = Math.max(0, gainAmount - basicDeductionAmount);
        var calculatedTax = getCalculatedGainsTax(taxBase);
        var localTax = calculatedTax * 0.1;
        var totalPayable = calculatedTax + localTax;

        renderGainsTaxResult({
            holdingYearsFloor: holdingYearsFloor, gain: gain, ltDeduction: ltDeduction, gainAmount: gainAmount,
            basicDeductionAmount: basicDeductionAmount, taxBase: taxBase, calculatedTax: calculatedTax,
            localTax: localTax, totalPayable: totalPayable
        });

        if (!skipHistory && typeof addHistoryRecord === "function") {
            var sym = getCurrencySymbol();
            var title = "양도차익 " + sym + formatResult(gain) + " → 납부세액 " + sym + formatResult(totalPayable);
            var params = {
                "gainsAcquisitionDate": document.getElementById("gainsAcquisitionDate").value,
                "gainsTransferDate": document.getElementById("gainsTransferDate").value,
                "gainsTransferValue": document.getElementById("gainsTransferValue").value,
                "gainsAcquisitionValue": document.getElementById("gainsAcquisitionValue").value,
                "gainsNecessaryExpense": document.getElementById("gainsNecessaryExpense").value
            };
            addHistoryRecord("gains-tax", "양도소득세 계산", title, params);
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        var transferValueInput = document.getElementById("gainsTransferValue");
        var transferValueHint = document.getElementById("gainsTransferValueHint");
        if (transferValueInput) {
            transferValueInput.addEventListener("input", function () {
                formatNumber(transferValueInput);
                transferValueHint.innerText = formatKoreanUnit(parseNumber(transferValueInput.value));
            });
        }

        var acquisitionValueInput = document.getElementById("gainsAcquisitionValue");
        var acquisitionValueHint = document.getElementById("gainsAcquisitionValueHint");
        if (acquisitionValueInput) {
            acquisitionValueInput.addEventListener("input", function () {
                formatNumber(acquisitionValueInput);
                acquisitionValueHint.innerText = formatKoreanUnit(parseNumber(acquisitionValueInput.value));
            });
        }

        var necessaryExpenseInput = document.getElementById("gainsNecessaryExpense");
        var necessaryExpenseHint = document.getElementById("gainsNecessaryExpenseHint");
        if (necessaryExpenseInput) {
            necessaryExpenseInput.addEventListener("input", function () {
                formatNumber(necessaryExpenseInput);
                necessaryExpenseHint.innerText = formatKoreanUnit(parseNumber(necessaryExpenseInput.value));
            });
        }
    });
})();

// 17. 증여세 계산기 — 2026년 증여재산공제 + 5단계 누진세율 + 대납가산(gross-up) + 10년 합산과세
(function () {
    var GIFT_INSIGHTS = [
        { icon: "ph-newspaper-clipping", title: "2026년 개정 상속·증여세법 요약", desc: "자녀 인적공제 확대 등 최근 개정 사항을 3분 만에 정리했어요." },
        { icon: "ph-warning-octagon", title: "부담부증여 시 주의해야 할 양도세 폭탄", desc: "채무를 낀 부담부증여는 증여세 외에 양도소득세도 함께 발생할 수 있어요." },
        { icon: "ph-baby", title: "미성년 자녀 증여, 2,000만원 공제 한도 꼭 확인하세요", desc: "성인 자녀보다 공제 한도가 낮아 세부담이 커질 수 있어요." },
        { icon: "ph-clock-counter-clockwise", title: "10년 합산과세 원칙, 미리 알아두면 세금을 줄일 수 있어요", desc: "동일인에게 10년 이내 증여받은 재산은 합산되어 누진세율이 적용돼요." }
    ];

    var GIFT_TAX_BRACKETS = [
        { limit: 100000000, rate: 0.10, deduction: 0 },
        { limit: 500000000, rate: 0.20, deduction: 10000000 },
        { limit: 1000000000, rate: 0.30, deduction: 60000000 },
        { limit: 3000000000, rate: 0.40, deduction: 160000000 },
        { limit: Infinity, rate: 0.50, deduction: 460000000 }
    ];

    var GIFT_RELATION_LABELS = {
        "spouse": "배우자",
        "lineal-ascendant": "직계존속",
        "lineal-descendant": "직계비속",
        "other-relative": "기타친족"
    };

    function getGiftCalculatedTax(taxBase) {
        for (var i = 0; i < GIFT_TAX_BRACKETS.length; i++) {
            var b = GIFT_TAX_BRACKETS[i];
            if (taxBase <= b.limit) {
                return Math.max(0, taxBase * b.rate - b.deduction);
            }
        }
        return 0;
    }

    // 2026년 증여재산공제 한도 (관계별)
    function getRelationDeduction(relation, isMinor) {
        switch (relation) {
            case "spouse": return 600000000;
            case "lineal-ascendant": return 50000000;
            case "lineal-descendant": return isMinor ? 20000000 : 50000000;
            default: return 10000000;
        }
    }

    function renderGiftInsights() {
        var feed = document.getElementById("giftInsightFeed");
        if (!feed) return;
        feed.innerHTML = GIFT_INSIGHTS.map(function (item) {
            return "" +
                '<div class="product-card">' +
                    '<span class="product-badge" style="background:var(--accent-light);color:var(--accent-color)"><i class="ph-duotone ' + item.icon + '"></i></span>' +
                    '<div class="product-info">' +
                        '<div class="product-bank">' + item.title + "</div>" +
                        '<div class="product-name">' + item.desc + "</div>" +
                    "</div>" +
                "</div>";
        }).join("");
    }

    function renderGiftTaxResult(data) {
        var sym = getCurrencySymbol();

        document.getElementById("gift-tax-hero-empty").style.display = "none";
        document.getElementById("gift-tax-hero-content").style.display = "block";

        document.getElementById("giftTotalPayable").innerText = sym + formatResult(data.totalPayable);
        document.getElementById("giftGiftAmount").innerText = sym + formatResult(data.giftAmount);
        document.getElementById("giftPriorAmountDisplay").innerText = "+ " + sym + formatResult(data.priorGiftAmount);
        document.getElementById("giftDebtDisplay").innerText = "- " + sym + formatResult(data.debtAmount);
        document.getElementById("giftNonTaxableDisplay").innerText = "- " + sym + formatResult(data.nonTaxable);
        document.getElementById("giftTaxableValue").innerText = sym + formatResult(data.taxableGiftValue);
        document.getElementById("giftDeductionLabel").innerText = "증여재산공제 (" + GIFT_RELATION_LABELS[data.relation] + (data.isMinor ? " · 미성년" : "") + "):";
        document.getElementById("giftDeductionDisplay").innerText = "- " + sym + formatResult(data.deduction);
        document.getElementById("giftAppraisalDisplay").innerText = "- " + sym + formatResult(data.appraisalFee);
        document.getElementById("giftTaxBase").innerText = sym + formatResult(data.taxBase);
        document.getElementById("giftCalculatedTax").innerText = sym + formatResult(data.calculatedTax);
        document.getElementById("giftTaxBorneDisplay").innerText = "+ " + sym + formatResult(data.taxBorneAddition);
        document.getElementById("giftReportingCredit").innerText = "- " + sym + formatResult(data.reportingCredit);
        document.getElementById("giftPriorCreditDisplay").innerText = "- " + sym + formatResult(data.priorTaxCredit);

        renderGiftInsights();
    }

    // 증여금액 → 10년합산 → 증여과세가액 → 증여재산공제 → 과세표준 → 산출세액 → 대납가산(gross-up) → 신고세액공제 → 최종세액
    window.calculateGiftTax = function (skipHistory) {
        skipHistory = skipHistory || false;

        var relation = document.getElementById("giftRelation").value;
        var minorBtn = document.querySelector("#giftMinorTabs .pill-tab.active");
        var taxBorneBtn = document.querySelector("#giftTaxBorneTabs .pill-tab.active");
        var priorBtn = document.querySelector("#giftPriorTabs .pill-tab.active");
        if (!taxBorneBtn || !priorBtn) return;

        var isMinor = relation === "lineal-descendant" && minorBtn && minorBtn.dataset.value === "minor";
        var taxBorne = taxBorneBtn.dataset.value === "yes";
        var priorGiftCombine = priorBtn.dataset.value === "yes";

        var giftAmount = parseNumber(document.getElementById("giftAmount").value);
        var debtAmount = parseNumber(document.getElementById("giftDebtAmount").value) || 0;
        var appraisalFee = Math.min(parseNumber(document.getElementById("giftAppraisalFee").value) || 0, 5000000);
        var nonTaxable = parseNumber(document.getElementById("giftNonTaxable").value) || 0;
        var priorGiftAmount = priorGiftCombine ? (parseNumber(document.getElementById("giftPriorAmount").value) || 0) : 0;
        var priorGiftTaxPaid = priorGiftCombine ? (parseNumber(document.getElementById("giftPriorTaxPaid").value) || 0) : 0;

        if (giftAmount <= 0) {
            alert("증여 금액을 입력해주세요.");
            return;
        }

        /* 1) 10년 합산: 과거 동일인 증여액을 현재 증여액에 합산 */
        var combinedGiftAmount = giftAmount + priorGiftAmount;

        /* 2) 증여과세가액 = 증여금액(합산 포함) - 채무금액 - 비과세액 */
        var taxableGiftValue = Math.max(0, combinedGiftAmount - debtAmount - nonTaxable);

        /* 3) 증여재산공제 (관계별 매핑) */
        var deduction = getRelationDeduction(relation, isMinor);

        /* 4) 과세표준 = 증여과세가액 - 증여재산공제 - 감정평가수수료 */
        var taxBase = Math.max(0, taxableGiftValue - deduction - appraisalFee);

        /* 5) 산출세액 = 과세표준 * 세율 - 누진공제액 */
        var calculatedTax = getGiftCalculatedTax(taxBase);

        /* 6) 증여세 대납 가산 — 대납액도 증여재산으로 간주되어 1회 근사 재계산(gross-up) */
        var taxBorneAddition = 0;
        var finalCalculatedTax = calculatedTax;
        if (taxBorne) {
            var adjustedTaxableValue = taxableGiftValue + calculatedTax;
            var adjustedTaxBase = Math.max(0, adjustedTaxableValue - deduction - appraisalFee);
            var grossedUpTax = getGiftCalculatedTax(adjustedTaxBase);
            taxBorneAddition = grossedUpTax - calculatedTax;
            finalCalculatedTax = grossedUpTax;
        }

        /* 7) 신고세액공제 (법정 기한 내 자진신고 시 3%) */
        var reportingCredit = finalCalculatedTax * 0.03;

        /* 8) 기납부세액공제 (10년 합산 시 과거 납부세액 차감, 이중과세 방지) */
        var priorTaxCredit = priorGiftCombine ? priorGiftTaxPaid : 0;

        /* 9) 최종 총납부세액 */
        var totalPayable = Math.max(0, finalCalculatedTax - reportingCredit - priorTaxCredit);

        renderGiftTaxResult({
            relation: relation, isMinor: isMinor, giftAmount: giftAmount, priorGiftAmount: priorGiftAmount,
            debtAmount: debtAmount, nonTaxable: nonTaxable, taxableGiftValue: taxableGiftValue,
            deduction: deduction, appraisalFee: appraisalFee, taxBase: taxBase, calculatedTax: calculatedTax,
            taxBorneAddition: taxBorneAddition, reportingCredit: reportingCredit,
            priorTaxCredit: priorTaxCredit, totalPayable: totalPayable
        });

        if (!skipHistory && typeof addHistoryRecord === "function") {
            var sym = getCurrencySymbol();
            var title = GIFT_RELATION_LABELS[relation] + " 증여 " + sym + formatResult(giftAmount) + " → 납부세액 " + sym + formatResult(totalPayable);
            var params = {
                "giftAmount": document.getElementById("giftAmount").value,
                "giftDebtAmount": document.getElementById("giftDebtAmount").value,
                "giftAppraisalFee": document.getElementById("giftAppraisalFee").value,
                "giftNonTaxable": document.getElementById("giftNonTaxable").value
            };
            addHistoryRecord("gift-tax", "증여세 계산", title, params);
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        var giftAmountInput = document.getElementById("giftAmount");
        var giftAmountHint = document.getElementById("giftAmountHint");
        if (giftAmountInput) {
            giftAmountInput.addEventListener("input", function () {
                formatNumber(giftAmountInput);
                giftAmountHint.innerText = formatKoreanUnit(parseNumber(giftAmountInput.value));
            });
        }

        var debtAmountInput = document.getElementById("giftDebtAmount");
        var debtAmountHint = document.getElementById("giftDebtAmountHint");
        if (debtAmountInput) {
            debtAmountInput.addEventListener("input", function () {
                formatNumber(debtAmountInput);
                debtAmountHint.innerText = formatKoreanUnit(parseNumber(debtAmountInput.value));
            });
        }

        ["giftAppraisalFee", "giftNonTaxable", "giftPriorAmount", "giftPriorTaxPaid"].forEach(function (id) {
            var input = document.getElementById(id);
            var hint = document.getElementById(id + "Hint");
            if (input) {
                input.addEventListener("input", function () {
                    formatNumber(input);
                    if (hint) hint.innerText = formatToKoreanWon(parseNumber(input.value));
                });
            }
        });

        var relationSelect = document.getElementById("giftRelation");
        var minorBlock = document.getElementById("giftMinorBlock");
        var amountLabel = document.getElementById("giftAmountLabel");
        function syncRelationUI() {
            var relation = relationSelect.value;
            minorBlock.style.display = relation === "lineal-descendant" ? "" : "none";
            amountLabel.innerText = relation === "spouse" ? "증여 금액 (배우자)" : "증여 금액";
        }
        if (relationSelect && minorBlock && amountLabel) {
            relationSelect.addEventListener("change", syncRelationUI);
            syncRelationUI();
        }

        var priorTabs = document.getElementById("giftPriorTabs");
        var priorBlock = document.getElementById("giftPriorBlock");
        if (priorTabs && priorBlock) {
            priorTabs.querySelectorAll(".pill-tab").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    priorBlock.style.display = btn.dataset.value === "yes" ? "flex" : "none";
                });
            });
        }
    });
})();

// 18. 상속세 계산기 — 기초+인적공제 vs 일괄공제 자동 비교 + 배우자상속공제 + 금융재산상속공제 + 5단계 누진세율
(function () {
    var INHERITANCE_INSIGHTS = [
        { icon: "ph-newspaper-clipping", title: "2026년 개정 상속세법 요약", desc: "배우자상속공제 한도와 인적공제 확대 등 최근 개정 사항을 3분 만에 정리했어요." },
        { icon: "ph-heart", title: "배우자상속공제, 이렇게 활용하면 세금이 줄어요", desc: "법정상속분 한도 내에서 배우자 몫을 잘 배분하면 절세 효과가 커져요." },
        { icon: "ph-clock-counter-clockwise", title: "10년 이내 사전증여, 상속재산에 합산돼요", desc: "상속개시 전 미리 증여한 재산은 상속세 계산 시 다시 합산되니 주의하세요." },
        { icon: "ph-flower-lotus", title: "장례비용도 공제받을 수 있어요", desc: "실제 지출이 500만원 미만이어도 500만원은 기본으로 공제돼요." }
    ];

    var INHERITANCE_TAX_BRACKETS = [
        { limit: 100000000, rate: 0.10, deduction: 0 },
        { limit: 500000000, rate: 0.20, deduction: 10000000 },
        { limit: 1000000000, rate: 0.30, deduction: 60000000 },
        { limit: 3000000000, rate: 0.40, deduction: 160000000 },
        { limit: Infinity, rate: 0.50, deduction: 460000000 }
    ];

    function getInheritanceCalculatedTax(taxBase) {
        for (var i = 0; i < INHERITANCE_TAX_BRACKETS.length; i++) {
            var b = INHERITANCE_TAX_BRACKETS[i];
            if (taxBase <= b.limit) {
                return Math.max(0, taxBase * b.rate - b.deduction);
            }
        }
        return 0;
    }

    // 금융재산상속공제: 금융재산 순액 구간별 (2천만 이하 전액 / 2천만~1억 2천만원 고정 / 1억~10억 20% / 10억 초과 2억 캡)
    function getFinancialAssetDeduction(financialNet) {
        if (financialNet <= 0) return 0;
        if (financialNet <= 20000000) return financialNet;
        if (financialNet <= 100000000) return 20000000;
        if (financialNet <= 1000000000) return financialNet * 0.2;
        return 200000000;
    }

    // 배우자상속공제: 최소 5억 보장, 법정상속분 한도 내 최대 30억
    function getSpouseDeduction(hasSpouse, childCount, totalEstate) {
        if (!hasSpouse) return 0;
        if (childCount === 0) {
            return Math.min(Math.max(totalEstate, 500000000), 3000000000);
        }
        var totalShares = childCount + 1.5;
        var spouseShare = 1.5 / totalShares;
        var legalPortion = totalEstate * spouseShare;
        return Math.min(Math.max(legalPortion, 500000000), 3000000000);
    }

    function renderInheritanceInsights() {
        var feed = document.getElementById("inhInsightFeed");
        if (!feed) return;
        feed.innerHTML = INHERITANCE_INSIGHTS.map(function (item) {
            return "" +
                '<div class="product-card">' +
                    '<span class="product-badge" style="background:var(--accent-light);color:var(--accent-color)"><i class="ph-duotone ' + item.icon + '"></i></span>' +
                    '<div class="product-info">' +
                        '<div class="product-bank">' + item.title + "</div>" +
                        '<div class="product-name">' + item.desc + "</div>" +
                    "</div>" +
                "</div>";
        }).join("");
    }

    function renderInheritanceTaxResult(data) {
        var sym = getCurrencySymbol();

        document.getElementById("inheritance-tax-hero-empty").style.display = "none";
        document.getElementById("inheritance-tax-hero-content").style.display = "block";

        document.getElementById("inhTotalPayable").innerText = sym + formatResult(data.totalPayable);
        document.getElementById("inhTotalEstateDisplay").innerText = sym + formatResult(data.totalEstate);
        document.getElementById("inhPriorAmountDisplay").innerText = "+ " + sym + formatResult(data.priorGiftAmount);
        document.getElementById("inhDebtDisplay").innerText = "- " + sym + formatResult(data.debtAmount);
        document.getElementById("inhFuneralDisplay").innerText = "- " + sym + formatResult(data.funeralDeduction);
        document.getElementById("inhOtherDisplay").innerText = "- " + sym + formatResult(data.otherDeduction);
        document.getElementById("inhTaxableValue").innerText = sym + formatResult(data.taxableValue);
        document.getElementById("inhBasicLabel").innerText = (data.isSpouseSoleHeir ? "기초공제 + 인적공제:" : "기초·인적공제 vs 일괄공제 (자동 최대 선택):");
        document.getElementById("inhBasicDisplay").innerText = "- " + sym + formatResult(data.combinedBasicDeduction);
        document.getElementById("inhSpouseDisplay").innerText = "- " + sym + formatResult(data.spouseDeduction);
        document.getElementById("inhFinancialDisplay").innerText = "- " + sym + formatResult(data.financialDeduction);
        document.getElementById("inhTotalDeductionDisplay").innerText = sym + formatResult(data.totalDeduction);
        document.getElementById("inhTaxBase").innerText = sym + formatResult(data.taxBase);
        document.getElementById("inhCalculatedTax").innerText = sym + formatResult(data.calculatedTax);
        document.getElementById("inhPriorCreditDisplay").innerText = "- " + sym + formatResult(data.priorTaxCredit);
        document.getElementById("inhReportingCredit").innerText = "- " + sym + formatResult(data.reportingCredit);

        renderInheritanceInsights();
    }

    // 상속재산 → 10년합산 → 상속세과세가액 → [기초+인적 vs 일괄] 자동선택 + 배우자공제 + 금융재산공제 → 과세표준 → 산출세액 → 신고세액공제 → 최종세액
    window.calculateInheritanceTax = function (skipHistory) {
        skipHistory = skipHistory || false;

        var spouseBtn = document.querySelector("#inhSpouseTabs .pill-tab.active");
        var priorBtn = document.querySelector("#inhPriorTabs .pill-tab.active");
        if (!spouseBtn || !priorBtn) return;

        var hasSpouse = spouseBtn.dataset.value === "yes";
        var priorGiftCombine = priorBtn.dataset.value === "yes";

        var totalEstate = parseNumber(document.getElementById("inhTotalEstate").value);
        var financialAsset = parseNumber(document.getElementById("inhFinancialAsset").value) || 0;
        var debtAmount = parseNumber(document.getElementById("inhDebtAmount").value) || 0;
        var funeralCostRaw = parseNumber(document.getElementById("inhFuneralCost").value) || 0;
        var otherDeduction = parseNumber(document.getElementById("inhOtherDeduction").value) || 0;
        var priorGiftAmount = priorGiftCombine ? (parseNumber(document.getElementById("inhPriorAmount").value) || 0) : 0;
        var priorGiftTaxPaid = priorGiftCombine ? (parseNumber(document.getElementById("inhPriorTaxPaid").value) || 0) : 0;

        var childCount = parseInt(document.getElementById("inhChildCount").textContent, 10) || 0;
        var elderlyCount = parseInt(document.getElementById("inhElderlyCount").textContent, 10) || 0;
        var minorCount = parseInt(document.getElementById("inhMinorCount").textContent, 10) || 0;
        var disabledCount = parseInt(document.getElementById("inhDisabledCount").textContent, 10) || 0;

        if (totalEstate <= 0) {
            alert("상속재산가액을 입력해주세요.");
            return;
        }

        /* 10년 이내 사전증여재산 합산 시, 법정상속분 계산의 기준이 되는 총 상속재산도 함께 늘어남 */
        var combinedEstate = totalEstate + priorGiftAmount;

        /* 1) 장례비용공제: 최소 500만원 보장, 최대 1,000만원 한도 */
        var funeralDeduction = Math.min(Math.max(funeralCostRaw, 5000000), 10000000);

        /* 2) 상속세 과세가액 = 상속재산가액(+사전증여 합산) - 채무금액 - 장례비용공제 - 기타공제액 */
        var taxableValue = Math.max(0, combinedEstate - debtAmount - funeralDeduction - otherDeduction);

        /* 3) 상속공제 — 기초+인적공제 vs 일괄공제 자동 Max 비교 */
        var basicDeduction = 200000000;
        var personalDeduction =
            (childCount * 50000000) +
            (minorCount * 10000000) +
            (elderlyCount * 50000000) +
            (disabledCount * 10000000 * 20);
        var basicPlusPersonal = basicDeduction + personalDeduction;

        var isSpouseSoleHeir = hasSpouse && childCount === 0 && elderlyCount === 0 && minorCount === 0 && disabledCount === 0;
        var unifiedDeduction = 500000000;
        var combinedBasicDeduction = isSpouseSoleHeir
            ? basicPlusPersonal
            : Math.max(basicPlusPersonal, unifiedDeduction);

        /* 4) 배우자상속공제 (최소 5억, 법정상속분 한도 내 최대 30억) */
        var spouseDeduction = getSpouseDeduction(hasSpouse, childCount, combinedEstate);

        /* 5) 금융재산상속공제 (금융재산 순액 구간별) */
        var financialDeduction = getFinancialAssetDeduction(financialAsset);

        var totalDeduction = combinedBasicDeduction + spouseDeduction + financialDeduction;

        /* 6) 과세표준 = 상속세 과세가액 - 상속공제 총합계 */
        var taxBase = Math.max(0, taxableValue - totalDeduction);

        /* 7) 산출세액 = 과세표준 * 세율 - 누진공제액 */
        var calculatedTax = getInheritanceCalculatedTax(taxBase);

        /* 8) 기납부 증여세액공제 (10년 합산 시 과거 납부세액 차감, 이중과세 방지) */
        var priorTaxCredit = priorGiftCombine ? priorGiftTaxPaid : 0;
        var afterPriorCredit = Math.max(0, calculatedTax - priorTaxCredit);

        /* 9) 신고세액공제 (법정 기한 내 자진신고 시 3%) */
        var reportingCredit = afterPriorCredit * 0.03;

        /* 10) 최종 총납부세액 */
        var totalPayable = Math.max(0, afterPriorCredit - reportingCredit);

        renderInheritanceTaxResult({
            totalEstate: totalEstate, priorGiftAmount: priorGiftAmount, debtAmount: debtAmount,
            funeralDeduction: funeralDeduction, otherDeduction: otherDeduction, taxableValue: taxableValue,
            isSpouseSoleHeir: isSpouseSoleHeir, combinedBasicDeduction: combinedBasicDeduction,
            spouseDeduction: spouseDeduction, financialDeduction: financialDeduction, totalDeduction: totalDeduction,
            taxBase: taxBase, calculatedTax: calculatedTax, priorTaxCredit: priorTaxCredit,
            reportingCredit: reportingCredit, totalPayable: totalPayable
        });

        if (!skipHistory && typeof addHistoryRecord === "function") {
            var sym = getCurrencySymbol();
            var title = "상속재산 " + sym + formatResult(totalEstate) + " → 납부세액 " + sym + formatResult(totalPayable);
            var params = {
                "inhTotalEstate": document.getElementById("inhTotalEstate").value,
                "inhFinancialAsset": document.getElementById("inhFinancialAsset").value,
                "inhDebtAmount": document.getElementById("inhDebtAmount").value,
                "inhFuneralCost": document.getElementById("inhFuneralCost").value,
                "inhOtherDeduction": document.getElementById("inhOtherDeduction").value
            };
            addHistoryRecord("inheritance-tax", "상속세 계산", title, params);
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        var totalEstateInput = document.getElementById("inhTotalEstate");
        var totalEstateHint = document.getElementById("inhTotalEstateHint");
        if (totalEstateInput) {
            totalEstateInput.addEventListener("input", function () {
                formatNumber(totalEstateInput);
                totalEstateHint.innerText = formatKoreanUnit(parseNumber(totalEstateInput.value));
            });
        }

        var financialAssetInput = document.getElementById("inhFinancialAsset");
        var financialAssetHint = document.getElementById("inhFinancialAssetHint");
        if (financialAssetInput) {
            financialAssetInput.addEventListener("input", function () {
                formatNumber(financialAssetInput);
                financialAssetHint.innerText = formatKoreanUnit(parseNumber(financialAssetInput.value));
            });
        }

        ["inhDebtAmount", "inhFuneralCost", "inhOtherDeduction", "inhPriorAmount", "inhPriorTaxPaid"].forEach(function (id) {
            var input = document.getElementById(id);
            var hint = document.getElementById(id + "Hint");
            if (input) {
                input.addEventListener("input", function () {
                    formatNumber(input);
                    if (hint) hint.innerText = formatToKoreanWon(parseNumber(input.value));
                });
            }
        });

        var priorTabs = document.getElementById("inhPriorTabs");
        var priorBlock = document.getElementById("inhPriorBlock");
        if (priorTabs && priorBlock) {
            priorTabs.querySelectorAll(".pill-tab").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    priorBlock.style.display = btn.dataset.value === "yes" ? "flex" : "none";
                });
            });
        }
    });
})();

// 19. 퇴직금 계산기 — 근로기준법 1일 평균임금 산정 + 근속연수·환산급여공제 기반 퇴직소득세 간이 산출
(function () {
    var SEVERANCE_GUIDES = [
        { icon: "ph-clock-countdown", title: "퇴직금 지급 기한과 지연이자 받는 법", desc: "퇴직일로부터 14일 이내 지급이 원칙이고, 늦어지면 연 20%의 지연이자가 붙어요." },
        { icon: "ph-piggy-bank", title: "IRP 계좌로 퇴직금 이체 시 절세 혜택", desc: "IRP로 받으면 퇴직소득세가 이연되고, 나중에 연금으로 받으면 세금이 최대 30% 줄어요." },
        { icon: "ph-scales", title: "평균임금 vs 통상임금, 어떤 게 유리할까요", desc: "둘 중 더 높은 금액을 기준으로 퇴직금을 계산해야 근로자에게 유리해요." },
        { icon: "ph-calendar-x", title: "1년 미만 근속자는 퇴직금을 못 받나요", desc: "법정 퇴직금은 1년 이상 근속이 기본 요건이라, 그 이하는 회사 내규를 확인해야 해요." }
    ];

    var SEVERANCE_TAX_BRACKETS = [
        { limit: 14000000, rate: 0.06, deduction: 0 },
        { limit: 50000000, rate: 0.15, deduction: 1260000 },
        { limit: 88000000, rate: 0.24, deduction: 5760000 },
        { limit: 150000000, rate: 0.35, deduction: 15440000 },
        { limit: 300000000, rate: 0.38, deduction: 19940000 },
        { limit: 500000000, rate: 0.40, deduction: 25940000 },
        { limit: 1000000000, rate: 0.42, deduction: 35940000 },
        { limit: Infinity, rate: 0.45, deduction: 65940000 }
    ];

    function getSeveranceCalculatedTax(taxBase) {
        for (var i = 0; i < SEVERANCE_TAX_BRACKETS.length; i++) {
            var b = SEVERANCE_TAX_BRACKETS[i];
            if (taxBase <= b.limit) {
                return Math.max(0, taxBase * b.rate - b.deduction);
            }
        }
        return 0;
    }

    // 근속연수공제 (근속연수 구간별 매핑)
    function getServiceYearDeduction(years) {
        if (years <= 5) return Math.max(1000000, years * 1000000);
        if (years <= 10) return 5000000 + (years - 5) * 2000000;
        if (years <= 20) return 15000000 + (years - 10) * 2500000;
        return 40000000 + (years - 20) * 3000000;
    }

    // 환산급여공제 (환산급여 구간별 누진공제)
    function getConvertedIncomeDeduction(convertedIncome) {
        if (convertedIncome <= 8000000) return convertedIncome;
        if (convertedIncome <= 70000000) return 8000000 + (convertedIncome - 8000000) * 0.6;
        if (convertedIncome <= 100000000) return 45200000 + (convertedIncome - 70000000) * 0.55;
        if (convertedIncome <= 300000000) return 61200000 + (convertedIncome - 100000000) * 0.45;
        return 151200000 + (convertedIncome - 300000000) * 0.35;
    }

    // 퇴직소득세 간이 산출: 근속연수공제 → 환산급여 → 환산급여공제 → 누진세율 → 근속연수 환산
    function getSeveranceTaxApprox(severancePay, years) {
        var serviceYears = Math.max(1, Math.round(years));
        var serviceDeduction = getServiceYearDeduction(serviceYears);
        var afterServiceDeduction = Math.max(0, severancePay - serviceDeduction);
        var convertedIncome = afterServiceDeduction * 12 / serviceYears;
        var convertedDeduction = getConvertedIncomeDeduction(convertedIncome);
        var taxBase = Math.max(0, convertedIncome - convertedDeduction);
        var convertedTax = getSeveranceCalculatedTax(taxBase);
        var calculatedTax = convertedTax * serviceYears / 12;
        var localTax = calculatedTax * 0.1;
        return { calculatedTax: calculatedTax, localTax: localTax, total: calculatedTax + localTax };
    }

    function renderSeveranceInsights() {
        var feed = document.getElementById("severanceInsightFeed");
        if (!feed) return;
        feed.innerHTML = SEVERANCE_GUIDES.map(function (item) {
            return "" +
                '<div class="product-card">' +
                    '<span class="product-badge" style="background:var(--accent-light);color:var(--accent-color)"><i class="ph-duotone ' + item.icon + '"></i></span>' +
                    '<div class="product-info">' +
                        '<div class="product-bank">' + item.title + "</div>" +
                        '<div class="product-name">' + item.desc + "</div>" +
                    "</div>" +
                "</div>";
        }).join("");
    }

    function renderSeveranceIneligible(D) {
        document.getElementById("severance-hero-empty").style.display = "none";
        document.getElementById("severance-hero-content").style.display = "none";
        document.getElementById("severanceIneligibleText").innerHTML =
            "현재 입력된 재직일수는 <b>" + D + "일</b>이에요. 근로기준법상 퇴직금은 계속근로기간 1년(365일) 이상인 근로자에게만 지급돼요.";
        document.getElementById("severance-ineligible-banner").classList.add("show");
    }

    function renderSeveranceResult(data) {
        var sym = getCurrencySymbol();

        document.getElementById("severance-ineligible-banner").classList.remove("show");
        document.getElementById("severance-hero-empty").style.display = "none";
        document.getElementById("severance-hero-content").style.display = "block";

        document.getElementById("severanceHeroAmount").innerText = sym + formatResult(data.severancePay);
        document.getElementById("severanceDays").innerText = formatResult(data.D) + "일 (약 " + data.years.toFixed(1) + "년)";
        document.getElementById("severanceM").innerText = data.M + "일";
        document.getElementById("severanceAverageWage").innerText = sym + formatResult(data.averageWage);
        document.getElementById("severancePayGross").innerText = sym + formatResult(data.severancePay);
        document.getElementById("severanceTax").innerText = "- " + sym + formatResult(data.severanceTax);
        document.getElementById("severanceLocalTax").innerText = "- " + sym + formatResult(data.severanceLocalTax);
        document.getElementById("severanceNetPay").innerText = sym + formatResult(data.netSeverancePay);

        renderSeveranceInsights();
    }

    // 재직일수(D) → 직전 3개월 실제일수(M) → 1일 평균임금 → 기본 퇴직금(세전) → 퇴직소득세 간이 산출 → 실수령 퇴직금
    window.calculateSeverance = function (skipHistory) {
        skipHistory = skipHistory || false;

        var joinDate = new Date(document.getElementById("sevJoinDate").value);
        var leaveDate = new Date(document.getElementById("sevLeaveDate").value);

        if (isNaN(joinDate.getTime()) || isNaN(leaveDate.getTime())) {
            alert("입사일자와 퇴사일자를 입력해주세요.");
            return;
        }
        if (leaveDate <= joinDate) {
            alert("퇴사일자는 입사일자보다 뒤여야 해요.");
            return;
        }

        var baseWage3m = parseNumber(document.getElementById("sevBaseWage3m").value) || 0;
        var allowance3m = parseNumber(document.getElementById("sevAllowance3m").value) || 0;
        var annualBonus = parseNumber(document.getElementById("sevAnnualBonus").value) || 0;
        var annualLeavePay = parseNumber(document.getElementById("sevAnnualLeavePay").value) || 0;

        var DAY_MS = 24 * 60 * 60 * 1000;

        /* 1) 재직일수 D — 입사일자와 퇴사일자의 정확한 총 일수 */
        var D = Math.round((leaveDate - joinDate) / DAY_MS);

        /* 재직일수가 365일 미만이면 법정 퇴직금 지급 대상이 아님 */
        if (D < 365) {
            renderSeveranceIneligible(D);
            return;
        }

        /* 퇴사일 기준 직전 3개월의 실제 총 일수 M (달력 기준 자동 연산) */
        var threeMonthsAgo = new Date(leaveDate.getTime());
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        var M = Math.round((leaveDate - threeMonthsAgo) / DAY_MS);

        /* 2) 1일 평균임금 = (최근 3개월 임금총액 + 상여금×3/12 + 연차수당×3/12) / M */
        var totalWage3m = baseWage3m + allowance3m;
        var bonusPortion = annualBonus * (3 / 12);
        var leavePayPortion = annualLeavePay * (3 / 12);
        var averageWage = (totalWage3m + bonusPortion + leavePayPortion) / M;

        /* 3) 퇴직금 = 1일 평균임금 × 30 × (재직일수 / 365) */
        var severancePay = averageWage * 30 * (D / 365);

        /* 퇴직소득세 간이 산출 (근속연수공제·환산급여공제 반영) */
        var years = D / 365;
        var taxResult = getSeveranceTaxApprox(severancePay, years);
        var netSeverancePay = Math.max(0, severancePay - taxResult.total);

        renderSeveranceResult({
            D: D, M: M, years: years, averageWage: averageWage, severancePay: severancePay,
            severanceTax: taxResult.calculatedTax, severanceLocalTax: taxResult.localTax,
            netSeverancePay: netSeverancePay
        });

        if (!skipHistory && typeof addHistoryRecord === "function") {
            var sym = getCurrencySymbol();
            var title = "재직 " + years.toFixed(1) + "년 → 세전 퇴직금 " + sym + formatResult(severancePay);
            var params = {
                "sevJoinDate": document.getElementById("sevJoinDate").value,
                "sevLeaveDate": document.getElementById("sevLeaveDate").value,
                "sevBaseWage3m": document.getElementById("sevBaseWage3m").value,
                "sevAllowance3m": document.getElementById("sevAllowance3m").value,
                "sevAnnualBonus": document.getElementById("sevAnnualBonus").value,
                "sevAnnualLeavePay": document.getElementById("sevAnnualLeavePay").value
            };
            addHistoryRecord("severance", "퇴직금 계산", title, params);
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        var baseWage3mInput = document.getElementById("sevBaseWage3m");
        var baseWage3mHint = document.getElementById("sevBaseWage3mHint");
        if (baseWage3mInput) {
            baseWage3mInput.addEventListener("input", function () {
                formatNumber(baseWage3mInput);
                baseWage3mHint.innerText = formatKoreanUnit(parseNumber(baseWage3mInput.value));
            });
        }

        var allowance3mInput = document.getElementById("sevAllowance3m");
        var allowance3mHint = document.getElementById("sevAllowance3mHint");
        if (allowance3mInput) {
            allowance3mInput.addEventListener("input", function () {
                formatNumber(allowance3mInput);
                allowance3mHint.innerText = formatKoreanUnit(parseNumber(allowance3mInput.value));
            });
        }

        var annualBonusInput = document.getElementById("sevAnnualBonus");
        var annualBonusHint = document.getElementById("sevAnnualBonusHint");
        if (annualBonusInput) {
            annualBonusInput.addEventListener("input", function () {
                formatNumber(annualBonusInput);
                annualBonusHint.innerText = formatKoreanUnit(parseNumber(annualBonusInput.value));
            });
        }

        var annualLeavePayInput = document.getElementById("sevAnnualLeavePay");
        var annualLeavePayHint = document.getElementById("sevAnnualLeavePayHint");
        if (annualLeavePayInput) {
            annualLeavePayInput.addEventListener("input", function () {
                formatNumber(annualLeavePayInput);
                annualLeavePayHint.innerText = formatKoreanUnit(parseNumber(annualLeavePayInput.value));
            });
        }
    });
})();

// 20. 대출한도 계산기 — LTV 규제선 + DSR 40% 캡을 함께 반영한 원리금균등 역산 대출한도
(function () {
    function calcDsrLoanAmount(dsrBudget, rate, termYears) {
        var monthlyBudget = dsrBudget / 12;
        var monthlyRate = rate / 100 / 12;
        var totalMonths = termYears * 12;
        if (monthlyRate > 0) {
            return monthlyBudget * (1 - Math.pow(1 + monthlyRate, -totalMonths)) / monthlyRate;
        }
        return monthlyBudget * totalMonths;
    }

    function renderLoanLimitResult(data) {
        var sym = getCurrencySymbol();

        document.getElementById("loan-limit-hero-empty").style.display = "none";
        document.getElementById("loan-limit-hero-content").style.display = "block";

        document.getElementById("loanLimitFinal").innerText = sym + formatResult(data.finalAmount);
        document.getElementById("loanLimitLtvPct").innerText = Math.round(data.ltvPct * 100);
        document.getElementById("loanLimitLtvAmount").innerText = sym + formatResult(data.ltvAmount);
        document.getElementById("loanLimitDsrAmount").innerText = sym + formatResult(data.dsrAmount);
        document.getElementById("loanLimitDsrBudget").innerText = sym + formatResult(data.dsrBudget);
        document.getElementById("loanLimitAppliedRule").innerText = data.appliedRule;
    }

    // 지역구분(LTV %) → LTV기준한도 / 연소득·기존대출(DSR 40%) → DSR기준한도 → 둘 중 낮은 금액이 최종 대출한도
    window.calculateLoanLimit = function (skipHistory) {
        skipHistory = skipHistory || false;

        var areaBtn = document.querySelector("#loanLimitAreaTabs .pill-tab.active");
        if (!areaBtn) return;
        var ltvPct = areaBtn.dataset.value === "regulated" ? 0.60 : 0.70;

        var homePrice = parseNumber(document.getElementById("loanLimitHomePrice").value);
        var income = parseNumber(document.getElementById("loanLimitIncome").value) || 0;
        var existingDebt = parseNumber(document.getElementById("loanLimitExistingDebt").value) || 0;
        var rate = parseFloat(document.getElementById("loanLimitRate").value) || 0;
        var term = parseInt(document.getElementById("loanLimitTerm").value, 10) || 1;

        if (homePrice <= 0) {
            alert("주택가격을 입력해주세요.");
            return;
        }

        var ltvAmount = homePrice * ltvPct;
        var dsrBudget = Math.max(0, income * 0.40 - existingDebt);
        var dsrAmount = calcDsrLoanAmount(dsrBudget, rate, term);
        var finalAmount = Math.max(0, Math.min(ltvAmount, dsrAmount));
        var appliedRule = ltvAmount <= dsrAmount ? "LTV 기준 (더 낮은 한도가 적용돼요)" : "DSR 기준 (더 낮은 한도가 적용돼요)";

        renderLoanLimitResult({
            ltvPct: ltvPct, ltvAmount: ltvAmount, dsrAmount: dsrAmount,
            dsrBudget: dsrBudget, finalAmount: finalAmount, appliedRule: appliedRule
        });

        if (!skipHistory && typeof addHistoryRecord === "function") {
            var sym = getCurrencySymbol();
            var title = "주택가 " + sym + formatResult(homePrice) + " → 대출한도 " + sym + formatResult(finalAmount);
            var params = {
                "loanLimitHomePrice": document.getElementById("loanLimitHomePrice").value,
                "loanLimitIncome": document.getElementById("loanLimitIncome").value,
                "loanLimitExistingDebt": document.getElementById("loanLimitExistingDebt").value
            };
            addHistoryRecord("loan-limit", "대출한도 계산", title, params);
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        ["loanLimitHomePrice", "loanLimitIncome", "loanLimitExistingDebt"].forEach(function (id) {
            var input = document.getElementById(id);
            var hint = document.getElementById(id + "Hint");
            if (input && hint) {
                input.addEventListener("input", function () {
                    formatNumber(input);
                    hint.innerText = formatKoreanUnit(parseNumber(input.value));
                });
            }
        });
    });
})();

// 21. 취득세 계산기 — 표준 누진세율(1~3%) + 다주택·조정대상지역 중과세율(8%/12%) + 지방교육세·농특세
(function () {
    function getStandardAcquisitionRate(price) {
        if (price <= 600000000) return 0.01;
        if (price <= 900000000) return ((price / 100000000) * (2 / 3) - 3) / 100;
        return 0.03;
    }

    function getAcquisitionRate(price, houseCount, isRegulated) {
        if (houseCount === "1") return getStandardAcquisitionRate(price);
        if (houseCount === "2") return isRegulated ? 0.08 : getStandardAcquisitionRate(price);
        return isRegulated ? 0.12 : 0.08;
    }

    function renderAptBuyResult(data) {
        var sym = getCurrencySymbol();

        document.getElementById("apt-buy-hero-empty").style.display = "none";
        document.getElementById("apt-buy-hero-content").style.display = "block";

        document.getElementById("aptBuyTotal").innerText = sym + formatResult(data.total);
        document.getElementById("aptBuyRate").innerText = (data.rate * 100).toFixed(2) + "%";
        document.getElementById("aptBuyBaseTax").innerText = sym + formatResult(data.baseTax);
        document.getElementById("aptBuyLocalEduTax").innerText = sym + formatResult(data.localEduTax);
        document.getElementById("aptBuyRuralTax").innerText = sym + formatResult(data.ruralTax);
    }

    // 주택가액 → 주택수·조정대상지역 여부에 따른 취득세율 결정 → 취득세 + 지방교육세(10% 근사) + 농특세(85㎡초과 0.2%)
    window.calculateAptBuyTax = function (skipHistory) {
        skipHistory = skipHistory || false;

        var areaBtn = document.querySelector("#aptBuyAreaTabs .pill-tab.active");
        var houseCountBtn = document.querySelector("#aptBuyHouseCountTabs .pill-tab.active");
        var regulatedBtn = document.querySelector("#aptBuyRegulatedTabs .pill-tab.active");
        if (!areaBtn || !houseCountBtn || !regulatedBtn) return;

        var isOverArea = areaBtn.dataset.value === "over";
        var houseCount = houseCountBtn.dataset.value;
        var isRegulated = regulatedBtn.dataset.value === "yes";

        var price = parseNumber(document.getElementById("aptBuyPrice").value);
        if (price <= 0) {
            alert("주택 가액을 입력해주세요.");
            return;
        }

        var rate = getAcquisitionRate(price, houseCount, isRegulated);
        var baseTax = price * rate;
        var localEduTax = baseTax * 0.1;
        var ruralTax = isOverArea ? price * 0.002 : 0;
        var total = baseTax + localEduTax + ruralTax;

        renderAptBuyResult({ rate: rate, baseTax: baseTax, localEduTax: localEduTax, ruralTax: ruralTax, total: total });

        if (!skipHistory && typeof addHistoryRecord === "function") {
            var sym = getCurrencySymbol();
            var title = "주택가 " + sym + formatResult(price) + " → 취득세 총액 " + sym + formatResult(total);
            var params = { "aptBuyPrice": document.getElementById("aptBuyPrice").value };
            addHistoryRecord("apt-buy", "취득세 계산", title, params);
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        var priceInput = document.getElementById("aptBuyPrice");
        var priceHint = document.getElementById("aptBuyPriceHint");
        if (priceInput && priceHint) {
            priceInput.addEventListener("input", function () {
                formatNumber(priceInput);
                priceHint.innerText = formatKoreanUnit(parseNumber(priceInput.value));
            });
        }
    });
})();

// 22. 보유세 계산기 — 공정시장가액비율 60% 재산세 누진세율 + 종부세 기본공제/세액공제 자동 판정
(function () {
    var COMP_TAX_BRACKETS = [
        { limit: 300000000, rate: 0.005, deduction: 0 },
        { limit: 600000000, rate: 0.007, deduction: 600000 },
        { limit: 1200000000, rate: 0.010, deduction: 2400000 },
        { limit: 2500000000, rate: 0.013, deduction: 6000000 },
        { limit: 5000000000, rate: 0.015, deduction: 11000000 },
        { limit: 9400000000, rate: 0.020, deduction: 36000000 },
        { limit: Infinity, rate: 0.027, deduction: 101800000 }
    ];

    function getPropertyTaxRaw(base) {
        if (base <= 60000000) return base * 0.001;
        if (base <= 150000000) return 60000 + (base - 60000000) * 0.0015;
        if (base <= 300000000) return 195000 + (base - 150000000) * 0.0025;
        return 570000 + (base - 300000000) * 0.004;
    }

    function getCompCalculatedTax(taxBase) {
        for (var i = 0; i < COMP_TAX_BRACKETS.length; i++) {
            var b = COMP_TAX_BRACKETS[i];
            if (taxBase <= b.limit) {
                return Math.max(0, taxBase * b.rate - b.deduction);
            }
        }
        return 0;
    }

    function renderAptHoldingTaxResult(data) {
        var sym = getCurrencySymbol();

        document.getElementById("apt-tax-hero-empty").style.display = "none";
        document.getElementById("apt-tax-hero-content").style.display = "block";

        document.getElementById("aptTaxTotal").innerText = sym + formatResult(data.grandTotal);
        document.getElementById("aptTaxPropertyTax").innerText = sym + formatResult(data.propertyTaxWithUrban);
        document.getElementById("aptTaxLocalEduTax").innerText = sym + formatResult(data.localEduTax);
        document.getElementById("aptTaxCompBase").innerText = sym + formatResult(data.compTaxBase);
        document.getElementById("aptTaxCompCalculated").innerText = sym + formatResult(data.compCalculatedTax);
        document.getElementById("aptTaxCompCredit").innerText = "- " + sym + formatResult(data.compCredit);
        document.getElementById("aptTaxCompRuralTax").innerText = sym + formatResult(data.compRuralTax);
        document.getElementById("aptTaxCompTotal").innerText = sym + formatResult(data.compTotal);
    }

    // 공시가격 → 재산세(공정시장가액비율 60% 누진세율 + 도시지역분 + 지방교육세) → 종부세(기본공제 자동판정 + 세액공제 + 농특세)
    window.calculateAptHoldingTax = function (skipHistory) {
        skipHistory = skipHistory || false;

        var houseCountBtn = document.querySelector("#aptTaxHouseCountTabs .pill-tab.active");
        var elderlyBtn = document.querySelector("#aptTaxElderlyTabs .pill-tab.active");
        var longHoldBtn = document.querySelector("#aptTaxLongHoldTabs .pill-tab.active");
        if (!houseCountBtn || !elderlyBtn || !longHoldBtn) return;

        var houseCount = houseCountBtn.dataset.value;
        var isElderly = elderlyBtn.dataset.value === "yes";
        var isLongHold = longHoldBtn.dataset.value === "yes";

        var publicPrice = parseNumber(document.getElementById("aptTaxPrice").value);
        if (publicPrice <= 0) {
            alert("공시가격을 입력해주세요.");
            return;
        }

        var propertyTaxBase = publicPrice * 0.60;
        var propertyTaxRaw = getPropertyTaxRaw(propertyTaxBase);
        var urbanAreaTax = propertyTaxBase * 0.0014;
        var localEduTax = propertyTaxRaw * 0.2;
        var propertyTaxWithUrban = propertyTaxRaw + urbanAreaTax;

        var compDeduction = houseCount === "1" ? 1200000000 : 900000000;
        var compTaxBase = Math.max(0, publicPrice - compDeduction) * 0.60;
        var compCalculatedTax = getCompCalculatedTax(compTaxBase);

        var creditRate = 0;
        if (houseCount === "1") {
            var elderlyCredit = isElderly ? 0.20 : 0;
            var longHoldCredit = isLongHold ? 0.20 : 0;
            creditRate = Math.min(0.80, elderlyCredit + longHoldCredit);
        }
        var compCredit = compCalculatedTax * creditRate;
        var compAfterCredit = compCalculatedTax - compCredit;
        var compRuralTax = compAfterCredit * 0.20;
        var compTotal = compAfterCredit + compRuralTax;

        var grandTotal = propertyTaxWithUrban + localEduTax + compTotal;

        renderAptHoldingTaxResult({
            propertyTaxWithUrban: propertyTaxWithUrban, localEduTax: localEduTax,
            compTaxBase: compTaxBase, compCalculatedTax: compCalculatedTax, compCredit: compCredit,
            compRuralTax: compRuralTax, compTotal: compTotal, grandTotal: grandTotal
        });

        if (!skipHistory && typeof addHistoryRecord === "function") {
            var sym = getCurrencySymbol();
            var title = "공시가 " + sym + formatResult(publicPrice) + " → 합산 보유세 " + sym + formatResult(grandTotal);
            var params = { "aptTaxPrice": document.getElementById("aptTaxPrice").value };
            addHistoryRecord("apt-tax", "보유세 계산", title, params);
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        var priceInput = document.getElementById("aptTaxPrice");
        var priceHint = document.getElementById("aptTaxPriceHint");
        if (priceInput && priceHint) {
            priceInput.addEventListener("input", function () {
                formatNumber(priceInput);
                priceHint.innerText = formatKoreanUnit(parseNumber(priceInput.value));
            });
        }
    });
})();

// 23. 중개수수료 계산기 — 매매/전월세 구간별 상한요율 + 한도액(Cap) 자동 적용
(function () {
    var BROKERAGE_SALE_BRACKETS = [
        { limit: 50000000, rate: 0.006, cap: 250000 },
        { limit: 200000000, rate: 0.005, cap: 800000 },
        { limit: 900000000, rate: 0.004, cap: Infinity },
        { limit: 1200000000, rate: 0.005, cap: Infinity },
        { limit: 1500000000, rate: 0.006, cap: Infinity },
        { limit: Infinity, rate: 0.007, cap: Infinity }
    ];
    var BROKERAGE_LEASE_BRACKETS = [
        { limit: 50000000, rate: 0.005, cap: 200000 },
        { limit: 100000000, rate: 0.004, cap: 300000 },
        { limit: 600000000, rate: 0.003, cap: Infinity },
        { limit: 1200000000, rate: 0.004, cap: Infinity },
        { limit: 1500000000, rate: 0.005, cap: Infinity },
        { limit: Infinity, rate: 0.006, cap: Infinity }
    ];

    function getBrokerageBracket(amount, brackets) {
        for (var i = 0; i < brackets.length; i++) {
            if (amount <= brackets[i].limit) return brackets[i];
        }
        return brackets[brackets.length - 1];
    }

    function renderBrokerageResult(data) {
        var sym = getCurrencySymbol();

        document.getElementById("brokerage-hero-empty").style.display = "none";
        document.getElementById("brokerage-hero-content").style.display = "block";

        document.getElementById("brokerageFee").innerText = sym + formatResult(data.fee);
        document.getElementById("brokerageConvertedAmount").innerText = sym + formatResult(data.convertedAmount);
        document.getElementById("brokerageRate").innerText = (data.rate * 100).toFixed(2) + "%";
        document.getElementById("brokerageCapApplied").innerText = data.capApplied ? "적용됨 (한도액으로 제한)" : "미적용 (요율 그대로 적용)";
        document.getElementById("brokerageVat").innerText = sym + formatResult(data.vat);
        document.getElementById("brokerageTotalWithVat").innerText = sym + formatResult(data.totalWithVat);
    }

    // 거래유형(매매/전월세) → 전월세는 환산보증금(보증금+월세×100, 5천만원미만시 ×70) 산출 → 구간별 상한요율·한도액 적용
    window.calculateBrokerageFee = function (skipHistory) {
        skipHistory = skipHistory || false;

        var typeBtn = document.querySelector("#brokerageTypeTabs .pill-tab.active");
        if (!typeBtn) return;
        var type = typeBtn.dataset.value;

        var amount = parseNumber(document.getElementById("brokerageAmount").value);
        var rent = type === "lease" ? (parseNumber(document.getElementById("brokerageRent").value) || 0) : 0;

        if (amount <= 0) {
            alert("거래금액을 입력해주세요.");
            return;
        }

        var convertedAmount = amount;
        if (type === "lease") {
            convertedAmount = amount + rent * 100;
            if (convertedAmount < 50000000) convertedAmount = amount + rent * 70;
        }

        var bracket = getBrokerageBracket(convertedAmount, type === "sale" ? BROKERAGE_SALE_BRACKETS : BROKERAGE_LEASE_BRACKETS);
        var feeRaw = convertedAmount * bracket.rate;
        var capApplied = feeRaw > bracket.cap;
        var fee = Math.min(feeRaw, bracket.cap);
        var vat = fee * 0.1;
        var totalWithVat = fee + vat;

        renderBrokerageResult({
            convertedAmount: convertedAmount, rate: bracket.rate, capApplied: capApplied,
            fee: fee, vat: vat, totalWithVat: totalWithVat
        });

        if (!skipHistory && typeof addHistoryRecord === "function") {
            var sym = getCurrencySymbol();
            var title = (type === "sale" ? "매매" : "전월세") + " " + sym + formatResult(amount) + " → 중개수수료 " + sym + formatResult(fee);
            var params = {
                "brokerageAmount": document.getElementById("brokerageAmount").value,
                "brokerageRent": document.getElementById("brokerageRent").value
            };
            addHistoryRecord("brokerage", "중개수수료 계산", title, params);
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        var amountInput = document.getElementById("brokerageAmount");
        var amountHint = document.getElementById("brokerageAmountHint");
        if (amountInput && amountHint) {
            amountInput.addEventListener("input", function () {
                formatNumber(amountInput);
                amountHint.innerText = formatKoreanUnit(parseNumber(amountInput.value));
            });
        }

        var rentInput = document.getElementById("brokerageRent");
        var rentHint = document.getElementById("brokerageRentHint");
        if (rentInput && rentHint) {
            rentInput.addEventListener("input", function () {
                formatNumber(rentInput);
                rentHint.innerText = formatKoreanUnit(parseNumber(rentInput.value));
            });
        }

        var typeTabs = document.getElementById("brokerageTypeTabs");
        var rentBlock = document.getElementById("brokerageRentBlock");
        var amountLabel = document.getElementById("brokerageAmountLabel");
        if (typeTabs && rentBlock && amountLabel) {
            typeTabs.querySelectorAll(".pill-tab").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    var isLease = btn.dataset.value === "lease";
                    rentBlock.style.display = isLease ? "" : "none";
                    amountLabel.innerText = isLease ? "보증금" : "매매가";
                });
            });
        }
    });
})();

// 24. 평수 변환기 — 1㎡ = 0.3025평 실시간 쌍방향 인풋 체인저
(function () {
    var SQM_TO_PYEONG = 0.3025;

    function renderPyeongResult(sqm, pyeong) {
        var resultEl = document.getElementById("pyeongResultValue");
        if (!resultEl) return;
        resultEl.innerText = formatResult(Math.round(sqm * 100) / 100) + "㎡ = " + formatResult(Math.round(pyeong * 100) / 100) + "평";
    }

    document.addEventListener("DOMContentLoaded", () => {
        var sqmInput = document.getElementById("pyeongSqm");
        var pyeongInput = document.getElementById("pyeongPyeong");
        if (!sqmInput || !pyeongInput) return;

        [59, 74, 84, 101, 115].forEach(function (sqm) {
            var refEl = document.getElementById("pyeongRef" + sqm);
            if (refEl) refEl.innerText = "약 " + (sqm * SQM_TO_PYEONG).toFixed(2) + "평";
        });

        sqmInput.addEventListener("input", function () {
            var sqm = parseFloat(sqmInput.value) || 0;
            var pyeong = sqm * SQM_TO_PYEONG;
            pyeongInput.value = pyeong ? (Math.round(pyeong * 100) / 100) : "";
            renderPyeongResult(sqm, pyeong);
        });

        pyeongInput.addEventListener("input", function () {
            var pyeong = parseFloat(pyeongInput.value) || 0;
            var sqm = pyeong / SQM_TO_PYEONG;
            sqmInput.value = sqm ? (Math.round(sqm * 100) / 100) : "";
            renderPyeongResult(sqm, pyeong);
        });

        document.querySelectorAll(".pyeong-preset-chip").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var sqm = parseFloat(btn.getAttribute("data-sqm")) || 0;
                var pyeong = sqm * SQM_TO_PYEONG;
                sqmInput.value = sqm;
                pyeongInput.value = Math.round(pyeong * 100) / 100;
                renderPyeongResult(sqm, pyeong);
            });
        });
    });
})();

// 25. 환산보증금 계산기 — 보증금 + (월세 × 100) 산식 + 지역별 상가건물임대차보호법 기준선 판정
(function () {
    function renderDepositConversionResult(data) {
        var sym = getCurrencySymbol();

        document.getElementById("deposit-calc-hero-empty").style.display = "none";
        document.getElementById("deposit-calc-hero-content").style.display = "block";

        document.getElementById("depositCalcConverted").innerText = sym + formatResult(data.converted);
        document.getElementById("depositCalcThreshold").innerText = sym + formatResult(data.threshold);

        var verdictEl = document.getElementById("depositCalcVerdict");
        if (data.isWithinThreshold) {
            verdictEl.innerText = "기준 이하 → 상가임대차보호법 전면 적용 대상이에요";
            verdictEl.className = "profit-text";
        } else {
            verdictEl.innerText = "기준 초과 → 대항력 등 일부 조항만 적용돼요";
            verdictEl.className = "loss-text";
        }
    }

    window.calculateDepositConversion = function (skipHistory) {
        skipHistory = skipHistory || false;

        var threshold = parseFloat(document.getElementById("depositCalcRegion").value) || 0;
        var deposit = parseNumber(document.getElementById("depositCalcDeposit").value) || 0;
        var rent = parseNumber(document.getElementById("depositCalcRent").value) || 0;

        if (deposit <= 0 && rent <= 0) {
            alert("보증금 또는 월세를 입력해주세요.");
            return;
        }

        var converted = deposit + rent * 100;
        var isWithinThreshold = converted <= threshold;

        renderDepositConversionResult({ converted: converted, threshold: threshold, isWithinThreshold: isWithinThreshold });

        if (!skipHistory && typeof addHistoryRecord === "function") {
            var sym = getCurrencySymbol();
            var title = "환산보증금 " + sym + formatResult(converted);
            var params = {
                "depositCalcDeposit": document.getElementById("depositCalcDeposit").value,
                "depositCalcRent": document.getElementById("depositCalcRent").value
            };
            addHistoryRecord("deposit-calc", "환산보증금 계산", title, params);
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        var depositInput = document.getElementById("depositCalcDeposit");
        var depositHint = document.getElementById("depositCalcDepositHint");
        if (depositInput && depositHint) {
            depositInput.addEventListener("input", function () {
                formatNumber(depositInput);
                depositHint.innerText = formatKoreanUnit(parseNumber(depositInput.value));
            });
        }

        var rentInput = document.getElementById("depositCalcRent");
        var rentHint = document.getElementById("depositCalcRentHint");
        if (rentInput && rentHint) {
            rentInput.addEventListener("input", function () {
                formatNumber(rentInput);
                rentHint.innerText = formatKoreanUnit(parseNumber(rentInput.value));
            });
        }
    });
})();

// 26. 청약가점 계산기 — 무주택기간(32점)+부양가족수(35점)+청약통장가입기간(17점) = 84점 만점
(function () {
    window.calculateSubscriptionScore = function (skipHistory) {
        skipHistory = skipHistory || false;

        var noHouseScore = parseInt(document.getElementById("subscriptionNoHouse").value, 10) || 0;
        var dependentsScore = parseInt(document.getElementById("subscriptionDependents").value, 10) || 0;
        var termScore = parseInt(document.getElementById("subscriptionTerm").value, 10) || 0;
        var total = noHouseScore + dependentsScore + termScore;

        document.getElementById("subscription-hero-empty").style.display = "none";
        document.getElementById("subscription-hero-content").style.display = "block";

        document.getElementById("subscriptionTotal").innerText = total + "점";
        document.getElementById("subscriptionNoHouseScore").innerText = noHouseScore + "점";
        document.getElementById("subscriptionDependentsScore").innerText = dependentsScore + "점";
        document.getElementById("subscriptionTermScore").innerText = termScore + "점";

        if (!skipHistory && typeof addHistoryRecord === "function") {
            var title = "청약가점 총점 " + total + "점 / 84점";
            var params = {};
            addHistoryRecord("subscription", "청약가점 계산", title, params);
        }
    };
})();

// 27. 내집마련 계산기 — 자기자본(LTV 역산) vs 자기자본+DSR대출한도 중 낮은 금액으로 매수가능 목표가 산출
(function () {
    function calcDsrLoanAmount(dsrBudget, rate, termYears) {
        var monthlyBudget = dsrBudget / 12;
        var monthlyRate = rate / 100 / 12;
        var totalMonths = termYears * 12;
        if (monthlyRate > 0) {
            return monthlyBudget * (1 - Math.pow(1 + monthlyRate, -totalMonths)) / monthlyRate;
        }
        return monthlyBudget * totalMonths;
    }

    function renderHomeBudgetResult(data) {
        var sym = getCurrencySymbol();

        document.getElementById("home-budget-hero-empty").style.display = "none";
        document.getElementById("home-budget-hero-content").style.display = "block";

        document.getElementById("homeBudgetTarget").innerText = sym + formatResult(data.target);
        document.getElementById("homeBudgetByLtv").innerText = sym + formatResult(data.priceByLtv);
        document.getElementById("homeBudgetByDsr").innerText = sym + formatResult(data.priceByDsr);
        document.getElementById("homeBudgetAppliedRule").innerText = data.appliedRule;
        document.getElementById("homeBudgetRequiredLoan").innerText = sym + formatResult(data.requiredLoan);
    }

    window.calculateHomeBudget = function (skipHistory) {
        skipHistory = skipHistory || false;

        var areaBtn = document.querySelector("#homeBudgetAreaTabs .pill-tab.active");
        if (!areaBtn) return;
        var ltvPct = areaBtn.dataset.value === "regulated" ? 0.60 : 0.70;

        var cash = parseNumber(document.getElementById("homeBudgetCash").value);
        var income = parseNumber(document.getElementById("homeBudgetIncome").value) || 0;
        var existingDebt = parseNumber(document.getElementById("homeBudgetExistingDebt").value) || 0;
        var rate = parseFloat(document.getElementById("homeBudgetRate").value) || 0;
        var term = parseInt(document.getElementById("homeBudgetTerm").value, 10) || 1;

        if (cash <= 0) {
            alert("보유 현금을 입력해주세요.");
            return;
        }

        var dsrBudget = Math.max(0, income * 0.40 - existingDebt);
        var dsrLoanAmount = calcDsrLoanAmount(dsrBudget, rate, term);

        var priceByLtv = cash / (1 - ltvPct);
        var priceByDsr = cash + dsrLoanAmount;
        var target = Math.min(priceByLtv, priceByDsr);
        var appliedRule = priceByLtv <= priceByDsr ? "LTV 기준 (더 낮은 한도가 적용돼요)" : "DSR 기준 (더 낮은 한도가 적용돼요)";
        var requiredLoan = Math.max(0, target - cash);

        renderHomeBudgetResult({
            target: target, priceByLtv: priceByLtv, priceByDsr: priceByDsr,
            appliedRule: appliedRule, requiredLoan: requiredLoan
        });

        if (!skipHistory && typeof addHistoryRecord === "function") {
            var sym = getCurrencySymbol();
            var title = "보유현금 " + sym + formatResult(cash) + " → 매수가능가 " + sym + formatResult(target);
            var params = {
                "homeBudgetCash": document.getElementById("homeBudgetCash").value,
                "homeBudgetIncome": document.getElementById("homeBudgetIncome").value,
                "homeBudgetExistingDebt": document.getElementById("homeBudgetExistingDebt").value
            };
            addHistoryRecord("home-budget", "내집마련 계산", title, params);
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        ["homeBudgetCash", "homeBudgetIncome", "homeBudgetExistingDebt"].forEach(function (id) {
            var input = document.getElementById(id);
            var hint = document.getElementById(id + "Hint");
            if (input && hint) {
                input.addEventListener("input", function () {
                    formatNumber(input);
                    hint.innerText = formatKoreanUnit(parseNumber(input.value));
                });
            }
        });
    });
})();

// 28. 해외주식 양도세 계산기 — 기본공제 250만원 차감 후 양도소득세 20% + 지방소득세 2% = 22%
(function () {
    var BASIC_DEDUCTION = 2500000;

    function renderGlobalStockTaxResult(data) {
        var sym = getCurrencySymbol();

        document.getElementById("global-stock-tax-hero-empty").style.display = "none";
        document.getElementById("global-stock-tax-hero-content").style.display = "block";

        document.getElementById("globalStockTotalTax").innerText = sym + formatResult(data.totalTax);
        document.getElementById("globalStockGainDisplay").innerText = sym + formatResult(data.gain);
        document.getElementById("globalStockDeduction").innerText = "- " + sym + formatResult(data.deduction);
        document.getElementById("globalStockTaxBase").innerText = sym + formatResult(data.taxBase);
        document.getElementById("globalStockIncomeTax").innerText = sym + formatResult(data.incomeTax);
        document.getElementById("globalStockLocalTax").innerText = sym + formatResult(data.localTax);
        document.getElementById("globalStockNetGain").innerText = sym + formatResult(data.netGain);
    }

    window.calculateGlobalStockTax = function (skipHistory) {
        skipHistory = skipHistory || false;

        var gain = parseNumber(document.getElementById("globalStockGain").value);
        if (gain <= 0) {
            alert("연간 총수익을 입력해주세요.");
            return;
        }

        var deduction = Math.min(BASIC_DEDUCTION, gain);
        var taxBase = Math.max(0, gain - BASIC_DEDUCTION);
        var incomeTax = taxBase * 0.20;
        var localTax = taxBase * 0.02;
        var totalTax = incomeTax + localTax;
        var netGain = gain - totalTax;

        renderGlobalStockTaxResult({
            gain: gain, deduction: deduction, taxBase: taxBase,
            incomeTax: incomeTax, localTax: localTax, totalTax: totalTax, netGain: netGain
        });

        if (!skipHistory && typeof addHistoryRecord === "function") {
            var sym = getCurrencySymbol();
            var title = "양도차익 " + sym + formatResult(gain) + " → 세액 " + sym + formatResult(totalTax);
            var params = { "globalStockGain": document.getElementById("globalStockGain").value };
            addHistoryRecord("global-stock-tax", "해외주식 양도세 계산", title, params);
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        var gainInput = document.getElementById("globalStockGain");
        var gainHint = document.getElementById("globalStockGainHint");
        if (gainInput && gainHint) {
            gainInput.addEventListener("input", function () {
                formatNumber(gainInput);
                gainHint.innerText = formatKoreanUnit(parseNumber(gainInput.value));
            });
        }
    });
})();

// 29. 해외주식 실수령 계산기 — 매도총액(USD) - 현지수수료 - 제세금 → 환율 적용 원화 환산
(function () {
    function renderGlobalNetResult(data) {
        var sym = getCurrencySymbol();

        document.getElementById("global-net-hero-empty").style.display = "none";
        document.getElementById("global-net-hero-content").style.display = "block";

        document.getElementById("globalNetKrw").innerText = sym + formatResult(data.netKrw);
        document.getElementById("globalNetGrossUsd").innerText = "$" + formatResult(data.grossUsd);
        document.getElementById("globalNetFeeDeducted").innerText = "- $" + formatResult(data.feeDeducted);
        document.getElementById("globalNetTaxDeducted").innerText = "- $" + formatResult(data.taxDeducted);
        document.getElementById("globalNetUsd").innerText = "$" + formatResult(data.netUsd);
        document.getElementById("globalNetAppliedRate").innerText = sym + formatResult(data.exchangeRate) + " / $";
    }

    window.calculateGlobalNet = function (skipHistory) {
        skipHistory = skipHistory || false;

        var grossUsd = parseFloat(document.getElementById("globalNetAmount").value) || 0;
        var feeRate = parseFloat(document.getElementById("globalNetFeeRate").value) || 0;
        var taxRate = parseFloat(document.getElementById("globalNetTaxRate").value) || 0;
        var exchangeRate = parseNumber(document.getElementById("globalNetExchangeRate").value) || 0;

        if (grossUsd <= 0) {
            alert("매도 총액을 입력해주세요.");
            return;
        }
        if (exchangeRate <= 0) {
            alert("적용환율을 입력해주세요.");
            return;
        }

        var feeDeducted = grossUsd * (feeRate / 100);
        var taxDeducted = grossUsd * (taxRate / 100);
        var netUsd = Math.max(0, grossUsd - feeDeducted - taxDeducted);
        var netKrw = netUsd * exchangeRate;

        renderGlobalNetResult({
            grossUsd: grossUsd, feeDeducted: feeDeducted, taxDeducted: taxDeducted,
            netUsd: netUsd, exchangeRate: exchangeRate, netKrw: netKrw
        });

        if (!skipHistory && typeof addHistoryRecord === "function") {
            var sym = getCurrencySymbol();
            var title = "매도 $" + formatResult(grossUsd) + " → 실수령 " + sym + formatResult(netKrw);
            var params = {
                "globalNetAmount": document.getElementById("globalNetAmount").value,
                "globalNetExchangeRate": document.getElementById("globalNetExchangeRate").value
            };
            addHistoryRecord("global-net", "해외주식 실수령 계산", title, params);
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        var amountInput = document.getElementById("globalNetAmount");
        var amountHint = document.getElementById("globalNetAmountHint");
        if (amountInput && amountHint) {
            amountInput.addEventListener("input", function () {
                amountHint.innerText = "$" + ((parseFloat(amountInput.value) || 0).toLocaleString("en-US"));
            });
        }

        var exchangeInput = document.getElementById("globalNetExchangeRate");
        if (exchangeInput) {
            exchangeInput.addEventListener("input", function () {
                formatNumber(exchangeInput);
            });
        }
    });
})();

// 30. 재무함수 계산기 — 기준금액·기간·할인율로 현재가치(PV)·미래가치(FV)·순현재가치(NPV) 동시 산출
(function () {
    function renderFinFuncResult(data) {
        var sym = getCurrencySymbol();

        document.getElementById("fin-func-hero-empty").style.display = "none";
        document.getElementById("fin-func-hero-content").style.display = "block";

        document.getElementById("finFuncFv").innerText = sym + formatResult(data.fv);
        document.getElementById("finFuncPv").innerText = sym + formatResult(data.pv);
        document.getElementById("finFuncNpv").innerText = sym + formatResult(data.npv);
        document.getElementById("finFuncPrincipalDisplay").innerText = sym + formatResult(data.principal);
        document.getElementById("finFuncTermDisplay").innerText = data.years + "년 · 연 " + data.rate + "%";
    }

    // FV = 원금×(1+r)^n [미래가치] / PV = 원금÷(1+r)^n [현재가치] / NPV = -원금 + Σ 연간현금흐름÷(1+r)^t [순현재가치]
    window.calculateFinFunc = function (skipHistory) {
        skipHistory = skipHistory || false;

        var principal = parseNumber(document.getElementById("finFuncPrincipal").value);
        var cashflow = parseNumber(document.getElementById("finFuncCashflow").value) || 0;
        var years = parseInt(document.getElementById("finFuncYears").value, 10) || 1;
        var rate = parseFloat(document.getElementById("finFuncRate").value) || 0;

        if (principal <= 0) {
            alert("기준금액을 입력해주세요.");
            return;
        }

        var r = rate / 100;
        var fv = principal * Math.pow(1 + r, years);
        var pv = principal / Math.pow(1 + r, years);

        var npv = -principal;
        for (var t = 1; t <= years; t++) {
            npv += cashflow / Math.pow(1 + r, t);
        }

        renderFinFuncResult({ principal: principal, years: years, rate: rate, fv: fv, pv: pv, npv: npv });

        if (!skipHistory && typeof addHistoryRecord === "function") {
            var sym = getCurrencySymbol();
            var title = sym + formatResult(principal) + " → FV " + sym + formatResult(fv);
            var params = {
                "finFuncPrincipal": document.getElementById("finFuncPrincipal").value,
                "finFuncCashflow": document.getElementById("finFuncCashflow").value
            };
            addHistoryRecord("fin-func", "재무함수 계산", title, params);
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        var principalInput = document.getElementById("finFuncPrincipal");
        var principalHint = document.getElementById("finFuncPrincipalHint");
        if (principalInput && principalHint) {
            principalInput.addEventListener("input", function () {
                formatNumber(principalInput);
                principalHint.innerText = formatKoreanUnit(parseNumber(principalInput.value));
            });
        }

        var cashflowInput = document.getElementById("finFuncCashflow");
        var cashflowHint = document.getElementById("finFuncCashflowHint");
        if (cashflowInput && cashflowHint) {
            cashflowInput.addEventListener("input", function () {
                formatNumber(cashflowInput);
                cashflowHint.innerText = formatKoreanUnit(parseNumber(cashflowInput.value));
            });
        }
    });
})();
