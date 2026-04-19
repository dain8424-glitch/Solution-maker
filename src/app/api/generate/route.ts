import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import type { SolutionRequest, SolutionDraft, CatalogFile } from "@/types/solution";

const SYSTEM_PROMPT = `당신은 건설/산업 자재 플랫폼의 솔루션 기획 전문가입니다.
입력된 상황, 자재 정보, 카탈로그 등을 바탕으로 구매 가능한 형태의 솔루션 초안을 생성합니다.

솔루션은 다음 3축 기준으로 분류하고 구조화해야 합니다:
- 주제(Subject): 어떤 문제/니즈를 해결하는가
- 공정(Process): 어느 공정/단계에 적용되는가
- 태깅 기준(Tags): 검색/분류를 위한 키워드들

detailPage는 실제 상품 상세페이지 수준으로 작성하세요:
1. 솔루션 소개 및 필요성
2. 적용 전/후 비교 또는 문제 상황
3. 구성 자재 상세 설명
4. 시공 방법 또는 적용 순서
5. 기대 효과 및 사양

이미지가 필요한 섹션에만 imageNeeded를 포함하세요.`;

const SOLUTION_TOOL: Anthropic.Tool = {
  name: "generate_solution",
  description: "솔루션 초안을 생성합니다",
  input_schema: {
    type: "object" as const,
    properties: {
      name: { type: "string" },
      subject: { type: "string" },
      process: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      specs: { type: "string" },
      mainMaterials: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            spec: { type: "string" },
            purpose: { type: "string" },
          },
          required: ["name", "spec", "purpose"],
        },
      },
      subMaterials: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            spec: { type: "string" },
            purpose: { type: "string" },
          },
          required: ["name", "spec", "purpose"],
        },
      },
      detailPage: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            content: { type: "string" },
            imageNeeded: {
              type: "object",
              properties: {
                section: { type: "string" },
                description: { type: "string" },
                purpose: { type: "string" },
              },
              required: ["section", "description", "purpose"],
            },
          },
          required: ["title", "content"],
        },
      },
      notes: { type: "string" },
    },
    required: ["name", "subject", "process", "tags", "specs", "mainMaterials", "subMaterials", "detailPage"],
  },
};

function buildUserPrompt(req: SolutionRequest): string {
  const productList = req.products
    .map((p) => `- [${p.role === "main" ? "메인" : "부"}자재] ${p.name}${p.spec ? ` (${p.spec})` : ""}`)
    .join("\n");

  return `## 상황 및 해결 목적
${req.situation}

## 등록된 자재 목록
${productList}

${
  req.catalogInfo ? `## 카탈로그 텍스트
${req.catalogInfo}

` : ""
}${
  req.additionalContext ? `## 기타 참고 사항
${req.additionalContext}
` : ""
}generate_solution 툴을 사용해서 솔루션 초안을 생성해주세요.`;
}

function buildContentBlocks(req: SolutionRequest): Anthropic.MessageParam["content"] {
  const blocks: Anthropic.MessageParam["content"] = [
    { type: "text", text: buildUserPrompt(req) },
  ];

  for (const file of req.catalogFiles ?? []) {
    if (file.mediaType === "application/pdf") {
      blocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: file.data },
      } as never);
    } else {
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: file.mediaType, data: file.data },
      });
    }
  }

  return blocks;
}

export async function POST(request: NextRequest) {
  try {
    const body: SolutionRequest = await request.json();

    if (!body.situation?.trim()) {
      return NextResponse.json({ error: "상황 설명을 입력해주세요." }, { status: 400 });
    }
    if (!body.products?.length) {
      return NextResponse.json({ error: "최소 1개 이상의 자재를 추가해주세요." }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const hasPdf = body.catalogFiles?.some((f) => f.mediaType === "application/pdf");

    const message = await (hasPdf ? client.beta.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8096,
      betas: ["pdfs-2024-09-25"],
      system: SYSTEM_PROMPT,
      tools: [SOLUTION_TOOL],
      tool_choice: { type: "any" },
      messages: [{ role: "user", content: buildContentBlocks(body) }],
    } as never) : client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8096,
      system: SYSTEM_PROMPT,
      tools: [SOLUTION_TOOL],
      tool_choice: { type: "any" },
      messages: [{ role: "user", content: buildContentBlocks(body) }],
    }));

    const toolUse = (message as Anthropic.Message).content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("응답 생성에 실패했습니다.");
    }

    const solution = toolUse.input as SolutionDraft;
    return NextResponse.json({ solution });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
