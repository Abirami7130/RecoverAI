'use client'
import { motion, AnimatePresence } from 'framer-motion'
import GlassCard from './GlassCard'
import { useSimulation } from '@/context/SimulationContext'
import { 
  IconTimelineError, 
  IconTimelineAnalyze, 
  IconTimelineClock, 
  IconTimelineCalendar, 
  IconTimelineSuccess 
} from './Icons'

export default function LiveRecoveryPath() {
  const { activeRecovery, latestDecision, formatCurrency } = useSimulation()

  const timelineSteps = [
    {
      id: 1,
      title: 'Initial Failure Detected',
      meta: 'Payment gateway rejected attempt due to timeout.',
      icon: IconTimelineError,
      color: 'coral-red',
      bgOpacity: 'bg-coral-red/10',
      dotGlow: 'shadow-glow-failure',
      dotColor: 'bg-muted-red/30'
    },
    {
      id: 2,
      title: 'AI Agent Diagnosing...',
      meta: '',
      codeBlock: 'Analyzing historical deposit patterns across 30 days.', 
      icon: IconTimelineAnalyze,
      color: 'light-ice',
      bgOpacity: 'bg-light-ice/10',
      dotGlow: 'shadow-glow-analysis',
      dotColor: 'bg-light-ice/30'
    },
    {
      id: 3,
      title: 'Optimal Window Predicted',
      meta: 'Calculated highest probability for retry success.',
      icon: IconTimelineClock,
      color: 'ice-blue',
      bgOpacity: 'bg-ice-blue/15',
      dotGlow: 'shadow-glow-predict',
      dotColor: 'bg-ice-blue/30'
    },
    {
      id: 4,
      title: 'Recovery Scheduled',
      meta: 'Execution queued for targeted time window.',
      icon: IconTimelineCalendar,
      color: 'amber',
      bgOpacity: 'bg-amber/10',
      dotGlow: 'shadow-glow-schedule',
      dotColor: 'bg-amber/30'
    },
    {
      id: 5,
      title: 'Payment Recovered',
      meta: 'Funds successfully captured.',
      icon: IconTimelineSuccess,
      color: 'ice-blue',
      bgOpacity: 'bg-ice-blue/15',
      dotGlow: 'shadow-glow-recovered',
      dotColor: 'bg-ice-blue/40',
      isFinal: true
    }
  ]

  const visibleSteps = timelineSteps.filter(step => step.id <= activeRecovery.step)
  
  // Prioritize the locked historical decision for this event to maintain logical 
  // consistency, while still gracefully falling back to the live latestDecision
  const displayDecision = activeRecovery.decision || latestDecision;

  return (
    <GlassCard variant="light" className="w-full max-w-[896px] mx-auto p-[24px] md:p-[48px] min-h-[689px]">
      
      {/* Header Row */}
      <div className="flex justify-between items-center pb-[12px] border-b border-light-ice/30 mb-[48px]">
        <div className="flex flex-col gap-[7.5px]">
          <span className="font-sans font-bold text-[14px] leading-[20px] tracking-[1.4px] text-ice-blue">
            ID: #{activeRecovery.id}
          </span>
          <span className="font-sans font-bold text-[32px] leading-[40px] text-dark-navy transition-all">
            ₹{formatCurrency(activeRecovery.amount)}
          </span>
        </div>
        <div className="inline-flex items-center px-[16px] py-[6px] bg-ice-blue/20 rounded-full">
          <span className="font-sans font-bold text-[12px] leading-[16px] tracking-[1.2px] text-ice-blue uppercase">
            {activeRecovery.step === 5 ? 'Recovered' : 'Processing'}
          </span>
        </div>
      </div>

      {/* Timeline Container */}
      <div className="relative w-full max-w-[766px] flex flex-col">
        
        {/* Vertical Timeline Line */}
        <motion.div 
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1.5, ease: "linear" }}
          className="absolute left-[17px] top-[16px] bottom-[30px] w-[2px] bg-black/5 origin-top z-0 hidden md:block"
        />

        {/* Dynamic Timeline Steps */}
        <AnimatePresence>
          {visibleSteps.map((step, index) => {
            const Icon = step.icon
            return (
              <motion.div 
                key={`${activeRecovery.id}-${step.id}`}
                initial={{ opacity: 0, x: -20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className={`relative z-10 flex flex-row gap-[16px] md:gap-[24px] items-start w-full overflow-hidden ${step.isFinal ? '' : 'pb-[48px]'}`}
              >
                <div className={`w-[36px] h-[36px] flex-shrink-0 flex items-center justify-center rounded-[8px] ${step.bgOpacity}`}>
                  <Icon className={`w-[20px] h-[20px] text-${step.color}`} />
                </div>
                
                <div className="flex flex-col gap-[4px] flex-1 pb-1">
                  <h4 className="font-sans font-bold text-[16px] leading-[24px] text-dark-navy">{step.title}</h4>
                  
                  {step.meta && (
                    <p className="font-sans font-medium text-[14px] leading-[20px] text-dark-navy/70">{step.meta}</p>
                  )}

                  {/* Dynamic Decision Render */}
                  {step.id === 2 && displayDecision && displayDecision.recommendedAction !== 'NO_ACTION' ? (
                    <div className="mt-[8px] bg-light-ice/10 border border-light-ice/20 rounded-[8px] p-[16px] flex flex-col gap-[12px]">
                      <p className="font-sans font-medium text-[14px] leading-[20px] text-dark-navy">
                        {displayDecision.diagnosis}
                      </p>
                      
                      <div className="flex flex-col gap-[4px] pt-[12px] border-t border-light-ice/20">
                        <span className="font-sans font-bold text-[12px] leading-[16px] tracking-[1.2px] text-ice-blue uppercase">
                          Recovery Decision
                        </span>
                        <span className="font-sans font-semibold text-[14px] leading-[20px] text-dark-navy">
                          {displayDecision.actionLabel}
                        </span>
                      </div>
                      
                      <div className="flex flex-col md:flex-row md:justify-between gap-[4px] md:gap-0 pt-[4px]">
                        <span className="font-sans font-medium text-[12px] leading-[16px] text-dark-navy/70">
                          Alternate route: <span className="font-semibold text-dark-navy">{displayDecision.useAlternateRoute ? 'Enabled' : 'Not required'}</span>
                        </span>
                        <span className="font-sans font-medium text-[12px] leading-[16px] text-dark-navy/70">
                          AI confidence: <span className="font-bold text-ice-blue">{(displayDecision.confidence * 100).toFixed(0)}%</span>
                        </span>
                      </div>
                    </div>
                  ) : step.codeBlock ? (
                    // Fallback to static codeblock if no decision exists
                    <div className="mt-[4px] bg-light-ice/10 border border-light-ice/20 rounded-[8px] p-[12px]">
                      <code className="font-sans font-medium text-[14px] leading-[20px] text-dark-navy">{step.codeBlock}</code>
                    </div>
                  ) : null}
                </div>

                {/* Trailing Dot */}
                <div className="hidden md:flex flex-col justify-center h-[36px] ml-auto">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className={`w-[12px] h-[12px] rounded-full ${step.dotColor} ${step.dotGlow}`}
                    style={step.isFinal ? { animation: 'pulse-glow 2s infinite ease-in-out' } : {}}
                  />
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 15px rgba(125,211,252,0.50); }
          50% { box-shadow: 0 0 25px rgba(125,211,252,1); }
        }
      `}} />
    </GlassCard>
  )
}