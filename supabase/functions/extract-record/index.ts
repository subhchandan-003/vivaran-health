// extract-record — receives a base64 document image, calls Claude (vision) to
// pull structured fields out of it, and returns them for the patient to review
// and edit before anything is saved. Never called with a service-role key —
// verify_jwt stays on so only a logged-in patient can invoke this.
import Anthropic from "npm:@anthropic-ai/sdk@0.69.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EXTRACTION_PROMPT = `You are extracting structured data from a photo of a medical document (prescription, discharge summary, or lab report) for a patient-owned health record app.

Read the image carefully and respond with ONLY a single JSON object — no markdown fences, no commentary before or after — matching exactly this shape:

{
  "visit_date": "YYYY-MM-DD or null if not legible",
  "hospital_name": "string or null",
  "doctor_name": "string or null",
  "diagnosis_summary": "one or two sentence plain-language summary, or null",
  "medicines": [{ "name": "string", "dosage": "string" }],
  "notes": "any other relevant free text (instructions, follow-up dates), or null",
  "record_type": "one of consultation, lab_report, prescription, vaccination, imaging, other — your best guess at the document type, or null if unclear",
  "confidence_flags": ["field names you are unsure about, e.g. \\"doctor_name\\", \\"medicines\\""]
}

Rules:
- If a field is illegible or absent, use null (or an empty array for medicines) rather than guessing.
- Add a field's name to confidence_flags whenever you are genuinely uncertain about it — handwriting, smudging, and cropped text are common reasons.
- medicines dosage should include strength and frequency as written (e.g. "500mg, twice daily") — do not invent a dosage that isn't legible.
- Output raw JSON only.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { image_base64, media_type } = await req.json();

    if (!image_base64 || typeof image_base64 !== "string") {
      return new Response(
        JSON.stringify({ error: "image_base64 is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const allowedMediaTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const resolvedMediaType = allowedMediaTypes.includes(media_type)
      ? media_type
      : "image/jpeg";

    const client = new Anthropic({
      apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
    });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      output_config: { effort: "low" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: resolvedMediaType,
                data: image_base64,
              },
            },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Model returned no text content");
    }

    const raw = textBlock.text.trim();
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error("Model response did not contain a JSON object");
    }

    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));

    const allowedRecordTypes = [
      "consultation",
      "lab_report",
      "prescription",
      "vaccination",
      "imaging",
      "other",
    ];

    const result = {
      visit_date: parsed.visit_date ?? null,
      hospital_name: parsed.hospital_name ?? null,
      doctor_name: parsed.doctor_name ?? null,
      diagnosis_summary: parsed.diagnosis_summary ?? null,
      medicines: Array.isArray(parsed.medicines) ? parsed.medicines : [],
      notes: parsed.notes ?? null,
      record_type: allowedRecordTypes.includes(parsed.record_type) ? parsed.record_type : null,
      confidence_flags: Array.isArray(parsed.confidence_flags)
        ? parsed.confidence_flags
        : [],
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("extract-record error:", error);
    return new Response(
      JSON.stringify({
        error: "Could not extract record from this image. You can still enter the details manually.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
