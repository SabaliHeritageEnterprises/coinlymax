import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UserGateway } from './user.gateway';

/**
 * Global realtime layer. Exposes UserGateway so any module (notifications,
 * admin, trades…) can push live updates to a specific user's dashboard.
 */
@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [UserGateway],
  exports: [UserGateway],
})
export class RealtimeModule {}
