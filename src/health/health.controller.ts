import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  check(): { status: "ok"; service: string } {
    // Nome igual ao do projeto Express irmão, para manter o contrato idêntico.
    return { status: "ok", service: "whatsapp-cloud-api-node" };
  }
}
