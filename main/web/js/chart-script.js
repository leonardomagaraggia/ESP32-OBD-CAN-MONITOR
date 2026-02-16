// chart-script.js - Versione Causale con Avvio Ritardato
document.addEventListener('DOMContentLoaded', function() {
    // Configurazioni
    let charts = {};
    let dataPoints = 60; 
    let updateInterval = 100; // 10Hz per fluidità
    let dataHistory = {};
    let isRealDataAvailable = false;
    let isSystemReady = false; // Flag per il ritardo iniziale di 2s
    
    // Stato fisico per la simulazione causale (inerzia e logica)
    let physicsState = {
        rpm: 800,
        targetRpm: 800,
        speed: 0,
        coolant: 20, // Parte freddo
        intake: 25,
        fuelLevel: 65,
        load: 20,
        lastUpdate: Date.now()
    };

    const colors = {
        bg: '#1a1a2e',
        grid: '#2d3047',
        text: '#ffffff',
        series: [
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda0dd',
            '#00adb5', '#ff2e63', '#30e3ca', '#f8b400', '#9d65c9', '#00ffab'
        ]
    };

    // ============================================
    // 1. DATA SOURCE & PHYSICS ENGINE
    // ============================================
    
    function detectDataSource() {
        if (typeof window.getOBDChartData === 'function') return 'main_script';
        if (window.OBDSimulator && typeof window.OBDSimulator.getCurrentData === 'function') return 'obdsimulator';
        if (typeof window.fetchOBDData === 'function') return 'custom';
        return 'simulated';
    }
    
    // Generatore di dati simulati con CAUSALITÀ (Fisica semplificata)
    function generateCausalSimulation() {
        const now = Date.now();
        const dt = (now - physicsState.lastUpdate) / 1000; // Delta time in secondi
        physicsState.lastUpdate = now;

        // 1. Logica RPM (Target randomico lento + Inerzia)
        // Ogni tanto cambia il target RPM (simula guidatore)
        if (Math.random() < 0.02) { 
            physicsState.targetRpm = 800 + Math.random() * 3000; 
        }
        // Avvicina RPM al target (inerzia motore)
        const rpmDiff = physicsState.targetRpm - physicsState.rpm;
        physicsState.rpm += rpmDiff * 2.0 * dt; // Fattore 2.0 = velocità risposta

        // 2. Logica Velocità (Dipende direttamente da RPM - es. marcia fissa)
        // Rapporto fittizio: a 2000 giri -> 60 km/h
        const targetSpeed = (physicsState.rpm / 2000) * 60; 
        // Inerzia veicolo (più pesante del motore)
        physicsState.speed += (targetSpeed - physicsState.speed) * 0.5 * dt;

        // 3. Logica Temperatura (Sale lentamente fino a 90°)
        if (physicsState.coolant < 90) {
            physicsState.coolant += 2.0 * dt; // Sale di 2 gradi al secondo finché fredda
        } else {
            // Fluttua leggermente attorno a 90
            physicsState.coolant = 90 + Math.sin(now / 5000) * 2;
        }

        // 4. Carico Motore (Alto se acceleriamo, basso se stabile)
        physicsState.load = 20 + (Math.abs(rpmDiff) / 100); 

        return {
            timestamp: now,
            rpm: Math.max(0, physicsState.rpm),
            speed: Math.max(0, physicsState.speed),
            coolant: physicsState.coolant,
            intake: 30 + Math.sin(now/10000)*2,
            ambient: 22,
            manifoldPressure: 30 + (physicsState.rpm/100), // Più giri = più aspirazione
            baroPressure: 101,
            fuelPressure: 350,
            fuelLevel: physicsState.fuelLevel,
            shortTermFuelTrim: (Math.random() * 4) - 2,
            longTermFuelTrim: 1.5,
            batteryVoltage: 13.8 + (Math.random() * 0.2), // Alternatore stabile
            engineLoad: Math.min(100, physicsState.load),
            throttlePosition: Math.min(100, (physicsState.rpm - 800) / 30),
            maf: physicsState.rpm / 100
        };
    }
    
    async function fetchDataFromSource() {
        // Se siamo nel periodo di "warmup" (i 2 secondi iniziali), non recuperare nulla
        if (!isSystemReady) return null;

        const source = detectDataSource();
        let data = null;

        // Tenta di recuperare dati reali
        try {
            if (source === 'main_script') data = window.getOBDChartData();
            else if (source === 'obdsimulator') data = window.OBDSimulator.getCurrentData();
            else if (source === 'custom') data = await window.fetchOBDData();
        } catch (e) {
            console.warn("Errore fetch dati:", e);
        }

        // VALIDAZIONE: Se abbiamo dati validi (RPM esiste), usiamoli
        if (data && data.rpm !== undefined) {
            isRealDataAvailable = true;
            return {
                timestamp: data.timestamp || Date.now(),
                rpm: data.rpm,
                speed: data.speed,
                coolant: data.temp_coolant || data.coolant,
                intake: data.temp_intake || data.intake,
                ambient: data.temp_ambient || 25,
                manifoldPressure: data.press_intake || 100,
                baroPressure: data.press_baro || 101,
                fuelPressure: data.fuel_press || 300,
                fuelLevel: data.fuel_lvl || 50,
                shortTermFuelTrim: data.fuel_trim_s || 0,
                longTermFuelTrim: data.fuel_trim_l || 0,
                batteryVoltage: data.batt || 12.0,
                engineLoad: data.load || 0,
                throttlePosition: data.throttle || 0,
                maf: data.maf || 0
            };
        }

        // FALLBACK: Se non ci sono dati reali, usa la simulazione fisica
        isRealDataAvailable = false;
        return generateCausalSimulation();
    }

    // ============================================
    // 2. INITIALIZATION
    // ============================================

    function initCharts() {
        const commonOptions = (yLabel, y1Label) => ({
            responsive: true,
            maintainAspectRatio: false,
            animation: false, // Disabilita animazioni interne chart.js per performance real-time
            interaction: { intersect: false, mode: 'index' },
            scales: {
                x: { 
                    grid: { color: colors.grid, drawBorder: false },
                    ticks: { display: false } // Rimuovi label tempo asse X per pulizia
                },
                y: {
                    beginAtZero: true,
                    grid: { color: colors.grid, drawBorder: false },
                    ticks: { color: colors.text + '80' },
                    title: { display: !!yLabel, text: yLabel, color: colors.text + '80' }
                },
                ...(y1Label && {
                    y1: {
                        position: 'right',
                        beginAtZero: true,
                        grid: { drawOnChartArea: false },
                        ticks: { color: colors.text + '80' },
                        title: { display: true, text: y1Label, color: colors.text + '80' }
                    }
                })
            },
            plugins: {
                legend: { display: false },
                tooltip: { enabled: true, mode: 'index', intersect: false }
            },
            elements: { point: { radius: 0, hoverRadius: 4 }, line: { tension: 0.4 } }
        });

        // Setup Chart RPM/Speed
        charts.rpmSpeed = new Chart(document.getElementById('rpm-speed-chart'), {
            type: 'line',
            data: {
                labels: Array(dataPoints).fill(''),
                datasets: [
                    { label: 'RPM', data: Array(dataPoints).fill(0), borderColor: colors.series[0], backgroundColor: 'transparent', borderWidth: 2, yAxisID: 'y' },
                    { label: 'Speed', data: Array(dataPoints).fill(0), borderColor: colors.series[1], backgroundColor: 'transparent', borderWidth: 2, yAxisID: 'y1' }
                ]
            },
            options: commonOptions('RPM', 'km/h')
        });

        // Setup Chart Temp
        charts.temperature = new Chart(document.getElementById('temperature-chart'), {
            type: 'line',
            data: {
                labels: Array(dataPoints).fill(''),
                datasets: [
                    { label: 'Coolant', data: Array(dataPoints).fill(0), borderColor: colors.series[0], borderWidth: 2 },
                    { label: 'Intake', data: Array(dataPoints).fill(0), borderColor: colors.series[1], borderWidth: 2 },
                    { label: 'Ambient', data: Array(dataPoints).fill(0), borderColor: colors.series[2], borderWidth: 2 }
                ]
            },
            options: commonOptions('°C')
        });

        // Setup altri grafici...
        const createSimpleChart = (id, datasets, unit) => {
            charts[id] = new Chart(document.getElementById(`${id}-chart`), {
                type: 'line',
                data: {
                    labels: Array(dataPoints).fill(''),
                    datasets: datasets.map((label, i) => ({
                        label: label,
                        data: Array(dataPoints).fill(0),
                        borderColor: colors.series[i],
                        borderWidth: 2
                    }))
                },
                options: commonOptions(unit)
            });
        };

        createSimpleChart('pressure', ['Manifold', 'Barometric', 'Fuel'], 'kPa/Bar');
        createSimpleChart('fuel', ['Level', 'ST Trim', 'LT Trim'], '%');
        createSimpleChart('electrical', ['Battery'], 'Volts');
        createSimpleChart('performance', ['Load', 'Throttle', 'MAF'], '%');

        // Inizializza lo storico con dati "piatti" (fermi)
        initEmptyHistory();
    }

    // Inizializza storico a zero per l'effetto "fermo" iniziale
    function initEmptyHistory() {
        const now = Date.now();
        const keys = ['rpm', 'speed', 'coolant', 'intake', 'ambient', 'manifoldPressure', 'baroPressure', 'fuelPressure', 'fuelLevel', 'shortTermFuelTrim', 'longTermFuelTrim', 'batteryVoltage', 'engineLoad', 'throttlePosition', 'maf'];
        
        keys.forEach(key => {
            // Riempi con zeri o valori di base
            let baseVal = 0;
            if(key === 'batteryVoltage') baseVal = 12.0;
            if(key === 'baroPressure') baseVal = 101.0;
            if(key === 'coolant') baseVal = 20.0; // Temp ambiente iniziale

            dataHistory[key] = Array(dataPoints).fill(0).map((_, i) => ({
                timestamp: now - (dataPoints - i) * updateInterval,
                value: baseVal 
            }));
        });
    }

    // ============================================
    // 3. CORE LOOP
    // ============================================

    async function updateCharts() {
        // Se il sistema non è pronto (2 secondi iniziali), non fare nulla. 
        // I grafici rimangono piatti come inizializzati da initEmptyHistory.
        if (!isSystemReady) return;

        // Recupera dati (Reali o Simulati Causali)
        const data = await fetchDataFromSource();
        if (!data) return;

        // Aggiorna storico
        Object.keys(data).forEach(key => {
            if (key !== 'timestamp') {
                if (!dataHistory[key]) dataHistory[key] = [];
                dataHistory[key].push({ timestamp: data.timestamp, value: data[key] });
                if (dataHistory[key].length > dataPoints) dataHistory[key].shift();
            }
        });

        // Renderizza
        renderAllCharts();
        updateStatistics();
        updateStatusIndicator();
    }

    function renderAllCharts() {
        // Helper per aggiornare dataset
        const updateDs = (chart, key, index) => {
            if(chart && dataHistory[key]) {
                chart.data.datasets[index].data = dataHistory[key].map(d => d.value);
            }
        };

        updateDs(charts.rpmSpeed, 'rpm', 0);
        updateDs(charts.rpmSpeed, 'speed', 1);
        charts.rpmSpeed.update('none');

        updateDs(charts.temperature, 'coolant', 0);
        updateDs(charts.temperature, 'intake', 1);
        updateDs(charts.temperature, 'ambient', 2);
        charts.temperature.update('none');

        updateDs(charts.pressure, 'manifoldPressure', 0);
        updateDs(charts.pressure, 'baroPressure', 1);
        updateDs(charts.pressure, 'fuelPressure', 2);
        charts.pressure.update('none');

        updateDs(charts.fuel, 'fuelLevel', 0);
        updateDs(charts.fuel, 'shortTermFuelTrim', 1);
        updateDs(charts.fuel, 'longTermFuelTrim', 2);
        charts.fuel.update('none');

        updateDs(charts.electrical, 'batteryVoltage', 0);
        charts.electrical.update('none');

        updateDs(charts.performance, 'engineLoad', 0);
        updateDs(charts.performance, 'throttlePosition', 1);
        updateDs(charts.performance, 'maf', 2);
        charts.performance.update('none');
    }

    // ============================================
    // 4. STATS & UI
    // ============================================

    function updateStatistics() {
        if (!dataHistory.rpm || dataHistory.rpm.length === 0) return;
        
        // Prendi l'ultimo valore disponibile
        const last = (key) => {
            const arr = dataHistory[key];
            return arr && arr.length > 0 ? arr[arr.length-1].value : 0;
        };

        // Aggiorna valori testo header grafici
        const setTxt = (id, val, decimal=0) => {
            const el = document.getElementById(id);
            if(el) el.textContent = val.toFixed(decimal);
        };

        // Calcoli base
        const rpmArr = dataHistory.rpm.map(d => d.value);
        const maxRpm = Math.max(...rpmArr);
        const avgRpm = rpmArr.reduce((a,b)=>a+b,0) / rpmArr.length;

        setTxt('rpm-max', maxRpm);
        setTxt('speed-max', Math.max(...dataHistory.speed.map(d => d.value)));
        setTxt('rpm-avg', avgRpm);
        
        const battArr = dataHistory.batteryVoltage.map(d => d.value);
        setTxt('batt-min', Math.min(...battArr), 1);
        setTxt('batt-max', Math.max(...battArr), 1);
        setTxt('batt-avg', battArr.reduce((a,b)=>a+b,0)/battArr.length, 1);

        // Stats Avanzate (Box in fondo)
        setTxt('rpm-min', Math.min(...rpmArr));
        setTxt('rpm-max2', maxRpm);
        setTxt('rpm-avg2', avgRpm);
        
        // Deviazione Standard RPM
        const stdDev = Math.sqrt(rpmArr.map(x => Math.pow(x - avgRpm, 2)).reduce((a, b) => a + b) / rpmArr.length);
        setTxt('rpm-std', stdDev);
    }

    function updateStatusIndicator() {
        let indicator = document.getElementById('data-source-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'data-source-indicator';
            indicator.style.cssText = `position: fixed; bottom: 10px; right: 10px; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight:bold; z-index: 1000; transition: all 0.3s;`;
            document.body.appendChild(indicator);
        }

        if (!isSystemReady) {
            indicator.textContent = '⏳ Initializing...';
            indicator.style.background = '#f39c12'; // Arancione
            indicator.style.color = 'white';
        } else if (isRealDataAvailable) {
            indicator.textContent = '📡 LIVE DATA LINKED';
            indicator.style.background = '#27ae60'; // Verde
            indicator.style.color = 'white';
        } else {
            indicator.textContent = '⚠️ SIMULATION MODE';
            indicator.style.background = '#c0392b'; // Rosso
            indicator.style.color = 'white';
        }
    }

    // ============================================
    // 5. MAIN INIT
    // ============================================

    function setupControls() {
        const intervalSel = document.getElementById('chart-interval');
        if(intervalSel) {
            intervalSel.addEventListener('change', function(e) {
                // Ricalcola quanti punti tenere in base ai secondi richiesti
                const seconds = parseInt(e.target.value);
                dataPoints = Math.ceil(seconds * 1000 / updateInterval);
                // Reset grafico per adattare asse X
                initCharts(); 
            });
        }

        const exportBtn = document.getElementById('export-chart-btn');
        if(exportBtn) {
            exportBtn.addEventListener('click', () => {
                const chartId = document.getElementById('export-chart-select').value;
                if(chartId === 'all') alert("Export All not implemented in this demo"); // Placeholder
                else if(charts[chartId]) {
                    const link = document.createElement('a');
                    link.download = `chart-${chartId}.png`;
                    link.href = charts[chartId].toBase64Image();
                    link.click();
                } else if(chartId === 'rpm-speed') {
                    // Mapping per il chart specifico
                     const link = document.createElement('a');
                    link.download = `chart-rpm.png`;
                    link.href = charts.rpmSpeed.toBase64Image();
                    link.click();
                }
            });
        }
    }

    function init() {
        console.log('📊 Starting Chart System...');
        
        // 1. Disegna grafici vuoti (fermi)
        initCharts();
        setupControls();
        updateStatusIndicator();

        // 2. Avvia il loop del timer immediatamente, MA...
        // ...dentro updateCharts() c'è il check su "isSystemReady"
        setInterval(updateCharts, updateInterval);

        // 3. Attendi 2 secondi prima di abilitare l'elaborazione dati
        console.log('⏳ Waiting 2 seconds for sensor warmup...');
        setTimeout(() => {
            isSystemReady = true;
            console.log('✅ System Ready - Starting Data Stream');
        }, 2000);
    }

    init();
});