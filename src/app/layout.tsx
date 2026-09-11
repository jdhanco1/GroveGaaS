import type { Metadata } from "next";
import { RegisterServiceWorker } from "./register-sw";
import "./globals.css";
import "@/components/grove/grove.css";

export const metadata: Metadata = {
  title: {
    default: "GroveGaaS",
    template: "%s | GroveGaaS",
  },
  description: "Track generator refuels, run time, and reported issues.",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="grove-theme flex min-h-full flex-col">
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
