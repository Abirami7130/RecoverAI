'use client'
import { motion } from 'framer-motion'
import LiveRecoveryPath from './LiveRecoveryPath'
import CheckoutButton from './CheckoutButton'

export default function ExperienceSection() {
  return (
    <section className="relative w-full min-h-[1113px] bg-light-lavender pt-[160px] pb-[160px] flex flex-col items-center">
      
      {/* 
        Gradient Overlay for Transition 
        rgba(2,4,8,1.00) 0%, rgba(223,226,243,0.80) 50%, rgba(15,19,31,1.00) 100% (reversed via to-t)
      */}
      <div className="absolute inset-0 bg-experience-gradient pointer-events-none" />

      <div className="relative z-10 w-full max-w-[1200px] px-[24px] md:px-[40px] flex flex-col items-center">
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex flex-col items-center text-center mb-[64px]"
        >
          <h2 className="font-sans font-semibold text-[36px] md:text-[48px] leading-[44px] md:leading-[56px] tracking-[-0.48px] text-white shadow-heading">
            Live Recovery Path
          </h2>
        </motion.div>

        <p className="font-sans text-[14px] text-cool-gray/90 mt-[12px] max-w-[640px] text-center">
          Demo timeline. Captured revenue is shown separately inside the console.
        </p>

        <LiveRecoveryPath />

        {/* Final CTA within Experience Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-[120px] flex justify-center"
        >
          <CheckoutButton />
        </motion.div>

      </div>
    </section>
  )
}