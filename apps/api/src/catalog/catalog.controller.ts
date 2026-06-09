import { Controller, Get } from "@nestjs/common";
import { CatalogService } from "./catalog.service";

@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get("treatment-types")
  listTreatmentTypes() {
    return this.catalogService.listTreatmentTypes();
  }
}
