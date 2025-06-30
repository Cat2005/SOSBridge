"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import EmergencyForm from "@/components/EmergencyForm";
import Chat from "@/components/Chat";
import ErrorBanner from "@/components/ErrorBanner";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface EmergencyData {
  serviceNeeded: string;
  description: string;
  location: { latitude: number; longitude: number } | null;
  manualAddress: string | null;
  browserLanguage: string;
  timestamp: string;
}

export default function Home() {
  const [error, setError] = useState<string | null>(null);
  const [emergencyData, setEmergencyData] = useState<EmergencyData | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleEmergencySubmit = (data: EmergencyData) => {
    setEmergencyData(data);
  };

  const handleBackToForm = () => {
    setEmergencyData(null);
    setError(null);
  };

  return (
    <div
      className={`${
        emergencyData ? "h-full" : "min-h-full"
      } flex flex-col items-center justify-center p-4 relative bg-[#0E1017]`}
    >
      {/* Warning Banner */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#0EB268]/90 border-b border-[#0EB268] backdrop-blur-sm">
        <div className="px-2 sm:px-4 py-2 sm:py-3">
          <div className="text-center">
            <p className="text-white text-xs sm:text-sm leading-tight">
              <span className="block sm:inline">
                ⚠️ We've disabled calling in this public demo to protect our
                personal numbers.
              </span>{" "}
              <span className="block sm:inline mt-1 sm:mt-0">
                <a
                  href="https://www.youtube.com/watch?v=3Nn6ITHqrCM"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-100 hover:text-white underline font-medium"
                >
                  Watch the demo
                </a>{" "}
                or{" "}
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="text-green-100 hover:text-white underline font-medium bg-transparent border-none cursor-pointer p-0"
                >
                  run it yourself
                </button>{" "}
                to see it in action.
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto bg-[#1a1f2e] border-[#0EB268] text-gray-100 m-2">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl font-bold text-[#0EB268] mb-4">
              Run SOSBridge Yourself
            </DialogTitle>
            <DialogDescription className="text-gray-300 text-left space-y-3 sm:space-y-4 text-sm sm:text-base leading-relaxed">
              <p>
                SOSBridge is designed to connect users to real emergency
                services — but for obvious reasons, calling 999/112 for testing
                or demo purposes isn't allowed.
              </p>
              <p>
                Instead, during development we used our own personal phone
                numbers to simulate emergency responders. To avoid leaking those
                numbers or spamming them, we've disabled all call functionality
                in the public version of the demo.
              </p>
              <p className="font-semibold text-[#0EB268]">
                Want to try it yourself?
              </p>
              <p>
                You can run the full experience safely using your own Twilio
                number:
              </p>
              <ol className="list-decimal list-inside space-y-2 ml-2 sm:ml-4 text-sm sm:text-base">
                <li>
                  Create a Twilio account and set up a phone number (see Twilio
                  docs).
                </li>
                <li>
                  Clone the repo and add your API keys in a .env.local file.
                </li>
                <li>
                  Run the app locally or deploy it with your own mock emergency
                  number.
                </li>
              </ol>
              <p>
                Or,{" "}
                <a
                  href="https://www.youtube.com/watch?v=3Nn6ITHqrCM"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0EB268] hover:text-green-300 underline font-medium"
                >
                  watch the full demo on YouTube
                </a>{" "}
                to see how SOSBridge works end-to-end.
              </p>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Bolt logo in top-right corner */}
      <a
        href="https://bolt.new"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-20 right-2 sm:top-30 sm:right-4 z-10"
        title="Powered by Bolt"
      >
        <Image
          src="/bolt-logo.svg"
          alt="Bolt"
          width={75}
          height={75}
          className="object-contain w-10 h-10 sm:w-24 sm:h-24 md:w-24 md:h-24 "
        />
      </a>

      {error && (
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
      )}

      {/* Main Content with top padding to account for banner */}
      <div className="pt-12 sm:pt-16 w-full h-full flex flex-col items-center justify-center">
        {emergencyData ? (
          // Show Chat component when emergency data is available
          <div className="w-full h-full">
            <Chat emergencyData={emergencyData} onBack={handleBackToForm} />
          </div>
        ) : (
          // Show Emergency Form when no emergency data
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-md"
          >
            {/* Header */}
            <div className="text-center mb-8 flex items-center justify-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="relative"
              >
                <Image
                  src="/web-logo.svg"
                  alt="Logo"
                  width={250}
                  height={250}
                  className="object-contain"
                  priority
                />
              </motion.div>
            </div>

            {/* Main Form Card */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <EmergencyForm
                onError={setError}
                onSubmit={handleEmergencySubmit}
              />
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
