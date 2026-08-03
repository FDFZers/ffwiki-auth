import fs from "fs";
import { nanoid } from "nanoid";
import type {
    NapCatPluginContext,
    PluginConfigSchema,
    PluginLogger,
} from "napcat-types/napcat-onebot/network/plugin/types";
import path from "path";
import { DEFAULT_CONFIG } from "./constants";
import type { PluginConfig } from "./types";

function isObject(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === "object" && !Array.isArray(v);
}

function sanitizeConfig(raw: unknown): PluginConfig {
    if (!isObject(raw)) return { ...DEFAULT_CONFIG };

    const out: PluginConfig = { ...DEFAULT_CONFIG };
    const safeString = (key: keyof PluginConfig) =>
        (typeof raw[key] === "string" ? raw[key] : out[key]) as string;
    const safeNumber = (key: keyof PluginConfig) =>
        (typeof raw[key] === "number" ? raw[key] : out[key]) as number;
    const safeBoolean = (key: keyof PluginConfig) =>
        (typeof raw[key] === "boolean" ? raw[key] : out[key]) as boolean;

    out.commandPrefix = safeString("commandPrefix");
    out.userGroup = safeString("userGroup");
    out.adminGroup = safeString("adminGroup");
    out.smtpHost = safeString("smtpHost");
    out.smtpPort = safeNumber("smtpPort");
    out.smtpSecure = safeBoolean("smtpSecure");
    out.smtpEmail = safeString("smtpEmail");
    out.smtpSender = safeString("smtpSender");
    out.smtpUser = safeString("smtpUser");
    out.smtpPassword = safeString("smtpPassword");
    out.wikiUrl = safeString("wikiUrl");
    out.wikiToken = safeString("wikiToken");
    out.defaultPassword = safeString("defaultPassword");
    out.defaultGroups = safeString("defaultGroups");

    return out;
}

export function buildConfigSchema(ctx: NapCatPluginContext): PluginConfigSchema {
    const { combine, text, number, boolean } = ctx.NapCatConfig;
    return combine(
        text("commandPrefix", "命令前缀", DEFAULT_CONFIG.commandPrefix),
        text("userGroup", "用户群号", DEFAULT_CONFIG.userGroup),
        text("adminGroup", "管理员群号", DEFAULT_CONFIG.adminGroup),
        text("smtpHost", "SMTP 主机", DEFAULT_CONFIG.smtpHost),
        number("smtpPort", "SMTP 端口", DEFAULT_CONFIG.smtpPort),
        boolean("smtpSecure", "是否使用 SSL/TLS", DEFAULT_CONFIG.smtpSecure),
        text("smtpEmail", "SMTP 邮箱", DEFAULT_CONFIG.smtpEmail),
        text("smtpSender", "SMTP 发件人", DEFAULT_CONFIG.smtpSender),
        text("smtpUser", "SMTP 用户名", DEFAULT_CONFIG.smtpUser),
        text("smtpPassword", "SMTP 密码", DEFAULT_CONFIG.smtpPassword),
        text("wikiUrl", "复旦附中 Wiki 地址", DEFAULT_CONFIG.wikiUrl),
        text("wikiToken", "复旦附中 Wiki 管理员 Api Key", DEFAULT_CONFIG.wikiToken),
        text("defaultPassword", "默认密码", DEFAULT_CONFIG.defaultPassword),
        text("defaultGroups", "默认用户组", DEFAULT_CONFIG.defaultGroups, "用户组 ID，用逗号隔开"),
    );
}

class PluginState {
    private _ctx: NapCatPluginContext | null = null;
    private timers: Map<string, NodeJS.Timeout> = new Map();
    private vars: Map<string, unknown> = new Map();
    public config: PluginConfig = { ...DEFAULT_CONFIG };
    public selfId = 0;

    get ctx(): NapCatPluginContext {
        if (!this._ctx) throw new Error("PluginState not initialized");
        return this._ctx;
    }

    get logger(): PluginLogger {
        return this.ctx.logger;
    }

    init(ctx: NapCatPluginContext): void {
        this._ctx = ctx;
        this.ensureDataDir();
        this.loadConfig();
        this.fetchSelfId();
    }

    private async fetchSelfId(): Promise<void> {
        try {
            const res = (await this.ctx.actions.call(
                "get_login_info",
                {},
                this.ctx.adapterName,
                this.ctx.pluginManager.config
            )) as { user_id?: number | string };
            if (res?.user_id) {
                this.selfId = Number(res.user_id);
                this.logger.debug(`机器人 QQ: ${this.selfId}`);
            }
        } catch (e) {
            this.logger.warn("获取机器人 QQ 号失败:", e);
        }
    }

    cleanup(): void {
        for (const [id, timer] of this.timers) {
            clearInterval(timer);
            this.logger.debug(`清理定时器: ${id}`);
        }
        this.timers.clear();
        this.vars.clear();
        this.saveConfig();
        this._ctx = null;
    }

    setTimeout(callback: () => void, delay: number): string {
        const id = nanoid();
        this.timers.set(id, setTimeout(callback, delay));
        return id;
    }

    clearTimeout(id: string): void {
        const timer = this.timers.get(id);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(id);
        }
    }

    setInterval(callback: () => void, delay: number): string {
        const id = nanoid();
        this.timers.set(id, setInterval(callback, delay));
        return id;
    }

    clearInterval(id: string): void {
        const timer = this.timers.get(id);
        if (timer) {
            clearInterval(timer);
            this.timers.delete(id);
        }
    }

    setVar<T>(key: string, value: T): void {
        this.vars.set(key, value);
    }

    getVar<T>(key: string): T {
        return this.vars.get(key) as T;
    }

    getVarOrSet<T>(key: string, defaultValue: () => T): T {
        if (this.vars.has(key)) return this.getVar<T>(key);
        const value = defaultValue();
        this.setVar(key, value);
        return value;
    }

    async getVarOrSetAsync<T>(key: string, defaultValue: () => Promise<T>): Promise<T> {
        if (this.vars.has(key)) return this.getVar<T>(key);
        const value = await defaultValue();
        this.setVar(key, value);
        return value;
    }

    removeVar(key: string): void {
        this.vars.delete(key);
    }

    private ensureDataDir(): void {
        const dataPath = this.ctx.dataPath;
        if (!fs.existsSync(dataPath)) {
            fs.mkdirSync(dataPath, { recursive: true });
        }
    }

    getDataFilePath(filename: string): string {
        return path.join(this.ctx.dataPath, filename);
    }

    loadDataFile<T>(filename: string, defaultValue: T): T {
        const filePath = this.getDataFilePath(filename);
        try {
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
                this.logger.debug(`已加载数据文件 ${filename}`);
                return data;
            }
        } catch (e) {
            this.logger.warn(`读取数据文件 ${filename} 失败:`, e);
        }
        return defaultValue;
    }

    saveDataFile<T>(filename: string, data: T): void {
        const filePath = this.getDataFilePath(filename);
        try {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
            this.logger.debug(`已保存数据文件 ${filename}`);
        } catch (e) {
            this.logger.error(`保存数据文件 ${filename} 失败:`, e);
        }
    }

    loadConfig(): void {
        const configPath = this.ctx.configPath;
        try {
            if (configPath && fs.existsSync(configPath)) {
                const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
                this.config = sanitizeConfig(raw);
                this.logger.debug("已加载本地配置");
            } else {
                this.config = { ...DEFAULT_CONFIG };
                this.saveConfig();
                this.logger.debug("配置文件不存在，已创建默认配置");
            }
        } catch (error) {
            this.logger.error("加载配置失败，使用默认配置:", error);
            this.config = { ...DEFAULT_CONFIG };
        }
    }

    saveConfig(): void {
        if (!this._ctx) return;
        const configPath = this._ctx.configPath;
        try {
            const configDir = path.dirname(configPath);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2), "utf-8");
            this.logger.debug("已保存本地配置");
        } catch (error) {
            this.logger.error("保存配置失败:", error);
        }
    }

    updateConfig(partial: Partial<PluginConfig>): void {
        this.config = { ...this.config, ...partial };
        this.saveConfig();
    }

    replaceConfig(config: PluginConfig): void {
        this.config = sanitizeConfig(config);
        this.saveConfig();
    }
}

export const pluginState = new PluginState();
