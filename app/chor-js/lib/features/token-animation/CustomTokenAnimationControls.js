export default function CustomTokenAnimationControls(tokenAnimation, eventBus) {
  this._tokenAnimation = tokenAnimation;
  this._eventBus = eventBus;
  this._controlsContainer = null;
  this._speedSlider = null;

  this._createControls();
  this._bindEvents();
}

CustomTokenAnimationControls.prototype._createControls = function () {
  // Contenitore dei controlli
  this._controlsContainer = document.createElement("div");
  this._controlsContainer.className = "form-bottom-left"; // stesso stile del form Sequence Flow
  this._controlsContainer.style.cssText = `
    bottom: 160px;   /* più in alto rispetto al form Sequence Flow */
    left: 20px;
    position: absolute;
    z-index: 100;
    font-family: Arial, sans-serif;
    font-size: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  `;

  // Titolo semplice (senza riquadro attorno)
  const title = document.createElement("label");
  title.textContent = "Animazione Token:";
  title.style.cssText = "font-weight: bold; color: #333; margin-bottom: 4px;";
  this._controlsContainer.appendChild(title);

  // Container pulsanti
  const buttonsContainer = document.createElement("div");
  buttonsContainer.style.cssText = "display: flex; gap: 6px;";

  // Pulsante Play
  this._playButton = document.createElement("button");
  this._playButton.textContent = "▶ Play";
  buttonsContainer.appendChild(this._playButton);

  // Pulsante Stop
  this._stopButton = document.createElement("button");
  this._stopButton.textContent = "⏸ Stop";
  buttonsContainer.appendChild(this._stopButton);

  // Pulsante Reset
  this._resetButton = document.createElement("button");
  this._resetButton.textContent = "⟲ Reset";
  buttonsContainer.appendChild(this._resetButton);

  this._controlsContainer.appendChild(buttonsContainer);

  // Slider velocità
  const speedContainer = document.createElement("div");
  speedContainer.style.cssText = "display: flex; align-items: center; gap: 5px;";

  const speedLabel = document.createElement("label");
  speedLabel.textContent = "Velocità:";
  speedContainer.appendChild(speedLabel);

  this._speedSlider = document.createElement("input");
  this._speedSlider.type = "range";
  this._speedSlider.min = "0.5";
  this._speedSlider.max = "3";
  this._speedSlider.step = "0.1";
  this._speedSlider.value = "1";
  speedContainer.appendChild(this._speedSlider);

  this._speedValue = document.createElement("span");
  this._speedValue.textContent = "1.0x";
  speedContainer.appendChild(this._speedValue);

  this._controlsContainer.appendChild(speedContainer);

  // Inserisci nel canvas
  const canvasContainer = document.getElementById("canvas");
  if (canvasContainer) {
    canvasContainer.appendChild(this._controlsContainer);
  } else {
    document.body.appendChild(this._controlsContainer);
  }
};


CustomTokenAnimationControls.prototype._bindEvents = function () {
  // Play button
  this._playButton.addEventListener("click", () => {
    this._tokenAnimation.start();
    this._updateButtonStates(true);
  });

  // Stop button
  this._stopButton.addEventListener("click", () => {
    this._tokenAnimation.pause();
    this._updateButtonStates(false);
  });

  // Reset button
  this._resetButton.addEventListener("click", () => {
    this._tokenAnimation.reset();
    this._updateButtonStates(false);
  });

  // Speed slider
  this._speedSlider.addEventListener("input", (e) => {
    const speed = parseFloat(e.target.value);
    this._tokenAnimation.setSpeed(speed);
    this._speedValue.textContent = speed.toFixed(1) + "x";
  });

  // Clean up on diagram destroy
  this._eventBus.on("diagram.destroy", () => {
    this.destroy();
  });
};

CustomTokenAnimationControls.prototype._updateButtonStates = function (isPlaying) {
  if (isPlaying) {
    this._playButton.style.background = "#666";
    this._playButton.disabled = true;
    this._stopButton.style.background = "#f44336";
    this._stopButton.disabled = false;
  } else {
    this._playButton.style.background = "#4CAF50";
    this._playButton.disabled = false;
    this._stopButton.style.background = "#666";
    this._stopButton.disabled = true;
  }
};

CustomTokenAnimationControls.prototype.destroy = function () {
  if (this._controlsContainer && this._controlsContainer.parentNode) {
    this._controlsContainer.parentNode.removeChild(this._controlsContainer);
  }
  this._controlsContainer = null;
  this._speedSlider = null;
  this._playButton = null;
  this._stopButton = null;
  this._resetButton = null;
  this._speedValue = null;
};
