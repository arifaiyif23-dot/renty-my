import { motion } from "framer-motion";

export const FloatingParticles = () => {
  const particles = [
    { size: 80, left: "10%", top: "20%", delay: 0 },
    { size: 120, left: "80%", top: "30%", delay: 2 },
    { size: 60, left: "15%", top: "70%", delay: 4 },
    { size: 100, left: "85%", top: "75%", delay: 1 },
    { size: 70, left: "50%", top: "15%", delay: 3 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle, index) => (
        <motion.div
          key={index}
          className="absolute rounded-full bg-gradient-to-br from-primary/20 to-accent/20 blur-3xl"
          style={{
            width: particle.size,
            height: particle.size,
            left: particle.left,
            top: particle.top,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, 15, 0],
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 8,
            delay: particle.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};
