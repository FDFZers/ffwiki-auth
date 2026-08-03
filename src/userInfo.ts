import { pluginState } from "./state";
import { UserInfo } from "./types";

function getDataStores() {
    return {
        infos: pluginState.getVar<UserInfo[]>("userInfos"),
        qqMap: pluginState.getVar<Map<string, UserInfo>>("qqInfoMap"),
        wikiMap: pluginState.getVar<Map<number, UserInfo>>("wikiInfoMap"),
        studentMap: pluginState.getVar<Map<string, UserInfo>>("studentInfoMap"),
        emailList: pluginState.getVar<string[]>("emailList"),
    };
}

export function loadUserInfo(): void {
    const infos = pluginState.loadDataFile<UserInfo[]>("users.json", []);
    const qqMap = new Map<string, UserInfo>();
    const wikiMap = new Map<number, UserInfo>();
    const studentMap = new Map<string, UserInfo>();
    const emailList: string[] = [];

    for (const info of infos) {
        qqMap.set(info.qq, info);
        wikiMap.set(info.wikiId, info);
        studentMap.set(info.studentNum, info);
        emailList.push(info.email);
    }

    pluginState.setVar("userInfos", infos);
    pluginState.setVar("qqInfoMap", qqMap);
    pluginState.setVar("wikiInfoMap", wikiMap);
    pluginState.setVar("studentInfoMap", studentMap);
    pluginState.setVar("emailList", emailList);
}

export function saveUserInfo(): void {
    const infos = pluginState.getVar<UserInfo[]>("userInfos");
    pluginState.saveDataFile("users.json", infos);
}

export function addUserInfo(info: UserInfo): void {
    const stores = getDataStores();
    stores.infos.push(info);
    stores.qqMap.set(info.qq, info);
    stores.wikiMap.set(info.wikiId, info);
    stores.studentMap.set(info.studentNum, info);
    stores.emailList.push(info.email);
    saveUserInfo();
}

export function getUserInfoByQQ(qq: string): UserInfo | undefined {
    return getDataStores().qqMap.get(qq);
}

export function hasQQ(qq: string): boolean {
    return getDataStores().qqMap.has(qq);
}

export function getUserInfoByWikiId(wikiId: number): UserInfo | undefined {
    return getDataStores().wikiMap.get(wikiId);
}

export function getUserInfoByStudentNum(studentNum: string): UserInfo | undefined {
    return getDataStores().studentMap.get(studentNum);
}

export function hasStudentNum(studentNum: string): boolean {
    return getDataStores().studentMap.has(studentNum);
}

export function hasEmail(email: string): boolean {
    return getDataStores().emailList.includes(email);
}
