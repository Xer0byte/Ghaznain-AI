import React, { useEffect, useRef } from 'react';

export default function CursorTrailCanvas({ color = 'hsla(183, 63%, 40%, 0.5)' }: { color?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const points: { x: number; y: number; life: number }[] = [];
    let mx = -100;
    let my = -100;

    const onResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    const onMouseMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      points.push({ x: mx, y: my, life: 1.0 });
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouseMove);

    let animationFrameId: number;
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw standard trail
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        p.life -= 0.02;
        if (p.life <= 0) {
          points.splice(i, 1);
          i--;
          continue;
        }

        ctx.lineTo(p.x, p.y);
      }
      
      if (points.length > 0) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        // Add a nice glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [color]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  );
}
