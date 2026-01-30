import { query as domQuery } from "min-dom";
import {
  appendTo as svgAppendTo,
  create as svgCreate,
  attr as svgAttr,
  remove as svgRemove,
} from "tiny-svg";
import { is } from "bpmn-js/lib/util/ModelUtil";
import './CustomTokenAnimation.css';

const TOKEN_SIZE = 20;
const ANIMATION_DURATION_BASE = 2000;

export default function CustomTokenAnimation(
  canvas,
  eventBus,
  elementRegistry
) {
  this._canvas = canvas;
  this._eventBus = eventBus;
  this._elementRegistry = elementRegistry;

  this._isPlaying = false;
  this._speed = 1;

  this._tokenAnimations = new Map();
  this._gatewayJoinState = new Map();
  this._tokenStates = new Map();

  // 🔑 NUOVO: gestione unificata popup coda
  this._popupQueue = []; // Array di { type, token, data }
  this._isProcessingPopup = false;

  this._bindEvents();
}

CustomTokenAnimation.prototype._bindEvents = function () {
  this._eventBus.on("diagram.destroy", this.reset.bind(this));
};

/* -------------------------
   CONTROLLO VELOCITÀ
   ------------------------- */

CustomTokenAnimation.prototype.setSpeed = function (speed) {
  if (speed <= 0) {
    console.warn("Speed deve essere maggiore di 0");
    return;
  }
  this._speed = speed;
  console.log("Velocità impostata a:", speed);
};

CustomTokenAnimation.prototype.getSpeed = function () {
  return this._speed;
};

/* -------------------------
   START / PAUSE / RESET
   ------------------------- */

CustomTokenAnimation.prototype.start = function () {
  if (this._isPlaying) return;
  this._isPlaying = true;

  if (this._tokenStates && this._tokenStates.size > 0) {
    const validStates = [];

    for (const [token, state] of this._tokenStates.entries()) {
      if (token && token.parentNode && state && state.sequenceFlow && state.sequenceFlow.waypoints) {
        validStates.push([token, state]);
      } else {
        this._tokenStates.delete(token);
      }
    }

    if (validStates.length > 0) {
      validStates.forEach(([token, state]) => {
        const totalSegments = state.sequenceFlow.waypoints.length - 1;
        const startRatio = totalSegments > 0 ? ((state.segmentIndex + state.ratio) / totalSegments) : 0;
        this._animateTokenAlongFlow(state.sequenceFlow, 0, token, startRatio);
      });
      return;
    }
  }

  const startEventShape = this._elementRegistry.getAll().find(element => is(element, "bpmn:StartEvent"));
  if (!startEventShape || !startEventShape.outgoing || startEventShape.outgoing.length === 0) {
    console.warn("No start event or outgoing sequence flow found to start animation.");
    this._isPlaying = false;
    return;
  }

  const firstFlow = startEventShape.outgoing[0];
  const token = this._createTokenGfx();
  this._animateTokenAlongFlow(firstFlow, 0, token);
};

CustomTokenAnimation.prototype.pause = function () {
  this._isPlaying = false;
  for (const frameId of this._tokenAnimations.values()) {
    cancelAnimationFrame(frameId);
  }
  this._tokenAnimations.clear();
};

CustomTokenAnimation.prototype.reset = function () {
  this.pause();

  const group = this._getAnimationLayer();
  if (group) {
    while (group.firstChild) {
      svgRemove(group.firstChild);
    }
  }

  this._tokenAnimations.clear();
  if (this._tokenStates) this._tokenStates.clear();
  this._gatewayJoinState.clear();

  // 🔑 NUOVO: pulisci coda popup
  this._popupQueue = [];
  this._isProcessingPopup = false;

  const allElements = this._elementRegistry.getAll();
  allElements.forEach(element => {
    this._canvas.removeMarker(element.id, 'highlight-yellow');
    this._canvas.removeMarker(element.id, 'highlight-green');
    this._canvas.removeMarker(element.id, 'highlight-red');
  });

  if (this._activePopup) {
    try { document.body.removeChild(this._activePopup); } catch (e) { }
    this._activePopup = null;
  }

  this._isPlaying = false;
};

/* -------------------------
   UTILITIES
   ------------------------- */

CustomTokenAnimation.prototype._createTokenGfx = function () {
  const group = this._getAnimationLayer();
  const tokenSvg = `<circle r="${TOKEN_SIZE / 2}" fill="#FF0000" stroke="#000000" stroke-width="2" />`;
  return svgAppendTo(svgCreate(tokenSvg), group);
};

CustomTokenAnimation.prototype._getAnimationLayer = function () {
  const canvas = this._canvas;
  const viewport = domQuery(".viewport", canvas._svg);

  let group = domQuery(".custom-animation-tokens", viewport);

  if (!group) {
    group = svgCreate("<g class=\"custom-animation-tokens\" />");
    svgAppendTo(group, viewport);
  }

  return group;
};

CustomTokenAnimation.prototype._removeToken = function (token) {
  if (!token) return;
  const frameId = this._tokenAnimations.get(token);
  if (frameId) {
    cancelAnimationFrame(frameId);
  }
  this._tokenAnimations.delete(token);
  this._tokenStates.delete(token);

  // 🔑 NUOVO: rimuovi token anche dalla coda popup
  this._popupQueue = this._popupQueue.filter(item => item.token !== token);

  try {
    svgRemove(token);
  } catch (e) {
    // ignore se già rimosso
  }
};

/* -------------------------
   ANIMAZIONE TOKEN
   ------------------------- */
CustomTokenAnimation.prototype._animateTokenAlongFlow = function (
  sequenceFlow,
  startWaypointIndex = 0,
  token = null,
  startRatio = 0
) {
  if (!this._isPlaying) {
    return;
  }

  if (!sequenceFlow || !sequenceFlow.waypoints || sequenceFlow.waypoints.length < 2) {
    if (token) this._removeToken(token);
    return;
  }

  const waypoints = sequenceFlow.waypoints;

  if (!token) {
    token = this._createTokenGfx();
  }

  const duration = ANIMATION_DURATION_BASE / this._speed;
  let startTime = null;

  const animate = (currentTime) => {
    if (!this._isPlaying) return;

    if (!startTime) startTime = currentTime;
    const elapsed = (currentTime - startTime) / duration;
    const progress = startRatio + elapsed;

    if (progress < 1) {
      const totalSegments = waypoints.length - 1;
      const segmentProgress = progress * totalSegments;
      const currentSegment = Math.floor(segmentProgress);
      const segmentRatio = segmentProgress - currentSegment;

      const startPoint = waypoints[currentSegment];
      const endPoint = waypoints[currentSegment + 1];

      const x = startPoint.x + (endPoint.x - startPoint.x) * segmentRatio;
      const y = startPoint.y + (endPoint.y - startPoint.y) * segmentRatio;

      svgAttr(
        token,
        "transform",
        `translate(${x}, ${y})`
      );


      this._tokenStates.set(token, {
        sequenceFlow,
        segmentIndex: currentSegment,
        ratio: segmentRatio,
        targetElement: sequenceFlow.target
      });

      const frameId = requestAnimationFrame(animate);
      this._tokenAnimations.set(token, frameId);
    } else {
      this._tokenAnimations.delete(token);
      this._tokenStates.delete(token);
      this._handleNextElement(sequenceFlow.target, token);
    }
  };

  const initialFrameId = requestAnimationFrame(animate);
  this._tokenAnimations.set(token, initialFrameId);
};

/* -------------------------
   GESTIONE ELEMENTI
   ------------------------- */

CustomTokenAnimation.prototype._handleNextElement = function (nextElement, token) {
  if (!token) return;

  if (!nextElement) {
    this._removeToken(token);
    return;
  }

  if (is(nextElement, "bpmn:EndEvent")) {
    this._removeToken(token);
    return;
  }

  if (is(nextElement, "bpmn:ParallelGateway")) {
    const incomingCount = nextElement.incoming ? nextElement.incoming.length : 0;
    const outgoingCount = nextElement.outgoing ? nextElement.outgoing.length : 0;

    if (incomingCount > 1 && outgoingCount >= 1) {
      const current = this._gatewayJoinState.get(nextElement.id) || 0;
      const newCount = current + 1;
      this._gatewayJoinState.set(nextElement.id, newCount);

      this._removeToken(token);

      if (newCount === incomingCount) {
        this._gatewayJoinState.set(nextElement.id, 0);
        const outFlow = nextElement.outgoing[0];
        if (outFlow) {
          const newToken = this._createTokenGfx();
          this._animateTokenAlongFlow(outFlow, 0, newToken);
        }
      }
      return;
    }

    if (outgoingCount > 1) {
      nextElement.outgoing.forEach((outFlow, idx) => {
        if (idx === 0) {
          this._animateTokenAlongFlow(outFlow, 0, token);
        } else {
          const newToken = this._createTokenGfx();
          this._animateTokenAlongFlow(outFlow, 0, newToken);
        }
      });
      return;
    }
  }
  // === MENU MANUALE SU EVENT-BASED-GATEWAY ===
  if (is(nextElement, "bpmn:EventBasedGateway")) {
    if (nextElement.outgoing && nextElement.outgoing.length > 0) {
      this._showEventBasedGatewayPopup(nextElement, token);
    } else {
      this._removeToken(token);
    }
    return;
  }


  if (is(nextElement, "bpmn:ExclusiveGateway")) {
    if (nextElement.outgoing && nextElement.outgoing.length > 0) {
      const randomIndex = Math.floor(Math.random() * nextElement.outgoing.length);
      const chosenFlow = nextElement.outgoing[randomIndex];
      this._animateTokenAlongFlow(chosenFlow, 0, token);
    } else {
      this._removeToken(token);
    }
    return;
  }

  if (this._isChoreographyWithVisibleMessages(nextElement)) {
    this._handleChoreographyTask(nextElement, token);
    return;
  }

  if (nextElement.outgoing && nextElement.outgoing.length > 0) {
    if (nextElement.outgoing.length > 1) {
      nextElement.outgoing.forEach((outFlow, idx) => {
        if (idx === 0) {
          this._animateTokenAlongFlow(outFlow, 0, token);
        } else {
          const newToken = this._createTokenGfx();
          this._animateTokenAlongFlow(outFlow, 0, newToken);
        }
      });
    } else {
      this._animateTokenAlongFlow(nextElement.outgoing[0], 0, token);
    }
  } else {
    this._removeToken(token);
  }
};

/* -------------------------
   🔑 CHOREOGRAPHY COMPLETAMENTE RISCRITTA
   ------------------------- */

CustomTokenAnimation.prototype._isChoreographyWithVisibleMessages = function (element) {
  if (!element || !is(element, "bpmn:ChoreographyTask")) {
    return false;
  }

  const businessObject = element.businessObject;
  if (!businessObject || !Array.isArray(businessObject.messageFlowRef) || businessObject.messageFlowRef.length === 0) {
    return false;
  }

  // Scorri tutti i messageFlowRef
  for (const flow of businessObject.messageFlowRef) {
    const messageElement = flow.messageRef;

    // Filtro: ignora messageRef senza name né documentation
    if (!messageElement || !messageElement.id) {
      continue;
    }
    if (!messageElement.name && (!messageElement.documentation || messageElement.documentation.length === 0)) {
      continue;
    }

    // Se esiste la shape del messaggio, consideralo valido
    const messageShape = this._elementRegistry.getAll().find(el =>
      el.businessObject === messageElement
    );
    if (messageShape) {
      return true;
    }
  }

  return false;
};


/**
 * 🔑 COMPLETAMENTE RISCRITTA: Ogni token viene gestito via coda unificata
 */
CustomTokenAnimation.prototype._handleChoreographyTask = function (task, token) {
  const messageFlows = task.businessObject.messageFlowRef || [];
  const messageShapes = [];

  messageFlows.forEach(flow => {
    const messageElement = flow.messageRef;
    if (messageElement && messageElement.id) {
      const messageShape = this._elementRegistry.getAll().find(el =>
        el.businessObject === messageElement
      );
      if (messageShape) {
        messageShapes.push(messageShape);
      }
    }
  });

  messageShapes.sort((a, b) => a.y - b.y);

  if (messageShapes.length === 0) {
    if (task.outgoing && task.outgoing.length > 0) {
      this._animateTokenAlongFlow(task.outgoing[0], 0, token);
    } else {
      this._removeToken(token);
    }
    return;
  }

  // Ferma questo token
  this._pauseSpecificToken(token);

  // Aggiungi alla coda unificata
  this._popupQueue.push({
    type: 'CHOREOGRAPHY',
    token: token,
    data: {
      task: task,
      messageShapes: messageShapes,
      messageIndex: 0
    }
  });

  if (!this._isProcessingPopup) {
    this._processNextPopupInQueue();
  }
};

CustomTokenAnimation.prototype._showEventBasedGatewayPopup = function (gateway, token) {
  // Ferma il token prima di metterlo in coda
  this._pauseSpecificToken(token);

  this._popupQueue.push({
    type: 'EVENT_BASED_GATEWAY',
    token: token,
    data: {
      gateway: gateway
    }
  });

  if (!this._isProcessingPopup) {
    this._processNextPopupInQueue();
  }
};

/**
 * Funzione effettiva per il render del popup del gateway (eseguita dalla coda)
 */
CustomTokenAnimation.prototype._renderGatewayPopup = function (gateway, token) {
  const popup = document.createElement("div");
  popup.className = "token-popup";
  popup.style.zIndex = 9999;

  const title = document.createElement("div");
  title.innerText = "Scegli il ramo da eseguire";
  title.style.fontWeight = "700";
  title.style.marginBottom = "8px";
  popup.appendChild(title);

  const select = document.createElement("select");
  gateway.outgoing.forEach((flow, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.innerText = flow.businessObject && flow.businessObject.name
      ? flow.businessObject.name
      : "Ramo " + (idx + 1);
    select.appendChild(opt);
  });
  popup.appendChild(select);

  const okBtn = document.createElement("button");
  okBtn.innerText = "OK";
  okBtn.style.marginLeft = "10px";

  okBtn.addEventListener("click", () => {
    const idx = parseInt(select.value, 10);
    const chosenFlow = gateway.outgoing[idx];
    if (chosenFlow) {
      if (this._activePopup) {
        try { document.body.removeChild(this._activePopup); } catch (e) { }
        this._activePopup = null;
      }
      // Rimuovi dalla coda e passa al prossimo
      this._popupQueue.shift();
      this._animateTokenAlongFlow(chosenFlow, 0, token);

      setTimeout(() => this._processNextPopupInQueue(), 100);
    }
  });
  popup.appendChild(okBtn);

  const closeBtn = document.createElement("button");
  closeBtn.innerText = "✕";
  closeBtn.style.marginLeft = "8px";
  closeBtn.style.background = "transparent";
  closeBtn.style.border = "none";
  closeBtn.style.cursor = "pointer";
  closeBtn.addEventListener("click", () => {
    try { document.body.removeChild(popup); } catch (e) { }
    this._activePopup = null;
    this._popupQueue.shift();
    this._removeToken(token);
    setTimeout(() => this._processNextPopupInQueue(), 100);
  });
  popup.appendChild(closeBtn);

  popup.style.position = "fixed";
  popup.style.top = "120px";
  popup.style.left = "50%";
  popup.style.transform = "translateX(-50%)";
  popup.style.padding = "14px";
  popup.style.background = "#fff";
  popup.style.border = "1px solid #aaa";
  popup.style.borderRadius = "7px";
  popup.style.boxShadow = "0 2px 10px rgba(0,0,0,0.16)";

  document.body.appendChild(popup);
  this._activePopup = popup;
};


/**
 * 🔑 NUOVO: Processa il prossimo elemento della coda unificata
 */
CustomTokenAnimation.prototype._processNextPopupInQueue = function () {
  if (this._popupQueue.length === 0) {
    this._isProcessingPopup = false;
    return;
  }

  this._isProcessingPopup = true;
  const item = this._popupQueue[0];

  if (item.type === 'CHOREOGRAPHY') {
    const tokenData = item.data;
    tokenData.messageShapes.forEach(sh => this.colorElement(sh.id, "yellow"));
    this._processTokenMessages(item);
  } else if (item.type === 'EVENT_BASED_GATEWAY') {
    this._renderGatewayPopup(item.data.gateway, item.token);
  }
};

/**
 * 🔑 NUOVO: Processa i messaggi per un singolo token (Choreography)
 */
CustomTokenAnimation.prototype._processTokenMessages = function (item) {
  const tokenData = item.data;
  if (tokenData.messageIndex >= tokenData.messageShapes.length) {
    this._popupQueue.shift();
    // 🔑 FIX: Passa il token corretto dall'item della coda
    this._resumeToken({ token: item.token, ...tokenData });
    setTimeout(() => this._processNextPopupInQueue(), 100);
    return;
  }

  const shape = tokenData.messageShapes[tokenData.messageIndex];

  this._showMessagePopup(shape, () => {
    this.colorElement(shape.id, "green");
    tokenData.messageIndex++;
    this._processTokenMessages(item);
  }, () => {
    this.colorElement(shape.id, "red");
    tokenData.messageIndex++;
    this._processTokenMessages(item);
  });
};

/**
 * 🔑 NUOVO: Riprende un singolo token dopo aver completato i suoi popup
 */
CustomTokenAnimation.prototype._resumeToken = function (tokenData) {
  const { token, task } = tokenData;

  if (!token || !token.parentNode) {
    return;
  }

  // Continua l'animazione di questo token
  if (task.outgoing && task.outgoing.length > 0) {
    if (task.outgoing.length > 1) {
      // Per split, usa il primo outgoing per il token corrente
      this._animateTokenAlongFlow(task.outgoing[0], 0, token);

      // Crea nuovi token per gli altri outgoing
      for (let i = 1; i < task.outgoing.length; i++) {
        const newToken = this._createTokenGfx();
        this._animateTokenAlongFlow(task.outgoing[i], 0, newToken);
      }
    } else {
      this._animateTokenAlongFlow(task.outgoing[0], 0, token);
    }
  } else {
    this._removeToken(token);
  }
};

/**
 * Ferma solo un token specifico
 */
CustomTokenAnimation.prototype._pauseSpecificToken = function (token) {
  const frameId = this._tokenAnimations.get(token);
  if (frameId) {
    cancelAnimationFrame(frameId);
    this._tokenAnimations.delete(token);
  }
};

/* Mostra popup (invariato) */
CustomTokenAnimation.prototype._showMessagePopup = function (messageShape, onConfirm, onReject) {
  if (this._activePopup) {
    try { document.body.removeChild(this._activePopup); } catch (e) { }
    this._activePopup = null;
  }

  const popup = document.createElement("div");
  popup.className = "token-popup";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";

  const title = document.createElement("div");
  title.innerText = messageShape.businessObject.name || "Messaggio";
  title.style.fontWeight = "700";

  const closeBtn = document.createElement("button");
  closeBtn.innerText = "✕";
  closeBtn.style.border = "none";
  closeBtn.style.background = "transparent";
  closeBtn.style.cursor = "pointer";

  header.appendChild(title);
  header.appendChild(closeBtn);
  popup.appendChild(header);

  const body = document.createElement("div");
  body.style.marginTop = "10px";
  body.innerText = messageShape.businessObject.documentation && messageShape.businessObject.documentation.length
    ? (messageShape.businessObject.documentation[0].text || "")
    : "";
  popup.appendChild(body);

  const actions = document.createElement("div");
  actions.style.marginTop = "12px";
  actions.style.display = "flex";
  actions.style.gap = "8px";
  const okBtn = document.createElement("button");
  okBtn.innerText = "OK";
  const noBtn = document.createElement("button");
  noBtn.innerText = "NO";
  actions.appendChild(okBtn);
  actions.appendChild(noBtn);
  popup.appendChild(actions);

  document.body.appendChild(popup);
  this._activePopup = popup;

  const cleanup = () => {
    if (this._activePopup) {
      try { document.body.removeChild(this._activePopup); } catch (e) { }
      this._activePopup = null;
    }
  };

  closeBtn.addEventListener("click", () => {
    cleanup();
    if (onReject) onReject();
  });

  noBtn.addEventListener("click", () => {
    cleanup();
    if (onReject) onReject();
  });

  okBtn.addEventListener("click", () => {
    cleanup();
    if (onConfirm) onConfirm();
  });
};

/* -------------------------
   COLORAZIONE E METODI HELPER (invariati)
   ------------------------- */

CustomTokenAnimation.prototype.colorElement = function (elementId, color) {
  this._canvas.removeMarker(elementId, 'highlight-yellow');
  this._canvas.removeMarker(elementId, 'highlight-green');
  this._canvas.removeMarker(elementId, 'highlight-red');

  if (color === "yellow") {
    this._canvas.addMarker(elementId, 'highlight-yellow');
  } else if (color === "green") {
    this._canvas.addMarker(elementId, 'highlight-green');
  } else if (color === "red") {
    this._canvas.addMarker(elementId, 'highlight-red');
  }
};

CustomTokenAnimation.prototype._animateTokenAlongFlowWithToken = function (sequenceFlow, startWaypointIndex = 0, token) {
  return this._animateTokenAlongFlow(sequenceFlow, startWaypointIndex, token);
};

CustomTokenAnimation.prototype.animateEdge = function (edgeId) {
  this.reset();

  const edge = this._elementRegistry.get(edgeId);
  if (!edge || !edge.waypoints) {
    console.warn("Edge non trovato o senza waypoints:", edgeId);
    return;
  }

  this._isPlaying = true;
  const token = this._createTokenGfx();
  this._animateTokenAlongFlow(edge, 0, token);
};

CustomTokenAnimation.$inject = ["canvas", "eventBus", "elementRegistry"];
