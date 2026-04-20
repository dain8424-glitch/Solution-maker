import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import type { SolutionRequest, SolutionDraft } from "@/types/solution";

export const runtime = "nodejs";
export const maxDuration = 300;

const SYSTEM_PROMPT = `당신은 건설/산업 자재 플랫폼의 솔루션 기획 전문가입니다.
입력된 상황, 자재 정보, 카탈로그 등을 바탕으로 구매 가능한 형태의 솔루션 초안을 생성합니다.

=== 미리 정해진 주제 분류 체계 ===

[main: 개인보호구]
  기준 "사용자": 관리자용, 신호수용
  기준 "공정별": 토공사 근로자용, 철골현장 근로자용, 굴조현장 근로자용
  기준 "위험요인별": 추락방지, 베임·찔림방지, 절단방지, 감전·전기 위험
  기준 "신체 부위별": 머리 보호, 얼굴·눈 보호, 호흡기 보호, 귀 보호, 손·팔 보호, 발·하체 보호, 몸통 보호

[main: 골조]
  기준 "공정별": 버팀·기초, 지하 형틀, 지상 형틀, 철근, 콘크리트 타설, 전출·미장·황석
  기준 "부위별": 기둥 자재, 벽 자재, 보 자재, 슬라브 자재, 계단 자재
  기준 "공법별": 재래식 공법, OSC 공법

[main: 추락방지 시스템]
  기준 "사고 단계별": 사전 방지(→방식: 추락제한/안전난간), 사후 보호, 구조
  기준 "방향": 수평구명줄(→로프재질: 와이어/섬유로프), 수직구명줄(→시형태: 와이어/섬유로프), 수직 레일형(→: 시스템/앵커식)
  기준 "설치 형태": 이동식, 고정식
  기준 "설치 부위": 철골, 비계, 골조 슬라브 단부, 골조 보 거푸집 설치, 지붕, 동바리 작업발판, 공장, 맨홀, 타워크레인

[main: step]
  기준 "목적": 작업, 이동, 오르내림
  기준 "환경": 고소, 협소
  기준 "설치 형태": 고정식, 임시
  기준 "설치 장소": 건설현장(→부위별: 기둥/벽/보/슬라브/계단실)

[main: 패킹]
  기준 "적재물 형태": 판재·보드류, 파이프류·관재, 블록·박스·마대형, 이형재·비정형
  기준 "적재물 종류": 특수, 식품, 중량물
  기준 "반복성": 일회용, 다회용
  기준 "사용장소": 수출용, 공장용, 건설현장용
  기준 "물류 단계": 포장, 운반, 상하차, 소분
  기준 "파렛트 형태": 방침목형, 판, ㄷ자형, 함 형

[main: 표지] (sub 없음)
[main: 조도확보] (sub 없음)

[main: 쿨링]
  기준 "대응 대상": 안전(→대응방식: 개인용품/안전시설), 품질(→상황·날씨: 우천/장마, →공정: 골조 콘크리트)

[main: 동철기]
  기준 "대응 대상": 안전(→대응방식: 개인용품/안전시설), 품질(→상황·날씨: 폭설/눈, →공정: 골조 콘크리트)

=== 주제 태깅 규칙 ===
1. main 주제는 여러 개 태깅 가능
2. 각 main 내 기준별로 sub 태깅 가능 (같은 기준 내에서는 하나만, 여러 기준 선택 가능)
3. 위 목록에 있는 main이면 isNew: false, 새로 만든 main이면 isNew: true
4. isNew: true인 경우 subs도 자유롭게 정의

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
      name: { type: "string", description: "솔루션명" },
      subjects: {
        type: "array",
        description: "태깅된 주제 목록",
        items: {
          type: "object",
          properties: {
            main: { type: "string", description: "main 주제명" },
            subs: { type: "array", items: { type: "string" }, description: "선택된 sub 주제들" },
            isNew: { type: "boolean", description: "미리 정의된 목록에 없는 새 주제면 true" },
          },
          required: ["main", "subs", "isNew"],
        },
      },
      process: { type: "string", description: "공정 분류" },
      tags: { type: "array", items: { type: "string" }, description: "검색용 태그" },
      specs: { type: "string", description: "규격 및 적용 범위" },
      mainMaterials: {
        type: "array",
        items: {
          type: "object",
          properties: { name: { type: "string" }, spec: { type: "string" }, purpose: { type: "string" } },
          required: ["name", "spec", "purpose"],
        },
      },
      subMaterials: {
        type: "array",
        items: {
          type: "object",
          properties: { name: { type: "string" }, spec: { type: "string" }, purpose: { type: "string" } },
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
    required: ["name", "subjects", "process", "tags", "specs", "mainMaterials", "subMaterials", "detailPage"],
  },
};

function buildUserPrompt(req: SolutionRequest): string {
  const productList = req.products
    .map((p) => `- [${p.role === "main" ? "메인" : "부"}자재] ${p.name}${p.spec ? ` (${p.spec})` : ""}`)
    .join("\n");

  return `## 상황 및 해결 목적\n${req.situation}\n\n## 등록된 자재 목록\n${productList}\n\n${req.catalogInfo ? `## 카탈로그 텍스트\n${req.catalogInfo}\n\n` : ""}${req.additionalContext ? `## 기타 참고 사항\n${req.additionalContext}\n` : ""}generate_solution 툴을 사용해서 솔루션 초안을 생성해주세요.`;
}

function buildContentBlocks(req: SolutionRequest): unknown[] {
  const blocks: unknown[] = [{ type: "text", text: buildUserPrompt(req) }];

  for (const file of req.catalogFiles ?? []) {
    if (file.mediaType === "application/pdf") {
      if (file.data) {
        blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: file.data } });
      } else if (file.extractedText) {
        blocks.push({ type: "text", text: `[카탈로그 PDF: ${file.name}]\n${file.extractedText}` });
      }
    } else if (file.data) {
      blocks.push({ type: "image", source: { type: "base64", media_type: file.mediaType, data: file.data } });
    }
  }

  return blocks;
}

const FIELD_STATUS: Array<[string, string]> = [
  ["subjects", "주제 분류 중..."],
  ["process", "공정 분류 중..."],
  ["tags", "검색 태그 작성 중..."],
  ["specs", "규격 및 적용 범위 작성 중..."],
  ["mainMaterials", "메인 자재 구성 중..."],
  ["subMaterials", "부자재 구성 중..."],
  ["detailPage", "상세 페이지 작성 중..."],
  ["notes", "보완 사항 정리 중..."],
];

export async function POST(request: NextRequest) {
  const body: SolutionRequest = await request.json();

  if (!body.situation?.trim()) {
    return new Response(JSON.stringify({ error: "상황 설명을 입력해주세요." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!body.products?.length) {
    return new Response(JSON.stringify({ error: "최소 1개 이상의 자재를 추가해주세요." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const hasBinaryPdf = body.catalogFiles?.some((f) => f.mediaType === "application/pdf" && f.data) ?? false;
  const content = buildContentBlocks(body);

  const params = {
    model: "claude-sonnet-4-6",
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    tools: [SOLUTION_TOOL],
    tool_choice: { type: "tool" as const, name: "generate_solution" },
    messages: [{ role: "user" as const, content }],
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      const heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(`: ping\n\n`)); } catch {}
      }, 10000);

      try {
        send({ type: "status", message: "상황 및 자재 분석 중..." });

        const apiStream = hasBinaryPdf
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? (client.beta.messages.stream as any)({ ...params, betas: ["pdfs-2024-09-25"] })
          : client.messages.stream(params as Parameters<typeof client.messages.stream>[0]);

        let accumulated = "";
        const sent = new Set<string>();

        for await (const event of apiStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta?.type === "input_json_delta"
          ) {
            accumulated += event.delta.partial_json ?? "";
            for (const [field, msg] of FIELD_STATUS) {
              if (!sent.has(field) && accumulated.includes(`"${field}"`)) {
                sent.add(field);
                send({ type: "status", message: msg });
              }
            }
          }
        }

        const finalMessage = await apiStream.finalMessage();
        const toolUse = finalMessage.content.find(
          (c: Anthropic.ContentBlock) => c.type === "tool_use"
        );
        if (!toolUse || toolUse.type !== "tool_use") {
          throw new Error("응답 생성에 실패했습니다.");
        }

        send({ type: "done", solution: toolUse.input as SolutionDraft });
      } catch (err) {
        const message = err instanceof Error ? err.message : "알 수 없는 오류";
        send({ type: "error", message });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
