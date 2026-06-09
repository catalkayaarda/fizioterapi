import { z } from "zod";

export const roleSchema = z.enum(["PATIENT", "THERAPIST", "ADMIN"]);
export type Role = z.infer<typeof roleSchema>;

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(120),
  role: roleSchema.default("PATIENT")
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});
export type LoginInput = z.infer<typeof loginSchema>;

export const jwtPayloadSchema = z.object({
  sub: z.string(),
  email: z.string().email(),
  role: roleSchema
});
export type JwtPayload = z.infer<typeof jwtPayloadSchema>;

export * from "./api-client";
