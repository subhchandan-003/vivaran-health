// resolve-share — the ONLY path that resolves a share token to visit data.
// Runs with the service-role key, server-side, so an unauthenticated doctor
// can view a shared record without ever getting a direct table query against
// share_links/visits (which would risk enumerating other patients' data).
// verify_jwt is off for this function — doctors never log in.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FRIENDLY_INACTIVE_MESSAGE =
  "This link is no longer active. It may have expired or been revoked by the patient.";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token || typeof token !== "string") {
      return new Response(
        JSON.stringify({ active: false, message: FRIENDLY_INACTIVE_MESSAGE }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: link, error: linkError } = await supabase
      .from("share_links")
      .select("id, scope, visit_id, user_id, expires_at, revoked, access_log")
      .eq("token", token)
      .maybeSingle();

    if (linkError || !link) {
      return new Response(
        JSON.stringify({ active: false, message: FRIENDLY_INACTIVE_MESSAGE }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const isExpired = new Date(link.expires_at).getTime() < Date.now();
    if (link.revoked || isExpired) {
      return new Response(
        JSON.stringify({ active: false, message: FRIENDLY_INACTIVE_MESSAGE }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let query = supabase
      .from("visits")
      .select(
        "id, visit_date, hospital_name, doctor_name, diagnosis_summary, medicines, notes, raw_file_path, confidence_flags",
      )
      .eq("user_id", link.user_id)
      .order("visit_date", { ascending: false });

    if (link.scope === "single_visit") {
      query = query.eq("id", link.visit_id);
    }

    const { data: visits, error: visitsError } = await query;

    if (visitsError) {
      throw visitsError;
    }

    const visitsWithImages = await Promise.all(
      (visits ?? []).map(async (visit) => {
        let image_url: string | null = null;
        if (visit.raw_file_path) {
          const { data: signed } = await supabase.storage
            .from("documents")
            .createSignedUrl(visit.raw_file_path, 60 * 30);
          image_url = signed?.signedUrl ?? null;
        }
        const { raw_file_path: _omit, ...rest } = visit;
        return { ...rest, image_url };
      }),
    );

    const nextAccessLog = Array.isArray(link.access_log) ? link.access_log : [];
    nextAccessLog.push({ accessed_at: new Date().toISOString() });
    await supabase
      .from("share_links")
      .update({ access_log: nextAccessLog })
      .eq("id", link.id);

    return new Response(
      JSON.stringify({
        active: true,
        scope: link.scope,
        visits: visitsWithImages,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("resolve-share error:", error);
    return new Response(
      JSON.stringify({ active: false, message: FRIENDLY_INACTIVE_MESSAGE }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
