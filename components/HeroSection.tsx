'use client'
import { motion } from 'framer-motion'

export default function HeroSection() {
  return (
    <section className="relative w-full h-[100svh] min-h-[600px] md:h-[800px] bg-deep-navy pt-[160px] md:pt-[228px] pb-[120px] md:pb-[260px] flex flex-col items-center justify-center overflow-hidden">
      
      {/* Background Image @ 70% opacity */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-70 pointer-events-none"
        style={{ backgroundImage: "url('/hero-bg.jpg')" }} 
      />
      
      {/* Linear Gradient Overlay fading to Light Lavender bottom */}
      <div className="absolute inset-0 bg-hero-gradient pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[1200px] flex flex-col items-center text-center px-[24px] md:px-[40px]"
      >
        <h1 className="font-sans font-bold text-[40px] leading-[48px] md:text-[80px] md:leading-[88px] tracking-[-1.6px] text-white shadow-hero-text">
          Recover the Revenue You Didn't Know You <span className="text-light-ice">Lost.</span>
        </h1>
        
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="mt-[16px] md:mt-[24px] font-sans font-normal text-[16px] md:text-[20px] leading-[26px] md:leading-[32px] text-cool-gray max-w-[800px]"
        >
          An autonomous payment-recovery agent that detects failed payments, diagnoses the context, and executes deterministic recovery paths.
        </motion.p>
      </motion.div>
    </section>
  )
}