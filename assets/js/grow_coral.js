import paper from "paper";

// Utility: create a full-size canvas inside the given parent element
const createCanvas = parent => {
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  parent.appendChild(canvas);

  // Set internal resolution so paper.js has the right dimensions
  canvas.width = parent.clientWidth;
  canvas.height = parent.clientHeight;

  return canvas;
};

// Utility: draw a single dot using paper.js
const drawDot = (x, y, radius = 6, color = "red") => {
  /* eslint-disable no-new */
  new paper.Path.Circle({
    center: [x, y],
    radius,
    fillColor: color,
  });
  /* eslint-enable no-new */
  paper.view.update();
};

// Draw translucent blue mask circle with lowest point at bottom center
const drawMask = ({ size = 0.3, strength = 0.1 } = {}) => {
  const { width: w, height: h } = paper.view.size;
  const diameter = Math.min(w, h) - 20;
  const baseRadius = diameter / 2;
  const center = new paper.Point(w / 2, h - baseRadius - 6);

  // Build a wavy circle using random radial offsets
  const segments = Math.max(12, Math.round(32 * size));
  const path = new paper.Path({ closed: true, fillColor: new paper.Color(0, 0, 1, 0.1) });
  for (let i = 0; i < segments; i += 1) {
    const theta = (Math.PI * 2 * i) / segments;
    const offset = (Math.random() * 2 - 1) * baseRadius * strength;
    const r = baseRadius + offset;
    path.add(new paper.Point(center.x + r * Math.cos(theta), center.y + r * Math.sin(theta)));
  }
  path.smooth();

  drawDot(w / 2, h - 6); // initial anchor dot at lowest point
  paper.view.update();
  return path;
};

// Draw custom mask from user-drawn points
const drawCustomMask = (points) => {
  const path = new paper.Path({ 
    closed: true, 
    fillColor: new paper.Color(0, 0, 1, 0.1),
    strokeColor: new paper.Color(0, 0, 1, 0.3),
    strokeWidth: 2
  });
  
  points.forEach(([x, y]) => path.add(new paper.Point(x, y)));
  path.smooth();
  
  paper.view.update();
  return path;
};

/*
 * Grow coral using a lightweight Space-Colonization algorithm.
 *  – mask          : paper.Path that defines the growth boundary
 *  – animate       : if true, iterate on every frame
 *  – attractorCount: number of seed (attractor) points inside the mask
 */
const growCoral = ({ mask, animate = true, attractorCount = 250, maxAbsAngle = Math.PI / 2, fillMode = false, segmentLength = 13, nodeRadius = 5, tapering = 0.96, segmentScale = 0.7, replenishAttractors = true, simplifyTolerance = 5, smoothness = 0.5, weirdness = 0, branchShyness = 1, sourceX = 0.5, sourceY = 1 } = {}) => {
  const { width: w, height: h } = paper.view.size;
  // Collect segment shapes for union and smoothing
  const segments = [];
  const root = new paper.Point(sourceX * w, sourceY * h);

  // Helper —— random point inside mask path
  const randomInside = () => {
          let p;
      do {
        p = new paper.Point(Math.random() * w, Math.random() * h);
      } while (!mask.contains(p));
      return p;
  };

  const attractors = Array.from({ length: attractorCount }, randomInside);
  const branches = [{ point: root, parent: null, level: 0, children: 0 }];

  const baseSTEP = segmentLength;
  const ATTRACT_DIST = baseSTEP * 5;
  const KILL_DIST = baseSTEP + 2;

      const iterate = () => {
      if (!attractors.length) return true; // done

      let grown = false;
      // Map branchIdx → accumulated direction vector
      const influences = new Map();

    // 1. For each attractor find nearest branch within ATTRACT_DIST
    for (let i = attractors.length - 1; i >= 0; i -= 1) {
      const a = attractors[i];
      let closest = -1;
      let closestD = ATTRACT_DIST;
      branches.forEach((b, idx) => {
        const d = a.getDistance(b.point);
        if (d < KILL_DIST) closest = -2; // mark for removal
        else if (d < closestD) {
          closestD = d;
          closest = idx;
        }
      });
      if (closest === -2) {
        attractors.splice(i, 1);
      } else if (closest !== -1) {
        const dir = a.subtract(branches[closest].point).normalize();
        influences.set(
          closest,
          influences.has(closest) ? influences.get(closest).add(dir) : dir,
        );
      }
    }

    // 2. Create new branches in averaged directions
    influences.forEach((vec, idx) => {
      const from = branches[idx].point;
      const stepLen = baseSTEP * (1 + (Math.random() - 0.5) * weirdness);
      const to = from.add(vec.normalize(stepLen));
      const segDir = to.subtract(from);

      // Skip if new point is too close to existing branches (with shyness factor)
      const tooClose = branches.some((b, j) => {
        // Skip checking against the parent branch itself
        if (j === idx) return false;
        const branchRadius = Math.max(1, nodeRadius * Math.pow(tapering, b.level));
        const shyDistance = (branchRadius + stepLen) * branchShyness;
        return b.point.getDistance(to) < shyDistance;
      });
      if (tooClose) return;
      // Randomly omit branch based on weirdness
      if (Math.random() < weirdness * 0.3) return;

      // Check if the endpoint would be inside the mask
      if (!mask.contains(to)) return;

      // Enforce absolute angle limit relative to vertical
      const up = new paper.Point(0, -1);
      const segAngle = Math.acos(segDir.normalize().dot(up));
      if (!fillMode && segAngle > maxAbsAngle) return;

             const parentBranch = branches[idx];
       parentBranch.children += 1;
       const newLevel = parentBranch.level + 1;
       branches.push({ point: to, parent: parentBranch, level: newLevel, children: 0 });
       grown = true;
              const sizeFrom = Math.max(1, nodeRadius * Math.pow(tapering, parentBranch.level));
       const sizeTo = Math.max(1, nodeRadius * Math.pow(tapering, newLevel));

       // Draw node for parent only when it becomes a branching point (second child)
       if (parentBranch.children === 2 || parentBranch.level === 0) {
         drawDot(from.x, from.y, sizeFrom);
       }

       // Draw tapered quadrilateral segment
       const normal = segDir.normalize().rotate(90);
       const w1 = sizeFrom * 2 * segmentScale;
       const w2 = sizeTo * 2 * segmentScale;
       /* eslint-disable no-new */
       const segShape = new paper.Path({
        segments: [
          from.add(normal.multiply(w1 / 2)),
          from.subtract(normal.multiply(w1 / 2)),
          to.subtract(normal.multiply(w2 / 2)),
          to.add(normal.multiply(w2 / 2)),
        ],
        closed: true,
        fillColor: "red",
      });
      // collect for union/smoothing
      segments.push(segShape);
      // connector circle between segments to avoid gaps
      const connectorRadius = Math.max(w1, w2) * 0.5;
      const connector = new paper.Path.Circle({ center: from, radius: connectorRadius, fillColor: 'red' });
      segments.push(connector);
      /* eslint-enable no-new */


    });

    // Replenish attractors to keep density high for continued branching
    if (replenishAttractors) {
      while (attractors.length < attractorCount) attractors.push(randomInside());
    }

         if (!grown) { 
       // final node rendering
       drawNodes();
       // merge & smooth segments
       if (segments.length > 1) {
         let unified = segments[0];
         for (let i = 1; i < segments.length; i++) {
           const newUnified = unified.unite(segments[i]);
           unified.remove();
           segments[i].remove();
           unified = newUnified;
         }
         // 1. Simplify (reduce complexity)
         if (simplifyTolerance > 0) {
           unified.simplify(simplifyTolerance);
         }
         // 2. Smooth (geometric smoothing)
         if (smoothness > 0) {
           unified.smooth({ type: 'geometric', factor: smoothness });
         }
         unified.fillColor = "red";
       }
       return true; 
     }
    paper.view.update();
    return false;
  };

  const drawNodes = () => {
    branches.forEach(b => {
      if (b.children === 0) {
        const size = Math.max(1, nodeRadius * Math.pow(tapering, b.level));
        drawDot(b.point.x, b.point.y, size);
      }
    });
    paper.view.update();
  };

  if (animate) {
    paper.view.onFrame = () => {
      if (iterate()) { paper.view.onFrame = null; }
    };
  } else {
    let guard = 0;
    while (!iterate() && guard < 500) guard += 1; // hard cap iterations
    drawNodes();
    // merge & smooth segments
    if (segments.length > 1) {
      let unified = segments[0];
      for (let i = 1; i < segments.length; i++) {
        const newUnified = unified.unite(segments[i]);
        unified.remove();
        segments[i].remove();
        unified = newUnified;
      }
      // 1. Simplify (reduce complexity)
      if (simplifyTolerance > 0) {
        unified.simplify(simplifyTolerance);
      }
      // 2. Smooth (geometric smoothing)
      if (smoothness > 0) {
        unified.smooth({ type: 'geometric', factor: smoothness });
      }
      unified.fillColor = "red";
    }
  }
};

const GrowCoral = {
  mounted() {
    this.canvas = createCanvas(this.el);
    paper.setup(this.canvas);

    const defaultParams = {
      size: 0.3,
      strength: 0.1,
      attractorCount: 250,
      maxAbsAngle: Math.PI / 2,
      segmentLength: 13,
      nodeRadius: 5,
      tapering: 0.96,
      segmentScale: 0.7,
      fillMode: false,
      sourceX: 0.5,
      sourceY: 1,
    };
    this.renderCoral(defaultParams);

    this.handleEvent("update_coral", params => this.renderCoral(params));
    
    // Mouse event handlers for drawing custom mask
    this.isDrawing = false;
    this.currentPath = null;
    this.canvas.addEventListener('mousedown', e => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', e => this.handleMouseMove(e));
    document.addEventListener('mouseup', e => this.handleMouseUp(e));
  },

  renderCoral(params) {
    if (paper.project) paper.project.remove();
    
    // Update canvas size if provided
    if (params.canvasWidth && params.canvasHeight) {
      this.canvas.width = params.canvasWidth;
      this.canvas.height = params.canvasHeight;
      this.canvas.style.width = params.canvasWidth + "px";
      this.canvas.style.height = params.canvasHeight + "px";
    }
    
    paper.setup(this.canvas);
    const { size = 0.3, strength = 0.1, showMask = true, drawingMode = false, fillMode = false, sourceX = 0.5, sourceY = 1, customMaskPoints = [], canvasWidth, canvasHeight, ...grow } = params;
    
    this.drawingMode = drawingMode;
    
    let mask;
    if (customMaskPoints.length > 2) {
      // Use custom drawn mask
      mask = drawCustomMask(customMaskPoints);
    } else {
      // Use parametric mask
      mask = drawMask({ size, strength });
    }
    
    if (!showMask) {
      mask.fillColor.alpha = 0;
      mask.strokeColor = null;
    }
    growCoral({ mask, fillMode, sourceX, sourceY, ...grow });
  },

  handleCanvasClick(event) {
    console.log("Canvas clicked, drawingMode:", this.drawingMode);
    if (!this.drawingMode) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    console.log("Adding mask point:", x, y);
    this.pushEvent("add_mask_point", { x: x, y: y });
  },

  eventToPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return new paper.Point(event.clientX - rect.left, event.clientY - rect.top);
  },

  handleMouseDown(event) {
    if (!this.drawingMode) return;
    this.isDrawing = true;
    const pt = this.eventToPoint(event);
    this.currentPath = new paper.Path();
    this.currentPath.strokeColor = 'blue';
    this.currentPath.strokeWidth = 4;
    this.currentPath.opacity = 0.3;
    this.currentPath.add(pt);
  },

  handleMouseMove(event) {
    if (!this.isDrawing) return;
    const pt = this.eventToPoint(event);
    this.currentPath.add(pt);
    paper.view.update();
  },

  handleMouseUp(event) {
    if (!this.isDrawing) return;
    const pt = this.eventToPoint(event);
    this.currentPath.add(pt);
    this.isDrawing = false;

    if (this.currentPath.segments.length > 2) {
      this.currentPath.simplify(2);
      this.currentPath.closed = true;
      this.currentPath.fillColor = new paper.Color(0, 0, 1, 0.1);
      this.currentPath.strokeColor = null;

      const points = this.currentPath.segments.map(seg => [seg.point.x, seg.point.y]);
      this.pushEvent('set_custom_mask', { points: points });
    } else {
      this.currentPath.remove();
    }
    this.currentPath = null;
  },

  destroyed() {
    // Clean up the paper project and DOM element
    if (paper.project) paper.project.remove();
    if (this.canvas) this.canvas.remove();
  },
};

export default GrowCoral;
