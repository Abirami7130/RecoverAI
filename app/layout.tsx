import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { SimulationProvider } from "@/context/SimulationContext";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "RecoverAI | Autonomous Payment Recovery",
  description: "An autonomous payment-recovery agent that detects failed payments, diagnoses the context, and executes deterministic recovery paths.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/*
        Razorpay browser SDK — loaded lazily so it never blocks the initial render.
        The RAZORPAY_KEY_SECRET is server-only and is NEVER loaded here.
        Only the public key (NEXT_PUBLIC_RAZORPAY_KEY_ID) is used client-side.
      */}
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />
      <body className={`${inter.variable} font-sans antialiased bg-deep-navy text-white overflow-x-hidden min-h-screen`}>
        <SimulationProvider>
          {children}
        </SimulationProvider>
      </body>
    </html>
  );
}