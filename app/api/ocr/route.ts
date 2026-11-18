import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const OCR_SYSTEM_PROMPT = `You are an election result sheet OCR expert. Extract all party names and their vote counts from this Nigerian INEC result sheet. Return JSON: { "party_results": [{"party": string, "votes": number}], "accredited_voters": number, "polling_unit": string, "lga": string, "state": string, "ward": string }

Rules:
- party field should use the party abbreviation (e.g. "APC", "PDP", "LP")
- votes must be a number (integer)
- accredited_voters is the total number of accredited voters for this polling unit
- If a field is not visible, use null
- Include ALL parties listed on the sheet even if their votes are 0
- Do not infer or fabricate data — only extract what is visible`;

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Request must be multipart/form-data" },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile) {
      return NextResponse.json(
        { error: "No image file provided. Include an 'image' field in the form data." },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(imageFile.type)) {
      return NextResponse.json(
        {
          error: `Unsupported image type: ${imageFile.type}. Use JPEG, PNG, GIF, or WebP.`,
        },
        { status: 400 }
      );
    }

    // Validate file size (max 20MB)
    const MAX_SIZE = 20 * 1024 * 1024;
    if (imageFile.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Image too large. Maximum size is 20MB." },
        { status: 400 }
      );
    }

    // Convert to base64
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mediaType = imageFile.type as
      | "image/jpeg"
      | "image/png"
      | "image/gif"
      | "image/webp";

    // Call Claude vision
    const message = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 1024,
      system: OCR_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: "text",
              text: "Extract all election result data from this INEC result sheet. Return only valid JSON.",
            },
          ],
        },
      ],
    });

    // Parse response
    const rawText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Extract JSON from response (Claude may wrap in markdown code blocks)
    const jsonMatch =
      rawText.match(/```(?:json)?\s*([\s\S]*?)```/) ??
      rawText.match(/(\{[\s\S]*\})/);

    if (!jsonMatch) {
      return NextResponse.json(
        {
          error: "Could not extract JSON from Claude response",
          raw_response: rawText,
        },
        { status: 422 }
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatch[1]);
    } catch {
      return NextResponse.json(
        {
          error: "Failed to parse extracted JSON",
          raw_response: rawText,
        },
        { status: 422 }
      );
    }

    // Validate: total votes must not exceed accredited voters (INEC rule)
    const result = parsed as {
      party_results?: { party: string; votes: number }[];
      accredited_voters?: number;
    };
    if (result.party_results && typeof result.accredited_voters === "number") {
      const totalVotes = result.party_results.reduce((sum, r) => sum + (r.votes ?? 0), 0);
      if (totalVotes > result.accredited_voters) {
        return NextResponse.json(
          {
            success: false,
            error: "OVER_VOTED",
            message: `Total votes cast (${totalVotes}) exceeds accredited voters (${result.accredited_voters}). This result sheet is flagged and cannot be accepted.`,
            data: parsed,
          },
          { status: 422 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: parsed,
      model: message.model,
      usage: message.usage,
    });
  } catch (error: unknown) {
    console.error("[OCR API] Error:", error);

    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        {
          error: "Claude API error",
          message: error.message,
          status: error.status,
        },
        { status: error.status ?? 500 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: "Internal server error", message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/ocr",
    method: "POST",
    description: "OCR extraction from INEC election result sheet images",
    accepts: "multipart/form-data with 'image' field (JPEG, PNG, GIF, WebP, max 20MB)",
    returns: {
      success: true,
      data: {
        party_results: [{ party: "APC", votes: 1234 }],
        accredited_voters: 5000,
        polling_unit: "Example Ward 001",
        lga: "Example LGA",
        state: "Lagos",
        ward: "Ward 1",
      },
    },
  });
}
