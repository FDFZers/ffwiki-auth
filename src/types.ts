export interface PluginConfig {
    commandPrefix: string;
    userGroup: string;
    adminGroup: string;
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpEmail: string;
    smtpSender: string;
    smtpUser: string;
    smtpPassword: string;
    wikiUrl: string;
    wikiToken: string;
    defaultPassword: string;
    defaultGroups: string;
}

export interface UserInfo {
    qq: string;
    email: string;
    realName: string;
    studentNum: string;
    wikiId: number;
}

export enum RequestState {
    Unverified = "unverified",
    Pending = "pending",
}

export interface RequestInfo {
    qq?: string;
    email?: string;
    realName?: string;
    studentNum?: string;
    wikiName?: string;
    verifyCode?: string;
    state: RequestState;
    updateTime: number;
}

export type RequestMap = Map<string, RequestInfo>;
