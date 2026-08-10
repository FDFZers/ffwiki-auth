import { nanoid } from "nanoid";
import type { OB11FriendAddNoticeEvent, OB11Message } from "napcat-types/napcat-onebot";
import type { NapCatPluginContext } from "napcat-types/napcat-onebot/network/plugin/types";
import { REGISTER_TIMEOUT_MS, RESEND_INTERVAL_MS, VERIFY_CODE_LENGTH } from "./constants";
import { sendVerifyEmail } from "./email";
import {
    approveRequest,
    rejectRequest,
    sendForwardMsg,
    sendGroupMessage,
    sendPrivateMessage,
    sendReply
} from "./message";
import { pluginState } from "./state";
import db from "./students.json";
import { RequestInfo, RequestMap, RequestState } from "./types";
import { hasEmail, hasStudentNum } from "./userInfo";

// ---------- 辅助：请求管理 ----------
export function loadRequests(): void {
    pluginState.setVar("requests", new Map<string, RequestInfo>());
    pluginState.setVar("pendingFriends", [] as string[]);
}

function getRequestMap(): RequestMap {
    return pluginState.getVar<RequestMap>("requests");
}

function getPendingFriends(): string[] {
    return pluginState.getVar<string[]>("pendingFriends");
}

function setPendingFriends(list: string[]): void {
    pluginState.setVar("pendingFriends", list);
}

function isCompleted(req: RequestInfo): boolean {
    return !!(req.realName && req.wikiName && req.email && req.studentNum);
}

function cleanRequests(): void {
    const map = getRequestMap();
    const now = Date.now();
    for (const [key, req] of map) {
        if (req.state === RequestState.Unverified && req.updateTime + REGISTER_TIMEOUT_MS < now) {
            map.delete(key);
        }
    }
}

// ---------- 主入口：注册命令 ----------
export async function onRegistrationCmd(
    ctx: NapCatPluginContext,
    event: OB11Message,
    args: string[]
): Promise<void> {
    cleanRequests();

    const userId = String(event.user_id);

    if (event.message_type === "group") {
        await startRegister(ctx, event);
        return;
    }

    // 私聊中继续注册流程
    const map = getRequestMap();
    const req = map.get(userId);
    if (!req) {
        await sendReply(ctx, event, `请先在用户群内使用 ${pluginState.config.commandPrefix} register 启动注册程序哦～`);
        return;
    }

    const updateReq = (newReq: Partial<RequestInfo>) => {
        map.set(userId, {
            ...req,
            ...newReq,
            updateTime: Date.now(),
        });
    };

    const subCmd = args[1]?.toLowerCase() || "";
    if (subCmd == "cancel") {
        getRequestMap().delete(userId);
        await sendReply(ctx, event, "你已取消注册程序～");
    }

    if (!isCompleted(req)) {
        await handleInfoCompletion(ctx, req, updateReq, userId, args);
    } else if (req.state === RequestState.Unverified) {
        await handleVerification(ctx, req, updateReq, userId, args);
    } else {
        await sendPrivateMessage(ctx, userId, "请耐心等待审批结果～");
    }
}

// ---------- 启动注册（群内触发） ----------
async function startRegister(ctx: NapCatPluginContext, event: OB11Message): Promise<void> {
    const userId = String(event.user_id);
    cleanRequests();

    if (getRequestMap().has(userId)) {
        await sendReply(ctx, event, "你已启动注册程序！请查看私信以继续注册～");
        return;
    }

    if (await initiateRegistration(ctx, userId)) {
        await sendReply(ctx, event, "欢迎加入复旦附中 Wiki！请查看私信以继续注册～");
    } else {
        await sendReply(ctx, event, "欢迎加入复旦附中 Wiki！请添加本机器人为好友以继续注册～");
        // 尝试自动通过好友请求
        const res = (await ctx.actions.call(
            "get_doubt_friends_add_request",
            {},
            ctx.adapterName,
            ctx.pluginManager.config
        )) as { user_id: string | number; flag: string }[];
        const found = res.find((item) => String(item.user_id) === userId);
        if (found) {
            await onFriendRequest(ctx, found.flag);
        } else {
            const pending = getPendingFriends();
            if (!pending.includes(userId)) {
                pending.push(userId);
                setPendingFriends(pending);
            }
        }
    }
}

// ---------- 发起注册（私聊或好友添加后） ----------
async function initiateRegistration(ctx: NapCatPluginContext, userId: string): Promise<boolean> {
    const message = [
        `===== [ 注册 ] =====`,
        "(｡·ω·｡) 正在启动注册程序......",
        "闲置 10 分钟后将自动取消注册！",
        `在注册前，请务必查看注册指南：https://ffwiki.top/zh/%E6%8C%87%E5%8D%97/%E8%B4%A6%E5%8F%B7%E6%B3%A8%E5%86%8C%E6%8C%87%E5%8D%97`,
        `你可以随时使用“${pluginState.config.commandPrefix} register cancel”取消注册程序～`,
    ];
    const ok = await sendPrivateMessage(ctx, userId, message.join("\n"));
    if (!ok) return false;

    const req: RequestInfo = {
        qq: userId,
        state: RequestState.Unverified,
        updateTime: Date.now(),
    };
    getRequestMap().set(userId, req);
    await sendInfoIncomplete(ctx, req, userId);
    return true;
}

// ---------- 处理好友请求和添加 ----------
export async function onFriendRequest(
    ctx: NapCatPluginContext,
    flag: string
): Promise<void> {
    await ctx.actions.call(
        "set_friend_add_request",
        { flag, approve: true },
        ctx.adapterName,
        ctx.pluginManager.config
    );
}

export async function onFriendAdded(
    ctx: NapCatPluginContext,
    event: OB11FriendAddNoticeEvent
): Promise<void> {
    const userId = String(event.user_id);
    ctx.logger.info(`新增好友：${userId}`);

    const pending = getPendingFriends();
    if (!pending.includes(userId)) return;
    cleanRequests();
    await initiateRegistration(ctx, userId);
    setPendingFriends(pending.filter((id) => id !== userId));
}

// ---------- 信息补充流程 ----------
async function handleInfoCompletion(
    ctx: NapCatPluginContext,
    req: RequestInfo,
    updateReq: (newReq: Partial<RequestInfo>) => void,
    userId: string,
    args: string[]
): Promise<void> {
    const subCmd = args[1]?.toLowerCase() || "";
    const value = args.slice(2).join(" ").trim();

    const validators: Record<string, (val: string) => string | true> = {
        user: (val) => {
            if (!val) return "用户名不能为空～";
            if (val.length <= 1) return "用户名长度应大于 1 个字符～";
            if (val.length > 255) return "用户名长度应小于 255 个字符～";
            return true;
        },
        email: (val) => {
            if (!val) return "邮箱不能为空～";
            if (val.length > 255) return "邮箱长度应小于 255 个字符～";
            if (!/^[\w\-.]+@([\w-]+\.)+[\w-]{2,}$/.test(val)) return "邮箱格式错误～";
            if (hasEmail(val)) return "此邮箱已存在～";
            return true;
        },
        name: (val) => {
            if (!val) return "姓名不能为空～";
            if (val.length <= 1) return "姓名长度应大于 1 个字符～";
            if (val.length > 6) return "姓名长度应小于 6 个字符～";
            if (!/^[\u4e00-\u9fff\u00b7]+$/.test(val)) return "姓名应为中文字符～";
            return true;
        },
        student: (val) => {
            if (!val) return "学号不能为空～";
            if (!/^\d{8}$/.test(val)) return "学号格式错误～";
            if (hasStudentNum(val)) return "此学号已存在～";
            return true;
        },
    };

    const validator = validators[subCmd];
    if (!validator) {
        await sendPrivateMessage(ctx, userId, "(╥﹏╥) 无效的子命令！");
        return;
    }

    const result = validator(value);
    if (result !== true) {
        await sendPrivateMessage(ctx, userId, result);
        return;
    }

    // 更新字段
    const fieldMap: Record<string, keyof RequestInfo> = {
        user: "wikiName",
        email: "email",
        name: "realName",
        student: "studentNum",
    };
    const field = fieldMap[subCmd];
    updateReq({ [field]: value });

    // 如果信息完整，发送验证码
    const updatedReq = getRequestMap().get(userId)!;
    if (isCompleted(updatedReq)) {
        await sendCode(ctx, updatedReq, (newReq) => {
            getRequestMap().set(userId, { ...updatedReq, ...newReq, updateTime: Date.now() });
        }, userId);
    } else {
        await sendInfoIncomplete(ctx, updatedReq, userId);
    }
}

// ---------- 显示未完成信息 ----------
async function sendInfoIncomplete(ctx: NapCatPluginContext, req: RequestInfo, userId: string): Promise<void> {
    const lines = [
        `===== [ 注册 - 设置基本信息 ] =====
请发送命令设置以下基础信息：`,
        `[QQ 号]：${req.qq}`,
        `[学号]：${req.studentNum || "<未设置>"}
请发送命令“${pluginState.config.commandPrefix} register student <学号>”${req.studentNum ? "修改" : "设置"}～
【请注意】：
 - 如果你是本部学生，请直接输入你的学号～
 - 如果你是徐汇分校学生，请将你学号中的班级 + 20，例如 20290101 -> 20292101
 - 如果你是青浦分校学生，请将你学号中的班级 + 40，并去掉第 7 位的 0，例如 202901001 -> 20294101
 - 如果你是浦东分校学生，请将你学号中的班级 + 60，例如 20290101 -> 20296101`,
        `[Wiki 用户名]：${req.wikiName || "<未设置>"}
请发送命令“${pluginState.config.commandPrefix} register user <用户名>”${req.wikiName ? "修改" : "设置"}～`,
        `[邮箱]：${req.email || "<未设置>"}
请发送命令“${pluginState.config.commandPrefix} register email <邮箱>”${req.email ? "修改" : "设置"}～
注：你的邮箱仅管理员可见`,
        `[真实姓名]：${req.realName || "<未设置>"}
请发送命令“${pluginState.config.commandPrefix} register name <姓名>”${req.realName ? "修改" : "设置"}～
注：你的姓名仅管理员可见`,
    ];
    await sendForwardMsg(ctx, userId, false, lines);
}

// ---------- 发送验证码 ----------
async function sendCode(
    ctx: NapCatPluginContext,
    req: RequestInfo,
    updateReq: (newReq: Partial<RequestInfo>) => void,
    userId: string
): Promise<void> {
    const infoLines = buildInfoComplete(req);
    const message = [
        infoLines,
        `===== [ 注册 - 邮箱验证 ] =====
(o'v'o) 一封带有验证码的邮件已发往你的邮箱！
请发送命令“${pluginState.config.commandPrefix} register verify <验证码>”以完成验证！
如果你未接到邮箱，请查看“垃圾邮箱”，或使用“${pluginState.config.commandPrefix} register resend”重发邮件～`,
    ];
    await sendForwardMsg(ctx, userId, false, message);
    await sendEmail(ctx, req, updateReq, userId);
}

function buildInfoComplete(req: RequestInfo): string {
    return `===== [ 注册 - 基本信息 ] =====
[学号]：${req.studentNum || "<未设置>"}
[姓名]：${req.realName || "<未设置>"}
[QQ 号]：${req.qq}
[邮箱]：${req.email || "<未设置>"}
[Wiki 用户名]：${req.wikiName || "<未设置>"}
注：你的姓名与邮箱仅管理员可见`;
}

async function sendEmail(
    ctx: NapCatPluginContext,
    req: RequestInfo,
    updateReq: (newReq: Partial<RequestInfo>) => void,
    userId: string
): Promise<void> {
    const code = nanoid(VERIFY_CODE_LENGTH);
    updateReq({ verifyCode: code });

    try {
        await sendVerifyEmail(req.email!!, code);
    } catch (e) {
        // 发送失败则删除请求
        getRequestMap().delete(userId);
        await sendPrivateMessage(ctx, userId, "(╥﹏╥) 注册失败：邮件发送失败！请联系管理员～");
    }
}

// ---------- 验证码处理 ----------
async function handleVerification(
    ctx: NapCatPluginContext,
    req: RequestInfo,
    updateReq: (newReq: Partial<RequestInfo>) => void,
    userId: string,
    args: string[]
): Promise<void> {
    const subCmd = args[1]?.toLowerCase() || "";
    if (subCmd === "verify") {
        const code = args[2]?.trim() || "";
        if (!code) {
            await sendPrivateMessage(ctx, userId, "验证码不能为空～");
            return;
        }
        if (req.verifyCode !== code) {
            await sendPrivateMessage(ctx, userId, "(╥﹏╥) 验证码错误！请重试！");
            return;
        }
        // 验证通过，进入待审核状态
        updateReq({ state: RequestState.Pending });
        await sendApply(ctx, { ...req, state: RequestState.Pending }, userId);
        return;
    }

    if (subCmd === "resend") {
        const interval = Date.now() - req.updateTime;
        if (interval < RESEND_INTERVAL_MS) {
            const remain = Math.round((RESEND_INTERVAL_MS - interval) / 1000);
            await sendPrivateMessage(ctx, userId, `请在 ${remain} 秒后再次尝试～`);
            return;
        }
        await sendEmail(ctx, req, updateReq, userId);
        await sendPrivateMessage(ctx, userId, "(o'v'o) 邮件已重新发往你的邮箱！");
        return;
    }

    await sendPrivateMessage(ctx, userId, "(╥﹏╥) 无效的子命令！");
}

// ---------- 提交审核 ----------
async function sendApply(
    ctx: NapCatPluginContext,
    req: RequestInfo,
    userId: string
): Promise<void> {
    const infoLines = buildInfoComplete(req);
    const message1 = [
        infoLines,
        `===== [ 注册 - 邮箱验证 ] =====
验证通过～`,
        `===== [ 注册 - 程序审核 ] =====
正在将你的信息与学生数据库进行匹配，请稍后～`,
    ];
    await sendForwardMsg(ctx, userId, false, message1);

    const dbName = (db as Record<string, string | undefined>)[req.studentNum!!];
    const matches = dbName === req.realName;
    const conflicts = dbName !== undefined && dbName !== req.realName;

    const message2 = [
        `===== [ 新的注册请求 ] =====`,
        `基本信息：`,
        `  - 学号：${req.studentNum}`,
        `  - 姓名：${req.realName}`,
    ];

    if (dbName) message2.push(`  - [学生数据库] 姓名：${dbName}`);
    else message2.push(`  - [学生数据库] 姓名：<未找到>`);

    message2.push(
        `  - QQ 号：${req.qq}`,
        `  - 邮箱：${req.email}`,
        `  - Wiki 用户名：${req.wikiName}`,
    );

    if (matches) {
        message2.push(`学生数据库匹配成功！正在同意请求～`);
    } else if (conflicts) {
        message2.push(`学生数据库不匹配！正在拒绝请求～`);
    } else {
        message2.push(
            `同意请求：${pluginState.config.commandPrefix} request approve ${req.qq}`,
            `拒绝请求：${pluginState.config.commandPrefix} request reject ${req.qq} [拒绝原因]`,
        );

        const message3 = [
            `===== [ 注册 - 程序审核 ] =====
学生数据库内未找到学生信息！你的注册请求将转至管理员审核～`,
            `===== [ 注册 - 管理员审核 ] =====
(o'v'o) 你的注册申请已发送给管理员！
请耐心等待申请结果！管理员们预计在几分钟至几天内审批！
审批后机器人将通过此处联系你，请留意～`
        ];
        await sendForwardMsg(ctx, userId, false, message3);
    }

    if (!await sendGroupMessage(ctx, pluginState.config.adminGroup, message2.join("\n"))) {
        getRequestMap().delete(userId);
        await sendPrivateMessage(ctx, userId, "(╥﹏╥) 注册失败：注册申请发送失败！请联系管理员～");
        return;
    }

    if (matches) await approveRequest(ctx, req, getRequestMap());
    if (conflicts) await rejectRequest(ctx, req, getRequestMap(), "学生数据库不匹配！");
}
