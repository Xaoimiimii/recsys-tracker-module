import { TrackerConfig } from '../../types';
export declare class ConfigLoader {
    private readonly BASE_API_URL;
    private config;
    private domainKey;
    loadFromWindow(): TrackerConfig | null;
    fetchRemoteConfig(): Promise<TrackerConfig | null>;
    private transformRules;
    private transformConditions;
    private transformPayloadMappings;
    private transformTrackingTarget;
    private transformReturnMethods;
    getConfig(): TrackerConfig | null;
    private adaptLegacyConfig;
}
//# sourceMappingURL=config-loader.d.ts.map