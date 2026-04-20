export interface Product {
  id: string;
  name: string;
  spec?: string;
  role: "main" | "sub";
}

export interface CatalogFile {
  name: string;
  data: string;
  mediaType: "application/pdf" | "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  extractedText?: string; // PDFs: text extracted client-side, data will be empty
}

export interface SubjectTag {
  main: string;
  subs: string[];
  isNew: boolean;
}

export interface SolutionRequest {
  situation: string;
  products: Product[];
  catalogInfo?: string;
  catalogFiles?: CatalogFile[];
  additionalContext?: string;
}

export interface ImageStoryboard {
  section: string;
  description: string;
  purpose: string;
}

export interface DetailPageSection {
  title: string;
  content: string;
  imageNeeded?: ImageStoryboard;
}

export interface SolutionDraft {
  name: string;
  subjects: SubjectTag[];
  process: string;
  tags: string[];
  specs: string;
  mainMaterials: { name: string; spec: string; purpose: string }[];
  subMaterials: { name: string; spec: string; purpose: string }[];
  detailPage: DetailPageSection[];
  notes?: string;
}
