import { z } from 'zod'

// =============================================================================
// Auth Schemas
// =============================================================================

export const UserSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().optional(),
  roles: z.array(z.string()),
})

export const LoginResponseSchema = z.object({
  access: z.string(),
  user: UserSchema,
})

export const RefreshResponseSchema = z.object({
  access: z.string(),
})

export const MeResponseSchema = UserSchema

// =============================================================================
// API Error Schema
// =============================================================================

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
})

// =============================================================================
// Type exports (inferred from schemas)
// =============================================================================

export type UserFromSchema = z.infer<typeof UserSchema>
export type LoginResponseFromSchema = z.infer<typeof LoginResponseSchema>
export type RefreshResponseFromSchema = z.infer<typeof RefreshResponseSchema>
export type MeResponseFromSchema = z.infer<typeof MeResponseSchema>
export type ApiErrorFromSchema = z.infer<typeof ApiErrorSchema>
