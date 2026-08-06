import { pluginState } from "./state";
import { UserInfo } from "./types";

function getDataStores() {
    return {
        studentMap: pluginState.getVar<Map<string, UserInfo>>("studentInfoMap"),
        qqMap: pluginState.getVar<Map<string, string>>("qqInfoMap"),
        wikiMap: pluginState.getVar<Map<number, string>>("wikiInfoMap"),
        emailMap: pluginState.getVar<Map<string, string>>("emailMap"),
    };
}

export function loadUserInfo(): void {
    const infos = pluginState.loadDataFile<UserInfo[]>("users.json", []);
    const studentMap = new Map<string, UserInfo>();
    const qqMap = new Map<string, string>();
    const wikiMap = new Map<number, string>();
    const emailMap = new Map<string, string>();

    for (const info of infos) {
        studentMap.set(info.studentNum, info);
        qqMap.set(info.qq, info.studentNum);
        wikiMap.set(info.wikiId, info.studentNum);
        emailMap.set(info.email, info.studentNum);
    }

    pluginState.setVar("studentInfoMap", studentMap);
    pluginState.setVar("qqInfoMap", qqMap);
    pluginState.setVar("wikiInfoMap", wikiMap);
    pluginState.setVar("emailMap", emailMap);
}

export function saveUserInfo(): void {
    const infos = pluginState.getVar<UserInfo[]>("userInfos");
    pluginState.saveDataFile("users.json", infos);
}

export function addUserInfo(info: UserInfo): void {
    const stores = getDataStores();
    stores.studentMap.set(info.studentNum, info);
    stores.qqMap.set(info.qq, info.studentNum);
    stores.wikiMap.set(info.wikiId, info.studentNum);
    stores.emailMap.set(info.email, info.studentNum);
    saveUserInfo();
}

export function getUserInfosByName(name: string): UserInfo[] {
    return getDataStores().studentMap.values().filter(info => info.realName === name).toArray();
}

export function getUserInfoByQQ(qq: string): UserInfo | undefined {
    const stores = getDataStores();
    const num = stores.qqMap.get(qq);
    if (!num) return undefined;
    return stores.studentMap.get(num);
}

export function hasQQ(qq: string): boolean {
    return getDataStores().qqMap.has(qq);
}

export function getUserInfoByWikiId(wikiId: number): UserInfo | undefined {
    const stores = getDataStores();
    const num = stores.wikiMap.get(wikiId);
    if (!num) return undefined;
    return stores.studentMap.get(num);
}

export function getUserInfoByStudentNum(studentNum: string): UserInfo | undefined {
    return getDataStores().studentMap.get(studentNum);
}

export function hasStudentNum(studentNum: string): boolean {
    return getDataStores().studentMap.has(studentNum);
}

export function getUserInfoByEmail(email: string): UserInfo | undefined {
    const stores = getDataStores();
    const num = stores.emailMap.get(email);
    if (!num) return undefined;
    return stores.studentMap.get(num);
}

export function hasEmail(email: string): boolean {
    return getDataStores().emailMap.has(email);
}
