import { ConfigService } from '@nestjs/config';
import { FiscalProvider } from './fiscal-provider.interface';
import { FISCAL_PROVIDER } from './fiscal.constants';
import { SandboxFiscalProvider } from './providers/sandbox-fiscal.provider';

// Ponto unico de troca de provedor. Para ligar um provedor real, crie um
// novo adapter (ex: FocusNfeProvider) implementando FiscalProvider,
// adicione um case abaixo e configure FISCAL_PROVIDER/FISCAL_API_KEY/
// FISCAL_API_URL no .env - nenhum outro modulo precisa mudar.
export const fiscalProviderFactory = {
  provide: FISCAL_PROVIDER,
  useFactory: (configService: ConfigService): FiscalProvider => {
    const provider = configService.get<string>('FISCAL_PROVIDER') ?? 'sandbox';

    switch (provider) {
      case 'sandbox':
      default:
        return new SandboxFiscalProvider();
    }
  },
  inject: [ConfigService],
};
