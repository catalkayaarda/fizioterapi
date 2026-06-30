import { z } from "zod";

const roleSchema = z.enum(["PATIENT", "THERAPIST", "ADMIN"]);
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const registerSchema = z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().min(2).max(120), role: roleSchema.default("PATIENT") });

export const packageModeSchema = z.enum(["PHYSICAL", "ONLINE", "BOTH"]);
export const appointmentStatusSchema = z.enum(["REQUESTED", "CONFIRMED", "COMPLETED", "CANCELLED"]);
export const loyaltyTierSchema = z.enum(["BRONZE", "SILVER", "GOLD", "VIP"]);

export const createAppointmentSchema = z.object({
  slotId: z.string().min(1),
  packageId: z.string().min(1)
});

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(1000).optional()
});

export type ApiClientOptions = {
  baseUrl: string;
  getToken?: () => string | undefined | Promise<string | undefined>;
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public body: unknown) {
    super(message);
  }
}

export function createApiClient(options: ApiClientOptions) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await options.getToken?.();
    const headers = new Headers(init.headers);
    if (!headers.has("content-type") && init.body && !(init.body instanceof FormData)) {
      headers.set("content-type", "application/json");
    }
    if (token) headers.set("authorization", "Bearer " + token);

    const response = await fetch(options.baseUrl.replace(/\/$/, "") + path, { ...init, headers });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new ApiError(response.status, body?.message ?? response.statusText, body);
    }
    return body as T;
  }

  return {
    request,
    login: (input: unknown) => request<{ accessToken: string; user: { id: string; email: string; name: string; role: string } }>("/auth/login", { method: "POST", body: JSON.stringify(loginSchema.parse(input)) }),
    register: (input: unknown) => request<{ accessToken: string; user: { id: string; email: string; name: string; role: string } }>("/auth/register", { method: "POST", body: JSON.stringify(registerSchema.parse(input)) }),
    treatmentTypes: () => request<any[]>("/catalog/treatment-types"),
    searchTherapists: (query = "") => request<any[]>("/marketplace/therapists" + query),
    therapistDetail: (id: string) => request<any>("/marketplace/therapists/" + id),
    assessmentQuestions: () => request<any[]>("/assessment/questions"),
    submitAssessment: (optionIds: string[]) => request<any>("/assessment/results", { method: "POST", body: JSON.stringify({ optionIds }) }),
    createAppointment: (input: unknown) => request<any>("/appointments/requests", { method: "POST", body: JSON.stringify(createAppointmentSchema.parse(input)) }),
    myAppointments: () => request<any[]>("/appointments/mine"),
    incomingAppointments: () => request<any[]>("/appointments/incoming"),
    confirmAppointment: (id: string, videoLink?: string) => request<any>("/appointments/" + id + "/confirm", { method: "PATCH", body: JSON.stringify({ videoLink }) }),
    completeAppointment: (id: string) => request<any>("/appointments/" + id + "/complete", { method: "PATCH", body: JSON.stringify({}) }),
    cancelByTherapist: (id: string, reason?: string) => request<any>("/appointments/" + id + "/cancel/therapist", { method: "PATCH", body: JSON.stringify({ reason }) }),
    cancelByPatient: (id: string, reason?: string) => request<any>("/appointments/" + id + "/cancel/patient", { method: "PATCH", body: JSON.stringify({ reason }) }),
    therapistMe: () => request<any>("/therapists/me"),
    updateTherapistProfile: (input: { fullName: string; bio?: string }) => request<any>("/therapists/me", { method: "PATCH", body: JSON.stringify(input) }),
    createPackage: (input: unknown) => request<any>("/therapists/me/packages", { method: "POST", body: JSON.stringify(input) }),
    createSlot: (input: { startsAt: string; endsAt: string }) => request<any>("/therapists/me/slots", { method: "POST", body: JSON.stringify(input) }),
    createReview: (therapistId: string, input: unknown) => request<any>("/marketplace/therapists/" + therapistId + "/reviews", { method: "POST", body: JSON.stringify(reviewSchema.parse(input)) }),
    loyalty: () => request<any>("/users/loyalty"),
    mobileCheckout: (appointmentId: string) => request<any>("/payments/mobile-checkout/" + appointmentId),
    conversations: () => request<any[]>("/conversations"),
    unreadMessages: () => request<{ unreadCount: number }>("/conversations/unread-count"),
    startConversation: (input: { therapistProfileId: string; message?: string }) => request<any>("/conversations", { method: "POST", body: JSON.stringify(input) }),
    conversationMessages: (conversationId: string) => request<any>("/conversations/" + conversationId + "/messages"),
    sendMessage: (conversationId: string, body: string) => request<any>("/conversations/" + conversationId + "/messages", { method: "POST", body: JSON.stringify({ body }) }),
    acceptConversation: (conversationId: string) => request<any>("/conversations/" + conversationId + "/accept", { method: "PATCH", body: JSON.stringify({}) }),
    rejectConversation: (conversationId: string) => request<any>("/conversations/" + conversationId + "/reject", { method: "PATCH", body: JSON.stringify({}) })
  };
}
