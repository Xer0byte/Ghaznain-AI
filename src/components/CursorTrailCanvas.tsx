import React, { useEffect, useRef } from 'react';

import { CSSProperties, useEffect, useRef } from "react";
import { cursorTrail } from "../utility/cursor-trail";

export interface CursorTrailCanvasProps {
  color?: string;
  className?: string;
  style?: CSSProperties;
  theme?: 'dark' | 'light';
}

export default function CursorTrailCanvas(props: CursorTrailCanvasProps) {
  const refCanvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Determine color based on theme if not provided
    const displayColor = props.color || (props.theme === 'dark' ? '#00ff9d' : '#006633');
    
    const { cleanUp, renderTrailCursor } = cursorTrail({
      ref: refCanvas,
      color: displayColor,
    });
    renderTrailCursor();

    return () => {
      cleanUp();
    };
  }, [props.color, props.theme]);

  return (
    <canvas
      ref={refCanvas}
      className={`pointer-events-none fixed inset-0 z-[9999] h-full w-full ${props.className || ""}`}
      style={props.style}
    ></canvas>
  );
}


