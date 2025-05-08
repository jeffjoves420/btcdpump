document.addEventListener('DOMContentLoaded', () => {
    // Initialize application
    const app = new TradingDashboard();
    app.init();
});

class TradingDashboard {
    constructor() {
        // App state
        this.state = {
            priceChart: null,
            liquidationChart: null,
            closingPrices: [],
            predictedPrices: [],
            historicalAccuracy: [],
            predictionHistory: [],
            currentPrice: null,
            refreshIntervals: []
        };

        // Configuration
        this.config = {
            initialTimeframe: '1h',
            refreshIntervals: {
                marketData: 30000,
                news: 300000,
                charts: 60000,
                events: 600000
            }
        };

        // DOM elements
        this.elements = {
            priceChartCtx: document.getElementById('priceChart').getContext('2d'),
            liquidationChartCtx: document.getElementById('liquidationChart').getContext('2d'),
            price: document.querySelector('.btc-price .value'),
            marketCap: document.querySelector('.btc-mc .value'),
            volume: document.querySelector('.btc-volume .value'),
            sentimentValue: document.querySelector('.btc-sentiment .value'),
            sentimentIndicator: document.querySelector('.greed-indicator'),
            positionSignal: document.getElementById('position-signal'),
            timeframe: document.getElementById('timeframe'),
            accuracyPercentage: document.getElementById('accuracy-percentage'),
            liquidationTimeframe: document.getElementById('liquidationTimeframe'),
            longLiquidated: document.getElementById('longLiquidated'),
            shortLiquidated: document.getElementById('shortLiquidated'),
            newsTime: document.getElementById('newsTime'),
            newsContainer: document.querySelector('.news-items'),
            hamburger: document.querySelector('.hamburger'),
            navLinks: document.querySelector('.nav-links')
        };
    }

    init() {
        // Set current year in footer
        document.getElementById('currentYear').textContent = new Date().getFullYear();

        // Initialize navigation
        this.initNavigation();

        // Initialize charts
        this.initCharts();

        // Load all data
        this.loadAllData();

        // Set up event listeners
        this.setupEventListeners();
    }

    initNavigation() {
        this.elements.hamburger.addEventListener('click', () => {
            const isActive = this.elements.navLinks.classList.toggle('active');
            this.elements.hamburger.classList.toggle('active');
            this.elements.hamburger.setAttribute('aria-expanded', isActive);
        });

        window.addEventListener('scroll', () => {
            document.querySelector('.nav').classList.toggle('scrolled', window.scrollY > 50);
        });
    }

    initCharts() {
        // Price Chart
        this.state.priceChart = new Chart(this.elements.priceChartCtx, {
            type: 'line',
            data: { labels: [], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        position: 'top',
                        labels: { 
                            color: 'rgba(255, 255, 255, 0.8)',
                            font: { weight: '600' },
                            boxWidth: 12
                        }
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
                                    label += new Intl.NumberFormat('en-US', { 
                                        style: 'currency', 
                                        currency: 'USD' 
                                    }).format(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: { 
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: 'rgba(255, 255, 255, 0.7)' }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { 
                            color: 'rgba(255, 255, 255, 0.7)',
                            callback: function(value) {
                                return new Intl.NumberFormat('en-US', { 
                                    style: 'currency', 
                                    currency: 'USD',
                                    maximumFractionDigits: 0
                                }).format(value);
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });

        // Liquidation Chart
        this.state.liquidationChart = new Chart(this.elements.liquidationChartCtx, {
            type: 'bar',
            data: {
                labels: ['Long', 'Short'],
                datasets: [{
                    label: 'Liquidations',
                    data: [0, 0],
                    backgroundColor: [
                        'rgba(75, 192, 192, 0.7)',
                        'rgba(255, 99, 132, 0.7)'
                    ],
                    borderColor: [
                        'rgba(75, 192, 192, 1)',
                        'rgba(255, 99, 132, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)',
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    y: {
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': $' + context.raw.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }

    async loadAllData() {
        try {
            await Promise.all([
                this.fetchMarketData(),
                this.fetchNews(),
                this.fetchChartData(this.config.initialTimeframe),
                this.fetchOrderBook(),
                this.fetchLiquidationData('1h')
            ]);
            
            // Set up periodic refreshes
            this.state.refreshIntervals = [
                setInterval(() => this.fetchMarketData(), this.config.refreshIntervals.marketData),
                setInterval(() => this.fetchNews(), this.config.refreshIntervals.news),
                setInterval(() => this.fetchChartData(this.elements.timeframe.value), this.config.refreshIntervals.charts),
                setInterval(() => this.fetchOrderBook(), 5000),
                setInterval(() => this.fetchLiquidationData(this.elements.liquidationTimeframe.value), 60000)
            ];
            
        } catch (error) {
            console.error("Initial load failed:", error);
            this.showErrorStates();
        }
    }

    setupEventListeners() {
        // Timeframe changes
        this.elements.timeframe.addEventListener('change', (e) => {
            this.fetchChartData(e.target.value);
        });

        this.elements.liquidationTimeframe.addEventListener('change', (e) => {
            this.fetchLiquidationData(e.target.value);
        });

        // News refresh
        document.querySelector('.news-refresh i').addEventListener('click', () => this.fetchNews());

        // Clean up on page unload
        window.addEventListener('beforeunload', () => {
            this.state.refreshIntervals.forEach(interval => clearInterval(interval));
        });
    }

    async fetchMarketData() {
        try {
            const [geckoResponse, fgiResponse] = await Promise.all([
                fetch('https://api.coingecko.com/api/v3/coins/bitcoin'),
                fetch('https://api.alternative.me/fng/')
            ]);
            
            if (!geckoResponse.ok || !fgiResponse.ok) {
                throw new Error('API response not OK');
            }
            
            const [geckoData, fgiData] = await Promise.all([
                geckoResponse.json(),
                fgiResponse.json()
            ]);
            
            this.updateMarketData({
                price: geckoData.market_data.current_price.usd,
                marketCap: geckoData.market_data.market_cap.usd,
                volume: geckoData.market_data.total_volume.usd
            });
            
            this.updateSentiment(fgiData.data[0]);
            
        } catch (error) {
            console.error("Market data fetch error:", error);
            await this.fetchMarketDataFromBinance();
        }
    }

    async fetchMarketDataFromBinance() {
        try {
            const [priceRes, statsRes] = await Promise.all([
                fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT'),
                fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT')
            ]);
            
            if (!priceRes.ok || !statsRes.ok) {
                throw new Error('Binance API not OK');
            }
            
            const [priceData, statsData] = await Promise.all([
                priceRes.json(),
                statsRes.json()
            ]);
            
            this.updateMarketData({
                price: parseFloat(priceData.price),
                volume: parseFloat(statsData.volume),
                marketCap: null
            });
            
        } catch (error) {
            console.error("Binance fallback failed:", error);
            throw error;
        }
    }

    updateMarketData(data) {
        this.state.currentPrice = data.price;
        this.elements.price.textContent = this.formatCurrency(data.price);
        this.elements.volume.textContent = data.volume ? this.formatCurrency(data.volume / 1e9, 3) + 'B' : 'N/A';
        this.elements.marketCap.textContent = data.marketCap ? this.formatCurrency(data.marketCap / 1e12, 3) + 'T' : 'N/A';
    }

  updateSentiment(fgiData) {
        this.elements.sentimentValue.textContent = fgiData.value;
        this.elements.sentimentIndicator.style.left = `${fgiData.value}%`;
        
        if (fgiData.value > 66) {
            this.elements.sentimentIndicator.style.backgroundColor = 'var(--positive)';
        } else if (fgiData.value > 33) {
            this.elements.sentimentIndicator.style.backgroundColor = 'var(--neutral)';
        } else {
            this.elements.sentimentIndicator.style.backgroundColor = 'var(--negative)';
        }
    } 
       
    async fetchChartData(timeframe) {
        try {
            const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${timeframe}&limit=100`);
            
            if (!response.ok) {
                throw new Error('Chart data fetch failed');
            }
            
            const data = await response.json();
            this.state.closingPrices = data.map(item => parseFloat(item[4]));
            const timestamps = data.map(item => new Date(item[0]).toLocaleTimeString());
            
            this.state.predictedPrices = this.calculatePredictions(this.state.closingPrices);
            
            this.updatePriceChart(this.state.closingPrices, this.state.predictedPrices, timestamps);
            this.updatePredictionMetrics();
            
        } catch (error) {
            console.error("Chart data error:", error);
            this.useSampleChartData();
        }
    }

    calculatePredictions(closingPrices) {
        // Use EMA (Exponential Moving Average) for prediction
        const emaPeriod = 9;
        const multiplier = 2 / (emaPeriod + 1);
        let ema = closingPrices.slice(0, emaPeriod).reduce((a, b) => a + b, 0) / emaPeriod;
        
        const emaValues = [];
        for (let i = emaPeriod; i < closingPrices.length; i++) {
            ema = (closingPrices[i] - ema) * multiplier + ema;
            emaValues.push(ema);
        }
        
        // Generate predictions (3 future periods)
        const lastPrice = closingPrices[closingPrices.length - 1];
        const trend = lastPrice > closingPrices[closingPrices.length - 2] ? 1 : -1;
        const recentVolatility = this.calculateVolatility(closingPrices.slice(-14));
        
        const predictedPrices = [...closingPrices];
        for (let i = 0; i < 3; i++) {
            const prediction = lastPrice * (1 + (trend * (0.005 + recentVolatility * 0.5) * (i + 1)));
            predictedPrices.push(prediction);
        }
        
        return predictedPrices;
    }

    calculateVolatility(prices) {
        if (prices.length < 2) return 0;
        const changes = [];
        for (let i = 1; i < prices.length; i++) {
            changes.push(Math.abs(prices[i] - prices[i-1]) / prices[i-1]);
        }
        return changes.reduce((a, b) => a + b, 0) / changes.length;
    }

    updatePriceChart(closingPrices, predictedPrices, timestamps) {
        const isBullish = predictedPrices[predictedPrices.length - 1] > closingPrices[closingPrices.length - 1];
        const timeframe = this.elements.timeframe.value;
        
        // Extend timestamps for predictions
        const extendedTimestamps = [...timestamps];
        for (let i = 1; i <= 3; i++) {
            extendedTimestamps.push(`+${i}${timeframe}`);
        }
        
        // Only show predictions for future periods
        const displayPredictedPrices = [...closingPrices];
        for (let i = 0; i < 3; i++) {
            displayPredictedPrices.push(null);
        }
        for (let i = closingPrices.length; i < predictedPrices.length; i++) {
            displayPredictedPrices[i] = predictedPrices[i];
        }

        this.state.priceChart.data = {
            labels: extendedTimestamps,
            datasets: [
                {
                    label: 'BTC Closing Price',
                    data: closingPrices,
                    borderColor: 'rgba(255, 255, 255, 0.8)',
                    borderWidth: 2,
                    tension: 0.1,
                    fill: false,
                    pointRadius: 0
                },
                {
                    label: 'Prediction',
                    data: displayPredictedPrices,
                    borderColor: isBullish ? 'rgba(39, 174, 96, 0.8)' : 'rgba(231, 76, 60, 0.8)',
                    backgroundColor: isBullish ? 'rgba(39, 174, 96, 0.2)' : 'rgba(219, 68, 52, 0.2)',
                    borderWidth: 3,
                    borderDash: [5, 5],
                    tension: 0.4,
                    fill: true,
                    pointRadius: 0
                }
            ]
        };
        
        this.state.priceChart.update();
    }

    updatePredictionMetrics() {
        if (this.state.closingPrices.length < 2 || this.state.predictedPrices.length < 2) {
            return;
        }
        
        // Calculate accuracy based on direction prediction
        let correct = 0;
        let total = 0;
        
        for (let i = 1; i < this.state.closingPrices.length - 3; i++) {
            const actualDirection = this.state.closingPrices[i] > this.state.closingPrices[i-1] ? 1 : -1;
            const predictedDirection = this.state.predictedPrices[i] > this.state.predictedPrices[i-1] ? 1 : -1;
            
            if (actualDirection === predictedDirection) {
                correct++;
            }
            total++;
        }
        
        // Current prediction direction
        const currentPrice = this.state.closingPrices[this.state.closingPrices.length - 1];
        const predictedPrice = this.state.predictedPrices[this.state.predictedPrices.length - 1];
        const isBullish = predictedPrice > currentPrice;
        
        // Store prediction for accuracy calculation
        this.state.predictionHistory.push({
            timestamp: Date.now(),
            isBullish,
            actualPrice: currentPrice
        });
        
        if (this.state.predictionHistory.length > 20) {
            this.state.predictionHistory.shift();
        }
        
        // Calculate accuracy based on previous predictions
        let verifiedCorrect = 0;
        let verifiedTotal = 0;
        
        for (let i = 0; i < this.state.predictionHistory.length - 1; i++) {
            const prediction = this.state.predictionHistory[i];
            const nextPrediction = this.state.predictionHistory[i+1];
            
            if (nextPrediction) {
                const actualDirection = nextPrediction.actualPrice > prediction.actualPrice ? 1 : -1;
                const predictedDirection = prediction.isBullish ? 1 : -1;
                
                if (actualDirection === predictedDirection) {
                    verifiedCorrect++;
                }
                verifiedTotal++;
            }
        }
        
        const accuracy = verifiedTotal > 0 ? Math.round((verifiedCorrect / verifiedTotal) * 100) : 50;
        
        // Update historical accuracy
        this.state.historicalAccuracy.push(accuracy);
        if (this.state.historicalAccuracy.length > 10) {
            this.state.historicalAccuracy.shift();
        }
        
        // Calculate average accuracy
        const avgAccuracy = Math.round(
            this.state.historicalAccuracy.reduce((a, b) => a + b, 0) / 
            this.state.historicalAccuracy.length
        );
        
        // Update UI elements
        this.elements.accuracyPercentage.textContent = `${avgAccuracy}%`;
        this.elements.accuracyPercentage.style.color = isBullish ? 'var(--positive)' : 'var(--negative)';
        this.elements.positionSignal.textContent = isBullish ? 'LONG' : 'SHORT';
        this.elements.positionSignal.style.backgroundColor = isBullish ? 'var(--positive)' : 'var(--negative)';
    }

    async fetchOrderBook() {
        try {
            const response = await fetch('https://api.binance.com/api/v3/depth?symbol=BTCUSDT&limit=20');
            const data = await response.json();

            // Calculate total volume
            const totalBidVolume = data.bids.reduce((acc, bid) => acc + parseFloat(bid[1]), 0);
            const totalAskVolume = data.asks.reduce((acc, ask) => acc + parseFloat(ask[1]), 0);
            const totalVolume = totalBidVolume + totalAskVolume;

            // Calculate percentages
            const buyPercentage = (totalBidVolume / totalVolume) * 100;
            const sellPercentage = (totalAskVolume / totalVolume) * 100;

            // Update progress bar
            const buyProgress = document.querySelector('.buy-progress');
            const sellProgress = document.querySelector('.sell-progress');

            //Added Chatgpt
            buyProgress.style.width = `${buyPercentage}%`;
            sellProgress.style.width = `${sellPercentage}%`;
            buyProgress.textContent = `${buyPercentage.toFixed(1)}%`;
            sellProgress.textContent = `${sellPercentage.toFixed(1)}%`;

            
            buyProgress.style.width = `${buyPercentage}%`;
            sellProgress.style.width = `${sellPercentage}%`;
            
            buyProgress.textContent = `${buyPercentage.toFixed(1)}%`;
            sellProgress.textContent = `${sellPercentage.toFixed(1)}%`;

            // Update order tables
            const bidTable = document.getElementById('bidTable').getElementsByTagName('tbody')[0];
            const askTable = document.getElementById('askTable').getElementsByTagName('tbody')[0];

            bidTable.innerHTML = '';
            askTable.innerHTML = '';

            // Populate bid table
            data.bids.forEach(bid => {
                const row = bidTable.insertRow();
                row.classList.add('bid');
                const price = parseFloat(bid[0]).toFixed(2);
                const volume = parseFloat(bid[1]).toFixed(4);

                row.insertCell(0).textContent = price;
                row.insertCell(1).textContent = volume;
            });

            // Populate ask table
            data.asks.forEach(ask => {
                const row = askTable.insertRow();
                row.classList.add('ask');
                const price = parseFloat(ask[0]).toFixed(2);
                const volume = parseFloat(ask[1]).toFixed(4);

                row.insertCell(0).textContent = price;
                row.insertCell(1).textContent = volume;
            });

        } catch (error) {
            console.error('Error fetching order book:', error);
        }
        
    }

    async fetchLiquidationData(timePeriod) {
        try {
            // Simulated data - replace with actual API call
            const simulatedData = {
                '1h': { long: Math.random() * 1000000, short: Math.random() * 800000 },
                '4h': { long: Math.random() * 3000000, short: Math.random() * 2500000 },
                '1d': { long: Math.random() * 8000000, short: Math.random() * 7000000 },
                '1w': { long: Math.random() * 20000000, short: Math.random() * 18000000 }
            };

            const data = simulatedData[timePeriod];
            
            // Update chart
            this.state.liquidationChart.data.datasets[0].data = [data.long, data.short];
            this.state.liquidationChart.update();

            // Update stats
            this.elements.longLiquidated.textContent = this.formatCurrency(data.long, 0);
            this.elements.shortLiquidated.textContent = this.formatCurrency(data.short, 0);

        } catch (error) {
            console.error('Error fetching liquidation data:', error);
        }
    }

    async fetchNews() {
        try {
            const response = await fetch('https://min-api.cryptocompare.com/data/v2/news/?categories=BTC');
            
            if (!response.ok) {
                throw new Error('News fetch failed');
            }
            
            const data = await response.json();
            this.displayNews(data.Data.slice(0, 5));
            
            // Update last updated time
            this.elements.newsTime.textContent = new Date().toLocaleTimeString();
        } catch (error) {
            console.error("News fetch error:", error);
            document.querySelector('.news-items').innerHTML = '<div class="news-item error">Failed to load news</div>';
        }
    }

    displayNews(newsItems) {
        const newsContainer = this.elements.newsContainer;
        newsContainer.innerHTML = '';
        
        newsItems.forEach(item => {
            const newsElement = document.createElement('div');
            newsElement.className = 'news-item';
            newsElement.innerHTML = `
                <h4>${item.title}</h4>
                <p>${item.source_info.name} • ${new Date(item.published_on * 1000).toLocaleTimeString()}</p>
            `;
            newsElement.addEventListener('click', () => {
                window.open(item.url, '_blank');
            });
            newsContainer.appendChild(newsElement);
        });
    }

    useSampleChartData() {
        console.log("Using sample chart data");
        const now = new Date();
        const timestamps = Array.from({ length: 24 }, (_, i) => {
            const d = new Date(now);
            d.setHours(d.getHours() - 23 + i);
            return d.toLocaleTimeString();
        });
        
        const basePrice = 30000 + Math.random() * 10000;
        const prices = timestamps.map((_, i) => basePrice * (0.98 + (Math.random() * 0.04)));
        const predictedPrices = this.calculatePredictions(prices);
        
        this.updatePriceChart(prices, predictedPrices, timestamps);
        this.updatePredictionMetrics();
    }

    showErrorStates() {
        // Handle error states gracefully
        document.querySelectorAll('.value').forEach(el => {
            if (el.textContent === 'Loading...') {
                el.textContent = 'N/A';
            }
        });
    }

    formatCurrency(value, decimals = 2) {
        if (isNaN(value)) return 'N/A';
        return '$' + value.toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }
}


// MODAL FUNCTIONALITY
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('btcModal');
    
    // Function to open modal
    function openModal(e) {
      e.preventDefault();
      document.body.classList.add('modal-open');
      modal.classList.add('show');
    }
  
    // Function to close modal
    function closeModal() {
      modal.classList.remove('show');
      document.body.classList.remove('modal-open');
    }
  
    // Set up modal triggers
    function setupModalTriggers() {
      // Journal and Donate links
      const journalLinks = document.querySelectorAll('a[href="#"]');
      journalLinks.forEach(link => {
        if (link.getAttribute('aria-label') === 'Journal' || 
            link.getAttribute('aria-label') === 'Donate') {
          link.addEventListener('click', openModal);
        }
      });
      
      // Footer links (excluding external links)
      document.querySelectorAll('.footer-section a').forEach(link => {
        const href = link.getAttribute('href');
        if (href === '#') {
          link.addEventListener('click', openModal);
        }
      });
    }
  
    // Close modal events
    document.querySelector('.btc-modal-close').addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) {
      if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && modal.classList.contains('show')) {
        closeModal();
      }
    });
  
    // Initialize modal triggers
    setupModalTriggers();
    
    // Set current year in footer
    document.getElementById('currentYear').textContent = new Date().getFullYear();
  });
