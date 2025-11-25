/**
 * Versione semplificata dell'animazione dei token per debug
 */
export default function SimpleTokenAnimation(canvas, eventBus) {
  this._canvas = canvas;
  this._eventBus = eventBus;

  console.log("SimpleTokenAnimation initialized");

  // Crea immediatamente i controlli UI
  this._createControls();
}

SimpleTokenAnimation.prototype._createControls = function () {
  console.log("Creating animation controls...");

  // Crea il container per i controlli
  const controlsContainer = document.createElement("div");
  controlsContainer.className = "simple-animation-controls";
  controlsContainer.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
      background: white;
      border: 2px solid #4CAF50;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-family: Arial, sans-serif;
      min-width: 250px;
    ">
      <h3 style="margin: 0 0 12px 0; color: #333;">🎬 Animazione Token</h3>
      <div style="display: flex; gap: 8px; margin-bottom: 12px;">
        <button id="simple-play-btn" style="
          padding: 8px 16px;
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        ">▶ Play</button>
        <button id="simple-demo-btn" style="
          padding: 8px 16px;
          background: #2196F3;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        ">🎯 Demo</button>
      </div>
      <div style="font-size: 12px; color: #666;">
        <div>Stato: <span id="simple-status">Pronto</span></div>
        <div>Modulo caricato correttamente!</div>
      </div>
    </div>
  `;

  document.body.appendChild(controlsContainer);

  // Aggiungi i listener
  document.getElementById("simple-play-btn").addEventListener("click", () => {
    this.startDemo();
  });

  document.getElementById("simple-demo-btn").addEventListener("click", () => {
    this.createDemoToken();
  });

  console.log("Animation controls created successfully");
};

SimpleTokenAnimation.prototype.startDemo = function () {
  console.log("Starting demo animation...");
  document.getElementById("simple-status").textContent = "Demo in corso";

  // Crea un token di esempio
  this.createDemoToken();

  setTimeout(() => {
    document.getElementById("simple-status").textContent = "Demo completato";
  }, 3000);
};

SimpleTokenAnimation.prototype.createDemoToken = function () {
  console.log("Creating demo token...");

  const canvas = this._canvas;
  const viewport = canvas._svg.querySelector(".viewport");

  if (!viewport) {
    console.error("Viewport not found");
    return;
  }

  // Crea un token di esempio
  const tokenGroup = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "g"
  );
  tokenGroup.setAttribute("class", "demo-token");

  const circle = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle"
  );
  circle.setAttribute("r", "15");
  circle.setAttribute("cx", "15");
  circle.setAttribute("cy", "15");
  circle.setAttribute("fill", "#4CAF50");
  circle.setAttribute("stroke", "#333");
  circle.setAttribute("stroke-width", "2");

  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", "15");
  text.setAttribute("y", "20");
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("fill", "white");
  text.setAttribute("font-size", "12");
  text.setAttribute("font-weight", "bold");
  text.textContent = "1";

  tokenGroup.appendChild(circle);
  tokenGroup.appendChild(text);

  // Posiziona il token
  tokenGroup.setAttribute("transform", "translate(200, 200)");

  viewport.appendChild(tokenGroup);

  // Anima il token
  this.animateToken(tokenGroup);
};

SimpleTokenAnimation.prototype.animateToken = function (tokenElement) {
  let x = 200;
  let y = 200;
  const targetX = 400;
  const targetY = 300;
  const duration = 2000; // 2 secondi
  const startTime = Date.now();

  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Interpolazione lineare
    const currentX = x + (targetX - x) * progress;
    const currentY = y + (targetY - y) * progress;

    tokenElement.setAttribute(
      "transform",
      `translate(${currentX}, ${currentY})`
    );

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // Rimuovi il token dopo l'animazione
      setTimeout(() => {
        if (tokenElement.parentNode) {
          tokenElement.parentNode.removeChild(tokenElement);
        }
      }, 1000);
    }
  };

  animate();
};

SimpleTokenAnimation.$inject = ["canvas", "eventBus"];
