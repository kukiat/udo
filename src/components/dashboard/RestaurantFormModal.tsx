"use client";

import { useEffect, useRef, useState } from "react";

import {
  BranchFields,
  type BranchFieldsValue,
  emptyBranchFields,
  settingsFromBranchFields,
  tablesFromCount,
} from "@/components/dashboard/BranchFields";
import { ImageUpload, type ImageUploadHandle } from "@/components/ui/ImageUpload";
import { Modal } from "@/components/ui/Modal";
import { PillButton } from "@/components/ui/PillButton";
import { TextInput } from "@/components/ui/TextInput";
import { ErrorState } from "@/components/ui/States";
import { api } from "@/lib/fetcher";

type BranchInput = BranchFieldsValue;

type Mode = "create" | "edit";

type EditTarget = {
  id: string;
  name: string;
  logo: string | null;
};

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (restaurantId: string) => void;
  theme?: "light" | "dark";
} & (
  | { mode?: "create"; restaurant?: undefined }
  | { mode: "edit"; restaurant: EditTarget }
);

export function RestaurantFormModal(props: Props) {
  const {
    isOpen,
    onOpenChange,
    onSaved,
    theme = "light",
  } = props;
  const mode: Mode = props.mode ?? "create";
  const restaurant = mode === "edit" ? props.restaurant : undefined;

  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const logoRef = useRef<ImageUploadHandle>(null);
  const [branches, setBranches] = useState<BranchInput[]>([emptyBranchFields()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branchQuery, setBranchQuery] = useState("");

  // When the modal opens for edit, hydrate fields from the target.
  useEffect(() => {
    if (!isOpen) return;
    if (mode === "edit" && restaurant) {
      setName(restaurant.name);
      setLogo(restaurant.logo ?? "");
    } else {
      setName("");
      setLogo("");
      setBranches([emptyBranchFields()]);
      setBranchQuery("");
    }
    setError(null);
  }, [isOpen, mode, restaurant]);

  const resetCreate = () => {
    setName("");
    setLogo("");
    setBranches([emptyBranchFields()]);
    setBranchQuery("");
    setError(null);
  };

  const updateBranch = (i: number, patch: Partial<BranchInput>) =>
    setBranches((prev) =>
      prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)),
    );

  const addBranch = () => setBranches((prev) => [...prev, emptyBranchFields()]);
  const removeBranch = (i: number) =>
    setBranches((prev) => prev.filter((_, idx) => idx !== i));

  const canSubmit =
    name.trim().length > 0 &&
    (mode === "edit" ||
      (branches.length > 0 &&
        branches.every((b) => b.name.trim().length > 0)));

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const logoUrl = await logoRef.current!.flush();
      if (mode === "edit" && restaurant) {
        await api(`/api/restaurants/${restaurant.id}`, {
          method: "PUT",
          body: JSON.stringify({ name, logo: logoUrl }),
        });
        onSaved(restaurant.id);
      } else {
        const { restaurant: created } = await api<{ restaurant: { id: string } }>(
          "/api/restaurants",
          {
            method: "POST",
            body: JSON.stringify({
              name,
              logo: logoUrl,
              branches: branches.map((b) => ({
                name: b.name,
                address: b.address.trim() || null,
                openingTime: b.openingTime || null,
                closingTime: b.closingTime || null,
                settings: settingsFromBranchFields(b),
                tables: tablesFromCount(b.tables),
              })),
            }),
          },
        );
        resetCreate();
        onSaved(created.id);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : mode === "edit"
            ? "Failed to save restaurant"
            : "Failed to create restaurant",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const eyebrow = mode === "edit" ? "Edit restaurant" : "New restaurant";
  const heading = mode === "edit" ? (name || "Untitled") : "New restaurant";
  const subheading =
    mode === "edit"
      ? "Update restaurant details"
      : "At least one branch required";
  const submitLabel =
    mode === "edit"
      ? submitting
        ? "Saving..."
        : "Save"
      : submitting
        ? "Creating..."
        : "Create restaurant";

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && mode === "create") resetCreate();
        onOpenChange(open);
      }}
      theme={theme}
      className="sm:!max-w-2xl"
      header={
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ink-3)",
            }}
          >
            {eyebrow}
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              marginTop: 2,
              color: "var(--ink)",
            }}
          >
            {heading}
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
            {subheading}
          </div>
        </div>
      }
      footer={
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            style={{
              ...btnGhostStyle,
              opacity: submitting ? 0.5 : 1,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>
          <PillButton
            tone="accent"
            size="lg"
            onClick={submit}
            isDisabled={submitting || !canSubmit}
            className="flex-[2]"
          >
            {submitLabel}
          </PillButton>
        </div>
      }
    >
      <div style={{ color: "var(--ink)", padding: "16px 24px" }}>
        {error && (
          <div style={{ marginBottom: 16 }}>
            <ErrorState message={error} />
          </div>
        )}

        {/* Restaurant section */}
        <section style={{ ...cardStyle }}>
          <div style={{ ...eyebrowStyle, marginBottom: 14 }}>
            {mode === "edit"
              ? "Restaurant details"
              : "Restaurant details"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <ImageUpload
              ref={logoRef}
              deferred
              label="Logo (optional)"
              uploadLabel="Upload logo"
              hint="PNG, JPG or WEBP - square works best"
              value={logo || null}
              onChange={(u) => setLogo(u ?? "")}
            />
            <label style={{ display: "block" }}>
              <span style={labelStyle}>Restaurant name</span>
              <TextInput
                value={name}
                onChange={setName}
                placeholder="Restaurant name"
                width="100%"
                icon={null}
                type="text"
                ariaLabel="Restaurant name"
              />
            </label>
          </div>
        </section>

        {/* Branches section - only when creating. Existing branches are managed
            from the dedicated branches page. */}
        {mode === "create" && (
        <section style={{ marginTop: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div style={eyebrowStyle}>
              Branches ({branches.length})
            </div>
            <div
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              {branches.length > 1 && (
                <TextInput
                  value={branchQuery}
                  onChange={setBranchQuery}
                  placeholder="Search branches"
                  width={220}
                  height={32}
                />
              )}
              <button
                type="button"
                onClick={addBranch}
                style={{
                  ...btnGhostStyle,
                  flex: "none",
                  height: 32,
                  padding: "0 12px",
                  fontSize: 12,
                }}
              >
                Add branch
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {(() => {
              const q = branchQuery.trim().toLowerCase();
              const visible = branches
                .map((b, i) => ({ b, i }))
                .filter(({ b, i }) =>
                  !q
                    ? true
                    : b.name.toLowerCase().includes(q) ||
                      b.address.toLowerCase().includes(q) ||
                      `${i + 1}`.includes(q),
                );
              if (visible.length === 0) {
                return (
                  <div
                    style={{
                      padding: 18,
                      border: "1px dashed var(--line)",
                      borderRadius: 10,
                      textAlign: "center",
                      fontSize: 12,
                      color: "var(--ink-3)",
                    }}
                  >
                    No branches match &ldquo;{branchQuery}&rdquo;
                  </div>
                );
              }
              return visible.map(({ b, i }) => (
                <BranchFields
                  key={i}
                  value={b}
                  onChange={(patch) => updateBranch(i, patch)}
                  idSuffix={i + 1}
                  header={
                    <>
                      <span style={eyebrowStyle}>Branch {i + 1}</span>
                      {branches.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeBranch(i)}
                          aria-label={`Remove branch ${i + 1}`}
                          title="Remove branch"
                          style={iconDangerStyle}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width={14}
                            height={14}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                            <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      )}
                    </>
                  }
                />
              ));
            })()}
          </div>
        </section>
        )}

      </div>
    </Modal>
  );
}

const cardStyle: React.CSSProperties = {
  background: "var(--bg-sunken)",
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: 18,
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--ink-3)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ink-3)",
  fontWeight: 600,
  marginBottom: 6,
};

const btnGhostStyle: React.CSSProperties = {
  flex: 1,
  height: 42,
  borderRadius: 6,
  border: "1px solid var(--line-strong)",
  background: "transparent",
  color: "var(--ink)",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};

const iconDangerStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  padding: 0,
  borderRadius: 6,
  background: "transparent",
  border: "1px solid var(--line-strong)",
  color: "var(--rose)",
  cursor: "pointer",
  transition: "background 0.12s ease, border-color 0.12s ease",
};
