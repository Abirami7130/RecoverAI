'use client'
import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <nav className="fixed top-[18px] left-0 right-0 mx-auto w-[calc(100%-48px)] max-w-[1216px] z-50 rounded-lg bg-dark-navy/80 backdrop-blur-24 shadow-nav transition-all duration-300">
      <div className="flex justify-between items-center px-[24px] md:px-[32px] py-[16px]">
        
        <div className="font-sans font-bold text-[24px] md:text-[32px] text-white tracking-tight">
          RecoverAI
        </div>
        
        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-[32px]">
          <a href="#problem" className="text-cool-gray text-[16px] leading-[24px] hover:text-white transition-colors duration-200">The Problem</a>
          <a href="#solution" className="text-cool-gray text-[16px] leading-[24px] hover:text-white transition-colors duration-200">The Solution</a>
          <a href="#experience" className="text-cool-gray text-[16px] leading-[24px] hover:text-white transition-colors duration-200">Product Experience</a>
          <a href="#revenue" className="text-cool-gray text-[16px] leading-[24px] hover:text-white transition-colors duration-200">Revenue Impact</a>
          <Link href="/login" className="text-app-accent text-[16px] leading-[24px] hover:text-white transition-colors duration-200 font-medium">
            Console
          </Link>
        </div>
        
        {/* Desktop CTA */}
        <a href="#hero" className="hidden md:flex min-w-[160px] h-[40px] px-[24px] py-[8px] bg-light-ice/15 hover:bg-light-ice/25 active:bg-light-ice/35 text-white text-[16px] leading-[24px] rounded transition-colors items-center justify-center">
          Start Recovery
        </a>

        {/* Mobile Hamburger Toggle */}
        <button 
          className="md:hidden flex flex-col gap-[4px] p-2"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle Navigation"
        >
          <span className={`w-6 h-0.5 bg-white transition-transform ${isOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
          <span className={`w-6 h-0.5 bg-white transition-opacity ${isOpen ? 'opacity-0' : ''}`} />
          <span className={`w-6 h-0.5 bg-white transition-transform ${isOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden flex flex-col items-center gap-4 px-[24px] pb-[24px] pt-4 border-t border-white/10 overflow-hidden"
          >
            <a href="#problem" onClick={() => setIsOpen(false)} className="text-cool-gray text-[16px] hover:text-white">The Problem</a>
            <a href="#solution" onClick={() => setIsOpen(false)} className="text-cool-gray text-[16px] hover:text-white">The Solution</a>
            <a href="#experience" onClick={() => setIsOpen(false)} className="text-cool-gray text-[16px] hover:text-white">Product Experience</a>
            <a href="#revenue" onClick={() => setIsOpen(false)} className="text-cool-gray text-[16px] hover:text-white">Revenue Impact</a>
            <a href="#hero" onClick={() => setIsOpen(false)} className="w-full mt-2 h-[40px] flex items-center justify-center bg-light-ice/15 text-white rounded">Start Recovery</a>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}