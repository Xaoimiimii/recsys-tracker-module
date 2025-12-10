import { TrackerConfig } from '../../types';
export declare class ConfigLoader {
    private readonly BASE_API_URL;
    private config;
    private domainKey;
    loadFromWindow(): TrackerConfig | null;
    fetchRemoteConfig(): Promise<TrackerConfig | null>;
    private transformRules;
    private transformReturnMethods;
    getConfig(): TrackerConfig | null;
}
//# sourceMappingURL=config-loader.d.ts.map