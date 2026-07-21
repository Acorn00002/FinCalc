let simpleChartInstance = null;
let periodicChartInstance = null;
let avgChartInstance = null;
let exchangeChartInstance = null;

// 환율 계산기: 토스/카카오뱅크 스타일의 단일 곡선 에어리어 차트 (축·범례 없이 흐름만 은은하게)
function updateExchangeChart(labels, data) {
    const canvas = document.getElementById('exchange-trend-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');

    if (exchangeChartInstance) {
        exchangeChartInstance.destroy();
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 120);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.28)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

    exchangeChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                borderColor: 'rgb(99, 102, 241)',
                backgroundColor: gradient,
                borderWidth: 2.5,
                fill: true,
                tension: 0.45,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHoverBackgroundColor: 'rgb(99, 102, 241)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { intersect: false, mode: 'index' }
            },
            interaction: { intersect: false, mode: 'index' },
            scales: {
                x: { display: false },
                y: { display: false }
            }
        }
    });
}

const chartColors = {
    principal: 'rgba(79, 70, 229, 0.6)', // Indigo
    profit: 'rgba(16, 185, 129, 0.6)',    // Emerald
    principalBorder: 'rgb(79, 70, 229)',
    profitBorder: 'rgb(16, 185, 129)',
    text: () => document.documentElement.getAttribute('data-theme') === 'dark' ? '#94a3b8' : '#4a5568',
    grid: () => document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
};

function getCommonOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: { color: chartColors.text() }
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            const symbol = document.getElementById('currency-select').value === 'USD' ? '$' : '₩';
                            label += symbol + new Intl.NumberFormat().format(Math.floor(context.parsed.y));
                        }
                        return label;
                    },
                    footer: function(tooltipItems) {
                        let sum = 0;
                        tooltipItems.forEach(function(tooltipItem) {
                            sum += tooltipItem.parsed.y;
                        });
                        const symbol = document.getElementById('currency-select').value === 'USD' ? '$' : '₩';
                        return '총액: ' + symbol + new Intl.NumberFormat().format(Math.floor(sum));
                    }
                }
            }
        },
        scales: {
            x: {
                stacked: true,
                ticks: { color: chartColors.text() },
                grid: { color: chartColors.grid() }
            },
            y: {
                stacked: true,
                ticks: { 
                    color: chartColors.text(),
                    callback: function(value) {
                        if (value >= 100000000) return (value / 100000000) + '억';
                        if (value >= 10000) return (value / 10000) + '만';
                        return value;
                    }
                },
                grid: { color: chartColors.grid() }
            }
        }
    };
}

function updateSimpleChart(years, principalData, profitData) {
    const ctx = document.getElementById('simple-chart').getContext('2d');
    
    if (simpleChartInstance) {
        simpleChartInstance.destroy();
    }

    simpleChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: years,
            datasets: [
                {
                    label: '원금',
                    data: principalData,
                    backgroundColor: chartColors.principal,
                    borderColor: chartColors.principalBorder,
                    borderWidth: 1
                },
                {
                    label: '수익금',
                    data: profitData,
                    backgroundColor: chartColors.profit,
                    borderColor: chartColors.profitBorder,
                    borderWidth: 1
                }
            ]
        },
        options: getCommonOptions()
    });
}

function updatePeriodicChart(years, principalData, profitData) {
    const ctx = document.getElementById('periodic-chart').getContext('2d');
    
    if (periodicChartInstance) {
        periodicChartInstance.destroy();
    }

    periodicChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: years,
            datasets: [
                {
                    label: '총 납입 원금',
                    data: principalData,
                    backgroundColor: chartColors.principal,
                    borderColor: chartColors.principalBorder,
                    borderWidth: 1
                },
                {
                    label: '누적 수익금',
                    data: profitData,
                    backgroundColor: chartColors.profit,
                    borderColor: chartColors.profitBorder,
                    borderWidth: 1
                }
            ]
        },
        options: getCommonOptions()
    });
}

// 평단가(물타기) 시뮬레이터 - 매수금액에 따른 평단가 수렴 곡선
function getAvgChartOptions() {
    const tickFormatter = function(value) {
        if (Math.abs(value) >= 100000000) return (value / 100000000) + '억';
        if (Math.abs(value) >= 10000) return (value / 10000) + '만';
        return value;
    };

    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
            legend: {
                labels: { color: chartColors.text() }
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        const symbol = document.getElementById('currency-select').value === 'USD' ? '$' : '₩';
                        const y = context.parsed.y;
                        return `${context.dataset.label}: ${symbol}${new Intl.NumberFormat().format(Math.round(y))}`;
                    }
                }
            }
        },
        scales: {
            x: {
                type: 'linear',
                title: { display: true, text: '추가 매수 금액', color: chartColors.text() },
                ticks: { color: chartColors.text(), callback: tickFormatter },
                grid: { color: chartColors.grid() }
            },
            y: {
                title: { display: true, text: '평단가', color: chartColors.text() },
                ticks: { color: chartColors.text(), callback: tickFormatter },
                grid: { color: chartColors.grid() }
            }
        }
    };
}

function updateAvgChart(curvePoints, marketPrice, currentPoint) {
    const canvas = document.getElementById('avg-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const refLine = curvePoints.length ? [
        { x: curvePoints[0].x, y: marketPrice },
        { x: curvePoints[curvePoints.length - 1].x, y: marketPrice }
    ] : [];

    const datasets = [
        {
            label: '평단가',
            data: curvePoints,
            borderColor: chartColors.principalBorder,
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 4,
            fill: false
        },
        {
            label: '시장가',
            data: refLine,
            borderColor: chartColors.text(),
            borderDash: [6, 6],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false
        },
        {
            label: '현재 시뮬레이션',
            data: currentPoint ? [currentPoint] : [],
            borderColor: chartColors.profitBorder,
            backgroundColor: chartColors.profitBorder,
            pointRadius: 6,
            pointHoverRadius: 8,
            showLine: false
        }
    ];

    if (avgChartInstance) {
        avgChartInstance.data.datasets = datasets;
        avgChartInstance.options = getAvgChartOptions();
        avgChartInstance.update();
        return;
    }

    avgChartInstance = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: getAvgChartOptions()
    });
}

// 테마 변경 시 차트 다시 그리기
function refreshCharts() {
    if (simpleChartInstance) {
        simpleChartInstance.options = getCommonOptions();
        simpleChartInstance.update();
    }
    if (periodicChartInstance) {
        periodicChartInstance.options = getCommonOptions();
        periodicChartInstance.update();
    }
    if (avgChartInstance) {
        avgChartInstance.options = getAvgChartOptions();
        avgChartInstance.update();
    }
}
