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

const GrowCoral = {
  mounted() {
    this.canvas = createCanvas(this.el);

    paper.setup(this.canvas);

    // Bottom-center position
    drawDot(this.canvas.width / 2, this.canvas.height - 6);
  },

  destroyed() {
    // Clean up the paper project and DOM element
    if (paper.project) paper.project.remove();
    if (this.canvas) this.canvas.remove();
  },
};

export default GrowCoral;
