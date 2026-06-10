"use client";

import { useId } from "react";

import {
  Dialog,
  Modal as AriaModal,
  ModalOverlay,
} from "react-aria-components";

import { CloseButton } from "@/components/ui/CloseButton";
import { cn } from "@/lib/cn";

export function Modal({
  isOpen,
  onOpenChange,
  children,
  className,
  showClose = true,
  header,
  footer,
  ariaLabel,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
  /** Hide the built-in top-right close icon (e.g. when the content renders its own). */
  showClose?: boolean;
  /** Accessible dialog name; falls back to the `header` content, then "Dialog". */
  ariaLabel?: string;
  /**
   * Sticky header content. When provided, the modal switches to a fixed
   * header + scrollable body layout — the header (and footer) stay put while
   * only `children` scroll. The close icon is rendered inside this header.
   */
  header?: React.ReactNode;
  /** Sticky footer content (e.g. action buttons). Pinned to the modal bottom. */
  footer?: React.ReactNode;
}) {
  const structured = header != null || footer != null;
  const headerId = useId();
  // React Aria requires every Dialog to have an accessible name; label by the
  // header when one is rendered, otherwise fall back to a plain aria-label.
  const labelProps =
    ariaLabel != null
      ? { "aria-label": ariaLabel }
      : header != null
        ? { "aria-labelledby": headerId }
        : { "aria-label": "Dialog" };

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4 entering:animate-in entering:fade-in"
    >
      <AriaModal
        style={{
          background: "var(--bg-elev)",
          borderColor: "var(--line)",
        }}
        className={cn(
          "w-full sm:max-w-lg max-h-[92vh] shadow-xl",
          "rounded-t-card sm:rounded-card border",
          structured ? "flex flex-col overflow-hidden" : "overflow-y-auto",
          className,
        )}
      >
        {structured ? (
          <Dialog
            {...labelProps}
            className="flex min-h-0 flex-1 flex-col outline-none"
          >
            {header != null && (
              <div
                className="flex flex-shrink-0 items-start justify-between gap-3 px-5 py-4"
                style={{ borderBottom: "1px solid var(--line)" }}
              >
                <div id={headerId} className="min-w-0 flex-1">
                  {header}
                </div>
                {showClose && (
                  <CloseButton
                    onPress={() => onOpenChange(false)}
                    className="-mr-1.5 -mt-0.5 flex-shrink-0"
                  />
                )}
              </div>
            )}

            {/* Only the body scrolls. */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {/* When there's no header, the close icon floats over the body. */}
              {header == null && showClose && (
                <div className="pointer-events-none sticky top-0 z-[60] h-0">
                  <CloseButton
                    onPress={() => onOpenChange(false)}
                    className="pointer-events-auto absolute right-3 top-3"
                  />
                </div>
              )}
              {children}
            </div>

            {footer != null && (
              <div
                className="flex-shrink-0 px-5 py-4"
                style={{ borderTop: "1px solid var(--line)" }}
              >
                {footer}
              </div>
            )}
          </Dialog>
        ) : (
          <Dialog {...labelProps} className="outline-none">
            {showClose && (
              // Zero-height sticky wrapper keeps the icon pinned to the modal's
              // top-right even while the body scrolls.
              <div className="pointer-events-none sticky top-0 z-[60] h-0">
                <CloseButton
                  onPress={() => onOpenChange(false)}
                  className="pointer-events-auto absolute right-3 top-3"
                />
              </div>
            )}
            {children}
          </Dialog>
        )}
      </AriaModal>
    </ModalOverlay>
  );
}
