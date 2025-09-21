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

export default function CustomTokenAnimation(
  canvas,
  eventBus,
  elementRegistry
) {
  this._canvas = canvas;
  this._eventBus = eventBus;
  this._elementRegistry = elementRegistry;

  this._animationToken = null;
  this._isPlaying = false;
  this._speed = 1;
  this._currentWaypointIndex = 0;
  this._currentSequenceFlow = null;
  this._animationFrameId = null;

  this._bindEvents();
}

CustomTokenAnimation.prototype._bindEvents = function () {
  this._eventBus.on("diagram.destroy", this.reset.bind(this));
};

CustomTokenAnimation.prototype.start = function () {
  this.reset(); // Reset any previous animation
  this._isPlaying = true;
  this._currentWaypointIndex = 0;

  const startEvent = this._elementRegistry.getAll().find(element => is(element, "bpmn:StartEvent"));

  if (startEvent && startEvent.outgoing && startEvent.outgoing.length > 0) {
    this._currentSequenceFlow = startEvent.outgoing[0];
    this._animateTokenAlongFlow(this._currentSequenceFlow);
  } else {
    console.warn("No start event or outgoing sequence flow found to start animation.");
    this._isPlaying = false;
  }
};

CustomTokenAnimation.prototype.pause = function () {
  this._isPlaying = false;
  if (this._animationFrameId) {
    cancelAnimationFrame(this._animationFrameId);
    this._animationFrameId = null;
  }
};

CustomTokenAnimation.prototype.reset = function () {
  this.pause();
  if (this._animationToken) {
    svgRemove(this._animationToken);
    this._animationToken = null;
  }
  this._currentWaypointIndex = 0;
  this._currentSequenceFlow = null;
  this._isPlaying = false;
};

CustomTokenAnimation.prototype.setSpeed = function (speed) {
  this._speed = speed;
  // If animation is running, restart it with new speed
  if (this._isPlaying && this._currentSequenceFlow) {
    this.pause();
    this._animateTokenAlongFlow(this._currentSequenceFlow, this._currentWaypointIndex);
  }
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

CustomTokenAnimation.prototype._animateTokenAlongFlow = function (sequenceFlow, startWaypointIndex = 0) {
  if (!this._isPlaying) return;

  const waypoints = sequenceFlow.waypoints;
  if (!waypoints || waypoints.length < 2) {
    console.warn("Sequence flow has no valid waypoints for animation.", sequenceFlow);
    this.reset();
    return;
  }

  if (!this._animationToken) {
    this._animationToken = this._createTokenGfx();
  }

  this._currentSequenceFlow = sequenceFlow;
  this._currentWaypointIndex = startWaypointIndex;

  let startTime = null;
  const duration = ANIMATION_DURATION_BASE / this._speed;

  const animate = (currentTime) => {
    if (!this._isPlaying) return;

    if (!startTime) startTime = currentTime;
    const progress = (currentTime - startTime) / duration;

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
        this._animationToken,
        "transform",
        `translate(${x - TOKEN_SIZE / 2}, ${y - TOKEN_SIZE / 2})`
      );

      this._animationFrameId = requestAnimationFrame(animate);
    } else {
      const nextElement = sequenceFlow.target;
      console.log("Next element:", nextElement);

     if (
  nextElement &&
  is(nextElement, "bpmn:ChoreographyTask") &&
  nextElement.businessObject &&
  nextElement.businessObject.messageFlowRef &&
  Array.isArray(nextElement.businessObject.messageFlowRef) &&
  nextElement.businessObject.messageFlowRef.length > 0
) {
  // prendo tutti i messageFlowRef
  const messageFlows = nextElement.businessObject.messageFlowRef;

  messageFlows.forEach(flow => {
    const messageElement = flow.messageRef;
    if (messageElement && messageElement.id) {
      this.colorElement(messageElement.id, "yellow");
    }
  });

  // aspetto 1 secondo e poi continuo sull'outgoing
  setTimeout(() => {
    if (nextElement.outgoing && nextElement.outgoing.length > 0) {
      const nextSequenceFlow = nextElement.outgoing[0];
      this._animateTokenAlongFlow(nextSequenceFlow, 0);
    } else {
      this.reset();
    }
  }, 1000);
}
 else {
        if (nextElement && nextElement.outgoing && nextElement.outgoing.length > 0) {
          const nextSequenceFlow = nextElement.outgoing[0];
          this._animateTokenAlongFlow(nextSequenceFlow, 0);
        } else {
          this.reset();
        }
      }
    }
  };

  this._animationFrameId = requestAnimationFrame(animate);
};




CustomTokenAnimation.prototype.colorElement = function(elementId, color) {
  // Prova a colorare direttamente il simbolo SVG
  const element = this._elementRegistry.get(elementId);
  if (!element) return;

  const gfx = this._elementRegistry.getGraphics(element);
    if (gfx) {
    // Usa il colore scelto per il bordo, ma trasparente per il riempimento
    let fillColor = color;
    // Se il colore è in formato esadecimale, converti in rgba con trasparenza
    if (/^#([A-Fa-f0-9]{6})$/.test(color)) {
      const r = parseInt(color.substr(1,2),16);
      const g = parseInt(color.substr(3,2),16);
      const b = parseInt(color.substr(5,2),16);
      fillColor = `rgba(${r},${g},${b},0.3)`;
    }
    gfx.querySelectorAll('rect, path, polygon, ellipse, circle').forEach(node => {
      node.setAttribute('stroke', color); // bordo opaco
      node.setAttribute('fill', fillColor);   // interno trasparente
      node.style.stroke = color;
      node.style.fill = fillColor;
    });
    return;
  }

 // Fallback overlay 
  const overlays = this._overlays;
  if (!overlays) {
    console.warn("Overlays non disponibili per colorare l’elemento");
    return;
  }
  overlays.remove({ element: elementId, type: 'highlight' });
  overlays.add(elementId, 'highlight', {
    position: { top: -10, left: -10 },
    html: `<div style="border: 3px solid ${color}; background: rgba(255,0,0,0.3); width: 40px; height: 25px; box-sizing: border-box; pointer-events: none; border-radius: 4px;"></div>`
  });
};

CustomTokenAnimation.prototype.animateEdge = function(edgeId) {
  this.reset(); // Ferma eventuali animazioni precedenti

  const edge = this._elementRegistry.get(edgeId);
  if (!edge || !edge.waypoints) {
    console.warn("Edge non trovato o senza waypoints:", edgeId);
    return;
  }

  this._isPlaying = true;
  this._currentSequenceFlow = edge;
  this._currentWaypointIndex = 0;

  if (!this._animationToken) {
    this._animationToken = this._createTokenGfx();
  }

  let startTime = null;
  const duration = ANIMATION_DURATION_BASE / this._speed;
  const waypoints = edge.waypoints;

  const animate = (currentTime) => {
    if (!this._isPlaying) return;

    if (!startTime) startTime = currentTime;
    const progress = (currentTime - startTime) / duration;

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
        this._animationToken,
        "transform",
        `translate(${x - TOKEN_SIZE / 2}, ${y - TOKEN_SIZE / 2})`
      );

      this._animationFrameId = requestAnimationFrame(animate);
    } else {
      // Fine animazione su questo edge
      this.reset();
    }
  };

  this._animationFrameId = requestAnimationFrame(animate);
};




CustomTokenAnimation.$inject = ["canvas", "eventBus", "elementRegistry"];
