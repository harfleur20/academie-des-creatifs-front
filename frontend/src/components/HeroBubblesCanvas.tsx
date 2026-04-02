import { useEffect, useRef } from "react";

type Bubble = {
  opacity: number;
  radius: number;
  speed: number;
  x: number;
  y: number;
};

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function createBubble(width: number, height: number, withRandomY = true): Bubble {
  return {
    x: randomBetween(0, width),
    y: withRandomY ? randomBetween(0, height) : randomBetween(height * 0.9, height * 1.2),
    radius: randomBetween(10, 28),
    speed: randomBetween(28, 72),
    opacity: randomBetween(0.18, 0.55),
  };
}

export default function HeroBubblesCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    let animationFrameId = 0;
    let bubbles: Bubble[] = [];
    let width = 0;
    let height = 0;
    let deviceScale = 1;
    let lastTimestamp = 0;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) {
        return;
      }

      width = parent.clientWidth;
      height = parent.clientHeight;
      deviceScale = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(width * deviceScale);
      canvas.height = Math.floor(height * deviceScale);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);

      const bubbleCount = width < 768 ? 9 : 15;
      bubbles = Array.from({ length: bubbleCount }, () => createBubble(width, height));
    };

    const draw = (timestamp: number) => {
      const delta = lastTimestamp === 0 ? 16.67 : Math.min(timestamp - lastTimestamp, 32);
      lastTimestamp = timestamp;

      context.clearRect(0, 0, width, height);

      bubbles.forEach((bubble) => {
        bubble.y -= bubble.speed * (delta / 1000);

        if (bubble.y < -bubble.radius * 2) {
          Object.assign(bubble, createBubble(width, height, false));
        }

        context.beginPath();
        context.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(255, 255, 255, ${bubble.opacity})`;
        context.shadowColor = "rgba(255, 255, 255, 0.18)";
        context.shadowBlur = 10;
        context.fill();
      });

      context.shadowBlur = 0;
      animationFrameId = window.requestAnimationFrame(draw);
    };

    resizeCanvas();
    animationFrameId = window.requestAnimationFrame(draw);
    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  return <canvas aria-hidden="true" id="floatingCanvas" ref={canvasRef} />;
}
