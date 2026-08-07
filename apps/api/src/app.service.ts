import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'nexus-erp-api',
      timestamp: new Date().toISOString(),
    };
  }
}
