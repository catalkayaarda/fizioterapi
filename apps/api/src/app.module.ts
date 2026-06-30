import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ConfigModule } from "@nestjs/config";
import { AdminModule } from "./admin/admin.module";
import { AppointmentsModule } from "./appointments/appointments.module";
import { AssessmentModule } from "./assessment/assessment.module";
import { CatalogModule } from "./catalog/catalog.module";
import { MarketplaceModule } from "./marketplace/marketplace.module";
import { MessagingModule } from "./messaging/messaging.module";
import { LoyaltyModule } from "./loyalty/loyalty.module";
import { PaymentsModule } from "./payments/payments.module";
import { AuthModule } from "./auth/auth.module";
import { HealthModule } from "./health/health.module";
import { TherapistsModule } from "./therapists/therapists.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"]
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    HealthModule,
    UsersModule,
    TherapistsModule,
    AdminModule,
    CatalogModule,
    MarketplaceModule,
    AssessmentModule,
    AppointmentsModule,
    PaymentsModule,
    LoyaltyModule,
    MessagingModule
  ]
})
export class AppModule {}
