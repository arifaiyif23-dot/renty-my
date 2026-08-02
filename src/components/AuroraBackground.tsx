import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface AuroraBackgroundProps {
  className?: string;
  children?: React.ReactNode;
  variant?: "hero" | "accent" | "empty";
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

const AuroraBackground = ({ className, children, variant = "accent" }: AuroraBackgroundProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let time = 0;
    const particles: Particle[] = [];
    const isMobile = window.innerWidth < 768;
    const particleCount = isMobile ? 12 : 30;

    const resize = () => {
      canvas.width = canvas.offsetWidth * (isMobile ? 1 : window.devicePixelRatio);
      canvas.height = canvas.offsetHeight * (isMobile ? 1 : window.devicePixelRatio);
      if (!isMobile) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.002,
        vy: (Math.random() - 0.5) * 0.002,
        size: Math.random() * 3 + 1,
        alpha: Math.random() * 0.3 + 0.1,
      });
    }

    const draw = () => {
      time += 0.0015;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      const blobs = [
        { x: 0.15, y: 0.25, r: 0.45, color: "hsla(217, 80%, 54%, 0.15)" },
        { x: 0.85, y: 0.45, r: 0.4, color: "hsla(280, 60%, 50%, 0.12)" },
        { x: 0.5, y: 0.75, r: 0.35, color: "hsla(152, 60%, 40%, 0.10)" },
        { x: 0.25, y: 0.6, r: 0.3, color: "hsla(217, 80%, 54%, 0.08)" },
        { x: 0.7, y: 0.2, r: 0.25, color: "hsla(280, 60%, 50%, 0.10)" },
      ];

      blobs.forEach((blob, i) => {
        const x = w * (blob.x + Math.sin(time + i * 1.8) * 0.06);
        const y = h * (blob.y + Math.cos(time * 0.6 + i * 1.3) * 0.06);
        const r = w * blob.r;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
        gradient.addColorStop(0, blob.color);
        gradient.addColorStop(1, "transparent");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      });

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > 1) p.vx *= -1;
        if (p.y < 0 || p.y > 1) p.vy *= -1;

        const px = w * p.x;
        const py = h * p.y;
        const pulse = Math.sin(time * 3 + p.x * 10) * 0.3 + 0.7;

        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(217, 80%, 70%, ${p.alpha * pulse})`;
        ctx.fill();
      });

      animationId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const heightClass = variant === "hero" ? "min-h-[70vh]" : variant === "empty" ? "min-h-[40vh]" : "min-h-[30vh]";

  return (
    <div className={cn("relative overflow-hidden", heightClass, className)}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ willChange: "transform" }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-noise opacity-[0.03] pointer-events-none" aria-hidden="true" />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
};

export { AuroraBackground };
