import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  /** Hash falso, calculado una vez, para gastar el mismo tiempo cuando el correo no existe. */
  private dummyHash: Promise<string> | undefined;

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  /** Verifica contra un hash falso; siempre devuelve false. Mitiga la enumeración de cuentas por tiempo. */
  async verifyDummy(plain: string): Promise<false> {
    this.dummyHash ??= this.hash('xrlab-dummy-password');
    await this.verify(await this.dummyHash, plain);

    return false;
  }
}
