import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  Length,
} from 'class-validator';

const PASSWORD_RULE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72) // argon2/bcrypt safe upper bound
  @Matches(PASSWORD_RULE, {
    message:
      'Password must be 8+ chars and include uppercase, lowercase, a number, and a symbol.',
  })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;

  // Optional TOTP code when 2FA is enabled.
  @IsOptional()
  @IsString()
  @Length(6, 6)
  totp?: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(PASSWORD_RULE, {
    message:
      'Password must be 8+ chars and include uppercase, lowercase, a number, and a symbol.',
  })
  password!: string;
}

export class VerifyEmailDto {
  @IsString()
  token!: string;
}

export class Enable2faDto {
  // 6-digit code from the authenticator app to confirm enrolment.
  @IsString()
  @Length(6, 6)
  totp!: string;
}

export class Disable2faDto {
  @IsString()
  @Length(6, 6)
  totp!: string;
}
