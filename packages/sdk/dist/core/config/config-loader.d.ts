import { TrackerConfig } from '../../types';
export declare class ConfigLoader {
    private config;
    private domainKey;
    loadFromWindow(): TrackerConfig | null;
    fetchRemoteConfig(): Promise<TrackerConfig | null>;
    private transformRules;
    private transformConditions;
    private transformPayloadMappings;
    private transformTrackingTarget;
    private transformReturnMethods;
    private transformEventTypes;
    getConfig(): TrackerConfig | null;
}
//# sourceMappingURL=config-loader.d.ts.map