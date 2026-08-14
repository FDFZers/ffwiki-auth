import { PluginConfig } from "./types";

export const DEFAULT_CONFIG: PluginConfig = {
    commandPrefix: "/ffwiki",
    userGroup: "1094279643",
    adminGroup: "764847802",
    smtpHost: "smtp.fdfz.top",
    smtpPort: 465,
    smtpSecure: true,
    smtpEmail: "",
    smtpSender: "FFWiki Bot",
    smtpUser: "",
    smtpPassword: "",
    wikiUrl: "",
    wikiToken: "",
    defaultPassword: "114514",
    defaultGroups: "3",
};

export const REGISTER_TIMEOUT_MS = 10 * 60 * 1000; // 10分钟
export const RESEND_INTERVAL_MS = 2 * 60 * 1000;   // 2分钟
export const VERIFY_CODE_LENGTH = 6;

export const WIKI_ERRORS: Record<string, string> = {
    AuthGenericError: "服务器内部错误：未知鉴权错误！",
    AuthProviderInvalid: "服务器内部错误：无效的认证提供程序！",
    AuthAccountAlreadyExists: "该邮箱已存在！",
    InputInvalid: "提供的基本信息无效！",
    UserCreationFailed: "服务器内部错误：用户创建失败！",
    SystemGenericError: "服务器内部错误：未知错误！",
};
