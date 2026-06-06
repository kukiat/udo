import { z } from "zod";

// Money as a string with up to 2 decimals (matches Drizzle numeric output).
// z.coerce.string() keeps the output type a clean `string` (numbers are
// String()-ified before validation).
const MONEY_RE = /^\d+(\.\d{1,2})?$/;
const money = z.coerce.string().regex(MONEY_RE, "Invalid money value");

// Nullable money: accepts a valid money string, blank, or null. Callers
// normalize blank → null via normalizeMoney().
const optionalMoney = z
  .union([z.string().regex(MONEY_RE, "Invalid money value"), z.literal("")])
  .nullish();

/** Coerce an optional money field to a clean string or null. */
export function normalizeMoney(v: string | null | undefined): string | null {
  return v === "" || v === null || v === undefined ? null : v;
}

const menuItemStatus = z.enum(["available", "sold_out", "hidden"]);
const branchTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Invalid time value")
  .nullable()
  .optional();

// Image reference: an absolute http(s) URL or a local upload path (/uploads/..).
const imageUrl = z
  .string()
  .max(1000)
  .refine((v) => /^https?:\/\//.test(v) || v.startsWith("/"), {
    message: "Must be a URL or an uploaded image path",
  });

// --- Branches ---------------------------------------------------------------

export const branchSettingsSchema = z.object({
  maxKdsScreens: z.number().int().min(1).max(50),
  vatRate: z.number().min(0).max(1),
  serviceChargeRate: z.number().min(0).max(1),
});

// A branch as supplied inline when creating a restaurant (no restaurantId yet).
// `tables` lets the operator seed the floor layout at setup time so the
// waitstaff page no longer needs an add-table affordance.
const branchInputSchema = z.object({
  name: z.string().min(1).max(160),
  address: z.string().max(500).nullable().optional(),
  openingTime: branchTime,
  closingTime: branchTime,
  settings: branchSettingsSchema.optional(),
  tables: z
    .array(z.string().trim().min(1).max(20))
    .max(500)
    .optional(),
});

export const branchCreateSchema = branchInputSchema.extend({
  restaurantId: z.string().uuid(),
});

// --- Restaurants ------------------------------------------------------------

export const restaurantCreateSchema = z.object({
  name: z.string().min(1).max(160),
  logo: imageUrl.nullable().optional(),
  // A restaurant must be created with at least one branch.
  branches: z.array(branchInputSchema).min(1),
});

export const restaurantUpdateSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  logo: imageUrl.nullable().optional(),
});

export const branchUpdateSchema = branchCreateSchema
  .omit({ restaurantId: true })
  .partial()
  .extend({ isActive: z.boolean().optional() });

// --- Categories -------------------------------------------------------------

export const categoryCreateSchema = z.object({
  restaurantId: z.string().uuid(),
  parentId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(120),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).default(0),
  image: imageUrl.nullable().optional(),
});

export const categoryUpdateSchema = categoryCreateSchema
  .omit({ restaurantId: true })
  .partial();

// --- Menu items (nested option groups + items) ------------------------------

export const optionItemSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  price: money.default("0"),
  sortOrder: z.number().int().min(0).default(0),
});

export const optionGroupSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(120),
    required: z.boolean().default(false),
    minSelect: z.number().int().min(0).default(0),
    maxSelect: z.number().int().min(1).default(1),
    sortOrder: z.number().int().min(0).default(0),
    optionItems: z.array(optionItemSchema).default([]),
  })
  .refine((g) => g.maxSelect >= g.minSelect, {
    message: "maxSelect must be >= minSelect",
    path: ["maxSelect"],
  });

export const menuItemCreateSchema = z.object({
  restaurantId: z.string().uuid(),
  name: z.string().min(1).max(160),
  description: z.string().max(1000).nullable().optional(),
  price: money,
  image: imageUrl.nullable().optional(),
  categoryId: z.string().uuid(),
  kdsStationId: z.string().uuid().nullable().optional(),
  status: menuItemStatus.default("available"),
  optionGroups: z.array(optionGroupSchema).default([]),
});

export const menuItemUpdateSchema = menuItemCreateSchema
  .omit({ restaurantId: true })
  .partial()
  .extend({ optionGroups: z.array(optionGroupSchema).optional() });

// --- Branch menu override ---------------------------------------------------

const branchMenuItemOverrideSchema = z.object({
  menuItemId: z.string().uuid(),
  isAvailable: z.boolean().default(true),
  price: optionalMoney,
});

export const branchMenuUpdateSchema = z.object({
  branchId: z.string().uuid(),
  items: z.array(branchMenuItemOverrideSchema).min(1),
});

// --- Sessions ---------------------------------------------------------------

export const sessionCreateSchema = z.object({
  branchId: z.string().uuid(),
  tableId: z.string().uuid(),
});

// --- Orders -----------------------------------------------------------------

export const orderCreateSchema = z.object({
  branchId: z.string().uuid(),
  tableId: z.string().uuid(),
  type: z.enum(["dine_in", "take_away"]).default("dine_in"),
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        quantity: z.number().int().min(1),
        note: z.string().max(500).nullable().optional(),
        optionItemIds: z.array(z.string().uuid()).default([]),
      }),
    )
    .min(1),
});

export const orderStatusSchema = z.object({
  status: z.enum([
    "pending",
    "preparing",
    "ready",
    "served",
    "completed",
    "cancelled",
  ]),
});

export const orderCancelSchema = z.object({
  reason: z.string().max(500).nullable().optional(),
});

export const tableCreateSchema = z.object({
  branchId: z.string().uuid(),
  tableNumber: z.string().min(1).max(20),
});

export const tableStatusSchema = z.object({
  status: z.enum(["available", "occupied"]),
});

export const billRequestSchema = z.object({
  sessionId: z.string().uuid(),
});

// --- Auth -------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// --- POS: shifts & payments -------------------------------------------------

export const shiftOpenSchema = z.object({
  branchId: z.string().uuid(),
  openingFloat: money.default("0"),
  note: z.string().max(500).nullable().optional(),
});

export const shiftCloseSchema = z.object({
  closingAmount: money,
  note: z.string().max(500).nullable().optional(),
});

export const paymentSchema = z.object({
  sessionId: z.string().uuid(),
  method: z.enum(["cash", "card", "qr"]),
  // Optional override of the discount applied to the bill before payment.
  discount: optionalMoney,
  tendered: optionalMoney,
  shiftId: z.string().uuid().nullable().optional(),
});

export type MenuItemCreateInput = z.infer<typeof menuItemCreateSchema>;
export type MenuItemUpdateInput = z.infer<typeof menuItemUpdateSchema>;
export type BranchMenuUpdateInput = z.infer<typeof branchMenuUpdateSchema>;
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
