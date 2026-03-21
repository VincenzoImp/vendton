import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  ShieldAlert,
  PenTool,
  Send,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

const steps = [
  {
    id: "request",
    label: "Request",
    icon: Globe,
    color: "#3390EC",
    description: "Agent discovers and calls a paid DVM",
  },
  {
    id: "402",
    label: "402",
    icon: ShieldAlert,
    color: "#F5A623",
    description: "Gateway responds with HTTP 402 Payment Required",
  },
  {
    id: "sign",
    label: "Sign",
    icon: PenTool,
    color: "#8B5CF6",
    description: "Agent signs a USDT payment on TON",
  },
  {
    id: "pay",
    label: "Pay",
    icon: Send,
    color: "#10B981",
    description: "Payment is settled on-chain",
  },
  {
    id: "200",
    label: "200 OK",
    icon: CheckCircle2,
    color: "#3390EC",
    description: "Gateway verifies payment and returns DVM data",
  },
];

interface PaymentFlowProps {
  autoPlay?: boolean;
  onComplete?: () => void;
}

export default function PaymentFlow({
  autoPlay = false,
  onComplete,
}: PaymentFlowProps) {
  const [activeStep, setActiveStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying) return;

    if (activeStep >= steps.length - 1) {
      setIsPlaying(false);
      onComplete?.();
      return;
    }

    const timer = setTimeout(() => {
      setActiveStep((s) => s + 1);
    }, 1200);

    return () => clearTimeout(timer);
  }, [activeStep, isPlaying, onComplete]);

  const startFlow = useCallback(() => {
    setActiveStep(0);
    setIsPlaying(true);
  }, []);

  useEffect(() => {
    if (autoPlay) startFlow();
  }, [autoPlay, startFlow]);

  function resetFlow() {
    setActiveStep(-1);
    setIsPlaying(false);
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6 px-2">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isActive = i === activeStep;
          const isDone = i < activeStep;

          return (
            <div key={step.id} className="flex items-center">
              <motion.div
                className="flex flex-col items-center gap-1"
                animate={{
                  scale: isActive ? 1.15 : 1,
                  opacity: isDone || isActive ? 1 : 0.35,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <motion.div
                  className="flex items-center justify-center w-10 h-10 rounded-full"
                  style={{
                    backgroundColor:
                      isActive || isDone ? step.color : "var(--color-secondary-bg)",
                  }}
                  animate={{
                    boxShadow: isActive
                      ? `0 0 20px ${step.color}66`
                      : "0 0 0px transparent",
                  }}
                >
                  <Icon
                    className="w-5 h-5"
                    style={{
                      color: isActive || isDone ? "#fff" : "var(--color-hint)",
                    }}
                  />
                </motion.div>
                <span
                  className="text-[10px] font-semibold whitespace-nowrap"
                  style={{
                    color: isActive ? step.color : "var(--color-hint)",
                  }}
                >
                  {step.label}
                </span>
              </motion.div>

              {i < steps.length - 1 && (
                <div className="mx-1 mt-[-14px]">
                  <ArrowRight
                    className="w-3 h-3"
                    style={{
                      color:
                        i < activeStep
                          ? "var(--color-primary)"
                          : "var(--color-hint)",
                      opacity: i < activeStep ? 1 : 0.3,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="min-h-[72px] rounded-xl bg-[var(--color-secondary-bg)] p-4 mb-4">
        <AnimatePresence mode="wait">
          {activeStep >= 0 && activeStep < steps.length ? (
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="text-center"
            >
              <p className="text-sm font-medium" style={{ color: steps[activeStep].color }}>
                Step {activeStep + 1} of {steps.length}
              </p>
              <p className="text-sm mt-1 text-[var(--color-text)]">
                {steps[activeStep].description}
              </p>
            </motion.div>
          ) : (
            <motion.p
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-center text-[var(--color-hint)]"
            >
              See how mesh402 handles paid DVM requests
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className="flex justify-center gap-3">
        <button
          onClick={startFlow}
          disabled={isPlaying}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          {activeStep >= steps.length - 1 ? "Replay" : "Start Demo"}
        </button>
        {activeStep >= 0 && (
          <button
            onClick={resetFlow}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all bg-[var(--color-secondary-bg)] text-[var(--color-text)]"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
