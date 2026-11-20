import { loginService, LoginService } from "./login/login.service.js";
import { signupService, SignupService } from "./signup/signup.service.js";
import type { LoginInput } from "./login/login.types.js";
import type { RegisterInput } from "./signup/signup.types.js";
import type { SessionUser } from "./auth.types.js";

export type { LoginInput } from "./login/login.types.js";
export type { RegisterInput } from "./signup/signup.types.js";
export { LoginService, loginService } from "./login/login.service.js";
export { SignupService, signupService } from "./signup/signup.service.js";

export class AuthService {
  private loginService: LoginService;
  private signupService: SignupService;

  constructor(
    customLoginService: LoginService = new LoginService(),
    customSignupService: SignupService = new SignupService(),
  ) {
    this.loginService = customLoginService;
    this.signupService = customSignupService;
  }

  listUniversityDepartments() {
    return this.signupService.listUniversityDepartments();
  }

  register(input: RegisterInput) {
    return this.signupService.register(input);
  }

  login(input: LoginInput): Promise<SessionUser> {
    return this.loginService.login(input);
  }

  me(userId: string): Promise<SessionUser> {
    return this.loginService.me(userId);
  }

  verifyEmail(token: string) {
    return this.signupService.verifyEmail(token);
  }

  resendEmailVerification(emailAddress: string) {
    return this.signupService.resendEmailVerification(emailAddress);
  }
}

export const authService = new AuthService(loginService, signupService);
