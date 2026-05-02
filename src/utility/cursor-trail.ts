import { RefObject } from "react";

export const cursorTrail = ({
  ref,
  color,
}: {
  ref: RefObject<HTMLCanvasElement | null>;
  color?: string;
}) => {
  const canvas = ref.current;
  if (!canvas) return { cleanUp: () => {}, renderTrailCursor: () => {} };
  const ctx = canvas.getContext("2d");
  if (!ctx) return { cleanUp: () => {}, renderTrailCursor: () => {} };

  let width = window.innerWidth;
  let height = window.innerHeight;

  const mouse = { x: width / 2, y: height / 2 };
  const dots: { x: number; y: number; vx: number; vy: number }[] = [];
  const dotCount = 35; // Increased for smoother trail

  for (let i = 0; i < dotCount; i++) {
    dots.push({
      x: mouse.x,
      y: mouse.y,
      vx: 0,
      vy: 0,
    });
  }

  const handleMouseMove = (e: MouseEvent) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length > 0) {
      mouse.x = e.touches[0].clientX;
      mouse.y = e.touches[0].clientY;
    }
  };

  const handleResize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    width = canvas.width;
    height = canvas.height;
  };

  const handleClick = (e: MouseEvent) => {
    // Add sparkles at the mouse position
    for (let i = 0; i < 8; i++) {
      particles.push({
        x: mouse.x,
        y: mouse.y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        size: Math.random() * 3 + 1,
        life: 1.0,
      });
    }
  };

  const particles: { x: number; y: number; vx: number; vy: number; size: number; life: number }[] = [];

  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("touchmove", handleTouchMove);
  window.addEventListener("resize", handleResize);
  window.addEventListener("mousedown", handleClick);
  handleResize();

  let animationFrameId: number;

  const renderTrailCursor = () => {
    ctx.clearRect(0, 0, width, height);

    // Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.life -= 0.02;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      ctx.beginPath();
      ctx.fillStyle = color || "#00ff9d";
      ctx.globalAlpha = p.life;
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Dynamic physics based on distance to target
    let targetX = mouse.x;
    let targetY = mouse.y;

    dots.forEach((dot, index) => {
      const spring = 0.15 + (index / dotCount) * 0.05; 
      const friction = 0.55;

      dot.vx += (targetX - dot.x) * spring;
      dot.vy += (targetY - dot.y) * spring;
      dot.vx *= friction;
      dot.vy *= friction;
      dot.x += dot.vx;
      dot.y += dot.vy;

      targetX = dot.x;
      targetY = dot.y;
    });

    const displayColor = color || (width < 768 ? "#00ff9d" : "#00ff9d");

    // Glow Layer
    ctx.shadowBlur = 10;
    ctx.shadowColor = displayColor;
    
    // Background Glow Line (Thick)
    ctx.beginPath();
    ctx.lineWidth = width < 768 ? 4 : 8;
    ctx.strokeStyle = displayColor;
    ctx.globalAlpha = 0.1;
    ctx.moveTo(dots[0].x, dots[0].y);
    for (let i = 1; i < dots.length - 1; i++) {
      const xc = (dots[i].x + dots[i + 1].x) / 2;
      const yc = (dots[i].y + dots[i + 1].y) / 2;
      ctx.quadraticCurveTo(dots[i].x, dots[i].y, xc, yc);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Main Core Line 
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.lineWidth = width < 768 ? 1.5 : 2.5;
    
    const gradient = ctx.createLinearGradient(dots[0].x, dots[0].y, dots[dots.length-1].x, dots[dots.length-1].y);
    gradient.addColorStop(0, displayColor);
    gradient.addColorStop(0.5, displayColor);
    gradient.addColorStop(1, "transparent");
    ctx.strokeStyle = gradient;

    ctx.moveTo(dots[0].x, dots[0].y);
    for (let i = 1; i < dots.length - 1; i++) {
      const xc = (dots[i].x + dots[i + 1].x) / 2;
      const yc = (dots[i].y + dots[i + 1].y) / 2;
      ctx.quadraticCurveTo(dots[i].x, dots[i].y, xc, yc);
    }
    ctx.stroke();

    // Tail Nodes 
    dots.forEach((dot, index) => {
      if (index % 4 === 0) {
        const size = (1 - index / dots.length) * (width < 768 ? 4 : 5);
        ctx.beginPath();
        ctx.fillStyle = displayColor;
        ctx.globalAlpha = (1 - index / dots.length) * 0.4;
        ctx.arc(dot.x, dot.y, size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.globalAlpha = 1;
    animationFrameId = requestAnimationFrame(renderTrailCursor);
  };

  return {
    renderTrailCursor,
    cleanUp: () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousedown", handleClick);
      cancelAnimationFrame(animationFrameId);
    },
  };
};
