import React, { useEffect, useRef } from 'react';

const StarField: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;
    let stars: { x: number; y: number; r: number; alpha: number; speed: number; twinkle: number }[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
    };

    const initStars = () => {
      stars = [];
      const count = Math.floor((canvas.width * canvas.height) / 4000);
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r: Math.random() * 1.5 + 0.2,
          alpha: Math.random() * 0.7 + 0.1,
          speed: Math.random() * 0.3 + 0.05,
          twinkle: Math.random() * Math.PI * 2,
        });
      }
    };

    let t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.008;

      stars.forEach(s => {
        s.twinkle += s.speed * 0.05;
        const a = s.alpha * (0.5 + 0.5 * Math.sin(s.twinkle));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 196, 232, ${a})`;
        ctx.fill();

        // Occasional bright cross-star
        if (s.r > 1.2) {
          ctx.strokeStyle = `rgba(200, 196, 232, ${a * 0.3})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(s.x - s.r * 3, s.y);
          ctx.lineTo(s.x + s.r * 3, s.y);
          ctx.moveTo(s.x, s.y - s.r * 3);
          ctx.lineTo(s.x, s.y + s.r * 3);
          ctx.stroke();
        }
      });

      // Nebula glow blobs
      const nebulaPositions = [
        { x: canvas.width * 0.15, y: canvas.height * 0.2, r: 200, color: '80, 60, 180' },
        { x: canvas.width * 0.85, y: canvas.height * 0.6, r: 260, color: '100, 40, 160' },
        { x: canvas.width * 0.5, y: canvas.height * 0.85, r: 180, color: '60, 80, 200' },
      ];

      nebulaPositions.forEach(n => {
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        grad.addColorStop(0, `rgba(${n.color}, 0.06)`);
        grad.addColorStop(1, `rgba(${n.color}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      });

      animFrame = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
};

export default StarField;
