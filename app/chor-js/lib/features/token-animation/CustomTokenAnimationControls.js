export default function CustomTokenAnimationControls(tokenAnimation, eventBus) {
  this._tokenAnimation = tokenAnimation;
  this._eventBus = eventBus;
  this._controlsContainer = null;
  this._speedSlider = null;

  this._createControls();
  this._bindEvents();
}

CustomTokenAnimationControls.prototype._createControls = function () {
  // Create the controls container
  this._controlsContainer = document.createElement("div");
  this._controlsContainer.className = "token-animation-controls";
  this._controlsContainer.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: white;
    border: 1px solid #ccc;
    border-radius: 5px;
    padding: 10px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    z-index: 1000;
    font-family: Arial, sans-serif;
    font-size: 12px;
  `;

  // Create title
  const title = document.createElement("h4");
  title.textContent = "Animazione Token";
  title.style.cssText = "margin: 0 0 10px 0; color: #333;";
  this._controlsContainer.appendChild(title);

  // Create buttons container
  const buttonsContainer = document.createElement("div");
  buttonsContainer.style.cssText = "margin-bottom: 10px;";

  // Create Play button
  this._playButton = document.createElement("button");
  this._playButton.textContent = "▶ Play";
  this._playButton.style.cssText = `
    background: #4CAF50;
    color: white;
    border: none;
    padding: 5px 10px;
    margin-right: 5px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 11px;
  `;
  buttonsContainer.appendChild(this._playButton);

  // Create Stop button
  this._stopButton = document.createElement("button");
  this._stopButton.textContent = "⏸ Stop";
  this._stopButton.style.cssText = `
    background: #f44336;
    color: white;
    border: none;
    padding: 5px 10px;
    margin-right: 5px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 11px;
  `;
  buttonsContainer.appendChild(this._stopButton);

  // Create Reset button
  this._resetButton = document.createElement("button");
  this._resetButton.textContent = "⟲ Reset";
  this._resetButton.style.cssText = `
    background: #2196F3;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 11px;
  `;
  buttonsContainer.appendChild(this._resetButton);

  this._controlsContainer.appendChild(buttonsContainer);

  // Create speed control
  const speedContainer = document.createElement("div");
  speedContainer.style.cssText = "display: flex; align-items: center; gap: 5px;";

  const speedLabel = document.createElement("label");
  speedLabel.textContent = "Velocità:";
  speedLabel.style.cssText = "font-size: 11px; color: #666;";
  speedContainer.appendChild(speedLabel);

  this._speedSlider = document.createElement("input");
  this._speedSlider.type = "range";
  this._speedSlider.min = "0.5";
  this._speedSlider.max = "3";
  this._speedSlider.step = "0.1";
  this._speedSlider.value = "1";
  this._speedSlider.style.cssText = "flex: 1; margin: 0 5px;";
  speedContainer.appendChild(this._speedSlider);

  this._speedValue = document.createElement("span");
  this._speedValue.textContent = "1.0x";
  this._speedValue.style.cssText = "font-size: 11px; color: #666; min-width: 30px;";
  speedContainer.appendChild(this._speedValue);

  this._controlsContainer.appendChild(speedContainer);

  // Add to document
  document.body.appendChild(this._controlsContainer);
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
