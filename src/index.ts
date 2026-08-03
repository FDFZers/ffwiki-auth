import type { OB11FriendAddNoticeEvent, OB11FriendRequestEvent } from "napcat-types/napcat-onebot";
import type { PluginConfigSchema, PluginModule } from "napcat-types/napcat-onebot/network/plugin/types";
import { EventType } from "napcat-types/napcat-types/index";
import { handleMessage } from "./message";
import { loadRequests, onFriendAdded, onFriendRequest } from "./register";
import { buildConfigSchema, pluginState } from "./state";
import { PluginConfig } from "./types";
import { loadUserInfo, saveUserInfo } from "./userInfo";

export let plugin_config_ui: PluginConfigSchema = [];

export const plugin_init: PluginModule["plugin_init"] = async (ctx) => {
    try {
        ctx.logger.info("(｡·ω·｡) 插件初始化中...");
        pluginState.init(ctx);
        plugin_config_ui = buildConfigSchema(ctx);
        loadUserInfo();
        loadRequests();
        ctx.logger.info("(o'v'o) 插件初始化完成");
    } catch (error) {
        ctx.logger.error("(╥﹏╥) 插件初始化失败:", error);
    }
};

export const plugin_onmessage: PluginModule["plugin_onmessage"] = async (ctx, event) => {
    if (event.post_type !== EventType.MESSAGE) return;
    await handleMessage(ctx, event);
};

export const plugin_onevent: PluginModule["plugin_onevent"] = async (ctx, event: any) => {
    if (event?.request_type === "friend") {
        const e = event as OB11FriendRequestEvent;
        await onFriendRequest(ctx, e.flag);
    } else if (event?.notice_type === "friend_add") {
        await onFriendAdded(ctx, event as OB11FriendAddNoticeEvent);
    }
};

export const plugin_cleanup: PluginModule["plugin_cleanup"] = async (ctx) => {
    try {
        saveUserInfo();
        pluginState.saveConfig();
        pluginState.cleanup();
        ctx.logger.info("(o'v'o) 插件已卸载");
    } catch (e) {
        ctx.logger.warn("(╥﹏╥) 插件卸载时出错:", e);
    }
};

export const plugin_get_config: PluginModule["plugin_get_config"] = async (ctx) => {
    return pluginState.config;
};

export const plugin_set_config: PluginModule["plugin_set_config"] = async (ctx, config) => {
    pluginState.replaceConfig(config as PluginConfig);
    ctx.logger.info("(o'v'o) 插件已更新配置");
};

export const plugin_on_config_change: PluginModule["plugin_on_config_change"] = async (
    ctx,
    ui,
    key,
    value,
    currentConfig
) => {
    try {
        pluginState.updateConfig({ [key]: value });
        ctx.logger.debug(`配置项 ${key} 已更新`);
    } catch (err) {
        ctx.logger.error("更新配置项失败:", err);
    }
};
