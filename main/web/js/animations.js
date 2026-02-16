// ============================================
// OBD-II PROFESSIONAL ANIMATIONS ENGINE v3.0
// Ultra-smooth real-time gauge animations
// Optimized for 50ms updates (RPM/Speed)
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚗 OBD-II Professional Animations Engine v3.0 Initializing...');
    
    // ===========================
    // DOM ELEMENTS
    // ===========================

    
    const gaugeElements = {

      
        // Nuovi elementi per RPM
        rpmOverlay: document.getElementById('rpm-overlay'),
        rpmIllumination: document.getElementById('rpm-illumination'),
        rpmCursor: document.getElementById('rpm-cursor'),
        
        // Nuovi elementi per Speed
        speedOverlay: document.getElementById('speed-overlay'),
        speedIllumination: document.getElementById('speed-illumination'),
        speedCursor: document.getElementById('speed-cursor'),

        // Progress bar fills
        rpmFill: document.getElementById('rpm-fill'),
        speedFill: document.getElementById('speed-fill'),
        batteryFill: document.getElementById('battery-fill'),

        
        // Indicators
        rpmIndicator: document.getElementById('rpm-indicator'),
        speedIndicator: document.getElementById('speed-indicator'),
        batteryIndicator: document.getElementById('battery-indicator'),
        tempIndicator: document.getElementById('temp-indicator'),

        // Nuovi riferimenti per il toggle RPM
        rpmScaleContainer: document.getElementById('rpm-scale-container'),
        rpmSubtitle: document.getElementById('rpm-subtitle'),
        rpmToggleBtn: document.getElementById('rpm-toggle-btn'),
        
        // Values
        rpmValue: document.getElementById('kpi-rpm'),
        speedValue: document.getElementById('kpi-speed'),
        battValue: document.getElementById('kpi-batt'),
        tempValue: document.getElementById('kpi-temp-coolant'),
        
        // Status indicators
        batteryHealth: document.getElementById('battery-health'),
        rpmTrend: document.getElementById('rpm-trend'),
        speedTrend: document.getElementById('speed-trend'),
        
        // System elements
        connectionStatus: document.getElementById('connection-status'),
        connectionText: document.getElementById('connection-text'),
        signalStrength: document.getElementById('signal-strength'),
        signalStrengthDisplay: document.getElementById('signal-strength-display'),
        dataCount: document.getElementById('data-count'),
        pingTime: document.getElementById('ping-time'),
        pingTimeDisplay: document.getElementById('ping-time-display'),
        uptime: document.getElementById('uptime'),
        uptimeDisplay: document.getElementById('uptime-display'),
        dataPoints: document.getElementById('data-points'),
        bufferUsage: document.getElementById('buffer-usage'),
        bufferUsageDisplay: document.getElementById('buffer-usage-display'),
        latencyValue: document.getElementById('latency-value'),
        dtcCount: document.getElementById('dtc-count'),
        updateInterval: document.getElementById('update-interval'),
        updateIntervalDisplay: document.getElementById('update-interval-display'),
        totalData: document.getElementById('total-data'),
        dataRate: document.getElementById('data-rate'),
        dataRateDisplay: document.getElementById('data-rate-display'),
        performanceScore: document.getElementById('performance-score'),
        storageFree: document.getElementById('storage-free'),
        logCount: document.getElementById('log-count'),
        
        // Parameter elements
        loadBar: document.getElementById('load-bar'),
        throttleBar: document.getElementById('throttle-bar'),
        pressIntakeBar: document.getElementById('press-intake-bar'),
        fuelLevelFill: document.getElementById('fuel-level-fill'),
        
        // Parameter values
        paramLoad: document.getElementById('param-load'),
        paramThrottle: document.getElementById('param-throttle'),
        paramTiming: document.getElementById('param-timing'),
        paramMaf: document.getElementById('param-maf'),
        paramFuelLvl: document.getElementById('param-fuel-lvl'),
        paramFuelPress: document.getElementById('param-fuel-press'),
        paramFuelTrimS: document.getElementById('param-fuel-trim-s'),
        paramFuelTrimL: document.getElementById('param-fuel-trim-l'),
        paramTempIntake: document.getElementById('param-temp-intake'),
        paramPressIntake: document.getElementById('param-press-intake'),
        paramPressBaro: document.getElementById('param-press-baro'),
        paramDistMil: document.getElementById('param-dist-mil'),
        ambientTemp: document.getElementById('ambient-temp'),
        tempDiff: document.getElementById('temp-diff'),
        fuelRange: document.getElementById('fuel-range'),
        kpiTempIntake: document.getElementById('kpi-temp-intake'),
        fuelLevelValue: document.getElementById('fuel-level-value')
    };
    
    // ===========================
    // STATE MANAGEMENT
    // ===========================
    let currentValues = {
        rpm: 2500,
        speed: 80,
        battery: 13.8,
        temp: 90,
        load: 45.5,
        throttle: 15.2,
        fuelLevel: 65,
        intakeTemp: 35,
        pressIntake: 101,
        previousRpm: 2500,
        previousSpeed: 80,
        previousBattery: 13.8,
        previousTemp: 90
    };
    
    let systemState = {
        connected: true,
        dataCount: 0,
        startTime: Date.now(),
        lastUpdate: Date.now(),
        updateRate: 50, // ms
        highPerfMode: true,
        animationFrame: null,
        dataPoints: [],
        maxDataPoints: 1000,
        connectionQuality: 100,
        systemPerformance: 98,
        dataRate: 0,
        // NUOVO: Configurazione RPM dinamica
        rpmConfig: {
            max: 5000, // Default a 5000 come richiesto
            steps: 5   // Numero di step nella scala
        }
    };
    
    // ===========================
    // ANIMATION ENGINE
    // ===========================
    const AnimationEngine = {
        // Interpolation factors for smooth transitions
        interpolation: {
            rpm: 0.15,    // Very fast (50ms updates)
            speed: 0.15,  // Very fast (50ms updates)
            battery: 0.3, // Fast (700ms updates)
            temp: 0.1,    // Slow (4000ms updates)
            params: 0.2   // Medium (2000ms updates)
        },
        
        // Timing configurations
        timing: {
            realTime: 100,     // Allineato a 10 Hz (come script.js HIGH)
            fast: 500,         // Allineato a 2 Hz (come script.js MEDIUM)
            medium: 2000,      // OK (2 sec, come script.js LOW)
            slow: 2000,        // Allineato a 0.5 Hz (come script.js LOW)
            uiUpdate: 1000     // OK
        },
        
        // Performance monitoring
        performance: {
            lastFrameTime: 0,
            frameCount: 0,
            fps: 60,
            jitter: 0,
            smoothness: 100
        },
         // GAUGE INITIALIZATION
    initGauges() {
        console.log('⚙️ Initializing Geometric Gauges...');
        
        // Imposta le dimensioni iniziali
        if (gaugeElements.rpmOverlay) {
            gaugeElements.rpmOverlay.style.width = '68.75%'; // 31.25% visible initially (2500/8000 = 31.25%)
        }
        
        if (gaugeElements.speedOverlay) {
            gaugeElements.speedOverlay.style.width = '66.67%'; // 33.33% visible initially (80/240 = 33.33%)
        }
        
        // Imposta posizioni iniziali del cursore
        if (gaugeElements.rpmCursor) {
            gaugeElements.rpmCursor.style.left = '31.25%';
        }
        
        if (gaugeElements.speedCursor) {
            gaugeElements.speedCursor.style.left = '33.33%';
        }
        
        // Attiva l'illuminazione iniziale
        if (gaugeElements.rpmIllumination) {
            gaugeElements.rpmIllumination.style.width = '31.25%';
            gaugeElements.rpmIllumination.style.opacity = '1';
        }
        
        if (gaugeElements.speedIllumination) {
            gaugeElements.speedIllumination.style.width = '33.33%';
            gaugeElements.speedIllumination.style.opacity = '1';
        }
        
        console.log('✅ Geometric Gauges Ready');
    },
        
        // Initialize animation engine
        init() {
            console.log('⚙️ Initializing Animation Engine...');
            
            // Set initial values
            this.updateAllGauges();
            
            // Start animation loops
            this.startLoops();
            
            // Setup performance monitoring
            this.setupPerformanceMonitoring();
            
            // Setup value observers
            this.setupObservers();
            
            // Initialize system status
            this.updateSystemStatus();

            this.setupRPMToggle(); // Chiama la nuova funzione setup
            
            console.log('✅ Animation Engine Ready');
        },
        
        // Start animation loops with different intervals
        startLoops() {
            // Real-time loop (50ms) - RPM & Speed
            setInterval(() => this.updateRealTimeValues(), this.timing.realTime);
            
            // Fast loop (700ms) - Battery
            setInterval(() => this.updateFastValues(), this.timing.fast);
            
            // Medium loop (2s) - Other parameters
            setInterval(() => this.updateMediumValues(), this.timing.medium);
            
            // Slow loop (4s) - Temperature & Fuel
            setInterval(() => this.updateSlowValues(), this.timing.slow);
            
            // UI update loop (1s)
            setInterval(() => this.updateUIElements(), this.timing.uiUpdate);
            
            // Animation frame for smooth rendering
            this.startAnimationFrame();
        },
        
        // Start requestAnimationFrame loop
        startAnimationFrame() {
            const animate = (timestamp) => {
                // Calculate FPS and performance
                this.calculatePerformance(timestamp);
                
                // Smooth interpolation for critical values
                this.smoothInterpolation();
                
                // Continue animation loop
                this.animationFrame = requestAnimationFrame(animate);
            };
            
            this.animationFrame = requestAnimationFrame(animate);
        },
        
        // Calculate performance metrics
        calculatePerformance(timestamp) {
            if (!this.performance.lastFrameTime) {
                this.performance.lastFrameTime = timestamp;
            }
            
            const delta = timestamp - this.performance.lastFrameTime;
            this.performance.lastFrameTime = timestamp;
            
            this.performance.frameCount++;
            
            // Calculate FPS every second
            if (timestamp % 1000 < 16) {
                this.performance.fps = Math.round(this.performance.frameCount * 1000 / delta);
                this.performance.frameCount = 0;
                
                // Calculate smoothness (100 = perfect, 0 = bad)
                const targetFrameTime = 16.67; // 60 FPS
                const frameJitter = Math.abs(delta - targetFrameTime);
                this.performance.jitter = Math.round(frameJitter);
                this.performance.smoothness = Math.max(0, 100 - (frameJitter * 2));
            }
        },
        
        // Smooth interpolation for critical values
        smoothInterpolation() {
            // Read current displayed values
            const currentRpm = parseInt(gaugeElements.rpmValue.textContent) || currentValues.rpm;
            const currentSpeed = parseInt(gaugeElements.speedValue.textContent) || currentValues.speed;
            
            // Apply interpolation
            currentValues.rpm += (currentRpm - currentValues.rpm) * this.interpolation.rpm;
            currentValues.speed += (currentSpeed - currentValues.speed) * this.interpolation.speed;
            
            // Update gauges with interpolated values
            this.updateRPMGauge(currentValues.rpm);
            this.updateSpeedGauge(currentValues.speed);
        },
        
        // Update real-time values (50ms)
        updateRealTimeValues() {
            // Read current values from DOM (updated by script.js)
            const newRpm = parseInt(gaugeElements.rpmValue.textContent) || currentValues.rpm;
            const newSpeed = parseInt(gaugeElements.speedValue.textContent) || currentValues.speed;
            
            // Store for interpolation
            currentValues.previousRpm = currentValues.rpm;
            currentValues.previousSpeed = currentValues.speed;
            
            // Update data points for rate calculation
            this.recordDataPoint('rpm', newRpm);
            this.recordDataPoint('speed', newSpeed);
        },
        
        // Update fast values (700ms)
        updateFastValues() {
            const newBatt = parseFloat(gaugeElements.battValue.textContent) || currentValues.battery;
            currentValues.previousBattery = currentValues.battery;
            currentValues.battery += (newBatt - currentValues.battery) * this.interpolation.battery;
            
            this.updateBatteryGauge(currentValues.battery);
            this.updateBatteryHealth(currentValues.battery);
        },
        
        // Update medium values (2s)
        updateMediumValues() {
            // Update parameter bars
            this.updateParameterBars();
            
            // Update system performance
            this.updatePerformanceMetrics();
        },
        
        // Update slow values (4s)
        updateSlowValues() {
            const newTemp = parseInt(gaugeElements.tempValue.textContent) || currentValues.temp;
            currentValues.previousTemp = currentValues.temp;
            currentValues.temp += (newTemp - currentValues.temp) * this.interpolation.temp;
            
            this.updateTempGauge(currentValues.temp);
            
            // Update fuel level
            this.updateFuelSystem();
        },
        
        // Update UI elements (1s)
        updateUIElements() {
            this.updateSystemStatus();
            this.updateConnectionQuality();
            this.updateDataRate();
        },
        
        // ===========================
        // GAUGE UPDATES
        // ===========================
        updateAllGauges() {
            this.updateRPMGauge(currentValues.rpm);
            this.updateSpeedGauge(currentValues.speed);
            this.updateBatteryGauge(currentValues.battery);
            this.updateTempGauge(currentValues.temp);
        },

        setupRPMToggle() {
            if (gaugeElements.rpmToggleBtn) {
                gaugeElements.rpmToggleBtn.addEventListener('click', () => {
                    // Alterna tra 5000 e 8000
                    const isLowRange = systemState.rpmConfig.max === 5000;
                    systemState.rpmConfig.max = isLowRange ? 8000 : 5000;
                    
                    // Aggiorna UI
                    this.refreshRPMScale();
                    
                    // Forza aggiornamento immediato gauge
                    this.updateRPMGauge(currentValues.rpm);
                    
                    console.log(`RPM Range switched to 0-${systemState.rpmConfig.max}`);
                });
            }
            // Inizializza la scala corretta all'avvio
            this.refreshRPMScale();
        },

        // NUOVA FUNZIONE: Ridisegna i numeri della scala
        refreshRPMScale() {
            if (!gaugeElements.rpmScaleContainer) return;
            
            const max = systemState.rpmConfig.max;
            
            
            // Pulisci scala attuale
            gaugeElements.rpmScaleContainer.innerHTML = '';
            
            // Genera nuovi span (0, 25%, 50%, 75%, 100%)
            // Usiamo 5 step per abbinare il CSS esistente
            const steps = 5; 
            for (let i = 0; i < steps; i++) {
                const val = (max / (steps - 1)) * i;
                const span = document.createElement('span');
                
                // Formattazione: se è intero mostra intero, altrimenti 1 decimale
                span.textContent = Number.isInteger(val/1000) ? (val/1000) : (val/1000).toFixed(1);
                // NOTA: il CSS esistente mette solo i numeri (0, 2, 4..). Qui mettiamo kRPM.
                // Se vuoi i numeri interi precisi per 5000: 0, 1.25, 2.5, 3.75, 5
                
                gaugeElements.rpmScaleContainer.appendChild(span);
            }
            gaugeElements.rpmSubtitle.textContent = `0-${max} RPM`;
        },


        updateRPMGauge(rpm) {
            const maxRpm = systemState.rpmConfig.max;
            
            // Validate and clamp RPM value dynamic max
            const normalizedRPM = Math.max(0, Math.min(rpm, maxRpm));
            const percentage = (normalizedRPM / maxRpm) * 100;
            
            // Calcola la larghezza dell'overlay
            const overlayWidth = 100 - percentage;
            
            gaugeElements.rpmOverlay.style.width = `${overlayWidth}%`;
            gaugeElements.rpmOverlay.style.right = '0';
            gaugeElements.rpmOverlay.style.left = 'auto';
            gaugeElements.rpmCursor.style.left = `${percentage}%`;
            
            // Illumination effect
            if (percentage > 5) {
                gaugeElements.rpmIllumination.style.width = `${percentage}%`;
                gaugeElements.rpmIllumination.style.opacity = '1';
            } else {
                gaugeElements.rpmIllumination.style.opacity = '0';
            }
            
            
            // Visual effects based on RPM range
            if (rpm > 7000) {
                // Danger zone - red cursor with pulse
                gaugeElements.rpmCursor.classList.add('danger-zone');
                gaugeElements.rpmCursor.style.background = 'var(--danger-color)';
            } else if (rpm > 5000) {
                // Warning zone - orange cursor
                gaugeElements.rpmCursor.classList.remove('danger-zone');
                gaugeElements.rpmCursor.style.background = '#f97316';
            } else if (rpm > 3000) {
                // Normal zone - yellow cursor
                gaugeElements.rpmCursor.classList.remove('danger-zone');
                gaugeElements.rpmCursor.style.background = 'var(--warning-color)';
            } else {
                // Low zone - green cursor
                gaugeElements.rpmCursor.classList.remove('danger-zone');
                gaugeElements.rpmCursor.style.background = 'var(--success-color)';
            }
            const pct = percentage;
            
            if (pct > 87.5) { // Danger zone
                gaugeElements.rpmCursor.classList.add('danger-zone');
                gaugeElements.rpmCursor.style.background = 'var(--danger-color)';
            } else if (pct > 62.5) { // Warning zone
                gaugeElements.rpmCursor.classList.remove('danger-zone');
                gaugeElements.rpmCursor.style.background = '#f97316';
            } else if (pct > 37.5) { // Normal zone
                gaugeElements.rpmCursor.classList.remove('danger-zone');
                gaugeElements.rpmCursor.style.background = 'var(--warning-color)';
            } else { // Low zone
                gaugeElements.rpmCursor.classList.remove('danger-zone');
                gaugeElements.rpmCursor.style.background = 'var(--success-color)';
            }
            
            // Update numeric display with formatting
            //gaugeElements.rpmValue.textContent = Math.round(rpm).toString().padStart(4, '0');
        },

        updateSpeedGauge(speed) {
            const normalizedSpeed = Math.max(0, Math.min(speed, 240));
            const percentage = (normalizedSpeed / 240) * 100;
            
            // Calcola la larghezza dell'overlay (parte oscurata a destra)
            const overlayWidth = 100 - percentage;
            
            // Update overlay (si espande da destra verso sinistra)
            gaugeElements.speedOverlay.style.width = `${overlayWidth}%`;
            gaugeElements.speedOverlay.style.right = '0';
            gaugeElements.speedOverlay.style.left = 'auto';
            
            // Update cursor position
            gaugeElements.speedCursor.style.left = `${percentage}%`;
            
            // Update illumination effect
            if (percentage > 5) {
                gaugeElements.speedIllumination.style.width = `${percentage}%`;
                gaugeElements.speedIllumination.style.opacity = '1';
            } else {
                gaugeElements.speedIllumination.style.opacity = '0';
            }
            
            
            // Visual effects based on speed
            if (speed > 180) {
                gaugeElements.speedCursor.classList.add('danger-zone');
                gaugeElements.speedCursor.style.background = 'var(--danger-color)';
            } else if (speed > 120) {
                gaugeElements.speedCursor.classList.remove('danger-zone');
                gaugeElements.speedCursor.style.background = 'var(--warning-color)';
            } else if (speed > 60) {
                gaugeElements.speedCursor.classList.remove('danger-zone');
                gaugeElements.speedCursor.style.background = 'var(--secondary-color)';
            } else {
                gaugeElements.speedCursor.classList.remove('danger-zone');
                gaugeElements.speedCursor.style.background = 'var(--primary-color)';
            }
            
            //gaugeElements.speedValue.textContent = Math.round(speed);
        },
        
        // MODIFICATA: Range 11V - 17V
        updateBatteryGauge(voltage) {
            // Range: Min 11V, Max 17V -> Delta 6V
            const minV = 11;
            const maxV = 17;
            const range = maxV - minV;
            
            const normalizedVoltage = Math.max(minV, Math.min(voltage, maxV));
            const percentage = ((normalizedVoltage - minV) / range) * 100;
            
            gaugeElements.batteryFill.style.width = `${percentage}%`;
            gaugeElements.batteryIndicator.style.left = `${percentage}%`;
            
            // Visual effects (Pulse solo se fuori range ottimale allargato)
            if (voltage < 11.5 || voltage > 16.5) {
                gaugeElements.batteryIndicator.style.animation = 'ultra-pulse 0.5s infinite';
                gaugeElements.batteryIndicator.style.background = 'var(--danger-color)';
            } else {
                gaugeElements.batteryIndicator.style.animation = 'none';
                gaugeElements.batteryIndicator.style.background = 'white';
            }
        },
        
        // MODIFICATA: Logica Charging/Overcharging
        updateBatteryHealth(voltage) {
            if (!gaugeElements.batteryHealth) return;
            
            let healthText, healthClass, healthColor;
            
            // 1.1: Overcharging
            if (voltage >= 17.5) {
                healthText = '<i class="fas fa-exclamation-triangle"></i> Overcharging';
                healthClass = 'danger';
                healthColor = 'var(--danger-color)';
            } 
            // Charging copre tutto il range alto sotto i 18V (es. alternatore attivo)
            else if (voltage > 13.5) {
                healthText = '<i class="fas fa-bolt"></i> Charging';
                healthClass = 'success'; // Cambiato in success o warning a seconda della preferenza
                healthColor = 'var(--success-color)'; // Verde perché sta caricando correttamente
            } 
            // Voltaggio batteria a riposo sana
            else if (voltage > 12.0) {
                healthText = '<i class="fas fa-check-circle"></i> Healthy';
                healthClass = 'success';
                healthColor = 'var(--success-color)';
            } 
            // Voltaggio basso
            else if (voltage > 11.5) {
                healthText = '<i class="fas fa-exclamation-circle"></i> Low';
                healthClass = 'warning';
                healthColor = 'var(--warning-color)';
            } 
            // Critico
            else {
                healthText = '<i class="fas fa-times-circle"></i> Critical';
                healthClass = 'danger';
                healthColor = 'var(--danger-color)';
            }
            
            gaugeElements.batteryHealth.innerHTML = healthText;
            gaugeElements.batteryHealth.style.background = `rgba(${this.hexToRgb(healthColor)}, 0.2)`;
            gaugeElements.batteryHealth.style.color = healthColor;
            gaugeElements.batteryHealth.style.borderColor = `rgba(${this.hexToRgb(healthColor)}, 0.3)`;
        },
        
        updateTempGauge(temp) {
            const normalizedTemp = Math.max(50, Math.min(temp, 130));
            const percentage = ((normalizedTemp - 50) / 80) * 100;
            
            gaugeElements.tempIndicator.style.left = `${percentage}%`;
            
            // Format temperature display in script.j
            
            // Visual effects based on temperature
            if (temp > 110) {
                gaugeElements.tempIndicator.classList.add('temp-high');
                gaugeElements.tempIndicator.style.background = 'var(--danger-color)';
            } else if (temp > 100) {
                gaugeElements.tempIndicator.classList.remove('temp-high');
                gaugeElements.tempIndicator.style.background = 'var(--warning-color)';
            } else {
                gaugeElements.tempIndicator.classList.remove('temp-high');
                gaugeElements.tempIndicator.style.background = 'white';
            }
            
            // Update temperature difference
            if (gaugeElements.tempDiff && gaugeElements.ambientTemp) {
                const ambient = parseInt(gaugeElements.ambientTemp.textContent) || 25;
                const diff = temp - ambient;
                gaugeElements.tempDiff.textContent = diff.toFixed(1);
            }
        },
    
        
        // ===========================
        // PARAMETER UPDATES
        // ===========================
        updateParameterBars() {
            // Update load bar
            if (gaugeElements.paramLoad && gaugeElements.loadBar) {
                const loadValue = parseFloat(gaugeElements.paramLoad.textContent) || currentValues.load;
                gaugeElements.loadBar.style.width = `${Math.min(loadValue, 100)}%`;
            }
            
            // Update throttle bar
            if (gaugeElements.paramThrottle && gaugeElements.throttleBar) {
                const throttleValue = parseFloat(gaugeElements.paramThrottle.textContent) || currentValues.throttle;
                gaugeElements.throttleBar.style.width = `${Math.min(throttleValue, 100)}%`;
            }
            
            // Update intake pressure bar
            if (gaugeElements.paramPressIntake && gaugeElements.pressIntakeBar) {
                const pressValue = parseFloat(gaugeElements.paramPressIntake.textContent) || currentValues.pressIntake;
                const percentage = Math.min((pressValue / 150) * 100, 100);
                gaugeElements.pressIntakeBar.style.width = `${percentage}%`;
            }
        },
        
        updateFuelSystem() {
            if (gaugeElements.paramFuelLvl && gaugeElements.fuelLevelFill) {
                const fuelValue = parseFloat(gaugeElements.paramFuelLvl.textContent) || currentValues.fuelLevel;
                gaugeElements.fuelLevelFill.style.width = `${Math.min(fuelValue, 100)}%`;
                
            }
        },
        
        // ===========================
        // SYSTEM STATUS UPDATES
        // ===========================
        updateSystemStatus() {
            // Update uptime
            const elapsed = Date.now() - systemState.startTime;
            const hours = Math.floor(elapsed / 3600000);
            const minutes = Math.floor((elapsed % 3600000) / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            const uptimeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            if (gaugeElements.uptime) gaugeElements.uptime.textContent = uptimeString;
            if (gaugeElements.uptimeDisplay) gaugeElements.uptimeDisplay.textContent = uptimeString;
            
            // Update data count
            if (gaugeElements.dataCount) {
                systemState.dataCount++;
                gaugeElements.dataCount.textContent = systemState.dataCount;
            }
            
            if (gaugeElements.totalData) {
                gaugeElements.totalData.textContent = systemState.dataCount;
            }
            
            if (gaugeElements.dataPoints) {
                gaugeElements.dataPoints.textContent = systemState.dataCount;
            }
            
            // Update buffer usage
            const bufferPercent = Math.round((systemState.dataCount % 1000) / 10);
            if (gaugeElements.bufferUsage) gaugeElements.bufferUsage.textContent = `${bufferPercent}%`;
            if (gaugeElements.bufferUsageDisplay) gaugeElements.bufferUsageDisplay.textContent = `${bufferPercent}%`;
            
            // Update performance score
            if (gaugeElements.performanceScore) {
                gaugeElements.performanceScore.textContent = `${systemState.systemPerformance}%`;
            }
            
            // Update storage free
            if (gaugeElements.storageFree) {
                const freePercent = Math.max(0, 100 - Math.floor(systemState.dataCount / 10000));
                gaugeElements.storageFree.textContent = `${freePercent}%`;
            }
            
            // Update log count
            if (gaugeElements.logCount) {
                const logCount = Math.floor(systemState.dataCount / 1000);
                gaugeElements.logCount.textContent = logCount;
            }
        },
        
        updateConnectionQuality() {
            // Simulate connection quality changes
            const qualityChange = Math.random() * 10 - 5;
            systemState.connectionQuality = Math.max(0, Math.min(100, systemState.connectionQuality + qualityChange));
            
            // Update signal strength display
            let signalText, signalClass;
            
            if (systemState.connectionQuality > 90) {
                signalText = 'Excellent';
                signalClass = 'success';
            } else if (systemState.connectionQuality > 70) {
                signalText = 'Good';
                signalClass = 'info';
            } else if (systemState.connectionQuality > 50) {
                signalText = 'Fair';
                signalClass = 'warning';
            } else {
                signalText = 'Poor';
                signalClass = 'danger';
            }
            
            if (gaugeElements.signalStrength) gaugeElements.signalStrength.textContent = signalText;
            if (gaugeElements.signalStrengthDisplay) gaugeElements.signalStrengthDisplay.textContent = signalText;
            
            // Update ping time
            const basePing = 10;
            const pingJitter = Math.random() * 20;
            const pingTime = Math.round(basePing + pingJitter);
            
            if (gaugeElements.pingTime) gaugeElements.pingTime.textContent = `${pingTime}ms`;
            if (gaugeElements.pingTimeDisplay) gaugeElements.pingTimeDisplay.textContent = `${pingTime}ms`;
            if (gaugeElements.latencyValue) gaugeElements.latencyValue.textContent = `${pingTime}ms`;
            
            // Update connection status
            if (systemState.connectionQuality < 30 && systemState.connected) {
                this.setConnectionStatus(false);
            } else if (systemState.connectionQuality >= 30 && !systemState.connected) {
                this.setConnectionStatus(true);
            }
        },
        
        updateDataRate() {
            // Calculate data rate (points per second)
            const now = Date.now();
            const timeDiff = (now - systemState.lastUpdate) / 1000;
            
            if (timeDiff > 1) {
                const pointsInLastSecond = systemState.dataPoints.filter(p => p.time > now - 1000).length;
                systemState.dataRate = pointsInLastSecond;
                systemState.lastUpdate = now;
                
                if (gaugeElements.dataRate) gaugeElements.dataRate.textContent = systemState.dataRate;
                if (gaugeElements.dataRateDisplay) gaugeElements.dataRateDisplay.textContent = systemState.dataRate;
            }
        },
        
        setConnectionStatus(connected) {
            systemState.connected = connected;
            
            if (gaugeElements.connectionStatus) {
                gaugeElements.connectionStatus.className = `status-indicator ${connected ? 'connected' : 'disconnected'}`;
                
                if (!connected) {
                    gaugeElements.connectionStatus.style.background = 'var(--danger-color)';
                    gaugeElements.connectionStatus.style.boxShadow = '0 0 15px var(--danger-glow)';
                }
            }
            
            if (gaugeElements.connectionText) {
                gaugeElements.connectionText.textContent = connected ? 'Connected to vehicle' : 'Connection lost';
                gaugeElements.connectionText.style.color = connected ? 'var(--light-text)' : 'var(--danger-color)';
            }
        },
        
        updatePerformanceMetrics() {
            // Update system performance based on various factors
            const connectionFactor = systemState.connectionQuality / 100;
            const dataRateFactor = Math.min(systemState.dataRate / 20, 1);
            const smoothnessFactor = this.performance.smoothness / 100;
            
            systemState.systemPerformance = Math.round(
                (connectionFactor * 0.4 + dataRateFactor * 0.3 + smoothnessFactor * 0.3) * 100
            );
        },
        
        // ===========================
        // UTILITY FUNCTIONS
        // ===========================
        recordDataPoint(type, value) {
            const timestamp = Date.now();
            systemState.dataPoints.push({ type, value, time: timestamp });
            
            // Keep only recent data points
            if (systemState.dataPoints.length > systemState.maxDataPoints) {
                systemState.dataPoints = systemState.dataPoints.slice(-systemState.maxDataPoints);
            }
        },
        
        hexToRgb(hex) {
            // Convert hex color to RGB string
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? 
                `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : 
                '37, 99, 235';
        },
        
        setupObservers() {
            // Observe DOM changes for critical values
            const config = { childList: true, characterData: true, subtree: true };
            
            const rpmObserver = new MutationObserver(() => {
                const rpm = parseInt(gaugeElements.rpmValue.textContent) || currentValues.rpm;
                if (Math.abs(rpm - currentValues.rpm) > 200) {
                    currentValues.rpm = rpm;
                }
            });
            
            const speedObserver = new MutationObserver(() => {
                const speed = parseInt(gaugeElements.speedValue.textContent) || currentValues.speed;
                if (Math.abs(speed - currentValues.speed) > 20) {
                    currentValues.speed = speed;
                }
            });
            
            if (gaugeElements.rpmValue) rpmObserver.observe(gaugeElements.rpmValue, config);
            if (gaugeElements.speedValue) speedObserver.observe(gaugeElements.speedValue, config);
        },
        
        setupPerformanceMonitoring() {
            // Log performance periodically
            setInterval(() => {
                if (this.performance.fps < 50) {
                    console.warn(`⚠️ Performance warning: FPS dropped to ${this.performance.fps}`);
                }
            }, 5000);
        },
        
        // Cleanup function
        cleanup() {
            if (this.animationFrame) {
                cancelAnimationFrame(this.animationFrame);
            }
        }
    };
    
    // ===========================
    // INITIALIZATION
    // ===========================
    AnimationEngine.init();
    
    // ===========================
    // EVENT LISTENERS
    // ===========================
    window.addEventListener('beforeunload', () => {
        AnimationEngine.cleanup();
    });
    
    // Export debug info
    window.OBDAnimations = AnimationEngine;
    
    console.log('🎯 OBD-II Professional Monitoring System v3.0 Fully Initialized');
    console.log('📊 Real-time animations running at 50ms resolution');
    console.log('⚡ Performance optimized for 60 FPS');
});

