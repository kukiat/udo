"use client";

import { TextInput } from "@/components/ui/TextInput";
import { TimePicker } from "@/components/ui/TimePicker";

/** Editable shape of a single branch's form fields. */
export type BranchFieldsValue = {
  name: string;
  address: string;
  openingTime: string;
  closingTime: string;
  maxKds: string;
  vat: string;
  service: string;
  tables: number;
};

export const TABLES_MIN = 1;
export const TABLES_MAX = 50;

export const emptyBranchFields = (): BranchFieldsValue => ({
  name: "",
  address: "",
  openingTime: "09:00",
  closingTime: "22:00",
  maxKds: "3",
  vat: "7",
  service: "0",
  tables: TABLES_MIN,
});

export function normalizeBranchTime(value: string | null | undefined) {
  return value ? value.slice(0, 5) : "";
}

/**
 * True when closing falls on the next day (e.g. open 18:00, close 02:00). Both
 * times are zero-padded "HH:MM", so a plain string compare orders them.
 */
export function isOvernight(opening?: string | null, closing?: string | null) {
  if (!opening || !closing) return false;
  return closing < opening;
}

/** A floor of `count` tables, numbered "1".."count" (matches the API seed). */
export const tablesFromCount = (count: number): string[] =>
  Array.from({ length: count }, (_, i) => String(i + 1));

/** Map a saved branch into form fields (settings rates are stored 0–1). */
export function branchFieldsFromSettings(b: {
  name: string;
  address: string | null;
  openingTime?: string | null;
  closingTime?: string | null;
  settings: { maxKdsScreens: number; vatRate: number; serviceChargeRate: number };
  tables?: number;
}): BranchFieldsValue {
  return {
    name: b.name,
    address: b.address ?? "",
    openingTime: normalizeBranchTime(b.openingTime) || "09:00",
    closingTime: normalizeBranchTime(b.closingTime) || "22:00",
    maxKds: String(b.settings.maxKdsScreens),
    vat: String(Math.round(b.settings.vatRate * 100)),
    service: String(Math.round(b.settings.serviceChargeRate * 100)),
    tables: b.tables ?? TABLES_MIN,
  };
}

/** Build the API settings payload (rates back to 0–1) from form fields. */
export function settingsFromBranchFields(v: BranchFieldsValue) {
  return {
    maxKdsScreens: Number(v.maxKds),
    vatRate: Number(v.vat) / 100,
    serviceChargeRate: Number(v.service) / 100,
  };
}

type Props = {
  value: BranchFieldsValue;
  onChange: (patch: Partial<BranchFieldsValue>) => void;
  /** Disambiguates aria labels when several cards render at once. */
  idSuffix?: string | number;
  /** Optional row rendered at the top of the card (e.g. "BRANCH 1" + remove). */
  header?: React.ReactNode;
  /** Lower bound for the tables stepper (edit clamps to existing count). */
  tablesMin?: number;
  /** Extra rows rendered below the stepper (e.g. an Active/Inactive toggle). */
  children?: React.ReactNode;
};

/**
 * The branch detail card (name, address, KDS/VAT/service, table count) shared
 * by the restaurant-creation modal and the branches page so create and edit
 * stay visually identical.
 */
export function BranchFields({
  value,
  onChange,
  idSuffix = "",
  header,
  tablesMin = TABLES_MIN,
  children,
}: Props) {
  const min = Math.max(TABLES_MIN, tablesMin);
  const suffix = idSuffix === "" ? "" : ` ${idSuffix}`;

  return (
    <div style={cardStyle}>
      {header && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          {header}
        </div>
      )}

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
        <label style={{ display: "block" }}>
          <span style={labelStyle}>Branch name</span>
          <TextInput
            value={value.name}
            onChange={(v) => onChange({ name: v })}
            placeholder="Branch name"
            width="100%"
            icon={null}
            type="text"
            ariaLabel={`Branch name${suffix}`}
          />
        </label>
        <label style={{ display: "block" }}>
          <span style={labelStyle}>Address</span>
          <TextInput
            value={value.address}
            onChange={(v) => onChange({ address: v })}
            placeholder="Optional"
            width="100%"
            icon={null}
            type="text"
            ariaLabel={`Branch address${suffix}`}
          />
        </label>
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr", marginTop: 12 }}>
        <label style={{ display: "block" }}>
          <span style={labelStyle}>Opening time</span>
          <TimePicker
            value={value.openingTime}
            onChange={(v) => onChange({ openingTime: v })}
            width="100%"
            ariaLabel={`Branch opening time${suffix}`}
          />
        </label>
        <label style={{ display: "block" }}>
          <span style={labelStyle}>
            Closing time
            {isOvernight(value.openingTime, value.closingTime) && (
              <span style={overnightBadgeStyle}>+1 day</span>
            )}
          </span>
          <TimePicker
            value={value.closingTime}
            onChange={(v) => onChange({ closingTime: v })}
            width="100%"
            ariaLabel={`Branch closing time${suffix}`}
          />
        </label>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(3, 1fr)",
          marginTop: 12,
        }}
      >
        <label style={{ display: "block" }}>
          <span style={labelStyle}>Max KDS screens</span>
          <TextInput
            value={value.maxKds}
            onChange={(v) => onChange({ maxKds: v })}
            type="number"
            min={1}
            mono
            icon={null}
            width="100%"
            ariaLabel={`Max KDS screens${suffix}`}
          />
        </label>
        <label style={{ display: "block" }}>
          <span style={labelStyle}>VAT %</span>
          <TextInput
            value={value.vat}
            onChange={(v) => onChange({ vat: v })}
            type="number"
            min={0}
            mono
            icon={null}
            width="100%"
            ariaLabel={`Branch VAT %${suffix}`}
          />
        </label>
        <label style={{ display: "block" }}>
          <span style={labelStyle}>Service %</span>
          <TextInput
            value={value.service}
            onChange={(v) => onChange({ service: v })}
            type="number"
            min={0}
            mono
            icon={null}
            width="100%"
            ariaLabel={`Branch service %${suffix}`}
          />
        </label>
      </div>

      <div style={{ marginTop: 12 }}>
        <span style={labelStyle}>
          Tables{" "}
          <span style={{ color: "var(--ink-4)", fontWeight: 400 }}>
            ({min}-{TABLES_MAX})
          </span>
        </span>
        <div style={stepperStyle}>
          <button
            type="button"
            onClick={() => onChange({ tables: Math.max(min, value.tables - 1) })}
            disabled={value.tables <= min}
            aria-label={`Decrease table count${suffix}`}
            style={{
              ...stepperBtnStyle,
              opacity: value.tables <= min ? 0.4 : 1,
              cursor: value.tables <= min ? "not-allowed" : "pointer",
            }}
          >
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={min}
            max={TABLES_MAX}
            step={1}
            value={value.tables}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                onChange({ tables: min });
                return;
              }
              const n = Math.floor(Number(raw));
              if (!Number.isFinite(n)) return;
              onChange({ tables: Math.max(min, Math.min(TABLES_MAX, n)) });
            }}
            onBlur={(e) => {
              const n = Math.floor(Number(e.target.value));
              const clamped = Number.isFinite(n)
                ? Math.max(min, Math.min(TABLES_MAX, n))
                : min;
              if (clamped !== value.tables) onChange({ tables: clamped });
            }}
            aria-label={`Table count${suffix}`}
            style={stepperInputStyle}
          />
          <button
            type="button"
            onClick={() =>
              onChange({ tables: Math.min(TABLES_MAX, value.tables + 1) })
            }
            disabled={value.tables >= TABLES_MAX}
            aria-label={`Increase table count${suffix}`}
            style={{
              ...stepperBtnStyle,
              opacity: value.tables >= TABLES_MAX ? 0.4 : 1,
              cursor: value.tables >= TABLES_MAX ? "not-allowed" : "pointer",
            }}
          >
            ＋
          </button>
        </div>
      </div>

      {children}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "var(--bg-sunken)",
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: 18,
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

const overnightBadgeStyle: React.CSSProperties = {
  marginLeft: 8,
  padding: "1px 6px",
  borderRadius: 999,
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.06em",
  color: "var(--accent)",
  background: "var(--accent-soft)",
};

const stepperStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 0,
  border: "1px solid var(--line-strong)",
  borderRadius: 6,
  background: "var(--bg-elev)",
  overflow: "hidden",
};

const stepperBtnStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "none",
  color: "var(--ink)",
  fontSize: 16,
  fontWeight: 600,
  padding: 0,
};

const stepperInputStyle: React.CSSProperties = {
  width: 56,
  height: 36,
  textAlign: "center",
  fontVariantNumeric: "tabular-nums",
  fontSize: 14,
  fontWeight: 600,
  color: "var(--ink)",
  background: "transparent",
  border: "none",
  borderLeft: "1px solid var(--line-strong)",
  borderRight: "1px solid var(--line-strong)",
  outline: "none",
  padding: 0,
  MozAppearance: "textfield",
};
