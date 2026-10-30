'use client';

import { useRef, useState } from 'react';

/**
 * Razorpay types for the browser SDK loaded via checkout.js.
 * We keep the global declaration minimal to avoid duplicating the full SDK types.
 */
declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  theme: { color: string };
  handler: (response: RazorpaySuccessResponse) => void;
  modal: {
    ondismiss: () => void;
  };
  retry?: { enabled: boolean };
}

interface RazorpayInstance {
  on(event: string, handler: (response: RazorpayFailureResponse) => void): void;
  open(): void;
  close(): void;
}

interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayFailureResponse {
  error: {
    code: string;
    description: string;
    reason: string;
    source: string;
    step: string;
    metadata?: {
      order_id?: string;
      payment_id?: string;
      payment_method?: string;
    };
  };
}

type CheckoutStatus =
  | 'idle'
  | 'creating-order'
  | 'checkout-open'
  | 'verifying'
  | 'triggering-ml'
  | 'success'
  | 'failure-injected'
  | 'cancelled'
  | 'error';

/** Fixed demo amount in INR for the test checkout. */
const DEMO_AMOUNT_INR = 499;

export default function CheckoutButton() {
  const [status, setStatus] = useState<CheckoutStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const failureHandlingStarted = useRef(false);

  const isLoading =
    status === 'creating-order' ||
    status === 'checkout-open' ||
    status === 'verifying' ||
    status === 'triggering-ml';

  async function handlePaymentSuccess(response: RazorpaySuccessResponse) {
    setStatus('verifying');

    // ── Server-side signature verification ──────────────────────────────────
    const verifyRes = await fetch('/api/payment/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      }),
    });

    if (!verifyRes.ok) {
      setStatus('error');
      setErrorMsg('Signature verification failed. This payment may be fraudulent.');
      return;
    }

    // Payment succeeded — no recovery flow needed.
    setStatus('success');
  }

  async function handlePaymentFailure(
    failureResponse: RazorpayFailureResponse,
    orderId: string,
    amountInPaise: number
  ) {
    failureHandlingStarted.current = true;
    setStatus('triggering-ml');

    const { error } = failureResponse;
    const amountInr = amountInPaise / 100;

    // ── Forward to the bridge → FastAPI → simulation injection ───────────────
    const triggerRes = await fetch('/api/recovery/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: error.metadata?.payment_id ?? null,
        amountInr,
        errorCode: error.code,
        errorDescription: error.description,
        errorReason: error.reason,
        payment_method: error.metadata?.payment_method,
      }),
    });

    if (!triggerRes.ok) {
      const detail = await triggerRes.json().catch(() => ({}));
      // If FastAPI is offline, surface a helpful message rather than silently failing
      const hint = (detail as { hint?: string }).hint;
      setStatus('error');
      setErrorMsg(
        hint
          ? `ML service unavailable. ${hint}`
          : 'Could not trigger the recovery pipeline. Please check console.'
      );
      return;
    }

    setStatus('failure-injected');
  }

  async function startCheckout() {
    setStatus('creating-order');
    setErrorMsg(null);
    failureHandlingStarted.current = false;

    // ── 1. Create a Razorpay order server-side ───────────────────────────────
    const orderRes = await fetch('/api/payment/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: DEMO_AMOUNT_INR }),
    });

    if (!orderRes.ok) {
      setStatus('error');
      setErrorMsg('Could not create a Razorpay order. Check your API keys.');
      return;
    }

    const orderData = (await orderRes.json()) as {
      order_id: string;
      amount: number;
      currency: string;
    };

    // ── 2. Ensure the Razorpay browser SDK is loaded ─────────────────────────
    if (typeof window === 'undefined' || !window.Razorpay) {
      setStatus('error');
      setErrorMsg('Razorpay checkout SDK is not loaded. Check your network connection.');
      return;
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    if (!keyId) {
      setStatus('error');
      setErrorMsg('NEXT_PUBLIC_RAZORPAY_KEY_ID is not configured.');
      return;
    }

    setStatus('checkout-open');

    // ── 3. Open the Razorpay checkout modal ──────────────────────────────────
    const rzp = new window.Razorpay({
      key: keyId,
      amount: orderData.amount,
      currency: orderData.currency,
      name: 'RecoverAI',
      description: 'Test Payment — RecoverAI Demo',
      order_id: orderData.order_id,
      theme: { color: '#7DD3FC' },

      // SUCCESS path: verify signature server-side
      handler: (response: RazorpaySuccessResponse) => {
        handlePaymentSuccess(response);
      },

      modal: {
        ondismiss: () => {
          if (failureHandlingStarted.current) {
            return;
          }
          setStatus('cancelled');
        },
      },

      // Disable the SDK's built-in retry screen so that our rzp.close()
      // call in the payment.failed handler is not overridden by the SDK's
      // own internal "Retry payment" state transition.
      retry: { enabled: false },
    });

    // FAILURE path: capture the Razorpay error and trigger ML recovery
    rzp.on('payment.failed', (response: RazorpayFailureResponse) => {
      // Defer by one macrotask so the SDK finishes its internal state
      // transition before we close the modal, avoiding the race where
      // the SDK's "Retry payment" screen overrides our close call.
      setTimeout(() => rzp.close(), 0);
      handlePaymentFailure(response, orderData.order_id, orderData.amount);
    });

    rzp.open();
  }

  // ── Status-aware button label ────────────────────────────────────────────
  function label(): string {
    switch (status) {
      case 'creating-order':  return 'Preparing…';
      case 'checkout-open':   return 'Checkout Open…';
      case 'verifying':       return 'Verifying…';
      case 'triggering-ml':   return 'Analysing Failure…';
      case 'success':         return '✓ Payment Successful';
      case 'failure-injected':return '⚡ Recovery Triggered';
      case 'cancelled':       return 'Start Recovery';
      case 'error':           return 'Retry';
      default:                return 'Start Recovery';
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={startCheckout}
        disabled={isLoading}
        className={`
          inline-flex min-w-[160px] h-[40px] px-[24px] py-[8px]
          rounded transition-colors items-center justify-center
          font-sans font-normal text-[16px] leading-[24px]
          ${
            status === 'success'
              ? 'bg-green-500/20 text-green-300 cursor-default'
              : status === 'failure-injected'
              ? 'bg-amber/20 text-amber cursor-default'
              : status === 'error'
              ? 'bg-coral-red/20 text-coral-red hover:bg-coral-red/30'
              : isLoading
              ? 'bg-light-ice/10 text-white/60 cursor-wait'
              : 'bg-light-ice/15 hover:bg-light-ice/25 active:bg-light-ice/35 text-white'
          }
        `}
      >
        {isLoading && (
          <span className="mr-2 inline-block w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
        )}
        {label()}
      </button>

      {/* Contextual status messages */}
      {status === 'failure-injected' && (
        <p className="text-[12px] text-amber/80 text-center max-w-[280px]">
          Razorpay failure detected. RecoverAI ML pipeline is now processing
          the recovery decision — watch the timeline above.
          <br />
          <span className="text-[11px] text-white/40">
            Recovery outcome is a simulated prediction, not an actual fund transfer.
          </span>
        </p>
      )}

      {status === 'success' && (
        <p className="text-[12px] text-green-400/80 text-center max-w-[280px]">
          Signature verified. Payment succeeded — no recovery needed.
        </p>
      )}

      {status === 'cancelled' && (
        <p className="text-[12px] text-white/50 text-center max-w-[280px]">
          Checkout dismissed. Click again to retry.
        </p>
      )}

      {status === 'error' && errorMsg && (
        <p className="text-[12px] text-coral-red/80 text-center max-w-[300px]">
          {errorMsg}
        </p>
      )}

      {/* Test-mode hint */}
      {status === 'idle' || status === 'cancelled' ? (
        <p className="text-[11px] text-white/30 text-center max-w-[260px]">
          Uses Razorpay Test Mode — no real money is charged.
        </p>
      ) : null}
    </div>
  );
}
