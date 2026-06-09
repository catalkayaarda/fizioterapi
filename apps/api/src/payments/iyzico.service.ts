import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";

@Injectable()
export class IyzicoService {
  async createSubMerchant(input: { therapistProfileId: string; fullName: string; email?: string | null }) {
    return {
      subMerchantKey: "sub_" + input.therapistProfileId,
      raw: { provider: "iyzico", mode: "mock", input }
    };
  }

  async chargeAndHold(input: { appointmentId: string; amount: string; commission: string; subMerchantKey: string }) {
    const conversationId = "hold_" + input.appointmentId;
    return {
      paymentId: "pay_" + input.appointmentId,
      conversationId,
      raw: { provider: "iyzico", mode: "mock", action: "chargeAndHold", input }
    };
  }

  async release(input: { paymentId: string; appointmentId: string; amount: string; commission: string; subMerchantKey: string }) {
    return {
      payoutId: "payout_" + input.appointmentId,
      raw: { provider: "iyzico", mode: "mock", action: "release", input }
    };
  }

  async refund(input: { paymentId: string; appointmentId: string; amount: string }) {
    return {
      refundId: "refund_" + input.appointmentId + "_" + randomUUID().slice(0, 8),
      raw: { provider: "iyzico", mode: "mock", action: "refund", input }
    };
  }
}
