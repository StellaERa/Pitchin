import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { User } from '../users/entities/user.entity';
import { MoreThan, Repository } from 'typeorm';
import { UserHelper } from './helper/user-helper';
import { InjectRepository } from '@nestjs/typeorm';
import { UserMessages } from './helper/user-messages';
import { UserRole } from '../users/enums/userRoles.enum';
import { JwtHelper } from './helper/jwt-helper';
import * as moment from 'moment';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { SendPasswordResetOtpDto } from './dto/send-password-reset-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenRepositoryOperations } from './providers/refreshToken.repository';
import { SetupTotpProvider } from './providers/setup-totp.provider';
import { VerifyTotpProvider } from './providers/verify-totp.provider';
import { ManageTotpProvider } from './providers/manage-totp.provider';
import { Setup2faDto } from './dto/setup-2fa.dto';
import { VerifyTotpDto } from './dto/verify-totp.dto';
import { UseBackupCodeDto } from './dto/use-backup-code.dto';
import { Disable2faDto } from './dto/disable-2fa.dto';
import { AuditAction, AuditService } from '../audit/audit.service';
import { ErrorCatch } from '../utils/error';
import { getCurrentActorFromAls } from '../common/utils/current-actor.util';
import { createHash, timingSafeEqual } from 'node:crypto';

const DEFAULT_PASSWORD_RESET_OTP_MINUTES = 10;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

function hashVerificationCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function matchesVerificationCode(
  storedHash: string | undefined,
  code: string,
): boolean {
  const expectedHash = Buffer.from(hashVerificationCode(code), 'hex');
  const hasValidHash = /^[a-f0-9]{64}$/i.test(storedHash ?? '');
  const actualHash = hasValidHash
    ? Buffer.from(storedHash!, 'hex')
    : Buffer.alloc(expectedHash.length);

  return timingSafeEqual(expectedHash, actualHash) && hasValidHash;
}

// BE-17 — Single source of truth for email normalization. Every lookup,
// uniqueness check, and persistence path must funnel through this helper so
// case/whitespace variants resolve to one account.
function normalizeEmail(email: string): string {
  return (email ?? '').trim().toLowerCase();
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly userHelper: UserHelper,
    private readonly jwtHelper: JwtHelper,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly refreshTokenRepositoryOperations: RefreshTokenRepositoryOperations,
    private readonly setupTotpProvider: SetupTotpProvider,
    private readonly verifyTotpProvider: VerifyTotpProvider,
    private readonly manageTotpProvider: ManageTotpProvider,
    private readonly auditService: AuditService,
  ) {}

  async createUser(createUserDto: CreateUserDto) {
    const email = normalizeEmail(createUserDto.email);
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      await this.auditService.authFailure(
        AuditAction.REGISTER,
        email,
        { reason: 'email_already_exists' },
      );
      throw new ConflictException(UserMessages.EMAIL_ALREADY_EXIST);
    }

    const validPassword = this.userHelper.isValidPassword(
      createUserDto.password,
    );
    if (!validPassword) {
      await this.auditService.authFailure(
        AuditAction.REGISTER,
        email,
        { reason: 'weak_password' },
      );
      throw new ConflictException(UserMessages.IS_VALID_PASSWORD);
    }

    const hashedPassword = await this.userHelper.hashPassword(
      createUserDto.password,
    );
    const verificationCode = this.userHelper.generateVerificationCode();
    const expiration = moment().add(10, 'minutes').toDate();
    const newUser = this.userRepository.create({
      email,
      firstname: createUserDto.firstname,
      lastname: createUserDto.lastname,
      password: hashedPassword,
      role: UserRole.USER,
      verificationCode: hashVerificationCode(verificationCode),
      verificationCodeExpiresAt: expiration,
      isVerified: false,
    });
    await this.saveUserOrThrowConflict(newUser, AuditAction.REGISTER, email);

    await this.emailService.sendVerificationEmail(
      newUser.email,
      verificationCode,
      `${newUser.firstname} ${newUser.lastname}`,
    );

    await this.auditService.authSuccess(AuditAction.REGISTER, {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });

    return {
      user: this.userHelper.formatUserResponse(newUser),
      accessToken: this.jwtHelper.generateAccessToken(newUser),
    };
  }

  async createAdminUser(createUserDto: CreateUserDto) {
    const email = normalizeEmail(createUserDto.email);
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      await this.auditService.authFailure(
        AuditAction.REGISTER_ADMIN,
        email,
        { reason: 'email_already_exists' },
      );
      throw new ConflictException(UserMessages.EMAIL_ALREADY_EXIST);
    }

    const validPassword = this.userHelper.isValidPassword(
      createUserDto.password,
    );
    if (!validPassword) {
      await this.auditService.authFailure(
        AuditAction.REGISTER_ADMIN,
        email,
        { reason: 'weak_password' },
      );
      throw new ConflictException(UserMessages.IS_VALID_PASSWORD);
    }

    const hashedPassword = await this.userHelper.hashPassword(
      createUserDto.password,
    );
    const newUser = this.userRepository.create({
      email,
      firstname: createUserDto.firstname,
      lastname: createUserDto.lastname,
      password: hashedPassword,
      role: UserRole.ADMIN,
    });
    await this.saveUserOrThrowConflict(
      newUser,
      AuditAction.REGISTER_ADMIN,
      email,
    );

    await this.auditService.adminAction(
      AuditAction.REGISTER_ADMIN,
      getCurrentActorFromAls(),
      'User',
      newUser.id,
      { email: newUser.email, role: newUser.role },
    );

    return {
      user: this.userHelper.formatUserResponse(newUser),
      accessToken: this.jwtHelper.generateAccessToken(newUser),
    };
  }

  private async saveUserOrThrowConflict(
    user: User,
    action: AuditAction,
    email: string,
  ): Promise<void> {
    try {
      await this.userRepository.save(user);
    } catch (error) {
      const dbError = error as {
        code?: string;
        driverError?: { code?: string };
      };
      if (dbError?.code !== '23505' && dbError?.driverError?.code !== '23505') {
        throw error;
      }

      await this.auditService.authFailure(action, email, {
        reason: 'email_already_exists',
      });
      throw new ConflictException(UserMessages.EMAIL_ALREADY_EXIST);
    }
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { otp } = verifyOtpDto;
    const email = normalizeEmail(verifyOtpDto.email);

    if (!email) {
      throw new BadRequestException(UserMessages.EMAIL_REQUIRED);
    }
    if (!otp) {
      throw new BadRequestException(UserMessages.OTP_REQUIRED);
    }

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      await this.auditService.authFailure(AuditAction.OTP_FAILED, email);
      throw new UnauthorizedException(UserMessages.USER_NOT_FOUND);
    }

    if (
      !user.verificationCodeExpiresAt ||
      user.verificationCodeExpiresAt < new Date()
    ) {
      await this.auditService.authFailure(AuditAction.OTP_FAILED, email, {
        reason: 'expired',
        userId: user.id,
      });
      throw new UnauthorizedException(UserMessages.OTP_EXPIRED);
    }

    if (!matchesVerificationCode(user.verificationCode, otp)) {
      await this.auditService.authFailure(AuditAction.OTP_FAILED, email, {
        reason: 'invalid_code',
        userId: user.id,
      });
      throw new UnauthorizedException(UserMessages.INVALID_OTP);
    }

    user.isVerified = true;
    user.verificationCode = '';
    user.verificationCodeExpiresAt = undefined;
    await this.userRepository.save(user);

    await this.auditService.authSuccess(AuditAction.OTP_VERIFIED, {
      id: user.id,
      email: user.email,
      role: user.role,
    });

    const tokens = this.jwtHelper.generateTokens(user);
    await this.refreshTokenRepositoryOperations.saveRefreshToken(
      user,
      tokens.refreshToken,
    );

    return {
      message: UserMessages.VERIFY_OTP_SUCCESS,
      user: this.userHelper.formatUserResponse(user),
      tokens,
    };
  }

  async resendVerificationOtp(emailInput: string) {
    try {
      const email = normalizeEmail(emailInput);
      if (!email) {
        throw new BadRequestException(UserMessages.EMAIL_REQUIRED);
      }

      const user = await this.userRepository.findOne({ where: { email } });
      if (!user) {
        throw new NotFoundException(UserMessages.USER_NOT_FOUND);
      }

      const verificationCode = this.userHelper.generateVerificationCode();
      user.verificationCode = hashVerificationCode(verificationCode);
      user.verificationCodeExpiresAt = moment().add(10, 'minutes').toDate();
      await this.userRepository.save(user);

      await this.emailService.sendVerificationEmail(
        user.email,
        verificationCode,
        `${user.firstname} ${user.lastname}`,
      );

      return { message: UserMessages.OTP_SENT };
    } catch (error) {
      ErrorCatch(error, 'Error resending verification code');
    }
  }

  async login(loginUserDto: LoginUserDto) {
    const email = normalizeEmail(loginUserDto.email);
    const user = await this.userRepository.findOne({
      where: { email },
      withDeleted: true,
    });

    if (user && user.deletedAt) {
      await this.auditService.authFailure(
        AuditAction.LOGIN_FAILED,
        loginUserDto.email,
        { reason: 'deleted', userId: user.id },
      );
      throw new UnauthorizedException(UserMessages.INVALID_CREDENTIALS);
    }

    if (user && user.lockoutUntil && user.lockoutUntil > new Date()) {
      await this.auditService.authFailure(AuditAction.LOGIN_FAILED, email, {
        reason: 'locked',
        userId: user.id,
      });
      throw new UnauthorizedException(UserMessages.INVALID_CREDENTIALS);
    }

    if (
      !user ||
      !(await this.userHelper.verifyPassword(
        loginUserDto.password,
        user.password,
      ))
    ) {
      if (user) {
        await this.bumpLoginFailure(user);
      }
      await this.auditService.authFailure(AuditAction.LOGIN_FAILED, email, {
        reason: !user ? 'unknown_email' : 'bad_password',
      });
      throw new UnauthorizedException(UserMessages.INVALID_CREDENTIALS);
    }

    if (user.failedLoginAttempts > 0 || user.lockoutUntil) {
      await this.userRepository.update(user.id, {
        failedLoginAttempts: 0,
        lockoutUntil: null as unknown as Date,
      });
      user.failedLoginAttempts = 0;
      user.lockoutUntil = undefined;
    }

    if (!user.isVerified) {
      await this.resendVerificationOtp(email);
      await this.auditService.authFailure(AuditAction.LOGIN_FAILED, email, {
        reason: 'unverified',
        userId: user.id,
      });
      return {
        message: UserMessages.EMAIL_NOT_VERIFIED,
        user: this.userHelper.formatUserResponse(user),
      };
    }

    await this.auditService.authSuccess(AuditAction.LOGIN_SUCCESS, {
      id: user.id,
      email: user.email,
      role: user.role,
    });

    if (user.twoFactorEnabled) {
      const tempToken = this.jwtHelper.generateTempToken(user.id);
      return { requiresTwoFactor: true, tempToken };
    }

    const { accessToken, refreshToken } = this.jwtHelper.generateTokens(user);
    await this.refreshTokenRepositoryOperations.saveRefreshToken(
      user,
      refreshToken,
    );
    return {
      user: this.userHelper.formatUserResponse(user),
      accessToken,
      refreshToken,
    };
  }

  private async bumpLoginFailure(user: User): Promise<void> {
    const attempts = (user.failedLoginAttempts || 0) + 1;
    const update: Partial<User> = { failedLoginAttempts: attempts };
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      update.lockoutUntil = moment().add(LOCKOUT_MINUTES, 'minutes').toDate();
    }
    await this.userRepository.update(user.id, update);
  }

  async refreshTokens(refreshToken: string) {
    return this.refreshToken(refreshToken);
  }

  /**
   * BE-09 — Rotate refresh tokens; detect reuse of already-rotated tokens
   * and revoke the entire token family.
   */
  async refreshToken(refreshToken: string) {
    const payload = this.jwtHelper.validateRefreshToken(refreshToken);
    if (!payload) {
      throw new UnauthorizedException(UserMessages.INVALID_CREDENTIALS);
    }

    const stored =
      await this.refreshTokenRepositoryOperations.findToken(refreshToken);

    if (stored?.revoked) {
      if (stored.family) {
        await this.refreshTokenRepositoryOperations.revokeFamily(
          stored.family,
          'replay',
        );
      }
      await this.auditService.authFailure(AuditAction.LOGIN_FAILED, null, {
        reason: 'refresh_token_replay',
        family: stored.family,
      });
      throw new UnauthorizedException(UserMessages.INVALID_CREDENTIALS);
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.userId },
      withDeleted: true,
    });

    if (!user || user.deletedAt) {
      await this.auditService.authFailure(
        AuditAction.LOGIN_FAILED,
        user?.email ?? null,
        { reason: !user ? 'unknown_user' : 'deleted', userId: user?.id },
      );
      throw new UnauthorizedException(UserMessages.INVALID_CREDENTIALS);
    }

    if (!stored || !stored.isUsable()) {
      await this.auditService.authFailure(AuditAction.LOGIN_FAILED, user.email, {
        reason: stored ? 'expired' : 'unknown',
        userId: user.id,
      });
      throw new UnauthorizedException(UserMessages.INVALID_CREDENTIALS);
    }

    await this.refreshTokenRepositoryOperations.revokeRefreshToken(
      stored,
      'rotation',
    );

    const tokens = this.jwtHelper.generateTokens(user);
    await this.refreshTokenRepositoryOperations.saveRefreshToken(
      user,
      tokens.refreshToken,
      stored.family,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /** BE-08 — Invalidate the refresh credential on logout (idempotent). */
  async logout(refreshToken?: string, _userId?: string) {
    if (refreshToken) {
      try {
        const stored =
          await this.refreshTokenRepositoryOperations.findToken(refreshToken);
        if (stored && !stored.revoked) {
          await this.refreshTokenRepositoryOperations.revokeRefreshToken(
            stored,
            'logout',
          );
        }
      } catch {
        // Repeated logout / invalid token is safe — still report success.
      }
    }
    return { message: UserMessages.LOGOUT_SUCCESS };
  }

  async retrieveUserById(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException(UserMessages.USER_NOT_FOUND);
    }
    return user;
  }

  async requestResetPasswordOtp(sendPasswordResetOtpDto: SendPasswordResetOtpDto) {
    if (!sendPasswordResetOtpDto.email) {
      throw new BadRequestException(UserMessages.EMAIL_REQUIRED);
    }

    const email = normalizeEmail(sendPasswordResetOtpDto.email);
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      this.logger.warn(
        `Password-reset OTP requested for unknown email: ${email}`,
      );
      await this.auditService.authFailure(
        AuditAction.PASSWORD_RESET_REQUEST,
        email,
        { reason: 'unknown_email' },
      );
      // Same response shape as the success path to avoid account enumeration.
      return { message: UserMessages.OTP_SENT };
    }

    const otpMinutes = parseInt(
      this.configService.get<string>('PASSWORD_RESET_OTP_MINUTES') ||
        String(DEFAULT_PASSWORD_RESET_OTP_MINUTES),
      10,
    );
    const otp = this.userHelper.generateVerificationCode();

    user.passwordResetCode = otp;
    user.passwordResetCodeExpiresAt = moment()
      .add(otpMinutes, 'minutes')
      .toDate();
    user.lastPasswordResetSentAt = new Date();
    await this.userRepository.save(user);

    await this.emailService.sendPasswordResetEmail(
      user.email,
      otp,
      `${user.firstname} ${user.lastname}`,
    );

    await this.auditService.authSuccess(AuditAction.PASSWORD_RESET_REQUEST, {
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return { message: UserMessages.OTP_SENT };
  }

  async resendResetPasswordVerificationOtp(resendOtpDto: ResendOtpDto) {
    try {
      if (!resendOtpDto.email) {
        throw new BadRequestException(UserMessages.EMAIL_REQUIRED);
      }

      const email = normalizeEmail(resendOtpDto.email);
      const user = await this.userRepository.findOne({ where: { email } });
      if (!user) {
        this.logger.warn(
          `Password-reset OTP resend requested for unknown email: ${email}`,
        );
        throw new NotFoundException(UserMessages.USER_NOT_FOUND);
      }

      const otpMinutes = parseInt(
        this.configService.get<string>('PASSWORD_RESET_OTP_MINUTES') ||
          String(DEFAULT_PASSWORD_RESET_OTP_MINUTES),
        10,
      );
      const otp = this.userHelper.generateVerificationCode();

      user.passwordResetCode = otp;
      user.passwordResetCodeExpiresAt = moment()
        .add(otpMinutes, 'minutes')
        .toDate();
      user.lastPasswordResetSentAt = new Date();
      await this.userRepository.save(user);

      await this.emailService
        .sendPasswordResetEmail(
          user.email,
          otp,
          `${user.firstname} ${user.lastname}`,
        )
        .catch((err) => {
          this.logger.error(
            `Failed to deliver password-reset OTP to ${user.email}: ${err?.message ?? err}`,
          );
        });

      await this.auditService.authSuccess(AuditAction.PASSWORD_RESET_REQUEST, {
        id: user.id,
        email: user.email,
        role: user.role,
      });

      return { message: UserMessages.OTP_SENT };
    } catch (error) {
      ErrorCatch(error, 'Error resending verification code');
    }
  }

  async verifyResetPasswordOtp(verifyOtpDto: VerifyOtpDto) {
    if (!verifyOtpDto.email) {
      throw new BadRequestException(UserMessages.EMAIL_REQUIRED);
    }
    if (!verifyOtpDto.otp) {
      throw new BadRequestException(UserMessages.OTP_REQUIRED);
    }

    const email = normalizeEmail(verifyOtpDto.email);
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new NotFoundException(UserMessages.USER_NOT_FOUND);
    }

    if (user.passwordResetCode !== verifyOtpDto.otp) {
      await this.auditService.authFailure(
        AuditAction.PASSWORD_RESET_FAILED,
        email,
        { reason: 'invalid_code', userId: user.id },
      );
      throw new UnauthorizedException(UserMessages.INVALID_OTP);
    }

    if (
      !user.passwordResetCodeExpiresAt ||
      user.passwordResetCodeExpiresAt < new Date()
    ) {
      await this.auditService.authFailure(
        AuditAction.PASSWORD_RESET_FAILED,
        email,
        { reason: 'expired', userId: user.id },
      );
      throw new UnauthorizedException(UserMessages.OTP_EXPIRED);
    }

    return { message: UserMessages.OTP_VERIFIED };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { otp, newPassword, confirmNewPassword } = resetPasswordDto;

    if (!this.userHelper.isValidPassword(newPassword)) {
      await this.auditService.authFailure(
        AuditAction.PASSWORD_RESET_FAILED,
        null,
        { reason: 'weak_password' },
      );
      throw new BadRequestException(UserMessages.IS_VALID_PASSWORD);
    }

    if (newPassword !== confirmNewPassword) {
      throw new BadRequestException(UserMessages.PASSWORDS_DO_NOT_MATCH);
    }

    const owner = await this.userRepository.findOneBy({
      passwordResetCode: otp,
    });

    if (!owner) {
      await this.auditService.authFailure(
        AuditAction.PASSWORD_RESET_FAILED,
        null,
        { reason: 'unknown_or_used_code' },
      );
      throw new UnauthorizedException('Invalid or expired reset code');
    }

    if (
      !owner.passwordResetCodeExpiresAt ||
      owner.passwordResetCodeExpiresAt < new Date()
    ) {
      await this.auditService.authFailure(
        AuditAction.PASSWORD_RESET_FAILED,
        owner.email,
        { reason: 'expired', userId: owner.id },
      );
      throw new UnauthorizedException(UserMessages.OTP_EXPIRED);
    }

    // Consume the OTP in the same statement that changes the password so two
    // concurrent resets cannot both succeed.
    const hashedPassword = await this.userHelper.hashPassword(newPassword);
    const updateResult = await this.userRepository.update(
      {
        id: owner.id,
        passwordResetCode: otp,
        passwordResetCodeExpiresAt: MoreThan(new Date()),
      },
      {
        password: hashedPassword,
        passwordResetCode: null as unknown as string,
        passwordResetCodeExpiresAt: null as unknown as Date,
        failedLoginAttempts: 0,
        lockoutUntil: null as unknown as Date,
      },
    );

    if (!updateResult.affected) {
      await this.auditService.authFailure(
        AuditAction.PASSWORD_RESET_FAILED,
        owner.email,
        { reason: 'race_or_expired', userId: owner.id },
      );
      throw new UnauthorizedException('Invalid or expired reset code');
    }

    await this.auditService.authSuccess(AuditAction.PASSWORD_RESET_SUCCESS, {
      id: owner.id,
      email: owner.email,
      role: owner.role,
    });

    return { message: UserMessages.PASSWORDS_RESET_SUCCESSFUL };
  }

  async resendOtp(dto: ResendOtpDto) {
    const user = await this.userRepository.findOne({
      where: { email: normalizeEmail(dto.email) },
      withDeleted: true,
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException(UserMessages.USER_NOT_FOUND);
    }

    return this.resendVerificationOtp(dto.email);
  }

  async setup2fa(userId: string) {
    const user = await this.getActiveUserOrThrow(userId);
    return this.setupTotpProvider.setup(user);
  }

  async confirm2fa(userId: string, dto: Setup2faDto) {
    await this.getActiveUserOrThrow(userId);
    return this.setupTotpProvider.confirm2faSetup(userId, dto);
  }

  async verifyTotpLogin(dto: VerifyTotpDto) {
    try {
      const result = await this.verifyTotpProvider.verifyTotpLogin(dto);
      await this.auditService.authSuccess(
        AuditAction.TOTP_LOGIN_SUCCESS,
        {},
      );
      return result;
    } catch (err) {
      await this.auditService.authFailure(
        AuditAction.TOTP_LOGIN_FAILED,
        null,
        { reason: (err as Error)?.message },
      );
      throw err;
    }
  }

  async verifyBackupCode(dto: UseBackupCodeDto) {
    const result = await this.verifyTotpProvider.verifyBackupCode(dto);
    await this.auditService.authSuccess(
      AuditAction.BACKUP_CODE_CONSUMED,
      {},
    );
    return result;
  }

  async disable2fa(userId: string, dto: Disable2faDto) {
    await this.getActiveUserOrThrow(userId);
    const result = await this.manageTotpProvider.disable2fa(userId, dto);
    await this.auditService.authSuccess(AuditAction.TOTP_DISABLED, {
      id: userId,
    });
    return result;
  }

  async get2faStatus(userId: string) {
    return this.manageTotpProvider.get2faStatus(userId);
  }

  async regenerateBackupCodes(userId: string, password: string) {
    await this.getActiveUserOrThrow(userId);
    const result = await this.manageTotpProvider.regenerateBackupCodes(
      userId,
      password,
    );
    await this.auditService.authSuccess(
      AuditAction.BACKUP_CODES_REGENERATED,
      { id: userId },
    );
    return result;
  }

  private async getActiveUserOrThrow(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      withDeleted: true,
    });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException(UserMessages.USER_NOT_FOUND);
    }
    return user;
  }
}
