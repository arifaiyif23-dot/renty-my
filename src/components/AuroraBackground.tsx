import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface AuroraBackgroundProps {
  className?: string;
  children?: React.ReactNode;
  variant?: "hero" | "accent" | "empty";
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

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      time += 0.003;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const blobs = [
        { x: 0.2, y: 0.3, r: 0.4, color: "hsla(224, 65%, 18%, 0.06)" },
        { x: 0.8, y: 0.5, r: 0.35, color: "hsla(217, 80%, 54%, 0.05)" },
        { x: 0.5, y: 0.7, r: 0.3, color: "hsla(224, 65%, 18%, 0.04)" },
      ];

      blobs.forEach((blob, i) => {
        const x = w * (blob.x + Math.sin(time + i * 2) * 0.08);
        const y = h * (blob.y + Math.cos(time * 0.7 + i * 1.5) * 0.08);
        const r = w * blob.r;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
        gradient.addColorStop(0, blob.color);
        gradient.addColorStop(1, "transparent");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
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

  const heightClass = variant === "hero" ? "min-h-[60vh]" : variant === "empty" ? "min-h-[40vh]" : "min-h-[30vh]";

  return (
    <div className={cn("relative overflow-hidden", heightClass, className)}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
};

export { AuroraBackground };
