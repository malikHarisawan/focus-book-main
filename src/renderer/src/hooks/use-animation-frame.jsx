import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for managing requestAnimationFrame with proper cleanup
 * @param {Function} callback - Animation callback function
 * @param {boolean} isActive - Whether animation should be running
 * @returns {Object} - Animation controls
 */
export function useAnimationFrame(callback, isActive = true) {
  const requestRef = useRef();
  const previousTimeRef = useRef();
  const isRunningRef = useRef(false);

  const animate = useCallback((time) => {
    if (!isRunningRef.current) return;
    
    if (previousTimeRef.current !== undefined) {
      const deltaTime = time - previousTimeRef.current;
      callback(deltaTime);
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  }, [callback]);

  const start = useCallback(() => {
    if (!isRunningRef.current) {
      isRunningRef.current = true;
      requestRef.current = requestAnimationFrame(animate);
      console.log('Animation started');
    }
  }, [animate]);

  const stop = useCallback(() => {
    if (isRunningRef.current) {
      isRunningRef.current = false;
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
      console.log('Animation stopped');
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      start();
    } else {
      stop();
    }

    return stop; // Cleanup on unmount
  }, [isActive, start, stop]);

  // Handle page visibility changes to pause/resume animation
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else if (isActive) {
        start();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stop(); // Ensure cleanup
    };
  }, [isActive, start, stop]);

  return {
    start,
    stop,
    isRunning: () => isRunningRef.current
  };
}

/**
 * Hook for managing particle animations with performance optimizations
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Object} options - Animation options
 * @returns {Object} - Animation controls
 */
export function useParticleAnimation(canvas, options = {}) {
  const {
    particleCount = 50, // Reduced from 100 for better performance
    enabled = true,
    pauseOnHidden = true
  } = options;

  const particlesRef = useRef([]);
  const animationStateRef = useRef({ enabled: true });

  // Particle class definition
  const createParticle = useCallback(() => {
    if (!canvas) return null;

    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2 + 1, // Smaller particles
      speedX: (Math.random() - 0.5) * 0.3, // Slower movement
      speedY: (Math.random() - 0.5) * 0.3,
      color: `rgba(${Math.floor(Math.random() * 100) + 100}, ${Math.floor(Math.random() * 100) + 150}, ${Math.floor(Math.random() * 55) + 200}, ${Math.random() * 0.3 + 0.1})`, // More subtle
      
      update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x > canvas.width) this.x = 0;
        if (this.x < 0) this.x = canvas.width;
        if (this.y > canvas.height) this.y = 0;
        if (this.y < 0) this.y = canvas.height;
      },

      draw(ctx) {
        if (!ctx) return;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    };
  }, [canvas]);

  // Initialize particles
  const initializeParticles = useCallback(() => {
    if (!canvas) return;
    
    particlesRef.current = [];
    for (let i = 0; i < particleCount; i++) {
      const particle = createParticle();
      if (particle) {
        particlesRef.current.push(particle);
      }
    }
    console.log(`Initialized ${particlesRef.current.length} particles`);
  }, [canvas, particleCount, createParticle]);

  // Animation callback
  const animateParticles = useCallback(() => {
    if (!canvas || !animationStateRef.current.enabled) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update and draw particles
    particlesRef.current.forEach(particle => {
      particle.update();
      particle.draw(ctx);
    });
  }, [canvas]);

  // Use animation frame hook
  const animation = useAnimationFrame(animateParticles, enabled && animationStateRef.current.enabled);

  // Handle canvas resize
  const handleResize = useCallback(() => {
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    // Reinitialize particles with new dimensions
    initializeParticles();
  }, [canvas, initializeParticles]);

  // Initialize on mount
  useEffect(() => {
    if (canvas) {
      handleResize();
      initializeParticles();
    }
  }, [canvas, handleResize, initializeParticles]);

  // Handle resize events
  useEffect(() => {
    if (!canvas) return;

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [canvas, handleResize]);

  return {
    start: animation.start,
    stop: animation.stop,
    isRunning: animation.isRunning,
    setEnabled: (newEnabled) => {
      animationStateRef.current.enabled = newEnabled;
      if (!newEnabled) {
        animation.stop();
      } else if (enabled) {
        animation.start();
      }
    },
    particleCount: particlesRef.current.length
  };
}