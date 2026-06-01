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
  telegramUsername?: string;
  telegramActivityMessages?: number;
  telegramActivityScore?: number;
  telegramActivitySummary?: string;
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
  version: number;
  status: "draft" | "approved" | "completed" | "archived";
  startDate: string;
  baseDeadline: string;
  adjustedDeadline: string;
  milestones: string[];
  steps: {
    id: string;
    title: string;
    description: string;
    deadline: string;
    status: "todo" | "in_progress" | "done" | "canceled";
    assignedTo?: string;
    source: "ai" | "manual";
  }[];
  aiRationale: string;
  issues: {
    id: string;
    title: string;
    severity: "low" | "medium" | "high";
    impactDays: number;
    status: "open" | "resolved";
  }[];
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
};

export type OfficeLocation = {
  id: string;
  category: Category;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  minWeeklyOfficeDays: number;
};

export type AttendanceSummary = {
  officeLocation: OfficeLocation | null;
  currentWeekOfficeDays: number;
  minWeeklyOfficeDays: number;
  requirementMet: boolean;
  checkedInToday: boolean;
  latest?: {
    id: string;
    date: string;
    locationStatus: "unconfigured" | "verified" | "out_of_range";
    distanceMeters?: number;
  };
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
    officeAttendanceCount: number;
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
      officeAttendanceCount: number;
      currentWeekOfficeDays?: number;
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

export type PlanFitCandidate = {
  user: User;
  score: number;
  matchReason: string;
  risks: string[];
  source: "same_department" | "other_department";
  surveyAnalysis?: Survey["analysis"];
  averageScore: number;
  reportsCount: number;
};

export type PlanFitResponse = {
  answer: string;
  plan: {
    id: string;
    title: string;
    category: Category;
    categoryLabel: string;
    adjustedDeadline: string;
    milestones: string[];
  } | null;
  candidates: PlanFitCandidate[];
  fallbackUsed: boolean;
};

export type DecisionCenter = {
  scope: "department" | "all";
  plan?: {
    id: string;
    title: string;
    category: Category;
    categoryLabel: string;
    adjustedDeadline: string;
    milestones: string[];
  };
  recommended: PlanFitCandidate[];
  attention: {
    user: User;
    reason: string;
    severity: "low" | "medium" | "high";
  }[];
  missingReports: User[];
  blockerReports: {
    user: User;
    date: string;
    blockers: string;
    aiSummary?: string;
  }[];
  summary: string;
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
