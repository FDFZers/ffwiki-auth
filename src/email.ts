import nodemailer, { Transporter } from "nodemailer";
import { pluginState } from "./state";

const TEMPLATE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>复旦附中 Wiki - 邮箱验证</title>
    <style>
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f4f7fa; font-family: "Helvetica Neue", Helvetica, Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; }
        
        .code-box {
            background-color: #f0f2f5;
            border-radius: 8px;
            padding: 15px 30px;
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 5px;
            color: #333333;
            display: inline-block;
            margin: 20px 0;
            font-family: Consolas, Monaco, monospace;
        }
        
        .btn {
            background-color: #1a73e8;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 30px;
            border-radius: 6px;
            font-weight: bold;
            display: inline-block;
            mso-padding-alt: 0;
        }
        
        @media screen and (max-width: 600px) {
            .email-container { width: 100% !important; }
            .fluid { max-width: 100% !important; height: auto !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f7fa;">
    <div style="display: none; font-size: 1px; color: #fefefe; line-height: 1px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
        你的复旦附中 Wiki 注册验证码是：{{VERIFY_CODE}}
    </div>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f7fa;">
        <tr>
            <td align="center" style="padding: 40px 40px;">
                <table border="0" cellpadding="0" cellspacing="0" width="600" class="email-container" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); overflow: hidden;">
                    <tr>
                        <td align="center" style="padding: 40px 40px 20px 40px; background: linear-gradient(135deg, #1a73e8 0%, #4facfe 100%);">
                            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600; letter-spacing: 1px;">
                                复旦附中 Wiki - 邮箱验证
                            </h1>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 40px 40px;">
                            <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 22px; font-weight: 500;">欢迎加入复旦附中 Wiki</h2>
                            <p style="margin: 0 0 10px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                                你好！你正在进行账号注册操作。请使用下方的验证码完成验证：
                            </p>
                            <div class="code-box">
                                {{VERIFY_CODE}}
                            </div>
                            <p style="margin: 20px 0 0 0; color: #999999; font-size: 14px;">
                                验证码有效期为 <strong>10 分钟</strong>。<br>
                                如非本人操作，请忽略此邮件。
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 40px;">
                            <hr style="border: none; border-top: 1px solid #eeeeee; margin: 0;">
                        </td>
                    </tr>            
                    <tr>
                        <td align="center" style="padding: 30px 40px; color: #999999; font-size: 12px; line-height: 1.5;">
                            <p style="margin: 0 0 10px 0;">
                                这是一封系统自动发送的邮件，请勿直接回复。
                            </p>
                            <p style="margin: 0;">
                                &copy; 2026 复旦附中 Wiki | <a href="https://ffwiki.top/" style="color: #1a73e8; text-decoration: none;"> 访问网站</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

export async function sendVerifyEmail(receiver: string, code: string): Promise<void> {
    try {
        const transporter: Transporter = nodemailer.createTransport({
            host: pluginState.config.smtpHost,
            port: pluginState.config.smtpPort,
            secure: pluginState.config.smtpSecure,
            auth: {
                user: pluginState.config.smtpUser,
                pass: pluginState.config.smtpPassword,
            },
        });
        await transporter.sendMail({
            from: `${pluginState.config.smtpSender} <${pluginState.config.smtpEmail}>`,
            to: receiver,
            subject: "复旦附中 Wiki - 邮箱验证",
            html: TEMPLATE.replaceAll("{{VERIFY_CODE}}", code),
        });
        pluginState.logger.info(`已发送注册邮件至 ${receiver}`);
    } catch (e) {
        pluginState.logger.debug(`无法发送注册邮件至 ${receiver}：`, e);
        throw e;
    }
}
