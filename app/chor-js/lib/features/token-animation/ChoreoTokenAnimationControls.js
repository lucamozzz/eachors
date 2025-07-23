/**
 * Controlli UI per l'animazione dei token nelle coreografie
 */
export default function ChoreoTokenAnimationControls(
  choreoTokenAnimation,
  eventBus
) {
  this._animation = choreoTokenAnimation;
  this._eventBus = eventBus;
  this._controlsContainer = null;

  this._createControls();
}

ChoreoTokenAnimationControls.prototype._createControls = function () {
  // Crea il container per i controlli
  this._controlsContainer = document.createElement("div");
  this._controlsContainer.className = "choreo-animation-controls";
  this._controlsContainer.innerHTML = `
    <div class="choreo-controls-panel">
      <h3>Animazione Token</h3>
      <div class="choreo-controls-buttons">
        <button id="choreo-play-btn" class="choreo-btn choreo-btn-primary">
          <span class="choreo-icon">▶</span> Play
        </button>
        <button id="choreo-pause-btn" class="choreo-btn" disabled>
          <span class="choreo-icon">⏸</span> Pause
        </button>
        <button id="choreo-reset-btn" class="choreo-btn">
          <span class="choreo-icon">⏹</span> Reset
        </button>
        <button id="choreo-step-btn" class="choreo-btn">
          <span class="choreo-icon">⏭</span> Step
        </button>
      </div>
      <div class="choreo-controls-speed">
        <label for="choreo-speed-slider">Velocità:</label>
        <input type="range" id="choreo-speed-slider" min="0.5" max="3" step="0.1" value="1">
        <span id="choreo-speed-value">1.0x</span>
      </div>
      <div class="choreo-controls-info">
        <div class="choreo-status">
          <span>Stato: </span>
          <span id="choreo-status-text">Pronto</span>
        </div>
        <div class="choreo-progress">
          <span>Progresso: </span>
          <span id="choreo-progress-text">0/0</span>
        </div>
      </div>
    </div>
  `;

  // Aggiungi gli stili CSS
  this._addStyles();

  // Aggiungi i listener degli eventi
  this._attachEventListeners();

  // Aggiungi i controlli al DOM
  document.body.appendChild(this._controlsContainer);
};

ChoreoTokenAnimationControls.prototype._addStyles = function () {
  const style = document.createElement("style");
  style.textContent = `
    .choreo-animation-controls {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-family: Arial, sans-serif;
    }
    
    .choreo-controls-panel {
      padding: 16px;
      min-width: 280px;
    }
    
    .choreo-controls-panel h3 {
      margin: 0 0 12px 0;
      color: #333;
      font-size: 16px;
      font-weight: bold;
    }
    
    .choreo-controls-buttons {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    
    .choreo-btn {
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: white;
      cursor: pointer;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: all 0.2s;
    }
    
    .choreo-btn:hover:not(:disabled) {
      background: #f5f5f5;
      border-color: #999;
    }
    
    .choreo-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .choreo-btn-primary {
      background: #4CAF50;
      color: white;
      border-color: #4CAF50;
    }
    
    .choreo-btn-primary:hover:not(:disabled) {
      background: #45a049;
    }
    
    .choreo-icon {
      font-size: 10px;
    }
    
    .choreo-controls-speed {
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .choreo-controls-speed label {
      font-size: 12px;
      color: #666;
      min-width: 50px;
    }
    
    #choreo-speed-slider {
      flex: 1;
    }
    
    #choreo-speed-value {
      font-size: 12px;
      color: #333;
      min-width: 35px;
      text-align: right;
    }
    
    .choreo-controls-info {
      font-size: 12px;
      color: #666;
    }
    
    .choreo-controls-info > div {
      margin-bottom: 4px;
    }
    
    .choreo-controls-info span:first-child {
      font-weight: bold;
    }
    
    /* Stili per l'animazione */
    .choreo-token-active {
      filter: drop-shadow(0 0 8px #4CAF50);
      animation: choreo-pulse 1s ease-in-out;
    }
    
    .choreo-participant-initiating {
      filter: drop-shadow(0 0 6px #FF9800);
    }
    
    .choreo-participant-active {
      filter: drop-shadow(0 0 6px #2196F3);
    }
    
    @keyframes choreo-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    
    .choreo-token {
      filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.3));
    }
    
    .choreo-message-token {
      filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.3));
    }
  `;

  document.head.appendChild(style);
};

ChoreoTokenAnimationControls.prototype._attachEventListeners = function () {
  const playBtn = document.getElementById("choreo-play-btn");
  const pauseBtn = document.getElementById("choreo-pause-btn");
  const resetBtn = document.getElementById("choreo-reset-btn");
  const stepBtn = document.getElementById("choreo-step-btn");
  const speedSlider = document.getElementById("choreo-speed-slider");
  const speedValue = document.getElementById("choreo-speed-value");

  playBtn.addEventListener("click", () => {
    this._animation.start();
    this._updateButtonStates("playing");
    this._updateStatus("In esecuzione");
  });

  pauseBtn.addEventListener("click", () => {
    this._animation.pause();
    this._updateButtonStates("paused");
    this._updateStatus("In pausa");
  });

  resetBtn.addEventListener("click", () => {
    this._animation.reset();
    this._updateButtonStates("stopped");
    this._updateStatus("Pronto");
    this._updateProgress(0, this._animation._steps.length);
  });

  stepBtn.addEventListener("click", () => {
    this._animation.step();
    this._updateProgress(
      this._animation._currentStep,
      this._animation._steps.length
    );
    if (this._animation._currentStep >= this._animation._steps.length) {
      this._updateButtonStates("completed");
      this._updateStatus("Completato");
    }
  });

  speedSlider.addEventListener("input", (e) => {
    const speed = parseFloat(e.target.value);
    this._animation.setSpeed(speed);
    speedValue.textContent = speed.toFixed(1) + "x";
  });
};

ChoreoTokenAnimationControls.prototype._updateButtonStates = function (state) {
  const playBtn = document.getElementById("choreo-play-btn");
  const pauseBtn = document.getElementById("choreo-pause-btn");
  const resetBtn = document.getElementById("choreo-reset-btn");
  const stepBtn = document.getElementById("choreo-step-btn");

  // Reset all states
  playBtn.disabled = false;
  pauseBtn.disabled = true;
  resetBtn.disabled = false;
  stepBtn.disabled = false;

  playBtn.classList.remove("choreo-btn-primary");
  pauseBtn.classList.remove("choreo-btn-primary");

  switch (state) {
    case "playing":
      playBtn.disabled = true;
      pauseBtn.disabled = false;
      pauseBtn.classList.add("choreo-btn-primary");
      stepBtn.disabled = true;
      break;
    case "paused":
      playBtn.classList.add("choreo-btn-primary");
      pauseBtn.disabled = true;
      break;
    case "stopped":
      playBtn.classList.add("choreo-btn-primary");
      break;
    case "completed":
      playBtn.disabled = true;
      stepBtn.disabled = true;
      break;
  }
};

ChoreoTokenAnimationControls.prototype._updateStatus = function (status) {
  const statusText = document.getElementById("choreo-status-text");
  if (statusText) {
    statusText.textContent = status;
  }
};

ChoreoTokenAnimationControls.prototype._updateProgress = function (
  current,
  total
) {
  const progressText = document.getElementById("choreo-progress-text");
  if (progressText) {
    progressText.textContent = `${current}/${total}`;
  }
};

ChoreoTokenAnimationControls.prototype.destroy = function () {
  if (this._controlsContainer && this._controlsContainer.parentNode) {
    this._controlsContainer.parentNode.removeChild(this._controlsContainer);
  }
};

ChoreoTokenAnimationControls.$inject = ["choreoTokenAnimation", "eventBus"];
