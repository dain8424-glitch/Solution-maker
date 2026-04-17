import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import type { SolutionRequest, SolutionDraft } from "@/types/solution";

const SYSTEM_PROMPT = `당신은 건설/산업 자재 플랫폼의 솔루션 기획 전문가입니다.
입력된 상황, 자재 정보, 카탈로그 등을 바탕으로 구매 가능한 형태의 솔루션 초안을 생성합니다.

솔루션은 다음 3축 기준으로 분류하고 구조화해야 합니다:
- 주제(Subject): 어떤 문제/니즈를 해결하는가 (예: 누수방지, 방음, 단열, 안전관리 등)
- 공정(Process): 어느 공정/단계에 적용되는가 (예: 기초공사, 마감공사, 설비공사, 유지보수 등)
- 태깅 기준(Tags): 검색/분류를 위한 키워드들

출력은 반드시 아래 JSON 형식을 정확히 따라야 합니다:
{
  "name": "솔루션명 (상황과 해결 목적이 명확히 드러나야 함)",
  "subject": "주제 분류",
  "process": "공정 분류",
  "tags": ["태그1", "태그2", "태그3", ...],
  "specs": "전체 솔루션 규격 및 적용 범위 설명",
  "mainMaterials": [
    { "name": "자재명", "spec": "규격/사양", "purpose": "이 자재의 역할" }
  ],
  "subMaterials": [
    { "name": "자재명", "spec": "규격/사양", "purpose": "이 자재의 역할" }
  ],
  "detailPage": [
    {
      "title": "섹션 제목",
      "content": "상세 텍스트 내용",
      "imageNeeded": {
        "section": "섹션명",
        "description": "필요한 이미지 콘티 설명",
        "purpose": "이미지가 전달해야 할 메시지"
      }
    }
  ],
  "notes": "판매사에 전달할 보완 요청 사항 (선택)"
}

detailPage는 실제 상품 상세페이지 수준으로 작성하세요:
1. 솔루션 소개 및 필요성
2. 적용 전/후 비교 또는 문제 상황
3. 구성 자재 상세 설명
4. 시공 방법 또는 적용 순서
5. 기대 효과 및 사양

이미지가 필요한 섹션에만 imageNeeded를 포함하세요. JSON만 출력하고 다른 텍스트는 포함하지 마세요.`;

function buildUserPrompt(req: SolutionRequest): string {
  const productList = req.products
    .map(
      (p) =>
        `- [${p.role === "main" ? "메인" : "부"}자재] ${p.name}${p.spec ? ` (${p.spec})` : ""}`
    )
    .join("\n");

  return `## 상황 및 해결 목적
${req.situation}

## 등록된 자재 목록
${productList}

${
  req.catalogInfo
    ? `## 카탈로그 / 추가 자료
${req.catalogInfo}

`
    : ""
}${
  req.additionalContext
    ? `## 기타 참고 사항
${req.additionalContext}
`
    : ""
}위 정보를 바탕으로 솔루션 초안을 JSON 형식으로 생성해주세요.`;
}

export async function POST(request: NextRequest) {
  try {
    const body: SolutionRequest = await request.json();

    if (!body.situation?.trim()) {
      return NextResponse.json(
        { error: "상황 설명을 입력해주세요." },
        { status: 400 }
      );
    }
    if (!body.products?.length) {
      return NextResponse.json(
        { error: "최소 1개 이상의 자재를 추가해주세요." },
        { status: 400 }
      );
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildUserPrompt(body),
        },
      ],
    });

    const textContent = message.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("응답 생성에 실패했습니다.");
    }

    const rawText = textContent.text.trim();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("JSON 형식의 응답을 받지 못했습니다.");
    }

    const solution: SolutionDraft = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ solution });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
