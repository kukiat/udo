"use client";

import {
  Dialog,
  Modal as AriaModal,
  ModalOverlay,
} from "react-aria-components";

import { cn } from "@/lib/cn";

export function Modal({
  isOpen,
  onOpenChange,
  children,
  className,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4 entering:animate-in entering:fade-in"
    >
      <AriaModal
        className={cn(
          "w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-white shadow-xl",
          "rounded-t-card sm:rounded-card border border-line",
          className,
        )}
      >
        <Dialog className="outline-none">{children}</Dialog>
      </AriaModal>
    </ModalOverlay>
  );
}
