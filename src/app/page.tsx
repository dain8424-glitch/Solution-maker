"use client";

import { useState, useCallback, useRef } from "react";
import type { Product, SolutionDraft, SolutionRequest, CatalogFile } from "@/types/solution";

let idCounter = 0;
const uid = () => `p${++idCounter}`;

const ACCEPTED_TYPES: Record<string, CatalogFile["mediaType"]> = {
  "application/pdf": "application/pdf",
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
  "image/gif": "image/gif",
  "image/webp": "image/webp",
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function SolutionOutput({ solution }: { solution: SolutionDraft }) {
  const copyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(solution, null, 2));
  };

  return (
    <div className="solution-output">
      <div className="solution-header">
        <div className="solution-name">{solution.name}</div>
        <div className="solution-axes">
          <span className="axis-item axis-subject">주제: {solution.subject}</span>
          <span className="axis-item axis-process">공정: {solution.process}</span>
        </div>
        <div className="tags">
          {solution.tags.map((tag) => (
            <span key={tag} className="tag">#{tag}</span>
          ))}
        </div>
      </div>

      <div>
        <div className="section-title">규격 및 적용 범위</div>
        <div className="specs-box">{solution.specs}</div>
      </div>

      <div>
        <div className="section-title">구성 자재</div>
        <div className="materials-grid">
          {solution.mainMaterials.map((m, i) => (
            <div key={i} className="material-item">
              <span className="material-badge main">메인</span>
              <div className="material-info">
                <div className="material-name">{m.name}</div>
                {m.spec && <div className="material-spec">{m.spec}</div>}
              </div>
              <div className="material-purpose">{m.purpose}</div>
            </div>
          ))}
          {solution.subMaterials.map((m, i) => (
            <div key={i} className="material-item">
              <span className="material-badge sub">부자재</span>
              <div className="material-info">
                <div className="material-name">{m.name}</div>
                {m.spec && <div className="material-spec">{m.spec}</div>}
              </div>
              <div className="material-purpose">{m.purpose}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="section-title">상세 페이지 구조</div>
        <div className="detail-sections">
          {solution.detailPage.map((sec, i) => (
            <div key={i} className="detail-section">
              <div className="detail-section-header">{i + 1}. {sec.title}</div>
              <div className="detail-section-content">{sec.content}</div>
              {sec.imageNeeded && (
                <div className="storyboard-box">
                  <div className="storyboard-label">이미지 콘티</div>
                  <div className="storyboard-desc">
                    <strong>{sec.imageNeeded.section}</strong>{" — "}{sec.imageNeeded.description}
                    <br /><em>목적: {sec.imageNeeded.purpose}</em>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {solution.notes && (
        <div>
          <div className="section-title">판매사 보완 요청</div>
          <div className="notes-box">{solution.notes}</div>
        </div>
      )}

      <div className="output-actions">
        <button type="button" className="btn btn-secondary" onClick={copyJSON}>JSON 복사</button>
      </div>
    </div>
  );
}

export default function Page() {
  const [situation, setSituation] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [newName, setNewName] = useState("");
  const [newSpec, setNewSpec] = useState("");
  const [newRole, setNewRole] = useState<"main" | "sub">("main");
  const [catalogInfo, setCatalogInfo] = useState("");
  const [catalogFiles, setCatalogFiles] = useState<CatalogFile[]>([]);
  const [additionalContext, setAdditionalContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [solution, setSolution] = useState<SolutionDraft | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addProduct = useCallback(() => {
    if (!newName.trim()) return;
    setProducts((prev) => [...prev, { id: uid(), name: newName.trim(), spec: newSpec.trim() || undefined, role: newRole }]);
    setNewName("");
    setNewSpec("");
  }, [newName, newSpec, newRole]);

  const removeProduct = useCallback((id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const results: CatalogFile[] = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`${file.name}: 파일 크기가 5MB를 초과합니다.`);
        continue;
      }
      const mediaType = ACCEPTED_TYPES[file.type];
      if (!mediaType) continue;

      const data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(",")[1];
          resolve(base64);
        };
        reader.readAsDataURL(file);
      });

      results.push({ name: file.name, data, mediaType });
    }

    setCatalogFiles((prev) => [...prev, ...results]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const removeFile = useCallback((index: number) => {
    setCatalogFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleGenerate = async () => {
    setError(null);
    setLoading(true);
    setSolution(null);

    const body: SolutionRequest = { situation, products, catalogInfo, catalogFiles, additionalContext };

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "오류가 발생했습니다.");
      setSolution(data.solution);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  };

  const canGenerate = situation.trim().length > 0 && products.length > 0 && !loading;

  return (
    <div className="container">
      <div className="header">
        <h1>솔루션 생성기</h1>
        <p>상황과 자재 정보를 입력하면 구매 가능한 솔루션 초안을 자동 생성합니다.</p>
      </div>

      <div className="layout">
        <div className="card">
          <div className="card-title">입력 정보</div>

          <div className="form-group">
            <label>상황 및 해결 목적 *</label>
            <textarea
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              placeholder="예: 지하 주차장 천장에서 누수가 발생하여 빠른 보수가 필요합니다."
              rows={4}
            />
          </div>

          <div className="form-group">
            <label>자재 목록 *</label>
            {products.length > 0 && (
              <div className="product-list">
                {products.map((p) => (
                  <div key={p.id} className="product-item">
                    <span className={`product-role-badge ${p.role}`}>{p.role === "main" ? "메인" : "부자재"}</span>
                    <span className="product-name">{p.name}</span>
                    {p.spec && <span className="product-spec">{p.spec}</span>}
                    <button type="button" className="product-remove" onClick={() => removeProduct(p.id)} title="삭제">×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="add-product-form">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addProduct(); } }}
                placeholder="자재명"
              />
              <input
                value={newSpec}
                onChange={(e) => setNewSpec(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addProduct(); } }}
                placeholder="규격 (선택)"
              />
              <select value={newRole} onChange={(e) => setNewRole(e.target.value as "main" | "sub")}>
                <option value="main">메인</option>
                <option value="sub">부자재</option>
              </select>
            </div>
            <button type="button" className="btn btn-add" style={{ marginTop: 8, width: "100%" }} onClick={addProduct}>+ 자재 추가</button>
          </div>

          <div className="form-group">
            <label>카탈로그 / 추가 자료</label>
            <textarea
              value={catalogInfo}
              onChange={(e) => setCatalogInfo(e.target.value)}
              placeholder="텍스트로 붙여넣기 하세요."
              rows={2}
            />
            <div style={{ marginTop: 8 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                multiple
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <button type="button" className="btn btn-add" style={{ width: "100%" }} onClick={() => fileInputRef.current?.click()}>
                + PDF / 이미지 파일 첨부
              </button>
            </div>
            {catalogFiles.length > 0 && (
              <div className="product-list" style={{ marginTop: 8 }}>
                {catalogFiles.map((f, i) => (
                  <div key={i} className="product-item">
                    <span className="product-role-badge main">{f.mediaType === "application/pdf" ? "PDF" : "이미지"}</span>
                    <span className="product-name">{f.name}</span>
                    <button type="button" className="product-remove" onClick={() => removeFile(i)} title="삭제">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>기타 참고 사항</label>
            <textarea
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              placeholder="타깃 고객, 예산 수준, 특수 조건 등 추가 정보"
              rows={2}
            />
          </div>

          <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={!canGenerate}>
            {loading ? "생성 중..." : "솔루션 초안 생성"}
          </button>
        </div>

        <div className="card">
          {loading && (
            <div className="loading-state"><div className="spinner" /><span>솔루션 초안을 생성하고 있습니다...</span></div>
          )}
          {!loading && error && <div className="error-state">오류: {error}</div>}
          {!loading && !error && !solution && (
            <div className="output-placeholder">
              <div className="output-placeholder-icon">📋</div>
              <span>왼쪽에서 정보를 입력하고<br />솔루션 초안 생성 버튼을 누르세요.</span>
            </div>
          )}
          {!loading && !error && solution && <SolutionOutput solution={solution} />}
        </div>
      </div>
    </div>
  );
}
