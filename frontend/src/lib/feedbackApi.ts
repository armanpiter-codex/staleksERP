import api from "@/lib/api";
import type {
  FeedbackDialogResponse,
  FeedbackItem,
  FeedbackMessage,
  PaginatedFeedback,
} from "@/types/feedback";

const BASE = "/feedback";

export async function submitFeedback(formData: FormData): Promise<FeedbackItem> {
  const { data } = await api.post<FeedbackItem>(BASE, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getMessages(feedbackId: string): Promise<FeedbackMessage[]> {
  const { data } = await api.get<FeedbackMessage[]>(
    `${BASE}/${feedbackId}/messages`
  );
  return data;
}

export async function sendMessage(
  feedbackId: string,
  content: string
): Promise<FeedbackDialogResponse> {
  const { data } = await api.post<FeedbackDialogResponse>(
    `${BASE}/${feedbackId}/messages`,
    { content }
  );
  return data;
}

export async function confirmFeedback(feedbackId: string): Promise<FeedbackItem> {
  const { data } = await api.post<FeedbackItem>(
    `${BASE}/${feedbackId}/confirm`
  );
  return data;
}

export async function listFeedback(params?: {
  status?: string;
  category?: string;
  priority?: string;
  limit?: number;
  offset?: number;
}): Promise<PaginatedFeedback> {
  const { data } = await api.get<PaginatedFeedback>(BASE, { params });
  return data;
}

export async function getFeedback(id: string): Promise<FeedbackItem> {
  const { data } = await api.get<FeedbackItem>(`${BASE}/${id}`);
  return data;
}

export async function getNewFeedbackCount(): Promise<number> {
  const { data } = await api.get<{ count: number }>(`${BASE}/count`);
  return data.count;
}

export async function updateFeedback(
  id: string,
  payload: { status?: string; admin_notes?: string }
): Promise<FeedbackItem> {
  const { data } = await api.patch<FeedbackItem>(`${BASE}/${id}`, payload);
  return data;
}
