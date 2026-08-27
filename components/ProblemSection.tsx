'use client'

import { motion } from 'framer-motion'
import GlassCard from './GlassCard'
import { IconWarning } from './Icons'
import { useSimulation } from '@/context/SimulationContext'

export default function ProblemSection() {
  const {
    riskExposure,
    riskScore,
    formatLakhs,
  } = useSimulation()

  return (
    <section className="relative w-full min-h-[720px] bg-light-lavender py-[120px] md:py-[160px] flex flex-col items-center">

      {/* Background texture and gradient */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-10 pointer-events-none"
        style={{ backgroundImage: "url('/hero-bg.jpg')" }}
      />

      <div className="absolute inset-0 bg-problem-gradient pointer-events-none" />

      <div className="relative z-10 w-full max-w-[1200px] px-[24px] md:px-[40px] flex flex-col md:flex-row gap-[48px] md:gap-[24px] items-center">

        {/* Left Column */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="flex-1 flex flex-col items-start text-left"
        >
          <div className="font-sans font-bold text-[12px] leading-[16px] tracking-[1.2px] text-light-ice uppercase mb-[24px]">
            THE PROBLEM
          </div>

          <h2 className="font-sans font-semibold text-[36px] md:text-[48px] leading-[44px] md:leading-[56px] tracking-[-0.48px] text-dark-navy mb-[24px]">
            Silent Leaks.
            <br />
            Massive Impact.
          </h2>

          <p className="font-sans font-normal text-[16px] md:text-[20px] leading-[26px] md:leading-[32px] text-dark-navy/80 max-w-[500px]">
            Merchants lose critical revenue when payment attempts fail, but a generic retry can be wasteful or ineffective. Different failure situations require contextual recovery responses.
          </p>
        </motion.div>

        {/* Right Column */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          className="flex-1 w-full max-w-[588px]"
        >
          <GlassCard
            variant="dark"
            className="h-[400px] flex flex-col items-center justify-center p-[48px]"
          >
            {/* Inner Radial Glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(197,234,255,0.20)_0%,transparent_50%)] pointer-events-none" />

            <div className="flex items-center gap-[8px] mb-[16px]">
              <IconWarning className="text-coral-red w-[16px] h-[20px]" />

              <span className="font-sans font-bold text-[14px] leading-[20px] tracking-[1.4px] text-coral-red uppercase">
                CURRENT RISK EXPOSURE
              </span>
            </div>

            <h3 className="font-sans font-bold text-[64px] md:text-[80px] leading-[72px] md:leading-[88px] tracking-[-1.6px] text-white z-10 drop-shadow-subtle">
              ₹{formatLakhs(riskExposure)}L
            </h3>

            {/* Live Failure Risk */}
            <div className="flex items-center gap-[8px] mt-[12px] z-10">
              <span className="font-sans font-semibold text-[13px] tracking-[0.6px] text-cool-gray uppercase">
                FAILURE RISK
              </span>

              <span className="font-sans font-bold text-[16px] text-coral-red">
                {riskScore}%
              </span>
            </div>

            <p className="font-sans font-medium text-[14px] leading-[20px] tracking-[0.7px] text-cool-gray mt-[16px] z-10 text-center max-w-[280px]">
              Average monthly revenue trapped in abandoned or unsupported failure states.
            </p>
          </GlassCard>
        </motion.div>

      </div>
    </section>
  )
}