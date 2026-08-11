import {
  IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsNumber, Min,
  IsEmail, MinLength, MaxLength, Matches,
} from 'class-validator';
import { MarketStatus, MarketType, UserStatus, Role, NotificationType } from '@prisma/client';

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

/** Admin creates a user account directly (no signup flow, pre-verified). */
export class AdminCreateUserDto {
  @IsEmail() email!: string;

  @IsString() @MinLength(8) @MaxLength(72)
  @Matches(PASSWORD_RULE, { message: 'Password must be 8+ chars with upper, lower, number & symbol.' })
  password!: string;

  @IsOptional() @IsString() @MaxLength(60) displayName?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
}

/** Admin edits a user's account/dashboard data. All fields optional (PATCH). */
export class AdminUpdateUserDto {
  @IsOptional() @IsString() @MaxLength(60) displayName?: string;
  @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsNumber() @Min(0) paperBalance?: number;
  @IsOptional() @IsBoolean() emailVerified?: boolean;
}

/** Admin edits a user's dashboard preferences. */
export class AdminUpdateSettingsDto {
  @IsOptional() @IsString() theme?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() defaultQuoteCurrency?: string;
  @IsOptional() @IsBoolean() emailNotifications?: boolean;
  @IsOptional() @IsBoolean() pushNotifications?: boolean;
  @IsOptional() @IsBoolean() tradeConfirmations?: boolean;
}

/** Admin resets a user's password without their current credentials. */
export class AdminResetPasswordDto {
  @IsString() @MinLength(8) @MaxLength(72)
  @Matches(PASSWORD_RULE, { message: 'Password must be 8+ chars with upper, lower, number & symbol.' })
  newPassword!: string;

  @IsOptional() @IsBoolean() notifyUser?: boolean;
}

/** Admin sends a notification to a single user. */
export class SendUserNotificationDto {
  @IsString() @MaxLength(120) title!: string;
  @IsString() @MaxLength(1000) body!: string;
  @IsOptional() @IsEnum(NotificationType) type?: NotificationType;
}

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;
}

export class UpdateUserRoleDto {
  @IsEnum(Role)
  role!: Role;
}

export class CreatePairDto {
  @IsString() symbol!: string;
  @IsString() base!: string;
  @IsString() quote!: string;
  @IsString() displayName!: string;
  @IsEnum(MarketType) type!: MarketType;
  @IsOptional() @IsNumber() @Min(0) lastPrice?: number;
  @IsOptional() @IsInt() pricePrecision?: number;
  @IsOptional() @IsInt() qtyPrecision?: number;
}

export class UpdatePairDto {
  @IsOptional() @IsEnum(MarketStatus) status?: MarketStatus;
  @IsOptional() @IsBoolean() isTrending?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsString() displayName?: string;
}

export class BroadcastNotificationDto {
  @IsString() title!: string;
  @IsString() body!: string;
}
