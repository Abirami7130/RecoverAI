'use client'

import { motion } from 'framer-motion'
import GlassCard from './GlassCard'
import { useSimulation } from '@/context/SimulationContext'

export default function RevenueRecovered() {
  const {
    revenueRecovered,
    transactionsSaved,
    formatLakhs,
  } = useSimulation()

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="w-full max-w-[896px] mx-auto relative z-10"
    >
      {/* Connecting Gradient Line */}
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

        <div className="relative z-10 flex flex-col items-center w-full">

          <div className="font-sans font-bold text-[12px] leading-[16px] tracking-[1.2px] text-ice-blue uppercase mb-[8px]">
            REVENUE RECOVERED
          </div>

          <motion.h2
            key={revenueRecovered}
            animate={{
              textShadow: [
                '0 0 25px rgba(125,211,252,0.40)',
                '0 0 35px rgba(125,211,252,0.80)',
                '0 0 25px rgba(125,211,252,0.40)',
              ],
            }}
            transition={{
              textShadow: {
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut',
              },
            }}
            className="font-sans font-bold text-[64px] md:text-[80px] leading-[72px] md:leading-[88px] text-light-ice tracking-[-1.6px]"
          >
            ₹{formatLakhs(revenueRecovered)}L
          </motion.h2>

          <div className="w-[96px] h-[1px] bg-light-ice/30 my-[24px]" />

          <motion.h3
            key={transactionsSaved}
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 1 }}
            className="font-sans font-semibold text-[24px] md:text-[32px] leading-[32px] md:leading-[40px] text-white text-center mb-[8px]"
          >
            {transactionsSaved} transactions saved
          </motion.h3>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.9, duration: 0.6 }}
            className="font-sans font-normal text-[16px] md:text-[20px] leading-[24px] md:leading-[32px] text-cool-gray text-center max-w-[600px]"
          >
            The intelligence loop identified and automatically converted silent payment failures back into active revenue.
          </motion.p>

        </div>
      </GlassCard>
    </motion.div>
  )
}