'use client';

export default function OpenRecoveryCheckoutButton({
  orderId,
  amountPaise,
}: {
  orderId: string;
  amountPaise: number;
}) {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

  if (!keyId) {
    return (
      <p className="text-[13px] text-app-ink-soft">
        Set NEXT_PUBLIC_RAZORPAY_KEY_ID to open recovery checkout in the browser.
      </p>
    );
  }

  return (
    <button
      type="button"
      className="min-h-[40px] px-[16px] py-[10px] rounded-[8px] bg-app-accent text-app-accent-ink font-semibold text-[14px]"
      onClick={() => {
        const RazorpayCtor = (
          window as unknown as {
            Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
          }
        ).Razorpay;
        if (!RazorpayCtor) {
          alert('Razorpay checkout script is still loading.');
          return;
        }
        const rzp = new RazorpayCtor({
          key: keyId,
          order_id: orderId,
          amount: amountPaise,
          currency: 'INR',
          name: 'RecoverAI recovery order',
          description: 'Pay an existing recovery order (test mode)',
        });
        rzp.open();
      }}
    >
      Open recovery checkout
    </button>
  );
}
