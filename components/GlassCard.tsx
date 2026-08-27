import { ReactNode } from 'react'

interface GlassCardProps {
  variant: 'dark' | 'light' | 'active'
  children: ReactNode
  className?: string
}

export default function GlassCard({ variant, children, className = '' }: GlassCardProps) {
  const baseStyles = 'backdrop-blur-16 rounded-[12px] relative overflow-hidden transition-all duration-300'
  
  const variants = {
    dark: 'bg-dark-navy/60 border border-white/[0.08] shadow-card-dark p-[12px]',
    light: 'bg-white/80 border border-black/10 shadow-card-light p-[24px]',
    active: 'bg-card-dark-alt/90 shadow-card-dark p-[12px]',
  }

  return (
    <div className={`${baseStyles} ${variants[variant]} ${className}`}>
      {(variant === 'dark' || variant === 'active') && (
        <div className="absolute top-0 left-0 right-0 h-[40%] bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
      )}
      <div className="relative z-10 w-full h-full flex flex-col">
        {children}
      </div>
    </div>
  )
}