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
const growCoral = ({ mask, animate = true, attractorCount = 250, maxAbsAngle = Math.PI / 2, fillMode = false, segmentLength = 13, nodeRadius = 5, tapering = 0.96, segmentScale = 0.7, replenishAttractors = true, simplifyTolerance = 5, smoothness = 0.5, weirdness = 0, branchShyness = 1, sourceX = 0.5, sourceY = 1, gradientColors = ["black","red","#fff"], showSkeleton = true, vectorMask = true, texture = false, textureStrength = 1, textureImage = null, paperScope = paper } = {}) => {
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


  // Helper: Paint a segment directly to mask canvas (optimization #1)
  const paintSegmentToMask = (segmentPath, branchIndex) => {
    const pathData = segmentPath.exportSVG({ asString: true });
    const domPath = new Path2D(pathData.match(/d="([^"]+)"/)?.[1] || "");
    maskCtx.fill(domPath);
    
    // Also update branchId buffer for this segment's area (optimization #2)
    const bounds = segmentPath.bounds;
    const startX = Math.max(0, Math.floor(bounds.left));
    const endX = Math.min(w - 1, Math.ceil(bounds.right));
    const startY = Math.max(0, Math.floor(bounds.top));
    const endY = Math.min(h - 1, Math.ceil(bounds.bottom));
    
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const pt = new paperScope.Point(x + 0.5, y + 0.5);
        if (segmentPath.contains(pt)) {
          branchIdBuffer[y * w + x] = branchIndex;
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
      addBranchToGrid(branches.length - 1, to); // Add new branch to spatial grid
      createdCount++;
       grown = true;
              const sizeFrom = Math.max(1, nodeRadius * Math.pow(tapering, parentBranch.level));
       const sizeTo = Math.max(1, nodeRadius * Math.pow(tapering, newLevel));

      // Paint junction node when branching directly to mask canvas
      if (parentBranch.children === 2 || parentBranch.level === 0) {
        const parentNodeShape = new paperScope.Path.Circle({ center: from, radius: sizeFrom, fillColor: new paperScope.Color(0,0,0,0) });
        parentNodeShape.meta = { branchIndex: idx };
        paintSegmentToMask(parentNodeShape, idx);
        segments.push(parentNodeShape); // Still keep for skeleton reference
      }

      // Paint segment shape directly to mask canvas
      // Compute segment cross-section offsets
      const normal = segDir.normalize().rotate(90);
      const w1 = sizeFrom * 2 * segmentScale;
      const w2 = sizeTo * 2 * segmentScale;
      const segShape = new paperScope.Path({
        segments: [
          from.add(normal.multiply(w1 / 2)),
          from.subtract(normal.multiply(w1 / 2)),
          to.subtract(normal.multiply(w2 / 2)),
          to.add(normal.multiply(w2 / 2)),
        ],
        closed: true,
        fillColor: new paperScope.Color(0,0,0,0),
      });
      segShape.meta = { branchIndex: branches.length - 1 };
      paintSegmentToMask(segShape, branches.length - 1);
      segments.push(segShape); // Still keep for skeleton reference
    
      // Paint connector circle directly to mask canvas
      const connectorRadius = Math.max(w1, w2) * 0.5;
      const connector = new paperScope.Path.Circle({ center: from, radius: connectorRadius, fillColor: new paperScope.Color(0,0,0,0) });
      connector.meta = { branchIndex: branches.length - 1 };
      paintSegmentToMask(connector, branches.length - 1);
      segments.push(connector); // Still keep for skeleton reference


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
      
      // OPTIMIZATION: Skip expensive unite operations for pixel-only rendering
      // The mask is already built incrementally via paintSegmentToMask
      // EXCEPT when vectorMask is enabled - then we need a unified path to smooth
      const SKIP_UNITE = !vectorMask; // Only unite for vector mask mode
      
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

  const drawNodes = () => {
    branches.forEach((b, idx) => {
      if (b.children === 0) {
        const size = Math.max(1, nodeRadius * Math.pow(tapering, b.level));
        const tipDot = new paperScope.Path.Circle({ center: b.point, radius: size, fillColor: new paperScope.Color(0,0,0,0) });
        tipDot.meta = { branchIndex: idx };
        paintSegmentToMask(tipDot, idx);
        segments.push(tipDot); // Still keep for skeleton reference
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
            if (checkIdx < branchIdBuffer.length && branchIdBuffer[checkIdx] !== 0xFFFF) {
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
            if (bufferIdx < branchIdBuffer.length && branchIdBuffer[bufferIdx] !== 0xFFFF) {
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
      if (segments.length > 0) {
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
        
        // Apply texture after animation is complete
        if (texture && textureStrength > 0 && textureImage) {
          setTimeout(() => {
            const canvas = paperScope.view.element;
            const ctx = canvas.getContext('2d');
            
            // Create a temporary canvas with just the coral shape
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Copy current coral to temp canvas
            tempCtx.drawImage(canvas, 0, 0);
            
            // Apply texture to temp canvas
            tempCtx.save();
            tempCtx.globalAlpha = textureStrength;
            tempCtx.globalCompositeOperation = TEXTURE_BLEND_MODE;
            
            // Scale texture based on TEXTURE_SCALE constant
            const scaledW = canvas.width * TEXTURE_SCALE;
            const scaledH = canvas.height * TEXTURE_SCALE;
            
            // If scaling down, create tiled pattern
            if (TEXTURE_SCALE <= 1) {
              const pattern = tempCtx.createPattern(textureImage, 'repeat');
              const matrix = new DOMMatrix().scale(TEXTURE_SCALE, TEXTURE_SCALE);
              pattern.setTransform(matrix);
              tempCtx.fillStyle = pattern;
              tempCtx.fillRect(0, 0, canvas.width, canvas.height);
            } else {
              // If scaling up, just stretch the texture
              tempCtx.drawImage(textureImage, 0, 0, scaledW, scaledH);
            }
            tempCtx.restore();
            
            // Clear the original canvas and redraw only the textured coral
            // Reset the devicePixelRatio transform that Paper.js applied so
            // the backing-store-sized tempCanvas maps 1:1 to ctx (otherwise
            // the texture is drawn 2x too large on HiDPI displays).
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalCompositeOperation = 'source-atop';
            ctx.drawImage(tempCanvas, 0, 0);
            ctx.restore();
          }, 100);
        }
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
    if (segments.length > 0) {
      // Benchmark: Fast mask building (no expensive operations!)
      maskStart = performance.now();
      // Mask is already built incrementally by paintSegmentToMask calls
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
    
    const totalTime = (iterEnd - iterStart) + (nodesEnd - nodesStart) + (segments.length > 0 ? (maskEnd - maskStart) + (renderEnd - renderStart) : 0) + (skeletonEnd - skeletonStart);
    console.log(`Total time: ${totalTime.toFixed(2)}ms`);
    
    paperScope.view.update();
    
    // Apply texture for synchronous rendering
    if (texture && textureStrength > 0 && textureImage) {
      setTimeout(() => {
        const canvas = paperScope.view.element;
        const ctx = canvas.getContext('2d');
        
        // Create a temporary canvas with just the coral shape
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Copy current coral to temp canvas
        tempCtx.drawImage(canvas, 0, 0);
        
        // Apply texture to temp canvas
        tempCtx.save();
        tempCtx.globalAlpha = textureStrength;
        tempCtx.globalCompositeOperation = TEXTURE_BLEND_MODE;
        
        // Scale texture based on TEXTURE_SCALE constant
        const scaledW = canvas.width * TEXTURE_SCALE;
        const scaledH = canvas.height * TEXTURE_SCALE;
        
        // If scaling down, create tiled pattern
        if (TEXTURE_SCALE <= 1) {
          const pattern = tempCtx.createPattern(textureImage, 'repeat');
          const matrix = new DOMMatrix().scale(TEXTURE_SCALE, TEXTURE_SCALE);
          pattern.setTransform(matrix);
          tempCtx.fillStyle = pattern;
          tempCtx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
          // If scaling up, just stretch the texture
          tempCtx.drawImage(textureImage, 0, 0, scaledW, scaledH);
        }
        tempCtx.restore();
        
        // Clear the original canvas and redraw only the textured coral
        // Reset Paper.js's devicePixelRatio transform so the backing-store-
        // sized tempCanvas maps 1:1 to ctx (fixes HiDPI misalignment).
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-atop';
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.restore();
      }, 50);
    }
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
    
    // Preload static noise texture
    this.noiseImageLoaded = false;
    this.noiseImage = new Image();
    this.noiseImage.onload = () => { this.noiseImageLoaded = true; };
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

  renderCoral(params) {
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
      ...grow 
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
