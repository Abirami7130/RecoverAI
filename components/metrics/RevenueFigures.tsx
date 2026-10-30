'use client';

import { RecoveryAccounting } from '@/lib/types';

interface RevenueFiguresProps {
  accounting: RecoveryAccounting;
  formatLakhs: (val: number) => string;
}

export default function RevenueFigures({
  accounting,
  formatLakhs,
}: RevenueFiguresProps) {
  return (
    <div className="relative z-10 flex flex-col items-center w-full gap-[20px]">
      <div className="font-sans font-bold text-[12px] leading-[16px] tracking-[1.2px] text-ice-blue uppercase">
        Revenue metrics (labeled)
      </div>

      <div className="w-full max-w-[640px] flex flex-col gap-[16px] text-left">
        <div className="rounded-[8px] border border-light-ice/20 bg-white/5 p-[16px]">
          <div className="font-sans font-bold text-[11px] tracking-[1.1px] text-cool-gray uppercase mb-[4px]">
            Illustrative sample
          </div>
          <div className="font-sans font-bold text-[28px] text-light-ice">
            ₹{formatLakhs(accounting.illustrativeSampleRecoveredInr)}L
          </div>
          <p className="font-sans text-[13px] text-cool-gray mt-[4px]">
            {accounting.illustrativeSampleLabel}
          </p>
        </div>

        <div className="rounded-[8px] border border-amber/30 bg-amber/5 p-[16px]">
          <div className="font-sans font-bold text-[11px] tracking-[1.1px] text-amber uppercase mb-[4px]">
            Simulated this session
          </div>
          <div className="font-sans font-bold text-[28px] text-light-ice">
            ₹{accounting.sessionSimulatedRecoveredInr.toLocaleString('en-IN')}
          </div>
          <p className="font-sans text-[13px] text-cool-gray mt-[4px]">
            From Python simulate_recovery only — not verified captures (
            {accounting.sessionSimulatedTransactions} simulated transaction
            {accounting.sessionSimulatedTransactions === 1 ? '' : 's'}).
          </p>
        </div>

        <div className="rounded-[8px] border border-green-500/20 bg-green-500/5 p-[16px]">
          <div className="font-sans font-bold text-[11px] tracking-[1.1px] text-green-400 uppercase mb-[4px]">
            Verified captures
          </div>
          <div className="font-sans font-bold text-[28px] text-light-ice">
            ₹{accounting.verifiedRecoveredInr.toLocaleString('en-IN')}
          </div>
          <p className="font-sans text-[13px] text-cool-gray mt-[4px]">
            Only Razorpay payments confirmed captured ({accounting.verifiedTransactions}{' '}
            verified).
          </p>
        </div>
      </div>
    </div>
  );
}
