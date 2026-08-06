import type { OB11Message, OB11PostSendMsg } from "napcat-types/napcat-onebot";
import type { NapCatPluginContext } from "napcat-types/napcat-onebot/network/plugin/types";
import { onRegistrationCmd } from "./register";
import { pluginState } from "./state";
import db from "./students.json";
import { RequestInfo, RequestMap, UserInfo } from "./types";
import { getUserInfoByStudentNum, getUserInfosByName } from "./userInfo";
import { createUser } from "./wiki";

// ---------- 发送消息基础函数 ----------
type SendTarget = { message_type: "private"; user_id: string } | { message_type: "group"; group_id: string };

async function sendMessage(
    ctx: NapCatPluginContext,
    target: SendTarget,
    message: OB11PostSendMsg["message"]
): Promise<boolean> {
    try {
        const params: OB11PostSendMsg = {
            message,
            message_type: target.message_type,
            ...(target.message_type === "group" ? { group_id: target.group_id } : {}),
            ...(target.message_type === "private" ? { user_id: target.user_id } : {}),
        };
        await ctx.actions.call("send_msg", params, ctx.adapterName, ctx.pluginManager.config);
        return true;
    } catch (error) {
        pluginState.logger.error("发送消息失败:", error);
        return false;
    }
}

export async function sendReply(
    ctx: NapCatPluginContext,
    event: OB11Message,
    message: OB11PostSendMsg["message"]
): Promise<boolean> {
    const target: SendTarget =
        event.message_type === "group"
            ? { message_type: "group", group_id: String(event.group_id!) }
            : { message_type: "private", user_id: String(event.user_id!) };
    return sendMessage(ctx, target, message);
}

export async function sendGroupMessage(
    ctx: NapCatPluginContext,
    groupId: number | string,
    message: OB11PostSendMsg["message"]
): Promise<boolean> {
    return sendMessage(ctx, { message_type: "group", group_id: String(groupId) }, message);
}

export async function sendPrivateMessage(
    ctx: NapCatPluginContext,
    userId: number | string,
    message: OB11PostSendMsg["message"]
): Promise<boolean> {
    return sendMessage(ctx, { message_type: "private", user_id: String(userId) }, message);
}

// ---------- 合并转发 ----------
export interface ForwardNode {
    type: "node";
    data: {
        nickname: string;
        user_id?: string;
        content: string;
    };
}

export async function sendForwardMsgNodes(
    ctx: NapCatPluginContext,
    target: number | string,
    isGroup: boolean,
    nodes: ForwardNode[]
): Promise<boolean> {
    try {
        const actionName = isGroup ? "send_group_forward_msg" : "send_private_forward_msg";
        const params: Record<string, unknown> = { message: nodes };
        if (isGroup) params.group_id = String(target);
        else params.user_id = String(target);
        await ctx.actions.call(
            actionName as "send_group_forward_msg",
            params as never,
            ctx.adapterName,
            ctx.pluginManager.config
        );
        return true;
    } catch (error) {
        pluginState.logger.error("发送合并转发消息失败:", error);
        return false;
    }
}

export async function sendForwardMsg(
    ctx: NapCatPluginContext,
    target: number | string,
    isGroup: boolean,
    textLines: string[]
): Promise<boolean> {
    const nodes: ForwardNode[] = textLines.map((line) => ({
        type: "node",
        data: {
            nickname: pluginState.config.smtpSender,
            user_id: String(pluginState.selfId),
            content: line,
        },
    }));
    return sendForwardMsgNodes(ctx, target, isGroup, nodes);
}

// ---------- 管理员检查 ----------
export async function checkIsAdmin(event: OB11Message): Promise<boolean> {
    const admins = await pluginState.getVarOrSetAsync<string[]>("admins", async () => {
        const res = (await pluginState.ctx.actions.call(
            "get_group_member_list",
            { group_id: pluginState.config.adminGroup },
            pluginState.ctx.adapterName,
            pluginState.ctx.pluginManager.config
        )) as { user_id: number | string }[];
        return res.map((item) => String(item.user_id));
    });
    return admins.includes(String(event.user_id));
}

// ---------- 主消息处理 ----------
export async function handleMessage(ctx: NapCatPluginContext, event: OB11Message): Promise<void> {
    try {
        const rawMessage = event.raw_message || "";
        const messageType = event.message_type;
        const groupId = event.group_id ? String(event.group_id) : undefined;
        const userId = String(event.user_id);
        const isUserGroup = groupId === pluginState.config.userGroup;
        const isAdminGroup = groupId === pluginState.config.adminGroup;
        const isAdmin = isAdminGroup || (await checkIsAdmin(event));

        // 只处理用户群或管理群
        if (messageType === "group" && !isUserGroup && !isAdminGroup) return;

        const prefix = pluginState.config.commandPrefix;
        if (!rawMessage.startsWith(prefix)) return;

        const args = rawMessage.slice(prefix.length).trim().split(/\s+/);
        const cmd = args[0]?.toLowerCase() || "";

        switch (cmd) {
            case "help":
                await handleHelp(ctx, event, prefix, isUserGroup, isAdminGroup);
                break;

            case "register":
                await handleRegister(ctx, event, messageType, isUserGroup, userId, args);
                break;

            case "info":
                await handleInfo(ctx, event, args, isAdminGroup, isAdmin, messageType);
                break;

            case "request":
                await handleRequest(ctx, event, args, isAdminGroup);
                break;

            default:
                await sendReply(ctx, event, `欢迎使用复旦附中 Wiki 机器人！请使用 ${prefix} help 查看帮助～`);
        }
    } catch (error) {
        pluginState.logger.error("处理消息时出错:", error);
    }
}

// ---------- 子命令处理函数 ----------
async function handleHelp(
    ctx: NapCatPluginContext,
    event: OB11Message,
    prefix: string,
    isUserGroup: boolean,
    isAdminGroup: boolean
): Promise<void> {
    const lines = [
        `===== [ 机器人帮助 ] =====`,
        `${prefix} help - 显示帮助信息`,
        `${prefix} info - 查询用户信息`
    ];
    if (isUserGroup) lines.push(`${prefix} register - 申请注册复旦附中 Wiki 账号`);
    if (isAdminGroup) lines.push(`${prefix} request - 处理注册申请`);
    await sendReply(ctx, event, lines.join("\n"));
}

async function handleRegister(
    ctx: NapCatPluginContext,
    event: OB11Message,
    messageType: string,
    isUserGroup: boolean,
    userId: string,
    args: string[]
): Promise<void> {
    if (messageType === "group" && !isUserGroup) {
        await sendReply(ctx, event, "请在用户群内使用此命令～");
        return;
    }
    // 检查是否已绑定
    const { hasQQ } = await import("./userInfo");
    if (hasQQ(userId)) {
        await sendReply(ctx, event, "你已绑定复旦附中 Wiki 账号！");
        return;
    }
    await onRegistrationCmd(ctx, event, args);
}

async function handleInfo(
    ctx: NapCatPluginContext,
    event: OB11Message,
    args: string[],
    isAdminGroup: boolean,
    isAdmin: boolean,
    messageType: string
): Promise<void> {
    const subCommand = args[1]?.toLowerCase() || "";
    const query = args[2] || "";
    const forceFull = isAdminGroup || (isAdmin && messageType === "private") || ["name", "email"].includes(subCommand);
    const isFull = forceFull || args[3]?.toLowerCase() === "full";

    if (isFull && !isAdmin) {
        await sendReply(ctx, event, "权限不足：只有管理员才能查看完整信息哦～");
        return;
    }

    switch (subCommand) {
        case "help": {
            const lines = [
                `===== [ 机器人帮助 - 查询用户信息 ] =====`,
                `${pluginState.config.commandPrefix} info help - 显示帮助信息`,
            ];
            if (forceFull) {
                lines.push(
                    `${pluginState.config.commandPrefix} info qq <qq> - 通过 QQ 号查询用户信息`,
                    `${pluginState.config.commandPrefix} info student <学号> - 通过学号查询用户信息`,
                    `${pluginState.config.commandPrefix} info name <姓名> - 通过姓名查询用户信息`,
                    `${pluginState.config.commandPrefix} info email <邮箱> - 通过邮箱查询用户信息`,
                    `${pluginState.config.commandPrefix} info wiki <id> - 通过 Wiki ID 查询用户信息`
                );
            } else {
                lines.push(
                    `${pluginState.config.commandPrefix} info qq <qq> [full] - 通过 QQ 号查询用户信息`,
                    `${pluginState.config.commandPrefix} info student <学号> [full] - 通过学号查询用户信息`,
                    `${pluginState.config.commandPrefix} info wiki <id> [full] - 通过 Wiki ID 查询用户信息`,
                    `${pluginState.config.commandPrefix} info name <姓名> - 通过姓名查询用户完整信息`,
                    `${pluginState.config.commandPrefix} info email <邮箱> - 通过邮箱查询用户完整信息`,
                    `注意：命令后可选择加“full”来查询完整信息`
                );
            }
            await sendReply(ctx, event, lines.join("\n"));
            return;
        }

        case "qq":
        case "student":
        case "email":
        case "wiki": {
            let info = undefined as UserInfo | undefined;
            let dbInfo = undefined as [string, string] | undefined;
            try {
                const {
                    getUserInfoByQQ,
                    getUserInfoByStudentNum,
                    getUserInfoByEmail,
                    getUserInfoByWikiId
                } = await import("./userInfo");
                switch (subCommand) {
                    case "qq":
                        info = getUserInfoByQQ(query);
                        if (info) {
                            const name = (db as Record<string, string | undefined>)[info.studentNum];
                            if (name) dbInfo = [info.studentNum, name];
                        }
                        break;
                    case "email":
                        info = getUserInfoByEmail(query);
                        if (info) {
                            const name = (db as Record<string, string | undefined>)[info.studentNum];
                            if (name) dbInfo = [info.studentNum, name];
                        }
                        break;
                    case "wiki":
                        info = getUserInfoByWikiId(Number(query));
                        if (info) {
                            const name = (db as Record<string, string | undefined>)[info.studentNum];
                            if (name) dbInfo = [info.studentNum, name];
                        }
                        break;
                    case "student":
                        info = getUserInfoByStudentNum(query);
                        const name = (db as Record<string, string | undefined>)[query];
                        if (name) dbInfo = [query, name];
                        break;
                }
            } catch (e) {
                await sendReply(ctx, event, "(╥﹏╥) 查询失败！");
                pluginState.logger.error(`查询 '${subCommand} - ${query}' 失败！`, e);
                return;
            }
            if (!(info || dbInfo && isFull)) {
                await sendReply(ctx, event, "(｡-ω-) 用户信息不存在！");
                return;
            }
            await sendReply(ctx, event, buildUserInfo(info, dbInfo, isFull));
            return;
        }

        case "name": {
            const infos = getUserInfosByName(query);
            const dbNames = Object.entries(db)
                .filter(([_, name]) => query === name);
            const studentNums = [...new Set(infos.map(info => info.studentNum)
                .concat(dbNames.map(([studentNum, _]) => studentNum)))];
            if (studentNums.length === 0) {
                await sendReply(ctx, event, "(｡-ω-) 用户信息不存在！");
                return;
            }
            const messages = [
                `===== [ 查询结果 ] =====\n查询到 ${studentNums.length} 条记录～`,
                ...studentNums.map(studentNum => buildUserInfo(
                    infos.find(info => info.studentNum === studentNum),
                    dbNames.find(([num, _]) => num === studentNum),
                    isFull
                ))
            ];
            if (event.message_type == "group") await sendForwardMsg(ctx, event.group_id!!, true, messages);
            else await sendForwardMsg(ctx, event.user_id, false, messages);
            return;
        }

        default:
            await sendReply(ctx, event, `无效的子命令！请使用 ${pluginState.config.commandPrefix} info help 查看帮助～`);
    }
}

function buildUserInfo(info: UserInfo | undefined, dbInfo: [string, string] | undefined = undefined, isFull: boolean = false) {
    const lines = ["===== [ 用户信息 ] ====="];
    if (isFull) {
        if (dbInfo) lines.push(
            `[学生数据库] 学号：${dbInfo[0]}`,
            `[学生数据库] 姓名：${dbInfo[1]}`
        );
        else lines.push(`[学生数据库] 姓名：<未找到>`);
        if (info) lines.push(`姓名：${info.realName}`, `邮箱：${info.email}`);
    }
    if (info) lines.push(
        `学号：${info.studentNum}`,
        `QQ 号：${info.qq}`,
        `Wiki ID：${info.wikiId}`
    );
    return lines.join("\n");
}

async function handleRequest(
    ctx: NapCatPluginContext,
    event: OB11Message,
    args: string[],
    isAdminGroup: boolean
): Promise<void> {
    if (!isAdminGroup) {
        await sendReply(ctx, event, "权限不足：请在管理群内使用此命令～");
        return;
    }

    const subCommand = args[1]?.toLowerCase() || "";
    const qq = args[2] || "";
    const map = pluginState.getVar<RequestMap>("requests");
    const req = map.get(qq);
    if (!req) {
        await sendReply(ctx, event, "(｡-ω-) 请求不存在！");
        return;
    }

    switch (subCommand) {
        case "approve":
            await approveRequest(ctx, req, map);
            break;
        case "reject": {
            const message = args.slice(3).join(" ") || "";
            await rejectRequest(ctx, req, map, message);
            break;
        }
        default:
            await sendReply(ctx, event, "(╥﹏╥) 无效的子命令！");
    }
}

export async function approveRequest(
    ctx: NapCatPluginContext,
    req: RequestInfo,
    map: RequestMap
): Promise<void> {
    await sendGroupMessage(ctx, pluginState.config.adminGroup, "请求已通过！正在创建账号...");
    await sendPrivateMessage(ctx, req.qq!!, "(o'v'o) 注册申请已通过！正在创建账号...");
    try {
        const id = await createUser(req);
        const { addUserInfo } = await import("./userInfo");
        addUserInfo({
            wikiId: id,
            qq: req.qq!!,
            email: req.email!!,
            studentNum: req.studentNum!!,
            realName: req.realName!!,
        });
        const lines = [
            `===== [ 注册 ] =====`,
            "(o'v'o) 账号创建成功！欢迎加入复旦附中 Wiki～",
            `你的初始密码为：${pluginState.config.defaultPassword}`,
            "前往 https://ffwiki.top/login 登录吧！",
        ];
        const lines2 = [
            {
                type: "text",
                data: {
                    text: "===== [ 账号创建 ] =====\n(o'v'o) 🎉 欢迎 "
                }
            },
            {
                type: "at",
                data: {
                    qq: req.qq!!
                }
            },
            {
                type: "text",
                data: {
                    text: `（${req.qq}）加入复旦附中 Wiki！\n- 学号：${req.studentNum}\n- Wiki ID：${id}`
                }
            },
        ] as OB11PostSendMsg["message"];
        await sendPrivateMessage(ctx, req.qq!!, lines.join("\n"));
        await sendGroupMessage(ctx, pluginState.config.adminGroup, "(o'v'o) 账号创建成功！");
        await sendGroupMessage(ctx, pluginState.config.userGroup, lines2);
        map.delete(req.qq!!);
    } catch (e: any) {
        const errorMsg = typeof e === "string" ? e : e.message || e;
        await sendPrivateMessage(ctx, req.qq!!, `(╥﹏╥) 账号创建失败，请联系管理员：${errorMsg}`);
        await sendGroupMessage(ctx, pluginState.config.adminGroup, `(╥﹏╥) 账号创建失败：${errorMsg}`);
        map.delete(req.qq!!);
    }
}

export async function rejectRequest(
    ctx: NapCatPluginContext,
    req: RequestInfo,
    map: RequestMap,
    message: string
): Promise<void> {
    await sendGroupMessage(ctx, pluginState.config.adminGroup, "请求已拒绝！");
    await sendPrivateMessage(ctx, req.qq!!, `(╥﹏╥) 注册申请已被拒绝！原因：${message}`);
    map.delete(req.qq!!);
}
