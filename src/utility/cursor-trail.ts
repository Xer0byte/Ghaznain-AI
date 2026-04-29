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
  const dotCount = 20;

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

  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("touchmove", handleTouchMove);
  window.addEventListener("resize", handleResize);
  handleResize();

  let animationFrameId: number;

  const renderTrailCursor = () => {
    ctx.clearRect(0, 0, width, height);

    const spring = 0.15;
    const friction = 0.5;

    let targetX = mouse.x;
    let targetY = mouse.y;

    dots.forEach((dot) => {
      dot.vx += (targetX - dot.x) * spring;
      dot.vy += (targetY - dot.y) * spring;
      dot.vx *= friction;
      dot.vy *= friction;
      dot.x += dot.vx;
      dot.y += dot.vy;

      targetX = dot.x;
      targetY = dot.y;
    });

    const displayColor = color || "#00ff9d";

    // Trail line
    ctx.beginPath();
    ctx.lineWidth = width < 768 ? 1.5 : 2.5;
    ctx.strokeStyle = displayColor;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.moveTo(dots[0].x, dots[0].y);
    for (let i = 1; i < dots.length - 1; i++) {
      const xc = (dots[i].x + dots[i + 1].x) / 2;
      const yc = (dots[i].y + dots[i + 1].y) / 2;
      ctx.quadraticCurveTo(dots[i].x, dots[i].y, xc, yc);
    }
    ctx.stroke();

    // Neural dots
    dots.forEach((dot, index) => {
      const size = (1 - index / dots.length) * (width < 768 ? 5 : 7);
      ctx.beginPath();
      ctx.fillStyle = displayColor;
      ctx.globalAlpha = (1 - index / dots.length) * 0.8;
      ctx.arc(dot.x, dot.y, size / 2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Head Glow with Shadow
    ctx.beginPath();
    ctx.shadowBlur = 15;
    ctx.shadowColor = displayColor;
    const radialGlow = ctx.createRadialGradient(dots[0].x, dots[0].y, 0, dots[0].x, dots[0].y, 25);
    radialGlow.addColorStop(0, displayColor);
    radialGlow.addColorStop(1, "transparent");
    ctx.fillStyle = radialGlow;
    ctx.globalAlpha = 0.4;
    ctx.arc(dots[0].x, dots[0].y, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0; // Reset for next frame

    animationFrameId = requestAnimationFrame(renderTrailCursor);
  };

  return {
    renderTrailCursor,
    cleanUp: () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    },
  };
};
