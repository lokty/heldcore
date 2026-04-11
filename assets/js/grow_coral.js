import paper from "paper";

// --- Texture Configuration ---
const TEXTURE_SCALE = 5.0; // Controls texture size: 1 = original, 0.5 = smaller (more repetitions), 2 = larger
const TEXTURE_BLEND_MODE = 'color-dodge'; // Blend mode for texture: 'overlay', 'multiply', 'soft-light', 'hard-light', etc.

// --- Gradient helpers ---
const interp = (a,b,f) => a + f*(b-a);
const colorLerp = (c0,c1,f) => new paper.Color(
  interp(c0.red,c1.red,f),
  interp(c0.green,c1.green,f),
  interp(c0.blue,c1.blue,f),
  interp(c0.alpha,c1.alpha,f)
);
const makeStops = (arr, paperScope = paper) => arr.map(c=>new paperScope.Color(c));
const sampleStops = (stops,t)=>{
  const idx=t*(stops.length-1);
  const lo=Math.floor(idx);
  const hi=Math.min(stops.length-1,lo+1);
  const f=idx-lo;
  return lo===hi?stops[lo]:colorLerp(stops[lo],stops[hi],f);
};
// Render per-pixel raster inside mask using branch depth
function renderRaster(ctx,w,h,mask,branches,maxDepth,stops){
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) << 2;
      const pt = new paper.Point(x + 0.5, y + 0.5);
      if (!mask.contains(pt)) {
        img.data[i + 3] = 0;
        continue;
      }
      // find two nearest branches for smooth gradient
      let d1 = Infinity, d2 = Infinity;
      let b1 = branches[0], b2 = branches[0];
      for (const b of branches) {
        const d = b.point.getDistance(pt);
        if (d < d1) {
          d2 = d1; b2 = b1;
          d1 = d;  b1 = b;
        } else if (d < d2) {
          d2 = d;  b2 = b;
        }
      }
      // inverse-square weighting
      const w1 = 1 / Math.pow(d1 + 1, 2);
      const w2 = 1 / Math.pow(d2 + 1, 2);
      const t1 = maxDepth ? b1.level / maxDepth : 0;
      const t2 = maxDepth ? b2.level / maxDepth : 0;
      const t = (t1 * w1 + t2 * w2) / (w1 + w2);
      const col = sampleStops(stops, t);
      img.data[i]     = (col.red   * 255) | 0;
      img.data[i + 1] = (col.green * 255) | 0;
      img.data[i + 2] = (col.blue  * 255) | 0;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// Utility: create a full-size canvas inside the given parent element
const createCanvas = (parent, explicitWidth = null, explicitHeight = null) => {
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  parent.appendChild(canvas);

  // Set internal resolution so paper.js has the right dimensions
  // Use explicit dimensions if provided, otherwise use parent's computed dimensions
  const rect = parent.getBoundingClientRect();
  canvas.width = explicitWidth || Math.max(rect.width, parent.clientWidth, 48);
  canvas.height = explicitHeight || Math.max(rect.height, parent.clientHeight, 48);

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
const drawMask = ({ size = 0.3, strength = 0.1 }, paperScope = paper) => {
  const { width: w, height: h } = paperScope.view.size;
  
  // Scale mask to use more of the canvas space
  // When size = 1, use the full diagonal; when size = 0.1, use a smaller portion
  const maxDimension = Math.sqrt(w * w + h * h); // Diagonal length
  const minDimension = Math.min(w, h) - 20;
  
  // Interpolate between min dimension and max dimension based on size
  const diameter = minDimension + (maxDimension - minDimension) * size;
  const baseRadius = diameter / 2;
  
  // Center the mask but keep bottom touching the canvas bottom
  const center = new paperScope.Point(w / 2, h - Math.min(baseRadius, h * 0.8));

  // Build a wavy circle using random radial offsets
  const segments = Math.max(12, Math.round(32 * Math.max(size, 0.3))); // More segments for larger masks
  const path = new paperScope.Path({ closed: true, fillColor: new paperScope.Color(0, 0, 1, 0.1) });
  for (let i = 0; i < segments; i += 1) {
    const theta = (Math.PI * 2 * i) / segments;
    const offset = (Math.random() * 2 - 1) * baseRadius * strength;
    const r = baseRadius + offset;
    
    // Ensure the mask doesn't go outside canvas bounds
    const x = Math.max(0, Math.min(w, center.x + r * Math.cos(theta)));
    const y = Math.max(0, Math.min(h, center.y + r * Math.sin(theta)));
    
    path.add(new paperScope.Point(x, y));
  }
  path.smooth();

  
  paperScope.view.update();
  return path;
};

// Draw custom mask from user-drawn points
const drawCustomMask = (points, paperScope = paper) => {
  const path = new paperScope.Path({ 
    closed: true, 
    fillColor: new paperScope.Color(0, 0, 1, 0.1),
    strokeColor: new paperScope.Color(0, 0, 1, 0.3),
    strokeWidth: 2
  });
  
  points.forEach(([x, y]) => path.add(new paperScope.Point(x, y)));
  path.smooth();
  
  paperScope.view.update();
  return path;
};

/*
 * Grow coral using a lightweight Space-Colonization algorithm.
 *  – mask          : paper.Path that defines the growth boundary
 *  – animate       : if true, iterate on every frame
 *  – attractorCount: number of seed (attractor) points inside the mask
 */
const growCoral = ({ mask, animate = true, attractorCount = 250, maxAbsAngle = Math.PI / 2, fillMode = false, segmentLength = 13, nodeRadius = 5, tapering = 0.96, segmentScale = 0.7, replenishAttractors = true, simplifyTolerance = 5, smoothness = 0.5, weirdness = 0, branchShyness = 1, sourceX = 0.5, sourceY = 1, gradientColors = ["black","red","#fff"], showSkeleton = true, vectorMask = true, texture = false, textureStrength = 1, textureImage = null, paperScope = paper, onFinish = null } = {}) => {
  const { width: w, height: h } = paperScope.view.size;
  
  // Create off-screen canvas for incremental mask painting (optimization #1)
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = w;
  maskCanvas.height = h;
  const maskCtx = maskCanvas.getContext("2d");
  maskCtx.fillStyle = "white";
  
  // Inside-coral boolean map — 0 = outside, 1 = inside.
  // Only read when vectorMask is false; kept allocated unconditionally for simplicity.
  const branchIdBuffer = new Uint8Array(w * h);
  
  // Collect segment shapes for union and smoothing
  const segments = [];
  // Use branches with creationTime as skeleton
  let creationCounter = 1; // root gets time 0
  let maxRootLength = 0; // track maximum branch length from root
  let smoothedMaskPath = null; // Store smoothed vector mask for vectorMask mode
  
  // Spatial grid for fast attractor-to-branch lookup (optimization #4)
  const GRID_SIZE = 10; // Reduced to 10x10 grid for better coverage
  const cellWidth = w / GRID_SIZE;
  const cellHeight = h / GRID_SIZE;
  const spatialGrid = Array.from({ length: GRID_SIZE * GRID_SIZE }, () => []);
  
  const getCellIndex = (x, y) => {
    const gridX = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(x / cellWidth)));
    const gridY = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(y / cellHeight)));
    return gridY * GRID_SIZE + gridX;
  };
  
  const addBranchToGrid = (branchIndex, point) => {
    const cellIndex = getCellIndex(point.x, point.y);
    spatialGrid[cellIndex].push(branchIndex);
  };
  
  const getNearbyBranches = (point, radius) => {
    const nearbyBranches = [];
    const minGridX = Math.max(0, Math.floor((point.x - radius) / cellWidth));
    const maxGridX = Math.min(GRID_SIZE - 1, Math.floor((point.x + radius) / cellWidth));
    const minGridY = Math.max(0, Math.floor((point.y - radius) / cellHeight));
    const maxGridY = Math.min(GRID_SIZE - 1, Math.floor((point.y + radius) / cellHeight));
    
    for (let gridY = minGridY; gridY <= maxGridY; gridY++) {
      for (let gridX = minGridX; gridX <= maxGridX; gridX++) {
        const cellIndex = gridY * GRID_SIZE + gridX;
        nearbyBranches.push(...spatialGrid[cellIndex]);
      }
    }
    return nearbyBranches;
  };

  let root = new paperScope.Point(sourceX * w, sourceY * h);
  // The mask's random waviness can occasionally pull inward enough to
  // leave the root point just outside the mask. When that happens the
  // first growth step lands outside too and the algorithm terminates
  // immediately, leaving only the root dot. Snap the root inward until
  // it's safely inside the mask.
  if (!mask.contains(root)) {
    const target = new paperScope.Point(w / 2, h / 2);
    const dir = target.subtract(root);
    if (dir.length > 0) {
      const stepVec = dir.normalize().multiply(2);
      const maxSteps = Math.ceil(dir.length / 2) + 5;
      let probe = root;
      for (let k = 0; k < maxSteps; k++) {
        probe = probe.add(stepVec);
        if (mask.contains(probe)) {
          root = probe;
          break;
        }
      }
    }
  }
  // Initialize branches with root skeleton node
  const branches = [{ point: root, parent: null, level: 0, children: 0, creationTime: 0, lengthFromRoot: 0 }];
  // Add root branch to spatial grid
  addBranchToGrid(0, root);


  // Helper —— random point inside mask path
  const randomInside = () => {
          let p;
      do {
        p = new paperScope.Point(Math.random() * w, Math.random() * h);
      } while (!mask.contains(p));
      return p;
  };

  const attractors = Array.from({ length: attractorCount }, randomInside);

  const baseSTEP = segmentLength;
  const ATTRACT_DIST = baseSTEP * 5;
  const KILL_DIST = baseSTEP + 2;


  // Fast rasterization helpers — avoid paper.js exportSVG and per-pixel contains().
  // Branch paths never need per-pixel branch IDs: renderFastGradient only checks
  // branchIdBuffer[i] !== 0 (inside-coral test) and then uses the spatial grid to
  // find nearby branches. So in raster mode we only mark insideness; in vectorMask
  // mode we fill maskCanvas (used as a compositing mask during animation) and skip
  // the buffer entirely.
  const paintCircle = (cx, cy, r) => {
    if (vectorMask) {
      maskCtx.beginPath();
      maskCtx.arc(cx, cy, r, 0, Math.PI * 2);
      maskCtx.fill();
      return;
    }
    const startX = Math.max(0, Math.floor(cx - r));
    const endX = Math.min(w - 1, Math.ceil(cx + r));
    const startY = Math.max(0, Math.floor(cy - r));
    const endY = Math.min(h - 1, Math.ceil(cy + r));
    const r2 = r * r;
    for (let y = startY; y <= endY; y++) {
      const dy = y + 0.5 - cy;
      const dy2 = dy * dy;
      const rowStart = y * w;
      for (let x = startX; x <= endX; x++) {
        const dx = x + 0.5 - cx;
        if (dx * dx + dy2 <= r2) {
          branchIdBuffer[rowStart + x] = 1;
        }
      }
    }
  };

  const paintQuad = (p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y) => {
    if (vectorMask) {
      maskCtx.beginPath();
      maskCtx.moveTo(p0x, p0y);
      maskCtx.lineTo(p1x, p1y);
      maskCtx.lineTo(p2x, p2y);
      maskCtx.lineTo(p3x, p3y);
      maskCtx.closePath();
      maskCtx.fill();
      return;
    }
    const minX = Math.max(0, Math.floor(Math.min(p0x, p1x, p2x, p3x)));
    const maxX = Math.min(w - 1, Math.ceil(Math.max(p0x, p1x, p2x, p3x)));
    const minY = Math.max(0, Math.floor(Math.min(p0y, p1y, p2y, p3y)));
    const maxY = Math.min(h - 1, Math.ceil(Math.max(p0y, p1y, p2y, p3y)));
    // Convex-polygon test via consistent-sign cross products on each edge.
    const e01x = p1x - p0x, e01y = p1y - p0y;
    const e12x = p2x - p1x, e12y = p2y - p1y;
    const e23x = p3x - p2x, e23y = p3y - p2y;
    const e30x = p0x - p3x, e30y = p0y - p3y;
    for (let y = minY; y <= maxY; y++) {
      const py = y + 0.5;
      const rowStart = y * w;
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const c0 = e01x * (py - p0y) - e01y * (px - p0x);
        const c1 = e12x * (py - p1y) - e12y * (px - p1x);
        const c2 = e23x * (py - p2y) - e23y * (px - p2x);
        const c3 = e30x * (py - p3y) - e30y * (px - p3x);
        if ((c0 >= 0 && c1 >= 0 && c2 >= 0 && c3 >= 0) ||
            (c0 <= 0 && c1 <= 0 && c2 <= 0 && c3 <= 0)) {
          branchIdBuffer[rowStart + x] = 1;
        }
      }
    }
  };

      const iterate = () => {
      if (!attractors.length) return true; // done

      let grown = false;
      // Map branchIdx → accumulated direction vector
      const influences = new Map();

    // 1. For each attractor find nearest branch within ATTRACT_DIST (using spatial grid)
    // Process attractors in batches to avoid frame drops
    const BATCH_SIZE = Math.min(100, attractors.length); // Process up to 100 per frame
    let processed = 0;
    
    for (let i = attractors.length - 1; i >= 0 && processed < BATCH_SIZE; i -= 1) {
      processed++;
      const a = attractors[i];
      let closest = -1;
      let closestD = ATTRACT_DIST;
      
      // Use spatial grid to only check nearby branches (optimization #4)
      const nearbyBranchIndices = getNearbyBranches(a, ATTRACT_DIST);
      
      // Fallback: if spatial grid finds no branches, check all branches (safety net)
      const branchesToCheck = nearbyBranchIndices.length > 0 ? nearbyBranchIndices : Array.from({ length: branches.length }, (_, i) => i);
      
      for (const idx of branchesToCheck) {
        if (idx >= branches.length) continue; // Safety check
        const b = branches[idx];
        const d = a.getDistance(b.point);
        if (d < KILL_DIST) {
          closest = -2; // mark for removal
          break; // No need to check further if we're killing
        } else if (d < closestD) {
          closestD = d;
          closest = idx;
        }
      }
      
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
    let blockedCount = 0;
    let createdCount = 0;

    influences.forEach((vec, idx) => {
      const from = branches[idx].point;
      const stepLen = baseSTEP * (1 + (Math.random() - 0.5) * weirdness);
      const to = from.add(vec.normalize(stepLen));
      const segDir = to.subtract(from);

      // Skip if new point is too close to existing branches (with shyness factor)
      // Use spatial grid to only check nearby branches for efficiency
      const maxShyDistance = (nodeRadius + stepLen) * branchShyness;
      const nearbyBranchIndices = getNearbyBranches(to, maxShyDistance);
      
      const tooClose = nearbyBranchIndices.some(j => {
        // Skip checking against the parent branch and self
        if (j === idx || j >= branches.length) return false;
        // Also skip the direct parent to allow natural branch continuation
        const b = branches[j];
        if (branches[idx].parent && b === branches[idx].parent) return false;
        const branchRadius = Math.max(1, nodeRadius * Math.pow(tapering, b.level));
        // Apply shyness only to the branch radius, not the step length
        const shyDistance = branchRadius * branchShyness + stepLen * 0.5;
        const distance = b.point.getDistance(to);
        return distance < shyDistance;
      });
      if (tooClose) {
        blockedCount++;
        return;
      }
      // Randomly omit branch based on weirdness
      if (Math.random() < weirdness * 0.3) return;

      // Check if the endpoint would be inside the mask
      if (!mask.contains(to)) return;

      // Enforce absolute angle limit relative to vertical
      const up = new paperScope.Point(0, -1);
      const segAngle = Math.acos(segDir.normalize().dot(up));
      if (!fillMode && segAngle > maxAbsAngle) return;

      const parentBranch = branches[idx];
      parentBranch.children += 1;
      const newLevel = parentBranch.level + 1;
      const lengthFromRoot = parentBranch.lengthFromRoot + stepLen;
      const newBranch = { point: to, parent: parentBranch, level: newLevel, children: 0, creationTime: creationCounter++, lengthFromRoot };
      maxRootLength = Math.max(maxRootLength, lengthFromRoot);
      branches.push(newBranch);
      addBranchToGrid(branches.length - 1, to);
      createdCount++;
      grown = true;
      const sizeFrom = Math.max(1, nodeRadius * Math.pow(tapering, parentBranch.level));
      const sizeTo = Math.max(1, nodeRadius * Math.pow(tapering, newLevel));

      // Compute the segment's orthogonal cross-section once, using plain math
      // to avoid paper.js Point allocations on the hot path.
      const segDx = to.x - from.x;
      const segDy = to.y - from.y;
      const segLen = Math.sqrt(segDx * segDx + segDy * segDy) || 1;
      const nx = -segDy / segLen;
      const ny = segDx / segLen;
      const halfW1 = sizeFrom * segmentScale;
      const halfW2 = sizeTo * segmentScale;
      const q0x = from.x + nx * halfW1, q0y = from.y + ny * halfW1;
      const q1x = from.x - nx * halfW1, q1y = from.y - ny * halfW1;
      const q2x = to.x - nx * halfW2,   q2y = to.y - ny * halfW2;
      const q3x = to.x + nx * halfW2,   q3y = to.y + ny * halfW2;
      const connectorRadius = Math.max(halfW1, halfW2);
      const needJunctionCap = parentBranch.children === 2 || parentBranch.level === 0;

      // Junction cap
      if (needJunctionCap) {
        paintCircle(from.x, from.y, sizeFrom);
      }
      // Segment quad
      paintQuad(q0x, q0y, q1x, q1y, q2x, q2y, q3x, q3y);
      // Connector circle (rounded cap at the parent end of the segment)
      paintCircle(from.x, from.y, connectorRadius);

      // Paper.js path objects are only needed when vectorMask is true — they feed
      // the final hierarchical unite and smoothing pass. Skip them otherwise.
      if (vectorMask) {
        if (needJunctionCap) {
          segments.push(new paperScope.Path.Circle({
            center: from,
            radius: sizeFrom,
            fillColor: new paperScope.Color(0, 0, 0, 0),
          }));
        }
        segments.push(new paperScope.Path({
          segments: [
            new paperScope.Point(q0x, q0y),
            new paperScope.Point(q1x, q1y),
            new paperScope.Point(q2x, q2y),
            new paperScope.Point(q3x, q3y),
          ],
          closed: true,
          fillColor: new paperScope.Color(0, 0, 0, 0),
        }));
        segments.push(new paperScope.Path.Circle({
          center: from,
          radius: connectorRadius,
          fillColor: new paperScope.Color(0, 0, 0, 0),
        }));
      }
    });



    // // Replenish attractors to keep density high for continued branching
    // if (replenishAttractors) {
    //   while (attractors.length < attractorCount) attractors.push(randomInside());
    // }



    if (!grown) {
      console.log("=== FINAL PROCESSING BENCHMARKS ===");
      
      // Benchmark: Final node rendering
      const nodesStart = performance.now();
      drawNodes();
      const nodesEnd = performance.now();
      console.log(`Final nodes: ${(nodesEnd - nodesStart).toFixed(2)}ms`);
      
      // Skip expensive unite operations for pixel-only rendering — the mask is
      // built incrementally via paintCircle/paintQuad. Unite only when vectorMask
      // is enabled (we need a unified path to smooth).
      const SKIP_UNITE = !vectorMask;
      
      if (!SKIP_UNITE && segments.length > 1) {
        // Hierarchical merge for O(n log n) performance instead of O(n²)
        // Future optimization: Build united path incrementally during growth
        const uniteStart = performance.now();
        
        // Create a queue of segments to merge
        const queue = segments.slice();
        
        // Optional: Simplify segments before merging for better performance
        if (simplifyTolerance > 0 && queue.length > 50) {
          console.log(`  Pre-simplifying ${queue.length} segments...`);
          queue.forEach(seg => {
            if (seg.segments.length > 1) {
              seg.simplify(simplifyTolerance * 0.5); // Half tolerance for pre-simplify
            }
          });
        }
        
        // Merge pairs in parallel-like fashion
        let mergeRounds = 0;
        while (queue.length > 1) {
          const nextQueue = [];
          const groupSize = mergeRounds === 0 && queue.length > 100 ? 4 : 2;
          const targetCount = Math.ceil(queue.length / groupSize);
          
          console.log(`  Merge round ${++mergeRounds}: ${queue.length} → ~${targetCount} segments (groups of ${groupSize})`);
          
          for (let i = 0; i < queue.length; i += groupSize) {
            if (i + groupSize - 1 < queue.length) {
              // Merge group
              let merged = queue[i];
              for (let j = 1; j < groupSize; j++) {
                const temp = merged.unite(queue[i + j]);
                merged.remove();
                queue[i + j].remove();
                merged = temp;
              }
              nextQueue.push(merged);
            } else if (i + 1 < queue.length) {
              // Partial group - merge what we have
              let merged = queue[i];
              for (let j = i + 1; j < queue.length; j++) {
                const temp = merged.unite(queue[j]);
                merged.remove();
                queue[j].remove();
                merged = temp;
              }
              nextQueue.push(merged);
              break;
            } else {
              // Single element left
              nextQueue.push(queue[i]);
            }
          }
          
          queue.length = 0;
          queue.push(...nextQueue);
        }
        
        let unified = queue[0];
        const uniteEnd = performance.now();
        console.log(`Hierarchical unite ${segments.length} segments: ${(uniteEnd - uniteStart).toFixed(2)}ms`);
        
        // Simplify before smoothing for better performance
        if (simplifyTolerance > 0) {
          const simplifyStart = performance.now();
          unified.simplify(simplifyTolerance);
          const simplifyEnd = performance.now();
          console.log(`Simplify vector mask (tolerance ${simplifyTolerance}): ${(simplifyEnd - simplifyStart).toFixed(2)}ms`);
        }
        
        // Apply smoothing to round corners and smooth curves
        if (smoothness > 0) {
          const smoothStart = performance.now();
          unified.smooth({ type: 'geometric', factor: smoothness });
          const smoothEnd = performance.now();
          console.log(`Smooth vector mask (factor ${smoothness}): ${(smoothEnd - smoothStart).toFixed(2)}ms`);
        }
        
        // Store the smoothed path for vector mask rendering
        smoothedMaskPath = unified;
        smoothedMaskPath.visible = false; // Don't show in Paper.js view
      } else {
        if (vectorMask && segments.length === 1) {
          // For single segment in vector mode, still apply smoothing
          smoothedMaskPath = segments[0];
          if (smoothness > 0) {
            const smoothStart = performance.now();
            smoothedMaskPath.smooth({ type: 'geometric', factor: smoothness });
            const smoothEnd = performance.now();
            console.log(`Smooth single segment (factor ${smoothness}): ${(smoothEnd - smoothStart).toFixed(2)}ms`);
          }
          smoothedMaskPath.visible = false;
        } else {
          console.log(`Unite: 0.00ms (${vectorMask ? 'single segment' : 'OPTIMIZED - skipped for pixel rendering'})`);
          console.log(`Simplify: 0.00ms (skipped)`);
          console.log(`Smooth: 0.00ms (skipped)`); 
          console.log(`Apply gradient: 0.00ms (skipped)`);
          console.log(`Total final processing: ${(nodesEnd - nodesStart).toFixed(2)}ms${!vectorMask ? ' (was 952ms)' : ''}`);
        }
      }
      return true; 
    }
    paperScope.view.update();
    return false;
  };

  // drawNodes gets called from two places: inside iterate() when growth finishes
  // naturally (needed before the unite step so tip caps are in smoothedMaskPath),
  // and from the outer finish block (needed when the frame-limit path aborts
  // iterate before !grown runs). The flag collapses them so we never double-paint.
  let nodesDrawn = false;
  const drawNodes = () => {
    if (nodesDrawn) return;
    nodesDrawn = true;
    branches.forEach(b => {
      if (b.children === 0) {
        const size = Math.max(1, nodeRadius * Math.pow(tapering, b.level));
        paintCircle(b.point.x, b.point.y, size);
        if (vectorMask) {
          segments.push(new paperScope.Path.Circle({
            center: b.point,
            radius: size,
            fillColor: new paperScope.Color(0, 0, 0, 0),
          }));
        }
      }
    });
    paperScope.view.update();
  };

  // Create lower resolution canvas for faster gradient rendering
  const SCALE = 1; // Render at 1/3 resolution for good quality/speed balance
  const lowResCanvas = document.createElement("canvas");
  lowResCanvas.width = Math.ceil(w / SCALE);
  lowResCanvas.height = Math.ceil(h / SCALE);
  const lowResCtx = lowResCanvas.getContext("2d");
  
  // Pre-calculate distance weight lookup table for common distances
  const MAX_DIST = 150; // Increased to cover more cases
  const distWeights = new Float32Array(MAX_DIST);
  for (let d = 0; d < MAX_DIST; d++) {
    distWeights[d] = 1 / ((d + 1) * (d + 1));
  }

  // Fast gradient rendering using skeletal distance (optimized with lower resolution)
  const renderFastGradient = (ctx, branches, maxLength, stops, vectorMask) => {
    const lw = lowResCanvas.width;
    const lh = lowResCanvas.height;

    // If vector masking enabled, use Canvas gradient + mask composite
    if (vectorMask) {
      // Draw full-screen gradient
      ctx.save();
      const grad = ctx.createLinearGradient(root.x, h, root.x, 0);
      gradientColors.forEach((c, i) => grad.addColorStop(i/(gradientColors.length-1), c));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      
      // Use smoothed vector mask if available, otherwise fall back to pixel mask
      ctx.globalCompositeOperation = 'destination-in';
      
      if (smoothedMaskPath) {
        // Draw the smoothed Paper.js path as a mask
        const pathData = smoothedMaskPath.exportSVG({ asString: true });
        const svgPath = pathData.match(/d="([^"]+)"/)?.[1] || "";
        const path2d = new Path2D(svgPath);
        ctx.fillStyle = 'white';
        ctx.fill(path2d);
      } else {
        // Fall back to pixel mask
        ctx.drawImage(maskCanvas, 0, 0);
      }
      
      ctx.restore();
      return;
    }

    const imgData = lowResCtx.createImageData(lw, lh);
    
    // Pre-compute branch data for faster lookup
    const branchLengths = branches.map(b => maxLength ? b.lengthFromRoot / maxLength : 0);
    const branchXs = branches.map(b => b.point.x);
    const branchYs = branches.map(b => b.point.y);
    
    // Process in blocks for better cache locality
    const BLOCK = 4; // Process 4x4 blocks for better efficiency
    for (let by = 0; by < lh; by += BLOCK) {
      for (let bx = 0; bx < lw; bx += BLOCK) {
        // Check if any pixel in block is inside mask
        let blockHasContent = false;
        for (let dy = 0; dy < BLOCK && by + dy < lh && !blockHasContent; dy++) {
          for (let dx = 0; dx < BLOCK && bx + dx < lw && !blockHasContent; dx++) {
            const checkX = (bx + dx) * SCALE + SCALE / 2;
            const checkY = (by + dy) * SCALE + SCALE / 2;
            const checkIdx = Math.floor(checkY) * w + Math.floor(checkX);
            if (checkIdx < branchIdBuffer.length && branchIdBuffer[checkIdx] !== 0) {
              blockHasContent = true;
            }
          }
        }
        
        if (!blockHasContent) continue; // Skip empty blocks
        
        // Process pixels in block
        for (let dy = 0; dy < BLOCK && by + dy < lh; dy++) {
          for (let dx = 0; dx < BLOCK && bx + dx < lw; dx++) {
            const lx = bx + dx;
            const ly = by + dy;
            const x = lx * SCALE + SCALE / 2;
            const y = ly * SCALE + SCALE / 2;
            
            const bufferIdx = Math.floor(y) * w + Math.floor(x);
            if (bufferIdx < branchIdBuffer.length && branchIdBuffer[bufferIdx] !== 0) {
              // Use spatial grid to find nearby branches (aggressive optimization)
              const searchRadius = 60; // Further reduced for speed
              const pt = new paperScope.Point(x, y); // Still needed for getNearbyBranches
              const nearbyIndices = getNearbyBranches(pt, searchRadius);
              
              // If no nearby branches found, use even smaller fallback
              const branchesToCheck = nearbyIndices.length > 0 ? nearbyIndices : 
                Array.from({ length: Math.min(branches.length, 20) }, (_, i) => i); // Minimal fallback
              
              let d1 = Infinity, d2 = Infinity, b1 = 0, b2 = 0;
              for (const idx of branchesToCheck) {
                if (idx >= branches.length) continue;
                // Fast distance calculation using cached coordinates
                const dx = branchXs[idx] - x;
                const dy = branchYs[idx] - y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < d1) { d2 = d1; b2 = b1; d1 = d; b1 = idx; }
                else if (d < d2) { d2 = d; b2 = idx; }
              }
              
              const w1 = d1 < MAX_DIST ? distWeights[Math.floor(d1)] : 1 / ((d1 + 1) * (d1 + 1));
              const w2 = d2 < MAX_DIST ? distWeights[Math.floor(d2)] : 1 / ((d2 + 1) * (d2 + 1));
              const t = (branchLengths[b1] * w1 + branchLengths[b2] * w2) / (w1 + w2);
              const col = sampleStops(stops, t);
              
              const i = (ly * lw + lx) * 4;
              imgData.data[i]     = (col.red   * 255) | 0;
              imgData.data[i + 1] = (col.green * 255) | 0;
              imgData.data[i + 2] = (col.blue  * 255) | 0;
              imgData.data[i + 3] = 255;
            }
          }
        }
      }
    }
    
    // Put low-res image and upscale with smoothing
    lowResCtx.putImageData(imgData, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(lowResCanvas, 0, 0, w, h);
    ctx.restore();
  };

  // Highlight pass: render the branch skeleton (lines from each branch to its
  // parent + dots at every node) in HIGHLIGHT_COLOR, soft-blur it, scatter noise
  // across opaque pixels, then composite back onto the coral with source-atop so
  // the effect stays clipped to the silhouette. Runs after the gradient render
  // and before the texture pass — this preserves the gradient base and overlays
  // a glowing skeletal pattern that follows the branching structure.
  const HIGHLIGHT_COLOR = '#ffa074';
  const HIGHLIGHT_BLUR_PX = 1.5;
  const HIGHLIGHT_NOISE_AMP = 75;
  const HIGHLIGHT_ALPHA = 0.85;
  const HIGHLIGHT_LINE_WIDTH = 1.5;
  const HIGHLIGHT_NODE_RADIUS = 1.5;
  const applyHighlight = () => {
    if (branches.length < 2) return;
    const highlightStart = performance.now();
    const canvas = paperScope.view.element;
    const ctx = canvas.getContext('2d');

    // Draw skeleton onto a temp canvas using plain canvas2D — no paper.js needed.
    const skelCanvas = document.createElement('canvas');
    skelCanvas.width = canvas.width;
    skelCanvas.height = canvas.height;
    const skelCtx = skelCanvas.getContext('2d');
    skelCtx.strokeStyle = HIGHLIGHT_COLOR;
    skelCtx.fillStyle = HIGHLIGHT_COLOR;
    skelCtx.lineWidth = HIGHLIGHT_LINE_WIDTH;
    skelCtx.lineCap = 'round';
    skelCtx.lineJoin = 'round';

    skelCtx.beginPath();
    for (const b of branches) {
      if (b.parent) {
        skelCtx.moveTo(b.parent.point.x, b.parent.point.y);
        skelCtx.lineTo(b.point.x, b.point.y);
      }
    }
    skelCtx.stroke();

    for (const b of branches) {
      skelCtx.beginPath();
      skelCtx.arc(b.point.x, b.point.y, HIGHLIGHT_NODE_RADIUS, 0, Math.PI * 2);
      skelCtx.fill();
    }

    // Blur into a second canvas (canvas2D's `filter` only applies to draws, not
    // in-place to existing pixels — so we need a fresh target).
    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = canvas.width;
    blurCanvas.height = canvas.height;
    const blurCtx = blurCanvas.getContext('2d');
    blurCtx.filter = `blur(${HIGHLIGHT_BLUR_PX}px)`;
    blurCtx.drawImage(skelCanvas, 0, 0);
    blurCtx.filter = 'none';

    // Scatter per-pixel noise on opaque pixels only.
    const imgData = blurCtx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const n = (Math.random() - 0.5) * HIGHLIGHT_NOISE_AMP;
      const r = data[i] + n;
      const g = data[i + 1] + n;
      const b = data[i + 2] + n;
      data[i]     = r < 0 ? 0 : r > 255 ? 255 : r;
      data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
      data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
    blurCtx.putImageData(imgData, 0, 0);

    // Composite onto the main canvas, clipped to the existing coral pixels so the
    // soft-blur halo doesn't bleed past the original silhouette.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = HIGHLIGHT_ALPHA;
    ctx.drawImage(blurCanvas, 0, 0);
    ctx.restore();
    console.log(`Highlight apply: ${(performance.now() - highlightStart).toFixed(2)}ms`);
  };

  // Measure the coral's painted surface area in pixels. In raster mode we sum
  // branchIdBuffer; in vector mode we read smoothedMaskPath.area (Paper.js
  // computes it geometrically from the unioned path). Returns a normalized
  // coverage ratio of the canvas (0..1) plus the raw pixel count.
  const measureSurface = () => {
    const totalPixels = w * h || 1;
    let pixels = 0;
    if (vectorMask) {
      pixels = smoothedMaskPath ? Math.abs(smoothedMaskPath.area) : 0;
    } else {
      for (let i = 0; i < branchIdBuffer.length; i++) {
        if (branchIdBuffer[i]) pixels++;
      }
    }
    return { pixels, ratio: pixels / totalPixels, branchCount: branches.length };
  };

  // Composite the texture onto the coral shape. Extracted so both animate and
  // sync paths share one implementation (and one timing path).
  const applyTexture = () => {
    if (!(texture && textureStrength > 0 && textureImage)) return;
    // Guard against an Image object whose network load failed after the flag was
    // set: on prod the noise asset can 404 and drawImage() throws
    // "Passed-in image is broken". Without this the error bubbles into Paper.js's
    // onFrame handler, which kills subsequent frames.
    if (!textureImage.complete || !textureImage.naturalWidth) return;
    const textureStart = performance.now();
    const canvas = paperScope.view.element;
    const ctx = canvas.getContext('2d');

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.drawImage(canvas, 0, 0);

    tempCtx.save();
    tempCtx.globalAlpha = textureStrength;
    tempCtx.globalCompositeOperation = TEXTURE_BLEND_MODE;
    if (TEXTURE_SCALE <= 1) {
      const pattern = tempCtx.createPattern(textureImage, 'repeat');
      const matrix = new DOMMatrix().scale(TEXTURE_SCALE, TEXTURE_SCALE);
      pattern.setTransform(matrix);
      tempCtx.fillStyle = pattern;
      tempCtx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      tempCtx.drawImage(textureImage, 0, 0, canvas.width * TEXTURE_SCALE, canvas.height * TEXTURE_SCALE);
    }
    tempCtx.restore();

    // Reset Paper.js's devicePixelRatio transform so the backing-store-sized
    // tempCanvas maps 1:1 to ctx (fixes HiDPI misalignment).
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.restore();
    console.log(`Texture apply: ${(performance.now() - textureStart).toFixed(2)}ms`);
  };

  if (animate) {
    let raster = null;
    let frameCount = 0;
    let totalIterationTime = 0;
    let totalMaskTime = 0;
    let totalRenderTime = 0;
    const MAX_ITERATIONS = 100; // Reasonable limit with our optimizations
    
    paperScope.view.onFrame = () => {
      frameCount++;
      
      // Benchmark: Growth iteration
      const iterStart = performance.now();
      const finished = iterate() || frameCount >= MAX_ITERATIONS;
      const iterEnd = performance.now();
      totalIterationTime += (iterEnd - iterStart);
      
      // Render gradient on each frame (animated growth) - OPTIMIZED
      // `branches.length > 1` is the growth signal in both vectorMask and raster
      // modes; the paper-level `segments` array is now only populated in vector mode.
      if (branches.length > 1) {
        // Remove old raster if exists
        if (raster) raster.remove();
        
        // Benchmark: Fast mask building (no expensive operations!)
        maskStart = performance.now();
        // Mask is already built incrementally by paintSegmentToMask calls
        maskEnd = performance.now();
        totalMaskTime += (maskEnd - maskStart);
        
        // Create new raster
        raster = new paperScope.Raster({
          size: paperScope.view.size,
          position: paperScope.view.center
        });
        
        // Benchmark: Fast gradient rendering
        renderStart = performance.now();
        const maxDepth = maxRootLength;
        const stops = makeStops(gradientColors, paperScope);
        const ctx = raster.getContext('2d');
        renderFastGradient(ctx, branches, maxDepth, stops, vectorMask);
        renderEnd = performance.now();
        totalRenderTime += (renderEnd - renderStart);
      }
      
      if (finished) { 
        paperScope.view.onFrame = null;
        
        // Benchmark: Drawing tip nodes
        const nodesStart = performance.now();
        drawNodes();
        const nodesEnd = performance.now();
        console.log(`Tip nodes drawing: ${(nodesEnd - nodesStart).toFixed(2)}ms`);
        
        // Print performance results
        console.log("=== ANIMATED GROWTH PERFORMANCE ===");
        console.log(`Total frames: ${frameCount}`);
        console.log(`Growth iteration: ${totalIterationTime.toFixed(2)}ms (avg: ${(totalIterationTime/frameCount).toFixed(2)}ms/frame)`);
        console.log(`Mask building: ${totalMaskTime.toFixed(2)}ms (avg: ${(totalMaskTime/frameCount).toFixed(2)}ms/frame)`);
        console.log(`Gradient rendering: ${totalRenderTime.toFixed(2)}ms (avg: ${(totalRenderTime/frameCount).toFixed(2)}ms/frame)`);
        const tipNodesTime = (nodesEnd - nodesStart);
        console.log(`Total per frame: ${((totalIterationTime + totalMaskTime + totalRenderTime)/frameCount).toFixed(2)}ms/frame`);
        console.log(`Tip nodes (final): ${tipNodesTime.toFixed(2)}ms`);

        // Benchmark: Skeleton drawing
        const skeletonStart = performance.now();
        if (showSkeleton) {
          branches.forEach(b => {
            new paperScope.Path.Circle({ center: b.point, radius: 2, strokeColor: 'cyan', strokeWidth: 1, fillColor: null });
            if (b.parent) {
              new paperScope.Path.Line({ from: b.point, to: b.parent.point, strokeColor: 'cyan', strokeWidth: 0.5 });
            }
          });
        }
        const skeletonEnd = performance.now();
        console.log(`Skeleton drawing: ${(skeletonEnd - skeletonStart).toFixed(2)}ms`);
        
        paperScope.view.update();

        // Give the caller a chance to reject a too-small coral before we spend
        // time on the highlight + texture passes. If onFinish returns false the
        // caller is responsible for kicking off another render.
        const surface = measureSurface();
        console.log(`Coral surface: ${surface.pixels | 0}px² (${(surface.ratio * 100).toFixed(1)}% of canvas, ${surface.branchCount} branches)`);
        if (onFinish && onFinish(surface) === false) return;

        applyHighlight();
        applyTexture();
      }
    };
  } else {
    console.log("=== SYNCHRONOUS GROWTH PERFORMANCE ===");
    
    // Benchmark: Growth iteration
    const iterStart = performance.now();
    // Predeclare timing variables for mask & rendering so they are in scope later
    let maskStart = 0, maskEnd = 0, renderStart = 0, renderEnd = 0;
    let iterations = 0;
    while (!iterate() && iterations < 30) iterations += 1; // Increased limit for better results
    const iterEnd = performance.now();
    console.log(`Growth iteration: ${(iterEnd - iterStart).toFixed(2)}ms (${iterations} iterations)`);
    
    // Benchmark: Drawing tip nodes
    const nodesStart = performance.now();
    drawNodes();
    const nodesEnd = performance.now();
    console.log(`Tip nodes drawing: ${(nodesEnd - nodesStart).toFixed(2)}ms`);

    // Build union mask from all segments - OPTIMIZED
    if (branches.length > 1) {
      // Benchmark: Fast mask building (no expensive operations!)
      maskStart = performance.now();
      // Mask is already built incrementally by paintCircle/paintQuad calls
      maskEnd = performance.now();
      console.log(`Mask building: ${(maskEnd - maskStart).toFixed(2)}ms`);
      
      // Create raster for gradient rendering
      const raster = new paperScope.Raster({
        size: paperScope.view.size,
        position: paperScope.view.center
      });
      
      // Benchmark: Fast gradient rendering
      renderStart = performance.now();
      const maxDepth = maxRootLength;
      const stops2 = makeStops(gradientColors, paperScope);
      renderFastGradient(raster.getContext('2d'), branches, maxDepth, stops2, vectorMask);
      renderEnd = performance.now();
      console.log(`Gradient rendering: ${(renderEnd - renderStart).toFixed(2)}ms`);
    }
    
    // Benchmark: Skeleton drawing
    const skeletonStart = performance.now();
    if (showSkeleton) {
      branches.forEach(b => {
        new paperScope.Path.Circle({ center: b.point, radius: 2, strokeColor: 'cyan', strokeWidth: 1, fillColor: null });
        if (b.parent) {
          new paperScope.Path.Line({ from: b.point, to: b.parent.point, strokeColor: 'cyan', strokeWidth: 0.5 });
        }
      });
    }
    const skeletonEnd = performance.now();
    console.log(`Skeleton drawing: ${(skeletonEnd - skeletonStart).toFixed(2)}ms`);
    
    const totalTime = (iterEnd - iterStart) + (nodesEnd - nodesStart) + (branches.length > 1 ? (maskEnd - maskStart) + (renderEnd - renderStart) : 0) + (skeletonEnd - skeletonStart);
    console.log(`Total time: ${totalTime.toFixed(2)}ms`);
    
    paperScope.view.update();

    const surface = measureSurface();
    console.log(`Coral surface: ${surface.pixels | 0}px² (${(surface.ratio * 100).toFixed(1)}% of canvas, ${surface.branchCount} branches)`);
    if (onFinish && onFinish(surface) === false) return;

    applyHighlight();
    applyTexture();
  }
};

// Utility: get and parse hook parameters from element's dataset
const getHookParams = (el, defaultParams) => {
    const parseValue = (value, defaultValue) => {
        if (value === null || value === undefined) return defaultValue;

        if (typeof defaultValue === 'boolean') {
            return value === 'true';
        }
        if (typeof defaultValue === 'number') {
            const num = parseFloat(value);
            return isNaN(num) ? defaultValue : num;
        }
        if (Array.isArray(defaultValue)) {
            try {
                return JSON.parse(value);
            } catch (e) {
                console.error(`Could not parse JSON for data attribute:`, value);
                return defaultValue;
            }
        }
        return value;
    };
    
    const overrides = {};
    for (const key in defaultParams) {
        if (el.dataset[key] !== undefined) {
            overrides[key] = parseValue(el.dataset[key], defaultParams[key]);
        }
    }
    return { ...defaultParams, ...overrides };
};

const GrowCoral = {
  mounted() {
    // Parse params first to get canvas dimensions if specified
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
      gradientColors: ["black","red","#fff"],
      showSkeleton: true,
      smoothness: 0.5,
      weirdness: 0.0,
      simplifyTolerance: 5,
      branchShyness: 1,
      showMask: true,
      drawingMode: false,
      customMaskPoints: [],
      canvasWidth: null,
      canvasHeight: null,
      controls: false,
      regenOnClick: false,
      texture: false,
      textureStrength: 1,
    };
    
    // Preload static noise texture. The source path works in Phoenix dev; the
    // static_export mix task rewrites it for the GitHub Pages bundle.
    this.noiseImageLoaded = false;
    this.noiseImage = new Image();
    this.noiseImage.onload = () => { this.noiseImageLoaded = true; };
    this.noiseImage.onerror = () => {
      this.noiseImageLoaded = false;
      console.warn("noise texture failed to load:", this.noiseImage.src);
    };
    this.noiseImage.src = "/images/noise.jpg";

    this.params = getHookParams(this.el, defaultParams);
    
    // Create canvas with explicit dimensions if provided
    this.canvas = createCanvas(this.el, this.params.canvasWidth, this.params.canvasHeight);
    
    // Create isolated Paper.js scope for this coral instance
    this.paperScope = new paper.PaperScope();
    this.paperScope.setup(this.canvas);
    
    this.renderCoral(this.params);

    if (this.params.controls) {
      this.createControlsOverlay();
    }

    this.handleEvent("update_coral", params => {
        this.renderCoral({ ...this.params, ...params });
    });
    
    // Mouse event handlers for drawing custom mask
    this.isDrawing = false;
    this.currentPath = null;
    this.canvas.addEventListener('mousedown', e => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', e => this.handleMouseMove(e));
    document.addEventListener('mouseup', e => this.handleMouseUp(e));
 
    // Regenerate coral on click if enabled
    if (this.params.regenOnClick) {
      this.canvas.addEventListener('click', () => {
        this.renderCoral(this.params);
      });
    }
  },

  renderCoral(params, attempt = 1) {
    // Activate this coral's Paper.js scope
    this.paperScope.activate();

    if (this.paperScope.project) this.paperScope.project.remove();

    // Update backing-store resolution if provided. Don't touch
    // canvas.style.width/height — those are set to 100% by createCanvas
    // so the canvas scales to its parent div (which is sized via Tailwind
    // classes and may differ between mobile and desktop).
    if (params.canvasWidth && params.canvasHeight) {
      this.canvas.width = params.canvasWidth;
      this.canvas.height = params.canvasHeight;
    }

    this.paperScope.setup(this.canvas);
    const { size, strength, showMask, drawingMode, fillMode, sourceX, sourceY, gradientColors, showSkeleton, customMaskPoints, ...grow } = params;

    this.drawingMode = drawingMode;

    let mask;
    if (customMaskPoints.length > 2) {
      // Use custom drawn mask
      mask = drawCustomMask(customMaskPoints, this.paperScope);
    } else {
      // Use parametric mask
      mask = drawMask({ size, strength }, this.paperScope);
    }

    if (!showMask) {
      mask.fillColor.alpha = 0;
      mask.strokeColor = null;
    }

    // Coral regeneration threshold. Growth occasionally terminates almost
    // immediately (e.g., the mask's wavy edge randomly puts the root outside,
    // or the attractor set happens to be unreachable) and leaves a blank or
    // dot-sized result. Retry up to MIN_CORAL_ATTEMPTS times until the surface
    // ratio crosses the threshold.
    const MIN_SURFACE_RATIO = 0.015;
    const MAX_CORAL_ATTEMPTS = 5;

    growCoral({
      mask,
      fillMode,
      sourceX,
      sourceY,
      gradientColors,
      showSkeleton,
      texture: params.texture && this.noiseImageLoaded,
      textureStrength: params.textureStrength,
      textureImage: this.noiseImage,
      paperScope: this.paperScope,
      ...grow,
      onFinish: ({ ratio, branchCount }) => {
        if (ratio < MIN_SURFACE_RATIO && attempt < MAX_CORAL_ATTEMPTS) {
          console.warn(
            `Coral too small (${(ratio * 100).toFixed(1)}%, ${branchCount} branches), regenerating (attempt ${attempt + 1}/${MAX_CORAL_ATTEMPTS})`
          );
          this.renderCoral(params, attempt + 1);
          return false;
        }
        return true;
      },
    });
  },

  handleCanvasClick(event) {
    if (!this.drawingMode) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    this.pushEvent("add_mask_point", { x: x, y: y });
  },

  eventToPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return new this.paperScope.Point(event.clientX - rect.left, event.clientY - rect.top);
  },

  handleMouseDown(event) {
    if (!this.drawingMode) return;
    this.isDrawing = true;
    const pt = this.eventToPoint(event);
    this.currentPath = new this.paperScope.Path();
    this.currentPath.strokeColor = 'blue';
    this.currentPath.strokeWidth = 4;
    this.currentPath.opacity = 0.3;
    this.currentPath.add(pt);
  },

  handleMouseMove(event) {
    if (!this.isDrawing) return;
    const pt = this.eventToPoint(event);
    this.currentPath.add(pt);
    this.paperScope.view.update();
  },

  handleMouseUp(event) {
    if (!this.isDrawing) return;
    const pt = this.eventToPoint(event);
    this.currentPath.add(pt);
    this.isDrawing = false;

    if (this.currentPath.segments.length > 2) {
      this.currentPath.simplify(2);
      this.currentPath.closed = true;
      this.currentPath.fillColor = new this.paperScope.Color(0, 0, 1, 0.1);
      this.currentPath.strokeColor = null;

      const points = this.currentPath.segments.map(seg => [seg.point.x, seg.point.y]);
      this.pushEvent('set_custom_mask', { points: points });
    } else {
      this.currentPath.remove();
    }
    this.currentPath = null;
  },

  createControlsOverlay() {
    // Create the main overlay container
    this.overlay = document.createElement("div");
    this.overlay.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 320px;
      height: 500px;
      background: white;
      border: 1px solid #ccc;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      resize: both;
      overflow: hidden;
      min-width: 300px;
      min-height: 400px;
    `;

    // Create header with drag handle and close button
    const header = document.createElement("div");
    header.style.cssText = `
      background: #f5f5f5;
      padding: 8px 12px;
      border-bottom: 1px solid #ddd;
      cursor: move;
      display: flex;
      justify-content: space-between;
      align-items: center;
      user-select: none;
    `;
    header.innerHTML = `
      <span style="font-weight: 600;">Coral Controls</span>
      <button style="background: none; border: none; font-size: 16px; cursor: pointer;">&times;</button>
    `;

    // Close button functionality
    header.querySelector("button").addEventListener("click", () => {
      this.overlay.remove();
    });

    // Make draggable
    this.makeDraggable(header);

    // Create scrollable content area
    const content = document.createElement("div");
    content.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    `;

    // Create form
    const form = document.createElement("form");
    form.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    `;

    // Add form controls
    form.innerHTML = this.generateFormHTML();

    // Add event listeners to form inputs
    this.attachFormListeners(form);

    content.appendChild(form);
    this.overlay.appendChild(header);
    this.overlay.appendChild(content);
    document.body.appendChild(this.overlay);
  },

  makeDraggable(handle) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    handle.addEventListener("mousedown", (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseInt(this.overlay.style.left || this.overlay.offsetLeft);
      startTop = parseInt(this.overlay.style.top || this.overlay.offsetTop);
      
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      e.preventDefault();
    });

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      this.overlay.style.left = (startLeft + deltaX) + "px";
      this.overlay.style.top = (startTop + deltaY) + "px";
      this.overlay.style.right = "auto";
    };

    const onMouseUp = () => {
      isDragging = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  },

  generateFormHTML() {
    const p = this.params;
    return `
      ${this.renderSlider("Canvas width", "canvasWidth", 200, 1000, p.canvasWidth || 400)}
      ${this.renderSlider("Canvas height", "canvasHeight", 150, 1000, p.canvasHeight || 300)}
      ${this.renderSlider("Source X", "sourceX", 0, 1, p.sourceX, 0.05)}
      ${this.renderSlider("Source Y", "sourceY", 0, 1, p.sourceY, 0.05)}
      ${this.renderSlider("Attractors", "attractorCount", 50, 500, p.attractorCount)}
      ${this.renderSlider("Max angle", "maxAbsAngle", 0, 3.14, p.maxAbsAngle, 0.1)}
      ${this.renderSlider("Segment length", "segmentLength", 3, 30, p.segmentLength)}
      ${this.renderSlider("Node radius", "nodeRadius", 1, 30, p.nodeRadius)}
      ${this.renderSlider("Tapering", "tapering", 0.5, 0.99, p.tapering, 0.01)}
      ${this.renderSlider("Segment scale", "segmentScale", 0.3, 5, p.segmentScale, 0.05)}
      ${this.renderSlider("Mask size", "size", 0.1, 1, p.size, 0.05)}
      ${this.renderSlider("Mask strength", "strength", 0.05, 1, p.strength, 0.02)}
      ${this.renderCheckbox("Fill mode", "fillMode", p.fillMode)}
      ${this.renderSlider("Simplify tolerance", "simplifyTolerance", 0, 20, p.simplifyTolerance)}
      ${this.renderSlider("Smoothness", "smoothness", 0, 2, p.smoothness, 0.1)}
      ${this.renderSlider("Weirdness", "weirdness", 0, 1, p.weirdness, 0.05)}
      ${this.renderSlider("Branch shyness", "branchShyness", 0, 3, p.branchShyness, 0.1)}
      ${this.renderCheckbox("Show Mask", "showMask", p.showMask)}
      ${this.renderCheckbox("Show Skeleton", "showSkeleton", p.showSkeleton)}
      ${this.renderCheckbox("Texture", "texture", p.texture)}
      ${this.renderSlider("Texture Strength", "textureStrength", 0, 1, p.textureStrength, 0.05)}
      <div style="grid-column: 1 / -1;">
        <label style="display: flex; flex-direction: column; font-size: 11px;">
          <span>Gradient Colors (JSON):</span>
          <input type="text" name="gradientColors" value='${JSON.stringify(p.gradientColors)}' 
                 style="margin-top: 2px; padding: 4px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px;">
        </label>
      </div>
      <div style="grid-column: 1 / -1; margin-top: 12px;">
        <button type="button" id="copy-config" style="
          background: #3b82f6; 
          color: white; 
          border: none; 
          padding: 8px 12px; 
          border-radius: 4px; 
          font-size: 11px; 
          cursor: pointer;
          width: 100%;
        ">Copy Data Attributes</button>
      </div>
      <div style="grid-column: 1 / -1;">
        <label style="display: flex; flex-direction: column; font-size: 10px;">
          <span style="margin-bottom: 4px; font-weight: 600;">Current Configuration (data-* attributes):</span>
          <textarea id="config-output" readonly style="
            font-family: monospace; 
            font-size: 9px; 
            background: #f5f5f5; 
            border: 1px solid #ddd; 
            border-radius: 4px; 
            padding: 8px; 
            height: 120px; 
            resize: vertical;
            white-space: pre;
          ">${this.generateDataAttributes()}</textarea>
        </label>
      </div>
    `;
  },

  renderSlider(label, name, min, max, value, step = 1) {
    return `
      <label style="display: flex; flex-direction: column; font-size: 11px;">
        <span>${label}: <span data-value="${name}">${value}</span></span>
        <input type="range" name="${name}" min="${min}" max="${max}" step="${step}" value="${value}"
               style="margin-top: 2px;">
      </label>
    `;
  },

  renderCheckbox(label, name, checked) {
    return `
      <label style="display: flex; align-items: center; gap: 4px; font-size: 11px;">
        <input type="checkbox" name="${name}" ${checked ? 'checked' : ''}>
        <span>${label}</span>
      </label>
    `;
  },

  attachFormListeners(form) {
    // Handle range inputs
    form.querySelectorAll('input[type="range"]').forEach(input => {
      const updateValue = () => {
        const valueSpan = form.querySelector(`[data-value="${input.name}"]`);
        if (valueSpan) valueSpan.textContent = input.value;
        this.updateParam(input.name, parseFloat(input.value));
      };
      
      input.addEventListener('input', updateValue);
      input.addEventListener('change', updateValue);
    });

    // Handle checkboxes
    form.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', () => {
        this.updateParam(input.name, input.checked);
      });
    });

    // Handle gradient colors text input
    const gradientInput = form.querySelector('input[name="gradientColors"]');
    if (gradientInput) {
      gradientInput.addEventListener('change', () => {
        try {
          const colors = JSON.parse(gradientInput.value);
          this.updateParam('gradientColors', colors);
        } catch (e) {
          console.error('Invalid gradient colors JSON:', e);
        }
      });
    }

    // Handle copy config button
    const copyButton = form.querySelector('#copy-config');
    if (copyButton) {
      copyButton.addEventListener('click', async () => {
        const configOutput = form.querySelector('#config-output');
        if (configOutput) {
          try {
            await navigator.clipboard.writeText(configOutput.value);
            
            // Visual feedback
            const originalText = copyButton.textContent;
            copyButton.textContent = 'Copied!';
            copyButton.style.background = '#10b981';
            setTimeout(() => {
              copyButton.textContent = originalText;
              copyButton.style.background = '#3b82f6';
            }, 1000);
          } catch (err) {
            // Fallback for older browsers
            configOutput.select();
            document.execCommand('copy');
            console.log('Fallback copy used');
          }
        }
      });
    }
  },

  updateParam(key, value) {
    this.params[key] = value;
    this.renderCoral(this.params);
    
    // Update the config output if the overlay exists
    if (this.overlay) {
      const configOutput = this.overlay.querySelector('#config-output');
      if (configOutput) {
        configOutput.value = this.generateDataAttributes();
      }
    }
  },

  generateDataAttributes() {
    const p = this.params;
    const attrs = [
      `data-canvas-width="${p.canvasWidth || 80}"`,
      `data-canvas-height="${p.canvasHeight || 80}"`,
      `data-size="${p.size}"`,
      `data-tapering="${p.tapering}"`,
      `data-smoothness="${p.smoothness}"`,
      `data-weirdness="${p.weirdness}"`,
      `data-attractor-count="${p.attractorCount}"`,
      `data-max-abs-angle="${p.maxAbsAngle.toFixed(2)}"`,
      `data-node-radius="${p.nodeRadius}"`,
      `data-segment-length="${p.segmentLength}"`,
      `data-segment-scale="${p.segmentScale}"`,
      `data-show-mask="${p.showMask}"`,
      `data-strength="${p.strength}"`,
      `data-branch-shyness="${p.branchShyness}"`,
      `data-fill-mode="${p.fillMode}"`,
      `data-source-x="${p.sourceX}"`,
      `data-source-y="${p.sourceY}"`,
      `data-gradient-colors='${JSON.stringify(p.gradientColors)}'`,
      `data-show-skeleton="${p.showSkeleton}"`,
      `data-simplify-tolerance="${p.simplifyTolerance}"`,
      `data-vector-mask="${p.vectorMask || false}"`,
      `data-texture="${p.texture}"`,
      `data-texture-strength="${p.textureStrength}"`
    ];
    
    return attrs.join('\n');
  },

  destroyed() {
    // Clean up the paper project and DOM element
    if (this.paperScope && this.paperScope.project) this.paperScope.project.remove();
    if (this.canvas) this.canvas.remove();
    if (this.overlay) this.overlay.remove();
  },
};

export default GrowCoral;
