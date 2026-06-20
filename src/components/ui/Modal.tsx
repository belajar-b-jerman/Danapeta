import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";

type ModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
};

export function Modal({ open, title, children, onClose }: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-ink/30 px-3 pb-3 pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-sm md:items-center md:p-6">
          <button className="absolute inset-0 cursor-default" aria-label="Tutup modal" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="relative flex max-h-[calc(100dvh-env(safe-area-inset-top)-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-surface shadow-soft"
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-muted px-4 py-3">
              <h2 className="text-lg font-semibold text-ink">{title}</h2>
              <Button variant="ghost" className="h-11 w-11 p-0" aria-label="Tutup" onClick={onClose}>
                <X size={20} aria-hidden="true" />
              </Button>
            </div>
            <div className="min-h-0 overflow-y-auto px-4 py-4">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
