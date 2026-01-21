// dtos/user/updateProfileRequest.dto.ts
import * as z from "zod";
import { Country, State } from "country-state-city";

export const updateProfileRequestSchema = z
  .object({
    fullName: z
      .string()
      .min(5, { message: "Full name must be at least 5 characters" })
      .max(50, { message: "Full name must be less than 50 characters" })
      .refine((v) => !v || v.split(/\s+/g).length < 10, {
        message: "Full name must have less than 10 words",
      })
      .refine((v) => !v || /^[a-zA-Z\s]+$/.test(v), {
        message: "Full name can only contain letters and spaces",
      })
      .optional(),
    email: z.string().email({ message: "Invalid email address" }).optional(),
    phoneNumber: z
      .string()
      .regex(/^\d+$/, { message: "Phone number must contain only numbers" })
      .refine((v) => !v || v.length === 10, {
        message: "Phone number must be exactly 10 digits",
      })
      .optional(),
    gender: z
      .string()
      .refine((v) => !v || ["Male", "Female", "Others"].includes(v), {
        message: "Invalid gender (must be Male, Female, or Others)",
      })
      .optional(),
    country: z
      .string()
      .refine((v) => !v || Country.getAllCountries().some((c) => c.name === v), {
        message: "Invalid country",
      })
      .optional(),
    state: z.string().optional(),
    govId: z
      .object({
        idNumber: z
          .string()
          .min(5, { message: "ID number must be at least 5 characters" })
          .max(14, { message: "ID number must be less than 15 characters" }),
        documentUrl: z.string().url({ message: "Invalid document URL" }),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.country && data.state) {
      const country = Country.getAllCountries().find((c) => c.name === data.country);
      if (country) {
        const states = State.getStatesOfCountry(country.isoCode);
        if (states.length > 0 && !states.some((s) => s.name === data.state)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Invalid state for the selected country",
            path: ["state"],
          });
        }
      }
    }
  });

export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;