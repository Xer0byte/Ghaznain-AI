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

  const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
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
  };

  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("touchmove", handleTouchMove);
  window.addEventListener("resize", handleResize);
  handleResize();

  let animationFrameId: number;

  const renderTrailCursor = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let x = mouse.x;
    let y = mouse.y;

    points.forEach((point, index) => {
      point.x += (x - point.x) * 0.15;
      point.y += (y - point.y) * 0.15;
      x = point.x;
      y = point.y;
    });

    ctx.beginPath();
    ctx.lineWidth = window.innerWidth < 768 ? 1.5 : 2;
    ctx.strokeStyle = color || "#00ff9d";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    ctx.stroke();

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
