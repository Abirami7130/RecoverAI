'use client';

import { motion } from 'framer-motion';
import GlassCard from './GlassCard';
import RevenueFigures from './metrics/RevenueFigures';
import { useSimulation } from '@/context/SimulationContext';

export default function RevenueRecovered() {
  const { accounting, formatLakhs } = useSimulation();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="w-full max-w-[896px] mx-auto relative z-10"
    >
      <motion.div
        initial={{ scaleY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="absolute left-1/2 -translate-x-1/2 -top-[64px] w-[2px] h-[64px] bg-gradient-to-b from-light-ice/30 to-light-ice pointer-events-none origin-top"
      />

      <GlassCard
        variant="dark"
        className="flex flex-col items-center justify-center p-[48px] shadow-glow-revenue-card relative overflow-visible"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(125,211,252,0.10)_0%,transparent_70%)] pointer-events-none rounded-[12px]" />

        <RevenueFigures accounting={accounting} formatLakhs={formatLakhs} />

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="font-sans font-normal text-[15px] leading-[24px] text-cool-gray text-center max-w-[640px] mt-[24px]"
        >
          Demo timeline outcomes are simulated. Verified recovered revenue is shown
          separately and stays at zero until a payment is captured in a later phase.
        </motion.p>
      </GlassCard>
    </motion.div>
  );
}
