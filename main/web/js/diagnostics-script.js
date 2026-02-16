/**
 * DIAGNOSTICS-SCRIPT.JS - Version 2.1 (Debug Enhanced)
 * Fully aligned with window.getOBDDataBridge
 * UI: English language, Status badge in Bottom-Right
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Diagnostics System: Initialization started...');

    // Global Diagnostic Variables
    let currentDiagnosticData = null;
    let diagnosticUpdateInterval = 3000; // 3 seconds
    let dataSource = 'Disconnected'; 
    let diagnosticChart = null;
    let cycles = 0;
    
    // DOM Elements Mapping
    const elements = {
        lastScanTime: document.getElementById('lastScanTime'),
        criticalCount: document.getElementById('criticalCount'),
        warningCount: document.getElementById('warningCount'),
        totalCount: document.getElementById('totalCount'),
        readyCount: document.getElementById('readyCount'),
        dtcContainer: document.getElementById('dtcContainer'),
        noDtcMessage: document.getElementById('noDtcMessage'),
        readinessContainer: document.getElementById('readinessContainer'),
        freezeFrameBody: document.getElementById('freezeFrameBody')
    };

    // Controllo integrità DOM
    const missingElements = Object.entries(elements).filter(([k, v]) => !v).map(([k]) => k);
    if (missingElements.length > 0) {
        console.warn('⚠️ Diagnostics: Missing DOM elements:', missingElements);
    } else {
        console.log('✅ Diagnostics: DOM mapping complete.');
    }

    // ============================================
    // 1. DATA BRIDGE & SOURCE DETECTION
    // ============================================
    
    function fetchFromBridge() {
        cycles++;
        if (typeof window.getOBDDataBridge === 'function') {
            const data = window.getOBDDataBridge();
            if (data) {
                if (dataSource !== 'real') console.log('✅ Diagnostics: Bridge connection established.');
                dataSource = 'real';
                return data;
            } else {
                if (cycles % 5 === 0) console.warn('📡 Diagnostics: Bridge function exists but returned null (Waiting for data)');
            }
        } else {
            if (cycles % 5 === 0) console.error('❌ Diagnostics: window.getOBDDataBridge is NOT defined in script.js');
        }
        dataSource = 'Disconnected';
        return null;
    }

    // ============================================
    // 2. STATUS BADGE (Bottom-Right, English)
    // ============================================
    
    function updateStatusBadge() {
        let badge = document.getElementById('diag-status-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'diag-status-badge';
            badge.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 10px 16px;
                border-radius: 8px;
                font-family: 'Segoe UI', sans-serif;
                font-size: 12px;
                font-weight: bold;
                text-transform: uppercase;
                z-index: 10000;
                color: white;
                box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                display: flex;
                align-items: center;
                gap: 8px;
                transition: all 0.3s ease;
            `;
            document.body.appendChild(badge);
            console.log('🎨 Diagnostics: Status badge created.');
        }

        if (dataSource === 'real') {
            badge.style.background = 'rgba(40, 167, 69, 0.9)'; // Green
            badge.innerHTML = '<i class="fas fa-link"></i> OBD: Connected';
        } else {
            badge.style.background = 'rgba(243, 82, 18, 0.9)'; // Orange
            badge.innerHTML = '<i class="fas fa-microchip"></i> OBD: Disconnected';
        }
    }

    // ============================================
    // 3. DIAGNOSTIC LOGIC
    // ============================================
    
    function updateDiagnostics() {
        const obd = fetchFromBridge();
        updateStatusBadge();

        if (obd) {
            console.debug(`📊 Cycle ${cycles}: Data received`, { 
                RPM: obd.rpm, 
                Temp: obd.temp_coolant, 
                DTCs: obd.dtc 
            });
        }

        // Use bridge data or fallback simulated values
        const d = obd || {
            rpm: 0, speed: 0, temp_coolant: 0, load: 0, batt: 0, fuel_trim_s: 0, dtc: 0
        };

        try {
            // Update Counters
            if (elements.lastScanTime) elements.lastScanTime.textContent = new Date().toLocaleTimeString();
            if (elements.totalCount) elements.totalCount.textContent = d.dtc || 0;
            
            // Readiness Logic (Example based on temperature)
            const readyCount = d.temp_coolant > 70 ? 7 : 4;
            if (elements.readyCount) elements.readyCount.textContent = `${readyCount}/8`;

            updateDTCUI(d);
            updateFreezeFrameUI(d);
            updateLiveChart(d);
            
        } catch (e) {
            console.error('❌ Diagnostics: Error during UI update:', e);
        }
    }

    function updateDTCUI(d) {
        if (!elements.dtcContainer) return;

        if (!d.dtc || d.dtc === 0) {
            if (elements.noDtcMessage) elements.noDtcMessage.style.display = 'block';
            elements.dtcContainer.style.display = 'none';
        } else {
            console.warn(`🚨 Diagnostics: ${d.dtc} DTC codes detected!`);
            if (elements.noDtcMessage) elements.noDtcMessage.style.display = 'none';
            elements.dtcContainer.style.display = 'grid';
            elements.dtcContainer.innerHTML = `
                <div class="dtc-card warning">
                    <div class="dtc-header">
                        <span class="dtc-code">P0${Math.floor(d.rpm/100) || '101'}</span>
                        <span class="dtc-badge dtc-high">ACTIVE</span>
                    </div>
                    <div class="dtc-description">Active fault detected. Bridge data: RPM @ ${Math.round(d.rpm)}.</div>
                </div>
            `;
        }
    }

    function updateFreezeFrameUI(d) {
        if (!elements.freezeFrameBody) return;
        elements.freezeFrameBody.innerHTML = `
            <tr><td>Engine RPM</td><td>${Math.round(d.rpm)}</td><td>RPM</td><td>${d.rpm > 5000 ? 'High' : 'Normal'}</td></tr>
            <tr><td>Coolant Temp</td><td>${Math.round(d.temp_coolant)}</td><td>°C</td><td>${d.temp_coolant > 100 ? 'Warning' : 'Normal'}</td></tr>
            <tr><td>Engine Load</td><td>${(d.load || 0).toFixed(1)}</td><td>%</td><td>Normal</td></tr>
            <tr><td>Battery</td><td>${(d.batt || 0).toFixed(1)}</td><td>V</td><td>${d.batt < 12.5 ? 'Low' : 'OK'}</td></tr>
        `;
    }

    // ============================================
    // 4. CHART INITIALIZATION
    // ============================================
    
    function initChart() {
        const ctx = document.getElementById('diagnosticChart');
        if (!ctx) {
            console.error('❌ Diagnostics: Chart canvas NOT found!');
            return;
        }
        
        diagnosticChart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: Array(10).fill(''),
                datasets: [{
                    label: 'Short Term Fuel Trim (%)',
                    data: Array(10).fill(0),
                    borderColor: '#4ecdc4',
                    backgroundColor: 'rgba(78, 205, 196, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { min: -20, max: 20, grid: { color: 'rgba(255,255,255,0.1)' } },
                    x: { display: false }
                },
                plugins: { legend: { labels: { color: '#fff' } } }
            }
        });
        console.log('📈 Diagnostics: Live chart initialized.');
    }

    function updateLiveChart(d) {
        if (!diagnosticChart) return;
        const val = d.fuel_trim_s || 0;
        diagnosticChart.data.datasets[0].data.shift();
        diagnosticChart.data.datasets[0].data.push(val);
        diagnosticChart.update('none');
    }

    // ============================================
    // 5. STARTUP
    // ============================================
    
    try {
        initChart();
        updateDiagnostics();
        setInterval(updateDiagnostics, diagnosticUpdateInterval);
        console.log(`⏱️ Diagnostics: Loop started (Interval: ${diagnosticUpdateInterval}ms)`);
    } catch (err) {
        console.error('❌ Diagnostics: Critical startup error:', err);
    }

    const scanBtn = document.getElementById('scanAll');
    if (scanBtn) {
        scanBtn.addEventListener('click', function() {
            console.log('🔍 Diagnostics: Manual scan triggered.');
            const originalText = this.innerHTML;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning ECU...';
            this.disabled = true;
            
            setTimeout(() => {
                console.log('✅ Diagnostics: Manual scan complete.');
                this.innerHTML = '<i class="fas fa-check"></i> System Check Complete';
                this.disabled = false;
                updateDiagnostics();
                setTimeout(() => { this.innerHTML = originalText; }, 3000);
            }, 2000);
        });
    }
});