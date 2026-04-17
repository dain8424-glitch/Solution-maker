import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `당신은 건설/인테리어 자재 플랫폼의 솔루션 기획 전문가입니다.
솔루션은 "문제 해결 단위"로, 단순 상품 나열이 아닌 특정 상황을 완전히 해결하는 자재 조합입니다.

솔루션 초안을 아래 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이 순수 JSON):

{
  "solutionName": "솔루션명 (상황과 해결 목적이 드러나게)",
  "specs": "규격 및 적용 범위 설명",
  "topic": "주제 (예: 방수, 단열, 바닥마감 등)",
  "process": "공정 단계 (예: 기초공사, 마감공사 등)",
  "tags": ["태그1", "태그2", "태그3"],
  "mainMaterials": [
    { "name": "자재명", "spec": "규격/사양", "role": "역할 설명" }
  ],
  "subMaterials": [
    { "name": "자재명", "spec": "규격/사양", "role": "역할 설명" }
  ],
  "detailPage": {
    "headline": "상세페이지 헤드라인",
    "sections": [
      {
        "title": "섹션 제목",
        "body": "섹션 내용",
        "imageConti": "필요한 이미지 설명 (없으면 null)"
      }
    ]
  }
}`;

export async function POST(req: NextRequest) {
  try {
    const { situation, products } = await req.json();

    if (!situation?.trim()) {
      return NextResponse.json({ error: "상황 설명을 입력해주세요." }, { status: 400 });
    }

    const userMessage = `
상황/니즈: ${situation}
${products?.trim() ? `\n등록된 상품 목록:\n${products}` : ""}

위 정보를 바탕으로 솔루션 초안을 생성해주세요.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    const solution = JSON.parse(content.text);
    return NextResponse.json({ solution });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: "AI 응답 파싱 실패. 다시 시도해주세요." }, { status: 500 });
    }
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
