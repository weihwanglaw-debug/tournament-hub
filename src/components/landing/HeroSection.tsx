import { motion } from "framer-motion";
import { useLiveConfig } from "@/contexts/LiveConfigContext";
import defaultHeroBg from "@/assets/hero-bg.jpg";

export default function HeroSection() {
  const { cfg } = useLiveConfig();
  const bgImage = cfg.heroImageUrl || defaultHeroBg;

  return (
    <section
      className="relative flex items-center justify-center text-center px-8 overflow-hidden"
      style={{
        minHeight: "520px",
        paddingTop: "6rem",
        paddingBottom: "5rem",
      }}
    >
      {/* Background image with parallax-like effect */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${bgImage})`,
          transform: "scale(1.05)",
          transition: "transform 8s ease-out",
        }}
      />

      {/* Dark overlay with gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.75) 100%)",
        }}
      />

      {/* Animated accent line */}
      <motion.div
        className="absolute bottom-0 left-0 h-1"
        style={{ backgroundColor: "var(--color-primary)" }}
        initial={{ width: "0%" }}
        animate={{ width: "100%" }}
        transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
      />

      {/* Content */}
      <div className="max-w-3xl mx-auto relative z-10">
        <motion.h1
          className="font-heading font-bold text-4xl md:text-5xl lg:text-6xl leading-tight mb-6"
          style={{ color: "#ffffff" }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {cfg.heroTitle}
        </motion.h1>
        <motion.p
          className="text-lg md:text-xl max-w-2xl mx-auto"
          style={{ color: "rgba(255,255,255,0.8)" }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          {cfg.heroSubtitle}
        </motion.p>

        {/* Decorative floating particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full"
              style={{
                backgroundColor: "var(--color-primary)",
                opacity: 0.4,
                left: `${20 + i * 15}%`,
                top: `${30 + (i % 3) * 20}%`,
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0.2, 0.6, 0.2],
              }}
              transition={{
                duration: 3 + i * 0.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.4,
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
