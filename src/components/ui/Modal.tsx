"use client";

import { useId } from "react";

import {
  Dialog,
  Modal as AriaModal,
  ModalOverlay,
} from "react-aria-components";

import { CloseButton } from "@/components/ui/CloseButton";
import { cn } from "@/lib/cn";

export type ModalTheme = "light" | "dark";

/**
 * Common modal shell: fixed header (title + close icon top-right),
 * scrollable content section, and fixed footer. Only the content
 * scrolls — header and footer always stay in view.
 *
 * Theming: `theme="dark"` applies the shared dark token set
 * (`kds-theme kds-dark` from globals.css) so the surface, borders and
 * every `var(--…)`-driven child restyle together. Default is light.
 */
export function Modal({
  isOpen,
  onOpenChange,
  children,
  className,
  contentClassName,
  showClose = true,
  title,
  header,
  footer,
  theme = "light",
  ariaLabel,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Content section — the only part of the modal that scrolls. */
  children: React.ReactNode;
  className?: string;
  /** Extra classes for the scrollable content wrapper (e.g. padding overrides). */
  contentClassName?: string;
  /** Hide the built-in top-right close icon (e.g. when the content renders its own). */
  showClose?: boolean;
  /** Convenience header: rendered as a styled heading. Ignored when `header` is set. */
  title?: React.ReactNode;
  /** Custom header content. Rendered in the fixed header row next to the close icon. */
  header?: React.ReactNode;
  /** Footer content (e.g. action buttons). Pinned to the modal bottom. */
  footer?: React.ReactNode;
  /** Light (default) or dark surface. */
  theme?: ModalTheme;
  /** Accessible dialog name; falls back to the header content, then "Dialog". */
  ariaLabel?: string;
}) {
  const headerContent =
    header ??
    (title != null ? (
      <h2 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
        {title}
      </h2>
    ) : null);
  const headerId = useId();
  // React Aria requires every Dialog to have an accessible name; label by the
  // header when one is rendered, otherwise fall back to a plain aria-label.
  const labelProps =
    ariaLabel != null
      ? { "aria-label": ariaLabel }
      : headerContent != null
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
          "flex w-full flex-col overflow-hidden sm:max-w-lg max-h-[92vh] shadow-xl",
          "rounded-t-card sm:rounded-card border",
          theme === "dark" && "kds-theme kds-dark",
          className,
        )}
      >
        <Dialog
          {...labelProps}
          className="flex min-h-0 flex-1 flex-col outline-none"
        >
          {headerContent != null && (
            <div
              className="flex flex-shrink-0 items-start justify-between gap-3 px-5 py-4"
              style={{ borderBottom: "1px solid var(--line)" }}
            >
              <div id={headerId} className="min-w-0 flex-1">
                {headerContent}
              </div>
              {showClose && (
                <CloseButton
                  onPress={() => onOpenChange(false)}
                  className="-mr-1.5 -mt-0.5 flex-shrink-0"
                />
              )}
            </div>
          )}

          {/* Only the content section scrolls. */}
          <div
            className={cn("min-h-0 flex-1 overflow-y-auto", contentClassName)}
          >
            {/* When there's no header, the close icon floats over the content,
                pinned to the modal's top-right via a zero-height sticky wrapper. */}
            {headerContent == null && showClose && (
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
      </AriaModal>
    </ModalOverlay>
  );
}
