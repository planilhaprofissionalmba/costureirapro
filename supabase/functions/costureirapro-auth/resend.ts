/** E-mail transacional do CostureiraPro — só Resend API HTTP (Prompt V3.43 regra 56). Sem SMTP. */
export async function sendRegistrationEmail(email: string, link: string) {
  const apiKey = Deno.env.get("COSTUREIRAPRO_RESEND_API_KEY")?.trim();
  const fromEmail = Deno.env.get("COSTUREIRAPRO_RESEND_FROM_EMAIL")?.trim();
  const fromName = Deno.env.get("COSTUREIRAPRO_RESEND_FROM_NAME")?.trim() || "CostureiraPro";
  const apiBase = Deno.env.get("COSTUREIRAPRO_RESEND_API_BASE")?.trim() || "https://api.resend.com";

  if (!apiKey || !fromEmail) throw new Error("Configuração Resend API do CostureiraPro incompleta.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
    throw new Error("Endereço de e-mail inválido.");
  }

  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#FFFCF2;font-family:Tahoma,Geneva,Verdana,sans-serif;color:#184A4E">
<div style="max-width:520px;margin:0 auto;padding:24px">
<div style="background:#184A4E;color:#CAB77D;padding:16px 20px;border-radius:10px 10px 0 0;font-weight:700;font-size:18px">CostureiraPro</div>
<div style="background:#FFFCF2;border:1px solid #CAB77D;border-top:0;border-radius:0 0 10px 10px;padding:20px">
<p style="margin:0 0 12px">Olá! Para confirmar seu e-mail e criar a sua senha do <strong>CostureiraPro</strong>, toque no botão abaixo:</p>
<p style="margin:20px 0;text-align:center"><a href="${link}" style="background:#184A4E;color:#ECE4BB;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;display:inline-block">Confirmar e criar minha senha</a></p>
<p style="margin:0 0 8px;font-size:13px">O link vale por 30 minutos e só funciona uma vez.</p>
<p style="margin:0;font-size:13px">Se você não pediu este acesso, ignore esta mensagem.</p>
</div>
<p style="font-size:11px;margin-top:14px;text-align:center">Desenvolvido por planilhaprofissional.com · suporte@planilhaprofissional.com · WhatsApp +55 66 99238-8026</p>
</div></body></html>`;

  const response = await fetch(`${apiBase.replace(/\/+$/, "")}/emails`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [email],
      subject: "Confirme seu e-mail - CostureiraPro",
      html,
      text: `Para confirmar seu e-mail e criar a senha do CostureiraPro, abra este link:\n\n${link}\n\nO link vale por 30 minutos. Se você não pediu este acesso, ignore esta mensagem.`,
    }),
  });

  if (!response.ok) {
    const details = (await response.text()).slice(0, 500);
    throw new Error(`Resend API respondeu ${response.status}: ${details}`);
  }
}
