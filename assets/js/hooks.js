// Import GSAP for animations
import gsap from "gsap";
import GrowCoral from "./grow_coral";

// Wave generation utility function
function generateWaves(config) {
  const {
    containerId,
    imagePrefix,
    imageCount,
    scaleMin,
    scaleMax,
    distributionStrength = 2,
    gridCols,
    gridRows,
    jitterAmount = 0.1,
    startY = 50,
    heightPercent = 50,
    filter = null,
    opacity = 1
  } = config;
  
  const container = document.getElementById(containerId);
  if (!container) return;
  
  // Clear existing waves
  container.innerHTML = '';
  
  const waveImages = Array.from({length: imageCount}, (_, i) => `/images/${imagePrefix}_${i + 1}.png`);
  
  const cellWidth = 100 / gridCols;
  const cellHeight = heightPercent / gridRows;
  
  for (let row = 0; row < gridRows; row++) {
    const rowRatio = row / (gridRows - 1);
    const fillPercentage = Math.pow(rowRatio, distributionStrength);
    
    const availableColumns = [];
    for (let col = 0; col < gridCols; col++) {
      if ((row % 2 === 0 && col % 2 === 0) || (row % 2 === 1 && col % 2 === 1)) {
        availableColumns.push(col);
      }
    }
    
    const maxCellsInRow = availableColumns.length;
    const cellsToFill = Math.round(maxCellsInRow * fillPercentage);
    
    // Shuffle available columns
    for (let i = availableColumns.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableColumns[i], availableColumns[j]] = [availableColumns[j], availableColumns[i]];
    }
    
    for (let i = 0; i < cellsToFill; i++) {
      const col = availableColumns[i];
      const wave = document.createElement('img');
      const randomWave = waveImages[Math.floor(Math.random() * waveImages.length)];
      
      wave.src = randomWave;
      wave.className = 'absolute';
      wave.style.opacity = opacity;
      wave.style.width = Math.random() * (scaleMax - scaleMin) + scaleMin + 'px';
      if (filter) wave.style.filter = filter;
      
      const baseLeft = col * cellWidth + cellWidth / 2;
      const baseTop = row * cellHeight + cellHeight / 2;
      const jitterX = (Math.random() - 0.5) * cellWidth * jitterAmount * 2;
      const jitterY = (Math.random() - 0.5) * cellHeight * jitterAmount * 2;
      
      wave.style.left = baseLeft + jitterX + '%';
      wave.style.top = startY + baseTop + jitterY + '%';
      
      const parallaxSpeed = Math.random() * 0.5 + 0.1;
      wave.dataset.parallaxSpeed = parallaxSpeed;
      
      container.appendChild(wave);
    }
  }
}

// Check if mobile
function isMobile() {
  return window.innerWidth < 768;
}

const Hooks = {
  GrowCoral,
  WavesBackground: {
    mounted() {
      this.generateWaves();
      window.addEventListener('resize', () => this.generateWaves());
    },
    
    generateWaves() {
      generateWaves({
        containerId: 'waves-background',
        imagePrefix: 'wave',
        imageCount: 6,
        scaleMin: 30,
        scaleMax: 60,
        distributionStrength: 3,
        gridCols: isMobile() ? 10 : 20,
        gridRows: isMobile() ? 10 : 20,
        jitterAmount: 0.1,
        filter: 'hue-rotate(30deg)',
        opacity: 1
      });
    }
  },

  RectangleWaves: {
    mounted() {
      this.generateWaves();
      window.addEventListener('resize', () => this.generateWaves());
    },
    
    generateWaves() {
      generateWaves({
        containerId: 'rectangle-waves',
        imagePrefix: 'white_wave',
        imageCount: 5,
        scaleMin: 20,
        scaleMax: 40,
        distributionStrength: 4,
        gridCols: isMobile() ? 10 : 16,
        gridRows: isMobile() ? 10 : 16,
        jitterAmount: 0.15,
        startY: 0,
        heightPercent: 100,
        opacity: 1
      });
    }
  },

  AnimatedText: {
    mounted() {
      this.initializeTextAnimation();
    },

    initializeTextAnimation() {
      // Set initial states
      gsap.set("#animated-text > span", {
        opacity: 0,
        y: 30,
        rotationX: -90,
        transformOrigin: "50% 50%"
      });
      
      gsap.set(".underline-path", {
        strokeDasharray: 100,
        strokeDashoffset: 100
      });
      
      gsap.set(".shape-sparkle", {
        scale: 0,
        rotation: -180,
        display: "inline-block"
      });
      
      gsap.set(".highlight-bar", {
        scaleX: 0,
        transformOrigin: "left center"
      });
      
      // Create timeline
      const tl = gsap.timeline({
        delay: 0.2,
        defaults: { ease: "power3.out", duration: 0.4 }
      });
      
      // Animate words in
      tl.to("#animated-text > span", {
        opacity: 1,
        y: 0,
        rotationX: 0,
        stagger: {
          each: 0.02,
          from: "start"
        }
      })
      // Animate the underline
      .to(".underline-path", {
        strokeDashoffset: 0,
        duration: 0.3,
        ease: "power2.inOut"
      }, "-=0.2")
      // Pop in the sparkle
      .to(".shape-sparkle", {
        scale: 1,
        rotation: 0,
        duration: 0.2,
        ease: "back.out(3)"
      }, "-=0.15")
      // Slide in the highlight bar
      .to(".highlight-bar", {
        scaleX: 1,
        duration: 0.2,
        ease: "power2.out"
      }, "-=0.1");
      
      // Add hover effects to colorful words
      const colorfulWords = this.el.querySelectorAll("span[class*='text-']");
      colorfulWords.forEach(word => {
        word.addEventListener('mouseenter', function() {
          gsap.to(this, {
            scale: 1.1,
            rotation: Math.random() * 10 - 5,
            duration: 0.15,
            ease: "power2.out"
          });
        });
        
        word.addEventListener('mouseleave', function() {
          gsap.to(this, {
            scale: 1,
            rotation: 0,
            duration: 0.15,
            ease: "power2.out"
          });
        });
      });
      
      // Continuous sparkle animation
      gsap.to(".shape-sparkle", {
        rotation: 360,
        duration: 20,
        repeat: -1,
        ease: "none"
      });
    }
  },

  CTAButton: {
    mounted() {
      this.initializeButtonAnimation();
      this.addHoverEffects();
    },

    initializeButtonAnimation() {
      gsap.set("#cta-button", {
        scale: 0,
        opacity: 0
      });
      
      gsap.set("#spark-path-1", {
        transformOrigin: "center center"
      });
      
      gsap.set("#spark-path-2", {
        transformOrigin: "center center"
      });
      
      // Create timeline for button animation
      const buttonTl = gsap.timeline({ delay: 2.5 });
      
      buttonTl.to("#cta-button", {
        scale: 1,
        opacity: 1,
        duration: 0.3,
        ease: "back.out(1.5)"
      })
      // Add jiggle effect
      .to("#cta-button", {
        keyframes: [
          { rotation: -3, duration: 0.05 },
          { rotation: 3, duration: 0.05 },
          { rotation: -2, duration: 0.05 },
          { rotation: 2, duration: 0.05 },
          { rotation: 0, duration: 0.05 }
        ],
        ease: "power2.inOut"
      }, "+=0.1");
    },

    addHoverEffects() {
      this.el.addEventListener('mouseenter', () => {
        gsap.to("#spark-path-1", {
          scale: 1.1,
          rotation: 45,
          duration: 0.6,
          ease: "power2.out"
        });
        
        gsap.to("#spark-path-2", {
          scale: 1.2,
          rotation: -30,
          duration: 0.6,
          ease: "power2.out"
        });
      });
      
      this.el.addEventListener('mouseleave', () => {
        gsap.to("#spark-path-1", {
          scale: 1,
          rotation: 0,
          duration: 0.4,
          ease: "power2.out"
        });
        
        gsap.to("#spark-path-2", {
          scale: 1,
          rotation: 0,
          duration: 0.4,
          ease: "power2.out"
        });
      });
    }
  },

  ParallaxHandler: {
    mounted() {
      this.ticking = false;
      this.handleScroll = this.handleScroll.bind(this);
      this.updateParallax = this.updateParallax.bind(this);
      
      // Use passive listener for better performance
      window.addEventListener('scroll', this.handleScroll, { passive: true });
    },

    destroyed() {
      window.removeEventListener('scroll', this.handleScroll);
    },

    handleScroll() {
      // Throttle using requestAnimationFrame
      if (!this.ticking) {
        requestAnimationFrame(this.updateParallax);
        this.ticking = true;
      }
    },

    updateParallax() {
      const scrollY = window.scrollY;
      const waves = document.querySelectorAll('#waves-background img, #rectangle-waves img');
      
      waves.forEach(wave => {
        const speed = parseFloat(wave.dataset.parallaxSpeed);
        if (speed) {
          const movement = scrollY * speed;
          // Use translate3d for hardware acceleration
          wave.style.transform = `translate3d(0, ${movement}px, 0)`;
        }
      });
      
      this.ticking = false;
    }
  }
};

export default Hooks;