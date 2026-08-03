import path from "path";
import { WIKI_ERRORS } from "./constants";
import { pluginState } from "./state";
import { RequestInfo } from "./types";

const CREATE_QUERY = `
mutation($email: String!, $name: String!, $password: String, $groups: [Int]!) {
  users {
    create(
      email: $email
      name: $name
      passwordRaw: $password
      providerKey: "local"
      groups: $groups
      mustChangePassword: true
      sendWelcomeEmail: false
    ) {
      responseResult {
        succeeded
        slug
        message
      }
      user {
        id
      }
    }
  }
}`;

export async function createUser(data: Partial<RequestInfo>): Promise<number> {
    const url = path.join(pluginState.config.wikiUrl, "graphql");
    const variables = {
        email: data.email || "",
        name: data.wikiName || "",
        password: pluginState.config.defaultPassword,
        groups: pluginState.config.defaultGroups.split(",").map((s) => Number(s.trim())),
    };

    let response: Response;
    try {
        response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${pluginState.config.wikiToken}`,
            },
            body: JSON.stringify([
                {
                    operationName: null,
                    variables,
                    extensions: {},
                    query: CREATE_QUERY,
                },
            ]),
        });
    } catch (e) {
        pluginState.logger.error("账号创建网络错误:", e);
        throw "网络错误！";
    }

    if (!response.ok) {
        pluginState.logger.error(`账号创建 HTTP 错误: ${response.status} ${response.statusText}`);
        throw `HTTP 请求错误！状态码：${response.status} ${response.statusText}`;
    }

    let result: any;
    try {
        const json = await response.json();
        result = json[0]?.data?.users?.create;
    } catch (e) {
        pluginState.logger.error("账号创建响应解析失败:", e);
        throw "响应解析失败！";
    }

    if (!result || !result.responseResult) {
        throw "服务器返回格式异常！";
    }

    const { succeeded, slug, message } = result.responseResult;
    if (succeeded) {
        const id = result.user?.id;
        if (typeof id !== "number") throw "创建成功但未返回用户 ID！";
        return id;
    }

    // 构建错误信息
    const errorLines = [` - 错误 ID：${slug}`];
    if (WIKI_ERRORS[slug]) errorLines.push(` - 错误原因：${WIKI_ERRORS[slug]}`);
    errorLines.push(` - 错误信息：${message}`);
    throw errorLines.join("\n");
}
