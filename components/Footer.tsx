export default function Footer() {
  return (
    <footer className="w-full bg-deep-navy py-[48px] flex justify-center">
      <div className="w-full max-w-[1200px] px-[24px] md:px-[40px] flex flex-col md:flex-row justify-between items-center gap-[24px] md:gap-0">
        
        {/* Brand */}
        <div className="font-sans font-semibold text-[24px] md:text-[32px] leading-[40px] text-white tracking-tight">
          RecoverAI
        </div>

        {/* Links */}
        <div className="flex flex-wrap justify-center gap-[24px] md:gap-[32px]">
          <a href="#problem" className="font-sans font-normal text-[16px] leading-[24px] text-cool-gray hover:text-white transition-colors duration-200">
            The Problem
          </a>
          <a href="#solution" className="font-sans font-normal text-[16px] leading-[24px] text-cool-gray hover:text-white transition-colors duration-200">
            The Solution
          </a>
          <a href="#experience" className="font-sans font-normal text-[16px] leading-[24px] text-cool-gray hover:text-white transition-colors duration-200">
            Product Experience
          </a>
        </div>

        {/* Copyright */}
        <div className="font-sans font-normal text-[14px] leading-[24px] text-cool-gray">
          © {new Date().getFullYear()} RecoverAI. All rights reserved.
        </div>
        
      </div>
    </footer>
  )
}