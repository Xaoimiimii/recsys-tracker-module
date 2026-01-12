import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ElasticsearchModule } from "@nestjs/elasticsearch";

@Global()
@Module({
  imports: [
    ElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        return {
          node: configService.getOrThrow<string>('ELASTIC_ENDPOINT'),
          auth: {
            apiKey: configService.getOrThrow<string>('ELASTIC_API_KEY'),
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [ElasticsearchModule],
})
export class ElasticConfigModule {}