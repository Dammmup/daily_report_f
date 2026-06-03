export type Role = "intern" | "lead" | "admin";

export type Category =
  | "data-analytics"
  | "system-analytics"
  | "machine-learning"
  | "marketing"
  | "sales"
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
  avatarUrl?: string;
  bio?: string;
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
  lastDepartmentChangedAt?: string;
  lastDepartmentChangeReason?: string;
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
    technicalSpec?: string;
    technicalInstruction?: string;
    deadline: string;
    status: "todo" | "in_progress" | "done" | "canceled";
    assignedTo?: string;
    source: "ai" | "manual";
    overdue?: boolean;
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
  telegramAnnouncedAt?: string;
  completedAt?: string;
};

export type TelegramRecoveryBroadcastResult = {
  groups: number;
  motivationMessages: number;
  pendingPlans: number;
  announcedPlans: number;
  planAnnouncementMessages: number;
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
  linkedStepIds: string[];
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
    plans: {
      id: string;
      title: string;
      category: Category;
      categoryLabel: string;
      adjustedDeadline: string;
      progress: {
        total: number;
        done: number;
        inProgress: number;
        todo: number;
        canceled: number;
        overdue: number;
        unassigned: number;
        completionPercent: number;
      };
    }[];
  };
  interns: (User & {
    attendanceCount: number;
    reportsCount: number;
    averageScore: number;
    activeToday: boolean;
    officeAttendanceCount: number;
    assignedOpenSteps: number;
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

export type RiskCenter = {
  overdueSteps: { planId: string; planTitle: string; stepId: string; title: string; deadline: string; assignedTo?: string }[];
  missingReports: User[];
  weakInterns: (User & { averageScore?: number })[];
  officeIssues: User[];
};

export type StepThread = {
  comments: { id: string; text: string; user?: User; createdAt: string }[];
  artifacts: { id: string; title: string; url: string; user?: User; createdAt: string }[];
};

export type AuditLog = {
  id: string;
  actorId?: string;
  actor?: User;
  action: string;
  entityType: string;
  entityId?: string;
  category?: Category;
  message: string;
  meta?: Record<string, unknown>;
  createdAt: string;
};

export type UploadedFile = {
  url: string;
  pathname: string;
  contentType: string;
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

export class ApiError extends Error {
  status: number;
  requestId?: string;

  constructor(message: string, status: number, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.requestId = requestId;
  }
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
    const requestId = data?.requestId;
    const detail = data?.detail ? ` ${data.detail}` : "";
    const suffix = requestId ? ` Код ошибки: ${requestId}` : "";
    throw new ApiError(`${data?.message || `Ошибка запроса: ${response.status}`}${detail}${suffix}`, response.status, requestId);
  }

  return data as T;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function uploadFile(file: File, scope: "avatar" | "artifact") {
  return api<UploadedFile>("/api/uploads", {
    method: "POST",
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      data: await fileToBase64(file),
      scope
    })
  });
}
