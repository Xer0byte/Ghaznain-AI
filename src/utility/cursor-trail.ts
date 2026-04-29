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
  const points: { x: number; y: number }[] = [];
  const amount = 20;

  for (let i = 0; i < amount; i++) {
    points.push({ x: mouse.x, y: mouse.y });
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

    let x = mouse.x;
    let y = mouse.y;

    points.forEach((point) => {
      point.x += (x - point.x) * 0.15;
      point.y += (y - point.y) * 0.15;
      x = point.x;
      y = point.y;
    });

    const displayColor = color || "#00ff9d";

    // Trail line
    ctx.beginPath();
    ctx.lineWidth = width < 768 ? 1.5 : 2;
    ctx.strokeStyle = displayColor;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    ctx.stroke();

    // Neural dots
    points.forEach((point, index) => {
      const size = (1 - index / points.length) * (width < 768 ? 4 : 6);
      ctx.beginPath();
      ctx.fillStyle = displayColor;
      ctx.globalAlpha = 1 - index / points.length;
      ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Head Glow
    ctx.beginPath();
    const glowColor = displayColor.replace(/0\.\d+\)$/, "0.4)").replace(/, \d+\)$/, ", 0.4)");
    // If color is hsla(183, 63%, 40%, 0.5), we want to make a glow around the head
    // We can use shadowBlur for a simpler 100% same feel if they used it
    const radialGlow = ctx.createRadialGradient(points[0].x, points[0].y, 0, points[0].x, points[0].y, 15);
    radialGlow.addColorStop(0, displayColor);
    radialGlow.addColorStop(1, "transparent");
    ctx.fillStyle = radialGlow;
    ctx.globalAlpha = 0.4;
    ctx.arc(points[0].x, points[0].y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

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
