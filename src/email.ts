import nodemailer, { Transporter } from "nodemailer";
import { pluginState } from "./state";

const TEMPLATE = `<!DOCTYPE html>
<html lang="zh-CN" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="x-apple-disable-message-reformatting">
    <title>邮箱验证 - 复旦附中 Wiki</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:AllowPNG/>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
    <style>
        body, table, td, a {
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
        }

        table, td {
            mso-table-lspace: 0pt;
            mso-table-rspace: 0pt;
        }

        img {
            -ms-interpolation-mode: bicubic;
            border: 0;
            height: auto;
            line-height: 100%;
            outline: none;
            text-decoration: none;
        }

        table {
            border-collapse: collapse !important;
        }

        body {
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            background-color: #f4f5f6;
        }

        @media screen and (max-width: 600px) {
            .email-container {
                width: 100% !important;
                margin: auto !important;
            }

            .fluid {
                max-width: 100% !important;
                height: auto !important;
                margin-left: auto !important;
                margin-right: auto !important;
            }

            .stack-column, .stack-column-center {
                display: block !important;
                width: 100% !important;
                max-width: 100% !important;
                direction: ltr !important;
            }

            .center-on-narrow {
                text-align: center !important;
                display: block !important;
                margin-left: auto !important;
                margin-right: auto !important;
                float: none !important;
            }

            table.center-on-narrow {
                display: inline-block !important;
            }

            .mobile-padding {
                padding-left: 20px !important;
                padding-right: 20px !important;
            }

            .mobile-header-center {
                text-align: center !important;
            }

            .mobile-logo-center {
                margin: 0 auto 15px auto !important;
                display: block !important;
            }

            .mobile-title-center {
                text-align: center !important;
            }
        }
    </style>
</head>
<body style="margin: 0 !important; padding: 0 !important; background-color: #f4f5f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">

<div style="display: none; font-size: 1px; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
    您的复旦附中 Wiki 注册验证码是 {{VERIFY_CODE}}。
</div>

<center style="width: 100%; background-color: #f4f5f6;">
    <!--[if mso | IE]>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
           style="background-color: #f4f5f6;">
        <tr>
            <td>
    <![endif]-->

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
           style="background-color: #f4f5f6;">
        <tr>
            <td style="padding: 40px 10px;">

                <table role="presentation" align="center" class="email-container" width="600"
                       style="margin: auto; max-width: 600px;">

                    <tr>
                        <td align="center" style="padding-bottom: 24px;" class="mobile-header-center">
                            <!--[if mso]>
                            <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%">
                                <tr>
                                    <td align="left" valign="middle" width="80">
                            <![endif]-->

                            <div style="display: inline-block; vertical-align: middle; width: 68px; margin-right: 12px;"
                                 class="mobile-logo-center">
                                <img src="https://ffwiki.top/%E5%A4%8D%E9%99%84%E6%A0%A1%E5%BE%BD.png" alt="" width="68" height="68"
                                     style="display: block; border: 0; width: 68px; height: 68px;">
                            </div>

                            <!--[if mso]>
                            </td>
                            <td align="left" valign="middle">
                            <![endif]-->

                            <div style="display: inline-block; vertical-align: middle; text-align: left;"
                                 class="mobile-title-center">
                                <h1 style="margin: 0; font-size: 30px; font-weight: 600; letter-spacing: -0.75px; line-height: 1.2; color: #181819; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                    复旦附中维基百科
                                </h1>
                                <h2 style="margin: 4px 0 0 0; font-size: 20px; font-weight: 600; letter-spacing: -0.5px; line-height: 1.2; color: #717274; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                    FDFZ Wiki
                                </h2>
                            </div>

                            <!--[if mso]>
                            </td>
                            </tr>
                            </table>
                            <![endif]-->
                        </td>
                    </tr>

                    <tr>
                        <td style="background-color: #ffffff; border-radius: 24px; padding: 24px 32px 16px 32px; box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.04), 0px 1px 2px rgba(0, 0, 0, 0.06);"
                            class="mobile-padding">

                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">

                                <tr>
                                    <td style="padding-bottom: 12px;">
                                        <div style="font-size: 18px; font-weight: 500; color: #181819; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                            邮箱验证
                                        </div>
                                    </td>
                                </tr>

                                <tr>
                                    <td style="padding-bottom: 12px;">
                                        <div style="font-size: 16px; line-height: 1.5; color: #181819; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                            你好！你正在注册复旦附中 Wiki 账号！<br>
                                            验证码有效期为 <strong>10</strong> 分钟。请使用下方的验证码完成验证：
                                        </div>
                                    </td>
                                </tr>

                                <tr>
                                    <td style="padding: 10px 0;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0"
                                               width="100%">
                                            <tr>
                                                <td align="center"
                                                    style="background-color: #efeff0; border-radius: 24px; padding: 24px 10px;">
                                                    <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 40px; font-weight: 600; letter-spacing: 8px; line-height: 1; color: #181819; margin: 0;">
                                                        {{VERIFY_CODE}}
                                                    </div>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <tr>
                                    <td style="padding-top: 12px; text-align: center;">
                                        <div style="font-size: 14px; line-height: 1.6; color: #717274; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                            <p style="margin: 0;">如非本人操作，请忽略此邮件。</p>
                                            <p style="margin: 0;">这是一封系统自动发送的邮件，请勿直接回复。</p>
                                            <p style="margin: 12px 0 0 0;">
                                                © 2026 复旦附中 Wiki |
                                                <a href="https://ffwiki.top/"
                                                   style="color: #126cf2; font-weight: 500; text-decoration: none;">访问网站</a>
                                            </p>
                                        </div>
                                    </td>
                                </tr>

                            </table>
                        </td>
                    </tr>

                </table>

            </td>
        </tr>
    </table>

    <!--[if mso | IE]>
    </td>
    </tr>
    </table>
    <![endif]-->
</center>
</body>
</html>
`;

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
