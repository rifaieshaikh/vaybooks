import { z } from 'zod';

export const customerDraftSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  locationId: z.string().min(1, 'Location is required'),
  notes: z.string().optional().default(''),
  expectedDeliveryDate: z.string().min(1, 'Expected delivery date is required'),
  newName: z.string().optional().default(''),
  newPhone: z.string().optional().default(''),
});

export const garmentSchema = z
  .object({
    description: z.string().min(1, 'Description is required'),
    customerSpecification: z.string(),
    sellAmount: z.coerce.number().min(0, 'Estimate amount cannot be negative'),
    expectedDeliveryDate: z.string(),
    measurementId: z.string(),
    billNumber: z.string(),
    requiredActivities: z.record(z.string(), z.boolean()),
    activityEstimatedHours: z.record(z.string(), z.coerce.number().min(0)),
  })
  .superRefine((val, ctx) => {
    if (!String(val.description || '').trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Description is required',
        path: ['description'],
      });
    }
    if (!Object.values(val.requiredActivities || {}).some(Boolean)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select at least one required activity',
        path: ['requiredActivities'],
      });
    }
    for (const [name, hrs] of Object.entries(val.activityEstimatedHours || {})) {
      if (val.requiredActivities?.[name] && Number(hrs) < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Estimated hours cannot be negative',
          path: ['activityEstimatedHours', name],
        });
      }
    }
    if (!val.measurementId && !String(val.billNumber || '').trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Bill number is required when no measurement is linked',
        path: ['billNumber'],
      });
    }
  });

export const scheduleSchema = z.object({
  etd: z.string().min(1, 'Expected delivery date is required'),
  cashAmount: z.string().optional().default(''),
  receivingAccountId: z.string().optional().default(''),
});

export const invoiceSchema = z.object({
  billIds: z.array(z.string()).min(1, 'Select at least one bill'),
  invoiceAmount: z.coerce.number().gt(0, 'Invoice amount must be greater than 0'),
  discountAmount: z.coerce.number().min(0).default(0),
  gstRate: z.coerce.number().min(0).default(5),
  invoiceDate: z.string().optional().default(''),
  allowAlreadyInvoiced: z.boolean().default(false),
});

export const deliverySchema = z.object({
  billIds: z.array(z.string()).min(1, 'Select at least one bill'),
  deliveryDate: z.string().optional().default(''),
  deliveryNotes: z.string().optional().default(''),
  allowAlreadyDelivered: z.boolean().default(false),
});

export const activityCompleteSchema = z.object({
  purchasePrice: z.coerce.number().min(0).default(0),
  sellingPrice: z.coerce.number().min(0).default(0),
  vendorOrWorkerName: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

export type CustomerDraftValues = z.infer<typeof customerDraftSchema>;
export type GarmentValues = z.infer<typeof garmentSchema>;
export type ScheduleValues = z.infer<typeof scheduleSchema>;
