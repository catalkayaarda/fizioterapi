import { Body, Controller, Get, Post } from "@nestjs/common";
import { AssessmentService, assessmentAnswersSchema } from "./assessment.service";

@Controller("assessment")
export class AssessmentController {
  constructor(private readonly assessmentService: AssessmentService) {}

  @Get("questions")
  getQuestions() {
    return this.assessmentService.getQuestions();
  }

  @Post("results")
  submitAnswers(@Body() body: unknown) {
    const input = assessmentAnswersSchema.parse(body);
    return this.assessmentService.submitAnswers(input.optionIds);
  }
}
