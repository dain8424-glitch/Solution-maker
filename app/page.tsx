"use client";

import { useState } from "react";

interface Material {
  name: string;
  spec: string;
  role: string;
}

interface DetailSection {
  title: string;
  body: string;
  imageConti: string | null;
}

interface Solution {
  solutionName: string;
  specs: string;
  topic: string;
  process: string;
  tags: string[];
  mainMaterials: Material[];
  subMaterials: Material[];
  detailPage: {
    headline: string;
    sections: DetailSection[];
  };
}

export default function Home() {
  const [situation, setSituation] = useState("");
  const [products, setProducts] = useState("");
  const [solution, setSolution] = useState<Solution | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    if (!situation.trim()) return;
    setLoading(true);
    setError("");
    setSolution(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situation, products }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSolution(data.solution);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">솔루션 생성기</h1>
      <p className="text-sm text-gray-500 mb-8">상황을 입력하면 AI가 자재 솔루션 초안을 생성합니다</p>

      {/* 입력 영역 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            상황 / 니즈 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="예: 지하 주차장 바닥에 물이 자꾸 새서 방수 처리가 필요합니다. 기존 콘크리트 위에 시공해야 합니다."
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            등록된 상품 목록 <span className="text-gray-400 font-normal">(선택)</span>
          </label>
          <textarea
            value={products}
            onChange={(e) => setProducts(e.target.value)}
            placeholder="예:&#10;- 우레탄 방수재 A타입 (18kg)&#10;- 프라이머 B (4L)&#10;- 보호몰탈 C"
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        <button
          onClick={generate}
          disabled={loading || !situation.trim()}
          className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "생성 중..." : "솔루션 초안 생성"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-6">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-gray-500 text-sm">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent mb-3" />
          <p>AI가 솔루션 초안을 작성하고 있습니다...</p>
        </div>
      )}

      {solution && <SolutionResult solution={solution} />}
    </main>
  );
}

function SolutionResult({ solution }: { solution: Solution }) {
  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h2 className="text-xl font-bold text-gray-900">{solution.solutionName}</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">{solution.specs}</p>
        <div className="flex flex-wrap gap-2">
          <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">
            {solution.topic}
          </span>
          <span className="bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full">
            {solution.process}
          </span>
          {solution.tags.map((tag) => (
            <span key={tag} className="bg-gray-50 text-gray-500 text-xs px-2.5 py-1 rounded-full border border-gray-200">
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* 구성 자재 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-800 mb-4">구성 자재</h3>
        <div className="space-y-4">
          <MaterialTable title="메인 자재" materials={solution.mainMaterials} accent="blue" />
          {solution.subMaterials.length > 0 && (
            <MaterialTable title="부자재" materials={solution.subMaterials} accent="gray" />
          )}
        </div>
      </div>

      {/* 상세페이지 초안 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-800 mb-2">상세페이지 초안</h3>
        <p className="text-lg font-medium text-gray-900 mb-4 border-l-4 border-blue-500 pl-3">
          {solution.detailPage.headline}
        </p>
        <div className="space-y-4">
          {solution.detailPage.sections.map((sec, i) => (
            <div key={i} className="border border-gray-100 rounded-lg p-4">
              <h4 className="font-medium text-gray-800 mb-1">{sec.title}</h4>
              <p className="text-sm text-gray-600 whitespace-pre-line mb-2">{sec.body}</p>
              {sec.imageConti && (
                <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs text-amber-700">
                  <span className="font-medium">[이미지 콘티]</span> {sec.imageConti}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MaterialTable({ title, materials, accent }: { title: string; materials: Material[]; accent: "blue" | "gray" }) {
  const badge = accent === "blue"
    ? "bg-blue-50 text-blue-700 border border-blue-200"
    : "bg-gray-50 text-gray-600 border border-gray-200";

  return (
    <div>
      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded mb-2 ${badge}`}>{title}</span>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left">
              <th className="pb-2 font-medium text-gray-500 w-1/4">자재명</th>
              <th className="pb-2 font-medium text-gray-500 w-1/4">규격</th>
              <th className="pb-2 font-medium text-gray-500">역할</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((m, i) => (
              <tr key={i} className="border-b border-gray-50">
                <td className="py-2 font-medium text-gray-800">{m.name}</td>
                <td className="py-2 text-gray-500">{m.spec}</td>
                <td className="py-2 text-gray-600">{m.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
