'use client';

import { motion } from 'framer-motion';

export default function LoaderDots() {
  const dotVariants = {
    initial: { y: 0 },
    animate: { y: -10 },
  };

  const containerVariants = {
    initial: {},
    animate: {
      transition: {
        staggerChildren: 0.2,
        repeat: Infinity,
        repeatType: 'reverse' as const,
        duration: 0.6,
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate="animate"
      className="flex space-x-1 items-center justify-center"
      role="status"
      aria-label="Loading"
    >
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={i}
          variants={dotVariants}
          className="w-2 h-2 bg-neutral-400 dark:bg-slate-500 rounded-full"
        />
      ))}
    </motion.div>
  );
}