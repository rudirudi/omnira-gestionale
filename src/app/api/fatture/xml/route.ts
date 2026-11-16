import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getPurchaseXml } from "@/modules/fatture/queries";

const UUID = /^[0-9a-f-]{36}$/i;

/** Scarica l'XML di una fattura emessa o ricevuta */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!can.viewMoney(user.role)) return new Response("Non autorizzato", { status: 403 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  if (!UUID.test(id)) return new Response("Richiesta non valida", { status: 400 });
  let xml: string | null = null;
  let name = "fattura.xml";
  if (url.searchParams.get("tipo") === "ricevuta") {
    const p = await getPurchaseXml(id);
    if (p) {
      xml = p.xml;
      name = p.fileName.replace(/\.p7m$/i, "");
    }
  } else {
    const supabase = await createClient();
    const { data } = await supabase.from("invoices").select("xml, file_name").eq("id", id).maybeSingle();
    if (data?.xml) {
      xml = data.xml;
      name = data.file_name ?? name;
    }
  }
  if (!xml) return new Response("Non trovato", { status: 404 });
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name.replace(/[^\w.-]/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
