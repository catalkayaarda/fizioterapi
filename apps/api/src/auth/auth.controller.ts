import { Body, Controller, Post } from "@nestjs/common";
import { loginSchema, registerSchema } from "@fizioterapi/types";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body() body: unknown) {
    return this.authService.register(registerSchema.parse(body));
  }

  @Post("login")
  login(@Body() body: unknown) {
    return this.authService.login(loginSchema.parse(body));
  }
}
