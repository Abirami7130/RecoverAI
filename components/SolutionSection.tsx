'use client'

import { motion } from 'framer-motion'
import GlassCard from './GlassCard'
import {
  IconDetect,
  IconDiagnose,
  IconPredict,
  IconDecide,
  IconAct,
} from './Icons'
import { useSimulation } from '@/context/SimulationContext'

export default function SolutionSection() {
  const {
    metrics,
    riskScore,
    activeRecovery,
  } = useSimulation()

  const steps = [
    {
      label: 'DETECT',
      icon: IconDetect,
      step: 1,
    },
    {
      label: 'DIAGNOSE',
      icon: IconDiagnose,
      step: 2,
    },
    {
      label: 'PREDICT',
      icon: IconPredict,
      step: 3,
    },
    {
      label: 'DECIDE',
      icon: IconDecide,
      step: 4,
    },
    {
      label: 'ACT',
      icon: IconAct,
      step: 5,
    },
  ]

  const riskLevel =
    riskScore >= 60
      ? 'HIGH RISK'
      : riskScore >= 35
        ? 'ELEVATED RISK'
        : 'LOW RISK'

  const riskColor =
    riskScore >= 60
      ? 'text-coral-red'
      : riskScore >= 35
        ? 'text-amber'
        : 'text-ice-blue'

  return (
    <section className="relative w-full min-h-[700px] bg-dark-slate py-[100px] md:py-[140px] flex flex-col items-center overflow-hidden">

      {/* Ambient background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(125,211,252,0.06)_0%,transparent_55%)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-[1200px] px-[24px] md:px-[40px] flex flex-col items-center">

        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex flex-col items-center text-center mb-[56px]"
        >
          <div className="font-sans font-bold text-[12px] leading-[16px] tracking-[1.2px] text-white uppercase mb-[16px]">
            THE SOLUTION
          </div>

          <h2 className="font-sans font-semibold text-[36px] md:text-[48px] leading-[44px] md:leading-[56px] tracking-[-0.48px] text-white shadow-heading">
            The Intelligence Loop
          </h2>

          <p className="mt-[16px] max-w-[650px] font-sans text-[15px] md:text-[17px] leading-[26px] text-cool-gray">
            RecoverAI continuously monitors payment-provider signals,
            predicts failure risk, and automatically activates the
            appropriate recovery path.
          </p>
        </motion.div>

        {/* Pipeline */}
        <div className="relative w-full flex flex-col md:flex-row justify-between items-center gap-[16px] md:gap-[16px]">

          {/* Connector */}
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
            className="hidden md:block absolute top-[64px] left-[112px] right-[112px] h-[2px] bg-gradient-to-r from-transparent via-ice-blue to-transparent origin-left z-0"
          />

          {steps.map((step, index) => {
            const Icon = step.icon
            const isActive = activeRecovery.step === step.step
            const isCompleted = activeRecovery.step > step.step

            return (
              <motion.div
                key={step.label}
                initial={{
                  opacity: 0,
                  scale: 0.95,
                  y: 20,
                }}
                whileInView={{
                  opacity: 1,
                  scale: 1,
                  y: 0,
                }}
                viewport={{
                  once: true,
                  margin: '-50px',
                }}
                transition={{
                  duration: 0.5,
                  delay: 0.15 * index,
                  ease: 'easeOut',
                }}
                className="w-full md:w-[224px] z-10"
              >
                <GlassCard
                  variant={
                    isActive || isCompleted
                      ? 'active'
                      : 'dark'
                  }
                  className={`h-[112px] ${
                    isActive
                      ? 'md:h-[128px] md:-mt-[8px]'
                      : ''
                  } flex flex-col items-center justify-center gap-[8px] p-[12px] hover:bg-dark-navy/70 hover:-translate-y-[2px] transition-all`}
                >
                  <div
                    className={`
                      flex items-center justify-center rounded-full border
                      ${
                        isActive
                          ? 'w-[80px] h-[80px] bg-card-dark-alt border-ice-blue/60 shadow-glow-active-icon'
                          : isCompleted
                            ? 'w-[64px] h-[64px] bg-card-dark-alt border-ice-blue/40'
                            : 'w-[64px] h-[64px] bg-card-dark border-white/8'
                      }
                    `}
                  >
                    {isActive && (
                      <motion.div
                        animate={{
                          scale: [1, 1.15, 1],
                          opacity: [0.2, 0.35, 0.2],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                        className="absolute w-[78px] h-[78px] rounded-full bg-ice-blue/20 blur-[24px] pointer-events-none"
                      />
                    )}

                    <Icon
                      className={`
                        relative z-10
                        ${
                          isActive
                            ? 'w-[29px] h-[30px] text-ice-blue'
                            : isCompleted
                              ? 'w-[21px] h-[21px] text-ice-blue'
                              : 'w-[21px] h-[21px] text-white'
                        }
                      `}
                    />
                  </div>

                  <span
                    className={`
                      font-sans font-bold text-[12px] leading-[16px]
                      tracking-[1.2px] uppercase
                      ${
                        isActive || isCompleted
                          ? 'text-ice-blue'
                          : 'text-white'
                      }
                    `}
                  >
                    {step.label}
                  </span>
                </GlassCard>
              </motion.div>
            )
          })}
        </div>

        {/* Live Intelligence Panel */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="w-full max-w-[896px] mt-[56px]"
        >
          <GlassCard
            variant="dark"
            className="p-[24px] md:p-[32px]"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-[24px]">

              {/* Provider signals */}
              <div className="flex-1">
                <div className="font-sans font-bold text-[11px] leading-[16px] tracking-[1.2px] text-cool-gray uppercase mb-[16px]">
                  LIVE PROVIDER SIGNALS
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-[12px]">

                  <div className="rounded-[8px] bg-white/5 border border-white/5 p-[12px]">
                    <div className="text-[11px] text-cool-gray mb-[4px]">
                      LATENCY
                    </div>
                    <div className="font-bold text-[17px] text-white">
                      {metrics.latencyMs} ms
                    </div>
                  </div>

                  <div className="rounded-[8px] bg-white/5 border border-white/5 p-[12px]">
                    <div className="text-[11px] text-cool-gray mb-[4px]">
                      SUCCESS
                    </div>
                    <div className="font-bold text-[17px] text-white">
                      {metrics.successRate.toFixed(1)}%
                    </div>
                  </div>

                  <div className="rounded-[8px] bg-white/5 border border-white/5 p-[12px]">
                    <div className="text-[11px] text-cool-gray mb-[4px]">
                      ERRORS
                    </div>
                    <div className="font-bold text-[17px] text-white">
                      {metrics.errorRate.toFixed(1)}%
                    </div>
                  </div>

                  <div className="rounded-[8px] bg-white/5 border border-white/5 p-[12px]">
                    <div className="text-[11px] text-cool-gray mb-[4px]">
                      TIMEOUTS
                    </div>
                    <div className="font-bold text-[17px] text-white">
                      {metrics.timeoutRate.toFixed(1)}%
                    </div>
                  </div>

                </div>
              </div>

              {/* Risk prediction */}
              <div className="md:w-[220px] md:border-l md:border-white/10 md:pl-[28px] flex flex-col items-center md:items-start">

                <div className="font-sans font-bold text-[11px] leading-[16px] tracking-[1.2px] text-cool-gray uppercase mb-[4px]">
                  AI FAILURE RISK
                </div>

                <div className={`font-sans font-bold text-[48px] leading-[56px] ${riskColor}`}>
                  {riskScore}%
                </div>

                <div className={`font-sans font-bold text-[11px] tracking-[1px] ${riskColor}`}>
                  {riskLevel}
                </div>

              </div>

            </div>
          </GlassCard>
        </motion.div>

      </div>
    </section>
  )
}