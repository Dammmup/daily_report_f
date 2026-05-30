export type Role = "intern" | "lead" | "admin";

export type Category =
  | "data-system-ml"
  | "marketing-sales"
  | "erp-development"
  | "data-security";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  category?: Category;
  categoryLabel?: string;
  avatarColor: string;
  firstLoginCompleted: boolean;
  emailVerified: boolean;
  telegramLinked: boolean;
  telegramDigestEnabled?: boolean;
  telegramDigestTime?: string;
  telegramDigestContent?: "productivity" | "reports" | "full";
  lastActiveAt: string;
};

export type AiReview = {
  productivityScore: number;
  summary: string;
  risks: string[];
  nextActions: string[];
  deadlineImpactDays: number;
  criteria?: {
    resultClarity: number;
    planClarity: number;
    blockerControl: number;
    initiative: number;
  };
  explanation?: string;
  confidence?: "low" | "medium" | "high";
  model: string;
};

export type Survey = {
  id: string;
  analysis: {
    strengths: string[];
    weaknesses: string[];
    skillsSummary?: string;
    experienceSummary?: string;
    goalAlignment?: string;
    suggestedTrack?: string;
    mentorFocus?: string[];
    recommendation: string;
    riskLevel: "low" | "medium" | "high";
  };
};

export type Plan = {
  id: string;
  leadId?: string;
  title: string;
  category: Category;
  status: "draft" | "approved";
  startDate: string;
  baseDeadline: string;
  adjustedDeadline: string;
  milestones: string[];
  aiRationale: string;
  issues: {
    id: string;
    title: string;
    severity: "low" | "medium" | "high";
    impactDays: number;
    status: "open" | "resolved";
  }[];
};

export type Report = {
  id: string;
  userId: string;
  date: string;
  yesterday: string;
  todayPlan: string;
  blockers: string;
  status?: "submitted" | "late";
  createdAt: string;
  aiReview?: AiReview;
  user?: User;
};

export type Dashboard = {
  stats: {
    internsTotal: number;
    checkedInToday: number;
    reportsTotal: number;
    aiReviewedReports: number;
    averageScore: number;
    byCategory: {
      key: string;
      label: string;
      interns: number;
      reports: number;
      averageScore: number;
    }[];
  };
  interns: (User & {
    attendanceCount: number;
    reportsCount: number;
    averageScore: number;
    activeToday: boolean;
    survey?: Survey;
    plan?: Plan;
  })[];
  reports: Report[];
};

export type AiSummary = {
  overview: {
    averageScore: number;
    aiReviewedReports: number;
    internsWithSurvey: number;
    needsAttention: number;
  };
  interns: {
    user: User;
    stats: {
      reportsCount: number;
      aiReviewedReports: number;
      averageScore: number;
      attendanceCount: number;
      blockerReports: number;
      lastReportAt?: string;
    };
    surveyAnalysis?: Survey["analysis"];
    latestReportAi?: AiReview;
    latestReportDate?: string;
    plan?: Plan;
  }[];
};

export type InternProfile = {
  user: User;
  survey?: Survey;
  plan?: Plan;
  reports: Report[];
  attendance: unknown[];
  stats: AiSummary["interns"][number]["stats"];
};

const tokenKey = "dailyreport-token";
const apiBaseUrl = import.meta.env.VITE_API_URL || "";

export function getToken() {
  return localStorage.getItem(tokenKey);
}

export function setToken(token: string) {
  localStorage.setItem(tokenKey, token);
}

export function clearToken() {
  localStorage.removeItem(tokenKey);
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
  const text = await response.text();
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data = text && isJson ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || `Ошибка запроса: ${response.status}`);
  }

  return data as T;
}
