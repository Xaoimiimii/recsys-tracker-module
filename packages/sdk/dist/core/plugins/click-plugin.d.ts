import { BasePlugin } from './base-plugin';
import { TrackerConfig } from '../../types';
export declare class ClickPlugin extends BasePlugin {
    readonly name = "click-plugin";
    private config;
    constructor(config?: TrackerConfig);
    start(): void;
    private runPascalMode;
    private runLegacyMode;
}
//# sourceMappingURL=click-plugin.d.ts.map