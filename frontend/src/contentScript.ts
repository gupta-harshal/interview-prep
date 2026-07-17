const REVIEW_BUTTON_ID = "devsrs-review-button";
const REVIEW_TOAST_ID = "devsrs-review-toast";
const REVIEW_BUTTON_STYLE_ID = "devsrs-review-button-style";
const GRAPHQL_ENDPOINT = new URL("/graphql/", window.location.origin).toString();

interface TopicTag {
  name: string;
  slug: string;
}

interface SubmissionSummary {
  id?: string;
  statusDisplay?: string;
  lang?: string;
  runtime?: string;
  memory?: string;
  timestamp?: string;
  code?: string;
  errorMessage?: string;
}

interface ReviewPayload {
  title: string;
  titleSlug: string;
  difficulty: string;
  topicTags: TopicTag[];
  url: string;
  questionHtml: string;
  questionText: string;
  currentSolutionCode: string;
  recentSubmissions: SubmissionSummary[];
  capturedAt: string;
}

interface QuestionDataResponse {
  question?: {
    title?: string;
    titleSlug?: string;
    content?: string;
    difficulty?: string;
    topicTags?: TopicTag[];
  };
}

interface SubmissionListResponse {
  submissionList?: {
    submissions?: Array<{
      id?: string;
      statusDisplay?: string;
      lang?: string;
      runtime?: string;
      memory?: string;
      timestamp?: string;
    }>;
  };
}

interface SubmissionDetailsResponse {
  submissionDetails?: {
    id?: string;
    statusDisplay?: string;
    lang?: string;
    runtime?: string;
    memory?: string;
    timestamp?: string;
    code?: string;
    statusMsg?: string;
    compileError?: string;
    runtimeError?: string;
  };
}

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

type WindowWithMonaco = Window & {
  monaco?: {
    editor?: {
      getModels?: () => Array<{ getValue: () => string }>;
    };
  };
};

function getTitleSlug() {
  const slug = window.location.pathname.split("/problems/")[1]?.split("/")[0]?.trim();
  return slug || null;
}

function isLeetCodeProblemPage() {
  return window.location.pathname.includes("/problems/");
}

async function postGraphQL<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as GraphQLResponse<T>;
    if (body.errors?.length) {
      return null;
    }

    return body.data ?? null;
  } catch {
    return null;
  }
}

async function fetchQuestionData(titleSlug: string) {
  const query = `
    query questionData($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        title
        titleSlug
        content
        difficulty
        topicTags {
          name
          slug
        }
      }
    }
  `;

  return postGraphQL<QuestionDataResponse>(query, { titleSlug });
}

async function fetchRecentSubmissions(titleSlug: string) {
  const listQuery = `
    query submissionList($offset: Int!, $limit: Int!, $questionSlug: String!) {
      submissionList(offset: $offset, limit: $limit, questionSlug: $questionSlug) {
        submissions {
          id
          statusDisplay
          lang
          runtime
          memory
          timestamp
        }
      }
    }
  `;

  const listResponse = await postGraphQL<SubmissionListResponse>(listQuery, {
    offset: 0,
    limit: 3,
    questionSlug: titleSlug,
  });

  const submissions = listResponse?.submissionList?.submissions ?? [];
  const detailsQuery = `
    query submissionDetails($submissionId: Int!) {
      submissionDetails(submissionId: $submissionId) {
        id
        statusDisplay
        lang
        runtime
        memory
        timestamp
        code
        statusMsg
        compileError
        runtimeError
      }
    }
  `;

  const detailedSubmissions = await Promise.all(
    submissions.slice(0, 3).map(async (submission) => {
      if (!submission.id) {
        return submission;
      }

      const submissionId = Number(submission.id);
      if (Number.isNaN(submissionId)) {
        return submission;
      }

      const detailResponse = await postGraphQL<SubmissionDetailsResponse>(detailsQuery, {
        submissionId,
      });

      const details = detailResponse?.submissionDetails;
      if (!details) {
        return submission;
      }

      return {
        ...submission,
        code: details.code,
        errorMessage: details.runtimeError || details.compileError || details.statusMsg || details.statusDisplay,
      };
    }),
  );

  return detailedSubmissions;
}

function getCurrentSolutionCode() {
  const monacoModels = (window as WindowWithMonaco).monaco?.editor?.getModels?.() ?? [];
  const modelCode = monacoModels.find((model) => model.getValue().trim().length > 0)?.getValue();
  if (modelCode) {
    return modelCode;
  }

  const visibleEditorText = Array.from(document.querySelectorAll("textarea"))
    .map((element) => (element as HTMLTextAreaElement).value)
    .find((value) => value.trim().length > 0);

  return visibleEditorText || "";
}

async function buildReviewPayload(): Promise<ReviewPayload | null> {
  const titleSlug = getTitleSlug();
  if (!titleSlug) {
    return null;
  }

  const questionResponse = await fetchQuestionData(titleSlug);
  const question = questionResponse?.question;
  if (!question) {
    return null;
  }

  const parser = new DOMParser();
  const parsedContent = parser.parseFromString(question.content || "", "text/html");

  return {
    title: question.title || document.title,
    titleSlug: question.titleSlug || titleSlug,
    difficulty: question.difficulty || "Unknown",
    topicTags: question.topicTags || [],
    url: window.location.href,
    questionHtml: question.content || "",
    questionText: parsedContent.body.textContent?.replace(/\s+/g, " ").trim() || "",
    currentSolutionCode: getCurrentSolutionCode(),
    recentSubmissions: await fetchRecentSubmissions(titleSlug),
    capturedAt: new Date().toISOString(),
  };
}

async function sendReviewPayload(payload: ReviewPayload) {
  const backendUrl = import.meta.env.VITE_SRS_BACKEND_URL as string | undefined;

  await chrome.storage.local.set({ latestReviewPayload: payload });

  if (!backendUrl) {
    showToast("Captured locally. Set VITE_SRS_BACKEND_URL to send it to your backend.");
    return;
  }

  const response = await fetch(backendUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Backend returned ${response.status}`);
  }

  showToast("Sent to backend and saved locally.");
}

function showToast(message: string) {
  const existingToast = document.getElementById(REVIEW_TOAST_ID);
  if (existingToast) {
    existingToast.textContent = message;
    return;
  }

  const toast = document.createElement("div");
  toast.id = REVIEW_TOAST_ID;
  toast.textContent = message;
  toast.style.position = "fixed";
  toast.style.right = "16px";
  toast.style.bottom = "16px";
  toast.style.zIndex = "2147483647";
  toast.style.padding = "10px 12px";
  toast.style.borderRadius = "8px";
  toast.style.background = "#111827";
  toast.style.color = "#e5e7eb";
  toast.style.border = "1px solid #374151";
  toast.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.35)";
  toast.style.fontSize = "12px";
  toast.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  document.body.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 2500);
}

function ensureButtonStyles() {
  if (document.getElementById(REVIEW_BUTTON_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = REVIEW_BUTTON_STYLE_ID;
  style.textContent = `
    #${REVIEW_BUTTON_ID} {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 0 14px;
      min-height: 32px;
      border-radius: 6px;
      border: 1px solid #7c3aed;
      background: linear-gradient(135deg, #8b5cf6, #6d28d9);
      color: #fff;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      box-shadow: 0 6px 18px rgba(109, 40, 217, 0.28);
      transition: transform 120ms ease, filter 120ms ease;
    }

    #${REVIEW_BUTTON_ID}:hover {
      filter: brightness(1.06);
      transform: translateY(-1px);
    }

    #${REVIEW_BUTTON_ID}:active {
      transform: translateY(0);
    }
  `;
  document.head.appendChild(style);
}

function findSubmitButton() {
  const buttons = Array.from(document.querySelectorAll("button")) as HTMLButtonElement[];

  return buttons.find((button) => {
    const label = (button.innerText || button.textContent || "").trim().toLowerCase();
    return button.offsetParent !== null && (label === "submit" || label.includes("submit"));
  }) ?? null;
}

function handleReviewClick() {
  void (async () => {
    try {
      showToast("Collecting LeetCode data...");
      const payload = await buildReviewPayload();

      if (!payload) {
        showToast("Could not collect problem data.");
        return;
      }

      await sendReviewPayload(payload);
      console.log("DevSRS review payload:", payload);
      showToast(`Sent ${payload.title}`);
    } catch (error) {
      console.error("DevSRS review capture failed:", error);
      showToast("Capture failed. Open a problem page and try again.");
    }
  })();
}

function injectReviewButton() {
  if (!isLeetCodeProblemPage()) return;
  if (document.getElementById(REVIEW_BUTTON_ID)) return;

  const submitButton = findSubmitButton();
  if (!submitButton) return;

  const parent = submitButton.parentElement;
  if (!parent) return;

  ensureButtonStyles();

  const reviewButton = document.createElement("button");
  reviewButton.id = REVIEW_BUTTON_ID;
  reviewButton.type = "button";
  reviewButton.textContent = "Review";
  reviewButton.addEventListener("click", handleReviewClick);

  submitButton.insertAdjacentElement("afterend", reviewButton);
  showToast("Review button ready");
}

function startReviewButtonObserver() {
  injectReviewButton();

  const observer = new MutationObserver(() => {
    injectReviewButton();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startReviewButtonObserver, { once: true });
} else {
  startReviewButtonObserver();
}