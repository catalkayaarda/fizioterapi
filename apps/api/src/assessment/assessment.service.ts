import { BadRequestException, Injectable } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../prisma.service";
import { MarketplaceService } from "../marketplace/marketplace.service";

export const assessmentAnswersSchema = z.object({
  optionIds: z.array(z.string().min(1)).min(1)
});

const disclaimer = "Bu tıbbi tavsiye değildir, kesin tanı için hekime başvurun";

@Injectable()
export class AssessmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketplace: MarketplaceService
  ) {}

  getQuestions() {
    return this.prisma.assessmentQuestion.findMany({
      orderBy: { order: "asc" },
      include: { options: { orderBy: { label: "asc" } } }
    });
  }

  async submitAnswers(optionIds: string[]) {
    const uniqueOptionIds = [...new Set(optionIds)];
    const options = await this.prisma.assessmentOption.findMany({
      where: { id: { in: uniqueOptionIds } },
      include: { rules: { include: { treatmentType: true } }, question: true }
    });

    if (options.length !== uniqueOptionIds.length) {
      throw new BadRequestException("Bilinmeyen cevap seçeneği gönderildi.");
    }

    const scores = new Map<string, { score: number; treatmentType: { id: string; slug: string; name: string; description: string | null } }>();
    for (const option of options) {
      for (const rule of option.rules) {
        const current = scores.get(rule.treatmentTypeId) ?? { score: 0, treatmentType: rule.treatmentType };
        current.score += rule.weight;
        scores.set(rule.treatmentTypeId, current);
      }
    }

    const ranked = [...scores.values()].sort((a, b) => b.score - a.score || a.treatmentType.name.localeCompare(b.treatmentType.name));
    const recommended = ranked[0]?.treatmentType ?? null;
    const scorePayload = ranked.map((item) => ({ treatmentType: item.treatmentType, score: item.score }));
    const answers = options.map((option) => ({
      questionId: option.questionId,
      questionKey: option.question.key,
      optionId: option.id,
      value: option.value,
      label: option.label
    }));

    const result = await this.prisma.assessmentResult.create({
      data: {
        recommendedTreatmentTypeId: recommended?.id,
        answers,
        scores: scorePayload
      }
    });

    const therapists = recommended
      ? await this.marketplace.searchTherapists({ treatmentType: recommended.slug })
      : [];

    return {
      resultId: result.id,
      disclaimer,
      recommendedTreatmentType: recommended,
      scores: scorePayload,
      therapists
    };
  }
}
