'use client'
import { motion } from 'framer-motion'
import GlassCard from './GlassCard'
import RevenueRecovered from './RevenueRecovered'
import { IconAlert, IconImpact, IconDecide, IconAct } from './Icons'

export default function MixedSection() {
  return (
    <section className="relative w-full bg-light-lavender flex flex-col items-center pt-[160px] pb-[160px]">
      
      {/* Dark Band Background starting behind Steps 03-04 */}
      <div className="absolute top-[330px] bottom-[160px] left-0 right-0 bg-deep-navy z-0" />

      <div className="relative z-10 w-full max-w-[1200px] px-[24px] md:px-[40px] flex flex-col gap-[24px]">
        
        {/* Row 1: Steps 01 and 02 (Light Theme) */}
        <div className="flex flex-col md:flex-row gap-[24px]">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="flex-1">
            <GlassCard variant="light" className="h-full min-h-[142px] flex flex-col justify-center gap-[8px]">
              <div className="font-sans font-bold text-[12px] leading-[16px] tracking-[1.2px] text-light-ice uppercase">
                01 — RISK DETECTED
              </div>
              <h3 className="font-sans font-semibold text-[32px] leading-[40px] text-dark-navy">Initial Failure</h3>
              <div className="flex items-center gap-[8px] mt-[4px]">
                <IconAlert className="text-coral-red w-[22px] h-[19px]" />
                <span className="font-sans font-medium text-[14px] leading-[20px] text-dark-navy/70">Payment attempt declined by issuer.</span>
              </div>
            </GlassCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }} className="flex-1">
            <GlassCard variant="light" className="h-full min-h-[142px] flex flex-col justify-center gap-[8px]">
              <div className="font-sans font-bold text-[12px] leading-[16px] tracking-[1.2px] text-light-ice uppercase">
                02 — IMPACT PREDICTED
              </div>
              <h3 className="font-sans font-semibold text-[32px] leading-[40px] text-dark-navy">Revenue at Risk</h3>
              <div className="flex items-center gap-[8px] mt-[4px]">
                <IconImpact className="text-dark-navy w-[19px] h-[18px]" />
                <span className="font-sans font-medium text-[14px] leading-[20px] text-dark-navy/70">High probability of permanent churn.</span>
              </div>
            </GlassCard>
          </motion.div>
        </div>

        {/* Row 2: Steps 03 and 04 (Dark Theme inside Dark Band) */}
        <div className="flex flex-col md:flex-row gap-[24px] mt-[24px] md:mt-[48px]">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.3 }} className="flex-1">
            <GlassCard variant="dark" className="h-full min-h-[196px] flex flex-col justify-start gap-[8px]">
              <div className="font-sans font-bold text-[12px] leading-[16px] tracking-[1.2px] text-ice-blue uppercase">
                03 — AI DECISION
              </div>
              <h3 className="font-sans font-semibold text-[32px] leading-[40px] text-white">Optimal Strategy</h3>
              <div className="flex items-center gap-[8px] mt-[4px]">
                <IconDecide className="text-ice-blue w-[23px] h-[21px]" />
                <span className="font-sans font-medium text-[14px] leading-[20px] text-white/70">Alternative payment path identified.</span>
              </div>
            </GlassCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.4 }} className="flex-1">
            <GlassCard variant="dark" className="h-full min-h-[196px] flex flex-col justify-start gap-[8px]">
              <div className="font-sans font-bold text-[12px] leading-[16px] tracking-[1.2px] text-ice-blue uppercase">
                04 — ACTION EXECUTED
              </div>
              <h3 className="font-sans font-semibold text-[32px] leading-[40px] text-white">Fallback Activated</h3>
              <div className="flex items-center gap-[8px] mt-[4px]">
                <IconAct className="text-ice-blue w-[19px] h-[23px]" />
                <span className="font-sans font-medium text-[14px] leading-[20px] text-white/70">Silent recovery request dispatched.</span>
              </div>
            </GlassCard>
          </motion.div>
        </div>

        {/* Revenue Recovered Section (Placed inside the dark band area) */}
        <div className="mt-[120px]">
          <RevenueRecovered />
        </div>
        
      </div>
    </section>
  )
}