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
      // Move to the next sequence flow or end animation
      const nextElement = sequenceFlow.target;
      if (nextElement && nextElement.outgoing && nextElement.outgoing.length > 0) {
        const nextSequenceFlow = nextElement.outgoing[0]; // Assuming one outgoing flow for simplicity
        this._animateTokenAlongFlow(nextSequenceFlow);
      } else {
        this.reset();
      }
    }
  };

  this._animationFrameId = requestAnimationFrame(animate);
};

CustomTokenAnimation.$inject = ["canvas", "eventBus", "elementRegistry"];
