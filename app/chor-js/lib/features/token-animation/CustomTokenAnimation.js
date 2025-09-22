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
const ANIMATION_DURATION_BASE = 2000; // 2 secondi base

export default function CustomTokenAnimation(
  canvas,
  eventBus,
  elementRegistry
) {
  this._canvas = canvas;
  this._eventBus = eventBus;
  this._elementRegistry = elementRegistry;

  // variabili di stato
  this._isPlaying = false;
  this._speed = 1;

  // mappe per tracciare animazioni/token e stato dei parallel gateway (join)
  this._tokenAnimations = new Map(); // Map<tokenElement, frameId>
  this._gatewayJoinState = new Map(); // Map<gatewayId, countArrived>

  this._bindEvents();
}

CustomTokenAnimation.prototype._bindEvents = function () {
  this._eventBus.on("diagram.destroy", this.reset.bind(this));
};

CustomTokenAnimation.prototype.start = function () {
  if (this._isPlaying) {
    return;
  }

  this._isPlaying = true;

  // trova start event e lancia il token iniziale
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
  // ferma tutto: cancella tutti i frame in corso ma non rimuove i token dall'SVG (così si può riprendere eventualmente)
  this._isPlaying = false;
  for (const frameId of this._tokenAnimations.values()) {
    cancelAnimationFrame(frameId);
  }
  // non cancelliamo le entry dalla mappa qui, perché potremmo voler riprendere (ma nella nostra implementazione semplice riprenderà dall'inizio quando start viene chiamato).
  this._tokenAnimations.clear();
};

CustomTokenAnimation.prototype.reset = function () {
  this.pause();

  // rimuovi tutti i token SVG presenti nel layer
  const group = this._getAnimationLayer();
  if (group) {
    while (group.firstChild) {
      svgRemove(group.firstChild);
    }
  }

  this._tokenAnimations.clear();
  this._gatewayJoinState.clear();

  // rimuovi markers highlight
  const allElements = this._elementRegistry.getAll();
  allElements.forEach(element => {
    this._canvas.removeMarker(element.id, 'highlight');
  });

  this._isPlaying = false;
};


CustomTokenAnimation.prototype.setSpeed = function (speed) {
  this._speed = speed;
  // Nota: per semplicità i token già in volo non ricalcolano il tempo rimanente.
};

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

/* rimuove un singolo token (cancella anche il frameRequest associato) */
CustomTokenAnimation.prototype._removeToken = function (token) {
  if (!token) return;
  const frameId = this._tokenAnimations.get(token);
  if (frameId) {
    cancelAnimationFrame(frameId);
  }
  this._tokenAnimations.delete(token);
  try {
    svgRemove(token);
  } catch (e) {
    // ignore se già rimosso
  }
};

/**
 * Anima UN token lungo un sequenceFlow.
 * - sequenceFlow: l'edge con waypoints
 * - startWaypointIndex: opzionale
 * - token: elemento SVG del token. Se non passato, ne viene creato uno.
 */
CustomTokenAnimation.prototype._animateTokenAlongFlow = function (sequenceFlow, startWaypointIndex = 0, token = null) {
  if (!this._isPlaying) {
    // Se siamo in pausa non iniziamo
    return;
  }

  if (!sequenceFlow || !sequenceFlow.waypoints || sequenceFlow.waypoints.length < 2) {
    // niente da fare: rimuovi token se esiste
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
    if (!this._isPlaying) return; // fermati se in pausa

    if (!startTime) startTime = currentTime;
    const progress = (currentTime - startTime) / duration;

    if (progress < 1) {
      // calcola posizione e sposta token
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
        `translate(${x - TOKEN_SIZE / 2}, ${y - TOKEN_SIZE / 2})`
      );

      const frameId = requestAnimationFrame(animate);
      this._tokenAnimations.set(token, frameId);
    } else {
      // fine animazione su questo edge: togliamo tracciamento e avanziamo
      this._tokenAnimations.delete(token);
      this._handleNextElement(sequenceFlow.target, token);
    }
  };

  const initialFrameId = requestAnimationFrame(animate);
  this._tokenAnimations.set(token, initialFrameId);
};

/**
 * Decide cosa fare quando il token raggiunge un nuovo elemento
 * - nextElement: shape/bpmn element
 * - token: il token SVG che è arrivato
 */
CustomTokenAnimation.prototype._handleNextElement = function (nextElement, token) {
  if (!token) return;

  // se non c'è elemento successivo → token finito
  if (!nextElement) {
    this._removeToken(token);
    return;
  }

  // se è EndEvent → elimina token
  if (is(nextElement, "bpmn:EndEvent")) {
    this._removeToken(token);
    return;
  }

  // Se è ParallelGateway -> gestiamo join/split
  if (is(nextElement, "bpmn:ParallelGateway")) {
    const incomingCount = nextElement.incoming ? nextElement.incoming.length : 0;
    const outgoingCount = nextElement.outgoing ? nextElement.outgoing.length : 0;

    // JOIN (gateway con più incoming e tipicamente 1 outgoing)
    if (incomingCount > 1 && outgoingCount >= 1) {
      const current = this._gatewayJoinState.get(nextElement.id) || 0;
      const newCount = current + 1;
      this._gatewayJoinState.set(nextElement.id, newCount);

      // consumiamo/eliminiamo questo token
      this._removeToken(token);

      if (newCount === incomingCount) {
        // tutti i token sono arrivati -> reset counter e uscita con 1 token
        this._gatewayJoinState.set(nextElement.id, 0);

        // crea un nuovo token che esce dal gateway
        const outFlow = nextElement.outgoing[0];
        if (outFlow) {
          const newToken = this._createTokenGfx();
          this._animateTokenAlongFlow(outFlow, 0, newToken);
        }
      }
      return;
    }

    // SPLIT (un incoming -> più outgoing)
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

  // Choreography: colora i messageRef ma NON bloccare il token
  if (this._isChoreographyWithMessages(nextElement)) {
    this._handleChoreographyTask(nextElement, token);
    return;
  }

  // Normale: prosegui sugli outgoing (gestione split anche qui)
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
    // nessun outgoing -> rimuovi token
    this._removeToken(token);
  }
};

CustomTokenAnimation.prototype._animateTokenAlongFlowWithToken = function (sequenceFlow, startWaypointIndex = 0, token) {
  // mantenuta per compatibilità: delega alla versione unica
  return this._animateTokenAlongFlow(sequenceFlow, startWaypointIndex, token);
};

/**
 * Controlla se l’elemento è un ChoreographyTask con messaggi
 */
CustomTokenAnimation.prototype._isChoreographyWithMessages = function (element) {
  return (
    element &&
    is(element, "bpmn:ChoreographyTask") &&
    element.businessObject &&
    Array.isArray(element.businessObject.messageFlowRef) &&
    element.businessObject.messageFlowRef.length > 0
  );
};

/**
 * Gestisce la colorazione e la logica dei messaggi di un ChoreographyTask
 * Nota: NON lascia il token fermo, lo fa proseguire subito (split se più outgoing).
 */
CustomTokenAnimation.prototype._handleChoreographyTask = function (task, token) {
  const messageFlows = task.businessObject.messageFlowRef || [];

  messageFlows.forEach(flow => {
    const messageElement = flow.messageRef;
    if (messageElement && messageElement.id) {
      const messageShape = this._elementRegistry.getAll().find(el =>
        el.businessObject === messageElement
      );

      if (messageShape) {
        this.colorElement(messageShape.id, "yellow");
      } else {
        console.warn("Shape non trovato per messageRef", messageElement.id);
      }
    }
  });

  // subito avanti (non lasciare il token fermo)
  if (task.outgoing && task.outgoing.length > 0) {
    if (task.outgoing.length > 1) {
      task.outgoing.forEach((outFlow, idx) => {
        if (idx === 0) {
          this._animateTokenAlongFlow(outFlow, 0, token);
        } else {
          const newToken = this._createTokenGfx();
          this._animateTokenAlongFlow(outFlow, 0, newToken);
        }
      });
    } else {
      this._animateTokenAlongFlow(task.outgoing[0], 0, token);
    }
  } else {
    this._removeToken(token);
  }
};

CustomTokenAnimation.prototype.colorElement = function(elementId, color) {
  this._canvas.removeMarker(elementId, 'highlight'); // rimuove marker precedente
  this._canvas.addMarker(elementId, 'highlight');    // aggiunge nuovo marker con classe CSS
};

CustomTokenAnimation.prototype.animateEdge = function(edgeId) {
  // ferma eventuali animazioni precedenti e lancia animazione su un solo edge
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
