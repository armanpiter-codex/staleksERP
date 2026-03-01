export type FeedbackCategory = "bug" | "suggestion" | "question" | "other";
export type FeedbackPriority = "high" | "medium" | "low";
export type FeedbackStatus = "new" | "reviewing" | "resolved" | "closed";
export type FeedbackFileType = "image" | "audio" | "document";

export interface FeedbackAttachment {
  id: string;
  file_name: string;
  file_path: string;
  file_type: FeedbackFileType;
  mime_type: string;
  file_size: number;
  created_at: string;
}

export interface FeedbackAuthor {
  id: string;
  username: string;
  full_name: string;
}

export interface FeedbackItem {
  id: string;
  user_id: string | null;
  user: FeedbackAuthor | null;
  content: string;
  category: FeedbackCategory;
  priority: FeedbackPriority | null;
  status: FeedbackStatus;
  page_url: string | null;
  voice_transcript: string | null;
  ai_summary: string | null;
  ai_category: FeedbackCategory | null;
  admin_notes: string | null;
  attachments: FeedbackAttachment[];
  created_at: string;
  updated_at: string;
}

export interface PaginatedFeedback {
  items: FeedbackItem[];
  total: number;
}
