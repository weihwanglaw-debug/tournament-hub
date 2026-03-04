import { motion } from "framer-motion";
import config from "@/data/config.json";

export default function HeroSection() {
  return (
    <section
      className="relative flex items-center justify-center text-center px-8"
      style={{
        background: "var(--color-hero-bg)",
        color: "var(--color-hero-text)",
        minHeight: "420px",
        paddingTop: "6rem",
        paddingBottom: "4rem",
      }}
    >
      <div className="max-w-3xl mx-auto">
        <motion.h1
          className="font-heading font-bold text-4xl md:text-5xl lg:text-6xl leading-tight mb-6"
          style={{ color: "var(--color-hero-text)" }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {config.hero.title}
        </motion.h1>
        <motion.p
          className="text-lg md:text-xl opacity-80 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          {config.hero.subtitle}
        </motion.p>
      </div>
    </section>
  );
}
