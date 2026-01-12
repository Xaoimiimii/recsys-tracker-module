import { Module } from '@nestjs/common';
import { SearchKeywordConfigService } from './search-keyword-config.service';
import { SearchKeywordConfigController } from './search-keyword-config.controller';

@Module({
  providers: [SearchKeywordConfigService],
  controllers: [SearchKeywordConfigController]
})
export class SearchKeywordConfigModule {}
