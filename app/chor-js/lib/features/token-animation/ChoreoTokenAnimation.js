import { query as domQuery } from "min-dom";

import {
  appendTo as svgAppendTo,
  create as svgCreate,
  attr as svgAttr,
  remove as svgRemove,
} from "tiny-svg";

import { is } from "bpmn-js/lib/util/ModelUtil";

const TOKEN_SIZE = 20;
const ANIMATION_DURATION_BASE = 2000; // 2 secondi base

/**
 * Animazione dei token per coreografie BPMN
 */
export default function ChoreoTokenAnimation(
  canvas,
  eventBus,
  elementRegistry
) {
  this._canvas = canvas;
  this._eventBus = eventBus;
  this._elementRegistry = elementRegistry;

  this._animations = new Set();
  this._isPlaying = false;
  this._speed = 1;
  this._currentStep = 0;
  this._steps = [];

  this._initializeSteps();
}

ChoreoTokenAnimation.prototype._initializeSteps = function () {
  // Trova tutti gli elementi di coreografia e crea i passi dell'animazione
  const elements = this._elementRegistry.getAll();
  const choreographyTasks = elements.filter((element) =>
    is(element, "bpmn:ChoreographyActivity")
  );

  // Ordina le attività in base al flusso di sequenza
  this._steps = this._buildExecutionSteps(choreographyTasks);
};

ChoreoTokenAnimation.prototype._buildExecutionSteps = function (tasks) {
  const steps = [];
  const visited = new Set();

  // Trova il punto di inizio (start event o prima attività)
  const startElements = this._elementRegistry
    .getAll()
    .filter((element) => is(element, "bpmn:StartEvent"));

  if (startElements.length > 0) {
    this._traverseFromElement(startElements[0], steps, visited);
  } else if (tasks.length > 0) {
    // Se non c'è start event, inizia dalla prima attività
    this._traverseFromElement(tasks[0], steps, visited);
  }

  return steps;
};

ChoreoTokenAnimation.prototype._traverseFromElement = function (
  element,
  steps,
  visited
) {
  if (visited.has(element.id)) {
    return;
  }

  visited.add(element.id);

  if (is(element, "bpmn:ChoreographyActivity")) {
    steps.push({
      element: element,
      type: "choreography-task",
      participants: this._getParticipants(element),
    });
  }

  // Trova gli elementi successivi attraverso i sequence flow
  const outgoing = element.outgoing || [];
  outgoing.forEach((connection) => {
    if (is(connection, "bpmn:SequenceFlow") && connection.target) {
      steps.push({
        element: connection,
        type: "sequence-flow",
        source: element,
        target: connection.target,
      });

      this._traverseFromElement(connection.target, steps, visited);
    }
  });
};

ChoreoTokenAnimation.prototype._getParticipants = function (choreographyTask) {
  // Estrae i partecipanti dall'attività di coreografia
  const participants = [];

  if (
    choreographyTask.businessObject &&
    choreographyTask.businessObject.participantRef
  ) {
    choreographyTask.businessObject.participantRef.forEach((participant) => {
      participants.push({
        id: participant.id,
        name: participant.name,
        isInitiating:
          participant ===
          choreographyTask.businessObject.initiatingParticipantRef,
      });
    });
  }

  return participants;
};

ChoreoTokenAnimation.prototype.start = function () {
  this._isPlaying = true;
  this._currentStep = 0;
  this.clearAnimations();
  this._executeNextStep();
};

ChoreoTokenAnimation.prototype.pause = function () {
  this._isPlaying = false;
  this._animations.forEach((animation) => animation.pause());
};

ChoreoTokenAnimation.prototype.resume = function () {
  this._isPlaying = true;
  this._animations.forEach((animation) => animation.resume());
  this._executeNextStep();
};

ChoreoTokenAnimation.prototype.reset = function () {
  this._isPlaying = false;
  this._currentStep = 0;
  this.clearAnimations();
};

ChoreoTokenAnimation.prototype.step = function () {
  if (this._currentStep < this._steps.length) {
    this._executeStep(this._steps[this._currentStep]);
    this._currentStep++;
  }
};

ChoreoTokenAnimation.prototype.setSpeed = function (speed) {
  this._speed = speed;
  this._animations.forEach((animation) => animation.setSpeed(speed));
};

ChoreoTokenAnimation.prototype._executeNextStep = function () {
  if (!this._isPlaying || this._currentStep >= this._steps.length) {
    return;
  }

  const step = this._steps[this._currentStep];
  this._executeStep(step);

  this._currentStep++;

  // Programma il prossimo passo
  setTimeout(() => {
    this._executeNextStep();
  }, ANIMATION_DURATION_BASE / this._speed);
};

ChoreoTokenAnimation.prototype._executeStep = function (step) {
  if (step.type === "choreography-task") {
    this._animateChoreographyTask(step);
  } else if (step.type === "sequence-flow") {
    this._animateSequenceFlow(step);
  }
};

ChoreoTokenAnimation.prototype._animateChoreographyTask = function (step) {
  const element = step.element;

  // Evidenzia l'attività di coreografia
  this._highlightElement(element);

  // Anima i partecipanti
  step.participants.forEach((participant, index) => {
    setTimeout(() => {
      this._animateParticipant(element, participant);
    }, index * 200); // Ritardo tra i partecipanti
  });

  // Gestisci i messaggi se presenti
  this._animateMessages(element);
};

ChoreoTokenAnimation.prototype._animateSequenceFlow = function (step) {
  const connection = step.element;

  if (!connection.waypoints || connection.waypoints.length < 2) {
    return;
  }

  const tokenGfx = this._createTokenGfx();
  const animation = new TokenAnimation(tokenGfx, connection.waypoints, () => {
    this._removeAnimation(animation);
  });

  animation.setSpeed(this._speed);
  this._animations.add(animation);
  animation.start();
};

ChoreoTokenAnimation.prototype._animateParticipant = function (
  choreographyElement,
  participant
) {
  // Trova la banda del partecipante
  const participantBand = this._findParticipantBand(
    choreographyElement,
    participant
  );

  if (participantBand) {
    this._highlightParticipantBand(participantBand, participant.isInitiating);
  }
};

ChoreoTokenAnimation.prototype._animateMessages = function (
  choreographyElement
) {
  // Trova i messaggi associati all'attività di coreografia
  const messages = this._findMessages(choreographyElement);

  messages.forEach((message) => {
    this._animateMessage(message);
  });
};

ChoreoTokenAnimation.prototype._findParticipantBand = function (
  choreographyElement,
  participant
) {
  // Cerca la banda del partecipante nell'elemento di coreografia
  const children = choreographyElement.children || [];
  return children.find(
    (child) =>
      is(child, "bpmn:Participant") &&
      child.businessObject.id === participant.id
  );
};

ChoreoTokenAnimation.prototype._findMessages = function (choreographyElement) {
  // Trova i messaggi associati all'attività
  const children = choreographyElement.children || [];
  return children.filter((child) => is(child, "bpmn:Message"));
};

ChoreoTokenAnimation.prototype._animateMessage = function (message) {
  const messageTokenGfx = this._createMessageTokenGfx();

  // Calcola il percorso del messaggio
  const waypoints = this._calculateMessagePath(message);

  if (waypoints.length >= 2) {
    const animation = new TokenAnimation(messageTokenGfx, waypoints, () => {
      this._removeAnimation(animation);
    });

    animation.setSpeed(this._speed);
    this._animations.add(animation);
    animation.start();
  }
};

ChoreoTokenAnimation.prototype._calculateMessagePath = function (message) {
  // Calcola il percorso del messaggio dalla banda mittente a quella destinataria
  const parent = message.parent;
  if (!parent) return [];

  const messageX = message.x + message.width / 2;
  const messageY = message.y + message.height / 2;

  // Punto di partenza (banda mittente)
  const startY =
    message.y > parent.height / 2
      ? message.y - 30
      : message.y + message.height + 30;

  return [
    { x: messageX, y: startY },
    { x: messageX, y: messageY },
  ];
};

ChoreoTokenAnimation.prototype._highlightElement = function (element) {
  const gfx = this._canvas.getGraphics(element);
  if (gfx) {
    // Aggiungi classe CSS per evidenziazione
    gfx.classList.add("choreo-token-active");

    // Rimuovi evidenziazione dopo un po'
    setTimeout(() => {
      gfx.classList.remove("choreo-token-active");
    }, ANIMATION_DURATION_BASE / this._speed);
  }
};

ChoreoTokenAnimation.prototype._highlightParticipantBand = function (
  participantBand,
  isInitiating
) {
  const gfx = this._canvas.getGraphics(participantBand);
  if (gfx) {
    const className = isInitiating
      ? "choreo-participant-initiating"
      : "choreo-participant-active";
    gfx.classList.add(className);

    setTimeout(() => {
      gfx.classList.remove(className);
    }, ANIMATION_DURATION_BASE / this._speed);
  }
};

ChoreoTokenAnimation.prototype._createTokenGfx = function () {
  const group = this._getAnimationLayer();
  const tokenSvg = this._createTokenSVG("#4CAF50", "#FFFFFF", "1");
  return svgAppendTo(svgCreate(tokenSvg), group);
};

ChoreoTokenAnimation.prototype._createMessageTokenGfx = function () {
  const group = this._getAnimationLayer();
  const messageSvg = this._createMessageTokenSVG("#2196F3", "#FFFFFF");
  return svgAppendTo(svgCreate(messageSvg), group);
};

ChoreoTokenAnimation.prototype._createTokenSVG = function (
  primaryColor,
  auxiliaryColor,
  text
) {
  return `
    <g class="choreo-token">
      <circle
        class="choreo-token-circle"
        r="${TOKEN_SIZE / 2}"
        cx="${TOKEN_SIZE / 2}"
        cy="${TOKEN_SIZE / 2}"
        fill="${primaryColor}"
        stroke="#333"
        stroke-width="2"
      />
      <text
        class="choreo-token-text"
        x="${TOKEN_SIZE / 2}"
        y="${TOKEN_SIZE / 2 + 4}"
        text-anchor="middle"
        fill="${auxiliaryColor}"
        font-size="12"
        font-weight="bold"
      >${text}</text>
    </g>
  `;
};

ChoreoTokenAnimation.prototype._createMessageTokenSVG = function (
  primaryColor,
  auxiliaryColor
) {
  return `
    <g class="choreo-message-token">
      <rect
        class="choreo-message-rect"
        x="2"
        y="6"
        width="${TOKEN_SIZE - 4}"
        height="${TOKEN_SIZE - 8}"
        fill="${primaryColor}"
        stroke="#333"
        stroke-width="2"
        rx="2"
      />
      <path
        d="M 2 6 L ${TOKEN_SIZE / 2} ${TOKEN_SIZE / 2} L ${TOKEN_SIZE - 2} 6"
        fill="none"
        stroke="${auxiliaryColor}"
        stroke-width="1"
      />
    </g>
  `;
};

ChoreoTokenAnimation.prototype._getAnimationLayer = function () {
  const canvas = this._canvas;
  const viewport = domQuery(".viewport", canvas._svg);

  let group = domQuery(".choreo-animation-tokens", viewport);

  if (!group) {
    group = svgCreate('<g class="choreo-animation-tokens" />');
    svgAppendTo(group, viewport);
  }

  return group;
};

ChoreoTokenAnimation.prototype.clearAnimations = function () {
  this._animations.forEach((animation) => {
    animation.remove();
  });
  this._animations.clear();
};

ChoreoTokenAnimation.prototype._removeAnimation = function (animation) {
  this._animations.delete(animation);
};

ChoreoTokenAnimation.$inject = ["canvas", "eventBus", "elementRegistry"];

// Classe per gestire una singola animazione di token
function TokenAnimation(gfx, waypoints, onComplete) {
  this.gfx = gfx;
  this.waypoints = waypoints;
  this.onComplete = onComplete;
  this._paused = false;
  this._speed = 1;
  this._progress = 0;
  this._animationId = null;
}

TokenAnimation.prototype.start = function () {
  this._startTime = Date.now();
  this._animate();
};

TokenAnimation.prototype.pause = function () {
  this._paused = true;
  if (this._animationId) {
    cancelAnimationFrame(this._animationId);
  }
};

TokenAnimation.prototype.resume = function () {
  this._paused = false;
  this._animate();
};

TokenAnimation.prototype.setSpeed = function (speed) {
  this._speed = speed;
};

TokenAnimation.prototype._animate = function () {
  if (this._paused) return;

  const elapsed = (Date.now() - this._startTime) * this._speed;
  const duration = ANIMATION_DURATION_BASE;
  this._progress = Math.min(elapsed / duration, 1);

  this._updatePosition();

  if (this._progress >= 1) {
    this.onComplete();
  } else {
    this._animationId = requestAnimationFrame(() => this._animate());
  }
};

TokenAnimation.prototype._updatePosition = function () {
  if (this.waypoints.length < 2) return;

  const totalSegments = this.waypoints.length - 1;
  const segmentProgress = this._progress * totalSegments;
  const currentSegment = Math.floor(segmentProgress);
  const segmentRatio = segmentProgress - currentSegment;

  if (currentSegment >= totalSegments) {
    const lastPoint = this.waypoints[this.waypoints.length - 1];
    this._moveToken(lastPoint.x, lastPoint.y);
    return;
  }

  const startPoint = this.waypoints[currentSegment];
  const endPoint = this.waypoints[currentSegment + 1];

  const x = startPoint.x + (endPoint.x - startPoint.x) * segmentRatio;
  const y = startPoint.y + (endPoint.y - startPoint.y) * segmentRatio;

  this._moveToken(x, y);
};

TokenAnimation.prototype._moveToken = function (x, y) {
  svgAttr(
    this.gfx,
    "transform",
    `translate(${x - TOKEN_SIZE / 2}, ${y - TOKEN_SIZE / 2})`
  );
};

TokenAnimation.prototype.remove = function () {
  this.pause();
  svgRemove(this.gfx);
};
