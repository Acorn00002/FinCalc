document.addEventListener('DOMContentLoaded', () => {
    // 1. Theme Toggle
    const themeToggle = document.getElementById('theme-toggle');
    const mobileThemeToggle = document.getElementById('mobile-theme-toggle');
    const themeFab = document.getElementById('theme-fab');

    function updateTheme(isDark, save = true) {
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        if (themeToggle) themeToggle.checked = isDark;
        if (mobileThemeToggle) mobileThemeToggle.checked = isDark;
        if (save) localStorage.setItem('fincalc_theme', isDark ? 'dark' : 'light');
        if (typeof refreshCharts === 'function') {
            refreshCharts();
        }
    }

    const savedTheme = localStorage.getItem('fincalc_theme');
    if (savedTheme) {
        updateTheme(savedTheme === 'dark', false);
    }

    if (themeToggle) {
        themeToggle.addEventListener('change', (e) => updateTheme(e.target.checked));
    }
    if (mobileThemeToggle) {
        mobileThemeToggle.addEventListener('change', (e) => updateTheme(e.target.checked));
    }
    if (themeFab) {
        themeFab.addEventListener('click', () => {
            const isDark = document.documentElement.getAttribute('data-theme') !== 'dark';
            updateTheme(isDark);
        });
    }

    // 2. Navigation Tabs
    const navBtns = document.querySelectorAll('.nav-btn');
    const calcSections = document.querySelectorAll('.calc-section');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.querySelector('.sidebar');

    function switchTab(targetId) {
        // Update Buttons
        navBtns.forEach(btn => {
            if (btn.getAttribute('data-target') === targetId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update Sections
        calcSections.forEach(sec => {
            if (sec.id === targetId) {
                sec.classList.add('active');
            } else {
                sec.classList.remove('active');
            }
        });

        // Close mobile sidebar if open
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('open');
        }

        // 특정 탭 진입 시 초기화 또는 계산 실행
        if (targetId === 'exchange' && typeof calculateExchange === 'function') {
            calculateExchange();
        }

        // 탭 전환 직후에도 현재 선택된 언어로 번역을 재적용 (동적으로 새로 노출된 요소 대비)
        if (typeof changeLanguage === 'function' && typeof getCurrentLang === 'function') {
            changeLanguage(getCurrentLang());
        }
    }

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            switchTab(targetId);
        });
    });

    // 2.1 Dashboard Cards
    const dashboardCards = document.querySelectorAll('.dashboard-card');
    dashboardCards.forEach(card => {
        card.addEventListener('click', () => {
            const targetId = card.getAttribute('data-target');
            switchTab(targetId);
        });
    });

    // 2.2 Back to Home Buttons
    const backToHomeBtns = document.querySelectorAll('.back-to-home');
    backToHomeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab('home-dashboard');
        });
    });

    // 3. Mobile Menu
    mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    // 4. Currency Change
    const currencySelect = document.getElementById('currency-select');
    currencySelect.addEventListener('change', () => {
        const symbol = currencySelect.value === 'USD' ? '$' : '₩';
        document.querySelectorAll('.currency-symbol').forEach(el => {
            el.innerText = symbol;
        });
        
        // 다시 계산하여 결과 기호 업데이트
        if (typeof calculateSimpleCompound === 'function' && document.getElementById('simple-principal').value) calculateSimpleCompound();
        if (typeof calculatePeriodicCompound === 'function' && document.getElementById('periodic-principal').value) calculatePeriodicCompound();
        if (typeof calculateAveragePrice === 'function' && document.getElementById('avg-current-price').value) calculateAveragePrice();
        if (typeof calculateROI === 'function' && document.getElementById('roi-invested').value) calculateROI();
        if (typeof calculateLoan === 'function' && document.getElementById('loan-amount').value) calculateLoan();
        if (typeof calculateDeposit === 'function' && document.getElementById('deposit-amount').value) calculateDeposit();
        if (typeof calculateSavings === 'function' && document.getElementById('savings-amount').value) calculateSavings();
        if (typeof calculateInflation === 'function' && document.getElementById('inflationAmount').value) calculateInflation();
        if (typeof calculateEarlyTermination === 'function' && document.getElementById('earlyTermPrincipal').value) calculateEarlyTermination();
        if (typeof calculateRetirement === 'function' && document.getElementById('retireMonthlyExpense').value) calculateRetirement();
        if (typeof calculateDividends === 'function' && document.getElementById('dividendPrice').value) calculateDividends();
        if (typeof calculateSalary === 'function' && document.getElementById('salaryAmount').value) calculateSalary();
        if (typeof calculateCapitalGainsTax === 'function' && document.getElementById('gainsTransferValue').value) calculateCapitalGainsTax();
        if (typeof calculateGiftTax === 'function' && document.getElementById('giftAmount').value) calculateGiftTax();
        if (typeof calculateInheritanceTax === 'function' && document.getElementById('inhTotalEstate').value) calculateInheritanceTax();
        if (typeof calculateSeverance === 'function' && document.getElementById('sevBaseWage3m').value) calculateSeverance();
        if (typeof calculateLoanLimit === 'function' && document.getElementById('loanLimitHomePrice').value) calculateLoanLimit();
        if (typeof calculateAptBuyTax === 'function' && document.getElementById('aptBuyPrice').value) calculateAptBuyTax();
        if (typeof calculateAptHoldingTax === 'function' && document.getElementById('aptTaxPrice').value) calculateAptHoldingTax();
        if (typeof calculateBrokerageFee === 'function' && document.getElementById('brokerageAmount').value) calculateBrokerageFee();
        if (typeof calculateDepositConversion === 'function' && document.getElementById('depositCalcDeposit').value) calculateDepositConversion();
        if (typeof calculateHomeBudget === 'function' && document.getElementById('homeBudgetCash').value) calculateHomeBudget();
        if (typeof calculateGlobalStockTax === 'function' && document.getElementById('globalStockGain').value) calculateGlobalStockTax();
        if (typeof calculateGlobalNet === 'function' && document.getElementById('globalNetAmount').value) calculateGlobalNet();
        if (typeof calculateFinFunc === 'function' && document.getElementById('finFuncPrincipal').value) calculateFinFunc();
    });

    // 5. Number Formatting Helpers for Inputs
    window.formatNumber = function(input) {
        // Remove non-digit chars except decimal point
        let val = input.value.replace(/[^\d.]/g, '');
        
        // Handle decimal points properly (allow only one)
        const parts = val.split('.');
        if (parts.length > 2) {
            val = parts[0] + '.' + parts.slice(1).join('');
        }

        // Format whole numbers with commas
        if (parts[0].length > 0) {
            parts[0] = parseInt(parts[0], 10).toLocaleString('en-US');
            val = parts.length > 1 ? parts.join('.') : parts[0];
        }
        
        input.value = val;
    };

    // 6. Exchange Manual Toggle Event
    const manualRateToggle = document.getElementById('manual-rate-toggle');
    if (manualRateToggle) {
        manualRateToggle.addEventListener('change', () => {
            if (typeof toggleManualRate === 'function') toggleManualRate();
        });
    }

    // 7. Advanced Options Toggle
    window.toggleAdvancedOptions = function(element) {
        const panel = element.nextElementSibling;
        const icon = element.querySelector('.toggle-icon');
        if (panel.style.display === 'none') {
            panel.style.display = 'block';
            icon.innerText = '▲';
        } else {
            panel.style.display = 'none';
            icon.innerText = '▼';
        }
    };

    // 8. Table Toggle
    window.toggleTable = function(containerId) {
        const container = document.getElementById(containerId);
        if (container.style.display === 'none') {
            container.style.display = 'block';
        } else {
            container.style.display = 'none';
        }
    };

    // 9. Save as Image (html2canvas)
    window.saveAsImage = function(panelId) {
        const panel = document.getElementById(panelId);
        if (!panel) return;
        
        // Use html2canvas if available
        if (typeof html2canvas !== 'undefined') {
            const originalBg = panel.style.background;
            // Force opaque background for capture
            panel.style.background = getComputedStyle(document.body).getPropertyValue('--panel-bg');
            
            html2canvas(panel, {
                backgroundColor: getComputedStyle(document.body).getPropertyValue('--bg-color'),
                scale: 2 // higher resolution
            }).then(canvas => {
                panel.style.background = originalBg;
                const link = document.createElement('a');
                link.download = 'fincalc_result.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
            }).catch(err => {
                console.error("Image save failed", err);
                panel.style.background = originalBg;
                alert("이미지 저장에 실패했습니다.");
            });
        } else {
            alert("저장 기능을 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
        }
    };

    // 10. Generate Share URL
    window.generateShareURL = function() {
        const activeSection = document.querySelector('.calc-section.active');
        if (!activeSection) return;
        
        const inputs = activeSection.querySelectorAll('input, select');
        const params = new URLSearchParams();
        
        params.set('tab', activeSection.id);
        
        inputs.forEach(input => {
            if (input.id && input.value && input.value !== "0" && input.value !== "") {
                let val = input.value.replace(/,/g, '');
                params.set(input.id, val);
            }
        });
        
        const shareUrl = window.location.origin + window.location.pathname + '?' + params.toString();
        
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert("입력값이 포함된 URL이 클립보드에 복사되었습니다!\n원하는 곳에 붙여넣기 하여 공유하세요.");
        }).catch(() => {
            alert("URL 복사에 실패했습니다.");
        });
    };

    // 11. History Management
    const HISTORY_KEY = 'fincalc_history';
    
    function getHistory() {
        try {
            return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
        } catch(e) {
            return [];
        }
    }
    
    function saveHistory(historyArray) {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(historyArray));
        renderHistory();
    }
    
    window.addHistoryRecord = function(tabId, typeName, title, params) {
        const history = getHistory();
        const record = {
            id: Date.now(),
            tabId,
            typeName,
            title,
            params,
            time: new Date().toLocaleTimeString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        };
        history.unshift(record);
        if (history.length > 20) history.pop(); // Keep max 20
        saveHistory(history);
    };
    
    window.deleteHistoryRecord = function(id, event) {
        event.stopPropagation();
        const history = getHistory().filter(item => item.id !== id);
        saveHistory(history);
    };
    
    window.clearAllHistory = function() {
        if(confirm("모든 계산 기록을 삭제하시겠습니까?")) {
            saveHistory([]);
        }
    };
    
    window.loadHistoryRecord = function(id) {
        const record = getHistory().find(item => item.id === id);
        if (!record) return;
        
        // Switch tab
        const btn = document.querySelector(`.nav-btn[data-target="${record.tabId}"]`);
        if (btn) btn.click();
        
        // Fill params
        for (const key in record.params) {
            const el = document.getElementById(key);
            if (el) {
                el.value = record.params[key];
                if (el.tagName === 'INPUT' && el.type === 'text') {
                    window.formatNumber(el);
                }
            }
        }
        
        // Calculate (pass true to avoid re-saving history)
        setTimeout(() => {
            if (record.tabId === 'compound-simple' && typeof calculateSimpleCompound === 'function') calculateSimpleCompound(true);
            if (record.tabId === 'compound-periodic' && typeof calculatePeriodicCompound === 'function') calculatePeriodicCompound(true);
            if (record.tabId === 'goal-planner' && typeof calculateGoalPlanner === 'function') calculateGoalPlanner(true);
            if (record.tabId === 'kelly' && typeof calculateKelly === 'function') calculateKelly(true);
            if (record.tabId === 'average-price' && typeof calculateAveragePrice === 'function') calculateAveragePrice(true);
            if (record.tabId === 'roi' && typeof calculateROI === 'function') calculateROI(true);
            if (record.tabId === 'exchange' && typeof calculateExchange === 'function') calculateExchange(true);
            if (record.tabId === 'loan-interest' && typeof calculateLoan === 'function') calculateLoan(true);
            if (record.tabId === 'deposit' && typeof calculateDeposit === 'function') calculateDeposit(true);
            if (record.tabId === 'savings' && typeof calculateSavings === 'function') calculateSavings(true);
            if (record.tabId === 'inflation' && typeof calculateInflation === 'function') calculateInflation(true);
            if (record.tabId === 'early-termination' && typeof calculateEarlyTermination === 'function') calculateEarlyTermination(true);
            if (record.tabId === 'retirement' && typeof calculateRetirement === 'function') calculateRetirement(true);
            if (record.tabId === 'dividend' && typeof calculateDividends === 'function') calculateDividends(true);
            if (record.tabId === 'salary' && typeof calculateSalary === 'function') calculateSalary(true);
            if (record.tabId === 'gains-tax' && typeof calculateCapitalGainsTax === 'function') calculateCapitalGainsTax(true);
            if (record.tabId === 'gift-tax' && typeof calculateGiftTax === 'function') calculateGiftTax(true);
            if (record.tabId === 'inheritance-tax' && typeof calculateInheritanceTax === 'function') calculateInheritanceTax(true);
            if (record.tabId === 'severance' && typeof calculateSeverance === 'function') calculateSeverance(true);
            if (record.tabId === 'loan-limit' && typeof calculateLoanLimit === 'function') calculateLoanLimit(true);
            if (record.tabId === 'apt-buy' && typeof calculateAptBuyTax === 'function') calculateAptBuyTax(true);
            if (record.tabId === 'apt-tax' && typeof calculateAptHoldingTax === 'function') calculateAptHoldingTax(true);
            if (record.tabId === 'brokerage' && typeof calculateBrokerageFee === 'function') calculateBrokerageFee(true);
            if (record.tabId === 'deposit-calc' && typeof calculateDepositConversion === 'function') calculateDepositConversion(true);
            if (record.tabId === 'subscription' && typeof calculateSubscriptionScore === 'function') calculateSubscriptionScore(true);
            if (record.tabId === 'home-budget' && typeof calculateHomeBudget === 'function') calculateHomeBudget(true);
            if (record.tabId === 'global-stock-tax' && typeof calculateGlobalStockTax === 'function') calculateGlobalStockTax(true);
            if (record.tabId === 'global-net' && typeof calculateGlobalNet === 'function') calculateGlobalNet(true);
            if (record.tabId === 'fin-func' && typeof calculateFinFunc === 'function') calculateFinFunc(true);
        }, 100);
        
        if (window.innerWidth <= 768) {
            document.querySelector('.sidebar').classList.remove('open');
        }
    };
    
    function renderHistory() {
        const listEl = document.getElementById('history-list');
        if (!listEl) return;
        
        const history = getHistory();
        if (history.length === 0) {
            listEl.innerHTML = '<li class="empty-history">최근 계산 기록이 없습니다.</li>';
            return;
        }
        
        listEl.innerHTML = history.map(item => `
            <li class="history-item" onclick="loadHistoryRecord(${item.id})">
                <button class="history-item-delete" onclick="deleteHistoryRecord(${item.id}, event)" title="삭제">×</button>
                <div class="history-item-type">${item.typeName}</div>
                <div class="history-item-title">${item.title}</div>
                <div class="history-item-time">${item.time}</div>
            </li>
        `).join('');
    }

    // 12. Load from URL Params
    function loadFromUrlParams() {
        renderHistory(); // Initialize history list

        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab) {
            const btn = document.querySelector(`.nav-btn[data-target="${tab}"]`);
            if (btn) btn.click();
        }
        
        let hasParams = false;
        params.forEach((value, key) => {
            if (key === 'tab') return;
            const el = document.getElementById(key);
            if (el) {
                el.value = value;
                if (el.tagName === 'INPUT' && el.type === 'text') {
                    window.formatNumber(el);
                }
                hasParams = true;
            }
        });
        
        if (hasParams) {
            setTimeout(() => {
                if (tab === 'compound-simple' && typeof calculateSimpleCompound === 'function') calculateSimpleCompound(true);
                if (tab === 'compound-periodic' && typeof calculatePeriodicCompound === 'function') calculatePeriodicCompound(true);
                if (tab === 'goal-planner' && typeof calculateGoalPlanner === 'function') calculateGoalPlanner(true);
                if (tab === 'kelly' && typeof calculateKelly === 'function') calculateKelly(true);
                if (tab === 'average-price' && typeof calculateAveragePrice === 'function') calculateAveragePrice(true);
                if (tab === 'roi' && typeof calculateROI === 'function') calculateROI(true);
                if (tab === 'exchange' && typeof calculateExchange === 'function') calculateExchange(true);
                if (tab === 'loan-interest' && typeof calculateLoan === 'function') calculateLoan(true);
                if (tab === 'deposit' && typeof calculateDeposit === 'function') calculateDeposit(true);
                if (tab === 'savings' && typeof calculateSavings === 'function') calculateSavings(true);
                if (tab === 'inflation' && typeof calculateInflation === 'function') calculateInflation(true);
                if (tab === 'early-termination' && typeof calculateEarlyTermination === 'function') calculateEarlyTermination(true);
                if (tab === 'retirement' && typeof calculateRetirement === 'function') calculateRetirement(true);
                if (tab === 'dividend' && typeof calculateDividends === 'function') calculateDividends(true);
                if (tab === 'salary' && typeof calculateSalary === 'function') calculateSalary(true);
                if (tab === 'gains-tax' && typeof calculateCapitalGainsTax === 'function') calculateCapitalGainsTax(true);
                if (tab === 'gift-tax' && typeof calculateGiftTax === 'function') calculateGiftTax(true);
                if (tab === 'inheritance-tax' && typeof calculateInheritanceTax === 'function') calculateInheritanceTax(true);
                if (tab === 'severance' && typeof calculateSeverance === 'function') calculateSeverance(true);
                if (tab === 'loan-limit' && typeof calculateLoanLimit === 'function') calculateLoanLimit(true);
                if (tab === 'apt-buy' && typeof calculateAptBuyTax === 'function') calculateAptBuyTax(true);
                if (tab === 'apt-tax' && typeof calculateAptHoldingTax === 'function') calculateAptHoldingTax(true);
                if (tab === 'brokerage' && typeof calculateBrokerageFee === 'function') calculateBrokerageFee(true);
                if (tab === 'deposit-calc' && typeof calculateDepositConversion === 'function') calculateDepositConversion(true);
                if (tab === 'subscription' && typeof calculateSubscriptionScore === 'function') calculateSubscriptionScore(true);
                if (tab === 'home-budget' && typeof calculateHomeBudget === 'function') calculateHomeBudget(true);
                if (tab === 'global-stock-tax' && typeof calculateGlobalStockTax === 'function') calculateGlobalStockTax(true);
                if (tab === 'global-net' && typeof calculateGlobalNet === 'function') calculateGlobalNet(true);
                if (tab === 'fin-func' && typeof calculateFinFunc === 'function') calculateFinFunc(true);
            }, 300);
        }
    }
    loadFromUrlParams();

    // 13. Market 지수 & 환율 Ticker (최초 1회 + 5분마다 조용히 갱신)
    const TICKER_FALLBACK = [
        { nameKey: 'ticker-nasdaq', symbol: '^IXIC', price: '16,736.03', pct: 0.21, up: true },
        { nameKey: 'ticker-kospi', symbol: '^KS11', price: '2,753.16', pct: 1.20, up: true },
        { nameKey: 'ticker-kosdaq', symbol: '^KQ11', price: '871.42', pct: 0.45, up: false },
        { nameKey: 'ticker-sp500', symbol: '^GSPC', price: '5,246.68', pct: 0.11, up: true },
        { nameKey: 'ticker-dow', symbol: '^DJI', price: '39,313.64', pct: 0.32, up: true }
    ];
    const TICKER_FX_FALLBACK_PRICE = '1,365.50';

    async function fetchMarketData() {
        const tickerContent = document.querySelector('.ticker-content');
        if (!tickerContent) return;

        const tt = typeof t === 'function' ? t : (key) => key;

        // 최초 로드 시에만 로딩 문구를 보여주고, 5분 주기 재조회 때는 화면 깜빡임 없이 조용히 교체
        if (!tickerContent.dataset.loaded) {
            tickerContent.innerHTML = `<span class="ticker-item" style="color: var(--text-secondary);">${tt('ticker-loading')}</span>`;
        }

        function renderIndexFallback(item) {
            const arrow = item.up ? '▲' : '▼';
            const colorClass = item.up ? 'ticker-up' : 'ticker-down';
            return `<span class="ticker-item">${tt(item.nameKey)} <strong style="margin-left: 5px;">${item.price}</strong> <span class="${colorClass}">${arrow} ${item.pct.toFixed(2)}%</span> <span style="font-size:0.7em;color:#888;">${tt('ticker-delayed')}</span></span>`;
        }

        function renderFxFallback() {
            return `<span class="ticker-item">${tt('ticker-usdkrw')} <strong style="margin-left: 5px;">${TICKER_FX_FALLBACK_PRICE}</strong> <span style="font-size:0.7em;color:#888;">${tt('ticker-delayed')}</span></span>`;
        }

        let fxHtml = '';
        let indexHtml = '';

        try {
            // 1. 한국 표준 환율 (두나무/하나은행 API - 네이버 환율과 100% 동일, CORS 제한 없음)
            const fxPromise = fetch(`https://quotation-api-cdn.dunamu.com/v1/forex/recent?codes=FRX.KRWUSD&_=${Date.now()}`)
                .then(res => res.json())
                .catch(() => null);

            // 2. 주식 지수 (Yahoo Finance via CORS 프록시)
            const symbols = '%5EIXIC,%5EKS11,%5EKQ11,%5EGSPC,%5EDJI';
            const yahooUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`;
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`;

            const yahooPromise = fetch(proxyUrl)
                .then(res => res.json())
                .then(data => (data && data.quoteResponse && data.quoteResponse.result) ? data.quoteResponse.result : null)
                .catch(err => {
                    console.warn('Yahoo Fetch Error, using fallback data', err);
                    return null;
                });

            const [fxData, yahooData] = await Promise.all([fxPromise, yahooPromise]);

            // 환율 렌더링
            if (fxData && fxData.length > 0) {
                const usd = fxData[0];
                const price = usd.basePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const changePrice = usd.signedChangePrice || 0;
                const isUp = changePrice >= 0;
                const colorClass = isUp ? 'ticker-up' : 'ticker-down';
                const arrow = isUp ? '▲' : '▼';

                if (typeof exchangeRates !== 'undefined') {
                    if (!exchangeRates) exchangeRates = {};
                    exchangeRates['KRW'] = usd.basePrice;
                    exchangeRates['USD'] = 1;
                }

                fxHtml = `<span class="ticker-item">${tt('ticker-usdkrw')} <strong style="margin-left: 5px;">${price}</strong> <span class="${colorClass}">${arrow} ${Math.abs(changePrice).toFixed(2)}${tt('unit-won')}</span></span>`;
            } else {
                try {
                    const fallbackRes = await fetch('https://open.er-api.com/v6/latest/USD');
                    const fallbackData = await fallbackRes.json();
                    if (fallbackData && fallbackData.rates && fallbackData.rates.KRW) {
                        const price = fallbackData.rates.KRW.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        fxHtml = `<span class="ticker-item">${tt('ticker-usdkrw')} <strong style="margin-left: 5px;">${price}</strong></span>`;
                    } else {
                        fxHtml = renderFxFallback();
                    }
                } catch (e) {
                    fxHtml = renderFxFallback();
                }
            }

            // 주식 지수 렌더링 (심볼별로 실패해도 해당 항목만 폴백으로 대체)
            indexHtml = TICKER_FALLBACK.map(item => {
                const live = yahooData ? yahooData.find(y => y.symbol === item.symbol) : null;
                if (!live) return renderIndexFallback(item);

                const price = (live.regularMarketPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const changePct = live.regularMarketChangePercent || 0;
                const isUp = changePct >= 0;
                const colorClass = isUp ? 'ticker-up' : 'ticker-down';
                const arrow = isUp ? '▲' : '▼';
                return `<span class="ticker-item">${tt(item.nameKey)} <strong style="margin-left: 5px;">${price}</strong> <span class="${colorClass}">${arrow} ${Math.abs(changePct).toFixed(2)}%</span></span>`;
            }).join('');

        } catch (error) {
            // 예상치 못한 전체 실패 시에도 화면이 깨지지 않고 기본 데이터로 깔끔하게 대체
            console.error('Failed to fetch market data:', error);
            fxHtml = fxHtml || renderFxFallback();
            indexHtml = indexHtml || TICKER_FALLBACK.map(renderIndexFallback).join('');
        }

        const html = fxHtml + indexHtml;
        tickerContent.innerHTML = html + html + html;
        tickerContent.dataset.loaded = 'true';
    }

    fetchMarketData();
    setInterval(fetchMarketData, 5 * 60 * 1000); // 5분마다 조용히 갱신 (Rate Limit 방지 + 경량화)

    // 티커 자동 스크롤 및 드래그 로직
    const tickerWrapper = document.querySelector('.ticker-wrapper');
    let isDown = false;
    let startX;
    let scrollLeft;
    let animationId;
    let scrollPos = 0;
    
    if (tickerWrapper) {
        function autoScroll() {
            if (!isDown) {
                scrollPos += 0.5; // 스크롤 속도
                if (scrollPos >= tickerWrapper.scrollWidth / 3) {
                    scrollPos = 0;
                }
                tickerWrapper.scrollLeft = scrollPos;
            }
            animationId = requestAnimationFrame(autoScroll);
        }
        autoScroll();

        // 마우스 드래그 이벤트
        tickerWrapper.addEventListener('mousedown', (e) => {
            isDown = true;
            tickerWrapper.style.cursor = 'grabbing';
            startX = e.pageX - tickerWrapper.offsetLeft;
            scrollLeft = tickerWrapper.scrollLeft;
            cancelAnimationFrame(animationId);
        });
        
        tickerWrapper.addEventListener('mouseleave', () => {
            if(isDown) {
                isDown = false;
                tickerWrapper.style.cursor = 'grab';
                scrollPos = tickerWrapper.scrollLeft;
                autoScroll();
            }
        });
        
        tickerWrapper.addEventListener('mouseup', () => {
            isDown = false;
            tickerWrapper.style.cursor = 'grab';
            scrollPos = tickerWrapper.scrollLeft;
            autoScroll();
        });
        
        tickerWrapper.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - tickerWrapper.offsetLeft;
            const walk = (x - startX) * 1.5;
            tickerWrapper.scrollLeft = scrollLeft - walk;
        });
        
        // 터치 이벤트 (모바일용)
        tickerWrapper.addEventListener('touchstart', () => {
            isDown = true;
            cancelAnimationFrame(animationId);
        }, {passive: true});
        
        tickerWrapper.addEventListener('touchend', () => {
            isDown = false;
            scrollPos = tickerWrapper.scrollLeft;
            autoScroll();
        }, {passive: true});
        
        tickerWrapper.addEventListener('touchmove', () => {
            if(isDown) {
                scrollPos = tickerWrapper.scrollLeft;
            }
        }, {passive: true});
    }

});
